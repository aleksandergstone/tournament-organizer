// Localization — one source of truth for every user-facing string.
//
// Design notes:
//  - English is canonical (`en.ts`); the other dictionaries are typed as
//    `Dict = typeof en`, so a missing or misspelled key fails the build instead
//    of leaking a raw key into the UI.
//  - Lookup never throws: unknown key → English → the key itself. A translation
//    gap can never blank a screen.
//  - The active locale is module state so non-React code (the engine, the PDF
//    renderer) can translate too, and `useT()` re-renders components the moment
//    the language changes — no reload, no internet.
import { useSyncExternalStore } from 'react';
import { en, type Dict } from './en';
import { pl } from './pl';
import { de } from './de';
import { es } from './es';

export type { Dict };
export type Locale = 'en' | 'pl' | 'de' | 'es';
/** Stored preference: a concrete language, or "follow the system". */
export type LocalePreference = Locale | 'system';

export const LOCALES: Locale[] = ['en', 'pl', 'de', 'es'];

/** Endonyms: a language switch must be readable to the person who needs it. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English', pl: 'Polski', de: 'Deutsch', es: 'Español',
};

const DICTS: Record<Locale, Dict> = { en, pl, de, es };

/**
 * Region per language for date formatting. English is pinned to en-GB so dates
 * read "14 Mar 2026" — day first, as the app has always printed them.
 */
export const INTL_LOCALES: Record<Locale, string> = {
  en: 'en-GB', pl: 'pl-PL', de: 'de-DE', es: 'es-ES',
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as string[]).includes(v);
}

/**
 * System language → a supported one: "pl-PL" → "pl", "de-AT" → "de".
 * Anything unsupported falls back to English.
 */
export function localeFromTag(tag?: string | null): Locale {
  const base = (tag ?? '').toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : 'en';
}

/** The language to start with before the stored preference is known. */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    const base = (tag ?? '').toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return 'en';
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole);
}

/** Pure lookup. Safe for tests, the PDF renderer and engine messages. */
export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const dict = DICTS[locale] ?? DICTS.en;
  const value = (dict as Record<string, string>)[key]
    ?? (DICTS.en as Record<string, string>)[key];
  // Unknown key: show the key itself rather than an empty label.
  return value === undefined ? key : interpolate(value, params);
}

// ---- active locale (module state, so the engine can translate too) --------

let active: Locale = 'en';
const listeners = new Set<() => void>();

export function getLocale(): Locale { return active; }

/**
 * Keeps the document's own language in step with the app: screen readers, the
 * spell-checker and hyphenation all follow `lang`. A no-op outside the browser,
 * so the engine and the tests are unaffected.
 */
function syncDocumentLanguage(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = INTL_LOCALES[locale] ?? locale;
}

/** Called by the store when the preference changes; notifies React. */
export function setLocale(locale: Locale): void {
  if (!isLocale(locale)) return;
  syncDocumentLanguage(locale);
  if (locale === active) return;
  active = locale;
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Resolves the stored preference ("system" included) to a language. */
export function resolveLocale(pref: LocalePreference | null | undefined): Locale {
  return pref === 'system' || !isLocale(pref) ? detectLocale() : pref;
}

export type Translate = (key: keyof Dict & string, params?: Record<string, string | number>) => string;

/** Component hook: a `t` bound to the current language, re-created on change. */
export function useT(): Translate {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  return (key, params) => translate(locale, key, params);
}

/** Non-React lookup (engine, PDF). Reads the locale at call time. */
export const t: Translate = (key, params) => translate(active, key, params);
