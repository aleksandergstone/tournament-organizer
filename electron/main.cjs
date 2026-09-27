const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// --- App identity -----------------------------------------------------------
const APP_TITLE = 'Tournament Organizer';
if (process.platform === 'win32') app.setAppUserModelId('com.tournamentorganizer.desktop');

// One instance only: opening a second copy focuses the first window instead of
// confusing the user with two apps racing on the same autosave storage.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
}

let win = null;

// --- Remembered window state ------------------------------------------------
// Normal (non-maximized) bounds are persisted to userData so the window comes
// back where the organizer left it. Falls back to defaults on any problem.
function statePath() { return path.join(app.getPath('userData'), 'window-state.json'); }
function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    const w = Number(s.width), h = Number(s.height), x = Number(s.x), y = Number(s.y);
    if (Number.isFinite(w) && Number.isFinite(h) && w >= 900 && h >= 600) {
      const displays = screen.getAllDisplays();
      const onScreen = displays.some(d => {
        const a = d.workArea;
        return x >= a.x - w + 100 && x <= a.x + a.width - 100 && y >= a.y && y <= a.y + a.height - 100;
      });
      if (onScreen || !Number.isFinite(x)) return { width: w, height: h, x: Number.isFinite(x) ? x : undefined, y: Number.isFinite(y) ? y : undefined };
    }
  } catch { /* first run or unreadable state — defaults below */ }
  return { width: 1180, height: 800 };
}
function saveWindowState() {
  if (!win || win.isDestroyed() || win.isMaximized()) return;
  try {
    const b = win.getBounds();
    fs.writeFileSync(statePath(), JSON.stringify({ width: b.width, height: b.height, x: b.x, y: b.y }), 'utf8');
  } catch { /* never block closing on state persistence */ }
}

// --- Loading / startup failure handling -------------------------------------
// Dev mode: VITE_DEV_URL set explicitly (auto devtools).
// Packaged/production: bundled dist/index.html.
// Dev machine without a build yet: falls back to the Vite dev server, and if
// that is not running either, shows a friendly instructions page instead of a
// raw connection error.
const PAGE_FALLBACK_TARGET = 'http://localhost:5173';
function showFallbackPage() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${APP_TITLE}</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f4f5f7;color:#1a1d21;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="max-width:460px;text-align:center;padding:24px">
<h1 style="font-size:20px">${APP_TITLE}</h1>
<p>The app interface could not be loaded.</p>
<p style="color:#6b7280;font-size:13px">If you are developing: run <code>npm run dev</code> in the project folder, then click Retry.<br>
If you installed the app: reinstall it from the release download.</p>
<button onclick="location.replace('${PAGE_FALLBACK_TARGET}')" style="padding:8px 18px;border:1px solid #e2e5ea;background:#fff;border-radius:6px;cursor:pointer">Retry</button>
</div></body></html>`;
  if (win && !win.isDestroyed()) win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function create() {
  const bounds = loadWindowState();
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  win = new BrowserWindow({
    ...bounds,
    minWidth: 900, minHeight: 600,
    title: APP_TITLE,
    // Present in dev; absent from packaged builds (installer/exe icon is set
    // by electron-builder instead) — BrowserWindow falls back gracefully.
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  win.on('close', saveWindowState);

  const devUrl = process.env.VITE_DEV_URL;
  // Works in both layouts: dev is <root>/electron/main.cjs → <root>/dist,
  // packaged is app.asar/electron/main.cjs → app.asar/dist.
  const index = path.join(__dirname, '..', 'dist', 'index.html');
  if (devUrl) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else if (fs.existsSync(index)) {
    win.loadFile(index);
  } else {
    win.loadURL(PAGE_FALLBACK_TARGET);
    // Dev server not running → friendly instructions instead of a crash page.
    win.webContents.on('did-fail-load', (_e, code) => {
      if (code === -3) return; // aborted (a successful load raced it)
      showFallbackPage();
    });
  }
}
if (gotLock) app.whenReady().then(create);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) create(); });

// --- File dialogs -----------------------------------------------------------
// Every handler returns a plain result object — the renderer turns `error`
// into a human message. Nothing ever rejects with a raw stack trace.
ipcMain.handle('file:save', async (_e, filename, text) => {
  try {
    const r = await dialog.showSaveDialog({
      defaultPath: filename,
      filters: [
        { name: 'Tournament project', extensions: ['top.json', 'json'] },
        { name: 'CSV', extensions: ['csv'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (r.canceled || !r.filePath) return { canceled: true };
    fs.writeFileSync(r.filePath, text, 'utf8');
    return { path: r.filePath };
  } catch (e) {
    return { error: `Could not save the file: ${e && e.message ? e.message : e}` };
  }
});
ipcMain.handle('file:open', async () => {
  try {
    const r = await dialog.showOpenDialog({
      filters: [{ name: 'Tournament project', extensions: ['json', 'top.json'] }, { name: 'All files', extensions: ['*'] }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const p = r.filePaths[0];
    try {
      return { path: p, text: fs.readFileSync(p, 'utf8') };
    } catch (e) {
      return { path: p, error: `Could not read the file: ${e && e.message ? e.message : e}` };
    }
  } catch (e) {
    return { error: `Could not open the file dialog: ${e && e.message ? e.message : e}` };
  }
});
