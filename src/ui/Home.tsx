// Home — redesigned dashboard for the Tournament Organizer desktop app.
// Professional, card-based layout with large action tiles, event cards,
// statistics and quick actions.
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { disk, StoredProjectMeta } from '../engine/storage';
import { desktop } from '../engine/desktop';
import { APP_NAME, APP_VERSION } from '../version';
import { describeFormat } from '../engine/generate';
import { useT } from '../i18n';
import {
  Alert, Button, Empty, Page, Panel,
} from './kit';
import SupportBanner from './SupportBanner';

function when(iso: string, t: ReturnType<typeof useT>): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return t('app.unknownDate');
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay(d, now)) return t('app.today', { time });
  const y = new Date(now.getTime() - 86_400_000);
  if (sameDay(d, y)) return t('app.yesterday', { time });
  return d.toLocaleDateString([], {
    day: 'numeric', month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/** Infer a human-readable status from the stored project metadata. */
function eventStatus(
  p: StoredProjectMeta,
  t: ReturnType<typeof useT>,
  publishEnabled: boolean,
): { key: string; label: string; color: string } {
  if (publishEnabled) {
    return { key: 'published', label: t('home.statusPublished'), color: 'purple' };
  }
  if (!p.participantCount || p.participantCount === 0) {
    return { key: 'planned', label: t('home.statusPlanned'), color: 'gray' };
  }
  return { key: 'preparing', label: t('home.statusPreparing'), color: 'blue' };
}

/** Format count with thousands separator. */
function fmtCount(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function Home() {
  const { go, openProject, deleteProject, settings, importFile } = useApp();
  const t = useT();
  const [err, setErr] = useState('');
  const [list, setList] = useState<StoredProjectMeta[]>([]);

  useEffect(() => {
    setList(disk.list());
  }, []);

  const totalParticipants = useMemo(
    () => list.reduce((s, p) => s + (p.participantCount ?? 0), 0),
    [list],
  );
  const publishedCount = useMemo(
    () => (settings.publishEnabled ? list.length : 0),
    [list, settings.publishEnabled],
  );

  const askDel = (id: string, name: string) => {
    if (settings.confirmDestructive && !window.confirm(t('home.deleteConfirm', { name }))) return;
    deleteProject(id);
    setList(disk.list());
  };

  const openFromFile = async () => {
    setErr('');
    try {
      const f = await desktop.openText();
      if (!f) return;
      importFile(f.text, f.path);
      setList(disk.list());
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('error.fileOpen'));
    }
  };

  const openStored = (id: string) => {
    setErr('');
    if (!openProject(id)) {
      setErr(t('error.projectOpen'));
    }
  };

  // ------------------------------------------------------------------ render

  const hasProjects = list.length > 0;

  return (
    <>
      <div className="wrap home-dashboard">
        {/* Welcome header */}
        <header className="home-header">
          <div className="home-brand">
            <div className="home-logo">🏆</div>
            <div>
              <div className="home-app-name">{APP_NAME}</div>
              <div className="home-app-tagline">{t('app.tagline')}</div>
            </div>
          </div>
          <div className="home-greeting">
            <h1>{t('home.welcome', { user: 'Organizer' })}</h1>
            <p className="home-greeting-sub">{t('home.whatToDo')}</p>
          </div>
        </header>

        {/* Main action tiles */}
        <section className="home-section">
          <h2 className="home-section-title">{t('home.whatToDo')}</h2>
          <div className="home-tile-grid">
            <button className="home-tile home-tile-primary" onClick={() => go('tournament-type')}>
              <div className="home-tile-icon">+</div>
              <div className="home-tile-body">
                <h3>{t('home.createTournament')}</h3>
                <p className="home-tile-sub">{t('home.createTournamentSub')}</p>
              </div>
            </button>
            <button className="home-tile" onClick={openFromFile}>
              <div className="home-tile-icon">📁</div>
              <div className="home-tile-body">
                <h3>{t('home.openEvent')}</h3>
                <p className="home-tile-sub">{t('home.openEventSub')}</p>
              </div>
            </button>
            <button className="home-tile" onClick={() => go('import')}>
              <div className="home-tile-icon">↻</div>
              <div className="home-tile-body">
                <h3>{t('home.importEvent')}</h3>
                <p className="home-tile-sub">{t('home.importEventSub')}</p>
              </div>
            </button>
          </div>
        </section>

        {err && <Alert tone="err" title={t('home.couldNotOpen')}>{err}</Alert>}

        {/* Statistics */}
        <section className="home-section">
          <h2 className="home-section-title">{t('home.statistics')}</h2>
          <div className="home-stat-grid">
            <div className="home-stat-card">
              <div className="home-stat-value">{fmtCount(list.length)}</div>
              <div className="home-stat-label">{t('home.totalEvents')}</div>
            </div>
            <div className="home-stat-card">
              <div className="home-stat-value">{fmtCount(totalParticipants)}</div>
              <div className="home-stat-label">{t('home.totalParticipants')}</div>
            </div>
            <div className="home-stat-card">
              <div className="home-stat-value">—</div>
              <div className="home-stat-label">{t('home.totalMatches')}</div>
            </div>
            <div className="home-stat-card">
              <div className="home-stat-value">{fmtCount(publishedCount)}</div>
              <div className="home-stat-label">{t('home.publishedOnline')}</div>
            </div>
          </div>
        </section>

        {/* Recent events */}
        <section className="home-section">
          <div className="home-section-header">
            <h2 className="home-section-title">{t('home.recentEvents')}</h2>
            <p className="home-section-sub">{t('home.recentEventsSub')}</p>
          </div>

          {hasProjects ? (
            <div className="home-event-grid">
              {list.map(p => {
                const status = eventStatus(p, t, settings.publishEnabled ?? false);
                const fmt = p.format ? describeFormat(p.format) : '—';
                return (
                  <article key={p.id} className="home-event-card">
                    <div className="home-event-header">
                      <div className="home-event-number">#{p.id.slice(-4)}</div>
                      <span className={`home-event-badge home-badge-${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <h3 className="home-event-name">{p.name || t('app.untitled')}</h3>
                    <div className="home-event-meta">
                      <span className="home-event-meta-item">
                        <span className="home-event-meta-icon">📋</span>
                        {fmt}
                      </span>
                      <span className="home-event-meta-item">
                        <span className="home-event-meta-icon">👥</span>
                        {fmtCount(p.participantCount ?? 0)}
                      </span>
                      <span className="home-event-meta-item">
                        <span className="home-event-meta-icon">🕒</span>
                        {when(p.updatedAt, t)}
                      </span>
                    </div>
                    <div className="home-event-actions">
                      <Button className="btn primary" onClick={() => openStored(p.id)}>
                        {t('home.open')}
                      </Button>
                      <Button
                        className="btn quiet"
                        onClick={() => askDel(p.id, p.name || '')}
                      >
                        {t('home.delete')}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty
              title={t('home.noProjects')}
              hint={t('home.noProjectsSub')}
              action={
                <Button className="btn primary" onClick={() => go('tournament-type')}>
                  {t('home.createFirst')}
                </Button>
              }
            />
          )}
        </section>

        {/* Quick actions */}
        <section className="home-section">
          <h2 className="home-section-title">{t('home.quickActions')}</h2>
          <div className="home-quick-grid">
            <button className="home-quick-tile" onClick={() => go('settings')}>
              <div className="home-quick-icon">⚙</div>
              <div className="home-quick-label">{t('nav.settings')}</div>
            </button>
          </div>
        </section>

        <p className="appfoot home-footer">
          {t('app.footer', { name: APP_NAME, version: APP_VERSION })}
        </p>

        <SupportBanner />
      </div>
    </>
  );
}
