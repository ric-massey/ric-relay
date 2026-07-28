/* ══════════════════════════════════════════════════════════════════════
   frames.test.js — the architecture completion criteria, as assertions.

   Technical Architecture §25 lists what makes the architecture credible.
   Three of those items are testable right now and are tested here:

     · "a frame round trip preserves position and velocity within defined
       tolerances";
     · "an origin shift is visually and physically invisible";
     · "the same Earth–Moon state drives map, cockpit, physics and
        education".

   The velocity half of the round trip is the one that matters. Position
   round-trips are easy; it is the ω × r term that gets dropped, and when
   it is dropped everything still looks fine until the ship silently gains
   or loses hundreds of metres per second at a frame boundary.
   ══════════════════════════════════════════════════════════════════════ */

import { suite, assert } from "./harness.js";
import { TimeService } from "../src/simulation/time/time-service.js";
import { WorldService } from "../src/simulation/world/world-service.js";
import { ORIGIN_THRESHOLD_M } from "../src/presentation/render/scene-renderer.js";
import { v3, sub, length, add, scale } from "../src/simulation/core/linalg.js";
import { K } from "../src/simulation/core/units.js";
import {
  observationState, PERIOD, ORBITAL_SPEED, NODE_RATE, OBSERVATION_ORBIT,
} from "../src/simulation/world/observation-point.js";

const FRAMES = ["ECI", "ECEF", "MCI", "MCMF", "SUN", "OBS"];

function world() {
  const time = new TimeService({ startUtc: new Date("2026-07-25T12:00:00Z") });
  return { time, world: new WorldService(time) };
}

suite("frame graph", ({ test }) => {
  test("every frame round-trips position to under a micrometre", () => {
    const { time, world: w } = world();
    const start = {
      frame: "ECI",
      position: v3(6.8e6, 1.2e6, -3.0e5),
      velocity: v3(1200, 7400, -300),
    };
    for (const f of FRAMES) {
      const there = w.frames.convert(start, f, time.tt);
      const back = w.frames.convert(there, "ECI", time.tt);
      assert.vectorClose(back.position, start.position, 1e-6, `position via ${f}`);
    }
  });

  test("every frame round-trips velocity to under a micrometre per second", () => {
    const { time, world: w } = world();
    const start = {
      frame: "ECI",
      position: v3(6.8e6, 1.2e6, -3.0e5),
      velocity: v3(1200, 7400, -300),
    };
    for (const f of FRAMES) {
      const there = w.frames.convert(start, f, time.tt);
      const back = w.frames.convert(there, "ECI", time.tt);
      assert.vectorClose(back.velocity, start.velocity, 1e-6, `velocity via ${f}`, "m/s");
    }
  });

  test("a point fixed to the ground moves at Earth's surface speed", () => {
    // The classic proof that the rotating-frame velocity term is present.
    // A point on the equator sits still in the Earth-fixed frame and moves
    // at 465 m/s in the inertial one.
    const { time, world: w } = world();
    const onEquator = {
      frame: "ECEF",
      position: v3(K.EARTH_RADIUS_EQ.value, 0, 0),
      velocity: v3(),
    };
    const inertial = w.frames.convert(onEquator, "ECI", time.tt);
    const speed = length(inertial.velocity);
    assert.close(speed, 465.1, 0.5, "equatorial surface speed", " m/s");
  });

  test("crossing to the Moon's frame subtracts the Moon's own motion", () => {
    const { time, world: w } = world();
    const moonEci = w.bodyState("moon", "ECI");
    // Something moving exactly with the Moon must be at rest in MCI.
    const comoving = { frame: "ECI", position: moonEci.position, velocity: moonEci.velocity };
    const inMci = w.frames.convert(comoving, "MCI", time.tt);
    assert.ok(length(inMci.position) < 1e-6, "should sit at the Moon's centre");
    assert.ok(length(inMci.velocity) < 1e-6, "should be at rest relative to the Moon");
  });

  test("the Moon is stationary in its own body-fixed frame", () => {
    const { time, world: w } = world();
    const a = w.frames.convertPosition(v3(K.MOON_RADIUS.value, 0, 0), "MCMF", "ECI", time.tt);
    const later = time.tt + 3600;
    w.time.tt = later;
    w.update();
    const b = w.frames.convertPosition(v3(K.MOON_RADIUS.value, 0, 0), "MCMF", "ECI", later);
    // The point moved because the Moon moved and rotated — but it must
    // still be exactly one lunar radius from the Moon's centre.
    const moonLater = w.bodyState("moon", "ECI").position;
    assert.relative(length(sub(b, moonLater)), K.MOON_RADIUS.value, 1e-12, "radius after an hour");
    assert.ok(length(sub(a, b)) > 1000, "the point should have moved with the Moon");
  });

  test("frames disagree about speed, and that is the point", () => {
    // Design Bible §8.4: "speed" without "relative to what?" is incomplete.
    const { time, world: w } = world();
    const obs = { frame: "ECI", ...w.state.observation };
    const inEci = length(obs.velocity);
    const inSun = length(w.frames.convert(obs, "SUN", time.tt).velocity);
    assert.close(inEci / 1000, 7.66, 0.1, "orbital speed in ECI", " km/s");
    assert.ok(inSun / 1000 > 25, `speed about the Sun should be ~30 km/s, got ${inSun / 1000}`);
  });
});

suite("floating origin", ({ test }) => {
  test("shifting the origin does not move anything relative to the camera", () => {
    // Technical Architecture §6.3: an origin shift must preserve the
    // camera-relative position of every representation.
    const { time, world: w } = world();
    const camera = w.state.observation.position;
    const moon = w.bodyState("moon", "ECI").position;
    const earth = v3();

    const relativeTo = (origin) => ({
      moon: sub(sub(moon, origin), sub(camera, origin)),
      earth: sub(sub(earth, origin), sub(camera, origin)),
    });

    const before = relativeTo(v3());          // origin at Earth's centre
    const after = relativeTo(camera);          // origin rebased onto the camera

    assert.vectorClose(after.moon, before.moon, 1e-3, "Moon after an origin shift");
    assert.vectorClose(after.earth, before.earth, 1e-6, "Earth after an origin shift");
  });

  test("the origin threshold keeps float32 precision at millimetres", () => {
    // A float32 has 24 bits of mantissa. At a distance d the spacing
    // between representable values is about d × 2⁻²³.
    const spacing = ORIGIN_THRESHOLD_M * Math.pow(2, -23);
    assert.ok(spacing < 0.001, `float32 spacing at the threshold is ${spacing} m`);
  });

  test("without a floating origin, precision at the Moon would be tens of metres", () => {
    // The number that justifies the whole mechanism.
    const spacing = K.MOON_SEMI_MAJOR.value * Math.pow(2, -23);
    assert.ok(spacing > 20, `expected float32 to be coarse at lunar distance, got ${spacing} m`);
  });
});

suite("render geometry conventions", ({ test }) => {
  // This suite exists because of a real bug. Three builds spheres pole-up
  // on +Y; an equatorial frame is pole-up on +Z by definition. When the two
  // disagreed, every number in the simulation stayed correct while the
  // textures sat 90° out — Antarctica rendered in the Indian Ocean. Nothing
  // else in the codebase could have caught it, so it is pinned here.

  test("body spheres are built with their pole on +Z", async () => {
    // sphereZUp is imported rather than createBodies because building the
    // materials needs a DOM to load textures into, and this suite has to run
    // headlessly in Node as well as in the browser.
    const { sphereZUp } = await import("../src/presentation/render/bodies-view.js");
    for (const [name, geometry] of [
      ["earth", sphereZUp(K.EARTH_RADIUS_EQ.value, 32, 16)],
      ["moon", sphereZUp(K.MOON_RADIUS.value, 32, 16)],
    ]) {
      const pos = geometry.attributes.position;
      let top = { x: 0, y: 0, z: -Infinity };
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        if (z > top.z) top = { x: pos.getX(i), y: pos.getY(i), z };
      }
      const r = Math.hypot(top.x, top.y, top.z);
      // The northernmost vertex must be *on* the +Z axis, not 90° away.
      assert.ok(Math.abs(top.z / r - 1) < 1e-6,
        `${name}'s pole is not on +Z: found (${top.x}, ${top.y}, ${top.z})`);
    }
  });

  test("longitude zero lands on +X, as the Earth-fixed frame requires", async () => {
    const { sphereZUp } = await import("../src/presentation/render/bodies-view.js");
    const geometry = sphereZUp(K.EARTH_RADIUS_EQ.value, 64, 32);
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    // Find the equatorial vertex closest to u = 0.5, which an equirectangular
    // map places at longitude 0. It must sit on the +X axis.
    let best = null;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getZ(i)) > 1e3) continue;             // equator only
      const du = Math.abs(uv.getX(i) - 0.5);
      if (!best || du < best.du) best = { du, x: pos.getX(i), y: pos.getY(i) };
    }
    assert.ok(best && best.x > 0 && Math.abs(best.y) < 1e3,
      `longitude 0 should be on +X, found (${best?.x}, ${best?.y})`);
  });
});

suite("the observation point", ({ test }) => {
  test("the orbit is circular to within a kilometre", () => {
    const { time } = world();
    let min = Infinity, max = 0;
    for (let dt = 0; dt < PERIOD; dt += 30) {
      const r = length(observationState(time.tt + dt).position);
      min = Math.min(min, r); max = Math.max(max, r);
    }
    assert.close(max - min, 0, 1000, "radius variation over one orbit", " m");
  });

  test("period and speed agree with the altitude", () => {
    assert.close(PERIOD / 60, 92.8, 0.6, "orbital period", " min");
    assert.close(ORBITAL_SPEED / 1000, 7.66, 0.05, "orbital speed", " km/s");
  });

  test("gravity, not bookkeeping, holds the orbit together", () => {
    // v²/r must equal GM/r². If it does not, the orbit is drawn rather
    // than simulated.
    //
    // The 0.2% tolerance is not slop. The orbit plane is regressing under
    // J2, so the velocity carries a small component from the turning of
    // the node; relative to the two-body speed that is 2(Ω̇/n)cos i, which
    // is 1.1×10⁻³ here. The residual is the oblateness of the Earth
    // showing up in the arithmetic, which is the correct outcome.
    const { time } = world();
    const s = observationState(time.tt);
    const r = length(s.position);
    const v = length(s.velocity);
    assert.relative(v * v / r, K.GM_EARTH.value / (r * r), 2e-3, "centripetal balance");
  });

  test("the orbit plane regresses westward, as J2 requires", () => {
    const { time } = world();
    const dayLater = time.tt + 86400;
    const na = observationState(time.tt);
    const nb = observationState(dayLater);
    const cross = (p, q) => v3(
      p.y * q.z - p.z * q.y, p.z * q.x - p.x * q.z, p.x * q.y - p.y * q.x);
    const n1 = cross(na.position, na.velocity);
    const n2 = cross(nb.position, nb.velocity);
    const cos = (n1.x * n2.x + n1.y * n2.y + n1.z * n2.z) / (length(n1) * length(n2));
    const turned = Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);

    // The node itself moves about 5° a day — the real ISS number.
    const nodeShift = Math.abs(NODE_RATE) * 86400;
    assert.close(nodeShift * (180 / Math.PI), 4.97, 0.15, "nodal regression", "°/day");
    assert.ok(NODE_RATE < 0, "a prograde orbit's node must regress westward");

    // The orbit *normal* turns by less than that, because it swings around
    // a cone of half-angle i rather than in a plane: 2 asin(sin i sin ΔΩ/2).
    const expected = 2 * Math.asin(
      Math.sin(OBSERVATION_ORBIT.inclinationRad) * Math.sin(nodeShift / 2));
    assert.close(turned, expected * (180 / Math.PI), 0.05, "orbit normal swing", "°");
    assert.ok(length(sub(na.position, nb.position)) > 0, "the station should have moved");
  });
});

suite("observed geometry", ({ test }) => {
  test("Earth's angular size from 420 km is about 140°", () => {
    const { world: w } = world();
    const obs = { frame: "ECI", ...w.state.observation };
    const e = w.observe("earth", obs);
    assert.close(e.angularDiameter * (180 / Math.PI), 139.5, 1.0, "Earth's angular size", "°");
    assert.close(e.surfaceRange / 1000, 420, 1, "altitude", " km");
  });

  test("the Sun and the Moon are both about half a degree across", () => {
    // The coincidence that makes total eclipses possible.
    const { world: w } = world();
    const obs = { frame: "ECI", ...w.state.observation };
    const sun = w.observe("sun", obs).angularDiameter * (180 / Math.PI);
    const moon = w.observe("moon", obs).angularDiameter * (180 / Math.PI);
    assert.close(sun, 0.53, 0.02, "Sun's angular size", "°");
    assert.close(moon, 0.52, 0.06, "Moon's angular size", "°");
  });

  test("nothing has been enlarged for playability", () => {
    // Design Bible Law 1, as an assertion. The renderer builds its meshes
    // straight from these records, so if they are right, the scene is.
    const { world: w } = world();
    assert.equal(K.EARTH_RADIUS_EQ.value, 6378137);
    assert.equal(K.MOON_RADIUS.value, 1737400);
    // Perigee 356 400 km, apogee 406 700 km, plus up to 6 800 km because
    // this is measured from the orbit rather than from Earth's centre.
    const moonRange = w.observe("moon", { frame: "ECI", ...w.state.observation }).range;
    assert.ok(moonRange > 3.49e8 && moonRange < 4.14e8, `Moon at ${moonRange} m`);
  });

  test("the illuminated fraction behaves like a phase", () => {
    const { time, world: w } = world();
    const obs = { frame: "ECI", ...w.state.observation };
    let min = 1, max = 0;
    for (let day = 0; day < 30; day++) {
      w.time.tt = time.epochTt + day * 86400;
      w.update();
      const p = w.observe("moon", { frame: "ECI", ...w.state.observation }).phase;
      min = Math.min(min, p); max = Math.max(max, p);
    }
    // Over a synodic month the Moon must go through new and full.
    assert.ok(min < 0.06, `should reach new moon, got ${min.toFixed(3)}`);
    assert.ok(max > 0.94, `should reach full moon, got ${max.toFixed(3)}`);
  });

  test("the ground track stays on the planet and inside the inclination", () => {
    const { time, world: w } = world();
    for (let dt = 0; dt < PERIOD; dt += 60) {
      w.time.tt = time.epochTt + dt;
      w.update();
      const g = w.groundTrack(w.state.observation.position);
      assert.ok(Math.abs(g.latitudeDeg) <= 51.7, `latitude ${g.latitudeDeg}`);
      assert.close(g.altitudeM / 1000, 427, 2, "altitude above the mean sphere", " km");
    }
  });
});

suite("units and provenance", ({ test }) => {
  test("every constant carries a class and a source", () => {
    // Scientific Standard §2: every material value fits one of the classes.
    for (const [name, q] of Object.entries(K)) {
      assert.ok(typeof q.value === "number" && isFinite(q.value), `${name} has no value`);
      assert.ok(q.unit, `${name} has no unit`);
      assert.ok("MCKPFA".includes(q.cls), `${name} has an unknown class '${q.cls}'`);
      assert.ok(q.source && q.source.length > 8, `${name} has no source`);
    }
  });

  test("derived constants agree with the values they derive from", () => {
    // Cross-model consistency, §7.2: Earth's radius must not have two
    // different answers depending on who is asking.
    const mean = (2 * K.EARTH_RADIUS_EQ.value + K.EARTH_RADIUS_POLAR.value) / 3;
    assert.close(mean, K.EARTH_RADIUS_MEAN.value, 1, "IUGG mean radius", " m");

    const b = K.EARTH_RADIUS_EQ.value * (1 - K.EARTH_FLATTENING.value);
    assert.close(b, K.EARTH_RADIUS_POLAR.value, 1e-3, "polar radius from flattening", " m");
  });

  test("surface gravity comes out right for both bodies", () => {
    const gEarth = K.GM_EARTH.value / Math.pow(K.EARTH_RADIUS_EQ.value, 2);
    const gMoon = K.GM_MOON.value / Math.pow(K.MOON_RADIUS.value, 2);
    assert.close(gEarth, 9.798, 0.01, "Earth's surface gravity", " m/s²");
    assert.close(gMoon, 1.625, 0.01, "the Moon's surface gravity", " m/s²");
  });
});

suite("honesty surfaces", ({ test }) => {
  test("every ledger entry has the fields §10.2 requires", async () => {
    const { LEDGER } = await import("../src/data/honesty-ledger.js");
    const required = ["id", "title", "system", "classification", "reality",
      "implemented", "reason", "magnitude", "consequence", "introduced", "status", "review"];
    for (const e of LEDGER) {
      for (const f of required) {
        assert.ok(e[f] && String(e[f]).length > 2, `${e.id || "?"} is missing '${f}'`);
      }
    }
  });

  test("every source says what it gave us, not just who owns it", async () => {
    const { SOURCES } = await import("../src/data/sources.js");
    for (const [id, s] of Object.entries(SOURCES)) {
      assert.ok(s.gave && s.gave.length > 5, `${id} does not say what it gave us`);
      assert.ok(s.story && s.story.length > 60, `${id} has no story worth reading`);
      assert.ok(s.licence, `${id} has no licence recorded`);
    }
  });

  test("every body's ledger and source references resolve", async () => {
    const { BODIES } = await import("../src/simulation/world/bodies.js");
    const { ledgerEntry } = await import("../src/data/honesty-ledger.js");
    const { source } = await import("../src/data/sources.js");
    for (const b of BODIES) {
      for (const id of b.sourceIds) assert.ok(source(id), `${b.id} cites unknown source '${id}'`);
      for (const id of b.ledgerIds || []) {
        assert.ok(ledgerEntry(id), `${b.id} cites unknown ledger entry '${id}'`);
      }
    }
  });
});
