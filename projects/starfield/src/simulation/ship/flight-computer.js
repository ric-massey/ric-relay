/* ══════════════════════════════════════════════════════════════════════
   flight-computer.js — what the ship knows about its situation.

   This file computes and never commands. It answers the questions the HUD
   asks and the questions the flight model asks, and because both read the
   same answers they cannot disagree about whether you are about to hit
   something — which is the failure mode where a HUD says "clear" while the
   autopilot brakes.

   The organising idea is the **reference**. Vertical Slice §6.5 puts it
   bluntly: "stop" is incomplete without a reference frame. A ship at rest
   relative to the station is doing 7.66 km/s relative to Earth's centre and
   both statements are true, so every speed, every closing rate and every
   stopping distance here carries the name of the thing it is measured
   against, and that name goes on the glass.
   ══════════════════════════════════════════════════════════════════════ */

import { v3, add, sub, scale, cross, dot, length, normalize } from "../core/linalg.js";
import {
  STATION, ZONES, zoneAt, safeClosingRate, stationState, instantaneousRate,
} from "../world/station.js";
import { SHIP } from "./ship.js";
import { clearanceAhead, brakingAuthority, modeById, DEFAULT_MODE } from "./modes.js";
import { K } from "../core/units.js";

/**
 * A reference is a point, a velocity, and — crucially — an angular
 * velocity, because a frame that rotates changes what "at rest" means at
 * every position within it.
 *
 * @typedef {{id:string, label:string, position:{x,y,z}, velocity:{x,y,z},
 *            omega:{x,y,z}, radius:number}} Reference
 */

/** The Earth-centred inertial frame, as a reference. Does not rotate. */
export const inertialReference = () => ({
  id: "ECI",
  /* Plain words, 2026-07-28. This string goes straight onto the glass under
     "measured from", and "Earth-centred inertial" tells a child nothing.
     What it *means* is that your speed is quoted relative to Earth, so that
     is what it now says. The precise frame is still named in the sources
     panel, where someone asking the question will find it. */
  label: "Earth",
  position: v3(),
  velocity: v3(),
  omega: v3(),
  radius: K.EARTH_RADIUS_MEAN.value,
});

/**
 * The station's local orbital frame, as a reference. Rotates once per
 * orbit — at the rate it is *actually* turning, not at the mean motion.
 * See `instantaneousRate`; the difference is small and it is the whole
 * difference between station-keeping working and nearly working.
 */
export function stationReference(t) {
  const st = stationState(t);
  return {
    id: "LVLH",
    // Named as the thing, not as the jargon: every readout that uses this
    // renders as "relative to …", and "relative to station-relative" is
    // how a HUD tells a player it was written by a programmer.
    label: "the station",
    position: st.position,
    velocity: st.velocity,
    omega: instantaneousRate(st.position, st.velocity),
    radius: STATION.radius,
  };
}

/** Any body as a reference — its own inertial frame, not its rotating one. */
export const bodyReference = (id, label, state, radius) => ({
  id, label,
  position: state.position,
  velocity: state.velocity,
  omega: v3(),
  radius,
});

/**
 * Velocity of the ship relative to a reference *frame*, not relative to the
 * reference point.
 *
 * The ω × r term is the whole difference between the two, and leaving it
 * out is the bug that makes station-keeping feel broken: a ship 260 m
 * behind the station, perfectly stationary in the local frame, has an
 * inertial velocity a few centimetres per second different from the
 * station's. Report that difference as "drift" and the player will chase
 * it forever and never null it, because it is not drift — it is the frame
 * turning.
 */
export function relativeVelocity(ship, reference) {
  const lever = sub(ship.position, reference.position);
  const frameVelocityHere = add(reference.velocity, cross(reference.omega, lever));
  return sub(ship.velocity, frameVelocityHere);
}

/**
 * The velocity a ship at rest in this frame would have, here.
 *
 * "At rest relative to the station" is not "not moving": the station is
 * doing 7.66 km/s and its local frame turns once an orbit, so being at
 * rest beside it means matching both. The ω × r term is why a ship 260 m
 * from the station and genuinely stationary in its frame still has a
 * different inertial velocity — the same term `relativeVelocity` subtracts,
 * which is the point of computing it in one place.
 */
export function restVelocity(ship, reference) {
  return add(reference.velocity, cross(reference.omega, sub(ship.position, reference.position)));
}

/**
 * How long, and how far, to come to rest relative to `reference` at a given
 * authority.
 *
 * Deliberately the simple kinematic answer — v²/2a — rather than an
 * integration of the trajectory. Over a stop that lasts a couple of seconds
 * gravity's contribution is centimetres, and a number the player can verify
 * in their head is worth more here than a number that is right to the
 * millimetre and cannot be checked.
 */
export function stoppingSolution(relSpeed, authority) {
  if (authority <= 0) return { time: Infinity, distance: Infinity };
  return {
    time: relSpeed / authority,
    distance: (relSpeed * relSpeed) / (2 * authority),
  };
}

/**
 * The situation, computed fresh every step.
 *
 * @param {object} args
 * @param {import('./ship.js').Ship} args.ship
 * @param {Reference} args.reference   the frame speeds are quoted against
 * @param {Reference} [args.target]    what the player has selected, if anything
 * @param {boolean} [args.precision]
 * @param {boolean} [args.safetyOverridden]
 * @param {object} [args.world]  WorldService.state, for the proximity governor
 */
export function assess({
  ship, reference, target = null, precision = false, safetyOverridden = false,
  world = null, travel = modeById(DEFAULT_MODE),
}) {
  const authority = SHIP.maxAcceleration * (precision ? SHIP.precisionFactor : 1);

  const relVel = relativeVelocity(ship, reference);
  const relSpeed = length(relVel);
  /* Braking is the *selected drive's*, not the docking thruster's. This read
     `SHIP.maxAcceleration` — 30 m/s² in every mode — which made the stopping
     readout meaningless the moment the ship could exceed a few km/s: at
     Intergalactic cruise it announced 1.6×10²⁰ seconds. The drive lets go in
     its spool time, and now the number on the glass says so. */
  const stop = stoppingSolution(relSpeed, brakingAuthority(travel, precision));

  const warnings = [];

  /* ── proximity to the station ───────────────────────────────────────
     Measured centre to centre, then reported surface to surface, because
     "40 metres from the station" means from the structure. A player who is
     told 40 and hits at 40 has been lied to by an offset. */
  let proximity = null;
  const st = reference.id === "LVLH" ? reference : null;
  if (st) {
    const offset = sub(st.position, ship.position);
    const range = length(offset);
    const surfaceRange = range - STATION.radius - SHIP.radius;
    // Positive means the gap is shrinking. `relVel` is the ship's velocity
    // in the station's frame, and `offset` points at the station, so a
    // positive projection is motion toward it.
    const closingRate = range > 0 ? dot(relVel, scale(offset, 1 / range)) : 0;
    const zone = zoneAt(range);
    const limit = safeClosingRate(range);

    proximity = {
      range, surfaceRange, closingRate, zone, safeClosingRate: limit,
      /** Seconds until contact at the present closing rate, or null if opening. */
      timeToContact: closingRate > 1e-4 ? surfaceRange / closingRate : null,
      /** Can the ship stop before it arrives? */
      canStop: stoppingSolution(Math.max(0, closingRate), SHIP.maxAcceleration).distance <= surfaceRange,
    };

    if (surfaceRange <= 0) {
      warnings.push({ id: "contact", severity: "critical", text: "Contact with the station." });
    } else if (closingRate > limit) {
      warnings.push({
        id: "closing", severity: proximity.canStop ? "warning" : "critical",
        text: proximity.canStop
          ? `Closing at ${closingRate.toFixed(2)} m/s — over the ${limit.toFixed(2)} m/s guide for this range.`
          : `Closing too fast to stop in ${Math.max(0, surfaceRange).toFixed(0)} m.`,
      });
    } else if (zone && zone.severity !== "info") {
      warnings.push({ id: zone.id, severity: zone.severity, text: zone.advice });
    }
  }

  /* ── the ground ─────────────────────────────────────────────────────
     Not a Slice B scenario, but a ship with 6DOF thrust and no fuel can
     absolutely fly itself into the atmosphere while looking at the
     station, and finding that out by dying is not the same as being told. */
  const altitude = length(ship.position) - K.EARTH_RADIUS_MEAN.value;
  const descentRate = -dot(ship.velocity, normalize(ship.position));
  if (altitude < 120000) {
    warnings.push({
      id: "altitude", severity: altitude < 100000 ? "critical" : "warning",
      text: `Altitude ${(altitude / 1000).toFixed(0)} km — entering the atmosphere.`,
    });
  }

  /* Clearance to the nearest body *ahead*, surface to surface, measured
     along the heading the ship is being commanded down — the nose, because
     that is where assisted flight sends you.

     The governor reads it and so does the HUD: one number, so the speed the
     ship allows and the reason it gives can never disagree. It is the
     ahead-clearance rather than the omnidirectional one because the world
     behind you is not something you can hit, and charging the player for it
     was what made the interstellar drive take three minutes to spool
     (`clearanceAhead`). */
  const nose = ship.toEci({ x: 0, y: 0, z: -1 });
  const near = world ? clearanceAhead(ship.position, nose, world) : null;

  return {
    referenceId: reference.id,
    referenceLabel: reference.label,
    clearance: near ? near.clearance : null,
    clearanceTo: near ? near.id : null,
    authority,
    relativeVelocity: relVel,
    relativeSpeed: relSpeed,
    stoppingTime: stop.time,
    stoppingDistance: stop.distance,
    altitude,
    descentRate,
    proximity,
    target: target ? describeTarget(ship, target) : null,
    warnings,
    safetyOverridden,
    /** Highest severity present, for the HUD's one-glance state. */
    severity: warnings.reduce(
      (worst, w) => (RANK[w.severity] > RANK[worst] ? w.severity : worst), "none"
    ),
  };
}

const RANK = { none: 0, info: 1, caution: 2, warning: 3, critical: 4 };

function describeTarget(ship, target) {
  const offset = sub(target.position, ship.position);
  const range = length(offset);
  const direction = range > 0 ? scale(offset, 1 / range) : v3();
  const relVel = sub(target.velocity, ship.velocity);
  return {
    id: target.id,
    label: target.label,
    range,
    // Hull to hull, the same convention the proximity readout uses — two
    // numbers on the same screen describing the same gap must agree, and
    // these differed by the ship's own 12 m radius.
    surfaceRange: range - (target.radius || 0) - SHIP.radius,
    direction,
    closingRate: -dot(relVel, direction),
    relativeSpeed: length(relVel),
  };
}

/**
 * Why a safe stop cannot be completed, in words, or null when it can.
 * Slice §6.5 requires the *reason*, not merely a refusal.
 */
export function safeStopObstruction(situation) {
  const p = situation.proximity;
  if (!p) return null;
  if (p.surfaceRange <= 0) return "Already in contact.";
  if (p.closingRate <= 0) return null;
  if (!p.canStop) {
    return `Needs ${situation.stoppingDistance.toFixed(0)} m to stop and there are ` +
           `${Math.max(0, p.surfaceRange).toFixed(0)} m left. Turn away or take the impact.`;
  }
  return null;
}
