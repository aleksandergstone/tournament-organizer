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

## Export

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
