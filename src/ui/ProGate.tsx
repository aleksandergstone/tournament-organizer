// The gate: one honest answer to "can this install use this?".
//
// Everything here reads has(), which reads the verified license. A component
// cannot decide for itself that it is unlocked, and the children are never
// rendered while locked — so nothing behind the gate runs, not even to decide
// it should.
//
// Three things are always true of the locked state:
//   * the feature stays visible and named — not hidden, not greyed into looking
//     broken;
//   * it says what the feature is and that it is a paid add-on;
//   * it offers a way forward, so there is never a button that does nothing.
import type { ReactNode } from 'react';
import { entryOf, has } from '../engine/features';
import { useT, type Dict } from '../i18n';
import { useApp } from '../state/store';

/** A small "Pro" pill for inline use next to a feature name. */
export function ProBadge() {
  return <span className="pro-badge">Pro</span>;
}

/**
 * Wraps a Pro feature. Renders its children untouched when the license allows
 * it, and an explanation with an upgrade path when it does not.
 */
export default function ProGate({ featureId, children }: { featureId: string; children: ReactNode }) {
  const { go } = useApp();
  const t = useT();
  if (has(featureId)) return <>{children}</>;

  // The registry carries a translated label where one exists; the English name is
  // the honest fallback rather than showing a raw key.
  const entry = entryOf(featureId);
  const name = entry?.label ? t(entry.label as keyof Dict) : entry?.name ?? '';

  return (
    <div className="pro-locked" role="note">
      <p className="pro-locked-title">
        {name ? <><b>{name}</b> — </> : null}
        {t('lic.lockedTitle')}
      </p>
      <p className="f-hint">{t('lic.lockedHint')}</p>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={() => go('license')}>{t('lic.buy')}</button>
        <button className="btn quiet" onClick={() => go('license')}>{t('lic.title')}</button>
      </div>
    </div>
  );
}