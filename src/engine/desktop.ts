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
  openText(): Promise<{ path: string; text: string } | null>;
}

type SaveResult = { path?: string; canceled?: true; error?: string };
type OpenResult = { path?: string; text?: string; canceled?: true; error?: string };

declare global {
  interface Window { toDesktop?: {
    saveText(f: string, t: string): Promise<SaveResult | string | null>;
    openText(): Promise<OpenResult | { path: string; text: string } | null>;
  }; }
}

export const desktop: DesktopBridge = {
  available: typeof window !== 'undefined' && !!window.toDesktop,
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
  async openText() {
    if (window.toDesktop) {
      const r = await window.toDesktop.openText() as OpenResult | null;
      if (!r || 'canceled' in r) return null; // user cancelled
      if (r.error) throw new Error(r.error);
      if (typeof r.text !== 'string') throw new Error('The file could not be read.');
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
};