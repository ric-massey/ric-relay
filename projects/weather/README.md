# Weather — the sky over you

The weather room is **two products, one tap apart** (Ric, 2026-10-21: "like two
different products — weather is the app that is simple, weather pro is the app for
professionals"):

- **Weather** (`weather.html`) — what most people want: now, when the rain
  starts, every hour, ten days, alerts, a plain radar loop, the detail tiles.
- **Weather Pro** (`weather-pro.html`) — what someone chasing or studying weather
  wants: a big map with every layer (one radar's own Level III products —
  reflectivity, velocity, storm-relative velocity, CC, ZDR, KDP, hydrometeor
  class, echo tops, VIL — at four tilts; HRRR and GFS model maps; HRRR future
  radar; replay; satellite; GOES lightning; the NWS's storm reports; airport
  stations; SPC outlook; cross-sections; tap-a-point), the soundings, the models
  side by side and the ensemble, and the accuracy record.

They look like different apps on purpose. Weather is the sky: the colour follows
what is overhead, frosted cards, big friendly numbers, and a **gold ★ Pro badge**
in the top bar's corner that opens Weather Pro. Weather Pro is an instrument:
near-black panels, hairline rules, monospaced data, square corners, one amber
accent, a WEATHER PRO wordmark, and **← Weather** to go back. On a wide screen it
is a workspace — the map docked on the left, sized to fit the screen whole, and the
readouts (now, alerts, the sounding, the models, the record) in a panel beside it;
on a phone they stack. Its look lives in the second half of
`assets/weather/weather.css`, under `body[data-view="pro"]`; every text colour
there is checked at 4.5:1 or better.

Warnings and storm mode are on
both — a warning has to reach the people who never open Pro. The chosen place is
shared (this browser's `localStorage`), so switching keeps it. Both pages load the
same code, `assets/weather/app.js`, and the same stylesheet,
`assets/weather/weather.css`; each page holds only its own cards and the code
draws what is there (`body[data-view]` is `simple` or `pro`). The radar card's
markup is the same on both; the simple page hides Pro's controls (`.pro-only`).

**There is no ride outlook, and there will be no go/no-go verdicts.** One was built
and removed the same day — Ric: "this should be information, not something that
could make it unsafe." `test/wx.test.mjs` fails if one comes back.

**[`DESIGN.md`](DESIGN.md) is Ric's design document and the source of truth for
what the room becomes** (its top lists the decisions made since); this file is how
it is built here and what is built so far. Terminal: `weather` (or `wx`,
`forecast`, `radar`, `rain`).

It is **listed** since 2026-10-21 — in `ROOMS`, in every room nav, and a tier-0
post on the front door (the `radar` painter, over invented ground).

| File | What it is |
|---|---|
| `../../weather.html` | **Weather**: the hero, the next three hours, hourly, ten days, a plain radar, the tiles, the place sheet |
| `../../weather-pro.html` | **Weather Pro**: the hero, the full map, the air above you, the models and ensemble, the accuracy record |
| `../../assets/weather/app.js` | the page code both load — every card, the map, the place sheet; it draws the cards the page holds and skips the rest |
| `../../assets/weather/weather.css` | the stylesheet both load (shared within the room, as climbing's and training's are) |
| `wx.js` | everything that talks to a provider, turns its answer into one shape, or decides what the page may say (is it raining, how old is this, where is the storm). Pure functions are exported for Node |
| `nexrad.js`, `bzip2.js` | Pro's single-site radar: NEXRAD Level III files read in the browser (the ICD's description and symbology blocks, packet 16 and AF1F), and the bzip2 decompressor the dual-pol files need. Product list, palettes, the beam-height formula |
| `grib2.js`, `modelmaps.js` | Pro's model maps: a GRIB2 reader (lat/lon and Lambert grids; simple, complex and spatially-differenced packing) and the HRRR / GFS field list — which `.idx` lines each field needs, its unit, palette, contours and barbs |
| `glm.js` | Pro's lightning: just enough HDF5 (superblock 2/3, object headers, dense links and attributes, chunked deflate+shuffle) to read the GOES lightning mapper's flashes, by byte range |
| `sounding.js` | the vertical arithmetic: parcels, CAPE / CIN / LCL / LFC / EL, precipitable water, lapse rates, shear, Bunkers storm motion, helicity, STP |
| `draw.js` | the Skew-T and the hodograph, as SVG strings |
| `verify/core.js` | the scoreboard's arithmetic and the blend — loaded by the page and by `score.mjs` |
| `verify/score.mjs` | the daily scoring job (below) |
| `verify/scores/` | what it publishes: rounded records per state, no coordinates |
| `../../weather.webmanifest`, `../../weather-sw.js`, `../../assets/weather/` | the home-screen app |
| `DESIGN.md` | the design document |
| `test/wx.test.mjs` | the client's rules on fixtures, no network. In `.github/checks.mjs`. Also holds the Worker's `/wx` route to every request the page makes |
| `test/sounding.test.mjs` | the sounding arithmetic, against hand-checkable physics and against MetPy (pinned values). In `checks.mjs` |
| `test/decoders.test.mjs` | the four decoders against the libraries the field trusts — MetPy (Level III), ecCodes (GRIB2), h5py (GLM), Python's bz2 — on real files in `test/fixtures/` (`make-expected.py` wrote `expected.json` from them; rerun it by hand when adding a fixture). In `checks.mjs` |
| `test/live.mjs` | the same functions against the real providers. Needs the network, so it runs in `.github/workflows/weather-live.yml` (on change, daily, on demand) |

## Who answers what (DESIGN.md §24)

| Question | Provider | Notes |
|---|---|---|
| The numbers — now, hourly, 10 days, rain every 15 min | [Open-Meteo](https://open-meteo.com/) `/v1/forecast` | Global, keyless, CC BY 4.0. "Best match" blend — HRRR and GFS in the US. Always asked in metric; the page converts |
| What a real station measured | NWS `api.weather.gov` — `/points` → `/stations` → `/observations/latest` | Nearest station with a temperature in the last 90 minutes, next one along if it has gone quiet — but only within 40 km and 300 m of height of the place (`OBS_MAX_M`, `ELEV_MAX_M`): in the mountains the nearest one sat 750 m lower and read 9 °F warm. Past those, the model speaks for "now". US only |
| The forecast office's own words | NWS `/gridpoints/…/forecast` | Shown under each day of the 10-day list, labelled as the office's |
| Official alerts | NWS `/alerts/active?point=` | Shown as issued, worst first; polygons drawn on the radar |
| Radar | NOAA NEXRAD base reflectivity, US composite, via [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu/) tiles | Latest plus one layer per 5 minutes back to 50; `n0q_0.json` says when the latest was scanned. Lower 48 only |
| Cross-sections | Open-Meteo, one model (HRRR when both ends are in its lower 48, GFS otherwise), 12 points evenly along the line in one multi-place request (`/wx/xsec`, `Wx.xsec`), every level 1000–200 hPa, 12 hours, ~115 KB | The map's cross-section button, then two taps; lines over 1,500 km are refused. Drawn under the map: humidity or wind speed shaded, potential temperature every 4 K by marching squares, the ground from each column's surface pressure. The taps are rounded like any place and kept nowhere |
| Replay | IEM's mosaic archive tiles (`Wx.archiveTile`) and its storm-based warnings archive (`/wx/iem/sbw`, at most 12 hours, cached a week once a window is a day old) | Frames every 5 minutes for 2 hours, every 10 for longer. Archive tiles are rendered by IEM on demand and slow, so only the frame on screen and the next one load, and the loop waits for a frame's tiles. Today's satellite, stations and warnings are hidden in a replay. The notable storms carry a time and nothing else — the map fits itself to the warnings it fetches, so no place is written into the page (hard rule 1) |
| Future radar | The latest HRRR run's simulated reflectivity from IEM, one lat/lon picture per step (`/data/gis/images/4326/hrrr/refd_MMMM.png`, 3050×1340 at 0.02° from 126° W, 50° N; `refd_0000.json` says when the run started, through `/wx/iem/hrrrmeta`) | Reprojected onto the map in 2 px strips (`paintHrrr`); only the frame on screen is painted. The pictures are rain on opaque black, so the layer blends with `screen`. Labelled a forecast wherever it shows; the sources card flags a run older than 3 hours |
| Stations on the map | IEM's current ASOS readings, one forecast office at a time (`/api/1/currents.geojson?networkclass=ASOS&wfo=XXX&minutes=90`, `Wx.stationObs`) | The offices covering the view come from the NWS's `/points` for the middle and four points around it, looked up once per half-degree. One office is ~25 KB; the whole country is 3.3 MB uncompressed, so it is never asked for. From zoom 6 in, every five minutes; a chip with the temperature, a tail from where the wind comes, tap for every field and the raw METAR. Positions are read at run time, never kept (hard rule 1). On by default; the Stations button turns it off for this browser |
| Watches, mesoscale discussions, rainfall discussions (Pro) | SPC watches and MDs, WPC MPDs, as IEM's GeoJSON (`/api/1/nws/spc_watch_outline.geojson`, `nws/spc_mcd.geojson`, `nws/wpc_mpd.geojson`; `Wx.proOverlays`) | Drawn as issued — tornado watches gold, severe pink, MDs and MPDs dashed — and dropped the minute they expire. Tap one for its number, its end time and SPC's or WPC's own page. Every two minutes |
| Storm cells (Pro) | Each NEXRAD's own storm-tracking table, via IEM (`/geojson/nexrad_attr.geojson`, `Wx.normalizeCells`) | From zoom 6: a core coloured by its strongest echo, ticks 15–60 min ahead along the radar's own motion, a green ring for hail, yellow for a mesocyclone, a red triangle for a TVS. Tap one for the radar's numbers. Cells older than 20 minutes are dropped. What the radar measured, never a warning |
| Fronts, highs and lows (Pro) | WPC's coded surface analysis (the NWS's `CODSUS` bulletin, `products/types/COD`, `Wx.parseCodsus`) | Cold, warm, stationary and occluded fronts with their pips on the correct side (checked against the real bulletin), and the H/L centres with their pressure. Every 30 minutes; the sources card says when the analysis was valid and flags one older than 6 hours. Off by default |
| Station plots (Pro) | The same IEM station readings as the chips | From zoom 8 the chips become the standard station model: wind barb, sky cover, temperature, dewpoint, weather and pressure, spaced so none overlap |
| Forecast discussion (Pro) | NWS `products/types/AFD/locations/{office}` → `products/{id}` | The place's office's latest discussion, split into its own sections, the first two open — as written, never summarised |
| SPC mesoanalysis (Pro) | `spc.noaa.gov/exper/mesoanalysis/s{sector}/{field}/{field}.gif` | SPC's own hourly maps, shown as SPC draws them, for twelve regions and thirteen fields; the choice is kept in this browser. Images only, from the provider directly |
| Satellite | GOES-West and GOES-East via IEM tiles (`goes-{west,east}-{ir-4km,vis-1km,wv-4km}-900913`, `Wx.SAT`) | Under the radar, West drawn first and East over it. Latest image only: the tile carries no scan time, so the page says "latest" and nothing finer. Visible is dark at night and the page says so |
| Storm warnings across the country, and a state's | NWS `/alerts/active?event=…` and `?area=XX` | The national list with no place; "warnings nearby" with one |
| SPC convective outlook | `spc.noaa.gov/products/outlook/day{1,2,3}otlk_*.nolyr.geojson` | Categorical risk with SPC's own labels and colours; drawn on the radar, and "Slight risk … here today" in the hero |
| Single-site radar (Weather, and storm mode) | IEM `json/radar.py` (nearest sites, scan list) and `ridge::<SITE>-<PROD>-<YYYYMMDDHHMI>` tiles | Super-res reflectivity (N0B) and storm-relative velocity (N0S), every scan in the last hour. IEM does not tile CC, ZDR, KDP or echo tops (probed 2026-10-17) |
| Single-site radar (Pro) | The radar's own Level III files in Unidata's public bucket, `unidata-nexrad-level3` on AWS (`SITE_PROD_YYYY_MM_DD_HH_MM_SS`, CORS open), read by `nexrad.js` | Nine products — N0B–N3B, N0G/N1G/N2U/N3U, N0S, N0C–N3C, N0X–N3X, N0K–N3K, N0H–N3H, EET, DVL — at the tilt picked (the button says the elevation the scan was made at). The bucket is listed by the hour; the newest twelve scans make the loop, each fetched only when shown or played (50–250 KB). Painted pixel by pixel from range and bearing; hover or tap gives the gate's value, its distance and bearing, and the beam's height above sea level (4/3 earth). The nearest site still comes from IEM's `radar.py` |
| Model maps (Pro) | NOAA's HRRR (`noaa-hrrr-bdp-pds`, `wrfsfcfNN`) and GFS (`noaa-gfs-bdp-pds`, `pgrb2.0p25.fNNN`) on AWS, read by `grib2.js` / `modelmaps.js` | The newest run with enough of itself out (the bucket is listed; HRRR's must have 3 hours, GFS's 30). Each hour's `.idx` says where each field's bytes are and only those are fetched with a Range request — ~1 MB a field. HRRR: reflectivity, precipitation type, updraft helicity, three CAPEs, 0–1/0–3 km helicity, echo tops, lightning threat, temperature, dew point, wind and gusts, MSLP, visibility, cloud, rain and snow totals, PWAT. GFS (3-hourly to 5 days, 6-hourly to 10): 500 mb heights and vorticity, the 250 mb jet, 850 mb, MSLP and thickness, the surface fields, rain, PWAT, snow depth. HRRR's winds are turned from its grid to the earth before barbs are drawn. Labelled a forecast, with its run, everywhere it shows |
| Lightning (Pro) | GOES-East (`noaa-goes19`) and GOES-West (`noaa-goes18`) GLM Level 2 files on AWS, every 20 s, read by `glm.js` | Flashes, not ground strikes. The last 10 minutes, asked again every minute while the layer is on and the page is visible; East east of 105° W, West west of it (they overlap and see the same flashes). ~150 KB a file in Range requests; the attributes are read from the first file and reused. Only flashes the GLM flags good |
| Storm reports (Pro) | IEM's `geojson/lsr.geojson?hours=24` (`/wx/iem/lsr`) | The NWS's local storm reports, as each office issued them, every two minutes. Severe ones (tornado, funnel, 1" hail, damaging or 58 mph thunderstorm wind, flash flood) at every zoom, the rest from zoom 7. Tap one for the magnitude, who reported it and the remark. A report, not a verified event, and the card says so |
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
a point's office a day), and sends the User-Agent the NWS asks for. It is
deployed (every route answered on 2026-10-21); a change to `wxUpstream` goes
live only when Actions → Deploy Worker runs, and until then the page's direct
path covers it. Images (map, radar and satellite tiles) always load directly.

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
- **Raw NOAA files are decoded in the browser, not on a server** (Ric,
  2026-10-22: "do the three" — dual-pol radar, lightning, model maps). The
  radar's Level III files, the GLM's HDF5 and the models' GRIB2 come straight
  from NOAA's open-data buckets on AWS, which allow any page to read them, and
  are decoded by `nexrad.js`, `glm.js` and `grib2.js` — written here, no
  library. Nothing is stored and nothing runs between visits. These are binary
  files from a bucket, so they go direct like the map's tiles rather than
  through `/wx`. Each decoder is held to MetPy, ecCodes or h5py in
  `test/decoders.test.mjs`; change the decoder and the fixtures' expectations
  together. Anything that would need a server of our own (a mosaic of every
  radar, MRMS, a model run turned into tiles) is still a decision for Ric.

## Built so far

**Phase 1** (DESIGN.md §38): location (search, my location, saved places),
current conditions, rain timing (next 3 hours in 15-minute steps), hourly with a
tap-for-detail hour, 10 days with the office's words, alerts with polygons,
animated radar, wind / humidity / pressure trend / visibility / UV / sun, °F/°C,
offline copy, refresh every ten minutes while open.

**Weather Pro's own data (2026-10-22, Ric: "do the three"):** one radar's
Level III products at four tilts, with a value readout; HRRR and GFS model maps
with contours and barbs, played through the forecast hours; GOES lightning; and
the NWS's storm reports — all above, under "Who answers what". Share links
carry the tilt (`t=`) and the model field (`m=hrrr.mlcape`).

**Weather Pro's tools (2026-10-22):** the overlays above; a **sounding anywhere** — tap a
point and "Sounding here" moves the Skew-T to it, with a way back to the place; a
**ruler** — tap points, read each leg's bearing and the total; and a **share link** that
opens the same view — the map's middle to one decimal (about 10 km), its zoom, the layer,
the satellite and the overlays, never the visitor's saved place.

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
- **What the page shows** (`applyBlend` in the page, `blend()` in
  `verify/core.js` — the same function the scoreboard scores): the hourly
  temperatures and each day's high and low come from whichever forecast the
  nearest station's record ranks best **and** the page can draw — our blend,
  our learned forecast, or a model it already holds hour by hour (`ENSEMBLE`:
  the NWS National Blend, HRRR, GFS, ECMWF, AIFS) — and only when that beats
  the standard forecast by a clear margin (`Wx.verdict`; a tie is not a win, a
  record under `minDays` is not ranked, and Pangu, run off-site, is ranked but
  never shown). A model that stops early (HRRR, two days) hands back to the
  standard forecast where it ends. Rain and wind stay the standard forecast's.
  The day's details and the accuracy card say which forecast is on screen, and
  the card says so honestly if its numbers have not loaded.

## The everyday side

- **Calm is "calm"** (`Wx.isCalm`, under 1.5 km/h): no direction, no arrow, and a
  gust is only said beside a wind from the same source.
- **The next-3-hours card** adds when the forecast next has rain, so it says more
  than the hero's line; when echoes near a dry station would read "rain is
  nearby", it says the station reports no rain too.
- **Balloon on top** (§16): in a model sounding, lays the nearest balloon's latest
  flight over the model's column **at the launch site** at the launch hour (the
  column carries twelve past hours, `past_hours=12`), with the differences at
  850, 700 and 500 hPa in words.

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

Its other view, **Ensemble · 82 runs** (§17.2), asks Open-Meteo's ensemble API for
every member of GEFS (31) and ECMWF ENS (51) for a week — one request, ~150 KB, 18 KB
as sent, only when opened (`/wx/plume`, `Wx.plumes`). Each run is a faint line, the
middle 80% a band, the middle run bold, the standard forecast dashed; under it, each
day's chance of rain (the share of runs with ≥ 1 mm, `Wx.plumeStats`) and the middle
80% of the runs' highs, and two sentences on the wettest and least certain day. The
runs are the models' own, uncorrected, and the card says so.

The **model comparison** card (`#models`, closed until opened) draws every
model's temperature, rain total or wind for 3 or 7 days from the numbers the
confidence lines already fetch — no extra request — with the standard forecast
dashed and the page's shown forecast bold, and one sentence on where they
split most.

## What comes next, and how it would be built here

| Phase | The likely way on this site |
|---|---|
| 2 · Investigation | Built: satellite (GOES IR / visible / water vapour under the radar), a full-screen map, a tapped-point card, airport stations on the map. Still to do: a unified timeline across radar and satellite; more networks than ASOS (state mesonets) |
| 3 · One serious model | Built: **Future · HRRR** (IEM's simulated-reflectivity pictures) and, since 2026-10-22, **Models** — HRRR and GFS fields read from NOAA's GRIB2 in the browser (above). Still to do: more models (NAM 3 km, RAP, the ECMWF open data), run-to-run comparison, ensemble maps |
| 4 · Soundings | Built (above), with observed-vs-model on the same diagram (§16) and the effective-layer parameters: the effective inflow layer (Thompson 2007), effective SRH and bulk shear, effective STP (Thompson 2012, with its CIN term) and the supercell composite. The composites and the effective SRH are held to MetPy in `test/sounding.test.mjs` |
| 5 · Advanced | Model comparison, ensemble plumes, cross-sections, dual-pol radar at four tilts (Level III, 2026-10-22): built. Still to do: MRMS (rotation tracks, MESH); single-site replay from the same bucket |
| 6 · Station + verification | The CS pattern: a script that pulls the station and archives point forecasts into a committed accumulator, verified against the station. **Needs a decision on how the station is named** — its coordinates can't be in this repo |
| 7 · Replay | Built for the national radar: any 2, 3 or 6 hours since 2006 from IEM's archive tiles (`ridge::USCOMP-N0Q-<YYYYMMDDHHmm UTC>`, N0R before 2011 — the names IEM's own viewer uses), with each storm warning drawn only for the minutes its polygon was in force (`/api/1/vtec/sbw_interval`), and four notable storms that fit the map to their own warnings. Still to do: satellite, observations and model runs for the same moment; single-site replay |
| 8 · 3D | Only after profiling, per the doc |
| Push alerts | A web push from the Worker when a warning covers a saved place. Needs the Worker deployed and a key pair as a Worker secret; only ever an extra, never anyone's only warning |
