// The public-results link.
//
// One switch, one choice, one link. Everything an organizer has to understand is
// on this screen; everything else — the address of the site, the publish token — is
// either fixed or already stored.
//
// Two decisions shape this screen:
//
// 1. Sharing is opt-in and stays off until asked for. A tournament that is only
//    ever run on one laptop must never appear to be online, and the cost of an
//    accidental publish is other people's results.
// 2. The organizer never types an address. The link comes from the event name,
//    which is what they already called it, and a collision adds characters rather
//    than making them invent a name.

import { useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../state/store';
import { buildSnapshot, publicUrl, type PublishVisibility } from '../engine/publish';
import { PUBLISH_ENDPOINT, publishSlug } from '../engine/publish-slug';
import { PublishError, publishSnapshot, revokePublished } from '../engine/publish-client';
import { Alert, Field, Page, Panel, Switch } from './kit';
import { useT } from '../i18n';

const VISIBILITIES: readonly PublishVisibility[] = ['unlisted', 'public'];

export default function Publish() {
  const t = useT();
  const { domain, settings, setSettings } = useApp();
  const tournament = domain.tournament;

  const enabled = settings.publishEnabled === true;
  const visibility = (settings.publishVisibility ?? 'unlisted') as PublishVisibility;
  const token = settings.publishToken ?? '';

  // Derived from the event name rather than stored: rename the tournament and the
  // link follows, instead of the two drifting apart and confusing whoever holds it.
  const slug = useMemo(
    () => publishSlug(tournament.name, settings.publishSlugTaken ?? []),
    [tournament.name, settings.publishSlugTaken],
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

  const send = async () => {
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
        visibility,
        revision: (settings.publishRevision ?? 0) + 1,
      });
      await publishSnapshot({ endpoint: PUBLISH_ENDPOINT, token, slug }, snapshot);
      persist({ publishRevision: snapshot.revision, publishSentAt: new Date().toISOString() });
      setMsg({ kind: 'ok', text: t('pub.sent') });
    } catch (e) {
      const key = e instanceof PublishError ? `pub.err.${e.problem}` : 'pub.err.http';
      setMsg({ kind: 'err', text: t(key as never) });
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await revokePublished({ endpoint: PUBLISH_ENDPOINT, token, slug });
      setMsg({ kind: 'ok', text: t('pub.stopped') });
    } catch {
      setMsg({ kind: 'err', text: t('pub.err.network') });
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    // A QR code is a way of getting the link onto a phone or a sheet of paper, so
    // it is built only when asked for and then kept until the link changes.
    if (qr) { setQr(''); return; }
    setQr(await QRCode.toDataURL(url, { margin: 1, width: 280 }));
  };

  const turnOff = () => {
    persist({ publishEnabled: false });
    setQr('');
    setMsg(null);
  };

  return (
    <Page title={t('pub.title')} sub={t('pub.sub')}>
      <Panel>
        <Switch
          checked={enabled}
          disabled={!token}
          onChange={v => {
            setMsg(null);
            if (v) persist({ publishEnabled: true });
            else turnOff();
          }}
          label={t('pub.enable')}
          hint={token ? t('pub.enableHint') : t('pub.noToken')}
        />
      </Panel>

      <Panel title={t('pub.token')}>
        {/* The token is asked for once and kept on this computer. It is deliberately
            not part of the app's build: a secret written into source is readable by
            anyone who can clone the repository, and this one authorises overwriting
            published results. */}
        <Field label={t('pub.token')} hint={t('pub.tokenHint')}>
          <input
            type="password"
            value={tokenDraft}
            autoComplete="off"
            spellCheck={false}
            placeholder={token ? '••••••••' : ''}
            onChange={e => setTokenDraft(e.target.value)}
          />
        </Field>
        {token ? <p className="f-hint">{t('pub.tokenSaved')}</p> : null}
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className="btn"
            disabled={tokenDraft.trim().length === 0}
            onClick={() => { persist({ publishToken: tokenDraft.trim() }); setTokenDraft(''); }}
          >
            {t('pub.tokenSave')}
          </button>
          {token ? (
            <button className="btn quiet" onClick={() => persist({ publishToken: '' })}>
              {t('pub.tokenForget')}
            </button>
          ) : null}
        </div>
      </Panel>

      {!enabled ? null : (
        <>
          {msg ? <Alert tone={msg.kind === 'ok' ? 'ok' : 'err'}>{msg.text}</Alert> : null}

          <Panel title={t('pub.url')}>
            {/* The link is the product here, so it is shown as text rather than
                hidden behind a copy button the organizer has to trust. */}
            <div className="pub-link">{url}</div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" disabled={busy || !token} onClick={send}>{t('pub.send')}</button>
              <button className="btn quiet" onClick={share}>{qr ? t('pub.hideQr') : t('pub.showQr')}</button>
              <button className="btn quiet" disabled={busy || !token} onClick={stop}>{t('pub.stop')}</button>
            </div>
            {qr ? <img className="pub-qr" src={qr} alt={url} /> : null}
          </Panel>

          <Panel title={t('pub.vis')}>
            <Field label={t('pub.vis')} hint={t('pub.visHint')}>
              <select
                value={visibility}
                onChange={e => persist({ publishVisibility: e.target.value as PublishVisibility })}
              >
                {VISIBILITIES.map(v => <option key={v} value={v}>{t(`pub.${v}` as never)}</option>)}
              </select>
            </Field>
          </Panel>
        </>
      )}
    </Page>
  );
}