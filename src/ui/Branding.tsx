// Document branding controls — the whole "make it look like our event" panel.
//
// Everything here is plain text plus optional logos, on purpose: an organiser
// should be able to brand a league in under a minute without training. Raw
// values are stored as typed; the engine sanitizes them when a document is
// built (see normalizeBranding), so typing is never fought with.
import { useRef, useState } from 'react';
import { Branding, DEFAULT_BRANDING, MAX_LOGO_BYTES, isHexColor } from '../engine/branding';
import { Field, Switch } from './kit';

const LOGO_TYPES = /^image\/(png|jpeg|webp|gif)$/;

/**
 * Reads a picked image and shrinks it until it fits the project-file budget.
 * Logos live inside the .top.json, so an unresized 4 MB camera photo would make
 * every save slow — and a 600 px logo prints perfectly at header size.
 */
export async function readLogoFile(file: File): Promise<string> {
  if (!LOGO_TYPES.test(file.type)) throw new Error('Choose a PNG, JPG, WEBP or GIF image.');
  if (file.size > 12 * 1024 * 1024) throw new Error('That image is too large — pick one under 12 MB.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ''));
    fr.onerror = () => reject(new Error('The image could not be read.'));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('That file is not a readable image.'));
    el.src = dataUrl;
  });
  for (const width of [640, 420, 280, 180]) {
    if (img.width <= width) break;
    const canvas = document.createElement('canvas');
    canvas.height = Math.round((img.height / img.width) * width);
    canvas.width = width;
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
    if (out.length <= MAX_LOGO_BYTES) return out;
  }
  throw new Error('That image is too detailed to embed — try a simpler or smaller logo.');
}

function LogoField({ label, hint, value, onChange }: {
  label: string; hint: string; value: string; onChange: (v: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const pick = async (file?: File) => {
    if (!file) return;
    setErr('');
    try { onChange(await readLogoFile(file)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'That image could not be used.'); }
  };
  return (
    <Field label={label} hint={hint} error={err || undefined}>
      <div className="logo-row">
        {value
          ? <img className="logo-preview" src={value} alt="" />
          : <span className="logo-empty">No logo</span>}
        <div className="row">
          <button type="button" className="btn" onClick={() => input.current?.click()}>
            {value ? 'Replace' : 'Choose image'}
          </button>
          {value ? <button type="button" className="btn ghost" onClick={() => onChange('')}>Remove</button> : null}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
          onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
    </Field>
  );
}


export function BrandingForm({ branding, onChange }: {
  branding: Branding; onChange: (b: Branding) => void;
}) {
  const set = <K extends keyof Branding>(key: K, value: Branding[K]) => onChange({ ...branding, [key]: value });
  const text = (key: keyof Branding, label: string, hint?: string, placeholder?: string) => (
    <Field key={key} label={label} hint={hint}>
      <input value={String(branding[key] ?? '')} placeholder={placeholder}
        onChange={e => set(key, e.target.value as Branding[typeof key])} />
    </Field>
  );
  return (
    <div className="stack">
      <div className="grid2">
        {text('eventTitle', 'Event title', 'Leave empty to use the tournament name.', 'e.g. Winter Cup')}
        {text('subtitle', 'Competition line', 'e.g. City Chess Championship', 'Optional second line')}
        {text('edition', 'Season / edition', 'e.g. 2026/27 · Season 3 · Play-offs', 'Optional')}
        <Field label="Accent colour" hint="Used for headings, rules and table headers.">
          <div className="row">
            <input type="color" className="color-input" aria-label="Accent colour"
              value={isHexColor(branding.accent) ? branding.accent : DEFAULT_BRANDING.accent}
              onChange={e => set('accent', e.target.value)} />
            <input className="hex-input" value={branding.accent} aria-label="Accent colour hex value"
              onChange={e => set('accent', e.target.value)} />
          </div>
        </Field>
      </div>
      {text('headerNote', 'Header line', 'Small line under the title, e.g. the organiser or a contact.', 'Organised by …')}
      {text('footerNote', 'Footer text', 'Repeated at the bottom of every page.', 'e.g. Results are provisional until confirmed.')}
      <Field label="Notes / disclaimer" hint="Printed in their own block at the end of the document.">
        <textarea rows={3} value={branding.notes} placeholder="e.g. Ties are broken by head-to-head, then by wins."
          onChange={e => set('notes', e.target.value)} />
      </Field>
      <LogoField label="Event logo" hint="Shown at the top of every page." value={branding.logoDataUrl}
        onChange={v => set('logoDataUrl', v)} />
      <LogoField label="Sponsor logo" hint="Optional. Shown opposite the event logo." value={branding.sponsorDataUrl}
        onChange={v => set('sponsorDataUrl', v)} />
      <div className="stack">
        <Switch checked={branding.showVenueDate} label="Show venue and dates"
          hint="Adds the tournament dates and location under the title." onChange={v => set('showVenueDate', v)} />
        <Switch checked={branding.showAdvancedStats} label="Extra statistics"
          hint="Adds the Buchholz tie-break column to standings." onChange={v => set('showAdvancedStats', v)} />
        <Switch checked={branding.compactStandings} label="Compact table"
          hint="Fewer columns — fits narrow paper and quick one-off events." onChange={v => set('compactStandings', v)} />
      </div>
    </div>
  );
}
