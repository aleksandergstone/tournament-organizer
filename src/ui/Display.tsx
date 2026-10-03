// Display Mode — a big, calm screen for a projector, TV or second monitor.
// Read-only by design: it shows what is happening now, what is next, and the
// standings. It updates by itself because it reads the same local state as the
// rest of the app; nothing is entered here.
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { buildDisplay, DisplayMatch } from '../engine/display';
import { hasPointTable } from '../engine/generate';
import { knockoutPlaces } from '../engine/bracket-view';
import { desktop } from '../engine/desktop';
import { useT } from '../i18n';
import { statusLabel } from './kit';

function clockText(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function BigMatch({ label, m }: { label: string; m: DisplayMatch | null }) {
  if (!m) {
    return (
      <div className="display-card">
        <div className="display-label">{label}</div>
        <div className="display-none">—</div>
      </div>
    );
  }
  return (
    <div className="display-card">
      <div className="display-label">{label} · {m.roundName}{m.resource ? ` · ${m.resource}` : ''}</div>
      <div className="display-teams">
        <span>{m.home}</span><b>{m.homeScore ?? '–'}</b>
        <span className="display-vs">:</span>
        <b>{m.awayScore ?? '–'}</b><span>{m.away}</span>
      </div>
      <div className="display-status">{statusLabel(m.status)}</div>
    </div>
  );
}

export default function Display() {
  const t = useT();
  const { domain, standings, go } = useApp();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const names = useMemo(() => new Map(domain.participants.map(p => [p.id, p.name])), [domain.participants]);
  // A points table only means something where points decide the event; in a
  // knockout the hall screen shows the places instead.
  const points = hasPointTable(domain.tournament.format);
  const places = useMemo(() => knockoutPlaces(
    domain.matches.filter(m => !m.groupId),
    id => (id ? names.get(id) ?? t('common.unknown') : '')),
    [domain.matches, names, t]);
  const model = buildDisplay({
    tournamentName: domain.tournament.name || t('app.untitled'),
    matches: domain.matches,
    names,
    standings,
    updatedAt: now.toISOString(),
    topN: 5,
  });

  const fullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };
  // In the projector window (#display) the organizer controls are hidden —
  // nobody should be able to change anything from the big screen.
  const kiosk = typeof window !== 'undefined' && window.location.hash === '#display';

  return (
    <div className="display-root">
      <header className="display-head">
        <div>
          <h1>{model.tournamentName}</h1>
          <div className="muted">
            {domain.tournament.location || t('disp.noVenue')} · {t('disp.participants', { n: domain.participants.length })}
            {model.top.length ? ` · ${t('disp.leader', { name: names.get(model.top[0].participantId) ?? '?' })}` : ''}
          </div>
        </div>
        <div className="display-right">
          <span className={`display-pill ${model.status}`}>{model.statusLabel}</span>
          <span className="display-clock">{clockText(now)}</span>
        </div>
      </header>

      <section className="display-main">
        <BigMatch label={t('disp.playingNow')} m={model.current} />
        <BigMatch label={t('disp.upNext')} m={model.next} />
      </section>

      <section className="display-bottom">
        <div className="display-standings">
          <div className="display-label">{points ? t('disp.standings') : t('st.finalTitle')}</div>
          {!points ? (
            places.length === 0
              ? <div className="display-none">{t('st.enterResultsFirst')}</div>
              : (
                <table>
                  <tbody>
                    {places.map(p => (
                      <tr key={p.place}>
                        <td>#{p.place}</td>
                        <td>{p.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          ) : model.top.length === 0
            ? <div className="display-none">{t('disp.noResults')}</div>
            : (
              <table>
                <tbody>
                  {model.top.map(s => (
                    <tr key={s.participantId}>
                      <td>#{s.rank}</td>
                      <td>{names.get(s.participantId) ?? '?'}</td>
                      <td>{s.played} played</td>
                      <td>{s.wins}-{s.draws}-{s.losses}</td>
                      <td><b>{s.points} pts</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
        <div className="display-meta">
          <div>{t('disp.progress', { played: model.playedCount, total: model.totalCount, open: model.openCount })}</div>
          {!kiosk && <div className="muted">{t('disp.updates')}</div>}
          {!kiosk && (
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn sm" onClick={() => void desktop.openDisplay()}>{t('disp.openSecond')}</button>
              <button className="btn sm" onClick={fullscreen}>{t('disp.fullscreen')}</button>
              <button className="btn sm" onClick={() => go('overview')}>{t('disp.backToApp')}</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
