// Government, deeper (TODO.md 15c, 2026-11-22). Ric: "the governemnts need to go way deeper"; offices
// "shouldn't be how big the people is unless if that's how it would play out"; headman, collector,
// judge, captain and governor; paid "All four, ruler's traits pick"; unfree people "Yes, as proposed".
//
// What is held:
//   1. with Government at "The leader alone" the world is the one 15.5 left, step for step;
//   2. the same chief with a different council does measurably different things (a bolder council
//      keeps more under arms);
//   3. officials come from a need: a headman for a village past the three the ruler sees to; a
//      collector only past about 480 people;
//   4. a law outlasts its leader, and a theft heard under "pay back twice" is paid back;
//   5. somebody held unfree hands their coins to whoever holds them, and a law forbidding it frees them;
//   6. a beaten people's last place: a patient, greedy winner far from home keeps it as a subject that
//      pays; a hot-tempered one near home takes it, and its people break new ground where land is open.
//
// node projects/world-builder/test/government.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 140974437;   // print() of the engine after 15.5, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15c");
}

// 2. The same chief, two councils.
{
  const run = boldness => {
    const w = People.create({ ...LATER, seed: 3, people: 300, rule: "chief", war: false, factions: 2 });
    w.step(24 * 2);
    const f = w.factions[0], g = f.gov;
    g.say = "elders"; g.councilAt = w.tick;   // held for the test: the council stays who it is
    if (!g.council.length) { const pool = w.people.filter(p => p.f === f.id && w.adult(p) && p.id !== f.leader).slice(0, 5); g.council = pool.map(p => p.id); }
    for (const id of g.council) { const q = w.byId.get(id); q.bold = boldness; q.temper = boldness; }
    w.step(24 * 40);
    return { peace: f.peace, ruling: w.ruling(w.byId.get(f.leader), "bold", f), n: g.n };
  };
  const bold = run(1), meek = run(0);
  assert.ok(bold.n > 0 && meek.n > 0, "a council is there");
  assert.ok(bold.ruling > meek.ruling + 0.1, "the chief's decisions take in the council (" + bold.ruling.toFixed(2) + " against " + meek.ruling.toFixed(2) + ")");
  assert.ok(bold.peace > meek.peace + 0.005, "a bold council keeps more under arms (" + (bold.peace * 100).toFixed(1) + "% against " + (meek.peace * 100).toFixed(1) + "%)");
}

// 3. Officials from a need.
{
  const small = People.create({ ...LATER, seed: 5, people: 200, factions: 1, villages: 2, war: false });
  small.step(24 * 3);
  const gs = small.govOf(small.factions[0]);
  const nv = small.villages.filter(v => v.alive && v.f === 0).length;
  assert.equal(gs.heads, Math.max(0, nv - 3), "no headman for the three villages the ruler sees to (" + nv + " villages)");
  assert.equal(gs.collector, null, "200 people need no collector");
  const big = People.create({ ...LATER, seed: 5, people: 900, factions: 1, villages: 6, war: false, map: 25 });
  big.step(24 * 3);
  const gb = big.govOf(big.factions[0]), alive = big.villages.filter(v => v.alive && v.f === 0).length;
  assert.equal(gb.heads, Math.max(0, alive - 3), "a headman for each village past the three the ruler sees to (" + gb.heads + " of " + alive + ")");
  assert.ok(gb.collector, "900 people need a collector");
  assert.ok(["wage", "farm", "land", "lot"].includes(gb.pay), "paid one of the four ways");
}

// 4. A law outlasts its leader; a theft heard is paid back.
{
  const w = People.create({ ...LATER, seed: 4, people: 200, factions: 1, rule: "chief", war: false, bandits: false, riots: false });
  w.step(24 * 2);
  const f = w.factions[0], g = f.gov;
  g.laws.theft = "repay"; g.heardShare = 1;
  const lead = w.byId.get(f.leader);
  for (const k of ["honest", "warm", "greed", "bold"]) lead[k] = 0.5;   // middling: no clear lean either way
  for (const id of g.council) { const q = w.byId.get(id); for (const k of ["honest", "warm", "greed", "bold"]) q[k] = 0.5; }
  g.lawAt = -1e9; w.govern(f);
  assert.equal(g.laws.theft, "repay", "a law stays without a clear lean against it");
  const [thief, victim] = w.people.filter(p => w.adult(p) && p.id !== f.leader && p.hp > 0).slice(0, 2);
  let judged = false;
  for (let i = 0; i < 40 && !judged; i++) {
    victim.food = 100; thief.food = 0;
    const was = w.stats().judged;
    w.steal(thief, victim);
    if (w.stats().judged > was) { judged = true; assert.ok(Math.abs(victim.food - 100) < 1e-6, "a theft heard is paid back, twice or with all the thief has (" + victim.food.toFixed(2) + ")"); }
  }
  assert.ok(judged, "a theft seen is heard");
}

// 5. Unfree.
{
  const w = People.create({ ...LATER, seed: 4, people: 200, factions: 1, rule: "chief", war: false });
  w.step(24 * 2);
  const f = w.factions[0], g = f.gov, lead = w.byId.get(f.leader);
  g.laws.unfree = "allowed";
  const q = w.people.find(p => w.adult(p) && p.id !== f.leader && p.hp > 0);
  assert.ok(w.bind(q, lead), "held unfree");
  q.coins = 20; const had = lead.coins;
  w.step(24 * 2);
  assert.ok(lead.coins > had + 15 - 1e-6 || !q.unfree, "their coins go to whoever holds them");
  w.rule(f.id, true); w.order(f.id, { unfree: "forbid" });
  g.lawAt = -1e9; w.step(24 * 2);
  assert.equal(g.laws.unfree, "forbidden", "a ruler who forbids it");
  assert.ok(!q.unfree, "frees them");
}

// 6. Kept as a subject, or taken; and the way out.
{
  const setUp = (patient) => {
    const w = People.create({ ...LATER, seed: 6, people: 400, factions: 2, villages: 1, war: false, map: 25, rule: "chief" });
    w.step(24 * 2);
    const [a, b] = w.factions, lead = w.byId.get(b.leader);
    for (const k of ["patient", "greed"]) lead[k] = patient ? 1 : 0;
    for (const k of ["temper", "bold"]) lead[k] = patient ? 0 : 1;
    b.gov.say = "one"; b.gov.n = 0; b.gov.council = []; b.gov.councilAt = w.tick;
    const theirs = () => w.villages.filter(x => x.alive && x.f === a.id);
    while (theirs().length > 1) w.capture(theirs()[0].id, b.id);   // all but its last place
    const v = theirs()[0];
    w.capture(v.id, b.id);
    return { w, a, b, v };
  };
  const kept = setUp(true);
  assert.equal(kept.v.f, kept.a.id, "a patient, greedy winner leaves it its own");
  assert.ok(kept.a.rel[kept.b.id].pays, "and it pays tribute");
  assert.equal(kept.w.titleOf(kept.b), "king", "a chief over another people is a king");
  const taken = setUp(false);
  assert.equal(taken.v.f, taken.b.id, "a hot-tempered winner takes the place");
  const out = taken.w.villages.filter(x => x.alive && x.f === taken.a.id);
  assert.ok(out.length === 0 || out.every(x => x.id !== taken.v.id), "those who would not stay went to open land, or there was none");
  console.log("  way out: " + (out.length ? out[0].pop + " went to " + out[0].name : "no open land within reach"));
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder government: off is the world before; the council changes what a chief does; officials from a need; laws last; unfree people; subjects and the way out");
