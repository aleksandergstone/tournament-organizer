// Single source of truth for app identity shown in the UI.
// __APP_VERSION__ is injected by vite.config.ts (define) from package.json,
// so the displayed version always matches the released artifact version.
declare const __APP_VERSION__: string;

export const APP_NAME = 'Tournament Organizer';
export const APP_ID = 'tournament-organizer';
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
