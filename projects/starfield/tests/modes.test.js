/* ══════════════════════════════════════════════════════════════════════
   modes.test.js — the five modes, and the governor that makes them safe.

   Two of the numbers in `modes.js` are Ric's, given 2026-07-26, and the
   tests that pin them are the first two here. They are written as
   *behaviour* rather than as constants — re-integrating the crossing
   instead of asserting the authority — so that tuning any part of the
   governor cannot quietly move the thing that was actually decided.
   ══════════════════════════════════════════════════════════════════════ */

import { suite, assert } from "./harness.js";
import {
  FLIGHT_MODES, modeById, governedSpeed, nearestClearance, clearanceAhead,
  isFiction, canStopInstantly,
} from "../src/simulation/ship/modes.js";
import { Ship, SHIP } from "../src/simulation/ship/ship.js";
import { FlightModel } from "../src/simulation/ship/flight-model.js";
import { stationReference, relativeVelocity } from "../src/simulation/ship/flight-computer.js";
import { length } from "../src/simulation/core/linalg.js";
import { K } from "../src/simulation/core/units.js";
import { WorldService } from "../src/simulation/world/world-service.js";
import { TimeService } from "../src/simulation/time/time-service.js";

const RE = K.EARTH_RADIUS_EQ.value;
const RM = K.MOON_RADIUS.value;
const C = 299792458;

/**
 * Time to cross from a 420 km orbit to a lunar standoff, flying the
 * governed speed the whole way. Independent of the flight model on
 * purpose: this integrates dx/v(x) directly from the governor, so it
 * measures the rule rather than the implementation that obeys it.
 *
 * The clearance is the **Moon's alone**, because the governor became
 * directional on 2026-07-28 (`clearanceAhead`) and a ship flying to the
 * Moon has Earth behind it the entire way. This used to take the smaller
 * of the two — a V that charged you for the departure as well as the
 * arrival — and that is precisely the half that was deleted. Keeping the
 * old V here would leave the anchor passing while the ship flew something
 * else, which is the one thing an anchor must never do.
 */
function governedCrossingSeconds(mode, moonDistance) {
  const start = RE + 420000;
  const end = moonDistance - RM * 3;
  const N = 200000;
  const dx = (end - start) / N;
  let t = 0;
  for (let i = 0; i < N; i++) {
    const x = start + dx * (i + 0.5);
    const clearance = moonDistance - x - RM;      // what is *ahead* of you
    t += dx / governedSpeed(mode, Math.max(clearance, 1));
  }
  return t;
}

suite("flight modes — the ladder", ({ test }) => {
  test("there are five, numbered 1 to 5, each named for a place", () => {
    assert.equal(FLIGHT_MODES.length, 5, "five modes");
    assert.equal(FLIGHT_MODES.map((m) => m.id).join(""), "12345", "numbered 1–5");
    for (const m of FLIGHT_MODES) {
      assert.ok(m.name && m.forWhat, `${m.key} must say what it is for`);
      // The decision was that a mode names a situation, not a speed. A mode
      // called "Fast" would pass every other test in this file and lose it.
      assert.ok(!/slow|fast|speed|gear/i.test(m.name), `${m.name} names a speed, not a place`);
    }
  });

  test("both speed and authority climb with every mode", () => {
    for (let i = 1; i < FLIGHT_MODES.length; i++) {
      assert.ok(FLIGHT_MODES[i].topSpeed > FLIGHT_MODES[i - 1].topSpeed,
        `mode ${i + 1} is not faster than mode ${i}`);
      assert.ok(FLIGHT_MODES[i].authority > FLIGHT_MODES[i - 1].authority,
        `mode ${i + 1} has no more authority than mode ${i}`);
    }
  });

  test("every mode can actually reach its own top speed, and quickly", () => {
    /* The bug this pins was not a tuning problem, it was arithmetic nobody
       had done: `authority` and `topSpeed` were each chosen sensibly and
       never divided into one another, so mode 4 needed 87 years of
       acceleration to reach the speed the HUD printed for it and mode 5
       needed 150 million. A mode whose top speed is unreachable is a lie on
       the glass, so this checks the division directly. */
    for (const m of FLIGHT_MODES) {
      const seconds = m.spoolSeconds > 0 ? m.spoolSeconds : m.topSpeed / m.authority;
      assert.ok(
        seconds <= 120,
        `${m.name} reaches its top speed in ${seconds.toFixed(1)} s`
      );
    }
  });

  test("spool changes how fast you gain speed, never how safely you approach", () => {
    // The whole safety argument for SF-L-024 rests on this: the governor and
    // the stopping distances read `authority`, which spool does not touch.
    for (const m of FLIGHT_MODES) {
      if (!m.spoolSeconds) continue;
      const near = governedSpeed(m, 1e6);          // a megametre of clearance
      // The same mode with the spool taken away must be governed identically.
      // That is the claim, stated without depending on the governor's own
      // safety factor — which is free to change without making this a lie.
      const unspooled = governedSpeed({ ...m, spoolSeconds: 0 }, 1e6);
      assert.relative(near, unspooled, 1e-12,
        `${m.name} is governed by its real authority, not its spool`);
      assert.ok(near < m.topSpeed,
        `${m.name} is still held below its top speed when something is close`);
    }
  });

  test("the line between physics and fiction is where the docs put it", () => {
    // Bible §8.2D: superluminal travel is a declared fictional drive and
    // must never be presented as ordinary relativity. So every mode that
    // exceeds c must be flagged, and no mode below c may be.
    for (const m of FLIGHT_MODES) {
      if (m.topSpeed > C) assert.ok(isFiction(m), `${m.name} exceeds c and is not declared fiction`);
      else assert.ok(!isFiction(m), `${m.name} is sublight and should not be flagged as fiction`);
    }
  });

  test("mode 1 is the ship Slice B was tuned as", () => {
    const local = modeById(1);
    assert.equal(local.authority, 30, "3 g, unchanged");
    assert.equal(local.topSpeed, 300, "300 m/s, unchanged");
  });

  test("an unknown mode falls back to Local rather than throwing", () => {
    assert.equal(modeById(99).id, 1, "out of range");
    assert.equal(modeById(undefined).id, 1, "missing");
  });
});

suite("flight modes — Ric's two anchors", ({ test }) => {
  test("mode 4 crosses Earth–Moon in a minute and a bit", () => {
    /* Ric's anchor of 2026-07-26 was **two minutes**, and this is the one
       place in the project where a stated anchor has moved. It is worth
       being exact about why, because "the test drifted" and "the decision
       changed" look identical from here.

       The two minutes was the sum of two braking curves: the governor
       charged you for leaving Earth and again for arriving at the Moon.
       On 2026-07-28 Ric asked for modes 3–5 to engage *"like going into
       lightspeed in Star Wars"*, and the thing standing in the way was the
       departure half — a world behind the ship slowing it down. Deleting
       that (`clearanceAhead`) is what makes the jump instant, and losing
       forty seconds off this crossing is the same change seen from the
       other end. You cannot have one without the other.

       What survives is the half Ric actually described: *"if you get close
       to it it needs to slow you down."* The arrival is untouched, and the
       flown crossing measured 79 s in the probe against the 79 s this
       integrates — the rule and the ship agree. */
    const seconds = governedCrossingSeconds(modeById(4), K.MOON_SEMI_MAJOR.value);
    assert.ok(seconds > 65 && seconds < 95,
      `Earth–Moon in mode 4 came out at ${seconds.toFixed(0)} s, not about 79`);
  });

  test("mode 4 reaches the nearest star in about forty seconds", () => {
    // Not an anchor Ric gave this session — it is the promise the
    // prototype's own Interstellar gear made ("the nearest star is about
    // forty seconds out"), and the ladder solved from his Earth–Moon
    // anchor lands on it independently. Worth pinning precisely because
    // nothing aimed at it.
    const four = modeById(4);
    const proxima = 4.24 * 9.4607e15;
    const seconds = proxima / four.topSpeed;
    assert.ok(seconds > 30 && seconds < 60,
      `Proxima came out at ${seconds.toFixed(0)} s, not about 40`);
  });

  test("mode 5 crosses to Andromeda in seconds", () => {
    const five = modeById(5);
    const andromeda = 2.5e6 * 9.4607e15;
    // Governed, not at the dial figure: even in intergalactic space the
    // rule still applies, and the honest number is the one you would fly.
    const permitted = governedSpeed(five, andromeda);
    const seconds = andromeda / permitted;
    assert.ok(seconds < 60, `Andromeda came out at ${seconds.toFixed(0)} s`);
  });

  test("mode 5 is still governed near a world — overkill, not a loaded gun", () => {
    /* "Shouldn't be used unless you're going between galaxies" is about it
       being absurd here, not about it being lethal here. The governor is
       what makes that true: selecting the biggest drive in the ship while
       parked at the station must not be a way to die, because Ric's
       standing rule is that changing mode never kills you. */
    const five = modeById(5);
    const atStation = governedSpeed(five, 420000);
    assert.ok(atStation < 0.01 * C,
      `mode 5 permits ${(atStation / C).toFixed(3)} c at 420 km — the governor is not holding`);
    const stoppingDistance = (atStation * atStation) / (2 * five.authority);
    assert.ok(stoppingDistance <= 420000, "and you can still stop inside the clearance");
  });
});

suite("flight modes — the proximity governor", ({ test }) => {
  test("you may never be permitted more than you could stop from", () => {
    // The whole rule, over every mode and fourteen decades of clearance.
    // Stopping is by thrust or by spinning the drive down, and the ship may
    // use whichever is shorter — so it is the *smaller* of the two that has
    // to fit inside the clearance.
    for (const mode of FLIGHT_MODES) {
      for (const clearance of [1e3, 1e6, 1e9, 1e12, 1e15, 1e18]) {
        const v = governedSpeed(mode, clearance);
        if (v >= mode.topSpeed) continue;              // capped by the mode, not the governor
        const byThrust = (v * v) / (2 * mode.authority);
        const byDrive = mode.spindownSeconds ? (v * mode.spindownSeconds) / 2 : Infinity;
        const needed = Math.min(byThrust, byDrive);
        assert.ok(needed <= clearance * (1 + 1e-9),
          `${mode.name} at ${clearance.toExponential(0)} m clearance permits ` +
          `${v.toExponential(2)} m/s, which needs ${needed.toExponential(2)} m to stop`);
      }
    }
  });

  test("it slows you down as you close in, smoothly and all the way to zero", () => {
    const mode = modeById(4);
    let previous = Infinity;
    for (let d = 1e9; d > 1; d /= 2) {
      const v = governedSpeed(mode, d);
      assert.ok(v <= previous + 1e-9, `speed rose as clearance fell: ${v} > ${previous}`);
      previous = v;
    }
    assert.close(governedSpeed(mode, 0), 0, 1e-12, "speed at zero clearance", " m/s");
  });

  test("far enough from everything, every mode may fly its own top speed", () => {
    /* "Far enough" is a different distance for each mode, and that is the
       ladder working rather than a weakness. A light-year of clearance is
       open space for modes 1–3 and still a restriction on mode 4, which is
       why Proxima at 4.24 ly is the first place mode 4 is unleashed. This
       uses a billion light-years, which clears even mode 5. */
    const wideOpen = 1e9 * 9.4607e15;
    for (const mode of FLIGHT_MODES) {
      assert.equal(governedSpeed(mode, wideOpen), mode.topSpeed,
        `${mode.name} is being governed in intergalactic space`);
    }
    // And the interesting half: a light-year is *not* wide open for mode 4.
    assert.ok(governedSpeed(modeById(4), 9.4607e15) < modeById(4).topSpeed,
      "mode 4 should still be governed a light-year out — it is unleashed at Proxima, not before");
  });

  test("the governor never touches Local flight near the station", () => {
    // 420 km of clearance at 30 m/s² permits 2.5 km/s, which is eight times
    // the mode's own cap — so a player doing close work is never slowed by
    // a system they did not ask for.
    assert.equal(governedSpeed(modeById(1), 420000), 300, "Local is capped by the mode, not the governor");
  });

  test("clearance is measured to the surface, and finds the nearest body", () => {
    const time = new TimeService();
    const w = new WorldService(time);
    // A point 420 km above Earth's surface, on the +x axis.
    const near = nearestClearance({ x: RE + 420000, y: 0, z: 0 }, w.state);
    assert.equal(near.id, "earth", "nearest body");
    assert.close(near.clearance, 420000, 1, "clearance above the surface", " m");

    // And beside the Moon, the Moon wins.
    const moon = w.state.bodies.moon.position;
    const beside = nearestClearance(
      { x: moon.x + RM + 1000, y: moon.y, z: moon.z }, w.state);
    assert.equal(beside.id, "moon", "nearest body beside the Moon");
    assert.close(beside.clearance, 1000, 1, "clearance above the Moon", " m");
  });

  test("a world behind you does not slow you down", () => {
    /* The change of 2026-07-28, and the whole reason the interstellar drive
       engages in a second and a third rather than in three minutes. Same
       ship, same 420 km, same full throttle — only the nose differs. */
    const time = new TimeService();
    const w = new WorldService(time);
    const at = { x: RE + 420000, y: 0, z: 0 };

    const out = clearanceAhead(at, { x: 1, y: 0, z: 0 }, w.state);
    assert.equal(out.clearance, Infinity, "flying away from Earth, the way is clear");
    assert.equal(out.id, null, "and nothing is named as holding you back");

    const down = clearanceAhead(at, { x: -1, y: 0, z: 0 }, w.state);
    assert.equal(down.id, "earth", "flying at Earth, Earth governs");
    assert.close(down.clearance, 420000, 1, "clearance ahead", " m");

    // And the consequence, which is the thing a player feels.
    const four = modeById(4);
    assert.equal(governedSpeed(four, out.clearance), four.topSpeed,
      "pointed at open space, mode 4 is unleashed at once");
    assert.ok(governedSpeed(four, down.clearance) < four.topSpeed / 1e6,
      "pointed at the planet, mode 4 is held to a crawl");
  });

  test("a world you would pass, you pass — but only outside the corridor", () => {
    const time = new TimeService();
    const w = new WorldService(time);

    /* Abeam Earth at 420 km, flying tangentially: a straight line from here
       misses the planet, and a governor that slowed you for it would be
       charging you for a collision that geometry has already ruled out.
       This is what makes leaving low orbit along the track free. */
    const abeam = clearanceAhead({ x: RE + 420000, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, w.state);
    assert.equal(abeam.clearance, Infinity, "a tangential departure is clear");

    /* But the corridor is ten radii wide, not zero, because the player is
       aiming by eye. Just inside it still governs. */
    const far = RE * 40;
    const grazing = clearanceAhead(
      { x: far, y: RE * 5, z: 0 }, { x: -1, y: 0, z: 0 }, w.state);
    assert.equal(grazing.id, "earth", "five radii off-axis is inside the corridor");
    const clearOfIt = clearanceAhead(
      { x: far, y: RE * 15, z: 0 }, { x: -1, y: 0, z: 0 }, w.state);
    assert.equal(clearOfIt.clearance, Infinity, "fifteen radii off-axis is a miss");
  });

  test("touching a world governs you no matter which way the nose points", () => {
    /* The one case direction must not rescue. A ship on the surface is not
       "clear because the planet is behind it". */
    const time = new TimeService();
    const w = new WorldService(time);
    const onIt = clearanceAhead({ x: RE - 100, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, w.state);
    assert.equal(onIt.id, "earth", "contact is contact");
    assert.ok(onIt.clearance <= 0, "and the clearance is not positive");
  });

  test("you may never be commanded a speed the control loop cannot shed", () => {
    /* Found by flying it, 2026-07-28: mode 5 pointed straight down from a
       420 km orbit reported "held to 20.5 km/s" the whole way and hit the
       ground at 71 km/s. √(2·a·d) assumes braking at `a` from the first
       instant; the assisted loop is proportional and lags by 1/gain
       seconds, which at those speeds is kilometres.

       So the permitted speed must also be sheddable in a quarter of the
       room available. Re-flown after the fix, the same dive settles onto
       the surface at 1.2 m/s. */
    for (const mode of FLIGHT_MODES) {
      for (const d of [1e2, 1e3, 1e4, 1e5]) {
        const v = governedSpeed(mode, d);
        // The loop's own lag distance, v/gain, must fit inside the room.
        assert.ok(v / SHIP.velocityGain <= d,
          `${mode.name} at ${d} m permits ${v.toFixed(0)} m/s, which the loop ` +
          `cannot shed in ${d} m`);
      }
    }
  });
});

suite("flight modes — the instant stop", ({ test }) => {
  test("Local brakes for real; everything above it does not", () => {
    // Ric, 2026-07-26: "instant stop should only be a thing on 2-6."
    assert.ok(!canStopInstantly(modeById(1)), "Local must keep its honest brake");
    for (const id of [2, 3, 4, 5]) {
      assert.ok(canStopInstantly(modeById(id)), `mode ${id} should stop instantly`);
    }
  });

  test("it stops relative to the frame it names, not to zero", () => {
    /* The trap this guards. "Stopped" beside the station means matching the
       station — 7.66 km/s of it — and a ship whose ECI velocity was set to
       zero would be at rest in a frame nobody asked about while falling
       away from the thing it meant to stop at. */
    const time = new TimeService();
    const world = new WorldService(time);
    const st = world.state.station;
    const ship = new Ship({
      position: { x: st.position.x + 300, y: st.position.y, z: st.position.z },
      velocity: { x: st.velocity.x + 45, y: st.velocity.y - 30, z: st.velocity.z + 12 },
    });
    const flight = new FlightModel({ mode: "assisted" });
    flight.setTravelMode(3);
    const reference = stationReference(time.tt);

    const before = relativeVelocity(ship, reference);
    assert.ok(length(before) > 50, "the ship starts genuinely moving in the frame");

    assert.equal(flight.instantStop(ship, reference), null, "the stop should run");

    const after = relativeVelocity(ship, reference);
    assert.close(length(after), 0, 1e-9, "relative speed after stopping", " m/s");
    // And it is emphatically *not* at rest in the inertial frame.
    assert.ok(length(ship.velocity) > 7000,
      `stopping zeroed the inertial velocity (${length(ship.velocity).toFixed(0)} m/s) — ` +
      "the ship has been dropped out of orbit rather than stopped");
  });

  test("in Local it refuses, and says why", () => {
    const time = new TimeService();
    const world = new WorldService(time);
    const st = world.state.station;
    const ship = new Ship({
      position: { x: st.position.x + 300, y: st.position.y, z: st.position.z },
      velocity: { x: st.velocity.x + 20, y: st.velocity.y, z: st.velocity.z },
    });
    const flight = new FlightModel({ mode: "assisted" });
    flight.setTravelMode(1);
    const reference = stationReference(time.tt);
    const before = { ...ship.velocity };

    const why = flight.instantStop(ship, reference);
    assert.ok(why, "Local must refuse");
    assert.ok(/local/i.test(why), `the refusal should name the mode, got: ${why}`);
    assert.equal(ship.velocity.x, before.x, "and must not touch the velocity");
  });
});
