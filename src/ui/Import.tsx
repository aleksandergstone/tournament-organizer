import { useState } from 'react';
import { useApp } from '../state/store';
import { desktop } from '../engine/desktop';

export default function Import() {
  const { importJson, importFile, go } = useApp();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [warn, setWarn] = useState<string[]>([]);
  const doImport = () => {
    try { const w = importJson(text); setWarn(w); setErr(''); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Import failed'); }
  };
  const fromFile = async () => {
    try {
      const f = await desktop.openText();
      if (!f) return;
      if ((f as { error?: string }).error) { setErr('Could not read file: ' + (f as { error?: string }).error); return; }
      const w = importFile(f.text, f.path);
      setWarn(w); setErr('');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Import failed'); }
  };
  return (
    <div className="wrap"><h1>Import / recovery / backup</h1>
      {err && <div className="err">{err}</div>}
      {warn.map((w,i) => <div key={i} className="warn">{w}</div>)}
      <div className="card"><h3>Open project file</h3>
        <button className="btn primary" onClick={fromFile}>Choose .top.json file{desktop.available ? ' (file dialog)' : ''}</button>
        <p className="muted">Validated before anything is overwritten. Used for recovery after a crash too.</p>
      </div>
      <div className="card"><h3>Or paste project JSON</h3>
        <textarea rows={8} value={text} onChange={e => setText(e.target.value)} placeholder='Paste .top.json content here' />
        <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={doImport}>Validate &amp; open</button><button className="btn" onClick={() => go('home')}>Back</button></div>
        <p className="muted">Corrupted files are rejected with an explicit error — nothing is overwritten until validation passes.</p>
      </div>
    </div>
  );
}
