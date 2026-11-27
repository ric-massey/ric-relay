// Lives with a history (TODO 15.12b to e, 2026-11-24). Ric's six points are in TODO.md; a is test/dice.test.mjs.
//
// What is held:
//   1. with hearing, experience and building finds off, the world is the one after 15.11, exactly — and the
//      links of why things happened (e), which are always kept, change nothing in it;
//   b. hearing of a thing is not knowing it: the first telling is word of it, and it is learned beside a
//      master at the same work far sooner than by seeing it done;
//   c. experience grows with the work, makes the work yield more, fades slowly when unused and never to
//      nothing, and holds people to a lane: they change work less often;
//   d. a find is built up over the days somebody works toward it, only in work they practise;
//   e. a chain of links is followed back, oldest first, five at most; a year's news carries some.
//
// node projects/world-builder/test/lives.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const OFF = { heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" };
const OLD = 433631066;   // print() of the world below after 15.11, before 15.12b to e
function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); mix(p.zeal || 0); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
const grown = w => w.people.filter(p => p.hp > 0 && w.adult(p));

// 1. Off: the world after 15.11, and the links only report.
{
  const w = People.create({ seed: 2, people: 250, neighbours: "enemies", era: "medieval", ...OFF }); w.step(24 * 3);
  const adults = grown(w);
  for (const f of w.factions) { const lead = w.byId.get(f.leader); if (!lead) continue; const fa = w.makeFaith(lead, "famine"); for (const q of adults.filter(p => p.f === f.id).slice(0, 20)) { w.convert(q, fa.id); q.zeal = 0.8; } lead.zeal = 1; }
  w.faithDay(); w.step(24 * 60);
  assert.equal(print(w), OLD, "with b to d off, the world after 15.11 exactly, links and all");
  assert.ok(w.lives.links() > 0, "and the links were kept all the while (" + w.lives.links() + ")");
}

// b. Hearing of a thing.
{
  const w = People.create({ seed: 3, people: 200, era: "medieval" });
  const [x, y] = grown(w).filter(p => p.job === "farmer" || p.job === "crafter");
  const k = "plough", bit = 1 << w.deep.ti(k);
  x.know |= bit; y.know &= ~bit; y.lf.heard &= ~bit;
  w.lives.heard(x, y, k);
  assert.ok((y.lf.heard & bit) && !(y.know & bit), "the first telling is word of it, not the knowing how");
  /* Beside a master at the same work, against somebody who only sees it done. */
  const tries = (master) => { let n = 0; for (let i = 0; i < 4000 && !(y.know & bit); i++) { y.home = master ? x.home : y.home; y.job = master ? x.job : (x.job === "farmer" ? "trader" : "farmer"); w.lives.heard(x, y, k); n++; } return n; };
  x.job = "farmer"; y.home = x.home;
  const a = tries(true); y.know &= ~bit;
  const b = tries(false);
  console.log("  learning the plough: " + a + " talks beside a farmer who has it, " + b + " seeing it done");
  assert.ok(w.stats().apprenticed >= 1, "learned beside a master");
}

// c. Experience.
{
  const w = People.create({ seed: 4, people: 300 });
  w.step(24 * 2);
  const farmers = grown(w).filter(p => p.job === "farmer");
  const sumXp = () => farmers.filter(q => q.hp > 0).reduce((a, q) => a + q.lf.xp[0], 0), x0 = sumXp();
  assert.ok(farmers.some(q => q.lf.xp[0] > 1), "the first people bring their years at their work");
  w.step(24 * 30);
  assert.ok(sumXp() > x0, "a month in the fields adds to it (" + x0.toFixed(1) + " -> " + sumXp().toFixed(1) + " years among the farmers)");
  assert.ok(w.lives.xpSkill({ lf: { xp: new Float32Array(10).fill(10) } }, 0) > w.lives.xpSkill({ lf: { xp: new Float32Array(10) } }, 0) * 1.3, "ten years at a thing does it better than a beginner");
  const q = { lf: { xp: new Float32Array(10) } }; q.lf.xp[4] = 5;
  assert.ok(Math.abs(w.lives.xpSkill(q, 4) - (0.8 + 0.35 * (1 - Math.exp(-5 / 3)))) < 1e-6, "the curve: four-fifths for a beginner, flattening after three years");
  /* Lanes: changes of work in a year, with and without. */
  const changes = opts => { const x = People.create({ seed: 5, people: 300, ...opts }); x.step(24 * 3); const was = new Map(x.people.map(p => [p.id, p.job])); x.step(24 * 120);
    return x.people.filter(p => x.adult(p) && was.has(p.id) && was.get(p.id) !== "child" && p.job !== was.get(p.id)).length / Math.max(1, x.people.filter(p => x.adult(p) && was.has(p.id)).length); };
  const own = changes({}), old = changes({ experience: "people" });
  console.log("  changed work in 120 days: " + (own * 100).toFixed(1) + "% with experience, " + (old * 100).toFixed(1) + "% without");
  assert.ok(own < old, "experience keeps people to a lane");
}

// d. Finds that build up.
{
  const w = People.create({ seed: 6, people: 200, era: "early" });   // where the fields still have things to find
  w.step(24 * 2);
  const p = grown(w).find(q => q.job === "farmer");
  p.lf.xp.fill(0); p.lf.xp[0] = 5;
  assert.equal(w.lives.practised(p, "smithing"), false, "a farmer cannot find what belongs to the smith's work");
  assert.equal(w.lives.practised(p, "plough"), true, "but can what belongs to the fields");
  let calls = 0;
  const known = p.know;
  while (p.know === known && calls < 50) { w.lives.findBuilds(p); calls++; }
  assert.ok(p.know !== known || p.lf.aim >= 0, "working toward something");
  if (p.know !== known) assert.ok(calls >= 1, "found after " + calls + " days' worth of work at one a day");
  /* A world's people working toward things: four months is too short for a find to be built up (a find takes
     about as many days of one person's work as the old daily chance said; README, "Finds that build up"), so
     what is held here is that the work is under way. */
  const y = People.create({ seed: 7, people: 300, era: "early", finds: 1 }); y.step(24 * 120);
  const aiming = y.people.filter(q => q.lf.aim >= 0);
  console.log("  after 120 days: " + aiming.length + " working toward something, " + aiming.filter(q => q.lf.prog > 0).length + " with headway, the furthest " + Math.round(Math.max(0, ...aiming.map(q => q.lf.prog)) * 100) + "% of the way; " + y.stats().finds + " found");
  assert.ok(aiming.length > 0, "people are working toward finds");
  for (const e of y.events.filter(e => e.kind === "found")) assert.ok(/days working toward it/.test(e.why), "each find says how it was built up");
}

// e. Why it happened.
{
  const w = People.create({ seed: 8, people: 100 });
  const p = grown(w)[0];
  for (let i = 0; i < 8; i++) w.lives.because(p, "test", "step " + i);
  const c = w.lives.chain(p.lf.why);
  assert.equal(c.length, 5, "a chain goes back five links");
  assert.deepEqual(c.map(l => l.text), ["step 3", "step 4", "step 5", "step 6", "step 7"], "oldest first");
  const y = People.create({ seed: 9, people: 400, factions: 3, neighbours: "enemies", era: "medieval" }); y.step(24 * 365);
  const with_ = y.events.filter(e => e.after);
  console.log("  a year's news with a chain of causes: " + with_.length + (with_[0] ? " — " + with_[0].text + " ← " + with_[0].after : ""));
  for (const e of with_) assert.ok(!/undefined|NaN/.test(e.after), "no link missing: " + e.after);
  console.log("world-builder lives with a history: off is the world after 15.11; heard of before known; experience and lanes; finds built up; chains of causes");
}
