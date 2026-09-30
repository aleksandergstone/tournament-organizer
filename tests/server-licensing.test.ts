// The seam between the payment service and the app.
//
// Everything here is deterministic and runs with no provider, no network and no
// money. It exists because the two halves live in different languages and the
// failure mode is silent: if the server and the app disagree about the canonical
// bytes, every license mints fine and then fails in the customer's app.
//
// If you change either canonicalize(), this is the test that tells you.
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { canonicalize as appCanonicalize, verifyLicense, LICENSE_PRODUCT } from '../src/engine/license';
import { canonicalize as serverCanonicalize, formatKey, issueLicense, publicKeyB64 } from '../server/license-signing.mjs';
import { handleOrderCreated, safeEqual, verifyWebhookSignature } from '../server/webhook.mjs';

const NOW = new Date('2026-05-01T12:00:00.000Z');
const SECRET = 'whsec_test_secret';

/** A throwaway key pair: the server signs with the private half, the app verifies with the public one. */
function useKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  process.env.LICENSE_PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return publicKeyB64();
}

const baseClaims = {
  v: 1, product: LICENSE_PRODUCT, licenseId: 'lic-9',
  customerEmail: 'anna@example.com', customerName: 'Anna',
  issuedAt: '2026-05-01T12:00:00.000Z', expiresAt: null, activationLimit: 1,
  activationUsage: 0, features: ['*'], revoked: false, issuedBy: 'license-api',
};

beforeEach(() => { useKeyPair(); });
afterEach(() => { delete process.env.LICENSE_PRIVATE_KEY_PEM; });

/** An in-memory stand-in for server/store.mjs. */
function memoryStore() {
  const licenses = {};
  const orders = {};
  return {
    getLicense: e => licenses[String(e).toLowerCase()] ?? null,
    putLicense: r => { licenses[r.email] = r; return r; },
    claimOrder: (id, email) => { if (orders[id]) return false; orders[id] = email; return true; },
    licenses, orders,
  };
}

describe('the server and the app sign the same bytes', () => {
  it('canonicalizes a full claim identically on both sides', () => {
    expect(serverCanonicalize(baseClaims)).toBe(appCanonicalize(baseClaims as never));
  });

  it('agrees even when optional fields are absent', () => {
    const sparse = { ...baseClaims, customerName: undefined, issuedBy: undefined, activationUsage: undefined };
    expect(serverCanonicalize(sparse)).toBe(appCanonicalize(sparse as never));
  });

  it('agrees on feature order — the sorted list is part of the signed bytes', () => {
    const a = { ...baseClaims, features: ['print.pack', 'branding.documents'] };
    const b = { ...baseClaims, features: ['branding.documents', 'print.pack'] };
    expect(serverCanonicalize(a)).toBe(serverCanonicalize(b));
    expect(serverCanonicalize(a)).toBe(appCanonicalize(a as never));
  });

  it('agrees that a perpetual license has a null expiry', () => {
    const c = { ...baseClaims, expiresAt: null };
    expect(serverCanonicalize(c)).toBe(appCanonicalize(c as never));
  });
});

describe('a license the service issues activates in the app', () => {
  it('verifies against the app with the matching public key', async () => {
    const pub = useKeyPair();
    const env = issueLicense({ email: 'anna@example.com', name: 'Anna', devices: 1, now: NOW });
    const v = await verifyLicense(env as never, pub, NOW);
    expect(v.ok, JSON.stringify(v)).toBe(true);
    expect(env.claims.expiresAt).toBeNull();       // perpetual
    expect(env.claims.activationLimit).toBe(1);
    expect(env.claims.activationUsage).toBe(0);
    expect(env.claims.customerEmail).toBe('anna@example.com');
  });

  it('survives the paste-key round trip', async () => {
    const pub = useKeyPair();
    const env = issueLicense({ email: 'anna@example.com', now: NOW });
    const key = formatKey(env as never);
    expect(key.startsWith('TO-PRO.')).toBe(true);
    const parts = key.split('.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const v = await verifyLicense({ claims, signature: parts[2] } as never, pub, NOW);
    expect(v.ok, JSON.stringify(v)).toBe(true);
  });

  it('is refused once any claim is changed on the way to the app', async () => {
    const pub = useKeyPair();
    const env = issueLicense({ email: 'anna@example.com', devices: 1, now: NOW });
    for (const tamper of [{ activationLimit: 9 }, { expiresAt: '2030-01-01T00:00:00.000Z' }, { features: [] }]) {
      const forged = { claims: { ...env.claims, ...tamper }, signature: env.signature };
      expect((await verifyLicense(forged as never, pub, NOW)).ok, JSON.stringify(tamper)).toBe(false);
    }
  });

  it('refuses to sign at all when no private key is configured', () => {
    delete process.env.LICENSE_PRIVATE_KEY_PEM;
    expect(() => issueLicense({ email: 'anna@example.com', now: NOW })).toThrow(/LICENSE_PRIVATE_KEY_PEM/);
  });
});

describe('webhook signature verification', () => {
  const body = Buffer.from(JSON.stringify({ meta: { event_name: 'order_created' } }), 'utf8');
  const sig = () => createHmac('sha256', SECRET).update(body).digest('hex');

  it('accepts a body signed with the store secret', () => {
    expect(verifyWebhookSignature(body, sig(), SECRET).ok).toBe(true);
  });

  it('refuses a tampered body', () => {
    const tampered = Buffer.from(JSON.stringify({ meta: { event_name: 'order_refunded' } }), 'utf8');
    expect(verifyWebhookSignature(tampered, sig(), SECRET).ok).toBe(false);
  });

  it('refuses a missing signature, and refuses to run with no secret at all', () => {
    expect(verifyWebhookSignature(body, undefined, SECRET).reason).toBe('missing-signature');
    expect(verifyWebhookSignature(body, sig(), '').reason).toBe('no-secret-configured');
  });

  it('compares in constant time without throwing on a length mismatch', () => {
    expect(safeEqual('short', 'a much longer value')).toBe(false);
    expect(safeEqual('same', 'same')).toBe(true);
  });
});describe('one order produces one license, however many times it arrives', () => {
  const order = {
    meta: { event_name: 'order_created', order_id: 'o-1' },
    data: { attributes: { identifier: 'o-1', user_email: 'Anna@Example.com', user_name: 'Anna' } },
  };

  it('issues on the first delivery', () => {
    const store = memoryStore();
    const r = handleOrderCreated(order, { store, devices: 1, now: NOW });
    expect(r.status).toBe('issued');
    expect(r.key.startsWith('TO-PRO.')).toBe(true);
    expect(Object.keys(store.licenses)).toHaveLength(1);
  });

  it('does not mint a second key when the provider retries', () => {
    const store = memoryStore();
    handleOrderCreated(order, { store, now: NOW });
    const again = handleOrderCreated(order, { store, now: NOW });
    expect(again.status).toBe('duplicate');
    expect(Object.keys(store.licenses)).toHaveLength(1);
  });

  it('answers a repeat purchase for the same person with their existing key', () => {
    const store = memoryStore();
    handleOrderCreated(order, { store, now: NOW });
    const other = { ...order, data: { attributes: { ...order.data.attributes, identifier: 'o-2' } } };
    const r = handleOrderCreated(other, { store, now: NOW });
    expect(r.status).toBe('duplicate');
    expect(r.key).toBeTruthy();
  });

  it('normalises the email, so a repeat purchase cannot fork the record', () => {
    const store = memoryStore();
    handleOrderCreated(order, { store, now: NOW });
    const shouted = { ...order, data: { attributes: { ...order.data.attributes, identifier: 'o-9', user_email: 'anna@example.com' } } };
    handleOrderCreated(shouted, { store, now: NOW });
    expect(Object.keys(store.licenses)).toEqual(['anna@example.com']);
  });

  it('keeps the license when delivery fails, so resend can recover it', () => {
    const store = memoryStore();
    const r = handleOrderCreated(order, { store, deliver: () => false, now: NOW });
    expect(r.delivered).toBe(false);
    expect(store.getLicense('anna@example.com')).not.toBeNull();
  });

  it('ignores an order with no email rather than issuing a broken license', () => {
    const store = memoryStore();
    const r = handleOrderCreated({ meta: {}, data: { attributes: { identifier: 'o-3' } } }, { store, now: NOW });
    expect(r.status).toBe('ignored');
    expect(Object.keys(store.licenses)).toHaveLength(0);
  });

  it('hands back a key the customer can actually activate', async () => {
    const pub = useKeyPair();
    const store = memoryStore();
    const r = handleOrderCreated(order, { store, deliver: rec => formatKey(rec.envelope), now: NOW });
    const parts = r.key.split('.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const v = await verifyLicense({ claims, signature: parts[2] } as never, pub, NOW);
    expect(v.ok, JSON.stringify(v)).toBe(true);
  });
});
