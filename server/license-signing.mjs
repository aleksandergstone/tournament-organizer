// License signing — SERVER SIDE ONLY. Never bundle this into the app.
//
// The canonical form below MUST stay byte-identical to canonicalize() in
// src/engine/license.ts. If the two ever differ, every license this server
// issues fails verification in the app and you find out from a paying customer.
// That pairing is enforced by tests/server-licensing.test.ts, which imports the
// real app function and compares — run it after touching either side.
//
// The Ed25519 PRIVATE key is read from the environment at call time and never
// written to disk, logged, or returned by any endpoint.
import { createPrivateKey, createPublicKey, sign as edSign, randomUUID } from 'node:crypto';

export const LICENSE_PRODUCT = 'tournament-organizer-pro';
export const CLAIMS_VERSION = 1;

/**
 * The exact bytes that get signed. Field order is fixed and absent fields are
 * normalised, so the issuer and the app always agree. Keep this and the app's
 * canonicalize() in lockstep — the test compares them.
 */
export function canonicalize(c) {
  return JSON.stringify({
    v: c.v,
    product: c.product,
    licenseId: c.licenseId,
    customerEmail: c.customerEmail,
    customerName: c.customerName ?? '',
    issuedAt: c.issuedAt,
    expiresAt: c.expiresAt,
    activationLimit: c.activationLimit,
    activationUsage: c.activationUsage ?? 0,
    features: [...(c.features ?? [])].sort(),
    revoked: c.revoked === true,
    issuedBy: c.issuedBy ?? '',
  });
}

function privateKey() {
  const pem = process.env.LICENSE_PRIVATE_KEY_PEM;
  if (!pem) {
    throw new Error(
      'LICENSE_PRIVATE_KEY_PEM is not set. Refusing to issue: a license signed ' +
      'with a fallback key would be forgeable.',
    );
  }
  // Accept the PEM with or without its header/footer, since secret managers
  // usually store one long line.
  const normalised = pem.includes('BEGIN') ? pem : pem.replace(/\\n/g, '\n');
  return createPrivateKey(normalised);
}

/** The raw 32-byte public key, base64url — paste this into the app. */
export function publicKeyB64() {
  const der = createPublicKey(privateKey()).export({ type: 'spki', format: 'der' });
  return Buffer.from(der.subarray(der.length - 32)).toString('base64url');
}

/**
 * Issue one perpetual license. Never throws on a missing email: a webhook must
 * always answer 200 or the provider will retry forever — validation is the
 * caller's job and is done before we get here.
 */
export function issueLicense({
  email,
  name = '',
  devices = 1,
  usage = 0,
  features = ['*'],
  product = LICENSE_PRODUCT,
  licenseId = randomUUID(),
  now = new Date(),
} = {}) {
  if (!email || !String(email).includes('@')) throw new Error('issueLicense: a valid email is required');

  const claims = {
    v: CLAIMS_VERSION,
    product,
    licenseId,
    customerEmail: String(email),
    customerName: name ? String(name) : '',
    issuedAt: now.toISOString(),
    // Perpetual. The app treats a non-null expiresAt as a real expiry.
    expiresAt: null,
    activationLimit: Number.isFinite(devices) ? devices : null,
    activationUsage: Number.isFinite(usage) ? usage : 0,
    features: [...features],
    revoked: false,
    issuedBy: 'license-api',
  };

  const signature = edSign(null, Buffer.from(canonicalize(claims), 'utf8'), privateKey())
    .toString('base64url');

  return { claims, signature };
}

/** Re-sign an existing record, e.g. after raising a device allowance. */
export function reissueLicense(previousClaims, changes = {}, now = new Date()) {
  return issueLicense({
    email: previousClaims.customerEmail,
    name: previousClaims.customerName,
    devices: previousClaims.activationLimit,
    usage: previousClaims.activationUsage,
    features: previousClaims.features,
    licenseId: previousClaims.licenseId,     // same license: it keeps its identity
    now,
    ...changes,
  });
}

/** The one-line key the customer pastes or receives by email. */
export function formatKey(env) {
  const b64 = o => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url');
  return `TO-PRO.${b64(env.claims)}.${env.signature}`;
}

export function envelopeText(env) {
  return JSON.stringify(env, null, 2);
}