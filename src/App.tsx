import { useEffect } from 'react';
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

const NAV = [
  ['home', 'Home'], ['overview', 'Overview'], ['participants', 'Players'],
  ['rules', 'Rules'], ['bracket', 'Bracket'], ['matches', 'Results'],
  ['standings', 'Standings'], ['export', 'Export'],
] as const;

export default function App() {
  const { screen, go, undo_, redo_, canUndo, canRedo, save, dirty, lastSaved, saveError, hasProject } = useApp();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo_(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo_(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo_, redo_, save]);
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
      {screen === 'home' && <Home />}
      {screen === 'wizard' && <Wizard />}
      {screen === 'overview' && (hasProject ? <Overview /> : <Home />)}
      {screen === 'participants' && (hasProject ? <Participants /> : <Home />)}
      {screen === 'rules' && (hasProject ? <Rules /> : <Home />)}
      {screen === 'bracket' && (hasProject ? <Bracket /> : <Home />)}
      {screen === 'matches' && (hasProject ? <Matches /> : <Home />)}
      {screen === 'standings' && (hasProject ? <Standings /> : <Home />)}
      {screen === 'export' && (hasProject ? <Export /> : <Home />)}
      {screen === 'settings' && <Settings />}
      {screen === 'import' && <Import />}
    </div>
  );
}
