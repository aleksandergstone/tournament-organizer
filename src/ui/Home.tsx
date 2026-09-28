import { useApp } from '../state/store';
import { desktop } from '../engine/desktop';
import { disk, StoredProjectMeta } from '../engine/storage';
import { useState } from 'react';
import { APP_NAME, APP_VERSION } from '../version';
import { Alert, Empty, Panel } from './kit';
import { describeFormat } from '../engine/generate';
import { useT } from '../i18n';
import type { Translate } from '../i18n';

/** Compact, scannable timestamps: "Today 21:40", "Yesterday", "12 Sep 2026". */
function when(iso: string, t: Translate): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return t('app.unknownDate');
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay(d, now)) return t('app.today', { time });
  const y = new Date(now.getTime() - 86_400_000);
  if (sameDay(d, y)) return t('app.yesterday', { time });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export default function Home() {
  const { go, openProject, deleteProject, settings, importFile } = useApp();
  const t = useT();
  const [err, setErr] = useState('');
  const list: StoredProjectMeta[] = disk.list();
  const askDel = (id: string, name: string) => {
    if (settings.confirmDestructive && !window.confirm(t('home.deleteConfirm', { name }))) return;
    deleteProject(id);
  };
  const openFromFile = async () => {
    setErr('');
    try {
      const f = await desktop.openText();
      if (!f) return;
      importFile(f.text, f.path);
    } catch (e) { setErr(e instanceof Error ? e.message : t('error.fileOpen')); }
  };
  const openStored = (id: string) => {
    setErr('');
    if (!openProject(id)) {
      setErr(t('error.projectOpen'));
    }
  };
  return (
    <div className="wrap">
      <section className="card hero">
        <h1>{t('app.name')}</h1>
        <p className="page-sub">{t('app.tagline')}</p>
        <div className="row">
          <button className="btn primary lg" onClick={() => go('wizard')}>{t('home.new')}</button>
          <button className="btn lg" onClick={openFromFile}>{t('home.openFile')}</button>
          <button className="btn quiet" onClick={() => go('import')}>{t('home.import')}</button>
          <button className="btn quiet" onClick={() => go('settings')}>{t('home.settings')}</button>
        </div>
        {list.length === 0 && (
          <>
            <ol className="hero-steps">
              <li><span>{t('home.step1', { b: t('home.step1b') })}</span></li>
              <li><span>{t('home.step2', { b: t('home.step2b') })}</span></li>
              <li><span>{t('home.step3', { b: t('home.step3b') })}</span></li>
            </ol>
            <p className="page-sub" style={{ marginTop: 16 }}>
              {t('home.autosave')}
            </p>
          </>
        )}
      </section>

      {err && <Alert tone="err" title={t('home.couldNotOpen')}>{err}</Alert>}

      {list.length > 0 && (
        <Panel title={t('home.projects')} sub={t('home.projectsSub', { n: list.length })}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('home.project')}</th><th>{t('common.format')}</th><th className="num">{t('common.players')}</th><th>{t('home.lastChange')}</th><th /></tr></thead>
              <tbody>{list.map(p => (
                <tr key={p.id}>
                  <td className="name">{p.name || t('app.untitled')}</td>
                  <td className="muted">{p.format ? describeFormat(p.format) : '—'}</td>
                  <td className="num muted">{p.participantCount ?? '—'}</td>
                  <td className="muted nowrap">{when(p.updatedAt, t)}</td>
                  <td className="actions">
                    <button className="btn sm primary" onClick={() => openStored(p.id)}>{t('home.openProject')}</button>{' '}
                    <button className="btn sm quiet" onClick={() => askDel(p.id, p.name)}>{t('common.delete')}</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
      )}

      {list.length === 0 && (
        <Panel title={t('home.openPanel')}>
          <Empty
            title={t('home.emptyTitle')}
            hint={t('home.emptyHint')}
            action={<><button className="btn" onClick={openFromFile}>{t('home.openFile')}</button>
              <button className="btn" onClick={() => go('import')}>{t('home.import')}</button></>}
          />
        </Panel>
      )}

      <p className="appfoot">{t('app.footer', { name: APP_NAME, version: APP_VERSION })}</p>
    </div>
  );
}
