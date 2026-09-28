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
