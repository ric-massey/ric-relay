/* ══════════════════════════════════════════════════════════════════════
   render.js — the draw pipeline.

   Three things the plan called out, fixed here before anything else:

   1. DEVICE PIXEL RATIO. The original set canvas.width = innerWidth while
      the CSS stretched it to 100vw, so on a retina screen every star was a
      half-resolution 2×2 smudge. For a game whose whole visual identity is
      pinpoint stars, that was the highest quality-per-line fix available.
      W and H stay in CSS pixels afterwards, so no projection maths moved.

   2. THE BACKDROP. It used to rebuild one linear and three radial gradients
      every frame and fill the viewport four times before anything else was
      painted, despite depending only on W and H. It is now rendered once on
      resize and blitted.

   3. DEPTH ORDER. Hazards were drawn in array order while z varied freely
      inside a system, so a distant moon could paint over a near planet.
      Everything is sorted far-to-near now.

   Draw order: backdrop → CMB → sky stars → galaxies → bodies → dust → HUD.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const K = SF.K;
  const v3 = SF.v3;

  let canvas, ctx, backdrop, backdropCtx;
  let W = 1, H = 1, dpr = 1;
  const TAU = Math.PI * 2;

  // Reference brightness for the CMB: the Sun's surface temperature, which is
  // the threshold the plan cares about (γ = 1,059, τ = 7.4 ship-years).
  const CMB_REFERENCE = Math.pow(K.tSun, 4) * SF.color.visible(K.tSun);

  const Render = SF.render = {
    get ctx() { return ctx; },
    get W() { return W; },
    get H() { return H; },

    init(target) {
      canvas = target;
      ctx = canvas.getContext("2d", { alpha: false });
      backdrop = document.createElement("canvas");
      backdropCtx = backdrop.getContext("2d");
      Render.resize();
    },

    resize() {
      // Cap at 2: beyond that the fill rate costs more than it shows.
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      SF.camera.setViewport(W, H);
      Render.buildBackdrop();
    },

    /** Rendered once per resize, then blitted. */
    buildBackdrop() {
      backdrop.width = Math.round(W * dpr);
      backdrop.height = Math.round(H * dpr);
      const b = backdropCtx;
      b.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sky = b.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0a1230");
      sky.addColorStop(0.42, "#060b1e");
      sky.addColorStop(1, "#02040c");
      b.fillStyle = sky;
      b.fillRect(0, 0, W, H);

      // Faint galactic cirrus. Static, because it is the far background.
      const clouds = [
        [W * 0.17, H * 0.02, Math.max(W, H) * 0.58, "rgba(46,62,150,.16)"],
        [W * 0.93, H * 0.28, Math.max(W, H) * 0.48, "rgba(98,36,116,.10)"],
        [W * 0.48, H * 0.92, Math.max(W, H) * 0.56, "rgba(16,94,113,.09)"],
      ];
      for (const [x, y, radius, color] of clouds) {
        const glow = b.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, color);
        glow.addColorStop(1, "transparent");
        b.fillStyle = glow;
        b.fillRect(0, 0, W, H);
      }
    },

    beginFrame() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(backdrop, 0, 0, W, H);
    },

    /* ── the cosmic microwave background ───────────────────────────────
       A 2.72548 K blackbody fills all of space. Boost into it and it stays
       a blackbody, just a hotter one: T' = D·T, and dead ahead D ≈ 2γ.
       γ = 100 gives 545 K and nothing to see; γ = 1,059 gives 5,772 K, as
       hot as the surface of the Sun; γ = 10,000 gives 54,500 K, hotter than
       an O star. The entire forward sky heats from black through dull red to
       blinding white as you burn, and that is the game's difficulty curve —
       organic, and chosen by the player every time they hold the throttle. */
    drawCMB(state) {
      const { beta, gamma } = state;
      if (!state.relativistic || gamma < 1.02) return 0;

      const velScreen = SF.camera.project(SF.view.forward, 0);
      const focal = SF.camera.focal;
      const cx = velScreen ? velScreen.x : SF.camera.cx;
      const cy = velScreen ? velScreen.y : SF.camera.cy;
      const ahead = !!velScreen;

      const maxRadius = Math.hypot(W, H) * (ahead ? 0.95 : 0.55);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);

      // The hot spot is about 1/γ radians wide, and it *narrows* as it
      // brightens: T'(θ') = T/(γ(1 − β cos θ')) falls to half its forward
      // value by θ' ≈ 1/γ. At γ = 1,059 that is under a pixel. Sampling the
      // gradient at even screen intervals would smear a searing point across
      // two hundred of them, so the stops are log-spaced in angle instead,
      // starting well inside the core. What you get is the truth: a sun
      // igniting dead ahead out of empty space, and darkness around it.
      const core = Math.max(1e-6, 1 / gamma);
      const outer = Math.atan(maxRadius / focal);
      const STOPS = 24;
      let peak = 0;
      let previousT = -1;

      for (let i = 0; i <= STOPS; i += 1) {
        const u = i / STOPS;
        const theta = i === 0 ? 0 : core * 0.12 * Math.pow(outer / (core * 0.12), u);
        const radius = focal * Math.tan(Math.min(1.5533, theta));
        const t = Math.max(0, Math.min(1, radius / maxRadius));
        const cosApparent = ahead ? Math.cos(theta) : Math.cos(Math.PI - theta);
        const T = SF.rel.cmbTemperature(cosApparent, beta, gamma);
        const power = Math.pow(T, 4) * SF.color.visible(T) / CMB_REFERENCE;
        const alpha = power <= 0 ? 0 : Math.min(0.97, Math.pow(power, 0.13));
        if (i === 0) peak = alpha;
        // Once it has gone dark it stays dark; fade toward the last colour
        // that had any light in it rather than toward the table's floor.
        const entry = SF.color.at(alpha > 0 ? T : Math.max(T, previousT > 0 ? previousT : T));
        if (alpha > 0) previousT = T;
        grad.addColorStop(t, `rgba(${entry.r},${entry.g},${entry.b},${alpha.toFixed(4)})`);
        if (t >= 1) break;
      }

      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Glare. Any real optic — a lens, a mirror, a wet eye — spreads a
      // point source that bright into a halo, and by γ = 1,059 this one is
      // as bright per unit area as the surface of the Sun. Scaled by the log
      // of the peak so it grows as the sky heats rather than switching on.
      if (peak > 0.08 && ahead) {
        const bloom = Math.min(Math.max(W, H) * 0.5, focal * 0.02 * (1 + Math.log10(1 + peak * 60) * 3));
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloom);
        const hot = SF.color.at(SF.rel.cmbTemperature(1, beta, gamma));
        halo.addColorStop(0, `rgba(${hot.r},${hot.g},${hot.b},${(peak * 0.85).toFixed(3)})`);
        halo.addColorStop(0.35, `rgba(${hot.r},${hot.g},${hot.b},${(peak * 0.20).toFixed(3)})`);
        halo.addColorStop(1, "transparent");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, bloom, 0, TAU);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      return peak;
    },

    /* ── the distant star field ────────────────────────────────────────
       Directions on a unit sphere, not 2D points slid around and wrapped at
       the screen edge. With a real camera basis they simply rotate past —
       no teleporting — and aberration can crush them forward the way it
       crushes the real sky. */
    makeSkyField(count, rng = Math.random) {
      const field = [];
      const LIMIT_MAG = 7;        // roughly the naked-eye limit
      const MAX_LY = 3000;
      for (let i = 0; i < count; i += 1) {
        const cosI = -1 + 2 * rng();
        const sinI = Math.sqrt(Math.max(0, 1 - cosI * cosI));
        const phi = rng() * TAU;
        const star = SF.stars.sample(rng);

        // Importance sampling, so the field ends up with the mix a real sky
        // has. Draw the star first — 76% of them are M dwarfs — then place it
        // uniformly in the volume out to the distance where it would fade
        // past naked-eye. A red dwarf is only visible within about eight
        // light-years, a B star from thousands, so the sky fills with the
        // rare bright ones even though the population is overwhelmingly red.
        // That is why the real night sky looks nothing like the real galaxy.
        const absMag = 4.83 - 2.5 * Math.log10(Math.max(1e-9, star.lum));
        const maxPc = Math.pow(10, (LIMIT_MAG - absMag + 5) / 5);
        const maxLy = Math.min(MAX_LY, Math.max(2, maxPc * K.pcLy));
        const distanceLy = maxLy * Math.cbrt(rng());

        field.push({
          dir: { x: sinI * Math.cos(phi), y: cosI, z: sinI * Math.sin(phi) },
          teff: star.teff,
          entry: SF.color.at(star.teff),
          mag: SF.stars.apparentMagnitude(star.lum, distanceLy),
          distanceLy,
          twinkle: rng() * TAU,
          jitter: 0.85 + rng() * 0.3,
        });
      }
      return field;
    },

    drawSkyField(field, state, now, lenses) {
      const { beta, gamma, density } = state;
      const relativistic = state.relativistic;
      const focal = SF.camera.focal;
      const marginX = W * 0.06, marginY = H * 0.06;

      for (const star of field) {
        const app = relativistic ? SF.view.apparent(star.dir)
          : { dir: star.dir, cos: v3.dot(star.dir, SF.view.forward), D: 1, mag: 1 };
        const p = SF.camera.project(app.dir, 0);
        if (!p) continue;
        if (p.x < -marginX || p.x > W + marginX || p.y < -marginY || p.y > H + marginY) continue;

        let x = p.x, y = p.y, lensGain = 1;
        if (lenses) {
          const bent = Render.applyLensing(x, y, lenses);
          if (!bent) continue;             // swallowed by the shadow
          x = bent.x; y = bent.y; lensGain = bent.gain;
        }

        // Doppler shifts the temperature; the same LUT then reports both the
        // new colour and how much of the light is still visible. This is the
        // whole starbow, and it is four lines, because the colour table
        // already did the work.
        const shift = relativistic ? SF.color.shifted(star.teff, app.D) : null;
        const entry = shift ? shift.entry : star.entry;
        const gain = (shift ? shift.gain : 1) * lensGain;
        if (gain <= 0) continue;

        // Everything is a magnitude from here: −2.5·log₁₀ of the flux change.
        const mag = star.mag - 2.5 * Math.log10(gain);
        // Thinning star fields raise the effective limit rather than dimming
        // every star equally, which is what leaving the disk actually does.
        const limit = 6.9 + 2.5 * Math.log10(Math.max(1e-4, density));
        const above = limit - mag;
        if (above <= 0) continue;
        const alpha = Math.min(1, above / 7.4 + 0.06);

        const twinkle = 0.86 + Math.sin(now * 0.0014 + star.twinkle) * 0.14;
        const size = Math.max(0.5, Math.min(3.4, 0.55 + above * 0.28)) * star.jitter;
        ctx.globalAlpha = Math.min(1, alpha * twinkle);
        ctx.fillStyle = entry.css;
        if (size < 1.1) {
          ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, size * 0.62, 0, TAU);
          ctx.fill();
          if (size > 2.1) {
            ctx.globalAlpha = Math.min(1, alpha * 0.45);
            ctx.strokeStyle = entry.css;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(x - size * 2.4, y); ctx.lineTo(x + size * 2.4, y);
            ctx.moveTo(x, y - size * 1.9); ctx.lineTo(x, y + size * 1.9);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      void focal;
    },

    /**
     * Push a screen point outward around every nearby black hole, solving the
     * point-mass lens equation. Returns null when the ray would fall inside
     * the shadow, where nothing comes back out.
     */
    applyLensing(x, y, lenses) {
      let px = x, py = y, gain = 1;
      for (const lens of lenses) {
        const dx = px - lens.x, dy = py - lens.y;
        const b = Math.hypot(dx, dy);
        if (b < 1e-3) return null;
        const solved = SF.blackhole.lens(b, lens.einstein);
        if (solved.primary < lens.shadow) return null;
        const k = solved.primary / b;
        px = lens.x + dx * k;
        py = lens.y + dy * k;
        // Lensing conserves surface brightness but magnifies solid angle, so
        // the image gets brighter as it is pushed out near the ring.
        const mu = Math.abs(1 / (1 - Math.pow(lens.einstein / Math.max(1e-3, solved.primary), 4)));
        gain *= Math.min(6, mu);
      }
      return { x: px, y: py, gain };
    },

    /* ── galaxies ──────────────────────────────────────────────────────  */
    drawGalaxy(galaxy, measure) {
      const { stage, grain, distanceLy } = measure;
      const inside = stage === "inside";
      const R = galaxy.radiusLy;

      // Stage three first, because once you are inside a galaxy its centre
      // can be behind you while its stars are all around — the sprite work
      // below would bail out and take them with it.
      if (grain > 0.02) Render.drawGalaxyStars(galaxy, grain);
      if (inside) { galaxy.screen = null; return; }

      const centre = SF.view.project(galaxy.pos, 0);
      if (!centre) return;
      const pu = SF.view.project(SF.galaxy.toWorld(galaxy, R, 0, 0), 0);
      const pw = SF.view.project(SF.galaxy.toWorld(galaxy, 0, R, 0), 0);
      if (!pu || !pw) return;

      const ax = pu.x - centre.x, ay = pu.y - centre.y;
      const bx = pw.x - centre.x, by = pw.y - centre.y;
      const extent = Math.max(Math.hypot(ax, ay), Math.hypot(bx, by));
      if (extent < 0.7) return;
      if (centre.x < -extent * 2 || centre.x > W + extent * 2
        || centre.y < -extent * 2 || centre.y > H + extent * 2) return;

      // Doppler applies to a galaxy exactly as it does to a star: the light
      // is starlight. Use a G-ish integrated colour and shift that. Emission
      // nebulae override it, because their colour is hydrogen-alpha at
      // 656 nm rather than a blackbody, and no temperature reproduces that.
      const shift = SF.color.shifted(5400, centre.D);
      const tint = galaxy.tint || shift.entry;
      const spriteAlpha = (1 - grain) * Math.min(1, Math.pow(shift.gain, 0.2));

      if (spriteAlpha > 0.01) {
        ctx.save();
        ctx.transform(ax, ay, bx, by, centre.x, centre.y);
        ctx.globalCompositeOperation = "lighter";

        // Sérsic profile as gradient stops. n = 4 gives the sharply-peaked
        // de Vaucouleurs core of an elliptical; n = 1 the softer disk.
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        const core = SF.galaxy.profileAt(galaxy, 0.001);
        // Galaxies are not one colour. The bulge is old, red-giant-dominated
        // starlight around 4,200 K; the disk and arms are where new stars are
        // still forming, so they run blue at 8,000 K and up. Both come out of
        // the same blackbody table as everything else.
        const bulge = galaxy.tint || SF.color.shifted(4200, centre.D).entry;
        const disk = galaxy.tint || SF.color.shifted(8000, centre.D).entry;
        // Stops stop at 0.9 so the explicit transparent stop at 1.0 has room
        // to fade into. Running them to the rim left the Sérsic profile still
        // faintly lit at the last stop, and the disk ended in a hard circle.
        for (let i = 0; i <= 10; i += 1) {
          const t = (i / 10) * 0.9;
          const rel = SF.galaxy.profileAt(galaxy, Math.max(0.001, t)) / core;
          const a = spriteAlpha * Math.min(1, Math.pow(rel, 0.55));
          const mix = Math.min(1, t * 3);
          const e = {
            r: Math.round(bulge.r + (disk.r - bulge.r) * mix),
            g: Math.round(bulge.g + (disk.g - bulge.g) * mix),
            b: Math.round(bulge.b + (disk.b - bulge.b) * mix),
          };
          glow.addColorStop(t, `rgba(${e.r},${e.g},${e.b},${a.toFixed(4)})`);
        }
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, TAU);
        ctx.fill();

        // Logarithmic arms: r = r₀·e^(θ tan φ). Density waves, not pinwheels.
        if ((galaxy.type === "spiral" || galaxy.type === "barred") && extent > 9) {
          ctx.lineCap = "round";
          for (let arm = 0; arm < galaxy.arms; arm += 1) {
            ctx.beginPath();
            for (let i = 0; i <= 120; i += 1) {
              const q = SF.galaxy.armPoint(galaxy, arm, i / 120);
              const x = q.x / R, y = q.y / R;
              if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = `rgba(${disk.r},${disk.g},${disk.b},${(spriteAlpha * 0.3).toFixed(3)})`;
            // In the unit-radius transform this is a fraction of the galaxy's
            // own radius, so 0.055 was an arm 5.5% of the galaxy wide.
            ctx.lineWidth = 0.016;
            ctx.stroke();
          }
          if (galaxy.type === "barred") {
            ctx.beginPath();
            ctx.moveTo(-0.26, 0); ctx.lineTo(0.26, 0);
            ctx.strokeStyle = `rgba(${bulge.r},${bulge.g},${bulge.b},${(spriteAlpha * 0.35).toFixed(3)})`;
            ctx.lineWidth = 0.055;
            ctx.stroke();
          }
        }
        ctx.restore();
        ctx.globalCompositeOperation = "source-over";
      }


      galaxy.screen = { x: centre.x, y: centre.y, r: extent, distanceLy };
    },

    /**
     * The sprite graining apart. Points are drawn from the real exponential
     * disk profile (galaxy.js), each with its own temperature from the IMF,
     * each Doppler-shifted and beamed like any other star — so a galaxy you
     * are flying into resolves into exactly the kind of star field you would
     * be flying through if you got there.
     */
    drawGalaxyStars(galaxy, grain) {
      const points = SF.galaxy.buildPoints(galaxy);
      ctx.globalCompositeOperation = "lighter";
      for (const point of points) {
        const world = SF.galaxy.toWorld(galaxy, point.x, point.y, point.z);
        const p = SF.view.project(world, 0);
        if (!p) continue;
        if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) continue;
        const s = SF.color.shifted(point.teff, p.D);
        const flux = SF.stars.fluxAt(point.lum, p.dist) * s.gain;
        const alpha = grain * Math.min(1, Math.pow(flux * 26, 0.34));
        if (alpha < 0.04) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.entry.css;
        ctx.fillRect(p.x - 0.5, p.y - 0.5, 1.2, 1.2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },

    /* ── bodies ────────────────────────────────────────────────────────  */
    glow(x, y, radius, inner, outer) {
      const r = Math.max(1, radius * 2.4);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, inner);
      gradient.addColorStop(0.38, outer);
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    },

    drawStar(body, p) {
      const shift = SF.color.shifted(body.teff, p.D);
      const flux = SF.stars.fluxAt(body.lum, p.dist) * shift.gain;
      const brightness = Math.min(1, Math.pow(flux * 4, 0.3));
      if (brightness < 0.02) return;
      const e = shift.entry;
      const r = Math.max(0.6, p.r);

      ctx.globalAlpha = brightness;
      Render.glow(p.x, p.y, r, "rgba(255,255,255,.95)", `rgba(${e.r},${e.g},${e.b},.62)`);
      ctx.fillStyle = e.css;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, r * 0.72), 0, TAU);
      ctx.fill();
      if (r > 2) {
        ctx.fillStyle = "rgba(255,255,255,.75)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.4, r * 0.34), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    /**
     * Planets and moons keep the original's correct instinct — reflected
     * directional light, a lit limb and a dark limb, no self-glow — but the
     * light now comes from the real direction of the real star, and the hue
     * comes from what the planet is made of rather than Math.random()*360.
     */
    drawPlanet(body, p, litScreen) {
      const r = Math.max(0.7, p.r);
      if (r < 0.55) return;
      const style = body.style;
      let lx = p.x, ly = p.y;
      if (litScreen) {
        const dx = litScreen.x - p.x, dy = litScreen.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        lx = p.x + (dx / len) * r * 0.5;
        ly = p.y + (dy / len) * r * 0.5;
      }

      if (body.ring && r > 2) {
        ctx.strokeStyle = `hsla(${style.hue + 30},${style.sat}%,${style.light + 12}%,.5)`;
        ctx.lineWidth = Math.max(0.8, r * 0.14);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * 1.7, r * 0.42, body.tilt || -0.24, 0, TAU);
        ctx.stroke();
      }

      const gradient = ctx.createRadialGradient(lx, ly, r * 0.05, p.x, p.y, r * 1.1);
      gradient.addColorStop(0, `hsl(${style.hue},${style.sat}%,${Math.min(88, style.light + 24)}%)`);
      gradient.addColorStop(0.48, `hsl(${style.hue},${Math.max(10, style.sat - 10)}%,${Math.max(14, style.light - 12)}%)`);
      gradient.addColorStop(1, `hsl(${style.hue},${Math.max(6, style.sat - 22)}%,4%)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
    },

    drawComet(body, p, litScreen) {
      const r = Math.max(0.7, p.r);
      // A comet's tail points away from its star — always, regardless of
      // which way it is travelling. That is solar wind, not motion.
      let tx = 1, ty = -0.4;
      if (litScreen) {
        const dx = p.x - litScreen.x, dy = p.y - litScreen.y;
        const len = Math.hypot(dx, dy) || 1;
        tx = dx / len; ty = dy / len;
      }
      const len = r * 9;
      const tail = ctx.createLinearGradient(p.x, p.y, p.x + tx * len, p.y + ty * len);
      tail.addColorStop(0, "rgba(196,234,255,.85)");
      tail.addColorStop(1, "transparent");
      ctx.strokeStyle = tail;
      ctx.lineWidth = Math.max(1.2, r * 0.6);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + tx * len, p.y + ty * len);
      ctx.stroke();
      Render.glow(p.x, p.y, r, "#fff", "rgba(120,198,255,.6)");
      ctx.fillStyle = "#eafaff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.6, r * 0.5), 0, TAU);
      ctx.fill();
    },

    /**
     * The black hole. Shadow at 2.598 r_s — the thing the EHT photographed —
     * with a disk that starts at the ISCO and is beamed by D⁴, so the side
     * whose matter is coming toward you blazes and the other side nearly
     * disappears.
     */
    drawBlackHole(hole, p) {
      const r = Math.max(1.2, p.r);
      const tilt = hole.tilt;
      // p.r is the shadow, 2.598 r_s. Everything else is measured off it.
      const inner = r * (3 / 2.598);        // the ISCO: no stable orbit inside
      const outer = r * 2.7;
      const squash = Math.max(0.06, Math.sin(tilt));

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(hole.tiltPhase);

      // A thin accretion disk runs T ∝ r^(−3/4), which is real, and the
      // colours come out of the same blackbody table as every star in the
      // game — Doppler shift included, because the matter is orbiting at half
      // the speed of light and T′ = D·T applies to it exactly as it applies
      // to the sky.
      //
      // The one liberty is the anchor. A real disk around a 21 M☉ hole runs
      // to millions of kelvin and radiates in X-rays, so honestly rendered it
      // would be invisible — which is why these things were found with X-ray
      // telescopes and not with eyes. 9,000 K at the ISCO puts it in the
      // visible, where you can watch the approaching side outshine the
      // receding one by the D⁴ that is the actual point.
      const T_ISCO = 9.0e3;
      const SEGMENTS = 72;
      const RINGS = 6;

      const point = (a, radius) => ({
        x: Math.cos(a) * radius,
        y: Math.sin(a) * radius * squash,
      });

      const drawArc = (nearHalf) => {
        ctx.globalCompositeOperation = "lighter";
        for (let ring = 0; ring < RINGS; ring += 1) {
          const r0 = inner + (outer - inner) * (ring / RINGS);
          const r1 = inner + (outer - inner) * ((ring + 1) / RINGS);
          const mid = (r0 + r1) / 2;
          const T = T_ISCO * Math.pow(inner / mid, 0.75);
          // Surface brightness goes as T⁴, so with T ∝ r^(−3/4) it falls as
          // r^(−3). Nearly all the light is in the innermost ring, which is
          // why a disk looks like a bright ring and not a plate.
          const falloff = Math.pow(inner / mid, 3);
          for (let i = 0; i < SEGMENTS; i += 1) {
            const a0 = (i / SEGMENTS) * TAU;
            const a1 = ((i + 1) / SEGMENTS) * TAU;
            // The near half is the one whose matter is between you and the
            // hole; it is drawn after the shadow so it passes in front.
            if ((Math.sin(a0 + TAU / (SEGMENTS * 2)) > 0) !== nearHalf) continue;

            const D = SF.blackhole.dopplerAt(a0 + hole.phase, hole.diskBeta, tilt);
            const shifted = SF.color.shifted(T, D);
            // Barely compressed on purpose: squashing this is what turns a
            // 50× brightness asymmetry into a uniform grey smudge.
            const alpha = Math.min(0.92, 0.75 * falloff * Math.pow(Math.max(0, shifted.gain), 0.6));
            if (alpha < 0.008) continue;

            const iA = point(a0, r0), oA = point(a0, r1);
            const iB = point(a1, r0), oB = point(a1, r1);
            ctx.beginPath();
            ctx.moveTo(iA.x, iA.y);
            ctx.lineTo(oA.x, oA.y);
            ctx.lineTo(oB.x, oB.y);
            ctx.lineTo(iB.x, iB.y);
            ctx.closePath();
            const e = shifted.entry;
            ctx.fillStyle = `rgba(${e.r},${e.g},${e.b},${alpha.toFixed(3)})`;
            ctx.fill();
          }
        }
        ctx.globalCompositeOperation = "source-over";
      };

      drawArc(false);   // the far half, which the shadow will cover

      // The shadow. Nothing comes out, so nothing is drawn — and because it
      // is opaque black it also hides the far half of the disk behind it.
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();

      // The photon ring at 1.5 r_s: light that orbited the hole and came
      // back out. It carries an image of the far side of the disk wrapped
      // over the top, which is the bright halo in every picture of one of
      // these — approximated here as a ring rather than ray-traced.
      ctx.globalCompositeOperation = "lighter";
      const halo = ctx.createRadialGradient(0, 0, r * 0.94, 0, 0, r * 1.22);
      halo.addColorStop(0, "transparent");
      halo.addColorStop(0.35, "rgba(255,228,182,.85)");
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.22, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      drawArc(true);    // the near half, passing in front

      ctx.restore();
    },

    /* ── the interstellar medium, as streaks ───────────────────────────  */
    drawDust(dust, state) {
      const streak = Math.min(0.4, state.beta * 0.34);
      const cx = SF.camera.cx, cy = SF.camera.cy;
      const velScreen = SF.camera.project(SF.view.forward, 0);
      const ox = velScreen ? velScreen.x : cx;
      const oy = velScreen ? velScreen.y : cy;
      for (const particle of dust) {
        const p = SF.view.project(particle.p, 0);
        if (!p) continue;
        if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) continue;
        const near = Math.max(0, 1 - p.dist / particle.spawnDist);
        ctx.strokeStyle = `rgba(178,214,255,${(0.10 + near * 0.4).toFixed(3)})`;
        ctx.lineWidth = Math.max(0.4, 1.2 * near);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.x - ox) * streak, p.y - (p.y - oy) * streak);
        ctx.stroke();
      }
    },

    /* ── overlays ──────────────────────────────────────────────────────  */
    drawLabel(text, sub, x, y, alpha, colour = "rgba(190,214,255,") {
      if (alpha < 0.03) return;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgba(150,180,255,.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 14, y - 12);
      ctx.lineTo(x + 26, y - 12);
      ctx.stroke();
      ctx.fillStyle = `${colour}.95)`;
      ctx.fillText(text.toUpperCase(), x + 30, y - 12);
      if (sub) {
        ctx.fillStyle = `${colour}.55)`;
        ctx.fillText(sub, x + 30, y - 1);
      }
      ctx.globalAlpha = 1;
    },

    /** Nose reticle, plus a prograde marker for where you are actually going. */
    drawReticle(state) {
      const cx = SF.camera.cx, cy = SF.camera.cy;
      ctx.strokeStyle = "rgba(143,174,255,.34)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, TAU);
      ctx.moveTo(cx - 18, cy); ctx.lineTo(cx - 7, cy);
      ctx.moveTo(cx + 7, cy); ctx.lineTo(cx + 18, cy);
      ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy - 7);
      ctx.moveTo(cx, cy + 7); ctx.lineTo(cx, cy + 18);
      ctx.stroke();

      // Prograde. At low speed it sits under the reticle; at high γ the
      // velocity vector stops following the nose and it drifts away, which
      // is the honest reason you cannot turn at relativistic speed.
      const vel = SF.camera.project(SF.view.forward, 0);
      if (vel && Math.hypot(vel.x - cx, vel.y - cy) > 14) {
        ctx.strokeStyle = "rgba(120,255,196,.62)";
        ctx.beginPath();
        ctx.arc(vel.x, vel.y, 7, 0, TAU);
        ctx.moveTo(vel.x - 12, vel.y); ctx.lineTo(vel.x - 7, vel.y);
        ctx.moveTo(vel.x + 7, vel.y); ctx.lineTo(vel.x + 12, vel.y);
        ctx.moveTo(vel.x, vel.y - 12); ctx.lineTo(vel.x, vel.y - 7);
        ctx.stroke();
      }

      // The starbow ring: where D = 1 and the sky keeps its true colour.
      if (state.relativistic && state.beta > 0.55) {
        const angle = SF.rel.starbowAngle(state.beta, state.gamma);
        if (angle && vel) {
          const radius = SF.camera.focal * Math.tan(Math.min(1.45, angle));
          if (radius < Math.hypot(W, H)) {
            ctx.strokeStyle = "rgba(255,255,255,.08)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(vel.x, vel.y, radius, 0, TAU);
            ctx.stroke();
          }
        }
      }
    },

    /**
     * The waypoint guide. Given a chosen destination's world position, draw a
     * marker on it if it is on screen, or an arrow pinned to the screen edge
     * pointing toward it if it is off screen or behind you — plus its name and
     * current distance. This is what turns "pick a place on the map" into
     * "steer until the diamond is under your nose."
     */
    drawWaypoint(name, pos) {
      const dist = Math.hypot(pos.x, pos.y, pos.z);
      if (dist < 1e-6) return;
      const dir = { x: pos.x / dist, y: pos.y / dist, z: pos.z / dist };
      const app = SF.view.relativistic ? SF.view.apparent(dir) : { dir };
      const cam = SF.camera.toCamera(app.dir);
      const cx = SF.camera.cx, cy = SF.camera.cy;
      const inset = 48;
      const colour = "120,255,196";
      const distText = SF.hud ? SF.hud.formatDistance(dist) : `${dist.toFixed(1)} ly`;

      // On screen: a diamond right on the target.
      if (cam.z > 0.02) {
        const p = SF.camera.project(app.dir, 0);
        if (p && p.x >= inset && p.x <= W - inset && p.y >= inset && p.y <= H - inset) {
          ctx.strokeStyle = `rgba(${colour},.9)`;
          ctx.lineWidth = 1.4;
          const s = 11;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s, p.y);
          ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s, p.y);
          ctx.closePath();
          ctx.stroke();
          Render.waypointLabel(name, distText, p.x + s + 7, p.y, colour, "left");
          return;
        }
      }

      // Off screen or behind: an arrow pinned to the edge, pointing at it.
      let vx, vy;
      if (cam.z > 0.02) {
        const p = SF.camera.project(app.dir, 0);
        vx = p.x - cx; vy = p.y - cy;
      } else {
        vx = cam.x; vy = -cam.y;      // behind: camera-space dir, screen y flipped
      }
      const len = Math.hypot(vx, vy) || 1;
      vx /= len; vy /= len;
      const maxX = W / 2 - inset, maxY = H / 2 - inset;
      const reach = Math.min(maxX / (Math.abs(vx) || 1e-6), maxY / (Math.abs(vy) || 1e-6));
      const ex = cx + vx * reach, ey = cy + vy * reach;

      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(Math.atan2(vy, vx));
      ctx.fillStyle = `rgba(${colour},.92)`;
      ctx.beginPath();
      ctx.moveTo(11, 0); ctx.lineTo(-7, -7); ctx.lineTo(-7, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Label just inside the arrow, toward screen centre so it never clips.
      Render.waypointLabel(name, distText, ex - vx * 18, ey - vy * 18, colour, "center");
    },

    waypointLabel(name, sub, x, y, colour, align) {
      ctx.globalAlpha = 1;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = `rgba(${colour},.95)`;
      ctx.fillText(name.toUpperCase(), x, y - 6);
      ctx.font = "500 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillStyle = `rgba(${colour},.62)`;
      ctx.fillText(sub, x, y + 6);
      ctx.textAlign = "left";
    },

    flash(alpha, colour) {
      if (alpha <= 0.002) return;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    },

    /** The Alcubierre bubble wall, when the fictional drive is engaged. */
    drawBubble(now) {
      const cx = SF.camera.cx, cy = SF.camera.cy;
      const r = Math.min(W, H) * 0.46;
      const ring = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 1.25);
      ring.addColorStop(0, "transparent");
      ring.addColorStop(0.62, `rgba(126,214,255,${(0.10 + Math.sin(now * 0.004) * 0.03).toFixed(3)})`);
      ring.addColorStop(1, "rgba(48,90,190,.28)");
      ctx.fillStyle = ring;
      ctx.fillRect(0, 0, W, H);
    },
  };
})();
