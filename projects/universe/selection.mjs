// selection.mjs -- README item 5, measured a second way, because the first way
// could not see the answer.
//
// census.mjs asks whether law 2 SELECTS: are some combinations stable and
// others not? Its statistic is presence/absence -- distinct signatures over
// the number expected from drawing at random (Feller). At size 2 that reads
// 0.97 under every condition tried, and 0.97 is arithmetic: there are 36
// valence pairs, (0, 0) has B = 0 and cannot bond, so 35 / 36 = 0.972. With
// thousands of dimers standing, a pair the laws suppress threefold still
// APPEARS, and presence pins the ratio at 1 whatever the physics does. It is
// the trap item 5 already catalogues twice: a statistic that cannot show the
// thing it is named for.
//
// What can show it is ABUNDANCE. If law 2 selects, a strongly bonded pair
// should stand more often than a weakly bonded one. So this file counts
// standing dimers per signature and reads the trend against B.
//
// Law 2 breaks a bond when temperature >= B, B in 1..8, temperature = e/kind.
// So the condition that decides whether law 2 discriminates at all is the
// temperature of the bulk -- and seedWorld sets every energy to 0, leaving the
// thermostat's 6 held rows of 258 as the only source. Three conditions:
//
//   census   census.mjs's own: thermostat on, energy seeded 0. Reported for
//            the bulk temperature it actually reaches.
//   cold     thermostat OFF, every primitive seeded at temperature 0. The
//            control (AGENTS.md lesson 1): the break rule never runs.
//   hot      thermostat OFF, every primitive seeded at temperature 8, the top
//            of B's range, so every bond strength is in play.
//
// CONFOUND, kept in view rather than corrected: valence 0 has capacity 1, so
// every 0-x pair is pinned in a dimer and can grow no further. That inflates
// low-B dimer counts for a reason that is law 4, not law 2. Read the trend
// over B = 2..8, not the B = 1 point.
//
// rule 11: run() closes the Lab's own books at the end of every run, and the
// walk's bond count is checked against census(w).bondBits before a number is
// printed. rule 12: three seeds, summed, with each seed's ratio beside it.
//
// CANDIDATE_ZERO constants -- a plumbing point, not a chosen physics.
//
//   node selection.mjs

import { Lab, census, CELLS, N, rOf, bindingEnergy } from "./lab.mjs";
import { THERMOSTAT_DEFAULT } from "./constants.mjs";
import { walk, M } from "./clusters.mjs";

// rule 8: named, with units.
const SEEDS         = [1, 2, 3];
const EVENT_BUDGET  = 1200000;      // events per run, census.mjs's figure
const FILL          = 0.35;         // census.mjs's seeded world
const MOMENTUM_SEED = 6;
const kindDraw      = (rng) => 1 + rng.below(255);
const NO_BANDS      = { ...THERMOSTAT_DEFAULT, BAND_ROWS: 0 };

const CONDITIONS = [
  { name: "census", thermostat: THERMOSTAT_DEFAULT, T0: 0 },
  { name: "cold",   thermostat: NO_BANDS,           T0: 0 },
  { name: "hot",    thermostat: NO_BANDS,           T0: 8 },
];

// The 36 unordered valence pairs and their B. A pair's B is the bond law 2
// gives two primitives of those valences -- B depends on valence only.
const PAIRS = [];
for (let a = 0; a < M; a++) for (let b = a; b < M; b++) {
  PAIRS.push({ sig: `${a}-${b}`, B: M - Math.abs(a + b - M) });
}

const quantile = (s, q) => s[Math.min(s.length - 1, Math.floor(q * s.length))];

function runOne({ thermostat, T0 }, seed) {
  const lab = new Lab({ seed, thermostat });
  lab.seedWorld(FILL, kindDraw, { momentumRange: MOMENTUM_SEED });
  const w = lab.w;
  if (T0 > 0) for (let i = 0; i < CELLS; i++) if (w.kind[i]) w.energy[i] = T0 * w.kind[i];
  lab.start();                        // the ledger opens on the seeded energy
  lab.run(EVENT_BUDGET);              // and closes at the end, or throws

  const { clusters, bondsSeen } = walk(w, 2);
  if (bondsSeen * 2 !== census(w).bondBits) throw new Error(`seed ${seed}: walk disagrees with engine`);

  const dimers = new Map(), band = thermostat.BAND_ROWS;
  let bSum = 0, nDimers = 0;
  for (const c of clusters) {
    if (c.size !== 2) continue;
    dimers.set(c.species, (dimers.get(c.species) || 0) + 1);
    bSum += c.meanB; nDimers++;
  }
  // Bulk temperature: every primitive outside the held rows, if any.
  const temps = [];
  for (let i = 0; i < CELLS; i++) {
    if (!w.kind[i]) continue;
    const r = rOf(i);
    if (band > 0 && (r < band || r >= N - band)) continue;
    temps.push(w.energy[i] / w.kind[i]);
  }
  temps.sort((x, y) => x - y);
  return { dimers, nDimers, bSum, temps, events: lab.events };
}

// Per-signature abundance in each B class: dimers standing with that B, over
// the number of valence pairs that HAVE that B -- so a class is not favoured
// for containing more pairs.
function byB(dimers) {
  const out = {};
  for (let B = 1; B <= M; B++) {
    const sigs = PAIRS.filter((p) => p.B === B);
    const n = sigs.reduce((a, p) => a + (dimers.get(p.sig) || 0), 0);
    out[B] = { pairs: sigs.length, perSig: n / sigs.length };
  }
  return out;
}

console.log(`=== Item 5 by abundance: ${SEEDS.length} seeds x ${EVENT_BUDGET.toLocaleString()} events, final sample ===`);
console.log(`  CANDIDATE_ZERO constants -- a plumbing point. Nothing here is a result about a chosen physics.`);
console.log("");

for (const cond of CONDITIONS) {
  const t0 = Date.now();
  const sum = new Map(); let nDimers = 0, bSum = 0; const temps = []; const perSeed = [];
  for (const seed of SEEDS) {
    const r = runOne(cond, seed);
    for (const [k, v] of r.dimers) sum.set(k, (sum.get(k) || 0) + v);
    nDimers += r.nDimers; bSum += r.bSum; temps.push(...r.temps);
    const b = byB(r.dimers);
    perSeed.push(b[2].perSig ? (b[8].perSig / b[2].perSig) : NaN);
  }
  temps.sort((x, y) => x - y);
  const b = byB(sum);
  const ratio = b[8].perSig / b[2].perSig;
  const below1 = temps.filter((t) => t < 1).length / temps.length;
  const distinct = PAIRS.filter((p) => sum.has(p.sig)).length;

  console.log(`--- ${cond.name}: thermostat ${cond.thermostat.BAND_ROWS ? "on" : "off"}, seeded T = ${cond.T0}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log(`  bulk temperature at end: median ${quantile(temps, 0.5).toFixed(3)}, p90 ${quantile(temps, 0.9).toFixed(3)}, ${(100 * below1).toFixed(1)}% below 1`);
  console.log(`  dimers standing ${nDimers}, mean B ${(bSum / nDimers).toFixed(2)}, distinct pairs ${distinct} / ${PAIRS.length} (presence: ${(distinct / PAIRS.length).toFixed(2)})`);
  console.log(`  per-signature dimers by B:  ` + Object.entries(b).map(([B, x]) => `B${B} ${x.perSig.toFixed(1)}`).join("  "));
  console.log(`  B=8 / B=2: ${ratio.toFixed(2)}x   per seed: ${perSeed.map((x) => x.toFixed(2)).join(", ")}`);
  console.log("");
}
console.log("Read B = 2..8. The B = 1 point is inflated by valence 0's capacity of 1 (law 4).");
