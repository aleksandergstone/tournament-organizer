// Display Mode model — what a projector / hall screen should show right now.
// Pure: takes the current state, returns exactly what to render. No I/O, no timers.
import { Match, StandingRow } from './types';

export type DisplayStatus = 'live' | 'waiting' | 'complete';

export interface DisplayMatch {
  id: string;
  roundName: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: Match['result']['status'];
  resource: string | null;
  startsAt: string | null;
}

export interface DisplayModel {
  tournamentName: string;
  status: DisplayStatus;
  statusLabel: string;
  current: DisplayMatch | null;
  next: DisplayMatch | null;
  top: StandingRow[];
  openCount: number;
  playedCount: number;
  totalCount: number;
  updatedAt: string;
}

const OPEN: ReadonlySet<Match['result']['status']> = new Set(['scheduled', 'unfinished', 'interrupted']);
const PLAYED: ReadonlySet<Match['result']['status']> = new Set(['played', 'draw', 'walkover', 'overtime']);

/** Open matches with both sides known, in "what happens next" order. */
export function upcomingOrder(matches: Match[]): Match[] {
  return matches
    .filter(m => OPEN.has(m.result.status) && m.homeId && m.awayId)
    .sort((a, b) => {
      const at = a.scheduledAt ?? '';
      const bt = b.scheduledAt ?? '';
      if (at && bt && at !== bt) return at < bt ? -1 : 1;
      if (at !== bt) return at ? -1 : 1;          // scheduled first, unscheduled after
      if (a.round !== b.round) return a.round - b.round;
      return a.id < b.id ? -1 : 1;
    });
}

function toCard(m: Match, names: Map<string, string>): DisplayMatch {
  return {
    id: m.id,
    roundName: m.roundName,
    home: m.homeId ? names.get(m.homeId) ?? 'Unknown' : 'TBD',
    away: m.awayId ? names.get(m.awayId) ?? 'Unknown' : 'TBD',
    homeScore: m.result.homeScore,
    awayScore: m.result.awayScore,
    status: m.result.status,
    resource: m.venue ?? null,
    startsAt: m.scheduledAt ?? null,
  };
}

export function buildDisplay(input: {
  tournamentName: string;
  matches: Match[];
  names: Map<string, string>;
  standings: StandingRow[];
  updatedAt: string;
  topN?: number;
}): DisplayModel {
  const { matches, names, standings, updatedAt } = input;
  const order = upcomingOrder(matches);
  const playedCount = matches.filter(m => PLAYED.has(m.result.status)).length;
  const totalCount = matches.filter(m => m.homeId && m.awayId).length;

  let status: DisplayStatus;
  let statusLabel: string;
  if (order.length > 0) {
    status = 'live';
    statusLabel = order[0].result.status === 'scheduled' ? 'Up next' : 'In progress';
  } else if (totalCount > 0 && playedCount >= totalCount) {
    status = 'complete';
    statusLabel = 'All matches played';
  } else {
    status = 'waiting';
    statusLabel = 'Waiting for results';
  }

  return {
    tournamentName: input.tournamentName || 'Tournament',
    status,
    statusLabel,
    current: order[0] ? toCard(order[0], names) : null,
    next: order[1] ? toCard(order[1], names) : null,
    top: standings.slice(0, input.topN ?? 5),
    openCount: order.length,
    playedCount,
    totalCount,
    updatedAt,
  };
}
