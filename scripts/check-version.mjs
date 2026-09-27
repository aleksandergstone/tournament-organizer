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
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const errors = [];
const fail = (m) => errors.push(m);

const pkg = JSON.parse(read('package.json'));
const version = pkg.version;

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`package.json version "${version}" is not semver (x.y.z)`);
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

if (errors.length) {
  console.error('Version check failed:');
  for (const e of errors) console.error('  ✖ ' + e);
  process.exit(1);
}
console.log(`✔ version ${version} is consistent (package.json = CHANGELOG = app build = artifact names)`);
