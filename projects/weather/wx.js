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
    radarMeta: () => ['radar', `${IEM}/data/gis/images/4326/USCOMP/n0q_0.json`]
  };
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
  async function ask(route, signal) {
    if (!route) throw new WxError('not a request this page makes', 400);
    const [path, direct] = route;
    try {
      return { data: await fetchJSON(host() + '/wx/' + path, signal), via: 'worker' };
    } catch (e) {
      if (signal && signal.aborted) throw e;
    }
    return { data: await fetchJSON(direct, signal), via: 'direct' };
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
      city: rel ? [rel.city, rel.state].filter(Boolean).join(', ') : null
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
        polygon: a.geometry && a.geometry.type === 'Polygon' ? a.geometry.coordinates : null
      };
    })
      .filter(a => a.messageType !== 'Cancel' && !(a.ends && a.ends < now))
      .sort((a, b) => (SEVERITY[b.severity] || 0) - (SEVERITY[a.severity] || 0) || (a.onset || 0) - (b.onset || 0));
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
  async function observation(pt, lat, lon, signal) {
    if (!pt || !pt.stationsUrl) return null;
    const stations = normalizeStations((await ask(ROUTES.nws(pt.stationsUrl), signal)).data, lat, lon).slice(0, 3);
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
    forecast, geocode, point, officeForecast, observation, alerts, radarTime, host
  };
  root.Wx = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
