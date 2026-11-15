const fs = require('fs');
const path = require('path');

// Walk directory recursively
function walk(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(fullPath, fileList);
      }
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      if (!fullPath.includes('/i18n/')) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

const files = walk('src');
console.log('Scanning', files.length, 'files...');

// 1. Read en.ts keys
const enContent = fs.readFileSync('src/i18n/en.ts', 'utf8');
const enKeys = new Set();
for (const line of enContent.split(/\r?\n/)) {
  const m = line.trim().match(/^'([^']+)'\s*:/);
  if (m) enKeys.add(m[1]);
}
console.log('en.ts keys:', enKeys.size);

// 2. Scan all files for t('key') calls
const usedKeys = new Set();
const re = /t\((['"])(.*?)\1\)/g;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = re.exec(content)) !== null) {
    usedKeys.add(match[2]);
  }
}

console.log('Used keys in source:', usedKeys.size);

const missing = [...usedKeys].filter(k => !enKeys.has(k));
console.log('Missing from en.ts:', missing.length);
if (missing.length > 0) {
  missing.forEach(k => console.log(`  '${k}': ''`));
  
  // Add missing keys to en.ts before closing
  const closeIdx = enContent.lastIndexOf('\n};\n');
  const newEntries = missing.map(k => `  '${k}': '${k}',`).join('\n');
  const newContent = enContent.substring(0, closeIdx) + '\n' + newEntries + '\n' + enContent.substring(closeIdx);
  fs.writeFileSync('src/i18n/en.ts', newContent, 'utf8');
  console.log('\nAdded', missing.length, 'keys to en.ts');
} else {
  console.log('No missing keys!');
}
