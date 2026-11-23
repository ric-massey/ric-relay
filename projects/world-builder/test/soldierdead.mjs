// War's dead measured by the soldier (TODO 15.6e). Run by hand; not in the checks.
// node projects/world-builder/test/soldierdead.mjs [eras] [seeds] [key=value ...]
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const eras = (process.argv[2] || "early,medieval,industrial,modern").split(",");
const seeds = (process.argv[3] || "1,2,3").split(",").map(Number);
const extra = {}; for (const a of process.argv.slice(4)) { const [k, v] = a.split("="); extra[k] = isNaN(+v) ? v : +v; }
for (const era of eras) {
  const T = {}; let n0 = 0, soldierDays = 0;
  for (const seed of seeds) {
    const w = People.create({ seed, era, people: 600, neighbours: "enemies", ...extra });
    n0 += w.people.length;
    for (let d = 0; d < 365; d++) { w.step(24); soldierDays += w.people.filter(p => p.hp > 0 && p.job === "soldier").length; }
    const s = w.stats();
    for (const k of ["battle", "soldiersKilled", "pursuitDead", "routs", "routedSoldiers", "battles", "unitsBroke", "unitsWithdrew", "diedOfWounds", "blastDead", "lineDead", "deadAtVillage", "deadLine", "battleDeclined", "battleCaught", "drawnBattles", "termsTaken", "termsRefused", "captures"]) T[k] = (T[k] || 0) + (s[k] || 0);
  }
  const soldiers = soldierDays / 365 / seeds.length;
  console.log(era.padEnd(11), "people dead/yr", (T.battle / n0 * 100).toFixed(1) + "%",
    "| soldiers on average", Math.round(soldiers), "per world, killed a year", (T.soldiersKilled / seeds.length / soldiers * 100).toFixed(0) + "%",
    "| routs", T.routs, "soldiers routed", T.routedSoldiers, "killed running", T.pursuitDead, "(" + (T.routedSoldiers ? (T.pursuitDead / T.routedSoldiers * 100).toFixed(0) : "-") + "% of the routed)",
    "| unit battles", T.battles, "declined", T.battleDeclined, "caught", T.battleCaught, "drawn", T.drawnBattles, "units broke", T.unitsBroke, "withdrew", T.unitsWithdrew,
    "| places given up on terms", T.termsTaken || 0, "refused", T.termsRefused || 0, "taken", T.captures || 0, "| dead at a village", T.deadAtVillage, "in the line", T.deadLine, "of wounds", T.diedOfWounds);
}
