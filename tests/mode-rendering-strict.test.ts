// The strict rendering contract, checked exactly: every control carries the name
// of the rule field it edits, so "which fields does this mode show?" has one
// answer per mode and no mode can quietly borrow another's control.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { SettingsForMode, SetupSummary, StructurePreviewBox } from '../src/ui/modes';
import {
  ALL_GROUPS, ALL_RULE_FIELDS, fieldStatus, fieldsByStatus, MODES, previewStructure,
  renderableFields, specFor, summaryRows, visibleGroups, type SettingGroup,
} from '../src/engine/mode-info';
import { DEFAULT_RULES, type RuleSet } from '../src/engine/types';
import { en } from '../src/i18n/en';

const rules = (p: Partial<RuleSet> = {}): RuleSet => ({ ...DEFAULT_RULES, ...p });

/** The rule fields a mode actually puts on screen, read off the rendered DOM. */
function renderedFields(format: string, r: RuleSet = rules(), count = 8): string[] {
  const html = renderToStaticMarkup(React.createElement(SettingsForMode, {
    format, rules: r, set: () => {}, count, groups: ALL_GROUPS, issues: [],
  }));
  return [...new Set([...html.matchAll(/data-field="([^"]+)"/g)].map(m => m[1]))].sort();
}

/** The panel titles a mode shows. */
function renderedPanels(format: string): string[] {
  const html = renderToStaticMarkup(React.createElement(SettingsForMode, {
    format, rules: rules(), set: () => {}, count: 8, groups: visibleGroups(format), issues: [],
  }));
  return [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map(m => m[1].trim());
}

describe('1. each mode renders only its own fields', () => {
  it('shows exactly the fields whose generator reads them', () => {
    for (const m of MODES) {
      const rendered = renderedFields(m.format);
      const live = renderableFields(m.format).map(f => f.field).sort();
      for (const f of rendered) {
        expect(live, `${m.format} renders "${f}", which is not live there`).toContain(f);
        expect(fieldStatus(m.format, f as keyof RuleSet), `${m.format}.${f}`).not.toBe('not-applicable');
      }
      for (const f of live) expect(rendered, `${m.format} hides "${f}"`).toContain(f);
    }
  });

  it('never borrows a field from another mode, in any combination', () => {
    for (const m of MODES) {
      const rendered = new Set(renderedFields(m.format));
      const mine = new Set(renderableFields(m.format).map(f => f.field));
      for (const f of rendered) expect(mine.has(f), `${m.format} borrowed "${f}"`).toBe(true);
    }
  });
});

describe('2. a knockout shows no group, Swiss or league settings', () => {
  const forbidden = ['groupCount', 'advancePerGroup', 'swissRounds', 'homeAway', 'byePoints',
    'customStage', 'tiebreakOrder'];
  it('single elimination', () => {
    const shown = renderedFields('single-elimination');
    for (const f of forbidden) expect(shown, `single-elimination.${f}`).not.toContain(f);
    expect(shown).toContain('seeding');
    expect(shown).toContain('allowDraws');
  });
  it('double elimination', () => {
    const shown = renderedFields('double-elimination');
    for (const f of forbidden) expect(shown, `double-elimination.${f}`).not.toContain(f);
    expect(shown).toContain('seeding');
  });
  it('keeps its points apart, as reporting only', () => {
    for (const f of ['single-elimination', 'double-elimination'] as const) {
      expect(specFor(f).points.affects, f).toBe('reporting');
      for (const p of ['winPoints', 'drawPoints', 'lossPoints', 'walkoverWinnerPoints'] as const) {
        expect(fieldStatus(f, p), `${f}.${p}`).toBe('reporting');
      }
    }
  });
});

describe('3. Swiss shows no group-count and no knockout settings', () => {
  it('renders rounds, tie-breaks, scoring and free passes', () => {
    const shown = renderedFields('swiss');
    for (const f of ['swissRounds', 'byePoints', 'tiebreakOrder', 'winPoints']) {
      expect(shown, `swiss.${f}`).toContain(f);
    }
    for (const f of ['groupCount', 'advancePerGroup', 'seeding', 'homeAway', 'customStage']) {
      expect(shown, `swiss.${f}`).not.toContain(f);
    }
  });
});

describe('4. groups + knockout shows the group and qualifier fields', () => {
  it('and nothing from Swiss or the league', () => {
    const shown = renderedFields('groups-knockout');
    for (const f of ['groupCount', 'advancePerGroup', 'seeding', 'tiebreakOrder', 'winPoints']) {
      expect(shown, `groups-knockout.${f}`).toContain(f);
    }
    for (const f of ['swissRounds', 'homeAway', 'byePoints', 'customStage']) {
      expect(shown, `groups-knockout.${f}`).not.toContain(f);
    }
  });
});

describe('5. round robin and league show table and schedule fields only', () => {
  it('round robin', () => {
    const shown = renderedFields('round-robin');
    for (const f of ['winPoints', 'drawPoints', 'lossPoints', 'tiebreakOrder', 'allowDraws', 'homeAway', 'seeding']) {
      expect(shown, `round-robin.${f}`).toContain(f);
    }
    for (const f of ['groupCount', 'advancePerGroup', 'swissRounds', 'byePoints', 'customStage', 'drawResolution']) {
      expect(shown, `round-robin.${f}`).not.toContain(f);
    }
  });
  it('league, with home and away live', () => {
    const shown = renderedFields('league');
    expect(shown).toContain('homeAway');
    for (const f of ['groupCount', 'swissRounds', 'customStage', 'byePoints']) {
      expect(shown, `league.${f}`).not.toContain(f);
    }
  });
});
describe('6. custom does not leak unrelated defaults', () => {
  it('shows the stage and the fields a flat pairing list really uses', () => {
    const shown = renderedFields('custom');
    for (const f of ['customStage', 'winPoints', 'homeAway']) expect(shown, `custom.${f}`).toContain(f);
    // Real rules of Custom that change nothing in a pairing list: named in the
    // mode note, never offered as controls.
    for (const f of ['groupCount', 'advancePerGroup', 'swissRounds', 'drawResolution']) {
      expect(shown, `custom.${f}`).not.toContain(f);
    }
  });
  it('does not render a group or a rounds panel either', () => {
    const panels = renderedPanels('custom');
    expect(panels).not.toContain(en['mode.set.groups']);
    expect(panels).not.toContain(en['mode.set.rounds']);
  });
});

describe('7. changing the mode removes the previous mode controls at once', () => {
  it('each mode keeps only what belongs to it', () => {
    const bracket = renderedFields('single-elimination');
    const rr = renderedFields('round-robin');
    const swiss = renderedFields('swiss');
    // A draw resolution is a bracket control: nobody else has to settle a level
    // match, so the other two modes never show it.
    expect(bracket).toContain('drawResolution');
    expect(rr).not.toContain('drawResolution');
    expect(swiss).not.toContain('drawResolution');
    // A league-only control: in the round robin, gone in the bracket and Swiss.
    expect(rr).toContain('homeAway');
    expect(bracket).not.toContain('homeAway');
    expect(swiss).not.toContain('homeAway');
    // Swiss-only controls never appear outside Swiss.
    for (const f of ['swissRounds', 'byePoints']) {
      expect(swiss, `swiss.${f}`).toContain(f);
      expect(rr, `round-robin.${f}`).not.toContain(f);
      expect(bracket, `bracket.${f}`).not.toContain(f);
    }
    // A group control belongs to groups + knockout alone.
    expect(renderedFields('groups-knockout')).toContain('groupCount');
    for (const f of ['single-elimination', 'round-robin', 'swiss', 'league'] as const) {
      expect(renderedFields(f), `${f}.groupCount`).not.toContain('groupCount');
    }
    // Coming back to the bracket restores exactly its own controls.
    expect(renderedFields('single-elimination')).toEqual(bracket);
  });
  it('the new mode ignores what the previous mode was set to', () => {
    // Values from a mode the user just left cannot change the new preview.
    const bracketA = previewStructure('single-elimination', 12, rules({ homeAway: false, swissRounds: 5, groupCount: 2 }));
    const bracketB = previewStructure('single-elimination', 12, rules({ homeAway: true, swissRounds: 9, groupCount: 8 }));
    expect(bracketA.rows.map(r => r.value)).toEqual(bracketB.rows.map(r => r.value));
    expect(bracketA.matches).toBe(bracketB.matches);
  });
});

describe('8. the preview and the summary use only live fields', () => {
  it('a value the generator ignores cannot move the preview', () => {
    const base = rules({ groupCount: 2, advancePerGroup: 2, swissRounds: 5 });
    const changed = rules({ groupCount: 8, advancePerGroup: 5, swissRounds: 11 });
    expect(previewStructure('custom', 8, base).rows.map(r => r.value))
      .toEqual(previewStructure('custom', 8, changed).rows.map(r => r.value));
  });
  it('a value the generator does read does move the preview', () => {
    const once = previewStructure('round-robin', 8, rules({ homeAway: false }));
    const twice = previewStructure('round-robin', 8, rules({ homeAway: true }));
    expect(twice.matches).toBeGreaterThan(once.matches!);
  });
  it('the summary mentions nothing the mode does not have', () => {
    for (const m of MODES) {
      const live = new Set(renderableFields(m.format).map(f => f.field));
      const html = renderToStaticMarkup(React.createElement(SetupSummary, {
        format: m.format, rules: rules({ groupCount: 2, advancePerGroup: 2, swissRounds: 5 }), count: 12,
      }));
      if (!live.has('groupCount')) expect(html, m.format).not.toContain(en['mode.sum.groupPlan']);
      if (!live.has('swissRounds')) expect(html, m.format).not.toContain(en['mode.sum.rounds']);
      if (!live.has('tiebreakOrder')) expect(html, m.format).not.toContain(en['mode.sum.tiebreak']);
      if (!live.has('homeAway')) expect(html, m.format).not.toContain(en['mode.sum.meeting']);
      expect(summaryRows(m.format, rules()).length, m.format).toBeGreaterThan(0);
    }
  });
  it('the preview box is rebuilt from the mode it is given', () => {
    const a = renderToStaticMarkup(React.createElement(StructurePreviewBox, {
      format: 'single-elimination', count: 8, rules: rules(),
    }));
    const b = renderToStaticMarkup(React.createElement(StructurePreviewBox, {
      format: 'swiss', count: 8, rules: rules(),
    }));
    expect(a).not.toEqual(b);
    expect(b).toContain(en['preview.roundsPlanned']);
  });
});

describe('9. reporting-only fields are separate and labelled', () => {
  it('a bracket shows its points in their own panel, marked as reports only', () => {
    const html = renderToStaticMarkup(React.createElement(SettingsForMode, {
      format: 'single-elimination', rules: rules(), set: () => {}, count: 8,
      groups: visibleGroups('single-elimination'), issues: [],
    }));
    // The reporting panel, not the scoring one, and both words are on screen.
    expect(html).toContain(en['mode.set.reporting']);
    expect(html).toContain(en['mode.status.reporting']);
    expect(html).toContain(en['mode.why.reporting']);
    expect(html).not.toContain('>' + en['rules.scoring'] + '<');
  });
});

describe('10. not-applicable fields are never normal controls', () => {
  it('every rule field is classified for every mode', () => {
    for (const m of MODES) {
      for (const f of ALL_RULE_FIELDS) {
        expect(['required', 'optional', 'advanced', 'reporting', 'not-applicable'], `${m.format}.${f}`)
          .toContain(fieldStatus(m.format, f));
      }
    }
  });
  it('and the ones that do not apply carry no control at all', () => {
    for (const m of MODES) {
      const rendered = new Set(renderedFields(m.format));
      for (const f of ALL_RULE_FIELDS) {
        if (fieldStatus(m.format, f) === 'not-applicable') {
          expect(rendered.has(f), `${m.format} renders ${f}, which does not apply`).toBe(false);
        }
      }
    }
  });
});

describe('11. advanced settings are folded away, not removed', () => {
  const modeHtml = (format: string) => renderToStaticMarkup(React.createElement(SettingsForMode, {
    format, rules: rules(), set: () => {}, count: 8, groups: visibleGroups(format), issues: [],
  }));

  /** A group the engine considers advanced in every one of its fields. */
  const fullyAdvanced = (format: string, g: SettingGroup): boolean => {
    const fs = specFor(format).fields.filter(f => f.group === g);
    return fs.length > 0 && fs.every(f => f.status === 'advanced');
  };

  it('keeps every live advanced field reachable inside the closed disclosure', () => {
    // A closed <details> still renders its children, so the field stays in the
    // DOM and the organizer keeps the way in. This is the line between folding
    // something away and removing it.
    //
    // Only *live* fields: one with affects 'none' is never offered as a control
    // in the first place — the mode note names it instead — and folding has
    // nothing to do with that.
    for (const m of MODES) {
      const html = modeHtml(m.format);
      for (const f of fieldsByStatus(m.format, 'advanced')) {
        if (f.affects === 'none') continue;
        expect(html, `${m.format} lost ${f.field} entirely`).toContain(`data-field="${f.field}"`);
      }
    }
  });

  it('never opens the advanced block by default', () => {
    for (const m of MODES) {
      if (!visibleGroups(m.format).some(g => fullyAdvanced(m.format, g))) continue;
      const html = modeHtml(m.format);
      expect(html, `${m.format} has advanced groups but no disclosure`).toContain('class="collapse"');
      expect(html, `${m.format} opened the advanced block by default`).not.toContain('class="collapse" open');
    }
  });

  it('adds no disclosure where there is nothing advanced to fold', () => {
    // Otherwise a mode with two plain settings gets a permanently useless
    // "Advanced settings" row, which is clutter rather than disclosure.
    for (const m of MODES) {
      const any = visibleGroups(m.format).some(g => fullyAdvanced(m.format, g));
      expect(modeHtml(m.format).includes(en['mode.advancedTitle']), m.format).toBe(any);
    }
  });

  it('says the inert-settings warning once, not once per panel', () => {
    // It used to sit inside every group, repeating one sentence per panel.
    for (const m of MODES) {
      const times = modeHtml(m.format).split(en['mode.err.inertSettings']).length - 1;
      expect(times, `${m.format} repeats the inert-settings warning`).toBeLessThanOrEqual(1);
    }
  });
});
