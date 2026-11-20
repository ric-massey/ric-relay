// The land sent to the page a block at a time (TODO.md item 15.25, pass 4, 2026-11-20).
//
// Once the page holds a whole land, the keeper sends only the blocks whose crops or holders have
// changed. What is held:
//   1. a page that applies every update, small or big land, asking every few steps or every two
//      seconds, always holds exactly the land the engine has: each square's crop and holder;
//   2. an update the page did not take (dropped, or for a land it no longer holds) is followed by
//      the whole land at the next ask, and the page is right again;
//   3. a new world starts with the whole land, never a piece of the last one;
//   4. a quiet stretch sends far less than the whole land; an update is never bigger than it.
//
// node projects/world-builder/test/land-updates.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const People = require("../people.js"), Host = require("../people-host.js");

function keeper() {
  const got = [];
  const host = Host.create(People, m => got.push(m));
  const ask = m => { got.length = 0; host.receive(m); return got[got.length - 1]; };
  return { host, ask };
}
const view = (w, land) => ({ t: "frame", cam: { x: w.cols / 2, y: w.rows / 2, s: 1, w: 200, h: 200 }, view: "faction", land });
/* The page's side, as index.html does it (`takeLand`): a whole land is taken as it is; a part
   only on top of the land it follows on from. */
function take(page, L) {
  if (!L) return false;
  if (!L.part) { page.full = L.full; page.owner = L.owner; page.at = L.at; return true; }
  if (page.at !== L.base) return false;
  const bc = Math.ceil(page.cols / L.B);
  const put = (blocks, from, into) => {
    let k = 0;
    for (const b of blocks) {
      const x0 = (b % bc) * L.B, y0 = Math.floor(b / bc) * L.B, x1 = Math.min(page.cols, x0 + L.B), y1 = Math.min(page.rows, y0 + L.B);
      for (let y = y0; y < y1; y++) { into.set(from.subarray(k, k + x1 - x0), y * page.cols + x0); k += x1 - x0; }
    }
    assert.equal(k, from.length, "every square sent is placed");
  };
  put(L.cropB, L.crop, page.full); put(L.ownB, L.own, page.owner);
  page.at = L.at;
  return true;
}
function same(page, w, why) {
  const tiles = w.cols * w.rows;
  for (let i = 0; i < tiles; i++) {
    const f = w.fert[i], full = f > 0 ? Math.round(Math.min(1, w.stock[i] / (f * w.tileCapacity)) * 255) : 255;
    if (page.full[i] !== full || page.owner[i] !== w.owner[i]) assert.fail(why + ": square " + i + " is " + page.full[i] + "/" + page.owner[i] + ", the engine has " + full + "/" + w.owner[i]);
  }
}
const bytes = L => L.part ? L.crop.byteLength + L.own.byteLength + L.cropB.byteLength + L.ownB.byteLength : L.full.byteLength + L.owner.byteLength;

// 1 and 4. A small land asked every few steps, and a big one asked as the page asks it (force).
for (const [set, force, hours] of [[{ people: 300, seed: 9, map: 14 }, false, 2], [{ people: 200, seed: 3, map: 120 }, true, 6]]) {
  const k = keeper(); k.ask({ t: "start", values: set });
  const w = k.host.world, page = { cols: w.cols, rows: w.rows, at: -1 };
  assert.ok(take(page, k.ask(view(w, { at: -1, force: true })).land), "the first land is whole");
  const whole = w.cols * w.rows * 5;
  let parts = 0, sent = 0, changedOwners = 0;
  for (let n = 0; n < 60; n++) {
    w.step(hours);
    const f = k.ask(view(w, { at: page.at, force }));
    assert.ok(f.land, "an update each ask");
    assert.ok(f.land.part, "after the first, only what changed");
    assert.ok(bytes(f.land) <= whole + 64, "never more than the whole land");
    if (f.land.ownB.length) changedOwners++;
    parts++; sent += bytes(f.land);
    assert.ok(take(page, f.land), "the page takes it");
    same(page, w, "after update " + n);
  }
  assert.ok(sent / parts < whole, "on average less than the whole land: " + Math.round(sent / parts) + " bytes against " + whole);
  // 2. One update not taken: the next ask names the old land, and gets the whole of it.
  w.step(24);
  const lost = k.ask(view(w, { at: page.at, force })).land;
  assert.ok(lost.part);
  w.step(24);
  const next = k.ask(view(w, { at: page.at, force: true })).land;
  assert.ok(!next.part, "a page behind is sent the whole land");
  assert.ok(take(page, next)); same(page, w, "after a missed update");
  // and a part that does not follow on from what the page holds is not taken
  w.step(24);
  const later = k.ask(view(w, { at: page.at, force: true })).land;
  assert.ok(later.part);
  assert.equal(take({ ...page, at: page.at - 1 }, later), false, "a part for another land is refused");
  console.log("  " + w.cols + " squares across: " + parts + " updates, " + Math.round(sent / parts) + " bytes each on average against " + whole + " whole" + (changedOwners ? ", holders changed in " + changedOwners : ""));
}

// 3. A new world: the whole land, though the page names a land from the last one.
{
  const k = keeper(); k.ask({ t: "start", values: { people: 100, seed: 2, map: 10 } });
  const w = k.host.world;
  const first = k.ask(view(w, { at: -1, force: true })).land;
  k.ask({ t: "start", values: { people: 100, seed: 5, map: 10 } });
  const w2 = k.host.world;
  const again = k.ask(view(w2, { at: first.at, force: true })).land;
  assert.ok(!again.part, "a new world's first land is whole");
  const page = { cols: w2.cols, rows: w2.rows, at: -1 };
  take(page, again); same(page, w2, "a new world");
}

console.log("world-builder land updates: a page applying only changed blocks holds the engine's land, a missed update is made good, a new world starts whole");
