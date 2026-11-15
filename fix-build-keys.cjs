const fs = require('fs');
const { execSync } = require('child_process');

// Read en.ts keys
const enContent = fs.readFileSync('src/i18n/en.ts', 'utf8');
const enKeys = new Set();
for (const line of enContent.split(/\r?\n/)) {
  const m = line.trim().match(/^'([^']+)'\s*:/);
  if (m) enKeys.add(m[1]);
}
console.log('en.ts keys:', enKeys.size);

// Run the build and capture errors
try {
  const output = execSync('npm run build 2>&1', { cwd: 'C:/Users/Aleksander G/Desktop/tournament-organizer', encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  console.log('Build succeeded!');
  process.exit(0);
} catch (e) {
  const output = e.stdout ? e.stdout.toString() : '';
  const stderr = e.stderr ? e.stderr.toString() : '';
  const all = output + '\n' + stderr;

  // Extract key names from errors like: Argument of type '"key.name"' is not assignable
  const keyRe = /Argument of type '("?)([^'"]+)\1' is not assignable/g;
  const missingKeys = new Set();
  let match;
  while ((match = keyRe.exec(all)) !== null) {
    const key = match[2]; // group 2 is the key without surrounding quotes
    if (!enKeys.has(key)) {
      missingKeys.add(key);
    }
  }

  console.log('Missing keys from build errors:', missingKeys.size);

  // Filter to only valid keys
  const validKeys = [...missingKeys].filter(k => /^[a-zA-Z][a-zA-Z0-9._]*$/.test(k));
  const invalidKeys = [...missingKeys].filter(k => !/^[a-zA-Z][a-zA-Z0-9._]*$/.test(k));

  if (invalidKeys.length > 0) {
    console.log('Skipping invalid keys:', invalidKeys.slice(0, 10));
  }

  if (validKeys.length > 0) {
    console.log('Adding keys:', validKeys.slice(0, 20));
    if (validKeys.length > 20) console.log('... and', validKeys.length - 20, 'more');

    const closeIdx = enContent.lastIndexOf('\n};\n');
    const newEntries = validKeys.map(k => `  '${k}': '${k}',`).join('\n');
    const newContent = enContent.substring(0, closeIdx) + '\n' + newEntries + '\n' + enContent.substring(closeIdx);
    fs.writeFileSync('src/i18n/en.ts', newContent, 'utf8');
    console.log('Added', validKeys.length, 'keys to en.ts');
  } else {
    console.log('No valid keys to add!');
  }
}
