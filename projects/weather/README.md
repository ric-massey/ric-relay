# Weather — the sky over you

The weather room is **two products, one tap apart** (Ric, 2026-10-21: "like two
different products — weather is the app that is simple, weather pro is the app for
professionals"):

- **Weather** (`weather.html`) — what most people want: now, when the rain
  starts, every hour, ten days, alerts, a plain radar loop, the detail tiles.
- **Weather Pro** (`weather-pro.html`) — what someone chasing or studying weather
  wants: a big map with every layer (one radar's own Level III products —
  reflectivity, velocity, storm-relative velocity, CC, ZDR, KDP, hydrometeor
  class, echo tops, VIL — at four tilts, or the full Level II volume at every
  tilt; MRMS rotation tracks, hail size and rain totals; GOES imagery straight
  from NOAA — all sixteen bands and the RGB composites, the lower 48 every five
  minutes or a mesoscale sector every minute; a mesoanalysis computed SPC's
  way every hour (the HRRR's analysis hour, in the browser, when it is late); HRRR, GFS, ECMWF and AIFS model maps, the severe
  composites, HRRR-TLE storm probabilities and the GEFS ensemble's mean,
  spread, spaghetti and chances; HRRR future radar; replay of the mosaic or of
  one radar's full volume from the Level II archive; satellite tiles; GOES
  lightning, flash density and each storm's
  flash rate and lightning jump; the NWS's storm reports; airport
  stations; SPC outlook; cross-sections; tap-a-point; state, county and town
  lines over the data; a model field charted hour by hour at a point, against
  the run before), the soundings, the models
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
| `grib2.js`, `modelmaps.js` | Pro's model maps: a GRIB2 reader (lat/lon and Lambert grids; simple, complex, spatially-differenced and CCSDS packing — the last is libaec's Rice coder, for ECMWF) and the field lists — HRRR, the mesoanalysis, GFS, ECMWF IFS and AIFS, GEFS — which index lines each field needs, its unit, palette, contours and barbs, and the ensemble's probabilities and spaghetti |
| `level2.js` | Pro's full-volume radar: NEXRAD Level II (Archive II records, message 31, the coverage pattern in message 5) read from the real-time chunks, and which chunks hold which cut; and the archive — every finished volume since 1991, streamed and abandoned once the tilt asked for has been read (both layouts: bzip2 records, and the older gzip around plain messages) |
| `meso/` | the mesoanalysis made on a server, SPC's way: `build.mjs` (it), `measure.mjs` (how far off the browser's shortcuts are), `lambda.mjs` (the same as an AWS Lambda function) — its own [README](meso/README.md) |
| `mesogrid.js` | the server mesoanalysis's file format, shared by the builder (encode) and the page (decode) |
| `abi.js` | Pro's GOES imagery: the ABI's Level 2 multi-band files read through `glm.js`'s HDF5 reader (2-D chunks, kept as 16-bit counts), the GOES-R fixed-grid navigation both ways, and the band enhancements and RGB recipes |
| `mrms.js` | Pro's MRMS products — the list, where each lives in the bucket, its unit and palette; `grib2.js`'s `parseAsync` reads the files (gzip, PNG packing, max-pooled) |
| `mapgeo.js` | Pro's map lines: which Natural Earth file each layer is, `slim()` (a file → North America's lines or town names and nothing else), each line's box for culling, and which town names fit at a zoom without touching |
| `glm.js` | Pro's lightning, and the HDF5 reader the GOES imagery uses too: just enough HDF5 (superblock 2/3, object headers, dense links and attributes, chunked deflate+shuffle in one or two dimensions) to read the GOES lightning mapper's flashes and the imager's bands, by byte range; and the arithmetic on them — flash density in 8 km squares, a storm cell's flash rate in 2-minute steps following the cell along its own motion, and the Schultz et al. (2009) 2σ lightning jump |
| `sounding.js` | the vertical arithmetic: parcels, CAPE / CIN / LCL / LFC / EL, precipitable water, lapse rates, shear, Bunkers storm motion, helicity, STP, downdraft CAPE (MetPy's `downdraft_cape` step for step — the mesoanalysis map uses it too) |
| `draw.js` | the Skew-T and the hodograph, as SVG strings |
| `verify/core.js` | the scoreboard's arithmetic and the blend — loaded by the page and by `score.mjs` |
| `verify/score.mjs` | the daily scoring job (below) |
| `verify/scores/` | what it publishes: rounded records per state, no coordinates |
| `../../weather.webmanifest`, `../../weather-sw.js`, `../../assets/weather/` | the home-screen app |
| `DESIGN.md` | the design document |
| `test/wx.test.mjs` | the client's rules on fixtures, no network. In `.github/checks.mjs`. Also holds the Worker's `/wx` route to every request the page makes |
| `test/sounding.test.mjs` | the sounding arithmetic, against hand-checkable physics and against MetPy (pinned values). In `checks.mjs` |
| `test/decoders.test.mjs` | the decoders against the libraries the field trusts — MetPy (Level III and Level II), ecCodes (GRIB2, MRMS's PNG-packed GRIB2 and ECMWF's CCSDS-packed), h5py (GLM and ABI), pyproj and the GOES-R user's guide (the ABI's navigation), Python's bz2 — the Level II archive's two layouts against each other, the mesoanalysis's fields against a real HRRR analysis-hour index and its composites (effective STP and SCP, SHIP, effective shear) against hand-worked columns, the GEFS events and ECMWF's mirror fallback, on real files in `test/fixtures/` (`make-expected.py` wrote `expected.json` from them; rerun it by hand when adding a fixture). In `checks.mjs` |
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
| Replay of one radar (Pro) | Unidata's Level II archive on AWS, `unidata-nexrad-level2` (`YYYY/MM/DD/KTLX/KTLX20130520_200356_V06(.gz)`, CORS open), read by `level2.js`'s `archive` and `stream` | The replay bar's **Radar: Nearest radar, full volume** (the default when a single radar's product is on). Every volume the radar finished in the window (every 4–6 minutes), at the lowest tilt, with the warnings as they stood. A volume is downloaded only until the radar's own end-of-elevation flag for that tilt has been read — about 1–2 MB of a 10 MB file, and it is streamed so the rest is never asked for (a gzip volume is pumped by hand: piped, the decompressor drains the whole download first). The product buttons (Reflectivity, Velocity, SW, CC, ZDR) change what the replay shows without leaving it. The radar is the one nearest the map's middle, after a notable storm has fitted the map to its warnings. Volumes before 2008 are in an older format (message 1) that is not read here, and say so |
| Replay | IEM's mosaic archive tiles (`Wx.archiveTile`) and its storm-based warnings archive (`/wx/iem/sbw`, at most 12 hours, cached a week once a window is a day old) | Frames every 5 minutes for 2 hours, every 10 for longer. Archive tiles are rendered by IEM on demand and slow, so only the frame on screen and the next one load, and the loop waits for a frame's tiles. Today's satellite, stations and warnings are hidden in a replay. The notable storms carry a time and nothing else — the map fits itself to the warnings it fetches, so no place is written into the page (hard rule 1) |
| Future radar | The latest HRRR run's simulated reflectivity from IEM, one lat/lon picture per step (`/data/gis/images/4326/hrrr/refd_MMMM.png`, 3050×1340 at 0.02° from 126° W, 50° N; `refd_0000.json` says when the run started, through `/wx/iem/hrrrmeta`) | Reprojected onto the map in 2 px strips (`paintHrrr`); only the frame on screen is painted. The pictures are rain on opaque black, so the layer blends with `screen`. Labelled a forecast wherever it shows; the sources card flags a run older than 3 hours |
| Stations on the map | IEM's current ASOS readings, one forecast office at a time (`/api/1/currents.geojson?networkclass=ASOS&wfo=XXX&minutes=90`, `Wx.stationObs`) | The offices covering the view come from the NWS's `/points` for the middle and four points around it, looked up once per half-degree. One office is ~25 KB; the whole country is 3.3 MB uncompressed, so it is never asked for. From zoom 6 in, every five minutes; a chip with the temperature, a tail from where the wind comes, tap for every field and the raw METAR. Positions are read at run time, never kept (hard rule 1). On by default; the Stations button turns it off for this browser |
| Watches, mesoscale discussions, rainfall discussions (Pro) | SPC watches and MDs, WPC MPDs, as IEM's GeoJSON (`/api/1/nws/spc_watch_outline.geojson`, `nws/spc_mcd.geojson`, `nws/wpc_mpd.geojson`; `Wx.proOverlays`) | Drawn as issued — tornado watches gold, severe pink, MDs and MPDs dashed — and dropped the minute they expire. Tap one for its number, its end time and SPC's or WPC's own page. Every two minutes |
| Storm cells (Pro) | Each NEXRAD's own storm-tracking table, via IEM (`/geojson/nexrad_attr.geojson`, `Wx.normalizeCells`) | From zoom 6: a core coloured by its strongest echo, ticks 15–60 min ahead along the radar's own motion, a green ring for hail, yellow for a mesocyclone, a red triangle for a TVS. Tap one for the radar's numbers. Cells older than 20 minutes are dropped. What the radar measured, never a warning |
| Fronts, highs and lows (Pro) | WPC's coded surface analysis (the NWS's `CODSUS` bulletin, `products/types/COD`, `Wx.parseCodsus`) | Cold, warm, stationary and occluded fronts with their pips on the correct side (checked against the real bulletin), and the H/L centres with their pressure. Every 30 minutes; the sources card says when the analysis was valid and flags one older than 6 hours. Off by default |
| Station plots (Pro) | The same IEM station readings as the chips | From zoom 8 the chips become the standard station model: wind barb, sky cover, temperature, dewpoint, weather and pressure, spaced so none overlap |
| Forecast discussion (Pro) | NWS `products/types/AFD/locations/{office}` → `products/{id}` | The place's office's latest discussion, split into its own sections, the first two open — as written, never summarised |
| SPC mesoanalysis (Pro) | `spc.noaa.gov/exper/mesoanalysis/s{sector}/{field}/{field}.gif` | SPC's own hourly maps, shown as SPC draws them, for twelve regions and thirteen fields; the choice is kept in this browser. Images only, from the provider directly |
| Satellite imagery (Pro) | GOES-East (`noaa-goes19`) and GOES-West (`noaa-goes18`) ABI Level 2 multi-band files on AWS (`ABI-L2-MCMIPC` every 5 minutes, `ABI-L2-MCMIPM` 1 and 2 every minute; CORS open), read by `abi.js` | The **Satellite · GOES** map layer (Ric, 2026-10-22: "do it"). All sixteen bands at 2 km (visible as reflectance, the rest as brightness temperature; band 13 in the NWS's enhanced IR colours, the water-vapour bands in theirs) and eight RGB composites made by CIRA/RAMMB's and EUMETSAT's published recipes — Airmass, Day Cloud Phase Distinction, Day Convection, Night Microphysics, Dust, Fire Temperature, Natural Color, True Color (with CIMSS's synthetic green) — each keyed under the map. Only the bands a product needs are read, chunk by chunk with Range requests: ~3.5 MB a band for the lower 48, ~0.3 MB for a mesoscale sector. The lower 48's loop is 4–6 frames (an RGB there is 45 MB in memory), a mesoscale sector's 20 minutes; a sector off the screen is gone to once, and "Go to the sector" goes again. East or West by the map's middle (105° W) unless one is picked. Hover gives each band's value. Products made from sunlight say they are dark at night. The link carries `g=product.sector.satellite` |
| Satellite | GOES-West and GOES-East via IEM tiles (`goes-{west,east}-{ir-4km,vis-1km,wv-4km}-900913`, `Wx.SAT`) | Under the radar, West drawn first and East over it. Latest image only: the tile carries no scan time, so the page says "latest" and nothing finer. Visible is dark at night and the page says so |
| Storm warnings across the country, and a state's | NWS `/alerts/active?event=…` and `?area=XX` | The national list with no place; "warnings nearby" with one |
| SPC convective outlook | `spc.noaa.gov/products/outlook/day{1,2,3}otlk_*.nolyr.geojson` | Categorical risk with SPC's own labels and colours; drawn on the radar, and "Slight risk … here today" in the hero |
| Single-site radar (Weather, and storm mode) | IEM `json/radar.py` (nearest sites, scan list) and `ridge::<SITE>-<PROD>-<YYYYMMDDHHMI>` tiles | Super-res reflectivity (N0B) and storm-relative velocity (N0S), every scan in the last hour. IEM does not tile CC, ZDR, KDP or echo tops (probed 2026-10-17) |
| Single-site radar (Pro) | The radar's own Level III files in Unidata's public bucket, `unidata-nexrad-level3` on AWS (`SITE_PROD_YYYY_MM_DD_HH_MM_SS`, CORS open), read by `nexrad.js` | Nine products — N0B–N3B, N0G/N1G/N2U/N3U, N0S, N0C–N3C, N0X–N3X, N0K–N3K, N0H–N3H, EET, DVL — at the tilt picked (the button says the elevation the scan was made at). The bucket is listed by the hour; the newest twelve scans make the loop, each fetched only when shown or played (50–250 KB). Painted pixel by pixel from range and bearing; hover or tap gives the gate's value, its distance and bearing, and the beam's height above sea level (4/3 earth). The nearest site still comes from IEM's `radar.py` |
| Full-volume radar (Pro) | Unidata's real-time Level II chunks, `unidata-nexrad-level2-chunks` on AWS (`KTLX/<1–999>/<YYYYMMDD-HHMMSS>-<n>-<S/I/E>`, CORS open), read by `level2.js` | The "Full volume" switch on the tilt row (and spectrum width, which only Level II carries). Every angle the volume scans (fourteen or more in a storm), REF / VEL / SW / ZDR / CC at full resolution. A site's volume folders are reused 1–999, so the newest is found by binary search on their start times (~10 listings, once per site). The first chunk's coverage pattern says which chunks hold each cut — 6 for a 720-radial cut, 3 for 360, checked against a real volume — so a frame is that chunk plus 3–6 others, 0.3–1.5 MB. The newest six volumes make the loop; the newest is asked again every 30 s, so a tilt appears within about a minute of the sweep. Reflectivity comes from a split cut's surveillance half (460 km), velocity from its Doppler half; SAILS's extra low scans fold into their angle, newest winning. 16-bit moments (PHI; ZDR on some radars) are brought to 8 bits over a fixed range |
| MRMS (Pro) | NOAA's Multi-Radar Multi-Sensor products, `noaa-mrms-pds` on AWS (`CONUS/<product>/<YYYYMMDD>/MRMS_<product>_<YYYYMMDD-HHMMSS>.grib2.gz`, CORS open), read by `mrms.js` + `grib2.js` | Rotation tracks (0–2 km over 1, 4 and 24 hours; 3–6 km; azimuthal shear now), MESH hail size (now, 1 h, 24 h), POSH, reflectivity at −10 °C, composite reflectivity, echo tops, VIL, rain rate and the 1 h / 24 h multi-sensor rain. Every 2 minutes (the rain totals hourly), the newest eight in the loop. The grids are 0.01° or 0.005° over the lower 48 — up to 98 million points — so they are pooled to 0.02° keeping each block's largest value, which keeps a narrow rotation track and the hail core; 0.4–1.3 s and 0.1–1 MB a file |
| Model maps (Pro) | NOAA's HRRR (`noaa-hrrr-bdp-pds`, `wrfsfcfNN`) and GFS (`noaa-gfs-bdp-pds`, `pgrb2.0p25.fNNN`) on AWS, read by `grib2.js` / `modelmaps.js` | The newest run with enough of itself out (the bucket is listed; HRRR's must have 3 hours, GFS's 30). Each hour's `.idx` says where each field's bytes are and only those are fetched with a Range request — ~1 MB a field. HRRR: reflectivity, precipitation type, updraft helicity, three CAPEs, 0–1/0–3 km helicity, echo tops, lightning threat, temperature, dew point, wind and gusts, MSLP, visibility, cloud, rain and snow totals, PWAT. GFS (3-hourly to 5 days, 6-hourly to 10): 500 mb heights and vorticity, the 250 mb jet, 850 mb, MSLP and thickness, the surface fields, rain, PWAT, snow depth. HRRR's winds are turned from its grid to the earth before barbs are drawn. Labelled a forecast, with its run, everywhere it shows. HRRR's **Severe** group is computed here from its own fields: SPC's fixed-layer STP (Thompson et al. 2003 — SBCAPE, the LCL above ground, 0–1 km helicity, 0–6 km shear, with SPC's caps), a supercell composite with fixed layers standing in for the effective ones (named as an approximation), 0–1 km EHI, 0–6 km shear with barbs and mixed-layer CIN |
| Map lines (Pro) | Natural Earth's release on GitHub (`raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/`, CORS open): 1:50m coast, country and state/province lines, 1:10m US counties and populated places | Read when the page runs and cut down in the browser by `mapgeo.js` (`Wx.mapLayer`): North America only, no properties kept, ~100 m rounding. Counties from zoom 7. Never committed, and not through the Worker (free plan; the county file is 8 MB of JSON). Natural Earth is public domain; the corner credits it |
| Mesoanalysis on the map, SPC's method (Pro) | `meso/build.mjs` on a server, once an hour: the RAP's one-hour forecast (`noaa-rap-pds`, native 13 km grid, every 25 hPa) with NOAA's 15-minute surface analysis at the ground (`noaa-rtma-pds`), every column through `sounding.js`; the file kept a day by the Worker (`/meso`) and drawn by `modelmaps.js` (source `smeso`) | Ric, 2026-10-22: "If we want to make Mesoanalysis more accurate how do we do that?", then "Do it plz." The same twenty-nine fields as SPC's own way of making them: no shortcut in any. Runs in GitHub Actions (`.github/workflows/meso.yml`) a few minutes after each hour's RTMA lands, or in AWS Lambda (`meso/lambda.mjs`, not set up yet). The page uses it when the server has an hour from the last three, and otherwise falls back to the browser's below and says so. How it is made, where it runs, and how far off the browser's shortcuts measured: [`meso/README.md`](meso/README.md) |
| Mesoanalysis on the map, in the browser (Pro) | The HRRR's analysis hour (`wrfsfcf00`) of each of the last six runs, `noaa-hrrr-bdp-pds` (`modelmaps.js`, source `meso`) | Not SPC's — SPC's own maps are the card further down; SPC draws them from the RAP, whose bucket allows no browser (checked 2026-10-22). Twenty-seven fields that can sit over the radar, step through six hours and give a value under the pointer: surface pressure, dewpoint, theta-e and moisture convergence; SB/ML/MU CAPE (CIN contoured), 0–3 km CAPE, DCAPE, 700–500 and 850–500 lapse rates, LCL, LFC, freezing level, PWAT; 0–1 and 0–6 km shear, effective bulk shear, 0–1, 0–3 km and effective SRH, Bunkers storm motion, critical angle; effective-layer STP, SCP (with SPC's MUCIN term), SHIP, EHI. Where SPC's need something the file does not hold, the label says so and `MESO_FIELDS` explains: effective shear's base is SPC's own test (surface parcel CAPE ≥ 100, CIN ≥ −250) else the most-unstable parcel's level, its winds the standard levels; DCAPE is `sounding.js`'s (MetPy's) on the ground and five standard levels every fifth point (15 km); STP's LCL is the surface parcel's. The effective helicity is the HRRR's own (EFHL). A composite field shares twenty-odd messages, kept in a 28-message cache so stepping between fields does not fetch them again |
| ECMWF maps (Pro) | ECMWF's open data — the IFS at 0.25° and AIFS — from Google Cloud (`storage.googleapis.com/ecmwf-open-data`) first and AWS (`ecmwf-forecasts`) second, both CORS open | AWS's copy answered most requests with 503 "Slow Down" — with no CORS header, so a browser sees only a failure — when this was built (2026-10-22); every request is retried and alternates between the two (`retrying` in `modelmaps.js`). Each file has a JSON-lines `.index`; the fields are CCSDS-packed, read by `grib2.js`'s `aec`. The 00Z and 12Z runs, drawn to 10 days: 500 mb heights with vorticity (IFS) or wind (AIFS), the 250 mb jet, 850 mb, MSLP and thickness, temperature, dewpoint, wind, gusts and MUCAPE (IFS), cloud, rain and snow since the run, PWAT (IFS) or total column water (AIFS). The IFS gives cloud as a fraction and rain as metres; AIFS per cent and millimetres — checked with ecCodes. ECMWF's licence is CC BY 4.0: the map's corner credits ECMWF whenever its fields are shown |
| Ensemble maps (Pro) | NOAA's GEFS on AWS, `noaa-gefs-pds` (`pgrb2ap5`, 0.5°): the control and thirty members, and NOAA's own mean (`geavg`) and spread (`gespr`) | Every 6 hours to 16 days (where each member's rain is a 6-hour total). The mean of 500 mb heights and MSLP contoured over how far the runs disagree; mean temperature and rain; **spaghetti** — every run's 552 or 576 dam line, each its own colour, over the spread; and **chances** — the share of the 31 runs with ¼ or 1 inch of rain in 6 hours, freezing at 2 m, or a 39 mph wind. ~8 MB for a field's 31 members. ECMWF's own ensemble is 51 runs at 0.25° and a 2 MB index per step, too much for a page; its spread at one place is in the ensemble card (Open-Meteo) |
| Storm probabilities (Pro) | **HRRR-TLE** — the newest six HRRR runs, each at the hour that lands on the same moment (`modelmaps.js`, source `tle`) | HREF is not on AWS and RRFS's bucket holds only retrospective runs (checked 2026-10-22), so the probabilities are the time-lagged HRRR, as SPC and WPC use it: for each member, the event (2–5 km updraft helicity ≥ 75, 40 dBZ, 1 inch of rain in an hour, a 58 mph hourly-max wind) widened to everything within 40 km; the share of members with it, smoothed over half that. A run that does not reach the hour (18 h, 48 from 00/06/12/18Z) is left out; fewer than three members is no answer. One to fifteen hours ahead, ~6 MB an hour |
| Lightning (Pro) | GOES-East (`noaa-goes19`) and GOES-West (`noaa-goes18`) GLM Level 2 files on AWS, every 20 s, read by `glm.js` | Flashes, not ground strikes. The last 20 minutes, asked again every minute while **Lightning** or **Flash density** is on and the page is visible; a first fill goes newest first so the last minutes show in seconds. East east of 105° W, West west of it (they overlap and see the same flashes). ~150 KB a file in Range requests; the attributes are read from the first file and reused. Only flashes the GLM flags good. **Lightning** draws the last 10 minutes as dots. **Flash density** (Ric, 2026-10-22: "a density of lightning within a time frame") counts flashes in 8 km squares over 1, 5, 10 or 20 minutes, the window ending at the newest file read; hover gives a square's count. With either on, a storm cell's card shows its **flash rate** (flashes a minute within 15 km, the circle carried back along the cell's motion to each flash's time), the last four 2-minute steps, and the **lightning jump**: Schultz, Petersen and Carey's 2σ method — the latest change in rate more than twice the spread of the five before it, with the cell at 10 flashes a minute or more — drawn as a dashed violet ring. It is labelled an indicator, never a warning. Rate and jump wait until 14 unbroken minutes of files have been read (`span` in app.js), so a gap is never read as a storm going quiet. GLM sees fewer flashes than a ground-based lightning mapping array, so its rates run lower than the ones the method was built on |
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
  through `/wx`. Each decoder is held to MetPy, ecCodes, h5py or pyproj in
  `test/decoders.test.mjs`; change the decoder and the fixtures' expectations
  together. The third round (2026-10-22, "do it", after a look at what the
  professional sites have) added the GOES imager (`abi.js`), ECMWF's CCSDS
  packing, ECMWF's and the GEFS's buckets and the Level II archive — the same
  way, and ECMWF's Google Cloud copy is the one host outside AWS.

## Built so far

**Phase 1** (DESIGN.md §38): location (search, my location, saved places),
current conditions, rain timing (next 3 hours in 15-minute steps), hourly with a
tap-for-detail hour, 10 days with the office's words, alerts with polygons,
animated radar, wind / humidity / pressure trend / visibility / UV / sun, °F/°C,
offline copy, refresh every ten minutes while open.

**Weather Pro, third round (2026-10-22, Ric: "do it", after asking what the
professional sites have that this does not):** GOES imagery with all sixteen
bands and the RGB composites; the mesoanalysis on the map, with DCAPE (also in
the sounding card); ECMWF IFS and AIFS maps; the GEFS's mean, spread,
spaghetti and chances; replay of one radar's full volume from the Level II
archive. Links carry the satellite product (`g=airmass.m1.auto`) and any
model source (`m=meso.stpe`, `m=gefs.spag552`, `m=ecmwf.h500`).

**Weather Pro, second round (2026-10-22, Ric: "do it"):** the full Level II
volume at every tilt, MRMS rotation tracks / hail / rain, the severe composites
and HRRR-TLE probabilities — under "Who answers what". Links carry the angle
(`a=0.5`, which also turns the full volume on) and the MRMS product
(`r=rot60`).

**Weather Pro's own data (2026-10-22, Ric: "do the three"):** one radar's
Level III products at four tilts, with a value readout; HRRR and GFS model maps
with contours and barbs, played through the forecast hours; GOES lightning; and
the NWS's storm reports — all above, under "Who answers what". Share links
carry the tilt (`t=`) and the model field (`m=hrrr.mlcape`).

**Weather Pro, the review's eight (2026-10-23, Ric: "Do it. All 8"):**
1. *Map lines over the data* — state, county (from zoom 7), coast and border
   lines and town names, on a canvas above the radar or field and under
   lightning and the overlays (`mapgeo.js`, above). On by default; the
   **Map lines** switch turns them off, and a link says so with `o=…x`.
2. *More map on a laptop* — the satellite under the radar is a list at the end
   of the overlays (it was a row of its own), so the docked map is about 420 px
   at 900 px tall instead of 315.
3. *One clock* — lightning and flash density show the minutes up to the frame on
   screen, so a loop scrubbed back shows that moment's flashes (and says so when
   the frame is older than the twenty minutes held); switching layer while
   scrubbed back lands on the nearest frame of the new layer (`frameTime`,
   `ltgRef`, `frameNear`). Forecasts and the newest frame show now. The
   satellite tiles under the radar are still the latest image only.
4. *Radars on the map* — in a one-radar product the nearest radars are drawn as
   diamonds; tap one to keep it (the same as the picker in the tilt row).
5. *One name per thing* — settled the same night by the server mesoanalysis
   (above): the map's layer is "Mesoanalysis" (SPC's method, computed hourly)
   or "Mesoanalysis (HRRR)" when it falls back to the browser's; "SPC
   mesoanalysis" is only SPC's own card. The rename to "HRRR analysis" this
   review first made was dropped in favour of that.
6. *A quieter first look* — Pro opens with map lines and watches; storm cells,
   reports, stations and the outlook are a tap away (warnings are always drawn).
   A choice already made in this browser is kept.
7. *A point, every hour; and earlier runs* — tap a model map, then "Chart this
   field here, hour by hour": the field at that point through the run on the
   map, read from loaded hours or fetched four at a time and let go; tick
   "Compare with the run before" for that run dashed over the same hours; tap
   the chart to put an hour on the map. The model bar's **Run** list puts the
   run before (up to three before) on the map instead, on the same valid hour;
   a link carries it (`m=hrrr.t2m.1`).
8. *11 px storm-report letters* — the circles grew a pixel to hold them.

**Weather Pro's controls (2026-10-23, after a review of the page as a
forecaster would use it):**
- *Nothing hidden on a desk.* Above 1000px the layer and overlay rows
  wrap instead of scrolling sideways — at 1440px, Echo tops, VIL, Future, Models
  and Replay had been past the right edge with nothing to say so — and the docked
  map takes whatever height the controls leave (the radar card is a flex column),
  so the column still fits the screen whole. A cross-section open puts the card
  back to its old fixed map. On a phone the rows still scroll, fading at the
  right edge to say there is more.
- *Overlays are switches.* They tick like boxes and stay dark when on, so they do
  not read like the one layer chosen in the row above.
- *Pick the radar.* The tilt row starts with a radar list — the nearest fifteen
  to the map's middle. Choosing one keeps it however far the map is dragged; the
  first entry goes back to following the map; choosing a new place lets go. A
  share link carries it (`k=TLX`, IEM's three-letter ids).
- *Keys.* Space plays, ← → step frames, + − zoom, F full screen, M R V S C Z K H E G
  the products, 1–9 the tilts, L and W lightning and watches, ? the list (the
  `#keys` sheet; `KEYMODES` in `app.js` must match it — `test/wx.test.mjs`
  checks). Ignored while typing, with a modifier, or with a sheet open. The ?
  chip is hidden on touch screens.
- *dBZ on the mosaic.* Pro's legend numbers the NWS reflectivity colours (5 dBZ
  steps, 5–70) for the mosaic, a site's IEM tiles and the HRRR's picture;
  Weather keeps light-to-heavy.
- *The sheets centre.* `*{margin:0}` had taken the browser's centring off every
  `dialog.sheet`, so the place search opened in the top-left corner on both
  pages. Pro's sheets now have the instrument's corners and panel.

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

**To do soon (Ric, 2026-10-23):** turn Weather Pro into a customizable, synchronized
workstation with optional presets — the plan is in [`WORKSTATION.md`](WORKSTATION.md).

| Phase | The likely way on this site |
|---|---|
| 2 · Investigation | Built: satellite (GOES IR / visible / water vapour under the radar), a full-screen map, a tapped-point card, airport stations on the map, map lines over the data, and one clock for radar, GOES imagery and lightning (2026-10-23). Still to do: the satellite tiles under the radar following that clock (IEM's are latest-only); more networks than ASOS (state mesonets) |
| 3 · One serious model | Built: **Future · HRRR** (IEM's simulated-reflectivity pictures) and, since 2026-10-22, **Models** — HRRR and GFS fields read from NOAA's GRIB2 in the browser (above). Since then ECMWF IFS and AIFS, the GEFS ensemble maps, and run-to-run comparison (the Run list, and the point chart's run before — 2026-10-23). Still to do: NAM 3 km and the RAP |
| 4 · Soundings | Built (above), with observed-vs-model on the same diagram (§16) and the effective-layer parameters: the effective inflow layer (Thompson 2007), effective SRH and bulk shear, effective STP (Thompson 2012, with its CIN term) and the supercell composite. The composites and the effective SRH are held to MetPy in `test/sounding.test.mjs` |
| 5 · Advanced | Model comparison, ensemble plumes, cross-sections, dual-pol radar at four tilts (Level III) and the full Level II volume, MRMS rotation tracks / MESH / QPE, severe composites and HRRR-TLE probabilities (2026-10-22): built. Still to do: single-site replay from the Level II archive; storm-relative velocity above the lowest tilt (from velocity and the storm's motion); GEFS / National Blend probability maps; HREF when NOAA publishes it openly |
| 6 · Station + verification | The CS pattern: a script that pulls the station and archives point forecasts into a committed accumulator, verified against the station. **Needs a decision on how the station is named** — its coordinates can't be in this repo |
| 7 · Replay | Built for the national radar: any 2, 3 or 6 hours since 2006 from IEM's archive tiles (`ridge::USCOMP-N0Q-<YYYYMMDDHHmm UTC>`, N0R before 2011 — the names IEM's own viewer uses), with each storm warning drawn only for the minutes its polygon was in force (`/api/1/vtec/sbw_interval`), and four notable storms that fit the map to their own warnings. Still to do: satellite, observations and model runs for the same moment; single-site replay |
| 8 · 3D | Only after profiling, per the doc |
| Push alerts | A web push from the Worker when a warning covers a saved place. Needs the Worker deployed and a key pair as a Worker secret; only ever an extra, never anyone's only warning |
