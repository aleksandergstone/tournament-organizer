import { describe, it, expect } from 'vitest';
import { DEFAULT_RULES, DEFAULT_SETTINGS, Match, Participant, ProjectFile, StandingRow, uid } from '../src/engine/types';
import { genRoundRobin, pickQualifiers, seedKnockout } from '../src/engine/generate';
import { genSingleElim } from '../src/engine/elim';
import { genDoubleElim } from '../src/engine/double';
import { recomputeBracket } from '../src/engine/recompute';
import { recordResult, applyWithdrawals } from '../src/engine/result';
import { computeStandings } from '../src/engine/standings';
import { swissPairings } from '../src/engine/swiss';
import { createFileAdapter, parseProject, serializeProject } from '../src/engine/storage';

function ps(names: string[]): Participant[] {
  return names.map((n, i) => ({ id: 'p' + i + '_' + uid('x'), name: n, kind: 'team', tags: [], seed: i + 1, active: true, withdrawnRound: null, avatar: null }));
}
function play(ms: Match[], id: string, hs: number, as: number, knockout = false): Match[] {
  const r = recordResult(ms, id, { homeScore: hs, awayScore: as, status: 'played' }, DEFAULT_RULES, { knockout });
  expect(r.issues).toEqual([]);
  return r.matches;
}
// LB rounds unlock progressively: keep playing newly-opened LB matches until fixpoint.
function drainLB(ms: Match[]): Match[] {
  for (let i = 0; i < 10; i++) {
    const open = ms.filter(m => m.bracket?.kind === 'losers' && m.homeId && m.awayId && m.result.status === 'scheduled');
    if (!open.length) return ms;
    for (const m of open) ms = play(ms, m.id, 1, 0, true);
  }
  return ms;
}

describe('round robin', () => {
  it('4 players -> 6 matches, everyone plays 3', () => {
    const p = ps(['A', 'B', 'C', 'D']);
    const ms = genRoundRobin(p, DEFAULT_RULES);
    expect(ms.length).toBe(6);
    const counts = new Map<string, number>();
    for (const m of ms) { counts.set(m.homeId!, (counts.get(m.homeId!) ?? 0) + 1); counts.set(m.awayId!, (counts.get(m.awayId!) ?? 0) + 1); }
    for (const c of counts.values()) expect(c).toBe(3);
  });
  it('odd number -> bye rows, no crash', () => {
    const p = ps(['A', 'B', 'C']);
    const ms = genRoundRobin(p, DEFAULT_RULES);
    expect(ms.length).toBe(6); // 3 rounds x (1 real + 1 bye)
    expect(ms.filter(m => m.result.status === 'bye').length).toBe(3);
  });
});

describe('standings', () => {
  it('win=3 draw=1, correction recalculates', () => {
    const p = ps(['A', 'B']);
    let ms = genRoundRobin(p, DEFAULT_RULES);
    ms = play(ms, ms[0].id, 2, 1);
    let st = computeStandings(p, ms, DEFAULT_RULES);
    expect(st[0].points).toBe(3);
    const r = recordResult(ms, ms[0].id, { status: 'draw', homeScore: 0, awayScore: 0 }, DEFAULT_RULES);
    expect(r.issues).toEqual([]);
    st = computeStandings(p, r.matches, DEFAULT_RULES);
    expect(st[0].points).toBe(1);
    expect(st[1].points).toBe(1);
  });
  it('walkover awards points but no goals', () => {
    const p = ps(['A', 'B']);
    const ms = genRoundRobin(p, DEFAULT_RULES);
    const r = recordResult(ms, ms[0].id, { status: 'walkover', walkoverWinnerId: ms[0].homeId }, DEFAULT_RULES);
    expect(r.issues).toEqual([]);
    const st = computeStandings(p, r.matches, DEFAULT_RULES);
    expect(st.find(s => s.participantId === ms[0].homeId)!.points).toBe(3);
    expect(st.find(s => s.participantId === ms[0].homeId)!.scored).toBe(0);
  });
  it('unfinished/interrupted matches are ignored', () => {
    const p = ps(['A', 'B']);
    const ms = genRoundRobin(p, DEFAULT_RULES);
    const r = recordResult(ms, ms[0].id, { status: 'interrupted' }, DEFAULT_RULES);
    const st = computeStandings(p, r.matches, DEFAULT_RULES);
    expect(st.every(s => s.played === 0)).toBe(true);
  });
  it('duplicate names do not merge rows', () => {
    const p = ps(['Alex', 'Alex']);
    const ms = genRoundRobin(p, DEFAULT_RULES);
    const st = computeStandings(p, ms, DEFAULT_RULES);
    expect(st.length).toBe(2);
  });
});

describe('single elim', () => {
  it('5 players -> 7 slots, byes then propagate', () => {
    const p = ps(['A', 'B', 'C', 'D', 'E']);
    let { matches } = genSingleElim(p, DEFAULT_RULES);
    expect(matches.length).toBe(7); // 4 + 2 + 1
    for (const m of matches.filter(m => m.round === 1 && m.result.status === 'scheduled')) {
      matches = play(matches, m.id, 1, 0, true);
    }
    const sf = matches.filter(m => m.round === 2);
    expect(sf.every(m => m.homeId && m.awayId)).toBe(true);
  });
  it('correction clears stale downstream result', () => {
    const p = ps(['A', 'B', 'C', 'D']);
    let { matches } = genSingleElim(p, DEFAULT_RULES);
    const r1 = matches.filter(m => m.round === 1);
    for (const m of r1) matches = play(matches, m.id, 1, 0, true);
    const fin = matches.find(m => m.roundName === 'Final')!;
    matches = play(matches, fin.id, 2, 0, true);
    matches = play(matches, r1[0].id, 0, 5, true); // flip semifinalist
    const fin2 = matches.find(m => m.roundName === 'Final')!;
    expect(fin2.result.status).toBe('scheduled');
  });
  it('knockout draws are rejected explicitly', () => {
    const p = ps(['A', 'B']);
    const { matches } = genSingleElim(p, DEFAULT_RULES);
    const r = recordResult(matches, matches[0].id, { homeScore: 1, awayScore: 1, status: 'played' }, DEFAULT_RULES, { knockout: true });
    expect(r.issues.length).toBe(1);
    expect(r.issues[0]).toMatch(/knockout/i);
  });
});

describe('double elim end-to-end', () => {
  it('4 players: WB + LB + GF run, correction propagates', () => {
    const p = ps(['A', 'B', 'C', 'D']);
    let ms = recomputeBracket(genDoubleElim(p, DEFAULT_RULES).matches);
    expect(ms.filter(m => m.bracket?.kind === 'winners').length).toBe(3);
    expect(ms.filter(m => m.bracket?.kind === 'losers').length).toBeGreaterThanOrEqual(2);
    expect(ms.some(m => m.roundName === 'Grand Final')).toBe(true);
    for (const m of ms.filter(m => m.round === 1 && m.result.status === 'scheduled')) ms = play(ms, m.id, 2, 0, true);
    expect(ms.filter(m => m.bracket?.kind === 'losers' && m.homeId && m.awayId).length).toBeGreaterThan(0);
    const wbf = ms.find(m => m.roundName === 'WB Final')!;
    if (wbf.homeId && wbf.awayId) ms = play(ms, wbf.id, 1, 0, true);
    ms = drainLB(ms); // LB final unlocks only after WB final loser is known
    const gf = ms.find(m => m.roundName === 'Grand Final')!;
    expect(gf.homeId && gf.awayId).toBeTruthy();
    ms = play(ms, gf.id, 3, 1, true);
    expect(ms.find(m => m.roundName === 'Grand Final Reset')!.homeId).toBeNull();
    const w1 = ms.find(m => m.round === 1)!;
    ms = play(ms, w1.id, 0, 4, true);
    expect(ms.find(m => m.roundName === 'Grand Final')!.result.status).toBe('scheduled');
  });
  it('5 players: byes, WB completes', () => {
    const p = ps(['A', 'B', 'C', 'D', 'E']);
    let ms = recomputeBracket(genDoubleElim(p, DEFAULT_RULES).matches);
    expect(ms.filter(m => m.result.status === 'bye').length).toBeGreaterThan(0);
    for (const m of ms.filter(m => m.round === 1 && m.result.status === 'scheduled')) ms = play(ms, m.id, 1, 0, true);
    expect(ms.filter(m => m.round === 2).length).toBeGreaterThan(0);
  });
  it('L-side GF1 win activates reset', () => {
    const p = ps(['A', 'B', 'C', 'D']);
    let ms = recomputeBracket(genDoubleElim(p, DEFAULT_RULES).matches);
    for (const m of ms.filter(m => m.round === 1 && m.result.status === 'scheduled')) ms = play(ms, m.id, 2, 0, true);
    const wbf = ms.find(m => m.roundName === 'WB Final')!;
    if (wbf.homeId && wbf.awayId) ms = play(ms, wbf.id, 1, 0, true);
    ms = drainLB(ms);
    const gf = ms.find(m => m.roundName === 'Grand Final')!;
    ms = play(ms, gf.id, 0, 2, true);
    const reset = ms.find(m => m.roundName === 'Grand Final Reset')!;
    expect(reset.homeId).toBe(gf.homeId);
    expect(reset.awayId).toBe(gf.awayId);
  });
});

describe('double elim LB structure (8+ field and byes)', () => {
  // All l: sources across every match (LB feeds + n=2 GF fallback).
  const loserFeeds = (ms: Match[]): string[] =>
    ms.flatMap(m => [m.bracket?.srcHome, m.bracket?.srcAway])
      .filter(s => s && 'l' in s && s.l)
      .map(s => s!.l!);
  const realWbIds = (ms: Match[]): string[] =>
    ms.filter(m => m.bracket?.kind === 'winners' && m.result.status !== 'bye').map(m => m.id);
  // Play every currently-open match until fixpoint (WB rounds unlock LB rounds
  // progressively; guardLosersRematches may swap occupants between passes).
  const drainAll = (start: Match[]): Match[] => {
    let ms = start;
    for (let i = 0; i < 500; i++) {
      const open = ms.filter(m => m.homeId && m.awayId && m.result.status === 'scheduled');
      if (!open.length) return ms;
      for (const m of open) ms = play(ms, m.id, 2, 1, true);
    }
    return ms;
  };

  it('8 players: cross-half L1, survivor-vs-fresh L2, winner-only L3, WB-final loser in L4', () => {
    const p = ps(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const ms = recomputeBracket(genDoubleElim(p, DEFAULT_RULES).matches);
    const w1 = ms.filter(m => m.bracket?.kind === 'winners' && m.round === 1);
    expect(w1.length).toBe(4);
    const lb = (lr: number) => ms.filter(m => m.bracket?.kind === 'losers' && m.round === 100 + lr);
    // round sizes follow the standard 8-player DE: 2 + 2 + 1 + 1
    expect(lb(1).length).toBe(2);
    expect(lb(2).length).toBe(2);
    expect(lb(3).length).toBe(1);
    expect(lb(4).length).toBe(1);
    expect(ms.filter(m => m.bracket?.kind === 'losers').length).toBe(6); // = n - 2
    // L1 cross-half: feeds are (0,3) and (1,2) — index sums to n-1, never equal
    const idx = (s?: string | null) => w1.findIndex(m => m.id === s);
    for (const m of lb(1)) {
      const h = idx(m.bracket!.srcHome!.l), a = idx(m.bracket!.srcAway!.l);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(h + a).toBe(w1.length - 1);
      expect(h).not.toBe(a);
    }
    // L2: survivors (L1 winners) vs fresh W2 losers, cross-half (reversed fresh)
    const w2 = ms.filter(m => m.bracket?.kind === 'winners' && m.round === 2);
    const l1Ids = new Set(lb(1).map(m => m.id));
    for (const m of lb(2)) {
      expect(l1Ids.has(m.bracket!.srcHome!.w!)).toBe(true);   // survivor at home
      expect(w2.some(x => x.id === m.bracket!.srcAway!.l)).toBe(true); // fresh away
    }
    // L3 pairs L2 winners — must NOT re-feed W2 losers (the pre-fix bug)
    expect(lb(3)[0].bracket!.srcHome!.w).toBeDefined();
    expect(lb(3)[0].bracket!.srcAway!.w).toBeDefined();
    expect(lb(3)[0].bracket!.srcHome!.l).toBeUndefined();
    expect(lb(3)[0].bracket!.srcAway!.l).toBeUndefined();
    // L4: L survivor vs WB-final loser
    const wbf = ms.find(m => m.bracket?.kind === 'winners' && m.roundName === 'WB Final')!;
    expect(lb(4)[0].bracket!.srcHome!.w).toBeDefined();
    expect(lb(4)[0].bracket!.srcAway!.l).toBe(wbf.id);
    // every real WB match loser feeds the bracket exactly once (no double-feed,
    // no bye ever fed: a bye has no loser and would create a permanent TBD slot)
    const feeds = loserFeeds(ms);
    expect(feeds.length).toBe(new Set(feeds).size);
    expect([...feeds].sort()).toEqual(realWbIds(ms).sort());
  });

  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 24, 31, 32, 33, 48, 64])(
    'n=%i: each WB loser feeds once, LB = n-2, bracket drains to a decided GF',
    (n) => {
      const p = ps(Array.from({ length: n }, (_, i) => 'P' + i));
      let ms = recomputeBracket(genDoubleElim(p, DEFAULT_RULES).matches);
      // single life: every real WB loser enters the second-chance bracket once
      const feeds = loserFeeds(ms);
      expect(feeds.length).toBe(new Set(feeds).size);
      expect([...feeds].sort()).toEqual(realWbIds(ms).sort());
      expect(ms.filter(m => m.bracket?.kind === 'losers').length).toBe(Math.max(0, n - 2));
      ms = drainAll(ms);
      // GF resolved from decided WB-final and LB-final results
      const gf = ms.find(m => m.roundName === 'Grand Final')!;
      expect(gf.result.status).toBe('played');
      expect(gf.homeId).toBeTruthy();
      expect(gf.awayId).toBeTruthy();
      // no slot stuck half-filled (TBD on exactly one side) — the bye-deadlock
      // and double-feed bugs both surface here as permanently scheduled rows
      const stuck = ms.filter(m => m.result.status === 'scheduled' &&
        (m.homeId === null) !== (m.awayId === null));
      expect(stuck).toEqual([]);
    });
});

describe('withdrawal', () => {
  it('ejects from unplayed, keeps history', () => {
    const p = ps(['A', 'B', 'C']);
    let ms = genRoundRobin(p, DEFAULT_RULES);
    ms = play(ms, ms[0].id, 2, 1);
    const out = p.find(x => x.name === 'C')!.id;
    const w = applyWithdrawals(ms, new Set([out]));
    expect(w.changed).toBeGreaterThan(0);
    const st = computeStandings(p, w.matches, DEFAULT_RULES);
    expect(st.find(s => s.participantId === ms[0].homeId)!.played).toBe(1);
  });

describe('swiss', () => {
  it('no repeat opponents, bye rotates', () => {
    const p = ps(['A', 'B', 'C', 'D', 'E']);
    const st = new Map(p.map(x => [x.id, 0]));
    const r1 = swissPairings(p, [], st, 1);
    expect(r1.filter(m => m.result.status !== 'bye').length).toBe(2);
    expect(r1.filter(m => m.result.status === 'bye').length).toBe(1);
    const r2 = swissPairings(p, r1, st, 2);
    const b1 = r1.find(m => m.result.status === 'bye')!;
    const b2 = r2.find(m => m.result.status === 'bye')!;
    expect(b2.homeId).not.toBe(b1.homeId);
  });
});

describe('import/export', () => {
  it('rejects garbage without touching data', () => {
    expect(() => parseProject('not json')).toThrow(/valid JSON/);
    expect(() => parseProject(JSON.stringify({ app: 'x' }))).toThrow(/Corrupted import/);
    expect(() => parseProject(JSON.stringify({ app: 'tournament-organizer', version: 99, tournament: {}, participants: [], matches: [] }))).toThrow(/Corrupted import/);
  });
  it('migrates v0 and round-trips v1', () => {
    const p = ps(['A', 'B']);
    const ms = genRoundRobin(p, DEFAULT_RULES);
    const json = serializeProject({ tournament: { id: 't1', name: 'T', sport: 'S', individualOrTeam: 'team', format: 'round-robin', dates: {}, visibility: 'private', rules: DEFAULT_RULES, createdAt: '', updatedAt: '', archived: false }, participants: p, groups: [], matches: ms, audit: [], settings: { autosave: true, confirmDestructive: true, theme: 'light' } });
    expect(parseProject(json).file.participants.length).toBe(2);
    const v0 = JSON.stringify({ app: 'tournament-organizer', version: 0, tournament: { name: 'Old', rules: DEFAULT_RULES }, participants: p, matches: [] });
    const mig = parseProject(v0);
    expect(mig.file.version).toBe(1);
    expect(mig.warnings.length).toBeGreaterThan(0);
  });
  it('drops dangling matches with warning', () => {
    const p = ps(['A']);
    const bad = JSON.stringify({ app: 'tournament-organizer', version: 1, tournament: { name: 'T', rules: DEFAULT_RULES }, participants: p, groups: [], matches: [{ id: 'm1', round: 1, roundName: 'R1', homeId: 'ghost', awayId: p[0].id, result: { status: 'scheduled', homeScore: null, awayScore: null, winnerId: null } }], audit: [], settings: {} });
    const r = parseProject(bad);
    expect(r.file.matches.length).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/Dropped 1/);
  });
});
});
