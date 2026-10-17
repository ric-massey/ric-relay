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
    W.ROUTES.radarMeta()
  ];
  for (const [path, direct] of routes) {
    const n = asked.length;
    const r = await worker.fetch(new Request('https://x/wx/' + path), env, null);
    ok(r.status === 200 && asked[n] === direct, `/wx/${path.slice(0, 60)} → ${direct.slice(0, 50)}…`);
  }
  ok(W.ROUTES.nws('https://api.weather.gov/products/abc') === null, 'a URL the Worker would refuse is not followed at all');
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

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL WEATHER CLIENT RULES PASS'));
process.exit(failures ? 1 : 0);
