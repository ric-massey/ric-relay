# The mesoanalysis, computed SPC's way

Weather Pro's map has two mesoanalyses (Models → **Mesoanalysis**):

| | **Every level, SPC's method** (`smeso`) | **HRRR, worked out in your browser** (`meso`) |
|---|---|---|
| Made | here, once an hour, on a server (`build.mjs`) | in the visitor's browser (`modelmaps.js`) |
| First guess | the RAP's one-hour forecast for the hour | the HRRR's analysis hour |
| Ground-level air | NOAA's 15-minute surface analysis (RTMA) | the model's |
| Levels | every 25 hPa, 1000–100 | the ground and six standard levels |
| Grid | 0.25° over the lower 48 (SPC's is 40 km) | 3 km (5 for DCAPE) |
| Ready | ~1–2 min after the RTMA for the hour lands (~:15–:20) on Lambda; ~:20–:40 on Actions | ~50 min after the hour |

The page asks for the server's first and falls back to the browser's when the
server has nothing from the last three hours (and says so).

Ric, 2026-10-22: "If we want to make Mesoanalysis more accurate how do we do
that?", then — after "wouldn't you want it to be faster? … this page is being
built for professionals" — "Do it plz."

## How it is made (`build.mjs`)

1. **First guess:** the RAP run that started an hour before, out to the hour
   (`noaa-rap-pds`, `rap.tHHz.wrfprsf01.grib2`, the native 13 km rotated grid).
   Only the fields used are fetched, by Range: temperature, humidity, height
   and wind at 37 levels, and the surface fields — 192 messages, ~45 MB. Its
   grid is NCEP's template 3.32769, read by `grib2.js` and checked in
   `test/decoders.test.mjs` against the same field on the RAP's own Lambert
   grid (median 0.02 K apart). The 13 km Lambert file (`awp130`) would be
   simpler but is JPEG 2000, which nothing here reads.
2. **The ground:** NOAA's RTMA rapid update for the hour (`noaa-rtma-pds`,
   `rtma2p5_ru.tHH00z.2dvaranl_ndfd.grb2`, 2.5 km) replaces the first guess's
   2 m temperature and dewpoint (brought to the model's ground height at
   6.5 K/km; the dewpoint keeps its mixing ratio) and its 10 m wind. This is
   where SPC blends in the surface observations; RTMA is NOAA's own blend of
   them. Outside RTMA's lower-48 grid the model's own surface stands. An hour
   built before its RTMA is out says so, and is built again once it is.
3. **Every column** — 39,621 of them — goes through `sounding.js`'s
   `analyze()`, the same arithmetic as the sounding card, held to MetPy in
   `test/sounding.test.mjs`: the surface, mixed-layer and most-unstable
   parcels, the effective inflow layer, effective helicity and shear, the
   composites, DCAPE. `columnFields()` adds what is built on top (0–3 km CAPE,
   SHIP, the derecho composite, SCP's MUCIN term, the 850–500 and 0–3 km lapse
   rates), each with its source in a comment. Winds are turned from the RAP's
   grid to the earth first. Moisture convergence is worked out on RTMA's 2.5 km
   grid, smoothed over ~25 km.
4. **The file** is `../mesogrid.js`'s shape — every field as 16-bit steps,
   gzipped, ~1.2 MB — and goes to the Worker (`PUT /meso/<YYYYMMDDHH>`, the
   site password, `LOG_TOKEN`). The Worker keeps the last 24 hours in R2;
   `GET /meso/index` lists them, `GET /meso/<hour>` is one (`worker/README.md`).

The columns are shared over the machine's cores (`worker_threads`, shared
memory): about 75 s on four cores, about 3.5 minutes on one.

```sh
node projects/weather/meso/build.mjs --valid 2026102222 --out /tmp/m.bin.gz   # one hour, to a file
LOG_TOKEN=… node projects/weather/meso/build.mjs --check --put worker          # what the schedule runs
node projects/weather/meso/measure.mjs 2026102222                             # the measurement below
```

Nothing it writes holds a place: the grid is a regular one over the country,
and the file is model output about everywhere at once.

## Where it runs

**GitHub Actions** (`.github/workflows/meso.yml`) — free (the repository is
public), no card, already set up. It asks at :18, :28, :38 and :48 past every
hour; a run that finds the hour already built (with its RTMA) stops in seconds.
Scheduled runs can start 5–20 minutes late. Needs the `LOG_TOKEN` secret (the
site password; the Garmin pull reads the same one). **It is not set yet** — Ric,
2026-10-23: not adding it for now — so every run stops in seconds as a pass
with a notice, nothing is built, and the page shows the browser's version. Set
the secret and the next run switches it on.

**AWS Lambda** (`lambda.mjs`) — the same code, for when the 5–20 minutes
matter. Not set up yet: it needs an AWS account (a card at sign-up; this stays
inside the free tier — a 3 GB function for ~2 minutes an hour is ~260,000 of
the 400,000 free GB-seconds a month). To set it up:

1. Zip `projects/weather/{grib2.js,sounding.js,modelmaps.js,mesogrid.js,meso/}`
   keeping the folder layout, and make a **Node.js 22** function in
   **us-east-1** (where NOAA's buckets are) with handler
   `meso/lambda.handler`.
2. Memory **3008 MB** (that is two cores), timeout **5 minutes**, and an
   environment variable `LOG_TOKEN` (the site password).
3. Wake it with an **EventBridge schedule**, `rate(5 minutes)`: it asks the
   Worker first and does nothing until there is a new hour or a newly arrived
   RTMA, so the idle wakes cost a second each. NOAA also announces each new
   object in its buckets through SNS (the NOAA Open Data Dissemination
   program's topics); subscribing the function to the RTMA bucket's topic
   would wake it the moment the file lands — find the topic's ARN on the
   bucket's Registry of Open Data page and check it before relying on it
   (not verified here).
4. Then turn the Actions schedule down to a backstop (one run an hour, at :45).

## How much better it is (`measure.mjs`)

Measured 2026-10-22, before anything was built on it. The browser's version
takes three shortcuts, each named in its label. Here every column of one RAP
hour is worked both ways — the full arithmetic and the browser's shortcut, on
the same air — so the difference is the shortcut's alone:

| Field | Hour | Mean difference | Bias | 90th percentile | A forecaster's line called differently |
|---|---|---|---|---|---|
| Effective bulk shear (MUCAPE ≥ 250) | 19Z | 2.6 kt | −0.3 | 5.7 kt | 35 kt: 3.2% of columns |
| | 22Z | 2.7 kt | −0.2 | 6.0 kt | 2.4% |
| DCAPE (every column) | 19Z | 106 J/kg | −47 | 259 J/kg | 1000 J/kg: 4.6% |
| | 22Z | 114 J/kg | −54 | 278 J/kg | 5.3% |
| Effective STP (where ≥ 0.25) | 19Z | 0.1 | −0.1 | 0.3 | STP 1: 3.1% |
| | 22Z | 0.1 | 0.0 | 0.2 | 1.5% |

So DCAPE is the shortcut that costs most — five levels run about 50 J/kg low —
and the shear and STP shortcuts are small. This measures only the shortcuts.
The other two differences — the HRRR against the RAP plus RTMA, and the hour or
so of age — are what the server version changes as well, and are not in these
numbers. Two quiet late-October hours: run it again in a spring severe setup.
