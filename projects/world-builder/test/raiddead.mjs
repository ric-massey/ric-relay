// Where war's dead fall (TODO 15.6d). Run by hand; not in the checks.
// node projects/world-builder/test/raiddead.mjs [eras] [seeds] [key=value ...]
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const eras = (process.argv[2] || "early,medieval,industrial,modern").split(",");
const seeds = (process.argv[3] || "1,2,3").split(",").map(Number);
const extra = {}; for (const a of process.argv.slice(4)) { const [k, v] = a.split("="); extra[k] = isNaN(+v) ? v : +v; }
const pc = (a, b) => b ? Math.round(a / b * 100) + "%" : "-";
for (const era of eras) {
  const T = {};
  let n0 = 0;
  for (const seed of seeds) {
    const w = People.create({ seed, era, people: 600, neighbours: "enemies", ...extra });
    n0 += w.people.length;
    w.step(w.YEAR);
    const s = w.stats();
    for (const k of ["battle", "bands", "raids", "knockedOut", "diedOfWounds", "koRaid", "koRaiders", "koAtVillage", "koOpen", "koLine", "deadRaid", "deadRaiders", "deadAtVillage", "deadOpen", "deadLine", "blastDead", "pursuitDead", "raidBurned", "raidKilled", "raidTaken", "raids_met", "raids_lost", "raids_took", "raids_walled"]) T[k] = (T[k] || 0) + (s[k] || 0);
  }
  const ko = T.koRaid + T.koAtVillage + T.koOpen + T.koLine, dead = T.deadRaid + T.deadAtVillage + T.deadOpen + T.deadLine;
  console.log(era.padEnd(11), "war dead/yr", (T.battle / n0 * 100).toFixed(1) + "%", "| bands", T.bands, "| knocked out", ko, "raid", pc(T.koRaid, ko), "(raiders " + pc(T.koRaiders, T.koRaid) + ")", "village", pc(T.koAtVillage, ko), "open", pc(T.koOpen, ko), "line", pc(T.koLine, ko),
    "| dead", T.battle, "raid", pc(T.deadRaid, T.battle), "village", pc(T.deadAtVillage, T.battle), "open", pc(T.deadOpen, T.battle), "line", pc(T.deadLine, T.battle), "blast", pc(T.blastDead, T.battle), "of wounds", pc(T.diedOfWounds, T.battle), "unplaced", T.battle - dead - T.blastDead, "| raids ended: met", T.raids_met, "lost", T.raids_lost, "took", T.raids_took, "walled", T.raids_walled, "| villagers killed", T.raidKilled, "carried off", T.raidTaken);
}
