// Localization guards for the last user-facing English sentences. The history
// panel used to print raw machine keys, and seven dialogs and errors were
// hard-coded English in every language; these tests make that impossible again.
import { describe, expect, it, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { LOCALES, setLocale, translate } from '../src/i18n';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import { de } from '../src/i18n/de';
import { es } from '../src/i18n/es';
import { describeAudit, KNOWN_AUDIT_ACTIONS } from '../src/engine/audit';

// Resolved from this file, not hard-coded: the suite runs on Linux CI too.
const root = join(__dirname, '..', 'src') + sep;
const DICTS = { en, pl, de, es };
const sources = () => readdirSync(root + 'ui').filter(f => f.endsWith('.tsx'))
  .map(f => readFileSync(root + 'ui' + sep + f, 'utf8'))
  .concat([readFileSync(root + 'state' + sep + 'store.tsx', 'utf8')]);

afterEach(() => setLocale('en'));

describe('the history panel speaks the organizer’s language', () => {
  const samples = [
    'participant.add Anna', 'participant.bulk 12', 'participant.edit', 'participant.remove Bob',
    'rules.edit', 'format.change', 'structure.generate 7', 'result.edit Anna-Bob',
    'result.score-draft', 'knockout.seeded', 'tournament.finished', 'lan.sync',
    'branding.updated', 'project.created', 'project.opened-file',
  ];

  it('translates every action the app writes', () => {
    setLocale('de');
    for (const action of samples) {
      const line = describeAudit(action);
      const token = action.split(' ')[0];
      // The sentence must not be the machine key any more.
      expect(line.label, token).not.toBe(action);
      expect(line.label, token).not.toContain('participant.');
      expect(line.label.length, token).toBeGreaterThan(3);
    }
  });

  it('says something different in each language', () => {
    const labels = LOCALES.map(loc => {
      setLocale(loc);
      return describeAudit('participant.add Anna').label;
    });
    expect(new Set(labels).size).toBe(LOCALES.length);
  });

  it('keeps the name or the count as the detail, not in the sentence', () => {
    setLocale('en');
    expect(describeAudit('participant.add Anna').detail).toBe('Anna');
    // The count is already in the sentence, so the detail column stays empty.
    expect(describeAudit('structure.generate 7').detail).toBe('');
    expect(describeAudit('structure.generate 7').label).toContain('7');
    expect(describeAudit('project.created', 'Cup').label).toBe(en['audit.projectCreated']);
    expect(describeAudit('project.created', 'Cup').detail).toBe('Cup');
  });

  it('still shows something for an action it has never seen', () => {
    setLocale('pl');
    const line = describeAudit('something.new 3', 'x');
    expect(line.label).toBe('something.new 3');
    expect(line.detail).toBe('x');
  });

  it('covers every action written in the source', () => {
    const written = new Set<string>();
    for (const src of sources()) {
      for (const m of src.matchAll(/update\([^,]*,\s*'([a-z][a-z.-]*)/g)) written.add(m[1].split(' ')[0]);
      for (const m of src.matchAll(/action:\s*'([a-z][a-z.-]*)/g)) written.add(m[1]);
    }
    written.delete('knockout.seed');
    for (const token of written) {
      expect(KNOWN_AUDIT_ACTIONS, `action "${token}" has no sentence`).toContain(token);
    }
  });
});

describe('no user-facing sentence is hard-coded English', () => {
  const forbidden = [
    [/window\.confirm\('/, 'window.confirm with a literal'],
    [/window\.alert\('/, 'window.alert with a literal'],
    [/setErr\('[A-Z]/, 'setErr with a literal'],
    [/setMsg\('[A-Z]/, 'setMsg with a literal'],
    [/title="[A-Z]/, 'a hard-coded panel title'],
  ];

  it('has none in any screen', () => {
    const found: string[] = [];
    for (const src of sources()) {
      for (const [re, why] of forbidden) {
        if (re.test(src)) found.push(why);
      }
    }
    expect(found, found.join(', ')).toEqual([]);
  });

  it('has the seven sentences it needed, in all four languages', () => {
    const keys = ['err.fileUnreadable', 'err.actionFailed', 'sch.errNoPlaces',
      'sch.msgAllScheduled', 'sch.errNoSlot', 'st.confirmFinish', 'store.openedPath'];
    for (const key of keys) {
      for (const loc of LOCALES) {
        expect(DICTS[loc][key], `${key} in ${loc}`).toBeTruthy();
        expect(DICTS[loc][key], key).not.toBe(key);
      }
    }
  });

  it('keeps the line breaks in the confirm dialog', () => {
    for (const loc of LOCALES) {
      expect(DICTS[loc]['st.confirmFinish'], loc).toContain('\n');
    }
    setLocale('pl');
    expect(translate('pl', 'st.confirmFinish')).toBe(pl['st.confirmFinish']);
  });
});
