# Changelog

All notable changes to Tournament Organizer.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow semver.

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
