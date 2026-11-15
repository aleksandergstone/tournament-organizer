const fs = require('fs');

function parseKeys(content) {
  const lines = content.split(/\r?\n/);
  const keys = new Set();
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^'([^']+)'\s*:/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

const enKV = parseKeys(fs.readFileSync('src/i18n/en.ts', 'utf8'));
console.log('en.ts keys:', enKV.size);

const allMissing = new Set();
for (const lang of ['pl', 'de', 'es']) {
  const langKeys = parseKeys(fs.readFileSync(`src/i18n/${lang}.ts`, 'utf8'));
  for (const k of langKeys) {
    if (!enKV.has(k)) allMissing.add(k);
  }
}

console.log('Total missing keys:', allMissing.size);

if (allMissing.size > 0) {
  const enContent = fs.readFileSync('src/i18n/en.ts', 'utf8');
  const closeIdx = enContent.lastIndexOf('} as const;');
  const newEntries = [...allMissing]
    .map(k => `  '${k}': '${k}',`)
    .join('\n');
  const newContent = enContent.substring(0, closeIdx) + '\n' + newEntries + '\n' + enContent.substring(closeIdx);
  fs.writeFileSync('src/i18n/en.ts', newContent, 'utf8');
  console.log('Added', allMissing.size, 'keys to en.ts (with key name as value)');
} else {
  console.log('No missing keys!');
}
