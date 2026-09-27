// Free / Pro product boundary — pure logic, no UI, no payments, no network.
//
// This module is the single place where feature entitlements live. The UI
// asks `has()` before enabling an optional capability; everything the app
// does today is declared `free`, so current behaviour never changes.
//
// Future monetization path (deliberately deferred):
//   1. Add a Pro feature id below and mark it `tier: 'pro'`.
//   2. Ship a license activator that sets `tier: 'pro'` in AppSettings
//      (stored offline in the project file — no account system required).
//   3. Nothing else changes: the engine, import/export and all core
//      workflows stay fully functional on the free tier, offline.

export type Tier = 'free' | 'pro';

export interface FeatureDef {
  id: string;
  label: string;
  tier: Tier;        // lowest tier that includes the feature
}

// Register features here. Core workflow features MUST stay 'free'.
export const FEATURES: readonly FeatureDef[] = [
  { id: 'project.create',     label: 'Create & edit tournaments',   tier: 'free' },
  { id: 'project.import',     label: 'Import / recovery',           tier: 'free' },
  { id: 'project.export',     label: 'Export project & CSV',        tier: 'free' },
  { id: 'results.entry',      label: 'Result entry & undo/redo',    tier: 'free' },
  { id: 'standings.view',     label: 'Standings & tiebreaks',       tier: 'free' },
  { id: 'print.summary',      label: 'Print summary',               tier: 'free' },
  // Reserved for a future Pro edition — referenced by nothing yet, so they
  // cannot block or break the current offline workflow.
  { id: 'export.pdf',         label: 'PDF bracket export',          tier: 'pro' },
  { id: 'templates.saved',    label: 'Saved tournament templates',  tier: 'pro' },
];

export const DEFAULT_TIER: Tier = 'free';

export interface EntitlementContext {
  tier?: Tier;
  /** Local overrides (e.g. beta unlocks). Absent = no override. */
  flags?: Record<string, boolean>;
}

/** Is a feature available given tier + optional local overrides? */
export function has(featureId: string, ctx: EntitlementContext = {}): boolean {
  // Local flags win — useful for testing and opt-in betas, never shipped by default.
  const flag = ctx.flags?.[featureId];
  if (typeof flag === 'boolean') return flag;
  const f = FEATURES.find(x => x.id === featureId);
  if (!f) return false; // unknown features are never silently granted
  const tier = ctx.tier ?? DEFAULT_TIER;
  return f.tier === 'free' || tier === 'pro';
}

/** All feature ids available at a tier — handy for UI badges and About text. */
export function availableFeatures(tier: Tier = DEFAULT_TIER): string[] {
  return FEATURES.filter(f => has(f.id, { tier })).map(f => f.id);
}

/** Human-readable edition name for Settings/About. */
export function describeEdition(tier: Tier = DEFAULT_TIER): string {
  return tier === 'pro' ? 'Pro' : 'Free — all core features included';
}
