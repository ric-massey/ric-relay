/* SCORE CORE — how a forecast is held to what happened
   ────────────────────────────────────────────────────────────────────────────
   The arithmetic of the weather room's nationwide scoreboard (DESIGN.md §31):
   airport observations turned into hours, a model's hours matched to them, and
   a running record per station, per model, per lead time. Pure — score.mjs
   does the fetching, the page reads what this writes, and
   projects/weather/test/verify.test.mjs holds it to hand-worked cases.

   ── what a record is ──
   For one station, one model, one lead (how many days before the hour the
   forecast was made), a set of running numbers, each an exponentially
   weighted average so the last few weeks count most but a quiet spell does
   not erase what came before:

     td, tn   temperature error by day and by night (local solar time):
              [bias °C, mean absolute error °C, hours counted]
     w        10 m wind speed error: [bias km/h, MAE km/h, hours]
     p        did it rain that day (≥ 1 mm): decayed counts
              [hits, false alarms, misses, correct no-rain days]
     pd       daily rain total error: [MAE mm, days]
     days     days scored

   While a record is young the weights are plain averages (1/days); after
   HALF_LIFE_DAYS days they settle at a fixed 1/HALF_LIFE_DAYS, so the record
   always remembers about the last month. */
(function (root) {
  'use strict';

  /* Named a half-life, but used as the running averages' memory: each day
     moves them by 1/14 (fold), so the mean age of what they remember is 14
     days and a day's weight halves in about 9.4 (ln ½ / ln 13/14) — checked
     2026-10-24. Kept at 14 so the published records stay comparable. */
  const HALF_LIFE_DAYS = 14;
  const RAIN_DAY_MM = 1;
  const F2C = f => (f - 32) * 5 / 9;
  const KT2KMH = 1.852, IN2MM = 25.4;
  const ok = v => v !== null && v !== undefined && Number.isFinite(v);

  /* ── observations ──
     IEM's ASOS CSV: one row per report. Routine METARs go out a few minutes
     before the hour and describe it, so a report counts for the nearest top of
     the hour when it is within 15 minutes of one. The hourly precipitation
     (p01i) is the total since the last routine report: the hour ENDING at
     that top of the hour, which is how Open-Meteo stamps its precipitation. */
  function parseCsv(text) {
    const lines = String(text || '').split(/\r?\n/).filter(l => l && !l.startsWith('#'));
    if (!lines.length) return [];
    const head = lines[0].split(',').map(s => s.trim());
    return lines.slice(1).map(l => {
      const c = l.split(',');
      const o = {};
      head.forEach((h, i) => { o[h] = c[i] === undefined ? null : c[i].trim(); });
      return o;
    });
  }
  const num = v => (v === null || v === undefined || v === '' || v === 'null' || v === 'M') ? null : Number(v);

  function hourlyObs(rows) {
    const out = new Map();                                    // station → Map(hourUnix → {t,w,p,off})
    for (const r of rows) {
      const id = r.station;
      const t = Date.parse(String(r.valid || '').replace(' ', 'T') + (/Z$/.test(r.valid || '') ? '' : 'Z'));
      if (!id || !Number.isFinite(t)) continue;
      const hour = Math.round(t / 3600e3) * 3600;
      const off = Math.abs(t / 1000 - hour);
      if (off > 15 * 60) continue;
      const tf = num(r.tmpf), kt = num(r.sknt), pin = num(r.p01i);
      const v = { t: ok(tf) ? F2C(tf) : null, w: ok(kt) ? kt * KT2KMH : null, p: ok(pin) ? pin * IN2MM : null, off };
      if (!out.has(id)) out.set(id, new Map());
      const m = out.get(id);
      const prev = m.get(hour);
      /* two reports for one hour (a special and a routine): keep the closer,
         but never lose a precipitation total the other one carried */
      if (!prev || off < prev.off) m.set(hour, { ...v, p: ok(v.p) ? v.p : prev ? prev.p : null });
      else if (!ok(prev.p) && ok(v.p)) prev.p = v.p;
    }
    return out;
  }

  /* local solar hour: day is 09–20 solar, night the rest */
  const isDay = (hourUnix, lon) => {
    const h = ((new Date(hourUnix * 1000).getUTCHours() + lon / 15) % 24 + 24) % 24;
    return h >= 9 && h < 21;
  };

  /* ── one day for one station and one model at one lead ──
     fc: Map(hourUnix → {t, w, p}); obs: Map(hourUnix → {t, w, p});
     dayStart: unix seconds of 00 UTC on the day being scored. */
  function scoreDay(fc, obs, dayStart, lon) {
    const d = { td: [], tn: [], w: [], prFc: 0, prOb: 0, prHours: 0 };
    for (let h = dayStart + 3600; h <= dayStart + 86400; h += 3600) {
      const f = fc.get(h), o = obs.get(h);
      if (!f || !o) continue;
      if (ok(f.t) && ok(o.t)) (isDay(h, lon) ? d.td : d.tn).push(f.t - o.t);
      if (ok(f.w) && ok(o.w)) d.w.push(f.w - o.w);
      if (ok(f.p) && ok(o.p)) { d.prFc += f.p; d.prOb += o.p; d.prHours++; }
    }
    const stats = e => e.length ? [e.reduce((a, b) => a + b, 0) / e.length, e.reduce((a, b) => a + Math.abs(b), 0) / e.length, e.length] : null;
    return {
      td: stats(d.td), tn: stats(d.tn), w: stats(d.w),
      /* a rain day only counts when most of its hours were reported */
      rain: d.prHours >= 18 ? { fc: d.prFc, ob: d.prOb } : null
    };
  }

  /* ── folding a day into a record ── */
  function blank() { return { td: [0, 0, 0], tn: [0, 0, 0], w: [0, 0, 0], p: [0, 0, 0, 0], pd: [0, 0], days: 0 }; }
  function fold(rec, day) {
    const r = rec || blank();
    const any = day.td || day.tn || day.w || day.rain;
    if (!any) return r;
    r.days += 1;
    const a = Math.max(1 / r.days, 1 / HALF_LIFE_DAYS);
    for (const k of ['td', 'tn', 'w']) {
      const s = day[k];
      if (!s) continue;
      const first = r[k][2] === 0;
      r[k][0] = first ? s[0] : r[k][0] + a * (s[0] - r[k][0]);
      r[k][1] = first ? s[1] : r[k][1] + a * (s[1] - r[k][1]);
      r[k][2] += s[2];
    }
    if (day.rain) {
      /* counts decay with the same memory, so an old drought fades too */
      for (let i = 0; i < 4; i++) r.p[i] *= (1 - 1 / HALF_LIFE_DAYS);
      const f = day.rain.fc >= RAIN_DAY_MM, o = day.rain.ob >= RAIN_DAY_MM;
      r.p[f && o ? 0 : f ? 1 : o ? 2 : 3] += 1;
      const err = Math.abs(day.rain.fc - day.rain.ob);
      r.pd[0] = r.pd[1] === 0 ? err : r.pd[0] + a * (err - r.pd[0]);
      r.pd[1] += 1;
    }
    return r;
  }

  /* ── reading a record ── */
  /* temperature MAE across day and night, weighted by hours */
  function tempMae(r) {
    if (!r) return null;
    const n = r.td[2] + r.tn[2];
    return n ? (r.td[1] * r.td[2] + r.tn[1] * r.tn[2]) / n : null;
  }
  /* equitable threat score for rain days: 1 perfect, 0 no better than chance */
  function rainSkill(r) {
    if (!r) return null;
    const [a, b, c, d] = r.p, n = a + b + c + d;
    if (n < 5 || a + c < 1) return null;
    const ar = (a + b) * (a + c) / n;
    const den = a + b + c - ar;
    return den > 0 ? (a - ar) / den : null;
  }
  /* rounding for the published files: tenths are plenty and keep them small */
  const r1 = x => Math.round(x * 10) / 10;
  function compact(rec) {
    return {
      td: [r1(rec.td[0]), r1(rec.td[1]), rec.td[2]], tn: [r1(rec.tn[0]), r1(rec.tn[1]), rec.tn[2]],
      w: [r1(rec.w[0]), r1(rec.w[1]), rec.w[2]], p: rec.p.map(r1), pd: [r1(rec.pd[0]), rec.pd[1]], days: rec.days
    };
  }

  /* ── our blend ──
     The forecast this site makes of its own: every model that has a value,
     each with its known bias at this station removed and weighted by how
     close it has been (1 / MAE²), separately for day and night. A model with
     under MIN_DAYS of record gets the plain average's weight and no
     correction — nothing is "corrected" by a record too short to trust.
     score.mjs scores this exactly as it scores the models, so the page can
     show where the blend has earned its place and where it has not. */
  const MIN_DAYS = 7;
  const BLEND_MODELS = ['nbm', 'hrrr', 'gfs', 'ecmwf', 'aifs'];
  function weightsFor(recs, day) {
    const out = {};
    const known = BLEND_MODELS.filter(m => recs && recs[m] && recs[m].days >= MIN_DAYS);
    const all = known.length >= 2;
    for (const m of BLEND_MODELS) {
      const r = recs && recs[m];
      if (all && known.includes(m)) {
        const k = day ? 'td' : 'tn';
        const mae = Math.max(0.4, r[k][2] ? r[k][1] : (r.td[1] + r.tn[1]) / 2);
        out[m] = { w: 1 / (mae * mae), tb: r[k][2] ? r[k][0] : 0, wb: r.w[2] ? r.w[0] : 0 };
      } else if (!all) out[m] = { w: 1, tb: 0, wb: 0 };
    }
    return out;
  }
  /* values: { model: {t, w, p} } for one hour */
  function blend(values, recs, day) {
    const W = weightsFor(recs, day);
    let st = 0, sw = 0, sp = 0, nt = 0, nw = 0, np = 0;
    for (const [m, x] of Object.entries(W)) {
      const v = values[m];
      if (!v) continue;
      if (ok(v.t)) { st += x.w * (v.t - x.tb); nt += x.w; }
      if (ok(v.w)) { sw += x.w * Math.max(0, v.w - x.wb); nw += x.w; }
      if (ok(v.p)) { sp += x.w * v.p; np += x.w; }
    }
    return { t: nt ? st / nt : null, w: nw ? sw / nw : null, p: np ? sp / np : null };
  }
  /* how far apart the models are, for "how sure": the spread of their values */
  function spread(values, key) {
    const xs = Object.values(values).map(v => v && v[key]).filter(ok);
    return xs.length >= 2 ? Math.max(...xs) - Math.min(...xs) : null;
  }

  /* ── our learned forecast ──
     The blend corrects each model by its own average error. This goes one
     step further, the way the NWS's MOS does: for each station it learns how
     the truth sat relative to the models' plain average, from
       · the average itself (a station that runs hot when it is hot),
       · how far each model sat from that average (which model to lean on,
         and when the models disagree, which way the truth usually went),
       · the time of day (a valley that cools faster at night than any model knows).
     It is a ridge regression on running sums that fade by LEARN_DECAY a day,
     so it keeps learning and forgets old seasons; the ridge pulls every term
     to zero (= "the plain average"), so with little evidence it changes
     nothing. score.mjs predicts each day with what was learned BEFORE it, then
     scores it, then learns from it — every number it reports is out of sample. */
  const LEARN_MODELS = ['best', 'nbm', 'hrrr', 'gfs', 'ecmwf', 'aifs'];
  const LEARN_DIM = 2 + LEARN_MODELS.length + 2;
  const LEARN_DECAY = 0.97;            // a day's weight halves in about 23 days
  const LEARN_LAMBDA = 60;             // ridge, in hours of evidence
  const LEARN_MIN_DAYS = 10;
  function learnFeatures(values, key, hourUnix, lon) {
    const xs = LEARN_MODELS.map(m => values[m] && ok(values[m][key]) ? values[m][key] : null);
    const have = xs.filter(v => v !== null);
    if (have.length < 2) return null;
    const mean = have.reduce((a, b) => a + b, 0) / have.length;
    const h = ((new Date(hourUnix * 1000).getUTCHours() + lon / 15) % 24 + 24) % 24;
    const x = [1, (mean - 15) / 10, ...xs.map(v => v === null ? 0 : v - mean), Math.sin(2 * Math.PI * h / 24), Math.cos(2 * Math.PI * h / 24)];
    return { mean, x };
  }
  function learnBlank() { return { A: new Array(LEARN_DIM * LEARN_DIM).fill(0), b: new Array(LEARN_DIM).fill(0), n: 0, days: 0 }; }
  /* fold one day's hours in: samples [{x, r}] where r = truth − mean */
  function learnAdd(acc, samples) {
    const a = acc || learnBlank();
    if (!samples.length) return a;
    for (let i = 0; i < a.A.length; i++) a.A[i] *= LEARN_DECAY;
    for (let i = 0; i < LEARN_DIM; i++) a.b[i] *= LEARN_DECAY;
    a.n *= LEARN_DECAY;
    for (const { x, r } of samples) {
      for (let i = 0; i < LEARN_DIM; i++) {
        a.b[i] += x[i] * r;
        for (let j = 0; j < LEARN_DIM; j++) a.A[i * LEARN_DIM + j] += x[i] * x[j];
      }
      a.n += 1;
    }
    a.days += 1;
    return a;
  }
  /* (A + λI) β = b, by Gaussian elimination with partial pivoting */
  function learnSolve(acc) {
    if (!acc || acc.days < LEARN_MIN_DAYS) return null;
    const n = LEARN_DIM, M = [];
    for (let i = 0; i < n; i++) M.push([...acc.A.slice(i * n, i * n + n).map((v, j) => v + (i === j ? LEARN_LAMBDA : 0)), acc.b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((row, i) => Math.round(row[n] / row[i] * 1000) / 1000);
  }
  function learnPredict(beta, values, key, hourUnix, lon) {
    if (!beta || beta.length !== LEARN_DIM) return null;
    const f = learnFeatures(values, key, hourUnix, lon);
    if (!f) return null;
    let r = 0; for (let i = 0; i < LEARN_DIM; i++) r += beta[i] * f.x[i];
    const v = f.mean + r;
    return key === 'w' ? Math.max(0, v) : v;
  }

  const api = { HALF_LIFE_DAYS, MIN_DAYS, BLEND_MODELS, weightsFor, blend, spread, RAIN_DAY_MM, parseCsv, hourlyObs, isDay, scoreDay, blank, fold, tempMae, rainSkill, compact,
    LEARN_MODELS, LEARN_DIM, LEARN_MIN_DAYS, learnFeatures, learnBlank, learnAdd, learnSolve, learnPredict };
  root.WxVerify = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
