// Land as property (TODO 15.7, 2026-11-23). Ric: "can we look at owned land? how realistic is the
// proipertyy side of things?", then "all 6 of those things need to go somewhere right?"
//
// What is held:
//   1. "as before" is the old land, exactly (a families' world, fingerprinted before 15.7);
//   2. a household in want pledges a field to the household with most to spare, and redeems it when it can pay;
//   3. a holding passes on to the children's houses when the last of a couple dies;
//   4. a village's bounds do not shrink when its people do;
//   5. the land round a village is claimed by its people, and a stranger working it pays or is held to wrong them;
//   6. an official paid in land is given fields for as long as the office, and they go back after;
//   7. a greedy chief encloses the commons.
//
// node projects/world-builder/test/property.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const OLD = 2621592913;   // print() of the world below before 15.7

assert.equal(print(People.create({ seed: 3, people: 200, land: "family", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old" }), 1500), OLD, "\"as before\" is the old land, exactly");

const make = (o) => { const w = People.create(Object.assign({ seed: 3, people: 200, land: "family", factions: 2, war: false }, o)); w.step(24 * 32); return w; };
{
  const w = make({});
  const v = w.villages.find(u => u.alive && w.homes.some(h => h.v === u.id && h.fields && h.n > 0));
  const mine = w.homes.filter(h => h.v === v.id && h.built && h.n > 0 && h.fields && h.fields.length);
  const poor = mine[0], rich = mine.find(h => h !== poor);
  const of = h => w.people.filter(p => p.hp > 0 && p.dwelling === h.id);
  for (const p of of(poor)) { p.food = 0; p.coins = 0; }
  for (const p of of(rich)) p.coins = 5000;
  const had = poor.fields.length;
  w.landMonth(v.id);
  assert.ok(w.pledges.size > 0, "a household in want pledges a field");
  const [i, e] = [...w.pledges].find(([, e]) => e.from === poor.id);
  assert.equal(e.to, rich.id, "to the household with most to spare");
  assert.equal(w.held.get(i), rich.id, "the lender holds and reaps it");
  assert.equal((poor.fields || []).length, had - 1);
  assert.ok(e.until > w.tick, "for three years at most");
  for (const p of of(poor)) { p.coins = 3000; p.food = 100; }
  w.landMonth(v.id);
  assert.equal(w.held.get(i), poor.id, "paid back, it is theirs again");
  assert.ok(!w.pledges.has(i));
  console.log("  pledged and redeemed: " + JSON.stringify(w.landView()));
}
{
  const w = make({});
  const h = w.homes.find(o => o.built && o.n > 0 && o.fields && o.fields.length >= 2);
  const p = w.people.find(q => q.hp > 0 && q.dwelling === h.id && w.adult(q));
  const other = w.homes.find(o => o !== h && o.built && o.n > 0 && o.v === h.v);
  const kid = w.people.find(q => q.hp > 0 && q.dwelling === other.id && w.adult(q));
  for (const q of w.people) if (q.dwelling === h.id && q !== p) q.partner = q.partner === p.id ? 0 : q.partner;
  p.partner = 0; kid.mum = p.id; kid.dad = 0;
  for (const q of w.people) if (q !== kid && (q.mum === p.id || q.dad === p.id)) { q.mum = 0; q.dad = 0; }
  const fields = h.fields.slice();
  w.kill(p);
  assert.ok(fields.every(i => w.held.get(i) === other.id), "the holding goes to the only child's house");
}
{
  const w = make({}), old = make({ property: "old" });
  const pick = x => x.villages.find(u => u.alive && u.pop > 30);
  for (const x of [w, old]) { const v = pick(x); x.r0 = v.radius; let n = 0; for (const p of x.people) if (p.hp > 0 && p.home === v.id && n++ % 2) x.kill(p); x.step(48); x.r1 = v.radius; }
  assert.ok(w.r1 >= w.r0, "bounds stay put (" + w.r0.toFixed(2) + " -> " + w.r1.toFixed(2) + ")");
  assert.ok(old.r1 < old.r0, "as before, they shrank (" + old.r0.toFixed(2) + " -> " + old.r1.toFixed(2) + ")");
}
{
  const w = make({});
  const v = w.villages.find(u => u.alive), cols = w.cols;
  const i = Math.floor(v.y) * cols + Math.floor(v.x + v.radius + 3);
  if (w.claimAt(i) >= 0) assert.equal(w.claimAt(i), v.f, "the land just past a village's fields is its people's");
  const y = People.create({ seed: 3, people: 200, land: "family", factions: 3, war: false }); y.step(24 * 300);
  const s = y.stats();
  assert.ok(s.tolls + s.trespass > 0, "strangers pay to use claimed land, or are held to wrong its people (" + s.tolls + " tolls, " + s.trespass + " trespasses)");
}
{
  const w = make({ rule: "chief" });
  const f = w.factions[0], g = f.gov, v = w.villages.find(u => u.alive && u.f === 0);
  const q = w.people.find(p => p.hp > 0 && p.home === v.id && w.adult(p) && p.dwelling >= 0 && p.id !== f.leader && w.homes[p.dwelling].v === v.id);
  g.pay = "land"; g.judge = q.id;
  w.landMonth(v.id);
  const mine = [...w.grants].filter(([, e]) => e.by === q.id);
  assert.equal(mine.length, 3, "an official paid in land holds three fields");
  assert.ok(mine.every(([i]) => w.held.get(i) === q.dwelling));
  g.judge = 0;
  w.landMonth(v.id);
  assert.equal([...w.grants].filter(([, e]) => e.by === q.id).length, 0, "and they go back with the office");
  const lead = w.people.find(p => p.id === f.leader); lead.greed = 1;
  for (let k = 0; k < 400 && !v.enclosed; k++) w.landMonth(v.id);
  assert.ok(v.enclosed, "a greedy chief encloses the commons");
}

function print(w, hours) {
  w.step(hours);
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder land as property: old land unchanged; pledged and redeemed; inherited; bounds kept; claims and tolls; grants for the office; enclosure");
