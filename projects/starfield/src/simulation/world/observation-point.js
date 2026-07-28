/* ══════════════════════════════════════════════════════════════════════
   observation-point.js — where the session begins.

   Design Bible §4.1 gives a fallback order for the station's state:

     1. reliable live orbital elements, validated;
     2. a bundled recent element set with its epoch shown;
     3. a clearly labelled representative low-Earth-orbit scenario.

   This slice takes option 3, deliberately. Option 2 is the decided default
   for the finished game, but which element source may be *redistributed*
   inside an open-source repository is still an open question in Data
   Sources §5, and the rule is that code does not settle open questions by
   quietly picking one. So: a representative orbit, labelled representative
   everywhere it is shown, with ledger entry SF-L-008 explaining why.

   The orbit itself is real physics — right altitude, right inclination,
   right period, with the J2 nodal regression that makes a low orbit's
   plane sweep about 5° a day. What is *not* claimed is that the real
   station is at this point in it right now.
   ══════════════════════════════════════════════════════════════════════ */

import { K } from "../core/units.js";
import { DEG } from "../core/linalg.js";

/**
 * Representative ISS-like orbit. Class K — constrained, not measured.
 *
 * The node and phase are configured at session start (see
 * `configureObservationOrbit`) rather than being constants, because a
 * constant node is not actually representative of anything. An earlier
 * version anchored the node at J2000 and let 26 years of J2 regression run
 * from there; the node it arrived at was arbitrary, and it happened to
 * land on a beta angle of 60°, which is a terminator-hugging orbit where
 * the Sun never rises more than 30° above the ground below. The result was
 * a session that was 90-plus per cent black.
 *
 * Beta angle is the angle between the orbit plane and the Sun. The real
 * station's cycles through roughly ±75° over a couple of months, but it
 * spends most of its life at low beta, and high beta is the case flight
 * planners work around rather than the normal one.
 */
export const OBSERVATION_ORBIT = {
  label: "representative low Earth orbit",
  altitudeM: 420000,
  inclinationRad: 51.6394 * DEG,   // the real ISS inclination, set by Baikonur's latitude
  raanAtEpochRad: 0,
  argLatAtEpochRad: 0,
  epochTt: 0,
  betaDeg: null,                   // filled in by configureObservationOrbit
  cls: "K",
  note:
    "Altitude and inclination match the real station. The node is placed at a typical " +
    "beta angle for the session's date, and the session opens on the daylight side — " +
    "this is a representative orbit, not where the ISS is right now.",
};

/** The beta angle the representative orbit is placed at. */
const TARGET_BETA_DEG = 25;

/**
 * Place the orbit plane for this session.
 *
 * Solves for the node that puts the plane at `betaDeg` to the Sun, then
 * starts the ship at the sunlit high point of that orbit. Both choices are
 * as representative as any other — and unlike an arbitrary node, they mean
 * the session reliably opens on a lit Earth rather than on a black one.
 *
 * @param {number} epochTt      session epoch, seconds of TT since J2000
 * @param {{x,y,z}} sunDirection unit vector toward the Sun, ECI
 * @param {number} [betaDeg]
 */
export function configureObservationOrbit(epochTt, sunDirection, betaDeg = TARGET_BETA_DEG) {
  const i = OBSERVATION_ORBIT.inclinationRad;
  const { x: sx, y: sy, z: sz } = sunDirection;

  // The orbit normal for node Ω is (sinΩ sin i, −cosΩ sin i, cos i), so
  //   sin β = n·ŝ = sin i · R · sin(Ω − φ) + cos i · s_z
  // with R and φ the polar form of the Sun's equatorial projection.
  const R = Math.hypot(sx, sy);
  const phi = Math.atan2(sy, sx);
  const wanted = (Math.sin(betaDeg * DEG) - Math.cos(i) * sz) / (Math.sin(i) * R);

  // If the requested beta is unreachable for this Sun position, take the
  // closest the geometry allows rather than producing a NaN.
  const clamped = Math.max(-1, Math.min(1, wanted));
  const raan = phi + Math.asin(clamped);

  OBSERVATION_ORBIT.epochTt = epochTt;
  OBSERVATION_ORBIT.raanAtEpochRad = raan;
  OBSERVATION_ORBIT.betaDeg = betaDeg;

  // Start at the point in the orbit where the ground below is most sunlit,
  // so the first thing anybody sees is a daylit Earth.
  OBSERVATION_ORBIT.argLatAtEpochRad = 0;
  let bestU = 0, bestElev = -Infinity;
  for (let k = 0; k < 360; k++) {
    OBSERVATION_ORBIT.argLatAtEpochRad = k * DEG;
    const p = positionAt(epochTt);
    const elev = (p.x * sx + p.y * sy + p.z * sz) / Math.hypot(p.x, p.y, p.z);
    if (elev > bestElev) { bestElev = elev; bestU = k * DEG; }
  }
  OBSERVATION_ORBIT.argLatAtEpochRad = bestU;

  return OBSERVATION_ORBIT;
}

const A = K.EARTH_RADIUS_EQ.value + OBSERVATION_ORBIT.altitudeM;

/** Mean motion, rad/s. About one orbit every 92.8 minutes at this altitude. */
export const MEAN_MOTION = Math.sqrt(K.GM_EARTH.value / (A * A * A));

/** Orbital period, seconds. */
export const PERIOD = (2 * Math.PI) / MEAN_MOTION;

/**
 * Nodal regression from Earth's equatorial bulge, rad/s.
 * dΩ/dt = −3/2 · n · J₂ · (Rₑ/a)² · cos i   (circular orbit, e = 0)
 * Negative for a prograde orbit: the plane drifts westward.
 */
export const NODE_RATE =
  -1.5 * MEAN_MOTION * K.EARTH_J2.value *
  Math.pow(K.EARTH_RADIUS_EQ.value / A, 2) *
  Math.cos(OBSERVATION_ORBIT.inclinationRad);

function positionAt(tt) {
  const dt = tt - OBSERVATION_ORBIT.epochTt;
  const u = OBSERVATION_ORBIT.argLatAtEpochRad + MEAN_MOTION * dt;   // argument of latitude
  const raan = OBSERVATION_ORBIT.raanAtEpochRad + NODE_RATE * dt;
  const i = OBSERVATION_ORBIT.inclinationRad;

  const cu = Math.cos(u), su = Math.sin(u);
  const cO = Math.cos(raan), sO = Math.sin(raan);
  const ci = Math.cos(i), si = Math.sin(i);

  return {
    x: A * (cu * cO - su * ci * sO),
    y: A * (cu * sO + su * ci * cO),
    z: A * (su * si),
  };
}

const DV = 1;

/** State of the observation point in the Earth-centred inertial frame. */
export function observationState(tt) {
  const p = positionAt(tt);
  const a = positionAt(tt - DV);
  const b = positionAt(tt + DV);
  return {
    position: p,
    velocity: {
      x: (b.x - a.x) / (2 * DV),
      y: (b.y - a.y) / (2 * DV),
      z: (b.z - a.z) / (2 * DV),
    },
  };
}

/** Orbital speed, m/s — about 7.66 km/s. Handy for the HUD. */
export const ORBITAL_SPEED = MEAN_MOTION * A;
