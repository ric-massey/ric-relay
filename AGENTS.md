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

1. **No location DATA, ever — the app is fine, the coordinates are not.** As of
   2026-08-21 the private map lives in this repo at `atlas/` and is served from
   `ricmassey.com/atlas/`. That is deliberate: `atlas/` is only *code*, and it holds
   no places. Every pin, coordinate and photo lives in Supabase behind a real login,
   and row-level security — not the repo being private — is what guards it. So: never
   commit coordinates, addresses, GPS traces, or a hard-coded pin into this repo, and
   never put the Supabase **service_role** key here (it bypasses every policy; the
   publishable key in `atlas/config.js` is public by design and is fine).
   `map.html` stays as the themed door that links through to `atlas/` — don't
   "fix" it back into a dead placeholder.
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
terminal · orrin · psyche · climbing · training · exploration · gaming · workbench · captures · entertainment
```

**This set matches the home page's `#dir` listing on purpose.** The room navs used to
carry different sets in different places, so the site said two different things about
what it contains — a visitor landed on the terminal, saw one list, clicked into a room
and was offered another. `apex`, `log` and `map` are out of the nav for the same reason
they're out of `#dir`. Those pages still *carry* the nav (with no `.here` marked, since
they aren't in it) rather than dropping it like `map.html` does — losing the way out of
a room is worse than an unhighlighted bar.

**The mobile menu is shared behaviour, not shared styling.** `installRoomMenu()` in
`effects.js` finds `nav[aria-label="Terminal rooms"]`, injects a `.roomnav-toggle` button
before it, and toggles `.roomnav-open` on the nav. Each page styles `.roomnav-toggle`,
`nav[data-roomnav]` and `nav[data-roomnav].roomnav-open` in its own `<style>` — that's
where the room's look lives. Tap targets in the open menu must be at least 44px tall.
With JS off nothing is injected and the nav renders exactly as it always did.

- `href` targets and link text are **identical on every page** — only the CSS differs.
- **Known drift, not a licence to add more:** the front door and `ls` render the Psyche
  room as `/mind` (that is its `name` in `ROOMS`), while every room nav still says
  `psyche`. `PAGE_ALIASES` in `index.html` maps `psyche` → `mind` so both words work,
  but a visitor sees two names for one room. If you are asked to settle it, change the
  `ROOMS` name **or** the nine navs — not one page of them.
- Keep Terminal home links as `index.html` in room markup for direct-file compatibility.
  `effects.js` normalizes those links to the clean directory root when served over HTTP;
  `projects/relay-return.js` does the same for project return controls. Do not hardcode
  a deployment subdirectory or domain.
- The current room is rendered as a `<span class="here" aria-current="page">` (not a
  link), positioned in the same spot in the list as its `<a>` on other pages.
- Each `<nav>` carries `aria-label="Terminal rooms"`.
- `map.html` is deliberately left out of the room menus entirely.

**`apex`, `log` and `map` are deliberately unlisted** — in `#dir` *and* in the room
navs. They are the thin rooms and Ric does not want the front door advertising work
that isn't done. They are *not* removed: `ls`, `tree`, `find`, `open <room>`, typing
the room name and the plain URL all still reach them, and Tab completion offers
`apex` and `log` (`map` is left out of completions only, since it answers `[LOCKED]`
— completing to a dead end is just untidy). Don't "fix" this by putting them back.
If one gets built out properly, that's the moment to re-list it.

**There is one room list, in `index.html`.** The `ROOMS` array near the top of its script
is the single source for the `#dir` markup (rendered from it), `PAGES`, `ls`, `tree`,
`find`, `random` and Tab completion — these used to be five hand-maintained copies that
drifted (two typos lived in the page twice each). Add, rename or unlist a room by editing
`ROOMS` and nothing else in that file: `listed: true` puts it on the front door,
`locked: true` marks it `[LOCKED]` and keeps it out of `random` and completions.

`locked` means the room is a dead end, and right now `map` still carries it even though
ATLAS is live and `map.html` says `status: ONLINE`. So `ls` describes it as "being
built", `tree` prints `[LOCKED]` and Tab completion skips it, all of which are now
untrue. Clearing that flag and rewriting its `desc` is the fix — the room being
*unlisted* is separate and stays.

**There is a second list too: `PROJECTS`.** `ROOMS` covers the rooms; `PROJECTS`, right
below it, is what `projects`, `open <shortcut>`, `find` and the project branches of
`tree` read. Linking a project from its room is only half of shipping it — if it is not
in `PROJECTS`, the terminal cannot see it at all. (`projects/how-big-everything-is/` is
live and linked from Exploration and is missing from this array today; that is a bug, not
(The boards page is the one deliberate exception: it stays out of `PROJECTS`
and answers to its own `tension` / `kilter` / `boards` / `woodshed` commands instead.
It is called Boards now; `woodshed` still works because that is what the
easter-egg notes have told people to type for years.)


Per-room nav treatments (class on the `<nav>`):

| Page | nav style | class |
|---|---|---|
| orrin | synaptic pill switcher | `nav.cortex` |
| psyche | psychological case-file tabs | `nav.case-tabs` |
| climbing | its own section bar — see below | `.climbtop` + `.climbnav` |
| training | its own section bar — see below | `.traintop` + `.trainnav` |
| apex | Apex lobby tab strip (scrolls sideways, red underline on the current room) | `nav.lobbytabs` |
| exploration | star-chart waypoints | `nav.starchart` |
| gaming | understated top-bar text links | `nav.launcher` |
| workbench | blueprint sheet-index chips | `nav.sheets` |
| captures | darkroom film strip | `nav.filmstrip` |
| entertainment | cinema marquee tab strip (bulbs under the current room) | `nav.marquee` |
| log | newspaper section bar | `nav.sections` |
| index | terminal directory listing + `ls`/`open` commands | `#dir` |

**Two rooms have grown into sections and carry their own bar instead.** Climbing and
training are no longer one page each: climbing is seven pages under
`projects/climbing/`, training is four — home at the root, then calendar,
workouts and trips under `projects/training/`. Both replaced the
room nav with a two-strip bar of their own — a terminal line carrying the way back up
(`↑ all rooms`), and under it the section's own tabs. Climbing did this first; training
followed it deliberately on 2026-09-18, because two rooms in one house should not move
differently when you cross between them.

So the room-nav rules above do **not** apply to those two, and this is the one place the
"identical label set on every page" line is knowingly broken. What replaces it is the
`↑ all rooms` link: the way out of the room is still one tap, which is the thing that
rule exists to protect.

Each bar is built once and each page declares only which tab it is on:

```
<script src="assets/climbing-nav.js" data-nav="log"></script>
<script src="assets/training-nav.js" data-nav="calendar"></script>
```

Both read the site root off their own `src` rather than `location.pathname`, because the
dev server, a `file://` open and Pages disagree about the path and the script's own URL
is the one thing right in all three. Styling is `assets/climbing-nav.css` and
`assets/training-nav.css`; the sections' page styles are `assets/climbing.css` and
`assets/training.css`. That is a shared stylesheet **within one room**, which is what
hard rule 3 forbids doing **across** rooms — the two bars look different from each other
on purpose, and neither resembles any other room.

`effects.js` only injects its mobile room menu where it finds `.topbar .roomnav`, so it
quietly does nothing on those eleven pages. That is correct: both section bars scroll
sideways under 820px instead.

**If you add, remove, or rename a room:** edit `ROOMS` in `index.html` (that covers the
directory, `ls`, `tree`, `find` and completion in one place), then update the `<nav>` on
**every** room page, the table in `README.md`, and this file. Keep the label set in sync
everywhere — the navs must agree with each other *and* with the front door.

## Projects and photos

- **Sub-projects** live in `projects/<name>/` (or a single `.html`) and are **linked
  from the room that fits them — from exactly one room.** Current: `spacetime`,
  `how-speed-affects-time` and `how-big-everything-is` → Exploration;
  `the-shape-of-harm`,
  `autism-reflection.html`, and `state-of-mind-line` → Psyche; `siege-conductor` →
  Workbench; `farlight`, `offramp`, `kondrite`, and `starfield` → Gaming; `climbing`
  → Climbing (including the unlisted `climbing/board.html`); `training` and `apex` are
  room data rather than pages. Each is self-contained and may carry its own assets/fonts;
  the "no dependencies" rule is for the terminal's own room pages, not embedded projects.
  Keep their internal links relative.
- **The games moved to Gaming and their old cards were left behind.** `workbench.html`
  still carries FARLIGHT, KONDRITE and Interstate 40 as bench items, and
  `exploration.html` still carries Starfield as MODULE 004 — so four projects are
  advertised from two rooms each, and the Workbench copy for Interstate 40 ("Nothing to
  hit yet, and no way off it — the ramps are the next thing") describes a version of
  OFFRAMP that hasn't existed for months. Moving a project means removing the old card,
  not just adding the new one.
- **Every standalone project HTML page needs a visible route back to the terminal.** Use
  `projects/relay-return.js` with the correct relative `src` and `data-home` paths so the
  fixed “← Ric's Terminal” control works from desktop and mobile. The optional `data-egg`
  value may add a project-themed typed easter egg — but **the value has to exist in the
  `eggs` map inside `relay-return.js`**, or the page declares an egg that silently never
  fires. `projects/offramp/index.html` sets `data-egg="offramp"` and there is no
  `offramp` entry, so that one is dead today. Every egg also belongs in
  `EASTER_EGGS.md`.
- **Photos** go in `photos/`, web-optimized (resize to ~1600px, convert HEIC→JPG). Do
  **not** commit full-res originals — they belong in `_photo-originals/`, which is
  gitignored. `captures.html` reads a `FRAMES` array; `climbing.html` rotates a few as
  a hero banner. If you add photos, optimize first (`sips -Z 1600 -s format jpeg …`).
- **Game cover art** for `gaming.html` lives in `assets/games/<game>.jpg` and is **real
  in-game screenshots**, not mockups, gradients, or menu grabs — the room is a storefront
  and lives or dies on real art. The games are canvas-rendered. A plain headless
  `--screenshot` only catches the title/menu; to capture actual GAMEPLAY you must feed the
  canvas *trusted* input, which a JS-synthesized `KeyboardEvent` is not. Drive it over the
  Chrome DevTools Protocol instead: launch with `--remote-debugging-port`, attach, and use
  `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent` to click "start" and play a few
  seconds, then `Page.captureScreenshot`. Crop the bottom ~8% (control hints + the
  "← Ric's Terminal" button) and optimise with `sips -s format jpeg -s formatOptions 82`
  (or PIL). Starfield's real visual is in `fly.html`, not its text `index.html`; its FTL
  gears throw a milestone banner, so shoot it in the default thruster gear. Don't replace
  this art with CSS gradients or menu screenshots.
- **Game clips.** Each cover also has a looping `assets/games/<game>.webm` — the featured
  game autoplays it (muted, looping), the others play on hover; both fall back to the `.jpg`
  poster and neither autoplays under `prefers-reduced-motion` (small inline script at the
  foot of `gaming.html`). No ffmpeg on this box: the clips are recorded **in the browser**
  by driving the game over CDP (as above), then `canvas.captureStream(30)` →
  `MediaRecorder('video/webm')`, collecting the blob and pulling it out as base64 (chunk it
  — a multi-MB `returnByValue` comes back `undefined`). The `.jpg` poster for each is a
  frame *from* its clip so the two line up with no hover-jump: draw the `<video>` to a
  canvas and `toDataURL`, but a `file://` video **taints** the canvas — serve the folder
  over HTTP (`python3 -m http.server`) and load video + wrapper from the same origin so the
  export is allowed. Keep clips a few seconds and reasonably compressed; webm needs a
  static-poster fallback for older Safari/iOS, which the `<video poster>` already gives.

## Editing content

Each page has a loudly-commented editable block near its content. To add a
photo, an activity, a project, a log entry — copy the example block in that page and
edit it.

**Climbing is the exception: it is data-driven, not hand-edited.** `climbing.html`,
`projects/climbing/index.html` and `projects/climbing/gallery.html` all read
generated files. To add a climb, edit `projects/climbing/climbs.md` and run
`python3 projects/climbing/build-data.py`. See `projects/climbing/readme.md`.
That script also writes `projects/climbing/latest-climb.js`, which `index.html` loads
so the newest day out leads the "latest" banner without anyone editing a list.

**A day can also be logged from a phone at the crag.** `projects/climbing/add.html`
takes either a day out or a route for the to-do. You get to it by signing in at the
foot of `climbing.html` — that is the only password box in the section, and the Add
tab appears in the climbing bar beside Boards the moment it takes (`assets/climbing-nav.js`,
`ClimbNav.refresh()`). The page
writes the markdown block it *would* have written into `climbs.md` to the Worker;
`web-trips.js` is the one place that fetches those days and folds them into the archive's
shape using `climb-parse.js`, the browser port of the parser `build-data.py` uses. Both
parsers are held to each other by `projects/climbing/test/parse-parity.js`. Any page that
loads `web-trips.js` must load `climb-vocab.js` and `climb-parse.js` first, in that
order. When the service is down it merges nothing and the committed history stands —
a page showing real history is right, and an error page is not.

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
  pyramid or ledger — a board V6 and a Red River V6 are unrelated numbers. The
  training page shows board nights under the climbing session they answered, and
  keeps them on their own scale there too.
- **A board night ticks its climbing session, but nothing pushes.** Kilter and
  Tension have no webhooks and their credentials are an account password, which
  does not go near Cloudflare — so the Mac polls hourly (`board-sync.plist`) and
  `board-tick.mjs` posts the DATES to the Worker's `/board`, which matches them
  to the plan and ticks. Dates only: what was climbed is already in
  `board-data.js` and the training page reads it from there rather than keeping
  a second copy that could drift.
- `auto` in the training log holds WHICH source placed a tick — `strava`,
  `kilter`, `tension` — not just `true`. Ticks written before boards existed
  hold `true` and are read as Strava.

**Runs are pushed, not written.** `training.html` shows runs that Strava POSTs to the
Worker the moment a watch syncs, and the run session planned for that date ticks itself
off. `projects/training/README.md` has the full rules; the three that constrain edits:

- **The route is published; everything else about "where" is not.** Ric decided this on
  2026-08-17 and it reverses what this file said before, so read it carefully: the
  encoded polyline IS stored and drawn on a real map in the run detail. `start_latlng`,
  city, address and timezone are all still refused, the leak guard still runs over the
  result, and the route still arrives through one named field rather than by waving
  Strava's whole `map` object through. Widening `ACTIVITY_FIELDS` past that is a fresh
  decision, not a continuation of this one.
- **A route is held back from visitors for five minutes.** His line was "I don't want
  them to see my location when I'm training" — a map appearing the instant a watch syncs
  says where he is *now*. Timestamps publish as normal; only the route waits, only for
  visitors, and only briefly. Signed in he sees it at once. The constant is
  `ROUTE_HOLD_MS` in `server/worker.mjs`, counted from `at` — the moment the Worker took
  the activity in, not `start_date_local`, which is a local time wearing a `Z` and can
  be a timezone out in either direction. `at` survives re-ingest so a rename does not
  send an old map back behind the hold.
- **The run detail loads map tiles from openstreetmap.org.** This is the one external
  host on the site and it breaks the "no external requests" line in the checklist below.
  Images only — no map library, no API key, no script. If tiles fail the route still
  draws on the background colour. Attribution is required and is in the corner of the
  map; do not remove it.
- **The webhook body is never believed.** It carries only an activity id; the date,
  sport and distance are read back from the API with Ric's token. The endpoint is public
  and unauthenticated because Strava does not sign its events, and that is only safe as
  long as nothing trusts the payload. Keep it that way.
- **Only runs tick, and only sessions that match them.** Board sessions are already
  pulled properly onto the climbing page — a watch ticking climbing too would
  double-count the site's one real source.

**Entertainment is written from the page, and falls back to this browser.**
`entertainment.html` reads `entertainment-data.js` — 363 titles, each `watched` or
`watchlist`. Rules for it:

- **The committed file is the archive and always renders on its own.** Everything else
  is a layer on top of it, merged at read time: the Worker's `/movies` first, then this
  browser's `localStorage`. Same shape as the climbing pages, for the same reason — a
  page showing the real list is right, and an error page is not. If the service is
  unreachable the page must still come up complete.
- **`/movies` is written and tested but not deployed.** Until it is, every edit lands in
  `localStorage` and the card says **not committed**. Don't "fix" that by deleting the
  local layer — it is the only thing holding those edits. The owner panel's Export
  button prints a replacement data file with them folded in; that is how they get
  committed.
- **A removal is a tombstone, not a delete** (`{ removed: true }`), in the Worker and in
  the local layer both. This is the one place `/movies` differs from `/todo`, which it
  is otherwise a copy of, and the reason is the committed file underneath: a real delete
  is undone by the next page load.
- **The export must keep the data file's header.** It reads it back off the real file
  rather than keeping a second copy, because two copies of a comment is how a comment
  starts lying — export once with a stale duplicate and the rules at the top of the data
  file are quietly replaced.
- **The titles are his, not IMDb's.** They were corrected for spelling and casing only.
  Several were deliberately left as typed because the right film was not guessable —
  don't "fix" `Curtis`, `Moments`, `The Sound`, `Greater good`, `RIP`, `Code 3`,
  `Mercy` or `Obsession` without asking him which ones they are.
- **The room's data is pulled in two stages, and they are separate on purpose.**
  `projects/entertainment/pull-entertainment.py`:
  - **Stage 1, facts — no key, nothing to sign up for.** Wikipedia finds the article,
    Wikidata answers: year, runtime, director, genre, IMDb id and **the TMDB id**.
    Wikidata is CC0; the one-line synopsis is the Wikipedia extract (CC BY-SA).
  - **Stage 2, art — needs the free TMDB key** in the Keychain (`tmdb`, account
    `ricmassey`), never in the repo, same rule as `apex-als`. It never *searches*
    TMDB: stage 1 already handed it the exact id, so there is no fuzzy matching and
    no chance of a stranger's poster.
- **Poster art is downloaded and committed — never hotlinked.** Images land in
  `assets/posters/` (and `assets/backdrops/` for starred titles) and the pages read
  files out of this repo, so the live room still makes **no external request** and still
  works opened off disk. That is hard rule 4's actual line: a CDN `<img src>` is a
  dependency and is out; a file in `assets/` is not. Ric asked for the pictures
  (2026-09-21) — the "unless asked" clause — but that bought art, not a CDN.
- **Identity comes from an id, never from a title.** Titles on this list are short and
  collide brutally: `Greater`, `Moments`, `Obsession`, `Mercy`, `RIP` are all real films
  *and* real other things. The matcher requires the article title to equal the row title
  once Wikipedia's "(2016 film)" is stripped — nothing looser. An earlier, looser rule
  matched `Moments` to *Defining Moments*, which is exactly the failure this guards.
  Titles it cannot settle are **reported, not guessed**; exact matches on a name
  Wikipedia considers ambiguous are matched but flagged for Ric's eye.
- **`--audit` is the check that scales.** Finding wrong matches by noticing that
  *13 Hours* is a war film and not a Scorsese comedy does not work at 363 titles. The
  audit asks TMDB — a different catalogue with its own idea of which film a name means —
  and flags two things: a stored film whose own title is not what Ric wrote (catches
  redirects and near-misses), and a far better-known film with exactly that name
  (catches remakes: 2025's *Junior* over 1994's, 1932's *Scarface* over 1983's).
  `--fix` takes the suggestion and clears the old film's facts and poster with it.
  Rows Ric confirmed himself are never questioned. Run it after any bulk `--facts`.
- **Wikipedia redirects are a trap for a title matcher.** "13 Hours" is a *redirect* to
  "After Hours (film)", so the article NAME matched while the entity behind it was a
  different film entirely. Always compare against what the page resolved to — the entity
  label and the post-redirect title — never the search term. And never carry a summary
  between loop iterations; that turned one candidate's name into another's identity.
- **`entertainment-data.js` is strict JSON, and it is parsed, never pattern-matched.**
  This file lost data three separate times, and every time it was the same failure: the
  reader could not see a field, so the writer dropped it, silently.
  1. the reader named `genres` as the only list, so `cast`, `streams` and `rents` were
     invisible — one whole pass of availability data gone;
  2. `parts` put braces inside a row and the row pattern forbade nesting, so every
     franchise row stopped being a row — 23 rows deleted, Star Wars among them;
  3. scanning a whole row for scalars picked up the `id` of a nested recommendation and
     overwrote the row's own.

  A regex has to be taught each new shape and fails quietly when it has not been. A JSON
  parser knows every shape there will ever be and fails LOUDLY on anything it does not.
  JSON is still valid JS, so the page loads it unchanged, and quoted keys are no harder
  to hand-edit. **Do not reintroduce a pattern-based reader.**
- **`write_rows` refuses to write anything it cannot read back.** It serialises,
  re-parses what it just built, and compares to what it had; on any difference the file
  is not touched and the run stops with the row that differs. A bug can still exist — it
  can no longer destroy anything quietly. `read_rows` is the same on the way in: invalid
  JSON, a row with no id, or a duplicate id all stop the run rather than returning a
  partial list that the next write would make permanent.
- **Unknown fields are preserved.** Anything on a row that `FIELDS` has never heard of is
  written back untouched, so adding a field to the data by hand is safe and forgetting to
  add it to `FIELDS` costs nothing but ordering.
- **The page's Export button emits the same JSON**, and `FIELDS` appears in both
  `pull-entertainment.py` and `assets/entertainment-room.js`. They have to agree or every
  export fights the last pull.
- **A hand-set `wd:` or `tmdb:` id is never overwritten.** That is how an ambiguous
  title gets settled once and stays settled through every re-run.
- **The page asks Ric which film it is, at the moment he adds it.** Adding a title from
  the owner panel opens a chooser: it searches Wikipedia, shows the candidates with
  their thumbnails, years and first lines, and he picks. "Keep it as I typed" is always
  an option — an obscure film that is on nobody's list is still on his — and backing out
  cancels the add rather than saving a half-answered row. Any row already on the list can
  be corrected the same way from its detail sheet ("Not the right film?"), which clears
  the old facts before writing the new ones so 1969's runtime never ends up on 2003's
  film. This is the right place for the question: he is the only one who knows which
  *Moments* he watched, and he knows it then, not six months later.
- **The chooser's fetch does not break hard rule 4.** Nothing runs on load, no visitor
  can trigger it, and the page opens off disk and renders all 363 titles with the network
  unplugged. It fires when the signed-in owner clicks a button — the same category as a
  "Watch on Hulu" link, and a weaker claim than the `/movies` read the room already does
  on load.
- **Never commit the chooser's thumbnails.** They come from Wikipedia and are non-free
  fair-use files; they are shown in the owner's own panel for the seconds it takes to
  tell two films apart, and are never saved, never committed and never served to a
  visitor. The poster that lands on the site comes from TMDB, whose terms allow it.
- **The script writes as it goes** (every ten rows) and skips rows already filled in, so
  stopping it halfway costs nothing and a re-run is cheap.
- **`urllib` needs its certificates pointed at.** A python.org install ships `certifi`
  but only wires it up if someone runs *Install Certificates.command*, which nobody
  does — so `urllib` gets `CERTIFICATE_VERIFY_FAILED` while `curl` in the same shell is
  fine. The script builds its own SSL context from `certifi` when it can. Any new script
  here that talks https should do the same rather than "fixing" the Python install.
- **The credit line in the footer is not decoration.** Wikipedia extracts are CC BY-SA
  and TMDB's terms ask to be named. It is hidden until there is actually borrowed data
  on the page; don't delete it once there is.
- **No poster file yet? Then no `<img>` at all.** The tile falls back to a typographic
  plate, tinted by a hash of the id. This is a designed state, not a broken one: the
  page has to be right on the day it ships, not only after a script gets run. Never
  emit an `<img>` that might 404 — 363 broken frames is worse than no pictures.
- **Links out are not dependencies.** Every tile offers "Watch on <service>" (a title
  *search* URL, never a per-title deep link — those rot) plus a JustWatch fallback.
  Nothing loads until it is clicked, so the page still opens off disk with no network.
  Availability itself is never stored: things leave Hulu monthly, and a confidently
  stale answer is worse than resolving it at click time.
- **Two pages, one core.** `entertainment.html` is the app (billboard, service row,
  shelves); `entertainment-library.html` is the catalog (every title, filters, posters
  or dense list). Both load `assets/entertainment-room.js`, which owns the merge rules,
  the write path, the detail sheet, the owner panel and the export. Hard rule 3 is about
  not flattening the *site* into one template — inside one room, one core is how the two
  pages keep telling the same truth. Don't fork it.
- **The room is a video store, and the case is a real box.** A DVD case is drawn in
  CSS 3D: the spine faces out (all you see on a full shelf) and the front cover is
  hinged to the spine's right edge, folded back at 90° where it is invisible edge-on.
  Pulling it out rotates the whole box about that hinge. Don't "simplify" it to a
  cross-fade between two images — the hinge is why it reads as an object.
- **Hover is not available on a phone**, so the gesture is the real one: first tap pulls
  the case off the shelf, second tap opens it. That handler runs in the CAPTURE phase,
  ahead of the room's own click handler, or the first tap falls through and opens the
  sheet immediately.
- **`.board` was already the billboard.** Naming the shelf plank `.board` too painted
  the hero section in wood grain. It is `.shelf-board`. Check for a collision before
  adding a generic class name to a page this size.
- **The furniture lives in `assets/entertainment-room.css`** and the case markup in
  `Room.dvdCase` — one definition, both pages. Hard rule 3 is about not flattening the
  SITE into one template; this is one room's furniture, like `assets/climbing.css`.
- **The mark on a film is a PERSON, not a star.** That list is what Ric and his partner
  are going to watch together, which is a different thing from a favourite. The data
  field is still `pick` — it is in the committed file, the Worker and the export, and
  renaming a field to change a label is how a schema grows two of everything. Only the
  words and the icon changed; the label is `PARTNER_LABEL` in the core, one line.
- **Favourite actors ride under a reserved id** (`_people`) in the same store as the
  films, and `all()` filters ids starting with an underscore out of the film list. They
  are not written to entertainment-data.js — that file is a list of films.
- **A front-page shelf shows thirty cases, not the whole shelf.** 1,300 3D boxes on one
  page is a phone running hot for nothing. The whole catalogue is the library page,
  which cuts its rows in JavaScript because a flex-wrapped row has nothing to stand on —
  the plank has to know where the row ends.
- **Shelves are ordered by fact, never by mood.** Starred, recently watched, queued,
  on-a-service, franchise, genre, decade. No "cosy Sunday" rows.
- **`FIELDS` appears twice on purpose and must match** — in `pull-entertainment.py` and in
  `entertainment-room.js`'s export. The script and the Export button both rewrite the
  data file; if the two lists disagree, every export fights the last pull.
- **The order of the watched block IS the order he watched them** — oldest at the top,
  most recent at the bottom (Ric, 2026-09-21). There are no watch *dates* for the
  original 238 (they came off a piece of paper, not a log), but `ord` is real data, not
  a guess. Two consequences, both load-bearing:
  - **Never alphabetise the watched block.** The export sorts by status then `ord`, and
    the title only breaks ties. Sort that block by name — as an earlier version of the
    export did — and the only record of what he watched when is gone and unrecoverable.
  - A title marked watched from the page gets a real `seen` date and sorts above the
    whole paper backlog, which is correct: it happened today. On export it lands at the
    bottom of the watched block, which is where the most recent thing belongs.

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
in `latest.js` and are announced in exactly one place: the NOTIFICATION banner on
`index.html`. Every room used to carry one in its own native style; they don't any
more, so an addition is not repeated eight times. The per-room support is still in
`latest.js` (`data-latest-room` for a room's own wording, `data-latest-skip-linked`
to pass over an item the page already links to outside its `<nav>`) — if a room
takes a banner back, use it. Give each entry the `room` it belongs to and **keep that
value right when a project moves** — KONDRITE, FARLIGHT and Starfield are still filed
under `workbench`/`exploration` in `latest.js` after moving to Gaming, which is harmless
only for as long as no room carries a banner again. `latest.js` is also the thing that
goes stale quietest: its newest entry is still the Training Log from 2026-08-17, so the
front door announces that as the new thing while the Gaming room, the KONDRITE campaign
and ATLAS have all shipped since. If you ship something family would care about, put it
at the top of that list. `orrin.html` is self-updating — leave its GitHub data logic
alone unless fixing a bug. `systems.html` and `updates.html` are legacy redirects, not
rooms.

**ATLAS (`atlas/`) plays by its own rules and has its own README.** It is the one part
of this repo that is an application rather than a page: Supabase, a real login,
row-level security, migrations in `atlas/supabase/migrations/`, and a test suite in
`atlas/test/`. Read [`atlas/README.md`](atlas/README.md) before touching it, and
remember hard rule 1: code here, places there. `map.html` is only the door.

## House style

- Match the existing voice: playful, terminal/hacker flavor, easter eggs welcome
  (e.g. hidden `index.html` commands: `orrin`, `apex`, `sudo`, `coffee`, `exit`).
- Keep every easter egg discoverable in `EASTER_EGGS.md`. Sitewide visual modes belong
  in `effects.js`; preserve the reduced-motion fallback, room-to-room persistence,
  refresh-to-reset behavior, and the `sober` terminal command. Do not add a visible
  reset button or Escape-key exit unless Ric asks for one.
- **Mochi has three worlds and they are room-aware, not global.** Ordinary rooms get the
  walking resident. `climbing.html` swaps him onto the wall — he grabs the side edges of
  the page's own features, steps up them, turns, hops, plays and falls
  (`assets/relay-cat-climb-*.png`). Starfield puts him in a bubble helmet in zero
  gravity. Each set has its own sprite list in `CAT_FRAMES` and its own per-frame
  offset/scale tuning in `CAT_FRAME_X` / `CAT_FRAME_Y` / `CAT_FRAME_SCALE`, keyed by
  filename — a new frame with no entry silently renders at the wrong offset, so add its
  row when you add the art, and every referenced file must exist in `assets/`.
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

## Verifying a change

There is no build and no test runner, so verification is: serve the folder, open the
pages you touched, and run whichever suites cover the code you touched.

```sh
python3 -m http.server 8912
```

```sh
node projects/kondrite/test/smoke.js      # syntax, transport, room service
node projects/kondrite/test/campaign.js   # headless play-through of all three missions
node projects/training/server/test.mjs     # worker rules: auth, strava, media, todo, movies
node projects/climbing/test/parse-parity.js  # build-data.py and climb-parse.js agree
for t in projects/offramp/test/*.test.js; do node "$t" || break; done
for t in atlas/test/*.test.mjs; do node "$t" || break; done
```

`projects/offramp/test/motive.test.js` and `sim.test.js` take a couple of minutes each —
they are simulations, not unit tests. Let them finish.

Served from a plain static server, `/climb`, `/media`, `/log` and `/strava` all 404:
those are Cloudflare Worker endpoints, and on `localhost` the client points at the origin
it was loaded from. Every caller treats a failed fetch as "no extra data" and falls back
to the committed history, so those 404s in the console are expected and are **not** the
bug you are looking for.

## Quick verification checklist before you finish

- [ ] All internal links resolve (files exist; current page marked `here`).
- [ ] The menu label set is identical across all room pages.
- [ ] A new room is in `ROOMS`; a new project is in `PROJECTS` **and** linked from
      exactly one room **and** loads `relay-return.js`.
- [ ] Any `data-egg` you added has a matching entry in `relay-return.js` and a line in
      `EASTER_EGGS.md`.
- [ ] Page still opens as a static file — no console errors, no external requests
      beyond the GitHub API calls that already exist and the OpenStreetMap tiles in
      the training page's run detail.
- [ ] Looks right at mobile width.
- [ ] Didn't add location data, extra repos, or a build step.
- [ ] The relevant test suite above still passes.
