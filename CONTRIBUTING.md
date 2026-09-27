# Contributing

Short and practical. The goal is a boring, predictable workflow.

## Requirements

- Node.js 20 or newer (CI uses Node 22)
- npm 10+

## Setup

```powershell
npm.cmd ci        # reproducible install from package-lock.json
npm.cmd run dev   # app in a browser at http://localhost:5173
npm.cmd start     # production build + desktop window (Electron)
```

> Recent npm versions may print `allow-scripts` warnings for packages with postinstall
> steps (electron, esbuild). If they are not executed, Electron's binary will be missing
> and packaging will fail — approve them with `npm approve-scripts` (or use npm 10.x).
> GitHub Actions uses Node 22 / npm 10 and runs these scripts normally.

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (browser) |
| `npm run electron` | Desktop shell (uses `dist/`, or the dev server if there is no build) |
| `npm test` | Vitest suites (engine + feature boundary) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck + production bundle into `dist/` |
| `npm run version:check` | Version consistency (package.json / CHANGELOG / app / artifacts) |
| `npm run release:check` | version:check + tests + build — run this before every push |
| `npm run screenshots` | Rebuilds the app, regenerates the demo tournament and re-captures the launch screenshots |
| `npm run dist` | release:check + electron-builder installers into `release/` |
| `npm run dist:win` | Same, Windows only |

## Before opening a pull request

1. `npm run release:check` is green.
2. New engine logic has tests (`tests/`). `src/engine/*` stays pure: no React, no I/O.
3. UI-only changes need no engine tests; engine changes must not require UI changes.
4. Keep PRs small and single-purpose. CI runs tests, typecheck, build and a Windows
   package build on every push and pull request.

## Versioning and releases

- **One source of truth:** `version` in `package.json`. It is injected into the app UI
  at build time (`__APP_VERSION__` in `vite.config.ts`) and embedded in release file names.
- Add a `CHANGELOG.md` entry (`## [x.y.z] — YYYY-MM-DD`) for every version bump.
  `npm run version:check` fails if the top entry and `package.json` disagree.
- Cutting a release: see [docs/RELEASE.md](docs/RELEASE.md). In short: bump version →
  changelog → `npm run dist` locally → commit → tag `vX.Y.Z` → push the tag.
  Pushing the tag runs `.github/workflows/release.yml`, which builds Windows/macOS/Linux
  artifacts and attaches them to the GitHub Release automatically.

## Free / Pro rules

`src/engine/features.ts` is the single place where entitlements live.

- Everything the app does today is declared `free` — keep it that way.
- Pro features may only be *registered*; they must stay dormant (nothing in the UI may
  depend on them) until a real entitlement mechanism exists.
- No payment integration, no accounts, no network calls. The app stays fully offline,
  and the free workflow must never be gated or degraded.

## Repository conventions

- Tracked: `src/`, `tests/`, `electron/`, `build/` (icons + generator), `site/` (launch page),
  `docs/`, config files.
- Not tracked: `node_modules/`, `dist/`, `release/`, `logs/`, `.cache/` (see `.gitignore`).
- `build/icon.png` / `build/icon.ico` are committed on purpose — CI needs them on
  Linux/macOS runners. Regenerate with `powershell -File build/make-icon.ps1`.

## Launch assets (public presentation)

- `site/index.html` is the public launch page (GitHub Pages or any static host). It uses
  `OWNER/REPO` placeholders in its links — replace them once the GitHub repository exists.
- Screenshots in `site/assets/screens/` are **generated from the real app**, never mocked:
  `npm run screenshots` builds the app, runs `scripts/demo-fixture.ts` (the actual tournament
  engine) to create a demo tournament, then drives the UI and captures each screen with
  `scripts/screenshots.cjs`. Run it again whenever the UI changes and commit the new PNGs.
- Public release notes live in `docs/releases/vX.Y.Z.md`, copied from
  `docs/RELEASE_NOTES_TEMPLATE.md`. Keep claims honest: only what actually shipped.
- Privacy statements live in `PRIVACY.md`; the app must stay free of analytics, accounts and
  network calls, so any change there needs a matching update.
