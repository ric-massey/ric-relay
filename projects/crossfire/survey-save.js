"use strict";

/* CROSSFIRE — SURVEY'S BOOK
   ─────────────────────────────────────────────────────────────────────────────
   A save is somebody's afternoon written to a disk they own. This is everything
   that turns one into text and back: where it is kept, what a valid one looks
   like, how an older one is brought forward, and what to do when a candidate
   will not read.

   It came out of index.html whole — the same code, one indent shallower, with
   the things it reaches for named at the top instead of picked up out of a
   shared closure. That list is the point of the move as much as the file is:
   fourteen names, all of them constants and content tables, is a small enough
   surface to keep honest.

   What did *not* come with it is the serialiser. `surveyBook()` walks the live
   run — the ship, the hold, the chart the HUD packs — and that is the runtime's
   own business; this file is handed the object and only decides where it goes.

   Nothing in here touches the DOM, a canvas or a clock, so it can be driven
   from a test at fixture speed. See test/save.js. */

window.CrossfireSurveySave = function (env) {
  const {
    /* Where the book is kept, and what version this build writes. */
    SURVEY_STORE, SURVEY_BACKUP, SURVEY_LEGACY, SAVE_VERSION,
    /* The shape of a ship, and the two tanks. */
    SLOTS, WATER_FULL, FOOD_FULL,
    /* An empty hold, in the runtime's own shape. */
    freshHold,
    /* Whether to say out loud that a candidate would not read. A player whose
       save is genuinely corrupt should get a new sector, not a console full of
       somebody else's problem. */
    debugOn
  } = env;

  /* The five content tables a book is checked against: a key that is not in one
     of these is a key this build cannot honour, and a book full of them is a
     save from a build that is not this one.

     Reached through `env` rather than pulled out of it, because they are not
     all defined yet. index.html declares FACTIONS six thousand lines below the
     book, and inside one closure that never mattered — the validator only read
     it when somebody loaded a save. Destructuring here read it at boot instead
     and the game would not start. A getter each on the way in, and the binding
     stays as late as it was. */
  // A region cell's key, "cx,cy", with both halves whole numbers.
  const cellKeyOk = k => typeof k === "string" && /^-?\d{1,6},-?\d{1,6}$/.test(k);
  const BUILD     = () => env.BUILD;
  const MODULES   = () => env.MODULES;
  const MATERIALS = () => env.MATERIALS;
  const FACTIONS  = () => env.FACTIONS;
  const SHIPS     = () => env.SHIPS;

/* ── the book ─────────────────────────────────────────────────────────────
   What survives the tab: which sector you were in, what you have found, the
   chart you made of it and the line you flew. Both of the big ones are packed
   and run-length encoded by the interface module rather than written as JSON;
   see `exportFog` there for why. */

/* ── where the book is kept ───────────────────────────────────────────────
   The book is one JSON string, and this is the only thing in the game that
   knows where that string goes. Everything else calls `read` and `write` and
   stays out of it.

   The seam exists because the destination is the part that changes and the
   book is the part that does not:

     · in a browser, local storage, which is what it has always been;
     · signed into an account, local storage *and* a row in a table, so the
       same sector opens on the phone;
     · on Steam, a file in the folder Steam has been told to sync — Auto-Cloud
       needs no code from the game at all, only a game that writes a file.

   `read` and `write` are deliberately synchronous, and local. A game that
   waits on a network before it can draw a frame is a game that stutters on a
   bad train, and Survey autosaves every fifteen seconds. So the local copy is
   always the one the run uses, and anything slower is a `mirror`: told about
   every write, never waited for. See `cloud` below for the one that exists. */
const bookStore = (() => {
  /* A wrapper — Electron for Steam, say — can put its own store here before
     the game script runs, and nothing below this line has to know. It only has
     to answer `read`, `write` and `wipe`. */
  const host = window.CROSSFIRE_BOOK_STORE;
  if (host && typeof host.read === "function") return host;
  return {
    read() {
      try { return localStorage.getItem(SURVEY_STORE); } catch (_) { return null; }
    },
    // The last book that parsed and validated, and the one the old key holds.
    readBackup() {
      try { return localStorage.getItem(SURVEY_BACKUP); } catch (_) { return null; }
    },
    readLegacy() {
      if (!SURVEY_LEGACY) return null;
      try { return localStorage.getItem(SURVEY_LEGACY); } catch (_) { return null; }
    },
    writeBackup(s) {
      try { localStorage.setItem(SURVEY_BACKUP, s); return true; }
      catch (_) { return false; }
    },
    /* False when it did not keep — private browsing, or a full quota. The
       caller is the save button, which has to be able to say so rather than
       claiming a save that never happened. */
    write(s) {
      try { localStorage.setItem(SURVEY_STORE, s); return true; }
      catch (_) { return false; }
    },
    wipe() {
      try { localStorage.removeItem(SURVEY_STORE); } catch (_) {}
      try { localStorage.removeItem(SURVEY_BACKUP); } catch (_) {}
    }
  };
})();

/* Anything slower than local storage that also wants the book. Set by the
   account layer once somebody signs in; null the rest of the time, which is
   the state every existing player is in and stays in. */
let bookMirror = null;

/* ── what a save is, in four pieces ───────────────────────────────────────
   Reading a book used to be one function that parsed, migrated, validated,
   invented defaults and talked to storage, all inside one `try`. That shape
   has a specific failure: a `ReferenceError` in the validator — a programmer's
   bug — comes out of the same catch as a hand-edited file, and the game
   answers both by starting a fresh survey. Somebody's afternoon and a typo of
   mine are not the same event and must not have the same consequence.

   So: `parseSurveyBook` turns text into an object, `migrateSurveyBook` brings
   an older one up to the current version, `validateSurveyBook` turns an
   object into a book this game will run, and `loadSurveyBook` decides what to
   do when one of them says no. Each throws a `SaveError` for the failures a
   *file* can have. Anything else is mine and is allowed to escape. */
const SAVE_INVALID_JSON       = "SAVE_INVALID_JSON";
const SAVE_INVALID_SCHEMA     = "SAVE_INVALID_SCHEMA";
const SAVE_UNSUPPORTED_VERSION = "SAVE_UNSUPPORTED_VERSION";

class SaveError extends Error {
  constructor(code, why) {
    super(why || code);
    this.name = "SaveError";
    this.code = code;
  }
}

/* ── what a run has permanently changed ───────────────────────────────────
   Survey's world is a function of its seed, so anything you *consume* has to
   be remembered outside the chunk or flying away would restock the sector
   behind you. Two sets do it: caches opened and hulks stripped, each id a
   chunk and an index — "-43,18c0", "-43,18h2".

   As a list of those strings, the save grows without bound and repeats the
   chunk key once per object: four things looted in one chunk wrote the
   coordinates four times. Per chunk instead, with the indices as numbers, so
   the key is written once however much of that chunk you empty.

   Truncating the list was never an option. A dropped id is a cache that
   refills or a hulk that comes back — the sector quietly un-remembering what
   you did to it — so this is a change of shape and nothing is discarded.

   The runtime keeps the flat Sets. They are asked `has(id)` for every object
   of every chunk that streams in, and a nested lookup there would be paying
   in the hot path for a saving that belongs in the file. */
const MUT_ID = /^(-?\d+,-?\d+)([chp])(\d+)$/;

/* `p` is the third of these: a loose part lifted off the floor. It is the same
   kind of fact as an opened cache — a thing that was out there, is not any
   more, and must not come back when its chunk is rebuilt from the seed.

   Added without a version bump, because it is additive in both directions. A
   book written before it simply has no `p` entries and nothing was taken; a
   book written with them, read by a build that has never heard of them, drops
   them and the part turns up again. Neither is a corrupt file. */
function packMutations(opened, stripped, lifted) {
  const cells = {};
  // Ids that are not chunk-and-index: the Leviathan's holds are "lev0" and
  // belong to a thing rather than to a place. Kept verbatim rather than
  // dropped, which is the whole rule here.
  const odd = { c: [], h: [], p: [] };
  const put = (set, field) => {
    for (const id of set || []) {
      const m = MUT_ID.exec(id);
      if (!m) { odd[field].push(id); continue; }
      const cell = cells[m[1]] || (cells[m[1]] = {});
      (cell[field] || (cell[field] = [])).push(+m[3]);
    }
  };
  put(opened, "c");
  put(stripped, "h");
  put(lifted, "p");
  for (const k of Object.keys(cells)) {
    for (const f of ["c", "h", "p"]) {
      if (cells[k][f]) cells[k][f].sort((a, b) => a - b);
    }
  }
  const out = { cells };
  if (odd.c.length || odd.h.length || odd.p.length) out.odd = odd;
  return out;
}

function unpackMutations(mut) {
  const opened = [], stripped = [], lifted = [];
  if (!mut || typeof mut !== "object") return { opened, stripped, lifted };
  const cells = mut.cells && typeof mut.cells === "object" ? mut.cells : {};
  for (const k of Object.keys(cells)) {
    if (!/^-?\d+,-?\d+$/.test(k)) continue;
    const cell = cells[k];
    if (!cell || typeof cell !== "object") continue;
    for (const [field, into] of [["c", opened], ["h", stripped], ["p", lifted]]) {
      const list = Array.isArray(cell[field]) ? cell[field] : [];
      for (const i of list) {
        if (Number.isInteger(i) && i >= 0 && i < 4096) into.push(k + field + i);
      }
    }
  }
  const odd = mut.odd && typeof mut.odd === "object" ? mut.odd : {};
  for (const [field, into] of [["c", opened], ["h", stripped], ["p", lifted]]) {
    const list = Array.isArray(odd[field]) ? odd[field] : [];
    for (const id of list) if (typeof id === "string") into.push(id.slice(0, 40));
  }
  return { opened, stripped, lifted };
}

function freshBook() {
  return { version: SAVE_VERSION,
           seed: 0, at: null, savedAt: 0, found: [], fog: "", cash: 0, deaths: 0,
                  rep: {}, selected: null,
                  ship: "skiff", owned: ["skiff"], taught: [],
                  water: WATER_FULL, food: FOOD_FULL,
                  hold: freshHold(),
                  opened: [], stripped: [], lifted: [], seen: [],
                  carrying: [], built: [], pins: [], known: [],
                  slots: [], store: {}, battleAge: {}, memorials: [],
                  dropped: [], coilFired: false,
                  friends: [], grudges: [], claims: [], mapped: [], war: null,
           alert: { water: { taught: 0 }, food: { taught: 0 } } };
}

function parseSurveyBook(raw) {
  let b;
  try { b = JSON.parse(raw); }
  catch (err) { throw new SaveError(SAVE_INVALID_JSON, err.message); }
  if (!b || typeof b !== "object" || Array.isArray(b)) {
    throw new SaveError(SAVE_INVALID_SCHEMA, "a book must be an object");
  }
  return b;
}

/* One step a version, written out rather than inferred from which fields
   happen to be missing. A book with no `version` is a v3 — every book written
   before the field existed — and v3 to v4 is a rename of the storage key and
   nothing else, so the migration is a stamp. Later steps go here in the same
   shape, and each one is a place to put a test fixture.

   A version this build has never heard of is refused rather than guessed at:
   a newer game may have written fields this one would quietly drop, and
   dropping them is how a save gets smaller every time an old build opens it. */
function migrateSurveyBook(b) {
  let v = Number.isFinite(b.version) ? Math.floor(b.version) : 3;
  if (v > SAVE_VERSION) {
    throw new SaveError(SAVE_UNSUPPORTED_VERSION,
                        "book is version " + v + ", this build reads " +
                        SAVE_VERSION);
  }
  if (v < 3) {
    throw new SaveError(SAVE_UNSUPPORTED_VERSION, "book is version " + v);
  }
  if (v === 3) { b = { ...b, version: 4 }; v = 4; }
  /* v4 kept every looted cache and stripped hulk as its own string, chunk key
     and all. v5 keeps them per chunk. Nothing is dropped — a lost id is a
     cache that refills. */
  if (v === 4) {
    b = { ...b, version: 5,
          mutations: packMutations(b.opened || [], b.stripped || [],
                                   b.lifted || []) };
    delete b.opened;
    delete b.stripped;
    delete b.lifted;
    v = 5;
  }
  return b;
}

/* Every field, checked. A book is a file on somebody's disk and a hand-edited
   one must not be able to put the ship somewhere the streamer cannot build. */
function validateSurveyBook(b) {
  const empty = freshBook();
  {
    const strs = v => Array.isArray(v) ? v.filter(k => typeof k === "string") : [];
    return {
      version: SAVE_VERSION,
      seed: Number(b.seed) || 0,
      /* Where the run left off. Validated like everything else in here: a book
         is a file on somebody's disk, and a hand-edited one must not be able to
         put the ship somewhere the streamer cannot build. `bounds` is a ten
         million unit box, so anything outside it is a corruption and not a
         place — and a missing `at` is simply an older book, which resumes at
         the origin the way every book used to. */
      at: b.at && Number.isFinite(b.at.x) && Number.isFinite(b.at.y) &&
          Math.abs(b.at.x) < 1e7 && Math.abs(b.at.y) < 1e7
        ? { x: Math.round(b.at.x), y: Math.round(b.at.y),
            a: Number.isFinite(b.at.a) ? Number(b.at.a) : -Math.PI / 2 }
        : null,
      savedAt: Math.max(0, Math.floor(Number(b.savedAt)) || 0),
      found: strs(b.found),
      fog: typeof b.fog === "string" ? b.fog : "",

      /* Written as `cash` since the rename; `salvage` is read as a
         fallback so a survey started before it is not quietly emptied. */
      /* The old single number was cargo, capped by the hold and spent on
         refits. Read back as cargo — iron, the staple — rather than as money:
         it is what it actually was, and selling it buys about what it used to
         buy directly, where reading it as cash would have quietly devalued
         everybody's hold on the day this shipped. */
      cash: b.hold === undefined
        ? 0                        // it was cargo, and it is read back as iron
        : Math.max(0, Math.floor(Number(b.cash)) || 0),
      deaths: Math.max(0, Math.floor(Number(b.deaths)) || 0),
      rep: (() => {
        const out = {};
        const src = b.rep && typeof b.rep === "object" ? b.rep : {};
        for (const f of FACTIONS()) {
          out[f.key] = Math.max(-240, Math.min(240, Number(src[f.key]) || 0));
        }
        return out;
      })(),
      light: !!b.light,
      /* Validated against the roster: a hull that is not in it would be a ship
         with no stats and no shape, and every read of it downstream would be
         an undefined. */
      ship: SHIPS().some(sh => sh.key === b.ship) ? b.ship : "skiff",
      owned: (Array.isArray(b.owned) ? b.owned : [])
        .filter(k => SHIPS().some(sh => sh.key === k))
        .concat("skiff")
        .filter((k, i, a) => a.indexOf(k) === i),
      // The one thing you are keeping an eye on. A decision, so it is kept.
      selected: b.selected && Number.isFinite(b.selected.x) &&
                Number.isFinite(b.selected.y)
        ? { x: Math.round(b.selected.x), y: Math.round(b.selected.y),
            k: String(b.selected.k || "").slice(0, 20),
            name: String(b.selected.name || "").slice(0, 40) } : null,
      /* Clamped both ways. A book written before life support existed has no
         tanks at all and must resume full rather than resume dying, and a
         hand-edited one must not hand out an infinite tank. */
      water: b.water == null ? WATER_FULL
        : Math.max(0, Math.min(WATER_FULL, Number(b.water) || 0)),
      /* Clamped to the biggest pantry any hull has rather than to the Skiff's,
         because the book does not know which ship it will be read onto — a
         GRANARY's tank would otherwise be cut to a SKIFF's on every load. The
         `* 4` is that hull: the pantry rides the hold, and the Granary's is four
         times the starting one (180 minutes against 45). The ship's own cap is
         applied where it is used. */
      food: b.food == null ? FOOD_FULL
        : Math.max(0, Math.min(FOOD_FULL * 4, Number(b.food) || 0)),
      hold: (() => {
        const h = freshHold();
        const src = b.hold && typeof b.hold === "object" ? b.hold : null;
        if (src) {
          for (const m of MATERIALS()) {
            h[m.key] = Math.max(0, Math.min(9999, Math.floor(Number(src[m.key])) || 0));
          }
          return h;
        }
        const legacy = Math.floor(Number(b.cash != null ? b.cash : b.salvage)) || 0;
        h.iron = Math.max(0, Math.min(9999, legacy));
        return h;
      })(),
      /* Unpacked back into flat ids, because that is what the streamer asks
         `has()` for on every object of every chunk it builds. The compaction
         is the file's business, not the runtime's. */
      ...(() => {
        const m = unpackMutations(b.mutations);
        return { opened: m.opened, stripped: m.stripped, lifted: m.lifted };
      })(),
      seen: strs(b.seen),
      /* Filtered against the manifest rather than merely checked for being
         strings. `objective()` looks every carried key up in BUILD and reads
         a name off the result, so one unknown key — a save from a build with
         a different manifest, or a hand-edited one — threw on the first frame
         and took the whole mode with it before anything could be drawn. */
      taught: strs(b.taught),
      carrying: strs(b.carrying).filter(k => BUILD().some(x => x.key === k)),
      built: strs(b.built).filter(k => BUILD().some(x => x.key === k)),
      pins: Array.isArray(b.pins)
        ? b.pins.filter(q => q && Number.isFinite(q.x) && Number.isFinite(q.y) &&
                             typeof q.kind === "string").slice(0, 200)
        : [],
      known: Array.isArray(b.known)
        ? b.known.filter(q => q && typeof q.k === "string" &&
                              Number.isFinite(q.x) && Number.isFinite(q.y))
                 .map(q => ({ k: q.k, x: q.x, y: q.y,
                              name: typeof q.name === "string" ? q.name : "",
                              r: Math.max(0, Math.floor(Number(q.r)) || 0) }))
                 .slice(0, 600)
        : [],

      /* ── everything Phase 5 added ──────────────────────────────────────
         This function is a whitelist: a field that is written to the book and
         not read back here is silently thrown away on the next load, and
         nothing anywhere says so. Four things had been quietly landing in that
         hole — the four slots, the crate of parts, which battles are over, and
         which are remembered — and the parts you die carrying would have made
         five. Every one of them is validated on the way in, because the book is
         a file on somebody's disk and a hand-edited one must not be able to
         hand out a part that does not exist. */
      slots: Array.isArray(b.slots)
        ? b.slots.slice(0, SLOTS).map(sl =>
            sl && typeof sl.key === "string" && MODULES().some(m => m.key === sl.key)
              ? { key: sl.key, fit: Math.max(0, Math.min(999, Number(sl.fit) || 0)) }
              : null)
        : [],
      store: (() => {
        const out = {};
        const src = b.store && typeof b.store === "object" ? b.store : {};
        for (const m of MODULES()) {
          const n = Math.max(0, Math.min(999, Math.floor(Number(src[m.key])) || 0));
          if (n) out[m.key] = n;
        }
        return out;
      })(),
      battleAge: (() => {
        const out = {};
        const src = b.battleAge && typeof b.battleAge === "object" ? b.battleAge : {};
        for (const k of Object.keys(src).slice(0, 400)) {
          const v = Number(src[k]);
          if (Number.isFinite(v)) out[k] = Math.max(0, Math.min(9999, v));
        }
        return out;
      })(),
      memorials: strs(b.memorials).slice(0, 400),
      /* Territory. `claims` is the cells that have changed hands, as
         ["cx,cy", power-or-""]; `mapped` is what the chart saw, as
         ["cx,cy", { r: biome, o: owner-or-kind }]. Both checked key by key
         against the tables they name, so a hand-edited book cannot put a power
         that does not exist on the map. */
      claims: (Array.isArray(b.claims) ? b.claims : [])
        .filter(e => Array.isArray(e) && cellKeyOk(e[0]) &&
                     (e[1] === "" || FACTIONS().some(f => f.key === e[1])))
        .slice(0, 4000)
        .map(e => [e[0], e[1]]),
      /* The war as it stands: who is fighting whom, and what each power has
         left. Powers checked against the table; strengths clamped. */
      war: (() => {
        const w = b.war && typeof b.war === "object" ? b.war : null;
        if (!w) return null;
        const ok = k => FACTIONS().some(f => f.key === k);
        const pairs = {};
        for (const k of Object.keys(w.pairs || {})) {
          if (ok(k) && ok(w.pairs[k]) && k !== w.pairs[k]) pairs[k] = w.pairs[k];
        }
        const belligerents = (Array.isArray(w.belligerents) ? w.belligerents : [])
          .filter(ok).slice(0, 2);
        const strength = {};
        for (const f of FACTIONS()) {
          const v = Number((w.strength || {})[f.key]);
          strength[f.key] = Number.isFinite(v) ? Math.max(0.2, Math.min(1.4, v)) : 1;
        }
        return { pairs, belligerents: belligerents.length === 2 ? belligerents : [],
                 strength, calm: Math.max(0, Number(w.calm) || 0) };
      })(),
      mapped: (Array.isArray(b.mapped) ? b.mapped : [])
        .filter(e => Array.isArray(e) && cellKeyOk(e[0]) && e[1] &&
                     typeof e[1].r === "string" && typeof e[1].o === "string")
        .slice(0, 8000)
        .map(e => [e[0], { r: e[1].r.slice(0, 16), o: e[1].o.slice(0, 16) }]),
      coilFired: !!b.coilFired,
      alert: (() => {
        const out = {};
        const src = b.alert && typeof b.alert === "object" ? b.alert : {};
        for (const k of ["water", "food"]) {
          const n = Math.floor(Number((src[k] || {}).taught)) || 0;
          out[k] = { taught: Math.max(0, Math.min(9, n)) };
        }
        return out;
      })(),
      /* Who owes you one, and who owes you the other thing. Both are short,
         both are validated on the way in like everything else in here, and both
         are the difference between a sector that has a history and a sector that
         merely has events. */
      friends: Array.isArray(b.friends)
        ? b.friends.filter(f => f && typeof f.name === "string" &&
                                typeof f.faction === "string")
                   .map(f => ({ name: f.name.slice(0, 40),
                                faction: f.faction.slice(0, 20),
                                hull: String(f.hull || "drayman").slice(0, 20),
                                why: String(f.why || "").slice(0, 20),
                                repaid: !!f.repaid }))
                   .slice(0, 12)
        : [],
      grudges: Array.isArray(b.grudges)
        ? b.grudges.filter(g => g && typeof g.name === "string")
                   .map(g => ({ name: g.name.slice(0, 40),
                                hull: String(g.hull || "needle").slice(0, 20),
                                hp: Math.max(1, Math.min(20, Math.floor(Number(g.hp)) || 5)),
                                cool: Math.max(0, Math.min(900, Number(g.cool) || 0)) }))
                   .slice(0, 6)
        : [],
      /* Both kinds: a manifest part, and a spare you were carrying when you
         died. This filter knew about one of them, so every spare on the floor
         was thrown away the next time the book was read — and the `map` below
         it dropped `mod` and `id`, which is how the survivors lost the two
         fields that say what they are and which one they are.

         The reader further down says of itself that a whitelist knowing about
         only one kind "is the bug class this file has already shipped twice".
         This was the third. */
      dropped: Array.isArray(b.dropped)
        ? b.dropped.filter(d => d && typeof d.key === "string" &&
                                (BUILD().some(x => x.key === d.key) ||
                                 MODULES().some(x => x.key === d.key)) &&
                                Number.isFinite(d.x) && Number.isFinite(d.y))
                   .map(d => ({ key: d.key, mod: !!d.mod,
                                id: typeof d.id === "string" ? d.id.slice(0, 40) : "",
                                x: Math.round(d.x), y: Math.round(d.y) }))
                   // A death can put a hold's worth of spares on the floor.
                   .slice(0, 64)
        : []
    };
  }
}

/* The last book known to be readable — the one that loaded at boot, or the
   one this session last wrote. It becomes the backup on the way past, so the
   copy kept is always one that parsed and validated rather than whatever
   happened to be in the slot. */
let lastGoodBook = null;

const readSurveyBook = raw =>
  validateSurveyBook(migrateSurveyBook(parseSurveyBook(raw)));

/* The loader reads through this rather than calling `readSurveyBook` by name.
   One seam, and it exists for one reason: the guarantee that matters most in
   here — that a bug in the reader is not treated as a corrupt save — is
   otherwise impossible to stage, because staging it means having the bug. A
   harness can replace `read` with something that throws the way a mistake of
   mine throws, and watch it come back out. */
const bookHooks = { read: readSurveyBook };

/* ── loading one ──────────────────────────────────────────────────────────
   Primary, then the backup, then the book an older build left under the old
   key. A fresh survey is the last answer, not the first.

   The distinction that matters is in the catch: a `SaveError` is something
   wrong with a *file* and the next candidate gets a turn. Anything else is a
   bug in this file and is rethrown — it used to be swallowed here, and it
   swallowed a `ReferenceError` for an entire refactor, during which every
   resume in the game silently started a new sector and the tests reported it
   as four unrelated failures about reputation and parts. A save that looks
   lost because of a typo of mine is the worst outcome this function has. */
function loadSurveyBook() {
  const tries = [
    ["the save",    () => bookStore.read()],
    ["the backup",  () => bookStore.readBackup && bookStore.readBackup()],
    ["the v3 save", () => bookStore.readLegacy && bookStore.readLegacy()]
  ];
  for (const [what, get] of tries) {
    let raw = null;
    try { raw = get(); } catch (_) { raw = null; }
    if (!raw) continue;
    try {
      const book = bookHooks.read(raw);
      lastGoodBook = raw;
      return book;
    } catch (err) {
      if (!(err instanceof SaveError)) throw err;
      /* Only under `?debug=1`: a player whose save is genuinely corrupt should
         get a new sector, not a console full of somebody else's problem. */
      if (debugOn) {
        console.warn("survey: " + what + " would not read — " +
                     err.code + " — " + err.message);
      }
    }
  }
  return freshBook();
}

function write(book) {
  const s = JSON.stringify(book);
  /* Keep the one that is about to be replaced. `lastGoodBook` is a book that
     has already parsed and validated — never whatever happens to be sitting
     in the slot — because copying a corrupt primary into the backup turns one
     bad save into two and leaves nothing to fall back to. */
  if (lastGoodBook && lastGoodBook !== s && bookStore.writeBackup) {
    bookStore.writeBackup(lastGoodBook);
  }
  const kept = bookStore.write(s);
  // Told, never waited for. See `bookStore`.
  if (bookMirror) bookMirror.push(s);
  /* Valid by construction: it is this session's own live state, serialised.
     Only once the store actually kept it — a write that failed on quota has
     not replaced anything, so the previous book is still the primary. */
  if (kept) lastGoodBook = s;
  return kept;
}

  /* What index.html calls. `bookHooks` is the seam the tests reach through to
     stand in for the reader; it is kept as an object rather than a function so
     a harness can swap `read` and have the loader pick it up. */
  return {
    SaveError,
    codes: { SAVE_INVALID_JSON, SAVE_INVALID_SCHEMA, SAVE_UNSUPPORTED_VERSION },
    bookStore, bookHooks,
    freshBook, parseSurveyBook, migrateSurveyBook, validateSurveyBook,
    readSurveyBook, loadSurveyBook,
    packMutations, unpackMutations,
    write,
    /* Anything slower than local storage that also wants the book. Set by the
       account layer once somebody signs in; null the rest of the time, which is
       the state every existing player is in and stays in. */
    setMirror(m) { bookMirror = m; },
    /* Everything Survey keeps, gone — here and wherever it was mirrored. One
       call rather than two, because a store wiped and a mirror left holding the
       old book is a wipe that undoes itself on the next sign-in. */
    wipe() {
      bookStore.wipe();
      if (bookMirror) bookMirror.wipe();
      lastGoodBook = null;
    },
    /* Read-only, for the account layer: the last text known to parse. */
    lastGood: () => lastGoodBook
  };
};
