# Terminal

Ric Massey's personal website — a terminal for family and friends to
follow what he's up to (Orrin, climbing, training, photos, write-ups) without having
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
| `psyche.html` | Psyche | Human-systems field notebook — mood, criteria, substances, and evidence |
| `climbing.html` | Climbing | Mountain-Project-style route ledger — projects, ticks, objectives |
| `training.html` | Training | Strava-style feed — runs, workouts, health (live feed still TODO) · *unlisted on the home directory* |
| `apex.html` | Apex | Apex Legends lobby — rank ladder, career kills, and every legend carrying a tracker (data pulled by `projects/apex/pull-apex.py`) · *unlisted on the home directory* |
| `exploration.html` | Exploration | Space deck — experiments dock here |
| `workbench.html` | Workbench | Blueprint board of random / half-finished projects |
| `captures.html` | Captures | Darkroom contact sheet for photos |
| `log.html` | Log | Long-form write-ups, trip reports, Apex VOD reviews · *unlisted on the home directory* |
| `updates.html` | — | Legacy redirect to the homepage's latest-signal banner |
| `systems.html` | — | Legacy redirect from the former Orrin URL to `orrin.html` |
| `map.html` | Map | Locked placeholder — the real private map app lives elsewhere, with real auth · *unlisted everywhere; reachable by typing `map`* |
| `404.html` | — | On-brand "signal lost" page for mistyped URLs |
| `playground/` | — | Scratch space for experiments and working design docs |
| `projects/` | — | Self-contained sub-projects, each linked from a room (see below) |
| `photos/` | — | Web-optimized images (originals stay out of git in `_photo-originals/`) |
| `notes.js` | — | Homepage "transmissions" — the one file you edit by hand to post a note |
| `latest.js` | — | Curated newest additions shown in each room's native latest-signal banner |
| `effects.js` | — | Persistent visual modes and Mochi, the reduced-motion-aware resident cat with progressively loaded, decoded instant frame swaps; calibrated visible-body scale; collision-safe placements; relaxed multi-angle movement; feature entrances and stretching; element interactions; occasional walk-offs; page-aware returns; and a helmeted zero-gravity mode used only by compatible games |
| `EASTER_EGGS.md` | — | Complete field guide to every hidden command and typed surprise |

## Projects

Standalone builds live in `projects/` and are surfaced from the room that fits them:

| Project | Linked from | What it is |
|---|---|---|
| `projects/spacetime/` | Exploration | "The Geometry of Spacetime" — interactive special-relativity explainer |
| `projects/farlight/` | Workbench | "FARLIGHT" — playable momentum and landing-feel prototype |
| `projects/starfield/` | Exploration | "Starfield" — relativistic rocket flight through the real solar neighbourhood |
| `projects/how-speed-affects-time/` | Exploration | "How Speed Affects Time" — two clocks and a real-sky special-relativity exhibit |
| `projects/how-big-everything-is/` | Exploration | "How Big Everything Is" — a 45-decade scale ladder you zoom out through, from an electron to the observable universe |
| `projects/apex/` | Apex (room data) | Not a page — the sync tooling and generated `apex-data.js` that `apex.html` reads |
| `projects/the-shape-of-harm/` | Psyche | Evidence-informed interactive research framework for comparing psychoactive-substance harms |
| `projects/siege-conductor/` | Workbench | Star Wars viewing-companion PWA (add-to-home-screen app) |
| `projects/offramp/` | Workbench | "OFFRAMP" — Interstate 40 as an arcade cabinet. The real corridor, all 2,551 miles Barstow→Wilmington, extracted from OpenStreetMap: true geometry and curves, 1,201 real exits at their real mile markers, real lane counts (85% of I-40 is two lanes each way), and mile posts that reset at each state line the way the real ones do. Only a 20-mile window of road is built at a time and slides as you drive, because the whole thing is 2.9M stations. Built into that window: the 350 surveyed interchanges as they were walked, 234 real rest areas and truck stops, a generated diamond for every other signed exit, a cross road bridged over each one with the ramp meeting it at a signalised junction, and the I-40/I-75 wye west of Knoxville as a two-lane left exit — signed, open, and closed for construction two thirds of the way down. The generated exits are not invented: their depth and their whole lateral profile are drawn from the 349 ramps the survey walked, so an interchange reaches a median 512 px off the freeway rather than the same 268 px every time, and the travel centres that a diamond crowds out are signed on the blue panel under its guide sign, which is where a real one is advertised. Every ramp puts you back on I-40; that rule is the whole design and it is asserted, not assumed. Crashes go through one SI impulse-momentum solver (`src/impact.js`, `test/impact.test.js`, checked against published crash figures); `test/corridor.js` sweeps every window of the route for two roads sharing tarmac. `data/osm/` holds the extractor and the raw OSM; `data/i40.js` is the generated corridor. See `projects/offramp/PLAN.md` and `projects/offramp/CRASH-MODEL.md` |
| `projects/crossfire/` | Workbench | "CROSSFIRE" — bright vector-space combat for 1–5 ships: cooperative Survival with optional friendly fire, and a no-time-limit Battle Royale with three lives, two-hit hulls, a following camera, minimap, closing wall, stationary suns and black holes, and randomized moving asteroids. Local keyboard play, bots, synthesized sound, fullscreen, configurable phone controls and peer-to-peer online play. Online needs the room service in `projects/crossfire/server/` — a Cloudflare Worker. See [`projects/crossfire/README.md`](projects/crossfire/README.md) |
| `projects/autism-reflection.html` | Psyche | Long-form personal reflection on the DSM-5 autism criteria |
| `projects/state-of-mind-line/` | Psyche | Animated bipolar mood-pattern visualization |
| `projects/climbing/board.html` | Climbing (unlisted) | "The Woodshed" — Kilter and Tension board logbook, pulled from the apps and drawn on the board itself |

These are self-contained and may carry their own assets/fonts — that's fine; the
"no dependencies" rule applies to the terminal's own room pages, not embedded projects.

### CROSSFIRE

`projects/crossfire/` is a finished, dependency-free canvas game with co-op Survival,
optional friendly fire, and a Battle Royale that runs until one ship is left. It
supports one or two players at a keyboard, configurable phone controls, bots, and up to
five peer-to-peer online screens, with synthesized sound and fullscreen controls. Battle
Royale adds three-life, two-hit-hull elimination, a following camera, minimap,
closing wall, randomized colliding asteroids, stationary gravity hazards, spectator
following, and complete winner-screen statistics.

Online play is host-authoritative WebRTC, and joining is a list of open lobbies rather
than a code anybody copies. That list needs a room service, so online is the one part of
the site that is not just static files: `projects/crossfire/server/` holds it, deployed
as a Cloudflare Worker with a single Durable Object, and the same code runs on a laptop
with `node server/rooms.js` for local work. With no service configured the panel says so
instead of offering a list. The host page can run in the background, transient
disconnects get a recovery window, and fully disconnected seats leave the match without
changing kill or environmental death statistics.

Gameplay rules, controls, architecture, local setup, room-service configuration and the
dependency-free verification command are maintained in
[`projects/crossfire/README.md`](projects/crossfire/README.md).

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

## Navigation

There is **no shared nav bar**. Every room has its own menu, styled to match that
room's theme (MP tabs on climbing, a Strava underline bar on training, a synaptic
pill switcher in Orrin, case-file tabs in Psyche, a film strip on captures, and so on). They all link to the
**same set of rooms with the same labels** — only the styling differs. If you add or
rename a room, update the menu on **every** page (see `AGENTS.md`).

That set is `terminal · orrin · psyche · climbing · exploration · workbench · captures`
— the same six rooms the home directory lists, so the site says one thing about what it
contains. The unlisted rooms (`training`, `apex`, `log`, `map`) are still reachable by
URL and from the terminal's `ls` / `tree` / `find` / `open`.

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

## Updating content

Each page keeps its editable content in a loudly-commented block near the top of the
file — copy the example block, edit, done.

- **Post a homepage note:** edit `notes.js`.
- **Add or rename a room:** edit the `ROOMS` array in `index.html` — it is the one list
  the directory, `ls`, `tree`, `find` and Tab completion all render from — then update
  the `<nav>` on every room page.
- **Change the clickable newest-item banners:** edit `latest.js` once; every room
  presents the same curated addition in its own visual language. Give each entry a
  `room`, so a room only uses its own flavoured wording ("new route") when the newest
  item actually belongs to it.
- **`orrin.html` explains the architecture in plain language** and pulls public code
  activity from the GitHub API. It does not expose Orrin's private runtime state.
- **Never** commit real location data anywhere in this repo (see the map page).

### Wiring up the two rooms that aren't connected yet

These notes used to be printed on the live pages, where family could read them. They
belong here.

- **Apex** (`apex.html`) shows hand-read seed numbers until the daily pull is connected.
  It needs a free API key from apexlegendsapi.com stored in the macOS Keychain under
  `apex-als`, plus a gamertag in `projects/apex/apex-account.json` (gitignored). Rank and
  RP arrive with the key; the ladder can also be lit up early by typing a `rank` block
  into `projects/apex/apex-data.js`. Career kills are account-wide and no API returns
  them — they're typed into the `career` block by hand and `pull-apex.py` preserves them.
- **Training** (`training.html`) has no live feed. Two ways to wire it up: the quick
  Strava embed widget, or a small serverless function hitting the Strava API (Garmin
  syncs into Strava automatically). The two activity cards on the page are marked
  `example` and exist only to show the format — replace them, don't leave them.

## Easter eggs

The Terminal has hidden commands, typed project codes, and a few strange visual
interactions. The complete, intentionally spoiler-filled registry lives in
[`EASTER_EGGS.md`](EASTER_EGGS.md).

For the biggest ones, type `lsd` or `shrooms` into the homepage terminal. The chosen
visual mode persists as you move through rooms and projects. Refresh any page or return
to the Terminal and type `sober` to turn it off. Motion is automatically disabled when the
visitor has requested reduced motion.
