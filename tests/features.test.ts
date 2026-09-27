import { describe, expect, it } from 'vitest';
import { DEFAULT_TIER, FEATURES, availableFeatures, describeEdition, has } from '../src/engine/features';

describe('free/pro feature boundary', () => {
  it('grants every feature on the free tier when tier is free', () => {
    for (const f of FEATURES.filter(x => x.tier === 'free')) {
      expect(has(f.id, { tier: 'free' })).toBe(true);
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
  it('pro features stay locked at free tier and unlock at pro', () => {
    for (const f of FEATURES.filter(x => x.tier === 'pro')) {
      expect(has(f.id, { tier: 'free' })).toBe(false);
      expect(has(f.id, { tier: 'pro' })).toBe(true);
    }
  });
  it('unknown feature ids are denied, never granted', () => {
    expect(has('does.not.exist')).toBe(false);
    expect(has('does.not.exist', { tier: 'pro' })).toBe(false);
  });
  it('local flags override tier (opt-in / testing)', () => {
    expect(has('export.pdf', { tier: 'free', flags: { 'export.pdf': true } })).toBe(true);
    expect(has('project.export', { tier: 'pro', flags: { 'project.export': false } })).toBe(false);
  });
  it('defaults are free tier with all core features available', () => {
    expect(DEFAULT_TIER).toBe('free');
    expect(availableFeatures('free').length).toBeGreaterThan(0);
    expect(describeEdition('free')).toContain('Free');
    expect(describeEdition('pro')).toBe('Pro');
  });
});