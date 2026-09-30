// End-to-end check with the REAL key pair: scripts/sign-license.mjs issues a
// license using keys/license-private.json, and the app verifies it with the
// public key that is compiled into the bundle. This is the one test that proves
// the issuer and the app agree — if the canonical form ever drifts, it fails here.
//
// It needs keys/license-private.json on the machine running it, so it is not part
// of the normal suite; run it deliberately after issuing a license:
//   node scripts/sign-license.mjs --email anna@example.com > e2e-out.txt
//   node node_modules/vitest/vitest.mjs run tests/license-e2e.check.ts
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

  it('carries a perpetual, device-limited, all-features entitlement', () => {
    expect(env!.claims.product).toBe('tournament-organizer-pro');
    expect(env!.claims.expiresAt).toBeNull();          // never expires
    expect(env!.claims.activationLimit).toBe(1);
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

  it('is refused the moment one claim is changed', async () => {
    const forged = { ...env!, claims: { ...env!.claims, activationLimit: 99 } };
    expect((await verifyLicense(forged, LICENSE_PUBLIC_KEY_B64)).ok).toBe(false);
  });
});