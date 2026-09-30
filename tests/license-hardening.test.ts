// The hardening tests: what a malformed license must NOT be able to do.
//
// The theme throughout is failing closed. A license that is wrong in any way
// must be refused, because the worst outcome here is a malformed claim that
// slips past an arithmetic comparison and reads as "allowed".
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LICENSE_PRODUCT, REVALIDATE_INTERVAL_MS, activateLicense, canonicalize, hasFeature,
  isProActive, refreshLicense, revalidate, setLicenseStore, setLicensePublicKey,
  setRevalidator, verifyLicense,
  type LicenseClaims, type LicenseEnvelope,
} from '../src/engine/license';

const NOW = new Date('2026-02-01T00:00:00.000Z');
const enc = new TextEncoder();
const b64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let kp: { publicB64: string; privateKey: CryptoKey };

async function keyPair() {
  const k = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', k.publicKey));
  return { publicB64: b64(raw), privateKey: k.privateKey };
}

/** A real, valid license — the baseline every mutation is compared against. */
async function good(): Promise<LicenseEnvelope> {
  const c: LicenseClaims = {
    v: 1, product: LICENSE_PRODUCT, licenseId: 'lic-h', customerEmail: 'a@b.co',
    issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null, activationLimit: 1,
    activationUsage: 0, features: ['*'], revoked: false,
  };
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, enc.encode(canonicalize(c)));
  return { claims: c, signature: b64(new Uint8Array(sig)) };
}

/** Valid signature, but the claims are nonsense. This is the dangerous class. */
async function signed(over: Partial<LicenseClaims>): Promise<LicenseEnvelope> {
  const c = { ...(await good()).claims, ...over } as LicenseClaims;
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, enc.encode(canonicalize(c)));
  return { claims: c, signature: b64(new Uint8Array(sig)) };
}

/** A store with a fresh install, so nothing leaks between cases. */
function fresh() {
  const map = new Map<string, string>();
  setLicenseStore({
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: k => { map.delete(k); },
  });
  return map;
}

beforeEach(async () => {
  kp = await keyPair();
  // These cases sign with a throwaway key, so the module must verify against
  // that key rather than the embedded one. The production build refuses this.
  setLicensePublicKey(kp.publicB64);
  fresh();
  await refreshLicense(NOW);
});
afterEach(() => { setRevalidator(null); setLicensePublicKey(null); });

describe('a valid license is accepted', () => {
  it('verifies and unlocks', async () => {
    const env = await good();
    expect((await verifyLicense(env, kp.publicB64, NOW)).ok).toBe(true);
    expect((await activateLicense(JSON.stringify(env), NOW)).ok).toBe(true);
    expect(isProActive()).toBe(true);
  });
});

describe('claims of the wrong type are refused, not coerced', () => {
  const rejects: [string, Partial<LicenseClaims>][] = [
    ['a negative device limit', { activationLimit: -1 }],
    ['a fractional device limit', { activationLimit: 1.5 }],
    ['a NaN device limit', { activationLimit: Number.NaN as never }],
    ['a device limit that is a string', { activationLimit: '999' as never }],
    ['negative activation usage', { activationUsage: -5 }],
    ['fractional activation usage', { activationUsage: 0.5 }],
    ['missing activation usage', { activationUsage: undefined as never }],
    ['an empty feature list', { features: [] }],
    ['a feature that is not a string', { features: [42 as never] }],
    ['an empty feature name', { features: [''] }],
    ['a missing license id', { licenseId: '' }],
    ['an email without an @', { customerEmail: 'not-an-email' }],
    ['a non-string email', { customerEmail: 7 as never }],
    ['an unparseable issue date', { issuedAt: 'yesterday' }],
    ['an unparseable expiry', { expiresAt: 'soon' }],
    ['a revoked flag that is a string', { revoked: 'yes' as never }],
    ['a wrong claims version', { v: 99 as never }],
    ['an absurdly long license id', { licenseId: 'x'.repeat(500) }],
    ['too many features', { features: Array.from({ length: 200 }, (_, i) => `f${i}`) }],
  ];

  for (const [label, over] of rejects) {
    it(`refuses ${label}`, async () => {
      const v = await verifyLicense(await signed(over), kp.publicB64, NOW);
      expect(v.ok, `${label} was accepted`).toBe(false);
      expect(!v.ok && v.reason).toBe('malformed');
    });
  }

  it('refuses an envelope with no plausible signature at all', async () => {
    for (const sig of ['', 'short', 'x'.repeat(500), 42 as never]) {
      const v = await verifyLicense({ claims: (await good()).claims, signature: sig } as never, kp.publicB64, NOW);
      expect(v.ok, JSON.stringify(sig)).toBe(false);
    }
  });

  it('never treats a malformed license as Pro', async () => {
    await activateLicense(JSON.stringify(await signed({ activationLimit: -1 })), NOW);
    expect(isProActive()).toBe(false);
    expect(hasFeature('display.kiosk')).toBe(false);
  });
});

describe('a device limit of zero means no activations, not unlimited', () => {
  it('refuses the first machine', async () => {
    const env = await signed({ activationLimit: 0 });
    expect((await activateLicense(JSON.stringify(env), NOW)).ok).toBe(false);
    expect(isProActive()).toBe(false);
  });
});

describe('the revalidation policy', () => {
  it('verifies the signature first, even when the server is friendly', async () => {
    const base = await good();
    await activateLicense(JSON.stringify(base), NOW);

    // The stored envelope is then edited: more features, old signature.
    const map = fresh();
    map.set('to:license', JSON.stringify({ claims: { ...base.claims, features: ['*', 'extra'] }, signature: base.signature }));

    let called = false;
    setRevalidator(async () => { called = true; return true; });
    await revalidate(NOW);
    // A server saying "yes" must never rescue a signature that does not verify.
    expect(called).toBe(false);
    expect(isProActive()).toBe(false);
  });

  it('asks again only after the interval has passed', async () => {
    await activateLicense(JSON.stringify(await good()), NOW);
    let calls = 0;
    setRevalidator(async () => { calls++; return true; });

    await revalidate(NOW);
    expect(calls).toBe(1);
    await revalidate(new Date(NOW.getTime() + 1000));          // too soon
    expect(calls).toBe(1);
    await revalidate(new Date(NOW.getTime() + REVALIDATE_INTERVAL_MS + 1000));
    expect(calls).toBe(2);
  });

  it('honours a revocation immediately', async () => {
    await activateLicense(JSON.stringify(await good()), NOW);
    setRevalidator(async () => false);
    expect((await revalidate(NOW)).reason).toBe('revoked');
    expect(isProActive()).toBe(false);
  });

  it('never revokes because the server is unreachable', async () => {
    await activateLicense(JSON.stringify(await good()), NOW);
    setRevalidator(async () => { throw new Error('ENOTFOUND'); });
    expect((await revalidate(NOW)).status).toBe('pro');
    expect(isProActive()).toBe(true);
  });

  it('needs no server at all to keep working', async () => {
    await activateLicense(JSON.stringify(await good()), NOW);
    setRevalidator(null);
    expect((await revalidate(NOW)).status).toBe('pro');
  });
});