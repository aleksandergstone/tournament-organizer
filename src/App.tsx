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
import Codes from './ui/Codes';
import ErrorBoundary from './ui/ErrorBoundary';
import { Alert } from './ui/kit';
import { parseDeepLink, resolveDeepLink } from './engine/deeplink';
import { nowIso } from './engine/types';

// Navigation is grouped by what the organizer is doing, not by feature name.
const NAV: { items: readonly (readonly [Screen, string])[] }[] = [
  { items: [['home', 'Home'], ['overview', 'Overview'], ['participants', 'Players'], ['rules', 'Rules']] },
  { items: [['bracket', 'Bracket'], ['matches', 'Results'], ['standings', 'Standings']] },
  { items: [['schedule', 'Schedule'], ['display', 'Display'], ['codes', 'QR codes'], ['export', 'Output']] },
];

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
        {hasProject && domain.tournament.name ? (
          <span className="topbar-proj" title="Open tournament">{domain.tournament.name}</span>
        ) : null}
        <nav>{NAV.map((group, gi) => (
          <span className="nav-group" key={gi}>
            {gi > 0 ? <span className="divider" /> : null}
            {group.items.map(([k, label]) => (
              <button key={k} className={screen === k ? 'on' : ''} onClick={() => go(k)} disabled={(k !== 'home' && !hasProject)}>{label}</button>
            ))}
          </span>
        ))}</nav>
        <span className="sp" />
        <span className="acts">
          <button onClick={undo_} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">Undo</button>
          <button onClick={redo_} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">Redo</button>
          <button onClick={save} title="Save now (Ctrl+S)" className={dirty ? 'primary-save' : ''}>{dirty ? '● Unsaved' : 'Saved'}</button>
          <span className={'save-state' + (dirty ? ' dirty' : '')}>{lastSaved ? new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
          <span className="divider" />
          <button onClick={() => go('settings')} title="Settings" aria-label="Settings">Settings</button>
        </span>
      </div>
      {(saveError || linkMsg) && (
        <div className="wrap" style={{ paddingTop: 14, paddingBottom: 0 }}>
          {saveError && (
            <Alert tone="err" title="This project could not be saved to disk">
              Your work is safe in memory, but free up some disk space and save again.
              To keep a copy right now use <b>Export → Save project file</b>.
            </Alert>
          )}
          {linkMsg && (
            <Alert tone={linkMsg.kind === 'err' ? 'err' : 'ok'}>
              {linkMsg.kind === 'err' ? <b>Code not opened — </b> : null}{linkMsg.text}
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
      {screen === 'codes' && (hasProject ? <Codes /> : <Home />)}
      {screen === 'export' && (hasProject ? <Output /> : <Home />)}
      {screen === 'settings' && <Settings />}
      {screen === 'import' && <Import />}
    </div>
  );
}
