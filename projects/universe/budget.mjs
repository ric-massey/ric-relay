// The hexagon's four bytes: every field allocation that fits, and what each buys.
// No simulation. Added 2026-11-04 for README item 15, the heavy-matter temperature fork.
//
// A hexagon is kind + energy + momentum + bonds. Bonds are always 6 (one bit per
// neighbour) and momentum is two signed components, so the constraint is
//
//     kind + energy + 2*momentumBits + 6 <= 32
//
// and the quantity that was never written down is the HOTTEST REACHABLE TEMPERATURE
// OF THE HEAVIEST KIND, which is energyMax / kinds, because temperature is e/kind.
// At the current layout that number is 8, which is why heavy matter is inert.

const BONDS = 6;
const WORD = 32;

function layout(K, E, M) {
  const bits = K + E + 2 * M + BONDS;
  const kinds = (1 << K) - 1;
  const energyMax = (1 << E) - 1;
  return {
    bits,
    kind: K, energy: E, momentumBits: M,
    kinds,
    energyMax,
    momentum: `+-${(1 << (M - 1)) - 1}`,
    hottestHeavyKind: Math.floor(energyMax / kinds),
    spareBits: WORD - bits,
  };
}

// ---------------------------------------------------------------------------
// 1. Every allocation that fits, keeping the widest energy for each kind/momentum
//    pair, since there is never a reason to leave an energy bit unused.
const best = new Map();
for (let K = 4; K <= 9; K++) {
  for (let E = 8; E <= 20; E++) {
    for (let M = 3; M <= 5; M++) {
      const r = layout(K, E, M);
      if (r.bits > WORD) continue;
      const key = `${K}|${M}`;
      if (!best.has(key) || best.get(key).energyMax < r.energyMax) best.set(key, r);
    }
  }
}
const rows = [...best.values()]
  .filter((r) => r.kinds >= 15)
  .sort((a, b) => b.kinds - a.kinds || a.momentumBits - b.momentumBits);

console.log('Four bytes. Every allocation that fits, widest energy for each kind/momentum pair:');
console.table(rows.map(({ kinds, energyMax, momentum, hottestHeavyKind, bits, spareBits }) =>
  ({ kinds, energyMax, momentum, hottestHeavyKind, bits, spareBits })));

// ---------------------------------------------------------------------------
// 2. The current layout, and the bit it leaves on the floor.
const now = layout(8, 11, 3);
const freeWin = layout(8, 12, 3);
console.log('\nThe four-byte layout (documented until 2026-11-04), and the same using its spare bit:');
console.table([
  { which: 'four-byte, to 2026-11-04 (kind 8, energy 11, p +-3)', ...pick(now) },
  { which: 'spare bit to energy (energy 12)', ...pick(freeWin) },
]);
console.log(`Giving the unused bit to energy takes the heaviest kind from ${now.hottestHeavyKind} ` +
  `to ${freeWin.hottestHeavyKind} reachable temperatures, and costs nothing.`);

function pick(r) {
  return { kinds: r.kinds, energyMax: r.energyMax, momentum: r.momentum,
    hottestHeavyKind: r.hottestHeavyKind, bits: r.bits, spareBits: r.spareBits };
}

// ---------------------------------------------------------------------------
// 3. Is the kind count free for law 2? The complementary form's shape at each
//    count. If these are flat, spending kind bits on energy costs no chemistry.
const comp = (a, b) => Math.max(0, 8 - Math.abs((a % 8) + (b % 8) - 8));
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const cappedGcd = (a, b) => Math.min(gcd(a, b), 8);

function shape(N, f) {
  const T = []; let sum = 0, cnt = 0;
  for (let a = 1; a <= N; a++) { T[a] = []; for (let b = 1; b <= N; b++) { T[a][b] = f(a, b); sum += T[a][b]; cnt++; } }
  const mean = sum / cnt;
  let rough = 0, rn = 0;
  for (let a = 1; a < N; a++) for (let b = 1; b <= N; b++) { rough += Math.abs(T[a + 1][b] - T[a][b]); rn++; }
  let self = 0, tied = 0;
  for (let a = 1; a <= N; a++) {
    let max = -Infinity;
    for (let b = 1; b <= N; b++) if (T[a][b] > max) max = T[a][b];
    const bs = []; for (let b = 1; b <= N; b++) if (T[a][b] === max) bs.push(b);
    if (bs.some((b) => Math.abs(b - a) <= 1)) self++;
    tied += bs.length;
  }
  const cols = new Set(); for (let a = 1; a <= N; a++) cols.add(a % 8);
  return { kinds: N, roughness: +(rough / rn / mean).toFixed(3), selfBest: ((self / N) * 100).toFixed(0) + '%',
    columns: cols.size, membersPerColumn: +(N / cols.size).toFixed(1), tiedForBest: +(tied / N).toFixed(1) };
}

const counts = [255, 127, 63, 31, 15];
console.log('\nLaw 2, complementary form, at each candidate kind count:');
console.table(counts.map((N) => shape(N, comp)));
console.log('If roughness and selfBest are flat across these rows, the kind count is free for law 2');
console.log('and kind bits can be spent on energy without costing any chemistry.');

console.log('\nmin(gcd,8) at the same counts, as the control:');
console.table(counts.map((N) => shape(N, cappedGcd)));

// ---------------------------------------------------------------------------
// 4. Eight bytes, the only way to keep 255 kinds and fix both problems at once.
console.log('\nEight bytes -- THE DOCUMENTED LAYOUT since 2026-11-04 (kind 8 + energy 16 + momentum 10 + bonds 6 = 40 of 64):');
console.table([{ kinds: 255, energyMax: 65535, momentum: '+-15',
  hottestHeavyKind: Math.floor(65535 / 255), bits: 40, spareBits: 24 }]);
console.log('the World at 4096^2: 67MB at four bytes, 134MB at eight. Still one native texel');
console.log('(RG32UI or RGBA16UI), so the shader structure survives; the cost is bandwidth.');

// ---------------------------------------------------------------------------
// 5. Does storing TEMPERATURE instead of total energy save bits? Fork option
//    (b) in README item 15 assumed it does. It does not.
//
//    Transport moves energy in integer units of 1. If the field holds T and
//    e = T*kind, a hexagon of kind k can only represent multiples of k, so an
//    arriving single unit has nowhere to go unless a remainder r < k is stored
//    too -- and (T, r) is the same information as e, at the same width.
console.log('\nStoring total energy vs storing temperature plus the remainder exact transport needs:');
console.table([8, 7, 6, 5].flatMap((K) => [64, 128].map((Tmax) => {
  const kinds = (1 << K) - 1;
  const eBits = Math.ceil(Math.log2(Tmax * kinds + 1));
  const trBits = Math.ceil(Math.log2(Tmax + 1)) + K;
  return { kinds, Tmax, 'store e': eBits, 'store T alone': Math.ceil(Math.log2(Tmax + 1)),
    'store T + remainder': trBits, saving: eBits - trBits };
})));
console.log('Saving is never positive, so option (b) buys nothing. Storing T ALONE is narrower');
console.log('only because it cannot represent the energies transport actually delivers: the');
console.log('smallest change to a kind-k primitive becomes k units, so heat into heavy matter');
console.log('either rounds away or stalls, and conservation is what pays.');

// ---------------------------------------------------------------------------
// 6. Thermal headroom and the speed spread, per layout. Headroom is how many
//    times its own strongest bond the HEAVIEST kind can be heated. Below 1x its
//    bonds never break; below ~8x there is no hot phase for heavy matter.
const BMAX = 8;

function momentumMagnitudes(M) {
  const lim = (1 << (M - 1)) - 1, out = new Set();
  for (let x = -lim; x <= lim; x++) for (let y = -lim; y <= lim; y++) {
    if (x === 0 && y === 0) continue;
    const z = -(x + y);
    out.add(Math.sqrt((x * x + y * y + z * z) / 2));
  }
  return [...out];
}

// one hexagon every kind/|p| ticks, never more than one per tick
function distinctSpeeds(kinds, M) {
  const mags = momentumMagnitudes(M), periods = new Set();
  for (let k = 1; k <= kinds; k++) for (const p of mags) periods.add(Math.max(1, Math.round(k / p)));
  return periods.size;
}

const detail = [];
for (let K = 5; K <= 8; K++) {
  for (let M = 2; M <= 5; M++) {
    const E = WORD - BONDS - K - 2 * M;
    if (E < 8) continue;
    const kinds = (1 << K) - 1, hottest = Math.floor(((1 << E) - 1) / kinds);
    const headroom = hottest / BMAX;
    detail.push({
      kinds, energyBits: E, momentum: `+-${(1 << (M - 1)) - 1}`, hottestHeavy: hottest,
      headroom: +headroom.toFixed(1), speeds: distinctSpeeds(kinds, M),
      verdict: headroom < 1 ? 'heavy bonds UNBREAKABLE'
        : headroom < 2 ? 'no hot phase for heavy'
        : headroom < 8 ? 'thin' : 'ok',
    });
  }
}
console.log('\nHeadroom and speed spread for every four-byte layout:');
console.table(detail.sort((a, b) => b.kinds - a.kinds || a.momentum.localeCompare(b.momentum)));

console.log('\nTwo results worth stating outright:');
console.log('  SPEEDS ALWAYS EQUALS KINDS. There is always a momentum of magnitude 1, so every');
console.log('  kind k yields a step period of k, and no momentum width adds a single speed.');
console.log('  Momentum width is purely about headroom for forces, never about speed variety --');
console.log('  which is why "+-3 already gives all 255 speeds" was true and not reassuring.');
const need = 8 * BMAX * 255, needBits = Math.ceil(Math.log2(need + 1));
const leftM = (WORD - BONDS - 8 - needBits) / 2;
console.log(`\n  PICK TWO. 255 kinds at 8x headroom needs energy >= ${need} (${needBits} bits), leaving`);
console.log(`  ${WORD - BONDS - 8 - needBits} bits of momentum = +-${(1 << (leftM - 1)) - 1}, which is option (A) -- the unweighted`);
console.log('  direction law 1 rejected. So at four bytes you may have any TWO of: 255 kinds,');
console.log('  real thermal headroom for heavy matter, and a momentum vector with room to push.');
