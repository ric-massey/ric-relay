/* The nationwide scoreboard — node projects/weather/test/verify.test.mjs
   Hand-worked cases for the arithmetic (verify/core.js), then a whole run of
   verify/score.mjs against fake providers shaped like the real ones (IEM's
   AZOS list and ASOS CSV, Open-Meteo's previous-runs API, as probed
   2026-10-17), checking what it publishes — including that no coordinate
   reaches a published file. */
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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

console.log('\nRULE  the learned forecast finds what is really there, and only that');
{
  /* a station where the truth runs 2 °C under the models' average at night and
     1 °C over by day, and where it follows GFS's lean (truth = mean + 0.8 ×
     how far GFS sits from the mean) */
  const lon = 0;
  let acc = null;
  const day0 = Date.parse('2026-09-01T00:00:00Z') / 1000;
  const truth = (vals, h) => {
    const f = C.learnFeatures(vals, 't', h, lon);
    const night = !C.isDay(h, lon);
    return f.mean + (night ? -2 : 1) + 0.8 * (vals.gfs.t - f.mean);
  };
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  const hourVals = h => {
    const base = 15 + 8 * Math.sin(2 * Math.PI * ((h / 3600) % 24) / 24);
    return { best: { t: base + rnd() }, gfs: { t: base + 3 * rnd() }, ecmwf: { t: base + rnd() }, aifs: { t: base + rnd() } };
  };
  ok(C.learnSolve(C.learnAdd(null, [{ x: new Array(C.LEARN_DIM).fill(1), r: 1 }])) === null, 'one day of evidence: nothing learned yet');
  for (let d = 0; d < 40; d++) {
    const samples = [];
    for (let k = 1; k <= 24; k++) { const h = day0 + d * 86400 + k * 3600, v = hourVals(h); samples.push({ x: C.learnFeatures(v, 't', h, lon).x, r: truth(v, h) - C.learnFeatures(v, 't', h, lon).mean }); }
    acc = C.learnAdd(acc, samples);
  }
  const beta = C.learnSolve(acc);
  let errL = 0, errM = 0, n = 0;
  for (let k = 1; k <= 48; k++) {
    const h = day0 + 50 * 86400 + k * 3600, v = hourVals(h), y = truth(v, h);
    errL += Math.abs(C.learnPredict(beta, v, 't', h, lon) - y); errM += Math.abs(C.learnFeatures(v, 't', h, lon).mean - y); n++;
  }
  ok(errL / n < 0.6 && errL < errM / 2, `on days it never saw: learned ${(errL / n).toFixed(2)} °C off vs the plain average's ${(errM / n).toFixed(2)} °C`);
  /* and where the plain average is already right, plus noise, it learns
     nothing: no invented correction */
  let quiet = null;
  for (let d = 0; d < 40; d++) {
    const samples = [];
    for (let k = 1; k <= 24; k++) { const h = day0 + d * 86400 + k * 3600, v = hourVals(h), f = C.learnFeatures(v, 't', h, lon); samples.push({ x: f.x, r: 0.5 * rnd() }); }
    quiet = C.learnAdd(quiet, samples);
  }
  const qb = C.learnSolve(quiet);
  let drift = 0;
  for (let k = 1; k <= 48; k++) { const h = day0 + 50 * 86400 + k * 3600, v = hourVals(h); drift = Math.max(drift, Math.abs(C.learnPredict(qb, v, 't', h, lon) - C.learnFeatures(v, 't', h, lon).mean)); }
  ok(drift < 0.15, `nothing to learn: it stays within ${drift.toFixed(2)} °C of the plain average`);
  ok(C.learnPredict(beta, { best: { t: 10 } }, 't', day0, lon) === null, 'one model alone is not enough to predict from');
  ok(C.learnPredict(beta, { best: { w: 1 }, gfs: { w: 1 } }, 'w', day0, lon) >= 0, 'wind never comes out below zero');
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
  /* our own AI run from the evening before (2026-10-15 12Z), six-hourly, 0.5 °C warm at AAA;
     and a later run that must NOT be used for the 16th (it began after the day's 12-hour cutoff) */
  mkdirSync(join(outDir, 'state', 'ai'), { recursive: true });
  const ai = (init, warm) => ({ model: 'pangu', init, times: Array.from({ length: 12 }, (_, k) => Date.parse(init) / 1000 + (k + 1) * 6 * 3600),
    stations: { AAA: { t: Array(12).fill(10 + warm), w: Array(12).fill(18.52) } } });
  writeFileSync(join(outDir, 'state', 'ai', '2026101512.json'), JSON.stringify(ai('2026-10-15T12:00:00Z', 0.5)));
  writeFileSync(join(outDir, 'state', 'ai', '2026101600.json'), JSON.stringify(ai('2026-10-16T00:00:00Z', 4)));
  const res = await S.run({ day, statePath, outDir, fetchImpl: fakeFetch, log: () => {}, pace: false });
  ok(res.scoredDays.length === 1 && res.state.scored.includes(day), 'the day is scored and remembered');
  ok(Object.keys(res.state.stations).sort().join() === 'AAA,BBB,CCC', 'every open station, none of the closed one');
  const a = res.state.stations.AAA.models;
  ok(near(C.tempMae(a.gfs[1]), 3) && near(C.tempMae(a.ecmwf[1]), 1) && near(C.tempMae(a.ecmwf[2]), 2), 'each model held to the station: GFS 3 °C off, ECMWF 1 °C, ECMWF two days out 2 °C');
  ok(a.blend && a.blend[1] && a.blend[1].days === 1, 'and our blend scored beside them');
  ok(a.pangu && near(C.tempMae(a.pangu[1]), 0.5) && a.pangu[1].td[2] + a.pangu[1].tn[2] === 4,
    'our AI run scored too, from the evening before the day only: 0.5 °C off over its four six-hourly steps');
  ok(!res.state.stations.BBB.models.pangu, 'a station the run does not carry is not scored for it');
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

console.log('\nRULE  twelve days: the learned forecast is scored only on days it had not seen');
{
  const geo = { features: [{ id: 'AAA', properties: { sname: 'Alpha Field', state: 'ZZ', network: 'ZZ_ASOS', online: true, archive_end: null }, geometry: { coordinates: [-100.12, 40.65] } }] };
  const fakeFetch = async (url) => {
    const u = new URL(url);
    if (u.pathname.endsWith('network.py')) return new Response(JSON.stringify(geo));
    if (u.pathname.endsWith('asos.py')) {
      const from = Date.UTC(+u.searchParams.get('year1'), +u.searchParams.get('month1') - 1, +u.searchParams.get('day1')) / 1000;
      const to = Date.UTC(+u.searchParams.get('year2'), +u.searchParams.get('month2') - 1, +u.searchParams.get('day2')) / 1000;
      const lines = ['station,valid,tmpf,sknt,p01i'];
      for (let t = from; t <= to; t += 3600) lines.push(`AAA,${new Date((t - 420) * 1000).toISOString().replace('T', ' ').slice(0, 16)},50.00,10.00,0.00`);
      return new Response(lines.join('\n'));
    }
    if (u.hostname.startsWith('previous-runs-api')) {
      const a = Date.parse(u.searchParams.get('start_date') + 'T00:00:00Z') / 1000, b = Date.parse(u.searchParams.get('end_date') + 'T00:00:00Z') / 1000 + 86400;
      const time = []; for (let h = a; h <= b; h += 3600) time.push(h);
      const hourly = { time };
      for (const [m, om] of Object.entries(S.MODELS)) {
        const warm = { gfs: 3, ecmwf: 1 }[m] ?? 2;
        hourly[`temperature_2m_previous_day1_${om}`] = time.map(() => 10 + warm);
        hourly[`temperature_2m_previous_day2_${om}`] = time.map(() => 10 + warm);
        hourly[`wind_speed_10m_previous_day1_${om}`] = time.map(() => 18.52);
        hourly[`precipitation_previous_day1_${om}`] = time.map(() => 0);
      }
      return new Response(JSON.stringify([{ hourly }]));
    }
    return new Response('not found', { status: 404 });
  };
  const outDir = mkdtempSync(join(tmpdir(), 'wxlearn-'));
  const res = await S.run({ day: '2026-10-12', backfill: 12, statePath: join(outDir, 'state', 'state.json'), outDir, fetchImpl: fakeFetch, log: () => {}, pace: false });
  const m = res.state.stations.AAA.models;
  ok(res.scoredDays.length === 12 && m.ecmwf[1].days === 12, 'twelve days scored');
  ok(m.learn && m.learn[1].days === 2, `learned forecast scored on ${m.learn && m.learn[1].days} days: only after ten days of learning`);
  ok(C.tempMae(m.learn[1]) < C.tempMae(m.ecmwf[1]), `and on those, closer than the best model: ${C.tempMae(m.learn[1]).toFixed(2)} vs ECMWF ${C.tempMae(m.ecmwf[1]).toFixed(2)} °C`);
  const zz = JSON.parse(readFileSync(join(outDir, 'ZZ.json'), 'utf8'));
  ok(Array.isArray(zz.stations.AAA.L.t) && zz.stations.AAA.L.t.length === C.LEARN_DIM, 'its coefficients are published for the page');
  const idx = JSON.parse(readFileSync(join(outDir, 'index.json'), 'utf8'));
  ok('learn' in idx.national, 'and it sits in the national table beside the models');
  const seeded = S.seedFrom(outDir);
  ok(seeded.stations.AAA.learn.beta.t.length === C.LEARN_DIM, 'with the cache gone, the coefficients come back from the published files');
}

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL SCOREBOARD RULES PASS'));
process.exit(failures ? 1 : 0);
