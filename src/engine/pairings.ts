import { Group, Match, Participant, RuleSet, Tournament, uid } from './types';
import { t } from '../i18n';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function orderParticipants(ps: Participant[], rules: RuleSet): Participant[] {
  const arr = [...ps];
  if (rules.seeding === 'random') {
    const r = rng(42);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  if (rules.seeding === 'seeded') {
    return arr.sort((a, b) =>
      (a.seed ?? 9999) - (b.seed ?? 9999) ||
      (b.rating ?? 0) - (a.rating ?? 0) ||
      a.name.localeCompare(b.name));
  }
  return arr;
}

export function mkMatch(round: number, roundName: string, homeId: string | null, awayId: string | null, groupId: string | null = null): Match {
  const bye = homeId === null || awayId === null;
  return {
    id: uid('m'), round, roundName, groupId, homeId, awayId,
    result: bye
      ? { homeScore: null, awayScore: null, winnerId: homeId ?? awayId, status: 'bye' }
      : { homeScore: null, awayScore: null, winnerId: null, status: 'scheduled' },
  };
}

export function nextPow2(n: number): number {
  if (n <= 1) return 1;
  let p = 1; while (p < n) p *= 2; return p;
}

export function decidedLoser(m: Match): string | null {
  const r = m.result;
  if (r.status === 'scheduled' || r.status === 'unfinished' || r.status === 'interrupted') return null;
  if (r.status === 'bye') return null; // bye has no loser
  if (r.status === 'walkover') {
    const w = r.walkoverWinnerId ?? r.winnerId;
    if (!w) return null;
    if (m.homeId === w) return m.awayId;
    if (m.awayId === w) return m.homeId;
    return null;
  }
  if (r.status === 'draw') return null; // draws have no loser — caller must handle (elim draws invalid)
  const w = r.winnerId;
  if (w && m.homeId === w) return m.awayId;
  if (w && m.awayId === w) return m.homeId;
  // score fallback
  if (r.homeScore !== null && r.awayScore !== null && m.homeId && m.awayId) {
    if (r.homeScore > r.awayScore) return m.awayId;
    if (r.awayScore > r.homeScore) return m.homeId;
  }
  return null;
}

export function decidedWinner(m: Match): string | null {
  const r = m.result;
  if (r.status === 'bye') return r.winnerId ?? m.homeId ?? m.awayId ?? null;
  if (r.status === 'walkover') return r.walkoverWinnerId ?? r.winnerId ?? null;
  return r.winnerId;
}

export function roundNameElim(r: number, total: number): string {
  const rem = total - r + 1;
  if (rem === 1) return t('round.final');
  if (rem === 2) return t('round.semi');
  if (rem === 3) return t('round.quarter');
  return t('round.of', { n: Math.pow(2, rem) });
}
