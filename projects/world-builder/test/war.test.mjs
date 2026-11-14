/* WAR HAS TO BE FED
   ────────────────────────────────────────────────────────────────────────
   Ric, 2026-11-14: military reach should depend on food carried and access to
   resupply, distance from friendly settlements, equipment replacement, the farm
   labour lost to recruitment, and recovery after losses. Before that date an
   army was raised whole the day a war began, marched on nothing, and could sit
   under a village's walls through a hard winter; measured on forced wars, a
   winter war took villages as readily as a spring one. These check the pieces.

   Run it:  node projects/world-builder/test/war.test.mjs  (~30s) */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const base = { people: 200, map: "small", factions: 2, villages: 3, seed: 11, soldiers: 0.12 };
const war = w => { w.rule(0, true); w.declare(0, 1, "war"); w.rule(0, false); };

/* An army is raised a few at a time, not whole the day war begins. */
{
  const w = People.create(base);
  w.step(1);
  const before = w.factions.map(f => f.soldiers);
  war(w);
  w.step(24);
  w.factions.forEach((f, i) => assert.ok(f.soldiers - before[i] <= Math.max(1, Math.round(f.adults * 0.02 / 7)) + 1,
    "a faction raised " + (f.soldiers - before[i]) + " soldiers in a day"));
}

/* Rations are drawn before marching, paid by the treasury, and no coin is
   made or lost doing it. */
{
  const w = People.create(base), money = w.stats().money;
  war(w);
  w.step(24 * 6);
  assert.ok(w.stats().rations > 0, "soldiers drew rations for the campaign");
  assert.ok(Math.abs(w.stats().money - money) < 1e-6, "provisioning conserves coins");
  const marching = w.people.filter(p => p.job === "soldier" && p.task === "march");
  for (const p of marching) assert.ok(p.food > 0 || p.supplyRun, "nobody marches on an empty pack");
}

/* In the field and out of food: back to the nearest village of their own. */
{
  const w = People.create(base);
  war(w);
  w.step(24 * 3);
  const s = w.people.find(p => p.job === "soldier" && w.adult(p));
  assert.ok(s, "there is a soldier");
  const enemy = w.villages.find(v => v.alive && v.f !== s.f);
  s.x = enemy.x; s.y = enemy.y; s.tx = s.x; s.ty = s.y; s.task = "march"; s.food = 0.1; s.wait = 0; s.hp = 1;
  w.advance(2);
  const own = w.villages.filter(v => v.alive && v.f === s.f);
  const nearest = Math.min(...own.map(v => Math.hypot(v.x - s.tx, v.y - s.ty)));
  assert.ok(nearest < 2, "a hungry soldier in enemy country heads for the nearest village of their own");
}

/* The wounded go home to heal rather than fight. */
{
  const w = People.create(base);
  war(w);
  w.step(24 * 2);
  const s = w.people.find(p => p.job === "soldier" && w.adult(p));
  const enemy = w.villages.find(v => v.alive && v.f !== s.f);
  s.x = enemy.x; s.y = enemy.y; s.tx = s.x; s.ty = s.y; s.task = "march"; s.food = 5; s.wait = 0; s.hp = 0.3;
  w.advance(2);
  const home = w.villages[s.home];
  assert.ok(Math.hypot(home.x - s.tx, home.y - s.ty) < 2, "a badly wounded soldier goes home");
}

console.log("War: raised a few at a time, rations drawn and paid for, resupply only at home, the wounded go home.");
