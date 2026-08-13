/* ══════════════════════════════════════════════════════════════════════
   The score, driven headless.

   `node test/score.test.js` from projects/offramp.

   score.js is pure — it is told the time, the density and the speed and
   never looks any of them up — so every claim the design makes can be
   checked here rather than by playing. Two of the sections below are
   Ric's own words turned into assertions, and they are labelled as such,
   because those are the ones that must not quietly drift:

     §4  "if you wreck before the 40th exit you get the rewards for the
          first 30"
     §2  "the more difficult and dangerous you make it the more points
          you get"
   ══════════════════════════════════════════════════════════════════════ */

const Score = require("../src/score.js");
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

const DT = 1 / 60;
/* Drive for `secs` at a speed and density, one real frame at a time. */
function drive(secs, kmh, dens) {
  for (let i = 0; i < Math.round(secs / DT); i++) Score.frame(DT, kmh, dens);
}

/* ══════════════════════════════════════════════════════════════════════
   §1  the three multipliers, each on its own
   ══════════════════════════════════════════════════════════════════════ */
head("§1  the multipliers");

ok("an empty road multiplies by one", Score.trafficMult(0), 1);
within("the standing harness's 17.6 veh/km/lane", Score.trafficMult(17.6), 1.8, 2.0);
ok("heavy traffic reaches the ceiling", Score.trafficMult(40), 3.0, 1e-9);
ok("...and nothing past it goes higher", Score.trafficMult(200), 3.0, 1e-9);

ok("three in the morning is night", Score.nightMult(3), 1.25, 1e-9);
ok("midnight is night", Score.nightMult(0), 1.25, 1e-9);
ok("nine in the morning is not", Score.nightMult(9), 1);
ok("five in the afternoon is not", Score.nightMult(17), 1);
within("dusk is half of it", Score.nightMult(20), 1.1, 1.15);
ok("the hour wraps rather than throwing", Score.nightMult(26), Score.nightMult(2), 1e-9);

/* ══════════════════════════════════════════════════════════════════════
   §2  RIC'S RULE — more dangerous is more points

   The whole design in one assertion. Same car, same distance, same
   everything except how frightening it was.
   ══════════════════════════════════════════════════════════════════════ */
head("§2  the more dangerous, the more points  (Ric's rule)");

const jetta = Garage.get("jetta");

/* A Sunday-morning cruise: empty road, mid-morning, well off the pace. */
Score.begin({ car: jetta, hour: 10 });
drive(120, 90, 1);
const cruise = Score.read();

/* And the same two minutes at five to eleven at night, in heavy
   traffic, held above the car's own threshold the whole way. */
Score.begin({ car: jetta, hour: 23 });
drive(120, jetta.vTop * 0.95, 38);
const hairy = Score.read();

console.log(`       cruise  ${cruise.carried.toFixed(0).padStart(7)} pts over ${cruise.km.toFixed(1)} km  ×${cruise.mult.toFixed(2)}`);
console.log(`       hairy   ${hairy.carried.toFixed(0).padStart(7)} pts over ${hairy.km.toFixed(1)} km  ×${hairy.mult.toFixed(2)}`);
console.log(`       traffic ×${hairy.parts.traffic.toFixed(2)}  night ×${hairy.parts.night.toFixed(2)}  pace ×${hairy.parts.pace.toFixed(2)}`);

ok("the dangerous run pays more per kilometre",
   (hairy.carried / hairy.km) > (cruise.carried / cruise.km), true);
within("the INSTANTANEOUS ceiling is about fifteen", hairy.mult, 13, 16);
/* Realised is lower than the ceiling and always will be, because the
   pace term spends its first ninety seconds climbing. Over a two-minute
   run that is most of the run, so about ten is the honest figure for
   what a dangerous drive actually pays — the ×15 is the top of the
   needle, not the average of it. Worth asserting separately so that
   nobody later "fixes" the gap between them. */
within("...but a two-minute run realises about ten",
   (hairy.carried / hairy.km) / (cruise.carried / cruise.km), 8, 12);

/* ══════════════════════════════════════════════════════════════════════
   §3  pace is time held, and the threshold is the CAR's

   The single most important property in the file: an absolute speed bar
   would make every car below the Corvette pointless.
   ══════════════════════════════════════════════════════════════════════ */
head("§3  pace");

Score.begin({ car: jetta, hour: 12 });
drive(1.5, jetta.vTop * 0.95, 0);
within("a second and a half at speed is worth almost nothing",
       Score.read().parts.pace, 1.0, 1.1);
drive(88.5, jetta.vTop * 0.95, 0);
ok("a minute and a half of it reaches the ceiling",
   Score.read().parts.pace, Score.PACE_MAX, 0.02);
drive(2, 40, 0);
within("lifting off for two seconds costs some of it, not all",
       Score.read().parts.pace, 1.5, 3.5);
drive(8, 40, 0);
ok("coming off the boil properly costs the lot",
   Score.read().parts.pace, 1, 0.01);

/* The same road speed, in two different cars. 100 mph is 83% of the
   Jetta and 49% of the built 911. */
head("§3a  ...and the SAME SPEED is not the same effort");

const p911 = Garage.get("911");
const hundred = 100 * 1.609344;

Score.begin({ car: jetta, hour: 12 });
drive(90, hundred, 0);
const jettaPace = Score.read().parts.pace;

Score.begin({ car: p911, hour: 12 });
drive(90, hundred, 0);
const p911Pace = Score.read().parts.pace;

console.log(`       100 mph is ${(hundred / jetta.vTop * 100).toFixed(0)}% of the Jetta and ${(hundred / p911.vTop * 100).toFixed(0)}% of the 911`);
ok("100 mph in the Jetta earns the full pace multiplier", jettaPace, Score.PACE_MAX, 0.02);
ok("...and in the 911 it earns nothing at all", p911Pace, 1, 0.01);
ok("so the slow car is not a strictly worse choice", jettaPace > p911Pace, true);

/* And the 911 has to work for it in absolute terms. */
Score.begin({ car: p911, hour: 12 });
drive(90, p911.vTop * 0.95, 0);
ok("the 911 earns it too — at 195 mph rather than 100",
   Score.read().parts.pace, Score.PACE_MAX, 0.02);

/* ══════════════════════════════════════════════════════════════════════
   §4  RIC'S RULE — checkpoints every ten exits

   "if you wreck before the 40th exit you get the rewards for the first
   30." Driven literally: earn a steady amount between exits, take 39 of
   them, wreck, and check the books.
   ══════════════════════════════════════════════════════════════════════ */
head("§4  the checkpoint, and what a wreck costs  (Ric's rule)");

Score.begin({ car: jetta, hour: 12 });
let checkpoints = 0;
for (let n = 1; n <= 39; n++) {
  drive(10, 120, 10);                       // a stretch of road between exits
  const r = Score.exit("exit");
  if (r.checkpoint) checkpoints++;
}
const before = Score.read();
const over = Score.end("wreck");

console.log(`       39 exits · ${checkpoints} checkpoints · banked ${over.banked.toFixed(0)} · lost ${over.lost.toFixed(0)}`);
console.log(`       what each checkpoint paid: ${before.history.map((h) => h.amount.toFixed(0)).join(", ")}`);

ok("three checkpoints passed in thirty-nine exits", checkpoints, 3);
ok("...at the tenth, twentieth and thirtieth",
   before.history.map((h) => h.atExit).join(","), "10,20,30");
ok("the pot is banked and kept", over.banked > 0, true);
ok("...and the nine exits since the last checkpoint are lost", over.lost > 0, true);

/* The decisive one: what was banked is exactly the first thirty exits'
   worth, and nothing from the nine that followed. */
const thirty = before.history.reduce((a, h) => a + h.amount, 0);
ok("banked is precisely the first thirty exits, to the point", over.banked, thirty, 1e-9);
ok("nothing is carried once the run is over", Score.read().carried, 0);

head("§4a  and a checkpoint reached is safe from then on");

Score.begin({ car: jetta, hour: 12 });
for (let n = 1; n <= 10; n++) { drive(10, 120, 10); Score.exit("exit"); }
const atTen = Score.read().banked;
drive(600, 200, 30);                        // ten more minutes of good earning
const wrecked = Score.end("wreck");
ok("the ten-exit bank survives a wreck ten minutes later", wrecked.banked, atTen, 1e-9);
ok("...and everything earned since is gone", wrecked.lost > 0, true);

/* ══════════════════════════════════════════════════════════════════════
   §5  exits are weighted by what you had to do
   ══════════════════════════════════════════════════════════════════════ */
head("§5  what an exit is worth");

function exitOnly(kind) {
  Score.begin({ car: jetta, hour: 12 });
  Score.frame(DT, 0, 0);                    // establish a ×1 multiplier
  Score.exit(kind);
  return Score.read().carried;
}
const rest = exitOnly("rest"), plain = exitOnly("exit"), loop = exitOnly("loop");
console.log(`       rest area ${rest.toFixed(0)} · diamond ${plain.toFixed(0)} · cloverleaf ${loop.toFixed(0)}`);
ok("a rest area is worth least", rest < plain, true);
ok("a cloverleaf is worth most", loop > plain, true);
ok("an unrecognised junction still scores as an ordinary one",
   exitOnly("something-new-in-the-world-data"),
   Score.EXIT_BASE * Score.DEFAULT_WEIGHT, 1e-9);
ok("...rather than scoring zero", exitOnly("something-new") > 0, true);

/* ══════════════════════════════════════════════════════════════════════
   §6  the arithmetic does not drift
   ══════════════════════════════════════════════════════════════════════ */
head("§6  book-keeping");

Score.begin({ car: jetta, hour: 12 });
drive(60, 100, 0);
const r6 = Score.read();
ok("a minute at 100 km/h covers 1.667 km", r6.km, 100 / 60, 1e-6);
ok("...and at ×1 pays 100 a kilometre", r6.carried, r6.km * Score.PER_KM, 1e-6);

Score.begin({ car: jetta, hour: 12 });
ok("a fresh run starts with nothing carried", Score.read().carried, 0);
ok("...and nothing banked", Score.read().banked, 0);
ok("...and no exits", Score.read().exits, 0);
ok("a zero-length frame changes nothing", Score.frame(0, 300, 40), 0);
ok("...and so does a negative one", Score.frame(-1, 300, 40), 0);
ok("reversing still earns, because distance is distance",
   (() => { Score.begin({ car: jetta, hour: 12 }); Score.frame(1, -50, 0);
            return Score.read().carried > 0; })(), true);

/* ══════════════════════════════════════════════════════════════════════ */
console.log(`\n${pass} passed, ${fail} failed`);
console.log("─".repeat(30));
process.exit(fail ? 1 : 0);
