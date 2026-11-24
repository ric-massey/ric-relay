// How an army reaches the place it marches on (TODO 15.6i). Run by hand; not in the checks.
// node projects/world-builder/test/arrival.mjs [era] [seeds] [key=value ...]
// For each army and target, hour by hour: when its first soldier came within the place's fields, when the most
// of it stood there at once, how many that was, and how many of it fell there before that hour.
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const era = process.argv[2] || "medieval", seeds = (process.argv[3] || "4,5,6").split(",").map(Number);
const extra = {}; for (const a of process.argv.slice(4)) { const [k, v] = a.split("="); extra[k] = isNaN(+v) ? v : +v; }
let n = 0, spread = 0, peak = 0, early = 0, dead = 0;
for (const seed of seeds) {
  const w = People.create({ seed, era, people: 600, neighbours: "enemies", ...extra });
  const ep = new Map();   // "f>v" -> { first, best, bestAt, early }
  const close = () => { for (const [k, e] of ep) if (e.best >= 3) { n++; spread += e.bestAt - e.first; peak += e.best; early += e.early; } ep.clear(); };
  for (let h = 0; h < 24 * 365; h++) {
    w.step(1);
    for (const f of w.factions) {
      if (!f.alive || !f.target) continue;
      for (const k in f.target) {
        const v = w.villages[f.target[k]]; if (!v || !v.alive || v.f === f.id) continue;
        let here = 0;
        for (const p of w.people) if (p.hp > 0 && p.f === f.id && p.job === "soldier" && Math.hypot(p.x - v.x, p.y - v.y) < v.radius + 1) here++;
        const key = f.id + ">" + v.id;
        let e = ep.get(key);
        if (!e && here) { e = { first: h, best: 0, bestAt: h, early: 0, d0: w.stats().deadAtVillage }; ep.set(key, e); }
        if (e && here > e.best) { e.best = here; e.bestAt = h; e.early = w.stats().deadAtVillage - e.d0; }
      }
    }
    if (h % (24 * 60) === 0) close();
  }
  close(); dead += w.stats().deadAtVillage;
}
console.log(era + ": " + n + " arrivals of 3 or more; first to most " + (n ? (spread / n).toFixed(0) : "-") + " h on average; most at once " + (n ? (peak / n).toFixed(1) : "-") + "; dead at a village before the most had come " + (n ? (early / n).toFixed(1) : "-") + " an arrival; dead at a village in all " + dead);
