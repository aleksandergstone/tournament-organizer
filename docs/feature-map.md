# Feature map — what is free, what is Pro, and why

The single source of truth is `src/engine/feature-registry.ts`. This document
explains it; it does not define it. If the two ever disagree, the registry wins
and `tests/feature-registry.test.ts` fails the build.

## The four classes

| Class | Means | Access |
|---|---|---|
| `free` | The core product. Always available. | always |
| `pro` | A value-add for professional users. Never the product itself. | license |
| `reporting` | Real and working, but produces information only — it never changes a result. | always |
| `planned` | Named on purpose, deliberately not built yet. | none |

Access is **derived** from the class, never written by hand:

```
free, reporting → always     pro → license     planned → none
```

So a `reporting` or `planned` feature is never something a customer can buy. It
is shown, or it is not, and that has nothing to do with payment.

Two classes answer "may this install use it?" (`free`, `pro`); two answer "what
is this?" (`reporting`, `planned`). Keeping them in one column is convenient for
reading the table, but it is why `accessOf()` exists — so nobody has to remember
which of the four are purchasable.

## The rule that outranks the rest

**The core product is free.** Creating a tournament, adding participants,
generating any structure, entering results, reading standings, scheduling,
exporting, printing and working offline must never be `pro`.

`CORE_FEATURE_IDS` is that list in code, and a test fails the build if any entry
stops being `free`. This is the one rule that cannot be relaxed for a special
case, a launch discount or a feature request.

## The table

### Free — the product

| Id | Feature | Why it is free |
|---|---|---|
| `project.create` | Create a tournament | The product. Without it there is nothing to organize. |
| `project.open` | Open a saved tournament | Your data belongs to you and must stay readable. |
| `project.save` | Save and autosave (`.top.json`) | Offline-first means the file is the database. |
| `project.import` | Import a tournament file | Moving in from a spreadsheet is the first thing anyone does. |
| `project.export` | Export a tournament file | Leaving must never be held hostage. |
| `participants.manage` | Add and edit participants | Core operation. |
| `tournament.formats` | All competition formats | Single/double elimination, league, round robin, Swiss, groups+KO, custom. Restricting formats splits the product by budget. |
| `generation.structure` | Generate brackets, groups, tables, fixtures | Core operation. Generation is the app. |
| `results.entry` | Enter and edit results | Core operation. |
| `results.draws` | Draw resolution (overtime, replay, penalty) | Part of recording a result honestly, not a premium extra. |
| `standings.view` | Standings and tables | Core output. |
| `schedule.generate` | Generate a schedule | Core output. |
| `schedule.venues` | Courts, tables and time slots | Already shipped to every user; taking it back would be a downgrade. |
| `export.print` | Print any document | Printing is how the output reaches anyone. |
| `export.pdf` | Save a PDF | Same document, same button. Only the decoration is paid. |
| `export.csv` | Export CSV | Data out, always. A paid exit door is hostile. |
| `display.kiosk` | Display mode for a projector | Shipped to everyone. Locking it would remove a feature people use. |
| `sync.lan` | LAN sync with your own computers | Staying on the same LAN, with no account and no server, is the offline promise. |
| `app.offline` | Works fully offline | The defining constraint of the product. |
| `audit.trail` | Audit trail of every change | Trust depends on being able to check what changed. |
| `undo.redo` | Undo and redo | Correcting a mis-click is not a premium feature. |
| `deeplink.qr` | Open a match from a QR deep link | Already works and depends on no server. |
| `i18n.locales` | EN / PL / DE / ES | Four languages for the price of none is the whole point. |

### Reporting-only

| Id | Feature | Why |
|---|---|---|
| `points.reporting` | Points kept for reports only | In a bracket, points are a record, not a decision. Shown so nobody wonders where the numbers went; never sold. |

### Pro

| Id | Feature | Why it is worth paying for |
|---|---|---|
| `branding.documents` | Branded documents (logo, title, footer, accent) | The document works without it; only the letterhead costs. |
| `print.pack` | The full print pack | Bundling documents that already exist is convenience, not capability. |
| `templates.saved` | Saved templates for recurring events | Pays off only after you have run several events. |
| `schedule.resources` | Advanced resource and conflict scheduling | Basic scheduling stays free; resolving conflicts across venues is specialist work. |

### Planned — named, not built

| Id | Feature | Status |
|---|---|---|
| `codes.qr` | QR check-in and quick result | A `ComingSoon` placeholder today. Not an upsell yet. |
| `operator.roles` | Role-based operator tools | Named for the Pro plan. Not built; listed so it is not forgotten. |
| `license.multiSeat` | Multi-seat and organisational license | Second product variant, deliberately deferred. |

## What should stay free forever

These are not "free for now". Locking any of them would mean the app can no
longer do its job, and a paid app that cannot run your tournament is not a
better product:

- **The whole creation path** — create, participants, formats, generation.
- **The whole result path** — enter results, draws, standings.
- **All data out** — export, print, PDF, CSV, and the project file itself. A
  customer who wants their data out gets it out, in a format they can open.
- **Offline operation**, which is the constraint the whole design rests on.
- **Undo, autosave, the audit trail** — trust features. Charging for the ability
  to see what changed, or to fix a mis-click, is a bad trade for any amount.
- **Languages.** Four languages at no cost is the clearest possible statement
  that the tool belongs to organizers, not to budgets.

## What should be Pro-only

The test for this list is blunt: **would the app still do its job without it?**
If yes, it is a candidate for Pro, because then Pro pays for polish and
workflow rather than for the product.

Good candidates:

- **Decoration** — letterhead, logos, accent colours. The document is complete
  without it; only the impression differs.
- **Convenience at volume** — bundling documents into a pack, saving templates.
  Both operate on output the free version already produces.
- **Specialist scheduling** — conflict resolution across many venues. Basic
  scheduling stays free; this is the part a paid coordinator actually needs.
- **Multi-event workflow** — templates, recurring structures. The value only
  appears after the second or third event.

Deliberately **not** candidates, even though they were on the original list:

- **Display/kiosk mode** and **LAN sync**. Both ship today to everyone. Gating
  them takes away a shipped feature; that reads as a downgrade, not an upgrade.
- **QR check-in.** It is not built. Selling a placeholder would be selling a
  promise.
- **Any tournament format.** Restricting formats splits the product by budget
  and is the fastest way to make people evaluate the free tier as a trial
  instead of as the real thing.

## Architecture

```
feature-registry.ts   the table — data only, no imports, no license, no UI
        │
        ├─ FREE_FEATURE_IDS ──► license.ts   (no more private duplicate list)
        │
        └─ accessOf() ──► features.ts ──► has() ──► UI + engine
```

- `feature-registry.ts` has **no dependencies**. That is what makes it usable
  from the engine, the docs and any future packaging step without dragging the
  license along.
- `features.ts` is the only module where the registry and the license meet. It
  exposes `has(featureId)`, which is the answer to every entitlement question.
- `license.ts` imports `FREE_FEATURE_IDS` from the registry. Before this change
  it kept its own list — the single place the two could have drifted.
- `ProGate.tsx` is the only React component that reads `has()`; screens wrap a
  Pro surface in it rather than asking about payment themselves.

Unknown ids are denied, never granted. `planned` features are denied too,
whatever a license says: a Pro license does not conjure a feature that was never
built.

## Current state

`branding.documents` is the one Pro surface actually gated in the UI. The other
three Pro entries and all three planned entries are declarations — nothing
consumes them yet. Payment is not wired: the License screen shows an explicit
"not configured" message rather than a button that pretends to sell something.
