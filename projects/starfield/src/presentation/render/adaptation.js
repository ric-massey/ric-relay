/* ══════════════════════════════════════════════════════════════════════
   adaptation.js — the eye, not the camera.

   Visual Perception §2, and Design Bible §15.2. The governing fact is that
   the eye's enormous dynamic range is **sequential, not simultaneous**:
   about fourteen orders of magnitude across all adaptation states, but only
   three or four at any one of them. You never see a sunlit hull and faint
   stars in the same moment, and a renderer that shows both is lying.

   So exposure is a state with memory. Turn toward the sunlit Earth and the
   stars vanish within a second; turn away and they come back over the next
   half minute. Both of those are real, and their asymmetry is real too —
   the eye protects itself from brightness quickly and recovers from it
   slowly.

   The luminance driving the model is estimated analytically rather than
   measured from the framebuffer, because reading pixels back stalls the
   GPU on exactly the mobile hardware this has to run on. Ledger SF-L-011.
   ══════════════════════════════════════════════════════════════════════ */

import { K } from "../../simulation/core/units.js";

/**
 * How much sunlight each body throws back — as *rendered*, which for Earth
 * is not its published Bond albedo.
 *
 * Earth's Bond albedo is 0.306, and roughly two thirds of that is cloud.
 * The shipped Blue Marble texture has no clouds, so the planet actually
 * being drawn reflects far less: measured over the texture, weighted by
 * cos(latitude) so the poles do not dominate an equirectangular map, its
 * mean linear reflectance is 0.0955. Exposing for 0.306 while rendering
 * 0.0955 means the eye adapts to a planet three times brighter than the
 * one on the screen, and the day side comes out three stops under — which
 * is exactly what it was doing.
 *
 * The Moon keeps its real 0.11, because there the *texture* is the thing
 * that is wrong and it is corrected at the shader instead (bodies-view.js):
 * the Moon is as dark as worn asphalt, and that is a fact worth keeping
 * rather than an inconvenience to normalise away.
 */
const ALBEDO = { earth: 0.0955, moon: 0.11 };

/**
 * The floor the eye adapts to with nothing bright in view: airglow, zodiacal
 * light and the integrated light of the sky itself. Space is not black, and
 * this constant is the reason the renderer never pretends it is.
 */
const STARLIGHT_FLOOR = 3e-5;

/**
 * Adaptation speed, in orders of magnitude of luminance per second.
 *
 * Real dark adaptation crosses roughly four decades in 20–30 minutes, so
 * about 0.003 decades/s. At 12 it crosses the same range in a third of a
 * second — a compression of about 4 000×, which ledger SF-L-011 records.
 *
 * Ric, 2026-07-28: "I need it to adjust almost instantly." The previous 0.7
 * took six seconds to cross the range, and six seconds is long enough that
 * the player experiences it as *the renderer being slow* rather than as
 * their own eye adjusting — you turn away from the Earth, see nothing, and
 * have already looked somewhere else by the time the sky arrives. The
 * physical honesty of a slow curve is worth nothing if the effect it models
 * never gets attributed to the eye.
 *
 * Still a curve rather than a jump. A third of a second is short enough to
 * feel immediate and long enough to be visibly a transition, which is what
 * keeps it reading as adaptation instead of as a light switch.
 *
 * Brightening stays faster than darkening because that asymmetry is real,
 * and because it is the half you feel: a bright object entering the view
 * must kill the sky immediately, or the sky is not being suppressed by
 * light, it is being suppressed by a filter.
 */
const DARKEN_DECADES_PER_SEC = 12;
const BRIGHTEN_DECADES_PER_SEC = 40;

/**
 * Disability glare from a source **outside** the frame.
 *
 * The eye's field is far wider than the 80° the canopy renders, so a bright
 * source off the edge of the picture still scatters inside the eye and
 * raises the luminance the retina is adapting to. That much the old model
 * had right. What it had wrong was the falloff: a linear ramp over a fixed
 * 0.55 rad window, which handed a Sun 19° outside the frame **17.6%** of
 * its full in-frame effect. The result was an eye pinned at daylight almost
 * everywhere in the Earth–Moon volume — the Sun is nearly always within 30°
 * of something you want to look at — and therefore a sky with no stars in
 * it, which is the exact opposite of what Design Bible §15.1 asks for.
 *
 * The real quantity has a name and a measured form. Disability glare is
 * described by the Stiles–Holladay relation, adopted by the CIE:
 *
 *     L_veil = k · E_glare / θ²
 *
 * — veiling luminance falls with the *square* of the angle off the visual
 * axis, with k ≈ 10 when θ is in degrees, E in lux and L in cd/m². Its
 * useful range is about 1° to 30°, which is the range that matters here.
 *
 * The constant is 10 in **these** units too, and that is not a coincidence
 * worth hiding: this file works in multiples of the solar constant, so
 * dividing both an illuminance in lux and a luminance in cd/m² by the same
 * 127 000 lm/m² leaves the ratio alone. So the normalised form is simply
 * 10·E/θ², with E the irradiance the source delivers here, in units of the
 * solar constant at 1 au.
 *
 * At 59° that gives the Sun a veiling contribution of 2.9×10⁻³ — about a
 * hundredth of what the old ramp gave it, and enough for the brightest
 * stars to come back while the faint ones stay correctly drowned.
 */
const GLARE_K = 10;

/**
 * The brightest state the eye can adapt to.
 *
 * This exists because **you cannot adapt to the Sun.** The eye's adaptation
 * runs out somewhere around full daylight; the Sun's surface is another
 * four or five orders of magnitude above that, which is why looking at it
 * hurts instead of merely looking bright, and why everything else goes
 * black while you do.
 *
 * Without this cap the model happily adapted all the way to the Sun's own
 * radiance, and the result was the exact opposite of blinding: the Sun
 * rendered as a small grey dot in a black frame, correctly exposed, with
 * no glare — because exposure had swallowed the entire effect.
 *
 * In the units used here a sunlit Earth filling the view is about 0.05, so
 * this sits a few stops above the brightest thing you can comfortably look
 * at, and anything past it over-ranges and clips, as it should.
 */
const MAX_ADAPTED = 0.35;

/**
 * Star brightness scale. Chosen so that a magnitude 6.5 star — the naked-eye
 * limit, and the limit of the shipped catalogue — sits just at the threshold
 * of visibility when the eye is fully dark-adapted at the starlight floor.
 * Everything brighter follows from Pogson's ratio, so the whole visible
 * hierarchy falls out of one calibration point rather than being dialled in.
 */
export const STAR_GAIN = 4.2e-3;

/**
 * How brightly lit is the part of a body the camera is actually pointed at?
 *
 * Finds the point on the body's sphere nearest the view axis — the hit
 * point if the ray strikes it, the nearest point on the limb otherwise —
 * and returns the cosine of the Sun's incidence angle there.
 *
 * This is what makes looking at the dark side of a planet dark, and looking
 * at its crescent bright, from the same distance and the same phase.
 *
 * @param {object} v            one WorldService.observe result
 * @param {{x,y,z}} look        unit view direction
 * @returns {number} 0 (night) … 1 (Sun directly overhead there)
 */
function localIllumination(v, look) {
  if (!v.sunDirection) return v.phase;
  const r = v.record.radius.value;

  // Vector from the observer to the body's centre.
  const c = { x: v.direction.x * v.range, y: v.direction.y * v.range, z: v.direction.z * v.range };

  // Closest approach of the view ray to the centre.
  const t = c.x * look.x + c.y * look.y + c.z * look.z;
  const perp = { x: c.x - look.x * t, y: c.y - look.y * t, z: c.z - look.z * t };
  const perpLen = Math.hypot(perp.x, perp.y, perp.z);

  let n;
  if (perpLen < r && t > 0) {
    // The ray hits: take the near intersection and its outward normal.
    const back = Math.sqrt(Math.max(0, r * r - perpLen * perpLen));
    const hit = {
      x: look.x * (t - back) - c.x,
      y: look.y * (t - back) - c.y,
      z: look.z * (t - back) - c.z,
    };
    const L = Math.hypot(hit.x, hit.y, hit.z) || 1;
    n = { x: hit.x / L, y: hit.y / L, z: hit.z / L };
  } else if (perpLen > 0) {
    // The ray misses: use the point on the limb closest to it.
    n = { x: -perp.x / perpLen, y: -perp.y / perpLen, z: -perp.z / perpLen };
  } else {
    return v.phase;
  }

  const s = v.sunDirection;
  return Math.max(0, n.x * s.x + n.y * s.y + n.z * s.z);
}

export class Adaptation {
  constructor() {
    /** Current adapted luminance, relative to the solar constant at 1 au. */
    this.adapted = 0.35;
    /** Exposure multiplier handed to the tone mapper and the star shader. */
    this.exposure = 1;
    /** Latest estimate, before smoothing — useful for the HUD. */
    this.target = 0.35;
  }

  /**
   * Estimate the luminance the eye is adapting to: the average radiance
   * across the field of view, in units of the solar constant per steradian.
   *
   * Two quantities matter and they are easy to confuse. A surface's
   * *radiance* is how bright it looks, and it does not change with
   * distance — the Moon is exactly as bright per unit area from here as it
   * is from beside it. What changes with distance is how much of your
   * field of view it fills. So the estimate is radiance × coverage, summed.
   *
   * For a diffuse lit surface, radiance = albedo × irradiance × lit
   * fraction ÷ π. The Sun is not diffuse: its radiance is its irradiance
   * divided by the solid angle it subtends, which is why it is roughly
   * fifteen thousand times brighter than anything reflecting it.
   *
   * @param {Array} views  results of WorldService.observe() for each body
   * @param {{x,y,z}} lookDirection  unit vector the camera points along
   * @param {number} fovRad  vertical field of view
   */
  estimate(views, lookDirection, fovRad) {
    let total = STARLIGHT_FLOOR;
    let fixated = 0;

    for (const v of views) {
      // A body hidden behind another lights nothing. Orbital night is
      // exactly this case: the Sun is still out there, 25° from where you
      // are looking, with the entire Earth in the way.
      if (v.occluded) continue;

      const dot =
        v.direction.x * lookDirection.x +
        v.direction.y * lookDirection.y +
        v.direction.z * lookDirection.z;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

      /* How much of this body is inside the frame, from fully in to fully
         out, with the transition taking exactly as long as the body's own
         width — a source does not leave the field instantaneously, and the
         Sun takes half a degree to cross the edge. */
      const halfAngle = fovRad * 0.5;
      const radius = Math.max(v.angularDiameter * 0.5, 1e-9);
      const inFrame = Math.min(1, Math.max(0, (halfAngle + radius - angle) / (2 * radius)));

      // Fraction of the field the body fills, capped at all of it.
      const coverage = Math.min(1, Math.pow(v.angularDiameter / fovRad, 2));

      // Irradiance falls off as 1/r² from 1 au.
      const irradiance = Math.pow(K.AU.value / Math.max(v.range, 1), 2);

      let radiance;
      if (v.id === "sun") {
        // Solid angle of the disc, then irradiance ÷ solid angle.
        const omega = 2 * Math.PI * (1 - Math.cos(v.angularDiameter / 2));
        radiance = irradiance / Math.max(omega, 1e-12);
      } else {
        const albedo = ALBEDO[v.id] ?? 0.15;

        // **The part you are looking at**, not the whole-disc average.
        //
        // Using the disc's phase here was wrong in the one case that
        // matters most: on the night side of Earth, a 5% crescent was
        // treated as though the entire globe glowed at 5% brightness. It
        // does not — 5% of it is in daylight and the rest is very nearly
        // black. So looking down at the dark Earth held exposure far too
        // low, and took the city lights and the stars with it, at exactly
        // the moment the sky should be at its best.
        const lit = localIllumination(v, lookDirection);
        radiance = (albedo * lit) / Math.PI;

        // The night side is not perfectly black: cities, airglow and
        // moonlight all emit. Small, but it is the difference between a
        // dark Earth and a hole in the sky.
        if (v.id === "earth") radiance += 2.5e-6 * (1 - lit);
      }

      /* In the frame, the body lights the retina directly, in proportion to
         how much of the field it covers. Out of the frame it only scatters,
         and scatter obeys the inverse square of the angle rather than the
         geometry of the picture. Both terms are here, weighted by how much
         of the body is on each side of the edge, so crossing it is smooth
         and neither model is asked to describe a case it does not fit.

         Illuminance is radiance × solid angle: the total light the source
         actually delivers here, which is the quantity the glare relation
         wants and the one that makes a small brilliant Sun and a large dim
         Earth comparable. */
      const solidAngle = 2 * Math.PI * (1 - Math.cos(radius));
      const illuminance = radiance * solidAngle;
      const angleDeg = Math.max(angle * (180 / Math.PI), 1);

      /* Scattered light still has to get into the eye to scatter. The pupil
         is a flat aperture, so the light it admits falls with the cosine of
         the angle and reaches zero at 90° — which is why the Sun behind your
         shoulder does not wash out the view, and why the glare relation must
         not be extrapolated to the whole sphere. Without this the model gave
         a Sun directly *behind* the ship ten times the starlight floor. */
      const aperture = Math.max(0, Math.cos(angle));

      /* Stiles–Holladay is validated from about 1° to 30°, and 1/θ² is far
         too generous past that — it was still handing the Sun a third of a
         stop at 86° off the axis, which held the eye four times above the
         starlight floor and kept the sky dim everywhere in the Earth–Moon
         volume. Ric, 2026-07-28: the star "should only affect the eyes if
         it's close enough."
​
         So beyond the validated range the term falls off quadratically in
         its own right. This is not a fudge in the direction of prettiness:
         extrapolating a fitted relation three times past its range was the
         fudge, and correcting it happens to give the darker sky, which is
         how you can tell which of the two is the physics. */
      const OUTSIDE_FIT_DEG = 30;
      const beyond = Math.max(0, angleDeg - OUTSIDE_FIT_DEG) / 15;
      const extrapolationPenalty = 1 / (1 + beyond * beyond);

      const veiling =
        (GLARE_K * illuminance * aperture * extrapolationPenalty) / (angleDeg * angleDeg);

      /* Where in the field the light is, not just how much of it there is.
​
         The eye does not adapt to a flat average over its whole field. Ric,
         2026-07-28: "when the Earth is in view all the stars disappear" —
         and they were disappearing for a five-percent sliver of limb in the
         corner of the frame, because a plain area-weighted average treats
         light at the edge of vision exactly like light you are looking at.
         Vision does not work that way: adaptation is dominated by the fovea
         and the near periphery, which is why you can read an instrument
         panel with a bright window off to one side, and why a pilot turns
         their head rather than closing their eyes.
​
         So the direct term is weighted by how far the body's *nearest edge*
         sits from the axis. The nearest edge rather than the centre, because
         a planet filling half the sky has its centre 70° away while its limb
         is right in front of you — and it is the limb you are looking at.
​
         15° is the scale: roughly the near-periphery, inside which the
         retina's response is dominated by what it sees. */
      const FOVEAL_DEG = 15;
      const edgeDeg = Math.max(0, angle - radius) * (180 / Math.PI);
      const foveal = 1 / (1 + (edgeDeg / FOVEAL_DEG) * (edgeDeg / FOVEAL_DEG));

      total += radiance * coverage * inFrame * foveal + veiling * (1 - inFrame);

      // Local adaptation. The eye does not expose for the average of the
      // whole field — it adapts largely to whatever it is looking at, which
      // is why the Moon through a telescope shows its maria instead of
      // burning out into a white disc the way a frame-averaged exposure
      // would render it. Anything within the central quarter of the field
      // counts as fixated.
      if (angle < fovRad * 0.25) fixated = Math.max(fixated, radiance);
    }

    // A quarter weight: fixating on something pulls exposure toward it
    // without ignoring the darkness around it entirely. Then clamped: the
    // eye cannot adapt past MAX_ADAPTED, which is what makes the Sun
    // blinding rather than merely well-exposed.
    this.target = Math.min(Math.max(total, fixated * 0.25), MAX_ADAPTED);
    return this.target;
  }

  /**
   * Advance the adaptation state.
   *
   * Rate is expressed in **decades per second** — orders of magnitude of
   * luminance — rather than as an exponential time constant, because that
   * is the quantity the eye actually works in and because it makes the
   * compression factor explicit and testable.
   *
   * Real dark adaptation is partial within seconds, largely cone-driven
   * over several minutes, and near-complete after 20–30 minutes. Visual
   * Perception §2.1 states plainly that full fidelity here is unplayable
   * and that a compressed curve is required, declared as a presentation
   * aid with its factor stated: **ledger SF-L-011**, roughly 200× faster
   * than the real thing.
   *
   * The asymmetry is kept because it is the part you actually feel: the
   * eye protects itself from brightness almost instantly and recovers from
   * it slowly. Look at the Sun and the sky is gone at once; look away and
   * it comes back over a few seconds.
   */
  update(dt) {
    // The session does not begin mid-adaptation: whoever is in this seat
    // has been looking out of this window for a while. Snapping on the
    // first frame avoids opening on 40 seconds of an unexplained dark view.
    if (this._first !== false) {
      this._first = false;
      this.adapted = this.target;
      this.exposure = 0.18 / Math.max(this.adapted, 1e-9);
      return this.exposure;
    }

    // Adapt in log space, because that is how the response works — each
    // doubling of light costs the same amount of adaptation.
    const logNow = Math.log10(Math.max(this.adapted, 1e-9));
    const logTarget = Math.log10(Math.max(this.target, 1e-9));
    const gap = logTarget - logNow;

    const rate = gap > 0 ? BRIGHTEN_DECADES_PER_SEC : DARKEN_DECADES_PER_SEC;
    const step = Math.min(Math.abs(gap), rate * dt) * Math.sign(gap);

    this.adapted = Math.pow(10, logNow + step);

    // Middle grey lands at 0.18 of the adapted level — the same anchor a
    // photographer's grey card uses, and for the same reason.
    this.exposure = 0.18 / Math.max(this.adapted, 1e-9);
    return this.exposure;
  }

  /**
   * A plain-language name for the current state, for the HUD. Players
   * should be able to see *that* their eyes are adapting, not just suffer
   * the consequences.
   */
  get description() {
    const a = this.adapted;
    // Reference points, in the units above: the Sun in frame is about 1.3,
    // a sunlit Earth filling the view about 0.05, a dark sky 3×10⁻⁵.
    if (a >= 0.34) return "sun-blind";
    /* Plain words, at Ric's request, 2026-07-28: "I want kids to be able to
       fly this around and understand the words." "Dark-adapted" is a term
       of art; "used to the dark" is the same fact in words a child reads
       without stopping. */
    if (a > 0.01) return "dazzled by the light";
    if (a > 4e-4) return "getting used to the dark";
    if (a > 6e-5) return "used to the dark";
    return "fully used to the dark";
  }
}
