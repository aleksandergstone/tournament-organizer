// Output documents: standings, match list, timetable, bracket, groups, and the
// branded PDF/CSV rendering. These tests assert the printed structure itself —
// column labels, row order, values — because that is what an organizer hands to
// a referee and what a dispute is settled from.
import { describe, it, expect } from 'vitest';
import { DEFAULT_BRANDING, DEFAULT_ACCENT, brandingOf, isHexColor, normalizeBranding } from '../src/engine/branding';
import { genRoundRobin } from '../src/engine/generate';
import { genSingleElim } from '../src/engine/elim';
import { recordResult } from '../src/engine/result';
import { recomputeBracket } from '../src/engine/recompute';
import {
  Report, ReportInput, buildReport, fmtDate, fmtTime, reportToCsv,
} from '../src/engine/output';
import { escapeHtml, renderReportHtml, reportFileName } from '../src/engine/pdf';
import { serializeProject, parseProject } from '../src/engine/storage';
import {
  DEFAULT_RULES, DEFAULT_SETTINGS, Group, Match, Participant, Tournament, VenueResource, uid,
} from '../src/engine/types';

const AT = '2026-03-14T10:00:00.000Z'; // caller-supplied stamp keeps reports stable

function ps(names: string[]): Participant[] {
  return names.map((n, i) => ({
    id: `p${i}_${uid('x')}`, name: n, kind: 'team' as const, tags: [],
    seed: i + 1, active: true, withdrawnRound: null, avatar: null,
  }));
}

function t(over: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1', name: 'Winter Cup', sport: 'Football', individualOrTeam: 'team',
    format: 'round-robin', dates: { start: '2026-03-14', end: '2026-03-15' },
    location: 'Sports Hall', visibility: 'private', rules: { ...DEFAULT_RULES },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    archived: false, ...over,
  };
}

function input(over: Partial<ReportInput> = {}): ReportInput {
  return {
    tournament: t(), participants: [], groups: [], matches: [],
    generatedAt: AT, ...over,
  };
}

/** local-time slot, so assertions about the printed clock are timezone-proof. */
function slot(h: number, m: number, day = 14): string {
  return new Date(2026, 2, day, h, m, 0, 0).toISOString();
}

function rr(names: string[]): { participants: Participant[]; matches: Match[] } {
  const participants = ps(names);
  return { participants, matches: genRoundRobin(participants, DEFAULT_RULES) };
}

function play(matches: Match[], id: string, hs: number, as: number, knockout = false): Match[] {
  const r = recordResult(matches, id, { homeScore: hs, awayScore: as, status: 'played' }, DEFAULT_RULES, { knockout });
  expect(r.issues).toEqual([]);
  return r.matches;
}

function section(report: Report, id: string) {
  const s = report.sections.find(x => x.id === id);
  expect(s, `section "${id}" is missing from the ${report.kind} report`).toBeTruthy();
  return s!;
}

const labels = (s: { columns?: { label: string }[] }) => (s.columns ?? []).map(c => c.label);

// ------------------------------------------------------------------ standings

describe('standings document', () => {
  it('lists every participant by rank with points, wins, draws and losses', () => {
    const { participants, matches } = rr(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const report = buildReport(input({ participants, matches }), 'standings');
    const s = section(report, 'standings');
    expect(labels(s)).toEqual(['#', 'Team', 'P', 'W', 'D', 'L', 'Pts', 'Scored', 'Diff']);
    expect(s.rows).toHaveLength(4);
    expect(s.rows!.map(r => r[0])).toEqual([1, 2, 3, 4]);
    for (const row of s.rows!) {
      expect(row.length).toBe(s.columns!.length);
      expect(row[1]).not.toBe('—'); // every row names a real team
    }
  });

  it('orders by points, so the leader is first once results are entered', () => {
    const { participants, matches } = rr(['Lions', 'Tigers', 'Bears']);
    const first2 = matches.filter(m => m.result.status === 'scheduled').slice(0, 2);
    const m = first2.reduce((acc, x) => play(acc, x.id, 3, 0), matches);
    const s = section(buildReport(input({ participants, matches: m }), 'standings'), 'standings');
    const leader = s.rows![0];
    expect(leader[2]).toBe(2);  // played
    expect(leader[3]).toBe(2);  // wins
    expect(leader[6]).toBe(6);  // points (3 per win)
  });

  it('prints the tie-break order so a disputed position can be checked', () => {
    const { participants, matches } = rr(['Lions', 'Tigers']);
    const s = section(buildReport(input({ participants, matches }), 'standings'), 'standings');
    expect(s.note).toContain('Tie-breaks in order');
    expect(s.note).toContain('points difference');
  });

  it('adds Buchholz only when advanced statistics are switched on', () => {
    const { participants, matches } = rr(['Lions', 'Tigers', 'Bears']);
    const plain = buildReport(input({ participants, matches, branding: { showAdvancedStats: false } }), 'standings');
    const rich = buildReport(input({ participants, matches, branding: { showAdvancedStats: true } }), 'standings');
    expect(labels(section(plain, 'standings'))).not.toContain('Buchholz');
    const richSection = section(rich, 'standings');
    expect(labels(richSection)).toContain('Buchholz');
    for (const row of richSection.rows!) expect(row.length).toBe(richSection.columns!.length);
  });

  it('compacts the table for narrow paper', () => {
    const { participants, matches } = rr(['Lions', 'Tigers']);
    const s = section(buildReport(input({ participants, matches, branding: { compactStandings: true } }), 'standings'), 'standings');
    expect(labels(s)).toEqual(['#', 'Team', 'P', 'W', 'Pts']);
    for (const row of s.rows!) expect(row.length).toBe(5);
  });

  it('marks a withdrawn participant instead of silently listing them', () => {
    const { participants, matches } = rr(['Lions', 'Tigers']);
    const withWD = participants.map((p, i) => (i === 1 ? { ...p, active: false } : p));
    const s = section(buildReport(input({ participants: withWD, matches }), 'standings'), 'standings');
    expect(String(s.rows![1][1])).toContain('(WD)');
  });
});

// ----------------------------------------------------------------- match list

describe('match list document', () => {
  it('numbers matches 1..n in playing order', () => {
    const { participants, matches } = rr(['Lions', 'Tigers', 'Bears']);
    const s = section(buildReport(input({ participants, matches }), 'matches'), 'matches');
    expect(labels(s)).toEqual(['No.', 'Round', 'Home', 'Score', 'Away', 'Status', 'Time', 'Place']);
    expect(s.rows!.map(r => r[0])).toEqual(['1', '2', '3']);
    // Playing order = round, then the scheduled slot inside the round.
    const rounds = s.rows!.map(r => Number(String(r[1]).replace(/\D/g, '')));
    expect(rounds).toEqual([...rounds].sort((a, b) => a - b));
  });

  it('shows the result, the status and the court for a played match', () => {
    const { participants, matches } = rr(['Lions', 'Tigers']);
    const resources: VenueResource[] = [{ id: 'c1', name: 'Court 1', kind: 'court' }];
    const scheduled = [{ ...matches[0], scheduledAt: slot(14, 30), resourceId: 'c1' }];
    const m = play(scheduled, scheduled[0].id, 2, 1);
    const s = section(buildReport(input({ participants, matches: m, resources }), 'matches'), 'matches');
    expect(s.rows![0][3]).toBe('2–1');
    expect(s.rows![0][5]).toBe('Played');
    expect(s.rows![0][6]).toBe('14:30');
    expect(s.rows![0][7]).toBe('Court 1');
  });

  it('names the walkover winner, so the sheet explains an unplayed match', () => {
    const { participants, matches } = rr(['Lions', 'Tigers']);
    const r = recordResult(matches, matches[0].id, { status: 'walkover', walkoverWinnerId: matches[0].homeId }, DEFAULT_RULES, {});
    const s = section(buildReport(input({ participants, matches: r.matches }), 'matches'), 'matches');
    expect(s.rows![0][3]).toBe('W/O');
    expect(String(s.rows![0][5])).toBe('Walkover — Lions');
  });

  it('leaves byes out and keeps the numbering consecutive', () => {
    // Three teams in a round robin: the generator adds a bye per round.
    const { participants, matches } = rr(['Lions', 'Tigers', 'Bears']);
    expect(matches.some(m => m.result.status === 'bye')).toBe(true);
    const s = section(buildReport(input({ participants, matches }), 'matches'), 'matches');
    expect(s.rows!.map(r => r[0])).toEqual(['1', '2', '3']);
    for (const row of s.rows!) {
      expect(row[2]).not.toBe('—');
      expect(row[4]).not.toBe('—');
    }
  });

  it('adds a group column once a group stage exists', () => {
    const { participants, matches } = rr(['Lions', 'Tigers']);
    const groups: Group[] = [{ id: 'g1', name: 'Group A', participantIds: participants.map(p => p.id) }];
    const withGroup = matches.map(m => ({ ...m, groupId: 'g1' }));
    const s = section(buildReport(input({ tournament: t({ format: 'groups-knockout' }), participants, matches: withGroup, groups }), 'matches'), 'matches');
    expect(labels(s)).toContain('Group');
    expect(s.rows![0][1]).toBe('Group A');
  });
});

// ------------------------------------------------------------------- schedule

describe('schedule document', () => {
  it('has no sections when nothing is scheduled', () => {
    const { participants, matches } = rr(['Lions', 'Tigers']);
    expect(buildReport(input({ participants, matches }), 'schedule').sections).toEqual([]);
  });

  it('orders the timetable by time, then by court', () => {
    const { participants, matches } = rr(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const resources: VenueResource[] = [
      { id: 'c1', name: 'Court 1', kind: 'court' },
      { id: 'c2', name: 'Court 2', kind: 'court' },
    ];
    const times = [slot(16, 0), slot(10, 0), slot(10, 0), slot(18, 0), slot(10, 0), slot(18, 0)];
    const timed = matches.map((m, i) => ({ ...m, scheduledAt: times[i], resourceId: i % 2 ? 'c2' : 'c1' }));
    const s = section(buildReport(input({ participants, matches: timed, resources }), 'schedule'), 'schedule-1');
    expect(labels(s)).toEqual(['Time', 'Place', 'Match', 'Round', 'Home', 'Score', 'Away', 'Status']);
    expect(s.rows!.map(r => r[0])).toEqual(['10:00', '10:00', '10:00', '16:00', '18:00', '18:00']);
    expect(s.rows![0][1]).toBe('Court 1'); // same slot → courts alphabetically
  });

  it('splits a two-day event into one timetable per day', () => {
    const { participants, matches } = rr(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const timed = matches.map((m, i) => ({ ...m, scheduledAt: slot(i < 3 ? 10 : 14, 0, i < 3 ? 14 : 15) }));
    const report = buildReport(input({ participants, matches: timed }), 'schedule');
    expect(report.sections).toHaveLength(2);
    expect(report.sections[0].title).toContain('Timetable');
    expect(report.sections[0].title).toMatch(/14 Mar 2026/);
    expect(report.sections[1].title).toMatch(/15 Mar 2026/);
    expect(report.sections[1].pageBreakBefore).toBe(true);
    expect(report.sections[0].rows).toHaveLength(3);
    expect(report.sections[1].rows).toHaveLength(3);
    expect(fmtDate('2026-03-14T00:00:00')).toMatch(/Mar 2026/);
  });

  it('falls back to the venue text when a match has no resource', () => {
    const { participants, matches } = rr(['Lions', 'Tigers']);
    const timed = [{ ...matches[0], scheduledAt: slot(9, 0), venue: 'Hall A' }];
    const s = section(buildReport(input({ participants, matches: timed }), 'schedule'), 'schedule-1');
    expect(s.rows![0][1]).toBe('Hall A');
  });
});

// ---------------------------------------------------------- bracket and groups

describe('bracket document', () => {
  function ko(names: string[]) {
    const participants = ps(names);
    return { participants, matches: genSingleElim(participants, DEFAULT_RULES).matches };
  }
  /** Plays every match that has both sides, until nothing more can be played. */
  function playAll(matches: Match[]): Match[] {
    let m = matches;
    for (let i = 0; i < 8; i++) {
      const open = m.filter(x => x.homeId && x.awayId && x.result.status === 'scheduled');
      if (!open.length) break;
      for (const x of open) m = play(m, x.id, 2, 1, true);
    }
    return m;
  }

  it('prints rounds in order, from the first to the last', () => {
    const { participants, matches } = ko(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const s = section(buildReport(input({ tournament: t({ format: 'single-elimination' }), participants, matches }), 'bracket'), 'bracket');
    const rounds = s.rounds!;
    expect(rounds.length).toBe(2);
    expect(rounds[0].rows).toHaveLength(2);
    expect(rounds[0].rows[0].no).toBe('1');
    // Round 1 is fixed at generation; the final waits for the winners.
    for (const m of rounds[0].rows) expect(m.home).not.toBe('—');
    for (const m of rounds[1].rows) expect(m.home).toBe('—');
  });

  it('carries winners into the next round', () => {
    const { participants, matches } = ko(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const semi = matches.filter(x => x.round === 1);
    const m = semi.reduce((acc, x) => play(acc, x.id, 3, 0, true), matches);
    const s = section(buildReport(input({ tournament: t({ format: 'single-elimination' }), participants, matches: m }), 'bracket'), 'bracket');
    const final = s.rounds![1];
    const winners = m.filter(x => x.round === 1).map(x => participants.find(p => p.id === x.result.winnerId)!.name);
    expect(final.rows[0].home).toBe(winners[0]);
    expect(final.rows[0].away).toBe(winners[1]);
  });

  it('names the champion once the final is decided', () => {
    const { participants, matches } = ko(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const m = playAll(matches);
    const report = buildReport(input({ tournament: t({ format: 'single-elimination' }), participants, matches: m }), 'bracket');
    const champ = section(report, 'champion');
    expect(champ.rows![0][0]).toBe('Champion');
    expect(participants.some(p => p.name === champ.rows![0][1])).toBe(true);
  });

  it('prints no bracket for a format without a knockout stage', () => {
    const { participants, matches } = ko(['Lions', 'Tigers']);
    const groups: Group[] = [{ id: 'g1', name: 'Group A', participantIds: participants.map(p => p.id) }];
    const allGroup = matches.map(m => ({ ...m, groupId: 'g1' }));
    expect(buildReport(input({ participants, matches: allGroup, groups }), 'bracket').sections).toEqual([]);
  });
});

describe('group document', () => {
  function grouped() {
    const participants = ps(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const groups: Group[] = [
      { id: 'gA', name: 'Group A', participantIds: participants.slice(0, 2).map(p => p.id) },
      { id: 'gB', name: 'Group B', participantIds: participants.slice(2).map(p => p.id) },
    ];
    const matches = groups.flatMap(g => genRoundRobin(
      g.participantIds.map(id => participants.find(p => p.id === id)!), DEFAULT_RULES, g.id, g.name));
    return { participants, groups, matches };
  }

  it('gives every group its own table and its own match list', () => {
    const { participants, groups, matches } = grouped();
    const report = buildReport(input({
      tournament: t({ format: 'groups-knockout', rules: { ...DEFAULT_RULES, groupCount: 2, advancePerGroup: 1 } }),
      participants, groups, matches,
    }), 'groups');
    expect(report.sections.map(s => s.id)).toEqual([
      'group-gA-table', 'group-gA-matches', 'group-gB-table', 'group-gB-matches', 'qualifiers',
    ]);
    expect(report.sections[0].title).toBe('Group A — standings');
    expect(report.sections[2].pageBreakBefore).toBe(true); // clean page per group
    // Group A's table only contains Group A's teams.
    const names = section(report, 'group-gA-table').rows!.map(r => String(r[1]));
    expect(names).toEqual(['Lions', 'Tigers']);
  });

  it('lists who advances, from the group tables', () => {
    const { participants, groups, matches } = grouped();
    const played = matches.map(m => (m.groupId === 'gA' && m.round === 1
      ? { ...m, result: { homeScore: 3, awayScore: 0, winnerId: m.homeId, status: 'played' as const } }
      : m));
    const report = buildReport(input({
      tournament: t({ format: 'groups-knockout', rules: { ...DEFAULT_RULES, groupCount: 2, advancePerGroup: 1 } }),
      participants, groups, matches: played,
    }), 'groups');
    const q = section(report, 'qualifiers');
    expect(q.columns!.map(c => c.label)).toEqual(['Group', 'Pos', 'Team', 'Pts', 'Diff']);
    expect(q.rows).toEqual([
      ['Group A', 1, 'Lions', 3, '+3'],
      ['Group B', 1, 'Bears', 0, '0'],  // unplayed group: seed order decides
    ]);
  });

  it('uses the group tables as the standings report of a group event', () => {
    const { participants, groups, matches } = grouped();
    const report = buildReport(input({
      tournament: t({ format: 'groups-knockout' }), participants, groups, matches,
    }), 'standings');
    expect(report.sections.map(s => s.id)).toContain('group-gA-table');
    expect(report.sections.map(s => s.id)).not.toContain('standings');
  });
});

// ------------------------------------------------------- branding and documents

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

describe('branding', () => {
  it('falls back to the tournament name when no event title is set', () => {
    expect(brandingOf(t()).eventTitle).toBe('Winter Cup');
    expect(brandingOf(t({ branding: { eventTitle: 'Winter Cup 2026' } })).eventTitle).toBe('Winter Cup 2026');
  });

  it('keeps good values and replaces bad ones with the defaults', () => {
    const b = normalizeBranding({
      eventTitle: '  Winter   Cup \n', accent: 'not-a-colour', logoDataUrl: 'file:///etc/passwd',
      notes: 'x'.repeat(5000), compactStandings: 'yes' as unknown as boolean,
    });
    expect(b.eventTitle).toBe('Winter Cup');
    expect(b.accent).toBe(DEFAULT_ACCENT);
    expect(b.logoDataUrl).toBe('');           // only inline images are embedded
    expect(b.notes.length).toBeLessThanOrEqual(1200);
    expect(b.compactStandings).toBe(DEFAULT_BRANDING.compactStandings);
  });

  it('accepts a valid hex colour and inline logo', () => {
    const b = normalizeBranding({ accent: '#0A8040', logoDataUrl: LOGO, sponsorDataUrl: LOGO });
    expect(isHexColor(b.accent)).toBe(true);
    expect(b.accent).toBe('#0a8040');
    expect(b.logoDataUrl).toBe(LOGO);
  });

  it('survives a project file round-trip, so branding is not lost on reload', () => {
    const { participants, matches } = rr(['Lions', 'Tigers']);
    const text = serializeProject({
      tournament: t({ branding: normalizeBranding({ eventTitle: 'Winter Cup 2026', accent: '#0a8040', logoDataUrl: LOGO }) }),
      participants, groups: [], matches, audit: [], resources: [], settings: DEFAULT_SETTINGS,
    });
    const { file, warnings } = parseProject(text);
    expect(warnings).toEqual([]);
    expect(file.tournament.branding?.eventTitle).toBe('Winter Cup 2026');
    expect(file.tournament.branding?.accent).toBe('#0a8040');
    expect(file.tournament.branding?.logoDataUrl).toBe(LOGO);
  });

  it('still loads an old project that has no branding at all', () => {
    const { participants, matches } = rr(['Lions', 'Tigers']);
    const text = serializeProject({
      tournament: t(), participants, groups: [], matches, audit: [], resources: [], settings: DEFAULT_SETTINGS,
    });
    const { file } = parseProject(text);
    expect(file.tournament.branding).toBeUndefined();
    expect(brandingOf(file.tournament).eventTitle).toBe('Winter Cup'); // still printable
  });
});

describe('document header and PDF', () => {
  const { participants, matches } = rr(['Lions', 'Tigers']);

  it('puts the event name, subtitle and edition on the document', () => {
    const html = renderReportHtml(buildReport(input({
      participants, matches,
      branding: { eventTitle: 'Winter Cup 2026', subtitle: 'City Championship', edition: 'Season 3' },
    }), 'standings'));
    expect(html).toContain('<h1>Winter Cup 2026</h1>');
    expect(html).toContain('City Championship');
    expect(html).toContain('Season 3');
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('shows venue and dates only when asked', () => {
    const withCtx = buildReport(input({ participants, matches, branding: { showVenueDate: true } }), 'standings');
    expect(withCtx.meta.contextLine).toContain('Sports Hall');
    const without = buildReport(input({ participants, matches, branding: { showVenueDate: false } }), 'standings');
    expect(without.meta.contextLine).toBe('');
  });

  it('embeds the event logo, the sponsor logo and the accent colour', () => {
    const html = renderReportHtml(buildReport(input({
      participants, matches, branding: { logoDataUrl: LOGO, sponsorDataUrl: LOGO, accent: '#0a8040' },
    }), 'standings'));
    expect(html).toContain(`src="${LOGO}"`);
    expect(html).toContain('--accent: #0a8040');
    expect(html).toContain('@page');   // print-ready page setup
  });

  it('prints footer text, a generated stamp and the notes block', () => {
    const html = renderReportHtml(buildReport(input({
      participants, matches,
      branding: { footerNote: 'Provisional until confirmed', notes: 'Two yellow cards = disqualification.' },
    }), 'standings'));
    expect(html).toContain('Provisional until confirmed');
    expect(html).toContain('Two yellow cards = disqualification.');
    expect(html).toContain('Generated ');
  });

  it('escapes text so a team called "<b>x</b>" cannot break the layout', () => {
    const evil = ps(['<b>Lions</b> & "Tigers"']);
    const html = renderReportHtml(buildReport(input({ participants: evil, matches: genRoundRobin(evil, DEFAULT_RULES) }), 'standings'));
    expect(html).toContain('&lt;b&gt;Lions&lt;/b&gt;');
    expect(html).not.toContain('<b>Lions</b>');
    expect(escapeHtml(`a'b"`)).toBe('a&#39;b&quot;');
  });

  it('names the file after the event and the document type', () => {
    const report = buildReport(input({ participants, matches, branding: { eventTitle: 'Winter Cup 2026!' } }), 'standings');
    expect(reportFileName(report, '.pdf')).toBe('winter-cup-2026-standings.pdf');
    expect(reportFileName(report, '.csv')).toBe('winter-cup-2026-standings.csv');
  });

  it('builds the same document twice for the same input', () => {
    const a = renderReportHtml(buildReport(input({ participants, matches }), 'matches'));
    const b = renderReportHtml(buildReport(input({ participants, matches }), 'matches'));
    expect(a).toBe(b); // deterministic — a re-export never churns
  });
});

describe('CSV export', () => {
  it('starts each section with its own header row', () => {
    const { participants, matches } = rr(['Lions', 'Tigers', 'Bears']);
    const csv = reportToCsv(buildReport(input({ participants, matches }), 'standings'));
    const lines = csv.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('#;Team;P;W;D;L;Pts;Scored;Diff');
    expect(lines).toHaveLength(4); // header + 3 teams
    expect(lines[1]).toContain('Lions');
  });

  it('quotes values containing the separator', () => {
    const { participants, matches } = rr(['A;B', 'C']);
    const csv = reportToCsv(buildReport(input({ participants, matches }), 'standings'));
    expect(csv).toContain('"A;B"');
  });

  it('flattens a bracket into one block per round', () => {
    const participants = ps(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const matches = genSingleElim(participants, DEFAULT_RULES).matches;
    const csv = reportToCsv(buildReport(input({ tournament: t({ format: 'single-elimination' }), participants, matches }), 'bracket'));
    expect(csv).toContain('No.;Home;Score;Away;Status');
    expect(csv).toContain('Lions');
  });
});

// ------------------------------------------------------------- organizer pack

describe('organizer pack', () => {
  it('contains the information block, the table, the match list and the bracket', () => {
    const participants = ps(['Lions', 'Tigers', 'Bears', 'Wolves']);
    const matches = genSingleElim(participants, DEFAULT_RULES).matches;
    const report = buildReport(input({
      tournament: t({ format: 'single-elimination' }),
      participants, matches,
      resources: [{ id: 'c1', name: 'Court 1', kind: 'court' }],
      branding: { eventTitle: 'Winter Cup 2026' },
    }), 'pack');
    // A knockout with nothing scheduled still yields info, table, matches, bracket.
    expect(report.sections.map(s => s.id)).toEqual(['overview', 'standings', 'matches', 'bracket']);
    const overview = section(report, 'overview');
    expect(overview.rows!.map(r => r[0])).toContain('Format');
    expect(overview.rows!.map(r => r[0])).toContain('Matches played');
    expect(section(report, 'standings').title).toBe('Standings');
    expect(report.meta.title).toBe('Winter Cup 2026');
  });

  it('adds the timetable to the pack once matches are scheduled', () => {
    const { participants, matches } = rr(['Lions', 'Tigers']);
    const timed = [{ ...matches[0], scheduledAt: slot(12, 0) }];
    const report = buildReport(input({ participants, matches: timed }), 'pack');
    expect(report.sections.map(s => s.id)).toContain('schedule-1');
  });
});

