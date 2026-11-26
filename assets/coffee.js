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
   flow the bubbles ride comes from continuity, a puddle meets a wall as a
   reflected bore (Rankine-Hugoniot), bubbles gather by the Cheerios effect,
   the colour is Beer-Lambert and the cooling is Newton's. The creamer that
   goes in a second after full swirls by Stam's stable fluids with buoyancy
   (see "Creamer"); its curls are the fluid's, none are drawn. Chosen, not
   derived: the slosh damping ratio, the nozzle (a Keurig's 5 mm stream), the
   churn under it, splash speeds, how many bubbles and how much foam and
   steam, the drain's hole, and the absorption constants (MU).

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
    const drops = [], bubbles = [], drips = [], steam = [];
    const x0 = W * (0.5 + OFF), i0 = Math.min(N - 1, Math.floor(x0 / dx));
    const xd = W * 0.5;                                // the drain, mid-floor
    const target = FILL * H * W;                       // volume, px²
    // The stream is a sheet (this is 2D), so what it carries is width × speed,
    // and that is the same at every height (continuity): it thins as it falls
    // and speeds up. The fill time is not chosen — it is what a stream this
    // wide, falling this fast, pours: Q = w·v, T = (0.75·W·H) / Q.
    // The nozzle (chosen, a Keurig's): 0.6 m/s out of a spout 60 mm above the
    // top of the screen, a stream 5 mm wide where it comes into view. Real
    // sizes on a real-sized screen: a laptop fills in about 11 s; a phone,
    // being a far smaller cup, in under 2.
    const v0 = Math.sqrt((0.6 * PXM) ** 2 + 2 * g * (60 / MM)); // speed at the top of the screen
    const w0 = 5 / MM;                                 // width at the top of the screen
    const Q = w0 * v0;                                 // px²/s
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
      W, H, N, dx, x0, i0, w0, h, f, drops, bubbles, drips, steam, g, MM,
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
      bubbles.push({ x, vx: (rand() - 0.5) * 120, r: big ? 2 + rand() * 2.4 : 0.9 + rand() * 1.4, age: 0, life: 4 + rand() * 8 });
    }

    // A shallow sheet of coffee, depth d, running into a wall at speed u is
    // stopped there, and the stopping travels back as a bore whose depth d2
    // is fixed by mass and momentum (Rankine-Hugoniot for a reflected bore):
    //   u = (d2 - d) * sqrt(g * (d2 + d) / (2 * d * d2)).
    // The wall's coffee stands d2 - d higher, and that rise is the wave sent
    // back - a few times the sheet's depth, not a splash up the wall.
    function runUp(x, u, d) {
      d = Math.max(d, 0.5);
      let lo = d, hi = d + (4 * u * u) / g + 4 * d;
      for (let it = 0; it < 50; it++) {
        const d2 = 0.5 * (lo + hi);
        if ((d2 - d) * Math.sqrt((g * (d2 + d)) / (2 * d * d2)) < u) lo = d2; else hi = d2;
      }
      const rise = 0.5 * (lo + hi) - d, wide = Math.max(3 * dx, 4 * d);
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
        const depth = Math.max(s.volume / span, 0.5), front = 2 * Math.sqrt(g * depth);
        s.left = Math.max(-1, s.left - front * dt); s.right = Math.min(W + 1, s.right + front * dt);
        // what reaches the wall is the sheet behind the front, moving at about
        // sqrt(g*d) (Ritter's solution, at the walls' distance)
        if (wasL > 0 && s.left <= 0) runUp(0, Math.sqrt(g * depth), depth);
        if (wasR < W && s.right >= W) runUp(W, Math.sqrt(g * depth), depth);
      }

      // the stream makes crema where it goes in
      if (s.flowing) {
        const ker = bump(x0, Math.max(dx, widthAt(surfaceAt(i0)) * 0.7));
        for (const [i, w] of ker) f[i] = Math.min(FMIN + 6, f[i] + 14 * w * dt * ker.length);
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

    // Steam. Brewed at about 85 C, coffee cools toward the room (Newton:
    // T = 20 + 65*e^(-t/tau), tau ~ 15 minutes for a cup) and gives off less
    // and less visible steam, none much below 45 C. Wisps lift slowly off the
    // surface (2-4 cm/s) and are gone within a few centimetres, widening as
    // they go - steam is only visible while it is still condensed droplets.
    s.temp = () => 20 + 65 * Math.exp(-s.t / 900);
    s.steaming = () => s.volume > 0 && s.hit && clamp((s.temp() - 45) / 30, 0, 1) > 0.02;
    function stepSteam(dt) {
      const strength = s.volume > 0 && s.fullAt >= 0 ? clamp((s.temp() - 45) / 30, 0, 1) : 0;
      if (strength > 0 && steam.length < 40 && rand() < dt * 9 * strength * (W / 800)) {
        const x = rand() * W;
        steam.push({ x, y: s.surfaceX(x) - 3, vy: -(0.02 + rand() * 0.02) * PXM, ph: rand() * 6.28, age: 0, life: 1.2 + rand() * 1.2, a: strength });
      }
      for (let k = steam.length - 1; k >= 0; k--) {
        const w = steam[k];
        w.age += dt; w.y += w.vy * dt; w.x += Math.sin(w.ph + w.age * 2.3) * 10 * dt;
        if (w.age > w.life) steam.splice(k, 1);
      }
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
          if (rand() < 0.2) bubble(d.x, false);
          drops.splice(k, 1);
        }
      }
      for (let k = bubbles.length - 1; k >= 0; k--) {
        const b = bubbles[k];
        const i = colOf(b.x);
        // a bubble floats on the coffee and goes where it goes: its own small
        // push from where it was made fades in a moment, then it rides the flow
        // Bubbles on coffee drift to the cup's edge and to each other: the
        // surface curves up at the wall (and around each bubble), and a floating
        // bubble climbs the curve - the "Cheerios effect". Its pull falls off
        // over the capillary length, sqrt(sigma/(rho*g)), about 2.6 mm.
        const lc = Math.sqrt(SIGMA / g);
        let pull = 22 * (Math.exp(-(W - b.x) / (3 * lc)) - Math.exp(-b.x / (3 * lc)));
        for (const o of bubbles) if (o !== b) { const d = o.x - b.x; if (Math.abs(d) < 6 * lc) pull += 6 * Math.sign(d) * Math.exp(-Math.abs(d) / (2 * lc)); }
        b.vx += (flowAt(b.x) + pull - b.vx) * Math.min(1, dt * 6);
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


    // ─── Creamer ─────────────────────────────────────────────────────────
    // A little creamer (Ric, 2026-11-26: "little bit of creamer about a
    // second after full"), poured by hand from a small jug left of centre a
    // second after the cup is full: 2% of the coffee, a splash, as in a
    // mug. Liquid creamer is sugared and thickened and comes out of the
    // fridge, so it is a few percent denser than hot coffee (chosen: 4%), and
    // what makes the curls is that difference: it plunges in, sinks, and the
    // sinking rolls up into billows and mushroom-headed plumes on its own
    // (Rayleigh-Taylor and Kelvin-Helmholtz; nothing here draws a curl).
    //
    // The surface model above knows only how high the coffee is; the inside
    // needs a fluid of its own. This is Stam's "Stable Fluids" (1999) on a
    // coarse grid over the screen: the velocity is carried along by itself
    // (semi-Lagrangian), pushed by buoyancy (Boussinesq: the creamer's extra
    // weight, g*(drho/rho)*c, along the screen's gravity, so it follows the
    // phone's tilt), kept from spreading its swirls out by vorticity
    // confinement (Fedkiw, Stam & Jensen 2001 - the coarse grid smears small
    // eddies faster than real viscosity would), and made incompressible by a
    // pressure solve with the free surface at zero pressure and the screen's
    // edges as walls. The creamer is a dye the flow carries (MacCormack, so
    // ribbons stay thin), its total held to what was poured. Once it has
    // settled the solver stops and the cup can sleep.
    const CREAM = opt.cream ?? 0.02;                   // creamer, as a share of the coffee
    const DRHO = 0.04;                                 // how much denser than the coffee (chosen)
    const CREAM_AFTER = 1;                             // seconds after full (Ric)
    const FADE_AT = 6;                                 // seconds after it goes in that the plume is spent (chosen)
    const cs = Math.max(4, Math.sqrt((W * H) / 10000)); // grid cell, px (about ten thousand cells, so a phone keeps up)
    const nx = Math.ceil(W / cs), ny = Math.ceil(H / cs), NC = nx * ny;
    // a staggered (MAC) grid: u on the cells' left and right faces, v on their
    // tops and bottoms, so the pressure step sees every pattern of motion
    const cu = new Float32Array((nx + 1) * ny), cv = new Float32Array(nx * (ny + 1));
    const cu0 = new Float32Array((nx + 1) * ny), cv0 = new Float32Array(nx * (ny + 1));
    const ucc = new Float32Array(NC), vcc = new Float32Array(NC), rowMean = new Float32Array(ny);
    const cp = new Float32Array(NC), cdiv = new Float32Array(NC), cw = new Float32Array(NC);
    const cc = new Float32Array(NC), cc0 = new Float32Array(NC), cc1 = new Float32Array(NC);
    const wet = new Uint8Array(NC);
    // The jug: 0.3 m/s out of a lip 30 mm above the top of the screen, a
    // stream 3 mm wide where it comes into view (chosen). Continuity again.
    const xc = W * 0.36;
    const cv00 = Math.sqrt((0.3 * PXM) ** 2 + 2 * g * (30 / MM));
    const cQ = (3 / MM) * cv00;
    const cSpeed = (y) => Math.sqrt(cv00 * cv00 + 2 * g * Math.max(0, y));
    const cFall = (tt) => cv00 * tt + 0.5 * g * tt * tt;
    const cFallTime = (y) => (-cv00 + Math.sqrt(cv00 * cv00 + 2 * g * Math.max(0, y))) / g;
    const cream = {
      on: CREAM > 0, start: -1, stop: -1, head: -1, tail: -1, hit: false, poured: 0, mass: 0,
      want: CREAM * target, x: xc, sway: 0, settled: false, quiet: 0, age: 0, owed: 0,
      widthAt: (y) => cQ / cSpeed(y), speedAt: cSpeed, fallY: cFall, fallTime: cFallTime,
      nx, ny, cs, c: cc,
    };
    s.cream = cream;

    const sampleG = (F, w, hgt, x, y) => {
      // bilinear over a w x hgt grid, x and y in its own units (points at integers)
      x = clamp(x, 0, w - 1); y = clamp(y, 0, hgt - 1);
      const i = Math.min(w - 2, Math.floor(x)), j = Math.min(hgt - 2, Math.floor(y)), a = x - i, b = y - j, k = j * w + i;
      return (F[k] * (1 - a) + F[k + 1] * a) * (1 - b) + (F[k + w] * (1 - a) + F[k + w + 1] * a) * b;
    };

    function creamMask() {
      const poly = s.poly();
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * cs, y = (j + 0.5) * cs;
        wet[j * nx + i] = poly ? (x * poly.gx + y * poly.gy >= poly.c ? 1 : 0) : (y > s.surfaceX(x) + 0.5 * cs ? 1 : 0);
      }
    }

    function stepCream(dt) {
      creamMask();
      const a = norm(tilt), gx = Math.sin(a), gy = Math.cos(a), gb = g * DRHO;
      const NU1 = nx + 1;
      const W_ = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny ? wet[j * nx + i] : 0);
      // which faces carry flow: inside the screen, with coffee on at least one side
      const liveU = (i, j) => i > 0 && i < nx && (W_(i - 1, j) || W_(i, j));
      const liveV = (i, j) => j > 0 && j < ny && (W_(i, j - 1) || W_(i, j));
      // 1. the creamer stream going in: its creamer, and its momentum
      if (cream.pouredNow > 0) {
        const ys = s.surfaceX(xc), vi = cSpeed(ys), wid = cQ / vi;
        // A thin jet going into a deep pool spreads and slows within a few
        // centimetres - it drags the coffee around it along (3D entrainment, which
        // a 2D grid does not have) - so what it hands the coffee is creamer moving
        // down at a chosen 12 cm/s over a few cells, and from there its weight
        // takes it. Handing over the jet's own 4 m/s sent it to the floor and up
        // the walls in a fraction of a second.
        void vi; void wid;
        const SPREAD = Math.max(1.5 * cs, 6 / MM), V_IN = 0.12 * PXM;
        // the hand pouring it moves a little (a few millimetres, chosen)
        cream.sway = (3 / MM) * Math.sin(s.t * 3.1 + 1) + (1.5 / MM) * Math.sin(s.t * 7.3);
        const xp = cream.x + cream.sway;
        const ia = clamp(Math.floor((xp - SPREAD) / cs), 0, nx - 1), ib = clamp(Math.floor((xp + SPREAD) / cs), 0, nx - 1);
        const cells = [];
        for (let i = ia; i <= ib; i++) {
          let j = Math.floor(ys / cs); while (j < ny - 1 && !wet[j * nx + i]) j++;
          const w = Math.exp(-(((i + 0.5) * cs - xp) ** 2) / (SPREAD * SPREAD));
          for (const jj of [j, j + 1]) if (jj < ny) cells.push([jj, i, w]);
        }
        let sw = 0; for (const c of cells) sw += c[2];
        for (const [jj, i, w] of cells) {
          const k = jj * nx + i;
          cc[k] = Math.min(1, cc[k] + (cream.pouredNow * w) / (sw * cs * cs));
          if (jj + 1 < ny) cv[k + nx] += (V_IN - cv[k + nx]) * Math.min(1, w);
          // a hand-poured stream wanders and goes in a little unevenly, which is
          // what breaks the plume's symmetry (chosen: a few cm/s of jitter)
          cu[jj * (nx + 1) + i + 1] += (rand() - 0.5) * 0.06 * PXM * w;
        }
      }
      // 2. carry the velocity along itself (semi-Lagrangian, on the staggered faces)
      cu0.set(cu); cv0.set(cv);
      const uAt = (x, y) => sampleG(cu0, NU1, ny, x / cs, y / cs - 0.5);
      const vAt = (x, y) => sampleG(cv0, nx, ny + 1, x / cs - 0.5, y / cs);
      for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++) {
        const k = j * NU1 + i;
        if (!liveU(i, j)) { cu[k] = 0; continue; }
        const x = i * cs, y = (j + 0.5) * cs, ux = cu0[k], vy = vAt(x, y);
        cu[k] = uAt(x - ux * dt, y - vy * dt);
      }
      for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!liveV(i, j)) { cv[k] = 0; continue; }
        const x = (i + 0.5) * cs, y = j * cs, ux = uAt(x, y), vy = cv0[k];
        cv[k] = vAt(x - ux * dt, y - vy * dt);
      }
      // 3. buoyancy. A layer of creamer lying flat is only weight: the pressure
      // holds it up and nothing moves. Only the part that differs along a row
      // can drive a flow, so each row's mean is taken out before pushing - the
      // same physics, but the pressure solve (never fully converged) no longer
      // has to balance a whole column's weight, and a settled cup settles.
      let maxc = 0;
      for (let j = 0; j < ny; j++) {
        let m = 0, n = 0;
        for (let i = 0; i < nx; i++) { const k = j * nx + i; if (wet[k]) { m += cc[k]; n++; } maxc = Math.max(maxc, cc[k]); }
        rowMean[j] = n ? m / n : 0;
      }
      const cAt = (i, j) => (W_(i, j) ? cc[j * nx + i] : 0);
      for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
        if (!liveU(i, j)) continue;
        cu[j * NU1 + i] += gb * gx * 0.5 * (cAt(i - 1, j) + cAt(i, j)) * dt;
      }
      for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
        if (!liveV(i, j)) continue;
        cv[j * nx + i] += gb * gy * 0.5 * (cAt(i, j - 1) - rowMean[j - 1] + cAt(i, j) - rowMean[j]) * dt;
      }
      // 4. vorticity confinement: the coarse grid smears small eddies out
      // faster than real viscosity would, so the spin it loses is pushed back
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        cw[k] = 0;
        if (!wet[k] || i === 0 || j === 0 || i === nx - 1 || j === ny - 1) continue;
        // curl at the cell centre from the faces around it
        const vr = 0.5 * (cv[j * nx + i + 1] + cv[(j + 1) * nx + i + 1]), vl = 0.5 * (cv[j * nx + i - 1] + cv[(j + 1) * nx + i - 1]);
        const ud = 0.5 * (cu[(j + 1) * NU1 + i] + cu[(j + 1) * NU1 + i + 1]), uu = 0.5 * (cu[(j - 1) * NU1 + i] + cu[(j - 1) * NU1 + i + 1]);
        cw[k] = (vr - vl - ud + uu) / (2 * cs);
      }
      // (only while the plume is young: kept up, it feeds the swirling for ever
      // and nothing settles)
      const EPS = 0.3 * clamp(1 - (cream.age - FADE_AT) / 4, 0, 1);
      for (let j = 2; j < ny - 2; j++) for (let i = 2; i < nx - 2; i++) {
        const k = j * nx + i;
        if (!wet[k] || !cw[k]) continue;
        const ngx = Math.abs(cw[k + 1]) - Math.abs(cw[k - 1]), ngy = Math.abs(cw[k + nx]) - Math.abs(cw[k - nx]);
        const len = Math.hypot(ngx, ngy) + 1e-9;
        const fx = EPS * cs * (ngy / len) * cw[k] * dt, fy = -EPS * cs * (ngx / len) * cw[k] * dt;
        cu[j * NU1 + i] += 0.5 * fx; cu[j * NU1 + i + 1] += 0.5 * fx;
        cv[j * nx + i] += 0.5 * fy; cv[(j + 1) * nx + i] += 0.5 * fy;
      }
      // 5. incompressible: the pressure that takes the divergence out. The
      // screen's edges are walls; the air above the surface is at zero pressure.
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        cdiv[k] = wet[k] ? (cu[j * NU1 + i + 1] - cu[j * NU1 + i] + cv[(j + 1) * nx + i] - cv[k]) / cs : 0;
        if (!wet[k]) cp[k] = 0;
      }
      const OMEGA = 1.7;                              // over-relaxed Gauss-Seidel
      for (let it = 0; it < 30; it++) {
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          if (!wet[k]) continue;
          let sum = 0, n = 0;
          if (i > 0) { sum += cp[k - 1]; n++; }
          if (i < nx - 1) { sum += cp[k + 1]; n++; }
          if (j > 0) { sum += cp[k - nx]; n++; }
          if (j < ny - 1) { sum += cp[k + nx]; n++; }
          cp[k] += OMEGA * ((sum - cdiv[k] * cs * cs) / n - cp[k]);
        }
      }
      const pAt = (i, j) => (W_(i, j) ? cp[j * nx + i] : 0);
      let vmax = 0;
      for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
        if (!liveU(i, j)) continue;
        const k = j * NU1 + i;
        cu[k] -= (pAt(i, j) - pAt(i - 1, j)) / cs; vmax = Math.max(vmax, Math.abs(cu[k]));
      }
      for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
        if (!liveV(i, j)) continue;
        const k = j * nx + i;
        cv[k] -= (pAt(i, j) - pAt(i, j - 1)) / cs; vmax = Math.max(vmax, Math.abs(cv[k]));
      }
      // The 3D losses a 2D slice does not have. In a real mug a falling plume
      // drags the coffee in front of and behind it along, and that brakes it
      // within centimetres; a 2D slice has no front and back, so without this
      // the plume hit the floor, ran up both walls and churned the whole cup
      // tan. So the flow is damped (chosen): hard while the plume falls (it
      // still curls - the curls are its weight, not its speed), then lightly,
      // so the layer it leaves on the floor can slide level. Measured: on a
      // phone 84% of the creamer ends in the bottom quarter, as thick at one
      // wall as the other; on a laptop all of it.
      const DRAG = cream.age < FADE_AT ? 2 : 0.6;
      const keep = Math.exp(-DRAG * dt);
      for (let k = 0; k < cu.length; k++) cu[k] *= keep;
      for (let k = 0; k < cv.length; k++) cv[k] *= keep;
      // 6. carry the creamer (MacCormack: forward, back, correct the error, clamped)
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        ucc[k] = 0.5 * (cu[j * NU1 + i] + cu[j * NU1 + i + 1]) * dt / cs;
        vcc[k] = 0.5 * (cv[j * nx + i] + cv[(j + 1) * nx + i]) * dt / cs;
      }
      cc0.set(cc);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        cc1[k] = wet[k] ? sampleG(cc0, nx, ny, i - ucc[k], j - vcc[k]) : cc0[k];
      }
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!wet[k]) { cc[k] = cc1[k]; continue; }
        const back = sampleG(cc1, nx, ny, i + ucc[k], j + vcc[k]);
        const x = clamp(i - ucc[k], 0, nx - 1), y = clamp(j - vcc[k], 0, ny - 1);
        const i0 = Math.min(nx - 2, Math.floor(x)), j0 = Math.min(ny - 2, Math.floor(y)), q0 = j0 * nx + i0;
        const lo = Math.min(cc0[q0], cc0[q0 + 1], cc0[q0 + nx], cc0[q0 + nx + 1]);
        const hi = Math.max(cc0[q0], cc0[q0 + 1], cc0[q0 + nx], cc0[q0 + nx + 1]);
        cc[k] = clamp(cc1[k] + 0.5 * (cc0[k] - back), lo, hi);
      }
      // creamer left above a falling surface settles into the coffee below it
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny - 1; j++) {
        const k = j * nx + i;
        if (!wet[k] && cc[k] > 0) { cc[k + nx] = Math.min(1, cc[k + nx] + cc[k]); cc[k] = 0; }
      }
      for (let k = (ny - 1) * nx; k < NC; k++) if (!wet[k]) cc[k] = 0;
      // 7. hold the creamer's total to what is in the cup (the advection is not
      // exactly conservative; this puts back what rounding lost)
      let sum = 0;
      for (let k = 0; k < NC; k++) sum += cc[k];
      sum *= cs * cs;
      if (sum > 1e-6 && cream.mass > 0) { const f = cream.mass / sum; for (let k = 0; k < NC; k++) cc[k] = Math.min(1, cc[k] * f); }
      // settled: nothing moving faster than a millimetre a second, for a second
      cream.quiet = vmax < 1 / MM && !cream.pouredNow ? cream.quiet + dt : 0;
      // A minute on, what still moves is a slow drift that changes nothing to
      // look at, and a phone holds the cup forty minutes: it is let rest (chosen).
      if (cream.quiet > 1 || cream.age > 60) { cream.settled = true; cu.fill(0); cv.fill(0); }
      cream.vmax = vmax; cream.maxc = maxc;
    }

    // the creamer's stream, and stepping the inside of the coffee
    function creamStep(frameDt, outShare) {
      if (!cream.on) return;
      const t = s.t;
      cream.pouredNow = 0;
      if (cream.start < 0 && s.fullAt >= 0 && t - s.fullAt >= CREAM_AFTER && !s.draining) cream.start = t;
      if (cream.start < 0) return;
      cream.head = cFall(t - cream.start);
      const ys = s.surfaceX(xc);
      if (!cream.hit && cream.head >= ys) {
        cream.hit = true;
        for (let k = 0; k < 6; k++) {
          const side = rand() < 0.5 ? -1 : 1, sc = cSpeed(ys);
          drops.push({ x: xc + side * rand() * 2, y: ys - 1, vx: side * (0.02 + rand() * 0.06) * sc, vy: -(0.04 + rand() * 0.08) * sc, size: 0.8 + rand() * 1.2, cream: true });
        }
      }
      if (cream.stop < 0 && cream.poured + cQ * cFallTime(ys) >= cream.want) cream.stop = t;
      cream.tail = cream.stop >= 0 ? cFall(t - cream.stop) : -1;
      if (cream.hit) {
        // what reaches the surface this frame: the stream that is no longer in the air
        const ft = cFallTime(ys), end = cream.stop >= 0 ? Math.min(t, cream.stop + ft) : t;
        const reached = clamp(cQ * (end - cream.start - ft), 0, cream.want);
        const now = Math.max(0, reached - cream.poured);
        cream.poured += now; cream.pouredNow = now; cream.mass += now;
        s.volume += now;
      }
      if (outShare > 0) cream.mass *= 1 - outShare;
      cream.age = cream.hit ? t - cream.start : 0;
      if (cream.hit && !cream.settled) {
        // once the pour is in and the plume has landed (ten seconds), the slow
        // swirling that is left is stepped half as often, in steps twice as long
        cream.owed += frameDt;
        if (cream.age < 10 || cream.pouredNow > 0 || cream.owed >= 1 / 30 - 1e-9) {
          const n = Math.max(1, Math.ceil(cream.owed / (1 / 30)));
          for (let k = 0; k < n; k++) stepCream(cream.owed / n);
          cream.owed = 0;
        }
      }
    }
    // a cup already creamed and stirred (reduced motion, or a new width after the creamer)
    function creamMixed() {
      creamMask();
      let n = 0; for (let k = 0; k < NC; k++) n += wet[k];
      const c = n ? cream.want / (n * cs * cs) : 0;
      for (let k = 0; k < NC; k++) cc[k] = wet[k] ? c : 0;
      Object.assign(cream, { start: s.t, stop: s.t, hit: true, poured: cream.want, mass: cream.want, settled: true, head: -1, tail: -1 });
    }
    s.creamed = () => cream.on && cream.hit;
    s.creamActive = () => cream.on && ((cream.start >= 0 && !cream.settled) || (s.fullAt >= 0 && cream.start < 0 && !s.draining));

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
        for (let k = 0; k < 14; k++) bubble(x0 + (rand() - 0.5) * w * 2.5, rand() < 0.3);
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
        // zero, a chosen 3% of the jet's.
        if (wallToWall()) {
          const vi = speedAt(ys0), ker = bump(x0, Math.max(dx, widthAt(ys0)));
          for (const [i, w] of ker) push[i] += (rand() - 0.5) * 0.03 * Q * vi * w * frameDt / dx;
        }
        // a foamy stream: it carries air down and the air comes up as bubbles
        if (rand() < frameDt * 18) bubble(x0 + (rand() - 0.5) * widthAt(ys0) * 2.4, rand() < 0.3);
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
      stepSteam(frameDt);

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

      // the creamer goes in a second after full, and what left the cup this
      // frame (the drain, the mouth) took its share of the creamer with it
      const gone = drainedNow + lastOut;
      creamStep(frameDt, gone > 0 ? gone / (gone + s.volume) : 0);

      if (s.fullAt >= 0 && s.volume <= 0 && !s.flowing && !drops.length) {
        cc.fill(0); h.fill(0); f.fill(0); bubbles.length = 0; steam.length = 0; s.done = true;
      }
    };

    // the finished cup, for reduced motion and for a window that changed width
    // (the drain still comes five seconds later)
    s.still = function (fraction = FILL, creamed = false) {
      s.volume = fraction * H * W; s.left = -1; s.right = W + 1;
      eta.fill(0); am.fill(0); av.fill(0); push.fill(0); shift.fill(0); f.fill(FMIN);
      drops.length = drips.length = 0; bubbles.length = 0;
      s.hit = true; s.flowing = false; s.stopAt = s.t; s.head = s.tail = -1;
      s.fullAt = s.t; s.draining = false; s.done = false; drainDip = 0;
      layOut(); for (let i = 0; i < N; i++) h[i] = base[i];
      fresh = true;
      if (creamed && cream.on) creamMixed();
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
      if (s.fullAt < 0 || s.draining || s.flowing || s.sipping || s.poly() || drops.length || drips.length || bubbles.length || s.creamActive()) return false;
      // (steam does not count: it is drawn slowly while everything else is still)
      let e = 0, foam = 0;
      for (let i = 0; i < N; i++) { e = Math.max(e, Math.abs(eta[i])); foam = Math.max(foam, f[i] - FMIN); }
      return e < 0.5 && foam < 0.5;
    };
    s.level = () => { let v = 0; for (let i = 0; i < N; i++) v += h[i]; return v / N / H; };
    s.total = () => { let v = 0; for (let i = 0; i < N; i++) v += h[i] * dx; return v; };
    return s;
  }

  /* ─── drawing ──────────────────────────────────────────────────────── */

  // What makes it coffee and not cola. Brewed coffee lets red through and
  // eats blue (Beer-Lambert: each colour falls as e^(-mu*path)), so a thin
  // layer is amber-brown and a centimetre is all but black - where cola stays
  // a clear red-brown all the way through. No fizz: drip coffee carries a
  // little foam where it is poured and a few bubbles that drift to the rim.
  // It steams. And its surface is a glossy, slightly oily mirror.
  // MU (per mm) is chosen to land on brewed coffee's browns, not measured.
  const MU = [0.35, 0.5, 0.65];
  const LIGHT = [255, 236, 214];
  const through = (mm, a = 1) => `rgba(${MU.map((m, c) => Math.round(LIGHT[c] * Math.exp(-m * mm))).join(",")},${a})`;

  function bodyFill(ctx, x0, y0, x1, y1, span) {
    // light comes in at the surface and is used up going down: the colour at
    // depth z is what is left after the path from the surface
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, through(2.2, 0.9));
    grad.addColorStop(Math.min(1, 8 / span), through(3.2, 0.92));
    grad.addColorStop(Math.min(1, 45 / span), through(5.5, 0.94));
    grad.addColorStop(1, through(10, 0.95));
    return grad;
  }

  // Creamer in coffee. Creamer is milky - its fat droplets scatter light back
  // where coffee only swallows it - so a wisp of it shows as a pale curl in
  // the black, and the more there is the lighter and more opaque the coffee
  // goes, through caramel to latte to cream. The ramp is chosen to look like
  // coffee with creamer, not measured; indexed by sqrt(c) so thin wisps get
  // most of its steps.
  const CREAM_RAMP = [
    [0, 92, 56, 32, 0], [0.004, 92, 58, 34, 0.25], [0.015, 112, 74, 46, 0.6], [0.04, 138, 96, 62, 0.85],
    [0.1, 166, 126, 90, 0.94], [0.3, 198, 166, 130, 0.98], [1, 232, 218, 198, 1],
  ];
  const CREAM_LUT = new Uint8ClampedArray(256 * 4);
  for (let n = 0; n < 256; n++) {
    const c = (n / 255) ** 2;
    let k = 0; while (k < CREAM_RAMP.length - 2 && c > CREAM_RAMP[k + 1][0]) k++;
    const A = CREAM_RAMP[k], B = CREAM_RAMP[k + 1], u = clamp((c - A[0]) / (B[0] - A[0]), 0, 1);
    for (let ch = 0; ch < 4; ch++) CREAM_LUT[n * 4 + ch] = (A[ch + 1] + (B[ch + 1] - A[ch + 1]) * u) * (ch === 3 ? 255 : 1);
  }
  function drawCream(ctx, s) {
    const cr = s.cream;
    if (!cr || !cr.hit || !root.document) return;
    if (!cr.canvas) {
      cr.canvas = root.document.createElement("canvas"); cr.canvas.width = cr.nx; cr.canvas.height = cr.ny;
      cr.cx = cr.canvas.getContext("2d"); cr.img = cr.cx.createImageData(cr.nx, cr.ny);
    }
    const d = cr.img.data, c = cr.c;
    for (let k = 0; k < c.length; k++) {
      const n = Math.round(Math.sqrt(c[k]) * 255) * 4, o = k * 4;
      d[o] = CREAM_LUT[n]; d[o + 1] = CREAM_LUT[n + 1]; d[o + 2] = CREAM_LUT[n + 2]; d[o + 3] = CREAM_LUT[n + 3];
    }
    cr.cx.putImageData(cr.img, 0, 0);
    ctx.save(); ctx.clip();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    // softened by most of a cell, so the grid it was worked out on never shows as steps
    if ("filter" in ctx) ctx.filter = `blur(${(0.7 * cr.cs).toFixed(1)}px)`;
    ctx.drawImage(cr.canvas, 0, 0, cr.nx, cr.ny, 0, 0, cr.nx * cr.cs, cr.ny * cr.cs);
    ctx.restore();
  }
  function drawCreamStream(ctx, s) {
    const cr = s.cream;
    if (!cr || cr.start < 0 || cr.head <= 0) return;
    const yTop = Math.max(-4, cr.tail), yEnd = Math.min(cr.head, s.surfaceX(cr.x) + 2);
    if (yEnd <= yTop) return;
    const steps = Math.max(2, Math.ceil((yEnd - yTop) / 6)), C = [];
    for (let k = 0; k <= steps; k++) {
      const y = yTop + ((yEnd - yTop) * k) / steps;
      C.push([cr.x + cr.sway + 0.8 * Math.sin(2.3 * s.t + y * 0.008), cr.widthAt(Math.max(0, y)) / 2, y]);
    }
    // opaque and milky: bright down the middle, a little shaded at the edges
    for (let k = 0; k < C.length - 1; k++) {
      const [cx, hw, y] = C[k], [cx2, hw2, y2] = C[k + 1];
      const grad = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
      grad.addColorStop(0, "rgba(214,198,176,0.96)"); grad.addColorStop(0.45, "rgba(250,246,238,0.98)"); grad.addColorStop(1, "rgba(226,212,192,0.96)");
      ctx.beginPath();
      ctx.moveTo(cx - hw, y); ctx.lineTo(cx + hw, y); ctx.lineTo(cx2 + hw2, y2 + 0.6); ctx.lineTo(cx2 - hw2, y2 + 0.6);
      ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    }
    const last = C[C.length - 1];
    if (cr.head < s.surfaceX(cr.x)) { ctx.beginPath(); ctx.arc(last[0], last[2], last[1], 0, Math.PI); ctx.fillStyle = "rgba(244,238,226,0.98)"; ctx.fill(); }
    ctx.beginPath(); C.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, p[0] - 0.4 * p[1], p[2]));
    ctx.strokeStyle = "rgba(255,255,252,0.7)"; ctx.lineWidth = 0.8; ctx.stroke();
  }

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
      ctx.fillStyle = bodyFill(ctx, poly.gx * d0, poly.gy * d0, poly.gx * (d0 + span), poly.gy * (d0 + span), span);
      ctx.fill();
      drawCream(ctx, s);
      const on = poly.shape.filter(([x, y]) => Math.abs(x * poly.gx + y * poly.gy - poly.c) < 0.5);
      if (on.length >= 2) {
        ctx.beginPath(); ctx.moveTo(on[0][0], on[0][1]); ctx.lineTo(on[1][0], on[1][1]);
        ctx.strokeStyle = "rgba(255,246,232,0.55)"; ctx.lineWidth = 1.2; ctx.stroke();
      }
    } else if (minTop < H - 0.3) {
      ctx.beginPath(); surfacePath(); ctx.lineTo(W, H + 2); ctx.lineTo(0, H + 2); ctx.closePath();
      const span = Math.max(140, H - minTop);
      ctx.fillStyle = bodyFill(ctx, 0, minTop, 0, minTop + span, span); ctx.fill();
      drawCream(ctx, s);

      // under the stream, the air it drags down clouds the coffee lighter
      if (s.flowing || (s.stopAt >= 0 && s.t - s.stopAt < 2)) {
        const fade = s.flowing ? 1 : Math.max(0, 1 - (s.t - s.stopAt) / 2);
        const y = s.surfaceX(s.x0) + 6, rad = Math.min(H - y + 20, 14 + s.widthAt(y) * 4);
        if (rad > 4) {
          ctx.save(); ctx.clip();
          const churn = ctx.createRadialGradient(s.x0, y, 0, s.x0, y, rad);
          churn.addColorStop(0, `rgba(150,112,80,${0.3 * fade})`);
          churn.addColorStop(1, "rgba(150,112,80,0)");
          ctx.fillStyle = churn; ctx.fillRect(s.x0 - rad, y - rad, rad * 2, rad * 2);
          ctx.restore();
        }
      }

      // the glossy surface: a soft reflection just under the line...
      ctx.save();
      ctx.beginPath(); surfacePath(); ctx.lineTo(W, H + 2); ctx.lineTo(0, H + 2); ctx.closePath(); ctx.clip();
      ctx.beginPath(); surfacePath();
      ctx.strokeStyle = "rgba(255,240,224,0.07)"; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = "rgba(255,240,224,0.08)"; ctx.lineWidth = 4; ctx.stroke();
      ctx.restore();

      // ...a little foam where it was poured (pale, greyish, never a crema band)
      const foam = (i) => Math.max(0, 0.5 * (s.f[Math.max(0, i - 1)] + s.f[Math.min(N - 1, i)]) - 1.6);
      let any = false;
      for (let i = 0; i <= N; i++) if (foam(i) > 0.3) { any = true; break; }
      if (any) {
        ctx.beginPath(); surfacePath();
        for (let i = N; i >= 0; i--) ctx.lineTo(i * dx, top[i] + foam(i));
        ctx.closePath();
        ctx.fillStyle = "rgba(168,134,104,0.7)"; ctx.fill();
      }

      // ...the few bubbles, clear with bright rims, drifting to the edges
      for (const b of s.bubbles) {
        const y = s.surfaceX(b.x) + b.r * 0.2;
        const a = Math.min(1, b.age * 6, (b.life - b.age) * 2);
        ctx.globalAlpha = Math.max(0, a);
        ctx.beginPath(); ctx.arc(b.x, y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(120,92,70,0.35)"; ctx.fill();
        ctx.strokeStyle = "rgba(240,226,206,0.65)"; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, y - b.r * 0.35, Math.max(0.4, b.r * 0.25), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,252,245,0.85)"; ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ...and the sharp highlight along the line, brighter on faces tipped to the light
      ctx.lineCap = "round";
      const STEP = 6;
      for (let i = 0; i < N; i += STEP) {
        const j = Math.min(N, i + STEP), slope = (top[j] - top[i]) / ((j - i) * dx);
        const a = clamp(0.4 + slope * 2.4, 0.1, 0.8);
        ctx.beginPath(); ctx.moveTo(i * dx, top[i]);
        for (let k = i + 1; k <= j; k++) ctx.lineTo(k * dx, top[k]);
        ctx.strokeStyle = `rgba(255,248,236,${a})`; ctx.lineWidth = 1.1; ctx.stroke();
      }
    }

    // steam, above the surface
    // (tall soft wisps, leaning as they sway; never under the coffee)
    for (const w of s.steam) {
      if (w.y > s.surfaceX(w.x) - 2) continue;
      const k = w.age / w.life, r = 6 + 16 * k, a = 0.06 * w.a * Math.sin(Math.PI * k);
      if (a <= 0.002) continue;
      ctx.save();
      ctx.translate(w.x, w.y); ctx.rotate(0.25 * Math.sin(w.ph + w.age * 2.3)); ctx.scale(1, 2.4);
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, `rgba(245,240,235,${a})`); gr.addColorStop(1, "rgba(245,240,235,0)");
      ctx.fillStyle = gr; ctx.fillRect(-r, -r, 2 * r, 2 * r);
      ctx.restore();
    }

    // The stream: a glossy round jet. Across it the light goes through a chord
    // of coffee D*sqrt(1-u^2) thick, so by Beer-Lambert its edges are amber and
    // its middle dark - and a bright reflection runs down one side.
    if (s.head > 0) {
      const yTop = Math.max(-4, s.tail), yEnd = Math.min(s.head, s.surfaceX(s.x0) + 2);
      if (yEnd > yTop) {
        const t = s.t, C = [];
        const steps = Math.max(2, Math.ceil((yEnd - yTop) / 6));
        for (let k = 0; k <= steps; k++) {
          const y = yTop + ((yEnd - yTop) * k) / steps;
          // a smooth, laminar stream: its edges barely ripple
          const hw = (s.widthAt(Math.max(0, y)) / 2) * (1 + 0.03 * Math.sin(0.09 * y - 22 * t) + 0.02 * Math.sin(0.031 * y + 9 * t));
          const cx = s.x0 + 0.6 * Math.sin(1.7 * t + y * 0.006);
          C.push([cx, hw, y]);
        }
        const U = [-1, -0.92, -0.75, -0.45, 0, 0.45, 0.75, 0.92, 1];
        for (let k = 0; k < C.length - 1; k++) {
          const [cx, hw, y] = C[k], [cx2, hw2, y2] = C[k + 1];
          const D = 2 * hw * s.MM;
          const grad = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
          for (const u of U) grad.addColorStop((u + 1) / 2, through(D * Math.sqrt(Math.max(0.04, 1 - u * u)), 0.95));
          ctx.beginPath();
          ctx.moveTo(cx - hw, y); ctx.lineTo(cx + hw, y); ctx.lineTo(cx2 + hw2, y2 + 0.6); ctx.lineTo(cx2 - hw2, y2 + 0.6);
          ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
        }
        const last = C[C.length - 1];
        if (s.head < s.surfaceX(s.x0)) { // the falling front is round
          ctx.beginPath(); ctx.arc(last[0], last[2], last[1], 0, Math.PI);
          ctx.fillStyle = through(2 * last[1] * s.MM * 0.7, 0.95); ctx.fill();
        }
        for (const [u, a, wdt] of [[-0.45, 0.55, 1.1], [0.62, 0.16, 0.8]]) {
          ctx.beginPath();
          C.forEach((c, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, c[0] + u * c[1], c[2]));
          ctx.strokeStyle = `rgba(255,248,238,${a})`; ctx.lineWidth = wdt; ctx.stroke();
        }
        // a little air in it, the way a Keurig spits as it pours
        const FLECKS = 24, fall = s.fallTime(H);
        for (let j = 0; j < FLECKS; j++) {
          const hash = Math.sin(j * 12.9898) * 43758.5453, a = hash - Math.floor(hash);
          const age = (t + j * 0.61803 * fall) % fall, y = s.fallY(age);
          if (y < yTop || y > yEnd - 2) continue;
          const half = s.widthAt(y) / 2, x = s.x0 + (a * 2 - 1) * half * 0.6;
          const rad = 0.5 + ((a * 7.31) % 1) * 0.9, len = rad + s.speedAt(y) * 0.002;
          ctx.beginPath(); ctx.ellipse(x, y, rad, len, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(225,205,182,0.3)"; ctx.fill();
        }
        if (s.flowing && s.head >= s.surfaceX(s.x0)) {
          const y = s.surfaceX(s.x0), w = s.widthAt(y);
          ctx.beginPath(); ctx.ellipse(s.x0, y + 1, w * 1.4, 2.6 + Math.sin(t * 17) * 0.6, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(176,140,110,0.6)"; ctx.fill();
        }
      }
    }

    drawCreamStream(ctx, s);

    // drops: tiny, so by Beer-Lambert nearly clear amber-brown (creamer's are milky)
    ctx.lineCap = "round";
    for (const d of s.drops) {
      const k = d.drip ? 0.012 : 0.006;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * k, d.y - d.vy * k);
      ctx.strokeStyle = d.cream ? "rgba(240,232,218,0.95)" : through(d.size * 2 * s.MM * 2, 0.9); ctx.lineWidth = d.size * 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(d.x - d.size * 0.3, d.y - d.size * 0.3, d.size * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,248,238,0.6)"; ctx.fill();
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
        const level = sim ? sim.level() : null, creamed = sim ? sim.creamed() : false;
        W = w; H = hgt; sim = createSim(W, H, { hold, mm });
        sim.setTilt(angle);
        // (before the stream has landed there is nothing to keep: it just starts again)
        if (level !== null && level > 0.01) sim.still(level, creamed);
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
      else if (dt > 1 / 30) { sim.skip(dt - 1 / 30); dt = 1 / 30; }   // a slow frame (steam only): the clock still runs true
      sim.step(dt); paint();
      raf = 0;
      if (sim.done) empty();
      // Still: only the steam moves, and it gets twelve frames a second rather
      // than sixty (a phone holds the cup forty minutes); once it has cooled
      // past steaming, nothing is drawn at all until the phone moves or the
      // drain is due.
      else if (sim.idle()) wake = root.setTimeout(resume, sim.steaming() ? 80 : Math.max(0, (sim.fullAt + sim.hold - sim.t) * 1000) + 30);
      else raf = root.requestAnimationFrame(frame);
    };
    root.addEventListener("resize", onResize);
    root.addEventListener("deviceorientation", onTilt);

    cup = { canvas };
    fit();
    // reduced motion: the full cup, no pour and no drain to watch — just gone after five seconds
    if (still) { sim.still(FILL, true); paint(); root.setTimeout(empty, hold * 1000); return true; }
    raf = root.requestAnimationFrame(frame);
    return true;
  }

  root.RELAY_COFFEE = { pour, createSim, poured: () => !!cup };
})(typeof window !== "undefined" ? window : globalThis);
