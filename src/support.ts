// Voluntary support — the one place a support link lives.
//
// The app is entirely free. Nothing here gates anything: this is a small,
// dismissible invitation, not a paywall. Point SUPPORT_URL at Patronite,
// Ko-fi, Buy Me a Coffee, GitHub Sponsors or anywhere else and that is the only
// edit needed.
//
// Empty URL means "not set up yet" and the banner simply does not render. That
// is deliberate: no placeholder, no dead button, nothing that looks like a
// broken purchase flow.

/** Where "Support the project" goes. Empty = no banner is shown at all. */
export const SUPPORT_URL = '';

/** Storage key for "I dismissed this, stop asking". Reset from Settings. */
export const SUPPORT_DISMISSED_KEY = 'to:support-dismissed';

/**
 * How often the banner may come back, in days. 0 = stay dismissed forever.
 * Ninety days is meant to be rare enough that nobody feels nagged.
 */
export const SUPPORT_REMINDER_DAYS = 90;

/** True when there is somewhere to send the user. */
export const isSupportConfigured = (): boolean => {
  try {
    return /^https?:\/\//.test(SUPPORT_URL);
  } catch {
    return false;
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the banner should be shown — dismissed state first, then the reminder
 * interval. Kept here rather than in the component so it can be tested without
 * rendering anything.
 */
export function shouldShowSupport(
  store: { getItem(k: string): string | null; setItem(k: string, v: string): void },
  now: number = Date.now(),
): boolean {
  if (!isSupportConfigured()) return false;
  const raw = store.getItem(SUPPORT_DISMISSED_KEY);
  if (!raw) return true;
  if (SUPPORT_REMINDER_DAYS <= 0) return false;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) return true;   // junk value: show it again
  return now - dismissedAt >= SUPPORT_REMINDER_DAYS * DAY_MS;
}

/** Remember a dismissal. Local to this machine; nothing leaves it. */
export function dismissSupport(
  store: { setItem(k: string, v: string): void },
  now: number = Date.now(),
): void {
  store.setItem(SUPPORT_DISMISSED_KEY, String(now));
}

/** Undo a dismissal — Settings offers this so the banner is never a one-way door. */
export function resetSupport(
  store: { removeItem(k: string): void },
): void {
  store.removeItem(SUPPORT_DISMISSED_KEY);
}