/* ─── the `coffee` egg: the screen is the cup ────────────────────────────
   Typing `coffee` pours a cup straight down from above the screen, a little
   right of centre, the way a Keurig does, until the page is about three
   quarters full. Ric, 2026-11-26. The plan, and the Mochi version still to
   come, is docs/coffee-egg-plan.md.

   Loaded only when somebody types `coffee` (terminal.html and the front door
   add this file on demand), so no page pays for it otherwise. No library.

   How the liquid works:
   - Where the coffee is: a puddle that runs out from the stream to the walls,
     then a pool, level because pressure shares what is poured in at once. The
     volume is exactly what the stream carried (see Q), and it drains by
     Torricelli. (It was 1D shallow water first; at this pour rate that piled
     the coffee into a tower under the stream before it could spread.)
   - On that, sloshing: the wave equation, thrown up where the puddle hits each
     wall and stirred where the stream goes in, reflecting and settling.
   - Over it, a fast ripple layer that the stream and the drops ring.
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
    const g = 9 * H;                                   // gravity for the falling coffee: a drop from the top takes ~0.25 s
    const cWave = clamp(0.32 * W, 220, 560);           // how fast a slosh crosses the pool, px/s
    const h = new Float64Array(N);                     // depth drawn: the pool plus its waves
    const base = new Float64Array(N);                  // where the coffee is, before waves
    const eta = new Float64Array(N), ev = new Float64Array(N); // sloshing
    const r = new Float64Array(N), rv = new Float64Array(N);   // small ripples
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
    const v0 = 0.8 * Math.sqrt(2 * g * H);             // leaving the nozzle above the screen
    const wFloor = clamp(W * 0.026, 16, 44);           // width where it meets the empty floor
    const Q = wFloor * Math.sqrt(v0 * v0 + 2 * g * H); // px²/s
    const w0 = Q / v0;                                 // width at the top of the screen
    const FMIN = 1.6;                                  // the crema film it thins to
    const SPREAD = clamp(0.55 * W, 300, 900);          // how fast the first puddle runs out, px/s
    const HOLD = opt.hold ?? DRAIN_AFTER;              // seconds full before it drains
    // Tilt: the angle of the phone's gravity across the screen (0 = straight
    // down the screen). The pool's surface follows it with some weight - a
    // damped spring that overshoots, which is the slosh you see when you tip
    // it - and so stays level in the world while the screen turns under it.
    let tilt = 0, tiltV = 0, tiltTo = 0, rimL = 0, sipSide = 0, sipAt = -1;
    const TILT_MAX = 1.45;                             // ~83 degrees: as good as on its side

    const s = {
      W, H, N, dx, x0, i0, w0, h, r, f, drops, bubbles, drips,
      t: 0, volume: 0, head: -1, tail: -1, stopAt: -1, hit: false, flowing: false,
      fullAt: -1, draining: false, done: false, hold: HOLD,
      left: x0, right: x0,                             // the puddle's edges until it is wall to wall
    };

    const surfaceAt = (i) => H - h[i] - r[i] * clamp(h[i] / 25, 0, 1);
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
          vx: side * (30 + rand() * 200) * scale, vy: -(140 + rand() * 420) * scale,
          size: 1 + rand() * 2.2,
        });
      }
    }

    function bubble(x, big) {
      if (bubbles.length > 420) return;
      bubbles.push({ x, vx: (rand() - 0.5) * 120, r: big ? 2 + rand() * 3.2 : 0.8 + rand() * 1.8, age: 0, life: 1.2 + rand() * 6 });
    }

    // a wave thrown up at a wall, or pushed down under the stream
    function kick(x, wide, speed) { for (const [i, w] of bump(x, wide)) ev[i] += speed * w * (wide / dx) * 1.77; }

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
        const slope = Math.tan(tilt);
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
          rimL = L;                                     // where the level would stand, rim or no rim (drinking reads it)
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

      // the first puddle runs out to the walls, and slaps up them when it gets there
      if (s.hit && !wallToWall()) {
        const wasL = s.left, wasR = s.right;
        s.left = Math.max(-1, s.left - SPREAD * dt); s.right = Math.min(W + 1, s.right + SPREAD * dt);
        const run = 0.5 * cWave;
        if (wasL > 0 && s.left <= 0) kick(0, 60, run);
        if (wasR < W && s.right >= W) kick(W, 60, run);
      }

      // sloshing: the wave equation over the pool, walls reflect, slowly settles
      const c2 = (cWave * cWave) / (dx * dx);
      for (let i = 0; i < N; i++) {
        const l = eta[i > 0 ? i - 1 : 0], rr = eta[i < N - 1 ? i + 1 : N - 1];
        ev[i] += dt * c2 * (l + rr - 2 * eta[i]);
        ev[i] *= Math.exp(-0.45 * dt);
      }
      let mean = 0;
      for (let i = 0; i < N; i++) { eta[i] = clamp(eta[i] + dt * ev[i], -70, 70); mean += eta[i]; }
      mean /= N;
      for (let i = 0; i < N; i++) eta[i] -= mean;      // waves move coffee about; they never make or lose any

      // the stream: rings the ripples, stirs the pool, makes crema
      if (s.flowing) {
        const ker = bump(x0, Math.max(dx, widthAt(surfaceAt(i0)) * 0.7));
        for (const [i, w] of ker) {
          rv[i] -= 900 * w * (0.6 + 0.8 * rand()) * dt * 60;
          f[i] = Math.min(20, f[i] + 34 * w * dt * ker.length);
        }
        if (wallToWall()) for (const [i, w] of ker) ev[i] += (rand() - 0.51) * 2600 * w * dt * 60;
      }

      // ripples
      const kR = 190 * 190, kS = 18;
      for (let i = 0; i < N; i++) {
        const l = r[i > 0 ? i - 1 : 0], rr = r[i < N - 1 ? i + 1 : N - 1];
        rv[i] += dt * ((kR * (l + rr - 2 * r[i])) / (dx * dx) - kS * r[i]);
        rv[i] *= Math.exp(-2.2 * dt);
      }
      mean = 0;
      for (let i = 0; i < N; i++) { r[i] = clamp(r[i] + dt * rv[i], -9, 9); mean += r[i]; }
      mean /= N;
      for (let i = 0; i < N; i++) r[i] -= mean;

      layOut();
      for (let i = 0; i < N; i++) h[i] = clamp(base[i] + eta[i] * clamp(base[i] / 20, 0, 1), 0, H);

      // crema is carried out from the stream, spreads a little and thins to a film
      for (let i = 0; i < N; i++) {
        const uc = drift(X(i));
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

    // the surface current: out from where the stream goes in, while it pours
    function drift(x) {
      if (!s.flowing) return 0;
      const d = x - x0;
      return Math.sign(d) * 160 * Math.exp(-Math.abs(d) / (0.25 * W));
    }

    function stepParticles(dt) {
      for (let k = drops.length - 1; k >= 0; k--) {
        const d = drops[k];
        d.vy += g * dt; d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.x < 1) { d.x = 1; d.vx = -d.vx * 0.4; } else if (d.x > W - 1) { d.x = W - 1; d.vx = -d.vx * 0.4; }
        const i = colOf(d.x);
        if (d.vy > 0 && d.y >= surfaceAt(i)) {
          rv[i] -= d.size * (d.drip ? 120 : 45);
          if (rand() < 0.35) bubble(d.x, false);
          drops.splice(k, 1);
        }
      }
      for (let k = bubbles.length - 1; k >= 0; k--) {
        const b = bubbles[k];
        const i = colOf(b.x);
        b.vx += (drift(b.x) * 0.8 - b.vx) * Math.min(1, dt * 1.5);
        b.x += b.vx * dt;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.3; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.3; }
        b.age += dt;
        if (b.age > b.life || h[i] < 1) bubbles.splice(k, 1);
      }
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
        splash(40, 1.1);
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
        if (n) splash(n, clamp(speedAt(ys0) / 3000, 0.35, 1));
        // a foamy stream: it carries air down and the air comes up as bubbles
        for (let k = 0; k < 2; k++) if (rand() < frameDt * 50) bubble(x0 + (rand() - 0.5) * widthAt(ys0) * 2.4, rand() < 0.35);
      }

      // Five seconds full, then it drains out of the floor. Torricelli: what
      // leaves a hole goes as sqrt(2·g·depth), so the level falls fast at
      // first and slows near the end — dh/dt = −k·√h, empty after
      // T = 2·√h₀ / k. The surface dips over the drain while it runs.
      if (s.fullAt >= 0 && !s.draining && t - s.fullAt >= HOLD) s.draining = true;
      if (s.draining) {
        const k = (2 * Math.sqrt(FILL * H)) / DRAIN_S;
        const mean = s.volume / W, fall = Math.max(k * Math.sqrt(mean), 30);
        drainDip = 0.09 * fall;
        s.volume = Math.max(0, s.volume - fall * frameDt * W);
      }

      // the surface swings toward the phone's angle, overshoots and settles;
      // a fast swing throws a wave across the pool as well
      {
        const w = 5, acc = -w * w * (tilt - tiltTo) - 2 * 0.28 * w * tiltV;
        tiltV += acc * frameDt; tilt += tiltV * frameDt;
        if (wallToWall()) for (let i = 0; i < N; i++) ev[i] -= acc * frameDt * (X(i) - W / 2) * 0.08;
      }

      // as many substeps as the fastest wave needs
      const n = Math.max(1, Math.ceil(frameDt / ((0.4 * dx) / Math.max(cWave, 190)))), dt = frameDt / n;
      for (let k = 0; k < n; k++) stepFluid(dt);
      stepParticles(frameDt);

      // Tipped so far that the coffee reaches a top corner, it goes over the
      // rim there, as if somebody were drinking it. What leaves is what a
      // rim lets over (the weir equation): Q = (2/3)·Cd·√(2g)·head^(3/2),
      // head being how far above the rim the level would stand, Cd ≈ 0.6 —
      // so tip a little past the corner and it sips, tip more and it pours.
      // It comes in swallows rather than a steady flow. As the level falls
      // the rim lets less over, so you tip further, as you would a mug; and
      // held hard over (past ~65°) toward the side it was drinking from, it
      // keeps on until the cup is empty — the last of a cup lies too low to
      // reach a corner however a screen is held.
      s.sipping = false;
      if (wallToWall() && !s.draining && Math.abs(tilt) > 0.05) {
        const side = tilt > 0 ? 1 : -1;
        const head = rimL + Math.tan(tilt) * side * (W / 2) - H;
        const swallow = 2.2 * Math.max(0, Math.sin(2 * Math.PI * 1.1 * t)) ** 2;
        // ...but nobody swallows faster than a swallow: tipped right over, the
        // rim would let the whole cup go at once, and a drinker takes it in
        // about nine seconds of gulps instead
        let rate = head > 0 ? Math.min((2 / 3) * 0.6 * Math.sqrt(2 * g) * head ** 1.5, 0.2 * target) : 0;
        if (rate > 0) { sipSide = side; sipAt = t; }
        if (side === sipSide && t - sipAt < 3 && Math.abs(tilt) > 1.13) rate = Math.max(rate, 0.09 * target);
        if (rate > 0) {
          const take = Math.min(s.volume, rate * swallow * frameDt);
          s.volume -= take; s.sipping = true;
          if (take > 0) { sipAt = t; for (const [i, w] of bump(side > 0 ? W : 0, 50)) rv[i] -= 400 * w * swallow * frameDt * 60; }
        }
      }

      if (s.fullAt >= 0 && s.volume <= 0 && !s.flowing && !drops.length) {
        h.fill(0); f.fill(0); bubbles.length = 0; s.done = true;
      }
    };

    // the finished cup, for reduced motion and for a window that changed width
    // (the drain still comes five seconds later)
    s.still = function (fraction = FILL) {
      s.volume = fraction * H * W; s.left = -1; s.right = W + 1;
      eta.fill(0); ev.fill(0); r.fill(0); rv.fill(0); f.fill(FMIN);
      drops.length = drips.length = 0; bubbles.length = 0;
      s.hit = true; s.flowing = false; s.stopAt = s.t; s.head = s.tail = -1;
      s.fullAt = s.t; s.draining = false; s.done = false; drainDip = 0;
      layOut(); for (let i = 0; i < N; i++) h[i] = base[i];
    };

    s.setTilt = (a) => { tiltTo = clamp(a, -TILT_MAX, TILT_MAX); };
    s.tilt = () => tilt;
    s.skip = (sec) => { s.t += sec; };                // time passed with nothing to draw (asleep, tab hidden)
    // Nothing is moving: a full cup, still, waiting. The page stops drawing
    // until the phone moves or the drain is due - on a phone that is forty
    // minutes, and a canvas redrawn sixty times a second for forty minutes is
    // a battery.
    s.idle = () => {
      if (s.fullAt < 0 || s.draining || s.flowing || s.sipping || drops.length || drips.length || bubbles.length) return false;
      if (Math.abs(tilt - tiltTo) > 0.002 || Math.abs(tiltV) > 0.004) return false;
      let e = 0, foam = 0;
      for (let i = 0; i < N; i++) { e += ev[i] * ev[i] + rv[i] * rv[i] + 0.5 * eta[i] * eta[i]; foam = Math.max(foam, f[i] - FMIN); }
      return e / N < 0.6 && foam < 0.5;
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

    if (minTop < H - 0.3) {
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

    let W = 0, H = 0, sim = null, raf = 0, wall = 0, wake = 0, angle = 0;
    const fit = () => {
      const w = canvas.clientWidth || root.innerWidth, hgt = canvas.clientHeight || root.innerHeight;
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!sim || Math.abs(w - W) > 1) {
        // a new width is a new cup, already poured, at the level it had reached
        const level = sim ? sim.level() : null;
        W = w; H = hgt; sim = createSim(W, H, { hold });
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
