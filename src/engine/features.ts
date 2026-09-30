// Free / Pro product boundary — the catalogue of what exists and who gets it.
//
// The decision is no longer made here: `has()` asks the license engine, which
// derives the answer from a verified signature. This file is the single place
// where a feature is declared, so "is this Pro?" has one answer per feature and
// the License screen can list them without inventing anything.
//
// Core workflow features MUST stay 'free' — a free install can create a
// tournament, add participants, generate a structure, enter results, read
// standings, schedule, export and print. Pro adds the professional document
// tools on top; it never withholds the product itself.
import { t, type Dict } from '../i18n';
import { hasFeature, isProActive } from './license';

export type Tier = 'free' | 'pro';

export interface FeatureDef {
  id: string;
  labelKey: keyof Dict;  // translated by the UI, never frozen at load time
  tier: Tier;            // lowest tier that includes the feature
}

export const FEATURES: readonly FeatureDef[] = [
  { id: 'project.create',     labelKey: 'feat.project.create',   tier: 'free' },
  { id: 'project.import',     labelKey: 'feat.project.import',   tier: 'free' },
  { id: 'project.export',     labelKey: 'feat.project.export',   tier: 'free' },
  { id: 'results.entry',      labelKey: 'feat.results.entry',    tier: 'free' },
  { id: 'standings.view',     labelKey: 'feat.standings.view',   tier: 'free' },
  { id: 'print.summary',      labelKey: 'feat.print.summary',    tier: 'free' },
  // Shipped today and deliberately free: they are part of what the app is, not
  // an upsell. Locking them would remove functionality users already have.
  { id: 'display.kiosk',      labelKey: 'feat.display.kiosk',    tier: 'free' },
  { id: 'sync.lan',           labelKey: 'feat.sync.lan',         tier: 'free' },
  { id: 'schedule.venues',    labelKey: 'feat.schedule.venues',  tier: 'free' },
  // Pro: the professional document tools.
  { id: 'branding.documents', labelKey: 'lic.unlockBranding',    tier: 'pro' },
  { id: 'print.pack',         labelKey: 'lic.unlockPack',        tier: 'pro' },
  { id: 'templates.saved',    labelKey: 'lic.unlockTemplates',   tier: 'pro' },
];

export const DEFAULT_TIER: Tier = 'free';

export interface EntitlementContext {
  /** Overrides the verified tier. For previews and tests only — the UI never
   *  passes this, so a button cannot grant itself a license. */
  tier?: Tier;
}

/** The declared tier of a feature, ignoring any license. */
export function tierOf(featureId: string): Tier | null {
  return FEATURES.find(x => x.id === featureId)?.tier ?? null;
}

/** The live answer: the license decides, and a Pro license lists its features. */
export function has(featureId: string, ctx?: EntitlementContext): boolean {
  if (!FEATURES.some(f => f.id === featureId)) return false;  // unknown ids are never granted
  if (ctx?.tier === 'pro') return true;          // previews and tests only
  return hasFeature(featureId);
}

/** The features a Pro license would add on top of the free product. */
export function proFeatures(): FeatureDef[] {
  return FEATURES.filter(f => f.tier === 'pro');
}

/** All feature ids available at the current license state. */
export function availableFeatures(_tier: Tier = DEFAULT_TIER): string[] {
  return FEATURES.filter(f => has(f.id)).map(f => f.id);
}

/** Human-readable edition name for Settings/About and the License screen. */
export function describeEdition(tier: Tier = isProActive() ? 'pro' : 'free'): string {
  return t(tier === 'pro' ? 'feat.tierPro' : 'feat.tierFree');
}

