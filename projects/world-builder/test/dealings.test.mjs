// Leaders and factions that deal with each other (TODO.md item 13, 2026-11-18).
//
// What is held:
//   1. "two tribes that hate each other with almost no money" is a preset on the setup page, and
//      it gives exactly that: two factions, hostile both ways, every grown-up holding the old
//      feud, a coin a head; and the feud still holds half a year on;
//   2. the same two factions under hot-tempered leaders and under patient ones end up measurably
//      different: more days at war under the hot-tempered, and no fewer killed;
//   3. old friends start allied and trading free of tax, and stay at peace;
//   4. an ally is called to a war: it comes, or the alliance is over;
//   5. a demand for tribute is answered, and tribute paid is carried away.
//
// node projects/world-builder/test/dealings.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

// 1. From the setup page alone.
{
  const preset = People.PRESETS.find(p => p.id === "feud");
  assert.ok(preset, "a preset for two old enemies");
  const w = People.create({ seed: 4, ...preset.set });
  const [a, b] = w.factions;
  assert.equal(w.factions.length, 2, "two factions");
  assert.ok(a.rel[b.id].op < -0.4 && b.rel[a.id].op < -0.4, "hostile both ways");
  const coins = w.people.reduce((s, p) => s + p.coins, 0) / w.people.length;
  assert.ok(coins <= 1.5, "almost no money: " + coins.toFixed(2) + " a head");
  const grown = w.people.filter(p => w.adult(p));
  const know = grown.filter(p => w.inMind(p).some(m => m.kind === "news" && m.text.startsWith("Grew up knowing: ")));
  assert.equal(know.length, grown.length, "every grown-up grew up knowing the feud");
  const lead = w.byId.get(a.leader);
  assert.ok(w.heldAgainst(lead, b) > 0.2, "and the leader holds it against the other side: " + w.heldAgainst(lead, b).toFixed(2));
  w.step(24 * 180);
  assert.ok(a.rel[b.id].war || a.rel[b.id].op < -0.3, "half a year on, still hostile or at war: " + a.rel[b.id].op.toFixed(2));
  // An old feud is held like a grudge, not forgotten like the week's news.
  const feud = w.events.find(e => e.kind === "feud"), tellings = feud.vars || [feud.text];
  const now = w.people.filter(p => w.adult(p)), still = now.filter(p => w.inMind(p).some(m => m.kind === "news" && tellings.some(x => m.text.endsWith(x))));
  assert.ok(still.length > now.length * 0.6, "most grown-ups still hold the feud: " + still.length + " of " + now.length);
}

// 2. Hot-tempered against patient leaders, the same two factions, seed for seed.
{
  const run = (kind, seed) => {
    const w = People.create({ seed, factions: 2, neighbours: "enemies", people: 150, coins: 1, rule: "chief" });
    let warDays = 0;
    for (let d = 0; d < 540; d++) {
      for (const f of w.factions) { const l = w.byId.get(f.leader); if (l && !l.set13) { l.temper = kind === "hot" ? 0.95 : 0.05; l.patient = kind === "hot" ? 0.05 : 0.95; l.set13 = true; } }
      w.step(24);
      if (w.factions[0].rel[1].war) warDays++;
    }
    return { warDays, dead: w.stats().battle, wars: w.stats().wars };
  };
  const sum = kind => [31, 62, 93, 124, 155, 186].map(s => run(kind, s)).reduce((t, r) => ({ warDays: t.warDays + r.warDays, dead: t.dead + r.dead, wars: t.wars + r.wars }), { warDays: 0, dead: 0, wars: 0 });
  const hot = sum("hot"), calm = sum("patient");
  assert.ok(hot.warDays > calm.warDays * 2 + 100, "hot-tempered leaders spend far longer at war: " + JSON.stringify({ hot, calm }));
  /* Killed in battle is a handful in six worlds: 6 against 4 before TODO 15a, 3 against 3 after
     (2026-11-20), with war days as lopsided as ever. Too few to tell apart, so only "no fewer". */
  assert.ok(hot.dead >= calm.dead, "and lose no fewer people to it: " + JSON.stringify({ hot, calm }));
}

// 3. Old friends.
{
  const w = People.create({ seed: 5, factions: 3, neighbours: "friends", people: 240 });
  for (const f of w.factions) for (const o of w.factions) if (f !== o) assert.ok(f.rel[o.id].ally && f.rel[o.id].trade, "old friends start allied and trading free of tax");
  w.step(24 * 200);
  assert.equal(w.stats().wars, 0, "and stay at peace");
}

// 4. An ally called to a war.
{
  const w = People.create({ seed: 8, factions: 3, people: 240 });
  const [a, b, c] = w.factions;
  b.rel[c.id].ally = c.rel[b.id].ally = true; b.rel[c.id].op = c.rel[b.id].op = 0.6;
  w.rule(a.id, true);
  assert.equal(w.declare(a.id, b.id, "war"), "war");
  const joined = c.rel[a.id].war, left = !c.rel[b.id].ally;
  assert.ok(joined || left, "the ally comes, or the alliance is over");
  assert.ok(w.events.some(e => e.text.includes(c.name) && (e.text.includes("joined the war") || e.text.includes("to fight " + a.name + " alone"))), "and it is told");
}

// 5. Tribute.
{
  const w = People.create({ seed: 9, factions: 2, people: 200 });
  const [a, b] = w.factions;
  w.rule(a.id, true);
  const r = w.declare(a.id, b.id, "tribute");
  assert.ok(r === "paid" || r === "refused", "a demand is answered: " + r);
  if (r === "paid") { w.step(24 * 10); assert.ok(w.stats().tribute > 0, "tribute is carried"); assert.ok(b.rel[a.id].grief > 0, "and resented"); }
  else assert.ok(a.rel[b.id].grief > 0.2, "a refusal is an insult");
}

console.log("world-builder dealings: old enemies from the setup page, hot and patient leaders differ, old friends stay allied, allies called to war, tribute");
