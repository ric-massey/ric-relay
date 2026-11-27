/* ─── the `coffee` egg: the screen is the cup ────────────────────────────
   Typing `coffee` pours a cup straight down from above the screen, a little
   right of centre, the way a Keurig does, until the page is about three
   quarters full; a second later a splash of creamer goes in. Ric,
   2026-11-26. The plan, and the Mochi version still to come, is
   docs/coffee-egg-plan.md.

   Loaded only when somebody types `coffee` (terminal.html and the front door
   add this file on demand), so no page pays for it otherwise. No library.

   It is one liquid simulation (Ric: "the waves don't work like liquid because
   there is no splashes"), the standard one for splashing liquids: FLIP
   (Zhu & Bridson 2005; Bridson, "Fluid Simulation for Computer Graphics").
   The liquid is tens of thousands of particles that carry its velocity and
   what it is made of; each step they hand their velocity to a staggered grid,
   gravity and the creamer's extra weight push it, a pressure solve (MIC(0)
   preconditioned conjugate gradients, to convergence) makes it
   incompressible, and they take the change back and move. The pour, the
   splash, the droplets, the waves, the slosh when the phone is tipped or
   shaken, the creamer plunging, curling and settling, the drain and the coffee
   running out over the top edge are all that one thing - none is drawn or
   scripted.

   Real units: gravity is 9.81 m/s^2 at the screen's real size, and on a phone
   it is what the phone feels - its tilt and its shaking (devicemotion's
   accelerationIncludingGravity), so a shake really throws the liquid about.
   Chosen, not derived: the nozzle (a Keurig's 5 mm stream at 0.6 m/s), the
   jug, how much creamer (2%) and how much denser (4%), the drain's hole, the
   colours (Beer-Lambert constants), the bubbles and the steam.

   Nothing here touches the page under it: the canvas lets every click and
   key through. Five seconds after it is full (forty minutes on a phone) it
   drains through the floor, and the canvas goes. */
(function (root) {
  const FILL = 0.75;     // how full the screen ends up
  const DRAIN_AFTER = 5; // seconds the full cup stands before it drains (Ric, 2026-11-26)
  const PHONE_HOLD = 40 * 60; // on a phone: forty minutes (Ric, 2026-11-26)
  const OFF = 0.07;      // stream sits this fraction of the width right of centre
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ─── the liquid ───────────────────────────────────────────────────── */

  function createSim(W, H, opt = {}) {
    const rand = opt.random || Math.random;
    const MM = opt.mm || 0.2646;                       // mm per px (a CSS pixel; a phone's is estimated)
    const PXM = 1000 / MM;                             // px per metre
    const G = 9.81 * PXM;                              // px/s^2
    const HOLD = opt.hold ?? DRAIN_AFTER;

    // The grid: square cells, about 8,000 over the screen but none smaller
    // than 1.5 mm (a phone's screen is small; finer costs a phone more than
    // it can spare - 1.3 mm was 40% dearer); the walls
    // are the screen's sides and floor, the top is the cup's open mouth.
    const h = W / Math.max(16, Math.round(W / Math.max(Math.sqrt((W * H) / 8000), 1.5 / MM)));
    const nx = Math.round(W / h), ny = Math.max(8, Math.round(H / h)), NC = nx * ny, NU = nx + 1;
    const Hs = ny * h;                                 // the floor (within half a cell of H; drawn stretched to H)
    const PA = (h * h) / 4;                            // each particle is a quarter of a cell of liquid

    // particles
    let cap = 4096, n = 0;
    let X = new Float32Array(cap), Y = new Float32Array(cap), VX = new Float32Array(cap), VY = new Float32Array(cap), C = new Float32Array(cap);
    const grow = () => {
      cap *= 2;
      const g2 = (a) => { const b = new Float32Array(cap); b.set(a); return b; };
      X = g2(X); Y = g2(Y); VX = g2(VX); VY = g2(VY); C = g2(C);
    };
    const add = (x, y, vx, vy, c) => { if (n >= cap) grow(); X[n] = x; Y[n] = y; VX[n] = vx; VY[n] = vy; C[n] = c; n++; };
    const kill = (k) => { n--; X[k] = X[n]; Y[k] = Y[n]; VX[k] = VX[n]; VY[k] = VY[n]; C[k] = C[n]; };

    // grid
    const u = new Float32Array(NU * ny), v = new Float32Array(nx * (ny + 1));
    const uw = new Float32Array(NU * ny), vw = new Float32Array(nx * (ny + 1));
    const u0 = new Float32Array(NU * ny), v0 = new Float32Array(nx * (ny + 1));
    const uOk = new Uint8Array(NU * ny), vOk = new Uint8Array(nx * (ny + 1));
    const fluid = new Uint8Array(NC), count = new Float32Array(NC), cSum = new Float32Array(NC);
    const p = new Float64Array(NC), rhs = new Float64Array(NC), pr = new Float64Array(NC), pz = new Float64Array(NC);
    const ps = new Float64Array(NC), pq = new Float64Array(NC), pre = new Float64Array(NC);

    // the stream: continuity, as a sheet (this is 2D): Q = w*v at every height
    const x0 = W * (0.5 + OFF);
    const vTop = Math.sqrt((0.6 * PXM) ** 2 + 2 * G * (60 / MM));   // 0.6 m/s out of a spout 60 mm above the screen
    const w0 = 5 / MM;                                 // 5 mm wide where it comes into view
    const Q = w0 * vTop;                               // px^2/s
    const target = FILL * W * Hs;
    // the creamer's jug: 0.3 m/s out of a lip 30 mm above the screen, 3 mm wide, left of centre
    const xc = W * 0.36, vJug = Math.sqrt((0.3 * PXM) ** 2 + 2 * G * (30 / MM)), wJug = 3 / MM, Qc = wJug * vJug;
    const CREAM = opt.cream ?? 0.02, DRHO = 0.04, CREAM_AFTER = 1;
    // the drain: a hole mid-floor. Torricelli says a hole w wide empties the
    // cup in T = 2V / (Cd*w*sqrt(2gh)); measured here the liquid goes about
    // twice as fast as Cd = 0.6 says (the jet does not contract in 2D), so the
    // hole is sized on that: half the cup is gone in about a second, the rest
    // follows as Torricelli's slowing trickle
    const hole = clamp((2 * target) / (4.5 * Math.sqrt(2 * G * FILL * Hs)) / 1.2, 2 * h, W * 0.4);
    const holeL = W / 2 - hole / 2, holeR = W / 2 + hole / 2;

    const s = {
      W, H, Hs, h, nx, ny, MM, PXM, PA, x0, w0, xc,
      t: 0, volume: 0, emitted: 0, dripped: 0, stopAt: -1, fullAt: -1, draining: false, done: false, hold: HOLD,
      flowing: false, hit: false, sipping: false, outflow: 0, asleep: false,
      cream: { on: CREAM > 0, want: CREAM * target, poured: 0, start: -1, stop: -1, hit: false },
      gx: 0, gy: G,                                    // what the liquid feels, px/s^2 (gravity, minus the phone's own acceleration)
      bubbles: [], steam: [], drips: [], drops: [],
    };
    s.widthAt = (y) => Q / Math.sqrt(vTop * vTop + 2 * G * Math.max(0, y));
    s.speedAt = (y) => Math.sqrt(vTop * vTop + 2 * G * Math.max(0, y));
    s.fallTime = (y) => (-vTop + Math.sqrt(vTop * vTop + 2 * G * Math.max(0, y))) / G;

    // ── grid helpers
    const sample = (A, w, hh, x, y) => {
      x = clamp(x, 0, w - 1); y = clamp(y, 0, hh - 1);
      const i = Math.min(w - 2, Math.floor(x)), j = Math.min(hh - 2, Math.floor(y)), a = x - i, b = y - j, k = j * w + i;
      return (A[k] * (1 - a) + A[k + 1] * a) * (1 - b) + (A[k + w] * (1 - a) + A[k + w + 1] * a) * b;
    };
    const uAt = (A, x, y) => sample(A, NU, ny, x / h, y / h - 0.5);
    const vAt = (A, x, y) => sample(A, nx, ny + 1, x / h - 0.5, y / h);
    const holeAt = (i) => s.draining && (i + 0.5) * h > holeL && (i + 0.5) * h < holeR;

    function splat(A, W8, w, hh, x, y, val) {
      x = clamp(x, 0, w - 1.001); y = clamp(y, 0, hh - 1.001);
      const i = Math.floor(x), j = Math.floor(y), a = x - i, b = y - j, k = j * w + i;
      const w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
      A[k] += val * w00; A[k + 1] += val * w10; A[k + w] += val * w01; A[k + w + 1] += val * w11;
      W8[k] += w00; W8[k + 1] += w10; W8[k + w] += w01; W8[k + w + 1] += w11;
    }

    // ── 1. particles to grid
    function toGrid() {
      u.fill(0); v.fill(0); uw.fill(0); vw.fill(0); fluid.fill(0); count.fill(0); cSum.fill(0);
      for (let k = 0; k < n; k++) {
        const x = X[k], y = Y[k];
        splat(u, uw, NU, ny, x / h, y / h - 0.5, VX[k]);
        splat(v, vw, nx, ny + 1, x / h - 0.5, y / h, VY[k]);
        const c = clamp(Math.floor(x / h), 0, nx - 1) + clamp(Math.floor(y / h), 0, ny - 1) * nx;
        fluid[c] = 1; count[c]++; cSum[c] += C[k];
      }
      fillHoles();
      for (let k = 0; k < u.length; k++) { uOk[k] = uw[k] > 0 ? 1 : 0; u[k] = uw[k] > 0 ? u[k] / uw[k] : 0; }
      for (let k = 0; k < v.length; k++) { vOk[k] = vw[k] > 0 ? 1 : 0; v[k] = vw[k] > 0 ? v[k] / vw[k] : 0; }
    }

    // A cell the particles happen to have left empty, inside the liquid, is
    // still liquid, not a bubble of air at zero pressure - taken for air, the
    // liquid around it would rush in and squeeze itself. So an empty cell with
    // liquid above it and on two more sides (a wall counts) is liquid.
    function fillHoles() {
      for (let pass = 0; pass < 2; pass++) {
        const add = [];
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          if (fluid[k]) continue;
          // (liquid above it too: an empty cell at the top is the surface, not a hole)
          if (j === 0 || !fluid[k - nx]) continue;
          const m = (i === 0 || fluid[k - 1] ? 1 : 0) + (i === nx - 1 || fluid[k + 1] ? 1 : 0) + (j === ny - 1 || fluid[k + nx] ? 1 : 0);
          if (m >= 2) add.push(k);
        }
        for (const k of add) fluid[k] = 1;
      }
    }

    // ── 2. forces: what the liquid feels (gravity and the phone's shaking),
    // and the creamer's extra weight, drho*c of it (Boussinesq)
    const F = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny ? fluid[j * nx + i] : 0);
    const cOf = (i, j) => { const k = j * nx + i; return count[k] ? cSum[k] / count[k] : 0; };
    function forces(dt) {
      for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
        if (!(F(i - 1, j) || F(i, j))) continue;
        const c = 0.5 * ((F(i - 1, j) ? cOf(i - 1, j) : 0) + (F(i, j) ? cOf(i, j) : 0));
        u[j * NU + i] += s.gx * (1 + DRHO * c) * dt;
      }
      for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) {
        if (!(F(i, j - 1) || F(i, j))) continue;
        const c = 0.5 * ((F(i, j - 1) ? cOf(i, j - 1) : 0) + (F(i, j) ? cOf(i, j) : 0));
        v[j * nx + i] += s.gy * (1 + DRHO * c) * dt;
      }
    }
    // Turbulence too small for the grid to hold: Smagorinsky's eddy
    // viscosity, nu_t = (Cs*h)^2*|S|, Cs = 0.17 (Lilly), |S| the strain rate.
    // It is what brakes a plunging stream within centimetres - a jet is all
    // shear - and leaves a slow slosh, which has hardly any, nearly alone.
    // (Plus the liquid's own viscosity, which at this scale is nothing.)
    const spin = new Float32Array(NC), nuT = new Float32Array(NC), uT = new Float32Array(NU * ny), vT = new Float32Array(nx * (ny + 1));
    function eddies(dt) {
      const cs2 = (0.17 * h) ** 2, lim = (0.2 * h * h) / dt, nu0 = 0.5e-6 * PXM * PXM;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!fluid[k]) { nuT[k] = 0; continue; }
        const dudx = (u[j * NU + i + 1] - u[j * NU + i]) / h, dvdy = (v[(j + 1) * nx + i] - v[k]) / h;
        const uc = (jj) => 0.5 * (u[jj * NU + i] + u[jj * NU + i + 1]), vc = (ii) => 0.5 * (v[j * nx + ii] + v[(j + 1) * nx + ii]);
        const dudy = (uc(Math.min(ny - 1, j + 1)) - uc(Math.max(0, j - 1))) / (2 * h), dvdx = (vc(Math.min(nx - 1, i + 1)) - vc(Math.max(0, i - 1))) / (2 * h);
        const S12 = 0.5 * (dudy + dvdx), mag = Math.sqrt(2 * (dudx * dudx + dvdy * dvdy + 2 * S12 * S12));
        nuT[k] = Math.min(lim, nu0 + cs2 * mag);
      }
      // A flat flow keeps its big swirls for ever - in 2D energy goes to
      // larger eddies, not smaller - where in a real cup a swirl breaks down
      // and is gone in a few turns (energy lost at about C*u^3/L, Taylor;
      // u/L is the swirl's rate of turn, |omega|/2). So wherever the liquid
      // turns, it is slowed at a rate of C*|omega|/2, C ~ 0.5. A wave or a
      // slosh does not turn (it is irrotational), so it is left alone.
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!fluid[k]) { spin[k] = 0; continue; }
        const vr = i < nx - 1 ? 0.5 * (v[j * nx + i + 1] + v[(j + 1) * nx + i + 1]) : 0, vl = i > 0 ? 0.5 * (v[j * nx + i - 1] + v[(j + 1) * nx + i - 1]) : 0;
        const ud = j < ny - 1 ? 0.5 * (u[(j + 1) * NU + i] + u[(j + 1) * NU + i + 1]) : 0, uu = j > 0 ? 0.5 * (u[(j - 1) * NU + i] + u[(j - 1) * NU + i + 1]) : 0;
        spin[k] = Math.abs((vr - vl) - (ud - uu)) / (2 * h);
      }
      for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
        const w = 0.5 * (spin[j * nx + i - 1] + spin[j * nx + i]);
        if (w) u[j * NU + i] /= 1 + 0.25 * w * dt;
      }
      for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
        const w = 0.5 * (spin[(j - 1) * nx + i] + spin[j * nx + i]);
        if (w) v[j * nx + i] /= 1 + 0.25 * w * dt;
      }
      uT.set(u); vT.set(v);
      const r = dt / (h * h);
      for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
        const a = nuT[j * nx + i - 1], b = nuT[j * nx + i]; if (!(a || b)) continue;
        const k = j * NU + i, nu = 0.5 * (a + b);
        const up = j > 0 ? uT[k - NU] : uT[k], dn = j < ny - 1 ? uT[k + NU] : uT[k];
        u[k] = uT[k] + nu * r * (uT[k - 1] + uT[k + 1] + up + dn - 4 * uT[k]);
      }
      for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = nuT[(j - 1) * nx + i], b = nuT[j * nx + i]; if (!(a || b)) continue;
        const k = j * nx + i, nu = 0.5 * (a + b);
        const l = i > 0 ? vT[k - 1] : vT[k], rr = i < nx - 1 ? vT[k + 1] : vT[k];
        v[k] = vT[k] + nu * r * (l + rr + vT[k - nx] + vT[k + nx] - 4 * vT[k]);
      }
    }

    // the walls: the sides and the floor (bar the drain's hole while it drains)
    function walls() {
      for (let j = 0; j < ny; j++) { u[j * NU] = 0; u[j * NU + nx] = 0; }
      for (let i = 0; i < nx; i++) if (!holeAt(i)) v[ny * nx + i] = 0;
    }

    // ── 3. pressure: A p = -divergence, solved by MIC(0)-PCG. Air is at zero
    // pressure - above the liquid, past the open top, and below the drain.
    const nb = (i, j) => {
      // 0 solid wall, 1 air, 2 liquid
      if (i < 0 || i >= nx) return 0;
      if (j < 0) return 1;
      if (j >= ny) return holeAt(i) ? 1 : 0;
      return fluid[j * nx + i] ? 2 : 1;
    };
    const diag = new Float64Array(NC);
    // Where the surface is inside a cell. A cell with liquid in it is not all
    // liquid: the surface may be a little way into it. Zero pressure belongs
    // at the surface itself, not at the next cell's centre - put there, the
    // liquid at the top of every part-full cell would sink a little each step
    // and never rest. So the surface's place is worked out from the particles
    // (a signed distance: each particle a disc about 0.55 of a cell across
    // its centre), and the pressure across a liquid-air face is taken to fall
    // to zero at that point (the ghost fluid method, Gibou et al. 2002).
    const phi = new Float32Array(NC), PR = 0.55;
    function surfacePlace() {
      // nearest particle to each cell centre (squared, then one root a cell)
      phi.fill(9 * h * h);
      for (let k = 0; k < n; k++) {
        const x = X[k], y = Y[k], ci = Math.floor(x / h), cj = Math.floor(y / h);
        for (let dj = -1; dj <= 1; dj++) {
          const j = cj + dj; if (j < 0 || j >= ny) continue;
          const dy = (j + 0.5) * h - y, dy2 = dy * dy, row = j * nx;
          for (let di = -1; di <= 1; di++) {
            const i = ci + di; if (i < 0 || i >= nx) continue;
            const dx = (i + 0.5) * h - x, d2 = dx * dx + dy2;
            if (d2 < phi[row + i]) phi[row + i] = d2;
          }
        }
      }
      for (let c = 0; c < NC; c++) phi[c] = Math.sqrt(phi[c]) - PR * h;
    }
    // how far from a liquid cell's centre toward an air neighbour the surface is, as a fraction
    const theta = (kf, ka) => {
      const pf = Math.min(phi[kf], -0.01 * h), pa = ka < 0 ? 0.5 * h : Math.max(phi[ka], 0.01 * h);
      return clamp(pf / (pf - pa), 0.1, 1);
    };
    let ghost = false;
    function buildDiag() {
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!fluid[k]) { diag[k] = 0; continue; }
        let d = 0;
        const side = (ii, jj, ka) => { const t = nb(ii, jj); if (t === 2) d += 1; else if (t === 1) d += ghost ? 1 / theta(k, ka) : 1; };
        side(i - 1, j, k - 1); side(i + 1, j, k + 1); side(i, j - 1, j > 0 ? k - nx : -1); side(i, j + 1, j < ny - 1 ? k + nx : -1);
        diag[k] = d;
      }
    }
    function buildPrecon() {
      const TAU = 0.97, SIG = 0.25;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!fluid[k]) { pre[k] = 0; continue; }
        const d = diag[k];
        let e = d;
        if (i > 0 && fluid[k - 1]) { const q = pre[k - 1]; e -= q * q; if (j < ny - 1 && fluid[k - 1 + nx]) e -= TAU * q * q; }
        if (j > 0 && fluid[k - nx]) { const q = pre[k - nx]; e -= q * q; if (i < nx - 1 && fluid[k - nx + 1]) e -= TAU * q * q; }
        if (e < SIG * d) e = d;
        pre[k] = e > 0 ? 1 / Math.sqrt(e) : 0;
      }
    }
    function applyA(x, out) {
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!fluid[k]) { out[k] = 0; continue; }
        let sum = 0;
        if (i > 0 && fluid[k - 1]) sum += x[k - 1];
        if (i < nx - 1 && fluid[k + 1]) sum += x[k + 1];
        if (j > 0 && fluid[k - nx]) sum += x[k - nx];
        if (j < ny - 1 && fluid[k + nx]) sum += x[k + nx];
        out[k] = diag[k] * x[k] - sum;
      }
    }
    function applyM(r, z) {
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!fluid[k]) { z[k] = 0; continue; }
        let t = r[k];
        if (i > 0 && fluid[k - 1]) t += pre[k - 1] * z[k - 1];
        if (j > 0 && fluid[k - nx]) t += pre[k - nx] * z[k - nx];
        z[k] = t * pre[k];
      }
      for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
        const k = j * nx + i;
        if (!fluid[k]) continue;
        let t = z[k];
        if (i < nx - 1 && fluid[k + 1]) t += pre[k] * z[k + 1];
        if (j < ny - 1 && fluid[k + nx]) t += pre[k] * z[k + nx];
        z[k] = t * pre[k];
      }
    }
    const dot = (a, b) => { let t = 0; for (let k = 0; k < NC; k++) t += a[k] * b[k]; return t; };
    const maxAbs = (a) => { let t = 0; for (let k = 0; k < NC; k++) { const x = Math.abs(a[k]); if (x > t) t = x; } return t; };
    // conjugate gradients, preconditioned, from the guess already in x
    function pcg(x, b, tol, most = 200) {
      applyA(x, pq);
      for (let k = 0; k < NC; k++) pr[k] = b[k] - pq[k];
      if (maxAbs(pr) <= tol) return 0;
      applyM(pr, pz); ps.set(pz);
      let sig = dot(pz, pr), it;
      for (it = 1; it <= most; it++) {
        applyA(ps, pq);
        const den = dot(ps, pq); if (!(den > 0)) break;
        const a = sig / den;
        for (let k = 0; k < NC; k++) { x[k] += a * ps[k]; pr[k] -= a * pq[k]; }
        if (maxAbs(pr) <= tol) break;
        applyM(pr, pz);
        const sn = dot(pz, pr), bb = sn / sig;
        for (let k = 0; k < NC; k++) ps[k] = pz[k] + bb * ps[k];
        sig = sn;
      }
      return it;
    }
    function project(dt) {
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!fluid[k]) { rhs[k] = 0; p[k] = 0; continue; }
        rhs[k] = -(u[j * NU + i + 1] - u[j * NU + i] + v[(j + 1) * nx + i] - v[k]);
      }
      surfacePlace(); ghost = true;
      buildDiag(); buildPrecon();
      s.iters = pcg(p, rhs, 1 / MM);                   // to a millimetre a second of squeeze left in any cell
      // the pressure's difference across a face; next to air, the air side's
      // pressure is the one that makes it zero at the surface
      const dP = (ka, kb, aIn, bIn) => {   // pressure at b minus at a; a, b liquid or air (or -1, past the top)
        const fa = aIn && fluid[ka], fb = bIn && fluid[kb];
        if (fa && fb) return p[kb] - p[ka];
        if (fa) return -p[ka] / theta(ka, bIn ? kb : -1);
        if (fb) return p[kb] / theta(kb, aIn ? ka : -1);
        return 0;
      };
      for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) if (F(i - 1, j) || F(i, j)) u[j * NU + i] -= dP(j * nx + i - 1, j * nx + i, true, true);
      for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) {
        if (!(F(i, j - 1) || F(i, j))) continue;
        if (j === ny && !holeAt(i)) continue;
        v[j * nx + i] -= dP((j - 1) * nx + i, j * nx + i, j > 0, j < ny);
      }
      // what the faces next to liquid now hold is known; the rest is filled
      // in from their neighbours, so a particle at the surface reads a sensible velocity
      uOk.fill(0); vOk.fill(0);
      for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++) if (F(i - 1, j) || F(i, j)) uOk[j * NU + i] = 1;
      for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) if (F(i, j - 1) || F(i, j)) vOk[j * nx + i] = 1;
      extend(u, uOk, NU, ny); extend(v, vOk, nx, ny + 1);
    }
    function extend(A, ok, w, hh) {
      for (let pass = 0; pass < 2; pass++) {
        const add = [];
        for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
          const k = j * w + i;
          if (ok[k]) continue;
          let sum = 0, m = 0;
          if (i > 0 && ok[k - 1]) { sum += A[k - 1]; m++; }
          if (i < w - 1 && ok[k + 1]) { sum += A[k + 1]; m++; }
          if (j > 0 && ok[k - w]) { sum += A[k - w]; m++; }
          if (j < hh - 1 && ok[k + w]) { sum += A[k + w]; m++; }
          if (m) add.push(k, sum / m);
        }
        for (let q = 0; q < add.length; q += 2) { A[add[q]] = add[q + 1]; ok[add[q]] = 1; }
      }
    }

    // ── 4. grid to particles (FLIP, with a little PIC to keep it quiet) and move them
    const PIC = 0.03;
    let spilled = 0, drained = 0;
    function toParticles(dt) {
      let vmax = 0, mixAny = false, spSum = 0;
      for (let k = 0; k < NC; k++) if (cSum[k] > 0) { mixAny = true; break; }
      // the change the grid made, once, so each particle reads it in one look
      for (let k = 0; k < u.length; k++) u0[k] = u[k] - u0[k];
      for (let k = 0; k < v.length; k++) v0[k] = v[k] - v0[k];
      // Two liquids mix where they touch, as fast as the eddies there stir:
      // the turbulence carries creamer as it carries momentum (eddy
      // diffusivity nu_t / Sc, Schmidt number Sc ~ 0.7), so each particle's
      // share drifts toward its cell's at about D / h^2. Where the stream
      // plunges it blends in a moment; in still coffee the edges stay sharp.
      for (let k = 0; k < n; k++) {
        const x = X[k], y = Y[k];
        if (mixAny && (C[k] > 0 || true)) {
          const c = clamp(Math.floor(x / h), 0, nx - 1) + clamp(Math.floor(y / h), 0, ny - 1) * nx;
          if (count[c] && cSum[c] > 0) C[k] += (cSum[c] / count[c] - C[k]) * Math.min(1, (dt * 4 * nuT[c]) / (0.7 * h * h));
        }
        const un = uAt(u, x, y), vn = vAt(v, x, y);
        VX[k] = PIC * un + (1 - PIC) * (VX[k] + uAt(u0, x, y));
        VY[k] = PIC * vn + (1 - PIC) * (VY[k] + vAt(v0, x, y));
        // and moves with the liquid's velocity where it is - in one go if that
        // is under a cell, else by the midpoint rule in pieces of a cell
        const sp = Math.abs(un) + Math.abs(vn); if (sp > vmax) vmax = sp; spSum += sp;
        if (sp * dt <= h) { X[k] = x + dt * un; Y[k] = y + dt * vn; continue; }
        const pieces = Math.min(12, Math.ceil((sp * dt) / h)), d = dt / pieces;
        let px = x, py = y, pu = un, pv = vn;
        for (let q = 0; q < pieces; q++) {
          if (q) { pu = uAt(u, px, py); pv = vAt(v, px, py); }
          const xm = px + 0.5 * d * pu, ym = py + 0.5 * d * pv;
          px += d * uAt(u, xm, ym); py += d * vAt(v, xm, ym);
        }
        X[k] = px; Y[k] = py;
      }
      for (let k = n - 1; k >= 0; k--) {
        // past a wall or the floor by a little (a step's rounding), it is put
        // back as far inside as it went out - mirrored, not parked against the
        // wall, where particles would pile into a sliver that reads as crowded
        if (X[k] < 0) { X[k] = Math.min(-X[k], 0.5 * h); if (VX[k] < 0) VX[k] = 0; }
        if (X[k] > W) { X[k] = Math.max(2 * W - X[k], W - 0.5 * h); if (VX[k] > 0) VX[k] = 0; }
        if (Y[k] < 0 && VY[k] < 0) { kill(k); spilled += PA; continue; }        // out over the top edge
        if (Y[k] >= Hs) {
          if (s.draining && X[k] > holeL && X[k] < holeR) { kill(k); drained += PA; continue; }
          Y[k] = Math.max(2 * Hs - Y[k], Hs - 0.5 * h); if (VY[k] > 0) VY[k] = 0;
        }
      }
      s.vmean = n ? spSum / n : 0;
      return vmax;
    }

    // ── keeping its volume. FLIP's particles drift together under gravity, a
    // known flaw: left alone the liquid packs itself denser and shrinks. Each
    // step the crowding is measured (four particles a cell is the liquid as it
    // is) and the particles are moved apart by the gradient of a second
    // Poisson solve, A q = (excess volume per cell) / h - their positions
    // only, never their velocities, so no energy is added. Half of it is
    // undone each step. (Kugelstadt et al. 2019 and others do the same.)
    const qd = new Float64Array(NC), rd = new Float64Array(NC);
    const du = new Float32Array(NU * ny), dv = new Float32Array(nx * (ny + 1));
    const rho = new Float32Array(NC), rw = new Float32Array(NC);
    function relax() {
      // a smooth measure of crowding: each particle shared among the four
      // nearest cell centres, so it does not flicker as particles cross a line
      fluid.fill(0); rho.fill(0);
      for (let k = 0; k < n; k++) {
        const c = clamp(Math.floor(X[k] / h), 0, nx - 1) + clamp(Math.floor(Y[k] / h), 0, ny - 1) * nx;
        fluid[c] = 1;
        splat(rho, rw, nx, ny, X[k] / h - 0.5, Y[k] / h - 0.5, 1);
      }
      let any = false;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (!fluid[k]) { rd[k] = 0; qd[k] = 0; continue; }
        // too crowded, or - deep inside, where it cannot be the surface - too
        // sparse: a third of the difference past a twentieth is undone each step
        let e = rw[k] / 4 - 1;
        const inside = (i === 0 || fluid[k - 1]) && (i === nx - 1 || fluid[k + 1]) && j > 0 && fluid[k - nx] && (j === ny - 1 || fluid[k + nx]);
        e = e > 0.05 ? e - 0.05 : inside && e < -0.05 ? e + 0.05 : 0;
        rd[k] = 0.33 * e * h; if (e) any = true;
      }
      rw.fill(0);
      if (!any) return;
      ghost = false;
      buildDiag(); buildPrecon();
      pcg(qd, rd, 0.05 * h, 30);
      const Q = (i, j) => (i >= 0 && j >= 0 && i < nx && j < ny && fluid[j * nx + i] ? qd[j * nx + i] : 0);
      du.fill(0); dv.fill(0);
      for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) if (F(i - 1, j) || F(i, j)) du[j * NU + i] = -(Q(i, j) - Q(i - 1, j));
      for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) if (F(i, j - 1) || F(i, j)) dv[j * nx + i] = -(Q(i, j) - Q(i, j - 1));
      for (let k = 0; k < n; k++) {
        let x = X[k] + uAt(du, X[k], Y[k]), y = Y[k] + vAt(dv, X[k], Y[k]);
        if (x < 0) x = Math.min(-x, 0.5 * h); if (x > W) x = Math.max(2 * W - x, W - 0.5 * h);
        if (y > Hs) y = Math.max(2 * Hs - y, Hs - 0.5 * h);
        X[k] = x; Y[k] = y;
      }
    }

    // ── a step of the liquid
    function solve(dt) {
      toGrid();
      u0.set(u); v0.set(v);
      // friction before gravity: damped after, gravity's own push would be
      // shaved unevenly, the pressure could not hold it up, and the shaving
      // itself would stir the cup for ever
      eddies(dt); forces(dt); walls();
      project(dt);
      walls();
      const vmax = toParticles(dt);
      relax();
      return vmax;
    }

    // ── pouring. A stream in the air just falls - its fall is exact (it is
    // drawn from these numbers) - so it joins the liquid where it lands, with
    // its own speed and width there (continuity), and the splash is the
    // liquid's. (A 5 mm stream is thinner than the grid; simulated all the way
    // down it broke into blobs.)
    const fallY = (v0, tt) => v0 * tt + 0.5 * G * tt * tt;
    const speedAt = (v0, y) => Math.sqrt(v0 * v0 + 2 * G * Math.max(0, y));
    const fallTime = (v0, y) => (-v0 + Math.sqrt(v0 * v0 + 2 * G * Math.max(0, y))) / G;
    // the top of the liquid in a column, from the grid: the first liquid cell with liquid under it
    function landing(x) {
      const i = clamp(Math.floor(x / h), 0, nx - 1);
      for (let j = 0; j < ny; j++) if (fluid[j * nx + i] && (j === ny - 1 || fluid[(j + 1) * nx + i])) return j * h;
      return Hs;
    }
    function stream(x, w, v0, Q, want, c, startAt) {
      return { x, w, v0, Q, want, c, start: startAt, stop: -1, poured: 0, owe: 0, head: -1, tail: -1, xNow: x, land: Hs, done: false };
    }
    function pourStream(S, dt, t, sway) {
      if (S.start < 0 || t < S.start || S.done) return;
      S.xNow = S.x + sway;
      const ys = landing(S.xNow), ft = fallTime(S.v0, ys);
      S.land = ys;
      if (S.stop < 0 && S.Q * (t - S.start) >= S.want) S.stop = S.start + S.want / S.Q;
      S.head = fallY(S.v0, t - S.start); S.tail = S.stop >= 0 ? fallY(S.v0, Math.max(0, t - S.stop)) : -1;
      // what has reached the liquid by now
      const end = S.stop >= 0 ? Math.min(t, S.stop + ft) : t;
      const reached = clamp(S.Q * (end - S.start - ft), 0, S.want);
      const now = reached - S.poured;
      if (now > 0) {
        const v = speedAt(S.v0, ys), w = S.Q / v, want = now / PA + S.owe, m = Math.floor(want);
        S.owe = want - m;
        for (let q = 0; q < m; q++) add(S.xNow + (rand() - 0.5) * w, Math.max(0.01 * h, Math.min(Hs - 0.02 * h, ys - rand() * Math.min(v * dt, 2 * h))), (rand() - 0.5) * 0.02 * v, v, S.c);
        S.poured = reached;
      }
      if (S.stop >= 0 && t >= S.stop + ft && S.poured >= S.want - 1e-6) { S.done = true; S.head = S.tail = -1; }
    }
    const coffee = stream(x0, w0, vTop, Q, target, 0, 0.15);
    const creamS = stream(xc, wJug, vJug, Qc, CREAM * target, 1, -1);
    s.streams = [coffee, creamS];

    // a cup already poured and still (reduced motion, a new width): particles
    // in a lattice up to the level, the creamer (if it was in) at the bottom
    s.still = function (fraction = FILL, creamed = false) {
      n = 0; spilled = drained = 0;
      const level = Hs - (fraction * W * Hs) / W;
      const cream = creamed && s.cream.on ? s.cream.want / W : 0;
      for (let y = Hs - h / 4; y > level; y -= h / 2) for (let x = h / 4; x < W; x += h / 2) {
        add(x + (rand() - 0.5) * 0.1 * h, y, 0, 0, Hs - y < cream ? 1 : 0);
      }
      s.emitted = target; s.stopAt = s.t; s.fullAt = s.t; s.flowing = false; s.hit = true; s.draining = false; s.done = false;
      Object.assign(coffee, { poured: target, stop: s.t, done: true, head: -1, tail: -1 }); s.dripsSet = true; s.drips.length = 0;
      if (creamed) { Object.assign(s.cream, { poured: s.cream.want, start: s.t, stop: s.t, hit: true }); Object.assign(creamS, { start: s.t, poured: creamS.want, stop: s.t, done: true }); }
      s.asleep = false; quiet = 0;
      s.volume = n * PA;
    };

    // tilt (tests, and the fallback when a phone gives only its angle): gravity at that angle
    s.setTilt = (a) => s.setGravity(9.81 * Math.sin(a), 9.81 * Math.cos(a));
    // what the liquid feels, m/s^2 in screen axes (x right, y down)
    s.setGravity = (gx, gy) => {
      const nxg = gx * PXM, nyg = gy * PXM;
      if (Math.abs(nxg - s.gx) + Math.abs(nyg - s.gy) > 0.15 * PXM) { s.asleep = false; quiet = 0; }
      s.gx = nxg; s.gy = nyg;
    };
    s.tilt = () => Math.atan2(s.gx, s.gy);
    s.skip = (sec) => { s.t += sec; };

    // ── the step
    let quiet = 0;
    s.step = function (frameDt) {
      if (s.done) return;
      frameDt = Math.min(frameDt, 1 / 30);
      s.t += frameDt;
      const t = s.t;
      let poured = 0;

      // the coffee: it starts 0.15 s in and stops once the cup will be full
      pourStream(coffee, frameDt, t, 0);
      s.flowing = coffee.start <= t && !coffee.done;
      s.emitted = coffee.poured; s.stopAt = coffee.stop;
      if (coffee.stop >= 0 && !s.dripsSet) { s.dripsSet = true; s.drips.push(coffee.stop + 0.8 + rand() * 0.3, coffee.stop + 1.7 + rand() * 0.4, coffee.stop + 3 + rand() * 0.7); }
      if (coffee.done && s.fullAt < 0) s.fullAt = t;
      if (!s.hit && coffee.poured > 0) s.hit = true;
      // drips from the nozzle after it stops: drops falling exactly, joining the liquid where they land
      for (let q = s.drips.length - 1; q >= 0; q--) if (t >= s.drips[q]) { s.drops.push({ x: x0 + (rand() - 0.5) * 2, y: -4, vy: vTop * 0.2, r: (2.4 + rand()) / MM / 3.78 }); s.drips.splice(q, 1); }
      for (let q = s.drops.length - 1; q >= 0; q--) {
        const d = s.drops[q];
        d.vy += G * frameDt; d.y += d.vy * frameDt;
        if (d.y >= landing(d.x)) { const m = Math.max(1, Math.round((Math.PI * d.r * d.r) / PA)); for (let r = 0; r < m; r++) add(d.x + (rand() - 0.5) * d.r, landing(d.x) - rand() * d.r, 0, d.vy, 0); if (s.fullAt >= 0) s.dripped += m * PA; s.drops.splice(q, 1); s.asleep = false; }
      }

      // the creamer, a second after full, by a hand that moves a little
      const cr = s.cream;
      if (cr.on && creamS.start < 0 && s.fullAt >= 0 && t - s.fullAt >= CREAM_AFTER && !s.draining) { creamS.start = t; cr.start = t; }
      if (cr.on && creamS.start >= 0 && !creamS.done) {
        pourStream(creamS, frameDt, t, (3 / MM) * Math.sin(t * 3.1 + 1) + (1.5 / MM) * Math.sin(t * 7.3));
        cr.poured = creamS.poured; cr.stop = creamS.stop;
        s.asleep = false;
      }
      cr.hit = creamS.poured > 0;

      // five seconds full (forty minutes on a phone), then it drains
      if (s.fullAt >= 0 && !s.draining && t - s.fullAt >= HOLD) { s.draining = true; s.asleep = false; }

      // the liquid
      const before = n;
      spilled = drained = 0;
      if (!s.asleep) {
        let left = frameDt, vmax = 0;
        while (left > 1e-6) {
          // the grid at 60 Hz, or faster while anything crosses more than four cells a step
          const dt = Math.min(left, 1 / 60, 1 / 60);
          vmax = solve(dt);
          s.vmax = vmax;
          left -= dt;
        }
        // asleep once the liquid has, on average, moved under 1.5 mm a second
        // for two seconds (a creep the eye cannot follow; settling creamer
        // keeps up one for minutes, and a lone drop can still be rocking), and
        // nothing is being poured or drained; a new tilt or a shake wakes it
        const busy = s.flowing || s.draining || (creamS.start >= 0 && !creamS.done) || s.drips.length || s.drops.length;
        quiet = !busy && s.vmean < 1.5 / MM && vmax < 100 / MM ? quiet + frameDt : 0;
        if (quiet > 2) s.asleep = true;
      }
      // the last film on the floor never quite finds the hole (Torricelli never
      // reaches empty either): once it is under 4 mm deep, it is gone in a moment
      if (s.draining && (n * PA) / W < 4 / MM) { const m = Math.max(1, Math.ceil(n * frameDt / 0.4)); for (let q = 0; q < m && n; q++) kill(Math.floor(rand() * n)); }
      s.outflow = spilled / frameDt; s.sipping = spilled > 0; s.spiltSum = (s.spiltSum || 0) + spilled;
      s.volume = n * PA;
      void before; void poured;
      fieldDirty = true;

      stepBubbles(frameDt);
      stepSteam(frameDt);
      if (s.fullAt >= 0 && n === 0 && !s.drips.length && !s.drops.length) { s.done = true; s.bubbles.length = 0; s.steam.length = 0; }
    };

    // ── what the eye reads: a fine field of how much liquid is where, and of
    // what share of it is creamer, splatted from the particles (three per cell)
    const R = 4, fx = nx * R, fy = ny * R, NF = fx * fy, fr = h / R;
    const dens = new Float32Array(NF), crm = new Float32Array(NF), dist = new Float32Array(NF), surf = new Float32Array(fx);
    let fieldDirty = true;
    const foam = new Uint8Array(NF), froth = new Float32Array(NF), stack = [];
    function field() {
      if (!fieldDirty) return;
      fieldDirty = false;
      dens.fill(0); crm.fill(0);
      // each particle is (h/2)^2 of liquid; a fine pixel is (h/3)^2; so a packed liquid reads (2/3)^2*... normalised below
      // each particle's area onto the four nearest fine pixels, then smoothed
      // twice over about a particle's spacing (a box blur twice is close to a
      // Gaussian), so the liquid reads as one body, not as grains
      const per = PA / (fr * fr);
      let anyCream = false;
      for (let k = 0; k < n; k++) {
        const x = clamp(X[k] / fr - 0.5, 0, fx - 1.001), y = clamp(Y[k] / fr - 0.5, 0, fy - 1.001);
        const i = Math.floor(x), j = Math.floor(y), a = x - i, b = y - j, f = j * fx + i, c = C[k] * per;
        const w00 = (1 - a) * (1 - b) * per, w10 = a * (1 - b) * per, w01 = (1 - a) * b * per, w11 = a * b * per;
        dens[f] += w00; dens[f + 1] += w10; dens[f + fx] += w01; dens[f + fx + 1] += w11;
        if (c) { anyCream = true; crm[f] += w00 * C[k]; crm[f + 1] += w10 * C[k]; crm[f + fx] += w01 * C[k]; crm[f + fx + 1] += w11 * C[k]; }
      }
      blur(dens); blur(dens);
      if (anyCream) { blur(crm); blur(crm); }
      // Air the liquid has swallowed - where the stream plunges, under a
      // splash - is not a hole through the coffee to the page: it is froth,
      // bubbles churned into it. So the open air is flooded from the top edge
      // and the sides, and whatever air that flood cannot reach is marked as
      // held in the liquid (foam = 1); it is drawn as pale bubbly coffee.
      foam.fill(0); stack.length = 0;
      for (let i = 0; i < fx; i++) if (dens[i] < 0.5) { foam[i] = 2; stack.push(i); }
      for (let j = 0; j < fy; j++) for (const i of [0, fx - 1]) { const f = j * fx + i; if (dens[f] < 0.5 && !foam[f]) { foam[f] = 2; stack.push(f); } }
      while (stack.length) {
        const f = stack.pop(), i = f % fx;
        if (i > 0 && !foam[f - 1] && dens[f - 1] < 0.5) { foam[f - 1] = 2; stack.push(f - 1); }
        if (i < fx - 1 && !foam[f + 1] && dens[f + 1] < 0.5) { foam[f + 1] = 2; stack.push(f + 1); }
        if (f >= fx && !foam[f - fx] && dens[f - fx] < 0.5) { foam[f - fx] = 2; stack.push(f - fx); }
        if (f + fx < NF && !foam[f + fx] && dens[f + fx] < 0.5) { foam[f + fx] = 2; stack.push(f + fx); }
      }
      for (let f = 0; f < NF; f++) foam[f] = foam[f] === 2 ? 0 : dens[f] < 0.5 ? 1 : 0;
      // froth has no hard edge: it is a haze of bubbles thinning into the coffee
      let anyFoam = false;
      for (let f = 0; f < NF; f++) { froth[f] = foam[f]; if (foam[f]) anyFoam = true; }
      if (anyFoam) { blur(froth); blur(froth); }
      // how far each liquid pixel is from air (chamfer distance), for how
      // much coffee the light goes through there; the walls and floor are not air
      const BIG = 1e6;
      for (let f = 0; f < NF; f++) dist[f] = dens[f] > 0.45 || foam[f] ? BIG : 0;
      for (let j = 0; j < fy; j++) for (let i = 0; i < fx; i++) {
        const f = j * fx + i; if (!dist[f]) continue;
        let d = dist[f];
        if (j > 0) d = Math.min(d, dist[f - fx] + 1); else d = Math.min(d, 1);
        if (i > 0) d = Math.min(d, dist[f - 1] + 1);
        if (i < fx - 1 && j > 0) d = Math.min(d, dist[f - fx + 1] + 1.4);
        if (i > 0 && j > 0) d = Math.min(d, dist[f - fx - 1] + 1.4);
        dist[f] = d;
      }
      for (let j = fy - 1; j >= 0; j--) for (let i = fx - 1; i >= 0; i--) {
        const f = j * fx + i; if (!dist[f]) continue;
        let d = dist[f];
        if (j < fy - 1) d = Math.min(d, dist[f + fx] + 1);
        if (i < fx - 1) d = Math.min(d, dist[f + 1] + 1);
        if (i > 0 && j < fy - 1) d = Math.min(d, dist[f + fx - 1] + 1.4);
        if (i < fx - 1 && j < fy - 1) d = Math.min(d, dist[f + fx + 1] + 1.4);
        dist[f] = d;
      }
      // the colour's depth, smoothed too: straight off the chamfer it steps
      // from column to column and shows as faint stripes
      blur(dist);
      // where the body of liquid starts in each column (the first run of a few
      // pixels deep, so a flying drop is not taken for the surface)
      for (let i = 0; i < fx; i++) {
        let y = fy;
        for (let j = 0; j < fy - 3; j++) if (dens[j * fx + i] > 0.45 && dens[(j + 1) * fx + i] > 0.45 && dens[(j + 3) * fx + i] > 0.45) { y = j; break; }
        surf[i] = y * fr;
      }
    }
    const tmp = new Float32Array(NF), BR = Math.max(1, Math.round(R / 2));
    function blur(A) {
      // a box of (2*BR+1) pixels, along rows then columns; the walls reflect
      const m = 2 * BR + 1;
      for (let j = 0; j < fy; j++) {
        let acc = 0; const o = j * fx;
        for (let i = -BR; i <= BR; i++) acc += A[o + clamp(i, 0, fx - 1)];
        for (let i = 0; i < fx; i++) { tmp[o + i] = acc / m; acc += A[o + clamp(i + BR + 1, 0, fx - 1)] - A[o + clamp(i - BR, 0, fx - 1)]; }
      }
      for (let i = 0; i < fx; i++) {
        let acc = 0;
        for (let j = -BR; j <= BR; j++) acc += tmp[clamp(j, 0, fy - 1) * fx + i];
        for (let j = 0; j < fy; j++) { A[j * fx + i] = acc / m; acc += tmp[clamp(j + BR + 1, 0, fy - 1) * fx + i] - tmp[clamp(j - BR, 0, fy - 1) * fx + i]; }
      }
    }
    s.field = () => { field(); return { fx, fy, fr, dens, crm, dist, foam, froth }; };
    s.surfaceX = (x) => { field(); return surf[clamp(Math.floor(x / fr), 0, fx - 1)] * (H / Hs); };
    s.level = () => (n * PA) / (W * Hs);
    s.total = () => n * PA;
    s.particles = () => ({ n, X, Y, VX, VY, C });

    // ── the few bubbles, riding the surface where the stream goes in
    function stepBubbles(dt) {
      const b = s.bubbles;
      if (s.flowing && rand() < dt * 14 && b.length < 60) b.push({ x: x0 + (rand() - 0.5) * 30, r: 0.9 + rand() * 1.8, age: 0, life: 4 + rand() * 8 });
      for (let q = b.length - 1; q >= 0; q--) {
        const o = b[q], y = s.surfaceX(o.x) * (Hs / H) + 2;
        o.x = clamp(o.x + uAt(u, o.x, Math.min(y, Hs - 1)) * dt, o.r, W - o.r);
        o.age += dt;
        if (o.age > o.life || y >= Hs) b.splice(q, 1);
      }
    }
    // Steam. Brewed at about 85 C, it cools toward the room (Newton:
    // T = 20 + 65 e^(-t/900)), and gives off less visible steam, none below 45 C.
    s.temp = () => 20 + 65 * Math.exp(-s.t / 900);
    s.steaming = () => n > 0 && s.fullAt >= 0 && clamp((s.temp() - 45) / 30, 0, 1) > 0.02;
    function stepSteam(dt) {
      const st = s.steam, strength = s.fullAt >= 0 && n ? clamp((s.temp() - 45) / 30, 0, 1) : 0;
      if (strength > 0 && st.length < 70 && rand() < dt * 14 * strength * (W / 800)) {
        const x = rand() * W;
        st.push({ x, y: s.surfaceX(x) - 2, vy: -(0.04 + rand() * 0.05) * PXM, ph: rand() * 6.28, age: 0, life: 1.6 + rand() * 1.8, a: strength });
      }
      for (let q = st.length - 1; q >= 0; q--) {
        const w = st[q];
        w.age += dt; w.y += w.vy * dt; w.x += Math.sin(w.ph + w.age * 1.7) * 12 * dt;
        if (w.age > w.life) st.splice(q, 1);
      }
    }

    // nothing to draw but steam: the page stops drawing until a tilt, a shake or the drain
    s.idle = () => s.asleep && !s.draining && !s.flowing && !s.drips.length && !s.drops.length && !s.bubbles.length && !(creamS.start >= 0 && !creamS.done) && !(s.fullAt >= 0 && cr0() && creamS.start < 0);
    const cr0 = () => s.cream.on;
    s.creamed = () => s.cream.on && s.cream.start >= 0;
    return s;
  }

  /* ─── drawing ──────────────────────────────────────────────────────── */

  // Coffee is not cola: it lets red through and eats blue (Beer-Lambert:
  // each colour falls as e^(-mu*path)), so a thin sheet is amber-brown and a
  // centimetre all but black. The path is about twice the way to the nearest
  // air. Creamer scatters light back, so where it is the liquid goes pale and
  // milky: a ramp from coffee through caramel to cream. Both chosen to look
  // right, not measured.
  const MU = [0.35, 0.5, 0.65];
  const LIGHT = [255, 236, 214];
  const through = (mm, a = 1) => `rgba(${MU.map((m, c) => Math.round(LIGHT[c] * Math.exp(-m * mm))).join(",")},${a})`;
  const COFFEE = new Uint8ClampedArray(64 * 3);
  for (let q = 0; q < 64; q++) for (let c = 0; c < 3; c++) COFFEE[q * 3 + c] = LIGHT[c] * Math.exp(-MU[c] * (q / 4));   // path q/4 mm
  const RAMP = [[0, 92, 56, 32], [0.02, 112, 74, 46], [0.06, 140, 98, 64], [0.15, 172, 134, 98], [0.35, 206, 178, 144], [1, 236, 224, 206]];
  const CREAMLUT = new Uint8ClampedArray(256 * 3);
  for (let q = 0; q < 256; q++) {
    const c = (q / 255) ** 2;
    let k = 0; while (k < RAMP.length - 2 && c > RAMP[k + 1][0]) k++;
    const A = RAMP[k], B = RAMP[k + 1], t = clamp((c - A[0]) / (B[0] - A[0]), 0, 1);
    for (let ch = 0; ch < 3; ch++) CREAMLUT[q * 3 + ch] = A[ch + 1] + (B[ch + 1] - A[ch + 1]) * t;
  }

  function draw(ctx, s, sy) {
    const { W, H } = s;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.scale(1, sy);
    const F = s.field();
    if (!s.img || s.img.width !== F.fx) {
      s.cv = root.document.createElement("canvas"); s.cv.width = F.fx; s.cv.height = F.fy;
      s.cx = s.cv.getContext("2d"); s.img = s.cx.createImageData(F.fx, F.fy);
    }
    const d = s.img.data, { dens, crm, dist, froth, fx, fy, fr } = F, mmPx = fr * s.MM;
    for (let j = 0; j < fy; j++) for (let i = 0; i < fx; i++) {
      const f = j * fx + i, o = f * 4, rho = dens[f];
      // colour runs a little past the edge; the outline below cuts it
      if (rho < 0.12 && froth[f] < 0.05) { d[o + 3] = 0; continue; }
      // Seen from the side, the light crosses the cup's whole depth, front to
      // back, so the body is all but black; only near an edge - a thin sheet,
      // a drop, the lip of a splash - is there little enough coffee for
      // amber to come through. And a body of coffee is never quite black:
      // what scatters back out of it leaves a deep red-brown.
      // what scatters back out of it is brightest near the lit surface and
      // fades with depth, over a few centimetres
      const path = clamp(1.4 + 3.5 * dist[f] * mmPx, 0, 15), deep = Math.exp(-(dist[f] * mmPx) / 30);
      const q = Math.round(path * 4) * 3;
      let r = Math.max(COFFEE[q], 20 + 26 * deep), g = Math.max(COFFEE[q + 1], 11 + 16 * deep), b = Math.max(COFFEE[q + 2], 6 + 10 * deep);
      const c = rho > 0 ? crm[f] / rho : 0;
      if (c > 0.002) {
        const m = Math.round(Math.sqrt(Math.min(1, c)) * 255) * 3, w = clamp(c * 12, 0, 1);
        r += (CREAMLUT[m] - r) * w; g += (CREAMLUT[m + 1] - g) * w; b += (CREAMLUT[m + 2] - b) * w;
      }
      // churned-in air: a haze of pale, bubbly coffee
      const fo = Math.min(1, froth[f] * 1.4);
      if (fo > 0.01) { r += (128 - r) * fo; g += (92 - g) * fo; b += (64 - b) * fo; }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    // the streams in the air, exactly where their fall puts them: coffee a
    // glossy round jet (Beer-Lambert across its chord: amber edges, dark
    // middle), creamer opaque and milky. Drawn first, so where a stream
    // plunges in, the coffee is over it.
    const ys = H / s.Hs;
    for (const S of s.streams) drawStream(ctx, s, S, ys);
    s.cx.putImageData(s.img, 0, 0);
    // The edge is not the grid's: it is traced as an outline where the
    // smoothed density crosses one half (marching squares, each crossing
    // placed between samples by interpolation), and the browser draws that
    // outline at the screen's own resolution, anti-aliased. Inside it, the
    // colour is the smooth low-resolution image, which has no edges to show.
    const { body, gloss } = outline(F, ys);
    ctx.save();
    ctx.clip(body);
    ctx.globalAlpha = 0.95;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(s.cv, 0, 0, fx, fy, 0, 0, fx * fr, fy * fr * ys);
    ctx.restore();
    // the glossy line where the surface faces up and catches the light
    ctx.lineJoin = ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,246,232,0.4)"; ctx.lineWidth = 0.9; ctx.stroke(gloss);
    ctx.strokeStyle = "rgba(255,246,232,0.08)"; ctx.lineWidth = 5; ctx.stroke(gloss);

    // drops flying free - splashes, spray - too few particles together for
    // the field to show: each drawn as the drop of liquid it is
    const P = s.particles(), pr = Math.sqrt(s.PA / Math.PI);
    for (let k = 0; k < P.n; k++) {
      const i = Math.floor(P.X[k] / fr), j = Math.floor(P.Y[k] / fr);
      if (i < 0 || j < 0 || i >= fx || j >= fy || dens[j * fx + i] > 0.15) continue;   // only drops truly on their own
      ctx.beginPath(); ctx.arc(P.X[k], P.Y[k] * ys, pr, 0, Math.PI * 2);
      ctx.fillStyle = P.C[k] > 0.5 ? "rgba(236,226,210,0.95)" : through(2 * pr * s.MM * 1.5, 0.92); ctx.fill();
    }
    // the drips from the nozzle
    for (const d of s.drops) {
      ctx.beginPath(); ctx.ellipse(d.x, d.y * ys, d.r, d.r * 1.25, 0, 0, Math.PI * 2);
      ctx.fillStyle = through(2 * d.r * s.MM, 0.92); ctx.fill();
      ctx.beginPath(); ctx.arc(d.x - d.r * 0.3, d.y * ys - d.r * 0.3, d.r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,248,238,0.6)"; ctx.fill();
    }

    // the few bubbles on the surface
    for (const b of s.bubbles) {
      const y = s.surfaceX(b.x) + b.r * 0.2, a = Math.min(1, b.age * 6, (b.life - b.age) * 2);
      ctx.globalAlpha = Math.max(0, a);
      ctx.beginPath(); ctx.arc(b.x, y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(120,92,70,0.35)"; ctx.fill();
      ctx.strokeStyle = "rgba(240,226,206,0.65)"; ctx.lineWidth = 0.7; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // steam, above the surface: tall soft wisps
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
    ctx.restore();
  }
  // Marching squares over the fine field: for every square of four samples,
  // the part inside the liquid as a polygon (corners inside, and the points
  // where its sides cross the threshold), all in one path so the browser fills
  // their union with no seams. Squares wholly inside are merged into runs.
  // The pieces of outline facing up are collected for the gloss.
  const TH = 0.5;
  function outline(F, ys) {
    const { fx, fy, fr } = F, body = new Path2D(), gloss = new Path2D();
    const dens = F.foam.some((v) => v) ? F.dens.map((v, f) => Math.max(v, F.froth[f] * 1.5)) : F.dens;
    const X = (i) => (i <= 0 ? 0 : i >= fx - 1 ? fx * fr : (i + 0.5) * fr);
    const Y = (j) => (j <= 0 ? 0 : j >= fy - 1 ? fy * fr * ys : (j + 0.5) * fr * ys);
    const pts = [];
    for (let j = 0; j < fy - 1; j++) {
      let run = -1;
      const y0 = Y(j), y1 = Y(j + 1);
      for (let i = 0; i < fx - 1; i++) {
        const a = dens[j * fx + i], b = dens[j * fx + i + 1], c = dens[(j + 1) * fx + i + 1], d = dens[(j + 1) * fx + i];
        const ia = a >= TH, ib = b >= TH, ic = c >= TH, id = d >= TH;
        if (ia && ib && ic && id) { if (run < 0) run = i; continue; }
        if (run >= 0) { body.rect(X(run), y0, X(i) - X(run), y1 - y0); run = -1; }
        if (!(ia || ib || ic || id)) continue;
        const x0 = X(i), x1 = X(i + 1);
        const t = (p, q) => (TH - p) / (q - p);
        pts.length = 0;
        // clockwise round the square: TL, top edge, TR, right edge, BR, bottom edge, BL, left edge
        if (ia) pts.push(x0, y0, 0);
        if (ia !== ib) pts.push(x0 + (x1 - x0) * t(a, b), y0, 1);
        if (ib) pts.push(x1, y0, 0);
        if (ib !== ic) pts.push(x1, y0 + (y1 - y0) * t(b, c), 1);
        if (ic) pts.push(x1, y1, 0);
        if (ic !== id) pts.push(x1 + (x0 - x1) * t(c, d), y1, 1);
        if (id) pts.push(x0, y1, 0);
        if (id !== ia) pts.push(x0, y1 + (y0 - y1) * t(d, a), 1);
        body.moveTo(pts[0], pts[1]);
        for (let q = 3; q < pts.length; q += 3) body.lineTo(pts[q], pts[q + 1]);
        body.closePath();
        // outline pieces: two crossing points in a row; facing up if the liquid is below
        const m = pts.length / 3;
        for (let q = 0; q < m; q++) {
          const r = (q + 1) % m;
          if (!pts[q * 3 + 2] || !pts[r * 3 + 2]) continue;
          const below = (ic ? 1 : 0) + (id ? 1 : 0), above = (ia ? 1 : 0) + (ib ? 1 : 0);
          if (below > above) { gloss.moveTo(pts[q * 3], pts[q * 3 + 1]); gloss.lineTo(pts[r * 3], pts[r * 3 + 1]); }
        }
      }
      if (run >= 0) body.rect(X(run), y0, X(fx - 1) - X(run), y1 - y0);
    }
    return { body, gloss };
  }

  function drawStream(ctx, s, S, ys) {
    if (S.start < 0 || S.head <= 0 || S.done) return;
    const yTop = Math.max(-4, S.tail), yEnd = Math.min(S.head, S.land + 2);
    if (yEnd <= yTop) return;
    const steps = Math.max(2, Math.ceil((yEnd - yTop) / 6)), C = [], t = s.t;
    for (let k = 0; k <= steps; k++) {
      const y = yTop + ((yEnd - yTop) * k) / steps;
      const v = Math.sqrt(S.v0 * S.v0 + 2 * (9.81 * s.PXM) * Math.max(0, y));
      const hw = (S.Q / v / 2) * (1 + 0.03 * Math.sin(0.09 * y - 22 * t));
      C.push([S.xNow + 0.6 * Math.sin(1.7 * t + y * 0.006), hw, y * ys]);
    }
    const U = [-1, -0.92, -0.75, -0.45, 0, 0.45, 0.75, 0.92, 1];
    for (let k = 0; k < C.length - 1; k++) {
      const [cx, hw, y] = C[k], [cx2, hw2, y2] = C[k + 1];
      const grad = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
      if (S.c) { grad.addColorStop(0, "rgba(214,198,176,0.96)"); grad.addColorStop(0.45, "rgba(250,246,238,0.98)"); grad.addColorStop(1, "rgba(226,212,192,0.96)"); }
      else { const D = 2 * hw * s.MM; for (const u of U) grad.addColorStop((u + 1) / 2, through(D * Math.sqrt(Math.max(0.04, 1 - u * u)), 0.95)); }
      ctx.beginPath();
      ctx.moveTo(cx - hw, y); ctx.lineTo(cx + hw, y); ctx.lineTo(cx2 + hw2, y2 + 0.6); ctx.lineTo(cx2 - hw2, y2 + 0.6);
      ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    }
    const last = C[C.length - 1];
    if (true) { ctx.beginPath(); ctx.arc(last[0], last[2], last[1], 0, Math.PI); ctx.fillStyle = S.c ? "rgba(244,238,226,0.98)" : through(2 * last[1] * s.MM * 0.7, 0.95); ctx.fill(); }
    ctx.beginPath(); C.forEach((c, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, c[0] - 0.45 * c[1], c[2]));
    ctx.strokeStyle = S.c ? "rgba(255,255,252,0.7)" : "rgba(255,248,238,0.5)"; ctx.lineWidth = 1; ctx.stroke();
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
    // to tip and shake - and five seconds anywhere else.
    const phone = !!root.matchMedia?.("(pointer: coarse)").matches && Math.min(root.screen?.width || 1e4, root.screen?.height || 1e4) < 600;
    const hold = phone ? PHONE_HOLD : DRAIN_AFTER;
    // How big a pixel really is, for real gravity. A browser will not say; a
    // computer is close to the CSS pixel's 0.2646 mm, and a phone's screen is
    // about 68 mm across its short side (an estimate - they run 64 to 72).
    const mm = phone ? 68 / Math.min(root.screen.width, root.screen.height) : 0.2646;

    let W = 0, H = 0, sim = null, raf = 0, wall = 0, wake = 0, felt = null;
    const fit = () => {
      const w = canvas.clientWidth || root.innerWidth, hgt = canvas.clientHeight || root.innerHeight;
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!sim || Math.abs(w - W) > 1) {
        // a new width is a new cup, already poured, at the level it had reached
        const level = sim ? sim.level() : null, creamed = sim ? sim.creamed() : false;
        W = w; H = hgt; sim = createSim(W, H, { hold, mm });
        if (felt) sim.setGravity(felt[0], felt[1]);
        if (level !== null && level > 0.01) sim.still(level, creamed);
      }
      paint();
    };
    const paint = () => draw(ctx, sim, canvas.clientHeight ? canvas.clientHeight / H : 1);
    const resume = () => { root.clearTimeout(wake); if (!raf && cup && !still) raf = root.requestAnimationFrame(frame); };
    const onResize = () => { fit(); resume(); };
    const turn = (x, y) => {
      // device axes to the screen's, by the screen's own rotation
      const a = ((root.screen?.orientation?.angle ?? root.orientation ?? 0) * Math.PI) / 180;
      return [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)];
    };
    // What the liquid feels, from the phone itself. accelerationIncludingGravity
    // is what the phone's accelerometer reads; the liquid feels the opposite -
    // gravity, and a push back against any shake - so in screen axes (y down)
    // that is (-ax, +ay), turned by the screen's rotation. A shake throws it
    // about; a tilt tips it. Lying flat, little of it is across the screen,
    // and the liquid lies as it lay.
    // Which way round the accelerometer reads differs: the standard (and
    // Android) read +9.81 up a phone held upright, an iPhone -9.81 - read the
    // standard way on an iPhone, gravity pointed up the screen and the coffee
    // fell out of the top. The tilt sensor (deviceorientation) agrees on every
    // platform, so whenever both report, the motion's sign is checked against
    // it; until they have, an iPhone is taken to read the other way round.
    let motion = false, sign = /iP(hone|ad|od)/.test(root.navigator?.userAgent || "") ? -1 : 1, vote = 0, tiltG = null, low = null, lastT = 0;
    const onMotion = (e) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null || g.y == null) return;
      motion = true;
      const [rx, ry] = turn(-g.x, g.y);
      if (tiltG && Math.hypot(rx, ry) > 0.5 * 9.81) {
        vote = clamp(vote + (rx * tiltG[0] + ry * tiltG[1] >= 0 ? 1 : -1), -20, 20);
        if (vote >= 5) sign = 1; else if (vote <= -5) sign = -1;
      }
      // a phone's accelerometer jumps at every tap and jolt, far faster than
      // coffee can answer; it is smoothed over about 60 ms (chosen)
      const now = e.timeStamp || root.performance?.now() || 0, dt = lastT ? clamp((now - lastT) / 1000, 0.001, 0.1) : 0.016;
      lastT = now;
      const k = 1 - Math.exp(-dt / 0.06), vx = rx * sign, vy = ry * sign;
      low = low ? [low[0] + (vx - low[0]) * k, low[1] + (vy - low[1]) * k] : [vx, vy];
      if (Math.hypot(low[0], low[1]) < 0.35 * 9.81) return;
      felt = [low[0], low[1]]; sim.setGravity(felt[0], felt[1]); if (!sim.idle()) resume();
    };
    // the phone's angle: the check on the motion's sign, and the fallback
    // where a browser gives only that
    const onTilt = (e) => {
      if (e.beta == null || e.gamma == null) return;
      const b = (e.beta * Math.PI) / 180, gm = (e.gamma * Math.PI) / 180;
      const [sx, sy] = turn(Math.sin(gm) * Math.cos(b), Math.sin(b));
      if (Math.hypot(sx, sy) < 0.35) return;
      tiltG = [sx, sy];
      if (motion) return;
      const a = Math.atan2(sx, sy);
      felt = [9.81 * Math.sin(a), 9.81 * Math.cos(a)]; sim.setGravity(felt[0], felt[1]); resume();
    };
    const empty = () => {
      root.cancelAnimationFrame(raf); raf = 0; root.clearTimeout(wake);
      root.removeEventListener("resize", onResize);
      root.removeEventListener("devicemotion", onMotion);
      root.removeEventListener("deviceorientation", onTilt);
      canvas.remove(); cup = null;
    };
    const frame = (now) => {
      let dt = wall ? (now - wall) / 1000 : 1 / 60; wall = now;
      // back from a pause (asleep below, or the tab hidden): that time passed
      // on the drain's clock, but nothing moved in it
      if (dt > 0.25) { sim.skip(dt); dt = 1 / 60; }
      else if (dt > 1 / 30) { sim.skip(dt - 1 / 30); dt = 1 / 30; }
      sim.step(dt); paint();
      raf = 0;
      if (sim.done) empty();
      // Still: only the steam moves, at twelve frames a second rather than
      // sixty (a phone holds the cup forty minutes); once it has cooled, nothing
      // is drawn until the phone moves or the drain is due.
      else if (sim.idle()) wake = root.setTimeout(resume, sim.steaming() ? 80 : Math.max(0, (sim.fullAt + sim.hold - sim.t) * 1000) + 30);
      else raf = root.requestAnimationFrame(frame);
    };
    root.addEventListener("resize", onResize);
    root.addEventListener("devicemotion", onMotion);
    root.addEventListener("deviceorientation", onTilt);

    cup = { canvas };
    fit();
    // reduced motion: the full cup, creamed, no pour and no drain to watch - just gone when the drain would come
    if (still) { sim.still(FILL, true); paint(); root.setTimeout(empty, hold * 1000); return true; }
    raf = root.requestAnimationFrame(frame);
    return true;
  }

  root.RELAY_COFFEE = { pour, createSim, poured: () => !!cup };
})(typeof window !== "undefined" ? window : globalThis);
