import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const People = require("../people.js");

const world = People.create({ people: 80, talk: 1, seed: 7 });
world.advance(60);
assert.ok(world.chatter.length > 5, "the fixture needs actual exchanges");
const held = world.chatter[0], saved = JSON.stringify(held);
for (const c of world.chatter) {
  assert.deepEqual(c.people.map(p => p.id).sort((a,b) => a-b), [c.a,c.b].sort((a,b) => a-b));
  assert.ok(c.people.every(p => typeof p.home === "string" && typeof p.faction === "string"));
  assert.ok(c.day >= 0 && Number.isFinite(c.day));
  for (const e of c.effects) {
    assert.notEqual(e.before, e.after, "do not invent a change when nothing changed");
    if (e.person) assert.ok([c.a,c.b].includes(e.person));
    if (e.field === "trust") assert.ok(e.before >= -1 && e.after <= 1);
    if (e.field === "news") assert.ok(world.events.some(event => event.text === e.detail));
  }
}
assert.ok(world.chatter.some(c => ["politics", "news"].includes(c.kind) && c.effects.some(e => e.field === "trust")), "friendship effects applied after said() must be recorded");
world.advance(300);
assert.ok(world.chatter.length <= 160);
assert.ok(!world.chatter.includes(held), "the held record must outlive rolling history eviction");
assert.equal(JSON.stringify(held), saved, "later conversations must not rewrite an inspected exchange");
assert.equal(new Set(world.chatter.map(c => c.id)).size, world.chatter.length);
assert.ok(world.chatter.every((c,i,a) => i === 0 || c.id > a[i-1].id));

// A deliberately hungry, generous community exercises an actual grain transfer.
const hungry = People.create({ people: 60, talk: 1, factions: 1, villages: 1, seed: 5 });
for (const p of hungry.people) { p.age = 25; p.warm = 1; p.views = 1; p.hungry = 1; p.food = p.id % 2 ? 3 : 0; }
hungry.advance(90);
const help = hungry.chatter.find(c => c.kind === "help");
assert.ok(help, "fixture must include food changing hands");
const food = help.effects.filter(e => e.field === "food");
assert.equal(food.length, 2);
assert.ok(Math.abs(food.reduce((sum,e) => sum + e.after - e.before, 0)) < 1e-10);
assert.ok(food.some(e => Math.abs(e.after - e.before - 0.4) < 1e-10));
for (const e of food) assert.equal(help.people.find(p => p.id === e.person).food, e.before);
console.log("Conversation receipts: actual effects, conserved transfers, stable IDs and retained snapshots pass.");
