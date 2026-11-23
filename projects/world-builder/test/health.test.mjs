// Wounds and old age (TODO.md 15.5e, 2026-11-21). Ric (2026-11-20): a bad wound can leave lasting
// harm, yes; the old slow down, yes; somebody who cannot work is looked after by their family.
//
// What is held:
//   1. with "Wounds and old age" at "simple" the world is the one 15.5r left, step for step;
//   2. a bad blow leaves a wound that heals over months, and some leave somebody lame for good;
//   3. the old slow down: full strength until about three-quarters of a lifetime, a fifth at the end;
//   4. strength is what work gives: a lame or old farmer reaps less, and nobody too frail works;
//   5. somebody too frail to work is fed by their grown children.
//
// node projects/world-builder/test/health.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const FINGERPRINT = 481523178;   // print() of 15.5r's engine, seed 2, 60 days

// 1. "Simple": the world before.
{
  const w = People.create({ seed: 2, health: "simple", sexes: "none", childwork: "none", housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "full strength until death is the world before 15.5e");
}

const w = People.create({ seed: 3 });
w.step(2);
const grown = w.people.filter(p => w.adult(p) && p.age < 40);

// 2. Wounds heal over months; some leave a mark for good.
{
  let lasting = 0, healed = 0;
  for (const p of grown.slice(0, 120)) {
    p.harm = 0; p.lame = 0;
    for (let k = 0; k < 6 && p.harm === 0; k++) w.wound(p, 0.45);   // a heavy blow, until one lasts
  }
  const hurt = grown.slice(0, 120).filter(p => p.harm > 0);
  assert.ok(hurt.length > 60, "heavy blows wound (" + hurt.length + " of 120)");
  const before = hurt.map(p => p.harm);
  w.step(24 * 30);
  const after = hurt.filter(p => p.hp > 0);
  for (const p of after) { if (p.harm > p.lame + 0.002) healed++; if (p.lame > 0) lasting++; }
  const mean0 = before.reduce((a, b) => a + b, 0) / before.length;
  const mean1 = after.reduce((a, p) => a + p.harm, 0) / Math.max(1, after.length);
  assert.ok(mean1 < mean0 * 0.85 && mean1 > mean0 * 0.3, "a month heals some of it, not all (" + mean0.toFixed(2) + " to " + mean1.toFixed(2) + ")");
  assert.ok(lasting > 0 && lasting < after.length * 0.6, "some are lame for good, most not (" + lasting + " of " + after.length + ")");
  w.step(24 * 300);
  const still = after.filter(p => p.hp > 0 && p.harm - p.lame >= 0.05);
  assert.ok(still.length <= after.length * 0.25, "within a year most wounds have healed as far as they will (" + still.length + " of " + after.length + " still healing, from new blows)");
}

// 3. Age.
{
  const life = 60, one = { age: 30 };
  assert.equal(w.ageVigour(one), 1, "full strength at 30");
  one.age = life * 0.75; assert.equal(w.ageVigour(one), 1, "and at three-quarters of a lifetime");
  one.age = life; const at60 = w.ageVigour(one);
  assert.ok(at60 > 0.4 && at60 < 0.6, "half as strong at 60 (" + at60.toFixed(2) + ")");
  one.age = life * 1.3; assert.ok(Math.abs(w.ageVigour(one) - 0.2) < 1e-9, "a fifth at the very end");
}

// 4. Strength is what work gives.
{
  const p = w.people.find(q => w.adult(q) && q.hp > 0);
  const keep = { harm: p.harm, lame: p.lame, vig: p.vig };
  p.vig = 1; const full = w.harvestCapacity(p);
  p.vig = 0.5; const half = w.harvestCapacity(p);
  assert.ok(Math.abs(half - full / 2) < 1e-9, "half the strength, half the reaping");
  Object.assign(p, keep);
  /* Nobody too frail works: twenty grown-ups lamed for good do no work for a fortnight. */
  const o = People.create({ seed: 5, people: 200 });
  o.step(2);
  const frail = o.people.filter(q => o.adult(q) && q.job !== "soldier").slice(0, 20);
  for (const q of frail) { q.lame = q.harm = 0.9; }
  const did = new Set();
  o.step(24);   // whatever they were already at, finished
  for (let h = 0; h < 24 * 14; h++) { o.step(1); for (const q of frail) if (q.hp > 0) did.add(q.chose); }
  for (const k of ["field", "cut", "quarry", "mine", "herd", "hunt", "fish", "make"]) assert.ok(!did.has(k), "the frail do no heavy work (" + k + ")");
}

// 5. The frail are fed by their grown children.
{
  /* a parent with a grown child in the same village, lamed for good, with nothing in the larder */
  const s = People.create({ seed: 6, ages: 0.8, people: 300 });
  s.step(2);
  /* nobody at the start has a grown child (the founders come without parents), so one is made one */
  const single = s.people.filter(q => s.adult(q) && !q.partner && q.job !== "soldier");
  const par = single[0], kid = single.find(q => q.home === par.home && q !== par && q.age < par.age - 15);
  assert.ok(kid, "two grown-ups of one village a generation apart");
  kid.mum = par.id; par.kids = 1;
  par.lame = par.harm = 0.9; par.food = 0; kid.food = 30;
  s.step(24 * 3);
  assert.ok(s.stats().keptOld > 0, "children feed a parent who cannot work (" + s.stats().keptOld.toFixed(1) + " days' food)");
  assert.ok(par.hp > 0.9 || par.hungry === 0, "and the parent does not go hungry");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder health: \"simple\" is the world before, wounds heal over months and some leave a mark for good, the old slow down, strength is what work gives, and the frail are fed by their children");
