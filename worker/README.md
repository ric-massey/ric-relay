# The Worker

One Cloudflare Worker, deployed as **`training-log`**, is the site's only
back end outside ATLAS. It started as the training log and grew, so the name
is historical — every room that writes anything writes here:

| Route | Room | What it holds |
|---|---|---|
| `/log` | Training | ticks and notes against the plan |
| `/strava` | Training | runs pushed by Strava's webhook |
| `/board` | Training / Climbing | board-night dates from `projects/climbing/board-tick.mjs` |
| `/climb` | Climbing | days logged from `projects/climbing/add.html` |
| `/media` | Climbing | photos and clips for the media tab |
| `/todo` | Climbing | the route to-do list |
| `/movies` | Entertainment | edits on top of `projects/entertainment/entertainment-data.js` — `mine` (Ric's 1–100) is clamped here |
| `/tmdb` | Entertainment | any film or show looked up through TMDB, where it streams today, franchises and posters (`tmdb.mjs`): six fixed read-only shapes, cut down, cached at the edge. Needs the `TMDB_KEY` secret, which **Deploy Worker** copies from the repo's Actions secret; without it every path answers 503 (`projects/entertainment/README.md`, "Lookup …") |
| `/garmin` | Training (owner bar) | Ric's Garmin export, token to read **and** write; `/garmin/_pull` starts the Actions job (`projects/training/garmin/`) |
| `/trials` | Psyche → Studies | `/trials/search` and `/trials/study/<NCT>` pass ClinicalTrials.gov API v2 through, cached five minutes. The watchlist is on the site account, not here (`projects/psyche/README.md`) |
| `/hit` | every page | page-view beacons from `assets/visit.js`, into D1 (`visitors.mjs`) |
| `/stats` | `visitors/`, `admin/` | the visitor numbers, owner only; `?full=1` adds everything the admin Analytics tab draws (with `path=`, `ref=`, `country=`… filters, the previous period, and `seen=` for "since you last looked"), `/stats/live` is only who is online, `/stats/visitor?id=` is one browser's history, `/stats/exclude` is "ignore this device" |
| `/popular` | the front door | the ORDER pages were used in over the last 30 days — people, not views, Ric's ignored devices left out, the front door and private tools never listed. Public, so order only: no counts, no visitors. Cached an hour (`visitors.mjs`, "Most used first" below) |
| `/wx` | Weather | the weather room's providers passed through and cached (`projects/weather/README.md`, "How a request travels") |
| `/cs` | Counter-Strike | `/cs/replay/<id>`: the match replays, in R2 (`projects/cs/README.md`) |
| `/meso` | Weather Pro | the hourly mesoanalysis, in R2 for a day: `PUT /meso/<YYYYMMDDHH>` from `projects/weather/meso/build.mjs` (site password; only a mesoanalysis file for that hour is taken), `GET /meso/index` and `GET /meso/<hour>` public |
| `/rap` | Weather Pro | the RAP model's native-grid files passed through (NOAA's `noaa-rap-pds` sends no CORS header): only `rap.YYYYMMDD/rap.tHHz.wrfprsfNN.grib2` and its `.idx`, and the listing of one run; a single byte range passed on, the bytes streamed untouched, nothing stored; read-only |
| `/auth` | all of them | Ric's sign-in (`assets/owner.js`) |

It lived in `projects/training/server/` until 2026-09-25. The deployed name
stays `training-log` because that name is in the live URL every page calls —
renaming it is a redeploy plus an edit to every client, not a tidy-up.

Or from a phone: Actions → **Deploy Worker** → Run workflow (`.github/workflows/worker-deploy.yml`, needs the `CLOUDFLARE_API_TOKEN` secret).

```sh
cd worker
npx wrangler@latest deploy          # from the Mac, straight to Cloudflare
node worker/test.mjs                # the rules: auth, strava, media, todo, movies
node worker/dev.mjs                 # serves the site and every route above locally
```

Secrets, the Strava wiring and the security rules are in
[`projects/training/README.md`](../projects/training/README.md) and at the top
of `worker.mjs` and `wrangler.jsonc`. **If you add a route, add it to the regex
in `dev.mjs` too**, or local testing quietly falls through to production.

## The visitor counter

Every visitor-facing page loads `assets/visit.js`, which posts one beacon per
page view to `/hit` and a heartbeat a minute while the tab is in front. The
Worker writes them to a **D1** database bound as `STATS`, and
`ricmassey.com/visitors/` reads them back from `/stats` with the site password
(the same `LOG_TOKEN` sign-in as Training). `visitors.mjs` says exactly what a
row holds; the short version is a random browser id, a random session id, the
path, the referring site's hostname, the country / region / city, a browser /
OS / device word, the language, a screen-width class, a `?ref=` / `utm_` tag,
time on page and scroll depth, and the hostname of links clicked out. The
counter's database keeps no IP address, no coordinates, no raw user agent, no
other query strings and no cookies. That promise is the database's: the Worker
has Cloudflare's observability on (`wrangler.jsonc`), so Cloudflare keeps its
own invocation log of every request, `/hit` included, for its retention period
— turn `invocation_logs` off there if that should stop too (bug sweep A2b-7).

### Most used first: `/popular`

Ric, 2026-10-30: "the most used page always is on top… if a new page gets
more popular it automatically goes to the top". `/popular` is how the front
door knows. It answers `{ order: ["/weather-pro", "/weather", "/cs", …], days:
30, at }`: every page path ranked by how many **different people** opened it
in the last 30 days (`POPULAR_DAYS`), so one visitor refreshing all afternoon
is still one and a page nobody has found yet can climb quickly. `/weather` and
`/weather.html` are one page. The devices in `ignored` (Ric's own) never
count. `POPULAR_HIDDEN` keeps the front door itself, `admin`, `visitors`,
`account`, HERMISCUS (`projects/dads-race`) and Climbing's Add page out of the
list entirely.

It is the one public window onto the counter, so it publishes the ranking and
nothing else — no counts, no ids, no countries; the test in
`visitors.test.mjs` fails if any of those appear. The answer is cached at the
edge for an hour, so a busy hour costs one query. A page that reads it should
keep the last answer and sort by that, so nothing moves while someone is
looking, and fall back to its own committed order when the service is down.

`/stats` opens to the site password **or** to a site-account session from
`ricmassey.com/admin` (header `x-admin-session`), which it checks by asking
Supabase `is_site_admin()` with it — `SITE_SUPABASE_URL` / `SITE_SUPABASE_KEY`
in the `vars` block of `wrangler.jsonc`, both public values. That path never
touches the password throttle.

The tables make themselves on the first beacon, so setting it up is:

```sh
cd worker
npx wrangler@latest d1 create visitors     # once; prints a database_id
# paste that id into the d1_databases block in wrangler.jsonc
npx wrangler@latest deploy
```

With no `STATS` binding the Worker runs as before: `/hit` answers 204 and
keeps nothing, and the dashboard says the database is missing.

`node worker/visitors.test.mjs` runs the rules against a real SQLite
(`d1-memory.mjs`), and `node worker/dev.mjs` serves the whole thing locally:
browse a few rooms, then open http://localhost:8799/visitors/?key=local-dev-token.

New pages need the tag too — `<script src="…/assets/visit.js" defer></script>`
before `</head>` — or they are invisible to it. Left out on purpose: the
redirect pages, ATLAS and the account page, HERMISCUS, KONDRITE's test and
tool pages, the visitors page itself, and the generated CS player cards
(`projects/cs/p/`, not yet).

Orrin's status service is a separate Worker in `projects/orrin/server/`.
