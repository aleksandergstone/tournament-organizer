// Layout guards for 1.4.01 (text overflow, dark theme, narrow screens).
//
// These are structural checks, not rendering tests: there is no browser in this
// suite, so each one pins a rule whose absence produced a real layout bug. They
// are deliberately about the stylesheet, not about any one screen.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', 'src');
const css = readFileSync(join(SRC, 'app.css'), 'utf8');

/** The body of one media query, by its max-width. */
function blockFor(maxWidth: number): string {
  const re = new RegExp(`@media \\(max-width: ${maxWidth}px\\) \\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = css.match(re);
  if (!m) throw new Error(`no @media (max-width: ${maxWidth}px) block`);
  return m[1];
}

const PHONE = blockFor(640);
const TABLET = blockFor(900);

// ------------------------------------------------------------------ overflow

describe('text cannot push the layout sideways', () => {
  it('media children are allowed to shrink below their content', () => {
    // Without min-width:0 a flex/grid child refuses to shrink, and one long
    // German label widens the whole card.
    expect(css).toMatch(/min-width:\s*0/);
    expect(css).toMatch(/\.page-head-text[^{]*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.panel-head-text[^{]*\{[^}]*min-width:\s*0/);
  });

  it('long unbroken tokens break instead of overflowing', () => {
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it('the page itself never scrolls horizontally', () => {
    expect(css).toMatch(/body\s*\{[^}]*overflow-x:\s*hidden/);
  });

  it('the fixed 132px label track can no longer squeeze its value column', () => {
    // The bug was `132px 1fr`: a fixed track plus an unshrinkable content column.
    expect(css).not.toMatch(/grid-template-columns:\s*132px\s+1fr/);
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*132px\)\s+minmax\(0,\s*1fr\)/);
  });

  it('team names wrap rather than being truncated away', () => {
    // An ellipsised name in a 232px bracket column is unreadable, and the name is
    // exactly what the organizer is scanning for.
    const side = css.match(/\.mcard-sides \.side\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(side).toMatch(/overflow-wrap/);
    expect(side).not.toMatch(/text-overflow:\s*ellipsis/);
    expect(side).not.toMatch(/white-space:\s*nowrap/);
  });

  it('bracket names wrap too', () => {
    const nm = css.match(/\.bmatch \.nm span\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(nm).toMatch(/min-width:\s*0/);
    expect(nm).not.toMatch(/white-space:\s*nowrap/);
  });

  it('the result-venue select no longer forces a 190px floor', () => {
    const sel = css.match(/\.mcard-extra select\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(sel).not.toMatch(/min-width:\s*190px/);
  });
});
// -------------------------------------------------------------- narrow screens

describe('narrow screens keep every control reachable', () => {
  it('the footbar wraps, so the primary action is never off-screen', () => {
    // nowrap + overflow-x:auto meant "Continue" could sit past the right edge
    // with nothing to indicate it was there.
    const foot = PHONE.match(/\.footbar\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(foot).toMatch(/flex-wrap:\s*wrap/);
    expect(foot).not.toMatch(/flex-wrap:\s*nowrap/);
    expect(foot).not.toMatch(/overflow-x:\s*auto/);
  });

  it('the search field cannot squeeze its toolbar buttons', () => {
    const bar = css.match(/\.toolbar input\[type="search"\][^{]*\{([^}]*)\}/)?.[1] ?? '';
    expect(bar).toMatch(/min-width:\s*0/);
    expect(bar).toMatch(/flex:\s*1 1/);
  });

  it('the document preview is sized to the viewport, not a fixed 620px', () => {
    expect(PHONE).toMatch(/\.output-preview\s*\{[^}]*vh/);
  });

  it('cards with a wide floor collapse to one column on a phone', () => {
    // The overrides live in the FINAL 640px block (see the note in app.css):
    // their base rules are declared later in the file, so an override placed
    // earlier would lose and never apply.
    const tail = css.slice(css.lastIndexOf('@media (max-width: 640px)'));
    expect(tail).toMatch(/\.variants\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(tail).toMatch(/\.mode-grid,\s*\.preset-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it('no collapsed grid uses a bare 1fr track', () => {
    // A grid track's automatic minimum is min-content, so `1fr` does not
    // actually prevent overflow — minmax(0, 1fr) does. This is what let a
    // German preset card push the page sideways at 320px.
    const bare = css.match(/grid-template-columns:\s*1fr\s*;/g) ?? [];
    expect(bare, bare.join(' | ')).toHaveLength(0);
  });

  it('tablet widths get their own breakpoint, not just the phone one', () => {
    // A single 640px breakpoint left 641–900px (iPad portrait) unhandled.
    expect(TABLET).toMatch(/\.rule-block > div/);
    expect(TABLET.length).toBeGreaterThan(50);
  });

  it('tap targets stay large enough for a thumb', () => {
    expect(PHONE).toMatch(/\.btn\s*\{[^}]*min-height:\s*4[0-9]px/);
    expect(PHONE).toMatch(/input,\s*select,\s*textarea\s*\{[^}]*font-size:\s*16px/);
  });

  it('the page header stacks, so the title is never crushed by its actions', () => {
    // Regression guard for a bug introduced alongside min-width:0. With the
    // title and the action row on one line, "Output & branding" collapsed to a
    // one-word-per-line column under three buttons.
    expect(PHONE).toMatch(/\.page-head,\s*\.panel-head\s*\{[^}]*flex-direction:\s*column/);
    expect(PHONE).toMatch(/\.page-head-text,\s*\.panel-head-text\s*\{[^}]*width:\s*100%/);
  });

  it('the topbar action row can scroll, for long translated labels', () => {
    // German: "Rückgängig", "Wiederholen", "Einstellungen". Beside the brand
    // these no longer fit at 320px and pushed the whole topbar past the edge.
    const acts = PHONE.match(/\.topbar \.acts\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(acts).toMatch(/width:\s*100%/);
    expect(acts).toMatch(/overflow-x:\s*auto/);
    expect(PHONE).toMatch(/\.topbar \.acts button\s*\{[^}]*white-space:\s*nowrap/);
  });

  it('mode and preset cards cannot be widened by their own text', () => {
    for (const sel of ['.mode-card', '.preset-card']) {
      const body = css.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
      expect(body, sel).toMatch(/min-width:\s*0/);
    }
  });
});

// ----------------------------------------------------------------- dark theme

describe('dark theme covers more than a token swap', () => {
  it('defines a full dark palette', () => {
    const dark = css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/)?.[1] ?? '';
    for (const token of ['--bg', '--panel', '--ink', '--muted', '--line', '--acc', '--ok', '--warn', '--bad']) {
      expect(dark, token).toContain(`${token}:`);
    }
  });

  it('overrides the colours that were hard-coded outside :root', () => {
    // Changing a variable cannot fix a literal like #f4f6f9, so these need
    // explicit rules or they stay light on a dark surface.
    expect(css).toMatch(/:root\[data-theme="dark"\][^{]*\.pill\s/);
    expect(css).toMatch(/:root\[data-theme="dark"\][^{]*\.chip\s/);
    expect(css).toMatch(/:root\[data-theme="dark"\][^{]*\.mode-card:hover/);
    expect(css).toMatch(/:root\[data-theme="dark"\][^{]*\.empty\s/);
  });

  it('disabled inputs are visibly disabled, not merely dimmed text', () => {
    expect(css).toMatch(/:root\[data-theme="dark"\][^{]*input:disabled[^{]*\{[^}]*background/);
  });

  it('leaves no undefined token fallback behind', () => {
    // var(--fg, #444) pinned the support note to grey even in dark mode.
    expect(css).not.toMatch(/var\(--fg\b/);
    expect(css).not.toMatch(/var\(--line,\s*#/);
    expect(css).not.toMatch(/var\(--muted,\s*#/);
  });

  it('keeps the paper-coloured preview legible', () => {
    // The preview is a real white document and must stay white in dark mode.
    expect(css).toMatch(/:root\[data-theme="dark"\][^{]*\.output-preview\s*\{[^}]*background:\s*#fff/);
  });

  it('never uses the background shorthand on a select in dark mode', () => {
    // Regression guard. `background: <colour>` on a select resets
    // background-size/position, so the chevron gradient then paints at full box
    // size: a giant dark triangle across the middle of the control. The dark
    // surface must use background-color, never the shorthand.
    const darkSelect = css.match(/:root\[data-theme="dark"\][^{]*\bselect\b[^{]*\{([^}]*)\}/g) ?? [];
    for (const rule of darkSelect) {
      expect(rule, rule).not.toMatch(/\}\s*[^}]*\bbackground:\s*[^;]+;/);
    }
  });

  it('draws the select chevron from a token, not a literal', () => {
    // One definition, both themes: re-declaring the gradient per theme is what
    // let the size be lost in the first place.
    const sel = css.match(/^select\s*\{([\s\S]*?)\}/m)?.[1] ?? '';
    expect(sel).toMatch(/var\(--chev\)/);
    expect(sel).toMatch(/background-size:\s*5px 5px/);
    expect(css.match(/linear-gradient\(45deg, transparent 50%/g) ?? []).toHaveLength(1);
  });
});

// ------------------------------------------------------------------ structure

describe('the stylesheet itself is sound', () => {
  it('braces balance', () => {
    expect((css.match(/\{/g) ?? []).length).toBe((css.match(/\}/g) ?? []).length);
  });

  it('every narrow-screen override comes after the base rule it overrides', () => {
    // A media query adds no specificity, so an override written *before* the
    // base declaration loses to it and silently does nothing. That is exactly
    // what happened to .preset-grid / .variants / .output-preview.
    const tailStart = css.lastIndexOf('@media (max-width: 640px)');
    const tail = css.slice(tailStart);
    expect(tailStart).toBeGreaterThan(-1);
    // Each selector must be named inside the final responsive section.
    for (const t of ['.variants', '.mode-grid', '.preset-grid', '.output-preview']) {
      expect(tail, `${t} needs an override in the final responsive section`).toContain(t);
      // …and its base rule must exist somewhere earlier in the file.
      expect(css.lastIndexOf(t, tailStart), `${t} needs a base rule before it`).toBeGreaterThan(-1);
    }
  });

  it('keeps the responsive overrides at the end of the stylesheet', () => {
    const tail = css.slice(css.lastIndexOf('@media (max-width: 640px)'));
    for (const t of ['.variants', '.mode-grid', '.preset-grid', '.output-preview']) {
      expect(tail, t).toContain(t);
    }
  });

  it('no page-level container uses a fixed pixel width', () => {
    // max-width is fine and intended; a hard `width` cannot survive a phone.
    // The leading boundary matters: without it "max-width: 780px" matches
    // "width: 780px" and the test is meaningless.
    expect(css).not.toMatch(/\.wrap\s*\{[^}]?[;{]\s*width:\s*\d+px/);
    expect(css).not.toMatch(/\.topbar\s*\{[^}]?[;{]\s*width:\s*\d+px/);
    expect(css).not.toMatch(/\.card\s*\{[^}]?[;{]\s*width:\s*\d+px/);
  });
});