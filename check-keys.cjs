const fs = require('fs');

// Parse keys more carefully - handle CRLF and escaped quotes
function parseKeys(content) {
  const lines = content.split(/\r?\n/);
  const keys = new Set();
  for (const line of lines) {
    const trimmed = line.trim();
    // Match: 'key': 'value' or 'key': "value"
    const m = trimmed.match(/^'([^']+)'\s*:\s*(['"])/);
    if (m) {
      keys.add(m[1]);
    }
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
  console.log(`${lang}.ts keys: ${langKeys.size}, missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Missing keys:', missing.slice(0, 10));
    if (missing.length > 10) console.log('  ... and', missing.length - 10, 'more');
  }
}
