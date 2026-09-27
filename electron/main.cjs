const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const dgram = require('dgram');

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

// --- Display Mode window ----------------------------------------------------
// A second, read-only window on the same data — for a projector or TV.
ipcMain.handle('window:open-display', (_e, fullscreen) => {
  const index = path.join(__dirname, '..', 'dist', 'index.html');
  if (!fs.existsSync(index)) return { error: 'Build the app first (npm run build).' };
  const icon = path.join(__dirname, '..', 'build', 'icon.png');
  const w = new BrowserWindow({
    width: 1280, height: 760, minWidth: 800, minHeight: 500,
    backgroundColor: '#0b1220',
    title: `${APP_TITLE} — Display`,
    icon: fs.existsSync(icon) ? icon : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  w.loadFile(index, { hash: 'display' });
  if (fullscreen) w.setFullScreen(true);
  return { ok: true };
});

// --- LAN sync host ----------------------------------------------------------
// Opt-in, local network only: a small HTTP server the renderer feeds with the
// current project. Devices on the same LAN pull it or push their own state.
// No internet, no accounts, no cloud. A UDP beacon helps devices find each
// other; typing the address by hand always works too.
const SYNC_PORT = 8971;
const BEACON_PORT = 8970;
let lanServer = null;
let beacon = null;
let beaconTimer = null;
let published = null;      // last state published by the renderer
let inbox = [];            // states pushed by other devices, waiting to merge

function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
  }
  return out.length ? out : ['127.0.0.1'];
}
function lanInfo() {
  const addresses = lanAddresses();
  return { ok: true, port: SYNC_PORT, addresses, urls: addresses.map(a => `http://${a}:${SYNC_PORT}`) };
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function sendJson(res, code, body) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

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

function startBeacon() {
  try {
    beacon = dgram.createSocket('udp4');
    beacon.on('error', () => { /* discovery is optional, never fatal */ });
    beacon.bind(BEACON_PORT, () => {
      try { beacon.setBroadcast(true); } catch { /* ignore */ }
      const announce = () => {
        const msg = JSON.stringify({
          app: 'tournament-organizer',
          port: SYNC_PORT,
          name: (published && published.project && published.project.tournament && published.project.tournament.name) || 'Tournament Organizer',
        });
        try { beacon.send(Buffer.from(msg), BEACON_PORT, '255.255.255.255', () => {}); } catch { /* ignore */ }
      };
      announce();
      beaconTimer = setInterval(announce, 3000);
    });
  } catch { beacon = null; }
}
function stopBeacon() {
  if (beaconTimer) { clearInterval(beaconTimer); beaconTimer = null; }
  if (beacon) { try { beacon.close(); } catch { /* ignore */ } beacon = null; }
}
function startHost() {
  if (lanServer) return lanInfo();
  lanServer = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
      if (url.pathname === '/api/ping') {
        return sendJson(res, 200, { app: 'tournament-organizer', ok: true, at: new Date().toISOString() });
      }
      if (url.pathname === '/api/state' && req.method === 'GET') {
        return published
          ? sendJson(res, 200, published)
          : sendJson(res, 503, { error: 'This device is not sharing a project yet.' });
      }
      if (url.pathname === '/api/state' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => {
          body += c;
          if (body.length > 32 * 1024 * 1024) req.destroy();
        });
        req.on('end', () => {
          try {
            inbox.push({ receivedAt: new Date().toISOString(), payload: JSON.parse(body || '{}') });
            if (inbox.length > 20) inbox.shift();
            sendJson(res, 200, { ok: true, pending: inbox.length });
          } catch {
            sendJson(res, 400, { error: 'Could not read the pushed data.' });
          }
        });
        return;
      }
      sendJson(res, 404, { error: 'Unknown endpoint.' });
    } catch {
      sendJson(res, 500, { error: 'Host error.' });
    }
  });
  lanServer.on('error', (e) => { lanServer = null; stopBeacon(); console.error('LAN host failed:', e.message); });
  lanServer.listen(SYNC_PORT, '0.0.0.0');
  startBeacon();
  return lanInfo();
}
function stopHost() {
  stopBeacon();
  if (lanServer) { try { lanServer.close(); } catch { /* ignore */ } lanServer = null; }
  inbox = [];
}

// Renderer-facing LAN controls. All results are plain objects with an `error`
// field — the UI shows the message instead of a crash.
ipcMain.handle('lan:start', () => {
  try { return startHost(); }
  catch (e) { return { error: `Could not start sharing: ${e && e.message ? e.message : e}` }; }
});
ipcMain.handle('lan:stop', () => { stopHost(); return { ok: true }; });
ipcMain.handle('lan:status', () => (lanServer ? lanInfo() : { ok: false, port: SYNC_PORT, addresses: lanAddresses() }));
ipcMain.handle('lan:publish', (_e, payload) => { published = payload || null; return { ok: !!published }; });
ipcMain.handle('lan:inbox', () => ({ items: inbox.splice(0) }));

app.on('will-quit', () => { stopHost(); });
