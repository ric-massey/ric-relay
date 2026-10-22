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
  const field = (src, id) => (FIELDS[src] || []).find((f) => f.id === id) || null;

  /* which .idx entry each part of a field is (the first that matches) */
  function resolve(idx, f) {
    const out = {};
    for (const [k, test] of Object.entries(f.parts)) {
      const e = idx.find(test);
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
  function earthWind(grid, lat, lon, u, v) {
    if (!grid.uvGrid || grid.kind !== 'lambert') return [u, v];
    const rad = Math.PI / 180, p1 = grid.latin1 * rad, p2 = grid.latin2 * rad;
    const n = Math.abs(p1 - p2) < 1e-9 ? Math.sin(p1)
      : Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
    const a = n * ((((lon - grid.lov) % 360) + 540) % 360 - 180) * rad, c = Math.cos(a), s = Math.sin(a);
    return [c * u + s * v, -s * u + c * v];
  }

  /* ── the bucket ── */
  const idxCache = new Map();
  async function listKeys(bucket, prefix, { signal, fetchFn = fetch } = {}) {
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
    return [...new Set(keys.filter((k) => k.startsWith(prefix) && k.endsWith('.idx'))
      .map((k) => parseInt(k.slice(prefix.length), 10)).filter(Number.isFinite))].sort((a, b) => a - b);
  }
  /* the newest run with enough of itself out; { run, hours } */
  async function latestRun(src, { nowMs = Date.now(), signal, fetchFn = fetch } = {}) {
    const S = SOURCES[src], c = S.cycle * 3600e3;
    let first = Math.floor(nowMs / c) * c;
    for (let k = 0; k < S.lookBack; k++, first -= c) {
      const prefix = S.prefix(first);
      const hours = hoursIn(await listKeys(S.bucket, prefix, { signal, fetchFn }), prefix);
      if (hours.length >= S.minHours) return { run: first, hours: S.hours(hours), complete: false };
    }
    return null;
  }
  async function idxFor(src, run, fh, { signal, fetchFn = fetch } = {}) {
    const url = `${SOURCES[src].bucket}/${SOURCES[src].file(run, fh)}.idx`;
    if (!idxCache.has(url)) {
      idxCache.set(url, (async () => {
        const r = await fetchFn(url, { signal });
        if (!r.ok) throw new Error('models: .idx HTTP ' + r.status);
        return G.parseIdx(await r.text());
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
    const idx = await idxFor(src, run, fh, { signal, fetchFn });
    const parts = resolve(idx, f);
    if (!parts) throw new Error(`models: ${SOURCES[src].label} +${fh} h has no ${f.label}`);
    const url = `${SOURCES[src].bucket}/${SOURCES[src].file(run, fh)}`;
    const msgs = {};
    await Promise.all(Object.entries(parts).map(async ([k, e]) => { msgs[k] = await G.fetchMessage(url, e, { signal, fetchFn }); }));
    return build(f, msgs, run, fh);
  }
  function build(f, msgs, run, fh) {
    const first = Object.values(msgs)[0], grid = first.grid, n = grid.npts;
    const p = {};
    for (const [k, m] of Object.entries(msgs)) p[k] = m.values;
    const values = new Float32Array(n);
    for (let i = 0; i < n; i++) values[i] = f.value(p, i);
    const out = { field: f, grid, values, run, fh, valid: first.validTime || run + fh * 3600e3 };
    if (f.contours) out.contours = f.contours.map((c) => ({ ...c, lines: contours(grid, p[c.part], { every: c.every, scale: c.scale, step: grid.kind === 'lambert' ? 6 : 2 }) }));
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

  /* the value (canonical) at a place */
  function valueAt(layer, lat, lon) {
    const g = G.projector(layer.grid), [fi, fj] = g.ij(lat, lon);
    const i = Math.round(fi), j = Math.round(fj);
    if (layer.field.nearest) return i >= 0 && j >= 0 && i < layer.grid.nx && j < layer.grid.ny ? layer.values[j * layer.grid.nx + i] : NaN;
    return G.sample({ grid: layer.grid, values: layer.values }, lat, lon);
  }

  const api = { SOURCES, FIELDS, PAL, UNIT, field, resolve, say, table, rgbAt, contours, earthWind, listKeys, hoursIn, latestRun, idxFor, load, build, valueAt, within, smooth, loadTLE };
  root.ModelMaps = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
