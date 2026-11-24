// Where the coins pile up (TODO 15.10). Run by hand; not in the checks.
// node projects/world-builder/test/gini.mjs [years] [seeds] [key=value ...]
// Prints, a year at a time, grown-ups' coins: Gini, the top tenth's share, the share holding none; the
// tills' coins; who the five richest are; and the year's starved, with the 15.10 counts.
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const years = +(process.argv[2] || 2), seeds = (process.argv[3] || "2").split(",").map(Number);
const extra = {}; for (const a of process.argv.slice(4)) { const [k, v] = a.split("="); extra[k] = isNaN(+v) ? v : +v; }
const gini = xs => { const a = xs.slice().sort((x, y) => x - y), n = a.length, s = a.reduce((x, y) => x + y, 0); if (!s) return 0; let c = 0; a.forEach((x, i) => c += (2 * (i + 1) - n - 1) * x); return c / (n * s); };
for (const seed of seeds) {
  const w = People.create({ seed, people: 400, ...extra });
  const line = (y, s0) => {
    const ad = w.people.filter(p => p.hp > 0 && w.adult(p)), c = ad.map(p => p.coins), tot = c.reduce((a, b) => a + b, 0);
    const top = c.slice().sort((a, b) => b - a).slice(0, Math.ceil(c.length / 10)).reduce((a, b) => a + b, 0);
    const s = w.stats(), rich = ad.slice().sort((a, b) => b.coins - a.coins).slice(0, 5).map(p => p.job + " " + p.coins.toFixed(0)).join(", ");
    console.log("seed " + seed + " year " + y + ": gini " + gini(c).toFixed(2) + ", top tenth " + (tot ? top / tot * 100 : 0).toFixed(0) + "%, none " + (c.filter(x => x < 0.5).length / c.length * 100).toFixed(0) + "%, tills " + w.villages.reduce((a, v) => a + (v.alive ? v.till : 0), 0).toFixed(0) +
      ", people " + ad.length + ", starved " + (s.starved - (s0 ? s0.starved : 0)) + " | richest: " + rich +
      " | stopped " + (s.stopped || 0).toFixed(0) + " home " + (s.sentHome || 0).toFixed(0) + " drink " + (s.drunk || 0).toFixed(0) + " spent " + (s.spentSpare || 0).toFixed(0) + " alms " + (s.almsCoins || 0).toFixed(0) + " lent " + (s.lent || 0).toFixed(0) + " repaid " + (s.loansRepaid || 0).toFixed(0));
    return s;
  };
  let s0 = line(0, null);
  for (let y = 1; y <= years; y++) { w.step(24 * 365); s0 = line(y, s0); }
}
