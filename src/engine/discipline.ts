// The discipline layer — the one place that makes the app speak each sport's
// language.
//
// A discipline does exactly three things, and nothing else:
//   1. it names the three things every competition has — a place, a competitor
//      and a match (a set, a leg, a quarter…),
//   2. it supplies a starting rule set,
//   3. it narrows the preset list (see `presetsFor`).
//
// It never changes a technical value. A place stays `court`/`table`/`station`
// internally and inside QR deep links; only the label on screen and on paper
// varies. That is what keeps the neutral wording of the rest of the app and the
// sport-specific wording of the wizard from fighting each other.
//
// Pure data + label lookups. No DOM, no I/O.
import { t } from '../i18n';
import type { Dict } from '../i18n';
import type { ResourceKind, RuleSet } from './types';

export type DisciplineId =
  | 'generic' | 'volleyball' | 'football' | 'table-tennis'
  | 'chess' | 'badminton' | 'basketball' | 'darts';

export interface Discipline {
  id: DisciplineId;
  /** Name of the discipline itself. */
  label: keyof Dict;
  /** What one place is called here: pitch, court, table, board… */
  venue: keyof Dict;
  /** Technical kind a newly added place gets by default. */
  venueKind: ResourceKind;
  /** What one competitor is called here. */
  participant: keyof Dict;
  /** Whether competitors are teams or individuals. */
  competing: 'individual' | 'team';
  /** What one match is called here. */
  match: keyof Dict;
  /** Starting rules — merged into the current rules when chosen. */
  defaults: Partial<RuleSet>;
}

export const DISCIPLINES: readonly Discipline[] = [
  {
    id: 'generic',
    label: 'disc.generic',
    venue: 'disc.venue.place', venueKind: 'court',
    participant: 'doc.player', competing: 'individual',
    match: 'disc.match.match',
    defaults: {},
  },
  {
    id: 'volleyball',
    label: 'disc.volleyball',
    venue: 'disc.venue.court', venueKind: 'court',
    participant: 'doc.team', competing: 'team',
    match: 'disc.match.set',
    // No draws, and the match is decided by sets (25 points, two clear).
    defaults: { allowDraws: false, overtimeAllowed: false, periodPoints: 25, periodsToWin: 3, winByTwo: true },
  },
  {
    id: 'football',
    label: 'disc.football',
    venue: 'disc.venue.pitch', venueKind: 'court',
    participant: 'doc.team', competing: 'team',
    match: 'disc.match.match',
    defaults: {
      allowDraws: true, winPoints: 3, drawPoints: 1, lossPoints: 0,
      drawResolution: 'penalty', overtimeAllowed: true,
      periodPoints: 0, periodsToWin: 1,
      tiebreakOrder: ['points', 'wins', 'diff', 'scored'],
    },
  },
  {
    id: 'table-tennis',
    label: 'disc.tableTennis',
    venue: 'disc.venue.table', venueKind: 'table',
    participant: 'doc.player', competing: 'individual',
    match: 'disc.match.set',
    defaults: { allowDraws: false, overtimeAllowed: false, periodPoints: 11, periodsToWin: 3, winByTwo: true },
  },
  {
    id: 'chess',
    label: 'disc.chess',
    venue: 'disc.venue.table', venueKind: 'table',
    participant: 'doc.player', competing: 'individual',
    match: 'disc.match.game',
    defaults: {
      allowDraws: true, winPoints: 1, drawPoints: 0.5, lossPoints: 0,
      periodPoints: 0, periodsToWin: 1,
      tiebreakOrder: ['points', 'buchholz', 'wins', 'seed', 'name'],
    },
  },
  {
    id: 'badminton',
    label: 'disc.badminton',
    venue: 'disc.venue.racket', venueKind: 'court',
    participant: 'doc.player', competing: 'individual',
    match: 'disc.match.set',
    defaults: { allowDraws: false, overtimeAllowed: false, periodPoints: 21, periodsToWin: 2, winByTwo: true },
  },
  {
    id: 'basketball',
    label: 'disc.basketball',
    venue: 'disc.venue.court', venueKind: 'court',
    participant: 'doc.team', competing: 'team',
    match: 'disc.match.quarter',
    defaults: {
      allowDraws: false, winPoints: 2, drawPoints: 0, lossPoints: 1, overtimeAllowed: true,
      periodPoints: 0, periodsToWin: 1,
      tiebreakOrder: ['points', 'wins', 'diff', 'scored'],
    },
  },
  {
    id: 'darts',
    label: 'disc.darts',
    venue: 'disc.venue.board', venueKind: 'board',
    participant: 'doc.player', competing: 'individual',
    match: 'disc.match.leg',
    defaults: { allowDraws: false, overtimeAllowed: false, periodPoints: 0, periodsToWin: 1 },
  },
];

const GENERIC = DISCIPLINES[0];

export function disciplineById(id?: string | null): Discipline | null {
  if (!id) return null;
  return DISCIPLINES.find(d => d.id === id) ?? null;
}

/** The discipline of a tournament, or the neutral one when none was chosen. */
export function disciplineOf(tour: { discipline?: string | null }): Discipline {
  return disciplineById(tour.discipline) ?? GENERIC;
}

export function isGeneric(tour: { discipline?: string | null }): boolean {
  return disciplineOf(tour).id === 'generic';
}

/**
 * Applies a discipline: vocabulary, competitor kind and starting rules. Passing
 * `null` clears the choice and leaves the rules untouched.
 */
export function applyDiscipline<T extends {
  discipline?: string | null; rules: RuleSet; individualOrTeam: 'individual' | 'team';
}>(tour: T, id: DisciplineId | null): T {
  const d = disciplineById(id);
  if (!d) return { ...tour, discipline: null };
  return {
    ...tour,
    discipline: d.id,
    rules: { ...tour.rules, ...d.defaults },
    individualOrTeam: d.competing,
  };
}

// ---- Labels -------------------------------------------------------------
// Every screen and every printed sheet asks *these* functions, so the vocabulary
// can never drift between the UI, the PDF and the public display.

/** What a place is called in this event: "Pitch", "Table", "Court"… */
export function venueLabel(tour: { discipline?: string | null }): string {
  return t(disciplineOf(tour).venue);
}

/** What a competitor is called: "Team", "Player"… */
export function participantLabel(tour: { discipline?: string | null; individualOrTeam?: 'individual' | 'team' }): string {
  const d = disciplineOf(tour);
  if (d.id !== 'generic') return t(d.participant);
  return t(tour.individualOrTeam === 'team' ? 'doc.team' : 'doc.player');
}

/** What one match is called: "Match", "Set", "Leg", "Quarter"… */
export function matchLabel(tour: { discipline?: string | null }): string {
  return t(disciplineOf(tour).match);
}

