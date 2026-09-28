// Tournament output model — everything that leaves the app: printed sheets,
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
import { Branding, brandingOf } from './branding';
import { describeFormat, pickQualifiers } from './generate';
import { decidedWinner } from './pairings';
import { computeStandings } from './standings';
import { Group, Match, Participant, StandingRow, Tournament, VenueResource } from './types';

export type ReportKind = 'standings' | 'matches' | 'schedule' | 'bracket' | 'groups' | 'pack';

export const REPORT_KINDS: { kind: ReportKind; label: string; hint: string }[] = [
  { kind: 'standings', label: 'Standings', hint: 'The table after the last round — for players and officials.' },
  { kind: 'matches', label: 'Match list', hint: 'Every match with number, round, result, time and court.' },
  { kind: 'schedule', label: 'Schedule', hint: 'Timetable by time and court for venue staff.' },
  { kind: 'bracket', label: 'Bracket', hint: 'Knockout rounds with winners carried through.' },
  { kind: 'groups', label: 'Groups', hint: 'A table and match list per group, plus qualifiers.' },
  { kind: 'pack', label: 'Organizer pack', hint: 'Everything in one document, ready to print.' },
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
  note?: string;
  /** Start on a fresh page — keeps a title from being split from its table. */
  pageBreakBefore?: boolean;
}

export interface ReportMeta {
  title: string;
  subtitle: string;
  edition: string;
  headerNote: string;
  /** "Sat 14 Mar 2026 · Sports Hall" — empty when the event has neither. */
  contextLine: string;
  generatedLine: string;
  footer: string;
  notes: string;
  accent: string;
  logoDataUrl: string;
  sponsorDataUrl: string;
}

export interface Report { kind: ReportKind; meta: ReportMeta; sections: Section[]; }

// ---- Formatting (locale-independent on purpose) ---------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Engine-owned status wording. Kept short so it fits a printed column. */
const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled', played: 'Played', walkover: 'Walkover', draw: 'Draw',
  overtime: 'AET', interrupted: 'Interrupted', unfinished: 'Unfinished', bye: 'Bye',
};

export function matchStatusLabel(status: string): string { return STATUS_LABEL[status] ?? status; }

function asDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "14 Mar 2026" — day first, unambiguous, no locale surprises. */
export function fmtDate(iso?: string | null): string {
  const d = asDate(iso);
  if (!d) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateFull(iso?: string | null): string {
  const d = asDate(iso);
  if (!d) return '';
  return `${DAYS[d.getDay()]} ${fmtDate(iso)}`;
}

/** 24-hour "14:30" — the notation referees and venue sheets expect. */
export function fmtTime(iso?: string | null): string {
  const d = asDate(iso);
  if (!d) return '';
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
 * A bye is not a match — one side is empty and it is decided by default, so it
 * never belongs on a sheet a referee works from. It still counts for standings
 * (bye points). A *pending* knockout match, on the other hand, must be printed
 * with an empty side, otherwise the bracket would hide its own final.
 */
function isPlayable(m: Match): boolean { return m.result.status !== 'bye'; }

function buildContext(input: ReportInput): Ctx {
  const t = input.tournament;
  const b = brandingOf(input.branding ? { name: t.name, branding: input.branding } : t);
  const ordered = [...input.matches].sort((x, y) =>
    x.round - y.round ||
    (x.scheduledAt ?? '').localeCompare(y.scheduledAt ?? '') ||
    (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return {
    t, b,
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

const nameOf = (c: Ctx, id?: string | null): string => (id ? c.names.get(id) ?? 'Unknown' : '—');

function courtOf(c: Ctx, m: Match): string {
  if (m.resourceId) return c.resources.get(m.resourceId)?.name ?? m.venue ?? '';
  return m.venue ?? '';
}

function scoreOf(m: Match): string {
  const r = m.result;
  if (r.status === 'bye') return 'Bye';
  if (r.status === 'walkover') return 'W/O';
  if (r.homeScore === null || r.awayScore === null) return '–';
  return `${r.homeScore}–${r.awayScore}`;
}

function statusOf(c: Ctx, m: Match): string {
  const r = m.result;
  if (r.status === 'walkover') {
    const w = r.walkoverWinnerId ?? r.winnerId;
    return w ? `${matchStatusLabel('walkover')} — ${nameOf(c, w)}` : matchStatusLabel('walkover');
  }
  return matchStatusLabel(r.status);
}

// ---- Standings ------------------------------------------------------------

const TIEBREAK_LABEL: Record<string, string> = {
  points: 'points', wins: 'wins', diff: 'goal difference', scored: 'goals scored',
  buchholz: 'Buchholz', seed: 'seed', name: 'name',
};

/** Printed so a dispute can be settled from the paper, not from memory. */
function tiebreakNote(t: Tournament): string {
  const order = (t.rules.tiebreakOrder ?? []).map(k => TIEBREAK_LABEL[k] ?? k);
  return order.length ? `Tie-breaks in order: ${order.join(' → ')}.` : '';
}

/** Columns and rows are produced together so they can never drift apart. */
function standingTable(c: Ctx, rows: StandingRow[]): { columns: Column[]; rows: Cell[][] } {
  const b = c.b;
  const columns: Column[] = [
    { key: 'rank', label: '#', align: 'center' },
    { key: 'name', label: c.t.individualOrTeam === 'team' ? 'Team' : 'Player' },
    { key: 'played', label: 'P', align: 'right' },
    { key: 'wins', label: 'W', align: 'right' },
  ];
  if (!b.compactStandings) {
    columns.push({ key: 'draws', label: 'D', align: 'right' }, { key: 'losses', label: 'L', align: 'right' });
  }
  columns.push({ key: 'points', label: 'Pts', align: 'right' });
  if (!b.compactStandings) {
    columns.push({ key: 'scored', label: 'Scored', align: 'right' }, { key: 'diff', label: 'Diff', align: 'right' });
  }
  if (b.showAdvancedStats) columns.push({ key: 'buchholz', label: 'Buchholz', align: 'right' });

  const body: Cell[][] = rows.map(r => {
    const p = c.participants.get(r.participantId);
    const label = c.names.get(r.participantId) ?? 'Unknown';
    const row: Cell[] = [r.rank, p && p.active === false ? `${label} (WD)` : label, r.played, r.wins];
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
  return standingsSection(c, 'standings', 'Standings', 'Overall table',
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
    id: 'qualifiers', title: 'Qualifiers',
    sub: perGroup > 0 ? `Top ${perGroup} in each group advance to the next stage.` : '',
    columns: [
      { key: 'group', label: 'Group' }, { key: 'pos', label: 'Pos', align: 'center' },
      { key: 'name', label: c.t.individualOrTeam === 'team' ? 'Team' : 'Player' },
      { key: 'points', label: 'Pts', align: 'right' }, { key: 'diff', label: 'Diff', align: 'right' },
    ],
    rows: picks.map(p => [
      groupName.get(p.fromGroupId) ?? '—', p.groupRank,
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
      ...standingsSection(c, `group-${g.id}-table`, `${g.name} — standings`, '', rows),
      // Every group starts on its own page: an organiser flips pages, not rows.
      pageBreakBefore: i > 0,
    });
    out.push(matchListSection(c, { id: `group-${g.id}-matches`, title: `${g.name} — matches`, matches: c.ordered.filter(m => m.groupId === g.id) }));
  });
  out.push(qualifiersSection(c, tables));
  return out;
}

// ---- Match list -----------------------------------------------------------

function matchListColumns(c: Ctx): Column[] {
  const cols: Column[] = [{ key: 'no', label: 'No.', align: 'right' }];
  if (c.groups.length > 0) cols.push({ key: 'group', label: 'Group' });
  cols.push({ key: 'round', label: 'Round' }, { key: 'home', label: 'Home' },
    { key: 'score', label: 'Score', align: 'center' }, { key: 'away', label: 'Away' },
    { key: 'status', label: 'Status' }, { key: 'time', label: 'Time', align: 'right' },
    { key: 'court', label: 'Court / table' });
  return cols;
}

function matchListRows(c: Ctx, matches: Match[]): Cell[][] {
  const groupName = new Map(c.groups.map(g => [g.id, g.name]));
  return matches.map(m => {
    const row: Cell[] = [c.noOf.get(m.id) ?? ''];
    if (c.groups.length > 0) row.push(m.groupId ? groupName.get(m.groupId) ?? '—' : '—');
    row.push(m.roundName || `Round ${m.round}`, nameOf(c, m.homeId), scoreOf(m), nameOf(c, m.awayId),
      statusOf(c, m), m.scheduledAt ? fmtTime(m.scheduledAt) : '', courtOf(c, m));
    return row;
  });
}

function matchListSection(c: Ctx, opts?: { id: string; title: string; matches: Match[] }): Section {
  // Byes are dropped: a sheet a referee works from must only list real pairings.
  const matches = (opts?.matches ?? c.ordered).filter(isPlayable);
  return {
    id: opts?.id ?? 'matches', title: opts?.title ?? 'Match list',
    sub: opts ? '' : `${matches.length} match${matches.length === 1 ? '' : 'es'}, in playing order.`,
    columns: matchListColumns(c), rows: matchListRows(c, matches),
  };
}

// ---- Schedule -------------------------------------------------------------

function scheduleSections(c: Ctx): Section[] {
  const rows = c.ordered.filter(m => !!m.scheduledAt && !!m.homeId && !!m.awayId);
  if (!rows.length) return [];
  const columns: Column[] = [
    { key: 'time', label: 'Time', align: 'right' },
    { key: 'court', label: 'Court / table' },
    { key: 'no', label: 'Match', align: 'right' },
    { key: 'round', label: 'Round' },
    { key: 'home', label: 'Home' },
    { key: 'score', label: 'Score', align: 'center' },
    { key: 'away', label: 'Away' },
    { key: 'status', label: 'Status' },
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
    title: days.length > 1 ? `Timetable — ${fmtDateFull(day)}` : 'Timetable',
    sub: `${rows.filter(m => sameDay(m.scheduledAt!, day)).length} matches. Times are local to the venue.`,
    columns,
    rows: rows.filter(m => sameDay(m.scheduledAt!, day)).sort(byTime).map(m => [
      fmtTime(m.scheduledAt), courtOf(c, m), c.noOf.get(m.id) ?? '',
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
    name: ms[0]?.roundName || `Round ${round}`,
    label: `Round ${round}`,
    rows: ms.map(m => ({
      no: c.noOf.get(m.id) ?? '', home: nameOf(c, m.homeId), score: scoreOf(m),
      away: nameOf(c, m.awayId), status: statusOf(c, m),
    })),
  }));
}

function bracketSections(c: Ctx): Section[] {
  const matches = knockoutMatches(c);
  if (!matches.length) return [];
  const out: Section[] = [{
    id: 'bracket', title: 'Knockout bracket',
    sub: 'Rounds in playing order; winners carry through to the next round.',
    rounds: bracketRounds(c, matches),
  }];
  // The final is the highest round present; decided means a champion exists.
  const last = matches[matches.length - 1];
  const champ = last ? decidedWinner(last) : null;
  if (champ) {
    out.push({
      id: 'champion', title: 'Result',
      columns: [{ key: 'label', label: '' }, { key: 'name', label: '' }],
      rows: [
        ['Champion', nameOf(c, champ)],
        ['Decided in', last.roundName || `Round ${last.round}`],
      ],
    });
  }
  return out;
}

// ---- Organizer pack -------------------------------------------------------

const FINISHED: ReadonlySet<Match['result']['status']> =
  new Set(['played', 'draw', 'walkover', 'overtime']);

function overviewSection(c: Ctx): Section {
  const t = c.t;
  const played = c.ordered.filter(m => FINISHED.has(m.result.status)).length;
  const dates = [fmtDate(t.dates?.start), fmtDate(t.dates?.end)].filter(Boolean);
  const rules: Cell[] = [
    `Win ${t.rules.winPoints} / draw ${t.rules.drawPoints} / loss ${t.rules.lossPoints} points`,
    t.rules.allowDraws ? 'Draws allowed' : 'Draws not allowed',
    t.rules.homeAway ? 'Home and away' : 'Single round-robin',
  ];
  if ((t.rules.tiebreakOrder ?? []).includes('buchholz')) rules.push('Buchholz tie-break');
  return {
    id: 'overview', title: 'Tournament information',
    columns: [{ key: 'field', label: 'Field' }, { key: 'value', label: 'Value' }],
    rows: [
      ['Format', describeFormat(t.format)],
      [t.individualOrTeam === 'team' ? 'Teams' : 'Participants', String(c.participants.size)],
      ['Rounds', String(c.ordered.length ? Math.max(...c.ordered.map(m => m.round)) : 0)],
      ['Matches played', `${played} of ${c.ordered.filter(m => m.result.status !== 'bye').length}`],
      ['Dates', dates.length > 1 && dates[0] !== dates[1] ? dates.join(' – ') : (dates[0] || '—')],
      ['Venue', t.location || '—'],
      ['Rules', rules.join(' · ')],
      ['Seeding', t.rules.seeding],
    ],
  };
}

function packSections(c: Ctx): Section[] {
  const withGroups = c.groups.length > 0;
  return [
    overviewSection(c),
    ...(withGroups ? groupSections(c) : [overallStandings(c)]),
    matchListSection(c),
    ...scheduleSections(c),
    ...bracketSections(c),
  ];
}

// ---- Report ---------------------------------------------------------------

function buildMeta(c: Ctx, generatedAt?: string): ReportMeta {
  const t = c.t, b = c.b;
  const bits: string[] = [];
  if (b.showVenueDate) {
    const start = fmtDate(t.dates?.start), end = fmtDate(t.dates?.end);
    if (start && end && start !== end) bits.push(`${start} – ${end}`);
    else if (start || end) bits.push(start || end);
    if (t.location) bits.push(t.location);
  }
  return {
    title: b.eventTitle || t.name || 'Tournament',
    subtitle: b.subtitle, edition: b.edition, headerNote: b.headerNote,
    contextLine: bits.join('  ·  '),
    generatedLine: generatedAt ? `Generated ${fmtDateFull(generatedAt)} at ${fmtTime(generatedAt)}` : '',
    footer: b.footerNote, notes: b.notes, accent: b.accent,
    logoDataUrl: b.logoDataUrl, sponsorDataUrl: b.sponsorDataUrl,
  };
}

function buildSections(c: Ctx, kind: ReportKind): Section[] {
  switch (kind) {
    // A group event has no meaningful overall table — the groups *are* the table.
    case 'standings':
    case 'groups':
      return c.groups.length > 0 ? groupSections(c) : [overallStandings(c)];
    case 'matches': return [matchListSection(c)];
    case 'schedule': return scheduleSections(c);
    case 'bracket': return bracketSections(c);
    case 'pack': return packSections(c);
  }
}

/** Builds one printable document. Deterministic for a given input + timestamp. */
export function buildReport(input: ReportInput, kind: ReportKind): Report {
  const c = buildContext(input);
  return { kind, meta: buildMeta(c, input.generatedAt), sections: buildSections(c, kind) };
}

/** Every row of a report, flattened — the basis for CSV export. */
export function reportRows(report: Report): { title: string; cells: string[] }[] {
  const out: { title: string; cells: string[] }[] = [];
  for (const s of report.sections) {
    if (s.columns && s.rows) {
      out.push({ title: s.title, cells: s.columns.map(c2 => c2.label) });
      for (const r of s.rows) out.push({ title: s.title, cells: r.map(v => String(v)) });
    } else if (s.rounds) {
      for (const rd of s.rounds) {
        out.push({ title: rd.name, cells: ['No.', 'Home', 'Score', 'Away', 'Status'] });
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
  return lines.length ? '﻿' + lines.join('\r\n') + '\r\n' : '';
}
