# Notes for AI assistants working on Terminal

This file is for any LLM/agent asked to change this site. Read it before you touch
anything. `README.md` covers what the site is; this file covers **how to work on it
without breaking the concept or Ric's rules.**

## What this project is

Ric Massey's personal website for friends and family. The concept: **"it's literally
my own internet."** The home page (`index.html`) is **the front door** — a portal: quick stats, the
room people use most, and every room by subject, most used first (see "The front
door" below); the terminal hub that used to be home is
`terminal.html` (moved 2026-10-17, Ric: "make the front door the main page"). Every other page is a **room** dressed up to look like the real app for that world (climbing → Mountain
Project, training → Strava, Orrin → a brain, etc.). Plain HTML/CSS/JS, **no build
step and no dependencies** — each page is a single self-contained `.html` file with its
CSS in a `<style>` tag and its JS in a `<script>` tag. Keep it that way unless Ric
explicitly asks to add tooling.

Deploy = `git push` to `main` → GitHub Pages. So **a push is a publish.** Ric's
rule (2026-09-25): **push to `main` when a project's worth of work is done and
verified** — one push per finished piece of work, not one per commit and not
mid-task — unless he says otherwise. Other sessions (cloud and desktop) push to
`main` too: a SessionStart hook in `.claude/settings.json` pulls on startup, and
before a push, `git fetch` and fast-forward first.

## Update the documentation with the change

Ric (2026-10-22): documentation upkeep has been lacking. **A change is not finished
until the docs that describe it say what is now true.** In the same commit as the code:

- **This file** — if you added, moved, renamed or removed a page, room, project, file,
  route, rule or command, fix every line here that mentions it. A rule here that the
  code no longer follows is worse than no rule: the next agent will "fix" the code back.
- **`README.md`** — the room table and anything a visitor-facing description depends on.
- **The nearest README** — most sections carry their own (`projects/<name>/README.md`,
  `worker/README.md`, `atlas/README.md`, `projects/weather/README.md`, …). Setup steps,
  data formats and "why it is this way" belong there.
- **`EASTER_EGGS.md`** for any egg or hidden command; **`.github/checks.mjs`** for any
  new test.
- **Code comments** next to anything whose reason isn't obvious from reading it.

Write down *why*, with the date and Ric's words where he made the call — that is what
stops the next session undoing it. If you find a doc that is already wrong, fix it while
you are there, or say so in your summary. Before you finish, grep the docs for the
names you touched.

## Where things live

```
index.html                  the front door — home
terminal.html, <room>.html  the terminal and the rooms — one self-contained page each
frontdoor.html              a redirect to index.html, where the front door was previewed
effects.js                  sitewide: visual modes, the mobile room menu, Mochi
latest.js, notes.js         the newest additions (the front door's "Newest", the terminal's `latest`) and the terminal's transmissions (hand-edited)
orrin-updates.js            the Orrin page's progress notes (written by orrin_v3's scripts/site_update.py, or by hand)
captures-data.js            the photo dates captures.html draws (made off-repo from the originals)
systems.html, updates.html  redirects from old URLs — keep them, links out there still use them
assets/                     sitewide files at the top: owner.js, site-gate.js, training-plan.json
  cat/                      Mochi's sprite frames
  climbing/ training/ entertainment/   one room's own scripts, styles and generated JSON
  games/ posters/ backdrops/           art
photos/                     web-optimised photos, EXIF stripped (hard rule 1)
projects/<name>/            sub-projects, and room data that has a generator next to it
worker/                     the one Cloudflare Worker (deployed as training-log) — see its README
atlas/, account/            ATLAS and the site account — an app, not a page: see atlas/README.md
visitors/                   the private visitor counter; every page loads assets/visit.js (worker/README.md)
docs/                       notes, audits, mockups and plans about the site, not part of it
.github/                    checks.mjs (every test) and the workflows
```

Two rules keep it that way. **Generated data lives beside the thing that generates it**
(`projects/apex/apex-data.js`, `projects/entertainment/entertainment-data.js`); data
edited by hand, or made by something outside the repo, lives beside the page that reads
it. **A file whose URL something outside this repo depends on does not move** —
`assets/training-plan.json` stays at the top of `assets/` because the deployed Worker
fetches it by its full ricmassey.com address, and the redirect pages exist because
moving a page breaks every link to it. When you move anything else, grep for the old
path across the whole repo (workflows, `.gitignore`, tests and the Python scripts
included) and run the checks.

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
terminal · orrin · psyche · climbing · training · weather · exploration · gaming · workbench · captures · entertainment
```

**This set matches the home page's `#dir` listing on purpose.** The room navs used to
carry different sets in different places, so the site said two different things about
what it contains — a visitor landed on the terminal, saw one list, clicked into a room
and was offered another. `apex`, `cs`, `val`, `log` and `map` are out of the nav for the same reason
they're out of `#dir`. Those pages still *carry* the nav (with no `.here` marked, since
they aren't in it) rather than dropping it like `map.html` does — losing the way out of
a room is worse than an unhighlighted bar.

**The mobile menu is shared behaviour, not shared styling.** `installRoomMenu()` in
`effects.js` finds `nav[aria-label="Terminal rooms"]`, injects a `.roomnav-toggle` button
before it, and toggles `.roomnav-open` on the nav. Each page styles `.roomnav-toggle`,
`nav[data-roomnav]` and `nav[data-roomnav].roomnav-open` in its own `<style>` — that's
where the room's look lives. **A page that doesn't style `.roomnav-toggle` gets a bare
grey browser button beside its nav on every screen size** — Entertainment and the
Library did until 2026-10-22, and it pushed `captures` off the edge of a laptop
screen. Hide it (`display: none`) at the widths where the whole nav fits. Tap targets in the open menu must be at least 44px tall.
With JS off nothing is injected and the nav renders exactly as it always did.

- `href` targets and link text are **identical on every page** — only the CSS differs.
- **Known drift, not a licence to add more:** the front door and `ls` render the Psyche
  room as `/mind` (that is its `name` in `ROOMS`), while every room nav still says
  `psyche`. `PAGE_ALIASES` in `terminal.html` maps `psyche` → `mind` so both words work,
  but a visitor sees two names for one room. If you are asked to settle it, change the
  `ROOMS` name **or** the nine navs — not one page of them.
- A link that says **terminal** goes to `terminal.html` — every room nav's `terminal`
  entry, the "RIC'S TERMINAL" brands, the "← Ric's Terminal" controls, the 404's way
  back. A plain home link (the climbing and training bars' `↑ all rooms`) goes to
  `index.html`, the front door; `effects.js` normalizes those to the clean directory
  root when served over HTTP. `projects/relay-return.js` still reads a page's
  `data-home="…/index.html"` and turns it into the terminal.html beside it, so those
  attributes stay as they are. Do not hardcode
  a deployment subdirectory or domain.
- The current room is rendered as a `<span class="here" aria-current="page">` (not a
  link), positioned in the same spot in the list as its `<a>` on other pages.
- Each `<nav>` carries `aria-label="Terminal rooms"`.
- `map.html` is deliberately left out of the room menus entirely.

**`apex`, `cs`, `val`, `log` and `map` are deliberately unlisted** — in `#dir` *and* in the room
navs (the front door, `index.html`, is the one exception, by Ric's word on
2026-10-16: it shows Apex and ATLAS). They are the thin rooms and Ric does not want the front door advertising work
that isn't done. They are *not* removed: `ls`, `tree`, `find`, `open <room>`, typing
the room name and the plain URL all still reach them, and Tab completion offers all
of them. Don't "fix" this by putting them back. If one gets built out properly, that's
the moment to re-list it.

**There is one room list, in `terminal.html`.** The `ROOMS` array near the top of its script
is the single source for the `#dir` markup (rendered from it), `PAGES`, `ls`, `tree`,
`find`, `random` and Tab completion — these used to be five hand-maintained copies that
drifted (two typos lived in the page twice each). Add, rename or unlist a room by editing
`ROOMS` and nothing else in that file: `listed: true` puts it on the front door,
`locked: true` marks it `[LOCKED]` and keeps it out of `random` and completions.

`locked` means the room is a dead end. No room carries it today: `map` did, long after
ATLAS was live and `map.html` said `status: ONLINE`, so `ls` called it "being built",
`tree` printed `[LOCKED]` and Tab completion skipped it — all untrue, and cleared on
2026-09-24. Being *unlisted* is a separate flag and `map` keeps that one. Put `locked`
back only on a room that really answers nothing.

**There is a second list too: `PROJECTS`.** `ROOMS` covers the rooms; `PROJECTS`, right
below it, is what `projects`, `open <shortcut>`, `find` and the project branches of
`tree` read. Linking a project from its room is only half of shipping it — if it is not
in `PROJECTS`, the terminal cannot see it at all. (`projects/how-big-everything-is/` was
live and linked from Exploration for weeks with no entry here, so `open scale`, `find`
and `projects` did not know it existed; that was a bug, fixed 2026-09-24.)
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
| cs | CS2 main-menu strip (white underline) | `nav.mainmenu` |
| val | VALORANT client tabs (red underline) | `nav.clienttabs` |
| weather | frosted-glass pills over the sky | `nav.glass` |
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
<script src="assets/climbing/nav.js" data-nav="log"></script>
<script src="assets/training/nav.js" data-nav="calendar"></script>
```

Both read the site root off their own `src` rather than `location.pathname`, because the
dev server, a `file://` open and Pages disagree about the path and the script's own URL
is the one thing right in all three. Styling is `assets/climbing/nav.css` and
`assets/training/nav.css`; the sections' page styles are `assets/climbing/climbing.css` and
`assets/training/training.css`. That is a shared stylesheet **within one room**, which is what
hard rule 3 forbids doing **across** rooms — the two bars look different from each other
on purpose, and neither resembles any other room.

`effects.js` injects its mobile room menu wherever it finds `nav[aria-label="Terminal rooms"]`,
and those eleven pages carry none, so it quietly does nothing there. That is correct: both section bars scroll
sideways under 820px instead.

**If you add, remove, or rename a room:** edit `ROOMS` in `terminal.html` (that covers the
directory, `ls`, `tree`, `find` and completion in one place), then update the `<nav>` on
**every** room page, the table in `README.md`, and this file. Keep the label set in sync
everywhere — the navs must agree with each other *and* with the front door.

## Projects and photos

- **Sub-projects** live in `projects/<name>/` (or a single `.html`) and are **linked
  from the room that fits them — from exactly one room.** Current: `spacetime`,
  `how-speed-affects-time` and `how-big-everything-is` → Exploration;
  `autism-reflection.html`, `state-of-mind-line` and `psyche/studies.html` → Psyche; `siege-conductor` →
  Workbench; `farlight`, `offramp`, `kondrite`, and `starfield` → Gaming; `climbing`
  → Climbing (including the unlisted `climbing/board.html`); `training` and `apex` are
  room data rather than pages. Each is self-contained and may carry its own assets/fonts;
  the "no dependencies" rule is for the terminal's own room pages, not embedded projects.
  Keep their internal links relative.
- **Moving a project means removing the old card, not just adding the new one.** When
  the games moved to Gaming, `workbench.html` kept FARLIGHT, KONDRITE and Interstate 40
  as bench items and `exploration.html` kept Starfield as MODULE 004 for weeks, so four
  projects were advertised from two rooms each — and the Workbench copy for Interstate
  40 described a version of OFFRAMP that had not existed for months. Those cards came
  out on 2026-09-24; the Workbench is Siege Conductor and an empty slot, and Exploration
  is three modules and a berth.
- **`projects/dads-race/` (HERMISCUS) is the one project with no room.** It is the
  crew app for Dad's race, mostly built by Ric's sister, and the only way in is the
  undocumented `hermiscus` terminal command — like the boards, don't promote it. **The
  website only ever runs its demo**: the real Supabase key lives in the git-ignored
  `shared/config.local.js`, loaded on localhost only, and with no key the app runs on the
  made-up `shared/demo-data.js`. Never commit the key, the project address, or real race
  data (lodging, addresses, notes) — its `tests/auth-security.test.cjs` goes red if you do.
  Read its `README.md` first.
- **Every standalone project HTML page needs a visible route back to the terminal.** Use
  `projects/relay-return.js` with the correct relative `src` and `data-home` paths so the
  fixed “← Ric's Terminal” control works from desktop and mobile. The optional `data-egg`
  value may add a project-themed typed easter egg — but **the value has to exist in the
  `eggs` map inside `relay-return.js`**, or the page declares an egg that silently never
  fires. `projects/offramp/index.html` declared `data-egg="offramp"` for months with no
  `offramp` entry; it has one now (`exit`). A typed egg on a game page must avoid the
  letters that drive it — no W, A, S or D on OFFRAMP. Every egg also belongs in
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
  over HTTP (`python3 -m http.server --bind 127.0.0.1`) and load video + wrapper from the same origin so the
  export is allowed. Keep clips a few seconds and reasonably compressed; webm needs a
  static-poster fallback for older Safari/iOS, which the `<video poster>` already gives.
- **A simulation's numbers are one machine's.** kondrite's front page and
  offramp's traffic fly identically on an arm64 Mac and an x86_64 runner for the
  first two minutes — same events, same tally — and have diverged by the
  ninetieth, because a one-ulp difference in a transcendental compounds over
  300,000 frames. Ric's Mac said the front page's longest silence was 11.5s
  against a 12s limit; a runner flying the same code said 14.3s. Both were true.
  So those suites live in `simulations.yml`, run when their game changes rather
  than on every push, and **a threshold that goes red on the other machine is
  fixed by putting slack in the game or flying several seeds — never by nudging
  the constant until it passes**, which throws the finding away. That rule was
  written and then not followed for a while: the nightly job stayed red until
  2026-09-24, when the 14.3s turned out to be a stale brawl the tally could not
  see and a pilot thrashing at its brake threshold on every slingshot approach.
  `attract.js` now has a dead-air clock (`DEAD_AIR`) that reads the same counters
  the test does, and the test flies three seeds and judges the worst; the 12 did
  not move. **`projects/kondrite/game/` is the game, in forty-one chapters.** It was the
  inline script at the foot of `index.html` — twenty-eight thousand lines in one
  HTML file — and came out the same day, first as one file byte for byte and then
  cut along its section markers. The chapters are classic scripts sharing the
  page's global scope, so **the `<script>` order in `index.html` is the program**:
  a function called at load time must be declared in the same chapter or an
  earlier one, because hoisting stops at the file. Read "Where it lives" in
  `projects/kondrite/README.md` before adding one. `test/smoke.js` refuses any
  inline script on that page, holds the folder to the page and the page to the
  order, and runs in the quick lane so a chapter that does not parse is caught on
  the push, not the nightly. **The living world (`game/living.js`) is the
  political simulation over the war** — LIVING-WORLD.md's first version, and the
  rule Ric set for it is that the player-facing side is visual: a wordless strip
  in flight, bars and a triangle on its own SECTOR page, glyphs on the chart, one
  headline on docking. Don't add a page of prose to it; add a mark. The news
  reports the record and never creates an event. §28 is in too — leaders who
  face an election every forty-five turns and fall when a power collapses, three
  laws that each change something the player can feel (letters of marque put
  raiders in a power's heartland, a closed border is a tariff at its stations,
  conscription grows the fleet and eats the calm), and a price on any raider that
  gets away from you in held sky, paid on the kill. **Civil war is never
  scripted** — Ric: "it needs to be able to happen through the collectives of
  the people. Nothing forced or faked." Provinces have a loyalty moved only by
  what happens to them; under the line with no guns over them they stop paying;
  neighbours that stop together are a cause; a cause nobody brings back holds
  its own sky as a fourth flag. Don't add a function that starts a civil war,
  and don't tune the numbers until one shows up: measured over twenty seeds and
  twenty hours of play each, one sector seceded, and that is the point. Every threshold in it was measured, not guessed:
  the comments say what the number was before and what it did. `test/living.js`
  runs it without a player for four hundred turns.

## Editing content

Each page has a loudly-commented editable block near its content. To add a
photo, an activity, a project, a log entry — copy the example block in that page and
edit it.

**Climbing is the exception: it is data-driven, not hand-edited.** `climbing.html`,
`projects/climbing/index.html` and `projects/climbing/gallery.html` all read
generated files. To add a climb, edit `projects/climbing/climbs.md` and run
`python3 projects/climbing/build-data.py`. See `projects/climbing/readme.md`.
That script also writes `projects/climbing/latest-climb.js`, which the front door's "Last
climb" reads — with the days logged from a phone, which only the log service has, so it
is right between builds too.

**A day can also be logged from a phone at the crag.** `projects/climbing/add.html`
takes either a day out or a route for the to-do. You get to it by signing in at the
foot of `climbing.html` — that is the only password box in the section, and the Add
tab appears in the climbing bar beside Boards the moment it takes (`assets/climbing/nav.js`,
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
- It is **deliberately hidden** from the room menus: no room menu entry, no `.jump` link
  (the front door lists it under Climbing, by Ric's word on 2026-10-16). The way in
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
  `ROUTE_HOLD_MS` in `worker/worker.mjs`, counted from `at` — the moment the Worker took
  the activity in, not `start_date_local`, which is a local time wearing a `Z` and can
  be a timezone out in either direction. `at` survives re-ingest so a rename does not
  send an old map back behind the hold.
- **The run detail loads map tiles from openstreetmap.org.** It was the first external
  host on the site, and it is not the only one now: unpkg (account/, admin/, ATLAS,
  HERMISCUS), Google Fonts (some rooms), jsDelivr (HERMISCUS), the GitHub API
  (orrin.html), the orrin-status Worker, ClinicalTrials.gov when the Worker fails, and
  the weather room's providers — each has its own note in this file and is listed in the
  checklist below.
  Images only — no map library, no API key, no script. If tiles fail the route still
  draws on the background colour. Attribution is required and is in the corner of the
  map; do not remove it.
- **The webhook body is never believed — deletes included.** It carries only an activity
  id; the date, sport and distance are read back from the API with Ric's token. The
  endpoint is public and unauthenticated because Strava does not sign its events, and
  that is only safe as long as nothing trusts the payload. Keep it that way. The delete
  branch was the one place that did trust it: until 2026-09-24 `{aspect_type: 'delete'}`
  with Ric's athlete id (in his profile URL) and an activity id (in the public `/strava`
  feed) wiped a run and un-ticked its session with no API call, from anyone. A delete is
  now honoured only when the API answers 404 for the activity; "still there" is a forgery
  and "could not ask" keeps the run.
- **The login throttle refuses the right password too.** Ten misses in five minutes and
  the Worker answers 429 to every credential it is shown — a wrong bearer, the correct
  bearer, the correct password on `/auth` — without examining it. The first version let
  the correct one through so the owner could never be locked out, and that made the
  throttle decorative: a guesser got 429 for a miss and 200 for the hit, at full speed.
  Anybody can now keep Ric out for five minutes by hammering `/auth`; that is the
  accepted price. A request with no credential is never throttled, and a lockout is a
  429 that says so, never a 200 with the private notes stripped. `assets/owner.js` tells
  him "wait five minutes" rather than "that is not it".
- **Only runs tick, and only sessions that match them.** Board sessions are already
  pulled properly onto the climbing page — a watch ticking climbing too would
  double-count the site's one real source.

**Garmin is pulled from a button, and none of it is public.** "pull Garmin" on the training
page (signed in) asks the Worker to start `.github/workflows/garmin.yml`, which pulls sleep, HRV,
resting HR, readiness and every activity and POSTs them to the Worker's `/garmin`, one of
the three routes that need a token to *read* — with `/garmin/session` (Garmin's parked
login) and `/stats` (the visitor counter). A new route is public to read only on purpose. The Actions log is public, so that job commits nothing, caches
nothing and prints no values. A Claude session reads it with
`GARMIN_READ_TOKEN` (the `garmin` skill). Never write that export, or anything derived from it,
into this repo. Its README has the rest.

**Entertainment is written from the page, and falls back to this browser.**
`entertainment.html` and `entertainment-library.html` read
`projects/entertainment/entertainment-data.js` — 363 titles, each `watched` or
`watchlist` — with the Worker's `/movies` and this browser's `localStorage` merged on top.
**Its full rules are in [`projects/entertainment/README.md`](projects/entertainment/README.md);
read them before touching the room, its data file, its puller or `/movies`.** The data
file has lost rows three separate times and every rule there came out of one. The ones
that must never break:

- The committed file always renders on its own; the two layers are merged at read time.
  Don't delete the local layer — it holds edits made with no signal.
- A write to `/movies` is a PATCH: the Worker applies only the keys it was sent and never
  invents a value. A removal is a tombstone (`{ removed: true }`), never a delete.
- `entertainment-data.js` is strict JSON, parsed and never pattern-matched, and
  `write_rows` refuses to write anything it cannot read back. Don't reintroduce a
  regex reader.
- `FIELDS` in `pull-entertainment.py` and in `assets/entertainment/room.js` must match.
- **Never alphabetise the watched block** — its order is the order he watched them, and
  the only record of it.
- Identity comes from an id, never a title. A hand-set `wd:` or `tmdb:` is never
  overwritten, and the titles he left as typed (`Curtis`, `Moments`, …) are not to be
  "fixed" without asking him.
- Posters are downloaded and committed, never hotlinked. The chooser's Wikipedia
  thumbnails are never committed.
- The page never holds a GitHub credential; the doorbell is `POST /movies/_pull` on the
  Worker. Never set `cancel-in-progress` on the entertainment workflow and never add a
  second workflow that writes the data file.

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

**CS is pulled from Valve, and only while the game is open.** `cs.html` reads
`projects/cs/cs-data.js` plus `projects/cs/matches/<id>.js` replays. Rules
(`projects/cs/README.md` has the rest):

- **Replays go to R2, not git** (2026-10-17). Ric expects thousands of games;
  at 0.3-0.9 MB each they would pass Pages' 1 GB in a few hundred. The page
  loads `/cs/replay/<id>` from the Worker first and the repo copy second;
  `upload-replays.py` (sync step 7) sends and verifies them, and `--move`
  untracks `matches/` once R2 has every one. Never commit a replay after that,
  and never let the Worker's PUT take anything but the replay file's shape.
- **The win chance is shown only as finely as it has earned.** `winprob.check()`
  scores it on held-out games and sets `wp.step` (5% until it's within 2 points
  on 2,000+ moments). Don't print a chance with more precision than `step`, and
  don't add an input the held-out check doesn't keep. The death labels say what
  was measured; "Lost the duel" is "none of the others found", never "fair".
- **Nothing runs between sessions.** `cs-session.pyw` is CS2's Steam launch-option
  wrapper: it starts the game first, listens for Game State Integration on
  `127.0.0.1:3010`, runs `sync.py` every 30 minutes until `cs2.exe` closes, syncs once
  more and exits. Don't turn it into a login task or a service — Ric asked for exactly
  this.
- **The archive only grows.** Valve deletes demos after a few weeks; `cs-data.js` is the
  permanent record and no script removes a match from it. Sources merge on Valve's
  match id, else on map + score + Ric's K/D.
- **Other players are shown by in-game name** — Ric decided this on 2026-10-13,
  since Leetify and the public stats sites already show them. Steam ids and share
  codes still never reach the committed files (a share code downloads the whole
  demo). This is CS only; Apex's LiveAPI rule is unchanged.
- Raw demos, the venv, `cs-account.json`, `.cs-state.json` and the GSI spool are
  gitignored. Steam Web API secrets live in Windows Credential Manager.
- `sync.py` commits the room's data only, on `main`, and **pushes those commits**
  (Ric's call, 2026-10-14: a session should reach the site by itself). It pushes
  nothing if any unpushed commit touches other files, and `"push": false` in
  `cs-account.json` turns it off. VALORANT's sync pushes the same way since
  2026-10-29 (Ric: "VAL pushes like CS") — its unpushed commits used to switch
  this one off. A failed
  step, commit or push — or a push held back — raises a Windows toast
  (`notify.py`); the log is otherwise the only place it shows.
- **The radar is the game's own.** `extract-radars.py` unpacks CS2's radar images and
  overview calibration from the local game files with Source 2 Viewer's CLI (in
  `projects/cs/tools/`, gitignored) into `projects/cs/radar/`. Rerun it after a map
  update. Two-floor maps (Nuke, Train, Vertigo) keep height in the tracks and pick the
  radar floor by the game's own altitude split; the replay's floor setting defaults to
  Auto, following whoever the camera follows (else Ric), and everyone on the other
  floor is drawn at 45%. The old "footsteps" floor plan (drawn from where players stood)
  is a setting, off by default — Ric asked for it that way.
- **The replay follows someone.** Its ⋮ menu (all the replay's settings live there)
  picks Bomb or Player, the player from a dropdown. The default is the page you came
  from: a player's page follows them, the Overview follows Ric, anything else the bomb.
- **Kill snapshots** are every kill and death of Ric's, drawn from the same fight data:
  positions and facing on the radar, everyone's HP / armor / weapon, smokes and fires
  in the air, who was flashed, the bomb. Anything added to them belongs in the text
  export too (`in the air:` / `everyone at that moment:` lines).
- **The bomb** is a per-round timeline from Valve's own events (`bomb.timeline`:
  pickup, drop, plant start, planted, defuse start with kit or not, defused,
  exploded). `bombAt()` on the page and `bomb_at()` in the export replay it to any
  moment with the same rules (3.2 s plant, 40 s fuse, 5 / 10 s defuse); keep the two
  in step.
- **A held map always fills its frame**: the view is clamped to the radar, so zooming
  out near an edge slides back over the map rather than opening empty space.
- **Stats are sliced in the browser from `stats.js`**, which `stats.py` writes from
  the replays on every sync (called by `export-llm.py`; `sync.py` commits it). Its
  breakdown also lands in `llm/index.md`. Career numbers on the page count ranked
  games only — a custom Rush or casual lobby stays in the match list but not in
  the averages.
- **LLMs read the plain-text copy.** `export-llm.py` writes `projects/cs/llm/*.md`
  from the same data on every sync, and `/llms.txt` points at it. Anything new the
  page shows should also land in that export, or machines only get half the room.

**CS2 demos download themselves through a bot account.** `projects/cs/fetcher/`
signs a second Steam account into Valve's game coordinator to turn share codes into
demo links. Never point it at Ric's own account (it would kick him from his game),
and never store the bot's password: `login.mjs` keeps only Steam's login token, in
Windows Credential Manager.

**VALORANT is read from Riot's own client, only while the game is open.** `val.html`
reads `projects/val/val-data.js` and `matches/<id>.js`; `projects/val/README.md` has
the rest. Rules:

- **Not an official API, by Ric's choice.** VALORANT has no personal keys, so
  `riot.py` uses the signed-in Riot Client's local endpoints: GETs only, for Ric's own
  matches, with a token that is never stored. No game memory is read (Riot blocks that
  from 2026-10-06). Don't add writes, don't call other players' histories, and don't
  persist the token.
- **The desktop shortcut is the trigger** (`VALORANT + Terminal`, made by
  `install.py`); the Riot Client has no launch-option wrapper. Nothing runs between
  sessions, and a missed session costs nothing because Riot's history is caught up on.
- **Other players are shown by agent, not Riot ID** — VALORANT stat sites only name
  players who opted in. `show_others_names` in `val-account.json` is the switch; it
  defaults off. `raw/` (every player's account id) stays gitignored.
- **Every position is stored three ways**: game `x, y`, minimap `u, v`, and the nearest
  Riot callout — the page draws on the real minimap, and `llm/maps/<map>.md` gives an
  AI the callout table and the transform. Keep all three in anything new.
- The archive only grows; `sync.py` commits the room's data only and pushes those
  commits as the CS sync does (2026-10-29, bug sweep B6-4); `"push": false` in
  `val-account.json` turns the push off.

**The front door (home since 2026-10-17).** It went live as `index.html` on 2026-10-16,
was moved back out to `frontdoor.html` the same day while it was worked on, and became
home for good on 2026-10-17 (Ric: "make the front door the main page"). The terminal
moved to `terminal.html`; `frontdoor.html` is now only a redirect home. From the terminal,
`front door` / `home` or the **[ HOME ]** box in the corner of its frame come back here. It does not run the terminal, it hands it commands: on a desktop the bar carries a
piece of the terminal's own screen (black glass, amber `#ffb000`, scanlines) — a `~$`
prompt and a **TERMINAL** key (Ric, 2026-10-17). What is typed there **runs right
there** (Ric, 2026-10-17: "it shouldn't move you to the terminal first. Like mochi"): the
terminal sits in a hidden frame (`terminal.html?embed=1`, loaded the first time the prompt
is touched) and answers in a panel under the bar. In that mode `terminal.html` does nothing
itself — every way it leaves the page goes through `goTo()` / `reloadPage()` / `goBack()`,
and `RELAY_CATS` / `RELAY_EFFECTS` are stand-ins defined before `effects.js` (which then
stands down) — all of it is posted up to the front door, which navigates, wakes Mochi or
sets the trip mode on itself. Messages are checked for origin and source both ways, and
`assets/visit.js` never counts a framed page. **Navigate in the terminal only through
`goTo()`**, or that command will move the hidden frame instead of the visitor. A post's
name goes straight to its page; Enter on nothing opens the terminal; `/` focuses the
prompt. If the frame never answers, or with JS off, the command goes to the terminal as
`terminal.html?run=<command>` (run once, as if typed, address cleaned). Don't put it in `ROOMS`, `PROJECTS` or
`latest.js`.

On a phone the terminal waits behind the last tab of the bottom bar and rises above it
when tapped; what it answers opens above that.

**A portal since 2026-10-30.** The torn-paper feed of every room (2026-10-16 to -29) was
replaced after a long round of mockups (`docs/mockups/`, kept for the record): Ric found the
scroll too long ("the scroll thing just takes too long"), wanted people to find what they
want "when they dont even know what they are looking for", and set the rules below. Read
them before changing anything on this page.

- **Most used first, always, measured.** Ric: "the most used page always is on top … if a
  new page gets more popular it automatically goes to the top". The Worker's `/popular`
  (worker/README.md, "Most used first") is the order pages were used in over 30 days —
  people, not views, his own devices out — and the page sorts by it: the subject shelves,
  the rooms in each, the desktop index, the big feature (whichever room is first; Weather
  gets its own version with the visitor's sky and a Pro link) and the phone's bottom bar
  (the top four rooms, then Terminal). It sorts by the order saved on the **last** visit
  (`fd:popular` in localStorage), so nothing moves while someone is looking, and fetches a
  fresh one for next time. With no saved order, the order in `SHELVES` stands — measured
  from the visitor counter on 2026-10-29; the counts are in the comment above it. Don't
  hand-order the page by feel.
- **The quick stats under the title** (Ric: "simple info like the weather, my last run, my
  last cs game and latest update … at the top easy to see", then "too many words … under
  the title", then "i dont like the boxes"): Last run (Strava), Last climb (the newer of
  `latest-climb.js` and the days logged from a phone through the log service, never a
  "Home" day — `latest-climb.js` alone stops at the last build, and once said "3 months"
  when the last climb was three days ago), Last CS game, Newest (the top of `latest.js`).
  A run or a climb counts as an update (Ric: "if strava or climbing get updated that counts
  as an update"): whichever of the three is newest wears a small "new" by its label, so
  nothing is listed twice. One quiet line on a desktop, a 2×2 on a phone; no boxes.
- **Right now:** the most used room as the big feature, then today's game to play, tonight's
  film from the watchlist (the same pick all day), and something to explore — each a piece
  of its own room (the cinema's bulbs, the game running) — plus a crag day or Orrin only
  while fresh (three weeks; running). Play and Explore never repeat the feature. The film
  list is the Entertainment room's whole file, so it is fetched after the page is up.
- **Phones and desktops are laid out separately, in one style** (Ric: "optimized for phones
  and desktop separately but still the same style"). Desktop (≥1000px): every room down
  the left from the very top, staying put, in words (NN/g: visible, left, most important
  first); the name beside the stats, their last lines measured onto one line; a grid with no
  holes; up to 1,720px wide on a big monitor; a card's clip plays after the pointer settles
  for 0.3s, only the big card on a shelf plays by itself. Phone (≤760px): a bottom bar under
  the thumb; the right-now modules in one swipe row (three items, inside the 3–4 swipes
  people give one); every room as one list row with a still thumbnail — never a clip or a
  1600px photograph for an 88px picture (`assets/frontdoor/thumbs/`, stripped like every
  photo, hard rule 1).
- **Nothing that looks generated** (Ric: "i dont want it to look like an ai built it"): no
  pills with dots, glowing rules, numbered headings, letter-spaced capitals, soft glows,
  hover lifts, floating badges or tickers. The rooms bring the colour — their clips,
  drawings, posters and papers (`data-skin`, every one checked for 4.5:1). Plain words, few
  of them: each room says in two to four words what it is (`what` on its `POSTS` entry —
  "space game", "Star Wars watch-along"), because the names alone mean nothing to a
  stranger.
- **What a picture shows is the room working, never a screenshot**: the clips recorded by
  `assets/frontdoor/record.mjs` and the Arcade's, and the painters in `ART` drawing from
  the rooms' own data. **No real place is ever drawn** — Training's route and ATLAS's map
  are invented (hard rule 1).
- **Which rooms**: every room and the sub-pages that stand on their own, on exactly one
  shelf. The Log is off (Ric, 2026-10-29: "the log shouldnt be on there"). HERMISCUS, the
  private tools (admin, visitors, account), Climbing's Add page and the KONDRITE listening
  booth stay off — and `/popular` never lists them either. Mochi, the 404 page and the trip
  modes stay off. `.github/test/frontdoor.mjs` fails if a room is on no shelf or two, has
  no words, points at a page or picture that isn't there, is missing from the `<noscript>`
  list, or if the Log comes back. When something new ships, give it a `POSTS` entry with
  its `what`, put it on a shelf in `SHELVES` and in the `<noscript>` list — `/popular`
  moves it up as people find it.
- **Measure it.** What visitors open next from the front door is the test of this page.
  Baseline, the old feed, 90 days to 2026-10-29: left without opening anything 29, reloaded
  23, Weather 14, the terminal 9, CS 5, Training 3. The query to rerun is in the comment
  above `SHELVES`.

Homepage "transmissions" live in `notes.js`. Curated newest additions live
in `latest.js` and are announced in exactly one place: "Newest" in the front door's quick
stats (`index.html`), and the terminal's `latest` command opens the newest. The terminal
itself carries no banner and no welcome copy any more (Ric, 2026-10-17: "remove the
notifications") — it boots straight to the shell; don't put either back. Every room used to carry one in its own native style; they don't any
more, so an addition is not repeated eight times. The per-room support is still in
`latest.js` (`data-latest-room` for a room's own wording, `data-latest-skip-linked`
to pass over an item the page already links to outside its `<nav>`) — if a room
takes a banner back, use it. Give each entry the `room` it belongs to and **keep that
value right when a project moves** — KONDRITE, FARLIGHT and Starfield sat filed under
`workbench`/`exploration` for weeks after moving to Gaming, which was harmless only
because no room carried a banner; they say `gaming` now. `latest.js` is also the thing
that goes stale quietest: the Gaming room, the KONDRITE campaign and ATLAS all shipped
without an entry and the front door announced older things over them until 2026-09-24.
If you ship something family would care about, put it at the top of that list the same
day. `orrin.html` is self-updating — leave its GitHub data logic
alone unless fixing a bug. Its "HEADS UP — this page is generated by an LLM" banner came
off on 2026-10-22: Ric read the page through ("I have looked into it"). Don't put it back;
if a later rewrite needs checking, ask him rather than warning visitors. Its PROGRESS NOTES region is the one written part: `orrin-updates.js`, newest
first, plain English, appended after each Orrin run or build by
`scripts/site_update.py --publish` in the orrin_v3 repo. That script pushes only
its own note (a commit on top of `origin/main` in a throwaway worktree), so it is
the one thing allowed to publish without waiting for the rest of the checkout.
`.github/test/orrin-updates.mjs` checks the shape; `href` must stay inside
`ric-massey/orrin_v3` (hard rule 2).
Its IS ORRIN RUNNING? region reads the `orrin-status` Worker (`projects/orrin/server/`,
deployed 2026-10-06). The producer that feeds it is `projects/orrin/producer/push_status.py`:
it runs on the Orrin machine, reads his state files read-only and pushes once a minute
with the token in `~/.config/orrin-status/token` (never in this repo). It needs a named
User-Agent (Cloudflare bans `Python-urllib`, error 1010) and a CA bundle (python.org
builds ship none) — both handled in the script. `systems.html` and `updates.html` are legacy redirects, not
rooms.

**Weather is asked live, and the place is the visitor's.** `weather.html` reads
nothing committed: `projects/weather/wx.js` asks Open-Meteo, the NWS, SPC and Iowa State
(NEXRAD tiles, scan lists, weather balloons), through the Worker's `/wx` route first and directly if that fails — the
Studies pattern, and the second room to make external requests by design. **Read
[`projects/weather/README.md`](projects/weather/README.md) before touching it;
[`projects/weather/DESIGN.md`](projects/weather/DESIGN.md) is Ric's plan for the whole
room and the source of truth for what gets built next.** It went public on 2026-10-21
(Ric: "do all of it" — listed in `ROOMS`, in every room nav, a tier-0 post on the front
door drawn by the `radar` painter over invented ground, and top of `latest.js`). The
ones that must never break:

- **Two pages, one room** (Ric, 2026-10-21): **Weather** (`weather.html`) is what most
  people want — now, the next hours, ten days, a plain radar; **Weather Pro**
  (`weather-pro.html`) is the full map, soundings, models and the record. They are
  **two products with two looks** (Ric: "like two different products"): Weather is
  the sky, with a gold ★ Pro badge in its top bar; Pro is a dark, monospaced
  instrument with one blue accent (Ric, 2026-10-23 — amber fought the radar's
  own oranges; it now means only "late"), set in IBM Plex Sans and Plex Mono
  (Ric, 2026-10-23: "shipped with the site" — the woff2 files and their OFL
  licence are in `assets/weather/fonts/`, served from this repo, never a font
  CDN; only Pro names them, so Weather never downloads them) and ← Weather to
  go back. Don't bring back a shared tab switch
  or style Pro like Weather. Both load `assets/weather/app.js` and
  `assets/weather/weather.css`; each page holds only its own cards. **Warnings and
  storm mode stay on both** — never move them to Pro only. On Pro a warning may be **folded**
  to a red bar over the map (2026-10-24) — never hidden, never saved, and opened
  again by any upgrade; don't add a way to dismiss one. **Pro has one bar above
  the map** (2026-10-23): its place bar is moved into the site's bar, and its room
  nav is the menu button at every width — same rooms, same labels inside. Don't
  add a second row of controls back; fold new ones into the workspace menu or ⋯
  (`projects/weather/README.md`, "One bar, not three"). **Every corner in Pro is
  square** (Ric, 2026-10-23: "an instrument to use") — no rounded corners, soft
  shadows or gradients; don't add any back. Pro is a tab of the
  weather room, not a room: it is not in `ROOMS` or the room navs.
- **Pro's workstation** (`assets/weather/workstation.js`; `projects/weather/WORKSTATION.md`,
  built 2026-10-23): the maps beside the main one are Pro itself in a frame
  (`weather-pro.html?panel=1`), showing only its map, all on one shared place and
  time. A panel writes nothing to localStorage — the page owns the layout. A
  workspace holds layers, maps and cards and **never a place**; a share link adds
  the main map's view only when the visitor ticks it (`test/workstation.test.mjs`
  checks both). A workspace cannot hide a warning. `workstation.js` loads before
  `app.js`, because a shared link's layers must be in the address when the map
  starts. Only the visitor's own steps in time move the other maps (`userShow` in
  `app.js`) — never tell the bus from code that runs when something loads.
  A panel fetches nothing it can borrow: it asks its page through `fromPage`
  (`app.js`'s `SHARE` table, 2026-10-27), so a new fetch a panel makes goes
  into `SHARE` too, and on a phone the maps are one at a time behind tabs.
- **Weather speaks plainly, Pro technically** (2026-10-23, Ric: "1 and 2"). On
  Weather the source of every number is still said, in plain words —
  measured / forecast / worked out, a station by its name — and Pro keeps
  station / model and the codes. Don't drop the words on Weather (the room's
  rule: every number carries its source and age); change them only to plainer.
- **Weather's radar reads like Apple's, Pro's like the NWS's** (2026-10-23, Ric:
  "On my app it should be closer to the Apple one … just have to click it for it
  to go full screen … easy to see where it's raining"). On Weather the mosaic is
  redrawn from IEM's exact palette into one Light → Extreme ramp (`rainTile` in
  `app.js`), one zoom finer and softened into areas; the map is **rain only** —
  warnings (on by default), the outlook, temperatures and clouds are in its layers
  menu (`R.wl`), never switched on by the page. Turning Warnings off takes away
  the warnings *around* the place, never one in force *at* it — storm mode's own
  warning is always drawn (bug review, 2026-10-23). City temperatures are the one
  overlay on by default besides warnings; the timeline runs an hour past now on
  the room's own nowcast (rain only, labelled "forecast", the same `motion()` and
  `SETTINGS` the nightly grade holds — change one, the other follows); the place
  is an Apple-style "My Location" round; and a tap on the small map opens it
  full screen. Don't put the NWS colours, a filled or automatic outlook back on
  Weather, and don't bring the Apple ramp to Pro.
- **Pro's map comes first** (2026-10-23, Ric: "make it cleaner and easier to use
  for the professionals"). Above the map there is one row of kinds (with Replay,
  Overlays ▾ and Info) and at most the chosen kind's own row; overlays go in the
  Overlays menu, prose goes behind Info, the stamp is on the map. Don't add a row
  above the map — put a new control in the kind's own row or a menu. **Pro is a
  map app** (2026-10-23, Ric: "The map needs to cover the whole page … they all
  have the map covering the entire screen"): the map fills the window under the
  site's bar (`--tb`, measured) and one row of place and workspace controls that
  scrolls sideways, never wraps; the map's own toolbar floats on it (`--ctlh`);
  the readouts are a drawer (**Readouts**, or D) docked beside the map from
  1200 px and over it below, **closed until the visitor opens it** (2026-10-25,
  Ric: "still feels kinda crowded"), with the alerts counted on its button; the
  page's settings sit behind ⋯ at every width; storm
  warnings float over the map. The page never scrolls. Don't put a card back
  under or beside the map in the page's flow.
  The maps beside it, and the main one when they sit side by side, are
  map-first: their controls live behind each map's Layers button (2026-10-23,
  Ric: "Do all 11 plz"). Times can be UTC (`wx:utc`) — keep new times on `clk()`
  so the switch reaches them.
- **A failed alert check is never silent** (2026-10-23, after an outside check
  of Pro). If the NWS does not answer, the alerts card says so at the top and
  the storm warnings come from Iowa State's copy of the NWS's feed
  (`Wx.alertsBackup`), marked as such; an NWS outage is never "outside the US"
  and IEM's cells down is never "no storms". Radar age is the time inside the
  newest file, not its name. Don't hide the card on a failure or drop the backup.
- **Pro is both** (Ric, 2026-10-24, asked whether it should be the deepest
  meteorology workstation or a universal one for every kind of work: "the
  answer is both"). Build both ways inside the one app — Explore and the
  workspaces, not a separate app per job. `projects/weather/WORKSTATION.md`.
- **A visitor's files and watches stay in their browser.** A GPX, KML,
  GeoJSON or placefile opened on Pro is read there (`route.js`) and kept in
  localStorage; it is never sent, logged or committed (hard rule 1). Watches
  (`watches.js`) are checked only while the page is open, say so, and are
  never a warning service — official warnings stay the NWS's.
- **No go/no-go verdicts.** A ride outlook was built and removed the same day — Ric:
  "this should be information, not something that could make it unsafe." Don't add
  one for riding, driving, flying or anything else; `test/wx.test.mjs` checks.
  That includes **Weather's climbing card** (Settings → Show → Climbing,
  2026-10-25): Ric — "I don't want good or bad to go. Just the measurements
  climbers would care about." Numbers only; the test reads its code for verdict words.
- **Weather's scenes** (`assets/weather/scene.js`, 2026-10-25): a picture behind
  the page with the live weather drawn over it, chosen in Weather's settings
  sheet. Real photographs, not drawings and not AI images (Ric: "scenes as in real
  pictures"), committed with their credit and their metadata stripped (hard rule
  1), never hotlinked. The weather happens *in* the picture, not over it (Ric:
  "if its cloudy the picture should have it be cloudy … if its windy it should be
  kicking up dust"): cloud fills each photo's own sky through its `<id>-sky.png`
  mask (`assets/weather/scenes/scene-maps.py`: a segmentation model run
  offline, edges refined and decontaminated — never go back to a colour rule,
  it put sky over mountains), low cloud takes the tops, fog
  thins with distance by the measured visibility, wind blows what that ground
  gives up, a thunderstorm brings strokes down to the land. Day, twilight and
  night come from the sun's real height at the visitor's place, and the sun and
  moon (its real phase, lit side as seen from that latitude) are drawn where
  they are (`assets/weather/astro.js`, held by `test/astro.test.mjs`). The
  pictures live too: the sea and lakes move, the city's windows light floor by
  floor after dark and its towers blink red (maps from `scene-maps.py`). **The sky
  is real time-lapse footage** (`assets/weather/skies/`, made by `make-skies.py`
  from Commons clips, PD or CC BY, credited) — Ric: "i dont want people to be
  able to tell they are ai generated. and they have to move". Never swap it for
  generated imagery or video. Nothing in a scene may give itself away as made:
  photos and clips come from the original files, never Commons' recompressed
  copies, clips are never motion-interpolated or stretched past their source,
  and no sky is under 1920 × 560 (Ric, 2026-10-26: "make them higher quality
  remember no ai should be able to tell an ai did it"). Each photo also has a depth map and an overcast
  relight (`scene-maps.py`): haze and fog by real distance, cloud shadows and
  sunlit patches on the land, sun beams from a low sun (never on near land),
  the overcast photo faded in under grey skies. The footage plays at the
  wind's speed — 1/16 of its own up to a breeze (Ric, 2026-10-26: "5 mph and
  the clouds are moving a million miles per hour"); don't speed it back up. The photo is drawn by a
  WebGL layer (plants sway, depth parallax, water and swash, seasons, wet and
  snowy ground) from more maps; lightning, the Milky Way and the moon are real
  photographs (`make-night.py`). Don't go back to dimming
  the photo for cloud, or to a clock for the light. The weather drawn is only what the hero's reading says —
  `WxScene.preview()` is for looking from the console and the page never calls
  it; "Moving weather" off and reduced motion draw a still frame. Weather only —
  Pro keeps its instrument look. A Mochi scene waits on Ric.

- **No place in the repo, ever (hard rule 1).** The visitor's own location or search,
  kept in their localStorage, rounded to two decimals before anything is asked — the
  Worker refuses finer. No default location, no coordinates in tests (the live test
  finds places by name), and the personal weather station in DESIGN.md §19 waits on
  Ric's call because its position cannot be committed.
- **Every number carries its source and age**, observation versus model is labelled,
  and a feed past its `STALE_MS` says "delayed". Official alerts are shown as the NWS
  issued them, never rewritten.
- **`ROUTES` in `wx.js` and `wxUpstream` in the Worker must agree** —
  `test/wx.test.mjs` runs every request the page makes through the Worker.
- **Storm mode's distances and arrival times are the warning's own motion carried
  forward**, shown only beside the warning and always called an estimate. Never
  derive one from radar or let one stand in for the warning.
- **Clutter filtering never hides a strong echo** (2026-10-24). Pro's single
  radar can show reflectivity raw, filtered or with non-weather marked grey,
  judged by the radar's own CC — but a gate at 30 dBZ or more is always kept,
  because a tornado's debris has low CC too. Raw is Pro's default. Read the
  rule in `projects/weather/README.md` before touching `NX.CLUTTER`.
- **The sounding arithmetic (`sounding.js`) is held to MetPy** in
  `test/sounding.test.mjs`; change the physics and the pinned comparison together.
- **The scoreboard publishes no coordinates** — stations by airport id only, positions
  read at run time (`verify/score.mjs`; `test/verify.test.mjs` checks). The page uses
  its blend only where the nearest station's record shows it beating the standard
  forecast; never present the blend, or any accuracy figure, beyond what the record says.
- **The room's own predictions are graded before they are shown.** The blend,
  the learned forecast, or a model the page holds hourly (the NWS National
  Blend, HRRR, …) replace the standard temperatures only where the nearest
  station's record says so (`Wx.verdict`); a model it cannot draw (Pangu) is
  ranked, never shown; the learned forecast is
  scored only on days it had not learned from. The radar nowcast is rain timing
  only, never storm arrival, and `verify/nowcast.mjs` grades it with the same
  code and `SETTINGS` the page uses — change one, the other follows. Our AI run
  (`weather-ai.yml`, Pangu-Weather, non-commercial weights) commits nothing.
- **`weather-sw.js` is the site's only service worker**, scoped to `./weather`. Keep it
  network-first and same-origin only; never widen its scope to the rest of the site.
- **Pro reads NOAA's raw files in the browser** (Ric, 2026-10-22: "do the three",
  then "do it", then "do it" again for what the professional sites have). The
  radar's Level III products, full Level II volume and Level II archive, MRMS,
  GOES lightning and imagery, and HRRR / GFS / GEFS fields come from NOAA's public
  buckets on AWS (`unidata-nexrad-level3`, `unidata-nexrad-level2-chunks`,
  `unidata-nexrad-level2`, `noaa-mrms-pds`, `noaa-goes18/19`, `noaa-hrrr-bdp-pds`,
  `noaa-gfs-bdp-pds`, `noaa-gefs-pds`), and ECMWF's IFS and AIFS from ECMWF's
  open data on Google Cloud (`storage.googleapis.com/ecmwf-open-data`) with its
  AWS copy (`ecmwf-forecasts`) as the fallback — AWS's throttled with 503s that
  carry no CORS header, so don't swap the order back. They are decoded by
  `nexrad.js` + `bzip2.js`, `level2.js`, `mrms.js`, `glm.js`, `abi.js` and
  `grib2.js` (CCSDS and the RAP's rotated grid included) + `modelmaps.js` — written here, no library.
  bzip2 runs off the main thread: `bzip2.js` is its own Web Worker, and page
  code reads radar through `Nexrad.load` / `parseAsync` and `Level2.feedAsync` /
  `stream` — never the sync `parse` / `feed`, which froze Pro for seconds a
  volume (`docs/notes/weather-pro-audit-2026-10-27.md`).
  ECMWF's data is CC BY 4.0: the map's corner credits ECMWF whenever its fields
  are shown (`#eccredit`); keep it. The **mesoanalysis** map layer is the HRRR's
  analysis hour, not SPC's — never label it SPC's; SPC's own images are the
  separate card. **The server mesoanalysis** (`projects/weather/meso/`, Ric,
  2026-10-22: "Do it plz") is made SPC's way — the RAP's one-hour forecast,
  NOAA's RTMA at the ground, every column through `sounding.js` — by
  `.github/workflows/meso.yml` (or AWS Lambda) and PUT to the Worker's `/meso`
  with `LOG_TOKEN`; the Worker keeps a day in R2. It is still not SPC's: say
  "SPC's method", never "SPC's". Its files are never committed (hourly model
  output does not go in git), its workflow prints no value and never the
  token, and the page falls back to the browser's when the server has nothing
  from the last three hours. `meso/README.md` has the measured difference. Where a field approximates SPC's (effective shear from the
  standard levels, DCAPE on five levels, STP with the surface parcel's LCL) the
  label says so; keep that honesty if you change one.
  Each is held to MetPy, h5py, pyproj, ecCodes or Python's bz2 in `test/decoders.test.mjs`
  on real files in `test/fixtures/`; change a decoder and its expectations together
  (`fixtures/make-expected.py` regenerates them). Those buckets are the weather
  room's other external hosts. **Pro's map lines** (state, county, coast and
  border lines and town names, drawn over the data — `mapgeo.js`) are Natural
  Earth's files, fetched from its tagged release on `raw.githubusercontent.com`
  when the page runs and cut down in the browser; that is one more of the room's
  hosts. They are never committed: this room keeps real coordinates out of the
  repo even for public airports, and the map lines follow that. Not through the
  Worker either — it is on the free plan, and the 8 MB county file is far past
  the CPU a request gets there. **Pro's terrain** (Ric, 2026-10-24: "Geological
  and elevation layers?" then "Both") is the open Terrain Tiles on AWS
  (`s3.amazonaws.com/elevation-tiles-prod`, USGS 3DEP and SRTM), decoded and
  shaded in the browser by `terrain.js` — one more host, fetched while the page
  runs and never committed, for the same reason as the map lines. It is shadow
  and light only, never a colour that could be read as radar; its credit is in
  the map's corner while it shows. Geology was looked at and not built: little
  for a forecaster, and its sources could not be checked from here.
  **The UKMET** (2026-10-24) is the Met Office's open NetCDF on AWS
  (`met-office-atmospheric-model-data`, CC BY-SA 4.0 — `#ukcredit` in the map's
  corner whenever it is shown; keep it), read by `glm.js`'s HDF5 reader; one
  more of the room's hosts. ECMWF's ensemble products come from the same open
  data as the IFS. **ERA5** (2026-10-24, `reanalysis.js`, Models → ERA5) is
  NSF NCAR's copy of Copernicus's reanalysis on AWS (`nsf-ncar-era5`, CC BY
  4.0 — `#eracredit` in the map's corner whenever it is shown; keep it): any
  hour since 1940, read for the map's window only. It is always labelled an
  analysis, never a forecast, and its pressure levels (43 MB an hour) are
  drawn every 6 hours and never cached; one more of the room's hosts.
  **Colour tables and satellite recipes a visitor makes** (`colormaps.js`, GR
  `.pal` files; `abi.js` recipes) stay in their browser and are never sent or
  committed; a recipe rides in a share link only as its numbers. **The 3D
  radar** (`radar3d.js`) is WebGL, built into the browser — no library; keep
  it that way. **A workspace sets the whole main map** (2026-10-24): `apply()`
  runs `completeLayer()`, so a preset that leaves a key out gets the default,
  never what was there before; every preset keeps a true "Not here: …" note
  (`PRESET_NOTES`) — don't present a category as more complete than it is.
  Compare and Trend close the readouts and say the field once. Every fetch to a
  data host goes through `guarded()` (30 s to answer), and a GRIB2 message or
  HDF5 chunk shorter than it says is an error, never a drawn field.
  **Compare sets like beside like** (2026-10-24): a
  model joins only if its field shows the same thing (`MM.signature`) under the
  same name (`comparable()` — surface and most-unstable CAPE share colours, not
  meaning); a
  quantity a model does not publish is worked out from what it does and
  labelled so. Don't pair fields by id alone — the weather README has why. **Dealiasing is off by default and full volume only**, and
  the radar cross-section never fills the gaps between tilts — both rules
  are in the weather README.
  Lightning is GLM *flashes* — never call them strikes.
  Flash density, a cell's flash rate and the lightning jump (`glm.js`, Schultz et
  al.'s 2σ method) are worked out from those flashes in the browser; the jump is
  an indicator, shown as one, never a warning or a verdict.
  A storm report is shown as the office issued it and the card says it is a report,
  not a verified event. The severe composites are SPC's published formulas (the
  fixed-layer STP; the supercell composite is labelled an approximation because
  its layers are fixed, not effective), and the storm probabilities are a
  time-lagged HRRR ensemble — HREF is not openly available; don't call it HREF.

**One account for the whole site lives in ATLAS's Supabase project.** Since
2026-09-23 anybody may sign up at `account/` (terminal: `login`), the account
arrives as a request, and Ric approves it and ticks which pages it opens —
ATLAS, HERMISCUS and Studies' trial alerts today. The lock is `has_page_access()` in the database;
`assets/site-gate.js` is what a page asks. Read "The door" in `atlas/README.md`
before locking another page: a gate cannot hide content that is committed to
this public repo, only content kept in the database behind that function.
`account/` loads supabase-js from unpkg, as ATLAS does; that is the same
exception, not a new one.

**ATLAS (`atlas/`) plays by its own rules and has its own README.** It is the one part
of this repo that is an application rather than a page: Supabase, a real login,
row-level security, migrations in `atlas/supabase/migrations/`, and a test suite in
`atlas/test/`. Read [`atlas/README.md`](atlas/README.md) before touching it, and
remember hard rule 1: code here, places there. `map.html` is only the door. Two things
about its tests: `site-accounts.test.mjs` is the only suite that runs the policies
against a real Postgres and it skips without a local Supabase, which is every CI run —
`checks.mjs` prints it as `skip`, not `ok`, so nobody reads that line as proof. The
static `security.test.mjs` therefore also reads the migrations as Postgres would apply
them and fails if any table that holds places loses its restrictive
`has_page_access('atlas')` policy — deleting the one on `pins` used to leave every
suite green. And there is no `atlas/schema.sql` any more: it was a copy of the first
migration marked "safe to re-run", and re-running it would have put the original
`crew reads pins … using (true)` policy back over the private-pin one.

## House style

- Match the existing voice: playful, terminal/hacker flavor, easter eggs welcome
  (e.g. hidden terminal commands in `terminal.html`: `orrin`, `apex`, `sudo`, `coffee`, `exit`).
- Keep every easter egg discoverable in `EASTER_EGGS.md`. Sitewide visual modes belong
  in `effects.js`; preserve the reduced-motion fallback, room-to-room persistence,
  refresh-to-reset behavior, and the `sober` terminal command. Do not add a visible
  reset button or Escape-key exit unless Ric asks for one.
- **Mochi has three worlds and they are room-aware, not global.** Ordinary rooms get the
  walking resident. `climbing.html` swaps him onto the wall — he grabs the side edges of
  the page's own features, steps up them, turns, hops, plays and falls
  (`assets/cat/relay-cat-climb-*.png`). Starfield and KONDRITE put him in a bubble helmet in
  zero gravity (`data-mochi-world="space"` on the `<html>`). KONDRITE also carries
  `data-mochi-only`, which makes `effects.js` bring the cat and none of the trip modes,
  and its page makes him click-through while `body.flying`. Each set has its own sprite list in `CAT_FRAMES` and its own per-frame
  offset/scale tuning in `CAT_FRAME_X` / `CAT_FRAME_Y` / `CAT_FRAME_SCALE`, keyed by
  filename — a new frame with no entry silently renders at the wrong offset, so add its
  row when you add the art, and every referenced file must exist in `assets/cat/`.
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

There is no build. There is a test runner — `node .github/checks.mjs` runs every quick
suite in the repo in a couple of seconds and `--slow` adds the two games' simulations —
and CI runs it on every push. So verification is: run that, serve the folder, and open
the pages you touched.

The runner (and `.github/workflows/checks.yml`, which runs it) was added on
2026-09-23 because there were 43 test files here and **nothing that ran them** —
they all passed, and three live bugs were still found by hand in code with tests
either side of the hole. Quick suites are a second; the two games' simulations
take minutes and need `--slow`. **Add a test, add it to that list**, or it joins
the pile that used to pass.

The first suite in it parses every inline `<script>` on every committed page
(`.github/test/inline-scripts.mjs`). It exists because on 2026-09-24 a single
line break written into a string literal stopped the terminal's page running at all,
with every other suite green — none of them loads the front door.

```sh
node .github/checks.mjs            # every quick suite; --slow adds the simulations
python3 -m http.server 8912 --bind 127.0.0.1
```

Or one suite at a time:

```sh
node projects/kondrite/test/smoke.js      # syntax, transport, room service
node projects/kondrite/test/campaign.js   # headless play-through of all three missions
node worker/test.mjs     # worker rules: auth, strava, media, todo, movies
node projects/climbing/test/parse-parity.js  # build-data.py and climb-parse.js agree
for t in projects/offramp/test/*.test.js; do node "$t" || break; done
for t in atlas/test/*.test.mjs; do node "$t" || break; done
```

`projects/offramp/test/motive.test.js` and `sim.test.js` take a couple of minutes each —
they are simulations, not unit tests. Let them finish.

Served from a plain static server, `/climb`, `/media`, `/log` and `/strava` all 404:
those are Cloudflare Worker endpoints, and on `localhost` the client asks the origin it
was loaded from first. Those 404s in the console are expected and are **not** the bug you
are looking for. **But a local preview is not sealed off from production.** The
climbing pages (`projects/climbing/climb-host.js`) and Entertainment (`room.js`) then
fall back to the live Worker on purpose, so a local page shows live data — and a
sign-in or a write made from it reaches the real Worker. The training pages do not fall
back; they show the committed history. (Corrected 2026-10-29, bug sweep D4-4.)

## Quick verification checklist before you finish

- [ ] All internal links resolve (files exist; current page marked `here`).
- [ ] The menu label set is identical across all room pages.
- [ ] A new page loads `assets/visit.js` (or is left out on purpose — see `worker/README.md`).
- [ ] A new room is in `ROOMS`; a new project is in `PROJECTS` **and** linked from
      exactly one room **and** loads `relay-return.js`.
- [ ] Any `data-egg` you added has a matching entry in `relay-return.js` and a line in
      `EASTER_EGGS.md`.
- [ ] Page still opens as a static file — no console errors, no external requests
      beyond the GitHub API calls that already exist, the OpenStreetMap tiles in
      the training page's run detail, Studies' ClinicalTrials.gov fallback and the
      weather room's providers, NOAA's AWS buckets and its map servers (the
      backup mosaic, and NHC's tropics), ECMWF's open data
      (Google Cloud and AWS), Pro's map lines from Natural Earth on GitHub,
      Pro's terrain from the Terrain Tiles on AWS, the Met Office's UKMET
      on AWS and NSF NCAR's ERA5 on AWS among them (below).
- [ ] Looks right at mobile width.
- [ ] Didn't add location data, extra repos, or a build step.
- [ ] The relevant test suite above still passes.
- [ ] The docs say what is now true: this file, `README.md`, the nearest README and
      `EASTER_EGGS.md` are updated for anything you added, moved, renamed or removed.
