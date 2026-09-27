# Release process

Tag-driven and repeatable. The GitHub Actions workflow does the heavy lifting;
your job is version + changelog + tag.

```
version bump → changelog entry → npm run dist (local sanity) → commit → git tag vX.Y.Z → git push --tags
                                                                        └─ CI builds Win/macOS/Linux and publishes the GitHub Release
```

## 1. Version bump (the only place)

1. Pick the version (semver):
   - **patch** — bug fixes only · **minor** — new features, no project-file change ·
     **major** — breaking changes or a project-file migration.
2. Update `version` in `package.json`. This is the single source of truth: it is injected
   into the app UI at build time and embedded in release file names.
3. Add a `CHANGELOG.md` entry at the top:
   `## [x.y.z] — YYYY-MM-DD` with **Added / Changed / Fixed** sections.

`npm run version:check` (part of `release:check`, part of CI) fails if these disagree.

## 2. Validate locally

```powershell
npm.cmd ci
npm.cmd run release:check    # version:check + vitest + tsc + vite build
npm.cmd run dist:win         # optional: build the Windows installer locally
```

## 3. Tag and push

```powershell
git add package.json CHANGELOG.md
git commit -m "release: v1.1.0"
git tag v1.1.0
git push origin main
git push origin v1.1.0     # triggers .github/workflows/release.yml
```

The workflow refuses to run if the tag does not match `package.json`.

## 4. What CI produces

`.github/workflows/release.yml` builds in parallel and attaches everything to the GitHub Release:

| Platform | Artifact |
|---|---|
| Windows (x64) | `Tournament-Organizer-<v>-win-x64.exe` (NSIS installer) |
| macOS (x64 + arm64) | `Tournament-Organizer-<v>-mac-{arch}.dmg` |
| Linux (x64) | `Tournament-Organizer-<v>-linux-x86_64.AppImage` |

Release notes are generated from the commit history; the CHANGELOG entry is the curated
human summary. Re-running a failed tag job is safe: artifacts are re-uploaded with `--clobber`.

Every push and PR also runs `.github/workflows/ci.yml`: version check, tests, typecheck,
build, plus a Windows package build uploaded as a workflow artifact.

## 5. Manual publish (no CI)

```powershell
npm.cmd run dist
gh release create v1.1.0 release/* --title "Tournament Organizer 1.1.0" --notes-file CHANGELOG.md
```

## Smoke test checklist (before tagging)

- [ ] `npm run release:check` green
- [ ] Create → add 4 players → generate single-elim → enter 3 results → undo → redo
- [ ] Double-elim bracket advances winners and losers correctly after a score change
- [ ] Export `.top.json`, delete the project, re-import it successfully
- [ ] Settings → About shows the new version; theme switch works
- [ ] Reopen the app: window size/position remembered, recent projects intact

## Notes

- **Signing:** no code-signing certificate is configured. Windows SmartScreen warns on
  first run ("Unknown publisher"), macOS Gatekeeper requires right-click → Open. Documented
  in release notes. Adding signing later is a pure packaging change
  (`build.win.certificateFile` / `build.mac.notarize`).
- **Reproducibility:** `npm ci && npm run dist` from a clean checkout. Icons are committed
  and regenerable via `build/make-icon.ps1`.
- **Project files:** never change the `.top.json` format without updating
  `sanitizeImport` / `migrateProject` in `src/engine/validate.ts` and the import tests.
- **Free/Pro:** new Pro capabilities are only *registered* in `src/engine/features.ts` and
  must stay dormant — no gating, no payments, no accounts.

