// Builds the demo project fixture (scripts/demo-fixture.ts) with esbuild and
// writes it to .cache/demo-projects.json in the localStorage shape the app uses:
//   { "<projectId>": ProjectFile, ... }
//
// Run: node scripts/make-demo-project.mjs   (or `npm run screenshots`)
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, '.cache');
mkdirSync(cache, { recursive: true });

const bundle = path.join(cache, 'demo-fixture.mjs');
await build({
  entryPoints: [path.join(root, 'scripts', 'demo-fixture.ts')],
  outfile: bundle,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  logLevel: 'error',
});

const stdout = execFileSync(process.execPath, [bundle], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const data = JSON.parse(stdout);
const out = path.join(cache, 'demo-projects.json');
writeFileSync(out, JSON.stringify(data.projects), 'utf8');

const summary = Object.values(data.projects).map(p => ({
  name: p.tournament.name,
  format: p.tournament.format,
  participants: p.participants.length,
  matches: p.matches.length,
  played: p.matches.filter(m => ['played', 'draw', 'walkover', 'overtime'].includes(m.result.status)).length,
}));
console.log(`✔ demo fixture written to ${path.relative(root, out)}`);
for (const s of summary) console.log(`  - ${s.name} (${s.format}): ${s.participants} participants, ${s.played}/${s.matches} matches played`);
