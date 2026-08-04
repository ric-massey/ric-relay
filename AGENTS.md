# Notes for AI assistants working on Terminal

This file is for any LLM/agent asked to change this site. Read it before you touch
anything. `README.md` covers what the site is; this file covers **how to work on it
without breaking the concept or Ric's rules.**

## What this project is

Ric Massey's personal website for friends and family. The concept: **"it's literally
my own internet."** The home page (`index.html`) is a terminal hub; every other page is
a **room** dressed up to look like the real app for that world (climbing → Mountain
Project, training → Strava, Orrin → a brain, etc.). Plain HTML/CSS/JS, **no build
step and no dependencies** — each page is a single self-contained `.html` file with its
CSS in a `<style>` tag and its JS in a `<script>` tag. Keep it that way unless Ric
explicitly asks to add tooling.

Deploy = `git push` to `main` → GitHub Pages. So **a push is a publish.** Don't push
unless Ric asks.

## Hard rules — do not break these

1. **No location data, ever.** The private map (`map.html`) is a locked placeholder on
   purpose. Real coordinates/places live in a separate, authenticated app — never in
   this public repo. Don't add a real map, addresses, or GPS data here.
   **This includes photo EXIF.** A phone photo carries the exact coordinates it was
   taken at, and six committed `climbing-*.jpg` were publishing crag and home-area
   positions to anyone who downloaded them (found and stripped 2026-07-31). **Strip
   metadata from every photo before committing it** and check with:
   ```
   python3 -c "from PIL import Image;import glob;print([f for f in glob.glob('photos/*.jpg') if (lambda g: g and 2 in g)(Image.open(f).getexif().get_ifd(0x8825))])"
   ```
   `sips -Z 1600` does **not** remove GPS. The strip must drop the APP1/APP2/APP13
   segments (lossless — no re-encode).
2. **Only one coding project is featured: Orrin.** Ric does not want his other GitHub
   repos listed or auto-pulled. `orrin.html` hits the GitHub API for
   `ric-massey/orrin_v3` only — don't broaden that.
3. **Every room is its own themed world.** Don't flatten the site into one shared
   template, shared stylesheet, or one generic nav bar. The visual variety is the point.
4. **Keep it dependency-free.** No frameworks, bundlers, CDNs, or external fonts/scripts
   unless asked. Everything must work as static files opened directly.

## The menu system (read this before editing any nav)

There is intentionally **no shared nav component**. Each page has its own `<nav>` whose
*styling* is native to that room, but they all expose the **same rooms with the same
labels** so navigation stays predictable:

```
terminal · orrin · psyche · climbing · exploration · workbench · captures
```

**This set matches the home page's `#dir` listing on purpose.** The room navs used to
carry all nine rooms while the front door showed six, so the site said two different
things about what it contains — a visitor landed on the terminal, saw six places, clicked
into `/climbing` and was offered nine. `training`, `apex` and `log` are out of the nav for
the same reason they're out of `#dir`. Those three pages still *carry* the nav (with no
`.here` marked, since they aren't in it) rather than dropping it like `map.html` does —
losing the way out of a room is worse than an unhighlighted bar.

**The mobile menu is shared behaviour, not shared styling.** `installRoomMenu()` in
`effects.js` finds `nav[aria-label="Terminal rooms"]`, injects a `.roomnav-toggle` button
before it, and toggles `.roomnav-open` on the nav. Each page styles `.roomnav-toggle`,
`nav[data-roomnav]` and `nav[data-roomnav].roomnav-open` in its own `<style>` — that's
where the room's look lives. Tap targets in the open menu must be at least 44px tall.
With JS off nothing is injected and the nav renders exactly as it always did.

- `href` targets and link text are **identical on every page** — only the CSS differs.
- Keep Terminal home links as `index.html` in room markup for direct-file compatibility.
  `effects.js` normalizes those links to the clean directory root when served over HTTP;
  `projects/relay-return.js` does the same for project return controls. Do not hardcode
  a deployment subdirectory or domain.
- The current room is rendered as a `<span class="here" aria-current="page">` (not a
  link), positioned in the same spot in the list as its `<a>` on other pages.
- Each `<nav>` carries `aria-label="Terminal rooms"`.
- `map.html` is deliberately left out of the room menus entirely.

**`training`, `apex`, `log` and `map` are deliberately unlisted** — in `#dir` *and* in
the room navs. They are the thin rooms and Ric does not want the front door advertising
work that isn't done. They are *not* removed: `ls`, `tree`, `find`, `open <room>`, typing
the room name and the plain URL all still reach them, and Tab completion offers
`training`, `apex` and `log` (`map` is left out of completions only, since it answers
`[LOCKED]` — completing to a dead end is just untidy). Don't "fix" this by putting them
back. If one gets built out properly, that's the moment to re-list it.

**There is one room list, in `index.html`.** The `ROOMS` array near the top of its script
is the single source for the `#dir` markup (rendered from it), `PAGES`, `ls`, `tree`,
`find`, `random` and Tab completion — these used to be five hand-maintained copies that
drifted (two typos lived in the page twice each). Add, rename or unlist a room by editing
`ROOMS` and nothing else in that file: `listed: true` puts it on the front door,
`locked: true` marks it `[LOCKED]` and keeps it out of `random` and completions.

Per-room nav treatments (class on the `<nav>`):

| Page | nav style | class |
|---|---|---|
| orrin | synaptic pill switcher | `nav.cortex` |
| psyche | psychological case-file tabs | `nav.case-tabs` |
| climbing | Mountain-Project tab bar (white active pill) | `.topbar .roomnav` |
| training | Strava underline tabs | `.topbar .roomnav` |
| apex | Apex lobby tab strip (scrolls sideways, red underline on the current room) | `nav.lobbytabs` |
| exploration | star-chart waypoints | `nav.starchart` |
| workbench | blueprint sheet-index chips | `nav.sheets` |
| captures | darkroom film strip | `nav.filmstrip` |
| log | newspaper section bar | `nav.sections` |
| index | terminal directory listing + `ls`/`open` commands | `#dir` |

**If you add, remove, or rename a room:** edit `ROOMS` in `index.html` (that covers the
directory, `ls`, `tree`, `find` and completion in one place), then update the `<nav>` on
**every** room page, the table in `README.md`, and this file. Keep the label set in sync
everywhere — the navs must agree with each other *and* with the front door.

## Projects and photos

- **Sub-projects** live in `projects/<name>/` (or a single `.html`) and are **linked
  from the room that fits them** — not given their own room. Current: `spacetime`,
  `starfield`, `how-speed-affects-time` and `how-big-everything-is` → Exploration;
  `the-shape-of-harm`,
  `autism-reflection.html`, and `state-of-mind-line` → Psyche; `siege-conductor`,
  `farlight` and `crossfire` → Workbench; `climbing` → Climbing
  (including the unlisted `climbing/board.html`). Each is
  self-contained and may carry its own assets/fonts; the "no dependencies" rule is for
  the terminal's own room pages, not embedded projects. Keep their internal links relative.
- **Every standalone project HTML page needs a visible route back to the terminal.** Use
  `projects/relay-return.js` with the correct relative `src` and `data-home` paths so the
  fixed “← Ric's Terminal” control works from desktop and mobile. The optional `data-egg`
  value may add a project-themed typed easter egg.
- **Photos** go in `photos/`, web-optimized (resize to ~1600px, convert HEIC→JPG). Do
  **not** commit full-res originals — they belong in `_photo-originals/`, which is
  gitignored. `captures.html` reads a `FRAMES` array; `climbing.html` rotates a few as
  a hero banner. If you add photos, optimize first (`sips -Z 1600 -s format jpeg …`).

## Editing content

Each page has a loudly-commented editable block near its content. To add a
photo, an activity, a project, a log entry — copy the example block in that page and
edit it.

**Climbing is the exception: it is data-driven, not hand-edited.** `climbing.html`,
`projects/climbing/index.html` and `projects/climbing/gallery.html` all read
generated files. To add a climb, edit `projects/climbing/climbs.md` and run
`python3 projects/climbing/build-data.py`. See `projects/climbing/readme.md`.
That script also writes `projects/climbing/latest-climb.js`, which every room loads
so the newest day out leads the "latest" banner without anyone editing a list.

**The board log is pulled, not written.** `projects/climbing/board.html` — the
woodshed — reads `board-data.js`, which `pull-boards.py` generates from the Kilter
and Tension apps. Rules for it:

- Credentials are never in this repo. Usernames live in `board-accounts.json`
  (gitignored); passwords live in the macOS Keychain. Never ask Ric to paste a
  password into a chat, a file, or a command, and never write one anywhere.
- `board-data.js` and `board-catalogue-*.js` are committed; `.board-venv/` and
  `.board-cache/` are not. The catalogues are megabytes and rebuild only on
  `--catalogue`, deliberately — don't wire them into the weekly sync.
- It is **deliberately hidden**: no room menu entry, no `.jump` link. The way in
  is the "the woodshed" button under the Climbing footer, or typing `board` on
  `climbing.html`. Don't "fix" this by promoting it into the nav.
- Board sessions stay out of the sitewide "latest" banner for the same reason.
- Board grades are their own scale. Never merge them into the outdoor stats,
  pyramid or ledger — a board V6 and a Red River V6 are unrelated numbers.

**Apex is pulled, not written.** `apex.html` reads `projects/apex/apex-data.js`, which
`projects/apex/pull-apex.py` generates from the Apex Legends Status API. Rules:

- The **API key** lives in the macOS Keychain (`apex-als`) and never goes in the repo.
  The **gamertag** is the script's input in `projects/apex/apex-account.json` (gitignored)
  — but note it is *not* actually private: `pull-apex.py` writes it into `apex-data.js`,
  which **is** committed, and the page renders it as the `<h1>`. That's fine (a gamertag
  is public by nature), but don't rely on the gitignore as if it hid anything.
- `apex-data.js` **is** committed — it's what the page reads.
- Apex exposes only the three trackers on the banner of the legend being played, so the
  script is an **accumulator**: it keeps the highest value ever seen per tracker and one
  history point per day. Don't "fix" a number that looks low by hand-editing the data —
  either the tracker isn't equipped or the upstream cache is stale.
- Career kills/wins are account-wide but no API returns them. They are typed into the
  `career` block by hand and the script preserves them. The page labels them as hand-read;
  keep that honesty intact.

Homepage "transmissions" live in `notes.js`. Curated newest additions live
in `latest.js`; every room renders
that data as a banner in its own native style. A banner may opt into
`data-latest-skip-linked`, which passes over any item the page already links to
outside its `<nav>` — `exploration.html` sets it because it plots all of its own
projects on the page, so the banner was announcing the newest one directly above
its own card. Rooms happy to repeat one of their own entries just leave it off. `orrin.html` is self-updating — leave
its GitHub data logic alone unless fixing a bug. `systems.html` and `updates.html` are
legacy redirects, not rooms.

## House style

- Match the existing voice: playful, terminal/hacker flavor, easter eggs welcome
  (e.g. hidden `index.html` commands: `orrin`, `apex`, `sudo`, `coffee`, `exit`).
- Keep every easter egg discoverable in `EASTER_EGGS.md`. Sitewide visual modes belong
  in `effects.js`; preserve the reduced-motion fallback, room-to-room persistence,
  refresh-to-reset behavior, and the `sober` terminal command. Do not add a visible
  reset button or Escape-key exit unless Ric asks for one.
- Keep pages responsive — test at ~375px wide; nothing may overflow sideways, and the
  room nav must collapse behind its `.roomnav-toggle` rather than wrapping into rows.
- Keep the palette and font already defined in each page's `:root` / `body`. **But every
  colour that carries words has to clear 4.5:1 against what's behind it**, and nothing
  sets type below **11px**. Several rooms have a "dim accent" variable tuned for this —
  read the comment above it before darkening one. Where a brand colour can't clear AA as
  text (Strava orange, the safelight red), the room keeps a second variable for the
  text version rather than dimming the type.
- Preserve `aria-current`, `aria-label`, `alt`, and `<title>`/`<meta name=description>`
  when you touch a page. `alt` is a sentence about what's in the photo — never the frame
  number, and `alt=""` if there's nothing to say (the caption covers it).
- Room pages are for visitors. Setup steps, filenames, API keys and "replace me" copy
  belong in `README.md`, not on a page family reads.

## Quick verification checklist before you finish

- [ ] All internal links resolve (files exist; current page marked `here`).
- [ ] The menu label set is identical across all room pages.
- [ ] Page still opens as a static file — no console errors, no external requests
      beyond the GitHub API calls that already exist.
- [ ] Looks right at mobile width.
- [ ] Didn't add location data, extra repos, or a build step.
