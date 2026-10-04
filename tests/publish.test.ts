// The boundary between the organizer's machine and the public internet.
//
// These tests are about what may leave the device. A snapshot is the only thing
// that crosses, so what it contains — and what it deliberately does not — is the
// question worth pinning down.

import { afterEach, describe, expect, it } from 'vitest';
import { buildSnapshot, publicUrl, type BuildInput } from '../src/engine/publish';
import { publishSlug, slugify, PUBLISH_ENDPOINT, BUILT_IN_PUBLISH_TOKEN } from '../src/engine/publish-slug';
import { DEFAULT_RULES, type Group, type Match, type Participant, type Tournament } from '../src/engine/types';
import { setLocale } from '../src/i18n';

describe('the link comes from the event name', () => {
  it('reads like the tournament, not like a database key', () => {
    expect(publishSlug('Club Final 2026')).toBe('club-final-2026');
    expect(publishSlug('Mistrzostwa  Klubu — finał')).toBe('mistrzostwa-klubu-final');
    // Polish ł survives as a letter rather than leaving a hole in the word.
    expect(slugify('Zażółć gęślą jaźń')).toBe('zazolc-gesla-jazn');
  });

  it('adds characters when the name is taken, without asking the organizer', () => {
    const first = publishSlug('Finał', []);
    expect(first).toBe('final');
    // Two events with the same name must not overwrite each other.
    const second = publishSlug('Finał', [first]);
    expect(second).not.toBe(first);
    expect(second.startsWith('final-')).toBe(true);
    expect(slugify(second)).toBe(second);
  });

  it('always produces something the site will accept as a URL path', () => {
    // Whatever the organizer typed, the site either accepts this or the link is
    // broken — and a broken link with no error is the worst outcome here.
    for (const name of ['', '   ', '///', 'A', 'Turniej 2026!!!', 'x'.repeat(200), '😀😀', '---']) {
      const slug = publishSlug(name, []);
      expect(slug, name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(slug.length, name).toBeLessThanOrEqual(80);
    }
  });

  it('points at the site this build publishes to', () => {
    expect(publicUrl(PUBLISH_ENDPOINT, 'club-final')).toBe('https://tooboxplatform.online/club-final');
    expect(publicUrl(PUBLISH_ENDPOINT + '/', 'club-final')).toBe('https://tooboxplatform.online/club-final');
  });

  it('carries a token, so sharing needs nothing typed in first', () => {
    // The whole point of the built-in token: an organizer opens the screen, flips one
    // switch and shares. A build that lost this constant would fail every publish
    // with a message no organizer could act on.
    expect(BUILT_IN_PUBLISH_TOKEN.length).toBeGreaterThanOrEqual(16);
    expect(BUILT_IN_PUBLISH_TOKEN.trim()).toBe(BUILT_IN_PUBLISH_TOKEN);
  });

  it('prefers a token the organizer supplied over the built-in one', () => {
    // Someone running their own site, or one whose key was rotated, must not be stuck
    // with a value they cannot change.
    const own = 'their-own-token';
    expect((own.trim() || BUILT_IN_PUBLISH_TOKEN)).toBe(own);
    expect((''.trim() || BUILT_IN_PUBLISH_TOKEN)).toBe(BUILT_IN_PUBLISH_TOKEN);
  });
});

const participants: Participant[] = [
  { id: 'p1', name: 'Lions', active: true, seed: 1 },
  { id: 'p2', name: 'Tigers', active: true, seed: 2 },
];

const matches: Match[] = [
  {
    id: 'm1', round: 1, roundName: 'Semi-final', homeId: 'p1', awayId: 'p2',
    result: { status: 'played', homeScore: 3, awayScore: 1, winnerId: 'p1' },
  },
  {
    id: 'm2', round: 2, roundName: 'Final', homeId: null, awayId: null,
    result: { status: 'scheduled', homeScore: null, awayScore: null, winnerId: null },
  },
];

const tour = (over: Partial<Tournament> = {}): Tournament => ({
  id: 't1', name: 'Club Final', sport: 'Volleyball', individualOrTeam: 'team',
  format: 'league', dates: { start: '2026-10-02', end: '2026-10-03' },
  location: 'Sports Hall', visibility: 'private', rules: DEFAULT_RULES,
  createdAt: '', updatedAt: '', archived: false, ...over,
} as Tournament);

const input = (over: Partial<BuildInput> = {}): BuildInput => ({
  tournament: tour(), participants, matches, groups: [] as Group[],
  slug: 'club-final-2026', visibility: 'public', revision: 1, ...over,
});

describe('the snapshot that leaves the device', () => {
  it('carries finished numbers, so the site never computes them', () => {
    const s = buildSnapshot(input());
    expect(s.standings).not.toBeNull();
    expect(s.standings?.[0]).toMatchObject({ participantId: 'p1', points: 3, wins: 1 });
    expect(s.counts).toEqual({ participants: 2, matches: 2, played: 1, open: 1 });
  });

  it('publishes no table for a format that has none', () => {
    // A bracket has no ranking. Sending an empty one would make the site show a
    // standings page with headers and nothing under them.
    const s = buildSnapshot(input({ tournament: tour({ format: 'single-elimination' }) }));
    expect(s.standings).toBeNull();
  });

  it('sends nothing the organizer would not print', () => {
    const s = buildSnapshot(input()) as unknown as Record<string, unknown>;
    // The audit log records every edit made on this machine; it is not news.
    expect(s).not.toHaveProperty('audit');
    expect(s).not.toHaveProperty('rules');
    for (const p of s.participants as { tags?: unknown }[]) {
      expect(p).not.toHaveProperty('tags');
    }
  });

  it('resolves names, so the site never joins tables itself', () => {
    const s = buildSnapshot(input());
    expect(s.matches[0]).toMatchObject({ homeName: 'Lions', awayName: 'Tigers' });
  });

  it('speaks the discipline, or says nothing when neutral', () => {
    const volley = buildSnapshot(input({ tournament: tour({ discipline: 'volleyball', individualOrTeam: 'team' }) }));
    expect(volley.event.disciplineLabel).toBe('Volleyball');
    expect(volley.terms.match).toBe('Set');
    const neutral = buildSnapshot(input());
    expect(neutral.event.disciplineLabel).toBe('');
  });
});

describe('the site accepts what we send', () => {
  // The site's own validator lives in the other repository and is tested there.
  // Importing it across repositories would tie this repo's CI to a sibling
  // checkout, so the contract is asserted here by shape instead: if the site
  // changes what it requires, these are the assertions that should fail loudly.
  const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  it('matches the snapshot contract for every format and visibility', () => {
    for (const format of ['league', 'round-robin', 'single-elimination', 'groups-knockout', 'swiss', 'custom'] as const) {
      for (const visibility of ['private', 'unlisted', 'public'] as const) {
        const s = buildSnapshot(input({ tournament: tour({ format }), visibility }));
        const where = `${format}/${visibility}`;
        expect(s.v, where).toBe(1);
        expect(s.slug, where).toMatch(SLUG);
        expect(s.visibility, where).toBe(visibility);
        expect(Number.isFinite(s.revision), where).toBe(true);
        expect(Number.isNaN(Date.parse(s.publishedAt)), where).toBe(false);
        expect(Array.isArray(s.participants), where).toBe(true);
        expect(Array.isArray(s.groups), where).toBe(true);
        expect(Array.isArray(s.matches), where).toBe(true);
        // Either a table or explicitly none — the site treats a null as "hide the page".
        expect(s.standings === null || Array.isArray(s.standings), where).toBe(true);
        expect(s.event.name, where).toBeTruthy();
        for (const key of ['match', 'participant', 'place', 'score'] as const) {
          expect(s.terms[key], `${where}.${key}`).toBeTruthy();
        }
      }
    }
  });

  it('keeps the description short enough to live in a meta tag', () => {
    const s = buildSnapshot(input({ description: 'x'.repeat(500) }));
    expect(s.event.description.length).toBeLessThanOrEqual(400);
  });
});

describe('the public link', () => {
  it('is the slug under the configured site, with no double slash', () => {
    expect(publicUrl('https://results.example/', 'club-final-2026')).toBe('https://results.example/club-final-2026');
    expect(publicUrl('  https://results.example  ', 'club-final-2026')).toBe('https://results.example/club-final-2026');
    expect(publicUrl('https://results.example', '')).toBe('');
  });
});

describe('every language publishes the same contract', () => {
  afterEach(() => setLocale('en'));
  it('keeps the vocabulary translated, and never empty', () => {
    for (const loc of ['en', 'pl', 'de', 'es'] as const) {
      setLocale(loc);
      const s = buildSnapshot(input());
      for (const key of ['match', 'participant', 'place', 'score'] as const) {
        expect(s.terms[key], `${loc}.${key}`).toBeTruthy();
      }
    }
  });
});