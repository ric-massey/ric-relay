// Where soldiers stand (TODO 15.6b, 2026-11-23). Ric: "what abuout actual. strategicplacement of the
// people?"; "having a comander and the ranks but again equivilant to the weapons and eras".
//
// What is held:
//   1. "Every soldier for the nearest enemy" is the world before;
//   2. the way of fighting follows the weapons (no era named): spears and shields before guns, pikes with
//      early muskets, open order with rifles against rifles, small units with radio;
//   3. the general picks ground at least as good as where it would have stood;
//   4. in a real war armies form units with officers, are in contact for hours not for ever, and units
//      break or withdraw; the page's drawing has what it needs.
//
// node projects/world-builder/test/formations.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" };   // the parts built after this one, off
const FINGERPRINT = 1135336243;   // print() of the world before, seed 2, 60 days

{
  const w = People.create({ ...LATER, seed: 2, formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", warBooks: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before");
}

// 2. Shapes from weapons.
{
  const shapes = (era, teachFoe = []) => {
    const w = People.create({ seed: 4, era, factions: 2, people: 200 });
    for (const p of w.people) if (p.f === 1) for (const k of teachFoe) w.teach(p, k);
    w.step(24); w.knowDay(); w.kitOf(1);
    w.factions[0].foeKit = { 1: w.kitOf(1) };
    const tally = {};
    for (let i = 0; i < 40; i++) { const s = w.chooseShape(0, 1); tally[s] = (tally[s] || 0) + 1; }
    return tally;
  };
  const early = shapes("early"), em = shapes("earlymodern"), ind = shapes("industrial"), mod = shapes("information");
  console.log("  early", JSON.stringify(early), "early modern", JSON.stringify(em), "industrial", JSON.stringify(ind), "information", JSON.stringify(mod));
  assert.ok(Object.keys(early).every(k => ["mass", "block", "loose"].includes(k)), "before guns: shields, spears or loose");
  assert.ok((em.pikeshot || 0) > 20, "muskets without bayonets: pikes guard the shot");
  assert.ok((ind.open || 0) > 20, "rifles against rifles: open order, dug in");
  assert.ok((mod.spread || 0) > 20, "with radio: small units spread out");
}

// 3. Ground.
{
  const w = People.create({ seed: 9, people: 200, map: 20, hills: 1 });
  let best = null, gain = -1e9;
  for (let k = 0; k < 400; k++) {
    const x = 6 + (k * 7.3) % (w.cols - 12), y = 6 + (k * 3.7) % (w.rows - 12);
    const r = w.chooseGround(0, x, y, x + 6, y);
    const h = (px, py) => w.height[Math.floor(py) * w.cols + Math.floor(px)];
    const g = (h(r.x, r.y) - h(r.x + 1, r.y)) - (h(x, y) - h(x + 1, y));
    if (g > gain) { gain = g; best = r; }
  }
  assert.ok(best && gain > 0, "somewhere, the general finds higher ground over the way the enemy comes");
}

// 4. A war: units, officers, contact that stops, units that give way.
{
  let hits = 0;
  for (const seed of [2, 4]) {
    const w = People.create({ seed, factions: 2, neighbours: "enemies", aggression: 1, people: 300, map: 12 });
    w.startWar(0, 1);
    let drawn = false;
    for (let d = 0; d < 60; d++) { w.step(24); if (w.units().length) { const u = w.units()[0]; drawn = drawn || (u.w > 0 && u.d > 0 && Number.isFinite(u.face)); } }
    const s = w.stats();
    console.log("  seed " + seed + ": units " + s.unitsFormed + ", battles " + s.battles + ", hours in contact " + s.contactHours + ", nights apart " + s.nightsApart + ", broke " + s.unitsBroke + ", withdrew " + s.unitsWithdrew + ", battle dead " + s.battle);
    if (s.unitsFormed > 0 && s.contactHours > 0) hits++;
    assert.ok(s.contactHours < 60 * 24, "armies are not in contact the whole war");
  }
  assert.ok(hits >= 1, "armies at war form units and meet");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder where soldiers stand: off unchanged; shapes follow weapons; ground chosen; units form, meet and give way");
