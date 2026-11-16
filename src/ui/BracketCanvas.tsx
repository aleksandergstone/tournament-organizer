// Interactive tournament bracket: rounds side by side, connector lines,
// match cards, all statuses, themed via branding.
//
// Constants MUST match src/engine/bracket-view.ts so connector lines land
// on the centres of the rendered cards.
import { useCallback, useState } from 'react';
import { useApp } from '../state/store';
import { Branding } from '../engine/branding';
import { PlacedNode, BracketLink, NODE_W, NODE_H, COL_GAP, ROW_GAP, PAD } from '../engine/bracket-view';
import { Page } from './kit';
import { useT } from '../i18n';

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

function tintColor(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(31, 94, 255, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}

function statusLabel(t: ReturnType<typeof useT>, status: string): string {
  const labels: Record<string, string> = {
    scheduled: t('status.scheduled') ?? 'Zaplanowany',
    played: t('status.played') ?? 'Zagrano',
    draw: t('status.draw') ?? 'Remis',
    walkover: t('status.walkover') ?? 'Walkover',
    overtime: t('status.overtime') ?? 'Dogrywka',
    bye: t('status.bye') ?? 'Wolny los',
    tbd: t('status.tbd') ?? 'TBD',
    unfinished: t('status.unfinished') ?? 'Nie zakończono',
    interrupted: t('status.interrupted') ?? 'Przerwano',
  };
  return labels[status] ?? status;
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

interface BracketCanvasProps {
  nodes: PlacedNode[];
  links: BracketLink[];
  rounds: { round: number; name: string }[];
  width: number;
  height: number;
  championMatchId: string | null;
  championLabel: string;
  pn: (id: string | null | undefined) => string;
  branding: Branding;
  title: string;
  sub?: string;
}

export function BracketCanvas({
  nodes, links, rounds, width, height, championMatchId, championLabel, pn, branding, title, sub,
}: BracketCanvasProps) {
  const t = useT();
  const { go } = useApp();
  const byId = new Map(nodes.map(n => [n.id, n]));
  const [hoverId, setHoverId] = useState<string | null>(null);
  const acc = branding.accent1;
  const line = branding.line;
  const surface = branding.surface;
  const ink = branding.ink;
  const muted = branding.muted;

  const handleMatchClick = useCallback((mId: string) => { go('matches'); }, [go]);

  // Connector paths: elbow from right edge of source to left edge of target,
  // using the real centres of the placed cards — same coordinates as the cards.
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

  return (
    <Page title={title} sub={sub}
      actions={<button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>}>
      <div className="bracket-wrap" style={{ position: 'relative', width: Math.max(width, 700), minHeight: height + 60 }}>
        <svg className="bracket-svg-overlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {connectorPaths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={line} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {rounds.map(r => {
            const col = nodes.find(n => n.round === r.round)?.col ?? 0;
            const x = PAD + col * (NODE_W + COL_GAP) + NODE_W / 2;
            return (
              <text key={r.round} x={x} y={PAD - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill={acc}>
                {r.name}
              </text>
            );
          })}
        </svg>
        {/* Match cards positioned absolutely at their computed x/y — same source of truth as connectors. */}
        {nodes.map(n => renderNode(n, {
          isChamp: championMatchId === n.id,
          done: n.decided,
          wonHome: n.homeWon,
          wonAway: n.awayWon,
          isBye: n.home === (t('status.bye') ?? 'Wolny los') || n.away === (t('status.bye') ?? 'Wolny los'),
          isTbd: n.home === (t('common.tbd') ?? 'TBD') || n.away === (t('common.tbd') ?? 'TBD'),
          hovered: hoverId === n.id,
          acc, line, surface, ink, muted, t,
          handleMatchClick, setHoverId, championLabel,
          left: n.x,
          top: n.y,
        }))}
      </div>
      <div className="bracket-foot">
        <span className="muted">{t('bracket.updateNote') ?? 'Wyniki wpisuje się na ekranie wyników — drabinka aktualizuje się sama.'}</span>
        <span className="sp" />
        <button className="btn" onClick={() => go('standings')}>{t('nav.standings')}</button>
        <button className="btn primary" onClick={() => go('matches')}>{t('bracket.enterResults')}</button>
      </div>
    </Page>
  );
}

function renderNode(n: any, opts: {
  isChamp: boolean; done: boolean; wonHome: boolean; wonAway: boolean;
  isBye: boolean; isTbd: boolean; hovered: boolean;
  acc: string; line: string; surface: string; ink: string; muted: string;
  t: ReturnType<typeof useT>;
  handleMatchClick: (mId: string) => void;
  setHoverId: (id: string | null) => void;
  championLabel: string;
  left: number; top: number;
}) {
  const { isChamp, done, wonHome, wonAway, isBye, isTbd, hovered, acc, line, surface, ink, muted, t, handleMatchClick, setHoverId, championLabel, left, top } = opts;
  const border = done
    ? (wonHome || wonAway ? acc : line)
    : (hovered ? acc : line);
  const bg = done
    ? (wonHome || wonAway ? tintColor(acc, 0.10) : surface)
    : 'transparent';
  const status = n.resultStatus ?? 'scheduled';
  const byeText = t('status.bye') ?? 'Wolny los';
  const tbdText = t('common.tbd') ?? 'TBD';
  return (
    <div key={n.id}
      className="bracket-node"
      onMouseEnter={() => setHoverId(n.id)}
      onMouseLeave={() => setHoverId(null)}
      onClick={() => !done && !isBye && !isTbd && handleMatchClick(n.id)}
      style={{
        position: 'absolute',
        left,
        top,
        width: NODE_W,
        height: NODE_H,
        border: `1.5px solid ${border}`,
        borderRadius: 8,
        background: bg,
        cursor: done || isBye || isTbd ? 'default' : 'pointer',
        boxShadow: hovered ? '0 2px 8px rgba(16,24,40,.12)' : 'none',
        transition: 'border-color .15s, box-shadow .15s, background .15s',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
      <div className="bracket-node-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px 2px', borderBottom: `1px solid ${tintColor(line, 0.4)}`, flexShrink: 0 }}>
        <span className={statusClass(status)} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: statusPillBgInline(status, line, acc), color: statusPillFgInline(status), whiteSpace: 'nowrap' }}>{statusLabel(t, status)}</span>
      </div>
      <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2, height: '100%', minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, width: '100%', minHeight: 0 }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: wonHome ? acc : ink, display: 'inline-block', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clipInline(n.home, 16)}</span>
            {n.homeScore !== '–' ? <b style={{ fontSize: 13, color: wonHome ? acc : ink, minWidth: 0 }}>{n.homeScore}</b> : <span style={{ fontSize: 13, color: muted, minWidth: 0 }}>–</span>}
          </div>
          <span style={{ fontSize: 13, color: muted, fontWeight: 700, whiteSpace: 'nowrap', position: 'relative', top: -3 }}>&gt;</span>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: wonAway ? acc : ink, display: 'inline-block', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>{clipInline(n.away, 16)}</span>
            {n.awayScore !== '–' ? <b style={{ fontSize: 13, color: wonAway ? acc : ink, minWidth: 0 }}>{n.awayScore}</b> : <span style={{ fontSize: 13, color: muted, minWidth: 0 }}>–</span>}
          </div>
        </div>
        {!done && !isBye && !isTbd && (
          <div style={{ marginTop: 2, paddingTop: 2, borderTop: `1px dashed ${tintColor(line, 0.4)}` }}>
            <span style={{ fontSize: 10.5, color: acc, fontWeight: 600, cursor: 'pointer' }}>{t('bracket.enterResults') ?? 'Wpisz wynik'}</span>
          </div>
        )}
      </div>
      {isChamp && (
        <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: acc, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{championLabel.toUpperCase()}</div>
      )}
    </div>
  );
}

function clipInline(s: string, max: number): string { return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s; }
function statusPillBgInline(status: string, line: string, acc: string): string {
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
function statusPillFgInline(status: string): string {
  switch (status) {
    case 'played': return '#15803d';
    case 'draw': return '#b45309';
    case 'walkover': return '#b42318';
    case 'overtime': return '#175cd3';
    case 'bye': case 'tbd': case 'unfinished': return '#697386';
    case 'interrupted': return '#b45309';
    default: return '#1f5eff';
  }
}
