import { useApp } from '../state/store';
import { desktop } from '../engine/desktop';
import { disk, StoredProjectMeta } from '../engine/storage';
import { useState } from 'react';
import { APP_NAME, APP_VERSION } from '../version';
import { Alert, Empty, Panel } from './kit';
import { describeFormat } from '../engine/generate';

/** Compact, scannable timestamps: "Today 21:40", "Yesterday", "12 Sep 2026". */
function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown date';
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay(d, now)) return `Today ${time}`;
  const y = new Date(now.getTime() - 86_400_000);
  if (sameDay(d, y)) return `Yesterday ${time}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export default function Home() {
  const { go, openProject, deleteProject, settings, importFile } = useApp();
  const [err, setErr] = useState('');
  const list: StoredProjectMeta[] = disk.list();
  const askDel = (id: string, name: string) => {
    if (settings.confirmDestructive && !window.confirm(`Delete "${name}" from this device?\n\nExport a backup first if you may need it — this cannot be undone.`)) return;
    deleteProject(id);
  };
  const openFromFile = async () => {
    setErr('');
    try {
      const f = await desktop.openText();
      if (!f) return;
      importFile(f.text, f.path);
    } catch (e) { setErr(e instanceof Error ? e.message : 'That file could not be opened.'); }
  };
  const openStored = (id: string) => {
    setErr('');
    if (!openProject(id)) {
      setErr('That project could not be opened — it may have been deleted or damaged. Open a backup with “Import / recovery”.');
    }
  };
  return (
    <div className="wrap">
      <section className="card hero">
        <h1>Tournament Organizer</h1>
        <p className="page-sub">Run brackets, results and standings offline. No account, no internet — your projects stay on this computer.</p>
        <div className="row">
          <button className="btn primary lg" onClick={() => go('wizard')}>+ New tournament</button>
          <button className="btn lg" onClick={openFromFile}>Open file…</button>
          <button className="btn quiet" onClick={() => go('import')}>Import / recovery</button>
          <button className="btn quiet" onClick={() => go('settings')}>Settings</button>
        </div>
        {list.length === 0 && (
          <>
            <ol className="hero-steps">
              <li><span><b>Create</b> the tournament — name, format, dates.</span></li>
              <li><span><b>Add players</b> — one by one or paste a whole list.</span></li>
              <li><span><b>Generate</b> the bracket and enter results as they happen.</span></li>
            </ol>
            <p className="page-sub" style={{ marginTop: 16 }}>
              Everything autosaves on this device. Export a <span className="kbd">.top.json</span> backup whenever you like.
            </p>
          </>
        )}
      </section>

      {err && <Alert tone="err" title="Could not open the project">{err}</Alert>}

      {list.length > 0 && (
        <Panel title="Your projects" sub={`${list.length} on this device · newest first`}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Project</th><th>Format</th><th className="num">Players</th><th>Last change</th><th /></tr></thead>
              <tbody>{list.map(p => (
                <tr key={p.id}>
                  <td className="name">{p.name || '(untitled)'}</td>
                  <td className="muted">{p.format ? describeFormat(p.format) : '—'}</td>
                  <td className="num muted">{p.participantCount ?? '—'}</td>
                  <td className="muted nowrap">{when(p.updatedAt)}</td>
                  <td className="actions">
                    <button className="btn sm primary" onClick={() => openStored(p.id)}>Open</button>{' '}
                    <button className="btn sm quiet" onClick={() => askDel(p.id, p.name)}>Delete</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
      )}

      {list.length === 0 && (
        <Panel title="Open a project file">
          <Empty
            title="No projects on this device yet"
            hint="Create a new tournament above, or open a .top.json file you exported earlier — for example after moving to another computer."
            action={<><button className="btn" onClick={openFromFile}>Open file…</button>
              <button className="btn" onClick={() => go('import')}>Import / recovery</button></>}
          />
        </Panel>
      )}

      <p className="appfoot">{APP_NAME} {APP_VERSION} · works fully offline · MIT licensed</p>
    </div>
  );
}
