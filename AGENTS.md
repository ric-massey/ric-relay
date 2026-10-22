# Notes for AI assistants working on Terminal

This file is for any LLM/agent asked to change this site. Read it before you touch
anything. `README.md` covers what the site is; this file covers **how to work on it
without breaking the concept or Ric's rules.**

## What this project is

Ric Massey's personal website for friends and family. The concept: **"it's literally
my own internet."** The home page (`index.html`) is **the front door** — a feed of every
room (see "The front door" below); the terminal hub that used to be home is
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
latest.js, notes.js         the front door's banner and transmissions (hand-edited)
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
and was offered another. `apex`, `log` and `map` are out of the nav for the same reason
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

**`apex`, `log` and `map` are deliberately unlisted** — in `#dir` *and* in the room
navs (the front door, `index.html`, is the one exception, by Ric's word on
2026-10-16: it shows Apex and ATLAS). They are the thin rooms and Ric does not want the front door advertising work
that isn't done. They are *not* removed: `ls`, `tree`, `find`, `open <room>`, typing
the room name and the plain URL all still reach them, and Tab completion offers all
three. Don't "fix" this by putting them back. If one gets built out properly, that's
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
That script also writes `projects/climbing/latest-climb.js`, which the front door loads
so the newest day out leads the "latest" banner without anyone editing a list.

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
  (the preview front door shows it as a post, by Ric's word on 2026-10-16). The way in
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
- **The run detail loads map tiles from openstreetmap.org.** This is the one external
  host on the site and it breaks the "no external requests" line in the checklist below.
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
resting HR, readiness and every activity and POSTs them to the Worker's `/garmin`, the one route
that needs a token to *read*. The Actions log is public, so that job commits nothing, caches
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
  `cs-account.json` turns it off. VALORANT's sync still never pushes. A failed
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
- The archive only grows; `sync.py` commits the room's data only and never pushes.

**The front door (home since 2026-10-17).** It went live as `index.html` on 2026-10-16,
was moved back out to `frontdoor.html` the same day while it was worked on, and became
home for good on 2026-10-17 (Ric: "make the front door the main page"). The terminal
moved to `terminal.html`; `frontdoor.html` is now only a redirect home. From the terminal,
`front door` / `home` or the **[ HOME ]** box in the corner of its frame come back here. It does not run the terminal, it hands it commands: the bar carries a
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

**It shows off the pages, not Ric** (Ric, 2026-10-16: "it's my internet, but it's an
internet" — family and friends use these rooms). What fills a rip is **the room working**,
never a screenshot of its page: Counter-Strike, KONDRITE and How Big Everything Is are
clips recorded straight off their own canvas by `assets/frontdoor/record.mjs`
(KONDRITE's follows the ship using the front-page run's own camera); Interstate 40,
Starfield and FARLIGHT use the Arcade's clips; everything else is drawn live by a painter
in `ART` — the Boards from `board-data.js` (a real board, one of Ric's sends lit hold by
hold), the posters from the Entertainment list, the photographs, a made-up run over
made-up hills for Training, an **invented** map for ATLAS, the registry search typing
itself, real aberration and Doppler for How Speed Affects Time, a Minkowski diagram,
Apex's biggest banner number from `apex-data.js`, the terminal answering real commands,
the hardest send of each year from `climbs-data.js`, the Arcade's four clips playing
at once, a Leviathan hull drafted along a scan line.
**No real place is ever drawn**: Training's route and ATLAS's map are generated (hard
rule 1). Few words inside any rip.

**It is a feed of everything, it ends, and no two visits are alike** (Ric, same day:
"like an insta feed", "generated at random so every time you open the page it's a bit
different", then "when there are no more rooms it should end"). `POSTS` lists every room
and every thing in a room a visitor can use — 35 today: the rooms themselves, the
projects, and the sub-pages that stand on their own (the Leviathan, the four spacetime
chapters, climbing's media and stats, training's calendar and races, the movie list) —
each with a `tier`. Tier 0 (Weather, Counter-Strike, KONDRITE, the Boards) keeps its order,
the other tiers are shuffled within themselves, each post appears once, and the page
finishes on "That's every room." (`.fin`). Don't bring back the endless rounds. Every
tear, seam and drawing is seeded from `VISIT`, a random number per page load.
Mochi, the 404 page and the trip modes stay off it (Ric, 2026-10-16) — they are
surprises for the rooms, not posts. VALORANT and the Workbench are off it too
until they have something in them (no matches; one finished project). The Log came back
on 2026-10-17 with its first real entry, the front door's build log — a post that opens onto an empty room costs the next click. **Every word on a
post was checked against its page on 2026-10-17** (ClinicalTrials.gov, not "every
trial in the world"; I-40's traffic is modelled from real counts, not live; KONDRITE's
main game is solo Survey) — check again when you change a post, and never claim a
count or a feature the page doesn't have. "Built by hand" is not to be said: it wasn't. **Boards and ATLAS are in by Ric's word** — the earlier rule that
kept them off the front door is lifted here (ATLAS's post is a door to the sign-in; the
map behind it is untouched). HERMISCUS and the private tools (admin, visitors, account)
stay out (Ric, 2026-10-16: "Hermiscus can stay out"), and so do Climbing's add pages and
the KONDRITE listening booth, which are tools for Ric. When something new ships, add it
to `POSTS` at tier 0 and to the `<noscript>` list.

**Every post is torn from its room's own paper.** `data-skin` sets the post's paper,
ink, accent and heading face — CS steel, the cinema's black and gold, the climbing log's
cream, the darkroom's red, Strava white, the terminal's amber, and so on — every one
checked for 4.5:1. Posts do **not** tear into each other (Ric, 2026-10-17: "smooth
transitions, not another rip"): each post's `.blend` melts its paper into the next
one's (`--next`, set by the script) across the padding between them. The rip in it is
**its own shape every time** (Ric, 2026-10-17: "make the shape and angles of the
cutouts change"): from the post's seed, `geometry()` picks how hard the top and bottom
each close in or open out, a slant and a sag or swell along each edge — a wedge, a blade,
a parallelogram, a lens — on phones and desktops alike, never closing below 56% of the
box. The hole is see-through: nothing behind it is painted black. It is torn through a stack of that same paper (`paperOf()`
derives the stack from `--paper`), painted on a canvas (`.rim`) inside the clipped `.cut`.
On a phone the words come first, then a 210px strip. The picture (`.still`) slides with
the screen ("depth"). **A post far off screen lets go of everything heavy** — its torn
edges, its video, its drawing — and makes them again as it comes back, so a
long feed costs no more than a short one. Never put a `filter` or `transform` on a
`.cut`, keep anything laid over a cut *inside* it (Chromium paints outside the clip
otherwise), and draw shadows on the canvas, never as a CSS or SVG blur. Night/day only
changes the hero's paper.

Homepage "transmissions" live in `notes.js`. Curated newest additions live
in `latest.js` and are announced in exactly one place: the "new" pill on the front door
(`index.html`), and the terminal's `latest` command opens the newest. The terminal
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
  the sky, with a gold ★ Pro badge in its top bar; Pro is a dark, monospaced,
  amber instrument with ← Weather to go back. Don't bring back a shared tab switch
  or style Pro like Weather. Both load `assets/weather/app.js` and
  `assets/weather/weather.css`; each page holds only its own cards. **Warnings and
  storm mode stay on both** — never move them to Pro only. Pro is a tab of the
  weather room, not a room: it is not in `ROOMS` or the room navs.
- **No go/no-go verdicts.** A ride outlook was built and removed the same day — Ric:
  "this should be information, not something that could make it unsafe." Don't add
  one for riding, driving, flying or anything else; `test/wx.test.mjs` checks.

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
  then "do it"). The radar's Level III products and full Level II volume, MRMS,
  GOES lightning and HRRR / GFS fields come from NOAA's public buckets on AWS
  (`unidata-nexrad-level3`, `unidata-nexrad-level2-chunks`, `noaa-mrms-pds`,
  `noaa-goes18/19`, `noaa-hrrr-bdp-pds`, `noaa-gfs-bdp-pds`) and are decoded by
  `nexrad.js` + `bzip2.js`, `level2.js`, `mrms.js`, `glm.js` and `grib2.js` +
  `modelmaps.js` — written here, no library.
  Each is held to MetPy, h5py, ecCodes or Python's bz2 in `test/decoders.test.mjs`
  on real files in `test/fixtures/`; change a decoder and its expectations together
  (`fixtures/make-expected.py` regenerates them). Those buckets are the weather
  room's other external hosts. Lightning is GLM *flashes* — never call them strikes.
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
those are Cloudflare Worker endpoints, and on `localhost` the client points at the origin
it was loaded from. Every caller treats a failed fetch as "no extra data" and falls back
to the committed history, so those 404s in the console are expected and are **not** the
bug you are looking for.

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
      weather room's providers, NOAA's AWS buckets among them (below).
- [ ] Looks right at mobile width.
- [ ] Didn't add location data, extra repos, or a build step.
- [ ] The relevant test suite above still passes.
- [ ] The docs say what is now true: this file, `README.md`, the nearest README and
      `EASTER_EGGS.md` are updated for anything you added, moved, renamed or removed.
