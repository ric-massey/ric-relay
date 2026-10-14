# CS — the Counter-Strike 2 room

`cs.html` reads `cs-data.js` (every match) and, for games with a saved demo,
`matches/<id>.js` (the 2D replay). Both are generated; nothing here is hand-edited.

## Where the numbers come from

Three sources, most complete first. Every match records which ones it has.

| Source | Script | What only it gives |
|---|---|---|
| **Valve's demo** (`.dem`) | `parse-demos.py` | Every player's position, every kill with weapon and position, grenades, bomb plants, KAST, opening duels — and the 2D replay |
| **Valve's live feed** (Game State Integration) | `gsi.py` | The match the moment it ends, money and loadout every round |
| **Leetify** (public API) | `pull-leetify.py` | Games whose demo Valve already deleted; aim/utility measurements and ratings |
| **Steam Web API** (match history) | `steam.py` | Valve's own list of every match — used to list demos still to download |

**The Stats section.** `stats.py` (run by `export-llm.py`, so by every sync)
boils every saved demo down to `stats.js`: each round Ric played (side, result,
how it ended, opening kill, clutch, his kills and damage, both teams' buy) and
each of his kills and deaths (both players' callouts and positions, weapon,
headshot/wallbang/smoke/flash, range, men alive, traded), plus every hit by
hitgroup. The page slices it by map and side. The replays are ~600 KB each;
`stats.js` is the one small file the page can load whole. Its damage runs a few
percent under Leetify's ADR, so the page labels it as the demo's.

**The page itself.** Overview opens on the latest match: its score, a radar
of every kill and death in it, and its rounds, any of which starts the 2D
replay. One shared filter (last 5 / last 10 / all games, map, mode) drives
Overview, Stats and Your Matches, and always says how many matches it is
counting; averages still count ranked games only. Every stat that isn't
self-explanatory has a tap-to-open ⓘ, and About lists them all — keep those
definitions in step with `GLOSSARY` in `export-llm.py`. The replay and the kill
snapshots load a match file (~600 KB) only when opened. The replay's address is
`#replay/<id>/<round>[/<seconds>]` and a kill snapshot's is
`#snap/<id>/<round>/<seconds>`; each has a copy-link button. Overview also
charts ADR and the Leetify rating game by game, each with a five-game trend
line, and any percentage built on fewer than five things is dotted-underlined. If
`cs-data.js` or `stats.js` fails to load the page says so with a Try again
button, rather than drawing an empty record.

**Packed tracks.** Positions are most of a replay file, so `parse-demos.py`
writes them packed (`pack_tracks` in `csdata.py`): steps instead of positions,
x and y in 2-unit steps, trailing gaps cut. That made the 16 files about 30%
smaller (9.0 MB → 6.5 MB on disk) at a cost of at most one game unit of
position. The page unpacks them on load. `test/parity.mjs` checks that the page
and the Python agree on the unpacked tracks, and replays every bomb timeline
through both `bombAt()` in `cs.html` and `bomb_state()` in `export-llm.py`; it
runs in `node .github/checks.mjs`.

**Plain text for machines.** `export-llm.py` (run by every sync) rewrites
`llm/index.md` and one `llm/<id>.md` per match: the same data as the page, every
fight in every round written out, for LLMs and anything else that reads the site
without running its JavaScript. `/llms.txt` at the site root points there. Never
hand-edit `llm/`; change the exporter.

`cs-data.js` is an **accumulator**: no script ever removes a match. Valve deletes
demos after a few weeks and Leetify's list only goes back so far, so this file is
the permanent record. Rows are merged on Valve's match id, or, where a source
doesn't know it, on map + final score + Ric's K/D.

**Other players appear by their in-game names**, as they do on Leetify and every
public stats site (Ric's decision, 2026-10-13). Steam ids are never written. Share
codes stay in local state — a share code is enough to download the whole demo.

## The session watcher (runs only while CS2 does)

`cs-session.pyw` is started by CS2's Steam launch options, starts the game itself
first, then:

- listens on `127.0.0.1:3010` for the game's live feed,
- runs `sync.py` every 30 minutes while `cs2.exe` is open,
- runs it once more after the game closes, and exits.

Nothing runs between sessions. The `CS2 + Terminal` desktop shortcut does the same
thing (it launches CS2 through Steam). Log: `%LOCALAPPDATA%\ric-terminal\cs-session.log`.

`sync.py` = demos → live feed → Steam → Leetify, each in its own process so one
failing never stops the rest, then **commits `cs-data.js` and `matches/` only**
(on `main`, never mid-merge). It never pushes; a push is a publish. Set
`"commit": false` in `cs-account.json` to stop the commits.

## Setup (once)

```
python -m venv projects/cs/.cs-venv
projects/cs/.cs-venv/Scripts/python -m pip install demoparser2
copy projects\cs\cs-account.example.json projects\cs\cs-account.json   # put your SteamID64 in
projects/cs/.cs-venv/Scripts/python projects/cs/install.py
```

`install.py` writes the GSI config into CS2's `game/csgo/cfg/`, makes the desktop
shortcut and prints the line to paste into **Steam → Counter-Strike 2 → Properties →
Launch Options**. CS2 only reads GSI configs at start-up, so restart it once.

If the repo moves, rerun `install.py` and paste the new launch option — Steam can't
start CS2 through a wrapper that isn't there any more.

### Optional: Valve's match list

`steam.py` needs two secrets, kept in Windows Credential Manager, never in the repo:

```
cmdkey /generic:ric-terminal/steam-webapi /user:steam /pass:<Web API key>
cmdkey /generic:ric-terminal/cs-match-auth /user:steam /pass:<match auth code>
```

Web API key: steamcommunity.com/dev/apikey. Match auth code: help.steampowered.com →
Counter-Strike 2 → "Access to Your Match History". Without them the rest still works.

## The radars

`extract-radars.py` pulls CS2's own radar images and each map's calibration out of
`pak01_dir.vpk` using Source 2 Viewer's command-line tool (ValveResourceFormat,
v20.0, unzipped into `tools/vrf/`, gitignored — download `cli-windows-x64.zip` from
its GitHub releases if it's missing). Output goes to `radar/` (committed, ~430 KB):
a `.webp` per map, a `_lower` one for two-floor maps, and `radar.js` with the
calibration. Rerun it when a CS2 update reworks a map; `parse-demos.py --rebuild`
then re-parses every archived demo against it.

## Getting the demos automatically (the bot)

`fetcher/fetch-demos.mjs` runs first in every sync. It signs a **second, bot Steam
account** in (never Ric's — signing his own account into Valve's game coordinator
would kick him out of his game), briefly "launches" CS2 as the bot, asks Valve
about each match by share code, and downloads the demo Valve points at
(`roundstatsall[].map` in the answer) into `demos/`, where `parse-demos.py` picks
it up. Valve's links last about a month and its history is about 8 matches deep;
checking every 30 minutes while CS2 is open stays well inside both.

Setup, once:
1. Make a free Steam account for the bot and add Counter-Strike 2 to its library.
2. `cd projects/cs/fetcher && npm install`
3. `node projects/cs/fetcher/login.mjs` — type the bot's username, password and
   Steam Guard code yourself. Only the login token Steam returns is kept, in
   Windows Credential Manager (`ric-terminal/cs-bot`); the password is forgotten.
   Run it again if a sync ever says the token was refused.

Share codes come from Leetify (hours late) or, with the Web API key and match auth
code below, straight from Steam.

## Getting the demos by hand

Valve won't hand a demo to a script without a logged-in game-coordinator session, so
the download is the one manual step: **CS2 → Watch → Your Matches → Download**. The
next sync copies it to `keep_demos_in` (default `projects/cs/demos/archive/`,
gitignored — demos are 100+ MB) and parses it. `demos/DOWNLOAD-THESE.txt` lists every
match Valve still has that isn't saved yet. You can also drop any `.dem` /
`.dem.bz2` into `projects/cs/demos/`.

Replays are sampled twice a second (~350 KB a match). `HZ` in `parse-demos.py`
trades size for smoothness.

## By hand

```
projects/cs/.cs-venv/Scripts/python projects/cs/sync.py          # everything
projects/cs/.cs-venv/Scripts/python projects/cs/parse-demos.py some.dem
python projects/cs/pull-leetify.py
```
