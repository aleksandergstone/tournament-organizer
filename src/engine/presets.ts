// Starting points: a named, explained set of rules the organizer picks instead
// of filling in fields they may not understand.
//
// A preset is *only* the settings that matter for its format — it never touches
// points in a bracket or rounds in a league. `applyPreset` merges into the
// current rules, so a preset chosen in the wizard is still visible (and
// switchable) on the Rules screen.
import { CompetitionFormat, RuleSet } from './types';
import type { Dict } from '../i18n';

export type PresetLevel = 'simple' | 'medium' | 'advanced';

export interface Preset {
  id: string;
  format: CompetitionFormat;
  label: keyof Dict;
  /** What it does, in one sentence. */
  what: keyof Dict;
  /** Why someone would choose it over the other presets. */
  why: keyof Dict;
  /** How many participants it fits. */
  fits: keyof Dict;
  /** What the app will generate. */
  generates: keyof Dict;
  /** The settings that matter most in this preset. */
  matters: keyof Dict;
  level: PresetLevel;
  rules: Partial<RuleSet>;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'quick-knockout', format: 'single-elimination',
    label: 'preset.quickKnockout.label',
    what: 'preset.quickKnockout.what', why: 'preset.quickKnockout.why', fits: 'preset.quickKnockout.fits',
    generates: 'preset.quickKnockout.generates', matters: 'preset.quickKnockout.matters',
    level: 'simple',
    rules: { seeding: 'seeded', allowDraws: false, overtimeAllowed: true },
  },
  {
    id: 'unseeded-knockout', format: 'single-elimination',
    label: 'preset.unseededKnockout.label',
    what: 'preset.unseededKnockout.what', why: 'preset.unseededKnockout.why', fits: 'preset.unseededKnockout.fits',
    generates: 'preset.unseededKnockout.generates', matters: 'preset.unseededKnockout.matters',
    level: 'simple',
    rules: { seeding: 'random', allowDraws: false, overtimeAllowed: true },
  },
  {
    id: 'fair-double', format: 'double-elimination',
    label: 'preset.fairDouble.label',
    what: 'preset.fairDouble.what', why: 'preset.fairDouble.why', fits: 'preset.fairDouble.fits',
    generates: 'preset.fairDouble.generates', matters: 'preset.fairDouble.matters',
    level: 'medium',
    rules: { seeding: 'seeded', allowDraws: false, overtimeAllowed: true },
  },
  {
    id: 'everyone-plays', format: 'round-robin',
    label: 'preset.everyonePlays.label',
    what: 'preset.everyonePlays.what', why: 'preset.everyonePlays.why', fits: 'preset.everyonePlays.fits',
    generates: 'preset.everyonePlays.generates', matters: 'preset.everyonePlays.matters',
    level: 'simple',
    rules: { seeding: 'seeded', homeAway: false, allowDraws: true, tiebreakOrder: ['points', 'wins', 'diff', 'scored'] },
  },
  {
    id: 'groups-playoffs', format: 'groups-knockout',
    label: 'preset.groupsPlayoffs.label',
    what: 'preset.groupsPlayoffs.what', why: 'preset.groupsPlayoffs.why', fits: 'preset.groupsPlayoffs.fits',
    generates: 'preset.groupsPlayoffs.generates', matters: 'preset.groupsPlayoffs.matters',
    level: 'medium',
    rules: { groupCount: 2, advancePerGroup: 2, seeding: 'seeded', allowDraws: true },
  },
  {
    id: 'four-groups', format: 'groups-knockout',
    label: 'preset.fourGroups.label',
    what: 'preset.fourGroups.what', why: 'preset.fourGroups.why', fits: 'preset.fourGroups.fits',
    generates: 'preset.fourGroups.generates', matters: 'preset.fourGroups.matters',
    level: 'medium',
    rules: { groupCount: 4, advancePerGroup: 2, seeding: 'seeded', allowDraws: true },
  },
  {
    id: 'season-league', format: 'league',
    label: 'preset.seasonLeague.label',
    what: 'preset.seasonLeague.what', why: 'preset.seasonLeague.why', fits: 'preset.seasonLeague.fits',
    generates: 'preset.seasonLeague.generates', matters: 'preset.seasonLeague.matters',
    level: 'medium',
    rules: { homeAway: true, allowDraws: true, tiebreakOrder: ['points', 'diff', 'scored', 'wins'] },
  },
  {
    id: 'match-list', format: 'team-match',
    label: 'preset.matchList.label',
    what: 'preset.matchList.what', why: 'preset.matchList.why', fits: 'preset.matchList.fits',
    generates: 'preset.matchList.generates', matters: 'preset.matchList.matters',
    level: 'simple',
    rules: { homeAway: false, allowDraws: true, tiebreakOrder: ['points', 'wins', 'diff', 'scored'] },
  },
  {
    id: 'individual-list', format: 'individual-match',
    label: 'preset.individualList.label',
    what: 'preset.individualList.what', why: 'preset.individualList.why', fits: 'preset.individualList.fits',
    generates: 'preset.individualList.generates', matters: 'preset.individualList.matters',
    level: 'simple',
    rules: { homeAway: false, allowDraws: true, tiebreakOrder: ['points', 'wins', 'diff', 'scored'] },
  },
  {
    id: 'advanced-custom', format: 'custom',
    label: 'preset.advancedCustom.label',
    what: 'preset.advancedCustom.what', why: 'preset.advancedCustom.why', fits: 'preset.advancedCustom.fits',
    generates: 'preset.advancedCustom.generates', matters: 'preset.advancedCustom.matters',
    level: 'advanced',
    rules: { seeding: 'manual', homeAway: false, allowDraws: true, tiebreakOrder: ['points', 'wins', 'diff', 'scored', 'seed'] },
  },
  {
    id: 'everyone-plays-twice', format: 'round-robin',
    label: 'preset.everyoneTwice.label',
    what: 'preset.everyoneTwice.what', why: 'preset.everyoneTwice.why', fits: 'preset.everyoneTwice.fits',
    generates: 'preset.everyoneTwice.generates', matters: 'preset.everyoneTwice.matters',
    level: 'medium',
    rules: { seeding: 'seeded', homeAway: true, allowDraws: true, tiebreakOrder: ['points', 'wins', 'diff', 'scored'] },
  },
  {
    id: 'swiss-large', format: 'swiss',
    label: 'preset.swissLarge.label',
    what: 'preset.swissLarge.what', why: 'preset.swissLarge.why', fits: 'preset.swissLarge.fits',
    generates: 'preset.swissLarge.generates', matters: 'preset.swissLarge.matters',
    level: 'medium',
    rules: { swissRounds: 5, byePoints: 3, allowDraws: true, tiebreakOrder: ['points', 'buchholz', 'wins', 'diff'] },
  },
  {
    id: 'fleet-standard', format: 'fleet-racing',
    label: 'preset.fleetStandard.label',
    what: 'preset.fleetStandard.what', why: 'preset.fleetStandard.why', fits: 'preset.fleetStandard.fits',
    generates: 'preset.fleetStandard.generates', matters: 'preset.fleetStandard.matters',
    level: 'simple',
    rules: { scheduledRaces: 6, minRacesForSeries: 1, scoringSystem: 'low-point' },
  },
  {
    id: 'fleet-olympic', format: 'fleet-racing',
    label: 'preset.fleetOlympic.label',
    what: 'preset.fleetOlympic.what', why: 'preset.fleetOlympic.why', fits: 'preset.fleetOlympic.fits',
    generates: 'preset.fleetOlympic.generates', matters: 'preset.fleetOlympic.matters',
    level: 'medium',
    rules: { scheduledRaces: 10, minRacesForSeries: 4, scoringSystem: 'low-point' },
  },
  {
    id: 'match-racing-standard', format: 'match-racing',
    label: 'preset.matchRacingStandard.label',
    what: 'preset.matchRacingStandard.what', why: 'preset.matchRacingStandard.why', fits: 'preset.matchRacingStandard.fits',
    generates: 'preset.matchRacingStandard.generates', matters: 'preset.matchRacingStandard.matters',
    level: 'medium',
    rules: { allowDraws: false, scheduledRaces: 3, minRacesForSeries: 1, scoringSystem: 'low-point' },
  },
  {
    id: 'team-racing-standard', format: 'team-racing',
    label: 'preset.teamRacingStandard.label',
    what: 'preset.teamRacingStandard.what', why: 'preset.teamRacingStandard.why', fits: 'preset.teamRacingStandard.fits',
    generates: 'preset.teamRacingStandard.generates', matters: 'preset.teamRacingStandard.matters',
    level: 'medium',
    rules: { allowDraws: false, scheduledRaces: 6, minRacesForSeries: 1, scoringSystem: 'low-point' },
  },
  {
    id: 'round-robin-standard', format: 'round-robin',
    label: 'preset.roundRobinStandard.label',
    what: 'preset.roundRobinStandard.what', why: 'preset.roundRobinStandard.why', fits: 'preset.roundRobinStandard.fits',
    generates: 'preset.roundRobinStandard.generates', matters: 'preset.roundRobinStandard.matters',
    level: 'simple',
    rules: { scheduledRaces: 6, minRacesForSeries: 1, scoringSystem: 'low-point' },
  },
  {
    id: 'knockout-standard', format: 'knockout',
    label: 'preset.knockoutStandard.label',
    what: 'preset.knockoutStandard.what', why: 'preset.knockoutStandard.why', fits: 'preset.knockoutStandard.fits',
    generates: 'preset.knockoutStandard.generates', matters: 'preset.knockoutStandard.matters',
    level: 'simple',
    rules: { scheduledRaces: 4, minRacesForSeries: 1, scoringSystem: 'low-point' },
  },
  {
    id: 'group-stage-finals-standard', format: 'group-stage-finals',
    label: 'preset.groupStageFinalsStandard.label',
    what: 'preset.groupStageFinalsStandard.what', why: 'preset.groupStageFinalsStandard.why', fits: 'preset.groupStageFinalsStandard.fits',
    generates: 'preset.groupStageFinalsStandard.generates', matters: 'preset.groupStageFinalsStandard.matters',
    level: 'medium',
    rules: { scheduledRaces: 8, minRacesForSeries: 2, scoringSystem: 'low-point', groupCount: 4, advancePerGroup: 2 },
  },
  {
    id: 'flighted-racing-standard', format: 'flighted-racing',
    label: 'preset.flightedRacingStandard.label',
    what: 'preset.flightedRacingStandard.what', why: 'preset.flightedRacingStandard.why', fits: 'preset.flightedRacingStandard.fits',
    generates: 'preset.flightedRacingStandard.generates', matters: 'preset.flightedRacingStandard.matters',
    level: 'medium',
    rules: { scheduledRaces: 6, minRacesForSeries: 1, scoringSystem: 'low-point', useFlights: true, fleetAssignment: 'seeded' },
  },
  {
    id: 'medal-race-standard', format: 'medal-race',
    label: 'preset.medalRaceStandard.label',
    what: 'preset.medalRaceStandard.what', why: 'preset.medalRaceStandard.why', fits: 'preset.medalRaceStandard.fits',
    generates: 'preset.medalRaceStandard.generates', matters: 'preset.medalRaceStandard.matters',
    level: 'medium',
    rules: { scheduledRaces: 8, minRacesForSeries: 2, scoringSystem: 'low-point', medalRace: { enabled: true, qualifiedCount: 10, doublePoints: true, countsInSeries: true } },
  },
  {
    id: 'custom-regatta-standard', format: 'custom-regatta',
    label: 'preset.customRegattaStandard.label',
    what: 'preset.customRegattaStandard.what', why: 'preset.customRegattaStandard.why', fits: 'preset.customRegattaStandard.fits',
    generates: 'preset.customRegattaStandard.generates', matters: 'preset.customRegattaStandard.matters',
    level: 'advanced',
    rules: { scheduledRaces: 10, minRacesForSeries: 3, scoringSystem: 'custom', useFlights: true },
  },
];

const BY_FORMAT = new Map<CompetitionFormat, Preset[]>();
for (const p of PRESETS) {
  const list = BY_FORMAT.get(p.format) ?? [];
  list.push(p);
  BY_FORMAT.set(p.format, list);
}

/** The presets offered for a format, in the order they should be shown. */
export function presetsFor(format: string): Preset[] {
  return BY_FORMAT.get(format as CompetitionFormat) ?? [];
}

export function presetById(id: string): Preset | null {
  return PRESETS.find(p => p.id === id) ?? null;
}

/**
 * Merges a preset's settings into the current rules. Only the keys the preset
 * defines are touched, so applying one never silently wipes something else the
 * organizer set on purpose.
 */
export function applyPreset(rules: RuleSet, preset: Preset): RuleSet {
  return { ...rules, ...preset.rules };
}

/**
 * Which preset matches these rules — used to show "in use" in the picker. With a
 * single preset for a format it always matches; otherwise the first preset whose
 * settings all equal the current ones wins, and no match is a valid answer.
 */
export function activePresetId(format: string, rules: RuleSet): string | null {
  const list = presetsFor(format);
  if (list.length === 1) return list[0].id;
  for (const p of list) {
    const hit = Object.entries(p.rules).every(([k, v]) =>
      JSON.stringify(rules[k as keyof RuleSet]) === JSON.stringify(v));
    if (hit) return p.id;
  }
  return null;
}

