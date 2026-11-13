import { useApp } from '../../state/store';
import { useState } from 'react';
import { Race, RaceResult, RaceResultStatus, Boat, uid, nowIso } from '../../engine/types';
import { useT } from '../../i18n';
import { Page, Panel, Field, Alert } from '../kit';
import { scoreRaceResults } from '../../engine/sailing-scoring';

export default function SailingRaces() {
  const { domain, update, go } = useApp();
  const t = useT();
  const [editingRaceId, setEditingRaceId] = useState<string | null>(null);
  const [raceDraft, setRaceDraft] = useState<Race | null>(null);
  const [editingResult, setEditingResult] = useState<{ raceId: string; boatId: string } | null>(null);
  const [resultDraft, setResultDraft] = useState<RaceResult | null>(null);

  const races = domain.races || [];
  const boats = domain.boats || [];
  const boatClasses = domain.boatClasses || [];

  const missingTeamNames = domain.tournament.format === 'team-racing'
    ? boats.filter(boat => boat.active && !boat.teamName?.trim())
    : [];
  const teamsReady = missingTeamNames.length === 0;

  if (boats.length === 0) {
    return (
      <Page title={t('sailing.races')} sub={t('sailing.racesHint')}>
        <Alert tone="warn">{t('sailing.addBoatsFirst')}</Alert>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={() => go('sailing-boats')}>
            {t('common.add')} {t('sailing.boat')}
          </button>
        </div>
      </Page>
    );
  }

  const makeRace = (classId: string, raceBoats: Boat[], number: number): Race => {
    const id = uid('race');
    return {
      id,
      number,
      classId,
      scheduledStart: null,
      actualStart: null,
      course: '',
      distanceNm: null,
      timeLimitMin: domain.tournament.rules.timeLimitFirstMin ?? null,
      targetTimeMin: domain.tournament.rules.targetTimeMin ?? null,
      status: 'scheduled',
      notes: '',
      windDirection: null,
      windSpeed: null,
      publicationStatus: 'draft',
      corrections: [],
      // Wyniki tylko dla już istnieających łodzi — nie tworzymy nowych "w locie"
      results: raceBoats.map(boat => ({
        id: uid('rr'), raceId: id, boatId: boat.id,
        position: null, finishTime: null, elapsedSeconds: null, correctedSeconds: null,
        points: 0, status: 'DNS' as const, penalty: null, adjustment: null, notes: '',
      })),
    };
  };

  const samePair = (race: Race, first: Boat, second: Boat) =>
    race.classId === first.classId
    && race.results.length === 2
    && race.results.some(result => result.boatId === first.id)
    && race.results.some(result => result.boatId === second.id);

  const addRace = () => {
    const classId = boatClasses[0]?.id || '';
    const raceBoats = boats.filter(b => b.active && b.classId === classId);
    if (raceBoats.length === 0) return;

    let entrants = raceBoats;
    if (domain.tournament.format === 'match-racing') {
      const target = Math.max(1, domain.tournament.rules.scheduledRaces ?? 1);
      entrants = [];
      for (let i = 0; i < raceBoats.length && entrants.length === 0; i++) {
        for (let j = i + 1; j < raceBoats.length && entrants.length === 0; j++) {
          const count = races.filter(race => samePair(race, raceBoats[i], raceBoats[j])).length;
          if (count < target) entrants = [raceBoats[i], raceBoats[j]];
        }
      }
      if (entrants.length !== 2) return;
    }
    const newRace = makeRace(classId, entrants, Math.max(0, ...races.map(r => r.number)) + 1);
    update(d => ({ ...d, races: [...d.races || [], newRace] }), 'race.added');
  };

  const scheduleRemainingRaces = () => {
    const target = Math.max(0, Math.floor(domain.tournament.rules.scheduledRaces ?? 0));
    const additions: Race[] = [];
    for (const boatClass of boatClasses) {
      const classBoats = boats.filter(boat => boat.active && boat.classId === boatClass.id);
      if (!classBoats.length) continue;
      if (domain.tournament.format === 'match-racing') {
        for (let i = 0; i < classBoats.length; i++) {
          for (let j = i + 1; j < classBoats.length; j++) {
            const count = races.filter(race => samePair(race, classBoats[i], classBoats[j])).length;
            if (count < target) {
              additions.push(makeRace(boatClass.id, [classBoats[i], classBoats[j]], additions.length + 1));
            }
          }
        }
      } else {
        additions.push(makeRace(boatClass.id, classBoats, additions.length + 1));
      }
    }
    if (additions.length === 0) return;
    update(d => ({ ...d, races: [...d.races || [], ...additions] }), 'race.scheduled');
  };

  const getResultStatusLabel = (status: RaceResultStatus) => {
    const labels = {
      FINISHED: t('status.finished'),
      DNS: t('status.dns') ?? 'DNS',
      DNF: t('status.dnf') ?? 'DNF',
      DSQ: t('status.dsq') ?? 'DSQ',
      OCS: 'OCS',
      RET: t('status.retired') ?? 'RET',
      RDG: 'RDG',
      DNE: 'DNE',
      DGM: 'DGM',
      BFD: 'BFD',
      UFD: 'UFD',
      SCP: 'SCP',
      DNC: 'DNC',
      ZFP: 'ZFP',
      NSC: 'NSC',
      DPI: 'DPI',
    };
    return labels[status] ?? status;
  };

  const updateResult = (raceId: string, boatId: string, result: RaceResult) => {
    update(d => ({
      ...d,
      races: (d.races || []).map(race => {
        if (race.id !== raceId) return race;
        return {
          ...race,
          results: race.results.map(r =>
            r.boatId === boatId ? { ...r, ...result } : r
          ),
        };
      }),
    }), 'race.result.updated');
  };

  const addResultToRace = (raceId: string, boatId: string) => {
    // Dodaje pusty wynik dla istniejącej łodzi do wyścigu (jeśli jeszcze go nie ma)
    update(d => {
      const race = (d.races || []).find(r => r.id === raceId);
      if (!race) return d;
      const alreadyHas = race.results.some(r => r.boatId === boatId);
      if (alreadyHas) return d;
      const newResult: RaceResult = {
        id: uid('rr'), raceId, boatId,
        position: null, finishTime: null, elapsedSeconds: null, correctedSeconds: null,
        points: 0, status: 'DNS' as const, penalty: null, adjustment: null, notes: '',
      };
      return {
        ...d,
        races: (d.races || []).map(r =>
          r.id === raceId ? { ...r, results: [...r.results, newResult] } : r
        ),
      };
    }, 'race.result.added');
  };

  const removeResultFromRace = (raceId: string, boatId: string) => {
    update(d => ({
      ...d,
      races: (d.races || []).map(race => {
        if (race.id !== raceId) return race;
        return {
          ...race,
          results: race.results.filter(r => r.boatId !== boatId),
        };
      }),
    }), 'race.result.removed');
  };

  const markRaceFinished = (raceId: string) => {
    update(d => ({
      ...d,
      races: (d.races || []).map(race =>
        race.id === raceId ? { ...race, status: 'finished', actualStart: nowIso() } : race
      ),
    }), 'race.finished');
  };

  const getBoatsForClass = (classId: string) =>
    boats.filter(b => b.active && b.classId === classId);

  return (
    <Page title={t('sailing.races')} sub={t('sailing.racesHint')}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn primary" onClick={addRace} disabled={boatClasses.length === 0}>
          {t('sailing.addRace')}
        </button>
        <button className="btn" onClick={scheduleRemainingRaces} disabled={boatClasses.length === 0}>
          {t('sailing.scheduleAllRaces')}
        </button>
      </div>

      {races.length === 0 ? (
        <Panel title={t('sailing.noRacesTitle')} actions={null}>
          <p className="muted">{t('sailing.noRacesSub')}</p>
        </Panel>
      ) : (
        <>
          {races.map(race => {
            const raceBoats = getBoatsForClass(race.classId);
            return (
              <Panel key={race.id} title={`${t('sailing.raceShort')} ${race.number}`}>
                <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${race.status === 'finished' ? '' : 'muted'}`}>
                    {getResultStatusLabel(race.status as RaceResultStatus)}
                  </span>
                  <span className="muted">{race.classId ? boatClasses.find(c => c.id === race.classId)?.name || '' : ''}</span>
                  <span className="sp" />
                  {race.status !== 'finished' && (
                    <button className="btn primary" onClick={() => markRaceFinished(race.id)}>
                      {t('sailing.markFinished')}
                    </button>
                  )}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 8 }}>{t('sailing.boat')}</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>{t('sailing.sailNumber')}</th>
                      <th style={{ textAlign: 'center', padding: 8 }}>{t('sailing.position')}</th>
                      <th style={{ textAlign: 'center', padding: 8 }}>{t('sailing.finishTime')}</th>
                      <th style={{ textAlign: 'center', padding: 8 }}>{t('sailing.elapsedTime')}</th>
                      <th style={{ textAlign: 'center', padding: 8 }}>{t('sailing.status')}</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>{t('sailing.points')}</th>
                      <th style={{ textAlign: 'center', padding: 8 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {raceBoats.map(boat => {
                      const existing = race.results.find(r => r.boatId === boat.id);
                      const isEditing = editingResult?.raceId === race.id && editingResult?.boatId === boat.id;

                      if (isEditing && resultDraft) {
                        return (
                          <tr key={boat.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: 8, fontWeight: 600 }}>{boat.name}</td>
                            <td style={{ padding: 8 }}>{boat.sailNumber || '—'}</td>
                            <td style={{ padding: 8 }}>
                              <input type="number" min={1}
                                value={resultDraft.position ?? ''}
                                onChange={e => setResultDraft(current => current ? { ...current, position: e.target.value ? Number(e.target.value) : null } : current)} />
                            </td>
                            <td style={{ padding: 8 }}>
                              <input type="time"
                                value={resultDraft.finishTime ?? ''}
                                onChange={e => setResultDraft(current => current ? { ...current, finishTime: e.target.value || null } : current)} />
                            </td>
                            <td style={{ padding: 8 }}>
                              <input type="number" min={0} step={1}
                                value={resultDraft.elapsedSeconds ?? ''}
                                onChange={e => setResultDraft(current => current ? { ...current, elapsedSeconds: e.target.value ? Number(e.target.value) : null } : current)} />
                            </td>
                            <td style={{ padding: 8 }}>
                              <select value={resultDraft.status} onChange={e => setResultDraft(current => current ? { ...current, status: e.target.value as RaceResultStatus } : current)}>
                                {(['FINISHED', 'DNS', 'DNF', 'DSQ', 'RET', 'OCS', 'RDG', 'DNE', 'DGM', 'BFD', 'UFD', 'SCP', 'DNC', 'NSC', 'DPI', 'ZFP'] as RaceResultStatus[]).map(s => (
                                  <option key={s} value={s}>{getResultStatusLabel(s)}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: 8, fontWeight: 600 }}>{resultDraft.points}</td>
                            <td style={{ padding: 8, display: 'flex', gap: 4 }}>
                              <button className="btn primary" onClick={() => {
                                if (resultDraft) updateResult(race.id, boat.id, resultDraft);
                                setEditingResult(null); setResultDraft(null);
                              }}>{t('common.save')}</button>
                              <button className="btn" onClick={() => { setEditingResult(null); setResultDraft(null); }}>{t('common.cancel')}</button>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={boat.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: 8, fontWeight: 600 }}>{boat.name}</td>
                          <td style={{ padding: 8 }}>{boat.sailNumber || '—'}</td>
                          <td style={{ padding: 8, textAlign: 'center' }}>
                            {existing ? (existing.position ?? '—') : <button className="btn" onClick={() => addResultToRace(race.id, boat.id)}>{t('sailing.addResult')}</button>}
                          </td>
                          <td style={{ padding: 8, textAlign: 'center' }}>
                            {existing?.finishTime ? new Date(existing.finishTime).toLocaleTimeString() : '—'}
                          </td>
                          <td style={{ padding: 8, textAlign: 'center' }}>
                            {existing?.elapsedSeconds ? `${Math.floor(existing.elapsedSeconds / 60)}:${String(existing.elapsedSeconds % 60).padStart(2, '0')}` : '—'}
                          </td>
                          <td style={{ padding: 8, textAlign: 'center' }}>
                            {existing ? (
                              <span className={`badge ${existing.status === 'FINISHED' ? '' : 'muted'}`}>
                                {getResultStatusLabel(existing.status)}
                              </span>
                            ) : <span className="muted">—</span>}
                          </td>
                          <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>{existing?.points ?? '—'}</td>
                          <td style={{ padding: 8, display: 'flex', gap: 4 }}>
                            {existing ? (
                              <>
                                <button className="btn" onClick={() => {
                                  setEditingResult({ raceId: race.id, boatId: boat.id });
                                  setResultDraft({ ...existing });
                                }}>{t('common.edit')}</button>
                                <button className="btn danger" onClick={() => removeResultFromRace(race.id, boat.id)}>{t('common.remove')}</button>
                              </>
                            ) : (
                              <button className="btn" onClick={() => addResultToRace(race.id, boat.id)}>{t('sailing.addResult')}</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {race.status !== 'finished' && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn primary" onClick={() => markRaceFinished(race.id)}>
                      {t('sailing.markFinished')}
                    </button>
                  </div>
                )}
              </Panel>
            );
          })}
        </>
      )}
    </Page>
  );
}

















