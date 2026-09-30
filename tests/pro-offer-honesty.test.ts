// The one guard that keeps the shop honest: anything the app advertises as a
// Pro unlock must actually exist behind a gate.
//
// It was caught in the final audit — three entries were declared `pro` while
// nothing was built for them, so the License screen listed "saved templates"
// and "full print pack" as things a €10 purchase unlocks. They do not exist.
// Declaring a feature `pro` is a promise to a paying customer, so this test
// fails if that promise outruns the code.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEATURE_REGISTRY, PRO_FEATURE_IDS } from '../src/engine/feature-registry';
import { SCREEN_FEATURE, SETTINGS_PANEL_FEATURE } from '../src/engine/screen-features';

const root = path.resolve(__dirname, '..');
const sources = readdirSync(path.join(root, 'src'), { recursive: true })
  .filter(f => typeof f === 'string' && /\.tsx?$/.test(f))
  .map(f => readFileSync(path.join(root, 'src', f), 'utf8'))
  .join('\n');

describe('everything advertised as a Pro unlock really exists', () => {
  it('every Pro feature is consumed by a gate in the UI', () => {
    const gated = new Set([
      ...Object.values(SCREEN_FEATURE),
      ...Object.values(SETTINGS_PANEL_FEATURE),
    ]);
    for (const id of PRO_FEATURE_IDS) {
      const hasGate = sources.includes(`featureId="${id}"`) || gated.has(id);
      expect(hasGate, `${id} is advertised as Pro but nothing gates it`).toBe(true);
    }
  });

  it('no gate points at a feature that is not declared Pro', () => {
    const gated = new Set([
      ...Object.values(SCREEN_FEATURE),
      ...Object.values(SETTINGS_PANEL_FEATURE),
    ]);
    for (const id of gated) {
      expect(PRO_FEATURE_IDS, id).toContain(id);
    }
  });

  it('a feature that is not built is `planned`, never `pro`', () => {
    // The four classes exist for this: `pro` is a promise, `planned` is a note.
    for (const e of FEATURE_REGISTRY) {
      if (e.class === 'planned') expect(PRO_FEATURE_IDS).not.toContain(e.id);
    }
  });

  it('names the Pro features a customer actually receives today', () => {
    expect([...PRO_FEATURE_IDS].sort()).toEqual(['branding.documents', 'display.kiosk', 'sync.lan']);
  });
});