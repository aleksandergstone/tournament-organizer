// Domain model — pure types, no UI, no I/O. Serializable to local .top.json file.
import type { Branding } from './branding';
import type { LocalePreference } from '../i18n';
export type Id = string;

export type CompetitionFormat =
  | 'single-elimination'
  | 'double-elimination'
  | 'round-robin'
  | 'swiss'
  | 'groups-knockout'
  | 'league'
  | 'team-match'
  | 'individual-match'
  | 'custom';

export type ParticipantKind = 'player' | 'team' | 'club';

export interface Participant {
  id: Id;
  name: string;
  kind: ParticipantKind;
  tags: string[];
  seed?: number;
  rating?: number;
  groupId?: string | null;
  active: boolean;      // false = withdrawn / missing
  withdrawnRound?: number | null;
  avatar?: string | null; // dataURL or initials fallback
  modifiedAt?: string | null; // last edit — used by LAN sync merge
}

// A venue resource a match can be played on: court, table, station, board…
export type ResourceKind = 'court' | 'table' | 'station' | 'board' | 'lane' | 'other';

export interface VenueResource {
  id: Id;
  name: string;
  kind: ResourceKind;
  note?: string | null;
}

export interface RuleSet {
  rounds?: number;            // swiss rounds, or null = auto
  matchLengthMin?: number | null;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  allowDraws: boolean;
  tiebreakOrder: TiebreakKey[];
  walkoverWinnerPoints: number; // default = winPoints
  overtimeAllowed: boolean;
  seeding: 'seeded' | 'random' | 'manual';
  groupCount?: number;        // for groups-knockout
  advancePerGroup?: number;   // top N advance
  homeAway?: boolean;         // league double round-robin
  swissRounds?: number;
  byePoints?: number;         // points for bye (odd numbers)
}

export type TiebreakKey = 'points' | 'wins' | 'diff' | 'scored' | 'buchholz' | 'seed' | 'name';

export const DEFAULT_RULES: RuleSet = {
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  allowDraws: true,
  tiebreakOrder: ['points', 'wins', 'diff', 'scored', 'seed', 'name'],
  walkoverWinnerPoints: 3,
  overtimeAllowed: false,
  seeding: 'seeded',
  groupCount: 2,
  advancePerGroup: 2,
  homeAway: false,
  swissRounds: 5,
  byePoints: 3,
};

export type MatchStatus =
  | 'scheduled'
  | 'played'
  | 'walkover'
  | 'draw'
  | 'overtime'
  | 'interrupted'
  | 'unfinished'
  | 'bye';

export interface MatchResult {
  homeScore: number | null;
  awayScore: number | null;
  winnerId: Id | null; // participant id or null for draw/unplayed
  status: MatchStatus;
  walkoverWinnerId?: Id | null;
  note?: string;
  overtime?: boolean;
}

export interface Match {
  id: Id;
  round: number;          // 1-based
  roundName: string;      // e.g. "Round 1", "QF", "SF", "Final", "Group A R1"
  groupId?: string | null;
  homeId: Id | null;      // null = TBD / bye
  awayId: Id | null;
  result: MatchResult;
  scheduledAt?: string | null;
  venue?: string | null;
  resourceId?: Id | null;  // venue resource (court/table/station) — scheduling
  durationMin?: number | null; // estimated length in minutes
  modifiedAt?: string | null;  // last edit — used by LAN sync merge
  bracket?: BracketMeta | null;
}

// Provenance of a bracket slot. Deterministic recomputation re-derives every
// non-manual slot from these links + decided results, so result edits can
// never leave stale downstream pairings behind.
export type BracketKind = 'winners' | 'losers' | 'final' | 'group' | 'league' | 'swiss' | 'open';

export interface SlotSource {
  w?: string;       // winner of match id
  l?: string;       // loser of match id
  seed?: Id | null; // fixed participant placed at generation
}

export interface BracketMeta {
  kind: BracketKind;
  srcHome?: SlotSource | null;
  srcAway?: SlotSource | null;
  manual?: boolean; // true = placed at generation (round 1 / RR); false = derived, owned by recompute
  eliminatedOnLoss?: boolean;
}

export interface Group {
  id: Id;
  name: string;
  participantIds: Id[];
}

export interface Tournament {
  id: Id;
  name: string;
  sport: string;
  individualOrTeam: 'individual' | 'team';
  format: CompetitionFormat;
  participantCountExpected?: number | null;
  dates: { start?: string | null; end?: string | null };
  location?: string | null;
  visibility: 'private' | 'local-shared';
  rules: RuleSet;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  notes?: string;
  /** Document branding for exported sheets/PDFs. Optional: added after v1.0. */
  branding?: Branding;
}

export interface StandingRow {
  participantId: Id;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
  diff: number;
  points: number;
  buchholz: number;
  rank: number;
}

export interface AuditEntry {
  id: Id;
  at: string;
  action: string;
  detail?: string;
}

export interface ProjectFile {
  version: 1;
  app: 'tournament-organizer';
  tournament: Tournament;
  participants: Participant[];
  groups: Group[];
  matches: Match[];
  audit: AuditEntry[];
  settings: AppSettings;
  resources?: VenueResource[]; // optional since v1.0 (venue scheduling)
}

export interface AppSettings {
  autosave: boolean;
  confirmDestructive: boolean;
  theme: 'light' | 'dark';
  /** Absent or "system" = follow the computer's language. Added after v1.2. */
  locale?: LocalePreference;
  lastOpenedAt?: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autosave: true,
  confirmDestructive: true,
  theme: 'light',
};

export function uid(prefix = 'id'): Id {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}
export function nowIso(): string {
  return new Date().toISOString();
}
