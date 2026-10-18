# Weather — the sky over you

`weather.html` is the weather room: a phone weather app on the surface (now,
when the rain starts, every hour, ten days, alerts, radar) that is meant to open,
phase by phase, into a real meteorology tool — model fields, soundings,
hodographs, cross-sections, replay. **[`DESIGN.md`](DESIGN.md) is Ric's design
document and the source of truth for what it becomes**; this file is how it is
built here and what is built so far. Terminal: `weather` (or `wx`, `forecast`,
`radar`, `rain`).

It is **unlisted** — in `ROOMS` with `listed: false`, off the front door and the
room navs, like CS and Apex were while they were thin. Re-list it when Ric says.

| File | What it is |
|---|---|
| `../../weather.html` | the page: the hero, the cards, the radar map, the place sheet |
| `wx.js` | everything that talks to a provider, turns its answer into one shape, or decides what the page may say (is it raining, how old is this, where is the storm). Pure functions are exported for Node |
| `sounding.js` | the vertical arithmetic: parcels, CAPE / CIN / LCL / LFC / EL, precipitable water, lapse rates, shear, Bunkers storm motion, helicity, STP |
| `draw.js` | the Skew-T and the hodograph, as SVG strings |
| `verify/core.js` | the scoreboard's arithmetic and the blend — loaded by the page and by `score.mjs` |
| `verify/score.mjs` | the daily scoring job (below) |
| `verify/scores/` | what it publishes: rounded records per state, no coordinates |
| `../../weather.webmanifest`, `../../weather-sw.js`, `../../assets/weather/` | the home-screen app |
| `DESIGN.md` | the design document |
| `test/wx.test.mjs` | the client's rules on fixtures, no network. In `.github/checks.mjs`. Also holds the Worker's `/wx` route to every request the page makes |
| `test/sounding.test.mjs` | the sounding arithmetic, against hand-checkable physics and against MetPy (pinned values). In `checks.mjs` |
| `test/live.mjs` | the same functions against the real providers. Needs the network, so it runs in `.github/workflows/weather-live.yml` (on change, daily, on demand) |

## Who answers what (DESIGN.md §24)

| Question | Provider | Notes |
|---|---|---|
| The numbers — now, hourly, 10 days, rain every 15 min | [Open-Meteo](https://open-meteo.com/) `/v1/forecast` | Global, keyless, CC BY 4.0. "Best match" blend — HRRR and GFS in the US. Always asked in metric; the page converts |
| What a real station measured | NWS `api.weather.gov` — `/points` → `/stations` → `/observations/latest` | Nearest station with a temperature in the last 90 minutes, next one along if it has gone quiet. US only |
| The forecast office's own words | NWS `/gridpoints/…/forecast` | Shown under each day of the 10-day list, labelled as the office's |
| Official alerts | NWS `/alerts/active?point=` | Shown as issued, worst first; polygons drawn on the radar |
| Radar | NOAA NEXRAD base reflectivity, US composite, via [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu/) tiles | Latest plus one layer per 5 minutes back to 50; `n0q_0.json` says when the latest was scanned. Lower 48 only |
| Storm warnings across the country, and a state's | NWS `/alerts/active?event=…` and `?area=XX` | The national list with no place; "warnings nearby" with one |
| SPC convective outlook | `spc.noaa.gov/products/outlook/day{1,2,3}otlk_*.nolyr.geojson` | Categorical risk with SPC's own labels and colours; drawn on the radar, and "Slight risk … here today" in the hero |
| Single-site radar | IEM `json/radar.py` (nearest sites, scan list) and `ridge::<SITE>-<PROD>-<YYYYMMDDHHMI>` tiles | Super-res reflectivity (N0B) and storm-relative velocity (N0S), every scan in the last hour. IEM does not tile CC, ZDR, KDP or echo tops (probed 2026-10-17) |
| Model soundings | Open-Meteo, every pressure level, `models=` ncep_hrrr_conus / gfs_global / ecmwf_ifs025 / ecmwf_aifs025_single, run time from `/data/<model>/static/meta.json` | HRRR and GFS publish ~20 levels, ECMWF 12; AIFS gives humidity not dewpoint, so the dewpoint is made from it |
| Weather balloons | IEM `json/raob.py` and the RAOB network list | The nearest launch site's latest 00Z or 12Z flight |
| Roughly where a visitor is | The Worker's `/wx/near` — Cloudflare's own city-level guess for the connection | Only once the Worker is deployed. Rounded to 0.1°, never cached or stored, labelled "approximate" |
| Place search | Open-Meteo geocoding | |
| Base map | OpenStreetMap tiles | The same exception the training page's run map makes |

## How a request travels

Exactly as Studies does it (`projects/psyche/README.md`): the Worker's `/wx`
route first, then the provider directly if that fails. `/wx` (in
`worker/worker.mjs`) forwards only the shapes `wx.js` builds (`ROUTES`), caches
each for as long as it stays true (alerts a minute, a station two, the model ten,
a point's office a day), and sends the User-Agent the NWS asks for. **It is not
deployed yet** — until Actions → Deploy Worker runs, every call quietly goes
direct, which works. Images (map and radar tiles) always load directly.

## Rules

- **No place is ever in this repo (hard rule 1).** The radar's national
  view fits the lower 48's bounding box (`CONUS` in the page) — a map extent,
  not anyone's place. A place comes from the
  visitor — the browser's location or a search — and lives in that browser's
  localStorage (`wx:place`, `wx:saved`, plus `wx:last`, the last forecast, for
  offline). It is rounded to two decimals (~1 km) the moment it arrives and
  before anything is asked about it; the Worker refuses anything finer, so no
  cache key is a doorstep, and nothing logs one. The live test finds its places
  by name. Don't add a default location, and don't put coordinates in the URL
  without asking Ric.
- **Every number says where it came from and how old it is** (§25, §32).
  "Now" is a station observation when there is one under 90 minutes old,
  otherwise the model's estimate, and the hero says which. A field the station
  didn't report is filled from the model and tagged `model`; feels-like on an
  observation is computed with the NWS's own formulas and tagged `computed`.
  Past `STALE_MS` a feed says "delayed" rather than looking live. The *Where this
  comes from* card is the room's status page (§37).
- **Each source fails on its own** (§35.1). A dead station never blanks the
  forecast; outside the US the NWS parts say "US only" and the rest works.
- **Official warnings stay the NWS's** (§20). The page shows and orders them; it
  never rewrites, summarises or invents one.
- **Times are the place's clock**, not the visitor's (`Wx.clock(tz)`).
- **The rain sentence is `Wx.rainOutlook`** and its rules are in the comment
  above it — quarter-hour stamps mark the END of their quarter, 0.1 mm a quarter
  counts as wet, one dry quarter does not split a shower. Change the tests with it.
- **With no place, the page is the whole country** — every storm warning and
  watch, SPC's outlook, the national radar. The map view of the lower 48 is a
  view, not a default place. Once the Worker is deployed, `/wx/near` turns the
  visitor's connection into a city-level guess and the page shows that forecast,
  marked "approx." and never saved; a place they choose always wins.
- **Storm mode is the warning's own estimate, said as one.** Inside a storm
  warning the page leads with it: the NWS's words, its tags (observed, damage
  threat, hail, gusts), and where the storm is from the warning's TIME…MOT…LOC
  line carried forward at its own speed (`Wx.stormTrack`). An arrival time is
  shown only when the path crosses within 8 km in the next 90 minutes, and every
  one says "an estimate — act on the warning". Never present one without the
  warning, never make one from radar, and never let it delay or soften the
  warning's text.
- **The sounding numbers are computed here and checked.** `sounding.js` uses
  virtual-temperature parcels as SPC does; `test/sounding.test.mjs` holds its
  parcel, LCL, LFC, EL, CAPE and PW to MetPy's on the same profiles (see the
  comment there for why the CAPE reference is the integral of MetPy's parcel
  rather than its `cape_cin()`). STP is labelled as an index of ingredients.
- **Not built here:** anything that would need a server decoding GRIB or radar
  volumes. The browser gets small finished answers (§28–29); when a phase needs
  more than a public API gives, that is a decision for Ric, not a library to add.

## Built so far

**Phase 1** (DESIGN.md §38): location (search, my location, saved places),
current conditions, rain timing (next 3 hours in 15-minute steps), hourly with a
tap-for-detail hour, 10 days with the office's words, alerts with polygons,
animated radar, wind / humidity / pressure trend / visibility / UV / sun, °F/°C,
offline copy, refresh every ten minutes while open.

**Since (2026-10-17, for the storm side):**
- *No place needed* — the national view above, and the Worker's approximate place.
- *Storm mode* — a banner for each storm warning covering the place, the storm's
  distance, heading and possible arrival; the radar swings to the warning on the
  nearest site's reflectivity and loops; the title says the warning; alerts and
  nearby warnings refresh every minute while any storm warning is in the state.
- *Warnings nearby* — the state's storm warnings within 250 km, each with its track.
- *Storm radar* — US mosaic, or one site's reflectivity or storm-relative velocity,
  the site following the middle of the map; warning polygons, storm positions with
  30-minute motion lines, and SPC's outlook drawn over it.
- *The air above you* (Phase 4) — Skew-T, hodograph and parcel/shear/helicity
  numbers from HRRR, GFS, ECMWF or AIFS, 48 hours on a slider that redraws
  instantly, or the nearest balloon's latest flight; a plain-words glossary.

## How sure, how accurate, and the blend on the page

- **How sure** (`Wx.dayConfidence`): one extra request (`/wx/ens`) fetches the
  NBM, HRRR, GFS, ECMWF and AIFS hourly temperature, rain and wind for the
  place. A day is *confident* when the models' highs are within 2 °C and they
  agree on rain (≥ 1 mm), *fairly* within 4 °C, otherwise *uncertain*. The hero
  says "Models agree on today" or "Models disagree", each day carries a dot,
  and the day's details say the range ("highs anywhere from 61° to 70°; 2 of 5
  have rain").
- **How accurate, here** (`#record`): the nearest scored airport stations come
  from the NWS's own station list for the place (ICAO `KTYS` → IEM `TYS`,
  `Wx.iemId`); their records come from this site's published scoreboard files.
  The card ranks every model and the blend by their next-day temperature miss,
  names what the page is showing, and gives the national medians.
- **The blend on the page** (`applyBlend` in the page, `blend()` in
  `verify/core.js` — the same function the scoreboard scores): used for hourly
  temperatures and each day's high and low **only** where the nearest station's
  record shows the blend beating the standard forecast (`Wx.verdict`; a tie is
  not a win, and a record under `minDays` is not ranked). Rain and wind stay the
  standard forecast's. The day's details say when its high and low are the
  blend's.

## The everyday side

- **The sentence at the top** (`Wx.summary`): rain in the next 12 hours, else a
  change of sky, gusts of 40 km/h or more, and tomorrow's high against today's —
  fixed rules, at most three sentences. The next three hours are always said in
  `rainOutlook`'s own words, so the summary never contradicts the rain line.
- **Sunrise and sunset** sit in the hourly strip at their minute.
- **Each day opens** to its temperature curve with high, low and now marked,
  the chance of rain each hour, today against yesterday, how sure, and the
  office's words.
- **Rain**: the last 24 hours (the model's) and the next 24.
- **Saved places** show their temperature, sky, high and low, in one request.
- **Home screen**: `weather.webmanifest`, icons in `assets/weather/`, and
  `weather-sw.js` — the only service worker on the site, scoped to `./weather`
  so it controls this page and nothing else. Network first for same-origin
  files, last good copy when offline; it never touches another host. iPhones
  get the two taps to add it; other browsers their own install prompt; shown
  once a place is chosen and gone for good once dismissed.

## The scoreboard (DESIGN.md §31)

Every day `.github/workflows/weather-score.yml` runs `verify/score.mjs`, which
holds every model the room can show to what actually happened at every US
airport weather station (IEM's AZOS network, ~2,500 stations):

- **Forecasts** come from Open-Meteo's previous-runs API — what each model
  said one and two days before each hour — so nothing has to be saved today to
  be checked tomorrow. Models: Open-Meteo best match (the page's standard
  forecast), the NWS National Blend (NBM), HRRR, GFS, ECMWF IFS and ECMWF AIFS.
- **Observations** come from IEM's ASOS archive, one request per state network.
- **Our blend** (`verify/core.js`, `blend()`) — each model with its proven bias
  at that station removed, weighted by 1/MAE², day and night separately — is
  built from yesterday's records and scored exactly like a model. A model with
  under `MIN_DAYS` of record is not corrected.
- **Records** are running averages that remember about the last month
  (`HALF_LIFE_DAYS`): temperature bias and error by day and night, wind, rain
  days hit or missed, for each station × model × lead.
- **What is published** — `verify/scores/index.json` (which state each station
  is in, how far the record goes, the national medians) and `scores/<ST>.json`
  (each state's stations, rounded) — holds **no coordinates** (hard rule 1); the
  job reads station positions at run time and only to ask for forecasts. The
  full-precision record lives in the Actions cache between runs and is
  committed only as these rounded files, weekly (Sundays), on the first run, or
  when started by hand with "commit". If the cache is lost the committed files
  seed it again.
- **Pacing**: Open-Meteo's free tier is non-commercial, and the job paces itself
  to 70 weighted calls a minute — about an hour and a half a run. A first run
  backfills 14 days.
- `test/verify.test.mjs` holds the arithmetic to hand-worked cases and runs the
  whole job against fake providers, including that no coordinate is published.
- **Starting over**: run the workflow by hand with `fresh` and `backfill` 28 to
  rebuild the record from scratch — what the learned forecast needs, since its
  running sums cannot be rebuilt from the rounded published files. Open-Meteo's
  free tier caps a day at ~10,000 weighted calls: a daily run costs ~7,500, a
  28-day rebuild ~15,000, so a rebuild reaches about two-thirds of the stations
  (2,115 of 3,143 on 2026-10-18) and stops asking once refused; the rest start
  their record with the next daily run, and their learned forecast after ten
  days of it.
- **First numbers** (14 days to 2026-10-16, 3,035 stations, median next-day
  temperature miss): the blend 1.24 °C; NBM and AIFS 1.38; HRRR 1.52; ECMWF
  1.51; the standard forecast 1.50; GFS 1.61. After the 28-day rebuild (to
  2026-10-17, ~2,100 stations): the learned forecast 1.13 °C, the blend 1.16,
  AIFS 1.34, NBM 1.35, the standard forecast 1.47 — and the nowcast's first
  grade, CSI 0.64 at 30 minutes against 0.62 for "nothing moves".

## The room's own predictions

Four forecasts here are made by this site rather than read from someone
else, and every one is graded the same way the models are — a prediction the
record has not backed is never put in front of the standard forecast.

| | What it is | Where it runs | How it is graded |
|---|---|---|---|
| **The blend** | Each model with its proven bias at the station removed, weighted by 1/MAE² (`verify/core.js` `blend`) | the page, and the scoreboard | as a model, every day, every station |
| **The learned forecast** | A per-station ridge regression, the way the NWS's MOS works: the truth against the models' average, each model's lean, and the time of day (`verify/core.js` `learn*`). Running sums fade by 3 % a day; the ridge pulls every term to "the plain average", so thin evidence changes nothing | trained in the scoreboard job; coefficients (`L` in `scores/<ST>.json`, ten numbers, no place) applied by the page | each day is predicted with what was learned *before* it, scored, and only then learned from — every reported number is out of sample |
| **The radar nowcast** | The next hour from the radar itself: the last 30 minutes of IEM's mosaic, motion found by matching rain pixels between frames, the newest frame carried forward, a look that widens with lead time (`nowcast.js`) | the visitor's browser (2×2 zoom-6 tiles × 4 frames, read through IEM's palette — every tile pixel is an exact palette colour, checked 2026-10-17) | `verify/nowcast.mjs` replays yesterday from the archive at six times with the same code and settings (`SETTINGS`), against "nothing moves", over the lower 48; CSI at 15–60 min in `scores/nowcast.json` |
| **Our AI run** | Pangu-Weather (Bi et al., Nature 2023; CC BY-NC-SA 4.0) run by `weather-ai.yml` on GitHub's own CPU from ECMWF's 12Z open data, seven days ahead (~2 min a six-hour step, 10.4 GB) | GitHub Actions, nightly; `ai/extract.py` reads 2 m temperature and 10 m wind at every station into the Actions cache | scored by the morning scoreboard as `pangu`, from the evening before each day only |

Rules: the nowcast is rain timing only — storm arrival stays the warning's own
motion. It shows only in the lower 48 (the mosaic's reach). Its words count
from now, not from the scan, in the place's clock. Pangu has no rain, so it is
graded on temperature and wind; its six-hourly steps are scored on the hours
it has.

The **model comparison** card (`#models`, closed until opened) draws every
model's temperature, rain total or wind for 3 or 7 days from the numbers the
confidence lines already fetch — no extra request — with the standard forecast
dashed and the page's shown forecast bold, and one sentence on where they
split most.

## What comes next, and how it would be built here

| Phase | The likely way on this site |
|---|---|
| 2 · Investigation | A full-screen map; satellite from GOES imagery (check what IEM tiles before building); a point inspector reusing `Wx.forecast` at the tapped point; METAR dots |
| 3 · One serious model | HRRR fields as images. Nothing public tiles them, so this is the first phase that needs a backend: likely a scheduled GitHub Actions job turning HRRR GRIB subsets into tiles in R2. Decide before starting |
| 4 · Soundings | Built (above). Still to do: observed-vs-model on the same diagram (§16), effective-layer parameters |
| 5 · Advanced | Model comparison: built (above). Still to do: ensemble plumes (GEFS/ECMWF ENS members); MRMS |
| 6 · Station + verification | The CS pattern: a script that pulls the station and archives point forecasts into a committed accumulator, verified against the station. **Needs a decision on how the station is named** — its coordinates can't be in this repo |
| 7 · Replay | IEM keeps single-site scans by timestamp (`ridge::SITE-PROD-YYYYMMDDHHMI`, confirmed for the last hour); the mosaic archive needs its tile names confirmed |
| 8 · 3D | Only after profiling, per the doc |
| Push alerts | A web push from the Worker when a warning covers a saved place. Needs the Worker deployed and a key pair as a Worker secret; only ever an extra, never anyone's only warning |
