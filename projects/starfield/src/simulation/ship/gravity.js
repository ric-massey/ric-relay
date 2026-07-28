/* ══════════════════════════════════════════════════════════════════════
   gravity.js — the field the ship actually falls through.

   Earth–Moon Vertical Slice §5.4 sets the bar, and it is a specific one:
   gravity must be good enough that circular orbits stay circular, that
   station-relative motion is coherent, and that Earth–Moon transfers do
   not visibly contradict the ephemeris — *and* it must not be weakened
   just because the ship is powerful. It explicitly does not ask for a
   research-grade n-body integrator.

   So this is a documented, deliberately-chosen model rather than a general
   one. Four terms, each with a reason to be here:

     · Earth as a point mass — everything else is a correction to this;
     · Earth's J₂ oblateness — the equatorial bulge, which is the entire
       reason a low orbit's plane sweeps westward about 5° a day. Without
       it the station's orbit is subtly wrong in a way that shows up over a
       session rather than over a frame;
     · the Moon and the Sun as third bodies, each with its indirect term.

   That last part is the one that is easy to get wrong. The Earth-centred
   frame is **not inertial**: Earth is itself falling toward the Moon and
   the Sun. What perturbs the ship is therefore the *difference* between
   the pull on the ship and the pull on Earth, which is why each third-body
   term has two halves that very nearly cancel. Keep only the first half
   and you have not modelled the Moon's tug — you have accelerated the
   whole system sideways at 3×10⁻³ m/s², which is thirty thousand times
   larger than the real perturbation and points the wrong way.

   What is deliberately absent: higher geopotential terms (J₃, J₂₂ and the
   rest), atmospheric drag, solar radiation pressure, and relativistic
   corrections. At 420 km over one session none of them moves the ship far
   enough to see, and drag in particular would be a lie without a thermo-
   spheric density model that changes with solar activity. Ledger SF-L-017.
   ══════════════════════════════════════════════════════════════════════ */

import { K } from "../core/units.js";
import { v3 } from "../core/linalg.js";

const GM_E = K.GM_EARTH.value;
const J2 = K.EARTH_J2.value;
const RE = K.EARTH_RADIUS_EQ.value;

/**
 * Acceleration on a body at `r` in the Earth-centred inertial frame.
 *
 * @param {{x,y,z}} r            position, metres, ECI
 * @param {object}  [thirdBody]  {moon, sun} positions in ECI; omit to skip
 * @returns {{x,y,z}} m/s²
 */
export function gravityEci(r, thirdBody = null) {
  const r2 = r.x * r.x + r.y * r.y + r.z * r.z;
  const rMag = Math.sqrt(r2);

  // Inside the planet the point-mass law diverges. Nothing should ask, but
  // an integrator that has just been handed a bad state will, and returning
  // Infinity turns one bad frame into a permanently NaN ship.
  if (!(rMag > 1)) return v3();

  const inv3 = 1 / (r2 * rMag);

  /* ── Earth as a point mass ── */
  let ax = -GM_E * r.x * inv3;
  let ay = -GM_E * r.y * inv3;
  let az = -GM_E * r.z * inv3;

  /* ── J₂: the equatorial bulge ──
     The standard closed form. The z component differs from x and y by that
     3 rather than 1 because the bulge is a mass excess around the equator:
     it pulls a polar-orbiting satellite back toward the equator, and that
     torque on the orbit is what makes the node regress. */
  const zr = r.z / rMag;
  const k = 1.5 * J2 * GM_E * RE * RE * inv3 / r2;
  const common = 5 * zr * zr;
  ax += k * r.x * (common - 1);
  ay += k * r.y * (common - 1);
  az += k * r.z * (common - 3);

  /* ── third bodies ── */
  if (thirdBody) {
    if (thirdBody.moon) addThirdBody(thirdBody.moon, K.GM_MOON.value);
    if (thirdBody.sun) addThirdBody(thirdBody.sun, K.GM_SUN.value);
  }

  function addThirdBody(p, gm) {
    // Toward the body, from the ship.
    const dx = p.x - r.x, dy = p.y - r.y, dz = p.z - r.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    const d = Math.sqrt(d2);
    if (!(d > 1)) return;
    const dInv3 = 1 / (d2 * d);

    // And from Earth's centre — the indirect term. Earth is falling too.
    const b2 = p.x * p.x + p.y * p.y + p.z * p.z;
    const bInv3 = 1 / (b2 * Math.sqrt(b2));

    ax += gm * (dx * dInv3 - p.x * bInv3);
    ay += gm * (dy * dInv3 - p.y * bInv3);
    az += gm * (dz * dInv3 - p.z * bInv3);
  }

  return { x: ax, y: ay, z: az };
}

/**
 * Integrate a state through `dt` under gravity plus a constant applied
 * acceleration, by classical fourth-order Runge–Kutta.
 *
 * RK4 rather than the symplectic leapfrog you would normally reach for in
 * orbital work, for one reason: leapfrog's energy conservation is a
 * property of *conservative* forces, and the ship's engines are not one.
 * The moment a thruster fires the guarantee is gone, and what is left is
 * the second-order accuracy — which at station-keeping scales is worse than
 * RK4's fourth-order. Over a session at a sixtieth of a second, RK4's
 * secular drift on a circular orbit is far below a metre.
 *
 * `applied` is an acceleration, not a force, because the ship's mass never
 * changes: there is no propellant to burn (slice §6.1, unlimited energy),
 * so thrust is most honestly expressed as the acceleration it produces.
 *
 * @param {{position:{x,y,z}, velocity:{x,y,z}}} state
 * @param {number} dt seconds
 * @param {{x,y,z}} applied m/s², constant across the step
 * @param {object|null} thirdBody {moon, sun} ECI positions, held fixed
 *   across the step — they move a few metres in a frame, which is nothing
 *   against a 4×10⁸ m baseline
 * @returns {{position:{x,y,z}, velocity:{x,y,z}}} a new state
 */
export function integrate(state, dt, applied = v3(), thirdBody = null) {
  const { position: r0, velocity: v0 } = state;

  const accel = (r) => {
    const g = gravityEci(r, thirdBody);
    return { x: g.x + applied.x, y: g.y + applied.y, z: g.z + applied.z };
  };

  const k1v = accel(r0);
  const k1r = v0;

  const r2 = axpy(r0, k1r, dt / 2);
  const v2 = axpy(v0, k1v, dt / 2);
  const k2v = accel(r2);
  const k2r = v2;

  const r3 = axpy(r0, k2r, dt / 2);
  const v3_ = axpy(v0, k2v, dt / 2);
  const k3v = accel(r3);
  const k3r = v3_;

  const r4 = axpy(r0, k3r, dt);
  const v4 = axpy(v0, k3v, dt);
  const k4v = accel(r4);
  const k4r = v4;

  const w = dt / 6;
  return {
    position: {
      x: r0.x + w * (k1r.x + 2 * k2r.x + 2 * k3r.x + k4r.x),
      y: r0.y + w * (k1r.y + 2 * k2r.y + 2 * k3r.y + k4r.y),
      z: r0.z + w * (k1r.z + 2 * k2r.z + 2 * k3r.z + k4r.z),
    },
    velocity: {
      x: v0.x + w * (k1v.x + 2 * k2v.x + 2 * k3v.x + k4v.x),
      y: v0.y + w * (k1v.y + 2 * k2v.y + 2 * k3v.y + k4v.y),
      z: v0.z + w * (k1v.z + 2 * k2v.z + 2 * k3v.z + k4v.z),
    },
  };
}

const axpy = (a, b, s) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });

/**
 * Speed of a circular orbit at radius `r`, and its period. Used to place
 * things, and by the tests that check the integrator has not quietly
 * changed what a circular orbit means.
 */
export const circularSpeed = (r) => Math.sqrt(GM_E / r);
export const circularPeriod = (r) => 2 * Math.PI * Math.sqrt((r * r * r) / GM_E);

/**
 * Classical orbital elements from a state vector, for the HUD and for the
 * tests. Only the ones the slice needs: an orbit that is "stable" has to be
 * stable in something measurable, and that something is a and e.
 */
export function elements(position, velocity) {
  const r = Math.hypot(position.x, position.y, position.z);
  const v = Math.hypot(velocity.x, velocity.y, velocity.z);

  // Vis-viva, rearranged: the semi-major axis follows from speed and radius
  // alone, with no reference to where the orbit is pointing.
  const energy = (v * v) / 2 - GM_E / r;
  const a = -GM_E / (2 * energy);

  const hx = position.y * velocity.z - position.z * velocity.y;
  const hy = position.z * velocity.x - position.x * velocity.z;
  const hz = position.x * velocity.y - position.y * velocity.x;
  const h = Math.hypot(hx, hy, hz);

  // e² = 1 + 2εh²/µ². Clamped at zero because a perfectly circular orbit
  // lands on a tiny negative value through floating point, and Math.sqrt
  // of that is NaN — which then poisons every readout downstream.
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (GM_E * GM_E)));

  return {
    semiMajorAxis: a,
    eccentricity: e,
    inclinationRad: Math.acos(Math.max(-1, Math.min(1, hz / h))),
    periapsis: a * (1 - e),
    apoapsis: a * (1 + e),
    specificEnergy: energy,
    angularMomentum: h,
    /** Orbital period, seconds. Meaningless (and negative) on an escape trajectory. */
    period: a > 0 ? 2 * Math.PI * Math.sqrt((a * a * a) / GM_E) : null,
  };
}
