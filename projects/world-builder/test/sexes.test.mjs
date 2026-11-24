// Men and women (TODO.md 15.5l, 2026-11-21). Ric (2026-11-20): "pregnant women can't farm as well and
// might not be as strong. And there should be some societal stuff too"; couples of two men or two
// women "If society believes it's ok".
//
// What is held:
//   1. with "Men and women" at "Nobody is either" the world is the one 15.5e left, step for step;
//   2. about half are women; couples at the start are a woman and a man, and she is the mother;
//   3. a child is carried nine months and born to its mother, who works lighter at the end and lies in;
//   4. women are weaker at the heaviest work, each their own;
//   5. a people's customs come from its nature: a stubborn, bold people keeps women from the fields
//      more than an open, timid one, and women there go to the fields less than men;
//   6. two men or two women pair as far as their people accepts it, and have no child of their own.
//
// node projects/world-builder/test/sexes.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const FINGERPRINT = 1415857757;   // print() of 15.5e's engine, seed 2, 60 days

// 1. Nobody is either: the world before.
{
  const w = People.create({ seed: 2, sexes: "none", childwork: "none", housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "\"Nobody is either\" is the world before 15.5l");
}

const w = People.create({ seed: 3, people: 600 });

// 2. Half are women; couples are a woman and a man; the mother is a woman.
{
  const women = w.people.filter(p => p.sex === 0).length / w.people.length;
  assert.ok(women > 0.42 && women < 0.58, "about half are women (" + women.toFixed(2) + ")");
  const couples = w.people.filter(p => p.partner && p.sex === 0);
  assert.ok(couples.length > 40, "couples at the start (" + couples.length + ")");
  for (const p of w.people) if (p.partner) { const q = w.people.find(x => x.id === p.partner); assert.notEqual(q.sex, p.sex, "a woman and a man"); }
  for (const c of w.people) if (c.mum) { const m = w.people.find(x => x.id === c.mum); if (m) assert.equal(m.sex, 0, "a child's mother is a woman"); }
  assert.ok(w.people.some(p => p.due > 0), "some start carrying a child");
}

// 3. Nine months, then born to its mother; lighter work at the end, and lying in.
{
  const mum = w.people.find(p => p.sex === 0 && p.partner && !(p.due > 0) && w.adult(p));
  const dad = w.people.find(p => p.id === mum.partner);
  const kidsBefore = mum.kids;
  mum.due = w.tick + 266 * 24; mum.babyDad = dad.id;
  const b0 = w.brawn(mum);
  w.step(24 * 220);
  if (mum.hp > 0) {
    assert.ok(w.brawn(mum) < b0 * 0.5, "the last weeks are light work (" + w.brawn(mum).toFixed(2) + " against " + b0.toFixed(2) + ")");
    assert.equal(mum.kids, kidsBefore, "not born early");
    w.step(24 * 50);
    if (mum.hp > 0) {
      assert.equal(mum.kids, kidsBefore + 1, "born at nine months");
      const baby = w.people.find(c => c.mum === mum.id && c.age < 0.2);
      assert.ok(baby, "to its mother");
      assert.ok(mum.lying > w.tick, "who lies in");
    }
  }
}

// 4. Women are weaker at the heaviest work.
{
  const str = s => { const l = w.people.filter(p => p.sex === s && !(p.due > 0) && !(p.lying > w.tick)); return l.reduce((a, p) => a + w.brawn(p), 0) / l.length; };
  const m = str(1), f = str(0);
  assert.ok(f < m * 0.92 && f > m * 0.75, "women at heavy work about five-sixths of men (" + f.toFixed(2) + " against " + m.toFixed(2) + ")");
}

// 5. Customs from a people's nature.
{
  const own = "1.stubborn=0.9,1.bold=0.9,2.stubborn=0.1,2.bold=0.1";
  const c = People.create({ seed: 4, people: 600, factions: 2, own: own, war: false });
  c.step(2);
  const hard = c.split(0), easy = c.split(1);
  assert.ok(hard > easy + 0.4, "a stubborn, bold people keeps women from the fields more (" + hard.toFixed(2) + " against " + easy.toFixed(2) + ")");
  assert.ok(!c.people.some(p => p.f === 0 && p.sex === 0 && p.job === "soldier"), "no woman is a soldier there");
  /* In a farming world of such peoples, of the hours spent at work, women spend fewer at the heavy work. */
  const all = "1.stubborn=0.9,1.bold=0.9,2.stubborn=0.9,2.bold=0.9,3.stubborn=0.9,3.bold=0.9,4.stubborn=0.9,4.bold=0.9";
  const d = People.create({ seed: 1, people: 600, own: all, war: false });
  const HEAVY = new Set(["field", "cut", "quarry", "mine", "hunt"]), WORK = new Set([...HEAVY, "herd", "fish", "make", "carry", "market"]);
  const heavy = [0, 0], work = [0, 0];
  for (let h = 0; h < 24 * 20; h++) {
    d.step(1);
    if (h % 3) continue;
    for (const p of d.people) if (d.adult(p) && p.job !== "soldier" && WORK.has(p.chose)) { work[p.sex]++; if (HEAVY.has(p.chose)) heavy[p.sex]++; }
  }
  const wf = heavy[0] / work[0], mf = heavy[1] / work[1];
  assert.ok(wf < mf, "there women's work is less of it heavy than men's (" + wf.toFixed(2) + " against " + mf.toFixed(2) + ")");
}

// 6. Couples of one sex, as their people accepts them; no child of their own.
{
  const open = People.create({ seed: 5, people: 800, own: "1.warm=0.9,1.stubborn=0.1,2.warm=0.9,2.stubborn=0.1,3.warm=0.9,3.stubborn=0.1,4.warm=0.9,4.stubborn=0.1" });
  open.step(2);
  assert.ok(open.accepts(0) > 0.9, "a warm, open people accepts them (" + open.accepts(0).toFixed(2) + ")");
  const shut = People.create({ seed: 5, people: 800, own: "1.warm=0.1,1.stubborn=0.9" });
  shut.step(2);
  assert.ok(shut.accepts(0) < 0.15, "a cold, set people hardly at all (" + shut.accepts(0).toFixed(2) + ")");
  open.step(24 * 200);
  assert.ok(open.stats().sameCouples > 0, "two men or two women pair (" + open.stats().sameCouples + ")");
  for (const p of open.people) if (p.partner) { const q = open.people.find(x => x.id === p.partner); if (q && q.sex === p.sex) assert.ok(!(p.due > 0) && !(q.due > 0), "and carry no child of their own"); }
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder men and women: \"none\" is the world before, half are women, a child is carried nine months by its mother, women are weaker at heavy work, customs come from a people's nature, and couples of one sex form as far as their people accepts them");
