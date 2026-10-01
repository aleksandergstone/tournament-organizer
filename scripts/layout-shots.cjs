// Captures the same real app at phone width and in dark theme, into
// .cache/layout-shots/. Used to check 1.4.01 layout fixes visually; nothing here
// is published. The wide captures on the launch page stay at 1280x860.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = path.join(root, 'dist', 'index.html');
const fixture = path.join(root, '.cache', 'demo-projects.json');
const outDir = path.join(root, '.cache', 'layout-shots');

// Registered but deliberately NOT quitting: this sweep destroys a window
// between passes, and both this handler and Electron's default behaviour would
// end the run after the first pass. app.exit() at the end is the only exit.
app.on('window-all-closed', () => {});
const delay = (ms) => new Promise(r => setTimeout(r, ms));
app.commandLine.appendSwitch('lang', 'en-US');

const SIZES = [
  { name: 'phone', width: 390, height: 844, locale: 'de' },   // iPhone 14, longest strings
  { name: 'narrow', width: 320, height: 720, locale: 'de' },  // smallest width, longest strings
  { name: 'phone-es', width: 390, height: 844, locale: 'es' }, // Spanish also runs long
  { name: 'wide', width: 1280, height: 860, locale: 'de' },   // desktop must not regress
];

app.whenReady().then(async () => {
  if (!fs.existsSync(index)) { console.error('no dist/index.html — npm run build'); process.exit(1); }
  if (!fs.existsSync(fixture)) { console.error('no demo fixture'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });

  const all = JSON.parse(fs.readFileSync(fixture, 'utf8'));
  const projectsFor = (locale) => {
    const out = {};
    for (const [k, v] of Object.entries(all)) {
      out[k] = { ...v, settings: { ...(v.settings || {}), locale } };
    }
    return JSON.stringify(out);
  };

  const problems = [];

  for (const theme of ['light', 'dark']) {
    for (const size of SIZES) {
      const win = new BrowserWindow({
        width: size.width, height: size.height, show: false,
        paintWhenInitiallyHidden: true, backgroundColor: theme === 'dark' ? '#0e1116' : '#f4f6f8',
        webPreferences: { contextIsolation: true, nodeIntegration: false },
      });
      win.webContents.setBackgroundThrottling(false);
      const js = (c) => win.webContents.executeJavaScript(c, true);
      const settle = async () => {
        await delay(220);
        await js('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');
        await delay(380);
      };
      await win.loadFile(index).catch(async (e) => {
        // A window destroyed mid-load can reject; retry once before giving up so
        // a slow first paint does not abort the whole sweep.
        await delay(700);
        await win.loadFile(index);
      });
      await delay(600);
      // Seed, then set the theme the same way the app itself does.
      await js(`localStorage.setItem('to:projects', ${JSON.stringify(projectsFor(size.locale))}); true`);
      await js(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}; true`);
      await win.reload();
      await delay(700);
      await js(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}; true`);
      await settle();

      const tag = `${size.name}-${theme}`;

      // Overflow probe: anything wider than the viewport is a layout bug.
      const probe = await js(`(() => {
        const vw = document.documentElement.clientWidth;
        const bad = [];
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right > vw + 1.5 || r.left < -1.5) {
            const s = getComputedStyle(el);
            // scroll containers are allowed to be wider than the viewport
            if (s.overflowX === 'auto' || s.overflowX === 'scroll') continue;
            let p = el, scrollable = false;
            while (p && p !== document.body) {
              const ps = getComputedStyle(p);
              if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') { scrollable = true; break; }
              p = p.parentElement;
            }
            if (scrollable) continue;
            bad.push(el.className || el.tagName);
          }
        }
        return {
          docScroll: document.documentElement.scrollWidth > vw + 1,
          scrollWidth: document.documentElement.scrollWidth, vw,
          offenders: [...new Set(bad)].slice(0, 12),
        };
      })()`);

      if (probe.docScroll) problems.push(`${tag}: page scrolls sideways (${probe.scrollWidth} > ${probe.vw})`);
      for (const o of probe.offenders) problems.push(`${tag}: overflows -> ${o}`);

      // Nav buttons are translated, so they are addressed by position. The order is
// read from NAV in src/App.tsx: home, overview, participants, rules | bracket,
// matches, standings | schedule, display, codes, export.
const SCREENS = { rules: 3, results: 5, standings: 6, schedule: 7, output: 9 };

const shot = async (n) => {
        await settle();
        const p = await js(`(() => {
          const vw = document.documentElement.clientWidth;
          const bad = [];
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.right > vw + 1.5 || r.left < -1.5) {
              let q = el, ok = false;
              while (q && q !== document.body) {
                const s = getComputedStyle(q);
                if (s.overflowX === 'auto' || s.overflowX === 'scroll') { ok = true; break; }
                q = q.parentElement;
              }
              if (ok) continue;
              // Plain concatenation, not an interpolation: this whole block is
              // already inside a template literal, so a nested dollar-brace
              // would be parsed by Node instead of reaching the page.
              const who = (el.className || el.tagName) + '';
              bad.push(who + ' [w=' + Math.round(r.width) + ' right=' + Math.round(r.right) + ']');
            }
          }
          return { doc: document.documentElement.scrollWidth > vw + 1, bad: [...new Set(bad)].slice(0, 10) };
        })()`);
        if (p.doc) problems.push(`${n}: page scrolls sideways`);
        for (const b of p.bad) problems.push(`${n}: overflows -> ${b}`);
        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(outDir, `${n}.png`), img.toPNG());
        console.log(`  ✔ ${n}.png${p.bad.length ? '  (⚠ ' + p.bad.length + ')' : ''}`);
      };

      await shot(`home-${tag}`);
      // Into a project. The "Open" button is translated too, so the first
      // project row's action is used instead of its label.
      await js(`(() => {
        const b = document.querySelector('.proj-row .btn, table .btn, tbody tr .btn');
        if (b) { b.click(); return 1; }
        return 0;
      })()`);
      await settle();
      for (const [name, idx] of Object.entries(SCREENS)) {
        const ok = await js(`(() => { const b=document.querySelectorAll('.topbar nav button')[${idx}]; if(b&&!b.disabled){b.click();return 1} return 0 })()`);
        if (ok) await shot(`${name}-${tag}`);
      }
      win.destroy();
    }
  }

  console.log('\n--- overflow report ---');
  if (problems.length === 0) console.log('✔ nothing overflows the viewport at any tested size');
  else problems.forEach(p => console.log('  ✖ ' + p));
  app.exit(problems.length ? 2 : 0);
});