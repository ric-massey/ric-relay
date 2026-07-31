/* ══════════════════════════════════════════════════════════════════════
   galaxy.js — the Milky Way, as light rather than as wallpaper.

   The band across the sky is not a picture pasted behind the stars. It is
   the same thing the catalogued stars are: light arriving from a direction,
   with a brightness and a temperature. It gets aberrated, Doppler-shifted
   and beamed by exactly the same code, because it is exactly the same
   physics.

   What it is made of: the Galaxy is integrated along every line of sight.
   Stars in an exponential disc plus a boxy bar, dimmed by dust in a thinner
   disc of its own, summed from here out to 25 kpc.

     ∫ ρ⋆(s) · e^(−τ(s)) ds        τ(s) = κ ∫₀ˢ ρ_dust ds′

   That integral is where the shape comes from, and it is worth saying why
   it matters: the Great Rift is not a thing painted on the sky. It is the
   Galaxy's own dust, sitting in the same plane as its own light, in front
   of it. A smooth luminous band reads as fog. A band with holes torn in it
   reads as something enormous and three-dimensional with clouds in front of
   it — which is what it is.

   ── where this is a model rather than a measurement ──

   The disc, bar and dust are standard parameterisations, not a survey. The
   named dark clouds — the Coalsack, the Pipe, Rho Ophiuchi, the Aquila and
   Cygnus Rifts — sit at their real galactic coordinates with roughly their
   real sizes and depths, but their outlines are ellipses, not their true
   shapes. The fine mottling is noise. The large structure is physics; the
   lace on it is texture, and the exhibit says so out loud.

   References for the parameters: Bland-Hawthorn & Gerhard (2016) for R₀ and
   the disc scale lengths; Dwek et al. (1995) G2 for the bar; a local visual
   extinction of about 0.8 mag/kpc in the plane.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const R0 = 8.178;          // Sun's galactocentric radius, kpc
  const H_R = 2.6;           // thin disc scale length, kpc
  const H_Z = 0.30;          // thin disc scale height, kpc
  const H_R_THICK = 3.6;
  const H_Z_THICK = 0.90;
  const THICK_FRAC = 0.05;

  const BAR_ANGLE = 25 * Math.PI / 180;   // bar's angle to the Sun–centre line
  const BAR_X = 1.59, BAR_Y = 0.45, BAR_Z = 0.33;   // Dwek G2 axis scales, kpc
  const BAR_AMP = 8.0;

  const DUST_H_R = 3.5;
  const DUST_H_Z = 0.120;    // dust is in a much thinner layer than the stars —
                             // which is the entire reason there is a rift at all
  const A_V_LOCAL = 0.8;     // magnitudes of extinction per kpc, here, in the plane

  // Peak surface brightness of the band, mag per square arcsecond. The map is
  // normalised to this, so only the *shape* of the integral has to be right.
  const PEAK_MAG_ARCSEC2 = 21.4;

  // Integrated starlight is dominated by K giants. 4,500 K is the defensible
  // effective colour temperature, and it is why the bulge is faintly warm
  // rather than grey — a real effect, and a very small one.
  const T_DIFFUSE = 4500;

  const NL = 512, NB = 256;  // map resolution: 0.7° per texel

  /* ── equatorial (J2000) → galactic ─────────────────────────────────
     Built from the two directions that define the system rather than from a
     chain of angles: the north galactic pole is +z, the galactic centre is
     +x, and +y follows. Simpler to read and simpler to check — sample the
     centre and you should land at l = 0, b = 0. */
  const M = (() => {
    const unit = (raDeg, decDeg) => {
      const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180;
      const c = Math.cos(dec);
      return [c * Math.cos(ra), c * Math.sin(ra), Math.sin(dec)];
    };
    const z = unit(192.85948, 27.12825);         // north galactic pole, J2000
    let x = unit(266.40510, -28.93617);          // galactic centre, J2000
    const dot = x[0] * z[0] + x[1] * z[1] + x[2] * z[2];
    x = [x[0] - dot * z[0], x[1] - dot * z[1], x[2] - dot * z[2]];
    const n = Math.hypot(x[0], x[1], x[2]);
    x = [x[0] / n, x[1] / n, x[2] / n];
    const y = [
      z[1] * x[2] - z[2] * x[1],
      z[2] * x[0] - z[0] * x[2],
      z[0] * x[1] - z[1] * x[0],
    ];
    return { x, y, z };
  })();

  /* ── the Galaxy ────────────────────────────────────────────────────── */
  function starDensity(xg, yg, zg) {
    const R = Math.hypot(xg, yg);
    const thin = Math.exp(-R / H_R - Math.abs(zg) / H_Z);
    const thick = THICK_FRAC * Math.exp(-R / H_R_THICK - Math.abs(zg) / H_Z_THICK);
    const cb = Math.cos(BAR_ANGLE), sb = Math.sin(BAR_ANGLE);
    const xb = xg * cb + yg * sb, yb = -xg * sb + yg * cb;
    const a = (xb / BAR_X) * (xb / BAR_X) + (yb / BAR_Y) * (yb / BAR_Y);
    const c = (zg / BAR_Z) * (zg / BAR_Z);
    const rs = Math.sqrt(Math.sqrt(a * a + c * c));
    const bar = BAR_AMP * Math.exp(-0.5 * rs * rs);
    return thin + thick + bar;
  }

  function dustDensity(xg, yg, zg) {
    const R = Math.hypot(xg, yg);
    return Math.exp(-R / DUST_H_R - Math.abs(zg) / DUST_H_Z);
  }

  const KAPPA = A_V_LOCAL / Math.exp(-R0 / DUST_H_R) / 1.0857;  // → optical depth per kpc

  /* Foreground dark clouds, at their real coordinates. Their outlines are
     ellipses; their positions, sizes and depths are roughly what is
     published. These are the shapes people actually recognise in a dark sky. */
  const CLOUDS = [
    // name                    l      b     semi-major  semi-minor  tilt°  A_V
    { name: "Coalsack",        l: 303.0, b: -0.5, a: 4.0, b2: 3.0, t: 20, av: 1.6 },
    { name: "Pipe Nebula",     l: 0.5,   b: 4.5,  a: 3.5, b2: 1.4, t: 65, av: 2.2 },
    { name: "Rho Ophiuchi",    l: 353.5, b: 16.5, a: 4.5, b2: 3.0, t: 30, av: 1.8 },
    { name: "Aquila Rift",     l: 30.0,  b: 4.0,  a: 12.0, b2: 4.5, t: 25, av: 1.7 },
    { name: "Cygnus Rift",     l: 79.0,  b: -1.0, a: 10.0, b2: 4.0, t: 15, av: 1.9 },
    { name: "Taurus",          l: 172.0, b: -15.0, a: 6.0, b2: 4.0, t: 0,  av: 1.2 },
    { name: "Corona Australis", l: 0.0,  b: -18.0, a: 3.0, b2: 1.2, t: 40, av: 1.3 },
    { name: "Chamaeleon",      l: 300.0, b: -16.0, a: 3.5, b2: 2.0, t: 0,  av: 1.1 },
    { name: "Lupus",           l: 339.0, b: 12.0, a: 4.0, b2: 2.5, t: 40, av: 1.2 },
  ];

  /* ── the map ───────────────────────────────────────────────────────
     Built on first use, not at load. Integrating 131,072 lines of sight
     costs the better part of a second of blocking main-thread time, and
     when the photographic sky is available this model is never sampled at
     all — so paying for it up front delayed the first frame by most of a
     second in exchange for nothing. It is now built the first time somebody
     actually asks for a direction, which in practice means only on machines
     with no WebGL.

     The alternative — shipping a megabyte of baked pixels — was rejected
     because nobody could check them against the model that produced them. */
  let map = null;

  function build() {
    map = new Float32Array(NL * NB);
    // Two-part march: fine near the Sun, where the dust does its work, then
    // coarse out to the edge, where only the accumulated starlight matters.
    const NEAR_N = 44, NEAR_STEP = 0.05;    // 0 → 2.2 kpc
    const FAR_N = 40, FAR_STEP = 0.6;       // 2.2 → 26.2 kpc
    let peak = 0;

    for (let j = 0; j < NB; j++) {
      const b = ((j + 0.5) / NB - 0.5) * Math.PI;      // −90° … +90°
      const cb = Math.cos(b), sb = Math.sin(b);
      for (let i = 0; i < NL; i++) {
        const l = ((i + 0.5) / NL) * 2 * Math.PI;      // 0 … 360°
        const dx = cb * Math.cos(l), dy = cb * Math.sin(l), dz = sb;

        let sum = 0, tau = 0, s = 0;
        for (let k = 0; k < NEAR_N + FAR_N; k++) {
          const step = k < NEAR_N ? NEAR_STEP : FAR_STEP;
          s += step;
          const xg = s * dx - R0, yg = s * dy, zg = s * dz;
          tau += KAPPA * dustDensity(xg, yg, zg) * step;
          sum += starDensity(xg, yg, zg) * Math.exp(-tau) * step;
        }
        map[j * NL + i] = sum;
        if (sum > peak) peak = sum;
      }
    }

    // Normalise the shape to the published peak surface brightness, then
    // knock out the foreground clouds.
    const peakLux = 2.54e-6 * Math.pow(10, -0.4 * PEAK_MAG_ARCSEC2) / 2.3504e-11;
    const k = peakLux / peak;
    for (let j = 0; j < NB; j++) {
      const bDeg = ((j + 0.5) / NB - 0.5) * 180;
      const cosB = Math.cos(bDeg * Math.PI / 180);
      for (let i = 0; i < NL; i++) {
        const lDeg = ((i + 0.5) / NL) * 360;
        let ext = 0;
        for (const c of CLOUDS) {
          let dl = (lDeg - c.l + 540) % 360 - 180;
          dl *= cosB;                            // degrees on the sky, not in l
          const db = bDeg - c.b;
          const t = c.t * Math.PI / 180;
          const u = (dl * Math.cos(t) + db * Math.sin(t)) / c.a;
          const v = (-dl * Math.sin(t) + db * Math.cos(t)) / c.b2;
          const r2 = u * u + v * v;
          if (r2 < 4) ext += c.av * Math.exp(-r2 * 1.1);
        }
        map[j * NL + i] *= k * Math.exp(-ext / 1.0857);
      }
    }
  }

  /* ── noise ─────────────────────────────────────────────────────────
     The map is smooth at half a degree. Real integrated starlight is not:
     it is millions of unresolved stars and ragged dust, clumpy at every
     scale. This is texture rather than data, and it is the difference
     between a band that reads as fog and one that reads as an object. */
  const PERM = new Uint8Array(512);
  (function seed() {
    let x = 20260730;
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      const j = x % (i + 1);
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  })();

  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const h = (a, b) => PERM[(PERM[a & 255] + (b & 255)) & 255] / 255;
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return (a + (b - a) * u) + ((c - a) + (d - c) * u - (b - a) * u) * v;
  }

  function mottle(l, b) {
    // Three octaves, anisotropic: structure runs along the plane, as it does
    // in every dark cloud complex.
    let n = 0.55 * vnoise(l * 0.22, b * 0.55)
          + 0.30 * vnoise(l * 0.75, b * 1.9)
          + 0.15 * vnoise(l * 2.3, b * 5.5);
    return 0.45 + 1.25 * n * n;
  }

  /* ── sampling ──────────────────────────────────────────────────────── */

  /** Surface brightness, in lux per steradian, looking along an equatorial
      J2000 unit vector. This is the quantity that transforms as D⁴. */
  function sampleEquatorial(x, y, z) {
    if (!map) build();
    const gx = M.x[0] * x + M.x[1] * y + M.x[2] * z;
    const gy = M.y[0] * x + M.y[1] * y + M.y[2] * z;
    const gz = M.z[0] * x + M.z[1] * y + M.z[2] * z;

    const b = Math.asin(Math.max(-1, Math.min(1, gz)));
    let l = Math.atan2(gy, gx);
    if (l < 0) l += 2 * Math.PI;

    const fi = (l / (2 * Math.PI)) * NL - 0.5;
    const fj = ((b / Math.PI) + 0.5) * NB - 0.5;
    let i0 = Math.floor(fi), j0 = Math.floor(fj);
    const tx = fi - i0, ty = fj - j0;
    const i1 = (i0 + 1) % NL; i0 = ((i0 % NL) + NL) % NL;
    const j1 = Math.min(NB - 1, j0 + 1); j0 = Math.max(0, Math.min(NB - 1, j0));

    const v00 = map[j0 * NL + i0], v10 = map[j0 * NL + i1];
    const v01 = map[j1 * NL + i0], v11 = map[j1 * NL + i1];
    const base = (v00 + (v10 - v00) * tx) + ((v01 - v00) + (v11 - v01) * tx - (v10 - v00) * tx) * ty;
    if (base <= 0) return 0;

    const lDeg = l * 180 / Math.PI, bDeg = b * 180 / Math.PI;
    return base * mottle(lDeg, bDeg);
  }

  window.HSAT_GALAXY = { sampleEquatorial, T_DIFFUSE, CLOUDS, PEAK_MAG_ARCSEC2 };
})();
