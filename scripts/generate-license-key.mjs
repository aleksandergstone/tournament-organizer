// One-time license key pair generator — run by the person who sells the Pro
// license, ONCE, before shipping. The public half is pasted into
// src/engine/license.ts; the private half never leaves this machine.
//
//   node scripts/generate-license-key.mjs
//
// It refuses to overwrite an existing key unless --force is given, because
// replacing the public key invalidates every license already issued.
import { generateKeyPairSync, createPublicKey, createPrivateKey } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'keys');
const privPath = path.join(dir, 'license-private.json');
const force = process.argv.includes('--force');

if (existsSync(privPath) && !force) {
  const priv = JSON.parse(readFileSync(privPath, 'utf8'));
  const pub = createPublicKey(priv).export({ type: 'spki', format: 'der' });
  // The last 32 bytes of a SPKI Ed25519 DER are the raw public key.
  console.log('A key pair already exists. Public key (raw, base64url):');
  console.log(pub.subarray(pub.length - 32).toString('base64url'));
  console.log('\nNothing was changed. Use --force to replace it (old licenses stop working).');
  process.exit(0);
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const spki = publicKey.export({ type: 'spki', format: 'der' });
const raw = spki.subarray(spki.length - 32).toString('base64url');

mkdirSync(dir, { recursive: true });
writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), {
  encoding: 'utf8', mode: 0o600,
});
writeFileSync(path.join(dir, 'LICENSE-KEY-INFO.txt'),
  `Private key for signing Pro licenses.\n\n`
  + `  file:      keys/license-private.json\n`
  + `  public key: ${raw}\n\n`
  + `Paste the public key into LICENSE_PUBLIC_KEY in src/engine/license.ts.\n`
  + `NEVER commit keys/ and never ship this file. Back it up somewhere safe:\n`
  + `if you lose it you cannot issue new licenses or honour replacements.\n`,
  'utf8');

console.log('Wrote keys/license-private.json (git-ignored).');
console.log('\nPublic key (paste into src/engine/license.ts):\n');
console.log(raw);
