// Talking as passing what you hold (TODO.md item 12, 2026-11-18). Ric: a tale changes in the
// telling "1 in 20"; gossip "Yes, cools only"; children start with "a mix of both".
//
// What is held:
//   1. news of an event reaches a village far from it days later, by a path that can be followed
//      back, one telling at a time, to somebody who saw it;
//   2. two villages can believe different things about the same event;
//   3. what is said on screen is always the thing that was passed;
//   4. with tales never changing, nobody holds a changed one;
//   5. a child starts with a weaker copy of some of what a parent holds.
//
// node projects/world-builder/test/talk.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

const newsHeld = (w, p) => w.inMind(p).filter(m => m.kind === "news");
const words = m => m.text.replace(/^(Heard|Saw): /, "");

// 3 first, watched hour by hour; then 1 and 2 on the same world at day 120.
{
  const w = People.create({ seed: 3 });
  let checked = 0, last = -1;
  for (let h = 0; h < 24 * 120; h++) {
    w.step(1);
    for (const c of w.chatter) {
      if (c.id <= last) continue;
      last = Math.max(last, c.id);
      if (c.kind !== "news" || !/^Did you hear\? /.test(c.la) || /believe|Who told|just talk/.test(c.lb)) continue;
      const hearer = w.byId.get(c.b); if (!hearer) continue;
      const said = c.la.replace(/^Did you hear\? /, "");
      assert.ok(newsHeld(w, hearer).some(m => words(m) === said), "what " + c.an + " said is what " + c.bn + " holds: " + said + " / " + JSON.stringify(w.inMind(hearer).map(m => m.kind + ":" + m.text + ":" + (+m.strength).toFixed(2))) + " age " + hearer.age.toFixed(1) + " t " + c.t + " now " + w.t);
      checked++;
    }
  }
  assert.ok(checked > 50, "news passed and checked: " + checked);

  // The trail on the person panel starts from what they hold.
  for (const p of w.people) for (const m of newsHeld(w, p)) if (m.trace.length && m.trace[0].text !== null)
    assert.equal(m.trace[0].text, words(m), p.name + "'s trail starts from what they hold");

  // 1. The farthest village each event reached.
  let best = null;
  for (const p of w.people) for (const m of newsHeld(w, p)) {
    if (m.trace.length < 3 || !m.trace[m.trace.length - 1].saw) continue;
    const e = w.events.find(e => (e.vars || [e.text]).includes(words(m)));
    if (!e) continue;
    const v = w.villages[p.home], d = Math.hypot(v.x - e.x, v.y - e.y);
    if (!best || d > best.d) best = { d, p, m, e };
  }
  assert.ok(best && best.d > 20, "news reached a village more than 20 km from where it happened: " + (best ? best.d.toFixed(1) : "none"));
  const tr = best.m.trace;
  for (let i = 0; i + 1 < tr.length; i++) assert.equal(tr[i].from, tr[i + 1].name, "each telling was told by the one before it");
  const days = tr[0].day - Math.floor(best.e.t / 24);
  assert.ok(days >= 1, "and it took days: " + days);

  // 2. Each village's most-held telling of each event.
  let differ = 0;
  for (const e of w.events) {
    if (!e.vars) continue;
    const byVil = new Map();
    for (const p of w.people) for (const m of newsHeld(w, p)) {
      const x = words(m); if (!e.vars.includes(x)) continue;
      if (!byVil.has(p.home)) byVil.set(p.home, new Map());
      const c = byVil.get(p.home); c.set(x, (c.get(x) || 0) + 1);
    }
    const tops = new Set();
    for (const c of byVil.values()) { let b = null, n = 0; for (const [x, k] of c) if (k > n) { n = k; b = x; } if (n >= 2) tops.add(b); }
    if (tops.size >= 2) differ++;
  }
  assert.ok(differ >= 1, "two villages believe different things about the same event: " + differ + " events");
}

// 4. Tales that never change.
{
  const w = People.create({ seed: 3, wrong: 0 });
  w.step(24 * 60);
  let held = 0;
  for (const p of w.people) for (const m of newsHeld(w, p)) { held++; assert.ok(!m.wrong, "nobody holds a changed tale: " + m.text); }
  assert.ok(held > 20, "news held: " + held);
}

// 5. Children.
{
  const w = People.create({ seed: 11 });
  const before = new Set(w.people.map(p => p.id));
  w.step(24 * 90);
  const born = w.people.filter(p => !before.has(p.id) && (p.mum || p.dad));
  assert.ok(born.length > 0, "children born");
  let fromParent = 0;
  for (const c of born) {
    const names = [w.byId.get(c.mum)?.name, w.byId.get(c.dad)?.name].filter(Boolean);
    for (const m of w.inMind(c)) if (m.text.includes("told by") || (m.from && names.includes(m.from))) fromParent++;
    for (const [id, x] of w.tiesOf(c)) assert.ok(x > -0.35, "a child takes in a parent's grudge no deeper than a snub: " + x.toFixed(2));
  }
  assert.ok(fromParent > 0, "children hold things their parents told them: " + fromParent);
}

console.log("world-builder talk: news travels by followable tellings, villages can differ, what is said is what is held, never-changing tales stay true, children start with some of their parents' minds");
