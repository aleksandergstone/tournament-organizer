// The bracket as a picture: a spread-out "spider" of rounds and connector lines.
//
// The engine already knows the real structure of a bracket — every slot records
// which match feeds it (`bracket.srcHome/srcAway`) — so the drawing is derived
// from the same links that keep results correct. One layout serves the screen
// and the printed document, so a bracket looks the same in the app, in the PDF
// and on paper.
//
import { Match } from './types';

// These constants MUST match the ones used by BracketCanvas.tsx (UI rendering).
export const NODE_W = 160;
export const NODE_H = 90;
export const COL_GAP = 60;
export const ROW_GAP = 14;
export const HEAD_H = 26;
export const PAD = 14;

export interface BracketNode {
  id: string;
  round: number;
  roundName: string;
  home: string;
  away: string;
  /** Each side's own goals — printed next to that side, not as a pair. */
  homeScore: string;
  awayScore: string;
  homeWon: boolean;
  awayWon: boolean;
  decided: boolean;
  /** Match result status (scheduled, played, draw, walkover, bye, tbd, …). */
  resultStatus: string;
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

function scoreOf(m: Match): [string, string] {
  if (m.result.status === 'bye') return ['–', '–'];
  const { homeScore, awayScore } = m.result;
  if (homeScore === null && awayScore === null) return ['–', '–'];
  return [String(homeScore ?? 0), String(awayScore ?? 0)];
}

/**
 * Lays knockout matches out as columns of rounds, spreading each match
 * vertically between the two that feed it — the classic bracket "spider".
 * Pure: the caller supplies the names, so this works in the UI and in the PDF.
 */
export function buildBracketTree(
  matches: Match[],
  nameOf: (id: string | null | undefined) => string,
  opts: { emptyLabel: string; byeLabel?: string; roundName: (round: number) => string },
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
    away: m.awayId ? nameOf(m.awayId) : m.result.status === 'bye' ? (opts.byeLabel ?? opts.emptyLabel) : opts.emptyLabel,
    ...(() => { const [h, a] = scoreOf(m); return { homeScore: h, awayScore: a }; })(),
    homeWon: !!m.result.winnerId && m.result.winnerId === m.homeId,
    awayWon: !!m.result.winnerId && m.result.winnerId === m.awayId,
    decided: FINISHED.has(m.result.status) && !!m.result.winnerId,
    resultStatus: m.result.status,
    feeders: [feederId(m.bracket?.srcHome), feederId(m.bracket?.srcAway)],
    col: colOf.get(m.round) ?? 0,
    x: 0,
    y: 0,
  }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const step = NODE_H + ROW_GAP;
  const top = PAD + HEAD_H;

  // Column 1 is an evenly spaced list — matches are in slot order (0, 1, 2, …).
  const firstRound = roundNumbers[0];
  const firstCol = (byRound.get(firstRound) ?? []).map(m => byId.get(m.id)!);
  for (let i = 0; i < firstCol.length; i++) {
    firstCol[i].y = top + i * step;
    firstCol[i].x = PAD;
  }
  // prevCol holds the previous round's placed nodes in slot order.
  let prevCol = firstCol;

  // Later columns: each match i sits between visual slots (2*i, 2*i+1) of the
  // previous round — regardless of which feeders the match data references.
  for (let r = 1; r < roundNumbers.length; r++) {
    const round = roundNumbers[r];
    const col = (byRound.get(round) ?? []).map(m => byId.get(m.id)!);
    for (let i = 0; i < col.length; i++) {
      const n = col[i];
      const f0 = prevCol[2 * i];
      const f1 = prevCol[2 * i + 1];
      if (f0 && f1) {
        n.y = (f0.y + f1.y) / 2 - NODE_H / 2;
      } else if (f0) {
        n.y = f0.y;
      } else if (f1) {
        n.y = f1.y;
      } else {
        n.y = top;
      }
      n.x = PAD + n.col * (NODE_W + COL_GAP);
    }
    prevCol = col;
  }

  // Connector links: one pair per match — from visual slots (2*i, 2*i+1)
  // of the previous round into match i of this round.
  const links: BracketLink[] = [];
  for (let r = 1; r < roundNumbers.length; r++) {
    const prevRound = roundNumbers[r - 1];
    const round = roundNumbers[r];
    const prevMatches = byRound.get(prevRound) ?? [];
    const curMatches = byRound.get(round) ?? [];
    for (let i = 0; i < curMatches.length; i++) {
      const f0 = prevMatches[2 * i];
      const f1 = prevMatches[2 * i + 1];
      const target = curMatches[i];
      if (f0) links.push({ from: f0.id, to: target.id, slot: 0 });
      if (f1) links.push({ from: f1.id, to: target.id, slot: 1 });
    }
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
  /** Primary brand colour (hex, with or without #). */
  accent1?: string;
  /** Secondary brand colour (hex, with or without #). */
  accent2?: string;
  /** Panel / surface background colour (hex, with or without #). */
  background?: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));

// Colours come from CSS variables, so the same drawing follows the app theme
// and the document's branding accent.
const DEFAULT_COLORS = {
  acc: '#1f5eff',
  ink: '#161c24',
  muted: '#697386',
  line: '#c8ced8',
  card: '#ffffff',
};

/** Renders the tree as one self-contained, printable SVG. */
export function bracketSvg(o: BracketSvgOptions): string {
  const { tree, title, championLabel, accent1, accent2, background } = o;
  const acc = accent1 ?? DEFAULT_COLORS.acc;
  const ink = DEFAULT_COLORS.ink;
  const muted = DEFAULT_COLORS.muted;
  const line = DEFAULT_COLORS.line;
  const card = background ?? DEFAULT_COLORS.card;
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
    const side = (s: string, won: boolean, y: number, goals: string) =>
      `<text x="${n.x + 8}" y="${y}" font-size="11" fill="${won ? acc : ink}" `
      + `font-weight="${won ? 700 : 400}">${esc(clip(s, 19))}</text>`
      + `<text x="${n.x + NODE_W - 8}" y="${y}" font-size="11" text-anchor="end" `
      + `fill="${muted}" font-variant-numeric="tabular-nums">${esc(goals)}</text>`;
    parts.push(side(n.home, n.homeWon, n.y + 16, n.homeScore));
    parts.push(side(n.away, n.awayWon, n.y + NODE_H - 8, n.awayScore));
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
