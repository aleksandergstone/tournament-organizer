// Issue one perpetual Pro license. Run this on the machine that holds
// keys/license-private.json — never on a customer's computer, never in CI.
//
//   node scripts/sign-license.mjs --email anna@example.com [--name "Anna K"]
//                                 [--devices 1] [--features '*']
//                                 [--out license.txt]
//
// What it prints is exactly what the customer pastes into the License screen,
// and exactly what a receipt email should carry. It also prints a JSON envelope,
// which is what a payment webhook handler would store.
import { createPrivateKey, sign as signBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privPath = path.join(root, 'keys', 'license-private.json');
if (!existsSync(privPath)) {
  console.error('No signing key. Run: node scripts/generate-license-key.mjs');
  process.exit(1);
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? fallback : process.argv[i + 1];
};

const email = arg('email');
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/sign-license.mjs --email you@example.com [--name "Anna"] [--devices 1] [--features "*"]');
  process.exit(1);
}
const devices = Number(arg('devices', '1'));
const features = String(arg('features', '*')).split(',').map(s => s.trim()).filter(Boolean);

const claims = {
  v: 1,
  product: 'tournament-organizer-pro',
  licenseId: randomUUID(),
  customerEmail: email,
  customerName: arg('name', ''),
  issuedAt: new Date().toISOString(),
  expiresAt: null,               // perpetual: never expires
  activationLimit: Number.isFinite(devices) ? devices : null,
  features,
  revoked: false,
  issuedBy: 'sign-license.mjs',
};

// Must match canonicalize() in src/engine/license.ts, byte for byte.
const canonical = JSON.stringify({
  v: claims.v,
  product: claims.product,
  licenseId: claims.licenseId,
  customerEmail: claims.customerEmail,
  customerName: claims.customerName ?? '',
  issuedAt: claims.issuedAt,
  expiresAt: claims.expiresAt,
  activationLimit: claims.activationLimit,
  features: [...claims.features].sort(),
  revoked: claims.revoked === true,
  issuedBy: claims.issuedBy ?? '',
});

const signature = signBytes(null, Buffer.from(canonical, 'utf8'), createPrivateKey(readFileSync(privPath, 'utf8')))
  .toString('base64url');

const envelope = { claims, signature };
const key = `TO-PRO.${Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')}.${signature}`;

const out = arg('out', null);
if (out) writeFileSync(out, key + '\n', 'utf8');

console.log('License key (give this to the customer):\n');
console.log(key);
console.log('\nJSON envelope (what a webhook handler stores):\n');
console.log(JSON.stringify(envelope, null, 2));
console.log(`\nPerpetual (no expiry), ${devices} device(s), features: ${features.join(', ')}`);