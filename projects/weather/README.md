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
| `wx.js` | everything that talks to a provider, turns its answer into one shape, or decides what the page may say (is it raining, how old is this). Pure functions are exported for Node |
| `DESIGN.md` | the design document |
| `test/wx.test.mjs` | the client's rules on fixtures, no network. In `.github/checks.mjs`. Also holds the Worker's `/wx` route to every request the page makes |
| `test/live.mjs` | the same functions against the real providers. Needs the network, so it runs in `.github/workflows/weather-live.yml` (on change, daily, on demand) |

## Who answers what (DESIGN.md §24)

| Question | Provider | Notes |
|---|---|---|
| The numbers — now, hourly, 10 days, rain every 15 min | [Open-Meteo](https://open-meteo.com/) `/v1/forecast` | Global, keyless, CC BY 4.0. "Best match" blend — HRRR and GFS in the US. Always asked in metric; the page converts |
| What a real station measured | NWS `api.weather.gov` — `/points` → `/stations` → `/observations/latest` | Nearest station with a temperature in the last 90 minutes, next one along if it has gone quiet. US only |
| The forecast office's own words | NWS `/gridpoints/…/forecast` | Shown under each day of the 10-day list, labelled as the office's |
| Official alerts | NWS `/alerts/active?point=` | Shown as issued, worst first; polygons drawn on the radar |
| Radar | NOAA NEXRAD base reflectivity, US composite, via [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu/) tiles | Latest plus one layer per 5 minutes back to 50; `n0q_0.json` says when the latest was scanned. Lower 48 only |
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

- **No place is ever in this repo (hard rule 1).** A place comes from the
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
- **Not built here:** anything that would need a server decoding GRIB or radar
  volumes. The browser gets small finished answers (§28–29); when a phase needs
  more than a public API gives, that is a decision for Ric, not a library to add.

## Built so far — Phase 1 of DESIGN.md §38

Location (search, my location, saved places), current conditions, rain timing
(next 3 hours in 15-minute steps), hourly with a tap-for-detail hour (the first
piece of the global "selected time"), 10 days with the office's words, alerts with
polygons, animated radar (drag, zoom, 50-minute loop, scan age, stale warning),
wind / humidity / pressure trend / visibility / UV / sun, °F/°C, offline copy,
refresh every ten minutes while open.

## What comes next, and how it would be built here

| Phase | The likely way on this site |
|---|---|
| 2 · Investigation | A full-screen map view of the same slippy map; satellite from GOES imagery (check what IEM serves as tiles before building); a point inspector reusing `Wx.forecast` at the tapped point; METAR dots from `aviationweather.gov` or NWS stations |
| 3 · One serious model | HRRR fields as images. No public service tiles HRRR fields the way IEM tiles radar, so this is the first phase that may need a real backend (a small job turning GRIB into tiles). Decide before starting |
| 4 · Soundings | Open-Meteo already serves HRRR/GFS on pressure levels (temperature, humidity, wind at 1000…100 hPa) for a point, so a model Skew-T and hodograph can be drawn in the browser with no backend. Observed soundings: IEM's upper-air (RAOB) archive |
| 5 · Advanced | Model comparison via Open-Meteo's `models=` parameter; MRMS and single-site radar products — see what IEM tiles |
| 6 · Station + verification | The CS pattern: a script that pulls the station and archives point forecasts into a committed accumulator, verified against the station. **Needs Ric's call on where the station is** — its coordinates can't be in this repo |
| 7 · Replay | IEM archives the radar composite by timestamp, which should cover the radar half — confirm its tile names first |
| 8 · 3D | Only after profiling, per the doc |
