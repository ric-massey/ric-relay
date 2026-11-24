// Faith, deeper (TODO 15.11b to h and n to z, 2026-11-24). Ric: "i just want it to be realistic you know?";
// "finnish all of 15".
//
// What is held, a part at a time:
//   1. with every part off, a world in which three faiths are held is the old one, exactly (fingerprinted);
//   b. every person holds a folk belief, taken after their parents; letting a faith go falls back on it;
//      a faith that keeps it passes more readily to those who hold it;
//   b2. a faith holds many more things, each from its maker, and the ones that clash are kept out;
//   c. a reader's zeal fades far faster than one who cannot read; offerings that failed take zeal away;
//   d. the ruler's people come over to the ruler's faith; a hard ruler forces it, and the forced hide theirs;
//   e. a faith held by two rulers splits into a sect that knows it was one; side by side, one borrows;
//   f. a faith drifts toward its holders' nature; a dead written faith is found again;
//   g. the tithe moves coins from hand to hand; a shrine is begun and built;
//   h. a feast draws on the store; a burial on the household;
//   n. belief takes fear away;
//   o. an alliance of one faith is sworn; a teaching faith's priest hears an accusation;
//   p. an equal faith frees its unfree; a faith of stations marks the household's means;
//   q. a coming of age is a gathering that costs a little food;
//   r. a faith that reads teaches its children to read;
//   s. what its readers knew is given back; a faith that turns from new things refuses them;
//   t. a faith's truce days; u. belief adds to an army's nerve;
//   v. somebody pressed hard leaves with their household; w. a great temple is begun and raised;
//   x. pilgrims go, and come back holding it harder; y. a sacred grove is spared; z. washing and healing.
//
// node projects/world-builder/test/faithdeep.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const OFF = { folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false,
              faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false,
              pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll" };   // 15.12b to d, built after, off too
const OLD = 2973522624;   // print() of the world below before 15.11b to z (after 15.12a's dice)
function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); mix(p.zeal || 0); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
const grown = w => w.people.filter(p => p.hp > 0 && w.adult(p));
/* Each people's ruler makes a faith, and twenty of their people hold it. */
function faithful(opts, n = 20) {
  const w = People.create({ seed: 2, people: 250, neighbours: "enemies", era: "medieval", ...opts }); w.step(24 * 3);
  const adults = grown(w);
  for (const f of w.factions) { const lead = w.byId.get(f.leader); if (!lead) continue; const fa = w.makeFaith(lead, "famine"); for (const q of adults.filter(p => p.f === f.id).slice(0, n)) { w.convert(q, fa.id); q.zeal = 0.8; } lead.zeal = 1; }
  w.faithDay();
  return w;
}

// 1. Off: the world before.
{
  const w = faithful(OFF); w.step(24 * 60);
  assert.equal(print(w), OLD, "with every part off, the old world exactly");
}

// b. Belief before faiths.
{
  const w = People.create({ seed: 3, people: 300 });
  const folk = w.people.map(p => p.lf.folk);
  assert.ok(folk.every(x => x >= 0 && x <= 1) && Math.max(...folk) - Math.min(...folk) > 0.2, "everybody holds a folk belief, some more than others");
  assert.ok(["ancestors", "spirits", "both"].includes(w.deep.folkOf(0)), "each people's is of the ancestors, the spirits, or both: " + w.deep.folkOf(0));
  /* Each child as it is born, against their parents as they are then. */
  const seen = new Set(w.people.map(p => p.id)), gaps = [];
  for (let h = 0; h < 24 * 200; h++) {
    w.step(1);
    for (const c of w.people) if (!seen.has(c.id)) { seen.add(c.id); const m = w.byId.get(c.mum), d = w.byId.get(c.dad); if (m && d) gaps.push(Math.abs(c.lf.folk - (m.lf.folk + d.lf.folk) / 2)); }
  }
  assert.ok(gaps.length > 0, "children were born");
  assert.ok(gaps.every(g => g <= 0.05 + 1e-9), "each takes after their parents, within 0.05 of their middle (" + gaps.length + " born)");
  const p = grown(w)[0], fa = w.makeFaith(p, "famine");
  p.zeal = 0.01; p.lf.folk = 0.1; p.hungry = 0; p.fear = 0; p.sick = 0;
  w.faithDay();
  assert.equal(p.faith, null, "a faith let go");
  assert.ok(p.lf.folk >= 0.5, "falls back on the old belief, not on nothing (" + p.lf.folk + ")");
  /* Pull: the same talk with a faith that keeps the ancestors or does not, to somebody whose folk belief is strong. */
  const kept = w.faiths[fa.id];
  assert.ok(kept.sacred, "a faith made under many rules says what it holds sacred");
}

// b2. What a faith can hold.
{
  const w = People.create({ seed: 4, people: 200 });
  const p = grown(w)[0];
  Object.assign(p, { warm: 0.95, patient: 0.9, temper: 0.05, bold: 0.9, stub: 0.2, honest: 0.6, greed: 0.1, curious: 0.5, loyal: 0.5 });
  const fa = w.makeFaith(p, "famine");
  assert.equal(fa.harm, "all", "the warm, patient and mild make a faith that harms no one");
  assert.notEqual(fa.rite, "sacrifice", "and it never asks for a sacrifice");
  assert.equal(fa.holyWar, false, "nor for holy war");
  assert.ok(w.deep.words(fa.id).includes("harms no one"), "the Factions tab says so: " + w.deep.words(fa.id));
  const q = grown(w)[1];
  Object.assign(q, { warm: 0.1, patient: 0.2, temper: 0.95, bold: 0.95, stub: 0.9, honest: 0.3, greed: 0.6, curious: 0.2, loyal: 0.5 });
  const fb = w.makeFaith(q, "lost");
  assert.equal(fb.rite, "sacrifice", "the hot, bold and cold still make one that does");
  assert.equal(fb.after, "reward", "and promise a reward after death");
  assert.ok(["fight", "convert"].includes(fb.toward), "and stand against others: " + fb.toward);
  const keys = ["sacred", "after", "food", "harm", "lead", "join", "pilgrim", "monks", "heal", "toward", "give", "lend", "rank", "wash", "truce", "bans"];
  for (const k of keys) assert.ok(k in fa, "a faith holds " + k);
  const few = People.create({ seed: 4, people: 200, faithRules: "few" });
  assert.equal(few.makeFaith(grown(few)[0], "famine").sacred, undefined, "\"as before\" makes the five-part faith");
}

// c. Fading that follows the time.
{
  const w = People.create({ seed: 5, people: 200, era: "medieval" });
  const [a, b] = grown(w);
  const fa = w.makeFaith(a, "famine"); w.convert(b, fa.id);
  a.know = (a.know || 0) | (1 << w.deep.ti("writing")); b.know = (b.know || 0) & ~(1 << w.deep.ti("writing"));
  for (const p of [a, b]) { p.zeal = 0.6; p.hungry = 0; p.fear = 0; p.sick = 0; }
  const ra = w.deep.fadeOf(a), rb = w.deep.fadeOf(b);
  assert.ok(ra > rb * 5, "a reader's zeal fades far faster than one who cannot read (" + ra.toFixed(5) + " a day against " + rb.toFixed(5) + ")");
  const old = People.create({ seed: 5, people: 200, fading: "old" });
  const [c] = grown(old); old.makeFaith(c, "famine"); c.zeal = 0.6; c.hungry = 0; c.fear = 0; c.sick = 0;
  old.faithDay();
  assert.ok(Math.abs(c.zeal - (0.6 - 0.0015)) < 1e-9, "\"as before\": 0.0015 a day for anybody fed and safe");
  /* Offerings that promised to keep the hard times away: twice in a year, and the faith fails them. */
  const v = w.villages[a.home];
  fa.rite = "offering";
  for (const p of w.people.filter(q => q.home === v.id && w.adult(q) && q.hp > 0).slice(0, 6)) { w.convert(p, fa.id); p.zeal = 0.6; p.stub = 0.3; }
  w.hardTimes(v.id, "famine", 1);
  const z1 = w.people.filter(p => p.faith === fa.id && p.home === v.id).map(p => p.zeal);
  w.hardTimes(v.id, "famine", 1);
  const z2 = w.people.filter(p => p.faith === fa.id && p.home === v.id).map(p => p.zeal);
  assert.ok(w.stats().failedRite > 0 && z2.reduce((s, x) => s + x, 0) < z1.reduce((s, x) => s + x, 0), "hard times again within the year, and offerings that failed take zeal away");
}

// d. From the top.
{
  const run = opts => {
    const w = faithful({ ...opts, seed: SEED, factions: 1, neighbours: "peaceful" }, 12);
    const f = w.factions[0], id = f.faith, lead = f.leader, before = grown(w).filter(p => p.faith === id).length;
    for (const p of grown(w)) p.loyal = Math.max(p.loyal, 0.7);
    w.step(24 * 120);
    return { w, f, before, after: grown(w).filter(p => p.faith === id).length, n: grown(w).length, same: f.leader === lead };
  };
  /* The faith the ruler held at the start, in a world where the same ruler is still there after 120 days
     (in seed 6's the ruler changed in the second week, and the new one held nothing). */
  const SEED = 9;
  const top = run({}), none = run({ fromTop: false });
  assert.ok(top.same, "the same ruler all along");
  console.log("  from the ruler: " + top.before + " -> " + top.after + " of " + top.n + " hold the ruler's faith in 120 days (" + none.after + " without)");
  assert.ok(top.w.stats().followed > 0 && top.after > none.after, "the loyal come over to the ruler's faith");
  /* A hard ruler. */
  const w = faithful({ seed: 7, factions: 1, neighbours: "peaceful" }, 12), f = w.factions[0], lead = w.byId.get(f.leader);
  Object.assign(lead, { temper: 0.95, stub: 0.95, zeal: 1 }); f.rule = "chief"; if (f.gov) f.gov.n = 0;
  const other = grown(w).find(p => p.faith == null && p.id !== lead.id), fb = w.makeFaith(other, "sick");
  w.deep.deepDay();
  assert.equal(f.faithLaw, "force", "a hot, stubborn, zealous ruler orders everybody into it");
  w.deep.force(other, f.faith);
  assert.equal(other.faith, f.faith, "forced, they hold it");
  assert.equal(other.lf.hid, fb.id, "and keep their own hidden");
  f.faithLaw = ""; lead.zeal = 0.5; other.lf.press = 0;
  for (let d = 0; d < 200 && other.lf.hid >= 0; d++) w.deep.deepDay();
  assert.equal(other.faith, fb.id, "pressed no more, they go back to it");
}

// e. When faiths meet.
{
  const w = faithful({ seed: 8, factions: 2, neighbours: "peaceful" });
  const [f, g] = w.factions, fa = w.faiths[f.faith];
  const n = w.faiths.length;
  w.deep.sect(fa.id, g.id);
  const s = w.faiths[n];
  assert.ok(s && s.sect && s.from === fa.id, "a faith held by two rulers splits: the second's people a sect that knows it was one");
  assert.equal(g.faith, s.id, "the second ruler holds the sect");
  assert.ok(w.people.filter(p => p.f === g.id && p.faith === fa.id).length === 0, "and its holders there went with it");
  /* Two faiths side by side, neither bound to win the other over: the smaller borrows the bigger's days. */
  const v = w.villages.find(u => u.alive && u.f === f.id);
  const here = w.people.filter(p => p.home === v.id && p.hp > 0 && w.adult(p));
  const big = w.makeFaith(here[0], "famine"), small = w.makeFaith(here[1], "sick");
  big.toward = small.toward = "tolerant"; big.every = 7; small.every = 10;
  here.slice(2, 10).forEach(p => w.convert(p, big.id)); here.slice(10, 14).forEach(p => w.convert(p, small.id));
  v.major = big.id; v.second = small.id; v.majorN = 9; v.secondN = 5;
  w.deep.blend(v.id);
  assert.equal(small.every, 7, "the smaller takes up the bigger's holy day");
}

// f. A faith that changes.
{
  const w = faithful({ seed: 9, factions: 1, neighbours: "peaceful" });
  const fa = w.faiths[w.factions[0].faith];
  fa.rite = "fast"; fa.harm = "";
  for (const p of w.people.filter(q => q.faith === fa.id)) Object.assign(p, { warm: 0.95, patient: 0.2, greed: 0.2, temper: 0.1, bold: 0.3 });
  let changed = false;
  for (let i = 0; i < 60 && !changed; i++) { w.deep.driftNow(fa.id); changed = fa.rite === "feast"; }
  assert.ok(changed, "a faith of fasting, held by the warm, comes to keep a feast");
  /* Written down and gone: a reader finds it again. */
  const p = grown(w).find(q => q.faith == null);
  const old = w.makeFaith(p, "famine"); old.written = true; old.alive = false; p.faith = null;
  p.know = (p.know || 0) | (1 << w.deep.ti("writing"));
  assert.ok(w.deep.revive(p, p.home), "a reader in hard times finds a dead written faith");
  assert.ok(old.alive && p.faith === old.id, "and takes it up again");
}

// g. What a faith costs and owns.
{
  const w = faithful({ seed: 10, factions: 1, neighbours: "peaceful" }, 30);
  const f = w.factions[0];
  const money = () => w.people.reduce((s, p) => s + (p.hp > -99 ? p.coins : 0), 0) + w.villages.reduce((s, v) => s + v.till, 0) + w.factions.reduce((s, x) => s + x.treasury, 0);
  w.deep.deepDay();
  assert.ok(f.tithe, "a zealous ruler of the people's faith takes a tithe");
  for (const p of grown(w)) p.coins += 20;
  const m0 = money(), t0 = w.stats().tithe;
  let d = 0; while (w.stats().tithe === t0 && d++ < 40) w.step(24);
  assert.ok(w.stats().tithe > t0, "it is paid, once a month");
  const begun = w.villages.find(v => v.shrine);
  w.step(24 * 90);
  const s = w.stats();
  console.log("  a faith's wealth: tithe " + s.tithe.toFixed(1) + " coins; shrines begun " + s.shrinesBegun + ", built " + s.shrines);
  assert.ok(s.shrinesBegun > 0, "a village raises a shrine");
}

// h. Feasts and the dead.
{
  const w = faithful({ seed: 11, factions: 1, neighbours: "peaceful" }, 30);
  const fa = w.faiths[w.factions[0].faith]; fa.feasts = true;
  w.step(24 * 365);
  const s = w.stats();
  console.log("  a year of feasts: " + s.feasts + " feasts, " + Math.round(s.feastFood) + " days of food, " + s.feastHours + " gatherings; " + s.funerals + " buried, " + Math.round(s.funeralFood) + " days of food");
  assert.ok(s.feasts > 0 && s.feastFood > 0, "feasts are kept, and the store pays");
  assert.ok(s.funerals > 0, "the dead are buried by their households");
}

// n. Comfort.
{
  const w = People.create({ seed: 12, people: 200 });
  const [a, b] = grown(w); const fa = w.makeFaith(a, "famine"); a.zeal = 1; b.lf.folk = 0;
  assert.ok(w.deep.comfortOf(a) > w.deep.comfortOf(b), "the devout's fear falls faster");
}

// o. Oaths, courts and sanctuary.
{
  const w = faithful({ seed: 13, factions: 2, neighbours: "peaceful" });
  const [f, g] = w.factions;
  assert.equal(w.deep.sworn(f.id, g.id), false, "two peoples of two faiths swear by none they share");
  g.faith = f.faith;
  assert.equal(w.deep.sworn(f.id, g.id), true, "of one faith, they do");
}

// p. Who is above whom.
{
  const w = People.create({ seed: 14, people: 200 });
  const p = grown(w)[0];
  p.coins = 30; assert.equal(w.deep.rankOf(p), 2); p.coins = 1; assert.equal(w.deep.rankOf(p), 0, "a household's station is its means");
}

// q and r. Rites of a life; a faith that reads.
{
  const w = People.create({ seed: 15, people: 300, grown: 14 });
  w.step(24);
  const kid = w.people.find(p => p.hp > 0 && p.age > 13.5 && p.age < 14);
  w.deep.ritesDay();
  const r0 = w.stats().lifeRites;
  if (kid) { kid.age = 14.01; w.deep.ritesDay(); assert.ok(w.stats().lifeRites > r0, "coming of age is a gathering"); }
  w.step(24 * 200);
  assert.ok(w.stats().lifeRites > 0 && w.stats().riteFood > 0, "births, comings of age and weddings cost a little food (" + w.stats().lifeRites + ")");
}

// s. Keeping and forbidding.
{
  const w = faithful({ seed: 16, factions: 1, neighbours: "peaceful" });
  const fa = w.faiths[w.factions[0].faith], p = w.people.find(q => q.faith === fa.id && w.adult(q));
  fa.bans = true; fa.oldKnow = 0; p.zeal = 0.9;
  assert.equal(w.deep.refuses(p, "mill"), true, "a zealous holder of a faith that turns from new things refuses what was not known when it was made");
  p.zeal = 0.3;
  assert.equal(w.deep.refuses(p, "mill"), false, "the lukewarm do not");
}

// t and u. Truce days; nerve.
{
  const w = faithful({ seed: 17, factions: 2 });
  const f = w.factions[0], fa = w.faiths[f.faith];
  fa.truce = "a month";
  assert.equal(typeof w.deep.truceDay(fa.id), "boolean");
  f.armyZeal = 0.9; fa.after = "reward";
  assert.ok(w.deep.nerve(f.id) > 0.25 * 0.9, "soldiers who hold a faith that promises a reward hold longer (" + w.deep.nerve(f.id).toFixed(2) + ")");
}

// v. Fleeing for faith.
{
  const w = faithful({ seed: 18, factions: 2, neighbours: "peaceful" });
  const p = w.people.find(q => q.faith != null && w.adult(q) && q.id !== w.factions[q.f].leader);
  const from = p.home;
  p.lf.press = 3;
  assert.ok(w.deep.flee(p), "somebody pressed hard for their faith leaves");
  assert.notEqual(p.home, from, "for another place");
  assert.ok(w.stats().fledFaith >= 1);
}

// w. A great temple.
{
  const w = faithful({ seed: 19, factions: 1, neighbours: "peaceful" }, 100);
  const f = w.factions[0], fa = w.faiths[f.faith], lead = w.byId.get(f.leader), v = w.villages[lead.home];
  for (const p of w.people.filter(q => q.faith === fa.id)) p.zeal = 0.9;
  w.deep.deepDay();
  v.food = v.pop * 40;
  w.deep.greatWork(f.id);
  assert.ok(v.temple, "a people that holds its faith hard, with food to spare, begins a great temple");
  const builder = w.people.find(q => q.faith === fa.id && w.adult(q));
  builder.x = v.temple.x; builder.y = v.temple.y;
  v.temple.work = 30000 - 1; w.deep.holyWork(builder);
  assert.ok(v.temple.built && w.stats().temples === 1, "and raises it");
}

// x. Pilgrims.
{
  const w = faithful({ seed: 20, factions: 1, neighbours: "peaceful" }, 40);
  const fa = w.faiths[w.factions[0].faith];
  for (const p of w.people.filter(q => q.faith === fa.id)) p.zeal = 0.9;
  w.deep.pilgrimage(fa.id);
  const going = w.people.filter(p => p.lf.pilgrim >= 0);
  if (going.length) {
    const p = going[0], z = p.zeal; w.deep.arrived(p);
    assert.ok(p.zeal > z && p.lf.pilgrim === -1 && w.stats().pilgrims === 1, "a pilgrim arrives and holds it harder");
  }
  console.log("  pilgrims: " + going.length + " set out");
}

// y. Sacred land; z. washing and healing.
{
  let spared = false;
  for (const seed of [21, 22, 23, 24, 25]) {
    const w = People.create({ seed, people: 200, materials: "goods" });
    for (const v of w.villages) if (w.deep.folkOf(v.f) !== "ancestors" && w.deep.sacredOf(v.id) >= 0) spared = true;
    if (spared) { w.step(24 * 30); console.log("  sacred land: " + w.stats().sacredPlaces + " places, spared " + w.stats().sacredSpared + " times in a month"); break; }
  }
  assert.ok(spared, "a people that sees spirits in places holds a grove or a peak near a village sacred");
  const w = People.create({ seed: 26, people: 100 });
  const p = grown(w)[0], fa = w.makeFaith(p, "sick"); fa.wash = true; p.zeal = 0.9;
  assert.equal(w.deep.washes(p), true, "a faith of washing keeps its zealous holders cleaner");
}

// Every part, with something held: a year of three peoples whose rulers hold faiths, nothing breaks, and the
// parts that come of themselves came.
{
  const w = faithful({ seed: 3, people: 400, factions: 3 }, 25); w.step(24 * 365);
  const s = w.stats();
  for (const k of ["followed", "tithe", "shrinesBegun", "feasts", "funerals", "lifeRites", "pilgrimages", "sacredPlaces"]) assert.ok(s[k] > 0, k + " came in a year (" + s[k] + ")");
  for (const p of w.people) assert.ok(Number.isFinite(p.zeal ?? 0) && Number.isFinite(p.lf.folk), "no number missing");
  console.log("world-builder faith, deeper: off is the world before; folk belief, rules, fading, the ruler, meeting, drift, wealth, feasts, comfort, oaths, rank, rites, reading, keeping, truce, nerve, flight, temples, pilgrims, sacred land, health");
}
