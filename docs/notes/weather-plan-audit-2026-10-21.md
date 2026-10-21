# Weather room — bug check and plan audit (2026-10-21)

The question this answers: after today's build, what is broken, and how far is
`weather.html` from what `projects/weather/DESIGN.md` describes — "an incredible
weather map that shows all the data people want and is nice to use"?

Checked on the local server (port 8912) with real data for Knoxville, Denver and the
no-place US view, at desktop width and 375px, with the console watched for errors.
`node .github/checks.mjs` was green before and after.

## What was built today

| Change | Where |
|---|---|
| Calm wind says "calm" (no "N 0", no arrow); a gust is only shown beside a wind from the same source | `Wx.isCalm`, hero and wind tile |
| The next-3-hours card no longer just repeats the hero: it labels the model part and says when the next rain is | `renderNext` |
| Radar echoes near a dry station are said as both things, not just "rain is nearby" | `nowcastLine` |
| Sun card: the next sunrise or sunset, the other one, the length of the day and its change | `renderTiles` |
| The page shows whichever forecast has the best record here and can be drawn — including the NWS National Blend, which it was ranking first and not using | `Wx.verdict(…, have)`, `judge`, `applyBlend` |
| Live place search as you type | `search()` |
| Ride outlook card (§21.1): good / care / poor for 1, 2 or 4 hours, every reason listed | `Wx.rideOutlook`, `renderRide` |
| GOES satellite under the radar: infrared, visible, water vapour (§12) | `Wx.SAT`, radar `setSat` |
| Balloon laid over the model at the launch site and hour, with the differences in words (§16) | `past_hours=12` on the column, sky `loadCompare` |
| The room is public: `ROOMS`, every room nav, a tier-0 front-door post, `latest.js` | `terminal.html`, 12 room pages, `index.html` |

## Bug check

Found and fixed while checking, before this audit:

1. **CIN of −14,905 J/kg on a stable night.** With no LFC, `parcel()` integrated
   inhibition up the whole column. It now reports 0 like MetPy, and the table shows
   "–". Test added (`sounding.test.mjs`, "a stable column has none").
2. **The balloon was compared with the model 150 miles away.** The first version laid
   the Nashville balloon over Knoxville's column. The comparison now asks for the
   model's column at the launch site.
3. **"(+-3 h)" as a lead time** for the column's past hours. Now "from an earlier run".
4. **"Next rain in the forecast … (2% chance)"** — a trace of model rain at 2% counted.
   It now needs a 50% chance, or real rain with at least 30%.
5. **The page could claim to show a model it had no hours of** (HRRR or the National
   Blend for a station in Alaska). `judge()` now offers only models that have hours at
   the place, and if nothing changes, the card says the standard forecast is shown.
6. **The accuracy card named its pick before the numbers had loaded.** It now says
   "still loading" / "did not load" until they arrive.
7. **Ride outlook took marine and air-quality alerts as reasons not to ride**, and would
   have ignored a Tropical Storm Warning because of a loose pattern. Marine/air alerts
   are now ignored, fire weather is "care", and the anchor is tested.
8. **"The models, 3 hours" label showed with no radar line above it.** It now follows
   the radar line.
9. **Satellite infrared hid the radar.** IEM colours the coldest cloud tops in the
   radar's own greens and purples. The satellite is now drawn in grey under the radar.
10. **The ingredients timeline would have counted the column's past twelve hours** as
    "the next two days". It now starts at the current hour.

Checked and fine: unit switch, the US view, a national warning tapped onto the radar
with satellite on, mode switches with satellite on, the stored satellite choice, no
sideways overflow at 375px, no text under 11px, no new console errors.

Still open (not bugs in today's code, but worth knowing):

- **The Worker needs a deploy for the balloon comparison through it.** Until
  Actions → Deploy Worker runs, `/wx/col` answers without the past twelve hours. The
  page then says the column "does not reach back to the launch" — honest, but the
  comparison only works on the direct path.
- **Local testing serves stale scripts.** `python -m http.server` sends no cache headers,
  so a reload can keep the old `wx.js`. The `?v=` bumps cover the live site; locally,
  reload with the service worker cleared.
- **The mosaic shows clear-air echoes at night** (birds, insects, ground clutter) as
  light green. That is IEM's unfiltered N0Q; the nowcast already reads it through
  `RAIN_DBZ` and the station check, but the map itself shows it.

## Where the room stands against the plan

| Phase (DESIGN.md §38) | Status | What is missing |
|---|---|---|
| 1 · Excellent normal weather | **Done** | — |
| 2 · Investigation | **About half** | Full map ✓ today (see fixes), satellite ✓, saved places ✓, animated radar ✓. Missing: point inspector, surface observations on the map, a unified timeline across radar and satellite |
| 3 · Forecast models | **Not started on the map** | Model fields as map layers (HRRR temperature, wind, simulated radar). Point model data exists (comparison chart, soundings) but nothing is drawn spatially |
| 4 · Soundings | **Done** | Effective-layer parameters (effective SRH, effective bulk shear, effective STP) |
| 5 · Advanced meteorology | **Started** | Model comparison chart ✓. Missing: cross-sections, CC/ZDR/KDP (IEM does not tile them), MRMS, ensembles with members/plumes |
| 6 · Station + verification | **Verification done; station not started** | The personal station waits on a decision about how to name it without coordinates |
| 7 · Historical replay | **Not started** | IEM keeps single-site scans by timestamp; the mosaic archive naming needs confirming |
| 8 · 3D | Not started, by design | Only after profiling |

Against §39's MVP list: 1–6 are done; 7 (interactive map) is partly done; **8 (point
inspection), 9–11 (one serious model on the map, with a time slider and variables) are
the gap**; 12 (model sounding) is done; 13 (smooth on ordinary hardware) holds today.

## The gaps that matter most, ranked

For "an incredible weather map that shows all the data people want":

1. **The map is a card in a column.** At 340px tall inside an 820px column it is a
   thumbnail of a map. A full-screen map is the single biggest step toward the plan's
   "primary spatial workspace" (§10). → *fixing now.*
2. **Tapping the map does nothing.** §5's "see → tap → investigate" stops at the map.
   A point inspector (§10.3) — tap anywhere, get that point's weather and "forecast
   here" — is cheap: the page already has the requests. → *fixing now.*
3. **No model fields on the map** (Phase 3, MVP 9–11). This is the largest piece of
   work left. IEM lists HRRR reflectivity tile layers
   (`hrrr::REFD-F0060-<run>` answered on 2026-10-21) but returned blank tiles where
   HRRR had rain, so the naming needs confirming with IEM before relying on it. Failing
   that, it needs a backend (HRRR GRIB → tiles in R2 from a scheduled job), which is
   **Ric's decision** (cost, a new moving part).
4. **No surface observations on the map** (§19.1). IEM serves current ASOS observations
   as GeoJSON per state network. That needs a new `/wx` route (and a Worker deploy) and
   station dots that open their own reading. A good next step after the inspector.
5. **No lightning** (§12, §21). There is no free, keyless public lightning feed the page
   can use (GLM gridded products are in GRIB/NetCDF on AWS). The ride outlook says so
   instead of pretending. A GLM pipeline would also need a backend.
6. **Satellite does not animate** and has no scan time: IEM's tiles carry neither. A
   timed GOES source would fix both (also a backend question, or IEM's archive API).
7. **Hourly does not show wind** (§9.1 says hourly should emphasise wind and gusts).
   → *fixing now.*
8. **A failed radar tile stays blank** (§35.5 asks for retry). → *fixing now.*
9. **Ensemble spread** (§17.2): the confidence dots use five deterministic models, not
   an ensemble. Open-Meteo has an ensemble API (GEFS/ECMWF ENS members) — plumes for
   temperature and rain probability would be a clear win and need one new route.
10. **Effective-layer severe parameters** (Phase 4 remainder) — pure arithmetic in
    `sounding.js`, held to MetPy like the rest.
11. **Push alerts for saved places** — needs the Worker, a key pair as a secret, and
    stays an extra, never anyone's only warning.

## Decisions for Ric

- **HRRR fields on the map:** wait on IEM's tile naming, or build a small GRIB → tiles
  job (GitHub Actions + R2)? This is Phase 3 and the biggest step toward the plan.
- **Personal weather station (§19.2):** what it is and how to name it without its
  coordinates in the repo.
- **Lightning:** worth a backend job, or leave it as "no lightning feed" for now?
- **Deploy the Worker** so the balloon comparison works through it, and before adding
  the observations route.

## Fixing now (from this audit and the layout audit)

Full-screen map · point inspector on the map · wind in the hourly strip · retry for
failed radar tiles · radar moved up the page · the layout items in
`weather-layout-audit-2026-10-21.md`.

## Found while fixing

- **"Now" in the mountains was a station 750 m lower.** For a point near Vail (3,240 m)
  the nearest station sat at 2,484 m and read 40° against the forecast's 30°. Then,
  passed over, the next one was 62 miles away. Stations are now taken only within
  300 m of the place's height and 40 km of it (`ELEV_MAX_M`, `OBS_MAX_M`); past
  those the model speaks, and the sources card says "no recent report nearby".
- **"Now" and the hours came from two forecasts.** Where the record picks a forecast
  other than the standard one, the hero's "now" was still the standard forecast's
  (35° next to an hourly 30°). "Now" now comes from the shown forecast, interpolated to
  the minute, and the hero names it.

## Done in this pass — all verified in the browser

| Fix | Checked |
|---|---|
| Radar moved up to straight after the 10-day forecast | page order read back |
| Full-screen map (button in the zoom stack, Esc leaves), 420px map on wide screens | opened, drawn, left with Esc |
| Tap a point on the map: its name, weather now, high/low, "Forecast here" | tapped near Vail; "Forecast here" made it the place |
| Wind in the hourly strip, with gusts 10 mph over | read back |
| A failed map tile is asked once more | code path; not forced in the browser |
| Station height and distance limits; "now" from the shown forecast | Vail, before and after |
| Layout items (control rows, two-up tiles, ride buttons, footnote size) | 375px screenshots |

Left for later, in order: ~~surface observations on the map~~ and ~~ensemble plumes~~
(both done the same day, below), effective-layer parameters, then the HRRR-on-the-map
decision.

## Follow-up: stations on the map (gap 4) — done 2026-10-21

Every airport (ASOS) station in the forecast offices covering the view, from zoom 6 in:
a chip with its temperature in its own colour, a tail from where the wind comes, and a
tap for every field it sent plus its raw METAR, with "Forecast here". IEM's
`currents` API by office (`/wx/iem/obs?wfo=`), about 25 KB each — the whole country is
3.3 MB with no compression, so it is never asked for. Checked at desktop and 375px in
Tennessee (57 stations), the station card fitting a phone's 300px map, the national view
asking to zoom in, and the toggle remembered. **The Worker needs a deploy** for the new
route; until then the page asks IEM directly, which works.

## Follow-up: ensemble plumes (gap 9) — done 2026-10-21

"Compare the models" has a second view, **Ensemble · 82 runs**: every member of GEFS
(31) and ECMWF ENS (51) for a week, as faint lines under a middle-80% band and the
middle run, with the standard forecast dashed; each day's chance of rain as the share
of runs with 1 mm or more, and the spread of the runs' highs. One request to
Open-Meteo's ensemble API (`/wx/plume`), 18 KB as sent, only when the view is opened.
Checked for Seattle (rain chances of 44–50% over the weekend) at desktop and 375px.
The confidence dots on the 10-day list still come from the five deterministic models;
moving them onto the ensemble is the natural next step once its record can be scored.
Needs the same Worker deploy.

## Follow-up: effective-layer parameters (gap 10) — done 2026-10-21

The effective inflow layer, effective SRH and bulk shear, effective STP (with its CIN
term) and the supercell composite, in the parameter grid and the glossary; the
ingredients timeline's STP row is now the effective one. STP and SCP match MetPy's
`significant_tornado` and `supercell_composite` term for term, and effective SRH matches
`storm_relative_helicity` over the same layer (64.92 m²/s²). That comparison found the
helicity loop stopping up to 99 m short of a layer top that is not a round number — 2%
low — fixed.

## Follow-up: the first model on the map (gap 3, part) — done 2026-10-21

**Future · HRRR** on the radar: the HRRR's simulated reflectivity for the next 18 hours.
IEM's HRRR *tiles* came back blank, but it also publishes each step as one lat/lon
picture of the lower 48, which the page reprojects onto the map itself. Checked against
the live radar at the national view (the Arizona storms and the New England rain sit
where the radar has them), played through 22 frames with no errors. The pictures are
opaque — rain on black — which first blacked out the map; a `screen` blend on the
frame layer fixed it (on the canvas alone it did nothing, because the layer's opacity
isolates it). Temperature, wind and CAPE as map fields still need a source — that part
of gap 3 stays Ric's decision.

## Follow-up: replay (Phase 7) — done 2026-10-21

**Replay** on the radar: pick any time since 2006 and 2, 3 or 6 hours, or one of four
notable storms (27 Apr 2011, Moore 2013, the December 2021 quad-state tornado, Rolling
Fork 2023). The national mosaic as it was, from IEM's archive tiles, with every
storm-based warning drawn only for the minutes its polygon was in force. A notable
storm fits the map to its own warnings, so the page holds a time and no place.
Checked on 27 April 2011: 378 warnings, the tornado warnings around Tuscaloosa and
Birmingham at 22Z sitting on the supercells under them. The first try showed the
warnings over an empty map — playing asked IEM for every frame's archive tiles at
once, and IEM renders those on demand; a replay now loads the frame on screen and the
next, and the loop waits for a frame's tiles. Needs the Worker deploy for its warnings
route (it falls back to IEM directly meanwhile).

## Follow-up: cross-sections (§18) — done 2026-10-21

The map's new cross-section button, then two taps: under the map, a slice through the
atmosphere from A to B from HRRR (or GFS outside the lower 48) — humidity or wind
shaded, potential temperature as lines, the ground in brown, twelve hours on a slider.
One Open-Meteo request for twelve columns along the line. Checked on a 700-mile line
across the southern Plains: the mid-level moist layer, the stable layers where the
lines pack, the High Plains rising under A, and the jet core near 300 hPa in the wind
view. The first drawing had the pressure axis upside down (the ground filled the whole
panel) — fixed and re-checked at desktop and phone width.

## Final check (2026-10-21, end of the day)

Every radar mode switched through with satellite on and off, stations toggled,
units switched, a replay entered and left, and a cross-section drawn — no errors. The
check found one race: switching modes faster than a request answers (Reflectivity then
Velocity) could leave the older mode's frames under the newer button. `setMode` now
lets only the newest switch finish, and a replay counts as a switch. Re-checked with
four switches 150 ms apart: it lands cleanly on the last one.

### Where the plan stands now

| Phase | Status |
|---|---|
| 1 · Normal weather | Done |
| 2 · Investigation | Done except a unified timeline across radar and satellite (satellite tiles carry no time) |
| 3 · Forecast models | HRRR future radar on the map. Other fields as map layers need a source — **Ric** |
| 4 · Soundings | Done, effective-layer parameters included |
| 5 · Advanced | Model comparison, ensembles, cross-sections done. MRMS and dual-pol need a source IEM does not tile |
| 6 · Station + verification | Verification done. The personal station needs **Ric** (what it is, how to name it with no coordinates) |
| 7 · Replay | National radar and warnings done. Satellite and model runs for a past moment not yet |
| 8 · 3D | Not started, by design |

### What needs Ric

1. **Run Actions → Deploy Worker.** Five new `/wx` routes (stations, plumes, HRRR run,
   replay warnings, cross-sections) and the balloon column's past hours. Until then each
   falls back to asking the provider directly, which works.
2. **Model fields on the map** (temperature, wind, CAPE): wait for a public tiled source,
   or build a GRIB → tiles job (GitHub Actions + R2).
3. **Lightning:** a backend job for GLM, or leave the ride outlook saying there is no
   lightning feed.
4. **The personal weather station.**
5. **Push alerts for saved places:** needs a key pair as a Worker secret.

Layout note: on a phone the radar's first row (US mosaic … Replay, Stations, SPC
outlook) scrolls sideways, so the later buttons start out of sight. Worth a second look
if Ric finds them hard to find.

## Later the same day: two pages, and no ride outlook (Ric's decisions)

- **The room is now two pages.** Weather (`weather.html`) — now, the next three
  hours, hourly, ten days, a plain radar loop, the tiles — and Weather Pro
  (`weather-pro.html`) — the full map with every layer, the soundings, the models
  and ensemble, the accuracy record. A Weather | Pro switch tops both; the place
  carries across; warnings and storm mode stay on both. The page code and styles
  moved into `assets/weather/app.js` and `weather.css`, shared by both. On Pro the
  map starts at once rather than when scrolled to, because it is the page.
- **The ride outlook is gone**, everywhere — card, `Wx.rideOutlook`, its tests and
  its mentions — and a test now fails if a go/no-go verdict comes back. Ric: "this
  should be information, not something that could make it unsafe." The ride outlook
  entries above are history.
- Checked: both pages at desktop and 375px, the place carried from one to the other,
  Pro's map with 58 stations and the sounding and models loaded, the simple page's US
  view still leading with the national warnings, no console errors, nothing over
  the edge, nothing under 11px.
