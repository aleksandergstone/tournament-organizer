import { Match, MatchResult } from './types';
import { decidedWinner, decidedLoser } from './pairings';
import { GF_ROUND, GF_RESET_ROUND } from './double';

// Deterministic full recompute of derived bracket slots.
// Rules:
//  - Manual slots (round-1 / RR fixtures) are never touched.
//  - Every derived slot resolves from its srcHome/srcAway links:
//    w:<id> = winner of <id> (only when that match is decided), l:<id> = loser.
//  - A derived match keeps its entered result ONLY if both current occupants
//    equal the occupants present when the result was recorded (tracked via
//    result.note tag "vs:H|A"). Otherwise the stale result is cleared to
//    scheduled/TBD — never silently preserved.
//  - Grand Final Reset activates only when the L-side wins GF1; otherwise it
//    stays a TBD placeholder and is excluded from standings (no occupants).
//  - LB rematch guard (best-effort, deterministic): after resolving a losers
//    match whose occupants both come from decided WB matches, if the pairing
//    repeats a WB meeting already recorded in `wbHistory`, and the two matches
//    are still undecided, swap the away occupant with the next losers match in
//    the same round when that swap eliminates both rematches. Structural links
//    (srcHome/srcAway) are NOT rewritten — the swap is applied to occupants
//    only for display/pairing; provenance stays intact for future recomputes.
// Never throws; unknown ids resolve to TBD.
export function recomputeBracket(matches: Match[]): Match[] {
  const byId = new Map(matches.map(m => [m.id, m]));
  const decided = (id: string): string | null => {
    const m = byId.get(id);
    return m ? decidedWinner(m) : null;
  };
  const lost = (id: string): string | null => {
    const m = byId.get(id);
    return m ? decidedLoser(m) : null;
  };
  const resolveSrc = (s: { w?: string; l?: string; seed?: string | null } | null | undefined): string | null => {
    if (!s) return null;
    if (s.w) return decided(s.w);
    if (s.l) return lost(s.l);
    if ('seed' in s) return s.seed ?? null;
    return null;
  };
  for (const m of matches) {
    const b = m.bracket;
    if (!b || b.manual) continue;
    if (b.kind === 'final' && m.round === GF_RESET_ROUND) {
      resolveReset(m, byId);
      continue;
    }
    const h = resolveSrc(b.srcHome);
    const a = resolveSrc(b.srcAway);
    setDerivedSlot(m, h, a);
  }
  guardLosersRematches(matches, byId);
  return matches;
}

// Best-effort deterministic LB rematch guard. Only swaps the away source link
// (srcAway) between two undecided losers matches in the same round when the
// swap strictly reduces the number of repeated WB pairings. Swapping the LINK
// (not just the occupant) is essential: recompute re-resolves occupants from
// srcHome/srcAway on every pass, so an occupants-only swap would be reverted
// and any result stamped against it cleared — an infinite play/clear loop.
// Never touches decided matches, never drops a link (both matches keep valid
// provenance), never throws. Idempotent: once swapped the condition cannot
// fire again (swapping back would increase the rematch count).
function guardLosersRematches(matches: Match[], byId: Map<string, Match>): void {
  const wbPairs = new Set<string>();
  for (const m of matches) {
    if (m.bracket?.kind !== 'winners' || !m.homeId || !m.awayId) continue;
    if (m.result.status === 'scheduled' || m.result.status === 'unfinished' || m.result.status === 'interrupted') continue;
    wbPairs.add(pairKey(m.homeId, m.awayId));
  }
  if (wbPairs.size === 0) return;
  const rounds = new Map<number, Match[]>();
  for (const m of matches) {
    if (m.bracket?.kind !== 'losers') continue;
    if (!rounds.has(m.round)) rounds.set(m.round, []);
    rounds.get(m.round)!.push(m);
  }
  for (const group of rounds.values()) {
    const open = group.filter(m =>
      m.homeId && m.awayId && (m.result.status === 'scheduled'));
    for (let i = 0; i < open.length; i++) {
      for (let j = i + 1; j < open.length; j++) {
        const A = open[i], B = open[j];
        if (!A.homeId || !A.awayId || !B.homeId || !B.awayId) continue;
        const before = (wbPairs.has(pairKey(A.homeId, A.awayId)) ? 1 : 0) +
          (wbPairs.has(pairKey(B.homeId, B.awayId)) ? 1 : 0);
        if (before === 0) continue;
        const after = (wbPairs.has(pairKey(A.homeId, B.awayId)) ? 1 : 0) +
          (wbPairs.has(pairKey(B.homeId, A.awayId)) ? 1 : 0);
        if (after < before) {
          // Swap the away SOURCE LINKS and the resolved away occupants
          // together so both stay consistent for this pass; next recompute
          // re-resolves the same swapped occupants from the swapped links.
          const tmpSrc = A.bracket?.srcAway ?? null;
          const tmpOcc = A.awayId;
          if (A.bracket) A.bracket.srcAway = B.bracket?.srcAway ?? null;
          if (B.bracket) B.bracket.srcAway = tmpSrc;
          A.awayId = B.awayId; B.awayId = tmpOcc;
        }
      }
    }
  }
  void byId;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}~${b}` : `${b}~${a}`;
}

function setDerivedSlot(m: Match, h: string | null, a: string | null): void {
  m.homeId = h; m.awayId = a;
  if (h === null || a === null) {
    // TBD: never keep a decided result, and never auto-award a 'bye' win for
    // a derived slot — bye auto-advance applies only to generation-time
    // manual byes. A single occupant waits as scheduled.
    m.result = { homeScore: null, awayScore: null, winnerId: null, status: 'scheduled' };
    return;
  }
  if (m.result.status === 'bye') {
    // Derived matches are created by mkMatch(null,null) as a placeholder
    // 'bye'. When both sources resolve before any play (e.g. two W1 byes
    // meeting in W2 for non-power-of-two fields) the placeholder must become
    // a real scheduled match — a derived match is never a bye, and leaving
    // it 'bye' would auto-advance a player with winnerId still null while
    // decidedLoser() returns null for every l: feed downstream.
    m.result = { homeScore: null, awayScore: null, winnerId: null, status: 'scheduled' };
    return;
  }
  // both occupants known: keep entered result only if pairing unchanged
  const tag = vsTag(m.result);
  if (m.result.status !== 'scheduled' && tag !== `${h}|${a}` && tag !== null) {
    m.result = { homeScore: null, awayScore: null, winnerId: null, status: 'scheduled' };
  }
  void 0;
}

function resolveReset(reset: Match, byId: Map<string, Match>): void {
  const gf = [...byId.values()].find(m => m.round === GF_ROUND);
  if (!gf) { reset.homeId = reset.awayId = null; reset.result = { homeScore: null, awayScore: null, winnerId: null, status: 'scheduled' }; return; }
  const w = decidedWinner(gf);
  if (!w) { reset.homeId = reset.awayId = null; reset.result = { homeScore: null, awayScore: null, winnerId: null, status: 'scheduled' }; return; }
  // GF srcHome = W-champion side, srcAway = L-champion side.
  const wSrc = gf.bracket?.srcHome?.w ? byId.get(gf.bracket.srcHome.w) : undefined;
  const wSide = wSrc ? decidedWinner(wSrc) : null;
  if (w === wSide) {
    // W-side won: tournament over, reset stays dormant.
    reset.homeId = reset.awayId = null; reset.result = { homeScore: null, awayScore: null, winnerId: null, status: 'scheduled' };
  } else {
    // L-side won GF1: same two finalists replay.
    reset.homeId = gf.homeId; reset.awayId = gf.awayId;
    const tag = vsTag(reset.result);
    if (reset.result.status !== 'scheduled' && tag !== `${reset.homeId}|${reset.awayId}` && tag !== null) {
      reset.result = { homeScore: null, awayScore: null, winnerId: null, status: 'scheduled' };
    }
  }
}

function byeOrTbd(h: string | null, aq: string | null): MatchResult {
  if (h === null && aq === null) return { homeScore: null, awayScore: null, winnerId: null, status: 'scheduled' };
  return { homeScore: null, awayScore: null, winnerId: h ?? aq, status: 'bye' };
}

// Occupant tag: stamped on results at entry time (see recordResult) so we can
// tell whether a stored result belongs to the current pairing.
export function vsTag(r: MatchResult): string | null {
  const m = /vs:([^|]*)\|([^\s]*)/.exec(r.note ?? '');
  return m ? `${m[1]}|${m[2]}` : null;
}
export function stampVs(r: MatchResult, h: string | null, a: string | null): MatchResult {
  const rest = (r.note ?? '').replace(/\s*vs:[^|\s]*\|[^\s]*/, '').trim();
  const tag = `vs:${h ?? ''}|${a ?? ''}`;
  return { ...r, note: (rest ? rest + ' ' : '') + tag };
}
