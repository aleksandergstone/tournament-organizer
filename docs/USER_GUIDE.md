# Tournament Organizer — User Guide

Everything works offline. Nothing is uploaded anywhere.

## Create a tournament

1. On the Home screen click **+ New tournament**.
2. Enter a name, choose a sport/game and a format:
   - **Single elimination** — lose once and you're out (one-day cups).
   - **Double elimination** — two lives: winners + losers bracket, grand final.
   - **Round robin / League** — everyone plays everyone.
   - **Swiss** — fixed number of rounds, paired by current points.
   - **Groups + knockout** — group stage, then top teams advance to a KO bracket.
3. Click **Create → add participants**.

## Add participants

- Type a name and press **Enter**, or
- Paste a whole list under **Paste list** (one name per line) and click **Add all**.
- Use **Withdraw** for a player who drops out: they are removed from unplayed
  matches (opponent gets a walkover) and their played history is kept.

## Generate the bracket

1. Open **Rules**, review points/seeding options.
2. Click **Generate bracket / schedule**.
3. You land on the **Bracket** view. Regenerating later asks for confirmation
   because it discards entered results.

## Enter results

1. Open **Results**.
2. Type both scores and click **Save played** (or press `Enter` in a score field),
   or use **Walkover / Unfinished / Interrupted / Reset** for special cases.
3. Brackets recompute automatically — winners advance, later results that became
   impossible are cleared. Standings update instantly.
4. Keyboard: `j` / `k` move between matches, `/` search, `Ctrl+Z` undo, `Ctrl+Y` redo.

Groups + knockout: once group matches are played, open **Standings**, choose
qualifiers (per group + wildcards) and click **Seed knockout from standings**.

## Event operations (1.1+)

### Display mode — the screen in the hall

1. Generate a schedule and enter some results, then open **Display**.
2. Press **Open on second screen** (a second, read-only window) or **Full screen**.
3. The screen shows the current match, the next one, the top five and the time.
   It refreshes by itself — no clicking during a match.
4. With nothing left to play it says *All matches played*; before the first result it
   says *Waiting for results*.

The display never shows organizer controls, so a visitor cannot change anything.

### QR codes — check-in and jump-to-match

1. Open **QR codes** and pick a tab: **Check-in**, **Match** or **Station**.
2. Pick a target and press **Print** (or just show it on screen).
3. A participant code marks that participant as checked in when scanned; a match code
   opens the result entry for exactly that match (highlighted, even if the filter
   hides it); a station code opens the schedule of that place.
4. Codes contain only a local identifier (`to://<project>/<kind>/<id>`) — no server,
   no internet. A code that points at something removed is refused with a clear message.

On a phone, point the camera at the code to read the identifier, then open the app
and paste it into the address after `#` (e.g. `#to://t_123/match/m_456`).

### Courts, tables and stations

1. Open **Schedule** and add your places (Court 1, Table 2, Ref station…).
2. Give each match a place, a start time and an estimated duration.
3. Two matches on the same place at the same time are listed under **Conflicts** —
   the app does not quietly allow it.
4. **Fill free slots** plans every match that has no time yet, from the chosen start
   hour, using 30 minutes per match and never double-booking a place. Adjust anything
   afterwards; the conflicts list updates immediately.
5. **Order of play** shows the day's running order.

### Group stage → knockout

1. Play the group matches, open **Standings**.
2. Set *Advance per group* and *Wildcards*.
3. Press **Preview knockout stage**. You see who advances, from which group and with how
   many points, the seeding order, and the bracket that will be created.
4. **Create knockout stage** applies it; **Cancel** changes nothing at all. Group results
   are always kept.

### Sharing on the local network (LAN sync)

Useful when the organizer laptop, a referee's tablet and a display computer work
side by side on the same Wi-Fi.

1. On the organizer machine: **Settings → Event operations → Start sharing on this
   device**. The app prints addresses like `http://192.168.1.24:8971`.
2. Allow the Windows firewall prompt the first time another device connects.
3. On the other device: open the same project, enter that address and press
   **Receive from it** (or **Send to it** to push this device's version).
4. Conflicts are resolved by rule, not by surprise: per match the newer edit wins, a tie
   keeps this device, participants/groups/places follow the newer project, and the
   bracket is recomputed after every merge. Each merge is a normal, undoable change.
5. If sharing is off, the app works exactly as before — nothing depends on the network.



Open **Export**:

- **Save .top.json** — portable project file (backup, move to another PC).
- **Standings CSV / Matches CSV** — spreadsheets.
- **Print** — clean print sheet of ranking + results.

## Import / recover

- **Home → Open file…** or **Import / Recovery → Choose .top.json file**.
- Files are fully validated *before* anything is overwritten. A damaged file
  is rejected with a plain-language error; the current project stays untouched.
- Old file versions are migrated automatically (a warning lists what changed).

## Recover from mistakes

- `Ctrl+Z` / `Ctrl+Y` — undo/redo through the whole session.
- Autosave keeps ~everything you commit; the top bar shows **● Save** when there
  are unsaved changes and the last save time.
- If saving fails, a red banner explains why — your data stays in memory; use
  **Export → Save .top.json** as a rescue backup.
- Deleted the wrong project from Home? It is gone from this device — restore
  from a `.top.json` export via Import / Recovery.

## Offline use

The app never needs the internet: no login, no server, no telemetry. Projects
are stored on this device (app local storage) and optionally in `.top.json`
files you control. Install once, use forever.
