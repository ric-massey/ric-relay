/* ══════════════════════════════════════════════════════════════════════
   flight.test.js — Slice B, as assertions.

   The Earth–Moon slice's proof for Slice B is "a new player can manoeuvre
   near the station on phone and desktop", which is not a thing a unit test
   can check. What a test can check is every property that has to hold for
   that sentence to be possible, and those come from named requirements
   rather than from taste:

     §5.4   circular orbits stay circular; no frame transition introduces
            free energy or a velocity jump
     §6.2   assisted release damps and never applies unrequested thrust
     §6.3   direct release coasts
     §6.5   a stop names its frame, reaches rest in that frame, and says
            why when it cannot
     §8.3   station-relative motion is coherent
     C§6    changing mode never changes velocity
     C§7    bindings are versioned, two-slot, and one key means one thing

   The last group is not physics, and it is here anyway: Controls is a
   design law in this project, and a rebinding screen that can produce an
   unusable scheme is a bug with the same weight as a wrong constant.
   ══════════════════════════════════════════════════════════════════════ */

import { suite, assert } from "./harness.js";
import { TimeService } from "../src/simulation/time/time-service.js";
import { WorldService } from "../src/simulation/world/world-service.js";
import { Ship, SHIP } from "../src/simulation/ship/ship.js";
import {
  integrate, elements, circularSpeed, circularPeriod, gravityEci,
} from "../src/simulation/ship/gravity.js";
import { FlightModel, NEUTRAL_COMMAND, targetSpeed } from "../src/simulation/ship/flight-model.js";
import {
  assess, stationReference, inertialReference, relativeVelocity, stoppingSolution,
} from "../src/simulation/ship/flight-computer.js";
import {
  STATION, ZONES, zoneAt, safeClosingRate, stationState, shipStartState, START_OFFSET_M,
} from "../src/simulation/world/station.js";
import { MEAN_MOTION, PERIOD } from "../src/simulation/world/observation-point.js";
import {
  defaultBindings, loadBindings, bindKey, codeIndex, describeBindings, ACTIONS,
} from "../src/application/input/bindings.js";
import { v3, sub, add, scale, length, dot, normalize } from "../src/simulation/core/linalg.js";
import { K } from "../src/simulation/core/units.js";

const R_LEO = K.EARTH_RADIUS_EQ.value + 420000;
const INCLINATION = 51.6394 * (Math.PI / 180);

/** A circular orbit at the station's altitude and inclination. */
function circularState(radius = R_LEO) {
  const v = circularSpeed(radius);
  return {
    position: { x: radius, y: 0, z: 0 },
    velocity: { x: 0, y: v * Math.cos(INCLINATION), z: v * Math.sin(INCLINATION) },
  };
}

function fixture() {
  const time = new TimeService({ startUtc: new Date("2026-07-25T12:00:00Z") });
  const world = new WorldService(time);
  const ship = new Ship(shipStartState(time.tt));
  const flight = new FlightModel();
  const reference = () => stationReference(world.state.t);
  return { time, world, ship, flight, reference };
}

/**
 * Run the control loop for `seconds` and hand back the last command.
 *
 * The clock advances with it. That is not a detail: a harness that holds
 * time still while the ship moves puts the station 76 km behind within ten
 * seconds and every relative measurement afterwards is nonsense.
 */
function fly({ time, world, ship, flight, reference, command, seconds, dt = 1 / 60, target = null }) {
  const cmd = { ...NEUTRAL_COMMAND, ...command };
  let t = 0;
  let last = null;
  while (t < seconds - 1e-9) {
    const step = Math.min(dt, seconds - t);
    const ref = reference();
    const situation = assess({ ship, reference: ref, target, precision: cmd.precision });
    last = flight.update({ ship, command: cmd, reference: ref, situation, target });
    ship.step(step, { accelEci: last.accelEci, angularAccelBody: last.angularAccelBody });
    if (time) time.advance(step);
    // The world has to be re-evaluated as well as the clock: `reference`
    // reads world.state.t, so advancing one without the other freezes the
    // station in place while the ship flies on past it.
    if (world) world.update();
    t += step;
  }
  return last;
}

/* ══════════════════════════════════════════════════════════════════════
   The clock — §5.3
   ══════════════════════════════════════════════════════════════════════ */

suite("simulation clock", ({ test }) => {
  test("advancing at 60 Hz does not lose time", () => {
    /* Seconds of TT since J2000 is about 8.4×10⁸, where a double's spacing
       is 1.9×10⁻⁷ s. Accumulating a sixtieth of a second into a number
       that size rounds every step, and rounds the same way every step: the
       clock ran 2.9 parts per million slow, losing a millisecond every six
       minutes.

       Nothing looked wrong until the ship and the station advanced by
       different routes — the ship by its own dt, the station by differences
       of this clock — and a millisecond became eight metres of separation
       at orbital speed. A station drifting away from a ship holding
       position perfectly, and no bug anywhere near either of them. */
    const time = new TimeService({ startUtc: new Date("2026-07-25T12:00:00Z") });
    const start = time.tt;
    const steps = 60 * 300;
    for (let i = 0; i < steps; i++) time.advance(1 / 60);

    const elapsed = time.tt - start;
    assert.close(elapsed, 300, 1e-9, "300 s advanced one frame at a time", " s");
    // Stated the way it actually bites: how far a ship moves in the error.
    assert.ok(Math.abs(elapsed - 300) * 7653 < 1e-5,
      "the error is under ten microns of along-track position");
  });

  test("the traveler clock counts exactly the seconds that were played", () => {
    // Design Bible §7.3: traveler time is never scaled, rewound or skipped.
    const time = new TimeService({ startUtc: new Date("2026-07-25T12:00:00Z") });
    let wall = 1000;
    time.tick(wall);
    for (let i = 0; i < 600; i++) time.tick((wall += 1 / 60));
    assert.close(time.travelerSeconds, 10, 1e-9, "traveler seconds after ten seconds", " s");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Gravity and the integrator — §5.4
   ══════════════════════════════════════════════════════════════════════ */

suite("gravity and orbit stability", ({ test }) => {
  test("a circular orbit is still circular after a full revolution", () => {
    let s = circularState();
    const before = elements(s.position, s.velocity);
    const T = circularPeriod(R_LEO);
    for (let t = 0; t < T; t += 1 / 60) s = integrate(s, 1 / 60);
    const after = elements(s.position, s.velocity);

    // The tolerance is stated rather than discovered: ten metres of
    // semi-major axis over an orbit is a thousandth of the altitude, and
    // far below anything the player could see.
    assert.close(after.semiMajorAxis, before.semiMajorAxis, 10,
      "semi-major axis after one orbit", " m");

    // Eccentricity does not stay at exactly zero, and should not: J2 makes
    // the osculating eccentricity of a circular orbit breathe at about
    // 1.7e-3. That number is the oblateness doing its job, not the
    // integrator losing precision.
    assert.ok(after.eccentricity < 3e-3,
      `eccentricity stayed small: ${after.eccentricity.toExponential(3)}`);
  });

  test("the integrator has converged at the frame rate it actually runs at", () => {
    // The honest test of an integrator is not "does it look stable" but
    // "does taking smaller steps change the answer". Eight times finer,
    // over a whole orbit, must land in the same place.
    const run = (dt) => {
      let s = circularState();
      const T = circularPeriod(R_LEO);
      for (let t = 0; t < T; t += dt) s = integrate(s, Math.min(dt, T - t));
      return s;
    };
    const coarse = run(1 / 60);
    const fine = run(1 / 480);
    const drift = length(sub(coarse.position, fine.position));
    assert.ok(drift < 0.05,
      `one orbit at 60 Hz and at 480 Hz agree to ${(drift * 1000).toFixed(2)} mm`);
  });

  test("J2 is present, and points the way the bulge does", () => {
    /* At the *same distance from the centre*, an oblate Earth pulls harder
       over the equator and less hard over the pole. That is the opposite
       of the familiar "gravity is stronger at the poles", and both are
       true: the surface statement compares different radii, because the
       poles are 21 km closer in.

       Here the comparison is at fixed r, and the reason is easy to see if
       you picture the bulge as a ring of mass around the equator. From
       above the pole, every part of that ring is off-axis, so only a
       fraction of its pull is along the axis and the ring contributes less
       than the same mass at the centre would. From over the equator, part
       of it is much nearer, and it contributes more.

       Getting this sign backwards reverses the nodal regression and
       changes nothing else visibly, which is exactly why it is asserted. */
    const rPole = { x: 0, y: 0, z: R_LEO };
    const rEq = { x: R_LEO, y: 0, z: 0 };
    const pointMass = K.GM_EARTH.value / (R_LEO * R_LEO);

    assert.ok(length(gravityEci(rPole)) < pointMass,
      "gravity over the pole falls short of the point-mass value");
    assert.ok(length(gravityEci(rEq)) > pointMass,
      "gravity over the equator exceeds the point-mass value");
    // And the effect is J2-sized — a thousandth of g — rather than a typo
    // that happens to have the right sign.
    assert.relative(length(gravityEci(rEq)) / pointMass - 1, 1.5 * K.EARTH_J2.value *
      Math.pow(K.EARTH_RADIUS_EQ.value / R_LEO, 2), 0.02, "the size of the J2 term");
  });

  test("the third-body terms are differential, not absolute", () => {
    // Keeping only the direct pull and dropping the indirect term is the
    // classic error: it accelerates the whole Earth-centred frame at about
    // 3e-3 m/s² toward the Moon, which is ten thousand times the real
    // perturbation. The test is that the Moon's contribution at Earth's
    // own centre is zero.
    const moon = { x: 384399000, y: 0, z: 0 };
    const nearCentre = { x: 100, y: 0, z: 0 };
    const withMoon = gravityEci(nearCentre, { moon });
    const without = gravityEci(nearCentre);
    const moonPart = length(sub(withMoon, without));
    assert.ok(moonPart < 1e-9,
      `the Moon's pull at Earth's centre nets to ${moonPart.toExponential(2)} m/s²`);
  });
});

/* ══════════════════════════════════════════════════════════════════════
   The station and its frame — §5.2, §8.3
   ══════════════════════════════════════════════════════════════════════ */

suite("station-relative motion", ({ test }) => {
  test("the start state is genuinely at rest in the station's frame", () => {
    const { ship, reference } = fixture();
    const rel = relativeVelocity(ship, reference());
    // Not "close to the station's velocity" — at rest in the frame, which
    // is a different and stricter thing. Copying the station's inertial
    // velocity instead would leave about 13 cm/s of drift here.
    assert.ok(length(rel) < 1e-6,
      `relative speed at the start is ${length(rel).toExponential(2)} m/s`);
  });

  test("that start state really does hold station, unpowered, for five minutes", () => {
    const { time, world, ship } = fixture();
    // No thrust at all: a point trailing on the same circular orbit is a
    // neutral relative position, and if the frame or the start state were
    // wrong this would drift away visibly within a minute.
    for (let t = 0; t < 300; t += 1 / 60) {
      ship.step(1 / 60);
      time.advance(1 / 60);
    }
    const st = stationState(time.tt);
    const range = length(sub(st.position, ship.position));
    assert.close(range, Math.abs(START_OFFSET_M), 1.0, "range after five minutes", " m");
  });

  test("the local frame rotates once per orbit, about the orbit normal", () => {
    const { world } = fixture();
    const f = world.frames.get("LVLH");
    const tr = f.at(world.state.t);
    const rate = length(tr.omega);

    // Within a part in a thousand of the mean motion — and *not* equal to
    // it, deliberately. The frame turns at the rate the station is actually
    // going round, which J2 shifts slightly from the Keplerian mean. Pin
    // this to the mean instead and a co-orbiting ship creeps two metres
    // every five minutes with nothing the player can do about it.
    assert.relative(rate, MEAN_MOTION, 2e-3, "local frame angular rate");
    assert.relative((2 * Math.PI) / rate, PERIOD, 2e-3, "one rotation per orbit");

    // And it is about the orbit normal, not about anything else.
    const st = world.state.station;
    const normal = normalize(cross3(st.position, st.velocity));
    assert.ok(dot(normalize(tr.omega), normal) > 0.999999, "aligned with the orbit normal");
  });

  test("the station frame round-trips position and velocity", () => {
    // §6.2 of the architecture: changing position without the matching
    // velocity basis is a critical bug. The ω × r term is what this proves.
    const { world, ship } = fixture();
    const start = { frame: "ECI", position: ship.position, velocity: ship.velocity };
    const there = world.frames.convert(start, "LVLH", world.state.t);
    const back = world.frames.convert(there, "ECI", world.state.t);
    assert.vectorClose(back.position, start.position, 1e-6, "position round trip");
    assert.vectorClose(back.velocity, start.velocity, 1e-9, "velocity round trip", " m/s");
  });

  test("a ship at rest in the local frame is not at rest in inertial space", () => {
    // The lesson §8.3 wants the player to discover, stated as a test: the
    // two frames disagree by 7.66 km/s and both are correct.
    const { ship, reference } = fixture();
    assert.ok(length(relativeVelocity(ship, reference())) < 1e-6, "at rest in the station's frame");
    assert.relative(length(relativeVelocity(ship, inertialReference())), 7660, 0.02,
      "speed in the inertial frame");
  });

  test("the safety envelope is ordered and its closing guide scales with range", () => {
    for (let i = 1; i < ZONES.length; i++) {
      assert.ok(ZONES[i].radius > ZONES[i - 1].radius,
        `zone ${ZONES[i].id} is outside ${ZONES[i - 1].id}`);
    }
    assert.equal(zoneAt(10).id, "contact", "inside the structure");
    assert.equal(zoneAt(4000).id, "observation", "at observation distance");
    assert.equal(zoneAt(99999), null, "outside every zone");
    assert.ok(safeClosingRate(1000) > safeClosingRate(100),
      "you may close faster when you are further out");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Flight modes — §6.2, §6.3, Controls §6
   ══════════════════════════════════════════════════════════════════════ */

suite("flight modes", ({ test }) => {
  /* Ric, 2026-07-28: "when you release W it needs to keep going that speed
     and only slow down with S. and instantly stop with X."

     The throttle is a speed the ship *holds*, so the release case is the
     one that matters: letting go of the key must change nothing at all.
     The old model read the stick deflection directly, so releasing forward
     commanded zero and the ship braked itself to a stop. */
  test("assisted flight holds the speed you set when you let go of it", () => {
    const { time, world, ship, flight, reference } = fixture();
    flight.throttle = 0.5;
    const cruise = targetSpeed(0.5, false);

    // Long enough for the velocity loop to reach the commanded speed.
    fly({ time, world, ship, flight, reference, command: {}, seconds: 6 });
    const reached = length(relativeVelocity(ship, reference()));
    assert.relative(reached, cruise, 0.05, "the ship reached the speed the throttle asked for");

    // Nothing held, a full minute later: still going, at the same speed.
    fly({ time, world, ship, flight, reference, command: {}, seconds: 60 });
    const later = length(relativeVelocity(ship, reference()));
    assert.relative(later, cruise, 0.05, "and was still doing it a minute after release");
    assert.equal(flight.throttle, 0.5, "with the throttle untouched by letting go");
  });

  test("a full stop puts the throttle back to zero, or the ship just leaves again", () => {
    const { time, world, ship, flight, reference } = fixture();
    flight.travelMode = 2;                     // Local cannot stop instantly
    flight.throttle = 0.5;
    fly({ time, world, ship, flight, reference, command: {}, seconds: 6 });
    assert.ok(length(relativeVelocity(ship, reference())) > 1, "moving before the stop");

    assert.equal(flight.instantStop(ship, reference()), null, "the stop ran");
    assert.equal(flight.throttle, 0, "and took the commanded speed with it");

    fly({ time, world, ship, flight, reference, command: {}, seconds: 10 });
    assert.ok(length(relativeVelocity(ship, reference())) < 0.1,
      "so ten seconds later it is still stopped rather than back up to cruise");
  });

  test("winding the throttle to zero comes to rest, and stays there", () => {
    /* What replaced direct mode's coast, 2026-07-28. There is now one ship,
       so "let go" and "ask for nothing" are different instructions: letting
       go of W holds your cruise (the test above), and winding the throttle
       down to zero closes on rest in the current frame.

       This is the honest cost of one ship and it is recorded as such in
       `flight-model.js` — you can no longer fly a pure ballistic arc by
       hand. It is also the behaviour Ric asked for: a ship you barely
       think about does not drift away from the truss you were working on. */
    const { time, world, ship, flight, reference } = fixture();
    // 0.8, not 0.6: the dial is exponential, so 0.6 of it in Local asks for
    // 4.9 m/s — a nudge rather than a cruise, and not enough to prove
    // anything about stopping.
    flight.throttle = 0.8;
    fly({ time, world, ship, flight, reference, command: {}, seconds: 4 });
    const cruise = length(relativeVelocity(ship, reference()));
    assert.ok(cruise > 20, `it built up a cruise of ${cruise.toFixed(1)} m/s`);

    flight.throttle = 0;
    fly({ time, world, ship, flight, reference, command: {}, seconds: 8 });
    const after = length(relativeVelocity(ship, reference()));
    assert.ok(after < 0.01, `throttle at zero settled to ${after.toFixed(4)} m/s`);
  });

  test("thrust goes where the nose points, at the travel mode's authority", () => {
    /* Isolated against an identical unpowered run, because over a second in
       low orbit gravity contributes 8.7 m/s² of its own and comparing the
       raw Δv to the engine's 30 would be measuring both at once.

       Driven by the *throttle* rather than by a stick deflection, which is
       the whole of what changed: the commanded velocity points along the
       nose and the loop is clamped to the mode's authority, so a ship far
       below its cruise accelerates at exactly that authority. Local's is
       30 m/s², the value this test has always asserted. */
    const run = (throttle) => {
      const f = fixture();
      f.flight.throttle = throttle;
      const before = { ...f.ship.velocity };
      fly({ ...f, seconds: 1, command: {} });
      return { dv: sub(f.ship.velocity, before), nose: f.ship.forward };
    };
    const coasting = run(0);
    const powered = run(1);
    const fromEngines = sub(powered.dv, coasting.dv);

    assert.close(length(fromEngines), SHIP.maxAcceleration, 0.1,
      "Δv from the engines over one second", " m/s");
    assert.ok(dot(normalize(fromEngines), powered.nose) > 0.999, "and it is along the nose");
  });

  test("there is one ship — no hidden flight mode to be caught in", () => {
    /* The regression this exists to prevent, in Ric's words on 2026-07-28:
       "I went to go speed up on level 5 and it's taking forever to even
       reach light speed." He was in direct mode without knowing it — a
       saved setting, no HUD indication — and direct mode had no throttle,
       no drive spool and no governor, so Intergalactic accelerated at a
       flat 10⁶ m/s² toward a speed 150 million years away.

       So: the model must expose no way to be in any state but the one. */
    const { flight } = fixture();
    assert.equal(flight.mode, undefined, "there is no assisted/direct state left");
    assert.equal(typeof flight.cycleMode, "undefined", "and no toggle to reach it");
  });

  test("changing travel mode never changes velocity", () => {
    // Ric's standing rule, stated as a law: a mode is an acceleration, not
    // a speed. Easy to satisfy today and easy to break the first time
    // someone caches a velocity in the model.
    const { ship, flight } = fixture();
    const before = { ...ship.velocity };
    for (const id of [5, 1, 4, 2, 3]) flight.setTravelMode(id);
    assert.vectorClose(ship.velocity, before, 0, "velocity across five mode changes", " m/s");
  });

  test("precision mode is the same ship with a fortieth of the authority", () => {
    const coarse = targetSpeed(0.5, false);
    const fine = targetSpeed(0.5, true);
    assert.relative(fine, coarse * SHIP.precisionFactor, 1e-12, "precision target speed");
    // §6.4 asks for centimetre-per-second commands to be reachable.
    assert.ok(targetSpeed(0.25, true) < 0.05,
      `a quarter throttle in precision asks for ${targetSpeed(0.25, true).toFixed(4)} m/s`);
  });

  test("the throttle spans five decades without a cliff in it", () => {
    // The prototype's gears are the suspect for "the speed was never
    // right", so the replacement has to give fine control at the bottom
    // and reach at the top. Equal turns give equal ratios.
    const a = targetSpeed(0.2), b = targetSpeed(0.4), c = targetSpeed(0.6);
    assert.relative(b / a, c / b, 1e-9, "equal throttle steps are equal speed ratios");
    assert.ok(targetSpeed(0) <= 0.01 && targetSpeed(1) >= 300, "the range covers 1 cm/s to 300 m/s");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Safe stop and the flight computer — §6.5
   ══════════════════════════════════════════════════════════════════════ */

suite("safe stop and assists", ({ test }) => {
  test("a stop reaches rest in the frame it names", () => {
    const { time, world, ship, flight, reference } = fixture();
    // Sideways trim to build the motion the stop then has to cancel.
    fly({ time, world, ship, flight, reference, command: { translate: { x: 1, y: 0, z: 0 } }, seconds: 0.4 });

    const ref = reference();
    flight.request("stop", assess({ ship, reference: ref }));
    assert.equal(flight.assist, "stop", "the stop was accepted");

    fly({ time, world, ship, flight, reference, command: {}, seconds: 10 });
    assert.equal(flight.assist, null, "the stop finished and handed control back");
    assert.ok(flight.assistResult.ok, "and reported success");
    assert.ok(flight.assistResult.reason.includes("station"),
      `it named its frame: "${flight.assistResult.reason}"`);
    assert.ok(length(relativeVelocity(ship, reference())) < 0.02, "at rest in that frame");
  });

  test("stopping distance and time are the kinematic answer", () => {
    const s = stoppingSolution(30, SHIP.maxAcceleration);
    assert.close(s.time, 1, 1e-12, "time to stop from 30 m/s at 30 m/s²", " s");
    assert.close(s.distance, 15, 1e-9, "distance to stop", " m");
  });

  test("a stop that cannot be completed says why, and does not pretend", () => {
    const { time, world, flight } = fixture();
    // 80 m of clear space, closing at 80 m/s. Stopping from 80 m/s at
    // 30 m/s² takes 107 m, so it does not fit — and the player must be
    // told that in metres rather than reassured with a refusal.
    const st = stationState(time.tt);
    const back = normalize(st.velocity);
    const ship = new Ship({
      position: sub(st.position, scale(back, STATION.radius + SHIP.radius + 80)),
      velocity: add(st.velocity, scale(back, 80)),
    });
    const situation = assess({ ship, reference: stationReference(time.tt) });
    const why = flight.request("stop", situation);
    assert.ok(typeof why === "string" && why.length > 0, `it gave a reason: "${why}"`);
    assert.equal(flight.assist, null, "and did not start an assist it cannot finish");
    assert.ok(flight.assistResult && flight.assistResult.ok === false, "and recorded the refusal");
  });

  test("manual input cancels an assist immediately", () => {
    // §7.4's interruption rule, one level down: a hand on the stick during
    // an automatic stop is not a request to be argued with.
    const { time, world, ship, flight, reference } = fixture();
    flight.request("hold", assess({ ship, reference: reference() }));
    assert.equal(flight.assist, "hold", "holding");
    fly({ time, world, ship, flight, reference, command: { translate: { x: 1, y: 0, z: 0 } }, seconds: 1 / 30 });
    assert.equal(flight.assist, null, "the first frame of input cancelled it");
  });

  test("the situation names its frame, every time", () => {
    const { ship, reference } = fixture();
    for (const ref of [reference(), inertialReference()]) {
      const s = assess({ ship, reference: ref });
      assert.ok(s.referenceLabel && s.referenceLabel.length > 0,
        `${ref.id} reported a label`);
      assert.equal(s.referenceId, ref.id, "and the id matches");
    }
  });

  test("closing too fast raises a warning before it raises a crash", () => {
    const { time } = fixture();
    const st = stationState(time.tt);
    const back = normalize(st.velocity);
    const ship = new Ship({
      position: sub(st.position, scale(back, 400)),
      velocity: add(st.velocity, scale(back, 25)),
    });
    const s = assess({ ship, reference: stationReference(time.tt) });
    assert.ok(s.warnings.some((w) => w.id === "closing"), "a closing-rate warning was raised");
    assert.ok(s.proximity.timeToContact > 0, "and it knows how long there is");
    assert.ok(["warning", "critical"].includes(s.severity), "at a severity worth reading");
  });

  test("predictive braking only ever slows you down, and stops when overridden", () => {
    const { time, flight } = fixture();
    const st = stationState(time.tt);
    const back = normalize(st.velocity);
    const start = () => new Ship({
      position: sub(st.position, scale(back, 300)),
      velocity: { ...st.velocity },
    });
    const ref = stationReference(time.tt);
    // The throttle is the flight model's now, not the command's.
    flight.throttle = 1;
    const command = { ...NEUTRAL_COMMAND, translate: { x: 0, y: 0, z: 1 } };

    const assisted = start();
    // Nose at the station, so "forward" is straight at it.
    assisted.attitude = attitudeToward(assisted.position, st.position);
    const braked = flight.update({
      ship: assisted, command, reference: ref,
      situation: assess({ ship: assisted, reference: ref }),
    });

    flight.safetyOverridden = true;
    const free = flight.update({
      ship: assisted, command, reference: ref,
      situation: assess({ ship: assisted, reference: ref, safetyOverridden: true }),
    });

    const towardStation = normalize(sub(st.position, assisted.position));
    assert.ok(dot(braked.accelEci, towardStation) < dot(free.accelEci, towardStation),
      "assistance reduced the approach, and the override removed the reduction");
    assert.ok(braked.note && braked.note.includes("braking"), "and said so on the glass");
  });
});

/** Nose-toward-target attitude, built the same way the app builds it. */
function attitudeToward(from, to) {
  const f = normalize(sub(to, from));
  const up = Math.abs(f.z) > 0.9995 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  const z = scale(f, -1);
  const x = normalize(cross3(up, z));
  const y = cross3(z, x);
  // Rotation matrix (columns x, y, z) to quaternion.
  const m = [x.x, y.x, z.x, x.y, y.y, z.y, x.z, y.z, z.z];
  const tr = m[0] + m[4] + m[8];
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    return { w: s / 4, x: (m[7] - m[5]) / s, y: (m[2] - m[6]) / s, z: (m[3] - m[1]) / s };
  }
  const s = 2 * Math.sqrt(1 + m[0] - m[4] - m[8]);
  return { w: (m[7] - m[5]) / s, x: s / 4, y: (m[1] + m[3]) / s, z: (m[2] + m[6]) / s };
}

const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/* ══════════════════════════════════════════════════════════════════════
   Attitude — §6.2
   ══════════════════════════════════════════════════════════════════════ */

suite("attitude", ({ test }) => {
  test("a turn stops where it is, and never swings back", () => {
    /* Ric, flying it: "when I turn right it pulls back the other way."

       The cause was an attitude hold that captured a target on the first
       frame after release — while the ship still had a radian a second on
       it — so the controller had to overshoot that target and come back.
       The player let go and watched the view sail past and return.

       So the contract is: releasing stops the turn, promptly, *where it
       is*. The angle away from the release point may only ever grow and
       then hold. Any decrease at all is the fault coming back. */
    const { time, world, ship, flight, reference } = fixture();
    fly({ time, world, ship, flight, reference, command: { rotate: { pitch: 0, yaw: 1, roll: 0 } }, seconds: 0.5 });

    const releasedNose = ship.forward;
    const angleFromRelease = () =>
      Math.acos(Math.max(-1, Math.min(1, dot(ship.forward, releasedNose))));

    let worstReversal = 0;
    let previous = 0;
    for (let i = 0; i < 60 * 3; i++) {
      fly({ time, world, ship, flight, reference, command: {}, seconds: 1 / 60 });
      const now = angleFromRelease();
      worstReversal = Math.max(worstReversal, previous - now);
      previous = now;
    }

    // A hair of tolerance for the gravity gradient, and nothing more: a
    // real swing-back was tens of degrees.
    assert.ok(worstReversal < 1e-4,
      `it never came back — worst reversal ${(worstReversal * 180 / Math.PI).toFixed(4)}°`);
    assert.ok(length(ship.angularVelocity) < 1e-3,
      `the spin damped to ${length(ship.angularVelocity).toExponential(2)} rad/s`);
    // And it stops *promptly*: coasting a quarter-turn after release is
    // the other half of "floaty".
    assert.ok(previous < 0.35,
      `it coasted ${(previous * 180 / Math.PI).toFixed(1)}° after release`);
  });

  test("once stopped, the nose stays put", () => {
    // The reason attitude hold exists at all: over a long hold the gravity
    // gradient would otherwise walk the view off its mark.
    const { time, world, ship, flight, reference } = fixture();
    fly({ time, world, ship, flight, reference, command: { rotate: { pitch: 1, yaw: 0, roll: 0 } }, seconds: 0.3 });
    fly({ time, world, ship, flight, reference, command: {}, seconds: 3 });

    const settled = ship.forward;
    fly({ time, world, ship, flight, reference, command: {}, seconds: 30 });
    const crept = Math.acos(Math.max(-1, Math.min(1, dot(ship.forward, settled))));
    assert.ok(crept < 0.002,
      `the nose crept ${(crept * 180 / Math.PI).toFixed(3)}° in thirty seconds`);
  });

  test("right is right, up is up, and a roll to the right banks right", () => {
    /* Ric, flying it: "left and right controls are backwards."

       They were: the pointer accumulated yaw with the wrong sign and the
       arrow keys had their axis reversed, so moving the mouse right turned
       the ship left. It is the kind of fault that no test of magnitudes
       will ever catch and that anyone notices in one second of flying, so
       here are the three signs, asserted as directions. */
    const check = (axis, expected) => {
      const { time, world, ship, flight, reference } = fixture();
      const before = { forward: ship.forward, up: ship.up, right: ship.right };
      fly({
        time, world, ship, flight, reference, seconds: 0.3,
        command: { rotate: { pitch: 0, yaw: 0, roll: 0, [axis]: 1 } },
      });
      return { before, after: { forward: ship.forward, up: ship.up } };
    };

    const yaw = check("yaw");
    assert.ok(dot(yaw.after.forward, yaw.before.right) > 0.1,
      "positive yaw takes the nose toward the ship's right");

    const pitch = check("pitch");
    assert.ok(dot(pitch.after.forward, pitch.before.up) > 0.1,
      "positive pitch takes the nose up");

    const roll = check("roll");
    assert.ok(dot(roll.after.up, roll.before.right) > 0.1,
      "positive roll banks right — the top of the ship goes to the right");
  });

  test("direct flight builds spin while held and stops it on release", () => {
    // Ric, 2026-07-28: "in manual when I release the up arrow I need it to
    // stop rotating as well." The stick commands a rate, so the ship turns
    // while held and stops when released — and stops *where it ended up*,
    // which is the half that was a bug.
    const { time, world, ship, flight, reference } = fixture();
    fly({ time, world, ship, flight, reference, command: { rotate: { pitch: 1, yaw: 0, roll: 0 } }, seconds: 0.5 });
    const spin = length(ship.angularVelocity);
    assert.ok(spin > 0.01, `holding the key built ${spin.toFixed(3)} rad/s of spin`);

    const attitudeAtRelease = { ...ship.attitude };
    fly({ time, world, ship, flight, reference, command: {}, seconds: 3 });
    assert.ok(length(ship.angularVelocity) < 1e-3,
      `the spin stopped on release, at ${length(ship.angularVelocity).toExponential(1)} rad/s`);

    // Stopped where it ended up, never rewound to where it started.
    const settled = { ...ship.attitude };
    fly({ time, world, ship, flight, reference, command: {}, seconds: 3 });
    const drift = Math.abs(ship.attitude.w - settled.w) + Math.abs(ship.attitude.x - settled.x)
      + Math.abs(ship.attitude.y - settled.y) + Math.abs(ship.attitude.z - settled.z);
    assert.ok(drift < 1e-6, "and then held that attitude rather than creeping");
    assert.ok(Math.abs(ship.attitude.w - attitudeAtRelease.w) > 1e-6,
      "it coasted on past the release point rather than snapping back to it");
  });

  test("rotating the ship does not rotate its velocity", () => {
    /* §6.3's first bullet, and the single most important difference between
       a spacecraft and an aeroplane — but it is now a statement about the
       ship *at rest*, and the distinction matters. Under throttle the
       commanded velocity deliberately follows the nose, because turning
       where you are going is what every ship in every film does. What must
       never happen is the momentum you already have being silently rotated
       with the hull, which is what this pins. */
    const { time, world, ship, flight, reference } = fixture();
    const before = { ...ship.velocity };
    fly({ time, world, ship, flight, reference, command: { rotate: { pitch: 1, yaw: 0.4, roll: 0 } }, seconds: 2 });
    // Gravity has acted, so this is not exactly equal — but it is equal to
    // what gravity alone would have done, and nothing else.
    const drift = length(sub(ship.velocity, before));
    const gravityAlone = length(gravityEci(ship.position)) * 2;
    assert.close(drift, gravityAlone, 0.05, "velocity change while rotating", " m/s");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Bindings — Controls §7
   ══════════════════════════════════════════════════════════════════════ */

suite("controls and bindings", ({ test }) => {
  test("every action has at least one default binding", () => {
    const b = defaultBindings();
    for (const a of ACTIONS) {
      assert.ok((b[a.id] || []).filter(Boolean).length > 0, `${a.id} is bound`);
    }
  });

  test("no physical key means two things", () => {
    const b = defaultBindings();
    const seen = new Map();
    for (const [id, codes] of Object.entries(b)) {
      for (const c of codes) {
        if (!c) continue;
        assert.ok(!seen.has(c), `${c} is bound to ${seen.get(c)} and ${id}`);
        seen.set(c, id);
      }
    }
  });

  test("rebinding a key takes it away from whatever had it", () => {
    // Allowing a duplicate silently is how a rebinding screen produces a
    // control scheme the player cannot use and cannot diagnose.
    const { bindings, displaced } = bindKey(defaultBindings(), "fullStop", "KeyW", 0);
    assert.equal(codeIndex(bindings).get("KeyW"), "fullStop", "the new owner has it");
    assert.ok(displaced.some((d) => d.action === "thrustForward"), "and the old owner lost it");
    assert.ok(!(bindings.thrustForward || []).includes("KeyW"), "for real, not just in the report");
  });

  test("a saved set from a different schema version is discarded, not merged", () => {
    const stale = {
      getItem: () => JSON.stringify({ version: 0, bindings: { fullStop: ["KeyJ"] } }),
    };
    const loaded = loadBindings(stale);
    assert.ok(!loaded.fullStop.includes("KeyJ"),
      "an incompatible saved set falls back to defaults rather than half-applying");
  });

  test("the help screen is generated from the live mapping", () => {
    const custom = bindKey(defaultBindings(), "fullStop", "KeyJ", 0).bindings;
    const described = describeBindings(custom);
    const stop = described.flight.find((a) => a.id === "fullStop");
    assert.ok(stop.keys.includes("J"), `help shows the rebound key: ${stop.keys.join("/")}`);
  });

  test("bindings are physical codes, not characters", () => {
    // A binding that reads "W" on QWERTY and lands under the little finger
    // on AZERTY is not a binding.
    //
    // The punctuation codes belong here for exactly the same reason the
    // letters do: `Minus` and `Equal` name positions on the board, not the
    // characters printed on them. They were missing only because nothing
    // had used one yet, and the allowlist read as a rule about which keys
    // were permitted rather than the rule it is — codes, never characters.
    const PHYSICAL = /^(Key|Digit|Arrow|Numpad|F\d)|^(Space|Escape|Tab|Enter|Shift|Control|Alt|Meta)|^(Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash)$/;
    for (const a of ACTIONS) {
      for (const code of a.keys) {
        assert.ok(PHYSICAL.test(code), `${a.id} uses a physical code: ${code}`);
      }
    }
  });
});
