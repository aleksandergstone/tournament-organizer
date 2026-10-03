// Settings — grouped by how often the organizer touches them.
// Everything here is optional; the app works with the defaults.
import { useApp } from '../state/store';
import { describeEdition as editionOf } from '../engine/features';
import { APP_NAME, APP_VERSION } from '../version';
import { LOCALES, LOCALE_NAMES, resolveLocale, useT } from '../i18n';
import type { LocalePreference } from '../i18n';
import { Collapse, Page, Panel, Segmented, Switch } from './kit';
import SyncPanel from './SyncPanel';
import SupportBanner, { ResetSupportButton } from './SupportBanner';



export default function Settings() {
  const { settings, setSettings, go } = useApp();
  const t = useT();
  const pref: LocalePreference = settings.locale ?? 'system';
  const effective = resolveLocale(pref);
  return (
    <Page title={t('settings.title')} sub={t('settings.sub')}>
      <Panel title={t('settings.appearance')}>
        <div className="row">
          <span className="f-label" id="theme-label" style={{ minWidth: 70 }}>{t('settings.theme')}</span>
          <Segmented
            value={settings.theme}
            onChange={v => setSettings({ ...settings, theme: v })}
            options={[{ id: 'light' as const, label: t('settings.light') }, { id: 'dark' as const, label: t('settings.dark') }]}
            label={t('settings.theme')}
          />
          <span className="muted">{t('settings.themeHint')}</span>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <span className="f-label" id="lang-label" style={{ minWidth: 70 }}>{t('language.title')}</span>
          <Segmented
            value={pref}
            onChange={v => setSettings({ ...settings, locale: v })}
            options={[
              { id: 'system' as const, label: t('language.system') },
              ...LOCALES.map(l => ({ id: l as LocalePreference, label: LOCALE_NAMES[l] })),
            ]}
            label={t('language.title')}
          />
          <span className="muted">{pref === 'system' ? t('language.systemHint') : t('language.sub')}</span>
        </div>
        <p className="table-note">{t('language.restart')} ({LOCALE_NAMES[effective]})</p>
      </Panel>

      <Panel title={t('settings.working')}>
        <Switch
          checked={settings.autosave}
          onChange={v => setSettings({ ...settings, autosave: v })}
          label={t('settings.autosave')}
          hint={t('settings.autosaveHint')}
        />
        <Switch
          checked={settings.confirmDestructive}
          onChange={v => setSettings({ ...settings, confirmDestructive: v })}
          label={t('settings.confirm')}
          hint={t('settings.confirmHint')}
        />
        <p className="table-note">
          {t('settings.shortcuts', { undo: 'Ctrl+Z', redo: 'Ctrl+Y', save: 'Ctrl+S' })}
        </p>
      </Panel>

      {/* Sync and the version table are things an organizer opens when they need
          them, not while working. Collapsed, they stop competing with the two
          settings that actually get changed: theme and language. */}
      <Collapse title={t('sync.title')} sub={t('sync.sub')}>
        <Panel>
          <SyncPanel />
        </Panel>
      </Collapse>

      <Collapse title={t('settings.about')} sub={t('settings.aboutNote', { action: t('settings.aboutAction') })}>
        <Panel>
          <div className="table-wrap">
            <table>
              <tbody>
                <tr><td className="muted">{t('settings.aboutApp')}</td><td className="name">{APP_NAME}</td></tr>
                <tr><td className="muted">{t('settings.aboutVersion')}</td><td>{APP_VERSION}</td></tr>
                <tr><td className="muted">{t('settings.aboutEdition')}</td><td className="name">{editionOf()}</td></tr>
                <tr><td className="muted">{t('language.title')}</td><td>{LOCALE_NAMES[effective]}</td></tr>
                <tr><td className="muted">{t('settings.aboutDataLabel')}</td><td>{t('settings.aboutData')}</td></tr>
                <tr><td className="muted">{t('settings.aboutLicense')}</td><td>MIT</td></tr>
              </tbody>
            </table>
          </div>
          <SupportBanner compact />
          <div className="row" style={{ marginTop: 6 }}>
            <ResetSupportButton />
          </div>
        </Panel>
      </Collapse>
    </Page>
  );
}
