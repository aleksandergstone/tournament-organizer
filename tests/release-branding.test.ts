// Release readiness: app identity must not drift between the UI, the package,
// the installer, the docs and the public page — and a document produced in any
// language must be readable in that language, headers included.
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { APP_NAME } from '../src/version';
import { setLocale } from '../src/i18n';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { de } from '../src/i18n/de';
import { es } from '../src/i18n/es';
import { genRoundRobin } from '../src/engine/generate';
import { recordResult } from '../src/engine/result';
import { buildReport, fmtDate, matchStatusLabel, reportToCsv } from '../src/engine/output';
import { renderReportHtml } from '../src/engine/pdf';
import { DEFAULT_RULES, Match, Participant, Tournament, uid } from '../src/engine/types';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
const DICTS = { en, pl, de, es } as Record<string, Record<string, string>>;

afterEach(() => setLocale('en'));

describe('app identity', () => {
  it('uses one product name everywhere it is shown', () => {
    expect(APP_NAME).toBe('Tournament Organizer');
    expect(pkg.build.productName).toBe(APP_NAME);
    expect(pkg.build.nsis.shortcutName).toBe(APP_NAME);
    expect(read('electron/main.cjs')).toContain(`const APP_TITLE = '${APP_NAME}'`);
    expect(read('index.html')).toContain(`<title>${APP_NAME}</title>`);
    expect(read('site/index.html')).toContain(APP_NAME);
  });

  it('names release files after the product and the version', () => {
    expect(pkg.build.artifactName).toContain('Tournament-Organizer-${version}');
    for (const dir of [pkg.build.directories]) expect(dir.output).toBe('release');
  });

  it('ships the version once, in package.json, and the changelog agrees', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    const top = read('CHANGELOG.md').match(/^## \[([^\]]+)\]/m);
    expect(top?.[1]).toBe(pkg.version);
  });

  it('has release notes for this version, as the release process requires', () => {
    expect(() => read(`docs/releases/v${pkg.version}.md`)).not.toThrow();
  });

  it('keeps the app accent and the favicon the same colour', () => {
    const css = read('src/app.css');
    const acc = css.match(/--acc:\s*(#[0-9a-f]{6})/i)?.[1];
    expect(acc, 'src/app.css must define --acc').toBeTruthy();
    expect(read('index.html').toLowerCase()).toContain(acc!.slice(1));
    expect(read('site/index.html').toLowerCase()).toContain(acc!.slice(1));
  });
});

describe('documents in every language', () => {
  const ps = (names: string[]): Participant[] => names.map((n, i) => ({
    id: `p${i}_${uid('x')}`, name: n, kind: 'team', tags: [], seed: i + 1,
    active: true, withdrawnRound: null, avatar: null,
  }));
  const tour = (): Tournament => ({
    id: 't1', name: 'Winter Cup', sport: 'Football', individualOrTeam: 'team',
    format: 'round-robin', dates: { start: '2026-03-14', end: '2026-03-15' },
    location: 'Sports Hall', visibility: 'private', rules: { ...DEFAULT_RULES },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    archived: false,
  });

  function playedReport() {
    const participants = ps(['Lions', 'Tigers', 'Bears', 'Wolves']);
    let matches = genRoundRobin(participants, DEFAULT_RULES);
    const first = matches[0];
    const r = recordResult(matches, first.id, {
      homeScore: 2, awayScore: 1, status: 'played',
    }, DEFAULT_RULES);
    expect(r.issues).toEqual([]);
    matches = r.matches as Match[];
    return buildReport({
      tournament: tour(), participants, groups: [], matches,
      generatedAt: '2026-03-14T10:00:00.000Z',
    }, 'standings');
  }

  for (const loc of ['en', 'pl', 'de', 'es'] as const) {
    it(`prints a ${loc} document with translated headings`, () => {
      setLocale(loc);
      const d = DICTS[loc];
      const report = playedReport();

      const table = report.sections.find(s => s.id === 'standings')!;
      expect(table.title).toBe(d['doc.standingsTitle']);
      const labels = (table.columns ?? []).map(c => c.label);
      expect(labels).toContain(d['doc.team']);        // team event
      expect(labels).toContain(d['doc.colPts']);
      expect(labels).toContain(d['doc.colScored']);

      // A result the organizer entered is printed with a translated status word.
      expect(matchStatusLabel('played')).toBe(d['doc.played']);

      // Nothing may reach the page as a raw key: doc.* is the only vocabulary.
      const html = renderReportHtml(report);
      expect(html).not.toMatch(/\b(?:doc|common|status|sch|st|out|part|res)\.[a-z]/);
    });
  }

  it('prints dates in the language of the document', () => {
    // English keeps the day-first wording the app has always printed.
    expect(fmtDate('2026-03-14')).toBe('14 Mar 2026');
    const seen = new Set<string>();
    for (const loc of ['en', 'pl', 'de', 'es'] as const) {
      setLocale(loc);
      const printed = fmtDate('2026-03-14');
      expect(printed).toContain('14');
      expect(printed).toContain('2026');
      seen.add(printed);
    }
    expect(seen.size, 'the languages must not share one date format').toBeGreaterThanOrEqual(3);
  });

  it('writes CSV headings in the chosen language too', () => {
    setLocale('de');
    const csv = reportToCsv(playedReport());
    expect(csv).toContain(DICTS.de['doc.team']);
    expect(csv).toContain(DICTS.de['doc.colPts']);
    expect(csv).not.toContain(DICTS.en['doc.colPts']);
  });
});
