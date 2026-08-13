/* ══════════════════════════════════════════════════════════════════════
   The traffic, put on the real road.

   `node test/cars.test.js` from projects/offramp.

   `sim.test.js` and `motive.test.js` judge how the traffic BEHAVES, and
   they do it headless because that is the only way to judge it. This
   file judges something else entirely and much smaller: whether the
   vehicles those files produce end up in the right PLACE once the
   corridor's geometry is applied to them.

   That is a question about a map, so it is asked the way this project
   asks every question about a map — numerically, over every junction in
   a window, never by looking at the viewport. The three things that can
   go wrong are all measurable:

     · a vehicle drawn off the sealed surface
     · a vehicle drawn in a lane the road does not have here
     · the traffic jumping when the twenty-mile window is rebuilt

   The third is the one worth having a test for. Corridor pixels are the
   only coordinate that survives a rebuild, and if this file ever starts
   converting sim-s to road-s directly it will pass every other check and
   fail this one.
   ══════════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..");
const files = ["data/i40.js", "data/traffic.js", "src/road.js", "src/world.js",
               "src/impact.js", "src/traffic.js", "src/sim.js", "src/motive.js",
               "src/cars.js"];
const src = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n;\n")
  + "\n;globalThis.__x = { I40, Road, World, Traffic, Sim, Motive, Cars };\n";
/* `data/traffic.js` publishes onto `window`, which is how the browser
   gets it; the vm needs one to hang it off. Everything else is a plain
   top-level `const`, which is why they all go into ONE context — that
   is precisely what index.html does, so loading them any other way
   would be testing a different program. */
const ctx = vm.createContext({ console, Math, JSON, Date, Number, Array, Object,
                              String, Boolean, Map, Set, Float64Array, Infinity,
                              isFinite, isNaN, parseInt, parseFloat, window: {} });
vm.runInContext(src, ctx, { filename: "offramp-sources" });
const { Road: R, World, Cars, Traffic: TR } = ctx.__x;

let pass = 0, fail = 0;
const fmt = (n) => typeof n === "number"
  ? (Number.isInteger(n) ? String(n) : n.toFixed(3)) : String(n);
function ok(name, got, want, tol) {
  const good = tol === undefined ? got === want : Math.abs(got - want) <= tol;
  if (good) { pass++; console.log(`  ok   ${name}  = ${fmt(got)}`); }
  else { fail++; console.log(`  FAIL ${name}  = ${fmt(got)}   want ${fmt(want)}${tol !== undefined ? ` ±${tol}` : ""}`); }
}
const head = (s) => console.log(`\n${s}\n${"─".repeat(s.length)}`);

/* The reference stretch the traffic suite uses: mile 1897, Tennessee,
   four lanes each way and a constant posted 70. */
const PX = 17037426 + 3000 / 0.179;
const WHEN = { dow: 2, hour: 14, month: 6 };
const M_PER_PX = 0.179;

console.log("building a window and a band of traffic on it…");
World.setStart(PX);
let road = World.buildWindow(PX);

ok("the window is the corridor", !!road.corridor, true);
Cars.start(PX, true, WHEN, "TN", 11);
ok("both carriageways are populated", Cars.running(), true);

/* ── drive it ─────────────────────────────────────────────────────────
   Twelve hundred metres of corridor at 130 km/h, which is enough to
   cross several interchanges on a road whose median junction spacing is
   1,420 m. Every frame, every visible vehicle is audited. */
head("Is everybody on the road?");

const V = 36;                                     // m/s, about 130 km/h
let px = PX;
let offSurface = 0, offLane = 0, seen = 0, frames = 0;
let worstIn = Infinity;                           // px inside the sealed edge

function audit() {
  const list = Cars.visible(road, true, 1200);
  for (const c of list) {
    seen++;
    /* Independently of how it was placed: where is this point on the
       road, and is that inside the pavement? */
    const pr = R.project(road, c.x, c.y, null);
    if (!pr) { offSurface++; continue; }
    const e = R.edges(road, pr.s);
    const inside = Math.min(pr.u - e.uL, e.uR - pr.u);
    if (inside < 0) offSurface++;
    else if (inside < worstIn) worstIn = inside;
    /* And is it in a lane rather than on a shoulder? Half a lane either
       side of a lane centre is the whole of the lane. */
    const fwd = c.mine;
    const n = R.laneCount(road, pr.s, fwd);
    let best = Infinity;
    for (let L = 0; L < n; L++)
      best = Math.min(best, Math.abs(pr.u - R.laneU(road, pr.s, L, fwd)));
    if (best > R.LANE * 0.55) offLane++;
  }
  frames++;
}

for (let k = 0; k < 400; k++) {
  Cars.update(1 / 60, px, V);
  px += V / M_PER_PX * (1 / 60);
  if (k % 4 === 0) audit();
}

console.log(`       ${seen} vehicle-frames audited over ${frames} frames`);
ok("nobody is drawn off the sealed surface", offSurface, 0);
ok("everybody is in a lane, not on a shoulder", offLane, 0);
console.log(`       closest anybody came to the edge of the pavement:`
          + ` ${worstIn.toFixed(1)} px`);
ok("...and there were vehicles to audit at all", seen > 2000, true);

/* ── the gap you can see is the gap the model chose ───────────────────
   The one number a player reads off this screen constantly is how much
   room there is between two vehicles, and it is the number that says
   whether the traffic is aware of itself. It has to be the model's.

   `s` in sim.js is the FRONT BUMPER — `neigh` returns
   `lead.s - lead.len - s` and `contact` takes `s - len/2` for the middle
   — and a sprite is drawn about its centre. Handing `s` straight to the
   renderer put every vehicle half a body-length too far forward, which
   cancels between two equal cars and does not cancel otherwise: the
   drawn gap came out wrong by exactly (lenLead − lenMe)/2, so an
   articulated lorry behind a car appeared seven and a half metres closer
   than it was, nose inside the car in front. Reported from play as the
   cars touching each other; the model was clean throughout. */
head("The gap you can see is the gap the model chose");

{
  const w = Cars.worlds().mine;
  const shown = Cars.visible(road, true, 1200, 0);
  /* MY carriageway only. The two worlds number their vehicles
     independently, so a map keyed on id alone lets an oncoming vehicle
     stand in for one of mine — which is how the first run of this check
     reported a 394 m disagreement between two cars that were never a
     pair. */
  const byId = new Map(shown.filter((c) => c.mine).map((c) => [c.id, c]));
  const lanes = new Map();
  for (const v of w.live) {
    if (v.piloted || v.wreck) continue;
    const L = Math.round(v.lane);
    if (!lanes.has(L)) lanes.set(L, []);
    lanes.get(L).push(v);
  }
  let pairs = 0, worst = 0, overlapping = 0;
  for (const arr of lanes.values()) {
    arr.sort((a, b) => a.s - b.s);
    for (let i = 1; i < arr.length; i++) {
      const me = arr[i - 1], lead = arr[i];
      const ca = byId.get(me.id), cb = byId.get(lead.id);
      if (!ca || !cb) continue;
      const modelGap = lead.s - lead.len - me.s;      // metres, bumper to bumper
      if (modelGap < 0 || modelGap > 150) continue;
      /* ALONG the road, not across the map. The first version of this
         took the straight-line distance between the two drawn points,
         which on a curve is the chord and not the arc — it reported a
         243 m disagreement on a road where the worst real one is
         centimetres. Both are projected back onto the corridor and
         compared in `s`, which is the axis a gap is measured on. */
      const pa = R.project(road, ca.x, ca.y, null);
      const pb = R.project(road, cb.x, cb.y, null);
      if (!pa || !pb) continue;
      const centres = (pb.s - pa.s) * M_PER_PX;
      const drawnGap = centres - (ca.len + cb.len) / 2;
      pairs++;
      worst = Math.max(worst, Math.abs(drawnGap - modelGap));
      if (drawnGap < 0) overlapping++;
    }
  }
  console.log(`       ${pairs} leader-follower pairs, worst disagreement`
            + ` ${worst.toFixed(2)} m`);
  /* A metre, because that is what this instrument can resolve rather
     than what the code achieves: `project` snaps onto a centreline
     sampled every 8 px, which is 1.43 m, so a sub-station residual is
     the measurement and not the placement. What it has to catch is the
     half-length artefact, and that was ±7.7 m and scaled with the
     difference in the two vehicles' lengths — nothing like this. */
  ok("every drawn gap is the model's own, to inside a metre",
     pairs > 10 && worst < 1, true);
  ok("...so nothing is drawn overlapping anything", overlapping, 0);
}

/* ── both carriageways ────────────────────────────────────────────── */
head("Two carriageways, pointing opposite ways");

const list = Cars.visible(road, true, 1200);
const mineN = list.filter((c) => c.mine).length;
const theirsN = list.length - mineN;
ok("traffic on my side", mineN > 0, true);
ok("...and traffic coming the other way", theirsN > 0, true);

/* The oncoming carriageway is on the negative-u side of the centreline
   and faces the other way. Both are load-bearing sign conventions and
   both have been got wrong in this project before. */
let wrongSide = 0, wrongWay = 0;
for (const c of list) {
  const pr = R.project(road, c.x, c.y, null);
  if (!pr) continue;
  if (c.mine ? pr.u < 0 : pr.u > 0) wrongSide++;
  const along = Math.cos(c.h - pr.h);             // +1 with the road, −1 against
  if (c.mine ? along < 0.5 : along > -0.5) wrongWay++;
}
ok("my carriageway is the positive-u one and theirs is not", wrongSide, 0);
ok("and the oncoming traffic faces the other way", wrongWay, 0);

/* ── the rebuild ──────────────────────────────────────────────────── */
head("A window rebuild must not move the traffic");

/* Take a picture, rebuild the window under it, take another. Nothing
   about the traffic has changed — only which twenty miles of corridor
   the road object happens to hold — so every vehicle must come back at
   the same world position. */
const before = Cars.visible(road, true, 1200)
  .map((c) => ({ id: c.id, x: c.x, y: c.y, mine: c.mine }));
const baseWas = road.baseS;
road = World.buildWindow(px);
ok("the window really was rebuilt", road.baseS !== baseWas, true);

const after = new Map();
for (const c of Cars.visible(road, true, 1200)) after.set(c.id + (c.mine ? "m" : "t"), c);
let moved = 0, matched = 0, worst = 0;
for (const b of before) {
  const a = after.get(b.id + (b.mine ? "m" : "t"));
  if (!a) continue;
  matched++;
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  if (d > worst) worst = d;
  if (d > 0.5) moved++;
}
ok("the same vehicles are still there", matched > 20, true);
ok("and not one of them moved", moved, 0);
console.log(`       ${matched} vehicles compared across the rebuild,`
          + ` worst displacement ${worst.toFixed(3)} px`);

/* ── the indicator ────────────────────────────────────────────────── */
head("The blinker, which is the one measured thing you can see");

let changing = 0, lit = 0;
for (let k = 0; k < 3000; k++) {
  Cars.update(1 / 60, px, V);
  px += V / M_PER_PX * (1 / 60);
  if (k % 10) continue;
  for (const c of Cars.visible(road, true, 1200)) {
    const w = Cars.worlds();
    const v = (c.mine ? w.mine : w.theirs).live.find((z) => z.id === c.id);
    if (!v || !(v.phase > 0)) continue;
    changing++;
    if (c.blink !== 0) lit++;
  }
}
const share = changing ? lit / changing : 0;
console.log(`       ${lit} of ${changing} vehicle-frames mid-manoeuvre showed a lamp`);
/* Half of all changes are unsignalled and half of the rest light late,
   so across a manoeuvre the lamp is lit for something under half of it.
   The check is that it is neither always nor never — the two ways this
   could be wired up wrong. */
ok("some drivers indicate and some do not", share > 0.15 && share < 0.55, true);

/* ── the player, as one more vehicle ──────────────────────────────── */
head("The player is a body, not an exception");

const { Sim, Motive } = ctx.__x;
function road6(seed, opts) {
  return Sim.world(Object.assign({
    px: PX, when: WHEN, state: "TN", dir: 1, seed, q: 1585, lanes: 4,
    decide: Motive.decide, exitShare: 0,
    roam: { back: 900, ahead: 1500, at: 0 },
  }, opts || {}));
}

/* Park a car in lane 4 and hold it there, slower than the traffic. The
   claim is not that anything specific happens — it is that the road
   NOTICES, which is the whole difference between a body in the index
   and a sprite drawn over it. */
const w1 = road6(11);
let passedMe = 0, everBehind = 0;
for (let k = 0; k < 3000; k++) {
  w1.pilot({ s: 20 * k * 0.1, lane: 4, v: 20, len: 4.7, w: 1.9, m: 1500 });
  w1.follow(20 * k * 0.1, 20);
  w1.step();
  const me = w1.live.find((v) => v.piloted);
  if (!me) continue;
  for (const v of w1.live) {
    if (v.piloted || v.wreck) continue;
    if (Math.abs(v.s - me.s) < 60 && Math.round(v.lane) === 4) everBehind++;
  }
}
ok("the player is in the traffic's index at all", everBehind > 0, true);

/* Does anybody actually respond? Stand still in lane 2 and look at what
   assembles behind: a queue, in the lane the car is in and not in the
   one beside it. Nothing in motive.js or sim.js mentions the player —
   this is ordinary car-following reading an ordinary obstruction, which
   is exactly the claim.

   The first version of this test asked whether a SLOW car emptied its
   lane, averaged over 400 m either side, and it could not see anything:
   most of that traffic is ahead of the player and will never meet them,
   and the ones that do are a handful. The queue is the sharp
   measurement.

   ── the lane NEXT DOOR is not a control, and this was a coin flip ───
   The second version took the queue against lane 3 in a single seeded
   run. Measured over 40 seeds it reports lane 2 as the slower one 23
   times and the faster one 17 — a fifty-fifty that had been passing
   because seed 23 landed on the right side of it. Both length tables
   score the same, so it was never measuring the model.

   It fails for a reason worth keeping, because the reason is the model
   being right. **Lane 3 is not undisturbed** — the traffic that can no
   longer use lane 2 is in it, and at 1,585 veh/h/lane that is enough to
   put lane 3 into stop-and-go too. Pooled over forty seeds lane 3 runs
   8.6 m/s against a free road's 25. Asking it to be a clean control is
   asking the blockage not to have the one effect a blockage has.

   ── the control is the SAME LANE, on the other side of the car ──────
   A stationary obstruction acts upstream and only upstream: it backs
   traffic up behind it and it starves the road in front of it. That is
   the whole claim, it needs no second lane, and it is not a coin flip —
   pooled over eight seeds the ratio is 0.07 to 0.12 against a bar of
   0.6, and it comes out there on four different seed families and on
   both the old vehicle lengths and the real ones. The starved side is
   the tell a scripted "get out of the player's way" could not fake:
   nothing gets past, so there are 200 vehicles behind and 30 ahead. */
const SEEDS = [23, 11, 17, 29, 31, 37, 41, 43];
const runs = SEEDS.map((seed) => {
  const w = road6(seed);
  for (let k = 0; k < 600; k++) {
    w.pilot({ s: 400, lane: 2, v: 0, len: 4.7, w: 1.9, m: 1500 });
    w.follow(400, 0);
    w.step();
    w.drainHits();
  }
  return w;
});
const w3 = runs[0];                         // seed 23, the worked example
const meanV = (a) => (a.length ? a.reduce((x, y) => x + y.v, 0) / a.length : 0);
/* Pooled across seeds by VEHICLE, not averaged per seed: a run that
   starved its road ahead down to two vehicles should not weigh the same
   as one with a dozen. */
const band = (ln, lo, hi) => runs.reduce((a, w) => a.concat(w.live.filter((v) =>
  !v.piloted && !v.wreck && Math.round(v.lane) === ln
  && (v.s - 400) >= lo && (v.s - 400) <= hi)), []);
const behind = band(2, -300, 0), ahead = band(2, 0, 600);
console.log(`       lane 2, pooled over ${SEEDS.length} seeds:`
          + ` ${behind.length} vehicles in the 300 m BEHIND doing ${meanV(behind).toFixed(1)} m/s,`
          + ` ${ahead.length} in the 600 m AHEAD doing ${meanV(ahead).toFixed(1)}`
          + `  —  ratio ${(meanV(behind) / meanV(ahead)).toFixed(3)}`);
ok("A CAR STOPPED IN LANE 2 STOPS LANE 2, and nothing was told it was the player",
   meanV(behind) < meanV(ahead) * 0.6, true);
/* Reported, not asserted: how far the disturbance spreads sideways. It
   is real and it is seed-dependent, which is exactly why it is not the
   control above. */
const beside = band(3, -300, 0);
console.log(`       and it spills: lane 3 behind runs ${meanV(beside).toFixed(1)} m/s`
          + ` over ${beside.length} vehicles, against a free road's 25`);

/* And what is behind is a JAM — long, and stopped at the head of it.

   Two stricter versions of this check were tried and both were wrong
   about real traffic. "Ordered slowest-first, pair by pair" fails
   because a queue is not monotonic; so does "the front third is slower
   than the back third", because by six hundred seconds the jam is 150 m
   long with a second stopped cluster travelling back up it. Stop-and-go
   waves are the thing being modelled, not noise in the way of it. What
   is true of every jam is that it is stopped at the head and that it
   reaches back a long way. */
const q = w3.live.filter((v) => !v.piloted && !v.wreck && Math.round(v.lane) === 2
  && v.s < 400 && v.s > 250).sort((a, b) => b.s - a.s);
const stopped = q.filter((v) => v.v < 5).length;
ok("...and what is behind is a jam: stopped at the head, and long",
   q.length >= 4 && q[0].v < 2 && stopped >= 4, true);
console.log(`       ${q.length} vehicles in the 150 m behind, ${stopped}`
          + ` of them under 5 m/s, nearest doing ${q[0].v.toFixed(1)}`);
console.log("       " + q.slice(0, 6).map((v) =>
  `${(400 - v.s).toFixed(0)}m:${v.v.toFixed(1)}`).join("  "));

/* And it can be hit. Stand still in the middle of a live lane, which is
   the one thing on a motorway that is certain to end badly, and check
   that the contact comes back through the queue rather than being
   applied to the player by the model. */
const w2 = road6(23);
let hits = 0, hardest = 0, myV = 0, myS = 0;
const shoves = [];
for (let k = 0; k < 1200; k++) {
  const me = w2.pilot({ s: 400, lane: 2, v: 0, len: 4.7, w: 1.9, m: 1500 });
  w2.follow(400, 0);
  w2.step();
  const h = w2.drainHits();
  if (h) {
    hits += h.length;
    for (const x of h) { hardest = Math.max(hardest, x.eff); shoves.push(x); }
  }
  if (me) { myV = me.v; myS = me.s; }
}
ok("standing still in a live lane gets you hit", hits > 0, true);
console.log(`       ${hits} contacts, hardest ${hardest.toFixed(1)} km/h effective`);
ok("...and the model never moved the player", myS, 400);
ok("...nor wrote its speed", myV, 0);

/* ── but it has to HAND BACK what it did to their speed ──────────────
   `...nor wrote its speed` above is an architecture rule — sim.js does
   not drive the player — and on its own it is only half a test. It
   passed for months while the player's half of every impulse was solved
   and then dropped on the floor, which made the car you drive an
   immovable object: measured, 229 contacts in sixty seconds at 108 km/h
   without losing one km/h, while every car hit was shoved aside. Ric
   found it from the driving seat — "i can push cars out of the way".

   So the rule has two halves and this is the other one. The model must
   not WRITE the player's velocity and it must REPORT it, and a test for
   either alone is a test that can be passed by doing nothing.

   Struck from behind while standing still, the answer has a sign that
   is worth asserting on its own: it must be POSITIVE. Being rear-ended
   pushes you up the road. If this ever comes back negative, somebody
   has confused the two frames — `theirs` counts its metres the other
   way — and the player will be braked by a shunt from behind. */
ok("every contact reports what it did to the player's own speed",
   shoves.length > 0 && shoves.every((h) => typeof h.dvAlong === "number"
                                         && isFinite(h.dvAlong)), true);
const pushed = shoves.filter((h) => h.dvAlong > 0).length;
ok("...and being rear-ended while stopped pushes you FORWARD, never back",
   pushed === shoves.length, true);
/* Physically bounded: no impulse can change your speed by more than
   twice the speed you closed at, and that ceiling is only reached
   bouncing perfectly off something infinitely heavy. A number outside
   this is a unit error or a frame error, both of which have happened. */
ok("...by an amount no impulse could exceed",
   shoves.every((h) => Math.abs(h.dvAlong) <= 2 * h.closing + 1e-6), true);
const hardestShove = shoves.reduce((a, h) => Math.max(a, Math.abs(h.dvAlong)), 0);
console.log(`       shoved forward ${pushed}/${shoves.length} times,`
          + ` hardest ${(hardestShove * 3.6).toFixed(1)} km/h of speed change`);

/* Taking the body away takes it out of the index. */
w2.pilot(null);
w2.step();
ok("putting the car away removes it from the road",
   w2.live.filter((v) => v.piloted).length, 0);

/* ── the player is crossing the road, and the model has to know ──────
   `setPlayer` used to hand over position and forward speed and nothing
   else, so `vy` sat at the 0 it was created with for the life of the
   program. Every sideswipe was then solved as though the player were
   tracking dead straight: no lateral closing speed, no lateral impulse,
   and drifting into somebody's flank cost nothing while `separate`
   moved them out of the way. Measured on a player weaving across an
   occupied lane, wiring it up took the contacts the game is told about
   from 67 to 122.

   The SIGN is the part worth pinning. `laneAt` flips with `dirFwd`, and
   the oncoming world is handed `!fwd`, so the same wheel input has to
   come out one way round in `mine` and the other in `theirs`. Get it
   backwards and a car you are steering away from is solved as one you
   are steering into. */
const lanes0 = Cars.worlds();
const uMine = 30;                       // positive-u side, going forwards
Cars.setPlayer(road, 600, uMine, true, 30, false, 12);
const meMine = Cars.worlds().mine.live.find((v) => v.piloted);
ok("the model is told how fast the player is crossing the road",
   !!meMine && Math.abs(meMine.vy) > 0, true);
ok("...in metres per second, off the road's own px/s", !!meMine
   && Math.abs(meMine.vy - 12 * M_PER_PX) < 1e-9, true);

/* Same wheel, other carriageway: negative u while still going forwards
   puts the player in `theirs`, travelling backwards through it. */
Cars.setPlayer(road, 600, -uMine, true, 30, false, 12);
const meTheirs = Cars.worlds().theirs.live.find((v) => v.piloted);
ok("...and it turns over with the carriageway, as `laneAt` does",
   !!meTheirs && Math.abs(meTheirs.vy + 12 * M_PER_PX) < 1e-9, true);
console.log(`       12 px/s of wheel reads as ${meMine.vy.toFixed(3)} m/s on my side`
          + ` and ${meTheirs.vy.toFixed(3)} on theirs`);
Cars.setPlayer(null);

/* ══════════════════════════════════════════════════════════════════════
   §7  the left shoulder is not lane 1

   *(Ric, 2026-08-12: "you also apparently cant drive on the left
   shoulder and pass someone. you will crash into the car. the hitbox or
   whatever is messed up there.")*

   He was right and it was one clamp. `laneAt` in cars.js used to return
   `max(1, min(n, ...))`, so a player out on the shoulder — whose true
   fractional lane is BELOW 1 — arrived at the sim as exactly 1.0.
   `index()` files a body into every lane its width overlaps, and a body
   at exactly 1.0 overlaps lane 1 squarely, so lane 1 read a car that was
   not on the carriageway as an obstacle in its lane and drove into it.

   Unclamped, `index()` needed no change at all: the width test resolves
   all three cases on its own. That is what this section pins.
   ══════════════════════════════════════════════════════════════════════ */
head("§7  passing on the left shoulder");

/* Hold the player at a fixed lane offset, well below the traffic's
   speed, and count how much of lane 1 ends up stuck behind. On the
   shoulder that should be nothing; half into lane 1 it should be a
   queue, because half a car in the lane IS in the lane. */
function shoulderRun(lane) {
  const w = road6(23);
  let behindCount = 0, behindV = 0, contacts = 0;
  for (let k = 0; k < 2500; k++) {
    const s = 8 * k * 0.1;                        // 8 m/s: slow, and in the way
    w.pilot({ s, lane, v: 8, len: 4.7, w: 1.9, m: 1500 });
    w.follow(s, 8);
    w.step();
    const hs = w.drainHits(); if (hs) contacts += hs.length;
    if (k < 1200) continue;                       // let it settle first
    const me = w.live.find((v) => v.piloted);
    if (!me) continue;
    for (const v of w.live) {
      if (v.piloted || v.wreck) continue;
      if (Math.round(v.lane) !== 1) continue;
      if (v.s < me.s && me.s - v.s < 300) { behindCount++; behindV += v.v; }
    }
  }
  return { mean: behindCount ? behindV / behindCount : 0, n: behindCount, contacts };
}

/* The three cases, and the boundary between the middle two is not a
   guess: `ahead()` treats a body as BESIDE rather than in front once it
   is laterally clear, and clear means centre-to-centre exceeds the two
   half-widths. For two 1.9 m bodies in a 3.7 m lane that is 0.51 of a
   lane. So 0.85 is still an obstruction and 0.4 is genuinely something
   you can be squeezed past, which is why the shoulder case below is a
   fix and this one is arithmetic. */
const onRoad   = shoulderRun(1.0);    // squarely in lane 1
const mostlyIn = shoulderRun(0.85);   // inside the 0.51-lane conflict width
const edgeOn   = shoulderRun(0.4);    // outside it — passable, by geometry
const shoulder = shoulderRun(-0.5);   // fully off the carriageway

console.log(`       lane  1.00 (in lane 1)  ${onRoad.n} behind at ${onRoad.mean.toFixed(1)} m/s, ${onRoad.contacts} contacts`);
console.log(`       lane  0.85 (overlapping)${mostlyIn.n} behind at ${mostlyIn.mean.toFixed(1)} m/s, ${mostlyIn.contacts} contacts`);
console.log(`       lane  0.40 (squeeze by) ${edgeOn.n} behind at ${edgeOn.mean.toFixed(1)} m/s, ${edgeOn.contacts} contacts`);
console.log(`       lane −0.50 (shoulder)   ${shoulder.n} behind at ${shoulder.mean.toFixed(1)} m/s, ${shoulder.contacts} contacts`);

ok("a car squarely in lane 1 stops lane 1", onRoad.mean < 12, true);
ok("...and one still inside the conflict width stops it too", mostlyIn.mean < 12, true);
ok("...while one outside it is passable, and nobody hits it", edgeOn.contacts, 0);
/* The one that was broken. Out on the shoulder the lane must run at
   something like a free road's speed rather than queueing behind a
   vehicle that is not on it. */
ok("BUT A CAR ON THE SHOULDER DOES NOT STOP LANE 1", shoulder.mean > 18, true);
ok("...and lane 1 flows far better past the shoulder than past the lane",
   shoulder.mean > onRoad.mean * 1.8, true);
ok("...and nobody drives into a car that is not on the road",
   shoulder.contacts, 0);
console.log(`       lane 1 runs ${(shoulder.mean / Math.max(0.1, onRoad.mean)).toFixed(1)}× faster past a shoulder than past an obstruction`);

/* ══════════════════════════════════════════════════════════════════════
   §8  the overtake tally

   *(Ric, 2026-08-12: "cars past should be a counter for a run thats
   showed on death.")*

   Vehicles OVERTAKEN, on your own carriageway. The oncoming side is
   left out on purpose — you pass a thousand of those on a divided
   highway without doing anything, and a counter that climbs while you
   sit still is not a counter about you. Both halves are pinned here,
   because the wrong one is the easy mistake.
   ══════════════════════════════════════════════════════════════════════ */
head("§8  cars passed");

/* Run the band with the player parked in the rightmost lane, well below
   the traffic. Everybody goes past HIM; he overtakes nobody. */
Cars.start(PX, true, WHEN, "TN", 11);
Cars.setVehicle(null);
/* The player's road-s has to ADVANCE with the band. Holding it still
   while `update` moves the world leaves the piloted body pinned at one
   sim-s, which is a car that never goes anywhere and overtakes nobody —
   the harness mistake, not a model one. */
function driveFor(seconds, mps, lane) {
  let px = PX;
  const n = Math.round(seconds * 60);
  for (let k = 0; k < n; k++) {
    /* `rs` is DERIVED from the corridor px rather than tracked beside
       it. They have to name the same point — `setPlayer` converts
       through `road.baseS + rs` and `update` is handed px directly — and
       letting them drift is how the pilot ends up at a sim-s three
       thousand kilometres from the band it is supposed to be in. */
    const rs = px - road.baseS;
    Cars.setPlayer(road, rs, R.laneU(road, rs, lane, true), true, mps, false, 0);
    Cars.update(1 / 60, px, mps);
    px += mps / M_PER_PX * (1 / 60);
  }
  return Cars.passed();
}

{
  const beingPassed = driveFor(25, 4, 3);          // walking pace, nearside
  console.log(`       parked in traffic, overtaken constantly: tally ${beingPassed}`);
  ok("BEING passed by everybody counts nothing", beingPassed, 0);
}

/* And now the other way: travel far faster than the stream. */
Cars.start(PX, true, WHEN, "TN", 11);
{
  const overtook = driveFor(25, 55, 0);            // 123 mph, offside lane
  console.log(`       25 s at 123 mph through the stream: tally ${overtook}`);
  ok("overtaking the stream counts, and counts a lot", overtook > 20, true);
}

/* It is a per-run tally, so starting again starts it again. */
Cars.start(PX, true, WHEN, "TN", 11);
ok("a new run starts the tally at nothing", Cars.passed(), 0);
Cars.setPlayer(null);

console.log(`\n${pass} passed, ${fail} failed`);
console.log("─".repeat(30));
process.exit(fail ? 1 : 0);
