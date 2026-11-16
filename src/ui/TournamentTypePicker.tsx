import { useApp } from '../state/store';
import { useT, type Dict } from '../i18n';
import { useState } from 'react';

type TournamentKind = 'universal' | 'sailing' | 'other';

const KINDS: {
  id: TournamentKind;
  icon: string;
  title: string;
  desc: string;
  purpose: string;
  disabled: boolean;
}[] = [
  {
    id: 'universal',
    icon: '🏆',
    title: 'home.typeUniversal',
    desc: 'home.typeUniversalHint',
    purpose: 'home.typeUniversalPurpose',
    disabled: false,
  },
  {
    id: 'sailing',
    icon: '⛵',
    title: 'home.typeSailing',
    desc: 'home.typeSailingHint',
    purpose: 'home.typeSailingPurpose',
    disabled: true,
  },
  {
    id: 'other',
    icon: '…',
    title: 'home.typeOther',
    desc: 'home.typeOtherHint',
    purpose: 'home.typeOtherPurpose',
    disabled: true,
  },
];

export default function TournamentTypePicker() {
  const { go } = useApp();
  const t = useT();
  const [selected, setSelected] = useState<TournamentKind | null>('universal');

  const entry = KINDS.find(k => k.id === selected)!;
  const canContinue = selected !== null && !entry.disabled;

  return (
    <div className="type-picker">
      <header className="type-head">
        <div className="type-head-text">
          <h1>{t('home.newTournament')}</h1>
          <p className="type-sub">{t('home.pickTypeSub')}</p>
        </div>
      </header>

      <div className="type-grid">
        {KINDS.map(k => (
          <button
            key={k.id}
            className={`type-card ${selected === k.id ? 'type-card-selected' : ''} ${
              k.disabled ? 'type-card-disabled' : ''
            }`}
            onClick={() => {
              if (!k.disabled) setSelected(k.id);
            }}
            aria-selected={selected === k.id}
            disabled={k.disabled}
          >
            <span className="type-icon">{k.icon}</span>
            <div className="type-body">
              <h3>{t(k.title as keyof Dict)}</h3>
              <p className="type-desc">{t(k.desc as keyof Dict)}</p>
              <p className="type-purpose">{t(k.purpose as keyof Dict)}</p>
            </div>
            {selected === k.id && !k.disabled && <span className="type-check">✓</span>}
          </button>
        ))}
      </div>

      <div className="type-foot">
        <button className="btn" onClick={() => go('home')}>
          {t('typePicker.back')}
        </button>
        <span className="sp" />
        <button className="btn primary" onClick={() => go('wizard')} disabled={!canContinue}>
          {t('typePicker.next')}
        </button>
      </div>
    </div>
  );
}
