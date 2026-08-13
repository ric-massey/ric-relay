/* Just the corridor's junction list, without dragging Road and World in.

   `data/i40.js` is a plain top-level `const`, which in a vm script is
   lexical and never lands on the context object — so it is handed out
   explicitly, the same trick `harness.js` uses. This exists separately
   because the traffic tests want the exits and nothing else, and parsing
   900 KB of surveyed geometry to find out where the on-ramps are is not
   a thing to do twice. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "data/i40.js"), "utf8")
          + "\n;globalThis.__I40 = I40;\n";
const ctx = vm.createContext({ console, Math, JSON });
vm.runInContext(src, ctx, { filename: "i40" });

module.exports = ctx.__I40;
