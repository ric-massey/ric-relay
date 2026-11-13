#!/usr/bin/env node
/* WORLD BUILDER — both engines, headless
   ─────────────────────────────────────────────────────────────────────────
   What this holds the two sandboxes to:

     · every setting on the page does something — a control that changes
       nothing is a lie on the settings screen;
     · the same seed and settings make the same world;
     · every preset runs and stays sane;
     · physics: mass is never made or lost, and where nothing is meant to
       take energy out, none goes missing;
     · people: every coin is somewhere, switching war or children off really
       switches them off, and nobody reports news that did not happen.

   Run it:  node projects/world-builder/test/world-builder.test.mjs   (several minutes) */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const Physics = require("../physics.js");
const People = require("../people.js");
const physicsOnly = process.argv.includes("--physics");

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const items = E => E.SCHEMA.flatMap(g => g.items);

/* A value for a setting that is not its default and not the base's. */
function other(it, base, alt) {
  if (alt && it.key in alt) return alt[it.key];
  if (it.type === "toggle") return !base;
  if (it.type === "select") return it.options.map(o => o[0]).find(v => v !== base);
  const far = Math.abs(it.max - base) > Math.abs(it.min - base) ? it.max : it.min;
  /* Half way to the far end, on a step: the extremes are often degenerate. */
  const v = base + (far - base) * 0.5;
  return Math.round((v - it.min) / it.step) * it.step + it.min;
}

/* ═══ physics ═══════════════════════════════════════════════════════════ */
{
  const print = w => {
    let h = 0;
    for (let i = 0; i < w.n; i++) if (w.alive[i]) h += w.x[i] * 1.1 + w.y[i] * 1.3 + w.vx[i] * 1.7 + w.heat[i] * 0.7 + w.m[i];
    return h + w.bonds.size * 1000 + w.stats().count * 7;
  };
  const run = (set, frames) => { const w = Physics.create(set); for (let f = 0; f < frames; f++) w.step(1 / 60); return w; };

  /* A world small enough to be quick and busy enough that every term bites:
     gravity on, bonding on, heat everywhere, a heater, hard-hit fusing. */
  const busy = { size: 40, count: 220, kinds: 4, layout: "spin", gravity: 3, fall: 1, bonding: "sum", fuse: "hard", fuseHit: 6,
                 heater: "centre", startTemp: 3, startSpeed: 3, drag: 0.05, edge: "walls", shake: 0.4, radiate: 0.05 };
  /* Some settings only bite in a world that pushes on them. */
  const cold = { size: 30, count: 420, kinds: 4, bonding: "any", startTemp: 0, startSpeed: 3, gravity: 0, shake: 0 };
  const hot = { layout: "sun", count: 1, size: 80, bigMass: 80, gravity: 0, fall: 0, bonding: "none", fuse: "never", startTemp: 80, startSpeed: 0, shake: 0, conduct: 0, radiate: 0, meltTemp: 20, toughness: 8, fragmentMass: 1, sized: false, edge: "wrap" };
  const needs = { bigMass: { layout: "sun" }, maxBonds: cold, bondSpeed: cold,
                  breaking: hot, toughness: hot, fragmentMass: hot, meltTemp: hot };
  const alt = { limit: 3, maxBonds: 1, bondSpeed: 0.5 };
  for (const it of items(Physics)) {
    const base = needs[it.key] === cold ? cold : Object.assign({}, busy, needs[it.key] || {});
    const clean = Physics.clean(base);
    check(!it.when || it.when(clean), `physics: the test's base world switches "${it.key}" off`);
    const a = print(run(base, 150));
    const b = print(run(Object.assign({}, base, { [it.key]: other(it, clean[it.key], alt) }), 150));
    check(it.key === "rate" || a !== b, `physics: changing "${it.label}" (${it.key}) changes nothing`);
  }
  /* The clock is the page's: it scales the time handed to step(). */
  check(Physics.DEFAULTS.rate === 1, "physics: the clock does not start at 1×");

  check(print(run(busy, 200)) === print(run(busy, 200)), "physics: the same seed made two different worlds");
  check(print(run(busy, 200)) !== print(run(Object.assign({}, busy, { seed: 8 }), 200)), "physics: a different seed made the same world");

  for (const p of Physics.PRESETS) {
    const w = Physics.create(p.set), s0 = w.stats();
    for (let f = 0; f < 240; f++) w.step(1 / 60);
    const s = w.stats();
    let bad = 0;
    for (let i = 0; i < w.n; i++) if (w.alive[i] && !(isFinite(w.x[i]) && isFinite(w.y[i]) && isFinite(w.vx[i]) && isFinite(w.heat[i]) && w.heat[i] > -1e-6 && w.m[i] > 0)) bad++;
    check(bad === 0, `physics preset "${p.name}": ${bad} bodies with a number that is not one`);
    check(s0.count > 1 || p.set.layout === "empty" || p.set.count === 1 && s0.count === 1, `physics preset "${p.name}" starts with nothing in it`);
    /* Mass only ever leaves over an open edge. */
    if (s.left === 0) check(Math.abs(s.mass - s0.mass) <= 1e-6 * s0.mass, `physics preset "${p.name}": mass went from ${s0.mass} to ${s.mass}`);
    check(s.count + s.fused + s.left === s0.count + s.fragments, `physics preset "${p.name}": body count does not account for fusing, leaving and fragments`);
  }

  /* Perfect bounces and nothing else: motion is all there is, and it is kept. */
  {
    const w = Physics.create({ count: 300, size: 50, kinds: 3, edge: "walls", bounce: 1, breaking: false, startSpeed: 5, startTemp: 0, shake: 0, radiate: 0 });
    const e0 = w.stats().motion;
    for (let f = 0; f < 600; f++) w.step(1 / 60);
    const e = w.stats();
    check(Math.abs(e.motion - e0) < 1e-6 * e0, `physics: perfect bounces changed the energy from ${e0} to ${e.motion}`);
    check(e.heat === 0, "physics: perfect bounces made heat");
  }
  /* Thuds, shaking and leaking, no gravity and no bonds: energy only moves
     between motion, heat and what has leaked away — the sum does not change.
     (Momentum is checked in the next world, not this one: heat's shoves are
     random and one hexagon at a time, so they keep energy to the last digit
     and momentum only on average. That is a known limit of this toy, and
     README.md says so.) */
  {
    const w = Physics.create({ count: 300, size: 50, kinds: 3, edge: "wrap", bounce: 0.4, startSpeed: 5, startTemp: 2, shake: 0.5, conduct: 0.5, radiate: 0.05 });
    const s0 = w.stats(), e0 = s0.motion + s0.heat;
    for (let f = 0; f < 600; f++) w.step(1 / 60);
    const s = w.stats(), e = s.motion + s.heat + s.radiated + s.breakWork;
    check(Math.abs(e - e0) < 1e-6 * e0, `physics: energy went from ${e0} to ${e} with nothing to take it`);
    check(s.radiated > 0, "physics: nothing leaked away with leaking on");
  }
  /* Fusing keeps momentum as well as mass. */
  {
    const w = Physics.create({ count: 200, size: 40, kinds: 3, edge: "wrap", fuse: "always", breaking: false, startSpeed: 4, shake: 0 });
    const s0 = w.stats();
    for (let f = 0; f < 400; f++) w.step(1 / 60);
    const s = w.stats();
    check(s.fused > 20, "physics: almost nothing fused with fusing always on");
    check(Math.hypot(s.momentumX - s0.momentumX, s.momentumY - s0.momentumY) < 1e-6 * s0.mass, "physics: fusing changed the world's momentum");
  }
  /* The bonding rule is arithmetic and symmetric, and "nothing" means nothing. */
  for (const rule of ["any", "sum", "same", "other"]) for (let a = 1; a <= 8; a++) for (let b = 1; b <= 8; b++) {
    const s = Physics.affinity(rule, a, b, 8);
    check(s >= 0 && s <= 1 && s === Physics.affinity(rule, b, a, 8), `physics: affinity(${rule}, ${a}, ${b}) is ${s}`);
  }
  check(run({ count: 300, size: 30, bonding: "none" }, 200).bonds.size === 0, "physics: bonds formed with chemistry off");
  check(run({ count: 500, size: 30, kinds: 4, bonding: "any", startTemp: 0, startSpeed: 2 }, 300).bonds.size > 50, "physics: almost nothing bonded with chemistry on");
  /* A bond that changes what it holds: off, a world is exactly what it was
     before the setting existed; on, bonds are re-read and things react. */
  {
    const base = { count: 500, size: 34, kinds: 5, bonding: "sum", startTemp: 2, startSpeed: 2, shake: 0.4, radiate: 0.03, heater: "centre", heaterTemp: 8 };
    const off = run(base, 400).stats(), on = run(Object.assign({}, base, { shift: 1 }), 400).stats();
    check(off.reacted === 0, "physics: bonds reacted with the setting off");
    check(on.reacted > 20, `physics: only ${on.reacted} reactions in a warm world with the setting on`);
    check(Physics.affinity("sum", 1, 5, 5) === 1 && Physics.affinity("sum", 1, 5, 5, 1, 0) < 1, "physics: a held bond does not change what a hexagon bonds as");
  }
  /* A visitor's hands: put in, change, pin, take out — and the world keeps
     running with every number still a number. */
  {
    const w = Physics.create({ layout: "empty", size: 40, edge: "walls", fall: 6, kinds: 4, bonding: "any", startTemp: 0, breaking: false });
    check(w.stats().count === 0, "physics: an empty world starts with something in it");
    const a = w.place(20, 5, 2), b = w.place(20, 30, 3), c = w.place(8, 8, 1, 3, 0, 40);
    check(a >= 0 && b >= 0 && c >= 0 && w.stats().count === 3 && w.stats().mass === 2 + 3 + 40, "physics: placing three did not put three in");
    w.edit(b, { pinned: true });
    w.edit(a, { kind: 4, temperature: 5 });
    check(w.kind[a] === 4 && Math.abs(w.heat[a] / w.m[a] - 5) < 1e-9, "physics: an edit did not take");
    w.edit(c, { mass: 80 });
    check(w.m[c] === 80 && w.r[c] > w.r[a], "physics: making one heavier did not make it heavier and bigger");
    for (let f = 0; f < 600; f++) w.step(1 / 60);
    check(w.x[b] === 20 && w.y[b] === 30 && w.vx[b] === 0 && w.vy[b] === 0, "physics: a pinned hexagon moved");
    check(w.y[a] > 6 && w.y[a] < 30, `physics: the loose one above the pin fell to ${w.y[a]}, through it or not at all`);
    check(w.warm(20, 30, 2, 10) >= 1 && w.heat[b] > 0, "physics: heating a place heated nothing");
    check(w.remove(a) && !w.remove(a) && w.stats().count === 2 && w.describe(a) === null, "physics: removing one did not remove exactly one");
    let bad = 0;
    for (let i = 0; i < w.n; i++) if (w.alive[i] && !(isFinite(w.x[i]) && isFinite(w.vx[i]) && isFinite(w.heat[i]))) bad++;
    check(bad === 0, "physics: a hand-built world has a number that is not one");
    /* Full is full, and a removed hexagon's place can be used again. */
    const tiny = Physics.create({ layout: "empty", size: 400 });
    let put = 0;
    for (let i = 0; i < 3200; i++) if (tiny.place(2 + (i % 190) * 2, 2 + Math.floor(i / 190) * 2, 1) >= 0) put++;
    check(put === 3000 && tiny.stats().room === 0, `physics: an empty world took ${put} by hand, not 3,000`);
    tiny.remove(7);
    check(tiny.place(390, 390, 2) === 7, "physics: a removed hexagon's place was not reused");
  }
  /* The census names things by what they are made of and counts each once. */
  {
    const w = run({ count: 400, size: 26, kinds: 3, bonding: "any", startTemp: 0, startSpeed: 2, shake: 0 }, 300), c = w.census(), s = w.stats();
    check(c.things === s.clusters && c.distinct >= 1 && c.distinct <= c.things, "physics: the census and the cluster count disagree");
    check(c.types.reduce((t, x) => t + x.count, 0) === c.things && c.free + s.clustered === s.count, "physics: the census lost or invented something");
  }
  /* Junk in, a legal world out. */
  const junk = Physics.clean({ count: "lots", gravity: Infinity, edge: "sideways", sized: "true", kinds: -4 });
  check(junk.count === Physics.DEFAULTS.count && junk.gravity === Physics.DEFAULTS.gravity && junk.edge === "wrap" && junk.sized === true && junk.kinds === 1, "physics: clean() let a bad setting through");
  /* Slider limits are not experiment limits. The engine and a shared link
     must preserve typed decimals and a trillion-mass sun without Int32 wrap. */
  {
    const set = { layout: "sun", count: 12, sized: false, bigMass: 1e12, gravity: 123.456789,
                  startTemp: 0.0123456789, startSpeed: 0, limit: 1234, bounce: 0.321 };
    const linked = Object.fromEntries(new URLSearchParams(set));
    check(JSON.stringify(Physics.clean(linked)) === JSON.stringify(Physics.clean(set)), "physics: a copied link changed exact numeric settings");
    const w = Physics.create(linked);
    check(w.m[0] === 1e12 && w.kind[0] === 1e12, "physics: a trillion-mass sun was clamped or its kind overflowed");
    check(w.settings.gravity === 123.456789 && w.settings.startTemp === 0.0123456789 && w.settings.bounce === 0.321, "physics: typed values were snapped to slider steps or limits");
    for (let i = 0; i < 20; i++) w.step(1 / 60);
    check(Number.isFinite(w.stats().mass) && Number.isFinite(w.stats().motion), "physics: the large custom sun stopped producing finite measurements");
    const bounds = Physics.clean({ bounce: 2, bondChance: -1, maxBonds: 999, count: 1e12, size: 1e12, seed: "", rate: 0 });
    check(bounds.bounce === 1 && bounds.bondChance === 0 && bounds.maxBonds === 255 && bounds.count === 20000 && bounds.size === 1000 && bounds.seed === Physics.DEFAULTS.seed && bounds.rate === 0.001, "physics: numeric entry lost its storage, fraction or browser bounds");
  }
}

/* Daily food uses the same physical clock as the browser. A century now
   really costs a century of walking/work, not 200 shortened updates per year.
   Keep the original generation-scale promises as explicit long experiments;
   CI exercises bounded daily runs and the clock/food mechanism checks instead. */
if (!physicsOnly && !process.argv.includes("--generations")) {
  for (const preset of People.PRESETS) {
    const w = People.create(preset.set);
    const money = w.stats().money;
    for (let day = 0; day < 7; day++) {
      w.step(24);
      const st = w.stats();
      check(Math.abs(st.money - money) < 1e-6 * Math.max(1, money), "people daily preset " + preset.name + ": coins changed");
      check(w.days === day + 1, "people daily preset " + preset.name + ": calendar drift");
      check(w.people.every(p => Number.isFinite(p.x + p.y + p.age + p.food + p.hp) && p.food >= 0 && p.coins >= -1e-9 && p.loyal >= 0 && p.loyal <= 1), "people daily preset " + preset.name + ": invalid state");
    }
    check(w.people.length > 20, "people daily preset " + preset.name + ": collapsed in the first week");
    check(w.stats().talks > 100, "people daily preset " + preset.name + ": nobody talked");
    console.log("world builder: seven actual days — " + preset.name);
  }
}
/* ═══ people ════════════════════════════════════════════════════════════ */
if (!physicsOnly && process.argv.includes("--generations")) {
  const Y = People.YEAR;
  const print = w => {
    let h = w.people.length * 1000 + w.events.length * 31 + w.stats().talks;
    for (const p of w.people) h += p.x * 1.1 + p.y * 1.3 + p.coins * 0.7 + p.age + p.loyal * 3 + p.views + p.f * 5 + p.food;
    for (const f of w.factions) h += f.tax * 100 + f.treasury;
    return h;
  };
  const run = (set, years) => { const w = People.create(set); w.step(years * Y); return w; };
  const small = { map: "small", people: 140, factions: 3, villages: 2, seed: 4 };

  /* War, breaking away and changing sides need a world unhappy enough to do
     them; the rest show up in a small quiet one within a few years. */
  const angry = { map: "small", people: 260, factions: 4, villages: 2, seed: 4, aggression: 0.9, rebel: 0.6, loyalty: 0.2, divided: 0.9, rich: 0.5 };
  const hard = new Set(["war", "aggression", "deadly", "rebel", "switch"]);
  const alt = { crowd: 20, aggression: 0.1, rebel: 0, switch: 1 };
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
    const coins = w.stats().money;
    for (let y = 0; y < 15; y++) {
      w.step(Y);
      const s = w.stats();
      if (s.people > 0) check(Math.abs(s.money - coins) < 1e-6 * Math.max(1, coins), `people preset "${p.name}": year ${y + 1}, coins went from ${coins} to ${s.money}`);
    }
    const s = w.stats();
    check(s.people > 20, `people preset "${p.name}": ${s.people} people left after 15 years`);
    check(s.talks > 500, `people preset "${p.name}": hardly anybody spoke`);
    let bad = 0;
    for (const q of w.people) {
      const ok = isFinite(q.x) && isFinite(q.y) && q.x >= 0 && q.y >= 0 && q.x <= w.cols && q.y <= w.rows &&
                 q.loyal >= 0 && q.loyal <= 1 && q.mood >= 0 && q.mood <= 1 && q.views >= -1 && q.views <= 1 &&
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
if (!physicsOnly) {
  const w = People.create({ people: 80, map: "small", talk: 0, seed: 17 });
  const coins = w.stats().money;
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
  w.advance(1170);
  check(Math.abs(w.days - 1) < 1e-9 && People.DAY_SECONDS === 1200, "people: 1200 seconds at 1× is not one day");
  check(w.people.length === 80 && w.stats().starved === 0, "people: the first watchable day lost people");
  check(Math.abs(w.stats().money - coins) < 1e-6, "people: the watchable clock created or lost money");
  check(w.people.some(p => Math.hypot(p.x - p.tx, p.y - p.ty) > 0.5), "people: the activity clock never started walking");
  const crowded = People.create({ people: 2000, map: "small", villages: 1, factions: 1 });
  let overlap = false;
  for (let i = 0; i < crowded.people.length; i++) for (let j = i + 1; j < crowded.people.length; j++) {
    if (Math.hypot(crowded.people[i].x - crowded.people[j].x, crowded.people[i].y - crowded.people[j].y) < 0.42 - 1e-8) overlap = true;
  }
  check(!overlap, "people: the most crowded starting village has overlapping bodies");
  const farmer = w.people.find(p => p.job === "farmer");
  farmer.task = "field"; farmer.tx = farmer.x; farmer.ty = farmer.y; farmer.sayT = 0;
  check(w.activity(farmer) === "Harvesting", "people: a farmer in their field is not identified as harvesting");
  const social = People.create({ people: 80, map: "small", talk: 1, seed: 7 });
  let speaker;
  for (let i = 0; i < 500 && !speaker; i++) {
    social.advance(0.2);
    speaker = social.people.find(p => p.sayT > 15 && social.byId.get(p.talkingTo)?.talkingTo === p.id);
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
  check(/src="physics\.js"/.test(html) && /src="people\.js"/.test(html), "page: does not load both engines");
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
console.log(physicsOnly ? "world builder: physics holds — " + items(Physics).length + " settings, all live" : process.argv.includes("--generations") ? "world builder: physics and generation-scale People experiments hold" : "world builder: physics settings and seven-day People presets hold; generation-scale experiments require --generations");
