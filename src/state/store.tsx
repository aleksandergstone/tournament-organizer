import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppSettings, AuditEntry, DEFAULT_SETTINGS, nowIso, uid } from '../engine/types';
import { Domain } from '../engine/model';
import { disk, log } from '../engine/storage';
import { initHistory, commit, undo, redo, canUndo, canRedo, Snapshot } from '../engine/history';
import { computeStandings } from '../engine/standings';
import { StandingRow } from '../engine/types';
import { parseProject } from '../engine/storage';
import { ProjectFile } from '../engine/types';
export type Screen = 'home'|'wizard'|'overview'|'participants'|'rules'|'bracket'|'matches'|'standings'|'export'|'settings'|'import';
interface Ctx { domain: Domain; settings: AppSettings; screen: Screen; go(s: Screen): void;
update(fn: (d: Domain) => Domain, msg?: string): void; setSettings(s: AppSettings): void;
undo_(): void; redo_(): void; canUndo: boolean; canRedo: boolean; standings: StandingRow[];
save(): void; dirty: boolean; lastSaved: string|null; saveError: string|null; newProject(t: Domain['tournament']): void;
openProject(id: string): boolean; closeProject(): void; deleteProject(id: string): void;
importJson(j: string): string[]; importFile(text: string, path: string): string[]; hasProject: boolean; }
const C = createContext<Ctx|null>(null);
export function Provider({ children }: { children: React.ReactNode }) {
  const [hist, setHist] = useState<Snapshot<Domain>>(() => initHistory({ tournament: freshT(), participants: [], groups: [], matches: [], audit: [] }));
  const [settings, setS] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [screen, setScreen] = useState<Screen>('home');
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLast] = useState<string|null>(null);
  const [saveError, setSaveError] = useState<string|null>(null);
  const [hasProject, setHas] = useState(false);
  const [listTick, setListTick] = useState(0); // bumps to refresh recent-projects lists
  const hr = useRef(hist); hr.current = hist;
  const sr = useRef(settings); sr.current = settings;
  // Theme preference takes effect immediately (data-theme on <html>).
  useEffect(() => { document.documentElement.dataset.theme = settings.theme; }, [settings.theme]);
  const persist = useCallback((d: Domain, s: AppSettings) => {
    if (!d.tournament.name) return;
    try {
      const f: ProjectFile = { version: 1, app: 'tournament-organizer', tournament: { ...d.tournament, updatedAt: nowIso() }, participants: d.participants, groups: d.groups, matches: d.matches, audit: d.audit, settings: s };
      disk.saveProject(f); setLast(nowIso()); setDirty(false); setSaveError(null);
    } catch (e) {
      // Never lose the in-memory project silently: keep it dirty, tell the user.
      setSaveError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    if (!settings.autosave || !hasProject || !dirty) return;
    const t = window.setTimeout(() => persist(hr.current.present, sr.current), 800);
    return () => window.clearTimeout(t);
  }, [dirty, hasProject, hist.present, settings.autosave, persist]);
  const update = useCallback((fn: (d: Domain) => Domain, msg?: string) => {
    setHist(h => { const n = structuredClone(fn(structuredClone(h.present))); n.tournament.updatedAt = nowIso(); if (msg) n.audit = log(n.audit, msg); return commit(h, n); });
    setDirty(true); setHas(true);
  }, []);
  const ctx: Ctx = useMemo(() => ({
    domain: hist.present, settings, screen, go: setScreen, update,
    setSettings: (s) => { setS(s); setDirty(true); },
    undo_: () => { setHist(h => undo(h)); setDirty(true); },
    redo_: () => { setHist(h => redo(h)); setDirty(true); },
    canUndo: canUndo(hist), canRedo: canRedo(hist),
    standings: computeStandings(hist.present.participants, hist.present.matches, hist.present.tournament.rules),
    save: () => persist(hist.present, settings), dirty, lastSaved, saveError,
    newProject: (t) => { setHist(initHistory({ tournament: t, participants: [], groups: [], matches: [], audit: log([], 'project.created', t.name) })); setDirty(true); setHas(true); setScreen('participants'); },
    openProject: (id) => { const f = disk.load(id); if (!f) return false;
      setHist(initHistory({ tournament: f.tournament, participants: f.participants, groups: f.groups, matches: f.matches, audit: f.audit }));
      setS({ ...DEFAULT_SETTINGS, ...f.settings }); setDirty(false); setHas(true); setLast(f.tournament.updatedAt); setScreen('overview'); return true; },
    closeProject: () => { setHist(initHistory({ tournament: freshT(), participants: [], groups: [], matches: [], audit: [] })); setDirty(false); setHas(false); setScreen('home'); },
    deleteProject: (id) => { try { disk.remove(id); } catch { /* deletion is best-effort; refresh shows reality */ } finally { setListTick(t => t + 1); } },
    importJson: (j) => { const { file, warnings } = parseProject(j);
      setHist(initHistory({ tournament: file.tournament, participants: file.participants, groups: file.groups, matches: file.matches, audit: file.audit }));
      setS({ ...DEFAULT_SETTINGS, ...file.settings }); setDirty(true); setHas(true); setScreen('overview'); return warnings; },
    importFile: (text, path) => { const { file, warnings } = parseProject(text);
      const all = [...warnings];
      if (file.tournament.name === '' || file.tournament.name === '(untitled)') all.push(`Opened ${path} — project has no name yet.`);
      else all.push(`Opened ${path}.`);
      setHist(initHistory({ tournament: file.tournament, participants: file.participants, groups: file.groups, matches: file.matches, audit: [...file.audit, { id: uid('a'), at: nowIso(), action: 'project.opened-file', detail: path }] }));
      setS({ ...DEFAULT_SETTINGS, ...file.settings }); setDirty(true); setHas(true); setScreen('overview'); return all; },
    hasProject,
  }), [hist, settings, screen, update, persist, dirty, lastSaved, saveError, hasProject, listTick]);
  return <C.Provider value={ctx}>{children}</C.Provider>;
}
function freshT(): Domain['tournament'] {
  return { id: uid('t'), name: '', sport: 'Football', individualOrTeam: 'team', format: 'single-elimination', participantCountExpected: null, dates: { start: null, end: null }, location: '', visibility: 'private',
  rules: { winPoints: 3, drawPoints: 1, lossPoints: 0, allowDraws: true, tiebreakOrder: ['points','wins','diff','scored','seed','name'], walkoverWinnerPoints: 3, overtimeAllowed: false, seeding: 'seeded', groupCount: 2, advancePerGroup: 2, homeAway: false, swissRounds: 5, byePoints: 3 },
  createdAt: nowIso(), updatedAt: nowIso(), archived: false };
}
export function useApp(): Ctx { const v = useContext(C); if (!v) throw new Error('no provider'); return v; }
export function pnameOf(m: Map<string,string>, id: string|null): string { if (!id) return 'TBD'; return m.get(id) ?? 'Unknown'; }
