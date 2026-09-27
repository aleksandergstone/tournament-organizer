# Tournament Organizer (desktop, offline-first)

Professional tournament & league manager. Free for amateurs, no account, no server.
Runs fully offline on Windows, macOS and Linux (Electron).

**[User guide](docs/USER_GUIDE.md)** · **[Release process](docs/RELEASE.md)** · **[Changelog](CHANGELOG.md)** · **[Contributing](CONTRIBUTING.md)**

## Requirements

Node.js 20+ (CI uses 22). Nothing else — the app is fully offline and has no
runtime dependencies.

## Run (development)

```powershell
cd "$env:USERPROFILE\Desktop\tournament-organizer"
npm.cmd ci         # reproducible install from package-lock.json
npm.cmd run dev    # http://localhost:5173
npm.cmd test       # engine + feature-boundary tests
```

Run the desktop shell against a dev server (two terminals):

```powershell
# terminal 1
npm.cmd run dev
# terminal 2 (auto-detects the dev server when no build exists)
npm.cmd run electron
```

Run the packaged-like build locally:

```powershell
npm.cmd run start    # build + electron
```

Shortcuts: `Ctrl+Z` undo · `Ctrl+Y` redo · `Ctrl+S` save · in Results: `j/k` move, `Enter` in score = save played, `/` search.

## Build & package a release

```powershell
npm.cmd run dist       # version:check + tests + build + electron-builder → release\
npm.cmd run dist:win   # Windows installer only
```

Artifacts land in `release/` with the naming convention
`Tournament-Organizer-<version>-<os>-<arch>.<ext>` (e.g. `Tournament-Organizer-1.0.0-win-x64.exe` NSIS installer).
See [docs/RELEASE.md](docs/RELEASE.md) for the full version-bump → publish checklist.

- Version comes from `package.json` and is displayed in the app (Settings → About, Home footer).
  `npm run version:check` fails if package.json, CHANGELOG.md, the app build and artifact
  names ever disagree.
- `build/make-icon.ps1` regenerates `build/icon.png` + `build/icon.ico` deterministically
  (the generated icons themselves are committed — CI needs them on Linux/macOS runners).
- Builds are reproducible from a clean checkout: `npm.cmd ci && npm.cmd run dist`.

## Repository & CI

- **CI** (`.github/workflows/ci.yml`): every push and pull request runs
  `npm run release:check` on Ubuntu and builds the Windows installer as an artifact.
- **Releases** (`.github/workflows/release.yml`): pushing a `v*` tag whose version matches
  `package.json` builds Windows/macOS/Linux artifacts and attaches them to the GitHub Release
  automatically. First-time setup: [docs/RELEASE.md § 0](docs/RELEASE.md).
- **One version source of truth**: `package.json` → injected into the UI at build time,
  embedded in release file names, mirrored by the CHANGELOG entry.
- Tracked: `src/`, `tests/`, `electron/`, `build/`, `docs/`, CI and config files.
  Ignored: `node_modules/`, `dist/`, `release/`, `logs/` (see `.gitignore`).

## Engine rules (deterministic, UI-independent)

- Bracket slots carry provenance (`match.bracket.srcHome/srcAway`: winner-of / loser-of / seed).
  Every result edit runs full `recomputeBracket()`: derived slots re-resolve, stale
  downstream results are voided (never preserved), bye auto-advance only for
  generation-time manual byes.
- All result writes go through `recordResult()` (`src/engine/result.ts`): validates
  scores, rejects knockout draws explicitly, stamps occupant tag, recomputes.
- `computeStandings()` is pure (no input mutation): walkovers = points only (no
  free goals), unfinished/interrupted ignored, tiebreak order from rules + id fallback.
- Withdrawal ejects from unplayed matches (walkover, tagged `[withdrawal]`), keeps history.
- Double elim: WB + LB (fresh losers paired, then survivors vs new losers, WB-final
  loser awaits in last LB round) + Grand Final + Conditional Reset (only if L-side wins GF1).
- Import validates deeply (ids, dup ids, match shape, version 0–1), drops dangling
  matches with a warning, recomputes brackets on load; v0 migrates with warning.

## Data

- `localStorage` autosave (~800ms, failures surface as a banner — never silent);
  `.top.json` portable backup; standings/matches CSV; print stylesheet.
- Free/Pro feature boundary lives in `src/engine/features.ts` — all core features
  are declared `free`; future Pro features are registered but not wired to any UI,
  so entitlement logic can be added later without touching the engine or offline use.

## Project layout

```
electron/     main.cjs (window state, file dialogs, single instance) + preload.cjs
src/engine/   pure domain logic (no UI, no I/O) — fully tested
src/state/    React store (history, autosave, settings)
src/ui/       screens
tests/        vitest suites
docs/         user guide + release process
build/        icon assets + icon generator
```
