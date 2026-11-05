// Analytic pre-screen for law 2 candidate forms. No simulation.
// Kinds 1..255. For each candidate B(a,b): energy spread, family structure,
// near-inert count, bonding-degree spread.

const N = 255;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const popcount = (x) => { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; };

const CANDIDATES = {
  'gcd(a,b)':            (a, b) => gcd(a, b),
  'min(gcd,16)':         (a, b) => Math.min(gcd(a, b), 16),
  'gcd + popcount(a&b)': (a, b) => gcd(a, b) + popcount(a & b),
  'a AND b':             (a, b) => (a & b),
  '255 - (a XOR b)':     (a, b) => 255 - (a ^ b),
  'lcm(a,b)':            (a, b) => (a * b) / gcd(a, b),
  'divisibility':        (a, b) => (a % b === 0 || b % a === 0) ? 8 : 1,
  'popcount(a AND b)':   (a, b) => popcount(a & b),
  'similarity (control)':(a, b) => 255 - Math.abs(a - b),
  '(a+b) mod 16 == 0':   (a, b) => ((a + b) % 16 === 0) ? 8 : 1,
};

function screen(f) {
  const vals = [];
  const T = [];
  for (let a = 1; a <= N; a++) { T[a] = []; for (let b = 1; b <= N; b++) { const v = f(a, b); T[a][b] = v; vals.push(v); } }
  vals.sort((x, y) => x - y);
  const pct = (p) => vals[Math.floor((vals.length - 1) * p)];
  const median = pct(0.5);

  // histogram: how concentrated is it?
  const hist = new Map();
  for (const v of vals) hist.set(v, (hist.get(v) || 0) + 1);
  const modal = Math.max(...hist.values()) / vals.length;

  // "strong" bond = above the median for this form, so comparison is fair across forms
  const strong = (a, b) => T[a][b] > median;

  // degree = how many partners a kind bonds strongly with
  const deg = [];
  for (let a = 1; a <= N; a++) { let d = 0; for (let b = 1; b <= N; b++) if (a !== b && strong(a, b)) d++; deg[a] = d; }
  const degs = deg.slice(1);
  const meanDeg = degs.reduce((s, x) => s + x, 0) / N;
  const sdDeg = Math.sqrt(degs.reduce((s, x) => s + (x - meanDeg) ** 2, 0) / N);

  // near-inert: bonds strongly with under 5% of kinds
  const inert = degs.filter((d) => d < N * 0.05).length;

  // families: connected components of the strong-bond graph
  const seen = new Array(N + 1).fill(false);
  const comps = [];
  for (let a = 1; a <= N; a++) {
    if (seen[a]) continue;
    const stack = [a]; seen[a] = true; let size = 0;
    while (stack.length) { const x = stack.pop(); size++; for (let b = 1; b <= N; b++) if (!seen[b] && strong(x, b)) { seen[b] = true; stack.push(b); } }
    comps.push(size);
  }
  comps.sort((x, y) => y - x);

  return {
    distinct: hist.size,
    p10: pct(0.1), median, p90: pct(0.9), max: vals[vals.length - 1],
    modalShare: (modal * 100).toFixed(1) + '%',
    families: comps.length,
    largestFamily: comps[0],
    inert,
    meanDeg: meanDeg.toFixed(1),
    sdDeg: sdDeg.toFixed(1),
  };
}

const rows = Object.entries(CANDIDATES).map(([name, f]) => ({ form: name, ...screen(f) }));
console.table(rows);

// ---------------------------------------------------------------------------
// Why B is capped at 8, and why that decides the form. See law 2, *Settled*.
//
// A bond breaks when e >= B*k at either endpoint (temperature, not energy).
// Energy is 16 bits, so the hottest a kind-k primitive can get is EMAX/k --
// which is the largest B it can ever break.
//
// This was 2047 (11 bits) until 2026-11-04, which forced a cap of 8 and left the
// heaviest kind unable to be heated past its own strongest bond. The word went to
// eight bytes; the cap is 257 now and law 2's modulus is a choice. See budget.mjs.
const EMAX = 65535;
console.log('\nHottest reachable temperature by kind, and the largest breakable bond:');
console.table([1, 16, 64, 127, 200, N].map((k) => ({
  kind: k, maxTemperature: Math.floor(EMAX / k), largestBreakableB: Math.floor(EMAX / k),
})));
console.log(`Cap for EVERY kind to break EVERY bond: ${Math.floor(EMAX / N)}`);

// Capping is structurally free for gcd and fatal for `a AND b`, because gcd's
// mass already sits below the cap and a AND b's sits far above it.
const capped = [];
for (const c of [4, 8, 16, 32, 255]) capped.push({ form: `min(gcd, ${c})`, ...screen((a, b) => Math.min(gcd(a, b), c)) });
capped.push({ form: 'min(a AND b, 8)', ...screen((a, b) => Math.min(a & b, 8)) });
capped.push({ form: 'a AND b (uncapped)', ...screen((a, b) => a & b) });
console.log('\nEffect of the cap:');
console.table(capped);

// ---------------------------------------------------------------------------
// Added 2026-11-04. Two metrics the screen above could not see, because both
// are about the SHAPE of the table rather than its spread.
//
//   roughness  - mean |B(a+1,b) - B(a,b)| over all pairs, divided by the form's
//                own mean B. Fusion moves a kind by addition, so this is how
//                violently chemistry changes when a species gains one unit of
//                mass. Low = a correlated landscape. High = unsearchable.
//   selfShare  - fraction of kinds whose single best partner is itself (within
//                +/-1). High means like-bonds-with-like maximally, which builds
//                crystals. Templating needs the maximum OFF the diagonal.
//   bestCount  - how many partners achieve a kind's maximum, averaged. Low is
//                specific pairing; high is promiscuity.

function shape(f) {
  const T = [];
  for (let a = 1; a <= N; a++) { T[a] = []; for (let b = 1; b <= N; b++) T[a][b] = f(a, b); }

  let sum = 0, n = 0, rough = 0, rn = 0;
  for (let a = 1; a <= N; a++) for (let b = 1; b <= N; b++) { sum += T[a][b]; n++; }
  const mean = sum / n;
  for (let a = 1; a < N; a++) for (let b = 1; b <= N; b++) { rough += Math.abs(T[a + 1][b] - T[a][b]); rn++; }

  let self = 0, bestTot = 0;
  for (let a = 1; a <= N; a++) {
    let max = -Infinity;
    for (let b = 1; b <= N; b++) if (T[a][b] > max) max = T[a][b];
    const best = [];
    for (let b = 1; b <= N; b++) if (T[a][b] === max) best.push(b);
    if (best.some((b) => Math.abs(b - a) <= 1)) self++;
    bestTot += best.length;
  }

  return {
    roughness: (rough / rn / mean).toFixed(3),
    selfShare: ((self / N) * 100).toFixed(0) + '%',
    bestCount: (bestTot / N).toFixed(1),
  };
}

const v8  = (k) => k % 8;
const v8b = (k) => 1 + ((k - 1) % 8);
const v6  = (k) => 1 + ((k - 1) % 6);
const comp = (v, t) => (a, b) => Math.max(0, 8 - Math.abs(v(a) + v(b) - t));

const FORMS = {
  'min(gcd,8)                 (current)': (a, b) => Math.min(gcd(a, b), 8),
  'gcd                        (uncapped)': (a, b) => gcd(a, b),
  'min(a AND b, 8)':                       (a, b) => Math.min(a & b, 8),
  '8-|v+v-8|, v=k mod 8       (complementary)': comp(v8, 8),
  '8-|v+v-9|, v=1+(k-1) mod 8 (complementary)': comp(v8b, 9),
  '8-|v+v-7|, v=1+(k-1) mod 6 (complementary)': comp(v6, 7),
  '8-|v-v|,   v=k mod 8       (like-with-like control)': (a, b) => 8 - Math.abs(v8(a) - v8(b)),
};

console.log('\nShape of the table — roughness under fusion, and where the maximum sits:');
console.table(Object.entries(FORMS).map(([form, f]) => ({ form, ...shape(f), ...screen(f) })));

// ---------------------------------------------------------------------------
// Added 2026-11-04, and it RETRACTS a comparison made earlier the same day.
//
// roughness and selfShare are valid for comparing FORMS AT THE SAME B RANGE --
// that is what killed gcd, where min(gcd,8) and the complementary form both
// produce 0..8. They are NOT valid across different moduli, because roughness
// divides a fixed one-valence-unit step by a mean B that grows with the modulus.
// Multiply either metric by the modulus and it goes flat, which is the proof.
const compMod = (m) => (a, b) => Math.max(0, m - Math.abs((a % m) + (b % m) - m));

const scaleCheck = [6, 8, 12, 16, 18, 24, 32].map((m) => {
  const f = compMod(m);
  const T = []; let s = 0, c = 0;
  for (let a = 1; a <= N; a++) { T[a] = []; for (let b = 1; b <= N; b++) { T[a][b] = f(a, b); s += T[a][b]; c++; } }
  const meanB = s / c;
  let d = 0, dn = 0;
  for (let a = 1; a < N; a++) for (let b = 1; b <= N; b++) { d += Math.abs(T[a + 1][b] - T[a][b]); dn++; }
  const step = d / dn;
  let self = 0;
  for (let a = 1; a <= N; a++) {
    let max = -Infinity;
    for (let b = 1; b <= N; b++) if (T[a][b] > max) max = T[a][b];
    const bs = []; for (let b = 1; b <= N; b++) if (T[a][b] === max) bs.push(b);
    if (bs.some((b) => Math.abs(b - a) <= 1)) self++;
  }
  return {
    modulus: m,
    'mean step |dB|': +step.toFixed(3),
    'mean B': +meanB.toFixed(2),
    roughness: +(step / meanB).toFixed(3),
    'roughness x m': +((step / meanB) * m).toFixed(2),
    selfBest: ((self / N) * 100).toFixed(0) + '%',
    'selfBest x m': +((self / N) * m).toFixed(2),
    membersPerColumn: +(N / m).toFixed(1),
  };
});

console.log('\nIs the modulus comparison scale-free? (README item 17)');
console.table(scaleCheck);
console.log('mean step is flat at ~1.4 and both "x m" columns are flat, so roughness and');
console.log('selfBest fall as 1/m for arithmetic reasons and say nothing about which modulus');
console.log('is better. What is actually traded: GRADATION, since one unit of mass moves a');
console.log('bond by 1 of m rather than 1 of 8, against FAMILY SIZE, since a column holds');
console.log('255/m members and a periodic table with no families is not a table. Nothing');
console.log('here measures that trade, so the modulus stays at 8 until something does.');
