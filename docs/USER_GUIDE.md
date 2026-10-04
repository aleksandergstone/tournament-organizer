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

The Bracket screen exists for formats that end in a knockout — single elimination,
double elimination and groups + knockout. In a league, a round robin or Swiss there
is nothing to draw: every match is on **Results** and the table is on **Standings**,
so those screens do not appear in the navigation at all.

A single-elimination bracket is drawn as a **spider**: every round is a column, the
first round on the left, the final on the right, with lines joining a match to the
one it feeds. The winner of each match is marked in colour and the champion is
called out above the final. The same drawing is what the *Bracket* document prints,
on its own page.

## Enter results

1. Open **Results**.
2. Type both scores and click **Save played** (or press `Enter` in a score field),
   or use **Walkover / Unfinished / Interrupted / Reset** for special cases.
3. Brackets recompute automatically — winners advance, later results that became
   impossible are cleared. Standings update instantly.
4. Keyboard: `j` / `k` move between matches, `/` search, `Ctrl+Z` undo, `Ctrl+Y` redo.

Groups + knockout: once group matches are played, open **Standings**, choose
qualifiers (per group + wildcards) and click **Seed knockout from standings**.

**Standings** shows a points table where points decide the event — a league, a
round robin, Swiss or a group stage. A knockout has nothing to rank by points, so
the screen shows the final result instead: champion, runner-up and third place,
and the same list is what the *Final result* document prints.

## Event operations (1.1+)

### Display mode — the screen in the hall

1. Generate a schedule and enter some results, then open **Display**.
2. Press **Open on second screen** (a second, read-only window) or **Full screen**.
3. The screen shows the current match, the next one, the top five and the time.
   It refreshes by itself — no clicking during a match.
4. With nothing left to play it says *All matches played*; before the first result it
   says *Waiting for results*.

The display never shows organizer controls, so a visitor cannot change anything.

### QR codes — coming back in a later version

The QR check-in, match and station codes are being reworked, so the QR screen is
hidden for now. The codes are generated locally and always were — no server, no
internet — and the deep links behind them (`to://<project>/<kind>/<id>`) keep
working, so anything already printed still opens the right match or participant.

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



## Output & branding

Open **Output** to produce the paperwork. The screen shows a live preview of the
exact page that gets printed, so what you see is what leaves the app.

1. **Pick a document** — standings, match list, timetable, bracket, group tables, or
   the *organizer pack* (event information + table + match list + timetable + bracket
   in one file). In a knockout event the *standings* document is called **Final
   result** and prints the places instead of a table — a bracket has no points to
   rank by.
2. **Set the branding** — event title, competition subtitle, season/edition, event
   logo, optional sponsor logo, a header line, footer text, a notes block and an
   accent colour. Branding belongs to the project: it is saved, exported, synced and
   used by every document.
3. **Produce it** — **Save as PDF**, **Print…**, or **Save CSV** for spreadsheets.
4. **Save project file…** — one portable `.top.json` with the whole project (backup,
   move to another PC).

Documents follow the language you selected (see below): headings, column names,
status words and dates are printed in it.


## On the phone (Android)

The Android app is the same program as the desktop one — same formats, same screens, same
documents, same languages, same version. Install the APK, allow installs from your file
manager, and it works offline like the desktop build.

Things worth knowing on a phone:

- **Navigation** is a row under the app bar; swipe it sideways. The action buttons sit at the
  bottom of the screen, under your thumb. The phone's **back button** returns to the previous
  screen, and at the Home screen it closes the app.
- **Printing and PDF** use Android's own print dialog. Choose a printer, or *Save as PDF* to
  write the file to the phone. The document is the same one the desktop prints — same A4
  layout, same drawn bracket.
- **Saving a backup or CSV** opens the system file picker, so you choose the folder (Downloads,
  Drive, a message to a colleague…). **Import** works the same way.
- **Wi-Fi sharing:** a phone cannot host the share (that needs the desktop app), so
  *Hosting* is not available here. The phone can still **pull from** and **push to** a desktop
  that is hosting — put the desktop's address into the field. This is the only use of the
  app's single internet permission, and only while you do it.
- **The project lives on the phone.** A tournament made on the phone is a separate project
  from the one on your laptop until you export a backup file or sync over Wi-Fi — there is no
  cloud in between.

## Language (1.3+)

**Settings → Appearance → Language** — *System*, English, Polski, Deutsch or
Español. The switch applies immediately; nothing restarts, nothing is downloaded.
The choice is remembered with your settings, and the printed documents, the CSV and
every message the app produces follow it.

Round names (for example *Runda 3*, *Quarterfinal*) are written in the language
active when you generate the bracket — they are part of the project. Generate the
bracket again if you want a different language on an existing project.

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
  **Output → Save project file…** as a rescue backup.
- Deleted the wrong project from Home? It is gone from this device — restore
  from a `.top.json` export via Import / Recovery.

## Offline use

The app never needs the internet for tournament work: no login, no server, no
telemetry. Projects are stored on this device (app local storage) and optionally
in `.top.json` files you control. Install once, use forever. Sharing a project
with your own devices (LAN sync) is optional, off by default, and stays inside
your Wi-Fi. The only feature that uses the network is the online preview below,
and it does nothing until you press its button.

## Online preview (optional)

**Online preview** in the sidebar puts the current tournament on a website so
spectators can follow it. It is off until you press **Activate link**, and nothing
is sent before that.

1. Choose who can see the link: *anyone with the link*, or *anyone, including
   search engines*.
2. Check the address on screen — it is the tournament's name written as a URL.
   If you dislike it, rename the tournament; the address is created when you
   activate, not before.
3. Press **Activate link**. The link is live, can be copied to the clipboard, and
   can be shown as a QR code.

After that:

- **Update results** sends the current results to the page again.
- The link stays exactly as it was handed out, even if you rename the tournament.
- Changing the visibility while the link is live is pushed immediately.
- **Delete link** takes the page down at once and removes it from the server,
  rather than leaving it there hidden.

Only participants, matches and standings are sent. Your tags, notes, audit
history and tournament rules stay on this computer.
