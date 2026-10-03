// Publishing a tournament to the public website.
//
// One screen with one job: choose where it goes, choose who may see it, and send.
// The settings live here rather than in the general settings screen because they
// belong to this tournament — a different event may be published to a different
// address under a different name.

import { useState } from 'react';
import { useApp } from '../state/store';
import { buildSnapshot, publicUrl, type PublishVisibility } from '../engine/publish';
import { PublishError, publishSnapshot, revokePublished, publishedState } from '../engine/publish-client';
import { desktop } from '../engine/desktop';
import { Alert, Field, Page, Panel } from './kit';
import { useT } from '../i18n';

/** Mirrors the site's slug rules, so a bad address is caught here, not after a send. */
function usableSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80;
}

const VISIBILITIES: readonly PublishVisibility[] = ['private', 'unlisted', 'public'];

export default function Publish() {
  const t = useT();
  const { domain, settings, setSettings } = useApp();
  const cfg = {
    endpoint: settings.publishEndpoint ?? '',
    token: settings.publishToken ?? '',
    slug: settings.publishSlug ?? '',
  };
  const visibility = (settings.publishVisibility ?? 'unlisted') as PublishVisibility;
  const description = settings.publishDescription ?? '';

  const [slug, setSlug] = useState(cfg.slug);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const url = publicUrl(cfg.endpoint, slug);
  const canSend = usableSlug(slug) && cfg.endpoint.trim().length > 0 && cfg.token.trim().length > 0;

  const persist = (patch: Partial<typeof settings>) => setSettings({ ...settings, ...patch });

  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const snapshot = buildSnapshot({
        tournament: domain.tournament,
        participants: domain.participants,
        matches: domain.matches,
        groups: domain.groups,
        resources: domain.resources,
        slug,
        visibility,
        revision: (settings.publishRevision ?? 0) + 1,
        description,
      });
      await publishSnapshot({ ...cfg, slug }, snapshot);
      persist({ publishSlug: slug, publishRevision: snapshot.revision, publishSentAt: new Date().toISOString() });
      setMsg({ kind: 'ok', text: t('pub.sent') });
    } catch (e) {
      // The four problems look the same to an organizer, so each gets its own
      // sentence: "it did not work" is not an actionable answer.
      const key = e instanceof PublishError ? `pub.err.${e.problem}` : 'pub.err.http';
      setMsg({ kind: 'err', text: t(key as never) });
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await revokePublished({ ...cfg, slug });
      setMsg({ kind: 'ok', text: t('pub.notPublished') });
    } catch {
      setMsg({ kind: 'err', text: t('pub.err.network') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t('pub.title')} sub={t('pub.sub')}>
      {msg ? <Alert tone={msg.kind === 'ok' ? 'ok' : 'err'}>{msg.text}</Alert> : null}

      <Panel title={t('pub.endpoint')}>
        <div className="grid2">
          <Field label={t('pub.endpoint')} hint={t('pub.endpointHint')}>
            <input value={cfg.endpoint} placeholder="https://…"
              onChange={e => persist({ publishEndpoint: e.target.value })} />
          </Field>
          <Field label={t('pub.slug')} hint={t('pub.slugHint')}
            error={slug && !usableSlug(slug) ? t('pub.slugHint') : undefined}>
            <input value={slug} onChange={e => setSlug(e.target.value)} />
          </Field>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" disabled={!canSend || busy} onClick={send}>{t('pub.publish')}</button>
          <button className="btn quiet" disabled={!canSend || busy} onClick={unpublish}>{t('pub.revoke')}</button>
          {url ? <button className="btn quiet" onClick={() => desktop.openExternal(url)}>{url}</button> : null}
        </div>
      </Panel>

      <Panel title={t('pub.vis')}>
        <Field label={t('pub.vis')}>
          <select value={visibility} onChange={e => persist({ publishVisibility: e.target.value as PublishVisibility })}>
            {VISIBILITIES.map(v => <option key={v} value={v}>{t(`pub.${v}` as never)}</option>)}
          </select>
        </Field>
      </Panel>

      <Panel title={t('pub.desc')}>
        <Field label={t('pub.desc')} hint={t('pub.descHint')}>
          <textarea rows={3} value={description} onChange={e => persist({ publishDescription: e.target.value })} />
        </Field>
      </Panel>

      <Panel title={t('pub.token')}>
        <Field label={t('pub.token')} hint={t('pub.tokenHint')}>
          <input type="password" value={cfg.token} autoComplete="off"
            onChange={e => persist({ publishToken: e.target.value })} />
        </Field>
      </Panel>
    </Page>
  );
}