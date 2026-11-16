// Shared bracket HTML rendering: the same markup as BracketCanvas.tsx
// so the on-screen view and the PDF document are 1:1 identical.
// Pure function: no React, no DOM — returns an HTML string.

import { Branding } from './branding';
import { PlacedNode, BracketLink, NODE_W, NODE_H, COL_GAP, ROW_GAP, PAD } from './bracket-view';

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

function tintColor(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(31, 94, 255, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

function statusPillBg(status: string, line: string, acc: string): string {
  switch (status) {
    case 'played': return tintColor('#15803d', 0.12);
    case 'draw': return tintColor('#b45309', 0.12);
    case 'walkover': return tintColor('#b42318', 0.12);
    case 'overtime': return tintColor('#175cd3', 0.12);
    case 'bye': case 'tbd': case 'unfinished': return tintColor('#697386', 0.12);
    case 'interrupted': return tintColor('#b45309', 0.12);
    default: return tintColor(acc, 0.10);
  }
}

function statusPillFg(status: string, acc: string): string {
  switch (status) {
    case 'played': return '#15803d';
    case 'draw': return '#b45309';
    case 'walkover': return '#b42318';
    case 'overtime': return '#175cd3';
    case 'bye': case 'tbd': case 'unfinished': return '#697386';
    case 'interrupted': return '#b45309';
    default: return acc;
  }
}

/** Renders a bracket tree to an HTML string identical to BracketCanvas.tsx output. */
export function renderBracketHtml({
  nodes, links, rounds, width, height, championMatchId, championLabel, pn, branding,
}: {
  nodes: PlacedNode[];
  links: BracketLink[];
  rounds: { round: number; name: string }[];
  width: number;
  height: number;
  championMatchId: string | null;
  championLabel: string;
  pn: (id: string | null | undefined) => string;
  branding: Branding;
}): string {
  const acc = branding.accent1;
  const line = branding.line;
  const surface = branding.surface;
  const ink = branding.ink;
  const muted = branding.muted;

  const byId = new Map(nodes.map(n => [n.id, n]));

  // Connector paths — same geometry as BracketCanvas.
  const connectorPaths: string[] = [];
  for (const l of links) {
    const from = byId.get(l.from);
    const to = byId.get(l.to);
    if (!from || !to) continue;
    const x0 = from.x + NODE_W;
    const y0 = from.y + NODE_H / 2;
    const x1 = to.x;
    const y1 = to.y + NODE_H / 2;
    const mid = (x0 + x1) / 2;
    connectorPaths.push(`M ${x0} ${y0} H ${mid} V ${y1} H ${x1}`);
  }

  // Round labels (drawn above each column).
  const roundLabelsHtml = rounds.map(r => {
    const col = nodes.find(n => n.round === r.round)?.col ?? 0;
    const x = PAD + col * (NODE_W + COL_GAP);
    return `<div class="bracket-round-label" style="position:absolute;left:${x}px;top:4px;font-size:11px;font-weight:600;color:${acc};white-space:nowrap">${esc(r.name)}</div>`;
  }).join('');

  // Connector SVG overlay.
  const connectorsHtml = connectorPaths.map(d =>
    `<path d="${d}" fill="none" stroke="${line}" stroke-width="1.4" />`).join('');

  // Match cards.
  const cardsHtml = nodes.map(n => {
    const status = n.resultStatus;
    const isBye = status === 'bye';
    const isTbd = status === 'tbd';
    const done = FINISHED.has(status) && !!n.homeScore && n.homeScore !== '–';
    const wonHome = n.homeWon;
    const wonAway = n.awayWon;
    const isChamp = championMatchId === n.id;

    const homeName = n.home ? esc(clip(n.home, 16)) : '';
    const awayName = n.away ? esc(clip(n.away, 16)) : '';
    const homeScore = n.homeScore !== '–' ? n.homeScore : '–';
    const awayScore = n.awayScore !== '–' ? n.awayScore : '–';

    const statusLabel = (() => {
      const labels: Record<string, string> = {
        scheduled: 'Zaplanowany',
        played: 'Zagrano',
        draw: 'Remis',
        walkover: 'Walkover',
        overtime: 'Dogrywka',
        bye: 'Wolny los',
        tbd: 'TBD',
        unfinished: 'Nie zakończono',
        interrupted: 'Przerwano',
      };
      return labels[status] ?? status;
    })();

    const pillBg = statusPillBg(status, line, acc);
    const pillFg = statusPillFg(status, acc);

    const enterResults = (!done && !isBye && !isTbd)
      ? `<div style="margin-top:2px;padding-top:2px;border-top:1px dashed ${tintColor(line, 0.4)}"><span style="font-size:10.5px;color:${acc};font-weight:600;cursor:pointer">Wpisz wynik</span></div>`
      : '';

    const champLabel = isChamp
      ? `<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:700;color:${acc};letter-spacing:0.5px;white-space:nowrap">${championLabel.toUpperCase()}</div>`
      : '';

    return `
    <div class="bracket-node" style="position:absolute;left:${n.x}px;top:${n.y}px;width:${NODE_W}px;height:${NODE_H}px;border:1.5px solid ${isChamp ? acc : line};border-radius:8px;background:${surface};overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box">
      <div class="bracket-node-head" style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px 2px;border-bottom:1px solid ${tintColor(line, 0.4)};flex-shrink:0">
        <span class="status ${statusClass(status)}" style="font-size:10px;padding:1px 6px;border-radius:10px;background:${pillBg};color:${pillFg};white-space:nowrap">${statusLabel}</span>
      </div>
      <div style="padding:4px 8px;display:flex;flex-direction:column;gap:2px;height:100%;min-height:0;box-sizing:border-box">
        <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;width:100%;min-height:0">
          <div style="min-width:0;display:flex;flex-direction:column;gap:1px">
            <span style="font-size:12.5px;font-weight:600;color:${wonHome ? acc : ink};display:inline-block;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${homeName}</span>
            ${n.homeScore !== '–' ? `<b style="font-size:13px;color:${wonHome ? acc : ink};min-width:0">${homeScore}</b>` : `<span style="font-size:13px;color:${muted};min-width:0">–</span>`}
          </div>
          <span style="font-size:13px;color:${muted};font-weight:700;white-space:nowrap;position:relative;top:-3px">&gt;</span>
          <div style="min-width:0;display:flex;flex-direction:column;gap:1px;alignItems:flex-end">
            <span style="font-size:12.5px;font-weight:600;color:${wonAway ? acc : ink};display:inline-block;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right">${awayName}</span>
            ${n.awayScore !== '–' ? `<b style="font-size:13px;color:${wonAway ? acc : ink};min-width:0">${awayScore}</b>` : `<span style="font-size:13px;color:${muted};min-width:0">–</span>`}
          </div>
        </div>
        ${enterResults}
      </div>
      ${champLabel}
    </div>`;
  }).join('');

  return `
    <div class="bracket-wrap" style="position:relative;width:${Math.max(width, 700)}px;min-height:${height + 60}px;box-sizing:border-box">
      ${roundLabelsHtml}
      <svg class="bracket-svg-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        ${connectorsHtml}
      </svg>
      ${cardsHtml}
    </div>`;
}

function statusClass(status: string): string {
  switch (status) {
    case 'played': return 'status played';
    case 'draw': return 'status draw';
    case 'walkover': return 'status walkover';
    case 'overtime': return 'status overtime';
    case 'bye': return 'status bye';
    case 'tbd': return 'status tbd';
    case 'unfinished': return 'status unfinished';
    case 'interrupted': return 'status interrupted';
    default: return 'status scheduled';
  }
}
