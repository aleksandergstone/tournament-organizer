// Free / Pro boundary — the layer that answers "may this install use it?".
//
// All the data lives in feature-registry.ts. This file adds exactly one thing:
// the license. It exists so that no screen, no engine module and no export ever
// asks about payment directly — they all come through has(), the only place the
// registry and the license meet.
//
// Unknown ids are denied, never granted. `planned` features are never granted
// either, whatever a license says: a Pro license does not conjure a feature that
// was never built.
import { t, type Dict } from '../i18n';
import { hasFeature, isProActive, type Tier } from './license';
import {
  FEATURE_REGISTRY, accessOf, classOf, entryOf,
  type FeatureAccess, type FeatureClass, type FeatureEntry,
} from './feature-registry';

export type { FeatureAccess, FeatureClass, FeatureEntry, Tier };

/** The registry itself, so older call sites keep working. */
export const FEATURES: readonly FeatureEntry[] = FEATURE_REGISTRY;

/** Compatibility view: the tier that unlocks a feature, ignoring any license.
 *  A planned feature belongs to no tier — it is not built yet. */
export function tierOf(featureId: string): Tier | null {
  const c = classOf(featureId);
  if (c === null || c === 'planned') return null;
  return c === 'pro' ? 'pro' : 'free';
}

export { accessOf, classOf, entryOf };

export interface EntitlementContext {
  /** Overrides the verified tier. For previews and tests only — the UI never
   *  passes this, so a button cannot grant itself a license. */
  tier?: Tier;
}

/** The live answer: the license decides, and a Pro license lists its features. */
export function has(featureId: string, ctx?: EntitlementContext): boolean {
  const access = accessOf(featureId);
  if (access === 'none') return false;            // planned or unknown: never granted
  if (access === 'always') return true;           // free and reporting-only
  if (ctx?.tier === 'pro') return true;           // previews and tests only
  return hasFeature(featureId);
}

/** The features a Pro license adds on top of the free product. */
export function proFeatures(): FeatureEntry[] {
  return FEATURE_REGISTRY.filter(f => f.class === 'pro');
}

/** Every feature available at the current license state. */
export function availableFeatures(_tier: Tier = 'free'): string[] {
  return FEATURE_REGISTRY.filter(f => has(f.id)).map(f => f.id);
}

/** Human-readable edition name for Settings/About and the License screen. */
export function describeEdition(tier: Tier = isProActive() ? 'pro' : 'free'): string {
  return t((tier === 'pro' ? 'feat.tierPro' : 'feat.tierFree') as keyof Dict);
}