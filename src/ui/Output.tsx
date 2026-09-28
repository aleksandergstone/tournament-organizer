// Output — every document that leaves the app: branded PDF/print sheets, CSV
// data files and the full project backup.
//
// The screen renders the *same* HTML string in the preview iframe that it hands
// to the printer, so what an organizer sees is what comes out of the printer.
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { REPORT_KINDS, ReportKind, buildReport, reportToCsv } from '../engine/output';
import { renderReportHtml, reportFileName } from '../engine/pdf';
import { Branding, normalizeBranding } from '../engine/branding';
import { desktop } from '../engine/desktop';
import { fileNameFor, serializeProject } from '../engine/storage';
import { nowIso } from '../engine/types';
import { Alert, Empty, Page, Panel, Toolbar } from './kit';
import { BrandingForm } from './Branding';
import { useT } from '../i18n';

export default function Output() {
  const tr = useT();
  const { domain, update, settings } = useApp();
  const [kind, setKind] = useState<ReportKind>('standings');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Branding is edited as a draft and committed when a field loses focus, so a
  // whole sentence typed into tr('brand.eventTitle') is one undo step, not thirty.
  const [draft, setDraft] = useState<Branding | null>(null);
  const t = domain.tournament;
  useEffect(() => { setDraft(null); }, [t.branding]);
  const branding = draft ?? normalizeBranding(t.branding);

  const report = useMemo(() => buildReport({
    tournament: t, participants: domain.participants, groups: domain.groups,
    matches: domain.matches, resources: domain.resources,
    branding: t.branding, generatedAt: nowIso(),
  }, kind), [t, domain, kind]);
  const html = useMemo(() => renderReportHtml(report), [report]);
  const hasData = domain.matches.length > 0;

  const commitBranding = (next: Branding) => {
    setDraft(next);
    update(d => ({ ...d, tournament: { ...d.tournament, branding: normalizeBranding(next) } }), 'Document branding updated');
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg(null);
    try { await fn(); }
    catch (e) { setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'That did not work.' }); }
    finally { setBusy(false); }
  };
  const savePdf = () => run(async () => {
    const p = await desktop.savePdf(reportFileName(report, '.pdf'), html);
    setMsg(p
      ? { kind: 'ok', text: desktop.available ? tr('out.pdfSaved', { path: p }) : tr('out.pdfBrowser') }
      : { kind: 'ok', text: tr('out.cancelled') });
  });
  const print = () => run(async () => {
    const ok = await desktop.printHtml(html);
    setMsg({ kind: 'ok', text: ok ? tr('out.printed') : tr('out.printCancelled') });
  });
  const saveCsv = () => run(async () => {
    const p = await desktop.saveText(reportFileName(report, '.csv'), reportToCsv(report));
    setMsg({ kind: 'ok', text: p ? tr('out.csvSaved', { path: p }) : tr('out.cancelled') });
  });
  const saveProject = () => run(async () => {
    const text = serializeProject({
      tournament: t, participants: domain.participants, groups: domain.groups,
      matches: domain.matches, audit: domain.audit, resources: domain.resources ?? [], settings,
    });
    const p = await desktop.saveText(fileNameFor(t), text);
    setMsg({ kind: 'ok', text: p ? tr('out.projectSaved', { path: p }) : tr('out.cancelledSafe') });
  });


  return (
    <Page title={tr('out.title')}
      sub={tr('out.sub')}
      actions={<Toolbar>
        <button className="btn primary" onClick={savePdf} disabled={busy}>{tr('out.savePdf')}</button>
        <button className="btn" onClick={print} disabled={busy}>{tr('out.print')}</button>
        <button className="btn" onClick={saveCsv} disabled={busy}>{tr('out.saveCsv')}</button>
      </Toolbar>}>
      {msg && <Alert tone={msg.kind} title={tr(msg.kind === 'ok' ? 'out.done' : 'out.couldNotFinish')}>{msg.text}</Alert>}

      {!hasData ? (
        <Empty title={tr('out.emptyTitle')}
          hint={tr('out.emptyHint')} />
      ) : (
        <Panel title={tr('out.docPanel')} sub={tr('out.docPanelSub')}>
          <div className="variants" role="tablist" aria-label={tr('out.docType')}>
            {REPORT_KINDS.map(k => (
              <button key={k.kind} role="tab" type="button" aria-selected={kind === k.kind}
                className={'variant' + (kind === k.kind ? ' on' : '')} onClick={() => setKind(k.kind)}>
                <strong>{tr(k.label)}</strong>
                <span>{tr(k.hint)}</span>
              </button>
            ))}
          </div>
          {report.sections.length === 0 ? (
            <p className="f-hint">{tr('out.noContent')}</p>
          ) : (
            <iframe className="output-preview" title={tr('out.docPreview')} srcDoc={html} />
          )}
        </Panel>
      )}

      <Panel title={tr('brand.title')} sub={tr('brand.sub')}>
        <div onBlur={() => { if (draft) commitBranding(draft); }}>
          <BrandingForm branding={branding} onChange={setDraft} />
        </div>
      </Panel>

      <Panel title={tr('out.backupPanel')} sub={tr('out.backupPanelSub')}>
        <div className="row">
          <button className="btn" onClick={saveProject} disabled={busy}>{desktop.available ? tr('out.saveProject') : tr('out.saveProjectBrowser')}</button>
          <span className="muted">{tr('out.writtenAs', { file: fileNameFor(t) })}</span>
        </div>
      </Panel>
    </Page>
  );
}
