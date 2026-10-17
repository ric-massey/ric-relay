/* DRAW — the weather room's two instrument drawings, as SVG strings
   ────────────────────────────────────────────────────────────────────────────
   skewT(analysis)      a Skew-T / log-p diagram: isotherms skewed 45-ish,
                        dry and moist adiabats, the environment's temperature
                        and dewpoint, the mixed-layer parcel with its CAPE
                        shaded, LCL / LFC / EL ticks, and wind barbs.
   hodograph(analysis)  the wind's tip from the ground to 10 km, coloured by
                        height, with Bunkers' storm motions.

   Pure: an analysis from sounding.js in, markup out. No DOM, so the tests
   can hold every number in the drawing to being finite. Colours are fixed
   here rather than read from the page because the diagrams sit on their own
   dark panel in both of the page's skies. */
(function (root) {
  'use strict';
  const S = root.Sounding || (typeof require === 'function' ? require('./sounding.js') : null);
  const f1 = x => (Math.round(x * 10) / 10).toString();
  const KT = 1.943844;

  /* ── Skew-T geometry ──
     Pressure on a log axis from 1050 hPa (bottom) to 100 hPa (top);
     temperature from −40 to 50 °C along the bottom, every isotherm leaning
     right by SKEW px per px climbed. */
  const W = 400, H = 440, X0 = 34, X1 = 336, Y0 = 10, Y1 = 418, PB = 1050, PT = 100, TMIN = -40, TMAX = 50, SKEW = 0.6;
  const yOf = p => Y1 - (Y1 - Y0) * Math.log(PB / p) / Math.log(PB / PT);
  const xOf = (t, p) => X0 + (t - TMIN) * (X1 - X0) / (TMAX - TMIN) + (Y1 - yOf(p)) * SKEW;
  const pts = arr => arr.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');

  /* the background never changes: drawn once and kept */
  let BACK = null;
  function background() {
    if (BACK) return BACK;
    const out = [];
    for (const p of [1000, 850, 700, 500, 300, 200, 100]) {
      out.push(`<line x1="${X0}" x2="${X1}" y1="${f1(yOf(p))}" y2="${f1(yOf(p))}" stroke="rgba(255,255,255,.18)"/>`);
      out.push(`<text x="${X0 - 4}" y="${f1(yOf(p) + 4)}" text-anchor="end" font-size="11" fill="#c8d0da">${p}</text>`);
    }
    for (let t = -110; t <= 50; t += 10) {
      out.push(`<line x1="${f1(xOf(t, PB))}" y1="${Y1}" x2="${f1(xOf(t, PT))}" y2="${Y0}" stroke="${t === 0 ? 'rgba(124,196,255,.55)' : 'rgba(255,255,255,.10)'}"/>`);
      const xb = xOf(t, PB);
      if (xb >= X0 && xb <= X1 && t % 20 === 0) out.push(`<text x="${f1(xb)}" y="${Y1 + 14}" text-anchor="middle" font-size="11" fill="#c8d0da">${t}</text>`);
    }
    /* dry adiabats (θ constant) */
    for (let th = 250; th <= 470; th += 10) {
      const line = [];
      for (let p = PB; p >= PT; p -= 25) line.push([xOf(th * Math.pow(p / 1000, 0.2857) - 273.15, p), yOf(p)]);
      out.push(`<polyline points="${pts(line)}" fill="none" stroke="rgba(255,190,120,.16)"/>`);
    }
    /* moist adiabats from their 1000 hPa temperature */
    for (let t0 = -10; t0 <= 35; t0 += 5) {
      const line = [[xOf(t0, 1000), yOf(1000)]];
      let t = t0;
      for (let p = 1000; p > 200; p -= 25) { t = S.moistLift(p, t, p - 25); line.push([xOf(t, p - 25), yOf(p - 25)]); }
      out.push(`<polyline points="${pts(line)}" fill="none" stroke="rgba(120,220,160,.16)" stroke-dasharray="4 4"/>`);
    }
    BACK = out.join('');
    return BACK;
  }

  /* A wind barb at (x, y), the staff pointing into the wind, speed in knots,
     barbs on the clockwise side as in the northern hemisphere. */
  function barb(x, y, dir, kt) {
    if (!Number.isFinite(dir) || !Number.isFinite(kt)) return '';
    if (kt < 2.5) return `<circle cx="${f1(x)}" cy="${f1(y)}" r="3" fill="none" stroke="#e9ecef" stroke-width="1.2"/>`;
    const L = 24, r = dir * Math.PI / 180;
    const ux = Math.sin(r), uy = -Math.cos(r);          // along the staff, toward where the wind comes from
    const px = -uy, py = ux;                             // perpendicular, clockwise side
    const ex = x + ux * L, ey = y + uy * L;
    let s = `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(ex)}" y2="${f1(ey)}"/>`;
    let left = Math.round(kt / 5) * 5, d = 0;
    while (left >= 50) {
      const ax = ex - ux * d, ay = ey - uy * d, bx = ex - ux * (d + 6), by = ey - uy * (d + 6);
      s += `<polygon points="${f1(ax)},${f1(ay)} ${f1(ax + px * 10)},${f1(ay + py * 10)} ${f1(bx)},${f1(by)}" fill="#e9ecef"/>`;
      d += 8; left -= 50;
    }
    while (left >= 10) {
      const ax = ex - ux * d, ay = ey - uy * d;
      s += `<line x1="${f1(ax)}" y1="${f1(ay)}" x2="${f1(ax + px * 10 + ux * 3)}" y2="${f1(ay + py * 10 + uy * 3)}"/>`;
      d += 4; left -= 10;
    }
    if (left >= 5) {
      if (d === 0) d = 4;
      const ax = ex - ux * d, ay = ey - uy * d;
      s += `<line x1="${f1(ax)}" y1="${f1(ay)}" x2="${f1(ax + px * 5 + ux * 1.5)}" y2="${f1(ay + py * 5 + uy * 1.5)}"/>`;
    }
    return `<g stroke="#e9ecef" stroke-width="1.3" stroke-linecap="round">${s}</g>`;
  }

  function skewT(a, opts = {}) {
    if (!a) return '';
    const L = a.levels;
    const env = L.map(l => [xOf(l.t, l.p), yOf(l.p)]);
    const dew = L.filter(l => Number.isFinite(l.td)).map(l => [xOf(l.td, l.p), yOf(l.p)]);
    const pc = a.ml;
    const parcel = pc.path.map(q => [xOf(q.t, q.p), yOf(q.p)]);

    /* CAPE: between the parcel and the environment, LFC to EL */
    let shade = '';
    if (pc.lfc && pc.el) {
      const up = pc.path.filter(q => q.p <= pc.lfc.p && q.p >= pc.el.p);
      if (up.length > 1) {
        const a1 = up.map(q => [xOf(q.t, q.p), yOf(q.p)]);
        const a2 = up.slice().reverse().map(q => [xOf(S.at(L, q.p, 't'), q.p), yOf(q.p)]);
        shade = `<polygon points="${pts(a1.concat(a2))}" fill="rgba(255,107,107,.28)"/>`;
      }
    }
    /* labels never sit on each other: LCL and LFC are often a few hPa apart */
    let lastY = Infinity;
    const tick = (lvl, label) => {
      if (!lvl || !Number.isFinite(lvl.p) || lvl.p > PB || lvl.p < PT) return '';
      const y = yOf(lvl.p), ty = Math.min(y + 4, lastY - 12);
      lastY = ty;
      return `<line x1="${X1 - 18}" x2="${X1}" y1="${f1(y)}" y2="${f1(y)}" stroke="#ffd43b" stroke-width="2"/><text x="${X1 - 21}" y="${f1(ty)}" text-anchor="end" font-size="11" fill="#ffd43b">${label}</text>`;
    };

    /* barbs: every level on a model, about every 25 hPa on a balloon */
    let lastP = Infinity;
    const barbs = L.filter(l => Number.isFinite(l.wd) && Number.isFinite(l.ws) && l.p >= PT).filter(l => {
      if (lastP - l.p < 24) return false; lastP = l.p; return true;
    }).map(l => barb(372, yOf(l.p), l.wd, l.ws * KT)).join('');

    const title = opts.title ? `<title>${opts.title}</title>` : '';
    return `<svg class="skewt" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.label || 'Skew-T diagram'}">${title}
      <defs><clipPath id="skc"><rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}"/></clipPath></defs>
      <rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="#0c1422" stroke="rgba(255,255,255,.25)"/>
      <g clip-path="url(#skc)">${background()}${shade}
        <polyline points="${pts(parcel)}" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-dasharray="5 4"/>
        <polyline points="${pts(dew)}" fill="none" stroke="#51cf66" stroke-width="2.4" stroke-linejoin="round"/>
        <polyline points="${pts(env)}" fill="none" stroke="#ff6b6b" stroke-width="2.4" stroke-linejoin="round"/>
      </g>
      ${tick(pc.lcl, 'LCL')}${tick(pc.lfc, 'LFC')}${tick(pc.el, 'EL')}
      <line x1="372" x2="372" y1="${Y0}" y2="${Y1}" stroke="rgba(255,255,255,.12)"/>
      ${barbs}
      <text x="${X1}" y="${Y1 + 14}" text-anchor="end" font-size="11" fill="#c8d0da">°C</text>
      <text x="6" y="${Y0 + 4}" font-size="11" fill="#c8d0da">hPa</text>
    </svg>`;
  }

  /* ── hodograph ── */
  const BANDS = [[0, 1000, '#ff6b6b'], [1000, 3000, '#51cf66'], [3000, 6000, '#ffd43b'], [6000, 10000, '#74c0fc']];
  function hodograph(a, opts = {}) {
    if (!a || !a.winds.length) return '';
    const Wd = a.winds;
    const top = Math.min(10000, Wd[Wd.length - 1].h);
    const samples = [];
    for (let h = 0; h <= top; h += 250) { const w = S.windAt(Wd, h); if (w) samples.push({ h, u: w[0] * KT, v: w[1] * KT }); }
    if (samples.length < 2) return '';
    const m = a.motion;
    const extra = m ? [m.right, m.left, m.mean].map(([u, v]) => Math.hypot(u, v) * KT) : [];
    const max = Math.max(30, ...samples.map(s => Math.hypot(s.u, s.v)), ...extra);
    const ring = Math.ceil(max / 10) * 10;
    const R = 130, C = 150, k = R / ring;
    const X = u => C + u * k, Y = v => C - v * k;
    const out = [];
    for (let r = 10; r <= ring; r += 10) {
      out.push(`<circle cx="${C}" cy="${C}" r="${f1(r * k)}" fill="none" stroke="rgba(255,255,255,${r % 20 ? '.08' : '.18'})"/>`);
      if (r % 20 === 0) out.push(`<text x="${f1(C - r * k * 0.71 - 2)}" y="${f1(C + r * k * 0.71 + 11)}" text-anchor="end" font-size="11" fill="#c8d0da">${r}</text>`);
    }
    out.push(`<line x1="${C - R}" x2="${C + R}" y1="${C}" y2="${C}" stroke="rgba(255,255,255,.18)"/><line y1="${C - R}" y2="${C + R}" x1="${C}" x2="${C}" stroke="rgba(255,255,255,.18)"/>`);
    for (const [h0, h1, col] of BANDS) {
      const seg = samples.filter(s => s.h >= h0 && s.h <= h1);
      if (seg.length > 1) out.push(`<polyline points="${pts(seg.map(s => [X(s.u), Y(s.v)]))}" fill="none" stroke="${col}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
    }
    for (const h of [1000, 3000, 6000]) {
      const s = samples.find(q => q.h === h);
      if (s) out.push(`<circle cx="${f1(X(s.u))}" cy="${f1(Y(s.v))}" r="3.5" fill="#0c1422" stroke="#fff"/><text x="${f1(X(s.u) + 6)}" y="${f1(Y(s.v) - 5)}" font-size="11" fill="#fff">${h / 1000}</text>`);
    }
    if (m) {
      const [ru, rv] = m.right.map(x => x * KT), [lu, lv] = m.left.map(x => x * KT), [mu, mv] = m.mean.map(x => x * KT);
      out.push(`<circle cx="${f1(X(ru))}" cy="${f1(Y(rv))}" r="5" fill="#ff922b"/><text x="${f1(X(ru) + 8)}" y="${f1(Y(rv) + 4)}" font-size="11" fill="#ffc078">RM</text>`);
      out.push(`<circle cx="${f1(X(lu))}" cy="${f1(Y(lv))}" r="5" fill="none" stroke="#a5d8ff" stroke-width="2"/><text x="${f1(X(lu) + 8)}" y="${f1(Y(lv) + 4)}" font-size="11" fill="#a5d8ff">LM</text>`);
      out.push(`<rect x="${f1(X(mu) - 4)}" y="${f1(Y(mv) - 4)}" width="8" height="8" fill="#e9ecef"/>`);
    }
    return `<svg class="hodo" viewBox="0 0 300 300" role="img" aria-label="${opts.label || 'Hodograph'}">
      <rect width="300" height="300" rx="10" fill="#0c1422"/>${out.join('')}
      <text x="8" y="292" font-size="11" fill="#c8d0da">kt</text></svg>`;
  }

  const api = { skewT, hodograph, barb, xOf, yOf };
  root.WxDraw = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
