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

   Run it:  node projects/world-builder/test/world-builder.test.mjs   (~20 s) */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const Physics = require("../physics.js");
const People = require("../people.js");

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
  const needs = { bigMass: { layout: "sun" }, maxBonds: cold, bondSpeed: cold };
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
    check(s0.count > 1, `physics preset "${p.name}" starts with nothing in it`);
    /* Mass only ever leaves over an open edge. */
    if (s.left === 0) check(Math.abs(s.mass - s0.mass) < 1e-6 * s0.mass, `physics preset "${p.name}": mass went from ${s0.mass} to ${s.mass}`);
    check(s.count + s.fused + s.left === s0.count, `physics preset "${p.name}": ${s0.count} bodies became ${s.count} + ${s.fused} fused + ${s.left} gone`);
  }

  /* Perfect bounces and nothing else: motion is all there is, and it is kept. */
  {
    const w = Physics.create({ count: 300, size: 50, kinds: 3, edge: "walls", bounce: 1, startSpeed: 5, startTemp: 0, shake: 0, radiate: 0 });
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
    const s = w.stats(), e = s.motion + s.heat + s.radiated;
    check(Math.abs(e - e0) < 1e-6 * e0, `physics: energy went from ${e0} to ${e} with nothing to take it`);
    check(s.radiated > 0, "physics: nothing leaked away with leaking on");
  }
  /* Fusing keeps momentum as well as mass. */
  {
    const w = Physics.create({ count: 200, size: 40, kinds: 3, edge: "wrap", fuse: "always", startSpeed: 4, shake: 0 });
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
  /* Junk in, a legal world out. */
  const junk = Physics.clean({ count: "lots", gravity: 1e9, edge: "sideways", sized: "true", kinds: -4 });
  check(junk.count === Physics.DEFAULTS.count && junk.gravity === 60 && junk.edge === "wrap" && junk.sized === true && junk.kinds === 1, "physics: clean() let a bad setting through");
}

/* ═══ people ════════════════════════════════════════════════════════════ */
{
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
  check(print(run(small, 6)) === print(run(small, 6)), "people: the same seed made two different worlds");

  for (const p of People.PRESETS) {
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
console.log("world builder: both engines hold — " + items(Physics).length + " physics settings, " + items(People).length + " people settings, all live");
