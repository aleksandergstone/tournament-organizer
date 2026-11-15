const fs = require('fs');

// Keys missing from en.ts that are used in .tsx files
const enMissing = {
  // sync section
  'sync.merged': 'Merged from {from}: {note}',
  'sync.nothingNew': 'Nothing new from {from}',
  'sync.errStart': 'Could not start sharing.',
  'sync.stopped': 'Sharing stopped.',
  'sync.errReceive': 'Could not receive data.',
  'sync.sent': 'Project sent to {to}',
  'sync.errSend': 'Could not send data.',
  // support section
  'support.dismiss': 'Dismiss',
  'support.optional': 'Voluntary only',
  'support.showAgain': 'Show the support note again',
  // standings section
  'st.colLost': 'Lost',
  'st.colPlaying': 'Playing',
};

const enPath = 'src/i18n/en.ts';
let c = fs.readFileSync(enPath, 'utf8');

// Add missing keys before the closing '};'
const closeIdx = c.lastIndexOf('\n};\n');
if (closeIdx === -1) {
  console.error('Could not find closing in en.ts');
  process.exit(1);
}

const newEntries = Object.entries(enMissing)
  .map(([k, v]) => `  '${k}': '${v}',`)
  .join('\n');

c = c.substring(0, closeIdx) + '\n' + newEntries + '\n' + c.substring(closeIdx);
fs.writeFileSync(enPath, c, 'utf8');
console.log('Added', Object.keys(enMissing).length, 'keys to en.ts');

// Now sync all missing keys to pl.ts, de.ts, es.ts
function parseKeys(content) {
  const lines = content.split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^'([^']+)'\s*:\s*(['"])/);
    if (m) map.set(m[1], true);
  }
  return map;
}

function parseKeyValues(content) {
  const lines = content.split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^'([^']+)'\s*:\s*'((?:[^'\\]|\\.)*)'/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

const enKV = parseKeyValues(fs.readFileSync(enPath, 'utf8'));

for (const lang of ['pl', 'de', 'es']) {
  const langPath = `src/i18n/${lang}.ts`;
  let langC = fs.readFileSync(langPath, 'utf8');
  const langKeys = parseKeys(langC);
  
  const missing = [...enKV.keys()].filter(k => !langKeys.has(k));
  if (missing.length === 0) {
    console.log(`${lang}.ts: no missing keys`);
    continue;
  }
  
  const closeIdx = langC.lastIndexOf('\n};\n');
  if (closeIdx === -1) {
    console.error(`Could not find closing in ${langPath}`);
    continue;
  }
  
  const newEntries = missing
    .map(k => `  '${k}': '${enKV.get(k)}',`)
    .join('\n');
  
  langC = langC.substring(0, closeIdx) + '\n' + newEntries + '\n' + langC.substring(closeIdx);
  fs.writeFileSync(langPath, langC, 'utf8');
  console.log(`Added ${missing.length} missing keys to ${lang}.ts`);
}

console.log('Done');
