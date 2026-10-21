/* WX — the weather room's client
   ────────────────────────────────────────────────────────────────────────────
   Everything weather.html knows about the outside world comes through here:
   which provider answers which question, how each answer is turned into one
   internal shape, and the few rules that decide what the page is allowed to
   say (is it raining, how old is this, is it stale). The page draws; this
   decides. Pure functions are exported for Node too, and
   projects/weather/test/wx.test.mjs runs them with no network.

   ── who answers what (DESIGN.md §24) ──
     Open-Meteo        the numbers: now, every hour, ten days, and rain in
                       15-minute steps. Global, keyless, one consistent model
                       blend ("best match" — HRRR and GFS in the US).
     NWS api.weather.gov   the authority: the nearest real station's last
                       observation, the forecast office's own words, and the
                       official alerts. US only; anywhere else these are
                       simply absent and the page says so.
     IEM (Iowa State)  NEXRAD radar as map tiles, the US composite, every
                       five minutes for the last fifty.

   ── where requests go ──
   The Worker's /wx route first (worker/worker.mjs — allow-listed, cached), and
   straight to the provider if that fails, the way Studies does it. The Worker
   is a cache and a shield, not a dependency: until it is deployed with /wx
   every call quietly goes direct.

   ── location (hard rule 1) ──
   No place is ever written into this repo. A place comes from the visitor —
   their browser's location, or a search — and lives in their own
   localStorage. Coordinates are rounded to two decimals (about a kilometre)
   before they leave this file, so neither a provider nor the Worker is ever
   handed a doorstep. */
(function (root) {
  'use strict';

  const LIVE = 'https://training-log.rmbuster82.workers.dev';
  const OM = 'https://api.open-meteo.com/v1/forecast';
  const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
  const NWS = 'https://api.weather.gov';
  const IEM = 'https://mesonet.agron.iastate.edu';

  const host = () => {
    try {
      if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return location.origin;
    } catch (e) {}
    return LIVE;
  };

  /* ── location ── */
  const round2 = x => Math.round(Number(x) * 100) / 100;
  const validLat = x => Number.isFinite(x) && x >= -90 && x <= 90;
  const validLon = x => Number.isFinite(x) && x >= -180 && x <= 180;
  /* "35.96" not "35.960000001", and never "-0". */
  const coord = x => { const r = round2(x); return String(Object.is(r, -0) ? 0 : r); };

  /* ── the Open-Meteo request ──
     Always metric, converted on the page, so switching °F/°C never refetches
     and every visitor's request for a place is the same cache entry. A day of
     the past rides along for the pressure trend. */
  const OM_CURRENT = 'temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,is_day,precipitation,' +
    'weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m';
  const OM_HOURLY = 'temperature_2m,apparent_temperature,dew_point_2m,relative_humidity_2m,precipitation_probability,' +
    'precipitation,weather_code,cloud_cover,visibility,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day';
  const OM_DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,' +
    'wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset,uv_index_max';
  const OM_MINUTELY = 'precipitation,snowfall';

  function omParams(lat, lon) {
    return new URLSearchParams({
      latitude: coord(lat), longitude: coord(lon),
      current: OM_CURRENT, hourly: OM_HOURLY, daily: OM_DAILY, minutely_15: OM_MINUTELY,
      timezone: 'auto', timeformat: 'unixtime', forecast_days: '10', past_days: '1'
    });
  }

  /* Every request the page makes, as [path on the Worker, the same thing
     asked of the provider directly]. test/wx.test.mjs holds the Worker to
     accepting every one of these and asking upstream for the same URL. */
  const ROUTES = {
    forecast: (lat, lon) => [`om?lat=${coord(lat)}&lon=${coord(lon)}`, `${OM}?${omParams(lat, lon)}`],
    geocode: name => {
      const q = String(name).trim().slice(0, 80);
      return [`geo?name=${encodeURIComponent(q)}`,
        `${GEO}?${new URLSearchParams({ name: q, count: '6', language: 'en', format: 'json' })}`];
    },
    point: (lat, lon) => [`nws/points/${coord(lat)},${coord(lon)}`, `${NWS}/points/${coord(lat)},${coord(lon)}`],
    alerts: (lat, lon) => [`nws/alerts/active?point=${coord(lat)},${coord(lon)}`,
      `${NWS}/alerts/active?point=${coord(lat)},${coord(lon)}`],
    /* A URL the points answer handed back (forecast, stations, an
       observation). Only the shapes the Worker allows are followed. */
    nws: url => {
      const path = String(url).replace(/^https:\/\/api\.weather\.gov\//, '');
      if (!NWS_FOLLOW.some(re => re.test(path))) return null;
      return [`nws/${path}`, `${NWS}/${path}`];
    },
    radarMeta: () => ['radar', `${IEM}/data/gis/images/4326/USCOMP/n0q_0.json`],
    /* Every storm-based warning in the country right now — the page with no
       place in it (§8.3, §20). */
    national: () => [`nws/alerts/active?event=${encodeURIComponent(NATIONAL_EVENTS)}`,
      `${NWS}/alerts/active?event=${encodeURIComponent(NATIONAL_EVENTS)}`],
    /* A state's alerts, for "what is near me but not on me". */
    area: st => /^[A-Z]{2}$/.test(st) ? [`nws/alerts/active?area=${st}`, `${NWS}/alerts/active?area=${st}`] : null,

    /* ── the storm side (DESIGN.md §11–17) ── */
    /* radar sites near a point; `start` is the hour, so a cache can hold it */
    radarSites: (lat, lon, hourIso) => [`iem/sites?lat=${coord(lat)}&lon=${coord(lon)}&start=${hourIso}`,
      `${IEM}/json/radar.py?operation=available&lat=${coord(lat)}&lon=${coord(lon)}&start=${hourIso}`],
    /* one site's scans of one product over the last hour */
    scans: (site, prod, startIso, endIso) => SITE.test(site) && SITE_PRODUCTS[prod]
      ? [`iem/scans?radar=${site}&product=${prod}&start=${startIso}&end=${endIso}`,
        `${IEM}/json/radar.py?operation=list&radar=${site}&product=${prod}&start=${startIso}&end=${endIso}`] : null,
    /* SPC's convective outlook, one layer */
    spc: kind => SPC_KINDS.includes(kind)
      ? [`spc/${kind}`, `https://www.spc.noaa.gov/products/outlook/${kind}.nolyr.geojson`] : null,
    /* a model's whole column for the next two days, and the last twelve
       hours — so the latest weather balloon can be laid over the model's own
       hour for the same moment (§16) */
    column: (model, lat, lon) => MODELS[model] ? [`col?model=${model}&lat=${coord(lat)}&lon=${coord(lon)}`,
      `${OM}?${new URLSearchParams({ latitude: coord(lat), longitude: coord(lon), hourly: COLUMN_FIELDS, models: MODELS[model].om,
        forecast_hours: '48', past_hours: '12', wind_speed_unit: 'ms', timeformat: 'unixtime', timezone: 'auto' })}`] : null,
    /* when that model last ran */
    modelRun: model => MODELS[model] ? [`ommeta/${MODELS[model].meta}`, `https://api.open-meteo.com/data/${MODELS[model].meta}/static/meta.json`] : null,
    /* every model's hourly temperature, rain and wind for a week: how far
       apart they are is how sure the forecast is, and the scored blend is
       built from them */
    ensemble: (lat, lon) => [`ens?lat=${coord(lat)}&lon=${coord(lon)}`,
      `${OM}?${new URLSearchParams({ latitude: coord(lat), longitude: coord(lon), hourly: 'temperature_2m,precipitation,wind_speed_10m',
        models: ENSEMBLE.map(m => MODELS_OM[m]).join(','), forecast_days: '7', timezone: 'auto', timeformat: 'unixtime' })}`],
    /* the two big ensembles, every member, for a week (§17.2): GEFS (31 runs)
       and ECMWF ENS (51). ~150 KB, 18 KB as sent; asked only when opened */
    plumes: (lat, lon) => [`plume?lat=${coord(lat)}&lon=${coord(lon)}`,
      `https://ensemble-api.open-meteo.com/v1/ensemble?${new URLSearchParams({ latitude: coord(lat), longitude: coord(lon), hourly: 'temperature_2m,precipitation',
        models: 'gfs025,ecmwf_ifs025', forecast_days: '7', timezone: 'auto', timeformat: 'unixtime' })}`],
    /* the current temperature and sky at several saved places, one request */
    several: places => {
      const ps = places.slice(0, 12).filter(p => validLat(p.lat) && validLon(p.lon));
      if (!ps.length) return null;
      const la = ps.map(p => coord(p.lat)).join(','), lo = ps.map(p => coord(p.lon)).join(',');
      return [`now?lat=${la}&lon=${lo}`, `${OM}?${new URLSearchParams({ latitude: la, longitude: lo,
        current: 'temperature_2m,weather_code,is_day', daily: 'temperature_2m_max,temperature_2m_min', forecast_days: '1', timezone: 'auto', timeformat: 'unixtime' })}`];
    },
    /* weather balloons: where they go up, and one flight */
    raobSites: () => ['iem/raobsites', `${IEM}/geojson/network.py?network=RAOB`],
    raob: (station, ts) => /^[A-Z0-9]{3,5}$/.test(station) && /^\d{12}$/.test(ts)
      ? [`iem/raob?ts=${ts}&station=${station}`, `${IEM}/json/raob.py?ts=${ts}&station=${station}`] : null,
    /* one forecast office's airport (ASOS) stations as they read now — the
       map's station layer (§19.1). By office because the whole country is
       3 MB uncompressed and one office is about 25 KB. */
    stationObs: wfo => /^[A-Z]{3}$/.test(wfo)
      ? [`iem/obs?wfo=${wfo}`, `${IEM}/api/1/currents.geojson?networkclass=ASOS&wfo=${wfo}&minutes=90`] : null
  };
  const SITE = /^[A-Z]{3}$/;
  /* The single-site products IEM serves as tiles and lists scans for (probed
     2026-10-17: correlation coefficient, ZDR, KDP and echo tops are not). */
  const SITE_PRODUCTS = {
    N0B: { label: 'Reflectivity', long: 'Base reflectivity, super-resolution (dBZ)' },
    N0S: { label: 'Storm-relative velocity', long: 'Storm-relative radial velocity — green toward the radar, red away' }
  };
  const SPC_KINDS = ['day1otlk_cat', 'day1otlk_torn', 'day1otlk_wind', 'day1otlk_hail', 'day2otlk_cat', 'day3otlk_cat'];
  /* The models a sounding can come from. `om` is Open-Meteo's name for the
     forecast, `meta` its name for the run-time file. */
  const MODELS = {
    hrrr: { om: 'ncep_hrrr_conus', meta: 'ncep_hrrr_conus', label: 'HRRR', long: 'NOAA HRRR — 3 km, new run every hour, US only' },
    gfs: { om: 'gfs_global', meta: 'ncep_gfs025', label: 'GFS', long: 'NOAA GFS — global, new run every 6 hours' },
    ecmwf: { om: 'ecmwf_ifs025', meta: 'ecmwf_ifs025', label: 'ECMWF', long: 'ECMWF IFS — global, new run every 6 hours' },
    aifs: { om: 'ecmwf_aifs025_single', meta: 'ecmwf_aifs025_single', label: 'AIFS', long: "ECMWF AIFS — ECMWF's AI model, global" }
  };
  /* the models the blend and the scoreboard know, by Open-Meteo's names */
  const MODELS_OM = { best: 'best_match', nbm: 'ncep_nbm_conus', hrrr: 'ncep_hrrr_conus', gfs: 'gfs_global', ecmwf: 'ecmwf_ifs025', aifs: 'ecmwf_aifs025_single' };
  const MODEL_NAMES = { best: 'Open-Meteo best match', nbm: 'NWS National Blend', hrrr: 'HRRR', gfs: 'GFS', ecmwf: 'ECMWF', aifs: 'ECMWF AI (AIFS)', blend: "This page's blend", learn: "This page's learned forecast", pangu: 'Pangu AI (our own run)' };
  const ENSEMBLE = ['nbm', 'hrrr', 'gfs', 'ecmwf', 'aifs'];
  const COLUMN_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100];
  const COLUMN_FIELDS = COLUMN_LEVELS.flatMap(p => ['temperature', 'dew_point', 'relative_humidity', 'wind_speed', 'wind_direction', 'geopotential_height'].map(k => `${k}_${p}hPa`))
    .concat(['surface_pressure', 'temperature_2m', 'dew_point_2m', 'wind_speed_10m', 'wind_direction_10m', 'cape']).join(',');
  const NATIONAL_EVENTS = 'Tornado Warning,Severe Thunderstorm Warning,Flash Flood Warning,Extreme Wind Warning,Tornado Watch,Severe Thunderstorm Watch';
  const NWS_FOLLOW = [
    /^gridpoints\/[A-Z]{3}\/\d{1,3},\d{1,3}\/(forecast|forecast\/hourly|stations)$/,
    /^stations\/[A-Z0-9]{3,6}\/observations\/latest$/
  ];

  /* ── fetching ── */
  class WxError extends Error {
    constructor(message, status) { super(message); this.status = status || 0; }
  }

  /* One request with its own deadline, still cancelled by the page's signal
     when the place changes (§29.5: work nobody wants is not finished). */
  async function fetchJSON(url, signal, ms = 12000) {
    const ctl = new AbortController();
    const stop = () => ctl.abort();
    if (signal) { if (signal.aborted) stop(); else signal.addEventListener('abort', stop, { once: true }); }
    const timer = setTimeout(stop, ms);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new WxError('HTTP ' + r.status, r.status);
      return await r.json();
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', stop);
    }
  }

  /* Worker, then direct. A 404 from the provider itself is an answer (NWS
     says that about every point outside the US), so it is not retried. */
  async function ask(route, signal, ms = 12000) {
    if (!route) throw new WxError('not a request this page makes', 400);
    const [path, direct] = route;
    try {
      return { data: await fetchJSON(host() + '/wx/' + path, signal, ms), via: 'worker' };
    } catch (e) {
      if (signal && signal.aborted) throw e;
    }
    /* Providers stumble for seconds at a time: the NWS answered 500 on its
       station lists in one live run, and Open-Meteo timed out "overloaded" in
       the next. A server error or a timeout gets one more, longer try before
       the page calls that source down; a 4xx is an answer and is not retried. */
    try {
      return { data: await fetchJSON(direct, signal, ms), via: 'direct' };
    } catch (e) {
      if (signal && signal.aborted) throw e;
      /* …or a 200 that is not JSON: Open-Meteo once answered an HRRR column
         with a plain-text error page */
      if (!(e.status >= 500 || e.name === 'AbortError' || e.name === 'TypeError' || e.name === 'SyntaxError')) throw e;
      await new Promise(r => setTimeout(r, 800));
      return { data: await fetchJSON(direct, signal, ms * 1.5), via: 'direct' };
    }
  }

  /* ── units ──
     Stored metric (°C, km/h, mm, hPa, m), shown in whichever the visitor
     picked. */
  const UNITS = {
    us: { temp: 'F', wind: 'mph', precip: 'in', pressure: 'inHg', dist: 'mi' },
    metric: { temp: 'C', wind: 'km/h', precip: 'mm', pressure: 'hPa', dist: 'km' }
  };
  const cToF = c => c * 9 / 5 + 32;
  const fToC = f => (f - 32) * 5 / 9;
  const has = v => v !== null && v !== undefined && Number.isFinite(Number(v));
  const fmt = {
    temp: (c, u) => has(c) ? String(Math.round(u === 'metric' ? c : cToF(c))) : '–',
    wind: (k, u) => has(k) ? String(Math.round(u === 'metric' ? k : k / 1.609344)) : '–',
    precip: (mm, u) => {
      if (!has(mm)) return '–';
      if (u === 'metric') return mm < 10 ? mm.toFixed(1) : String(Math.round(mm));
      const i = mm / 25.4;
      return i > 0 && i < 0.01 ? '<0.01' : i.toFixed(2);
    },
    pressure: (hpa, u) => has(hpa) ? (u === 'metric' ? String(Math.round(hpa)) : (hpa * 0.0295300).toFixed(2)) : '–',
    dist: (m, u) => {
      if (!has(m)) return '–';
      const v = u === 'metric' ? m / 1000 : m / 1609.344;
      return v >= 10 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, '');
    }
  };

  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const compass = deg => has(deg) ? COMPASS[Math.round(((Number(deg) % 360) + 360) % 360 / 22.5) % 16] : '';

  /* ── feels like (derived, and labelled as such) ──
     The NWS's own two formulas, so an observed temperature gets a feels-like
     computed the same way the forecast office computes theirs: the
     Rothfusz heat index (with Steadman's simple form below 80°F) and the 2001
     wind chill. Inputs and output in °C and km/h. */
  function heatIndexF(T, RH) {
    const simple = 0.5 * (T + 61 + (T - 68) * 1.2 + RH * 0.094);
    if ((simple + T) / 2 < 80) return simple;
    let HI = -42.379 + 2.04901523 * T + 10.14333127 * RH - 0.22475541 * T * RH - 0.00683783 * T * T -
      0.05481717 * RH * RH + 0.00122874 * T * T * RH + 0.00085282 * T * RH * RH - 0.00000199 * T * T * RH * RH;
    if (RH < 13 && T >= 80 && T <= 112) HI -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    else if (RH > 85 && T >= 80 && T <= 87) HI += ((RH - 85) / 10) * ((87 - T) / 5);
    return HI;
  }
  function feelsLike(tC, rh, windKmh) {
    if (!has(tC)) return null;
    const T = cToF(tC);
    if (T <= 50 && has(windKmh)) {
      const V = windKmh / 1.609344;
      if (V > 3) return fToC(35.74 + 0.6215 * T - 35.75 * Math.pow(V, 0.16) + 0.4275 * T * Math.pow(V, 0.16));
    }
    if (T >= 80 && has(rh)) return fToC(heatIndexF(T, rh));
    return tC;
  }

  /* ── WMO weather codes (what Open-Meteo speaks) ── */
  const WMO = {
    0: ['Clear', 'clear'], 1: ['Mostly clear', 'clear'], 2: ['Partly cloudy', 'partly'], 3: ['Cloudy', 'cloudy'],
    45: ['Fog', 'fog'], 48: ['Freezing fog', 'fog'],
    51: ['Light drizzle', 'drizzle'], 53: ['Drizzle', 'drizzle'], 55: ['Heavy drizzle', 'drizzle'],
    56: ['Freezing drizzle', 'sleet'], 57: ['Freezing drizzle', 'sleet'],
    61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'],
    66: ['Freezing rain', 'sleet'], 67: ['Freezing rain', 'sleet'],
    71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'],
    80: ['Showers', 'rain'], 81: ['Showers', 'rain'], 82: ['Heavy showers', 'rain'],
    85: ['Snow showers', 'snow'], 86: ['Heavy snow showers', 'snow'],
    95: ['Thunderstorms', 'storm'], 96: ['Storms with hail', 'storm'], 99: ['Storms with hail', 'storm']
  };
  const condition = code => {
    const w = WMO[code];
    return w ? { text: w[0], kind: w[1] } : { text: '—', kind: 'cloudy' };
  };
  /* An observation's words ("Light Rain and Fog") to one of the same kinds,
     so the picture on the page agrees with what the station says. */
  function kindOfText(text) {
    const t = String(text || '').toLowerCase();
    if (!t) return null;
    if (/thunder|t-storm/.test(t)) return 'storm';
    if (/freezing|sleet|ice pellets/.test(t)) return 'sleet';
    if (/snow/.test(t)) return 'snow';
    if (/drizzle/.test(t)) return 'drizzle';
    if (/rain|shower/.test(t)) return 'rain';
    if (/fog|mist|haze|smoke/.test(t)) return 'fog';
    if (/partly|mostly clear|mostly sunny|few clouds/.test(t)) return 'partly';
    if (/cloud|overcast/.test(t)) return 'cloudy';
    if (/clear|fair|sunny/.test(t)) return 'clear';
    return null;
  }

  /* ── Open-Meteo → one shape ── */
  function columns(block, map) {
    if (!block || !Array.isArray(block.time)) return [];
    return block.time.map((t, i) => {
      const row = { t };
      for (const [k, src] of Object.entries(map)) {
        const col = block[src];
        row[k] = Array.isArray(col) && has(col[i]) ? Number(col[i]) : null;
      }
      return row;
    });
  }
  function normalizeForecast(j, fetchedAt) {
    if (!j || !j.hourly || !Array.isArray(j.hourly.time)) throw new WxError('the forecast came back empty');
    const c = j.current || {};
    return {
      source: 'Open-Meteo',
      tz: j.timezone || 'UTC',
      tzAbbr: j.timezone_abbreviation || '',
      elevation: has(j.elevation) ? Number(j.elevation) : null,
      fetchedAt: fetchedAt || Date.now(),
      current: {
        t: has(c.time) ? Number(c.time) : null,
        temp: has(c.temperature_2m) ? c.temperature_2m : null,
        feels: has(c.apparent_temperature) ? c.apparent_temperature : null,
        rh: has(c.relative_humidity_2m) ? c.relative_humidity_2m : null,
        dew: has(c.dew_point_2m) ? c.dew_point_2m : null,
        code: has(c.weather_code) ? c.weather_code : null,
        isDay: c.is_day === 1 || c.is_day === true,
        precip: has(c.precipitation) ? c.precipitation : null,
        cloud: has(c.cloud_cover) ? c.cloud_cover : null,
        pressure: has(c.pressure_msl) ? c.pressure_msl : null,
        wind: has(c.wind_speed_10m) ? c.wind_speed_10m : null,
        windDir: has(c.wind_direction_10m) ? c.wind_direction_10m : null,
        gust: has(c.wind_gusts_10m) ? c.wind_gusts_10m : null
      },
      hourly: columns(j.hourly, {
        temp: 'temperature_2m', feels: 'apparent_temperature', dew: 'dew_point_2m', rh: 'relative_humidity_2m',
        pop: 'precipitation_probability', precip: 'precipitation', code: 'weather_code', cloud: 'cloud_cover',
        vis: 'visibility', pressure: 'pressure_msl', wind: 'wind_speed_10m', windDir: 'wind_direction_10m',
        gust: 'wind_gusts_10m', uv: 'uv_index', isDay: 'is_day'
      }),
      daily: columns(j.daily, {
        code: 'weather_code', hi: 'temperature_2m_max', lo: 'temperature_2m_min', precip: 'precipitation_sum',
        pop: 'precipitation_probability_max', wind: 'wind_speed_10m_max', gust: 'wind_gusts_10m_max',
        windDir: 'wind_direction_10m_dominant', sunrise: 'sunrise', sunset: 'sunset', uv: 'uv_index_max'
      }),
      minutely: columns(j.minutely_15, { precip: 'precipitation', snow: 'snowfall' })
    };
  }

  /* The hour row that holds `now`, and the rows from there on. Open-Meteo
     labels an hour by its start for temperatures. */
  const hourIndex = (hourly, nowSec) => {
    let i = hourly.findIndex(h => h.t > nowSec) - 1;
    if (i < 0) i = hourly.length && hourly[0].t <= nowSec ? hourly.length - 1 : 0;
    return i;
  };
  const upcomingHours = (fc, nowSec, n = 24) => fc.hourly.slice(hourIndex(fc.hourly, nowSec), hourIndex(fc.hourly, nowSec) + n);

  /* Days from today on (yesterday rides along for the trend only). Daily
     rows are stamped at local midnight. */
  const upcomingDays = (fc, nowSec) => fc.daily.filter(d => d.t + 86400 > nowSec);

  /* Three hours of sea-level pressure, from the model: a trend, labelled. */
  function pressureTrend(fc, nowSec) {
    const i = hourIndex(fc.hourly, nowSec);
    const now = fc.hourly[i], then = fc.hourly[i - 3];
    if (!now || !then || !has(now.pressure) || !has(then.pressure)) return null;
    const d = now.pressure - then.pressure;
    return { change: d, word: d >= 1 ? 'rising' : d <= -1 ? 'falling' : 'steady' };
  }

  /* ── when does it rain (§8.2, §9.3) ──
     The question the home screen answers first. Open-Meteo's 15-minute
     precipitation gives the timing; its hourly probability gives the
     confidence word. A 15-minute value is the total of the quarter hour
     ENDING at its time, and an hourly probability covers the hour ending at
     its time, so a wet slot stamped 17:15 means rain from 17:00.

     WET is 0.1 mm in a quarter hour (0.4 mm/h) — light rain you would notice
     on a visor, not a model's trace. One dry quarter hour inside a wet run
     does not split it into two showers. */
  const WET = 0.1;
  const Q = 900;
  function precipKind(slots) {
    let rain = 0, snowWater = 0;
    for (const s of slots) { rain += s.precip || 0; snowWater += (s.snow || 0) * 10 / 7; }
    return snowWater >= rain * 0.5 && snowWater > 0 ? 'snow' : 'rain';
  }
  function rainOutlook(fc, nowSec, hours = 3, time = sec => new Date(sec * 1000).toISOString().slice(11, 16)) {
    const until = nowSec + hours * 3600;
    let slots = (fc.minutely || []).filter(s => s.t > nowSec - Q && s.t - Q < until && has(s.precip));
    let step = Q;
    /* Somewhere the 15-minute series is missing, the hourly one stands in. */
    if (slots.length < hours * 2) {
      slots = fc.hourly.filter(h => h.t + 3600 > nowSec && h.t < until && has(h.precip))
        .map(h => ({ t: h.t + 3600, precip: h.precip / 4, snow: 0, hourly: true }));
      step = 3600;
    }
    if (!slots.length) return { state: 'unknown', text: 'No rain timing for this place right now' };

    const wet = s => s.precip >= WET;
    /* runs of wet slots, bridging single dry gaps */
    const runs = [];
    let cur = null, gap = 0;
    for (const s of slots) {
      if (wet(s)) {
        if (!cur) { cur = { from: s.t - step, to: s.t, slots: [] }; runs.push(cur); }
        cur.to = s.t; cur.slots.push(s); gap = 0;
      } else if (cur && ++gap > 1) { cur = null; gap = 0; }
    }

    const probIn = (from, to) => {
      let p = null;
      for (const h of fc.hourly) if (h.t + 3600 > from && h.t < to && has(h.pop)) p = Math.max(p ?? 0, h.pop);
      return p;
    };
    const stormIn = (from, to) => fc.hourly.some(h => h.t + 3600 > from && h.t < to && h.code >= 95);
    const word = p => p == null ? 'likely' : p >= 70 ? 'likely' : p >= 40 ? 'possible' : 'a slight chance';
    const lastSlot = slots[slots.length - 1].t;

    if (!runs.length) {
      const p = probIn(nowSec, until);
      if (p != null && p >= 30) {
        return { state: 'dry', prob: p, hours,
          text: `Probably dry for the next ${hours} hours`, note: `${Math.round(p)}% chance of a shower` };
      }
      return { state: 'dry', prob: p, hours, text: `Dry for at least ${hours} hours` };
    }

    const r = runs[0];
    const kind = stormIn(r.from, r.to) ? 'storms' : precipKind(r.slots);
    const Kind = kind[0].toUpperCase() + kind.slice(1);
    const open = r.to >= lastSlot;               // still wet at the end of what we can see
    const p = probIn(r.from, r.to);
    if (r.from <= nowSec) {
      return open
        ? { state: 'now', kind, hours, text: `${Kind} for at least the next ${hours} hours` }
        : { state: 'stopping', kind, end: r.to, text: `${Kind} ending around ${time(r.to)}` };
    }
    return { state: 'starting', kind, prob: p, start: r.from, end: open ? null : r.to,
      text: open ? `${Kind} ${word(p)} from ${time(r.from)}` : `${Kind} ${word(p)} ${time(r.from)}–${time(r.to)}` };
  }

  /* ── NWS ── */
  /* NWS quantities carry their unit; read it rather than trusting it. */
  function quantity(q, want) {
    if (!q || !has(q.value)) return null;
    const v = Number(q.value), u = String(q.unitCode || '').replace(/^wmoUnit:|^unit:/, '');
    switch (want) {
      case 'C': return u === 'degF' ? fToC(v) : u === 'K' ? v - 273.15 : v;
      case 'kmh': return u === 'm_s-1' ? v * 3.6 : u === 'km_h-1' || !u ? v : u === 'mi_h-1' ? v * 1.609344 : u === 'kn' ? v * 1.852 : v;
      case 'hPa': return u === 'Pa' ? v / 100 : u === 'hPa' ? v : v > 2000 ? v / 100 : v;
      case 'm': return u === 'km' ? v * 1000 : v;
      case 'mm': return u === 'm' ? v * 1000 : u === 'cm' ? v * 10 : v;
      default: return v;
    }
  }

  function normalizePoint(j) {
    const p = j && j.properties;
    if (!p) throw new WxError('no forecast office covers this point', 404);
    const rel = p.relativeLocation && p.relativeLocation.properties;
    return {
      office: p.gridId || p.cwa || null,
      forecastUrl: p.forecast || null,
      hourlyUrl: p.forecastHourly || null,
      stationsUrl: p.observationStations || null,
      radar: p.radarStation || null,
      tz: p.timeZone || null,
      city: rel ? [rel.city, rel.state].filter(Boolean).join(', ') : null,
      state: rel && /^[A-Z]{2}$/.test(rel.state || '') ? rel.state : null
    };
  }

  function normalizeStations(j, lat, lon) {
    const f = (j && Array.isArray(j.features)) ? j.features : [];
    return f.map(s => {
      const c = s.geometry && s.geometry.coordinates;
      const pr = s.properties || {};
      return {
        id: pr.stationIdentifier || null,
        name: pr.name || '',
        dist: Array.isArray(c) ? distanceM(lat, lon, c[1], c[0]) : null,
        elev: quantity(pr.elevation, 'm'),
        obsUrl: pr.stationIdentifier ? `${NWS}/stations/${pr.stationIdentifier}/observations/latest` : null
      };
    }).filter(s => s.id);
  }

  function normalizeObservation(j, station) {
    const p = j && j.properties;
    if (!p || !p.timestamp) return null;
    const t = Date.parse(p.timestamp);
    if (!Number.isFinite(t)) return null;
    const pressure = quantity(p.seaLevelPressure, 'hPa') ?? quantity(p.barometricPressure, 'hPa');
    return {
      station: station ? station.id : (p.station || '').split('/').pop() || null,
      stationName: station ? station.name : '',
      dist: station ? station.dist : null,
      time: t,
      text: p.textDescription || '',
      temp: quantity(p.temperature, 'C'),
      dew: quantity(p.dewpoint, 'C'),
      rh: quantity(p.relativeHumidity),
      wind: quantity(p.windSpeed, 'kmh'),
      windDir: quantity(p.windDirection),
      gust: quantity(p.windGust, 'kmh'),
      pressure,
      vis: quantity(p.visibility, 'm'),
      precipHour: quantity(p.precipitationLastHour, 'mm')
    };
  }

  function normalizePeriods(j) {
    const p = j && j.properties;
    const periods = (p && Array.isArray(p.periods)) ? p.periods : [];
    return {
      updated: p && (p.updateTime || p.generatedAt) ? Date.parse(p.updateTime || p.generatedAt) : null,
      periods: periods.map(x => ({
        name: x.name || '',
        start: Date.parse(x.startTime),
        end: Date.parse(x.endTime),
        isDay: !!x.isDaytime,
        temp: has(x.temperature) ? (x.temperatureUnit === 'F' ? fToC(Number(x.temperature)) : Number(x.temperature)) : null,
        pop: x.probabilityOfPrecipitation && has(x.probabilityOfPrecipitation.value) ? Number(x.probabilityOfPrecipitation.value) : null,
        wind: x.windSpeed || '',
        windDir: x.windDirection || '',
        short: x.shortForecast || '',
        detailed: x.detailedForecast || ''
      })).filter(x => Number.isFinite(x.start))
    };
  }

  /* ── alerts (§20) ──
     Shown as the NWS issued them. The page organises them and never
     rewrites one; the order is worst first, then soonest. */
  const SEVERITY = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1, Unknown: 0 };
  function alertTone(event) {
    const e = String(event || '');
    if (/warning/i.test(e)) return 'warning';
    if (/watch/i.test(e)) return 'watch';
    if (/advisory/i.test(e)) return 'advisory';
    return 'statement';
  }
  function normalizeAlerts(j, nowMs) {
    const f = (j && Array.isArray(j.features)) ? j.features : [];
    const now = nowMs || Date.now();
    return f.map(a => {
      const p = a.properties || {};
      const ends = Date.parse(p.ends || p.expires);
      return {
        id: p.id || a.id || '',
        event: p.event || 'Alert',
        tone: alertTone(p.event),
        headline: p.headline || '',
        severity: p.severity || 'Unknown',
        urgency: p.urgency || '',
        certainty: p.certainty || '',
        sent: Date.parse(p.sent) || null,
        onset: Date.parse(p.onset || p.effective) || null,
        ends: Number.isFinite(ends) ? ends : null,
        sender: p.senderName || '',
        area: p.areaDesc || '',
        description: p.description || '',
        instruction: p.instruction || '',
        messageType: p.messageType || '',
        polygon: a.geometry && a.geometry.type === 'Polygon' ? a.geometry.coordinates : null,
        ...alertDetail(p)
      };
    })
      .filter(a => a.messageType !== 'Cancel' && !(a.ends && a.ends < now))
      .sort((a, b) => (SEVERITY[b.severity] || 0) - (SEVERITY[a.severity] || 0) || (a.onset || 0) - (b.onset || 0));
  }

  /* What a storm-based warning says about its storm, from the NWS's own
     parameters (each is an array of strings). Nothing here is inferred: a
     warning without a motion line simply has no track. */
  const first = (params, k) => Array.isArray(params[k]) ? params[k][0] : params[k];
  function alertDetail(p) {
    const q = p.parameters || {};
    const text = `${p.headline || ''}\n${p.description || ''}`;
    const threat = first(q, 'tornadoDamageThreat') || first(q, 'thunderstormDamageThreat') || first(q, 'flashFloodDamageThreat') || null;
    const hail = parseFloat(first(q, 'maxHailSize'));
    const gust = parseFloat(first(q, 'maxWindGust'));
    return {
      motion: parseMotion(first(q, 'eventMotionDescription')),
      detection: first(q, 'tornadoDetection') || first(q, 'flashFloodDetection') || null,
      threat,
      hail: Number.isFinite(hail) && hail > 0 ? hail : null,                  // inches
      gust: Number.isFinite(gust) && gust > 0 ? gust : null,                  // mph, as the NWS writes it
      emergency: /\b(TORNADO|FLASH FLOOD) EMERGENCY\b/i.test(text) || threat === 'CATASTROPHIC',
      pds: /PARTICULARLY DANGEROUS SITUATION/i.test(text),
      storm: STORM_EVENTS.test(p.event || '')
    };
  }
  /* Warnings for a storm happening now, as opposed to watches, advisories
     and statements — the ones storm mode is for. */
  const STORM_EVENTS = /^(Tornado Warning|Severe Thunderstorm Warning|Flash Flood Warning|Extreme Wind Warning|Snow Squall Warning)$/;

  /* "2026-10-17T21:41:00-00:00...storm...244DEG...31KT...12.34,-56.78"
     The time the storm was at those points, the direction it is moving FROM
     (the warning's TIME...MOT...LOC line), its speed in knots, and one point
     for a cell or several for a line. */
  function parseMotion(str) {
    const m = /^(\S+?)\.\.\.(\w+)\.\.\.(\d{1,3})DEG\.\.\.(\d{1,3})KT\.\.\.(.+)$/.exec(String(str || '').trim());
    if (!m) return null;
    const t = Date.parse(m[1]);
    const points = m[5].trim().split(/\s+/).map(pr => pr.split(',').map(Number))
      .filter(([la, lo]) => validLat(la) && validLon(lo));
    if (!Number.isFinite(t) || !points.length) return null;
    return { time: t, kind: m[2], from: Number(m[3]) % 360, kt: Number(m[4]), points };
  }

  /* Is a point inside a GeoJSON ring ([lon, lat] pairs)? Ray casting. */
  function inPolygon(lat, lon, polygon) {
    const ring = polygon && polygon[0];
    if (!Array.isArray(ring)) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /* ── where the storm is, relative to you (storm mode) ──
     The warning's motion line, carried forward to now at its own speed and
     heading, in a flat frame around the place (fine over the tens of km a
     warning covers). Then: how far, which way, and — if its path crosses the
     place — roughly when. A cell is a point; a line is segments that move
     together. This is the warning's own estimate extended, nothing more, and
     the page says so every time it shows one.

     Units out: km, km/h, degrees (bearing FROM the place TO the storm), ms. */
  const KM_LAT = 110.57;
  const kmLon = lat => 111.32 * Math.cos(lat * Math.PI / 180);
  const bearing = (x, y) => (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
  function stormTrack(motion, lat, lon, nowMs, horizonMin = 90) {
    if (!motion) return null;
    const now = nowMs || Date.now();
    const kx = kmLon(lat);
    const toward = (motion.from + 180) % 360;
    const v = motion.kt * 1.852;                                  // km/h
    const vx = v * Math.sin(toward * Math.PI / 180), vy = v * Math.cos(toward * Math.PI / 180);
    const dtH = (now - motion.time) / 3600e3;
    const pts = motion.points.map(([la, lo]) => [(lo - lon) * kx + vx * dtH, (la - lat) * KM_LAT + vy * dtH]);

    /* nearest part of the storm now */
    let best = { d: Infinity, x: 0, y: 0 };
    const consider = (x, y) => { const d = Math.hypot(x, y); if (d < best.d) best = { d, x, y }; };
    if (pts.length === 1) consider(...pts[0]);
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const L = (bx - ax) ** 2 + (by - ay) ** 2;
      const s = L ? Math.max(0, Math.min(1, -(ax * (bx - ax) + ay * (by - ay)) / L)) : 0;
      consider(ax + s * (bx - ax), ay + s * (by - ay));
    }

    /* when its path reaches the place: for a line, the moment a segment
       sweeps over it; for a cell, its closest approach */
    let eta = null, miss = null;
    const v2 = vx * vx + vy * vy;
    if (v2 > 0) {
      if (pts.length > 1) {
        for (let i = 0; i + 1 < pts.length; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
          const ex = bx - ax, ey = by - ay;
          const det = ex * vy - ey * vx;               // solve a + s·e + t·v = 0
          if (Math.abs(det) < 1e-9) continue;
          const s = (-ax * vy + ay * vx) / det;
          const t = (ex * -ay + ey * ax) / det;         // hours
          if (s >= -0.05 && s <= 1.05 && t > 0 && (eta === null || t < eta)) { eta = t; miss = 0; }
        }
      }
      if (eta === null) {
        for (const [px, py] of pts) {
          const t = -(px * vx + py * vy) / v2;
          if (t <= 0) continue;
          const m = Math.hypot(px + vx * t, py + vy * t);
          if (miss === null || m < miss) { miss = m; eta = t; }
        }
      }
    }
    const within = eta !== null && eta * 60 <= horizonMin;
    const state = best.d < 3 ? 'over'
      : eta === null ? 'away'
      : miss <= 8 && within ? 'approaching'
      : miss <= 25 && within ? 'passing' : 'away';
    return {
      km: best.d,
      bearing: bearing(best.x, best.y),
      toward, kmh: v,
      eta: state === 'approaching' && eta !== null ? now + eta * 3600e3 : null,
      passKm: state === 'passing' ? miss : null,
      state,
      age: now - motion.time,
      points: pts.map(([x, y]) => [lat + y / KM_LAT, lon + x / kx])     // the storm now, for the map
    };
  }

  /* ── places ── */
  function normalizePlaces(j) {
    const r = (j && Array.isArray(j.results)) ? j.results : [];
    return r.filter(x => validLat(x.latitude) && validLon(x.longitude)).map(x => ({
      name: x.name,
      region: [x.admin1, x.country_code === 'US' ? null : x.country].filter(Boolean).join(', '),
      cc: x.country_code || '',
      lat: round2(x.latitude),
      lon: round2(x.longitude)
    }));
  }

  /* ── radar (§11) ──
     IEM's NEXRAD base-reflectivity composite as web-mercator tiles: the
     latest, and one layer per five minutes back to fifty. The JSON beside it
     says when "latest" was scanned, so every frame can carry its real time. */
  const RADAR_STEPS = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0];
  const radarLayer = minsAgo => 'nexrad-n0q-900913' + (minsAgo ? '-m' + String(minsAgo).padStart(2, '0') + 'm' : '');
  const radarTile = (minsAgo, z, x, y, bust) =>
    `${IEM}/cache/tile.py/1.0.0/${radarLayer(minsAgo)}/${z}/${x}/${y}.png${bust ? '?_=' + bust : ''}`;
  /* ── satellite (DESIGN.md §12) ──
     GOES-West and GOES-East as IEM tiles (probed 2026-10-21), West drawn
     first and East over it, so the whole country is covered. Each is the
     latest image IEM has; it refreshes every few minutes and the tile does
     not say when its scan was, so the page says "latest" and nothing finer.
     Visible is black at night — the page says so rather than showing a
     black map without a word. */
  const SAT = {
    ir: { label: 'Infrared', long: 'GOES infrared — cloud tops by temperature, the highest (coldest) brightest. Day and night.', layers: ['goes-west-ir-4km-900913', 'goes-east-ir-4km-900913'] },
    vis: { label: 'Visible', long: 'GOES visible — clouds as a camera sees them. Daytime only.', layers: ['goes-west-vis-1km-900913', 'goes-east-vis-1km-900913'] },
    wv: { label: 'Water vapour', long: 'GOES water vapour — moisture in the middle of the atmosphere; dry air dark, moist air white.', layers: ['goes-west-wv-4km-900913', 'goes-east-wv-4km-900913'] }
  };
  const satTile = (layer, z, x, y, bust) => `${IEM}/cache/tile.py/1.0.0/${layer}/${z}/${x}/${y}.png${bust ? '?_=' + bust : ''}`;
  function radarValid(j) {
    const v = j && j.meta && (j.meta.valid || j.meta.vtime);
    const t = v ? Date.parse(v) : NaN;
    return Number.isFinite(t) ? t : null;
  }

  /* ── freshness (§25) ──
     Every number on the page says how old it is, and past these it says
     "delayed" instead of looking live. */
  const STALE_MS = {
    observation: 90 * 60e3,     // stations report hourly; two misses is a problem
    radar: 15 * 60e3,           // a scan every 4–6 minutes
    forecast: 6 * 3600e3,       // NWS offices update a few times a day
    model: 3 * 3600e3           // Open-Meteo refreshes hourly
  };
  function age(ms) {
    if (!has(ms)) return '';
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60);
    if (h < 48) return h + ' h' + (m % 60 && h < 6 ? ' ' + (m % 60) + ' min' : '');
    return Math.floor(h / 24) + ' days';
  }
  const fresh = (kind, at, now) => {
    if (!has(at)) return { age: '', stale: true };
    const d = (now || Date.now()) - at;
    return { age: age(d), stale: d > (STALE_MS[kind] || Infinity) };
  };

  /* ── what "now" says (§8.1) ──
     A real station's observation when there is a recent one; the model's
     estimate otherwise, and the page labels which. Fields the station did not
     report are filled from the model and marked so. */
  function currentConditions(fc, obs, nowMs) {
    const now = nowMs || Date.now();
    const m = fc ? fc.current : {};
    const useObs = obs && has(obs.temp) && (now - obs.time) <= STALE_MS.observation;
    const pick = (o, mv) => useObs && has(o) ? { v: o, src: 'obs' } : { v: has(mv) ? mv : null, src: has(mv) ? 'model' : null };
    const temp = pick(obs && obs.temp, m.temp);
    const rh = pick(obs && obs.rh, m.rh);
    const wind = pick(obs && obs.wind, m.wind);
    const kindFromObs = useObs ? kindOfText(obs.text) : null;
    const cond = condition(m.code);
    let feels;
    if (useObs) feels = { v: feelsLike(temp.v, rh.v, wind.v), src: 'derived' };
    else feels = { v: has(m.feels) ? m.feels : null, src: 'model' };
    return {
      from: useObs ? 'observation' : 'model',
      time: useObs ? obs.time : (has(m.t) ? m.t * 1000 : null),
      temp, rh, wind, feels,
      dew: pick(obs && obs.dew, m.dew),
      gust: pick(obs && obs.gust, m.gust),
      windDir: pick(obs && obs.windDir, m.windDir),
      pressure: pick(obs && obs.pressure, m.pressure),
      vis: useObs && has(obs.vis) ? { v: obs.vis, src: 'obs' } : { v: null, src: null },
      text: useObs && obs.text ? obs.text : cond.text,
      kind: kindFromObs || cond.kind,
      isDay: m.isDay
    };
  }

  /* ── small helpers ── */
  function distanceM(lat1, lon1, lat2, lon2) {
    const R = 6371e3, r = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
      Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /* Times are shown in the PLACE's clock, not the visitor's: a forecast for
     Denver read in Knoxville should still say the rain starts at 3 PM. */
  function clock(tz) {
    const make = opts => {
      try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts }); }
      catch (e) { return new Intl.DateTimeFormat('en-US', opts); }
    };
    const t = make({ hour: 'numeric', minute: '2-digit' });
    const h = make({ hour: 'numeric' });
    const d = make({ weekday: 'short' });
    const dl = make({ weekday: 'long', month: 'short', day: 'numeric' });
    const ymd = make({ year: 'numeric', month: '2-digit', day: '2-digit' });
    const full = make({ weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    return {
      time: ms => t.format(ms),
      hour: ms => h.format(ms).replace(/\s/g, ''),
      day: ms => d.format(ms),
      dayLong: ms => dl.format(ms),
      ymd: ms => { const p = Object.fromEntries(ymd.formatToParts(ms).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; },
      full: ms => full.format(ms)
    };
  }

  /* ── the calls the page makes ── */
  async function forecast(lat, lon, signal) {
    const r = await ask(ROUTES.forecast(lat, lon), signal);
    return Object.assign(normalizeForecast(r.data, Date.now()), { via: r.via });
  }
  async function geocode(name, signal) {
    if (!String(name).trim()) return [];
    return normalizePlaces((await ask(ROUTES.geocode(name), signal)).data);
  }
  async function point(lat, lon, signal) {
    try {
      return normalizePoint((await ask(ROUTES.point(lat, lon), signal)).data);
    } catch (e) {
      if (signal && signal.aborted) throw e;
      if (e.status === 404) return null;        // outside the NWS's patch
      throw e;
    }
  }
  async function officeForecast(pt, signal) {
    if (!pt || !pt.forecastUrl) return null;
    return normalizePeriods((await ask(ROUTES.nws(pt.forecastUrl), signal)).data);
  }
  /* The nearest station with a temperature in the last ninety minutes; the
     next one along if the first has gone quiet (§35.4). */
  /* the stations around a point, nearest first (the NWS's own list) */
  async function nearbyStations(pt, lat, lon, signal) {
    if (!pt || !pt.stationsUrl) return [];
    return normalizeStations((await ask(ROUTES.nws(pt.stationsUrl), signal)).data, lat, lon).sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9));
  }
  /* A station far above or below the place is not "now" there: in the
     mountains the nearest one can sit 750 m lower and read 9 °F warm (Vail,
     2026-10-21). With the place's elevation known, stations more than
     ELEV_MAX_M away from it vertically are passed over — the next one, or the
     model, speaks instead. */
  const ELEV_MAX_M = 300;
  const sameLevel = (s, elev) => !has(elev) || !has(s.elev) || Math.abs(s.elev - elev) <= ELEV_MAX_M;
  /* …and one 60 miles off is not "now" here either: past this the model's
     estimate for the place itself is the better answer */
  const OBS_MAX_M = 40e3;
  async function observation(pt, lat, lon, signal, list, elev) {
    if (!pt || !pt.stationsUrl) return null;
    const stations = (list || await nearbyStations(pt, lat, lon, signal))
      .filter(s => sameLevel(s, elev) && !(has(s.dist) && s.dist > OBS_MAX_M)).slice(0, 3);
    let last = null;
    for (const s of stations) {
      try {
        const o = normalizeObservation((await ask(ROUTES.nws(s.obsUrl), signal)).data, s);
        if (o && has(o.temp) && Date.now() - o.time <= STALE_MS.observation) return o;
        last = last || o;
      } catch (e) { if (signal && signal.aborted) throw e; }
    }
    return last;
  }
  async function alerts(lat, lon, signal) {
    return normalizeAlerts((await ask(ROUTES.alerts(lat, lon), signal)).data);
  }
  async function national(signal) {
    return normalizeAlerts((await ask(ROUTES.national(), signal)).data);
  }
  async function stateAlerts(st, signal) {
    const r = ROUTES.area(st);
    return r ? normalizeAlerts((await ask(r, signal)).data) : [];
  }
  /* Where the Worker thinks this visitor is, from their connection —
     Cloudflare's own city-level guess, never asked of anyone else. Only the
     Worker can answer, so there is no direct fallback: null means "ask them". */
  async function near(signal) {
    try {
      const j = await fetchJSON(host() + '/wx/near', signal, 4000);
      if (!j || !validLat(+j.lat) || !validLon(+j.lon)) return null;
      return { name: j.city || 'Near you', region: j.region || '', cc: j.country || '', lat: round2(j.lat), lon: round2(j.lon), approx: true };
    } catch (e) { if (signal && signal.aborted) throw e; return null; }
  }
  /* ── the storm side ── */
  const isoMinute = ms => new Date(ms).toISOString().slice(0, 16) + 'Z';
  const isoHour = ms => new Date(ms).toISOString().slice(0, 13) + ':00Z';
  /* The nearest NEXRAD sites to a point, nearest first. */
  async function radarSites(lat, lon, signal) {
    const j = (await ask(ROUTES.radarSites(lat, lon, isoHour(Date.now())), signal)).data;
    return ((j && j.radars) || []).filter(r => r.type === 'NEXRAD' && SITE.test(r.id) && validLat(r.lat) && validLon(r.lon))
      .map(r => ({ id: r.id, name: r.name || r.id, lat: r.lat, lon: r.lon, dist: distanceM(lat, lon, r.lat, r.lon) }))
      .sort((a, b) => a.dist - b.dist);
  }
  /* A site's scans of a product in the last hour, oldest first, as times and
     the tile layer for each. Scans come every 4–10 minutes. */
  async function siteScans(site, prod, signal, nowMs) {
    const end = Math.floor((nowMs || Date.now()) / 300e3) * 300e3 + 300e3;
    const r = ROUTES.scans(site, prod, isoMinute(end - 3600e3), isoMinute(end));
    if (!r) return [];
    const j = (await ask(r, signal)).data;
    return ((j && j.scans) || []).map(x => Date.parse(String(x.ts).replace(/Z?$/, 'Z')))
      .filter(Number.isFinite).sort((a, b) => a - b)
      .map(t => ({ t, layer: `ridge::${site}-${prod}-${new Date(t).toISOString().replace(/[-:T]/g, '').slice(0, 12)}` }));
  }
  const tileUrl = (layer, z, x, y) => `${IEM}/cache/tile.py/1.0.0/${layer}/${z}/${x}/${y}.png`;

  /* SPC outlook polygons, as SPC labels and colours them. */
  const SPC_RANK = { TSTM: 1, MRGL: 2, SLGT: 3, ENH: 4, MDT: 5, HIGH: 6 };
  const SPC_NAMES = { TSTM: 'General thunderstorms', MRGL: 'Marginal risk', SLGT: 'Slight risk', ENH: 'Enhanced risk', MDT: 'Moderate risk', HIGH: 'High risk' };
  function normalizeOutlook(j) {
    const f = (j && Array.isArray(j.features)) ? j.features : [];
    return f.map(x => {
      const p = x.properties || {}, g = x.geometry || {};
      const polys = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
      return { label: p.LABEL || '', name: SPC_NAMES[p.LABEL] || p.LABEL2 || p.LABEL || '', rank: SPC_RANK[p.LABEL] || 0,
        stroke: p.stroke || null, fill: p.fill || null, polys,
        valid: Date.parse(p.VALID_ISO) || null, expire: Date.parse(p.EXPIRE_ISO) || null, issued: Date.parse(p.ISSUE_ISO) || null, forecaster: p.FORECASTER || '' };
    }).filter(o => o.polys.length);
  }
  async function outlook(kind, signal) { return normalizeOutlook((await ask(ROUTES.spc(kind), signal)).data); }
  /* The highest category whose area holds a point. */
  function outlookAt(o, lat, lon) {
    let best = null;
    for (const x of o || []) if (x.polys.some(poly => inPolygon(lat, lon, poly)) && (!best || x.rank > best.rank)) best = x;
    return best;
  }

  async function column(model, lat, lon, signal) {
    const r = ROUTES.column(model, lat, lon);
    if (!r) throw new WxError('no such model', 400);
    return (await ask(r, signal, 25000)).data;
  }
  async function modelRun(model, signal) {
    try {
      const j = (await ask(ROUTES.modelRun(model), signal)).data;
      const t = Number(j && j.last_run_initialisation_time);
      return Number.isFinite(t) && t > 0 ? t * 1000 : null;
    } catch (e) { if (signal && signal.aborted) throw e; return null; }
  }
  /* The nearest balloon site, and its latest flight (00Z or 12Z — a flight
     takes about an hour and a half to reach the top and be published). */
  async function raobSites(signal) {
    const j = (await ask(ROUTES.raobSites(), signal)).data;
    return ((j && j.features) || []).map(f => {
      const c = f.geometry && f.geometry.coordinates;
      const id = String(f.id || (f.properties && f.properties.id) || '').replace(/^_/, '');
      return c && validLat(c[1]) && validLon(c[0]) && /^[A-Z0-9]{3,5}$/.test(id)
        ? { id: id.length === 3 ? 'K' + id : id, name: (f.properties && (f.properties.sname || f.properties.name)) || id, lat: c[1], lon: c[0],
          online: !(f.properties && f.properties.archive_end) } : null;
    }).filter(x => x && x.online);
  }
  function raobTimes(nowMs, n = 3) {
    const out = [];
    let t = Math.floor(((nowMs || Date.now()) - 100 * 60e3) / (12 * 3600e3)) * 12 * 3600e3;
    for (let i = 0; i < n; i++, t -= 12 * 3600e3) out.push(t);
    return out;
  }
  const raobTs = ms => new Date(ms).toISOString().replace(/[-:T]/g, '').slice(0, 12);

  async function several(places, signal) {
    const r = ROUTES.several(places);
    if (!r) return [];
    const d = (await ask(r, signal)).data;
    return (Array.isArray(d) ? d : [d]).map(x => x && x.current ? {
      temp: has(x.current.temperature_2m) ? x.current.temperature_2m : null, code: x.current.weather_code, isDay: x.current.is_day === 1,
      hi: x.daily && has(x.daily.temperature_2m_max && x.daily.temperature_2m_max[0]) ? x.daily.temperature_2m_max[0] : null,
      lo: x.daily && has(x.daily.temperature_2m_min && x.daily.temperature_2m_min[0]) ? x.daily.temperature_2m_min[0] : null,
      tz: x.timezone || null } : null);
  }

  /* ── the sentence at the top ──
     What a person would say about the next day, built from the numbers by
     fixed rules — never more than the forecast says. Returns plain text.
     Rules, in order, at most three sentences:
       1. rain in the next 12 hours (an hour ≥ 50% or ≥ 0.3 mm): when it
          starts, or when it ends if it is raining now
       2. otherwise a change of sky in the next 8 hours: clearing, or clouds
          or fog arriving
       3. gusts of 40 km/h (25 mph) or more in the next 12 hours
       4. tomorrow's high 3 °C (5 °F) or more away from today's */
  function summary(fc, nowSec, clockFns, fmtTemp, fmtWind, windUnit) {
    if (!fc || !fc.hourly) return '';
    const hrs = upcomingHours(fc, nowSec, 25);
    const wetH = h => (has(h.pop) && h.pop >= 50) || (has(h.precip) && h.precip >= 0.3);
    const out = [];
    const kindOf = h => condition(h.code).kind;
    const wetWord = h => { const k = kindOf(h); return k === 'snow' ? 'Snow' : k === 'storm' ? 'Storms' : k === 'sleet' ? 'Freezing rain' : 'Rain'; };
    /* The next three hours belong to rainOutlook (15-minute data), which the
       page shows just above; this sentence never contradicts it. Past three
       hours, the hourly forecast speaks. */
    const near = rainOutlook(fc, nowSec, 3, s => clockFns.time(s * 1000));
    const nowWet = near.state === 'now' || near.state === 'stopping';
    if (near.state === 'stopping' || near.state === 'starting') out.push(near.text + '.');
    else if (nowWet) {
      const end = hrs.slice(1, 13).find(h => !wetH(h));
      out.push(end ? `${wetWord(hrs[0])} ending around ${clockFns.hour(end.t * 1000)}.` : `${wetWord(hrs[0])} continuing for the next 12 hours.`);
    } else if (near.state !== 'starting') {
      const start = hrs.slice(4, 13).find(wetH);
      if (start) out.push(`${wetWord(start)} ${start.pop >= 70 ? 'likely' : 'possible'} around ${clockFns.hour(start.t * 1000)}.`);
      else {
        const k0 = kindOf(hrs[0]);
        const cloudy = k => ['cloudy', 'fog', 'rain', 'drizzle', 'snow', 'storm', 'sleet'].includes(k);
        const clear = k => k === 'clear' || k === 'partly';
        const change = hrs.slice(1, 9).find(h => cloudy(k0) ? clear(kindOf(h)) : clear(k0) && (kindOf(h) === 'cloudy' || kindOf(h) === 'fog'));
        if (change) {
          const k = kindOf(change);
          out.push(clear(k) ? `${change.isDay ? 'Sunny' : 'Clear'} conditions expected around ${clockFns.hour(change.t * 1000)}.`
            : k === 'fog' ? `Fog possible around ${clockFns.hour(change.t * 1000)}.` : `Clouds moving in around ${clockFns.hour(change.t * 1000)}.`);
        }
      }
    }
    const gust = Math.max(-1, ...hrs.slice(0, 13).map(h => has(h.gust) ? h.gust : -1));
    if (gust >= 40) out.push(`Gusts up to ${fmtWind(gust)} ${windUnit}.`);
    const days = upcomingDays(fc, nowSec);
    if (days[0] && days[1] && has(days[0].hi) && has(days[1].hi)) {
      const d = days[1].hi - days[0].hi;
      if (Math.abs(d) >= 3) out.push(`Tomorrow ${d > 0 ? 'warmer' : 'colder'}, with a high of ${fmtTemp(days[1].hi)}°.`);
    }
    if (!out.length) {
      const t = hrs.slice(0, 13).filter(h => has(h.temp)).map(h => h.temp);
      if (t.length) out.push(`Steady conditions for the next 12 hours, between ${fmtTemp(Math.min(...t))}° and ${fmtTemp(Math.max(...t))}°.`);
    }
    return out.slice(0, 3).join(' ');
  }

  /* Today against yesterday (the forecast carries a day of the past). */
  function versusYesterday(fc, nowSec) {
    const today = upcomingDays(fc, nowSec)[0];
    const y = today && fc.daily.find(d => d.t === today.t - 86400 || Math.abs(d.t - (today.t - 86400)) < 7200);
    return y && has(y.hi) && has(today.hi) ? { today: today.hi, yesterday: y.hi, diff: today.hi - y.hi, ylo: y.lo } : null;
  }
  /* Rain totals: the past 24 hours (the model's own record of them) and the next 24. */
  function rainTotals(fc, nowSec) {
    let past = 0, next = 0, np = 0, nn = 0;
    for (const h of fc.hourly) {
      if (!has(h.precip)) continue;
      if (h.t <= nowSec && h.t > nowSec - 86400) { past += h.precip; np++; }
      else if (h.t > nowSec && h.t <= nowSec + 86400) { next += h.precip; nn++; }
    }
    return { past: np >= 20 ? past : null, next: nn >= 20 ? next : null };
  }

  /* ── ensemble plumes (§17.2) ──
     Every member of GEFS and ECMWF ENS as its own run: {times, members:
     [{set, t: [°C…], p: [mm…]}]}. Open-Meteo names a member's column
     `temperature_2m_member07_ncep_gefs025`, and the control run has no
     member number. A member missing most of its hours is left out. */
  const PLUME_SETS = { ncep_gefs025: 'GEFS', ecmwf_ifs025_ensemble: 'ECMWF ENS' };
  function normalizePlumes(j) {
    const h = j && j.hourly;
    if (!h || !Array.isArray(h.time)) return null;
    const runs = new Map();
    for (const [k, col] of Object.entries(h)) {
      const m = /^(temperature_2m|precipitation)(?:_member(\d+))?_(ncep_gefs025|ecmwf_ifs025_ensemble)$/.exec(k);
      if (!m || !Array.isArray(col)) continue;
      const id = `${m[3]}:${m[2] || '00'}`;
      if (!runs.has(id)) runs.set(id, { set: PLUME_SETS[m[3]], t: null, p: null });
      runs.get(id)[m[1] === 'temperature_2m' ? 't' : 'p'] = col.map(v => has(v) ? Number(v) : null);
    }
    const n = h.time.length;
    const members = [...runs.values()].filter(r => r.t && r.t.filter(v => v !== null).length > n * 0.8);
    return members.length ? { times: h.time.slice(), members, tz: j.timezone || 'UTC' } : null;
  }
  async function plumes(lat, lon, signal) {
    return normalizePlumes((await ask(ROUTES.plumes(lat, lon), signal, 20000)).data);
  }
  /* the q-th fraction of a list, linearly between neighbours */
  function quantile(xs, q) {
    const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
    if (!s.length) return null;
    const i = (s.length - 1) * q, lo = Math.floor(i);
    return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo);
  }
  /* Each hour's spread (10th, 50th, 90th percentile), and each local day's
     high spread and the share of runs with 1 mm or more of rain in it.
     `days` are local midnights (unix s), as in the forecast's daily rows. */
  function plumeStats(pl, days) {
    if (!pl) return null;
    const hours = pl.times.map((t, i) => {
      const xs = pl.members.map(m => m.t[i]);
      return { t, p10: quantile(xs, 0.1), p50: quantile(xs, 0.5), p90: quantile(xs, 0.9) };
    });
    const out = [];
    for (const d of days || []) {
      const idx = pl.times.map((t, i) => t >= d && t < d + 86400 ? i : -1).filter(i => i >= 0);
      if (idx.length < 20) continue;
      const highs = pl.members.map(m => Math.max(...idx.map(i => m.t[i]).filter(v => v !== null)));
      const totals = pl.members.filter(m => m.p).map(m => idx.reduce((a, i) => a + (m.p[i] || 0), 0));
      out.push({ t: d, runs: pl.members.length, hi10: quantile(highs, 0.1), hi50: quantile(highs, 0.5), hi90: quantile(highs, 0.9),
        wet: totals.length ? totals.filter(x => x >= 1).length / totals.length : null, rain50: quantile(totals, 0.5), rain90: quantile(totals, 0.9) });
    }
    return { hours, days: out, runs: pl.members.length, sets: [...new Set(pl.members.map(m => m.set))] };
  }

  /* ── stations on the map (§19.1) ──
     IEM's current ASOS readings for one forecast office, in the page's
     units (°C, km/h, m, hPa). Positions are read at run time and never kept
     anywhere but the page. A reading older than STALE_MS.observation is
     dropped; one with no temperature is kept only if it says something else. */
  const SKY = { CLR: 'Clear', SKC: 'Clear', FEW: 'A few clouds', SCT: 'Partly cloudy', BKN: 'Mostly cloudy', OVC: 'Overcast', VV: 'Sky hidden' };
  function normalizeStationObs(j, nowMs) {
    const f = j && Array.isArray(j.features) ? j.features : [];
    const now = nowMs || Date.now();
    const num = v => has(v) ? Number(v) : null;
    return f.map(x => {
      const p = x.properties || {}, c = x.geometry && x.geometry.coordinates;
      const t = Date.parse(p.utc_valid);
      if (!Array.isArray(c) || !validLat(+c[1]) || !validLon(+c[0]) || !Number.isFinite(t)) return null;
      /* the highest layer that covers the most sky is what the sky looks like */
      const layers = [p.skyc1, p.skyc2, p.skyc3, p.skyc4].filter(Boolean);
      const worst = ['VV', 'OVC', 'BKN', 'SCT', 'FEW', 'CLR', 'SKC'].find(k => layers.includes(k)) || null;
      const tmp = num(p.tmpf), dew = num(p.dwpf), kt = num(p.sknt), g = num(p.gust), mslp = num(p.mslp);
      return {
        id: String(p.station || ''), name: String(p.name || '').replace(/\s+/g, ' ').trim(), lat: +c[1], lon: +c[0], time: t,
        temp: tmp === null ? null : fToC(tmp), dew: dew === null ? null : fToC(dew), rh: num(p.relh),
        wind: kt === null ? null : kt * 1.852, windDir: num(p.drct), gust: g === null || g <= 0 ? null : g * 1.852,
        vis: num(p.vsby) === null ? null : p.vsby * 1609.344, pressure: mslp,
        sky: worst ? SKY[worst] : null, wx: p.wxcodes ? String(p.wxcodes).trim() || null : null,
        precipHour: num(p.phour) === null ? null : p.phour * 25.4, raw: p.raw ? String(p.raw) : ''
      };
    }).filter(s => s && s.id && now - s.time <= STALE_MS.observation && (s.temp !== null || s.wind !== null));
  }
  async function stationObs(wfo, signal) {
    const r = ROUTES.stationObs(wfo);
    if (!r) return [];
    return normalizeStationObs((await ask(r, signal)).data);
  }

  /* Calm: under 1.5 km/h, where a station reports 0 and a direction means
     nothing. The page says "calm" instead of "N 0". */
  const CALM_KMH = 1.5;
  const isCalm = kmh => has(kmh) && kmh < CALM_KMH;

  /* ── the ride outlook (DESIGN.md §21.1) ──
     "Can I ride in the next few hours?" — one word and the reasons for it,
     from what the page already holds: the rain sentence (rainOutlook, so it
     never contradicts the rain line), the radar's next hour when there is
     one, thunder in the hourly codes, the strongest gust, the temperature
     range, fog, darkness, and official alerts covering the place. It says
     nothing about road surfaces (§21.2) or lightning — the page has no
     lightning feed, so thunder is the model's, and says so.
       poor  a storm warning or any warning here, thunder, rain now or
             likely, gusts ≥ 40 mph, near-freezing air, visibility under 1 mi
       fair  rain possible or ending, gusts ≥ 25 mph, cold or hot, haze,
             dark during the window, an advisory or watch
       good  none of those
     Thresholds are rider's rules of thumb, in km/h and °C like everything
     stored here; the page converts the words. */
  const RIDE = { gustPoor: 64, gustFair: 40, coldPoor: 2, coldFair: 10, hot: 35, visPoor: 1600, visFair: 5000 };
  const RIDE_IGNORE = /Rip Current|Beach Hazard|Small Craft|Marine|Gale|^Storm Warning$|Hurricane Force Wind|Lakeshore|Low Water|Air Quality|Air Stagnation|Hazardous Seas|High Surf/i;
  function rideOutlook(fc, nowSec, hours, o = {}) {
    if (!fc || !fc.hourly) return null;
    const until = nowSec + hours * 3600;
    const hrs = fc.hourly.filter(h => h.t + 3600 > nowSec && h.t < until);
    if (!hrs.length) return null;
    const time = o.time || (s => new Date(s * 1000).toISOString().slice(11, 16));
    const T = o.fmtTemp || (c => String(Math.round(c))), Wd = o.fmtWind || (k => String(Math.round(k))), wu = o.windUnit || 'km/h';
    const reasons = [];
    const say = (level, text) => reasons.push({ level, text });

    for (const a of (o.alerts || [])) {
      /* alerts for the water or the air quality say nothing about a road; a
         fire-weather warning is about dry wind, which the gusts below cover */
      if (RIDE_IGNORE.test(a.event)) continue;
      if (/Red Flag|Fire Weather/i.test(a.event)) { say('fair', `${a.event} in effect`); continue; }
      if (a.storm) say('poor', `${a.event} covers this place`);
      else if (a.tone === 'warning') say('poor', `${a.event} in effect`);
      else if (a.tone === 'watch' || a.tone === 'advisory') say('fair', `${a.event} in effect`);
    }
    const rain = rainOutlook(fc, nowSec, hours, time);
    if (rain.state === 'now') say('poor', rain.text);
    else if (rain.state === 'starting') say(rain.prob == null || rain.prob >= 70 ? 'poor' : 'fair', rain.text);
    else if (rain.state === 'stopping') say('fair', rain.text + ' — roads stay wet a while');
    else if (rain.note) say('fair', rain.note);
    /* the radar's own next hour, when it sees rain the models do not */
    const nc = o.nowcast;
    if (nc && (nc.kind === 'raining' || nc.kind === 'starting') && !['now', 'starting', 'stopping'].includes(rain.state)) say('fair', 'Radar: ' + nc.text);
    const thunder = hrs.find(h => h.code >= 95);
    if (thunder) say('poor', `Thunderstorms in the forecast around ${time(Math.max(thunder.t, nowSec))}`);
    const gusts = hrs.map(h => h.gust).filter(has);
    const gust = gusts.length ? Math.max(...gusts) : null;
    if (gust != null && gust >= RIDE.gustPoor) say('poor', `Gusts to ${Wd(gust)} ${wu}`);
    else if (gust != null && gust >= RIDE.gustFair) say('fair', `Gusts to ${Wd(gust)} ${wu}`);
    const ts = hrs.map(h => h.temp).filter(has);
    const lo = ts.length ? Math.min(...ts) : null, hi = ts.length ? Math.max(...ts) : null;
    if (lo != null && lo < RIDE.coldPoor) say('poor', `Near freezing (${T(lo)}°) — ice is possible`);
    else if (lo != null && lo < RIDE.coldFair) say('fair', `Cold — down to ${T(lo)}°, dress for it`);
    if (hi != null && hi >= RIDE.hot) say('fair', `Hot — up to ${T(hi)}°`);
    const viss = hrs.map(h => h.vis).filter(has);
    const vis = viss.length ? Math.min(...viss) : null;
    if (vis != null && vis < RIDE.visPoor) say('poor', 'Fog — visibility under a mile');
    else if (vis != null && vis < RIDE.visFair) say('fair', 'Hazy — visibility down to a few miles');
    /* darkness: dark now, or the sun sets inside the window */
    const set = (fc.daily || []).map(d => d.sunset).find(s => has(s) && s > nowSec && s < until);
    const darkNow = fc.current && has(fc.current.t) ? !fc.current.isDay : hrs[0].isDay === 0;
    const dark = darkNow ? { now: true } : set ? { at: set } : null;
    if (dark && dark.at) say('fair', `Dark from ${time(dark.at)}`);
    else if (dark) say('fair', 'After dark');

    const rank = { good: 0, fair: 1, poor: 2 };
    const level = reasons.reduce((w, r) => rank[r.level] > rank[w] ? r.level : w, 'good');
    reasons.sort((a, b) => rank[b.level] - rank[a.level]);
    return { level, hours, reasons, rain, gust, lo, hi, vis, thunder: !!thunder, dark };
  }

  /* ── how sure, and the scoreboard ── */
  /* One answer, every model: Map(hour → { model: {t, w, p} }) */
  function normalizeEnsemble(j) {
    const h = j && j.hourly;
    if (!h || !Array.isArray(h.time)) return null;
    const hours = new Map();
    h.time.forEach((t, i) => {
      const row = {};
      for (const m of ENSEMBLE) {
        const om = MODELS_OM[m];
        const v = k => { const c = h[`${k}_${om}`]; return Array.isArray(c) && has(c[i]) ? Number(c[i]) : null; };
        const x = { t: v('temperature_2m'), w: v('wind_speed_10m'), p: v('precipitation') };
        if (x.t !== null || x.p !== null) row[m] = x;
      }
      hours.set(t, row);
    });
    return { hours, tz: j.timezone || 'UTC' };
  }
  async function ensemble(lat, lon, signal) {
    return normalizeEnsemble((await ask(ROUTES.ensemble(lat, lon), signal, 20000)).data);
  }

  /* How sure is a day? From the models themselves: how far apart their highs
     are, and whether they agree it rains (≥ 1 mm). `days` are local
     midnights (unix s) from the forecast; `hours` the ensemble. */
  function dayConfidence(ens, dayT) {
    if (!ens) return null;
    const highs = {}, rain = {};
    for (const [t, row] of ens.hours) {
      if (t < dayT || t >= dayT + 86400) continue;
      for (const [m, x] of Object.entries(row)) {
        if (has(x.t)) highs[m] = Math.max(highs[m] ?? -Infinity, x.t);
        if (has(x.p)) rain[m] = (rain[m] || 0) + x.p;
      }
    }
    const hs = Object.values(highs).filter(Number.isFinite), rs = Object.values(rain);
    if (hs.length < 3) return null;
    const lo = Math.min(...hs), hi = Math.max(...hs), sp = hi - lo;
    const wet = rs.filter(r => r >= 1).length, frac = rs.length ? wet / rs.length : 0;
    const rainSplit = frac > 0.2 && frac < 0.8;
    const level = sp <= 2 && !rainSplit ? 'high' : sp <= 4 && !rainSplit ? 'medium' : 'low';
    return { level, spread: sp, low: lo, high: hi, models: hs.length, rainModels: wet, rainOf: rs.length, rainSplit, highs };
  }

  /* NWS station ids are ICAO ("KTYS", "PANC"); IEM's are the three-letter
     FAA id ("TYS", "ANC") for the same airport. */
  const iemId = id => /^[KP][A-Z0-9]{3}$/.test(id) ? id.slice(1) : id;
  /* the published scoreboard: ricmassey.com's own files, no third party */
  const SCORES = (() => { try { return new URL('projects/weather/verify/scores/', document.baseURI).href; } catch (e) { return 'projects/weather/verify/scores/'; } })();
  let scoreIndex = null;
  const stateFiles = new Map();
  async function scoreIndexGet(signal) {
    if (!scoreIndex) scoreIndex = fetchJSON(SCORES + 'index.json', signal, 10000).catch(e => { scoreIndex = null; throw e; });
    return scoreIndex;
  }
  /* The records of the scored stations among `stations` (from the NWS
     list, nearest first), each with its distance. */
  async function stationRecords(stations, signal) {
    const idx = await scoreIndexGet(signal);
    const out = [];
    for (const s of stations) {
      const id = iemId(s.id), st = idx.stations && idx.stations[id];
      if (!st) continue;
      if (!stateFiles.has(st)) stateFiles.set(st, fetchJSON(SCORES + st + '.json', signal, 10000).catch(() => null));
      const file = await stateFiles.get(st);
      const rec = file && file.stations && file.stations[id];
      if (rec) out.push({ id, nws: s.id, name: rec.n || s.name, dist: s.dist, models: rec.m, learned: rec.L || null });
      if (out.length >= 3) break;
    }
    return { index: idx, stations: out };
  }
  /* Which forecast has earned its place here: of the standard forecast, this
     page's own two (the blend, the learned forecast) and the models the page
     holds hour by hour (ENSEMBLE — the NWS National Blend, HRRR, GFS, ECMWF,
     AIFS), the one whose record at the nearest well-scored station is lowest
     — and anything but the standard only when it beats the standard by a
     clear margin, and the learned one only when its coefficients are
     published. A model the page cannot draw (Pangu, run off-site) is ranked
     on the card but never picked. */
  function verdict(rec, minDays, have = ENSEMBLE) {
    if (!rec || !rec.models) return null;
    const mae = m => { const r = rec.models[m] && rec.models[m][1]; if (!r || r.days < minDays) return null;
      const n = r.td[2] + r.tn[2]; return n ? (r.td[1] * r.td[2] + r.tn[1] * r.tn[2]) / n : null; };
    const rows = Object.keys(rec.models).map(m => ({ m, mae: mae(m), days: rec.models[m][1] && rec.models[m][1].days })).filter(x => x.mae !== null).sort((a, b) => a.mae - b.mae);
    const base = rows.find(x => x.m === 'best');
    const usable = m => m === 'blend' || (m === 'learn' && rec.learned && rec.learned.t) || have.includes(m);
    const ours = rows.filter(x => usable(x.m) && base && x.mae < base.mae - 0.05);
    const pick = ours.length ? ours[0] : null;
    const b = rows.find(x => x.m === 'blend'), l = rows.find(x => x.m === 'learn');
    return { rows, use: pick ? pick.m : 'best', useBlend: !!pick, pick, blend: b, learn: l, base, best: rows[0] || null };
  }

  /* ── the radar nowcast (nowcast.js) ──
     The four newest ten-minute frames of the mosaic around the place, at
     zoom 6 (a pixel is ~2 km; 2×2 tiles reach at least 250 km every way, an
     hour of a fast squall line), read pixel by pixel through IEM's palette
     and handed to the same code the nightly grade runs. Lower 48 only —
     the mosaic stops at its edges. Tiles are cross-origin readable (IEM sends
     Access-Control-Allow-Origin: *); with no canvas or no network the page
     simply shows the model line alone. */
  const NOWCAST_Z = 6;
  const inMosaic = (lat, lon) => lat > 24.5 && lat < 49.5 && lon > -125.5 && lon < -66.5;
  function tileImage(url, signal) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.decoding = 'async';
      const stop = () => { im.src = ''; rej(new WxError('radar stopped')); };
      if (signal) signal.addEventListener('abort', stop, { once: true });
      im.onload = () => res(im);
      im.onerror = () => rej(new WxError('radar tile failed'));
      im.src = url;
    });
  }
  async function nowcast(lat, lon, valid, signal) {
    const N = root.WxNowcast;
    if (!N || !inMosaic(lat, lon) || typeof document === 'undefined') return null;
    const world = 256 * 2 ** NOWCAST_Z;
    const gx = (lon + 180) / 360 * world;
    const s = Math.sin(lat * Math.PI / 180);
    const gy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world;
    const tx0 = Math.floor(gx / 256 - 0.5), ty0 = Math.floor(gy / 256 - 0.5);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const bust = valid ? Math.floor(valid / 60e3) : '';
    const frames = [];
    for (const back of [30, 20, 10, 0]) {
      const ims = await Promise.all([[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) =>
        tileImage(radarTile(back, NOWCAST_Z, tx0 + dx, ty0 + dy, bust), signal).then(im => ({ im, dx, dy }))));
      ctx.clearRect(0, 0, 512, 512);
      for (const { im, dx, dy } of ims) ctx.drawImage(im, dx * 256, dy * 256);
      const idx = N.indicesOf(ctx.getImageData(0, 0, 512, 512).data);
      frames.push(N.field({ width: 512, height: 512, data: idx }, 1));
    }
    /* km per pixel at this latitude (Mercator stretches x and y alike) */
    const km = 40075.016 * Math.cos(lat * Math.PI / 180) / world;
    const m = N.motion(frames, 10, { regions: 3, search: N.SETTINGS.searchKm / km });
    const px = gx - tx0 * 256, py = gy - ty0 * 256;
    const series = N.forecast(frames[3], m, px, py, N.optionsFor(km, 60));
    const mv = N.motionAt(m, px, py);
    const speed = Math.hypot(mv.u, mv.v) * km * 60;              // km/h
    /* the direction the rain is moving TOWARD, as a compass bearing */
    const toward = (Math.atan2(mv.u, -mv.v) * 180 / Math.PI + 360) % 360;
    return { series, moving: m.known, speed, toward, valid: valid || null };
  }
  /* the nowcast's own track record, from the nightly grade */
  async function nowcastRecord(signal) {
    return fetchJSON(SCORES + 'nowcast.json', signal, 10000);
  }

  async function radarTime(signal) {
    try { return radarValid((await ask(ROUTES.radarMeta(), signal)).data); }
    catch (e) { if (signal && signal.aborted) throw e; return null; }
  }

  const api = {
    UNITS, WMO, STALE_MS, RADAR_STEPS, NWS_FOLLOW, ROUTES, WxError,
    round2, coord, validLat, validLon, omParams,
    fmt, compass, cToF, fToC, feelsLike, heatIndexF, condition, kindOfText,
    normalizeForecast, normalizePoint, normalizeStations, normalizeObservation, normalizePeriods,
    normalizeAlerts, normalizePlaces, alertTone,
    hourIndex, upcomingHours, upcomingDays, pressureTrend, rainOutlook, currentConditions,
    radarLayer, radarTile, radarValid, age, fresh, distanceM, clock,
    forecast, geocode, point, officeForecast, observation, alerts, radarTime, host,
    STORM_EVENTS, NATIONAL_EVENTS, parseMotion, inPolygon, stormTrack, alertDetail, national, stateAlerts, near,
    SITE_PRODUCTS, SPC_KINDS, SPC_NAMES, MODELS, COLUMN_LEVELS, COLUMN_FIELDS, radarSites, siteScans, tileUrl, isoMinute, isoHour,
    normalizeOutlook, outlook, outlookAt, column, modelRun, raobSites, raobTimes, raobTs,
    several, summary, versusYesterday, rainTotals, nearbyStations, MODELS_OM, MODEL_NAMES, ENSEMBLE, normalizeEnsemble, ensemble, dayConfidence, iemId, stationRecords, verdict, scoreIndexGet,
    inMosaic, nowcast, nowcastRecord,
    CALM_KMH, isCalm, RIDE, rideOutlook, SAT, satTile, ELEV_MAX_M, sameLevel, OBS_MAX_M,
    normalizeStationObs, stationObs, normalizePlumes, plumes, plumeStats, quantile
  };
  root.Wx = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
