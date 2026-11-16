import fs from 'fs';

let c = fs.readFileSync('tests/output.test.ts', 'utf8');

// Replace the old test about rounds - handle CRLF
const oldTest = `it('prints rounds in order, from the first to the last', () => {
    const { participants, matches } = ko(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const s = section(buildReport(input({ tournament: t({ format: 'single-elimination' }), participants, matches }), 'bracket'), 'bracket');
    const rounds = s.rounds!;
    expect(rounds.length).toBe(2);
    expect(rounds[0].rows).toHaveLength(2);
    expect(rounds[0].rows[0].no).toBe('1');
    // Round 1 is fixed at generation; the final waits for the winners.
    for (const m of rounds[0].rows) expect(m.home).not.toBe('\\u2014');
    for (const m of rounds[1].rows) expect(m.home).toBe('\\u2014');
  });`;

const newTest = `it('prints the bracket in the document (no round tables)', () => {
    const { participants, matches } = ko(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const s = section(buildReport(input({ tournament: t({ format: 'single-elimination' }), participants, matches }), 'bracket'), 'bracket');
    expect(s.bracket).toBeTruthy();
    expect(s.bracket!.length).toBeGreaterThan(100);
    expect(s.rounds).toBeUndefined();
  });`;

if (c.includes(oldTest)) {
  c = c.replace(oldTest, newTest);
  fs.writeFileSync('tests/output.test.ts', c);
  console.log('Fixed output.test.ts');
} else {
  console.log('Old test not found, trying fuzzy match...');
  // Try to find and replace just the key lines
  const lines = c.split(/\r?\n/);
  let inTest = false;
  let braceCount = 0;
  let startLine = -1;
  let endLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("prints rounds in order")) {
      inTest = true;
      startLine = i;
      braceCount = (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
    } else if (inTest) {
      braceCount += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
      if (braceCount <= 0) {
        endLine = i;
        break;
      }
    }
  }
  
  if (startLine >= 0 && endLine >= 0) {
    const replacement = `it('prints the bracket in the document (no round tables)', () => {
    const { participants, matches } = ko(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const s = section(buildReport(input({ tournament: t({ format: 'single-elimination' }), participants, matches }), 'bracket'), 'bracket');
    expect(s.bracket).toBeTruthy();
    expect(s.bracket!.length).toBeGreaterThan(100);
    expect(s.rounds).toBeUndefined();
  });`;
    
    lines.splice(startLine, endLine - startLine + 1, replacement);
    c = lines.join('\n');
    fs.writeFileSync('tests/output.test.ts', c);
    console.log('Fixed output.test.ts (fuzzy)');
  } else {
    console.log('Could not find test to replace');
  }
}
