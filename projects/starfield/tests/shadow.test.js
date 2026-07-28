/* ══════════════════════════════════════════════════════════════════════
   shadow.test.js — orbital night, and the penumbra that opens it.

   The cases below are geometric rather than ephemeris-derived: the Sun,
   the occluder and the observer are placed by hand so the expected answer
   is arithmetic rather than a second run of the same code. That is the
   point of them — a test that computed the expectation with `sunlitFraction`
   would pass no matter what the function did.

   The one case that is not arithmetic is the last: it asks the real world
   model whether the station goes into shadow and out again on a real orbit
   at a real date, and how long the penumbra takes.
   ══════════════════════════════════════════════════════════════════════ */

import { suite, assert } from "./harness.js";
import { sunlitFraction } from "../src/simulation/world/shadow.js";
import { K } from "../src/simulation/core/units.js";
import { WorldService } from "../src/simulation/world/world-service.js";
import { TimeService } from "../src/simulation/time/time-service.js";

const SUN_R = K.SUN_RADIUS.value;
const EARTH_R = K.EARTH_RADIUS_EQ.value;
const AU = K.AU.value;

/* The Sun on +x at 1 au, Earth at the origin. An observer on −x is behind
   the planet, in shadow; one on +x is between Earth and the Sun, in the
   clear. Altitudes are ISS-like: 420 km. */
const sun = { x: AU, y: 0, z: 0 };
const earth = { id: "earth", position: { x: 0, y: 0, z: 0 }, radius: EARTH_R };
const at = (x, y) => ({ x, y, z: 0 });
const lit = (p, occ = [earth]) => sunlitFraction(p, sun, SUN_R, occ).fraction;

suite("shadow — the Sun's disc, and what covers it", ({ test }) => {
  test("nothing in the way is full sunlight", () => {
    assert.close(lit(at(EARTH_R + 420e3, 0)), 1, 1e-12, "sunlit fraction", "");
  });

  test("directly behind the planet is the umbra, and it is total", () => {
    assert.close(lit(at(-(EARTH_R + 420e3), 0)), 0, 1e-12, "sunlit fraction", "");
  });

  test("an occluder beyond the Sun cannot eclipse it", () => {
    // Same geometry as the umbra case, but the occluder is put out past the
    // Sun. Without the distance test this would still read as shadow.
    const far = { id: "earth", position: { x: 2 * AU, y: 0, z: 0 }, radius: EARTH_R };
    assert.close(lit(at(-(EARTH_R + 420e3), 0), [far]), 1, 1e-12, "sunlit fraction", "");
  });

  test("half the disc covered is half the light", () => {
    /* Put the observer where the occluder's limb runs exactly through the
       Sun's centre. The angular separation of the two centres then equals
       the occluder's angular radius, and a circle cut by a chord through
       its centre loses half its area — whatever the two radii are.

       The placement is solved for here rather than written down, with plain
       vector geometry that never calls the function under test. Putting the
       observer at `bodyAng` around the planet is the obvious guess and it is
       wrong: the Sun is not on the axis as seen from a point 6 800 km off
       it, and that parallax is 0.9% of the Sun's angular radius — which
       moves the answer by half a percent, the same order as the effect
       being measured. */
    const d = EARTH_R + 420e3;
    const bodyAng = Math.asin(EARTH_R / d);
    const separationAt = (theta) => {
      const p = { x: -d * Math.cos(theta), y: -d * Math.sin(theta) };
      const toSun = { x: sun.x - p.x, y: sun.y - p.y };       // toward the Sun
      const toEarth = { x: -p.x, y: -p.y };                   // toward the centre
      const ls = Math.hypot(toSun.x, toSun.y), le = Math.hypot(toEarth.x, toEarth.y);
      return Math.acos((toSun.x * toEarth.x + toSun.y * toEarth.y) / (ls * le));
    };
    let lo = bodyAng * 0.9, hi = bodyAng * 1.1;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (separationAt(mid) < bodyAng) lo = mid; else hi = mid;
    }
    const theta = (lo + hi) / 2;
    const p = { x: -d * Math.cos(theta), y: -d * Math.sin(theta), z: 0 };

    /* The tolerance is not slack, it is the stated approximation. `lensArea`
       treats both discs as flat, and Earth's limb is not flat across the
       Sun's half-degree: it sags by b²/2R, which leaves about 0.1% more of
       the Sun showing than a straight edge would. Anything wrong with the
       lens area itself is a percent-level error or worse, so this still
       pins the formula. */
    assert.close(lit(p), 0.5, 3e-3, "sunlit fraction", "");
  });

  test("the penumbra is monotonic from lit to dark", () => {
    // Sweep the observer around the planet through the shadow edge.
    const d = EARTH_R + 420e3;
    const bodyAng = Math.asin(EARTH_R / d);
    const sunAng = Math.asin(SUN_R / (AU + d));
    let previous = 1;
    let sawPartial = 0;
    // From well outside the penumbra to well inside the umbra.
    for (let i = 0; i <= 200; i++) {
      const off = bodyAng + sunAng * 2 - (i / 200) * (sunAng * 4);
      const p = { x: -d * Math.cos(off), y: -d * Math.sin(off), z: 0 };
      const f = lit(p);
      assert.ok(f <= previous + 1e-9, `fraction rose from ${previous} to ${f} entering shadow`);
      if (f > 1e-6 && f < 1 - 1e-6) sawPartial++;
      previous = f;
    }
    assert.ok(sawPartial > 20, `expected a resolved penumbra, saw ${sawPartial} partial steps`);
    assert.close(previous, 0, 1e-9, "fraction at the end of the sweep", "");
  });

  test("standing inside the occluder is not lit at all", () => {
    assert.close(lit(at(0, 0)), 0, 1e-12, "sunlit fraction", "");
  });
});

suite("shadow — the station on a real orbit", ({ test }) => {
  test("the station enters and leaves Earth's shadow every orbit", () => {
    const time = new TimeService();
    const world = new WorldService(time);

    // One full orbit at 10-second steps. The station's period is ~93 min.
    let minimum = 1, maximum = 0, partial = 0, dark = 0;
    const samples = 560;
    for (let i = 0; i < samples; i++) {
      time.advance(10);
      const f = world.update().station.sunlit;
      assert.ok(f >= 0 && f <= 1, `sunlit fraction out of range: ${f}`);
      minimum = Math.min(minimum, f);
      maximum = Math.max(maximum, f);
      if (f < 1e-6) dark++;
      else if (f < 1 - 1e-6) partial++;
    }
    assert.close(maximum, 1, 1e-9, "brightest point of the orbit", "");
    assert.ok(minimum < 1e-9, `expected a total eclipse somewhere in the orbit, darkest was ${minimum}`);
    /* A low orbit spends roughly a third of its period in Earth's shadow —
       less near an eclipse season, when the orbit plane is edge-on to the
       Sun, and never more than about 40% for a circular one at this
       altitude. Outside 10–45% the geometry is wrong, not seasonal. */
    const eclipsed = dark / samples;
    assert.ok(eclipsed > 0.10 && eclipsed < 0.45,
      `station spent ${(eclipsed * 100).toFixed(1)}% of the orbit in shadow`);
    assert.ok(partial >= 1, `expected to catch the penumbra at least once, saw ${partial}`);
  });

  test("the fraction moves smoothly, never in a single step", () => {
    const time = new TimeService();
    const world = new WorldService(time);
    // Half-second steps across one orbit: no sample may jump the whole way
    // from full sun to full shadow, or the penumbra is not being resolved.
    let previous = world.update().station.sunlit;
    let biggestJump = 0;
    for (let i = 0; i < 12000; i++) {
      time.advance(0.5);
      const f = world.update().station.sunlit;
      biggestJump = Math.max(biggestJump, Math.abs(f - previous));
      previous = f;
    }
    assert.ok(biggestJump < 0.9, `sunlit fraction jumped by ${biggestJump.toFixed(3)} in half a second`);
  });
});
