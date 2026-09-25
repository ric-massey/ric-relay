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

Deploy = `git push` to `main` → GitHub Pages. So **a push is a publish.** Ric's
rule (2026-09-25): **push to `main` when a project's worth of work is done and
verified** — one push per finished piece of work, not one per commit and not
mid-task — unless he says otherwise. Other sessions (cloud and desktop) push to
`main` too: a SessionStart hook in `.claude/settings.json` pulls on startup, and
before a push, `git fetch` and fast-forward first.

## Where things live

```
index.html, <room>.html     the terminal and the rooms — one self-contained page each
effects.js                  sitewide: visual modes, the mobile room menu, Mochi
latest.js, notes.js         the front door's banner and transmissions (hand-edited)
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
docs/                       notes, audits, mockups and plans about the site, not part of it
.github/                    checks.mjs (every test) and the three workflows
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
the room name and the plain URL all still reach them, and Tab completion offers all
three. Don't "fix" this by putting them back. If one gets built out properly, that's
the moment to re-list it.

**There is one room list, in `index.html`.** The `ROOMS` array near the top of its script
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
  `autism-reflection.html` and `state-of-mind-line` → Psyche; `siege-conductor` →
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
  over HTTP (`python3 -m http.server`) and load video + wrapper from the same origin so the
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
That script also writes `projects/climbing/latest-climb.js`, which `index.html` loads
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

Homepage "transmissions" live in `notes.js`. Curated newest additions live
in `latest.js` and are announced in exactly one place: the NOTIFICATION banner on
`index.html`. Every room used to carry one in its own native style; they don't any
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
alone unless fixing a bug. `systems.html` and `updates.html` are legacy redirects, not
rooms.

**One account for the whole site lives in ATLAS's Supabase project.** Since
2026-09-23 anybody may sign up at `account/` (terminal: `login`), the account
arrives as a request, and Ric approves it and ticks which pages it opens —
ATLAS and HERMISCUS today. The lock is `has_page_access()` in the database;
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
  (e.g. hidden `index.html` commands: `orrin`, `apex`, `sudo`, `coffee`, `exit`).
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
line break written into a string literal stopped `index.html` running at all,
with every other suite green — none of them loads the front door.

```sh
node .github/checks.mjs            # every quick suite; --slow adds the simulations
python3 -m http.server 8912
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
