import { Match, Participant, Tournament } from './types';
import { t } from '../i18n';

// Validation returns human-readable errors; never throws for user data.
export interface ValidationIssue { field: string; message: string; }

export function validateTournament(tour: Partial<Tournament>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!tour.name?.trim()) issues.push({ field: 'name', message: t('engine.nameRequired') });
  if (!tour.sport?.trim()) issues.push({ field: 'sport', message: t('engine.sportRequired') });
  if (!tour.format) issues.push({ field: 'format', message: t('engine.formatRequired') });
  if (tour.dates?.start && tour.dates?.end && tour.dates.start > tour.dates.end)
    issues.push({ field: 'dates', message: t('engine.badDates') });
  return issues;
}

export function validateParticipants(ps: Participant[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (ps.length < 2) issues.push({ field: 'participants', message: t('engine.needTwoParticipants') });
  const seen = new Map<string, number>();
  for (const p of ps) {
    if (!p.name.trim()) issues.push({ field: 'name', message: t('engine.participantName') });
    const k = p.name.trim().toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const [k, c] of seen) {
    if (c > 1 && k) issues.push({ field: 'duplicate', message: t('engine.duplicateName', { name: k, n: c }) });
  }
  return issues;
}

export function validateMatch(m: Match): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const r = m.result;
  if (r.status === 'played' || r.status === 'overtime' || r.status === 'draw') {
    if (r.homeScore === null || r.awayScore === null)
      issues.push({ field: 'score', message: t('engine.scorePair') });
    if ((r.homeScore ?? 0) < 0 || (r.awayScore ?? 0) < 0)
      issues.push({ field: 'score', message: t('engine.negativeScores') });
  }
  if (r.status === 'walkover' && !r.walkoverWinnerId && !r.winnerId)
    issues.push({ field: 'walkover', message: t('engine.walkoverWinner') });
  return issues;
}

export function sanitizeImport(data: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null) return { ok: false, errors: [t('engine.notProject')] };
  const d = data as Record<string, unknown>;
  if (d['app'] !== 'tournament-organizer') errors.push(t('engine.tooFew'));
  if (typeof d['version'] !== 'number') errors.push(t('engine.noVersion'));
  else if (![0, 1].includes(d['version'] as number)) errors.push(t('engine.unsupportedVersion', { v: String(d['version']) }));
  if (typeof d['tournament'] !== 'object' || d['tournament'] === null) errors.push(t('engine.noTournament'));
  else {
    const tourn = d['tournament'] as Record<string, unknown>;
    if (typeof tourn['name'] !== 'string') errors.push(t('engine.noName'));
    if (typeof tourn['rules'] !== 'object' || tourn['rules'] === null) errors.push(t('engine.noRules'));
  }
  if (!Array.isArray(d['participants'])) errors.push(t('engine.noParticipants'));
  else {
    for (let i = 0; i < (d['participants'] as unknown[]).length; i++) {
      const p = (d['participants'] as Record<string, unknown>[])[i];
      if (typeof p?.id !== 'string' || typeof p?.name !== 'string') { errors.push(t('engine.badParticipant', { n: i + 1 })); break; }
    }
    const ids = ((d['participants'] as { id: string }[]).map(p => p.id));
    if (new Set(ids).size !== ids.length) errors.push(t('engine.duplicateIds'));
  }
  if (!Array.isArray(d['matches'])) errors.push(t('engine.noMatches'));
  else {
    for (let i = 0; i < (d['matches'] as unknown[]).length; i++) {
      const m = (d['matches'] as Record<string, unknown>[])[i];
      const r = m?.result as Record<string, unknown> | undefined;
      if (typeof m?.id !== 'string' || typeof r?.status !== 'string') { errors.push(t('engine.badMatch', { n: i + 1 })); break; }
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
    const tourn = data['tournament'] as Record<string, unknown>;
    return { audit: [], groups: [], resources: [], settings: { autosave: true, confirmDestructive: true, theme: 'light' }, ...data, tournament: tourn, matches: ms };
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
