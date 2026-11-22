// Bandits on land (TODO.md 15.5b4, 2026-11-21). Ric (2026-11-20), from 15i's research: the hungry, the
// landless and the dishonest may choose to take for a living, from carts on the roads and from weakly
// held villages, weighed like any living and rising by itself in hard times; nothing starts a band and
// nobody is placed as a bandit; those robbed hold it against them.
//
// What is held:
//   1. with bandits off the world is the one 15.5b3 left, step for step (a fingerprint of it);
//   2. the hungry and dishonest take it up, the honest and the fed do not, nor anybody in a village
//      so short that all are needed in the fields, and a bandit whose hard times are over goes back;
//   3. a bandit lying in wait robs a cart that comes by, and the carter holds it against them;
//   4. a band rides out to a weakly held store and takes from it, and its people hold it against
//      them; a store with soldiers at hand is left alone.
//
// node projects/world-builder/test/bandits.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const FINGERPRINT = 3273619856;   // print() of 15.5b3's engine, seed 2, 60 days

// 1. Off: the world 15.5b3 left.
{
  const w = People.create({ seed: 2, bandits: false, dirt: "fixed", health: "simple", sexes: "none", childwork: "none", housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0 });   // and 15.5r's dirt at the old fixed toll
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "bandits off is the world before them");
}

const OPTS = { seed: 3, people: 400, map: 20, places: "city", start: "winter", materials: "goods" };
const w = People.create(OPTS);
w.step(24 * 31);
const big = w.villages.filter(v => v.alive).sort((a, b) => b.pop - a.pop);
const v = big[0], others = big.slice(1);
const here = () => w.people.filter(p => p.home === v.id && w.adult(p) && p.job !== "soldier" && p.id !== w.factions[p.f].leader);

// 2. Who takes it up, and who goes back.
{
  const ps = here();
  assert.ok(ps.length >= 20, "a town to try it on (" + ps.length + ")");
  const half = Math.floor(ps.length / 2);
  v.food = Math.max(v.food, v.pop * 2);   // a store not so empty that everybody is sent to the fields
  for (const [i, p] of ps.entries()) { p.hungry = 20; p.food = 0; p.coins = 0; p.honest = i < half ? 0.05 : 0.95; p.bold = 0.6; }
  const crooks = ps.slice(0, half).filter(p => w.living(p) === "bandit").length;
  const honest = ps.slice(half).filter(p => w.living(p) === "bandit").length;
  const keep = v.food; v.food = 0;
  const short = ps.slice(0, half).filter(p => w.living(p) === "bandit").length;
  v.food = keep;
  assert.equal(short, 0, "a village with nothing in its store needs everybody in the fields");
  assert.ok(crooks >= half * 0.3, "the hungry and dishonest take to robbing (" + crooks + " of " + half + ")");
  assert.equal(honest, 0, "the honest would sooner go hungry");
  for (const p of ps) { p.hungry = 0; p.food = 40; p.coins = 20; }
  const fed = ps.slice(0, half).filter(p => w.living(p) === "bandit").length;
  assert.equal(fed, 0, "the fed stay at honest work, however dishonest");
  for (const p of ps.slice(0, half)) p.job = "bandit";
  const still = ps.slice(0, half).filter(p => w.living(p) === "bandit").length;
  assert.equal(still, 0, "and a bandit fed and in coin goes back to it");
  for (const p of ps) { p.job = "farmer"; p.honest = 0.5; }
}

// 3. A cart going by somebody lying in wait.
{
  const o = others.find(u => Math.hypot(u.x - v.x, u.y - v.y) > 16);
  assert.ok(o, "a village far enough off to carry to");
  let robber = null;   // somebody not in the middle of a wait (a wait runs out before anything else is done)
  for (let h = 0; h < 24 && !robber; h++) { robber = here().find(p => p.wait === 0 && !p.cargo) || null; if (!robber) w.step(1); }
  assert.ok(robber, "somebody free to send");
  const carter = w.people.find(p => p.home === o.id && w.adult(p) && p.job !== "soldier" && !p.cargo);
  /* the carter sets off from beside their village for ours; the robber waits halfway */
  carter.x = o.x; carter.y = o.y; carter.coins = 30;
  const mx = (o.x + v.x) / 2, my = (o.y + v.y) / 2;
  robber.job = "bandit"; robber.x = mx; robber.y = my; robber.hp = 1;
  w.send(robber, mx, my, "waylay");
  w.step(1);
  carter.cargo = { what: "food", amount: 20, grain: true, paid: 20 }; carter.at = v.id;
  w.send(carter, v.x, v.y, "carry");
  const before = w.stats().waylaid, grain0 = w.stats().banditGrain;
  for (let h = 0; h < 30 && w.stats().waylaid === before; h++) { if (robber.task !== "waylay") w.send(robber, mx, my, "waylay"); w.step(1); }
  assert.equal(w.stats().waylaid, before + 1, "the cart is robbed on the road");
  assert.ok(w.stats().banditGrain - grain0 > 5, "and its food taken (" + (w.stats().banditGrain - grain0).toFixed(1) + " days)");
  assert.ok(carter.cargo === null || carter.cargo.amount < 20 - 5, "from the cart");
  assert.ok(carter.coins < 30 * 0.7, "and most of the purse (" + carter.coins.toFixed(1) + " left)");
  assert.ok(w.feel(carter, robber.id) < 0, "the carter holds it against " + robber.name);
  assert.match(w.events.filter(e => e.kind === "bandit").pop().text, /robbed .* on the road/);
}

// 4. A band at a weakly held store; and one held by soldiers, left alone.
{
  const band = here().slice(1, 6);
  for (const p of band) { p.job = "bandit"; p.hp = 1; p.food = 0; p.cargo = null; w.send(p, p.hx, p.hy, "idle"); }
  const near = others.filter(u => Math.hypot(u.x - v.x, u.y - v.y) < 50);
  assert.ok(near.length >= 1, "a place within a day's ride");
  const target = near[0];
  /* every other place near is held by soldiers, or walled; the target has a full store and none */
  for (const u of near.slice(1)) u.wall = 1;
  for (const p of w.people) if (p.job === "soldier" && p.home === target.id) { p.job = "farmer"; p.task = "idle"; }
  const store0 = 400;
  const before = w.stats();
  let rode = false;
  for (let h = 0; h < 24 * 4 && w.stats().banditGrain - before.banditGrain < 5; h++) {
    target.food = Math.max(target.food, store0);
    w.step(1);
    rode = rode || w.stats().banditRaids > before.banditRaids;
  }
  assert.ok(rode, "the band rides out");
  assert.ok(w.stats().banditGrain - before.banditGrain >= 5, "and takes from the store (" + (w.stats().banditGrain - before.banditGrain).toFixed(1) + ")");
  const held = w.people.filter(q => q.home === target.id && band.some(b => w.feel(q, b.id) < 0));
  assert.ok(held.length >= 1, "the place's people hold it against them (" + held.length + ")");
  assert.match(w.events.filter(e => e.kind === "bandit").pop().text, /raided .*store/);

  /* the same, with soldiers enough at hand there: they do not ride for it */
  const w2 = People.create(OPTS); w2.step(24 * 31);
  const v2 = w2.villages.find(u => u.id === v.id), t2 = w2.villages.find(u => u.id === target.id);
  const band2 = w2.people.filter(p => p.home === v2.id && w2.adult(p) && p.job !== "soldier" && p.id !== w2.factions[p.f].leader).slice(1, 6);
  for (const p of band2) { p.job = "bandit"; p.hp = 1; p.food = 0; p.cargo = null; w2.send(p, p.hx, p.hy, "idle"); }
  for (const u of w2.villages) if (u !== t2 && u !== v2) u.wall = 1;
  const guards = w2.people.filter(p => p.home === t2.id && w2.adult(p)).slice(0, 8);
  let b2 = null;
  for (let h = 0; h < 24 * 5; h++) {
    for (const g of guards) { g.job = "soldier"; g.x = t2.x + 0.3; g.y = t2.y + 0.3; w2.send(g, t2.x + 0.3, t2.y + 0.3, "idle"); }
    t2.food = Math.max(t2.food, store0);
    w2.step(1);
    if (h === 24) b2 = w2.stats();   // from the day the soldiers have been seen there (what a band knows is a day old)
  }
  assert.equal(w2.stats().banditRaids, b2.banditRaids, "a store with soldiers at hand is left alone");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder bandits: off is the world before, the hungry and dishonest take it up and go back when fed, a cart going by is robbed and the carter holds it against them, a band takes from a weakly held store and leaves one held by soldiers alone");
