/* ══════════════════════════════════════════════════════════════════════
   ship.js — where the ship is, which way it is facing, and how hard it can
   push. Nothing about *intent* lives here; that is the flight model's job.

   Two conventions, both load-bearing:

   **Body axes.** +x right, +y up, and the nose along **−z** — the same
   convention the camera uses, so "forward" means one thing in this project
   rather than two. Attitude is stored as a quaternion taking body-axis
   vectors into the Earth-centred frame.

   **Thrust is an acceleration.** The slice gives the ship unlimited
   operational energy and no propellant (§6.1), so mass would be a number
   that only ever appears in F = ma and cancels straight back out. Stating
   the acceleration directly means the one figure the player can feel is
   the one written in the code.

   The ship does not know what a control is, what assisted mode means, or
   that a station exists. Hand it an acceleration and an angular
   acceleration and it will tell you where that puts it.
   ══════════════════════════════════════════════════════════════════════ */

import {
  v3, add, sub, scale, length, normalize, dot, cross,
  quat, quatMultiply, quatNormalize, quatRotate, quatConjugate,
  quatFromAxisAngle, quatIntegrate, quatForward, quatUp, quatRight,
} from "../core/linalg.js";
import { integrate, elements } from "./gravity.js";

/**
 * What the ship can do, in the units the player would feel.
 *
 * These are capability figures, not tuning dials with no meaning. The
 * translational number is the one that has to be defensible: 30 m/s² is
 * about 3 g, which is enough to hover anywhere in the slice (Earth's
 * surface gravity is 9.8, the Moon's 1.62), enough to change a low-orbit
 * velocity meaningfully in seconds, and low enough that the ship still
 * feels like it has mass. Anything much higher and station-keeping becomes
 * impossible to fly, because every tap overshoots.
 *
 * The precision factor is the answer to that problem rather than a
 * separate mode with separate physics: same ship, same engines, a fortieth
 * of the authority, so a tap is centimetres per second (§6.4).
 */
export const SHIP = {
  /** Maximum translational acceleration, m/s², along any body axis. */
  maxAcceleration: 30,
  /**
   * Maximum angular acceleration, rad/s². About 570°/s².
   *
   * Large on purpose. Ric's brief is a ship out of a film — "super easy to
   * control" — and the thing that makes a ship feel heavy and vague is not
   * its top turn rate, it is how long it takes to *reach* it. At 10 rad/s²
   * the ship is at full rate in a quarter of a second, so the nose goes
   * where the mouse goes and stops when the mouse stops.
   *
   * The ship is fiction anyway (ledger SF-L-018); what it may not do is
   * bend the world around it, and it does not.
   */
  maxAngularAccel: 10.0,
  /** Rate limit in assisted flight, rad/s. About 143°/s — a whole turn in 2.5 s. */
  maxAngularRate: 2.5,
  /**
   * How much of both is left in precision mode. A fortieth: full authority
   * is 30 m/s², precision is 0.75, and a tenth-of-a-second tap is then
   * 7.5 cm/s — the scale §6.4 asks for.
   */
  precisionFactor: 1 / 40,
  /**
   * How hard assisted flight closes on the velocity the stick asks for,
   * per second.
   *
   * 8 is a settling time of an eighth of a second — quick enough that a tap
   * of a translation key reads as a nudge rather than as a drift that starts
   * later, which is the translational half of "floaty".
   *
   * It lives on the ship rather than in `flight-model.js` because the
   * governor in `modes.js` has to know it too. A permitted speed is only
   * safe if the loop that flies it can shed that speed in the room
   * available, and the loop's lag is 1/gain seconds no matter how much
   * thrust the mode has. Two files, one number, no drift.
   */
  velocityGain: 8.0,
  /**
   * The ship's own size, metres. Used for collision and for the proximity
   * envelope; it is not a render dimension.
   */
  radius: 12,
};

export class Ship {
  /**
   * @param {object} init
   * @param {{x,y,z}} init.position  ECI, metres
   * @param {{x,y,z}} init.velocity  ECI, m/s
   * @param {object}  [init.attitude] quaternion, body → ECI
   */
  constructor({ position, velocity, attitude = quat() }) {
    this.position = { ...position };
    this.velocity = { ...velocity };
    this.attitude = quatNormalize(attitude);
    /** Angular velocity in **body** axes, rad/s. */
    this.angularVelocity = v3();

    /** Acceleration actually applied last step, ECI — for the HUD's g meter. */
    this.appliedAccel = v3();
    /** Total simulated seconds this ship has existed. */
    this.elapsed = 0;
  }

  /* ── body axes, in the Earth-centred frame ─────────────────────────── */

  get forward() { return quatForward(this.attitude); }
  get up() { return quatUp(this.attitude); }
  get right() { return quatRight(this.attitude); }

  /** Take a vector expressed in body axes into ECI. */
  toEci(vBody) { return quatRotate(this.attitude, vBody); }

  /** Take an ECI vector into body axes. */
  toBody(vEci) { return quatRotate(quatConjugate(this.attitude), vEci); }

  /* ── the step ──────────────────────────────────────────────────────── */

  /**
   * Advance by `dt` seconds.
   *
   * @param {number} dt
   * @param {object} cmd
   * @param {{x,y,z}} [cmd.accelEci]          applied acceleration, ECI, m/s²
   * @param {{x,y,z}} [cmd.angularAccelBody]  applied angular acceleration, body axes
   * @param {object}  [cmd.thirdBody]         {moon, sun} ECI positions
   */
  step(dt, { accelEci = v3(), angularAccelBody = v3(), thirdBody = null } = {}) {
    if (!(dt > 0)) return this;

    /* Attitude first, and deliberately so: the translation below uses the
       acceleration the flight model computed from the attitude at the
       *start* of the step, which is the attitude the player was looking
       along when they pressed the key. Rotating first and then thrusting
       along the new attitude would apply thrust in a direction the player
       never commanded — a small lie at 60 fps and a very visible one at 20. */
    this.angularVelocity = add(this.angularVelocity, scale(angularAccelBody, dt));
    const rate = length(this.angularVelocity);
    if (rate > SHIP.maxAngularRate) {
      this.angularVelocity = scale(this.angularVelocity, SHIP.maxAngularRate / rate);
    }
    this.attitude = quatIntegrate(this.attitude, this.angularVelocity, dt);

    const next = integrate(this, dt, accelEci, thirdBody);
    this.position = next.position;
    this.velocity = next.velocity;

    this.appliedAccel = accelEci;
    this.elapsed += dt;
    return this;
  }

  /* ── what the ship knows about itself ──────────────────────────────── */

  get speed() { return length(this.velocity); }

  /** Orbital elements of the current state — see gravity.js. */
  get elements() { return elements(this.position, this.velocity); }

  /**
   * State relative to another object, in the frame that object defines.
   * Returns the pair that matters for proximity work and nothing else:
   * how far away it is, and how fast the gap is changing.
   *
   * Closing rate is positive when the gap is shrinking, which is the sign
   * convention every HUD in the project uses.
   */
  relativeTo(other) {
    const offset = sub(other.position, this.position);
    const range = length(offset);
    const direction = range > 0 ? scale(offset, 1 / range) : v3();
    const relVelocity = sub(other.velocity, this.velocity);
    return {
      offset,
      range,
      direction,
      relVelocity,
      relativeSpeed: length(relVelocity),
      closingRate: -dot(relVelocity, direction),
    };
  }

  /**
   * A snapshot the presentation layer may keep. The renderer must never
   * hold a reference to the live ship — it would then be reading half-
   * stepped state — so this is a copy, every frame, on purpose.
   */
  snapshot() {
    return {
      position: { ...this.position },
      velocity: { ...this.velocity },
      attitude: { ...this.attitude },
      angularVelocity: { ...this.angularVelocity },
      speed: this.speed,
    };
  }
}

/* ══════════════════════════════════════════════════════════════════════
   Attitude helpers the flight model and the autopilot both need.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * The rate to turn at when there is `error` radians left to go.
 *
 * A proportional-derivative controller is the obvious answer here and it
 * is the wrong one. Critically damped, it settles as v₀·t·e^(−ωt), which
 * for a ship arrested from a full-rate slew means six seconds of visible
 * creep before the nose is actually still — and "still" is the one thing
 * attitude hold is for.
 *
 * So the profile is the near-time-optimal one instead: approach at the
 * fastest rate from which the remaining authority can still stop you,
 * which is √(2aθ). That is the same calculation as the stopping distance
 * on the translation side, and for the same reason. The 0.9 keeps it just
 * inside what the ship can actually do, so it decelerates into the target
 * rather than discovering at the last moment that it cannot.
 */
function arrivalRate(error, authority, maxRate) {
  return Math.min(maxRate, 0.9 * Math.sqrt(2 * authority * Math.abs(error))) * Math.sign(error);
}

/** How hard the inner rate loop chases the rate the profile asked for. */
const RATE_LOOP_TAU = 0.12;

/**
 * Angular acceleration that turns `attitude` toward pointing its nose
 * along `targetEci`.
 *
 * @param {object}  attitude   quaternion, body → ECI
 * @param {{x,y,z}} omegaBody  current angular velocity, body axes
 * @param {{x,y,z}} targetEci  unit vector the nose should point along
 * @param {number}  authority  rad/s² available
 * @param {number}  [maxRate]  rad/s the ship is allowed to reach
 * @returns {{x,y,z}} angular acceleration, body axes
 */
export function pointAt(attitude, omegaBody, targetEci, authority, maxRate = SHIP.maxAngularRate) {
  const targetBody = quatRotate(quatConjugate(attitude), targetEci);
  const nose = { x: 0, y: 0, z: -1 };

  // Rotation axis, in body axes, and how far there is to go.
  const axis = cross(nose, targetBody);
  const sin = length(axis);
  const cos = dot(nose, targetBody);
  const angle = Math.atan2(sin, cos);

  let wantedOmega;
  if (sin < 1e-9) {
    // Already aligned, or exactly reversed. Reversed needs *some* axis to
    // turn about; pitch is as good as any and matches what a pilot does.
    wantedOmega = cos > 0 ? v3() : { x: arrivalRate(angle, authority, maxRate), y: 0, z: 0 };
  } else {
    wantedOmega = scale(axis, arrivalRate(angle, authority, maxRate) / sin);
  }

  // Only the pitch and yaw components: roll is levelTo's job, and having
  // both controllers drive the same axis double-damps it.
  const err = {
    x: wantedOmega.x - omegaBody.x,
    y: wantedOmega.y - omegaBody.y,
    z: 0,
  };
  return scale(err, 1 / RATE_LOOP_TAU);
}

/**
 * Roll the ship so its "up" lies as close as possible to `upEci`, without
 * disturbing where the nose points. Used by attitude hold so that holding
 * still does not slowly wind the horizon over.
 */
export function levelTo(attitude, omegaBody, upEci, authority, maxRate = SHIP.maxAngularRate) {
  const nose = quatForward(attitude);
  // The component of the wanted up that is perpendicular to the nose: you
  // cannot roll toward something you are pointing at.
  const wanted = sub(upEci, scale(nose, dot(upEci, nose)));
  if (length(wanted) < 1e-6) return v3();

  const currentUp = quatUp(attitude);
  const target = normalize(wanted);
  const angle = Math.atan2(dot(cross(currentUp, target), nose), dot(currentUp, target));

  // Roll is about the nose, which in body axes is −z, hence the sign.
  const wantedRoll = -arrivalRate(angle, authority, maxRate);
  return { x: 0, y: 0, z: (wantedRoll - omegaBody.z) / RATE_LOOP_TAU };
}

export { quatFromAxisAngle, quatMultiply };
