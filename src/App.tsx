import { useEffect, useState } from 'react';
import { useApp, Screen } from './state/store';
import { APP_NAME, APP_VERSION } from './version';
import Home from './ui/Home';
import Wizard from './ui/Wizard';
import Overview from './ui/Overview';
import Participants from './ui/Participants';
import Rules from './ui/Rules';
import Bracket from './ui/Bracket';
import Matches from './ui/Matches';
import Standings from './ui/Standings';
import Output from './ui/Output';
import Settings from './ui/Settings';
import Import from './ui/Import';
import Display from './ui/Display';
import Schedule from './ui/Schedule';
import ComingSoon from './ui/ComingSoon';
import ErrorBoundary from './ui/ErrorBoundary';
import { Alert } from './ui/kit';
import { parseDeepLink, resolveDeepLink } from './engine/deeplink';
import { hasBracket } from './engine/generate';
import { isNativeApp } from './engine/mobile-bridge';
import { App as CapacitorApp } from '@capacitor/app';
import { nowIso } from './engine/types';
import { useT, type Dict } from './i18n';

// Navigation is grouped by what the organizer is doing, not by feature name.
const NAV: { items: readonly (readonly [Screen, keyof Dict])[] }[] = [
  { items: [['home', 'nav.home'], ['overview', 'nav.overview'], ['participants', 'nav.participants'], ['rules', 'nav.rules']] },
  { items: [['bracket', 'nav.bracket'], ['matches', 'nav.results'], ['standings', 'nav.standings']] },
  { items: [['schedule', 'nav.schedule'], ['display', 'nav.display'], ['codes', 'nav.codes'], ['export', 'nav.output']] },
];

// A window opened with #display is a projector: organizer controls are hidden.
const DISPLAY_WINDOW = typeof window !== 'undefined' && window.location.hash === '#display';

export default function App() {
  const { screen, go, back, undo_, redo_, canUndo, canRedo, save, dirty, lastSaved, saveError, hasProject,
    domain, update, setFocusMatch } = useApp();
  const t = useT();
  const [linkMsg, setLinkMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // On a phone the hardware back button walks out of a screen; at the Home
  // screen it falls through to Android, which closes the app.
  useEffect(() => {
    if (!isNativeApp()) return;
    let detach: (() => void) | undefined;
    void CapacitorApp.addListener('backButton', () => { back(); })
      .then(handle => { detach = () => { void handle.remove(); }; });
    return () => detach?.();
  }, [back]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo_(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo_(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo_, redo_, save]);

  // QR deep link: to://<project>/<kind>/<id> → jump straight to the target.
  useEffect(() => {
    const raw = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
    if (!raw || raw === 'display') return;
    window.history.replaceState(null, '', window.location.pathname);
    const parsed = parseDeepLink(raw);
    if (!parsed.ok) { setLinkMsg({ kind: 'err', text: parsed.error }); return; }
    if (!hasProject) {
      setLinkMsg({ kind: 'err', text: t('link.projectMissing') });
      return;
    }
    const action = resolveDeepLink(parsed.link, {
      id: domain.tournament.id,
      participants: domain.participants,
      matches: domain.matches,
      resources: domain.resources ?? [],
    });
    if (action.kind === 'error') { setLinkMsg({ kind: 'err', text: action.message }); return; }
    if (action.kind === 'checkin') {
      const p = domain.participants.find(x => x.id === action.participantId);
      update(d => ({
        ...d,
        participants: d.participants.map(x => (x.id === action.participantId
          ? { ...x, active: true, withdrawnRound: null, modifiedAt: nowIso() } : x)),
      }), `checkin ${p?.name ?? action.participantId}`);
      setLinkMsg({ kind: 'ok', text: t('link.checkedIn', { name: p?.name ?? t('common.unknown') }) });
      go('participants');
    } else if (action.kind === 'match') {
      setFocusMatch(action.matchId);
      setLinkMsg({ kind: 'ok', text: t('link.matchOpened') });
      go('matches');
    } else {
      setLinkMsg({ kind: 'ok', text: t('link.scheduleOpened') });
      setFocusMatch(null);
      go('schedule');
    }
  }, [hasProject, domain, update, go, setFocusMatch]);

  if (DISPLAY_WINDOW) {
    return <ErrorBoundary><Display /></ErrorBoundary>;
  }

  return (
    <div>
      <div className="topbar">
        <span className="brand" title={`${APP_NAME} ${APP_VERSION}`}>TO</span>
        {hasProject && domain.tournament.name ? (
          <span className="topbar-proj" title={t('nav.openTournament')}>{domain.tournament.name}</span>
        ) : null}
        <nav>{NAV.map((group, gi) => {
          // The bracket only exists when the format has one; QR codes are
          // temporarily parked, so they do not clutter the navigation.
          const items = group.items.filter(([k]) => k !== 'codes'
            && (k !== 'bracket' || hasBracket(domain.tournament.format)));
          if (!items.length) return null;
          return (
            <span className="nav-group" key={gi}>
              {gi > 0 ? <span className="divider" /> : null}
              {items.map(([k, label]) => (
                <button key={k} className={screen === k ? 'on' : ''} onClick={() => go(k)} disabled={(k !== 'home' && !hasProject)}>{t(label)}</button>
              ))}
            </span>
          );
        })}</nav>
        <span className="sp" />
        <span className="acts">
          <button onClick={undo_} disabled={!canUndo} title={t('nav.undo') + ' (Ctrl+Z)'} aria-label={t('nav.undo')}>{t('nav.undo')}</button>
          <button onClick={redo_} disabled={!canRedo} title={t('nav.redo') + ' (Ctrl+Y)'} aria-label={t('nav.redo')}>{t('nav.redo')}</button>
          <button onClick={save} title={t('nav.saveNow')} className={dirty ? 'primary-save' : ''}>{dirty ? t('common.unsaved') : t('common.saved')}</button>
          <span className={'save-state' + (dirty ? ' dirty' : '')}>{lastSaved ? new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
          <span className="divider" />
          <button onClick={() => go('settings')} title={t('nav.settings')} aria-label={t('nav.settings')}>{t('nav.settings')}</button>
        </span>
      </div>
      {(saveError || linkMsg) && (
        <div className="wrap" style={{ paddingTop: 14, paddingBottom: 0 }}>
          {saveError && (
            <Alert tone="err" title={t('error.save.title')}>
              {t('error.save.body', { action: t('error.save.action') })}
            </Alert>
          )}
          {linkMsg && (
            <Alert tone={linkMsg.kind === 'err' ? 'err' : 'ok'}>
              {linkMsg.kind === 'err' ? <b>{t('link.failed')}</b> : null}{linkMsg.text}
            </Alert>
          )}
        </div>
      )}
      {screen === 'home' && <Home />}
      {screen === 'wizard' && <Wizard />}
      {screen === 'overview' && (hasProject ? <Overview /> : <Home />)}
      {screen === 'participants' && (hasProject ? <Participants /> : <Home />)}
      {screen === 'rules' && (hasProject ? <Rules /> : <Home />)}
      {screen === 'bracket' && (hasProject ? <Bracket /> : <Home />)}
      {screen === 'matches' && (hasProject ? <Matches /> : <Home />)}
      {screen === 'standings' && (hasProject ? <Standings /> : <Home />)}
      {screen === 'schedule' && (hasProject ? <Schedule /> : <Home />)}
      {screen === 'display' && (hasProject ? <Display /> : <Home />)}
      {screen === 'codes' && <ComingSoon title="codes" />}
      {screen === 'export' && (hasProject ? <Output /> : <Home />)}
      {screen === 'settings' && <Settings />}
      {screen === 'import' && <Import />}
    </div>
  );
}
