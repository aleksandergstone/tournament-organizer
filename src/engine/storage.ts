import { AppSettings, AuditEntry, DEFAULT_SETTINGS, Group, Match, Participant, ProjectFile, Tournament, VenueResource, nowIso, uid } from './types';
import { migrateProject, sanitizeImport } from './validate';
import { recomputeBracket } from './recompute';

export const CURRENT_VERSION = 1 as const;

const FILE_EXT = '.top.json';

export function fileNameFor(t: Pick<Tournament, 'name'>): string {
  const safe = (t.name || 'tournament').toLowerCase().replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60) || 'tournament';
  return `${safe}${FILE_EXT}`;
}

export function serializeProject(p: {
  tournament: Tournament; participants: Participant[]; groups: Group[]; matches: Match[];
  audit: AuditEntry[]; settings: AppSettings; resources?: VenueResource[];
}): string {
  const file: ProjectFile = {
    version: 1, app: 'tournament-organizer',
    tournament: p.tournament, participants: p.participants, groups: p.groups,
    matches: p.matches, audit: p.audit, settings: { ...DEFAULT_SETTINGS, ...p.settings },
    resources: p.resources ?? [],
  };
  return JSON.stringify(file, null, 2);
}

export function parseProject(json: string): { file: ProjectFile; warnings: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(json); }
  catch { throw new Error('File is not valid JSON.'); }
  const { ok, errors } = sanitizeImport(raw);
  if (!ok) throw new Error('Corrupted import: ' + errors.join(' '));
  const migrated = migrateProject(raw as Record<string, unknown>) as unknown as ProjectFile;
  const warnings: string[] = [];
  const origV = (raw as { version: number }).version;
  // v0 files predate bracket provenance: rebuild structure lazily is out of
  // scope, so warn that brackets recompute from results on next edit.
  if (origV === 0) warnings.push('Migrated v0 file: bracket links rebuilt on next result edit.');
  else if (origV !== 1) warnings.push(`Migrated from version ${origV} to 1.`);
  // Defensive: never import dangling references — drop matches pointing at
  // unknown participants (kept count in warning) rather than crashing.
  const ids = new Set(migrated.participants.map(p => p.id));
  const before = migrated.matches.length;
  migrated.matches = migrated.matches.filter(m =>
    (!m.homeId || ids.has(m.homeId)) && (!m.awayId || ids.has(m.awayId)));
  if (migrated.matches.length < before)
    warnings.push(`Dropped ${before - migrated.matches.length} match(es) with unknown participants.`);
  // Re-derive bracket slots from provenance so an old edited file can never
  // reopen with stale downstream pairings.
  try { migrated.matches = recomputeBracket(migrated.matches); }
  catch { /* recompute is best-effort on import */ }
  return { file: migrated, warnings };
}

export function log(audit: AuditEntry[], action: string, detail?: string): AuditEntry[] {
  return [...audit, { id: uid('a'), at: nowIso(), action, detail }];
}

// localStorage persistence (works in browser + Electron renderer; swap for SQLite later via same interface)
const LS_KEY = 'to:projects';
const LS_OPEN = 'to:last-open';

export interface StoredProjectMeta { id: string; name: string; updatedAt: string; format?: string; participantCount?: number; }

// ---- Persistence adapters ----
// StorageAdapter is the release seam: the app talks only to this interface.
// - LocalAdapter (default): localStorage, zero-setup, preserves all existing
//   saved projects byte-for-byte (keys to:projects / to:last-open).
// - FileAdapter: file-backed via injected read/write fns (Electron main
//   process dialogs in prod, in-memory in tests). Same ProjectFile schema,
//   same .top.json bytes — projects move freely between adapters.
// SQLite can later implement this interface without touching UI or engine.
export interface StorageAdapter {
  readonly kind: string;
  saveProject(file: ProjectFile): void | Promise<void>;
  loadAll(): Record<string, ProjectFile> | Promise<Record<string, ProjectFile>>;
  remove(id: string): void | Promise<void>;
}

function isPromise<T>(v: T | Promise<T>): v is Promise<T> {
  return typeof (v as Promise<T>)?.then === 'function';
}

export const store = {
  saveProject(file: ProjectFile): void {
    const all = store.loadAll();
    all[file.tournament.id] = file;
    try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch { /* quota — export file instead */ }
    try { localStorage.setItem(LS_OPEN, file.tournament.id); } catch { /* ignore */ }
  },
  loadAll(): Record<string, ProjectFile> {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw) as Record<string, ProjectFile>;
      return obj && typeof obj === 'object' ? obj : {};
    } catch { return {}; }
  },
  load(id: string): ProjectFile | null {
    return store.loadAll()[id] ?? null;
  },
  remove(id: string): void {
    const all = store.loadAll();
    delete all[id];
    try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  },
  lastOpenId(): string | null {
    try { return localStorage.getItem(LS_OPEN); } catch { return null; }
  },
  list(): StoredProjectMeta[] {
    return Object.values(store.loadAll()).map(f => ({
      id: f.tournament.id, name: f.tournament.name, updatedAt: f.tournament.updatedAt,
      format: f.tournament.format, participantCount: f.participants.length,
    })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
};

export const localAdapter: StorageAdapter = {
  kind: 'localStorage',
  saveProject: (f) => store.saveProject(f),
  loadAll: () => store.loadAll(),
  remove: (id) => store.remove(id),
};

// File-backed adapter: one JSON doc {projects: {...}, lastOpen} per file.
// readFile/writeFile are injected so Electron IPC, Node fs, or tests can back it.
export function createFileAdapter(opts: {
  readFile: () => string | null | Promise<string | null>;
  writeFile: (text: string) => void | Promise<void>;
}): StorageAdapter & { flush(cache: Record<string, ProjectFile>): Promise<void>; reload(): Promise<Record<string, ProjectFile>> } {
  let cache: Record<string, ProjectFile> | null = null;
  const readAll = async (): Promise<Record<string, ProjectFile>> => {
    if (cache) return cache;
    const raw = await opts.readFile();
    if (!raw) { cache = {}; return cache; }
    try {
      const doc = JSON.parse(raw) as { projects?: Record<string, ProjectFile> } | Record<string, ProjectFile>;
      const projects = (doc as { projects?: Record<string, ProjectFile> }).projects ?? (doc as Record<string, ProjectFile>);
      cache = projects && typeof projects === 'object' ? projects : {};
    } catch { cache = {}; }
    return cache;
  };
  return {
    kind: 'file',
    saveProject: async (file) => {
      const all = await readAll();
      all[file.tournament.id] = file;
      await opts.writeFile(JSON.stringify({ app: 'tournament-organizer', version: CURRENT_VERSION, projects: all }, null, 2));
    },
    loadAll: () => readAll(),
    remove: async (id) => {
      const all = await readAll();
      delete all[id];
      await opts.writeFile(JSON.stringify({ app: 'tournament-organizer', version: CURRENT_VERSION, projects: all }, null, 2));
    },
    flush: async (next) => {
      cache = next;
      await opts.writeFile(JSON.stringify({ app: 'tournament-organizer', version: CURRENT_VERSION, projects: next }, null, 2));
    },
    reload: async () => { cache = null; return readAll(); },
  };
}

export function toStoredList(all: Record<string, ProjectFile>): StoredProjectMeta[] {
  return Object.values(all).map(f => ({
    id: f.tournament.id, name: f.tournament.name, updatedAt: f.tournament.updatedAt,
    format: f.tournament.format, participantCount: f.participants.length,
  })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function adapterSnapshot(adapter: StorageAdapter): Record<string, ProjectFile> | Promise<Record<string, ProjectFile>> {
  return adapter.loadAll();
}
void isPromise;

export const disk = store;
export function exportCsvStandings(csv: string, name: string): void {
  downloadText(csv, `${name}.standings.csv`, 'text/csv');
}
export function exportCsvMatches(csv: string, name: string): void {
  downloadText(csv, `${name}.matches.csv`, 'text/csv');
}
export function downloadText(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function standingsCsv(header: string[], rows: string[][]): string {
  const esc = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  return [header, ...rows].map(r => r.map(esc).join(',')).join('\n');
}
