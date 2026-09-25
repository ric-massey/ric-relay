# Terminal

Ric Massey's personal website — a terminal for family and friends to
follow what he's up to (Orrin, climbing, training, gaming, photos, write-ups) without having
to ask.

**Live:** https://ricmassey.com/
**Stack:** hand-written HTML/CSS/JS. No build step, no framework, no dependencies.
**Deploy:** edit a file, `git push` to `main`, GitHub Pages redeploys automatically.

> **Working on this repo with an AI assistant?** Read [`AGENTS.md`](AGENTS.md) first —
> it captures the conventions and the hard rules (no location data, one project only,
> keep each room's menu native to its theme).

## The idea

This is not a normal blog. The pitch is: *"imagine it's literally my own internet."*
The home page is a terminal hub, and every other page is a **room** styled to look like
the real app for that world — climbing looks like Mountain Project, training looks like
Strava, and so on. Each room is its own self-contained `.html` file.

## Pages

| File | Room | What it is |
|---|---|---|
| `index.html` | Terminal | Landing terminal — boot sequence + working command line (try `help`) |
| `orrin.html` | Orrin | Plain-language tour of Orrin plus live public project activity from GitHub |
| `psyche.html` | Psyche | Human-systems field notebook — mood, criteria, and evidence |
| `climbing.html` | Climbing | Mountain-Project-style route ledger — projects, ticks, objectives |
| `training.html` | Training | Strava-style feed — the generated plan, ticks and notes from a Worker, and runs pushed in by Strava as they finish |
| `gaming.html` | Gaming | Modern game launcher — the playable builds live here with quick, readable entry points |
| `apex.html` | Apex | Apex Legends lobby — rank ladder, career kills, and every legend carrying a tracker (data pulled by `projects/apex/pull-apex.py`) · *unlisted on the home directory* |
| `exploration.html` | Exploration | Space deck — experiments dock here |
| `workbench.html` | Workbench | Blueprint board of random / half-finished projects |
| `captures.html` | Captures | Darkroom contact sheet for photos |
| `entertainment.html` | Entertainment | The films-and-shows app — a billboard, a row of services, and shelves of poster tiles (starred first, then most recently watched). Every tile opens a detail sheet with a way through to whichever service it is on. Ric can add a title or move one between the lists from the page itself |
| `entertainment-library.html` | — | The whole catalogue as stacked DVD spines on shelves, and the catalog half of the same room: every title, filterable by service, genre, decade and state, as posters or as a dense list · *linked from `entertainment.html`, not a room of its own* |
| `log.html` | Log | Long-form write-ups, trip reports, Apex VOD reviews · *unlisted on the home directory* |
| `updates.html` | — | Legacy redirect to the homepage's latest-signal banner |
| `systems.html` | — | Legacy redirect from the former Orrin URL to `orrin.html` |
| `map.html` | Map | The themed door into ATLAS — the private crew map. The door is public; everything behind it needs a login · *unlisted everywhere; reachable by typing `map`* |
| `404.html` | — | On-brand "signal lost" page for mistyped URLs |
| `atlas/` | — | ATLAS, the private crew map — a whole app in this repo, served from `ricmassey.com/atlas/`. Code only: every pin, coordinate and photo lives in Supabase behind a login. See [`atlas/README.md`](atlas/README.md) |
| `playground/` | — | Scratch space for experiments and working design docs |
| `projects/` | — | Self-contained sub-projects, each linked from a room (see below) |
| `photos/` | — | Web-optimized images (originals stay out of git in `_photo-originals/`) |
| `captures-data.js` | — | Generated `[filename, date]` pairs for the 1,300+ photos `captures.html` draws |
| `entertainment-data.js` | — | The committed list both entertainment pages read — 363 titles, each with a status, where to find the queued ones, and whatever `pull-entertainment.py` has filled in (year, runtime, genre, director, synopsis, poster) |
| `assets/` | — | Everything that isn't a photograph: Mochi's 82 sprite frames, the game covers and clips in `assets/games/`, the generated `training-plan.json`, and `owner.js` |
| `notes.js` | — | Homepage "transmissions" — the one file you edit by hand to post a note |
| `latest.js` | — | Curated newest additions shown in the homepage's NOTIFICATION banner |
| `effects.js` | — | Persistent visual modes, the shared mobile room-menu behaviour (`installRoomMenu()`), and Mochi — the reduced-motion-aware resident cat with progressively loaded, decoded instant frame swaps; calibrated visible-body scale; collision-safe placements; relaxed multi-angle movement; feature entrances and stretching; element interactions; occasional walk-offs; page-aware returns; a wall-climbing mode on the Climbing room; and a helmeted zero-gravity mode used only by compatible games |
| `EASTER_EGGS.md` | — | Complete field guide to every hidden command and typed surprise |

## Projects

Standalone builds live in `projects/` and are surfaced from the room that fits them:

| Project | Linked from | What it is |
|---|---|---|
| `projects/spacetime/` | Exploration | "The Geometry of Spacetime" — interactive special-relativity explainer |
| `projects/farlight/` | Gaming | "FARLIGHT" — playable momentum and landing-feel prototype |
| `projects/starfield/` | Gaming | "Starfield" — relativistic rocket flight through the real solar neighbourhood |
| `projects/how-speed-affects-time/` | Exploration | "How Speed Affects Time" — two clocks and a real-sky special-relativity exhibit |
| `projects/how-big-everything-is/` | Exploration | "How Big Everything Is" — a 45-decade scale ladder you zoom out through, from an electron to the observable universe |
| `projects/apex/` | Apex (room data) | Not a page — the sync tooling and generated `apex-data.js` that `apex.html` reads |
| `projects/entertainment/` | Entertainment (room data) | Not a page — `pull-entertainment.py`, which fills `entertainment-data.js` with years, runtimes, genres, directors and synopses from Wikidata (no key needed), then downloads the poster art from TMDB into `assets/posters/` |
| `projects/siege-conductor/` | Workbench | Star Wars viewing-companion PWA (add-to-home-screen app) |
| `projects/offramp/` | Gaming | "OFFRAMP" — Interstate 40 as an arcade cabinet. The real corridor, all 2,551 miles Barstow→Wilmington, extracted from OpenStreetMap: true geometry and curves, 1,201 real exits at their real mile markers, real lane counts (85% of I-40 is two lanes each way), and mile posts that reset at each state line the way the real ones do. Only a 20-mile window of road is built at a time and slides as you drive, because the whole thing is 2.9M stations. Built into that window: the 350 surveyed interchanges as they were walked, 234 real rest areas and truck stops, a generated diamond for every other signed exit, a cross road bridged over each one with the ramp meeting it at a signalised junction, and the I-40/I-75 wye west of Knoxville as a two-lane left exit — signed, open, and closed for construction two thirds of the way down. The generated exits are not invented: their depth and their whole lateral profile are drawn from the 349 ramps the survey walked, so an interchange reaches a median 512 px off the freeway rather than the same 268 px every time, and the travel centres that a diamond crowds out are signed on the blue panel under its guide sign, which is where a real one is advertised. Every ramp puts you back on I-40; that rule is the whole design and it is asserted, not assumed. Crashes go through one SI impulse-momentum solver (`src/impact.js`, `test/impact.test.js`, checked against published crash figures); `test/corridor.js` sweeps every window of the route for two roads sharing tarmac. `data/osm/` holds the extractor and the raw OSM; `data/i40.js` is the generated corridor. See `projects/offramp/PLAN.md` and `projects/offramp/CRASH-MODEL.md` |
| `projects/kondrite/` | Gaming | "KONDRITE" — bright vector-space combat for 1–5 ships in three modes: cooperative Survival with optional friendly fire, a no-time-limit Battle Royale with three lives, two-hit hulls, a following camera, minimap, closing wall, stationary suns and black holes and randomized moving asteroids, and a three-mission **Campaign** — escort a convoy, raid a fleeing enemy, break a mothership — fought in sides rather than a free-for-all, with an allied fleet, squad orders, salvage, named aces, three difficulties, and veterans and fleet strength carried between missions. Local keyboard play, bots, synthesized sound, fullscreen, configurable phone controls and peer-to-peer online play. Online needs the room service in `projects/kondrite/server/` — a Cloudflare Worker. See [`projects/kondrite/README.md`](projects/kondrite/README.md) |
| `projects/autism-reflection.html` | Psyche | Long-form personal reflection on the DSM-5 autism criteria |
| `projects/state-of-mind-line/` | Psyche | Animated bipolar mood-pattern visualization |
| `projects/climbing/` | Climbing | The climbing data pipeline and the deep log: `climbs.md` → `build-data.py` → `climbs-data.js`, the full ledger at `index.html`, the photo-and-video `gallery.html`, and `add.html` for logging a day from a phone at the crag. See [`projects/climbing/readme.md`](projects/climbing/readme.md) |
| `projects/climbing/board.html` | Climbing | "Boards" — Kilter and Tension board logbook, pulled from the apps and drawn on the board itself |
| `projects/training/` | Training (room data) | Not a page — the plan exporter, the Cloudflare Worker that holds ticks, notes, runs and board ticks, and the Strava wiring. The planning app itself (`projects/training/index.html`) is **gitignored and never published**. See [`projects/training/README.md`](projects/training/README.md) |

These are self-contained and may carry their own assets/fonts — that's fine; the
"no dependencies" rule applies to the terminal's own room pages, not embedded projects.

### KONDRITE

`projects/kondrite/` is a finished, dependency-free canvas game with three modes. Co-op
**Survival** has optional friendly fire and a shared pile of lives. **Battle Royale** runs
until one ship is left, with three-life two-hit-hull elimination, a following camera,
minimap, closing wall, randomized colliding asteroids, stationary gravity hazards,
spectator following, and complete winner-screen statistics. It supports one or two
players at a keyboard, configurable phone controls, bots, and up to five peer-to-peer
online screens, with synthesized sound and fullscreen controls.

The third mode is the **Campaign**: three scripted missions — Convoy, Raid, Mothership —
played local, one or two pilots. It reuses the Battle Royale engine and adds the two
ideas the free-for-all modes don't have: a ship has a *side* (friendly fire is off, so a
shot only ever bites the other side) and a *kind* (most are fighters; a transport, a
turret and a mothership are not). You never fly alone — an allied fleet flies with you,
both sides refill downed fighters from a reserve so a fifty-ship roster stays a
thirty-ship battle, and the pilots draw respawns from one shared pile. Each mission is a
run of phases with a shifting objective, `1`/`2`/`3` order the allied wing, salvage
canisters patch your hull or load better rounds, named aces drop into the harder fights,
and a difficulty (Easy / Hard / Impossible) sets both hull strength and whether the
trigger streams or bursts. The three missions are one war: wingmates who live carry
forward by name as veterans, and a strong showing banks fleet strength and reserve lives
for the next mission. Survival and Battle Royale never build that ledger.

Online play is host-authoritative WebRTC, and joining is a list of open lobbies rather
than a code anybody copies. That list needs a room service, so online is the one part of
the site that is not just static files: `projects/kondrite/server/` holds it, deployed
as a Cloudflare Worker with a single Durable Object, and the same code runs on a laptop
with `node server/rooms.js` for local work. With no service configured the panel says so
instead of offering a list. The host page can run in the background, transient
disconnects get a recovery window, and fully disconnected seats leave the match without
changing kill or environmental death statistics.

Gameplay rules, controls, architecture, local setup, room-service configuration and the
dependency-free verification commands are maintained in
[`projects/kondrite/README.md`](projects/kondrite/README.md).

## Starfield

`projects/starfield/` is a flight game built on real physics rather than space-looking
effects. The throttle is **proper acceleration in gravities**, and the relativistic
rocket equations (β = tanh aτ/c, γ = cosh aτ/c) drive everything else. Two clocks run
side by side — ship time and home time — and the gap between them is the point of the
game. Hold one gravity and you cross the Milky Way in about twelve years of your own
life, which is the real published result, not a game balance decision.

The consequences are computed, not drawn:

- **Star colour** comes from Planck's law integrated against the CIE colour-matching
  functions, in a lookup table built at load. **Which** stars appear comes from the real
  main-sequence distribution, so 76% of them are dim red M dwarfs and a blue-white star
  is a genuine event.
- **Aberration** crushes the sky forward — at β = 0.999 half of it fits in a 2.6° cone —
  and **Doppler** shifts each star's blackbody temperature through the same table, so the
  starbow emerges from the colour maths rather than being painted on.
- **The microwave background** is a 2.72548 K blackbody that heats to T′ = 2γ·T ahead of
  you. At γ = 1,059 the forward sky is as hot as the surface of the Sun; that arrives at
  7.4 ship-years of burn and is the game's difficulty curve.
- **The interstellar medium** is the other wall, and the Local Bubble — a real 300 ly
  cavity around the Sun, twenty times thinner than the galactic average — makes the first
  stretch genuinely safer.
- **Systems** orbit by Kepler's third law and are built around the frost line, so M-dwarf
  systems come out compact the way TRAPPIST-1 really is. **Galaxies** use Sérsic profiles
  and logarithmic spiral arms, and resolve into individual stars at ~4,000 ly. **Black
  holes** lens the background stars and beam their disks by D⁴.
- The opening of every run is seeded with the **actual solar neighbourhood** from
  `data/stars-near.js` — real RA, Dec, parallax and spectral types you can check against
  a star chart.

Where it cheats — inflated object sizes, compressed time, systems dropped near the flight
path — is listed in-game under `L` (**where we cheat**), generated from the same constants
the simulation uses so the two cannot drift apart. Space is empty enough that the honest
version is unlosable: you would fly about 24 quadrillion light-years before hitting a star.

Structure is `index.html` + `starfield.css` + `data/` (hand-editable catalogues) + `src/`
(one module per concern). No build step, no dependencies, plain deferred classic scripts
so it still works opened straight off disk.

If Mochi is awake when Starfield opens, he swaps his walking behavior for a dedicated
helmeted zero-gravity set: four floating poses with three aligned animation frames
each. He drifts slowly around the viewport and tumbles away when clicked. Starfield
is currently the only game that opts into this space-specific mode. His motion is
deliberately loose: he coasts in shallow arcs, slowly rolls, and sometimes faces
backward because he has very little control in zero gravity. Some drift segments keep
the same pose while rotating through a full turn, including upside down.

Climbing gets the same treatment from the other direction. On `climbing.html` Mochi
stops walking the page and **climbs** it: he grabs the side edges of the page's own
features, works up them hand-over-hand in alternating step frames, turns, hops between
holds, plays around on them, and sometimes falls and recovers — a separate sprite set
again (`assets/cat/relay-cat-climb-*.png`). Clicking him there makes him fall rather than
bolt, and scrolling past him puts him back on the wall in the part of the page you can
now see.

## ATLAS

`atlas/` is the private crew map, and since 2026-08-21 it lives **in this repo** and is
served from `ricmassey.com/atlas/`. That is deliberate and it is not a hole in the "no
location data" rule: the only thing committed here is *code*. Every pin, coordinate,
note and photo lives in Supabase behind a real login, and row-level security is what
guards them — not the repo being private. `map.html` is the themed door that links
through to it.

The app is a MapLibre PWA on Supabase at $0: invite-only sign-in by real email, pins that
carry who dropped them and when, everybody's notes on one person's pin, child pins for
parking, a layers panel, per-person settings that sync last-change-wins, and offline
tiles. It has its own test suite (`atlas/test/*.test.mjs`) and its own long README —
[`atlas/README.md`](atlas/README.md) — which is the authority on schema, RLS and setup.

## Gaming

`gaming.html` is a storefront, so it lives or dies on real art. Each game has a cover in
`assets/games/<game>.jpg` and a looping clip in `assets/games/<game>.webm`: the featured
game autoplays its clip muted, the others play on hover, both fall back to the poster,
and neither autoplays under `prefers-reduced-motion`. The covers are **real in-game
screenshots of actual gameplay**, not mockups, gradients or menu grabs, and each poster
is a frame lifted from its own clip so hovering doesn't jump. `AGENTS.md` has the capture
recipe — it is fiddlier than it sounds, because a canvas game will not respond to
synthesized key events and has to be driven over the Chrome DevTools Protocol.

## Navigation

There is **no shared nav bar**. Every room has its own menu, styled to match that
room's theme (MP tabs on climbing, a Strava underline bar on training, a synaptic
pill switcher in Orrin, case-file tabs in Psyche, a film strip on captures, and so on). They all link to the
**same set of rooms with the same labels** — only the styling differs. If you add or
rename a room, update the menu on **every** page (see `AGENTS.md`).

That set is `terminal · orrin · psyche · climbing · training · exploration · gaming · workbench · captures`
— the eight rooms the home directory lists, plus `terminal` for the way home, so the
site says one thing about what it contains. The unlisted rooms (`apex`, `log`, `map`)
are still reachable by URL and from the terminal's `ls` / `tree` / `find` / `open`.

One label is currently out of step: the front door and `ls` call the Psyche room
**`/mind`**, while every room nav still says **`psyche`**. Typing either works
(`PAGE_ALIASES` in `index.html` maps `psyche` → `mind`), but the two names are visible
in different places, which is exactly the drift the shared label set exists to prevent.
Pick one and make the other follow.

On a phone the menu collapses behind a single button with full-size tap targets. The
behaviour is shared (`installRoomMenu()` in `effects.js`, so there aren't nine copies of
it); the button's appearance is styled per room, like everything else in the nav.

When served on the web, Terminal home links normalize to the clean site root instead of
leaving `/index.html` in the address. Their `index.html` markup remains as a fallback so
the pages still work when opened directly from disk.

## Terminal

Type `help` for the current command list. Useful shortcuts include `/clear`, `tree`,
`projects`, `find <word>`, `open <target>`, `latest`, `random`, `uptime`, and `reboot`.
Commands accept a leading slash, project shortcuts are searchable, and `↑`/`↓` plus
`Tab` provide history and completion.

Two arrays near the top of `index.html`'s script drive all of it: **`ROOMS`** (the
directory, `ls`, `tree`, `find`, `random`, completion) and **`PROJECTS`** (the `projects`
list, `open <shortcut>`, `find`, and the project branches under `tree`). A project that
isn't in `PROJECTS` is invisible to every one of those commands even though its room
links to it — so adding a project means adding it here too, not just linking it.

`EASTER_EGGS.md` documents the commands that are deliberately left out of `help`.

## Updating content

Each page keeps its editable content in a loudly-commented block near the top of the
file — copy the example block, edit, done.

- **Post a homepage note:** edit `notes.js`.
- **Add or rename a room:** edit the `ROOMS` array in `index.html` — it is the one list
  the directory, `ls`, `tree`, `find` and Tab completion all render from — then update
  the `<nav>` on every room page.
- **Add a project:** put it in `projects/<name>/`, link it from the one room it belongs
  to, give it `projects/relay-return.js` so there's a way back, and add it to the
  `PROJECTS` array in `index.html` so the terminal can find it.
- **Add a climb:** don't hand-edit the climbing pages. Edit `projects/climbing/climbs.md`
  and run `python3 projects/climbing/build-data.py`. See
  [`projects/climbing/readme.md`](projects/climbing/readme.md).
- **Add a film or move one to watched:** you don't have to edit anything. Sign in at the
  foot of `entertainment.html` and use the form and the buttons on the cards. Editing
  `entertainment-data.js` by hand still works and is what a bulk change should do.
- **Change the clickable newest-item banner:** edit `latest.js`. Only the homepage
  shows it now — the rooms no longer carry one — so a new addition is announced once.
  Still give each entry a `room`: it is what a room banner would use to pick its own
  flavoured wording ("new route") if one is ever added back.
- **`orrin.html` explains the architecture in plain language** and pulls public code
  activity from the GitHub API. It does not expose Orrin's private runtime state.
- **Never** commit real location data anywhere in this repo — coordinates, addresses,
  GPS traces, or the EXIF still sitting inside a phone photo. `atlas/` being here is not
  an exception: it is code, and the places live in Supabase.

### Wiring up the rooms that talk to something outside

These notes used to be printed on the live pages, where family could read them. They
belong here.

- **Apex** (`apex.html`) is live. It reads a free API key from apexlegendsapi.com stored
  in the macOS Keychain under `apex-als`, plus a gamertag in
  `projects/apex/apex-account.json` (gitignored, and where the resolved UID is cached so
  later runs skip the name lookup). `pull-apex.py` takes one snapshot per run;
  `projects/apex/apex-sync.plist` runs it daily and commits `apex-data.js` when that is
  the only thing that changed. It never pushes. Install it with:

      cp projects/apex/apex-sync.plist ~/Library/LaunchAgents/com.ricmassey.apex-sync.plist
      launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.ricmassey.apex-sync.plist

  Career kills are account-wide and no API returns them — they're typed into the `career`
  block by hand, marked `approx` so the page renders them with a `~`, and `pull-apex.py`
  preserves them on every run. Nothing else in that file should be edited by hand.
- **Training** (`training.html`) is live: the plan is generated, ticks and notes are
  stored in a Cloudflare Worker, and runs push themselves in from Strava the moment a
  watch syncs — the run session planned for that date ticks itself off. The route is
  published and drawn on a real map, held back from visitors for five minutes;
  everything else about "where" is refused at the Worker. Full rules in
  [`projects/training/README.md`](projects/training/README.md). The planning app that
  generates the plan is **not** on Pages — it holds a weekly timetable of when the house
  is empty, so it stays gitignored and only its allowlisted export ships.
  The page still bills itself as "runs, workouts and health telemetry" in its meta
  description and there is no health data anywhere — either find a source for it or stop
  claiming it.
- **The boards** (`projects/climbing/board.html`, "Boards", once "the woodshed") are pulled, not
  written. `pull-boards.py` reads the Kilter and Tension apps and writes `board-data.js`;
  usernames live in `board-accounts.json` (gitignored) and passwords in the macOS
  Keychain, never in this repo. `board-sync.plist` polls hourly and `board-tick.mjs`
  posts the dates to the Worker so a board night ticks its climbing session. Board grades
  stay on their own scale and never merge into the outdoor ledger.
- **Entertainment** (`entertainment.html`) is live and works with nothing deployed.
  `entertainment-data.js` is the committed list and renders on its own; edits made on the
  page are layered on top of it at read time, from whichever of two places answers:

  1. the Worker's `/movies`, if it is deployed. Then an edit is real — it follows Ric
     between phone and laptop, and visitors see it.
  2. this browser's `localStorage`, if it is not. The edit shows up immediately, is
     marked **not committed** on the card, and stays in that browser.

  `/movies` is **deployed** (2026-09-22), so route 1 is the live one: add a title on the
  page and it is real immediately — it follows Ric between phone and laptop and visitors
  see it. No export, no commit, no push.

  Route 2 is the fallback for when there is no signal. The page marks those edits **not
  committed** on their own card, and the owner panel's **Export** button prints a
  replacement `entertainment-data.js` with them folded in; paste it over the file and
  commit to fold them into the committed list for good.

  One thing a new title does NOT get on its own is its artwork and facts — those come
  from `projects/entertainment/pull-entertainment.py`, which has to be run. Until then a
  newly added film shows as a typographic plate with just its name, which is a designed
  state rather than a broken one.

  **The facts and the art are pulled in two stages**, by
  `projects/entertainment/pull-entertainment.py`, and only the second one needs anything
  from you.

  ```
  python3 projects/entertainment/pull-entertainment.py --facts   # no key needed
  ```

  Stage 1 asks Wikipedia for the article and Wikidata for the answers: year, runtime,
  director, genre, IMDb id — and the TMDB id, which is the part that matters. Wikidata
  is CC0, so there is nothing to sign up for and nothing to be careful about.

  ```
  # free key, 2 minutes, no card: https://www.themoviedb.org/settings/api
  security add-generic-password -s tmdb -a ricmassey -U -w
  python3 projects/entertainment/pull-entertainment.py --art
  ```

  Stage 2 fetches the posters. Because stage 1 already found the exact TMDB id, it never
  searches by title — so it cannot put the wrong film's poster on a row. Images are
  **downloaded into `assets/posters/`**, not hotlinked: the live room makes no external
  request and works opened straight off disk, which is what hard rule 4 actually asks
  for.

  **Adding a title asks you which film you mean.** Type the name in the owner panel and
  the page searches Wikipedia, shows you the candidates with their posters, years and
  first lines, and lets you pick — or keep the name exactly as you typed it. Picking
  fills in the id, so the poster that arrives later is the right film's. Anything already
  on the list can be corrected the same way: open it and use **Not the right film?**.
  That is the fix for the handful the script had to guess at — *The Italian Job* resolved
  to the 1969 one, for instance.

  **Check the matches with `--audit`.** It asks TMDB for a second opinion on every
  title and prints the ones worth a look — a film whose real name is not what you wrote,
  or a much better-known film of the same name (which is how remakes sneak in). Add
  `--fix` to take its suggestions:

  ```
  python3 projects/entertainment/pull-entertainment.py --audit
  python3 projects/entertainment/pull-entertainment.py --audit --fix
  python3 projects/entertainment/pull-entertainment.py --art --where
  ```

  Anything you have confirmed yourself on the page is never questioned by it.

  Both stages skip what is already filled in and write as they go, so a re-run is cheap
  and stopping one halfway costs nothing. A title it cannot settle is **left alone and
  reported** rather than guessed at — put the right `wd: "Q42047"` on the row and re-run;
  a hand-set id is never overwritten. Until stage 2 has run, tiles fall back to a
  typographic plate; that is a designed state, not a broken one.

  Titles are Ric's list, lightly corrected for spelling and casing. A few were left
  exactly as typed because correcting them would have been a guess — `Curtis`,
  `Moments`, `The Sound`, `Greater good`, `RIP`, `Code 3`, `Mercy` and `Obsession` are
  all ambiguous enough that the wrong film could end up on the page. Fix them when he
  says which ones they are.
- **ATLAS** (`atlas/`) talks to Supabase. The publishable key in `atlas/config.js` is
  public by design; the **service_role** key must never be in this repo — it bypasses
  every row-level-security policy.

## Checking your work

There is no build. There is a test runner: `node .github/checks.mjs` runs every quick
suite in the repo in a couple of seconds, `--slow` adds the two games' simulations, and
`.github/workflows/checks.yml` runs it on every push. So: run that, serve the folder,
and open the pages you touched.

```bash
node .github/checks.mjs
python3 -m http.server 8912
```

Or one suite at a time:

```bash
node projects/kondrite/test/smoke.js
node projects/kondrite/test/campaign.js
node projects/training/server/test.mjs
node projects/climbing/test/parse-parity.js
for t in projects/offramp/test/*.test.js; do node "$t" || break; done
for t in atlas/test/*.test.mjs; do node "$t" || break; done
```

Served locally, the pages that talk to the Cloudflare Worker (`/climb`, `/media`, `/log`,
`/strava`) will 404 against a plain static server. That is expected — each caller treats
a failed fetch as "no extra data" and renders the committed history instead.

## Easter eggs

The Terminal has hidden commands, typed project codes, and a few strange visual
interactions. The complete, intentionally spoiler-filled registry lives in
[`EASTER_EGGS.md`](EASTER_EGGS.md).

For the biggest ones, type `lsd` or `shrooms` into the homepage terminal. The chosen
visual mode persists as you move through rooms and projects. Refresh any page or return
to the Terminal and type `sober` to turn it off. Motion is automatically disabled when the
visitor has requested reduced motion.
