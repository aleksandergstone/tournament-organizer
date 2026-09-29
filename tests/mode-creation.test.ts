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
  hiddenGroups, visibleFields, showsField, previewStructure, validateModeSetup,
  summaryRows, glossaryFor, PICKER_GROUPS, modesInGroup, pickerGroupTitle,
  PREVIEW_SAMPLE,
} from '../src/engine/mode-info';
import { PRESETS, presetsFor, presetById, applyPreset, activePresetId } from '../src/engine/presets';
import { validateTournament } from '../src/engine/validate';
import { genSingleElim } from '../src/engine/elim';
import { genDoubleElim } from '../src/engine/double';
import { genRoundRobin, genLeague, genGroupsKnockout } from '../src/engine/generate';
import { DEFAULT_RULES, type Participant, type RuleSet } from '../src/engine/types';
import { en } from '../src/i18n/en';
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
  it('shows a bracket only what decides and orders a match', () => {
    for (const f of ['single-elimination', 'double-elimination'] as const) {
      expect(visibleGroups(f)).toEqual(['seeding']);
      expect(visibleFields(f)).toEqual(['seeding', 'allowDraws', 'overtimeAllowed']);
    }
  });

  it('never shows points in a bracket — not in any form', () => {
    for (const f of ['single-elimination', 'double-elimination'] as const) {
      for (const field of ['winPoints', 'drawPoints', 'lossPoints', 'walkoverWinnerPoints', 'tiebreakOrder'] as const) {
        expect(showsField(f, field), `${f}.${field}`).toBe(false);
      }
      const keys = summaryRows(f, rules()).map(r => r.key);
      expect(keys).not.toContain('mode.sum.points');
      expect(keys).not.toContain('mode.sum.tiebreak');
    }
  });

  it('shows points and tie-breaks only where a table is produced', () => {
    for (const f of ['round-robin', 'swiss', 'league', 'groups-knockout', 'team-match', 'individual-match'] as const) {
      expect(showsField(f, 'winPoints'), f).toBe(true);
      expect(showsField(f, 'tiebreakOrder'), f).toBe(true);
    }
  });

  it('gives each mode only its own structure settings', () => {
    expect(visibleGroups('swiss')).toEqual(['scoring', 'tiebreak', 'rounds', 'byes']);
    expect(visibleGroups('league')).toEqual(['scoring', 'tiebreak', 'seeding', 'meeting']);
    expect(visibleGroups('groups-knockout')).toEqual(['scoring', 'tiebreak', 'seeding', 'groups']);
    expect(showsField('swiss', 'groupCount')).toBe(false);
    expect(showsField('swiss', 'homeAway')).toBe(false);
    expect(showsField('league', 'swissRounds')).toBe(false);
    expect(showsField('single-elimination', 'byePoints')).toBe(false);
  });

  it('keeps the rest of the rules reachable as advanced settings', () => {
    for (const m of MODES) {
      const shown = new Set(visibleGroups(m.format));
      const hidden = hiddenGroups(m.format);
      expect(hidden.length, m.format).toBeGreaterThan(0);
      for (const g of hidden) expect(shown.has(g), `${m.format}.${g}`).toBe(false);
      // Nothing is lost: visible + hidden is the whole catalogue.
      expect([...shown, ...hidden].sort()).toEqual([...ALL_GROUPS].sort());
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
    expect(validateModeSetup('single-elimination', rules(), 8)).toEqual([]);
    expect(validateModeSetup('league', rules(), 10)).toEqual([]);
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
    const rows = summaryRows('groups-knockout', rules({ groupCount: 4, advancePerGroup: 3 }));
    const value = (k: string) => rows.find(r => r.key === k)?.value;
    expect(value('mode.sum.groups')).toContain('4');
    expect(value('mode.sum.groups')).toContain('3');
    expect(value('mode.sum.points')).toContain('3');
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
