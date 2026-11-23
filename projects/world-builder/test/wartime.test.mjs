// Wartime gear paid for or given, and a marriage of the watcher's choosing (TODO.md 15.5h,
// 2026-11-21). Ric: gear "must be payed for or donated. Nothings free"; "The marriage button is for
// me so I should have ultimate power".
//
// What is held:
//   1. a world with wars off is exactly the world it was before 15.5h;
//   2. at war, soldiers' gear comes from what the loyal give and what the treasury buys, and no
//      treasury goes below nothing;
//   3. the watcher can marry any grown-up of a ruled people to any grown-up of another, with no
//      refusal: a partner either had is left on their own, family cannot marry, a person of the
//      wrong people or a child is refused, and at war the marriage ends the war;
//   4. a people the watcher does not rule cannot be married off.
//
// node projects/world-builder/test/wartime.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

// 1. Wars off: the same world, every person and store, as the engine before 15.5h gave.
{
  const w = People.create({ seed: 5, war: false, people: 200, map: "small", harvestTax: 0, dirt: "fixed", health: "simple", sexes: "none", childwork: "none", housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old" });   // off: 15.5t's harvest tax changes the world
  w.step(24 * 20);
  let h = 0; const mix = x => { h = (h * 31 + (Math.round(x * 1e6) | 0)) % 2147483647; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.goods); mix(p.partner); mix(p.home); }
  for (const v of w.villages) { mix(v.goods); mix(v.food); mix(v.till); }
  assert.equal(h, 1663183778, "a world with wars off is the world it was before 15.5h");
}

// 2. At war: given and bought.
{
  let bought = 0, given = 0, armedGiven = 0, armed = 0, soldiers = 0;
  for (const seed of [11, 12]) {
    const w = People.create({ people: 300, map: "small", factions: 2, villages: 4, seed, soldiers: 0.12 });
    w.step(24); w.rule(0, true); w.declare(0, 1, "war"); w.rule(0, false);
    for (let d = 0; d < 120; d++) {
      w.step(24);
      for (const f of w.factions) assert.ok(f.treasury > -1e-6, "no treasury below nothing: " + f.treasury);
      for (const p of w.people) if (p.job === "soldier" && p.hp > 0) { soldiers++; if ((p.gear.weapon || 0) > 0 && (p.gear.shield || 0) > 0) armed++; }
    }
    const s = w.stats(); bought += s.armedBought; given += s.given; armedGiven += s.armedGiven;
  }
  assert.ok(bought > 1, "the treasury buys soldiers' gear: " + bought.toFixed(1));
  assert.ok(given > 1, "the loyal give what they can spare: " + given.toFixed(1));
  assert.ok(armedGiven > 0 && armedGiven <= given + 1e-9, "soldiers are armed from what was given, and no more than was given: " + armedGiven.toFixed(1) + " of " + given.toFixed(1));
  assert.ok(armed / soldiers > 0.85, "soldiers are armed: " + (100 * armed / soldiers).toFixed(0) + "% with a weapon and a shield (about 95% before)");
}

// 3 and 4. The marriage button.
{
  const w = People.create({ people: 200, map: "small", factions: 2, villages: 3, seed: 7 });
  w.step(24 * 3);
  const [f, o] = w.factions;
  const grown = g => w.people.filter(p => p.hp > 0 && p.f === g.id && w.adult(p) && p.id !== g.leader);
  const a = grown(f).find(p => p.partner), b = grown(o)[0], child = w.people.find(p => p.hp > 0 && p.f === o.id && !w.adult(p));
  assert.equal(w.declare(f.id, o.id, "wed", a.id, b.id), "", "a people nobody rules cannot be married off from the page");
  w.rule(f.id, true);
  assert.equal(w.declare(f.id, o.id, "wed", a.id, a.id), "no-wed", "one of each people");
  if (child) assert.equal(w.declare(f.id, o.id, "wed", a.id, child.id), "no-wed", "not a child");
  const was = w.byId.get(a.partner);
  assert.equal(w.declare(f.id, o.id, "wed", a.id, b.id), "wed", "any two grown-ups, and no refusal");
  assert.ok(a.partner === b.id && b.partner === a.id, "they are married");
  if (was) assert.equal(was.partner, 0, "the partner one of them had is left on their own");
  assert.deepEqual(f.rel[o.id].wed, [a.id, b.id], "it is 14d's marriage between the two peoples");
  assert.ok(w.events.some(e => e.kind === "wed" && e.text.includes("on your word") && !e.text.includes("great families")), "the news says it was your word, and not that they are of a great family");
  /* Kin: nobody starts a world with parents, so two grown-ups are made mother and child for the test. */
  {
    const w2 = People.create({ people: 200, map: "small", factions: 2, villages: 3, seed: 7 }); w2.step(24); w2.rule(0, true);
    const [m, k] = w2.people.filter(q => w2.adult(q) && q.f === 0 && q.id !== w2.factions[0].leader);
    k.mum = m.id; k.f = 1;
    assert.equal(w2.declare(0, 1, "wed", m.id, k.id), "kin", "family cannot marry");
  }
  /* At war, the marriage ends it. */
  w.declare(f.id, o.id, "war");
  assert.ok(f.rel[o.id].war, "at war");
  const c = grown(f).find(p => p !== a), d = grown(o).find(p => p !== b);
  assert.equal(w.declare(f.id, o.id, "wed", c.id, d.id), "wed-peace", "a marriage at war seals a peace");
  assert.ok(!f.rel[o.id].war && !o.rel[f.id].war, "and the war is over");
}

console.log("world-builder wartime: no war, no change; soldiers' gear given and bought; a marriage of your choosing, at peace and to end a war");
