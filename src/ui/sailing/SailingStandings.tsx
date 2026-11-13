import { useApp } from '../../state/store';
import { useMemo } from 'react';
import { useT } from '../../i18n';
import { Alert, Page, Panel } from '../kit';
import { computeSailingStandings, computeTeamStandings } from '../../engine/sailing-scoring';

export default function SailingStandings() {
  const { domain } = useApp();
  const t = useT();
  const boats = domain.boats?.filter(b => b.active) || [];
  const races = domain.races || [];
  const standings = useMemo(
    () => computeSailingStandings(boats, races, domain.tournament.rules),
    [boats, races, domain.tournament.rules],
  );
  const teamStandings = useMemo(
    () => computeTeamStandings(boats, races, domain.tournament.rules),
    [boats, races, domain.tournament.rules],
  );

  const isSailing = ['fleet-racing', 'match-racing', 'team-racing'].includes(domain.tournament.format);
  const isTeamRacing = domain.tournament.format === 'team-racing';
  const unassignedTeams = boats.filter(boat => !boat.teamName?.trim());
  
  if (!isSailing) {
    return <Page title={t('sailing.seriesStandings')}><p>{t('sailing.notSailingEvent')}</p></Page>;
  }

  return (
    <Page title={t('sailing.seriesStandings')}>
      <div className="section-head">
        <h2>{t('sailing.seriesStandings')}</h2>
      </div>

      {boats.length === 0 ? (
        <Panel title={t('sailing.noBoatsTitle')} sub={t('sailing.noBoatsSub')}>
          <p className="muted">{t('sailing.noBoatsNote')}</p>
        </Panel>
      ) : (
        <>
          {isTeamRacing && (unassignedTeams.length > 0 ? (
            <Alert tone="warn">{t('sailing.teamAssignmentRequired', { n: unassignedTeams.length })}</Alert>
          ) : (
            <Panel title={t('sailing.teamStandings')}>
              {teamStandings.length === 0 ? <p className="muted">{t('sailing.noTeamResults')}</p> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>
                      <th style={{ textAlign: 'left', padding: 8 }}>{t('sailing.rank')}</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>{t('sailing.teamName')}</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>{t('sailing.boatsEntered')}</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>{t('sailing.totalPoints')}</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>{t('sailing.discarded')}</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>{t('sailing.netPoints')}</th>
                    </tr></thead>
                    <tbody>{teamStandings.map(team => (
                      <tr key={team.teamName} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 8 }}>{team.rank}</td>
                        <td style={{ padding: 8, fontWeight: 600 }}>{team.teamName}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{team.boatCount}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{team.totalPoints.toFixed(1)}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{team.discardedPoints.toFixed(1)}</td>
                        <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>{team.netPoints.toFixed(1)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </Panel>
          ))}
          <Panel title={t('sailing.seriesStandings')}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: 8, width: 50 }}>{t('sailing.rank')}</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>{t('sailing.boat')}</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>{t('sailing.sailNumber')}</th>
                    {races.map((race, i) => (
                      <th key={race.id} style={{ textAlign: 'center', padding: 8, width: 60 }}>
                        {t('sailing.raceShort')} {race.number}
                      </th>
                    ))}
                    <th style={{ textAlign: 'right', padding: 8, width: 80 }}>{t('sailing.totalPoints')}</th>
                    <th style={{ textAlign: 'right', padding: 8, width: 80 }}>{t('sailing.discarded')}</th>
                    <th style={{ textAlign: 'right', padding: 8, width: 80 }}>{t('sailing.netPoints')}</th>
                    <th style={{ textAlign: 'center', padding: 8, width: 100 }}>{t('sailing.123')}</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map(standing => {
                    const boat = boats.find(b => b.id === standing.boatId);
                    return (
                      <tr key={standing.boatId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 8, fontWeight: 600 }}>{standing.rank}</td>
                        <td style={{ padding: 8 }}>
                          <strong>{boat?.name || t('sailing.unknownBoat')}</strong>
                          <br />
                          <span className="muted">{boat?.club || ''}</span>
                        </td>
                        <td style={{ padding: 8 }}>{boat?.sailNumber || '—'}</td>
                        {standing.raceResults.map((result, raceIdx) => (
                          <td key={raceIdx} style={{ padding: 8, textAlign: 'center' }}>
                            {result ? (
                              result.status === 'FINISHED' ? (
                                <span style={{ fontWeight: 600 }}>{result.position}</span>
                              ) : (
                                <span className="muted" style={{ fontSize: 12 }}>{result.status.toUpperCase()}</span>
                              )
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        ))}
                        <td style={{ padding: 8, textAlign: 'right' }}>{standing.totalPoints.toFixed(1)}</td>
                        <td style={{ padding: 8, textAlign: 'right', color: 'var(--muted)' }}>{standing.discardedPoints.toFixed(1)}</td>
                        <td style={{ padding: 8, textAlign: 'right', fontWeight: 600, fontSize: 14 }}>{standing.netPoints.toFixed(1)}</td>
                        <td style={{ padding: 8, textAlign: 'center', fontSize: 12 }}>
                          {standing.firstPlaces} / {standing.secondPlaces} / {standing.thirdPlaces}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title={t('sailing.discardInfo')}>
            <p className="muted">
              {t('sailing.discardInfoText', { 
                racesToQualify: domain.tournament.rules.discardProfile?.racesToQualify || 4,
                schedule: JSON.stringify(domain.tournament.rules.discardProfile?.schedule || [[4, 1], [8, 2]])
              })}
            </p>
          </Panel>
        </>
      )}
    </Page>
  );
}

