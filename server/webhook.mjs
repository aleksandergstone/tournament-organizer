// Webhook handling — pure logic, no sockets, no framework. This file is what the
// tests import; server/index.mjs is only the HTTP layer on top.
//
// Security posture, stated plainly:
//   * The private signing key is read from the environment per call and never
//     persisted. If it is missing, issuance throws — this service fails closed
//     rather than signing with a fallback key.
//   * The webhook verifies an HMAC over the RAW body. A parsed-and-reserialised
//     body will not match, so the raw buffer is what gets signed and checked.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { formatKey, issueLicense } from './license-signing.mjs';

/** Constant-time compare. Returns false on a length mismatch without throwing. */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Verify the provider's webhook signature.
 *
 * Lemon Squeezy signs the raw request body with HMAC-SHA256 using the store's
 * signing secret and sends the hex digest in `X-Signature`. There is no
 * timestamp in that scheme, so replay protection is NOT done here — it is done
 * by order id in claimOrder(): a replayed order is recognised and answered 200
 * without minting a second license.
 *
 * NOTE: written against documented behaviour, not a live integration. Confirm
 * the header name and digest encoding against your store's settings before
 * taking real money — see docs/purchase-journey.md, "Before you take money".
 */
export function verifyWebhookSignature(rawBody, headerValue, secret) {
  if (!secret) return { ok: false, reason: 'no-secret-configured' };
  if (!headerValue) return { ok: false, reason: 'missing-signature' };
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(headerValue, expected)
    ? { ok: true }
    : { ok: false, reason: 'bad-signature' };
}

/**
 * Issue a license for one paid order, exactly once.
 *
 * Idempotency lives here rather than in the signature layer: the provider
 * retries failed webhooks, and a retry must never mint a second key.
 */
export function handleOrderCreated(payload, { store, deliver, devices = 1, now = new Date() } = {}) {
  if (!store) throw new Error('handleOrderCreated needs a store');
  const attrs = payload?.data?.attributes ?? {};
  const email = attrs.user_email;
  const orderId = String(attrs.identifier ?? payload?.meta?.order_id ?? '');

  if (!email) return { status: 'ignored', reason: 'no-email' };

  const existing = store.getLicense(email);
  if (existing) {
    // Already sold to this person — answer with the key they already have
    // rather than issuing a second entitlement.
    return { status: 'duplicate', orderId, email, key: formatKey(existing.envelope) };
  }
  if (!orderId || !store.claimOrder(orderId, email)) {
    return { status: 'ignored', reason: 'order-already-seen' };
  }

  const envelope = issueLicense({ email, name: attrs.user_name ?? '', devices, now });
  const record = {
    email: String(email).toLowerCase(),
    envelope,
    orderId,
    issuedAt: now.toISOString(),
    devices: envelope.claims.activationLimit,
    activatedBy: [],
  };
  store.putLicense(record);

  // Delivery is best-effort and separate from issuance: if the receipt fails the
  // key is still stored, and /licenses/resend delivers it later.
  const delivered = deliver ? deliver(record, 'purchase') : false;
  return { status: 'issued', orderId, email, key: formatKey(envelope), delivered };
}