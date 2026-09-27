import { useEffect, useState } from 'react';
import { useApp } from './state/store';
import { APP_NAME, APP_VERSION } from './version';
import Home from './ui/Home';
import Wizard from './ui/Wizard';
import Overview from './ui/Overview';
import Participants from './ui/Participants';
import Rules from './ui/Rules';
import Bracket from './ui/Bracket';
import Matches from './ui/Matches';
import Standings from './ui/Standings';
import Export from './ui/Export';
import Settings from './ui/Settings';
import Import from './ui/Import';
import Display from './ui/Display';
import Schedule from './ui/Schedule';
import Codes from './ui/Codes';
import ErrorBoundary from './ui/ErrorBoundary';
import { parseDeepLink, resolveDeepLink } from './engine/deeplink';
import { nowIso } from './engine/types';

const NAV = [
  ['home', 'Home'], ['overview', 'Overview'], ['participants', 'Players'],
  ['rules', 'Rules'], ['bracket', 'Bracket'], ['matches', 'Results'],
  ['standings', 'Standings'], ['schedule', 'Schedule'], ['display', 'Display'],
  ['codes', 'QR codes'], ['export', 'Export'],
] as const;

// A window opened with #display is a projector: organizer controls are hidden.
const DISPLAY_WINDOW = typeof window !== 'undefined' && window.location.hash === '#display';

export default function App() {
  const { screen, go, undo_, redo_, canUndo, canRedo, save, dirty, lastSaved, saveError, hasProject,
    domain, update, setFocusMatch } = useApp();
  const [linkMsg, setLinkMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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
      setLinkMsg({ kind: 'err', text: 'Open the project this code belongs to, then scan the code again.' });
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
      setLinkMsg({ kind: 'ok', text: `${p?.name ?? 'Participant'} checked in.` });
      go('participants');
    } else if (action.kind === 'match') {
      setFocusMatch(action.matchId);
      setLinkMsg({ kind: 'ok', text: 'Opened the match from the code.' });
      go('matches');
    } else {
      setLinkMsg({ kind: 'ok', text: 'Opened the schedule — showing this place first.' });
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
        <nav>{NAV.map(([k, label]) => (
          <button key={k} className={screen === k ? 'on' : ''} onClick={() => go(k as never)} disabled={(k !== 'home' && !hasProject)}>{label}</button>
        ))}</nav>
        <span className="sp" />
        <span className="acts">
          <button onClick={undo_} disabled={!canUndo} title="Ctrl+Z">Undo</button>
          <button onClick={redo_} disabled={!canRedo} title="Ctrl+Y">Redo</button>
          <button onClick={save} title="Ctrl+S">{dirty ? '● Save' : 'Saved'}</button>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{lastSaved ? new Date(lastSaved).toLocaleTimeString() : ''}</span>
        </span>
      </div>
      {saveError && (
        <div className="wrap" style={{ paddingTop: 10, paddingBottom: 0 }}>
          <div className="err">
            Could not save to this device ({saveError}). Your changes are kept in memory —
            use <b>Export → Save .top.json</b> to store a backup file, then free up disk space and try again.
          </div>
        </div>
      )}
      {linkMsg && (
        <div className="wrap" style={{ paddingTop: 10, paddingBottom: 0 }}>
          <div className={linkMsg.kind === 'err' ? 'err' : 'ok'}>{linkMsg.text}</div>
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
      {screen === 'codes' && (hasProject ? <Codes /> : <Home />)}
      {screen === 'export' && (hasProject ? <Export /> : <Home />)}
      {screen === 'settings' && <Settings />}
      {screen === 'import' && <Import />}
    </div>
  );
}
