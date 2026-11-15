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

const enKeys = getAllKeys(fs.readFileSync('src/i18n/en.ts', 'utf8'));
console.log('en.ts keys:', enKeys.size);

for (const lang of ['pl', 'de', 'es']) {
  const langPath = `src/i18n/${lang}.ts`;
  let content = fs.readFileSync(langPath, 'utf8');
  const langKeys = getAllKeys(content);
  
  const missing = [...enKeys].filter(k => !langKeys.has(k));
  console.log(`${lang}.ts: ${langKeys.size} keys, missing ${missing.length} from en.ts`);
  
  if (missing.length > 0) {
    // Find closing anchor: '} as const;' for en.ts, '};' for others
    const closeAnchor = lang === 'en' ? '} as const;' : '};';
    const closeIdx = content.lastIndexOf(closeAnchor);
    if (closeIdx === -1) {
      console.error(`  ERROR: could not find '${closeAnchor}' in ${langPath}`);
      continue;
    }
    const newEntries = missing.map(k => `  '${k}': '${k}',`).join('\n');
    content = content.substring(0, closeIdx) + '\n' + newEntries + '\n' + content.substring(closeIdx);
    fs.writeFileSync(langPath, content, 'utf8');
    console.log(`  Added ${missing.length} keys to ${lang}.ts`);
  }
}

console.log('Done');
