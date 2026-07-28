/* ══════════════════════════════════════════════════════════════════════
   scientific.test.js — regression tests against published reference cases.

   Scientific Standard §7.1: every scientific model needs reference cases,
   numeric tolerances, and "tests independent from the implementation when
   possible". The reference values below come from Meeus's own worked
   examples, which were computed independently of this code and decades
   before it — which is exactly what makes them worth testing against.

   If one of these fails, the ephemeris is wrong. Not "looks a bit off":
   wrong.
   ══════════════════════════════════════════════════════════════════════ */

import { suite, assert } from "./harness.js";
import {
  moonEclipticOfDate, sunEclipticOfDate, meanObliquityDeg, gmstDeg,
  eclipticToEquatorial, moonStateEci, sunStateEci,
} from "../src/simulation/world/ephemeris.js";
import { K, lorentzFactor } from "../src/simulation/core/units.js";
const C = K.C_LIGHT.value;
import { length } from "../src/simulation/core/linalg.js";
import {
  dateToJdUtc, jdUtcToTtSeconds, ttSecondsToJdUtc, TimeService,
} from "../src/simulation/time/time-service.js";

suite("ephemeris — Meeus reference cases", ({ test }) => {
  // Example 47.a: 1992 April 12, 0h TD. T = −0.077221081451.
  const T_MOON = -0.077221081451;

  test("Moon's longitude matches Meeus example 47.a", () => {
    assert.close(moonEclipticOfDate(T_MOON).lonDeg, 133.162655, 1e-5, "λ", "°");
  });

  test("Moon's latitude matches Meeus example 47.a", () => {
    assert.close(moonEclipticOfDate(T_MOON).latDeg, -3.229126, 1e-5, "β", "°");
  });

  test("Moon's distance matches Meeus example 47.a", () => {
    // 368 409.7 km. A 100 m tolerance on a 368 000 km distance is 3×10⁻⁷.
    assert.close(moonEclipticOfDate(T_MOON).distanceM / 1000, 368409.7, 0.1, "Δ", " km");
  });

  test("mean obliquity matches Meeus example 22.a", () => {
    // 1987 April 10: ε₀ = 23° 26′ 27.407″
    // Tolerance is 1e-6°, or 0.0036″ — the book prints the answer to a
    // thousandth of an arcsecond, so anything tighter is testing Meeus's
    // rounding rather than the formula.
    const eps = meanObliquityDeg(-0.127296372348);
    assert.close(eps, 23 + (26 + 27.407 / 60) / 60, 1e-6, "ε₀", "°");
  });

  test("Sun's apparent longitude matches Meeus example 25.a", () => {
    // 1992 October 13, 0h TD: apparent λ = 199.90894°
    assert.close(sunEclipticOfDate(-0.072183436).lonDeg, 199.90894, 1e-4, "λ☉", "°");
  });

  test("Sun's radius vector matches Meeus example 25.a", () => {
    // R = 0.99766 au by the low-accuracy method.
    assert.close(sunEclipticOfDate(-0.072183436).distanceM / K.AU.value,
      0.99766, 5e-5, "R", " au");
  });

  test("sidereal time matches Meeus example 12.a", () => {
    // 1987 April 10, 0h UT: θ₀ = 197.693195°
    assert.close(gmstDeg(2446895.5), 197.693195, 1e-5, "θ₀", "°");
  });
});

suite("ephemeris — physical sanity", ({ test }) => {
  const time = new TimeService({ startUtc: new Date("2026-07-25T00:00:00Z") });

  test("the Moon stays inside its real range of distances", () => {
    // Perigee and apogee vary, but never outside 356 400 – 406 800 km.
    for (let day = 0; day < 400; day += 3) {
      const d = moonStateEci(time.tt + day * 86400).position;
      const r = length(d) / 1000;
      assert.ok(r > 356000 && r < 407000, `Moon at ${r.toFixed(0)} km on day ${day}`);
    }
  });

  test("the Sun stays between perihelion and aphelion", () => {
    for (let day = 0; day < 400; day += 5) {
      const r = length(sunStateEci(time.tt + day * 86400).position) / K.AU.value;
      assert.ok(r > 0.9832 && r < 1.0168, `Sun at ${r.toFixed(5)} au on day ${day}`);
    }
  });

  test("the Moon's orbital speed is about a kilometre per second", () => {
    const v = length(moonStateEci(time.tt).velocity);
    assert.close(v, 1022, 60, "lunar orbital speed", " m/s");
  });

  test("Earth's orbital speed is about 29.8 km/s", () => {
    // Measured as the Sun's apparent motion about Earth, which is the same
    // number seen from the other end.
    const v = length(sunStateEci(time.tt).velocity);
    assert.close(v / 1000, 29.8, 0.6, "Earth's orbital speed", " km/s");
  });

  test("the ecliptic-to-equatorial transform preserves length", () => {
    const eq = eclipticToEquatorial(
      { lonDeg: 133.162655, latDeg: -3.229126, distanceM: 3.684097e8 }, 23.440636);
    assert.relative(length(eq), 3.684097e8, 1e-12, "distance after rotation");
  });

  test("the Moon's inclination to the equator stays under 29°", () => {
    // The lunar orbit is inclined 5.1° to the ecliptic, which is itself
    // 23.4° from the equator — so the Moon's declination swings between
    // about ±18° and ±29° over the 18.6-year nodal cycle, and never beyond.
    for (let day = 0; day < 700; day += 7) {
      const p = moonStateEci(time.tt + day * 86400).position;
      const dec = Math.asin(p.z / length(p)) * (180 / Math.PI);
      assert.ok(Math.abs(dec) < 29.1, `declination ${dec.toFixed(2)}° on day ${day}`);
    }
  });
});

suite("time", ({ test }) => {
  test("Julian Date round-trips through UTC", () => {
    const d = new Date("2026-07-25T12:34:56Z");
    const jd = dateToJdUtc(d);
    assert.close(jd, 2461247.024259, 1e-5, "JD");
    const back = ttSecondsToJdUtc(jdUtcToTtSeconds(jd));
    assert.close(back, jd, 1e-9, "JD round trip");
  });

  test("the J2000 epoch converts to UTC using the current leap-second count", () => {
    // TT is ahead of UTC by 69.184 s in 2026, so noon TT lands at
    // 11:58:50.816 UTC. Getting the sign of this backwards is the classic
    // bug, so it is pinned here.
    //
    // Note what this test also documents: in 2000 the offset was 64.184 s,
    // because five leap seconds have been inserted since. The model uses
    // one constant count for all time, so converting a historical epoch is
    // off by however many leap seconds separate it from today. That is
    // fine for a game that starts at the current date and never travels in
    // time, and it is written down rather than discovered later.
    const jd = ttSecondsToJdUtc(0);
    const utc = new Date((jd - K.UNIX_JD_EPOCH.value) * 86400000);
    assert.equal(utc.toISOString().slice(0, 19), "2000-01-01T11:58:50");
  });

  test("the traveler clock counts real seconds and never scales", () => {
    const t = new TimeService({ startUtc: new Date("2026-07-25T00:00:00Z") });
    t.tick(0);
    for (let i = 1; i <= 20; i++) t.tick(i * 0.1, 1.5); // pretend γ = 1.5
    assert.close(t.travelerSeconds, 2.0, 1e-9, "traveler clock", " s");
    // Home time ran ahead because γ was 1.5 — the divergence is a result,
    // never a scripted number.
    assert.close(t.homeSeconds, 3.0, 1e-9, "home clock", " s");
  });

  test("a paused simulation does not advance, and resuming does not catch up", () => {
    const t = new TimeService({ startUtc: new Date("2026-07-25T00:00:00Z") });
    t.tick(0);
    t.tick(1);
    const before = t.tt;
    t.pause();
    t.tick(2);
    t.tick(60);
    assert.equal(t.tt, before, "time advanced while paused");
    t.resume();
    t.tick(61);
    t.tick(61.1);
    // Tolerance is float32-ish rather than exact: the wall clock arrives as
    // a difference of two large numbers, and this is testing that the
    // paused span was dropped, not that arithmetic is exact.
    assert.close(t.tt - before, 0.1, 1e-6, "time after resuming", " s");
  });

  test("a stalled tab cannot teleport the world", () => {
    const t = new TimeService({ startUtc: new Date("2026-07-25T00:00:00Z") });
    t.tick(0);
    t.tick(600); // ten minutes of a backgrounded tab
    assert.ok(t.tt - t.epochTt <= t.maxStepSeconds + 1e-9, "step was not clamped");
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Time dilation — declared for months, computed since 2026-07-28
   ══════════════════════════════════════════════════════════════════════ */

suite("relativity — the two clocks", ({ test }) => {
  test("gamma is exact below light and declared fiction above it", () => {
    assert.equal(lorentzFactor(0), 1, "at rest");
    // 0.6 c gives gamma = 1/0.8 = 1.25 exactly. A round number on purpose:
    // it can be checked by hand, which is most of why it was chosen.
    assert.relative(lorentzFactor(0.6 * C), 1.25, 1e-12, "gamma at 0.6 c");
    assert.relative(lorentzFactor(0.8 * C), 1 / 0.6, 1e-12, "gamma at 0.8 c");

    /* Above c there is no relativistic answer to give — beta > 1 makes
       1-beta^2 negative and gamma imaginary. The declared fiction
       (SF-L-018) is that the faster-than-light drive does not dilate time,
       so gamma is 1 and the HUD names the regime. What must never happen is
       a NaN reaching the clocks, which is what the naive formula returns. */
    for (const v of [C, 1.5 * C, 1e6 * C]) {
      const g = lorentzFactor(v);
      assert.ok(Number.isFinite(g), `gamma at ${v / C} c must be finite, got ${g}`);
      assert.equal(g, 1, `gamma at ${v / C} c is 1 by declared fiction`);
    }
  });

  test("the clocks actually separate, which they could not before", () => {
    /* The regression this exists for. `TimeService.step` took a `lorentz`
       argument defaulting to 1 and nothing in the app ever passed one, so
       the two clocks were identical by construction — while the HUD said
       "you are not going fast enough to separate them" at any speed at all.
       A readout stating a physical reason for something that is really just
       unimplemented is what the honesty ledger exists to prevent. */
    const t = new TimeService();
    t.tick(0);
    for (let i = 0; i < 100; i++) t.step(1, lorentzFactor(0.8 * C));

    assert.close(t.travelerSeconds, 100, 1e-9, "your clock runs one second per second", " s");
    // gamma = 1/0.6, so home gains 100/0.6 = 166.67 s while you age 100.
    assert.close(t.homeSeconds, 100 / 0.6, 1e-6, "home clock", " s");
    assert.ok(t.clockDivergenceSeconds > 60,
      `home should be about 66 s ahead, was ${t.clockDivergenceSeconds.toFixed(1)}`);
  });

  test("at slice speeds they agree, and that is the correct answer", () => {
    // 7.66 km/s in low orbit gives gamma-1 of about 3e-10. The clocks
    // agreeing across the Earth-Moon slice is physics, not a missing
    // feature, so the fix above must not have made the quiet case noisy.
    const t = new TimeService();
    t.tick(0);
    for (let i = 0; i < 3600; i++) t.step(1, lorentzFactor(7660));
    assert.ok(Math.abs(t.clockDivergenceSeconds) < 1e-5,
      `an hour in low orbit should separate them by microseconds, was ${t.clockDivergenceSeconds}`);
  });
});
