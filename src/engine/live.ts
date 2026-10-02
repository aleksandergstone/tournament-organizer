// Live scoring — the engine behind the scorer screen.
//
// It owns one thing: how a match score grows. A match is a list of periods
// ("sets", "legs", "quarters"); the last one may still be running. Sports
// without periods (football, chess, a plain running total) simply have one
// period that never ends on its own — the operator ends those by hand.
//
// Pure: every function takes state and returns new state. The screen saves the
// outcome of each tap through the usual result choke-point, so the data contract
// stays honest and files written before v1.5 (which have no `sets`) keep working.
import { Match, RuleSet, SetScore } from './types';
import type { EditSpec } from './result';

export interface LiveState {
  /** Every period played, in order; the last one may still be running. */
  sets: SetScore[];
}

export function pointsPerPeriod(rules: RuleSet): number {
  return Math.max(0, Math.floor(rules.periodPoints ?? 0));
}

export function periodsToWin(rules: RuleSet): number {
  return Math.max(1, Math.floor(rules.periodsToWin ?? 1));
}

export function needsTwoClearPoints(rules: RuleSet): boolean {
  return rules.winByTwo !== false;
}

const clone = (s: SetScore): SetScore => ({ home: s.home, away: s.away });

/** True when this period is over: target reached and (if required) two clear. */
export function periodOver(period: SetScore, rules: RuleSet): boolean {
  const target = pointsPerPeriod(rules);
  if (!target) return false;
  const need = needsTwoClearPoints(rules) ? 2 : 1;
  const leader = Math.max(period.home, period.away);
  const lead = Math.abs(period.home - period.away);
  return leader >= target && lead >= need;
}

/** Periods that are definitely finished. */
export function finishedPeriods(state: LiveState, rules: RuleSet): SetScore[] {
  const per = pointsPerPeriod(rules);
  const last = state.sets.length - 1;
  return state.sets.filter((s, i) => i < last || (per > 0 && periodOver(s, rules)));
}

/** Periods won by each side. */
export function periodsWon(state: LiveState, rules: RuleSet): SetScore {
  const fin = finishedPeriods(state, rules);
  return { home: fin.filter(s => s.home > s.away).length, away: fin.filter(s => s.away > s.home).length };
}

/** Total points across every period — the aggregate score of the match. */
export function aggregate(state: LiveState): SetScore {
  return state.sets.reduce<SetScore>(
    (acc, s) => ({ home: acc.home + s.home, away: acc.away + s.away }), { home: 0, away: 0 });
}

export function emptyLive(): LiveState { return { sets: [{ home: 0, away: 0 }] }; }

/** Rebuilds the live state of a match, with or without stored periods. */
export function liveStateOf(m: Match): LiveState {
  const stored = m.result.sets;
  if (Array.isArray(stored) && stored.length) return { sets: stored.map(clone) };
  return { sets: [{ home: m.result.homeScore ?? 0, away: m.result.awayScore ?? 0 }] };
}

/** Adds a point; ends the period automatically when its target is reached. */
export function addPoint(state: LiveState, side: 'home' | 'away', rules: RuleSet): LiveState {
  const sets = state.sets.length ? state.sets.map(clone) : [{ home: 0, away: 0 }];
  const cur = sets[sets.length - 1];
  cur[side] += 1;
  if (pointsPerPeriod(rules) > 0 && periodOver(cur, rules)) {
    const won = periodsWon({ sets }, rules);
    const need = periodsToWin(rules);
    // A fresh period is added only while the match is still open.
    if (won.home < need && won.away < need) sets.push({ home: 0, away: 0 });
  }
  return { sets };
}

/** Undoes the last point, stepping back across a period boundary if needed. */
export function removePoint(state: LiveState, side: 'home' | 'away'): LiveState {
  const sets = state.sets.length ? state.sets.map(clone) : [{ home: 0, away: 0 }];
  const cur = sets[sets.length - 1];
  if (cur[side] > 0) { cur[side] -= 1; return { sets }; }
  if (sets.length > 1) {
    // Nothing left in this period: step back into the previous one.
    sets.pop();
    const prev = sets[sets.length - 1];
    if (prev[side] > 0) prev[side] -= 1;
  }
  return { sets };
}

export interface LiveDecision {
  /** Total points, across every period. */
  aggregate: SetScore;
  /** Periods won. */
  periodsWon: SetScore;
  /** Someone has enough periods, so the match is over. */
  decided: boolean;
  winner: 'home' | 'away' | null;
  /** The sport has no automatic period end, so the operator ends the match. */
  manualEnd: boolean;
}

export function decide(state: LiveState, rules: RuleSet): LiveDecision {
  const agg = aggregate(state);
  const won = periodsWon(state, rules);
  if (pointsPerPeriod(rules) === 0) {
    return { aggregate: agg, periodsWon: won, decided: false, winner: null, manualEnd: true };
  }
  const need = periodsToWin(rules);
  const decided = won.home >= need || won.away >= need;
  return {
    aggregate: agg, periodsWon: won,
    decided,
    winner: decided ? (won.home > won.away ? 'home' : 'away') : null,
    manualEnd: false,
  };
}

/**
 * The edit for the current state. While the match is running the result is kept
 * as `unfinished`, so a half-played score can never push a winner into the next
 * round or onto a table.
 */
export function liveEdit(m: Match, state: LiveState, rules: RuleSet): EditSpec {
  const d = decide(state, rules);
  const base: EditSpec = { homeScore: d.aggregate.home, awayScore: d.aggregate.away, sets: state.sets };
  if (d.decided && d.winner) {
    return { ...base, status: 'played', winnerId: d.winner === 'home' ? m.homeId : m.awayId };
  }
  return { ...base, status: 'unfinished', winnerId: null };
}

/** The operator's own "that's it" — used for sports with no automatic end. */
export function finishEdit(m: Match, state: LiveState): EditSpec {
  const agg = aggregate(state);
  const winner = agg.home > agg.away ? m.homeId : agg.away > agg.home ? m.awayId : null;
  return {
    homeScore: agg.home,
    awayScore: agg.away,
    sets: state.sets,
    status: winner ? 'played' : 'draw',
    winnerId: winner,
  };
}
