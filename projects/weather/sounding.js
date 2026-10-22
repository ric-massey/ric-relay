/* SOUNDING — the vertical side of the weather room (DESIGN.md §15–17)
   ────────────────────────────────────────────────────────────────────────────
   A column of air in, the numbers a storm chaser reads off a Skew-T out:
   parcel paths and their CAPE / CIN / LCL / LFC / EL, precipitable water, the
   freezing level, mid-level lapse rate, bulk shear, Bunkers storm motion,
   storm-relative helicity, and SPC's fixed-layer tornado parameter.

   Pure arithmetic, no network: the page hands it a profile (a model column
   from Open-Meteo, or a weather balloon from Iowa State) and draws what comes
   back. projects/weather/test/sounding.test.mjs holds the physics to known
   values. Every formula is a standard one and is named where it is used, so a
   meteorologist can check it rather than trust it.

   A profile is levels from the ground up, each
     { p: hPa, z: m above sea level, t: °C, td: °C | null, wd: deg | null, ws: m/s | null }
   The first level is the surface. */
(function (root) {
  'use strict';

  const Rd = 287.04, Cp = 1005.7, Lv = 2.501e6, EPS = 0.622, G = 9.80665, K = 273.15;
  const KAPPA = Rd / Cp;
  const ok = v => v !== null && v !== undefined && Number.isFinite(v);

  /* Bolton (1980) saturation vapour pressure over water, hPa. */
  const es = t => 6.112 * Math.exp(17.67 * t / (t + 243.5));
  const mixing = (p, td) => { const e = es(td); return EPS * e / (p - e); };        // kg/kg
  const theta = (p, t) => (t + K) * Math.pow(1000 / p, KAPPA);                        // K
  const tFromTheta = (th, p) => th * Math.pow(p / 1000, KAPPA) - K;                   // °C
  const virtual = (t, r) => (t + K) * (1 + r / EPS) / (1 + r) - K;                    // °C
  /* dewpoint from a mixing ratio at a pressure (inverse of Bolton) */
  const tdFromMixing = (p, r) => { const e = r * p / (EPS + r); const l = Math.log(e / 6.112); return 243.5 * l / (17.67 - l); };
  /* equivalent potential temperature, Bolton (1980) eq. 43 — for choosing the
     most-unstable parcel */
  function thetaE(p, t, td) {
    const T = t + K, r = mixing(p, td), Tl = lcl(p, t, td).t + K;
    return T * Math.pow(1000 / p, 0.2854 * (1 - 0.28 * r)) * Math.exp((3376 / Tl - 2.54) * r * (1 + 0.81 * r));
  }

  /* Lifting condensation level: Bolton (1980) eq. 15 for its temperature,
     then Poisson's equation for its pressure. */
  function lcl(p, t, td) {
    const T = t + K, Td = Math.min(td, t) + K;
    const Tl = 1 / (1 / (Td - 56) + Math.log(T / Td) / 800) + 56;
    return { p: p * Math.pow(Tl / T, 1 / KAPPA), t: Tl - K };
  }

  /* The pseudo-adiabatic lapse rate dT/dp (K per hPa) — the saturated parcel's
     cooling with height, condensate falling out. */
  function moistDTdp(p, t) {
    const T = t + K, r = mixing(p, t);
    return (Rd * T + Lv * r) / (p * (Cp + Lv * Lv * r * EPS / (Rd * T * T)));
  }
  /* follow it from (p0, t0) to p1 with RK4 in steps of at most `step` hPa
     (2 by default; 10 still agrees to a few thousandths of a degree) */
  function moistLift(p0, t0, p1, step = 2) {
    let p = p0, t = t0;
    const n = Math.max(1, Math.ceil(Math.abs(p1 - p0) / step)), h = (p1 - p0) / n;
    for (let i = 0; i < n; i++) {
      const k1 = moistDTdp(p, t), k2 = moistDTdp(p + h / 2, t + h / 2 * k1);
      const k3 = moistDTdp(p + h / 2, t + h / 2 * k2), k4 = moistDTdp(p + h, t + h * k3);
      t += h / 6 * (k1 + 2 * k2 + 2 * k3 + k4); p += h;
    }
    return t;
  }

  /* ── the environment, interpolated in ln p ── */
  function prepare(levels) {
    const L = levels.filter(l => ok(l.p) && ok(l.t) && ok(l.z)).sort((a, b) => b.p - a.p);
    /* a level below the ground (a model's 1000 hPa under a high surface) is not air */
    const sfc = L[0];
    return sfc ? L.filter(l => l.p <= sfc.p) : [];
  }
  function at(L, p, key) {
    if (!L.length || p > L[0].p || p < L[L.length - 1].p) return null;
    for (let i = 0; i + 1 < L.length; i++) {
      const a = L[i], b = L[i + 1];
      if (p <= a.p && p >= b.p) {
        if (!ok(a[key]) || !ok(b[key])) return ok(a[key]) ? a[key] : ok(b[key]) ? b[key] : null;
        const f = Math.log(a.p / p) / Math.log(a.p / b.p);
        return a[key] + f * (b[key] - a[key]);
      }
    }
    return null;
  }
  const heightAt = (L, p) => at(L, p, 'z');
  function pressureAtHeight(L, z) {
    for (let i = 0; i + 1 < L.length; i++) {
      const a = L[i], b = L[i + 1];
      if (z >= a.z && z <= b.z) return a.p * Math.exp(Math.log(b.p / a.p) * (z - a.z) / (b.z - a.z));
    }
    return null;
  }

  /* ── a parcel's whole journey ──
     Dry adiabat to its LCL, keeping its mixing ratio; the pseudo-adiabat
     above. Buoyancy uses virtual temperature for parcel and environment (the
     correction of Doswell & Rasmussen 1994), as SPC's own soundings do.
     CAPE is the positive area between LFC and EL; CIN the negative area below
     the LFC. */
  function parcel(L, start, top = 100, useVirtual = true) {
    const { p: p0, t: t0, td: td0 } = start;
    const r0 = mixing(p0, td0);
    const th = theta(p0, t0);
    const c = lcl(p0, t0, td0);
    const STEP = 5;
    const path = [];
    let tMoist = null, pPrev = null;
    for (let p = p0; p >= top - 1e-6; p -= STEP) {
      let tp, rp;
      if (p >= c.p) { tp = tFromTheta(th, p); rp = r0; }
      else {
        tMoist = tMoist === null ? moistLift(c.p, c.t, p) : moistLift(pPrev, tMoist, p);
        tp = tMoist; rp = mixing(p, tp);
      }
      pPrev = p;
      const te = at(L, p, 't'), tde = at(L, p, 'td');
      if (te === null) break;
      const re = ok(tde) ? mixing(p, tde) : 0;
      path.push({ p, t: tp, tv: useVirtual ? virtual(tp, rp) : tp, tve: useVirtual ? virtual(te, re) : te, z: heightAt(L, p) });
    }

    /* buoyancy, trapezoids in ln p: Rd · ∫ (Tv,parcel − Tv,env) d ln p.
       LFC: the first level at or above the LCL where the parcel turns warmer
       than its surroundings. EL: the last level where it turns cooler again.
       CAPE: the positive area between them; CIN: the negative area below the
       LFC (MetPy's and SPC's definitions). */
    const B = path.map(q => q.tv - q.tve);
    const cross = i => path[i].p - (path[i].p - path[i + 1].p) * B[i] / (B[i] - B[i + 1]);
    let lfc = null, el = null;
    for (let i = 0; i + 1 < path.length; i++) {
      if (path[i + 1].p > c.p) continue;                     // still below the LCL
      if (lfc === null && B[i + 1] > 0) lfc = B[i] > 0 ? Math.min(path[i].p, c.p) : cross(i);
      if (lfc !== null && B[i] > 0 && B[i + 1] <= 0) el = cross(i);
    }
    if (lfc !== null && el === null && B[B.length - 1] > 0) el = path[path.length - 1].p;
    let cape = 0, cin = 0;
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i], b = path[i + 1];
      const area = Rd * (B[i] + B[i + 1]) / 2 * Math.log(a.p / b.p);
      const mid = (a.p + b.p) / 2;
      if (lfc !== null && mid <= lfc && mid >= el) cape += Math.max(0, area);
      else if (lfc === null || mid > lfc) cin += Math.min(0, area);
    }
    /* No free convection: no CAPE, and no CIN either — "inhibition" is the
       work to reach an LFC, and there is none. Integrating the whole column
       instead printed CIN of −14,905 on a stable night. MetPy's cape_cin
       answers (0, 0) here too. */
    if (cape < 1) { cape = 0; cin = 0; lfc = null; el = null; }

    const zs = L[0].z;
    const agl = p => { const z = p !== null ? heightAt(L, p) : null; return z === null ? null : z - zs; };
    return {
      start, path,
      cape: Math.round(cape), cin: Math.round(cin),
      lcl: { p: c.p, t: c.t, z: agl(Math.min(c.p, L[0].p)) },
      lfc: lfc !== null ? { p: lfc, z: agl(lfc) } : null,
      el: el !== null ? { p: el, z: agl(el) } : null
    };
  }

  /* The three parcels SPC draws. Mixed-layer: the mean potential temperature
     and mixing ratio of the lowest 100 hPa, started at the surface.
     Most-unstable: the highest θe in the lowest 300 hPa. */
  function parcels(L) {
    const s = L[0];
    const sb = { p: s.p, t: s.t, td: s.td };
    let thSum = 0, rSum = 0, n = 0;
    for (let p = s.p; p >= s.p - 100; p -= 5) {
      const t = at(L, p, 't'), td = at(L, p, 'td');
      if (t === null || !ok(td)) continue;
      thSum += theta(p, t); rSum += mixing(p, td); n++;
    }
    const ml = n ? { p: s.p, t: tFromTheta(thSum / n, s.p), td: tdFromMixing(s.p, rSum / n) } : sb;
    let mu = sb, best = -Infinity;
    for (let p = s.p; p >= s.p - 300; p -= 5) {
      const t = at(L, p, 't'), td = at(L, p, 'td');
      if (t === null || !ok(td)) continue;
      const te = thetaE(p, t, td);
      if (te > best) { best = te; mu = { p, t, td }; }
    }
    return { sb, ml, mu };
  }

  /* ── wind ── */
  const toUV = (wd, ws) => [-ws * Math.sin(wd * Math.PI / 180), -ws * Math.cos(wd * Math.PI / 180)];
  function windAt(W, h) {                     // W: [{h (m AGL), u, v}] ascending
    if (!W.length || h < W[0].h || h > W[W.length - 1].h) return null;
    for (let i = 0; i + 1 < W.length; i++) {
      const a = W[i], b = W[i + 1];
      if (h >= a.h && h <= b.h) { const f = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h); return [a.u + f * (b.u - a.u), a.v + f * (b.v - a.v)]; }
    }
    return null;
  }
  function winds(L) {
    const zs = L[0].z;
    return L.filter(l => ok(l.wd) && ok(l.ws)).map(l => { const [u, v] = toUV(l.wd, l.ws); return { h: l.z - zs, u, v, p: l.p }; });
  }
  const mag = ([u, v]) => Math.hypot(u, v);
  function shear(W, h) {
    const a = windAt(W, 0), b = windAt(W, h);
    return a && b ? mag([b[0] - a[0], b[1] - a[1]]) : null;
  }
  /* Bunkers et al. (2000), the non-pressure-weighted 0–6 km form: the mean
     wind, plus 7.5 m/s off to the right (or left) of the shear between the
     0–500 m and 5.5–6 km means. */
  function bunkers(W) {
    const mean = (h0, h1) => {
      let u = 0, v = 0, n = 0;
      for (let h = h0; h <= h1 + 1e-6; h += 250) { const w = windAt(W, h); if (!w) return null; u += w[0]; v += w[1]; n++; }
      return [u / n, v / n];
    };
    const m = mean(0, 6000), lo = mean(0, 500), hi = mean(5500, 6000);
    if (!m || !lo || !hi) return null;
    const s = [hi[0] - lo[0], hi[1] - lo[1]], S = mag(s);
    if (!S) return { right: m, left: m, mean: m };
    const d = [7.5 * s[1] / S, -7.5 * s[0] / S];
    return { right: [m[0] + d[0], m[1] + d[1]], left: [m[0] - d[0], m[1] - d[1]], mean: m };
  }
  /* Storm-relative helicity over 0–h, relative to storm motion c, summed over
     thin layers (Davies-Jones et al. 1990). Positive for a hodograph that
     turns clockwise, the kind that feeds a right-moving supercell. */
  function srh(W, h, c, h0 = 0) {
    if (!c) return null;
    let total = 0, prev = windAt(W, h0);
    if (!prev) return null;
    /* 100 m steps, the last one ending exactly at h — a layer top is
       rarely a round number, and skipping its last few tens of metres lost
       2% of an effective layer's helicity */
    for (let z = Math.min(h0 + 100, h); z <= h + 1e-6; z = z >= h ? Infinity : Math.min(z + 100, h)) {
      const w = windAt(W, z);
      if (!w) return null;
      total += (w[0] - c[0]) * (prev[1] - c[1]) - (prev[0] - c[0]) * (w[1] - c[1]);
      prev = w;
    }
    return total;
  }

  /* ── the effective layer (Thompson et al. 2007) ──
     The air that actually feeds a storm: the lowest unbroken run of levels
     whose own parcels have CAPE ≥ 100 J/kg and CIN ≥ −250 J/kg, looked for
     every 10 hPa through the lowest 300 hPa. Null when no level qualifies.
     Heights are above ground. */
  const EFF = { cape: 100, cin: -250, step: 10, depth: 300 };
  function effectiveLayer(L) {
    const s = L[0];
    let base = null, top = null;
    for (let p = s.p; p >= s.p - EFF.depth && p >= L[L.length - 1].p; p -= EFF.step) {
      const t = at(L, p, 't'), td = at(L, p, 'td');
      const good = t !== null && ok(td) && (pc => pc.cape >= EFF.cape && pc.cin >= EFF.cin)(parcel(L, { p, t, td: Math.min(td, t) }));
      if (good) { if (base === null) base = p; top = p; }
      else if (base !== null) break;
    }
    if (base === null) return null;
    return { pBase: base, pTop: top, base: heightAt(L, base) - s.z, top: heightAt(L, top) - s.z };
  }
  /* bulk wind difference between two heights above ground, m/s */
  function shearBetween(W, h0, h1) {
    const a = windAt(W, h0), b = windAt(W, h1);
    return a && b ? mag([b[0] - a[0], b[1] - a[1]]) : null;
  }
  /* SPC's effective-layer significant tornado parameter (Thompson et al.
     2012) and supercell composite (Thompson et al. 2004), each term clipped
     as SPC clips it:
       STP = MLCAPE/1500 · (2000 − MLLCL)/1000 · ESRH/150 · EBWD/20 · (200 + MLCIN)/150
         LCL term 1 below 1000 m, 0 above 2000; EBWD term 0 under 12.5 m/s,
         capped at 30 m/s (1.5); CIN term 1 above −50, 0 below −200; and 0
         when the effective layer does not start at the ground (an elevated
         storm does not make surface tornadoes).
       SCP = MUCAPE/1000 · ESRH/50 · EBWD term (0 under 10 m/s, 1 over 20)
     Composites of ingredients — hints about the environment, never a
     forecast of a tornado or a supercell. */
  function stpEffective(mlcape, mllcl, mlcin, esrh, ebwd, baseAgl) {
    if (![mlcape, mllcl, mlcin, esrh, ebwd].every(ok)) return null;
    if (baseAgl > 0) return 0;
    const lclT = mllcl < 1000 ? 1 : mllcl > 2000 ? 0 : (2000 - mllcl) / 1000;
    const shT = ebwd < 12.5 ? 0 : Math.min(ebwd, 30) / 20;
    const cinT = mlcin > -50 ? 1 : mlcin < -200 ? 0 : (200 + mlcin) / 150;
    return Math.max(0, mlcape / 1500 * lclT * (esrh / 150) * shT * cinT);
  }
  function scp(mucape, esrh, ebwd) {
    if (![mucape, esrh, ebwd].every(ok)) return null;
    const shT = ebwd < 10 ? 0 : ebwd > 20 ? 1 : ebwd / 20;
    return mucape / 1000 * (esrh / 50) * shT;
  }

  /* ── downdraft CAPE ──
     MetPy's downdraft_cape, step for step: the air with the lowest θe in
     the lowest 400 hPa, cooled to its wet-bulb temperature, brought down the
     pseudo-adiabat to the ground; DCAPE is the area by which it is colder
     (virtually) than the air it falls through, Rd ∫ (Tv_env − Tv_parcel) d ln p,
     trapezoids at the profile's own levels. How hard a rain-cooled downdraft
     can hit the ground — damaging wind potential, never a forecast of it. */
  function dcape(L, { step = 2 } = {}) {
    if (!L.length) return null;
    const s = L[0], layer = L.filter(l => l.p >= s.p - 400 && ok(l.td));
    if (layer.length < 2) return null;
    let src = layer[0], best = Infinity;
    for (const l of layer) { const te = thetaE(l.p, l.t, Math.min(l.td, l.t)); if (te < best) { best = te; src = l; } }
    const c = lcl(src.p, src.t, Math.min(src.td, src.t)), wb = moistLift(c.p, c.t, src.p, step);
    const down = layer.filter(l => l.p >= src.p);
    let area = 0, prev = null, pp = src.p, tp = wb;
    for (const l of down.slice().reverse()) {                        // from the source down to the ground, one descent
      tp = moistLift(pp, tp, l.p, step); pp = l.p;
      const tvE = virtual(l.t, mixing(l.p, Math.min(l.td, l.t))) + K, tvP = virtual(tp, mixing(l.p, tp)) + K;
      const d = { lnp: Math.log(l.p), diff: tvE - tvP };
      if (prev) area += (prev.diff + d.diff) / 2 * (d.lnp - prev.lnp);
      prev = d;
    }
    return { dcape: Math.max(0, Rd * area), p: src.p, wb };
  }

  /* ── the whole analysis ── */
  function analyze(levels) {
    const L = prepare(levels);
    if (L.length < 5 || L[0].p - L[L.length - 1].p < 300) return null;
    const P = parcels(L);
    const sb = parcel(L, P.sb), ml = parcel(L, P.ml), mu = parcel(L, P.mu);
    const W = winds(L);
    const motion = bunkers(W);
    const zs = L[0].z;

    /* precipitable water: (1/g) ∫ q dp, every 5 hPa to 300 hPa, in mm */
    let pw = 0;
    for (let p = L[0].p; p - 5 >= Math.max(300, L[L.length - 1].p); p -= 5) {
      const a = at(L, p, 'td'), b = at(L, p - 5, 'td');
      if (!ok(a) || !ok(b)) continue;
      const qa = mixing(p, a) / (1 + mixing(p, a)), qb = mixing(p - 5, b) / (1 + mixing(p - 5, b));
      pw += (qa + qb) / 2 * 500 / G;
    }
    let frz = null;
    for (let i = 0; i + 1 < L.length; i++) {
      if (L[i].t >= 0 && L[i + 1].t < 0) { frz = L[i].z + (L[i + 1].z - L[i].z) * L[i].t / (L[i].t - L[i + 1].t) - zs; break; }
    }
    if (frz === null && L[0].t < 0) frz = 0;
    const lapse = (p1, p2) => {
      const t1 = at(L, p1, 't'), t2 = at(L, p2, 't'), z1 = heightAt(L, p1), z2 = heightAt(L, p2);
      return [t1, t2, z1, z2].every(ok) && z2 > z1 ? (t1 - t2) / (z2 - z1) * 1000 : null;
    };
    const lapse03 = (() => {
      const p3 = pressureAtHeight(L, zs + 3000);
      return p3 ? (L[0].t - at(L, p3, 't')) / 3 : null;
    })();

    const s1 = shear(W, 1000), s6 = shear(W, 6000);
    const srh1 = srh(W, 1000, motion && motion.right), srh3 = srh(W, 3000, motion && motion.right);
    /* SPC's fixed-layer significant tornado parameter (Thompson et al. 2003),
       each term clipped as SPC clips it. A composite index: a hint about the
       environment, never a forecast that a tornado will happen. */
    let stp = null;
    if (ok(srh1) && ok(s6) && sb.lcl.z !== null) {
      const lclTerm = sb.lcl.z < 1000 ? 1 : sb.lcl.z > 2000 ? 0 : (2000 - sb.lcl.z) / 1000;
      const shTerm = s6 < 12.5 ? 0 : Math.min(s6, 30) / 20;
      stp = Math.max(0, sb.cape / 1500 * lclTerm * (srh1 / 150) * shTerm);
    }
    /* the effective layer and what is measured over it. With no effective
       layer there is no inflow to speak of: ESRH and EBWD are 0, as SPC
       shows them, and so are the composites. */
    const eff = effectiveLayer(L);
    let esrh = 0, ebwd = 0;
    if (eff) {
      esrh = srh(W, Math.max(eff.top, eff.base), motion && motion.right, eff.base);
      /* to half the most-unstable parcel's equilibrium level above the base */
      ebwd = mu.el && mu.el.z !== null ? shearBetween(W, eff.base, eff.base + (mu.el.z - eff.base) / 2) : null;
    }
    const stpE = eff ? stpEffective(ml.cape, ml.lcl.z, ml.cin, esrh, ebwd, eff.base) : 0;
    const dc = dcape(L);
    const scpE = eff ? scp(mu.cape, esrh, ebwd) : 0;
    return {
      levels: L, winds: W,
      sb, ml, mu,
      pw, frz, lapse75: lapse(700, 500), lapse03,
      shear1: s1, shear6: s6, motion, srh1, srh3, stp,
      eff, esrh, ebwd, stpE, scp: scpE, dcape: dc ? dc.dcape : null
    };
  }

  /* ── shaping what the providers send ── */
  const PRESSURE_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100];

  /* One hour of an Open-Meteo column (asked with wind_speed_unit=ms) as a
     profile; the ground first, then every pressure level above it. */
  function fromOpenMeteo(j, i) {
    const h = j && j.hourly;
    if (!h || !Array.isArray(h.time) || h.time[i] === undefined) return null;
    const v = k => (Array.isArray(h[k]) && ok(h[k][i])) ? Number(h[k][i]) : null;
    const ps = v('surface_pressure'), zs = ok(j.elevation) ? Number(j.elevation) : null;
    const out = [];
    if (ok(ps) && ok(zs) && ok(v('temperature_2m'))) {
      out.push({ p: ps, z: zs, t: v('temperature_2m'), td: v('dew_point_2m'), wd: v('wind_direction_10m'), ws: v('wind_speed_10m') });
    }
    for (const p of PRESSURE_LEVELS) {
      const t = v(`temperature_${p}hPa`), z = v(`geopotential_height_${p}hPa`);
      if (!ok(t) || !ok(z) || (ok(ps) && p >= ps) || (ok(zs) && z <= zs)) continue;
      /* ECMWF's AI model publishes humidity, not dewpoint: invert Bolton for it */
      let td = v(`dew_point_${p}hPa`);
      const rh = v(`relative_humidity_${p}hPa`);
      if (!ok(td) && ok(rh) && rh > 0) { const l = Math.log(Math.min(rh, 100) / 100 * es(t) / 6.112); td = 243.5 * l / (17.67 - l); }
      out.push({ p, z, t, td, wd: v(`wind_direction_${p}hPa`), ws: v(`wind_speed_${p}hPa`) });
    }
    return out;
  }
  /* A weather balloon from IEM's RAOB JSON (knots), levels with no
     temperature or height dropped. */
  function fromRaob(j) {
    const pr = j && Array.isArray(j.profiles) && j.profiles[0];
    if (!pr || !Array.isArray(pr.profile)) return null;
    return {
      station: pr.station, valid: Date.parse(pr.valid),
      levels: pr.profile.filter(l => ok(l.pres) && ok(l.tmpc) && ok(l.hght)).map(l => ({
        p: l.pres, z: l.hght, t: l.tmpc, td: ok(l.dwpc) ? l.dwpc : null,
        wd: ok(l.drct) ? l.drct : null, ws: ok(l.sknt) ? l.sknt * 0.514444 : null
      }))
    };
  }

  const api = {
    es, mixing, theta, thetaE, virtual, lcl, moistLift, prepare, at, heightAt, parcel, parcels,
    toUV, windAt, winds, shear, bunkers, srh, analyze, PRESSURE_LEVELS, fromOpenMeteo, fromRaob,
    EFF, effectiveLayer, shearBetween, stpEffective, scp, dcape
  };
  root.Sounding = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
