// End-to-end check with the REAL key pair: scripts/sign-license.mjs issues a
// license using keys/license-private.json, and the app verifies it with the
// public key that is compiled into the bundle. This is the one test that proves
// the issuer and the app agree — if the canonical form ever drifts, it fails here.
//
// It needs keys/license-private.json and the artifact it checks, so it is not
// part of the normal suite. To run it:
//   node scripts/sign-license.mjs --email anna@example.com --name "Anna K" \
//        --devices 3 --used 1 > e2e-out.txt
//   copy tests/license-e2e.check.ts tests/zz-e2e.test.ts   (vitest glob)
//   node node_modules/vitest/vitest.mjs run tests/zz-e2e.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LICENSE_PUBLIC_KEY_B64, formatLicenseKey, parseLicense, verifyLicense } from '../src/engine/license';

const out = readFileSync('e2e-out.txt', 'utf8');
const key = out.split('License key (give this to the customer):')[1].trim().split('\n')[0].trim();
const env = parseLicense(key);

describe('a real issued license verifies against the embedded public key', () => {
  it('is a well-formed one-line key', () => {
    expect(key.startsWith('TO-PRO.')).toBe(true);
    expect(env).not.toBeNull();
  });

  it('carries a perpetual entitlement with the allowance it was issued with', () => {
    expect(env!.claims.product).toBe('tournament-organizer-pro');
    expect(env!.claims.expiresAt).toBeNull();          // never expires
    expect(env!.claims.activationLimit).toBe(3);
    expect(env!.claims.activationUsage).toBe(1);        // one seat already sold
    expect(env!.claims.features).toEqual(['*']);
    expect(env!.claims.customerEmail).toBe('anna@example.com');
    expect(env!.claims.customerName).toBe('Anna K');
    expect(env!.claims.revoked).toBe(false);
  });

  it('passes signature verification against the key shipped in the app', async () => {
    const v = await verifyLicense(env!, LICENSE_PUBLIC_KEY_B64);
    expect(v.ok, JSON.stringify(v)).toBe(true);
  });

  it('round-trips through the paste format unchanged', () => {
    expect(formatLicenseKey(env!)).toBe(key);
  });

  it('is refused the moment any single claim is changed', async () => {
    for (const tamper of [
      { activationLimit: 99 }, { activationUsage: 0 }, { expiresAt: '2030-01-01T00:00:00.000Z' },
    ]) {
      const forged = { ...env!, claims: { ...env!.claims, ...tamper } };
      expect((await verifyLicense(forged, LICENSE_PUBLIC_KEY_B64)).ok, JSON.stringify(tamper)).toBe(false);
    }
  });
});