#!/usr/bin/env node
/* PHYSICS SANDBOX — the engine, headless
   ─────────────────────────────────────────────────────────────────────────
   What this holds the sandbox to:

     · every setting on the page does something — a control that changes
       nothing is a lie on the settings screen;
     · the same seed and settings make the same world;
     · every preset runs and stays sane;
     · mass is never made or lost, and where nothing is meant to take
       energy out, none goes missing.

   Until 2026-11-25 this was the physics half of World Builder's test; the
   two sandboxes are separate projects now.

   Run it:  node projects/physics-sandbox/test/physics.test.mjs   (seconds) */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const Physics = require("../physics.js");

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
  /* "How closely they must line up" only exists in a world whose bonds hold
     an angle, so that world has to have them on before the setting is asked
     to do anything. */
  const needs = { bigMass: { layout: "sun" }, maxBonds: cold, bondSpeed: cold,
                  breaking: hot, toughness: hot, fragmentMass: hot, meltTemp: hot,
                  align: { angles: 0.6 },
                  /* The chemistry settings that only exist on top of another. */
                  charge: cold, ions: { charge: 3 }, shapeBy: { angles: 0.6 }, swap: { settle: true }, order: { settle: true },
                  fuelRate: { fuel: 3 } };
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
    /* The loose one is hot and bounces round the box, so where it is at the
       end is chance; what must hold is that it fell, and never went through
       the pinned one. */
    let closest = Infinity, lowest = w.y[a];
    for (let f = 0; f < 600; f++) {
      w.step(1 / 60);
      closest = Math.min(closest, Math.hypot(w.x[a] - w.x[b], w.y[a] - w.y[b]) / (w.r[a] + w.r[b]));
      lowest = Math.max(lowest, w.y[a]);
    }
    check(w.x[b] === 20 && w.y[b] === 30 && w.vx[b] === 0 && w.vy[b] === 0, "physics: a pinned hexagon moved");
    check(lowest > 6, `physics: the loose one never fell (lowest ${lowest})`);
    check(closest > 0.5, `physics: the loose one went into the pinned one (closest ${closest} of touching)`);
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

/* ═══ the page ══════════════════════════════════════════════════════════ */
{
  const html = readFileSync(join(here, "../index.html"), "utf8");
  check(/src="physics\.js"/.test(html), "page: does not load the engine");
  check(!/src="people(-host)?\.js"/.test(html), "page: loads the People engine, which is World Builder's now");
  check(/relay-return\.js"[^>]*data-egg="worlds"/.test(html), "page: no route back to the terminal");
  check(/assets\/visit\.js/.test(html), "page: does not load visit.js");
  check(/href="lab\.html"/.test(html), "page: no way to the Lab");
  check(!/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, "")), "page: names an outside address — it must run from the repo alone");
  const ret = readFileSync(join(here, "../../relay-return.js"), "utf8");
  check(/\bworlds:\s*\[/.test(ret), "page: declares data-egg=\"worlds\" but relay-return.js has no such egg");
}

if (problems.length) {
  console.error("PHYSICS SANDBOX — " + problems.length + " problem" + (problems.length === 1 ? "" : "s") + ":");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("physics sandbox: physics holds — " + items(Physics).length + " settings, all live");
