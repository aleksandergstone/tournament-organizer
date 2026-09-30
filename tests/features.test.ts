// How the boundary behaves against a real license. The classification rules
// themselves live in feature-registry.test.ts; this file is about the live answer.
import { beforeEach, describe, expect, it } from 'vitest';
import { availableFeatures, describeEdition, entryOf, has, proFeatures, tierOf } from '../src/engine/features';
import { FEATURE_REGISTRY } from '../src/engine/feature-registry';
import { deactivateLicense, isProActive, refreshLicense, setLicenseStore } from '../src/engine/license';

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
  it('starts Free and stays Free with nothing installed', () => {
    expect(isProActive()).toBe(false);
    expect(describeEdition()).toContain('Free');
    expect(describeEdition('pro')).toBe('Pro');
  });

  it('grants every feature the registry calls free or reporting', () => {
    for (const e of FEATURE_REGISTRY.filter(x => x.class === 'free' || x.class === 'reporting')) {
      expect(has(e.id), e.id).toBe(true);
      expect(tierOf(e.id), e.id).toBe('free');
    }
  });

  it('locks every Pro feature while free', () => {
    for (const f of proFeatures()) expect(has(f.id), f.id).toBe(false);
  });

  it('lets a preview context show Pro features, but not grant them', () => {
    for (const f of proFeatures()) {
      expect(has(f.id, { tier: 'pro' }), f.id).toBe(true);
      expect(has(f.id), f.id).toBe(false);      // the real answer is still no
    }
  });

  it('lists the same features for any tier argument — the license decides', () => {
    expect(availableFeatures('pro')).toEqual(availableFeatures('free'));
    expect(availableFeatures().length).toBeGreaterThan(0);
  });

  it('keeps every core workflow entry in the registry as free', () => {
    for (const id of ['project.create', 'participants.manage', 'generation.structure',
      'results.entry', 'standings.view', 'schedule.generate', 'export.csv', 'app.offline']) {
      expect(entryOf(id)?.class, id).toBe('free');
    }
  });
});