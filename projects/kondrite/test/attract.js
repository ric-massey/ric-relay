#!/usr/bin/env node
"use strict";

/* KONDRITE — THE FRONT PAGE
   ─────────────────────────────────────────────────────────────────────────────
   attract.js is the one piece of art in this project that is a simulation, and
   a simulation is the one kind of art a drawing test cannot check. Every scene
   in menu.js is a closed-form function of a clock: look at it once and you have
   seen everything it will ever do. The front page is a run being flown, and the
   only questions worth asking about it are questions about *what happens over
   time* — which is exactly what nobody finds out by opening the page for ten
   seconds and deciding it looks fine.

   So this suite flies it. Not a few frames: minutes of it, headless, at a
   hundred and eighty times real speed, and then it asks the page the questions
   a person watching it would ask.

     · Does everything Ric asked for actually turn up, and how long do you have
       to wait? A star to whip round, a black hole to whip round, a station to
       call at, a fight to join, rocks breaking the whole time. A bag that can
       roll badly is a front page that is empty for four minutes and nobody
       finds out until it is live.
     · Is it ever boring? Measured as the longest gap between two things
       happening, over half an hour.
     · Is a slingshot a slingshot? It has to leave faster than it arrived, by a
       margin, or it is a corner.
     · Does the pilot survive its own set pieces? The ship is never destroyed by
       anything here, so the question is whether it is ever drawn somewhere
       absurd — inside a star, or stuck.
     · Does it leak? A page left open all afternoon is the normal case for a
       title screen, and a list that grows is the way that ends badly.
     · And the flat question underneath all of them: does it stay finite, and
       does it draw without throwing, in a box of any shape.

   The numbers below are floors and ceilings rather than exact values, because
   the run is seeded but the tuning is not frozen: this suite is here to catch
   a front page that has gone quiet or gone wrong, not to pin every constant.

   Run it:  node test/attract.js                                               */

const assert = require("node:assert/strict");
const vm = require("node:vm");
const page = require("./page.js");

/* The game's MAX_SPEED. Written out here rather than read from attract.js,
   because a test that takes its expected value from the thing under test is a
   test that agrees with whatever the bug happened to be. */
const MAXISH = 360;

let problems = [];
function check(ok, why) {
  if (!ok) problems.push(why);
  return ok;
}

/* ── the page really does load it ────────────────────────────────────────── */
{
  const p = page.page();
  check(p.srcs.indexOf("attract.js") >= 0,
        "index.html does not load attract.js — the front page has no art");
  check(p.inline.indexOf("KondriteAttract") > 0,
        "the game never reaches for window.KondriteAttract");
}

/* ── a context that records nothing and refuses nothing ──────────────────── */
const noop = () => {};
function stubCtx() {
  return new Proxy({}, {
    get: (t, k) => {
      if (k === "measureText") return s => ({ width: String(s).length * 8 });
      if (k === "createLinearGradient" || k === "createRadialGradient") {
        return () => ({ addColorStop: noop });
      }
      return k in t ? t[k] : (t[k] = noop);
    },
    set: (t, k, v) => (t[k] = v, true)
  });
}

function load() {
  const windowStub = {};
  const sandbox = { window: windowStub, Math, Date, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(page.source("attract.js"), sandbox, { filename: "attract.js" });
  const A = windowStub.KondriteAttract;
  assert.ok(A, "attract.js did not register window.KondriteAttract");
  // `glow` is the game's: draw the path twice, wide and faint then narrow.
  A.init({ ctx: stubCtx(), glow: (c, w, a, path) => { path(); path(); } });
  return A;
}

/* The box the world is stepped against, worked out the same way `draw` does —
   the screen rectangle in world units around the camera. */
const Z = w => 0.95 * (Math.min(w.w, w.h) / 700);
function rectFor(A, box) {
  const z = Z(box), ax = box.w * 0.24, ay = box.h * 0.68;
  const c = A.world.cam;
  return { x0: c.x - ax / z, x1: c.x + (box.w - ax) / z,
           y0: c.y - ay / z, y1: c.y + (box.h - ay) / z };
}

/* Fly it, and hand back everything worth knowing about the flight. A watcher
   per question, because running it five times is five minutes of nothing. */
function fly(A, minutes, box) {
  box = box || { w: 1280, h: 800 };
  const dt = 1 / 60;
  const W = A.world;
  const events = [];            // [time, what] — the things a viewer would see
  const seen = {};
  const mark = (t, what) => {
    events.push([t, what]);
    if (seen[what] === undefined) seen[what] = t;
  };
  let last = { ...W.tally }, pass = null, stage = "";
  const passes = [];
  let worstWell = Infinity, maxSpeed = 0, nonFinite = null, maxList = 0;
  let defected = null, foeFrames = 0, onFoe = 0;

  for (let i = 0; i < minutes * 60 * 60; i++) {
    A.step(dt, rectFor(A, box));
    const s = W.ship, t = W.t;

    // What changed this frame that somebody watching would have noticed.
    if (W.tally.broke > last.broke) mark(t, "a rock broke");
    /* A round connecting counts. It has to: the longest silence this metric
       ever reported turned out to be twelve seconds in the middle of a
       three-ship dogfight, because nobody happened to be *destroyed* during it.
       Rounds going past a hull is the most alive the page ever is. */
    if (W.tally.struck > last.struck) mark(t, "a round told");
    if (W.tally.hurt > last.hurt) mark(t, "the pilot took one");
    if (W.tally.ports > last.ports) mark(t, "called at a station");
    if (W.tally.brawls > last.brawls) mark(t, "joined a fight");
    if (W.tally.downed > last.downed) mark(t, "a ship went up");
    /* A rock falling into the well bursts at the horizon, and the game counts
       it — its own dead-air clock reads the same counters this loop does, so
       the two have to agree on what an event is. */
    if (W.tally.eaten > last.eaten) mark(t, "a well ate a rock");
    if (W.tally.slings > last.slings) {
      mark(t, "slung round a " + (W.well ? W.well.kind : "?"));
    }
    last = { ...W.tally };

    /* A set piece turning up is a thing happening too, and the metric has to
       say so or it lies about the one stretch it is most likely to flag: the
       lap round a station is eight seconds with the nose pointed round a ring
       and nothing being shot at, and it is also the most interesting eight
       seconds on the page. */
    const now = W.goal.kind + ":" + (W.goal.phase || "");
    if (now !== stage) { if (stage) mark(t, "-> " + now); stage = now; }

    /* Every slingshot, from the speed it went in at to the speed it came out.
       "In at" is the speed when it first crosses the edge of the well's reach,
       which is the only honest place to read it: taken at the start of the
       approach it is whatever the *last* set piece left the ship doing, and
       taken any later it is already partly the throw being measured. */
    if (W.well && W.goal.kind === "sling") {
      if (!pass || pass.well !== W.well) {
        pass = { well: W.well, min: Infinity, vin: 0, vout: 0 };
        passes.push(pass);
      }
      const d = Math.hypot(W.well.x - s.x, W.well.y - s.y);
      if (!pass.vin && d < W.well.reach) pass.vin = Math.hypot(s.vx, s.vy);
      pass.min = Math.min(pass.min, d);
      if (pass.vin) pass.vout = Math.max(pass.vout, Math.hypot(s.vx, s.vy));
    }

    if (W.well) {
      worstWell = Math.min(worstWell,
        Math.hypot(W.well.x - s.x, W.well.y - s.y) / W.well.kill);
    }
    /* Nobody ever changes sides. Ric watched a raider turn into a courier mid
       fight — `kind` picks the hull and the colour, and the code that ended a
       stalemated brawl was reaching for it to mean "stopped being hostile".
       Cheap to check and impossible to see in a screenshot, so: every ship's
       kind is written down the first time it is seen and compared ever after. */
    for (const o of W.others) {
      if (o.wasKind === undefined) o.wasKind = o.kind;
      else if (o.wasKind !== o.kind && !defected) {
        defected = "a " + o.wasKind + " became a " + o.kind;
      }
    }

    /* And when something hostile is in gun range, that is what the gun is on.
       "the player ship needs to focus on the enemies first" — so this counts
       the frames where a raider was inside reach and the pilot was lined up on
       a rock instead. */
    const foe = W.others.find(o => o.alive && o.angry &&
                              Math.hypot(o.x - s.x, o.y - s.y) < 680);
    if (foe) {
      foeFrames++;
      const aimedAtFoe = Math.abs(Math.atan2(foe.y - s.y, foe.x - s.x) - s.a) < 0.5 ||
                         Math.abs(Math.atan2(foe.y - s.y, foe.x - s.x) - s.a) > 5.7;
      if (aimedAtFoe) onFoe++;
    }

    maxSpeed = Math.max(maxSpeed, Math.hypot(s.vx, s.vy));
    maxList = Math.max(maxList, W.rocks.length + W.shots.length +
                                W.bits.length + W.others.length + W.motes.length);
    if (!nonFinite && !(Number.isFinite(s.x) && Number.isFinite(s.y) &&
                        Number.isFinite(s.vx) && Number.isFinite(s.a))) {
      nonFinite = t;
    }
  }

  // The longest the page went without anything happening on it.
  let quiet = 0, at = 0, prev = 0;
  for (const [t] of events) {
    if (t - prev > quiet) { quiet = t - prev; at = prev; }
    prev = t;
  }
  return { events, seen, passes, worstWell, maxSpeed, nonFinite, maxList,
           defected, foeFrames, onFoe,
           quiet, quietAt: at, tally: { ...W.tally }, W };
}

/* ── 1. it draws, in any box, without throwing ───────────────────────────── */
{
  const A = load();
  let threw = null;
  const boxes = [[1280, 800], [1920, 1080], [820, 1180], [380, 700], [200, 120]];
  try {
    for (const [w, h] of boxes) {
      for (let f = 0; f < 90; f++) A.draw(0, 0, w, h, 1000 + f / 60);
    }
    // And a box too small to be worth drawing has to be refused, not drawn.
    check(A.draw(0, 0, 4, 4, 1) === false, "a four-pixel box was drawn anyway");
  } catch (e) { threw = e; }
  check(!threw, "drawing the front page threw: " + (threw && threw.message));
  console.log("  draws      five shapes from a phone to a monitor · " +
              "90 frames each · a box too small is refused");
}

/* ── 2. everything Ric asked for turns up, and soon ──────────────────────── */
{
  const A = load();
  const r = fly(A, 3);
  const wanted = {
    "a rock broke": 25,
    "slung round a star": 150,
    "slung round a hole": 150,
    "called at a station": 110,
    "joined a fight": 110,
    "a ship went up": 150
  };
  for (const what in wanted) {
    const at = r.seen[what];
    if (!check(at !== undefined, "three minutes of front page and nothing ever: " + what)) {
      continue;
    }
    check(at <= wanted[what],
          what + " took " + Math.round(at) + "s to happen, which is past the " +
          wanted[what] + "s a first look at a title screen lasts");
  }
  const order = Object.keys(wanted)
    .sort((a, b) => r.seen[a] - r.seen[b])
    .map(k => k + " " + Math.round(r.seen[k]) + "s");
  console.log("  the brief  " + order.join(" · "));
}

/* ── 3. it is never boring ───────────────────────────────────────────────── */
/* An hour and a half of it, because thirty minutes is about thirty slingshots
   and thirty of anything is not a sample — a first draft of this block reported
   "nought passes out of thirty-one clipped a kill radius", and the very next
   run of the same code reported six out of thirty-two. Nothing had changed but
   the order the seeded numbers came out in. Ninety minutes takes about five
   seconds to fly and says something. */
/* And on three seeds, judged on the worst. One run is one sample of a chaotic
   system: the same code flew its longest silence at 11.5s on an arm64 Mac and
   14.3s on an x86_64 runner, both against this twelve-second line, because a
   one-ulp difference in a transcendental had compounded over 300,000 frames.
   Three seeds do not make the machines agree — nothing does — but a page that
   stays under the line on three different runs has headroom, and one that
   scrapes under on the one seed a visitor happens to get does not. The line
   itself is not moved; the slack lives in the game (see DEAD_AIR in
   attract.js). */
{
  const A = load();
  const r = fly(A, 60);
  const runs = [["the page", r]];
  for (const seed of [0x51ed5eed, 0x9e3779b9]) {
    const B = load();
    B.start(seed);
    runs.push(["seed " + seed.toString(16), fly(B, 60)]);
  }
  for (const [who, run] of runs) {
    check(run.quiet < 12,
          who + " went " + run.quiet.toFixed(1) + "s with nothing happening on " +
          "it, starting at " + Math.round(run.quietAt) + "s");
    check(run.events.length / 60 > 60,
          "only " + (run.events.length / 60).toFixed(0) + " things happen a minute on " + who);
  }
  const perMin = r.events.length / 60;
  console.log("  pace       " + perMin.toFixed(0) + " things a minute over an " +
              "hour · longest silence " +
              runs.map(([, run]) => run.quiet.toFixed(1) + "s").join(" / ") +
              " over three seeds");

  /* ── 4. and it does not leak ──────────────────────────────────────────── */
  check(r.maxList < 500,
        "the front page had " + r.maxList + " live objects at once");
  const W = A.world;
  check(W.rocks.length < 60 && W.shots.length < 60 && W.bits.length < 260 &&
        W.others.length < 12 && W.motes.length <= 34,
        "a list grew over an hour: rocks " + W.rocks.length +
        ", rounds " + W.shots.length + ", debris " + W.bits.length +
        ", ships " + W.others.length + ", motes " + W.motes.length);
  check(!r.nonFinite, "the ship went non-finite at t=" + r.nonFinite);
  check(!r.defected, "a ship changed sides in front of the player: " + r.defected);
  const attention = r.onFoe / Math.max(1, r.foeFrames);
  check(attention > 0.6,
        "with a raider inside gun range the pilot was pointed at it only " +
        Math.round(attention * 100) + "% of the time");
  console.log("  bounded    " + r.maxList + " objects at the busiest · " +
              "nothing grew over an hour · nothing went non-finite");

  /* ── 5. a slingshot is a slingshot ────────────────────────────────────── */
  const real = r.passes.filter(p => p.vin > 0);
  check(real.length >= 25, "only " + real.length + " slingshots in an hour");
  const thrown = real.filter(p => p.vout > p.vin * 1.35);
  check(thrown.length > real.length * 0.8,
        "only " + thrown.length + " of " + real.length + " slingshots came out " +
        "meaningfully faster than they went in — the rest are corners");
  const gain = real.reduce((t, p) => t + p.vout / p.vin, 0) / real.length;
  check(gain > 1.6,
        "the average slingshot only gains " + gain.toFixed(2) + "× its speed");
  const peris = real.map(p => p.min / p.well.kill).sort((a, b) => a - b);
  const median = peris[peris.length >> 1];
  check(median > 1.6 && median < 7,
        "the typical pass goes by at " + median.toFixed(1) + " kill radii, which " +
        "is either a collision or a wave from the next county");
  console.log("  slingshot  " + real.length + " passes · " + gain.toFixed(2) +
              "× the speed they arrived at · median pass " +
              median.toFixed(1) + " kill radii out");

  /* ── 6. the pilot survives its own set pieces ─────────────────────────── */
  /* Nothing here can destroy the ship, so what is being checked is that the
     reflex is doing its job rather than that a death did not fire. A pass at a
     tenth of a kill radius is survivable and even spectacular — see the note on
     HAZARD in attract.js — but it must be the exception, not the way the pilot
     flies. */
  const inside = peris.filter(v => v < 1).length;
  check(inside <= Math.max(2, real.length * 0.15),
        inside + " of " + real.length + " passes went inside the kill radius — " +
        "the pilot is flying into wells, not round them");
  check(r.W.ship.hp > 0.2,
        "the pilot ended an hour on " + r.W.ship.hp.toFixed(2) + " hull");
  check(r.maxSpeed > MAXISH && r.maxSpeed < MAXISH * 4.2,
        "top speed over an hour was " + Math.round(r.maxSpeed) +
        ", against a top speed of " + MAXISH + " and a thrown ceiling of four");
  console.log("  the fight  a raider in range for " + Math.round(r.foeFrames / 60) +
              "s all told \u00b7 the nose was on it " + Math.round(attention * 100) +
              "% of that \u00b7 nobody changed sides");
  console.log("  the pilot  " + inside + " of " + real.length + " passes clipped " +
              "a kill radius · fastest " + Math.round(r.maxSpeed) +
              " against an engine's " + MAXISH);
}

/* ── 7. the same run twice ───────────────────────────────────────────────── */
{
  const a = fly(load(), 2), b = fly(load(), 2);
  check(JSON.stringify(a.tally) === JSON.stringify(b.tally),
        "two runs of the same two minutes came out different:\n      " +
        JSON.stringify(a.tally) + "\n      " + JSON.stringify(b.tally));
  console.log("  repeatable two minutes flown twice, same tally · " +
              JSON.stringify(a.tally));
}

/* ── 8. a tab that was hidden for an hour ────────────────────────────────── */
/* `draw` takes the wall clock and works out its own `dt`, because the game's
   own clock only advances while a match is running. A backgrounded tab hands
   back the whole time it was away in one lump, and a lump that reached the
   integrator would teleport the ship and put a rock through the middle of it. */
{
  const A = load();
  for (let f = 0; f < 120; f++) A.draw(0, 0, 1280, 800, 5000 + f / 60);
  const before = { x: A.world.ship.x, y: A.world.ship.y, t: A.world.t };
  A.draw(0, 0, 1280, 800, 5000 + 3600);        // an hour later, in one frame
  const jump = Math.hypot(A.world.ship.x - before.x, A.world.ship.y - before.y);
  check(jump < 200, "an hour in a background tab moved the ship " +
                    Math.round(jump) + " units in one frame");
  check(A.world.t - before.t < 0.2,
        "an hour in a background tab advanced the run by " +
        (A.world.t - before.t).toFixed(1) + "s in one frame");
  console.log("  hidden tab an hour away advances the run by one frame, not an hour");
}

if (problems.length) {
  console.error("\nKONDRITE front page checks FAILED");
  for (const p of problems) console.error("  · " + p);
  process.exit(1);
}
console.log("KONDRITE front page checks passed");
