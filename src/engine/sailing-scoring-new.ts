import type {
  Boat, Flight, Id, Race, RaceResult, RuleSet, ScoringSystem, SeriesStanding,
} from './types';

export interface TeamStanding {
  teamName: string;
  boatCount: number;
  totalPoints: number;
  discardedPoints: number;
  netPoints: number;
  rank: number;
}

/** Extra knobs for scoring a single race, all optional. */
export interface ScoreOptions {
  /** Points per finishing position (1-based) when the system is 'custom'. */
  customPoints?: Record<number, number>;
  /** Points for a boat that did not finish. Default: entries + 1 (RRS), 0 for high-point. */
  nonFinisherPoints?: number;
  /** Double every point (the medal-race convention). */
  doublePoints?: boolean;
}

/**
 * Calculates result points from finishing positions under the CURRENT rules.
 * Positions are the source of truth, so this is always safe to re-run after a
 * scoring change — it never trusts previously stored points.
 */
export function scoreRaceResults(
  results: readonly RaceResult[],
  system: ScoringSystem = 'low-point',
  options: ScoreOptions = {},
): RaceResult[] {
  const fleetSize = results.length;
  const finishers = results
    .filter(result => result.status === 'FINISHED' && Number.isFinite(result.position) && (result.position ?? 0) > 0)
    .slice()
    .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
  const places = new Map<string, number>();
  let previousPosition: number | null = null;
  let previousRank = 0;
  finishers.forEach((result, index) => {
    const position = result.position!;
    const rank = position === previousPosition ? previousRank : index + 1;
    places.set(result.boatId, rank);
    previousPosition = position;
    previousRank = rank;
  });

  const nonFinisher = options.nonFinisherPoints ?? (system === 'high-point' ? 0 : fleetSize + 1);
  const table = options.customPoints ?? {};

  return results.map(result => {
    const rank = places.get(result.boatId);
    let points: number;
    if (rank === undefined) {
      // Did not finish: DNS/DNF/DSQ/OCS/RET… all score the same by default.
      points = nonFinisher;
    } else if (system === 'high-point') {
      points = Math.max(1, fleetSize - rank + 1);
    } else if (system === 'bonus-point') {
      points = rank === 1 ? 0 : rank;
    } else if (system === 'custom') {
      // Table keyed by finishing position first, then by rank, else low-point fallback.
      points = table[result.position ?? rank] ?? table[rank] ?? rank;
    } else {
      points = rank;
    }
    const total = points + (result.adjustment ?? 0);
    return { ...result, points: options.doublePoints ? total * 2 : total };
  });
}

// ---- tie-break -----------------------------------------------------------

export type SailingTiebreakKey =
  | 'net-points' | 'most-first' | 'most-second' | 'most-third'
  | 'most-wins' | 'last-race' | 'fewest-discards' | 'manual';

interface Metrics {
  netPoints: number;
  totalPoints: number;
  discardedPoints: number;
  firstPlaces: number;
  secondPlaces: number;
  thirdPlaces: number;
  lastRacePoints: number | null;
}

/** A single value where LOWER means "ranks higher", for ascending sort. */
function tiebreakValue(key: SailingTiebreakKey, m: Metrics, high: boolean): number {
  switch (key) {
    case 'net-points': return high ? -m.netPoints : m.netPoints;
    case 'most-first':
    case 'most-wins': return -m.firstPlaces;
    case 'most-second': return -m.secondPlaces;
    case 'most-third': return -m.thirdPlaces;
    case 'last-race':
      if (m.lastRacePoints == null) return Number.MAX_SAFE_INTEGER;
      return high ? -m.lastRacePoints : m.lastRacePoints;
    case 'fewest-discards': return m.discardedPoints;
    case 'manual': return 0;
    default: return 0;
  }
}

function compareMetrics(a: Metrics, b: Metrics, order: readonly SailingTiebreakKey[], high: boolean): number {
  for (const key of order) {
    const d = tiebreakValue(key, a, high) - tiebreakValue(key, b, high);
    if (d !== 0) return d;
  }
  return 0;
}

function metricsOf(results: readonly RaceResult[], base: Omit<Metrics, 'firstPlaces' | 'secondPlaces' | 'thirdPlaces' | 'lastRacePoints'>): Metrics {
  const firstPlaces = results.filter(r => r.status === 'FINISHED' && r.position === 1).length;
  const secondPlaces = results.filter(r => r.status === 'FINISHED' && r.position === 2).length;
  const thirdPlaces = results.filter(r => r.status === 'FINISHED' && r.position === 3).length;
  const lastRacePoints = results.length ? results[results.length - 1].points : null;
  return { ...base, firstPlaces, secondPlaces, thirdPlaces, lastRacePoints };
}

const DEFAULT_TIEBREAK: SailingTiebreakKey[] = ['net-points', 'most-first', 'most-second', 'most-third'];

function discardCountFor(rules: RuleSet, sailed: number): number {
  const dp = rules.discardProfile;
  if (!dp || sailed < dp.racesToQualify) return 0;
  let count = 0;
  for (const [raceCount, c] of dp.schedule) if (sailed >= raceCount) count = c;
  return count;
}

// ---- standings -----------------------------------------------------------

interface Row { standing: SeriesStanding; metrics: Metrics; }

/** Core single-fleet series computation (one flight, or the whole open fleet). */
function computeFleetStandings(
  boats: readonly Boat[],
  races: readonly Race[],
  rules: RuleSet,
  flightId: Id | null,
): SeriesStanding[] {
  const system = rules.scoringSystem ?? 'low-point';
  const high = system === 'high-point';
  const tiebreak = (rules.sailingTiebreak?.length ? rules.sailingTiebreak : DEFAULT_TIEBREAK);

  const finished = races.filter(race => race.status === 'finished');
  const qualifyingRaces = finished.filter(race => !race.medalRace);
  const medalRaces = finished.filter(race => race.medalRace);

  // Score every finished race once, from positions, under the current rules.
  const scoredByRace = new Map<Id, Map<Id, RaceResult>>();
  const score = (race: Race, doublePoints: boolean) => {
    const map = new Map<Id, RaceResult>();
    for (const res of scoreRaceResults(race.results, system, {
      customPoints: rules.customPoints,
      nonFinisherPoints: rules.nonFinisherPoints,
      doublePoints,
    })) map.set(res.boatId, res);
    scoredByRace.set(race.id, map);
  };
  const medalDouble = rules.medalRace?.doublePoints ?? false;
  qualifyingRaces.forEach(race => score(race, false));
  medalRaces.forEach(race => score(race, medalDouble));

  const boatIds = new Set(boats.map(b => b.id));
  const resultOf = (raceId: Id, boatId: Id): RaceResult | null => scoredByRace.get(raceId)?.get(boatId) ?? null;

  // Qualifying results per boat (discards apply here).
  const qualByBoat = new Map<Id, RaceResult[]>();
  for (const boat of boats) qualByBoat.set(boat.id, []);
  for (const race of qualifyingRaces)
    for (const boat of boats) {
      const res = resultOf(race.id, boat.id);
      if (res) qualByBoat.get(boat.id)!.push(res);
    }

  // Medal results per boat.
  const medalByBoat = new Map<Id, RaceResult[]>();
  for (const race of medalRaces)
    for (const boat of boats) {
      const res = resultOf(race.id, boat.id);
      if (res) {
        const list = medalByBoat.get(boat.id) ?? [];
        list.push(res);
        medalByBoat.set(boat.id, list);
      }
    }

  // Preliminary qualifying metrics (used to decide who qualifies).
  interface Prelim { metrics: Metrics; }
  const prelims = boats.map(boat => {
    const qual = qualByBoat.get(boat.id)!;
    const discardCount = discardCountFor(rules, qual.length);
    const worstFirst = qual.slice().sort((a, b) => high ? a.points - b.points : b.points - a.points);
    const discardedIds = new Set(worstFirst.slice(0, discardCount).map(r => r.id));
    const discardedPoints = qual.filter(r => discardedIds.has(r.id)).reduce((s, r) => s + r.points, 0);
    const totalPoints = qual.reduce((s, r) => s + r.points, 0);
    const metrics = metricsOf(qual, {
      netPoints: totalPoints - discardedPoints, totalPoints, discardedPoints,
    });
    return { boat, metrics };
  });

  // Medal qualification: top N by qualifying score.
  const medalEnabled = !!rules.medalRace?.enabled && medalRaces.length > 0;
  const qualifiedCount = rules.medalRace?.qualifiedCount ?? 0;
  const countsInSeries = rules.medalRace?.countsInSeries ?? true;
  const qualifiedIds = new Set<Id>();
  if (medalEnabled && qualifiedCount > 0) {
    prelims
      .slice()
      .sort((a, b) => compareMetrics(a.metrics, b.metrics, tiebreak, high))
      .slice(0, qualifiedCount)
      .forEach(p => qualifiedIds.add(p.boat.id));
  }

  const rows: Row[] = prelims.map(({ boat, metrics: qualMetrics }) => {
    const medal = medalByBoat.get(boat.id) ?? [];
    const isQualified = !medalEnabled || qualifiedIds.has(boat.id);
    const medalPoints = medalEnabled && isQualified && countsInSeries
      ? medal.reduce((s, r) => s + r.points, 0) : 0;
    // raceResults aligned to finished races in order (null = boat did not sail it).
    const raceResults = finished.map(race => resultOf(race.id, boat.id));
    const sailed = raceResults.filter((r): r is RaceResult => r !== null);
    const netPoints = qualMetrics.netPoints + medalPoints;
    const totalPoints = qualMetrics.totalPoints + medalPoints;
    const metrics = metricsOf(sailed, {
      netPoints, totalPoints, discardedPoints: qualMetrics.discardedPoints,
    });
    const standing: SeriesStanding = {
      boatId: boat.id,
      flightId,
      raceResults,
      totalPoints,
      netPoints,
      discardedPoints: qualMetrics.discardedPoints,
      rank: 0,
      firstPlaces: metrics.firstPlaces,
      secondPlaces: metrics.secondPlaces,
      thirdPlaces: metrics.thirdPlaces,
      publicationStatus: 'draft',
      version: 1,
      publishedAt: null,
      publishedBy: null,
      corrections: [],
    };
    return { standing, metrics };
  });

  rows.sort((a, b) => compareMetrics(a.metrics, b.metrics, tiebreak, high));
  rows.forEach((row, index) => {
    row.standing.rank = index > 0 && compareMetrics(rows[index - 1].metrics, row.metrics, tiebreak, high) === 0
      ? rows[index - 1].standing.rank
      : index + 1;
  });
  return rows.map(row => row.standing);
}

/**
 * Recomputes standings from positions and the CURRENT rules — so changing the
 * scoring system, discards, tie-breaks or medal race updates the table without
 * touching stored points. When flights are supplied, each flight is scored on
 * its own races and boats outside every flight form an open fleet.
 */
export function computeSailingStandings(
  boats: readonly Boat[],
  races: readonly Race[],
  rules: RuleSet,
  flights?: readonly Flight[],
): SeriesStanding[] {
  if (flights && flights.length > 0) {
    const assigned = new Set(flights.flatMap(f => f.boatIds));
    const out: SeriesStanding[] = [];
    for (const flight of flights) {
      const flightBoats = boats.filter(b => flight.boatIds.includes(b.id));
      if (flightBoats.length === 0) continue;
      const flightRaces = races.filter(r => (r.flightId ?? null) === flight.id);
      out.push(...computeFleetStandings(flightBoats, flightRaces, rules, flight.id));
    }
    const openBoats = boats.filter(b => !assigned.has(b.id));
    if (openBoats.length > 0) {
      const openRaces = races.filter(r => !r.flightId);
      out.push(...computeFleetStandings(openBoats, openRaces, rules, null));
    }
    return out;
  }
  return computeFleetStandings(boats, races, rules, null);
}

/** Scores a team as the sum of its boats' points in each completed race. */
export function computeTeamStandings(
  boats: readonly Boat[],
  races: readonly Race[],
  rules: RuleSet,
): TeamStanding[] {
  const teams = new Map<string, { name: string; boats: Boat[] }>();
  for (const boat of boats) {
    const name = boat.teamName?.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const entry = teams.get(key) ?? { name, boats: [] };
    entry.boats.push(boat);
    teams.set(key, entry);
  }
  const system = rules.scoringSystem ?? 'low-point';
  const high = system === 'high-point';
  const finished = races.filter(race => race.status === 'finished');
  // Re-score from positions so a scoring change is reflected here too.
  const perRacePoints = finished.map(race => {
    const scored = scoreRaceResults(race.results, system, {
      customPoints: rules.customPoints, nonFinisherPoints: rules.nonFinisherPoints,
    });
    const byBoat = new Map(scored.map(r => [r.boatId, r.points]));
    return byBoat;
  });

  const out = [...teams.values()].map(team => {
    const perRace = perRacePoints.map(byBoat =>
      team.boats.reduce((sum, boat) => sum + (byBoat.get(boat.id) ?? 0), 0));
    const discardCount = discardCountFor(rules, perRace.length);
    const worstFirst = perRace.slice().sort((a, b) => high ? a - b : b - a);
    const discardedPoints = worstFirst.slice(0, discardCount).reduce((s, p) => s + p, 0);
    const totalPoints = perRace.reduce((s, p) => s + p, 0);
    return {
      teamName: team.name,
      boatCount: team.boats.length,
      totalPoints,
      discardedPoints,
      netPoints: totalPoints - discardedPoints,
      rank: 0,
    };
  });
  out.sort((a, b) => (high ? b.netPoints - a.netPoints : a.netPoints - b.netPoints));
  out.forEach((team, index) => {
    team.rank = index > 0 && team.netPoints === out[index - 1].netPoints ? out[index - 1].rank : index + 1;
  });
  return out;
}


