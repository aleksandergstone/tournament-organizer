import { useMemo, useState } from 'react';
import { useApp } from '../../state/store';
import {
  DEFAULT_RULES, type BoatClass, type CompetitionFormat, type RuleSet, type Tournament,
  nowIso, uid,
} from '../../engine/types';
import { validateTournament } from '../../engine/validate';
import { SAILING_MODES, isSailingFormat } from '../../engine/sailing-modes';
import { DISCIPLINES } from '../../engine/discipline';
import { presetById } from '../../engine/presets';
import { Alert, Field, Page, Panel, StepBar, Switch } from '../kit';
import { useT, type Dict } from '../../i18n';

type SailingDraft = {
  name: string;
  sport: string;
  location: string;
  dates: { start: string | null; end: string | null };
  format: CompetitionFormat;
  rules: RuleSet;
  className: string;
  classCode: string;
  crewSize: number | null;
};

function rulesFor(format: CompetitionFormat): RuleSet {
  const presetId = format === 'fleet-racing' ? 'fleet-standard'
    : format === 'match-racing' ? 'match-racing-standard'
      : 'team-racing-standard';
  const preset = presetById(presetId);
  return {
    ...DEFAULT_RULES,
    ...DISCIPLINES.find(d => d.id === 'sailing')?.defaults,
    scheduledRaces: 6,
    minRacesForSeries: 1,
    scoringSystem: 'low-point',
    timeLimitFirstMin: 60,
    timeLimitOthersMin: 15,
    targetTimeMin: 40,
    discardProfile: { racesToQualify: 4, schedule: [[4, 1], [8, 2]] },
    ...preset?.rules,
  };
}

export default function SailingWizard() {
  const { domain, newProject, go } = useApp();
  const t = useT();
  const [step, setStep] = useState(0);
  const [issues, setIssues] = useState<{ field: string; message: string }[]>([]);
  const initialFormat = isSailingFormat(domain.tournament.format)
    ? domain.tournament.format : 'fleet-racing';
  const [draft, setDraft] = useState<SailingDraft>(() => ({
    name: domain.tournament.name || '',
    sport: t('disc.sailing'),
    location: domain.tournament.location || '',
    dates: { start: domain.tournament.dates.start ?? null, end: domain.tournament.dates.end ?? null },
    format: initialFormat,
    rules: rulesFor(initialFormat),
    className: '',
    classCode: '',
    crewSize: null,
  }));

  const mode = useMemo(() => SAILING_MODES.find(m => m.format === draft.format)!, [draft.format]);
  const set = <K extends keyof SailingDraft>(key: K, value: SailingDraft[K]) =>
    setDraft(current => ({ ...current, [key]: value }));
  const setRules = (patch: Partial<RuleSet>) =>
    setDraft(current => ({ ...current, rules: { ...current.rules, ...patch } }));
  const errorFor = (field: string) => issues.find(issue => issue.field === field)?.message;

  const chooseFormat = (format: CompetitionFormat) => {
    if (!isSailingFormat(format)) return;
    setDraft(current => ({ ...current, format, rules: rulesFor(format) }));
    setIssues([]);
  };

  const validateStep = (at: number) => {
    const found: { field: string; message: string }[] = [];
    if (at === 0) {
      found.push(...validateTournament({
        name: draft.name, sport: draft.sport, format: draft.format, dates: draft.dates, rules: draft.rules,
      }).filter(issue => ['name', 'sport', 'dates'].includes(issue.field)));
    }
    if (at === 1) {
      const scheduled = draft.rules.scheduledRaces ?? 0;
      const minimum = draft.rules.minRacesForSeries ?? 0;
      if (!Number.isInteger(scheduled) || scheduled < 1)
        found.push({ field: 'scheduledRaces', message: t('sailing.validation.racesMin') });
      if (!Number.isInteger(minimum) || minimum < 1 || minimum > scheduled)
        found.push({ field: 'minRacesForSeries', message: t('sailing.validation.minimumRaces') });
      for (const field of ['timeLimitFirstMin', 'timeLimitOthersMin', 'targetTimeMin'] as const) {
        const value = draft.rules[field];
        if (value != null && (!Number.isFinite(value) || value < 0))
          found.push({ field, message: t('sailing.validation.timeNonNegative') });
      }
    }
    if (at === 2 && !draft.className.trim())
      found.push({ field: 'className', message: t('sailing.validation.classRequired') });
    setIssues(found);
    return found.length === 0;
  };

  const next = () => {
    if (validateStep(step)) setStep(current => Math.min(2, current + 1));
  };

  const create = () => {
    const found = [0, 1, 2].flatMap(at => {
      const local: { field: string; message: string }[] = [];
      if (at === 0) local.push(...validateTournament({
        name: draft.name, sport: draft.sport, format: draft.format, dates: draft.dates, rules: draft.rules,
      }).filter(issue => ['name', 'sport', 'dates'].includes(issue.field)));
      if (at === 1) {
        const n = draft.rules.scheduledRaces ?? 0;
        const min = draft.rules.minRacesForSeries ?? 0;
        if (!Number.isInteger(n) || n < 1) local.push({ field: 'scheduledRaces', message: t('sailing.validation.racesMin') });
        if (!Number.isInteger(min) || min < 1 || min > n) local.push({ field: 'minRacesForSeries', message: t('sailing.validation.minimumRaces') });
      }
      if (at === 2 && !draft.className.trim()) local.push({ field: 'className', message: t('sailing.validation.classRequired') });
      return local;
    });
    setIssues(found);
    if (found.length) {
      const first = found[0].field === 'className' ? 2
        : ['scheduledRaces', 'minRacesForSeries', 'timeLimitFirstMin', 'timeLimitOthersMin', 'targetTimeMin'].includes(found[0].field) ? 1 : 0;
      setStep(first);
      return;
    }

    const now = nowIso();
    const tournament: Tournament = {
      ...domain.tournament,
      id: uid('t'),
      name: draft.name.trim(),
      sport: draft.sport.trim(),
      individualOrTeam: 'team',
      format: draft.format,
      participantCountExpected: null,
      dates: draft.dates,
      location: draft.location.trim(),
      visibility: 'private',
      rules: draft.rules,
      discipline: 'sailing',
      createdAt: now,
      updatedAt: now,
      archived: false,
    };
    const boatClass: BoatClass = {
      id: uid('class'),
      name: draft.className.trim(),
      classCode: draft.classCode.trim() || null,
      crewSize: draft.crewSize,
      oneDesign: true,
    };
    newProject(tournament, {
      boatClasses: [boatClass],
      boats: [],
      flights: [],
      races: [],
      sailingInstructions: [],
      noticeOfRace: [],
      publicDocuments: [],
      seriesStandings: [],
    }, 'sailing-overview');
  };

  const stepNames = [
    t('sailing.wizardStepEvent'),
    t('sailing.wizardStepSetup'),
    t('sailing.wizardStepClass'),
  ];

  return (
    <Page title={t('sailing.wizardTitle')} sub={t('sailing.wizardSub')}>
      <StepBar items={stepNames} current={step} />

      {issues.length > 0 && (
        <Alert tone="err" title={t('wizard.fixFirst')}>
          {issues.map((issue, index) => <div key={`${issue.field}-${index}`}>{issue.message}</div>)}
        </Alert>
      )}

      {step === 0 && (
        <>
          <Panel title={t('sailing.wizardStepEvent')}>
            <div className="grid2">
              <Field label={t('sailing.regattaName')} required error={errorFor('name')}>
                <input autoFocus value={draft.name} onChange={event => set('name', event.target.value)} />
              </Field>
              <Field label={t('wizard.sport')} required error={errorFor('sport')}>
                <input value={draft.sport} onChange={event => set('sport', event.target.value)} />
              </Field>
              <Field label={t('sailing.venue')}>
                <input value={draft.location} onChange={event => set('location', event.target.value)} />
              </Field>
              <Field label={t('sailing.dates')} error={errorFor('dates')}>
                <div className="grid2">
                  <input aria-label={t('wizard.startDate')} type="date" value={draft.dates.start ?? ''}
                    onChange={event => set('dates', { ...draft.dates, start: event.target.value || null })} />
                  <input aria-label={t('wizard.endDate')} type="date" value={draft.dates.end ?? ''}
                    onChange={event => set('dates', { ...draft.dates, end: event.target.value || null })} />
                </div>
              </Field>
            </div>
          </Panel>
          <Panel title={t('sailing.format')} sub={t('sailing.raceTypeHint')}>
            <div className="mode-grid" role="radiogroup" aria-label={t('sailing.format')}>
              {SAILING_MODES.map(item => (
                <button type="button" role="radio" aria-checked={draft.format === item.format}
                  key={item.format} className={`mode-card${draft.format === item.format ? ' on' : ''}`}
                  onClick={() => chooseFormat(item.format)}>
                  <span className="mode-card-name">{t(`format.${item.format}` as keyof Dict)}</span>
                  <span className="mode-card-meaning">{t(item.meaning)}</span>
                  <span className="mode-card-meaning">{t(item.example)}</span>
                  <span className="chip">{t(item.goodFor)}</span>
                </button>
              ))}
            </div>
          </Panel>
        </>
      )}

      {step === 1 && (
        <>
          <Panel title={t('sailing.wizardStepSetup')} sub={t(mode.goodFor)}>
            <div className="grid2">
              <Field field="scheduledRaces" label={t('mode.why.scheduledRaces')} error={errorFor('scheduledRaces')}>
                <input type="number" min={1} step={1} value={draft.rules.scheduledRaces ?? 6}
                  onChange={event => setRules({ scheduledRaces: Number(event.target.value) })} />
              </Field>
              <Field field="minRacesForSeries" label={t('mode.why.minRacesForSeries')} error={errorFor('minRacesForSeries')}>
                <input type="number" min={1} step={1} value={draft.rules.minRacesForSeries ?? 1}
                  onChange={event => setRules({ minRacesForSeries: Number(event.target.value) })} />
              </Field>
              <Field field="scoringSystem" label={t('mode.why.scoringSystem')}>
                <select value={draft.rules.scoringSystem ?? 'low-point'}
                  onChange={event => setRules({ scoringSystem: event.target.value as RuleSet['scoringSystem'] })}>
                  <option value="low-point">{t('sailing.scoring.low-point')}</option>
                  <option value="high-point">{t('sailing.scoring.high-point')}</option>
                  <option value="bonus-point">{t('sailing.scoring.bonus-point')}</option>
                </select>
              </Field>
              <Field field="timeLimitFirstMin" label={t('sailing.timeLimitMin')} error={errorFor('timeLimitFirstMin')}>
                <input type="number" min={0} value={draft.rules.timeLimitFirstMin ?? ''}
                  onChange={event => setRules({ timeLimitFirstMin: event.target.value ? Number(event.target.value) : undefined })} />
              </Field>
              <Field field="timeLimitOthersMin" label={t('mode.why.timeLimitOthers')} error={errorFor('timeLimitOthersMin')}>
                <input type="number" min={0} value={draft.rules.timeLimitOthersMin ?? ''}
                  onChange={event => setRules({ timeLimitOthersMin: event.target.value ? Number(event.target.value) : undefined })} />
              </Field>
              <Field field="targetTimeMin" label={t('sailing.targetTimeMin')} error={errorFor('targetTimeMin')}>
                <input type="number" min={0} value={draft.rules.targetTimeMin ?? ''}
                  onChange={event => setRules({ targetTimeMin: event.target.value ? Number(event.target.value) : undefined })} />
              </Field>
            </div>
            {draft.format !== 'match-racing' && (
              <Switch field="discardProfile" checked={!!draft.rules.discardProfile}
                onChange={value => setRules({
                  discardProfile: value ? { racesToQualify: 4, schedule: [[4, 1], [8, 2]] } : undefined,
                })}
                label={t('sailing.enableDiscards')} hint={t('mode.why.discardProfile')} />
            )}
          </Panel>
          <Panel title={t('sailing.modeIncludes')}>
            <p>{t(mode.notIncluded)}</p>
            <p className="muted">{t('sailing.settingsNote')}</p>
          </Panel>
        </>
      )}

      {step === 2 && (
        <>
          <Panel title={t('sailing.wizardStepClass')} sub={t('sailing.wizardClassHint')}>
            <div className="grid2">
              <Field field="className" label={t('sailing.boatClass')} required error={errorFor('className')}>
                <input autoFocus value={draft.className} placeholder={t('sailing.boatClassPlaceholder')}
                  onChange={event => set('className', event.target.value)} />
              </Field>
              <Field field="classCode" label={t('sailing.classCode')}>
                <input value={draft.classCode} onChange={event => set('classCode', event.target.value)} />
              </Field>
              <Field field="crewSize" label={t('sailing.crewSize')}>
                <input type="number" min={1} step={1} value={draft.crewSize ?? ''}
                  onChange={event => set('crewSize', event.target.value ? Math.max(1, Number(event.target.value)) : null)} />
              </Field>
            </div>
          </Panel>
          <Panel title={t('sailing.wizardSummary')}>
            <p><b>{draft.name.trim() || t('sailing.regattaName')}:</b> {t(mode.meaning)}</p>
            <p>{t('sailing.racesScheduled')}: {draft.rules.scheduledRaces}; {t('sailing.scoringSystem')}: {
              t(({
                'low-point': 'sailing.scoring.low-point',
                'high-point': 'sailing.scoring.high-point',
                'bonus-point': 'sailing.scoring.bonus-point',
                custom: 'sailing.scoringSystem',
              } as const)[draft.rules.scoringSystem ?? 'low-point'])
            }</p>
            <p>{t('sailing.boatClass')}: {draft.className.trim() || '—'}</p>
          </Panel>
        </>
      )}

      <div className="footbar">
        <span className="muted">{t(mode.notIncluded)}</span>
        <span className="sp" />
        <button className="btn" type="button" onClick={() => go('home')}>{t('common.cancel')}</button>
        {step > 0 && <button className="btn" type="button" onClick={() => { setIssues([]); setStep(current => current - 1); }}>{t('common.back')}</button>}
        {step < 2
          ? <button className="btn primary" type="button" onClick={next}>{t('common.next')}</button>
          : <button className="btn primary" type="button" onClick={create}>{t('sailing.wizardCreate')}</button>}
      </div>
    </Page>
  );
}
