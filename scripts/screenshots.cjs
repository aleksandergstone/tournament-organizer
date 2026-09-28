// Captures launch screenshots of the REAL app (built bundle in dist/) driven
// with a real, engine-generated demo project (see scripts/demo-fixture.ts).
//
// Run: npm run screenshots
//   → rebuilds the demo fixture, then captures site/assets/screens/*.png
//
// No fake UI, no mockups: this opens the actual application, seeds the demo
// projects into its own local storage and photographs real screens.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = path.join(root, 'dist', 'index.html');
const fixture = path.join(root, '.cache', 'demo-projects.json');
const outDir = path.join(root, 'site', 'assets', 'screens');

const delay = (ms) => new Promise(r => setTimeout(r, ms));
let win;

function fail(msg) {
  console.error('✖ ' + msg);
  app.exit(1);
  process.exit(1);
}

app.on('window-all-closed', () => app.quit());

app.whenReady().then(async () => {
  if (!fs.existsSync(index)) return fail('dist/index.html missing — run `npm run build` first.');
  if (!fs.existsSync(fixture)) return fail('.cache/demo-projects.json missing — run `node scripts/make-demo-project.mjs` first.');
  fs.mkdirSync(outDir, { recursive: true });
  const projects = fs.readFileSync(fixture, 'utf8');

  win = new BrowserWindow({
    width: 1280, height: 860,
    show: false,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#f4f5f7',
    title: 'Tournament Organizer',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  const js = (code) => win.webContents.executeJavaScript(code, true);
  // Hidden windows must keep painting so captures are not stale.
  win.webContents.setBackgroundThrottling(false);
  // The window is hidden, so a capture can lag behind the DOM. Wait for two
  // real paint frames before every screenshot, otherwise a stale frame lands
  // in the file.
  const settle = async () => {
    await delay(250);
    await js('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');
    await delay(450);
  };

  try {
    await win.loadFile(index);
    await delay(800);
    // Seed the demo projects into the app's own storage, then reload so the
    // Home screen shows them exactly as a real user's project list.
    await js(`localStorage.setItem('to:projects', ${JSON.stringify(projects)}); true`);
    await win.reload();
    await delay(1200);

    const h1 = () => js(`(document.querySelector('h1') || {}).textContent || ''`);

    async function expectH1(substr) {
      const got = await h1();
      if (!got.includes(substr)) throw new Error(`expected screen "${substr}", got "${got}"`);
    }

    async function shot(name) {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(outDir, `${name}.png`), img.toPNG());
      console.log(`  ✔ ${name}.png (${(img.toPNG().length / 1024).toFixed(0)} kB)`);
    }

    async function nav(label, expect) {
      const ok = await js(`(() => { const b = [...document.querySelectorAll('.topbar nav button')]
        .find(x => x.textContent.trim() === ${JSON.stringify(label)});
        if (!b || b.disabled) return false; b.click(); return true; })()`);
      if (!ok) throw new Error(`nav "${label}" not available`);
      await settle();
      if (expect) await expectH1(expect);
    }

    async function button(text) {
      const ok = await js(`(() => { const b = [...document.querySelectorAll('button')]
        .find(x => x.textContent.trim() === ${JSON.stringify(text)});
        if (!b) return false; b.click(); return true; })()`);
      if (!ok) throw new Error(`button "${text}" not found`);
      await settle();
    }

    async function openProject(name) {
      const res = await js(`(() => { const row = [...document.querySelectorAll('tr')]
        .find(r => r.textContent.includes(${JSON.stringify(name)}));
        if (!row) return 'no-row';
        const btn = [...row.querySelectorAll('button')].find(b => b.textContent.trim() === 'Open');
        if (!btn) return 'no-button'; btn.click(); return 'ok'; })()`);
      if (res !== 'ok') throw new Error(`could not open "${name}" (${res})`);
      await settle();
    }

    // 1) Home — recent projects (also the first-run screen for new users)
    await expectH1('Tournament Organizer');
    await shot('01-home');

    // 2) New tournament wizard (intentional onboarding screen)
    await button('+ New tournament');
    await expectH1('New tournament');
    await shot('02-new-tournament');
    await button('Cancel');

    // 3) Groups + knockout project: players, bracket, results, standings, export
    await openProject('City League 2026');
    await expectH1('City League 2026');

    await nav('Players', 'Participants');
    await shot('03-players');

    await nav('Bracket', 'Groups');
    await shot('04-bracket-groups-knockout');

    await nav('Results', 'Result entry');
    await shot('05-results');

    await nav('Standings', 'Standings');
    await shot('06-standings');

    await nav('Output', 'Output & branding');
    await shot('07-export');

    // 4) Double elimination bracket
    await nav('Home');
    await openProject('Friday Night Cup');
    await expectH1('Friday Night Cup');
    await nav('Bracket', 'Double elimination');
    await shot('08-bracket-double-elimination');

    // 5) Event operations: display mode, venue schedule, QR codes
    await nav('Home');
    await openProject('City League 2026');
    await expectH1('City League 2026');

    await nav('Schedule', 'Schedule');
    await shot('10-schedule');

    await nav('Display', 'City League 2026');
    await shot('11-display');

    await nav('QR codes', 'QR codes');
    await shot('12-qr-codes');

    // 6) Settings / About — version, edition, data statement
    await nav('Home');
    await button('Settings');
    await expectH1('Settings');
    await shot('09-about');

    console.log(`\n✔ screenshots written to ${path.relative(root, outDir)}`);
  } catch (e) {
    console.error('✖ ' + (e && e.message ? e.message : e));
    app.exit(1);
    return;
  }
  app.quit();
});
