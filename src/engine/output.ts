// Tournament output model \u2014 everything that leaves the app: printed sheets,
// PDFs and CSV files.
//
// Pure and deterministic. Builders take a snapshot of the project plus a
// caller-supplied timestamp and return a printable structure. No DOM, no file
// access, no randomness, no tournament logic: the same input always yields the
// same document, which is what makes exports testable and diffable.
//
// A report is a header (`meta`) plus an ordered list of `sections`. Each
// section is either a table (columns + rows) or a set of rounds (bracket view).
// The PDF/print renderer and the CSV writer both consume only this structure.
import { Branding, brandingOf, documentTitle, fileBaseName, hasRegulation, type DateStyle, type TimeStyle } from './branding';
import { describeFormat, hasPointTable, pickQualifiers } from './generate';
import { buildBracketTree, knockoutPlaces } from './bracket-view';
import { renderBracketHtml } from './bracket-html';
import { decidedWinner } from './pairings';
import { computeStandings } from './standings';
import { Group, Match, Participant, StandingRow, Tournament, VenueResource } from './types';
import { disciplineOf, venueLabel } from './discipline';
import { t, getLocale, INTL_LOCALES, type Dict } from '../i18n';

export type ReportKind = 'standings' | 'matches' | 'schedule' | 'bracket' | 'groups' | 'regulation';

/** Labels and hints are dictionary keys: the Output screen translates them. */
export const REPORT_KINDS: { kind: ReportKind; label: keyof Dict; hint: keyof Dict }[] = [
  { kind: 'standings', label: 'out.kind.standings', hint: 'out.kind.standingsHint' },
  { kind: 'matches', label: 'out.kind.matches', hint: 'out.kind.matchesHint' },
  { kind: 'schedule', label: 'out.kind.schedule', hint: 'out.kind.scheduleHint' },
  { kind: 'bracket', label: 'out.kind.bracket', hint: 'out.kind.bracketHint' },
  { kind: 'groups', label: 'out.kind.groups', hint: 'out.kind.groupsHint' },
  { kind: 'regulation', label: 'out.kind.regulation', hint: 'out.kind.regulationHint' },
];

export interface ReportInput {
  tournament: Tournament;
  participants: Participant[];
  groups: Group[];
  matches: Match[];
  resources?: VenueResource[];
  branding?: Branding | null;
  /** Caller supplies it so exports are reproducible in tests. */
  generatedAt?: string;
}

export interface Column { key: string; label: string; align?: 'left' | 'center' | 'right'; }
export type Cell = string | number;

export interface RoundRow { no: string; home: string; score: string; away: string; status: string; }
export interface RoundView { name: string; label: string; rows: RoundRow[]; note?: string; }

export interface Section {
  id: string;
  title: string;
  sub?: string;
  columns?: Column[];
  rows?: Cell[][];
  rounds?: RoundView[];
  /** A drawn bracket ("spider") as one self-contained SVG string. */
  bracket?: string;
  note?: string;
  /**
   * A full-width caption row printed at the top of *every* page of the table.
   * A multi-day timetable puts the day here, so the date survives a day that
   * spills onto a second sheet instead of living only in the section title.
   */
  headerRow?: string;
  /** Free-running prose (a regulation): rendered line-for-line, never as a table. */
  prose?: string;
  /** Start on a fresh page \u2014 keeps a title from being split from its table. */
  pageBreakBefore?: boolean;
}

export interface ReportMeta {
  title: string;
  /** Title used for the printed document / file metadata (branding override). */
  docTitle: string;
  /** Organiser-supplied file base name; '' = derive from the title. */
  fileNameBase: string;
  subtitle: string;
  edition: string;
  headerNote: string;
  /** "Sat 14 Mar 2026 \u00B7 Sports Hall" \u2014 empty when the event has neither. */
  contextLine: string;
  generatedLine: string;
  footer: string;
  notes: string;
  accent1: string;
  accent2: string;
  background: string;
  logoDataUrl: string;
  logoPlacement: 'top-left' | 'top-right' | 'center' | 'none';
  sponsorDataUrl: string;
  dateFormat: DateStyle;
  timeFormat: TimeStyle;
}

export interface Report { kind: ReportKind; meta: ReportMeta; sections: Section[]; }

// ---- Formatting (locale-independent on purpose) ---------------------------

/** Engine-owned status wording. Kept short so it fits a printed column. */
const STATUS_KEYS: Record<string, keyof Dict> = {
  scheduled: 'doc.scheduled', played: 'doc.played', walkover: 'doc.walkover', draw: 'doc.draw',
  overtime: 'doc.oet', interrupted: 'doc.interrupted', unfinished: 'doc.unfinished', bye: 'doc.bye', tbd: 'common.tbd',
};

export function matchStatusLabel(status: string): string {
  const k = STATUS_KEYS[status];
  return k ? t(k) : status;
}

function asDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Dates follow the active language unless the event pins a style. */
export function fmtDate(iso?: string | null, style: DateStyle = 'locale'): string {
  const d = asDate(iso);
  if (!d) return '';
  const loc = INTL_LOCALES[getLocale()];
  switch (style) {
    case 'dayMonth':
      return new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
    case 'monthDay':
      return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(d);
    case 'iso':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    default:
      return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }
}

export function fmtDateFull(iso?: string | null, style: DateStyle = 'locale'): string {
  const d = asDate(iso);
  if (!d) return '';
  if (style === 'locale') {
    return new Intl.DateTimeFormat(INTL_LOCALES[getLocale()], {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    }).format(d);
  }
  const wd = new Intl.DateTimeFormat(INTL_LOCALES[getLocale()], { weekday: 'short' }).format(d);
  return `${wd} ${fmtDate(iso, style)}`;
}

/** 24-hour "14:30" by default \u2014 the notation referees and venue sheets expect. */
export function fmtTime(iso?: string | null, style: TimeStyle = 'h24'): string {
  const d = asDate(iso);
  if (!d) return '';
  if (style === 'h12') {
    const h = d.getHours() % 12 || 12;
    return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Same calendar day (local) as the other ISO timestamp. */
function sameDay(a: string, b: string): boolean {
  const x = asDate(a), y = asDate(b);
  if (!x || !y) return false;
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

function fmtSigned(n: number): string { return n > 0 ? `+${n}` : String(n); }

// ---- Shared context -------------------------------------------------------

interface Ctx {
  t: Tournament;
  b: Branding;
  groups: Group[];
  names: Map<string, string>;
  participants: Map<string, Participant>;
  resources: Map<string, VenueResource>;
  /** Match order used everywhere: round, then scheduled slot, then id. */
  ordered: Match[];
  noOf: Map<string, string>;
}

/**
 * A bye is not a match \u2014 one side is empty and it is decided by default, so it
 * never belongs on a sheet a referee works from. It still counts for standings
 * (bye points). A *pending* knockout match, on the other hand, must be printed
 * with an empty side, otherwise the bracket would hide its own final.
 */
function isPlayable(m: Match): boolean { return m.result.status !== 'bye'; }

function buildContext(input: ReportInput): Ctx {
  const tour = input.tournament;
  const b = brandingOf(input.branding ? { name: tour.name, branding: input.branding } : tour);
  const ordered = [...input.matches].sort((x, y) =>
    x.round - y.round ||
    (x.scheduledAt ?? '').localeCompare(y.scheduledAt ?? '') ||
    (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return {
    t: tour, b,
    groups: input.groups,
    names: new Map(input.participants.map(p => [p.id, p.name])),
    participants: new Map(input.participants.map(p => [p.id, p])),
    resources: new Map((input.resources ?? []).map(r => [r.id, r])),
    ordered,
    // Byes are skipped, so the printed numbers are consecutive: match 3 really
    // is the third match a referee has to supervise.
    noOf: new Map(ordered.filter(isPlayable).map((m, i) => [m.id, String(i + 1)])),
  };
}

const nameOf = (c: Ctx, id?: string | null): string => (id ? c.names.get(id) ?? t('common.unknown') : '\u2014');

function courtOf(c: Ctx, m: Match): string {
  if (m.resourceId) return c.resources.get(m.resourceId)?.name ?? m.venue ?? '';
  return m.venue ?? '';
}

function scoreOf(m: Match): string {
  const r = m.result;
  if (r.status === 'bye') return 'Bye';
  if (r.status === 'walkover') return 'W/O';
  if (r.homeScore === null || r.awayScore === null) return '\u2013';
  return `${r.homeScore}\u2013${r.awayScore}`;
}

function statusOf(c: Ctx, m: Match): string {
  const r = m.result;
  if (r.status === 'walkover') {
    const w = r.walkoverWinnerId ?? r.winnerId;
    return w ? `${matchStatusLabel('walkover')} \u2014 ${nameOf(c, w)}` : matchStatusLabel('walkover');
  }
  return matchStatusLabel(r.status);
}

// ---- Standings ------------------------------------------------------------

const TIEBREAK_KEYS: Record<string, keyof Dict> = {
  points: 'doc.tiebreak.points', wins: 'doc.tiebreak.wins', diff: 'doc.tiebreak.diff',
  scored: 'doc.tiebreak.scored', buchholz: 'doc.tiebreak.buchholz',
  seed: 'doc.tiebreak.seed', name: 'doc.tiebreak.name',
};

/** Printed so a dispute can be settled from the paper, not from memory. */
function tiebreakNote(tour: Tournament): string {
  const order = (tour.rules.tiebreakOrder ?? []).map(k => { const key = TIEBREAK_KEYS[k]; return key ? t(key) : k; });
  return order.length ? t('doc.tiebreaks', { order: order.join(' \u2192 ') }) : '';
}

/** Columns and rows are produced together so they can never drift apart. */
function standingTable(c: Ctx, rows: StandingRow[]): { columns: Column[]; rows: Cell[][] } {
  const b = c.b;
  const isTeam = c.participants.size > 0 && [...c.participants.values()].every(p => p.kind === 'team');
  const columns: Column[] = [
    { key: 'rank', label: '#', align: 'center' },
    // Discipline-aware: Crew, Team, Player \u2014 not just the team/player pair.
    { key: 'name', label: isTeam ? t('doc.team') : t('doc.player') },
    { key: 'played', label: t('doc.colP'), align: 'right' },
    { key: 'wins', label: t('doc.colW'), align: 'right' },
  ];
  if (!b.compactStandings) {
    columns.push({ key: 'draws', label: t('doc.colD'), align: 'right' }, { key: 'losses', label: t('doc.colL'), align: 'right' });
  }
  columns.push({ key: 'points', label: t('doc.colPts'), align: 'right' });
  if (!b.compactStandings) {
    columns.push({ key: 'scored', label: t('doc.colScored'), align: 'right' }, { key: 'diff', label: t('doc.colDiff'), align: 'right' });
  }
  if (b.showAdvancedStats) columns.push({ key: 'buchholz', label: t('doc.tiebreak.buchholz'), align: 'right' });

  const body: Cell[][] = rows.map(r => {
    const p = c.participants.get(r.participantId);
    const label = c.names.get(r.participantId) ?? t('common.unknown');
    const row: Cell[] = [r.rank, p && p.active === false ? `${label}${t('doc.withdrawnMark')}` : label, r.played, r.wins];
    if (!b.compactStandings) row.push(r.draws, r.losses);
    row.push(r.points);
    if (!b.compactStandings) row.push(r.scored, fmtSigned(r.diff));
    if (b.showAdvancedStats) row.push(r.buchholz);
    return row;
  });
  return { columns, rows: body };
}

function standingsSection(c: Ctx, id: string, title: string, sub: string, rows: StandingRow[]): Section {
  const { columns, rows: body } = standingTable(c, rows);
  return { id, title, sub, columns, rows: body, note: tiebreakNote(c.t) };
}

function overallStandings(c: Ctx): Section {
  return standingsSection(c, 'standings', c.b.titleStandings || t('doc.standingsTitle'), t('doc.standingsSub'),
    computeStandings([...c.participants.values()], c.ordered, c.t.rules));
}

// ---- Groups ---------------------------------------------------------------

function groupRowsOf(c: Ctx, g: Group): StandingRow[] {
  const members = g.participantIds.map(id => c.participants.get(id)).filter((p): p is Participant => !!p);
  return computeStandings(members, c.ordered.filter(m => m.groupId === g.id), c.t.rules);
}

function qualifiersSection(c: Ctx, tables: Map<string, StandingRow[]>): Section {
  const perGroup = Math.max(0, Math.floor(c.t.rules.advancePerGroup ?? 0));
  const picks = pickQualifiers(c.groups, tables, { perGroup });
  const groupName = new Map(c.groups.map(g => [g.id, g.name]));
  return {
    id: 'qualifiers', title: t('doc.qualifiers'),
    sub: perGroup > 0 ? t('doc.qualifiersSub', { n: perGroup }) : '',
    columns: [
      { key: 'group', label: t('common.group') }, { key: 'pos', label: t('doc.pos'), align: 'center' },
      { key: 'name', label: c.participants.size > 0 && [...c.participants.values()].every(p => p.kind === 'team') ? t('doc.team') : t('doc.player') },
      { key: 'points', label: t('doc.colPts'), align: 'right' }, { key: 'diff', label: t('doc.colDiff'), align: 'right' },
    ],
    rows: picks.map(p => [
      groupName.get(p.fromGroupId) ?? '\u2014', p.groupRank,
      c.names.get(p.participantId) ?? 'Unknown', p.points, fmtSigned(p.diff),
    ]),
  };
}

function groupSections(c: Ctx): Section[] {
  const tables = new Map<string, StandingRow[]>();
  const out: Section[] = [];
  c.groups.forEach((g, i) => {
    const rows = groupRowsOf(c, g);
    tables.set(g.id, rows);
    out.push({
      ...standingsSection(c, `group-${g.id}-table`, `${g.name} \u2014 standings`, '', rows),
      // Every group starts on its own page: an organiser flips pages, not rows.
      pageBreakBefore: i > 0,
    });
    out.push(matchListSection(c, { id: `group-${g.id}-matches`, title: `${g.name} \u2014 matches`, matches: c.ordered.filter(m => m.groupId === g.id) }));
  });
  out.push(qualifiersSection(c, tables));
  return out;
}

// ---- Match list -----------------------------------------------------------

function matchListColumns(c: Ctx): Column[] {
  const cols: Column[] = [{ key: 'no', label: t('doc.no'), align: 'right' }];
  if (c.groups.length > 0) cols.push({ key: 'group', label: t('common.group') });
  cols.push({ key: 'round', label: t('common.round') }, { key: 'home', label: t('common.home') },
    { key: 'score', label: t('common.score'), align: 'center' }, { key: 'away', label: t('common.away') },
    { key: 'status', label: t('common.status') }, { key: 'time', label: t('common.time'), align: 'right' },
    // The discipline's own word for where a match is played: Court, Table,
    // Pitch, Board or Start. Falls back to the neutral "Place".
    { key: 'court', label: venueLabel(c.t) });
  return cols;
}

function matchListRows(c: Ctx, matches: Match[]): Cell[][] {
  const groupName = new Map(c.groups.map(g => [g.id, g.name]));
  return matches.map(m => {
    const row: Cell[] = [c.noOf.get(m.id) ?? ''];
    if (c.groups.length > 0) row.push(m.groupId ? groupName.get(m.groupId) ?? '\u2014' : '\u2014');
    row.push(m.roundName || t('round.n', { n: m.round }), nameOf(c, m.homeId), scoreOf(m), nameOf(c, m.awayId),
      statusOf(c, m), m.scheduledAt ? fmtTime(m.scheduledAt, c.b.timeFormat) : '', courtOf(c, m));
    return row;
  });
}

function matchListSection(c: Ctx, opts?: { id: string; title: string; matches: Match[] }): Section {
  // Byes are dropped: a sheet a referee works from must only list real pairings.
  const matches = (opts?.matches ?? c.ordered).filter(isPlayable);
  return {
    id: opts?.id ?? 'matches', title: opts?.title ?? (c.b.titleMatches || t('doc.matchList')),
    sub: opts ? '' : t(matches.length === 1 ? 'doc.matchListSubOne' : 'doc.matchListSub', { n: matches.length }),
    columns: matchListColumns(c), rows: matchListRows(c, matches),
  };
}

// ---- Schedule -------------------------------------------------------------

function scheduleSections(c: Ctx): Section[] {
  const rows = c.ordered.filter(m => !!m.scheduledAt && m.result.status !== 'bye'
    && ((!!m.homeId && !!m.awayId) || m.result.status === 'tbd'));
  if (!rows.length) return [];
  const columns: Column[] = [
    { key: 'time', label: t('common.time'), align: 'right' },
    { key: 'court', label: venueLabel(c.t) },
    { key: 'no', label: t('doc.matchCol'), align: 'right' },
    { key: 'round', label: t('common.round') },
    { key: 'home', label: t('common.home') },
    { key: 'score', label: t('common.score'), align: 'center' },
    { key: 'away', label: t('common.away') },
    { key: 'status', label: t('common.status') },
  ];
  // A multi-day event gets one timetable per day; a single-day one gets a table.
  const days: string[] = [];
  for (const m of rows) {
    const d = m.scheduledAt!;
    if (!days.some(x => sameDay(x, d))) days.push(d);
  }
  const byTime = (a: Match, b: Match) =>
    (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '') ||
    courtOf(c, a).localeCompare(courtOf(c, b)) ||
    (c.noOf.get(a.id) ?? '').localeCompare(c.noOf.get(b.id) ?? '', 'en', { numeric: true });
  return days.map((day, i) => ({
    id: `schedule-${i + 1}`,
    title: days.length > 1
      ? t('doc.timetableDay', { day: fmtDateFull(day, c.b.dateFormat) })
      : (c.b.titleSchedule || t('doc.timetable')),
    sub: t('doc.timetableSub', { n: rows.filter(m => sameDay(m.scheduledAt!, day)).length }),
    // The day also rides in the repeating table header, so page 2 of a long day
    // still says which day it belongs to.
    headerRow: days.length > 1 ? t('doc.timetableDay', { day: fmtDateFull(day, c.b.dateFormat) }) : undefined,
    columns,
    rows: rows.filter(m => sameDay(m.scheduledAt!, day)).sort(byTime).map(m => [
      fmtTime(m.scheduledAt, c.b.timeFormat), courtOf(c, m), c.noOf.get(m.id) ?? '',
      m.roundName || `Round ${m.round}`, nameOf(c, m.homeId), scoreOf(m), nameOf(c, m.awayId), statusOf(c, m),
    ]),
    pageBreakBefore: i > 0,
  }));
}

// ---- Bracket --------------------------------------------------------------

/** Knockout matches: everything outside the groups when a group stage exists. */
function knockoutMatches(c: Ctx): Match[] {
  const ko = c.groups.length > 0 ? c.ordered.filter(m => !m.groupId) : c.ordered;
  return ko.filter(isPlayable);
}

function bracketRounds(c: Ctx, matches: Match[]): RoundView[] {
  const byRound = new Map<number, Match[]>();
  for (const m of matches) {
    const list = byRound.get(m.round);
    if (list) list.push(m); else byRound.set(m.round, [m]);
  }
  return [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([round, ms]) => ({
    name: ms[0]?.roundName || t('round.n', { n: round }),
    label: t('round.n', { n: round }),
    rows: ms.map(m => ({
      no: c.noOf.get(m.id) ?? '', home: nameOf(c, m.homeId), score: scoreOf(m),
      away: nameOf(c, m.awayId), status: statusOf(c, m),
    })),
  }));
}

  // ---- Knockout -------------------------------------------------------------

function bracketSections(c: Ctx): Section[] {
  const matches = knockoutMatches(c);
  if (!matches.length) return [];
  const fmt = c.t.format;
  const branding = c.b;

  const sections: Section[] = [];

  // Bracket section â€” drawn identically to the "Drabinka" tab (same HTML, same geometry).
  sections.push({
    id: 'bracket', title: branding.titleBracket || t('doc.knockout'),
    sub: t('doc.knockoutSub'),
    pageBreakBefore: true,
  });

  if (fmt === 'double-elimination') {
    const ending = (c.t.rules as any).doubleElimEnding ?? 'single';

    // Winners bracket â€” own tree, own page.
    const wb = matches.filter(m => m.bracket?.kind === 'winners');
    if (wb.length) {
      sections.push(...bracketTreeSections(c, wb, branding.titleBracket || t('bracket.winners'), t('bracket.winners')));
    }
    // Losers bracket â€” own tree, own page.
    const lb = matches.filter(m => m.bracket?.kind === 'losers');
    if (lb.length) {
      sections.push(...bracketTreeSections(c, lb, t('bracket.losers'), t('bracket.losers')));
    }
    // Grand final â€” own tree, own page.
    const gf = matches.filter(m => m.bracket?.kind === 'final');
    if (gf.length) {
      sections.push(...bracketTreeSections(c, gf, t('bracket.grandFinal'), t('doc.championLabel'), ending === 'double', ending === 'thirdPlace'));
    }
  } else {
    // Single elimination or groups-knockout: add the drawn SVG to the main
    // bracket section (for PDF). The round table above already covers CSV.
    const tree = buildBracketTree(matches, id => nameOf(c, id), {
      emptyLabel: '\u2014', byeLabel: matchStatusLabel('bye'), roundName: n => t('round.n', { n }),
    });
    const drawable = matches.length > 1;
    if (drawable) {
      const bracketSection = sections.find(s => s.id === 'bracket')!;
      bracketSection.bracket = renderBracketHtml({
        nodes: tree.nodes, links: tree.links, rounds: tree.rounds,
        width: tree.width, height: tree.height,
        championMatchId: null,
        championLabel: t('doc.championLabel'),
        pn: id => id ? c.names.get(id) ?? '\u2014' : '\u2014',
        branding: c.b,
      });
      bracketSection.note = t('doc.spiderNote');
    }
  }

  // Champion result table.
  const last = matches[matches.length - 1];
  const champ = last ? decidedWinner(last) : null;
  if (champ) {
    sections.push({
      id: 'champion', title: t('doc.result'),
      columns: [{ key: 'label', label: '' }, { key: 'name', label: '' }],
      rows: [
        [t('doc.champion'), nameOf(c, champ)],
        [t('doc.decidedIn'), last.roundName || t('round.n', { n: last.round })],
      ],
    });
  }
  return sections;
}

/**
 * Builds one or more bracket-drawing sections for a set of matches.
 * Splits into multiple pages when the bracket has too many rounds to fit
 * on a single sheet. Each segment gets its own tree so the drawing stays
 * readable instead of being squeezed.
 */
function bracketTreeSections(c: Ctx, matches: Match[], title: string, championLabel: string, includeReset = false, includeThird = false): Section[] {
  const tree = buildBracketTree(matches, id => nameOf(c, id), {
    emptyLabel: '\u2014', byeLabel: matchStatusLabel('bye'), roundName: n => t('round.n', { n }),
  });

  const sections: Section[] = [];
  const maxRoundsPerPage = 4;

  // When the bracket fits on one page, render it as a single SVG section.
  if (tree.rounds.length <= maxRoundsPerPage) {
    sections.push({
      id: `bracket-${title.toLowerCase().replace(/\s+/g, '-')}`, title, sub: t('doc.knockoutSub'),
      pageBreakBefore: true,
      bracket: renderBracketHtml({
        nodes: tree.nodes, links: tree.links, rounds: tree.rounds,
        width: tree.width, height: tree.height,
        championMatchId: null,
        championLabel,
        pn: id => id ? c.names.get(id) ?? '\u2014' : '\u2014',
        branding: c.b,
      }),
      note: t('doc.spiderNote'),
    });
    return sections;
  }

  // Otherwise split into segments of maxRoundsPerPage rounds each.
  for (let i = 0; i < tree.rounds.length; i += maxRoundsPerPage) {
    const segRounds = tree.rounds.slice(i, i + maxRoundsPerPage);
    const segRoundNumbers = new Set(segRounds.map(r => r.round));
    const segMatches = matches.filter(m => segRoundNumbers.has(m.round));
    const segTree = buildBracketTree(segMatches, id => nameOf(c, id), {
      emptyLabel: '\u2014', byeLabel: matchStatusLabel('bye'), roundName: n => t('round.n', { n }),
    });
    sections.push({
      id: `bracket-${title.toLowerCase().replace(/\s+/g, '-')}-${i}`, title: i === 0 ? title : `${title} (cont.)`,
      sub: i === 0 ? t('doc.knockoutSub') : '',
      pageBreakBefore: i === 0,
      bracket: renderBracketHtml({
        nodes: segTree.nodes, links: segTree.links, rounds: segTree.rounds,
        width: segTree.width, height: segTree.height,
        championMatchId: null,
        championLabel: i === 0 ? championLabel : '',
        pn: id => id ? c.names.get(id) ?? '\u2014' : '\u2014',
        branding: c.b,
      }),
      note: i === 0 ? t('doc.spiderNote') : '',
    });
  }
  return sections;
}

// ---- Report ---------------------------------------------------------------

function buildMeta(c: Ctx, generatedAt?: string): ReportMeta {
  const tour = c.t, b = c.b;
  const bits: string[] = [];
  if (b.showVenueDate) {
    // The discipline name comes first when one was chosen: a sheet handed to a
    // scorer has to say whose rules it is under. No discipline = no sport name.
    const d = disciplineOf(tour);
    if (d.id !== 'generic') bits.push(t(d.label));
    const start = fmtDate(tour.dates?.start, b.dateFormat), end = fmtDate(tour.dates?.end, b.dateFormat);
    if (start && end && start !== end) bits.push(`${start} \u2013 ${end}`);
    else if (start || end) bits.push(start || end);
    if (tour.location) bits.push(tour.location);
  }
  const title = b.eventTitle || tour.name || t('doc.tournament');
  return {
    title,
    docTitle: documentTitle(b, title),
    fileNameBase: fileBaseName(b),
    subtitle: b.subtitle, edition: b.edition, headerNote: b.headerNote,
    contextLine: bits.join('  \u00B7  '),
    generatedLine: generatedAt
      ? t('doc.generated', { date: fmtDateFull(generatedAt, b.dateFormat), time: fmtTime(generatedAt, b.timeFormat) })
      : '',

    footer: b.footerNote, notes: b.notes, accent1: b.accent1, accent2: b.accent2, background: b.background,
    logoDataUrl: b.logoDataUrl, logoPlacement: b.logoPlacement, sponsorDataUrl: b.sponsorDataUrl,
    dateFormat: b.dateFormat, timeFormat: b.timeFormat,
  };
}

/**
 * The event's regulations as their own printable block. Rendered as prose so a
 * numbered list keeps its line breaks; `null` when nothing has been written.
 */
function regulationSection(c: Ctx): Section | null {
  if (!hasRegulation(c.b)) return null;
  return {
    id: 'regulation',
    title: c.b.regulation.title || t('doc.regulation'),
    prose: c.b.regulation.body,
    pageBreakBefore: true,
  };
}

/**
 * A knockout bracket has no meaningful points table: the order comes from who
 * survived. Such events print the final result instead of a ranking.
 */
function finalResultSection(c: Ctx): Section | null {
  if (hasPointTable(c.t.format)) return null;
  const places = knockoutPlaces(knockoutMatches(c), id => nameOf(c, id));
  if (!places.length) return null;
  return {
    id: 'final', title: t('doc.finalTitle'), sub: t('doc.finalSub'),
    columns: [
      { key: 'place', label: t('doc.place'), align: 'center' },
      { key: 'name', label: t('st.colWho') },
    ],
    rows: places.map(p => [p.place, p.name]),
  };
}

function buildSections(c: Ctx, kind: ReportKind): Section[] {
  const final = finalResultSection(c);
  const reg = regulationSection(c);
  const inlineReg = reg && c.b.regulation.includeInDocs ? [reg] : [];
  switch (kind) {
    // A group event has no meaningful overall table \u2014 the groups *are* the table.
    case 'standings':
    case 'groups': {
      const base = c.groups.length > 0 ? groupSections(c) : final ? [final] : [overallStandings(c)];
      return [...base, ...inlineReg];
    }
    case 'matches': return [matchListSection(c)];
    case 'schedule': return scheduleSections(c);
    case 'bracket': return bracketSections(c);
    case 'regulation': return reg ? [reg] : [];
  }
}

/** Builds one printable document. Deterministic for a given input + timestamp. */
export function buildReport(input: ReportInput, kind: ReportKind): Report {
  const c = buildContext(input);
  return { kind, meta: buildMeta(c, input.generatedAt), sections: buildSections(c, kind) };
}

/** Every row of a report, flattened \u2014 the basis for CSV export. */
export function reportRows(report: Report): { title: string; cells: string[] }[] {
  const out: { title: string; cells: string[] }[] = [];
  for (const s of report.sections) {
    if (s.columns && s.rows) {
      out.push({ title: s.title, cells: s.columns.map(c2 => c2.label) });
      for (const r of s.rows) out.push({ title: s.title, cells: r.map(v => String(v)) });
    } else if (s.rounds) {
      for (const rd of s.rounds) {
        out.push({ title: rd.name, cells: [t('doc.no'), t('common.home'), t('common.score'), t('common.away'), t('common.status')] });
        for (const m of rd.rows) out.push({ title: rd.name, cells: [m.no, m.home, m.score, m.away, m.status] });
      }
    }
  }
  return out;
}

/** Excel-safe CSV of the report (BOM + CRLF so accents survive in Excel). */
export function reportToCsv(report: Report): string {
  const esc = (v: string) => /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = reportRows(report).map(r => r.cells.map(esc).join(';'));
  return lines.length ? '\uFEFF' + lines.join('\r\n') + '\r\n' : '';
}











