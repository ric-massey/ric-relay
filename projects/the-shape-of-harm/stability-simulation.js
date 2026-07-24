/**
 * stability-simulation.js
 * Reference implementation of the rank-stability analysis in section 07 of
 * "The Shape of Harm". Same logic as the copy embedded in the page.
 *
 * Run:  node stability-simulation.js
 *
 * WHAT THIS DOES
 * Each drug has five evidence scores on a 0-100 scale, and each cell carries an
 * evidence grade recording what is actually behind it:
 *
 *   M  measured  - a drug-specific figure from a cited study      (interval +/- 8)
 *   P  indirect  - a class proxy, expert part-score or extrapolation (+/- 15)
 *   J  judgment  - no drug-specific number behind the cell          (+/- 20)
 *   S  suspended - no defensible value; excluded and handled as a range
 *
 * Those intervals are read as roughly 95%, so sd = half-width / 2. The script
 * resamples all 65 cells 20,000 times and re-ranks each draw.
 *
 * TWO ERROR MODELS
 *   independent - every cell wobbles alone. Errors partly cancel across five
 *                 columns, so the composite looks steadier than its inputs.
 *   correlated  - adds a shared per-drug bias (sd 5) to every cell of a drug,
 *                 modelling one author with one blind spot. Less flattering,
 *                 and more realistic.
 *
 * WHAT IS NOT PERTURBED
 * The weights. Those are the reader's values, not an uncertain quantity, and
 * mixing them into the uncertainty would confuse a question of fact with a
 * question of priorities.
 *
 * CAVEAT
 * This is a sensitivity analysis, not an uncertainty quantification. It answers
 * one question: IF the assumed widths, the normal distribution and the assumed
 * size of the shared bias are about right, how much does the ranking move? It
 * does not establish that any of those assumptions are right. The largest
 * uncertainty of all - whether five columns is the correct structure - cannot be
 * simulated, because a model cannot resample its own shape.
 */

const COLS = ["add", "wd", "org", "oth", "ac"];

const DRUGS = {
  "Caffeine"              : { s: {add: 15, wd: 5, org: 5, oth: 0, ac: 5}, grades: "PMJJM" },
  "Psilocybin"            : { s: {add: 2, wd: 0, org: 5, oth: 2, ac: 35}, grades: "PJJJM" },
  "LSD"                   : { s: {add: 2, wd: 0, org: 5, oth: 3, ac: 45}, grades: "PJJPP" },
  "Cannabis"              : { s: {add: 30, wd: 20, org: 30, oth: 20, ac: 15}, grades: "MMPPP" },
  "MDMA"                  : { s: {add: 30, wd: 15, org: 35, oth: 10, ac: 45}, grades: "PJJJM" },
  "Ketamine"              : { s: {add: 40, wd: 20, org: 40, oth: 20, ac: 35}, grades: "JJPJM" },
  "Benzodiazepines"       : { s: {add: 55, wd: 90, org: 20, oth: 25, ac: 30}, grades: "JPJJP" },
  "Tobacco (smoked)"      : { s: {add: 90, wd: 40, org: 75, oth: 40, ac: 2}, grades: "MPMMJ" },
  "Nicotine (no smoke)"   : { s: {add: 85, wd: 35, org: 25, oth: 5, ac: 3}, grades: "PPMJJ" },
  "Cocaine"               : { s: {add: 70, wd: 45, org: 70, oth: 65, ac: 75}, grades: "MJMJM" },
  "Opioids (illicit)"     : { s: {add: 95, wd: 50, org: 55, oth: 65, ac: 95}, grades: "PMJJM" },
  "Methamphetamine"       : { s: {add: 95, wd: 55, org: 90, oth: null, ac: 70}, grades: "PJPSM" },
  "Alcohol"               : { s: {add: 55, wd: 95, org: 90, oth: 95, ac: 60}, grades: "MMMPM" }
};

const GRADE_HALF = { M: 8, P: 15, J: 20, S: null };   // 95%% intervals
const GRADE_SD   = { M: 4, P: 7.5, J: 10 };           // half-width / 2
const BIAS_SD    = 5;
const N          = 20000;

const WEIGHTS = {
  equal     : { add: 5, wd: 5, org: 5, oth: 5, ac: 5 },
  self      : { add: 8, wd: 6, org: 8, oth: 1, ac: 7 },
  society   : { add: 4, wd: 4, org: 4, oth: 10, ac: 5 },
  acute     : { add: 2, wd: 4, org: 1, oth: 1, ac: 10 }
};

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeNormal(rnd){                 // Marsaglia polar
  let spare = null;
  return function(){
    if (spare !== null) { const v = spare; spare = null; return v; }
    let u, v, q;
    do { u = rnd()*2-1; v = rnd()*2-1; q = u*u + v*v; } while (q >= 1 || q === 0);
    const m = Math.sqrt(-2*Math.log(q)/q);
    spare = v*m;
    return u*m;
  };
}

/** Composite over scored cells only. A suspended cell is excluded rather than
 *  treated as zero - "we don't know" is not the same claim as "no harm". */
function composite(drug, weights){
  let sum = 0, ws = 0;
  COLS.forEach(c => {
    const v = DRUGS[drug].s[c];
    if (v === null || v === undefined) return;
    sum += v * weights[c]; ws += weights[c];
  });
  return ws ? sum/ws : 0;
}

/** Interval on the composite, propagated from the cell grades. Errors are treated
 *  as fully correlated within a drug, which widens rather than narrows; a
 *  suspended cell contributes its full 0-100 span. */
function interval(drug, weights){
  let lo = 0, hi = 0, ws = 0;
  COLS.forEach((c, i) => {
    const v = DRUGS[drug].s[c], w = weights[c];
    ws += w;
    if (v === null || v === undefined) { hi += 100*w; return; }
    const h = GRADE_HALF[DRUGS[drug].grades[i]];
    lo += Math.max(0, v - h) * w;
    hi += Math.min(100, v + h) * w;
  });
  return ws ? [lo/ws, hi/ws] : [0, 0];
}

function simulate(weights, seed, correlated){
  const rnd = mulberry32(seed), norm = makeNormal(rnd);
  const names = Object.keys(DRUGS);
  const wins = {}, ranks = {}, buf = [];
  names.forEach(n => { wins[n] = 0; ranks[n] = []; });

  for (let it = 0; it < N; it++){
    for (let i = 0; i < names.length; i++){
      const n = names[i];
      const bias = correlated ? norm()*BIAS_SD : 0;
      let sum = 0, ws = 0;
      COLS.forEach((c, ci) => {
        const base = DRUGS[n].s[c];
        if (base === null || base === undefined) return;   // suspended
        let v = base + bias + norm()*GRADE_SD[DRUGS[n].grades[ci]];
        if (v < 0) v = 0; else if (v > 100) v = 100;
        sum += v * weights[c]; ws += weights[c];
      });
      buf[i] = { n, v: ws ? sum/ws : 0 };
    }
    buf.sort((a,b) => b.v - a.v);
    wins[buf[0].n]++;
    for (let i = 0; i < buf.length; i++) ranks[buf[i].n].push(i+1);
  }

  const pct = (arr,q) => { const a = arr.slice().sort((x,y)=>x-y); return a[Math.floor(q*(a.length-1))]; };
  const out = { wins:{}, ranks:{} };
  names.forEach(n => {
    out.wins[n]  = wins[n]/N;
    out.ranks[n] = { median: pct(ranks[n],0.50), lo: pct(ranks[n],0.05), hi: pct(ranks[n],0.95) };
  });
  return out;
}

if (require.main === module) {
  const SEED = 7;
  const names = Object.keys(DRUGS);
  const tally = {};
  names.forEach(n => [...DRUGS[n].grades].forEach(g => tally[g] = (tally[g]||0)+1));

  console.log(`N=${N}  seed=${SEED}  bias sd=${BIAS_SD}`);
  console.log(`cells: ${names.length * COLS.length}  ` +
    Object.entries(tally).map(([k,v]) => `${k}:${v}`).join("  "));
  console.log();

  for (const mode of [true, false]) {
    console.log(mode ? "CORRELATED errors (shared per-drug bias)" : "INDEPENDENT errors");
    for (const [name, w] of Object.entries(WEIGHTS)) {
      const r = simulate(w, SEED, mode);
      const top = Object.entries(r.wins).sort((a,b)=>b[1]-a[1]).slice(0,3)
        .filter(e => e[1] >= 0.01)
        .map(([k,v]) => `${k.replace(/ \(.*\)/,"")} ${(v*100).toFixed(0)}%`).join("  ");
      console.log(`   ${name.padEnd(9)} ${top}`);
    }
    console.log();
  }

  console.log("Composite intervals and rank stability (equal weights, correlated):");
  const r = simulate(WEIGHTS.equal, SEED, true);
  names.map(n => ({ n, c: composite(n, WEIGHTS.equal), iv: interval(n, WEIGHTS.equal), rk: r.ranks[n] }))
       .sort((a,b) => b.c - a.c)
       .forEach(x => console.log(
         `   ${x.n.padEnd(20)} ~${x.c.toFixed(0).padStart(3)}  ` +
         `[${x.iv[0].toFixed(0).padStart(3)}-${x.iv[1].toFixed(0).padStart(3)}]  ` +
         `rank ${String(x.rk.median).padStart(2)} [${x.rk.lo}-${x.rk.hi}]`));

  let overlap = 0, pairs = 0;
  for (let i = 0; i < names.length; i++)
    for (let j = i+1; j < names.length; j++) {
      const a = interval(names[i], WEIGHTS.equal), b = interval(names[j], WEIGHTS.equal);
      pairs++; if (a[0] <= b[1] && b[0] <= a[1]) overlap++;
    }
  console.log(`\n   ${overlap} of ${pairs} pairwise comparisons overlap - ` +
    `only ${pairs-overlap} (${Math.round((pairs-overlap)/pairs*100)}%) are distinguishable.`);
}

module.exports = { COLS, DRUGS, GRADE_HALF, GRADE_SD, BIAS_SD, N, WEIGHTS, composite, interval, simulate };
