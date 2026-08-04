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
| `projects/crossfire/` | Workbench | "CROSSFIRE" — Asteroids with walls, 1–5 players, in three modes: co-op survival with friendly fire, co-op survival without it, and a 3-minute battle royale on a 4000×2800 map with a following camera, minimap, gravity wells and a closing wall. Players are named for their ship colour; the `PLAYERS` table is the single source for names, colours and key maps. Empty seats can be filled with bots. Keyboard, mouse (ship follows the pointer) or on-screen thumb controls. One camera today — split screen is a second call to the same render path (see the `cam` comment). See the online-play note below |
| `projects/autism-reflection.html` | Psyche | Long-form personal reflection on the DSM-5 autism criteria |
| `projects/state-of-mind-line/` | Psyche | Animated bipolar mood-pattern visualization |
| `projects/climbing/board.html` | Climbing (unlisted) | "The Woodshed" — Kilter and Tension board logbook, pulled from the apps and drawn on the board itself |

These are self-contained and may carry their own assets/fonts — that's fine; the
"no dependencies" rule applies to the terminal's own room pages, not embedded projects.

### CROSSFIRE online play — the one external request on the site

Online play is **peer-to-peer WebRTC with no server**, because GitHub Pages can't host
one. Players connect directly: the host generates an invite code (~220 characters),
sends it to a friend by any means, and pastes their reply back. One exchange per guest.
`projects/crossfire/net.js` handles this and knows nothing about the game.

The one caveat worth knowing: `net.js` lists a **public STUN server**. It isn't a script
and nothing is downloaded from it — the browser asks it what your address looks like from
outside, so two peers behind home routers can find each other. Without it, online play
only works between machines on the same wifi. **It is contacted only when someone opens
the multiplayer panel**; loading the page or playing locally makes no external request at
all. Point `ICE_SERVERS` at your own coturn, or set it to `[]` for same-wifi-only play.

Two other things about the netcode: it is **host-authoritative**, so the host has a small
latency advantage when shooting (fixing that means rewinding the world to the shooter's
view — a much bigger job). And because browsers freeze `requestAnimationFrame` in
background tabs, **the host has to keep the game window in front** or the match stalls for
everyone.

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
