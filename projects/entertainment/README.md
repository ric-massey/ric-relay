# Entertainment — the data behind the room

`entertainment.html` (the app) and `entertainment-library.html` (the catalog) both
read `entertainment-data.js` in this folder — 363 titles, each `watched` or
`watchlist` — and share one core, `assets/entertainment/room.js`. Edits made on the
page go to the Worker's `/movies` (see [`worker/README.md`](../../worker/README.md));
`pull-entertainment.py` folds them in and adds facts and posters, run by
`.github/workflows/entertainment.yml`.

This file lost data three separate times, and most of the rules below were written the
day after one of them. Read them before changing the page, the data file, the puller or
`/movies`. The short list of never-break rules is also in the repo's `AGENTS.md`.

- [How an edit reaches the list](#how-an-edit-reaches-the-list)
- [The puller and the data file](#the-puller-and-the-data-file)
- [The page](#the-page)

## How an edit reaches the list

- **The committed file is the archive and always renders on its own.** Everything else
  is a layer on top of it, merged at read time: the Worker's `/movies` first, then this
  browser's `localStorage`. Same shape as the climbing pages, for the same reason — a
  page showing the real list is right, and an error page is not. If the service is
  unreachable the page must still come up complete.
- **`/movies` is deployed** (2026-09-22), so an edit made on the page is real straight
  away and follows Ric between devices. It is one route on the `training-log` Worker,
  which also serves `/todo`, `/climb` and `/strava` — there is one Worker, so you cannot
  ship one route without shipping all of them. Deploy with
  `npx wrangler@latest deploy` from `worker/`; it goes from the Mac
  straight to Cloudflare and has nothing to do with the GitHub push that publishes the
  site.
- **The localStorage layer is still the fallback**, for edits made with no signal, and
  those cards say **not committed**. Don't "fix" that by deleting the local layer — it
  is the only thing holding them. The owner panel's Export button prints a replacement
  data file with them folded in; that is how they reach the committed list.
- **A write to `/movies` is a PATCH, not a replacement, and the page sends identity with
  it.** This seam was quietly broken until 2026-09-23 and every part of it looked like
  it worked, because the page renders the local layer and says "not committed":
  - The Worker rebuilt the whole record from the body each time, so every field it had
    no slot for — `seen`, `wd`, `tmdb`, `year`, `genres` — was **dropped**. Picking the
    right film in the chooser and then watching the puller re-guess it from the title is
    that bug, and it defeats the one question the page exists to ask.
  - It required a title, so the first edit to any of the 363 **committed** films — every
    "mark watched" — was refused with a 400 and kept in that browser alone.
  - It defaulted what the caller had not sent, so a patch saying only `pick: true`
    arrived with `status: 'watchlist'` attached and **moved a film watched years ago
    back onto the queue**.
  The rules now: the Worker applies only the keys actually sent, clamps the ones whose
  shape it knows, passes the rest through untouched, and **never invents a value it was
  not given** — absent means "no opinion", and the merge leaves the committed value
  alone. The page sends `title` and `status` from the current row with every film patch,
  because the service cannot see the committed file and must not have to guess.
- **`added` is when a title arrived on the list**, so stage 0 drops it when merging onto
  a row that is already in the file. Otherwise every old film picks up the 2026 date the
  Worker first heard of it.
- **Reserved ids (`_people`) are stored as given.** The slug rule turns `_people` into
  `people`, which would file a list of favourite actors on the list of films as a title
  called People, and the film shaping demanded a title it does not have — so starring an
  actor 400d and never left the browser. They now take a pass-through branch before the
  slug: an object, bounded, owner-only, and never bumping the poster counter.
- **A removal is a tombstone, not a delete** (`{ removed: true }`), in the Worker and in
  the local layer both. This is the one place `/movies` differs from `/todo`, which it
  is otherwise a copy of, and the reason is the committed file underneath: a real delete
  is undone by the next page load.
- **The export must keep the data file's header.** It reads it back off the real file
  rather than keeping a second copy, because two copies of a comment is how a comment
  starts lying — export once with a stale duplicate and the rules at the top of the data
  file are quietly replaced.
- **`dev.mjs` serves `/todo` and `/movies` too.** Its route list had gone stale, so the
  entertainment room could not be exercised locally at all — the page silently fell
  through to the live Worker. It also carries a fake GitHub, so the doorbell can be rung
  without a token and without starting a run on the real repository. **If you add a
  route to the Worker, add it to that regex**, or the next person debugs against
  production without noticing.
- **`projects/entertainment/test/write-path.mjs` walks one film the whole way**:
  page → Worker → the pull script's merge, with a Map for storage and no network.
  It is the check that would have caught all three of the bugs above, and each one
  was put back to prove it goes red. It builds its sample row **from the page's own
  `FIELDS`**, so a field added tomorrow is covered the same day rather than whenever
  somebody remembers — and it asserts the two `FIELDS` lists still match, which
  until now was a comment asking nicely. The entertainment job runs it before
  committing anything to the data file.

## The puller and the data file

- **The room's data is pulled in two stages, and they are separate on purpose.**
  `projects/entertainment/pull-entertainment.py`:
  - **Stage 1, facts — no key, nothing to sign up for.** Wikipedia finds the article,
    Wikidata answers: year, runtime, director, genre, IMDb id and **the TMDB id**.
    Wikidata is CC0; the one-line synopsis is the Wikipedia extract (CC BY-SA).
  - **Stage 2, art — needs the free TMDB key** in the Keychain (`tmdb`, account
    `ricmassey`), never in the repo, same rule as `apex-als`. It never *searches*
    TMDB: stage 1 already handed it the exact id, so there is no fuzzy matching and
    no chance of a stranger's poster.
- **Nobody runs the script. A clock does.** `.github/workflows/entertainment.yml`
  runs the whole pull every three hours, and again on Sunday mornings with
  `--where --refresh` (streaming is the one fact that rots on its own — a film leaves
  Netflix without telling anyone). It commits **only if something changed**, so most
  runs are silent, and a push is a publish, so a film Ric adds on the site has its
  poster on ricmassey.com within a few hours with no command typed anywhere. The key
  is a repository secret named `TMDB_KEY`; `api_key()` reads the environment first and
  falls back to the Keychain, so running it by hand on the Mac is unchanged.
  - **The doorbell means it usually does not wait three hours.** `POST /movies/_pull`
    on the Worker fires a `repository_dispatch`, so a film added on the site has its
    poster in about a minute. The page rings it after any write the Worker took
    (debounced, never queued) and once per sign-in. **The page has no GitHub
    credential and must never get one** — firing it from the browser means a token
    with write access to this repo inside a public web page. The Worker has one,
    where a secret is not readable by everyone who loads the site.
  - **The clock is the backstop, not the fallback.** A ring that never happens —
    Worker down, token expired, film added with no signal — costs a delay and never
    a film. Don't delete the schedule because the doorbell works.
  - **`_pull`, not `pull`.** A film called *Pull* slugs to `pull` and would quietly
    take the route over. Reserved ids start with an underscore and no title can slug
    into one; `_people` already relies on this. There is a test.
  - **The doorbell counts writes, it does not compare timestamps.** Two edits can
    land in the same millisecond and an ISO string cannot tell them apart, so the
    second would read as "already asked" and wait for the clock. `gh:seq` counts,
    `gh:movies` remembers the count last acted on, and a ring that GitHub refused is
    never recorded as done.
  - **The concurrency group is load-bearing.** Two runs writing
    `entertainment-data.js` at once is the one remaining way to lose a film. Never set
    `cancel-in-progress`, and never add a second workflow that writes this file.
  - GitHub disables scheduled workflows after 60 days with no repo activity. A quiet
    room plus a quiet repo means it stops; the Actions tab says so, and a push or the
    "Enable workflow" button starts it again.
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
- **The titles are his, not IMDb's.** They were corrected for spelling and casing only.
  Several were deliberately left as typed because the right film was not guessable —
  don't "fix" `Curtis`, `Moments`, `The Sound`, `Greater good`, `RIP`, `Code 3`,
  `Mercy` or `Obsession` without asking him which ones they are.
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
- **A hand-set `wd:` or `tmdb:` id is never overwritten.** That is how an ambiguous
  title gets settled once and stays settled through every re-run.
- **The script writes as it goes** (every ten rows) and skips rows already filled in, so
  stopping it halfway costs nothing and a re-run is cheap.
- **`urllib` needs its certificates pointed at.** A python.org install ships `certifi`
  but only wires it up if someone runs *Install Certificates.command*, which nobody
  does — so `urllib` gets `CERTIFICATE_VERIFY_FAILED` while `curl` in the same shell is
  fine. The script builds its own SSL context from `certifi` when it can. Any new script
  here that talks https should do the same rather than "fixing" the Python install.
- **`FIELDS` appears twice on purpose and must match** — in `pull-entertainment.py` and in
  `assets/entertainment/room.js`'s export. The script and the page's Export button both
  rewrite the data file and emit the same JSON; if the two lists disagree, every export
  fights the last pull. `test/write-path.mjs` asserts that they match.

## The page

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
  or dense list). Both load `assets/entertainment/room.js`, which owns the merge rules,
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
- **The furniture lives in `assets/entertainment/room.css`** and the case markup in
  `Room.dvdCase` — one definition, both pages. Hard rule 3 is about not flattening the
  SITE into one template; this is one room's furniture, like `assets/climbing/climbing.css`.
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
