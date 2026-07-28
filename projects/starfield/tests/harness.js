/* ══════════════════════════════════════════════════════════════════════
   harness.js — a test runner small enough to have no dependencies.

   Technical Architecture §19 asks for deterministic unit tests, scientific
   regression tests against published reference cases, and scenario tests.
   It does not ask for a test framework, and adding one would mean adding a
   build step to a project whose whole delivery model is static files.

   Runs identically in a browser (tests/index.html) and in Node
   (node tests/run.js).
   ══════════════════════════════════════════════════════════════════════ */

export const suites = [];

export function suite(name, fn) {
  const cases = [];
  fn({
    test: (title, body) => cases.push({ title, body }),
  });
  suites.push({ name, cases });
}

/** Assertions. Each failure explains the number, not just that it differed. */
export const assert = {
  ok(value, message) {
    if (!value) throw new Error(message || "expected a truthy value");
  },

  equal(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || "not equal"}: got ${actual}, expected ${expected}`);
    }
  },

  /** Absolute tolerance, with the units named so a failure is readable. */
  close(actual, expected, tolerance, message = "value", unit = "") {
    const diff = Math.abs(actual - expected);
    if (!(diff <= tolerance)) {
      throw new Error(
        `${message}: got ${actual}${unit}, expected ${expected}${unit} ` +
        `(off by ${diff.toPrecision(4)}${unit}, tolerance ${tolerance}${unit})`
      );
    }
  },

  /** Relative tolerance, for quantities whose magnitude varies. */
  relative(actual, expected, fraction, message = "value") {
    const diff = Math.abs(actual - expected);
    const allowed = Math.abs(expected) * fraction;
    if (!(diff <= allowed)) {
      throw new Error(
        `${message}: got ${actual}, expected ${expected} ` +
        `(off by ${(diff / Math.abs(expected) * 100).toPrecision(3)}%, ` +
        `tolerance ${(fraction * 100).toPrecision(3)}%)`
      );
    }
  },

  vectorClose(actual, expected, tolerance, message = "vector", unit = "m") {
    const d = Math.hypot(actual.x - expected.x, actual.y - expected.y, actual.z - expected.z);
    if (!(d <= tolerance)) {
      throw new Error(
        `${message}: separated by ${d.toPrecision(4)}${unit}, tolerance ${tolerance}${unit}`
      );
    }
  },
};

/** Run everything. Returns {passed, failed, results}. */
export async function run(report = () => {}) {
  let passed = 0, failed = 0;
  const results = [];

  for (const s of suites) {
    report({ type: "suite", name: s.name });
    for (const c of s.cases) {
      try {
        await c.body();
        passed++;
        results.push({ suite: s.name, title: c.title, ok: true });
        report({ type: "pass", name: c.title });
      } catch (err) {
        failed++;
        results.push({ suite: s.name, title: c.title, ok: false, error: err.message });
        report({ type: "fail", name: c.title, error: err.message });
      }
    }
  }
  report({ type: "done", passed, failed });
  return { passed, failed, results };
}
