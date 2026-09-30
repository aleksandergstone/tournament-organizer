// License — the one screen where a payment turns into an unlocked feature.
//
// It never decides anything itself: the status comes from the verified license,
// the key is verified before it is stored, and the "Pro" badge is a rendering of
// hasFeature() like every other gate in the app.
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  activateLicense, activationUsageOf, deactivateLicense, exportLicenseInfo, importLicenseFile,
  isProActive, licenseStore, licenseSummary, loadLicense, refreshLicense, removeLicense,
  type LicenseFailure,
} from '../engine/license';
import { has, proFeatures } from '../engine/features';
import { checkoutUrl, isPurchaseConfigured } from '../checkout';
import { desktop } from '../engine/desktop';
import { useT } from '../i18n';
import { Alert, Field, Page, Panel, Empty } from './kit';

export default function License() {
  const t = useT();
  const state = useSyncExternalStore(licenseStore.subscribe, licenseStore.get);
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Verified once at startup, like every other offline check.
  useEffect(() => { void refreshLicense(); }, []);

  const pro = isProActive();
  const { status, detail } = licenseSummary();

  // How many of the allowed computers this license is on. Read from the
  // verified claims and the local ledger — never from a setting.
  const env = pro ? loadLicense() : null;
  const seats = env
    ? (env.claims.activationLimit === null
        ? t('lic.seatsUnlimited')
        : t('lic.seats', { used: String(activationUsageOf(env)), limit: String(env.claims.activationLimit) }))
    : '';

  const run = async (fn: () => Promise<{ ok: boolean; reason?: LicenseFailure }>) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fn();
      setMsg(r.ok
        ? { kind: 'ok', text: t('lic.done') }
        : { kind: 'err', text: t(`lic.reason.${r.reason ?? 'malformed'}`) });
      if (r.ok) setKey('');
    } finally { setBusy(false); }
  };

  const buy = () => {
    const url = checkoutUrl();
    if (!url) { setMsg({ kind: 'err', text: t('lic.checkoutMissing') }); return; }
    // The system browser, not a window inside the app: the checkout page is not
    // ours, and the customer should be able to see where they are typing.
    void desktop.openExternal(url).catch(() => setMsg({ kind: 'err', text: t('lic.checkoutMissing') }));
  };

  return (
    <Page title={t('lic.title')} sub={t('lic.sub')}>
      <Panel title={status}>
        {detail ? <p className="f-hint">{detail}</p> : null}
        {pro && seats ? <p className="f-hint">{seats}</p> : null}
        {msg ? <Alert tone={msg.kind} title={msg.kind === 'err' ? t('common.unknown') : undefined}>{msg.text}</Alert> : null}
        <div className="row" style={{ marginTop: 10 }}>
          {!pro ? (
            <button className="btn primary" onClick={buy}>{t('lic.buy')}</button>
          ) : (
            <>
              <button className="btn" disabled={busy} onClick={() => {
                // Written to a file the organizer chooses, so moving the license
                // to another machine needs no copy-paste gymnastics.
                void desktop.saveText('tournament-organizer-license.txt', exportLicenseInfo());
              }}>{t('lic.copy')}</button>
              <button
                className="btn quiet"
                disabled={busy}
                onClick={() => { deactivateLicense(); setMsg({ kind: 'ok', text: t('lic.statusFree') }); }}>
                {t('lic.deactivate')}
              </button>
              <button
                className="btn quiet"
                disabled={busy}
                onClick={() => { removeLicense(); setMsg({ kind: 'ok', text: t('lic.statusFree') }); }}>
                {t('lic.remove')}
              </button>
            </>
          )}
        </div>
        {!pro ? <p className="f-hint">{t('lic.buyHint')}</p> : <p className="f-hint">{t('lic.offline')}</p>}
        {pro ? <p className="f-hint">{t('lic.removeHint')}</p> : null}
        {!pro && !isPurchaseConfigured() ? <p className="f-hint">{t('lic.checkoutMissing')}</p> : null}
      </Panel>

      {!pro && (
        <Panel title={t('lic.unlocks')}>
          <ul className="summary-rules">
            {proFeatures().map(f => (
              <li key={f.id} className={has(f.id) ? '' : 'muted'}>
                <b>{f.name}</b>
                {has(f.id) ? '' : ` — ${t('lic.statusFree')}`}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={t('lic.key')} sub={t('lic.keyHint')}>
        {pro ? (
          <Empty title={t('lic.statusPro')} hint={t('lic.offline')} />
        ) : (
          <>
            <Field label={t('lic.key')}>
              <textarea
                rows={3} value={key} onChange={e => setKey(e.target.value)}
                placeholder="TO-PRO.…" aria-label={t('lic.key')}
                style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, width: '100%' }} />
            </Field>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" disabled={busy || !key.trim()} onClick={() => run(() => activateLicense(key))}>
                {t('lic.activate')}
              </button>
              <button className="btn" disabled={busy} onClick={async () => {
                const f = await desktop.openText();
                if (!f) return;
                if ('error' in f && f.error) { setMsg({ kind: 'err', text: t(`lic.reason.${'malformed'}`) }); return; }
                await run(() => importLicenseFile(f.text));
              }}>{t('lic.import')}</button>
            </div>
          </>
        )}
        <p className="table-note">{t('lic.support')}</p>
      </Panel>
    </Page>
  );
}

/** The stored license, for the copy button and the tests. */
export function storedLicenseText(): string {
  return exportLicenseInfo();
}
