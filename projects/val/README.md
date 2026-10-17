# VAL — the VALORANT room

`val.html` reads `val-data.js` (every match) and `matches/<id>.js` (each match in
full). `llm/` is the same data as plain text. All generated; never hand-edited.

## Where the data comes from

Riot's own match details: the record the client keeps after every game, the same
one behind the in-game match report and timeline. Per match:

- every kill: killer, victim, assists, weapon or ability, time in round, and **the
  position and facing of every living player at that instant**
- damage from each player to each other player, split head / body / legs
- every player's buy each round: loadout value, credits spent and left, weapon, shield
- spike plants and defuses: who, where, when, and everyone's positions at that moment
- round results, combat score, rank and RR change

Each position is stored three ways: Riot's game coordinates `x, y`; the same point
on the minimap image as `u, v` (0–1 of its width and height); and the nearest of
Riot's callout names. `content.py` gets the callouts, the minimap and the
coordinate transform from valorant-api.com (a mirror of the game's own asset
files) and downloads each played map's minimap into `maps/`, so the page itself
makes no outside requests.

**How it's read.** VALORANT has no personal API keys (Riot's public API needs an
approved production app plus Riot Sign-On). So `riot.py` reads from the Riot
Client already running and signed in on this PC: its lockfile gives a local port
and one-time password, the client hands over a short-lived token, and that token
makes a few GETs for Ric's own history and match details. Nothing is stored and
nothing is written to Riot. It reads no game memory (what Riot started blocking on
2026-10-06). It is **not an official API**, though: Riot doesn't support it for
third parties and could change or close it. That's the trade Ric chose.

**Other players appear by agent, not Riot ID.** VALORANT stat sites only name
players who opted in. `show_others_names` in `val-account.json` flips that, then
run `pull-val.py --rebuild`. `raw/` keeps Riot's untouched JSON locally (it carries
every player's account id) and is gitignored, so a rebuild never needs Riot again.
The published match id is a hash of Riot's (`public_id()`), never Riot's own — that
one opens Riot's record of the match, every Riot ID in it, to anyone with an account.

**The archive only grows.** Riot's history is finite; `val-data.js` is the record.

## The session watcher

There are no launch options in the Riot Client, so the way in is the desktop
shortcut **VALORANT + Terminal** (`install.py` makes it). It starts VALORANT, syncs
when the game opens, every 30 minutes while `VALORANT-Win64-Shipping.exe` runs, and
once more after it closes, then exits. Started VALORANT some other way? Nothing is
lost: the next session through the shortcut catches up on Riot's history.

`sync.py` = `pull-val.py` → `export-llm.py` → commit `val-data.js`, `matches/`,
`llm/`, `maps/` (on main, never mid-merge, never pushed). `"commit": false` in
`val-account.json` stops the commits. Log: `%LOCALAPPDATA%\ric-terminal\val-session.log`.

## By hand

```
python projects/val/pull-val.py
python projects/val/pull-val.py --rebuild
python projects/val/export-llm.py
```
