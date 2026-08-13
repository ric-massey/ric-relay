/* ══════════════════════════════════════════════════════════════════════
   The garage, driven rather than read.

   `node test/garage.test.js` from projects/offramp.

   data/garage.js derives each vehicle's rates in closed form. That proves
   the ARITHMETIC and nothing else — the game does not evaluate an
   integral, it adds `a(v)·dt` to a speed sixty times a second, and a
   forward Euler step on a falling acceleration overshoots. So every
   figure below is measured by stepping the real update at the real frame
   rate and timing it with a stopwatch, exactly as a magazine would.

   The point of the file: a row in the table is a claim about a real car,
   and this is what makes the claim falsifiable. Put 2.8 s in the Jetta's
   row and this goes red, rather than the Jetta merely feeling brisk.
   ══════════════════════════════════════════════════════════════════════ */

const Garage = require("../data/garage.js");

let pass = 0, fail = 0;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const fmt = (n) => typeof n === "number"
  ? (Number.isInteger(n) ? String(n) : n.toFixed(3)) : String(n);
function ok(name, got, want, tol) {
  const good = tol === undefined ? got === want : near(got, want, tol);
  if (good) { pass++; console.log(`  ok   ${name}  = ${fmt(got)}`); }
  else { fail++; console.log(`  FAIL ${name}  = ${fmt(got)}   want ${fmt(want)}${tol !== undefined ? ` ±${tol}` : ""}`); }
}
function within(name, got, lo, hi) {
  if (got >= lo && got <= hi) { pass++; console.log(`  ok   ${name}  = ${fmt(got)}  (${lo}–${hi})`); }
  else { fail++; console.log(`  FAIL ${name}  = ${fmt(got)}   want ${lo}–${hi}`); }
}
const head = (s) => console.log(`\n${s}\n${"─".repeat(s.length)}`);

const KMH_PER_MPH = 1.609344;
const MPH60 = 60 * KMH_PER_MPH;
const DT = 1 / 60;                        // the frame the game actually runs

/* ── the update under test ──────────────────────────────────────────────
   This is offramp.js's longitudinal step and nothing else. It is
   duplicated here deliberately rather than imported: offramp.js is a DOM
   module that cannot be loaded headless, and the whole value of the file
   is lost if the thing being measured is a paraphrase. If the game's
   line changes, this line has to change with it, and the comment at the
   call site in offramp.js says so. */
const pull = (c, v) => c.a0 * (1 - (v / c.vTop) ** 2);

/* Wide open from rest. Returns seconds to `target` km/h, interpolated
   inside the frame it crosses on so the answer is not quantised to
   16.7 ms steps. */
function timeTo(c, target) {
  let v = 0, t = 0;
  for (let i = 0; i < 60 * 600; i++) {
    const prev = v;
    v += pull(c, v) * DT;
    t += DT;
    if (v >= target) return t - DT * ((v - target) / (v - prev));
  }
  return Infinity;
}

/* Held wide open until it stops gaining. "Top speed" for a real car is
   where the road testers gave up, so the bar here is the same one: the
   speed at which another ten seconds is worth less than a tenth of a
   mph. */
function terminal(c) {
  let v = 0;
  for (let i = 0; i < 60 * 3600; i++) v += pull(c, v) * DT;
  return v;
}

/* 60–0, in feet, integrating the distance as it goes. The game brakes at
   a constant rate, which is what a published stopping distance assumes,
   so this should come back to the number in the row. */
function stop60(c) {
  let v = MPH60, d = 0;
  for (let i = 0; i < 60 * 120 && v > 0; i++) {
    const step = Math.min(c.brake * DT, v);
    d += ((v - step / 2) / 3.6) * DT;      // mean speed across the frame, m
    v -= step;
  }
  return d / 0.3048;
}

/* ══════════════════════════════════════════════════════════════════════
   §1  every vehicle reaches 60 when it says it does
   ══════════════════════════════════════════════════════════════════════ */
head("§1  0–60 mph, stopwatched at 60 fps");

console.log("       vehicle          claimed   measured    error");
for (const c of Garage.ALL) {
  const t = timeTo(c, MPH60);
  const err = (t - c.t60) / c.t60;
  console.log(`       ${(c.model).padEnd(16)} ${c.t60.toFixed(1).padStart(6)} s ${t.toFixed(2).padStart(8)} s ${(err * 100).toFixed(1).padStart(7)}%`);
  ok(`${c.id} reaches 60 on time`, t, c.t60, 0.15);
}

/* The Euler overshoot is a real effect and it should be SMALL and in a
   known direction — a forward step on a decreasing acceleration always
   flatters the car. If this ever went the other way, the update being
   measured has stopped being the update the game runs. */
head("§1a  and the integration error is small, and one-sided");

let worst = 0, allFast = true;
for (const c of Garage.ALL) {
  const t = timeTo(c, MPH60);
  if (t > c.t60 + 1e-9) allFast = false;
  worst = Math.max(worst, Math.abs(t - c.t60) / c.t60);
}
ok("forward Euler never makes a car SLOWER than its claim", allFast, true);
within("worst 0–60 error across the garage, %", worst * 100, 0, 3);

/* ══════════════════════════════════════════════════════════════════════
   §2  and it stops gaining where the magazine said it would

   This is the one the old car could not do. V_MAX was a clamp, so the
   car arrived at 220 mph still pulling 15.7 km/h/s and simply hit a
   wall. Here the acceleration is zero AT the top speed, so the last few
   mph take real time to find — which is what the third column measures.
   ══════════════════════════════════════════════════════════════════════ */
head("§2  top speed");

console.log("       vehicle          claimed   reached   90%→100% takes");
for (const c of Garage.ALL) {
  const vt = terminal(c);
  const t90 = timeTo(c, 0.90 * c.vTop);
  const t99 = timeTo(c, 0.99 * c.vTop);
  console.log(`       ${(c.model).padEnd(16)} ${String(c.top).padStart(5)} mph ${(vt / KMH_PER_MPH).toFixed(1).padStart(7)} ${(t99 - t90).toFixed(0).padStart(11)} s`);
  ok(`${c.id} tops out where it claims`, vt / KMH_PER_MPH, c.top, 0.5);
}

ok("nothing in the garage will do 220 mph, as the old single car did",
   Math.max(...Garage.ALL.map((c) => c.top)) < 220, true);

/* ══════════════════════════════════════════════════════════════════════
   §3  brakes — the change that alters how the game plays

   The old car stopped at 132 km/h/s, which is 3.7 g. Nothing has ever
   done that. These are the published 60–0 distances, inverted.
   ══════════════════════════════════════════════════════════════════════ */
head("§3  60–0 mph");

console.log("       vehicle          claimed   measured    peak g");
for (const c of Garage.ALL) {
  const d = stop60(c);
  console.log(`       ${(c.model).padEnd(16)} ${String(c.stop).padStart(5)} ft ${d.toFixed(1).padStart(8)} ft ${c.decelG.toFixed(2).padStart(9)}`);
  ok(`${c.id} stops in the distance it claims`, d, c.stop, 2);
  /* No tyre on a road car exceeds about 1.3 g in a straight line, and
     nothing roadworthy is below 0.7. A row outside that band is a typo,
     not a car. */
  within(`${c.id} decelerates like a road vehicle`, c.decelG, 0.70, 1.30);
}

head("§3a  and the old car was not one");

const oldBrakeG = 132 / 3.6 / 9.80665;
const oldPullG = 56 / 3.6 / 9.80665;
console.log(`       what this replaces: ${oldPullG.toFixed(2)} g of pull, ${oldBrakeG.toFixed(2)} g of brake`);
ok("the car being replaced braked harder than any tyre allows", oldBrakeG > 1.3, true);
const hardest = Math.max(...Garage.ALL.map((c) => c.decelG));
console.log(`       hardest-stopping vehicle here is ${hardest.toFixed(2)} g — braking distances roughly ${(oldBrakeG / hardest).toFixed(1)}× longer`);

/* ══════════════════════════════════════════════════════════════════════
   §4  the launch figures were never fitted, so they are evidence

   `a0` falls out of the published 0–60 with nothing in the arithmetic
   that knows about traction. That it lands in the right physical band
   for each drivetrain is the reason to trust the table.
   ══════════════════════════════════════════════════════════════════════ */
head("§4  implied launch g, which nothing aimed at");

for (const c of Garage.ALL) {
  const g = c.a0 / 3.6 / 9.80665;
  console.log(`       ${(c.model).padEnd(16)} ${g.toFixed(2)} g`);
}
within("nothing launches harder than an all-wheel-drive car can",
       Math.max(...Garage.ALL.map((c) => c.a0 / 3.6 / 9.80665)), 0.5, 1.05);
ok("the Jetta launches like a 115 hp shopping car",
   Garage.get("jetta").a0 / 3.6 / 9.80665 < 0.35, true);
ok("the bike is wheelie-limited, not grip-limited — near 1 g, not above",
   Garage.get("s1000rr").a0 / 3.6 / 9.80665 < 1.05, true);

/* ══════════════════════════════════════════════════════════════════════
   §5  the ladder, and the shape of it

   A progression that is one number going up is a worse progression. The
   Boxster is SLOWER to 60 than the Mustang it unlocks after and better
   than it in every other respect, and that is deliberate.
   ══════════════════════════════════════════════════════════════════════ */
head("§5  the ladder");

const ids = Garage.ids();
ok("sixteen vehicles", Garage.ALL.length, 16);
ok("every id is unique", new Set(ids).size, ids.length);
ok("exactly one vehicle is free to start with",
   Garage.ALL.filter((c) => c.cost === 0).length, 1);
ok("...and it is the Jetta", Garage.ALL.find((c) => c.cost === 0).id, "jetta");

let monotonic = true;
for (let i = 1; i < Garage.ALL.length; i++)
  if (Garage.ALL[i].cost <= Garage.ALL[i - 1].cost) monotonic = false;
ok("the table is in unlock order and each rung costs more", monotonic, true);

const box = Garage.get("boxster"), mus = Garage.get("mustang");
ok("the Boxster unlocks after the Mustang", box.cost > mus.cost, true);
ok("...and is SLOWER to 60 than it", box.t60 > mus.t60, true);
ok("...while stopping shorter", box.stop < mus.stop, true);
ok("...and gripping harder", box.latG > mus.latG, true);
console.log("       the ladder is not one number going up, and §5 is the proof");

/* The bike's whole character is its mass, and nothing anywhere is
   written to make that true — impact.js is mass-based and the row is
   197 kg. */
head("§5a  and the last thing you unlock is the lightest");

const bike = Garage.get("s1000rr");
ok("the bike is the final unlock", bike.cost, Math.max(...Garage.ALL.map((c) => c.cost)));
/* Against the CARS, not against everything, and the distinction only
   started mattering when a second motorcycle arrived. The claim this
   is protecting is that the thing you unlock last is a fifth of the
   mass of the traffic it has to survive — the Road King is also a
   fraction of a car and would otherwise mask it. */
const notBikes = Garage.ALL.filter((c) => c.klass !== "bike");
ok("...and weighs a fraction of every car",
   bike.kg < Math.min(...notBikes.map((c) => c.kg)) / 3, true);
console.log(`       ${bike.kg} kg against the lightest car's ${Math.min(...notBikes.map((c) => c.kg))} kg`);

/* ══════════════════════════════════════════════════════════════════════ */
console.log(`\n${pass} passed, ${fail} failed`);
console.log("─".repeat(30));
process.exit(fail ? 1 : 0);
