/* ══════════════════════════════════════════════════════════════════════
   The ledger that survives a run.

   `node test/progress.test.js` from projects/offramp.

   progress.js reaches for two things a Node process does not have — a
   `localStorage` and the `Garage` global — so both are shimmed below.
   The localStorage shim is a real one rather than a stub: it holds
   strings and it is inspected, because half of what this file is for is
   checking that a save round-trips and that a damaged one is refused.
   ══════════════════════════════════════════════════════════════════════ */

/* ── the shims, before the module under test ──────────────────────────── */
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
global.Garage = require("../data/garage.js");
const Progress = require("../src/progress.js");

let pass = 0, fail = 0;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const fmt = (n) => typeof n === "number"
  ? (Number.isInteger(n) ? String(n) : n.toFixed(3)) : String(n);
function ok(name, got, want, tol) {
  const good = tol === undefined ? got === want : near(got, want, tol);
  if (good) { pass++; console.log(`  ok   ${name}  = ${fmt(got)}`); }
  else { fail++; console.log(`  FAIL ${name}  = ${fmt(got)}   want ${fmt(want)}${tol !== undefined ? ` ±${tol}` : ""}`); }
}
const head = (s) => console.log(`\n${s}\n${"─".repeat(s.length)}`);
const run = (banked, extra) => Progress.endRun({ banked, km: 30, exits: 10, ...(extra || {}) });

/* ══════════════════════════════════════════════════════════════════════
   §1  a fresh player
   ══════════════════════════════════════════════════════════════════════ */
head("§1  starting from nothing");

Progress.forget();
ok("nothing banked", Progress.total, 0);
ok("exactly one vehicle available", Progress.unlocked().length, 1);
ok("...and it is the Jetta", Progress.unlocked()[0].id, "jetta");
ok("the chosen car is the Jetta", Progress.chosen(), "jetta");
ok("the next rung is the Civic", Progress.next().car.id, "civic");
ok("...and it needs its full cost", Progress.next().need, Garage.get("civic").cost);
ok("a locked car cannot be selected", Progress.select("911"), "jetta");
ok("...and selecting it did not unlock it", Progress.isUnlocked("911"), false);

/* ══════════════════════════════════════════════════════════════════════
   §2  the ladder opens in order
   ══════════════════════════════════════════════════════════════════════ */
head("§2  climbing it");

Progress.forget();
const opened = run(6000);
ok("banking the Civic's cost opens the Civic", opened.opened.map((c) => c.id).join(","), "civic");
ok("two vehicles now", Progress.unlocked().length, 2);
ok("the next rung moved on", Progress.next().car.id, "f150");

const jump = run(400000 - 6000);
ok("a huge run can open several at once", jump.opened.length, 8);
ok("...and that is the whole garage", Progress.unlocked().length, 10);
ok("nothing is left to unlock", Progress.next(), null);
ok("the bike is available last and is available now", Progress.isUnlocked("s1000rr"), true);

head("§2a  and the bar measures the CURRENT rung, not the whole climb");

Progress.forget();
run(6000);                                  // exactly at the Civic
ok("standing on a rung, the next bar is empty", Progress.next().fraction, 0, 1e-9);
const span = Garage.get("f150").cost - Garage.get("civic").cost;
run(span / 2);
ok("...and halfway to the pickup it is half full", Progress.next().fraction, 0.5, 1e-6);

/* ══════════════════════════════════════════════════════════════════════
   §3  a total only rises, and nothing is ever taken back
   ══════════════════════════════════════════════════════════════════════ */
head("§3  it is a threshold, not a purchase");

Progress.forget();
run(130000);                                 // through the Corvette
const had = Progress.unlocked().length;
ok("the Corvette is open", Progress.isUnlocked("z06"), true);
run(0);                                      // a run that banked nothing
ok("a wasted run takes nothing away", Progress.unlocked().length, had);
ok("...and the total is unchanged", Progress.total, 130000);
run(-500);                                   // and a nonsense one
ok("a negative bank cannot reduce the total", Progress.total, 130000);
ok("unlocking is not a spend — the total still stands", Progress.total >= Garage.get("z06").cost, true);

/* ══════════════════════════════════════════════════════════════════════
   §4  it persists, and a bad save cannot stop the game starting
   ══════════════════════════════════════════════════════════════════════ */
head("§4  persistence");

Progress.forget();
run(50000, { km: 42, exits: 7 });
ok("the run was counted", Progress.runs, 1);
ok("kilometres accumulate", Progress.km, 42);
ok("exits accumulate", Progress.exits, 7);
ok("and it reached localStorage", typeof store.get(Progress.KEY), "string");

Progress.select("mustang");
Progress.load();
ok("the total survives a reload", Progress.total, 50000);
ok("...and so does the chosen car", Progress.chosen(), "mustang");

head("§4a  garbage in the slot is survived, not thrown on");

for (const junk of ['{"total":"lots"}', "not json at all", "null", "[]", '{"total":-9}']) {
  store.set(Progress.KEY, junk);
  Progress.load();
  ok(`a save of ${junk.slice(0, 18)} loads as a fresh ledger`, Progress.total, 0);
}
store.set(Progress.KEY, '{"total":90000,"car":"911"}');
Progress.load();
ok("a tampered save cannot start you in a car you have not earned",
   Progress.chosen() === "911", false);
ok("...it gives you the best one the total actually justifies",
   Progress.chosen(), "m5");

/* ══════════════════════════════════════════════════════════════════════
   §5  the save code, which is the only "account" a static site can have
   ══════════════════════════════════════════════════════════════════════ */
head("§5  the save code");

Progress.forget();
run(190000, { km: 300, exits: 40 });
Progress.select("gtr");
const code = Progress.exportCode();
console.log(`       ${code.slice(0, 56)}…  (${code.length} chars)`);

Progress.forget();
ok("after forgetting, nothing is banked", Progress.total, 0);
const back = Progress.importCode(code);
ok("the code is accepted", back.ok, true);
ok("the total comes back", Progress.total, 190000);
ok("the chosen car comes back", Progress.chosen(), "gtr");
ok("the kilometres come back", Progress.km, 300);

ok("a code with a character lost is refused",
   Progress.importCode(code.slice(0, -1)).ok, false);
ok("a code from another game is refused",
   Progress.importCode("SOMEONE-ELSES-SAVE").ok, false);
ok("an empty string is refused", Progress.importCode("").ok, false);
ok("...and being refused left the ledger alone", Progress.total, 190000);
ok("whitespace round a pasted code is forgiven",
   Progress.importCode(`\n  ${code}  \n`).ok, true);

/* ══════════════════════════════════════════════════════════════════════ */
console.log(`\n${pass} passed, ${fail} failed`);
console.log("─".repeat(30));
process.exit(fail ? 1 : 0);
