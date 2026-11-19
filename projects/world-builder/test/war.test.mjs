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

/* Fear where the danger is, effort everywhere else (TODO 14a). Until 2026-11-19 a war anywhere
   frightened a whole faction, so it sat at home however far off the fighting was. */
{
  const w = People.create({ ...base, villages: 4 });
  const peace = w.people.filter(p => w.adult(p) && p.f === 0 && p.job !== "soldier");
  const calm = peace.map(p => w.urgency(p));
  war(w);
  w.step(24 * 4);
  const quiet = w.villages.filter(v => v.alive && v.f === 0 && v.siege === 0 && v.foes === 0 && w.stats().tick - v.raidAt > 4 * 24);
  assert.ok(quiet.length, "a village of the side at war with no enemy at its door");
  const home = w.people.filter(p => p.hp > 0 && w.adult(p) && quiet.some(v => v.id === p.home) && !p.hit && p.job !== "soldier");
  assert.ok(home.length > 5, "people at home there");
  const fear = home.reduce((s, p) => s + p.fear, 0) / home.length;
  assert.ok(fear < 0.2, "a war elsewhere does not frighten people at home (mean fear " + fear.toFixed(2) + ")");
  /* The same people want to provide more and rest less than before the war. */
  const i = peace.findIndex(p => home.includes(p));
  assert.ok(i >= 0, "somebody seen before and during the war");
  const p = peace[i], was = calm[i], now = w.urgency(p);
  assert.ok(now.provide > was.provide * 1.05 || now.provide >= 1.3, "at war, they want to provide more (" + was.provide.toFixed(3) + " -> " + now.provide.toFixed(3) + ")");
  /* A place under siege is frightened. */
  const v = quiet[0]; v.siege = 6;
  w.step(6);
  const there = w.people.filter(q => q.hp > 0 && w.adult(q) && q.home === v.id);
  assert.ok(there.reduce((s, q) => s + q.fear, 0) / there.length > 0.6, "a village under siege is afraid");
}

console.log("War: raised a few at a time, rations drawn and paid for, resupply only at home, the wounded go home; fear only where the fighting is.");
