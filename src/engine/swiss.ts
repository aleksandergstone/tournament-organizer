import { Match, Participant } from './types';
import { mkMatch } from './pairings';
import { t } from '../i18n';

// Swiss pairing from live points. Deterministic: sort by (points desc, seed,
// name), then greedily pair top-down preferring closest score without rematch.
// Rematch only when unavoidable (small fields / late rounds). Byes go to the
// lowest-ranked player who has not yet had one.
export function swissPairings(
  ps: Participant[], matches: Match[], standings: Map<string, number>, round: number
): Match[] {
  const active = ps.filter(p => p.active);
  const played = new Map<string, Set<string>>();
  const hadBye = new Set<string>();
  for (const m of matches) {
    if (m.result.status === 'bye' && (m.homeId ?? m.awayId)) hadBye.add((m.homeId ?? m.awayId)!);
    if (!m.homeId || !m.awayId) continue;
    if (m.result.status === 'scheduled' || m.result.status === 'unfinished' || m.result.status === 'interrupted') continue;
    if (!played.has(m.homeId)) played.set(m.homeId, new Set());
    if (!played.has(m.awayId)) played.set(m.awayId, new Set());
    played.get(m.homeId)!.add(m.awayId);
    played.get(m.awayId)!.add(m.homeId);
  }
  const byId = new Map(active.map(p => [p.id, p]));
  const sorted = [...active].sort((a, b) =>
    (standings.get(b.id) ?? 0) - (standings.get(a.id) ?? 0) ||
    (a.seed ?? 9999) - (b.seed ?? 9999) ||
    a.name.localeCompare(b.name));
  // odd count: bye to lowest-ranked without one yet
  let bye: Participant | null = null;
  let pool = [...sorted];
  if (pool.length % 2 === 1) {
    bye = [...pool].reverse().find(p => !hadBye.has(p.id)) ?? pool[pool.length - 1];
    pool = pool.filter(p => p.id !== bye!.id);
  }
  const out: Match[] = [];
  const used = new Set<string>();
  for (const p of pool) {
    if (used.has(p.id)) continue;
    used.add(p.id);
    const candidates = pool.filter(q => q.id !== p.id && !used.has(q.id));
    // prefer same score, then closest score, never rematch unless forced
    const scored = (q: Participant) => Math.abs((standings.get(p.id) ?? 0) - (standings.get(q.id) ?? 0));
    const fresh = candidates.filter(q => !played.get(p.id)?.has(q.id)).sort((x, y) => scored(x) - scored(y) || (byId.get(x.id)!.seed ?? 9999) - (byId.get(y.id)!.seed ?? 9999));
    const opp = fresh[0] ?? candidates.sort((x, y) => scored(x) - scored(y))[0];
    if (opp) {
      used.add(opp.id);
      const m = mkMatch(round, t('round.swiss', { n: round }), p.id, opp.id);
      m.bracket = { kind: 'swiss', manual: true };
      out.push(m);
    }
  }
  if (bye) {
    const m = mkMatch(round, t('round.swiss', { n: round }), bye.id, null);
    m.bracket = { kind: 'swiss', manual: true };
    out.push(m);
  }
  return out;
}

