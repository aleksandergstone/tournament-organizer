const fs = require('fs');

function parseKeys(content) {
  const lines = content.split(/\r?\n/);
  const keys = new Set();
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^'([^']+)'\s*:\s*(['"])/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

const enContent = fs.readFileSync('src/i18n/en.ts', 'utf8');
const enKeys = parseKeys(enContent);
console.log('en.ts keys:', enKeys.size);

for (const lang of ['pl', 'de', 'es']) {
  const content = fs.readFileSync(`src/i18n/${lang}.ts`, 'utf8');
  const langKeys = parseKeys(content);
  const missing = [...enKeys].filter(k => !langKeys.has(k));
  console.log(`\n${lang}.ts missing ${missing.length} keys:`);
  missing.forEach(k => console.log(`  '${k}': '${enKeys.get ? enKeys.get(k) : ''}'`));
  // Actually enKeys is a Set, not a Map. Let me get values differently.
}
