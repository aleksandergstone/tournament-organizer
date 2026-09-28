// LAN sync — several devices on the same local network share one tournament.
// No internet, no account, no cloud: one device shares (host), others pull or
// push. Merging follows the fixed rules in src/engine/sync.ts and every merge
// is written to the project history so it can be undone.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { desktop, lanBase, LanInfo } from '../engine/desktop';
import { makePayload, mergeProjects, parsePayload } from '../engine/sync';
import { Alert } from './kit';
import { useT } from '../i18n';

const POLL_MS = 3000;

export default function SyncPanel() {
  const t = useT();
  const { domain, projectFile, applyMerged, hasProject } = useApp();
  const [hosting, setHosting] = useState<LanInfo | null>(null);
  const [addr, setAddr] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lastPush = useRef(0);

  const note = (line: string) => setLog(l => [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${line}`, ...l].slice(0, 8));

  const mergeIncoming = useCallback((raw: unknown, from: string) => {
    const parsed = parsePayload(raw);
    if (!parsed.ok) { setErr(parsed.error); return false; }
    const local = projectFile();
    const res = mergeProjects(local, parsed.payload.project);
    if (!res.ok) { setErr(res.note); return false; }
    const changed = res.fromRemote.length > 0 || res.structureFromRemote;
    if (changed) applyMerged(res.merged, `${from}: ${res.note}`);
    note(changed ? t('sync.merged', { from, note: res.note }) : t('sync.nothingNew', { from }));
    return true;
  }, [projectFile, applyMerged]);

  // Keep the shared copy fresh while hosting.
  useEffect(() => {
    if (!hosting || !hasProject) return;
    void desktop.lanPublish(makePayload(projectFile()));
    lastPush.current = Date.now();
  }, [hosting, domain, hasProject, projectFile]);

  // Pick up states pushed by other devices.
  useEffect(() => {
    if (!hosting) return;
    const t = setInterval(async () => {
      try {
        const items = await desktop.lanInbox();
        for (const it of items) mergeIncoming(it.payload, 'device');
      } catch { /* transient network hiccup — try again next tick */ }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [hosting, mergeIncoming]);

  const startHost = async () => {
    setErr(''); setBusy(true);
    try {
      const info = await desktop.lanStart();
      if (!info.ok) { setErr(info.error ?? t('sync.errStart')); return; }
      setHosting(info);
      note(t('sync.started', { urls: (info.urls ?? []).join(', ') }));
    } catch (e) { setErr(e instanceof Error ? e.message : t('sync.errStart')); }
    finally { setBusy(false); }
  };
  const stopHost = async () => {
    await desktop.lanStop();
    setHosting(null);
    note(t('sync.stopped'));
  };
  const pull = async () => {
    setErr(''); setBusy(true);
    try {
      const raw = await desktop.lanPull(addr);
      mergeIncoming(raw, lanBase(addr));
    } catch (e) { setErr(e instanceof Error ? e.message : t('sync.errReceive')); }
    finally { setBusy(false); }
  };
  const push = async () => {
    setErr(''); setBusy(true);
    try {
      await desktop.lanPush(addr, makePayload(projectFile()));
      note(t('sync.sent', { to: lanBase(addr) }));
    } catch (e) { setErr(e instanceof Error ? e.message : t('sync.errSend')); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <h3>{t('sync.hostTitle')}</h3>
      <p className="muted">{t('sync.hostSub')}</p>
      {!hosting ? (
        <button className="btn primary" onClick={startHost} disabled={busy || !hasProject}>{t('sync.start')}</button>
      ) : (
        <>
          <div className="ok">
            {t('sync.sharing')}
            {(hosting.urls ?? []).map(u => <div key={u}><code>{u}</code></div>)}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={stopHost} disabled={busy}>{t('sync.stop')}</button>
            <span className="muted">{t('sync.firewall')}</span>
          </div>
        </>
      )}

      <h3 style={{ marginTop: 18 }}>{t('sync.otherDevice')}</h3>
      <div className="row">
        <input style={{ maxWidth: 320 }} value={addr} onChange={e => setAddr(e.target.value)}
          placeholder={t('sync.addressPlaceholder')} />
        <button className="btn" onClick={pull} disabled={busy || !addr}>{t('sync.pull')}</button>
        <button className="btn" onClick={push} disabled={busy || !addr || !hasProject}>{t('sync.push')}</button>
      </div>

      {err && <Alert tone="err" title={t('sync.problem')}>{err}</Alert>}

      <details className="disclosure" style={{ marginTop: 10 }}>
        <summary>{t('sync.rulesTitle')}</summary>
        <ul className="muted" style={{ fontSize: 13, paddingLeft: 18, margin: '8px 0 0' }}>
          <li>{t('sync.rule1')}</li>
          <li>{t('sync.rule2')}</li>
          <li>{t('sync.rule3')}</li>
          <li>{t('sync.rule4')}</li>
        </ul>
      </details>

      {log.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <tbody>
              {log.map((l, i) => (
                <tr key={i}>
                  <td className="muted tnum nowrap" style={{ width: 90 }}>{l.split(' — ')[0]}</td>
                  <td>{l.split(' — ').slice(1).join(' — ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
