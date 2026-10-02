// Regulations — where an event's rules are written once and then printed.
//
// Stored on the branding, so a regulation travels with the project file and over
// LAN sync for free, exactly like the rest of the document setup.
import { useEffect, useState } from 'react';
import { useApp } from '../state/store';
import { Branding, Regulation, normalizeBranding } from '../engine/branding';
import { Alert, Field, Page, Panel, Switch } from './kit';
import { useT } from '../i18n';

export default function RegulationTab() {
  const t = useT();
  const { domain, update } = useApp();
  const stored = normalizeBranding(domain.tournament.branding).regulation;
  const [draft, setDraft] = useState<Regulation>(stored);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDraft(stored); setSaved(false); }, [domain.tournament.branding]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next: Regulation) => {
    const branding: Branding = { ...normalizeBranding(domain.tournament.branding), regulation: next };
    update(d => ({ ...d, tournament: { ...d.tournament, branding: normalizeBranding(branding) } }), 'branding.updated');
    setSaved(true);
  };
  const set = <K extends keyof Regulation>(key: K, value: Regulation[K]) => setDraft(d => ({ ...d, [key]: value }));

  return (
    <Page title={t('reg.title')} sub={t('reg.sub')}>
      {saved && <Alert tone="ok">{t('reg.saved')}</Alert>}
      <Panel title={t('brand.regulation')} sub={t('brand.regulationSub')}>
        <div onBlur={() => commit(draft)}>
          <Field label={t('brand.regTitle')} hint={t('doc.regulation')}>
            <input value={draft.title} onChange={e => set('title', e.target.value)} placeholder={t('doc.regulation')} />
          </Field>
          <Field label={t('brand.regBody')} hint={t('brand.regBodyHint')}>
            <textarea rows={14} value={draft.body} onChange={e => set('body', e.target.value)} />
          </Field>
          <Switch checked={draft.includeInDocs} label={t('brand.regInclude')}
            hint={t('brand.regIncludeHint')} onChange={v => commit({ ...draft, includeInDocs: v })} />
        </div>
      </Panel>
    </Page>
  );
}
