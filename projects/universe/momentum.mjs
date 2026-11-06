// Option B: momentum as an integer hex vector, speed derived as p/k.
// Four questions, all answerable by enumeration and none needing a simulation:
//   1. Does speed-as-a-rate give a real spread, or does everything pile up?
//   2. Do momentum-conserving collisions exist, and are there enough of them?
//   3. Do they still exist if kinetic energy must ALSO be conserved?
//   4. Does it fit in four bytes?
// See law 1 in HOW-WE-DECIDED.md.

// Cube coordinates on a hex lattice: three axes summing to zero, so two
// independent numbers. Squared length is (x^2+y^2+z^2)/2; we carry Q = the
// un-halved sum to stay in integers.
const Q = (p) => p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

// every cube vector with components in [-R, R] summing to zero
function vectors(R) {
  const out = [];
  for (let x = -R; x <= R; x++) for (let y = -R; y <= R; y++) {
    const z = -x - y;
    if (Math.abs(z) <= R) out.push([x, y, z]);
  }
  return out;
}

// ------------------------------------------------------------------ 1
// Speed as a RATE: a primitive steps one hexagon every 1/v steps, where
// v = |p| / sqrt(k^2 + |p|^2) -- relativity's form, law 1's rule since
// 2026-11-06 (lab.mjs matterSpeed); it was min(1, |p| / k). Always under one
// hexagon per step, so the causal limit holds by construction and nothing
// with mass ever reaches it. How many distinct speeds does that give?
console.log('=== 1. Does speed-as-a-rate give a real spread of speeds? ===');
for (const R of [3, 7, 15]) {
  const vs = vectors(R);
  const maxQ = Math.max(...vs.map(Q));
  const speeds = new Set();
  let capped = 0, frozen = 0, total = 0;
  for (let k = 1; k <= 255; k++) {
    for (const p of vs) {
      if (Q(p) === 0) continue;
      total++;
      // |p| = sqrt(Q/2); compare without floating point where it matters
      const v = Math.sqrt(Q(p) / (2 * k * k + Q(p)));
      if (v >= 1) { capped++; speeds.add(1); continue; }   // cannot happen now; kept as the check
      const stepEvery = Math.round(1 / v);
      if (stepEvery > 1000) { frozen++; continue; }   // one step per 1000+ ticks
      speeds.add(1 / stepEvery);
    }
  }
  const sl = [...speeds].sort((a, b) => b - a);
  console.log(`  momentum range +-${String(R).padStart(2)} (${vs.length} vectors, max |p|=${(Math.sqrt(maxQ / 2)).toFixed(2)}):`);
  console.log(`    ${sl.length} distinct speeds, from 1 (every step) to 1/${Math.round(1 / sl[sl.length - 1])} (one step per ${Math.round(1 / sl[sl.length - 1])})`);
  console.log(`    at the causal limit: ${(100 * capped / total).toFixed(1)}% of (kind, momentum) pairs | effectively frozen: ${(100 * frozen / total).toFixed(1)}%`);
}

// ------------------------------------------------------------------ 2 & 3
// Collisions. Two primitives of kinds k1, k2 carrying p1, p2 meet. An outcome
// is any (q1, q2) with q1 + q2 = p1 + p2. That is momentum conservation and it
// is easy. The question the record never asked is whether the outcome is
// PINNED -- in real physics momentum AND kinetic energy together determine it.
// Without kinetic energy the choice is arbitrary, which is a designer decision
// dressed as physics. So count both.
function outcomes(k1, k2, p1, p2, R, requireEnergy) {
  const P = add(p1, p2);
  const vs = vectors(R);
  let n = 0, nontrivial = 0;
  // kinetic energy is Q/(2k) up to a constant; compare k2*Q1 + k1*Q2 scaled
  const e0 = Q(p1) * k2 + Q(p2) * k1;        // = 2*k1*k2*(KE1 + KE2), an integer
  for (const q1 of vs) {
    const q2 = [P[0] - q1[0], P[1] - q1[1], P[2] - q1[2]];
    if (Math.max(Math.abs(q2[0]), Math.abs(q2[1]), Math.abs(q2[2])) > R) continue;
    if (requireEnergy && Q(q1) * k2 + Q(q2) * k1 !== e0) continue;
    n++;
    if (!(eq(q1, p1) && eq(q2, p2)) && !(eq(q1, p2) && eq(q2, p1))) nontrivial++;
  }
  return { n, nontrivial };
}

for (const requireEnergy of [false, true]) {
  console.log(`\n=== ${requireEnergy ? '3' : '2'}. Collision outcomes, conserving momentum${requireEnergy ? ' AND kinetic energy' : ' only'} ===`);
  for (const R of [3, 7, 15]) {
    const vs = vectors(R).filter((p) => Q(p) > 0);
    let cases = 0, dead = 0, totalNon = 0, worstPairs = [];
    let seed = 7 >>> 0;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let t = 0; t < 4000; t++) {
      const k1 = 1 + ((rnd() * 255) | 0), k2 = 1 + ((rnd() * 255) | 0);
      const p1 = vs[(rnd() * vs.length) | 0], p2 = vs[(rnd() * vs.length) | 0];
      const r = outcomes(k1, k2, p1, p2, R, requireEnergy);
      cases++; totalNon += r.nontrivial;
      if (r.nontrivial === 0) { dead++; if (worstPairs.length < 3) worstPairs.push(`k=${k1},${k2}`); }
    }
    console.log(`  range +-${String(R).padStart(2)}: mean ${(totalNon / cases).toFixed(1).padStart(6)} outcomes that actually change something | ` +
      `collisions with NO legal outcome but the identity: ${(100 * dead / cases).toFixed(1)}%${dead ? '  e.g. ' + worstPairs.join(' ') : ''}`);
  }
}

// ------------------------------------------------------------------ 4
// EIGHT bytes as of 2026-11-04: energy 16 bits, momentum +-15. The four-byte
// column is kept because it is what forced the old +-3. README item 15.
const EBITS = 16;
console.log('\n=== 4. Does it fit? (eight bytes as of 2026-11-04) ===');
for (const R of [3, 7, 15, 31]) {
  const bitsPer = Math.ceil(Math.log2(2 * R + 1));
  const total = 8 /*kind*/ + 6 /*bonds*/ + EBITS + 2 * bitsPer;
  const old4 = 8 + 6 + 11 + 2 * bitsPer;
  console.log(`  range +-${String(R).padStart(2)}: ${bitsPer} bits x 2 = ${String(2 * bitsPer).padStart(2)} | kind 8 + bonds 6 + energy ${EBITS} + momentum ${String(2 * bitsPer).padStart(2)} = ${String(total).padStart(2)} of 64 ${total <= 64 ? 'FITS   ' : 'TOO BIG'} | old 4-byte word (energy 11): ${String(old4).padStart(2)} of 32 ${old4 <= 32 ? 'fit' : 'did not fit'}`);
}

// ------------------------------------------------------------------ 5
// NOTE (added after retraction): checks 3 and 5 below test PAIRS, but collisions
// resolve in three-cell Margolus blocks, and they demand kinetic energy be the
// exact fraction p^2/2m. Both are wrong. The numbers are real; they measure the
// wrong thing. Checks 7-9 are the corrected version -- see law 1 in
// HOW-WE-DECIDED.md, *Retraction - kinetic energy is not impossible*.
// Check 3 says exact elastic collisions mostly cannot happen: two thirds have
// no legal outcome. But real collisions need not be elastic -- kinetic energy
// can become heat, and there is a heat field to put it in. That demands the
// shortfall be a whole number, because energy is an integer.
//   KE = Q/(2k), so the shortfall is [(Q1-Qa)k2 + (Q2-Qb)k1] / (2*k1*k2).
// How often is that a non-negative integer?
console.log('\n=== 5. Inelastic instead: can the kinetic-energy shortfall be whole? ===');
{
  const R = 3;
  const vs = vectors(R).filter((p) => Q(p) > 0);
  const all = vectors(R);
  let seed = 7 >>> 0;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let cases = 0, dead = 0, meanN = 0, dissipative = 0;
  for (let t = 0; t < 4000; t++) {
    const k1 = 1 + ((rnd() * 255) | 0), k2 = 1 + ((rnd() * 255) | 0);
    const p1 = vs[(rnd() * vs.length) | 0], p2 = vs[(rnd() * vs.length) | 0];
    const P = add(p1, p2), den = 2 * k1 * k2;
    let n = 0, anyLoss = 0;
    for (const q1 of all) {
      const q2 = [P[0] - q1[0], P[1] - q1[1], P[2] - q1[2]];
      if (Math.max(Math.abs(q2[0]), Math.abs(q2[1]), Math.abs(q2[2])) > R) continue;
      if (eq(q1, p1) && eq(q2, p2)) continue;
      const num = (Q(p1) - Q(q1)) * k2 + (Q(p2) - Q(q2)) * k1;
      if (num < 0) continue;                 // would create energy -- forbidden
      if (num % den !== 0) continue;          // shortfall is not a whole number
      n++; if (num > 0) anyLoss++;
    }
    cases++; meanN += n; if (n === 0) dead++; if (anyLoss > 0) dissipative++;
  }
  console.log(`  momentum range +-${R}, 4000 random collisions:`);
  console.log(`    mean outcomes with a WHOLE non-negative shortfall: ${(meanN / cases).toFixed(2)}`);
  console.log(`    collisions with no legal outcome at all: ${(100 * dead / cases).toFixed(1)}%`);
  console.log(`    collisions that could actually shed heat (shortfall > 0): ${(100 * dissipative / cases).toFixed(1)}%`);
}

// And the control: momentum only, outcome chosen at random, which is what a
// lattice gas does. Does momentum still spread between unequal masses?
console.log('\n=== 6. Control -- momentum-only collisions: does mass matter at all? ===');
{
  const R = 3, all = vectors(R);
  let seed = 11 >>> 0;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  // Does a heavy primitive end up slower than a light one after many random
  // momentum-conserving exchanges? That is the whole point of option B.
  const bands = [[1, 16], [100, 150], [240, 255]];
  for (const [lo, hi] of bands) {
    let speed = 0, n = 0;
    for (let t = 0; t < 20000; t++) {
      const k = lo + ((rnd() * (hi - lo + 1)) | 0);
      const p = all[(rnd() * all.length) | 0];
      if (Q(p) === 0) continue;
      speed += Math.sqrt(Q(p) / (2 * k * k + Q(p))); n++;
    }
    console.log(`  kinds ${String(lo).padStart(3)}-${String(hi).padStart(3)}: mean speed ${(speed / n).toFixed(4)} hexagons per step  (one step every ${(1 / (speed / n)).toFixed(0)})`);
  }
  console.log('  -- same momentum distribution, speed falls with mass. That is inertia, and it');
  console.log('     needs no kinetic energy to work.');
}

// ------------------------------------------------------------------ 7
// The corrected test. Stop demanding kinetic energy be a fraction and define it
// as a whole number instead. KE(p,k) = floor(S * Q(p) / 2k), where Q is the
// UN-HALVED squared length (true |p|^2 is Q/2); a collision conserves momentum
// exactly and moves whatever KE changes by into or out of the heat field, so
// total energy is exact by construction.
//
// Widths updated 2026-11-04 with the eight-byte word. The window is now SOLVED
// rather than scanned: the old version probed {1,16,64,128,256} and printed
// "the window is 64 to 128", which was a coarse-scan artifact -- the real
// four-byte window was 29 to 227. Both edges are printed below for each word.
const EMAX = 65535;
const RNOW = 15;
const SADOPTED = 64;

function keWindow(R, emax) {
  const maxQ = Math.max(...vectors(R).map(Q));
  let lo = null, hi = null;
  for (let S = 1; S <= 200000; S++) {
    let zero = 0;
    for (let k = 1; k <= 255; k++) if (Math.floor(S * maxQ / (2 * k)) === 0) zero++;
    if (lo === null && zero === 0) lo = S;
    if (Math.floor(S * maxQ / 2) <= emax) hi = S;
    else if (lo !== null) break;
  }
  return { lo, hi, maxQ };
}

console.log('\n=== 7. Kinetic energy as a whole number: what scale factor works? ===');
for (const [label, R, emax] of [['four bytes, until 2026-11-04', 3, 2047], ['eight bytes, now      ', RNOW, EMAX]]) {
  const w = keWindow(R, emax);
  console.log(`  ${label}: +-${String(R).padStart(2)}, max Q ${String(w.maxQ).padStart(3)}, energy max ${String(emax).padStart(5)} -> S from ${w.lo} to ${w.hi}`);
}
console.log('');
console.log('     S   kind 1   kind 16   kind 64   kind 255   kinds reading zero   % of field   overflow?');
for (const S of [1, 2, 16, 32, 64, 128, 256, 291]) {
  const KE = (p, k) => Math.floor(S * Q(p) / (2 * k));
  const maxFor = (k) => Math.max(...vectors(RNOW).map((p) => KE(p, k)));
  let zero = 0;
  for (let k = 1; k <= 255; k++) if (maxFor(k) === 0) zero++;
  const pct = ((maxFor(1) / EMAX) * 100).toFixed(1) + '%';
  const mark = S === SADOPTED ? ' <- ADOPTED' : '';
  console.log(`  ${String(S).padStart(4)} ${String(maxFor(1)).padStart(8)} ${String(maxFor(16)).padStart(9)} ${String(maxFor(64)).padStart(9)} ${String(maxFor(255)).padStart(10)} ${String(zero).padStart(14)} ${String(pct).padStart(12)}       ${maxFor(1) > EMAX ? 'OVERFLOWS' : 'ok'}${mark}`);
}
console.log(`  -> window is 2 to 291. ADOPTED S = ${SADOPTED}: a power of two, no kind reads zero, and`);
console.log('     max KE is 22% of the field, so a primitive stopping dead can dump its motion');
console.log('     into a hexagon that was already warm. At S = 291 that is 99.9% and the dump');
console.log('     always overflows. Law 1 in THE-LAWS.md states the choice and these edges.');

// ------------------------------------------------------------------ 8
console.log(`\n=== 8. Collisions under whole-number kinetic energy (S = ${SADOPTED}, +-${RNOW}) ===`);
{
  const S = SADOPTED, R = RNOW, vs = vectors(R);
  const KE = (p, k) => Math.floor(S * Q(p) / (2 * k));
  let seed = 99 >>> 0; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let dead = 0, cases = 0, mean = 0, toHeat = 0, fromHeat = 0;
  for (let t = 0; t < 4000; t++) {
    const k1 = 1 + ((rnd() * 255) | 0), k2 = 1 + ((rnd() * 255) | 0);
    const p1 = vs[(rnd() * vs.length) | 0], p2 = vs[(rnd() * vs.length) | 0];
    const thermal = (rnd() * (EMAX * 0.39)) | 0;   // same fraction of the field as the old 800/2047
    const P = add(p1, p2), before = KE(p1, k1) + KE(p2, k2);
    let n = 0, up = 0, down = 0;
    for (const q1 of vs) {
      const q2 = [P[0] - q1[0], P[1] - q1[1], P[2] - q1[2]];
      if (Math.max(Math.abs(q2[0]), Math.abs(q2[1]), Math.abs(q2[2])) > R) continue;
      if (eq(q1, p1) && eq(q2, p2)) continue;
      const d = before - (KE(q1, k1) + KE(q2, k2));
      if (d < 0 && thermal < -d) continue;              // not enough heat to absorb
      n++; if (d > 0) down++; if (d < 0) up++;
    }
    cases++; mean += n; if (!n) dead++; if (down) toHeat++; if (up) fromHeat++;
  }
  console.log(`  mean legal outcomes      ${(mean / cases).toFixed(1)}`);
  console.log(`  no legal outcome         ${(100 * dead / cases).toFixed(1)}%`);
  console.log(`  motion -> heat possible  ${(100 * toHeat / cases).toFixed(0)}%`);
  console.log(`  heat -> motion possible  ${(100 * fromHeat / cases).toFixed(0)}%`);
}

// ------------------------------------------------------------------ 9
// Defining energy by a rounded formula invites the free-energy pump AGENTS rule
// 6 warns about. It cannot happen, because KE is a pure function of (p, k): any
// path returning to its starting state returns exactly what it borrowed. Verify.
console.log('\n=== 9. Can the rounding be turned into a free-energy pump? ===');
// Run at BOTH ranges on purpose. A random walk closes far less often at +-15
// (721 vectors) than at +-3 (37), so the wide run finds few loops and carries
// little statistical weight -- switching this check to +-15 alone would quietly
// gut it. The +-3 run is where the loop count comes from; the guarantee itself
// is structural and holds at any width.
for (const [R, trials] of [[3, 3000], [RNOW, 400]]) {
  const S = SADOPTED, vs = vectors(R);
  const KE = (p, k) => Math.floor(S * Q(p) / (2 * k));
  let seed = 5 >>> 0; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let worst = 0, loops = 0;
  for (let trial = 0; trial < trials; trial++) {
    const k1 = 1 + ((rnd() * 255) | 0), k2 = 1 + ((rnd() * 255) | 0);
    let p1 = vs[(rnd() * vs.length) | 0], p2 = vs[(rnd() * vs.length) | 0];
    const start = [p1, p2]; let heat = 0;
    for (let step = 0; step < 80; step++) {
      const P = add(p1, p2), opts = [];
      for (const q1 of vs) {
        const q2 = [P[0] - q1[0], P[1] - q1[1], P[2] - q1[2]];
        if (Math.max(Math.abs(q2[0]), Math.abs(q2[1]), Math.abs(q2[2])) > R) continue;
        opts.push([q1, q2]);
      }
      const [a, b] = opts[(rnd() * opts.length) | 0];
      heat += (KE(p1, k1) + KE(p2, k2)) - (KE(a, k1) + KE(b, k2));
      p1 = a; p2 = b;
      if (eq(p1, start[0]) && eq(p2, start[1])) { loops++; worst = Math.max(worst, Math.abs(heat)); }
    }
  }
  const verdict = loops === 0
    ? '-- NO LOOPS CLOSED, so this range tested nothing; see the +-3 run'
    : (worst === 0 ? '-- no pump' : '-- LEAK');
  console.log(`  +-${String(R).padStart(2)} (${trials} trials): ${String(loops).padStart(6)} closed loops | worst energy gained: ${worst}  ${verdict}`);
}
console.log('  Kinetic energy is a function of mass and momentum, so a round trip returns');
console.log('  exactly the energy it borrowed. The guarantee is structural, not statistical.');
