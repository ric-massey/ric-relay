// census.mjs -- the species census. README item 5, the central question:
// does the Lab produce a periodic table with any depth?
//
// README on what the Lab is for: "Its output is meant to be this universe's
// periodic table: the stable clusters, what each is made of, and how each
// behaves when it meets another -- measured by running collisions, not
// computed." This file measures the first three from a free run. Deliberate
// collisions are a separate harness; see the note at the end of the output.
//
// Rules this file is standing under:
//
//   rule 2   nothing stored that should emerge. There is NO cluster id in the
//            world. Identity is recomputed from the bond bits at every sample
//            and matched between samples by membership overlap. README states
//            the requirement itself: "tracking clusters through time, which
//            needs re-identifying them every sample, since rule 2 forbids
//            storing a cluster id."
//
//   rule 9   locality is absolute -- but "instruments are not bound by this
//            rule. wave.mjs and the viewer may read the whole world, the way
//            a microscope sees more than a molecule does." This is an
//            instrument. It imports lab.mjs and constants.mjs and changes
//            neither. A cluster walk INSIDE the engine was item 32 and came
//            out; this one is outside it.
//
//   rule 11  don't trust a pretty picture. Two cross-checks run against the
//            ENGINE'S OWN totals at every sample, before any table is
//            believed: the walk's bond count against census(w).bondBits, and
//            its members plus free primitives against the occupied hexagons.
//            A mismatch is a bug in this file and it refuses to print.
//
//   rule 12  a count from one run is not a finding, so every number is over
//            several seeds and the seed count is printed beside it.
//
// WHAT A SPECIES IS NAMED BY, AND WHY THAT IS A CHOICE.
// A cluster is named by the sorted multiset of its members' VALENCES,
// v(k) = k mod M. That is not a convenience: it is everything the two bonding
// laws can read. Law 2 is B = M - |v(k1) + v(k2) - M| and law 4's capacity is
// clamp(v(k), 1, 6), and neither reads anything else about kind. Kind enters
// the chemistry at exactly one place -- law 2 breaks a bond when e >= B * kind,
// so a heavier primitive holds the same bond through more heat -- so kind is
// reported BESIDE the name as a range, never inside it. If two clusters with
// the same signature behave differently, that difference is the break
// threshold and this naming is hiding it. The kind columns are there so that
// can be seen rather than assumed.
//
//   node census.mjs

import { Lab, census, CELLS } from "./lab.mjs";
import { THERMOSTAT_DEFAULT } from "./constants.mjs";
import { walk, M } from "./clusters.mjs";

// ---------------------------------------------------------------- constants
// rule 8: named, with units.
const SEEDS           = [1, 2, 3];   // rule 12
const EVENT_BUDGET    = 1200000;     // events per run
const SAMPLES          = 60;         // world inspections per run
const SETTLE_FRACTION = 0.25;        // leading share of a run treated as transient
const MATCH_SHARE     = 0.5;         // membership overlap counting as "the same cluster"
const MIN_SIZE        = 2;           // a lone primitive is not a cluster
const TOP_SPECIES     = 20;          // rows printed
const LONG_LIVED_T    = 50;          // Lab time units, for the "stable" share

// The seeded world, identical to the one lab-check.mjs Check 7 uses, so the
// census's totals can be compared against the pre-flight's published numbers.
const FILL            = 0.35;        // share of hexagons holding matter
const MOMENTUM_SEED   = 6;           // +-this on each component at t = 0
const kindDraw        = (rng) => 1 + rng.below(255);

const EVENTS_PER_SAMPLE = Math.floor(EVENT_BUDGET / SAMPLES);

const med = (a) => {
  const s = [...a].sort((x, y) => x - y), n = s.length;
  return n === 0 ? NaN : (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2);
};

// The connected-component walk lives in clusters.mjs so that collide.mjs uses
// the same one; a second copy is a second thing that can disagree with the
// engine. Scratch for the matcher only.
const owner = new Int32Array(CELLS);

// ---------------------------------------------------------------- matching
// Old clusters to new ones by shared membership. Both sides are outputs of
// walk(); nothing is read from or written to the world.
function matchSamples(prev, next) {
  owner.fill(-1);
  next.forEach((c, id) => { for (const i of c.members) owner[i] = id; });

  const oldToNew = prev.map((c) => {
    const hits = new Map();
    for (const i of c.members) {
      const id = owner[i];
      if (id >= 0) hits.set(id, (hits.get(id) || 0) + 1);
    }
    return [...hits.entries()]
      .filter(([id, n]) => n >= MATCH_SHARE * Math.min(c.size, next[id].size))
      .map(([id]) => id);
  });

  const newFromOld = next.map(() => []);
  oldToNew.forEach((ids, o) => ids.forEach((n) => newFromOld[n].push(o)));
  return { oldToNew, newFromOld };
}

// ----------------------------------------------------------------- one run
function runCensus(seed) {
  const lab = new Lab({ seed });
  lab.seedWorld(FILL, kindDraw, { momentumRange: MOMENTUM_SEED });
  lab.start();

  const species = new Map();
  const events = { survived: 0, grew: 0, shrank: 0, merged: 0, split: 0, vanished: 0, appeared: 0 };
  const lifetimes = [];
  let live = [], prev = null, prevT = 0;
  let checksOk = true, checkNote = "";
  const settleAfter = Math.floor(SAMPLES * SETTLE_FRACTION);
  const born = (c, t) => ({ species: c.species, size: c.size, tBorn: t });

  for (let s = 0; s < SAMPLES; s++) {
    lab.run(EVENTS_PER_SAMPLE * (s + 1));
    const w = lab.w;
    const { clusters, free, occupied, bondsSeen } = walk(w, MIN_SIZE);
    const t = lab.now;

    // --- rule 11: against the engine's own totals, every sample ---
    const eng = census(w);
    if (bondsSeen * 2 !== eng.bondBits) {
      checksOk = false;
      checkNote = `bonds at sample ${s}: walk ${bondsSeen * 2} vs engine ${eng.bondBits}`;
    }
    const inClusters = clusters.reduce((a, c) => a + c.size, 0);
    if (inClusters + free !== occupied) {
      checksOk = false;
      checkNote = `members at sample ${s}: ${inClusters} + ${free} != ${occupied}`;
    }
    // A check that passes on 0 == 0 is the thing rule 11 is about: the first
    // version of this file reported "ok" on all 60 samples of a world that
    // had never been seeded and never ran. Both totals must be nonzero.
    if (occupied === 0 || lab.events === 0) {
      checksOk = false;
      checkNote = `nothing ran at sample ${s}: ${occupied} occupied, ${lab.events} events`;
    }

    if (prev === null) {
      live = clusters.map((c) => born(c, t));
    } else {
      const { oldToNew, newFromOld } = matchSamples(prev, clusters);
      const nextLive = clusters.map(() => null);

      oldToNew.forEach((ids, o) => {
        if (ids.length === 0) { events.vanished++; lifetimes.push({ ...live[o], tDied: t }); }
        else if (ids.length > 1) { events.split++; lifetimes.push({ ...live[o], tDied: t }); }
      });

      newFromOld.forEach((olds, n) => {
        if (olds.length === 0) {
          events.appeared++;
          nextLive[n] = born(clusters[n], t);
        } else if (olds.length > 1) {
          events.merged++;
          // Olds that split were already closed above; close only the rest.
          for (const o of olds) if (oldToNew[o].length === 1) lifetimes.push({ ...live[o], tDied: t });
          nextLive[n] = born(clusters[n], t);
        } else {
          const o = olds[0];
          if (oldToNew[o].length > 1) {
            nextLive[n] = born(clusters[n], t);        // a fragment of a split
          } else {
            if (clusters[n].size > prev[o].size) events.grew++;
            else if (clusters[n].size < prev[o].size) events.shrank++;
            else events.survived++;
            // Identity carries. Species is re-read, because growing changes it.
            nextLive[n] = { species: clusters[n].species, size: clusters[n].size, tBorn: live[o].tBorn };
          }
        }
      });
      live = nextLive.map((x, n) => x || born(clusters[n], t));
    }

    if (s >= settleAfter) {
      for (const c of clusters) {
        let e = species.get(c.species);
        if (!e) { e = { sig: c.species, size: c.size, seen: 0, bSum: 0, kSum: 0, kMin: 255, kMax: 1 }; species.set(c.species, e); }
        e.seen++; e.bSum += c.meanB; e.kSum += c.kindMean;
        e.kMin = Math.min(e.kMin, c.kindMin);
        e.kMax = Math.max(e.kMax, c.kindMax);
      }
    }
    prev = clusters; prevT = t;
  }

  // Instances open at the end are censored, not dead.
  const openLives = live.map((x) => ({ ...x, tDied: prevT, censored: true }));
  // The final sample on its own. The selectivity figure over all samples is
  // confounded: median life is many sample intervals, so one cluster is
  // counted a dozen times and its signature recurs for that reason alone.
  // These clusters are each counted once, so they are independent.
  const finalClusters = prev.map((c) => ({ size: c.size, species: c.species }));
  return { species, events, lifetimes, openLives, finalClusters, checksOk, checkNote, tEnd: prevT };
}

// ===================================================================== main
console.log(`=== Census: ${SEEDS.length} seeds, ${EVENT_BUDGET.toLocaleString()} events each, ${SAMPLES} samples ===`);
console.log(`  CANDIDATE_ZERO constants -- SCREENED BY NOTHING. Nothing here says anything`);
console.log(`  about the physics until the search space is swept. That sweep is step 2.`);
console.log(`  Thermostat: hot band ${THERMOSTAT_DEFAULT.HOT_T}, cold ${THERMOSTAT_DEFAULT.COLD_T}, ${THERMOSTAT_DEFAULT.BAND_ROWS} rows each.`);
console.log(`  Species named by valence multiset, v(k) = k mod ${M}; kind reported beside it.`);
console.log("");

const all = [];
for (const seed of SEEDS) {
  const t0 = Date.now();
  const r = runCensus(seed);
  all.push({ seed, ...r });
  console.log(`seed ${seed}: t = ${r.tEnd.toFixed(1)}, ${r.species.size} signatures, ` +
    `${r.lifetimes.length} closed instances, ${r.openLives.length} alive at the end, ` +
    `${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  cross-check vs engine: ${r.checksOk
    ? "ok -- walk bonds x2 == census().bondBits AND members + free == occupied, all " + SAMPLES + " samples"
    : "FAIL -- " + r.checkNote}`);
}

if (!all.every((r) => r.checksOk)) {
  console.log("");
  console.log("CROSS-CHECK FAILED -- the walk disagrees with the engine, so nothing below is trustworthy.");
  process.exit(1);
}

// ----------------------------------------------------------- the table
console.log("");
console.log("=== The table: signatures by how many cluster-samples stood ===");
console.log(`  'seeds' is how many of the ${SEEDS.length} seeds produced it at all -- rule 12.`);
console.log("");
const merged = new Map();
for (const r of all) {
  for (const e of r.species.values()) {
    let m = merged.get(e.sig);
    if (!m) { m = { sig: e.sig, size: e.size, seen: 0, bSum: 0, kSum: 0, kMin: 255, kMax: 1, seeds: 0 }; merged.set(e.sig, m); }
    m.seen += e.seen; m.bSum += e.bSum; m.kSum += e.kSum;
    m.kMin = Math.min(m.kMin, e.kMin);
    m.kMax = Math.max(m.kMax, e.kMax);
    m.seeds++;
  }
}
const rows = [...merged.values()].sort((a, b) => b.seen - a.seen);
console.log("rank  size  valences         standing   seeds  mean B  kinds      mean kind");
rows.slice(0, TOP_SPECIES).forEach((e, i) => {
  const sig = e.sig.length > 16 ? e.sig.slice(0, 14) + ".." : e.sig;
  console.log(
    String(i + 1).padEnd(6) + String(e.size).padEnd(6) + sig.padEnd(17) +
    String(e.seen).padEnd(11) + String(e.seeds).padEnd(7) +
    (e.bSum / e.seen).toFixed(2).padEnd(8) +
    `${e.kMin}-${e.kMax}`.padEnd(11) + (e.kSum / e.seen).toFixed(0));
});
console.log(`  ${rows.length} distinct signatures; ${rows.filter((r) => r.seeds === SEEDS.length).length} on every seed.`);

// ------------------------------------------------------- the size spectrum
console.log("");
console.log('=== Depth: the size spectrum (item 5 -- "a handful and nothing else would mean law 2 needs more structure") ===');
const bySize = new Map();
for (const e of merged.values()) {
  const b = bySize.get(e.size) || { sigs: 0, standing: 0 };
  b.sigs++; b.standing += e.seen;
  bySize.set(e.size, b);
}
// A count of signatures is NOT depth on its own, and reading it as depth was
// the first mistake this file made. A signature is a multiset of size n drawn
// from M valences, so C(n + M - 1, M - 1) of them exist whether or not the
// chemistry does anything. The question item 5 actually asks is whether the
// laws SELECT: of the signatures that could stand, how many do?
//
// The null is sampling with no selection at all -- draw `standing` signatures
// uniformly from the possible set and count the distinct ones:
//     expected = P * (1 - (1 - 1/P)^standing)
// Observed well below that null is selection. Observed at the null means the
// variety is combinatorial and the chemistry is not choosing anything.
const binom = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return Math.round(r);
};
console.log("size  possible  standing  expected if no selection  observed  selectivity");
[...bySize.keys()].sort((a, b) => a - b).forEach((k) => {
  const b = bySize.get(k);
  const P = binom(k + M - 1, M - 1);
  const expected = P * (1 - Math.pow(1 - 1 / P, b.standing));
  console.log(
    String(k).padEnd(6) + String(P).padEnd(10) + String(b.standing).padEnd(10) +
    expected.toFixed(0).padEnd(26) + String(b.sigs).padEnd(10) +
    (b.sigs / expected).toFixed(2));
});
console.log("  selectivity 1.00 = every signature the sampling allows; lower = the laws are choosing.");
console.log("  CONFOUNDED: a cluster outlives many sample intervals, so its signature recurs");
console.log("  because it is the same cluster, not because the laws prefer it. The table below");
console.log("  repeats this on one sample only, where every cluster is counted exactly once.");

console.log("");
console.log("=== The same measurement on independent clusters: the final sample of each seed ===");
const finalBySize = new Map();
for (const r of all) {
  for (const c of r.finalClusters) {
    const b = finalBySize.get(c.size) || { n: 0, sigs: new Set() };
    b.n++; b.sigs.add(c.species);
    finalBySize.set(c.size, b);
  }
}
// The metric has no power where clusters are rarer than possible signatures:
// with 3 clusters and 480,700 signatures available, 3 distinct ones is all
// that can happen and selectivity reads 1.00 whatever the laws do. Only rows
// with coverage well above 1 can say anything.
console.log("size  possible  clusters  coverage  expected if none  observed  selectivity  informative");
[...finalBySize.keys()].sort((a, b) => a - b).forEach((k) => {
  const b = finalBySize.get(k);
  const P = binom(k + M - 1, M - 1);
  const expected = P * (1 - Math.pow(1 - 1 / P, b.n));
  const coverage = b.n / P;
  console.log(
    String(k).padEnd(6) + String(P).padEnd(10) + String(b.n).padEnd(10) +
    coverage.toFixed(2).padEnd(10) + expected.toFixed(1).padEnd(18) +
    String(b.sigs.size).padEnd(10) + (b.sigs.size / expected).toFixed(2).padEnd(13) +
    (coverage >= 3 ? "yes" : coverage >= 1 ? "weak" : "no"));
});
console.log("  This is the figure to quote. Above, repeated sampling flatters the selection;");
console.log("  here each cluster appears once, so a ratio below 1 is the laws choosing.");
console.log("  Read only the 'yes' rows: elsewhere there are too few clusters for a repeat");
console.log("  to be possible, so selectivity reads 1.00 by arithmetic rather than by physics.");

// ------------------------------------------------------------- lifetimes
console.log("");
console.log("=== How long they last, in Lab time ===");
const allLives = all.flatMap((r) => r.lifetimes.map((l) => ({ ...l, life: l.tDied - l.tBorn })));
const allOpen  = all.flatMap((r) => r.openLives.map((l) => ({ ...l, life: l.tDied - l.tBorn })));
if (allLives.length) {
  const lives = allLives.map((l) => l.life);
  console.log(`  closed instances ${allLives.length}: median life ${med(lives).toFixed(2)}, max ${Math.max(...lives).toFixed(1)}`);
  console.log(`  alive at the end (censored -- a LOWER bound) ${allOpen.length}: median ${allOpen.length ? med(allOpen.map((l) => l.life)).toFixed(2) : "-"}`);
  const long = allLives.filter((l) => l.life >= LONG_LIVED_T).length;
  console.log(`  lasting >= ${LONG_LIVED_T} time units: ${long} of ${allLives.length} (${(100 * long / allLives.length).toFixed(1)}%)`);
  console.log("");
  console.log("  size  instances  median life  max life");
  const sizes = [...new Set(allLives.map((l) => l.size))].sort((a, b) => a - b);
  for (const z of sizes.slice(0, 12)) {
    const g = allLives.filter((l) => l.size === z).map((l) => l.life);
    console.log("  " + String(z).padEnd(6) + String(g.length).padEnd(11) +
      med(g).toFixed(2).padEnd(13) + Math.max(...g).toFixed(1));
  }
}

// ------------------------------------------------------------ encounters
console.log("");
console.log("=== What happens when they meet: outcomes observed in a free run ===");
const ev = { survived: 0, grew: 0, shrank: 0, merged: 0, split: 0, vanished: 0, appeared: 0 };
for (const r of all) for (const k of Object.keys(ev)) ev[k] += r.events[k];
const total = Object.values(ev).reduce((a, b) => a + b, 0);
for (const [k, v] of Object.entries(ev)) {
  console.log(`  ${k.padEnd(10)}${String(v).padStart(8)}  ${(100 * v / total).toFixed(1)}%`);
}
console.log("");
console.log("  These are the encounters the run HAPPENED to produce, at one arbitrary");
console.log("  point in the search space. README asks for behaviour \"measured by running");
console.log("  collisions\" -- aiming two chosen species at each other -- which this file");
console.log("  does NOT do. That is the next harness, and it needs this table to pick the pair.");
