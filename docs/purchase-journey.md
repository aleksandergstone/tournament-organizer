# The purchase journey

How a customer goes from free to Pro, and what has to be true before the first
payment is accepted.

## The commercial model

| | |
|---|---|
| Type | one-time purchase |
| Price | pay what you want, **minimum €10** |
| Suggested | €10 / €20 / €50 |
| Term | perpetual — `expiresAt: null`, never renews |
| Seats | 1 device by default (`LICENSE_DEFAULT_DEVICES`) |
| Subscription | none |

The minimum is enforced by the **store**, not by the app. `src/checkout.ts`
repeats the number so the screen can show it; the app never decides what
somebody may pay.

## The journey, step by step

1. **Customer clicks “Upgrade to Pro”** — in Settings → Pro license, or the Pro
   section of the website.
2. **The app opens the hosted checkout in the system browser.**
   `src/checkout.ts` holds the URL; `desktop.openExternal` opens it. Nothing is
   embedded in the app, and the app never talks to the store directly.
3. **Checkout accepts any amount from €10.** The store enforces the floor.
4. **Payment succeeds.** The provider emails the receipt.
5. **The provider POSTs a webhook to your service.** HMAC-SHA256 over the raw
   body, hex digest in `X-Signature`.
6. **Your service verifies the signature, issues a signed license**, stores it
   against the customer's email, and emails the key.
7. **The customer pastes the key** into Settings → Pro license, or imports the
   file. The app verifies the signature locally against the embedded public key.
8. **Pro unlocks**, immediately and permanently. No network is needed again.

## Where each piece lives

| Piece | File | Notes |
|---|---|---|
| Checkout URL, amounts, support address | `src/checkout.ts` | the only place to edit |
| Upgrade screen | `src/ui/License.tsx` | status, key entry, import, remove/deactivate |
| License model and verification | `src/engine/license.ts` | client side, public key only |
| Free/Pro boundary | `src/engine/feature-registry.ts` | four classes, one table |
| Signing | `server/license-signing.mjs` | server side, private key |
| Webhook + support routes | `server/index.mjs`, `server/webhook.mjs` | |
| Persistence | `server/store.mjs` | swap for a real database |
| Issue a license by hand | `scripts/sign-license.mjs` | for comps and tests |

## Recovering a lost key

Two paths, on purpose:

- **The customer writes to the address in their receipt.** You call
  `POST /licenses/resend` with `{"email": "..."}` and the stored key goes out
  again. The license is unchanged — same signature, same seats.
- **The customer moves machines.** They use “Deactivate on this device”, which
  releases the seat. “Remove from this computer” does **not** release it — that
  one is for a computer being handed to someone else.

## Supporting yourself

Every route except the webhook needs `LICENSE_STORE_API_KEY` in
`x-api-key`. Without it configured they return 503 rather than run open.

```
POST /licenses/validate   {"envelope": {...}}      → revoked, devices, activations
POST /licenses/deactivate {"email","device"}       → releases one seat
POST /licenses/resend     {"email"}                → re-sends the key
```

## Running the service

```
export LICENSE_PRIVATE_KEY_PEM="$(cat keys/license-private.pem)"   # NEVER in the repo
export LICENSE_WEBHOOK_SECRET=whsec_...
export LICENSE_STORE_API_KEY=$(openssl rand -hex 32)
export LICENSE_DEFAULT_DEVICES=1
node server/index.mjs
```

`GET /health` reports which of the three secrets are present, so a missing one
is obvious before you point a store at it.

## Before you take money

This code has **not** been run against a live provider. Work through this list.

**Blocking — do not skip**

1. **Confirm the webhook signature scheme against your store's own docs.**
   `verifyWebhookSignature` assumes HMAC-SHA256 hex in `X-Signature` over the raw
   body. If the header name, encoding or algorithm differs, every webhook returns
   401 and no customer ever receives a key. Check this first.
2. **Run `npm test`.** `tests/server-licensing.test.ts` signs with a throwaway key
   and verifies in the app. If the server and the app ever disagree about the
   signed bytes, this test fails — but only if you run it.
3. **Paste the public key into the app.** Run
   `node scripts/generate-license-key.mjs` (or point `LICENSE_PUBLIC_KEY_B64` in
   `src/engine/license.ts` at the key whose private half is in
   `LICENSE_PRIVATE_KEY_PEM`). A mismatch means every purchase fails at activation.
4. **Buy from yourself.** Card, then confirm the webhook arrived, the key was
   stored, the email went out, and the key activates the app.
5. **Send the same webhook twice.** You should get the same key back, not a
   second license. This is the retry path every provider will exercise.

**Before real customers**

6. Wire `deliver()` to a real mail transport. Until you do, it logs a warning and
   returns false — the license is stored, so `/licenses/resend` recovers it, but
   nobody gets it automatically.
7. Replace `server/store.mjs` with a real database if you run more than one
   instance. The file adapter is fine for a single process and wrong for two.
8. Put the service behind TLS and rate-limit `/licenses/*` by API key.
9. Put `server/data/` and `keys/` in your deploy ignore and your backups.

**Known limits, stated plainly**

- The device limit is enforced from the customer's own storage plus the signed
  baseline. Someone determined can delete that ledger. Tightening it needs the
  server to count activations — the endpoints exist; nothing calls them from the
  app yet.
- Revocation only reaches an already-activated customer on revalidation, and the
  app does not revalidate on a schedule.
- The file store keeps customer emails and license keys in plaintext on disk.
  Encrypt it or move it to a database with proper access control.
