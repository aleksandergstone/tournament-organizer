// What an attacker actually has to beat, and what they cannot get past.
//
// Written so that a reader can tell the difference between what this design
// actually protects and what it merely makes inconvenient. Overclaiming here
// would be worse than the vulnerabilities themselves.

## What an attacker has

| They can do | They cannot do |
|---|---|
| Edit any file on their own disk, including localStorage | Read the signing private key — it is not in the client |
| Run arbitrary JavaScript in the renderer they installed | Forge a signature without that key |
| Patch the app bundle and run their own build | Make a patched build verify a signature it never made |
| Delete the local activation ledger | Extend a license's expiry, device limit or feature list |
| Install an older build of the app | Be trusted by an offline install without a valid signed envelope |

## The trust chain

```
payment ──► server (private key, never leaves it)
              │
              ▼
        signed claims  ──► e-mail / support resend
              │
              ▼
        local cache ──► verify on startup against the embedded PUBLIC key
              │
              ▼
        hasFeature() ──► ProGate renders children, or an explanation
```

One rule holds the whole thing together: **the only thing that grants access is
a set of bytes that verify against a key the client does not hold.** There is no
boolean to flip, no config file that means "pro", and no UI state that a
component can set for itself.

## What is actually protected

**Forgery.** A hand-written license, an edited claim, an extended expiry or a
raised device limit all fail signature verification. Covered by tests.

**Confusion between products.** The claims carry `product`, checked before the
signature: a license for another application is rejected with `wrong-product`.

**Silent corruption.** Claims are range-checked before verification. A string
where a count belongs would otherwise produce `NaN >= NaN` — which is *false* —
and read as "limit not reached". Failing open on a malformed license is the one
outcome this design must never produce, so every field is type-checked and a bad
one refuses.

**Accidental privilege.** Unknown feature ids and `planned` features are denied
to everyone, including a preview context and including a Pro license.

## What is only made inconvenient

**Patching the binary.** Anyone can edit the bundle and delete a check. Signing
does nothing about this; it means the check they delete was the only thing
standing there. The cost is that the patch no longer verifies *any* license,
which breaks support, updates and revalidation for them.

**The activation ledger.** Device counts live in local storage and can be deleted.
`activationUsage` inside the signed payload is the issuer's baseline, not a live
counter — it cannot be, because the app cannot increment a signed value without
invalidating it. This stops casual sharing, not a determined cracker.

**Rollback to an old build.** An attacker can install a build from before the
Pro boundary moved and get the old free features forever. No client-side scheme
can prevent this; only refusing to run old builds can, and that costs users their
data.

**Reading the license off disk.** The cached envelope is readable by anything with
filesystem access. It is a signature, not a secret, so this leaks an entitlement
that is already bound to a device count — but on a stolen machine it is a
head start.

## Explicitly not relied on

- **Obfuscation or minification.** Nothing here depends on the code being hard
  to read. A readable bundle that verifies signatures is safer than an unreadable
  one that does not.
- **A hidden secret.** The client has no secret. There is nothing to find.
- **UI state.** Components read `has()`, which reads the verified module state.
  The License screen cannot show Pro unless the signature verified.

## Revocation

Present, with a stated policy rather than a promise:

1. The signature is checked on every start, offline included.
2. If a server is configured and six hours have passed, the app asks.
3. **A network failure never revokes.** Offline-first is the product's promise;
   a train tunnel must not take someone's license away.
4. A server saying "revoked" is honoured immediately.

Until a server is deployed, step 2 simply never runs — no timer spins to discover
there is nothing to talk to.