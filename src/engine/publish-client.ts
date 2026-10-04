// Talking to the public site.
//
// Requests come from the renderer's own `fetch`, the same way the LAN sync already
// does, so there is no new bridge channel to keep in step. The site answers with
// permissive CORS headers on the write endpoints only; what actually authorises a
// publish is the token, which never leaves this machine.

import type { Snapshot } from './publish';

export interface PublishConfig {
  /** The site's origin, e.g. https://results.example */
  endpoint: string;
  /** Shared secret from `wrangler secret put PUBLISH_SECRET`. */
  token: string;
  slug: string;
}

function baseUrl(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

async function send(url: string, token: string, body: unknown, method: 'POST', tolerate: number[] = []): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-publish-token': token },
      body: JSON.stringify(body),
    });
  } catch {
    // A network-level failure: no route to the host, DNS, offline. Distinct
    // from a refusal, because nothing was decided yet and a retry may work.
    throw new PublishError('network', url);
  }
  // Statuses the caller has decided are fine — e.g. a 404 while revoking, where
  // "the link is already gone" is the state being asked for, not a failure.
  if (tolerate.includes(res.status)) return;
  if (res.status === 401 || res.status === 403) throw new PublishError('token', url);
  if (res.status === 422) throw new PublishError('rejected', url);
  // 503 is the site's own "I have no publish secret". That is a setup problem,
  // not a bad upload, and saying so saves an organizer from retrying a button
  // that can never work.
  if (res.status === 503) throw new PublishError('unconfigured', url);
  if (!res.ok) throw new PublishError('http', url);
}

export type PublishProblem = 'network' | 'token' | 'rejected' | 'http' | 'unconfigured';

export class PublishError extends Error {
  constructor(readonly problem: PublishProblem, readonly url: string) {
    super(problem);
    this.name = 'PublishError';
  }
}

/** Sends the snapshot. An older revision is ignored by the site, not an error. */
export function publishSnapshot(cfg: PublishConfig, snapshot: Snapshot): Promise<void> {
  return send(`${baseUrl(cfg.endpoint)}/api/${encodeURIComponent(cfg.slug)}/publish`, cfg.token, snapshot, 'POST');
}

/**
 * Takes the event off the public internet.
 *
 * A 404 answers "there is nothing to delete", which is the state this call
 * wanted: the link may already have been revoked from another machine, or the
 * site may have lost it. Reporting that as an error would leave the organizer
 * retrying a button that has nothing left to do.
 */
export function revokePublished(cfg: PublishConfig): Promise<void> {
  return send(`${baseUrl(cfg.endpoint)}/api/${encodeURIComponent(cfg.slug)}/revoke`, cfg.token, { slug: cfg.slug }, 'POST', [404]);
}

/** Whether the site already holds this event, and at what revision. */
export async function publishedState(cfg: PublishConfig): Promise<{ revision: number; visibility: string } | null> {
  try {
    const res = await fetch(`${baseUrl(cfg.endpoint)}/api/${encodeURIComponent(cfg.slug)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = await res.json() as { revision?: number; visibility?: string };
    return { revision: body.revision ?? 0, visibility: body.visibility ?? '' };
  } catch {
    return null;
  }
}