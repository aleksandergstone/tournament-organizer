import { Match, Participant, Tournament } from './types';

// Validation returns human-readable errors; never throws for user data.
export interface ValidationIssue { field: string; message: string; }

export function validateTournament(t: Partial<Tournament>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!t.name?.trim()) issues.push({ field: 'name', message: 'Tournament name is required.' });
  if (!t.sport?.trim()) issues.push({ field: 'sport', message: 'Sport / game is required.' });
  if (!t.format) issues.push({ field: 'format', message: 'Choose a competition format.' });
  if (t.dates?.start && t.dates?.end && t.dates.start > t.dates.end)
    issues.push({ field: 'dates', message: 'End date is before start date.' });
  return issues;
}

export function validateParticipants(ps: Participant[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (ps.length < 2) issues.push({ field: 'participants', message: 'Add at least 2 participants.' });
  const seen = new Map<string, number>();
  for (const p of ps) {
    if (!p.name.trim()) issues.push({ field: 'name', message: 'Every participant needs a name.' });
    const k = p.name.trim().toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const [k, c] of seen) {
    if (c > 1 && k) issues.push({ field: 'duplicate', message: `Duplicate name "${k}" appears ${c}× — allowed, but check seeding.` });
  }
  return issues;
}

export function validateMatch(m: Match): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const r = m.result;
  if (r.status === 'played' || r.status === 'overtime' || r.status === 'draw') {
    if (r.homeScore === null || r.awayScore === null)
      issues.push({ field: 'score', message: 'Enter both scores, or use Walkover / Unfinished.' });
    if ((r.homeScore ?? 0) < 0 || (r.awayScore ?? 0) < 0)
      issues.push({ field: 'score', message: 'Scores cannot be negative.' });
  }
  if (r.status === 'walkover' && !r.walkoverWinnerId && !r.winnerId)
    issues.push({ field: 'walkover', message: 'Choose the walkover winner.' });
  return issues;
}

export function sanitizeImport(data: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null) return { ok: false, errors: ['File is not a project object.'] };
  const d = data as Record<string, unknown>;
  if (d['app'] !== 'tournament-organizer') errors.push('Not a Tournament Organizer file (bad app tag).');
  if (typeof d['version'] !== 'number') errors.push('Missing version — cannot migrate safely.');
  else if (![0, 1].includes(d['version'] as number)) errors.push(`Unsupported version ${d['version']} — this app reads v0–v1.`);
  if (typeof d['tournament'] !== 'object' || d['tournament'] === null) errors.push('Missing tournament block.');
  else {
    const t = d['tournament'] as Record<string, unknown>;
    if (typeof t['name'] !== 'string') errors.push('Tournament name missing/corrupt.');
    if (typeof t['rules'] !== 'object' || t['rules'] === null) errors.push('Rules block missing/corrupt.');
  }
  if (!Array.isArray(d['participants'])) errors.push('Missing participants list.');
  else {
    for (let i = 0; i < (d['participants'] as unknown[]).length; i++) {
      const p = (d['participants'] as Record<string, unknown>[])[i];
      if (typeof p?.id !== 'string' || typeof p?.name !== 'string') { errors.push(`Participant #${i + 1} missing id/name.`); break; }
    }
    const ids = ((d['participants'] as { id: string }[]).map(p => p.id));
    if (new Set(ids).size !== ids.length) errors.push('Duplicate participant ids — file corrupt.');
  }
  if (!Array.isArray(d['matches'])) errors.push('Missing matches list.');
  else {
    for (let i = 0; i < (d['matches'] as unknown[]).length; i++) {
      const m = (d['matches'] as Record<string, unknown>[])[i];
      const r = m?.result as Record<string, unknown> | undefined;
      if (typeof m?.id !== 'string' || typeof r?.status !== 'string') { errors.push(`Match #${i + 1} missing id/result.`); break; }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function migrateProject(data: Record<string, unknown>): Record<string, unknown> {
  const v = data['version'] as number;
  if (v === 1) {
    // fill optional new fields with safe defaults (forward-compat)
    const ms = ((data['matches'] as Record<string, unknown>[]) ?? []).map(m => ({
      bracket: null, groupId: null, scheduledAt: null, venue: null, ...m,
    }));
    const t = data['tournament'] as Record<string, unknown>;
    return { audit: [], groups: [], settings: { autosave: true, confirmDestructive: true, theme: 'light' }, ...data, tournament: t, matches: ms };
  }
  // v0 (pre-release): bare { tournament, participants, matches } — upgrade.
  const d = data;
  return {
    version: 1, app: 'tournament-organizer',
    tournament: { id: 't_imported', visibility: 'private', archived: false, dates: {}, ...(d['tournament'] as object ?? {}) },
    participants: d['participants'] ?? [],
    groups: d['groups'] ?? [], matches: d['matches'] ?? [],
    audit: d['audit'] ?? [], settings: d['settings'] ?? { autosave: true, confirmDestructive: true, theme: 'light' },
  };
}
