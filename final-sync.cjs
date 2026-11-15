const fs = require('fs');
const { execSync } = require('child_process');

const enPath = 'src/i18n/en.ts';
let enContent = fs.readFileSync(enPath, 'utf8');

for (let round = 0; round < 10; round++) {
  let output;
  try {
    output = execSync('npm run build 2>&1', { cwd: 'C:/Users/Aleksander G/Desktop/tournament-organizer', encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    console.log(`Build succeeded on round ${round}!`);
    process.exit(0);
  } catch (e) {
    output = (e.stdout ? e.stdout.toString() : '') + '\n' + (e.stderr ? e.stderr.toString() : '');
  }

  // Check for syntax errors
  if (output.includes('TS1005') || output.includes('TS1109')) {
    console.log('Syntax error detected - stopping');
    process.exit(1);
  }

  // Extract missing i18n keys
  const keyRe = /Argument of type '("?)([^'"]+)\1' is not assignable/g;
  const missingKeys = new Set();
  let match;
  while ((match = keyRe.exec(output)) !== null) {
    const key = match[2];
    if (/^[a-zA-Z][a-zA-Z0-9._]*$/.test(key)) {
      missingKeys.add(key);
    }
  }

  // Also extract code errors that aren't i18n
  const codeErrors = output.match(/error TS\d+/g) || [];
  const i18nErrors = codeErrors.filter(e => e.includes('TS2345')).length;
  const otherErrors = codeErrors.filter(e => !e.includes('TS2345'));
  
  console.log(`Round ${round}: ${missingKeys.size} missing i18n keys, ${otherErrors.length} other errors`);

  if (missingKeys.size === 0 && otherErrors.length === 0) {
    console.log('Build should pass!');
    break;
  }

  if (missingKeys.size > 0) {
    const closeIdx = enContent.lastIndexOf('} as const;');
    const newEntries = [...missingKeys].map(k => `  '${k}': '${k}',`).join('\n');
    enContent = enContent.substring(0, closeIdx) + '\n' + newEntries + '\n' + enContent.substring(closeIdx);
    fs.writeFileSync(enPath, enContent, 'utf8');
    console.log(`  Added ${missingKeys.size} keys to en.ts`);
  }

  if (otherErrors.length > 0 && missingKeys.size === 0) {
    console.log('Only code errors remain, stopping i18n sync');
    break;
  }
}

// Now sync en.ts keys to pl/de/es
function getAllKeys(content) {
  const lines = content.split(/\r?\n/);
  const keys = new Set();
  for (const line of lines) {
    const m = line.match(/^\s*'([^']+)'\s*:/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

function getKeyValues(content) {
  const lines = content.split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^'([^']+)'\s*:\s*'((?:[^'\\]|\\.)*)'/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

const enKV = getKeyValues(fs.readFileSync(enPath, 'utf8'));
console.log(`\nen.ts final keys: ${enKV.size}`);

for (const lang of ['pl', 'de', 'es']) {
  const langPath = `src/i18n/${lang}.ts`;
  let content = fs.readFileSync(langPath, 'utf8');
  const langKeys = getAllKeys(content);
  
  const missing = [...enKV.keys()].filter(k => !langKeys.has(k));
  console.log(`${lang}.ts: missing ${missing.length} keys`);
  
  if (missing.length > 0) {
    const closeIdx = content.lastIndexOf('};');
    const newEntries = missing.map(k => `  '${k}': '${enKV.get(k)}',`).join('\n');
    content = content.substring(0, closeIdx) + '\n' + newEntries + '\n' + content.substring(closeIdx);
    fs.writeFileSync(langPath, content, 'utf8');
    console.log(`  Added ${missing.length} keys to ${lang}.ts`);
  }
}

console.log('Done');
