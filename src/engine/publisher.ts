// One definition of "what goes out, and where".
//
// Two things trigger a publish: a person pressing a button on the Online preview
// screen, and the app noticing that results changed while sharing is on. Both must
// build the same snapshot and address the same endpoint, or the public page and the
// organizer's screen would disagree about what was sent. So the decision lives here
// and the two callers only choose *when*.

import { buildSnapshot, type BuildInput, type PublishVisibility, type Snapshot } from './publish';
import { BUILT_IN_PUBLISH_TOKEN, PUBLISH_ENDPOINT, publishSlug } from './publish-slug';
import { PublishError, publishSnapshot } from './publish-client';
import { logoForPublish } from './publish-logo';
import type { AppSettings } from './types';

export interface PublishTarget {
  endpoint: string;
  token: string;
  slug: string;
  visibility: PublishVisibility;
}

/** What a publish needs, decided from settings exactly once. */
export function resolveTarget(
  settings: AppSettings,
  tournamentName: string,
  extra?: Partial<Pick<PublishTarget, 'slug' | 'visibility'>>,
): PublishTarget {
  return {
    endpoint: PUBLISH_ENDPOINT,
    // A token the organizer supplied wins; otherwise the one this build carries.
    token: (settings.publishToken ?? '').trim() || BUILT_IN_PUBLISH_TOKEN,
    // Once a link exists it is pinned, so a rename cannot move an address that was
    // already handed out. Before that it comes from the event's own name.
    slug: extra?.slug ?? settings.publishSlug
      ?? publishSlug(tournamentName, settings.publishSlugTaken ?? []),
    visibility: extra?.visibility ?? ((settings.publishVisibility ?? 'unlisted') as PublishVisibility),
  };
}

export interface SnapshotSource {
  tournament: BuildInput['tournament'];
  participants: BuildInput['participants'];
  matches: BuildInput['matches'];
  groups?: BuildInput['groups'];
  resources?: BuildInput['resources'];
}

/** The snapshot for the current project — the only thing that ever leaves the device. */
export function snapshotFor(
  source: SnapshotSource,
  settings: AppSettings,
  target: PublishTarget,
  logoUrl?: string | null,
): Snapshot {
  // Branding and the organizer's own words ride along when the tournament has
  // them; the type is read defensively because they arrived on the model later
  // than the fields the first published snapshot carried.
  const meta = source.tournament as { description?: string; organizer?: string | null };
  const input: BuildInput = {
    tournament: source.tournament,
    participants: source.participants,
    matches: source.matches,
    groups: source.groups,
    resources: source.resources,
    slug: target.slug,
    visibility: target.visibility,
    revision: (settings.publishRevision ?? 0) + 1,
    description: meta.description ?? '',
    organizer: meta.organizer ?? null,
    logoUrl: logoUrl ?? null,
  };
  return buildSnapshot(input);
}

export type PublishOutcome =
  | { ok: true; revision: number }
  | { ok: false; problem: PublishError['problem'] };

/** Sends a snapshot and reports what happened, without throwing at the caller. */
export async function sendSnapshot(target: PublishTarget, snapshot: Snapshot): Promise<PublishOutcome> {
  try {
    await publishSnapshot({ endpoint: target.endpoint, token: target.token, slug: target.slug }, snapshot);
    return { ok: true, revision: snapshot.revision };
  } catch (e) {
    return { ok: false, problem: e instanceof PublishError ? e.problem : 'http' };
  }
}

/** The logo as it should travel, or null. Safe to call on every publish. */
export function publishLogo(tournament: { branding?: { logoDataUrl?: string } }): Promise<string | null> {
  return logoForPublish(tournament.branding?.logoDataUrl);
}
