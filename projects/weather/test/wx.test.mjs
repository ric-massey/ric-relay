/* The weather room's client rules — node projects/weather/test/wx.test.mjs
   No network: every provider is a fixture shaped like its documented answer
   (Open-Meteo's /v1/forecast, the NWS's GeoJSON). test/live.mjs asks the
   real ones. What is asserted is what the page leans on: a place never
   leaving more precise than a kilometre, the Worker accepting every request
   the page makes, the rain sentence, the feels-like formulas, units, and
   that old data says it is old. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const W = require('../wx.js');
const worker = (await import('../../../worker/worker.mjs')).default;

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const near = (a, b, eps = 0.05) => Math.abs(a - b) <= eps;

console.log('\nRULE  a place leaves this file rounded to about a kilometre');
ok(W.coord(12.345678) === '12.35' && W.coord(-56.781) === '-56.78', 'two decimals');
ok(W.coord(-0.001) === '0', 'never "-0"');
ok(W.ROUTES.forecast(12.345678, -56.781)[1].includes('latitude=12.35&longitude=-56.78'), 'the forecast asks for the rounded point');
ok(W.ROUTES.point(12.345678, -56.781)[1].endsWith('/points/12.35,-56.78'), 'so does the NWS lookup');
ok(W.ROUTES.alerts(12.345678, -56.781)[0] === 'nws/alerts/active?point=12.35,-56.78', 'and the alerts');

console.log('\nRULE  the Worker accepts every request the page makes, and asks upstream for the same thing');
{
  const asked = [];
  const env = { LOG: { idFromName: () => 'x', get: () => ({}) }, FETCH: async u => { asked.push(String(u)); return new Response('{}'); } };
  const routes = [
    W.ROUTES.forecast(12.34, -56.78), W.ROUTES.forecast(-33.87, 151.21),
    W.ROUTES.geocode('Chattanooga'), W.ROUTES.geocode('São Paulo'),
    W.ROUTES.point(12.34, -56.78), W.ROUTES.alerts(12.34, -56.78),
    W.ROUTES.nws('https://api.weather.gov/gridpoints/ABC/45,60/forecast'),
    W.ROUTES.nws('https://api.weather.gov/gridpoints/ABC/45,60/stations'),
    W.ROUTES.nws('https://api.weather.gov/stations/KABC/observations/latest'),
    W.ROUTES.radarMeta(), W.ROUTES.national(), W.ROUTES.area('OK'),
    W.ROUTES.radarSites(12.34, -56.78, '2026-10-17T20:00Z'), W.ROUTES.scans('ABC', 'N0B', '2026-10-17T19:05Z', '2026-10-17T20:05Z'),
    W.ROUTES.scans('ABC', 'N0S', '2026-10-17T19:05Z', '2026-10-17T20:05Z'),
    ...W.SPC_KINDS.map(k => W.ROUTES.spc(k)),
    ...Object.keys(W.MODELS).map(m => W.ROUTES.column(m, 12.34, -56.78)),
    ...Object.keys(W.MODELS).map(m => W.ROUTES.modelRun(m)),
    W.ROUTES.raobSites(), W.ROUTES.raob('KABC', '202610171200'), W.ROUTES.ensemble(12.34, -56.78), W.ROUTES.stationObs('ABC'), W.ROUTES.plumes(12.34, -56.78), W.ROUTES.hrrrMeta(), W.ROUTES.sbwArchive('2011-04-27T20:00Z', '2011-04-27T23:00Z'), W.ROUTES.xsec('hrrr', W.linePoints({ lat: 12.34, lon: -56.78 }, { lat: 14.1, lon: -50.2 }, 12)),
    W.ROUTES.spcWatches(), W.ROUTES.spcMds(), W.ROUTES.wpcMpds(), W.ROUTES.stormCells(), W.ROUTES.stormReports(),
    W.ROUTES.nwsProducts('COD'), W.ROUTES.nwsProducts('AFD', 'ABC'), W.ROUTES.nwsProduct('fcb2d575-a207-4057-a31c-823cdbbda16d'),
    W.ROUTES.several([{ lat: 12.34, lon: -56.78 }, { lat: -33.87, lon: 151.21 }]),
    W.ROUTES.stationObs('ABC', true), W.ROUTES.asosAt('OK_ASOS', Date.UTC(2013, 4, 20, 20, 0)),
    W.ROUTES.air(12.345678, -56.781), W.ROUTES.normals(12.345678, -56.781), W.ROUTES.mosaicBackup(),
    W.ROUTES.nhcLayer(164), W.ROUTES.nhcLayer(3)
  ];
  for (const [path, direct] of routes) {
    const n = asked.length;
    const r = await worker.fetch(new Request('https://x/wx/' + path), env, null);
    ok(r.status === 200 && asked[n] === direct, `/wx/${path.slice(0, 60)} → ${direct.slice(0, 50)}…`);
  }
  ok(W.ROUTES.nws('https://api.weather.gov/products/abc') === null, 'a URL the Worker would refuse is not followed at all');
  ok(W.ROUTES.scans('ABC', 'N0X', 'a', 'b') === null && W.ROUTES.column('nam', 1, 1) === null && W.ROUTES.spc('day9') === null && W.ROUTES.raob('x', '1') === null,
    'products, models, outlooks and stations outside the lists are never asked for');
}

/* ── a forecast fixture: an hourly and 15-minute series around NOW ── */
const NOW = 1_800_000_000 - (1_800_000_000 % 3600) + 600;    // ten past an hour
const H0 = NOW - (NOW % 3600);
function forecastFixture({ minutely = [], pop = () => 10, code = () => 2 } = {}) {
  const hours = Array.from({ length: 48 }, (_, i) => H0 - 24 * 3600 + i * 3600);
  const quarters = Array.from({ length: 32 }, (_, i) => H0 + (i + 1) * 900);
  return {
    timezone: 'America/New_York', timezone_abbreviation: 'EDT', elevation: 300,
    current: { time: NOW, temperature_2m: 20, apparent_temperature: 19, relative_humidity_2m: 50, dew_point_2m: 9,
      is_day: 1, precipitation: 0, weather_code: 2, cloud_cover: 40, pressure_msl: 1012, wind_speed_10m: 15,
      wind_direction_10m: 225, wind_gusts_10m: 30 },
    hourly: {
      time: hours,
      temperature_2m: hours.map((_, i) => 10 + i / 4),
      precipitation_probability: hours.map(t => pop(t)),
      precipitation: hours.map(() => 0),
      weather_code: hours.map(t => code(t)),
      pressure_msl: hours.map((_, i) => 1020 - i * 0.5),
      wind_speed_10m: hours.map(() => 10)
    },
    daily: { time: [H0 - 86400, H0, H0 + 86400], temperature_2m_max: [21, 22, null], temperature_2m_min: [8, 9, 7], weather_code: [1, 2, 61] },
    minutely_15: { time: quarters, precipitation: quarters.map((t, i) => minutely[i] ?? 0), snowfall: quarters.map(() => 0) }
  };
}
const fixedTime = sec => { const d = new Date(sec * 1000); return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

console.log('\nRULE  an Open-Meteo answer becomes one shape');
{
  const fc = W.normalizeForecast(forecastFixture(), 123);
  ok(fc.tz === 'America/New_York' && fc.fetchedAt === 123, 'the place\'s own timezone is kept');
  ok(fc.current.temp === 20 && fc.current.isDay === true && fc.current.gust === 30, 'current conditions');
  ok(fc.hourly.length === 48 && fc.hourly[0].dew === null, 'a column the provider left out is null, not undefined or NaN');
  ok(fc.daily[2].hi === null && fc.daily[2].lo === 7, 'a missing value in a column is null');
  ok(W.upcomingHours(fc, NOW, 5)[0].t === H0, 'the hour list starts at the hour holding now');
  ok(W.upcomingDays(fc, NOW)[0].t === H0, 'yesterday rides along but is not a forecast day');
  const tr = W.pressureTrend(fc, NOW);
  ok(tr && tr.word === 'falling' && near(tr.change, -1.5), 'three hours of model pressure make a trend');
  let threw = false; try { W.normalizeForecast({}); } catch (e) { threw = true; }
  ok(threw, 'an empty answer is an error, not an empty forecast');
}

console.log('\nRULE  the rain sentence');
{
  const fc = W.normalizeForecast(forecastFixture());
  const o = W.rainOutlook(fc, NOW, 3, fixedTime);
  ok(o.state === 'dry' && o.text === 'Dry for at least 3 hours', 'nothing coming: "Dry for at least 3 hours"');

  const iffy = W.normalizeForecast(forecastFixture({ pop: () => 40 }));
  const oi = W.rainOutlook(iffy, NOW, 3, fixedTime);
  ok(oi.state === 'dry' && /^Probably dry/.test(oi.text) && oi.note === '40% chance of a shower', 'a dry model under a 40% chance says both');

  /* quarters are stamped at their END: index 3 is H0+1h, covering H0+45m..H0+1h */
  const wet = [0, 0, 0, 0, 0.3, 0.5, 0.4, 0, 0, 0];
  const s = W.rainOutlook(W.normalizeForecast(forecastFixture({ minutely: wet, pop: () => 80 })), NOW, 3, fixedTime);
  const start = H0 + 4 * 900, end = H0 + 7 * 900;
  ok(s.state === 'starting' && s.start === start && s.end === end, 'a shower is found from the quarter it starts to the quarter it ends');
  ok(s.text === `Rain likely ${fixedTime(start)}–${fixedTime(end)}`, `and said with its times: "${s.text}"`);

  const gap = [0, 0, 0, 0, 0.3, 0, 0.4, 0, 0, 0];
  ok(W.rainOutlook(W.normalizeForecast(forecastFixture({ minutely: gap })), NOW, 3, fixedTime).end === end, 'one dry quarter does not split a shower in two');

  const low = W.rainOutlook(W.normalizeForecast(forecastFixture({ minutely: wet, pop: () => 25 })), NOW, 3, fixedTime);
  ok(/slight chance/.test(low.text), 'a low probability softens the word');

  const now = W.rainOutlook(W.normalizeForecast(forecastFixture({ minutely: [0.5, 0.5, 0.2, 0, 0, 0] })), NOW, 3, fixedTime);
  ok(now.state === 'stopping' && now.text === `Rain ending around ${fixedTime(H0 + 3 * 900)}`, 'raining now and stopping');

  const all = W.rainOutlook(W.normalizeForecast(forecastFixture({ minutely: Array(32).fill(1) })), NOW, 3, fixedTime);
  ok(all.state === 'now' && all.text === 'Rain for at least the next 3 hours', 'raining past the edge of the window');

  const storm = W.rainOutlook(W.normalizeForecast(forecastFixture({ minutely: wet, code: t => t >= H0 + 3600 ? 95 : 2 })), NOW, 3, fixedTime);
  ok(storm.kind === 'storms' && /^Storms/.test(storm.text), 'a thunderstorm hour makes it "Storms"');

  const f = forecastFixture({ minutely: wet });
  f.minutely_15.snowfall = f.minutely_15.precipitation.map(p => p * 0.7);
  ok(W.rainOutlook(W.normalizeForecast(f), NOW, 3, fixedTime).kind === 'snow', 'snowfall (cm, ÷7×10 to water) makes it snow');

  const hourly = forecastFixture();
  delete hourly.minutely_15;
  hourly.hourly.precipitation = hourly.hourly.time.map(t => t === H0 + 3600 ? 2 : 0);
  const h = W.rainOutlook(W.normalizeForecast(hourly), NOW, 3, fixedTime);
  ok(h.state === 'starting' && h.start === H0 + 3600, 'with no 15-minute series the hourly one stands in');
}

console.log('\nRULE  feels like is the NWS\'s own arithmetic');
ok(near(W.cToF(W.feelsLike(W.fToC(90), 70, 5)), 105.9, 0.6), 'heat index: 90°F at 70% feels about 106°F');
ok(near(W.cToF(W.feelsLike(W.fToC(30), 50, 20 * 1.609344)), 17.4, 0.3), 'wind chill: 30°F in 20 mph feels about 17°F');
ok(W.feelsLike(15, 50, 10) === 15, 'in between, it feels like what it is');
ok(near(W.cToF(W.feelsLike(W.fToC(40), 50, 2 * 1.609344)), 40), 'no wind chill under 3 mph');
ok(W.feelsLike(null, 50, 10) === null, 'no temperature, no feels-like');

console.log('\nRULE  units are converted once, at the end');
ok(W.fmt.temp(0, 'us') === '32' && W.fmt.temp(0, 'metric') === '0' && W.fmt.temp(null, 'us') === '–', 'temperature');
ok(W.fmt.wind(16.09344, 'us') === '10' && W.fmt.wind(16, 'metric') === '16', 'wind');
ok(W.fmt.precip(25.4, 'us') === '1.00' && W.fmt.precip(0.1, 'us') === '<0.01' && W.fmt.precip(0, 'us') === '0.00', 'precipitation');
ok(W.fmt.pressure(1013.25, 'us') === '29.92' && W.fmt.pressure(1013.25, 'metric') === '1013', 'pressure');
ok(W.fmt.dist(16093.44, 'us') === '10' && W.fmt.dist(1609.344 * 2.5, 'us') === '2.5', 'distance');
/* Active (UI-REVIEW-2 item 3): the country's weather, ranked the way a chaser looks for it */
{
  const now = Date.UTC(2026, 9, 24, 0, 0), sq = (la, lo) => [[[lo, la], [lo + 0.5, la], [lo + 0.5, la + 0.5], [lo, la + 0.5], [lo, la]]];
  const L = W.activeList({
    warns: [
      { event: 'Flash Flood Warning', polygon: sq(32, -106), ends: now + 3600e3, sent: now - 60e3 },
      { event: 'Severe Thunderstorm Warning', polygon: sq(35, -97), ends: now + 1800e3, sent: now - 120e3 },
      { event: 'Tornado Warning', polygon: sq(35.2, -97.5), ends: now + 1200e3, sent: now - 300e3 },
      { event: 'Tornado Warning', polygon: sq(36, -96), ends: now - 60e3, sent: now - 3600e3 },
      { event: 'Flood Advisory', polygon: sq(30, -90), ends: now + 3600e3 }],
    mcds: [{ num: 1, polys: [sq(34, -98)], chance: 20 }, { num: 2, polys: [sq(36, -99)], chance: 80 }],
    watches: [{ type: 'SVR', num: 600, polys: [sq(33, -100)] }, { type: 'TOR', num: 601, polys: [sq(35, -98)] }],
    mpds: [{ num: 9, polys: [sq(32, -105)] }],
    cells: [{ id: 'A1', site: 'TLX', lat: 35.3, lon: -97.4, dbz: 62, hailIn: 1.5 }, { id: 'B2', site: 'FWS', lat: 33, lon: -97, dbz: 55, meso: 1 }, { id: 'C3', lat: 34, lon: -96, dbz: 45 }]
  }, now);
  const t = L.map((x) => x.kind === 'cell' ? 'cell ' + x.title.split(' ')[1] : x.title);
  ok(t[0] === 'Tornado Warning' && t[1] === 'Severe Thunderstorm Warning' && t[2] === 'Flash Flood Warning', `warnings first: tornado, severe, flash flood (${t.slice(0, 3).join(' | ')})`);
  ok(!L.some((x) => x.title === 'Flood Advisory') && L.filter((x) => x.title === 'Tornado Warning').length === 1, 'an advisory is not a warning, and an expired warning is gone');
  ok(L[0].mode === 'l3:srv' && L[1].mode === 'l3:ref' && L[2].mode === null, 'a tornado warning opens storm-relative velocity, a severe one reflectivity');
  ok(t.indexOf('Mesoscale Discussion 2') < t.indexOf('Mesoscale Discussion 1'), 'discussions by their chance of a watch');
  ok(t.indexOf('Tornado Watch 601') < t.indexOf('Severe Thunderstorm Watch 600'), 'a tornado watch before a severe one');
  ok(t.indexOf('cell B2') < t.indexOf('cell A1') && !t.includes('cell C3'), `storms: rotation before hail, and a weak one is left out (${t.filter((x) => x.startsWith('cell')).join(', ')})`);
  ok(L.find((x) => x.title === 'Tornado Warning').box.join() === '35.2,-97.5,35.7,-97', 'a warning carries the box to fit the map to');
  ok(W.activeList({}, now).length === 0, 'nothing active: an empty list');
}
/* Weather Pro's own set (B6): °C, knots, hPa — rain in inches and distance in miles, as the US set */
ok(W.UNITS.pro.temp === 'C' && W.UNITS.pro.wind === 'kt' && W.UNITS.pro.pressure === 'hPa' && W.UNITS.pro.precip === 'in' && W.UNITS.pro.dist === 'mi', 'Pro units: °C, kt, hPa, in, mi');
ok(W.fmt.temp(0, 'pro') === '0' && W.fmt.temp(30, 'pro') === '30', 'Pro units: temperature in °C');
ok(W.fmt.wind(18.52, 'pro') === '10' && W.fmt.wind(92.6, 'pro') === '50', 'Pro units: wind in knots (1 kt = 1.852 km/h)');
ok(W.fmt.pressure(1013.25, 'pro') === '1013', 'Pro units: pressure in hPa');
ok(W.fmt.precip(25.4, 'pro') === '1.00' && W.fmt.dist(16093.44, 'pro') === '10', 'Pro units: rain in inches, distance in miles');
{
  const MMu = require('../modelmaps.js');
  const [tn, tf] = MMu.unitFor('temp', 'pro'), [wn, wf] = MMu.unitFor('mph', 'pro'), [pn, pf] = MMu.unitFor('precip', 'pro');
  ok(tn === '°C' && Math.round(tf(212)) === 100, `a model's temperature in Pro units is °C (${tn})`);
  ok(wn === 'kt' && Math.round(wf(115.078)) === 100, `a model's wind in Pro units is knots (${wn})`);
  ok(pn === 'in' && pf(1) === 1 && MMu.unitFor('magl', 'pro')[0] === 'm' && MMu.unitFor('hpa', 'pro')[0] === 'hPa', 'rain stays inches, heights above ground in metres, pressure in hPa');
  ok(MMu.unitFor('temp', 'us')[0] === '°F' && MMu.unitFor('temp', 'metric')[0] === '°C' && MMu.unitFor('nosuch', 'pro')[0] === 'nosuch', 'the other sets are unchanged; an unknown unit passes through');
}
ok(W.compass(225) === 'SW' && W.compass(359) === 'N' && W.compass(-90) === 'W' && W.compass(null) === '', 'compass points');

console.log('\nRULE  an NWS observation is read by its units');
{
  const station = { id: 'KABC', name: 'Somewhere Airport', dist: 9000 };
  const o = W.normalizeObservation({ properties: {
    timestamp: '2026-10-17T18:53:00+00:00', textDescription: 'Light Rain and Fog',
    temperature: { unitCode: 'wmoUnit:degC', value: 21.7 }, dewpoint: { unitCode: 'wmoUnit:degC', value: 17.2 },
    windSpeed: { unitCode: 'wmoUnit:km_h-1', value: 18.36 }, windGust: { unitCode: 'wmoUnit:km_h-1', value: null },
    windDirection: { unitCode: 'wmoUnit:degree_(angle)', value: 230 },
    barometricPressure: { unitCode: 'wmoUnit:Pa', value: 101200 }, seaLevelPressure: { unitCode: 'wmoUnit:Pa', value: null },
    visibility: { unitCode: 'wmoUnit:m', value: 16090 }, relativeHumidity: { unitCode: 'wmoUnit:percent', value: 75.5 }
  } }, station);
  ok(o.station === 'KABC' && o.time === Date.parse('2026-10-17T18:53:00Z'), 'station and time');
  ok(o.temp === 21.7 && o.gust === null && o.pressure === 1012 && o.vis === 16090, 'Pa to hPa, a null gust stays null, sea level falls back to station pressure');
  ok(near(W.normalizeObservation({ properties: { timestamp: '2026-10-17T18:53:00Z', windSpeed: { unitCode: 'wmoUnit:m_s-1', value: 5 } } }).wind, 18), 'm/s is converted');
  ok(W.normalizeObservation({ properties: {} }) === null, 'no timestamp, no observation');
  ok(W.kindOfText(o.text) === 'rain' && W.kindOfText('Thunderstorms and Rain') === 'storm' && W.kindOfText('Partly Cloudy') === 'partly', 'its words become a picture');

  const fc = W.normalizeForecast(forecastFixture());
  const fresh = W.currentConditions(fc, o, o.time + 20 * 60e3);
  ok(fresh.from === 'observation' && fresh.temp.v === 21.7 && fresh.temp.src === 'obs', 'a recent observation is what "now" says');
  ok(fresh.gust.src === 'model' && fresh.gust.v === 30, 'a field the station left out comes from the model, marked so');
  ok(fresh.feels.src === 'derived' && fresh.kind === 'rain' && fresh.text === 'Light Rain and Fog', 'feels-like is computed, the picture follows the station');
  const old = W.currentConditions(fc, o, o.time + 3 * 3600e3);
  ok(old.from === 'model' && old.temp.v === 20 && old.temp.src === 'model', 'a three-hour-old observation is not "now" — the model is, and says so');
  ok(W.currentConditions(fc, null).from === 'model', 'no station at all (outside the US) is the model');
}

console.log('\nRULE  NWS points, stations, forecasts');
{
  const pt = W.normalizePoint({ properties: { gridId: 'ABC', forecast: 'https://api.weather.gov/gridpoints/ABC/45,60/forecast',
    observationStations: 'https://api.weather.gov/gridpoints/ABC/45,60/stations', radarStation: 'KABC', timeZone: 'America/New_York',
    relativeLocation: { properties: { city: 'Springfield', state: 'TN' } } } });
  ok(pt.office === 'ABC' && pt.city === 'Springfield, TN' && pt.radar === 'KABC', 'a point names its office, town and radar');
  ok(W.ROUTES.nws(pt.forecastUrl) && W.ROUTES.nws(pt.stationsUrl), 'and its links are ones the page may follow');
  const st = W.normalizeStations({ features: [
    { geometry: { coordinates: [-56.7, 12.3] }, properties: { stationIdentifier: 'KAAA', name: 'A' } },
    { geometry: null, properties: { name: 'no id' } }] }, 12.34, -56.78);
  ok(st.length === 1 && st[0].obsUrl.endsWith('/stations/KAAA/observations/latest') && st[0].dist > 9000 && st[0].dist < 11000, 'stations, with how far away each is');
  const hi = W.normalizeStations({ features: [{ geometry: { coordinates: [-56.7, 12.3] }, properties: { stationIdentifier: 'KBBB', name: 'B', elevation: { unitCode: 'wmoUnit:m', value: 2484 } } }] }, 12.34, -56.78)[0];
  ok(hi.elev === 2484 && !W.sameLevel(hi, 3240) && W.sameLevel(hi, 2600) && W.sameLevel(hi, null) && W.sameLevel(st[0], 3240),
    'a station 750 m below the place is not "now" there; within 300 m, or with either height unknown, it is');
  const per = W.normalizePeriods({ properties: { updateTime: '2026-10-17T15:00:00+00:00', periods: [
    { name: 'Tonight', startTime: '2026-10-17T18:00:00-04:00', endTime: '2026-10-18T06:00:00-04:00', isDaytime: false,
      temperature: 50, temperatureUnit: 'F', probabilityOfPrecipitation: { value: null }, windSpeed: '5 mph', windDirection: 'SW',
      shortForecast: 'Mostly Clear', detailedForecast: 'Mostly clear, with a low around 50.' }] } });
  ok(per.updated === Date.parse('2026-10-17T15:00:00Z') && near(per.periods[0].temp, 10) && per.periods[0].pop === null, 'office periods, in °C, a null chance kept null');
}

console.log('\nRULE  alerts are the NWS\'s, worst first, and gone when they end');
{
  const T = Date.parse('2026-10-17T20:00:00Z');
  const a = W.normalizeAlerts({ features: [
    { properties: { id: '1', event: 'Wind Advisory', severity: 'Moderate', onset: '2026-10-17T18:00:00Z', ends: '2026-10-18T00:00:00Z', messageType: 'Alert' } },
    { geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      properties: { id: '2', event: 'Tornado Warning', severity: 'Extreme', onset: '2026-10-17T19:55:00Z', expires: '2026-10-17T20:30:00Z', messageType: 'Alert' } },
    { properties: { id: '3', event: 'Flood Watch', severity: 'Severe', ends: '2026-10-17T19:00:00Z' } },
    { properties: { id: '4', event: 'Severe Thunderstorm Warning', severity: 'Severe', expires: '2026-10-17T21:00:00Z', messageType: 'Cancel' } }
  ] }, T);
  ok(a.map(x => x.id).join() === '2,1', 'expired and cancelled ones are dropped; the rest worst first');
  ok(a[0].tone === 'warning' && a[1].tone === 'advisory' && W.alertTone('Flood Watch') === 'watch', 'warning, watch, advisory');
  ok(a[0].polygon && a[0].polygon[0].length === 4 && a[1].polygon === null, 'the polygon comes with it when there is one');
}

console.log('\nRULE  places from a search');
{
  const p = W.normalizePlaces({ results: [
    { name: 'Paris', latitude: 48.85341, longitude: 2.3488, country_code: 'FR', country: 'France', admin1: 'Île-de-France' },
    { name: 'Paris', latitude: 33.66094, longitude: -95.55551, country_code: 'US', country: 'United States', admin1: 'Texas' },
    { name: 'Nowhere', latitude: 200, longitude: 0 }] });
  ok(p.length === 2 && p[0].lat === 48.85 && p[0].lon === 2.35, 'rounded the moment they arrive');
  ok(p[0].region === 'Île-de-France, France' && p[1].region === 'Texas', 'US places by state, the rest by country');
  ok(W.normalizePlaces({}).length === 0, 'no results is an empty list');
}

console.log('\nRULE  radar frames and how old things are');
ok(W.radarLayer(0) === 'nexrad-n0q-900913' && W.radarLayer(5) === 'nexrad-n0q-900913-m05m' && W.radarLayer(50) === 'nexrad-n0q-900913-m50m', 'IEM layer names');
ok(W.radarTile(10, 6, 16, 25, 'x') === 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913-m10m/6/16/25.png?_=x', 'tile URLs');
ok(W.RADAR_STEPS.length === 11 && W.RADAR_STEPS[0] === 50 && W.RADAR_STEPS.at(-1) === 0, 'fifty minutes, oldest first');
ok(W.radarValid({ meta: { valid: '2026-10-17T19:20:00Z' } }) === Date.parse('2026-10-17T19:20:00Z') && W.radarValid({}) === null, 'the composite\'s scan time');
ok(W.age(42e3) === '42s' && W.age(12 * 60e3) === '12 min' && W.age(125 * 60e3) === '2 h 5 min' && W.age(50 * 3600e3) === '2 days', 'ages read like a person would say them');
ok(W.fresh('radar', 0, 20 * 60e3).stale && !W.fresh('radar', 0, 5 * 60e3).stale, 'radar is stale after fifteen minutes');
ok(W.fresh('observation', null).stale, 'no time at all is stale, never live');

console.log('\nRULE  times are the place\'s, not the visitor\'s');
{
  const c = W.clock('America/Denver');
  const t = Date.parse('2026-10-17T21:00:00Z');
  ok(c.time(t) === '3:00 PM' && c.hour(t) === '3PM' && c.ymd(t) === '2026-10-17', '21:00Z is 3 PM in Denver');
  ok(W.clock('Not/AZone').time(t).length > 0, 'a timezone Intl does not know falls back rather than throwing');
}

console.log('\nRULE  a warning\'s storm, carried forward to now (storm mode)');
{
  const T = Date.parse('2026-10-17T21:00:00Z');
  const m = W.parseMotion('2026-10-17T21:00:00-00:00...storm...270DEG...30KT...12.30,-56.90');
  ok(m && m.from === 270 && m.kt === 30 && m.points.length === 1 && m.time === T, 'the TIME...MOT...LOC line is read: from 270°, 30 kt, one point');
  ok(W.parseMotion('nonsense') === null && W.parseMotion(undefined) === null, 'anything else is no track, not a guess');
  const line = W.parseMotion('2026-10-17T21:00:00-00:00...storm...270DEG...30KT...12.40,-56.90 12.20,-56.90');
  ok(line && line.points.length === 2, 'a line of storms has several points');

  /* the place is 0.1° (~10.9 km at this latitude) east of the storm, which is
     moving from the west at 30 kt (55.6 km/h): it arrives in about 11.7 minutes */
  const tr = W.stormTrack(m, 12.30, -56.80, T);
  ok(tr.state === 'approaching' && near(tr.km, 10.9, 0.2), `a storm 10.9 km west, coming this way: ${tr.state}, ${tr.km.toFixed(1)} km`);
  ok(near(tr.bearing, 270, 1) && near(tr.toward, 90) && near(tr.kmh, 55.56, 0.01), 'it is to the west, heading east, at 55.6 km/h');
  ok(near((tr.eta - T) / 60e3, 11.7, 0.3), `and arrives in about ${((tr.eta - T) / 60e3).toFixed(1)} minutes`);
  const later = W.stormTrack(m, 12.30, -56.80, T + 6 * 60e3);
  ok(near(later.km, 10.9 - 55.56 * 0.1, 0.2) && near((later.eta - T) / 60e3, 11.7, 0.3), 'six minutes on, it is closer and the arrival time has not moved');
  ok(W.stormTrack(m, 12.30, -57.00, T).state === 'away', 'a place behind the storm: moving away');
  const side = W.stormTrack(m, 12.45, -56.80, T);
  ok(side.state === 'passing' && near(side.passKm, 16.6, 0.5) && side.eta === null, `a place 16 km off its path: passing ${side.passKm.toFixed(1)} km away, no arrival time`);
  ok(W.stormTrack(m, 12.30, -56.89, T).state === 'over', 'within 3 km: over you');
  const sweep = W.stormTrack(line, 12.31, -56.80, T);
  ok(sweep.state === 'approaching' && near((sweep.eta - T) / 60e3, 11.7, 0.4), 'a line sweeping over the place arrives when it reaches it, not at its nearest end');
  ok(W.stormTrack(m, 12.30, -55.00, T).state === 'away', 'a storm that would take hours to arrive is not "approaching"');
  ok(W.stormTrack(null, 1, 1) === null, 'no motion line, no track');
}

console.log('\nRULE  warning details are the NWS\'s own parameters');
{
  const d = W.alertDetail({ event: 'Tornado Warning', headline: 'x', description: '...TORNADO EMERGENCY FOR SOMEWHERE...',
    parameters: { tornadoDetection: ['OBSERVED'], tornadoDamageThreat: ['CATASTROPHIC'], maxHailSize: ['1.75'], maxWindGust: ['70 MPH'],
      eventMotionDescription: ['2026-10-17T21:00:00-00:00...storm...240DEG...25KT...12.3,-56.9'] } });
  ok(d.storm && d.detection === 'OBSERVED' && d.emergency && d.hail === 1.75 && d.gust === 70 && d.motion.from === 240, 'observed, emergency, hail, gust, motion');
  const w = W.alertDetail({ event: 'Wind Advisory', parameters: {} });
  ok(!w.storm && !w.emergency && w.motion === null && w.hail === null, 'an advisory is not a storm warning');
  const ring = [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]];
  ok(W.inPolygon(1, 1, ring) && !W.inPolygon(3, 1, ring) && !W.inPolygon(1, 1, null), 'inside a warning polygon or not');
}

console.log('\nRULE  the sentence at the top says only what the numbers say');
{
  const c = { hour: ms => new Date(ms).getUTCHours() + 'h', time: ms => new Date(ms).toISOString().slice(11, 16) };
  const fT = c2 => String(Math.round(c2 * 9 / 5 + 32)), fW = k => String(Math.round(k / 1.609));
  const base = forecastFixture();
  const said = f => W.summary(W.normalizeForecast(f), NOW, c, fT, fW, 'mph');
  ok(/^Steady conditions/.test(said(base)), `nothing happening: "${said(base)}"`);
  const rain = forecastFixture({ pop: t => t >= H0 + 5 * 3600 ? 80 : 10, code: t => t >= H0 + 5 * 3600 ? 61 : 2 });
  ok(said(rain).startsWith(`Rain likely around ${new Date((H0 + 5 * 3600) * 1000).getUTCHours()}h.`), `rain later today, from the hourly forecast: "${said(rain)}"`);
  const raining = forecastFixture({ minutely: [0.5, 0.5, 0.4, 0, 0, 0], pop: t => t < H0 + 2 * 3600 ? 90 : 0, code: () => 61 });
  ok(/^Rain ending around/.test(said(raining)), `raining now, from the 15-minute data the line above uses: "${said(raining)}"`);
  const soon = forecastFixture({ minutely: [0, 0, 0, 0, 0.3, 0.5, 0.4], pop: () => 80 });
  const fcSoon = W.normalizeForecast(soon);
  ok(said(soon).startsWith(W.rainOutlook(fcSoon, NOW, 3, s => c.time(s * 1000)).text), 'rain in the next three hours is said exactly as the rain line says it');
  const clearing = forecastFixture({ code: t => t >= H0 + 2 * 3600 ? 0 : 3 });
  clearing.hourly.is_day = clearing.hourly.time.map(() => 1);
  ok(/^Sunny conditions expected around/.test(said(clearing)), `clearing: "${said(clearing)}"`);
  const windy = forecastFixture(); windy.hourly.wind_gusts_10m = windy.hourly.time.map(() => 56);
  ok(/Gusts up to 35 mph\./.test(said(windy)), `gusty: "${said(windy)}"`);
  const colder = forecastFixture(); colder.daily.temperature_2m_max = [21, 22, 15];
  ok(/Tomorrow colder, with a high of 59°\./.test(said(colder)), `a cold front tomorrow: "${said(colder)}"`);
  const fc = W.normalizeForecast(colder);
  {
    const raw = 'Long wave ridging continues across Oklahoma and Texas today, with a\npronounced long wave trough through California.\nThis feature has\nhelped bring storms.\n\n- Above normal temperatures\n- dry conditions\n\nOKC  80  54  82 /   0   0   0\nlater today  0   0';
    const re = W.reflowDiscussion(raw);
    ok(/today, with a pronounced long wave trough/.test(re) && /This feature has helped bring storms\./.test(re), 'the discussion: a wrapped sentence is one line again');
    ok(re.replace(/\s+/g, ' ') === raw.replace(/\s+/g, ' '), 'the discussion: not a word added, dropped or changed');
    ok(/\n- dry conditions/.test(re) && /\nOKC  80/.test(re) && /\nlater today  0/.test(re), 'the discussion: lists and tables stay as issued');
  }
  const vy = W.versusYesterday(fc, NOW);
  ok(vy && near(vy.diff, 1), `today against yesterday: ${vy && vy.diff}`);
  const rt = W.rainTotals(W.normalizeForecast(forecastFixture()), NOW);
  ok(rt.past === 0 && rt.next === 0, 'rain totals for the last and next 24 hours');
}

console.log('\nRULE  how sure: the models\' own agreement');
{
  const day = 1_800_000_000 - (1_800_000_000 % 86400);
  const mk = (highs, rains) => {
    const hours = new Map();
    for (let h = 0; h < 24; h++) {
      const row = {};
      W.ENSEMBLE.forEach((m, i) => { row[m] = { t: highs[i] - (h === 15 ? 0 : 5), p: h === 18 ? rains[i] : 0, w: 10 }; });
      hours.set(day + h * 3600, row);
    }
    return { hours };
  };
  const agree = W.dayConfidence(mk([20, 20.5, 21, 20, 21.5], [0, 0, 0, 0, 0]), day);
  ok(agree.level === 'high' && near(agree.spread, 1.5), 'five models within 1.5 °C and all dry: confident');
  const split = W.dayConfidence(mk([18, 19, 24, 20, 23], [0, 3, 0, 5, 0]), day);
  ok(split.level === 'low' && split.rainSplit && split.rainModels === 2, 'highs 6 °C apart and two of five wet: models disagree');
  ok(W.dayConfidence(null, day) === null, 'no ensemble, no claim');
  const j = { timezone: 'X', hourly: { time: [day], temperature_2m_ncep_hrrr_conus: [10], precipitation_ncep_hrrr_conus: [0], temperature_2m_gfs_global: [null] } };
  const e = W.normalizeEnsemble(j);
  ok(e.hours.get(day).hrrr.t === 10 && !e.hours.get(day).gfs, "a model with nothing for an hour is left out of that hour");
  ok(W.iemId('KTYS') === 'TYS' && W.iemId('PANC') === 'ANC' && W.iemId('0A9') === '0A9', 'NWS ICAO ids to IEM airport ids');
  const rec = (mae, days) => ({ 1: { td: [0, mae, 100], tn: [0, mae, 100], w: [0, 1, 1], p: [0, 0, 0, 0], pd: [0, 0], days } });
  const v = W.verdict({ models: { best: rec(1.6, 20), blend: rec(1.2, 20), gfs: rec(2, 20), ecmwf: rec(1.3, 3) } }, 7);
  ok(v.useBlend && v.best.m === 'blend' && !v.rows.some(r => r.m === 'ecmwf'), 'the blend is used where its record beats the baseline; a 3-day record is not ranked');
  ok(!W.verdict({ models: { best: rec(1.2, 20), blend: rec(1.21, 20) } }, 7).useBlend, 'a tie is not a win: the baseline stays');
  const L = { t: new Array(10).fill(0) };
  ok(W.verdict({ models: { best: rec(1.6, 20), blend: rec(1.3, 20), learn: rec(1.0, 15) }, learned: L }, 7).use === 'learn', 'the learned forecast is used where its record is the best of ours');
  ok(W.verdict({ models: { best: rec(1.6, 20), blend: rec(1.3, 20), learn: rec(1.0, 15) }, learned: null }, 7).use === 'blend', 'but never without its published coefficients');
  ok(W.verdict({ models: { best: rec(1.6, 20), learn: rec(1.0, 5) }, learned: L }, 7).use === 'best', 'nor on a record too short to trust');
  ok(W.verdict({ models: { best: rec(1.6, 20), blend: rec(1.3, 20), nbm: rec(1.1, 20) } }, 7).use === 'nbm', 'a model the page holds hourly is picked where its record is best');
  ok(W.verdict({ models: { best: rec(1.6, 20), blend: rec(1.3, 20), pangu: rec(0.9, 20) } }, 7).use === 'blend', 'but never one the page cannot draw (Pangu): it is ranked, not shown');
  ok(W.verdict({ models: { best: rec(1.6, 20), nbm: rec(1.1, 20) } }, 7, ['hrrr']).use === 'best', 'nor a model this place has no hours of');
}

console.log('\nRULE  stations on the map: their own readings, in the page\'s units, and only fresh ones');
{
  const T = Date.parse('2026-10-21T12:00:00Z');
  const ft = (props, coords = [-56.7, 12.3]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: props });
  const s = W.normalizeStationObs({ features: [
    ft({ station: 'AAA', name: 'SOME  FIELD', utc_valid: '2026-10-21T11:56:00Z', tmpf: 50, dwpf: 32, relh: 50, sknt: 10, drct: 270, gust: 0, vsby: 10, mslp: 1012.5, skyc1: 'FEW', skyc2: 'OVC', wxcodes: '-RA', phour: 0.1, raw: 'KAAA 211156Z …' }),
    ft({ station: 'OLD', utc_valid: '2026-10-21T09:00:00Z', tmpf: 50 }),
    ft({ station: 'EMPTY', utc_valid: '2026-10-21T11:50:00Z' }),
    ft({ station: 'NOWHERE', utc_valid: '2026-10-21T11:50:00Z', tmpf: 50 }, null)
  ] }, T);
  ok(s.length === 1 && s[0].id === 'AAA', 'an old reading, an empty one and one with no position are left off');
  const a = s[0];
  ok(near(a.temp, 10) && near(a.dew, 0) && near(a.wind, 18.52) && a.gust === null && near(a.vis, 16093, 1) && near(a.precipHour, 2.54),
    '°F to °C, knots to km/h, miles to metres, inches to mm; a gust of 0 is no gust');
  ok(a.sky === 'Overcast' && a.wx === '-RA' && a.name === 'SOME FIELD', 'the sky is the thickest layer reported; weather codes kept as reported');
  ok(W.ROUTES.stationObs('abc') === null && W.ROUTES.stationObs('ABCD') === null, 'only a three-letter office is ever asked for');
}

console.log('\nRULE  the ensemble: every run its own line, and the days counted from the runs');
{
  const D = 1_800_000_000 - (1_800_000_000 % 86400);
  const time = Array.from({ length: 48 }, (_, i) => D + i * 3600);
  const hourly = { time };
  /* five GEFS runs and five ECMWF ones: highs 10…14 °C on day one, and the
     wet ones rain 2 mm at noon on day two */
  for (const [set, base] of [['ncep_gefs025', 0], ['ecmwf_ifs025_ensemble', 5]]) {
    for (let m = 0; m < 5; m++) {
      const sfx = (m ? `_member${String(m).padStart(2, '0')}` : '') + '_' + set;
      hourly['temperature_2m' + sfx] = time.map((t, i) => (i % 24 === 15 ? 10 + m : 5));
      hourly['precipitation' + sfx] = time.map((t, i) => (i === 36 && (base + m) % 2 === 0 ? 2 : 0));
    }
  }
  hourly.temperature_2m_member09_ncep_gefs025 = time.map(() => null);      // a member with nothing
  const pl = W.normalizePlumes({ hourly, timezone: 'X' });
  ok(pl.members.length === 10 && pl.members.filter(m => m.set === 'GEFS').length === 5, 'every member, control included, sorted into its ensemble; an empty member left out');
  const st = W.plumeStats(pl, [D, D + 86400]);
  /* the ten runs' highs are 10, 10, 11, 11 … 14, 14 */
  ok(near(st.days[0].hi10, 10) && near(st.days[0].hi50, 12) && near(st.days[0].hi90, 14), "a day's highs: 10th, 50th and 90th percentile of the runs' own highs");
  ok(st.days[0].wet === 0 && st.days[1].wet === 0.5, 'chance of rain is the share of runs with 1 mm or more that day');
  ok(W.quantile([3, 1, 2], 0.5) === 2 && W.quantile([], 0.5) === null, 'quantiles, and none of nothing');
  ok(W.normalizePlumes({}) === null && W.plumeStats(null, []) === null, 'no ensemble, no claim');
}

console.log('\nRULE  replay: the archive by its own names, and the warnings as they stood');
{
  const t = Date.UTC(2011, 3, 27, 21, 7, 30);
  ok(W.archiveStamp(t) === '201104272105' && W.archiveProduct(t) === 'N0Q' && W.archiveProduct(Date.UTC(2008, 5, 1)) === 'N0R',
    'a time floors to its five minutes; N0Q from 2011, N0R before');
  ok(W.archiveTile(t, 6, 17, 25).endsWith('/ridge::USCOMP-N0Q-201104272105/6/17/25.png'), 'the tile name IEM\'s own viewer uses');
  ok(W.ROUTES.sbwArchive('2011-04-27T20:00Z', '2011-04-28T09:00Z') === null && W.ROUTES.sbwArchive('2011-04-27T20:00Z', '2011-04-27T19:00Z') === null && W.ROUTES.sbwArchive('x', 'y') === null,
    'a window longer than twelve hours, backwards, or not a time is never asked for');
  const w = W.normalizeSbw({ features: [
    { geometry: { type: 'MultiPolygon', coordinates: [[[[-56.7, 12.3], [-56.6, 12.3], [-56.6, 12.4], [-56.7, 12.3]]]] },
      properties: { event_label: 'Tornado Warning', ph_sig: 'TO.W', nws_color: '#FF0000', utc_issue: '2011-04-27T20:00:00Z', utc_expire: '2011-04-27T20:30:00Z',
        utc_polygon_begin: '2011-04-27T20:00:00Z', utc_polygon_end: '2011-04-27T20:08:00Z', locations: 'Somewhere', wfo: 'ABC' } },
    { geometry: null, properties: { event_label: 'No shape' } }] });
  ok(w.length === 1 && w[0].end === Date.parse('2011-04-27T20:08:00Z') && w[0].polys.length === 1 && w[0].color === '#FF0000',
    'each version of a polygon keeps its own minutes; a warning with no shape is left out');
  /* the NWS down: the storm warnings in force over a point, from IEM's copy */
  const ring = [[-56.7, 12.3], [-56.6, 12.3], [-56.6, 12.4], [-56.7, 12.4], [-56.7, 12.3]];
  const rows = [
    { event: 'Tornado Warning', sig: 'TO.W', wfo: 'ABC', area: 'A', begin: 1000, end: 5000, polys: [[ring]] },
    { event: 'Tornado Warning', sig: 'TO.W', wfo: 'ABC', area: 'A', begin: 2000, end: 4000, polys: [[ring]] },
    { event: 'Severe Thunderstorm Warning', sig: 'SV.W', wfo: 'ABC', area: 'B', begin: 1000, end: 2500, polys: [[ring]] },
    { event: 'Flash Flood Warning', sig: 'FF.W', wfo: 'ABC', area: 'C', begin: 1000, end: 5000, polys: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] }];
  const b = W.backupAlerts(rows, 12.35, -56.65, 3000);
  ok(b.length === 1 && b[0].event === 'Tornado Warning' && b[0].ends === 4000 && b[0].backup && b[0].storm && b[0].tone === 'warning' && b[0].polygon === rows[1].polys[0],
    'the newest version of each warning in force here, marked as the backup; an expired one and one elsewhere are left out');
}

console.log('\nRULE  a cross-section: points evenly along the line, one column each');
{
  const pts = W.linePoints({ lat: 12, lon: -56 }, { lat: 14, lon: -52 }, 5);
  ok(pts.length === 5 && pts[0].lat === 12 && pts[4].lon === -52 && pts[2].lat === 13 && pts[2].lon === -54, 'evenly spaced, ends included');
  ok(W.ROUTES.xsec('hrrr', W.linePoints({ lat: 12.345, lon: -56 }, { lat: 14, lon: -52 }, 12))[1].includes('latitude=12.35%2C'), 'every point rounded like any place');
  ok(W.ROUTES.xsec('nam', pts) === null && W.ROUTES.xsec('hrrr', pts.slice(0, 1)) === null && W.ROUTES.xsec('hrrr', W.linePoints(pts[0], pts[4], 17)) === null,
    'only the listed models, and 2 to 16 points');
  const col = (t) => ({ hourly: Object.fromEntries([['time', [1, 2]], ['surface_pressure', [1000, 990]],
    ...W.XSEC_LEVELS.flatMap(p => [[`temperature_${p}hPa`, [t, t]], [`relative_humidity_${p}hPa`, [50, null]], [`wind_speed_${p}hPa`, [10, 10]], [`geopotential_height_${p}hPa`, [100, 100]]])]) });
  const x = W.normalizeXsec([col(5), col(6)], pts.slice(0, 2));
  ok(x && x.cols.length === 2 && x.cols[1].lv[850].t[0] === 6 && x.cols[0].lv[500].rh[1] === null && x.km > 110 && x.km < 130,      // 0.5° of latitude and 1° of longitude at 12° N: ~121 km
    'one column per point, a missing value kept missing, the distance along the line in km');
  ok(W.normalizeXsec([{}], pts) === null, 'an answer with no hours is no section');
}

console.log('\nRULE  two pages, one room: Weather for everyone, Weather Pro for the depth');
{
  const fs = await import('node:fs');
  const root = new URL('../../../', import.meta.url);
  const read = f => fs.readFileSync(new URL(f, root), 'utf8');
  const simple = read('weather.html'), pro = read('weather-pro.html'), app = read('assets/weather/app.js');
  let parses = true; try { new Function(app); } catch (e) { parses = false; }
  ok(parses, 'the shared page code parses');
  ok(/data-view="simple"/.test(simple) && /data-view="pro"/.test(pro), 'each page says which it is');
  ok(['next', 'hourly', 'daily', 't-wind'].every(id => simple.includes(`id="${id}"`) && !pro.includes(`id="${id}"`)), 'the everyday cards are on Weather only');
  ok(['sky', 'models', 'record'].every(id => pro.includes(`id="${id}"`) && !simple.includes(`id="${id}"`)), 'the sounding, the models and the record are on Weather Pro only');
  ok(['storms', 'alerts', 'nearby', 'national', 'radarcard'].every(id => simple.includes(`id="${id}"`) && pro.includes(`id="${id}"`)), 'warnings and the radar are on both — a warning reaches people who never open Pro');
  ok(/class="probtn" href="weather-pro.html"/.test(simple) && /class="backbtn" href="weather.html"/.test(pro), 'Weather opens Pro by its gold star button, and Pro goes back');
  ok(/WEATHER<b>PRO<\/b>/.test(pro) && !/viewtabs/.test(simple + pro), 'two products, each its own wordmark — not one page with a switch');
  ok([simple, pro].every(p => p.includes('assets/weather/app.js') && p.includes('assets/visit.js')), 'both load the shared code and count visits');
  ok(![simple, pro, app, read('projects/weather/wx.js')].some(s => /ride outlook|rideOutlook/i.test(s)),
    'no ride outlook anywhere — Ric, 2026-10-21: "this should be information, not something that could make it unsafe"');
  /* Weather's settings, scene and climbing card (2026-10-25) — Weather's alone */
  ok(['settings', 'climb', 'scene', 'more'].every(id => simple.includes(`id="${id}"`) && !pro.includes(`id="${id}"`)) && simple.includes('assets/weather/scene.js') && !pro.includes('scene.js'),
    'the settings sheet, the climbing card, the details fold and the scene are on Weather only');
  {
    /* Ric, 2026-10-25: "I don't want good or bad to go. Just the measurements" */
    const body = (app.match(/function renderClimb\(\) \{[\s\S]*?\n  \}\n/) || [''])[0].replace(/\/\*[\s\S]*?\*\//g, '');
    ok(body.length > 2000 && !/\b(good|bad|ideal|perfect|prime|great|poor|safe|unsafe|send|go|no-go|recommend\w*|should)\b/i.test(body),
      'the climbing card says measurements only — no good or bad, no verdict, no advice');
  }
  ok(/past_days: '3'/.test(read('projects/weather/wx.js')) && /past_days: '3'/.test(read('worker/worker.mjs')), 'the page and the Worker both ask for three days of the past (the climbing card\'s rain)');
  {
    /* the scenes (2026-10-25): Ric — "if its cloudy the picture should have it be cloudy". Every
       photo has its thumb and the sky mask cloud is drawn through, and none carries EXIF (hard rule 1) */
    const scene = read('assets/weather/scene.js');
    const ids = [...scene.matchAll(/scenePhoto\("([a-z]+)"/g)].map(m => m[1]);
    const dir = 'assets/weather/scenes/';
    ok(ids.length >= 7 && ids.every(id => [`${id}.jpg`, `${id}-thumb.jpg`, `${id}-sky.png`].every(f => fs.existsSync(new URL(dir + f, root)))),
      `every photo scene has its photo, thumb and sky mask (${ids.join(', ')})`);
    ok(ids.every(id => [`${id}-1600.jpg`, `${id}-flat-1600.jpg`, `${id}-plants.png`].every(f => fs.existsSync(new URL(dir + f, root)))) && fs.existsSync(new URL(dir + 'beach-shore.png', root)),
      'every photo scene has its phone-size copies and its plant map (sway, seasons); the beach its shore map (the swash)');
    {
      const night = JSON.parse(fs.readFileSync(new URL('assets/weather/skies/night.json', root), 'utf8'));
      const items = [...night.bolts, night.stars, night.moon];
      ok(night.bolts.length >= 3 && items.every(x => fs.existsSync(new URL('assets/weather/skies/' + x.file, root)) && /^https:\/\/commons\.wikimedia\.org\//.test(x.url) && /^(CC BY \d|CC0|public domain)/i.test(x.licence) && !/SA/.test(x.licence)),
        'the real lightning, Milky Way and moon are on disk, from Commons, under licences that ask only for credit');
    }
    ok(ids.every(id => [`${id}-depth.png`, `${id}-flat.jpg`].every(f => fs.existsSync(new URL(dir + f, root)))),
      'every photo scene has its depth map and its overcast-light version (haze by distance, cloud shadows, no sunlit rock under a storm)');
    /* the pictures' own life (2026-10-25): Ric — "the ocean will have the water moving the city will have lights flickering" */
    const wet = (scene.match(/const WET = new Set\(\[([^\]]*)\]\)/) || [, ''])[1].match(/[a-z]+/g) || [];
    const glow = Object.keys(Function(`return ${(scene.match(/const GLOW = (\{[^}]*\})/) || [, '{}'])[1]}`)());
    const lights = glow.map(id => { try { return JSON.parse(fs.readFileSync(new URL(`${dir}${id}-lights.json`, root), 'utf8')); } catch { return null; } });
    ok(wet.length >= 3 && wet.every(id => fs.existsSync(new URL(`${dir}${id}-water.png`, root))),
      `every scene with moving water has its water map (${wet.join(', ')})`);
    ok(glow.length && lights.every(j => j && j.windows.length > 500 && j.tops.length && [...j.windows, ...j.tops].every(([u, v]) => u >= 0 && u <= 1 && v >= 0 && v <= 1)),
      `every city scene has its windows and tower tops mapped inside the photo (${glow.join(', ')})`);
    /* the real skies (2026-10-25): Ric — "i dont want people to be able to tell they are ai generated. and they have to move" */
    const skyIds = [...new Set([...scene.slice(scene.indexOf('function skyChoice'), scene.indexOf('function skyGrade')).matchAll(/"(clear|fair|grey|rain|storm|sunset|dusk)"/g)].map(m => m[1]))];
    const skies = JSON.parse(fs.readFileSync(new URL('assets/weather/skies/skies.json', root), 'utf8'));
    ok(skyIds.length === 7 && skyIds.every(id => ['webm', 'mp4', 'jpg'].every(e => fs.existsSync(new URL(`assets/weather/skies/${id}.${e}`, root)))),
      `every real sky the scene can pick has its WebM, its H.264 for Safari and its still (${skyIds.join(', ')})`);
    ok(skyIds.every(id => skies[id] && skies[id].by && /^https:\/\/commons\.wikimedia\.org\//.test(skies[id].url) && /^(CC BY \d|CC0|public domain)/i.test(skies[id].licence) && !/SA/.test(skies[id].licence)),
      'every real sky is credited to its maker on Commons, under a licence that asks only for credit');
    /* Ric, 2026-10-26: "make them higher quality remember no ai should be able to
       tell an ai did it" — a sky cropped to a strip, or a 720p clip, is
       stretched to fill a big screen and reads as soft and fake */
    const thin = Object.entries(skies).filter(([, s]) => s.w < 1920 || s.h < 560).map(([id, s]) => `${id} ${s.w}×${s.h}`);
    ok(!thin.length, `every real sky is at least 1920 wide and 560 tall${thin.length ? ' — not ' + thin.join(', ') : ''}`);
    const exif = [...ids.flatMap(id => [`${id}.jpg`, `${id}-1600.jpg`, `${id}-thumb.jpg`, `${id}-flat.jpg`, `${id}-flat-1600.jpg`]), '../skies/stars.jpg'].filter(f => fs.readFileSync(new URL(dir + f, root)).subarray(0, 65536).includes('Exif\0'));
    ok(exif.length === 0, `no scene photo carries EXIF, so no GPS (${exif.join(', ') || 'none'})`);
    ok(!/WxScene\.preview/.test(app) && /gust: c\.gust\.v/.test(app),
      'the page never previews a weather — the scene shows only the reading, gusts included');
    ok(simple.indexOf('assets/weather/astro.js') > 0 && simple.indexOf('assets/weather/astro.js') < simple.indexOf('assets/weather/scene.js') && /lat: S\.place\.lat, lon: S\.place\.lon/.test(app),
      'the scene has the place and astro.js before it — the sun, moon, day and night are where the visitor is');
  }
  /* Pro's keys (2026-10-23): every product key opens a button that is on the page, and the sheet lists every key */
  const km = app.match(/const KEYMODES = (\{[^}]*\})/), keys = km ? Function(`return ${km[1]}`)() : {};
  const sheet = (pro.match(/<dl class="keys">([\s\S]*?)<\/dl>/) || [])[1] || '';
  ok(Object.keys(keys).length >= 8 && Object.values(keys).every(m => pro.includes(`data-mode="${m}"`)), 'each product key presses a layer button Weather Pro has');
  ok(Object.keys(keys).every(k => sheet.includes(`<kbd>${k.toUpperCase()}</kbd>`)) && ['L', 'W', 'F', '?'].every(k => sheet.includes(`<kbd>${k}</kbd>`)), 'the keys sheet lists every key the page answers');
}

console.log('\nRULE  Weather Pro\'s overlays: as issued, and gone when they end');
{
  const T = Date.parse('2026-10-22T03:00:00Z');
  const sq = [[[-56.8, 12.3], [-56.6, 12.3], [-56.6, 12.5], [-56.8, 12.3]]];
  const w = W.normalizeWatches({ features: [
    { geometry: { type: 'MultiPolygon', coordinates: [sq] }, properties: { type: 'TOR', num: 688, utc_issued: '2026-10-22T01:00:00Z', utc_expired: '2026-10-22T09:00:00Z' } },
    { geometry: { type: 'Polygon', coordinates: sq }, properties: { type: 'SVR', num: 12, utc_issued: '2026-10-21T01:00:00Z', utc_expired: '2026-10-21T09:00:00Z' } }] }, T);
  ok(w.length === 1 && w[0].title === 'Tornado Watch 688' && w[0].url.endsWith('/watch/2026/ww0688.html'), 'a live watch with its number and SPC page; an expired one is gone');
  const md = W.normalizeDiscussions({ features: [{ geometry: { type: 'Polygon', coordinates: sq }, properties: { num: 2390, year: 2026, issue: '2026-10-22T02:30:00Z', expire: '2026-10-22T04:00:00Z', watch_confidence: 40, concerning: 'SEVERE POTENTIAL…WATCH POSSIBLE' } }] }, 'mcd', T);
  ok(md.length === 1 && md[0].chance === 40 && md[0].url.endsWith('/md/2026/md2390.html') && md[0].concerning.includes('WATCH POSSIBLE'), 'a mesoscale discussion keeps its chance of a watch and its own words');
  const c = W.normalizeCells({ features: [
    { geometry: { type: 'Point', coordinates: [-56.7, 12.3] }, properties: { nexrad: 'ABC', storm_id: 'W1', max_dbz: 62, top: 45.4, meso: '3', tvs: 'NONE', poh: 90, posh: 60, max_size: 1.75, drct: 240, sknt: 35, valid: '2026-10-22T02:55:00Z' } },
    { geometry: { type: 'Point', coordinates: [-56.7, 12.3] }, properties: { nexrad: 'ABC', storm_id: 'X9', valid: '2026-10-22T02:00:00Z' } }] }, T);
  ok(c.length === 1 && c[0].meso === '3' && c[0].tvs === null && c[0].from === 240 && c[0].topKft === 45.4, 'a storm cell keeps what the radar measured; "NONE" is no detection; a stale cell is dropped');
  /* local storm reports, in the shape IEM's lsr.geojson answered on 2026-10-22 */
  const rep = (type, typetext, extra = {}) => ({ geometry: { type: 'Point', coordinates: [-56.7, 12.3] },
    properties: { wfo: 'ABC', type, typetext, valid: '2026-10-22T02:30:00Z', city: '3 N Nowhere', county: 'Imaginary', st: 'XX', source: 'Trained Spotter', remark: null, unit: null, magf: null, magnitude: '', ...extra } });
  const lsr = W.normalizeReports({ features: [
    rep('T', 'TORNADO'), rep('H', 'HAIL', { magf: 1.75, magnitude: '1.75', unit: 'Inch', qualifier: 'M' }), rep('H', 'HAIL', { magf: 0.5, unit: 'Inch' }),
    rep('G', 'TSTM WND GST', { magf: 61, unit: 'MPH' }), rep('N', 'NON-TSTM WND GST', { magf: 70, unit: 'MPH' }), rep('D', 'TSTM WND DMG'),
    rep('F', 'FLASH FLOOD'), rep('R', 'RAIN', { magf: 0.5, unit: 'Inch' }), rep('S', 'SNOW', { magf: 4, unit: 'Inch' }), rep('x', 'LANDSLIDE'),
    rep('T', 'TORNADO', { valid: '2026-10-20T02:30:00Z' })] }, T);
  ok(lsr.length === 10, 'the last day\'s reports, and one from two days ago dropped');
  ok(lsr.map(r => r.kind).join() === 'tor,hail,hail,wind,wind,wind,flood,rain,snow,other', 'each report sorted into its kind');
  ok(lsr.filter(r => r.severe).length === 5 && lsr[1].severe && !lsr[2].severe && lsr[3].severe && !lsr[4].severe && lsr[5].severe,
    'severe by the NWS thresholds: a tornado, 1.75" hail (not 0.5"), a 61 mph thunderstorm gust and damage — not a 70 mph non-thunderstorm gust');
  ok(lsr[1].mag === 1.75 && lsr[1].unit === 'Inch' && lsr[1].qualifier === 'measured' && lsr[0].source === 'Trained Spotter', 'magnitude, unit, measured or estimated, and who reported it');
  ok(W.decodePoint('1230567')[0] === 12.3 && W.decodePoint('1230567')[1] === -56.7 && W.decodePoint('951234')[0] === 9.5 && W.decodePoint('12x4567') === null, 'a coded point is latitude and west longitude in tenths');
  const s = W.parseCodsus('CODSUS\nCODED SURFACE FRONTAL POSITIONS\nVALID 102200Z\nHIGHS 1027 1230567 1031\n1250560\nLOWS 998 1200580\nCOLD 1200580 1180585 1150590\nWARM 1200580 1210570\nTROF 1300500\n$$', Date.parse('2026-10-22T01:36:00Z'));
  ok(s.valid === Date.parse('2026-10-22T00:00:00Z') && s.highs.length === 2 && s.highs[1].mb === 1031 && s.lows[0].mb === 998,
    'the analysis time, and highs and lows with their pressures — across a line break');
  ok(s.fronts.length === 2 && s.fronts[0].kind === 'COLD' && s.fronts[0].pts.length === 3 && s.fronts[1].kind === 'WARM', 'each front a line of points; a one-point trough is no line');
  ok(W.ROUTES.nwsProducts('AFD') === null && W.ROUTES.nwsProducts('XYZ') === null && W.ROUTES.nwsProduct('../x') === null, 'only the coded analysis, an office\'s discussion, and a product by its id');
}

console.log('\nRULE  calm is calm, not "N 0"');
ok(W.isCalm(0) && W.isCalm(1.2) && !W.isCalm(1.6) && !W.isCalm(null), 'under 1.5 km/h is calm; no reading is not calm');

console.log('\nRULE  satellite tiles come from the lists, West under East');
ok(Object.values(W.SAT).every(s => s.layers.length === 2 && /west/.test(s.layers[0]) && /east/.test(s.layers[1])), 'each kind is GOES-West then GOES-East');
ok(W.satTile(W.SAT.ir.layers[1], 6, 17, 25, 9).endsWith('/goes-east-ir-4km-900913/6/17/25.png?_=9'), 'a tile URL');
ok(W.ROUTES.column('hrrr', 12.34, -56.78)[1].includes('past_hours=12'), "the column carries the last twelve hours, for the balloon");

console.log('\nRULE  Pro\'s map lines: read at run time, cut to North America, nothing of the file kept but the lines and names');
{
  const G = require('../mapgeo.js');
  ok(Object.values(G.LAYERS).every(L => G.url(Object.keys(G.LAYERS).find(k => G.LAYERS[k] === L)).startsWith('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_')) && G.url('nope') === null,
    'every layer is a file of Natural Earth\'s tagged release, and only those');
  /* made-up points at sea, as everywhere in these tests */
  const lines = G.slim('states', { features: [
    { properties: { NAME: 'x', MAPCOLOR9: 3 }, geometry: { type: 'LineString', coordinates: [[-56.71234, 13.5], [-56.7121, 13.5001], [-56.6, 13.6]] } },
    { properties: {}, geometry: { type: 'LineString', coordinates: [[10, 40], [11, 41]] } }] });
  ok(lines.v === 1 && lines.lines.length === 1 && lines.lines[0].join() === '-56.712,13.5,-56.6,13.6', 'a line inside the box, rounded, its near-duplicate point dropped; one across the ocean gone');
  ok(!JSON.stringify(lines).includes('MAPCOLOR') && !JSON.stringify(lines).includes('NAME'), 'no property of the file survives');
  const rings = G.slim('counties', { features: [{ properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[[[-56.7, 13.5], [-56.6, 13.5], [-56.6, 13.6], [-56.7, 13.5]]]] } }] });
  ok(rings.lines.length === 1 && rings.lines[0].length === 8, 'a county is its outline');
  const pl = G.slim('places', { features: [
    { properties: { name: 'Small', min_zoom: 7, pop_max: 900 }, geometry: { coordinates: [-56.7, 13.5] } },
    { properties: { name: 'Big', min_zoom: 3, pop_max: 90000 }, geometry: { coordinates: [-56.5, 13.5] } },
    { properties: { name: 'Far', min_zoom: 3, pop_max: 1e6 }, geometry: { coordinates: [10, 40] } }] });
  ok(pl.places.map(p => p[0]).join() === 'Big,Small', 'towns inside the box, biggest first');
  const prep = G.prepare(lines);
  ok(prep.lines[0].box.join() === '-56.712,13.5,-56.6,13.6', 'each line carries its box, for culling');
  const at = (lon) => [(lon + 56.7) * 1000, 50];
  ok(G.labels(pl.places, 4, 800, 400, at, () => 40).map(t => t.name).join() === 'Big', 'a town too small for this zoom has no name yet');
  ok(G.labels(pl.places, 8, 800, 400, at, () => 400).length === 1, 'two names that would touch: only the bigger is drawn');
  const at2 = (lon) => [(lon + 56.7) * 2000, 50];
  ok(G.labels(pl.places, 7, 800, 400, at2, () => 40).length === 2 && G.labels(pl.places, 7, 800, 400, at2, () => 40, { lift: 2 }).map(t => t.name).join() === 'Big', 'Names: Cities keeps the bigger places only (two zoom levels bigger)');
  const app = (await import('node:fs')).readFileSync(new URL('../../../assets/weather/app.js', import.meta.url), 'utf8');
  ok(/Wx\.mapLayer\(/.test(app) && !/natural-earth-vector/.test(app), 'the page asks through Wx.mapLayer — the address lives in one place');
}

console.log('\nRULE  air quality says the EPA\'s band, and the usual for a date is thirty years\' mean');
{
  const a = W.normalizeAir({ utc_offset_seconds: -25200, current: { time: '2026-10-23T10:00', us_aqi: 40, pm2_5: 7.8, ozone: 53 } });
  ok(a.aqi === 40 && a.word === 'Good' && a.time === Date.UTC(2026, 9, 23, 17), 'AQI 40 is Good, read at the place\'s own 10:00 (17:00 UTC)');
  ok(W.aqiBand(51)[1] === 'Moderate' && W.aqiBand(151)[1] === 'Unhealthy' && W.aqiBand(301)[1] === 'Hazardous' && W.normalizeAir({ current: {} }) === null, 'the bands are the EPA\'s; no number, no tile');
  ok(W.ROUTES.air(12.345678, -56.781)[1].includes('latitude=12.35&longitude=-56.78') && W.ROUTES.normals(12.345678, -56.781)[1].includes('latitude=12.35&longitude=-56.78'), 'both asked for the place to a kilometre');
  /* thirty made-up years: highs 10 °C on the days around 23 October, 25 on the day itself */
  const time = [], hi = [], lo = [];
  for (let y = 1991; y <= 2020; y++) for (const [m, d] of [[10, 16], [10, 23], [10, 30], [12, 1]]) { time.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`); hi.push(m === 10 && d === 23 ? 25 : 10); lo.push(2); }
  const n = W.normalsFrom({ daily: { time, temperature_2m_max: hi, temperature_2m_min: lo } });
  const oct23 = W.dayOfYear(10, 23);
  ok(n && near(n.hi[oct23], (25 + 10 + 10) / 3, 0.05) && n.lo[oct23] === 2, 'a date\'s usual is the mean over the fifteen days around it, every year');
  ok(W.dayOfYear(2, 29) === 59 && W.dayOfYear(3, 1) === 60 && W.dayOfYear(12, 31) === 365, '29 February has its own day; the year has 366');
  ok(W.normalsFrom({ daily: {} }) === null, 'and an answer with no days is no averages');
}

console.log('\nRULE  a replay\'s stations are the archive\'s readings at that moment, never today\'s');
{
  ok(W.ROUTES.asosAt('OK_ASOS', Date.UTC(2013, 4, 20, 20, 0))[2] === 'csv' && W.ROUTES.asosAt('OK_DCP', 1) === null && W.ROUTES.asosAt('ok_asos', 1) === null, 'only a state\'s airport network is asked for, as CSV');
  const url = W.ROUTES.asosAt('OK_ASOS', Date.UTC(2013, 4, 20, 20, 0))[1];
  ok(url.includes('year1=2013&month1=5&day1=20&hour1=19&minute1=20') && url.includes('hour2=20&minute2=0'), 'the forty minutes to the moment');
  const csv = 'station,valid,lon,lat,tmpf,dwpf,relh,sknt,drct,gust,mslp,vsby,skyc1,skyc2,skyc3,wxcodes,metar\n'
    + 'OKC,2013-05-20 19:52,-97.6006,35.3889,76.00,72.00,87.55,16.00,90.00,20.00,1002.70,2.50,SCT,BKN,OVC,-TSRA BR,KOKC 201952Z 09016G20KT 2 1/2SM -TSRA BR SCT032 BKN048CB OVC070 24/22 A2966\n'
    + 'OKC,2013-05-20 19:40,-97.6006,35.3889,80.00,70.00,,10.00,120.00,,,10.00,FEW,,,,KOKC 201940Z 12010KT\n'
    + 'PWA,2013-05-20 19:53,-97.6472,35.5342,,,,,,,,,,,,,KPWA 201953Z AUTO\n'
    + 'BAD,not a time,-97,35,70,60,,5,180,,,10,CLR,,,,\n';
  const s = W.normalizeAsosCsv(csv, 'OK_ASOS');
  ok(s.length === 1 && s[0].id === 'OKC', 'one station: the empty report and the bad row are dropped');
  ok(s[0].time === Date.UTC(2013, 4, 20, 19, 52) && near(s[0].temp, (76 - 32) * 5 / 9) && near(s[0].wind, 16 * 1.852) && s[0].cover === 'OVC' && s[0].past === true, 'its last reading in the window, in the live shape, marked as past');
  ok(s[0].raw.startsWith('KOKC 201952Z') && s[0].network === 'OK_ASOS' && s[0].net === 'asos', 'with its METAR and its network');
  ok(W.normalizeAsosCsv('<html>error</html>', 'OK_ASOS').length === 0, 'anything that is not the archive\'s CSV is nothing, not an error');
  ok(W.netKind('IA_RWIS') === 'rwis' && W.netKind('ISUSM') === 'soil' && W.netKind('OK_DCP') === 'dcp' && W.netKind('TX_ASOS') === 'asos', 'live stations say which kind of network they are');
}

console.log('\nRULE  the radar\'s age is the scan\'s own, and an outage is said as one');
{
  const M = 60e3, now = Date.UTC(2026, 9, 23, 20, 0);
  const every = (n, step, last) => Array.from({ length: n }, (_, i) => last - (n - 1 - i) * step);
  /* a live storm-mode loop, newest 4 min old: fine */
  ok(W.radarAge({ frames: every(12, 5 * M, now - 4 * M), nameMs: now - 4 * M, fileMs: now - 5 * M, nowMs: now }).stale === false, 'a scan every 5 min, newest 5 min old: not delayed');
  /* the feed stopped: 17 min with 5-min scans is late */
  ok(W.radarAge({ frames: every(12, 5 * M, now - 17 * M), nameMs: now - 17 * M, nowMs: now }).stale === true, 'no scan for 17 min when they come every 5: delayed');
  /* new names, old scan inside: frozen, and aged by the scan */
  const fz = W.radarAge({ frames: every(12, 5 * M, now - 2 * M), nameMs: now - 2 * M, fileMs: now - 26 * M, nowMs: now });
  ok(fz.frozen && fz.stale && Math.round(fz.ageMs / M) === 26, 'a new file holding a 26-min-old scan: frozen, and 26 min old');
  /* clear air: a volume every 10 min, echo tops 21 min after their volume began — not late */
  ok(W.radarAge({ frames: every(8, 10 * M, now - 21 * M), nameMs: now - 21 * M, fileMs: now - 21 * M, nowMs: now }).stale === false, 'clear air, 10-min volumes, 21 min old: not delayed (it was, at a fixed 15)');
  ok(W.radarAge({ frames: every(8, 10 * M, now - 30 * M), nameMs: now - 30 * M, nowMs: now }).stale === true, 'but 30 min with 10-min volumes is');
  /* the mosaic's time file unanswered: unknown, said — but not before it was asked */
  ok(W.radarAge({ frames: [null, null], nameMs: null, comp: true, asked: true, nowMs: now }).unknown === true && W.radarAge({ frames: [null], nameMs: null, comp: true, asked: false, nowMs: now }) === null,
    'the mosaic with no time: "unknown" once IEM was asked, nothing while asking');
  ok(W.feedLateMs(2, now - 12 * M, now) > 0 && W.feedLateMs(2, now - 10 * M, now) === null && W.feedLateMs(5, now - 21 * M, now) > 0 && W.feedLateMs(60, now - 3 * 60 * M, now) === null,
    'MRMS every 2 min late past 11 min, GOES every 5 past 20, an hourly field not at 3 hours');
  ok(W.outsideUS(null, false) === true && W.outsideUS(null, true) === false && W.outsideUS(undefined, false) === false && W.outsideUS({ office: 'X' }, false) === false,
    'outside the US only when the NWS said so — a failed lookup is an outage');
  ok(W.alertSource(false, 'nws') === 'nws' && W.alertSource(true, 'iem') === 'backup' && W.alertSource(true, null) === 'missing',
    'the alerts card: all well, the backup, or "may be missing" — never silence');
}

console.log('\nRULE  the tropics: NHC\'s storms as the map draws them, and only what NOAA serves');
{
  ok(W.ROUTES.nhcLayer(400) === null && W.ROUTES.nhcLayer(-1) === null && W.ROUTES.nhcLayer(1.5) === null && W.ROUTES.nhcLayer('3') === null, 'only a layer number the service has');
  ok(W.NHC_BINS.length === 15 && W.NHC_BINS[0].base === 4 && W.NHC_BINS.find(b => b.bin === 'EP2').base === 160 && W.NHC_BINS.find(b => b.bin === 'CP5').base === 368, 'the fifteen storm slots, 26 layers apart from 4');
  const pt = (tau, lon, lat, lbl) => ({ geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { tau, dvlbl: lbl, stormname: 'Hurricane Test', tcdvlp: 'Hurricane', maxwind: tau ? 80 : 90, mslp: 971, tcdir: 325, tcspd: 4, advisnum: '10', advdate: '300 PM', datelbl: 'x' } });
  const st = W.stormFrom('EP2', [pt(24, -103, 12, 'H'), pt(0, -102, 11, 'H')], [{ geometry: { type: 'LineString', coordinates: [[-102, 11], [-103, 12]] } }],
    [{ geometry: { type: 'Polygon', coordinates: [[[-102, 11], [-104, 13], [-101, 13], [-102, 11]]] } }],
    [{ properties: { tcww: 'HWR' }, geometry: { type: 'LineString', coordinates: [[-100, 17], [-101, 18]] } }, { properties: { tcww: 'TWA' }, geometry: null }], []);
  ok(st && st.name === 'Hurricane Test' && st.wind === 90 && st.lat === 11 && st.points[0].tau === 0 && st.points.length === 2, 'the storm is its first forecast point (now), the rest in order');
  ok(st.cone.length === 1 && st.track.length === 1 && st.ww.length === 1 && st.ww[0].name === 'Hurricane warning' && st.ww[0].color === '#ff2a2a', 'its cone, its track, and a hurricane warning on the coast in NHC\'s red; a watch with no line is left out');
  ok(W.stormFrom('AT1', [], [], [], [], []) === null, 'a slot with no storm is no storm');
  const ar = W.outlookAreas([{ properties: { basin: 'Atlantic', prob2day: '10%', risk2day: 'Low', prob7day: '60%', risk7day: 'Medium' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }]);
  ok(ar.length === 1 && ar[0].p7 === '60%' && ar[0].color === '#ff922b', 'an outlook area with its 2- and 7-day chances, coloured by NHC\'s risk');
  ok(Object.keys(W.OUTLOOKS).length === 15 && W.OUTLOOKS['d1:torn'].kinds.includes('day1otlk_sigtorn') && W.OUTLOOKS.d8.kinds[0] === 'day8prob' && Object.values(W.OUTLOOKS).every(o => o.kinds.every(k => W.ROUTES.spc(k))), 'every SPC outlook offered is a file the page may ask for');
}

console.log('\nRULE  the backup mosaic: NOAA\'s own, when IEM\'s is late or silent');
{
  const M = 60e3, now = Date.UTC(2026, 9, 23, 20, 0);
  const ts = W.mosaicTimes('<Layer><Dimension name="time" default="x" units="ISO8601" nearestValue="1">2026-10-23T19:56:00.000Z,2026-10-23T19:54:01.000Z, 2026-10-23T19:58:07Z</Dimension></Layer>');
  ok(ts.length === 3 && ts[2] === Date.UTC(2026, 9, 23, 19, 58, 7) && ts[0] < ts[1], 'its times, from the capabilities, sorted');
  ok(W.mosaicTimes('<nothing/>').length === 0, 'a capabilities document with no times gives none');
  const t0 = W.backupTile(0, 0, 0, now);
  ok(/bbox=-20037508\.34,-20037508\.34,20037508\.34,20037508\.34&/.test(t0) && t0.includes('srs=EPSG:3857') && t0.includes('time=2026-10-23T20:00:00Z'), 'tile 0/0/0 is the whole web-Mercator square, at the time asked for');
  ok(/bbox=0\.00,0\.00,20037508\.34,20037508\.34&/.test(W.backupTile(1, 1, 0, now)), 'tile 1/1/0 is the north-east quarter');
  ok(W.useBackupMosaic(null, now - 3 * M, now) === true, 'IEM\'s time not answering, NOAA\'s fresh: the backup');
  ok(W.useBackupMosaic(now - 25 * M, now - 3 * M, now) === true, 'IEM 25 min old, NOAA 3: the backup');
  ok(W.useBackupMosaic(now - 4 * M, now - 1 * M, now) === false, 'IEM fresh: IEM, always');
  ok(W.useBackupMosaic(now - 25 * M, now - 20 * M, now) === false && W.useBackupMosaic(null, now - 40 * M, now) === false, 'NOAA late too, or not much newer: no switch to something no better');
}

console.log('\nRULE  Pro\'s map paints the frame it steps to; warnings fold but never hide');
{
  const fs = await import('node:fs');
  const app = fs.readFileSync(new URL('../../../assets/weather/app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../../../assets/weather/weather.css', import.meta.url), 'utf8');
  const body = (name) => { const i = app.indexOf(`function ${name}(`); return i < 0 ? '' : app.slice(i, app.indexOf('\n    }\n', i)); };
  /* stepping onto a scan, model hour, MRMS or GOES frame once the older frames have loaded */
  ok(/\)\) draw\(\);[^\n]*\n(?:\s*\/\*[\s\S]*?\*\/\n)?\s*else paintFrame\(f\);/.test(body('show')), 'show() paints the frame it moves to when it does not redraw the map');
  const pf = body('paintFrame');
  ok(/paintL3\(f/.test(pf) && /f\.model \|\| f\.mrms \|\| f\.abi\) paintModel\(f/.test(pf), 'paintFrame covers Level III, model, MRMS and GOES frames');
  ok(/f\.painted === key\) return;/.test(body('paintL3')) && /f\.painted === key\) return;/.test(body('paintModel')), 'each painter keeps the view it drew, so a frame already painted costs nothing');
  /* the radar's own fetches go through the one retrying helper */
  ok(/NX\.retrying\(fetch\)\(u\)/.test(app) && /NX\.retrying\(fetch\)\(S\.url\)/.test(app) && !/await fetch\(S\.url\)/.test(app), 'the page\'s Level II chunk fetches are retried');
  ok(/get fast\(\)[^\n]*l3\(\) && !useL2\(\)/.test(app) && /radarDue\(now\)/.test(app) && /radar\.fast \? 25e3 : 120e3/.test(app), 'a site\'s Level III scans refresh every 30 s; the rest every two minutes');
  /* model runs: a failed listing and a late run are two different things */
  const mf = body('modelFrames');
  ok(/catch \(e\) \{ run = null; failed = true; \}/.test(mf) && /!run && !failed/.test(mf) && /runs are late/.test(mf), 'a model listing that answered with no run is "late", not "did not answer"');
  ok(/Sx\.lookBack \* Sx\.cycle \* 3600e3/.test(mf) && /MM\.lateBy\(src, run\.run\)/.test(mf), 'with no run out, the run before is drawn and called late');
  ok(/function runHour\(m\)[^\n]*Z \+\$\{m\.fh\} h/.test(app) && !/label\)\}\$\{MM\.SOURCES\[f\.model\.src\]\.analysis \? " · " \+ Wx\.age\(Date\.now\(\) - f\.t\) \+ " ago" : ` \+\$\{f\.model\.fh\} h`/.test(app), 'the stamp says the run: "GFS 18Z +6 h"');
  /* storm mode on Pro: a fold, never a hiding */
  const rs = body('renderStorms');
  ok(/if \(folded\(a\)\)[^\n]*class="storm folded/.test(rs) && /⚠ \$\{esc\(a\.event\)\}/.test(rs) && /until \$\{esc\(a\.ends/.test(rs), 'a folded warning is still a red bar with its event and end time');
  ok(/if \(!PRO \|\| !FOLD\.has/.test(app) && /const fold = PRO \?/.test(rs), 'only Pro folds; Weather\'s storm mode is unchanged');
  ok(/dangerOf\(a\) > FOLD\.get\(foldKey\(a\)\)\) \{ FOLD\.delete/.test(app), 'an upgraded warning opens again');
  ok(/if \(Array\.isArray\(S\.alerts\)\) \{[^\n]*if \(!here\.has\(key\)\) FOLD\.delete\(key\)/.test(rs), 'a warning an answer no longer has is forgotten, so the next one opens — and a reload in flight forgets nothing');
  ok(!/store\.set\([^)]*FOLD|wx:fold/.test(app), 'a fold is never saved: a reload opens every warning');
  ok(/\.storm\.folded\{/.test(css) && !/\.storm\.folded\{[^}]*display:\s*none/.test(css), 'a folded warning is styled, never display:none');
  const ev = (event, extra = {}) => ({ event, sender: 'NWS X', ...extra });
  /* the ranking itself, read out of the page */
  const EVsrc = /const EV = (\{[^\n]*\});/.exec(app)[1], TH = /const THREAT = (\{[^\n]*\});/.exec(app)[1], DG = /const dangerOf = \(a\) => ([\s\S]*?);\n/.exec(app)[1];
  const dangerOf = new Function('a', `const EV = ${EVsrc}, evOf = (a) => EV[a.event] || ["other", 0], THREAT = ${TH}; return ${DG};`);
  const base = dangerOf(ev('Tornado Warning'));
  ok([{ detection: 'OBSERVED' }, { pds: true }, { emergency: true }, { threat: 'CONSIDERABLE' }].every(x => dangerOf(ev('Tornado Warning', x)) > base), 'observed, PDS, an emergency or a higher damage threat each count as an upgrade');
  ok(dangerOf(ev('Severe Thunderstorm Warning', { threat: 'DESTRUCTIVE', pds: true })) < base, 'a severe thunderstorm warning, however tagged, ranks under a tornado warning');
}

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL WEATHER CLIENT RULES PASS'));
process.exit(failures ? 1 : 0);
