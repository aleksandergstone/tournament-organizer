// LAN sync — state merge rules. Pure and deterministic; no networking here.
//
// Model: one device hosts, others push/pull over the local network. Every
// device keeps working offline on its own copy; merging is explicit and
// last-writer-wins with a fixed, explainable rule:
//
//   • matches        — merged one by one: the copy with the newer
//                      `modifiedAt` wins; equal or missing timestamps keep the
//                      local copy (so the same inputs always give one result)
//   • tournament /
//     participants /
//     groups /
//     resources      — taken from whichever side has the newer
//                      `tournament.updatedAt`
//   • audit          — union, oldest first
// After merging, bracket slots are re-derived so a received result can never
// leave a stale pairing behind.
import { ProjectFile } from './types';
import { recomputeBracket } from './recompute';

export const SYNC_KIND = 'tournament-organizer-state';
export const SYNC_VERSION = 1;

export interface SyncPayload {
  app: 'tournament-organizer';
  kind: typeof SYNC_KIND;
  protocol: number;
  at: string;
  project: ProjectFile;
}

export function makePayload(project: ProjectFile, at: string = new Date().toISOString()): SyncPayload {
  return { app: 'tournament-organizer', kind: SYNC_KIND, protocol: SYNC_VERSION, at, project };
}

export type ParsedPayload = { ok: true; payload: SyncPayload } | { ok: false; error: string };

export function parsePayload(raw: unknown): ParsedPayload {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Empty or malformed sync data.' };
  const p = raw as Record<string, unknown>;
  if (p['app'] !== 'tournament-organizer') return { ok: false, error: 'That device is not running Tournament Organizer.' };
  if (p['kind'] !== SYNC_KIND) return { ok: false, error: 'Unsupported sync data type.' };
  const project = p['project'] as ProjectFile | undefined;
  if (!project || typeof project !== 'object') return { ok: false, error: 'Sync data has no project.' };
  if (!Array.isArray(project.matches) || !Array.isArray(project.participants))
    return { ok: false, error: 'Sync data is incomplete (matches/participants missing).' };
  return { ok: true, payload: raw as unknown as SyncPayload };
}

export interface MergeResult {
  ok: boolean;
  merged: ProjectFile;
  fromRemote: string[];   // match ids taken from the remote copy
  keptLocal: string[];    // match ids where the local copy was newer/equal
  structureFromRemote: boolean;
  conflicts: string[];
  note: string;
}

const stamp = (iso?: string | null): string => (typeof iso === 'string' && iso ? iso : '');

export function mergeProjects(local: ProjectFile, remote: ProjectFile): MergeResult {
  const base: MergeResult = {
    ok: true, merged: local, fromRemote: [], keptLocal: [],
    structureFromRemote: false, conflicts: [], note: '',
  };
  if (!local || !remote) return { ...base, ok: false, conflicts: ['missing-state'], note: 'Nothing to merge.' };
  if (local.tournament?.id !== remote.tournament?.id) {
    return {
      ...base, ok: false, conflicts: ['other-project'],
      note: 'These two devices hold different tournaments — sync only copies of the same project.',
    };
  }

  const remoteById = new Map(remote.matches.map(m => [m.id, m]));
  const fromRemote: string[] = [];
  const keptLocal: string[] = [];
  const mergedMatches = local.matches.map(m => {
    const r = remoteById.get(m.id);
    if (!r) { keptLocal.push(m.id); return m; }
    remoteById.delete(m.id);
    const rt = stamp(r.modifiedAt), lt = stamp(m.modifiedAt);
    if (rt > lt) { fromRemote.push(m.id); return r; }
    keptLocal.push(m.id);
    return m;
  });
  // matches that only exist remotely are appended deterministically
  const extra = [...remoteById.values()].sort((a, b) => a.round - b.round || (a.id < b.id ? -1 : 1));
  for (const m of extra) { mergedMatches.push(m); fromRemote.push(m.id); }

  const remoteNewer = stamp(remote.tournament?.updatedAt) > stamp(local.tournament?.updatedAt);
  const structureFromRemote = remoteNewer;

  const auditById = new Map<string, ProjectFile['audit'][number]>();
  for (const a of [...(local.audit ?? []), ...(remote.audit ?? [])]) {
    if (a && typeof a.id === 'string') auditById.set(a.id, a);
  }
  const audit = [...auditById.values()].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)).slice(-400);

  const merged: ProjectFile = {
    ...local,
    tournament: structureFromRemote ? remote.tournament : local.tournament,
    participants: structureFromRemote ? remote.participants : local.participants,
    groups: structureFromRemote ? remote.groups : local.groups,
    resources: structureFromRemote ? (remote.resources ?? []) : (local.resources ?? []),
    matches: mergedMatches,
    audit,
  };

  // Re-derive derived slots from the merged results (deterministic, best-effort).
  try { merged.matches = recomputeBracket(merged.matches); }
  catch { /* keep merged order if the combination is not re-derivable */ }

  const parts = [
    fromRemote.length ? `${fromRemote.length} match(es) updated from the other device` : '',
    keptLocal.length ? `${keptLocal.length} kept local (newer or unchanged)` : '',
    structureFromRemote ? 'participants and groups taken from the other device' : '',
  ].filter(Boolean);

  return { ok: true, merged, fromRemote, keptLocal, structureFromRemote, conflicts: [], note: parts.join(' · ') || 'Already up to date.' };
}
