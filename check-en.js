const fs = require('fs');
const c = fs.readFileSync('src/i18n/en.ts', 'utf8');
console.log('has sync.hostTitle:', c.includes("sync.hostTitle"));
console.log('has sync.started:', c.includes("'sync.started'"));
const lines = c.split('\n');
lines.slice(-3).forEach((l,i) => console.log(i+':'+JSON.stringify(l)));
