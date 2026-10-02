// Verifies that scripts/check-version.mjs actually fails on drift. A guard that
// cannot fail is worthless, so each mutation below is applied to a throwaway copy
// of the tree and the real project files are never touched.
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(root, '.cache', 'version-check-selftest');
const FILES = ['package.json', 'CHANGELOG.md', 'vite.config.ts', 'android/app/build.gradle'];

const reset = () => {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
  mkdirSync(path.join(tmp, 'android', 'app'), { recursive: true });
  for (const f of FILES) cpSync(path.join(root, f), path.join(tmp, f));
  cpSync(path.join(root, 'scripts/check-version.mjs'), path.join(tmp, 'scripts/check-version.mjs'));
};

const patch = (file, from, to) => {
  const p = path.join(tmp, file);
  const before = readFileSync(p, 'utf8');
  if (!before.includes(from)) throw new Error(`self-test mutation did not apply to ${file}`);
  writeFileSync(p, before.replace(from, to));
};

const setPkgVersion = (v) => {
  const p = path.join(tmp, 'package.json');
  const j = JSON.parse(readFileSync(p, 'utf8'));
  j.version = v;
  writeFileSync(p, JSON.stringify(j, null, 2));
};

const run = () => {
  try {
    return { code: 0, out: execFileSync('node', [path.join(tmp, 'scripts/check-version.mjs')], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};

const CASES = [
  ['baseline, everything in step', () => {}, 0],
  ['leading zero in a version part (1.4.02)', () => setPkgVersion('1.4.02'), 1],
  // The heading to mutate is whichever one is on top right now. Hardcoding a
  // version here meant the mutation silently stopped landing once the next
  // release was added, and this case passed for the wrong reason — the check it
  // guards was never actually exercised.
  ['changelog ahead of package.json', () => {
    const p = path.join(tmp, 'CHANGELOG.md');
    const before = readFileSync(p, 'utf8');
    const top = (before.match(/^## \[([^\]]+)\]/m) ?? [])[1];
    if (!top) throw new Error('CHANGELOG.md has no "## [x.y.z]" entry to mutate');
    writeFileSync(p, before.replace(`## [${top}]`, '## [9.9.9]'));
  }, 1],
  ['android versionCode hardcoded again', () => patch('android/app/build.gradle',
    'versionCode pkgVersionParts[0] * 10000', 'versionCode 1'), 1],
  ['android versionName back to a literal', () => patch('android/app/build.gradle',
    'versionName "${pkgVersionParts[0]}.${pkgVersionParts[1]}.${pkgVersionParts[2]}"', 'versionName "1.4.2"'), 1],
  ['artifact name loses the version', () => {
    const p = path.join(tmp, 'package.json');
    const j = JSON.parse(readFileSync(p, 'utf8'));
    j.build.artifactName = 'Tournament-Organizer.${ext}';
    writeFileSync(p, JSON.stringify(j, null, 2));
  }, 1],
];

let failures = 0;
for (const [name, mutate, expected] of CASES) {
  reset();
  mutate();
  const { code, out } = run();
  const ok = code === expected;
  if (!ok) failures++;
  const firstError = (out.match(/✖.*/) ?? [''])[0];
  console.log(`${ok ? '✔' : '✖'} ${name} — exit ${code}${firstError ? ` (${firstError.trim()})` : ''}`);
}

rmSync(tmp, { recursive: true, force: true });
if (failures) {
  console.error(`${failures} self-test case(s) behaved unexpectedly`);
  process.exit(1);
}
console.log(`✔ all ${CASES.length} self-test cases behaved as expected`);