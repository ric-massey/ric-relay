// How fast the People engine runs, measured the same way every time (TODO.md).
//
//   node --expose-gc projects/world-builder/test/bench.mjs          the standard table
//   node --expose-gc projects/world-builder/test/bench.mjs --quick  the three small rows only
//   node --expose-gc projects/world-builder/test/bench.mjs 3000 30  one world: people, km across
//
// Not a test and not in checks.mjs: its numbers are one machine's, so they go in
// TODO.md's speed log with the machine named. Run it before and after any change
// to the engine. Fixed seed, sickness off, bodies as drawn (the default).
//
// "top speed" is how many times faster than 1× the world could run flat out:
// a day at 1× lasts DAY_SECONDS of real time, so top speed = DAY_SECONDS ÷ the
// seconds a day takes to work out. Without --expose-gc the memory column is rough.
import { createRequire } from "node:module";
import os from "node:os";
const People = createRequire(import.meta.url)("../people.js");

const args = process.argv.slice(2);
const cases = args.length >= 2 && !args[0].startsWith("-") ? [[+args[0], +args[1]]]
  : args.includes("--quick") ? [[400, 17], [2000, 17], [5000, 40]]
  : [[400, 17], [2000, 17], [5000, 40], [20000, 80], [400, 500]];
const gc = () => { if (global.gc) { global.gc(); global.gc(); } };
const used = () => { gc(); const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; };
const pad = (v, n) => String(v).padEnd(n);

console.log(os.cpus()[0].model + ", " + Math.round(os.totalmem() / 2 ** 30) + " GB, node " + process.version + (global.gc ? "" : "  (no --expose-gc: memory is rough)"));
console.log(pad("people", 8) + pad("land km", 9) + pad("start s", 9) + pad("s per day", 11) + pad("top speed", 11) + pad("µs/person-step", 16) + pad("MB", 8) + "KB per person");
for (const [n, map] of cases) {
  const before = used();
  let t = performance.now();
  const w = People.create({ people: n, map: map, seed: 7, plague: "none" });
  const start = (performance.now() - t) / 1000;
  const mem = used() - before, people = w.people.length;
  w.advance(People.DAY_SECONDS);                       // the first day is not typical: everybody is walking home
  const days = n > 10000 ? 1 : 2;
  t = performance.now();
  for (let d = 0; d < days; d++) w.advance(People.DAY_SECONDS);
  const perDay = (performance.now() - t) / 1000 / days;
  const steps = 24 * People.ACTIONS_PER_HOUR;
  console.log(pad(people, 8) + pad(map, 9) + pad(start.toFixed(2), 9) + pad(perDay.toFixed(2), 11) + pad(Math.round(People.DAY_SECONDS / perDay) + "×", 11)
    + pad((perDay * 1e6 / steps / w.people.length).toFixed(2), 16) + pad((mem / 1e6).toFixed(1), 8) + (mem / people / 1024).toFixed(2));
}
