// The feature registry â€” the single place that says what this product has and
// what it costs. No imports, no license, no UI: this is data, so the engine, the
// UI, the docs and any future packaging step all read one table and cannot drift.
//
// Four classes, answering two different questions â€” deliberately:
//
//   free      access. Always available. The core product.
//   pro       access. Available with a license. A value-add, never the product.
//   reporting capability. Exists and works, but produces information only â€” it
//             never changes a result. (Bracket points are the one case today.)
//   planned   capability. Declared, deliberately not built yet.
//
// Access follows from the class and is never written by hand:
//
//   free, reporting â†’ 'always'   pro â†’ 'license'   planned â†’ 'none'
//
// A `reporting` or `planned` feature is therefore never something a customer can
// buy. It is shown, or it is not, and that has nothing to do with payment.
//
// The rule that outranks every other rule here: the core product is free.
// Creating a tournament, adding participants, generating any structure, entering
// results, reading standings, scheduling, exporting, printing and working
// offline must never be `pro`. CORE_FEATURE_IDS is that list, and
// tests/feature-registry.test.ts fails the build if one of them ever moves.

/** How a feature is classified. See the note above. */
export type FeatureClass = 'free' | 'pro' | 'reporting' | 'planned';

/** Who may use it. Derived from the class â€” see `accessOf`. */
export type FeatureAccess = 'always' | 'license' | 'none';

export interface FeatureEntry {
  id: string;
  /** Short human name for the docs table. Not a translation key â€” screens keep
   *  their own labels; nothing here has to be translated. */
  name: string;
  class: FeatureClass;
  /** Why it sits where it does. One line, no marketing. */
  why: string;
  /** Existing i18n key, when a screen already has a label for this. */
  label?: string;
}

export const FEATURE_REGISTRY: readonly FeatureEntry[] = [
  // ---- Free: the product itself. Never move these. -------------------------
  { id: 'project.create', name: 'Create a tournament', class: 'free', why: 'The product. Without it there is nothing to organize.', label: 'feat.project.create' },
  { id: 'project.open', name: 'Open a saved tournament', class: 'free', why: 'Your data belongs to you and must stay readable.', label: 'feat.project.import' },
  { id: 'project.save', name: 'Save and autosave (.top.json)', class: 'free', why: 'Offline-first means the file is the database.', label: 'settings.autosave' },
  { id: 'project.import', name: 'Import a tournament file', class: 'free', why: 'Moving in from a spreadsheet is the first thing anyone does.', label: 'feat.project.import' },
  { id: 'project.export', name: 'Export a tournament file', class: 'free', why: 'Leaving must never be held hostage.', label: 'feat.project.export' },
  { id: 'participants.manage', name: 'Add and edit participants', class: 'free', why: 'Core operation.', label: 'nav.participants' },
  { id: 'tournament.formats', name: 'All competition formats', class: 'free', why: 'Single/double elimination, league, round robin, Swiss, groups+KO, custom. Restricting formats splits the product by budget.', label: 'nav.rules' },
  { id: 'generation.structure', name: 'Generate brackets, groups, tables, fixtures', class: 'free', why: 'Core operation. Generation is the app.', label: 'nav.bracket' },
  { id: 'results.entry', name: 'Enter and edit results', class: 'free', why: 'Core operation.', label: 'feat.results.entry' },
  { id: 'results.draws', name: 'Draw resolution (overtime, replay, penalty)', class: 'free', why: 'Part of recording a result honestly, not a premium extra.', label: 'nav.rules' },
  { id: 'standings.view', name: 'Standings and tables', class: 'free', why: 'Core output.', label: 'feat.standings.view' },
  { id: 'schedule.generate', name: 'Generate a schedule', class: 'free', why: 'Core output.', label: 'nav.schedule' },
  { id: 'schedule.venues', name: 'Courts, tables and time slots', class: 'free', why: 'Already shipped to every user; taking it back would be a downgrade.', label: 'feat.schedule.venues' },
  { id: 'export.print', name: 'Print any document', class: 'free', why: 'Printing is how the output reaches anyone.', label: 'nav.output' },
  { id: 'export.pdf', name: 'Save a PDF', class: 'free', why: 'Same document, same button. Only the decoration is paid.', label: 'feat.print.summary' },
  { id: 'export.csv', name: 'Export CSV', class: 'free', why: 'Data out, always. A paid exit door is hostile.', label: 'nav.output' },
  // Shipped free to everyone until Pro launched, then moved: a projector
  // display and multi-computer sync are what a paid coordinator actually buys.
  // This is a deliberate downgrade for existing users, recorded here so nobody
  // "fixes" it back by accident.
  { id: 'display.kiosk', name: 'Display mode for a projector', class: 'pro', why: 'The live court-side view. Moved to Pro when monetisation started.', label: 'feat.display.kiosk' },
  { id: 'sync.lan', name: 'LAN sync with your own computers', class: 'pro', why: 'Several scorers, one tournament. Moved to Pro when monetisation started.', label: 'feat.sync.lan' },
  { id: 'app.offline', name: 'Works fully offline', class: 'free', why: 'The defining constraint of the product.', label: 'app.footer' },
  { id: 'audit.trail', name: 'Audit trail of every change', class: 'free', why: 'Trust depends on being able to check what changed.', label: 'nav.overview' },
  { id: 'undo.redo', name: 'Undo and redo', class: 'free', why: 'Correcting a mis-click is not a premium feature.', label: 'nav.settings' },
  { id: 'deeplink.qr', name: 'Open a match from a QR deep link', class: 'free', why: 'Already works and depends on no server.', label: 'nav.codes' },
  { id: 'i18n.locales', name: 'EN / PL / DE / ES', class: 'free', why: 'Four languages for the price of none is the whole point.', label: 'language.title' },

  // ---- Reporting-only: real, but never changes an outcome. ------------------
  { id: 'points.reporting', name: 'Points kept for reports only', class: 'reporting', why: 'In a bracket, points are a record, not a decision. Shown so nobody wonders where the numbers went; never sold.', label: 'mode.points.bracket' },

  // ---- Pro: decoration and professional workflow. ---------------------------
  { id: 'branding.documents', name: 'Branded documents (logo, title, footer, accent)', class: 'pro', why: 'The document works without it; only the letterhead costs.', label: 'lic.unlockBranding' },
  { id: 'print.pack', name: 'The full print pack', class: 'pro', why: 'Bundling documents that already exist is convenience, not capability.', label: 'lic.unlockPack' },
  { id: 'templates.saved', name: 'Saved templates for recurring events', class: 'pro', why: 'Pays off only after you have run several events.', label: 'lic.unlockTemplates' },
  { id: 'schedule.resources', name: 'Advanced resource and conflict scheduling', class: 'pro', why: 'Basic scheduling stays free; resolving conflicts across venues is specialist work.', label: 'nav.schedule' },

  // ---- Planned: named, on purpose, not built. -------------------------------
  { id: 'codes.qr', name: 'QR check-in and quick result', class: 'planned', why: 'The screen is a ComingSoon placeholder today. Not an upsell yet.', label: 'soon.qr' },
  { id: 'operator.roles', name: 'Role-based operator tools', class: 'planned', why: 'Named for the Pro plan. Not built; listed so it is not forgotten.', label: 'nav.settings' },
  { id: 'license.multiSeat', name: 'Multi-seat and organisational license', class: 'planned', why: 'Second product variant, deliberately deferred.', label: 'lic.title' },
];

/** The core product. A test fails if any of these stops being `free`. */
export const CORE_FEATURE_IDS: readonly string[] = [
  'project.create', 'project.open', 'project.save', 'project.import', 'project.export',
  'participants.manage', 'tournament.formats', 'generation.structure', 'results.entry',
  'results.draws', 'standings.view', 'schedule.generate', 'schedule.venues',
  'export.print', 'export.pdf', 'export.csv', 'app.offline',
];

export function entryOf(id: string): FeatureEntry | null {
  return FEATURE_REGISTRY.find(e => e.id === id) ?? null;
}

export function classOf(id: string): FeatureClass | null {
  return entryOf(id)?.class ?? null;
}

/** Access is derived from the class, never declared by hand â€” see the header. */
export function accessOf(id: string): FeatureAccess {
  switch (classOf(id)) {
    case 'free': case 'reporting': return 'always';
    case 'pro': return 'license';
    default: return 'none';
  }
}

export const idsWithClass = (c: FeatureClass): string[] =>
  FEATURE_REGISTRY.filter(e => e.class === c).map(e => e.id);

/**
 * Everything a free install may use. The license module reads this list instead
 * of keeping its own â€” that duplication was the one place the two could drift.
 */
export const FREE_FEATURE_IDS: readonly string[] = FEATURE_REGISTRY
  .filter(e => e.class === 'free' || e.class === 'reporting')
  .map(e => e.id);

export const PRO_FEATURE_IDS: readonly string[] = idsWithClass('pro');
