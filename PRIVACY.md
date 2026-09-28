# Privacy

Tournament Organizer is an offline desktop application. Short version: **your tournament data
stays on your computer.**

## What the app stores

- Your tournament projects (participants, matches, results, settings) in the application's
  local storage on the device where you created them.
- Basic app preferences (autosave on/off, confirmations, theme, chosen language) in the
  same place.

## What the app does not do

- **No account.** There is nothing to register for and no email address.
- **No cloud sync.** Nothing is uploaded, mirrored or backed up by us.
- **No analytics or telemetry.** The application contains no tracking code and never
  contacts a server of ours.
- **No third-party services.** No advertising, no crash reporting service, no paid API.
- **No internet traffic.** There is nothing to sign in to and nothing to reach.

## The one exception, and it is opt-in

The **local network sharing** feature (Settings → Event operations) lets your own devices —
a referee laptop, a display computer — receive and send the project over **your own Wi-Fi**.
It is off by default, opens a port on your local network only, and never contacts anything
outside it: there is no server, no relay and no cloud copy. Turning it off ends the
connection immediately.

Apart from that feature — and downloading the installer itself — the app makes no network
requests while running.

## On Android (1.3+)

The Android app is the same program and keeps every promise above. One difference is worth
stating plainly, because Android lists permissions where desktop apps do not:

- The APK requests **one** permission: *internet*. It is used for exactly one thing — talking
  to a computer on your own Wi-Fi when you start sharing, and nothing else. If you never use
  sharing, the app makes no network request of any kind. The project files themselves are read
  and written through Android's own file picker, inside the storage you pick, and the app has
  no access to photos, contacts, location, camera or microphone.
- Hosting a share (being the server) needs the desktop app; a phone can pull and push to a
  desktop that is hosting.

## Your control

- **Back up:** `Output → Save project file…` writes one portable `.top.json` you own. Copy
  it wherever you like, or drop it on a USB stick.
- **Move:** open that file on another computer with `Open file…` or `Import / Recovery`.
- **Stop sharing:** switch sharing off in Settings at any time; the port closes.
- **Delete:** removing a project from the Home screen deletes it from that device. Backups
  you exported earlier are unaffected — delete those yourself if you no longer want them.

## Releases and downloads

Downloading an installer from the releases page is an ordinary HTTPS download from GitHub.
The project is MIT licensed; the source code is public in the repository.

Questions about privacy? Open an issue in the repository.
