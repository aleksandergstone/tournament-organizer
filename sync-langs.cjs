const fs = require('fs');

// Parse a dictionary file: extract key-value pairs from lines like '  'key.sub': 'value','
function parseDict(content) {
  const lines = content.split('\n');
  const keys = {};
  for (const line of lines) {
    const m = line.match(/^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)'/);
    if (m) {
      keys[m[1]] = m[2];
    }
  }
  return keys;
}

const enContent = fs.readFileSync('src/i18n/en.ts', 'utf8');
const enKeys = parseDict(enContent);
console.log('en.ts has', Object.keys(enKeys).length, 'keys');

const langs = ['pl', 'de', 'es'];
for (const lang of langs) {
  const content = fs.readFileSync(`src/i18n/${lang}.ts`, 'utf8');
  const langKeys = parseDict(content);
  const missing = Object.keys(enKeys).filter(k => !(k in langKeys));
  console.log(`${lang}.ts has ${Object.keys(langKeys).length} keys, missing ${missing.length}`);
  
  if (missing.length > 0) {
    // Insert missing keys before the closing '};'
    let newContent = content;
    // Find the position of the last '};' (closing of the object)
    const lastBraceIdx = newContent.lastIndexOf('\n};\n');
    if (lastBraceIdx === -1) {
      console.log(`  ERROR: could not find closing in ${lang}.ts`);
      continue;
    }
    
    const missingBlock = missing.map(k => `  '${k}': '${enKeys[k]}',`).join('\n');
    const before = newContent.substring(0, lastBraceIdx);
    const after = newContent.substring(lastBraceIdx);
    newContent = before + '\n' + missingBlock + '\n' + after;
    
    fs.writeFileSync(`src/i18n/${lang}.ts`, newContent, 'utf8');
    console.log(`  Added ${missing.length} missing keys to ${lang}.ts`);
  }
}

console.log('Done');
