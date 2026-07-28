/* ══════════════════════════════════════════════════════════════════════
   flight-model.js — intent in, thrust out.

   Controls §1 is the reason this file is shaped the way it is. Ric's
   verdict on the prototype was "the controls suck", and the diagnosis was
   specific: rotation on digital arrow keys, no pointer input, and a gear
   lever that made the player choose a *regime* instead of flying a
   *speed*. So the contract here is a normalised command — analog where the
   real quantity is analog — and every device adapter produces one.

   ── One ship ───────────────────────────────────────────────────────────

   There used to be two flight modes here, assisted and direct, toggled on
   N. There is now one, and the reason is worth recording because it is the
   clearest example in the project of a feature that cost more than it paid.

   Direct mode closed no loop: the stick was the throttle on a thruster, so
   it had no cruise speed to hold, no drive spool, and no proximity
   governor. Every one of those lives in the assisted path. That made it a
   second, quietly worse ship wearing the same hull — and on 2026-07-28 Ric
   found it the hard way. His saved settings had him in direct without his
   knowing (the clean HUD preset does not show which mode you are in), so
   selecting Intergalactic and holding W accelerated him at a flat 10⁶ m/s²
   toward a top speed that is 150 million years away at that rate. His
   report was "it's taking forever to even reach light speed". It was.

   The brief this fails is Ric's own, given the same day: the ship should be
   **"extremely easy to fly"** and one you **"barely think about"**. A
   hidden toggle that silently removes the throttle, the drive and the
   safety governor is the exact opposite of that, and no amount of fixing
   direct mode would have made two ships easier to fly than one.

   So: **the stick asks for a velocity relative to the current reference
   frame and the controller supplies whatever acceleration achieves it**,
   including the acceleration needed to stand still in a frame that is
   orbiting. Release and it holds. This is not a lie about physics — every
   newton of it is thrust the ship really applies, and the HUD shows it.
   Assistance is not autopilot: the player is flying.

   Be straight about what this costs, because it is a real thing and not
   nothing: **true Newtonian coasting is gone.** Wind the throttle to zero
   and the ship does not drift on, it closes on rest in the current
   reference frame. Releasing W holds your cruise — that is Ric's rule and
   it is intact — but there is no longer any way to fly a pure ballistic
   arc by hand. What survives is every honest *readout*: felt g, relative
   velocity and its frame, stopping distance. The ship still tells you the
   truth about the physics; it just will not make you fly it.

   One rule from Controls §6 governs everything below and is worth stating
   before the code: **releasing a control never produces a surprise, and
   changing travel mode never changes your velocity.** There is a test for
   the second one, because it is the kind of thing that breaks silently.
   ══════════════════════════════════════════════════════════════════════ */

import {
  v3, add, sub, scale, length, normalize, dot, cross,
  quatRotate, quatConjugate,
} from "../core/linalg.js";
import { SHIP, pointAt, levelTo } from "./ship.js";
/* The one formatter. There used to be a private copy here, and it was the
   *better* of the two — it knew about ly/s while the HUD's did not — which
   is exactly how the glass ended up printing `15778749177182.425781 c`. */
import { formatSpeed } from "../core/units.js";
import {
  modeById, governedSpeed, canStopInstantly, brakingAuthority, DEFAULT_MODE,
} from "./modes.js";
import {
  relativeVelocity, stoppingSolution, safeStopObstruction, restVelocity,
} from "./flight-computer.js";

/**
 * The neutral command. Every adapter fills this in; nothing downstream
 * ever sees a keyboard, a touch, or a gamepad.
 *
 * Translation and rotation are in **body axes** and run −1…1. Forward is
 * +z here even though the nose is −z, because "push forward, go forward"
 * is what a control means and the sign flip belongs in one place.
 */
export const NEUTRAL_COMMAND = Object.freeze({
  translate: Object.freeze({ x: 0, y: 0, z: 0 }),  // right, up, forward
  rotate: Object.freeze({ pitch: 0, yaw: 0, roll: 0 }),
  precision: false,
});


/**
 * How fast the rate loop closes on the rate the stick is asking for.
 *
 * 60 ms. Any slower and the ship trails the mouse — the single thing that
 * makes a control feel "floaty", and the thing Controls §6 calls input lag
 * and declares a bug rather than a tuning value. Any faster and it chatters
 * against the frame rate on a slow device.
 */
const RATE_TAU = 0.06;

/**
 * How hard assisted flight closes on the velocity the stick is asking for,
 * per second. Defined on the ship, because the governor has to size its
 * limits against the same number — see `SHIP.velocityGain`.
 */
const VELOCITY_GAIN = SHIP.velocityGain;

/** Below this, the ship counts as having stopped turning. About 0.1°/s. */
const SETTLED_RATE = 0.002;

/**
 * The speed a sideways nudge asks for when the ship is stopped.
 *
 * Strafing has no throttle of its own — it is trim, not travel — so when
 * the cruise is zero it needs some speed to mean. A quarter of the dial:
 * the old resting throttle, which is a metre or so a second in Local and
 * therefore exactly a nudge.
 */
const TRIM_THROTTLE = 0.25;

/**
 * Speed the stick asks for at full deflection, given the throttle.
 *
 * Controls §2.4 replaces the prototype's six gears with a continuous
 * throttle, and warns that this is the single biggest feel question in the
 * project. The curve matters more than the endpoints: linear throttle
 * gives you a millimetre of travel between "station-keeping" and "gone",
 * so this is exponential — equal turns of the dial are equal *ratios* of
 * speed, which is how every other control for a quantity spanning five
 * decades works.
 *
 * 1 cm/s at the bottom and the selected mode's top speed at the top; in
 * precision mode the whole range shifts down by the same factor the thrust
 * does.
 *
 * The ceiling is the mode's rather than a constant because that is what a
 * mode *is* (Controls §2.4): the throttle flies the speed inside the mode
 * you picked, so one dial covers centimetres per second beside a truss and
 * light-years per second between galaxies without ever having to be
 * precise about both at once.
 */
export function targetSpeed(throttle, precision = false, mode = modeById(DEFAULT_MODE)) {
  const t = Math.max(0, Math.min(1, throttle));
  /* Zero means zero. The curve is exponential and so has no bottom of its
     own — it approaches 1 cm/s and never reaches nothing — which was
     harmless while the throttle only took effect under a deflected stick,
     and is not harmless now that it is a speed the ship holds on its own.
     Without this the ship creeps forward at a centimetre a second forever
     and "stopped" is never quite true. */
  if (t <= 0) return 0;
  const lo = 0.01, hi = mode.topSpeed;
  const speed = lo * Math.pow(hi / lo, t);
  return precision ? speed * SHIP.precisionFactor : speed;
}

export class FlightModel {
  constructor() {
    this.precision = false;
    /**
     * The speed the ship holds, 0…1 on the mode's own scale.
     *
     * This model owns it. W and S move it, releasing them leaves it alone,
     * and every assist puts it back to zero — a ship that resumes its old
     * cruise the instant an automatic stop finishes has not stopped.
     */
    this.throttle = 0;

    /**
     * An assist action in progress: null, "stop", "match" or "hold".
     *
     * These are the emergency and convenience commands §6.3 keeps always
     * available. Any manual input cancels them immediately, which is
     * §7.4's interruption rule applied one level down.
     */
    this.assist = null;
    /** Set when the assist finished on its own, for the HUD to announce. */
    this.assistResult = null;
    /** Travel mode 1–5 (Controls §2.4) — the only "mode" the ship has now. */
    this.travelMode = DEFAULT_MODE;
    /** Why the ship is being held below the throttle, or null. */
    this.governorNote = null;

    /**
     * The player has been warned and has chosen to continue.
     *
     * §6.2's last bullet: no silent course correction after the player
     * explicitly overrides safety. Once this is set, predictive braking
     * stops touching the controls — the ship will let you hit the station.
     * It clears the moment the danger is gone, so it is a decision about
     * *this* approach and not a setting.
     */
    this.safetyOverridden = false;

    /** Attitude the ship holds when rotation is released. */
    this._holdAttitude = null;
  }

  /**
   * What the HUD calls the ship's current flight state.
   *
   * This used to read "assisted" or "direct" and is now the travel mode's
   * own name, which is the only mode there is — and is the thing a player
   * actually needs on the glass. "Interstellar" tells you what the next
   * press of W will do; "assisted" never did.
   */
  get label() { return modeById(this.travelMode).name; }

  /**
   * Select a travel mode, 1–5.
   *
   * Ric's standing rule, and the one thing this method must never violate:
   * **a mode is an acceleration, not a speed.** Nothing here touches the
   * ship — no velocity is changed, nothing is clamped retroactively. You
   * keep whatever you were doing and get a different engine to do the next
   * thing with.
   */
  setTravelMode(id) {
    this.travelMode = modeById(id).id;
    return this.travelMode;
  }

  /** The selected travel mode's full record. */
  get travel() { return modeById(this.travelMode); }

  /**
   * Stop, now, by cancelling the ship's velocity outright.
   *
   * Ric, 2026-07-26: **"you should be able to stop instantly if you want"**
   * — and then, immediately: **"instant stop should only be a thing on
   * 2-6."** Both halves matter. Local keeps its honest brake because that
   * is the mode where braking is the flying; every mode above it gets a
   * stop that actually stops.
   *
   * This is fiction and it is declared as fiction (ledger SF-L-019). What
   * it is *not* is a loophole in the frame discipline: stopping is still
   * meaningless without saying what you are stopping relative to, so this
   * sets the ship to the velocity of a body at rest in the current
   * reference frame — ω × r and all — rather than to zero. Zeroing the ECI
   * velocity beside the station would leave you falling out of orbit at
   * 7.66 km/s relative to the thing you were trying to stop beside, which
   * is the opposite of stopping.
   *
   * @returns {string|null} the reason it could not run, or null on success
   */
  instantStop(ship, reference) {
    const travel = modeById(this.travelMode);
    if (!canStopInstantly(travel)) {
      return `${travel.name} brakes for real — hold the stop, or change mode.`;
    }
    ship.velocity = restVelocity(ship, reference);
    this.throttle = 0;
    this.assist = null;
    this.assistResult = { action: "stop", ok: true, reason: `stopped — ${reference.label}` };
    return null;
  }

  /** Begin an assist action. Returns the reason it cannot run, or null. */
  request(action, situation) {
    if (action === "stop" || action === "hold") {
      const why = safeStopObstruction(situation);
      if (why) { this.assistResult = { action, ok: false, reason: why }; return why; }
    }
    /* Every assist ends with the ship where the player asked it to be, so
       every assist has to put the throttle back to zero first. Now that the
       throttle is a speed the ship *holds*, an assist that stops the ship
       while the dial still reads 40 m/s finishes and is immediately undone
       by the thing that asked for it. */
    this.throttle = 0;
    this.assist = action;
    this.assistResult = null;
    return null;
  }

  cancelAssist(reason = "manual input") {
    if (this.assist) this.assistResult = { action: this.assist, ok: false, reason };
    this.assist = null;
  }

  /**
   * One control step.
   *
   * @param {object} args
   * @param {import('./ship.js').Ship} args.ship
   * @param {object} args.command    a NEUTRAL_COMMAND-shaped object
   * @param {object} args.reference  the frame assisted flight flies in
   * @param {object} args.situation  from flight-computer.assess()
   * @param {object} [args.target]   selected target, for match-velocity
   * @returns {{accelEci:{x,y,z}, angularAccelBody:{x,y,z}, note:string|null}}
   */
  update({ ship, command, reference, situation, target = null }) {
    this.precision = !!command.precision;
    const travel = modeById(this.travelMode);
    const authority = travel.authority * (this.precision ? SHIP.precisionFactor : 1);
    const angularAuthority = SHIP.maxAngularAccel * (this.precision ? 0.25 : 1);

    const rotating =
      Math.abs(command.rotate.pitch) + Math.abs(command.rotate.yaw) + Math.abs(command.rotate.roll) > 1e-4;
    const translating =
      Math.abs(command.translate.x) + Math.abs(command.translate.y) + Math.abs(command.translate.z) > 1e-4;

    // Any manual input ends an assist. This is the interruption rule, and
    // it has to be unconditional: a player reaching for the stick during an
    // automatic stop is not asking to be argued with.
    if (this.assist && (rotating || translating)) this.cancelAssist();

    const angularAccelBody = this._rotation(ship, command, angularAuthority, rotating);
    const { accelEci, note } = this._translation({
      ship, command, reference, situation, target, authority, travel,
    });

    return { accelEci, angularAccelBody, note };
  }

  /* ── rotation ──────────────────────────────────────────────────────── */

  /**
   * Rotation.
   *
   * Body axes: pitch about +x, yaw about +y, roll about −z (the nose).
   * The command convention is the one a pilot would assume and the only
   * one worth having: **positive pitch is nose up, positive yaw is nose
   * right, positive roll banks right.** Both negations below are that
   * convention meeting the right-hand rule, and both were wrong once.
   *
   * **The stick commands a rotation rate.** Push it and the ship turns at
   * that rate; let go and it stops. This is not how a spacecraft works and
   * it is exactly how every ship in every film works, which is the point:
   * this is for flying, not for teaching. The inner loop closes on rate in
   * 60 ms, so the ship goes where the mouse goes with no perceptible lag.
   *
   * Commanding **torque** instead was the original mistake and it produced
   * all three of Ric's complaints at once: the ship kept accelerating its
   * spin while the mouse moved (floaty), it coasted on after the mouse
   * stopped, and then an attitude-hold that had captured a target
   * mid-swing dragged the nose *back the other way*. A rate command has
   * none of those failure modes. Direct mode used to keep the torque
   * version and went with the mode on 2026-07-28.
   */
  _rotation(ship, command, authority, rotating) {
    const r = command.rotate;

    if (rotating) {
      this._holdAttitude = null;
      const wanted = {
        x: r.pitch * SHIP.maxAngularRate,
        y: -r.yaw * SHIP.maxAngularRate,
        z: -r.roll * SHIP.maxAngularRate,
      };
      return clampMagnitude(scale(sub(wanted, ship.angularVelocity), 1 / RATE_TAU), authority);
    }

    /* Released. Stop the rotation *where it is* — never rewind it.
​
       Attitude hold engages only once the ship has actually settled, and
       holds from wherever that turned out to be. Capturing a target on the
       first quiet frame instead, while the ship still had a radian a
       second on it, meant the controller had to overshoot and come back:
       the player let go and watched the view swing past and return. That
       is the "it pulls back the other way" fault, and it was a bug in this
       function rather than anything to do with physics. */
    const spin = length(ship.angularVelocity);
    if (spin > SETTLED_RATE) {
      this._holdAttitude = null;
      return clampMagnitude(scale(ship.angularVelocity, -1 / RATE_TAU), authority);
    }

    // Settled: hold this attitude, so the nose does not creep over a long
    // hold. There is nothing to swing back to — this *is* where it stopped.
    if (!this._holdAttitude) this._holdAttitude = { ...ship.attitude };
    const wantedNose = quatRotate(this._holdAttitude, { x: 0, y: 0, z: -1 });
    const wantedUp = quatRotate(this._holdAttitude, { x: 0, y: 1, z: 0 });

    const point = pointAt(ship.attitude, ship.angularVelocity, wantedNose, authority);
    const level = levelTo(ship.attitude, ship.angularVelocity, wantedUp, authority);
    return clampMagnitude(add(point, level), authority);
  }

  /* ── translation ───────────────────────────────────────────────────── */

  _translation({ ship, command, reference, situation, target, authority, travel }) {
    /* ── assist actions ── */
    if (this.assist) {
      const done = this._assistStep({ ship, reference, target, authority, situation });
      if (done) return done;
    }

    /* ── close the loop on velocity in the reference frame ──
       Standing still in an orbiting frame is not free — it takes real and
       continuously varying thrust, because the frame is accelerating. The
       controller does not need to know that: it sees a velocity error and
       cancels it, and the gravity gradient falls out for free. That is
       what §6.2 means by "automatic gravity compensation" and why hover
       and station-keeping are the same code. */
    let speed = targetSpeed(this.throttle, this.precision, travel);

    /* ── the proximity governor ─────────────────────────────────────────
       "If you get close to it it needs to slow you down intentionally."
       — Ric, 2026-07-26.

       The rule is in modes.js and it is one line: you may fly as fast as
       you could still stop from. Applied here it means the throttle asks
       for the mode's speed and gets whatever the surroundings allow, so
       selecting Interstellar beside the station is harmless — it is
       absurd, not lethal, which is what Ric's standing rule (changing mode
       must never kill you) requires.

       Note it caps the *commanded* speed and nothing else. It never
       steers, never adds thrust, and never touches the velocity you
       already have: drop from Interstellar to Local at a thousand km/s and
       you keep the thousand km/s, exactly as the rule says. */
    this.governorNote = null;
    if (situation?.clearance !== undefined && situation.clearance !== null) {
      const allowed = governedSpeed(travel, situation.clearance);
      if (allowed < speed) {
        speed = allowed;
        this.governorNote = `${travel.name} held to ${formatSpeed(allowed)} — ` +
          `${formatSpeed(allowed)} is what you can stop from here`;
      }
    }

    /* ── the commanded velocity ──────────────────────────────────────────
       Ric, 2026-07-28: "when you release W it needs to keep going that
       speed and only slow down with S. and instantly stop with X."

       So forward is not a stick deflection any more, it is a **speed the
       ship holds**. The throttle is that speed; W raises it, S lowers it,
       releasing both changes nothing, and X puts it back to zero. The old
       model read the deflection directly, which meant letting go of W
       commanded zero and the ship braked itself to a halt — correct for a
       docking thruster and wrong for flying anywhere.

       And the commanded velocity points **where the nose points**, so
       turning the ship turns where it is going. That is not how a
       spacecraft works and it is how every ship in every film works, which
       is the same trade the rotation loop already makes.

       Lateral and vertical stay momentary: they are trim against whatever
       you are flying beside, and a strafe you have to remember to cancel is
       a strafe that drifts you into the truss. */
    const nose = ship.toEci({ x: 0, y: 0, z: -1 });
    let wantEci = speed > 0 ? scale(nose, speed) : v3();

    const trimBody = { x: command.translate.x, y: command.translate.y, z: 0 };
    const trim = length(trimBody);
    if (trim > 0) {
      const trimSpeed = speed > 0 ? speed : targetSpeed(TRIM_THROTTLE, this.precision, travel);
      wantEci = add(wantEci, scale(ship.toEci(scale(trimBody, 1 / trim)), trimSpeed * Math.min(1, trim)));
    }

    let note = null;

    /* Predictive braking (§6.2). Only ever *reduces* the commanded speed,
       and only toward whatever you are about to hit — it cannot steer, it
       cannot add thrust, and it does nothing at all once the player has
       overridden safety. */
    const prox = situation.proximity;
    if (prox && !this.safetyOverridden && prox.range > 0) {
      const toward = normalize(sub(reference.position, ship.position));
      const closing = dot(wantEci, toward);
      if (closing > prox.safeClosingRate) {
        wantEci = add(sub(wantEci, scale(toward, closing)), scale(toward, prox.safeClosingRate));
        note = `braking assist — ${prox.safeClosingRate.toFixed(2)} m/s at this range`;
      }
    }

    const relVel = relativeVelocity(ship, reference);
    const error = sub(wantEci, relVel);

    /* How hard the drive may push to close that error.
​
       Normally `authority` — the mode's real acceleration. But in the modes
       with a spool time the drive reaches whatever speed was asked for in a
       fixed *time* rather than at a fixed acceleration, so the ceiling is
       whatever that requires: speed ÷ spool. Without this, mode 4's top
       speed was 87 years of acceleration away and mode 5's was 150 million,
       which is why "it speeds up slowly" was an understatement.
​
       It only ever *raises* the ceiling, and only for gaining speed toward
       what the governor already allows — the governor's own limit is
       computed from `authority` and is untouched, so approaching a world
       still sheds speed exactly as it did. Ledger SF-L-024. */
    const ceiling = brakingAuthority(travel, this.precision);

    /* Proportional, with the gain set so the loop settles in about a
       quarter of a second at full authority. Higher and it chatters
       against the frame rate; lower and the ship feels like it is being
       flown through treacle, which is exactly the complaint the whole
       controls document exists to answer. */
    const accel = clampMagnitude(scale(error, VELOCITY_GAIN), ceiling);
    return { accelEci: accel, note };
  }

  /* ── the assist actions ────────────────────────────────────────────── */

  _assistStep({ ship, reference, target, authority, situation }) {
    // Every assist is the same controller with a different target velocity;
    // what differs is which frame that velocity is quoted in.
    let wanted = null;
    let label = null;

    if (this.assist === "stop" || this.assist === "hold") {
      wanted = v3();
      label = reference.label;
    } else if (this.assist === "match") {
      if (!target) { this.cancelAssist("no target selected"); return null; }
      // Match the *target's* motion, which may not be the reference frame's.
      const rel = sub(target.velocity, ship.velocity);
      const accel = clampMagnitude(scale(rel, VELOCITY_GAIN), SHIP.maxAcceleration);
      if (length(rel) < 0.01) {
        this.assist = null;
        this.assistResult = { action: "match", ok: true, reason: `matched ${target.label}` };
        return { accelEci: v3(), note: null };
      }
      return { accelEci: accel, note: `matching velocity with ${target.label}` };
    }

    const relVel = relativeVelocity(ship, reference);
    const speed = length(relVel);

    // "Hold" keeps running and keeps correcting; "stop" is finished the
    // moment it has stopped, and hands control back rather than quietly
    // becoming a position lock the player did not ask for.
    if (this.assist === "stop" && speed < 0.01) {
      this.assist = null;
      this.assistResult = { action: "stop", ok: true, reason: `at rest — ${reference.label}` };
      return { accelEci: v3(), note: null };
    }

    const accel = clampMagnitude(scale(sub(wanted, relVel), VELOCITY_GAIN), SHIP.maxAcceleration);
    const stop = stoppingSolution(speed, SHIP.maxAcceleration);
    return {
      accelEci: accel,
      note: this.assist === "hold"
        ? `holding position — ${label}`
        : `stopping relative to ${label} — ${stop.time.toFixed(1)} s, ${stop.distance.toFixed(0)} m`,
    };
  }
}

/** Clamp a vector's length without changing its direction. */
function clampMagnitude(vec, max) {
  const L = length(vec);
  return L > max && L > 0 ? scale(vec, max / L) : vec;
}

export { clampMagnitude };

