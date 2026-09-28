// Print/PDF rendering: a Report → one self-contained HTML document.
//
// Self-contained on purpose — no external fonts, stylesheets or images, because
// the same string is (a) shown in the in-app preview, (b) printed by Electron's
// printToPDF in an offscreen window, and (c) printed from a browser. What the
// organizer previews is exactly what comes out of the printer.
import { Report, Section } from './output';

export function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
}

/** Only safe inline images reach the document (branding normalizes the rest). */
function safeImage(src: string): string {
  return /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/.test(src.trim()) ? src.trim() : '';
}

/** #rrggbb → rgba() so the accent can tint backgrounds without a colour lib. */
function tint(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(31, 94, 255, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

function slug(s: string): string {
  return (s || 'tournament').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tournament';
}

/** Suggested file name, e.g. `winter-league-standings.pdf`. */
export function reportFileName(report: Report, ext: string): string {
  return `${slug(report.meta.title)}-${report.kind}${ext}`;
}

const CSS = `
  @page { size: A4 portrait; margin: 14mm 12mm 18mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0; font-family: "Segoe UI", Inter, Roboto, Arial, sans-serif;
    font-size: 10.5pt; line-height: 1.45; color: #1a1d21; background: #fff;
  }
  .head { display: flex; align-items: flex-start; gap: 12px;
          border-bottom: 2px solid var(--accent); padding-bottom: 8px; margin-bottom: 16px; }
  .head img.logo { max-height: 46px; max-width: 150px; object-fit: contain; }
  .head .sponsor { margin-left: auto; max-height: 30px; max-width: 120px; object-fit: contain; }
  .head .titles { flex: 1; min-width: 0; }
  h1 { font-size: 17pt; line-height: 1.2; margin: 0; letter-spacing: -0.2px; }
  .subtitle { font-size: 11.5pt; margin: 2px 0 0; color: #3d4450; }
  .edition { font-size: 9.5pt; margin: 3px 0 0; color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; }
  .ctx, .hint, .generated { font-size: 9pt; color: #5b6472; margin: 4px 0 0; }
  .hint { font-style: italic; }
  section { margin-bottom: 18px; }
  section.break { break-before: page; }
  h2 { font-size: 12.5pt; margin: 0 0 2px; padding-bottom: 4px; border-bottom: 1px solid var(--accent-soft);
       break-after: avoid; page-break-after: avoid; }
  .sub { font-size: 9pt; color: #5b6472; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { text-align: left; background: var(--accent-soft); color: #1a1d21; font-weight: 600;
       padding: 5px 7px; border-bottom: 1px solid var(--accent); white-space: nowrap; }
  td { padding: 4px 7px; border-bottom: 1px solid #e6e9ee; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fafbfc; }
  th.r, td.r { text-align: right; font-variant-numeric: tabular-nums; }
  th.c, td.c { text-align: center; }
  td.name { font-weight: 600; }
  .round { margin-top: 10px; break-inside: avoid; }
  .round h3 { font-size: 10.5pt; margin: 0 0 4px; color: var(--accent); }
  .note { font-size: 8.5pt; color: #5b6472; margin: 6px 0 0; }
  .notes { border-left: 3px solid var(--accent-soft); padding: 4px 0 4px 10px; white-space: pre-wrap; }
  .empty { font-size: 10pt; color: #5b6472; font-style: italic; }
  .foot { position: fixed; left: 0; right: 0; bottom: 0; padding-top: 4px;
          border-top: 1px solid #e6e9ee; font-size: 8pt; color: #6b7280; }
`;

function tableHtml(s: Section): string {
  if (!s.columns || !s.rows) return '';
  const head = s.columns
    .map(c => `<th class="${c.align === 'right' ? 'r' : c.align === 'center' ? 'c' : ''}">${escapeHtml(c.label)}</th>`)
    .join('');
  const body = s.rows.map(r => '<tr>' + r.map((v, i) => {
    const c = s.columns?.[i];
    const cls = c?.align === 'right' ? 'r' : c?.align === 'center' ? 'c' : (c?.key === 'name' || c?.key === 'home' || c?.key === 'away' ? 'name' : '');
    return `<td class="${cls}">${escapeHtml(String(v))}</td>`;
  }).join('') + '</tr>').join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function roundsHtml(s: Section): string {
  return (s.rounds ?? []).map(r => `
    <div class="round">
      <h3>${escapeHtml(r.label || r.name)}</h3>
      <table><thead><tr><th class="r">No.</th><th>Home</th><th class="c">Score</th><th>Away</th><th>Status</th></tr></thead>
      <tbody>${r.rows.map(m => `<tr><td class="r">${escapeHtml(m.no)}</td><td class="name">${escapeHtml(m.home)}</td>` +
        `<td class="c">${escapeHtml(m.score)}</td><td class="name">${escapeHtml(m.away)}</td>` +
        `<td>${escapeHtml(m.status)}</td></tr>`).join('')}</tbody></table>
      ${r.note ? `<p class="note">${escapeHtml(r.note)}</p>` : ''}
    </div>`).join('');
}

/** Renders a report to a complete, standalone HTML document. */
export function renderReportHtml(report: Report): string {
  const m = report.meta;
  const logo = safeImage(m.logoDataUrl), sponsor = safeImage(m.sponsorDataUrl);
  const style = `:root { --accent: ${m.accent}; --accent-soft: ${tint(m.accent, 0.1)}; }`;
  const body = report.sections.map(s => `
    <section class="${s.pageBreakBefore ? 'break' : ''}">
      <h2>${escapeHtml(s.title)}</h2>
      ${s.sub ? `<p class="sub">${escapeHtml(s.sub)}</p>` : ''}
      ${s.columns && s.rows ? tableHtml(s) : ''}
      ${s.rounds ? roundsHtml(s) : ''}
      ${s.note ? `<p class="note">${escapeHtml(s.note)}</p>` : ''}
    </section>`).join('');
  const notes = m.notes ? `
    <section>
      <h2>Notes</h2>
      <p class="notes">${escapeHtml(m.notes)}</p>
    </section>` : '';
  const foot = [m.footer, m.generatedLine].filter(Boolean).map(escapeHtml).join('  ·  ');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(m.title)} — ${escapeHtml(m.subtitle || report.kind)}</title>
<style>${style}${CSS}</style></head>
<body>
  <div class="head">
    ${logo ? `<img class="logo" src="${logo}" alt="" />` : ''}
    <div class="titles">
      <h1>${escapeHtml(m.title)}</h1>
      ${m.subtitle ? `<p class="subtitle">${escapeHtml(m.subtitle)}</p>` : ''}
      ${m.edition ? `<p class="edition">${escapeHtml(m.edition)}</p>` : ''}
      ${m.contextLine ? `<p class="ctx">${escapeHtml(m.contextLine)}</p>` : ''}
      ${m.headerNote ? `<p class="hint">${escapeHtml(m.headerNote)}</p>` : ''}
    </div>
    ${sponsor ? `<img class="sponsor" src="${sponsor}" alt="" />` : ''}
  </div>
  ${body || '<p class="empty">There is nothing to show in this report yet.</p>'}
  ${notes}
  ${foot ? `<div class="foot">${foot}</div>` : ''}
</body></html>`;
}
