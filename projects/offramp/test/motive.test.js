/* ══════════════════════════════════════════════════════════════════════
   Why anybody changes lane, checked two ways.

   `node test/motive.test.js` from projects/offramp.

   ── what this file is for, and what it is NOT for ───────────────────
   The real verdict on `motive.js` is `test/sim.test.js`'s scoreboard:
   four statistics measured off drone video that nothing in the model is
   ever told, run for simulated hours. That is the measurement, and it
   cannot be replaced by unit tests, because the whole argument of
   PLAN.md §5c is that a model can hit any single statistic by aiming at
   it and still be wrong.

   So this file does the other job. It checks that each motive fires when
   it should and stays silent when it should not, IN ISOLATION, against a
   hand-built view — which the scoreboard cannot tell you, because on a
   real road every motive is firing at once and a bug in one looks
   exactly like a mis-tuning of another. It also checks the two
   architectural rules §5c actually commits to, which are not statistics
   at all:

     · no motive is allowed to matter more because of where it sits in
       the list. Order of evaluation must be irrelevant.
     · `yield` must be blind to what is behind it. The player is not
       special; the driver is.

   And it checks the emergent behaviours §5c stakes the architecture on
   by name — the elephant race, somebody moving over for you, and the
   three roles the lanes actually have (right to cruise, middle out of
   the way of the mergers, left to pass) — because those are claims about
   what falls OUT of the motives rather than about any number in them.
   ══════════════════════════════════════════════════════════════════════ */

global.window = {};
require("../data/traffic.js");
const T = require("../src/traffic.js");
const S = require("../src/sim.js");
const M = require("../src/motive.js");

let pass = 0, fail = 0;
const fmt = (n) => typeof n === "number"
  ? (Number.isInteger(n) ? String(n) : n.toFixed(3)) : String(n);
function ok(name, got, want, tol) {
  const good = tol === undefined ? got === want : Math.abs(got - want) <= tol;
  if (good) { pass++; console.log(`  ok   ${name}  = ${fmt(got)}`); }
  else { fail++; console.log(`  FAIL ${name}  = ${fmt(got)}   want ${fmt(want)}${tol !== undefined ? ` ±${tol}` : ""}`); }
}
function within(name, got, lo, hi) {
  if (got >= lo && got <= hi) { pass++; console.log(`  ok   ${name}  = ${fmt(got)}  (${lo}–${hi})`); }
  else { fail++; console.log(`  FAIL ${name}  = ${fmt(got)}   want ${lo}–${hi}`); }
}
const head = (s) => console.log(`\n${s}\n${"─".repeat(s.length)}`);

const REF = 17037426 + 3000 / 0.179;
const DAY = { dow: 2, hour: 14, month: 6 };
const MPH = S.MPH;

/* ── a vehicle, and a world to put it in ─────────────────────────────
   Built by hand rather than pulled out of a run, because the point is to
   control exactly one thing at a time. The fields are the ones `view`
   and the motives actually read; anything they do not read is absent on
   purpose, so that a motive quietly growing a new dependency fails here
   rather than passing by accident. */
function vehicle(o) {
  const d = o || {};
  return {
    id: d.id || 1, kind: d.kind || "car", v: d.v == null ? 30 : d.v,
    s: d.s == null ? 1000 : d.s, len: d.len || 4.6, s0: d.s0 || 2,
    par: { T: d.T || 0.7, A: 1.2, B: 1.8, s0: d.s0 || 2 },
    drv: {
      want: d.want == null ? 31 : d.want,
      push: d.push == null ? 0.4 : d.push,
      discipline: d.discipline == null ? 0.5 : d.discipline,
      polite: d.polite == null ? true : d.polite,
      gap: d.gap == null ? 0.6 : d.gap,
      signal: d.signal || "proper",
    },
  };
}
/* One lane's worth of neighbourhood, in the shape `view.side` returns. */
const side = (lead, leadGap, lag, lagGap) => ({
  lead: lead || null, leadGap: leadGap == null ? Infinity : leadGap,
  lag: lag || null, lagGap: lagGap == null ? Infinity : lagGap,
});
function world(o) {
  const d = o || {};
  const sides = d.sides || {};
  return {
    lanes: d.lanes || 4, lane: d.lane == null ? 2 : d.lane,
    limit: 70, px: REF, dt: 0.1,
    /* Metres to the next interchange. Infinity is the featureless
       mainline the harness was before it knew where the junctions are. */
    junction: d.junction == null ? Infinity : d.junction,
    lead: d.lead || null, gap: d.gap == null ? Infinity : d.gap,
    veh: d.veh || null,
    side(ln) { return sides[ln] === undefined ? side(null) : sides[ln]; },
  };
}
const ctx = (t) => ({ rng: () => 0.5, t: t || 0, dt: 0.1, lanes: 4,
                      px: REF, when: DAY, dir: 1, state: "TN" });

/* Run a motive for `secs` of simulated time against a fixed view, which
   is how the two integrating motives are supposed to be exercised: their
   urgency is a debt, so a single call can only ever return nearly zero. */
function hold(fn, veh, view, secs) {
  let last = null;
  for (let i = 0; i < secs / view.dt; i++) {
    const ln = Math.round(view.lane);
    last = fn(veh, view, view.side(ln - 1), view.side(ln + 1));
  }
  return last;
}

/* ══ 1. free() — the question underneath everything ══════════════════
   Three of the four motives ask it, and it is where the first version of
   this file went wrong badly enough to cost a carriageway: in a queue
   nobody is closing on anybody, so a purely closing-rate test declared
   every driver in a jam unobstructed. */
head("Am I free in that lane?");
const me = vehicle({ v: 30, want: 31 });
ok("an empty lane is free", M.free(side(null), 31, me), true);
ok("a lead going as fast as I want is free",
   M.free(side({ v: 31 }, 40), 31, me), true);
ok("...and one a shade faster still is",
   M.free(side({ v: 33 }, 25), 31, me), true);
ok("a slower lead 300 m up is not my problem yet",
   M.free(side({ v: 24 }, 300), 31, me), true);
ok("the same lead at 30 m is", M.free(side({ v: 24 }, 30), 31, me), false);
/* The one that was broken. Both vehicles crawling, nobody closing on
   anybody, and the driver is unambiguously stuck. */
const stuck = vehicle({ v: 6, want: 31 });
ok("STUCK IN A QUEUE: not closing, and not free either",
   M.free(side({ v: 6 }, 8), 31, stuck), false);

/* ══ 2. the four motives, one at a time ══════════════════════════════ */
head("blocked — overtaking, and the patience it takes");
{
  const v = vehicle({ v: 24, want: 31, push: 0.5 });
  const lorry = { v: 24, len: 21 };
  const w = world({ lane: 2, lead: lorry, gap: 25, veh: v,
                    sides: { 1: side(null), 3: side({ v: 24 }, 30) } });
  ok("does not fire instantly — patience is a debt, not a trigger",
     M.motives.blocked(v, w, w.side(1), w.side(3)) === null
       || M.motives.blocked(v, w, w.side(1), w.side(3)).urgency < 0.1, true);
  const out = hold(M.motives.blocked, v, w, 60);
  ok("...but it does fire once the driver has had enough", out != null, true);
  ok("and it goes left, because that is where the free lane is", out.lane, 1);
  within("urgency saturates rather than running away", out.urgency, 0.9, 1.0);
}
{
  /* §5c: blocked must be indifferent to side, because that is what
     lets somebody undertake. Left blocked, right clear. */
  const v = vehicle({ v: 24, want: 31, push: 0.9 });
  const w = world({ lane: 2, lead: { v: 24, len: 21 }, gap: 25, veh: v,
                    sides: { 1: side({ v: 23 }, 20), 3: side(null) } });
  const out = hold(M.motives.blocked, v, w, 60);
  ok("UNDERTAKES when the left is blocked and the right is clear",
     out && out.lane, 3);
}
{
  const v = vehicle({ v: 31, want: 31 });
  const w = world({ lane: 2, lead: { v: 34, len: 4.6 }, gap: 60, veh: v,
                    sides: { 1: side(null), 3: side(null) } });
  ok("a driver getting the speed it wants is never blocked",
     hold(M.motives.blocked, v, w, 120), null);
}
{
  /* The governed lorry. It is not blocked, it is a lorry, and a motive
     that cannot tell those apart puts every heavy vehicle in lane 1. */
  const v = vehicle({ kind: "artic", v: 29, want: 29, len: 21, discipline: 0.9 });
  const w = world({ lane: 3, lead: null, gap: Infinity, veh: v,
                    sides: { 2: side(null), 4: side(null) } });
  ok("a governed lorry at its own limit is not blocked",
     hold(M.motives.blocked, v, w, 120), null);
}

head("keep right — the debt for a lane you do not need");
{
  const v = vehicle({ v: 31, want: 31, discipline: 0.95 });
  const w = world({ lane: 1, lead: null, gap: Infinity, veh: v,
                    sides: { 2: side(null) } });
  const out = hold(M.motives.keepRight, v, w, 40);
  ok("a disciplined driver in an empty lane 1 moves over", out && out.lane, 2);
}
{
  const v = vehicle({ v: 31, want: 31, discipline: 0.95 });
  const w = world({ lane: 4, lanes: 4, lead: null, gap: Infinity, veh: v });
  ok("nobody keeps right out of the rightmost lane",
     hold(M.motives.keepRight, v, w, 120), null);
}
{
  /* Mid-overtake. The right lane holds the thing being passed, so this
     motive must stay quiet — §5c's "not while I am overtaking this
     lorry", which a priority list could not express. */
  const v = vehicle({ v: 31, want: 31, discipline: 0.95 });
  const w = world({ lane: 2, lead: null, gap: Infinity, veh: v,
                    sides: { 3: side({ v: 23 }, 15) } });
  ok("...and not while there is a lorry alongside to the right",
     hold(M.motives.keepRight, v, w, 120), null);
}
{
  /* The class separation, with no code anywhere naming a class. */
  const disc = (k) => { let s = 0, n = 0;
    const rng = T.seeded(9);
    for (let i = 0; i < 4000; i++) { s += M.habit(T.driver(k, REF, DAY, "TN", rng).discipline); n++; }
    return s / n; };
  const car = disc("car"), artic = disc("artic");
  within("median car treats keeping right as a suggestion", car, 0.15, 0.45);
  within("...and a lorry treats it as a rule", artic, 0.75, 0.95);
  ok("so a lorry is at least twice the driver about it", artic > 2 * car, true);
}

head("yield — somebody sees you and moves over");
{
  const v = vehicle({ v: 28, want: 31, polite: true });
  const w = world({ lane: 2, veh: v,
                    sides: { 2: side(null, Infinity, { v: 34 }, 20), 3: side(null) } });
  const out = M.motives.yield(v, w, w.side(1), w.side(3));
  ok("a polite driver with somebody closing behind moves over",
     out && out.lane, 3);
  ok("...and indicates, which is the whole point", out && out.signal, true);
}
{
  const v = vehicle({ v: 28, want: 31, polite: false });
  const w = world({ lane: 2, veh: v,
                    sides: { 2: side(null, Infinity, { v: 34 }, 20), 3: side(null) } });
  ok("an impolite driver does not have this motive AT ALL",
     M.motives.yield(v, w, w.side(1), w.side(3)), null);
}
{
  const v = vehicle({ v: 28, want: 31, polite: true });
  const w = world({ lane: 2, veh: v,
                    sides: { 2: side(null, Infinity, { v: 28.5 }, 300), 3: side(null) } });
  ok("somebody a long way back gaining slowly is not asking for anything",
     M.motives.yield(v, w, w.side(1), w.side(3)), null);
}
{
  /* THE ARCHITECTURAL ONE. §5c settled that the player is not special.
     `yield` must produce the same answer for two vehicles behind that
     differ in every way except speed and distance. */
  const v = vehicle({ v: 28, want: 31, polite: true });
  const mk = (behind) => world({ lane: 2, veh: v,
    sides: { 2: side(null, Infinity, behind, 20), 3: side(null) } });
  const a = M.motives.yield(v, mk({ v: 34, kind: "car", id: 7 }), null, side(null));
  const b = M.motives.yield(v, mk({ v: 34, kind: "artic", id: 99, player: true }),
                            null, side(null));
  ok("YIELD IS BLIND TO WHAT IS BEHIND IT — same closing speed, same answer",
     JSON.stringify(a) === JSON.stringify(b), true);
}

head("yield — and staying out of the way of the mergers");
/* Ric, 2026-08-10: "people stay in the right lane to cruise. people stay
   in the middle lane to stay out of the way of mergers and the left lane
   is for passing. most of the time."

   Three roles, and the model had two. The rightmost lane has traffic
   JOINING it, which is why a real driver does not treat it as home —
   and BEHAVIOUR.md §2 measures exactly who minds:

     cars     lane 3  19.2%   lane 4 (right)  24.8%
     lorries  lane 3  48.1%   lane 4 (right)  24.7%

   Cars slightly prefer the rightmost lane. Lorries avoid it two to one.
   So this is not a majority behaviour with hold-outs, it is what the
   heavy traffic does — and the gate is `length`, which is physical and
   measured, rather than anything naming a class. */
{
  const lorry = vehicle({ kind: "artic", len: 20, v: 25, want: 26, push: 0.3 });
  const car = vehicle({ kind: "car", len: 6, v: 30, want: 31, push: 0.3 });
  const near = world({ lane: 4, lanes: 4, veh: lorry, junction: 300 });
  const far = world({ lane: 4, lanes: 4, veh: lorry, junction: 20000 });
  ok("a lorry's home lane is one in from the right, near a junction",
     M.home(lorry, near), 3);
  ok("...and the rightmost lane out in open country", M.home(lorry, far), 4);
  ok("a car is happy in the rightmost lane either way",
     M.home(car, near), 4);
  ok("...and a pushy driver of anything sits in it regardless",
     M.home(vehicle({ len: 20, push: 0.9 }), near), 4);
  ok("two lanes is not enough to have a middle to shelter in",
     M.home(lorry, world({ lane: 2, lanes: 2, veh: lorry, junction: 300 })), 2);
}
{
  const lorry = vehicle({ kind: "artic", len: 20, v: 25, want: 26, push: 0.3 });
  const w = world({ lane: 4, lanes: 4, veh: lorry, junction: 300,
                    sides: { 3: side(null) } });
  const out = M.motives.yield(lorry, w, w.side(3), null);
  ok("so it moves LEFT, out of the lane they are joining",
     out && out.lane, 3);
  ok("...and indicates", out && out.signal, true);
  ok("...and it is the merge half that says so", out && out.why, "yield-merge");
  const early = world({ lane: 4, lanes: 4, veh: lorry, junction: 2900,
                        sides: { 3: side(null) } });
  const late = M.motives.yield(lorry, w, w.side(3), null);
  const soon = M.motives.yield(lorry, early, early.side(3), null);
  ok("...and it gets more urgent as the junction arrives",
     late.urgency > soon.urgency, true);
}
{
  /* The two halves of `yield` pull opposite ways, and both are right.
     §5c's table says "one lane left"; the obvious reading of the
     tailgater trigger says right. They are different triggers. */
  const v = vehicle({ len: 6, v: 28, want: 31, polite: true, push: 0.3 });
  const w = world({ lane: 2, lanes: 4, veh: v, junction: 20000,
                    sides: { 2: side(null, Infinity, { v: 34 }, 20), 3: side(null) } });
  ok("a car with somebody on its bumper still moves RIGHT",
     M.motives.yield(v, w, w.side(1), w.side(3)).lane, 3);
}
{
  /* Without a junction list the harness is featureless mainline, which
     is what it was before 2026-08-10, and nobody shelters. */
  const lorry = vehicle({ kind: "artic", len: 20, push: 0.3 });
  ok("no junctions known means no sheltering",
     M.home(lorry, world({ lane: 4, lanes: 4, veh: lorry })), 4);
}

head("avoid — wrecks making traffic, which is the game");
{
  const v = vehicle({ v: 30, want: 31 });
  const wreck = { v: 0, len: 4.6, wreck: { at: 0 } };
  const w = world({ lane: 2, lead: wreck, gap: 120, veh: v,
                    sides: { 1: side(null), 3: side(null) } });
  const out = M.motives.avoid(v, w, w.side(1), w.side(3));
  ok("a wreck in my lane is something to get away from", out != null, true);
  ok("...and it outranks every opinion about lane discipline",
     out.urgency > 1, true);
  const near = world({ lane: 2, lead: wreck, gap: 40, veh: v,
                       sides: { 1: side(null), 3: side(null) } });
  ok("...and it gets more urgent the closer it is",
     M.motives.avoid(v, near, near.side(1), near.side(3)).urgency > out.urgency, true);
}
{
  const v = vehicle({ v: 30, want: 31 });
  const wreck = { v: 0, len: 4.6, wreck: { at: 0 } };
  /* Both neighbours are also blocked. There is nowhere to go, and the
     honest answer is to say so rather than to invent an escape — this is
     why traffic backs up behind a wreck rather than parting around it. */
  const w = world({ lane: 2, lead: wreck, gap: 60, veh: v,
                    sides: { 1: side(wreck, 50), 3: side(wreck, 50) } });
  ok("nowhere to go is an answer", M.motives.avoid(v, w, w.side(1), w.side(3)), null);
}
{
  const v = vehicle({ v: 30, want: 31 });
  const w = world({ lane: 2, lead: { v: 29, len: 4.6 }, gap: 60, veh: v,
                    sides: { 1: side(null), 3: side(null) } });
  ok("ordinary moving traffic is not a hazard",
     M.motives.avoid(v, w, w.side(1), w.side(3)), null);
}

/* ══ 3. the argument between them ════════════════════════════════════
   §5c: highest urgency wins, below a floor nobody moves, and the order
   of evaluation must be irrelevant. That last one is the architectural
   claim — if order ever matters, this is a priority list wearing a
   costume and the design has quietly become something else. */
head("Motives compete, and nothing wins by being early in the list");
{
  const v = vehicle({ v: 12, want: 31, discipline: 0.95, push: 0.9 });
  const wreck = { v: 0, len: 4.6, wreck: { at: 0 } };
  const w = world({ lane: 2, lead: wreck, gap: 45, veh: v,
                    sides: { 1: side(null), 3: side(null) } });
  /* keep right and blocked both want something here; avoid wants
     something more. Charge the debts up first so they are real. */
  for (let i = 0; i < 600; i++) {
    M.motives.keepRight(v, w, w.side(1), w.side(3));
    M.motives.blocked(v, w, w.side(1), w.side(3));
  }
  const out = M.decide(v, w, ctx(1000));
  ok("with a wreck ahead, avoid beats a fully charged keep-right",
     out && out.why, "avoid");
}
{
  const v = vehicle({ v: 31, want: 31, discipline: 0.1 });
  const w = world({ lane: 2, lead: null, gap: Infinity, veh: v,
                    sides: { 1: side(null), 3: side(null) } });
  let moved = null;
  for (let i = 0; i < 100 && !moved; i++) moved = M.decide(v, w, ctx(i * 0.1));
  ok("below the floor, nobody moves for the sake of moving", moved, null);
}
{
  /* Acting settles the debt. Without this a driver who has been charged
     for two minutes changes lane, arrives, and is still carrying the
     whole debt — so it moves again, and again, across the carriageway. */
  const v = vehicle({ v: 31, want: 31, discipline: 0.95 });
  const w = world({ lane: 1, lead: null, gap: Infinity, veh: v,
                    sides: { 2: side(null) } });
  let out = null;
  for (let i = 0; i < 1200 && !out; i++) out = M.decide(v, w, ctx(i * 0.1));
  ok("a driver that has just moved has spent its debt", out != null, true);
  ok("...and does not immediately want to move again",
     M.decide(v, w, ctx(1000)), null);
}

/* ══ 4. what is supposed to fall out ═════════════════════════════════
   Not assertions about the motives. Assertions about the ROAD, run for
   simulated hours with the motives driving it — the two behaviours §5c
   names as the test of whether the architecture is right at all. */
head("The elephant race, which nothing anywhere writes down");
const run = (o) => S.run(Object.assign(
  { px: REF, when: DAY, state: "TN", dir: 1, seed: 11, warmup: 500,
    q: 1585, hours: 0.4, decide: M.decide }, o));
const I40 = require("./i40.js");
const road = run({ junctions: I40.exits });
{
  /* §5c: "Lorry desired speeds have a real spread, so sooner or later
     one lorry is 1 mph faster than the one ahead. blocked puts it out to
     pass. If this does NOT emerge, the model is wrong somewhere." */
  const lorries = road.changes.filter((c) => c.kind === "artic" || c.kind === "rigid");
  const left = lorries.filter((c) => c.dir === "left");
  const passing = left.filter((c) => c.why === "blocked-left");
  const sheltering = left.filter((c) => c.why === "yield-merge");
  ok("lorries do pull out to pass each other", passing.length > 0, true);
  /* A lorry now goes left for exactly two reasons and they are different
     things: it is being held up, or a junction is coming and it does not
     want to be in the lane the traffic joins. Nothing else may send a
     lorry left — `keep right` never does, and there is no exit motive
     yet. If a third reason ever appears here it is a bug. */
  ok("...and only ever for one of two reasons: passing, or sheltering",
     left.every((c) => c.why === "blocked-left" || c.why === "yield-merge"), true);
  ok("...and both of those actually happen", sheltering.length > 0, true);
  console.log(`       ${passing.length} lorry overtakes and ${sheltering.length}`
            + ` moves out of the merge lane, in ${road.hours} h of four-lane road,`
            + ` out of ${lorries.length} heavy manoeuvres`);
}
head("Somebody sees you and moves over");
{
  const yields = road.changes.filter((c) => c.why === "yield");
  ok("it happens at all", yields.length > 0, true);
  ok("...always to the right, out of the way", yields.every((c) => c.dir === "right"), true);
  ok("...and every one of them is indicated",
     yields.every((c) => c.signal !== "none"), true);
  console.log(`       ${yields.length} of ${road.changes.length} manoeuvres`
            + ` are somebody moving over for somebody else`);
}
head("Every manoeuvre has a reason, and it is one of the seven");
{
  const KNOWN = ["blocked-left", "blocked-right", "keep-right", "yield",
                 "yield-merge", "exit", "avoid"];
  ok("nothing moves for no reason",
     road.changes.every((c) => KNOWN.indexOf(c.why) >= 0), true);
  const by = {};
  for (const c of road.changes) by[c.why] = (by[c.why] || 0) + 1;
  console.log("       " + Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${(n / road.changes.length * 100).toFixed(0)}%`).join(", "));
  /* The harness's own invariant still has to hold with motives driving. */
  ok("and nobody ended up in the same place as anybody else", road.conflicts, 0);
}

/* ── and the three roles, which is the shape of the whole thing ──────
   Ric's account of what the lanes are FOR, checked against the drone.
   BEHAVIOUR.md §2 measures where each class sits, and the two rows
   disagree with each other in exactly the way that makes the point:
   cars slightly prefer the rightmost lane, lorries avoid it two to one,
   and lane 3 is quiet for cars precisely because it is full of lorries. */
head("Right to cruise, middle out of the way, left to pass");
{
  const L = road.lanes;
  const pc = (k, i) => L[i][k] * 100;
  console.log("       lane            1 (L)     2     3   4 (R)");
  console.log(`       lorries      ${L.map((x) => (x.artic * 100).toFixed(1).padStart(6)).join("")}`
            + "     measured 1.2  26.1  48.1  24.7");
  console.log(`       cars         ${L.map((x) => (x.car * 100).toFixed(1).padStart(6)).join("")}`
            + "     measured 31.7  24.3  19.2  24.8");
  ok("lorries live one lane in from the right, not in it",
     pc("artic", 2) > pc("artic", 3), true);
  ok("...by something like the measured two to one",
     pc("artic", 2) / pc("artic", 3) > 1.6, true);
  ok("cars are not driven out of the rightmost lane the same way",
     pc("car", 3) > pc("car", 2) * 0.8, true);
  ok("and the left lane is for passing, so the lorries are not in it",
     pc("artic", 0) < 5, true);
}

/* ── the same thing, but able to referee a change ────────────────────
   The block above is one seed on a boundary seeded UNIFORMLY, and both
   halves of that made it unfit to tune against — see PLAN.md §5f, where
   three candidate fixes to `keepRight` were measured and the best-
   looking one turned out to be a single seed's luck.

   Two changes and they are independent. `laneMix` starts every vehicle
   in the lane the drone found its class in, so the run asks a
   FIXED-POINT question — begin where the real road is and see whether
   the motives hold it there — instead of asking where a random pile
   settles. And it runs several seeds, because the only way to know
   whether a difference is real is to know how big the differences are
   when nothing has changed.

   Read the SPREAD first. A change to the motive layer is worth
   believing when it moves a number by more than the ± beside it. */
head("Does the model hold the road the drone measured?");
{
  const SEEDS = [11, 23, 37];
  const runs = SEEDS.map((seed) => run({ junctions: I40.exits, seed,
                                         exitShare: 0, laneMix: true }));
  const stats = (f) => {
    const v = runs.map(f);
    const mean = v.reduce((a, x) => a + x, 0) / v.length;
    return { mean, spread: (Math.max(...v) - Math.min(...v)) / 2 };
  };
  const pm = (s, d) => `${s.mean >= 0 ? "+" : ""}${s.mean.toFixed(1)}±${s.spread.toFixed(d || 1)}`;

  console.log(`       ${SEEDS.length} seeds, boundary seeded at the measured shares,`
            + ` exits off.\n       Drift is percentage points from where it started.`);
  console.log("       drift        1 (L)         2         3     4 (R)");
  for (const k of ["artic", "car"]) {
    const cells = [0, 1, 2, 3]
      .map((i) => pm(stats((r) => r.drift[k + "By"][i])).padStart(10)).join("");
    console.log(`       ${(k === "artic" ? "lorries" : "cars").padEnd(9)}${cells}`);
  }
  const carRms = stats((r) => r.drift.car);
  const lorRms = stats((r) => r.drift.artic);
  const grad = stats((r) => r.gradient);
  const rate = stats((r) => r.changes.length / r.vehKm);
  console.log(`       rms  cars ${pm(carRms)}   lorries ${pm(lorRms)}`
            + `   ·  gradient ${pm(grad)} mph (measured 15)`
            + `   ·  ${pm(rate, 2)}/veh-km (measured 0.37)`);

  /* What the numbers are allowed to be is deliberately loose: these are
     the CURRENT state written down so a change has something to move,
     not targets anybody has hit. The one that matters is the spread. */
  ok("the seeded run reports a drift at all", carRms.mean > 0, true);
  ok("cars are pushed OUT of the lane the drone found them in",
     stats((r) => r.drift.carBy[0]).mean < -5, true);
  ok("...and it is the same story every seed, not one seed's luck",
     stats((r) => r.drift.carBy[0]).spread < 2, true);
  /* Lorries are a fraction of the traffic here, so the same run carries
     a fraction of the vehicle-seconds and the spread shows it. This is
     printed rather than asserted because it is the harness's own
     limitation being written down: until it is under about 2 pp, a
     change to how lorries pick a lane cannot be told from noise on
     three seeds of forty minutes, and the answer is more road-hours
     rather than a cleverer motive. */
  const lorSpread = stats((r) => r.drift.articBy[1]).spread;
  console.log(`       lorry lane-2 spread ±${lorSpread.toFixed(1)} pp`
            + ` — ${lorSpread < 2 ? "decidable" : "NOT yet decidable"}:`
            + ` a change must beat this to be believed`);
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log("─".repeat(30));
process.exit(fail ? 1 : 0);
