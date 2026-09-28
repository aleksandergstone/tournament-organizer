// Demo project generator for launch screenshots.
//
// Builds three fully engine-generated, realistic projects so the screenshots show
// the real app with real data (no hand-written fake state):
//   1. "City League 2026"   — groups + knockout, group stage finished, KO seeded
//   2. "Friday Night Cup"   — double elimination in progress
//   3. "Spring Cup"        — single elimination down to the final (drawn bracket)
//
// Not part of the app build. Executed by `npm run screenshots`, which bundles
// this file with esbuild first (see scripts/make-demo-project.mjs).
import {
  DEFAULT_RULES, DEFAULT_SETTINGS, Match, ProjectFile, RuleSet, StandingRow,
  Tournament, nowIso, uid,
} from '../src/engine/types';
import { genGroupsKnockout, pickQualifiers, seedKnockout } from '../src/engine/generate';
import { genSingleElim } from '../src/engine/elim';
import { genDoubleElim } from '../src/engine/double';
import { recordResult } from '../src/engine/result';
import { recomputeBracket } from '../src/engine/recompute';
import { computeStandings } from '../src/engine/standings';

// Deterministic PRNG so re-running produces identical screenshots.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function team(name: string, seed: number) {
  return { id: uid('p'), name, kind: 'team' as const, tags: [], seed, active: true, withdrawnRound: null, avatar: null };
}

function tournament(name: string, format: Tournament['format'], rules: RuleSet, location: string): Tournament {
  const t = nowIso();
  return {
    id: uid('t'), name, sport: 'Football', individualOrTeam: 'team', format,
    participantCountExpected: null, dates: { start: null, end: null },
    location, visibility: 'private', rules,
    createdAt: t, updatedAt: t, archived: false,
  };
}

const RULES: RuleSet = { ...DEFAULT_RULES, groupCount: 2, advancePerGroup: 2, seeding: 'seeded' };

/** Plays one scheduled match with a plausible deterministic score. */
function play(matches: Match[], id: string, rnd: () => number, rules: RuleSet, knockout: boolean): Match[] {
  const m = matches.find(x => x.id === id);
  if (!m || !m.homeId || !m.awayId) return matches;
  let home = Math.floor(rnd() * 4);
  let away = Math.floor(rnd() * 3);
  if (home === away) away = home === 0 ? 1 : home - 1; // knockout needs a winner
  const r = recordResult(matches, id, { homeScore: home, awayScore: away, status: 'played' }, rules, { knockout });
  if (r.issues.length) throw new Error(`demo fixture: ${r.issues[0]}`);
  return r.matches;
}

function playFirst(matches: Match[], count: number, rnd: () => number, rules: RuleSet, knockout: boolean): Match[] {
  const open = matches
    .filter(m => ['scheduled', 'unfinished'].includes(m.result.status) && m.homeId && m.awayId)
    .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id))
    .slice(0, count)
    .map(m => m.id);
  for (const id of open) matches = play(matches, id, rnd, rules, knockout);
  return matches;
}


// ---------------------------------------------------------------------------
// 1) City League 2026 — groups + knockout
// ---------------------------------------------------------------------------
function cityLeague(): ProjectFile {
  const rnd = mulberry32(20260927);
  const participants = [
    team('Northbridge United', 1), team('Riverside Athletic', 2),
    team('Harbour City FC', 3), team('Eastfield Rovers', 4),
    team('Kingsway Town', 5), team('Southbank Wanderers', 6),
    team('Old Mill Rangers', 7), team('Westgate Albion', 8),
  ];
  const tour = tournament('City League 2026', 'groups-knockout', RULES, 'Victoria Park');

  const g = genGroupsKnockout(participants, RULES);
  let matches: Match[] = g.matches;
  // Play the whole group stage, a couple of matches per pass.
  for (let guard = 0; guard < 12; guard++) {
    const allPlayed = matches.every(m => !m.homeId || !m.awayId ||
      !['scheduled', 'unfinished'].includes(m.result.status));
    if (allPlayed) break;
    matches = playFirst(matches, 2, rnd, RULES, false);
  }

  // Seed the knockout from the group tables (same path the UI uses).
  const byId = new Map(participants.map(p => [p.id, p]));
  const tables = new Map<string, StandingRow[]>();
  for (const grp of g.groups) {
    const members = grp.participantIds.map(id => byId.get(id)!).filter(Boolean);
    tables.set(grp.id, computeStandings(members, matches.filter(m => m.groupId === grp.id), RULES));
  }
  const picks = pickQualifiers(g.groups, tables, { perGroup: 2, wildcards: 0 });
  const ko = genSingleElim(seedKnockout(picks, participants), RULES, { order: 'given' });
  const offset = matches.reduce((mx, m) => Math.max(mx, m.round), 0);
  const koMatches = ko.matches.map(m => ({ ...m, round: m.round + offset, roundName: `KO ${m.roundName}` }));
  matches = recomputeBracket([...matches, ...koMatches]);
  matches = playFirst(matches, 1, rnd, RULES, true); // one semi-final decided

  // A venue: two courts, and the first group matches put on them — this is what
  // the Schedule and Display screens show in the launch screenshots.
  const resources = [
    { id: 'r_court1', name: 'Court 1', kind: 'court' as const, note: null },
    { id: 'r_court2', name: 'Court 2', kind: 'court' as const, note: null },
  ];
  const dayStart = Date.UTC(2026, 8, 27, 9, 0, 0);
  let slot = 0;
  const scheduled = matches.map(m => {
    if (!m.groupId || !m.homeId || !m.awayId || m.result.status !== 'scheduled') return m;
    if (slot >= 6) return m;
    const court = resources[slot % resources.length];
    const start = new Date(dayStart + slot * 45 * 60_000).toISOString();
    slot++;
    return { ...m, resourceId: court.id, venue: court.name, scheduledAt: start, durationMin: 30 };
  });

  return {
    version: 1, app: 'tournament-organizer', tournament: tour, participants,
    groups: g.groups, matches: scheduled, resources,
    audit: [{ id: uid('a'), at: nowIso(), action: 'project.created', detail: 'City League 2026' }],
    settings: { ...DEFAULT_SETTINGS },
  };
}

// ---------------------------------------------------------------------------
// 2) Friday Night Cup — double elimination
// ---------------------------------------------------------------------------
function fridayCup(): ProjectFile {
  const rnd = mulberry32(4242);
  const participants = [
    team('Ironworks', 1), team('Blue Foxes', 2), team('Cedar Park', 3), team('Drifters', 4),
    team('Elm Street FC', 5), team('Falcons', 6), team('Granite Rovers', 7), team('Harriers', 8),
  ];
  const tour = tournament('Friday Night Cup', 'double-elimination', RULES, 'Old Foundry Hall');
  let matches = recomputeBracket(genDoubleElim(participants, RULES).matches);
  // Realistic mid-tournament state: winners round 1 finished, first losers
  // round partially decided → both brackets populated, final still open.
  const winnersR1 = matches
    .filter(m => m.bracket?.kind === 'winners' && m.round === 1)
    .map(m => m.id);
  for (const id of winnersR1) matches = play(matches, id, rnd, RULES, true);
  const losersR1 = matches
    .filter(m => m.bracket?.kind === 'losers' && m.homeId && m.awayId)
    .sort((a, b) => a.round - b.round)
    .slice(0, 2)
    .map(m => m.id);
  for (const id of losersR1) matches = play(matches, id, rnd, RULES, true);
  return {
    version: 1, app: 'tournament-organizer', tournament: tour, participants,
    groups: [], matches,
    audit: [{ id: uid('a'), at: nowIso(), action: 'project.created', detail: 'Friday Night Cup' }],
    settings: { ...DEFAULT_SETTINGS },
  };
}

// ---------------------------------------------------------------------------
// 3) Spring Cup — single elimination, played down to the final, so the drawn
//    bracket on the Bracket screen has a champion to show.
// ---------------------------------------------------------------------------
function springCup(): ProjectFile {
  const rnd = mulberry32(31415);
  const participants = [
    team('Aurora FC', 1), team('Bramble Rovers', 2), team('Cobalt Athletic', 3), team('Doverhill', 4),
    team('Eastgate United', 5), team('Ferndale', 6), team('Glenpark', 7), team('Havenwood', 8),
  ];
  const tour = tournament('Spring Cup', 'single-elimination', RULES, 'Meadowbank Arena');
  let matches = recomputeBracket(genSingleElim(participants, RULES).matches);
  // Quarter-finals and semi-finals decided, final still to be played — the
  // bracket then shows a real path with a match still open.
  for (let round = 1; round <= 2; round++) {
    for (const m of matches.filter(x => x.round === round && x.homeId && x.awayId)) {
      matches = play(matches, m.id, rnd, RULES, true);
    }
  }
  return {
    version: 1, app: 'tournament-organizer', tournament: tour, participants,
    groups: [], matches,
    audit: [{ id: uid('a'), at: nowIso(), action: 'project.created', detail: 'Spring Cup' }],
    settings: { ...DEFAULT_SETTINGS },
  };
}

const city = cityLeague();
const friday = fridayCup();
const spring = springCup();
const projects: Record<string, ProjectFile> = {};
projects[city.tournament.id] = city;
projects[friday.tournament.id] = friday;
projects[spring.tournament.id] = spring;

console.log(JSON.stringify({ projects }, null, 2));
