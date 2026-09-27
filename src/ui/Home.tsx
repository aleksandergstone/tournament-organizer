import { useApp } from '../state/store';
import { desktop } from '../engine/desktop';
import { disk, StoredProjectMeta } from '../engine/storage';
import { useState } from 'react';
import { APP_NAME, APP_VERSION } from '../version';

export default function Home() {
  const { go, openProject, deleteProject, settings, importFile } = useApp();
  const [err, setErr] = useState('');
  const list: StoredProjectMeta[] = disk.list();
  const askDel = (id: string, name: string) => {
    if (settings.confirmDestructive && !window.confirm(`Delete "${name}" from this device? Export first if needed.`)) return;
    deleteProject(id);
  };
  const openFromFile = async () => {
    try {
      const f = await desktop.openText();
      if (!f) return;
      importFile(f.text, f.path);
    } catch (e) { setErr(e instanceof Error ? e.message : 'The file could not be opened.'); }
  };
  const openStored = (id: string) => {
    if (!openProject(id)) {
      setErr('That project could not be opened — it may have been deleted or damaged. Try Import / Recovery with a backup .top.json file.');
    }
  };
  return (
    <div className="wrap">
      <h1>Tournament Organizer</h1>
      <p className="muted">Offline-first. No account. Projects save on this device.</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn primary" onClick={() => go('wizard')}>+ New tournament</button>
        <button className="btn" onClick={openFromFile}>Open file…</button>
        <button className="btn" onClick={() => go('import')}>Import / Recovery</button>
        <button className="btn" onClick={() => go('settings')}>Settings</button>
      </div>
      {err && <div className="err">{err}</div>}
      {list.length === 0 && (
        <div className="card">
          <h3>Get started in 3 steps</h3>
          <ol className="steps">
            <li><b>Create a tournament</b> — name it, pick a format (single/double elimination, groups, Swiss, league…).</li>
            <li><b>Add participants</b> — type names one by one or paste a whole list at once.</li>
            <li><b>Generate the bracket, enter results</b> — standings update automatically; export to file or print anytime.</li>
          </ol>
          <p className="muted">Everything works without internet. Your work autosaves on this device, and you can export a portable <span className="kbd">.top.json</span> backup at any time.</p>
        </div>
      )}
      <div className="card"><h3>Recent projects ({list.length})</h3>
        {list.length === 0 && <div className="empty">No projects yet. Create your first tournament — it takes 30 seconds.</div>}
        <table><tbody>{list.map(p => (
          <tr key={p.id}><td><b>{p.name || '(untitled)'}</b><div className="muted">updated {new Date(p.updatedAt).toLocaleString()}</div></td>
          <td style={{ textAlign: 'right' }}><button className="btn sm primary" onClick={() => openStored(p.id)}>Open</button>{' '}
          <button className="btn sm danger" onClick={() => askDel(p.id, p.name)}>Delete</button></td></tr>
        ))}</tbody></table>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>{APP_NAME} {APP_VERSION} · runs fully offline · MIT licensed</p>
    </div>
  );
}
