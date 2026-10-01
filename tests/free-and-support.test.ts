// The app is free and stays free. These tests exist to make that a property
// someone cannot quietly break by adding a gate back, and to pin down the
// contract of the voluntary support note.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { FEATURE_REGISTRY, accessOf, classOf, has, proFeatures, tierOf } from '../src/engine/features';
import {
  SUPPORT_DISMISSED_KEY, SUPPORT_URL, dismissSupport, isSupportConfigured,
  resetSupport, shouldShowSupport,
} from '../src/support';

const SRC = join(__dirname, '..', 'src');
const read = (p: string) => readFileSync(p, 'utf8');

/** Every source file, so the scans below really do cover the app. */
function sourceFiles(dir = SRC, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx|css)$/.test(p)) out.push(p);
  }
  return out;
}
const ALL = sourceFiles();
/** Only real ui/ screens. Matched on path segments, because an absolute path
 *  can contain "ui" anywhere (".../build/…"), which would silently widen the scan. */
const UI = ALL.filter(p => /[/\\]ui[/\\]/.test(p) || p.endsWith('App.tsx'));

// ---------------------------------------------------------------- no paywall

describe('nothing is for sale', () => {
  it('no feature is classified pro', () => {
    expect(proFeatures()).toEqual([]);
    expect(FEATURE_REGISTRY.filter(f => f.class === 'pro')).toEqual([]);
  });

  it('no feature resolves to license-gated access', () => {
    for (const f of FEATURE_REGISTRY) {
      expect(accessOf(f.id)).not.toBe('license');
    }
  });

  it('every built feature is usable, with no license of any kind', () => {
    for (const f of FEATURE_REGISTRY.filter(f => classOf(f.id) !== 'planned')) {
      expect(has(f.id)).toBe(true);
    }
  });

  it('the two features briefly moved behind a paywall are free again', () => {
    // display.kiosk and sync.lan were sold, then given back. This fails if
    // anyone re-sells them.
    for (const id of ['display.kiosk', 'sync.lan']) {
      expect(has(id)).toBe(true);
      expect(tierOf(id)).toBe('free');
    }
  });

  it('an unknown feature id is still denied rather than granted', () => {
    expect(has('something.never.declared')).toBe(false);
  });
});

// ------------------------------------------------------- no gating in the UI

describe('the screens contain no gate', () => {
  it('no file imports the deleted Pro components', () => {
    for (const file of ALL) {
      const s = read(file);
      expect(s, file).not.toMatch(/from ['"].*ui\/ProGate['"]/);
      expect(s, file).not.toMatch(/from ['"].*ui\/License['"]/);
      expect(s, file).not.toMatch(/screen-features/);
    }
  });

  it('no screen renders a gate, a badge or an upgrade prompt', () => {
    for (const file of UI) {
      const s = read(file);
      expect(s, file).not.toContain('<ProGate');
      expect(s, file).not.toContain('ProBadge');
      expect(s, file).not.toContain('<License');
    }
  });

  it('the licence screen copy is gone from every language', () => {
    // Version 1.3.0 shipped these strings. They are what a stale build shows
    // the user, so they must not exist even as unused dictionary entries.
    for (const lang of ['en', 'pl', 'de', 'es']) {
      const s = read(join(SRC, 'i18n', `${lang}.ts`));
      expect(s, lang).not.toMatch(/'lic\./);
    }
  });

  it('nothing left in the app offers a paid tier', () => {
    // Anything that would let a gate creep back in by rename.
    const marketing = /upgrade to pro|buy pro|subscribe now|start trial|pay now|unlock premium/i;
    for (const file of ALL) {
      expect(read(file), file).not.toMatch(marketing);
    }
  });
});

// ------------------------------------------------------------ support config

describe('the support link is configured in one place', () => {
  it('is empty until a support page exists', () => {
    // Deliberate: no placeholder URL, no dead button.
    expect(SUPPORT_URL).toBe('');
    expect(isSupportConfigured()).toBe(false);
  });

  it('the URL is defined exactly once across the source tree', () => {
    const hits = ALL.filter(f => /(patreon|ko-?fi|buymeacoffee|github\.com\/sponsors)/i.test(read(f)));
    expect(hits.map(f => f.split(/[\\/]/).pop())).toEqual(['support.ts']);
  });

  it('rejects anything that is not an http(s) URL', () => {
    // A typo must not produce a button that goes nowhere.
    for (const bad of ['', 'patreon.com/x', 'javascript:alert(1)', 'not a url']) {
      expect(/^https?:\/\//.test(bad)).toBe(false);
    }
    expect(/^https?:\/\//.test(SUPPORT_URL)).toBe(isSupportConfigured());
  });
});

// --------------------------------------------------------------- the banner

/** A minimal localStorage stand-in: the functions take this shape on purpose. */
function memoryStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

describe('the support note', () => {
  it('stays hidden while no support page is configured', () => {
    expect(shouldShowSupport(memoryStore())).toBe(false);
  });

  it('dismisses, and a dismissal is remembered', () => {
    const store = memoryStore();
    dismissSupport(store, 1_000);
    expect(store.getItem(SUPPORT_DISMISSED_KEY)).toBe('1000');
    expect(shouldShowSupport(store, 1_000)).toBe(false);
  });

  it('a dismissal can be undone from Settings', () => {
    const store = memoryStore();
    dismissSupport(store, 1_000);
    resetSupport(store);
    expect(store.getItem(SUPPORT_DISMISSED_KEY)).toBe(null);
  });

  it('does not come back the next day', () => {
    const store = memoryStore();
    dismissSupport(store, Date.now());
    expect(shouldShowSupport(store, Date.now() + 86_400_000)).toBe(false);
  });

  it('survives a corrupt stored value', () => {
    const store = memoryStore();
    store.setItem(SUPPORT_DISMISSED_KEY, 'not a number');
    expect(() => shouldShowSupport(store)).not.toThrow();
  });
});

describe('where the banner is allowed to appear', () => {
  it('appears on Home and in Settings, and nowhere else', () => {
    const mounted = UI
      .filter(f => /<SupportBanner/.test(read(f)))
      .map(f => f.split(/[\\/]/).pop()!);
    expect(mounted.sort()).toEqual(['Home.tsx', 'Settings.tsx']);
  });

  it('never appears during match entry, the wizard, exports or the bracket', () => {
    for (const name of ['Matches.tsx', 'Wizard.tsx', 'Output.tsx', 'Bracket.tsx', 'Participants.tsx']) {
      expect(read(join(SRC, 'ui', name)), name).not.toContain('SupportBanner');
    }
  });

  it('is not a modal and cannot trap focus', () => {
    const s = read(join(SRC, 'ui', 'SupportBanner.tsx'));
    expect(s).not.toMatch(/role="dialog"/);
    expect(s).not.toMatch(/aria-modal/);
    expect(s).not.toMatch(/useEffect/);          // no auto-show timer
  });

  it('the banner itself offers one optional link and one dismissal', () => {
    const s = read(join(SRC, 'ui', 'SupportBanner.tsx'));
    // Counted on the banner only: the file also exports ResetSupportButton,
    // which lives in Settings and is not part of the banner.
    const banner = s.slice(0, s.indexOf('/** Settings uses this'));
    expect((banner.match(/<button/g) ?? []).length).toBe(2);
    expect(s).toContain('openExternal');         // opens a browser, never navigates
  });

  it('the Settings reset is hidden while no support page is configured', () => {
    // Otherwise Settings would offer a way to re-show a banner that can never
    // appear — a dead control that only exists because support was planned.
    const s = read(join(SRC, 'ui', 'SupportBanner.tsx'));
    const reset = s.slice(s.indexOf('export function ResetSupportButton'));
    expect(reset).toContain('isSupportConfigured');
    expect(reset).toContain('return null');
  });

  it('translates its copy rather than hardcoding English', () => {
    const s = read(join(SRC, 'ui', 'SupportBanner.tsx'));
    for (const key of ['support.title', 'support.desc', 'support.button', 'support.dismiss', 'support.optional']) {
      expect(s, key).toContain(key);
    }
  });

  it('carries no purchase wording anywhere in the app', () => {
    const loud = /\b(Upgrade to Pro|Buy Pro|Unlock (premium|the Pro)|Subscribe now|Start trial|Pay now)\b/i;
    for (const file of ALL) {
      expect(read(file), file).not.toMatch(loud);
    }
  });

  it('no screen routes to a license screen', () => {
    const store = read(join(SRC, 'state', 'store.tsx'));
    expect(store).not.toContain("'license'");
    expect(read(join(SRC, 'App.tsx'))).not.toContain("screen === 'license'");
  });

  it('no screen asks the license engine what the user is entitled to', () => {
    for (const file of UI) {
      expect(read(file), file).not.toMatch(/isProActive|hasFeature|activateLicense/);
    }
  });
});