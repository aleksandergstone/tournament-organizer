// A small, quiet, optional invitation to support the project.
//
// Rules this component keeps, because they are easy to break by accident:
//   * it never renders on its own schedule — the caller decides where it goes,
//     and that is only ever a Home or Settings placement;
//   * it is not a modal, it does not trap focus, and it cannot block a click
//     outside itself;
//   * dismissing it is one click and stays dismissed;
//   * with no support URL configured it renders nothing at all.
import { useState } from 'react';
import {
  SUPPORT_URL, dismissSupport, isSupportConfigured, resetSupport, shouldShowSupport,
} from '../support';
import { useT } from '../i18n';
import { desktop } from '../engine/desktop';

/** localStorage is absent in some shells; the banner must not care. */
function store() {
  return {
    getItem: (k: string) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(k)),
    setItem: (k: string, v: string) => { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); },
    removeItem: (k: string) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); },
  };
}

export default function SupportBanner({ compact = false }: { compact?: boolean }) {
  const t = useT();
  // No URL configured means no banner. A placeholder would only read as a
  // broken purchase button.
  const [configured] = useState(isSupportConfigured);
  const [hidden, setHidden] = useState(() => !shouldShowSupport(store()));
  if (!configured || hidden) return null;

  const open = () => {
    // The system browser. The app never navigates itself to a donation page.
    void desktop.openExternal(SUPPORT_URL).catch(() => { /* a closed browser is not worth an alert */ });
  };
  const close = () => {
    dismissSupport(store());
    setHidden(true);
  };

  return (
    <aside className={'support-note' + (compact ? ' compact' : '')}>
      <p className="support-text">
        <b>{t('support.title')}</b>
        <span className="support-desc">{t('support.desc')}</span>
      </p>
      <span className="support-acts">
        <button className="btn tiny" onClick={open}>{t('support.button')}</button>
        <button className="btn tiny quiet" onClick={close} aria-label={t('support.dismiss')}>
          {t('support.dismiss')}
        </button>
        <span className="support-optional">{t('support.optional')}</span>
      </span>
    </aside>
  );
}

/** Settings uses this to let someone undo a dismissal. */
export function ResetSupportButton() {
  const t = useT();
  return (
    <button className="btn quiet" onClick={() => { resetSupport(store()); }}>
      {t('support.showAgain')}
    </button>
  );
}