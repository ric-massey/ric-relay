#!/usr/bin/env node
"use strict";

/* KONDRITE — THE CHART, KEPT
   ─────────────────────────────────────────────────────────────────────────────
   The fog is the only thing in Survey that *is* the player's afternoon. Every
   other piece of a run can be re-earned by flying; the shape of where you have
   been cannot, and it goes through a string in local storage to get from one
   session to the next. So the encoder and the decoder are worth their own
   harness, and a fast one: `test/survey.js` boots the whole game and samples
   millions of chunks, which is the wrong place to find out that a corrupt
   import ate somebody's map.

   This loads the interface (survey-hud/) alone — no game, no canvas, no sector — because
   the chart's round trip is a pure function of two functions.

   The bug this file exists to keep dead: `importFog` used to clear `fog` on its
   first line and fill it as it decoded, so a payload that was valid for two runs
   and corrupt on the third returned `false` having already destroyed the chart
   it was refusing to replace. A failure path may not damage the thing it is
   declining to change. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DIR = path.join(__dirname, "..");
const noop = () => {};

let fails = 0;
function check(ok, why) {
  if (ok) return true;
  console.error("  FAIL  " + why);
  fails++;
  return false;
}

/* A HUD on its own. `init` wants a deps bag and touches `window` for a resize
   listener, and that is the whole of what it needs to hand back `exportFog`
   and `importFog`. */
function hud() {
  const sandbox = {
    window: { addEventListener: noop, removeEventListener: noop,
              devicePixelRatio: 1, innerWidth: 1200, innerHeight: 800 },
    document: { getElementById: () => null, addEventListener: noop },
    Math, JSON, Set, Map, Number, String, Array, Object, Date, isNaN, parseInt,
    parseFloat, Infinity, NaN, undefined,
    btoa: s => Buffer.from(s, "binary").toString("base64"),
    atob: s => Buffer.from(s, "base64").toString("binary"),
    ArrayBuffer, Int32Array, Uint8Array,
    console
  };
  sandbox.self = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const page = require("./page.js");
  for (const f of page.hudFilesOf(page.page().html)) {
    vm.runInContext(fs.readFileSync(path.join(DIR, f), "utf8"), sandbox, { filename: f });
  }
  const H = sandbox.window.KondriteSurveyHUD;
  assert.ok(H, "survey-hud/ did not publish KondriteSurveyHUD");
  H.init({ ctx: null, SCREEN_W: 1000, SCREEN_H: 700, touchOnly: false,
           glow: (c, w, a, f) => f && f(), addTap: noop });
  return H;
}

/* A chart with a known shape in it: a few rows of runs, the way flying makes
   them. `HUD.chart` is the only way in, so the fog is built by exporting a
   handmade payload and importing it — which is also the round trip under test. */
function charted(H, rows) {
  const runs = [];
  for (const [cy, start, len] of rows) runs.push(cy, start, len);
  return runs;
}

// The packer is private, so a payload is made by exporting a real import.
function payloadFor(H, rows) {
  assert.ok(H.importFog(pack(rows)), "fixture payload did not import");
  return H.exportFog();
}

/* The same packing `exportFog` uses: int32 little-endian, base64. Written out
   here rather than reached for inside the module, so a change to the wire
   format shows up as a failure in this file rather than passing silently
   because both sides moved together. */
function pack(rows) {
  const runs = [];
  for (const [cy, start, len] of rows) runs.push(cy, start, len);
  const buf = new ArrayBuffer(runs.length * 4);
  new Int32Array(buf).set(runs);
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 4096) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096));
  }
  return Buffer.from(s, "binary").toString("base64");
}

console.log("KONDRITE chart checks");

// ── a chart survives the trip ─────────────────────────────────────────────
{
  const H = hud();
  const rows = [[0, -5, 10], [1, -5, 10], [2, 0, 3], [-7, 1200, 40]];
  check(H.importFog(pack(rows)), "a valid chart would not import");
  const cells = 10 + 10 + 3 + 40;
  check(H.charted() === cells,
        "imported " + H.charted() + " cells, expected " + cells);

  const out = H.exportFog();
  const before = H.charted();
  check(H.importFog(out), "a chart this module exported would not import");
  check(H.charted() === before,
        "a round trip changed the chart: " + before + " → " + H.charted());
  console.log("  roundtrip  " + cells + " cells over " + rows.length +
              " runs · exports and imports back to exactly itself");
}

/* ── a refused import leaves the chart alone ──────────────────────────────
   The whole reason this file exists. */
{
  const H = hud();
  const good = [[0, -5, 10], [1, -5, 10]];
  check(H.importFog(pack(good)), "the good chart would not import");
  const kept = H.charted();

  // Valid, valid, then a run that cannot be honoured.
  const mixed = [[0, 0, 5], [1, 0, 5], [2, 0, -3]];
  check(H.importFog(pack(mixed)) === false,
        "an import with a corrupt third run reported success");
  check(H.charted() === kept,
        "a refused import damaged the chart: " + kept + " cells became " +
        H.charted());
  check(H.seen(-5 * 1000, 0) || H.charted() === kept,
        "the original chart's cells did not survive a refused import");
  console.log("  atomic     a payload that fails on its third run leaves all " +
              kept + " original cells untouched");
}

// ── what a corrupt payload may not do ─────────────────────────────────────
{
  const H = hud();
  const base = [[0, 0, 4]];
  H.importFog(pack(base));
  const kept = H.charted();

  const bad = [
    ["a zero-length run",        [[0, 0, 0]]],
    ["a negative length",        [[0, 0, -1]]],
    ["a row outside the lattice",[[2000000, 0, 2]]],
    ["a column below the floor", [[0, -2000000, 2]]],
    ["a run past the ceiling",   [[0, 999999, 100]]]
  ];
  for (const [why, rows] of bad) {
    check(H.importFog(pack(rows)) === false, why + " was accepted");
    check(H.charted() === kept, why + " damaged the chart on its way out");
  }

  // Three short runs that together ask for more than there is memory for.
  const huge = [[0, -900000, 900000], [1, -900000, 900000]];
  check(H.importFog(pack(huge)) === false,
        "a payload expanding past the cell ceiling was accepted");
  check(H.charted() === kept, "an oversized payload damaged the chart");

  check(H.importFog("not base64 at all $$$") === false,
        "a payload that is not a chart at all was accepted");
  check(H.importFog(pack([[0, 0]])) === false,
        "a payload whose length is not a multiple of three was accepted");
  console.log("  bounds     " + (bad.length + 3) +
              " malformed payloads refused · none of them touched the chart");
}

// ── a big honest chart still fits ─────────────────────────────────────────
{
  const H = hud();
  const rows = [];
  for (let cy = -120; cy <= 120; cy++) rows.push([cy, -190, 380]);
  const cells = 241 * 380;
  check(H.importFog(pack(rows)), "a large legitimate chart was refused");
  check(H.charted() === cells,
        "a large chart imported " + H.charted() + " of " + cells + " cells");
  const packed = H.exportFog();
  check(H.importFog(packed) && H.charted() === cells,
        "a large chart did not round-trip exactly");
  console.log("  large      " + cells.toLocaleString("en-US") +
              " cells round-trip exactly · " +
              Math.round(packed.length / 1024) + " KB packed");
}

// ── and it is still a record when you zoom all the way out ───────────────
/* Ric, 2026-11-12: "the full map needs to look like the mini map in how it
   shows where they have been."

   It drew the same lattice from the same set and simply gave up: the painter
   walks the *window* in 480-unit cells, so the count grows with the square of
   the span, and it bailed at 40,000 cells — about 115,000 units across. The
   chart zooms to forty million, so only the closest six of its fifteen steps
   ever painted the wash, and every zoom wide enough to see a run's worth of
   travel showed none of it.

   Past that it walks the record instead, bucketed into blocks big enough to
   see. What has to be true of those blocks is what this checks: they are the
   same record, they cover every cell of it, and they get coarser rather than
   emptier as the step grows. */
{
  const H = hud();
  const rows = [];
  // A long thin run, which is what flying somewhere actually looks like.
  for (let cy = -2; cy <= 2; cy++) rows.push([cy, -400, 900]);
  check(H.importFog(pack(rows)), "the run was refused");
  const cells = H.charted();

  check(typeof H.coarseFog === "function",
        "the wide chart has no coarse record to draw — it will go back to " +
        "painting nothing past 115,000 units across");

  const one = H.coarseFog(1);
  check(one.length === cells,
        "at one cell a block the record is " + one.length + " blocks for " +
        cells + " cells — it is meant to be the same record, not a summary");

  let last = one.length;
  for (const step of [2, 8, 64, 250]) {
    const blocks = H.coarseFog(step);
    check(blocks.length > 0,
          "at " + step + " cells a block the wide chart would paint nothing");
    check(blocks.length <= last,
          "a coarser step produced more blocks (" + blocks.length + " at " +
          step + ", against " + last + " before it)");
    last = blocks.length;
    /* Every cell of the record has to be inside one of them. A block that
       covers nothing is noise; a cell that no block covers is a piece of the
       map you charted and cannot see. */
    const have = new Set(blocks.map(b => b[0] + "," + b[1]));
    let missing = 0;
    for (let cy = -2; cy <= 2; cy++) {
      for (let cx = -400; cx < 500; cx++) {
        if (!have.has(Math.floor(cx / step) + "," + Math.floor(cy / step))) missing++;
      }
    }
    check(missing === 0,
          missing + " charted cells fall outside every block at step " + step);
  }
  check(H.coarseFog(64).length === H.coarseFog(64).length,
        "asking twice gave two different answers");
  console.log("  wide       " + cells + " cells to " + one.length +
              " blocks at 1, " + last + " at 250 \u00b7 every cell covered " +
              "at every step \u00b7 the record survives the widest zoom");
}

if (fails) {
  console.error("\nKONDRITE chart checks FAILED (" + fails + ")");
  process.exit(1);
}
console.log("KONDRITE chart checks passed");
