// Offline QR deep links.
//
// A QR code carries a plain local identifier, never a URL to a server:
//   to://<projectId>/checkin/<participantId>
//   to://<projectId>/match/<matchId>
//   to://<projectId>/station/<resourceId>
// Scanning opens the desktop app on exactly that screen. Parsing and resolution
// are pure so the behaviour can be tested without a camera.

import { t } from '../i18n';

export type DeepLinkKind = 'checkin' | 'match' | 'station';

export interface DeepLink {
  projectId: string;
  kind: DeepLinkKind;
  id: string;
}

export const DEEP_LINK_SCHEME = 'to://';

const KINDS: DeepLinkKind[] = ['checkin', 'match', 'station'];

export function formatDeepLink(link: DeepLink): string {
  return `${DEEP_LINK_SCHEME}${link.projectId}/${link.kind}/${link.id}`;
}

export type ParsedLink = { ok: true; link: DeepLink } | { ok: false; error: string };

export function parseDeepLink(text: string): ParsedLink {
  const raw = (text ?? '').trim();
  if (!raw) return { ok: false, error: t('link.emptyCode') };
  if (!raw.startsWith(DEEP_LINK_SCHEME))
    return { ok: false, error: t('link.notOurCode') };
  const parts = raw.slice(DEEP_LINK_SCHEME.length).split('/').filter(Boolean);
  if (parts.length !== 3) return { ok: false, error: t('link.incomplete') };
  const [projectId, kind, id] = parts;
  if (!(KINDS as string[]).includes(kind))
    return { ok: false, error: t('link.unknownKind', { kind }) };
  if (!projectId || !id) return { ok: false, error: t('link.missingId') };
  return { ok: true, link: { projectId, kind: kind as DeepLinkKind, id } };
}

export type ResolvedAction =
  | { kind: 'checkin'; participantId: string }
  | { kind: 'match'; matchId: string }
  | { kind: 'station'; resourceId: string }
  | { kind: 'error'; message: string };

/** Turns a link into a concrete action against the loaded project. */
export function resolveDeepLink(
  link: DeepLink,
  project: { id: string; participants: { id: string }[]; matches: { id: string }[]; resources: { id: string }[] },
): ResolvedAction {
  if (project.id !== link.projectId)
    return { kind: 'error', message: t('link.otherProject') };
  if (link.kind === 'checkin') {
    return project.participants.some(p => p.id === link.id)
      ? { kind: 'checkin', participantId: link.id }
      : { kind: 'error', message: t('link.noParticipant') };
  }
  if (link.kind === 'match') {
    return project.matches.some(m => m.id === link.id)
      ? { kind: 'match', matchId: link.id }
      : { kind: 'error', message: t('link.noMatch') };
  }
  return project.resources.some(r => r.id === link.id)
    ? { kind: 'station', resourceId: link.id }
    : { kind: 'error', message: t('link.noStation') };
}
