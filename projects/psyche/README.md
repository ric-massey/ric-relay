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

## Trial alerts — on the site account

Tracking belongs to the **site account**: the same account as ATLAS and
HERMISCUS (`assets/site-gate.js`), made at `/account/` and switched on per page
by Ric. Studies is the page `studies` in `site_pages`; approving an account for
it is the same tick on the account page as approving HERMISCUS.

- **Searching needs no account.** Everyone gets the search, the cards and the
  detail sheet.
- **Track this study** is on every study. Signed out, it opens the sign-in box
  at the foot of the page (email and password, and "No account? Make one" →
  `account/?for=studies`). Signed in but not approved, the box says so and
  offers **Request access**. Approved, it saves the study.
- The list is the table `trial_watch` (migration
  `atlas/supabase/migrations/20261003120000_studies_watchlist.sql`): one row per
  study per person, with a snapshot of how the study looked when it was last
  acknowledged. **Each person reads and writes only their own rows — Ric
  included** — and a restrictive `has_page_access('studies')` policy means an
  unapproved account stores nothing. Two hundred studies an account.
  `test/watch-policy.test.mjs` fails if either lock goes missing.
- The watch card at the top of the page and a `TRIAL ALERT` line under the front
  door's NOTIFICATION banner compare each snapshot with the live record. Two
  things raise an alert: **results posted** and **status changed**. Sliding
  estimated dates do not. "Got it" moves the snapshot forward.
- supabase-js is loaded from unpkg (the exception `account/` and ATLAS already
  make) **only when needed**: when the browser already holds an account
  session, or when somebody reaches for the sign-in. A visitor with no account
  loads none of it, on this page or the front door.
- Nothing is pushed: the check runs when the front door or the page is opened.

It first shipped on 2026-10-03 as a single list on the Worker behind Ric's
password, and moved to the account the same day so each approved person has
their own. The Worker keeps only the search proxy.

## Things to know before changing it

- **Not verified against the live API from the build machine** — the sandbox it
  was written in could not reach clinicaltrials.gov, so it was tested with
  fixture records shaped like v2 responses. The likeliest thing to be wrong is
  a parameter spelling. If the API refuses `fields`, `search()` drops it and
  asks again; any other 400 shows the API's own message on the page.
- **Two deploys, both manual.** The Worker's `/trials` proxy goes live with
  Actions → Deploy Worker; until then search goes straight to the API, which
  works. The watchlist needs the migration: `supabase db push` from `atlas/`
  (see `atlas/README.md`, step 1). Until then Track reports an error.
- Location data: study *sites* are public facility names and cities from the
  registry, nothing of Ric's. `geoPoint` coordinates are never requested for
  cards and never drawn.
- The page credits ClinicalTrials.gov with the retrieval time and carries a
  not-medical-advice note. Keep both.
