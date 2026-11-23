// Generals and strategy (TODO.md 15o, 2026-11-22). Ric: who leads "Captain, else leader"; strategies
// "All five"; skill "Nature + experience". With 15k's gaps 2, 3, 4 and 14: morale, rout and pursuit;
// knowing the enemy only from scouts; horsemen; horse archers of the steppe.
//
// What is held:
//   1. with "No general" the world is the one 15n left, step for step;
//   2. the leader leads where there is no captain, and a general learns from battles;
//   3. a bold general seeks battle, a patient and timid one does not;
//   4. what a general knows of the enemy comes from what their people can see;
//   5. a broken army runs, and the running are cut down harder;
//   6. where a people has horses about one soldier in seven rides.
//
// node projects/world-builder/test/generals.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { siegecraft: "old", ransom: "old", smallWar: "old" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 2553129383;   // print() of 15n's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, generals: "none", siegecraft: "old", ransom: "old", smallWar: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15o");
}

const make = (extra = {}) => {
  const w = People.create({ ...LATER, seed: 5, people: 500, factions: 2, villages: 4, war: true, aggression: 0, map: 20, bandits: false, ...extra });
  w.step(24 * 2);
  w.startWar(0, 1);
  w.warMap(); w.campaign(0, 1);
  return w;
};

// 2. Who leads, and experience.
{
  const w = make(), f = w.factions[0], g = w.generalOf(0);
  assert.ok(g && (g.id === f.leader || (f.gov && g.id === f.gov.captain)), "the captain or the leader leads");
  const before = w.skillOf(g);
  for (let i = 0; i < 4; i++) { w.campOf(f)[1].routAt = -1e9; w.rout(0, 1); }
  console.log("  general " + g.name + ": skill " + before.toFixed(2) + ", after four battles " + w.skillOf(g).toFixed(2) + " (" + w.battlesOf(g.id) + " seen)");
  assert.ok(w.skillOf(g) > before, "a general learns from battles");
}

// 3. The plan by nature.
{
  const planFor = traits => {
    const w = make(), lead = w.people.find(p => p.id === w.factions[0].leader);
    Object.assign(lead, traits);
    const seen = new Set();
    for (let i = 0; i < 6; i++) seen.add(w.choosePlan(0, 1));
    return seen;
  };
  const bold = planFor({ bold: 1, patient: 0, greed: 0, temper: 0, curious: 0 });
  const timid = planFor({ bold: 0.7, patient: 1, greed: 0, temper: 0, curious: 0 });
  console.log("  a bold general: " + [...bold] + "; a patient one: " + [...timid]);
  assert.ok(bold.has("battle"), "the bold seek battle");
  assert.ok(!timid.has("battle") && [...timid].every(k => k === "wait" || k === "siege"), "the patient wait or besiege");
}

// 4. Scouting: only what can be seen.
{
  const w = make({ map: 60, villages: 8, people: 1200 }), f = w.factions[0];
  w.scout(0, 1);
  const intel = w.intelOf(0), seen = Object.keys(intel).map(Number), theirs = w.villages.filter(v => v.alive && v.f === 1);
  const own = w.villages.filter(v => v.alive && v.f === 0), soldiers = w.people.filter(p => p.f === 0 && p.hp > 0 && p.job === "soldier");
  for (const id of seen) {
    const v = w.villages[id];
    assert.ok(own.some(u => Math.hypot(u.x - v.x, u.y - v.y) < 12) || soldiers.some(p => Math.hypot(p.x - v.x, p.y - v.y) < 20), "seen by somebody of theirs");
  }
  console.log("  60 km: " + seen.length + " of " + theirs.length + " enemy places known");
  assert.ok(seen.length < theirs.length, "far places are not known");
  const far = theirs.find(v => !seen.includes(v.id));
  w.place(soldiers[0], far.x + 3, far.y + 3); w.scout(0, 1);
  assert.ok(w.intelOf(0)[far.id], "a scout who comes near sees it");
}

// 5. Rout and pursuit.
{
  const w = make(), f = w.factions[0];
  const mine = w.people.filter(p => p.f === 0 && p.job === "soldier" && p.hp > 0 && w.onCampaign(p));
  w.rout(0, 1);
  const running = mine.filter(p => w.routing(p));
  assert.ok(running.length >= mine.length * 0.9 && running.length > 0, "the army runs");
  assert.equal(w.campOf(f)[1].ready, false, "and does not march");
  const foe = running[0], at = w.people.find(p => p.f === 1 && p.job === "soldier" && p.hp > 0 && !w.horseman(p));
  foe.gear = {}; foe.hp = 1; w.strike(at, foe, 0.2, 0); const cut = 1 - foe.hp;
  const calm = mine.find(p => !w.routing(p)) || w.people.find(p => p.f === 0 && p.job === "soldier" && p.hp > 0 && !w.routing(p));
  calm.gear = {}; calm.hp = 1; calm.task = "patrol"; w.strike(at, calm, 0.2, 0); const plain = 1 - calm.hp;
  console.log("  a blow on one running " + cut.toFixed(3) + ", on one standing " + plain.toFixed(3));
  assert.ok(cut > plain * 2, "the running are cut down");
}

// 6. Horsemen.
{
  const w = make({ era: "medieval" });
  const s = w.people.filter(p => p.job === "soldier" && p.hp > 0);
  const share = s.filter(p => w.horseman(p)).length / s.length;
  const e = make(), none = e.people.filter(p => p.job === "soldier" && e.horseman(p)).length;
  console.log("  medieval horsemen: " + Math.round(share * 100) + "% of soldiers; early farmers without horses: " + none);
  assert.ok(share > 0.05 && share < 0.3 && none === 0, "horsemen where there are horses");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder generals: off is the world before; who leads and learns; plans by nature; scouting; rout and pursuit; horsemen");
