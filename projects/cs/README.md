# CS — the Counter-Strike 2 room

`cs.html` reads `cs-data.js` (every match) and, for games with a saved demo,
`matches/<id>.js` (the 2D replay). Both are generated; nothing here is hand-edited.
The replays are kept in Cloudflare R2, not git (see **Replays live in R2** below);
`matches/` is this machine's copy.

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
Leetify's match id is never written either — its keyless API answers it with every
player's Steam id — so the data keeps a hash of it (`csdata.leetify_key()`), and a
Leetify-only match is published as `lt-<that hash>`.

## The session watcher (runs only while CS2 does)

`cs-session.pyw` is started by CS2's Steam launch options, starts the game itself
first, then:

- listens on `127.0.0.1:3010` for the game's live feed,
- runs `sync.py` every 30 minutes while `cs2.exe` is open,
- runs it once more after the game closes,
- and if a match the live feed saw this session still has no demo (Valve's share
  code reaches Leetify a while after the match), runs it again up to twice, 15
  minutes apart — or goes back to step two if the game starts again — then exits.
  Casual games never get a demo and don't count.

Nothing runs between sessions. The `CS2 + Terminal` desktop shortcut does the same
thing (it launches CS2 through Steam). Log: `%LOCALAPPDATA%\ric-terminal\cs-session.log`.

`sync.py` = demos → live feed → Steam → Leetify, each in its own process so one
failing never stops the rest, sends new replays to R2, then **commits the room's data only** (`cs-data.js`, `stats.js`, `matches/` until it moves to R2, `llm/`, `p/`)
(on `main`, never mid-merge), then **pushes them** so a session reaches the site
by itself (Ric's call, 2026-10-14). It pushes only commits that touch nothing but
the room's data; if other work is waiting to go out it pushes nothing and says
so. If GitHub moved on meanwhile it rebases its commits on top first, and if that
won't go cleanly — or GitHub changed a file you have uncommitted edits in, where
putting your edits back would leave conflict markers — it leaves everything for you. `"push": false` in
`cs-account.json` stops the push; `"commit": false` stops both.

**If anything goes wrong you get a Windows toast** (`notify.py`, Ric's call,
2026-10-15): a step exiting non-zero, a commit that didn't happen, or a push that
was refused or held back. One toast per sync lists every problem, each problem
once per play session (a sync by hand always toasts); it never steals focus from
the game. `CS_NO_TOAST=1` silences it, and
`projects/cs/.cs-venv/Scripts/python projects/cs/notify.py` sends a test one.

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

## Replays live in R2

A replay is 0.3-0.9 MB (13.3 MB for the first 19, with the 8 Hz kill windows),
one per game, forever. At a few hundred games that alone passes the 1 GB GitHub
Pages allows, on a repo that was already 600 MB, and git keeps a file forever
even after it's deleted. So the replays go to Cloudflare R2: the `photos` bucket
the climbing media already uses, under `cs/replays/`, served by the site's
Worker (`training-log`):

- `GET /cs/replay/<id>`: public, served as JavaScript (the page loads it as a
  `<script>`, exactly like the repo copy). `cs.html` asks the Worker first and
  falls back to `projects/cs/matches/<id>.js`, so nothing breaks while both
  exist, and a local server (where `/cs/replay` 404s) uses the local files.
- `PUT /cs/replay/<id>`: needs the site password (`LOG_TOKEN`), and only takes
  the exact file shape `parse-demos.py` writes, so the URL can't be made to
  run anything else on the page. `worker/test.mjs` holds it to that.

R2's free tier is 10 GB with no charge for reads, about 14,000 games at today's size.

`upload-replays.py` (sync step 7) sends any new or re-parsed replay, reads each
one back to check it arrived byte for byte, and stamps its hash into
`cs-data.js` as `replay_v` (the page's `?v=`, so a re-parse is a fresh URL).
`--check` lists what R2 has, `--pull` rebuilds `matches/` from R2 on a machine
that has none, and `--move` is the one-time cutover.

**Turning it on (once, in this order):**

1. Deploy the Worker: Actions → **Deploy Worker** → Run workflow (or
   `npx wrangler@latest deploy` in `worker/`). Until then `/cs/replay` 404s and
   the page uses the repo copies.
2. Put the site password in Windows Credential Manager, typed, never pasted
   into a file or chat:
   `projects/cs/.cs-venv/Scripts/python projects/cs/creds.py set ric-terminal/log-token`
   (type it, Enter, then Ctrl+Z and Enter).
3. `projects/cs/.cs-venv/Scripts/python projects/cs/upload-replays.py`, then the same
   with `--check`, which should say every replay is in R2 and matching.
4. `... upload-replays.py --move`. It refuses unless step 3's check is clean. It
   writes `matches/.gitignore`, untracks the folder (keeping the files on disk) and
   stages that. Commit it; from then on the sync sends replays to R2 and git
   never sees another one. The LLM export's links switch to the Worker by
   themselves (`csdata.replay_url`).

The replays already in git's history stay there. Taking them out needs a
history rewrite, which is a separate decision. Without one, the repo just stops
growing by a replay a game.

`test/parity.mjs` reads `matches/` when it's there and otherwise the one
committed replay in `test/fixtures/`, which is what CI checks.

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

Each round also stores `yaws`: which way every player faced at each sample
(whole degrees, beside the tracks so their packing is untouched). The page draws
it as a cone and aim line. Replays parsed before 2026-10-14 have none; rebuild
them once from the archived demos to add it:

```
projects/cs/.cs-venv/Scripts/python projects/cs/parse-demos.py --rebuild
```

**Faster samples round every kill** (2026-10-17). Twice a second is fine for a
rotate and smears a peek, so each round also has `fine`: windows sampled
`fine_hz` (8) times a second from 3 s before every kill to 0.5 s after, merged
where they touch, with their own `tracks` and `yaws` packed like the round's.
The page uses a window when the clock is inside one and the 2 Hz track
everywhere else (`fineAt`/`momentAt`); the replay's ⋮ menu says how it's
drawn. 8 Hz everywhere would make every file about four times bigger.

Every shot is drawn too (Ric's ask, 2026-10-15), from the `shots` each round has
always stored — every trigger pull by all ten players, to a tenth of a second —
so every replay already had it and none needed rebuilding. The shooter gets an
orange ring and a flash at the gun; a shot that `damage` says landed (gun damage
in the same tenth of a second — fire and grenades don't count) draws a red line to whoever it hit and a red ring round them; a miss draws
an orange tracer the way the gun pointed on that tick (each shot's own `yaw`,
stored since 2026-10-15; older replays fall back to the 2 Hz facing). A headshot
adds a white ring and "HS". Each fades in `SHOT_S`. Knives and grenades
are left out.

**Win chance and what each kill was worth** (Ric's ask, 2026-10-15).
`winprob.py` fits a small logistic model on every moment of every saved round
— the start, every kill, the plant — from both teams' side, labelled with who
won: men alive on each side (as a log ratio), the bomb, the buy difference and
the side. `stats.py` refits it on every sync and writes it into `stats.js`
(`wp`), with each of Ric's kills and deaths carrying his team's chance just
before and after (`wb` / `wa`). The page draws the same function (`wpChance`
and friends, next to `bombAt`): a win-chance strip under the replay, each kill's
value in the round's kill list, **Biggest plays** in Records, and **Rounds
added** on each match (his kills' and deaths' values summed). `export-llm.py`
writes the same numbers into every fight. `test/parity.mjs` holds the page and
`winprob.py` to each other over every round of every replay.

**How good the win chance is** (Ric's ask, 2026-10-17: a 12% estimate
shouldn't be read as a rigorously established 12%). `winprob.check()`
tests the model on games it never saw: matches split ten ways, whole matches
per fold (moments of one round are near-copies, so splitting them would let it
mark its own homework), each fold predicted by a fit on the rest. It's scored
by Brier and log loss against a plain men-alive table, and binned into a
calibration table, and all of that is in `stats.js` (`wp.check`), behind the
page's ⓘ, and in `llm/index.md` under **Model check**. `wp.step` is how finely
the page shows a chance: **5% steps until calibration is within 2 points on
2,000+ held-out moments, then 1%**. A kill's value (a difference) stays in whole
points, because whatever the model gets wrong about a round it gets wrong on
both sides of the kill. On the first check (19 games) it beat the table (Brier
0.179 vs 0.186) and ran about 4 points optimistic for Ric's team between 40%
and 70%.

**Skill groups.** Each replay's `seats` carry the player's `rank` and
`rank_type` as the match began (hidden ranks are left off). They're set before
the game, so they can feed the model without leaking its result.
`winprob.fit()` tries the model with and without them and keeps rank only if
the held-out log loss improves; `wp.features` says which won.

**Saving a replay as video.** The replay's "Save this moment as video" (10 s
around the scrubber) and "Save whole round" record an offscreen 1080×1200
canvas — header with the score, round, clock and win chance, the radar with
everything the replay draws, the killfeed — with the browser's own
MediaRecorder: MP4 where it can, WebM where it can't. No server, no library.
A panel over the page first asks the speed (normal or 2×) and the quality
(`REC_Q`: Discord-friendly, sized from the length to stay under 10 MB; High;
Best), showing each one's length and estimated size, and remembers the
choice. While it records the panel says not to close the tab, switch away or
touch the page, shows progress and has Stop; a hidden tab pauses the
recording and it carries on when the tab is back. Measured: a 2:13 round at
normal speed, Discord-friendly, came out at 7.1 MB.

**Players** (Ric's ask, 2026-10-15: "it can just be their name"). A tab
listing everyone in Ric's matches by the in-game name the scoreboard had —
no Steam id, no hash, nothing else — built in the browser from the boards in
`cs-data.js`. Search a name to get every game that player was in with Ric,
with or against him, their record and line from their own side, and their
best game. Each player has an address, `#player/<name>`, to send them.
**Best rounds and best games are scored, not counted** (`highlight.py`). Kill
count picked badly — Yallzbalz's two kills then a death in a round a teammate
won, over his round 11 on Vertigo: a kill from 37% to 60% on an eco MAC-10,
then the last kill of a 1v1. A round's score is what the player's kills did
to their team's chance of it (winprob.py), a clutch won (+0.25 a man faced),
kills and fast multi-kills, headshots, kills on an eco and the round won,
less half of what their death cost. A game's score is all their rounds'
added up, so it rewards a game of good rounds over one lucky one. stats.js
carries every player's best round of every game with its score, the game
total and a few words on why. The player page shows their best game with
its best round, and their three best rounds anywhere, each with ▶ and Save
video, which opens the same video chooser. `llm/players.md` is the same list as text.

**Link previews** (`cards.py`, a sync step). Everything after `#` stays in
the browser, so a `cs.html#player/<name>` link shows Discord the same preview
for everyone. Each player gets `p/<slug>.html` — their own title,
description and picture, which sends a visitor straight on to their page —
and `p/<slug>.jpg`, 1200×630: the radar at their best game's best round,
at their biggest kill (a red line to who they killed), beside their name and
what they did. The slug is their name in ascii, with a few hex of a hash of
the name only when that's empty or two names collide. `p/cards.js` maps names
to slugs for the player page's Copy link. Names only, like the rest of the
room. ~8 MB for 160 players; drawing is deterministic, so a sync that
changes nothing rewrites nothing.

**Why he dies** (`deaths.py`). Every death in the saved replays is read at
the instant it happened — the replay's snapshot of all ten players, its
damage log, its flashes — and tagged: flashed; shot from outside the view
(the killer more than 60° off the way they faced); outnumbered (two or more
enemies hit them in the 5 s before); died alone (untraded, no teammate alive
within ~25 m); otherwise "lost the duel" (none of those found, which is not the same as an even fight); and whether they fired back.
`stats.js` carries Ric's deaths with their tags and every player's totals,
with everyone's as `*`. "Why Ric dies" on the Overview and "Why you die" on
a player's page say where they stand out against everyone, with a bar per
cause and the latest death of each kind to watch.

**Head to head.** A player's page compares them with Ric or anyone they
shared a game with, over the games both played, and says who killed whom
when they were on opposite sides (`duels` in `stats.js`, every pair of
names). `#player/<a>/vs/<b>` opens a comparison.

**The story** (`story.py`). Each match page opens with a few lines, each a
round to watch: the round that put the winner ahead for good, a comeback
from 3 or more down, the best clutch, the round won from the lowest chance,
and the player of the match by round score. The text reports carry it too.

**Habits.** Stats → Habits, and on a player's page: every round they played
on one map and side drawn at once from spawn, teal for rounds they lived
through and red for ones they died in, with a cross where — over the first
20 s, 40 s or the whole round — and where the early deaths cluster. Drawn
in the browser from the replays, one map's worth at a time.

**The replay's ⋮ menu and camera.** Every setting of the 2D replay sits in a
menu at its top right: Follow (Bomb or Player, the player from a dropdown with
everyone in the round), the floor, names, footsteps, Reset view, Copy link and
the two video buttons. On a phone it rises from the bottom of the screen
instead (it moves to `<body>` while open: the replay's blurred panels would pin
a fixed child to themselves). The camera eases after whoever it follows as it
plays and jumps there when you scrub; a drag lets go, a zoom keeps following.
It starts on whoever the page you came from is about — a player's page on
them, the Overview on Ric, anything else on the bomb — and the two looping
previews follow their player too. On two-floor maps everyone on the floor not
shown is drawn at 45%, everywhere the radar is drawn.

Replays are sampled twice a second (~350 KB a match). `HZ` in `parse-demos.py`
trades size for smoothness.

## By hand

```
projects/cs/.cs-venv/Scripts/python projects/cs/sync.py          # everything
projects/cs/.cs-venv/Scripts/python projects/cs/parse-demos.py some.dem
python projects/cs/pull-leetify.py
```
