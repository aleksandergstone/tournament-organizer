import { t } from '../i18n';
// Desktop file bridge: Electron IPC when available, browser fallback otherwise.
// Renderer must never import 'electron' directly (contextIsolation) — the
// preload exposes window.toDesktop; in dev-server browsers it is absent.
//
// Contract: `saveText` resolves to the saved path, or null when the user
// cancelled; `openText` resolves to {path, text} or null when cancelled.
// Any real failure (unreadable file, disk full, denied permission) rejects
// with a short human-readable message — never a raw IPC stack trace.
export interface DesktopBridge {
  readonly available: boolean;
  saveText(filename: string, text: string): Promise<string | null>;
  /** Renders a self-contained HTML document to a PDF file (desktop only). */
  savePdf(filename: string, html: string): Promise<string | null>;
  /** Opens the system print dialog for a self-contained HTML document. */
  printHtml(html: string): Promise<boolean>;
  openText(): Promise<{ path: string; text: string } | null>;
  /** Opens the read-only Display Mode in a second window (desktop only). */
  openDisplay(fullscreen?: boolean): Promise<boolean>;
  /**
   * Hands a URL to the system browser — used for the hosted checkout. Only
   * https and mailto are allowed, so a value that ever came from a project file
   * can never become a file:// or javascript: link.
   */
  openExternal(url: string): Promise<boolean>;
  /** LAN sync: host side (needs the desktop app; a browser cannot listen on a port). */
  lanStart(): Promise<LanInfo>;
  lanStop(): Promise<void>;
  lanStatus(): Promise<LanInfo>;
  lanPublish(payload: unknown): Promise<boolean>;
  lanInbox(): Promise<{ receivedAt: string; payload: unknown }[]>;
  /** LAN sync: client side — plain HTTP against a host on the same network. */
  lanPull(baseUrl: string): Promise<unknown>;
  lanPush(baseUrl: string, payload: unknown): Promise<void>;
}

export interface LanInfo {
  ok: boolean;
  error?: string;
  port?: number;
  addresses?: string[];
  urls?: string[];
}

type SaveResult = { path?: string; canceled?: true; error?: string };
type OpenResult = { path?: string; text?: string; canceled?: true; error?: string };

declare global {
  interface Window { toDesktop?: {
    saveText(f: string, t: string): Promise<SaveResult | string | null>;
    savePdf(f: string, html: string): Promise<SaveResult | string | null>;
    printHtml(html: string): Promise<{ ok?: boolean; error?: string }>;
    openText(): Promise<OpenResult | { path: string; text: string } | null>;
    openDisplay(fullscreen?: boolean): Promise<{ ok?: boolean; error?: string }>;
    openExternal(url: string): Promise<{ ok?: boolean; error?: string }>;
    lanStart(): Promise<LanInfo>;
    lanStop(): Promise<{ ok: boolean }>;
    lanStatus(): Promise<LanInfo>;
    lanPublish(payload: unknown): Promise<{ ok: boolean }>;
    lanInbox(): Promise<{ items: { receivedAt: string; payload: unknown }[] }>;
  }; }
}

/**
 * Browser-only print path: the report HTML in a hidden iframe, so the page's own
 * styles can never leak into (or be lost by) the printed document.
 */
function printViaHiddenFrame(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:0;top:0;width:210mm;height:297mm;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); return; }
  doc.open(); doc.write(html); doc.close();
  const go = () => {
    try { frame.contentWindow?.focus(); frame.contentWindow?.print(); }
    catch { /* the browser blocked printing — nothing else to try here */ }
    setTimeout(() => frame.remove(), 1000);
  };
  // Give the iframe a tick to lay out (logos decode) before opening the dialog.
  setTimeout(go, 300);
}

/** Normalizes a LAN address typed by the user (adds scheme, strips trailing /). */
export function lanBase(input: string): string {
  const t = (input ?? '').trim();
  if (!t) return '';
  const withScheme = /^https?:\/\//i.test(t) ? t : `http://${t}`;
  return withScheme.replace(/\/+$/, '');
}

export const desktop: DesktopBridge = {
  // A getter, not a constant: the Android bridge installs `window.toDesktop`
  // while the app boots, and the desktop preload may be late as well.
  get available() { return typeof window !== 'undefined' && !!window.toDesktop; },
  async saveText(filename, text) {
    if (window.toDesktop) {
      const r = await window.toDesktop.saveText(filename, text) as SaveResult | string | null;
      if (r === null || (typeof r === 'object' && r !== null && 'canceled' in r)) return null; // user cancelled
      if (typeof r === 'string') return r; // legacy: plain path
      if (typeof r === 'object' && r.error) throw new Error(r.error);
      return typeof r === 'object' && r.path ? r.path : filename;
    }
    // browser fallback: download
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return filename;
  },
  /**
   * Desktop: Electron prints the document offscreen and writes a PDF. Browser:
   * there is no way to write a PDF from a page, so the same document goes to the
   * browser's print dialog and the organizer picks "Save as PDF" there.
   */
  async savePdf(filename, html) {
    if (window.toDesktop) {
      const r = await window.toDesktop.savePdf(filename, html) as SaveResult | string | null;
      if (r === null || (typeof r === 'object' && r !== null && 'canceled' in r)) return null;
      if (typeof r === 'string') return r;
      if (typeof r === 'object' && r.error) throw new Error(r.error);
      return typeof r === 'object' && r.path ? r.path : filename;
    }
    printViaHiddenFrame(html);
    return filename;
  },

  /** System print dialog for the report — identical output on both platforms. */
  async printHtml(html) {
    if (window.toDesktop) {
      const r = await window.toDesktop.printHtml(html);
      if (r && r.error) throw new Error(r.error);
      return !!(r && r.ok);
    }
    printViaHiddenFrame(html);
    return true;
  },

  async openText() {
    if (window.toDesktop) {
      const r = await window.toDesktop.openText() as OpenResult | null;
      if (!r || 'canceled' in r) return null; // user cancelled
      if (r.error) throw new Error(r.error);
      if (typeof r.text !== 'string') throw new Error(t('error.fileRead'));
      return { path: r.path ?? '', text: r.text };
    }
    // browser fallback: <input type=file> picker
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json,application/json';
      inp.onchange = () => {
        const f = inp.files?.[0];
        if (!f) { resolve(null); return; }
        const rd = new FileReader();
        rd.onload = () => resolve({ path: f.name, text: String(rd.result ?? '') });
        rd.onerror = () => resolve(null);
        rd.readAsText(f);
      };
      inp.click();
    });
  },

  // ---- Display Mode -------------------------------------------------------
  async openDisplay(fullscreen) {
    if (!window.toDesktop) return false; // browser: use the Display screen in this tab
    const r = await window.toDesktop.openDisplay(fullscreen);
    if (r && r.error) throw new Error(r.error);
    return !!(r && r.ok);
  },

  // ---- the system browser --------------------------------------------------
  async openExternal(url) {
    if (!/^(https:\/\/|mailto:)/i.test(url)) throw new Error(t('error.fileOpen'));
    if (window.toDesktop) {
      const r = await window.toDesktop.openExternal(url);
      if (r && r.error) throw new Error(r.error);
      return !!(r && r.ok);
    }
    // Browser: a plain anchor keeps the app tab in place.
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.click();
    return true;
  },

  // ---- LAN sync: host -----------------------------------------------------
  async lanStart() {
    if (!window.toDesktop) return { ok: false, error: t('sync.errNoDesktop') };
    const r = await window.toDesktop.lanStart();
    if (r && r.error) throw new Error(r.error);
    return r;
  },
  async lanStop() {
    if (!window.toDesktop) return;
    await window.toDesktop.lanStop();
  },
  async lanStatus() {
    if (!window.toDesktop) return { ok: false, error: t('sync.errLanDesktop') };
    return window.toDesktop.lanStatus();
  },
  async lanPublish(payload) {
    if (!window.toDesktop) return false;
    const r = await window.toDesktop.lanPublish(payload);
    return !!(r && r.ok);
  },
  async lanInbox() {
    if (!window.toDesktop) return [];
    const r = await window.toDesktop.lanInbox();
    return (r && r.items) || [];
  },

  // ---- LAN sync: client (works in browser and desktop) --------------------
  async lanPull(baseUrl) {
    const base = lanBase(baseUrl);
    if (!base) throw new Error(t('sync.errAddress'));
    let res: Response;
    try {
      res = await fetch(`${base}/api/state`, { headers: { Accept: 'application/json' } });
    } catch {
      throw new Error(t('sync.errNoAnswer', { url: base }));
    }
    if (res.status === 503) throw new Error(t('sync.errNotSharing'));
    if (!res.ok) throw new Error(t('sync.errHttp', { code: res.status }));
    return res.json();
  },
  async lanPush(baseUrl, payload) {
    const base = lanBase(baseUrl);
    if (!base) throw new Error(t('sync.errAddress'));
    let res: Response;
    try {
      res = await fetch(`${base}/api/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error(t('sync.errNoSend', { url: base }));
    }
    if (!res.ok) throw new Error(t('sync.errPush', { code: res.status }));
  },
};