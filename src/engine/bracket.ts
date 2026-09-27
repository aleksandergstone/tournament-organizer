import { Id } from './types';

// A bracket slot's provenance. Deterministic recomputation re-derives every
// derived slot (homeId/awayId) from these links + decided results, so edits
// can never leave stale downstream pairings.
export type BracketKind = 'winners' | 'losers' | 'final' | 'group' | 'league' | 'swiss' | 'open';

export interface SlotSource {
  // winner of match | loser of match | fixed seed slot (participant) | null (true TBD)
  w?: string;
  l?: string;
  seed?: Id | null;
}

export interface BracketMeta {
  kind: BracketKind;
  srcHome?: SlotSource | null;
  srcAway?: SlotSource | null;
  // true when the pairing was hand-placed at generation (round 1 / RR schedule);
  // false for derived slots which recompute owns.
  manual?: boolean;
  eliminatedOnLoss?: boolean;
}
