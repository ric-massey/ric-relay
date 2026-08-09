/* ══════════════════════════════════════════════════════════════════════
   The crash model, checked against the numbers it was specified with.

   `node test/impact.test.js` from projects/offramp.

   impact.js is pure — numbers in, numbers out, no DOM and no game state
   — precisely so this file can exist. Every expected figure below comes
   from CRASH-MODEL.md §11, and every one of them is a published crash
   figure or something derived from one, so a pass here is a pass
   against reconstruction practice rather than against how the game
   feels. Nothing gets wired into offramp.js until this is green.
   ══════════════════════════════════════════════════════════════════════ */

const I = require("../src/impact.js");

let pass = 0, fail = 0;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
function ok(name, got, want, tol) {
  const good = tol === undefined ? got === want : near(got, want, tol);
  if (good) { pass++; console.log(`  ok   ${name}  = ${fmt(got)}`); }
  else { fail++; console.log(`  FAIL ${name}  = ${fmt(got)}   want ${fmt(want)}${tol ? ` ±${tol}` : ""}`); }
}
const fmt = (n) => typeof n === "number" ? (Number.isInteger(n) ? String(n) : n.toFixed(3)) : String(n);
const head = (s) => console.log(`\n${s}\n${"─".repeat(s.length)}`);

const kmh = (ms) => ms * 3.6;
const ms = (k) => k / 3.6;

/* A car with no yaw, struck at its centre of gravity, so every rotation
   term drops out and the answer is the collinear one. */
const car = (vx, vy, m = 1500) => ({ m, Iz: 2200, v: { x: vx, y: vy }, w: 0, r: { x: 0, y: 0 } });

/* ══════════════════════════════════════════════════════════════════════
   §11.1 — the solver, central and collinear
   ══════════════════════════════════════════════════════════════════════ */
head("§11.1  collision solver — central, collinear, no rotation");
{
  const n = { x: 0, y: -1 };          // wall ahead; normal points back at the car

  // 1500 kg into a rigid barrier at 100 km/h
  let r = I.solve(car(0, ms(100)), I.fixed(), { n, mu: 0 });
  ok("rigid barrier 100 km/h  ε", r.eps, 0.059, 0.001);
  ok("rigid barrier 100 km/h  Δv", kmh(r.dvA), 105.9, 0.1);

  // 1500 into a stationary 1500
  r = I.solve(car(0, ms(100)), car(0, 0), { n, mu: 0 });
  ok("into stationary car     Δv striker", kmh(r.dvA), 53.0, 0.1);
  ok("into stationary car     Δv struck", kmh(r.dvB), 53.0, 0.1);

  // 1500 at 100 into 1500 at 90 — the differential, not the speed
  r = I.solve(car(0, ms(100)), car(0, ms(90)), { n, mu: 0 });
  ok("100 into 90             ε", r.eps, 0.262, 0.001);
  ok("100 into 90             Δv striker", kmh(r.dvA), 6.3, 0.1);
  ok("100 into 90             Δv struck", kmh(r.dvB), 6.3, 0.1);

  // 1500 into a loaded semi, 100 km/h closing
  r = I.solve(car(0, ms(100)), car(0, 0, 36000), { n, mu: 0 });
  ok("into 36 t semi          Δv car", kmh(r.dvA), 101.7, 0.1);
  ok("into 36 t semi          Δv truck", kmh(r.dvB), 4.2, 0.1);

  // separation: no impulse, ever
  ok("separating returns null", I.solve(car(0, -ms(50)), I.fixed(), { n, mu: 0 }), null);
}

/* ══════════════════════════════════════════════════════════════════════
   §11.2 — the median, oblique, with tangential friction

   n̂ points out of the wall (+x); the car carries its lateral velocity
   into it (−x) and the whole road speed along it (+y). Contact at
   mid-flank, so r = 0 and the rotation terms vanish.
   ══════════════════════════════════════════════════════════════════════ */
head("§11.2  median — oblique, tangential friction saturated");
{
  const n = { x: 1, y: 0 }, fwd = { x: 0, y: 1 };
  /* The last column is the spec's stated P(fatal); rows 3 and 4 are the
     spec's own arithmetic drifting off its own side-weighted column —
     pFatal(64.8) is 0.494 and pFatal(35.7) is 0.031, not 0.498 and
     0.024. The curve is asserted against the delta-v the solver
     produces, which is the thing under test; the spec's figures are
     kept alongside so the drift is visible rather than quietly fixed. */
  const rows = [
    // lat    fwd    Δv     normal  tangential  sideWeighted  pFatal  (spec says)
    [52.7, 354, 62.3, 57.9, 23.2, 112.2, 0.996, 0.996],
    [20.2, 354, 26.0, 24.2, 9.7, 46.9, 0.106, 0.107],
    [28.8, 113, 36.0, 33.4, 13.4, 64.8, 0.494, 0.498],
    [15.0, 113, 19.9, 18.4, 7.4, 35.7, 0.031, 0.024],
  ];
  for (const [lat, fw, dv, nn, tt, side, pf, spec] of rows) {
    const r = I.solve(car(-ms(lat), ms(fw)), I.fixed(), { n, mu: 0.40 });
    const a = I.blowAngle(r.J, fwd);
    const eff = I.effectiveDv(kmh(r.dvA), a);
    const tag = `${lat} lat / ${fw} fwd`;
    ok(`${tag}  Δv`, kmh(r.dvA), dv, 0.1);
    ok(`${tag}  normal`, kmh(r.jn / 1500), nn, 0.1);
    ok(`${tag}  tangential`, kmh(Math.abs(r.jt) / 1500), tt, 0.1);
    ok(`${tag}  side-weighted`, eff, side, 0.2);
    ok(`${tag}  P(fatal)${pf === spec ? "" : ` (spec prints ${spec})`}`,
       I.pFatal(eff), pf, 0.002);
  }

  /* The blow always lands at the same bearing once friction saturates —
     atan(mu) off the flank — which is why every row above weights 1.80. */
  const r = I.solve(car(-ms(20.2), ms(354)), I.fixed(), { n, mu: 0.40 });
  ok("saturated blow bearing", Math.abs(I.blowAngle(r.J, fwd)),
     90 - Math.atan(0.40) * 180 / Math.PI, 0.01);

  /* Ride-down must be a no-op for an ordinary crush pulse or every
     number above is wrong in the game even though it is right here. */
  const dv = kmh(r.dvA);
  ok("ride-down on a 0.10 s pulse", I.rideDownFactor(r.dvA / I.CONTACT_T / I.G, r.dvA), 1.0, 1e-12);
}

/* ══════════════════════════════════════════════════════════════════════
   §11.3 — rollover
   ══════════════════════════════════════════════════════════════════════ */
head("§11.3  rollover — the floor is an energy balance");
{
  ok("CG lift Δh", I.LIFT, 0.380, 0.001);
  ok("v_crit", I.V_CRIT, 16.6, 0.05);
  ok("static stability factor", I.SSF, 1.36, 0.01);
  ok("rolloverRisk(16.6) is exactly zero", I.rolloverRisk(16.6), 0);
  ok("rolloverRisk(0) is exactly zero", I.rolloverRisk(0), 0);
  ok("P(roll) 20 km/h", I.rolloverRisk(20), 0.022, 0.001);
  ok("P(roll) 25", I.rolloverRisk(25), 0.137, 0.001);
  ok("P(roll) 29", I.rolloverRisk(29), 0.299, 0.001);
  ok("P(roll) 35", I.rolloverRisk(35), 0.659, 0.002);
  ok("P(roll) 40 capped", I.rolloverRisk(40), 0.85, 0.001);
  ok("P(roll) 200 still capped", I.rolloverRisk(200), 0.85, 1e-12);
  ok("soft ground raises it", I.rolloverRisk(25, I.SOIL.soft) > I.rolloverRisk(25), true);

  ok("quarter turns at 60", I.quarterTurns(60), 1);
  ok("quarter turns at 100", I.quarterTurns(100), 1);
  ok("quarter turns at 160", I.quarterTurns(160), 2);
  ok("quarter turns at 250", I.quarterTurns(250), 6);
}

/* ══════════════════════════════════════════════════════════════════════
   §5 — the attenuator is a crush stroke, not a rating
   ══════════════════════════════════════════════════════════════════════ */
head("§5  attenuator — six metres of stroke");
{
  const rows = [
    // approach km/h, mean g, and what the spec says it should read as
    [60, 2.4, "damage"],
    [110, 7.9, "the design case"],
    [160, 16.8, "fatal"],
  ];
  for (const [v, g] of rows) {
    const c = I.crushStop(ms(v));
    ok(`${v} km/h  mean g`, c.gMean, g, 0.1);
    ok(`${v} km/h  absorbed`, kmh(c.dv), v, 0.1);
  }

  // the design case, all the way through to an outcome
  const c = I.crushStop(ms(110));
  const f = I.rideDownFactor(c.gMean, c.dv);
  const eff = kmh(c.dv) * 1.00 * f;
  ok("110 km/h  ride-down factor", f, 0.56, 0.01);
  ok("110 km/h  Δv effective", eff, 62, 0.5);
  ok("110 km/h  P(fatal)", I.pFatal(eff), 0.41, 0.02);
  ok("110 km/h  P(disabling)", I.pDisabling(eff), 0.885, 0.02);

  const slow = I.crushStop(ms(60));
  const effSlow = kmh(slow.dv) * I.rideDownFactor(slow.gMean, slow.dv);
  ok("60 km/h  outcome on a median roll", I.outcome(effSlow, 0.5), "damage");
  const fast = I.crushStop(ms(160));
  const effFast = kmh(fast.dv) * I.rideDownFactor(fast.gMean, fast.dv);
  ok("160 km/h  outcome on a median roll", I.outcome(effFast, 0.5), "fatal");

  ok("stroke swallows 160 km/h whole", I.crushStop(ms(160)).exhausted, false);
  ok("200 km/h reaches the backing", I.crushStop(ms(200)).exhausted, true);
  // √(v² − 2·a_max·stroke) with a_max = 20 g: 55.6 m/s in, 27.1 m/s out
  ok("200 km/h residual onto the backing", kmh(I.crushStop(ms(200)).vOut), 97.4, 0.2);
}

/* ══════════════════════════════════════════════════════════════════════
   §4.5 / §4.6 — direction weighting and the single roll
   ══════════════════════════════════════════════════════════════════════ */
head("§4.5 / §4.6  direction weighting and outcome bands");
{
  ok("frontal", I.directionFactor(0), 1.00);
  ok("30° still frontal", I.directionFactor(30), 1.00);
  ok("45° oblique", I.directionFactor(45), 1.40, 1e-9);
  ok("90° side", I.directionFactor(90), 1.80);
  ok("120° side", I.directionFactor(120), 1.80);
  ok("135° oblique rear", I.directionFactor(135), 1.25, 1e-9);
  ok("180° rear", I.directionFactor(180), 0.70);
  ok("−90° is still a side", I.directionFactor(-90), 1.80);

  ok("P(fatal) 20", I.pFatal(20), 0.005, 0.001);
  ok("P(fatal) 40", I.pFatal(40), 0.050, 0.001);
  ok("P(fatal) 65", I.pFatal(65), 0.500, 1e-9);
  ok("P(fatal) 100", I.pFatal(100), 0.984, 0.001);
  ok("P(disabling) 45", I.pDisabling(45), 0.500, 1e-9);
  ok("P(disabling) 65", I.pDisabling(65), 0.914, 0.001);
  ok("disabling is cumulative", [10, 30, 50, 70, 90].every((d) => I.pDisabling(d) >= I.pFatal(d)), true);

  // one roll, cumulative thresholds — never fatal-but-not-disabling
  ok("roll 0.00 at 65 → fatal", I.outcome(65, 0.00), "fatal");
  ok("roll 0.70 at 65 → disabling", I.outcome(65, 0.70), "disabling");
  ok("roll 0.99 at 65 → damage", I.outcome(65, 0.99), "damage");
  ok("roll 0.99 at 8 → superficial", I.outcome(8, 0.99), "superficial");
  let bad = 0;
  for (let i = 0; i < 20000; i++) {
    const d = Math.random() * 120, r = Math.random();
    const o = I.outcome(d, r);
    if (o === "fatal" && r >= I.pDisabling(d)) bad++;
  }
  ok("no incoherent outcomes in 20k rolls", bad, 0);
}

/* ══════════════════════════════════════════════════════════════════════
   the fence, which is a fence
   ══════════════════════════════════════════════════════════════════════ */
head("§6.4  the fence — 40 kg of post and wire");
{
  const B = I.BODIES.fence;
  const fence = { m: B.m, Iz: B.Iz, v: { x: 0, y: 0 }, w: 0, r: { x: 0, y: 0 } };
  const r = I.solve(car(0, ms(354)), fence, { n: { x: 0, y: -1 }, mu: B.mu, eps: B.eps });
  ok("354 km/h through a fence costs the car", kmh(r.dvA) < 12, true);
  ok("...and it is under 10 km/h", kmh(r.dvA), 9.7, 0.3);
  const eff = I.effectiveDv(kmh(r.dvA), 0);
  ok("...which is not even a damage band", I.outcome(eff, 0.999), "superficial");
}

/* ══════════════════════════════════════════════════════════════════════ */
head(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
