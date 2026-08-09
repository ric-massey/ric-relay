/* Load data/road/world into a bare Node context, no DOM.

   The sources are plain top-level `const` declarations, which in a vm
   script are lexical and never land on the context object — so the
   files are concatenated and the names handed out explicitly at the
   end, in the same order index.html loads them. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..");
const files = ["data/i40.js", "src/road.js", "src/world.js"];
const src = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n;\n")
  + "\n;globalThis.__exports = { I40, Road, World };\n";

const ctx = vm.createContext({ console, Math, JSON });
vm.runInContext(src, ctx, { filename: "offramp-sources" });
module.exports = ctx.__exports;
