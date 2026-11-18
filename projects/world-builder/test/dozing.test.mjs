// Passing over people with nothing to do must not change the world
// (TODO.md item 2, 2026-11-15).
//
// people.js no longer visits everybody on every step: somebody asleep, at a
// day's work, idle between tries at a word, or standing in conversation is
// passed over until their time is up, somebody jammed in a crowd until room is
// made beside them (or, where their search for a way round ran out of tries,
// until anybody there moves at all), and the lists of who stands where and who
// lives where are kept up instead of being made again (TODO.md 2 and 2b). Each is only allowed
// to be faster. `create(options, { plainWalking: true })` runs the engine the
// long way round — everybody, every step, every list refilled — and the two
// are held equal here hour by hour, on this machine (a stored answer would
// not do: see walking.test.mjs). `{ audit: true }` also makes the short cuts
// check themselves on every step: nobody passed over may have been changed,
// and every kept list must be what making it again would give.
//
// node projects/world-builder/test/dozing.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

// What a person is, without the engine's own book-keeping.
const OWN = new Set(["ox", "oy", "mc", "mx", "my", "mdx", "mdy", "rm", "on", "ix", "bk", "wg", "wb"]);
const tidy = (k, v) => v instanceof Map ? [...v] : v && typeof v === "object" && !Array.isArray(v) && !ArrayBuffer.isView(v)
  ? Object.fromEntries(Object.entries(v).filter(([key]) => !OWN.has(key))) : v;
const picture = w => JSON.stringify({
  people: w.people.map(p => JSON.stringify(p, tidy)),
  villages: w.villages, factions: w.factions, events: w.events, chatter: w.chatter, stats: w.stats(), stock: Array.from(w.stock)
}, tidy);
function sameFor(label, options, hours, each) {
  const fast = People.create(options, { audit: true }), plain = People.create(options, { plainWalking: true });
  assert.equal(picture(fast), picture(plain), label + ": the two must start as the same world");
  for (let h = 0; h < hours; h++) {
    if (each) { each(fast, h); each(plain, h); }
    fast.step(1); plain.step(1);
    assert.equal(picture(fast), picture(plain), label + ": different after hour " + (h + 1));
  }
  return { fast, plain };
}

// 1. An ordinary country for a day and a night. If nobody were ever passed over this
//    would prove nothing, so count them, and count the visits saved.
{
  const { fast, plain } = sameFor("an ordinary country", { people: 240, seed: 1 }, 28);
  // Everybody is woken on the hour, so look half an hour into the night.
  fast.advance(People.HOUR_SECONDS / 2); plain.advance(People.HOUR_SECONDS / 2);
  assert.equal(picture(fast), picture(plain), "an ordinary country: different half an hour on");
  const share = fast.passedOver / fast.people.length;
  assert.ok(share > 0.5, "at night most people should be passed over; it was " + Math.round(share * 100) + "%");
  assert.ok(fast.visits < plain.visits * 0.7, "passing people over should save visits: " + fast.visits + " against " + plain.visits);
}

// 2. A packed village, where most people are jammed on the way to a bed or a
//    bench: the case the second kind of passing-over exists for.
{
  const { fast, plain } = sameFor("a packed village", { people: 500, factions: 1, villages: 1, map: 7, seed: 3, plague: "none" }, 10);
  assert.ok(fast.visits < plain.visits * 0.6, "a jam should be passed over: " + fast.visits + " visits against " + plain.visits);
}

// 3. People dying and being spoken to: war and sickness on, a hungry start.
sameFor("war and sickness", { people: 360, factions: 4, villages: 1, map: 8, seed: 5, plague: "common", war: true, aggression: 1, deadly: 3, stored: 0 }, 22);

// 4. Going to a neighbour for food, carting grain, moving house: a hard
//    winter on thin land. These are the searches that read who lives where.
sameFor("a hungry winter", { people: 300, seed: 8, stored: 0, rich: 0.3, winter: 1, start: "winter" }, 28);

// 5. One shared store: what a village eats in a day is read on every choice.
sameFor("no money", { ...People.PRESETS.find(p => p.id === "commune").set, people: 240, seed: 21 }, 20);

// 6. Bodies at real size (nobody is ever in the way), and nobody talking (so
//    anybody waiting may be passed over, whatever they are doing).
sameFor("real-size bodies", { people: 300, map: 9, seed: 2, bodies: "real" }, 16);
sameFor("nobody talks", { people: 240, seed: 4, talk: 0 }, 16);

// 7. Done from outside between steps, as other tests and the page may: people
//    moved, killed, sent somewhere, kept waiting, woken, given another home;
//    and a rule of the world changed while it runs.
sameFor("changed from outside", { people: 300, factions: 2, villages: 2, map: 8, seed: 9, plague: "none" }, 16, (w, h) => {
  const ps = w.people;
  if (h === 3 || h === 9) for (let i = 3; i < ps.length; i += 11) ps[i].hp = -99;
  if (h % 4 === 1) for (let i = 0; i < ps.length; i += 7) { const p = ps[i]; p.x = 2 + (i % 40) * 0.5; p.y = 2 + (h % 5) * 0.5; p.tx = p.x; p.ty = p.y; }
  if (h % 4 === 2) for (let i = 1; i < ps.length; i += 5) { const p = ps[i]; p.wait = i % 2 ? 0 : 37; if (i % 3 === 0) { p.task = "idle"; p.tx = p.x + 3; } if (i % 4 === 0) p.sayT = 5; }
  if (h === 6) for (let i = 2; i < ps.length; i += 9) ps[i].home = w.villages[(ps[i].home + 1) % w.villages.length].id;
  if (h === 7) w.set("talk", 0);
  if (h === 11) w.set("talk", 0.9);
});

// 8. Somebody killed in a fight in the middle of a step, while the one they
//    leave behind is asleep, in a world with one shared store (what a village
//    eats in a day is read on every choice there, and a death changes it).
//    Staged, because a night battle is rare in a short run: at two in the
//    morning, people of one flag are stood beside people of another as soldiers.
{
  const { fast } = sameFor("a fight at night", { ...People.PRESETS.find(p => p.id === "commune").set, people: 240, factions: 2, villages: 1, map: 7, war: true, deadly: 3, seed: 6, plague: "none" }, 30, (w, h) => {
    if (h !== 26) return;
    w.factions[0].rel[1].war = w.factions[1].rel[0].war = true;
    const grown = f => w.people.filter(p => p.f === f && p.age >= w.settings.grown && p.id !== w.factions[f].leader);
    const ours = grown(0).slice(0, 40), theirs = grown(1).filter(p => p.partner).slice(0, 40);
    for (const [i, a] of ours.entries()) {
      const b = theirs[i]; if (!b) break;
      for (const [p, dx] of [[a, 0], [b, 0.5]]) {
        p.job = "soldier"; p.gear.weapon = 1; p.hp = p === b ? 0.46 : 1; p.food = 5; p.task = "march"; p.wait = 0;
        p.x = 3 + (i % 8) * 1.1 + dx; p.y = 2 + Math.floor(i / 8) * 1.1; p.tx = p.x; p.ty = p.y;
      }
    }
  });
  assert.ok(fast.stats().battle > 0, "the staged fight should have killed somebody");
}

// 9. Taken to another village in the middle of a step while passed over: one
//    village with nothing, the next with plenty, and nobody talking, so that
//    children waiting beside a parent are passed over when the parent decides
//    to go. And two neighbours equally worth asking: the first in the order of
//    the people array is the one asked, as it was when everybody was looked through.
{
  const { fast } = sameFor("moving house, and equal neighbours", { people: 300, factions: 1, villages: 3, map: 9, seed: 14, talk: 0, winter: 0, plague: "none" }, 20, (w, h) => {
    if (h !== 8 && h !== 12) return;
    const poor = w.villages[0];
    poor.food = 0;
    for (const p of w.people) {
      // nothing holds the grown-ups there but their children, who go with them
      if (p.home === poor.id) { p.food = 0.2; p.coins = 5; p.settled = -1e9; if (p.age >= w.settings.grown) { p.kids = 0; p.partner = 0; p.mood = 0; p.bold = 1; } }
      else if (p.age >= w.settings.grown) p.food = 10;
    }
    for (const v of w.villages) if (v !== poor) v.food = 4000;
  });
  assert.ok(fast.stats().moved > 0, "somebody should have moved house");
}

// 10. However the time is handed over — a day at once, an hour at a time, or a
//    frame at a time as the page does — it is the same world, down to every
//    count a person carries. (A frame is where a wait put right late would show.)
{
  const options = { people: 250, factions: 1, villages: 1, map: 6, seed: 12, plague: "none" };
  const whole = w => JSON.stringify({ people: w.people, minds: w.people.map(p => w.inMind(p)), stats: w.stats() });
  const batch = People.create(options), hourly = People.create(options), framed = People.create(options);
  batch.advance(People.DAY_SECONDS / 3);
  for (let i = 0; i < 8; i++) hourly.step(1);
  for (let i = 0; i < People.DAY_SECONDS / 3 * 60; i++) framed.advance(1 / 60);
  assert.equal(whole(batch), whole(hourly), "a batch and hours must give the same world");
  assert.equal(whole(batch), whole(framed), "a batch and frames must give the same world");
  const plain = People.create(options, { plainWalking: true });
  plain.advance(People.DAY_SECONDS / 3);
  for (const [i, p] of batch.people.entries()) {
    const q = plain.people[i];
    assert.ok(p.wait === q.wait && p.stuck === q.stuck && p.routeRetry === q.routeRetry, "somebody passed over must carry the counts they would have had: " + p.name);
  }
}

// 11. The page's way of handing over time: a frame at a time, giving its word
//     that it has touched nobody (`advance(seconds, true)`), with a rule of the
//     world changed through the engine's own door part-way. Nobody is looked
//     over and no count is put right until `settle()` — after which it must be
//     the world a single batch gives, to the last count.
{
  const options = { people: 250, factions: 1, villages: 1, map: 6, seed: 12, plague: "none" };
  const whole = w => JSON.stringify({ people: w.people, minds: w.people.map(p => w.inMind(p)), stats: w.stats() });
  const batch = People.create(options), framed = People.create(options, { audit: true });
  const third = People.DAY_SECONDS / 6 + People.HOUR_SECONDS * 0.4;   // not on the hour, when everybody has just been woken
  batch.advance(third); batch.set("talk", 0.2); batch.advance(third);
  for (let i = 0; i < third * 60; i++) framed.advance(1 / 60, true);
  framed.set("talk", 0.2);
  for (let i = 0; i < third * 60; i++) framed.advance(1 / 60, true);
  assert.ok(framed.passedOver > 0, "somebody should be passed over when the frames stop");
  framed.settle();
  assert.equal(whole(batch), whole(framed), "frames handed over untouched must give the world a batch gives");
}

// 12. A dense small country, where searches for a way round run out of tries
//     and are remembered until anybody nearby moves: two days of it.
sameFor("a dense small country", { people: 600, map: 8, seed: 7, plague: "none" }, 40);

console.log("dozing: passing over people with nothing to do leaves the world exactly as it was");
