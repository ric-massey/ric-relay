#!/usr/bin/env node
/* WORLD BUILDER — the People Sandbox's engine, headless
   ─────────────────────────────────────────────────────────────────────────
   What this holds the sandbox to (the physics half went to
   projects/physics-sandbox/test/physics.test.mjs on 2026-11-25):

     · every setting on the page does something — a control that changes
       nothing is a lie on the settings screen;
     · the same seed and settings make the same world;
     · every preset runs and stays sane;
     · every coin is somewhere, switching war or children off really
       switches them off, and nobody reports news that did not happen.

   Run it:  node projects/world-builder/test/world-builder.test.mjs   (several minutes) */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const People = require("../people.js");

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const items = E => E.SCHEMA.flatMap(g => g.items);

/* A value for a setting that is not its default and not the base's. */
function other(it, base, alt) {
  if (alt && it.key in alt) return alt[it.key];
  if (it.type === "toggle") return !base;
  if (it.type === "select") return it.options.map(o => o[0]).find(v => v !== base);
  /* How many people and how much land go as far as a computer can carry
     (2026-11-14); half way to that end is a test of the computer, not of
     the world. Twice the people, ten more kilometres. */
  if (it.key === "people") return Math.min(it.max, base * 2);
  if (it.key === "map") return Math.min(it.max, base + 10);
  const far = Math.abs(it.max - base) > Math.abs(it.min - base) ? it.max : it.min;
  /* Half way to the far end, on a step: the extremes are often degenerate. */
  const v = base + (far - base) * 0.5;
  return Math.round((v - it.min) / it.step) * it.step + it.min;
}


/* Daily food uses the same physical clock as the browser. A century now
   really costs a century of walking/work, not 200 shortened updates per year.
   Keep the original generation-scale promises as explicit long experiments;
   CI exercises bounded daily runs and the clock/food mechanism checks instead. */
if (!process.argv.includes("--generations")) {
  for (const preset of People.PRESETS) {
    const w = People.create(preset.set);
    const money = (w.stats().money - w.stats().minted);
    for (let day = 0; day < 7; day++) {
      w.step(24);
      const st = w.stats();
      check(Math.abs((st.money - st.minted) - money) < 1e-6 * Math.max(1, money), "people daily preset " + preset.name + ": coins changed");
      check(w.days === day + 1, "people daily preset " + preset.name + ": calendar drift");
      check(w.people.every(p => Number.isFinite(p.x + p.y + p.age + p.food + p.hp) && p.food >= 0 && p.coins >= -1e-9 && p.loyal >= 0 && p.loyal <= 1), "people daily preset " + preset.name + ": invalid state");
    }
    check(w.people.length > 20, "people daily preset " + preset.name + ": collapsed in the first week");
    check(w.stats().talks > 100, "people daily preset " + preset.name + ": nobody talked");
    console.log("world builder: seven actual days — " + preset.name);
  }
}
/* ═══ people ════════════════════════════════════════════════════════════ */
if (process.argv.includes("--generations")) {
  const Y = People.YEAR;
  const print = w => {
    let h = w.people.length * 1000 + w.events.length * 31 + w.stats().talks;
    for (const p of w.people) h += p.x * 1.1 + p.y * 1.3 + p.coins * 0.7 + p.age + p.loyal * 3 + w.viewOf(p) + p.f * 5 + p.food;
    for (const f of w.factions) h += f.tax * 100 + f.treasury;
    return h;
  };
  const run = (set, years) => { const w = People.create(set); w.step(years * Y); return w; };
  const small = { map: "small", people: 140, factions: 3, villages: 2, seed: 4 };

  /* War, breaking away and changing sides need a world unhappy enough to do
     them; the rest show up in a small quiet one within a few years. */
  const angry = { map: "small", people: 260, factions: 4, villages: 2, seed: 4, aggression: 0.9, rebel: 0.6, loyalty: 0.2, divided: 0.9, rich: 0.5 };
  const hard = new Set(["war", "aggression", "deadly", "rebel", "switch"]);
  const alt = { crowd: 20, aggression: 0.1, rebel: 0, switch: 1, own: "1.temper=0.95,1.bold=0.95" };   // own: one faction its own nature (TODO 15a)
  const base = new Map();
  for (const it of items(People)) {
    const from = hard.has(it.key) ? angry : small;
    const clean = People.clean(from);
    check(!it.when || it.when(clean), `people: the test's base world switches "${it.key}" off`);
    const years = hard.has(it.key) ? 30 : it.key === "term" || it.key === "life" || it.key === "inherit" ? 14 : 7;
    const id = (from === angry ? "a" : "s") + years;
    if (!base.has(id)) base.set(id, print(run(from, years)));
    const a = base.get(id);
    const b = print(run(Object.assign({}, from, { [it.key]: other(it, clean[it.key], alt) }), years));
    check(it.key === "rate" || a !== b, `people: changing "${it.label}" (${it.key}) changes nothing`);
  }
  console.log("world builder: people settings checked");
  check(print(run(small, 6)) === print(run(small, 6)), "people: the same seed made two different worlds");

  for (const p of People.PRESETS) {
    console.log("world builder: checking people preset — " + p.name);
    const set = Object.assign({}, p.set, { people: Math.min(240, People.clean(p.set).people) });
    const w = People.create(set);
    const coins = (w.stats().money - w.stats().minted);
    for (let y = 0; y < 15; y++) {
      w.step(Y);
      const s = w.stats();
      if (s.people > 0) check(Math.abs((s.money - s.minted) - coins) < 1e-6 * Math.max(1, coins), `people preset "${p.name}": year ${y + 1}, coins went from ${coins} to ${(s.money - s.minted)}`);
    }
    const s = w.stats();
    check(s.people > 20, `people preset "${p.name}": ${s.people} people left after 15 years`);
    check(s.talks > 500, `people preset "${p.name}": hardly anybody spoke`);
    let bad = 0;
    for (const q of w.people) {
      const ok = isFinite(q.x) && isFinite(q.y) && q.x >= 0 && q.y >= 0 && q.x <= w.cols && q.y <= w.rows &&
                 q.loyal >= 0 && q.loyal <= 1 && q.mood >= 0 && q.mood <= 1 && w.viewOf(q) >= -1 && w.viewOf(q) <= 1 &&
                 q.coins > -1e-9 && q.food >= 0 && w.factions[q.f] && w.factions[q.f].alive && w.villages[q.home];
      if (!ok) bad++;
      if (q.partner) check(!w.byId.get(q.partner) || w.byId.get(q.partner).partner === q.id, `people preset "${p.name}": ${q.name}'s partner is paired with somebody else`);
    }
    check(bad === 0, `people preset "${p.name}": ${bad} people with a number out of range or a faction that is gone`);
    for (const f of w.factions) if (f.alive) {
      const lead = w.byId.get(f.leader);
      check(f.pop === 0 || (lead && lead.f === f.id), `people preset "${p.name}": ${f.name} is led by somebody who is not in it`);
      check(f.tax >= 0 && f.tax <= 0.6, `people preset "${p.name}": ${f.name} taxes at ${f.tax}`);
    }
    /* News is passed on, never made: whatever was said was in the record. */
    for (const c of w.chatter) if (c.kind === "news") {
      const text = c.la.replace(/^Did you hear\? /, "");
      check(w.events.some(e => e.text === text) || w.events.length >= 400, `people preset "${p.name}": somebody reported "${text}", which is not in the record`);
    }
  }

  /* Switches that are off are off. */
  {
    const w = run(Object.assign({}, small, { war: false, people: 300, aggression: 1 }), 40), s = w.stats();
    check(s.wars === 0 && s.battle === 0 && s.captures === 0, `people: ${s.wars} wars and ${s.battle} killed with wars switched off`);
  }
  {
    const w = run(Object.assign({}, small, { births: 0 }), 20);
    check(w.stats().births === 0, "people: children were born with children set to none");
  }
  {
    const w = run(Object.assign({}, small, { money: "shared" }), 10), s = w.stats();
    check(s.money === 0 && w.people.every(p => p.coins === 0), "people: coins exist in a world with no money");
  }
  {
    const w = run(Object.assign({}, small, { talk: 0 }), 5);
    check(w.stats().talks === 0 && w.chatter.length === 0, "people: they talked with talking set to never");
  }
  {
    const w = run(Object.assign({}, small, { plague: "none" }), 20);
    check(w.stats().sick === 0, "people: somebody died of sickness with sickness off");
  }
  {
    /* Into the frost: a hard-winter world run to January grows nothing, and
       what is still standing in the fields is lost a little each day. */
    const w = run(Object.assign({}, small, { winter: 1, weather: 0 }), 281 / 365), s = w.season();
    check(s.name === "winter" && s.growth === 0, "people: a hard winter's January still grows crops");
    const before = w.stock.reduce((a, b) => a + b, 0); w.step(24);
    check(w.stock.reduce((a, b) => a + b, 0) < before, "people: crops standing through a hard frost are not lost");
  }
  console.log("world builder: checking the busy century");
  /* And the things the page promises can happen, do — somewhere in a busy
     century, without anything being told to. */
  {
    const w = run({ people: 500, factions: 5, aggression: 0.8, rebel: 0.8, loyalty: 0.3, divided: 0.9, seed: 3 }, 100), s = w.stats();
    check(s.wars > 0 && s.peaces > 0, `people: a touchy century had ${s.wars} wars and ${s.peaces} peaces`);
    check(s.elections > 10, "people: hardly any votes in a century of elections");
    check(s.switched > 0, "people: nobody changed faction in a century");
    check(s.births > 100 && s.old > 100, "people: no generations turned over in a century");
    check(s.secessions + s.captures > 0, "people: no village changed hands or broke away in a touchy, disloyal century");
  }
}

/* The watchable clock, crowded spawns, and crossing paths use the page's actual API. */
{
  /* Spaced-out bodies: what is checked here is that they keep their spacing (real size,
     the default since TODO 7a, has nobody in anybody's way). */
  const w = People.create({ people: 80, map: "small", talk: 0, seed: 17, bodies: "drawn" });
  const coins = (w.stats().money - w.stats().minted);
  const separated = () => w.people.every((p, i) => w.people.slice(i + 1).every(q => Math.hypot(p.x - q.x, p.y - q.y) >= 0.42 - 1e-8));
  check(separated(), "people: initial bodies overlap");
  const a = w.people[0], b = w.people[1];
  // Reserve an empty stretch before staging the head-on encounter; do not
  // teleport the test pair onto an unrelated resident in a different seed layout.
  let lane;
  search: for (let y = 2; y < w.rows - 2; y += 3) for (let x = 2; x < w.cols - 4; x += 3) {
    if (w.people.every(p => p === a || p === b || Math.hypot(p.x - Math.max(x, Math.min(x + 2, p.x)), p.y - y) > 1)) {
      lane = [x, y]; break search;
    }
  }
  check(!!lane, "people: no empty lane for the crossing test");
  const [lx, ly] = lane || [2, 2];
  a.x = lx; a.y = ly; a.tx = lx + 2; a.ty = ly;
  b.x = lx + 2; b.y = ly; b.tx = lx; b.ty = ly;
  for (let i = 0; i < 150; i++) {
    w.advance(0.2);
    check(separated(), "people: bodies overlapped while walking");
  }
  /* The rest of the first day. These three checks were written for the
     twenty-minute day and went red, unnoticed in the slow lane, when a day
     became five minutes on 2026-11-14; fixed 2026-11-15. The length of a day
     is the engine's to say (`DAY_SECONDS`), and whether anybody walks is
     looked for through the day, not only at midnight when they are in bed. */
  let walking = false;
  for (let left = People.DAY_SECONDS - 30; left > 1e-9; left -= 15) {
    w.advance(Math.min(15, left));
    walking = walking || w.people.some(p => Math.hypot(p.x - p.tx, p.y - p.ty) > 0.5);
  }
  check(Math.abs(w.days - 1) < 1e-9, "people: DAY_SECONDS at 1× is not one day");
  check(w.people.length === 80 && w.stats().starved === 0, "people: the first watchable day lost people");
  check(Math.abs((w.stats().money - w.stats().minted) - coins) < 1e-6, "people: the watchable clock created or lost money");
  check(walking, "people: the activity clock never started walking");
  const crowded = People.create({ people: 2000, map: "small", villages: 1, factions: 1, bodies: "drawn" });
  let overlap = false;
  for (let i = 0; i < crowded.people.length; i++) for (let j = i + 1; j < crowded.people.length; j++) {
    if (Math.hypot(crowded.people[i].x - crowded.people[j].x, crowded.people[i].y - crowded.people[j].y) < 0.42 - 1e-8) overlap = true;
  }
  check(!overlap, "people: the most crowded starting village has overlapping bodies");
  /* Since TODO 4a a small world may have no farmer after a day (crafting can pay better on the
     new land), so one is made: what is checked is how a farmer in a field reads. */
  const farmer = w.people.find(p => p.job === "farmer") || Object.assign(w.people.find(p => w.adult(p)), { job: "farmer" });
  farmer.task = "field"; farmer.tx = farmer.x; farmer.ty = farmer.y; farmer.sayT = 0;
  check(w.activity(farmer) === "Harvesting", "people: a farmer in their field is not identified as harvesting");
  const social = People.create({ people: 80, map: "small", talk: 1, seed: 7 });
  let speaker;
  for (let i = 0; i < 500 && !speaker; i++) {
    social.advance(0.2);
    speaker = social.people.find(p => p.sayT > 2 && social.byId.get(p.talkingTo)?.talkingTo === p.id);   // a line is held seven steps now, not thirty
  }
  check(!!speaker, "people: no conversation pair became visible");
  if (speaker) {
    const listener = social.byId.get(speaker.talkingTo), positions = [speaker.x, speaker.y, listener.x, listener.y];
    check(social.activity(speaker) === "Talking to " + listener.name, "people: activity does not name the actual listener");
    social.advance(0.2);
    check(positions.every((v, i) => v === [speaker.x, speaker.y, listener.x, listener.y][i]), "people: conversation partners walk away while speaking");
  }

}

/* ═══ the page ══════════════════════════════════════════════════════════ */
{
  const html = readFileSync(join(here, "../index.html"), "utf8");
  check(/src="people\.js"/.test(html) && /src="people-host\.js"/.test(html), "page: does not load the engine and its keeper");
  check(!/src="physics\.js"/.test(html), "page: loads the physics engine, which is the Physics Sandbox's now");
  check(/physics-sandbox\/index\.html/.test(html), "page: an old #physics link is not sent on to the Physics Sandbox");
  check(/relay-return\.js"[^>]*data-egg="worlds"/.test(html), "page: no route back to the terminal");
  check(/assets\/visit\.js/.test(html), "page: does not load visit.js");
  check(!/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, "")), "page: names an outside address — it must run from the repo alone");
  const ret = readFileSync(join(here, "../../relay-return.js"), "utf8");
  check(/\bworlds:\s*\[/.test(ret), "page: declares data-egg=\"worlds\" but relay-return.js has no such egg");
}

if (problems.length) {
  console.error("WORLD BUILDER — " + problems.length + " problem" + (problems.length === 1 ? "" : "s") + ":");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(process.argv.includes("--generations") ? "world builder: generation-scale People experiments hold" : "world builder: seven-day People presets hold; generation-scale experiments require --generations");
