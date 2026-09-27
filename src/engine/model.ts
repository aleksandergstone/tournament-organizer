import { AuditEntry, Group, Match, Participant, Tournament, VenueResource, nowIso, uid } from './types';
// Optional `resources` (venue scheduling, added after v1.0) — old project files
// simply omit it; every consumer uses `resourcesOf(domain)`.
export interface Domain { tournament: Tournament; participants: Participant[]; groups: Group[]; matches: Match[]; audit: AuditEntry[]; resources?: VenueResource[]; }
export function resourcesOf(d: { resources?: VenueResource[] }): VenueResource[] { return d.resources ?? []; }
export function blankTournament(): Tournament {
  return { id: uid('t'), name: '', sport: 'Football', individualOrTeam: 'team', format: 'single-elimination', participantCountExpected: null, dates: { start: null, end: null }, location: '', visibility: 'private',
  rules: { winPoints: 3, drawPoints: 1, lossPoints: 0, allowDraws: true, tiebreakOrder: ['points','wins','diff','scored','seed','name'], walkoverWinnerPoints: 3, overtimeAllowed: false, seeding: 'seeded', groupCount: 2, advancePerGroup: 2, homeAway: false, swissRounds: 5, byePoints: 3 },
  createdAt: nowIso(), updatedAt: nowIso(), archived: false };
}
