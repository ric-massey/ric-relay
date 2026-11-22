// Children working (TODO.md 15.5m, 2026-11-21). Ric (2026-11-20): yes. Children did light farm work
// early — minding sheep, scaring birds, gleaning — and serious work from about twelve to fourteen.
//
// What is held:
//   1. with "Children working" at "none" the world is the one 15.5k left, step for step;
//   2. a child's share of a grown-up's day: nothing before seven, growing with them, a grown-up's
//      when grown;
//   3. children of seven and more go to the fields beside a parent, and herd near home; the little
//      ones do not, and what a child brings in is its share of a day.
//
// node projects/world-builder/test/childwork.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const FINGERPRINT = 595060821;   // print() of 15.5k's engine, seed 2, 60 days

// 1. None: the world before.
{
  const w = People.create({ seed: 2, childwork: "none", housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "\"Nothing until grown\" is the world before 15.5m");
}

const w = People.create({ seed: 3, people: 400, start: "summer", standing: 1 });
w.step(2);

// 2. The share of a day.
{
  const kid = { age: 5, job: "child" };
  assert.equal(w.childShare(kid), 0, "nothing at five");
  kid.age = 7.5; const seven = w.childShare(kid);
  kid.age = 12; const twelve = w.childShare(kid);
  kid.age = 13.9; const last = w.childShare(kid);
  assert.ok(seven > 0 && seven < 0.15, "a little at seven (" + seven.toFixed(2) + ")");
  assert.ok(twelve > 0.4 && twelve < 0.6, "about half at twelve (" + twelve.toFixed(2) + ")");
  assert.ok(last <= 0.7 && last > 0.6, "seven-tenths just before grown (" + last.toFixed(2) + ")");
  kid.age = 14; assert.equal(w.childShare(kid), 1, "a grown-up's when grown");
  const p = w.people.find(q => !w.adult(q) && q.age >= 9);
  const share = w.childShare(p);
  p.job = "child";
  const cap = w.harvestCapacity(p);
  p.job = "farmer"; const full = w.harvestCapacity(p); p.job = "child";
  assert.ok(Math.abs(cap - full * share) < 1e-9, "a child reaps its share of a day");
}

// 3. Out at work, in the summer.
{
  const seen = { old: new Set(), young: new Set() };
  for (let h = 0; h < 24 * 30; h++) {
    w.step(1);
    for (const p of w.people) if (!w.adult(p) && p.hp > 0 && (p.chose === "field" || p.chose === "herd")) (p.age >= 7 ? seen.old : seen.young).add(p.id);
  }
  assert.ok(seen.old.size > 5, "children of seven and more go out to work (" + seen.old.size + ")");
  assert.equal(seen.young.size, 0, "the little ones do not");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder children working: \"none\" is the world before, a child's share grows from seven to grown, and children of seven and more go to the fields and the herd");
