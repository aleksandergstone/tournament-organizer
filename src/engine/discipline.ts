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
import type { CompetitionFormat, ResourceKind, RuleSet } from './types';
import { presetById, type Preset } from './presets';

export type DisciplineId =
  | 'generic' | 'volleyball' | 'football' | 'table-tennis'
  | 'chess' | 'badminton' | 'basketball' | 'darts' | 'sailing';

/**
 * One way this sport is usually played, described by the preset it loads.
 *
 * A template is a *pointer*, not a copy: it names a preset in `presets.ts`, whose
 * wording is already written and translated in every language. That is what keeps
 * the two layers from drifting, and it means adding a discipline never means
 * writing a second catalogue.
 */
export interface DisciplineTemplate {
  /** The template's own name, drawn from the preset it loads. */
  label: keyof Dict;
  /** The format this template switches to, when it implies one. */
  format: CompetitionFormat;
  /** The preset whose rules this template loads. */
  preset: Preset;
  /** Rules this sport adds on top of that preset. */
  overrides: Partial<RuleSet>;
}

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
  /**
   * The presets this sport is normally played with, most common first. Empty
   * means "no opinion": the generic discipline offers every preset of whatever
   * format is selected, which is the neutral behaviour the app had before
   * disciplines existed.
   */
  templates?: readonly string[];
  /**
   * One line on how this sport is usually run, shown above the templates. It
   * frames the list rather than replacing the preset descriptions: what a
   * template *does* is already said by the preset it loads, and duplicating
   * that here is how two catalogues drift apart.
   */
  hint: keyof Dict;
}

export const DISCIPLINES: readonly Discipline[] = [
  {
    id: 'generic',
    label: 'disc.generic',
    hint: 'disc.hint.generic',
    venue: 'disc.venue.place', venueKind: 'court',
    participant: 'doc.player', competing: 'individual',
    match: 'disc.match.match',
    defaults: {},
  },
  {
    id: 'volleyball',
    label: 'disc.volleyball',
    hint: 'disc.hint.volleyball',
    venue: 'disc.venue.court', venueKind: 'court',
    participant: 'doc.team', competing: 'team',
    match: 'disc.match.set',
    // No draws, and the match is decided by sets (25 points, two clear).
    defaults: { allowDraws: false, overtimeAllowed: false, periodPoints: 25, periodsToWin: 3, winByTwo: true },
    // A friendly match, a school tournament, a group stage, then a league.
    templates: ['quick-knockout', 'groups-playoffs', 'four-groups', 'season-league'],
  },
  {
    id: 'football',
    label: 'disc.football',
    hint: 'disc.hint.football',
    venue: 'disc.venue.pitch', venueKind: 'court',
    participant: 'doc.team', competing: 'team',
    match: 'disc.match.match',
    defaults: {
      allowDraws: true, winPoints: 3, drawPoints: 1, lossPoints: 0,
      drawResolution: 'penalty', overtimeAllowed: true,
      periodPoints: 0, periodsToWin: 1,
      tiebreakOrder: ['points', 'wins', 'diff', 'scored'],
    },
    // A league, a mini tournament, a group stage, and a two-leg return.
    templates: ['season-league', 'groups-playoffs', 'everyone-plays', 'everyone-plays-twice'],
  },
  {
    id: 'table-tennis',
    label: 'disc.tableTennis',
    hint: 'disc.hint.tableTennis',
    venue: 'disc.venue.table', venueKind: 'table',
    participant: 'doc.player', competing: 'individual',
    match: 'disc.match.set',
    defaults: { allowDraws: false, overtimeAllowed: false, periodPoints: 11, periodsToWin: 3, winByTwo: true },
    // A club league, a Swiss tournament, a straight knockout.
    templates: ['season-league', 'swiss-large', 'quick-knockout', 'individual-list'],
  },
  {
    id: 'chess',
    label: 'disc.chess',
    hint: 'disc.hint.chess',
    venue: 'disc.venue.table', venueKind: 'table',
    participant: 'doc.player', competing: 'individual',
    match: 'disc.match.game',
    defaults: {
      allowDraws: true, winPoints: 1, drawPoints: 0.5, lossPoints: 0,
      periodPoints: 0, periodsToWin: 1,
      tiebreakOrder: ['points', 'buchholz', 'wins', 'seed', 'name'],
    },
    // Swiss is how chess tournaments are actually run; round robin and knockout
    // are the other two the brief asks for.
    templates: ['swiss-large', 'everyone-plays', 'quick-knockout', 'season-league'],
  },
  {
    id: 'badminton',
    label: 'disc.badminton',
    hint: 'disc.hint.badminton',
    venue: 'disc.venue.racket', venueKind: 'court',
    participant: 'doc.player', competing: 'individual',
    match: 'disc.match.set',
    defaults: { allowDraws: false, overtimeAllowed: false, periodPoints: 21, periodsToWin: 2, winByTwo: true },
    // A club event, a tournament with groups, and a knockout.
    templates: ['match-list', 'groups-playoffs', 'quick-knockout', 'season-league'],
  },
  {
    id: 'basketball',
    label: 'disc.basketball',
    hint: 'disc.hint.basketball',
    venue: 'disc.venue.court', venueKind: 'court',
    participant: 'doc.team', competing: 'team',
    match: 'disc.match.quarter',
    defaults: {
      allowDraws: false, winPoints: 2, drawPoints: 0, lossPoints: 1, overtimeAllowed: true,
      periodPoints: 0, periodsToWin: 1,
      tiebreakOrder: ['points', 'wins', 'diff', 'scored'],
    },
    templates: ['match-list', 'quick-knockout', 'groups-playoffs', 'season-league'],
  },
  {
    id: 'darts',
    label: 'disc.darts',
    hint: 'disc.hint.darts',
    venue: 'disc.venue.board', venueKind: 'board',
    participant: 'doc.player', competing: 'individual',
    match: 'disc.match.leg',
    defaults: { allowDraws: false, overtimeAllowed: false, periodPoints: 0, periodsToWin: 1 },
    // Legs are the unit here, so a list of matches and a Swiss run both fit.
    templates: ['match-list', 'individual-list', 'swiss-large', 'quick-knockout'],
  },
  {
    id: 'sailing',
    label: 'disc.sailing',
    hint: 'disc.hint.sailing',
    venue: 'disc.venue.start', venueKind: 'lane',
    participant: 'doc.crew', competing: 'team',
    match: 'disc.match.race',
    defaults: {
      // No draw between boats: a race is decided by its result. Ranking comes
      // from wins and the margin, which is what a regatta result sheet shows.
      allowDraws: false, winPoints: 2, drawPoints: 0, lossPoints: 1, overtimeAllowed: false,
      periodPoints: 0, periodsToWin: 1,
      tiebreakOrder: ['points', 'wins', 'diff', 'scored'],
    },
    // A fleet racing each other once, a scheduled start list, and a series.
    templates: ['everyone-plays', 'match-list', 'everyone-plays-twice', 'season-league'],
  },
];

/**
 * One line naming the rules this sport sets by default.
 *
 * Built from the discipline's own `defaults` rather than written out per template:
 * the numbers are already the single source of truth, so a sport that changes its
 * point values updates this line by itself instead of drifting from it.
 */
export function templateDefaultsLine(d: Discipline, t: (k: keyof Dict) => string): string | null {
  const r = d.defaults;
  const parts: string[] = [];
  if (r.periodPoints) parts.push(t('disc.def.setPoints').replace('{n}', String(r.periodPoints)));
  if (r.periodsToWin && r.periodsToWin > 1) parts.push(t('disc.def.setsToWin').replace('{n}', String(r.periodsToWin)));
  if (r.winByTwo) parts.push(t('disc.def.winByTwo'));
  if (r.winPoints !== undefined && r.drawPoints !== undefined) {
    parts.push(t('disc.def.points').replace('{w}', String(r.winPoints)).replace('{d}', String(r.drawPoints)));
  }
  if (r.tiebreakOrder?.length) parts.push(t('disc.def.tiebreak'));
  parts.push(r.allowDraws === false ? t('disc.def.noDraw') : t('disc.def.draw'));
  return parts.join(', ');
}

const GENERIC = DISCIPLINES[0];

/**
 * The templates this discipline offers, in the order they should be shown.
 *
 * A template is the preset it points at plus whatever this sport adds on top. An
 * id that no longer resolves is skipped rather than throwing: a stale entry in
 * the catalogue must degrade to one fewer template, never to a blank screen.
 */
export function templatesFor(id?: string | null): DisciplineTemplate[] {
  const d = disciplineById(id);
  // No discipline chosen means no opinion: the neutral behaviour is every preset
  // of the selected format, which the caller already knows.
  if (!d || !d.templates) return [];
  const out: DisciplineTemplate[] = [];
  for (const presetId of d.templates) {
    const preset = presetById(presetId);
    if (preset) out.push({ label: preset.label, format: preset.format, preset, overrides: {} });
  }
  return out;
}

/**
 * Loads a template into the current rules. Merging, never replacing: a template
 * is a starting point, so anything the organizer set on purpose survives.
 */
export function applyTemplate(rules: RuleSet, template: DisciplineTemplate): RuleSet {
  return { ...rules, ...template.preset.rules, ...template.overrides };
}

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

