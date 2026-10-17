/* The nationwide scoreboard — node projects/weather/test/verify.test.mjs
   Hand-worked cases for the arithmetic (verify/core.js), then a whole run of
   verify/score.mjs against fake providers shaped like the real ones (IEM's
   AZOS list and ASOS CSV, Open-Meteo's previous-runs API, as probed
   2026-10-17), checking what it publishes — including that no coordinate
   reaches a published file. */
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const C = require('../verify/core.js');
const S = await import('../verify/score.mjs');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

console.log('\nRULE  airport reports become hours');
{
  const rows = C.parseCsv(['station,valid,tmpf,sknt,p01i',
    'AAA,2026-10-16 00:53,50.00,10.00,0.00',
    'AAA,2026-10-16 01:53,32.00,0.00,0.10',
    'AAA,2026-10-16 02:20,40.00,5.00,null',        // a special mid-hour: belongs to no hour
    'AAA,2026-10-16 02:53,M,null,0.0001',          // missing temperature, trace rain
    'BBB,2026-10-16 01:55,68.00,5.00,null'].join('\n'));
  const h = C.hourlyObs(rows);
  const T = s => Date.parse(s) / 1000;
  const a = h.get('AAA');
  ok(a.size === 3 && near(a.get(T('2026-10-16T01:00:00Z')).t, 10) && near(a.get(T('2026-10-16T02:00:00Z')).t, 0), 'a :53 report is the next top of the hour; °F to °C');
  ok(near(a.get(T('2026-10-16T01:00:00Z')).w, 18.52) && near(a.get(T('2026-10-16T02:00:00Z')).p, 2.54), 'knots to km/h, inches to mm');
  ok(a.get(T('2026-10-16T03:00:00Z')).t === null && a.get(T('2026-10-16T03:00:00Z')).p > 0, 'a missing value is null, not zero; a trace is kept');
  ok(h.get('BBB').size === 1, 'other stations kept apart');
}

console.log('\nRULE  a day scored, and folded into a record');
{
  const t0 = Date.parse('2026-10-16T00:00:00Z') / 1000;
  const obs = new Map(), fc = new Map();
  for (let h = t0 + 3600; h <= t0 + 86400; h += 3600) {
    obs.set(h, { t: 10, w: 10, p: h === t0 + 10 * 3600 ? 3 : 0 });
    fc.set(h, { t: 12, w: 8, p: 0 });                                  // 2 °C warm, 2 km/h slow, missed the rain
  }
  const d = C.scoreDay(fc, obs, t0, 0);
  ok(d.td && near(d.td[0], 2) && near(d.td[1], 2) && d.td[2] === 12 && d.tn[2] === 12, 'longitude 0: 12 day hours and 12 night hours, each 2 °C warm');
  ok(near(d.w[0], -2) && d.rain.fc === 0 && d.rain.ob === 3, 'wind 2 km/h slow; the day had 3 mm and the forecast none');
  let rec = C.fold(null, d);
  ok(rec.days === 1 && near(rec.td[0], 2) && rec.p[2] === 1, 'first day: the record is that day, and a miss is counted');
  const better = C.scoreDay(new Map([...fc].map(([h, v]) => [h, { ...v, t: 10 }])), obs, t0, 0);
  rec = C.fold(rec, better);
  ok(near(rec.td[0], 1) && rec.days === 2, 'second day, perfect: the bias averages to 1 °C (plain average while young)');
  for (let i = 0; i < 60; i++) rec = C.fold(rec, better);
  ok(Math.abs(rec.td[0]) < 0.05, 'two months of perfect days and the old bias has faded');
  ok(near(C.tempMae(rec), (rec.td[1] * rec.td[2] + rec.tn[1] * rec.tn[2]) / (rec.td[2] + rec.tn[2])), 'MAE is weighted by hours');
  ok(C.rainSkill({ p: [5, 0, 0, 20] }) === 1 && Math.abs(C.rainSkill({ p: [2, 3, 3, 17] })) < 0.3, 'rain skill: perfect is 1, near chance is near 0');
  ok(C.fold(null, { td: null, tn: null, w: null, rain: null }).days === 0, 'a day with nothing to compare does not count');
}

console.log('\nRULE  the blend corrects what the record has proven, and nothing else');
{
  const rec = (bias, mae, days) => ({ td: [bias, mae, 100], tn: [bias, mae, 100], w: [0, 3, 100], p: [0, 0, 0, 0], pd: [0, 0], days });
  const young = C.blend({ gfs: { t: 10, p: 1 }, ecmwf: { t: 14, p: 0 } }, {}, true);
  ok(near(young.t, 12) && near(young.p, 0.5), 'no record yet: a plain average, uncorrected');
  const recs = { gfs: rec(2, 1, 20), ecmwf: rec(0, 2, 20) };
  const b = C.blend({ gfs: { t: 12 }, ecmwf: { t: 10 } }, recs, true);
  /* gfs runs 2 °C warm: 12 → 10; weights 1/1² and 1/2² → (4·10 + 1·10)/5 = 10 */
  ok(near(b.t, 10), `a model's proven warm bias is taken off, and the closer model counts four times as much: ${b.t}`);
  const shortRec = C.blend({ gfs: { t: 12 }, ecmwf: { t: 10 } }, { gfs: rec(2, 1, 3), ecmwf: rec(0, 2, 20) }, true);
  ok(near(shortRec.t, 11), 'with only one model proven, nobody is corrected yet: a plain average');
  ok(C.spread({ a: { t: 10 }, b: { t: 13 }, c: { t: null } }, 't') === 3 && C.spread({ a: { t: 1 } }, 't') === null, 'model spread, ignoring gaps');
}

console.log('\nRULE  a whole run against fake providers');
{
  const day = '2026-10-16', t0 = Date.parse(day + 'T00:00:00Z') / 1000;
  const geo = { features: [
    { id: 'AAA', properties: { sname: 'Alpha Field', state: 'ZZ', network: 'ZZ_ASOS', online: true, archive_end: null }, geometry: { coordinates: [-100.123456, 40.654321] } },
    { id: 'BBB', properties: { sname: 'Bravo', state: 'ZZ', network: 'ZZ_ASOS', online: true, archive_end: null }, geometry: { coordinates: [-101, 41] } },
    { id: 'OLD', properties: { sname: 'Closed', state: 'ZZ', network: 'ZZ_ASOS', online: false, archive_end: '2001-01-01' }, geometry: { coordinates: [-99, 40] } },
    { id: 'CCC', properties: { sname: 'Charlie', state: 'YY', network: 'YY_ASOS', online: true, archive_end: null }, geometry: { coordinates: [-90, 35] } }] };
  const csv = net => {
    const lines = ['station,valid,tmpf,sknt,p01i'];
    const ids = net === 'ZZ_ASOS' ? ['AAA', 'BBB'] : ['CCC'];
    for (const id of ids) for (let h = 0; h < 25; h++) {
      const t = new Date((t0 + h * 3600 - 7 * 60) * 1000).toISOString().replace('T', ' ').slice(0, 16);
      lines.push(`${id},${t},50.00,10.00,0.00`);                       // 10 °C, 18.5 km/h, dry
    }
    return lines.join('\n');
  };
  const asked = [];
  const fakeFetch = async (url) => {
    asked.push(url);
    const u = new URL(url);
    if (u.pathname.endsWith('network.py')) return new Response(JSON.stringify(geo));
    if (u.pathname.endsWith('asos.py')) return new Response(csv(u.searchParams.get('network')));
    if (u.hostname.startsWith('previous-runs-api')) {
      const lats = u.searchParams.get('latitude').split(',');
      const time = []; for (let h = t0; h < t0 + 25 * 3600; h += 3600) time.push(h);
      return new Response(JSON.stringify(lats.map((_, i) => {
        const hourly = { time };
        for (const om of Object.values(S.MODELS)) {
          const warm = om === 'gfs_global' ? 3 : om === 'ecmwf_ifs025' ? 1 : 2;   // ecmwf is the best here
          hourly[`temperature_2m_previous_day1_${om}`] = time.map(() => 10 + warm);
          hourly[`temperature_2m_previous_day2_${om}`] = time.map(() => 10 + warm + 1);
          hourly[`wind_speed_10m_previous_day1_${om}`] = time.map(() => 18.52);
          hourly[`precipitation_previous_day1_${om}`] = time.map(() => 0);
        }
        return { hourly };
      })));
    }
    return new Response('not found', { status: 404 });
  };
  const outDir = mkdtempSync(join(tmpdir(), 'wxscore-'));
  const statePath = join(outDir, 'state', 'state.json');
  const res = await S.run({ day, statePath, outDir, fetchImpl: fakeFetch, log: () => {}, pace: false });
  ok(res.scoredDays.length === 1 && res.state.scored.includes(day), 'the day is scored and remembered');
  ok(Object.keys(res.state.stations).sort().join() === 'AAA,BBB,CCC', 'every open station, none of the closed one');
  const a = res.state.stations.AAA.models;
  ok(near(C.tempMae(a.gfs[1]), 3) && near(C.tempMae(a.ecmwf[1]), 1) && near(C.tempMae(a.ecmwf[2]), 2), 'each model held to the station: GFS 3 °C off, ECMWF 1 °C, ECMWF two days out 2 °C');
  ok(a.blend && a.blend[1] && a.blend[1].days === 1, 'and our blend scored beside them');
  const prev = asked.find(u => u.includes('previous-runs-api'));
  ok(prev.includes('latitude=40.65%2C41.00') || prev.includes('latitude=40.65,41.00'), 'forecasts asked for at the station, to two decimals');
  const files = readdirSync(outDir).filter(f => f.endsWith('.json')).sort();
  ok(files.join() === 'YY.json,ZZ.json,index.json', `one file per state and an index: ${files.join(', ')}`);
  const pub = files.map(f => readFileSync(join(outDir, f), 'utf8')).join('\n');
  ok(!/40\.65|100\.12|-101|41\b|"lat"|"lon"|latitude/.test(pub), 'no coordinate reaches a published file (hard rule 1)');
  const idx = JSON.parse(readFileSync(join(outDir, 'index.json'), 'utf8'));
  ok(idx.stations.AAA === 'ZZ' && idx.through === day && idx.models.ecmwf === 'ecmwf_ifs025', 'the index says where each station is and how far the record goes');
  const zz = JSON.parse(readFileSync(join(outDir, 'ZZ.json'), 'utf8'));
  ok(zz.stations.AAA.n === 'Alpha Field' && zz.stations.AAA.m.ecmwf[1].td[1] === 1, 'the state file carries names and rounded records');

  const again = await S.run({ day, statePath, outDir, fetchImpl: fakeFetch, log: () => {}, pace: false });
  ok(again.scoredDays.length === 0 && again.state.stations.AAA.models.gfs[1].days === 1, 'running twice for the same day changes nothing');
  const seeded = S.seedFrom(outDir);
  ok(seeded.scored.includes(day) && seeded.stations.AAA.models.ecmwf[1].days === 1, 'with the cache gone, the published files seed the record again');

  /* the next day: one model (GFS) has a record of 1 day — below MIN_DAYS, so no correction yet */
  const next = await S.run({ day: '2026-10-17', statePath, outDir, fetchImpl: async u => fakeFetch(u.replace(/2026-10-17/g, day)), log: () => {}, pace: false });
  ok(next.state.scored.length >= 1, 'a later day folds on top');
}

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL SCOREBOARD RULES PASS'));
process.exit(failures ? 1 : 0);
