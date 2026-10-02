// Seasons — several tournaments, one classification.
//
// A season is not a second database. It is a tag on a tournament plus a pure
// calculation over the projects the app already holds: two tournaments share a
// season when their `season.id` matches. Nothing is copied between files, so
// editing a tournament changes the season table the next time it is computed —
// there is no stale duplicate to reconcile.
//
// Only *finished* events award points, so a half-played tournament can never
// move the league.
import { Match, ProjectFile, SeasonRef } from './types';
import { computeStandings } from './standings';
import { knockoutPlaces } from './bracket-view';
import { hasPointTable } from './generate';

/** Season points by finishing place, 1-based. Beyond the list: nothing. */
export const SEASON_POINTS: readonly number[] = [10, 8, 6, 5, 4, 3, 2, 1];

export function pointsForPlace(place: number): number {
  return place >= 1 && place <= SEASON_POINTS.length ? SEASON_POINTS[place - 1] : 0;
}

const FINISHED: ReadonlySet<string> = new Set(['played', 'draw', 'walkover', 'overtime']);

/** A tournament that has played out: at least one real match, all decided. */
export function isComplete(matches: Match[]): boolean {
  const real = matches.filter(m => m.result.status !== 'bye');
  return real.length > 0 && real.every(m => FINISHED.has(m.result.status));
}

export interface FinalPlace { participantId: string; name: string; place: number; }

/** The final order of one tournament: 1-based places, ties already resolved. */
export function finalPlaces(file: ProjectFile): FinalPlace[] {
  const { tournament, participants, matches } = file;
  const nameOf = new Map(participants.map(p => [p.id, p.name]));
  if (hasPointTable(tournament.format)) {
    return computeStandings(participants, matches, tournament.rules)
      .map(r => ({ participantId: r.participantId, name: nameOf.get(r.participantId) ?? '?', place: r.rank }));
  }
  // A bracket is decided by who survived, not by points.
  const ko = matches.filter(m => !m.groupId);
  // knockoutPlaces() asks for a name by id and accepts an unknown one, so the
  // lookup has to tolerate a missing entry as well as a missing id.
  const places = knockoutPlaces(ko, id => (id ? nameOf.get(id) ?? '' : ''));
  return places.map(p => {
    const hit = participants.find(x => x.name === p.name);
    return { participantId: hit?.id ?? p.name, name: p.name, place: p.place };
  });
}

export interface SeasonRow {
  key: string;
  name: string;
  /** Tournaments in which this competitor finished and earned points. */
  events: number;
  points: number;
  /** Best single finish (1 = won an event). */
  best: number;
  rank: number;
}

export interface SeasonTable {
  id: string;
  name: string;
  /** Every tournament tagged with this season, newest first. */
  events: ProjectFile[];
  /** Only the tournaments that actually counted. */
  counted: number;
  rows: SeasonRow[];
}

/** The season a file is tagged with, or null. */
export function seasonOf(file: ProjectFile): SeasonRef | null {
  const s = file.tournament.season;
  if (!s || typeof s.id !== 'string' || !s.id.trim()) return null;
  return { id: s.id.trim(), name: (s.name || s.id).trim() };
}

/** Every season present in a set of projects, most-tagged first. */
export function seasonsIn(files: ProjectFile[]): { id: string; name: string; count: number }[] {
  const acc = new Map<string, { id: string; name: string; count: number }>();
  for (const f of files) {
    const s = seasonOf(f);
    if (!s) continue;
    const hit = acc.get(s.id);
    if (hit) hit.count += 1;
    else acc.set(s.id, { id: s.id, name: s.name, count: 1 });
  }
  return [...acc.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function buildSeason(
  files: ProjectFile[], id: string, name: string, opts?: { requireComplete?: boolean },
): SeasonTable {
  const requireComplete = opts?.requireComplete !== false;
  const events = files
    .filter(f => seasonOf(f)?.id === id)
    .sort((a, b) => (b.tournament.dates?.start ?? b.tournament.createdAt)
      .localeCompare(a.tournament.dates?.start ?? a.tournament.createdAt));
  const counted = requireComplete ? events.filter(f => isComplete(f.matches)) : events;
  const acc = new Map<string, SeasonRow>();
  for (const f of counted) {
    for (const p of finalPlaces(f)) {
      const key = p.name.trim().toLowerCase();
      if (!key) continue;
      const row = acc.get(key) ?? { key, name: p.name.trim(), events: 0, points: 0, best: Number.POSITIVE_INFINITY, rank: 0 };
      row.events += 1;
      row.points += pointsForPlace(p.place);
      row.best = Math.min(row.best, p.place);
      acc.set(key, row);
    }
  }
  const rows = [...acc.values()].sort((a, b) =>
    b.points - a.points || b.events - a.events || a.best - b.best || a.name.localeCompare(b.name));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { id, name, events, counted: counted.length, rows };
}
