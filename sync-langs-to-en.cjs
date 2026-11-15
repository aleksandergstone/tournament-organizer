const fs = require('fs');

function parseKeys(content) {
  const lines = content.split(/\r?\n/);
  const map = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^'([^']+)'\s*:\s*'((?:[^'\\]|\\.)*)'/);
    if (m) map.set(m[1], m[2]);
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

const enKV = parseKeyValues(fs.readFileSync('src/i18n/en.ts', 'utf8'));
console.log('en.ts keys:', enKV.size);

for (const lang of ['pl', 'de', 'es']) {
  const langPath = `src/i18n/${lang}.ts`;
  let langContent = fs.readFileSync(langPath, 'utf8');
  const langKeys = parseKeys(langContent);
  
  const missing = [...enKV.keys()].filter(k => !langKeys.has(k));
  console.log(`${lang}.ts: missing ${missing.length} keys from en.ts`);
  
  if (missing.length > 0) {
    const closeIdx = langContent.lastIndexOf('} as const;');
    if (closeIdx === -1) {
      console.error(`  Could not find closing anchor in ${langPath}`);
      continue;
    }
    const newEntries = missing.map(k => `  '${k}': '${enKV.get(k)}',`).join('\n');
    langContent = langContent.substring(0, closeIdx) + '\n' + newEntries + '\n' + langContent.substring(closeIdx);
    fs.writeFileSync(langPath, langContent, 'utf8');
    console.log(`  Added ${missing.length} keys to ${lang}.ts`);
  }
}

console.log('Done');
