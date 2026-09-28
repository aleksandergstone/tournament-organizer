// Settings — grouped by how often the organizer touches them.
// Everything here is optional; the app works with the defaults.
import { useApp } from '../state/store';
import { describeEdition } from '../engine/features';
import { APP_NAME, APP_VERSION } from '../version';
import { Page, Panel, Segmented, Switch } from './kit';
import SyncPanel from './SyncPanel';

export default function Settings() {
  const { settings, setSettings } = useApp();
  return (
    <Page title="Settings" sub="Preferences for this computer. Nothing is sent anywhere.">
      <Panel title="Appearance">
        <div className="row">
          <span className="f-label" id="theme-label" style={{ minWidth: 70 }}>Theme</span>
          <Segmented
            value={settings.theme}
            onChange={v => setSettings({ ...settings, theme: v })}
            options={[{ id: 'light' as const, label: 'Light' }, { id: 'dark' as const, label: 'Dark' }]}
            label="Theme"
          />
          <span className="muted">Dark is easier on the eyes in a dim hall.</span>
        </div>
      </Panel>

      <Panel title="Working style">
        <Switch
          checked={settings.autosave}
          onChange={v => setSettings({ ...settings, autosave: v })}
          label="Autosave on this device"
          hint="Saves about a second after every change. Recommended — leave this on."
        />
        <Switch
          checked={settings.confirmDestructive}
          onChange={v => setSettings({ ...settings, confirmDestructive: v })}
          label="Ask before destructive actions"
          hint="Confirmation before deleting a project, removing a player or regenerating a bracket."
        />
        <p className="table-note">
          Shortcuts: <span className="kbd">Ctrl+Z</span> undo · <span className="kbd">Ctrl+Y</span> redo ·{' '}
          <span className="kbd">Ctrl+S</span> save now.
        </p>
      </Panel>

      <Panel title="Sharing on the local network" sub="Optional. Keeps everything on your Wi-Fi — no internet, no account.">
        <SyncPanel />
      </Panel>

      <Panel title="About">
        <div className="table-wrap">
          <table>
            <tbody>
              <tr><td className="muted">Application</td><td className="name">{APP_NAME}</td></tr>
              <tr><td className="muted">Version</td><td>{APP_VERSION}</td></tr>
              <tr><td className="muted">Edition</td><td>{describeEdition('free')}</td></tr>
              <tr><td className="muted">Data</td><td>Stored only on this device — no account, no server, works fully offline.</td></tr>
              <tr><td className="muted">License</td><td>MIT</td></tr>
            </tbody>
          </table>
        </div>
        <p className="table-note">
          Projects are autosaved locally. Use <b>Export → Save project file</b> for backups you can move between computers.
        </p>
      </Panel>
    </Page>
  );
}
