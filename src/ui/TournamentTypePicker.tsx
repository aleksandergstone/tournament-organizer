import { useApp } from '../state/store';
import { useT } from '../i18n';
import { Panel } from './kit';

type TournamentKind = 'universal' | 'sailing' | 'soon';

export default function TournamentTypePicker() {
  const { go } = useApp();
  const t = useT();

  return (
    <Panel title={t('home.new')} sub={t('home.pickTypeSub')}>
      <div className="tile-grid tile-grid-type">
        {/* Uniwersalny turniej */}
        <button className="tile tile-primary" onClick={() => go('wizard')}>
          <span className="tile-icon">🏆</span>
          <div className="tile-body">
            <h3>{t('home.typeUniversal')}</h3>
            <p className="tile-hint">{t('home.typeUniversalHint')}</p>
          </div>
        </button>

        {/* Regaty / sailing – wkrótce */}
        <button className="tile tile-soon" disabled aria-disabled="true">
          <span className="tile-badge">SOON</span>
          <span className="tile-icon">⛵</span>
          <div className="tile-body">
            <h3>{t('home.typeSailing')}</h3>
            <p className="tile-hint">{t('home.typeSailingHint')} — {t('soon')}</p>
          </div>
        </button>

        {/* Inne tryby – wkrótce */}
        <button className="tile tile-soon" disabled aria-disabled="true">
          <span className="tile-badge">SOON</span>
          <span className="tile-icon">…</span>
          <div className="tile-body">
            <h3>{t('home.typeOther')}</h3>
            <p className="tile-hint">{t('home.typeOtherHint')}</p>
          </div>
        </button>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => go('home')}>{t('common.back')}</button>
      </div>
    </Panel>
  );
}
