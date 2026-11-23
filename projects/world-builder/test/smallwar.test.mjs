// Wounds measured, war between bands, and war at sea (TODO.md 15r, 2026-11-22). From 15k's gaps 8, 9, 10.
//
// What is held:
//   1. with "As before" the world is the one 15q left, step for step;
//   2. some soldiers badly wounded die of it days later, fewer with medicine; a light knock never;
//   3. a band at war raises no army: it raids;
//   4. a boat is robbed only by pirates, from further off than a cart; a port near an enemy boat is shut.
//
// node projects/world-builder/test/smallwar.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 2553129383;   // print() of 15q's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15r");
}

const make = (extra = {}) => {
  const w = People.create({ ...LATER, seed: 5, people: 500, factions: 2, villages: 4, war: true, aggression: 0, map: 20, bandits: false, ...extra });
  w.step(24 * 2);
  w.startWar(0, 1);
  return w;
};

// 2. Dying of wounds.
{
  const knock = (era, from = 0.5, base = 0.4) => {
    const w = make({ era }), a = w.people.find(p => p.f === 0 && p.job === "soldier" && p.hp > 0);
    const foes = w.people.filter(p => p.f === 1 && p.job === "soldier" && p.hp > 0);
    let n = 0, dying = 0;
    for (let i = 0; i < 2000; i++) { const q = foes[i % foes.length]; if (w.dying(q)) continue; q.hp = from; q.gear = {}; w.strike(a, q, base, 0); if (q.hp < 0.45 && q.hp > 0) { n++; if (w.dying(q)) dying++; } }
    return [n, dying, w];
  };
  const [n, dying, w] = knock("early"), [n2, d2] = knock("modern"), [n3, d3] = knock("early", 0.5, 0.08);
  console.log("  knocked out " + n + " times: " + dying + " will die of it (" + Math.round(dying / n * 100) + "%); with medicine " + d2 + " of " + n2 + " (" + Math.round(d2 / n2 * 100) + "%)");
  assert.ok(n > 20, "knocked out");
  console.log("  a light knock out of the line (life left about 0.4): " + d3 + " of " + n3 + " will die of it");
  assert.ok(dying / n > 0.15 && dying / n < 0.6, "a severe wound often kills later");
  assert.equal(d3, 0, "a light knock never does (calibrated 2026-11-22)");
  assert.ok(d2 / n2 < dying / n * 0.6, "far fewer with medicine");
  w.step(24 * 11); w.woundDeaths();
  assert.ok(w.stats().diedOfWounds > 0, "and do, days later");
}

// 3. Bands raid.
{
  const w = make({ era: "foragers" });
  if (w.bandAtWar(0)) {
    w.warMap(); w.campaign(0, 1);
    const c = w.campOf(w.factions[0])[1];
    console.log("  a band at war: army " + (c.ready ? "marches" : "does not march") + ", plan " + c.plan);
    assert.ok(!c.ready && c.plan === "raid", "no army, raids");
  } else console.log("  (no band in this world: foragers who farm)");
  const s = make({ era: "medieval" });
  assert.equal(s.bandAtWar(0), false, "a farming people is no band");
}

// 4. Pirates and a shut port.
{
  const w = make({ map: 30, villages: 4 });
  const [va, vb] = w.villages.filter(v => v.alive && v.f === 0), vc = w.villages.find(v => v.alive && v.f === 1);
  const carrier = w.people.find(p => p.home === va.id && p.hp > 0 && p.job !== "soldier");
  const rob = (boatHome, boatCargo, off) => {
    const q = w.people.find(p => p.home === vc.id && p.hp > 0 && p.job !== "soldier");
    w.villages[q.home].boat = boatHome;
    w.place(carrier, 10, 10); w.place(q, 10 + off, 10);
    carrier.cargo = { what: "food", amount: 20, boat: boatCargo }; carrier.coins = 10; carrier.task = "carry";
    const before = w.stats().waylaid; w.waylay(q, carrier, 0, 1, 1); return w.stats().waylaid - before;
  };
  const shoreOnBoat = rob(false, true, 1), pirateOnBoat = rob(true, true, 3), pirateOnCart = rob(true, false, 3);
  console.log("  a boat robbed from the shore: " + shoreOnBoat + "; by a pirate 750 m off: " + pirateOnBoat + "; a cart 750 m off: " + pirateOnCart + "; piracy " + w.stats().piracy);
  assert.equal(shoreOnBoat, 0, "nobody on the shore robs a boat");
  assert.equal(pirateOnBoat, 1, "pirates do, from further off");
  assert.equal(pirateOnCart, 0, "a cart is robbed only close by");
  vc.boat = true; vc.x = va.x + 5; vc.y = va.y;
  assert.ok(w.blockaded(va.id), "an enemy place with a boat nearby shuts the port");
  vc.boat = false;
  assert.ok(!w.blockaded(va.id), "without its boat, not");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder wounds, small wars and the sea: off is the world before; dying of wounds; bands raid; pirates; shut ports");
