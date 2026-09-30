// A gate that asks the license engine and renders one honest answer.
import type { ReactNode } from 'react';
import { has } from '../engine/features';
import { useT } from '../i18n';
import { useApp } from '../state/store';
import { Empty } from './kit';

/**
 * Wraps a Pro feature. The answer comes from has(), which reads the verified
 * license — a component cannot decide for itself that it is unlocked, and the
 * children are never rendered while locked, so nothing behind the gate can run.
 */
export default function ProGate({ featureId, children }: { featureId: string; children: ReactNode }) {
  const { go } = useApp();
  const t = useT();
  if (has(featureId)) return <>{children}</>;
  return (
    <Empty
      title={t('lic.lockedTitle')}
      hint={t('lic.lockedHint')}
      action={<button className="btn primary" onClick={() => go('license')}>{t('lic.buy')}</button>}
    />
  );
}