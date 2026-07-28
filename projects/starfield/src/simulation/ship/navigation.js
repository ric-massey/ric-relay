/* ══════════════════════════════════════════════════════════════════════
   navigation.js — where you can go, how long it takes, and flying it.

   Vertical Slice §7 and §11.1, Design Bible §9. Three things live here and
   they are deliberately separate:

     · `destinations()` — what can be selected. A list of places, not a
       list of meshes: the map and the cockpit reticle read the same one,
       which is why they cannot offer different targets (§11.1).
     · `planRoute()` — a **pure** preview. It commits to nothing, has no
       side effects, and is safe to call every frame while the player is
       still deciding. §7.2 requires the preview to exist before engaging,
       and a preview that alters state is not a preview.
     · `Autopilot` — execution. Closed loop, phase by phase, interruptible.

   The audit is explicit that this must not become another boolean inside
   the flight model's assist logic ("Do not make autopilot another boolean
   beside `assist` inside the current loop"), so the autopilot produces an
   acceleration the same way a player's hands do and the flight model
   never learns it exists.

   **The profile is flip-and-burn.** Accelerate at the authority the
   selected mode allows, flip, decelerate, arrive at rest. That is what a
   ship with effectively unlimited energy and no reaction mass actually
   does (§6.1); Hohmann transfers are what you fly when propellant is the
   binding constraint, and here it is not. The consequence is honest and
   worth stating out loud: Earth to the Moon at 3 g is a two-hour trip, and
   no part of this file hides that by shortening the distance.
   ══════════════════════════════════════════════════════════════════════ */

import { v3, add, sub, scale, dot, length, normalize } from "../core/linalg.js";
import { SHIP } from "./ship.js";
import { STATION } from "../world/station.js";
import { BODIES } from "../world/bodies.js";
import { K } from "../core/units.js";

/**
 * How far off a body the autopilot stops, as a multiple of its radius.
 *
 * Arriving *at* a body means arriving inside it. A standoff is not a
 * safety margin bolted on afterwards — it is where "arrived at the Moon"
 * actually is, and it wants to be far enough out that the body fills a
 * good part of the view rather than the whole sky.
 */
const STANDOFF_RADII = 3;

/** Standoff for the station, which is a structure rather than a world. */
const STATION_STANDOFF_M = 150;

/**
 * Everything the player can select, in one list.
 *
 * @param {object} state  WorldService.state
 * @returns {Array<{id,label,kind,position,velocity,radius,standoff,note}>}
 */
export function destinations(state) {
  const out = [];

  for (const rec of BODIES) {
    const body = state.bodies[rec.id];
    if (!body) continue;
    // The Sun is a destination the same way the horizon is: you can select
    // it, read about it, and point at it. Flying to it is 1 au away and the
    // route planner will say so rather than pretending otherwise.
    out.push({
      id: rec.id,
      label: rec.name,
      kind: "body",
      position: body.position,
      velocity: body.velocity,
      radius: rec.radius.value,
      standoff: rec.radius.value * STANDOFF_RADII,
      note: rec.note ?? null,
    });
  }

  /* The planets. Reachable in exactly the sense everything else here is:
     the route planner knows how far it is and how long the ship would take,
     and says so rather than refusing. Design Bible: everything you can see,
     you can go to — and these are now things you can see.

     Their standoff is the same multiple of their own radius as everything
     else, so "arrived at Jupiter" is 214 000 km off it rather than inside
     it, and Jupiter fills a good part of the view when you get there. */
  for (const p of state.planets ?? []) {
    out.push({
      id: p.id,
      label: p.name,
      kind: "body",
      position: p.position,
      velocity: p.velocity,
      radius: p.radius,
      standoff: p.radius * STANDOFF_RADII,
      note: null,
    });
  }

  if (state.station) {
    out.push({
      id: "station",
      // The short name, not the full one: this label goes on the glass and
      // into "arrived at …", where "International Space Station" reads as a
      // press release rather than as a place you just flew to.
      label: "the station",
      kind: "structure",
      position: state.station.position,
      velocity: state.station.velocity,
      radius: STATION.radius,
      standoff: STATION_STANDOFF_M,
      note: null,
    });
  }

  return out;
}

/**
 * A star, as somewhere you can go.
 *
 * Stars are not in `destinations()` and must not be: that list is rebuilt
 * every frame for the HUD, and nine thousand entries per frame to support
 * the one the player has selected is the wrong trade. They are resolved on
 * demand instead, by id, which is the only way anyone ever asks for one.
 *
 * **Only stars with a measured parallax.** A star without one has a
 * direction and no distance, and inventing a distance so the route planner
 * has something to chew on would put a number on the glass that nothing
 * measured — the exact failure the Scientific Standard exists to prevent.
 * Those stars stay selectable for identification and refuse to be flown to,
 * and the refusal says why.
 *
 * The standoff is 200 stellar radii rather than the 3 used for planets,
 * because arriving 3 radii off a star is arriving inside its corona.
 *
 * @param {object} star  a catalogue entry from buildCatalogue()
 * @returns {object|null}
 */
export function starDestination(star) {
  if (!star || !star.distanceLy) return null;

  const LY = 9.4607304725808e15;
  const range = star.distanceLy * LY;
  const ra = star.ra * (Math.PI / 180);
  const dec = star.dec * (Math.PI / 180);

  /* J2000 equatorial, matching how the sky is built. Proper motion is not
     applied: over a human lifetime it moves even Barnard's Star by about
     three arcminutes, which at these distances is nothing you could aim
     with anyway, and the catalogue does not carry it. */
  const position = {
    x: Math.cos(dec) * Math.cos(ra) * range,
    y: Math.cos(dec) * Math.sin(ra) * range,
    z: Math.sin(dec) * range,
  };

  // A rough radius, because the catalogue does not carry one. Solar radii
  // scaled by nothing at all — this exists so the standoff has something to
  // multiply, and it is labelled as an assumption wherever it surfaces.
  const SOLAR_RADIUS_M = 6.957e8;

  return {
    id: `star:${star.hr ?? star.name}`,
    label: star.name,
    kind: "star",
    position,
    velocity: { x: 0, y: 0, z: 0 },
    radius: SOLAR_RADIUS_M,
    standoff: SOLAR_RADIUS_M * 200,
    distanceLy: star.distanceLy,
    assumedRadius: true,
    note: `${star.distanceLy.toFixed(1)} light years, from its measured parallax.`,
  };
}

/**
 * Look one up by id. Returns null rather than throwing — the HUD asks.
 *
 * `state.stars` is consulted for `star:` ids so a selected star survives
 * being looked up again on the next frame.
 */
export function destinationById(state, id) {
  if (typeof id === "string" && id.startsWith("star:")) {
    const star = (state.stars ?? []).find((s) => `star:${s.hr ?? s.name}` === id);
    return starDestination(star);
  }
  return destinations(state).find((d) => d.id === id) ?? null;
}

/**
 * The time and peak speed of a flip-and-burn between two points at rest.
 *
 * Half the distance accelerating, half decelerating: d/2 = ½at², so the
 * half-time is √(d/a) and the whole trip is twice that. The peak speed is
 * reached at the flip and is a·t.
 *
 * A cruise cap turns the profile into boost–coast–brake. Without one, a
 * long enough route reaches a speed where the relativistic terms this
 * slice does not model start to matter, and a navigation computer quietly
 * flying you past the physics it is drawn with is exactly the kind of lie
 * the Scientific Standard exists to prevent.
 */
export function flipAndBurn(distance, authority, cruiseSpeed = Infinity) {
  if (!(distance > 0)) return { time: 0, peakSpeed: 0, boostTime: 0, cruiseTime: 0 };
  if (!(authority > 0)) return { time: Infinity, peakSpeed: 0, boostTime: Infinity, cruiseTime: 0 };

  const halfTime = Math.sqrt(distance / authority);
  const peak = authority * halfTime;

  if (peak <= cruiseSpeed) {
    return { time: 2 * halfTime, peakSpeed: peak, boostTime: halfTime, cruiseTime: 0 };
  }

  // Capped: accelerate to the cap, hold it, then brake from it. The two
  // burns cover v²/a between them; the rest is flown at constant speed.
  const boostTime = cruiseSpeed / authority;
  const burnDistance = (cruiseSpeed * cruiseSpeed) / authority;
  const cruiseTime = Math.max(0, (distance - burnDistance) / cruiseSpeed);
  return {
    time: 2 * boostTime + cruiseTime,
    peakSpeed: cruiseSpeed,
    boostTime,
    cruiseTime,
  };
}

/**
 * Plan a route. Pure — call it as often as you like.
 *
 * The plan is a *prediction*, not a commitment. It is computed from the
 * geometry at this instant and the destination is moving, so the executor
 * closes the loop rather than replaying this. What the plan is for is
 * §7.2: telling the player what is about to happen before it happens.
 *
 * @param {object} args
 * @param {{position,velocity}} args.ship
 * @param {object} args.destination      from `destinations()`
 * @param {object} args.state            WorldService.state, for hazards
 * @param {number} [args.authority]      m/s² the route may use
 * @param {number} [args.cruiseSpeed]    m/s cap, if the mode imposes one
 * @returns {object} route
 */
export function planRoute({ ship, destination, state, authority = SHIP.maxAcceleration, cruiseSpeed = Infinity }) {
  const offset = sub(destination.position, ship.position);
  const range = length(offset);
  const arrivalRange = destination.standoff + destination.radius;
  const travel = Math.max(0, range - arrivalRange);
  const direction = range > 0 ? scale(offset, 1 / range) : v3(0, 0, 1);

  const profile = flipAndBurn(travel, authority, cruiseSpeed);

  /* Closest approaches along the straight line to the destination.
     §7.2 asks for these and §7.3 asks the executor to avoid them. What is
     here is the *check*, not the avoidance: the route is a straight line,
     and if something is in the way this reports it and refuses rather than
     flying through it and calling that a route. Curved routing is not
     built — the honest thing is to say so, and the `blocked` flag is how
     the preview says it. */
  const approaches = [];
  let blocked = null;
  for (const hazard of destinations(state)) {
    if (hazard.id === destination.id) continue;
    const closest = closestApproachToSegment(ship.position, direction, travel, hazard.position);
    approaches.push({ id: hazard.id, label: hazard.label, range: closest.range, at: closest.distanceAlong });
    // Hull to hull, with the ship's own radius counted, the same
    // convention every other clearance number in this project uses.
    const clearance = closest.range - hazard.radius - SHIP.radius;
    if (clearance < 0 && closest.distanceAlong > 0) {
      blocked = `${hazard.label} is on the direct line, ${Math.abs(clearance / 1000).toFixed(0)} km inside it.`;
    }
  }
  approaches.sort((a, b) => a.range - b.range);

  const phases = [];
  if (travel <= 0) {
    phases.push({ id: "arrive", label: "already within the arrival standoff", seconds: 0 });
  } else {
    phases.push({ id: "align", label: `turn to face ${destination.label}`, seconds: null });
    phases.push({ id: "boost", label: `accelerate at ${(authority / 9.80665).toFixed(1)} g`, seconds: profile.boostTime });
    if (profile.cruiseTime > 0) {
      phases.push({ id: "cruise", label: `hold ${(profile.peakSpeed / 1000).toFixed(0)} km/s`, seconds: profile.cruiseTime });
    }
    phases.push({ id: "brake", label: "flip and decelerate", seconds: profile.boostTime });
    phases.push({ id: "arrive", label: `station-keep ${formatRange(destination.standoff)} off ${destination.label}`, seconds: 0 });
  }

  return {
    destinationId: destination.id,
    destinationLabel: destination.label,
    /* §7.2 wants both frames named. Departure is whatever the ship is
       flying in now; arrival is the destination's own frame, because
       "arrived" means at rest relative to the thing, not relative to
       where it used to be. */
    departureFrame: "Earth-centred inertial",
    arrivalFrame: destination.label,
    range,
    travel,
    arrivalRange,
    phases,
    duration: profile.time,
    maxAcceleration: authority,
    peakSpeed: profile.peakSpeed,
    /** Seconds from engagement at which the braking burn starts. */
    brakingStartsAt: profile.boostTime + profile.cruiseTime,
    /** Relative to the arrival frame. Zero: the ship stops on arrival. */
    arrivalSpeed: 0,
    closestApproaches: approaches.slice(0, 3),
    blocked,
    uncertainties: [
      "The destination moves while you fly; the route is re-solved every step, so these figures are the plan and not the outcome.",
      "Gravity is not integrated into the plan. Over an Earth–Moon crossing under thrust it changes the arrival time by seconds.",
    ],
  };
}

/** Closest approach of a point to a segment starting at `from` along `dir`. */
function closestApproachToSegment(from, dir, segmentLength, point) {
  const rel = sub(point, from);
  const along = Math.max(0, Math.min(segmentLength, dot(rel, dir)));
  const nearest = add(from, scale(dir, along));
  return { range: length(sub(point, nearest)), distanceAlong: along };
}

function formatRange(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(0)} km` : `${m.toFixed(0)} m`;
}

/* ══════════════════════════════════════════════════════════════════════
   Execution
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Flies a planned route.
 *
 * Closed loop, not a replay of the plan. The destination is in orbit and
 * the ship is under thrust for an hour, so an open-loop profile computed
 * at engagement would miss by thousands of kilometres. Every step re-asks
 * the only two questions that matter — how far is left, and how fast am I
 * closing — and brakes when the second can no longer be undone inside the
 * first. That is the same stopping-distance test the HUD shows the player,
 * which is the point: they agree because they are the same arithmetic.
 */
export class Autopilot {
  constructor() {
    /** The engaged route, or null. */
    this.route = null;
    /** Current phase id: align, boost, cruise, brake, arrive, or null. */
    this.phase = null;
    /** Set when the autopilot finished or gave up, for the HUD to announce. */
    this.result = null;
    /** Kept after disengagement — §7.4: the destination survives. */
    this.destinationId = null;
  }

  get engaged() { return this.route !== null; }

  /**
   * Engage a planned route. Returns the reason it cannot run, or null.
   * §7.2: engaging a blocked route is refused with the reason, not silently.
   */
  engage(route) {
    if (route.blocked) {
      this.result = { ok: false, reason: route.blocked };
      return route.blocked;
    }
    this.route = route;
    this.destinationId = route.destinationId;
    this.phase = route.travel > 0 ? "align" : "arrive";
    this.result = null;
    return null;
  }

  /**
   * §7.4: any meaningful manual input disengages, immediately and without
   * a dialog. The destination is kept so the player can re-engage.
   */
  disengage(reason = "manual input") {
    if (this.route) this.result = { ok: false, reason, destinationId: this.destinationId };
    this.route = null;
    this.phase = null;
  }

  /**
   * One step. Returns the acceleration to apply in ECI and the phase, or
   * null when nothing is engaged.
   *
   * @param {object} args
   * @param {{position,velocity}} args.ship
   * @param {object} args.state     WorldService.state, for the live destination
   * @returns {{accelEci:{x,y,z}, phase:string, note:string, remaining:number}|null}
   */
  step({ ship, state }) {
    if (!this.route) return null;

    const destination = destinationById(state, this.route.destinationId);
    if (!destination) {
      this.disengage(`lost track of ${this.route.destinationLabel}`);
      return null;
    }

    const authority = this.route.maxAcceleration;
    const offset = sub(destination.position, ship.position);
    const range = length(offset);
    const direction = range > 0 ? scale(offset, 1 / range) : v3(0, 0, 1);
    const arrivalRange = destination.standoff + destination.radius;
    const remaining = range - arrivalRange;

    // Velocity relative to the destination, split into the part that
    // closes the gap and the part that misses.
    const relVel = sub(ship.velocity, destination.velocity);
    const closing = dot(relVel, direction);
    const lateral = sub(relVel, scale(direction, closing));
    const lateralSpeed = length(lateral);

    /* Lateral velocity is nulled at every phase and always first. It is
       what makes this a rendezvous rather than a fly-past: the closing
       component alone would put the ship through the point at speed, with
       the miss distance growing the whole way. The budget is a quarter of
       the authority so that killing sideways drift can never leave nothing
       for the brake. */
    const lateralBudget = authority * 0.25;
    let accel = lateralSpeed > 1e-6
      ? scale(lateral, -Math.min(lateralBudget, lateralSpeed * 2) / lateralSpeed)
      : v3();
    const remainingAuthority = Math.sqrt(Math.max(0, authority * authority - lateralBudget * lateralBudget));

    // Arrived: hold the standoff, at rest relative to the destination.
    if (remaining <= 0) {
      this.phase = "arrive";
      const brake = closing !== 0
        ? scale(direction, -Math.min(remainingAuthority, Math.abs(closing) * 2) * Math.sign(closing))
        : v3();
      if (Math.abs(closing) < 0.05 && lateralSpeed < 0.05) {
        this.result = { ok: true, reason: `arrived at ${destination.label}`, destinationId: destination.id };
        this.route = null;
        this.phase = null;
        return { accelEci: add(accel, brake), phase: "arrive", note: `arrived at ${destination.label}`, remaining: 0 };
      }
      return { accelEci: add(accel, brake), phase: "arrive", note: `holding ${formatRange(destination.standoff)} off ${destination.label}`, remaining: 0 };
    }

    /* The controller tracks a *speed profile* rather than switching between
       full thrust and full brake.
​
       The obvious version compares the stopping distance to the distance
       left and picks one or the other, and it limit-cycles: once braking,
       the closing speed falls as the square while the distance left falls
       linearly, so the test flips back almost immediately and the ship
       chatters boost–brake–boost all the way in. That is not a tuning
       problem, it is what bang-bang control does at a boundary it is
       driving itself across.
​
       So: at every distance there is a speed you could still stop from,
       √(2·a·d). Fly *that* speed. Far out it is enormous and the command
       saturates at full thrust; close in it falls to zero and the same
       expression is the braking burn, with the flip happening exactly
       where the two meet. One equation, no modes, no chatter — and it is
       the same √(2·a·d) the HUD already shows as stopping distance. */
    const cap = this.route.peakSpeed;
    // The 0.9 leaves a tenth of the brake in hand for the lateral
    // controller and for gravity, neither of which is in this expression.
    const stoppableSpeed = Math.sqrt(2 * remainingAuthority * remaining * 0.9);
    const wanted = Math.min(cap, stoppableSpeed);

    // Close the gap between the speed we want and the speed we have. The
    // gain is a half-second time constant; anything faster just saturates.
    const along = Math.max(-remainingAuthority,
      Math.min(remainingAuthority, (wanted - closing) * 2));
    accel = add(accel, scale(direction, along));

    const threshold = remainingAuthority * 0.05;
    if (along < -threshold) {
      this.phase = "brake";
      return {
        accelEci: accel, phase: "brake", remaining,
        note: `braking — ${formatRange(remaining)} to ${destination.label}`,
      };
    }
    if (along > threshold) {
      this.phase = "boost";
      return {
        accelEci: accel, phase: "boost", remaining,
        note: `accelerating toward ${destination.label}`,
      };
    }
    this.phase = "cruise";
    return {
      accelEci: accel, phase: "cruise", remaining,
      note: `${(closing / 1000).toFixed(0)} km/s — ${formatRange(remaining)} to run`,
    };
  }
}
