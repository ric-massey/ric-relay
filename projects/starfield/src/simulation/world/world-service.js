/* ══════════════════════════════════════════════════════════════════════
   world-service.js — assembles the frame graph and evaluates the world.

   Technical Architecture §7.1. This is the single place that knows how
   Earth, the Moon, the Sun and the observation point relate to each other,
   and it is the only place allowed to answer "where is X".

   Cross-model consistency (Scientific Standard §7.2) is the point: the
   HUD, the renderer, the map and the information panels all read the same
   state object, so they cannot disagree about where the Moon is.

   Frame tree for the slice (Technical Architecture §6.1):

     ECI ─ Earth-centred inertial, mean equator and equinox of date
      ├── ECEF  Earth-fixed, rotating with the planet
      ├── SUN   heliocentric-origin, ECI axes
      ├── OBS   the observation point's local frame
      └── MCI   Moon-centred inertial
           └── MCMF  Moon-fixed
   ══════════════════════════════════════════════════════════════════════ */

import { FrameGraph, translatingFrame, rotatingFrame } from "../frames/frame-graph.js";
import {
  moonStateEci, sunStateEci, earthOrientation, moonOrientation,
} from "./ephemeris.js";
import { observationState, configureObservationOrbit } from "./observation-point.js";
import { registerStationFrame, stationState, STATION } from "./station.js";
import { BODIES } from "./bodies.js";
import { planetStatesEci } from "./planets.js";
import { sunlitFraction } from "./shadow.js";
import { sub, length, normalize, dot, scale, add, v3 } from "../core/linalg.js";
import { K } from "../core/units.js";

export class WorldService {
  /** @param {import('../time/time-service.js').TimeService} time */
  constructor(time) {
    this.time = time;
    this.frames = new FrameGraph();

    // Place the representative orbit for this session's date before any
    // frame is built on it: the node depends on where the Sun is, and the
    // frame graph will start asking for the observation point immediately.
    configureObservationOrbit(
      time.epochTt,
      normalize(sunStateEci(time.epochTt).position)
    );

    this.frames
      .register({
        id: "ECI",
        parent: null,
        label: "Earth-centred inertial",
        note: "Origin at Earth's centre, axes fixed to the mean equator and equinox of date. " +
              "Does not rotate with the planet. This is the frame an orbit is an ellipse in.",
      })
      .register({
        id: "ECEF",
        parent: "ECI",
        label: "Earth-fixed",
        note: "Turns with the planet. Longitude and latitude are constants in this frame, " +
              "and everything in orbit appears to sweep past.",
        at: rotatingFrame(earthOrientation),
      })
      .register({
        id: "SUN",
        parent: "ECI",
        label: "Sun-centred",
        note: "Origin at the Sun, axes parallel to the Earth-centred frame.",
        at: translatingFrame(sunStateEci),
      })
      .register({
        id: "MCI",
        parent: "ECI",
        label: "Moon-centred inertial",
        note: "Origin at the Moon's centre. The frame lunar orbit and arrival are flown in.",
        at: translatingFrame(moonStateEci),
      })
      .register({
        id: "MCMF",
        parent: "MCI",
        label: "Moon-fixed",
        note: "Turns with the Moon — once per orbit, which is why one face always looks at us.",
        at: rotatingFrame(moonOrientation),
      })
      .register({
        id: "OBS",
        parent: "ECI",
        label: "observation point",
        note: "Local frame of the representative low orbit the session starts in.",
        at: translatingFrame(observationState),
      });

    // The station's local orbital frame — the one proximity operations are
    // actually flown in. It rotates once per orbit, so unlike every frame
    // above it, converting through it moves velocity as well as position.
    registerStationFrame(this.frames);

    /** Latest evaluated state. Read it; do not write it. */
    this.state = null;
    this.update();
  }

  /** Recompute everything for the current simulation time. */
  update() {
    const t = this.time.tt;

    const moon = moonStateEci(t);
    const sun = sunStateEci(t);
    const obs = observationState(t);

    const bodies = {
      earth: { id: "earth", frame: "ECI", position: v3(), velocity: v3() },
      moon: { id: "moon", frame: "ECI", ...moon },
      sun: { id: "sun", frame: "ECI", ...sun },
    };

    this.state = {
      t,
      bodies,
      /**
       * The planets, kept apart from `bodies`.
       *
       * `bodies` is the set the renderer draws as spheres with textures and
       * shadow terms, and everything iterating it assumes exactly that. A
       * planet in the Earth–Moon volume is an unresolved point of light —
       * Jupiter is two arcseconds across from here — so it belongs in the
       * sky pass with the stars, not in the body pass with the Moon. The
       * day the ship can actually fly to one, that stops being true, and
       * this is the seam where it will change.
       */
      planets: planetStatesEci(t),
      /**
       * The star catalogue, carried on the state so navigation can resolve
       * a selected star without the simulation layer reaching into the
       * presentation layer for it. Set once by the app; not rebuilt here,
       * because the sky does not change during a session.
       */
      stars: this.stars ?? [],
      observation: { frame: "ECI", ...obs },
      /**
       * The station. Not in `bodies`, deliberately: `bodies` is the set the
       * ephemeris places and the sky renders, and everything that iterates
       * it assumes a sphere with a radius and a phase. The station is a
       * structure you can fly into, which is a different kind of thing.
       */
      station: { id: "station", frame: "ECI", record: STATION, ...stationState(t) },
      /** Unit vector from Earth's centre toward the Sun, ECI. */
      sunDirection: normalize(sun.position),
    };

    /* How much of the Sun each thing can see. Computed here, once, so the
       renderer and the HUD cannot disagree about whether it is night —
       which is exactly how the station came to be lit by full sunlight
       while the eye model was fully dark-adapted for it. */
    this.state.station.sunlit = this.sunlitAt(this.state.station.position).fraction;
    // The Moon's own eclipses. Rare, and free: it is the same question.
    this.state.bodies.moon.sunlit = this.sunlitAt(moon.position, ["moon"]).fraction;

    return this.state;
  }

  /**
   * The fraction of the Sun's disc visible from a point in ECI, 0…1.
   *
   * @param {{x,y,z}} position
   * @param {string[]} [ignore]  body ids that cannot occlude — a body never
   *                             shadows itself, and the ship is inside the
   *                             station's bounding sphere while docked
   * @returns {{fraction:number, occludedBy:string|null}}
   */
  sunlitAt(position, ignore = []) {
    const s = this.state;
    const occluders = [];
    for (const id of ["earth", "moon"]) {
      if (ignore.includes(id)) continue;
      const rec = BODIES.find((b) => b.id === id);
      occluders.push({ id, position: s.bodies[id].position, radius: rec.radius.value });
    }
    return sunlitFraction(position, s.bodies.sun.position, K.SUN_RADIUS.value, occluders);
  }

  /** Position and velocity of a body, converted into any registered frame. */
  bodyState(id, frame = "ECI") {
    const s = this.state.bodies[id];
    if (!s) throw new Error(`unknown body '${id}'`);
    return this.frames.convert(s, frame, this.state.t);
  }

  /**
   * What an observer at `position` (in `frame`) sees of a body: how far, how
   * big, which way, and whether it is closing.
   */
  observe(bodyId, observer) {
    const b = this.bodyState(bodyId, observer.frame);
    const rec = BODIES.find((x) => x.id === bodyId);
    const offset = sub(b.position, observer.position);
    const range = length(offset);
    const direction = range > 0 ? scale(offset, 1 / range) : v3(0, 0, 1);
    const relVel = sub(b.velocity, observer.velocity);
    // Positive closing rate means the gap is shrinking.
    const closingRate = -dot(relVel, direction);
    const surfaceRange = range - rec.radius.value;

    return {
      id: bodyId,
      record: rec,
      position: b.position,
      direction,
      range,
      surfaceRange,
      relativeSpeed: length(relVel),
      closingRate,
      // Angular diameter as actually seen. 2·asin(r/d), not the small-angle
      // approximation, because from low orbit Earth subtends 137°.
      angularDiameter: range > rec.radius.value
        ? 2 * Math.asin(rec.radius.value / range)
        : Math.PI,
      /** Illuminated fraction of the disc, as seen from here. 1 = full. */
      phase: this._phaseOf(bodyId, observer),
      /** Unit vector from the body's centre toward the Sun. */
      sunDirection: this._sunDirectionFrom(bodyId, observer),
    };
  }

  /**
   * Mark which observations are hidden behind another body.
   *
   * This matters far more than it sounds. From a 420 km orbit the Earth
   * covers 140° of sky, so for a quarter of every orbit the Sun is behind
   * it — that is what orbital night *is*. Without this the eye model saw a
   * Sun that was 25° from the view axis, decided the player was staring
   * into it, and blacked out the sky at precisely the moment it should
   * have been at its most spectacular.
   *
   * The test is the same one that defines an eclipse: is the occulting
   * body closer than the target, and does it cover the direction to it?
   *
   * @param {Array} observations results of observe(), modified in place
   */
  markOcclusions(observations) {
    for (const target of observations) {
      target.occluded = false;
      target.occludedBy = null;
      for (const other of observations) {
        if (other === target || other.range >= target.range) continue;
        const sep = Math.acos(Math.max(-1, Math.min(1,
          target.direction.x * other.direction.x +
          target.direction.y * other.direction.y +
          target.direction.z * other.direction.z)));
        if (sep < other.angularDiameter / 2) {
          target.occluded = true;
          target.occludedBy = other.id;
          break;
        }
      }
    }
    return observations;
  }

  /** Which way the Sun lies, as seen from a body's centre. */
  _sunDirectionFrom(bodyId, observer) {
    if (bodyId === "sun") return v3();
    const b = this.bodyState(bodyId, observer.frame);
    const sun = this.bodyState("sun", observer.frame);
    return normalize(sub(sun.position, b.position));
  }

  /**
   * Illuminated fraction: (1 + cos ψ)/2 where ψ is the Sun–body–observer
   * angle. The same formula that gives the Moon its phases, and it gives
   * Earth phases too — which is the thing that surprises people.
   */
  _phaseOf(bodyId, observer) {
    if (bodyId === "sun") return 1;
    const b = this.bodyState(bodyId, observer.frame);
    const sun = this.bodyState("sun", observer.frame);
    const toObserver = normalize(sub(observer.position, b.position));
    const toSun = normalize(sub(sun.position, b.position));
    return (1 + dot(toObserver, toSun)) / 2;
  }

  /** Altitude above Earth's mean surface, metres. Negative means underground. */
  altitudeAboveEarth(position, frame = "ECI") {
    const p = this.frames.convertPosition(position, frame, "ECI", this.state.t);
    return length(p) - K.EARTH_RADIUS_MEAN.value;
  }

  /**
   * Sub-observer point on Earth: the latitude and longitude you are directly
   * above. Requires the Earth-fixed frame — which is exactly why the frame
   * graph exists.
   */
  groundTrack(position, frame = "ECI") {
    const p = this.frames.convertPosition(position, frame, "ECEF", this.state.t);
    const r = length(p);
    if (r === 0) return null;
    return {
      latitudeDeg: (Math.asin(p.z / r) * 180) / Math.PI,
      longitudeDeg: (Math.atan2(p.y, p.x) * 180) / Math.PI,
      altitudeM: r - K.EARTH_RADIUS_MEAN.value,
    };
  }
}

/** Handy for tests and the HUD: a state at rest at a point in a frame. */
export const stateAt = (frame, position) => ({ frame, position, velocity: v3() });

export { add, sub };
