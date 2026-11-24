// Armies spread out, and the deadliness slider (2026-11-22). Ric: "and this changes per era correct?
// and there is a slider to make them more dangerous", then "Yes, fix both": modern war killed about a
// tenth of a people a year, and the slider barely moved deaths above its default.
//
// What is held:
//   1. the default world is unchanged (hand weapons, the slider at 1);
//   2. with guns, blows land less often and none is harder than one and a half swords';
//   3. off, a machine gun lands as often as a sword and two and a half times as hard;
//   4. the slider makes each blow harder as well as more frequent.
//
// node projects/world-builder/test/dispersion.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 1906099303;   // print() of the world before (15.5i4 and armies that meet), seed 2, 60 days

{
  const w = People.create({ seed: 2, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before");
  const d = People.create({ ...LATER, seed: 2 });
  d.step(24 * 60);
  assert.equal(print(d), FINGERPRINT, "and on, the default world is the same: hand weapons, slider at 1");
}

{
  const blow = (era, extra = {}) => People.create({ ...LATER, seed: 3, era, ...extra }).blowOf(0);
  const sword = blow("medieval"), gun = blow("modern"), raw = blow("modern", { dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old" });
  console.log("  " + sword.arms + ": lands " + sword.chance.toFixed(3) + ", harm " + sword.harm.toFixed(2) + "; " + gun.arms + ": lands " + gun.chance.toFixed(3) + ", harm " + gun.harm.toFixed(2) + "; off " + raw.chance.toFixed(3) + ", " + raw.harm.toFixed(2));
  assert.ok(gun.chance < sword.chance && gun.harm <= 1.5 * 1.0001, "spread out: lands less often, no blow over one and a half swords'");
  assert.ok(raw.chance >= sword.chance && raw.harm > 2, "off: as before");
  const w = People.create({ ...LATER, seed: 3, era: "medieval" });
  const lo = w.blowOf(0, 0.3), mid = w.blowOf(0, 1), hi = w.blowOf(0, 3);
  console.log("  slider 0.3 / 1 / 3: harm " + lo.harm.toFixed(2) + " / " + mid.harm.toFixed(2) + " / " + hi.harm.toFixed(2));
  assert.ok(lo.harm < mid.harm && mid.harm < hi.harm && hi.chance > mid.chance, "the slider: harder and more often");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder armies spread out: default world unchanged; guns land less often and no harder than 1.5 swords; the slider works both ways");
