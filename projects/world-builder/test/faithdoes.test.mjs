// What faith does to everything else: the five ★ parts of TODO 15.11 (2026-11-23; Ric: "do 15.11 the
// stars do all of the stars"). 15.11i losing heaven's favour, j prophets, k blaming a neighbour, l children,
// m trust in trade.
//
// What is held:
//   1. with all five off the world is the old one, exactly (fingerprinted before them);
//   2. (i) a hard time is held against a ruler whose people's faith ties its gods to them, and not where it
//      does not; it takes loyalty away, more from its holders; it fades; a new ruler starts afresh;
//   3. (j) long hard times in one place can bring a prophet, who lives there, with a movement that reads
//      their old faith anew; its holders turn against a ruler who does not hold it; it burns out when the
//      hard times come again; nothing makes one where times have not been hard;
//   4. (k) a hunt picks the one the record says is picked (old, a woman, poor, cold, of another faith, a
//      healer), every hunt ends one way, and a faith that forbids it has far fewer;
//   5. (l) the devout have more children, more where their faith bids it, fewer where it bids restraint; a
//      celibate faith's most zealous marry no one; a faith that marries young ends late marriage;
//   6. (m) a trader trusts a place of their own faith further, and carries there over a place no dearer.
//
// node projects/world-builder/test/faithdoes.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const OFF = { favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" };
const OLD = 512609215;   // print() of the world below before 15.11i to m

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); mix(p.zeal || 0); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
const alive = w => w.people.filter(p => p.hp > 0);
const grown = w => alive(w).filter(p => w.adult(p));
const mean = xs => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
/* A people's own faith, held by its ruler and a dozen more, as 15g makes it. */
function peoplesFaith(w, f, set) {
  const lead = w.byId.get(f.leader);
  const fa = w.makeFaith(lead, "famine");
  Object.assign(fa, set || {});
  for (const q of grown(w).filter(p => p.f === f.id && p !== lead).slice(0, 14)) { w.convert(q, fa.id); q.zeal = 0.8; }
  lead.zeal = 1; w.faithDay();
  assert.equal(f.faith, fa.id, "the ruler's faith is the people's own");
  return fa;
}

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, people: 250, neighbours: "enemies", ...OFF }); w.step(1500);
  assert.equal(print(w), OLD, "with all five off, the old world exactly");
}

// 2. 15.11i, heaven's favour.
{
  const run = tie => {
    const w = People.create({ seed: 4, people: 300, factions: 1, war: false, bandits: false, riots: false, prophets: false, witches: false });
    w.step(24 * 2);
    const f = w.factions[0], fa = peoplesFaith(w, f, { tie });
    const v = w.villages.filter(x => x.alive && x.f === f.id).sort((a, b) => b.pop - a.pop)[0];
    for (let i = 0; i < 3; i++) w.hardTimes(v.id, "famine", 1.5);
    const blame = f.blame;
    w.step(24 * 20);
    return { w, f, fa, blame, holders: mean(grown(w).filter(p => p.f === f.id && p.faith === fa.id).map(p => p.loyal)), all: mean(grown(w).filter(p => p.f === f.id).map(p => p.loyal)) };
  };
  const tied = run(0.9), loose = run(0);
  assert.ok(Math.abs(tied.blame - 3 * 1.5 * 0.9) < 1e-9, "three famines held against the ruler by how far the faith ties its gods to them (" + tied.blame + ")");
  assert.equal(loose.blame, 0, "and nothing where it does not tie them");
  assert.ok(tied.all < loose.all - 0.05, "loyalty falls with it (" + tied.all.toFixed(3) + " against " + loose.all.toFixed(3) + ")");
  const p = grown(tied.w).find(q => q.f === tied.f.id && q.faith === tied.fa.id), q = grown(tied.w).find(x => x.f === tied.f.id && x.faith == null);
  assert.ok(Math.abs(tied.w.blameOn(p, tied.f.id) - 2 * tied.w.blameOn(q, tied.f.id)) < 1e-9 && tied.w.blameOn(p, tied.f.id) > 0, "its holders blame the ruler twice as much as the rest");
  assert.ok(tied.f.blame < tied.blame && tied.f.blame > tied.blame * 0.9, "it fades, slowly: " + tied.blame.toFixed(2) + " to " + tied.f.blame.toFixed(2) + " in twenty days");
  const heir = grown(tied.w).find(x => x.f === tied.f.id && x.id !== tied.f.leader);
  tied.f.leader = heir.id; tied.w.faithDay();
  assert.equal(tied.f.blame, 0, "a new ruler starts afresh");
  console.log("  favour: loyalty " + tied.all.toFixed(2) + " under a ruler blamed for three famines, " + loose.all.toFixed(2) + " where the faith does not tie its gods to them");
}

// 3. 15.11j, prophets.
{
  const w = People.create({ seed: 5, people: 300, factions: 1, war: false, bandits: false, riots: false, favour: false, witches: false });
  w.step(24 * 2);
  const v = w.villages.filter(x => x.alive).sort((a, b) => b.pop - a.pop)[0];
  const quiet = w.villages.filter(x => x.alive && x !== v)[0];
  for (let i = 0; i < 50; i++) w.prophet(quiet.id);
  assert.equal(w.stats().prophets, 0, "nobody comes forward where times have not been hard");
  /* An old faith most here hold, then hard times, again and again. */
  const old = w.makeFaith(grown(w).find(p => p.home === v.id), "famine");
  for (const p of grown(w).filter(q => q.home === v.id).slice(0, 30)) { w.convert(p, old.id); p.zeal = 0.6; }
  let n = 0; while (!w.stats().prophets && n++ < 200) w.hardTimes(v.id, "famine", 1.5);
  assert.equal(w.stats().prophets, 1, "long hard times bring a prophet");
  const fa = w.faiths.find(x => x.move), pr = w.byId.get(fa.founder);
  assert.equal(pr.home, v.id, "who lives there");
  assert.ok(v.trouble >= 4, "past the trouble a prophet needs (" + v.trouble.toFixed(1) + ")");
  if (fa.from >= 0) assert.ok(w.events.some(e => e.kind === "faith" && /a new reading of/.test(e.text)), "a new reading of the old faith, said so");
  /* Its holders turn against a ruler who does not hold it. */
  const followers = grown(w).filter(p => p.home === v.id && p.id !== pr.id && p.id !== w.factions[v.f].leader).slice(0, 20);
  for (const p of followers) { w.convert(p, fa.id); p.zeal = 1; }
  const rest = grown(w).filter(p => p.home === v.id && p.faith !== fa.id);
  w.step(24 * 31);
  const fl = mean(followers.filter(p => p.hp > 0 && p.faith === fa.id).map(p => p.loyal)), rl = mean(rest.filter(p => p.hp > 0).map(p => p.loyal));
  assert.ok(fl < rl - 0.06, "a movement's holders turn against a ruler who does not hold it (" + fl.toFixed(2) + " against " + rl.toFixed(2) + ")");
  /* The promise fails twice, and it burns out. */
  const there = followers.filter(p => p.hp > 0 && p.home === v.id && p.faith === fa.id && p.stub <= 0.65);   // many have left the hungry place by now
  assert.ok(there.length >= 2, "some followers still live there");
  const z0 = mean(there.map(p => p.zeal));
  w.hardTimes(v.id, "famine", 1.5);
  const z1 = mean(there.map(p => p.zeal));
  assert.equal(w.stats().failed, 1, "hard times again are a promise failed");
  assert.ok(z1 < z0 - 0.25, "and those who are not stubborn let go (" + z0.toFixed(2) + " to " + z1.toFixed(2) + ")");
  assert.ok(fa.move, "once is not the end of it");
  w.hardTimes(v.id, "sick", 1);
  assert.ok(!fa.move, "twice, and it is no longer a movement");
  console.log("  prophets: one after " + n + " famines; followers' loyalty " + fl.toFixed(2) + " against " + rl.toFixed(2) + "; zeal " + z0.toFixed(2) + " to " + z1.toFixed(2) + " when the promise failed");
}

// 4. 15.11k, blaming a neighbour.
{
  const make = sorcery => {
    const w = People.create({ seed: 6, people: 300, factions: 1, war: false, bandits: false, riots: false, favour: false, prophets: false, govern: "leader" });
    w.step(24 * 2);
    const f = w.factions[0], fa = peoplesFaith(w, f, { sorcery });
    const v = w.villages.filter(x => x.alive).sort((a, b) => b.pop - a.pop)[0];
    return { w, f, fa, v };
  };
  /* Who is picked: an old woman, poor, cold to others, a healer, of another faith. */
  {
    const { w, v } = make("");
    const here = grown(w).filter(p => p.home === v.id);
    for (const p of here) p.fear = 0.9;
    const other = w.makeFaith(here[3], "sick");
    const odd = here[3];
    Object.assign(odd, { age: 70, sex: 0, coins: 0, warm: 0, job: "healer" });
    for (const p of here) if (p !== odd && p.faith == null && p.id !== w.factions[0].leader) { w.convert(p, w.factions[0].faith); p.zeal = 0.6; }
    let n = 0; while (!w.stats().hunts && n++ < 300) w.hunt(v.id, "famine", 1.5);
    assert.ok(w.stats().hunts === 1, "a frightened village, after a famine, blames somebody");
    const e = w.events.filter(x => x.kind === "witch").pop();
    assert.ok(e && e.text.startsWith(odd.name), "the one the record says is picked: " + (e && e.text));
    assert.ok(/old/.test(e.why) && /a woman/.test(e.why) && /healer/.test(e.why) && /another faith/.test(e.why), "and the log says why (" + e.why + ")");
    assert.ok(other.id >= 0);
  }
  /* Every hunt ends one way; a faith that forbids it has far fewer. */
  const hunts = sorcery => {
    const { w, v } = make(sorcery);
    for (let i = 0; i < 400; i++) { for (const p of grown(w).filter(q => q.home === v.id)) p.fear = 0.6; w.hunt(v.id, "famine", 1.5); }
    const s = w.stats();
    assert.equal(s.hunts, s.acquitted + s.witch + s.drivenOut + s.shunned, "every hunt ends one way");
    return s;
  };
  const plain = hunts(""), forbids = hunts("forbids");
  assert.ok(plain.hunts > 20, "hunts happen (" + plain.hunts + " in 400 hard times)");
  assert.ok(forbids.hunts < plain.hunts * 0.55, "far fewer where the people's faith forbids it (" + forbids.hunts + " against " + plain.hunts + ")");
  console.log("  blaming: " + plain.hunts + " hunts in 400 famines (" + plain.witch + " killed, " + plain.drivenOut + " driven out, " + plain.shunned + " shunned); " + forbids.hunts + " where the faith forbids it");
}

// 5. 15.11l, children.
{
  const w = People.create({ seed: 7, people: 300, factions: 1, war: false, bandits: false, favour: false, prophets: false, witches: false });
  w.step(24 * 2);
  const f = w.factions[0];
  const [a, b, c] = grown(w).filter(p => p.id !== f.leader).slice(0, 3);
  const fa = w.makeFaith(a, "famine");
  Object.assign(fa, { kids: "", celibate: false }); a.zeal = 1;
  assert.ok(Math.abs(w.faithBirths(a, b) - 1.2) < 1e-9, "the devout have more children (" + w.faithBirths(a, b) + ")");
  fa.kids = "many";
  assert.ok(w.faithBirths(a, b) > 1.2 * 1.24, "more where their faith bids it");
  fa.kids = "few";
  assert.ok(w.faithBirths(a, b) < 1, "fewer where it bids restraint");
  b.faith = null;
  assert.equal(w.faithBirths(b, c), 1, "nothing changes for those who hold none");
  fa.celibate = true; a.zeal = 0.95;
  assert.ok(w.celibate(a) && w.faithBirths(a, b) === 0, "a celibate faith's most zealous have none");
  assert.equal(w.wouldWed(a, c), false, "and marry no one");
  a.zeal = 0.5;
  assert.ok(!w.celibate(a), "the rest of its holders do");
  /* Marrying young: a people's faith that bids it ends late marriage. */
  const fb = peoplesFaith(w, f, { wed: "" });
  const lead = w.byId.get(f.leader);
  for (const k of ["bold", "curious", "patient"]) for (const p of grown(w).filter(q => q.f === f.id)) p[k] = 0.9;
  const late = w.marriageDay(f.id);
  assert.ok(late && late.late, "a patient people that sets up its own households marries late");
  fb.wed = "young";
  assert.equal(w.marriageDay(f.id).late, false, "a faith that marries its people young ends late marriage");
  assert.ok(lead);
}

// 6. 15.11m, trust in trade.
{
  const w = People.create({ seed: 8, people: 400, factions: 1, villages: 4, war: false, bandits: false, favour: false, prophets: false, witches: false });
  w.step(24 * 2);
  const vs = w.villages.filter(x => x.alive);
  const p = grown(w).find(q => q.home === vs[0].id);
  const fa = w.makeFaith(p, "famine"); p.zeal = 1;
  const other = w.makeFaith(grown(w).find(q => q.home === vs[1].id && q !== p), "sick");
  for (const v of vs) v.faith = null;
  vs[1].faith = fa.id;
  assert.ok(Math.abs(w.tradeTrust(p, vs[1].id) - 1.3) < 1e-9, "a place of one's own faith is trusted further");
  vs[2].faith = other.id;
  assert.ok(Math.abs(w.tradeTrust(p, vs[2].id) - 0.8) < 1e-9, "a place of another, less");
  assert.equal(w.tradeTrust(p, vs[3].id), 1, "a place of none, as before");
  /* The load a trader would carry is worth as much more to them as they trust the place, and goes elsewhere
     when that place holds another faith and somewhere else is nearly as good. */
  const here = vs[0];
  p.at = here.id;
  for (const v of vs) v.faith = null;
  const plain = w.bestRoute(p, here.id);
  assert.ok(plain.best && plain.gain > 0, "there is a load worth carrying");
  plain.best.faith = fa.id;
  const kin = w.bestRoute(p, here.id);
  assert.ok(kin.best === plain.best && Math.abs(kin.gain - plain.gain * 1.3) < 1e-9, "worth 1.3 times as much to a place of their own faith (" + plain.gain.toFixed(2) + " to " + kin.gain.toFixed(2) + ")");
  plain.best.faith = other.id;
  const wary = w.bestRoute(p, here.id);
  assert.ok(wary.best !== plain.best || Math.abs(wary.gain - plain.gain * 0.8) < 1e-9, "less to a place of another");
  console.log("  trade: the best load from " + here.name + " worth " + plain.gain.toFixed(2) + ", " + kin.gain.toFixed(2) + " where its buyers hold the trader's faith, " + (wary.best === plain.best ? wary.gain.toFixed(2) + " where they hold another" : "and taken elsewhere where they hold another"));
}

console.log("world-builder what faith does: off is the old world; heaven's favour, prophets, blaming a neighbour, children and trust in trade each do what they say");
