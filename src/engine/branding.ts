// Document branding — what makes an exported sheet look like *this* event's
// paperwork instead of a generic table.
//
// Pure data + normalization only: no DOM, no I/O, no formatting decisions.
// Stored on the tournament, so it travels with the project file and over LAN
// sync. Old project files simply have no branding and fall back to defaults.
import { Tournament } from './types';

/** How dates are printed on documents. */
export const DATE_STYLES = ['locale', 'dayMonth', 'monthDay', 'iso'] as const;
export type DateStyle = typeof DATE_STYLES[number];
/** How clock times are printed on documents. */
export const TIME_STYLES = ['h24', 'h12'] as const;
export type TimeStyle = typeof TIME_STYLES[number];

/**
 * The regulations of the event. Kept apart from `notes` because a regulation is
 * structured (a title plus a body) and gets its own tab, its own document and a
 * much longer character budget than the printer's notes block.
 */
export interface Regulation {
  /** Heading used in documents. Empty = the built-in label. */
  title: string;
  /** The rules themselves — much longer than any other branded text. */
  body: string;
  /** Also print the regulation inside the pack and the results document. */
  includeInDocs: boolean;
}

export interface Branding {
  /** Main line on every page. Falls back to the tournament name. */
  eventTitle: string;
  /** Competition line under the title, e.g. "Winter League 2026/27". */
  subtitle: string;
  /** Season / round / edition label, e.g. "Season 3 · Play-offs". */
  edition: string;
  /** Logo shown at the top (data URL). Empty string = no logo. */
  logoDataUrl: string;
  /** Optional sponsor logo, shown right-aligned next to the event logo. */
  sponsorDataUrl: string;
  /** Small line under the header block (organiser, contact…). */
  headerNote: string;
  /** Repeated at the bottom of every page. */
  footerNote: string;
  /** Printed block near the end: notes, disclaimer. */
  notes: string;
  /** Accent colour for rules, headers and highlights (#rrggbb). */
  accent: string;
  /** Show venue and date on the header line. */
  showVenueDate: boolean;
  /** Extra columns in standings (Buchholz, seed). */
  showAdvancedStats: boolean;
  /** Fewer columns — fits narrow paper and casual one-off events. */
  compactStandings: boolean;
  /**
   * Overrides for the built-in document names. Empty = the built-in label.
   * Lets an organiser print "Klasyfikacja" where the app would print "Table".
   */
  titleStandings: string;
  titleMatches: string;
  titleSchedule: string;
  titleBracket: string;
  titleGroups: string;
  /** Document title in the window and the file metadata. Empty = event title. */
  docTitle: string;
  /** Base name for saved files. Empty = a slug of the event title. */
  fileName: string;
  /** Date style printed on documents. */
  dateFormat: DateStyle;
  /** Clock style printed on documents. */
  timeFormat: TimeStyle;
  /** Regulations printed in generated documents (own tab, own document). */
  regulation: Regulation;
}

export const DEFAULT_ACCENT = '#1f5eff';

/** Logos are embedded in the project file; keep them small. */
export const MAX_LOGO_BYTES = 400 * 1024;

/** Regulations are long; `clean()` must not silently cut them at 1200 chars. */
export const MAX_REGULATION_CHARS = 5000;

export const DEFAULT_REGULATION: Regulation = {
  title: '',
  body: '',
  includeInDocs: true,
};

export const DEFAULT_BRANDING: Branding = {
  eventTitle: '',
  subtitle: '',
  edition: '',
  logoDataUrl: '',
  sponsorDataUrl: '',
  headerNote: '',
  footerNote: '',
  notes: '',
  accent: DEFAULT_ACCENT,
  showVenueDate: true,
  showAdvancedStats: false,
  compactStandings: false,
  titleStandings: '',
  titleMatches: '',
  titleSchedule: '',
  titleBracket: '',
  titleGroups: '',
  docTitle: '',
  fileName: '',
  dateFormat: 'locale',
  timeFormat: 'h24',
  regulation: DEFAULT_REGULATION,
};

const TEXT_LIMITS: Record<string, number> = {
  eventTitle: 120, subtitle: 160, edition: 80,
  headerNote: 200, footerNote: 200, notes: 1200,
  titleStandings: 60, titleMatches: 60, titleSchedule: 60,
  titleBracket: 60, titleGroups: 60, docTitle: 160, fileName: 60,
  regulationTitle: 120,
};

function clean(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  // Strip control characters, collapse whitespace, trim, cap the length.
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Like `clean`, but keeps line breaks: a regulation is usually a numbered list,
 * and flattening it onto one line would make the printed rules unreadable.
 */
function cleanLong(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ')
    .split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim());
}

/** Only inline images are accepted — a file path would break the PDF. */
export function isImageDataUrl(v: unknown): v is string {
  return typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/.test(v.trim());
}

/** Never throws: any bad field falls back to its default. */
export function normalizeBranding(input?: Partial<Branding> | null): Branding {
  const b = (input ?? {}) as Partial<Branding>;
  const pick = (key: keyof typeof TEXT_LIMITS): string => clean(b[key as keyof Branding], TEXT_LIMITS[key]);
  const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
  const reg = (b.regulation ?? {}) as Partial<Regulation>;
  return {
    eventTitle: pick('eventTitle'),
    subtitle: pick('subtitle'),
    edition: pick('edition'),
    logoDataUrl: isImageDataUrl(b.logoDataUrl) ? b.logoDataUrl.trim() : '',
    sponsorDataUrl: isImageDataUrl(b.sponsorDataUrl) ? b.sponsorDataUrl.trim() : '',
    headerNote: pick('headerNote'),
    footerNote: pick('footerNote'),
    notes: pick('notes'),
    accent: isHexColor(b.accent) ? b.accent.trim().toLowerCase() : DEFAULT_ACCENT,
    showVenueDate: bool(b.showVenueDate, DEFAULT_BRANDING.showVenueDate),
    showAdvancedStats: bool(b.showAdvancedStats, DEFAULT_BRANDING.showAdvancedStats),
    compactStandings: bool(b.compactStandings, DEFAULT_BRANDING.compactStandings),
    titleStandings: pick('titleStandings'),
    titleMatches: pick('titleMatches'),
    titleSchedule: pick('titleSchedule'),
    titleBracket: pick('titleBracket'),
    titleGroups: pick('titleGroups'),
    docTitle: pick('docTitle'),
    fileName: pick('fileName'),
    dateFormat: oneOf(b.dateFormat, DATE_STYLES, DEFAULT_BRANDING.dateFormat),
    timeFormat: oneOf(b.timeFormat, TIME_STYLES, DEFAULT_BRANDING.timeFormat),
    regulation: {
      title: clean(reg.title, TEXT_LIMITS.regulationTitle),
      body: cleanLong(reg.body, MAX_REGULATION_CHARS),
      includeInDocs: bool(reg.includeInDocs, DEFAULT_REGULATION.includeInDocs),
    },
  };
}

/** Title used for the printed document and the file metadata. */
export function documentTitle(b: Branding, fallback: string): string {
  return b.docTitle.trim() || fallback;
}

/** Organiser-supplied file base name, or '' to fall back to the event slug. */
export function fileBaseName(b: Branding): string {
  return b.fileName.trim();
}

/** True when there is a regulation worth printing. */
export function hasRegulation(b: Branding): boolean {
  return b.regulation.body.trim().length > 0;
}

/** Branding for a tournament: stored values, with the name as title fallback. */
export function brandingOf(t: Pick<Tournament, 'name' | 'branding'>): Branding {
  const b = normalizeBranding(t.branding);
  if (!b.eventTitle) b.eventTitle = clean(t.name, TEXT_LIMITS.eventTitle);
  return b;
}

export function hasAnyLogo(b: Branding): boolean {
  return !!b.logoDataUrl || !!b.sponsorDataUrl;
}
