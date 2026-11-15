// The history panel used to print the raw audit action, so a Polish or German
// organizer read `participant.add Anna` and `result.score-draft` in the middle of
// their own language. The action stays the machine key stored in the project
// file; this module is the one place that turns it into a sentence.
import { t, type Dict } from '../i18n';

/**
 * Every action the app writes, and the sentence that stands for it. A key that
 * is not here is still rendered — the raw action — so an old project file or a
 * new action can never leave a blank row.
 */
const ACTIONS: Record<string, keyof Dict> = {
  'project.created': 'audit.projectCreated',
  'project.opened-file': 'audit.projectOpened',
  'participant.add': 'audit.participantAdd',
  'participant.bulk': 'audit.participantBulk',
  'participant.edit': 'audit.participantEdit',
  'participant.remove': 'audit.participantRemove',
  'rules.edit': 'audit.rulesEdit',
  'format.change': 'audit.formatChange',
  'structure.generate': 'audit.structureGenerate',
  'result.edit': 'audit.resultEdit',
  'result.score-draft': 'audit.resultDraft',
  'knockout.seeded': 'audit.knockoutSeeded',
  'tournament.finished': 'audit.finished',
  'lan.sync': 'audit.sync',
  'branding.updated': 'audit.branding',
};

export interface AuditLine {
  /** A sentence in the active language. */
  label: string;
  /** The argument, when the action had one — a name, a count, a pairing. */
  detail: string;
}

/**
 * `participant.add Anna` → { label: "Participant added", detail: "Anna" }.
 * The action is split at the first space: the token is the machine key, the rest
 * is data, never prose.
 */
export function describeAudit(action: string, detail?: string): AuditLine {
  const space = action.indexOf(' ');
  const token = space > 0 ? action.slice(0, space) : action;
  const arg = space > 0 ? action.slice(space + 1).trim() : '';
  const key = ACTIONS[token];
  if (!key) return { label: action || detail || '', detail: detail ?? '' };
  // A leading number in the argument is a count, not a name.
  const looksLikeCount = /^\d+$/.test(arg);
  const named: Record<string, string> = looksLikeCount ? { n: arg } : { arg: arg || detail || '' };
  return {
    label: t(key, named),
    detail: looksLikeCount || !arg ? (detail ?? '') : arg,
  };
}

/** The action keys this module can explain — checked by the tests. */
export const KNOWN_AUDIT_ACTIONS: readonly string[] = Object.keys(ACTIONS);
