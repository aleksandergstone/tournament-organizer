# Changelog

All notable changes to Tournament Organizer.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver.

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
