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

export default function Output() {
  const { domain, update, settings } = useApp();
  const [kind, setKind] = useState<ReportKind>('standings');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Branding is edited as a draft and committed when a field loses focus, so a
  // whole sentence typed into "Event title" is one undo step, not thirty.
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
      ? { kind: 'ok', text: desktop.available ? `PDF saved: ${p}` : 'Print dialog opened — choose "Save as PDF" to keep a copy.' }
      : { kind: 'ok', text: 'Cancelled — nothing was written.' });
  });
  const print = () => run(async () => {
    const ok = await desktop.printHtml(html);
    setMsg({ kind: 'ok', text: ok ? 'Sent to the printer.' : 'Printing was cancelled.' });
  });
  const saveCsv = () => run(async () => {
    const p = await desktop.saveText(reportFileName(report, '.csv'), reportToCsv(report));
    setMsg({ kind: 'ok', text: p ? `CSV saved: ${p}` : 'Cancelled — nothing was written.' });
  });
  const saveProject = () => run(async () => {
    const text = serializeProject({
      tournament: t, participants: domain.participants, groups: domain.groups,
      matches: domain.matches, audit: domain.audit, resources: domain.resources ?? [], settings,
    });
    const p = await desktop.saveText(fileNameFor(t), text);
    setMsg({ kind: 'ok', text: p ? `Project file saved: ${p}` : 'Cancelled — nothing was written. Your work is still saved on this device.' });
  });


  return (
    <Page title="Output & branding"
      sub="Print-ready documents for players, referees and venue staff — plus data files and backups."
      actions={<Toolbar>
        <button className="btn primary" onClick={savePdf} disabled={busy}>Save as PDF</button>
        <button className="btn" onClick={print} disabled={busy}>Print…</button>
        <button className="btn" onClick={saveCsv} disabled={busy}>Save CSV</button>
      </Toolbar>}>
      {msg && <Alert tone={msg.kind} title={msg.kind === 'ok' ? 'Done' : 'Could not finish'}>{msg.text}</Alert>}

      {!hasData ? (
        <Empty title="Nothing to export yet"
          hint="Add participants and generate the bracket first. Everything you enter afterwards can be exported from this page." />
      ) : (
        <Panel title="Document" sub="Pick what to produce. The preview below is exactly what the PDF and the printout contain.">
          <div className="variants" role="tablist" aria-label="Document type">
            {REPORT_KINDS.map(k => (
              <button key={k.kind} role="tab" type="button" aria-selected={kind === k.kind}
                className={'variant' + (kind === k.kind ? ' on' : '')} onClick={() => setKind(k.kind)}>
                <strong>{k.label}</strong>
                <span>{k.hint}</span>
              </button>
            ))}
          </div>
          {report.sections.length === 0 ? (
            <p className="f-hint">This document has no content yet — schedule matches on the Schedule screen first.</p>
          ) : (
            <iframe className="output-preview" title="Document preview" srcDoc={html} />
          )}
        </Panel>
      )}

      <Panel title="Branding" sub="Applies to every document on this page and is saved with the project.">
        <div onBlur={() => { if (draft) commitBranding(draft); }}>
          <BrandingForm branding={branding} onChange={setDraft} />
        </div>
      </Panel>

      <Panel title="Backup — keeps everything" sub="One file with the full project. Use it to move to another computer or to recover after a crash.">
        <div className="row">
          <button className="btn" onClick={saveProject} disabled={busy}>Save project file{desktop.available ? '…' : ' (download)'}</button>
          <span className="muted">Written as <span className="kbd">{fileNameFor(t)}</span> — you choose the folder.</span>
        </div>
      </Panel>
    </Page>
  );
}
