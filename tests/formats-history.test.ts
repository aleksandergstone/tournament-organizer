// Formats that had no direct coverage (league) and the undo/redo engine, which
// every editor action depends on. Behaviour only, like the rest of the suite.
import { describe, it, expect } from 'vitest';
import { genLeague } from '../src/engine/generate';
import { canRedo, canUndo, commit, initHistory, redo, undo } from '../src/engine/history';
import { DEFAULT_RULES, Participant } from '../src/engine/types';

function ps(names: string[]): Participant[] {
  return names.map((n, i) => ({
    id: 'p' + i, name: n, kind: 'team', tags: [], seed: i + 1,
    active: true, withdrawnRound: null, avatar: null,
  }));
}
/** A pair of participants, order-independent, so home/away can be swapped. */
const pair = (a: string, b: string) => [a, b].sort().join('|');

describe('league', () => {
  it('plays every pair once when home & away is off', () => {
    const matches = genLeague(ps(['A', 'B', 'C', 'D']), { ...DEFAULT_RULES, homeAway: false });
    expect(matches).toHaveLength(6);
    const pairs = matches.map(m => pair(m.homeId!, m.awayId!));
    expect(new Set(pairs).size).toBe(6);
    expect([...new Set(matches.map(m => m.round))].sort()).toEqual([1, 2, 3]);
  });

  it('meets every pair twice with switched venues when home & away is on', () => {
    const matches = genLeague(ps(['A', 'B', 'C', 'D']), { ...DEFAULT_RULES, homeAway: true });
    expect(matches).toHaveLength(12);
    const seen = new Map<string, string[]>();
    for (const m of matches) {
      const k = pair(m.homeId!, m.awayId!);
      seen.set(k, [...(seen.get(k) ?? []), `${m.homeId}>${m.awayId}`]);
    }
    expect(seen.size).toBe(6);
    for (const legs of seen.values()) {
      expect(legs).toHaveLength(2);
      const [first, second] = legs;
      expect(second).toBe(`${first.split('>')[1]}>${first.split('>')[0]}`);
    }
  });

  it('gives every playable match a name and two sides', () => {
    const matches = genLeague(ps(['A', 'B', 'C', 'D', 'E']), { ...DEFAULT_RULES, homeAway: true });
    for (const m of matches) expect(m.roundName).toBeTruthy();
    // An odd field gets byes; those are dropped from documents, the rest is real.
    const playable = matches.filter(m => m.result.status !== 'bye');
    expect(playable.length).toBeGreaterThan(0);
    for (const m of playable) {
      expect(m.homeId).toBeTruthy();
      expect(m.awayId).toBeTruthy();
    }
    expect(matches.length).toBeGreaterThan(playable.length);
  });
});

describe('undo / redo', () => {
  const state = (n: number) => ({ score: n, label: `v${n}` });

  it('walks back and forward through edits', () => {
    let h = initHistory(state(0));
    h = commit(h, state(1));
    h = commit(h, state(2));
    expect(canUndo(h)).toBe(true);

    h = undo(h);
    expect(h.present.score).toBe(1);
    h = undo(h);
    expect(h.present.score).toBe(0);
    expect(canUndo(h)).toBe(false);

    h = redo(h);
    expect(h.present.score).toBe(1);
    h = redo(h);
    expect(h.present.score).toBe(2);
    expect(canRedo(h)).toBe(false);
  });

  it('drops the redo stack once a new edit is made', () => {
    let h = initHistory(state(0));
    h = commit(h, state(1));
    h = undo(h);
    expect(canRedo(h)).toBe(true);
    h = commit(h, state(9));
    expect(canRedo(h)).toBe(false);
    expect(h.present.score).toBe(9);
  });

  it('keeps snapshots by value, so later edits cannot rewrite history', () => {
    const start = { items: [1, 2] };
    let h = initHistory(start);
    const next = { items: [1, 2, 3] };
    h = commit(h, next);
    next.items.push(4);                       // mutated after the commit
    expect(h.future).toEqual([]);
    h = undo(h);
    expect(h.present).toEqual({ items: [1, 2] });
  });

  it('is a no-op at the ends of the history', () => {
    const h = initHistory(state(0));
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('caps the history so a long event cannot grow without limit', () => {
    let h = initHistory(state(0));
    for (let i = 1; i <= 5; i++) h = commit(h, state(i), 3);
    h = undo(h); h = undo(h); h = undo(h);
    expect(canUndo(h)).toBe(false);
    expect(h.present.score).toBe(2);          // oldest 0 and 1 fell out of the cap
  });
});
