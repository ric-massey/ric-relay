/* REPLICATION PROBE — run by hand, never in the checks.
   ────────────────────────────────────────────────────────────────────────
   Does a thing in the physics sandbox make more of itself?

   The method is the one the physical-replicator people use, and it is a
   control, not a demo: run the same world twice, once with copies of a
   sequence dropped in and once with exactly the same hexagons scattered
   loose, and compare how many of that sequence each world ends with. A
   sequence that turns up on its own in the control was assembled, not
   copied. The difference between the two is the only part that templating
   can claim. Virgo, Fernando, Bigge and Husbands put it plainly in "The
   Elongation Catastrophe in Physical Self-Replicators" (ECAL 2011): the
   comparison with and without a seed IS the measurement, because
   self-assembly of novel sequences is much easier than replication and
   looks identical if you only count the products.

   Nothing in here rewards copying, selects for it, or helps it along. The
   expected result is no difference. Run:

     node projects/world-builder/replication-probe.mjs
     node projects/world-builder/replication-probe.mjs --seq 1-5-1-5 --seconds 600
     node projects/world-builder/replication-probe.mjs --set bondStrength=9 --set align=6

   Options: --seq (the sequence to seed, kinds joined by -), --copies,
   --seconds, --runs (how many different world seeds), --set key=value for
   any physics setting. */
import { createRequire } from "node:module";
const Physics = createRequire(import.meta.url)("./physics.js");

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = argv.indexOf("--" + name);
  return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
};
const SEQ = String(opt("seq", "1-2-3")).split("-").map(Number).filter(k => k > 0);
const COPIES = Number(opt("copies", 10));
const SECONDS = Number(opt("seconds", 300));
const RUNS = Number(opt("runs", 3));
const OVERRIDES = {};
for (let i = 0; i < argv.length; i++) if (argv[i] === "--set") {
  const [k, v] = String(argv[i + 1] || "").split("=");
  if (k) OVERRIDES[k] = isNaN(Number(v)) ? v : Number(v);
}

/* A world with shape and a readable sequence, warm enough to come apart
   again, with heat arriving in the middle and leaking at the edges — a
   reaction needs somewhere for its heat to go. Everything here is a setting
   a visitor could tick themselves. */
const SETTINGS = {
  layout: "cloud", count: 700, size: 70, kinds: 5, edge: "wrap", sized: false,
  bonding: "sum", bondStrength: 20, bondChance: 0.6, maxBonds: 2, shift: 0, look: 1,
  angles: 0.6, align: 8, bondSpeed: 6,
  startTemp: 0.8, startSpeed: 1.2, shake: 0.5, conduct: 0.5, radiate: 0.12,
  heater: "centre", heaterTemp: 5, gravity: 0, fall: 0, bounce: 0.6, breaking: false,
  ...OVERRIDES,
};

const canon = seq => {
  const back = seq.slice().reverse();
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] !== back[i]) return (seq[i] < back[i] ? seq : back).join("-");
  }
  return seq.join("-");
};
const WANT = canon(SEQ);

/* Put one copy of the sequence in, bonded, by holding the pieces still until
   they have taken hold of each other. Placing is a visitor's hand, not
   physics; the run proper starts once every copy is in. */
function seedChain(w, cx, cy) {
  const gap = 0.98;
  const ids = SEQ.map((k, q) => w.place(cx + q * gap, cy, k, 0, 0, k));
  if (ids.some(i => i < 0)) return null;
  /* A hand that places a hexagon places it facing a way, and these are laid
     along the x axis: slot 0 points at the next one, slot 3 back at the last.
     Without this the facings are random and, with the slots held to a few
     degrees, a row that is held perfectly still can still never bond. */
  for (const id of ids) w.edit(id, { facing: 0 });
  for (let f = 0; f < 1500 && countBonds(w, ids) < SEQ.length - 1; f++) {
    w.step(1 / 240);
    ids.forEach((id, q) => { w.x[id] = cx + q * gap; w.y[id] = cy; w.vx[id] = 0; w.vy[id] = 0; });
  }
  return countBonds(w, ids) === SEQ.length - 1 ? ids : null;
}
function countBonds(w, ids) {
  const inside = new Set(ids);
  let held = 0;
  for (const b of w.bonds.values()) if (inside.has(b.a) && inside.has(b.b)) held++;
  return held;
}

/* Both arms are built the same way: the world is quietened first, so a seed
   can take hold without the soup knocking it apart, and then handed back its
   own settings. The control gets the identical quiet, the identical hexagons
   and the identical seed of the random number generator; the only difference
   between the two worlds is whether those hexagons arrive joined up. */
function world(seed, seeded) {
  const w = Physics.create({ ...SETTINGS, seed });
  const quiet = { heater: "none", shake: 0, radiate: 0.9, startSpeed: 0 };
  for (const [k, v] of Object.entries(quiet)) w.set(k, v);
  for (let i = 0; i < w.n; i++) { w.vx[i] *= 0.05; w.vy[i] *= 0.05; }
  let placed = 0;
  for (let c = 0; c < COPIES; c++) {
    const cx = 4 + ((c * 13.7) % (SETTINGS.size - 10)), cy = 4 + ((c * 23.3) % (SETTINGS.size - 8));
    if (seeded) { if (seedChain(w, cx, cy)) placed++; }
    else SEQ.forEach((k, q) => w.place((cx + q * 7.3) % (SETTINGS.size - 2) + 1, (cy + q * 5.1) % (SETTINGS.size - 2) + 1, k, 0, 0, k));
  }
  for (const k of Object.keys(quiet)) w.set(k, SETTINGS[k]);
  return { w, placed };
}

function countOf(w, sig) {
  for (const t of w.census().types) if (t.sig === sig) return t.count;
  return 0;
}

/* The number of copies that are NOT the seeds themselves. A seed that simply
   survives is not a copy, and counting the products alone cannot tell the
   two apart -- so the hexagons that were placed are remembered, and a thing
   holding any of them is not counted. Anything left is made of soup. */
function copiesOf(w, sig, seeded) {
  const parent = new Int32Array(w.cap);
  for (let i = 0; i < w.cap; i++) parent[i] = i;
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (const b of w.bonds.values()) { const a = find(b.a), c = find(b.b); if (a !== c) parent[a] = c; }
  const groups = new Map();
  for (let i = 0; i < w.n; i++) if (w.alive[i] && w.nb[i] > 0) {
    const f = find(i);
    if (!groups.has(f)) groups.set(f, []);
    groups.get(f).push(i);
  }
  let made = 0;
  for (const members of groups.values()) {
    if (members.some(i => seeded.has(i))) continue;
    if (members.length !== SEQ.length) continue;
    const ends = members.filter(i => w.nb[i] === 1);
    if (ends.length !== 2) continue;
    const order = [];
    let prev = -1, at = ends[0];
    for (let q = 0; q < members.length; q++) {
      order.push(((w.kind[at] - 1) % SETTINGS.kinds) + 1);
      let next = -1;
      for (let sl = 0; sl < w.SLOTS; sl++) {
        const o = w.slots[at * w.SLOTS + sl];
        if (o >= 0 && o !== prev && w.alive[o]) { next = o; break; }
      }
      if (next < 0) break;
      prev = at; at = next;
    }
    if (order.length === SEQ.length && canon(order) === sig) made++;
  }
  return made;
}

console.log(`Looking for ${WANT}: ${COPIES} copies seeded, against the same hexagons loose.`);
console.log(`${SECONDS}s of world time, ${RUNS} run${RUNS === 1 ? "" : "s"}, settings:`,
  Object.entries(OVERRIDES).map(([k, v]) => k + "=" + v).join(" ") || "the probe's own");
console.log("");
console.log("  run   seeded start   still there   new copies   control end");

let totalSeeded = 0, totalControl = 0, seededAtStart = 0;
for (let run = 0; run < RUNS; run++) {
  const seed = 1234 + run * 7919;
  const a = world(seed, true), b = world(seed, false);
  const started = countOf(a.w, WANT);
  seededAtStart += started;
  const seedIds = new Set();
  for (let i = 0; i < a.w.n; i++) if (a.w.alive[i] && a.w.nb[i] > 0) seedIds.add(i);
  for (let f = 0; f < SECONDS * 60; f++) { a.w.step(1 / 60); b.w.step(1 / 60); }
  const left = countOf(a.w, WANT), made = copiesOf(a.w, WANT, seedIds), control = countOf(b.w, WANT);
  totalSeeded += made; totalControl += control;
  console.log("  " + String(run + 1).padStart(3) + String(started).padStart(14) +
    String(left).padStart(14) + String(made).padStart(13) + String(control).padStart(14));
}

const avgSeeded = totalSeeded / RUNS, avgControl = totalControl / RUNS;
console.log("");
if (seededAtStart / RUNS < COPIES * 0.5) {
  console.log("Most of the seeds never formed. Nothing here is a measurement of replication:");
  console.log("the world is too crowded or too warm for a chain to hold together while it is");
  console.log("being put in. Try fewer hexagons (--set count=400) or a stronger bond.");
} else if (avgSeeded <= avgControl + 0.5) {
  console.log("No replication. The seeded world made no more of that sequence out of fresh");
  console.log("hexagons than the world that never saw one, so nothing copied anything: what");
  console.log("is there was assembled out of the soup, or is the seed still sitting there.");
} else {
  console.log(`The seeded world made ${(avgSeeded - avgControl).toFixed(1)} more of them out of fresh hexagons.`);
  console.log("That is a difference, not a finding. Before calling it replication: run it again");
  console.log("with more world seeds, run it for longer and see whether the count keeps up with");
  console.log("the count already there, and read the sequences -- a near miss is not a copy.");
}
console.log("");
console.log("What this cannot tell you: a sequence may replicate under settings this probe");
console.log("did not try. A null here is a null for these settings and this long, nothing more.");
