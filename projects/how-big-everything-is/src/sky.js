/* ══════════════════════════════════════════════════════════════════════
   The sky.

   Everything behind the objects. It exists because the exhibit spends
   forty-five decades on one black rectangle, and a black rectangle says
   the same thing at every one of them — so the visitor gets no sense of
   having travelled between a laboratory and the space between galaxies.

   The rule: **the backdrop belongs to the scale, not to the page.** There
   is no decorative star wallpaper following you from the electron to the
   observable universe. Each regime has its own sky, and they cross-fade
   into each other on the same axis everything else here runs on — the
   width of the frame in metres.

     10⁻⁹ … 10⁻³   suspended matter. A virus and a blood cell are in
                    water, and water has things drifting in it.
     10⁻³ … 10⁷    nothing. You are standing on a planet in daylight.
     10⁷ … 10²⁰    stars, in three layers at different depths.
     10¹⁶ …         interstellar haze, and the band of our own galaxy
                    overhead, because from here you are inside it.
     10²⁰ … 10²²    the individual stars merge into dust and the band.
     10²² …         stars are gone. Galaxies, in their place.
     10²⁴ …         galaxies resolve into filaments, and the filaments
                    expand.

   ── parallax, in a page that never pans ─────────────────────────────
   This camera only ever zooms, so the usual sideways parallax has
   nothing to work with. What it has instead is depth in the zoom: a
   near layer converges on the centre of the frame at the same rate the
   objects do, and a far layer barely moves at all. That is real
   parallax — it is just pointed along the axis this exhibit travels on.

   It is implemented as a field that is statistically invariant under
   zoom. Each star holds a phase in *log radius* rather than a position;
   zooming out walks every phase toward the middle, and a star that
   reaches the middle wraps back out to the rim. So the field never runs
   out and never repeats visibly, across all forty-five decades, out of
   six hundred stored numbers.

   ── cost ────────────────────────────────────────────────────────────
   This draws under an exhibit that is already painting twenty-three
   objects a frame, so: no per-item `fillStyle` strings. Items are
   pre-sorted into colour buckets at build time and the per-item alpha
   goes through `globalAlpha`, which is a number and not a parse. Stars
   are `fillRect`, not `arc`.
   ══════════════════════════════════════════════════════════════════════ */
window.SKY = (() => {
  "use strict";

  const TAU = Math.PI * 2;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const sstep = (a, b, v) => { const x = clamp01((v - a) / (b - a)); return x * x * (3 - 2 * x); };
  /* Full between b and c, absent below a and above d. Every regime in
     this file is one of these, and the overlaps are where the sky
     changes character rather than switching. */
  const band = (v, a, b, c, d) => Math.min(sstep(a, b, v), 1 - sstep(c, d, v));

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── the invariant field ───────────────────────────────────────────
     `x` is a phase in log radius, 0 at the centre and 1 at the rim.
     Zooming out subtracts from it, so items converge on the middle of
     the frame — the same direction every object on the ladder moves —
     and wrap back out to the rim when they arrive.

     Radius is exponential in `x`, which piles items up near the centre
     if you count them. That is compensated by drawing them smaller and
     dimmer there, which is also what perspective does: the thing you
     are converging on is the thing that is furthest away. */
  const RMIN = 0.011, RMAX = 1.65;
  const LK = Math.log(RMAX / RMIN);

  function field(seed, n, palette) {
    const r = rng(seed);
    const buckets = palette.map((c) => ({ c, items: [] }));
    for (let i = 0; i < n; i++) {
      const it = {
        th: r() * TAU,
        x: r(),
        b: 0.18 + r() * 0.82,
        tw: r() * TAU,
        tr: 0.5 + r() * 1.7,
        e: 0.22 + r() * 0.55,        // ellipticity, for the galaxies
        ro: r() * Math.PI,           // inclination, for the galaxies
      };
      buckets[Math.floor(r() * buckets.length)].items.push(it);
    }
    return buckets;
  }

  /* Three depths. `q` is decades of phase per decade of zoom: the near
     layer tracks the frame exactly, the far one is nine parts in fifty
     slower and reads as being much further off. */
  const LAYERS = [
    { q: 0.20, sz: 1.05, tw: 0.30, f: field(1301, 210, ["#cfd8f2", "#e9eef8", "#f3e2cf"]) },
    { q: 0.52, sz: 1.45, tw: 0.55, f: field(1307, 165, ["#dfe6f8", "#ffffff", "#ffe4c4"]) },
    { q: 1.00, sz: 2.10, tw: 0.85, f: field(1319, 105, ["#eaf0ff", "#ffffff", "#ffd9ad"]) },
  ];

  /* The extra depth that arrives at the nearest-star frame. Not more of
     the same stars brighter — fainter and more numerous, which is what
     "denser stellar depth" actually looks like through a longer
     exposure. */
  const DEEP = { q: 0.34, sz: 0.85, tw: 0.2, f: field(1327, 260, ["#b9c6e6", "#d5dcf0"]) };

  const GAL_NEAR = { q: 0.72, sz: 1.0, f: field(1361, 120, ["#e6e2f2", "#fff0dc", "#dfe8ff"]) };
  const GAL_FAR = { q: 0.24, sz: 0.62, f: field(1373, 150, ["#c9c6dc", "#e0d6c6"]) };

  /* ── stars ──────────────────────────────────────────────────────── */
  function drawStars(ctx, layer, cx, cy, R, cw, ch, phase, mul, clock) {
    const sz0 = layer.sz;
    for (const bucket of layer.f) {
      ctx.fillStyle = bucket.c;
      for (const s of bucket.items) {
        let x = s.x - phase;
        x -= Math.floor(x);
        let a = mul * s.b * sstep(0, 0.16, x) * (1 - sstep(0.90, 1, x));
        if (a < 0.014) continue;
        const rr = RMIN * Math.exp(x * LK) * R;
        const px = cx + Math.cos(s.th) * rr;
        const py = cy + Math.sin(s.th) * rr;
        if (px < -3 || px > cw + 3 || py < -3 || py > ch + 3) continue;
        a *= 1 - layer.tw * (0.5 + 0.5 * Math.sin(clock * s.tr + s.tw));
        const sz = sz0 * (0.42 + 0.85 * x) * (0.55 + 0.75 * s.b);
        ctx.globalAlpha = a;
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ── galaxies ───────────────────────────────────────────────────────
     What replaces the stars at the Local Group, because at that frame
     every point of light in the sky is a galaxy and none of them is a
     star. Drawn as an inclined disc with a core, and the inclinations
     are random, which is the one thing that makes a field of these read
     as galaxies rather than as smudges. */
  function drawGalaxies(ctx, layer, cx, cy, R, cw, ch, phase, mul, clock) {
    for (const bucket of layer.f) {
      ctx.fillStyle = bucket.c;
      for (const s of bucket.items) {
        let x = s.x - phase;
        x -= Math.floor(x);
        let a = mul * s.b * sstep(0, 0.18, x) * (1 - sstep(0.88, 1, x));
        if (a < 0.02) continue;
        const rr = RMIN * Math.exp(x * LK) * R;
        const px = cx + Math.cos(s.th) * rr;
        const py = cy + Math.sin(s.th) * rr;
        const sz = layer.sz * (0.9 + 3.4 * x) * (0.5 + 0.8 * s.b);
        if (px < -sz - 2 || px > cw + sz + 2 || py < -sz - 2 || py > ch + sz + 2) continue;
        ctx.globalAlpha = a * 0.55;
        ctx.beginPath();
        ctx.ellipse(px, py, sz, sz * s.e, s.ro, 0, TAU);
        ctx.fill();
        if (sz > 1.4) {
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.ellipse(px, py, sz * 0.34, sz * 0.34 * Math.max(0.5, s.e), s.ro, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ── interstellar haze ──────────────────────────────────────────────
     The nearest-star frame is the first one where the space between the
     objects is not empty: it is thin gas, and the gas glows and blocks.
     Six clouds, drifting on their own periods, so nothing on screen ever
     repeats a position. */
  const HAZE = (() => {
    const r = rng(1409), out = [];
    for (let i = 0; i < 6; i++) {
      out.push([
        (r() - 0.5) * 1.5, (r() - 0.5) * 1.1, 0.30 + r() * 0.45,
        r() * TAU, 0.012 + r() * 0.02,
        i < 2 ? [96, 78, 130] : i < 4 ? [58, 84, 128] : [130, 96, 74],
      ]);
    }
    return out;
  })();

  function drawHaze(ctx, cx, cy, R, w, clock) {
    for (const [ux, uy, ur, ph, sp, col] of HAZE) {
      const x = cx + (ux + 0.10 * Math.sin(clock * sp + ph)) * R;
      const y = cy + (uy + 0.07 * Math.cos(clock * sp * 1.3 + ph)) * R;
      const rr = ur * R * (1 + 0.05 * Math.sin(clock * sp * 0.7 + ph));
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      const a = 0.105 * w;
      g.addColorStop(0, "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + a + ")");
      g.addColorStop(0.55, "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + a * 0.4 + ")");
      g.addColorStop(1, "rgba(" + col[0] + "," + col[1] + "," + col[2] + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
    }
  }

  /* ── the galactic band ──────────────────────────────────────────────
     From anywhere between the Oort Cloud and the edge of the Galaxy you
     are inside the disc, so the disc is a band across the sky, seen
     edge-on from within: bright, mottled, and cut by dust that is in
     front of the light rather than beside it.

     This is also what the individual stars turn into. As the frame
     approaches the width of the Milky Way itself the star layers fade
     out and this comes up in their place — which is the honest thing,
     because at that scale a star is very much less than a pixel and a
     galaxy is what a hundred billion of them look like from outside. */
  const BANDBITS = (() => {
    const r = rng(1427), dust = [], knots = [];
    for (let i = 0; i < 34; i++) {
      dust.push([r(), (r() - 0.5) * 0.42, 0.05 + r() * 0.20, 0.012 + r() * 0.05,
                 (r() - 0.5) * 0.8, 0.25 + r() * 0.6]);
    }
    for (let i = 0; i < 30; i++) {
      knots.push([r(), (r() - 0.5) * 0.34, 0.03 + r() * 0.13, 0.010 + r() * 0.035,
                  (r() - 0.5) * 0.8, 0.2 + r() * 0.7]);
    }
    return { dust, knots };
  })();

  function drawBand(ctx, cx, cy, R, w, clock) {
    ctx.save();
    ctx.translate(cx, cy);
    /* Held at the same bearing the Milky Way itself is painted at, four
       rungs further out. The two are the same object seen from inside
       and from outside, and putting them at different angles made the
       frame read as two galaxies rather than as one and its own dust. */
    ctx.rotate(-0.36 + 0.015 * Math.sin(clock * 0.021));
    const H = R * 0.32, X = R * 1.75;

    const g = ctx.createLinearGradient(0, -H, 0, H);
    g.addColorStop(0.00, "rgba(104,112,150,0)");
    g.addColorStop(0.26, "rgba(134,134,164," + 0.038 * w + ")");
    g.addColorStop(0.50, "rgba(220,206,176," + 0.092 * w + ")");
    g.addColorStop(0.74, "rgba(134,134,164," + 0.038 * w + ")");
    g.addColorStop(1.00, "rgba(104,112,150,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-X, -H, X * 2, H * 2);

    /* Drift. Slow enough that you cannot watch it move and fast enough
       that the band is not the same picture two minutes apart — the
       whole exhibit is built to be stopped on. */
    const slide = clock * 0.0035;
    ctx.fillStyle = "#f0e6cf";
    for (const [u, v, uw, uh, ph, br] of BANDBITS.knots) {
      let f = (u + slide * 0.8 + ph * 0.01) % 1; if (f < 0) f += 1;
      ctx.globalAlpha = 0.09 * w * br * (0.75 + 0.25 * Math.sin(clock * 0.13 + ph * 9));
      ctx.beginPath();
      ctx.ellipse((f * 2 - 1) * X, v * R, uw * R, uh * R, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#07070b";
    for (const [u, v, uw, uh, ph, br] of BANDBITS.dust) {
      let f = (u + slide + ph * 0.01) % 1; if (f < 0) f += 1;
      ctx.globalAlpha = 0.30 * w * br;
      ctx.beginPath();
      ctx.ellipse((f * 2 - 1) * X, v * R * 0.55, uw * R, uh * R, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ── the cosmic web ─────────────────────────────────────────────────
     The last sky. Galaxies stop being points scattered on a background
     and become the beads on a structure — and the structure is the
     thing that is moving, outward, everywhere at once.

     Two copies of one web, half a cycle apart, each scaling up and
     fading at the ends of its run. That is expansion drawn honestly:
     nothing is flying away from a centre, the whole grid is getting
     bigger, and new structure keeps arriving because there is no edge
     to arrive from. */
  const WEB = (() => {
    const r = rng(1451), nodes = [], links = [];
    for (let i = 0; i < 130; i++) {
      const u = r() * 2 - 1, th = r() * TAU;
      const rr = Math.cbrt(r()) * 1.02, s = Math.sqrt(1 - u * u);
      nodes.push([Math.cos(th) * s * rr, Math.sin(th) * s * rr * 0.92, u * rr, 0.2 + r() * 0.7]);
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i][0] - nodes[j][0];
        const dy = nodes[i][1] - nodes[j][1];
        const dz = nodes[i][2] - nodes[j][2];
        if (dx * dx + dy * dy + dz * dz < 0.075) links.push([i, j]);
      }
    }
    return { nodes, links };
  })();

  function drawWeb(ctx, cx, cy, R, w, clock) {
    for (let c = 0; c < 2; c++) {
      let u = clock / 34 + c * 0.5;
      u -= Math.floor(u);
      const s = Math.pow(1.95, u) * R;
      const a = (Math.sin(u * Math.PI) / 1.2) * w;
      if (a < 0.01) continue;

      ctx.globalAlpha = a;
      ctx.strokeStyle = "#7a7ab0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [i, j] of WEB.links) {
        const p = WEB.nodes[i], q = WEB.nodes[j];
        const px = cx + p[0] * s, py = cy + p[1] * s;
        const qx = cx + q[0] * s, qy = cy + q[1] * s;
        ctx.moveTo(px, py); ctx.lineTo(qx, qy);
      }
      ctx.globalAlpha = a * 0.115;
      ctx.stroke();

      ctx.fillStyle = "#dcd8f4";
      for (const n of WEB.nodes) {
        const px = cx + n[0] * s, py = cy + n[1] * s;
        const d = 0.45 + 0.55 * ((n[2] + 1.02) / 2.04);
        const sz = 0.9 + 1.9 * n[3] * d;
        ctx.globalAlpha = a * 0.5 * n[3] * d;
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ── suspended matter ───────────────────────────────────────────────
     The other end of the ladder, and the only regime here that is not
     space. A virus and a red blood cell are in fluid, and the reason
     they tumble is that the fluid is full of things hitting them. So
     the background at those frames is the fluid: out-of-focus specks
     with no edges, drifting on paths that never quite repeat.

     Gone by the millimetre. Above that you are looking at something in
     daylight and the background is correctly nothing at all. */
  const MOTES = (() => {
    const r = rng(1483), out = [];
    for (let i = 0; i < 70; i++) {
      out.push([r(), r(), 0.004 + r() * 0.016, r() * TAU, 0.03 + r() * 0.09,
                0.2 + r() * 0.8, r() < 0.5 ? -1 : 1]);
    }
    return out;
  })();

  function drawMotes(ctx, cw, ch, R, w, clock) {
    ctx.fillStyle = "#8fa8b4";
    for (const [ux, uy, ur, ph, sp, br, dir] of MOTES) {
      const x = ux * cw + Math.sin(clock * sp + ph) * R * 0.06 * dir;
      const y = uy * ch + Math.cos(clock * sp * 0.77 + ph) * R * 0.05;
      const rr = ur * R;
      ctx.globalAlpha = 0.075 * w * br * (0.6 + 0.4 * Math.sin(clock * sp * 1.6 + ph));
      ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
      ctx.globalAlpha *= 1.6;
      ctx.beginPath(); ctx.arc(x, y, rr * 0.42, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ── the sky, assembled ─────────────────────────────────────────────
     `cx, cy` is the point the camera never leaves, so it is also the
     point every layer of the sky converges on. If the sky converged
     anywhere else the two halves of the picture would be travelling in
     different directions. */
  function draw(ctx, cw, ch, cx, cy, camW, clock) {
    const lw = Math.log10(camW);
    const R = Math.hypot(cw, ch) / 2;

    /* Where one sky becomes the next. The overlaps are wide on purpose:
       nothing here switches, and a visitor dragging steadily through
       should never be able to name the frame a regime ended on.

       The band starts fading at 10²⁰·⁶ rather than running to the top,
       because by the Milky Way's own frame you are looking at the
       Galaxy from outside and a band across the sky behind it is the
       same object drawn twice from two incompatible places. */
    const wMote = band(lw, -9.6, -8.4, -4.4, -2.9);
    /* Stars come up between the Great Lakes and the Moon's orbit, which
       is where the landscape actually falls away: at 10⁶·⁶ you are high
       enough to see five lakes at once and the sky is still daylight,
       and by 10⁷·⁶ the Earth is a ball with black around it. */
    const wStar = band(lw, 6.2, 8.4, 20.3, 21.9);
    const wDeep = band(lw, 14.8, 17.0, 20.3, 21.6);
    const wHaze = band(lw, 14.6, 17.0, 21.2, 22.8);
    const wBand = band(lw, 15.4, 18.2, 20.6, 22.4);
    const wGalx = sstep(21.5, 23.4, lw) * (1 - 0.6 * sstep(24.6, 26.4, lw));
    const wWeb = sstep(24.2, 26.2, lw);

    if (wMote > 0.004) drawMotes(ctx, cw, ch, R, wMote, clock);
    if (wHaze > 0.004) drawHaze(ctx, cx, cy, R, wHaze, clock);
    if (wBand > 0.004) drawBand(ctx, cx, cy, R, wBand, clock);

    if (wStar > 0.004) {
      for (const L of LAYERS) {
        drawStars(ctx, L, cx, cy, R, cw, ch, lw * L.q, wStar * 0.85, clock);
      }
    }
    if (wDeep > 0.004) {
      drawStars(ctx, DEEP, cx, cy, R, cw, ch, lw * DEEP.q, wDeep * wStar * 0.9, clock);
    }
    if (wWeb > 0.004) drawWeb(ctx, cx, cy, R, wWeb, clock);
    if (wGalx > 0.004) {
      drawGalaxies(ctx, GAL_FAR, cx, cy, R, cw, ch, lw * GAL_FAR.q, wGalx * 0.55, clock);
      drawGalaxies(ctx, GAL_NEAR, cx, cy, R, cw, ch, lw * GAL_NEAR.q, wGalx * 0.8, clock);
    }
  }

  return { draw };
})();
