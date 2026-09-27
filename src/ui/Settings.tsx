import { useApp } from '../state/store';
import { describeEdition } from '../engine/features';
import { APP_NAME, APP_VERSION } from '../version';

export default function Settings() {
  const { settings, setSettings } = useApp();
  return (
    <div className="wrap"><h1>Settings</h1>
      <div className="card">
        <h3>Preferences</h3>
        <label className="row"><input type="checkbox" style={{ width: 16 }} checked={settings.autosave} onChange={e => setSettings({ ...settings, autosave: e.target.checked })} /> Autosave (local, ~1s after change)</label>
        <label className="row"><input type="checkbox" style={{ width: 16 }} checked={settings.confirmDestructive} onChange={e => setSettings({ ...settings, confirmDestructive: e.target.checked })} /> Confirm destructive actions</label>
        <label className="f" style={{ maxWidth: 240 }}>Theme<select value={settings.theme} onChange={e => setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' })}><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <p className="muted">Shortcuts: <span className="kbd">Ctrl+Z</span> undo · <span className="kbd">Ctrl+Y</span> redo · <span className="kbd">Ctrl+S</span> save now.</p>
      </div>
      <div className="card">
        <h3>About</h3>
        <table><tbody>
          <tr><td className="muted">Application</td><td><b>{APP_NAME}</b></td></tr>
          <tr><td className="muted">Version</td><td>{APP_VERSION}</td></tr>
          <tr><td className="muted">Edition</td><td>{describeEdition('free')}</td></tr>
          <tr><td className="muted">Data</td><td>Stored only on this device — no account, no server, works fully offline.</td></tr>
          <tr><td className="muted">License</td><td>MIT</td></tr>
        </tbody></table>
        <p className="muted">Projects are autosaved locally. Use <b>Export → Save .top.json</b> for backups you can move between computers.</p>
      </div>
    </div>
  );
}
