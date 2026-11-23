// Armies that meet (2026-11-22). Ric: "do the peoplle at war just run past each other to go to the
// cities?" — they did: a soldier saw an enemy only within 750 m, and nothing sent an army to meet
// another or to relieve a place of its own.
//
// What is held:
//   1. off, the world is the one 15.5i4 left, step for step;
//   2. a place of ours with their soldiers at it is relieved;
//   3. their army seen on the march is met when it is coming for a place of ours and the numbers suit;
//   4. an army not seen is not met.
//
// node projects/world-builder/test/meeting.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { dispersion: false, warBooks: "old", warBy: "era", formations: "nearest" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 1505646459;   // print() of 15.5i4's engine, seed 2, 60 days

{
  const w = People.create({ seed: 2, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before");
}

const make = () => {
  const w = People.create({ ...LATER, seed: 5, people: 500, factions: 2, villages: 4, war: true, aggression: 0, map: 30, bandits: false });
  w.step(24 * 2);
  w.startWar(0, 1);
  w.warMap(); w.campaign(0, 1);
  return w;
};
const theirs = w => w.people.filter(p => p.f === 1 && p.job === "soldier" && p.hp > 0);

// 2. Relief.
{
  const w = make(), c = w.campOf(w.factions[0])[1], u = w.villages.find(v => v.alive && v.f === 0);
  u.foes = 3; u.siege = 2;   // a siege, few enough for clearly better odds
  const went = w.meeting(0, 1);
  console.log("  " + u.name + " besieged: " + (went ? "the army marches to relieve it" : "nobody comes"));
  assert.ok(went && c.meet && Math.hypot(c.meet.x - u.x, c.meet.y - u.y) < 1, "relieved");
}

// 3 and 4. Their army on the march.
{
  const place = (w, x, y, n) => { const t = theirs(w).slice(0, n); for (const p of t) { w.place(p, x + (p.id % 3) * 0.4, y + (p.id % 2) * 0.4); p.task = "march"; } return t.length; };
  const mine = w => w.villages.find(v => v.alive && v.f === 0);
  const far = w => { const m = mine(w); let best = null, bd = 0; for (let x = 2; x < w.cols - 2; x += 4) for (let y = 2; y < w.rows - 2; y += 4) { const d = Math.min(...w.villages.filter(v => v.alive).map(v => Math.hypot(v.x - x, v.y - y))); if (d > bd) { bd = d; best = [x, y]; } } return best; };
  // seen: near one of our places, a few of them
  {
    const w = make(), m = mine(w);
    for (const v of w.villages) { v.foes = 0; v.siege = 0; }
    const n = place(w, m.x + 14, m.y, 4);
    const before = w.meeting(0, 1);   // seen, but not coming for us: kept clear of
    const tv = w.villages.find(v => v.alive && v.f === 1);
    w.campOf(w.factions[1])[0] = { v: tv.id, goal: m.id, ready: true, since: w.tick, cut: false, out: n };   // now their plan is one of ours
    const went = w.meeting(0, 1), c = w.campOf(w.factions[0])[1];
    assert.equal(before, false, "an army seen that is not coming for us is let be");
    console.log("  " + n + " of theirs marching 3.5 km from " + m.name + ": " + (went ? "met" : "kept clear of") + "; seen " + w.stats().armiesSeen);
    assert.ok(w.stats().armiesSeen >= 1 && went && c.meet, "seen and met");
  }
  // not seen: far from every place and soldier of ours
  {
    const w = make(), [x, y] = far(w);
    for (const v of w.villages) { v.foes = 0; v.siege = 0; }
    for (const p of w.people.filter(q => q.f === 0 && q.job === "soldier")) w.place(p, w.villages[p.home].x, w.villages[p.home].y);
    place(w, x, y, 4);
    const ok = Math.min(...w.villages.filter(v => v.alive && v.f === 0).map(v => Math.hypot(v.x - x, v.y - y))) > 22;
    if (ok) { w.meeting(0, 1); assert.equal(w.stats().armiesSeen, 0, "an army out of sight is not seen"); }
    console.log("  an army " + (ok ? "out of sight: not seen" : "(no spot out of sight on this land)"));
  }
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder armies that meet: off is the world before; relief; seen and met; unseen not met");
