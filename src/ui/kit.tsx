// Shared UI primitives.
//
// Every screen builds from these so headings, buttons, panels, tables, alerts
// and empty states look and behave the same everywhere. Nothing here knows
// about tournament rules — presentation only.
import type { ReactNode } from 'react';
import { t } from '../i18n';
import type { Dict } from '../i18n';

export type Tone = 'neutral' | 'ok' | 'warn' | 'err' | 'info';

/* ------------------------------------------------------------------ page */

export function Page({ title, sub, actions, children }: {
  title: string; sub?: ReactNode; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="wrap">
      <header className="page-head">
        <div className="page-head-text">
          <h1>{title}</h1>
          {sub ? <p className="page-sub">{sub}</p> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

/** Simple "step 1 of 3" progress for the creation flow. */
export function StepBar({ items, current }: { items: string[]; current: number }) {
  return (
    <ol className="steps" aria-label={t('nav.progress')}>
      {items.map((label, i) => (
        <li key={label} className={i === current ? 'on' : i < current ? 'done' : ''}>
          <span className="step-n">{i < current ? '\u2713' : i + 1}</span>{label}
        </li>
      ))}
    </ol>
  );
}

/* ----------------------------------------------------------------- panel */

export function Panel({ title, sub, actions, children, className = '' }: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={'card ' + className}>
      {title || actions ? (
        <header className="panel-head">
          <div className="panel-head-text">
            {title ? <h2>{title}</h2> : null}
            {sub ? <p className="panel-sub">{sub}</p> : null}
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- alerts */

export function Alert({ tone = 'info', title, children, actions }: {
  tone?: Tone; title?: ReactNode; children?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className={'alert alert-' + tone} role={tone === 'err' ? 'alert' : 'status'}>
      <div className="alert-body">
        {title ? <b>{title}</b> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {actions ? <div className="alert-actions">{actions}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- forms */

/* ---------------------------------------------------------- empty states */

export function Empty({ title, hint, action }: { title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {hint ? <p className="empty-hint">{hint}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}


export function Field({ label, hint, error, required, children, className = '' }: {
  label: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean;
  children: ReactNode; className?: string;
}) {
  return (
    <label className={'f ' + className}>
      <span className="f-label">{label}{required ? <span className="req" aria-hidden> *</span> : null}</span>
      <span className="f-ctl">{children}</span>
      {hint && !error ? <span className="f-hint">{hint}</span> : null}
      {error ? <span className="f-err" role="alert">{error}</span> : null}
    </label>
  );
}

export function Switch({ checked, onChange, label, hint }: {
  checked: boolean; onChange(v: boolean): void; label: ReactNode; hint?: ReactNode;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="switch-box" aria-hidden />
      <span className="switch-text">
        <b>{label}</b>
        {hint ? <span className="f-hint">{hint}</span> : null}
      </span>
    </label>
  );
}

/* --------------------------------------------------------- segmented tabs */

export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange(v: T): void; options: { id: T; label: string }[]; label?: string;
}) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map(o => (
        <button key={o.id} role="tab" type="button" aria-selected={o.id === value}
          className={o.id === value ? 'seg-btn on' : 'seg-btn'} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- status pill */

// Statuses are a fixed, small set: the tone decides the colour, the key is
// translated — a new language never needs a new engine value.
const STATUS: Record<string, { key: keyof Dict & string; tone: Tone }> = {
  scheduled:   { key: 'status.scheduled',   tone: 'neutral' },
  played:      { key: 'status.played',      tone: 'ok' },
  draw:        { key: 'status.draw',        tone: 'ok' },
  overtime:    { key: 'status.overtime',    tone: 'ok' },
  walkover:    { key: 'status.walkover',    tone: 'warn' },
  unfinished:  { key: 'status.unfinished',  tone: 'warn' },
  interrupted: { key: 'status.interrupted', tone: 'warn' },
  bye:         { key: 'status.bye',         tone: 'neutral' },
};

/** Human-readable match state in the active language — never the engine value. */
export function statusLabel(status: string): string {
  const s = STATUS[status];
  return s ? t(s.key) : status;
}
export function statusTone(status: string): Tone { return STATUS[status]?.tone ?? 'neutral'; }

/** Human-readable match state — never the raw engine value. */
export function StatusPill({ status }: { status: string }) {
  return <span className={'pill pill-' + statusTone(status)}>{statusLabel(status)}</span>;
}

/* ------------------------------------------------------------------ misc */

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="toolbar">{children}</div>;
}

export function KeyHint({ children }: { children: ReactNode }) {
  return <p className="keyhint">{children}</p>;
}

export function Meta({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="meta">
      {items.map(i => (
        <div key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd></div>
      ))}
    </dl>
  );
}
