// Personalization — document appearance and custom content for this event.
// Accent colour, logo placement, header/footer notes and the rich-text
// regulation all live here. Changes are previewed live in a sample document.
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/store';
import { Branding, DEFAULT_BRANDING, normalizeBranding } from '../engine/branding';
import { buildReport, ReportKind, REPORT_KINDS } from '../engine/output';
import { renderReportHtml } from '../engine/pdf';
import { hasBracket, hasPointTable } from '../engine/generate';
import { nowIso, TournamentPublicInfo } from '../engine/types';
import { Alert, Button, Collapse, Field, Page, Panel, RichTextEditor, Switch } from './kit';
import { useT } from '../i18n';

export default function Personalize() {
  const tr = useT();
  const { domain, update } = useApp();
  const [draft, setDraft] = useState<Branding | null>(null);
  const [publicInfoDraft, setPublicInfoDraft] = useState<TournamentPublicInfo | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const t = domain.tournament;
  useEffect(() => { setDraft(null); }, [t.branding]);
  useEffect(() => { setPublicInfoDraft(null); }, [t.publicInfo]);
  const b = normalizeBranding({ ...t.branding, ...(draft ?? {}) });
  const pi = publicInfoDraft ?? (t.publicInfo ?? {
    shortDescription: '',
    fullDescription: '',
    organiser: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    facebook: '',
    instagram: '',
    otherLink: '',
    otherLinkLabel: '',
  });

  const commit = (next: Branding) => {
    setDraft(next);
    update(d => ({ ...d, tournament: { ...d.tournament, branding: normalizeBranding(next) } }), 'branding.updated');
    setMsg({ kind: 'ok', text: tr('personalize.saved') });
    setTimeout(() => setMsg(null), 1500);
  };

  const commitPublicInfo = () => {
    update(d => ({ ...d, tournament: { ...d.tournament, publicInfo: { ...pi } } }), 'publicInfo.updated');
    setMsg({ kind: 'ok', text: tr('personalize.saved') });
    setTimeout(() => setMsg(null), 1500);
  };

  const set = <K extends keyof Branding>(key: K, value: Branding[K]) => {
    setDraft(d => ({ ...(d ?? {} as Branding), [key]: value } as Branding));
  };

  const setPublicInfo = <K extends keyof TournamentPublicInfo>(key: K, value: TournamentPublicInfo[K]) => {
    setPublicInfoDraft((d: TournamentPublicInfo | null) => ({ ...(d ?? {} as TournamentPublicInfo), [key]: value } as TournamentPublicInfo));
  };

  const points = hasPointTable(domain.tournament.format);
  const hasBkt = hasBracket(domain.tournament.format);

  // Build a live-preview report using the current branding draft.
  const previewKind: ReportKind = points ? 'standings' : hasBkt ? 'bracket' : 'matches';
  const report = useMemo(() => {
    const participants = domain.participants.map(p => ({ ...p }));
    const matches = domain.matches.map(m => ({ ...m }));
    return buildReport({
      tournament: t, participants, groups: domain.groups, matches,
      resources: domain.resources, branding: { ...t.branding, ...b },
      generatedAt: nowIso(),
    }, previewKind);
  }, [t, domain, b, points, hasBkt, previewKind]);
  const html = useMemo(() => renderReportHtml(report), [report]);

  return (
    <Page title={tr('personalize.title')} sub={tr('personalize.sub')}>
      {msg && <Alert tone="ok">{msg.text}</Alert>}

      {/* Accent colour */}
      <Panel title={tr('personalize.accent')} sub={tr('personalize.accentHint')}>
        <Field label={tr('brand.accent1')} hint={tr('brand.accent1Hint')}>
          <div className="row">
            <input type="color" className="color-input" aria-label={tr('brand.accent1')}
              value={isHexColor(b.accent1) ? b.accent1 : DEFAULT_BRANDING.accent1}
              onChange={e => set('accent1', e.target.value)} />
            <input className="hex-input" value={b.accent1} aria-label="Accent 1 hex"
              onChange={e => set('accent1', e.target.value)} />
          </div>
        </Field>
        <Field label={tr('brand.accent2')} hint={tr('brand.accent2Hint')}>
          <div className="row">
            <input type="color" className="color-input" aria-label={tr('brand.accent2')}
              value={isHexColor(b.accent2) ? b.accent2 : DEFAULT_BRANDING.accent2}
              onChange={e => set('accent2', e.target.value)} />
            <input className="hex-input" value={b.accent2} aria-label="Accent 2 hex"
              onChange={e => set('accent2', e.target.value)} />
          </div>
        </Field>
        <Field label={tr('brand.background')} hint={tr('brand.backgroundHint')}>
          <div className="row">
            <input type="color" className="color-input" aria-label={tr('brand.background')}
              value={isHexColor(b.background) ? b.background : DEFAULT_BRANDING.background}
              onChange={e => set('background', e.target.value)} />
            <input className="hex-input" value={b.background} aria-label="Background hex"
              onChange={e => set('background', e.target.value)} />
          </div>
        </Field>
        <Field label={tr('brand.ink')} hint={tr('brand.inkHint')}>
          <div className="row">
            <input type="color" className="color-input" aria-label={tr('brand.ink')}
              value={isHexColor(b.ink) ? b.ink : DEFAULT_BRANDING.ink}
              onChange={e => set('ink', e.target.value)} />
            <input className="hex-input" value={b.ink} aria-label="Ink hex"
              onChange={e => set('ink', e.target.value)} />
          </div>
        </Field>
        <Field label={tr('brand.muted')} hint={tr('brand.mutedHint')}>
          <div className="row">
            <input type="color" className="color-input" aria-label={tr('brand.muted')}
              value={isHexColor(b.muted) ? b.muted : DEFAULT_BRANDING.muted}
              onChange={e => set('muted', e.target.value)} />
            <input className="hex-input" value={b.muted} aria-label="Muted hex"
              onChange={e => set('muted', e.target.value)} />
          </div>
        </Field>
        <Field label={tr('brand.line')} hint={tr('brand.lineHint')}>
          <div className="row">
            <input type="color" className="color-input" aria-label={tr('brand.line')}
              value={isHexColor(b.line) ? b.line : DEFAULT_BRANDING.line}
              onChange={e => set('line', e.target.value)} />
            <input className="hex-input" value={b.line} aria-label="Line hex"
              onChange={e => set('line', e.target.value)} />
          </div>
        </Field>
        <Field label={tr('brand.surface')} hint={tr('brand.surfaceHint')}>
          <div className="row">
            <input type="color" className="color-input" aria-label={tr('brand.surface')}
              value={isHexColor(b.surface) ? b.surface : DEFAULT_BRANDING.surface}
              onChange={e => set('surface', e.target.value)} />
            <input className="hex-input" value={b.surface} aria-label="Surface hex"
              onChange={e => set('surface', e.target.value)} />
          </div>
        </Field>
      </Panel>

      {/* Logo */}
      <Panel title={tr('personalize.logo')} sub={tr('personalize.logoHint')}>
        <Field label={tr('brand.logo')} hint={tr('brand.logoHint')}>
          <div className="logo-row">
            {b.logoDataUrl ? (
              <img className="logo-preview" src={b.logoDataUrl} alt="" />
            ) : (
              <span className="logo-empty">{tr('brand.noLogo')}</span>
            )}
            <div className="row">
              <Button onClick={() => (document.getElementById('personalize-logo-input') as HTMLInputElement)?.click()}>
                {b.logoDataUrl ? tr('brand.replace') : tr('brand.choose')}
              </Button>
              {b.logoDataUrl && <Button className="ghost" onClick={() => set('logoDataUrl', '')}>{tr('common.remove')}</Button>}
            </div>
            <input id="personalize-logo-input" type="file"
              accept="image/png,image/jpeg,image/webp,image/gif" hidden
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const dataUrl = await readLogoFile(file);
                  set('logoDataUrl', dataUrl);
                } catch (err) {
                  setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Cannot read image.' });
                }
                e.target.value = '';
              }} />
          </div>
        </Field>

        <Field label={tr('personalize.logoPlacement')} hint={tr('personalize.logoPlacementHint')}>
          <select value={b.logoPlacement} onChange={e => set('logoPlacement', e.target.value as Branding['logoPlacement'])}>
            <option value="top-left">{tr('personalize.placeTopLeft')}</option>
            <option value="top-right">{tr('personalize.placeTopRight')}</option>
            <option value="center">{tr('personalize.placeCenter')}</option>
            <option value="none">{tr('personalize.placeNone')}</option>
          </select>
        </Field>
      </Panel>

      {/* Header / footer notes */}
      <Panel title={tr('personalize.notes')} sub={tr('personalize.notesHint')}>
        {textField('headerNote', tr('brand.headerNote'), tr('brand.headerNoteHint'), tr('brand.headerNotePlaceholder'))}
        {textField('footerNote', tr('brand.footerNote'), tr('brand.footerNoteHint'), tr('brand.footerNotePlaceholder'))}
        {textField('notes', tr('brand.notes'), tr('brand.notesHint'), tr('brand.notesPlaceholder'), 4)}
      </Panel>

      {/* Tournament public info */}
      <Panel title={tr('personalize.publicInfo')} sub={tr('personalize.publicInfoHint')}>
        <Field label={tr('publicInfo.shortDescription')} hint={tr('publicInfo.shortDescriptionHint')}>
          <input value={pi.shortDescription} onChange={e => setPublicInfo('shortDescription', e.target.value)} />
        </Field>
        <Field label={tr('publicInfo.fullDescription')} hint={tr('publicInfo.fullDescriptionHint')}>
          <RichTextEditor
            value={pi.fullDescription}
            onChange={html => setPublicInfo('fullDescription', html)}
            label={tr('publicInfo.fullDescription')}
            hint={tr('publicInfo.fullDescriptionHint')} />
        </Field>
        <div className="grid2">
          <Field label={tr('publicInfo.organiser')} hint={tr('publicInfo.organiserHint')}>
            <input value={pi.organiser} onChange={e => setPublicInfo('organiser', e.target.value)} />
          </Field>
          <Field label={tr('publicInfo.contactEmail')} hint="E-mail">
            <input type="email" value={pi.contactEmail} onChange={e => setPublicInfo('contactEmail', e.target.value)} />
          </Field>
          <Field label={tr('publicInfo.contactPhone')} hint="Telefon">
            <input type="tel" value={pi.contactPhone} onChange={e => setPublicInfo('contactPhone', e.target.value)} />
          </Field>
          <Field label={tr('publicInfo.website')} hint={tr('publicInfo.websiteHint')}>
            <input type="url" value={pi.website} onChange={e => setPublicInfo('website', e.target.value)} />
          </Field>
          <Field label={tr('publicInfo.facebook')} hint="Facebook URL">
            <input type="url" value={pi.facebook} onChange={e => setPublicInfo('facebook', e.target.value)} />
          </Field>
          <Field label={tr('publicInfo.instagram')} hint="Instagram URL">
            <input type="url" value={pi.instagram} onChange={e => setPublicInfo('instagram', e.target.value)} />
          </Field>
          <Field label={tr('publicInfo.otherLink')} hint="URL">
            <input type="url" value={pi.otherLink} onChange={e => setPublicInfo('otherLink', e.target.value)} />
          </Field>
          <Field label={tr('publicInfo.otherLinkLabel')} hint="Etykieta">
            <input value={pi.otherLinkLabel} onChange={e => setPublicInfo('otherLinkLabel', e.target.value)} />
          </Field>
        </div>
        <div className="row">
          <Button className="btn primary" onClick={commitPublicInfo}>{tr('personalize.apply')}</Button>
        </div>
      </Panel>

      {/* Rich-text regulation */}
      <Panel title={tr('personalize.regulation')} sub={tr('personalize.regulationHint')}>
        <Field label={tr('brand.regTitle')} hint={tr('doc.regulation')}>
          <input value={b.regulation.title} onChange={e => set('regulation', { ...b.regulation, title: e.target.value })} />
        </Field>
        <Field label={tr('brand.regBody')} hint={tr('brand.regBodyHint')}>
          <RichTextEditor
            value={b.regulation.body}
            onChange={html => set('regulation', { ...b.regulation, body: html })}
            label={tr('personalize.regulationBody')}
            hint={tr('brand.regBodyHint')} />
        </Field>
        <Switch checked={b.regulation.includeInDocs} label={tr('brand.regInclude')}
          hint={tr('brand.regIncludeHint')}
          onChange={v => set('regulation', { ...b.regulation, includeInDocs: v })} />
      </Panel>

      {/* Live preview */}
      <Collapse title={tr('personalize.preview')} sub={tr('personalize.previewHint')} defaultOpen>
        <div className="output-preview-wrap">
          <iframe className="output-preview" title={tr('out.docPreview')} srcDoc={html} />
        </div>
      </Collapse>

      <div className="row">
        <Button className="btn primary" onClick={() => commit(b)}>{tr('personalize.apply')}</Button>
      </div>
    </Page>
  );

  function textField(key: keyof Branding, label: string, hint: string, placeholder: string, rows = 3) {
    return (
      <Field label={label} hint={hint}>
        <textarea rows={rows} value={String(b[key] ?? '')} placeholder={placeholder}
          onChange={e => set(key, e.target.value as Branding[typeof key])} />
      </Field>
    );
  }
}

async function readLogoFile(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error('Choose a PNG, JPG, WEBP or GIF image.');
  if (file.size > 12 * 1024 * 1024) throw new Error('That image is too large — pick one under 12 MB.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ''));
    fr.onerror = () => reject(new Error('The image could not be read.'));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image(); el.onload = () => resolve(el); el.onerror = reject; el.src = dataUrl;
  });
  for (const width of [640, 420, 280, 180]) {
    if (img.width <= width) break;
    const canvas = document.createElement('canvas');
    canvas.height = Math.round((img.height / img.width) * width);
    canvas.width = width;
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
    if (out.length <= 400 * 1024) return out;
  }
  throw new Error('That image is too detailed to embed — try a simpler or smaller logo.');
}

function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim());
}