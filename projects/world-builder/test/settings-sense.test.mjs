/* SETTINGS THAT MEAN WHAT THEY SAY
   ────────────────────────────────────────────────────────────────────────
   Ric, 2026-11-14, answering the setup page: a full village should be able to
   be "as many as it can sustain"; coins shouldn't sit in children's pockets;
   stubbornness should be each person's own and passed on, with a range rather
   than everybody alike; a rule of the rich should be able to be overthrown by
   a civil war; and peacetime soldiers should be the leaders' decision. Each of
   those is checked here as what the engine does, not what the label says.

   Run it:  node projects/world-builder/test/settings-sense.test.mjs  (~1 min) */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

/* Coins start with the grown-ups; the total is the setting's, and a child's
   inheritance is held for them until they are grown. */
{
  const w = People.create({ people: 150, map: "small", seed: 4, coins: 10 });
  assert.ok(w.people.filter(p => !w.adult(p)).every(p => p.coins === 0), "no child starts with coins");
  const held = w.people.reduce((s, p) => s + p.coins, 0);
  assert.ok(Math.abs(held - 10 * w.people.length) < 1e-6, "the people hold the setting's coins a head between them");
  const child = w.people.find(p => !w.adult(p) && p.mum), parent = w.byId.get(child.mum);
  const money = w.stats().money;
  parent.coins = 30; const extra = 30 - (w.stats().money - money);           // what was added by hand
  const total = w.stats().money;
  parent.dieAt = parent.age; w.step(1);
  assert.ok(child.coins === 0 && child.trust > 0, "a child's inheritance is held in trust");
  assert.ok(Math.abs(w.stats().money - total) < 1e-6, "coins held in trust still count: none made or lost");
  child.age = w.settings.grown; w.step(1);
  assert.ok(child.coins > 0 && !child.trust, "grown, they have it");
  assert.ok(extra >= 0);
}

/* Stubbornness is each person's own, spread by "How much they differ", and
   children take after their parents. At its middle, the founders' boldness,
   warmth and greed are spread exactly as they always were. */
{
  const spread = differ => { const w = People.create({ people: 300, map: "small", seed: 9, differ }); const s = w.people.map(p => p.stub); return Math.max(...s) - Math.min(...s); };
  assert.equal(spread(0), 0, "with no difference everybody has the same nature");
  assert.ok(spread(1) > spread(0.5) && spread(0.5) > 0.3, "a wider setting makes a wider spread");
  const w = People.create({ people: 120, map: "small", seed: 9, births: 1 });
  w.step(24 * 40);
  const born = w.people.filter(p => p.born > 0 && p.mum && p.dad && w.byId.get(p.mum) && w.byId.get(p.dad));
  for (const c of born) {
    const mid = (w.byId.get(c.mum).stub + w.byId.get(c.dad).stub) / 2;
    assert.ok(Math.abs(c.stub - mid) <= 0.6 * w.settings.differ / 2 + 1e-9, "a child takes after its parents");
  }
}

/* A full village "as many as its land can feed": the limit is the food its
   fields grow, so thinner land holds fewer. */
{
  const rich = People.create({ people: 200, map: "small", seed: 6, crowd: 205, rich: 1.5 });
  const thin = People.create({ people: 200, map: "small", seed: 6, crowd: 205, rich: 0.4 });
  const feeds = w => w.villages.filter(v => v.alive).reduce((s, v) => s + v.feeds, 0);
  assert.ok(feeds(rich) > 0 && feeds(thin) < feeds(rich) * 0.5, "thin land feeds fewer: " + Math.round(feeds(thin)) + " against " + Math.round(feeds(rich)));
}

/* Peacetime soldiers are the leader's decision: near the start's number in a
   quiet world, never the race to everybody under arms. */
{
  const w = People.create({ people: 150, map: "small", factions: 3, seed: 11 });
  w.step(24 * 40);
  for (const f of w.factions.filter(f => f.alive)) {
    assert.ok(f.peace > 0.02 && f.peace < 0.2, f.name + " keeps " + (f.peace * 100).toFixed(1) + "% under arms in peace");
    assert.ok(f.soldiers >= 1, f.name + " has the soldiers its leader decided on");
  }
}

/* A rule of the rich that its people have turned on falls in a civil war;
   one they put up with stands. */
{
  const hated = People.create({ people: 100, map: "small", factions: 2, seed: 5, rule: "rich", unequal: 0.95, loyalty: 0, tax: 0.5 });
  hated.step(24 * 90);
  assert.ok((hated.stats().revolutions || 0) >= 1, "a hated rule of the rich is overthrown");
  assert.ok(hated.factions.some(f => f.rule !== "rich"), "and replaced by another way of choosing leaders");
  assert.ok(hated.events.some(e => e.kind === "revolution"), "and it is in the news");
  const borne = People.create({ people: 100, map: "small", factions: 2, seed: 5, rule: "rich", unequal: 0, loyalty: 1, tax: 0 });
  borne.step(24 * 90);
  assert.equal(borne.stats().revolutions || 0, 0, "a rule of the rich its people put up with stands");
}

console.log("Settings sense: coins with the grown-ups and in trust, inherited natures with a spread, a full village by its land, leaders' armies, and revolutions only where they are wanted.");
