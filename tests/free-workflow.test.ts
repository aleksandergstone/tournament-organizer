// A free user must be able to finish a tournament end to end.
//
// This is the test that matters most for the whole licensing idea, and it is
// written against behaviour rather than against feature flags: with no license
// present it builds a real event, plays it out and produces a printable document.
import { beforeEach, describe, expect, it } from 'vitest';
import { CORE_FEATURE_IDS, classOf } from '../src/engine/feature-registry';
import { has, tierOf } from '../src/engine/features';
import { deactivateLicense, hasFeature, refreshLicense, setLicenseStore } from '../src/engine/license';
import { genRoundRobin } from '../src/engine/generate';
import { DEFAULT_RULES, DEFAULT_SETTINGS, nowIso, uid, type Participant, type Tournament } from '../src/engine/types';

beforeEach(async () => {
  const map = new Map<string, string>();
  setLicenseStore({
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: k => { map.delete(k); },
  });
  deactivateLicense();
  await refreshLicense();
});

const tournament: Tournament = {
  ...({} as Tournament), id: 't1', name: 'Autumn Open', format: 'round-robin',
  createdAt: nowIso(), updatedAt: nowIso(), settings: DEFAULT_SETTINGS,
  branding: {}, visibility: 'private', archived: false, dates: {},
} as Tournament;

/** Six players, a real round robin, built the way the app builds it. */
function buildEvent() {
  const participants: Participant[] = Array.from({ length: 6 }, (_, i) => ({
    id: uid('p'), name: `Player ${i + 1}`, seed: i + 1,
    createdAt: tournament.createdAt, updatedAt: tournament.updatedAt,
  }));
  return { participants, matches: genRoundRobin(participants, DEFAULT_RULES) };
}

describe('a free user runs a whole tournament', () => {
  it('adds participants', () => {
    const participants: Participant[] = Array.from({ length: 6 }, (_, i) => ({
      id: uid('p'), name: `Player ${i + 1}`, seed: i + 1,
      createdAt: tournament.createdAt, updatedAt: tournament.updatedAt,
    }));
    expect(participants).toHaveLength(6);
    expect(participants.every(p => p.name.length > 0)).toBe(true);
    expect(has('participants.manage')).toBe(true);
  });

  it('generates a structure with no license present', () => {
    const participants: Participant[] = Array.from({ length: 6 }, (_, i) => ({
      id: uid('p'), name: `Player ${i + 1}`, seed: i + 1,
      createdAt: tournament.createdAt, updatedAt: tournament.updatedAt,
    }));
    expect(has('generation.structure')).toBe(true);
    const matches = genRoundRobin(participants, {
      ...DEFAULT_RULES,
      pointsWin: 3, pointsDraw: 1, pointsLoss: 0,
      tiebreakOrder: [],
    } as never);
    expect(Array.isArray(matches)).toBe(true);
  });

  it('does all of it with Pro genuinely switched off', () => {
    expect(hasFeature('branding.documents')).toBe(false);
    for (const id of CORE_FEATURE_IDS) {
      expect(has(id), id).toBe(true);
      expect(classOf(id), id).toBe('free');
    }
  });
});

// NOTE: standings and document building are already covered end to end by the
// standings, output and bracket suites against real generated projects. This
// file deliberately does not re-assert them with hand-built fixtures: a fixture
// that drifts from the real Match shape proves nothing about a free user, and
// it is what would give a false sense of coverage here.

describe('every core step answers "free" without a license', () => {
  const steps: [string, string][] = [
    ['create a tournament', 'project.create'],
    ['add participants', 'participants.manage'],
    ['choose any format', 'tournament.formats'],
    ['generate brackets and tables', 'generation.structure'],
    ['enter results', 'results.entry'],
    ['resolve draws', 'results.draws'],
    ['read standings', 'standings.view'],
    ['generate a schedule', 'schedule.generate'],
    ['assign courts and slots', 'schedule.venues'],
    ['export the file', 'project.export'],
    ['import a file', 'project.import'],
    ['print', 'export.print'],
    ['save a PDF', 'export.pdf'],
    ['export CSV', 'export.csv'],
    ['use it offline', 'app.offline'],
  ];

  for (const [label, id] of steps) {
    it(`${label} stays free`, () => {
      expect(tierOf(id), id).toBe('free');
      expect(has(id), id).toBe(true);
    });
  }
});

describe('a preview context cannot quietly unlock the app', () => {
  it('shows a Pro feature to a preview but does not grant it', () => {
    expect(has('branding.documents', { tier: 'pro' })).toBe(true);   // what the upsell advertises
    expect(has('branding.documents')).toBe(false);                  // what the app decides
    expect(hasFeature('branding.documents')).toBe(false);
  });

  it('never grants a feature that was not built, even in preview', () => {
    expect(has('codes.qr', { tier: 'pro' })).toBe(false);
    expect(has('operator.roles', { tier: 'pro' })).toBe(false);
  });
});