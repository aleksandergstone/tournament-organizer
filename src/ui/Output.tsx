// Output — every document that leaves the app: branded PDF/print sheets, CSV
// data files and the full project backup.
//
// The screen renders the *same* HTML string in the preview iframe that it hands
// to the printer, so what an organizer sees is what comes out of the printer.
import { useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { REPORT_KINDS, ReportKind, buildReport, reportToCsv } from '../engine/output';
import { hasBracket, hasPointTable } from '../engine/generate';
import { renderReportHtml, reportFileName } from '../engine/pdf';
import { Branding, normalizeBranding } from '../engine/branding';
import { desktop } from '../engine/desktop';
import { fileNameFor, serializeProject } from '../engine/storage';
import { nowIso } from '../engine/types';
import { Collapse, Alert, Empty, Page, Panel, Toolbar } from './kit';
import { useT } from '../i18n';

export default function Output() {
  const tr = useT();
  const { domain, update, settings } = useApp();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const t = domain.tournament;

  // A knockout prints its final result where a league prints a table.
  const points = hasPointTable(domain.tournament.format);
  const hasBkt = hasBracket(domain.tournament.format);

  // Dokumenty zależą od formatu turnieju:
  //  - drabinka → tylko drabinka, mecze, terminarz (bez tabeli i grup)
  //  - tabela/punkty → tylko tabela, mecze, terminarz (bez drabinki)
  //  - grupy → tylko gdy turniej faktycznie ma grupy
  const visibleKinds = useMemo(() => {
    const out: ReportKind[] = [];
    if (points) out.push('standings');
    if (hasBkt) out.push('bracket');
    out.push('matches');
    out.push('schedule');
    if (domain.groups.length > 0) out.push('groups');
    return out;
  }, [points, hasBkt, domain.groups.length]);

  // Domyślnie wybieramy pierwszy widoczny dokument.
  const [kind, setKind] = useState<ReportKind>(() => visibleKinds.length > 0 ? visibleKinds[0] : 'standings');

  const report = useMemo(() => buildReport({
    tournament: t, participants: domain.participants, groups: domain.groups,
    matches: domain.matches, resources: domain.resources,
    branding: t.branding, generatedAt: nowIso(),
  }, kind), [t, domain, kind]);
  const html = useMemo(() => renderReportHtml(report), [report]);
  const hasData = domain.matches.length > 0;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg(null);
    try { await fn(); }
    catch (e) { setMsg({ kind: 'err', text: e instanceof Error ? e.message : tr('err.actionFailed') }); }
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
            {REPORT_KINDS.filter(k => visibleKinds.includes(k.kind)).map(k => (
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

      <Collapse title={tr('out.backupPanel')} sub={tr('out.backupPanelSub')}>
        <Panel>
          <div className="row">
            <button className="btn" onClick={saveProject} disabled={busy}>{desktop.available ? tr('out.saveProject') : tr('out.saveProjectBrowser')}</button>
            <span className="muted">{tr('out.writtenAs', { file: fileNameFor(t) })}</span>
          </div>
        </Panel>
      </Collapse>
    </Page>
  );
}
