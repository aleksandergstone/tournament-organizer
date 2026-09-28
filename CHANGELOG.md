# Changelog

All notable changes to Tournament Organizer.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver.

## [1.3.0] — 2026-09-28

### Added

- **The bracket as a drawing.** A single-elimination bracket is now spread out as a
  bracket “spider” — rounds as columns, matches as boxes, connector lines between
  them, the winner marked and the champion called out. The same drawing appears on
  the Bracket screen and in the printed document (on its own landscape page), so
  the picture you see is the picture you print.
- **Final result for knockout events.** A bracket is won by being the last one
  standing, so a points table would be noise. Where points decide something — a
  league, a round robin, Swiss, a group stage — the table is still there; in a
  knockout you get the champion, the runner-up and third place instead, on the
  Standings screen, on the Overview card, on the hall display and in the document
  (*Final result* replaces the standings table).
- **Four languages — English, Polish, German, Spanish.** The whole interface, every
  message the engine produces (validation, import, LAN sharing, deep links) and
  every printed document now speak the selected language.
- **Language switch** in Settings → Appearance, with “System” plus the four
  languages by endonym. The choice is saved with the project preferences, applies
  immediately (no restart, no internet) and is used for documents and exports
  as well.
- **Localized dates** in every document: month and weekday names, date order and
  separators follow the language. English stays day-first (“14 Mar 2026”).

### Changed

- **QR codes are parked.** The check-in, match and station codes are being
  reworked; the QR screen is hidden from the navigation and shows “coming soon”
  instead. Nothing else is affected — the codes return in a later version.
- **No bracket without a knockout stage.** The Bracket screen only appears for
  single elimination, double elimination and groups + knockout. In a league every
  match is on the Results screen and the table is on Standings, which is where
  they belong.
- One dictionary (`src/i18n/`) is the single source of truth: `en` is canonical
  and the other three are typed against it, so a missing or misspelled key fails
  the build instead of leaking a raw key into the UI.
- Tables that used to hold ready-made English text (place types, document kinds,
  status words, tie-break names) now hold dictionary keys and are translated at
  render time, so they follow a language switch made in the same session.
- Round names are written in the language active when the bracket is generated —
  they are project data, stored in the file and printed on paper. The grand final
  is identified by its round number, so no engine logic depends on a name.
- The document's own language (`lang`) now follows the selected language, so screen
  readers and hyphenation match what is on screen.

### Fixed

- Stray English left in printed documents: the round-table headers (“No. / Home /
  Score / Away / Status”), the “Notes” heading, the “Generated … at …” line and the
  `lang` of the document itself. CSV headers for knockout exports are localized too.
- Privacy, README and launch-page wording now describes local-network sharing
  accurately: it is optional, off by default and stays inside your own Wi-Fi, and
  nothing ever reaches a server. The user guide documents the Output & branding
  screen and the language switch.

### Known limitations

- The project history (the audit log at the bottom of the Overview screen) keeps
  its technical entries, e.g. `result.edit Anna-Bob`; they are a log, not copy.
- Round names and group names created in an earlier version keep the language
  they were generated in until the bracket is generated again.

## [1.2.0] — 2026-09-28

Tournament paperwork: branded, print-ready documents instead of a generic summary
page. Everything is still produced on the machine — no service, no account.

### Added

- **Output & branding screen** (was "Export") — pick what to produce, see a live
  preview of the finished page, then save it as PDF, print it, or save the same
  document as CSV. The preview is the exact document that gets printed.
- **Six export variants** — standings, match list, schedule/timetable, bracket,
  group tables, and an organizer pack (event information + table + match list +
  timetable + bracket in one document).
- **Real PDF export** — the document is rendered by the app and written as an A4
  PDF with repeating table headers, a running footer and "Page X of Y". In a
  browser the same document goes to the print dialog instead.
- **Branding** — event title, competition subtitle, season/edition label, event
  logo, optional sponsor logo, header line, footer text, a notes/disclaimer
  block and an accent colour. Branding is part of the project: it is saved,
  exported, synced and used by every document.
- **Timetable export** — one table per event day, ordered by time and then by
  court/table, with the match number that the referee sheets use.
- **Group output** — a table and a match list per group, each group starting on
  its own page, plus a qualifiers list derived from the group tables.
- **Standings extras** — an optional Buchholz column, a compact table for narrow
  paper, withdrawn participants marked, and the tie-break order printed under
  every table so a disputed position can be settled from the paper.
- **Match list extras** — consecutive match numbers, walkovers naming the winner,
  unplayed matches shown as “–” and byes left out entirely.

### Changed

- The match list, standings and bracket are generated by one deterministic
  output model, so the same project always produces the same document.

## [1.1.0] — 2026-09-27

Event operations: run a venue, not just a bracket. Everything stays local — no cloud,
no account, no internet.

### Added

- **Display Mode** — a big read-only screen for a projector or TV: current match, next
  match, top five, venue and live clock. Opens in a second window (`#display`) or
  full screen, updates automatically, and never exposes organizer controls.
- **QR codes** — check-in codes per participant, a code per match and per station,
  generated on the machine with no service involved. Scanning one opens the desktop app
  directly on that participant, match or place; unknown codes explain themselves.
- **Venue scheduling** — define courts, tables, stations, boards or lanes, give each
  match a place, a start time and a duration. Double bookings and removed places are
  reported as conflicts, and a deterministic planner fills free slots without overlaps.
- **Group → knockout preview** — the next stage is planned and shown first (qualifiers,
  seeding order, resulting bracket) and only created after confirmation; cancelling
  changes nothing.
- **LAN sync** — opt-in sharing on the local network: one device shares the project over
  `http://<ip>:8971`, others pull or push. Merges are per match, last edit wins, ties keep
  the local copy, brackets are recomputed after every merge, and each merge is undoable.
  A UDP beacon helps devices find each other; typing the address also works.
- Result edits are now timestamped, which is what makes conflict-aware LAN merges possible.

### Changed

- **Interface refresh — one design language across the app.** A shared set of UI
  primitives (page header, panel, alert, field, toolbar, table, empty state) now backs every
  screen, so headings, spacing, button styles and status colours are identical everywhere.
- One clear main action per screen; secondary actions moved into a footer bar or a
  disclosure. Match entry went from eight controls per match to a score box, one Save and an
  “Other outcomes” section (draw, extra time, walkover, not finished, interrupted, reset).
- Match states are now written in plain language (“Played”, “Not finished”, “After extra
  time”) instead of raw engine values, and a correction announces that later rounds were
  recomputed.
- Home got a single dominant action and a scannable project table (format, players, last
  change); the wizard shows its three steps, groups the inputs and previews the result before
  creating; Export separates backup, spreadsheet files and printing.
- Tables are aligned and readable: right-aligned numbers, tabular figures, row hover, clear
  selected rows, always-visible row actions, visible keyboard focus.
- Display Mode reads better from a distance and hides organizer controls entirely in the
  projector window.
- Project files may contain an optional `resources` list; older files without it open
  unchanged.
- `Standings` no longer seeds the knockout in one click — it now shows a preview first.

## [1.0.0] — 2026-09-27

First public release.

### Added

- Release packaging with electron-builder: NSIS installer (Windows), DMG (macOS), AppImage (Linux);
  artifacts named `Tournament-Organizer-<version>-<os>-<arch>.*`.
- App version displayed in-app (Home footer, Settings → About) and injected at build time
  from `package.json`.
- First-run "Get started in 3 steps" guidance on Home.
- Helpful empty states on Overview, Players, Results, Bracket and Export screens.
- Crash safety: React error boundary with recovery actions instead of a white screen.
- Save-failure banner: local autosave errors are surfaced, never silent.
- Startup robustness: single-instance lock, remembered window size/position,
  friendly fallback page if the interface cannot load.
- Settings → About (name, version, edition, data/privacy statement, license).
- Dark theme now actually applies (previously stored but unused).
- Free/Pro feature-boundary module (`src/engine/features.ts`) with tests — all
  current features are free; Pro ids reserved for future use, no payments/accounts.
- Documentation: user guide (`docs/USER_GUIDE.md`), release checklist (`docs/RELEASE.md`),
  changelog, MIT license.
- App icon (generated deterministically by `build/make-icon.ps1`) and HTML favicon.

### Changed

- File open/save errors from the desktop shell return plain-language messages instead of
  raw IPC failures.
- Recent-projects list refreshes immediately after delete.
- `npm run dist` now runs tests + build before packaging; `npm run start` runs a
  packaged-like build locally.

### Fixed

- Guard oscillation in losers-bracket recompute (occupant-only swaps were reverted by
  re-resolve, clearing results in a loop).
- Fully-resolved derived matches kept placeholder `bye` status and auto-advanced with a
  null winner; now converted to `scheduled`.

## [0.1.0] — 2026-09-26

Internal pre-release: engine, all formats, undo/redo, autosave, import/export, tests.
