// Event operations: display mode, venue scheduling, group→knockout planning,
// QR deep links and LAN merge rules. Behaviour, not implementation.
import { describe, it, expect } from 'vitest';
import { DEFAULT_RULES, DEFAULT_SETTINGS, Group, Match, Participant, ProjectFile, StandingRow, Tournament, VenueResource, uid } from '../src/engine/types';
import { buildDisplay, upcomingOrder } from '../src/engine/display';
import { detectConflicts, suggestSlots, toEntries } from '../src/engine/schedule';
import { planKnockout, applyPlan } from '../src/engine/ko-plan';
import { formatDeepLink, parseDeepLink, resolveDeepLink } from '../src/engine/deeplink';
import { makePayload, mergeProjects, parsePayload } from '../src/engine/sync';
import { genGroupsKnockout } from '../src/engine/generate';
import { recordResult } from '../src/engine/result';

function ps(names: string[]): Participant[] {
  return names.map((n, i) => ({ id: 'p' + i, name: n, kind: 'team', tags: [], seed: i + 1, active: true, withdrawnRound: null, avatar: null }));
}
function match(id: string, home: string | null, away: string | null, over: Partial<Match> = {}): Match {
  return {
    id, round: over.round ?? 1, roundName: over.roundName ?? 'Round 1',
    homeId: home, awayId: away,
    result: { homeScore: null, awayScore: null, winnerId: null, status: 'scheduled', ...(over.result ?? {}) },
    scheduledAt: over.scheduledAt ?? null,
    venue: over.venue ?? null,
    resourceId: over.resourceId ?? null,
    durationMin: over.durationMin ?? null,
    modifiedAt: over.modifiedAt ?? null,
    bracket: over.bracket ?? null,
  };
}
const nameMap = (list: { id: string; name: string }[]) => new Map(list.map(p => [p.id, p.name]));

// ---------------------------------------------------------------- display
describe('display mode', () => {
  const players = ps(['A', 'B', 'C', 'D']);
  it('picks the next playable match as current and the following one as next', () => {
    const ms = [match('m1', 'p0', 'p1'), match('m2', 'p2', 'p3'), match('m3', null, null)];
    const model = buildDisplay({
      tournamentName: 'Cup', matches: ms, names: nameMap(players), standings: [], updatedAt: 'now',
    });
    expect(model.status).toBe('live');
    expect(model.statusLabel).toBe('Up next');
    expect(model.current?.id).toBe('m1');
    expect(model.next?.id).toBe('m2');
    expect(model.openCount).toBe(2);
  });
  it('honours scheduled times before round order', () => {
    const ms = [
      match('late', 'p0', 'p1', { round: 1, scheduledAt: '2026-09-27T18:00:00.000Z' }),
      match('early', 'p2', 'p3', { round: 1, scheduledAt: '2026-09-27T16:00:00.000Z' }),
    ];
    expect(upcomingOrder(ms).map(m => m.id)).toEqual(['early', 'late']);
  });
  it('skips matches that are finished or still TBD', () => {
    const played = match('done', 'p0', 'p1', { result: { homeScore: 2, awayScore: 0, winnerId: 'p0', status: 'played' } });
    const model = buildDisplay({
      tournamentName: 'Cup', matches: [played, match('open', 'p2', 'p3'), match('tbd', null, null)],
      names: nameMap(players), standings: [], updatedAt: 'now',
    });
    expect(model.current?.id).toBe('open');
    expect(model.next).toBeNull();
    expect(model.playedCount).toBe(1);
    expect(model.totalCount).toBe(2);
  });
  it('reports complete only when every match with sides is finished', () => {
    const played = (id: string, h: string, a: string) =>
      match(id, h, a, { result: { homeScore: 1, awayScore: 0, winnerId: h, status: 'played' } });
    const done = buildDisplay({ tournamentName: 'Cup', matches: [played('a', 'p0', 'p1')], names: nameMap(players), standings: [], updatedAt: 'n' });
    expect(done.status).toBe('complete');
    const waiting = buildDisplay({ tournamentName: 'Cup', matches: [match('t', null, null)], names: nameMap(players), standings: [], updatedAt: 'n' });
    expect(waiting.status).toBe('waiting');
  });
  it('shows the place of the current match for the hall screen', () => {
    const ms = [match('m1', 'p0', 'p1', { scheduledAt: '2026-09-27T18:00:00.000Z', venue: 'Court 1' })];
    const model = buildDisplay({ tournamentName: 'Cup', matches: ms, names: nameMap(players), standings: [], updatedAt: 'n' });
    expect(model.current?.resource).toBe('Court 1');
  });
});

// -------------------------------------------------------------- scheduling
describe('venue scheduling', () => {
  const resources: VenueResource[] = [
    { id: 'c1', name: 'Court 1', kind: 'court' },
    { id: 'c2', name: 'Court 2', kind: 'court' },
  ];
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 27, h, m)).toISOString();

  it('finds no conflict for back-to-back matches', () => {
    const ms = [
      match('m1', 'p0', 'p1', { resourceId: 'c1', scheduledAt: at(10), durationMin: 30 }),
      match('m2', 'p2', 'p3', { resourceId: 'c1', scheduledAt: at(10, 30), durationMin: 30 }),
    ];
    expect(detectConflicts(ms, resources)).toEqual([]);
  });
  it('detects a double booking on one place', () => {
    const ms = [
      match('m1', 'p0', 'p1', { resourceId: 'c1', scheduledAt: at(10), durationMin: 60 }),
      match('m2', 'p2', 'p3', { resourceId: 'c1', scheduledAt: at(10, 30), durationMin: 30 }),
    ];
    const conflicts = detectConflicts(ms, resources);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe('overlap');
    expect(conflicts[0].matchIds).toEqual(['m1', 'm2']);
  });
  it('does not flag the same time on different places', () => {
    const ms = [
      match('m1', 'p0', 'p1', { resourceId: 'c1', scheduledAt: at(10), durationMin: 30 }),
      match('m2', 'p2', 'p3', { resourceId: 'c2', scheduledAt: at(10), durationMin: 30 }),
    ];
    expect(detectConflicts(ms, resources)).toEqual([]);
  });
  it('reports a match assigned to a place that no longer exists', () => {
    const ms = [match('m1', 'p0', 'p1', { resourceId: 'gone', scheduledAt: at(10) })];
    expect(detectConflicts(ms, resources).some(c => c.kind === 'unknown-resource')).toBe(true);
  });
  it('plans slots that never double-book and keep clear of existing bookings', () => {
    const ms = [
      match('m1', 'p0', 'p1', { resourceId: 'c1', scheduledAt: at(10), durationMin: 30 }),
      match('m2', 'p2', 'p3'),
      match('m3', 'p0', 'p2'),
      match('m4', 'p1', 'p3'),
    ];
    const plan = suggestSlots(ms, resources, { dayStart: at(9) });
    expect(plan).toHaveLength(3);
    const byCourt = new Map<string, { from: number; to: number }[]>();
    for (const s of plan) {
      const from = new Date(s.start).getTime();
      const to = new Date(s.end).getTime();
      const list = byCourt.get(s.resourceId) ?? [];
      if (s.resourceId === 'c1') {
        // must not overlap the already booked 10:00–10:30 slot
        expect(from >= new Date(at(10, 30)).getTime() || to <= new Date(at(10)).getTime()).toBe(true);
      }
      for (const b of list) expect(from < b.to && to > b.from).toBe(false);
      list.push({ from, to });
      byCourt.set(s.resourceId, list);
    }
  });
  it('is deterministic: the same input gives the same plan', () => {
    const ms = [match('m2', 'p2', 'p3'), match('m1', 'p0', 'p1')];
    expect(suggestSlots(ms, resources, { dayStart: at(9) })).toEqual(suggestSlots(ms, resources, { dayStart: at(9) }));
  });
  it('lists assigned matches in time order with the place name', () => {
    const ms = [
      match('m2', 'p2', 'p3', { resourceId: 'c2', scheduledAt: at(12) }),
      match('m1', 'p0', 'p1', { resourceId: 'c1', scheduledAt: at(10) }),
    ];
    const entries = toEntries(ms, resources);
    expect(entries.map(e => e.matchId)).toEqual(['m1', 'm2']);
    expect(entries[0].resourceName).toBe('Court 1');
  });
});

// ------------------------------------------------------- group -> knockout
describe('group stage to knockout planning', () => {
  const players = ps(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  const rules = { ...DEFAULT_RULES, groupCount: 2, advancePerGroup: 2 };
  const { groups, matches } = genGroupsKnockout(players, rules);
  const domain = {
    tournament: { id: 't1', name: 'Cup', rules } as unknown as Tournament,
    participants: players, groups, matches, audit: [], resources: [],
  };
  // A realistic group table: strictly decreasing by rank.
  function tables(): Map<string, StandingRow[]> {
    const m = new Map<string, StandingRow[]>();
    for (const g of groups) {
      m.set(g.id, (g.participantIds as string[]).map((id, i) => ({
        participantId: id, played: 3, wins: 3 - i, draws: 0, losses: i,
        scored: 8 - i, conceded: i, diff: 8 - 2 * i, points: 9 - 3 * i,
        buchholz: 0, rank: i + 1,
      })));
    }
    return m;
  }

  it('plans the requested qualifiers and changes nothing until confirmed', () => {
    const plan = planKnockout({
      groups, standingsByGroup: tables(), participants: players, rules,
      options: { perGroup: 2, wildcards: 0 }, existingMatches: matches,
    });
    expect(plan.reason).toBeNull();
    expect(plan.qualifiers).toHaveLength(4);
    expect(plan.matches).toHaveLength(3);          // 4 qualifiers → 3 matches
    expect(plan.qualifiers.map(q => q.seed)).toEqual([1, 2, 3, 4]);
    expect(plan.qualifiers.every(q => q.fromGroup !== '')).toBe(true);
    expect(domain.matches).toBe(matches);          // preview is side-effect free
  });
  it('is deterministic for the same standings', () => {
    const input = { groups, standingsByGroup: tables(), participants: players, rules, options: { perGroup: 2, wildcards: 0 }, existingMatches: matches };
    expect(planKnockout(input).seededOrder).toEqual(planKnockout(input).seededOrder);
  });
  it('supports wildcards on top of the group places', () => {
    const plan = planKnockout({
      groups, standingsByGroup: tables(), participants: players, rules,
      options: { perGroup: 1, wildcards: 2 }, existingMatches: matches,
    });
    expect(plan.reason).toBeNull();
    expect(plan.qualifiers).toHaveLength(4);            // 1 per group + 2 wildcards
    expect(plan.qualifiers.some(q => q.groupRank === 2)).toBe(true); // a wildcard
  });
  it('refuses an odd number of qualifiers with a clear reason', () => {
    const plan = planKnockout({
      groups, standingsByGroup: tables(), participants: players, rules,
      options: { perGroup: 1, wildcards: 1 }, existingMatches: matches,
    });
    expect(plan.matches).toEqual([]);
    expect(plan.reason).toMatch(/cannot form a bracket/);
  });
  it('refuses when there is no group stage yet', () => {
    const plan = planKnockout({
      groups, standingsByGroup: new Map(), participants: players, rules,
      options: { perGroup: 2, wildcards: 0 }, existingMatches: [],
    });
    expect(plan.reason).toMatch(/Generate the group stage/);
  });
  it('applies the plan: group results kept, knockout appended past group rounds', () => {
    const plan = planKnockout({
      groups, standingsByGroup: tables(), participants: players, rules,
      options: { perGroup: 2, wildcards: 0 }, existingMatches: matches,
    });
    const next = applyPlan(domain, plan, rules);
    const groupCount = next.matches.filter(m => m.groupId).length;
    expect(groupCount).toBe(matches.filter(m => m.groupId).length);
    expect(next.matches).toHaveLength(groupCount + plan.matches.length);
    expect(Math.min(...next.matches.filter(m => !m.groupId).map(m => m.round)))
      .toBeGreaterThan(Math.max(...next.matches.filter(m => m.groupId).map(m => m.round)));
    expect(next.resources).toEqual([]);
  });
});

// ------------------------------------------------------------ QR deep links
describe('QR deep links', () => {
  const link = { projectId: 't_1', kind: 'checkin' as const, id: 'p_1' };
  it('round-trips every kind', () => {
    for (const kind of ['checkin', 'match', 'station'] as const) {
      expect(parseDeepLink(formatDeepLink({ ...link, kind })))
        .toEqual({ ok: true, link: { ...link, kind } });
    }
  });
  it('rejects codes from other apps and malformed codes', () => {
    expect(parseDeepLink('https://example.com')).toMatchObject({ ok: false });
    expect(parseDeepLink('')).toMatchObject({ ok: false });
    expect(parseDeepLink('to://t_1')).toMatchObject({ ok: false });
    expect(parseDeepLink('to://t_1/unknown/p1')).toMatchObject({ ok: false });
  });
  it('resolves to a concrete action, or explains why not', () => {
    const project = { id: 't_1', participants: [{ id: 'p_1' }], matches: [{ id: 'm_1' }], resources: [{ id: 'r_1' }] };
    expect(resolveDeepLink({ projectId: 't_1', kind: 'checkin', id: 'p_1' }, project))
      .toEqual({ kind: 'checkin', participantId: 'p_1' });
    expect(resolveDeepLink({ projectId: 't_1', kind: 'match', id: 'm_1' }, project))
      .toEqual({ kind: 'match', matchId: 'm_1' });
    expect(resolveDeepLink({ projectId: 't_1', kind: 'station', id: 'r_1' }, project))
      .toEqual({ kind: 'station', resourceId: 'r_1' });
    expect(resolveDeepLink({ projectId: 't_1', kind: 'match', id: 'gone' }, project))
      .toEqual({ kind: 'error', message: 'This match no longer exists in the project.' });
    expect(resolveDeepLink({ projectId: 'other', kind: 'checkin', id: 'p_1' }, project))
      .toEqual({ kind: 'error', message: 'This code belongs to a different tournament project.' });
  });
  it('renders a QR image locally, without any service', async () => {
    const QRCode = (await import('qrcode')).default;
    const url = await QRCode.toDataURL(formatDeepLink(link), { width: 200 });
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(url.length).toBeGreaterThan(200);
  });
});

// -------------------------------------------------------------- LAN sync
describe('LAN sync', () => {
  const tour = { id: 't_1', name: 'Cup', updatedAt: '2026-09-27T10:00:00.000Z' } as unknown as Tournament;
  const file = (matches: Match[], over: Partial<ProjectFile> = {}): ProjectFile => ({
    version: 1, app: 'tournament-organizer', tournament: tour,
    participants: ps(['A', 'B', 'C', 'D']), groups: [] as Group[],
    matches, audit: [], settings: DEFAULT_SETTINGS, resources: [], ...over,
  });
  const played = (hs: number, at: string) => match('m1', 'p0', 'p1', {
    modifiedAt: at,
    result: { homeScore: hs, awayScore: 0, winnerId: 'p0', status: 'played' },
  });

  it('wraps and validates a payload', () => {
    const payload = makePayload(file([match('m1', 'p0', 'p1')]), '2026-09-27T10:00:00.000Z');
    expect(parsePayload(payload)).toMatchObject({ ok: true });
    expect(parsePayload({ app: 'something-else' })).toMatchObject({ ok: false });
    expect(parsePayload(null)).toMatchObject({ ok: false });
  });
  it('takes the result that was edited last', () => {
    const res = mergeProjects(file([played(1, '2026-09-27T10:00:00.000Z')]), file([played(3, '2026-09-27T11:00:00.000Z')]));
    expect(res.ok).toBe(true);
    expect(res.fromRemote).toEqual(['m1']);
    expect(res.merged.matches[0].result.homeScore).toBe(3);
  });
  it('keeps the local result when it is newer', () => {
    const res = mergeProjects(file([played(1, '2026-09-27T12:00:00.000Z')]), file([played(3, '2026-09-27T09:00:00.000Z')]));
    expect(res.fromRemote).toEqual([]);
    expect(res.merged.matches[0].result.homeScore).toBe(1);
  });
  it('keeps the local result on a tie (deterministic, no flapping)', () => {
    const local = file([played(7, '2026-09-27T10:00:00.000Z')]);
    const res = mergeProjects(local, file([played(2, '2026-09-27T10:00:00.000Z')]));
    expect(res.keptLocal).toEqual(['m1']);
    expect(res.merged.matches[0].result.homeScore).toBe(7);
  });
  it('brings in matches the other device has and this one does not', () => {
    const local = file([match('m1', 'p0', 'p1', { modifiedAt: '2026-09-27T10:00:00.000Z' })]);
    const remote = file([
      match('m1', 'p0', 'p1', { modifiedAt: '2026-09-27T10:00:00.000Z' }),
      match('m2', 'p2', 'p3', { round: 2, modifiedAt: '2026-09-27T10:05:00.000Z' }),
    ]);
    const res = mergeProjects(local, remote);
    expect(res.merged.matches.map(m => m.id).sort()).toEqual(['m1', 'm2']);
    expect(res.fromRemote).toEqual(['m2']);
  });
  it('refuses to mix two different tournaments', () => {
    const other = file([], { tournament: { id: 't_2', name: 'Other', updatedAt: '2026-09-27T10:00:00.000Z' } as unknown as Tournament });
    const res = mergeProjects(file([]), other);
    expect(res.ok).toBe(false);
    expect(res.conflicts).toEqual(['other-project']);
  });
  it('takes participants and places from the device with the newer project', () => {
    const remote = file([match('m1', 'p0', 'p1')], {
      tournament: { ...tour, updatedAt: '2026-09-27T13:00:00.000Z' } as unknown as Tournament,
      resources: [{ id: 'r1', name: 'Court 1', kind: 'court' }],
    });
    const res = mergeProjects(file([match('m1', 'p0', 'p1')]), remote);
    expect(res.structureFromRemote).toBe(true);
    expect(res.merged.resources).toHaveLength(1);
  });
  it('merging leaves the bracket usable: the received result can be corrected', () => {
    const res = mergeProjects(
      file([match('m1', 'p0', 'p1', { modifiedAt: '2026-09-27T10:00:00.000Z' })]),
      file([played(2, '2026-09-27T11:00:00.000Z')]),
    );
    const next = recordResult(res.merged.matches, 'm1', { status: 'scheduled' }, DEFAULT_RULES, { knockout: true });
    expect(next.issues).toEqual([]);
  });
});



