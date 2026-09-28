// Import / recovery — opening a project file, with validation before anything
// on this device is replaced.
import { useState } from 'react';
import { useApp } from '../state/store';
import { desktop } from '../engine/desktop';
import { Alert, Page, Panel } from './kit';

export default function Import() {
  const { importJson, importFile, go } = useApp();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [warn, setWarn] = useState<string[]>([]);
  const doImport = () => {
    setErr('');
    if (!text.trim()) { setErr('Paste the project JSON first, or use the file button above.'); return; }
    try { setWarn(importJson(text)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'That file could not be opened.'); }
  };
  const fromFile = async () => {
    setErr(''); setWarn([]);
    try {
      const f = await desktop.openText();
      if (!f) return;
      if ((f as { error?: string }).error) { setErr('That file could not be read: ' + (f as { error?: string }).error); return; }
      setWarn(importFile(f.text, f.path));
    } catch (e) { setErr(e instanceof Error ? e.message : 'That file could not be opened.'); }
  };
  return (
    <Page title="Import / recovery" sub="Open a project file exported earlier — after a crash, or to move to another computer.">
      {err && <Alert tone="err" title="Nothing was changed">{err}</Alert>}
      {warn.length > 0 && (
        <Alert tone="warn" title="The file was opened, with notes">
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {warn.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </Alert>
      )}

      <Panel title="Open a project file" sub="The normal way to restore a backup.">
        <div className="row">
          <button className="btn primary" onClick={fromFile}>Choose .top.json file{desktop.available ? '…' : ''}</button>
          <span className="muted">Checked before anything is overwritten — a damaged file never replaces your work.</span>
        </div>
      </Panel>

      <Panel title="Or paste project JSON" sub="For example the contents of a backup copied from another machine.">
        <textarea rows={8} value={text} onChange={e => setText(e.target.value)} placeholder='Paste .top.json content here' />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={doImport} disabled={!text.trim()}>Validate &amp; open</button>
          <button className="btn" onClick={() => go('home')}>Back to projects</button>
          <span className="muted">Corrupted files are rejected with an explicit reason.</span>
        </div>
      </Panel>
    </Page>
  );
}
