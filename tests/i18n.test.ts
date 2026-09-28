// Localization: lookup, fallback, settings resolution, live switching, and the
// promise that all four languages stay key-for-key identical.
import { describe, it, expect, afterEach } from 'vitest';
import {
  LOCALES, LOCALE_NAMES, detectLocale, getLocale, localeFromTag, resolveLocale,
  setLocale, translate,
} from '../src/i18n';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { de } from '../src/i18n/de';
import { es } from '../src/i18n/es';
import { describeFormat, genRoundRobin } from '../src/engine/generate';
import { genSingleElim } from '../src/engine/elim';
import { matchStatusLabel } from '../src/engine/output';
import { validateTournament } from '../src/engine/validate';
import { DEFAULT_RULES, type Participant } from '../src/engine/types';

const DICTS = { en, pl, de, es } as Record<string, Record<string, string>>;
const players = (names: string): Participant[] => names.split('').map((name, i) => ({
  id: `p${i}`, name, kind: 'player', active: true, seed: i + 1,
}));

afterEach(() => setLocale('en'));

describe('dictionaries', () => {
  it('ships the same keys in every language', () => {
    const base = Object.keys(DICTS.en).sort();
    for (const loc of LOCALES) {
      expect(Object.keys(DICTS[loc]).sort(), `keys of ${loc}`).toEqual(base);
    }
  });

  it('uses the same placeholders in every language', () => {
    const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    for (const [key, value] of Object.entries(DICTS.en)) {
      for (const loc of LOCALES) {
        expect(holes(DICTS[loc][key]), `${key} in ${loc}`).toEqual(holes(value));
      }
    }
  });

  it('translates a shared key and fills parameters', () => {
    expect(translate('pl', 'common.save')).toBe(pl['common.save']);
    expect(translate('de', 'res.openOf', { open: 2, total: 7 })).toContain('2');
    expect(translate('es', 'res.openOf', { open: 2, total: 7 })).toContain('7');
  });

  it('never throws and never shows a blank label', () => {
    for (const loc of LOCALES) {
      expect(translate(loc, 'definitely.not.a.key')).toBe('definitely.not.a.key');
      expect(translate(loc, 'definitely.not.a.key', { a: 1 })).toBe('definitely.not.a.key');
    }
  });

  it('gives every language an endonym for the switch', () => {
    expect(LOCALE_NAMES.pl).toBe('Polski');
    expect(LOCALE_NAMES.de).toBe('Deutsch');
    expect(LOCALE_NAMES.es).toBe('Español');
  });
});

describe('language resolution', () => {
  it('maps a system tag to a supported language', () => {
    expect(localeFromTag('pl-PL')).toBe('pl');
    expect(localeFromTag('de_AT')).toBe('de');
    expect(localeFromTag('es-419')).toBe('es');
    expect(localeFromTag('fr-FR')).toBe('en');
    expect(localeFromTag(undefined)).toBe('en');
  });

  it('resolves the stored preference, "system" included', () => {
    expect(resolveLocale('pl')).toBe('pl');
    expect(resolveLocale('system')).toBe(detectLocale());
    expect(resolveLocale(null)).toBe(detectLocale());
    expect(resolveLocale('nonsense' as never)).toBe(detectLocale());
  });

  it('switches the active language for non-React callers', () => {
    expect(getLocale()).toBe('en');
    setLocale('de');
    expect(getLocale()).toBe('de');
    expect(describeFormat('single-elimination')).toBe(de['format.single-elimination']);
    expect(matchStatusLabel('played')).toBe(de['doc.played']);
    expect(validateTournament({})[0].message).toBe(de['engine.nameRequired']);
  });

  it('follows the language everywhere the engine speaks', () => {
    for (const loc of LOCALES) {
      setLocale(loc);
      const d = DICTS[loc];
      expect(describeFormat('groups-knockout')).toBe(d['format.groups-knockout']);
      expect(describeFormat('league')).toBe(d['format.league']);
      expect(matchStatusLabel('walkover')).toBe(d['doc.walkover']);
      expect(matchStatusLabel('bye')).toBe(d['doc.bye']);
      expect(validateTournament({ name: '', sport: '', format: '' })).toEqual([
        { field: 'name', message: d['engine.nameRequired'] },
        { field: 'sport', message: d['engine.sportRequired'] },
        { field: 'format', message: d['engine.formatRequired'] },
      ]);
    }
  });

  it('writes generated round names in the chosen language', () => {
    const eight = players('ABCDEFGH');
    const elim = () => [...new Set(genSingleElim(eight, DEFAULT_RULES).matches.map(m => m.roundName))];
    const rr = () => [...new Set(genRoundRobin(eight, DEFAULT_RULES).map(m => m.roundName))];
    setLocale('pl');
    expect(elim()).toEqual([pl['round.quarter'], pl['round.semi'], pl['round.final']]);
    expect(rr()[0]).toBe(pl['round.n'].replace('{n}', '1'));
    setLocale('de');
    expect(elim()).toEqual([de['round.quarter'], de['round.semi'], de['round.final']]);
    expect(rr()[0]).toBe(de['round.n'].replace('{n}', '1'));
  });
});
