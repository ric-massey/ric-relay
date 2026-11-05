// Does option 4 (radiation crossing vacuum in a straight line) satisfy the
// second law? The claim is that it does, EXACTLY rather than statistically,
// given a clock rate that rises with temperature. Four checks, no simulation
// needed for the first three. See law 5 in HOW-WE-DECIDED.md.

const W = 48, H = 48;
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const OPP = (d) => (d + 3) % 6;
const idx = (q, r) => r * W + q;
const inside = (q, r) => q >= 0 && q < W && r >= 0 && r < H;

// A world: kind[] is 0 for vacuum, 1..255 for matter. energy[] is units.
function makeWorld(seed, fill) {
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const kind = new Uint8Array(W * H), energy = new Uint16Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (rnd() < fill) { kind[i] = 1 + Math.floor(rnd() * 255); energy[i] = Math.floor(rnd() * 400); }
  }
  return { kind, energy, rnd };
}

// Walk from (q,r) in direction d until matter or the boundary. Returns the
// index of the first matter hit, or -1 if it left the world.
function cast(kind, q, r, d) {
  const [dq, dr] = DIRS[d];
  for (let q2 = q + dq, r2 = r + dr; inside(q2, r2); q2 += dq, r2 += dr) {
    if (kind[idx(q2, r2)]) return idx(q2, r2);
  }
  return -1;
}

// ---------------------------------------------------------------- check 1
// Sight-line reciprocity. If i sees j along direction d, j must see i along
// the opposite direction -- same cells in between, so it should be exact.
// Everything else here depends on this.
function checkReciprocity(label, kind) {
  const sees = new Map();        // "i,d" -> j
  let lines = 0;
  for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
    const i = idx(q, r);
    if (!kind[i]) continue;
    for (let d = 0; d < 6; d++) {
      const j = cast(kind, q, r, d);
      if (j >= 0) { sees.set(`${i},${d}`, j); lines++; }
    }
  }
  let broken = 0;
  for (const [key, j] of sees) {
    const [i, d] = key.split(',').map(Number);
    if (sees.get(`${j},${OPP(d)}`) !== i) broken++;
  }
  // and the pairwise counts that the second law actually needs
  const n = new Map();
  for (const [key, j] of sees) { const i = +key.split(',')[0]; n.set(`${i}>${j}`, (n.get(`${i}>${j}`) || 0) + 1); }
  let asym = 0, pairs = 0;
  for (const [key, c] of n) { const [i, j] = key.split('>'); pairs++; if ((n.get(`${j}>${i}`) || 0) !== c) asym++; }
  console.log(`${label}: ${lines} sight lines, ${pairs} ordered pairs | reciprocity violations ${broken} | asymmetric pair counts ${asym}`);
  return { broken, asym, pairs };
}

// ---------------------------------------------------------------- check 2
// Given reciprocity, net radiative flow between any two matter cells is
// (p(T_i) - p(T_j)) * n_ij / 6, so its sign is the sign of the temperature
// difference for ANY monotone emission rate p. Verify by direct enumeration
// rather than by trusting the algebra.
function checkSecondLaw(kind, energy, C) {
  const p = (i) => Math.min(1, C * (energy[i] / kind[i]));   // clock rate, prop. to temperature
  const flow = new Map();
  for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
    const i = idx(q, r); if (!kind[i]) continue;
    for (let d = 0; d < 6; d++) {
      const j = cast(kind, q, r, d);
      if (j >= 0) flow.set(`${i}>${j}`, (flow.get(`${i}>${j}`) || 0) + p(i) / 6);
    }
  }
  let uphill = 0, downhill = 0, flat = 0, clipped = 0, matter = 0, worst = 0;
  for (let i = 0; i < W * H; i++) if (kind[i]) { matter++; if (p(i) >= 1) clipped++; }
  const seen = new Set();
  for (const key of flow.keys()) {
    const [i, j] = key.split('>').map(Number);
    if (seen.has(`${j}>${i}`)) continue;
    seen.add(key);
    const net = flow.get(key) - (flow.get(`${j}>${i}`) || 0);   // i to j
    const dT = energy[i] / kind[i] - energy[j] / kind[j];
    if (Math.abs(net) < 1e-12) flat++;
    else if (Math.sign(net) === Math.sign(dT)) downhill++;
    else { uphill++; worst = Math.max(worst, Math.abs(net)); }
  }
  console.log(`  C=${String(C).padEnd(6)} clipped ${(100 * clipped / matter).toFixed(1).padStart(5)}% of matter | downhill ${downhill} flat ${flat} UPHILL ${uphill}${uphill ? ` (worst ${worst.toFixed(4)})` : ''}`);
  return uphill;
}

// ---------------------------------------------------------------- check 3
// The same world under the rate that was NOT state-dependent: a flat clock,
// which is what the search space says today. This is the control.
function checkFlatClock(kind, energy) {
  const flow = new Map();
  for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
    const i = idx(q, r); if (!kind[i]) continue;
    for (let d = 0; d < 6; d++) { const j = cast(kind, q, r, d); if (j >= 0) flow.set(`${i}>${j}`, (flow.get(`${i}>${j}`) || 0) + 1 / 6); }
  }
  let uphill = 0, flat = 0;
  const seen = new Set();
  for (const key of flow.keys()) {
    const [i, j] = key.split('>').map(Number);
    if (seen.has(`${j}>${i}`)) continue; seen.add(key);
    const net = flow.get(key) - (flow.get(`${j}>${i}`) || 0);
    const dT = energy[i] / kind[i] - energy[j] / kind[j];
    if (Math.abs(net) < 1e-12) flat++; else if (Math.sign(net) !== Math.sign(dT)) uphill++;
  }
  console.log(`  flat clock: flat ${flat} UPHILL ${uphill}  <-- a flat clock transports nothing on net, in either direction`);
}

console.log('=== Check 1: sight-line reciprocity (the claim everything rests on) ===');
let bad = 0;
for (const fill of [0.02, 0.05, 0.15, 0.4]) {
  for (const seed of [1, 7, 99]) {
    const { kind } = makeWorld(seed, fill);
    const r = checkReciprocity(`fill ${String(fill).padEnd(5)} seed ${String(seed).padEnd(3)}`, kind);
    bad += r.broken + r.asym;
  }
}
console.log(bad === 0 ? '\nEXACT. No violations at any density.\n' : `\nFAILED: ${bad} violations.\n`);

console.log('=== Check 2: net flow between every visible pair, clock rate prop. to temperature ===');
{
  const { kind, energy } = makeWorld(7, 0.05);
  for (const C of [0.0005, 0.005, 0.05, 0.5]) checkSecondLaw(kind, energy, C);
  console.log('\n=== Check 3: control -- the flat clock in the search space today ===');
  checkFlatClock(kind, energy);
}

// ---------------------------------------------------------------- check 4
// Now actually run it. A quantum is one unit of energy in an empty hexagon
// with a direction, so an empty hexagon holds at most one per direction --
// six bits, which is exactly the bonds field that vacuum never uses. Verify
// energy is conserved against a boundary counter, measure how often the slot
// is already full (that is a cap on radiative flux, and it is real), and see
// whether a dense hot blob can actually cool.
function run(steps, C, blobR, hotT, report) {
  const kind = new Uint8Array(W * H), energy = new Uint16Array(W * H);
  const slot = new Uint8Array(W * H);          // 6-bit occupancy, vacuum only
  const cq = (W / 2) | 0, cr = (H / 2) | 0;
  let matter = 0;
  for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
    // axial distance from centre
    const dq = q - cq, dr = r - cr;
    const dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
    if (dist <= blobR) { const i = idx(q, r); kind[i] = 64; energy[i] = hotT * 64; matter++; }
  }
  let s = 12345 >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;

  const total0 = energy.reduce((a, b) => a + b, 0);
  let radiatedAway = 0, blocked = 0, attempts = 0, absorbed = 0, maxFlux = 0;

  for (let t = 0; t < steps; t++) {
    // 1. propagate every quantum one hexagon along its direction
    const next = new Uint8Array(W * H);
    let fluxThisStep = 0;
    for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
      const i = idx(q, r); if (!slot[i]) continue;
      for (let d = 0; d < 6; d++) {
        if (!(slot[i] & (1 << d))) continue;
        fluxThisStep++;
        const [dq, dr] = DIRS[d], q2 = q + dq, r2 = r + dr;
        if (!inside(q2, r2)) { radiatedAway++; continue; }        // leaves forever
        const j = idx(q2, r2);
        if (kind[j]) { energy[j]++; absorbed++; }                 // first matter it meets
        else next[j] |= (1 << d);
      }
    }
    slot.set(next);
    maxFlux = Math.max(maxFlux, fluxThisStep);

    // 2. emission: each matter hexagon acts at a rate proportional to its
    //    temperature, into one of six directions chosen uniformly
    for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
      const i = idx(q, r); if (!kind[i] || !energy[i]) continue;
      if (rnd() >= Math.min(1, C * (energy[i] / kind[i]))) continue;
      attempts++;
      const d = (rnd() * 6) | 0;
      const [dq, dr] = DIRS[d], q2 = q + dq, r2 = r + dr;
      if (!inside(q2, r2)) { energy[i]--; radiatedAway++; continue; }
      const j = idx(q2, r2);
      if (kind[j]) {                                              // conduction, law 5: downhill only
        if (energy[i] * kind[j] > energy[j] * kind[i]) { energy[i]--; energy[j]++; }
        continue;
      }
      if (slot[j] & (1 << d)) { blocked++; continue; }             // slot taken -- flux cap
      slot[j] |= (1 << d); energy[i]--;
    }
  }

  const inWorld = energy.reduce((a, b) => a + b, 0);
  let inFlight = 0;
  for (let i = 0; i < W * H; i++) for (let d = 0; d < 6; d++) if (slot[i] & (1 << d)) inFlight++;
  const closes = inWorld + inFlight + radiatedAway === total0;
  if (report) {
    console.log(`  blob r=${blobR} (${matter} cells) T0=${hotT} C=${C} after ${steps} steps:`);
    console.log(`    energy ${total0} = world ${inWorld} + in flight ${inFlight} + radiated away ${radiatedAway}  ->  ${closes ? 'CLOSES EXACTLY' : 'MISMATCH'}`);
    console.log(`    emission attempts ${attempts}, absorbed by matter ${absorbed}, slot already full ${blocked} (${(100 * blocked / Math.max(1, attempts)).toFixed(1)}% of attempts)`);
    console.log(`    peak quanta in flight in one step ${maxFlux}; mean temperature now ${(inWorld / (matter * 64)).toFixed(2)} (was ${hotT})`);
  }
  return { closes, blocked, attempts, cooledTo: inWorld / (matter * 64) };
}

console.log('\n=== Check 4: run it. Conservation, the six-slot cap, and whether a hot blob cools ===');
let allClose = true;
for (const [steps, C, blobR, hotT] of [[200, 0.02, 2, 30], [200, 0.02, 8, 30], [600, 0.02, 8, 30], [200, 0.4, 8, 30]]) {
  const r = run(steps, C, blobR, hotT, true);
  allClose = allClose && r.closes;
}
console.log(allClose ? '\nEnergy closed exactly in every run.' : '\nCONSERVATION FAILED.');

// Opacity: does the interior cool, or only the surface? Compare a thin blob
// to a thick one at equal temperature and equal step count.
console.log('\n=== Check 5: is objection 6 still true -- does the interior cool? ===');
for (const blobR of [1, 2, 4, 8, 16]) {
  const r = run(400, 0.02, blobR, 30, false);
  console.log(`  radius ${String(blobR).padStart(2)}: mean temperature 30 -> ${r.cooledTo.toFixed(2)}  (${(100 * (1 - r.cooledTo / 30)).toFixed(1)}% shed in 400 steps)`);
}

// ---------------------------------------------------------------- check 6
// The runs above are one convex blob, so every quantum flies outward and
// nothing is ever absorbed -- the path objection 4 is actually about never
// ran. Two blobs, hot and cold, separated by vacuum. Tag each quantum with
// its emitter so the net exchange can be measured in both directions.
function twoBlobs(steps, C, hotT, coldT, gap) {
  const kind = new Uint8Array(W * H), energy = new Uint16Array(W * H), side = new Int8Array(W * H);
  const R = 5, cr = (H / 2) | 0;
  const place = (cq, T, which) => {
    for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
      const dq = q - cq, dr = r - cr;
      if (Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) <= R) {
        const i = idx(q, r); kind[i] = 64; energy[i] = T * 64; side[i] = which;
      }
    }
  };
  const cqA = (W / 2 | 0) - R - ((gap / 2) | 0), cqB = (W / 2 | 0) + R + ((gap / 2) | 0);
  place(cqA, hotT, 1); place(cqB, coldT, 2);

  // quanta carried as a list so each one remembers which blob emitted it
  let quanta = [];                 // {q, r, d, from}
  const occupied = new Set();      // "idx,d" -- assert one bit per direction is enough
  let s = 999 >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const total0 = energy.reduce((a, b) => a + b, 0);
  let radiated = 0, slotClash = 0;
  const xfer = { '1>2': 0, '2>1': 0, '1>1': 0, '2>2': 0 };

  for (let t = 0; t < steps; t++) {
    const next = [];
    occupied.clear();
    for (const z of quanta) {
      const [dq, dr] = DIRS[z.d], q2 = z.q + dq, r2 = z.r + dr;
      if (!inside(q2, r2)) { radiated++; continue; }
      const j = idx(q2, r2);
      if (kind[j]) { energy[j]++; xfer[`${z.from}>${side[j]}`]++; continue; }
      const key = `${j},${z.d}`;
      if (occupied.has(key)) slotClash++; else occupied.add(key);
      next.push({ q: q2, r: r2, d: z.d, from: z.from });
    }
    quanta = next;
    for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
      const i = idx(q, r); if (!kind[i] || !energy[i]) continue;
      if (rnd() >= Math.min(1, C * (energy[i] / kind[i]))) continue;
      const d = (rnd() * 6) | 0, [dq, dr] = DIRS[d], q2 = q + dq, r2 = r + dr;
      if (!inside(q2, r2)) { energy[i]--; radiated++; continue; }
      const j = idx(q2, r2);
      if (kind[j]) { if (energy[i] * kind[j] > energy[j] * kind[i]) { energy[i]--; energy[j]++; } continue; }
      const key = `${j},${d}`;
      if (occupied.has(key)) { slotClash++; continue; }
      occupied.add(key); quanta.push({ q: q2, r: r2, d, from: side[i] }); energy[i]--;
    }
  }
  const inWorld = energy.reduce((a, b) => a + b, 0);
  const closes = inWorld + quanta.length + radiated === total0;
  let hotE = 0, coldE = 0, hotN = 0, coldN = 0;
  for (let i = 0; i < W * H; i++) { if (side[i] === 1) { hotE += energy[i]; hotN++; } if (side[i] === 2) { coldE += energy[i]; coldN++; } }
  console.log(`  gap ${String(gap).padStart(2)} C=${C} T ${hotT} vs ${coldT}, ${steps} steps:`);
  console.log(`    hot->cold ${String(xfer['1>2']).padStart(5)} units | cold->hot ${String(xfer['2>1']).padStart(5)} units | NET ${String(xfer['1>2'] - xfer['2>1']).padStart(5)} (positive = downhill)`);
  console.log(`    self-reabsorbed: hot ${xfer['1>1']}, cold ${xfer['2>2']} | radiated away ${radiated}`);
  console.log(`    temperatures ${hotT} -> ${(hotE / (hotN * 64)).toFixed(2)} and ${coldT} -> ${(coldE / (coldN * 64)).toFixed(2)}`);
  console.log(`    conservation ${closes ? 'CLOSES EXACTLY' : 'MISMATCH'} | one-bit-per-direction clashes ${slotClash}`);
  return { net: xfer['1>2'] - xfer['2>1'], closes, slotClash };
}

console.log('\n=== Check 6: two blobs across vacuum -- the absorption path objection 4 is about ===');
let net = [], clashes = 0, closed = true;
for (const [gap, C, hT, cT] of [[6, 0.05, 30, 2], [6, 0.05, 30, 25], [2, 0.05, 30, 2], [20, 0.05, 30, 2], [6, 0.5, 30, 2], [6, 0.05, 2, 2]]) {
  const r = twoBlobs(500, C, hT, cT, gap);
  net.push(r.net); clashes += r.slotClash; closed = closed && r.closes;
}
console.log(`\nAll nets non-negative: ${net.every((n) => n >= 0)}  |  conservation held everywhere: ${closed}`);
console.log(`One bit per direction per hexagon was sufficient in every run: ${clashes === 0} (clashes ${clashes})`);
console.log('  -- because a quantum arriving at (cell,direction) and an emission into it can');
console.log('     only come from the SAME neighbour, and that neighbour is either matter or vacuum,');
console.log('     never both. So six bits is exact, not a cap.');

// ---------------------------------------------------------------- check 7
// The six-bit claim is a structural argument, not a statistical one: slot
// (cell, direction) has exactly one possible source, the neighbour behind
// it, which is either matter or vacuum and never both. Stress the code that
// implements it -- dense matter, saturated clocks, long runs.
function stress(fill, C, steps, seed) {
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const kind = new Uint8Array(W * H), energy = new Uint16Array(W * H), slot = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (rnd() < fill) { kind[i] = 1 + ((rnd() * 255) | 0); energy[i] = (rnd() * 2047) | 0; }
  const total0 = energy.reduce((a, b) => a + b, 0);
  let radiated = 0, clashes = 0, absorbed = 0, emitted = 0;
  for (let t = 0; t < steps; t++) {
    const next = new Uint8Array(W * H);
    for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
      const i = idx(q, r); if (!slot[i]) continue;
      for (let d = 0; d < 6; d++) {
        if (!(slot[i] & (1 << d))) continue;
        const [dq, dr] = DIRS[d], q2 = q + dq, r2 = r + dr;
        if (!inside(q2, r2)) { radiated++; continue; }
        const j = idx(q2, r2);
        if (kind[j]) { energy[j]++; absorbed++; continue; }
        if (next[j] & (1 << d)) clashes++;          // must never happen
        next[j] |= (1 << d);
      }
    }
    slot.set(next);
    for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
      const i = idx(q, r); if (!kind[i] || !energy[i]) continue;
      if (rnd() >= Math.min(1, C * (energy[i] / kind[i]))) continue;
      const d = (rnd() * 6) | 0, [dq, dr] = DIRS[d], q2 = q + dq, r2 = r + dr;
      if (!inside(q2, r2)) { energy[i]--; radiated++; continue; }
      const j = idx(q2, r2);
      if (kind[j]) { if (energy[i] * kind[j] > energy[j] * kind[i]) { energy[i]--; energy[j]++; } continue; }
      if (slot[j] & (1 << d)) { clashes++; continue; }
      slot[j] |= (1 << d); energy[i]--; emitted++;
    }
  }
  let inFlight = 0;
  for (let i = 0; i < W * H; i++) for (let d = 0; d < 6; d++) if (slot[i] & (1 << d)) inFlight++;
  const inWorld = energy.reduce((a, b) => a + b, 0);
  const closes = inWorld + inFlight + radiated === total0;
  console.log(`  fill ${String(fill).padEnd(5)} C=${String(C).padEnd(6)} ${String(steps).padStart(4)} steps: emitted ${String(emitted).padStart(7)} absorbed ${String(absorbed).padStart(6)} | slot clashes ${clashes} | conservation ${closes ? 'EXACT' : 'MISMATCH'}`);
  return { clashes, closes };
}

console.log('\n=== Check 7: stress the six-bit representation and the energy books ===');
let cl = 0, ok = true;
for (const [fill, C, steps, seed] of [[0.4, 1, 300, 3], [0.6, 1, 300, 5], [0.05, 1, 600, 11], [0.25, 0.01, 600, 13], [0.9, 1, 200, 17]]) {
  const r = stress(fill, C, steps, seed); cl += r.clashes; ok = ok && r.closes;
}
console.log(`\nSlot clashes across every stress run: ${cl}  |  energy closed exactly everywhere: ${ok}`);
console.log('As argued: one slot, one possible source. Six bits is exact, not a cap.');
