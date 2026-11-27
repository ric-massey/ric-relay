/* The `coffee` egg (assets/coffee.js): the screen fills with coffee to three
   quarters, poured from above like a Keurig, and a second later a splash of
   creamer goes in. It is one liquid simulation (FLIP), so this runs it
   without a browser and holds it to what real liquid does: the cup fills in
   the time its stream would take, keeps its volume, comes to rest, sloshes at
   the tank's own frequency, runs out over the top edge when tipped, carries
   the creamer down and lets it settle - and a shake moves all of it.
   It also checks both places that pour one: the terminal, and the front door
   when its hidden terminal hands the command up.

   Run: node .github/test/coffee.mjs */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

vm.runInThisContext(read('assets/coffee.js'));
const { createSim } = globalThis.RELAY_COFFEE;
assert.equal(typeof createSim, 'function', 'coffee.js exposes createSim');
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const speeds = (s) => { const P = s.particles(); let m = 0; for (let k = 0; k < P.n; k++) m = Math.max(m, Math.hypot(P.VX[k], P.VY[k])); return m / s.PXM; };
const creamDepth = (s) => {
  // the creamer's share in each quarter of the depth, top to bottom
  const P = s.particles(), top = (s.surfaceX(s.W / 2) * s.Hs) / s.H, D = s.Hs - top, q = [0, 0, 0, 0];
  let m = 0;
  for (let k = 0; k < P.n; k++) if (P.C[k] > 0) { m += P.C[k]; q[Math.max(0, Math.min(3, Math.floor((4 * (P.Y[k] - top)) / D)))] += P.C[k]; }
  return q.map((x) => x / m);
};

// The pour, the creamer and the drain, at desktop, phone and big-monitor sizes
for (const [W, H, mm] of [[1440, 900, 0.2646], [390, 844, 0.174], [2560, 1400, 0.2646]]) {
  const s = createSim(W, H, { random: seeded(7), mm });
  let t = 0, after = null, full = null, fullAt = null, drainAt = null;
  while (!s.done && t < 60) {
    const before = s.total();
    s.step(1 / 60); t += 1 / 60;
    if (after === null && s.fullAt >= 0) { after = s.total(); fullAt = t; }
    if (s.draining && drainAt === null) { drainAt = t; full = before; }
  }
  // the stream carries the same at every height: width x speed (continuity)
  for (const y of [0, H / 3, H]) {
    const q = s.widthAt(y) * s.speedAt(y);
    assert.ok(Math.abs(q - s.widthAt(H) * s.speedAt(H)) < 1e-6 * q, `${W}x${H}: the stream carries the same at every height`);
  }
  // full once the last of the stream has landed: the pour itself took target / Q
  const ideal = (0.75 * W * s.Hs) / (s.widthAt(0) * s.speedAt(0)), pour = fullAt - 0.15 - s.fallTime(s.Hs * 0.25);
  assert.ok(pour > ideal * 0.9 && pour < ideal * 1.2, `${W}x${H}: fills in the time its stream pours (${pour.toFixed(1)} s against ${ideal.toFixed(1)} s)`);
  const level = full / (W * s.Hs);
  assert.ok(level > 0.74 && level < 0.79, `${W}x${H}: three quarters full, and the creamer, before it drains (got ${level.toFixed(3)})`);
  // the only thing that goes in between full and the drain is the creamer (to a particle)
  assert.ok(Math.abs(full - after - s.cream.poured - s.dripped) <= 2 * s.PA, `${W}x${H}: no coffee made or lost while it stands, only the creamer and the last drips added (${((full - after - s.cream.poured - s.dripped) / s.PA).toFixed(1)} particles off)`);
  assert.ok(Math.abs(drainAt - fullAt - 5) < 0.05, `${W}x${H}: drains five seconds after it is full (${(drainAt - fullAt).toFixed(2)} s)`);
  assert.ok(s.done && s.total() === 0, `${W}x${H}: drains completely (stopped at ${t.toFixed(0)} s)`);
  assert.ok(t - drainAt < 10, `${W}x${H}: the drain takes seconds, not ${(t - drainAt).toFixed(1)}`);
  assert.ok(s.x0 > W / 2, `${W}x${H}: the stream is a little right of centre`);
}

// the finished cup (reduced motion, or a new width) is full, still, and will drain
{
  const s = createSim(800, 600, { cream: 0, hold: 60 });
  s.still();
  assert.ok(!s.done && !s.draining && Math.abs(s.level() - 0.75) < 0.01, `still() is a full cup waiting to drain (${s.level().toFixed(3)})`);
  let t = 0; while (t < 8 && !s.idle()) { s.step(1 / 60); t += 1 / 60; }
  assert.ok(s.idle(), `left alone, it settles in a few seconds and is idle, so the page can stop drawing (${t.toFixed(1)} s)`);
}

// After the pour it comes to rest - nothing in the solver keeps it stirring.
// (Every step's damping goes in before gravity; after it, gravity's push was
// shaved unevenly and the cup circulated at 4 cm/s for ever.)
{
  const s = createSim(390, 844, { mm: 0.174, hold: 2400, cream: 0, random: seeded(5) });
  let t = 0; while (t < 40 && !s.asleep) { s.step(1 / 60); t += 1 / 60; }
  assert.ok(s.asleep, `after the pour the coffee comes to rest (${t.toFixed(0)} s)`);
  // and it keeps its volume: the surface is where the particles' volume says
  const expect = s.Hs - s.level() * s.Hs, got = (s.surfaceX(195) * s.Hs) / s.H;
  assert.ok(Math.abs(got - expect) < 0.04 * s.Hs, `the liquid keeps its volume (surface at ${got.toFixed(0)}, ${expect.toFixed(0)} expected)`);
}

// Tipped a little, it sloshes at the tank's own frequency - the dispersion
// relation, w^2 = g*k*tanh(k*h) for the whole-screen mode k = pi/W, with real
// gravity at the screen's real size. Nothing in the code is told this number.
for (const [W, H, mm] of [[390, 844, 0.174], [1440, 900, 0.2646]]) {
  const s = createSim(W, H, { mm, hold: 2400, cream: 0 });
  s.still(); s.setTilt(0.15);
  const P = s.particles(), xs = [];
  for (let f = 0; f < 60 * 5; f++) { s.step(1 / 60); let m = 0; for (let k = 0; k < P.n; k++) m += P.X[k]; xs.push(m / P.n); }
  const rest = xs.slice(150).reduce((a, b) => a + b, 0) / (xs.length - 150), ups = [];
  for (let i = 1; i < xs.length; i++) if (xs[i - 1] < rest && xs[i] >= rest) ups.push(i / 60);
  const seen = (ups[ups.length - 1] - ups[0]) / (ups.length - 1);
  const g = 9.81 * 1000 / mm, k = Math.PI / W, period = (2 * Math.PI) / Math.sqrt(g * k * Math.tanh(k * 0.75 * H));
  assert.ok(Math.abs(seen - period) / period < 0.08, `${W}x${H}: it sloshes at the tank's own period (${seen.toFixed(3)} s, formula ${period.toFixed(3)} s)`);
}

// Tipped until it reaches the top edge - the cup's open mouth - it runs out
// there: a gentle tip spills nothing; to a corner some goes and it stops once
// the level is under the corner; past sideways it pours out; upside down it dumps.
{
  const run = (a, secs) => {
    const s = createSim(390, 844, { mm: 0.174, hold: 2400, cream: 0 }); s.still(); const v = s.volume; s.setTilt(a);
    let t = 0; while (!s.done && t < secs) { s.step(1 / 60); t += 1 / 60; }
    return { s, v, t };
  };
  const level = run(0.3, 6);
  assert.ok(level.s.volume === level.v, 'a gentle tip spills nothing');
  const some = run(1.1, 8), left = some.s.volume / some.v;
  assert.ok(left > 0.4 && left < 0.95, `tipped to the corner, some runs out (${(100 * left).toFixed(0)}% left)`);
  const before = some.s.volume; for (let k = 0; k < 300; k++) some.s.step(1 / 60);
  assert.ok(some.s.volume > before * 0.97, 'and it stops once the level is below the corner');
  const side = run(2.2, 6);
  assert.ok(side.s.done && side.t < 3, `past sideways it pours out (${side.t.toFixed(1)} s)`);
  const flip = run(Math.PI, 6);
  assert.ok(flip.s.done && flip.t < 2, `upside down it dumps (${flip.t.toFixed(1)} s)`);
}

// The creamer: a splash, a second after full. Heavier than the coffee, it
// sinks, and none of it is lost as the two mix; then it settles on the bottom
// and the cup can sleep.
{
  const s = createSim(390, 844, { mm: 0.174, hold: 2400, random: seeded(11) });
  while (s.cream.start < 0) s.step(1 / 60);
  assert.ok(Math.abs(s.cream.start - s.fullAt - 1) < 0.05, `the creamer goes in a second after the cup is full (${(s.cream.start - s.fullAt).toFixed(2)} s)`);
  const share = () => { const P = s.particles(); let c = 0; for (let k = 0; k < P.n; k++) c += P.C[k]; return c * s.PA; };
  for (let k = 0; k < 60 * 3; k++) s.step(1 / 60);
  const poured = s.cream.poured;
  assert.ok(Math.abs(poured / (0.75 * 390 * s.Hs) - 0.02) < 0.001, `a splash: 2% of the coffee (${(100 * poured / (0.75 * 390 * s.Hs)).toFixed(2)}%)`);
  assert.ok(Math.abs(share() - poured) / poured < 0.01, `mixing moves creamer about, and makes and loses none (${(100 * share() / poured).toFixed(1)}%)`);
  const q = creamDepth(s);
  assert.ok(q[2] + q[3] > 0.6, `being heavier, it sinks (${q.map((x) => (100 * x).toFixed(0)).join('/')}% by quarter, top to bottom)`);
  let t = 0; while (t < 60 && !s.asleep) { s.step(1 / 60); t += 1 / 60; }
  const end = creamDepth(s);
  assert.ok(s.asleep, `then it comes to rest (${t.toFixed(0)} s more)`);
  assert.ok(end[3] > 0.7, `settled on the bottom: ${(100 * end[3]).toFixed(0)}% of it in the bottom quarter`);

  // Shaken (Ric: "it doesn't move when I shake it"): a phone flicked sideways
  // is, to the liquid in it, a push the other way. The cup wakes, the liquid
  // sloshes and the creamer goes with it.
  const P = s.particles(), meanX = () => { let m = 0, c = 0; for (let k = 0; k < P.n; k++) { m += P.X[k] * P.C[k]; c += P.C[k]; } return m / c; };
  const x0 = meanX();
  s.setGravity(-25, 9.81);                       // a flick to the right: 2.5 g the other way, for a fifth of a second
  for (let k = 0; k < 12; k++) s.step(1 / 60);
  s.setGravity(0, 9.81);
  let moved = 0, swung = 0;
  for (let k = 0; k < 90; k++) { s.step(1 / 60); moved = Math.max(moved, speeds(s)); swung = Math.max(swung, Math.abs(meanX() - x0)); }
  assert.ok(!s.asleep || moved > 0.05, 'a shake wakes the cup');
  assert.ok(moved > 0.05, `and the liquid moves (${(1000 * moved).toFixed(0)} mm/s)`);
  assert.ok(swung * s.MM > 2, `and the creamer with it (it swung ${(swung * s.MM).toFixed(1)} mm)`);
}
{
  const s = createSim(800, 600);
  s.still(0.75, true);
  assert.ok(s.creamed() && s.cream.poured === s.cream.want, 'still(level, true) is a cup already creamed');
}

// a phone keeps it forty minutes; the hold is the one number that differs
const src = read('assets/coffee.js');
assert.match(src, /PHONE_HOLD = 40 \* 60/, 'a phone keeps the cup forty minutes');
assert.match(src, /addEventListener\("devicemotion"/, 'the liquid feels the phone itself: its tilt and its shaking');

const term = read('terminal.html'), door = read('index.html');
assert.match(term, /coffee: \(\) => \{[\s\S]*?send\(\{ term: "coffee" \}\)[\s\S]*?brewCoffee\(\)/, 'the terminal pours, or hands it up when embedded');
assert.match(term, /assets\/coffee\.js/, 'the terminal loads coffee.js on demand');
assert.match(term, /brewCoffee = \(\) => \{[\s\S]*?DeviceMotionEvent\?\.requestPermission[\s\S]*?DeviceOrientationEvent\?\.requestPermission/, 'the terminal asks an iPhone for its motion and tilt inside the keypress');
assert.match(door, /coffee\$\/i\.test\(typed\)\) \{ window\.DeviceMotionEvent\?\.requestPermission[\s\S]*?DeviceOrientationEvent\?\.requestPermission/, 'so does the front door, inside its submit');
assert.match(door, /m\.term === "coffee"[\s\S]*?assets\/coffee\.js/, 'the front door pours the coffee its terminal hands up');

console.log('coffee: ok');
