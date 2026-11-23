// Who marries whom (TODO.md 15b, 2026-11-22). Ric: "dont people who marry marry in similarry pay
// ranges?"; "The marriage thing should be decided through the stats."
//
// What is held:
//   1. with "Whoever likes each other" the world is the one 15g left, step for step;
//   2. customs come from the stats of those with the say: a stubborn, patient, greedy people's
//      families arrange far more than a curious, easy one's;
//   3. families who decide say no to a match far beneath them, and not to one of like standing;
//   4. the families' own matches pair like with like: the correlation of the two families' wealth
//      is well above the same people paired at random;
//   5. a widow takes a third, and under "the eldest son" the eldest son the rest.
//
// node projects/world-builder/test/marriage.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 2193699208;   // print() of 15g's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15b");
}

const w = People.create({ ...LATER, seed: 4, people: 600, unequal: 0.9, rule: "chief", factions: 2, war: false, map: 20 });
w.step(24 * 2);
const [fa, fb] = w.factions;

// 2. Customs from the stats.
{
  const set = (f, v) => { const l = w.byId.get(f.leader); Object.assign(l, v); f.gov.say = "one"; f.gov.n = 0; f.gov.council = []; f.gov.councilAt = w.tick; };
  set(fa, { stub: 1, patient: 1, greed: 1, curious: 0 });
  set(fb, { stub: 0, patient: 0, greed: 0, curious: 1 });
  const a = w.marriageDay(fa.id), b = w.marriageDay(fb.id);
  assert.ok(a.arranged > b.arranged + 0.5, "the stubborn, patient and greedy arrange (" + a.arranged.toFixed(2) + " against " + b.arranged.toFixed(2) + ")");
}

// 3. Families say no to a match far beneath them.
{
  fa.match.arranged = 1;
  const pool = w.people.filter(p => p.f === fa.id && w.adult(p) && p.hp > 0 && p.age >= 26 && p.age < 45);
  const rich = pool.slice().sort((x, y) => w.worth(y) - w.worth(x))[0], poor = pool.slice().sort((x, y) => w.worth(x) - w.worth(y))[0];
  const like = pool.filter(p => p !== rich).sort((x, y) => Math.abs(w.worth(x) - w.worth(rich)) - Math.abs(w.worth(y) - w.worth(rich)))[0];
  let downNo = 0, likeNo = 0;
  for (let i = 0; i < 200; i++) { if (!w.wouldWed(rich, poor)) downNo++; if (!w.wouldWed(rich, like)) likeNo++; }
  assert.ok(downNo > likeNo + 40, "far beneath them: no " + downNo + " times in 200; of like standing: " + likeNo);
}

// 4. Like with like.
{
  /* A generation of singles: everybody grown, unpaired, so the families have somebody to match. */
  for (const p of w.people) if (w.adult(p)) p.partner = 0;
  w.wedWealth.length = 0;   // only the families own matches, from here
  for (let d = 0; d < 300; d++) { w.marriageDay(fa.id); w.marriageDay(fb.id); }
  const pairs = w.wedWealth.slice();
  assert.ok(pairs.length >= 10, "families arranged matches (" + pairs.length + ")");
  const r = corr(pairs);
  let rnd = 0; for (let k = 0; k < 40; k++) { const ys = shuffle(pairs.map(p => p[1]), k); rnd += corr(pairs.map((p, i) => [p[0], ys[i]])); }
  rnd /= 40;
  console.log("  " + pairs.length + " matches: the families' wealth correlates " + r.toFixed(2) + ", at random " + rnd.toFixed(2));
  assert.ok(r > rnd + 0.3, "the rich marry the rich and the poor the poor");
}

// 5. Who inherits.
{
  fa.match.inherit = "eldest";
  const dad = w.people.find(p => p.f === fa.id && p.hp > 0 && p.partner && w.people.filter(q => q.dad === p.id && q.hp > 0).length >= 2 && w.byId.get(p.partner));
  if (dad) {
    const kids = w.people.filter(q => q.dad === dad.id && q.hp > 0).sort((x, y) => y.age - x.age);
    const sons = kids.filter(q => q.sex === 1), eldest = (sons.length ? sons : kids)[0], mate = w.byId.get(dad.partner);
    const had = { e: eldest.coins, m: mate.coins, o: kids.filter(k => k !== eldest).map(k => k.coins) };
    dad.coins = 90;
    w.kill(dad);
    assert.ok(Math.abs(mate.coins - had.m - 30) < 1e-6, "the widow takes a third");
    assert.ok(Math.abs(eldest.coins - had.e - 60) < 1e-6, "the eldest son the rest");
    assert.deepEqual(kids.filter(k => k !== eldest).map(k => k.coins), had.o, "the others nothing");
  } else console.log("  (no father of two with a wife living in this world: inheritance not checked)");
}

function corr(ps) {
  const n = ps.length, lx = ps.map(p => Math.log(1 + Math.max(0, p[0]))), ly = ps.map(p => Math.log(1 + Math.max(0, p[1])));
  const mx = lx.reduce((a, b) => a + b) / n, my = ly.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (lx[i] - mx) * (ly[i] - my); sxx += (lx[i] - mx) ** 2; syy += (ly[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}
function shuffle(a, seed) { let s = seed * 2654435761 + 1; for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder marriage: off is the world before; customs from the stats; families refuse a match beneath them; like marries like; the widow's third and the eldest son");
