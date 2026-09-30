// The free/paid boundary: the one place that answers "may this install use it?".
//
// There is no paid side any more. Everything that ships is class 'free' or
// 'reporting'; class 'pro' exists in the model but nothing is in it, so
// accessOf() never returns 'license' and no license is ever consulted.
//
// The file is kept as the single seam so that if a paid tier is ever wanted
// again it goes in one place. For now has() is a lookup, not a decision.
//
// Unknown ids are denied, never granted. 'planned' features are never granted
// either: naming a feature is not building it.
import type { Dict } from '../i18n';
import { t } from '../i18n';
import {
  FEATURE_REGISTRY, accessOf, classOf, entryOf,
  type FeatureAccess, type FeatureClass, type FeatureEntry,
} from './feature-registry';

export type { FeatureAccess, FeatureClass, FeatureEntry };
export type Tier = 'free';

/** The registry itself, so older call sites keep working. */
export const FEATURES: readonly FeatureEntry[] = FEATURE_REGISTRY;

/** Compatibility view: the tier that unlocks a feature. */
export function tierOf(featureId: string): Tier | null {
  const c = classOf(featureId);
  if (c === null || c === 'planned') return null;
  return 'free';
}

export { accessOf, classOf, entryOf, FEATURE_REGISTRY };

export interface EntitlementContext {
  /** Kept so existing call sites still compile. It grants nothing: with no
   *  paid class in the registry there is nothing a license could unlock. */
  tier?: Tier;
}

/** The live answer. Free today; no license is read, stored or required. */
export function has(featureId: string, _ctx?: EntitlementContext): boolean {
  return accessOf(featureId) === 'always';
}

/** Nothing is behind a paywall today. Present so the shape is stable. */
export function proFeatures(): FeatureEntry[] {
  return FEATURE_REGISTRY.filter(f => f.class === 'pro');
}

/** Every feature this install may use. */
export function availableFeatures(_tier?: Tier): string[] {
  return FEATURE_REGISTRY.filter(f => has(f.id)).map(f => f.id);
}

/** Human-readable edition name for Settings/About. */
export function describeEdition(_tier?: Tier): string {
  return t('feat.tierFree' as keyof Dict);
}