/* World Builder — watching a world (TODO 21, 2026-11-25).

   The People page was rebuilt in 21b to 21g; everything new it shows is read by the keeper
   (people-host.js), which keeps a memory of its own — pins and their rows, firsts, the visitor's
   changes, where to stop — and must never write into the world. This holds:

   1. A world watched every way the page now watches it (every layer, pins, the Overview, the
      inspector on every kind of thing, taps, run-until stops) is the world unwatched.
   2. Every layer answers, including Beliefs, which stopped every frame until 2026-11-25.
   3. "Run a day", "until the next season" and "a year" stop on the first minute of that day.
   4. Pausing on news of a pin stops on an event about it.
   5. A tap finds a house, a field and the land of a people, not only people and villages.
   6. Every change the visitor makes is written down with before and after.
   7. The setup's three layers: every setting on one, the fourteen Essentials, the faith parts
      under the one Faith switch, and none of Ric's real alternatives on Model.

   node projects/world-builder/test/watching.test.mjs   (about a minute) */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const People = require("../people.js"), Host = require("../people-host.js");
const DAY = People.DAY_SECONDS;
const VALUES = { people: 160, seed: 7, map: 10, factions: 3, war: true, aggression: 0.9 };

function keeper() {
  const out = [];
  const host = Host.create(People, m => out.push(m));
  const ask = m => { out.length = 0; host.receive(m); return out[out.length - 1]; };
  return { host, out, ask };
}
const fingerprint = w => JSON.stringify({ days: w.days, people: w.people.map(p => [p.id, +p.x.toFixed(6), +p.y.toFixed(6), +p.food.toFixed(6), p.hungry, p.sick, p.job, +p.coins.toFixed(6)]),
  events: w.events.map(e => e.id + e.text), villages: w.villages.map(v => [v.pop, +v.food.toFixed(6), v.f]) });

// 1–4, 6: one watched world.
const k = keeper();
k.ask({ t: "start", values: VALUES });
const w = k.host.world;
const cam = { x: w.cols / 2, y: w.rows / 2, s: 6, w: 900, h: 700 };

// 2. Every layer, with what its legend needs.
for (const view of ["faction", "mood", "views", "wealth", "hunger", "sick", "loyal", "faith", "land", "roads", "war"]) {
  const f = k.ask({ t: "frame", cam, view, fresh: true, since: -1 });
  assert.equal(f.t, "frame", "the " + view + " layer answers");
  assert.ok(f.k > 0, "people in view");
  if (view === "war") assert.ok(Array.isArray(f.wars), "the war layer says who is at war");
  assert.ok(Array.isArray(f.probs), "every frame carries what is going wrong now");
}

// Pins, and the visitor's changes.
const someone = w.people[3], house = w.people.find(p => p.partner);
k.ask({ t: "pins", list: [{ k: "f", id: 0 }, { k: "v", id: 1 }, { k: "p", id: someone.id }, { k: "h", id: house.id }], pause: false });

// 3. Run until: each stops at a midnight, paused, and the next kind of day is right.
k.host.receive({ t: "clock", rate: 1000 });
const runTo = () => { for (let n = 0; n < 4000; n++) { k.out.length = 0; k.host.run(0.1, 40); const r = k.out.find(m => m.t === "reached"); if (r) return r; } throw new Error("never stopped"); };
k.host.receive({ t: "clock", until: { kind: "day" } });
let start = Math.floor(w.days);
let r = runTo();
assert.equal(r.why, "until"); assert.equal(w.days, start + 1, "Run a day stops at the next midnight exactly");
assert.equal(k.host.run(0.1, 40), false, "and stays stopped"); assert.equal(w.days, start + 1);
k.host.receive({ t: "clock", paused: false, until: { kind: "season" } });
start = w.days; const was = People.seasonAt(start, w.settings).name;
r = runTo();
assert.notEqual(People.seasonAt(w.days, w.settings).name, was, "stopped in the next season");
assert.equal(People.seasonAt(w.days - 1, w.settings).name, was, "on its first day");
assert.equal(w.days % 1, 0, "at midnight");
k.ask({ t: "do", seq: 1, what: "set", a: ["winter", 0.8] });
k.ask({ t: "do", seq: 2, what: "rule", a: [1] });
k.ask({ t: "do", seq: 3, what: "ftax", a: [1, 1] });
k.host.receive({ t: "clock", paused: false, until: { kind: "year" } });
start = w.days; r = runTo();
assert.equal(w.days, start + 365, "Run a year is a year to the minute");

// 6. The changes, with before and after, in the order made.
const rules = k.ask({ t: "pane", tab: "rules", seq: 4 });
assert.deepEqual(rules.actions.map(a => a.what), ["set", "rule", "ftax"]);
assert.equal(rules.actions[0].from, 0.5); assert.equal(rules.actions[0].to, 0.8);
assert.equal(rules.actions[1].from, false); assert.equal(rules.actions[1].to, true);
assert.ok(rules.actions[2].to > rules.actions[2].from, "a tax raised one notch");
assert.equal(rules.start.winter, 0.5, "what each rule began at"); assert.equal(rules.settings.winter, 0.8);

// The Overview and the panels read, never write.
const ov = k.ask({ t: "pane", tab: "world", seq: 5 });
assert.ok(ov.firsts.length > 0, "firsts are kept"); assert.equal(new Set(ov.firsts.map(e => e.kind)).size, ov.firsts.length, "one first of each kind");
assert.equal(ov.pins.length, 4);
const vp = ov.pins.find(p => p.k === "v");
assert.ok(vp.rows.length >= 365, "a row a day for a pinned village from the day it was pinned");
assert.equal(vp.rows[vp.rows.length - 1].people, w.villages[1].pop);
for (const e of ov.pins.find(p => p.k === "f").news) assert.equal(e.f, 0, "a pinned people's news is its own");
const pp = ov.pins.find(p => p.k === "p");
for (const e of pp.news) assert.ok(e.text.includes(someone.name), "a pinned person's news names them");
const people = k.ask({ t: "pane", tab: "people", seq: 6, q: {} });
assert.equal(people.mode, "worth");
const hungryNow = w.people.filter(p => p.hungry > 0).length;
assert.equal(people.groups.find(g => g.key === "hungry").count, hungryNow, "going hungry, counted from the people");
for (const pk of [{ person: house.id }, { village: 0 }, { faction: 0 }, { house: 0 }, { building: 0 }, { field: [...w.held.keys()][0] }, { road: 0 }, { boat: 0 }, { unit: { x: 1, y: 1 } }, { event: w.events[w.events.length - 1].id }]) {
  const look = k.ask({ t: "pane", tab: "look", seq: 7, picked: pk });
  assert.equal(look.t, "pane", "the inspector answers for " + Object.keys(pk)[0]);
}
const hh = k.ask({ t: "pane", tab: "look", seq: 8, picked: { person: house.id } }).person.household;
assert.ok(hh.ids.includes(house.id) && hh.ids.includes(house.partner) || w.byId.get(house.partner).home !== house.home, "a household is the person and who shares the house");

// 4. Pause on a pinned people's news.
k.host.receive({ t: "pins", list: [{ k: "f", id: 0 }, { k: "f", id: 1 }, { k: "f", id: 2 }], pause: true });
k.host.receive({ t: "clock", paused: false, until: null });
r = runTo();
assert.equal(r.why, "pin"); assert.ok([0, 1, 2].includes(r.event.f), "stopped for news of a pinned people");
k.host.receive({ t: "pins", list: [], pause: false });

// 1. The same world, unwatched, at the same moment.
// The keeper's orders happened at a moment; replay them at that moment.
const at = rules.actions[0].day;
const fresh = People.create(VALUES);
fresh.advance(at * DAY, true);
fresh.set("winter", 0.8); fresh.rule(1, true); fresh.order(1, { tax: fresh.factions[1].yours.tax + 0.02 });
fresh.advance(w.days * DAY - at * DAY, true);
assert.equal(fingerprint(fresh), fingerprint(w), "a world watched every way is the world unwatched");

// 5. Taps: a house, a field, the land.
{
  const t2 = keeper(); t2.ask({ t: "start", values: VALUES }); const w2 = t2.host.world;
  const empty = (x, y) => !w2.people.some(p => Math.hypot(p.x - x, p.y - y) < 0.3);
  /* Close in: a tap 16 pixels round at 4,096 pixels a square, on the end of a house rather than on
     whoever sleeps in the middle of it. */
  const end = h => [h.x + Math.cos(h.ang) * h.len * 0.4, h.y + Math.sin(h.ang) * h.len * 0.4];
  const h = w2.homes.find(h => { const [x, y] = end(h); return !w2.people.some(p => Math.hypot(p.x - x, p.y - y) < 0.005); });
  if (h) assert.equal(t2.ask({ t: "at", seq: 1, x: end(h)[0], y: end(h)[1], r: 16 / 4096 }).thing.house, w2.homes.indexOf(h), "a tap on a house is the house");
  let tile = -1; for (const i of w2.held.keys()) { const x = i % w2.cols + 0.5, y = Math.floor(i / w2.cols) + 0.5; if (empty(x, y) && !w2.homes.some(q => Math.hypot(q.x - x, q.y - y) < 0.3) && !w2.villages.some(v => Math.hypot(v.x - x, v.y - y) < 0.7)) { tile = i; break; } }
  if (tile >= 0) assert.equal(t2.ask({ t: "at", seq: 2, x: tile % w2.cols + 0.5, y: Math.floor(tile / w2.cols) + 0.5, r: 0.05 }).thing.field, tile, "a tap on a held field is the field");
  let land = -1; for (let i = 0; i < w2.owner.length; i++) { const x = i % w2.cols + 0.5, y = Math.floor(i / w2.cols) + 0.5; if (w2.owner[i] >= 0 && !w2.held.has(i) && w2.track[i] !== 2 && empty(x, y) && !w2.villages.some(v => Math.hypot(v.x - x, v.y - y) < 1.5) && !w2.homes.some(q => Math.hypot(q.x - x, q.y - y) < 0.5)) { land = i; break; } }
  if (land >= 0) assert.equal(t2.ask({ t: "at", seq: 3, x: land % w2.cols + 0.5, y: Math.floor(land / w2.cols) + 0.5, r: 0.05 }).thing.faction, w2.villages[w2.owner[land]].f, "a tap on a people's land is that people");
  assert.ok(h && tile >= 0 && land >= 0, "found a house, a field and open land to tap: " + [!!h, tile, land]);
}

// 7. The setup's layers, read off the page.
{
  const html = readFileSync(join(here, "../index.html"), "utf8");
  const list = name => { const m = new RegExp("const " + name + " = (?:new Set\\()?\\[([^\\]]*)\\]").exec(html); assert.ok(m, name + " is on the page"); return [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]); };
  const ess = list("ESSENTIAL"), model = list("MODEL"), parts = list("FAITH_PARTS");
  const items = People.SCHEMA.flatMap(g => g.items.map(it => Object.assign({ group: g.title }, it))), keys = new Set(items.map(it => it.key));
  assert.equal(ess.length, 14, "the fourteen Essentials Ric chose");
  for (const key of ess.concat(model, parts)) assert.ok(keys.has(key), key + " is a setting");
  for (const key of ess) assert.ok(!model.includes(key), key + " is not on two layers");
  for (const key of ["sexes", "marriage", "infancy", "property", "govern", "bodies", "era"]) assert.ok(!model.includes(key), key + " is a real choice, so it stays on Customise (TODO 21c)");
  const minds = items.filter(it => it.group === "Minds" && it.when && /faith|favour|prophet|witch|folk|fading|comfort|truce|martyr|flight|greatWorks|pilgrim|sacred|lifeRites/i.test(it.key));
  for (const it of minds) assert.ok(parts.includes(it.key), it.key + " is folded under Faith");
  for (const key of parts) assert.equal(items.find(it => it.key === key).group, "Minds", key + " is a part of faith");
  assert.equal(parts.length, 26);
  for (const it of items.filter(it => it.options && it.options.some(o => /\(as before\)$/.test(o[1])))) {
    const real = ["sexes", "marriage", "infancy", "property", "govern", "era", "materials", "hearth", "roaming", "works", "childwork", "housework", "beasts", "irrigation", "foragers"];
    assert.ok(model.includes(it.key) || real.includes(it.key) || ess.includes(it.key), it.key + " carries “as before” and is on no list: say which layer it belongs on (TODO 21c)");
  }
}

console.log("world-builder watching: ok — layers, run until, pins, firsts, the change log, taps and the setup's layers");
