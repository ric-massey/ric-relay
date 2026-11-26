/* ─── the `coffee` egg: the screen is the cup ────────────────────────────
   Typing `coffee` pours a cup straight down from above the screen, a little
   right of centre, the way a Keurig does, until the page is about three
   quarters full. Ric, 2026-11-26. The plan, and the Mochi version still to
   come, is docs/coffee-egg-plan.md.

   Loaded only when somebody types `coffee` (terminal.html and the front door
   add this file on demand), so no page pays for it otherwise. No library.

   Physics: gravity is real (9.81 m/s^2 at the screen's real size), the waves
   are a 2D tank's standing waves at the gravity-capillary dispersion
   relation's frequencies, the stream obeys continuity, the drain and the
   mouth obey Torricelli, the puddle spreads at a dam-break's speed, and the
   flow the bubbles ride comes from continuity. Chosen, not derived: the
   slosh damping ratio, the nozzle, the stream's width, the churn under it,
   splash speeds, bubbles and crema, and the drain's hole.

   How the liquid works:
   - Where the coffee is: a puddle that runs out from the stream to the walls,
     then a pool, level because pressure shares what is poured in at once. The
     volume is exactly what the stream carried (see Q), and it drains by
     Torricelli. (It was 1D shallow water first; at this pour rate that piled
     the coffee into a tower under the stream before it could spread.)
   - On that, the waves (see stepWaves): thrown up where the puddle hits each
     wall, rung by drops, stirred under the stream, and set going by a tip.
   - Particles only where the eye is: splash drops, Keurig drips, bubbles.
   - Crema is a thickness per column, made at the impact and carried by the
     flow, thinning to a film.
   Nothing here touches the page under it: the canvas lets every click and
   key through. Five seconds after it is full it drains, and the canvas goes. */
(function (root) {
  "use strict";
  if (root.RELAY_COFFEE) return;

  const FILL = 0.75;     // how full the screen ends up
  const DRAIN_AFTER = 5; // seconds the full cup stands before it drains (Ric, 2026-11-26)
  const PHONE_HOLD = 40 * 60; // on a phone: forty minutes (Ric, 2026-11-26)
  const DRAIN_S = 4.5;   // seconds a full cup takes to drain
  const OFF = 0.07;      // stream sits this fraction of the width right of centre

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function createSim(W, H, opt = {}) {
    const rand = opt.random || Math.random;
    const N = Math.max(48, Math.min(420, Math.round(W / 3.5)));
    const dx = W / N;
    const X = (i) => (i + 0.5) * dx;
    // Real gravity, at the screen's real size. A CSS pixel is 1/96 inch,
    // 0.2646 mm, by definition, and about that on a computer; a phone's are
    // smaller, and the page passes its estimate (opt.mm). Everything below is
    // in pixels and seconds.
    const MM = opt.mm || 0.2646;                       // mm per px
    const PXM = 1000 / MM;                             // px per metre
    const g = 9.81 * PXM;                              // px/s^2
    const SIGMA = 0.065 * PXM ** 3 / 1000;             // surface tension / density: coffee ~0.065 N/m (water 0.072), 1000 kg/m^3
    const NU = 0.5e-6 * PXM * PXM;                     // kinematic viscosity of hot coffee (water at 60 C: 0.47e-6 m^2/s)
    const ZETA = 0.02;                                 // slosh damping ratio: 0.01-0.05 is what small tanks measure (mostly the
                                                       // contact line, which no formula here models), so this one is chosen
    const h = new Float64Array(N);                     // depth drawn: the pool plus its waves
    const base = new Float64Array(N);                  // where the coffee is, before waves
    const eta = new Float64Array(N);                   // the waves
    const f = new Float64Array(N), fs = new Float64Array(N);   // crema
    const drops = [], bubbles = [], drips = [];
    const x0 = W * (0.5 + OFF), i0 = Math.min(N - 1, Math.floor(x0 / dx));
    const xd = W * 0.5;                                // the drain, mid-floor
    const target = FILL * H * W;                       // volume, px²
    // The stream is a sheet (this is 2D), so what it carries is width × speed,
    // and that is the same at every height (continuity): it thins as it falls
    // and speeds up. The fill time is not chosen — it is what a bar this thick,
    // falling this fast, pours: Q = w·v, T = (0.75·W·H) / Q. A 1440×900 screen
    // fills in about 5.5 s, a phone in about 3.5, a 2560×1400 one in about 8.
    // The nozzle (chosen): 0.6 m/s out of a spout 60 mm above the top of the screen.
    const v0 = Math.sqrt((0.6 * PXM) ** 2 + 2 * g * (60 / MM)); // speed at the top of the screen
    const wFloor = clamp(W * 0.026, 16, 44);           // width where it meets the empty floor
    const Q = wFloor * Math.sqrt(v0 * v0 + 2 * g * H); // px²/s
    const w0 = Q / v0;                                 // width at the top of the screen
    const FMIN = 1.6;                                  // the crema film it thins to
    const HOLD = opt.hold ?? DRAIN_AFTER;              // seconds full before it drains
    // Tilt: the angle of the phone's gravity across the screen (0 = straight
    // down the screen). Tipping moves where level is at once; the surface
    // cannot jump, so it is left where it was and the waves carry it to the
    // new level - overshooting and sloshing at the tank's own frequencies.
    let tilt = 0, tiltTo = 0;
    // Up to ~83 degrees the pool is drawn as columns standing on the floor, with
    // its waves; past that (on its side, upside down) the floor is no longer
    // under it, and it is drawn as the part of the screen below a level line.
    const TILT_MAX = 1.45;
    const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const colTilt = () => clamp(norm(tilt), -TILT_MAX, TILT_MAX);
    const U = new Float64Array(N), hPrev = new Float64Array(N), q = new Float64Array(N + 1);

    // Waves. The screen is a 2D rectangular tank with walls at x = 0 and W, and
    // its waves are standing waves cos(n*pi*x/W), each at its own frequency
    // from the dispersion relation for gravity-capillary waves,
    //   w^2 = (g*k + (sigma/rho)*k^3) * tanh(k*h),  k = n*pi/W,
    // damped by viscosity (2*nu*k^2, which kills short ripples fast) and the
    // contact line (ZETA*w). Each mode is a damped oscillator stepped exactly,
    // so a fast ripple is as stable as the slow slosh of the whole screen.
    // Forcing is linear theory too: a pressure P on the surface drives mode n
    // as a'' = -k*tanh(k*h) * P_n / rho.
    const M = Math.min(N - 1, 160);
    const COS = new Float64Array((M + 1) * N);
    for (let n = 0; n <= M; n++) for (let i = 0; i < N; i++) COS[n * N + i] = Math.cos((n * Math.PI * X(i)) / W);
    const am = new Float64Array(M + 1), av = new Float64Array(M + 1);
    const push = new Float64Array(N);                  // pressure impulses this frame (integral of P dt / rho), px^2/s
    const shift = new Float64Array(N);                 // displacements this frame (a tip), px
    const kOf = (n) => (n * Math.PI) / W;
    const omega = (n, depth) => { const k = kOf(n); return Math.sqrt((g * k + SIGMA * k ** 3) * Math.tanh(k * Math.max(depth, 1))); };

    let fresh = true;                                  // no last step to take a velocity from

    const s = {
      W, H, N, dx, x0, i0, w0, h, f, drops, bubbles, drips, g,
      t: 0, volume: 0, head: -1, tail: -1, stopAt: -1, hit: false, flowing: false,
      fullAt: -1, draining: false, done: false, hold: HOLD,
      left: x0, right: x0,                             // the puddle's edges until it is wall to wall
    };

    const surfaceAt = (i) => H - h[i];
    const colOf = (x) => clamp(Math.floor(x / dx), 0, N - 1);
    const fallY = (tt) => v0 * tt + 0.5 * g * tt * tt;
    const speedAt = (y) => Math.sqrt(v0 * v0 + 2 * g * Math.max(0, y));
    const widthAt = (y) => Q / speedAt(y);             // continuity, see Q
    s.surfaceAt = surfaceAt; s.colOf = colOf; s.widthAt = widthAt; s.fallY = fallY; s.speedAt = speedAt;
    s.fallTime = (y) => (-v0 + Math.sqrt(v0 * v0 + 2 * g * Math.max(0, y))) / g;
    s.surfaceX = (x) => {
      const c = clamp(x / dx - 0.5, 0, N - 1), a = Math.floor(c), b = Math.min(N - 1, a + 1), k = c - a;
      return surfaceAt(a) * (1 - k) + surfaceAt(b) * k;
    };

    // a soft bump of width `wide` px around x, summing to 1
    function bump(x, wide) {
      const out = []; let sum = 0;
      const c = x / dx - 0.5, half = Math.max(1, Math.ceil((2 * wide) / dx));
      for (let i = Math.max(0, Math.floor(c) - half); i <= Math.min(N - 1, Math.ceil(c) + half); i++) {
        const d = (i - c) * dx, w = Math.exp(-(d * d) / (wide * wide)); out.push([i, w]); sum += w;
      }
      for (const o of out) o[1] /= sum;
      return out;
    }

    function splash(n, scale) {
      const y = surfaceAt(i0);
      for (let k = 0; k < n; k++) {
        const side = rand() < 0.5 ? -1 : 1;
        drops.push({
          x: x0 + side * rand() * widthAt(y) * 0.5, y: y - 1,
          vx: side * (0.02 + rand() * 0.1) * scale, vy: -(0.06 + rand() * 0.16) * scale,
          size: 1 + rand() * 2.2,
        });
      }
    }

    function bubble(x, big) {
      if (bubbles.length > 420) return;
      bubbles.push({ x, vx: (rand() - 0.5) * 120, r: big ? 2 + rand() * 3.2 : 0.8 + rand() * 1.8, age: 0, life: 1.2 + rand() * 6 });
    }

    // coffee running into a wall climbs it by u^2 / 2g, then falls back as a wave
    function runUp(x, u) {
      const rise = (u * u) / (2 * g), wide = Math.max(4 * dx, 0.06 * W);
      for (const [i, w] of bump(x, wide)) shift[i] += rise * w * (wide / dx) * 1.77;
    }

    const wallToWall = () => s.left <= 0 && s.right >= W;

    // Where the coffee is, without its waves. A puddle on the empty floor is a
    // tapered blob that runs out from the stream (with a mound under it while
    // the coffee is still shallow); once it reaches both walls it is a pool,
    // and a pool is level — the pressure shares what is poured in at once.
    // That is the whole body; the waves (eta) ride on top of it.
    let drainDip = 0;
    function layOut() {
      if (s.volume <= 0) { base.fill(0); return; }
      if (wallToWall()) {
        const mean = s.volume / W;
        const slope = Math.tan(colTilt());
        if (Math.abs(slope) > 1e-4) {
          // a level surface in a turned screen: depth = L + slope * (x - W/2),
          // clipped to the floor and the top, with L found so the volume is
          // exactly what was poured (bisection; the clipped sum rises with L)
          let lo = -Math.abs(slope) * W, hi = H + Math.abs(slope) * W;
          for (let it = 0; it < 40; it++) {
            const L = 0.5 * (lo + hi); let v = 0;
            for (let i = 0; i < N; i++) v += clamp(L + slope * (X(i) - W / 2), 0, H);
            if (v * dx < s.volume) lo = L; else hi = L;
          }
          const L = 0.5 * (lo + hi);
          let v = 0;
          for (let i = 0; i < N; i++) { base[i] = clamp(L + slope * (X(i) - W / 2), 0, H); v += base[i]; }
          const fix = v > 0 ? s.volume / (v * dx) : 0;  // the last hair of the bisection
          for (let i = 0; i < N; i++) base[i] *= fix;
          return;
        }
        if (drainDip > 0) {
          // the drain pulls the surface down over it; what it takes there it
          // leaves a little higher everywhere else, so the volume is the same
          const sig = W * 0.12; let avg = 0;
          for (let i = 0; i < N; i++) { const d = X(i) - xd; base[i] = Math.exp(-(d * d) / (sig * sig)); avg += base[i]; }
          avg /= N;
          const depth = Math.min(drainDip, mean * 0.45);
          for (let i = 0; i < N; i++) base[i] = mean - depth * (base[i] - avg);
        } else base.fill(mean);
        return;
      }
      let sum = 0;
      const shallow = clamp(1 - s.volume / W / 30, 0, 1);
      // a running edge is a long low tongue, not a cliff: it slopes over about
      // three times the puddle's depth
      const span = Math.max(1, Math.min(s.right, W) - Math.max(s.left, 0));
      const TAPER = clamp((3 * s.volume) / span, 36, 0.35 * span);
      for (let i = 0; i < N; i++) {
        const x = X(i);
        if (x < s.left || x > s.right) { base[i] = 0; continue; }
        const e = Math.min(s.left <= 0 ? Infinity : x - s.left, s.right >= W ? Infinity : s.right - x);
        const k = clamp(e / TAPER, 0, 1), p = Math.sqrt(k * (2 - k));   // a rounded front
        const d = (x - x0) / 120;
        base[i] = p * (1 + (s.flowing ? 0.9 * shallow * Math.exp(-d * d) : 0));
        sum += base[i];
      }
      const scale = sum > 0 ? s.volume / (sum * dx) : 0;
      for (let i = 0; i < N; i++) base[i] *= scale;
    }

    function stepFluid(dt) {
      if (s.flowing) s.volume += Q * dt;

      // The first puddle runs out to the walls at the speed of a dam-break
      // front, 2*sqrt(g*depth) (Ritter), and climbs each wall when it gets there.
      if (s.hit && !wallToWall()) {
        const wasL = s.left, wasR = s.right;
        const span = Math.max(1, Math.min(s.right, W) - Math.max(s.left, 0));
        const front = 2 * Math.sqrt(g * Math.max(s.volume / span, 0.5));
        s.left = Math.max(-1, s.left - front * dt); s.right = Math.min(W + 1, s.right + front * dt);
        if (wasL > 0 && s.left <= 0) runUp(0, front);
        if (wasR < W && s.right >= W) runUp(W, front);
      }

      // the stream makes crema where it goes in
      if (s.flowing) {
        const ker = bump(x0, Math.max(dx, widthAt(surfaceAt(i0)) * 0.7));
        for (const [i, w] of ker) f[i] = Math.min(20, f[i] + 34 * w * dt * ker.length);
      }

      layOut();
      for (let i = 0; i < N; i++) h[i] = clamp(base[i] + eta[i] * clamp(base[i] / 20, 0, 1), 0, H);

      // crema is carried by the coffee, spreads a little and thins to a film
      for (let i = 0; i < N; i++) {
        const uc = U[i];
        const p = clamp(i - (uc * dt) / dx, 0, N - 1), a = Math.floor(p), b = Math.min(N - 1, a + 1), k = p - a;
        fs[i] = f[a] * (1 - k) + f[b] * k;
      }
      for (let i = 0; i < N; i++) {
        const l = fs[i > 0 ? i - 1 : 0], rr = fs[i < N - 1 ? i + 1 : N - 1];
        let v = fs[i] + 0.05 * (l + rr - 2 * fs[i]);
        const floor = h[i] > 1 ? FMIN : 0;
        v -= dt * (s.stopAt >= 0 ? 0.16 : 0.07) * (v - floor);
        f[i] = h[i] > 0.6 ? Math.max(Math.min(v, h[i]), Math.min(floor, h[i])) : 0;
      }
    }

    // How fast the coffee itself is moving, read off how its depth changed over
    // the frame. Continuity: what a column gained came across its edges or
    // from a source in it, so the flow across each edge, q, is summed from the
    // left wall: q(i+1) = q(i) - (gain(i) - source(i)). The sources are the
    // pour (where the stream goes in), the drain (spread over the floor) and
    // the mouth (at the wall it is running out of). Whatever moved the coffee -
    // the pour spreading, a slosh, a tip, the drink going out - this is how it
    // moved, and the bubbles and crema ride it.
    // q/h would be the average over the depth. Bubbles float, and at the top a
    // deep pool moves faster than its average: for the slosh of the whole
    // screen (wavenumber k = pi/W) linear wave theory puts the surface speed
    // at q divided by tanh(k*h)/k rather than by h - the same as h when the
    // coffee is shallow, about W/pi when it is deep.
    let lastOut = 0, lastSide = 1;

    function stepWaves(dt) {
      const depth = Math.max(1, s.volume / W);
      for (let n = 1; n <= M; n++) {
        const k = kOf(n), row = n * N;
        // project this frame's pushes and shifts onto the mode (cosine series)
        let P = 0, D = 0;
        for (let i = 0; i < N; i++) { P += push[i] * COS[row + i]; D += shift[i] * COS[row + i]; }
        am[n] += (2 / N) * D;
        av[n] -= k * Math.tanh(k * depth) * (2 / N) * P;
        // a damped oscillator, stepped exactly
        const w = omega(n, depth), gam = ZETA * w + 2 * NU * k * k;
        const e = Math.exp(-gam * dt), a = am[n], v = av[n];
        if (gam < w) {
          const wd = Math.sqrt(w * w - gam * gam), c = Math.cos(wd * dt), sn = Math.sin(wd * dt);
          am[n] = e * (a * c + ((v + gam * a) / wd) * sn);
          av[n] = e * (v * c - ((w * w * a + gam * v) / wd) * sn);
        } else { am[n] = a * e; av[n] = v * e; }
      }
      push.fill(0); shift.fill(0);
      const cap = 0.3 * H;
      for (let i = 0; i < N; i++) {
        let v = 0;
        for (let n = 1; n <= M; n++) v += am[n] * COS[n * N + i];
        eta[i] = clamp(v, -cap, cap);
      }
    }
    function readFlow(frameDt, pourIn, drained) {
      if (fresh) { hPrev.set(h); fresh = false; U.fill(0); return; }
      const ker = pourIn > 0 ? bump(x0, Math.max(dx, widthAt(H) * 0.7)) : [];
      const src = new Float64Array(N);
      for (const [i, w] of ker) src[i] += pourIn * w;
      q[0] = lastSide < 0 ? -lastOut : 0;
      for (let i = 0; i < N; i++) q[i + 1] = q[i] - ((h[i] - hPrev[i]) * dx - src[i] + drained / N);
      const kW = Math.PI / W;
      for (let i = 0; i < N; i++) U[i] = clamp((0.5 * (q[i] + q[i + 1])) / frameDt / Math.max(Math.tanh(kW * h[i]) / kW, 12), -1500, 1500);
      hPrev.set(h);
    }

    const flowAt = (x) => {
      const c = clamp(x / dx - 0.5, 0, N - 1), a = Math.floor(c), b = Math.min(N - 1, a + 1), k = c - a;
      return U[a] * (1 - k) + U[b] * k;
    };

    function stepParticles(dt) {
      for (let k = drops.length - 1; k >= 0; k--) {
        const d = drops[k];
        d.vy += g * dt; d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.x < 1) { d.x = 1; d.vx = -d.vx * 0.4; } else if (d.x > W - 1) { d.x = W - 1; d.vx = -d.vx * 0.4; }
        const i = colOf(d.x);
        if (d.vy > 0 && d.y >= surfaceAt(i)) {
          // its momentum (2D: area * speed) handed to the surface where it lands
          const ker = bump(d.x, Math.max(dx, d.size * 2));
          for (const [j, w] of ker) push[j] += (Math.PI * d.size * d.size * d.vy * w) / dx;
          if (rand() < 0.35) bubble(d.x, false);
          drops.splice(k, 1);
        }
      }
      for (let k = bubbles.length - 1; k >= 0; k--) {
        const b = bubbles[k];
        const i = colOf(b.x);
        // a bubble floats on the coffee and goes where it goes: its own small
        // push from where it was made fades in a moment, then it rides the flow
        b.vx += (flowAt(b.x) - b.vx) * Math.min(1, dt * 6);
        b.x += b.vx * dt;
        const out = (b.x < 0 && q[0 + 1] < -1) || (b.x > W && q[N - 1] > 1);   // carried out over the rim with the drink
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.3; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.3; }
        b.age += dt;
        if (out || b.age > b.life || h[i] < 1) bubbles.splice(k, 1);
      }
    }

    // The coffee at rest in a screen turned to angle a (gravity across the
    // screen is (sin a, cos a), x right, y down): everything whose depth
    // along gravity, p·g, is at least c. c is found so that area = volume.
    const CORNERS = [[0, 0], [W, 0], [W, H], [0, H]];
    function clipArea(gx, gy, c, keep) {
      const out = [];
      for (let k = 0; k < 4; k++) {
        const P = CORNERS[k], R = CORNERS[(k + 1) % 4];
        const dp = P[0] * gx + P[1] * gy - c, dr = R[0] * gx + R[1] * gy - c;
        if (dp >= 0) out.push(P);
        if ((dp >= 0) !== (dr >= 0)) { const u = dp / (dp - dr); out.push([P[0] + u * (R[0] - P[0]), P[1] + u * (R[1] - P[1])]); }
      }
      let a2 = 0;
      for (let k = 0; k < out.length; k++) { const P = out[k], R = out[(k + 1) % out.length]; a2 += P[0] * R[1] - R[0] * P[1]; }
      if (keep) keep.push(...out);
      return Math.abs(a2) / 2;
    }
    function levelLine(vol, a) {
      const gx = Math.sin(a), gy = Math.cos(a);
      let lo = Infinity, hi = -Infinity;
      for (const [x, y] of CORNERS) { const d = x * gx + y * gy; lo = Math.min(lo, d); hi = Math.max(hi, d); }
      for (let it = 0; it < 48; it++) { const c = 0.5 * (lo + hi); if (clipArea(gx, gy, c) > vol) lo = c; else hi = c; }
      const c = 0.5 * (lo + hi), shape = [];
      clipArea(gx, gy, c, shape);
      return { gx, gy, c, shape };
    }
    function mouthFlow(vol, a) {
      const { gx, c } = levelLine(vol, a);
      // along the mouth (y = 0) the depth below the level line is x·gx - c
      let sum = 0; const M = 96;
      for (let k = 0; k < M; k++) { const x = ((k + 0.5) / M) * W, d = x * gx - c; if (d > 0) sum += Math.sqrt(2 * g * d); }
      return 0.6 * sum * (W / M);
    }

    s.step = function (frameDt) {
      if (s.done) return;
      frameDt = Math.min(frameDt, 1 / 30);
      s.t += frameDt;
      const t = s.t;

      // the stream's front and back, both falling from the nozzle above the screen
      const START = 0.15;
      s.head = t > START ? fallY(t - START) : -1;
      const ys0 = surfaceAt(i0);
      if (!s.hit && s.head >= ys0) {
        s.hit = true; s.flowing = true;
        const w = widthAt(H); s.left = x0 - w; s.right = x0 + w;
        splash(40, speedAt(H) * 1.1);
        for (let k = 0; k < 30; k++) bubble(x0 + (rand() - 0.5) * w * 2.5, rand() < 0.4);
      }
      if (s.stopAt < 0 && s.hit) {
        // stop the nozzle once what is in the air will finish the cup
        if (s.volume + Q * s.fallTime(ys0) >= target) {
          s.stopAt = t;
          drips.push({ at: t + 0.7 + rand() * 0.3 }, { at: t + 1.6 + rand() * 0.4 }, { at: t + 2.9 + rand() * 0.7 });
        }
      }
      s.tail = s.stopAt >= 0 ? fallY(t - s.stopAt) : -1;
      if (s.flowing && s.tail >= Math.max(0, ys0)) { s.flowing = false; s.fullAt = t; }

      for (let k = drips.length - 1; k >= 0; k--) {
        if (t >= drips[k].at) {
          drops.push({ x: x0 + (rand() - 0.5) * 1.5, y: -6, vx: 0, vy: v0 * 0.2, size: 2.6 + rand() * 0.8, drip: true });
          drips.splice(k, 1);
        }
      }

      if (s.flowing) {
        const n = rand() < frameDt * 30 ? 1 + Math.floor(rand() * 2) : 0;
        if (n) splash(n, speedAt(ys0));
        // The stream's push. Its full stagnation pressure, rho*v^2, on a 2D
        // sheet would dig a crater v^2/g deep - most of a real jet's momentum
        // goes down into the pool with the air it drags, not into the surface.
        // So the surface gets only the churn: a pressure that flickers about
        // zero, a chosen tenth of the jet's.
        if (wallToWall()) {
          const vi = speedAt(ys0), ker = bump(x0, Math.max(dx, widthAt(ys0)));
          for (const [i, w] of ker) push[i] += (rand() - 0.5) * 0.1 * Q * vi * w * frameDt / dx;
        }
        // a foamy stream: it carries air down and the air comes up as bubbles
        for (let k = 0; k < 2; k++) if (rand() < frameDt * 50) bubble(x0 + (rand() - 0.5) * widthAt(ys0) * 2.4, rand() < 0.35);
      }

      // Five seconds full, then it drains out of the floor. Torricelli: what
      // leaves a hole goes as sqrt(2·g·depth), so the level falls fast at
      // first and slows near the end — dh/dt = −k·√h, empty after
      // T = 2·√h₀ / k. The surface dips over the drain while it runs.
      if (s.fullAt >= 0 && !s.draining && t - s.fullAt >= HOLD) s.draining = true;
      let drainedNow = 0;
      if (s.draining) {
        const k = (2 * Math.sqrt(FILL * H)) / DRAIN_S;
        const mean = s.volume / W, fall = Math.max(k * Math.sqrt(mean), 30);
        drainDip = 0.09 * fall;
        drainedNow = Math.min(s.volume, fall * frameDt * W);
        s.volume -= drainedNow;
      }

      // A tip moves where level is, at once. The surface cannot jump, so it
      // stays where it was - as a displacement from the new level - and the
      // waves take it there, at the tank's own frequencies.
      if (tiltTo !== tilt) {
        if (wallToWall() && Math.abs(norm(tiltTo)) <= TILT_MAX && Math.abs(norm(tilt)) <= TILT_MAX) {
          const old = base.slice(); tilt = tiltTo; layOut();
          for (let i = 0; i < N; i++) shift[i] -= base[i] - old[i];
        } else tilt = tiltTo;
      }

      const n = Math.max(1, Math.ceil(frameDt / 0.005)), dt = frameDt / n;
      const before = s.volume;
      for (let k = 0; k < n; k++) stepFluid(dt);
      stepWaves(frameDt);
      for (let i = 0; i < N; i++) h[i] = clamp(base[i] + eta[i] * clamp(base[i] / 20, 0, 1), 0, H);
      readFlow(frameDt, s.volume - before, drainedNow);
      stepParticles(frameDt);

      // Tipped so the coffee reaches the top edge - the cup's open mouth - it
      // runs out there, as if somebody were drinking it, or, upside down,
      // simply falls out. Exact for any angle: the coffee is the part of the
      // screen below a level line (solved so its area is the volume), and
      // each bit of the mouth it covers lets coffee out at Torricelli's speed
      // for its depth below that line, v = sqrt(2·g·depth), so
      //   Q = Cd · integral over the mouth of sqrt(2·g·depth(x)) dx,  Cd ≈ 0.6.
      // Just over a corner that is the weir law (it goes as depth^1.5): it
      // sips, and stops when the level falls below the corner, so you tip
      // further as you would a mug. On its side it pours; upside down the
      // whole mouth is the bottom and it is out in a fraction of a second.
      // The volume is taken in the same small steps as the waves, so it falls
      // smoothly however fast it goes.
      s.sipping = false; s.outflow = 0; lastOut = 0;
      if (wallToWall() && !s.draining) {
        const sub = Math.max(1, Math.ceil(frameDt / 0.004)), dt = frameDt / sub;
        for (let k = 0; k < sub && s.volume > 0; k++) {
          const out = Math.min(s.volume, mouthFlow(s.volume, norm(tilt)) * dt);
          s.volume -= out; s.outflow += out / frameDt;
        }
        // Torricelli never quite reaches empty (the last film runs ever slower);
        // a film thinner than a pixel over the screen is gone
        if (s.outflow > 1 && s.volume < W * 0.6) s.volume = 0;
        lastOut = s.outflow * frameDt; lastSide = Math.sin(norm(tilt)) >= 0 ? 1 : -1;
        if (s.outflow > 1) s.sipping = true;
      }

      if (s.fullAt >= 0 && s.volume <= 0 && !s.flowing && !drops.length) {
        h.fill(0); f.fill(0); bubbles.length = 0; s.done = true;
      }
    };

    // the finished cup, for reduced motion and for a window that changed width
    // (the drain still comes five seconds later)
    s.still = function (fraction = FILL) {
      s.volume = fraction * H * W; s.left = -1; s.right = W + 1;
      eta.fill(0); am.fill(0); av.fill(0); push.fill(0); shift.fill(0); f.fill(FMIN);
      drops.length = drips.length = 0; bubbles.length = 0;
      s.hit = true; s.flowing = false; s.stopAt = s.t; s.head = s.tail = -1;
      s.fullAt = s.t; s.draining = false; s.done = false; drainDip = 0;
      layOut(); for (let i = 0; i < N; i++) h[i] = base[i];
      fresh = true;
    };

    // any angle, upside down included; it swings the short way round
    s.setTilt = (a) => { tiltTo = a + 2 * Math.PI * Math.round((tilt - a) / (2 * Math.PI)); };
    s.poly = () => (Math.abs(norm(tilt)) > TILT_MAX && wallToWall() ? levelLine(s.volume, norm(tilt)) : null);
    s.tilt = () => tilt;
    s.omega = (n) => omega(n, s.volume / W);           // the tank's own frequencies, rad/s
    s.skip = (sec) => { s.t += sec; };                // time passed with nothing to draw (asleep, tab hidden)
    // Nothing is moving: a full cup, still, waiting. The page stops drawing
    // until the phone moves or the drain is due - on a phone that is forty
    // minutes, and a canvas redrawn sixty times a second for forty minutes is
    // a battery.
    s.idle = () => {
      if (s.fullAt < 0 || s.draining || s.flowing || s.sipping || s.poly() || drops.length || drips.length || bubbles.length) return false;
      let e = 0, foam = 0;
      for (let i = 0; i < N; i++) { e = Math.max(e, Math.abs(eta[i])); foam = Math.max(foam, f[i] - FMIN); }
      return e < 0.5 && foam < 0.5;
    };
    s.level = () => { let v = 0; for (let i = 0; i < N; i++) v += h[i]; return v / N / H; };
    s.total = () => { let v = 0; for (let i = 0; i < N; i++) v += h[i] * dx; return v; };
    return s;
  }

  /* ─── drawing ──────────────────────────────────────────────────────── */

  function draw(ctx, s, sy) {
    const { W, H, N, dx } = s;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.scale(1, sy);                                   // only the height changed (a phone's address bar)

    const top = new Float64Array(N + 1);                // surface at column edges, with a meniscus at the walls
    for (let i = 0; i <= N; i++) {
      const a = s.surfaceAt(Math.max(0, i - 1)), b = s.surfaceAt(Math.min(N - 1, i));
      top[i] = 0.5 * (a + b);
    }
    for (let i = 0; i <= N; i++) {
      const x = i * dx, depth = H - top[i];
      if (depth > 4) top[i] -= 5 * (Math.exp(-x / 7) + Math.exp(-(W - x) / 7));
    }
    let minTop = H;
    for (let i = 0; i <= N; i++) minTop = Math.min(minTop, top[i]);

    const surfacePath = () => {
      ctx.moveTo(0, top[0]);
      for (let i = 1; i < N; i++) {
        const mx = (i + 0.5) * dx, my = 0.5 * (top[i] + top[i + 1]);
        ctx.quadraticCurveTo(i * dx, top[i], mx, my);
      }
      ctx.lineTo(W, top[N]);
    };

    const poly = s.poly();
    if (poly && poly.shape.length > 2) {
      // on its side or upside down: the part of the screen below the level line
      ctx.beginPath();
      poly.shape.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      let d0 = Infinity, d1 = -Infinity;
      for (const [x, y] of poly.shape) { const d = x * poly.gx + y * poly.gy; d0 = Math.min(d0, d); d1 = Math.max(d1, d); }
      const span = Math.max(140, d1 - d0);
      const body = ctx.createLinearGradient(poly.gx * d0, poly.gy * d0, poly.gx * (d0 + span), poly.gy * (d0 + span));
      body.addColorStop(0, "rgba(128,74,32,0.78)");
      body.addColorStop(0.06, "rgba(88,47,20,0.8)");
      body.addColorStop(0.3, "rgba(50,26,11,0.84)");
      body.addColorStop(1, "rgba(20,10,5,0.88)");
      ctx.fillStyle = body; ctx.fill();
      // the surface: the edge of the shape that lies on the level line
      ctx.beginPath();
      const on = poly.shape.filter(([x, y]) => Math.abs(x * poly.gx + y * poly.gy - poly.c) < 0.5);
      if (on.length >= 2) {
        ctx.moveTo(on[0][0], on[0][1]); ctx.lineTo(on[1][0], on[1][1]);
        ctx.strokeStyle = "rgba(186,128,70,0.86)"; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = "rgba(255,238,214,0.6)"; ctx.lineWidth = 1.2; ctx.stroke();
      }
    } else if (minTop < H - 0.3) {
      // the body: amber where it is thin, near-black where it is deep
      ctx.beginPath(); surfacePath(); ctx.lineTo(W, H + 2); ctx.lineTo(0, H + 2); ctx.closePath();
      const span = Math.max(140, H - minTop);
      const body = ctx.createLinearGradient(0, minTop, 0, minTop + span);
      // see-through enough to read the page under the top of it (Ric: "a bit more see through")
      body.addColorStop(0, "rgba(128,74,32,0.78)");
      body.addColorStop(0.06, "rgba(88,47,20,0.8)");
      body.addColorStop(0.3, "rgba(50,26,11,0.84)");
      body.addColorStop(1, "rgba(20,10,5,0.88)");
      ctx.fillStyle = body; ctx.fill();

      // where the stream goes in, the coffee is churned and lighter
      if (s.flowing || (s.stopAt >= 0 && s.t - s.stopAt < 3)) {
        const fade = s.flowing ? 1 : Math.max(0, 1 - (s.t - s.stopAt) / 3);
        const y = s.surfaceX(s.x0) + 10, rad = Math.min(H - y + 40, 40 + s.widthAt(y) * 6);
        if (rad > 4) {
          ctx.save(); ctx.clip();
          const churn = ctx.createRadialGradient(s.x0, y, 0, s.x0, y, rad);
          churn.addColorStop(0, `rgba(160,98,46,${0.42 * fade})`);
          churn.addColorStop(1, "rgba(160,98,46,0)");
          ctx.fillStyle = churn; ctx.fillRect(s.x0 - rad, y - rad, rad * 2, rad * 2);
          ctx.restore();
        }
      }

      // crema: a lighter band under the surface, as thick as the foam is there
      ctx.beginPath(); surfacePath();
      for (let i = N; i >= 0; i--) {
        const fi = 0.5 * (s.f[Math.max(0, i - 1)] + s.f[Math.min(N - 1, i)]);
        ctx.lineTo(i * dx, top[i] + fi);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(186,128,70,0.86)"; ctx.fill();
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const fi = 0.5 * (s.f[Math.max(0, i - 1)] + s.f[Math.min(N - 1, i)]);
        i ? ctx.lineTo(i * dx, top[i] + fi) : ctx.moveTo(0, top[0] + fi);
      }
      ctx.strokeStyle = "rgba(110,62,26,0.55)"; ctx.lineWidth = 1; ctx.stroke();

      // bubbles in the crema
      for (const b of s.bubbles) {
        const y = s.surfaceX(b.x) + b.r * 0.4;
        const a = Math.min(1, b.age * 6, (b.life - b.age) * 3);
        ctx.globalAlpha = Math.max(0, a);
        ctx.beginPath(); ctx.arc(b.x, y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(204,150,92,0.6)"; ctx.fill();
        ctx.strokeStyle = "rgba(236,200,158,0.7)"; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, y - b.r * 0.35, Math.max(0.4, b.r * 0.28), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,248,235,0.8)"; ctx.fill();
      }
      ctx.globalAlpha = 1;

      // the shine along the surface: brighter on a face tipped toward the light
      ctx.lineCap = "round";
      ctx.beginPath(); surfacePath();
      ctx.strokeStyle = "rgba(255,226,190,0.13)"; ctx.lineWidth = 4; ctx.stroke();
      const STEP = 6;
      for (let i = 0; i < N; i += STEP) {
        const j = Math.min(N, i + STEP), slope = (top[j] - top[i]) / ((j - i) * dx);
        const a = clamp(0.42 + slope * 2.2, 0.12, 0.85);
        ctx.beginPath(); ctx.moveTo(i * dx, top[i]);
        for (let k = i + 1; k <= j; k++) ctx.lineTo(k * dx, top[k]);
        ctx.strokeStyle = `rgba(255,238,214,${a})`; ctx.lineWidth = 1.2; ctx.stroke();
      }
    }

    // the stream
    if (s.head > 0) {
      const yTop = Math.max(-4, s.tail), yEnd = Math.min(s.head, s.surfaceX(s.x0) + 2);
      if (yEnd > yTop) {
        const t = s.t, L = [], R = [], C = [];
        const steps = Math.max(2, Math.ceil((yEnd - yTop) / 6));
        for (let k = 0; k <= steps; k++) {
          const y = yTop + ((yEnd - yTop) * k) / steps;
          // the edges of a foamy pour are ragged and they travel down with it
          const hw = (s.widthAt(Math.max(0, y)) / 2) * (1 + 0.09 * Math.sin(0.09 * y - 22 * t) + 0.06 * Math.sin(0.031 * y + 9 * t) + 0.04 * Math.sin(0.23 * y - 41 * t));
          const cx = s.x0 + 1.2 * Math.sin(1.7 * t + y * 0.006) + 0.6 * Math.sin(4.1 * t + y * 0.02);
          L.push([cx - hw, y]); R.push([cx + hw, y]); C.push([cx, hw, y]);
        }
        const shape = (k) => {
          ctx.beginPath();
          ctx.moveTo(C[0][0] - C[0][1] * k, C[0][2]);
          for (const c of C) ctx.lineTo(c[0] - c[1] * k, c[2]);
          const e = C[C.length - 1];
          if (s.head < s.surfaceX(s.x0)) ctx.arc(e[0], e[2], e[1] * k, Math.PI, 0, true); // the falling front is round
          for (let i = C.length - 1; i >= 0; i--) ctx.lineTo(C[i][0] + C[i][1] * k, C[i][2]);
          ctx.closePath();
        };
        // a fresh pour is aerated: tan and foamy outside, coffee showing through in the middle
        shape(1); ctx.fillStyle = "rgba(178,114,58,0.88)"; ctx.fill();
        shape(0.5); ctx.fillStyle = "rgba(84,44,18,0.78)"; ctx.fill();
        for (const side of [-1, 1]) {
          ctx.beginPath();
          C.forEach((c, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, c[0] + side * c[1] * 0.9, c[2]));
          ctx.strokeStyle = "rgba(226,180,126,0.55)"; ctx.lineWidth = 1.4; ctx.stroke();
        }
        ctx.beginPath();
        C.forEach((c, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, c[0] - c[1] * 0.45, c[2]));
        ctx.strokeStyle = "rgba(255,232,204,0.5)"; ctx.lineWidth = 1; ctx.stroke();
        // foam riding down in it: each fleck left the nozzle at its own moment and
        // falls like the coffee does, so it streaks more the lower it gets
        const FLECKS = 120, fall = s.fallTime(H);
        for (let j = 0; j < FLECKS; j++) {
          const hash = Math.sin(j * 12.9898) * 43758.5453, a = hash - Math.floor(hash);
          const age = (t + j * 0.61803 * fall) % fall, y = s.fallY(age);
          if (y < yTop || y > yEnd - 2) continue;
          const half = s.widthAt(y) / 2, x = s.x0 + (a * 2 - 1) * half * 0.8 + 1.2 * Math.sin(1.7 * t + y * 0.006);
          const rad = 0.7 + ((a * 7.31) % 1) * 1.6, len = rad + s.speedAt(y) * 0.004;
          ctx.beginPath(); ctx.ellipse(x, y, rad, len, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(238,204,160,0.6)"; ctx.fill();
        }
        if (s.flowing && s.head >= s.surfaceX(s.x0)) {
          // the foam collar where it goes in, heaped and churning
          const y = s.surfaceX(s.x0), w = s.widthAt(y);
          ctx.beginPath(); ctx.ellipse(s.x0, y + 1, w * 1.7, 5 + Math.sin(t * 17) * 1.2, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(214,162,106,0.8)"; ctx.fill();
          ctx.beginPath(); ctx.ellipse(s.x0 - w * 0.3, y - 0.5, w * 0.8, 2.4, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(244,214,174,0.55)"; ctx.fill();
        }
      }
    }

    // drops
    ctx.lineCap = "round";
    for (const d of s.drops) {
      const k = d.drip ? 0.02 : 0.012;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * k, d.y - d.vy * k);
      ctx.strokeStyle = "rgba(102,56,23,0.92)"; ctx.lineWidth = d.size * 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(d.x - d.size * 0.3, d.y - d.size * 0.3, d.size * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,232,205,0.55)"; ctx.fill();
    }
    ctx.restore();
  }

  /* ─── on the page ──────────────────────────────────────────────────── */

  let cup = null;

  function pour() {
    if (cup || !root.document) return false;            // one cup at a time; once it drains, another
    const doc = root.document;
    const canvas = doc.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.coffee = "";
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000";
    doc.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const still = root.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // On a phone the cup stays forty minutes (Ric, 2026-11-26) - it is a thing
    // to tip about - and five seconds anywhere else.
    const phone = !!root.matchMedia?.("(pointer: coarse)").matches && Math.min(root.screen?.width || 1e4, root.screen?.height || 1e4) < 600;
    const hold = phone ? PHONE_HOLD : DRAIN_AFTER;
    // How big a pixel really is, for real gravity. A browser will not say; a
    // computer is close to the CSS pixel's 0.2646 mm, and a phone's screen is
    // about 68 mm across its short side (an estimate - they run 64 to 72).
    const mm = phone ? 68 / Math.min(root.screen.width, root.screen.height) : 0.2646;

    let W = 0, H = 0, sim = null, raf = 0, wall = 0, wake = 0, angle = 0;
    const fit = () => {
      const w = canvas.clientWidth || root.innerWidth, hgt = canvas.clientHeight || root.innerHeight;
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!sim || Math.abs(w - W) > 1) {
        // a new width is a new cup, already poured, at the level it had reached
        const level = sim ? sim.level() : null;
        W = w; H = hgt; sim = createSim(W, H, { hold, mm });
        sim.setTilt(angle);
        // (before the stream has landed there is nothing to keep: it just starts again)
        if (level !== null && level > 0.01) sim.still(level);
      }
      paint();
    };
    const paint = () => draw(ctx, sim, canvas.clientHeight ? canvas.clientHeight / H : 1);
    const resume = () => { root.clearTimeout(wake); if (!raf && cup && !still) raf = root.requestAnimationFrame(frame); };
    const onResize = () => { fit(); resume(); };
    // The phone's angle. deviceorientation gives beta (front-back) and gamma
    // (left-right); gravity across the screen is then (sin g * cos b, sin b) in
    // screen x-right / y-down, turned by the screen's own rotation. Lying flat
    // there is almost no gravity across the screen, and the last angle stands.
    const onTilt = (e) => {
      if (e.beta == null || e.gamma == null) return;
      const b = (e.beta * Math.PI) / 180, gm = (e.gamma * Math.PI) / 180;
      const gx = Math.sin(gm) * Math.cos(b), gy = Math.sin(b);
      const a = ((root.screen?.orientation?.angle ?? root.orientation ?? 0) * Math.PI) / 180;
      const sx = gx * Math.cos(a) + gy * Math.sin(a), sy = -gx * Math.sin(a) + gy * Math.cos(a);
      if (Math.hypot(sx, sy) < 0.35) return;
      const to = Math.atan2(sx, sy);
      if (Math.abs(to - angle) < 0.003) return;
      angle = to; sim.setTilt(angle); resume();
    };
    const empty = () => {
      root.cancelAnimationFrame(raf); raf = 0; root.clearTimeout(wake);
      root.removeEventListener("resize", onResize);
      root.removeEventListener("deviceorientation", onTilt);
      canvas.remove(); cup = null;
    };
    const frame = (now) => {
      let dt = wall ? (now - wall) / 1000 : 1 / 60; wall = now;
      // back from a pause (asleep below, or the tab hidden): that time passed
      // on the drain's clock, but nothing moved in it
      if (dt > 0.25) { sim.skip(dt); dt = 1 / 60; }
      sim.step(dt); paint();
      raf = 0;
      if (sim.done) empty();
      else if (sim.idle()) wake = root.setTimeout(resume, Math.max(0, (sim.fullAt + sim.hold - sim.t) * 1000) + 30);
      else raf = root.requestAnimationFrame(frame);
    };
    root.addEventListener("resize", onResize);
    root.addEventListener("deviceorientation", onTilt);

    cup = { canvas };
    fit();
    // reduced motion: the full cup, no pour and no drain to watch — just gone after five seconds
    if (still) { sim.still(); paint(); root.setTimeout(empty, hold * 1000); return true; }
    raf = root.requestAnimationFrame(frame);
    return true;
  }

  root.RELAY_COFFEE = { pour, createSim, poured: () => !!cup };
})(typeof window !== "undefined" ? window : globalThis);
