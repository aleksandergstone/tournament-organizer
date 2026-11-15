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

const enKV = parseKeys(fs.readFileSync('src/i18n/en.ts', 'utf8'));
console.log('en.ts keys:', enKV.size);

for (const lang of ['pl', 'de', 'es']) {
  const langKV = parseKeys(fs.readFileSync(`src/i18n/${lang}.ts`, 'utf8'));
  const missing = [...langKV.keys()].filter(k => !enKV.has(k));
  console.log(`${lang}.ts has ${langKV.size} keys, ${missing.length} missing from en.ts`);
  
  if (missing.length > 0) {
    const enContent = fs.readFileSync('src/i18n/en.ts', 'utf8');
    const closeIdx = enContent.lastIndexOf('} as const;');
    const newEntries = missing.map(k => `  '${k}': '${langKV.get(k)}',`).join('\n');
    const newContent = enContent.substring(0, closeIdx) + '\n' + newEntries + '\n' + enContent.substring(closeIdx);
    fs.writeFileSync('src/i18n/en.ts', newContent, 'utf8');
    console.log(`Added ${missing.length} keys from ${lang}.ts to en.ts`);
  }
}

console.log('Done');
