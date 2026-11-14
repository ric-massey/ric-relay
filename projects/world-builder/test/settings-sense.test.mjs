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

/* Children may hold coins, but a household spends as one: never a child with
   money while the parent who feeds it goes hungry (Ric, 2026-11-14). And no
   coin is made or lost by it. */
{
  const w = People.create({ people: 150, map: "small", seed: 4, coins: 10 });
  w.step(7);
  const kid = w.people.find(p => !w.adult(p) && p.mum && w.byId.get(p.mum) && w.byId.get(p.mum).home === p.home);
  const mum = w.byId.get(kid.mum), mate = mum.partner && w.byId.get(mum.partner);
  mum.coins = 0; if (mate) mate.coins = 0; kid.coins = 30; mum.food = 0;
  w.villages[mum.home].food = 50;
  const money = w.stats().money;
  w.step(24);
  assert.ok(kid.coins < 30, "a parent with nothing buys the household's food with the child's coins");
  assert.ok(mum.food > 0, "and the parent eats");
  assert.ok(Math.abs(w.stats().money - money) < 1e-6, "no coin is made or lost by a household purse");
}
/* Nor a child with a larder while a parent starves. */
{
  const w = People.create({ people: 150, map: "small", seed: 4, money: "coins" });
  w.step(7);
  const kid = w.people.find(p => !w.adult(p) && p.mum && w.byId.get(p.mum) && w.byId.get(p.mum).home === p.home);
  const mum = w.byId.get(kid.mum), mate = mum.partner && w.byId.get(mum.partner);
  mum.food = 0; mum.coins = 0; if (mate) { mate.food = 0; mate.coins = 0; } kid.coins = 0; kid.food = 40;
  for (const v of w.villages) v.food = 0;
  w.step(6);
  assert.ok(kid.food < 40 && mum.hungry === 0, "a parent with nothing eats from the child's spare food");
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

console.log("Settings sense: one household purse and pot, inherited natures with a spread, a full village by its land, leaders' armies, and revolutions only where they are wanted.");
