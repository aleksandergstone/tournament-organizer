import { Match, Participant, RuleSet, StandingRow } from './types';
import { decidedWinner } from './pairings';

// Recomputes standings from scratch (deterministic). Handles:
// draws, walkovers (winner gets walkoverWinnerPoints), byes, overtime,
// withdrawn/inactive players (excluded from future but past results stand),
// unplayed matches ignored.
export function computeStandings(
  participants: Participant[], matches: Match[], rules: RuleSet
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const p of participants) {
    rows.set(p.id, {
      participantId: p.id, played: 0, wins: 0, draws: 0, losses: 0,
      scored: 0, conceded: 0, diff: 0, points: 0, buchholz: 0, rank: 0,
    });
  }
  // opponent map for buchholz
  const opponents = new Map<string, string[]>();
  const pointsOf = (id: string) => rows.get(id)?.points ?? 0;

  // Walkover rows must not distort goal/score tiebreaks: award the winner
  // points only (walkoverWinnerPoints), count W/L + played, but no +3 goals.
  // Scoring goals in WOs made diff/scored tiebreaks luck-based; organizers
  // asked for points-only walkovers (common federation rule).
  // Pure recompute: never mutate inputs (previous version wrote winnerId back
  // into match objects as a side effect, breaking undo snapshots).
  for (const m of matches) {
    const { homeId, awayId, result: r } = m;
    if (!homeId && !awayId) continue;
    if (r.status === 'scheduled' || r.status === 'unfinished' || r.status === 'interrupted') continue;
    if (r.status === 'bye') {
      const pid = decidedWinner(m);
      if (pid && rows.has(pid)) {
        const row = rows.get(pid)!;
        row.played += 1; row.wins += 1; row.points += rules.byePoints ?? rules.winPoints;
      }
      continue;
    }
    if (!homeId || !awayId) continue;
    if (!rows.has(homeId) || !rows.has(awayId)) continue;
    const H = rows.get(homeId)!, A = rows.get(awayId)!;
    (opponents.get(homeId) ?? opponents.set(homeId, []).get(homeId))!.push(awayId);
    (opponents.get(awayId) ?? opponents.set(awayId, []).get(awayId))!.push(homeId);

    if (r.status === 'walkover') {
      const w = r.walkoverWinnerId ?? r.winnerId;
      H.played += 1; A.played += 1;
      const wp = rules.walkoverWinnerPoints ?? rules.winPoints;
      if (w === homeId) { H.wins += 1; H.points += wp; A.losses += 1; A.points += rules.lossPoints; }
      else if (w === awayId) { A.wins += 1; A.points += wp; H.losses += 1; H.points += rules.lossPoints; }
      else { H.losses += 1; A.losses += 1; } // walkover vs TBD: no points, still counts as played-week idle
      continue;
    }
    const hs = r.homeScore ?? 0, as = r.awayScore ?? 0;
    const st = r.status as string;
    H.played += 1; A.played += 1;
    H.scored += hs; H.conceded += as;
    A.scored += as; A.conceded += hs;
    if (st === 'draw' || (r.winnerId === null && rules.allowDraws && hs === as && st === 'played')) {
      H.draws += 1; A.draws += 1;
      H.points += rules.drawPoints; A.points += rules.drawPoints;
    } else if (r.winnerId === homeId || (st !== 'draw' && hs > as && r.winnerId === null)) {
      H.wins += 1; A.losses += 1;
      H.points += rules.winPoints; A.points += rules.lossPoints;
    } else if (r.winnerId === awayId || (st !== 'draw' && as > hs && r.winnerId === null)) {
      A.wins += 1; H.losses += 1;
      A.points += rules.winPoints; H.points += rules.lossPoints;
    } else if (hs === as) {
      H.draws += 1; A.draws += 1;
      H.points += rules.drawPoints; A.points += rules.drawPoints;
    }
  }
  // buchholz = sum of opponents' points
  for (const [pid, opps] of opponents) {
    const row = rows.get(pid)!;
    row.buchholz = opps.reduce((s, o) => s + pointsOf(o), 0);
  }
  for (const row of rows.values()) row.diff = row.scored - row.conceded;

  const byId = new Map(participants.map(p => [p.id, p]));
  const arr = [...rows.values()].sort((a, b) => compareRows(a, b, rules, byId));
  arr.forEach((r, i) => { r.rank = i + 1; });
  return arr;
}

// Explicit, stable tiebreak application. Order comes from rules.tiebreakOrder
// (default: points → wins → diff → scored → buchholz? no — default is
// points, wins, diff, scored, seed, name). Buchholz applies only when listed.
// Final fallback is participant id so sort is total (no UI-order dependence).
function compareRows(
  a: StandingRow, b: StandingRow, rules: RuleSet, byId: Map<string, Participant>
): number {
  for (const key of rules.tiebreakOrder) {
    let d = 0;
    switch (key) {
      case 'points': d = b.points - a.points; break;
      case 'wins': d = b.wins - a.wins; break;
      case 'diff': d = b.diff - a.diff; break;
      case 'scored': d = b.scored - a.scored; break;
      case 'buchholz': d = b.buchholz - a.buchholz; break;
      case 'seed': d = (byId.get(a.participantId)?.seed ?? 9999) - (byId.get(b.participantId)?.seed ?? 9999); break;
      case 'name': d = (byId.get(a.participantId)?.name ?? '').localeCompare(byId.get(b.participantId)?.name ?? ''); break;
    }
    if (d !== 0) return d;
  }
  return a.participantId < b.participantId ? -1 : a.participantId > b.participantId ? 1 : 0;
}

export function scorePoints(rules: RuleSet, outcome: 'win' | 'draw' | 'loss'): number {
  return outcome === 'win' ? rules.winPoints : outcome === 'draw' ? rules.drawPoints : rules.lossPoints;
}
