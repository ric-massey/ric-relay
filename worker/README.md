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
| `/movies` | Entertainment | edits on top of `projects/entertainment/entertainment-data.js` |
| `/garmin` | Training (owner bar) | Ric's Garmin export, token to read **and** write; `/garmin/_pull` starts the Actions job (`projects/training/garmin/`) |
| `/trials` | Psyche → Studies | `/trials/search` and `/trials/study/<NCT>` pass ClinicalTrials.gov API v2 through, cached five minutes. The watchlist is on the site account, not here (`projects/psyche/README.md`) |
| `/hit` | every page | page-view beacons from `assets/visit.js`, into D1 (`visitors.mjs`) |
| `/stats` | `visitors/`, `admin/` | the visitor numbers, owner only; `?full=1` adds everything the admin Analytics tab draws (with `path=`, `ref=`, `country=`… filters, the previous period, and `seen=` for "since you last looked"), `/stats/live` is only who is online, `/stats/visitor?id=` is one browser's history, `/stats/exclude` is "ignore this device" |
| `/wx` | Weather | the weather room's providers passed through and cached (`projects/weather/README.md`, "How a request travels") |
| `/cs` | Counter-Strike | `/cs/replay/<id>`: the match replays, in R2 (`projects/cs/README.md`) |
| `/meso` | Weather Pro | the hourly mesoanalysis, in R2 for a day: `PUT /meso/<YYYYMMDDHH>` from `projects/weather/meso/build.mjs` (site password; only a mesoanalysis file for that hour is taken), `GET /meso/index` and `GET /meso/<hour>` public |
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
time on page and scroll depth, and the hostname of links clicked out. No IP
address, no coordinates, no raw user agent, no other query strings, no cookies.

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
