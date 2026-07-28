/* ══════════════════════════════════════════════════════════════════════
   station.js — the station, and the frame you fly relative to it in.

   Two separate things live here and they should not be confused:

   **The station** is an object with a state, a size, and a shape you can
   hit. Vertical Slice decision §19.1 makes it the real ISS rather than a
   fictional station — recognisably so, not exactly so. Its orbit is the
   representative one the session already uses (§8.1, ledger SF-L-008): the
   altitude and inclination are the station's real ones, but this is not a
   claim about where the ISS is at this moment, and nothing in the game
   says otherwise.

   **The local orbital frame** is how proximity operations are actually
   flown. Nobody station-keeps in Earth-centred inertial coordinates —
   both objects are moving at 7.66 km/s and the numbers are useless. What
   matters is the ten metres between you, and that only has a stable
   meaning in a frame that travels with the station.

   The frame is the standard LVLH triad:

     x̂  along-track, the direction of travel        — the "V-bar"
     ẑ  nadir, straight down at Earth               — the "R-bar"
     ŷ  ẑ × x̂, which is the negative orbit normal   — the "H-bar"

   It rotates once per orbit, which is the whole reason relative motion
   near a station is so counter-intuitive: thrust forward and you rise, and
   rising means falling behind. Slice §8.3 wants the player to *discover*
   that rather than be told it, and they can only discover it if the frame
   they are shown is the one it happens in.
   ══════════════════════════════════════════════════════════════════════ */

import { v3, sub, add, scale, cross, normalize, length, dot, fromBasisRows } from "../core/linalg.js";
import { observationState, OBSERVATION_ORBIT, MEAN_MOTION } from "./observation-point.js";
import { K } from "../core/units.js";

/**
 * The station, as the simulation sees it.
 *
 * The dimensions are the real ISS's published envelope: 109 m across the
 * truss, 73 m along the module stack, about 20 m deep. `radius` is the
 * bounding sphere those imply, and it is used for the collision test and
 * for the outer safety zone — not for drawing anything.
 */
export const STATION = {
  id: "station",
  name: "International Space Station",
  /** How the orbit is being sourced right now — Design Bible §8.1 requires this be visible. */
  orbitProvenance: "representative",
  trussSpanM: 109,
  moduleLengthM: 73,
  depthM: 20,
  /** Bounding sphere, metres. Half the truss span, rounded up. */
  radius: 56,
  massKg: 450000,
  cls: "K",
  note:
    "Altitude, inclination and dimensions are the real station's. Its position in the " +
    "orbit is representative, not a live track — see SF-L-008.",
};

/**
 * The safety envelope (slice §8.2).
 *
 * These are **navigational guidance, not invisible walls.** Nothing here
 * stops the ship; the flight computer names the zone you are in and warns
 * you, and if you fly into the arrays you hit them. That is the whole
 * point: the slice's §8.2 is explicit that manual flight remains possible
 * and contact uses collision rules.
 *
 * The radii follow the real approach-ellipsoid convention loosely — the
 * numbers are chosen so that a first-time player crosses a named boundary
 * often enough to learn what the names mean.
 */
export const ZONES = [
  {
    id: "contact",
    radius: STATION.radius,
    label: "structure",
    severity: "critical",
    advice: "You are inside the station's envelope. Anything you touch, you have hit.",
  },
  {
    id: "keepout",
    radius: 200,
    label: "keep-out sphere",
    severity: "warning",
    advice: "Solar arrays and radiators reach further than the truss. Stay slow.",
  },
  {
    id: "proximity",
    radius: 1000,
    label: "proximity operations",
    severity: "caution",
    advice: "Close range. Match velocity before you close further.",
  },
  {
    id: "observation",
    radius: 5000,
    label: "observation distance",
    severity: "info",
    advice: "Station-keeping distance. The whole station fits in the view from here.",
  },
];

/** Which zone a range from the station's centre falls in, or null outside all of them. */
export function zoneAt(range) {
  for (const z of ZONES) if (range <= z.radius) return z;
  return null;
}

/**
 * Closing speed above which an approach is unsafe at this range.
 *
 * The rule real proximity operations use is that your closing rate should
 * be no more than about a tenth of your remaining distance per second, so
 * that you always have ten seconds to think. It is not a physics result;
 * it is an operational one, and it is what makes the warning meaningful
 * rather than a fixed number that is too strict far out and too loose in
 * close.
 */
export function safeClosingRate(range) {
  return Math.max(0.05, Math.min(10, (range - STATION.radius) * 0.1));
}

/* ══════════════════════════════════════════════════════════════════════
   Propagation.

   The station cannot be on a *kinematic* orbit while the ship is on a
   *dynamic* one. It was, briefly, and the result is worth writing down
   because it is the kind of bug that reads as a physics failure and is
   really a modelling inconsistency:

   observation-point.js describes a circular orbit with a linear nodal
   regression — an excellent analytic model of a J2 orbit's *secular*
   behaviour, and the right thing for placing the session. The ship,
   meanwhile, integrates the actual field. Those two agree on where the
   orbit is and disagree about where in it you are, because J2 also shifts
   the along-track rate and adds a short-period oscillation the analytic
   model does not carry. Left alone, the station ran away from a ship that
   was holding station perfectly: 950 metres in five minutes.

   So the station is propagated through the same gravity the ship falls
   through, seeded from the analytic model. Now the only way for them to
   drift apart is for one of them to be actually accelerating, which is
   exactly the signal the player is supposed to be reading.

   The analytic model stays: it is what the propagation is seeded from, it
   is what a large time jump re-seeds to, and it is still the honest source
   of the orbit's published character (altitude, inclination, period).
   ══════════════════════════════════════════════════════════════════════ */

import { integrate } from "../ship/gravity.js";
import { moonStateEci, sunStateEci } from "./ephemeris.js";

/**
 * Propagation sub-step — the same one the ship uses, for the same reasons.
 *
 * Long gaps are caught up rather than re-seeded. Re-seeding was the first
 * attempt and it is wrong in a way that only shows up in play: every pause,
 * every backgrounded tab, every menu would drop the station back onto the
 * analytic orbit while the ship stayed on the integrated one, and the
 * station would jump — by metres after a short pause, by hundreds after a
 * long one — relative to a player who had done nothing. A frame boundary
 * may not move anything visibly (§5.2), and neither may a pause.
 *
 * The step coarsens instead, so catching up an hour costs the same as
 * catching up a second. RK4 is fourth-order, so even a two-second step
 * holds a low orbit to well under a metre over a full revolution.
 */
const STEP_S = 1 / 60;
const MAX_CATCHUP_STEPS = 20000;

const propagated = { t: null, position: null, velocity: null };

/**
 * State of the station in the Earth-centred inertial frame at time `t`.
 *
 * Repeated calls at the same `t` are free, which matters because the frame
 * graph, the renderer and the flight computer all ask independently every
 * frame and must all get the same answer.
 */
export function stationState(t) {
  // The third bodies are read here rather than passed in, so that the
  // station and the ship cannot end up falling through different fields.
  // The Moon's tidal pull at this altitude is about 1.2×10⁻⁶ m/s²; give it
  // to one of them and not the other and they separate by centimetres a
  // minute, forever, for no reason the player can see.
  const thirdBody = {
    moon: moonStateEci(t).position,
    sun: sunStateEci(t).position,
  };

  if (propagated.t !== null && Math.abs(t - propagated.t) < 1e-9) {
    return { position: propagated.position, velocity: propagated.velocity };
  }

  const gap = propagated.t === null ? 0 : t - propagated.t;

  // First call, or the clock has gone backwards: seed from the analytic
  // model. Going backwards is a scrub rather than flight, and there is no
  // continuity to preserve across one.
  if (propagated.t === null || !(gap > 0)) {
    const seed = observationState(t);
    propagated.t = t;
    propagated.position = seed.position;
    propagated.velocity = seed.velocity;
    return seed;
  }

  let s = { position: propagated.position, velocity: propagated.velocity };
  let remaining = gap;
  const step = Math.max(STEP_S, gap / MAX_CATCHUP_STEPS);
  while (remaining > 1e-9) {
    const h = Math.min(remaining, step);
    s = integrate(s, h, undefined, thirdBody);
    remaining -= h;
  }
  propagated.t = t;
  propagated.position = s.position;
  propagated.velocity = s.velocity;
  return s;
}

/** Drop the propagated state — a new session, or a test that wants a clean slate. */
export function resetStationPropagation() {
  propagated.t = null;
  propagated.position = null;
  propagated.velocity = null;
}

/**
 * The station's local orbital frame, as the FrameGraph wants it: a
 * description of the CHILD as seen from its PARENT (here, ECI).
 *
 * The angular-velocity term is the one that must not be forgotten. This
 * frame rotates once per orbit, so a ship sitting *still* in it is
 * genuinely accelerating in inertial space, and a conversion that carried
 * position without ω × r would hand the ship free velocity every time it
 * crossed the boundary — the exact critical bug the frame graph's own
 * header warns about.
 */
export function stationFrame(t) {
  const { position, velocity } = stationState(t);

  const alongTrack = normalize(velocity);
  const nadir = normalize(scale(position, -1));
  // Re-orthogonalise: the orbit is very slightly non-circular under J2, so
  // velocity is not exactly perpendicular to the radius, and a triad built
  // from two nearly-perpendicular vectors has to be squared up or the
  // frame slowly stops being a rotation.
  const crossTrack = normalize(cross(nadir, alongTrack));
  const x = normalize(cross(crossTrack, nadir));
  const z = nadir;
  const y = crossTrack;

  return {
    p: position,
    v: velocity,
    R: fromBasisRows(x, y, z),
    omega: instantaneousRate(position, velocity),
  };
}

/**
 * How fast the local frame is actually turning, right now: ω = (r × v)/r².
 *
 * Not the mean motion. The difference is about a part in a thousand under
 * J2, and a part in a thousand is not a rounding error here — it is the
 * difference between a co-orbiting object sitting still on the glass and
 * one that creeps two metres every five minutes for no reason the player
 * can act on. A frame that turns at the *mean* rate is not the frame the
 * station is actually in; this one is.
 */
export function instantaneousRate(position, velocity) {
  const r2 = dot(position, position);
  return scale(cross(position, velocity), 1 / r2);
}

/**
 * Register the station's frame on a FrameGraph.
 * Kept here rather than in world-service.js so that everything which knows
 * what "station-relative" means lives in one file.
 */
export function registerStationFrame(frames) {
  return frames.register({
    id: "LVLH",
    parent: "ECI",
    label: "station-relative",
    note:
      "Travels with the station and turns once per orbit. x̂ is the direction of travel, " +
      "ẑ points straight down at Earth, ŷ completes the set. This is the frame in which " +
      "'ten metres away and holding' means something.",
    at: stationFrame,
  });
}

/**
 * Where the session's ship starts: on the V-bar, behind the station and
 * station-keeping with it.
 *
 * Behind rather than in front, and on the velocity vector rather than
 * above or below, for a reason that is pedagogy rather than realism: from
 * here the station is silhouetted against Earth, the whole structure is in
 * frame at a 55° field of view, and the first thing the player does — nose
 * over and close a little — teaches the orbital-mechanics lesson §8.3 is
 * after. A ship placed *radially* instead would drift along-track
 * immediately and feel broken to someone who does not yet know why.
 *
 * The velocity is not the station's velocity copied across. At 260 m
 * behind on the V-bar, holding station means matching the *angular* rate,
 * which is very slightly slower — copying the station's inertial velocity
 * would leave a real drift of a few centimetres per second. Small, and
 * exactly the kind of small this project does not round away.
 */
/**
 * How far behind the station the session starts, metres.
 *
 * 260 rather than something closer, for two reasons that both turned up
 * the first time the thing was actually flown. At 260 m the whole station
 * subtends 24° and sits inside a 55° field with room around it, so the
 * first frame is a recognisable ISS rather than a wall of truss. And it is
 * outside the 200 m keep-out sphere, so the session does not open with a
 * proximity warning already on the glass — which teaches a new player that
 * warnings are wallpaper before they have flown a metre.
 */
export const START_OFFSET_M = -260;

export function shipStartState(t) {
  const st = stationState(t);

  /* Put the ship on the station's own orbit, 260 m behind it, by rotating
     the station's whole state backwards about the orbit normal.

     Rotating both vectors preserves |r| and |v| exactly, so the ship has
     the same energy and the same angular momentum as the station: it is on
     the *same* orbit rather than on a very similar one. Offsetting the
     position and then patching the velocity with ω × lever is the obvious
     alternative and it is subtly wrong — it leaves a few millimetres a
     second of real drift, which is invisible for a minute and is a hundred
     metres by the end of an orbit. */
  const angle = START_OFFSET_M / length(st.position);
  const axis = normalize(cross(st.position, st.velocity));
  return {
    position: rotateAbout(st.position, axis, angle),
    velocity: rotateAbout(st.velocity, axis, angle),
  };
}

/** Rodrigues' rotation of `v` about unit `axis` by `angle` radians. */
function rotateAbout(v, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const kv = cross(axis, v);
  const kd = dot(axis, v) * (1 - c);
  return add(add(scale(v, c), scale(kv, s)), scale(axis, kd));
}
