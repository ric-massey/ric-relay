/* ══════════════════════════════════════════════════════════════════════
   PROGRESS — what you have banked, and what that has opened up.

   The only thing in the game that survives a run. `score.js` earns and
   banks within a run and forgets everything when it ends; this is the
   ledger the banking lands in.

   ── unlocks are a THRESHOLD, not a purchase ──────────────────────────
   `total` is every point ever banked and it only rises. A vehicle is
   unlocked when the total passes its cost, and nothing is deducted —
   you do not spend points on a car, you reach it.

   That is a deliberate choice over a currency you spend, for two
   reasons. It cannot produce a state where you own the Corvette and
   cannot afford the Civic, which is confusing to look at and worse to
   explain on a menu. And a spend would make the ladder a series of
   decisions about what to skip, when the thing being built is a
   progression: one leads to the next, which is the game's own title.

   ── and it is never taken away ───────────────────────────────────────
   Worth stating because the obvious alternative was available and is
   wrong. `skill.js` already measures how well you drive, and hanging
   unlocks off it was the first idea. It is a ROLLING hundred-kilometre
   window, so it falls as well as rises, and skill.js's own header says
   the 35% ceiling exists so that it "cannot quietly become what the
   game is about". Unlocks off E would make it visible, make it the
   point, and take a car away from you for one bad night. So the two
   systems stay separate: skill leans on the dice, progress opens doors.

   ── there are no accounts, and there cannot be ───────────────────────
   *(Ric, 2026-08-12: "i guess at some point there will need to be
   accounts lol... didnt think about that.")*

   This is a static site on GitHub Pages. There is no server, so there
   is nothing to hold an account, and localStorage means progress is per
   browser and per device and dies when site data is cleared.

   The version of accounts that a static site CAN do is a save code: the
   whole ledger is one small serialisable object, so `exportCode` and
   `importCode` below turn it into a string you copy out and paste in
   somewhere else. That is not sync and it is not backup — it is a
   transfer you perform by hand — and it is here now rather than later
   because the shape of the state is what makes it possible, and that
   shape is much harder to change afterwards.
   ══════════════════════════════════════════════════════════════════════ */

const Progress = (() => {
  "use strict";

  const KEY = "offramp.progress.v1";
  const VERSION = 1;

  /* ── the ledger ────────────────────────────────────────────────────
     Small, flat and JSON-safe on purpose — see the save-code note. Any
     field added here has to survive a round trip through a string. */
  function blank() {
    return {
      v: VERSION,
      total: 0,          // every point ever banked. Only rises.
      best: 0,           // the best single run's banked total
      runs: 0,
      km: 0,
      exits: 0,
      car: null,         // last chosen vehicle id
      seen: [],          // vehicle ids already announced as unlocked
    };
  }

  let P = blank();
  let dirty = false;

  /* A save written by an older build must never stop the game from
     starting, so everything here is defensive: unknown shape, missing
     fields and outright garbage all fall back to a fresh ledger rather
     than throwing on the way to the title screen. */
  function load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
    P = merge(raw);
  }

  function merge(raw) {
    const p = blank();
    if (!raw || typeof raw !== "object") return p;
    const num = (v, d) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : d);
    p.total = num(raw.total, 0);
    p.best = num(raw.best, 0);
    p.runs = num(raw.runs, 0);
    p.km = num(raw.km, 0);
    p.exits = num(raw.exits, 0);
    p.car = typeof raw.car === "string" ? raw.car : null;
    p.seen = Array.isArray(raw.seen) ? raw.seen.filter((s) => typeof s === "string") : [];
    return p;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(P)); dirty = false; }
    catch (e) { dirty = true; }              // private mode. Not fatal.
  }

  /* ══════════════════════════════════════════════════════════════════
     the garage door
     ══════════════════════════════════════════════════════════════════ */

  const table = () => (typeof Garage !== "undefined" ? Garage.ALL : []);

  const isUnlocked = (id) => {
    const c = typeof Garage !== "undefined" ? Garage.get(id) : null;
    return !!c && P.total >= c.cost;
  };

  const unlocked = () => table().filter((c) => P.total >= c.cost);

  /* The next thing you have not got, and how far away it is. This is
     what the menu puts a progress bar under, so it returns the gap
     rather than making the caller work it out. */
  function next() {
    const locked = table().filter((c) => P.total < c.cost);
    if (!locked.length) return null;
    const c = locked.reduce((a, b) => (a.cost <= b.cost ? a : b));
    const prev = table().filter((x) => x.cost <= P.total)
                        .reduce((a, b) => (a.cost >= b.cost ? a : b), { cost: 0 });
    const span = c.cost - prev.cost;
    return {
      car: c,
      need: c.cost - P.total,
      /* Fraction of the way from the last unlock to this one, rather
         than from zero — otherwise every bar past the first is nearly
         full before the rung is anywhere near reached. */
      fraction: span > 0 ? Math.min(1, (P.total - prev.cost) / span) : 1,
    };
  }

  /* Which vehicle the menu should show selected: the last one chosen if
     it is still legitimate, otherwise the best one available. Never
     returns a locked car, so a tampered save cannot start the game in
     the 911. */
  function chosen() {
    if (P.car && isUnlocked(P.car)) return P.car;
    const u = unlocked();
    return u.length ? u[u.length - 1].id
      : (typeof Garage !== "undefined" ? Garage.DEFAULT : null);
  }

  function select(id) {
    if (!isUnlocked(id)) return chosen();
    P.car = id; save();
    return id;
  }

  /* ══════════════════════════════════════════════════════════════════
     the end of a run

     `banked` is what score.js kept — never the carried pot, which is
     already gone by the time this is called. Returns anything the run
     opened up, so the wreck panel can say so.
     ══════════════════════════════════════════════════════════════════ */
  function endRun(res) {
    const r = res || {};
    const before = unlocked().map((c) => c.id);
    P.total += Math.max(0, r.banked || 0);
    P.best = Math.max(P.best, Math.max(0, r.banked || 0));
    P.runs += 1;
    P.km += Math.max(0, r.km || 0);
    P.exits += Math.max(0, r.exits || 0);
    const opened = unlocked().map((c) => c.id).filter((id) => !before.includes(id));
    P.seen = P.seen.concat(opened.filter((id) => !P.seen.includes(id)));
    save();
    return {
      total: P.total,
      opened: opened.map((id) => Garage.get(id)),
      next: next(),
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     the save code

     Base64 of the JSON, with a checksum so a mistyped code is refused
     rather than silently importing as a fresh ledger. Not security —
     there is nothing to secure on a machine the player owns — only a
     guard against a code that lost a character in a chat window.
     ══════════════════════════════════════════════════════════════════ */
  const sum = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  };

  const b64 = {
    to: (s) => (typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(s)))
      : Buffer.from(s, "utf8").toString("base64")),
    from: (s) => (typeof atob === "function"
      ? decodeURIComponent(escape(atob(s)))
      : Buffer.from(s, "base64").toString("utf8")),
  };

  function exportCode() {
    const body = JSON.stringify(P);
    return `I40-${sum(body)}-${b64.to(body)}`;
  }

  function importCode(code) {
    if (typeof code !== "string") return { ok: false, why: "not a code" };
    const m = code.trim().match(/^I40-([a-z0-9]+)-(.+)$/i);
    if (!m) return { ok: false, why: "that is not an Interstate 40 code" };
    let body;
    try { body = b64.from(m[2]); } catch (e) { return { ok: false, why: "the code is damaged" }; }
    if (sum(body) !== m[1]) return { ok: false, why: "the code is damaged" };
    let raw;
    try { raw = JSON.parse(body); } catch (e) { return { ok: false, why: "the code is damaged" }; }
    P = merge(raw);
    save();
    return { ok: true, total: P.total };
  }

  function forget() { P = blank(); save(); }

  /* ── the skeleton key ──────────────────────────────────────────────
     Types `unlock` into the box on the title screen and the whole
     garage opens. It is a development door and it is deliberately not
     hidden behind a konami code, because the person who most needs to
     drive the 911 without banking 280,000 first is whoever is working
     on how the 911 drives.

     It grants the TOTAL rather than setting a flag, so there is exactly
     one thing in this file that decides whether a vehicle is available
     — `P.total >= c.cost` — and no second code path that a real save
     could ever disagree with. The consequence, stated because it is a
     real one: this is indistinguishable afterwards from having earned
     it, so `best`, `runs` and `km` are left alone and the ledger does
     not pretend you drove for it. */
  function unlockAll() {
    const costs = table().map((c) => c.cost);
    P.total = Math.max(P.total, costs.length ? Math.max(...costs) : 0);
    P.seen = table().map((c) => c.id);
    save();
    return P.total;
  }

  load();

  return {
    load, save, forget, unlockAll,
    endRun, select, chosen, next, unlocked, isUnlocked,
    exportCode, importCode,
    get total() { return P.total; },
    get best() { return P.best; },
    get runs() { return P.runs; },
    get km() { return P.km; },
    get exits() { return P.exits; },
    get seen() { return P.seen.slice(); },
    get unsaved() { return dirty; },
    read: () => ({ ...P, seen: P.seen.slice() }),
    KEY, VERSION,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Progress;
