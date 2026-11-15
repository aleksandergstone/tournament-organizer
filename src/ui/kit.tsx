// Shared UI primitives.
//
// Every screen builds from these so headings, buttons, panels, tables, alerts
// and empty states look and behave the same everywhere. Nothing here knows
// about tournament rules — presentation only.
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useT } from '../i18n';
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


export function Field({ label, hint, error, required, children, className = '', field }: {
  label: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean;
  children: ReactNode; className?: string;
  /** The rule field this control edits, so a test can see exactly what is shown. */
  field?: string;
}) {
  return (
    <label className={'f ' + className} data-field={field}>
      <span className="f-label">{label}{required ? <span className="req" aria-hidden> *</span> : null}</span>
      <span className="f-ctl">{children}</span>
      {hint && !error ? <span className="f-hint">{hint}</span> : null}
      {error ? <span className="f-err" role="alert">{error}</span> : null}
    </label>
  );
}

/**
 * A quiet collapsible section: one row saying what is inside, opened only when
 * the organizer asks for it.
 *
 * Every "not the main task" block on every screen uses this, so "collapsed by
 * default" looks and behaves the same everywhere instead of being re-invented
 * per screen. The summary states what will be revealed, because a closed row
 * that says nothing is indistinguishable from missing content.
 *
 * The content stays in the DOM when closed. That is what lets the mode contract
 * hold: a field a mode declares still has exactly one place on the page.
 */
export function Collapse({ title, sub, children, className = '', defaultOpen = false }: {
  title: ReactNode; sub?: ReactNode; children: ReactNode;
  className?: string;
  /** Only for the rare case where the collapsed content is the point. */
  defaultOpen?: boolean;
}) {
  return (
    <details className={'collapse' + (className ? ' ' + className : '')} open={defaultOpen}>
      <summary>
        <span className="collapse-caret" aria-hidden />
        <span className="collapse-text">
          <b>{title}</b>
          {sub ? <span className="collapse-sub">{sub}</span> : null}
        </span>
      </summary>
      <div className="collapse-body">{children}</div>
    </details>
  );
}

export function Switch({ checked, onChange, label, hint, field, disabled }: {
  checked: boolean; onChange(v: boolean): void; label: ReactNode; hint?: ReactNode;
  /** The rule field this switch edits, so a test can see exactly what is shown. */
  field?: string;
  /** Present but not applicable: it stays visible, and explains itself. */
  disabled?: boolean;
}) {
  return (
    <label className="switch" data-field={field}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
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
  tbd:         { key: 'status.tbd',         tone: 'info' },
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

/* ------------------------------------------------------------------ button */

export interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  primary?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ children, onClick, className = '', disabled, type = 'button', primary, size = 'md' }: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn ${primary ? 'btn-primary' : ''} btn-${size} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ input */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  field?: string;
}

export function Input({ label, hint, error, className = '', field, children, ...props }: InputProps & { children?: never }) {
  return (
    <div className={`field ${className}`} data-field={field}>
      {label && <label>{label}</label>}
      <input {...props} className="input" />
      {hint && <span className="hint">{hint}</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ select */

export interface SelectOption {
  id: string;
  label: string;
}

export interface SelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption[];
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  className?: string;
  field?: string;
}

export function Select<T extends string>({ value, onChange, options, label, hint, error, disabled, className = '', field }: SelectProps<T>) {
  return (
    <div className={`field ${className}`} data-field={field}>
      {label && <label>{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        disabled={disabled}
        className="select"
      >
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      {hint && <span className="hint">{hint}</span>}
      {error && <span className="error">{error}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ badge */

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'err' | 'info' | 'success';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = 'neutral', className = '' }: BadgeProps) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

/* ------------------------------------------------------------------ tabs */

export interface TabOption {
  id: string;
  label: string;
}

export interface TabsProps {
  active: string;
  onChange: (id: string) => void;
  tabs: TabOption[];
  className?: string;
}

export function Tabs({ active, onChange, tabs, className = '' }: TabsProps) {
  return (
    <div className={`tabs ${className}`} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          aria-selected={tab.id === active}
          className={`tab ${tab.id === active ? 'on' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ modal */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className = '' }: ModalProps) {
  if (!open) return null;
  return (
    <div className={`modal-overlay ${className}`} onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {title && <header className="modal-header"><h2>{title}</h2></header>}
        <div className="modal-body">{children}</div>
        <footer className="modal-footer">
          <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ table */

export interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return <table className={`table ${className}`}>{children}</table>;
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

/* ------------------------------------------------------------- rich text editor */

/**
 * A small rich-text editor built on a contenteditable div. Produces HTML that
 * can be stored as the regulation body and rendered directly in documents.
 * No external dependencies — plain execCommand plus a file picker for images.
 */
export interface RichTextEditorProps {
  value: string;
  onChange(html: string): void;
  label?: ReactNode;
  hint?: ReactNode;
  className?: string;
}

export function RichTextEditor({ value, onChange, label, hint, className = '' }: RichTextEditorProps) {
  const t = useT();
  const editorRef = useRef<HTMLDivElement>(null);
  const [imgErr, setImgErr] = useState('');

  const format = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value ?? '');
    editorRef.current?.focus();
    emit();
  };

  const insertImage = async (file: File) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
      setImgErr(t('brand.errType')); return;
    }
    if (file.size > 12 * 1024 * 1024) { setImgErr(t('brand.errSize')); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result ?? ''));
      fr.onerror = () => reject(new Error('Cannot read image'));
      fr.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image(); el.onload = () => resolve(el); el.onerror = reject; el.src = dataUrl;
    });
    for (const width of [800, 600, 400, 280]) {
      if (img.width <= width) break;
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = Math.round((img.height / img.width) * width);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.85);
      if (out.length <= 400 * 1024) {
        document.execCommand('insertImage', false, out);
        editorRef.current?.focus();
        emit();
        return;
      }
    }
    setImgErr(t('brand.errTooDetailed'));
  };

  const emit = () => {
    const html = editorRef.current?.innerHTML ?? '';
    if (html !== value) onChange(html);
  };

  const pickImage = (input: HTMLInputElement | null) => {
    setImgErr('');
    input?.click();
  };

  return (
    <div className={'rich-editor ' + className}>
      {label && <div className="rich-label">{label}</div>}
      {hint && <span className="f-hint">{hint}</span>}
      <div className="rich-toolbar">
        <button type="button" title={t('rich.bold')} onClick={() => format('bold')}>B</button>
        <button type="button" title={t('rich.italic')} onClick={() => format('italic')}>I</button>
        <button type="button" title={t('rich.heading1')} onClick={() => format('formatBlock', '<h1>')}>H1</button>
        <button type="button" title={t('rich.heading2')} onClick={() => format('formatBlock', '<h2>')}>H2</button>
        <button type="button" title={t('rich.ulist')} onClick={() => format('insertUnorderedList')}>⬤</button>
        <button type="button" title={t('rich.olist')} onClick={() => format('insertOrderedList')}>1.</button>
        <button type="button" title={t('rich.link')} onClick={() => {
          const url = window.prompt(t('rich.urlPrompt'));
          if (url) format('createLink', url);
        }}>🔗</button>
        <button type="button" title={t('rich.alignLeft')} onClick={() => format('justifyLeft')}>↔</button>
        <button type="button" title={t('rich.alignCenter')} onClick={() => format('justifyCenter')}>⌐</button>
        <button type="button" title={t('rich.alignRight')} onClick={() => format('justifyRight')}>↔</button>
        <button type="button" title={t('rich.image')} onClick={() => pickImage(document.getElementById('rich-img-input') as HTMLInputElement)}>🖼</button>
        <input id="rich-img-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) { void insertImage(f); } e.target.value = ''; }} />
        {imgErr && <span className="f-err">{imgErr}</span>}
      </div>
      <div className="rich-area" ref={editorRef}
        contentEditable={true}
        onInput={emit}
        onBlur={emit}
        dangerouslySetInnerHTML={{ __html: value }}
        spellCheck={false} />
    </div>
  );
}
