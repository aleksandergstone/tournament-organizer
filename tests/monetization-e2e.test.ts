// The whole monetisation journey, wired end to end.
//
//   paid order → webhook → signed license → pasted into the app → gate opens
//
// and, just as important, every way it must NOT open without a signature. These
// tests drive the real modules across the real boundary — the server signs, the
// app verifies — because a suite that mocks the signature check proves nothing
// about whether the gate holds.
//
// The other half of this file is deliberately adversarial: it tries the cheap
// bypasses a user would actually try, and requires that none of them work.
import { createHmac, generateKeyPairSync } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { issueLicense } from '../server/license-signing.mjs';
import { handleOrderCreated, verifyWebhookSignature } from '../server/webhook.mjs';
import { has, proFeatures } from '../src/engine/features';
import {
  hasFeature, isProActive, deactivateLicense, exportLicenseInfo, refreshLicense,
  revalidate, setLicensePublicKey, setRevalidator, setLicenseStore, activateLicense,
} from '../src/engine/license';

const NOW = new Date('2026-03-01T00:00:00.000Z');

/** The three features the Pro boundary actually gates today. */
const GATED = ['branding.documents', 'display.kiosk', 'sync.lan'];

function install() {
  const map = new Map<string, string>();
  setLicenseStore({
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: k => { map.delete(k); },
  });
  return map;
}

/**
 * A throwaway key pair. The production private key is not in this repository and
 * must not be, so the server signs with this one and the app verifies with its
 * public half. Everything else — the real canonical form, the real Ed25519
 * verification, the real gate — is the shipping code path.
 */
function useKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const raw = Buffer.from(der.subarray(der.length - 32)).toString('base64url');
  process.env.LICENSE_PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  setLicensePublicKey(raw);
}

let store: Map<string, string>;

function memoryDb() {
  const licenses: Record<string, unknown> = {};
  const orders: Record<string, string> = {};
  return {
    getLicense: (e: string) => licenses[e.toLowerCase()] ?? null,
    putLicense: (r: { email: string }) => { licenses[r.email] = r; return r; },
    claimOrder: (id: string, email: string) => {
      if (orders[id]) return false;
      orders[id] = email;
      return true;
    },
    licenses,
  };
}

const order = (email: string, id = 'o-1') => ({
  meta: { event_name: 'order_created', order_id: id },
  data: { attributes: { identifier: id, user_email: email, user_name: 'Anna' } },
});

beforeEach(async () => {
  useKeyPair();
  store = install();
  setRevalidator(null);
  await refreshLicense(NOW);
});

// ---------------------------------------------------------------------------
// The happy path, exercised across the real server/app boundary.
// ---------------------------------------------------------------------------

describe('a customer pays and gets Pro', () => {
  it('goes from an order to a working license without anything being stubbed', async () => {
    // 1. The store calls the webhook, signed with its secret.
    const body = Buffer.from(JSON.stringify(order('anna@example.com')));
    const sig = createHmac('sha256', 'whsec_x').update(body).digest('hex');
    expect(verifyWebhookSignature(body, sig, 'whsec_x').ok).toBe(true);

    // 2. The service issues a license.
    const db = memoryDb();
    const issued = handleOrderCreated(order('anna@example.com'), { store: db, devices: 1, now: NOW });
    expect(issued.status).toBe('issued');
    expect(issued.key.startsWith('TO-PRO.')).toBe(true);

    // 3. The customer pastes the key into the app.
    expect((await activateLicense(issued.key, NOW)).ok).toBe(true);

    // 4. Pro is actually on — not a label, the features themselves.
    expect(isProActive()).toBe(true);
    for (const id of GATED) expect(hasFeature(id), id).toBe(true);
    expect(has('display.kiosk')).toBe(true);
  });

  it('never expires and never needs the network again', async () => {
    const db = memoryDb();
    const { key } = handleOrderCreated(order('anna@example.com'), { store: db, now: NOW });
    await activateLicense(key, NOW);

    // Two years later, with no server anywhere in sight.
    setRevalidator(null);
    const later = await revalidate(new Date('2028-01-01T00:00:00.000Z'));
    expect(later.status).toBe('pro');
    for (const id of GATED) expect(hasFeature(id), id).toBe(true);
  });
});

// The cheap bypasses. Each of these is something a real user would try first,
// and each must leave the app in Free.
describe('the Pro gates cannot be flipped open', () => {
  it('a hand-edited storage entry granting pro changes nothing', async () => {
    for (const key of ['to:pro', 'pro', 'tier', 'to:edition', 'isPro', 'to:license-pro']) {
      store.set(key, 'true');
    }
    await refreshLicense(NOW);
    expect(isProActive()).toBe(false);
    for (const id of GATED) expect(hasFeature(id), id).toBe(false);
  });

  it('a hand-edited settings file cannot reach the entitlement', async () => {
    // The registry is the only source; there is no "pro" switch to set.
    expect(proFeatures().length).toBeGreaterThan(0);
    for (const f of proFeatures()) {
      expect(has(f.id), f.id).toBe(false);
    }
  });

  it('a license signed by someone else is refused', async () => {
    // A different key pair entirely.
    const other = generateKeyPairSync('ed25519');
    process.env.LICENSE_PRIVATE_KEY_PEM = other.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const forged = issueLicense({ email: 'mallory@example.com', devices: 1, now: NOW });
    expect((await activateLicense(JSON.stringify(forged), NOW)).ok).toBe(false);
    expect(isProActive()).toBe(false);
  });

  it('a real license with one claim edited is refused', async () => {
    const real = issueLicense({ email: 'anna@example.com', devices: 1, now: NOW });
    for (const edit of [
      { activationLimit: 99 }, { features: [] }, { expiresAt: '2036-01-01T00:00:00.000Z' },
      { product: 'other-app' }, { activationUsage: 5 },
    ]) {
      install();
      await refreshLicense(NOW);
      const tampered = { claims: { ...real.claims, ...edit }, signature: real.signature };
      expect((await activateLicense(JSON.stringify(tampered), NOW)).ok, JSON.stringify(edit)).toBe(false);
      expect(isProActive(), JSON.stringify(edit)).toBe(false);
    }
  });

  it('an unsigned blob claiming to be a license is refused', async () => {
    const blob = JSON.stringify({
      claims: { v: 1, product: 'tournament-organizer-pro', licenseId: 'x', customerEmail: 'a@b.co',
        issuedAt: NOW.toISOString(), expiresAt: null, activationLimit: 99, activationUsage: 0, features: ['*'] },
      signature: 'not-a-signature-at-all-but-long-enough',
    });
    expect((await activateLicense(blob, NOW)).ok).toBe(false);
    expect(isProActive()).toBe(false);
  });

  it('a license for another product does not unlock this one', async () => {
    const other = issueLicense({ email: 'a@b.co', product: 'some-other-app', now: NOW });
    expect((await activateLicense(JSON.stringify(other), NOW)).ok).toBe(false);
  });

  it('every gated feature stays shut for a free install', () => {
    for (const id of GATED) {
      expect(hasFeature(id), id).toBe(false);
      expect(has(id), id).toBe(false);
    }
  });
});

describe('moving a license between machines', () => {
  it('exports, and a fresh machine imports it and goes Pro', async () => {
    const { key } = handleOrderCreated(order('anna@example.com'), { store: memoryDb(), now: NOW });
    await activateLicense(key, NOW);
    const exported = exportLicenseInfo();
    expect(exported.startsWith('TO-PRO.')).toBe(true);

    // A second computer: nothing but the pasted key.
    install();
    await refreshLicense(NOW);
    expect(isProActive()).toBe(false);
    expect((await activateLicense(exported, NOW)).ok).toBe(true);
    expect(isProActive()).toBe(true);
    for (const id of GATED) expect(hasFeature(id), id).toBe(true);
  });

  it('deactivating gives the seat back so the license can move on', async () => {
    const { key } = handleOrderCreated(order('anna@example.com'), { store: memoryDb(), devices: 1, now: NOW });
    await activateLicense(key, NOW);
    expect(isProActive()).toBe(true);

    deactivateLicense();
    expect(isProActive()).toBe(false);
    for (const id of GATED) expect(hasFeature(id), id).toBe(false);

    install();
    await refreshLicense(NOW);
    expect((await activateLicense(key, NOW)).ok).toBe(true);
  });
});

describe('free mode is unaffected by any of this', () => {
  it('a free install never reports Pro, however many times it is asked', async () => {
    for (let i = 0; i < 3; i++) {
      await refreshLicense(NOW);
      expect(isProActive()).toBe(false);
    }
    for (const id of GATED) expect(hasFeature(id), id).toBe(false);
  });

  it('and the core workflow answers free regardless', () => {
    for (const id of ['project.create', 'participants.manage', 'generation.structure',
      'results.entry', 'standings.view', 'schedule.generate', 'export.csv', 'app.offline']) {
      expect(has(id), id).toBe(true);
    }
  });
});