/* Node runner:  node projects/starfield/tests/run.mjs
   The same suites also run in a browser at tests/index.html. */

import { run } from "./harness.js";
import "./scientific.test.js";
import "./frames.test.js";
import "./flight.test.js";
import "./shadow.test.js";
import "./navigation.test.js";
import "./modes.test.js";
import "./interface.test.js";

const C = { pass: "\x1b[32m", fail: "\x1b[31m", dim: "\x1b[90m", off: "\x1b[0m" };

const { failed } = await run((e) => {
  if (e.type === "suite") console.log(`\n${C.dim}${e.name}${C.off}`);
  if (e.type === "pass") console.log(`  ${C.pass}✓${C.off} ${e.name}`);
  if (e.type === "fail") console.log(`  ${C.fail}✗ ${e.name}\n      ${e.error}${C.off}`);
  if (e.type === "done") {
    console.log(`\n${e.failed ? C.fail : C.pass}${e.passed} passed, ${e.failed} failed${C.off}`);
  }
});

process.exit(failed ? 1 : 0);
