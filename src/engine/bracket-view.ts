// The bracket as a picture: a spread-out "spider" of rounds and connector lines.
//
// The engine already knows the real structure of a bracket — every slot records
// which match feeds it (`bracket.srcHome/srcAway`) — so the drawing is derived
// from the same links that keep results correct. One layout serves the screen
// and the printed document, so a bracket looks the same in the app, in the PDF
// and on paper.
import { Match } from './types';

export const NODE_W = 170;
export const NODE_H = 46;
export const COL_GAP = 38;
export const ROW_GAP = 12;
export const HEAD_H = 28;
export const PAD = 10;

export interface BracketNode {
  id: string;
  round: number;
  roundName: string;
  home: string;
  away: string;
  score: string;
  homeWon: boolean;
  awayWon: boolean;
  decided: boolean;
  /** ids of the matches feeding this one, in slot order (home, away). */
  feeders: (string | null)[];
}

export interface PlacedNode extends BracketNode { col: number; x: number; y: number; }

export interface BracketLink { from: string; to: string; slot: 0 | 1; }

export interface BracketTree {
  nodes: PlacedNode[];
  byId: Map<string, PlacedNode>;
  links: BracketLink[];
  rounds: { round: number; name: string }[];
  width: number;
  height: number;
  champion: { matchId: string; name: string } | null;
}

const FINISHED = new Set(['played', 'draw', 'walkover', 'overtime']);

function feederId(src: { w?: string; l?: string } | null | undefined): string | null {
  if (!src) return null;
  return src.w ?? src.l ?? null;
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

function scoreOf(m: Match, empty: string): string {
  if (m.result.status === 'bye') return empty;
  if (m.result.homeScore === null && m.result.awayScore === null) return '–';
  return `${m.result.homeScore ?? 0} : ${m.result.awayScore ?? 0}`;
}

/**
 * Lays knockout matches out as columns of rounds, spreading each match
 * vertically between the two that feed it — the classic bracket "spider".
 * Pure: the caller supplies the names, so this works in the UI and in the PDF.
 */
export function buildBracketTree(
  matches: Match[],
  nameOf: (id: string | null | undefined) => string,
  opts: { emptyLabel: string; roundName: (round: number) => string },
): BracketTree {
  const byRound = new Map<number, Match[]>();
  for (const m of matches) {
    const list = byRound.get(m.round);
    if (list) list.push(m); else byRound.set(m.round, [m]);
  }
  const roundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  const colOf = new Map(roundNumbers.map((n, i) => [n, i]));

  const nodes: PlacedNode[] = matches.map(m => ({
    id: m.id,
    round: m.round,
    roundName: m.roundName,
    home: m.homeId ? nameOf(m.homeId) : opts.emptyLabel,
    away: m.awayId ? nameOf(m.awayId) : opts.emptyLabel,
    score: scoreOf(m, opts.emptyLabel),
    homeWon: !!m.result.winnerId && m.result.winnerId === m.homeId,
    awayWon: !!m.result.winnerId && m.result.winnerId === m.awayId,
    decided: FINISHED.has(m.result.status) && !!m.result.winnerId,
    feeders: [feederId(m.bracket?.srcHome), feederId(m.bracket?.srcAway)],
    col: colOf.get(m.round) ?? 0,
    x: 0,
    y: 0,
  }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const step = NODE_H + ROW_GAP;
  const top = PAD + HEAD_H;

  // Column 1 is an evenly spaced list; later columns centre on their feeders.
  for (const round of roundNumbers) {
    (byRound.get(round) ?? []).forEach((m, i) => {
      const n = byId.get(m.id)!;
      n.x = PAD + n.col * (NODE_W + COL_GAP);
      n.y = top + (n.col === 0 ? i * step : 0);
    });
  }
  for (const round of roundNumbers.slice(1)) {
    for (const m of byRound.get(round) ?? []) {
      const n = byId.get(m.id)!;
      const ys = n.feeders.map(f => (f ? byId.get(f) : undefined))
        .filter((f): f is PlacedNode => !!f).map(f => f.y);
      if (ys.length) n.y = (Math.min(...ys) + Math.max(...ys)) / 2;
    }
  }
  // Relax: keep a minimum gap in a column, then re-centre it on the first
  // column so the web reads as one shape instead of drifting downwards.
  const first = (byRound.get(roundNumbers[0]) ?? []).map(m => byId.get(m.id)!);
  for (const round of roundNumbers) {
    const col = (byRound.get(round) ?? []).map(m => byId.get(m.id)!).sort((a, b) => a.y - b.y);
    for (let i = 1; i < col.length; i++) {
      if (col[i].y - col[i - 1].y < step) col[i].y = col[i - 1].y + step;
    }
    if (first.length > 1) {
      const want = (first[0].y + first[first.length - 1].y) / 2;
      const have = (col[0].y + col[col.length - 1].y) / 2;
      for (const n of col) n.y = Math.max(top, n.y + want - have);
    }
  }

  const links: BracketLink[] = [];
  for (const n of nodes) {
    n.feeders.forEach((f, i) => {
      if (f && byId.has(f)) links.push({ from: f, to: n.id, slot: i as 0 | 1 });
    });
  }

  const lastRound = roundNumbers[roundNumbers.length - 1];
  const decidedFinal = (byRound.get(lastRound) ?? []).filter(m => byId.get(m.id)!.decided);
  const champ = decidedFinal[decidedFinal.length - 1];
  const champNode = champ ? byId.get(champ.id)! : null;

  return {
    nodes,
    byId,
    links,
    rounds: roundNumbers.map(n => ({
      round: n,
      name: byRound.get(n)?.[0]?.roundName || opts.roundName(n),
    })),
    width: Math.max(...nodes.map(n => n.x + NODE_W), NODE_W) + PAD,
    height: Math.max(...nodes.map(n => n.y + NODE_H), top + NODE_H) + PAD,
    champion: champNode
      ? { matchId: champNode.id, name: champNode.homeWon ? champNode.home : champNode.away }
      : null,
  };
}

export interface BracketSvgOptions {
  tree: BracketTree;
  /** Accessible description of the whole drawing. */
  title: string;
  /** Small caption over the champion's box, e.g. "Champion". */
  championLabel: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));

// Colours come from CSS variables, so the same drawing follows the app theme
// and the document's branding accent.
const C = {
  acc: 'var(--acc, #1f5eff)',
  ink: 'var(--ink, #161c24)',
  muted: 'var(--muted, #697386)',
  line: 'var(--line, #c8ced8)',
  card: 'var(--panel, #ffffff)',
};

/** Renders the tree as one self-contained, printable SVG. */
export function bracketSvg(o: BracketSvgOptions): string {
  const { tree, title, championLabel } = o;
  const { acc, ink, muted, line, card } = C;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tree.width} ${tree.height}" `
    + `width="100%" height="auto" preserveAspectRatio="xMinYMin meet" role="img" `
    + `aria-label="${esc(title)}" font-family="Segoe UI, Inter, Roboto, Arial, sans-serif">`);

  for (const r of tree.rounds) {
    const col = tree.nodes.find(n => n.round === r.round)?.col ?? 0;
    parts.push(`<text x="${PAD + col * (NODE_W + COL_GAP)}" y="${PAD + 16}" font-size="12" `
      + `font-weight="600" fill="${acc}">${esc(clip(r.name, 24))}</text>`);
  }
  // Connectors: out of a match, one elbow, into the match it feeds.
  for (const l of tree.links) {
    const from = tree.byId.get(l.from)!, to = tree.byId.get(l.to)!;
    const x0 = from.x + NODE_W, y0 = from.y + NODE_H / 2;
    const x1 = to.x, y1 = to.y + NODE_H / 2;
    const mid = (x0 + x1) / 2;
    parts.push(`<path d="M ${x0} ${y0} H ${mid} V ${y1} H ${x1}" fill="none" stroke="${line}" `
      + `stroke-width="1.4" />`);
  }
  for (const n of tree.nodes) {
    const isChamp = tree.champion?.matchId === n.id;
    parts.push(`<rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${NODE_H}" rx="6" `
      + `fill="${card}" stroke="${isChamp ? acc : line}" stroke-width="${isChamp ? 2 : 1}"/>`);
    parts.push(`<line x1="${n.x}" y1="${n.y + NODE_H / 2}" x2="${n.x + NODE_W}" `
      + `y2="${n.y + NODE_H / 2}" stroke="${line}" stroke-width="1"/>`);
    const side = (s: string, won: boolean, y: number) =>
      `<text x="${n.x + 8}" y="${y}" font-size="11" fill="${won ? acc : ink}" `
      + `font-weight="${won ? 700 : 400}">${esc(clip(s, 20))}</text>`;
    parts.push(side(n.home, n.homeWon, n.y + 16));
    parts.push(side(n.away, n.awayWon, n.y + NODE_H - 8));
    parts.push(`<text x="${n.x + NODE_W - 8}" y="${n.y + 16}" font-size="11" text-anchor="end" `
      + `fill="${muted}" font-variant-numeric="tabular-nums">${esc(n.score)}</text>`);
    parts.push(`<text x="${n.x + NODE_W - 8}" y="${n.y + NODE_H - 8}" font-size="11" `
      + `text-anchor="end" fill="${muted}" font-variant-numeric="tabular-nums">${esc(n.score)}</text>`);
    if (isChamp && championLabel) {
      parts.push(`<text x="${n.x + NODE_W / 2}" y="${n.y - 6}" font-size="10" text-anchor="middle" `
        + `fill="${acc}" font-weight="700" letter-spacing="0.5">${esc(championLabel.toUpperCase())}</text>`);
    }
  }
  parts.push('</svg>');
  return parts.join('');
}

/** Places of a decided knockout final: first, second and — when the bracket
 *  allows it to be derived — third. */
export function knockoutPlaces(
  matches: Match[],
  nameOf: (id: string | null | undefined) => string,
): { place: number; name: string }[] {
  const byId = new Map(matches.map(m => [m.id, m]));
  const last = [...matches].sort((a, b) => b.round - a.round)
    .find(m => FINISHED.has(m.result.status) && m.result.winnerId);
  if (!last) return [];
  const loser = last.result.winnerId === last.homeId ? last.awayId : last.homeId;
  const out = [{ place: 1, name: nameOf(last.result.winnerId) }];
  if (loser) out.push({ place: 2, name: nameOf(loser) });
  const semi = [last.bracket?.srcHome?.w, last.bracket?.srcAway?.w]
    .map(id => (id ? byId.get(id) : undefined))
    .find(m => m && m.result.winnerId);
  const third = semi
    ? (semi.result.winnerId === semi.homeId ? semi.awayId : semi.homeId)
    : null;
  if (third && third !== loser) out.push({ place: 3, name: nameOf(third) });
  return out;
}
