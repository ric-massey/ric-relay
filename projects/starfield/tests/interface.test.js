/* ══════════════════════════════════════════════════════════════════════
   interface.test.js — the parts of the cockpit and the map that are
   arithmetic rather than pixels.

   Most of the interface is a styling problem and belongs in front of a
   human. These are the bits that are not: the preset migration, which
   silently resets somebody's cockpit if it is wrong, and the map's number
   formatting, which is the difference between a plot you can measure and
   a picture of some dots.
   ══════════════════════════════════════════════════════════════════════ */

import { suite, assert } from "./harness.js";
import { PRESETS, migratePreset } from "../src/presentation/ui/canopy.js";
import { SCALES, niceNumber, formatDuration } from "../src/presentation/ui/map.js";

suite("cockpit presets", ({ test }) => {
  test("there are three, and Ric named all of them", () => {
    assert.equal(PRESETS.length, 3, "preset count");
    assert.ok(PRESETS.includes("clean"), "clean exists");
    assert.ok(PRESETS.includes("luxury"), "luxury exists");
    assert.ok(PRESETS.includes("console"), "console exists");
  });

  /* The presets were renamed on 2026-07-26. Anyone who had already chosen
     one has the old name in localStorage, and dropping them back to the
     default would arrive as "my cockpit reset itself" — a bug report about
     something that was only ever a rename. */
  test("the old names still land on the preset they became", () => {
    assert.equal(migratePreset("frame"), "luxury", "frame became luxury");
    assert.equal(migratePreset("cockpit"), "console", "cockpit became console");
    assert.equal(migratePreset("clean"), "clean", "clean was never renamed");
  });

  test("anything unrecognised falls back rather than throwing", () => {
    assert.equal(migratePreset(undefined), "luxury", "nothing stored");
    assert.equal(migratePreset("nonsense"), "luxury", "a name we never used");
  });
});

suite("the star map — scales", ({ test }) => {
  test("every scale's default sits inside its own zoom limits", () => {
    for (const s of SCALES) {
      assert.ok(s.min < s.span && s.span < s.max,
        `${s.id}: span ${s.span} must lie between ${s.min} and ${s.max}`);
    }
  });

  /* The Moon is the only other world in the slice, and the system scale
     exists to show it. Span is measured across the plot's shorter
     dimension, so the Moon has to sit inside half of it with room to
     spare — otherwise the default view of the system loses the system. */
  test("the system scale shows the Moon without zooming", () => {
    const system = SCALES.find((s) => s.id === "system");
    const moonDistance = 3.844e8;
    assert.ok(moonDistance < system.span * 0.45,
      `the Moon at ${moonDistance} m must fall well inside a ${system.span} m span`);
  });

  test("the interstellar scale reaches past the nearest star", () => {
    const interstellar = SCALES.find((s) => s.id === "interstellar");
    assert.ok(interstellar.span * 0.5 > 4.25,
      "Proxima Centauri at 4.24 ly must be on the plot by default");
  });
});

suite("the star map — reading distances off it", ({ test }) => {
  /* Range rings and the scale bar are the only reason the plot is a
     measurement rather than a diagram, and a ring labelled "137 km" is
     worth nothing. Every value has to be a 1, 2 or 5 with zeroes after it. */
  test("ring and scale-bar values are always 1, 2 or 5 × a power of ten", () => {
    for (const target of [1, 3, 7, 13, 47, 137, 999, 4.2e5, 2.14e8, 8.6e15]) {
      const n = niceNumber(target);
      const mantissa = n / 10 ** Math.floor(Math.log10(n));
      assert.close(
        Math.min(Math.abs(mantissa - 1), Math.abs(mantissa - 2), Math.abs(mantissa - 5)),
        0, 1e-9, `niceNumber(${target}) = ${n}, mantissa`);
    }
  });

  test("it stays within a factor of the number it was asked for", () => {
    for (const target of [3, 47, 137, 2.14e8]) {
      const n = niceNumber(target);
      assert.ok(n <= target && n > target / 2.5,
        `niceNumber(${target}) = ${n} should be close below it`);
    }
  });
});

suite("the star map — how long it takes", ({ test }) => {
  /* An ETA is the map's main output: §13 wants route preview, hazards and
     arrival conditions, and the number a player actually reads is this
     one. It must never be scientific notation and never a bare second
     count over an hour. */
  test("each duration is said the way a person would say it", () => {
    assert.equal(formatDuration(45), "45 s", "under a minute");
    assert.equal(formatDuration(600), "10 min", "ten minutes");
    assert.equal(formatDuration(7200), "2.0 h", "two hours — Earth to the Moon");
    assert.equal(formatDuration(259200), "3.0 days", "three days");
  });

  /* A route to somewhere unreachable has an infinite time, and the map has
     to print something rather than "Infinity h". */
  test("an impossible route reads as unknown, not as a number", () => {
    assert.equal(formatDuration(Infinity), "—", "infinite");
    assert.equal(formatDuration(NaN), "—", "not a number");
  });
});
