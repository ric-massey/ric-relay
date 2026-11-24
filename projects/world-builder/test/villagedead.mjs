// Who the soldiers dying at villages are (TODO 15.6h). Run by hand; not in the checks.
// node projects/world-builder/test/villagedead.mjs [eras] [seeds] [key=value ...]
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const eras = (process.argv[2] || "medieval,industrial").split(",");
const seeds = (process.argv[3] || "4,5,6").split(",").map(Number);
const extra = {}; for (const a of process.argv.slice(4)) { const [k, v] = a.split("="); extra[k] = isNaN(+v) ? v : +v; }
for (const era of eras) {
  const D = {}, K = {}; let dead = 0, line = 0, raid = 0, open = 0;
  for (const seed of seeds) {
    const w = People.create({ seed, era, people: 600, neighbours: "enemies", ...extra });
    for (let d = 0; d < 365; d++) w.step(24);
    const s = w.stats();
    for (const [k, n] of Object.entries(s.villageDead)) D[k] = (D[k] || 0) + n;
    for (const [k, n] of Object.entries(s.villageKnocked)) K[k] = (K[k] || 0) + n;
    console.log("  seed " + seed + ": let go " + (s.letGo || 0));
    dead += s.deadAtVillage; line += s.deadLine; raid += s.deadRaid; open += s.deadOpen;
  }
  console.log("\n" + era + ": dead at a village " + dead + ", in the line " + line + ", in raids " + raid + ", in the open " + open);
  console.log("  dead, by side | errand | company | striker:");
  for (const [k, n] of Object.entries(D).sort((a, b) => b[1] - a[1])) console.log("   " + String(n).padStart(4) + "  " + k);
  console.log("  knocked down (dead or not), the same:");
  for (const [k, n] of Object.entries(K).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log("   " + String(n).padStart(4) + "  " + k);
}
