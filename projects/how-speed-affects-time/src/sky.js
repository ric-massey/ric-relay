/* ══════════════════════════════════════════════════════════════════════
   sky.js — the view forward.

   A software renderer, on purpose. It accumulates every star into a
   floating-point buffer in real physical units and tone-maps once at the
   end, which is the whole requirement: the range from Sirius to the faintest
   catalogue star is about 6,000 to 1, and there is no way to hold that in
   eight bits. Compressing it is exactly what makes most star fields look
   like a screensaver.

   The pipeline, per star, per view:

     1. aberrate     tan(θ′/2) = √((1−β)/(1+β)) · tan(θ/2)
     2. project      tangent plane about the direction of travel
     3. Doppler      D = 1 / [γ (1 − β cos θ′)]     — from θ′, not θ
     4. apply        T′ = D·T, and the flux follows from the same D
     5. splat        a point spread function, not a pixel
     6. tone map     once, at the end, on the whole frame

   Nothing in here is culled before step 1. At 0.99 c most of what you can
   see started out *behind* you, and a renderer that throws away the back
   half of the sky first would delete the entire effect and make the sky look
   emptier the faster you went.

   Two things this renderer refuses to do, both of them deliberate:

     · No streaks. Aberration moves stars; it does not smear them. The blue
       tunnel is Hollywood and it is the opposite of what the physics says.
     · No twinkling. Scintillation is atmospheric. Out here the stars are
       absolutely still, and that stillness does more for the feeling of
       being in space than any effect on this list.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const P = window.HSAT_PHYSICS;
  const COL = window.HSAT_COLOUR;

  /* ── Camera ──────────────────────────────────────────────────────────
     Locked 49° vertical, horizontal follows the aspect ratio — that gives
     78° horizontal at 16:9 and stays sane on a phone held upright. It never
     changes. Everything the visitor watches compress is compressing for
     real, and a quiet zoom would make the whole exhibit a lie. */
  const FOV_VERTICAL = 49 * Math.PI / 180;
  const HALF_V = FOV_VERTICAL / 2;
  const TAN_HALF_V = Math.tan(HALF_V);

  /* Exposure. Chosen once so that a first-magnitude star saturates its core
     and the naked-eye limit lands a few steps above black, then left alone.
     It is a display decision, not a physics one — everything upstream of
     here is in lux, and nothing downstream of it changes with speed. */
  const EXPOSURE = 1.1e7;

  /* Share of a star's light that the eye scatters into a glare halo instead
     of the core. Real, and the reason bright stars have presence rather than
     size (Spencer et al. 1995 in spirit; a simple falloff in practice). */
  const GLARE_FRACTION = 0.16;
  const GLARE_A = 0.55;            // sets how tight the halo's core is
  /* How much halo the frame may contain, as a multiple of its own area.

     It was a flat 1.6 million pixels, which was a fraction of the frame only
     for the one canvas size it was tuned against. Everywhere else it was the
     wrong fraction — and it made the glare pass cost the same on a small
     frame as on a large one, which is the opposite of what a budget is for:
     the magnified inset paid the full price of the main view for a frame a
     fraction of its size. */
  const GLARE_FRAME_BUDGET = 1.39;   // 1.6e6 px on the 1.15e6 px frame it was tuned on

  /* Sub-pixel core. The naked-eye point spread function is about an arcminute
     across, which at this field of view is well under one pixel — so the core
     is drawn at the smallest size that will not alias as the sky moves.

     "Sub-pixel" has to mean it, though. This used to be a single kernel
     stamped at Math.round(x), Math.round(y), which put every star's centre on
     a whole pixel: raise the speed and the whole catalogue crept inward one
     pixel at a time, in unison, each star sitting still and then hopping.
     Nine thousand of those hopping at once is not a smooth sky, and it was
     worst exactly where it matters — near the top of the ladder, where the
     field is collapsing fastest.

     So the kernel is precomputed on a grid of sub-pixel phases instead, and
     the splat picks the one matching where the star actually fell between
     pixels. A sixteenth of a pixel is finer than the eye can follow at any
     speed the rail reaches, and it costs one table offset per star — the
     whole bank is 50 KB, built once. */
  const PSF_SIGMA = 0.82;
  const PSF_R = 3;
  const PSF_PHASES = 16;
  const PSF_SIZE = PSF_R * 2 + 1;
  const PSF_TAPS = PSF_SIZE * PSF_SIZE;

  const psf = (() => {
    const bank = new Float32Array(PSF_PHASES * PSF_PHASES * PSF_TAPS);
    for (let phy = 0; phy < PSF_PHASES; phy++) {
      for (let phx = 0; phx < PSF_PHASES; phx++) {
        // Where the true centre sits relative to the anchor pixel.
        const ox = phx / PSF_PHASES, oy = phy / PSF_PHASES;
        const base = (phy * PSF_PHASES + phx) * PSF_TAPS;
        let sum = 0;
        for (let j = -PSF_R; j <= PSF_R; j++) {
          for (let i = -PSF_R; i <= PSF_R; i++) {
            const dx = i - ox, dy = j - oy;
            const w = Math.exp(-(dx * dx + dy * dy) / (2 * PSF_SIGMA * PSF_SIGMA));
            bank[base + (j + PSF_R) * PSF_SIZE + (i + PSF_R)] = w;
            sum += w;
          }
        }
        // Flux-preserving, per phase — so a star does not change total
        // brightness as it drifts across a pixel boundary.
        for (let t = 0; t < PSF_TAPS; t++) bank[base + t] /= sum;
      }
    }
    return bank;
  })();

  /* Tone curve and sRGB encode, collapsed into one table.

     The curve is 1 − e^(−x), which rolls the highlights off smoothly and
     never clips a channel — so an overexposed star desaturates toward white
     the way a real one does in a real eye, instead of turning into a flat
     blue or orange disc.

     Indexed by √x rather than x, because the faint end is where all the
     resolution is needed: nine tenths of the sky is stars sitting a couple
     of steps above black, and a table linear in x would quantise every one
     of them into the same bin. */
  const TONE_N = 4096;
  const TONE_MAX = 16;                       // above this, 1 − e^(−x) is 1 to a byte
  const TONE_K = (TONE_N - 1) / Math.sqrt(TONE_MAX);
  const TONE = new Uint8Array(TONE_N);
  for (let i = 0; i < TONE_N; i++) {
    const x = Math.pow(i / TONE_K, 2);
    TONE[i] = Math.round(COL.encode(1 - Math.exp(-x)) * 255);
  }

  // Black with the alpha byte set, written as one 32-bit word. Probed rather
  // than assumed, so the fast clear is still correct on a big-endian machine.
  const OPAQUE_BLACK = (() => {
    const probe = new Uint8Array(4);
    probe[3] = 255;
    return new Uint32Array(probe.buffer)[0];
  })();

  function Sky(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.W = 0; this.H = 0;
    this.buf = null;
    this.image = null;
    this.stars = null;
    this.count = 0;
    this.exposureScale = 1;      // fixed display calibration; never speed-dependent
    this.zoom = 1;               // 1 everywhere except the declared inset
    this.extras = [];            // the Sun on the way home, and nothing else
    this.showDiffuse = true;     // false when the photographic sphere supplies it
    this.description = "";
    this.lastStats = null;
  }

  /* Load the catalogue once: direction stays as it is, magnitude becomes a
     flux in lux, colour index becomes a temperature in kelvin. After this
     there is no magnitude and no colour index anywhere in the renderer. */
  Sky.prototype.loadCatalogue = function (flat, stride) {
    const n = flat.length / stride;
    const dir = new Float32Array(n * 3);
    const flux = new Float32Array(n);
    const temp = new Float32Array(n);
    const visRest = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const o = i * stride;
      dir[i * 3] = flat[o];
      dir[i * 3 + 1] = flat[o + 1];
      dir[i * 3 + 2] = flat[o + 2];
      const T = COL.temperatureFromBV(flat[o + 4]);
      temp[i] = T;
      // The catalogue's V is light that made it through the visible window.
      // Dividing by that window's share recovers the star's total output,
      // which is the quantity the Doppler factor actually acts on.
      const vis = Math.max(1e-6, COL.visAt(T));
      flux[i] = COL.fluxFromMagnitude(flat[o + 3]);
      visRest[i] = vis;
    }
    this.stars = { dir, flux, temp, visRest };
    this.count = n;
    return n;
  };

  Sky.prototype.resize = function (cssW, cssH) {
    this._cssW = cssW; this._cssH = cssH;
    const maxPixels = 1.15e6;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(2, Math.round(cssW * dpr));
    let h = Math.max(2, Math.round(cssH * dpr));
    if (w * h > maxPixels) {
      const k = Math.sqrt(maxPixels / (w * h));
      w = Math.max(2, Math.round(w * k));
      h = Math.max(2, Math.round(h * k));
    }
    if (w === this.W && h === this.H) return false;
    this.W = w; this.H = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.buf = new Float32Array(w * h * 3);
    this.image = this.ctx.createImageData(w, h);
    this._words = null;
    return true;
  };

  /* This renderer always draws at one resolution: the real one.

     It used to drop to 62% while the speed was changing and come back a fifth
     of a second after it settled, on the theory that the frames you sweep
     through are not the ones anybody studies. The theory was fine and the
     consequence was not. Cost is per pixel here — clear the accumulation
     buffer, splat every star, tone-map, hand over an ImageData — and that
     tone map is non-linear, so the same starlight packed into 38% of the
     pixels sits higher on the curve and comes out brighter. The sky visibly
     lit up while the rail moved and dimmed again once it stopped, which put
     a rendering artefact directly on top of the exhibit's one calibrated
     quantity. Nothing here is allowed to decide brightness except the physics.

     Measured, it was not even buying speed: the reallocation of a W·H·3
     Float32Array on every flip made the worst frame of a drag worse than
     simply rendering at full size the whole way through. */

  /* Build an orthonormal basis with +z along the direction of travel. This
     is what keeps the high-γ view from falling apart: at γ = 707 the entire
     visible sky is a tenth of a degree across, and unit vectors in single
     precision simply run out of digits at that scale. Working in the
     tangent plane about the velocity axis means the small numbers stay
     small instead of being differences between numbers near 1. */
  /* `hint` is the camera's own up vector, and when it is supplied it is used
     verbatim as the reference. The fallback below picks one from the
     direction alone by a hard switch, which is fine for a camera locked to an
     axis and rolls the whole frame on the spot for one that can turn — see
     lookFrame() in exhibit.js. */
  function basis(f, hint) {
    const up = hint || (Math.abs(f[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]);
    let rx = up[1] * f[2] - up[2] * f[1];
    let ry = up[2] * f[0] - up[0] * f[2];
    let rz = up[0] * f[1] - up[1] * f[0];
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    const ux = f[1] * rz - f[2] * ry;
    const uy = f[2] * rx - f[0] * rz;
    const uz = f[0] * ry - f[1] * rx;
    return { r: [rx, ry, rz], u: [ux, uy, uz] };
  }

  /**
   * Draw the sky.
   * @param {number} beta      speed as a fraction of c
   * @param {number[]} forward unit vector, direction of travel (J2000)
   * @param {number[]} [view]  unit vector the camera points down; defaults to
   *                           the direction of travel.
   *
   * The two are separate because they are separate things, and the exhibit
   * only says so once you look over your shoulder. Aberration and Doppler are
   * fixed to the *velocity* — they do not care where you have turned your
   * head — while the projection belongs to the camera. Pointing the whole
   * transform backwards instead would have drawn a blueshift behind you,
   * which is the exact lie the rear view exists to disprove.
   */
  Sky.prototype.render = function (beta, forward, view, up) {
    const W = this.W, H = this.H;
    if (!W || !this.stars) return;

    const buf = this.buf;
    buf.fill(0);

    view = view || forward;
    const g = P.gamma(beta);
    const k = P.aberrationK(beta);
    const { r, u } = basis(view, up);
    // The main view's field of view is locked and this.zoom is 1. The only
    // thing that ever sets it otherwise is the inset, which prints its own
    // magnification on itself.
    const tanHalfV = TAN_HALF_V / this.zoom;
    const scale = (H / 2) / tanHalfV;
    const cx = W / 2, cy = H / 2;

    // Anything past this in the tangent plane is off the corner of the frame.
    const tanLimit = Math.hypot(tanHalfV, (W / H) * tanHalfV) * 1.25;

    if (this.showDiffuse) {
      this._renderDiffuse(beta, forward, view, r, u, g, scale, cx, cy);
    }

    const { dir, flux, temp, visRest } = this.stars;
    const n = this.count;

    // Pass one collects; pass two draws the halos for the brightest, once we
    // know what "brightest" means at this speed. At 0.99 c a star that was
    // invisible at rest can be the brightest thing on screen.
    const px = this._px || (this._px = new Float32Array(n + 8));
    const py = this._py || (this._py = new Float32Array(n + 8));
    const lum = this._lum || (this._lum = new Float32Array(n + 8));
    const col = this._col || (this._col = new Float32Array((n + 8) * 3));
    let live = 0;
    const liveIdx = this._live || (this._live = new Int32Array(n + 8));

    let visible = 0, hottest = 0, brightest = 0;

    const emit = (dx, dy, dz, restFlux, restT, restVis) => {
      // θ is measured from the direction of travel, always, because that is
      // the only axis aberration knows about.
      const cosT = dx * forward[0] + dy * forward[1] + dz * forward[2];
      const px0 = dx - forward[0] * cosT;
      const py0 = dy - forward[1] * cosT;
      const pz0 = dz - forward[2] * cosT;
      const sinT = Math.hypot(px0, py0, pz0);

      // tan(θ/2) without ever forming θ. Stable at both poles.
      const denom = 1 + cosT;
      let tHalf;
      if (denom < 1e-12) return;            // dead astern, and it stays there
      tHalf = sinT / denom;

      const tp = k * tHalf;                 // tan(θ′/2) — the aberration
      const tp2 = tp * tp;
      const cosTp = (1 - tp2) / (1 + tp2);
      const sinTp = 2 * tp / (1 + tp2);

      /* Where the aberrated ray actually points, as a direction rather than
         as an angle off the wake. Carrying the whole vector is what lets the
         camera face anywhere — the old code projected straight off θ′ and so
         could only ever draw the view from behind the pilot's own eyes. */
      const pn = sinT > 1e-12 ? sinTp / sinT : 0;
      const ax = forward[0] * cosTp + px0 * pn;
      const ay = forward[1] * cosTp + py0 * pn;
      const az = forward[2] * cosTp + pz0 * pn;

      const z = ax * view[0] + ay * view[1] + az * view[2];
      if (z <= 1e-6) return;                // behind the camera, whichever way it faces
      const a = (ax * r[0] + ay * r[1] + az * r[2]) / z;
      const b = (ax * u[0] + ay * u[1] + az * u[2]) / z;
      if (Math.hypot(a, b) > tanLimit) return;

      const D = 1 / (g * (1 - beta * cosTp));
      const Tp = D * restT;
      const visNow = COL.visAt(Tp);
      /* Flux from an unresolved source goes as D², not D⁴, and the difference
         is the star's own disc.

         D⁴ is the transform for *radiance* — brightness per unit solid angle
         — and it is what the Milky Way below gets, correctly. A star is not
         resolved, so what arrives is radiance times the solid angle the disc
         subtends, and aberration shrinks that disc by exactly D². The two
         powers cancel and what is left is D².

         The same answer falls out of counting photons, which is the version
         worth keeping in your head: each one is blueshifted, so it carries D
         times the energy, and they arrive D times as often. Energy per second
         is therefore D × D, and there is nowhere for another two powers to
         come from.

         This file used to claim the opposite in as many words — that "nothing
         here knows the difference between the two" — and then multiply by D⁴.
         At 0.99 c that overstated every star ahead of you by a factor of 199
         and buried the wake by the same factor. */
      const seen = restFlux * D * D * (visNow / restVis);
      if (!(seen > 1e-13)) return;

      const sx = cx + a * scale;
      const sy = cy - b * scale;
      if (sx < -8 || sy < -8 || sx > W + 8 || sy > H + 8) return;

      const c = COL.chromaAt(Tp);
      const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      if (Y <= 0) return;
      const s = seen / Y;

      const i = live++;
      px[i] = sx; py[i] = sy; lum[i] = seen;
      col[i * 3] = c[0] * s; col[i * 3 + 1] = c[1] * s; col[i * 3 + 2] = c[2] * s;
      liveIdx[i] = i;
      visible++;
      if (Tp > hottest) hottest = Tp;
      if (seen > brightest) brightest = seen;
    };

    for (let i = 0; i < n; i++) {
      emit(dir[i * 3], dir[i * 3 + 1], dir[i * 3 + 2], flux[i], temp[i], visRest[i]);
    }
    for (const e of this.extras) {
      emit(e.dir[0], e.dir[1], e.dir[2], e.flux, e.T, Math.max(1e-6, COL.visAt(e.T)));
    }

    // ── cores ──
    for (let i = 0; i < live; i++) {
      // Anchor on the pixel the star falls in, and pick the kernel phase from
      // where inside that pixel it landed. Rounding here instead is what made
      // the sky move in whole-pixel hops.
      const cxi = Math.floor(px[i]), cyi = Math.floor(py[i]);
      let phx = ((px[i] - cxi) * PSF_PHASES) | 0;
      let phy = ((py[i] - cyi) * PSF_PHASES) | 0;
      if (phx > PSF_PHASES - 1) phx = PSF_PHASES - 1;
      if (phy > PSF_PHASES - 1) phy = PSF_PHASES - 1;
      const kbase = (phy * PSF_PHASES + phx) * PSF_TAPS;
      const r0 = col[i * 3], g0 = col[i * 3 + 1], b0 = col[i * 3 + 2];
      for (let jy = -PSF_R; jy <= PSF_R; jy++) {
        const y = cyi + jy;
        if (y < 0 || y >= H) continue;
        const row = y * W;
        const krow = kbase + (jy + PSF_R) * PSF_SIZE;
        for (let jx = -PSF_R; jx <= PSF_R; jx++) {
          const x = cxi + jx;
          if (x < 0 || x >= W) continue;
          const w = psf[krow + jx + PSF_R];
          const o = (row + x) * 3;
          buf[o] += r0 * w;
          buf[o + 1] += g0 * w;
          buf[o + 2] += b0 * w;
        }
      }
    }

    // ── glare, for the ones bright enough to have any ──
    // Sorting by what is bright *now* rather than by catalogue magnitude is
    // the whole point: beaming reshuffles the sky completely.
    if (live > 0) {
      const order = Array.prototype.slice.call(liveIdx, 0, live);
      order.sort((a, b) => lum[b] - lum[a]);
      let budget = GLARE_FRAME_BUDGET * W * H;
      const floor = brightest * 1e-4;
      /* Halo sizes are angular, not absolute.

         They were written in raw pixels, tuned against a full-width canvas —
         which meant that on the magnified inset, barely 160 px across, a
         46 px halo covered nearly a third of the frame. Stack a few hundred
         of those on the same spot at the top of the ladder and the inset
         became a solid white disc with nothing in it: the one panel whose
         entire job is to show what is inside the cone was showing paint.

         Scaling by frame height keeps a halo the same *angular* size in
         every panel, which is what it is physically. */
      const glareScale = Math.max(0.22, this.H / 800);
      const glareMax = 46 * glareScale;
      for (let q = 0; q < order.length && budget > 0; q++) {
        const i = order[q];
        const L = lum[i];
        if (L < floor) break;
        // Halo size grows with the logarithm of brightness — weight, not size.
        const R = Math.min(glareMax, (3 + 5.5 * Math.log10(L / floor)) * glareScale);
        if (R < 1.2) break;
        budget -= Math.PI * R * R;
        const energy = L * GLARE_FRACTION;
        // Normalise against the actual integral of the falloff, so the halo
        // takes its light from the core rather than inventing it:
        //   ∫₀ᴿ 1/(1+a d²) · 2πd dd = (π/a) ln(1 + aR²)
        const norm = energy * GLARE_A / (Math.PI * Math.log(1 + GLARE_A * R * R));
        const r0 = col[i * 3], g0 = col[i * 3 + 1], b0 = col[i * 3 + 2];
        const Lc = Math.max(1e-30, r0 + g0 + b0);
        const cr = r0 / Lc, cg = g0 / Lc, cb = b0 / Lc;
        const x0 = Math.max(0, Math.round(px[i] - R));
        const x1 = Math.min(W - 1, Math.round(px[i] + R));
        const y0 = Math.max(0, Math.round(py[i] - R));
        const y1 = Math.min(H - 1, Math.round(py[i] + R));
        const R2 = R * R;
        for (let y = y0; y <= y1; y++) {
          const dy = y - py[i];
          const row = y * W;
          for (let x = x0; x <= x1; x++) {
            const dx = x - px[i];
            const d2 = dx * dx + dy * dy;
            if (d2 > R2) continue;
            const w = norm / (1 + d2 * GLARE_A);
            const o = (row + x) * 3;
            buf[o] += cr * w;
            buf[o + 1] += cg * w;
            buf[o + 2] += cb * w;
          }
        }
      }
    }

    this._toneMap();
    this.lastStats = { visible, hottest, brightest, gamma: g, beta };
  };

  /* ── the diffuse sky ────────────────────────────────────────────────
     The Milky Way, sampled per pixel rather than splatted per star,
     because it is not made of stars you can pick out — it is the light of a
     hundred billion you cannot.

     Working backwards is what makes this correct. Each pixel is a direction
     in the traveler's frame; aberration is run *in reverse* to find where
     that light actually started, the Galaxy is sampled there, and then it is
     beamed.

     This is the one place D⁴ belongs. I_ν/ν³ is a Lorentz invariant, so the
     bolometric radiance of a resolved source goes as D⁴, and a pixel of the
     band is exactly that: a fixed patch of the visitor's sky, filled. The
     stars above are not — they are points, their discs shrink as D², and
     they take D² instead. Both come from the same invariant; they differ by
     whether there is a solid angle left to shrink.

     Which is also why the band does not simply outrun the stars at speed.
     Per pixel it climbs faster, but it is being crushed into fewer pixels at
     the same rate, and the *total* light from the band goes as D² like
     everything else. What you see is the same light in a smaller place.

     Sampled on a coarse grid and interpolated, because the band is smooth
     at a fraction of a degree and the sharp detail is carried by the noise
     at sample time rather than by the grid. */
  const DIFFUSE_STEP = 4;
  // A surface-brightness sample is already the value for a display pixel.
  // Scaling it by that pixel's solid angle made the Milky Way change with
  // resolution and nearly disappear in the magnified inset. This fixed
  // display calibration keeps the band quiet at rest without tying it to
  // canvas size or zoom.
  // Point stars put their flux into a sub-pixel PSF; the Milky Way spreads
  // its light across degrees of retina. A single raw lux-to-pixel conversion
  // therefore under-represented the diffuse band beside the stars. This is
  // the calibrated surface-brightness exposure: bright enough for the
  // Galactic bulge and dust lanes to read at first sight, still far below
  // the luminance of even a modest star core.
  const DIFFUSE_DISPLAY_SCALE = 1.6e-5;

  Sky.prototype._renderDiffuse = function (beta, f, view, r, u, gam, scale, cx, cy) {
    const GX = window.HSAT_GALAXY;
    // The Galaxy model is optional; the microwave background is not, so this
    // pass no longer bails out when the model is missing.
    const W = this.W, H = this.H, buf = this.buf;
    const k = P.aberrationK(beta);

    const gw = Math.ceil(W / DIFFUSE_STEP) + 1;
    const gh = Math.ceil(H / DIFFUSE_STEP) + 1;
    if (!this._grid || this._grid.length !== gw * gh * 3) {
      this._grid = new Float32Array(gw * gh * 3);
      this._gw = gw; this._gh = gh;
    }
    const grid = this._grid;
    const T_DIFFUSE = GX ? GX.T_DIFFUSE : 4500;
    const restVis = Math.max(1e-9, COL.visAt(T_DIFFUSE));
    for (let gj = 0; gj < gh; gj++) {
      const py = gj * DIFFUSE_STEP;
      const Y = -(py - cy) / scale;
      for (let gi = 0; gi < gw; gi++) {
        const px = gi * DIFFUSE_STEP;
        const X = (px - cx) / scale;
        /* The ray this pixel is looking along, in the traveler's frame. It is
           built from the camera's axis; θ′ is then read off the direction of
           travel, so the whole pass works the same whether the camera is
           facing down the wake or straight back up it. */
        const rr = Math.sqrt(X * X + Y * Y);
        const inv = 1 / Math.sqrt(1 + rr * rr);
        const ox = (view[0] + r[0] * X + u[0] * Y) * inv;
        const oy = (view[1] + r[1] * X + u[1] * Y) * inv;
        const oz = (view[2] + r[2] * X + u[2] * Y) * inv;

        const cosTp = ox * f[0] + oy * f[1] + oz * f[2];
        // Aberration, backwards: where this light started before you moved.
        // Kept as tan², because dead astern — the centre of the rear view —
        // is a pole of the half-angle tangent and would otherwise arrive as
        // a NaN in the one pixel the visitor is looking straight at.
        const t2 = (1 - cosTp) / (Math.max(1e-9, 1 + cosTp) * k * k);
        const cosT = (1 - t2) / (1 + t2);
        const sinT = 2 * Math.sqrt(t2) / (1 + t2);
        let px0 = ox - f[0] * cosTp, py0 = oy - f[1] * cosTp, pz0 = oz - f[2] * cosTp;
        const pl = Math.hypot(px0, py0, pz0);
        if (pl > 1e-9) { px0 /= pl; py0 /= pl; pz0 /= pl; }
        const dx = f[0] * cosT + px0 * sinT;
        const dy = f[1] * cosT + py0 * sinT;
        const dz = f[2] * cosT + pz0 * sinT;

        const o = (gj * gw + gi) * 3;
        const D = 1 / (gam * (1 - beta * cosTp));
        let outR = 0, outG = 0, outB = 0;

        // ── the Galaxy ──
        const B = GX ? GX.sampleEquatorial(dx, dy, dz) : 0;   // lux/sr, at rest
        if (B > 0) {
          const Tp = D * T_DIFFUSE;
          const seen = B * D * D * D * D * (COL.visAt(Tp) / restVis)
                     * DIFFUSE_DISPLAY_SCALE;
          if (seen > 0) {
            const c = COL.chromaAt(Tp);
            const Y709 = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
            const s = Y709 > 0 ? seen / Y709 : 0;

            // At the luminance of the naked-eye Milky Way, rod vision dominates:
            // the band is silver-white, not the orange-brown produced by showing
            // a 4,500 K spectrum at full monitor saturation. As relativistic
            // beaming makes the light genuinely bright, cone vision takes over
            // and the physical Doppler colour becomes visible. Blending around
            // Y preserves luminance; only perceptual saturation changes.
            const displayLuminance = seen * EXPOSURE * this.exposureScale;
            const saturation = Math.min(1,
              0.08 + 0.92 * (1 - Math.exp(-displayLuminance * 1.4)));
            outR = (Y709 + (c[0] - Y709) * saturation) * s;
            outG = (Y709 + (c[1] - Y709) * saturation) * s;
            outB = (Y709 + (c[2] - Y709) * saturation) * s;
          }
        }

        /* ── the microwave background ──
           Filling everything, at 2.7255 K, and for almost the whole rail
           contributing exactly zero — which is the correct answer, not a
           shortcut. Once D pushes it past about 700 K it appears as a dull
           red wash ahead and then climbs almost vertically.

           No rod-vision blending here. By the time this term is non-zero it
           is hundreds of times the surface brightness of the Milky Way, which
           is well inside cone vision, so its colour is simply its colour. */
        const cmb = COL.cmbLuxPerSr(D) * DIFFUSE_DISPLAY_SCALE;
        if (cmb > 0) {
          const cc = COL.chromaAt(D * COL.CMB);
          const Yc = 0.2126 * cc[0] + 0.7152 * cc[1] + 0.0722 * cc[2];
          if (Yc > 0) {
            const sc = cmb / Yc;
            outR += cc[0] * sc; outG += cc[1] * sc; outB += cc[2] * sc;
          }
        }

        grid[o] = outR; grid[o + 1] = outG; grid[o + 2] = outB;
      }
    }

    // Bilinear back up to full resolution, added into the same float buffer
    // the stars land in — so the tone map at the end sees one image, not two.
    const inv = 1 / DIFFUSE_STEP;
    for (let y = 0; y < H; y++) {
      const fy = y * inv, j0 = fy | 0, ty = fy - j0;
      const rowA = j0 * gw * 3, rowB = (j0 + 1) * gw * 3;
      for (let x = 0; x < W; x++) {
        const fx = x * inv, i0 = fx | 0, tx = fx - i0;
        const a = rowA + i0 * 3, b = rowB + i0 * 3;
        const o = (y * W + x) * 3;
        for (let ch = 0; ch < 3; ch++) {
          const top = grid[a + ch] + (grid[a + 3 + ch] - grid[a + ch]) * tx;
          const bot = grid[b + ch] + (grid[b + 3 + ch] - grid[b + ch]) * tx;
          buf[o + ch] += top + (bot - top) * ty;
        }
      }
    }
  };

  /* One operator, at the end, on the whole frame.

     Most of the sky is exactly black — genuinely, not nearly — so the frame
     is cleared to opaque black in one pass over 32-bit words and only the
     pixels that actually caught light get touched. */
  Sky.prototype._toneMap = function () {
    const buf = this.buf, d = this.image.data;
    const kx = EXPOSURE * this.exposureScale;
    const nPix = this.W * this.H;

    if (!this._words) this._words = new Uint32Array(this.image.data.buffer);
    this._words.fill(OPAQUE_BLACK);

    for (let p = 0; p < nPix; p++) {
      const o = p * 3;
      const r = buf[o], g = buf[o + 1], b = buf[o + 2];
      if (r === 0 && g === 0 && b === 0) continue;
      const q = p * 4;
      let x = r * kx;
      d[q] = x >= TONE_MAX ? 255 : TONE[(Math.sqrt(x) * TONE_K) | 0];
      x = g * kx;
      d[q + 1] = x >= TONE_MAX ? 255 : TONE[(Math.sqrt(x) * TONE_K) | 0];
      x = b * kx;
      d[q + 2] = x >= TONE_MAX ? 255 : TONE[(Math.sqrt(x) * TONE_K) | 0];
    }
    this.ctx.putImageData(this.image, 0, 0);
  };

  /* A sentence describing what is on screen, for anyone who cannot see it —
     and, it turns out, useful to everyone else too. */
  Sky.prototype.describe = function (beta, altKm) {
    /* The frame's own half-angle across, which is what decides how much of
       the sky has been pushed into it.

       Guarded, because this can be asked before the canvas has been laid
       out — and an unsized canvas is 0×0, which makes the aspect ratio 0/0
       rather than something merely wrong. That NaN went straight through
       `skyFractionInFrame` and out into the prose as "NaN% of everything
       there is to see" and "about NaN catalogue stars in frame". It is a
       narrow window, one frame on a cold load, but it is a window a real
       visitor on a slow connection can land in, and the one thing this
       sentence exists to do is be readable by someone who cannot see the
       screen. Falls back to the 16:9 the layout is built around. */
    const aspect = this.H > 0 && this.W > 0 ? this.W / this.H : 16 / 9;
    const halfH = Math.atan(aspect * TAN_HALF_V);

    /* Altitude first, because for the opening minute of a visit it is the
       only thing that is true. This used to answer "about 9,000 stars on
       absolute black, nothing is moving" while the visitor was standing on
       the forest floor with the whole atmosphere and a treeline in front of
       them — three claims, none of them right. */
    const up = typeof altKm === "number" ? altKm : Infinity;
    // ground.js owns the altitude the airglow finally gives out at, and it
    // loads after this file — so read it when asked, not at definition time.
    const spaceKm = (window.HSAT_Ground && window.HSAT_Ground.SPACE_KM) || 100;
    if (up < 0.2) {
      return "You are still on the ground, under the trees, with the whole depth of the " +
        "atmosphere between you and the stars. Climb out of it and the sky goes black.";
    }
    if (up < spaceKm) {
      return Math.round(up).toLocaleString() + " km up and still inside the air, which is " +
        "thinning and taking its glow with it. Above about " + spaceKm + " km the sky is " +
        "properly black and nothing is left in front of the stars.";
    }

    if (beta <= 0) {
      // Never a hardcoded count: at rest the frame holds about a ninth of the
      // sky, so the whole catalogue was the wrong number by roughly 9×.
      const inFrame = this.lastStats
        ? this.lastStats.visible
        : Math.round((this.count || 9096) * P.skyFractionInRect(0, halfH, HALF_V));
      return "At rest, out of the air: about " + inFrame.toLocaleString() +
        " catalogue stars in frame, nearly all of them white, on absolute black. " +
        "Nothing is moving.";
    }
    const cone = P.forwardHemisphereRadius(beta) * 360 / Math.PI;
    // The frame is a rectangle and this is the rectangle's own answer, worked
    // out for the shape this window actually is — so it stays true on a phone
    // held upright, where the frame is barely a third of the width it has on
    // a laptop and holds proportionally less sky.
    const frac = Math.round(P.skyFractionInRect(beta, halfH, HALF_V) * 100);
    const D = P.dopplerAhead(beta);
    const bits = [];
    bits.push("The whole forward half of the sky has crowded into a cone about " +
      (cone < 1 ? cone.toFixed(2) : cone.toFixed(0)) + "° across");
    bits.push("and " + frac + "% of everything there is to see is now inside this frame");
    if (D > 1.4) bits.push("the light in it shifted blue and each star ahead about " +
      Math.round(D * D).toLocaleString() + " times brighter");
    else if (D > 1.02) bits.push("the light in it slightly blued and brightened");
    bits.push("the sky outside the cone is dark and reddening, and behind you there is nothing left to see");
    return bits.join(", ") + ".";
  };

  /* The one number that lets the photographic sky agree with this one about
     how bright a surface is. Both skies have to place the microwave
     background at the same luminance or the glow would jump when the WebGL
     path falls back to the modelled one — so the conversion from lux per
     steradian to display-linear is published here rather than copied there. */
  Sky.DIFFUSE_TO_DISPLAY = DIFFUSE_DISPLAY_SCALE * EXPOSURE;

  window.HSAT_Sky = Sky;
})();
