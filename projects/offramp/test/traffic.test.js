/* ══════════════════════════════════════════════════════════════════════
   The population model, checked against the counters it came from.

   `node test/traffic.test.js` from projects/offramp.

   traffic.js is pure — corridor px and a clock in, numbers out — so
   every figure below can be checked against something that was actually
   counted rather than against how the road feels. The rule is the same
   one impact.js works to: nothing gets wired into the game until this is
   green.

   Two bugs were found by writing it, and both are still tested for here
   because both were silent:

     * the documented flow formula omitted a /24. `week` averages 1.0
       over 168 cells and `month` over 12, so their product is a day of
       traffic and not an hour of it. 24x too much traffic does not look
       like a unit error further downstream; it looks like tuning.
     * 26 of the 88 counters report only one direction, and a direction's
       share of itself is 1 — so the whole two-way AADT was going to one
       carriageway. Knoxville came out at exactly twice its documented
       figure, which is the only reason it was caught.

   The invariant that catches the first is §2: averaged over a whole
   week and a whole year, demand must come back to AADT/24. The one that
   catches the second is §3: the two directions must sum to the road.
   ══════════════════════════════════════════════════════════════════════ */

global.window = {};
require("../data/traffic.js");
const T = require("../src/traffic.js");

let pass = 0, fail = 0;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
function ok(name, got, want, tol) {
  const good = tol === undefined ? got === want : near(got, want, tol);
  if (good) { pass++; console.log(`  ok   ${name}  = ${fmt(got)}`); }
  else { fail++; console.log(`  FAIL ${name}  = ${fmt(got)}   want ${fmt(want)}${tol !== undefined ? ` ±${tol}` : ""}`); }
}
function within(name, got, lo, hi) {
  if (got >= lo && got <= hi) { pass++; console.log(`  ok   ${name}  = ${fmt(got)}  (${lo}–${hi})`); }
  else { fail++; console.log(`  FAIL ${name}  = ${fmt(got)}   want ${lo}–${hi}`); }
}
const fmt = (n) => typeof n === "number"
  ? (Number.isInteger(n) ? String(n) : n.toFixed(3)) : String(n);
const head = (s) => console.log(`\n${s}\n${"─".repeat(s.length)}`);

/* The four places PLAN.md §5b works through, by corridor pixel. */
const AT = {
  Mojave:    258033.8,      // rural CA, 2 lanes each way, a third lorries
  Amarillo:  8636491.6,
  OKC:      10894962.1,     // the Crosstown, 5 lanes each way
  Knoxville: 18548767.3,    // Papermill, the busiest place on the road
};
const FRI17 = { dow: 4, hour: 17, month: 6 };
const SUN03 = { dow: 6, hour: 3, month: 6 };
const MPH = 1 / 0.44704;

/* ── 1. the file is there and is the right file ─────────────────────── */
head("The corridor loaded");
ok("route", T.data && T.data.id, "I-40");
ok("counters on it", T.data.counters.length, 88);
ok("observed speeds folded in", !!T.data.observed, true);
ok("hourly lorry mix folded in", !!T.data.mix, true);

/* ── 2. the /24, as an invariant rather than a constant ──────────────
   Average demand over every hour of a week and every month of a year.
   `week` and `month` are normalised to 1.0, so whatever else the model
   does, the average must land on the AADT the section carries divided by
   24 hours. This is the test the missing /24 could not have passed. */
head("Averaged over a year, the model comes back to AADT");
for (const [name, px] of Object.entries(AT)) {
  const aadt = T.profile("aadt", px);
  let sum = 0, n = 0;
  for (let m = 0; m < 12; m++)
    for (let d = 0; d < 7; d++)
      for (let h = 0; h < 24; h++) { sum += T.demand(px, { dow: d, hour: h, month: m }); n++; }
  ok(`${name}: mean hourly x 24 vs AADT`, (sum / n) * 24, aadt, aadt * 0.06);
}

/* ── 3. the two carriageways sum to the road ─────────────────────────
   `aadt` is both directions on one centreline. Split it and the halves
   must add up again — which a counter reporting one direction only
   quietly broke, by claiming all of it. */
head("The two directions add up to the road");
for (const [name, px] of Object.entries(AT)) {
  const both = T.demand(px, FRI17);
  const e = T.demand(px, FRI17, +1), w = T.demand(px, FRI17, -1);
  ok(`${name}: east + west vs both`, e + w, both, both * 0.02);
  /* Over a WEEK, not at a moment. A through route is very nearly
     symmetric over time — measured, the counters' annual split runs
     0.484 to 0.529 — but at five on a Friday it is not, and must not
     be, which is the next check. */
  let we = 0, ww = 0;
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
    we += T.demand(px, { dow: d, hour: h, month: 6 }, +1);
    ww += T.demand(px, { dow: d, hour: h, month: 6 }, -1);
  }
  within(`${name}: east's share over a week`, we / (we + ww), 0.42, 0.58);
}

/* The rush hour has a direction, and that is the D factor in the HPMS
   return doing its job. Amarillo runs 57% eastbound at eight in the
   morning and 39% at five in the evening — the same people going home.
   A model where the two carriageways are mirror images has thrown that
   away, so this asserts the asymmetry rather than tolerating it. */
const amE = (h) => {
  const e = T.demand(AT.Amarillo, { dow: 4, hour: h, month: 6 }, +1);
  const w = T.demand(AT.Amarillo, { dow: 4, hour: h, month: 6 }, -1);
  return e / (e + w);
};
within("Amarillo, 08:00, eastbound share", amE(8), 0.53, 0.62);
within("Amarillo, 17:00, eastbound share", amE(17), 0.36, 0.46);
ok("the peak swings direction between them", amE(8) - amE(17) > 0.1, true);

/* ── 4. the road at its two extremes ─────────────────────────────────
   Knoxville on a Friday evening is at capacity and the Mojave before
   dawn on a Sunday is nearly empty, and those are 2,000 miles apart on
   the same road. If the model cannot produce both, it is not this road. */
head("Both ends of what this corridor has to feel like");
const knoxPeak = T.demand(AT.Knoxville, FRI17, +1) / T.lanes(AT.Knoxville);
within("Knoxville, Fri 17:00, veh/h/lane", knoxPeak, 1500, 2400);
ok("...which is capacity, so the road is full", knoxPeak > 1500, true);

const mojNight = T.demand(AT.Mojave, SUN03, +1);
within("Mojave, Sun 03:00, veh/h/dir", mojNight, 100, 300);
within("...seconds between vehicles", 3600 / mojNight, 12, 36);
ok("Knoxville carries this many times the Mojave",
   Math.round(T.demand(AT.Knoxville, FRI17, +1) / mojNight) > 30, true);

/* Nothing anywhere may exceed the capacity of a motorway lane. About
   2,400 veh/h/lane is the physical ceiling; a model producing more is
   producing a queue it has not noticed. */
head("Nowhere on 2,551 miles exceeds a lane's capacity");
let worst = 0, worstAt = 0;
for (let px = 0; px < 22939401; px += 50000) {
  for (const w of [FRI17, { dow: 3, hour: 8, month: 6 }]) {
    const q = T.demand(px, w, +1) / T.lanes(px);
    if (q > worst) { worst = q; worstAt = px; }
  }
}
within(`busiest lane anywhere (mile ${Math.round(worstAt * 0.179 / 1609.34)})`,
       worst, 1200, 2400);

/* ── 5. what is on the road, hour by hour ────────────────────────────
   The finding this whole pull turned on: rural I-40 in the small hours
   is more than half articulated lorries, and on a Saturday afternoon it
   is one in eight. */
head("Rural I-40 at night is mostly lorries");
const m2 = T.mix(AT.Mojave, { dow: 1, hour: 2, month: 6 });
const m16 = T.mix(AT.Mojave, { dow: 5, hour: 15, month: 6 });
const sum = (m) => T.KINDS.reduce((a, k) => a + m[k], 0);
ok("shares sum to one, 02:00", sum(m2), 1, 1e-9);
ok("shares sum to one, Sat 15:00", sum(m16), 1, 1e-9);
ok("Mojave 02:00 is majority lorry", m2.artic + m2.rigid > 0.5, true);
within("Mojave 02:00, artic share", m2.artic, 0.55, 0.85);
within("Mojave Sat 15:00, artic share", m16.artic, 0.10, 0.25);
within("the swing between them", m2.artic / m16.artic, 3.0, 6.0);

/* Drawn vehicles must reproduce the counted mix. 40,000 draws off a
   seeded generator, so this is repeatable. */
const rng = T.seeded(20260809);
let got = { moto: 0, car: 0, rigid: 0, artic: 0 };
for (let i = 0; i < 40000; i++) got[T.drawKind(AT.Mojave, { dow: 1, hour: 2, month: 6 }, rng)]++;
ok("40,000 drawn vehicles reproduce the artic share",
   got.artic / 40000, m2.artic, 0.01);
ok("...and the motorcycle share", got.moto / 40000, m2.moto, 0.004);

/* ── 5b. motorcycles, which run the other way ────────────────────────
   Relatively commoner in the small hours — 1.17% of traffic against
   0.78% mid-afternoon — and absolutely much rarer, because everything
   else falls away faster than they do. Both halves matter: the first is
   why you see one at 3am, the second is why you do not see four. */
head("Motorcycles: a bigger share of a much emptier road");
const night = { dow: 2, hour: 3, month: 6 }, aft = { dow: 2, hour: 16, month: 6 };
const mN = T.mix(AT.Mojave, night), mA = T.mix(AT.Mojave, aft);
within("share at 03:00", mN.moto * 100, 1.0, 1.4);
within("share at 16:00", mA.moto * 100, 0.7, 0.95);
ok("a bigger share at night", mN.moto > mA.moto, true);
const perHour = (m, w) => m.moto * T.demand(AT.Mojave, w, +1);
ok("but fewer of them per hour at night",
   perHour(mN, night) < perHour(mA, aft), true);
within("motorcycles per hour, Mojave 03:00", perHour(mN, night), 0.5, 4);

/* ── 6. the sign, and the one place it differs by vehicle ────────────── */
head("California posts lorries 15 mph slower, and nowhere else does");
ok("Mojave, car", T.limitFor("car", AT.Mojave, "CA"), 70);
ok("Mojave, artic", T.limitFor("artic", AT.Mojave, "CA"), 55);
ok("Mojave, rigid", T.limitFor("rigid", AT.Mojave, "CA"), 55);
ok("Amarillo, car and artic agree",
   T.limitFor("car", AT.Amarillo, "TX") === T.limitFor("artic", AT.Amarillo, "TX"), true);
ok("Knoxville, car and artic agree",
   T.limitFor("car", AT.Knoxville, "TN") === T.limitFor("artic", AT.Knoxville, "TN"), true);
/* Never above the posted limit, anywhere, for anybody. */
let above = 0;
for (let px = 0; px < 22939401; px += 100000) {
  const posted = T.profile("speed", px);
  for (const st of ["CA", "AZ", "NM", "TX", "OK", "AR", "TN", "NC"])
    for (const k of T.KINDS) if (T.limitFor(k, px, st) > posted) above++;
}
ok("a lorry limit above the posted limit, anywhere", above, 0);

/* Every posted value on the corridor is one a state actually posts.
   This is what `reconcile()` in emit.py was written for. */
const vals = [...new Set(T.data.speed.map((r) => r[1]))].sort((a, b) => a - b);
ok("posted values are all multiples of five in 50–75",
   vals.every((v) => v % 5 === 0 && v >= 50 && v <= 75), true);

/* ── 7. the limit is a floor ─────────────────────────────────────────
   Measured on I-40 itself, 5.3 million vehicles: the median driver runs
   +3 over a posted 70 and the 85th percentile +12. */
head("Nobody drives the limit");
const TN70 = 18548767.3;
const off = T.offsets(FRI17);
within("median offset from the sign, Fri 17:00", off[1], 2, 5);
within("85th percentile offset", off[2], 10, 15);
ok("the 15th percentile is under the limit", off[0] < 0, true);

const nightOff = T.offsets({ dow: 1, hour: 3 });
ok("night is SLOWER than afternoon, not faster", nightOff[1] < off[1], true);

/* Draw a population and check the percentiles come back out. */
function speeds(kind, px, when, st, n) {
  const r = T.seeded(7), out = [];
  for (let i = 0; i < n; i++) out.push(T.desiredSpeed(kind, px, when, st, r(), r()) * MPH);
  return out.sort((a, b) => a - b);
}
const cars = speeds("car", TN70, FRI17, "TN", 20000);
const posted = T.profile("speed", TN70);
within("drawn cars, median mph over the sign", cars[10000] - posted, 2, 5);
within("drawn cars, 85th over the sign", cars[17000] - posted, 10, 15);
const lorries = speeds("artic", TN70, FRI17, "TN", 20000);
ok("lorries run 5 mph slower than cars", cars[10000] - lorries[10000], 5, 0.6);

/* And the Mojave, where the sign itself is different. */
const mojCars = speeds("car", AT.Mojave, FRI17, "CA", 20000);
const mojArtic = speeds("artic", AT.Mojave, FRI17, "CA", 20000);
within("Mojave cars, median mph", mojCars[10000], 70, 78);
within("Mojave lorries, median mph", mojArtic[10000], 50, 58);
within("...the differential you can see out of the window",
       mojCars[10000] - mojArtic[10000], 15, 24);

/* ── 7b. the tail the counters cannot see ────────────────────────────
   TDOT's top speed bin is `85+` and it is open, so above about the 95th
   percentile the shape is unmeasured. What IS measured is how many are
   up there — 5.0% of night traffic over 85 in a posted 70 against 10.0%
   mid-afternoon — and the model has to reproduce that while also putting
   somebody genuinely quick on the road now and then.

   The share over 85 is a MEASURED check. Everything above it is a
   DECIDED one, and these assertions exist to pin the decision so it
   cannot drift silently, not because 1-in-1,000-over-100 was counted. */
head("Somebody is always going far too fast");
const P70 = 18548767.3;
const shareOver = (arr, v) => arr.filter((x) => x > v).length / arr.length;
const dayCars = speeds("car", P70, { dow: 2, hour: 16, month: 6 }, "TN", 200000);
const nightCars = speeds("car", P70, { dow: 2, hour: 3, month: 6 }, "TN", 200000);
const nightMoto = speeds("moto", P70, { dow: 2, hour: 3, month: 6 }, "TN", 200000);
const nightArtic = speeds("artic", P70, { dow: 2, hour: 3, month: 6 }, "TN", 200000);

/* Posted 65 at this pixel, not 70, so the measured 5%/10% over 85 is
   not the comparison — the shape is. Fewer fast vehicles at night, in
   share, which is what the counters say and the opposite of folklore. */
ok("fewer over 85 at night than in the afternoon",
   shareOver(nightCars, 85) < shareOver(dayCars, 85), true);
within("cars over 100 mph, per thousand", shareOver(nightCars, 100) * 1000, 0.1, 3);
within("cars over 110 mph, per ten thousand", shareOver(nightCars, 110) * 10000, 0.05, 3);
ok("the fastest car in 200,000 is genuinely fast",
   nightCars[199999] > 105, true);

/* Motorcycles carry the fattest tail in the model. Decided, and the
   reason it is decided is in the docstring. */
ok("motorcycles run a fatter tail than cars",
   shareOver(nightMoto, 110) > shareOver(nightCars, 110) * 3, true);
ok("...and the quickest of them is quicker still",
   nightMoto[199999] > nightCars[199999] + 15, true);
/* But they are not a different animal in the ordinary part of it. */
ok("median motorcycle is an ordinary road speed",
   Math.abs(nightMoto[100000] - nightCars[100000]) < 1, true);

/* Lorries go the other way entirely: governed, so the tail is cut off
   rather than fat. */
ok("no articulated lorry is doing 90", shareOver(nightArtic, 90), 0);
within("the quarter with no limiter show at the top", nightArtic[199999], 75, 90);
const govPop = [];
{ const r = T.seeded(5150);
  for (let i = 0; i < 20000; i++) govPop.push(T.driver("artic", P70, FRI17, "TN", r)); }
ok("lorries carrying a limiter",
   govPop.filter((d) => d.governed).length / govPop.length, 0.75, 0.02);

/* ── 8. who is driving ───────────────────────────────────────────────── */
head("The drivers");
const r2 = T.seeded(99);
const pop = [];
for (let i = 0; i < 40000; i++) pop.push(T.driver("car", TN70, FRI17, "TN", r2));
const share = (f) => pop.filter(f).length / pop.length;
ok("changing lane with no indicator at all", share((d) => d.signal === "none"), 0.48, 0.01);
ok("signalling late", share((d) => d.signal === "late"), 0.26, 0.01);
ok("signalling properly", share((d) => d.signal === "proper"), 0.26, 0.01);
ok("drivers who will give way at all", share((d) => d.polite), 0.55, 0.02);

const hw = pop.map((d) => d.headway).sort((a, b) => a - b);
ok("median following headway, seconds", hw[20000], 1.50, 0.05);
ok("15th percentile — a seventh are inside 0.71 s", hw[6000], 0.71, 0.05);
within("85th percentile", hw[34000], 3.2, 3.9);

const lorryPop = [];
for (let i = 0; i < 20000; i++) lorryPop.push(T.driver("artic", TN70, FRI17, "TN", r2));
const disc = (p) => p.reduce((a, d) => a + d.discipline, 0) / p.length;
ok("lorries keep right harder than cars", disc(lorryPop) > disc(pop) + 0.2, true);

/* Drawn once and kept: the same seed must give the same driver, or the
   road is not readable and no amount of tuning will make it so. */
const a1 = T.driver("car", TN70, FRI17, "TN", T.seeded(4242));
const a2 = T.driver("car", TN70, FRI17, "TN", T.seeded(4242));
ok("the same seed gives the same driver",
   JSON.stringify(a1) === JSON.stringify(a2), true);

/* ── done ────────────────────────────────────────────────────────────── */
console.log(`\n${pass} passed, ${fail} failed`);
console.log("─".repeat(30));
process.exit(fail ? 1 : 0);
