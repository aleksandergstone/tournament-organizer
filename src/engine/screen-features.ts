// The screens that are Pro-gated, so navigation can badge them instead of
// hiding them. A locked screen stays in the menu and stays clickable: it opens
// and explains itself, which is the difference between "locked" and "broken".
import type { Screen } from '../state/store';

export const SCREEN_FEATURE: Partial<Record<Screen, string>> = {
  display: 'display.kiosk',
};

/**
 * Which panel of Settings is Pro. The sync panel is the only one, so this is a
 * list rather than a map — it grows when another panel is gated.
 */
export const SETTINGS_PANEL_FEATURE: Record<string, string> = {
  sync: 'sync.lan',
};