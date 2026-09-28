// Document branding — what makes an exported sheet look like *this* event's
// paperwork instead of a generic table.
//
// Pure data + normalization only: no DOM, no I/O, no formatting decisions.
// Stored on the tournament, so it travels with the project file and over LAN
// sync. Old project files simply have no branding and fall back to defaults.
import { Tournament } from './types';

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
  /** Printed block near the end: notes, disclaimer, regulations. */
  notes: string;
  /** Accent colour for rules, headers and highlights (#rrggbb). */
  accent: string;
  /** Show venue and date on the header line. */
  showVenueDate: boolean;
  /** Extra columns in standings (Buchholz, seed). */
  showAdvancedStats: boolean;
  /** Fewer columns — fits narrow paper and casual one-off events. */
  compactStandings: boolean;
}

export const DEFAULT_ACCENT = '#1f5eff';

/** Logos are embedded in the project file; keep them small. */
export const MAX_LOGO_BYTES = 400 * 1024;

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
};

const TEXT_LIMITS: Record<string, number> = {
  eventTitle: 120, subtitle: 160, edition: 80,
  headerNote: 200, footerNote: 200, notes: 1200,
};

function clean(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  // Strip control characters, collapse whitespace, trim, cap the length.
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
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
  };
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
