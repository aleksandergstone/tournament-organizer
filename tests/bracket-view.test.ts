// The drawn bracket ("spider"), the final result of a knockout and the format
// rules that decide whether a points table means anything at all.
import { describe, it, expect, afterEach } from 'vitest';
import { buildBracketTree, bracketSvg, knockoutPlaces, NODE_H, NODE_W } from '../src/engine/bracket-view';
import { genSingleElim } from '../src/engine/elim';
import { genRoundRobin, hasBracket, hasPointTable } from '../src/engine/generate';
import { recordResult } from '../src/engine/result';
import { buildReport } from '../src/engine/output';
import { setLocale } from '../src/i18n';
import { en } from '../src/i18n/en';
import { DEFAULT_RULES, Match, Participant, Tournament, uid } from '../src/engine/types';

const AT = '2026-03-14T10:00:00.000Z';
const nameOf = (names: Map<string, string>) => (id: string | null | undefined) =>
  (id ? names.get(id) ?? '?' : '—');

function players(list: string[]): Participant[] {
  return list.map((n, i) => ({
    id: `p${i}_${uid('x')}`, name: n, kind: 'team', tags: [], seed: i + 1,
    active: true, withdrawnRound: null, avatar: null,
  }));
}
function ko(list: string[]) {
  const participants = players(list);
  const names = new Map(participants.map(p => [p.id, p.name]));
  return { participants, names, matches: genSingleElim(participants, DEFAULT_RULES).matches };
}
/** Plays every match that has both sides, round by round, until none are left. */
function playAll(matches: Match[]): Match[] {
  let m = matches;
  for (let i = 0; i < 8; i++) {
    const open = m.filter(x => x.homeId && x.awayId && x.result.status === 'scheduled');
    if (!open.length) break;
    for (const x of open) {
      const r = recordResult(m, x.id, { homeScore: 2, awayScore: 1, status: 'played' }, DEFAULT_RULES, { knockout: true });
      expect(r.issues).toEqual([]);
      m = r.matches;
    }
  }
  return m;
}
const tour = (over: Partial<Tournament> = {}): Tournament => ({
  id: 't1', name: 'Winter Cup', sport: 'Football', individualOrTeam: 'team',
  format: 'single-elimination', dates: { start: '2026-03-14', end: '2026-03-15' },
  location: 'Sports Hall', visibility: 'private', rules: { ...DEFAULT_RULES },
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  archived: false, ...over,
});

afterEach(() => setLocale('en'));

describe('which formats get a table, a bracket or both', () => {
  it('only ranks where points decide something', () => {
    expect(hasPointTable('round-robin')).toBe(true);
    expect(hasPointTable('league')).toBe(true);
    expect(hasPointTable('swiss')).toBe(true);
    expect(hasPointTable('groups-knockout')).toBe(true);
    expect(hasPointTable('single-elimination')).toBe(false);
    expect(hasPointTable('double-elimination')).toBe(false);
  });

  it('draws a bracket only where there is a knockout stage', () => {
    expect(hasBracket('single-elimination')).toBe(true);
    expect(hasBracket('double-elimination')).toBe(true);
    expect(hasBracket('groups-knockout')).toBe(true);
    for (const f of ['league', 'round-robin', 'swiss', 'custom']) expect(hasBracket(f)).toBe(false);
  });
});

describe('the bracket as a spider', () => {
  it('spreads the rounds out and never overlaps two boxes', () => {
    const { names, matches } = ko(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const tree = buildBracketTree(matches, nameOf(names), { emptyLabel: '—', roundName: n => `Round ${n}` });
    expect(tree.rounds).toHaveLength(3);
    expect(tree.nodes).toHaveLength(7);
    for (const col of [0, 1, 2]) {
      const ys = tree.nodes.filter(n => n.col === col).map(n => n.y).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(NODE_H);
    }
    // Columns grow to the right, so the first round is the leftmost one.
    const firstX = tree.nodes[0].x;
    expect(tree.nodes.filter(n => n.col === 0).every(n => n.x === firstX)).toBe(true);
    expect(tree.width).toBeGreaterThan(NODE_W * 3);
  });

  it('connects every match to the one it feeds', () => {
    const { names, matches } = ko(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const tree = buildBracketTree(matches, nameOf(names), { emptyLabel: '—', roundName: n => `R${n}` });
    expect(tree.links).toHaveLength(6);            // 2 + 4 feeders into later rounds
    for (const l of tree.links) {
      expect(tree.byId.get(l.from)!.col).toBeLessThan(tree.byId.get(l.to)!.col);
    }
  });

  it('knows the champion once the final is decided', () => {
    const { names, matches } = ko(['A', 'B', 'C', 'D']);
    const tree0 = buildBracketTree(matches, nameOf(names), { emptyLabel: '—', roundName: n => `R${n}` });
    expect(tree0.champion).toBeNull();
    const tree = buildBracketTree(playAll(matches), nameOf(names), { emptyLabel: '—', roundName: n => `R${n}` });
    expect(tree.champion?.name).toBeTruthy();
  });

  it('draws names, scores and connectors into one SVG', () => {
    const { names, matches } = ko(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const tree = buildBracketTree(playAll(matches), nameOf(names), { emptyLabel: '—', roundName: n => `R${n}` });
    const svg = bracketSvg({ tree, title: 'Bracket', championLabel: en['st.champion'] });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Lions');
    expect(svg).toContain('<path');                       // connector lines
    expect(svg.split('<rect').length - 1).toBe(tree.nodes.length);
    expect(svg).toContain(en['st.champion'].toUpperCase());
    expect(svg).not.toContain('undefined');
  });
});

describe('places of a knockout', () => {
  it('is empty until the final is decided', () => {
    const { names, matches } = ko(['A', 'B', 'C', 'D']);
    expect(knockoutPlaces(matches, nameOf(names))).toEqual([]);
  });

  it('names the winner, the runner-up and the third team', () => {
    const { names, matches } = ko(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const places = knockoutPlaces(playAll(matches), nameOf(names));
    expect(places.map(p => p.place)).toEqual([1, 2, 3]);
    expect(places.map(p => p.name).every(Boolean)).toBe(true);
  });
});

describe('documents of a knockout', () => {
  it('prints the final result instead of a points table', () => {
    const { participants, matches } = ko(['A', 'B', 'C', 'D']);
    const report = buildReport({
      tournament: tour(), participants, groups: [], matches: playAll(matches), generatedAt: AT,
    }, 'standings');
    expect(report.sections).toHaveLength(1);
    const s = report.sections[0];
    expect(s.id).toBe('final');
    expect(s.title).toBe(en['doc.finalTitle']);
    expect(s.rows).toHaveLength(3);                  // 1st, 2nd, 3rd
    expect(s.columns?.map(c => c.label)).toEqual([en['doc.place'], en['st.colWho']]);
  });

  it('has no final result before the bracket is decided', () => {
    const { participants, matches } = ko(['A', 'B', 'C', 'D']);
    const report = buildReport({
      tournament: tour(), participants, groups: [], matches, generatedAt: AT,
    }, 'standings');
    expect(report.sections[0].id).not.toBe('final');
  });

  it('keeps a real table for a league', () => {
    const participants = players(['A', 'B', 'C', 'D']);
    const matches = genRoundRobin(participants, DEFAULT_RULES);
    const report = buildReport({
      tournament: tour({ format: 'league' }), participants, groups: [], matches, generatedAt: AT,
    }, 'standings');
    expect(report.sections[0].id).toBe('standings');
    expect(report.sections[0].columns?.map(c => c.label)).toContain(en['st.colPts']);
  });

  it('draws the bracket in the document and keeps the rows for CSV', () => {
    const { participants, matches } = ko(['A', 'B', 'C', 'D']);
    const report = buildReport({
      tournament: tour(), participants, groups: [], matches, generatedAt: AT,
    }, 'bracket');
    const s = report.sections.find(x => x.id === 'bracket')!;
    expect(s.bracket).toContain('<svg');
    expect(s.rounds?.length).toBe(2);
  });

  it('keeps round tables for double elimination, whose shape cannot be drawn', () => {
    const { participants, matches } = ko(['A', 'B', 'C', 'D']);
    const report = buildReport({
      tournament: tour({ format: 'double-elimination' }), participants, groups: [], matches, generatedAt: AT,
    }, 'bracket');
    const s = report.sections.find(x => x.id === 'bracket');
    expect(s?.bracket).toBeUndefined();
    expect(s?.rounds?.length).toBeGreaterThan(0);
  });
});
