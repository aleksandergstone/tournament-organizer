import { Match, MatchResult, MatchStatus, RuleSet } from './types';
import { t } from '../i18n';
import { validateMatch } from './validate';
import { recomputeBracket, stampVs } from './recompute';

// Single choke-point for ALL result edits (UI + tests + import).
// Returns { matches, issues } — never throws for user data.
// - validates (scores, walkover winner, draws allowed, elim draws rejected)
// - stamps occupant tag so recompute can detect stale downstream results
// - runs full deterministic bracket recompute (no stale links)
export interface EditSpec {
  homeScore?: number | null;
  awayScore?: number | null;
  status?: MatchStatus;
  walkoverWinnerId?: string | null;
  note?: string;
  clearScores?: boolean;
}

export function recordResult(
  matches: Match[], matchId: string, spec: EditSpec, rules: RuleSet,
  opts?: { knockout?: boolean }
): { matches: Match[]; issues: string[] } {
  const m = matches.find(x => x.id === matchId);
  if (!m) return { matches, issues: [t('engine.matchNotFound')] };
  if (m.result.status === 'bye' && (spec.status ?? 'bye') === 'bye') {
    return { matches, issues: [t('engine.bye')] };
  }
  let r: MatchResult = { ...m.result };
  if (spec.homeScore !== undefined) r.homeScore = spec.homeScore;
  if (spec.awayScore !== undefined) r.awayScore = spec.awayScore;
  if (spec.status !== undefined) r.status = spec.status;
  if (spec.walkoverWinnerId !== undefined) r.walkoverWinnerId = spec.walkoverWinnerId;
  if (spec.note !== undefined) r.note = spec.note;
  if (spec.clearScores || r.status === 'scheduled' || r.status === 'unfinished' || r.status === 'interrupted') {
    if (spec.homeScore === undefined) r.homeScore = null;
    if (spec.awayScore === undefined) r.awayScore = null;
    if (r.status === 'scheduled' || r.status === 'unfinished' || r.status === 'interrupted') r.winnerId = null;
    if (r.status === 'scheduled') { r.walkoverWinnerId = null; r.overtime = false; }
  }
  if (r.status === 'walkover') {
    const w = r.walkoverWinnerId ?? r.winnerId ?? m.homeId;
    r.walkoverWinnerId = w ?? null;
    r.winnerId = w ?? null;
  }
  if (r.status === 'played' || r.status === 'overtime' || r.status === 'draw') {
    const hs = r.homeScore ?? 0, as = r.awayScore ?? 0;
    if (r.status === 'draw') {
      // An explicit draw: only meaningful where the mode allows one.
      if (opts?.knockout) {
        const rule = rules.drawResolution ?? 'none';
        if (rule === 'none' || !rules.allowDraws) return { matches, issues: [knockoutMsg(m.roundName)] };
        if (rule === 'overtime') return { matches, issues: [t('engine.drawOvertime')] };
      } else if (!rules.allowDraws) {
        return { matches, issues: [knockoutMsg(m.roundName)] };
      }
      r.winnerId = null;
    }
    else if (hs === as) {
      // A level score. In a bracket it can only be accepted when the mode has a
      // rule for it, and even then the match stays undecided: the winner has to
      // come from extra time, a replay or a decider, never from the draw itself.
      if (!rules.allowDraws) return { matches, issues: [knockoutMsg(m.roundName)] };
      if (opts?.knockout) {
        const rule = rules.drawResolution ?? 'none';
        if (rule === 'none') return { matches, issues: [knockoutMsg(m.roundName)] };
        if (rule === 'overtime') return { matches, issues: [t('engine.drawOvertime')] };
      }
      r.winnerId = null;
      r.status = 'draw';
    }
    else r.winnerId = hs > as ? m.homeId : m.awayId;
    if (r.status === 'overtime') r.overtime = true;
  }
  if ((r.homeScore ?? 0) < 0 || (r.awayScore ?? 0) < 0)
    return { matches, issues: [t('engine.negativeScores')] };
  const probe: Match = { ...m, result: r };
  const v = validateMatch(probe);
  // knockout draws already handled above; surface remaining validation softly
  const hard = v.filter(i => i.field === 'score' || i.field === 'walkover');
  if (hard.length) return { matches, issues: hard.map(i => i.message) };
  r = stampVs(r, m.homeId, m.awayId);
  // Stamp the edit time: LAN sync resolves conflicting results by newest edit.
  const next = matches.map(x => (x.id === matchId
    ? { ...x, result: r, modifiedAt: new Date().toISOString() }
    : x));
  return { matches: recomputeBracket(next), issues: [] };
}

function knockoutMsg(roundName: string): string {
  return t('engine.noDraw', { round: roundName });
}

// Recompute helper for non-result structural changes (withdrawal, seeding,
// rules). Withdrawn occupants are ejected: any manual/unplayed match with a
// withdrawn side becomes walkover for the opponent; played history is kept.
export function applyWithdrawals(
  matches: Match[], withdrawnIds: Set<string>
): { matches: Match[]; changed: number } {
  let changed = 0;
  const next = matches.map(m => {
    if (withdrawnIds.size === 0) return m;
    const w = m.homeId && withdrawnIds.has(m.homeId) ? m.homeId : m.awayId && withdrawnIds.has(m.awayId) ? m.awayId : null;
    if (!w) return m;
    if (m.result.status === 'played' || m.result.status === 'draw' || m.result.status === 'overtime' || m.result.status === 'walkover') return m; // history stands
    const survivor = m.homeId === w ? m.awayId : m.homeId;
    changed++;
    return {
      ...m,
      result: stampVs({
        homeScore: null, awayScore: null, winnerId: survivor,
        status: 'walkover', walkoverWinnerId: survivor,
        note: tagNote(m.result.note, 'withdrawal'),
      }, m.homeId, m.awayId),
    };
  });
  return { matches: recomputeBracket(next), changed };
}

function tagNote(note: string | undefined, tag: string): string {
  if (!note) return `[${tag}]`;
  return note.includes(tag) ? note : `${note} [${tag}]`;
}
