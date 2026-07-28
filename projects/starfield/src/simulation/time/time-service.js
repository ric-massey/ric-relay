/* ══════════════════════════════════════════════════════════════════════
   time-service.js — the one authority on "when".

   Technical Architecture §5. Nothing else in the simulation is allowed to
   call Date.now() for physics. This module owns:

     · the session epoch and current simulation time;
     · pause (Design Bible: menus pause local simulation);
     · the two clocks (Design Bible §7.3) — traveler time is exactly how
       long you have played and never scales; home time is Earth's, and is
       free to run ahead once relativity gets involved;
     · conversion between UTC (a display and input format) and the
       monotonic scale the ephemerides actually want.

   Why TT and not UTC for the maths: UTC contains leap seconds. Subtracting
   two UTC timestamps across one gives an answer that is wrong by a second,
   and orbital mechanics does not have a convention for "this minute had 61
   seconds in it". TT is uniform, so integration and ephemeris evaluation
   happen there and UTC exists only at the edges.
   ══════════════════════════════════════════════════════════════════════ */

import { K } from "../core/units.js";

const DAY = 86400;

/* ── conversions ─────────────────────────────────────────────────────── */

/** Julian Date (UTC) from a JavaScript Date. */
export function dateToJdUtc(date) {
  return K.UNIX_JD_EPOCH.value + date.getTime() / 86400000;
}

/** Julian Date (UTC) → JavaScript Date. */
export function jdUtcToDate(jd) {
  return new Date((jd - K.UNIX_JD_EPOCH.value) * 86400000);
}

/**
 * Seconds of Terrestrial Time since J2000.0, from a UTC Julian Date.
 * TT = UTC + (TAI−UTC) + (TT−TAI). Both offsets live in units.js with
 * their sources; the leap-second count is the one that ages.
 */
export function jdUtcToTtSeconds(jdUtc) {
  const offset = K.TAI_MINUS_UTC.value + K.TT_MINUS_TAI.value;
  return (jdUtc - K.JD_J2000.value) * DAY + offset;
}

/** Inverse of jdUtcToTtSeconds. */
export function ttSecondsToJdUtc(tt) {
  const offset = K.TAI_MINUS_UTC.value + K.TT_MINUS_TAI.value;
  return K.JD_J2000.value + (tt - offset) / DAY;
}

/** Julian centuries of TT since J2000.0 — the argument every Meeus series wants. */
export const ttSecondsToCenturies = (tt) => tt / K.JULIAN_CENTURY.value;

/**
 * Julian Date in TT. The lunar and solar series are strictly speaking
 * functions of TDB, but TDB−TT is periodic with an amplitude of 1.7 ms,
 * which moves the Moon by about 2 mm. Ignored deliberately; see the
 * honesty ledger entry SF-L-004.
 */
export const ttSecondsToJdTt = (tt) => K.JD_J2000.value + tt / DAY;

/* ── the service ─────────────────────────────────────────────────────── */

export class TimeService {
  /**
   * @param {object}  [opts]
   * @param {Date}    [opts.startUtc]  session epoch; defaults to now
   * @param {boolean} [opts.paused]
   */
  constructor({ startUtc = new Date(), paused = false } = {}) {
    /** UTC Julian Date the session began at — never changes. */
    this.epochJdUtc = dateToJdUtc(startUtc);
    /** Seconds of TT since J2000 for the session epoch. */
    this.epochTt = jdUtcToTtSeconds(this.epochJdUtc);

    /**
     * Simulation seconds elapsed since the session epoch.
     *
     * The clock is stored as epoch **plus elapsed** rather than as one
     * running total, and that is not fastidiousness. Seconds of TT since
     * J2000 is a number around 8.4×10⁸, where a double's spacing is
     * 1.9×10⁻⁷ s. Adding a sixtieth of a second to it rounds, and rounds
     * the same way every time: accumulating at 60 Hz loses 2.9 µs every
     * second — 2.9 parts per million, a millisecond every six minutes.
     *
     * That is invisible until two things advance on different paths. The
     * ship steps by its own dt while the station propagates by differences
     * of this clock, and the millisecond becomes eight metres of along-
     * track separation at 7.6 km/s: a station that slowly drifts away from
     * a ship holding position perfectly. Elapsed seconds stay small, so
     * they accumulate exactly, and `tt` is derived.
     *
     * It matters on its own account too. A project with a two-clock rule
     * (Design Bible §7.3) cannot have its primary clock running slow.
     */
    this.elapsedSeconds = 0;

    /**
     * Traveler (proper) time, seconds. Design Bible §7.3: this is exactly
     * how long you have played, it only counts forward at one second per
     * second, and it is never scaled, rewound or skipped.
     */
    this.travelerSeconds = 0;

    /**
     * Home (Earth) elapsed time, seconds. Identical to traveler time until
     * something relativistic happens to the ship; then it runs ahead.
     */
    this.homeSeconds = 0;

    this.paused = paused;
    /** Simulation seconds elapsed per real second while running. Always 1 for now. */
    this.rate = 1;
    /** Frames are clamped to this so a stalled tab cannot teleport the Moon. */
    this.maxStepSeconds = 0.25;

    this._lastWall = null;
  }

  /**
   * Advance by one real frame.
   * @param {number} wallSeconds monotonic clock reading (performance.now()/1000)
   * @param {number} [lorentz]   ship's Lorentz factor γ; 1 at ordinary speeds
   * @returns {number} simulation seconds actually advanced
   */
  tick(wallSeconds, lorentz = 1) {
    return this.step(this.frameDelta(wallSeconds), lorentz);
  }

  /**
   * How many simulation seconds this frame is worth — without advancing
   * anything.
   *
   * Separate from `step` so a caller can advance the clock, the world and
   * the ship together in matched sub-steps. That is not fastidiousness
   * either: advancing the clock and the world at the top of a frame and
   * the ship at the bottom leaves them a frame apart, and a frame apart at
   * 7.6 km/s is 128 metres. The flight computer then reports a ship 128 m
   * further from the station than it is, and the HUD, the warnings and the
   * braking assist are all wrong together and consistently — which is much
   * harder to spot than one of them being wrong on its own.
   */
  frameDelta(wallSeconds) {
    if (this._lastWall === null) {
      this._lastWall = wallSeconds;
      return 0;
    }
    let dt = wallSeconds - this._lastWall;
    this._lastWall = wallSeconds;

    if (this.paused) return 0;
    if (!(dt > 0)) return 0;
    // Frames are clamped so a stalled tab cannot teleport the Moon.
    return Math.min(dt, this.maxStepSeconds) * this.rate;
  }

  /**
   * Advance every clock by `seconds` of simulation time.
   *
   * `lorentz` was defaulted to 1 and nothing ever passed anything else, so
   * the two clocks were identical by construction — while the HUD said
   * "clocks agree — you are not going fast enough to separate them" at any
   * speed you liked, including several trillion c. A readout that states a
   * physical *reason* for something that is really just unimplemented is
   * the precise failure the honesty ledger exists to prevent, and it was
   * sitting in the one part of the game that is about relativity.
   * `lorentzFactor` below is now computed and passed every sub-step.
   */
  step(seconds, lorentz = 1) {
    if (!(seconds > 0)) return 0;
    this.elapsedSeconds += seconds;
    // The traveler clock is the real one: it is your worldline, so it gets
    // the honest second regardless of what the ship is doing.
    this.travelerSeconds += seconds;
    // Home time runs ahead by γ. At Earth–Moon speeds γ−1 is about 1e-11,
    // so the two clocks agree for the whole vertical slice — which is the
    // correct result, not a missing feature.
    this.homeSeconds += seconds * lorentz;
    return seconds;
  }

  /** Menus pause local simulation (Design Bible / slice §5.3). */
  pause() { this.paused = true; }

  resume() {
    this.paused = false;
    // Drop the accumulated gap: resuming must not replay the paused span.
    this._lastWall = null;
  }

  /** Reset both clocks to matching — what a restart after death does (§11.3). */
  resetClocks() {
    this.travelerSeconds = 0;
    this.homeSeconds = 0;
  }

  /**
   * Simulation coordinate time, seconds of TT since J2000.
   *
   * Derived rather than stored — see `elapsedSeconds`. Assigning to it is
   * still allowed and still means what it looks like; it moves the elapsed
   * count, so a jump forward and a jump back land exactly where they left.
   */
  get tt() { return this.epochTt + this.elapsedSeconds; }
  set tt(value) { this.elapsedSeconds = value - this.epochTt; }

  /**
   * Advance the simulation clock by `seconds`.
   *
   * Use this rather than `tt += seconds`, which is not the same thing:
   * assignment reads the derived `tt`, rounds it to the spacing of a
   * double at 8.4×10⁸, adds, and subtracts the epoch back off — putting
   * back exactly the accumulation error the split was made to avoid. This
   * adds to the small number, where a sixtieth of a second is exact.
   *
   * `tt =` remains available and remains correct for what it is: jumping
   * the clock to a particular instant.
   */
  advance(seconds) {
    this.elapsedSeconds += seconds;
    return this.tt;
  }

  get jdUtc() { return ttSecondsToJdUtc(this.tt); }
  get jdTt() { return ttSecondsToJdTt(this.tt); }
  get centuriesTt() { return ttSecondsToCenturies(this.tt); }
  get date() { return jdUtcToDate(this.jdUtc); }

  /** UTC for display, to the second. */
  utcString() {
    return this.date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  }

  /** How far the two clocks have drifted apart, seconds. */
  get clockDivergenceSeconds() {
    return this.homeSeconds - this.travelerSeconds;
  }
}

/** h:mm:ss for an elapsed count of seconds. */
export function formatElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
