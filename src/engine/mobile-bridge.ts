// The Android half of the desktop file bridge.
//
// The renderer is one codebase: on the desktop the Electron preload defines
// `window.toDesktop`, in a browser nothing is defined and the app falls back to
// downloads and the print dialog. On the phone this module fills the same
// contract from a small native plugin (android/.../DocumentBridgePlugin.java), so
// no screen has to know which platform it runs on.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { t } from '../i18n';

// The same shapes the Electron preload returns, so `desktop.ts` treats a phone
// and a laptop identically.
type SaveResult = { path?: string; canceled?: true; error?: string };
type OpenResult = { path?: string; text?: string; canceled?: true; error?: string };

interface DocumentBridgePlugin {
  printHtml(o: { html: string; jobName?: string }): Promise<{ ok?: boolean; error?: string }>;
  savePdf(o: { filename: string; html: string }): Promise<{ ok?: boolean; error?: string }>;
  saveText(o: { filename: string; text: string; mime?: string }): Promise<SaveResult>;
  openText(): Promise<OpenResult>;
}

const DocumentBridge = registerPlugin<DocumentBridgePlugin>('DocumentBridge');

/** True inside the Android (or iOS) shell, false on the desktop and in a browser. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Defines `window.toDesktop` on a phone. Hostile capabilities — hosting a LAN
 * server, opening a second window — report the same "needs the desktop app"
 * message the browser fallback already used, instead of failing oddly.
 */
export function installMobileBridge(): boolean {
  if (typeof window === 'undefined' || window.toDesktop || !isNativeApp()) return false;
  const needsDesktop = { ok: false, error: t('sync.errNoDesktop') };
  window.toDesktop = {
    saveText: async (filename, text) => {
      const mime = filename.endsWith('.csv') ? 'text/csv'
        : filename.endsWith('.json') ? 'application/json' : 'text/plain';
      return DocumentBridge.saveText({ filename, text, mime });
    },
    // The print dialog is where the file lands on a phone ("Save as PDF"), so
    // the file name is the result — the same string the desktop would return.
    savePdf: async (filename, html) => {
      const r = await DocumentBridge.savePdf({ filename, html });
      return r.error ? r : { path: filename };
    },
    printHtml: async (html) => DocumentBridge.printHtml({ html, jobName: 'Tournament Organizer' }),
    openText: async () => DocumentBridge.openText(),
    openDisplay: async () => needsDesktop,
    lanStart: async () => ({ ok: false, error: t('sync.errNoDesktop') }),
    lanStop: async () => ({ ok: false }),
    lanStatus: async () => ({ ok: false, error: t('sync.errNoDesktop') }),
    lanPublish: async () => ({ ok: false }),
    lanInbox: async () => ({ items: [] }),
  };
  return true;
}
