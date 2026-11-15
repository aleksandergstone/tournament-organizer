const fs = require('fs');
const { execSync } = require('child_process');

const enPath = 'src/i18n/en.ts';
let enContent = fs.readFileSync(enPath, 'utf8');
const enKeys = new Set();
for (const line of enContent.split(/\r?\n/)) {
  const m = line.trim().match(/^'([^']+)'\s*:/);
  if (m) enKeys.add(m[1]);
}
console.log('en.ts keys:', enKeys.size);

// Run build, extract missing keys, add them
for (let round = 0; round < 5; round++) {
  let output;
  try {
    output = execSync('npm run build 2>&1', { cwd: 'C:/Users/Aleksander G/Desktop/tournament-organizer', encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    console.log('Build succeeded on round', round);
    process.exit(0);
  } catch (e) {
    output = (e.stdout ? e.stdout.toString() : '') + '\n' + (e.stderr ? e.stderr.toString() : '');
  }

  // Check for syntax errors (TS1005 etc.) - these mean en.ts is corrupted
  if (output.includes('TS1005') || output.includes('TS1109')) {
    console.log('Syntax error in en.ts - stopping');
    process.exit(1);
  }

  // Extract missing keys
  const keyRe = /Argument of type '("?)([^'"]+)\1' is not assignable/g;
  const missingKeys = new Set();
  let match;
  while ((match = keyRe.exec(output)) !== null) {
    const key = match[2];
    if (!enKeys.has(key) && /^[a-zA-Z][a-zA-Z0-9._]*$/.test(key)) {
      missingKeys.add(key);
    }
  }

  if (missingKeys.size === 0) {
    console.log('No missing keys found on round', round);
    break;
  }

  console.log(`Round ${round}: adding ${missingKeys.size} keys`);

  const closeIdx = enContent.lastIndexOf('} as const;');
  if (closeIdx === -1) {
    console.error('Could not find closing anchor');
    process.exit(1);
  }

  const newEntries = [...missingKeys].map(k => `  '${k}': '${k}',`).join('\n');
  enContent = enContent.substring(0, closeIdx) + '\n' + newEntries + '\n' + enContent.substring(closeIdx);
  
  // Update key set
  for (const k of missingKeys) enKeys.add(k);
}

fs.writeFileSync(enPath, enContent, 'utf8');
console.log('Done. Total keys added across rounds');
