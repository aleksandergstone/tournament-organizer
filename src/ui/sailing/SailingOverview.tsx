import { useApp } from '../../state/store';
import { useT } from '../../i18n';
import { Page, Panel, Alert } from '../kit';
import { format } from 'date-fns';

export default function SailingOverview() {
  const { domain, go } = useApp();
  const t = useT();
  const { tournament } = domain;

  const isSailing = ['fleet-racing', 'match-racing', 'team-racing'].includes(tournament.format);
  
  if (!isSailing) {
    return <Page title={t('sailing.overview')}><p>{t('sailing.notSailingEvent')}</p></Page>;
  }

  const boatCount = domain.boats?.filter(b => b.active).length || 0;
  const raceCount = domain.races?.length || 0;
  const completedRaces = domain.races?.filter(r => r.status === 'finished').length || 0;

  return (
    <Page title={t('sailing.overview')}>
      <div className="section-head">
        <h2>{t('nav.overview')}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Panel title={t('sailing.regattaName')}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>{tournament.name || t('app.untitled')}</p>
        </Panel>
        <Panel title={t('sailing.format')}>
          <p>{t(`format.for.${tournament.format}`)}</p>
        </Panel>
        <Panel title={t('sailing.dates')}>
          <p>{tournament.dates.start ? format(new Date(tournament.dates.start), 'PPP') : '—'} {tournament.dates.end ? ` – ${format(new Date(tournament.dates.end), 'PPP')}` : ''}</p>
        </Panel>
        <Panel title={t('sailing.venue')}>
          <p>{tournament.location || '—'}</p>
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Panel title={t('sailing.boatsEntered')}>
          <p style={{ fontSize: 24, fontWeight: 600 }}>{boatCount}</p>
        </Panel>
        <Panel title={t('sailing.racesScheduled')}>
          <p style={{ fontSize: 24, fontWeight: 600 }}>{raceCount}</p>
        </Panel>
        <Panel title={t('sailing.racesCompleted')}>
          <p style={{ fontSize: 24, fontWeight: 600 }}>{completedRaces}</p>
        </Panel>
        <Panel title={t('sailing.seriesStatus')}>
          <p>{completedRaces === 0 ? t('sailing.notStarted') : completedRaces === raceCount ? t('sailing.completed') : t('sailing.inProgress')}</p>
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Panel title={t('sailing.quickActions')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn primary" onClick={() => go('sailing-boats')}>
              {t('sailing.manageBoats')}
            </button>
            <button className="btn" onClick={() => go('sailing-races')}>
              {t('sailing.manageRaces')}
            </button>
            <button className="btn" onClick={() => go('sailing-standings')}>
              {t('sailing.viewStandings')}
            </button>
            <button className="btn" onClick={() => go('sailing-documents')}>
              {t('sailing.manageDocuments')}
            </button>
          </div>
        </Panel>

        <Panel title={t('sailing.boatClasses')}>
          {(domain.boatClasses || []).length === 0 ? (
            <p className="muted">{t('sailing.noBoatClasses')}</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {(domain.boatClasses || []).map(bc => (
                <li key={bc.id}>{bc.name} ({bc.classCode || '—'}){bc.crewSize ? ` ×${bc.crewSize}` : ''}</li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </Page>
  );
}