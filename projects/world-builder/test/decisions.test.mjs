/* A SETTING HAS TO BE SOMETHING YOU CAN FEEL
   ────────────────────────────────────────────────────────────────────────
   `world-builder.test.mjs` checks that every setting changes *something*, but
   all it asserts is that a state hash differs — and a hash differs when a
   setting moves one person one step. Measured 2026-11-13, twelve settings
   passed that check while moving exactly none of an adult's hours, and the
   median setting moved 0.6% of them. The check could not see the thing it was
   named for, which is a trap this project has caught itself in before.

   So this one is about size. It also pins the shape of a day, because the
   reason those settings did nothing was structural: work cost no time, so
   people spent their lives walking and were never short of food.

   Deliberately a small, short world — the point is to catch a regression in
   how people decide, not to re-measure the whole settings list. Use
   `node projects/world-builder/test/behaviour.mjs` for that.

   Run it:  node projects/world-builder/test/decisions.test.mjs  (~30s) */
import assert from "node:assert/strict";
import { probe, spentDifferently, other, People } from "./day.mjs";

const BASE = { people: 140, map: "small", factions: 2, villages: 2, crowd: 60 };
const DAYS = 3, SEEDS = [11, 108];

const base = SEEDS.map(s => probe(BASE, {}, s, DAYS));

/* The same seed and settings make the same day, or nothing below means anything. */
assert.ok(spentDifferently(base[0], probe(BASE, {}, SEEDS[0], DAYS), "act") < 1e-12,
  "the same seed and settings must produce the same day");

/* ── the shape of a day ─────────────────────────────────────────────────── */
const mix = {};
for (const v of base) for (const [k, share] of Object.entries(v.act)) mix[k] = (mix[k] || 0) + share / base.length;
const share = (...names) => names.reduce((sum, n) => sum + (mix[n] || 0), 0);

const asleep = share("Asleep", "Going home to sleep");
const working = share("Harvesting", "Making goods", "Bringing food home", "Patrolling", "Standing guard", "Carrying goods", "Trading");
const walking = share("Walking", "Walking to field", "Walking to workshop", "Going to eat", "Going home",
                      "Going to see somebody", "Going for tools", "Travelling to trade");

assert.ok(asleep > 0.18 && asleep < 0.45, "a night has to be a night: " + (asleep * 100).toFixed(1) + "% of adult hours went on sleep");
assert.ok(working > 0.15, "work has to cost hours: only " + (working * 100).toFixed(1) + "% of adult hours went on it");
assert.ok(walking < 0.30, "walking must not be most of a life: " + (walking * 100).toFixed(1) + "% of adult hours went on it");
assert.ok((mix.Talking || 0) < 0.30, "talking must not crowd out living: " + (((mix.Talking || 0)) * 100).toFixed(1) + "%");

/* ── settings that have to be felt ──────────────────────────────────────────
   Each of these changes something a person weighs every time they decide, so
   each must move a day within three days. The slow ones — elections, war,
   plague, inheritance — are not in this list because three days cannot see
   them, not because they are allowed to do nothing. */
const items = People.SCHEMA.flatMap(g => g.items);
const clean = People.clean(BASE);
const mustBite = { rich: 0.03, uneven: 0.03, hunger: 0.03, talk: 0.03, soldiers: 0.03, people: 0.05, map: 0.03 };

const report = [];
for (const [key, floor] of Object.entries(mustBite)) {
  const it = items.find(i => i.key === key);
  assert.ok(it, "no setting called " + key);
  const value = other(it, clean[key]);
  let moved = 0;
  for (let i = 0; i < SEEDS.length; i++) moved += spentDifferently(base[i], probe(BASE, { [key]: value }, SEEDS[i], DAYS), "act");
  moved /= SEEDS.length;
  report.push(key + " " + (moved * 100).toFixed(1) + "%");
  assert.ok(moved >= floor,
    "changing \"" + it.label + "\" (" + key + " = " + value + ") moved only " + (moved * 100).toFixed(1) +
    "% of an adult's hours, under the " + (floor * 100) + "% this check requires. A setting nobody can feel is a lie on the settings screen.");
}

console.log("Decisions: a day is slept, worked and walked in human proportions; settings that must be felt are — " + report.join(", ") + ".");
