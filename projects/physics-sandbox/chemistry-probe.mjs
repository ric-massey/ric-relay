/* CHEMISTRY PROBE — run by hand, never in the checks (a few minutes).
   ────────────────────────────────────────────────────────────────────────
   Does a world with "Bonds settle with temperature" on do what chemistry
   does? Three measurements, each against a number worked out in advance:

   1. VAN 'T HOFF. Two kinds that pair up and nothing else (A + B ⇌ AB). At
      equilibrium K = [AB] / ([A][B]), and ln K plotted against 1/T is a
      straight line whose slope is the energy given off. For two pieces
      joining in a flat world that is the bond energy less T/2, not the bond
      energy itself: the bond's own wiggling holds heat (classically, K grows
      as sqrt(T) exp(B/T) from the room a spring gives). The probe prints
      both. The line's height depends on geometry and is not predicted.

      Until 2026-11-14 this read 102% of the bond energy and was taken as
      right. It was two errors cancelling: a world whose heat and motion were
      at different temperatures, and dampers that only took motion away.
      Fixed, it reads a few percent above B - T/2.

   2. MASS ACTION. The same two kinds at the same temperature, mixed 1:1 and
      then 3:1. K is a property of the reaction, not of the mix, so it should
      come out the same both times — while the NUMBER of pairs changes the
      way Le Chatelier says: more A pulls more B into pairs.

   3. THE BARRIER. Same world with and without a barrier. Where it settles
      should not move (a barrier is climbed both ways, so it cancels); how
      long it takes to get there should.

   4. HANDING OVER. The same world with "Pieces can be handed over" on. A
      hand-over makes one bond and breaks one, so where the world settles
      should not move; it only adds a road between the same places.

   5. ENERGY-RICH PIECES. A barrier high enough that nothing bonds, heat
      leaking away, and pieces charged up from outside. A world at rest
      holds K = exp(B/T) times a constant; a driven one should hold more
      than that at its own temperature, for as long as it is fed.

   Before this setting existed the world's own answer to (1) was a slope of
   1.8 where the bond energy was 4, because a pair alone paid for its own
   bonds. Run:

     node projects/physics-sandbox/chemistry-probe.mjs
     node projects/physics-sandbox/chemistry-probe.mjs --bond 6
     node projects/physics-sandbox/chemistry-probe.mjs --old     (the world without settling)
*/
import { createRequire } from "node:module";
const Physics = createRequire(import.meta.url)("./physics.js");

const argv = process.argv.slice(2);
const opt = (name, fallback) => { const at = argv.indexOf("--" + name); return at >= 0 ? Number(argv[at + 1]) : fallback; };
const BOND = opt("bond", 4);
const SETTLE = !argv.includes("--old");

const base = extra => ({
  layout: "empty", size: 60, kinds: 2, edge: "wrap", sized: false,
  bonding: "other", bondStrength: BOND, bondChance: 0.4, maxBonds: 1, settle: SETTLE,
  startSpeed: 1, shake: 0.5, conduct: 0.5, radiate: 0, heater: "none",
  gravity: 0, fall: 0, bounce: 0.8, breaking: false, seed: 7, ...extra });

/* A sealed world with nA of kind 1 and nB of kind 2 scattered at random. */
function world(nA, nB, extra) {
  const w = Physics.create(base(extra));
  let s = 99991;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let q = 0; q < nA + nB; q++) w.place(rand() * 60, rand() * 60, q < nA ? 1 : 2, 0, 0, 1);
  return w;
}
function reading(w) {
  let freeA = 0, freeB = 0;
  for (let i = 0; i < w.n; i++) if (w.alive[i] && w.nb[i] === 0) (w.kind[i] === 1 ? freeA++ : freeB++);
  const st = w.stats();
  return { pairs: st.bonds, freeA, freeB, T: st.temperature, K: st.bonds * w.width * w.height / Math.max(1, freeA * freeB) };
}
/* Settle, then average over a minute of world time. */
function settle(w, wait = 150, over = 60) {
  for (let f = 0; f < 60 * wait; f++) w.step(1 / 60);
  const sum = { pairs: 0, freeA: 0, freeB: 0, T: 0, K: 0 };
  for (let s = 0; s < over; s++) {
    for (let f = 0; f < 60; f++) w.step(1 / 60);
    const r = reading(w);
    for (const k in sum) sum[k] += r[k] / over;
  }
  return sum;
}

console.log(`Bond energy ${BOND}, ${SETTLE ? "bonds settle with temperature" : "the world WITHOUT settling (--old)"}.\n`);

console.log("1. van 't Hoff: ln K against 1/T should have slope " + BOND + " less half the temperature");
const rows = [];
for (const T0 of [0.6, 0.9, 1.3, 2, 3, 5]) {
  const r = settle(world(300, 300, { startTemp: T0 }));
  rows.push(r);
  console.log(`   temperature ${r.T.toFixed(3)}   pairs ${r.pairs.toFixed(0).padStart(4)}   ln K ${Math.log(r.K).toFixed(3)}`);
}
const xs = rows.map(r => 1 / r.T), ys = rows.map(r => Math.log(r.K));
const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
let num = 0, den = 0, ss = 0, st = 0;
xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
const slope = num / den;
ys.forEach((y, i) => { const fit = my + slope * (xs[i] - mx); ss += (y - fit) ** 2; st += (y - my) ** 2; });
const Tmid = 1 / mx, expect = BOND - Tmid / 2;
console.log(`   slope ${slope.toFixed(2)}: ${(100 * slope / expect).toFixed(0)}% of B - T/2 = ${expect.toFixed(2)} at the middle temperature ${Tmid.toFixed(2)} (${(100 * slope / BOND).toFixed(0)}% of B), straight to r² ${(1 - ss / st).toFixed(3)}\n`);

console.log("2. Mass action at one temperature: K should not care about the mix");
const even = settle(world(300, 300, { startTemp: 1.3 }));
const lopsided = settle(world(450, 150, { startTemp: 1.3 }));
console.log(`   1:1   temperature ${even.T.toFixed(3)}   pairs ${even.pairs.toFixed(0)}   of B paired ${(100 * even.pairs / 300).toFixed(0)}%   K ${even.K.toFixed(2)}`);
console.log(`   3:1   temperature ${lopsided.T.toFixed(3)}   pairs ${lopsided.pairs.toFixed(0)}   of B paired ${(100 * lopsided.pairs / 150).toFixed(0)}%   K ${lopsided.K.toFixed(2)}`);
/* The two worlds end at slightly different temperatures (different numbers
   of bonds gave off different heat), so compare K after taking out what
   that alone would do: exp(B/T) at each one's own temperature. */
const adj = r => Math.log(r.K) - BOND / r.T;
console.log(`   K differs by ${(100 * (Math.exp(adj(lopsided) - adj(even)) - 1)).toFixed(0)}% once each is set to the same temperature by exp(B/T)\n`);

console.log("3. A barrier changes how fast, not where");
for (const barrier of [0, 3]) {
  const w = world(300, 300, { startTemp: 2, barrier });
  let half = null;
  const end = settle(world(300, 300, { startTemp: 2, barrier }), 200);
  for (let f = 0; f < 60 * 200 && half === null; f++) {
    w.step(1 / 60);
    if (f % 30 === 0 && w.stats().bonds >= end.pairs / 2) half = f / 60;
  }
  console.log(`   barrier ${barrier}   settles at ${end.pairs.toFixed(0)} pairs, K adjusted ${adj(end).toFixed(2)}   half-way after ${half === null ? "over 200" : half.toFixed(1)} s`);
}
console.log("\n4. Handing over should leave the balance where it was");
for (const swap of [false, true]) {
  const r = settle(world(300, 300, { startTemp: 2, swap }), 120, 40);
  console.log(`   hand-overs ${swap ? "on " : "off"}   pairs ${r.pairs.toFixed(0)}   temperature ${r.T.toFixed(3)}   K adjusted ${adj(r).toFixed(2)}`);
}

console.log("\n5. Energy-rich pieces hold a world above its balance (barrier 6, heat leaking)");
for (const fuel of [0, 6]) {
  const r = settle(world(300, 300, { startTemp: 2, barrier: 6, fuel, fuelRate: 0.01, radiate: 0.02 }), 60, 40);
  console.log(`   charged up with ${fuel}   pairs ${r.pairs.toFixed(0)}   temperature ${r.T.toFixed(3)}   K adjusted ${adj(r).toFixed(2)}   (a world at rest: ${adj(even).toFixed(2)})`);
}
console.log("\nThese are measurements of this build at these settings, not guarantees. The worlds are");
console.log("small and finite, so expect a few percent either way; a slope far from the bond energy,");
console.log("or a barrier that moves where things settle by much more than that, is a fault.");
