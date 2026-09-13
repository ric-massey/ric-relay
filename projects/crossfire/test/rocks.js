#!/usr/bin/env node
"use strict";

/* CROSSFIRE — WHICH ROCKS MIGHT BE TOUCHING
   ─────────────────────────────────────────────────────────────────────────────
   Finding collision pairs used to be every rock against every other rock. That
   is n(n-1)/2 comparisons — fine for the few dozen a Battle Royale arena holds,
   and quadratic in a Survey field that keeps growing, where almost every pair
   is two rocks nowhere near each other.

   The rocks go into a grid now and only near neighbours are offered up. This
   file is the proof that it changed *which pairs are considered* and nothing
   else: the same deterministic set through the old all-pairs finder and the new
   one must yield the same touching pairs, each exactly once.

   It asserts counts, never milliseconds. Wall-clock on a shared machine is
   noise, and the number this change is actually about is how many pairs were
   looked at. */

const assert = require("node:assert/strict");

let fails = 0;
function check(ok, why) {
  if (ok) return true;
  console.error("  FAIL  " + why);
  fails++;
  return false;
}

/* The finder under test, lifted out of the game rather than transcribed. A copy
   would pass this file forever while the shipped one drifted away from it, and
   the whole value here is that the thing running in the game is the thing being
   checked. It is a pure function of a list, so it needs nothing else to run. */
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(
  path.join(__dirname, "..", "index.html"), "utf8");

function lift(name) {
  const at = src.indexOf("function " + name + "(");
  assert.ok(at > 0, "index.html has no " + name);
  let depth = 0, i = src.indexOf("{", at);
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return src.slice(at, i + 1);
}

let rockCandidates = 0;
// eslint-disable-next-line no-eval
const forEachRockPair = eval(
  "(function () { " + lift("forEachRockPair") +
  " return forEachRockPair; })()"
);

function hashedPairs(list) {
  const out = [];
  rockCandidates = 0;
  forEachRockPair(list, (i, j) => out.push([i, j]));
  out.considered = rockCandidates;
  return out;
}

function allPairs(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) out.push([i, j]);
  }
  out.considered = out.length;
  return out;
}

const touching = (list, pairs) => {
  const hit = [];
  for (const [i, j] of pairs) {
    const a = list[i], b = list[j];
    const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
    if (dx * dx + dy * dy < min * min) hit.push(i + ":" + j);
  }
  return hit;
};

/* A field, deterministically. Mixed radii, because the cell is sized off the
   largest one and a field of uniform rocks would never test that. */
function field(n, spread, seed) {
  let s = seed >>> 0;
  const rnd = () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: i, r: 8 + rnd() * 46,
               x: (rnd() - 0.5) * spread, y: (rnd() - 0.5) * spread });
  }
  return out;
}

console.log("CROSSFIRE rock pair checks");

// ── the two finders agree, on fields from sparse to jammed ────────────────
{
  const cases = [
    ["sparse",  200,  9000],
    ["normal",  400,  4000],
    ["dense",   400,  1200],
    ["jammed",  300,   400],
    ["one pile", 120,    80]
  ];
  for (const [name, n, spread] of cases) {
    const list = field(n, spread, 0xC0FFEE + n + spread);
    const naive = touching(list, allPairs(list)).sort();
    const hashed = touching(list, hashedPairs(list)).sort();
    check(naive.length === hashed.length && naive.every((v, i) => v === hashed[i]),
          name + ": the grid found " + hashed.length +
          " touching pairs and all-pairs found " + naive.length);
  }
  console.log("  agree      five fields, sparse to one pile · every touching " +
              "pair the all-pairs finder sees, the grid sees too");
}

// ── and never offers the same pair twice ──────────────────────────────────
{
  const list = field(500, 1500, 0x5EED);
  const pairs = hashedPairs(list);
  const seen = new Set();
  let dupes = 0;
  for (const [i, j] of pairs) {
    const k = i + ":" + j;
    if (seen.has(k)) dupes++;
    seen.add(k);
    check(i < j, "a pair came back out of order: " + k);
  }
  check(dupes === 0, dupes + " pairs were offered more than once");
  console.log("  once       " + pairs.length.toLocaleString("en-US") +
              " candidate pairs, no duplicates, none of a rock with itself");
}

/* ── a rock never misses a neighbour across a cell line ───────────────────
   The cell is two of the largest radius, which is what makes the grid exact
   rather than approximate. Two big rocks placed deliberately either side of a
   boundary are the case that would break it. */
{
  const big = 50;
  const cell = big * 2;
  const list = [];
  for (let k = 0; k < 40; k++) {
    const line = k * cell;                    // exactly on a boundary
    list.push({ id: k * 2,     r: big, x: line - 1, y: 17 });
    list.push({ id: k * 2 + 1, r: big, x: line + 1, y: 17 });
  }
  const naive = touching(list, allPairs(list)).sort();
  const hashed = touching(list, hashedPairs(list)).sort();
  check(naive.length > 0, "the boundary fixture has no touching pairs to find");
  check(naive.length === hashed.length && naive.every((v, i) => v === hashed[i]),
        "a pair straddling a cell line was missed: " + naive.length +
        " real, " + hashed.length + " found");
  console.log("  boundary   " + naive.length + " pairs straddling cell lines, " +
              "all of them found · the cell is two of the largest radius");
}

// ── and it looks at far fewer of them ─────────────────────────────────────
{
  console.log("  candidates");
  for (const [name, n, spread] of [["400 spread out", 400, 6000],
                                   ["800 spread out", 800, 9000],
                                   ["1600 spread out", 1600, 14000]]) {
    const list = field(n, spread, 0xBEEF + n);
    const all = allPairs(list).considered;
    const few = hashedPairs(list).considered;
    check(few < all / 4,
          name + ": the grid still considered " + few + " of " + all + " pairs");
    console.log("    " + name.padEnd(16) + all.toLocaleString("en-US").padStart(9) +
                " all-pairs → " + few.toLocaleString("en-US").padStart(7) +
                "  (" + Math.round((1 - few / all) * 100) + "% fewer)");
  }
}

if (fails) {
  console.error("\nCROSSFIRE rock pair checks FAILED (" + fails + ")");
  process.exit(1);
}
console.log("CROSSFIRE rock pair checks passed");
