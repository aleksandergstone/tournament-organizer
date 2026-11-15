const fs = require('fs');

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

const enPath = 'src/i18n/en.ts';
let enContent = fs.readFileSync(enPath, 'utf8');
const enKV = getKeyValues(enContent);
console.log('en.ts keys:', enKV.size);

// Step 1: Add keys from pl/de/es that are missing from en.ts
const langs = ['pl', 'de', 'es'];
const langKVs = {};
for (const lang of langs) {
  langKVs[lang] = getKeyValues(fs.readFileSync(`src/i18n/${lang}.ts`, 'utf8'));
  console.log(`${lang}.ts keys:`, langKVs[lang].size);
}

// Find keys in any lang file missing from en.ts
const missingFromEn = new Set();
for (const lang of langs) {
  for (const k of langKVs[lang].keys()) {
    if (!enKV.has(k)) missingFromEn.add(k);
  }
}
console.log('Keys in langs missing from en.ts:', missingFromEn.size);

if (missingFromEn.size > 0) {
  const closeIdx = enContent.lastIndexOf('} as const;');
  const newEntries = [...missingFromEn].map(k => `  '${k}': '${k}',`).join('\n');
  enContent = enContent.substring(0, closeIdx) + '\n' + newEntries + '\n' + enContent.substring(closeIdx);
  fs.writeFileSync(enPath, enContent, 'utf8');
  console.log(`Added ${missingFromEn.size} keys to en.ts`);
}

// Re-read en.ts
const enKV2 = getKeyValues(fs.readFileSync(enPath, 'utf8'));
console.log('en.ts keys after sync:', enKV2.size);

// Step 2: Add keys from en.ts that are missing from each lang file
for (const lang of langs) {
  const langPath = `src/i18n/${lang}.ts`;
  let content = fs.readFileSync(langPath, 'utf8');
  const langKeys = getAllKeys(content);
  
  const missing = [...enKV2.keys()].filter(k => !langKeys.has(k));
  console.log(`${lang}.ts: missing ${missing.length} keys from en.ts`);
  
  if (missing.length > 0) {
    const closeIdx = content.lastIndexOf('};');
    const newEntries = missing.map(k => `  '${k}': '${enKV2.get(k)}',`).join('\n');
    content = content.substring(0, closeIdx) + '\n' + newEntries + '\n' + content.substring(closeIdx);
    fs.writeFileSync(langPath, content, 'utf8');
    console.log(`  Added ${missing.length} keys to ${lang}.ts`);
  }
}

console.log('Done');
