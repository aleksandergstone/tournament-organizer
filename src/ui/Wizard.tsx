import { useApp } from '../state/store';
import { CompetitionFormat } from '../engine/types';
import { useState } from 'react';
import { validateTournament, ValidationIssue } from '../engine/validate';
import { uid, nowIso } from '../engine/types';
import { Alert, Field, Page, Panel, StepBar } from './kit';
import { useT } from '../i18n';
import type { Dict } from '../i18n';

type Key = keyof Dict & string;
const FORMATS: { v: CompetitionFormat; key: Key; hint: Key }[] = [
  { v: 'single-elimination', key: 'format.single-elimination', hint: 'format.hint.single-elimination' },
  { v: 'double-elimination', key: 'format.double-elimination', hint: 'format.hint.double-elimination' },
  { v: 'round-robin', key: 'format.round-robin', hint: 'format.hint.round-robin' },
  { v: 'swiss', key: 'format.swiss', hint: 'format.hint.swiss' },
  { v: 'groups-knockout', key: 'format.groups-knockout', hint: 'format.hint.groups-knockout' },
  { v: 'league', key: 'format.league', hint: 'format.hint.league' },
  { v: 'team-match', key: 'format.team-match', hint: 'format.hint.team-match' },
  { v: 'individual-match', key: 'format.individual-match', hint: 'format.hint.individual-match' },
  { v: 'custom', key: 'format.custom', hint: 'format.hint.custom' },
];

export default function Wizard() {
  const { domain, newProject, go } = useApp();
  const t = useT();
  const [f, setF] = useState({ ...domain.tournament, name: domain.tournament.name || '', sport: domain.tournament.sport || 'Football' });
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const set = (k: string, v: unknown) => setF(s => ({ ...s, [k]: v }));
  const errOf = (field: string) => issues.find(i => i.field === field)?.message;
  const others = issues.filter(i => !['name', 'sport', 'dates'].includes(i.field));
  const format = FORMATS.find(x => x.v === f.format) ?? FORMATS[0];
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

      <Panel title={t('wizard.format')} sub={t('wizard.formatSub')}>
        <div className="grid2">
          <Field label={t('wizard.format')}>
            <select value={f.format} onChange={e => set('format', e.target.value)}>
              {FORMATS.map(x => <option key={x.v} value={x.v}>{t(x.key)}</option>)}
            </select>
          </Field>
          <div className="f-hint" style={{ alignSelf: 'end', paddingBottom: 8 }}>{t(format.hint)}</div>
        </div>
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

      <div className="footbar">
        <span className="muted">
          {t('wizard.creates', { name: f.name.trim() || t('wizard.newTournament'), format: t(format.key) })}
        </span>
        <span className="sp" />
        <button className="btn" onClick={() => go('home')}>{t('common.cancel')}</button>
        <button className="btn primary" onClick={submit}>{t('wizard.create')}</button>
      </div>
    </Page>
  );
}
