// Weapons before gunpowder: bows, armour, chariots (TODO.md 15n, 2026-11-22). From 15k's research
// (Ric: "your leaving out wars from like the 1200s. or 1000bc and those eras and technologies").
//
// What is held:
//   1. with "Hand weapons alone" the world is the one 15m left, step for step;
//   2. a share of an army shoots, with the bow of its era (crossbow or longbow in the Middle Ages);
//   3. armour cuts a blow, and plate cuts an arrow more than a blow; a chariot is harder to hit;
//   4. the well-off soldier buys armour, the poor one goes without.
//
// node projects/world-builder/test/oldarms.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = {};   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 659234792;   // print() of 15m's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, oldArms: "plain" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15n");
}

const make = era => {
  const w = People.create({ ...LATER, seed: 5, people: 400, factions: 2, villages: 3, war: true, aggression: 0, map: 20, bandits: false, era });
  w.step(24);
  const soldiers = w.people.filter(p => p.hp > 0 && p.age >= 18);
  for (const p of soldiers.slice(0, 60)) { p.job = "soldier"; }
  return w;
};

// 2. Who shoots.
{
  const share = era => { const w = make(era), s = w.people.filter(p => p.job === "soldier"); const b = s.map(p => w.bowFor(p)).filter(Boolean); return [b.length / s.length, [...new Set(b.map(x => x.name))]]; };
  const [med, kinds] = share("medieval"), [early, ek] = share("early"), [bronze, bk] = share("bronze"), [mod] = share("earlymodern");
  console.log("  shooting: early " + Math.round(early * 100) + "% " + ek + "; Bronze Age " + Math.round(bronze * 100) + "% " + bk + "; medieval " + Math.round(med * 100) + "% " + kinds + "; early modern " + Math.round(mod * 100) + "%");
  assert.ok(med > 0.25 && med < 0.55 && kinds.every(k => k === "crossbows" || k === "longbows"), "medieval: about two in five, crossbows or longbows");
  assert.ok(early > 0.15 && early < 0.45 && ek.includes("bows"), "early farmers: simple bows");
  assert.ok(bk.includes("chariot archers") && bk.includes("composite bows"), "Bronze Age: composite bows, some from chariots");
  assert.equal(mod, 0, "with guns, nobody draws a bow");
}

// 3. What armour stops.
{
  const w = make("medieval"), s = w.people.filter(p => p.job === "soldier");
  const a = s[0], foe = s[1];
  foe.f = 1 - a.f;
  const hurt = (armour, shot) => { foe.gear.armour = armour; foe.hp = 1; w.strike(a, foe, 0.3, shot); return 1 - foe.hp; };
  const blow = hurt(0, 0), blowA = hurt(1, 0), arrow = hurt(0, 1), arrowA = hurt(1, 1);
  console.log("  a blow " + blow.toFixed(3) + ", on plate " + blowA.toFixed(3) + "; an arrow " + arrow.toFixed(3) + ", on plate " + arrowA.toFixed(3));
  assert.ok(blowA < blow * 0.5, "plate takes more than half of a blow");
  assert.ok(arrowA / arrow < blowA / blow, "and more of an arrow than of a blow");
  const b = make("bronze"), bs = b.people.filter(p => p.job === "soldier"), car = bs.find(p => b.chariot(p)), foot = bs.find(p => !b.chariot(p));
  const at = bs.find(p => p !== car && p !== foot);
  car.f = foot.f = 1 - at.f; car.gear = {}; foot.gear = {}; car.hp = 1; foot.hp = 1;
  b.strike(at, car, 0.3, 1); b.strike(at, foot, 0.3, 1);
  assert.ok(1 - car.hp < (1 - foot.hp) * 0.8, "a chariot is harder to hit");
}

// 4. The rich are armoured, the levy is not.
{
  const w = make("medieval"), v = w.villages.find(u => u.alive && u.f === 0);
  const [rich, poor] = w.people.filter(p => p.job === "soldier" && p.f === 0);
  v.goods = 60; v.iron = 60;
  for (const p of [rich, poor]) { w.place(p, v.x, v.y); p.food = 30; p.goods = 0; p.gear = {}; }
  rich.coins = 1000; poor.coins = 20;
  w.outfit(rich, v.id); w.outfit(poor, v.id);
  console.log("  armour: the well-off soldier " + (rich.gear.armour || 0) + ", the poor one " + (poor.gear.armour || 0));
  assert.equal(rich.gear.armour, 1, "the well-off buy armour");
  assert.ok(!(poor.gear.armour > 0), "the poor go without");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder bows, armour and chariots: off is the world before; who shoots; what armour stops; the rich armoured");
