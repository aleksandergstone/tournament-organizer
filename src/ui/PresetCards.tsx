// Preset cards — shown only after a discipline and a structure are chosen.
// Each card explains in one line what it generates and why it is worth picking.
import { presetsFor, type Preset } from '../engine/presets';
import { useT } from '../i18n';

export interface PresetCardProps {
  format: string;
  onSelect: (p: Preset) => void;
  /** The discipline id, passed to presetsFor to filter to that sport. */
  discipline?: string | null;
}

export function PresetCards({ format, onSelect, discipline }: PresetCardProps) {
  const t = useT();
  const all = presetsFor(format);
  const list = discipline
    ? all.filter((p) => p.format === format)
    : all;

  if (list.length === 0) {
    return <p className="muted">No preset for this shape.</p>;
  }

  return (
    <div className="preset-grid">
      {list.map((p) => (
        <div key={p.id} className="preset-card">
          <header className="preset-head">
            <b>{t(p.label)}</b>
            <span className="chip">{p.level}</span>
          </header>
          <dl className="preset-list">
            <div><dt>{t('mode.presetWhat')}</dt><dd>{t(p.what)}</dd></div>
            <div><dt>{t('mode.presetWhy')}</dt><dd>{t(p.why)}</dd></div>
            <div><dt>{t('mode.presetFits')}</dt><dd>{t(p.fits)}</dd></div>
            <div><dt>{t('mode.presetGenerates')}</dt><dd>{t(p.generates)}</dd></div>
          </dl>
          <button type="button" className="btn" onClick={() => onSelect(p)}>{t('preset.apply')}</button>
        </div>
      ))}
    </div>
  );
}
