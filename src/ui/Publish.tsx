// The public-results link.
//
// One decision, then a link: pick who can see it, press Activate, copy. There is
// no address to type and no key to paste — the site, the token and the slug are
// all decided before this screen opens.
//
// Two decisions shape this screen:
//
// 1. Sharing is opt-in and stays off until asked for. A tournament that is only
//    ever run on one laptop must never appear to be online, and the cost of an
//    accidental publish is other people's results.
// 2. The link, once created, is pinned. Renaming the tournament does not move it,
//    nothing short of "Delete link" takes it down, and the results stay until the
//    organizer decides otherwise.

import { useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../state/store';
import { buildSnapshot, publicUrl, type PublishVisibility } from '../engine/publish';
import { PUBLISH_ENDPOINT, BUILT_IN_PUBLISH_TOKEN, publishSlug } from '../engine/publish-slug';
import { PublishError, publishSnapshot, revokePublished } from '../engine/publish-client';
import { publishLogo } from '../engine/publisher';
import { Alert, Field, Page, Panel } from './kit';
import { useT } from '../i18n';

const VISIBILITIES: readonly PublishVisibility[] = ['unlisted', 'public'];

export default function Publish() {
  const t = useT();
  const { domain, settings, setSettings } = useApp();
  const tournament = domain.tournament;

  const enabled = settings.publishEnabled === true;
  const visibility = (settings.publishVisibility ?? 'unlisted') as PublishVisibility;
  // A token in settings wins, so an organizer on their own site is not stuck with
  // the one baked into this build. Otherwise the app shares with no setup at all,
  // which is the point: there is nothing to type before the first publish.
  const token = (settings.publishToken ?? '').trim() || BUILT_IN_PUBLISH_TOKEN;
  // Whether the organizer has supplied their own, rather than using the one this
  // build carries. It decides whether the token panel exists at all.
  const customToken = (settings.publishToken ?? '').trim().length > 0;

  // Pinned at activation (publishSlug), so the link people were given survives a
  // rename and "Delete link" revokes exactly that address. Before the first
  // activation it is derived from the event name — which is what the organizer is
  // about to receive, so they can see it before committing.
  const slug = useMemo(
    () => settings.publishSlug ?? publishSlug(tournament.name, settings.publishSlugTaken ?? []),
    [settings.publishSlug, tournament.name, settings.publishSlugTaken],
  );
  const url = publicUrl(PUBLISH_ENDPOINT, slug);

  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  // Held in state rather than written straight into settings, so a half-typed token
  // is never persisted: settings are saved on change, and a mistyped token that got
  // stored would look configured while refusing every publish.
  const [tokenDraft, setTokenDraft] = useState('');

  const persist = (patch: Record<string, unknown>) => setSettings({ ...settings, ...patch });

  const showFailure = (e: unknown) => {
    const key = e instanceof PublishError ? `pub.err.${e.problem}` : 'pub.err.http';
    setMsg({ kind: 'err', text: t(key as never) });
  };

  /**
   * Sends the current results. `extra` is folded into settings only once the
   * site has accepted the snapshot, so a failed activation changes nothing:
   * the screen stays exactly as it was, ready for another attempt.
   */
  const send = async (opts?: { extra?: Record<string, unknown>; vis?: PublishVisibility }): Promise<boolean> => {
    setBusy(true);
    setMsg(null);
    try {
      const snapshot = buildSnapshot({
        tournament,
        participants: domain.participants,
        matches: domain.matches,
        groups: domain.groups,
        resources: domain.resources,
        slug,
        visibility: opts?.vis ?? visibility,
        revision: (settings.publishRevision ?? 0) + 1,
        // The organizer's own logo, shrunk to something worth sending. A failure
        // here costs the picture, never the publish.
        logoUrl: await publishLogo(tournament),
      });
      await publishSnapshot({ endpoint: PUBLISH_ENDPOINT, token, slug }, snapshot);
      persist({
        publishRevision: snapshot.revision,
        publishSentAt: new Date().toISOString(),
        ...opts?.extra,
      });
      setMsg({ kind: 'ok', text: t('pub.sent') });
      return true;
    } catch (e) {
      showFailure(e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** One click: the first snapshot goes out and the link goes live. */
  const activate = () => void send({ extra: { publishEnabled: true, publishSlug: slug } });

  /**
   * The one way sharing ends. The slug is pinned, so this revokes exactly the
   * link that was handed out — a rename in the meantime changes nothing here.
   * The confirm respects the app-wide "confirm destructive actions" setting.
   */
  const deleteLink = async () => {
    if (settings.confirmDestructive && !window.confirm(t('pub.deleteConfirm', { url }))) return;
    setBusy(true);
    setMsg(null);
    try {
      await revokePublished({ endpoint: PUBLISH_ENDPOINT, token, slug });
      persist({ publishEnabled: false, publishSlug: '' });
      setQr('');
      setMsg({ kind: 'ok', text: t('pub.deleted') });
    } catch (e) {
      showFailure(e);
    } finally {
      setBusy(false);
    }
  };

  /** The link is the product; getting it onto the clipboard is one press. */
  const copy = async () => {
    setMsg(null);
    try {
      await navigator.clipboard.writeText(url);
      setMsg({ kind: 'ok', text: t('pub.copied') });
    } catch {
      // Some WebViews expose no async clipboard (file:// origins, older engines);
      // the document.execCommand path still works there.
      const area = document.createElement('textarea');
      area.value = url;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        setMsg({ kind: 'ok', text: t('pub.copied') });
      } catch {
        setMsg({ kind: 'err', text: t('pub.copyFailed') });
      } finally {
        area.remove();
      }
    }
  };

  // A QR code is a way of getting the link onto a phone or a sheet of paper, so
  // it is built only when asked for and then kept until the link changes.
  const share = async () => {
    if (qr) { setQr(''); return; }
    setQr(await QRCode.toDataURL(url, { margin: 1, width: 280 }));
  };

  // The choice lives inside the snapshot, so while the link is live a change is
  // pushed at once — otherwise the site would keep answering with the old access
  // rules until someone happened to press Update. Before activation it is only
  // stored, to go out with the first snapshot.
  const changeVisibility = (v: PublishVisibility) => {
    if (enabled) void send({ extra: { publishVisibility: v }, vis: v });
    else persist({ publishVisibility: v });
  };

  return (
    <Page title={t('pub.title')} sub={t('pub.sub')}>
      {msg ? <Alert tone={msg.kind === 'ok' ? 'ok' : 'err'}>{msg.text}</Alert> : null}

      <Panel title={t('pub.vis')}>
        <Field label={t('pub.vis')} hint={t('pub.visHint')}>
          <select value={visibility} disabled={busy} onChange={e => changeVisibility(e.target.value as PublishVisibility)}>
            {VISIBILITIES.map(v => <option key={v} value={v}>{t(`pub.${v}` as never)}</option>)}
          </select>
        </Field>
      </Panel>

      {!enabled ? (
        <Panel title={t('pub.enable')} sub={t('pub.enableHint')}>
          {/* The address is shown before anything is sent. An organizer who
              dislikes what their event name turned into can rename the event
              instead of publishing an address nobody will want to hand out. */}
          <div className="pub-link">{url}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={busy} onClick={activate}>{t('pub.activate')}</button>
          </div>
        </Panel>
      ) : (
        <Panel title={t('pub.url')}>
          {/* The link is the product here, so it is shown as text rather than
              hidden behind a copy button the organizer has to trust. */}
          <div className="pub-link">{url}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={busy} onClick={() => void copy()}>{t('pub.copy')}</button>
            <button className="btn quiet" disabled={busy} onClick={() => void share()}>{qr ? t('pub.hideQr') : t('pub.showQr')}</button>
            <button className="btn quiet" disabled={busy} onClick={() => void send()}>{t('pub.send')}</button>
            <button className="btn quiet" disabled={busy} onClick={() => void deleteLink()}>{t('pub.delete')}</button>
          </div>
          {qr ? <img className="pub-qr" src={qr} alt={url} /> : null}
          <p className="hint">{t('pub.autoHint')}</p>
        </Panel>
      )}

      {/* Only shown once a token has been set, which means only for someone running
          their own site. Out of the box the app needs no token from the organizer,
          so showing them an empty password field would be asking for something they
          do not have and cannot need. */}
      {customToken ? (
        <Panel title={t('pub.token')}>
          <Field label={t('pub.token')} hint={t('pub.tokenHint')}>
            <input
              type="password"
              value={tokenDraft}
              autoComplete="off"
              spellCheck={false}
              placeholder="••••••••"
              onChange={e => setTokenDraft(e.target.value)}
            />
          </Field>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn"
              disabled={tokenDraft.trim().length === 0}
              onClick={() => { persist({ publishToken: tokenDraft.trim() }); setTokenDraft(''); }}
            >
              {t('pub.tokenSave')}
            </button>
            <button
              className="btn quiet"
              onClick={() => { persist({ publishToken: '' }); setTokenDraft(''); }}
            >
              {t('pub.tokenForget')}
            </button>
          </div>
        </Panel>
      ) : null}
    </Page>
  );
}
