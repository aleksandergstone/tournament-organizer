import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../state/store';
import { useT } from '../../i18n';
import { en } from '../../i18n/en';
import {
  Field,
  Panel,
  Switch,
  Segmented,
  Alert,
  Page,
} from '../kit';
import type {
  RuleSet,
  ScoringSystem,
  SailingTiebreakKey,
  SailingScoringConfig,
  MedalRaceScoring,
  StatusPoints,
  SailingRegattaConfig,
} from '../../engine/types';
import {
  SAILING_MODES,
  isSailingFormat,
  visibleSailingGroups,
} from '../../engine/sailing-modes';
import type { SettingGroup } from '../../engine/mode-info';

const SCORING_KEYS: Record<ScoringSystem, keyof typeof en> = {
  'low-point': 'sailing.scoring.low-point',
  'high-point': 'sailing.scoring.high-point',
  'bonus-point': 'sailing.scoring.bonus-point',
  custom: 'sailing.scoring.custom',
};

const TIEBREAK_KEYS: Record<SailingTiebreakKey, keyof typeof en> = {
  'net-points': 'sailing.tiebreak.net-points',
  'most-first': 'sailing.tiebreak.most-first',
  'most-second': 'sailing.tiebreak.most-second',
  'most-third': 'sailing.tiebreak.most-third',
  'most-wins': 'sailing.tiebreak.most-wins',
  'last-race': 'sailing.tiebreak.last-race',
  'fewest-discards': 'sailing.tiebreak.fewest-discards',
  manual: 'sailing.tiebreak.manual',
};

const STATUS_KEYS: Record<string, keyof typeof en> = {
  dns: 'sailing.status.dns',
  dnf: 'sailing.status.dnf',
  dsq: 'sailing.status.dsq',
  ocs: 'sailing.status.ocs',
  ret: 'sailing.status.ret',
  rdg: 'sailing.status.rdg',
  bfd: 'sailing.status.bfd',
  ufd: 'sailing.status.ufd',
  dne: 'sailing.status.dne',
  dgm: 'sailing.status.dgm',
  dct: 'sailing.status.dct',
  zfp: 'sailing.status.zfp',
  scp: 'sailing.status.scp',
};

const ASSIGNMENT_KEYS: Record<'random' | 'seeded' | 'qualifying', keyof typeof en> = {
  random: 'sailing.flightAssignment.random',
  seeded: 'sailing.flightAssignment.seeded',
  qualifying: 'sailing.flightAssignment.qualifying',
};

function defaultMedalRace(): MedalRaceScoring {
  return {
    enabled: false,
    qualifiedCount: 10,
    pointsMultiplier: 2,
    countsInSeries: true,
    separateScoring: false,
  };
}

function defaultStatusPoints(): StatusPoints {
  return {};
}

export default function SailingSettings() {
  const { domain, update, go } = useApp();
  const t = useT();

  const format = domain.tournament.format;
  const isSailing = isSailingFormat(format);
  const mode = SAILING_MODES.find(m => m.format === format);
  const groups = visibleSailingGroups(format);

  if (!isSailing || !mode) {
    return (
      <Page title={t('sailing.regattaSettings')}>
        <Alert tone="warn">{t('sailing.notSailingEvent')}</Alert>
      </Page>
    );
  }

  // Sailing config is the source of truth for sailing-specific settings.
  // It lives on domain.sailingConfig (not on RuleSet).
  const sailingConfig = domain.sailingConfig;
  const scoring = sailingConfig?.scoring ?? {
    ...{
      system: 'low-point' as ScoringSystem,
      customPoints: {},
      statusPoints: {},
      discard: undefined,
      scheduledRaces: 6,
      minRacesForSeries: 1,
      discardsEnabled: true,
      bonusPoints: undefined,
      medalRace: defaultMedalRace(),
      tiebreakOrder: ['net-points', 'most-first', 'most-second', 'most-third'],
      nonFinisherPoints: undefined,
      useHandicap: false,
      handicapSystem: null,
      stageScoring: {},
    } as SailingScoringConfig,
  };

  const setSailingConfig = (patch: Partial<SailingRegattaConfig>) => {
    update(d => ({
      ...d,
      sailingConfig: {
        ...(d.sailingConfig ?? { type: 'fleet-racing' as const }),
        ...patch,
      } as SailingRegattaConfig,
    }), 'sailing-config.changed');
  };

  const setScoring = (patch: Partial<SailingScoringConfig>) => {
    setSailingConfig({ scoring: { ...scoring, ...patch } });
  };

  const setNumber = (key: keyof SailingScoringConfig, value: string) => {
    const n = value ? Number(value) : undefined;
    setScoring({ [key]: n });
  };

  const setScoringSystem = (system: ScoringSystem) => {
    setScoring({ system });
  };

  const setMedalRace = (patch: Partial<MedalRaceScoring>) => {
    setScoring({ medalRace: { ...scoring.medalRace, ...patch } });
  };

  const setStatusPoint = (status: keyof StatusPoints, value: string) => {
    const n = value ? Number(value) : undefined;
    setScoring({
      statusPoints: { ...scoring.statusPoints, [status]: n },
    });
  };

  const removeStatusPoint = (status: keyof StatusPoints) => {
    const next = { ...scoring.statusPoints };
    delete next[status];
    setScoring({ statusPoints: next });
  };

  const setCustomPoint = (position: string, value: string) => {
    const n = value ? Number(value) : undefined;
    const posNum = Number(position);
    const next = { ...scoring.customPoints };
    if (n === undefined) delete next[posNum];
    else next[posNum] = n;
    setScoring({ customPoints: next });
  };

  const setTiebreakOrder = (order: SailingTiebreakKey[]) => {
    setScoring({ tiebreakOrder: order });
  };

  const addTiebreak = () => {
    const all: SailingTiebreakKey[] = [
      'net-points', 'most-first', 'most-second', 'most-third',
      'most-wins', 'last-race', 'fewest-discards', 'manual',
    ];
    const current = scoring.tiebreakOrder;
    const missing = all.filter(k => !current.includes(k));
    if (missing.length > 0) {
      setTiebreakOrder([...current, missing[0]]);
    }
  };

  const removeTiebreak = (index: number) => {
    const next = [...scoring.tiebreakOrder];
    next.splice(index, 1);
    setTiebreakOrder(next);
  };

  const setFleetAssignment = (method: 'random' | 'seeded' | 'qualifying') => {
    setSailingConfig({ fleetAssignment: method });
  };

  const setBoolean = (key: 'discardsEnabled' | 'useHandicap' | keyof MedalRaceScoring, checked: boolean) => {
    if (key === 'discardsEnabled' || key === 'useHandicap') {
      setScoring({ [key]: checked });
    } else {
      setMedalRace({ [key]: checked });
    }
  };

  const isPresetActive = useMemo(() => {
    // Preset is just a starting point — nothing is locked.
    return false;
  }, []);

  return (
    <Page title={t('sailing.regattaSettings')} sub={t(mode.meaning)}>
      {/* Info: preset is just a starting point */}
      <Panel title={t('sailing.presetInfo')} actions={null}>
        <p className="muted">{t('sailing.presetInfoHint')}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn" onClick={() => go('sailing-classes')}>
            {t('common.manage')} {t('sailing.boatClasses')}
          </button>
          <button className="btn" onClick={() => go('sailing-boats')}>
            {t('common.manage')} {t('sailing.boats')}
          </button>
          <button className="btn" onClick={() => go('sailing-crews')}>
            {t('common.manage')} {t('sailing.crews')}
          </button>
        </div>
      </Panel>

      {/* Format info */}
      <Panel title={t('sailing.format')} actions={null}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <span className="badge">{t(mode.meaning)}</span>
          <span className="muted">{t(mode.example)}</span>
        </div>
        <p>{t(mode.goodFor)}</p>
        <p className="muted">{t(mode.notIncluded)}</p>
      </Panel>

      {/* Scoring system panel */}
      {groups.includes('scoring') && (
        <Panel title={t('rules.scoring')}>
          <Field label={t('sailing.scoringSystem')} hint={t('mode.why.scoringSystem')}>
            <Segmented
              value={scoring.system ?? 'low-point'}
              onChange={setScoringSystem}
              options={[
                { id: 'low-point', label: t(SCORING_KEYS['low-point']) },
                { id: 'high-point', label: t(SCORING_KEYS['high-point']) },
                { id: 'bonus-point', label: t(SCORING_KEYS['bonus-point']) },
                { id: 'custom', label: t(SCORING_KEYS['custom']) },
              ]}
            />
          </Field>

          {scoring.system === 'custom' && (
            <Field label={t('sailing.customPoints')} hint={t('mode.why.customPoints')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(Object.entries(scoring.customPoints ?? {}) as [string, number][]).map(([pos, pts]) => (
                  <div key={pos} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 60, fontSize: 12, color: 'var(--muted)' }}>
                      {t('sailing.position')} {pos}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={pts}
                      onChange={e => setCustomPoint(pos, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button className="btn danger" style={{ padding: '4px 8px' }} onClick={() => setCustomPoint(pos, '')}>
                      {t('common.remove')}
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    min={1}
                    placeholder={t('sailing.position')}
                    style={{ flex: 1 }}
                    onBlur={e => {
                      const pos = e.target.value;
                      if (pos) setCustomPoint(pos, scoring.customPoints?.[Number(pos)]?.toString() || '1');
                    }}
                  />
                  <button className="btn primary" onClick={() => {
                    // Add default custom point entry
                    const next = { ...scoring.customPoints };
                    const newPos = Object.keys(next).length + 1;
                    next[newPos] = Number(next[newPos]) || newPos;
                    setScoring({ customPoints: next });
                  }}>{t('common.add')} {t('sailing.position')}</button>
                </div>
              </div>
            </Field>
          )}

          <Field label={t('sailing.nonFinisherPoints')} hint={t('mode.why.nonFinisherPoints')}>
            <input
              type="number"
              min={0}
              value={scoring.nonFinisherPoints ?? ''}
              onChange={e => setScoring({ nonFinisherPoints: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>

          <Field label={t('sailing.bonusPoints')} hint={t('sailing.bonusPointsHint')}>
            <input
              type="number"
              min={0}
              value={scoring.bonusPoints ?? ''}
              onChange={e => setScoring({ bonusPoints: e.target.value ? Number(e.target.value) : undefined })}
            />
          </Field>

          <Switch
            field="useHandicap"
            checked={!!scoring.useHandicap}
            onChange={checked => setBoolean('useHandicap', checked)}
            label={t('sailing.useHandicap')}
            hint={t('mode.why.useHandicap')}
          />

          {scoring.useHandicap && (
            <Field label={t('sailing.handicapSystem')} hint={t('mode.why.handicapSystem')}>
              <input
                type="text"
                placeholder="Portsmouth Yardstick, ORC, ..."
                value={scoring.handicapSystem ?? ''}
                onChange={e => setScoring({ handicapSystem: e.target.value || null })}
              />
            </Field>
          )}

          {/* Status points */}
          <Field label={t('sailing.statusPoints')} hint={t('sailing.statusPointsHint')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(Object.entries(scoring.statusPoints ?? {}) as [string, number][]).map(([status, pts]) => (
                <div key={status} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 100, fontSize: 12, color: 'var(--muted)' }}>
                    {t(STATUS_KEYS[status] ?? status)}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={pts}
                    onChange={e => setStatusPoint(status as keyof StatusPoints, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn danger" style={{ padding: '4px 8px' }} onClick={() => removeStatusPoint(status as keyof StatusPoints)}>
                    {t('common.remove')}
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <select
                  value=""
                  onChange={e => {
                    const s = e.target.value as keyof StatusPoints;
                    if (s) {
                      setStatusPoint(s, scoring.statusPoints?.[s]?.toString() || '0');
                      e.target.value = '';
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  <option value="">{t('sailing.addStatusPoint')}</option>
                  {(['dns', 'dnf', 'dsq', 'ocs', 'ret', 'rdg', 'bfd', 'ufd', 'dne', 'dgm', 'dct', 'zfp', 'scp'] as const).map(s => (
                    <option key={s} value={s}>{t(STATUS_KEYS[s])}</option>
                  ))}
                </select>
                <button className="btn primary" onClick={() => {
                  // Quick add default
                  const next = { ...scoring.statusPoints };
                  next['DNS'] = scoring.statusPoints?.['DNS'] ?? 0;
                  setScoring({ statusPoints: next });
                }}>{t('common.add')} {t('sailing.statusPoint')}</button>
              </div>
            </div>
          </Field>
        </Panel>
      )}

      {/* Races panel */}
      {groups.includes('races') && (
        <Panel title={t('mode.why.scheduledRaces')}>
          <Field label={t('sailing.scheduledRaces')} hint={t('mode.why.scheduledRaces')}>
            <input
              type="number"
              min={1}
              value={scoring.scheduledRaces ?? ''}
              onChange={e => setNumber('scheduledRaces', e.target.value)}
            />
          </Field>
          <Field label={t('sailing.minRacesForSeries')} hint={t('mode.why.minRacesForSeries')}>
            <input
              type="number"
              min={1}
              value={scoring.minRacesForSeries ?? ''}
              onChange={e => setNumber('minRacesForSeries', e.target.value)}
            />
          </Field>
        </Panel>
      )}

      {/* Discards panel */}
      {groups.includes('discards') && (
        <Panel title={t('mode.why.discardProfile')}>
          <Switch
            field="discardProfile"
            checked={!!scoring.discardsEnabled}
            onChange={checked => setBoolean('discardsEnabled', checked)}
            label={t('sailing.enableDiscards')}
            hint={t('mode.why.discardProfile')}
          />
          {scoring.discardsEnabled && (
            <>
              <Field label={t('sailing.racesToQualify')} hint={t('sailing.discardScheduleHint')}>
                <input
                  type="number"
                  min={1}
                  value={scoring.discard?.racesToQualify ?? 4}
                  onChange={e => {
                    const n = e.target.value ? Math.max(1, Number(e.target.value)) : 4;
                    setScoring({ discard: { racesToQualify: n, schedule: scoring.discard?.schedule ?? [[4, 1], [8, 2]] } });
                  }}
                />
              </Field>
              <Field label={t('sailing.discardSchedule')} hint="[races sailed, discards allowed]">
                <input
                  type="text"
                  placeholder="[[4, 1], [8, 2]]"
                  value={JSON.stringify(scoring.discard?.schedule ?? [[4, 1], [8, 2]])}
                  onChange={e => {
                    try {
                      const parsed = JSON.parse(e.target.value || '[]') as [number, number][];
                      setScoring({ discard: { racesToQualify: scoring.discard?.racesToQualify ?? 4, schedule: parsed } });
                    } catch {
                      // ignore invalid JSON while typing
                    }
                  }}
                />
              </Field>
            </>
          )}
        </Panel>
      )}

      {/* Medal race panel */}
      {groups.includes('medal-race') && (
        <Panel title={t('mode.why.medalRace')}>
          <Switch
            field="medalRace"
            checked={!!scoring.medalRace.enabled}
            onChange={checked => setMedalRace({ enabled: checked })}
            label={t('sailing.medalRaceEnabled')}
            hint={t('mode.why.medalRace')}
          />
          {scoring.medalRace.enabled && (
            <>
              <Field label={t('sailing.medalQualifiedCount')}>
                <input
                  type="number"
                  min={1}
                  value={scoring.medalRace.qualifiedCount}
                  onChange={e => setMedalRace({ qualifiedCount: Math.max(1, Number(e.target.value || 1)) })}
                />
              </Field>
              <Field label={t('sailing.medalPointsMultiplier')}>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={scoring.medalRace.pointsMultiplier}
                  onChange={e => setMedalRace({ pointsMultiplier: Math.max(1, Math.min(5, Number(e.target.value || 1))) })}
                />
              </Field>
              <Switch
                field="medalRace.countsInSeries"
                checked={scoring.medalRace.countsInSeries}
                onChange={checked => setMedalRace({ countsInSeries: checked })}
                label={t('sailing.medalCountsInSeries')}
              />
              <Switch
                field="medalRace.separateScoring"
                checked={scoring.medalRace.separateScoring}
                onChange={checked => setMedalRace({ separateScoring: checked })}
                label={t('sailing.medalSeparateScoring')}
              />
            </>
          )}
        </Panel>
      )}

      {/* Flights panel */}
      {groups.includes('flights') && (
        <Panel title={t('mode.why.useFlights')}>
          <Field label={t('sailing.useFlights')} hint={t('mode.why.useFlights')}>
            <Segmented
              value={sailingConfig?.useFlights ? 'yes' : 'no'}
              onChange={v => setSailingConfig({ useFlights: v === 'yes' })}
              options={[
                { id: 'no', label: t('common.no') },
                { id: 'yes', label: t('common.yes') },
              ]}
            />
          </Field>
          {sailingConfig?.useFlights && (
            <>
              <Field label={t('sailing.fleetAssignment')} hint={t('mode.why.fleetAssignment')}>
                <Segmented
                  value={sailingConfig?.fleetAssignment ?? 'random'}
                  onChange={setFleetAssignment}
                  options={[
                    { id: 'random', label: t(ASSIGNMENT_KEYS['random']) },
                    { id: 'seeded', label: t(ASSIGNMENT_KEYS['seeded']) },
                    { id: 'qualifying', label: t(ASSIGNMENT_KEYS['qualifying']) },
                  ]}
                />
              </Field>
            </>
          )}
        </Panel>
      )}

      {/* Timing panel */}
      {groups.includes('timing') && (
        <Panel title={t('mode.why.timeLimitFirst')}>
          <Field label={t('sailing.timeLimitFirstMin')} hint={t('mode.why.timeLimitFirst')}>
            <input
              type="number"
              min={1}
              value={sailingConfig?.timeLimitFirstMin ?? ''}
              onChange={e => setSailingConfig({ timeLimitFirstMin: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
          <Field label={t('sailing.timeLimitOthersMin')} hint={t('mode.why.timeLimitOthers')}>
            <input
              type="number"
              min={1}
              value={sailingConfig?.timeLimitOthersMin ?? ''}
              onChange={e => setSailingConfig({ timeLimitOthersMin: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
          <Field label={t('sailing.targetTimeMin')} hint={t('mode.why.targetTime')}>
            <input
              type="number"
              min={1}
              value={sailingConfig?.targetTimeMin ?? ''}
              onChange={e => setSailingConfig({ targetTimeMin: e.target.value ? Number(e.target.value) : null })}
            />
          </Field>
        </Panel>
      )}

      {/* Tie-break panel */}
      {groups.includes('tiebreak') && (
        <Panel title={t('rules.tiebreak')}>
          <Field label={t('sailing.sailingTiebreak')} hint={t('mode.why.sailingTiebreak')}>
            <p className="muted">{t('sailing.tiebreakOrderHint')}</p>
            {scoring.tiebreakOrder.map((key: SailingTiebreakKey, i: number) => (
              <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, minWidth: 20 }}>{i + 1}.</span>
                <span>{t(TIEBREAK_KEYS[key])}</span>
                <span className="sp" />
                <button
                  className="btn"
                  onClick={() => removeTiebreak(i)}
                >
                  {t('common.remove')}
                </button>
              </div>
            ))}
            <button
              className="btn primary"
              onClick={addTiebreak}
            >
              {t('common.add')} {t('sailing.tiebreak.criterion')}
            </button>
          </Field>
        </Panel>
      )}

      {/* Custom rules panel */}
      {groups.includes('custom-rules') && (
        <Panel title={t('mode.why.customStage')}>
          <Field label={t('sailing.customRules')} hint={t('mode.why.customStage')}>
            <textarea
              rows={4}
              value={sailingConfig?.customRules ?? ''}
              onChange={e => setSailingConfig({ customRules: e.target.value || undefined })}
            />
          </Field>
        </Panel>
      )}

      <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => {}}>{t('common.done')}</button>
      </div>
    </Page>
  );
}


