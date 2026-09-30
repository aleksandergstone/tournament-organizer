// The registry is a contract, not a suggestion. These tests are the only thing
// standing between "we moved a core feature to Pro by accident" and a customer
// who cannot run their tournament.
import { describe, expect, it } from 'vitest';
import {
  CORE_FEATURE_IDS, FEATURE_REGISTRY, FREE_FEATURE_IDS, PRO_FEATURE_IDS,
  accessOf, classOf, entryOf, idsWithClass,
} from '../src/engine/feature-registry';
import { FEATURES, has, proFeatures, tierOf } from '../src/engine/features';

describe('every feature is classified exactly once', () => {
  it('has no duplicate ids', () => {
    const ids = FEATURE_REGISTRY.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a name, a class and a reason', () => {
    for (const e of FEATURE_REGISTRY) {
      expect(e.name.length, e.id).toBeGreaterThan(0);
      expect(['free', 'pro', 'reporting', 'planned'], e.id).toContain(e.class);
      expect(e.why.length, e.id).toBeGreaterThan(10);
    }
  });

  it('uses only the four declared classes', () => {
    const classes = new Set(FEATURE_REGISTRY.map(e => e.class));
    expect([...classes].sort()).toEqual(['free', 'planned', 'pro', 'reporting']);
  });
});

describe('access is derived from the class, never declared', () => {
  it('maps free and reporting to always', () => {
    for (const id of idsWithClass('free').concat(idsWithClass('reporting'))) {
      expect(accessOf(id), id).toBe('always');
    }
  });
  it('maps pro to license', () => {
    for (const id of PRO_FEATURE_IDS) expect(accessOf(id), id).toBe('license');
  });
  it('maps planned — and anything unknown — to none', () => {
    for (const id of idsWithClass('planned')) expect(accessOf(id), id).toBe('none');
    expect(accessOf('does.not.exist')).toBe('none');
    expect(classOf('does.not.exist')).toBeNull();
    expect(entryOf('does.not.exist')).toBeNull();
  });
});

describe('the core product stays free', () => {
  it('lists every core feature, and each one is still free', () => {
    expect(CORE_FEATURE_IDS.length).toBeGreaterThan(10);
    for (const id of CORE_FEATURE_IDS) {
      expect(classOf(id), id).toBe('free');
      expect(has(id), id).toBe(true);
      expect(tierOf(id), id).toBe('free');
    }
  });

  it('covers the workflow the acceptance criteria name', () => {
    const required = [
      'project.create',          // create tournaments
      'participants.manage',     // add participants
      'generation.structure',    // brackets / tables / schedules
      'schedule.generate',
      'results.entry',           // enter results
      'standings.view',
      'export.csv', 'export.print', 'export.pdf',   // export basic outputs
      'app.offline',             // works offline
    ];
    for (const id of required) expect(CORE_FEATURE_IDS, id).toContain(id);
  });

  it('never puts a data-out feature behind Pro', () => {
    for (const id of ['project.export', 'export.csv', 'export.pdf', 'export.print']) {
      expect(accessOf(id), id).toBe('always');
    }
  });
});

describe('free users keep the whole app', () => {
  it('grants every free and reporting feature with no license', () => {
    for (const id of FREE_FEATURE_IDS) expect(has(id), id).toBe(true);
  });

  it('locks every Pro feature with no license', () => {
    for (const f of proFeatures()) expect(has(f.id), f.id).toBe(false);
  });

  it('never grants a planned feature, even to a previewed Pro tier', () => {
    for (const id of idsWithClass('planned')) {
      expect(has(id), id).toBe(false);
      expect(has(id, { tier: 'pro' }), id).toBe(false);
    }
  });

  it('grants unknown ids to nobody', () => {
    expect(has('does.not.exist')).toBe(false);
    expect(has('does.not.exist', { tier: 'pro' })).toBe(false);
    expect(tierOf('does.not.exist')).toBeNull();
  });
});

describe('the compatibility view matches the registry', () => {
  it('exposes the same entries, in the same order', () => {
    expect(FEATURES).toBe(FEATURE_REGISTRY);
  });

  it('reports pro as the tier that unlocks it, everything else as free', () => {
    for (const e of FEATURE_REGISTRY) {
      const expected = e.class === 'pro' ? 'pro' : e.class === 'planned' ? null : 'free';
      expect(tierOf(e.id), e.id).toBe(expected);
    }
  });
});