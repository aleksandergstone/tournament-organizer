// Guided mode creation: the pieces both the wizard and the rules screen use.
//
// Nothing here decides anything on its own. Every card, explanation, preset,
// preview line and validation message comes from the engine catalogue in
// mode-info.ts / presets.ts, so the two screens can never describe a format
// differently from the way the generators build it.
import {
  MODES, PICKER_GROUPS, modesInGroup, pickerGroupTitle, modeOf, hiddenGroups,
  visibleGroups, ALL_GROUPS,
  previewStructure, summaryRows, glossaryFor,
  type PickerGroup, type SettingGroup, type StructurePreview,
} from '../engine/mode-info';
import { presetsFor, activePresetId, type Preset } from '../engine/presets';
import type { RuleSet, TiebreakKey, ValidationIssueLike } from '../engine/types';
import { describeFormat } from '../engine/generate';
import { Field, Panel, Switch } from './kit';
import { useT, type Dict } from '../i18n';

type Key = keyof Dict & string;
type Patch = (p: Partial<RuleSet>) => void;


/* ------------------------------------------------------------ the picker */
/**
 * The mode picker, grouped by what the organizer is trying to do rather than by
 * feature name: a quick knockout, a full ranking, a group stage, or a flat list.
 * Every card says what the mode *means* — the reason to pick it over its
 * neighbour — so the choice does not depend on knowing the vocabulary.
 */
export function ModePicker({ value, onChange }: {
  value: string;
  onChange(format: string): void;
}) {
  const t = useT();
  return (
    <div className="mode-picker">
      {PICKER_GROUPS.map((g: PickerGroup) => (
        <div key={g} className="mode-group">
          <h3 className="mode-group-title">{t(pickerGroupTitle(g))}</h3>
          <div className="mode-grid">
            {modesInGroup(g).map(m => (
              <button
                key={m.format}
                type="button"
                role="radio"
                aria-checked={value === m.format}
                className={'mode-card' + (value === m.format ? ' on' : '')}
                onClick={() => onChange(m.format)}
              >
                <span className="mode-card-name">{t(`format.${m.format}` as Key)}</span>
                <span className="mode-card-meaning">{t(m.meaning)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * What the chosen mode means: the plain reading, a checkable example, what it
 * suits and — just as important — what it does not do, so nobody discovers the
 * missing points table after generating the matches.
 */
export function ModeExplainer({ format }: { format: string }) {
  const t = useT();
  const m = modeOf(format);
  const hidden = hiddenGroups(format);
  return (
    <div className="mode-explain">
      <p className="mode-explain-meaning">{t(m.meaning)}</p>
      <dl className="mode-explain-list">
        <div>
          <dt>{t('mode.exampleLabel')}</dt>
          <dd>{t(m.example)}</dd>
        </div>
        <div>
          <dt>{t('mode.goodForLabel')}</dt>
          <dd>{t(m.goodFor)}</dd>
        </div>
        <div>
          <dt>{t('mode.notIncludedLabel')}</dt>
          <dd>{t(m.notIncluded)}</dd>
        </div>
      </dl>
      {hidden.length > 0 ? (
        <p className="f-hint">
          {hidden.some(g => g === 'scoring' || g === 'tiebreak') ? t('mode.hiddenPoints') : t('mode.hiddenStructure')}
        </p>
      ) : null}
    </div>
  );
}

/** The mode name as the rest of the app spells it. */
export function modeLabel(format: string): string {
  return describeFormat(format);
}

/** Every mode, for callers that need to iterate the catalogue. */
export const allModes = MODES;

/** The settings of a mode, typed for callers that build them. */
export type { RuleSet };

/* -------------------------------------------------- presets and the plan */
const LEVEL_KEY: Record<Preset['level'], Key> = {
  simple: 'preset.level.simple',
  medium: 'preset.level.medium',
  advanced: 'preset.level.advanced',
};

/**
 * Preset cards for the chosen mode. Each one says what it does, why you would
 * pick it over its neighbours, how many participants it fits and what it will
 * generate — the four questions that decide a preset. Applying one fills in the
 * settings that matter for this mode and leaves everything else alone.
 */
export function PresetPicker({ format, rules, onApply }: {
  format: string;
  rules: RuleSet;
  onApply(preset: Preset): void;
}) {
  const t = useT();
  const list = presetsFor(format);
  if (list.length === 0) return null;
  const active = activePresetId(format, rules);
  return (
    <div className="preset-grid">
      {list.map(p => (
        <div key={p.id} className={'preset-card' + (active === p.id ? ' on' : '')}>
          <header className="preset-head">
            <b>{t(p.label)}</b>
            <span className="chip">{t(LEVEL_KEY[p.level])}</span>
            {active === p.id ? <span className="chip ok">{t('preset.inUse')}</span> : null}
          </header>
          <dl className="preset-list">
            <div><dt>{t('mode.presetWhat')}</dt><dd>{t(p.what)}</dd></div>
            <div><dt>{t('mode.presetWhy')}</dt><dd>{t(p.why)}</dd></div>
            <div><dt>{t('mode.presetFits')}</dt><dd>{t(p.fits)}</dd></div>
            <div><dt>{t('mode.presetGenerates')}</dt><dd>{t(p.generates)}</dd></div>
            <div><dt>{t('mode.presetMatters')}</dt><dd>{t(p.matters)}</dd></div>
          </dl>
          <button type="button" className="btn" onClick={() => onApply(p)}>{t('preset.apply')}</button>
        </div>
      ))}
    </div>
  );
}

/**
 * What the app will generate, counted from the current settings and the
 * participant count. When no count is known the numbers are computed for a
 * sample field and labelled as such, rather than quietly showing wrong numbers.
 */
export function StructurePreviewBox({ format, count, rules }: {
  format: string;
  count: number | null;
  rules: RuleSet;
}) {
  const t = useT();
  const p: StructurePreview = previewStructure(format, count, rules);
  return (
    <div className="preview">
      <header className="preview-head">
        <b>{t(p.titleKey)}</b>
        {p.matches !== null ? (
          <span className="chip">{t('preview.matchesNow')}: {p.matches}</span>
        ) : null}
        {p.later > 0 ? <span className="chip">{t('preview.later')}: {p.later}</span> : null}
        {p.byes > 0 ? <span className="chip">{t('preview.byes')}: {p.byes}</span> : null}
        {p.assumed ? <span className="chip">{t('mode.assumed', { n: p.count })}</span> : null}
      </header>
      {p.rows.length > 0 ? (
        <table className="preview-table">
          <tbody>
            {p.rows.map((row, i) => (
              <tr key={i}>
                <th scope="row">{t(row.key)}</th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {p.notes.map(n => <p key={n} className="f-hint">{t(n)}</p>)}
    </div>
  );
}

/** The "before you create it" block: the rules that will actually apply. */
export function SetupSummary({ format, rules, count }: {
  format: string;
  rules: RuleSet;
  count?: number | null;
}) {
  const t = useT();
  const rows = summaryRows(format, rules);
  const p = previewStructure(format, count ?? null, rules);
  const total = (p.matches ?? 0) + p.later;
  return (
    <div className="summary">
      <table className="summary-table">
        <tbody>
          <tr><th scope="row">{t('mode.summaryMode')}</th><td>{describeFormat(format)}</td></tr>
          {typeof count === 'number' && count >= 2 ? (
            <tr><th scope="row">{t('mode.summaryPlayers')}</th><td>{count}</td></tr>
          ) : null}
          <tr><th scope="row">{t('mode.summaryRules')}</th><td>
            <ul className="summary-rules">
              {rows.map((r, i) => <li key={i}><b>{t(r.key)}:</b> {r.value}</li>)}
            </ul>
          </td></tr>
          <tr><th scope="row">{t('mode.summaryOutput')}</th><td>
            {p.matches === null ? t('preview.matches')
              : t('mode.summaryOutputValue', { n: total })}
            {p.byes > 0 ? ` · ${t('preview.byes')}: ${p.byes}` : ''}
          </td></tr>
        </tbody>
      </table>
    </div>
  );
}

/** The words the app will use, in one line each. */
export function Glossary({ format }: { format: string }) {
  const t = useT();
  const terms = glossaryFor(format);
  if (terms.length === 0) return null;
  return (
    <details className="glossary">
      <summary>{t('mode.glossaryTitle')}</summary>
      <p className="f-hint">{t('mode.glossarySub')}</p>
      <dl className="glossary-list">
        {terms.map(term => {
          const full = t(term);
          const cut = full.indexOf(' — ');
          return (
            <div key={term}>
              <dt>{cut > 0 ? full.slice(0, cut) : full}</dt>
              <dd>{cut > 0 ? full.slice(cut + 3) : ''}</dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}

/* ----------------------------------------------------- mode-relevant rules */
const GROUP_TITLE: Record<SettingGroup, Key> = {
  scoring: 'rules.scoring',
  tiebreak: 'rules.tiebreak',
  seeding: 'rules.seeding',
  groups: 'mode.set.groups',
  rounds: 'mode.set.rounds',
  meeting: 'mode.set.meeting',
  byes: 'mode.set.byes',
};

const ALL_TIEBREAKS: TiebreakKey[] = ['points', 'wins', 'diff', 'scored', 'buchholz', 'seed', 'name'];

/** "one group holds about 6" — the number that makes the advance field checkable. */
function groupHint(count: number | null | undefined, groups: number): string | undefined {
  const t = useT();
  if (typeof count !== 'number' || count < 2 || groups < 1) return undefined;
  return t('mode.set.advanceHint', { n: count, g: Math.floor(count / groups) });
}

/** How many rounds a field of this size could hold without a repeated opponent. */
function roundsHint(count: number | null | undefined): string | undefined {
  const t = useT();
  if (typeof count !== 'number' || count < 2) return undefined;
  return t('mode.set.roundsHint', { n: count, m: count - 1 });
}

/**
 * The rules for this mode, and only these. A setting a format cannot use is not
 * greyed out and not tucked away — it is absent, because a points field in a
 * knockout teaches the wrong model of what the app will do.
 */
export function SettingsForMode({ format, rules, set, count, issues = [], groups: only }: {
  format: string;
  rules: RuleSet;
  set: Patch;
  count?: number | null;
  issues?: ValidationIssueLike[];
  /** Render exactly these groups instead of the format's visible ones. */
  groups?: readonly SettingGroup[];
}) {
  const t = useT();
  const groups = ALL_GROUPS.filter(g => (only ?? visibleGroups(format)).includes(g));
  const shown = new Set<keyof RuleSet>();
  // A field may sit in more than one group (draws are both a result and a
  // seeding decision); it is rendered once, in the first group that claims it.
  const owns = (f: keyof RuleSet) => {
    if (shown.has(f)) return false;
    shown.add(f);
    return true;
  };
  const err = (field: string) => issues.find(i => i.field === field)?.message;

  return (
    <>
      {groups.map(g => (
        <Panel key={g} title={t(GROUP_TITLE[g])}>
          {g === 'scoring' ? (
            <>
              <div className="grid4">
                <Field label={t('rules.win')}><input type="number" value={rules.winPoints} onChange={e => set({ winPoints: Number(e.target.value) })} /></Field>
                <Field label={t('rules.draw')}><input type="number" value={rules.drawPoints} onChange={e => set({ drawPoints: Number(e.target.value) })} /></Field>
                <Field label={t('rules.loss')}><input type="number" value={rules.lossPoints} onChange={e => set({ lossPoints: Number(e.target.value) })} /></Field>
                <Field label={t('rules.walkoverWin')}><input type="number" value={rules.walkoverWinnerPoints} onChange={e => set({ walkoverWinnerPoints: Number(e.target.value) })} /></Field>
              </div>
              {owns('allowDraws') ? (
                <Switch checked={rules.allowDraws} onChange={v => set({ allowDraws: v })}
                  label={t('rules.allowDraws')} hint={t('rules.allowDrawsHint')} />
              ) : null}
            </>
          ) : null}

          {g === 'tiebreak' ? <TiebreakOrder order={rules.tiebreakOrder} set={set} /> : null}

          {g === 'seeding' ? (
            <>
              {owns('seeding') ? (
                <Field label={t('rules.seeding')} hint={t('rules.seedingHint')}>
                  <select value={rules.seeding} onChange={e => set({ seeding: e.target.value as RuleSet['seeding'] })}>
                    <option value="seeded">{t('rules.seedingSeeded')}</option>
                    <option value="random">{t('rules.seedingRandom')}</option>
                    <option value="manual">{t('rules.seedingManual')}</option>
                  </select>
                </Field>
              ) : null}
              {owns('allowDraws') ? (
                <Switch checked={rules.allowDraws} onChange={v => set({ allowDraws: v })}
                  label={t('rules.allowDraws')} hint={t('rules.allowDrawsHint')} />
              ) : null}
              {owns('overtimeAllowed') ? (
                <Switch checked={!!rules.overtimeAllowed} onChange={v => set({ overtimeAllowed: v })}
                  label={t('rules.overtime')} hint={t('rules.overtimeHint')} />
              ) : null}
            </>
          ) : null}


          {g === 'groups' ? (
            <div className="grid2">
              <Field label={t('common.groups')} error={err('groupCount')}>
                <input type="number" min={2} value={rules.groupCount ?? 2} onChange={e => set({ groupCount: Number(e.target.value) })} />
              </Field>
              <Field label={t('rules.advance')} error={err('advancePerGroup')}
                hint={groupHint(count, rules.groupCount ?? 2)}>
                <input type="number" min={1} value={rules.advancePerGroup ?? 2} onChange={e => set({ advancePerGroup: Number(e.target.value) })} />
              </Field>
            </div>
          ) : null}

          {g === 'rounds' ? (
            <div className="grid2">
              <Field label={t('rules.swissRounds')} error={err('swissRounds')}
                hint={roundsHint(count)}>
                <input type="number" min={1} value={rules.swissRounds ?? 5} onChange={e => set({ swissRounds: Number(e.target.value) })} />
              </Field>
            </div>
          ) : null}

          {g === 'meeting' ? (
            <Switch checked={!!rules.homeAway} onChange={v => set({ homeAway: v })}
              label={t('rules.homeAway')} hint={t('rules.homeAwayHint')} />
          ) : null}

          {g === 'byes' ? (
            <div className="grid2">
              <Field label={t('rules.byePoints')}>
                <input type="number" min={0} value={rules.byePoints ?? 3} onChange={e => set({ byePoints: Number(e.target.value) })} />
              </Field>
            </div>
          ) : null}
        </Panel>
      ))}
    </>
  );
}

/**
 * The order equal points are separated in, editable as a list. Order is the whole
 * meaning of a tie-break, so it is shown and changed as a sequence rather than
 * as a set of checkboxes.
 */
export function TiebreakOrder({ order, set }: { order: TiebreakKey[]; set: Patch }) {
  const t = useT();
  const move = (i: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(i, 1);
    next.splice(to, 0, item);
    set({ tiebreakOrder: next });
  };
  const unused = ALL_TIEBREAKS.filter(k => !order.includes(k));
  return (
    <div className="tiebreak">
      <p className="f-hint">{t('rules.tiebreakHint')}</p>
      <ol className="tiebreak-list">
        {order.map((key, i) => (
          <li key={key}>
            <span className="tiebreak-pos">{i + 1}</span>
            <span className="tiebreak-name">{t(`rules.tiebreak.${key}` as Key)}</span>
            <button type="button" className="btn tiny" onClick={() => move(i, i - 1)} disabled={i === 0}
              aria-label={t('rules.tiebreakUp')}>{'\u2191'}</button>
            <button type="button" className="btn tiny" onClick={() => move(i, i + 1)} disabled={i === order.length - 1}
              aria-label={t('rules.tiebreakDown')}>{'\u2193'}</button>
            <button type="button" className="btn tiny" onClick={() => set({ tiebreakOrder: order.filter((_, j) => j !== i) })}
              aria-label={t('rules.tiebreakRemove')}>{'\u00d7'}</button>
          </li>
        ))}
      </ol>
      {unused.length > 0 ? (
        <div className="tiebreak-add">
          <select defaultValue="" onChange={e => {
            const key = e.target.value as TiebreakKey;
            if (key) set({ tiebreakOrder: [...order, key] });
            e.currentTarget.value = '';
          }}>
            <option value="">{t('rules.tiebreakAdd')}</option>
            {unused.map(k => <option key={k} value={k}>{t(`rules.tiebreak.${k}` as Key)}</option>)}
          </select>
        </div>
      ) : null}
    </div>
  );
}
