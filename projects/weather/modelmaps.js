/* Model maps — HRRR and GFS fields drawn on Weather Pro's map
   ────────────────────────────────────────────────────────────────────────────
   What Pivotal, WeatherBell and Tropical Tidbits are mostly made of: a model
   field shaded over the map, hour by hour, with the contours and wind barbs a
   forecaster reads it by. Here every field comes straight from NOAA's own
   files on AWS (grib2.js reads them): the latest run is found by listing the
   bucket, each forecast hour's `.idx` says where each field's bytes are, and
   only those bytes are fetched. Ric's call, 2026-10-22 ("do the three").

   Two models, chosen for what they are for:
     HRRR  3 km, a new run every hour, 18 hours out (48 from the 00/06/12/18Z
           runs) — storms, today and tonight
     GFS   0.25°, every 6 hours, out to 10 days here — the pattern

   A field is a list of the messages it needs (matched on the .idx line's
   "NAME:LEVEL:FCST"), a way to turn them into one number per grid point in
   its canonical unit (°F, in, kt, …: what the palette is built in), and
   optionally contours and wind barbs. Units the visitor picked only change
   the labels — the colours mean the same thing either way.

   Like every forecast on the page, these are labelled as a model's forecast
   wherever they show, with the run they came from. */
(function (root) {
  'use strict';

  const G = root.Grib2 || (typeof require === 'function' ? require('./grib2.js') : null);
  const SND = root.Sounding || (typeof require === 'function' ? require('./sounding.js') : null);
  const MG = root.MesoGrid || (typeof require === 'function' ? require('./mesogrid.js') : null);

  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const ymd = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`; };
  const hh = (ms) => pad(new Date(ms).getUTCHours());

  /* ── the models and where their files are ── */
  const SOURCES = {
    hrrr: {
      label: 'HRRR', long: 'NOAA HRRR — 3 km, a new run every hour, lower 48',
      bucket: 'https://noaa-hrrr-bdp-pds.s3.amazonaws.com', cycle: 1, lookBack: 4, minHours: 3,
      prefix: (run) => `hrrr.${ymd(run)}/conus/hrrr.t${hh(run)}z.wrfsfcf`,
      file: (run, fh) => `hrrr.${ymd(run)}/conus/hrrr.t${hh(run)}z.wrfsfcf${pad(fh)}.grib2`,
      hours: (have) => have
    },
    /* a time-lagged ensemble: the newest HRRR runs, each at the forecast hour
       that lands on the same moment — how SPC and WPC get probabilities out
       of a single deterministic model (the HRRR-TLE). HREF, the operational
       convection-allowing ensemble, is not on AWS, and RRFS's bucket holds
       only its retrospective runs (checked 2026-10-22); this is what the
       open data can honestly give. Same files as HRRR. */
    tle: {
      label: 'HRRR-TLE', long: 'Time-lagged HRRR ensemble — the last six HRRR runs valid at the same hour, each looked at within 40 km',
      bucket: 'https://noaa-hrrr-bdp-pds.s3.amazonaws.com', cycle: 1, lookBack: 4, minHours: 3, members: 6, radiusKm: 40,
      prefix: (run) => `hrrr.${ymd(run)}/conus/hrrr.t${hh(run)}z.wrfsfcf`,
      file: (run, fh) => `hrrr.${ymd(run)}/conus/hrrr.t${hh(run)}z.wrfsfcf${pad(fh)}.grib2`,
      hours: (have) => have.filter((h) => h >= 1 && h <= 15)
    },
    /* SPC-style mesoanalysis, on the map: the HRRR's analysis hour — its
       best picture of the atmosphere now, observations folded in — for each
       of the last six hours, so a field can be stepped through like a loop.
       SPC draws its own from the RAP, whose bucket allows no browser; the
       HRRR's analysis carries the effective-layer helicity, the most-
       unstable parcel's level and the equilibrium level that the SPC
       composites need. Ric, 2026-10-22: "do it". */
    /* the mesoanalysis computed SPC's way on a server, once an hour
       (meso/build.mjs: the RAP's one-hour forecast, NOAA's RTMA at the
       ground, every column through every level) and kept by the Worker for
       a day. The page only draws it. When the server has nothing recent the
       page falls back to `meso` below, worked out here from the HRRR. */
    smeso: {
      label: 'Mesoanalysis', long: 'Mesoanalysis — the RAP\'s one-hour forecast with NOAA\'s surface analysis at the ground, every column through every level, computed hourly',
      analysis: true, server: true, frames: 6, staleMs: 3 * 3600e3,
      base: () => ((root.Wx && root.Wx.host) ? root.Wx.host() : 'https://training-log.rmbuster82.workers.dev') + '/meso'
    },
    meso: {
      label: 'Mesoanalysis (HRRR)', long: 'Mesoanalysis — the HRRR analysis hour (3 km), the last six hours, lower 48',
      bucket: 'https://noaa-hrrr-bdp-pds.s3.amazonaws.com', cycle: 1, lookBack: 4, minHours: 1, analysis: true, frames: 6,
      prefix: (run) => `hrrr.${ymd(run)}/conus/hrrr.t${hh(run)}z.wrfsfcf`,
      file: (run, fh) => `hrrr.${ymd(run)}/conus/hrrr.t${hh(run)}z.wrfsfcf${pad(fh)}.grib2`,
      hours: (have) => have.filter((h) => h === 0)
    },
    /* ECMWF's own open data: the IFS at 0.25°, and AIFS, its machine-learned
       model. ECMWF puts the same files on Google Cloud (ecmwf-open-data) and
       AWS (ecmwf-forecasts), both CORS open; Google's is asked first because
       AWS's answered most requests with 503 "Slow Down" — with no CORS
       header, so a browser sees only a failure — while this was built
       (2026-10-22). `retrying` falls back to AWS. Each file comes with a
       JSON-lines .index; the fields are CCSDS-packed (grib2.js's aec). The
       00Z and 12Z runs go to 15 days (drawn to 10, as the GFS is); 06Z and 18Z
       are shorter and not drawn. ECMWF's licence (CC BY 4.0) asks for credit:
       the map's corner gives it whenever these are shown. */
    ecmwf: {
      label: 'ECMWF', long: 'ECMWF IFS — 0.25°, global, the 00Z and 12Z runs, drawn to 10 days', index: 'json',
      bucket: 'https://storage.googleapis.com/ecmwf-open-data', cycle: 12, lookBack: 3, minHours: 40,
      prefix: (run) => `${ymd(run)}/${hh(run)}z/ifs/0p25/oper/${ymd(run)}${hh(run)}0000-`,
      file: (run, fh) => `${ymd(run)}/${hh(run)}z/ifs/0p25/oper/${ymd(run)}${hh(run)}0000-${fh}h-oper-fc.grib2`,
      hours: (have) => have.filter((h) => h <= 240)
    },
    aifs: {
      label: 'ECMWF AIFS', long: 'ECMWF AIFS — the machine-learned model, 0.25°, global, the 00Z and 12Z runs, drawn to 10 days', index: 'json',
      bucket: 'https://storage.googleapis.com/ecmwf-open-data', cycle: 12, lookBack: 3, minHours: 20,
      prefix: (run) => `${ymd(run)}/${hh(run)}z/aifs-single/0p25/oper/${ymd(run)}${hh(run)}0000-`,
      file: (run, fh) => `${ymd(run)}/${hh(run)}z/aifs-single/0p25/oper/${ymd(run)}${hh(run)}0000-${fh}h-oper-fc.grib2`,
      hours: (have) => have.filter((h) => h <= 240)
    },
    /* NOAA's GEFS: 31 runs of the GFS (gec00 and gep01–30) at 0.5°, with
       NOAA's own mean (geavg) and spread (gespr). Every 6 hours, where each
       member's rain is a 6-hour total, out to 16 days. */
    gefs: {
      label: 'GEFS', long: 'NOAA GEFS ensemble — 31 runs of the GFS, 0.5°, every 6 hours to 16 days',
      bucket: 'https://noaa-gefs-pds.s3.amazonaws.com', cycle: 6, lookBack: 4, minHours: 20, members: ['gec00', ...Array.from({ length: 30 }, (_, k) => 'gep' + pad(k + 1))],
      prefix: (run) => `gefs.${ymd(run)}/${hh(run)}/atmos/pgrb2ap5/geavg.t${hh(run)}z.pgrb2a.0p50.f`,
      file: (run, fh, member = 'geavg') => `gefs.${ymd(run)}/${hh(run)}/atmos/pgrb2ap5/${member}.t${hh(run)}z.pgrb2a.0p50.f${pad(fh, 3)}`,
      hours: (have) => have.filter((h) => h > 0 && h % 6 === 0)
    },
    /* the NAM's 3 km CONUS nest: the other storm-scale model forecasters
       check the HRRR against, every 6 hours to 60 hours (2026-10-22) */
    nam: {
      label: 'NAM 3 km', long: 'NOAA NAM 3 km CONUS nest — every 6 hours, out to 60 hours',
      bucket: 'https://noaa-nam-pds.s3.amazonaws.com', cycle: 6, lookBack: 4, minHours: 12,
      prefix: (run) => `nam.${ymd(run)}/nam.t${hh(run)}z.conusnest.hiresf`,
      file: (run, fh) => `nam.${ymd(run)}/nam.t${hh(run)}z.conusnest.hiresf${pad(fh)}.tm00.grib2`,
      hours: (have) => have
    },
    /* the RAP at 13 km, its native grid (the only RAP files that are not
       JPEG 2000). NOAA's RAP bucket sends no CORS header, so the Worker's
       /rap passes these files through — byte ranges, untouched. Until the
       Worker is deployed with /rap, this source says it did not answer. */
    rap: {
      label: 'RAP', long: 'NOAA RAP — 13 km, a new run every hour, North America',
      get bucket() { return ((root.Wx && root.Wx.host) ? root.Wx.host() : 'https://training-log.rmbuster82.workers.dev') + '/rap'; },
      cycle: 1, lookBack: 4, minHours: 10,
      prefix: (run) => `rap.${ymd(run)}/rap.t${hh(run)}z.wrfprsf`,
      file: (run, fh) => `rap.${ymd(run)}/rap.t${hh(run)}z.wrfprsf${pad(fh)}.grib2`,
      hours: (have) => have
    },
    /* the National Blend of Models' own probabilities: NOAA's calibrated
       blend of many models, at 2.5 km. Only its chances are drawn here — its
       best-guess numbers are already what the forecast cards compare. Its
       6-hour windows end at 00, 06, 12 and 18Z whatever hour the run began,
       so the hours drawn are the ones valid then, to 10 days (fewer kinds
       past 2 days, as the Blend publishes). */
    nbm: {
      label: 'National Blend', long: 'NOAA National Blend of Models — calibrated chances from many models, 2.5 km, lower 48, a new run every hour',
      bucket: 'https://noaa-nbm-grib2-pds.s3.amazonaws.com', cycle: 1, lookBack: 6, minHours: 40,
      prefix: (run) => `blend.${ymd(run)}/${hh(run)}/core/blend.t${hh(run)}z.core.f`,
      file: (run, fh) => `blend.${ymd(run)}/${hh(run)}/core/blend.t${hh(run)}z.core.f${pad(fh, 3)}.co.grib2`,
      hours: (have, run) => have.filter((h) => h >= 6 && (new Date(run).getUTCHours() + h) % 6 === 0 && h <= 240)
    },
    gfs: {
      label: 'GFS', long: 'NOAA GFS — 0.25°, global, a new run every 6 hours',
      bucket: 'https://noaa-gfs-bdp-pds.s3.amazonaws.com', cycle: 6, lookBack: 4, minHours: 30,
      prefix: (run) => `gfs.${ymd(run)}/${hh(run)}/atmos/gfs.t${hh(run)}z.pgrb2.0p25.f`,
      file: (run, fh) => `gfs.${ymd(run)}/${hh(run)}/atmos/gfs.t${hh(run)}z.pgrb2.0p25.f${pad(fh, 3)}`,
      /* every 3 hours to 5 days, then every 6 to 10 */
      hours: (have) => have.filter((h) => (h <= 120 ? h % 3 === 0 : h % 6 === 0) && h <= 240)
    }
  };

  /* ── canonical units, and how each is said in the visitor's units ── */
  const UNIT = {
    temp: { us: ['°F', (v) => v], metric: ['°C', (v) => (v - 32) * 5 / 9] },
    tempC: { us: ['°C', (v) => v], metric: ['°C', (v) => v] },
    precip: { us: ['in', (v) => v], metric: ['mm', (v) => v * 25.4] },
    snow: { us: ['in', (v) => v], metric: ['cm', (v) => v * 2.54] },
    mph: { us: ['mph', (v) => v], metric: ['km/h', (v) => v * 1.609344] },
    kt: { us: ['kt', (v) => v], metric: ['kt', (v) => v] },
    kft: { us: ['kft', (v) => v], metric: ['km', (v) => v * 0.3048] },
    mi: { us: ['mi', (v) => v], metric: ['km', (v) => v * 1.609344] },
    jkg: { us: ['J/kg', (v) => v], metric: ['J/kg', (v) => v] },
    m2s2: { us: ['m²/s²', (v) => v], metric: ['m²/s²', (v) => v] },
    dbz: { us: ['dBZ', (v) => v], metric: ['dBZ', (v) => v] },
    pct: { us: ['%', (v) => v], metric: ['%', (v) => v] },
    vort: { us: ['×10⁻⁵ s⁻¹', (v) => v], metric: ['×10⁻⁵ s⁻¹', (v) => v] },
    dam: { us: ['dam', (v) => v], metric: ['dam', (v) => v] },
    ltng: { us: ['fl/km²/5 min', (v) => v], metric: ['fl/km²/5 min', (v) => v] },
    index: { us: ['', (v) => v], metric: ['', (v) => v] },
    jkgneg: { us: ['J/kg', (v) => v], metric: ['J/kg', (v) => v] },
    hpa: { us: ['hPa', (v) => v], metric: ['hPa', (v) => v] },
    magl: { us: ['ft', (v) => v * 3.28084], metric: ['m', (v) => v] },
    gpm: { us: ['m', (v) => v], metric: ['m', (v) => v] },
    lapse: { us: ['°C/km', (v) => v], metric: ['°C/km', (v) => v] },
    kelvin: { us: ['K', (v) => v], metric: ['K', (v) => v] },
    deg: { us: ['°', (v) => v], metric: ['°', (v) => v] },
    mcon: { us: ['g/kg per hour', (v) => v], metric: ['g/kg per hour', (v) => v] },
    /* MRMS's (mrms.js) */
    rot: { us: ['×10⁻³ s⁻¹', (v) => v], metric: ['×10⁻³ s⁻¹', (v) => v] },
    hailin: { us: ['in', (v) => v], metric: ['mm', (v) => v * 25.4] },
    kgm2: { us: ['kg/m²', (v) => v], metric: ['kg/m²', (v) => v] },
    inhr: { us: ['in/h', (v) => v], metric: ['mm/h', (v) => v * 25.4] }
  };
  function say(unit, v, units) {
    const [name, f] = UNIT[unit][units === 'metric' ? 'metric' : 'us'];
    const x = f(v), a = Math.abs(x);
    return `${a >= 100 || unit === 'jkg' || unit === 'm2s2' ? Math.round(x) : a >= 10 ? x.toFixed(0) : a >= 1 ? x.toFixed(1) : x.toFixed(2)} ${name}`;
  }

  /* ── palettes, in canonical units; `floor` and `ceil` leave the rest clear ── */
  const PAL = {
    temp: { stops: [[-40, '#f0e1ff'], [-20, '#b36bff'], [0, '#5b2bd9'], [10, '#2b5bd9'], [20, '#2b8fe0'], [32, '#7fd1ff'], [32.01, '#2fa45a'], [45, '#7fc94a'],
      [55, '#c8dd4a'], [65, '#f2d94a'], [75, '#f5a23a'], [85, '#ec6a2a'], [95, '#d9302a'], [105, '#a0102a'], [115, '#ff9fd0']], ticks: [-20, 0, 20, 32, 50, 70, 90, 110] },
    dew: { stops: [[-10, '#7a5a3a'], [20, '#b89a6a'], [40, '#d9cfa0'], [50, '#9fd38a'], [55, '#4fbf5a'], [60, '#1f9f3a'], [65, '#0f7f8a'], [70, '#2a5fd9'], [75, '#7a3ad9'], [80, '#d93ad9']],
      ticks: [20, 40, 50, 60, 70, 80] },
    t850: { stops: [[-35, '#f0e1ff'], [-25, '#7a3ad9'], [-15, '#2b5bd9'], [-5, '#2b8fe0'], [0, '#7fd1ff'], [0.01, '#2fa45a'], [8, '#c8dd4a'], [16, '#f5a23a'], [24, '#d9302a'], [32, '#a0102a']],
      ticks: [-30, -20, -10, 0, 10, 20, 30] },
    precip: { floor: 0.01, stops: [[0.01, '#c9e8c3'], [0.1, '#7fcf7a'], [0.25, '#2fa84a'], [0.5, '#1f7f3a'], [0.75, '#f2e14a'], [1, '#f5b43a'], [1.5, '#f07a2a'], [2, '#e0382a'],
      [3, '#b0122a'], [4, '#d93ad9'], [6, '#8a3ad9'], [10, '#ffffff']], ticks: [0.1, 0.5, 1, 2, 4, 6], log: true },
    snow: { floor: 0.1, stops: [[0.1, '#d6e9ff'], [1, '#9cc8ff'], [2, '#5fa3f5'], [4, '#2f6fd9'], [6, '#2f3fb0'], [8, '#6b2fb0'], [12, '#a12fb0'], [18, '#d93ad9'], [24, '#ff8fd9'], [36, '#ffffff']],
      ticks: [1, 2, 4, 8, 12, 24], log: true },
    wind: { floor: 5, stops: [[5, '#d6eef5'], [15, '#9fd6e8'], [25, '#5fb8d9'], [35, '#2fd16f'], [45, '#f2e14a'], [55, '#f5a23a'], [65, '#e0382a'], [80, '#b0122a'], [100, '#d93ad9']],
      ticks: [10, 20, 30, 40, 50, 60, 80] },
    jet: { floor: 50, stops: [[50, '#cfe8ff'], [70, '#8fc4ff'], [90, '#4f8fff'], [110, '#3fbf6f'], [130, '#f2e14a'], [150, '#f07a2a'], [170, '#e0382a'], [190, '#d93ad9']],
      ticks: [60, 80, 100, 120, 140, 160, 180] },
    cape: { floor: 100, stops: [[100, '#cfe8c3'], [500, '#7fcf7a'], [1000, '#f2e14a'], [1500, '#f5b43a'], [2000, '#f07a2a'], [3000, '#e0382a'], [4000, '#b0122a'], [5000, '#d93ad9'], [7000, '#ffffff']],
      ticks: [500, 1000, 2000, 3000, 4000, 5000] },
    srh: { floor: 50, stops: [[50, '#cfe8ff'], [100, '#8fc4ff'], [150, '#3fbf6f'], [200, '#f2e14a'], [300, '#f07a2a'], [400, '#e0382a'], [500, '#b0122a'], [700, '#d93ad9']],
      ticks: [100, 200, 300, 400, 500] },
    uh: { floor: 25, stops: [[25, '#f2e14a'], [50, '#f07a2a'], [75, '#e0382a'], [100, '#b0122a'], [150, '#d93ad9'], [250, '#ffffff']], ticks: [25, 50, 75, 100, 150, 250] },
    dbz: { floor: 5, stops: [[5, '#04e9e7'], [10, '#019ff4'], [15, '#0300f4'], [20, '#02fd02'], [25, '#01c501'], [30, '#008e00'], [35, '#fdf802'], [40, '#e5bc00'],
      [45, '#fd9500'], [50, '#fd0000'], [55, '#d40000'], [60, '#bc0000'], [65, '#f800fd'], [70, '#9854c6'], [75, '#fdfdfd']], ticks: [10, 20, 30, 40, 50, 60, 70] },
    pwat: { floor: 0.1, stops: [[0.1, '#7a5a3a'], [0.5, '#d9cfa0'], [0.75, '#9fd38a'], [1, '#3fbf6f'], [1.25, '#1f9f8a'], [1.5, '#2a7fd9'], [1.75, '#2a4fd9'], [2, '#7a3ad9'], [2.5, '#d93ad9'], [3, '#ffffff']],
      ticks: [0.5, 1, 1.5, 2, 2.5] },
    vis: { ceil: 7, stops: [[0, '#d93ad9'], [0.25, '#e0382a'], [1, '#f07a2a'], [3, '#f2e14a'], [5, '#9fd38a'], [7, '#cfe8c3']], ticks: [0.25, 1, 3, 5, 7] },
    tops: { floor: 5, stops: [[5, '#1e3a8a'], [15, '#2563eb'], [25, '#10b981'], [35, '#fde047'], [45, '#f97316'], [55, '#ef4444'], [65, '#d946ef']], ticks: [10, 20, 30, 40, 50, 60] },
    ltng: { floor: 0.02, stops: [[0.02, '#fde047'], [0.5, '#f97316'], [1, '#ef4444'], [2, '#d946ef'], [4, '#ffffff']], ticks: [0.5, 1, 2, 4] },
    cloud: { floor: 5, stops: [[5, '#2b3240'], [50, '#7a8494'], [100, '#e9ecef']], ticks: [25, 50, 75, 100] },
    vort: { floor: 10, stops: [[10, '#f2e14a'], [14, '#f5b43a'], [18, '#f07a2a'], [22, '#e0382a'], [28, '#b0122a'], [36, '#d93ad9'], [50, '#ffffff']], ticks: [12, 16, 20, 28, 36] },
    thick: { stops: [[504, '#5b2bd9'], [522, '#2b8fe0'], [540, '#7fd1ff'], [540.01, '#9fd94a'], [558, '#f2e14a'], [576, '#f07a2a'], [594, '#b0122a']], ticks: [510, 528, 540, 558, 576] },
    /* the composites (STP, SCP, EHI) are indexes of ingredients — 1 is where
       SPC's climatology says significant tornadoes and supercells become
       likelier — and CIN is drawn as how strong the cap is */
    stp: { floor: 0.5, stops: [[0.5, '#9fd38a'], [1, '#f2e14a'], [2, '#f5a23a'], [3, '#e0382a'], [5, '#d93ad9'], [8, '#8a3ad9'], [12, '#ffffff']], ticks: [1, 2, 3, 5, 8] },
    scp: { floor: 1, stops: [[1, '#9fd38a'], [2, '#f2e14a'], [4, '#f5a23a'], [8, '#e0382a'], [12, '#d93ad9'], [20, '#8a3ad9'], [30, '#ffffff']], ticks: [2, 4, 8, 12, 20] },
    ehi: { floor: 0.5, stops: [[0.5, '#9fd38a'], [1, '#f2e14a'], [2, '#f5a23a'], [3, '#e0382a'], [4, '#d93ad9'], [6, '#ffffff']], ticks: [1, 2, 3, 4] },
    shear: { floor: 20, stops: [[20, '#cfe8ff'], [30, '#8fc4ff'], [40, '#3fbf6f'], [50, '#f2e14a'], [60, '#f07a2a'], [70, '#e0382a'], [90, '#d93ad9']], ticks: [30, 40, 50, 60, 70] },
    cin: { floor: 10, stops: [[10, '#d6e9ff'], [25, '#9cc8ff'], [50, '#5fa3f5'], [100, '#2f6fd9'], [200, '#6b2fb0'], [300, '#a12fb0']], ticks: [25, 50, 100, 200] },
    prob: { floor: 5, stops: [[5, '#c9e8c3'], [10, '#8fd18f'], [20, '#2fa84a'], [30, '#f2e14a'], [40, '#f5a23a'], [50, '#e0382a'], [60, '#b0122a'], [70, '#d93ad9'], [80, '#8a3ad9'], [90, '#ffffff']],
      ticks: [10, 20, 30, 50, 70, 90] },
    /* MRMS: rotation (azimuthal shear, ×10⁻³ s⁻¹ — SPC's tracks start near 0.006),
       hail size, the chance of severe hail, VIL */
    rot: { floor: 5, stops: [[5, '#1e3a8a'], [7, '#2563eb'], [9, '#10b981'], [11, '#facc15'], [13, '#f97316'], [16, '#ef4444'], [20, '#d946ef'], [30, '#ffffff']],
      ticks: [6, 8, 10, 12, 15, 20, 25] },
    hail: { floor: 0.25, stops: [[0.25, '#9fd38a'], [0.5, '#3fbf6f'], [0.75, '#f2e14a'], [1, '#f5a23a'], [1.5, '#e0382a'], [2, '#d93ad9'], [2.75, '#8a3ad9'], [4, '#ffffff']],
      ticks: [0.5, 0.75, 1, 1.5, 2, 2.75, 4] },
    posh: { floor: 10, stops: [[10, '#cfe8c3'], [30, '#f2e14a'], [50, '#f5a23a'], [70, '#e0382a'], [90, '#d93ad9'], [100, '#ffffff']], ticks: [10, 30, 50, 70, 90] },
    vil: { floor: 1, stops: [[1, '#1e3a8a'], [5, '#2563eb'], [10, '#10b981'], [20, '#84cc16'], [30, '#fde047'], [40, '#f97316'], [50, '#ef4444'], [65, '#d946ef'], [80, '#ffffff']],
      ticks: [5, 10, 20, 30, 40, 50, 65] },
    /* the mesoanalysis's own (SPC shades from about where each starts to matter) */
    cape3: { floor: 25, stops: [[25, '#cfe8c3'], [50, '#7fcf7a'], [100, '#f2e14a'], [150, '#f5a23a'], [200, '#e0382a'], [300, '#d93ad9']], ticks: [50, 100, 150, 200, 300] },
    dcape: { floor: 400, stops: [[400, '#cfe8ff'], [700, '#8fc4ff'], [1000, '#3fbf6f'], [1300, '#f2e14a'], [1600, '#f07a2a'], [2000, '#e0382a'], [2500, '#d93ad9']], ticks: [600, 1000, 1400, 1800, 2200] },
    lapse: { floor: 5.5, stops: [[5.5, '#cfe8ff'], [6.5, '#8fd18f'], [7, '#f2e14a'], [7.5, '#f5a23a'], [8, '#e0382a'], [8.5, '#b0122a'], [9.5, '#d93ad9']], ticks: [6, 6.5, 7, 7.5, 8, 9] },
    lcl: { ceil: 3000, stops: [[250, '#1f9f3a'], [750, '#7fc94a'], [1000, '#c8dd4a'], [1500, '#f2d94a'], [2000, '#d9a050'], [3000, '#a07050']], ticks: [500, 1000, 1500, 2000, 2500] },
    thetae: { floor: 300, stops: [[300, '#5b2bd9'], [320, '#2b8fe0'], [330, '#2fa45a'], [340, '#c8dd4a'], [350, '#f5a23a'], [360, '#e0382a'], [370, '#d93ad9']], ticks: [310, 320, 330, 340, 350, 360] },
    mcon: { floor: 0.5, stops: [[0.5, '#cfe8c3'], [1, '#7fcf7a'], [2, '#2fa84a'], [4, '#f2e14a'], [8, '#f07a2a'], [15, '#d93ad9']], ticks: [1, 2, 4, 8, 15], log: true },
    shear1: { floor: 10, stops: [[10, '#cfe8ff'], [20, '#8fc4ff'], [30, '#3fbf6f'], [40, '#f2e14a'], [50, '#f07a2a'], [60, '#e0382a']], ticks: [15, 20, 30, 40, 50] },
    angle: { stops: [[0, '#2b3240'], [30, '#5f6b7a'], [60, '#f2e14a'], [90, '#e0382a'], [120, '#f2e14a'], [150, '#5f6b7a'], [180, '#2b3240']], ticks: [30, 60, 90, 120, 150] },
    ship: { floor: 0.5, stops: [[0.5, '#9fd38a'], [1, '#f2e14a'], [1.5, '#f5a23a'], [2, '#e0382a'], [3, '#d93ad9'], [4, '#ffffff']], ticks: [0.5, 1, 1.5, 2, 3, 4] },
    /* how far the ensemble's runs disagree */
    spread: { floor: 10, stops: [[10, '#1e2a3a'], [30, '#2f5f8f'], [60, '#3fbf6f'], [90, '#f2e14a'], [120, '#f07a2a'], [180, '#e0382a']], ticks: [20, 40, 60, 90, 120, 180] },
    spreadp: { floor: 1, stops: [[1, '#1e2a3a'], [2, '#2f5f8f'], [4, '#3fbf6f'], [6, '#f2e14a'], [9, '#f07a2a'], [14, '#e0382a']], ticks: [2, 4, 6, 9, 14] },
    /* precipitation type: the colour is the type, its depth the echo */
    ptype: { cat: true, types: { 1: ['Rain', '#2fbf4a', '#0b5a1e'], 2: ['Snow', '#7fc4ff', '#1d3fb0'], 3: ['Freezing rain', '#ff7fa8', '#b0123a'], 4: ['Sleet', '#ffb86b', '#b05a0a'] } }
  };

  /* ── the fields ──
     `parts` are .idx patterns over "NAME:LEVEL:FCST"; `value(p, i)` turns
     the parts at grid point i into the canonical unit. */
  const K2F = (k) => (k - 273.15) * 9 / 5 + 32;
  const MS2KT = 1.943844, MS2MPH = 2.236936;
  const acc = (name) => (e) => e.name === name && e.level === 'surface' && /^0-\d+ (hour|day) acc/.test(e.fcst);
  const at = (name, level) => (e) => e.name === name && e.level === level && !/acc|max|min|ave/.test(e.fcst);
  const maxOver = (name, level) => (e) => e.name === name && e.level === level && /max fcst/.test(e.fcst);
  const FIELDS = {
    hrrr: [
      { id: 'refc', group: 'Storms', label: 'Composite reflectivity', unit: 'dbz', pal: 'dbz', parts: { r: at('REFC', 'entire atmosphere') }, value: (p, i) => p.r[i] },
      { id: 'ptype', group: 'Storms', label: 'Precipitation type', unit: 'dbz', pal: 'ptype', nearest: true,
        parts: { r: at('REFC', 'entire atmosphere'), rain: at('CRAIN', 'surface'), snow: at('CSNOW', 'surface'), frz: at('CFRZR', 'surface'), ip: at('CICEP', 'surface') },
        /* a code: type × 100 + echo; snow wins a tie, then freezing rain, then sleet, as the NWS's own map does */
        value: (p, i) => { const r = p.r[i]; if (!(r >= 5)) return NaN; const t = p.snow[i] >= 1 ? 2 : p.frz[i] >= 1 ? 3 : p.ip[i] >= 1 ? 4 : 1; return t * 100 + Math.min(75, r); } },
      { id: 'uh', group: 'Storms', label: 'Updraft helicity 2–5 km (hourly max)', unit: 'm2s2', pal: 'uh', parts: { u: maxOver('MXUPHL', '5000-2000 m above ground') }, value: (p, i) => p.u[i] },
      { id: 'sbcape', group: 'Storms', label: 'Surface CAPE', unit: 'jkg', pal: 'cape', parts: { c: at('CAPE', 'surface') }, value: (p, i) => p.c[i] },
      { id: 'mlcape', group: 'Storms', label: 'Mixed-layer CAPE (90 mb)', unit: 'jkg', pal: 'cape', parts: { c: at('CAPE', '90-0 mb above ground') }, value: (p, i) => p.c[i] },
      { id: 'mucape', group: 'Storms', label: 'Most-unstable CAPE', unit: 'jkg', pal: 'cape', parts: { c: at('CAPE', '255-0 mb above ground') }, value: (p, i) => p.c[i] },
      { id: 'srh01', group: 'Storms', label: '0–1 km storm-relative helicity', unit: 'm2s2', pal: 'srh', parts: { h: at('HLCY', '1000-0 m above ground') }, value: (p, i) => p.h[i] },
      { id: 'srh03', group: 'Storms', label: '0–3 km storm-relative helicity', unit: 'm2s2', pal: 'srh', parts: { h: at('HLCY', '3000-0 m above ground') }, value: (p, i) => p.h[i] },
      /* SPC's fixed-layer significant tornado parameter (Thompson et al. 2003):
         each ingredient over its typical value, the LCL term 1 below 1000 m
         and 0 above 2000, the shear term 0 under 12.5 m/s and held at 1.5
         above 30 */
      { id: 'stp', group: 'Severe', label: 'Significant tornado parameter (fixed layer)', unit: 'index', pal: 'stp',
        parts: { c: at('CAPE', 'surface'), lcl: at('HGT', 'level of adiabatic condensation from sfc'), zs: at('HGT', 'surface'), h: at('HLCY', '1000-0 m above ground'),
          u: at('VUCSH', '0-6000 m above ground'), v: at('VVCSH', '0-6000 m above ground') },
        value: (p, i) => {
          const lcl = p.lcl[i] - p.zs[i], bwd = Math.hypot(p.u[i], p.v[i]);
          const lclT = lcl < 1000 ? 1 : lcl > 2000 ? 0 : (2000 - lcl) / 1000, bwdT = bwd < 12.5 ? 0 : Math.min(1.5, bwd / 20);
          return Math.max(0, p.c[i] / 1500 * lclT * (p.h[i] / 150) * bwdT);
        } },
      /* the supercell composite with fixed layers where SPC's uses the
         effective ones (which need a sounding at every point): most-unstable
         CAPE, 0–3 km helicity, 0–6 km shear — an approximation, and named so */
      { id: 'scp', group: 'Severe', label: 'Supercell composite (fixed-layer approximation)', unit: 'index', pal: 'scp',
        parts: { c: at('CAPE', '255-0 mb above ground'), h: at('HLCY', '3000-0 m above ground'), u: at('VUCSH', '0-6000 m above ground'), v: at('VVCSH', '0-6000 m above ground') },
        value: (p, i) => { const bwd = Math.hypot(p.u[i], p.v[i]), s = bwd < 10 ? 0 : Math.min(1, bwd / 20); return Math.max(0, p.c[i] / 1000 * (p.h[i] / 50) * s); } },
      { id: 'ehi', group: 'Severe', label: 'Energy-helicity index, 0–1 km', unit: 'index', pal: 'ehi',
        parts: { c: at('CAPE', 'surface'), h: at('HLCY', '1000-0 m above ground') }, value: (p, i) => Math.max(0, p.c[i] * p.h[i] / 160000) },
      { id: 'shear6', group: 'Severe', label: '0–6 km bulk shear and barbs', unit: 'kt', pal: 'shear',
        parts: { u: at('VUCSH', '0-6000 m above ground'), v: at('VVCSH', '0-6000 m above ground') }, value: (p, i) => Math.hypot(p.u[i], p.v[i]) * MS2KT, barbs: ['u', 'v'] },
      { id: 'mlcin', group: 'Severe', label: 'Mixed-layer CIN (the cap)', unit: 'jkgneg', pal: 'cin', parts: { c: at('CIN', '90-0 mb above ground') }, value: (p, i) => -p.c[i] },
      { id: 'tops', group: 'Storms', label: 'Echo tops', unit: 'kft', pal: 'tops', parts: { t: at('RETOP', 'cloud top') }, value: (p, i) => (p.t[i] > 0 ? p.t[i] * 3.28084 / 1000 : NaN) },
      { id: 'ltng', group: 'Storms', label: 'Lightning threat', unit: 'ltng', pal: 'ltng', parts: { l: at('LTNG', 'entire atmosphere') }, value: (p, i) => p.l[i] },
      { id: 't2m', group: 'Surface', label: 'Temperature', unit: 'temp', pal: 'temp', parts: { t: at('TMP', '2 m above ground') }, value: (p, i) => K2F(p.t[i]) },
      { id: 'td2m', group: 'Surface', label: 'Dew point', unit: 'temp', pal: 'dew', parts: { t: at('DPT', '2 m above ground') }, value: (p, i) => K2F(p.t[i]) },
      { id: 'wind10', group: 'Surface', label: 'Wind (10 m) and barbs', unit: 'mph', pal: 'wind', parts: { u: at('UGRD', '10 m above ground'), v: at('VGRD', '10 m above ground') },
        value: (p, i) => Math.hypot(p.u[i], p.v[i]) * MS2MPH, barbs: ['u', 'v'] },
      { id: 'gust', group: 'Surface', label: 'Wind gusts', unit: 'mph', pal: 'wind', parts: { g: at('GUST', 'surface') }, value: (p, i) => p.g[i] * MS2MPH },
      { id: 'mslp', group: 'Surface', label: 'Pressure (MSLP) and temperature', unit: 'temp', pal: 'temp', parts: { t: at('TMP', '2 m above ground'), p: at('MSLMA', 'mean sea level') },
        value: (p, i) => K2F(p.t[i]), contours: [{ part: 'p', scale: 0.01, every: 4, unit: 'hpa', color: '#ffffff' }] },
      { id: 'vis', group: 'Surface', label: 'Visibility', unit: 'mi', pal: 'vis', parts: { v: at('VIS', 'surface') }, value: (p, i) => p.v[i] / 1609.344 },
      { id: 'cloud', group: 'Surface', label: 'Cloud cover', unit: 'pct', pal: 'cloud', parts: { c: at('TCDC', 'entire atmosphere') }, value: (p, i) => p.c[i] },
      { id: 'qpf1', group: 'Rain and snow', label: 'Rain, past hour', unit: 'precip', pal: 'precip',
        parts: { a: (e) => e.name === 'APCP' && e.level === 'surface' && /^(\d+)-(\d+) hour acc/.test(e.fcst) && (+e.fcst.split('-')[1].split(' ')[0]) - (+e.fcst.split('-')[0]) === 1 },
        value: (p, i) => p.a[i] / 25.4 },
      { id: 'qpf', group: 'Rain and snow', label: 'Total rain since the run', unit: 'precip', pal: 'precip', parts: { a: acc('APCP') }, value: (p, i) => p.a[i] / 25.4 },
      { id: 'snow', group: 'Rain and snow', label: 'Total snow since the run (10:1)', unit: 'snow', pal: 'snow', parts: { s: acc('ASNOW') }, value: (p, i) => p.s[i] * 39.3701 },
      { id: 'pwat', group: 'Rain and snow', label: 'Precipitable water', unit: 'precip', pal: 'pwat', parts: { w: at('PWAT', 'entire atmosphere (considered as a single layer)') }, value: (p, i) => p.w[i] / 25.4 }
    ],
    /* each member's field at the hour, an event in it, and the share of
       members with that event within 40 km */
    tle: [
      { id: 'p_uh', group: 'Chance within 40 km', label: 'A rotating storm (2–5 km updraft helicity ≥ 75 m²/s²)', unit: 'pct', pal: 'prob', member: maxOver('MXUPHL', '5000-2000 m above ground'), event: (v) => v >= 75 },
      { id: 'p_dbz', group: 'Chance within 40 km', label: 'A strong storm (40 dBZ or more)', unit: 'pct', pal: 'prob', member: at('REFC', 'entire atmosphere'), event: (v) => v >= 40 },
      { id: 'p_rain', group: 'Chance within 40 km', label: '1 inch of rain in an hour', unit: 'pct', pal: 'prob',
        member: (e) => e.name === 'APCP' && e.level === 'surface' && /^(\d+)-(\d+) hour acc/.test(e.fcst) && (+e.fcst.split('-')[1].split(' ')[0]) - (+e.fcst.split('-')[0]) === 1, event: (v) => v >= 25.4 },
      { id: 'p_wind', group: 'Chance within 40 km', label: 'A 58 mph wind (hourly maximum)', unit: 'pct', pal: 'prob', member: maxOver('WIND', '10 m above ground'), event: (v) => v >= 25.93 }
    ],
    meso: MESO_FIELDS(),
    smeso: MG ? MG.FIELDS.map((f) => ({ id: f.id, group: f.group, label: f.label, unit: f.unit, pal: f.pal, server: f })) : [],
    ecmwf: EC_FIELDS(true),
    aifs: EC_FIELDS(false),
    gefs: GEFS_FIELDS(),
    gfs: [
      { id: 'h500', group: 'Upper air', label: '500 mb heights and vorticity', unit: 'vort', pal: 'vort', parts: { z: at('HGT', '500 mb'), a: at('ABSV', '500 mb') },
        value: (p, i) => p.a[i] * 1e5, contours: [{ part: 'z', scale: 0.1, every: 6, unit: 'dam', color: '#ffffff' }] },
      { id: 'jet250', group: 'Upper air', label: '250 mb wind (the jet)', unit: 'kt', pal: 'jet', parts: { u: at('UGRD', '250 mb'), v: at('VGRD', '250 mb'), z: at('HGT', '250 mb') },
        value: (p, i) => Math.hypot(p.u[i], p.v[i]) * MS2KT, barbs: ['u', 'v'], contours: [{ part: 'z', scale: 0.1, every: 12, unit: 'dam', color: '#d0d4da' }] },
      { id: 't850', group: 'Upper air', label: '850 mb temperature and heights', unit: 'tempC', pal: 't850', parts: { t: at('TMP', '850 mb'), z: at('HGT', '850 mb') },
        value: (p, i) => p.t[i] - 273.15, contours: [{ part: 'z', scale: 0.1, every: 3, unit: 'dam', color: '#ffffff' }] },
      { id: 'mslp', group: 'Surface', label: 'Pressure (MSLP) and 1000–500 mb thickness', unit: 'dam', pal: 'thick',
        parts: { p: at('PRMSL', 'mean sea level'), z5: at('HGT', '500 mb'), z1: at('HGT', '1000 mb') },
        value: (p, i) => (p.z5[i] - p.z1[i]) / 10, contours: [{ part: 'p', scale: 0.01, every: 4, unit: 'hpa', color: '#ffffff' }] },
      { id: 't2m', group: 'Surface', label: 'Temperature', unit: 'temp', pal: 'temp', parts: { t: at('TMP', '2 m above ground') }, value: (p, i) => K2F(p.t[i]) },
      { id: 'td2m', group: 'Surface', label: 'Dew point', unit: 'temp', pal: 'dew', parts: { t: at('DPT', '2 m above ground') }, value: (p, i) => K2F(p.t[i]) },
      { id: 'wind10', group: 'Surface', label: 'Wind (10 m) and barbs', unit: 'mph', pal: 'wind', parts: { u: at('UGRD', '10 m above ground'), v: at('VGRD', '10 m above ground') },
        value: (p, i) => Math.hypot(p.u[i], p.v[i]) * MS2MPH, barbs: ['u', 'v'] },
      { id: 'gust', group: 'Surface', label: 'Wind gusts', unit: 'mph', pal: 'wind', parts: { g: at('GUST', 'surface') }, value: (p, i) => p.g[i] * MS2MPH },
      { id: 'cape', group: 'Surface', label: 'Surface CAPE', unit: 'jkg', pal: 'cape', parts: { c: at('CAPE', 'surface') }, value: (p, i) => p.c[i] },
      { id: 'qpf', group: 'Rain and snow', label: 'Total rain since the run', unit: 'precip', pal: 'precip', parts: { a: acc('APCP') }, value: (p, i) => p.a[i] / 25.4 },
      { id: 'pwat', group: 'Rain and snow', label: 'Precipitable water', unit: 'precip', pal: 'pwat', parts: { w: at('PWAT', 'entire atmosphere (considered as a single layer)') }, value: (p, i) => p.w[i] / 25.4 },
      { id: 'snowdepth', group: 'Rain and snow', label: 'Snow depth', unit: 'snow', pal: 'snow', parts: { s: at('SNOD', 'surface') }, value: (p, i) => p.s[i] * 39.3701 }
    ]
  };
  /* the NAM nest and the RAP carry most of the HRRR's fields under the same
     names; where a name or level differs it is swapped, and what one does
     not have (checked against each file's .idx, 2026-10-22) is left out
     rather than shown failing. The upper-air maps are the GFS's. */
  const EA = 'entire atmosphere (considered as a single layer)';
  const derive = (base, { drop = [], swap = {} }) => base.filter((f) => !drop.includes(f.id))
    .map((f) => (swap[f.id] ? { ...f, parts: { ...f.parts, ...swap[f.id] } } : f))
    .concat(FIELDS.gfs.filter((f) => ['h500', 'jet250', 't850'].includes(f.id)));
  /* NAM: no lightning or snowfall fields, rain only in 3-hour pieces (left out) */
  FIELDS.nam = derive(FIELDS.hrrr, { drop: ['ltng', 'snow', 'qpf', 'qpf1'],
    swap: { refc: { r: at('REFC', EA) }, ptype: { r: at('REFC', EA) }, tops: { t: at('RETOP', EA) }, cloud: { c: at('TCDC', EA) }, mslp: { p: at('PRMSL', 'mean sea level') } } });
  /* RAP: no updraft helicity or lightning */
  FIELDS.rap = derive(FIELDS.hrrr, { drop: ['uh', 'ltng'], swap: { tops: { t: at('RETOP', EA) } } });
  FIELDS.nbm = NBM_FIELDS();

  /* ── the National Blend's chances ── each one message, already a percent.
     A 6-hour chance is the window ending at the hour on screen; a chance of
     low cloud or fog is for the hour itself. Thresholds are the Blend's own
     (metres and millimetres in the file). */
  function NBM_FIELDS() {
    const win = (fcst) => { const m = /^(\d+)-(\d+) hour acc/.exec(fcst); return m ? m[2] - m[1] : null; };
    const thr = (e) => e.line.split(':')[3];
    const six = (name, t) => (e) => e.name === name && e.level === 'surface' && win(e.fcst) === 6 && thr(e) === t;
    const now = (name, level, t) => (e) => e.name === name && e.level === level && /^\d+ hour fcst$/.test(e.fcst) && thr(e) === t;
    const GROUP = 'Chance (National Blend)';
    const one = (id, label, test) => ({ id, group: GROUP, label, unit: 'pct', pal: 'prob', parts: { p: test }, value: (p, i) => p.p[i] });
    return [
      one('p_rain6', 'Rain (0.01 in or more) in the 6 hours to now', six('APCP', 'prob >0.254')),
      one('p_tstm6', 'Thunder in the 6 hours to now', six('TSTM', 'probability forecast')),
      one('p_snow1', '1 inch of snow or more in 6 hours', six('ASNOW', 'prob >0.0254')),
      one('p_snow4', '4 inches of snow or more in 6 hours', six('ASNOW', 'prob >0.1016')),
      one('p_ice', '0.1 inch of ice or more in 6 hours', six('FICEAC', 'prob >2.54')),
      one('p_vis1', 'Visibility under 1 mile', now('VIS', 'surface', 'prob <1609.34')),
      one('p_ceil1k', 'Cloud ceiling under 1,000 ft', now('CEIL', 'cloud ceiling', 'prob <304.8'))
    ];
  }

  const field = (src, id) => (FIELDS[src] || []).find((f) => f.id === id) || null;

  /* ── the mesoanalysis's fields ──
     Each from the analysis hour's own numbers. Where SPC's need something
     the file does not hold, the gap is named in the label and here:
     – effective bulk shear: the effective inflow base is the ground where
       the surface parcel has CAPE ≥ 100 J/kg and CIN ≥ −250 (exactly SPC's
       test), otherwise the most-unstable parcel's level; the top is halfway
       to that parcel's equilibrium level, as SPC's is. The winds between are
       the analysis's standard levels (10 m, 1000–250 mb), not every level.
     – DCAPE: sounding.js's downdraft CAPE (held to MetPy) on the column the
       file holds — the ground and 1000, 925, 850, 700, 500 mb — every fifth
       point (15 km; SPC's grid is 40), so it is coarser than a full sounding's.
     – STP and SCP use the effective helicity the HRRR computes itself (EFHL);
       STP's LCL is the surface parcel's (SPC's is the mixed layer's). */
  function MESO_FIELDS() {
    const lvl = (name, mb) => at(name, mb + ' mb');
    const WIND_LEVELS = [1000, 925, 850, 700, 500, 250];
    const windParts = { u10: at('UGRD', '10 m above ground'), v10: at('VGRD', '10 m above ground'), zs: at('HGT', 'surface'), ps: at('PRES', 'surface'),
      z1000: lvl('HGT', 1000), z850: lvl('HGT', 850), z700: lvl('HGT', 700), z500: lvl('HGT', 500) };
    for (const p of WIND_LEVELS) { windParts['u' + p] = lvl('UGRD', p); windParts['v' + p] = lvl('VGRD', p); }
    const ebwdParts = { ...windParts, mu: at('CAPE', '255-0 mb above ground'), sb: at('CAPE', 'surface'), sbcin: at('CIN', 'surface'),
      plpl: at('PLPL', '255-0 mb above ground'), el: at('HGT', 'equilibrium level') };
    /* the height (m above sea level) of each standard level at point i: the
       file has 1000/850/700/500; 925 between 1000 and 850 in ln p, 250 from
       500 by the standard atmosphere's thickness (4.79 km) */
    const levelZ = (p, i, mb) => mb === 925 ? p.z1000[i] + (p.z850[i] - p.z1000[i]) * Math.log(1000 / 925) / Math.log(1000 / 850)
      : mb === 250 ? p.z500[i] + 4790 : p['z' + mb][i];
    /* effective bulk wind difference (m/s) at point i, 0 with no effective layer */
    function ebwdAt(p, i) {
      if (!(p.mu[i] >= 100)) return 0;
      const zs = p.zs[i], ps = p.ps[i] / 100;
      const prof = [[10, p.u10[i], p.v10[i]]];
      for (const mb of WIND_LEVELS) {
        if (mb >= ps) continue;
        const z = levelZ(p, i, mb) - zs;
        if (z > 10) prof.push([z, p['u' + mb][i], p['v' + mb][i]]);
      }
      prof.sort((a, b) => a[0] - b[0]);
      const wind = (h) => {
        if (h <= prof[0][0]) return prof[0];
        for (let k = 0; k + 1 < prof.length; k++) if (h <= prof[k + 1][0]) {
          const a = prof[k], b = prof[k + 1], t = (h - a[0]) / (b[0] - a[0]);
          return [h, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        }
        return prof[prof.length - 1];
      };
      let base = 0;
      if (!(p.sb[i] >= 100 && p.sbcin[i] >= -250)) {
        /* the most-unstable parcel's level, from its pressure, in ln p between the standard levels */
        const pl = p.plpl[i] / 100, pts = [[ps, 0]];
        for (const mb of [1000, 925, 850, 700, 500]) if (mb < ps) pts.push([mb, levelZ(p, i, mb) - zs]);
        base = pts[pts.length - 1][1];
        for (let k = 0; k + 1 < pts.length; k++) if (pl <= pts[k][0] && pl >= pts[k + 1][0]) {
          base = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * Math.log(pts[k][0] / pl) / Math.log(pts[k][0] / pts[k + 1][0]); break;
        }
      }
      const elAgl = p.el[i] - zs;
      if (!(elAgl > base)) return 0;
      const a = wind(base), b = wind(base + (elAgl - base) / 2);
      return Math.hypot(b[1] - a[1], b[2] - a[2]);
    }
    const thetaE = (pPa, tK, tdK) => SND.thetaE(pPa / 100, tK - 273.15, Math.min(tdK, tK) - 273.15);
    const lapse = (lo, hi) => ({ tl: lvl('TMP', lo), th: lvl('TMP', hi), zl: lvl('HGT', lo), zh: lvl('HGT', hi), ps: at('PRES', 'surface') });
    const lapseVal = (lo) => (p, i) => (p.ps[i] / 100 > lo + 10 ? (p.tl[i] - p.th[i]) / (p.zh[i] - p.zl[i]) * 1000 : NaN);
    const dcParts = { ps: at('PRES', 'surface'), zs: at('HGT', 'surface'), t2: at('TMP', '2 m above ground'), d2: at('DPT', '2 m above ground'),
      z1000: lvl('HGT', 1000), z850: lvl('HGT', 850), z700: lvl('HGT', 700), z500: lvl('HGT', 500) };
    for (const mb of [1000, 925, 850, 700, 500]) { dcParts['t' + mb] = lvl('TMP', mb); dcParts['d' + mb] = lvl('DPT', mb); }
    const POOL = 5;
    /* every POOL-th point computed, the rest take the nearest one's value */
    const pooled = (fn) => (p, grid) => {
      const nx = grid.nx, ny = grid.ny, out = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j += POOL) for (let i = 0; i < nx; i += POOL) {
        const v = fn(p, j * nx + i);
        for (let jj = j; jj < Math.min(ny, j + POOL); jj++) out.fill(v, jj * nx + i, jj * nx + Math.min(nx, i + POOL));
      }
      return smooth(out, nx, ny, POOL);                                         // no 15 km blocks
    };
    const dcapeAt = (p, i) => {
      const ps = p.ps[i] / 100, L = [{ p: ps, z: p.zs[i], t: p.t2[i] - 273.15, td: p.d2[i] - 273.15 }];
      for (const mb of [1000, 925, 850, 700, 500]) if (mb < ps - 1) L.push({ p: mb, z: levelZ(p, i, mb), t: p['t' + mb][i] - 273.15, td: p['d' + mb][i] - 273.15 });
      const d = SND.dcape(SND.prepare(L), { step: 10 });
      return d ? d.dcape : NaN;
    };
    /* the most-unstable parcel's mixing ratio (g/kg): the dewpoint at its
       level, in ln p between the ground and the standard levels */
    const shipParts = { mu: at('CAPE', '255-0 mb above ground'), plpl: at('PLPL', '255-0 mb above ground'), ps: at('PRES', 'surface'), d2: at('DPT', '2 m above ground'),
      d925: lvl('DPT', 925), d850: lvl('DPT', 850), d700: lvl('DPT', 700), t700: lvl('TMP', 700), t500: lvl('TMP', 500), z700: lvl('HGT', 700), z500: lvl('HGT', 500),
      u: at('VUCSH', '0-6000 m above ground'), v: at('VVCSH', '0-6000 m above ground'), frz: at('HGT', '0C isotherm'), zs: at('HGT', 'surface') };
    /* SPC's significant hail parameter, every term and limit as SPC's help page gives them */
    const shipAt = (p, i) => {
      const mucape = p.mu[i];
      if (!(mucape > 0)) return 0;
      const ps = p.ps[i] / 100, pl = p.plpl[i] / 100, pts = [[ps, p.d2[i]], [925, p.d925[i]], [850, p.d850[i]], [700, p.d700[i]]].filter(([q]) => q <= ps);
      let td = pts[0][1];
      for (let k = 0; k + 1 < pts.length; k++) if (pl <= pts[k][0] && pl >= pts[k + 1][0]) { td = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * Math.log(pts[k][0] / pl) / Math.log(pts[k][0] / pts[k + 1][0]); break; }
      const r = Math.min(13.6, Math.max(11, SND.mixing(pl, td - 273.15) * 1000));
      const lr = (p.t700[i] - p.t500[i]) / (p.z500[i] - p.z700[i]) * 1000, t5 = Math.min(-5.5, p.t500[i] - 273.15);
      const sh = Math.min(27, Math.max(7, Math.hypot(p.u[i], p.v[i])));
      let v = mucape * r * lr * -t5 * sh / 42e6;
      if (mucape < 1300) v *= mucape / 1300;
      if (lr < 5.8) v *= lr / 5.8;
      const fzl = p.frz[i] - p.zs[i];
      if (fzl < 2400) v *= Math.max(0, fzl) / 2400;
      return Math.max(0, v);
    };
    return [
      { id: 'pmsl', group: 'Surface', label: 'Pressure, temperature and wind', unit: 'temp', pal: 'temp', parts: { t: at('TMP', '2 m above ground'), p: at('MSLMA', 'mean sea level'), u: at('UGRD', '10 m above ground'), v: at('VGRD', '10 m above ground') },
        value: (p, i) => K2F(p.t[i]), contours: [{ part: 'p', scale: 0.01, every: 4, unit: 'hpa', color: '#ffffff' }], barbs: ['u', 'v'] },
      { id: 'td2m', group: 'Surface', label: 'Dew point and wind', unit: 'temp', pal: 'dew', parts: { t: at('DPT', '2 m above ground'), u: at('UGRD', '10 m above ground'), v: at('VGRD', '10 m above ground') },
        value: (p, i) => K2F(p.t[i]), barbs: ['u', 'v'] },
      { id: 'thetae', group: 'Surface', label: 'Theta-e (surface)', unit: 'kelvin', pal: 'thetae', parts: { ps: at('PRES', 'surface'), t: at('TMP', '2 m above ground'), d: at('DPT', '2 m above ground') },
        value: (p, i) => thetaE(p.ps[i], p.t[i], p.d[i]) },
      /* −∇·(q V) at the surface, from the 2 m humidity and the 10 m wind
         (both on the model's own grid, so no rotation is needed), smoothed
         over 27 km first as SPC smooths theirs; only convergence is shaded */
      { id: 'mcon', group: 'Surface', label: 'Moisture convergence (surface)', unit: 'mcon', pal: 'mcon', parts: { q: at('SPFH', '2 m above ground'), u: at('UGRD', '10 m above ground'), v: at('VGRD', '10 m above ground') },
        compute: (p, grid) => {
          const nx = grid.nx, ny = grid.ny, qu = new Float32Array(nx * ny), qv = new Float32Array(nx * ny);
          for (let k = 0; k < nx * ny; k++) { qu[k] = p.q[k] * p.u[k]; qv[k] = p.q[k] * p.v[k]; }
          const su = smooth(qu, nx, ny, 4), sv = smooth(qv, nx, ny, 4), out = new Float32Array(nx * ny).fill(NaN), d = 2 * (grid.dx || 3000);
          for (let j = 1; j + 1 < ny; j++) for (let i = 1; i + 1 < nx; i++) {
            const k = j * nx + i, div = (su[k + 1] - su[k - 1]) / d + (sv[k + nx] - sv[k - nx]) / d;
            out[k] = -div * 1000 * 3600;
          }
          return out;
        }, barbs: ['u', 'v'] },
      { id: 'sbcape', group: 'Thermodynamics', label: 'Surface-based CAPE', unit: 'jkg', pal: 'cape', parts: { c: at('CAPE', 'surface') }, value: (p, i) => p.c[i] },
      { id: 'mlcape', group: 'Thermodynamics', label: 'Mixed-layer CAPE (90 mb), CIN contoured', unit: 'jkg', pal: 'cape', parts: { c: at('CAPE', '90-0 mb above ground'), n: at('CIN', '90-0 mb above ground') },
        value: (p, i) => p.c[i], contours: [{ part: 'n', scale: -1, every: 50, unit: 'jkgneg', color: '#8fc4ff', smooth: 6 }] },
      { id: 'mucape', group: 'Thermodynamics', label: 'Most-unstable CAPE', unit: 'jkg', pal: 'cape', parts: { c: at('CAPE', '255-0 mb above ground') }, value: (p, i) => p.c[i] },
      { id: 'cape3', group: 'Thermodynamics', label: '0–3 km CAPE', unit: 'jkg', pal: 'cape3', parts: { c: at('CAPE', '0-3000 m above ground') }, value: (p, i) => p.c[i] },
      { id: 'dcape', group: 'Thermodynamics', label: 'Downdraft CAPE (from the standard levels)', unit: 'jkg', pal: 'dcape', parts: dcParts, compute: pooled(dcapeAt) },
      { id: 'lr75', group: 'Thermodynamics', label: '700–500 mb lapse rate', unit: 'lapse', pal: 'lapse', parts: lapse(700, 500), value: lapseVal(700) },
      { id: 'lr85', group: 'Thermodynamics', label: '850–500 mb lapse rate', unit: 'lapse', pal: 'lapse', parts: lapse(850, 500), value: lapseVal(850) },
      { id: 'lcl', group: 'Thermodynamics', label: 'LCL height (surface parcel)', unit: 'magl', pal: 'lcl', parts: { l: at('HGT', 'level of adiabatic condensation from sfc'), zs: at('HGT', 'surface') }, value: (p, i) => p.l[i] - p.zs[i] },
      { id: 'lfc', group: 'Thermodynamics', label: 'LFC height', unit: 'magl', pal: 'lcl', parts: { l: at('HGT', 'level of free convection'), zs: at('HGT', 'surface'), c: at('CAPE', 'surface') }, value: (p, i) => (p.c[i] > 0 ? p.l[i] - p.zs[i] : NaN) },
      { id: 'frz', group: 'Thermodynamics', label: 'Freezing level', unit: 'kft', pal: 'tops', parts: { f: at('HGT', '0C isotherm'), zs: at('HGT', 'surface') }, value: (p, i) => Math.max(0, p.f[i] - p.zs[i]) * 3.28084 / 1000 },
      { id: 'pwat', group: 'Thermodynamics', label: 'Precipitable water', unit: 'precip', pal: 'pwat', parts: { w: at('PWAT', 'entire atmosphere (considered as a single layer)') }, value: (p, i) => p.w[i] / 25.4 },
      { id: 'shear1', group: 'Wind shear', label: '0–1 km shear and barbs', unit: 'kt', pal: 'shear1', parts: { u: at('VUCSH', '0-1000 m above ground'), v: at('VVCSH', '0-1000 m above ground') }, value: (p, i) => Math.hypot(p.u[i], p.v[i]) * MS2KT, barbs: ['u', 'v'] },
      { id: 'shear6', group: 'Wind shear', label: '0–6 km shear and barbs', unit: 'kt', pal: 'shear', parts: { u: at('VUCSH', '0-6000 m above ground'), v: at('VVCSH', '0-6000 m above ground') }, value: (p, i) => Math.hypot(p.u[i], p.v[i]) * MS2KT, barbs: ['u', 'v'] },
      { id: 'ebwd', group: 'Wind shear', label: 'Effective bulk shear (from the standard levels)', unit: 'kt', pal: 'shear', parts: ebwdParts, value: (p, i) => ebwdAt(p, i) * MS2KT },
      { id: 'srh1', group: 'Wind shear', label: '0–1 km storm-relative helicity', unit: 'm2s2', pal: 'srh', parts: { h: at('HLCY', '1000-0 m above ground') }, value: (p, i) => p.h[i] },
      { id: 'srh3', group: 'Wind shear', label: '0–3 km storm-relative helicity', unit: 'm2s2', pal: 'srh', parts: { h: at('HLCY', '3000-0 m above ground') }, value: (p, i) => p.h[i] },
      { id: 'esrh', group: 'Wind shear', label: 'Effective storm-relative helicity', unit: 'm2s2', pal: 'srh', parts: { h: at('EFHL', 'surface') }, value: (p, i) => p.h[i] },
      { id: 'motion', group: 'Wind shear', label: 'Storm motion (Bunkers right-mover)', unit: 'kt', pal: 'shear1', parts: { u: at('USTM', '0-6000 m above ground'), v: at('VSTM', '0-6000 m above ground') }, value: (p, i) => Math.hypot(p.u[i], p.v[i]) * MS2KT, barbs: ['u', 'v'] },
      { id: 'cangle', group: 'Wind shear', label: 'Critical angle (0–500 m)', unit: 'deg', pal: 'angle', parts: { a: at('CANGLE', '0-500 m above ground') }, value: (p, i) => p.a[i] },
      /* Thompson et al. (2012), every term clipped as SPC clips it (sounding.js) */
      { id: 'stpe', group: 'Composites', label: 'Significant tornado parameter (effective layer)', unit: 'index', pal: 'stp',
        parts: { ...ebwdParts, ml: at('CAPE', '90-0 mb above ground'), mlcin: at('CIN', '90-0 mb above ground'), lcl: at('HGT', 'level of adiabatic condensation from sfc'), h: at('EFHL', 'surface') },
        value: (p, i) => {
          if (!(p.sb[i] >= 100 && p.sbcin[i] >= -250)) return 0;                      // the effective layer starts above the ground
          return SND.stpEffective(p.ml[i], p.lcl[i] - p.zs[i], p.mlcin[i], p.h[i], ebwdAt(p, i), 0) || 0;
        } },
      /* SPC's supercell composite with its most-unstable CIN term (Gropp and
         Davenport 2018): × −40 / MUCIN where MUCIN is below −40 J/kg */
      { id: 'scpe', group: 'Composites', label: 'Supercell composite (effective layer)', unit: 'index', pal: 'scp',
        parts: { ...ebwdParts, mucin: at('CIN', '255-0 mb above ground'), h: at('EFHL', 'surface') },
        value: (p, i) => { const v = SND.scp(p.mu[i], p.h[i], ebwdAt(p, i)) || 0, c = p.mucin[i]; return Math.max(0, c < -40 ? v * -40 / c : v); } },
      { id: 'ship', group: 'Composites', label: 'Significant hail parameter', unit: 'index', pal: 'ship', parts: shipParts, value: shipAt },
      { id: 'ehi1', group: 'Composites', label: 'Energy-helicity index, 0–1 km', unit: 'index', pal: 'ehi', parts: { c: at('CAPE', 'surface'), h: at('HLCY', '1000-0 m above ground') }, value: (p, i) => Math.max(0, p.c[i] * p.h[i] / 160000) }
    ];
  }

  /* ── ECMWF's fields ── `ec(param, level)` over its own index: a pressure
     level is "500 mb", the surface "sfc" */
  function ec(param, level) { return (e) => e.name === param && e.level === (level ? level + ' mb' : 'sfc'); }
  function EC_FIELDS(ifs) {
    const out = [
      ifs ? { id: 'h500', group: 'Upper air', label: '500 mb heights and vorticity', unit: 'vort', pal: 'vort', parts: { z: ec('gh', 500), a: ec('vo', 500) },
        value: (p, i) => p.a[i] * 1e5, contours: [{ part: 'z', scale: 0.1, every: 6, unit: 'dam', color: '#ffffff' }] }
        : { id: 'h500', group: 'Upper air', label: '500 mb heights and wind', unit: 'kt', pal: 'jet', parts: { z: ec('gh', 500), u: ec('u', 500), v: ec('v', 500) },
          value: (p, i) => Math.hypot(p.u[i], p.v[i]) * MS2KT, contours: [{ part: 'z', scale: 0.1, every: 6, unit: 'dam', color: '#ffffff' }] },
      { id: 'jet250', group: 'Upper air', label: '250 mb wind (the jet)', unit: 'kt', pal: 'jet', parts: { u: ec('u', 250), v: ec('v', 250), z: ec('gh', 250) },
        value: (p, i) => Math.hypot(p.u[i], p.v[i]) * MS2KT, barbs: ['u', 'v'], contours: [{ part: 'z', scale: 0.1, every: 12, unit: 'dam', color: '#d0d4da' }] },
      { id: 't850', group: 'Upper air', label: '850 mb temperature and heights', unit: 'tempC', pal: 't850', parts: { t: ec('t', 850), z: ec('gh', 850) },
        value: (p, i) => p.t[i] - 273.15, contours: [{ part: 'z', scale: 0.1, every: 3, unit: 'dam', color: '#ffffff' }] },
      { id: 'mslp', group: 'Surface', label: 'Pressure (MSLP) and 1000–500 mb thickness', unit: 'dam', pal: 'thick', parts: { p: ec('msl'), z5: ec('gh', 500), z1: ec('gh', 1000) },
        value: (p, i) => (p.z5[i] - p.z1[i]) / 10, contours: [{ part: 'p', scale: 0.01, every: 4, unit: 'hpa', color: '#ffffff' }] },
      { id: 't2m', group: 'Surface', label: 'Temperature', unit: 'temp', pal: 'temp', parts: { t: ec('2t') }, value: (p, i) => K2F(p.t[i]) },
      { id: 'td2m', group: 'Surface', label: 'Dew point', unit: 'temp', pal: 'dew', parts: { t: ec('2d') }, value: (p, i) => K2F(p.t[i]) },
      { id: 'wind10', group: 'Surface', label: 'Wind (10 m) and barbs', unit: 'mph', pal: 'wind', parts: { u: ec('10u'), v: ec('10v') }, value: (p, i) => Math.hypot(p.u[i], p.v[i]) * MS2MPH, barbs: ['u', 'v'] },
      /* the IFS gives cloud as a fraction and rain and snow as metres of
         water since the run began; AIFS gives per cent and millimetres
         (kg/m²) — checked against each file's values, 2026-10-22 */
      { id: 'cloud', group: 'Surface', label: 'Cloud cover', unit: 'pct', pal: 'cloud', parts: { c: ec('tcc') }, value: ifs ? (p, i) => p.c[i] * 100 : (p, i) => p.c[i] },
      { id: 'qpf', group: 'Rain and snow', label: 'Total rain since the run', unit: 'precip', pal: 'precip', parts: { a: ec('tp') }, value: (p, i) => p.a[i] * (ifs ? 1000 : 1) / 25.4 },
      { id: 'snow', group: 'Rain and snow', label: 'Total snow since the run (10:1)', unit: 'snow', pal: 'snow', parts: { s: ec('sf') }, value: (p, i) => p.s[i] * (ifs ? 1000 : 1) / 25.4 * 10 },
      ifs ? { id: 'pwat', group: 'Rain and snow', label: 'Precipitable water', unit: 'precip', pal: 'pwat', parts: { w: ec('tcwv') }, value: (p, i) => p.w[i] / 25.4 }
        : { id: 'pwat', group: 'Rain and snow', label: 'Total column water (vapour, cloud and rain)', unit: 'precip', pal: 'pwat', parts: { w: ec('tcw') }, value: (p, i) => p.w[i] / 25.4 }
    ];
    if (ifs) out.push(
      { id: 'gust', group: 'Surface', label: 'Wind gusts (the strongest since the step before)', unit: 'mph', pal: 'wind', parts: { g: ec('10fg') }, value: (p, i) => p.g[i] * MS2MPH },
      { id: 'cape', group: 'Surface', label: 'Most-unstable CAPE', unit: 'jkg', pal: 'cape', parts: { c: ec('mucape') }, value: (p, i) => p.c[i] });
    return out;
  }

  /* ── GEFS: the ensemble's mean and spread (NOAA's own files), every
     member's 500 mb line (spaghetti), and the share of members with an
     event (a probability). A part names its file: `avg`, `spr`, or each
     member in turn. ── */
  function GEFS_FIELDS() {
    const avg = (test) => ({ test, member: 'geavg' }), spr = (test) => ({ test, member: 'gespr' });
    const rain6 = (e) => e.name === 'APCP' && e.level === 'surface' && /^(\d+)-(\d+) hour acc/.test(e.fcst) && (+e.fcst.split('-')[1].split(' ')[0]) - (+e.fcst.split('-')[0]) === 6;
    return [
      { id: 'h500', group: 'Mean and spread', label: '500 mb heights (mean) and how far the runs disagree', unit: 'gpm', pal: 'spread',
        parts: { z: avg(at('HGT', '500 mb')), s: spr(at('HGT', '500 mb')) }, value: (p, i) => p.s[i], contours: [{ part: 'z', scale: 0.1, every: 6, unit: 'dam', color: '#ffffff' }] },
      { id: 'mslp', group: 'Mean and spread', label: 'Pressure (mean) and how far the runs disagree', unit: 'hpa', pal: 'spreadp',
        parts: { p: avg(at('PRMSL', 'mean sea level')), s: spr(at('PRMSL', 'mean sea level')) }, value: (p, i) => p.s[i] / 100, contours: [{ part: 'p', scale: 0.01, every: 4, unit: 'hpa', color: '#ffffff' }] },
      { id: 't2m', group: 'Mean and spread', label: 'Temperature (mean)', unit: 'temp', pal: 'temp', parts: { t: avg(at('TMP', '2 m above ground')) }, value: (p, i) => K2F(p.t[i]) },
      { id: 'qpf', group: 'Mean and spread', label: 'Rain in the 6 hours to now (mean)', unit: 'precip', pal: 'precip', parts: { a: avg(rain6) }, value: (p, i) => p.a[i] / 25.4 },
      /* each run's 552 or 576 dam line over the spread: where the lines
         bunch, the runs agree; where they fan out, nobody knows */
      { id: 'spag552', group: 'Spaghetti', label: '500 mb, every run\'s 552 dam line', unit: 'gpm', pal: 'spread', spaghetti: { test: at('HGT', '500 mb'), level: 5520 },
        parts: { s: spr(at('HGT', '500 mb')) }, value: (p, i) => p.s[i] },
      { id: 'spag576', group: 'Spaghetti', label: '500 mb, every run\'s 576 dam line', unit: 'gpm', pal: 'spread', spaghetti: { test: at('HGT', '500 mb'), level: 5760 },
        parts: { s: spr(at('HGT', '500 mb')) }, value: (p, i) => p.s[i] },
      { id: 'p_rain25', group: 'Chance (share of the 31 runs)', label: '¼ inch of rain in 6 hours', unit: 'pct', pal: 'prob', members: [rain6], event: (v) => v[0] >= 6.35 },
      { id: 'p_rain1', group: 'Chance (share of the 31 runs)', label: '1 inch of rain in 6 hours', unit: 'pct', pal: 'prob', members: [rain6], event: (v) => v[0] >= 25.4 },
      { id: 'p_frz', group: 'Chance (share of the 31 runs)', label: 'At or below freezing (2 m)', unit: 'pct', pal: 'prob', members: [at('TMP', '2 m above ground')], event: (v) => v[0] <= 273.15 },
      { id: 'p_wind', group: 'Chance (share of the 31 runs)', label: 'A 39 mph wind (10 m)', unit: 'pct', pal: 'prob', members: [at('UGRD', '10 m above ground'), at('VGRD', '10 m above ground')], event: (v) => Math.hypot(v[0], v[1]) >= 17.43 }
    ];
  }

  /* ── the server's mesoanalysis (mesogrid.js files from the Worker) ── */
  const serverIndex = { at: 0, hours: [] }, serverFiles = new Map();
  async function gunzip(bytes) {
    if (typeof DecompressionStream === 'function') return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    return new Uint8Array(require('zlib').gunzipSync(bytes));
  }
  const pad10 = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}`; };
  function serverFile(src, valid, { signal, fetchFn = fetch } = {}) {
    if (!serverFiles.has(valid)) {
      serverFiles.set(valid, (async () => {
        const r = await fetchFn(`${SOURCES[src].base()}/${pad10(valid)}`, { signal });
        if (!r.ok) throw new Error('models: the mesoanalysis for this hour is not on the server (HTTP ' + r.status + ')');
        return MG.decode(await gunzip(new Uint8Array(await r.arrayBuffer())));
      })().catch((e) => { serverFiles.delete(valid); throw e; }));
      if (serverFiles.size > 8) serverFiles.delete(serverFiles.keys().next().value);
    }
    return serverFiles.get(valid);
  }
  /* one field of one hour, shaped like any other model layer: knots → m/s
     for the barbs (the painter's unit), the contours drawn from the file's
     own arrays */
  async function loadServer(src, valid, f, opts) {
    const { head, arrays } = await serverFile(src, valid, opts);
    const grid = { ...head.grid }, F = f.server;
    const out = { field: f, grid, values: arrays[f.id], run: valid, fh: 0, valid: head.valid, made: head.made, inputs: head.inputs };
    if (F.contour === 'mslp') out.contours = [{ part: 'mslp', every: 4, scale: 1, unit: 'hpa', color: '#ffffff', lines: contours(grid, arrays.mslp, { every: 4, step: 1 }) }];
    if (F.contour === 'mlcin') out.contours = [{ part: 'mlcin', every: 50, scale: 1, unit: 'jkgneg', color: '#8fc4ff', lines: contours(grid, arrays.mlcin, { every: 50, step: 1 }) }];
    if (F.barbs) {
      const b = F.barbs === true ? ['u10', 'v10'] : [F.barbs + 'u', F.barbs + 'v'];
      /* a shear or motion barb under 5 kt says nothing — where there is no
         effective layer there is no effective shear to draw — so none is drawn */
      const calm = F.barbs !== true;
      const U = arrays[b[0]], V = arrays[b[1]], u = new Float32Array(U.length), v = new Float32Array(V.length);
      for (let i = 0; i < U.length; i++) {
        const keep = !calm || Math.hypot(U[i], V[i]) >= 5;
        u[i] = keep ? U[i] / 1.943844 : NaN; v[i] = keep ? V[i] / 1.943844 : NaN;
      }
      out.wind = { u, v };
    }
    return out;
  }

  /* the analysis hours a source has: the newest `count` runs whose hour 0 is
     out, or for the server's mesoanalysis, the hours the Worker holds */
  async function analyses(src, { count, nowMs = Date.now(), signal, fetchFn = fetch } = {}) {
    const S = SOURCES[src], n = count || S.frames || 6, h = 3600e3, out = [];
    if (S.server) {
      const r = await fetchFn(`${S.base()}/index`, { signal });
      if (!r.ok) throw new Error('models: the mesoanalysis server answered ' + r.status);
      const j = await r.json();
      serverIndex.at = nowMs; serverIndex.hours = (j.hours || []).filter((x) => Number.isFinite(x.valid)).sort((a, b) => a.valid - b.valid);
      /* the hours up to `nowMs` — a replay's moment asks for its own, not the newest */
      return serverIndex.hours.filter((x) => x.valid <= nowMs).slice(-n).map((x) => x.valid);
    }
    const first = Math.floor(nowMs / h) * h;
    const tries = [];
    for (let k = 0; k < n + 3; k++) tries.push(first - k * h);
    const got = await Promise.all(tries.map((run) => idxFor(src, run, 0, { signal, fetchFn }).then(() => run, () => null)));
    for (const run of got) if (run && out.length < n) out.push(run);
    return out.sort((a, b) => a - b);
  }

  /* which .idx entry each part of a field is (the first that matches) */
  function resolve(idx, f) {
    const out = {};
    for (const [k, spec] of Object.entries(f.parts)) {
      const e = idx.find(typeof spec === 'function' ? spec : spec.test);
      if (!e) return null;
      out[k] = e;
    }
    return out;
  }

  /* ── colour ── one RGBA word per step of a 1024-step table over the
     palette's range (log-spaced for rain and snow) */
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function rgbAt(stops, v) {
    if (v <= stops[0][0]) return hex(stops[0][1]);
    for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (v - a) / (b - a || 1), A = hex(ca), B = hex(cb);
      return [0, 1, 2].map((k) => Math.round(A[k] + (B[k] - A[k]) * t));
    }
    return hex(stops[stops.length - 1][1]);
  }
  function table(palName, alpha = 255) {
    const P = PAL[palName];
    if (P.cat) {
      /* 4 types × 81 echo steps */
      const t = new Uint32Array(500);
      for (const [k, [, lo, hi]] of Object.entries(P.types)) for (let r = 0; r <= 75; r++) {
        const c = rgbAt([[5, lo], [75, hi]], r);
        t[k * 100 + r] = ((alpha << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
      }
      return { lookup: (v) => (Number.isFinite(v) ? t[Math.round(v)] || 0 : 0) };
    }
    const s = P.stops, lo = s[0][0], hi = s[s.length - 1][0], N = 1024, t = new Uint32Array(N);
    const fwd = P.log ? (v) => Math.log(Math.max(v, lo)) : (v) => v, inv = P.log ? Math.exp : (v) => v;
    const a = fwd(lo), b = fwd(hi);
    for (let i = 0; i < N; i++) {
      const v = inv(a + (b - a) * i / (N - 1)), c = rgbAt(s, v);
      t[i] = ((alpha << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
    }
    return {
      lookup(v) {
        if (!Number.isFinite(v) || (P.floor != null && v < P.floor) || (P.ceil != null && v > P.ceil)) return 0;
        const k = Math.round((fwd(Math.min(hi, Math.max(lo, v))) - a) / (b - a) * (N - 1));
        return t[k];
      }
    };
  }

  /* ── contours: marching squares over the grid (every `step`th point),
     returned as segments in lat/lon with their level ── */
  function contours(grid, values, { every, scale = 1, step = 2 }) {
    const g = G.projector(grid), nx = grid.nx, ny = grid.ny;
    const out = { levels: [], segs: [] };
    const val = (i, j) => values[j * nx + i] * scale;
    const edge = (i0, j0, v0, i1, j1, v1, lev) => { const t = (lev - v0) / (v1 - v0); return [i0 + (i1 - i0) * t, j0 + (j1 - j0) * t]; };
    for (let j = 0; j + step < ny; j += step) for (let i = 0; i + step < nx; i += step) {
      const a = val(i, j), b = val(i + step, j), c = val(i + step, j + step), d = val(i, j + step);
      if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d))) continue;
      const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
      for (let lev = Math.ceil(lo / every) * every; lev <= hi; lev += every) {
        const pts = [];
        if ((a < lev) !== (b < lev)) pts.push(edge(i, j, a, i + step, j, b, lev));
        if ((b < lev) !== (c < lev)) pts.push(edge(i + step, j, b, i + step, j + step, c, lev));
        if ((c < lev) !== (d < lev)) pts.push(edge(i + step, j + step, c, i, j + step, d, lev));
        if ((d < lev) !== (a < lev)) pts.push(edge(i, j + step, d, i, j, a, lev));
        for (let k = 0; k + 1 < pts.length; k += 2) {
          const p = g.ll(pts[k][0], pts[k][1]), q = g.ll(pts[k + 1][0], pts[k + 1][1]);
          out.segs.push(p[0], p[1], q[0], q[1]); out.levels.push(lev);
        }
      }
    }
    out.segs = Float32Array.from(out.segs);
    return out;
  }

  /* HRRR's winds are relative to its grid, not to north (section 3's
     resolution and component flags say so); turn them to the earth. NCEP's
     rotation for a Lambert grid: α = n·(λ − λ₀). */
  const rotProj = new WeakMap();
  function earthWind(grid, lat, lon, u, v) {
    if (grid.uvGrid && grid.kind === 'rotll') {
      /* the RAP's rotated grid: turn by the bearing of the grid's +i
         direction at the point, as meso/build.mjs does */
      if (!rotProj.has(grid)) rotProj.set(grid, G.projector(grid));
      const g = rotProj.get(grid), [fi, fj] = g.ij(lat, lon), [la, lo] = g.ll(fi, fj), [lb, lob] = g.ll(fi + 0.5, fj), r = Math.PI / 180;
      const y = Math.sin((lob - lo) * r) * Math.cos(lb * r), x = Math.cos(la * r) * Math.sin(lb * r) - Math.sin(la * r) * Math.cos(lb * r) * Math.cos((lob - lo) * r);
      const beta = Math.atan2(y, x), sb = Math.sin(beta), cb = Math.cos(beta);
      return [u * sb - v * cb, u * cb + v * sb];
    }
    if (!grid.uvGrid || grid.kind !== 'lambert') return [u, v];
    const rad = Math.PI / 180, p1 = grid.latin1 * rad, p2 = grid.latin2 * rad;
    const n = Math.abs(p1 - p2) < 1e-9 ? Math.sin(p1)
      : Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
    const a = n * ((((lon - grid.lov) % 360) + 540) % 360 - 180) * rad, c = Math.cos(a), s = Math.sin(a);
    return [c * u + s * v, -s * u + c * v];
  }

  /* ── the bucket ──
     A busy bucket answers 503 "Slow Down" (or, without its CORS header,
     fails outright in a browser): every request here is tried again after a
     pause, up to four times, and a bucket with a mirror alternates with it. */
  const MIRRORS = { 'https://storage.googleapis.com/ecmwf-open-data': 'https://ecmwf-forecasts.s3.eu-central-1.amazonaws.com' };
  const retrying = (fetchFn) => async (url, opts) => {
    const base = Object.keys(MIRRORS).find((b) => url.startsWith(b));
    for (let k = 0; ; k++) {
      const u = base && k % 2 === 1 ? MIRRORS[base] + url.slice(base.length) : url;
      try {
        const r = await fetchFn(u, opts);
        if ((r.status !== 503 && r.status !== 429) || k >= 4) return r;
      } catch (e) {
        if (k >= 4 || (opts && opts.signal && opts.signal.aborted)) throw e;
      }
      await new Promise((ok) => setTimeout(ok, 400 * 2 ** k));
    }
  };
  /* ECMWF's .index: one JSON object per line, each field's offset and length */
  function parseJsonIndex(text) {
    return String(text).split('\n').filter(Boolean).map((l) => {
      const j = JSON.parse(l);
      return { start: j._offset, end: j._offset + j._length - 1, name: j.param, level: j.levtype === 'pl' ? `${j.levelist} mb` : j.levtype, fcst: j.step, line: `${j.param}:${j.levtype}:${j.levelist || ''}` };
    });
  }
  const idxCache = new Map();
  async function listKeys(bucket, prefix, { signal, fetchFn = fetch } = {}) {
    fetchFn = retrying(fetchFn);
    const keys = [];
    let token = '';
    for (let guard = 0; guard < 5; guard++) {
      const q = new URLSearchParams({ 'list-type': '2', prefix });
      if (token) q.set('continuation-token', token);
      const r = await fetchFn(`${bucket}/?${q}`, { signal });
      if (!r.ok) throw new Error('models: listing HTTP ' + r.status);
      const xml = await r.text(), re = /<Key>([^<]+)<\/Key>/g;
      let m;
      while ((m = re.exec(xml))) keys.push(m[1]);
      const t = /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml);
      if (!t) break;
      token = t[1];
    }
    return keys;
  }
  /* the forecast hours a run has published so far (its .idx files) */
  function hoursIn(keys, prefix) {
    return [...new Set(keys.filter((k) => k.startsWith(prefix) && (k.endsWith('.idx') || k.endsWith('.index')))
      .map((k) => parseInt(k.slice(prefix.length), 10)).filter(Number.isFinite))].sort((a, b) => a - b);
  }
  /* the newest run with enough of itself out; { run, hours } */
  async function latestRun(src, { nowMs = Date.now(), signal, fetchFn = fetch } = {}) {
    const S = SOURCES[src], c = S.cycle * 3600e3;
    let first = Math.floor(nowMs / c) * c;
    for (let k = 0; k < S.lookBack; k++, first -= c) {
      const prefix = S.prefix(first);
      const hours = hoursIn(await listKeys(S.bucket, prefix, { signal, fetchFn }), prefix);
      if (hours.length >= S.minHours) return { run: first, hours: S.hours(hours, first), complete: false };
    }
    return null;
  }
  const fileUrl = (src, run, fh, member) => `${SOURCES[src].bucket}/${SOURCES[src].file(run, fh, member)}`;
  async function idxFor(src, run, fh, { signal, fetchFn = fetch, member } = {}) {
    const S = SOURCES[src], json = S.index === 'json';
    const url = json ? fileUrl(src, run, fh, member).replace(/\.grib2$/, '.index') : `${fileUrl(src, run, fh, member)}.idx`;
    if (!idxCache.has(url)) {
      idxCache.set(url, (async () => {
        const r = await retrying(fetchFn)(url, { signal });
        if (!r.ok) throw new Error('models: index HTTP ' + r.status);
        const text = await r.text();
        return json ? parseJsonIndex(text) : G.parseIdx(text);
      })().catch((e) => { idxCache.delete(url); throw e; }));
      if (idxCache.size > 300) idxCache.delete(idxCache.keys().next().value);
    }
    return idxCache.get(url);
  }
  /* One field at one hour: its grid, its values in the canonical unit, its
     contours and its wind (for barbs), and when it is valid. */
  async function load(src, run, fh, id, { signal, fetchFn = fetch } = {}) {
    const f = field(src, id);
    if (!f) throw new Error('models: no field ' + id);
    if (src === 'tle') return loadTLE(f, run + fh * 3600e3, run, fh, { signal, fetchFn });
    if (SOURCES[src].server) return loadServer(src, run, f, { signal, fetchFn });
    if (f.members) return loadEnsemble(src, f, run, fh, { signal, fetchFn });
    fetchFn = retrying(fetchFn);
    /* each part from its own file (a GEFS field's mean and spread are two) */
    const msgs = {};
    await Promise.all(Object.entries(f.parts).map(async ([k, spec]) => {
      const member = typeof spec === 'function' ? undefined : spec.member, test = typeof spec === 'function' ? spec : spec.test;
      const e = (await idxFor(src, run, fh, { signal, fetchFn, member })).find(test);
      if (!e) throw new Error(`models: ${SOURCES[src].label} +${fh} h has no ${f.label}`);
      msgs[k] = await message(fileUrl(src, run, fh, member), e, { signal, fetchFn });
    }));
    const out = build(f, msgs, run, fh);
    if (f.spaghetti) out.contours = (out.contours || []).concat(await spaghetti(src, f, run, fh, { signal, fetchFn }));
    return out;
  }
  /* the messages of one file, kept a while: the mesoanalysis's composites
     share twenty-odd of them, and stepping between its fields should not
     fetch them again. A 3 km HRRR field is 7.6 MB of numbers; 28 is the cap. */
  const msgCache = new Map();
  function message(url, e, opts) {
    const key = `${url}|${e.start}|${e.sub || 1}`;
    if (!msgCache.has(key)) {
      msgCache.set(key, G.fetchMessage(url, e, opts).catch((err) => { msgCache.delete(key); throw err; }));
      if (msgCache.size > 28) msgCache.delete(msgCache.keys().next().value);
    }
    return msgCache.get(key);
  }
  function build(f, msgs, run, fh) {
    const first = Object.values(msgs)[0], grid = first.grid, n = grid.npts;
    const p = {};
    for (const [k, m] of Object.entries(msgs)) p[k] = m.values;
    let values;
    if (f.compute) values = f.compute(p, grid);
    else {
      values = new Float32Array(n);
      for (let i = 0; i < n; i++) values[i] = f.value(p, i);
    }
    const out = { field: f, grid, values, run, fh, valid: first.validTime || run + fh * 3600e3 };
    /* `smooth` (grid points) takes the 3 km speckle out before contouring */
    if (f.contours) out.contours = f.contours.map((c) => ({ ...c, lines: contours(grid, c.smooth ? smooth(p[c.part], grid.nx, grid.ny, c.smooth) : p[c.part], { every: c.every, scale: c.scale, step: grid.kind === 'lambert' ? 6 : 2 }) }));
    if (f.barbs) out.wind = { u: p[f.barbs[0]], v: p[f.barbs[1]] };
    return out;
  }
  /* ── the time-lagged ensemble ──
     For the hour asked, the newest run and the five before it, each at the
     forecast hour that lands there; each member's event (the field past its
     threshold) widened to everything within 40 km; the probability is the
     share of members that have it. An extended run (00/06/12/18Z) reaches 48
     hours, the others 18 — a member that does not reach is left out, and
     fewer than three is no answer. */
  function within(mask, nx, ny, k) {
    /* a square neighbourhood, by two passes of running counts */
    const tmp = new Uint8Array(nx * ny), out = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      let c = 0;
      const row = j * nx;
      for (let i = 0; i < Math.min(k, nx); i++) c += mask[row + i];
      for (let i = 0; i < nx; i++) {
        if (i + k < nx) c += mask[row + i + k];
        if (i - k - 1 >= 0) c -= mask[row + i - k - 1];
        tmp[row + i] = c > 0 ? 1 : 0;
      }
    }
    for (let i = 0; i < nx; i++) {
      let c = 0;
      for (let j = 0; j < Math.min(k, ny); j++) c += tmp[j * nx + i];
      for (let j = 0; j < ny; j++) {
        if (j + k < ny) c += tmp[(j + k) * nx + i];
        if (j - k - 1 >= 0) c -= tmp[(j - k - 1) * nx + i];
        out[j * nx + i] = c > 0 ? 1 : 0;
      }
    }
    return out;
  }
  /* a mean over a square, by two passes of running sums */
  function smooth(v, nx, ny, r) {
    const tmp = new Float32Array(nx * ny), out = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      const row = j * nx;
      let s = 0, c = 0;
      for (let i = 0; i < Math.min(r, nx); i++) { s += v[row + i]; c++; }
      for (let i = 0; i < nx; i++) {
        if (i + r < nx) { s += v[row + i + r]; c++; }
        if (i - r - 1 >= 0) { s -= v[row + i - r - 1]; c--; }
        tmp[row + i] = s / c;
      }
    }
    for (let i = 0; i < nx; i++) {
      let s = 0, c = 0;
      for (let j = 0; j < Math.min(r, ny); j++) { s += tmp[j * nx + i]; c++; }
      for (let j = 0; j < ny; j++) {
        if (j + r < ny) { s += tmp[(j + r) * nx + i]; c++; }
        if (j - r - 1 >= 0) { s -= tmp[(j - r - 1) * nx + i]; c--; }
        out[j * nx + i] = s / c;
      }
    }
    return out;
  }
  async function loadTLE(f, validMs, run0, fh0, { signal, fetchFn = fetch } = {}) {
    const S = SOURCES.tle, members = [];
    for (let k = 0; k < S.members; k++) {
      const run = run0 - k * 3600e3, fh = Math.round((validMs - run) / 3600e3), maxFh = new Date(run).getUTCHours() % 6 === 0 ? 48 : 18;
      if (fh < 1 || fh > maxFh) continue;
      members.push((async () => {
        try {
          const idx = await idxFor('tle', run, fh, { signal, fetchFn });
          const e = idx.find(f.member);
          if (!e) return null;
          return await G.fetchMessage(`${S.bucket}/${S.file(run, fh)}`, e, { signal, fetchFn });
        } catch (err) { if (signal && signal.aborted) throw err; return null; }
      })());
    }
    const got = (await Promise.all(members)).filter(Boolean);
    if (got.length < 3) throw new Error(`models: only ${got.length} HRRR runs reach this hour — too few for a probability`);
    const grid = got[0].grid, n = grid.npts, k = Math.max(1, Math.round(S.radiusKm / (grid.dx / 1000))), sum = new Uint8Array(n);
    for (const m of got) {
      const mask = new Uint8Array(n);
      for (let i = 0; i < n; i++) mask[i] = f.event(m.values[i]) ? 1 : 0;
      const w = within(mask, grid.nx, grid.ny, k);
      for (let i = 0; i < n; i++) sum[i] += w[i];
    }
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) raw[i] = sum[i] * 100 / got.length;
    /* smoothed over half the neighbourhood, as SPC smooths its ensemble
       probabilities — a square's corners are not information */
    const values = smooth(raw, grid.nx, grid.ny, Math.max(1, Math.round(k / 2)));
    return { field: { ...f, label: `${f.label} — ${got.length} runs` }, grid, values, run: run0, fh: fh0, valid: validMs, members: got.length };
  }

  /* ── the ensemble's members ── each member's field (or fields) at the
     hour; for a probability the share with the event, for spaghetti each
     member's one line. A member that does not answer is left out, and the
     label says how many were counted. */
  async function memberFields(src, tests, run, fh, { signal, fetchFn }) {
    const S = SOURCES[src];
    const got = await Promise.all(S.members.map(async (m) => {
      try {
        const idx = await idxFor(src, run, fh, { signal, fetchFn, member: m });
        const es = tests.map((t) => idx.find(t));
        if (es.some((e) => !e)) return null;
        /* not kept in the message cache: 31 members would push everything else out */
        return await Promise.all(es.map((e) => G.fetchMessage(fileUrl(src, run, fh, m), e, { signal, fetchFn })));
      } catch (err) { if (signal && signal.aborted) throw err; return null; }
    }));
    return got.filter(Boolean);
  }
  async function loadEnsemble(src, f, run, fh, { signal, fetchFn = fetch } = {}) {
    fetchFn = retrying(fetchFn);
    const got = await memberFields(src, f.members, run, fh, { signal, fetchFn });
    if (got.length < 10) throw new Error(`models: only ${got.length} of the ensemble's runs answered — too few for a probability`);
    const grid = got[0][0].grid, n = grid.npts, values = new Float32Array(n), v = new Array(f.members.length);
    for (let i = 0; i < n; i++) {
      let c = 0;
      for (const m of got) { for (let k = 0; k < m.length; k++) v[k] = m[k].values[i]; if (f.event(v)) c++; }
      values[i] = c * 100 / got.length;
    }
    return { field: { ...f, label: `${f.label} — ${got.length} runs` }, grid, values, run, fh, valid: got[0][0].validTime || run + fh * 3600e3, members: got.length };
  }
  /* every member's line at one level, each its own colour round the wheel */
  async function spaghetti(src, f, run, fh, opts) {
    const got = await memberFields(src, [f.spaghetti.test], run, fh, opts);
    return got.map(([m], k) => {
      const hue = Math.round(k * 360 / got.length);
      return { part: null, every: f.spaghetti.level, unit: 'dam', color: `hsl(${hue},85%,62%)`, nolabel: true, width: 1.2,
        lines: contours(m.grid, m.values, { every: f.spaghetti.level, step: 1 }) };
    });
  }

  /* the value (canonical) at a place */
  function valueAt(layer, lat, lon) {
    const g = G.projector(layer.grid), [fi, fj] = g.ij(lat, lon);
    const i = Math.round(fi), j = Math.round(fj);
    if (layer.field.nearest) return i >= 0 && j >= 0 && i < layer.grid.nx && j < layer.grid.ny ? layer.values[j * layer.grid.nx + i] : NaN;
    return G.sample({ grid: layer.grid, values: layer.values }, lat, lon);
  }

  const api = { SOURCES, FIELDS, PAL, UNIT, field, resolve, serverIndex, serverFile, say, table, rgbAt, contours, earthWind, listKeys, hoursIn, latestRun, analyses, idxFor, parseJsonIndex, load, build, valueAt, within, smooth, loadTLE, loadEnsemble };
  root.ModelMaps = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
