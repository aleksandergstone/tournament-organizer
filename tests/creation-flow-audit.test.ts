// Regressions found while auditing the creation flow. Each one was reproduced
// before it was fixed; these tests hold the fixed behaviour.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { SettingsForMode, SetupSummary } from '../src/ui/modes';
import {
  ALL_GROUPS, fieldEffect, hiddenGroups, inertFields, labelOfField, MODES, specFor,
  validateModeSetup, visibleFields, visibleGroups,
} from '../src/engine/mode-info';
import { DEFAULT_RULES } from '../src/engine/types';
import { en } from '../src/i18n/en';

const rules = (p: Partial<typeof DEFAULT_RULES> = {}) => ({ ...DEFAULT_RULES, ...p });
const labelsOf = (html: string) =>
  [...html.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].map(m => m[1].replace(/<[^>]+>/g, ''));
/** Does the generator of this format read a group count at all? */
const showsGroups = (f: string) => specFor(f).fields.some(x => x.field === 'groupCount');

describe('the settings a mode shows are the settings it has', () => {
  it('never renders a group the format has no field in', () => {
    for (const m of MODES) {
      // Exactly what the removed "advanced" block asked for.
      const html = renderToStaticMarkup(React.createElement(SettingsForMode, {
        format: m.format, rules: rules(), set: () => {}, count: 8,
        groups: hiddenGroups(m.format), issues: [],
      }));
      const shown = visibleFields(m.format);
      // A bracket must not grow a group count; a round robin must not grow one either.
      const forbidden = shown.includes('groupCount') ? [] : [en['common.groups']];
      for (const label of forbidden) {
        expect(labelsOf(html).join(' | '), `${m.format} shows "${label}"`).not.toContain(label);
      }
    }
  });

  it('never renders a group count outside groups + knockout and custom', () => {
    const formats = MODES.filter(m => !showsGroups(m.format));
    expect(formats.length).toBeGreaterThan(0);
    for (const m of formats) {
      const html = renderToStaticMarkup(React.createElement(SettingsForMode, {
        format: m.format, rules: rules(), set: () => {}, count: 8,
        groups: ALL_GROUPS, issues: [],
      }));
      expect(labelsOf(html).join(' | '), m.format).not.toContain(en['rules.advance']);
    }
  });

  it('never renders a group count, not even when asked for every group', () => {
    // Custom has a rule for groupCount, but a flat pairing list never reads it,
    // so it is not a control — even when the whole catalogue is requested.
    for (const m of MODES) {
      const html = renderToStaticMarkup(React.createElement(SettingsForMode, {
        format: m.format, rules: rules(), set: () => {}, count: 8,
        groups: ALL_GROUPS, issues: [],
      }));
      const rendered = labelsOf(html).join(' | ');
      const real = showsGroups(m.format) && fieldEffect(m.format, 'groupCount') !== 'none';
      expect(rendered.includes(en['rules.advance']), `${m.format} advance field`).toBe(real);
    }
  });
});

describe('a custom event can actually be created', () => {
  it('has no blocking issue once its stage is stated', () => {
    expect(validateModeSetup('custom', rules({ customStage: 'pairings' }), 8)).toEqual([]);
  });

  it('still refuses a missing or unbuildable stage', () => {
    const noStage = { ...rules() };
    delete noStage.customStage;
    expect(validateModeSetup('custom', noStage as never, 8).map(i => i.field)).toEqual(['customStage']);
    for (const stage of ['groups', 'bracket', 'swiss'] as const) {
      expect(validateModeSetup('custom', rules({ customStage: stage }), 8).map(i => i.field))
        .toEqual(['customStage']);
    }
  });

  it('still names the settings that change nothing there', () => {
    // The note is a note, not an error: it is shown, but it blocks nothing.
    expect(inertFields('custom').length).toBeGreaterThan(0);
  });
});

describe('the summary and the preview describe the same field', () => {
  it('uses the participant count for the group plan', () => {
    const r = rules({ groupCount: 2, advancePerGroup: 2 });
    const html = renderToStaticMarkup(React.createElement(SetupSummary, {
      format: 'groups-knockout', rules: r, count: 12,
    }));
    expect(html).toContain('6 / 6');
    expect(html).not.toContain('4 / 4');
  });
});

describe('a message that names a field names it in words', () => {
  it('prints a label, never a dictionary key', () => {
    for (const f of ['groupCount', 'advancePerGroup', 'drawResolution', 'swissRounds',
      'winPoints', 'customStage', 'tiebreakOrder', 'homeAway', 'byePoints'] as const) {
      const label = labelOfField(f);
      expect(label, f).not.toContain('rules.');
      expect(label, f).not.toBe(f);
      expect(label.length, f).toBeGreaterThan(2);
    }
  });
});

describe('the mode screens do not offer settings with no effect', () => {
  it('the hidden groups of a bracket are not rendered as inputs', () => {
    const f = 'single-elimination';
    const hidden = hiddenGroups(f);
    expect(hidden).toContain('groups');
    const html = renderToStaticMarkup(React.createElement(SettingsForMode, {
      format: f, rules: rules(), set: () => {}, count: 8, groups: hidden, issues: [],
    }));
    const text = labelsOf(html).join(' | ');
    expect(text).not.toContain(en['rules.advance']);
    expect(text).not.toContain(en['rules.swissRounds']);
    expect(text).not.toContain(en['rules.customStage']);
  });

  it('every mode renders exactly the groups its fields live in', () => {
    for (const m of MODES) {
      const groups = new Set(specFor(m.format).fields.map(f => f.group));
      expect([...visibleGroups(m.format)].every(g => groups.has(g)), m.format).toBe(true);
    }
  });
});
