// War dead a year, by era (TODO 15.5i7, measured again for 15.6 and 15.6b). Run by hand; not in the checks.
// The worlds 15.5i6 measured: a year of old enemies, 600 people. Before: the three 2026-11-23 settings
// at their old values; after: the defaults.
//
// node projects/world-builder/test/wardead.mjs [eras] [seeds] [before|after]
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const eras = (process.argv[2] || "early,medieval,industrial,modern").split(",");
const seeds = (process.argv[3] || "1,2,3").split(",").map(Number);
const which = process.argv[4] || "after";
const OLD = { warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" };
for (const era of eras) {
  const row = [];
  for (const seed of seeds) {
    const w = People.create(Object.assign({ seed, era, people: 600, neighbours: "enemies" }, which === "before" ? OLD : {}));
    const n0 = w.people.length;
    w.step(w.YEAR);
    const s = w.stats();
    row.push({ dead: s.battle, share: s.battle / n0, rout: s.pursuitDead, contact: s.contactHours, battles: s.battles, blasts: s.blastDead, civ: s.blastCivilians, broke: s.unitsBroke, withdrew: s.unitsWithdrew, routs: s.routs, wars: s.wars });
  }
  const mean = row.reduce((a, r) => a + r.share, 0) / row.length;
  console.log(which, era.padEnd(11), "dead", row.map(r => r.dead).join(","), "mean " + (mean * 100).toFixed(1) + "%", "| in the rout", row.map(r => r.rout).join(","),
    "| battles", row.map(r => r.battles).join(","), "contact h", row.map(r => r.contact).join(","), "| units broke/withdrew", row.map(r => r.broke + "/" + r.withdrew).join(","), "| blast dead (civilians)", row.map(r => r.blasts + "(" + r.civ + ")").join(","));
}
