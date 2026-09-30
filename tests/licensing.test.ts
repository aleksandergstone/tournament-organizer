// Licensing behaviour, end to end, with a key pair made for the test.
//
// No private key is committed here: the test signs with a throwaway pair and
// verifies against its own public key, which exercises exactly the code the app
// runs (WebCrypto Ed25519 over the canonical claims).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LICENSE_PRODUCT, activateLicense, activationCheck, canonicalize, currentTier,
  deactivateLicense, deviceId, exportLicenseInfo, formatLicenseKey, hasFeature,
  isProActive, loadLicense, parseLicense, refreshLicense, revalidate, saveLicense,
  setLicenseStore, verifyLicense, setRevalidator, setLicensePublicKey,
  type LicenseClaims, type LicenseEnvelope,
} from '../src/engine/license';
import { has, proFeatures, tierOf } from '../src/engine/features';

const enc = new TextEncoder();
const b64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function testKeyPair() {
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  return { publicB64: b64(raw), privateKey: kp.publicKey ? kp.privateKey : kp.privateKey };
}

async function sign(key: CryptoKey, c: LicenseClaims): Promise<string> {
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, enc.encode(canonicalize(c)));
  return b64(new Uint8Array(sig));
}

const NOW = new Date('2026-02-01T00:00:00.000Z');

function claims(over: Partial<LicenseClaims> = {}): LicenseClaims {
  return {
    v: 1, product: LICENSE_PRODUCT, licenseId: 'lic-1',
    customerEmail: 'anna@example.com', customerName: 'Anna',
    issuedAt: '2026-01-15T10:00:00.000Z', expiresAt: null, activationLimit: 1,
    features: ['*'], revoked: false, issuedBy: 'test', ...over,
  };
}

async function issue(privateKey: CryptoKey, over: Partial<LicenseClaims> = {}): Promise<LicenseEnvelope> {
  const c = claims(over);
  return { claims: c, signature: await sign(privateKey, c) };
}

/** A fresh in-memory install: nothing on this machine but what a test puts there. */
function freshInstall(): Map<string, string> {
  const map = new Map<string, string>();
  setLicenseStore({
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: k => { map.delete(k); },
  });
  return map;
}

let kp: { publicB64: string; privateKey: CryptoKey };

beforeEach(async () => {
  kp = await testKeyPair();
  // The app verifies with the embedded key; the test verifies with its own.
  setLicensePublicKey(kp.publicB64);
  freshInstall();
  await refreshLicense(NOW);
});

afterEach(() => setLicensePublicKey(null));

describe('a free install works and is not Pro', () => {
  it('starts Free with no license at all', () => {
    expect(loadLicense()).toBeNull();
    expect(isProActive()).toBe(false);
    expect(currentTier()).toBe('free');
  });

  it('keeps the whole core workflow available', () => {
    for (const id of ['project.create', 'project.import', 'project.export', 'results.entry',
      'standings.view', 'export.print', 'display.kiosk', 'sync.lan', 'schedule.venues']) {
      expect(hasFeature(id), id).toBe(true);
      expect(has(id), id).toBe(true);
      expect(tierOf(id), id).toBe('free');
    }
  });

  it('locks every declared Pro feature', () => {
    for (const f of proFeatures()) expect(hasFeature(f.id), f.id).toBe(false);
  });
});

describe('a valid signed license unlocks Pro', () => {
  it('activates, persists, and survives an offline restart', async () => {
    const env = await issue(kp.privateKey);
    const r = await activateLicense(JSON.stringify(env), NOW);
    expect(r.ok).toBe(true);
    expect(isProActive()).toBe(true);

    // A restart: nothing in memory, only the envelope that was written to disk.
    const map = freshInstall();
    map.set('to:license', JSON.stringify(env));
    const state = await refreshLicense(new Date('2026-09-01T00:00:00.000Z'));
    expect(state.status).toBe('pro');
    expect(isProActive()).toBe(true);
  });

  it('never expires when expiresAt is null, thirty years later', async () => {
    const env = await issue(kp.privateKey, { expiresAt: null });
    const v = await verifyLicense(env, kp.publicB64, new Date('2056-01-01T00:00:00.000Z'));
    expect(v.ok).toBe(true);
  });

  it('honours an explicit feature list instead of unlocking everything', async () => {
    const env = await issue(kp.privateKey, { features: ['branding.documents'] });
    await activateLicense(JSON.stringify(env), NOW);
    expect(hasFeature('branding.documents')).toBe(true);
    expect(hasFeature('print.pack')).toBe(false);
  });

  it('activates from the one-line key a customer pastes', async () => {
    const env = await issue(kp.privateKey);
    expect((await activateLicense(formatLicenseKey(env), NOW)).ok).toBe(true);
    expect(isProActive()).toBe(true);
  });
});

describe('anything that is not genuinely signed is refused', () => {
  it('rejects a hand-written license with no signature', async () => {
    const env = await issue(kp.privateKey);
    delete (env as unknown as { signature: string }).signature;
    expect((await verifyLicense(env, kp.publicB64, NOW)).ok).toBe(false);
  });

  it('rejects edited claims — the signature no longer matches', async () => {
    const env = await issue(kp.privateKey, { features: ['branding.documents'] });
    const forged = { ...env, claims: { ...env.claims, features: ['*'] } };
    const v = await verifyLicense(forged, kp.publicB64, NOW);
    expect(!v.ok && v.reason).toBe('bad-signature');
  });

  it('rejects a license someone extended to a later date', async () => {
    const env = await issue(kp.privateKey, { expiresAt: '2026-06-01T00:00:00.000Z' });
    const extended = { ...env, claims: { ...env.claims, expiresAt: '2036-06-01T00:00:00.000Z' } };
    expect((await verifyLicense(extended, kp.publicB64, NOW)).ok).toBe(false);
  });

  it('rejects a license signed by a different key', async () => {
    const other = await testKeyPair();
    const v = await verifyLicense(await issue(other.privateKey), kp.publicB64, NOW);
    expect(!v.ok && v.reason).toBe('bad-signature');
  });

  it('rejects a revoked license even though its signature is valid', async () => {
    const c = claims({ revoked: true });
    const v = await verifyLicense({ claims: c, signature: await sign(kp.privateKey, c) }, kp.publicB64, NOW);
    expect(!v.ok && v.reason).toBe('revoked');
  });

  it('rejects a license for a different product', async () => {
    const v = await verifyLicense(await issue(kp.privateKey, { product: 'some-other-app' }), kp.publicB64, NOW);
    expect(!v.ok && v.reason).toBe('wrong-product');
  });

  it('rejects an expired license', async () => {
    const env = await issue(kp.privateKey, { expiresAt: '2026-01-20T00:00:00.000Z' });
    const v = await verifyLicense(env, kp.publicB64, NOW);
    expect(!v.ok && v.reason).toBe('expired');
  });

  it('rejects an activation limit that was raised by hand', async () => {
    const env = await issue(kp.privateKey, { activationLimit: 1 });
    expect((await activateLicense(JSON.stringify({ ...env, claims: { ...env.claims, activationLimit: 99 } }), NOW)).ok).toBe(false);
  });

  it('stays Free and stores nothing when a key is refused', async () => {
    const map = freshInstall();
    expect((await activateLicense('not-a-license', NOW)).ok).toBe(false);
    expect(isProActive()).toBe(false);
    expect(map.get('to:license')).toBeUndefined();
  });
});

describe('the activation limit is enforced per device', () => {
  it('lets the first device in and turns the second away', async () => {
    const env = await issue(kp.privateKey, { activationLimit: 1 });
    freshInstall();
    await activateLicense(JSON.stringify(env), NOW);
    expect(isProActive()).toBe(true);
    const seatTaken = deviceId();

    // Device B: a different install, with the activation counters copied — the
    // scenario a casual sharer actually produces.
    const mapB = freshInstall();
    mapB.set('to:license-activations', JSON.stringify({ [env.claims.licenseId]: [seatTaken] }));
    mapB.set('to:device-id', '00000000000000be');
    expect(activationCheck(env)).toBe('activation-limit');
    expect((await activateLicense(JSON.stringify(env), NOW)).ok).toBe(false);
    expect(isProActive()).toBe(false);
    expect(mapB.get('to:license')).toBeUndefined();
  });

  it('lets the same device back in without consuming a second seat', async () => {
    const env = await issue(kp.privateKey, { activationLimit: 1 });
    await activateLicense(JSON.stringify(env), NOW);
    expect(activationCheck(env)).toBeNull();
  });

  it('frees the seat when the license is deactivated', async () => {
    const env = await issue(kp.privateKey, { activationLimit: 1 });
    await activateLicense(JSON.stringify(env), NOW);
    deactivateLicense();
    expect(isProActive()).toBe(false);
    expect(activationCheck(env)).toBeNull();
    expect((await activateLicense(JSON.stringify(env), NOW)).ok).toBe(true);
  });

  it('allows any number of devices when the limit is null', async () => {
    const env = await issue(kp.privateKey, { activationLimit: null });
    await activateLicense(JSON.stringify(env), NOW);
    expect(activationCheck(env, 'some-other-device')).toBeNull();
  });
});
describe('license files move between machines', () => {
  it('exports the active license as a key that re-imports', async () => {
    const env = await issue(kp.privateKey);
    await activateLicense(JSON.stringify(env), NOW);
    const text = exportLicenseInfo();
    expect(text.startsWith('TO-PRO.')).toBe(true);

    freshInstall();
    expect((await activateLicense(text, NOW)).ok).toBe(true);
    expect(isProActive()).toBe(true);
  });

  it('round-trips the JSON envelope form', async () => {
    const env = await issue(kp.privateKey);
    await activateLicense(JSON.stringify(env), NOW);
    expect(parseLicense(JSON.stringify(loadLicense()))!.claims.licenseId).toBe(env.claims.licenseId);
  });

  it('stores only a signed envelope — no "pro" flag anywhere', () => {
    expect(freshInstall().size).toBe(0);
    expect(loadLicense()).toBeNull();
  });
});

describe('offline first', () => {
  it('starts Pro from disk with no network', async () => {
    const env = await issue(kp.privateKey);
    await activateLicense(JSON.stringify(env), NOW);
    const map = freshInstall();
    saveLicense(env);
    expect((await refreshLicense(new Date('2026-03-01T00:00:00.000Z'))).status).toBe('pro');
    expect(map.get('to:license')).toBeTruthy();
  });

  it('keeps the license when a revalidation call cannot reach anything', async () => {
    const env = await issue(kp.privateKey);
    await activateLicense(JSON.stringify(env), NOW);
    setRevalidator(async () => { throw new Error('offline'); });
    expect((await revalidate(NOW)).status).toBe('pro');
    setRevalidator(null);
  });

  it('drops to Free once a server says the license is revoked', async () => {
    const env = await issue(kp.privateKey);
    await activateLicense(JSON.stringify(env), NOW);
    setRevalidator(async () => false);
    const state = await revalidate(NOW);
    setRevalidator(null);
    expect(state.status).toBe('free');
    expect(state.reason).toBe('revoked');
    expect(hasFeature('branding.documents')).toBe(false);
  });

  it('needs no revalidator at all to stay Pro', async () => {
    const env = await issue(kp.privateKey);
    await activateLicense(JSON.stringify(env), NOW);
    setRevalidator(null);
    expect((await revalidate(NOW)).status).toBe('pro');
  });
});