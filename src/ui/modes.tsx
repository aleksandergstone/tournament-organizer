// Shared UI for the guided mode flow.
//
// Nothing here decides anything. Every card, tag, explanation, preset, preview
// line and validation message comes from the engine catalogue in mode-info.ts /
// presets.ts, so the two screens cannot describe a format differently from the
// way the generators build it.
import {
  MODES, PICKER_GROUPS, modesInGroup, pickerGroupTitle, modeOf, hiddenGroups,
  previewStructure, summaryRows, glossaryFor, visibleGroups, ALL_GROUPS,
  specFor, fieldRule, fieldEffect, groupPlan, inertFields, stagePlan, manualSteps, previewWarning, labelOfField,
  type PickerGroup, type SettingGroup, type StructurePreview,
  type FieldRule, type ScoreEffect, type SettingStatus, type ModeSpec,
} from '../engine/mode-info';
import { presetsFor, activePresetId, type Preset } from '../engine/presets';
import { CUSTOM_STAGES, GENERATED_CUSTOM_STAGES, type CustomStage, type DrawResolution, type RuleSet, type TiebreakKey, type ValidationIssueLike } from '../engine/types';
import { describeFormat } from '../engine/generate';
import { Field, Panel, Switch, Alert } from './kit';
import { useT, type Dict } from '../i18n';

type Key = keyof Dict & string;
type Patch = (p: Partial<RuleSet>) => void;

const GROUP_TITLE: Record<SettingGroup, Key> = {
  scoring: 'rules.scoring',
  draws: 'mode.set.draws',
  tiebreak: 'rules.tiebreak',
  seeding: 'rules.seeding',
  groups: 'mode.set.groups',
  rounds: 'mode.set.rounds',
  meeting: 'mode.set.meeting',
  byes: 'mode.set.byes',
  structure: 'mode.set.structure',
  reporting: 'mode.set.reporting',
};

const RESOLUTIONS: readonly DrawResolution[] = ['overtime', 'replay', 'penalty', 'tiebreak'];
const ALL_TIEBREAKS: readonly TiebreakKey[] = ['points', 'wins', 'diff', 'scored', 'buchholz', 'seed', 'name'];

/**
/**
 * The warning a setup screen must show before creation: a plan it cannot count
 * is a plan the organizer should not save blind.
 */
export function PreviewWarning({ format, rules, count }: {
  format: string;
  rules: RuleSet;
  count?: number | null;
}) {
  const t = useT();
  const warning = previewWarning(format, rules, count);
  if (!warning) return null;
  return <Alert tone="warn" title={t('mode.warn.title')}>{t(warning)}</Alert>;
}

/**
 * The two facts that make a setting unambiguous: how much it matters here, and
 * what changing it actually changes. Rendered next to every control, so a number
 * in a form is never a mystery.
 */
export function RuleTag({ status, affects }: { status: SettingStatus; affects: ScoreEffect }) {
  const t = useT();
  return (
    <span className={`rule-tag st-${status}`}>
      <b>{t(`mode.status.${status}` as Key)}</b>
      <span className="rule-tag-affects">{t(`mode.affects.${affects}` as Key)}</span>
    </span>
  );
}

/** The tag for one field, or a muted "not used here" when it does not apply. */
function FieldTag({ format, field }: { format: string; field: keyof RuleSet }) {
  const t = useT();
  const rule = fieldRule(format, field);
  if (!rule) return <span className="f-hint">{t('mode.notApplicable')}</span>;
  return <RuleTag status={rule.status} affects={rule.affects} />;
}

/**
 * "How this mode works", in six lines: what the points do, what a draw means,
 * how big the groups are, who goes forward, and what the structure does and does
 * not contain. Shown next to the mode before the organizer commits to it.
 */
export function ModeRules({ format, rules, count }: {
  format: string;
  rules?: RuleSet;
  count?: number | null;
}) {
  const t = useT();
  const spec: ModeSpec = specFor(format);
  const hasGroups = spec.fields.some(f => f.group === 'groups');
  const plan = hasGroups && rules ? groupPlan(rules, count) : null;
  return (
    <dl className="rule-block">
      <div>
        <dt>{t('mode.rules.points')}</dt>
        <dd>
          <RuleTag status={spec.points.status} affects={spec.points.affects} />
          <span className="f-hint">{t(spec.points.why)}</span>
        </dd>
      </div>
      <div>
        <dt>{t('mode.rules.draws')}</dt>
        <dd>
          <RuleTag status={spec.draws.policy === 'requires-resolution' ? 'advanced' : 'optional'} affects={spec.draws.policy === 'requires-resolution' ? 'progression' : 'ranking'} />
          <span className="f-hint">{t(spec.draws.why)}</span>
        </dd>
      </div>
      <div>
        <dt>{t('mode.rules.groupSize')}</dt>
        <dd>
          <RuleTag status={spec.groupSize.status} affects={spec.groupSize.status === 'required' ? 'progression' : 'none'} />
          <span className="f-hint">{t(spec.groupSize.why)}</span>
          {plan ? (
            <span className="f-hint">
              {plan.uneven
                ? t('mode.groupPlan.uneven', { sizes: plan.sizes.join(' / ') })
                : t('mode.groupPlan.even', { n: plan.smallest })}
            </span>
          ) : null}
        </dd>
      </div>
      <div>
        <dt>{t('mode.rules.advancement')}</dt>
        <dd><span className="f-hint">{t(spec.advancement.why)}</span></dd>
      </div>
      <div>
        <dt>{t('mode.rules.stages')}</dt>
        <dd>
          <ol className="rule-stages">
            {spec.stages.map((s, i) => (
              <li key={String(s.key)}>
                <b>{i + 1}. {t(s.key)}</b>
                <span className="f-hint">{t(s.produces)} — {t(s.flow)}</span>
              </li>
            ))}
          </ol>
        </dd>
      </div>
      <div>
        <dt>{t('mode.rules.tiebreak')}</dt>
        <dd>
          {spec.tiebreak.applies ? <RuleTag status="required" affects="tie-break" /> : null}
          <span className="f-hint">{t(spec.tiebreak.why)}</span>
        </dd>
      </div>
      <div>
        <dt>{t('mode.rules.reporting')}</dt>
        <dd>
          <span className="f-hint">{t(spec.reporting.produces)}</span>
          <span className="f-hint">{t(spec.reporting.omits)}</span>
        </dd>
      </div>
      <div>
        <dt>{t('mode.rules.edgeCases')}</dt>
        <dd>
          <ul className="rule-list">
            {spec.edgeCases.map(k => <li key={String(k)}>{t(k)}</li>)}
          </ul>
        </dd>
      </div>
      <div>
        <dt>{t('mode.rules.unsupported')}</dt>
        <dd>
          <ul className="rule-list">
            {spec.unsupported.map(k => <li key={String(k)}>{t(k)}</li>)}
          </ul>
        </dd>
      </div>
      <div>
        <dt>{t('mode.rules.contains')}</dt>
        <dd><span className="f-hint">{t(spec.structure.contains)}</span></dd>
      </div>
      <div>
        <dt>{t('mode.rules.excludes')}</dt>
        <dd><span className="f-hint">{t(spec.structure.excludes)}</span></dd>
      </div>
    </dl>
  );
}

/* ------------------------------------------------------------ the picker */

/**
 * The mode picker, grouped by what the organizer is trying to do rather than by
 * feature name. Each card carries the mode's own sentence and its points rule,
 * so the choice is explicit before anything is committed.
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
                <span className={`rule-tag st-${specFor(m.format).points.status}`}>
                  {t(specFor(m.format).points.status === 'reporting' ? 'mode.status.reporting' : 'mode.status.required')}
                  <span className="rule-tag-affects">{t(specFor(m.format).points.why)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Everything the organizer needs before committing to a mode: the plain reading,
 * a checkable example, what it suits, what it does not do, and the six facts that
 * make the format unambiguous — points, draws, group size, who goes forward, and
 * what the structure contains.
 */
export function ModeExplainer({ format, rules, count }: {
  format: string;
  rules?: RuleSet;
  count?: number | null;
}) {
  const t = useT();
  const m = modeOf(format);
  const hidden = hiddenGroups(format);
  const inert = inertFields(format);
  /** Would this field do anything in this mode? */
  const live = (f: keyof RuleSet) => fieldEffect(format, f) !== 'none';
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
      <ModeRules format={format} rules={rules} count={count} />
      {hidden.length > 0 ? (
        <p className="f-hint">
          {!live('winPoints') ? t('mode.hiddenPoints')
            : !live('groupCount') && !live('swissRounds') && !live('homeAway') ? t('mode.hiddenStructure')
              : null}
        </p>
      ) : null}
      {inert.length > 0 ? (
        <p className="f-hint">{t('mode.err.inertSettings', { names: inert.map(f => labelOfField(f.field)).join(', ') })}</p>
      ) : null}
    </div>
  );
}

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
      <ol className="stage-plan">
        {stagePlan(format, rules, count).map((s, i) => (
          <li key={i}>
            <b>{t(s.key)}</b>
            <span className={'chip' + (s.generatedNow ? ' ok' : '')}>
              {s.generatedNow ? t('mode.stage.now') : t('mode.stage.later')}
            </span>
            {s.matches !== null ? <span className="chip">{t('preview.matches')}: {s.matches}</span> : null}
            <span className="f-hint">{t(s.produces)}</span>
          </li>
        ))}
      </ol>
      <p className="rule-note">
        <b>{t('mode.rules.manual')}</b>
        <ul className="rule-list">
          {manualSteps(format).map(k => <li key={String(k)}>{t(k)}</li>)}
        </ul>
      </p>
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
  const rows = summaryRows(format, rules, count);
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

/* ------------------------------------------------------------- glossary */

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

/* ----------------------------------------------------- mode-relevant rules */

/** The points block. In a table it builds the ranking; in a bracket it is kept
 *  for reports, and says so next to every number. */
function PointsFields({ format, rules, set, reporting }: {
  format: string; rules: RuleSet; set: Patch; reporting: boolean;
}) {
  const t = useT();
  const num = (field: 'winPoints' | 'drawPoints' | 'lossPoints' | 'walkoverWinnerPoints', label: Key) => {
    const rule = fieldRule(format, field);
    // No rule for this field in this mode means no control: a walkover rule in a
    // format that has no walkover is a setting the engine would ignore.
    if (!rule) return null;
    return (
      <Field key={field} field={field} label={
        <>
          {t(label)}
          {rule ? <RuleTag status={rule.status} affects={rule.affects} /> : null}
        </>
      } hint={rule ? t(rule.why) : undefined}>
        <input type="number" min={0} value={rules[field]} onChange={e => set({ [field]: Number(e.target.value) })} />
      </Field>
    );
  };
  return (
    <>
      {reporting ? <p className="rule-note">{t('mode.points.bracket')}</p> : null}
      <div className="grid2">
        {num('winPoints', 'rules.win')}
        {num('drawPoints', 'rules.draw')}
        {num('lossPoints', 'rules.loss')}
        {num('walkoverWinnerPoints', 'rules.walkoverWin')}
      </div>
    </>
  );
}

/** Draws, and — in a bracket — the rule that settles a level match. */
function DrawSettings({ format, rules, set, err }: {
  format: string; rules: RuleSet; set: Patch; err: (f: string) => string | undefined;
}) {
  const t = useT();
  const spec = specFor(format);
  const drawsRule = fieldRule(format, 'allowDraws');
  const resRule = fieldRule(format, 'drawResolution');
  return (
    <>
      <Switch field="allowDraws" checked={rules.allowDraws} onChange={v => set({ allowDraws: v })}
        label={<>{t('rules.allowDraws')}{drawsRule ? <RuleTag status={drawsRule.status} affects={drawsRule.affects} /> : null}</>}
        hint={drawsRule ? t(drawsRule.why) : undefined} />
      {spec.draws.policy === 'requires-resolution' ? (
        <Field
          field="drawResolution"
          label={<>{t('mode.rules.drawRule')}{resRule ? <RuleTag status={resRule.status} affects={resRule.affects} /> : null}</>}
          hint={t('mode.why.drawResolution')}
          error={err('drawResolution')}>
          <select
            value={rules.drawResolution ?? 'none'}
            onChange={e => set({ drawResolution: e.target.value as DrawResolution })}
            disabled={!rules.allowDraws}>
            <option value="none">{t('mode.resolution.none')}</option>
            {RESOLUTIONS.map(r => <option key={r} value={r}>{t(`mode.resolution.${r}` as Key)}</option>)}
          </select>
        </Field>
      ) : null}
    </>
  );
}

/** One line under a group heading: how much the group's main setting matters. */
function FieldTagLine({ format, field }: { format: string; field: keyof RuleSet }) {
  const t = useT();
  const rule = fieldRule(format, field);
  if (!rule) return null;
  return (
    <p className="rule-note">
      <RuleTag status={rule.status} affects={rule.affects} /> {t(rule.why)}
    </p>
  );
}

/** Group count, who advances, and the resulting sizes — stated, not implied. */
function GroupSettings({ format, rules, set, count, err }: {
  format: string; rules: RuleSet; set: Patch; count?: number | null; err: (f: string) => string | undefined;
}) {
  const t = useT();
  const plan = groupPlan(rules, count);
  const gc = fieldRule(format, 'groupCount');
  const ap = fieldRule(format, 'advancePerGroup');
  return (
    <>
      <div className="grid2">
        <Field field="groupCount" label={<>{t('common.groups')}{gc ? <RuleTag status={gc.status} affects={gc.affects} /> : null}</>}
          error={err('groupCount')}>
          <input type="number" min={2} value={rules.groupCount ?? 2} onChange={e => set({ groupCount: Number(e.target.value) })} />
        </Field>
        <Field field="advancePerGroup" label={<>{t('rules.advance')}{ap ? <RuleTag status={ap.status} affects={ap.affects} /> : null}</>}
          hint={groupHint(count, rules.groupCount ?? 2)} error={err('advancePerGroup')}>
          <input type="number" min={1} value={rules.advancePerGroup ?? 2} onChange={e => set({ advancePerGroup: Number(e.target.value) })} />
        </Field>
      </div>
      <p className="rule-note">
        {plan.uneven
          ? t('mode.groupPlan.uneven', { sizes: plan.sizes.join(' / ') })
          : t('mode.groupPlan.even', { n: plan.smallest })}
      </p>
    </>
  );
}

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
 * knockout teaches the wrong model of what the app will do. Every control that
 * is present says how much it matters here and what changing it changes.
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
  // A group with no field in this format is never rendered, whatever a caller
  // asks for: an input the generator ignores teaches a wrong model.
  const wanted = only ?? visibleGroups(format);
  const has = (g: SettingGroup) => specFor(format).fields.some(f => f.group === g);
  const groups = ALL_GROUPS.filter(g => wanted.includes(g) && has(g));
  const err = (field: string) => issues.find(i => i.field === field)?.message;
  const inert = inertFields(format);
  const inertHere = inert.filter(f => groups.includes(f.group));
  const inertNote = inertHere.length > 0
    ? t('mode.err.inertSettings', { names: inertHere.map(f => labelOfField(f.field)).join(', ') })
    : null;
  const tag = (field: keyof RuleSet) => {
    const rule = fieldRule(format, field);
    return rule ? <RuleTag status={rule.status} affects={rule.affects} /> : null;
  };
  /** A field is rendered only when the mode's generator really reads it. */
  const live = (field: keyof RuleSet) => fieldEffect(format, field) !== 'none';

  return (
    <>
      {groups.map(g => (
        <Panel key={g} title={t(GROUP_TITLE[g])}>
          {g === 'scoring' || g === 'reporting'
            ? <PointsFields format={format} rules={rules} set={set} reporting={g === 'reporting'} />
            : null}

          {g === 'draws' && live('allowDraws') ? <DrawSettings format={format} rules={rules} set={set} err={err} /> : null}

          {g === 'tiebreak' && live('tiebreakOrder') ? (
            <>
              <FieldTagLine format={format} field="tiebreakOrder" />
              <TiebreakOrder order={rules.tiebreakOrder} set={set} />
            </>
          ) : null}

          {g === 'seeding' && live('seeding') ? (
            <>
              <Field field="seeding" label={<>{t('rules.seeding')}{tag('seeding')}</>} hint={t('mode.why.seeding')}>
                <select value={rules.seeding} onChange={e => set({ seeding: e.target.value as RuleSet['seeding'] })}>
                  <option value="seeded">{t('rules.seedingSeeded')}</option>
                  <option value="random">{t('rules.seedingRandom')}</option>
                  <option value="manual">{t('rules.seedingManual')}</option>
                </select>
              </Field>
              {fieldRule(format, 'overtimeAllowed') ? (
                <Switch field="overtimeAllowed" checked={!!rules.overtimeAllowed} onChange={v => set({ overtimeAllowed: v })}
                  label={<>{t('rules.overtime')}{tag('overtimeAllowed')}</>}
                  hint={t('mode.why.overtime')} />
              ) : null}
              {err('overtimeAllowed') ? <p className="f-err" role="alert">{err('overtimeAllowed')}</p> : null}
            </>
          ) : null}

          {g === 'groups' && live('groupCount')
            ? <GroupSettings format={format} rules={rules} set={set} count={count} err={err} /> : null}

          {g === 'rounds' && live('swissRounds') ? (
            <Field field="swissRounds" label={<>{t('rules.swissRounds')}{tag('swissRounds')}</>}
              hint={roundsHint(count)} error={err('swissRounds')}>
              <input type="number" min={1} value={rules.swissRounds ?? 5} onChange={e => set({ swissRounds: Number(e.target.value) })} />
            </Field>
          ) : null}

          {g === 'meeting' && live('homeAway') ? (
            <Switch field="homeAway" checked={!!rules.homeAway} onChange={v => set({ homeAway: v })}
              label={<>{t('rules.homeAway')}{tag('homeAway')}</>}
              hint={t('mode.why.homeAway')} />
          ) : null}

          {g === 'byes' && live('byePoints') ? (
            <Field field="byePoints" label={<>{t('rules.byePoints')}{tag('byePoints')}</>} hint={t('mode.why.byePoints')}>
              <input type="number" min={0} value={rules.byePoints ?? 3} onChange={e => set({ byePoints: Number(e.target.value) })} />
            </Field>
          ) : null}

          {g === 'structure' && live('customStage') ? (
            <>
              <FieldTagLine format={format} field="customStage" />
              <Field
                field="customStage"
                label={<>{t('rules.customStage')}{tag('customStage')}</>}
                hint={t('mode.why.customStage')}
                error={err('customStage')}>
                <select
                  value={rules.customStage ?? ''}
                  onChange={e => set({ customStage: (e.target.value || undefined) as CustomStage | undefined })}>
                  <option value="">{t('mode.err.stageRequired')}</option>
                  {CUSTOM_STAGES.map(s => (
                    <option
                      key={s}
                      value={s}
                      disabled={!GENERATED_CUSTOM_STAGES.includes(s)}>
                      {t(`mode.stageName.${s}` as Key)}
                      {GENERATED_CUSTOM_STAGES.includes(s) ? '' : ` — ${t('mode.no.multiStage')}`}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : null}

          {inertNote ? <p className="rule-note warn">{inertNote}</p> : null}
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
    <div className="tiebreak" data-field="tiebreakOrder">
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
