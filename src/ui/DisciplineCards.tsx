// Discipline cards — first screen of the creation flow.
// One tap per sport: the cards name the vocabulary and pre-fill the starting rules,
// so nothing is hidden and nothing is dumped.
import { DISCIPLINES, disciplineById, templateDefaultsLine } from '../engine/discipline';
import { useT } from '../i18n';

export interface DisciplineCardChoice {
  id: string;
  label: string;
  /** The short sentence shown on the card. */
  sentence: string;
  /** What the card affects, as short tags. */
  affects: string[];
  /** A one-line example shown under the sentence. */
  example: string;
}

/** Pick one card and get its sentence, tags and example. */
export function DisciplineCards({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const t = useT();

  const cards = DISCIPLINES.map((d) => {
    const disc = disciplineById(d.id);
    if (!disc) return null;
    return {
      id: d.id,
      label: t(d.label),
      sentence: t(disc.hint),
      affects: [
        t(disc.venue),
        t(disc.participant),
        t(disc.match),
      ],
      example: templateDefaultsLine(disc, t) ?? '',
    };
  }).filter(Boolean) as DisciplineCardChoice[];

  return (
    <div className="mode-grid">
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          className={'mode-card' + (c.id === value ? ' on' : '')}
          onClick={() => onChange(c.id)}
          aria-pressed={c.id === value}
        >
          <span className="mode-card-name">{c.label}</span>
          <span className="mode-card-meaning">{c.sentence}</span>
          <span>
            {c.affects.map((a) => (
              <span key={a} className="chip">{a}</span>
            ))}
          </span>
          {c.example ? <span className="mode-card-meaning">{c.example}</span> : null}
        </button>
      ))}
    </div>
  );
}
