import { Match, Participant, RuleSet } from './types';
import { mkMatch, nextPow2, orderParticipants, roundNameElim } from './pairings';
import { recomputeBracket } from './recompute';

export function genSingleElim(ps: Participant[], rules: RuleSet, opts?: { order?: 'given' }): { matches: Match[] } {
  // order:'given' keeps the caller's exact order (used by groups->knockout where
  // seedKnockout() already produced performance-based seeding).
  const active = ps.filter(p => p.active);
  const ordered = opts?.order === 'given' ? active : orderParticipants(active, rules);
  const n = ordered.length;
  if (n < 2) return { matches: [] };
  const size = nextPow2(n);
  const totalRounds = Math.log2(size);
  const matches: Match[] = [];
  const byes = size - n;
  const byePlayers = ordered.slice(0, byes);
  const playing = ordered.slice(byes);
  const r1: Match[] = [];
  for (let i = 0; i < playing.length / 2; i++) {
    const a = playing[i], b = playing[playing.length - 1 - i];
    if (a && b) {
      const m = mkMatch(1, roundNameElim(1, totalRounds), a.id, b.id);
      m.bracket = { kind: 'winners', manual: true, srcHome: { seed: a.id }, srcAway: { seed: b.id }, eliminatedOnLoss: true };
      r1.push(m);
    }
  }
  for (const p of byePlayers) {
    const m = mkMatch(1, roundNameElim(1, totalRounds), p.id, null);
    m.bracket = { kind: 'winners', manual: true, srcHome: { seed: p.id }, srcAway: { seed: null }, eliminatedOnLoss: true };
    r1.push(m);
  }
  matches.push(...r1);
  let prev = r1;
  for (let r = 2; r <= totalRounds; r++) {
    const arr: Match[] = [];
    for (let i = 0; i < prev.length / 2; i++) {
      const m = mkMatch(r, roundNameElim(r, totalRounds), null, null);
      m.bracket = { kind: 'winners', eliminatedOnLoss: true, srcHome: { w: prev[i * 2].id }, srcAway: { w: prev[i * 2 + 1].id } };
      arr.push(m);
    }
    matches.push(...arr);
    prev = arr;
  }
  return { matches: recomputeBracket(matches) };
}

// Back-compat: full deterministic recompute from provenance links.
export function propagateSingleElim(matches: Match[]): Match[] {
  return recomputeBracket(matches);
}
