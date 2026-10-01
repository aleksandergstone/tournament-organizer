#!/usr/bin/env node
// Version consistency guard — run by `npm run version:check` and in CI.
//
// The version has exactly one source of truth (package.json). This script fails
// loudly when anything drifts, so the app UI, the changelog and the produced
// artifacts can never disagree.
//
// Checks:
//   1. package.json version is valid semver
//   2. CHANGELOG.md's top entry matches that version
//   3. vite.config.ts injects __APP_VERSION__ from package.json (app display)
//   4. build.artifactName embeds ${version} (release file naming)
//   5. android/app/build.gradle carries the same versionName (the phone build)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The check can be pointed at a different tree so its own behaviour can be
// verified without editing the real project: `node scripts/check-version.mjs /tmp/x`.
const root = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const errors = [];
const fail = (m) => errors.push(m);

const pkg = JSON.parse(read('package.json'));
const version = pkg.version;

// Semver forbids leading zeros in the numeric parts. "1.4.01" passes a naive
// x.y.z pattern but is not a valid semver, and tooling that parses the version
// (electron-builder, the Android plugin, npm) coerces it to "1.4.1" while the
// app UI would still print the raw "1.4.01" — the exact drift this guard exists
// to prevent. Reject it here, at the source, instead of downstream.
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`package.json version "${version}" is not semver (x.y.z, no leading zeros)`);
}

let changelog = '';
try {
  changelog = read('CHANGELOG.md');
} catch {
  fail('CHANGELOG.md is missing');
}
if (changelog) {
  const top = changelog.match(/^## \[([^\]]+)\]/m);
  if (!top) fail('CHANGELOG.md has no "## [x.y.z]" entry');
  else if (top[1] !== version) {
    fail(`CHANGELOG.md top entry is ${top[1]} but package.json is ${version} — add the release entry`);
  }
}

const vite = read('vite.config.ts');
if (!/__APP_VERSION__[\s\S]{0,120}pkg\.version/.test(vite)) {
  fail('vite.config.ts must define __APP_VERSION__ from pkg.version (app version display)');
}

const artifactName = pkg.build?.artifactName ?? '';
if (!artifactName.includes('${version}')) {
  fail('build.artifactName must include ${version} so release files carry the version');
}

// The Android build is the same app, so it carries the same version. It must
// derive it from package.json rather than repeat the literal: a second copy is
// a second thing to forget, and it is exactly how 1.4.01 and 1.4.1 drifted.
// versionCode is derived for the same reason, plus Android rejects an update
// whose versionCode does not strictly increase.
let gradle = '';
try {
  gradle = read('android/app/build.gradle');
} catch {
  gradle = '';
}
if (gradle) {
  if (!/rootProject\.file\("\.\.\/package\.json"\)/.test(gradle)) {
    fail('android/app/build.gradle must read the version from ../package.json, not a repeated literal');
  }
  if (!/versionName\s+"\$\{pkgVersionParts/.test(gradle)) {
    fail('android/app/build.gradle versionName must be derived from pkgVersionParts');
  }
  if (!/versionCode\s+pkgVersionParts\[0\]\s*\*\s*10000/.test(gradle)) {
    fail('android/app/build.gradle versionCode must be derived from the version, not hardcoded');
  }
  if (/versionCode\s+\d+\s*$|versionName\s+"\d/.test(gradle)) {
    fail('android/app/build.gradle still contains a hardcoded version literal');
  }
}

if (errors.length) {
  console.error('Version check failed:');
  for (const e of errors) console.error('  ✖ ' + e);
  process.exit(1);
}
console.log(`✔ version ${version} is consistent (package.json = CHANGELOG = app build = artifact names${gradle ? ' = android' : ''})`);
