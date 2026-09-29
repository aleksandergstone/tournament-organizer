import { useApp } from '../state/store';
import { CompetitionFormat, RuleSet } from '../engine/types';
import { useState } from 'react';
import { validateTournament, ValidationIssue } from '../engine/validate';
import { adaptRulesToFormat, validateModeSetup, visibleGroups } from '../engine/mode-info';
import { applyPreset, type Preset } from '../engine/presets';
import { uid, nowIso } from '../engine/types';
import { describeFormat } from '../engine/generate';
import { Alert, Field, Page, Panel, StepBar } from './kit';
import {
  Glossary, ModeExplainer, ModePicker, PresetPicker, PreviewWarning, SettingsForMode,
  SetupSummary, StructurePreviewBox,
} from './modes';
import { useT } from '../i18n';

/**
 * Creating a tournament, as a guided conversation rather than a form dump:
 * what kind of event is this → what that mode means → a starting point (preset)
 * → the settings that mode actually uses → a look at what will be generated →
 * a plain summary → create.
 *
 * Every step reads the engine catalogue, so what the wizard promises here is
 * exactly what the generators will do later.
 */
export default function Wizard() {
  const { domain, newProject, go } = useApp();
  const t = useT();
  const [f, setF] = useState({ ...domain.tournament, name: domain.tournament.name || '', sport: domain.tournament.sport || 'Football' });
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const set = (k: string, v: unknown) => setF(s => ({ ...s, [k]: v }));
  const setRules = (patch: Partial<RuleSet>) => setF(s => ({ ...s, rules: { ...s.rules, ...patch } }));
  const errOf = (field: string) => issues.find(i => i.field === field)?.message;
  const others = issues.filter(i => !['name', 'sport', 'dates'].includes(i.field));
  const count = typeof f.participantCountExpected === 'number' ? f.participantCountExpected : null;
  // Live, while typing: the same checks the engine runs on save.
  const liveIssues = validateModeSetup(f.format, f.rules, count);

  const pickFormat = (format: CompetitionFormat) => {
    setF(s => ({
      ...s,
      format,
      // The format decides the draw rule, so it follows the format. Everything
      // else the organizer set stays exactly as it was.
      rules: { ...s.rules, ...adaptRulesToFormat(format, s.rules) },
      // A mode for individuals is a mode played without team wording.
      individualOrTeam: format === 'individual-match' ? 'individual' : s.individualOrTeam,
    }));
  };
  const usePreset = (preset: Preset) => setRules(applyPreset(f.rules, preset));
  const submit = () => {
    const t = { ...f, id: f.id.startsWith('t_') ? f.id : uid('t'), createdAt: f.createdAt || nowIso(), updatedAt: nowIso(), archived: false };
    const bad = validateTournament(t);
    if (bad.length) { setIssues(bad); return; }
    newProject(t);
  };
  return (
    <Page title={t('wizard.title')} sub={t('wizard.sub')}>
      <StepBar items={[t('wizard.stepDetails'), t('wizard.stepPlayers'), t('wizard.stepGenerate')]} current={0} />

      {others.length > 0 && (
        <Alert tone="err" title={t('wizard.fixFirst')}>
          {others.map(i => <div key={i.field}>{i.message}</div>)}
        </Alert>
      )}

      <Panel title={t('wizard.basics')}>
        <div className="grid2">
          <Field label={t('wizard.name')} required error={errOf('name')}>
            <input value={f.name} onChange={e => set('name', e.target.value)} placeholder={t('wizard.namePlaceholder')} autoFocus />
          </Field>
          <Field label={t('wizard.sport')} required error={errOf('sport')} hint={t('wizard.sportHint')}>
            <input value={f.sport} onChange={e => set('sport', e.target.value)} />
          </Field>
          <Field label={t('wizard.competingAs')} hint={t('wizard.competingHint')}>
            <select value={f.individualOrTeam} onChange={e => set('individualOrTeam', e.target.value)}>
              <option value="team">{t('wizard.teams')}</option>
              <option value="individual">{t('wizard.individual')}</option>
            </select>
          </Field>
          <Field label={t('wizard.expected')} hint={t('wizard.expectedHint')}>
            <input type="number" min={2} value={f.participantCountExpected ?? ''}
              onChange={e => set('participantCountExpected', e.target.value ? Number(e.target.value) : null)} />
          </Field>
        </div>
      </Panel>


      <Panel title={t('mode.pickTitle')} sub={t('mode.pickSub')}>
        <ModePicker value={f.format} onChange={pickFormat} />
        <ModeExplainer format={f.format} rules={f.rules} count={count} />
      </Panel>

      <Panel title={t('mode.presetsTitle')} sub={t('mode.presetsSub')}>
        <PresetPicker format={f.format} rules={f.rules} onApply={usePreset} />
      </Panel>

      <div className="section-head">
        <h2>{t('mode.settingsTitle')}</h2>
      </div>
      <SettingsForMode
        format={f.format} rules={f.rules} set={setRules} count={count}
        groups={visibleGroups(f.format)} issues={liveIssues} />

      <Panel title={t('mode.generateTitle')} sub={t('mode.generateSub')}>
        <PreviewWarning format={f.format} rules={f.rules} count={count} />
        <StructurePreviewBox format={f.format} count={count} rules={f.rules} />
      </Panel>

      <Panel title={t('wizard.whenWhere')} sub={t('wizard.whenWhereSub')}>
        <div className="grid3">
          <Field label={t('wizard.startDate')} error={errOf('dates')}>
            <input type="date" value={f.dates.start ?? ''} onChange={e => set('dates', { ...f.dates, start: e.target.value || null })} />
          </Field>
          <Field label={t('wizard.endDate')}>
            <input type="date" value={f.dates.end ?? ''} onChange={e => set('dates', { ...f.dates, end: e.target.value || null })} />
          </Field>
          <Field label={t('wizard.venue')}>
            <input value={f.location ?? ''} onChange={e => set('location', e.target.value)} placeholder={t('wizard.venuePlaceholder')} />
          </Field>
        </div>
      </Panel>

      <Panel title={t('mode.summaryTitle')}>
        <SetupSummary format={f.format} rules={f.rules} count={count} />
      </Panel>
      <Glossary format={f.format} />

      <div className="footbar">
        <span className="muted">
          {t('wizard.creates', { name: f.name.trim() || t('wizard.newTournament'), format: describeFormat(f.format) })}
        </span>
        <span className="sp" />
        <button className="btn" onClick={() => go('home')}>{t('common.cancel')}</button>
        <button className="btn primary" onClick={submit}>{t('wizard.create')}</button>
      </div>
    </Page>
  );
}
