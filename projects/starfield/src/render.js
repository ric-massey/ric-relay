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
      painted, despite depending only on W and H. It was then cached to an
      offscreen canvas and blitted — and is now gone entirely. The blue
      gradient and the painted "galactic cirrus" were the brightest thing on
      an empty screen, and they were not real: nothing catalogued put them
      there. Space is black. Every photon in this game now comes from
      something the simulation actually models.

   3. DEPTH ORDER. Hazards were drawn in array order while z varied freely
      inside a system, so a distant moon could paint over a near planet.
      Everything is sorted far-to-near now.

   Draw order: backdrop → CMB → sky stars → galaxies → bodies → HUD.

   There used to be a fourth layer: pale blue dust streaks that smeared
   across the view as you accelerated. It read as speed-lines in a cartoon,
   not as space, and it was the brightest thing on screen at exactly the
   moment the real starfield was doing its most interesting work. Gone. The
   only things that light this sky now are stars.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const K = SF.K;
  const v3 = SF.v3;

  let canvas, ctx;
  let W = 1, H = 1, dpr = 1;
  const TAU = Math.PI * 2;
  // The keyboard-hint block at the foot of the screen. Edge arrows stop short
  // of it so they never land on top of the text.
  const HUD_SAFE_BOTTOM = 74;

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
    },

    // Not quite #000: a few counts of blue keep the darkest stars from
    // clipping to pure black on cheap panels, and it matches the page
    // background so the canvas edge never shows a seam.
    beginFrame() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#01020a";
      ctx.fillRect(0, 0, W, H);
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
      // The EASED speed, not the true one: this glow is the forward sky
      // heating up, and it has to fade in and out with the aberration it
      // belongs to rather than switching off the frame you pass c.
      const beta = SF.view.beta, gamma = SF.view.gamma;
      if (!SF.view.relativistic || gamma < 1.02) return 0;
      void state;

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
       THESE STARS HAVE POSITIONS NOW, and that is the difference between
       flying and watching a screensaver. They used to be stored as bare
       directions on a unit sphere — pinned at infinity, forever. You could
       cross a thousand light-years and not one of them would shift by a
       pixel. The only thing they ever did was crush together when you went
       fast, so the sky read as *stagnant and bunching up* rather than as
       something you were moving through. Nothing ever went past you.

       With real positions they parallax: near stars stream by, brighten as
       you close on them by a plain inverse square, and slide behind. The
       distant bright ones barely move, which is also correct — that is what
       "distant" means. Aberration still crushes the whole lot forward at
       speed, on top of the motion rather than instead of it.

       Population is importance-sampled: draw the star first (76% of them are
       M dwarfs) then place it uniformly out to the distance where it would
       fade past naked-eye. A red dwarf is only visible within about eight
       light-years, a B star from thousands, so the sky fills with the rare
       bright ones even though the population is overwhelmingly red. That is
       why the real night sky looks nothing like the real galaxy.          */
    LIMIT_MAG: 8.5,             // past the naked-eye limit, so faint stars fill in
    SKY_MAX_LY: 3000,

    /* ── the visibility window, and why both edges are ramps ────────────
       Giving these stars positions introduced two ways to make the sky
       flash, and both were hard edges.

       AT THE FAR END, a star was recycled the moment it fell behind you and
       passed its own visibility distance. But "its own visibility distance"
       is where it hits magnitude 7 and the draw threshold is 6.9, so a star
       could be plainly visible on one frame and swapped out on the next —
       about seventy times a second at cruise.

       AT THE NEAR END, brightness now comes from live distance with nothing
       stopping it. Background stars sailed within 0.024 ly and flared to
       magnitude −2.6, brighter than Sirius, jumping 9.6 magnitudes in a
       single frame — a factor of six thousand.

       So visibility ramps to zero at both ends and a star is only ever
       recycled where the ramp has already reached zero. The near cutoff also
       says something true about the design: these are the background sky, not
       destinations. The stars you can actually arrive at are the catalogued
       systems, which have planets and collide with you.                    */
    skyStep: 0,                 // last frame's travel, set by stepSkyField
    NEAR_GONE_LY: 0.4,          // closer than this, a background star is gone
    NEAR_FULL_LY: 1.2,          // fully present from here outward
    FAR_FADE: 1.7,              // × maxLy, where it has faded away behind you
    WIDEN_MAX_FRAC: 0.25,       // cap on the speed-widened fade ramps, × maxLy

    /**
     * 0…1 visibility for a sky star at `dist`. Zero means safe to recycle.
     *
     * Both ramps widen with how far the ship covers per frame. A fixed band is
     * useless at speed: crossing 2 ly in a frame steps clean over a 0.8 ly
     * fade and the star blinks anyway. Holding the ramp at least a few frames
     * wide means it always fades over several frames, however fast you go.
     */
    skyWindow(star, dist) {
      const step = Render.skyStep || 0;
      const nearGone = Render.NEAR_GONE_LY;
      if (dist <= nearGone) return 0;
      // WIDENED, BUT BOUNDED. The ramps grow with how far the ship covers per
      // frame so a star always fades over several frames instead of blinking.
      // Unbounded, that is a disaster in the high gears: at 8,000 ly a frame
      // the fade-in ramp was 33,000 ly deep, so every star in the field sat
      // inside it and the whole sky dimmed to a fifth of its brightness —
      // shifting up a gear visibly turned the stars down. Past the point where
      // the ship crosses a star's entire visibility range in one frame the
      // widening buys nothing anyway (the field recycles wholesale however
      // gentle the ramp is), so it is capped as a fraction of the star's own
      // range and the sky now looks the same at every speed.
      const widen = Math.min(4 * step, star.maxLy * Render.WIDEN_MAX_FRAC);
      const nearFull = Math.max(Render.NEAR_FULL_LY, nearGone + widen);
      const far = star.maxLy * Render.FAR_FADE + widen;
      if (dist >= far) return 0;
      let w = 1;
      if (dist < nearFull) w = (dist - nearGone) / (nearFull - nearGone);
      if (dist > star.maxLy) w = Math.min(w, (far - dist) / (far - star.maxLy));
      return w < 0 ? 0 : w > 1 ? 1 : w;
    },

    /**
     * One sky star. With `ahead` supplied it is placed in the forward
     * hemisphere at the far edge of its own visibility, so a recycled star
     * fades in from the distance instead of popping into being nearby.
     */
    makeSkyStar(rng, ahead) {
      const star = SF.stars.sample(rng);
      const absMag = 4.83 - 2.5 * Math.log10(Math.max(1e-9, star.lum));
      const maxPc = Math.pow(10, (Render.LIMIT_MAG - absMag + 5) / 5);
      const maxLy = Math.min(Render.SKY_MAX_LY, Math.max(2, maxPc * K.pcLy));

      const cosI = -1 + 2 * rng();
      const sinI = Math.sqrt(Math.max(0, 1 - cosI * cosI));
      const phi = rng() * TAU;
      let dx = sinI * Math.cos(phi), dy = cosI, dz = sinI * Math.sin(phi);
      if (ahead) {
        // Uniform over the forward hemisphere: mirror any draw that came out
        // pointing backwards.
        if (dx * ahead.x + dy * ahead.y + dz * ahead.z < 0) { dx = -dx; dy = -dy; dz = -dz; }
      }
      // Fresh stars enter at the edge of their range; the initial field is
      // spread through the whole volume so the sky starts full.
      const distanceLy = ahead ? maxLy * (0.82 + 0.18 * rng()) : maxLy * Math.cbrt(rng());

      return {
        pos: { x: dx * distanceLy, y: dy * distanceLy, z: dz * distanceLy },
        maxLy,
        lum: star.lum,
        teff: star.teff,
        entry: SF.color.at(star.teff),
        twinkle: rng() * TAU,
        jitter: 0.85 + rng() * 0.3,
      };
    },

    makeSkyField(count, rng = Math.random) {
      const field = [];
      for (let i = 0; i < count; i += 1) field.push(Render.makeSkyStar(rng, null));
      return field;
    },

    /**
     * Translate the field by this frame's travel and recycle whatever has
     * fallen behind. A star is recycled only once it is *both* behind you and
     * further away than it could ever be seen from — so the swap always
     * happens off-screen, and near space keeps being repopulated at the rate
     * you empty it. Without the recycle the nearby red dwarfs would be passed
     * once and never replaced, and the sky would slowly go bare.
     */
    stepSkyField(field, vdir, dHome, rng = Math.random) {
      // dHome is signed: negative is the ship in reverse. "Ahead" for the
      // purposes of fading, recycling and spawning is the direction of TRAVEL,
      // so backing up refills the sky behind the nose rather than freezing it.
      if (!field || !dHome) return;
      const s = dHome < 0 ? -1 : 1;
      const travel = { x: vdir.x * s, y: vdir.y * s, z: vdir.z * s };
      // Remembered so the draw pass sizes its fade ramps to the same speed.
      Render.skyStep = Math.abs(dHome);
      for (let i = 0; i < field.length; i += 1) {
        const star = field[i];
        star.pos.x -= vdir.x * dHome;
        star.pos.y -= vdir.y * dHome;
        star.pos.z -= vdir.z * dHome;
        // Recycle only where the visibility ramp has already reached zero, so
        // the swap is always invisible. Two ways to get there: fallen far
        // enough behind, or come close enough that it has faded out in front.
        const dist = Math.hypot(star.pos.x, star.pos.y, star.pos.z);
        if (Render.skyWindow(star, dist) > 0) continue;
        const along = star.pos.x * travel.x + star.pos.y * travel.y + star.pos.z * travel.z;
        if (along < 0 || dist <= Render.NEAR_GONE_LY) {
          field[i] = Render.makeSkyStar(rng, travel);
        }
      }
    },

    drawSkyField(field, state, now, lenses) {
      // β and γ come from the view, which eases them across the lightspeed
      // boundary; density is a property of where you are, not how fast.
      const beta = SF.view.beta, gamma = SF.view.gamma;
      const relativistic = SF.view.relativistic;
      const { density } = state;
      const focal = SF.camera.focal;
      const marginX = W * 0.06, marginY = H * 0.06;

      for (const star of field) {
        // Direction and brightness both come from the live position, so a
        // star you are closing on genuinely gets brighter as you approach.
        const p0 = star.pos;
        const dist = Math.hypot(p0.x, p0.y, p0.z);
        if (dist < 1e-6) continue;
        const window = Render.skyWindow(star, dist);
        if (window <= 0) continue;
        const dir = { x: p0.x / dist, y: p0.y / dist, z: p0.z / dist };
        const baseMag = SF.stars.apparentMagnitude(star.lum, dist);

        const app = relativistic ? SF.view.apparent(dir)
          : { dir, cos: v3.dot(dir, SF.view.forward), D: 1, mag: 1 };
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
        const mag = baseMag - 2.5 * Math.log10(gain);
        // Thinning star fields raise the effective limit rather than dimming
        // every star equally, which is what leaving the disk actually does.
        const limit = 6.9 + 2.5 * Math.log10(Math.max(1e-4, density));
        const above = limit - mag;
        if (above <= 0) continue;
        // THE FLASHING LIVED HERE. This used to be `above / 7.4 + 0.06`, which
        // still reads 0.06 at the exact threshold and is then cut to nothing by
        // the line above — a hard step off a floor. That was invisible while
        // every star's magnitude was fixed at spawn, because none of them ever
        // crossed the threshold. The moment brightness started coming from live
        // distance, stars crossed it constantly and each crossing was a blink.
        // Ramping the last half-magnitude to zero removes the step.
        const alpha = Math.min(1, above / 7.4 + 0.06) * Math.min(1, above / 0.6);

        const twinkle = 0.86 + Math.sin(now * 0.0014 + star.twinkle) * 0.14;
        // The window scales size as well as alpha, so a star shrinks away
        // rather than dimming in place — a fading point that keeps its full
        // width still reads as a blink.
        const size = Math.max(0.5, Math.min(3.4, 0.55 + above * 0.28)) * star.jitter * (0.35 + 0.65 * window);
        ctx.globalAlpha = Math.min(1, alpha * twinkle * window);
        ctx.fillStyle = entry.css;
        if (size < 1.1) {
          ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, size * 0.62, 0, TAU);
          ctx.fill();
          if (size > 2.1) {
            // Windowed too, or the spikes on a fading star snap out on their
            // own while the disc is still going.
            ctx.globalAlpha = Math.min(1, alpha * 0.45 * window);
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

      // WHERE IT IS ON SCREEN IS THIS FRAME'S ANSWER OR NOTHING. Every bail-out
      // below used to leave the last frame's `screen` in place, and game.js
      // draws galaxy labels off it — so turning away from Andromeda left its
      // name pinned to the sky at the spot it used to be, sometimes for the rest
      // of the flight. Clearing it up front means a label can only ever be drawn
      // for a galaxy that actually got projected this frame.
      galaxy.screen = null;

      // Stage three first, because once you are inside a galaxy its centre
      // can be behind you while its stars are all around — the sprite work
      // below would bail out and take them with it.
      if (grain > 0.02) {
        // Estimated screen radius, for the level-of-detail budget below.
        // Inside one, the "radius" is the whole viewport.
        const px = inside ? Math.max(W, H) : SF.camera.focal * measure.angular;
        Render.drawGalaxyStars(galaxy, grain, px);
      }
      if (inside) return;

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
    drawGalaxyStars(galaxy, grain, screenRadiusPx = 0) {
      const points = SF.galaxy.buildPoints(galaxy);

      // LEVEL OF DETAIL, KEYED TO APPARENT SIZE. Whether a thing has grained
      // apart into stars is decided by its DISTANCE (galaxy.js), which is right
      // for a galaxy and badly wrong for the small objects sharing this code
      // path: the Ring Nebula is 2.6 ly across at 2,570 ly, so it is "resolved"
      // while covering less than one pixel — and it was projecting, Doppler-
      // shifting and drawing 1,500 individual stars into that pixel, every
      // frame. Fourteen such objects cost 10 ms a frame, and near c it was
      // unavoidable because aberration puts the entire sky on screen at once.
      //
      // So the count follows the area it actually covers, about a third of a
      // point per pixel, and the alpha is scaled up to conserve the total light
      // (the clamp at 1 stops a sub-pixel object from over-brightening). The
      // points are an unbiased sample of the profile, so a prefix of them is
      // the same object drawn with fewer stars.
      const area = Math.PI * screenRadiusPx * screenRadiusPx;
      const budget = Math.max(8, Math.min(points.length, Math.ceil(area * 0.35)));
      const boost = points.length / budget;

      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < budget; i += 1) {
        const point = points[i];
        const world = SF.galaxy.toWorld(galaxy, point.x, point.y, point.z);
        const p = SF.view.project(world, 0);
        if (!p) continue;
        if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) continue;
        const s = SF.color.shifted(point.teff, p.D);
        const flux = SF.stars.fluxAt(point.lum, p.dist) * s.gain;
        const alpha = Math.min(1, grain * Math.min(1, Math.pow(flux * 26, 0.34)) * boost);
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
    drawPlanet(body, p, litScreen, starWorld) {
      const r = Math.max(0.7, p.r);
      const style = body.style;

      // Planets make no light of their own — a star lights them, and only the
      // half facing that star is visible. The PHASE comes from real geometry:
      // the angle between "planet → its star" and "planet → the camera". Full
      // when the star is behind you, a thin crescent when it is off to the
      // side, and nothing at all when the planet is between you and the star.
      let litFraction = 1;
      if (starWorld && body.p) {
        const pp = body.p;
        const toStar = v3.normalize({ x: starWorld.x - pp.x, y: starWorld.y - pp.y, z: starWorld.z - pp.z });
        const toCam = v3.normalize({ x: -pp.x, y: -pp.y, z: -pp.z });
        const cosA = Math.max(-1, Math.min(1, v3.dot(toStar, toCam)));
        litFraction = (1 + cosA) / 2;
      }
      if (litFraction < 0.015) return;   // backlit — its dark side, invisible

      // At real scale a planet is sub-pixel until you are almost on top of it,
      // so most of the time draw it as a findable POINT of reflected light that
      // resolves into the real lit disc as you close in. This is a visibility
      // aid, not a size cheat — the collidable body keeps its true radius.
      if (p.r < 1.6) {
        const pr = 1.7 + (body.kind === "moon" ? -0.4 : 0);
        ctx.globalAlpha = Math.min(0.92, 0.22 + 0.7 * litFraction);
        ctx.fillStyle = `hsl(${style.hue},${Math.max(14, style.sat - 8)}%,${Math.min(82, style.light + 20)}%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.1, pr), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        return;
      }

      // Lit direction on screen (toward the star), for the terminator.
      let lx = 0, ly = -1;
      if (litScreen) {
        const dx = litScreen.x - p.x, dy = litScreen.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        lx = dx / len; ly = dy / len;
      }

      if (body.ring && r > 2 && litFraction > 0.25) {
        ctx.globalAlpha = Math.min(1, (litFraction - 0.25) / 0.5);
        ctx.strokeStyle = `hsla(${style.hue + 30},${style.sat}%,${style.light + 12}%,.5)`;
        ctx.lineWidth = Math.max(0.8, r * 0.14);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * 1.7, r * 0.42, body.tilt || -0.24, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.clip();

      // Day-side shading: brightest at the sub-stellar point, falling off round
      // the sphere. No self-glow — this is reflected light only.
      const sx = p.x + lx * r * 0.6, sy = p.y + ly * r * 0.6;
      const day = ctx.createRadialGradient(sx, sy, r * 0.05, p.x, p.y, r * 1.15);
      day.addColorStop(0, `hsl(${style.hue},${style.sat}%,${Math.min(88, style.light + 24)}%)`);
      day.addColorStop(0.5, `hsl(${style.hue},${Math.max(10, style.sat - 8)}%,${Math.max(16, style.light - 6)}%)`);
      day.addColorStop(1, `hsl(${style.hue},${Math.max(8, style.sat - 16)}%,${Math.max(8, style.light - 20)}%)`);
      ctx.fillStyle = day;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);

      // Terminator mask: keep the lit portion, fade the night side to fully
      // transparent so empty space (or whatever is behind) shows through it.
      ctx.globalCompositeOperation = "destination-in";
      const tPos = Math.max(0.02, Math.min(0.98, litFraction));
      const mask = ctx.createLinearGradient(
        p.x + lx * r, p.y + ly * r, p.x - lx * r, p.y - ly * r);
      mask.addColorStop(0, "rgba(0,0,0,1)");
      mask.addColorStop(Math.max(0, tPos - 0.18), "rgba(0,0,0,1)");
      mask.addColorStop(Math.min(1, tPos + 0.06), "rgba(0,0,0,0)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = mask;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      ctx.restore();
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

    /**
     * Where to put a marker for a world direction: on the target if it sits
     * comfortably on screen, otherwise pinned to the screen edge pointing at
     * it. Shared by the heading, retrograde and waypoint markers, so all
     * three behave identically instead of each rolling their own arithmetic.
     */
    placeMarker(dir, inset) {
      const cx = SF.camera.cx, cy = SF.camera.cy;
      const cam = SF.camera.toCamera(dir);
      // The keyboard-hint block owns the bottom strip of the screen. An edge
      // arrow pinned there lands on top of the text and both become unreadable.
      const bottom = Math.max(inset, HUD_SAFE_BOTTOM);
      let vx, vy;
      if (cam.z > 0.02) {
        const p = SF.camera.project(dir, 0);
        if (p && p.x >= inset && p.x <= W - inset && p.y >= inset && p.y <= H - bottom) {
          return { onScreen: true, x: p.x, y: p.y, vx: 0, vy: 0 };
        }
        vx = p.x - cx; vy = p.y - cy;
      } else {
        vx = cam.x; vy = -cam.y;      // behind: camera-space dir, screen y flipped
      }
      const len = Math.hypot(vx, vy) || 1;
      vx /= len; vy /= len;
      const maxX = W / 2 - inset;
      const maxY = (vy > 0 ? H / 2 - bottom : H / 2 - inset);
      const reach = Math.min(maxX / (Math.abs(vx) || 1e-6), maxY / (Math.abs(vy) || 1e-6));
      return { onScreen: false, x: cx + vx * reach, y: cy + vy * reach, vx, vy };
    },

    /**
     * A flight marker: a glyph and a label where the direction points, or an
     * arrow at the screen edge when it is off-view. `edgeArrow: false` keeps
     * a marker from pinning itself to the edge — retrograde is behind you
     * almost all the time, and an arrow that is always on screen tells you
     * nothing while adding permanent clutter.
     */
    marker(dir, colour, label, glyph, edgeArrow = true) {
      const at = Render.placeMarker(dir, 34);
      if (at.onScreen) {
        const apart = Math.hypot(at.x - SF.camera.cx, at.y - SF.camera.cy);
        if (glyph === "dot") {
          ctx.fillStyle = `rgba(${colour},.92)`;
          ctx.beginPath();
          ctx.arc(at.x, at.y, 3.5, 0, TAU);
          ctx.fill();
        }
        if (apart > 14) {
          ctx.strokeStyle = `rgba(${colour},${glyph === "dot" ? ".62" : ".45"})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(at.x, at.y, glyph === "dot" ? 9 : 7, 0, TAU);
          if (glyph === "cross") {
            // The nav-ball retrograde glyph: a ringed X you burn toward.
            ctx.moveTo(at.x - 4.4, at.y - 4.4); ctx.lineTo(at.x + 4.4, at.y + 4.4);
            ctx.moveTo(at.x + 4.4, at.y - 4.4); ctx.lineTo(at.x - 4.4, at.y + 4.4);
          }
          ctx.stroke();
          Render.markerLabel(label, at.x, at.y + 20, colour);
        }
        return at;
      }
      if (!edgeArrow) return at;
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(Math.atan2(at.vy, at.vx));
      ctx.fillStyle = `rgba(${colour},.9)`;
      ctx.beginPath();
      ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      Render.markerLabel(label, at.x - at.vx * 17, at.y - at.vy * 17, colour);
      return at;
    },

    markerLabel(text, x, y, colour) {
      ctx.font = "600 9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(${colour},.75)`;
      ctx.fillText(text, x, y);
      ctx.textAlign = "left";
    },

    /**
     * The nose reticle, plus the green heading dot.
     *
     * TWO MARKERS, AND THE DIFFERENCE BETWEEN THEM IS THE PHYSICS. The faint
     * blue crosshair is where the nose points. The green dot is where the
     * ship is actually going. Turn at walking pace and they sit on top of
     * each other; turn at 0.99c and the green dot lags behind the nose and
     * refuses to catch up, because transverse acceleration is suppressed by
     * a/(γβ). That lag is not a bug to be papered over — it is the reason
     * you cannot swerve at relativistic speed, and showing it is the only
     * way the player ever finds out.
     *
     * Green is reserved for this and nothing else on the canvas; the
     * waypoint guide is amber so the two can never be confused.
     */
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

      // Heading and retrograde. Now that thrust is not locked to the nose,
      // the heading can sit anywhere on the sphere — including straight
      // behind you — so both markers get the same on-screen-or-edge-arrow
      // treatment the waypoint has. Losing track of your own velocity vector
      // is the single most disorienting thing that can happen in a ship that
      // drifts, and before this it simply vanished off the edge.
      // A hundredth of a percent of light. Below that "where you are going" is
      // numerical noise pointing in an arbitrary direction, and drawing an
      // arrow for it is worse than drawing nothing — the ship reads as
      // stationary, so the marker belongs under the crosshair.
      // In reverse the heading is behind the nose whatever the speed, and in a
      // faster-than-light gear β is zero — so the test cannot be β alone, or
      // backing away from a star would draw the heading dot dead ahead.
      const moving = state.beta > 1e-4 || (state.warpLySec || 0) < 0;
      let vel = null;
      if (moving) {
        const fwd = SF.view.forward;
        vel = Render.marker(fwd, "120,255,196", "HEADING", "dot", true);
        Render.marker({ x: -fwd.x, y: -fwd.y, z: -fwd.z }, "120,255,196", "RETRO", "cross", false);
      } else {
        // At rest there is no heading, so the dot parks under the crosshair
        // rather than disappearing or pointing somewhere meaningless.
        ctx.fillStyle = "rgba(120,255,196,.92)";
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, TAU);
        ctx.fill();
      }

      // The starbow ring: where D = 1 and the sky keeps its true colour. It
      // is centred on the velocity vector, so it is only meaningful while
      // that vector is actually in view — an edge-arrow placement would put
      // the ring somewhere the physics never said it was.
      if (SF.view.relativistic && SF.view.beta > 0.55) {
        const angle = SF.rel.starbowAngle(SF.view.beta, SF.view.gamma);
        if (angle && vel && vel.onScreen) {
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
     * "steer until the amber diamond sits on the green heading dot."
     */
    drawWaypoint(name, pos) {
      const dist = Math.hypot(pos.x, pos.y, pos.z);
      if (dist < 1e-6) return;
      const dir = { x: pos.x / dist, y: pos.y / dist, z: pos.z / dist };
      const app = SF.view.relativistic ? SF.view.apparent(dir) : { dir };
      // Amber, not green: green is the heading dot and only the heading dot.
      const colour = "255,190,92";
      const distText = SF.hud ? SF.hud.formatDistance(dist) : `${dist.toFixed(1)} ly`;
      const at = Render.placeMarker(app.dir, 48);

      // On screen: a diamond right on the target.
      if (at.onScreen) {
        ctx.strokeStyle = `rgba(${colour},.9)`;
        ctx.lineWidth = 1.4;
        const s = 11;
        ctx.beginPath();
        ctx.moveTo(at.x, at.y - s); ctx.lineTo(at.x + s, at.y);
        ctx.lineTo(at.x, at.y + s); ctx.lineTo(at.x - s, at.y);
        ctx.closePath();
        ctx.stroke();
        Render.waypointLabel(name, distText, at.x + s + 7, at.y, colour, "left");
        return;
      }

      // Off screen or behind: an arrow pinned to the edge, pointing at it.
      const vx = at.vx, vy = at.vy, ex = at.x, ey = at.y;
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

    /**
     * The Alcubierre bubble wall, when the fictional drive is engaged.
     * `fade` is 0…1 so the wall comes up and drops away over the same half
     * second the aberration takes; it used to be painted at full strength the
     * instant the drive passed c, which put a screen-wide blue vignette on and
     * off like a light switch every time a gear change crossed lightspeed.
     */
    drawBubble(now, fade = 1) {
      if (fade <= 0.01) return;
      const cx = SF.camera.cx, cy = SF.camera.cy;
      const r = Math.min(W, H) * 0.46;
      const ring = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 1.25);
      ring.addColorStop(0, "transparent");
      ring.addColorStop(0.62, `rgba(126,214,255,${(0.10 + Math.sin(now * 0.004) * 0.03).toFixed(3)})`);
      ring.addColorStop(1, "rgba(48,90,190,.28)");
      ctx.globalAlpha = Math.min(1, fade);
      ctx.fillStyle = ring;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    },
  };
})();
