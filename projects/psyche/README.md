# Psyche — Studies

`studies.html` is a search engine over every clinical trial registered with
[ClinicalTrials.gov](https://clinicaltrials.gov/), through its public API v2
(`/api/v2/studies`). It is the first page of the Psyche room's move from a
notebook towards a real site about neuroscience and the drugs that act on it.
Terminal: `studies` (or `trials`).

| File | What it is |
|---|---|
| `studies.html` | the page: search box, filter chips, result cards, detail sheet, watch card |
| `trials.js` | everything that talks to the API, flattens a record, or decides what "changed" means. Loaded by `studies.html` **and** `index.html` (the front-door alert), so the two can never disagree |
| `test/trials.test.mjs` | the client rules, no network. In `.github/checks.mjs` |

## How a search travels

1. The page turns its state into API parameters (`Trials.buildParams`): the box →
   `query.term` (or `query.cond` / `query.intr` / `query.titles` / `query.spons`
   from the scope menu), status chips → `filter.overallStatus`, phase chips and
   "Has results" → `aggFilters` (`phase:2 3,results:with` — the same codes
   clinicaltrials.gov puts in its own search URLs), country → `query.locn`.
2. It asks the Worker first: `GET /trials/search` and `GET /trials/study/<NCT>`
   on `training-log` (`worker/worker.mjs`). The Worker forwards only the
   parameters above, caps `pageSize` at 100, and caches each answer five minutes
   (per-isolate memory, then `caches.default`).
3. If the Worker fails or is not deployed yet, the page calls
   `clinicaltrials.gov/api/v2` **directly**. A 400 is not retried — that is the
   API refusing the search, and it would refuse it from anywhere.
4. "Load more" sends `nextPageToken` back as `pageToken`.

The state lives in the address bar (`?q=…&status=recruiting&phase=2,3&results=1&country=…&sort=…`),
and an open study is `#NCT01234567`, so any search or study can be linked.

## Trial alerts — Ric only

Signed in (the same password as climbing and training, `assets/owner.js`),
every study has a **Track this study** button. Tracking stores the NCT number
and a snapshot — status, results yes/no, a few dates — at `POST /trials/watch/<NCT>`.

The watch card at the top of the page and a `TRIAL ALERT` line under the front
door's NOTIFICATION banner compare that snapshot with the live record. Two
things raise an alert: **results posted** and **status changed**. Sliding
estimated dates do not, on purpose — they move on most studies every few
months. "Got it" moves the snapshot forward.

- **The watchlist is private in both directions.** Which trials one person
  follows is health information. `GET /trials/watch` needs the token too, and a
  visitor's front door makes no request at all.
- Nothing is pushed: the check runs when Ric opens the front door or the page.

## Things to know before changing it

- **Not verified against the live API from the build machine** — the sandbox it
  was written in could not reach clinicaltrials.gov, so it was tested with
  fixture records shaped like v2 responses. The likeliest thing to be wrong is
  a parameter spelling. If the API refuses `fields`, `search()` drops it and
  asks again; any other 400 shows the API's own message on the page.
- The Worker change is **not live until it is deployed** (Actions → Deploy
  Worker). Until then search works directly, and tracking does not.
- Location data: study *sites* are public facility names and cities from the
  registry, nothing of Ric's. `geoPoint` coordinates are never requested for
  cards and never drawn.
- The page credits ClinicalTrials.gov with the retrieval time and carries a
  not-medical-advice note. Keep both.
