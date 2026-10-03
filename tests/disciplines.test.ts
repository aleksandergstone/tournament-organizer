// Discipline profiles and the templates they offer.
//
// The point of the layer is that choosing a sport narrows the setup to the ways
// that sport is actually run, and that nothing about it is a dead end: a template
// loads settings the organizer can still change, and choosing no discipline keeps
// the neutral behaviour the app had before the layer existed.
import { describe, expect, it } from 'vitest';
import {
  DISCIPLINES, applyDiscipline, applyTemplate, disciplineOf, matchLabel, participantLabel,
  templateDefaultsLine, templatesFor, venueLabel,
} from '../src/engine/discipline';
import { PRESETS, presetsFor } from '../src/engine/presets';
import { buildReport } from '../src/engine/output';
import { setLocale } from '../src/i18n';
import { en } from '../src/i18n/en';
import { DEFAULT_RULES, type RuleSet, type Tournament } from '../src/engine/types';

const rules = (p: Partial<RuleSet> = {}): RuleSet => ({ ...DEFAULT_RULES, ...p });

const tour = (discipline?: string | null): Tournament => ({
  id: 't1', name: 'Event', sport: 'Sport', individualOrTeam: 'individual',
  format: 'round-robin', dates: {}, visibility: 'private',
  rules: rules(), createdAt: '', updatedAt: '', archived: false,
  discipline,
} as Tournament);

describe('every discipline is a complete profile', () => {
  it('names its place, its competitor and its match', () => {
    for (const d of DISCIPLINES) {
      expect(en[d.label], `${d.id} has no name`).toBeTruthy();
      expect(en[d.venue], `${d.id} venue`).toBeTruthy();
      expect(en[d.participant], `${d.id} participant`).toBeTruthy();
      expect(en[d.match], `${d.id} match`).toBeTruthy();
      expect(['individual', 'team']).toContain(d.competing);
    }
  });

  it('lists only templates that exist, and never an empty list of broken ids', () => {
    for (const d of DISCIPLINES) {
      for (const id of d.templates ?? []) {
        expect(PRESETS.some(p => p.id === id), `${d.id} points at missing preset ${id}`).toBe(true);
      }
    }
    for (const d of DISCIPLINES) {
      const t = templatesFor(d.id);
      expect(t.length, `${d.id} offered templates that resolved to nothing`).toBe(
        (d.templates ?? []).length);
    }
  });
});

describe('choosing a discipline changes what is offered', () => {
  it('each sport offers its own templates', () => {
    // Chess is run Swiss far more often than football is, so the two must not
    // offer the same list.
    const chess = templatesFor('chess').map(x => x.preset.id);
    const football = templatesFor('football').map(x => x.preset.id);
    expect(chess[0]).toBe('swiss-large');
    expect(football).not.toContain('swiss-large');
    expect(new Set(chess).size).toBe(chess.length);
  });

  it('a template is limited to its own format, so it can never leak settings', () => {
    for (const id of ['volleyball', 'chess', 'sailing', 'football']) {
      for (const tpl of templatesFor(id)) {
        expect(presetsFor(tpl.format).some(p => p.id === tpl.preset.id),
          `${id}: ${tpl.preset.id} is not offered by its own format`).toBe(true);
      }
    }
  });

  it('templates are a starting point: what they load stays editable', () => {
    const tpl = templatesFor('volleyball')[0];
    const loaded = applyTemplate(rules({ swissRounds: 9 }), tpl);
    // The template set what it declares…
    expect(loaded.allowDraws).toBe(tpl.preset.rules.allowDraws);
    // …and left everything it did not mention exactly as the organizer had it.
    expect(loaded.swissRounds).toBe(9);
    // …and applying it twice is the same as applying it once.
    expect(applyTemplate(loaded, tpl)).toEqual(loaded);
  });
});

describe('a discipline changes the vocabulary, not the rules themselves', () => {
  it('uses the word the sport uses, and falls back when none is chosen', () => {
    expect(venueLabel(tour('sailing'))).toBe(en['disc.venue.start']);
    expect(venueLabel(tour('table-tennis'))).toBe(en['disc.venue.table']);
    expect(venueLabel(tour('football'))).toBe(en['disc.venue.pitch']);
    expect(matchLabel(tour('sailing'))).toBe(en['disc.match.race']);
    expect(matchLabel(tour('volleyball'))).toBe(en['disc.match.set']);
    // No discipline at all is the neutral app, not a broken one.
    expect(venueLabel(tour(null))).toBe(en['disc.venue.place']);
    expect(matchLabel(tour(undefined))).toBe(en['disc.match.match']);
    expect(participantLabel(tour(undefined))).toBe(en['doc.player']);
  });

  it('applying a discipline sets its defaults and its kind of competitor', () => {
    const volley = applyDiscipline(tour(), 'volleyball');
    expect(volley.discipline).toBe('volleyball');
    expect(volley.individualOrTeam).toBe('team');
    expect(volley.rules.periodPoints).toBe(25);
    expect(volley.rules.allowDraws).toBe(false);

    // Choosing no discipline clears the choice and touches no rules at all.
    const kept = { ...tour('chess'), rules: rules({ winPoints: 7 }) };
    const none = applyDiscipline(kept, null);
    expect(none.discipline).toBeNull();
    expect(none.rules.winPoints).toBe(7);
  });

  it('a discipline never decides something the engine owns', () => {
    // The vocabulary layer labels things; the technical values stay neutral so
    // that saved files and QR links mean the same thing in every sport.
    expect(disciplineOf(tour('sailing')).venueKind).toBe('lane');
    expect(disciplineOf(tour('table-tennis')).venueKind).toBe('table');
  });
});

describe('the printed document speaks the discipline', () => {
  // The export is the one place the wording cannot be quietly corrected later:
  // what is wrong here is wrong on paper, in the organizer's hand.
  const scheduleOf = (discipline: string) => {
    const t0 = { ...tour(discipline), format: 'league' as const };
    const r = buildReport({
      tournament: t0,
      participants: [
        { id: 'p1', name: 'Lions', active: true, seed: 1 },
        { id: 'p2', name: 'Tigers', active: true, seed: 2 },
      ],
      groups: [],
      matches: [{
        id: 'm1', round: 1, roundName: 'Round 1', homeId: 'p1', awayId: 'p2',
        result: { status: 'scheduled', homeScore: null, awayScore: null, winnerId: null },
        scheduledAt: '2026-10-02T10:00:00.000Z', venue: 'Start A', resourceId: 'r1', durationMin: 60,
      }],
      resources: [{ id: 'r1', name: 'Start A', kind: 'lane' }],
      branding: undefined,
      generatedAt: '2026-10-02T09:00:00.000Z',
    }, 'schedule');
    return r.sections.flatMap(s => s.columns.map(c => c.label));
  };

  it('names the place of play the way the sport names it', () => {
    expect(scheduleOf('sailing')).toContain(en['disc.venue.start']);
    expect(scheduleOf('table-tennis')).toContain(en['disc.venue.table']);
    expect(scheduleOf('football')).toContain(en['disc.venue.pitch']);
  });

  it('keeps the neutral wording when no sport is chosen', () => {
    // `disc.venue.place` and the old `doc.courtTable` are both "Place" in
    // English, so only the discipline key can prove which one is in use.
    expect(scheduleOf(null)).toContain(en['disc.venue.place']);
    expect(scheduleOf('volleyball')).toContain(en['disc.venue.court']);
    expect(scheduleOf('volleyball')).not.toContain(en['disc.venue.pitch']);
  });

  it('names the sport in the header line of the printed sheet', () => {
    // A sheet handed to a scorer has to say whose rules it is under. Without a
    // discipline the header is left exactly as it was.
    const head = (discipline: string) => buildReport({
      tournament: tour(discipline), participants: [], groups: [], matches: [],
      resources: [], branding: undefined, generatedAt: '2026-10-02T09:00:00.000Z',
    }, 'standings').meta.contextLine;
    expect(head('volleyball')).toBe(en['disc.volleyball']);
    expect(head('sailing')).toBe(en['disc.sailing']);
    expect(head(null)).toBe('');
  });
});

describe('the defaults a sport declares', () => {
  const line = (id: string) => templateDefaultsLine(disciplineOf(tour(id)), k => en[k] as string) ?? '';

  it('states the real numbers, not a hand-written claim', () => {
    expect(line('volleyball')).toContain('25 points per set');
    expect(line('volleyball')).toContain('win 3 sets');
    expect(line('volleyball')).toContain(en['disc.def.noDraw']);
    expect(line('football')).toContain('3 for a win, 1 for a draw');
    expect(line('chess')).toContain('1 for a win, 0.5 for a draw');
    expect(line('chess')).toContain(en['disc.def.draw']);
  });

  it('declares nothing for the neutral profile', () => {
    // The generic sport has no defaults to announce, so it announces none.
    expect(disciplineOf(tour(null)).defaults).toEqual({});
  });
});

describe('the neutral tournament still works', () => {
  it('no discipline means no templates of its own and the format decides', () => {
    expect(templatesFor(null)).toEqual([]);
    expect(templatesFor('unknown-sport')).toEqual([]);
    expect(presetsFor('single-elimination').length).toBeGreaterThan(0);
  });

  it('reports the app version in every language without a discipline', () => {
    for (const loc of ['en', 'pl', 'de', 'es'] as const) {
      setLocale(loc);
      expect(venueLabel(tour(null)), loc).toBeTruthy();
    }
    setLocale('en');
  });
});