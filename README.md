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
| `training.html` | Training | Strava-style feed — runs, workouts, health (live feed still TODO) |
| `exploration.html` | Exploration | Space deck — experiments and the game dock here |
| `workbench.html` | Workbench | Blueprint board of random / half-finished projects |
| `captures.html` | Captures | Darkroom contact sheet for photos |
| `log.html` | Log | Long-form write-ups, trip reports, Apex VOD reviews |
| `updates.html` | — | Legacy redirect to the homepage's latest-signal banner |
| `systems.html` | — | Legacy redirect from the former Orrin URL to `orrin.html` |
| `map.html` | Map | Locked placeholder — the real private map app lives elsewhere, with real auth |
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
| `projects/farlight/` | Exploration | "FARLIGHT" — playable momentum and landing-feel prototype |
| `projects/starfield/` | Exploration | "Starfield" — relativistic rocket flight through the real solar neighbourhood |
| `projects/the-shape-of-harm/` | Psyche | Evidence-informed interactive research framework for comparing psychoactive-substance harms |
| `projects/siege-conductor/` | Workbench | Star Wars viewing-companion PWA (add-to-home-screen app) |
| `projects/autism-reflection.html` | Psyche | Long-form personal reflection on the DSM-5 autism criteria |
| `projects/state-of-mind-line/` | Psyche | Animated bipolar mood-pattern visualization |

These are self-contained and may carry their own assets/fonts — that's fine; the
"no dependencies" rule applies to the terminal's own room pages, not embedded projects.

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
- **Change the clickable newest-item banners:** edit `latest.js` once; every room
  presents the same curated addition in its own visual language.
- **`orrin.html` explains the architecture in plain language** and pulls public code
  activity from the GitHub API. It does not expose Orrin's private runtime state.
- **Never** commit real location data anywhere in this repo (see the map page).

## Easter eggs

The Terminal has hidden commands, typed project codes, and a few strange visual
interactions. The complete, intentionally spoiler-filled registry lives in
[`EASTER_EGGS.md`](EASTER_EGGS.md).

For the biggest ones, type `lsd` or `shrooms` into the homepage terminal. The chosen
visual mode persists as you move through rooms and projects. Refresh any page or return
to the Terminal and type `sober` to turn it off. Motion is automatically disabled when the
visitor has requested reduced motion.
