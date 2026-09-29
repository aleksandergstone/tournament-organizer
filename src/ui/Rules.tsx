// Rules screen: the same guided view as the wizard, one step further on.
//
// The format decides which settings exist here — a bracket never shows a points
// field, a league never shows Swiss rounds — and the same catalogue drives the
// presets, the preview and the warnings, so this screen and the wizard cannot
// describe the event differently.
import { useApp } from '../state/store';
import { RuleSet } from '../engine/types';
import { genSingleElim } from '../engine/elim';
import { genDoubleElim } from '../engine/double';
import { recomputeBracket } from '../engine/recompute';
import { genRoundRobin, genGroupsKnockout, genLeague, describeFormat } from '../engine/generate';
import { swissPairings } from '../engine/swiss';
import { hiddenGroups, visibleGroups, validateModeSetup } from '../engine/mode-info';
import { applyPreset, type Preset } from '../engine/presets';
import { Alert, Field, Page, Panel } from './kit';
import {
  Glossary, ModeExplainer, PresetPicker, SettingsForMode, StructurePreviewBox,
} from './modes';
import { useT } from '../i18n';

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

export default function Rules() {
  const { domain, update, go } = useApp();
  const t = useT();
  const r = domain.tournament.rules;
  const set = (patch: Partial<RuleSet>) =>
    update(d => ({ ...d, tournament: { ...d.tournament, rules: { ...d.tournament.rules, ...patch } } }), 'rules.edit');
  const currentFormat = domain.tournament.format;
  const generate = () => {
    if (domain.matches.some(m => ['played','draw','walkover','overtime'].includes(m.result.status))) {
      if (!window.confirm(t('rules.regenerateConfirm', { format: describeFormat(currentFormat) }))) return;
    }
    const ps = domain.participants;
    const f = domain.tournament.format;
    let matches = domain.matches, groups = domain.groups;
    if (f === 'single-elimination') { const g = genSingleElim(ps, r); matches = g.matches; groups = []; }
    else if (f === 'round-robin' || f === 'team-match' || f === 'individual-match' || f === 'custom') { matches = genRoundRobin(ps, r); groups = []; }
    else if (f === 'league') { matches = genLeague(ps, r); groups = []; }
    else if (f === 'groups-knockout') { const g = genGroupsKnockout(ps, r); matches = g.matches; groups = g.groups; }
    else if (f === 'swiss') { const st = new Map(ps.map(p => [p.id, 0])); matches = swissPairings(ps, [], st, 1); groups = []; }
    else if (f === 'double-elimination') { const g = genDoubleElim(ps, r); matches = recomputeBracket(g.matches); groups = []; }
    update(() => ({ tournament: domain.tournament, participants: ps, groups, matches, audit: domain.audit, resources: domain.resources ?? [] }), `structure.generate ${f} (${matches.length} matches)`);
    go('bracket');
  };
  const n = domain.participants.filter(p => p.active).length;
  const hasResults = domain.matches.some(m => FINISHED.has(m.result.status));
  // The real field if participants are in, otherwise what the organizer expects.
  const count = n >= 2 ? n : (domain.tournament.participantCountExpected ?? null);
  const issues = validateModeSetup(currentFormat, r, count);
  const advanced = hiddenGroups(currentFormat);
  return (
    <Page title={t('rules.title')} sub={t('rules.sub')}>
      <Panel title={t('wizard.format')}>
        <Field label={t('wizard.format')} hint={t('rules.formatHint')}>
          <select value={currentFormat} onChange={e => update(d => ({ ...d, tournament: { ...d.tournament, format: e.target.value as never } }), 'format.change')}>
            {['single-elimination', 'double-elimination', 'round-robin', 'swiss', 'groups-knockout', 'league', 'team-match', 'individual-match', 'custom']
              .map(x => <option key={x} value={x}>{describeFormat(x)}</option>)}
          </select>
        </Field>
        <ModeExplainer format={currentFormat} />
      </Panel>

      <Panel title={t('mode.presetsTitle')} sub={t('mode.presetsSub')}>
        <PresetPicker format={currentFormat} rules={r} onApply={(p: Preset) => set(applyPreset(r, p))} />
      </Panel>

      <div className="section-head">
        <h2>{t('mode.settingsTitle')}</h2>
      </div>
      <SettingsForMode format={currentFormat} rules={r} set={set} count={count}
        groups={visibleGroups(currentFormat)} issues={issues} />

      {advanced.length > 0 ? (
        <details className="advanced">
          <summary>{t('mode.advancedTitle')}</summary>
          <p className="f-hint">{t('mode.advancedSub')}</p>
          <SettingsForMode format={currentFormat} rules={r} set={set} count={count}
            groups={advanced} issues={issues} />
        </details>
      ) : null}

      <Panel title={t('mode.generateTitle')} sub={t('mode.generateSub')}>
        <StructurePreviewBox format={currentFormat} count={count} rules={r} />
      </Panel>

      {issues.length > 0 && (
        <Alert tone="warn" title={t('rules.checkRules')}>
          {issues.map((i, k) => <div key={k}>{i.message}</div>)}
        </Alert>
      )}
      {n < 2 && <Alert tone="warn" title={t('rules.notEnough')}>{t('rules.notEnoughBody', { n })}</Alert>}
      {hasResults && <Alert tone="warn" title={t('rules.resultsLost')}>{t('rules.resultsLostBody')}</Alert>}

      <Glossary format={currentFormat} />

      <div className="footbar">
        <span className="muted">
          {n < 2 ? t('rules.addFirst') : t('rules.willGenerate', { n })}
        </span>
        <span className="sp" />
        <button className="btn" onClick={() => go('participants')}>{t('rules.backToParticipants')}</button>
        <button className="btn primary" disabled={n < 2} onClick={generate}>{t('rules.generate')}</button>
      </div>
    </Page>
  );
}
