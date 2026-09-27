# Release notes template

Copy this file to `docs/releases/vX.Y.Z.md` for each release, fill the sections, and use it as
the body of the GitHub Release. Keep it short and concrete — users read this on the releases page.

---

# Tournament Organizer <x.y.z>

Released <YYYY-MM-DD> · [Download](#download) · [Changelog](../CHANGELOG.md)

## Highlights

- <What is new, in one line each. Only things that actually shipped.>

## Fixes

- <Bug that users would notice, and what now happens instead.>

## Known limitations

- <What is still missing or awkward. Honest list; delete the section if empty.>

## Download

| Your system | File | Notes |
|---|---|---|
| Windows (x64) | `Tournament-Organizer-<x.y.z>-win-x64.exe` | NSIS installer |
| macOS (Intel / Apple silicon) | `Tournament-Organizer-<x.y.z>-mac-<arch>.dmg` | Disk image |
| Linux (x64) | `Tournament-Organizer-<x.y.z>-linux-x86_64.AppImage` | `chmod +x`, then run |

## Installation

- **Windows:** run the installer and follow the prompts. The installer is not code-signed, so
  Windows shows “Unknown publisher” — choose *More info → Run anyway*.
- **macOS:** open the disk image and drag the app into Applications. The app is not notarized,
  so the first launch needs right-click → *Open*.
- **Linux:** `chmod +x Tournament-Organizer-<x.y.z>-linux-x86_64.AppImage` and run it.

## Upgrading

- Your existing projects keep working; the app stores them locally.
- <Add a line only if project files changed: “Open a backup of the previous version to migrate it.”>
- To move projects to a new machine: `Export → Save .top.json`, then `Import / Recovery` there.

## Thanks

- <Contributors, testers, translators. Optional.>
