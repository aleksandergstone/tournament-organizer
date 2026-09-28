// Display Mode — a big, calm screen for a projector, TV or second monitor.
// Read-only by design: it shows what is happening now, what is next, and the
// standings. It updates by itself because it reads the same local state as the
// rest of the app; nothing is entered here.
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { buildDisplay, DisplayMatch } from '../engine/display';
import { desktop } from '../engine/desktop';
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
  const { domain, standings, go } = useApp();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const names = useMemo(() => new Map(domain.participants.map(p => [p.id, p.name])), [domain.participants]);
  const model = buildDisplay({
    tournamentName: domain.tournament.name || '(untitled)',
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
            {domain.tournament.location || 'Venue not set'} · {domain.participants.length} participants
            {model.top.length ? ` · leader ${names.get(model.top[0].participantId) ?? '?'}` : ''}
          </div>
        </div>
        <div className="display-right">
          <span className={`display-pill ${model.status}`}>{model.statusLabel}</span>
          <span className="display-clock">{clockText(now)}</span>
        </div>
      </header>

      <section className="display-main">
        <BigMatch label="Playing now" m={model.current} />
        <BigMatch label="Up next" m={model.next} />
      </section>

      <section className="display-bottom">
        <div className="display-standings">
          <div className="display-label">Standings</div>
          {model.top.length === 0
            ? <div className="display-none">No results yet.</div>
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
          <div>{model.playedCount}/{model.totalCount} matches played · {model.openCount} open</div>
          {!kiosk && <div className="muted">Updates automatically as results are entered.</div>}
          {!kiosk && (
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn sm" onClick={() => void desktop.openDisplay()}>Open on second screen</button>
              <button className="btn sm" onClick={fullscreen}>Full screen</button>
              <button className="btn sm" onClick={() => go('overview')}>Back to organizer view</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
