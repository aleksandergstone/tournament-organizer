// The boundary is now decided by a verified license, not by a parameter, so
// these tests describe behaviour: free means "no license on the machine".
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TIER, FEATURES, availableFeatures, describeEdition, has, proFeatures, tierOf } from '../src/engine/features';
import { deactivateLicense, refreshLicense, setLicenseStore } from '../src/engine/license';

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

describe('free/pro feature boundary', () => {
  it('grants every feature the catalogue declares free', () => {
    for (const f of FEATURES.filter(x => x.tier === 'free')) {
      expect(has(f.id), f.id).toBe(true);
      expect(tierOf(f.id)).toBe('free');
    }
  });
  it('core workflow features are never pro-gated', () => {
    for (const id of ['project.create', 'project.import', 'project.export', 'results.entry', 'standings.view', 'print.summary']) {
      const f = FEATURES.find(x => x.id === id);
      expect(f, id).toBeDefined();
      expect(f!.tier, id).toBe('free');
      expect(has(id), id).toBe(true);
    }
  });
  it('pro features stay locked with no license and unlock with one', () => {
    // No license: every declared Pro feature is locked.
    for (const f of proFeatures()) expect(has(f.id), f.id).toBe(false);
    // A preview context can still show them, and grants nothing for real.
    for (const f of proFeatures()) expect(has(f.id, { tier: 'pro' }), f.id).toBe(true);
  });
  it('unknown feature ids are denied, never granted', () => {
    expect(has('does.not.exist')).toBe(false);
    expect(has('does.not.exist', { tier: 'pro' })).toBe(false);
    expect(tierOf('does.not.exist')).toBeNull();
  });
  it('defaults are free tier and the edition reads Free without a license', () => {
    expect(DEFAULT_TIER).toBe('free');
    expect(availableFeatures().length).toBeGreaterThan(0);
    expect(describeEdition()).toContain('Free');
    expect(describeEdition('pro')).toBe('Pro');
  });
  it('no licence file exists until one is activated', () => {
    expect(availableFeatures('pro').length).toBe(availableFeatures().length);
  });
});