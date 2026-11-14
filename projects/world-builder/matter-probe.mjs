/* MATTER PROBE — run by hand, never in the checks (several minutes).
   ────────────────────────────────────────────────────────────────────────
   Two laws of real matter, each measured against a number worked out
   first, on the stepping and heat rules of 2026-11-14 (velocity Verlet,
   exact dampers, heat and motion traded to one temperature):

   1. ARRHENIUS. How often A + B join, per pair that could, at five
      temperatures, for barriers of 2, 4 and 6. ln(rate) against 1/T should
      be a straight line whose slope is minus the barrier.

   2. BOILING (Clausius-Clapeyron). A drop of one kind, held together by
      "Everything sticks a little" and nothing else, in a box it can boil
      into. How much gas sits over it at each temperature: ln(gas density)
      against 1/T should be a straight line whose slope is minus the energy it
      takes to pull one hexagon out of the liquid — measured separately, as
      the drop's sticking energy per hexagon, plus T for the push of the gas.
      Collisions are perfectly bouncy here, so motion and heat agree; a
      collision that loses energy keeps motion a little cooler than heat.

   Run:  node projects/world-builder/matter-probe.mjs
*/
import { createRequire } from "node:module";
const Physics = createRequire(import.meta.url)("./physics.js");
const run = (w, sec) => { for (let f = 0; f < sec * 60; f++) w.step(1 / 60); };
/* Weighted least squares through [x, y, weight] rows: the slope. A point
   built from more events counts for more. */
function fit(rows) {
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y, w] of rows) { sw += w; sx += w * x; sy += w * y; sxx += w * x * x; sxy += w * x * y; }
  return (sw * sxy - sx * sy) / (sw * sxx - sx * sx);
}

console.log("1. Arrhenius: ln(rate) against 1/T should have slope minus the barrier");
for (const Ea of [2, 4, 6]) {
  const rows = [];
  for (const T0 of [3, 4.5, 6.5, 9, 13]) {
    const w = Physics.create({ layout: "empty", size: 60, kinds: 2, edge: "wrap", sized: false, bonding: "other",
      bondStrength: 0.3, bondChance: 0.4, maxBonds: 1, settle: true, barrier: Ea, startTemp: T0, shake: 0.5,
      conduct: 0.5, radiate: 0, gravity: 0, breaking: false, seed: 5 });
    let s = 4242;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let q = 0; q < 600; q++) w.place(rand() * 60, rand() * 60, q < 300 ? 1 : 2, 0, 0, 1);
    run(w, 10);
    const made = w.stats().bondsMade;
    let pairs = 0, T = 0;
    for (let k = 0; k < 20; k++) {
      run(w, 1);
      T += w.stats().temperature / 20;
      let a = 0, b = 0;
      for (let i = 0; i < w.n; i++) if (w.alive[i] && w.nb[i] === 0) (w.kind[i] === 1 ? a++ : b++);
      pairs += a * b / 20;
    }
    const events = w.stats().bondsMade - made;
    if (events > 0) rows.push([1 / T, Math.log(events / 20 / pairs), events]);
  }
  const slope = fit(rows);
  console.log(`   barrier ${Ea}   slope ${slope.toFixed(2)}  (${(100 * -slope / Ea).toFixed(0)}% of it, from ${rows.length} temperatures)`);
}

console.log("\n2. Boiling: ln(gas density) against 1/T should have slope minus the energy to leave the liquid");
const L = 30, rows = [];
let u = 0, Tsum = 0, count = 0;
for (const T0 of [1.0, 1.15, 1.3, 1.45, 1.6, 1.8, 2.0]) {
  const w = Physics.create({ layout: "empty", size: L, kinds: 1, edge: "wrap", sized: false, bonding: "none", stick: 1,
    startTemp: T0, shake: 0.2, conduct: 0.5, radiate: 0, bounce: 1, gravity: 0, seed: 3 });
  for (let gx = 0; gx < 12; gx++) for (let gy = 0; gy < 12; gy++) w.place(9 + gx + (gy % 2) * 0.5, 10 + gy * 0.87, 1, 0, 0, 1);
  run(w, 120);
  let gas = 0, T = 0, held = 0;
  const S = 300;
  for (let k = 0; k < S; k++) {
    run(w, 1);
    const st = w.stats();
    T += st.motion / st.count / S;
    let lonely = 0;
    for (let i = 0; i < w.n; i++) {
      let near = false;
      for (let j = 0; j < w.n && !near; j++) {
        if (i === j) continue;
        let dx = w.x[j] - w.x[i], dy = w.y[j] - w.y[i];
        dx -= L * Math.round(dx / L); dy -= L * Math.round(dy / L);
        near = dx * dx + dy * dy < 1.6 * 1.6;
      }
      if (!near) lonely++;
    }
    gas += lonely / S; held += st.stickEnergy / (w.n - lonely) / S;
  }
  const density = gas / (L * L - (w.n - gas) * 0.87);
  console.log(`   temperature ${T.toFixed(3)}   gas ${gas.toFixed(2)} of ${w.n}   sticking per hexagon in the drop ${held.toFixed(2)}`);
  if (gas > 0) rows.push([1 / T, Math.log(density), gas * S]);
  u += held; Tsum += T; count++;
}
const slope = fit(rows), leave = -u / count + Tsum / count;
console.log(`   slope ${slope.toFixed(2)}   energy to leave the liquid ${(-u / count).toFixed(2)} + T ${(Tsum / count).toFixed(2)} = ${leave.toFixed(2)}   (${(100 * -slope / leave).toFixed(0)}%)`);
console.log("\nMeasurements of this build at these settings, not guarantees: the coldest points count");
console.log("few events, and a drop of 144 hexagons is small. Far from the line is a fault.");
