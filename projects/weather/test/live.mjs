/* The weather room against the REAL providers — node projects/weather/test/live.mjs
   wx.test.mjs runs on fixtures shaped like each provider's documented answer.
   This asks the providers themselves, through the same functions the page
   calls, and reads what comes back: a 200 is not a pass. It needs the
   network, so it is not in checks.mjs; .github/workflows/weather-live.yml runs
   it when this code changes and once a day.

   No coordinates are written here (hard rule 1): every place is found by
   name through the geocoder, the same way a visitor finds one. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const W = require('../wx.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const guard = async (msg, fn) => { try { await fn(); } catch (e) { ok(false, `${msg} — threw ${e.message}`); } };

let us = null, abroad = null;

console.log('\nLIVE  the place search (Open-Meteo geocoding)');
await guard('geocode', async () => {
  const r = await W.geocode('Norman');
  us = r.find(p => p.cc === 'US' && /Oklahoma/.test(p.region));
  ok(!!us, `"Norman" finds Norman, Oklahoma (${r.length} results)`);
  ok(r.every(p => Number(W.coord(p.lat)) === p.lat && Number(W.coord(p.lon)) === p.lon), 'every result arrives rounded to two decimals');
  abroad = (await W.geocode('Reykjavik')).find(p => p.cc === 'IS');
  ok(!!abroad, 'and somewhere outside the US');
});
if (!us) { console.log('\nno place to test with — stopping'); process.exit(1); }

console.log('\nLIVE  the forecast (Open-Meteo)');
await guard('forecast', async () => {
  const fc = await W.forecast(us.lat, us.lon);
  const now = Math.floor(Date.now() / 1000);
  ok(fc.tz === 'America/Chicago', `the place's timezone: ${fc.tz}`);
  ok(Number.isFinite(fc.current.temp) && fc.current.temp > -40 && fc.current.temp < 50, `a current temperature: ${fc.current.temp}°C`);
  ok(Number.isFinite(fc.current.code) && W.WMO[fc.current.code], `a weather code the page knows: ${fc.current.code}`);
  ok(fc.hourly.length >= 240, `eleven days of hours: ${fc.hourly.length}`);
  const hrs = W.upcomingHours(fc, now, 24);
  ok(hrs.length === 24 && hrs.every(h => Number.isFinite(h.temp) && Number.isFinite(h.pop) && Number.isFinite(h.gust)), 'the next 24 hours have temperature, chance of rain and gusts');
  ok(hrs.every(h => Number.isFinite(h.vis) && Number.isFinite(h.uv) && (h.isDay === 0 || h.isDay === 1)), '…and visibility, UV, day/night');
  const days = W.upcomingDays(fc, now);
  ok(days.length >= 9 && days.slice(0, 9).every(d => d.hi >= d.lo && Number.isFinite(d.sunrise)), `ten days of highs, lows and sunrises (${days.length})`);
  ok(fc.minutely.filter(s => s.t > now).length >= 12 && fc.minutely.every(s => s.precip === null || s.precip >= 0), 'rain every fifteen minutes for at least the next three hours');
  const tr = W.pressureTrend(fc, now);
  ok(tr && ['rising', 'falling', 'steady'].includes(tr.word), `a pressure trend: ${tr && tr.word}`);
  const o = W.rainOutlook(fc, now, 3, s => W.clock(fc.tz).time(s * 1000));
  ok(o.state !== 'unknown' && o.text.length > 5, `the rain sentence: "${o.text}"`);
});

console.log('\nLIVE  the National Weather Service');
await guard('nws', async () => {
  const pt = await W.point(us.lat, us.lon);
  ok(pt && /^[A-Z]{3}$/.test(pt.office), `the point has a forecast office: ${pt && pt.office}`);
  ok(pt && W.ROUTES.nws(pt.forecastUrl) && W.ROUTES.nws(pt.stationsUrl), 'and its forecast and station links are ones the Worker allows');
  ok(pt && /Norman|Oklahoma|OK/.test(pt.city || ''), `and names the town: ${pt && pt.city}`);
  const office = await W.officeForecast(pt);
  ok(office && office.periods.length >= 10 && office.periods[0].detailed.length > 20, `the office's own words: ${office && office.periods.length} periods`);
  ok(office && Number.isFinite(office.updated) && Date.now() - office.updated < 24 * 3600e3, 'updated within a day');
  const obs = await W.observation(pt, us.lat, us.lon);
  ok(obs && /^[A-Z0-9]{3,6}$/.test(obs.station), `a station observation: ${obs && obs.station} ${obs && obs.stationName}`);
  ok(obs && Date.now() - obs.time < 3 * 3600e3, `reported in the last three hours (${obs && W.age(Date.now() - obs.time)} ago)`);
  ok(obs && Number.isFinite(obs.temp) && Number.isFinite(obs.pressure) && obs.pressure > 900 && obs.pressure < 1100, `with a temperature and a pressure in hPa: ${obs && obs.temp}°C, ${obs && obs.pressure} hPa`);
  ok(obs && obs.dist != null && obs.dist < 60e3, `from within 60 km: ${obs && Math.round(obs.dist / 1000)} km`);
  const al = await W.alerts(us.lat, us.lon);
  ok(Array.isArray(al) && al.every(a => a.event && a.tone), `alerts read (${al.length} active)`);
});

console.log('\nLIVE  outside the US');
if (abroad) await guard('abroad', async () => {
  ok(await W.point(abroad.lat, abroad.lon) === null, 'the NWS has no point there, and that is an answer, not an error');
  const fc = await W.forecast(abroad.lat, abroad.lon);
  ok(fc.tz === 'Atlantic/Reykjavik' && fc.hourly.length >= 240, 'but the forecast works anywhere');
});

console.log('\nLIVE  radar (Iowa Environmental Mesonet)');
await guard('radar', async () => {
  const t = await W.radarTime();
  ok(Number.isFinite(t), `the composite says when it was scanned: ${t && new Date(t).toISOString()}`);
  ok(t && Date.now() - t < 20 * 60e3, `within twenty minutes (${t && W.age(Date.now() - t)} ago)`);
  for (const m of [0, 50]) {
    const r = await fetch(W.radarTile(m, 6, 14, 25, 'live'));
    ok(r.ok && /image\/png/.test(r.headers.get('content-type') || ''), `a ${m ? m + '-minute-old' : 'latest'} tile is a PNG (${r.status})`);
  }
});

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'THE WEATHER PROVIDERS ANSWER AS THE PAGE EXPECTS'));
process.exit(failures ? 1 : 0);
