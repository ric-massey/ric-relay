// Ruins and scavenging, grinding and baking (TODO 16, 2026-11-24). Ric's answers are in TODO.md, item 16.
//
// What is held:
//   1. with Buildings left alone "old", no scavenging and Grinding and baking "old", the world is the one
//      before item 16, exactly;
//   2. a building wears only while nobody is in it, stage by stage on the clock of its walls;
//   3. moving into a house gone past kept mends it first, for less than a new one;
//   4. a ruin's store rots by kind — grain within a year or two, stone never — and nothing is put in it;
//   5. scavengers find ruins they know of, carry what is there away, and stop once it is gone;
//   6. taking from another people's ruin is held against the takers as told, a wrong telling blaming the wrong ones;
//   7. a wall stands in peace while its place is lived in;
//   8. grinding by hand, at a rotary or a saddle quern, or at a mill; a common oven;
//   9. a world can start with places standing empty, nobody in them and what they held still there.
//
// node projects/world-builder/test/ruins.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const People = createRequire(import.meta.url)("../people.js");
const OFF = { ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" };
const OLD = 1060750917;   // print() of the world below before item 16
function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); mix(p.zeal || 0); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); mix(v.wall || 0); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}

if (!process.argv.includes("--bugs")) {
// 1. Off: the world before item 16.
{
  const w = People.create({ seed: 7, people: 200, factions: 3, neighbours: "enemies", era: "medieval", ...OFF }); w.step(24 * 60);
  assert.equal(print(w), OLD, "with item 16 off, the world before it exactly");
  assert.equal(w.buildings().length, 0, "and no buildings are kept");
}

// 2. Stages, by the walls' material.
{
  const w = People.create({ seed: 1, people: 40 }), Y = w.YEAR;
  const at = (years, stone) => w.stageOf({ built: true, left: -years * Y, stone: stone ? 1 : 0 });
  assert.equal(w.stageOf({ built: true, left: Infinity }), 0, "lived in: kept, whatever its age");
  assert.deepEqual([1, 4, 12, 25, 40, 70].map(y => at(y, false)), [0, 1, 2, 3, 4, 5], "timber: worn at 3 years, holed at 10, roofless at 20, fallen at 35, a mound at 60");
  assert.deepEqual([25, 100, 250, 600].map(y => at(y, true)), [3, 3, 4, 5], "stone walls stand roofless for centuries");
  const off = People.create({ seed: 1, people: 40, ruins: "old" });
  assert.equal(off.stageOf({ built: true, left: -100 * Y }), 0, "with the setting off nothing wears");
}

// 3. Moving in mends first, at a share of new; 9. a world started with places empty.
{
  const w = People.create({ seed: 5, people: 300, factions: 2, startRuined: "some", scavenge: false });
  const ruins = w.villages.filter(v => !v.alive);
  assert.ok(ruins.length >= 1, "some places stand empty (" + ruins.length + " of " + w.villages.length + ")");
  assert.ok(!w.people.some(p => ruins.some(r => r.id === p.home)), "nobody lives in them");
  assert.ok(w.factions.every(f => !f.alive || w.people.some(p => p.id === f.leader)), "every people still has a leader");
  const r = ruins[0], hs = w.homes.filter(h => h.v === r.id);
  assert.ok(hs.length > 0 && hs.every(h => h.n === 0), "their houses stand empty");
  assert.ok(w.ruins.worth(r.id) > 0 || r.goods >= 0, "what they held is still there, less what rotted");
  for (const h of hs) h.left = -25 * w.YEAR;   // a quarter-century gone: roofless or fallen
  w.ruins.day();
  const somebody = w.people.find(p => w.adult(p));
  const h = w.ruins.house(somebody.id, r.id), full = Math.round(h.len * h.wid * 250 * 250 * 2);
  assert.ok(!h.built && h.need > 0 && h.need < full, "a ruined house is work to mend, less than a new one (" + h.need + " hours against " + full + ")");
  assert.equal(somebody.waitHouse, h.id, "and the household waits on it");
}

// 4. A ruin's store rots by kind; nothing comes into it.
{
  const w = People.create({ seed: 5, people: 100, factions: 2, startRuined: "most", scavenge: false });   // nobody crowded out to found a place in it
  const r = w.villages.find(v => !v.alive);
  r.food = 400; r.stone = 30; r.goods = 20; r.iron = r.iron || 0;
  const was = { food: r.food, stone: r.stone, goods: r.goods };
  let rising = false, last = w.ruins.worth(r.id);
  for (let d = 0; d < 365; d += 5) { w.step(24 * 5); const now = w.ruins.worth(r.id); if (now > last + 1e-9) rising = true; last = now; }
  console.log("  a year in a ruin: grain " + was.food + " -> " + r.food.toFixed(1) + ", goods " + was.goods + " -> " + r.goods.toFixed(1) + ", stone " + was.stone + " -> " + r.stone);
  assert.ok(r.food < was.food * 0.1, "grain is mostly gone in a year");
  assert.ok(r.goods > was.goods * 0.85, "goods and tools last for years");
  assert.equal(r.stone, was.stone, "stone does not rot");
  assert.ok(!rising, "nothing ever comes into a ruin");
  assert.equal(r.resettled, undefined, "(and nobody settled in it)");
}

// 5. Scavenging: known, emptied, then over.
{
  const w = People.create({ seed: 5, people: 300, factions: 2, startRuined: "some" });
  const ruins = w.villages.filter(v => !v.alive);
  const sum = () => ruins.reduce((a, v) => a + w.ruins.worth(v.id), 0), start = sum();
  assert.ok(w.people.some(p => ruins.some(r => w.ruins.holds(p, r.id))), "the people near know of the empty places");
  let rising = false, last = start;
  for (let d = 0; d < 60; d++) { w.step(24); const now = sum(); if (now > last + 1e-9) rising = true; last = now; }
  const s = w.stats(), trips = s.scavTrips;
  console.log("  two months: ruins worth " + start.toFixed(0) + " -> " + last.toFixed(0) + ", " + trips + " trips, " + s.ruinTips + " told of a ruin, " + s.resettled + " settled in one");
  assert.ok(trips > 0 && s.scavenged > 0, "people went and carried things off");
  assert.ok(last < start * 0.2, "the ruins empty as they are searched");
  assert.ok(!rising, "and nothing is ever put in one");
  w.step(24 * 60);
  assert.ok(w.stats().scavTrips - trips <= 3, "once they are empty, scavenging stops (" + (w.stats().scavTrips - trips) + " trips in the next two months)");
  assert.ok(!w.people.some(p => p.task === "scavenge"), "and nobody is out scavenging");
}

// 6. Seen or heard: a grudge against whoever the telling names.
{
  const w = People.create({ seed: 5, people: 300, factions: 3, startRuined: "some", scavenge: false });
  const r = w.villages.find(v => !v.alive);
  const mine = w.factions[r.f], other = w.factions.find(f => f.alive && f.id !== r.f), third = w.factions.find(f => f.alive && f.id !== r.f && f !== other);
  const p = w.people.find(q => q.f === mine.id && w.adult(q));
  const op0 = mine.rel[other.id].op, op3 = mine.rel[third.id].op;
  w.ruins.looted(p.id, "People of " + other.name + " are carrying off what was left in " + r.name + ".");
  assert.ok(mine.rel[other.id].op < op0, "held against the people named");
  assert.equal(mine.rel[third.id].op, op3, "not against anybody else");
  w.ruins.looted(p.id, "People of " + third.name + " are carrying off what was left in " + r.name + ".");
  assert.ok(mine.rel[third.id].op < op3, "a wrong telling blames the wrong people");
  const q = w.people.find(x => x.f === other.id && w.adult(x)), op = w.factions[other.id].rel[mine.id].op;
  w.ruins.looted(q.id, "People of " + mine.name + " are carrying off what was left in " + r.name + ".");
  assert.equal(w.factions[other.id].rel[mine.id].op, op, "a ruin not one's own people's is no grievance");
  /* And taking makes the news, where it was. */
  const taker = w.people.find(x => x.f === other.id && w.adult(x));
  r.food = 200; taker.x = r.x; taker.y = r.y; taker.at = r.id;
  w.ruins.at(taker);
  assert.ok(taker.cargo && taker.cargo.what === "food" && taker.cargo.amount > 0, "a load taken");
  assert.ok(w.events.some(e => e.kind === "scavenged" && e.text.includes(r.name)), "and it is news at the ruin, for whoever sees it");
}

// 7. A wall stands in peace while its place is lived in.
{
  const run = opts => { const w = People.create({ seed: 4, people: 80, factions: 1, ...opts }); const v = w.villages.find(x => x.alive); v.wall = 1; w.step(24 * 500); return v.wall; };   // past the first year, which counts as a year since a raid
  const kept = run({}), old = run({ ruins: "old" });
  console.log("  a wall after 500 days of peace: " + kept.toFixed(2) + " lived in, " + old.toFixed(2) + " as before");
  assert.equal(kept, 1, "lived in, it stands");
  assert.ok(old < 0.97, "before item 16 it fell in about four years");
}

// 8. Grinding and baking.
{
  const w = People.create({ seed: 2, people: 120, era: "medieval" }), v = w.villages[0];
  const h = { v: v.id, n: 5 };
  v.millRun = false; v.mill = false; if (v.works) v.works.oven = null;
  const hand = w.ruins.breadHours(h);
  v.millRun = true; v.mill = true;
  const milled = w.ruins.breadHours(h);
  console.log("  a household of five: " + hand.toFixed(2) + " hours a day grinding, baking and cooking by hand, " + milled.toFixed(2) + " with the mill");
  assert.ok(Math.abs(hand - (1.25 + 1 + 1 + 0.5)) < 1e-9, "a rotary quern: an hour a day for five");
  assert.ok(Math.abs(hand - milled - (1 - 1 / 9)) < 1e-9, "a mill saves eight-ninths of the grinding");
  const early = People.create({ seed: 2, people: 120, era: "early" }), e = early.villages[0]; early.step(24 * 2); e.millRun = false; e.mill = false;   // what a people knows is read from the first day
  const sq = early.ruins.breadHours({ v: e.id, n: 5 });
  assert.ok(sq > hand, "without the iron age's rotary quern, grinding is slower (" + sq.toFixed(2) + " hours)");
}
console.log("ruins: ok");
}

// TODO 16c: exercise the actual private operations with controlled situations, without adding
// test-only doors to the shipped engine. Only the returned object's test hooks are inserted.
const source = readFileSync(process.env.PEOPLE_BUG_ENGINE || new URL("../people.js", import.meta.url), "utf8");
const anchor = "settings: S, cols: cols";
assert.equal(source.split(anchor).length, 2, "one engine return to instrument");
const instrumented = { exports: {} };
new Function("module", source.replace(anchor, `regression: { travel, newVillage, villageTurn, rehome, serve, sacrifice, count, die, census,
  rebucket, armyHour, ARMY, UNIT_OF }, ${anchor}`))(instrumented);
const Engine = instrumented.exports;
const failures = [];
const check = (name, f) => { try { f(); console.log("  16c: " + name); } catch (e) { failures.push(e); console.error("  16c FAILED: " + name + ": " + e.message); } };

check("caravans land on dry ground at coastal and lakeside markets", () => {
  const w = Engine.create({ seed: 1, people: 20, factions: 1, sea: 0, rivers: 0 }), r = w.regression;
  const p = w.people[0], v = w.villages[0];
  w.ground.fill(5); v.x = 10.05; v.y = 10.05;
  for (const kind of [0, 1]) {
    for (let y = 9; y <= 10; y++) for (let x = 9; x <= 10; x++) w.ground[y * w.cols + x] = kind;
    for (let i = 0; i < 20; i++) {
      r.travel(p, v, 2);
      assert.ok(w.ground[Math.floor(p.y) * w.cols + Math.floor(p.x)] > 1, "a caravan is never set down in sea or lake");
      assert.ok(Math.hypot(p.x - v.x, p.y - v.y) < 3, "lands beside the market");
      assert.equal(p.at, v.id); assert.equal(p.tx, p.x); assert.equal(p.ty, p.y);
      assert.ok(p.wait > 0, "the travel time still elapses");
    }
  }
});

check("empty settlements expire, but living founders protect their destination", () => {
  const w = Engine.create({ seed: 1, people: 20, factions: 1 }), r = w.regression;
  const v = r.newVillage(12, 12, 0);
  assert.equal(v.empty, 0, "new empty counter starts finite");
  const p = w.people.find(q => w.adult(q) && q.id !== w.factions[0].leader);
  r.rehome(p, v, "founded");
  for (let i = 0; i < 10; i++) r.villageTurn(v); // deliberately stale pop: party still away
  assert.ok(v.alive, "founders need no arrival deadline"); assert.equal(v.empty, 0);
  r.die(p, "old");
  for (let i = 0; i < 6; i++) r.villageTurn(v);
  assert.ok(v.alive, "six days of grace after the last founder dies");
  r.villageTurn(v); assert.equal(v.alive, false, "then a ruin");
  const moved = r.newVillage(14, 14, 0), q = w.people.find(q => q.hp > 0 && w.adult(q) && q.id !== w.factions[0].leader);
  r.rehome(q, moved, "founded"); r.rehome(q, w.villages[0], "moved");
  for (let i = 0; i < 7; i++) r.villageTurn(moved);
  assert.equal(moved.alive, false, "departed founders do not keep it alive either");
  const refuge = r.newVillage(16, 16, 0);
  refuge.gone = [q.id]; refuge.dangerAt = w.tick; refuge.empty = 6; q.fledFrom = refuge.id;
  r.villageTurn(refuge);
  assert.ok(refuge.alive, "a living refugee still protects their old place");
  assert.equal(refuge.empty, 0, "waiting days do not consume its grace period");
  r.die(q, "old");
  for (let i = 0; i < 7; i++) r.villageTurn(refuge);
  assert.equal(refuge.alive, false, "a dead refugee cannot keep it alive forever");
});

check("oven and mill take one toll per dwelling and conserve grain", () => {
  const w = Engine.create({ seed: 1, people: 40, factions: 1, villages: 1, era: "medieval" }), r = w.regression, v = w.villages[0];
  const grown = w.people.filter(p => w.adult(p)).slice(0, 3), [a, b, miller] = grown;
  for (const q of w.people) { q.age = grown.includes(q) ? 30 : 1; q.partner = 0; q.food = 100; }
  b.dwelling = a.dwelling; w.homes[a.dwelling].n = 3;
  miller.dwelling = w.homes.find(h => h.id !== a.dwelling && h.v === v.id).id; w.homes[miller.dwelling].n = 1;
  miller.job = "miller"; v.works = { oven: { built: true } };
  const total = () => v.food + w.people.reduce((s, p) => s + p.food, 0), before = total();
  w.workDay();
  assert.ok(Math.abs(r.count.ovenFee - 4 / 24) < 1e-9, "two households, four mouths, one daily oven share each");
  assert.equal(b.food, 100, "second single adult is not charged again");
  r.serve(miller, v);
  assert.ok(Math.abs(r.count.millToll - 4 * 0.5 / 16) < 1e-9, "one half-day mill share each");
  assert.equal(b.food, 100);
  assert.ok(Math.abs(total() - before) < 1e-9, "all grain reaches the store or miller");
});

check("a nearby superior enemy catches the army at its real centre", () => {
  const w = Engine.create({ seed: 1, people: 40, factions: 2, battle: "choice", truce: false, warBy: "era", sea: 0, rivers: 0 }), r = w.regression;
  const f = w.factions[0], o = w.factions[1], mine = w.people.filter(p => p.f === f.id).slice(0, 1), foes = w.people.filter(p => p.f === o.id).slice(0, 4);
  f.rel[o.id].war = true; o.rel[f.id].war = true;
  for (const [list, x] of [[mine, 30], [foes, 31]]) for (const p of list) { p.job = "soldier"; p.hp = 1; w.place(p, x, 30); }
  const unit = list => ({ members: list.map(p => p.id), lead: list[0].id, shape: "mass", role: "line", files: 1, size: list.length, coh: 1, still: 0, sx: list[0].x, sy: 30 });
  const u = unit(mine), eu = unit(foes), a = { units: [u], engaged: false, face: 0 };
  r.ARMY.set(f.id, a); r.ARMY.set(o.id, { units: [eu] });
  for (const p of mine) r.UNIT_OF.set(p.id, u);
  for (const p of foes) r.UNIT_OF.set(p.id, eu);
  r.rebucket();
  r.armyHour(a, f, o, { gen: f.leader, ready: true });
  assert.equal(r.count.battleCaught, 1, "enemy one tile away cannot be declined");
  assert.equal(r.count.battleDeclined, 0); assert.equal(a.engaged, true);
});

check("ritual deaths and every declared death cause have finite counters", () => {
  const w = Engine.create({ seed: 1, people: 40 }), r = w.regression;
  const v = w.villages[0], before = w.stats().sacrifices;
  r.sacrifice(v, { id: -1, name: "Test faith" });
  assert.equal(w.stats().sacrifices, before + 1); assert.equal(w.stats().sacrifice, 1);
  const finite = (obj, path = "stats") => { for (const [k, x] of Object.entries(obj)) { if (typeof x === "number") assert.ok(Number.isFinite(x), path + "." + k); else if (x && typeof x === "object") finite(x, path + "." + k); } };
  finite(w.stats());
  for (const [, cause] of source.matchAll(/die\([^\n;]*?, "([a-z]+)"/g)) assert.ok(Number.isFinite(w.stats()[cause]), "initialized death cause: " + cause);
});
if (failures.length) throw new AggregateError(failures, "TODO 16c regressions");
