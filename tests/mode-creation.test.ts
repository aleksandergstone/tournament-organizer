// Guided mode creation: the catalogue, the presets, the visibility rules, the
// structure preview, the setup validation and the summary.
//
// These are the guarantees the wizard and the rules screen are built on, so
// they are asserted against the same modules the screens import — and the
// preview numbers are checked against the real generators, because a preview
// that disagrees with the tournament it promises is worse than no preview.
import { describe, it, expect } from 'vitest';
import {
  MODES, ALL_GROUPS, SETTING_FIELDS, modeOf, settingGroupsFor, visibleGroups,
  hiddenGroups, visibleFields, showsField, fieldStatus, fieldEffect, specFor,
  groupPlan, inertFields, labelOfField, adaptRulesToFormat, previewStructure, validateModeSetup,
  summaryRows, glossaryFor, PICKER_GROUPS, modesInGroup, pickerGroupTitle,
  stagePlan, manualSteps, previewWarning, fieldsByStatus, notApplicableFields,
  requiredFields,
  PREVIEW_SAMPLE,
} from '../src/engine/mode-info';
import { PRESETS, presetsFor, presetById, applyPreset, activePresetId } from '../src/engine/presets';
import { validateTournament } from '../src/engine/validate';
import { recordResult } from '../src/engine/result';
import { genSingleElim } from '../src/engine/elim';
import { genDoubleElim } from '../src/engine/double';
import { genRoundRobin, genLeague, genGroupsKnockout } from '../src/engine/generate';
import { DEFAULT_RULES, type Participant, type RuleSet } from '../src/engine/types';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { de } from '../src/i18n/de';
import { es } from '../src/i18n/es';
import { translate } from '../src/i18n';

const ALL_FORMATS = MODES.map(m => m.format);
const players = (n: number): Participant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i + 1}`, kind: 'player', active: true, seed: i + 1 }));
const rules = (patch: Partial<RuleSet> = {}): RuleSet => ({ ...DEFAULT_RULES, ...patch });
const rowValue = (p: ReturnType<typeof previewStructure>, key: string) =>
  p.rows.find(r => r.key === key)?.value;
/** Rows with two opponents: matches somebody actually plays. */
const playable = (ms: { homeId: string | null; awayId: string | null }[]) =>
  ms.filter(m => m.homeId && m.awayId).length;
/** Rows with one opponent: a free pass, not a match. */
const freePasses = (ms: { homeId: string | null; awayId: string | null }[]) =>
  ms.filter(m => (m.homeId === null) !== (m.awayId === null)).length;
/** Rows with two empty slots: a later round still waiting for a result. */
const waiting = (ms: { homeId: string | null; awayId: string | null }[]) =>
  ms.filter(m => !m.homeId && !m.awayId).length;

describe('mode catalogue', () => {
  it('describes all nine modes', () => {
    expect(ALL_FORMATS).toEqual([
      'single-elimination', 'double-elimination', 'groups-knockout', 'round-robin',
      'swiss', 'league', 'team-match', 'individual-match', 'custom',
    ]);
  });

  it('gives every mode a meaning, an example, a use case and a limit — in words', () => {
    for (const m of MODES) {
      for (const key of [m.meaning, m.example, m.goodFor, m.notIncluded]) {
        const text = en[key];
        expect(text, String(key)).toBeTruthy();
        // A missing translation shows the key itself; real copy never does.
        expect(translate('en', key), String(key)).not.toBe(key);
        expect(text.length, String(key)).toBeGreaterThan(12);
      }
      // The four lines must be four different thoughts, not one sentence reused.
      const lines = new Set([m.meaning, m.example, m.goodFor, m.notIncluded].map(k => en[k]));
      expect(lines.size, m.format).toBe(4);
    }
  });

  it('explains every mode in every language', () => {
    for (const loc of ['en', 'pl', 'de', 'es'] as const) {
      for (const m of MODES) {
        for (const key of [m.meaning, m.example, m.goodFor, m.notIncluded]) {
          expect(translate(loc, key), `${key} in ${loc}`).not.toBe(key);
        }
      }
    }
  });

  it('says what a bracket does not include, so nobody expects a table', () => {
    for (const f of ['single-elimination', 'double-elimination'] as const) {
      const m = modeOf(f);
      expect(m.bracket).toBe(true);
      expect(m.points).toBe(false);
      expect(en[m.notIncluded]).toMatch(/no points|no league table/i);
    }
  });

  it('frames Swiss as score pairing with no early elimination', () => {
    const m = modeOf('swiss');

describe('which settings a mode shows', () => {
  it('gives a bracket only what settles a match, plus points kept for reports', () => {
    for (const f of ['single-elimination', 'double-elimination'] as const) {
      expect(visibleGroups(f)).toEqual(['seeding', 'draws', 'reporting']);
      expect(visibleFields(f)).toEqual([
        'seeding', 'overtimeAllowed', 'allowDraws', 'drawResolution',
        'winPoints', 'drawPoints', 'lossPoints', 'walkoverWinnerPoints',
      ]);
    }
  });

  it('shows points in a bracket only as reporting, never as progression', () => {
    for (const f of ['single-elimination', 'double-elimination'] as const) {
      for (const field of ['winPoints', 'drawPoints', 'lossPoints', 'walkoverWinnerPoints'] as const) {
        expect(fieldStatus(f, field), `${f}.${field}`).toBe('reporting');
        expect(fieldEffect(f, field), `${f}.${field}`).toBe('reporting');
      }
      // No tie-break, no table: a bracket is not ranked by points.
      expect(showsField(f, 'tiebreakOrder'), f).toBe(false);
      const keys = summaryRows(f, rules({ allowDraws: false })).map(r => r.key);
      expect(keys).toContain('mode.sum.reporting');
      expect(keys).not.toContain('mode.sum.points');
      expect(keys).not.toContain('mode.sum.tiebreak');
    }
  });

  it('shows points and tie-breaks as primary logic where a table is produced', () => {
    for (const f of ['round-robin', 'swiss', 'league', 'groups-knockout', 'team-match', 'individual-match'] as const) {
      expect(showsField(f, 'winPoints'), f).toBe(true);
      expect(showsField(f, 'tiebreakOrder'), f).toBe(true);
      expect(fieldStatus(f, 'winPoints'), f).toBe('required');
      expect(fieldEffect(f, 'winPoints'), f).toBe('ranking');
      expect(fieldStatus(f, 'tiebreakOrder'), f).toBe('required');
      expect(fieldEffect(f, 'tiebreakOrder'), f).toBe('tie-break');
      // A level match is a final result here, so there is no decider to choose.
      expect(showsField(f, 'drawResolution'), f).toBe(false);
    }
  });

  it('gives each mode only its own structure settings', () => {
    expect(visibleGroups('swiss')).toEqual(['scoring', 'draws', 'tiebreak', 'rounds', 'byes']);
    expect(visibleGroups('league')).toEqual(['scoring', 'draws', 'tiebreak', 'seeding', 'meeting']);
    expect(visibleGroups('groups-knockout')).toEqual(['scoring', 'draws', 'tiebreak', 'seeding', 'groups']);
    expect(showsField('swiss', 'groupCount')).toBe(false);
    expect(showsField('swiss', 'homeAway')).toBe(false);
    expect(showsField('league', 'swissRounds')).toBe(false);
    expect(showsField('single-elimination', 'byePoints')).toBe(false);
    expect(showsField('round-robin', 'drawResolution')).toBe(false);
  });

  it('keeps the rest of the rules reachable as advanced settings', () => {
    for (const m of MODES) {
      const shown = new Set(visibleGroups(m.format));
      const hidden = hiddenGroups(m.format);
      for (const g of hidden) expect(shown.has(g), `${m.format}.${g}`).toBe(false);
      // Nothing is lost: visible + hidden is the whole catalogue.
      expect([...shown, ...hidden].sort()).toEqual([...ALL_GROUPS].sort());
    }
    // Every mode except Custom has something to tuck away; Custom shows it all
    // on purpose, which is what makes it the flexible one.
    for (const m of MODES) {
      if (m.format === 'custom') expect(hiddenGroups(m.format)).toEqual([]);
      else expect(hiddenGroups(m.format).length, m.format).toBeGreaterThan(0);
    }
  });

  it('maps every group to at least one rule and every rule to a group', () => {
    for (const g of ALL_GROUPS) expect(SETTING_FIELDS[g].length, g).toBeGreaterThan(0);
    const mapped = new Set(ALL_GROUPS.flatMap(g => [...SETTING_FIELDS[g]]));
    for (const m of MODES) {
      for (const f of settingGroupsFor(m.format).flatMap(g => [...SETTING_FIELDS[g]])) {
        expect(mapped.has(f), `${m.format}.${f}`).toBe(true);
      }
    }
  });
});

describe('presets', () => {
  it('offers at least one preset for every mode', () => {
    for (const f of ALL_FORMATS) expect(presetsFor(f).length, f).toBeGreaterThan(0);
  });

  it('answers the four questions on every card', () => {
    for (const p of PRESETS) {
      expect(en[p.label], p.id).toBeTruthy();
      for (const key of [p.what, p.why, p.fits, p.generates, p.matters]) {
        expect(translate('en', key), `${key} (${p.id})`).not.toBe(key);
        expect(en[key].length, key).toBeGreaterThan(10);
      }
      expect(['simple', 'medium', 'advanced']).toContain(p.level);
      expect(presetById(p.id), p.id).toBe(p);
    }
  });

  it('uses unique ids', () => {
    expect(new Set(PRESETS.map(p => p.id)).size).toBe(PRESETS.length);
  });

  it('only sets settings the mode actually shows', () => {
    for (const p of PRESETS) {
      for (const field of Object.keys(p.rules)) {
        expect(showsField(p.format, field as keyof RuleSet), `${p.id} sets ${field}`).toBe(true);
      }
    }
  });

  it('merges into the current rules without wiping anything else', () => {
    const current = rules({ groupCount: 4, swissRounds: 7, homeAway: true });
    const merged = applyPreset(current, presetById('quick-knockout')!);
    expect(merged.seeding).toBe('seeded');
    expect(merged.groupCount).toBe(4);
    expect(merged.swissRounds).toBe(7);
    expect(merged.homeAway).toBe(true);
  });

  it('recognises the preset in use, and no preset when the rules are someone else', () => {
    const quick = presetById('quick-knockout')!;
    expect(activePresetId('single-elimination', applyPreset(rules(), quick))).toBe('quick-knockout');
    expect(activePresetId('single-elimination', applyPreset(rules(), presetById('unseeded-knockout')!))).toBe('unseeded-knockout');
    expect(activePresetId('single-elimination', rules({ seeding: 'manual' }))).toBeNull();
  });

  it('shows a single-preset mode as always in use', () => {
    const single = ALL_FORMATS.filter(f => presetsFor(f).length === 1);
    expect(single.length).toBeGreaterThan(0);
    for (const f of single) expect(activePresetId(f, rules())).toBe(presetsFor(f)[0].id);
  });
});

    expect(m.bracket).toBe(false);
    expect(m.points).toBe(true);
    expect(en[m.meaning]).toMatch(/same score/i);
    expect(en[m.meaning]).toMatch(/nobody is knocked out/i);
  });

  it('frames groups + knockout as two stages', () => {
    const m = modeOf('groups-knockout');
    expect(m.bracket).toBe(true);
    expect(m.points).toBe(true);
    expect(en[m.notIncluded]).toMatch(/after the groups/i);
    expect(en[m.example]).toMatch(/reach/i);
  });

  it('falls back to the custom description for an unknown format', () => {
    expect(modeOf('nonsense')).toEqual(modeOf('custom'));
    expect(visibleGroups('nonsense')).toEqual(visibleGroups('custom'));
  });

  it('offers every mode in exactly one picker group', () => {
    const picked = PICKER_GROUPS.flatMap(modesInGroup);
    // Grouped by intent, so the picker order is not the catalogue order.
    expect([...picked.map(m => m.format)].sort()).toEqual([...ALL_FORMATS].sort());
    for (const g of PICKER_GROUPS) {
      expect(translate('en', pickerGroupTitle(g))).not.toBe(pickerGroupTitle(g));
    }
  });
});


// ---- the preview has to agree with the generators -------------------------

describe('structure preview', () => {
  it('counts every mode exactly the way its generator builds it', () => {
    const cases: [string, (ps: Participant[], r: RuleSet) => { homeId: string | null; awayId: string | null }[]][] = [
      ['single-elimination', (ps, r) => genSingleElim(ps, r).matches],
      ['double-elimination', (ps, r) => genDoubleElim(ps, r).matches],
      ['round-robin', (ps, r) => genRoundRobin(ps, r)],
      ['league', (ps, r) => genLeague(ps, r)],
      ['groups-knockout', (ps, r) => genGroupsKnockout(ps, r).matches],
      ['custom', (ps, r) => genRoundRobin(ps, r)],
    ];
    for (const [format, gen] of cases) {
      for (const n of [4, 5, 6, 7, 8, 12]) {
        const r = rules();
        const p = previewStructure(format, n, r);
        const real = gen(players(n), r);
        expect(p.matches, `${format} ${n}`).toBe(playable(real) + waiting(real));
        expect(p.byes, `${format} ${n} byes`).toBe(freePasses(real));
        expect(p.matches + p.byes, `${format} ${n} total`).toBe(real.length);
      }
    }
  });

  it('counts a Swiss round from the real pairer and plans the rest', () => {
    const r = rules({ swissRounds: 5 });
    const p = previewStructure('swiss', 16, r);
    expect(p.matches).toBe(8);
    expect(p.later).toBe(32);
    expect(rowValue(p, 'preview.roundsPlanned')).toBe('5');
    expect(rowValue(p, 'preview.matchesPerRound')).toBe('8');
    expect(rowValue(p, 'preview.matchesTotal')).toBe('40');
    // Swiss is paired from the standings, so later rounds are not built now.
    expect(p.notes).toContain('preview.noteSwiss');
    expect(p.notes).not.toContain('preview.noteSwissBye');
  });

  it('says a bye appears when the Swiss field is odd', () => {
    const p = previewStructure('swiss', 15, rules({ swissRounds: 5 }));
    expect(p.byes).toBe(1);
    expect(p.notes).toContain('preview.noteSwissBye');
  });

  it('pads a bracket to a power of two and shows the free passes', () => {
    const even = previewStructure('single-elimination', 8, rules());
    const six = previewStructure('single-elimination', 6, rules());
    expect(even.matches).toBe(7);
    expect(even.byes).toBe(0);
    expect(six.matches).toBe(5);
    expect(rowValue(six, 'preview.byes')).toBe('2');
    expect(rowValue(six, 'preview.rounds')).toBe('3');
    expect(even.notes).not.toContain('preview.noteByes');
    expect(six.notes).toContain('preview.noteByes');
  });

  it('keeps a double-elimination plan honest about the reset', () => {
    const p = previewStructure('double-elimination', 8, rules());
    expect(p.matches).toBe(15);
    expect(p.notes).toContain('preview.noteReset');
    expect(rowValue(p, 'preview.grandFinal')).toBe('1');
  });

  it('splits groups and holds the knockout back until the groups are done', () => {
    const r = rules({ groupCount: 2, advancePerGroup: 2 });
    const p = previewStructure('groups-knockout', 12, r);
    expect(rowValue(p, 'preview.groupSizes')).toBe('6 / 6');
    expect(rowValue(p, 'preview.groupMatches')).toBe('30');
    expect(rowValue(p, 'preview.qualifiers')).toBe('4');
    expect(p.matches).toBe(30);
    expect(p.later).toBe(3);
    expect(p.notes).toContain('preview.noteGroupsKo');
  });

  it('handles an uneven field of groups', () => {
    const p = previewStructure('groups-knockout', 10, rules({ groupCount: 4, advancePerGroup: 2 }));
    expect(rowValue(p, 'preview.groupSizes')).toBe('3 / 3 / 2 / 2');
    // Three real pairings per group of three, one per group of two.
    expect(p.matches).toBe(8);
    expect(p.byes).toBe(6);
  });

  it('counts home & away as twice the meetings', () => {
    const once = previewStructure('round-robin', 6, rules({ homeAway: false }));
    const twice = previewStructure('round-robin', 6, rules({ homeAway: true }));
    expect(once.matches).toBe(15);
    expect(twice.matches).toBe(30);
    expect(twice.later).toBe(0);
  });

  it('labels a sample preview instead of pretending it is exact', () => {
    const p = previewStructure('round-robin', null, rules());
    expect(p.assumed).toBe(true);
    expect(p.count).toBe(PREVIEW_SAMPLE);
    const exact = previewStructure('round-robin', 6, rules());
    expect(exact.assumed).toBe(false);
    expect(exact.count).toBe(6);
    expect(exact.matches).not.toBe(p.matches);
  });

  it('tells the organizer what custom really generates', () => {
    const p = previewStructure('custom', 8, rules());
    expect(p.notes).toContain('preview.noteCustom');
    expect(p.matches).toBe(playable(genRoundRobin(players(8), rules())));
  });
});


// ---- telling the organizer when the rules do not add up -------------------

describe('setup validation', () => {
  const fields = (issues: { field: string }[]) => issues.map(i => i.field);

  it('says nothing about a sensible setup', () => {
    expect(validateModeSetup('groups-knockout', rules({ groupCount: 2, advancePerGroup: 2 }), 12)).toEqual([]);
    expect(validateModeSetup('swiss', rules({ swissRounds: 5 }), 16)).toEqual([]);
    expect(validateModeSetup('single-elimination', rules({ allowDraws: false }), 8)).toEqual([]);
    expect(validateModeSetup('double-elimination', rules({ allowDraws: false }), 8)).toEqual([]);
    expect(validateModeSetup('league', rules(), 10)).toEqual([]);
    expect(validateModeSetup('round-robin', rules(), 8)).toEqual([]);
  });

  it('needs two groups, and teams left behind in each one', () => {
    expect(fields(validateModeSetup('groups-knockout', rules({ groupCount: 1, advancePerGroup: 2 }), 12))).toContain('groupCount');
    expect(fields(validateModeSetup('groups-knockout', rules({ groupCount: 4, advancePerGroup: 2 }), 6))).toContain('groupCount');
    expect(fields(validateModeSetup('groups-knockout', rules({ groupCount: 2, advancePerGroup: 3 }), 4))).toContain('advancePerGroup');
    expect(fields(validateModeSetup('groups-knockout', rules({ groupCount: 2, advancePerGroup: 0 }), 12))).toContain('advancePerGroup');
  });

  it('rejects a Swiss plan with more rounds than opponents', () => {
    expect(fields(validateModeSetup('swiss', rules({ swissRounds: 0 }), 16))).toContain('swissRounds');
    expect(fields(validateModeSetup('swiss', rules({ swissRounds: 9 }), 8))).toContain('swissRounds');
    // One round per opponent is still fine.
    expect(validateModeSetup('swiss', rules({ swissRounds: 7 }), 8)).toEqual([]);
  });

  it('warns before a round robin becomes unmanageable', () => {
    expect(fields(validateModeSetup('round-robin', rules({ homeAway: false }), 40))).toContain('homeAway');
    expect(validateModeSetup('round-robin', rules({ homeAway: false }), 20)).toEqual([]);
  });

  it('points a two-team league at custom instead', () => {
    expect(fields(validateModeSetup('league', rules(), 2))).toContain('format');
  });

  it('stays quiet when the field size is not known yet', () => {
    expect(validateModeSetup('groups-knockout', rules({ groupCount: 9, advancePerGroup: 2 }), null)).toEqual([]);
    expect(validateModeSetup('swiss', rules({ swissRounds: 40 }), undefined)).toEqual([]);
  });

  it('reaches the tournament save check', () => {
    const bad = validateTournament({
      name: 'Cup', sport: 'Football', format: 'swiss',
      rules: rules({ swissRounds: 9 }), participantCountExpected: 8,
    });
    expect(fields(bad)).toContain('swissRounds');
  });
});

// ---- the summary says what will happen, and nothing more ------------------

describe('setup summary', () => {
  it('lists only the rules the mode uses', () => {
    const keys = summaryRows('league', rules()).map(r => r.key);
    expect(keys).toContain('mode.sum.points');
    expect(keys).toContain('mode.sum.tiebreak');
    expect(keys).toContain('mode.sum.meeting');
    expect(keys).not.toContain('mode.sum.groups');
    expect(keys).not.toContain('mode.sum.rounds');
  });

  it('fills the numbers in, not just the labels', () => {
    const rows = summaryRows('groups-knockout', rules({ groupCount: 4, advancePerGroup: 3 }), 16);
    const value = (k: string) => rows.find(r => r.key === k)?.value ?? '';
    expect(value('mode.sum.groupPlan')).toContain('4 / 4 / 4 / 4');
    expect(value('mode.sum.groupPlan')).toContain('3');
    expect(value('mode.sum.points')).toContain('3');
  });

  it('states who goes forward, in every mode', () => {
    for (const m of MODES) {
      const rows = summaryRows(m.format, rules({ allowDraws: false }));
      expect(rows[0].key, m.format).toBe('mode.sum.advances');
      expect(rows[0].value, m.format).toBe(translate('en', specFor(m.format).advancement.why));
      expect(rows[0].value.length, m.format).toBeGreaterThan(20);
    }
  });

  it('names the draw rule instead of a bare yes/no in a bracket', () => {
    const off = summaryRows('single-elimination', rules({ allowDraws: false }));
    expect(off.find(r => r.key === 'mode.sum.drawRule')?.value).toBe(translate('en', 'mode.draws.notAllowed'));
    for (const rule of ['overtime', 'replay', 'penalty', 'tiebreak'] as const) {
      const on = summaryRows('single-elimination', rules({ allowDraws: true, drawResolution: rule }));
      const value = on.find(r => r.key === 'mode.sum.drawRule')?.value ?? '';
      expect(value, rule).toContain(translate('en', `mode.resolution.${rule}`).slice(0, 12));
    }
    // A table just says yes or no, because a draw is a final result there.
    expect(summaryRows('league', rules({ allowDraws: true })).map(r => r.key)).toContain('mode.sum.draws');
  });

  it('names the tie-break order as an order', () => {
    const rows = summaryRows('round-robin', rules({ tiebreakOrder: ['wins', 'diff'] }));
    const value = rows.find(r => r.key === 'mode.sum.tiebreak')?.value ?? '';
    expect(value).toContain(translate('en', 'rules.tiebreak.wins'));
    expect(value.indexOf(translate('en', 'rules.tiebreak.wins')))
      .toBeLessThan(value.indexOf(translate('en', 'rules.tiebreak.diff')));
  });

  it('mentions overtime only when it is switched on', () => {
    expect(summaryRows('single-elimination', rules({ overtimeAllowed: false })).map(r => r.key))
      .not.toContain('mode.sum.overtime');
    expect(summaryRows('single-elimination', rules({ overtimeAllowed: true })).map(r => r.key))
      .toContain('mode.sum.overtime');
  });
});

describe('glossary', () => {
  it('explains the terms a mode actually uses', () => {
    expect(glossaryFor('single-elimination')).toContain('mode.term.bracket');
    expect(glossaryFor('groups-knockout')).toContain('mode.term.qualifier');
    expect(glossaryFor('double-elimination')).toContain('mode.term.doubleElim');
    expect(glossaryFor('swiss')).toContain('mode.term.scoreGroup');
  });

  it('never offers a league the word bracket', () => {
    expect(glossaryFor('league')).not.toContain('mode.term.bracket');
    expect(glossaryFor('round-robin')).not.toContain('mode.term.bracket');
  });

  it('splits every term into a word and an explanation', () => {
    for (const f of ALL_FORMATS) {
      for (const term of glossaryFor(f)) expect(en[term], term).toContain(' — ');
    }
  });
});

describe('draw rules are enforced, not just explained', () => {
  const fields = (i: { field: string }[]) => i.map(x => x.field);

  it('refuses a bracket that allows draws without a rule to settle them', () => {
    expect(fields(validateModeSetup('single-elimination', rules({ allowDraws: true, drawResolution: 'none' }), 8)))
      .toContain('drawResolution');
    expect(validateModeSetup('single-elimination', rules({ allowDraws: true, drawResolution: 'penalty' }), 8)).toEqual([]);
  });

  it('insists extra time exists when extra time is the rule', () => {
    const bad = rules({ allowDraws: true, drawResolution: 'overtime', overtimeAllowed: false });
    expect(fields(validateModeSetup('single-elimination', bad, 8))).toContain('overtimeAllowed');
    const good = rules({ allowDraws: true, drawResolution: 'overtime', overtimeAllowed: true });
    expect(validateModeSetup('single-elimination', good, 8)).toEqual([]);
  });

  it('never asks for a decider where a draw is a final result', () => {
    for (const f of ['round-robin', 'league', 'swiss', 'groups-knockout']) {
      expect(fields(validateModeSetup(f, rules({ allowDraws: true }), 12)), f).not.toContain('drawResolution');
    }
  });

  it('leaves a level match undecided when the bracket has a rule for it', () => {
    const r = rules({ allowDraws: true, drawResolution: 'replay' });
    const base = genSingleElim(players(4), r).matches;
    const out = recordResult(base, base[0].id, { homeScore: 1, awayScore: 1, status: 'played' }, r, { knockout: true });
    expect(out.issues).toEqual([]);
    const played = out.matches.find(m => m.id === base[0].id)!;
    expect(played.result.status).toBe('draw');
    expect(played.result.winnerId).toBeNull();
  });

  it('asks for the extra-time result instead of accepting a draw on it', () => {
    const r = rules({ allowDraws: true, drawResolution: 'overtime', overtimeAllowed: true });
    const base = genSingleElim(players(4), r).matches;
    const out = recordResult(base, base[0].id, { homeScore: 2, awayScore: 2, status: 'played' }, r, { knockout: true });
    expect(out.issues).toEqual([translate('en', 'engine.drawOvertime')]);
  });

  it('refuses a level match in a bracket that has no rule', () => {
    const r = rules({ allowDraws: false });
    const base = genSingleElim(players(4), r).matches;
    const out = recordResult(base, base[0].id, { homeScore: 1, awayScore: 1, status: 'played' }, r, { knockout: true });
    expect(out.issues.length).toBe(1);
  });

  it('still records a draw normally in a table', () => {
    const r = rules({ allowDraws: true });
    const base = genRoundRobin(players(4), r);
    const out = recordResult(base, base[0].id, { homeScore: 2, awayScore: 2, status: 'played' }, r);
    expect(out.issues).toEqual([]);
    expect(out.matches.find(m => m.id === base[0].id)!.result.status).toBe('draw');
  });
});

describe('changing the format', () => {
  it('closes draws in a bracket and opens them in a table, touching nothing else', () => {
    const current = rules({ winPoints: 2, tiebreakOrder: ['wins'], groupCount: 4 });
    const asBracket = { ...current, ...adaptRulesToFormat('single-elimination', current) };
    expect(asBracket.allowDraws).toBe(false);
    expect(asBracket.drawResolution).toBe('none');
    expect(asBracket.winPoints).toBe(2);
    expect(asBracket.tiebreakOrder).toEqual(['wins']);
    expect(asBracket.groupCount).toBe(4);
    const asTable = { ...current, ...adaptRulesToFormat('league', current) };
    expect(asTable.allowDraws).toBe(true);
  });

  it('leaves a fresh tournament valid in its default format', () => {
    const r = { ...DEFAULT_RULES, ...adaptRulesToFormat('single-elimination', DEFAULT_RULES) };
    expect(validateModeSetup('single-elimination', r, 8)).toEqual([]);
    expect(validateModeSetup('league', DEFAULT_RULES, 10)).toEqual([]);
  });
});

// ---- the rule layer: what each mode promises --------------------------------

const DICTS = { en, pl, de, es } as Record<string, Record<string, string>>;

describe('mode rules', () => {
  it('classifies every field it shows, and every word exists in all four languages', () => {
    for (const m of MODES) {
      for (const f of specFor(m.format).fields) {
        expect(['required', 'optional', 'advanced', 'reporting'], `${m.format}.${f.field}`).toContain(f.status);
        expect(['progression', 'ranking', 'tie-break', 'reporting', 'none'], `${m.format}.${f.field}`).toContain(f.affects);
        for (const loc of ['en', 'pl', 'de', 'es']) {
          expect(DICTS[loc][f.why], `${f.why} in ${loc}`).toBeTruthy();
        }
      }
    }
  });

  it('states points, draws, group size, advancement and structure for every mode', () => {
    for (const m of MODES) {
      const s = specFor(m.format);
      for (const key of [s.points.why, s.draws.why, s.groupSize.why, s.advancement.why, s.structure.contains, s.structure.excludes]) {
        expect(translate('en', key), String(key)).not.toBe(key);
        for (const loc of ['pl', 'de', 'es'] as const) expect(DICTS[loc][key], `${key} in ${loc}`).toBeTruthy();
      }
      expect(['bracket', 'table', 'rounds', 'fixtures'], m.format).toContain(s.advancement.kind);
      // Six different thoughts, not one sentence reused.
      const lines = new Set([s.points.why, s.draws.why, s.groupSize.why, s.advancement.why, s.structure.contains, s.structure.excludes]);
      expect(lines.size, m.format).toBe(6);
    }
  });

  it('reads an unknown format as the custom rules', () => {
    expect(specFor('nonsense').format).toBe('custom');
  });
});

describe('the exact mechanics of each mode', () => {
  it('single elimination: the match result advances, points are paperwork', () => {
    const s = specFor('single-elimination');
    expect(s.advancement.kind).toBe('bracket');
    expect(s.points).toMatchObject({ status: 'reporting', affects: 'reporting' });
    expect(s.draws.policy).toBe('requires-resolution');
    expect(s.draws.resolutions).toEqual(['overtime', 'replay', 'penalty', 'tiebreak']);
    expect(fieldEffect('single-elimination', 'seeding')).toBe('progression');
    expect(showsField('single-elimination', 'groupCount')).toBe(false);
    expect(showsField('single-elimination', 'swissRounds')).toBe(false);
    expect(showsField('single-elimination', 'tiebreakOrder')).toBe(false);
  });

  it('double elimination: the same bracket rules, and the reset is explained', () => {
    const s = specFor('double-elimination');
    expect(s.advancement.kind).toBe('bracket');
    expect(s.points.affects).toBe('reporting');
    expect(s.draws.policy).toBe('requires-resolution');
    expect(translate('en', 'preview.noteReset')).toContain('final');
    expect(previewStructure('double-elimination', 8, rules({ allowDraws: false })).notes).toContain('preview.noteReset');
  });

  it('round robin: points and draws are the engine', () => {
    const s = specFor('round-robin');
    expect(s.advancement.kind).toBe('table');
    expect(s.points).toMatchObject({ status: 'required', affects: 'ranking' });
    expect(s.draws.policy).toBe('allowed');
    expect(fieldStatus('round-robin', 'allowDraws')).toBe('required');
    // genRoundRobin builds a second half from this, so it is not powerless.
    expect(fieldEffect('round-robin', 'homeAway')).toBe('progression');
    expect(translate('en', s.draws.why)).toContain('draw points');
  });

  it('swiss: points drive pairing and ranking, the round count decides the length', () => {
    const s = specFor('swiss');
    expect(s.advancement.kind).toBe('rounds');
    expect(fieldStatus('swiss', 'swissRounds')).toBe('required');
    expect(fieldEffect('swiss', 'swissRounds')).toBe('progression');
    expect(fieldEffect('swiss', 'winPoints')).toBe('ranking');
    expect(fieldEffect('swiss', 'tiebreakOrder')).toBe('tie-break');
    expect(showsField('swiss', 'groupCount')).toBe(false);
    expect(showsField('swiss', 'homeAway')).toBe(false);
  });

  it('groups + knockout: group size and qualification decide, then the bracket does', () => {
    const s = specFor('groups-knockout');
    expect(s.advancement.kind).toBe('bracket');
    expect(s.groupSize.status).toBe('required');
    expect(fieldStatus('groups-knockout', 'groupCount')).toBe('required');
    expect(fieldEffect('groups-knockout', 'advancePerGroup')).toBe('progression');
    expect(fieldEffect('groups-knockout', 'winPoints')).toBe('ranking');
    expect(fieldEffect('groups-knockout', 'seeding')).toBe('progression');
    const plan = groupPlan(rules({ groupCount: 3, advancePerGroup: 2 }), 12);
    expect(plan.sizes).toEqual([4, 4, 4]);
    expect(plan.qualifiers).toBe(6);
    expect(plan.knockoutSize).toBe(8);
    expect(plan.knockoutByes).toBe(2);
  });

  it('league: one table, points central, no group stage', () => {
    const s = specFor('league');
    expect(s.advancement.kind).toBe('table');
    expect(s.points.status).toBe('required');
    expect(fieldStatus('league', 'homeAway')).toBe('optional');
    expect(showsField('league', 'groupCount')).toBe(false);
    expect(showsField('league', 'swissRounds')).toBe(false);
  });

  it('custom: every combination on show, and the inert ones are named out loud', () => {
    const s = specFor('custom');
    // Custom declares every group on purpose, but only the ones with a live
    // field are rendered: a flat pairing list has no groups and no rounds, so
    // those two panels are not shown. The reporting group is never rendered
    // anywhere, because the points really do build the table in Custom.
    expect(s.groups).toEqual([...ALL_GROUPS].filter(g => g !== 'reporting'));
    expect(visibleGroups('custom')).toEqual(
      ['scoring', 'sets', 'draws', 'tiebreak', 'seeding', 'meeting', 'byes', 'structure']);
    expect(hiddenGroups('custom')).toEqual(['groups', 'rounds', 'reporting']);
    const inert = inertFields('custom').map(f => f.field);
    expect(inert).toContain('groupCount');
    expect(inert).toContain('advancePerGroup');
    expect(inert).toContain('swissRounds');
    // The settings that change nothing in Custom are named, but naming them is
    // not a reason to refuse the tournament: Custom always has some, so an issue
    // here would make a custom event impossible to create.
    expect(validateModeSetup('custom', rules({ customStage: 'pairings' }), 8)).toEqual([]);
    // The default rules already state a stage, so a missing one is a real case.
    const noStage = { ...rules() };
    delete noStage.customStage;
    expect(validateModeSetup('custom', noStage as never, 8).map(i => i.field)).toEqual(['customStage']);
    // And a message that names a field names it in words, never as a key.
    expect(labelOfField('groupCount')).toBe(en['common.groups']);
    expect(labelOfField('advancePerGroup')).toBe(en['rules.advance']);
  });
});

describe('group sizes', () => {
  it('divides evenly, and spreads the remainder one participant at a time', () => {
    expect(groupPlan(rules({ groupCount: 4, advancePerGroup: 2 }), 16).sizes).toEqual([4, 4, 4, 4]);
    const ten = groupPlan(rules({ groupCount: 4, advancePerGroup: 2 }), 10);
    expect(ten.sizes).toEqual([3, 3, 2, 2]);
    expect(ten.uneven).toBe(true);
    expect(ten.smallest).toBe(2);
    expect(ten.largest).toBe(3);
    expect(groupPlan(rules({ groupCount: 2, advancePerGroup: 2 }), 8).uneven).toBe(false);
  });

  it('computes the qualifiers and the bracket they need', () => {
    const six = groupPlan(rules({ groupCount: 2, advancePerGroup: 3 }), 12);
    expect(six.qualifiers).toBe(6);
    expect(six.knockoutSize).toBe(8);
    expect(six.knockoutByes).toBe(2);
    expect(groupPlan(rules({ groupCount: 4, advancePerGroup: 1 }), 16).knockoutByes).toBe(0);
  });

  it('uses the sample field when the count is not known yet', () => {
    expect(groupPlan(rules({ groupCount: 2, advancePerGroup: 2 }), null).sizes).toEqual([4, 4]);
  });

  it('agrees with the generator about how many group matches that makes', () => {
    const r = rules({ groupCount: 4, advancePerGroup: 2 });
    const real = genGroupsKnockout(players(10), r);
    const plan = groupPlan(r, 10);
    const playable = real.matches.filter(m => m.homeId && m.awayId).length;
    const expected = plan.sizes.reduce((sum, s) => sum + (s * (s - 1)) / 2, 0);
    expect(playable).toBe(expected);
  });
});

// ---- every mode is fully specified -----------------------------------------

describe('the mode specification is complete', () => {
  const DICTS2 = { en, pl, de, es } as Record<string, Record<string, string>>;

  it('answers all fifteen points for every mode, in every language', () => {
    for (const m of MODES) {
      const s = specFor(m.format);
      // 1 purpose, 15 UI text, 14 example
      const texts: (keyof typeof en)[] = [
        s.info.meaning, s.info.example, s.info.goodFor, s.info.notIncluded,
        ...s.stages.flatMap(st => [st.key, st.produces, st.flow]),
        s.points.why, s.draws.why, s.advancement.why, s.groupSize.why, s.tiebreak.why,
        s.reporting.produces, s.reporting.omits,
        ...s.edgeCases, ...s.unsupported,
        s.structure.contains, s.structure.excludes,
      ];
      expect(texts.length, m.format).toBeGreaterThan(20);
      for (const key of texts) {
        for (const loc of ['en', 'pl', 'de', 'es'] as const) {
          expect(DICTS2[loc][key], `${key} (${m.format}) in ${loc}`).toBeTruthy();
        }
        expect(en[key].length, String(key)).toBeGreaterThan(3);
      }
    }
  });

  it('has at least one stage for every mode, and never an empty list', () => {
    for (const m of MODES) {
      const s = specFor(m.format);
      expect(s.stages.length, m.format).toBeGreaterThan(0);
      for (const st of s.stages) {
        expect(en[st.key], String(st.key)).toBeTruthy();
        expect(en[st.produces], String(st.produces)).toBeTruthy();
        expect(en[st.flow], String(st.flow)).toBeTruthy();
      }
    }
  });

  it('runs the stages a format really has: three for double elimination', () => {
    expect(specFor('single-elimination').stages).toHaveLength(1);
    expect(specFor('double-elimination').stages.map(s => s.key)).toEqual([
      'mode.stage.winners', 'mode.stage.losers', 'mode.stage.grandFinal',
    ]);
    expect(specFor('groups-knockout').stages.map(s => s.key)).toEqual([
      'mode.stage.groups', 'mode.stage.knockout',
    ]);
    expect(specFor('swiss').stages.map(s => s.key)).toEqual([
      'mode.stage.round1', 'mode.stage.laterRounds',
    ]);
  });

  it('sorts every field into exactly one bucket, and names the rest', () => {
    for (const m of MODES) {
      const buckets = ['required', 'optional', 'advanced', 'reporting'] as const;
      const total = buckets.reduce((n, b) => n + fieldsByStatus(m.format, b).length, 0);
      expect(total, m.format).toBe(specFor(m.format).fields.length);
      const na = notApplicableFields(m.format);
      expect(na.length, m.format).toBeGreaterThan(0);
      // Shown plus not-applicable is the whole rule set, with no overlap.
      const shown = visibleFields(m.format);
      for (const f of na) expect(shown.includes(f), `${m.format}.${f}`).toBe(false);
    }
  });

  it('requires the settings a mode cannot generate without', () => {
    // A hybrid cannot rank the groups, seat the bracket or pick qualifiers without
    // these; Swiss cannot pair or rank without them; a bracket cannot be placed.
    expect(requiredFields('groups-knockout').map(f => f.field)).toEqual(expect.arrayContaining(
      ['groupCount', 'advancePerGroup', 'seeding', 'winPoints', 'tiebreakOrder']));
    expect(requiredFields('swiss').map(f => f.field)).toEqual(expect.arrayContaining(
      ['swissRounds', 'winPoints', 'tiebreakOrder']));
    expect(requiredFields('round-robin').map(f => f.field)).toEqual(expect.arrayContaining(
      ['winPoints', 'tiebreakOrder']));
    expect(requiredFields('single-elimination').map(f => f.field)).toEqual(['seeding']);
    expect(requiredFields('custom').map(f => f.field)).toContain('customStage');
  });

  it('says a bracket has no tie-break and does not pretend otherwise', () => {
    expect(specFor('single-elimination').tiebreak.applies).toBe(false);
    expect(translate('en', specFor('single-elimination').tiebreak.why)).toMatch(/no tie-break/i);
    for (const f of ['round-robin', 'league', 'swiss', 'groups-knockout'] as const) {
      expect(specFor(f).tiebreak.applies, f).toBe(true);
    }
  });

  it('names what an export contains, and what it leaves out', () => {
    expect(translate('en', specFor('single-elimination').reporting.omits)).toMatch(/no points table/i);
    expect(translate('en', specFor('round-robin').reporting.omits)).toMatch(/no bracket/i);
    expect(translate('en', specFor('custom').reporting.omits)).toMatch(/later stages/i);
  });

  it('names the features it does not have, instead of leaving them implied', () => {
    // A third-place match is not generated anywhere, and every mode says so.
    for (const m of MODES) {
      expect(specFor(m.format).unsupported, m.format).toContain('mode.no.thirdPlace');
    }
    // Divisions exist nowhere; wildcards only where a group stage exists.
    for (const m of MODES) {
      expect(specFor(m.format).unsupported, m.format).toContain('mode.no.divisions');
    }
    expect(specFor('groups-knockout').unsupported).not.toContain('mode.no.wildcards');
    expect(specFor('round-robin').unsupported).toContain('mode.no.wildcards');
    // Only Custom is single-stage, and it says so in the strongest terms.
    expect(specFor('custom').unsupported).toContain('mode.no.multiStage');
    for (const m of MODES.filter(x => x.format !== 'custom')) {
      expect(specFor(m.format).unsupported, m.format).not.toContain('mode.no.multiStage');
    }
  });
});

// ---- the plan has to exist before the tournament does ----------------------

describe('the plan shown before creation', () => {
  it('marks what the app builds now and what comes later', () => {
    const bracket = stagePlan('single-elimination', rules({ allowDraws: false }), 8);
    expect(bracket).toHaveLength(1);
    expect(bracket[0].generatedNow).toBe(true);
    expect(bracket[0].matches).toBe(7);

    const swiss = stagePlan('swiss', rules({ swissRounds: 5 }), 16);
    expect(swiss.map(s => s.generatedNow)).toEqual([true, false]);
    expect(swiss[0].matches).toBe(8);
    expect(swiss[1].matches).toBe(8);

    const groups = stagePlan('groups-knockout', rules({ groupCount: 2, advancePerGroup: 2 }), 12);
    expect(groups.map(s => s.generatedNow)).toEqual([true, false]);
    expect(groups[0].matches).toBe(30);
    expect(groups[1].matches).toBe(3);
  });

  it('counts the grand final as its own stage', () => {
    const de = stagePlan('double-elimination', rules({ allowDraws: false }), 8);
    expect(de.map(s => s.key)).toEqual(['mode.stage.winners', 'mode.stage.losers', 'mode.stage.grandFinal']);
    expect(de[2].matches).toBe(1);
    expect(de.every(s => s.generatedNow)).toBe(true);
  });

  it('says what the organizer still has to do by hand', () => {
    expect(manualSteps('swiss')).toContain('mode.manual.nextRound');
    expect(manualSteps('groups-knockout')).toContain('mode.manual.knockout');
    expect(manualSteps('custom')).toContain('mode.manual.customStages');
    expect(manualSteps('round-robin')).toEqual(['mode.manual.venues']);
    for (const m of MODES) {
      for (const k of manualSteps(m.format)) expect(translate('en', k), `${m.format} ${k}`).not.toBe(k);
    }
  });

  it('warns before creation when the plan cannot be counted', () => {
    expect(previewWarning('single-elimination', rules(), 1)).toBe('mode.warn.tooFew');
    expect(previewWarning('groups-knockout', rules({ groupCount: 4, advancePerGroup: 1 }), 6)).toBe('mode.warn.groupSize');
    expect(previewWarning('league', rules(), 2)).toBe('mode.warn.leagueTooFew');
    // A field that works, and a count that is not known yet, warn about nothing.
    expect(previewWarning('single-elimination', rules(), 8)).toBeNull();
    expect(previewWarning('groups-knockout', rules({ groupCount: 2, advancePerGroup: 1 }), 8)).toBeNull();
    expect(previewWarning('league', rules(), null)).toBeNull();
  });

  it('explains every term the spec sheet relies on', () => {
    for (const f of ALL_FORMATS) {
      const terms = glossaryFor(f);
      expect(terms.length, f).toBeGreaterThan(0);
      expect(terms, f).toContain('mode.term.advancement');
      for (const term of terms) {
        expect(translate('en', term), `${term} (${f})`).not.toBe(term);
        expect(en[term], String(term)).toContain(' — ');
      }
    }
    // Swiss and round robin are named, and a league is never offered a bracket.
    expect(glossaryFor('swiss')).toContain('mode.term.swiss');
    expect(glossaryFor('round-robin')).toContain('mode.term.roundRobin');
    expect(glossaryFor('league')).not.toContain('mode.term.bracket');
    // Reporting only is explained exactly where points are powerless.
    expect(glossaryFor('single-elimination')).toContain('mode.term.reportingOnly');
    expect(glossaryFor('round-robin')).not.toContain('mode.term.reportingOnly');
  });
});

describe('a custom event has to state its stage', () => {
  const fields = (i: { field: string }[]) => i.map(x => x.field);

  it('refuses a custom event with no stage at all', () => {
    const r = { ...DEFAULT_RULES };
    delete r.customStage;
    expect(fields(validateModeSetup('custom', r, 8))).toContain('customStage');
  });

  it('accepts the one stage the app builds', () => {
    expect(validateModeSetup('custom', rules({ customStage: 'pairings' }), 8))
      .not.toContainEqual(expect.objectContaining({ field: 'customStage' }));
  });

  it('refuses a stage the app does not build, and names it', () => {
    for (const stage of ['groups', 'bracket', 'swiss'] as const) {
      const issues = validateModeSetup('custom', rules({ customStage: stage }), 8);
      const issue = issues.find(i => i.field === 'customStage');
      expect(issue, stage).toBeTruthy();
      expect(issue!.message, stage).toContain(translate('en', `mode.stageName.${stage}`));
    }
  });

  it('keeps the custom stage out of the other modes entirely', () => {
    for (const m of MODES.filter(x => x.format !== 'custom')) {
      expect(showsField(m.format, 'customStage'), m.format).toBe(false);
      expect(fieldStatus(m.format, 'customStage'), m.format).toBe('not-applicable');
    }
  });
});
