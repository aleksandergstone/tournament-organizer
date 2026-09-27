import { Group, Match, Participant, RuleSet } from './types';
import { mkMatch, orderParticipants } from './pairings';

function tagRR(m: Match, groupId: string | null, kind: 'group' | 'league'): Match {
  m.bracket = { kind, manual: true };
  m.groupId = groupId;
  return m;
}

export function genRoundRobin(ps: Participant[], rules: RuleSet, groupId: string | null = null, groupName = ''): Match[] {
  const ordered = orderParticipants(ps.filter(p => p.active), rules);
  if (ordered.length < 2) return [];
  const list: (Participant | null)[] = [...ordered];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds = n - 1;
  const arr = [...list];
  const out: Match[] = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      const rn = groupName ? groupName + ' R' + (r + 1) : 'Round ' + (r + 1);
      if (a && b) out.push(tagRR(mkMatch(r + 1, rn, r % 2 === 0 ? a.id : b.id, r % 2 === 0 ? b.id : a.id, groupId), groupId, groupId ? 'group' : 'league'));
      else out.push(tagRR(mkMatch(r + 1, rn, a ? a.id : null, b ? b.id : null, groupId), groupId, groupId ? 'group' : 'league'));
    }
    const last = arr.pop()!;
    arr.splice(1, 0, last);
  }
  if (rules.homeAway) {
    const second = out.filter(m => m.result.status !== 'bye').map(m =>
      tagRR(mkMatch(m.round + rounds, (groupName ? groupName + ' ' : '') + 'R' + (m.round + rounds), m.awayId, m.homeId, groupId), groupId, groupId ? 'group' : 'league'));
    out.push(...second);
  }
  return out;
}

export function splitGroups(ps: Participant[], groupCount: number, rules: RuleSet): Group[] {
  const active = orderParticipants(ps.filter(p => p.active), rules);
  const n = Math.max(1, groupCount);
  const groups: Group[] = Array.from({ length: n }, (_, i) => ({
    id: 'g' + i + '_' + Math.random().toString(36).slice(2, 6),
    name: 'Group ' + String.fromCharCode(65 + i),
    participantIds: [],
  }));
  active.forEach((p, i) => {
    let idx = i % n;
    if (rules.seeding === 'seeded') {
      const round = Math.floor(i / n);
      idx = round % 2 === 0 ? i % n : n - 1 - (i % n);
    }
    groups[idx].participantIds.push(p.id);
  });
  return groups;
}

export function genGroupsKnockout(ps: Participant[], rules: RuleSet): { groups: Group[]; matches: Match[] } {
  const groups = splitGroups(ps, Math.max(2, rules.groupCount ?? 2), rules);
  const byId = new Map(ps.map(p => [p.id, p]));
  const matches: Match[] = [];
  for (const g of groups) {
    const members = g.participantIds.map(id => byId.get(id)!).filter(Boolean);
    matches.push(...genRoundRobin(members, { ...rules, homeAway: false }, g.id, g.name));
  }
  return { groups, matches };
}

export function genLeague(ps: Participant[], rules: RuleSet): Match[] {
  return genRoundRobin(ps, { ...rules, homeAway: rules.homeAway ?? true }, null, '');
}

// ---- groups -> knockout progression (no manual re-entry) ----

export type QualifierMode = 'top' | 'wildcard';

export interface QualifierPick {
  participantId: string;
  fromGroupId: string;
  groupRank: number;   // 1-based within group
  points: number;
  diff: number;
  scored: number;
}

export interface QualifierOptions {
  perGroup: number;        // top N per group (0 = none, use wildcards only)
  wildcards?: number;      // best non-qualified across groups (default 0)
  mode?: QualifierMode;
}

// Deterministic qualifier selection from per-group standings.
// Order: group position first (all P1, then P2, ...), ties broken by the same
// RuleSet tiebreak order used for standings (points, diff, scored, seed, name
// via computeStandings rank). Wildcards: best runners-up across groups by
// (points, diff, scored, groupRank, name) — never by UI order.
export function pickQualifiers(
  groups: Group[],
  standingsByGroup: Map<string, import('./types').StandingRow[]>,
  opts: QualifierOptions,
): QualifierPick[] {
  const perGroup = Math.max(0, Math.floor(opts.perGroup));
  const wild = Math.max(0, Math.floor(opts.wildcards ?? 0));
  const out: QualifierPick[] = [];
  const taken = new Set<string>();
  for (const g of groups) {
    const st = standingsByGroup.get(g.id) ?? [];
    for (let i = 0; i < Math.min(perGroup, st.length); i++) {
      const row = st[i];
      out.push({ participantId: row.participantId, fromGroupId: g.id, groupRank: i + 1, points: row.points, diff: row.diff, scored: row.scored });
      taken.add(row.participantId);
    }
  }
  if (wild > 0) {
    const cands: QualifierPick[] = [];
    for (const g of groups) {
      const st = standingsByGroup.get(g.id) ?? [];
      for (let i = perGroup; i < st.length; i++) {
        const row = st[i];
        if (taken.has(row.participantId)) continue;
        cands.push({ participantId: row.participantId, fromGroupId: g.id, groupRank: i + 1, points: row.points, diff: row.diff, scored: row.scored });
      }
    }
    cands.sort((a, b) => b.points - a.points || b.diff - a.diff || b.scored - a.scored || a.groupRank - b.groupRank || (a.participantId < b.participantId ? -1 : 1));
    for (const c of cands.slice(0, wild)) { out.push(c); taken.add(c.participantId); }
  }
  return out;
}

// Seed qualifiers into a single-elim KO bracket: order all group winners first
// (by points/diff/scored), then runners-up, etc. — then pair top-vs-bottom
// (1vN) so group winners cannot meet in round 1 when the field allows it.
export function seedKnockout(picks: QualifierPick[], participants: Participant[]): Participant[] {
  const byId = new Map(participants.map(p => [p.id, p]));
  const rankOf = new Map(picks.map(q => [q.participantId, q.groupRank]));
  const ptsOf = new Map(picks.map(q => [q.participantId, q.points]));
  const diffOf = new Map(picks.map(q => [q.participantId, q.diff]));
  const arr = picks.map(q => byId.get(q.participantId)!).filter(Boolean);
  arr.sort((a, b) =>
    (rankOf.get(a.id) ?? 99) - (rankOf.get(b.id) ?? 99) ||
    (ptsOf.get(b.id) ?? 0) - (ptsOf.get(a.id) ?? 0) ||
    (diffOf.get(b.id) ?? 0) - (diffOf.get(a.id) ?? 0) ||
    (a.seed ?? 9999) - (b.seed ?? 9999) ||
    a.name.localeCompare(b.name));
  // interleave halves for 1vN: [1st, last, 2nd, last-1, ...]
  const out: Participant[] = [];
  let lo = 0, hi = arr.length - 1, flip = true;
  while (lo <= hi) { out.push(flip ? arr[lo++] : arr[hi--]); flip = !flip; }
  return out;
}

export function describeFormat(f: string): string {
  const m: Record<string, string> = {
    'single-elimination': 'Single elimination', 'double-elimination': 'Double elimination',
    'round-robin': 'Round robin', 'swiss': 'Swiss', 'groups-knockout': 'Groups + knockout',
    'league': 'League season', 'team-match': 'Team match event',
    'individual-match': 'Individual match event', 'custom': 'Custom',
  };
  return m[f] ?? f;
}
