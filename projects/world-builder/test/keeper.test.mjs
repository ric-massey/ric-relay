// The engine's keeper, and the top taken off the number of people
// (TODO.md item 3, 2026-11-15).
//
// people-host.js holds a world, runs its clock and answers the page with
// only what it draws, so the engine can sit in a worker. The same keeper runs
// on the page's own thread where a worker cannot be had, and here in node.
// What is held:
//   1. a world run through the keeper — any speed, time handed over in any
//      pieces, frames and panels read all the while — is the identical world
//      to the engine run by hand;
//   2. a frame says what the world says: who is in view, where, what colour,
//      what they carry, what is said;
//   3. the panels, a tap and the watcher's orders go through;
//   4. the quiet trial ("what can this computer run") reports a speed and
//      leaves nothing running;
//   5. people has no top, and the slider's sweep is what it was;
//   6. the two files can be written out again as the text of a worker, which
//      is how the page starts one (and how it still works opened as a file);
//   7. what a world held on Max (TODO 3b): counted only on Max and not while
//      paused, from the time owed rather than a back tab's long sleep, and
//      started afresh with each world.
//
// node projects/world-builder/test/keeper.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const People = require("../people.js"), Host = require("../people-host.js");

const OWN = new Set(["ox", "oy", "mc", "mx", "my", "mdx", "mdy", "rm", "on", "ix", "bk", "wg", "wb"]);
const tidy = (k, v) => v instanceof Map ? [...v] : v && typeof v === "object" && !Array.isArray(v) && !ArrayBuffer.isView(v)
  ? Object.fromEntries(Object.entries(v).filter(([key]) => !OWN.has(key))) : v;
const picture = w => { w.settle(); return JSON.stringify({
  people: w.people.map(p => JSON.stringify(p, tidy)),
  villages: w.villages, factions: w.factions, events: w.events, chatter: w.chatter, stats: w.stats(), stock: Array.from(w.stock)
}, tidy); };

/* A keeper with its post kept: `ask` sends one message and gives back what
   came of it. */
function keeper() {
  const got = [];
  const host = Host.create(People, (m, transfer) => { got.push(m); assert.ok(!transfer || transfer.every(b => b instanceof ArrayBuffer), "only buffers are handed over"); });
  const ask = m => { got.length = 0; host.receive(m); return got[got.length - 1]; };
  return { host, ask, got };
}
const whole = (w, more) => Object.assign({ t: "frame", cam: { x: w.cols / 2, y: w.rows / 2, s: 4, w: w.cols * 4, h: w.rows * 4 }, view: "faction", fresh: true }, more);

// 1. The same world. Time goes in as awkward frame-lengths at 1×, 16× and
//    250×, then flat out against a budget, with frames, every panel and a tap
//    read between; then the engine alone is walked to the same step.
{
  const set = { people: 260, seed: 4, map: 14 };
  const k = keeper(), started = k.ask({ t: "start", values: set });
  assert.equal(started.t, "started");
  assert.equal(started.people, 260);
  const mine = k.host.world, alone = People.create(set);
  assert.equal(picture(mine), picture(alone), "the keeper's world starts as the engine's");
  let i = 0;
  const look = () => {
    k.ask(whole(mine, { picked: mine.people[i % mine.people.length].id, follow: i % 2 === 0, land: { at: -1, force: true } }));
    for (const tab of ["people", "factions", "news", "talk", "look", "world"])
      k.ask({ t: "pane", tab, seq: i, picked: { person: mine.people[(i * 7) % mine.people.length].id }, q: { search: "a", page: 1 } });
    k.ask({ t: "at", seq: i, x: mine.cols / 2, y: mine.rows / 2, r: 3 });
    i++;
  };
  for (const [rate, turns] of [[1, 40], [16, 60], [250, 40]]) {
    k.host.receive({ t: "clock", rate });
    for (let n = 0; n < turns; n++) { k.host.run(0.004 + (n % 7) * 0.013, 5); if (n % 9 === 0) look(); }
  }
  k.host.receive({ t: "clock", rate: 1000 });
  for (let n = 0; n < 12; n++) { k.host.run(0.016, 8); look(); }
  k.host.receive({ t: "clock", paused: true });
  const at = mine.activityTicks;
  k.host.run(0.5, 8);
  assert.equal(mine.activityTicks, at, "a paused world does not move");
  assert.ok(at > People.ACTIONS_PER_HOUR * 3, "it should have run some hours; it ran " + at + " steps");
  while (alone.activityTicks < at) alone.advance(People.STEP);
  assert.equal(alone.activityTicks, at);
  assert.equal(picture(mine), picture(alone), "run through the keeper, and read all the while, it must be the engine's own world");
}

// 2. A frame says what the world says.
{
  const k = keeper();
  k.ask({ t: "start", values: { people: 300, seed: 9, map: 14 } });
  const w = k.host.world;
  k.host.receive({ t: "clock", rate: 16 });
  for (let n = 0; n < 900; n++) k.host.run(0.1, 50);          // most of a day, so some are talking and working
  const f = k.ask(whole(w, { land: { at: -1, force: true } }));
  assert.equal(f.t, "frame");
  assert.equal(f.n, w.people.length);
  assert.equal(f.k, w.people.length, "with the whole land in view everybody is sent");
  let leaders = 0;
  w.people.forEach((p, i) => {
    assert.equal(f.x[i], Math.fround(p.x)); assert.equal(f.y[i], Math.fround(p.y));
    assert.equal(f.tint[i], p.f, "coloured by faction");
    assert.equal(!!(f.flags[i] & Host.FLAG.child), p.job === "child");
    assert.equal(!!(f.flags[i] & Host.FLAG.sick), p.sick > 0);
    assert.equal(!!(f.flags[i] & Host.FLAG.speaking), p.sayT > 0 && !!p.say);
    if (f.flags[i] & Host.FLAG.leader) leaders++;
  });
  assert.equal(leaders, w.factions.filter(x => x.alive && w.byId.get(x.leader)).length, "one ring a living leader");
  assert.equal(f.vs.length, w.villages.length); assert.equal(f.fs.length, w.factions.length);
  assert.equal(f.fs[0].colour, w.factions[0].colour);
  assert.equal(f.days, w.days);
  assert.equal(f.land.full.length, w.cols * w.rows);
  for (let i = 0; i < w.cols * w.rows; i += 7) {
    const fert = w.fert[i], full = fert > 0 ? Math.min(1, w.stock[i] / (fert * w.tileCapacity)) : 1;
    assert.equal(f.land.full[i], Math.round(full * 255));
    assert.equal(f.land.owner[i], w.owner[i]);
  }
  assert.equal(f.links.length % 4, 0);
  // Asked again with nothing changed — the same view, the world on the same
  // step — the answer is only that: nobody is read a second time.
  assert.ok(f.cost >= 0, "a frame says what it cost to make");
  const again = k.ask(whole(w, { fresh: false }));
  assert.equal(again.same, true); assert.equal(again.x, undefined);
  // A step on, it is a frame again, but villages and factions, unchanged, are not sent twice.
  k.host.run(0.1, 50);
  const next = k.ask(whole(w, { fresh: false }));
  assert.equal(next.k, w.people.length); assert.equal(next.vs, null); assert.equal(next.fs, null); assert.equal(next.land, null);
  // Looking somewhere else is a new frame even on the same step; so is anything the watcher does.
  assert.equal(k.ask(whole(w, { fresh: false })).same, true);
  assert.equal(k.ask(whole(w, { fresh: false, view: "wealth" })).same, undefined);
  k.ask({ t: "do", seq: 1, what: "rule", a: [0] });
  assert.equal(k.ask(whole(w, { fresh: false, view: "wealth" })).same, undefined);
  k.ask({ t: "do", seq: 2, what: "rule", a: [0] });
  // Other colourings.
  const mood = k.ask(whole(w, { view: "mood" }));
  w.people.forEach((p, i) => assert.equal(mood.tint[i], Math.min(23, Math.max(0, Math.round(p.mood * 23)))));
  // Close in on one person: only who is near is sent, with what they carry
  // and what they are doing written beside the one picked.
  const p = w.people.find(q => q.job !== "child" && w.equipment(q).some(g => g.equipped)) || w.people[0];
  const near = k.ask({ t: "frame", cam: { x: p.x, y: p.y, s: 40, w: 400, h: 300 }, view: "faction", picked: p.id, follow: true });
  assert.ok(near.k < w.people.length, "close in, people out of view are not sent");
  const inView = w.people.filter(q => Math.abs(q.x - p.x) <= 5 + 0.5 + 2.5 + 0.25 && Math.abs(q.y - p.y) <= 3.75 + 0.5 + 1.875 + 0.25).length;
  assert.ok(near.k <= inView, "nobody from further than half a screen beyond the view");
  assert.equal(near.picked.id, p.id); assert.equal(near.picked.x, p.x);
  assert.ok(near.labels.length >= 1 && near.labels[0].text === p.job + " · " + w.activity(p), "the picked person is labelled first");
  const me = near.labels[0].k;
  assert.equal(near.x[me], Math.fround(p.x));
  const carried = w.equipment(p).filter(g => g.equipped).reduce((m, g) => m | (Host.GEAR[g.key] || 0), 0);
  assert.equal(near.gear[me] & 15, carried, "what they carry is what the engine says they carry");
  // Somebody who has died is said to be gone, not left out.
  const gone = k.ask(whole(w, { picked: 999999999 }));
  assert.equal(gone.picked.gone, true);
}

// 3. Panels, a tap, and orders.
{
  const k = keeper();
  k.ask({ t: "start", values: { people: 240, seed: 2, map: 14, war: true } });
  const w = k.host.world;
  k.host.receive({ t: "clock", rate: 16 });
  for (let n = 0; n < 700; n++) k.host.run(0.1, 50);
  // People: by name, sixty to a page, filtered.
  const all = k.ask({ t: "pane", tab: "people", seq: 1, q: { search: "", settlement: "", faction: "", job: "", page: 0 } });
  assert.equal(all.count, w.people.length); assert.equal(all.rows.length, 60); assert.equal(all.pages, Math.ceil(w.people.length / 60));
  const names = w.people.map(p => p.name).sort((a, b) => a.localeCompare(b));
  assert.deepEqual(all.rows.map(r => r.name), names.slice(0, 60), "in the order the page always listed them");
  const some = k.ask({ t: "pane", tab: "people", seq: 2, q: { search: "", settlement: "", faction: "0", job: "farmer", page: 99 } });
  assert.equal(some.count, w.people.filter(p => p.f === 0 && p.job === "farmer").length);
  assert.equal(some.page, some.pages - 1, "a page past the end is the last page");
  const who = w.people[5];
  assert.equal(k.ask({ t: "pane", tab: "people", seq: 3, q: { search: who.name.toUpperCase() } }).rows.some(r => r.id === who.id), true, "search ignores case");
  // A person.
  const parent = w.people.find(p => w.people.some(q => q.mum === p.id || q.dad === p.id)) || who;
  const look = k.ask({ t: "pane", tab: "look", seq: 4, picked: { person: parent.id } });
  assert.equal(look.person.name, parent.name); assert.equal(look.person.activity, w.activity(parent));
  assert.equal(look.person.dailyNeed, w.dailyNeed(parent)); assert.deepEqual(look.person.urgency, w.urgency(parent));
  assert.deepEqual(look.person.children, w.people.filter(q => q.mum === parent.id || q.dad === parent.id).map(q => q.id));
  for (const id of look.person.children) assert.equal(look.named[id], w.byId.get(id).name);
  assert.equal(k.ask({ t: "pane", tab: "look", seq: 5, picked: { person: 999999999 } }).person, undefined, "the dead have no panel");
  // A village, the factions, the world.
  const v = w.villages[1];
  const vl = k.ask({ t: "pane", tab: "look", seq: 6, picked: { village: 1 } });
  assert.equal(vl.village.name, v.name); assert.equal(vl.village.storeDays, w.storeDays(v));
  const fa = k.ask({ t: "pane", tab: "factions", seq: 7 });
  assert.equal(fa.factions.length, w.factions.length); assert.equal(fa.factions[0].pop, w.factions[0].pop);
  assert.equal(fa.villages[1].taxNow, w.taxOf(v)); assert.equal(fa.history.length, w.history.length);
  const wo = k.ask({ t: "pane", tab: "world", seq: 8 });
  assert.deepEqual(wo.stats, w.stats()); assert.equal(wo.settings.people, 240);
  assert.equal(k.ask({ t: "pane", tab: "news", seq: 9 }).events.length, Math.min(80, w.events.length));
  const talk = k.ask({ t: "pane", tab: "talk", seq: 10 });
  assert.equal(talk.chatter.length, Math.min(40, w.chatter.length));
  if (talk.chatter.length) assert.equal(talk.chatter[0].id, w.chatter[w.chatter.length - 1].id, "newest first");
  // A tap finds whoever is nearest, or the village under it.
  const hit = k.ask({ t: "at", seq: 11, x: who.x, y: who.y, r: 0.6 });
  assert.equal(hit.person.id, w.at(who.x, who.y, 0.6).person.id);
  assert.equal(k.ask({ t: "at", seq: 12, x: -50, y: -50, r: 0.6 }).person, null);
  // Orders go to the engine's own doors, one notch from what stands now.
  const f = w.factions[0], o = w.factions[1];
  assert.equal(k.ask({ t: "do", seq: 13, what: "ftax", a: [0, 1] }).t, "did");
  assert.equal(f.yours, undefined, "nothing can be ordered of a faction nobody rules");
  k.ask({ t: "do", seq: 14, what: "rule", a: [0] });
  assert.ok(f.yours, "ruling it");
  const tax = f.yours.tax;
  k.ask({ t: "do", seq: 15, what: "ftax", a: [0, 1] });
  assert.ok(Math.abs(f.yours.tax - Math.min(0.6, tax + 0.02)) < 1e-12);
  k.ask({ t: "do", seq: 16, what: "army", a: [0, -1] });
  const relief = f.yours.relief;
  k.ask({ t: "do", seq: 17, what: "relief", a: [0] });
  assert.equal(f.yours.relief, !relief);
  const mineV = w.villages.find(x => x.alive && x.f === 0);
  k.ask({ t: "do", seq: 18, what: "vtax", a: [mineV.id, 1] });
  assert.ok(mineV.tax != null);
  k.ask({ t: "do", seq: 19, what: "vreset", a: [mineV.id] });
  assert.equal(mineV.tax, null);
  const said = k.ask({ t: "do", seq: 20, what: "war", a: [0, 1] });
  assert.equal(said.msg, "At war with " + o.name + "."); assert.equal(f.rel[1].war, true);
  const rich = w.settings.rich;
  k.ask({ t: "do", seq: 21, what: "set", a: ["rich", 1.5] });
  assert.equal(w.settings.rich, 1.5); assert.notEqual(rich, 1.5);
  k.ask({ t: "do", seq: 22, what: "set", a: ["people", 9] });
  assert.equal(w.settings.people, 240, "only the live settings can be changed");
}

// 4. The quiet trial: the world as set up, made and run for a moment.
{
  const k = keeper();
  const made = k.ask({ t: "try", id: 7, values: { people: 200, seed: 3 }, box: 3 });
  assert.equal(made.t, "tried"); assert.equal(made.people, 200); assert.ok(made.made >= 0 && !made.done);
  assert.equal(k.host.idle, false);
  let turns = 0;
  k.got.length = 0;
  while (k.host.run(0.016, 20)) assert.ok(++turns < 5000, "the trial must end");
  const done = k.got[k.got.length - 1];
  assert.equal(done.done, true); assert.equal(done.id, 7);
  assert.ok(done.speed > 1, "a world of 200 runs faster than its own clock; it said " + done.speed);
  assert.ok(Math.abs(done.days - Math.round(done.days)) < 1e-6 || done.wall >= 3, "whole days unless time ran out: " + done.days);
  assert.ok(done.days >= 2, "a short first day is the warming-up, and at least one more is measured: " + done.days);
  assert.ok(done.wall <= 3.5, "and it keeps to its three seconds: " + done.wall);
  assert.equal(k.host.idle, true, "nothing is left running");
  assert.equal(k.host.world, null);
  assert.equal(k.ask({ t: "frame", cam: { x: 0, y: 0, s: 1, w: 9, h: 9 } }), undefined, "and there is no world to draw");
  // A world that cannot be made says so instead of throwing.
  const bad = Host.create({ create() { throw new Error("no room"); }, DAY_SECONDS: 300 }, m => k.got.push(m));
  k.got.length = 0; bad.receive({ t: "try", id: 8, values: {} });
  assert.equal(k.got[0].failed, "no room");
  k.got.length = 0; bad.receive({ t: "start", values: {} });
  assert.equal(k.got[0].t, "failed");
}

// 5. No top on people. The slider still sweeps to 20,000; a typed number or a
//    link may be anything, and a world past the old top is made whole.
{
  const item = People.SCHEMA.flatMap(g => g.items).find(it => it.key === "people");
  assert.equal(item.max, 20000, "the slider's sweep");
  assert.equal(People.clean({ people: 50000 }).people, 50000);
  assert.equal(People.clean({ people: "2500000" }).people, 2500000);
  assert.equal(People.clean({ people: 3 }).people, 20, "the bottom is where it was");
  assert.equal(People.clean({ people: "Infinity" }).people, 400);
  assert.equal(People.clean({ people: "lots" }).people, 400);
  assert.equal(People.clean({ people: 1234.6 }).people, 1235);
  assert.equal(People.clean({ map: 9999 }).map, 500, "every other range keeps its ends");
  const w = People.create({ people: 20500, map: 60, seed: 3, plague: "none", bodies: "real" });
  assert.equal(w.people.length, 20500);
  w.advance(People.HOUR_SECONDS);
  assert.ok(w.people.length > 20400);
}

// 6. The worker's text. The page has no way to load a worker from a file
//    when it is itself opened from a folder, so it writes the two files out
//    again from the functions it already holds. Do exactly that, here, with
//    no module system in sight, and talk to what comes of it.
{
  const page = { performance };
  page.self = page;
  vm.createContext(page);
  for (const file of ["../people.js", "../people-host.js"]) vm.runInContext(fs.readFileSync(new URL(file, import.meta.url), "utf8"), page, { filename: file });
  assert.equal(typeof page.WBPeople.factory, "function"); assert.equal(typeof page.WBPeopleHost.factory, "function");
  const text = vm.runInContext('"self.WBPeople=(" + WBPeople.factory + ")();self.WBPeopleHost=(" + WBPeopleHost.factory + ")();self.WBPeopleHost.worker(self,self.WBPeople);"', page);
  const posted = [], timers = [];
  const scope = { performance, postMessage: m => posted.push(m), setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
                  MessageChannel: class { constructor() { const me = this; this.port1 = {}; this.port2 = { postMessage() { timers.push(() => me.port1.onmessage()); } }; } } };
  scope.self = scope;
  vm.createContext(scope);
  vm.runInContext(text, scope, { filename: "the worker's text" });
  assert.equal(typeof scope.onmessage, "function", "the worker listens");
  scope.onmessage({ data: { t: "hello" } });
  assert.equal(posted.pop().t, "hello");
  scope.onmessage({ data: { t: "start", values: { people: 60, seed: 2 } } });
  const started = posted.pop();
  assert.equal(started.t, "started"); assert.equal(started.people, 60);
  scope.onmessage({ data: { t: "clock", rate: 1000 } });
  for (let n = 0; n < 6 && timers.length; n++) timers.shift()();          // let its own loop turn
  scope.onmessage({ data: { t: "frame", cam: { x: started.cols / 2, y: started.rows / 2, s: 4, w: 400, h: 300 }, view: "faction", fresh: true } });
  const f = posted.pop();
  assert.equal(f.t, "frame"); assert.equal(f.k, 60);
  assert.ok(f.days > 0, "and its world is running");
}

// 7. What a world held on Max.
{
  const k = keeper();
  k.ask({ t: "start", values: { people: 120, seed: 2, map: 10 } });
  const frame = () => k.ask(whole({ cols: 10, rows: 10 }, { fresh: false }));
  k.host.receive({ t: "clock", rate: 16 });
  for (let n = 0; n < 20; n++) k.host.run(0.05, 5);
  assert.equal(frame().heldFor, 0, "nothing is counted below Max");
  k.host.receive({ t: "clock", rate: 1000 });
  for (let n = 0; n < 20; n++) k.host.run(0.05, 5);
  let f = frame();
  assert.ok(Math.abs(f.heldFor - 1) < 1e-9, "a second on Max is a second: " + f.heldFor);
  assert.ok(f.held > 16, "and it went faster than 16×: " + f.held);
  const before = f.heldFor;
  k.host.run(30, 5);                                        // a back tab woken after half a minute
  assert.ok(frame().heldFor - before <= 0.1 + 1e-9, "a long sleep counts a tenth of a second at most");
  k.host.receive({ t: "clock", paused: true });
  k.host.run(0.05, 5);
  f = frame();
  assert.ok(f.heldFor - before <= 0.1 + 1e-9, "nothing is counted while paused");
  assert.ok(f.days >= 0, "and the day is told with it");
  k.ask({ t: "start", values: { people: 120, seed: 3, map: 10 } });
  assert.equal(frame().heldFor, 0, "a new world starts its count again");
}

console.log("world-builder keeper: ok");
