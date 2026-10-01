# Release process

Tag-driven and repeatable. The GitHub Actions workflow does the heavy lifting;
your job is version + changelog + tag.

```
version bump → changelog entry → npm run dist (local sanity) → commit → git tag vX.Y.Z → git push --tags
                                                                        └─ CI builds Win/macOS/Linux and publishes the GitHub Release
```

## 0. First time: connect this repo to GitHub

The local repository has no remote yet — add one, then push `main` and the tag.
Create the (empty, **no README**) repository on github.com first, or use the CLI:

```powershell
# with GitHub CLI
gh auth login
gh repo create tournament-organizer --public --source=. --remote=origin --push

# or manually (replace with your account/repo name)
git remote add origin https://github.com/<user>/tournament-organizer.git
git push -u origin main
git push origin v1.0.0
```

If you created the GitHub repo with a README/license, push with
`git push -u origin main --force-with-lease` or pull first — GitHub's auto-created
files would otherwise conflict.

After pushing:

1. **Actions tab** — the `CI` workflow runs (validate + Windows package).
2. **Actions tab** — the `Release` workflow runs for the pushed `v1.0.0` tag:
   builds Windows/macOS/Linux, then creates the Release.
3. **Releases page** — `Tournament Organizer v1.0.0` should list three assets:
   `*-win-x64.exe`, `*-mac-*.dmg`, `*-linux-x86_64.AppImage`.

Verify from the CLI (optional — everything is visible in the GitHub UI):

```powershell
gh run list
gh release view v1.0.0 --json tagName,assets
```

Installers are **unsigned**: Windows shows "Unknown publisher" (choose *More info →
Run anyway*), macOS requires right-click → Open. Say so in the release notes.

## 1. Version bump (the only place)

1. Pick the version (semver):
   - **patch** — bug fixes only · **minor** — new features, no project-file change ·
     **major** — breaking changes or a project-file migration.
2. Update `version` in `package.json`. This is the single source of truth: it is injected
   into the app UI at build time and embedded in release file names.
3. Add a `CHANGELOG.md` entry at the top:
   `## [x.y.z] — YYYY-MM-DD` with **Added / Changed / Fixed** sections.
4. Copy `docs/RELEASE_NOTES_TEMPLATE.md` to `docs/releases/vX.Y.Z.md` and fill it in — this is
   what users read on the release page (highlights, fixes, known limitations, downloads,
   unsigned-installer note).
5. If the UI changed, re-run `npm run screenshots` and commit the updated PNGs.

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

### The Android build (added alongside the desktop ones)

The phone app is **not** produced by the release workflow — it needs the Android toolchain, so
it is built and attached by hand:

```powershell
npm.cmd run android:toolchain    # once: JDK 21 + Android SDK into tools/
npm.cmd run android:apk          # signed APK → release\Tournament-Organizer-<v>-android-release.apk
gh release upload v1.1.0 release\Tournament-Organizer-1.1.0-android-release.apk --clobber
```

- `version:check` also reads `android/app/build.gradle`, so the APK can never carry a different
  version than the installers.
- Signing uses `android/keystore.properties` + `android/to-release.keystore`, both **outside
  git**. Back the keystore up: Android only accepts updates to an app signed with the same key.
  If you ever publish to Google Play, use a Play upload key and keep the app key in a secrets
  store — and upload an `.aab` (`gradlew bundleRelease`) rather than an APK.
- The APK is unsigned by Google Play but signed with your own key, so the phone will ask you to
  allow installs from your file manager the first time. Say so in the release notes.
- If you have no keystore, `npm run android:apk:debug` produces a debug APK that installs on
  your own phone just as well — good enough for testing, not for distributing.

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
- **The app stays free.** Do not register a paid tier, a licence, a gate or a purchase
  prompt. `tests/free-and-support.test.ts` enforces this and will fail the build if any
  comes back. Support, if ever wanted, is a voluntary link configured only in
  `src/support.ts`.

