// Import / recovery — opening a project file, with validation before anything
// on this device is replaced.
import { useState } from 'react';
import { useApp } from '../state/store';
import { desktop } from '../engine/desktop';
import { Alert, Page, Panel } from './kit';
import { useT } from '../i18n';

export default function Import() {
  const t = useT();
  const { importJson, importFile, go } = useApp();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [warn, setWarn] = useState<string[]>([]);
  const doImport = () => {
    setErr('');
    if (!text.trim()) { setErr(t('imp.errEmpty')); return; }
    try { setWarn(importJson(text)); }
    catch (e) { setErr(e instanceof Error ? e.message : t('error.fileOpen')); }
  };
  const fromFile = async () => {
    setErr(''); setWarn([]);
    try {
      const f = await desktop.openText();
      if (!f) return;
      if ((f as { error?: string }).error) { setErr('That file could not be read: ' + (f as { error?: string }).error); return; }
      setWarn(importFile(f.text, f.path));
    } catch (e) { setErr(e instanceof Error ? e.message : t('error.fileOpen')); }
  };
  return (
    <Page title={t('imp.title')} sub={t('imp.sub')}>
      {err && <Alert tone="err" title={t('imp.nothingChanged')}>{err}</Alert>}
      {warn.length > 0 && (
        <Alert tone="warn" title={t('imp.openedWithNotes')}>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {warn.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </Alert>
      )}

      <Panel title={t('imp.openPanel')} sub={t('imp.openPanelSub')}>
        <div className="row">
          <button className="btn primary" onClick={fromFile}>{t('imp.chooseFileShort')}{desktop.available ? '…' : ''}</button>
          <span className="muted">{t('imp.checkedHint')}</span>
        </div>
      </Panel>

      <Panel title={t('imp.pastePanel')} sub={t('imp.pastePanelSub')}>
        <textarea rows={8} value={text} onChange={e => setText(e.target.value)} placeholder={t('imp.pastePlaceholder')} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={doImport} disabled={!text.trim()}>{t('imp.validate')}</button>
          <button className="btn" onClick={() => go('home')}>{t('imp.backToProjects')}</button>
          <span className="muted">{t('imp.corruptHint')}</span>
        </div>
      </Panel>
    </Page>
  );
}
