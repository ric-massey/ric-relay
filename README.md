# ric-relay

Ric Massey's personal website — a terminal-styled "relay" for family and friends to
follow what he's up to (Orrin, climbing, training, photos, write-ups) without having
to ask.

**Live:** https://ric-massey.github.io/ric-relay/
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
| `index.html` | The Relay | Landing terminal — boot sequence + working command line (try `help`) |
| `systems.html` | Orrin | "Inside Orrin's mind" — live GitHub telemetry recast as neural activity |
| `climbing.html` | Climbing | Mountain-Project-style route ledger — projects, ticks, objectives |
| `training.html` | Training | Strava-style feed — runs, workouts, health (live feed still TODO) |
| `exploration.html` | Exploration | Space deck — experiments and the game dock here |
| `workbench.html` | Workbench | Blueprint board of random / half-finished projects |
| `captures.html` | Captures | Darkroom contact sheet for photos |
| `log.html` | Log | Long-form write-ups, trip reports, Apex VOD reviews |
| `updates.html` | Updates | Self-writing change feed (pulls this repo's commits) |
| `map.html` | Map | Locked placeholder — the real private map app lives elsewhere, with real auth |
| `404.html` | — | On-brand "signal lost" page for mistyped URLs |
| `playground/` | — | Standalone HTML experiments (e.g. `starfield.html`) |
| `projects/` | — | Self-contained sub-projects, each linked from a room (see below) |
| `photos/` | — | Web-optimized images (originals stay out of git in `_photo-originals/`) |
| `notes.js` | — | Homepage "transmissions" — the one file you edit by hand to post a note |

## Projects

Standalone builds live in `projects/` and are surfaced from the room that fits them:

| Project | Linked from | What it is |
|---|---|---|
| `projects/spacetime/` | Exploration | "The Geometry of Spacetime" — interactive special-relativity explainer |
| `projects/the-shape-of-harm/` | Exploration | Evidence-informed interactive research framework for comparing psychoactive-substance harms |
| `projects/siege-conductor/` | Workbench | Star Wars viewing-companion PWA (add-to-home-screen app) |
| `projects/autism-reflection.html` | Log | Long-form personal reflection on the DSM-5 autism criteria |
| `projects/state-of-mind-line/` | Log | Animated bipolar mood-pattern visualization |

These are self-contained and may carry their own assets/fonts — that's fine; the
"no dependencies" rule applies to the relay's own room pages, not embedded projects.

## Navigation

There is **no shared nav bar**. Every room has its own menu, styled to match that
room's theme (MP tabs on climbing, a Strava underline bar on training, a synaptic
pill switcher on systems, a film strip on captures, and so on). They all link to the
**same set of rooms with the same labels** — only the styling differs. If you add or
rename a room, update the menu on **every** page (see `AGENTS.md`).

## Updating content

Each page keeps its editable content in a loudly-commented block near the top of the
file — copy the example block, edit, done.

- **Post a homepage note:** edit `notes.js`.
- **`systems.html` and `updates.html` never need editing** — they pull live data from
  the GitHub API.
- **Never** commit real location data anywhere in this repo (see the map page).
