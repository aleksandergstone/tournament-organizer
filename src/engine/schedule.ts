// Venue scheduling — assign matches to courts/tables/stations and time slots.
// Pure and deterministic: the same input always produces the same plan.
import { Match, VenueResource } from './types';

export const DEFAULT_DURATION_MIN = 30;

export interface ScheduleEntry {
  matchId: string;
  resourceId: string | null;
  resourceName: string;
  start: string | null;
  end: string | null;
  durationMin: number;
}

export interface ScheduleConflict {
  kind: 'overlap' | 'unknown-resource';
  resourceId: string;
  resourceName: string;
  matchIds: string[];
  start: string;
  end: string;
  message: string;
}

export interface SlotSuggestion {
  matchId: string;
  resourceId: string;
  resourceName: string;
  start: string;
  end: string;
  durationMin: number;
}

export function durationOf(m: Match, fallback = DEFAULT_DURATION_MIN): number {
  const d = m.durationMin;
  return typeof d === 'number' && d > 0 ? Math.round(d) : fallback;
}

export function endOf(start: string, durationMin: number): string {
  return new Date(new Date(start).getTime() + durationMin * 60_000).toISOString();
}

/** Matches that are scheduled (have a time) — regardless of status. */
export function scheduledMatches(matches: Match[]): Match[] {
  return matches.filter(m => !!m.scheduledAt && !!m.homeId && !!m.awayId);
}

export function toEntries(matches: Match[], resources: VenueResource[]): ScheduleEntry[] {
  const byId = new Map(resources.map(r => [r.id, r]));
  return scheduledMatches(matches)
    .map(m => ({
      matchId: m.id,
      resourceId: m.resourceId ?? null,
      resourceName: m.resourceId ? byId.get(m.resourceId)?.name ?? '' : (m.venue ?? ''),
      start: m.scheduledAt ?? null,
      end: m.scheduledAt ? endOf(m.scheduledAt, durationOf(m)) : null,
      durationMin: durationOf(m),
    }))
    .sort((a, b) => (a.start! < b.start! ? -1 : a.start! > b.start! ? 1 : a.matchId < b.matchId ? -1 : 1));
}


/** Double-booking and unknown-resource detection. Never throws. */
export function detectConflicts(matches: Match[], resources: VenueResource[]): ScheduleConflict[] {
  const byId = new Map(resources.map(r => [r.id, r]));
  const conflicts: ScheduleConflict[] = [];

  for (const e of toEntries(matches, resources)) {
    if (e.resourceId && !byId.has(e.resourceId)) {
      conflicts.push({
        kind: 'unknown-resource',
        resourceId: e.resourceId,
        resourceName: e.resourceName || '(removed resource)',
        matchIds: [e.matchId],
        start: e.start!, end: e.end!,
        message: `Match is assigned to "${e.resourceName || 'a removed resource'}" which no longer exists.`,
      });
    }
  }

  const grouped = new Map<string, ScheduleEntry[]>();
  for (const e of toEntries(matches, resources)) {
    if (!e.resourceId) continue;                 // unassigned: not a conflict
    const list = grouped.get(e.resourceId) ?? [];
    list.push(e);
    grouped.set(e.resourceId, list);
  }

  for (const [resourceId, list] of grouped) {
    const sorted = list.sort((a, b) => (a.start! < b.start! ? -1 : a.start! > b.start! ? 1 : 0));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1], cur = sorted[i];
      if (cur.start! < prev.end!) {
        conflicts.push({
          kind: 'overlap',
          resourceId,
          resourceName: prev.resourceName,
          matchIds: [prev.matchId, cur.matchId],
          start: cur.start!,
          end: prev.end!,
          message: `"${prev.resourceName}": two matches overlap (${fmtTime(cur.start!)}–${fmtTime(prev.end!)}).`,
        });
      }
    }
  }
  return conflicts.sort((a, b) => (a.start < b.start ? -1 : a.message < b.message ? -1 : 1));
}

/**
 * Deterministic greedy planner: walks the not-yet-scheduled matches in schedule
 * order and puts each on the earliest free slot of its own resource (or of the
 * first free resource when it has none). Never double-books anything.
 */
export function suggestSlots(
  matches: Match[],
  resources: VenueResource[],
  opts: { dayStart: string; slotMin?: number; defaultDurationMin?: number; matchIds?: string[] },
): SlotSuggestion[] {
  const slotMin = Math.max(5, opts.slotMin ?? 15);
  const fallback = opts.defaultDurationMin ?? DEFAULT_DURATION_MIN;
  const wanted = opts.matchIds ? new Set(opts.matchIds) : null;
  const base = new Date(opts.dayStart);
  if (Number.isNaN(base.getTime())) return [];

  const queue = matches
    .filter(m => m.homeId && m.awayId && !m.scheduledAt && (!wanted || wanted.has(m.id)))
    .sort((a, b) => a.round - b.round || (a.id < b.id ? -1 : 1));

  // Occupied intervals per resource, from already-scheduled matches.
  const busy = new Map<string, { from: number; to: number }[]>();
  for (const m of scheduledMatches(matches)) {
    if (!m.resourceId) continue;
    const list = busy.get(m.resourceId) ?? [];
    list.push({
      from: new Date(m.scheduledAt!).getTime(),
      to: new Date(endOf(m.scheduledAt!, durationOf(m, fallback))).getTime(),
    });
    busy.set(m.resourceId, list);
  }

  const out: SlotSuggestion[] = [];
  const limit = base.getTime() + 14 * 24 * 60 * 60_000; // plan at most two weeks ahead
  for (const m of queue) {
    const dur = durationOf(m, fallback);
    const preferred = m.resourceId && resources.some(r => r.id === m.resourceId)
      ? [m.resourceId]
      : resources.map(r => r.id);
    let placed: SlotSuggestion | null = null;
    for (const resourceId of preferred) {
      const taken = busy.get(resourceId) ?? [];
      for (let t = base.getTime(); t < limit; t += slotMin * 60_000) {
        const from = t, to = t + dur * 60_000;
        if (taken.some(b => from < b.to && to > b.from)) continue;
        const resource = resources.find(r => r.id === resourceId)!;
        placed = {
          matchId: m.id,
          resourceId,
          resourceName: resource.name,
          start: new Date(from).toISOString(),
          end: new Date(to).toISOString(),
          durationMin: dur,
        };
        taken.push({ from, to });
        busy.set(resourceId, taken);
        break;
      }
      if (placed) break;
    }
    if (placed) out.push(placed);
  }
  return out;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
