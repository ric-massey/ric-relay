// journal.mjs -- what happened in a World while nobody was looking. Not part of
// the engine: it owns no physics, changes none, and nothing in world.mjs
// imports it.
//
// Ric, 2026-11-09: "i wanted to start a world and let it run and check in on it
// every once in a while with the chance of something crazy happening". A world
// that runs for days is ten million ticks nobody watched, and a picture of
// where it ended up says nothing about how it got there. So this reads the
// world every so often and writes down the FIRSTS and the RECORDS: the largest
// structure there has ever been, the first closed loop, the structure that has
// stood longest, the one that travelled furthest in one piece, a composition
// that has become common, a sudden loss of bonds, the sheet freezing or
// thawing.
//
// READ THIS BEFORE BELIEVING AN ENTRY (rule 11). An entry is what an
// instrument saw in one run. It is not a finding. A record is a record of THIS
// world; the first loop is the first one this file noticed at the interval it
// was looking at; and "the same structure" below means "a structure made of
// exactly the same kinds", which is an identity this file invents for its own
// bookkeeping and the world does not have. Before telling anyone something
// interesting happened, go and look at the hexagons, change the seed, and run
// the checks rule 11 lists. The entry tells you where and when to look.
//
// Rules this file stands under:
//
//   rule 2   nothing is written to the world. Every structure, identity, age
//            and distance here lives in this object and is thrown away with it.
//   rule 3   no borrowed names. A bonded group is a "structure"; what it is
//            made of is its "composition", by valence, the way census.mjs
//            names one.
//   rule 9   instruments are not bound by locality. This walks the whole sheet.
//
// The walk is the same connected-component walk clusters.mjs does for the Lab,
// written again here because that one is bound to the Lab's fixed torus (it
// imports lab.mjs's CELLS and its wrapping neighbour). A second walk is a
// second thing that can disagree with the engine, so every observation
// cross-checks its bond count against the engine's own census and throws if
// they differ -- the same guard census.mjs and collide.mjs use.

import { census, neighbour, bindingEnergy, qOf, rOf } from "./world.mjs";
import { SETTLED, DIRECTIONS } from "./constants.mjs";

const M = SETTLED.BOND_MODULUS;

// How much bigger a record has to be than the last one before it is written
// down again. These are a journal's manners, not physics (rule 8): without
// them a growing structure would file an entry at every look.
const GROW = 1.25;          // a size or count record: a quarter bigger
const AGE_STEP = 2;         // an age record: twice as old
const FAR_STEP = 1.5;       // a distance record: half as far again
const MIN_TRACKED = 4;      // structures smaller than this are not followed
const MIN_AGE = 5000;       // ticks a structure must stand before its age is news
const MIN_FAR = 8;          // hexagons it must travel before its travel is news
const SHOCK = 0.15;         // a change in the bond count worth an entry, per look
const KEEP = 400;           // entries held in memory (the file on disk has them all)

// Every bonded group of two or more, with what the journal needs from each.
export function structures(w) {
  const mark = new Int32Array(w.cells).fill(-1);
  const stack = new Int32Array(w.cells);
  const out = [];
  let bondsSeen = 0;
  for (let s = 0; s < w.cells; s++) {
    if (w.kind[s] === 0 || mark[s] !== -1 || w.bonds[s] === 0) continue;
    let top = 0, bonds = 0, bSum = 0, sq = 0, sr = 0;
    const members = [];
    stack[top++] = s; mark[s] = out.length;
    while (top > 0) {
      const i = stack[--top];
      members.push(i); sq += qOf(w, i); sr += rOf(w, i);
      for (let d = 0; d < DIRECTIONS; d++) {
        if (!(w.bonds[i] & (1 << d))) continue;
        const j = neighbour(w, i, d);
        if (j < 0 || w.kind[j] === 0) continue;
        if (j > i) { bonds++; bSum += bindingEnergy(w.kind[i], w.kind[j]); }
        if (mark[j] === -1) { mark[j] = out.length; stack[top++] = j; }
      }
    }
    bondsSeen += bonds;
    const size = members.length;
    out.push({
      members, size, bonds,
      // independent closed loops: a tree of n has n - 1 bonds, and every bond
      // past that closes one
      loops: bonds - size + 1,
      meanB: bonds ? bSum / bonds : 0,
      q: sq / size, r: sr / size,
    });
  }
  return { list: out, bondsSeen };
}

// The two names a structure gets. `id` is exact -- the kinds in it, sorted --
// and is how the journal follows one structure from one look to the next.
// `composition` is by valence, as census.mjs names a species, and is how it
// counts how many of a sort are standing.
const idOf = (w, s) => Array.from(s.members, (i) => w.kind[i]).sort((a, b) => a - b).join(".");
const compositionOf = (w, s) => Array.from(s.members, (i) => w.kind[i] % M).sort((a, b) => a - b).join("-");

export class Journal {
  constructor() {
    this.entries = [];
    this.looks = 0;
    this.best = { size: 0, loops: 0, age: MIN_AGE / AGE_STEP, far: MIN_FAR / FAR_STEP,
                  sorts: 0, common: 0 };
    this.tracked = {};        // id -> { since, q0, r0, q, r, path }
    this.last = null;         // the previous look's totals
    this.state_ = { half: null, frozen: false };
  }

  // Everything this object knows, as plain data, so a checkpoint can carry it
  // and a resumed world does not announce every record a second time.
  save() {
    return { looks: this.looks, best: this.best, tracked: this.tracked, last: this.last,
             state_: this.state_, entries: this.entries.slice(-KEEP) };
  }
  static load(data) {
    const j = new Journal();
    if (data) Object.assign(j, data);
    return j;
  }

  note(tick, type, text, extra = {}) {
    const e = { tick, at: new Date().toISOString(), type, text, ...extra };
    this.entries.push(e);
    if (this.entries.length > KEEP) this.entries.splice(0, this.entries.length - KEEP);
    return e;
  }

  // One look at the world. Returns the entries this look produced.
  observe(world) {
    const w = world.w, tick = world.tick, c = census(w);
    const { list, bondsSeen } = structures(w);
    if (bondsSeen !== c.bonds) {
      throw new Error(`journal: the walk counted ${bondsSeen} bonds and the engine's census `
        + `${c.bonds} at tick ${tick}. One of them is wrong, and nothing is written until they agree.`);
    }
    const fresh = [];
    const say = (type, text, extra) => fresh.push(this.note(tick, type, text, extra));
    const where = (s) => ({ q: Math.round(s.q), r: Math.round(s.r) });
    const n = (x) => Math.round(x).toLocaleString("en-US");
    this.looks++;

    let matterCells = 0;
    for (let i = 0; i < w.cells; i++) if (w.kind[i] !== 0) matterCells++;
    const bondedFraction = matterCells ? c.bonded / matterCells : 0;
    const meanTemp = c.matter ? c.heat / c.matter : 0;

    // ---- the largest structure there has ever been
    let biggest = null, loopiest = null;
    for (const s of list) {
      if (!biggest || s.size > biggest.size) biggest = s;
      if (s.loops > 0 && (!loopiest || s.loops > loopiest.loops)) loopiest = s;
    }
    if (biggest && biggest.size >= 3 && biggest.size >= Math.ceil(this.best.size * GROW)) {
      const share = biggest.size / matterCells;
      say("largest", `The largest structure yet: ${n(biggest.size)} hexagons bonded together`
        + (share > 0.5 ? `, which is ${(share * 100).toFixed(0)}% of all the matter there is.`
                       : `, holding ${n(biggest.bonds)} bonds.`),
        { ...where(biggest), size: biggest.size, bonds: biggest.bonds });
      this.best.size = biggest.size;
    }

    // ---- closed loops
    if (loopiest && this.best.loops === 0) {
      say("loop", `The first closed loop: a structure of ${n(loopiest.size)} whose bonds come back `
        + `round on themselves.`, { ...where(loopiest), size: loopiest.size, loops: loopiest.loops });
      this.best.loops = loopiest.loops;
    } else if (loopiest && loopiest.loops >= Math.ceil(this.best.loops * GROW) && loopiest.loops > this.best.loops) {
      say("loop", `A structure of ${n(loopiest.size)} now closes ${n(loopiest.loops)} separate loops, `
        + `the most any has.`, { ...where(loopiest), size: loopiest.size, loops: loopiest.loops });
      this.best.loops = loopiest.loops;
    }

    // ---- how many sorts are standing, and which is commonest
    const counts = new Map();
    for (const s of list) {
      if (s.size < MIN_TRACKED || s.size > 24) continue;
      const k = compositionOf(w, s);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    if (counts.size >= 8 && counts.size >= Math.ceil(this.best.sorts * GROW)) {
      say("sorts", `${n(counts.size)} different compositions of four or more are standing at once, `
        + `the most so far.`, { sorts: counts.size });
      this.best.sorts = counts.size;
    }
    let commonKey = null, commonN = 0;
    for (const [k, v] of counts) if (v > commonN) { commonN = v; commonKey = k; }
    if (commonN >= 3 && commonN >= Math.ceil(this.best.common * GROW)) {
      say("common", `${n(commonN)} separate structures share one composition (valences ${commonKey}). `
        + `No sort of that size has been this common.`, { composition: commonKey, count: commonN });
      this.best.common = commonN;
    }

    // ---- following structures from look to look: how long, how far
    const seen = {};
    for (const s of list) {
      if (s.size < MIN_TRACKED || s.size > 200) continue;
      const id = idOf(w, s);
      if (seen[id]) continue;                       // two alike: follow neither twice
      const was = this.tracked[id];
      const t = was
        ? { ...was, path: was.path + Math.hypot(s.q - was.q, s.r - was.r), q: s.q, r: s.r }
        : { since: tick, q0: s.q, r0: s.r, q: s.q, r: s.r, path: 0, size: s.size };
      seen[id] = t;
      const age = tick - t.since;
      if (age >= this.best.age * AGE_STEP) {
        say("oldest", `A structure of ${n(s.size)} has stood unbroken for ${n(age)} ticks, `
          + `longer than anything before it.`, { ...where(s), size: s.size, age });
        this.best.age = age;
      }
      // straight-line distance from where it was first seen, on the axial sheet
      const dq = s.q - t.q0, dr = s.r - t.r0;
      const far = Math.sqrt(dq * dq + dr * dr + dq * dr);
      if (far >= this.best.far * FAR_STEP) {
        say("traveller", `A structure of ${n(s.size)} has moved ${far.toFixed(0)} hexagons from where `
          + `it formed without coming apart, further than any before it.`,
          { ...where(s), size: s.size, far: Math.round(far), from: { q: Math.round(t.q0), r: Math.round(t.r0) } });
        this.best.far = far;
      }
    }
    this.tracked = seen;                            // what was not seen is no longer followed

    // ---- the sheet as a whole: sudden changes and changes of state
    const now = { tick, bonds: c.bonds, bondedFraction, meanTemp,
                  stepped: world.counts.stepped, formed: world.counts.bondsFormed,
                  broken: world.counts.bondsBroken };
    // A look at the same tick as the last one (the first look after a world is
    // picked up) has no interval to compare across, and "nothing moved in 0
    // ticks" is not news.
    const prev = this.last && this.last.tick < tick ? this.last : null;
    if (prev && prev.bonds >= 50) {
      const change = (now.bonds - prev.bonds) / prev.bonds;
      if (change <= -SHOCK) {
        say("collapse", `${(-change * 100).toFixed(0)}% of all bonds broke in ${n(tick - prev.tick)} ticks `
          + `(${n(prev.bonds)} down to ${n(now.bonds)}).`, { from: prev.bonds, to: now.bonds });
      } else if (change >= SHOCK && this.looks > 3) {
        say("bloom", `The number of bonds rose ${(change * 100).toFixed(0)}% in ${n(tick - prev.tick)} ticks `
          + `(${n(prev.bonds)} up to ${n(now.bonds)}).`, { from: prev.bonds, to: now.bonds });
      }
    }
    // more than half bonded, or not -- with a margin, so it does not flicker
    const half = bondedFraction > 0.55 ? true : bondedFraction < 0.45 ? false : this.state_.half;
    if (this.state_.half !== null && half !== this.state_.half) {
      say("state", half
        ? `More than half of all matter is bonded now (${(bondedFraction * 100).toFixed(0)}%). Mean temperature ${meanTemp.toFixed(2)}.`
        : `Less than half of all matter is bonded now (${(bondedFraction * 100).toFixed(0)}%). Mean temperature ${meanTemp.toFixed(2)}.`,
        { bondedFraction, meanTemp });
    }
    this.state_.half = half;
    if (prev) {
      const quiet = now.stepped === prev.stepped && now.formed === prev.formed && now.broken === prev.broken;
      if (quiet && !this.state_.frozen) {
        say("frozen", `Nothing moved and no bond formed or broke in ${n(tick - prev.tick)} ticks. `
          + `The sheet has stopped.`, { bondedFraction, meanTemp });
      } else if (!quiet && this.state_.frozen) {
        say("thaw", `The sheet is moving again.`, { bondedFraction, meanTemp });
      }
      this.state_.frozen = quiet;
    }
    this.last = now;

    return {
      fresh,
      // the totals this look read, for a caller that wants to show them
      now: { ...now, structures: list.length, largest: biggest ? biggest.size : 0,
             loops: loopiest ? loopiest.loops : 0, sorts: counts.size, followed: Object.keys(seen).length },
    };
  }
}
