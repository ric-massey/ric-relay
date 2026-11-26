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

const term = read('terminal.html'), door = read('index.html');
assert.match(term, /coffee: \(\) => \{[\s\S]*?send\(\{ term: "coffee" \}\)[\s\S]*?brewCoffee\(\)/, 'the terminal pours, or hands it up when embedded');
assert.match(term, /assets\/coffee\.js/, 'the terminal loads coffee.js on demand');
assert.match(door, /m\.term === "coffee"[\s\S]*?assets\/coffee\.js/, 'the front door pours the coffee its terminal hands up');

console.log('coffee: ok');
