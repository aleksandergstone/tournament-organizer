import fs from 'fs';

let c = fs.readFileSync('tests/output.test.ts', 'utf8');

// Replace the old test about rounds
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

c = c.replace(oldTest, newTest);
fs.writeFileSync('tests/output.test.ts', c);
console.log('Fixed output.test.ts');
