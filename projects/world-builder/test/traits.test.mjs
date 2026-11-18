// The ten traits, and what happens moving them (TODO.md item 10, 2026-11-17). Ric: how fast
// "A little"; setting them "Ten sliders"; a fight between neighbours kills "Rarely, as in history".
//
// What is held:
//   1. each person's bold, warm, greedy and stubborn come out as before item 10 at the sliders'
//      middles, and each of the ten sliders moves what people are like at the start;
//   2. each of the five new traits changes a real choice: the hardworking rest less, the curious
//      do work that is not their trade, the hot-tempered quarrel, the patient lay in for the
//      winter, the dishonest steal when hungry;
//   3. a village that was raided ends up different from the same village not raided: quicker to
//      anger, closer to its own, less willing to wait — and half of that is set to wear off.
//
// node projects/world-builder/test/traits.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

// 1. The start.
{
  /* bold, warm, greed and stub of every founder of seed 11, as the engine before item 10 made them. */
  const w = People.create({ seed: 11 });
  let h = 0;
  for (const p of w.people) for (const k of ["bold", "warm", "greed", "stub"]) h = (h * 31 + Math.round(p[k] * 1e6)) % 2147483647;
  assert.equal(h, 1471702330, "the first four traits are drawn as before");

  const field = { bold: "bold", warm: "warm", greedy: "greed", stubborn: "stub", loyalty: "loyal",
                  patient: "patient", temper: "temper", hardwork: "hard", curious: "curious", honest: "honest" };
  const mean = (o, k) => { const w = People.create({ seed: 3, ...o }); return w.people.reduce((a, p) => a + p[k], 0) / w.people.length; };
  for (const [key, k] of Object.entries(field)) {
    const lo = mean({ [key]: 0.2 }, k), hi = mean({ [key]: 0.8 }, k);
    assert.ok(hi - lo > 0.25, key + " sets what people are like: " + lo.toFixed(2) + " → " + hi.toFixed(2));
  }
}

// 2. What each new trait changes. Hours of grown-ups, by what they were doing.
const TRADE = { field: "farmer", make: "crafter", fish: "fisher", cut: "woodcutter", quarry: "miner", mine: "miner", herd: "herder", hunt: "hunter" };
function hours(o, days, seed) {
  const w = People.create({ seed: seed || 11, ...o }), c = { all: 0, rest: 0, work: 0, off: 0 };
  for (let h = 0; h < 24 * days; h++) {
    w.step(1);
    for (const p of w.people) if (w.adult(p)) {
      c.all++;
      if (p.task === "rest" || p.task === "visit") c.rest++;
      if (TRADE[p.task]) { c.work++; if (TRADE[p.task] !== p.job) c.off++; }
    }
  }
  const s = w.stats();
  return { rest: c.rest / c.all, work: c.work / c.all, off: c.off / c.work, quarrels: s.quarrels, fights: s.fights, pilfered: s.pilfered };
}
{
  const idle = hours({ hardwork: 0.1 }, 20), keen = hours({ hardwork: 0.9 }, 20);
  assert.ok(keen.rest < idle.rest * 0.5 && keen.work > idle.work + 0.05,
    "the hardworking work: resting and visiting " + (idle.rest * 100).toFixed(1) + "% → " + (keen.rest * 100).toFixed(1) + "%, at work " + (idle.work * 100).toFixed(1) + "% → " + (keen.work * 100).toFixed(1) + "%");

  const set = hours({ curious: 0.1 }, 20), new_ = hours({ curious: 0.9 }, 20);
  assert.ok(new_.off > set.off + 0.05, "the curious try other trades: " + (set.off * 100).toFixed(1) + "% → " + (new_.off * 100).toFixed(1) + "% of their work");

  const calm = hours({ temper: 0.1 }, 20), hot = hours({ temper: 0.9 }, 20);
  assert.ok(hot.quarrels > calm.quarrels * 5 + 20 && hot.fights > calm.fights, "the hot-tempered quarrel: " + calm.quarrels + " → " + hot.quarrels + ", fights " + calm.fights + " → " + hot.fights);

  /* In the autumn, with the winter ahead: the patient lay in, the impatient leave it. */
  const now = hours({ patient: 0.1, start: "autumn", plague: "none" }, 20), later = hours({ patient: 0.9, start: "autumn", plague: "none" }, 20);
  assert.ok(later.work > now.work + 0.02, "the patient lay in for the winter: at work " + (now.work * 100).toFixed(1) + "% → " + (later.work * 100).toFixed(1) + "%");

  /* A winter with little put by: hungry households, and some with plenty. Two worlds, since in
     any one it comes down to a few households. */
  const robbed = (honest, seed) => hours({ honest, start: "winter", stored: 0.2 }, 30, seed).pilfered;
  const crooks = { pilfered: robbed(0.1, 11) + robbed(0.1, 3) }, straight = { pilfered: robbed(0.9, 11) + robbed(0.9, 3) };
  assert.ok(crooks.pilfered > straight.pilfered * 3 + 5, "the dishonest steal when hungry: " + straight.pilfered + " → " + crooks.pilfered + " larders robbed");
}

// 3. A raid. The same world twice; in one, enemies struck in a village on its first day.
{
  const a = People.create({ seed: 11 }), b = People.create({ seed: 11 });
  a.step(2); b.step(2);
  const v = a.villages.find(x => x.alive && x.pop > 30);
  const here = a.people.filter(p => p.home === v.id).map(p => p.id);
  a.villages[v.id].raidAt = 0;   // the blow's hour, long enough after the last (none) to be a raid of its own
  a.step(24 * 30); b.step(24 * 30);
  const both = here.filter(id => a.byId.get(id) && b.byId.get(id) && a.byId.get(id).hp > 0 && b.byId.get(id).hp > 0);
  assert.ok(both.length > 20, "most of the village is still there: " + both.length);
  const avg = (w, k) => both.reduce((s, id) => s + w.byId.get(id)[k], 0) / both.length;
  const d = k => avg(a, k) - avg(b, k);
  assert.ok(d("temper") > 0.025, "raided, quicker to anger: " + d("temper").toFixed(3));
  assert.ok(d("warm") > 0.01, "raided, closer to their own: " + d("warm").toFixed(3));
  assert.ok(d("patient") < -0.01, "raided, less willing to wait: " + d("patient").toFixed(3));
  /* Half of it is still to wear off. */
  const left = both.reduce((s, id) => s + (a.byId.get(id).fade ? a.byId.get(id).fade[5] : 0), 0) / both.length;
  assert.ok(left > 0.015 && left < 0.021, "half of the raid's anger is set to wear off: " + left.toFixed(4));
  assert.equal(a.stats().raids, 1, "counted as one raid");
}

console.log("world-builder traits: the start as before, ten sliders, each new trait changes a choice, a raided village is changed");
