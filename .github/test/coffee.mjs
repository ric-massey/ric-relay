/* The `coffee` egg (assets/coffee.js): the screen fills with coffee to three
   quarters, poured from above like a Keurig. This runs the liquid without a
   browser at desktop, phone and big-monitor sizes and holds it to what it
   promises: the stream carries the same at every height and the cup fills in
   the time that stream would take, it reaches 75%, makes and loses no coffee
   while full, drains five seconds later, and empties completely.
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

for (const [W, H] of [[1440, 900], [390, 844], [2560, 1400]]) {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const s = createSim(W, H, { random });
  let t = 0, after = null, full = null, fullAt = null, drainAt = null;
  while (!s.done && t < 90) {
    const before = s.total();   // the drain starts inside a step, so "full" is the step before
    s.step(1 / 60); t += 1 / 60;
    for (const v of s.h) assert.ok(Number.isFinite(v) && v >= 0, `${W}x${H}: depth stays a real, non-negative number`);
    if (after === null && s.fullAt >= 0) { after = s.total(); fullAt = t; }
    if (s.draining && drainAt === null) { drainAt = t; full = before; }
  }
  // the fill time is what the stream carries: Q = width × speed, the same at every height
  for (const y of [0, H / 3, H]) {
    const q = s.widthAt(y) * s.speedAt(y);
    assert.ok(Math.abs(q - s.widthAt(H) * s.speedAt(H)) < 1e-6 * q, `${W}x${H}: the stream carries the same at every height`);
  }
  const pour = fullAt - 0.15, ideal = (0.75 * W * H) / (s.widthAt(H) * s.speedAt(H));
  assert.ok(pour > ideal * 0.9 && pour < ideal * 1.4, `${W}x${H}: fills in the time its stream pours (${pour.toFixed(1)} s against ${ideal.toFixed(1)} s)`);
  const level = full / (W * H);
  assert.ok(level > 0.72 && level < 0.78, `${W}x${H}: three quarters full before it drains (got ${level.toFixed(3)})`);
  assert.ok(Math.abs(full - after) / after < 1e-9, `${W}x${H}: no coffee made or lost between the pour and the drain`);
  assert.ok(Math.abs(drainAt - fullAt - 5) < 0.05, `${W}x${H}: drains five seconds after it is full (${(drainAt - fullAt).toFixed(2)} s)`);
  assert.ok(s.done && s.total() === 0, `${W}x${H}: drains completely (stopped at ${t.toFixed(0)} s)`);
  assert.ok(t - drainAt < 8, `${W}x${H}: the drain takes a few seconds, not ${(t - drainAt).toFixed(1)}`);
  assert.ok(s.x0 > W / 2, `${W}x${H}: the stream is a little right of centre`);
}

// the finished cup (reduced motion, or a new width) is full and will still drain
{
  const s = createSim(800, 600);
  s.still();
  assert.ok(!s.done && !s.draining && Math.abs(s.level() - 0.75) < 1e-9, 'still() is a full cup waiting to drain');
}

// Tipped, the surface heads for level in the world and sloshes there at the
// tank's own frequency - the dispersion relation, w^2 = g*k*tanh(k*h) for the
// whole-screen mode k = pi/W, with real gravity at the screen's size - then
// settles on a slope of tan(angle) without making or losing any coffee.
{
  const W = 390, H = 844, s = createSim(W, H, { hold: 60, mm: 0.174 });
  s.still(); const v = s.volume;
  s.setTilt(0.4);
  const slope = () => (s.h[s.N - 40] - s.h[40]) / ((s.N - 80) * s.dx);
  let over = 0, ups = [], prev = 0;
  for (let k = 0; k < 60 * 3; k++) {
    s.step(1 / 60); const d = slope() - Math.tan(0.4); over = Math.max(over, slope());
    if (prev < 0 && d >= 0) ups.push(k / 60); prev = d;
  }
  assert.ok(over > Math.tan(0.4) * 1.3, `it swings well past level before it settles (${over.toFixed(2)} against ${Math.tan(0.4).toFixed(2)})`);
  const g = 9.81 * 1000 / 0.174, k = Math.PI / W, depth = 0.75 * H;
  const period = (2 * Math.PI) / Math.sqrt(g * k * Math.tanh(k * depth));
  const seen = (ups[ups.length - 1] - ups[0]) / (ups.length - 1);
  assert.ok(Math.abs(seen - period) / period < 0.1, `it sloshes at the tank's own period (${seen.toFixed(3)} s, formula ${period.toFixed(3)} s)`);
  for (let k = 0; k < 60 * 15; k++) s.step(1 / 60);
  assert.ok(Math.abs(slope() - Math.tan(0.4)) < 0.02, `and settles on a slope of tan(0.4) (got ${slope().toFixed(3)})`);
  assert.ok(Math.abs(s.volume - v) / v < 1e-9, 'tipping makes and loses no coffee');
  for (let k = 0; k < 60 * 10 && !s.idle(); k++) s.step(1 / 60);
  assert.ok(s.idle(), 'once still it is idle, so the page can stop drawing');
  assert.ok(!s.draining, 'and it is not draining before its hold is up');
  s.skip(60); s.step(1 / 60);
  assert.ok(s.draining, 'the hold is wall-clock time: skipped time still brings the drain');
}
// Tipped until it reaches the top edge (the cup's mouth), it runs out there:
// a gentle tip spills nothing; to a corner it sips and stops once the level
// is under the corner; past sideways it pours out and upside down it dumps.
// It is smooth - a little each frame, never in jumps or pulses.
{
  const run = (a, secs, W = 390, H = 844) => {
    const s = createSim(W, H, { hold: 2400 }); s.still(); const v = s.volume; s.setTilt(a);
    let t = 0, sipped = false, prev = v, jump = 0, drops = [];
    while (!s.done && t < secs) {
      s.step(1 / 60); t += 1 / 60; sipped ||= s.sipping;
      const d = prev - s.volume; prev = s.volume; jump = Math.max(jump, d / v); if (t > 2.5 && d > 0) drops.push(d);
    }
    return { s, v, t, sipped, jump, drops };
  };
  const level = run(0.3, 10);
  assert.ok(!level.sipped && level.s.volume === level.v, 'a gentle tip spills nothing');
  const some = run(1.1, 30), left = some.s.volume / some.v;
  assert.ok(some.sipped && left > 0.4 && left < 0.95, `tipped to the corner, some is drunk (${(100 * left).toFixed(0)}% left)`);
  // steady tip, steady stream: each frame takes a little less than the last, no pulses
  let pulses = 0;
  for (let k = 1; k < some.drops.length; k++) if (some.drops[k] > some.drops[k - 1] * 1.02) pulses++;
  assert.ok(pulses === 0, `held still, it runs out smoothly (${pulses} frames took more than the one before)`);
  const before = some.s.volume; for (let k = 0; k < 600; k++) some.s.step(1 / 60);
  assert.ok(some.s.volume > before * 0.97, 'and it stops once the level is below the corner');
  const side = run(2.2, 10);
  assert.ok(side.s.done && side.t < 3, `past sideways it pours out (${side.t.toFixed(1)} s)`);
  const flip = run(Math.PI, 10);
  assert.ok(flip.s.done && flip.t < 2, `upside down it dumps (${flip.t.toFixed(1)} s)`);
  // real gravity: a phone's worth of coffee falls out in about a fifth of a second - ten-odd frames, not one
  assert.ok(flip.jump < 0.15, `even dumping, it goes over several frames, not at once (${(100 * flip.jump).toFixed(1)}% in the biggest)`);
}

// bubbles ride the coffee: tipped, they go with it toward the low side
{
  let seed = 3;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const s = createSim(390, 844, { hold: 2400, random });
  while (s.fullAt < 0) s.step(1 / 60);
  const mean = () => s.bubbles.reduce((a, b) => a + b.x, 0) / s.bubbles.length;
  const was = mean();
  s.setTilt(-0.7);
  for (let k = 0; k < 30; k++) s.step(1 / 60);
  assert.ok(s.bubbles.length > 5 && mean() < was - 10, `tipped left, the bubbles slide left with it (${was.toFixed(0)} -> ${mean().toFixed(0)})`);
}

// a phone keeps it forty minutes; the hold is the one number that differs
assert.match(read('assets/coffee.js'), /PHONE_HOLD = 40 \* 60/, 'a phone keeps the cup forty minutes');

const term = read('terminal.html'), door = read('index.html');
assert.match(term, /coffee: \(\) => \{[\s\S]*?send\(\{ term: "coffee" \}\)[\s\S]*?brewCoffee\(\)/, 'the terminal pours, or hands it up when embedded');
assert.match(term, /assets\/coffee\.js/, 'the terminal loads coffee.js on demand');
assert.match(term, /brewCoffee = \(\) => \{[\s\S]*?requestPermission/, 'the terminal asks an iPhone for its tilt inside the keypress');
assert.match(door, /coffee\$\/i\.test\(typed\)\) window\.DeviceOrientationEvent\?\.requestPermission/, 'so does the front door, inside its submit');
assert.match(door, /m\.term === "coffee"[\s\S]*?assets\/coffee\.js/, 'the front door pours the coffee its terminal hands up');

console.log('coffee: ok');
