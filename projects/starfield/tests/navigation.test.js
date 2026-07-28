/* ══════════════════════════════════════════════════════════════════════
   navigation.test.js — destinations, route previews, and flying them.

   The flip-and-burn arithmetic is checked against the closed form worked
   by hand, and the executor is checked by actually flying it: the last
   suite integrates the ship all the way to the Moon at a fixed step and
   asserts it arrives, stops, and does not pass through anything.

   That integration is the test that matters. A route planner can be
   perfectly self-consistent and still describe a trajectory the executor
   never flies, which is the failure §7.3 is guarding against when it asks
   the autopilot to re-plan rather than replay.
   ══════════════════════════════════════════════════════════════════════ */

import { suite, assert } from "./harness.js";
import {
  destinations, destinationById, planRoute, flipAndBurn, Autopilot,
} from "../src/simulation/ship/navigation.js";
import { WorldService } from "../src/simulation/world/world-service.js";
import { TimeService } from "../src/simulation/time/time-service.js";
import { SHIP } from "../src/simulation/ship/ship.js";
import { integrate } from "../src/simulation/ship/gravity.js";
import { add, scale, sub, length } from "../src/simulation/core/linalg.js";

const world = () => {
  const time = new TimeService();
  return { time, world: new WorldService(time) };
};

suite("navigation — flip and burn", ({ test }) => {
  test("the half-way flip is where the closed form puts it", () => {
    // d = 1000 m at a = 2 m/s². Half-time √(d/a) = √500 = 22.3607 s,
    // total 44.7214 s, peak speed a·t = 44.7214 m/s.
    const p = flipAndBurn(1000, 2);
    assert.close(p.time, 44.72136, 1e-4, "trip time", " s");
    assert.close(p.peakSpeed, 44.72136, 1e-4, "peak speed", " m/s");
    assert.close(p.boostTime, 22.36068, 1e-4, "boost time", " s");
    assert.equal(p.cruiseTime, 0, "an uncapped run has no cruise");
  });

  test("a speed cap turns the profile into boost, cruise, brake", () => {
    // Same run, capped at 10 m/s. Boost 5 s, brake 5 s, and the two burns
    // cover v²/a = 50 m between them, leaving 950 m at 10 m/s = 95 s.
    const p = flipAndBurn(1000, 2, 10);
    assert.close(p.boostTime, 5, 1e-9, "boost time", " s");
    assert.close(p.cruiseTime, 95, 1e-9, "cruise time", " s");
    assert.close(p.time, 105, 1e-9, "trip time", " s");
    assert.close(p.peakSpeed, 10, 1e-9, "peak speed", " m/s");
  });

  test("a cap above the natural peak changes nothing", () => {
    const free = flipAndBurn(1000, 2);
    const capped = flipAndBurn(1000, 2, 1000);
    assert.close(capped.time, free.time, 1e-9, "trip time", " s");
    assert.equal(capped.cruiseTime, 0, "no cruise phase");
  });

  test("zero distance is zero time, and zero authority never arrives", () => {
    assert.equal(flipAndBurn(0, 30).time, 0, "no distance, no time");
    assert.equal(flipAndBurn(1000, 0).time, Infinity, "no thrust, no arrival");
  });
});

suite("navigation — destinations and previews", ({ test }) => {
  test("everything the slice contains can be selected", () => {
    const { world: w } = world();
    const ids = destinations(w.state).map((d) => d.id).sort();
    assert.equal(
      ids.join(","),
      "earth,jupiter,mars,mercury,moon,neptune,saturn,station,sun,uranus,venus",
      "selectable destinations"
    );
  });

  test("a planet is a real destination, not a label on the sky", () => {
    // Ric, 2026-07-28: the other planets have to be places you can go.
    const { world: w } = world();
    const jupiter = destinationById(w.state, "jupiter");
    assert.ok(jupiter, "Jupiter is selectable");
    assert.relative(jupiter.radius, 71492000, 1e-6, "at its real radius");
    assert.ok(jupiter.standoff > jupiter.radius, "with a standoff outside the planet");

    // Somewhere between 4.0 and 6.5 au from Earth, always — that is the
    // whole range the geometry allows, so anything outside it is a bug in
    // the elements rather than a matter of which day the test ran.
    const range = Math.hypot(jupiter.position.x, jupiter.position.y, jupiter.position.z);
    const au = range / 1.495978707e11;
    assert.ok(au > 3.9 && au < 6.6, `Jupiter is ${au.toFixed(2)} au away, which is a distance Jupiter reaches`);
    assert.ok(jupiter.velocity && Number.isFinite(jupiter.velocity.x), "and carries a velocity");
  });

  test("a destination carries what the selection panel has to show", () => {
    const { world: w } = world();
    const moon = destinationById(w.state, "moon");
    assert.ok(moon.label.length > 0, "has a label");
    assert.ok(moon.radius > 0, "has a radius");
    assert.ok(moon.standoff > moon.radius, "stops outside the body, not inside it");
    assert.ok(moon.velocity && typeof moon.velocity.x === "number", "carries velocity, for the closing rate");
  });

  test("planning does not change anything", () => {
    const { world: w } = world();
    const ship = { position: { x: 6.8e6, y: 0, z: 0 }, velocity: { x: 0, y: 7660, z: 0 } };
    const before = JSON.stringify(w.state.bodies.moon.position);
    const shipBefore = JSON.stringify(ship);
    planRoute({ ship, destination: destinationById(w.state, "moon"), state: w.state });
    planRoute({ ship, destination: destinationById(w.state, "moon"), state: w.state });
    assert.equal(JSON.stringify(w.state.bodies.moon.position), before, "world untouched");
    assert.equal(JSON.stringify(ship), shipBefore, "ship untouched");
  });

  test("the preview carries every field §7.2 asks for", () => {
    const { world: w } = world();
    const ship = { position: { x: 6.8e6, y: 0, z: 0 }, velocity: { x: 0, y: 7660, z: 0 } };
    const r = planRoute({ ship, destination: destinationById(w.state, "moon"), state: w.state });
    for (const field of [
      "destinationLabel", "departureFrame", "arrivalFrame", "phases", "duration",
      "maxAcceleration", "closestApproaches", "brakingStartsAt", "arrivalSpeed",
      "uncertainties",
    ]) {
      assert.ok(r[field] !== undefined && r[field] !== null, `preview is missing ${field}`);
    }
    assert.ok(r.phases.length >= 3, "a route has phases");
    assert.equal(r.arrivalSpeed, 0, "the ship stops on arrival");
  });

  test("Earth to the Moon at 3 g takes about two hours, and the number is not hidden", () => {
    const { world: w } = world();
    const ship = { position: { x: 6.8e6, y: 0, z: 0 }, velocity: { x: 0, y: 7660, z: 0 } };
    const moon = destinationById(w.state, "moon");
    const r = planRoute({ ship, destination: moon, state: w.state });
    // Distance varies over the month between about 363 000 and 406 000 km,
    // so this is a band rather than a number: at 30 m/s² the crossing is
    // between roughly 105 and 120 minutes. If this ever fails low, someone
    // has shortened the distance.
    const minutes = r.duration / 60;
    assert.ok(minutes > 100 && minutes < 130,
      `Earth–Moon crossing came out at ${minutes.toFixed(1)} minutes`);
    assert.ok(r.peakSpeed > 90e3 && r.peakSpeed < 130e3,
      `peak speed ${(r.peakSpeed / 1000).toFixed(0)} km/s`);
  });

  test("a route straight through the Earth is refused, with the reason", () => {
    const { world: w } = world();
    // Sit on the far side of Earth from the Moon, so the planet is between.
    const moon = destinationById(w.state, "moon");
    const away = scale(moon.position, -1 / length(moon.position));
    const ship = { position: scale(away, 6.8e6), velocity: { x: 0, y: 0, z: 0 } };
    const r = planRoute({ ship, destination: moon, state: w.state });
    assert.ok(r.blocked, "the planner did not notice the planet in the way");
    assert.ok(/earth/i.test(r.blocked), `reason should name Earth, got: ${r.blocked}`);

    const auto = new Autopilot();
    const refusal = auto.engage(r);
    assert.ok(refusal, "engaging a blocked route must be refused");
    assert.ok(!auto.engaged, "and must not engage");
  });
});

suite("navigation — flying the route", ({ test }) => {
  test("the autopilot reaches the station and stops there", () => {
    const { time, world: w } = world();
    const st = w.state.station;
    // Start 40 km from the station, drifting sideways at 20 m/s so the
    // lateral controller has something to do.
    const ship = {
      position: add(st.position, { x: 40000, y: 0, z: 0 }),
      velocity: add(st.velocity, { x: 0, y: 20, z: 0 }),
    };
    const target = destinationById(w.state, "station");
    const auto = new Autopilot();
    assert.equal(auto.engage(planRoute({ ship, destination: target, state: w.state })), null, "engaged");

    /* Integrated under gravity, the way the app flies it. Without it the
       ship coasts in a straight line while the station curves away on its
       orbit, and the autopilot is asked to supply the whole 8.9 m/s² of
       centripetal acceleration out of a lateral budget that was never
       meant to carry it. Both bodies are in free fall in the real thing,
       so all the controller ever sees is genuine relative drift. */
    const dt = 1 / 30;
    const phases = new Set();
    /* A flip-and-burn brakes once. Counting the times it goes back to
       accelerating after it has started braking is how a limit cycle shows
       up as a number: the first version of this controller compared the
       stopping distance to the distance left and chattered all the way in,
       and every one of those flips is the ship visibly spinning end over
       end in front of the player. */
    let brakeToBoostFlips = 0;
    let lastPhase = null;
    let steps = 0;
    while (auto.engaged && steps < 60 * 30 * 30) {           // 30 minutes, hard cap
      const out = auto.step({ ship, state: w.state });
      if (out) {
        phases.add(out.phase);
        if (lastPhase === "brake" && out.phase === "boost") brakeToBoostFlips++;
        lastPhase = out.phase;
      }
      const next = integrate(ship, dt, out ? out.accelEci : { x: 0, y: 0, z: 0 });
      ship.position = next.position;
      ship.velocity = next.velocity;
      time.advance(dt); w.update();
      steps++;
    }

    assert.ok(!auto.engaged, `autopilot never finished; ran ${steps} steps`);
    assert.ok(auto.result?.ok, `autopilot gave up: ${auto.result?.reason}`);
    assert.ok(phases.has("boost") && phases.has("brake"), `expected boost and brake, saw ${[...phases]}`);
    assert.ok(brakeToBoostFlips <= 1,
      `the ship flipped from braking back to accelerating ${brakeToBoostFlips} times — the controller is chattering`);

    const live = destinationById(w.state, "station");
    const range = length(sub(live.position, ship.position));
    const relSpeed = length(sub(ship.velocity, live.velocity));
    // Arrived means at the standoff and at rest relative to the station.
    assert.ok(range > live.radius, `ended up ${range.toFixed(0)} m out — inside the station`);
    assert.ok(range < live.standoff + live.radius + 2000,
      `stopped ${(range / 1000).toFixed(1)} km out, standoff is ${((live.standoff + live.radius) / 1000).toFixed(1)} km`);
    assert.ok(relSpeed < 1, `arrived doing ${relSpeed.toFixed(3)} m/s relative to the station`);
  });

  test("manual input disengages at once, and keeps the destination", () => {
    const { world: w } = world();
    const ship = { position: { x: 6.8e6, y: 0, z: 0 }, velocity: { x: 0, y: 7660, z: 0 } };
    const auto = new Autopilot();
    auto.engage(planRoute({ ship, destination: destinationById(w.state, "moon"), state: w.state }));
    assert.ok(auto.engaged, "engaged");

    auto.disengage("manual input");
    assert.ok(!auto.engaged, "disengaged immediately");
    assert.equal(auto.step({ ship, state: w.state }), null, "and commands nothing after");
    assert.equal(auto.destinationId, "moon", "the destination survives disengagement");
    assert.equal(auto.result.reason, "manual input", "the reason is kept for the HUD");
  });

  test("the braking decision is the same arithmetic the HUD shows", () => {
    const { world: w } = world();
    const target = destinationById(w.state, "station");
    const auto = new Autopilot();
    // Head straight at the station fast enough that it must already be braking:
    // v²/2a with v = 3000 m/s and a ≈ 29 m/s² is about 155 km, so from 100 km
    // out there is no version of this that is still accelerating.
    const dir = { x: -1, y: 0, z: 0 };            // from the ship toward the station
    const ship = {
      position: add(target.position, { x: 100000, y: 0, z: 0 }),
      velocity: add(target.velocity, scale(dir, 3000)),
    };
    auto.engage(planRoute({ ship, destination: target, state: w.state }));
    const out = auto.step({ ship, state: w.state });
    assert.equal(out.phase, "brake", "should be braking, not boosting");
    // And the commanded acceleration opposes the approach.
    assert.ok(out.accelEci.x > 0, "brake should push away from the station");
  });
});
