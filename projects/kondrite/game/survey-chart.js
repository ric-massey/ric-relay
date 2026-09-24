"use strict";

/* KONDRITE — SURVEY — THE CHART
   ─────────────────────────────────────────────────────────────────────────────
   The book, naming pins, wiping a survey, the gate lattice, one chunk, the
   Leviathan and the Vault.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── the book ─────────────────────────────────────────────────────────────
   What survives the tab: which sector you were in, what you have found, the
   chart you made of it and the line you flew. Both of the big ones are packed
   and run-length encoded by the interface module rather than written as JSON;
   see `exportFog` there for why.

   The whole of it — the store, the four pieces a read is made of, and the
   write — lives in survey-save.js now. What is passed in is the list of what
   it needs from this file, and it is deliberately short: constants, the five
   content tables a book is validated against, and an empty hold. Nothing in
   it is live state. The serialiser stays here, below, because it walks the
   run. */
const BOOK = window.KondriteSurveySave({
  SURVEY_STORE, SURVEY_BACKUP, SURVEY_LEGACY, SAVE_VERSION,
  SLOTS, WATER_FULL, FOOD_FULL,
  freshHold,
  debugOn,
  /* Getters, not values. FACTIONS is declared six thousand lines below this
     and the rest are scattered above it; reading them here would read them at
     boot, where one of them does not exist yet. The validator asks for them
     when somebody loads a save, which is the moment it always asked. */
  get BUILD()     { return BUILD; },
  get MODULES()   { return MODULES; },
  get MATERIALS() { return MATERIALS; },
  get FACTIONS()  { return FACTIONS; },
  get SHIPS()     { return SHIPS; }
});

/* The names the rest of this file has always used. Kept rather than rewritten
   to `BOOK.thing` at four hundred call sites: the move is meant to be a move,
   and a diff that also renames everything is a diff nobody can read. */
const SaveError            = BOOK.SaveError;
const bookStore            = BOOK.bookStore;
const bookHooks            = BOOK.bookHooks;
const freshBook            = BOOK.freshBook;
const parseSurveyBook      = BOOK.parseSurveyBook;
const migrateSurveyBook    = BOOK.migrateSurveyBook;
const validateSurveyBook   = BOOK.validateSurveyBook;
const readSurveyBook       = BOOK.readSurveyBook;
const loadSurveyBook       = BOOK.loadSurveyBook;
const packMutations        = BOOK.packMutations;
const unpackMutations      = BOOK.unpackMutations;
const SAVE_INVALID_JSON        = BOOK.codes.SAVE_INVALID_JSON;
const SAVE_INVALID_SCHEMA      = BOOK.codes.SAVE_INVALID_SCHEMA;
const SAVE_UNSUPPORTED_VERSION = BOOK.codes.SAVE_UNSUPPORTED_VERSION;


/* The book as an object. Kept apart from writing it because the account layer
   uploads the same thing the store keeps, and two definitions of what a save
   *is* would be two things to forget to update. */
function surveyBook() {
  const me = ships && ships[0];
  /* Where you were, and which way you were pointed. Survey used to resume at
     the origin unconditionally — see `setupSurvey` — which read as tidy and
     was in fact a free ride home from anywhere in the sector: fly to the
     abyss, close the tab, open it at the station with a full hold.

     Not written while you are dead. The death page is a position you must
     never resume into, and a respawn puts you at the station anyway, so a
     book written mid-death resumes the way it always did. */
  const at = me && !surv.death &&
             Number.isFinite(me.x) && Number.isFinite(me.y) && Number.isFinite(me.a)
    ? { x: Math.round(me.x), y: Math.round(me.y), a: +me.a.toFixed(3) }
    : null;
  return {
      /* The format, said out loud. Before this, a book's version had to be
         inferred from which fields were missing — which works right up to the
         first change that adds nothing and removes nothing. */
      version: SAVE_VERSION,
      seed: surv.seed,
      at,
      /* When. Two saves of the same sector — this browser's and the one on
         the account — can only be told apart by which is newer, and the
         row's own `updated_at` cannot answer it: that is when the book was
         *uploaded*, which for a save made offline is a different moment and
         sometimes a much later one. */
      savedAt: Date.now(),
      found: [...surv.found],
      fog: surveyHUD ? surveyHUD.exportFog() : "",

      cash: Math.round(surv.cash),
      hold: surv.hold,
      deaths: surv.deaths || 0,
      light: !!surv.hasLight,
      selected: surv.selected,
      rep: surv.rep || {},
      ship: surv.ship,
      owned: [...surv.owned],
      taught: [...surv.taught],
      water: Math.round(surv.water),
      food: Math.round(surv.food),
      /* Only what has been taken, and taking is rare — a sector you have
         worked over for an hour is a few hundred short strings, which is well
         inside what the fog already costs. */
      // Per chunk rather than one string an object. See `packMutations`.
      mutations: packMutations(surv.opened, surv.stripped, surv.lifted),
      seen: [...surv.seen],
      // The manifest is the spine of the mode; losing it to a closed tab
      // would be losing the run itself.
      carrying: [...surv.carrying],
      built: [...surv.built],
      dropped: surv.dropped,
      friends: surv.friends,
      grudges: surv.grudges,
      coilFired: !!surv.coilFired,
      alert: { water: { taught: surv.alert.water.taught },
               food:  { taught: surv.alert.food.taught } },
      pins: surv.pins,
      // What is bolted on, mid-fit and all, and what is in the crate.
      slots: surv.slots.map(sl => sl && { key: sl.key, fit: Math.round(sl.fit) }),
      store: surv.store,
      // A battle you watched end stays ended, and one you were remembered to
      // stays remembered.
      battleAge: surv.battleAge,
      /* The cabinets you have played, and your best on each. It is the one
         thing a machine leaves behind — nothing else crosses back into the
         sector — and it is per *machine*, because a score on the box at your
         own station is not a score on the one out in Morrow space. */
      sims: surv.sims,
      memorials: [...surv.memorials],
      bossesDown: [...surv.bossesDown],
      known: [...surv.known.values()],
      // Who holds the sky where it has moved, and what your chart saw of it.
      claims: [...surv.claims],
      mapped: [...surv.mapped],
      war: { pairs: surv.war.pairs, belligerents: surv.war.belligerents,
             strength: surv.war.strength, calm: Math.round(surv.war.calm) },
      living: livingToBook()
  };
}

/* True when it actually kept. Private browsing and a full quota both fail
   here, and the save button has to be able to say so rather than reporting a
   save that never happened. */
/* True when it actually kept. Private browsing and a full quota both fail
   in the store, and the save button has to be able to say so rather than
   reporting a save that never happened. */
function saveSurveyBook() {
  if (!surv) return false;
  return BOOK.write(surveyBook());
}


/* ── asking for a word ────────────────────────────────────────────────────
   The one place this game needs text out of a player. A canvas cannot take
   typing and a phone needs its own keyboard raised, so this is a real input
   laid over the page for as long as the question is open — the same way the
   lobby asks for a room code.

   Cancelled leaves whatever was there, which for a fresh pin is no name at all:
   a pin without a name is still a pin. */
let askEl = null;
/* Taking an element off the page, on any DOM. `remove` is the obvious call and
   it is also the one a minimal document does not always have — this runs under
   a headless harness as well as a browser, and a dialogue that throws while
   closing would take the run with it. */
function drop(el) {
  if (!el) return;
  try {
    if (typeof el.remove === "function") el.remove();
    else if (el.parentNode && el.parentNode.removeChild) el.parentNode.removeChild(el);
  } catch (_) {}
}

/* What colour a kind of pin is. The interface owns the palette — it is the
   thing that draws them — so the engine asks it, and falls back to a neutral
   if the panel is not up yet. */
function pinColour(kind) {
  const list = surveyHUD && surveyHUD.pinKinds ? surveyHUD.pinKinds() : [];
  const hit = list.find(k => k.key === kind);
  return hit ? hit.colour : "#6dffbf";
}

/* ── naming a pin, and choosing what colour it is ─────────────────────────
   One prompt rather than two decisions in two places. The colour used to be
   picked from a palette in the chart's rail *before* you placed anything,
   which meant choosing what a mark would mean before you had seen where it was
   going — and on a phone, where the palette is six small squares in a column
   of buttons, it mostly meant every pin in the game came out the same colour.

   Now: tap PIN, tap the map, and the thing that opens asks both questions at
   the moment you have the answer to them. */
/* The dialogue that is open, if one is. Two things read it: the harness, which
   has no way to click a DOM button, and anything that needs to know the game is
   waiting on a person. */
let pendingAsk = null;

function askPin(kinds, done) {
  drop(askEl);
  let pick = 0;
  const wrap = document.createElement("div");
  wrap.className = "ask";
  wrap.innerHTML =
    '<label>Name this pin</label>' +
    '<input type="text" maxlength="24" autocomplete="off" placeholder="what is here?">' +
    '<div class="swatches"></div>' +
    '<div><button type="button" data-ok>SAVE</button>' +
    '<button type="button" class="quiet" data-no>CANCEL</button></div>';
  /* The buttons are kept as we make them rather than read back off the parent.
     Reading `row.children` assumes `appendChild` actually appended, which is
     true in a browser and not true of every DOM — and the failure mode is a
     crash inside the one dialogue the whole feature depends on. */
  const row = wrap.querySelector(".swatches");
  const swatches = kinds.map((k, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    if (b.style) b.style.background = k.colour;
    b.title = k.name;
    b.addEventListener("click", () => {
      pick = i;
      swatches.forEach((c, j) => c.classList.toggle("on", j === pick));
    });
    row.appendChild(b);
    return b;
  });
  if (swatches[0]) swatches[0].classList.add("on");

  const input = wrap.querySelector("input");
  const close = ok => {
    const v = input.value;
    drop(wrap);
    askEl = null;
    pendingAsk = null;
    done(ok ? { name: v, kind: kinds[pick].key } : null);
  };
  pendingAsk = { type: "pin", kinds: kinds.map(k => k.key), submit: a => {
    drop(wrap);
    askEl = null;
    pendingAsk = null;
    done(a ? { name: a.name || "", kind: a.kind || kinds[0].key } : null);
  } };
  wrap.querySelector("[data-ok]").addEventListener("click", () => close(true));
  wrap.querySelector("[data-no]").addEventListener("click", () => close(false));
  input.addEventListener("keydown", ev => {
    ev.stopPropagation();
    if (ev.key === "Enter") close(true);
    if (ev.key === "Escape") close(false);
  });
  document.body.appendChild(wrap);
  askEl = wrap;
  setTimeout(() => { try { input.focus(); } catch (_) {} }, 0);
}

/* And the only way a pin ever comes off the chart. It used to vanish on any
   tap that landed near one, which is an eraser you cannot turn off: panning a
   crowded map with a finger deleted your own marks and there was nothing to
   undo it with. */
function askYesNo(prompt, done) {
  drop(askEl);
  const wrap = document.createElement("div");
  wrap.className = "ask";
  wrap.innerHTML =
    '<label></label>' +
    '<div><button type="button" data-ok>\\u2713</button>' +
    '<button type="button" class="quiet" data-no>\\u2715</button></div>';
  wrap.querySelector("label").textContent = prompt;
  const close = ok => {
    drop(wrap); askEl = null; pendingAsk = null; if (ok) done();
  };
  pendingAsk = { type: "confirm", submit: ok => close(!!ok) };
  wrap.querySelector("[data-ok]").addEventListener("click", () => close(true));
  wrap.querySelector("[data-no]").addEventListener("click", () => close(false));
  document.body.appendChild(wrap);
  askEl = wrap;
}

function askName(prompt, value, done) {
  drop(askEl);
  const wrap = document.createElement("div");
  wrap.className = "ask";
  wrap.innerHTML =
    '<label></label><input type="text" maxlength="24" autocomplete="off">' +
    '<div><button type="button" data-ok>NAME IT</button>' +
    '<button type="button" class="quiet" data-no>SKIP</button></div>';
  wrap.querySelector("label").textContent = prompt;
  const input = wrap.querySelector("input");
  input.value = value || "";
  const close = ok => {
    const v = input.value;
    drop(wrap);
    askEl = null;
    if (ok) done(v);
  };
  wrap.querySelector("[data-ok]").addEventListener("click", () => close(true));
  wrap.querySelector("[data-no]").addEventListener("click", () => close(false));
  input.addEventListener("keydown", e => {
    // The game is listening for every key while this is open, so the input
    // has to keep its own to itself.
    e.stopPropagation();
    if (e.key === "Enter") close(true);
    if (e.key === "Escape") close(false);
  });
  document.body.appendChild(wrap);
  askEl = wrap;
  setTimeout(() => { try { input.focus(); input.select(); } catch (_) {} }, 0);
}

/* Set by a reset and consumed by the next setup. It has to beat the URL as
   well as the book: someone who opened a `?seed=` link and then asked for a
   new world means it, and handing them the same sector back would look like
   the button did nothing. */
let nextSurveySeed = 0;

function surveySeed() {
  if (nextSurveySeed) {
    const s = nextSurveySeed;
    nextSurveySeed = 0;
    return s;
  }
  const p = new URLSearchParams(location.search).get("seed");
  if (p && /^\d+$/.test(p)) return Number(p) >>> 0;
  const book = loadSurveyBook();
  if (book.seed) return book.seed;
  return (Math.random() * 0xffffffff) >>> 0;
}

/* ── wiping a survey ──────────────────────────────────────────────────────
   Everything Survey keeps lives in one key, so a reset is one `removeItem`
   and a fresh seed. What goes: the almanac, the chart and the flown line, the
   hold, the refit, the station's manifest, every pin, and which caches and hulks
   had been worked over. What stays: the zoom, the keys, the sound — those are
   preferences, not progress.

   It asks twice. This is the only button in the game that destroys hours of
   someone's work, there is no undo, and it sits three rows below a button
   that resets the keyboard — which is a much smaller thing wearing a much
   similar word. The second press has four seconds to arrive. */
const RESET_WINDOW = 4000;
let surveyResetArm = 0;

const surveyResetArmed = () => performance.now() < surveyResetArm;
const surveyResetLabel = () =>
  surveyResetArmed() ? "SURE? THIS WIPES IT ALL" : "RESET SURVEY";

function resetSurveyProgress() {
  if (!surveyResetArmed()) {
    surveyResetArm = performance.now() + RESET_WINDOW;
    note("Press again to wipe the survey — chart, almanac, salvage, the lot.");
    return;
  }
  surveyResetArm = 0;
  BOOK.wipe();
  forgetTitleCard();
  nextSurveySeed = (Math.random() * 0xffffffff) >>> 0;

  // In the sector already? Then the new one starts now rather than next time.
  if (mode && mode.survey && surv) {
    surv = null;
    startGame("survey", 1, 0);
    state = "playing";
    note("New sector.");
    return;
  }
  note("Survey wiped. A new sector is waiting.");
}


/* ── the gate lattice ─────────────────────────────────────────────────────
   A wormhole used to be one mouth with a destination: you fell in, you came
   out in open space, and there was nothing behind you. A one-way throw into
   an endless sector is not a route — it is a thing that happens to you — and
   the way back was however many hours you had just skipped.

   So the *link* is the object now, not the mouth. A link has two ends and
   both of them are real gates, each pointing at the other, so a gate you go
   through is a gate you can come back through.

   The trouble is that a chunk is pure: it may not look at anything already
   loaded, and the far mouth of a link rolled here lands up to 46,000 units
   away, in a chunk that has no way of knowing this one exists. The fix is to
   roll links on a coarser lattice than chunks. A link cell is wider than the
   longest throw, so a chunk need only ask the nine cells around it which
   mouths land inside it — and both ends of every link are found the same way
   from either side. Cells are memoised, so this costs one roll each and then
   nothing. */
const LINK_CELL  = 48000;     // wider than the longest throw, so ±1 cell does
const LINK_SLOTS = 16;        // candidate links a cell, rolled independently
const GATE_NEAR  = 14000, GATE_FAR = 46000;
const COIL_GATE_GAP = 360;    // room to pick the coil up before the gate takes you
let linkCache = new Map();

function linksIn(lx, ly) {
  const key = lx + "," + ly;
  const had = linkCache.get(key);
  if (had) return had;
  // Its own corner of the seed: a cell must not shift because the chunk
  // hasher happened to be asked for the same numbers somewhere else.
  const R = seeded(chunkSeed(lx * 7919 + 31, ly * 104729 + 17) ^ 0x5f356495);
  /* Rare on purpose. A gate that goes both ways is a route, and a route is
     worth far more than the one-way throw this used to be — so there should
     be many fewer of them. At 0.11 a slot it works out near one link, which
     is two mouths, every two hundred chunks: novel rather than impossible.

     The floor is what guarantees the "SEALED" world still has any at all. The
     jump coil's gate is placed by hand and is not rolled here, so finding the
     coil is how most players will meet their first one whatever this says. */
  const p = 0.11 * Math.max(0.05,
    abund("gates", (lx + 0.5) * LINK_CELL, (ly + 0.5) * LINK_CELL));
  const out = [];
  for (let i = 0; i < LINK_SLOTS; i++) {
    const roll = R();
    const ax = lx * LINK_CELL + R() * LINK_CELL;
    const ay = ly * LINK_CELL + R() * LINK_CELL;
    const a  = R() * Math.PI * 2;
    const d  = GATE_NEAR + R() * (GATE_FAR - GATE_NEAR);
    const pa = R() * Math.PI * 2, pb = R() * Math.PI * 2;
    if (roll >= p) continue;          // rolled after, so a skip costs no drift
    out.push({ ax, ay, bx: ax + Math.cos(a) * d, by: ay + Math.sin(a) * d,
               pa, pb });
  }
  linkCache.set(key, out);
  return out;
}

/* Both mouths of every link that lands in this chunk, each aimed at its own
   far end. Called from `buildChunk`, so it must stay pure. */
function gatesInChunk(cx, cy) {
  const ox = cx * CHUNK, oy = cy * CHUNK;
  const inside = (x, y) => x >= ox && x < ox + CHUNK && y >= oy && y < oy + CHUNK;
  const lx = Math.floor(ox / LINK_CELL), ly = Math.floor(oy / LINK_CELL);
  const out = [];
  for (let j = ly - 1; j <= ly + 1; j++) {
    for (let i = lx - 1; i <= lx + 1; i++) {
      for (const L of linksIn(i, j)) {
        if (inside(L.ax, L.ay)) {
          out.push({ x: L.ax, y: L.ay, phase: L.pa, tx: L.bx, ty: L.by });
        }
        if (inside(L.bx, L.by)) {
          out.push({ x: L.bx, y: L.by, phase: L.pb, tx: L.ax, ty: L.ay });
        }
      }
    }
  }
  return out;
}

/* The jump coil's gate is placed by hand at its landmark rather than rolled,
   so its far mouth has to be derived from the site itself — the same numbers
   from either end, computed at setup to register the exit's chunk and again
   when that chunk is built. */
function coilLink(site) {
  const R = seeded(chunkSeed(Math.round(site.x / 97), Math.round(site.y / 97))
                   ^ 0x1d872b41);
  const a = R() * Math.PI * 2, d = GATE_NEAR + R() * (GATE_FAR - GATE_NEAR);
  /* Beside the part, not on it. The mouth used to sit exactly where the jump
     coil lay, and a gate swallows you at 82 units where a part is picked up
     at about 60 — so flying to the coil threw you across the sector every
     single time and the part could not be collected at all. The clue is still
     "a gate": it is right there, you just arrive next to it. */
  const off = R() * Math.PI * 2;
  const gx = site.x + Math.cos(off) * COIL_GATE_GAP;
  const gy = site.y + Math.sin(off) * COIL_GATE_GAP;
  return { ax: gx, ay: gy,
           bx: gx + Math.cos(a) * d, by: gy + Math.sin(a) * d,
           pa: R() * Math.PI * 2, pb: R() * Math.PI * 2 };
}

/* Wells come in sizes now. `k` scales the geometry and the mass together, but
   not at the same rate: radius goes as k and mass as k^2.6, so a big well is
   not merely a wide one — the pull at its edge climbs faster than its reach
   does, which is what makes a supermassive one a region of the map you plan
   around instead of a wider version of the same nuisance.

   Sizes are handed out by band, so the abyss has wells that will take a stock
   ship off the board and home never does. */
/* How far a well's pull is felt. Supermassive ones reach half again as far as
   their size alone would give them: the warning system exists to tell you
   about a thing you have to plan a route around, and a region you can be
   surprised by at the last second is not one you can plan around. The extra
   reach is all warning — the killing radius is untouched. */
const REACH_BONUS = 1.5;

function wellScale(deep, R) {
  /* A spread at every range, sliding upward. The ramp is steep on purpose:
     the plan puts supermassive wells — ones a stock drive cannot climb out of
     — in the DEEP band from 140,000 units, and at a gentler slope they never
     actually arrived anywhere on the map. Home lands near 0.85, the deep band
     crosses 1.8, and the abyss runs past 3. */
  const base = 0.8 + deep * 2.2;
  /* And a wide roll on top of it. This was `0.9 + R() * 0.35` — seventeen per
     cent either side of the band's figure — so every well in the same stretch
     of sector came out the same size, and since the drawing is made from `kill`
     they all looked identical too. Depth still decides the trend; this decides
     whether the one in front of you is a big one, and it is nearly a factor of
     two either way. */
  return base * (0.68 + R() * 0.82);
}

function makeStar(x, y, R, k) {
  const s = HAZARD.star;
  k = k || 1;
  const m = Math.pow(k, 2.6);
  return { kind: "star", x, y, kill: s.kill * k,
           reach: s.reach * k * (k >= SUPERMASSIVE ? REACH_BONUS : 1),
           mass: s.mass * m, soft: s.soft * k, fill: s.fill, size: "sun",
           name: k >= SUPERMASSIVE ? holeName(x, y) : "",
           k, phase: R() * Math.PI * 2 };
}
function makeHole(x, y, big, R, k) {
  const s = big ? HAZARD.hole.large : HAZARD.hole.small;
  k = k || 1;
  const m = Math.pow(k, 2.6);
  return { kind: "hole", x, y, kill: s.kill * k,
           reach: s.reach * k * (k >= SUPERMASSIVE ? REACH_BONUS : 1),
           mass: s.mass * m, soft: s.soft * k, fill: null,
           size: big ? "large" : "small", k, phase: R() * Math.PI * 2,
           // Only the ones worth naming: a small well is a nuisance and a
           // supermassive one is a region of the map you plan around.
           name: k >= SUPERMASSIVE ? holeName(x, y) : "" };
}

/* ── one chunk ────────────────────────────────────────────────────────────
   Pure: same seed and same coordinates, same contents, every time. Nothing in
   here may look at the ship, the clock or anything already loaded, or flying
   away and back would find somewhere different.

   Binaries and overlapping wells are rolled here rather than placed once,
   which is the endless-space answer to a problem the fixed arena solved by
   hand: an entry that needs a *configuration* cannot depend on a single lucky
   spot when there is no single sector — so roughly one chunk in eight is a
   pair, and both entries are always somewhere ahead of you. */
function buildChunk(cx, cy) {
  const R = seeded(chunkSeed(cx, cy));
  // Gates come off the link lattice rather than out of this chunk's roll, so
  // that whatever lands here has a twin somewhere that points back at it.
  const latticeGates = gatesInChunk(cx, cy);
  const ox = cx * CHUNK, oy = cy * CHUNK;
  const rnd = (a, b) => a + R() * (b - a);
  /* Somewhere in this chunk that is not inside something built. The two places
     you can fly into — the Leviathan and the Vault — are large enough to cover
     most of a chunk each, so the sector's own furniture could be rolled *inside*
     them: a cache in a wall, a station in a corridor, an asteroid field in a
     hold. That was survivable while the Leviathan was 2,700 units and one chunk;
     at 9,200 units and four chunks it is a certainty.

     Eight tries, then give up and let the caller skip. Re-rolling consumes the
     chunk's own stream either way, so this stays a pure function of the
     coordinates — the same chunk gives the same answer, blocked or not. */
  const keepOut = lm => lm.key === "leviathan" ? LEV_LEN * 0.58
                      : lm.key === "vault" ? VAULT_R * 1.35
                      : lm.r;
  /* Rock counts as built. `spot` knew about landmarks and nothing else, so in
     the Warrens it placed caches, hulks and wrecks straight into the walls —
     49 of 68 of them, measured. A cache inside solid rock is a cache generated
     for nobody, and it looks perfect from every angle except the one nobody
     can get to.

     The margin is checked as well as the point, because a hulk is a wide thing
     and its middle being clear is not the same as it fitting. */
  const built = (x, y, m) => {
    if ((surv && surv.landmarks || []).some(lm =>
          dist2(x, y, lm.x, lm.y) < (keepOut(lm) + m) ** 2)) return true;

    /* ── and not inside anything this chunk has already put down ──────────
       Worlds are rolled before everything else in a chunk and can be 3,600
       units across, so a cache, a hulk, a wreck or a station could be — and
       was — placed inside one. A thing inside a world is drawn, named, on the
       chart, and unreachable: worlds are solid, and the only way to it is
       through.

       Only this chunk's own furniture, because a chunk is a pure function of
       its coordinates and may not ask a neighbour what it contains. A world
       overlapping the line can still catch something in the chunk next door;
       that is rarer than this was, and fixing it would cost the purity the
       whole streamer is built on. */
    for (const pl of out.planets) {
      if (dist2(x, y, pl.x, pl.y) < (pl.r + m + 220) ** 2) return true;
    }
    for (const h of out.hulks) {
      if (dist2(x, y, h.x, h.y) < (h.r + m + 120) ** 2) return true;
    }
    // A field is a cloud of asteroids; putting a station in the middle of one
    // is putting it behind a wall that moves.
    for (const f of out.fields) {
      if (dist2(x, y, f.x, f.y) < (f.r + m) ** 2) return true;
    }

    if (caveSolidAt(x, y)) return true;
    const r = Math.max(120, m);
    return caveSolidAt(x + r, y) || caveSolidAt(x - r, y) ||
           caveSolidAt(x, y + r) || caveSolidAt(x, y - r);
  };
  const spot = (m) => {
    for (let i = 0; i < 8; i++) {
      const x = ox + rnd(m, CHUNK - m), y = oy + rnd(m, CHUNK - m);
      if (!built(x, y, m)) return { x, y };
    }
    return null;
  };
  const out = { hazards: [], planets: [], wrecks: [], nebulae: [], marks: [],
                caveSegs: caveSegsIn(cx, cy),
                /* A gate comes off the link lattice rather than out of this
                   chunk's roll, so it never went through `spot` and could
                   therefore sit inside the rock of the Warrens — a mouth
                   nobody can reach, with a twin somewhere still pointing at
                   it. `outOfRock` is a pure function of the position, so the
                   nudged mouth is as deterministic as the one it replaces. */
                gates: latticeGates.map(g => {
                  const o = outOfRock(g.x, g.y);
                  return (o.x === g.x && o.y === g.y)
                    ? g : Object.assign({}, g, { x: o.x, y: o.y });
                }), caches: [], stations: [], hulks: [],
                parts: [], fields: [], traffic: [], battles: [] };
  /* Everything this chunk rolls asks *where it is* as well as what world it is
     in. `mx, my` is the chunk's middle, so one region decides the whole chunk
     rather than each object landing in whichever region its own corner is in —
     a chunk straddling a border would otherwise be half one place and half
     another, which is not what a border looks like from the cockpit. */
  const mx = ox + CHUNK / 2, my = oy + CHUNK / 2;
  const ab = key => abund(key, mx, my);
  /* Some places have nothing in them at all. One check rather than trusting a
     dozen multipliers to be zero — see `nothing` on the region table. The
     landmarks are deliberately outside this: they are placed on their own
     ladder and an authored thing sitting alone in the middle of an ocean of
     nothing is the best possible use of an ocean of nothing. */
  const barren = !!regionOf(mx, my).nothing;

  // Where you start is quiet: an opening spawn inside a well is a death you
  // could not have avoided, and the first thing this mode asks you to do is
  // relax and look around.
  const home = cx === 0 && cy === 0;

  /* Everything below is rolled against *what kind of place* this chunk is,
     not how far out it is. `wild` is the biome's half — wells, rock, fields —
     and `deep` is the biome and the owner together, for what is guarded and
     what it is worth. See "how dangerous a place is" in survey-world.js. */
  const deep = depthAt(mx, my);
  const wild = wildAt(mx, my);
  const space = spaceAt(mx, my);

  // The far end of the jump coil's gate, if it lands in this chunk.
  const exit = surv && surv.coilExitAt && surv.coilExitAt.get(chunkKey(cx, cy));
  if (exit) {
    out.gates.push({ x: exit.bx, y: exit.by, phase: exit.pb,
                     tx: exit.ax, ty: exit.ay });
  }

  /* `if (home)` first, and that ordering is a bug I wrote and then found by
     counting. It used to read `if (!home) { ...everything... } else { the home
     station }`, and adding `&& !barren` to the front of it sent every empty
     chunk down the *else* — so the emptiest region in the galaxy came out with
     one copy of the home station in every chunk. Twenty-five of them, one per
     loaded chunk, which is exactly the shape of number that tells you what
     happened. */
  if (home) {
    /* The first station is given rather than found. The mode's opening move is
       "go and look", and it should not be "go and look for the shop" — seeing
       one early is also what teaches that salvage is worth picking up at all. */
    out.stations.push({ x: HOME_STATION.x, y: HOME_STATION.y, r: 132,
                        phase: 0, home: true, faction: "free" });
  } else if (!barren) {
    /* Roughly a sixth of chunks carry a well, where it used to be three in
       five. They were dense enough to read as scenery you steer around all
       day; a hazard you meet constantly is terrain, and terrain does not
       frighten anybody. Rare and enormous beats frequent and survivable.

       Black holes are cut harder than stars — down to about a third of what
       they were. A star is a place: it lights the sector, it mends your hull
       if you sit in it, and it gives a chunk a middle. A hole only takes, so
       a sector full of them is a sector of identical detours, and the one you
       actually have to plan around stops being remarkable. Stars stay put and
       the holes thin out around them. */
    const roll = R() / Math.max(0.05, ab("wells"));
    const k = () => wellScale(wild, R);
    if (roll < 0.025) {
      const p = spot(900 * (1 + wild));
      if (p) {
        const kk = k();
        out.hazards.push(makeStar(p.x - 190 * kk, p.y, R, kk),
                         makeStar(p.x + 190 * kk, p.y, R, kk));
      }
    } else if (roll < 0.032) {
      const p = spot(1000 * (1 + wild));
      if (p) {
        const kk = k();
        out.hazards.push(makeHole(p.x - 250 * kk, p.y - 70 * kk, true, R, kk),
                         makeHole(p.x + 250 * kk, p.y + 70 * kk, true, R, kk));
      }
    } else if (roll < 0.122) {
      const p = spot(600);
      if (p) {
        out.hazards.push(makeStar(p.x, p.y, R, k()));
      }
    } else if (roll < 0.152) {
      const p = spot(700);
      if (p) {
        out.hazards.push(makeHole(p.x, p.y, R() < 0.45, R, k()));
      }
    }
    /* Far fewer, and off the world lattice rather than out of this chunk's
       roll. A world is a landmark now — it is enormous, it has a name, and it
       may be somewhere you can put down — and a landmark you meet every ninety
       seconds is not one. */
    const w = worldIn(Math.floor(ox / WORLD_CELL), Math.floor(oy / WORLD_CELL));
    if (w && w.x >= ox && w.x < ox + CHUNK && w.y >= oy && w.y < oy + CHUNK) {
      out.planets.push(w);
    }
    /* Ambient cloud. There used to be exactly one nebula in a sector, at the
       supernebula landmark, so a "clouded" world had nothing to show for it. */
    if (R() < 0.035 * ab("nebulae")) {
      const p = spot(700);
      if (p) {
        out.nebulae.push({ x: p.x, y: p.y, r: rnd(420, 900),
                           phase: R() * Math.PI * 2 });
      }
    }
    buildTraffic(cx, cy, R, rnd, deep, out, space);
    buildBattle(cx, cy, R, rnd, deep, out, space);
    if (R() < 0.05 * ab("wrecks")) {
      const p = spot(300);
      if (p) {
        out.wrecks.push({ x: p.x, y: p.y, a: R() * Math.PI * 2,
                          spin: rnd(-0.05, 0.05), size: rnd(0.8, 1.7) });
      }
    }

    /* A cache and its sentries. The guard is the point: salvage lying loose
       in open space is scenery, and salvage behind something that shoots is a
       decision. Two or three drones, posted rather than roaming — they hold
       station over the cache and go back to it when you leave. */
    if (R() < (0.05 + deep * 0.05) * ab("caches")) {
      const p = spot(520);
      if (p) {
        // One sentry near home, up to five at the far end.
        const n = 1 + Math.round(deep * 3) + (R() < 0.4 ? 1 : 0);
        const guards = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + R();
          guards.push({ x: p.x + Math.cos(a) * 300, y: p.y + Math.sin(a) * 300,
                        a });
        }
        // And they are worth more for it, or nobody would ever leave home.
        out.caches.push({ x: p.x, y: p.y, r: 46, guards, opened: false,
                          rich: deep > 0.55 && R() < deep,
                          phase: R() * Math.PI * 2 });
      }
    }

    /* Somewhere to spend it. Rare enough that finding one matters and common
       enough that a full hold is never a long walk home — and one is planted
       at the origin besides, so the first refit does not need luck. */
    if (R() < 0.032 * ab("stations")) {
      const p = spot(420);
      if (p) {
        /* A station flies the flag of whoever holds the sky it is in, or none.
           Read off the owner rather than rolled, so moving a border is what
           changes a dock's colours. */
        out.stations.push({ x: p.x, y: p.y, r: 132, phase: R() * Math.PI * 2,
                            faction: space.owner || "free" });
      }
    }

    // A drifting dead hull, big enough to hit and worth stripping.
    if (R() < (0.06 + deep * 0.07) * ab("wrecks")) {
      const p = spot(360);
      if (p) {
        /* Six, not four. They were meant to be harder work than a rock and
           were in practice unbreakable, which read as "tough" and was a bug;
           with the bug gone they would have been softer than they have felt
           for weeks. Six with damage counted means the starting cannon takes
           six hits and a rail lance takes two — a big gun should tell. */
        out.hulks.push({ x: p.x, y: p.y, r: rnd(52, 96), a: R() * Math.PI * 2,
                         spin: rnd(-0.12, 0.12), hp: 6 });
      }
    }
    /* Asteroid fields, out where the sector stops being tidy. Standing rock
       is the oldest hazard this game has and Survey only ever had a thin
       drifting population of it; a real field is somewhere you have to fly
       *through* rather than past. */
    /* And a tenth more of them, the other half of "more asteroids everywhere".
       `SURVEY_ROCKS` is the drifting population the streamer keeps around the
       ship, which is the map-wide density; this is how often a chunk holds a
       standing field, which is where the rock actually piles up. Moving only
       the first would have thickened the thin stuff and left the belts alone. */
    if (wild > 0.2 && R() < wild * 0.33 * ab("fields")) {
      const p = spot(700);
      if (p) {
        out.fields.push({ x: p.x, y: p.y, r: rnd(500, 900),
                          n: Math.round(rnd(10, 16 + wild * 14)) });
      }
    }
  }

  /* ── a station is somewhere ships pass through ──────────────────────────
     Not somewhere they collect. A chunk with a station in it is exactly the
     chunk most likely to have rolled traffic, so every shop in the sector had a
     permanent crowd loitering outside it doing nothing — which is both the
     wrong feeling and the thing that made the sector look busy everywhere that
     mattered.

     Thinned here rather than in the roll, because traffic is built before the
     stations are and cannot know yet. Keyed off the chunk's coordinates rather
     than off `R()`, so it takes nothing out of the chunk's random stream and
     every other thing in the sector is generated exactly as it was. */
  if (out.stations.length && out.traffic.length > 1) {
    const keep = 1 + (hash2(cx * 31, cy * 17) % 2);
    out.traffic.length = Math.min(out.traffic.length, keep);
  }

  /* The empty room. Emptied *here* — after the chunk has rolled and before
     its landmark is built — so the roll stays a pure function of the
     coordinates and the Leviathan still gets its own furniture. `gates` is
     replaced rather than truncated, because it arrives as the lattice's own
     array and truncating it would empty the lattice. See `LEV_ONLY`. */
  if (LEV_ONLY) {
    for (const k of ["hazards", "planets", "wrecks", "nebulae", "marks",
                     "caches", "stations", "hulks", "parts", "fields",
                     "traffic", "battles"]) {
      out[k].length = 0;
    }
    out.gates = [];
  }

  const lm = surv.landmarkAt.get(chunkKey(cx, cy));
  if (lm && (!LEV_ONLY || lm.key === "leviathan")) {
    buildLandmark(lm, out, R, rnd);
    /* Its holds stay and their **guards** do not. The caches are part of the
       authored interior — they are the reason the corridors go where they go,
       and hollowing them out would leave you looking at a shell of the thing
       rather than at the thing. The sentries posted on them are the other
       case: they are not structure, they are what would be shooting at you
       from a bulkhead while you were trying to look at the shape of it.

       Emptied at generation rather than swept up every frame, so no drone is
       ever posted in the first place — and it is the guard list that is
       cleared rather than the drones, because the streamer builds one from
       the other every time the chunk comes back. */
    if (LEV_ONLY) for (const c of out.caches) c.guards.length = 0;
  }

  /* A part brings the place its clue describes. Without this the clue would
     be decoration over whatever the chunk happened to roll, and "in the light
     of two suns" would be a lie about half the time. The scenery is forced,
     not hoped for. */
  const site = surv.partAt.get(chunkKey(cx, cy));
  /* A manifest part is gone once it is built into the gate or in your hands.
     A spare left lying out here — the tractor MK1 the arrow points at after
     the gate, and anything P4 scattered — is gone once it has been picked
     up, which is a different fact and a different set. Asking the site which
     kind it is beats keeping a list of keys that are really spares. */
  const done = site && (site.mod ? surv.lifted.has(site.id || site.key)
                                 : (surv.built.has(site.key) ||
                                    surv.carrying.has(site.key)));
  if (!LEV_ONLY && site && !done) {
    buildPartSite(site, out, R, rnd);
  }

  /* ── P4: something worth buying, lying out here ───────────────────────
     The shop's parts existed in exactly one place, which made the shop the
     only reason to have money and money the only reason to fly. A few of
     them are out in the dark as well now, on the same terms as anything
     else you find: no clue, no arrow, no entry in the manifest. You come
     across it or you do not.

     **Very hard to find**, which Ric asked for and which is the whole of
     why it is worth anything. One chunk in four hundred is a long way of
     flying — see the `scatter` check in test/survey.js for what that comes
     to in minutes — and a sector nobody has crossed twice will have handed
     you two or three.

     Rolled off its own stream rather than out of `R`. That matters more
     than it looks: `R` is the chunk's one sequence and everything above
     reads from it in order, so a roll taken from it here would shift every
     draw after it and quietly rebuild every sector that has ever existed —
     every chart, every pin, every yard site in every save. A separate stream
     off the same seed takes nothing from `R`.

     Measured rather than asserted: with the chance set to zero and then back,
     thirteen chunks in four thousand differ and the only field that differs
     in any of them is `parts`. The fingerprint does move — a chunk that now
     holds a part is genuinely a different chunk, and a gate that stayed quiet
     about new objects would not be worth having — but nothing *else* in it
     does. */
  if (!LEV_ONLY && surv && surv.lifted && (cx || cy)) {
    const LR = seeded(chunkSeed(cx, cy) ^ 0x5ca77e2);
    if (LR() < LOOSE_PART_CHANCE) {
      const id = cx + "," + cy + "p0";
      if (!surv.lifted.has(id)) {
        const pool = MODULES.filter(sellsIt);
        const m = pool[Math.min(pool.length - 1, Math.floor(LR() * pool.length))];
        /* Somewhere in the chunk that is not inside something. Eight tries
           and then nothing, the same rule everything else here follows —
           a part sealed inside a world is a part that cannot be collected. */
        for (let k = 0; k < 8; k++) {
          const px = ox + LR() * CHUNK, py = oy + LR() * CHUNK;
          if (built(px, py, 260)) continue;
          out.parts.push({ key: m.key, name: m.name, x: px, y: py, r: 40,
                           phase: LR() * Math.PI * 2, mod: true, site: id });
          break;
        }
      }
    }
  }
  return out;
}

function buildPartSite(site, out, R, rnd) {
  if (site.key === "spar") {
    out.hazards.length = 0;
    for (let i = 0; i < 9; i++) {
      out.wrecks.push({ x: site.x + rnd(-420, 420), y: site.y + rnd(-420, 420),
                        a: R() * Math.PI * 2, spin: rnd(-0.05, 0.05),
                        size: rnd(0.9, 2.0) });
    }
  } else if (site.key === "core") {
    out.hazards.length = 0;
    const bk = wellScale(wildAt(site.x, site.y), R);
    out.hazards.push(makeStar(site.x - 340 * bk, site.y - 90 * bk, R, bk),
                     makeStar(site.x + 340 * bk, site.y + 90 * bk, R, bk));
  } else if (site.key === "lens") {
    out.hazards.length = 0;                 // a rogue world has no sun, ever
    /* Clear of the part by its own radius and then some. It used to be pushed
       300 units away, which was fine when a planet was 190 across; at 620 the
       world simply contained the lens, and a solid body around a part is a
       part that cannot be collected. */
    const lensR = 620;
    out.planets.push(Object.assign(
      makeWorld(site.x + lensR + 520, site.y, R),
      { r: lensR, rogue: true, ring: 0, inhabited: false, air: false }));
  } else if (site.key === "coil") {
    // Both ends, so the coil's gate goes back the way every other one does.
    const L = coilLink(site);
    // Asked about where the mouth actually is, not about the middle of a
    // 48,000-unit lattice cell: a link can reach from ordinary space into an
    // empty one, and nothing goes in there.
    if (!regionOf(L.ax, L.ay).nothing) {
      out.gates.push({ x: L.ax, y: L.ay, phase: L.pa, tx: L.bx, ty: L.by });
    }
  } else if (site.key === "beacon") {
    out.wrecks.push({ x: site.x, y: site.y, a: R() * Math.PI * 2, spin: 0.02,
                      size: 2.2, beacon: true });
  }
  out.parts.push({ key: site.key, name: site.name, x: site.x, y: site.y,
                   r: site.r, phase: R() * Math.PI * 2,
                   /* A spare goes into the hold as a spare rather than onto
                      the manifest, and carries the id its site is remembered
                      by — see `surv.lifted`. */
                   mod: !!site.mod, site: site.mod ? (site.id || site.key) : null });
}

/* A landmark's own furniture. Each one is a thing the engine already knows
   how to draw, which is why an endless sector can afford landmarks at all. */
function buildLandmark(lm, out, R, rnd) {
  if (lm.key === "graveyard") {
    for (let i = 0; i < 7; i++) {
      out.wrecks.push({ x: lm.x + rnd(-340, 340), y: lm.y + rnd(-340, 340),
                        a: R() * Math.PI * 2, spin: rnd(-0.05, 0.05),
                        size: rnd(0.9, 1.9) });
    }
  } else if (lm.key === "last-transmission") {
    out.wrecks.push({ x: lm.x, y: lm.y, a: R() * Math.PI * 2, spin: 0.02,
                      size: 2.1, beacon: true });
  } else if (lm.key === "node-01") {
    out.wrecks.push({ x: lm.x, y: lm.y, a: R() * Math.PI * 2, spin: -0.014,
                      size: 1.9, node: true });
  } else if (lm.key === "rogue") {
    // A planet with no star, and the chunk's own roll is overruled so it
    // stays that way — the entry is the absence, not the planet.
    out.hazards.length = 0;
    /* Sized and named by hand. Both of these entries *are* their size — a
       rogue is a world with nothing warming it and the pale dot is a world you
       nearly miss — so neither may be handed the ordinary roll. They still
       want a face and a name, or they would be the only two anonymous worlds
       in the sector. */
    /* Sat on the landmark on purpose: arriving *is* finding it, and a landmark
       is found by being within `lm.r` of it — which for the rogue is 760,
       comfortably outside this. */
    out.planets.push(Object.assign(makeWorld(lm.x, lm.y, R), {
      r: 420, kind: "ash", rogue: true, ring: 0, inhabited: false, air: false
    }));
  } else if (lm.key === "pale-dot") {
    out.planets.push(Object.assign(makeWorld(lm.x, lm.y, R), {
      r: 26, kind: "ice", pale: true, ring: 0, bands: [], inhabited: false,
      air: false
    }));
  } else if (lm.key === "supernebula") {
    out.nebulae.push({ x: lm.x, y: lm.y, r: 1250, phase: R() * Math.PI * 2 });
  } else if (lm.key === "leviathan") {
    buildLeviathan(lm, out, R, rnd);
  } else if (lm.key === "vault") {
    buildVault(lm, out, R, rnd);
  } else if (lm.key === "the-wall") {
    /* This used to be four markers around an empty square and nothing else —
       Battle Royale's wall at the size it stops at, sitting in the middle of
       nowhere as a joke about a mode that has no wall. It was the weakest
       entry in the book: you flew a long way to a place where there was
       genuinely nothing, so finding it was an anticlimax and the almanac's
       promise of something to look at was a lie.

       So the square has a reason now. Somebody tried to *make* a wormhole
       here, on a frame that size, and it did not open. What is left is the
       frame's four anchors, the yards that built it collapsed against them,
       and a mouth at the middle that never finished forming — a dead gate that
       does not take you anywhere, because that is the whole point of it.

       The square stays exactly the size it was: it is the entry's silhouette,
       and it is also now the answer to "why is it square". */
    const half = (MODES.royale.arena.w * CLOSE_TO) / 2;
    const halfY = (MODES.royale.arena.h * CLOSE_TO) / 2;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sy] of corners) {
      out.marks.push({ x: lm.x + sx * half, y: lm.y + sy * halfY });
      // The construction yard at each anchor, wrecked where it stood.
      for (let i = 0; i < 3; i++) {
        out.wrecks.push({
          x: lm.x + sx * half + rnd(-320, 320),
          y: lm.y + sy * halfY + rnd(-320, 320),
          a: R() * Math.PI * 2, spin: rnd(-0.04, 0.04), size: rnd(1.1, 2.1)
        });
      }
    }
    /* Debris strung along the frame's edges — what was being assembled into
       it. Placed on the lines between the anchors rather than scattered, so
       the shape reads as a structure and not as a mess. */
    for (let i = 0; i < 14; i++) {
      const t = R();
      const side = Math.floor(R() * 4);
      const ax = corners[side][0] * half,        ay = corners[side][1] * halfY;
      const bx = corners[(side + 1) % 4][0] * half,
            by = corners[(side + 1) % 4][1] * halfY;
      out.wrecks.push({
        x: lm.x + ax + (bx - ax) * t + rnd(-140, 140),
        y: lm.y + ay + (by - ay) * t + rnd(-140, 140),
        a: R() * Math.PI * 2, spin: rnd(-0.06, 0.06), size: rnd(0.7, 1.5)
      });
    }
    // The mouth that never opened. `dead` means exactly that: it is drawn as a
    // gate coming apart and `surveyGates` refuses to transit it.
    out.gates.push({ x: lm.x, y: lm.y, phase: R() * Math.PI * 2,
                     tx: lm.x, ty: lm.y, dead: true });
  }
}

/* ── the Leviathan ────────────────────────────────────────────────────────
   The supermassive one, and the only landmark with an inside. Everything else
   out here is a thing you arrive at; this is a thing you go *into*.

   It is built as a hull of solid discs in two rows with the stern left open,
   which makes the corridor between them a real place rather than a drawn one:
   the same collision that stops you hitting the outside stops you scraping
   the walls on the way down the middle. The discs are the physics; the drawn
   silhouette is hung on the same spine, so what you see is where you crash.

   Deep inside, past its sentries, is the best salvage in the sector — which
   is the whole argument for flying 112,000 units to look at it. */
/* Nine thousand units stem to stern, which is three and a half times what it
   was and about the length of three chunks. At that size you cannot see both
   ends of it at once, which is the first thing that makes it read as a place
   rather than an object. */
/* Down 35% on Ric's call — she was 9,200 stem to stern and is 5,980. Every
   number in the builder is scaled by `LEV_S` off the same call rather than
   retyped, so the proportions are untouched: the mouths, the doorways, the
   jambs, the wings and the engines are all still the same fractions of her
   that they were, and one edit here moves the whole ship. */
const LEV_S    = 0.65;
const LEV_LEN  = Math.round(9200 * LEV_S);   // stem to stern
const LEV_BEAM = Math.round(1060 * LEV_S);   // half the beam at its widest
const LEV_SEG  = Math.round(170 * LEV_S);    // radius of one hull disc

/* ── the shape of it ───────────────────────────────────────────────────
   It did not look like a ship, and the plan view says why in one line: it was
   **a rectangle**. Two dead-straight flanks nine thousand units long, flat at
   both ends, with six identical square bays alternating down it — 7.4 to 1,
   with no bow, no stern and no taper. In plan that reads as a comb.

   The first pass at fixing it went too far the other way: a ten-point curve
   sampled into forty short plates, which came out smooth — and smooth in plan
   view is **a submarine**. This is a spacecraft, and it should look cut rather
   than moulded.

   So the hull is a **delta** — a dart, drawn from Ric's own sketch over the
   plan view: widest at the transom, narrowing the whole way forward, and
   finishing at a point. Four corners a side, each pair one long straight plate,
   and every meeting a hard chine you can see from a thousand units away. There
   is no waist and no shoulder; there is a broad square back end, one shallow
   run forward off it, a chine where the taper steepens, and a long dagger to
   the stem.

   The widest point being the *back* is most of what makes it read as going
   somewhere. A hull that bulges amidships is a boat.

   Fractions of `LEV_BEAM`, from the stern at -1 to the stem at +1. Keep them
   few. Every corner added here is a facet lost, and the facets are the
   design. */
const LEV_HULL = [
  [-1.00, 1.00],          // the transom, and it is the widest part of the ship
  [-0.52, 0.82],          // a shallow run forward off the stern quarter
  [ 0.16, 0.46],          // the chine: where the taper steepens into the bow
  [ 1.00, 0.00]           // and one straight run from there to the stem
];
// Half the beam at a point along the spine, `t` from -1 at the stern to +1.
// Linear between corners, which is what makes each run a flat facet.
function levBeam(t) {
  const P = LEV_HULL;
  if (t <= P[0][0]) return LEV_BEAM * P[0][1];
  for (let i = 1; i < P.length; i++) {
    if (t <= P[i][0]) {
      const f = (t - P[i - 1][0]) / (P[i][0] - P[i - 1][0]);
      return LEV_BEAM * (P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f);
    }
  }
  return LEV_BEAM * P[P.length - 1][1];
}

/* ── the Leviathan ────────────────────────────────────────────────────────
   The only landmark with an inside, and now the only one with an inside you
   can get lost in.

   It used to be a box with one straight corridor down the middle: you went in
   the stern, flew in a straight line, took three caches off the spine and
   turned around at the far wall. Eight seconds of decisions. The thing the
   whole manifest points at, and the best you could say about it was that it
   was long.

   What it is now, from the stern forwards:

     the throat     a wide mouth at the open stern quarter, on one flank
     five bulkheads across the spine, each with one doorway, and the doorways
                    alternate port and starboard — so the way in is a weave and
                    you always have to look for the next gap
     six bays       side chambers off the spine, alternating sides, each behind
                    its own short throat. Three of them hold something
     the hold       past the last bulkhead: a wide chamber at the bow with the
                    deepest cache, four sentries and the ablative plate

   **Every wall is both the drawing and the physics.** The old version hand-drew
   three plates and separately hand-placed the collision discs, which is two
   descriptions of one object and exactly the arrangement that lets a wall you
   can see stop being a wall you hit. A wall is a line in local space now; the
   discs are stamped along it and the renderer strokes the same list. They
   cannot disagree because there is only one of them. */
function buildLeviathan(lm, out, R, rnd) {
  const a = R() * Math.PI * 2;
  const ca = Math.cos(a), sa = Math.sin(a);
  // Local (u along the spine, v across it) into world.
  const wx = (u, v) => lm.x + u * ca - v * sa;
  const wy = (u, v) => lm.y + u * sa + v * ca;

  const segs = [];
  const walls = [];
  const half = LEV_LEN / 2;
  // The widest half-beam, amidships. Everything that asks "how far across is
  // this thing" still gets one number, and it is the biggest one.
  const flank = LEV_BEAM;
  const beamAt = u => levBeam(u / half);

  /* A run of hull along a line, in local coordinates. The discs overlap by a
     fifth so there is no gap for a nose to find, and the line is kept so the
     renderer can stroke exactly what was stamped. */
  /* A run of hull along a line. `r` is how thick the plate is, and it is not
     one number any more: every wall on the ship used to be the same 340 across,
     which is why the interior frames read as the same object as the bow armour
     and the whole thing looked stamped out rather than built. Armour is heavy
     where it is hit, structure is light where it is not, and the discs are the
     plate — so this is the collision as well as the drawing. */
  /* `k` is what this plate *is* — shell, frame, wing, engine, tear. The
     drawing needs it more than the physics does: every wall being stroked at
     the same weight is why the ship read as a bundle of grey pipes instead of
     as a body with structure inside it. The shell is the silhouette and gets
     the light; a bulkhead is furniture and belongs behind it. */
  const wall = (u0, v0, u1, v1, r, k) => {
    const t = r || LEV_SEG;
    const dx = u1 - u0, dy = v1 - v0;
    const len = Math.hypot(dx, dy);
    const n = Math.max(1, Math.ceil(len / (t * 1.15)));
    for (let i = 0; i <= n; i++) {
      const u = u0 + dx * (i / n), v = v0 + dy * (i / n);
      segs.push({ x: wx(u, v), y: wy(u, v), r: t });
    }
    walls.push({ u0, v0, u1, v1, r: t, k: k || "shell" });
  };
  /* How thick the shell is at a station. Heaviest at the stem, where anything
     this ship ever met was in front of it; lightest at the tail, which is all
     engine and nothing worth armouring. */
  const shell = u => LEV_SEG * (0.82 + 0.5 * Math.max(0, u / half + 0.35));
  const FRAME = LEV_SEG * 0.62;          // an internal bulkhead
  const RIB   = LEV_SEG * 0.72;          // a wing

  /* ── the bays, decided first ────────────────────────────────────────────
     Where they are has to be known before the flanks are built, because a bay
     is a hole in a flank and the flank is what has to be built around it. The
     first version of this laid the flanks down solid and then put the bays
     outside them, which produced six side chambers with no way in: they drew
     correctly, they had caches in them, and the caches were unreachable. The
     flood-fill test is what found it — a centreline walk never could have.

     **Four, in two opposed pairs — wings, not a comb.** Six identical squares
     alternating down a straight hull is what made the thing read as a zip
     fastener. A pair of big swept wings off the broad after quarter and a
     smaller pair further forward is a shape with an axis: symmetrical, raked,
     and unmistakably pointing somewhere. Nothing goes forward of the chine,
     because that is where the hull is narrowing and a box hanging off a taper
     looks like a mistake. */
  const bays = [
    // The hangars: long roots, hard sweep, and the reason the silhouette works.
    { at: -0.66, side: -1, hw: 760 * LEV_S, depth: 1240 * LEV_S, rake: 0.62 },
    { at: -0.66, side:  1, hw: 760 * LEV_S, depth: 1240 * LEV_S, rake: 0.62 },
    // And a forward pair that is not a smaller copy of them: short, tucked in
    // against the hull, barely swept — they read as sponsons rather than wings,
    // which is what stops the four of them looking like a repeated stamp.
    { at: -0.08, side: -1, hw: 380 * LEV_S, depth: 560 * LEV_S, rake: 0.12 },
    { at: -0.08, side:  1, hw: 380 * LEV_S, depth: 560 * LEV_S, rake: 0.12 }
  ].map(b => {
    const u = b.at * half;
    const root = beamAt(u);
    /* The cache goes *inboard* of the middle. A wing is swept, so its forward
       half is cut away by the raked leading edge — a spot at the geometric
       centre of the box can be inside a plate, which is the "buried in its
       hull" failure. A third of the way out, on the bay's own centreline, is
       open in any rake. */
    return { u, side: b.side, hw: b.hw, depth: b.depth, root,
             rake: b.rake === undefined ? 0.3 : b.rake,
             v: b.side * (root + b.depth * 0.38) };
  });
  // The same rule: a mouth is only a mouth if it is wider than the plates it
  // is cut between. See `STERN_GAP`.
  const MOUTH = Math.max(300 * LEV_S, LEV_SEG * 1.25 + 120);                     // half the width of the way into one

  /* ── the flanks ──────────────────────────────────────────────────────
     **One plate per facet.** A run is broken only where the hull actually has
     a corner in it, or where a bay takes a bite out of it — never into even
     steps, because a facet chopped into a dozen short plates with a rounded
     cap on each is how the first attempt at this came out looking like a
     submarine. A plate is what the renderer strokes and what the ship hits, so
     a long flat one is a long flat surface.

     The stern quarter of the starboard flank is the way in, and it is on the
     same side every time so the ship has a door rather than a lottery. */
  const door0 = -half, door1 = -half * 0.62;
  // Where the shell is torn open. Decided here because the flank run has to
  // leave the hole; the torn plates themselves are stamped further down.
  /* 260 either side, not 430. At 860 across it stopped reading as a hole and
     started reading as a section of hull nobody had built — the eye needs
     intact plate on both sides of a wound to know it is a wound. */
  const wrecked = !LEV_INTACT;
  const scar = wrecked
    ? { u: -half * 0.34 + rnd(-260, 260) * LEV_S, side: -1, hw: 260 * LEV_S }
    : { u: 0, side: 0, hw: 0 };          // she is whole: nothing is missing
  const flankRun = (side, from, to) => {
    /* Every corner of the hull between the ends, and every bay mouth, is a
       break in the run. Sorted and walked once: between two consecutive breaks
       the hull is a straight line, which is exactly one plate. */
    const breaks = [from, to];
    for (const c of LEV_HULL) {
      const u = c[0] * half;
      if (u > from && u < to) breaks.push(u);
    }
    const skip = [];
    const gaps = bays.filter(b => b.side === side)
                     .map(b => [b.u - MOUTH, b.u + MOUTH]);
    // And the breach, which is a hole in the shell rather than a door in it.
    if (scar.side === side) gaps.push([scar.u - scar.hw, scar.u + scar.hw]);
    for (const g of gaps) {
      const a0 = g[0], a1 = g[1];
      if (a1 <= from || a0 >= to) continue;
      skip.push([Math.max(from, a0), Math.min(to, a1)]);
      if (a0 > from && a0 < to) breaks.push(a0);
      if (a1 > from && a1 < to) breaks.push(a1);
    }
    breaks.sort((x, y) => x - y);
    for (let i = 1; i < breaks.length; i++) {
      const u0 = breaks[i - 1], u1 = breaks[i];
      if (u1 - u0 < 1) continue;
      const mid = (u0 + u1) / 2;
      if (skip.some(sk => mid > sk[0] && mid < sk[1])) continue;   // a mouth
      wall(u0, side * beamAt(u0), u1, side * beamAt(u1), shell(mid), "shell");
    }
  };
  flankRun(-1, -half, half);
  flankRun(1, door1, half);

  /* ── every opening gets a jamb ──────────────────────────────────────────
     A run of plate that simply stops in mid-air reads as a line somebody cut,
     not as a way in. Real structure finishes its edges: a hangar mouth has a
     lip, a doorway has a post, a hatch has a frame — and the eye knows the
     difference immediately even when it could not say why.

     So every deliberate opening is closed off with a short plate turned
     inboard. It is geometry rather than decoration, so the jamb is something
     you can scrape your hull on, which is what an opening in a real ship does
     to you.

     The **tears** are pointedly left ragged. A wound is the one place on this
     ship where an unfinished edge is the correct edge, and the contrast is
     what tells you which openings were built and which were made. */
  /* Sized to what it is framing. One 250-unit lip on everything choked the
     small forward sponsons — their whole chamber is 560 deep — and the flood
     fill found it: the port one became unreachable. A hatch gets a hatch's
     lip. Thinner than a frame, too: a jamb is a finishing piece, not
     structure, and a fat one eats the opening it is supposed to describe. */
  const JAMB = 250 * LEV_S;
  const jamb = (u, v, du, dv) => wall(u, v, u + du, v + dv, LEV_SEG * 0.55, "jamb");
  for (const b of bays) {
    const len = Math.min(JAMB, b.depth * 0.22);
    jamb(b.u - MOUTH, b.side * beamAt(b.u - MOUTH), 0, -b.side * len);
    jamb(b.u + MOUTH, b.side * beamAt(b.u + MOUTH), 0, -b.side * len);
  }
  // The forward post of the door, and the two edges of the stern opening.
  jamb(door1, beamAt(door1), 0, -JAMB);

  /* ── the transom, and the engines hanging off it ───────────────────────
     A ship has a back. The old one simply stopped, which is most of why it
     read as a length of corridor rather than as a vessel — and it left the
     whole stern face open, so the "door" was not a door, it was one of two
     ways in.

     Three throats stand aft of it. They are structure, so they are walls like
     everything else, and in plan they are the one silhouette nobody mistakes
     for anything else. */
  const transom = beamAt(-half);
  /* With a gap on the centreline. A ship arrives at this thing from astern and
     the stern is where it looks for a way in — sealing the transom outright
     made the whole interior unreachable from the only direction anybody
     approaches from, which the flood-fill test caught on the first run. So the
     transom is a face with a hole in the middle of it, between the engines,
     and the starboard quarter is still the obvious door. */
  /* Stepped. A single flat wall across the back is the one part of a hull
     nobody ever built flat — the corners return forward into the flank, which
     is what gives a stern its shoulders, and in plan it is the difference
     between a ship and a slab. */
  /* An opening has to be measured against the **plate**, not against the
     ship. Scaling the whole hull by 0.65 took this gap from 300 to 195 while
     the transom plate it is cut into stayed 122 across its radius — so the
     clear way through went from 113 a side to 73, and the stern stopped being
     a way in at all. The flood fill said so immediately: nothing inside was
     reachable, at the first size where the two numbers crossed.

     So the gap is whichever is larger, the proportional figure or one wide
     enough to actually fly through. */
  const STERN_GAP = Math.max(300 * LEV_S, LEV_SEG * 1.1 + 140);
  const STEP_IN = 300 * LEV_S, STEP_UP = 260 * LEV_S;
  // The lips of the way through the transom, finished like every other opening.
  jamb(-half, STERN_GAP, JAMB, 0);
  jamb(-half, -STERN_GAP, JAMB, 0);
  for (const side of [-1, 1]) {
    wall(-half, side * STERN_GAP, -half, side * (transom - STEP_UP),
         LEV_SEG * 1.1, "shell");
    /* Landing exactly where the flank is, not at the transom's own width.
       The two differ by 25 units at that station and the mismatch is the kink
       above the engine — a corner that looks like a mistake because it is
       one. */
    wall(-half, side * (transom - STEP_UP),
         -half + STEP_IN, side * beamAt(-half + STEP_IN), LEV_SEG * 1.1, "shell");
  }
  /* **Two, not three.** The third sat on the centreline, and its own walls
     closed the gap in the transom that the centreline exists to be — measured,
     not guessed: the cell at the middle of the stern face came back blocked and
     the flood fill never started, so the whole interior was unreachable from
     the one direction anybody arrives from. Two big bells either side of an
     open throat is the better shape anyway. */
  const ENG_HW = 190 * LEV_S, ENG_OUT = 620 * LEV_S;
  for (const k of [-1, 1]) {
    const v0 = k * transom * 0.56;
    wall(-half, v0 - ENG_HW, -half - ENG_OUT, v0 - ENG_HW, RIB, "engine");
    wall(-half, v0 + ENG_HW, -half - ENG_OUT, v0 + ENG_HW, RIB, "engine");
    wall(-half - ENG_OUT, v0 - ENG_HW, -half - ENG_OUT, v0 + ENG_HW, RIB, "engine");
  }

  /* ── the bulkheads, and the doorways through them ───────────────────────
     Five walls across the corridor, each with one gap. The gaps alternate
     sides, so getting to the bow is a weave rather than a straight line — and
     so a ship that is bigger than the gap has to be flown, not aimed.

     Cut to the local beam rather than to a constant, so the forward ones are
     short and the after ones are long — which is what makes the inside feel
     like a hull narrowing towards a stem. */
  /* **A bulkhead may never seal the ship.** The doorway used to be placed at
     `beam - GAP - SEG` and clamped up to a floor — which on a hull that
     narrows means the two arithmetic ends cross over, and the wall either side
     of the "gap" is then stamped *backwards across it*. The result draws as a
     doorway and is solid, and every cache forward of it becomes unreachable:
     the flood-fill test found four at once.

     So the gap is placed inside the hull it is actually crossing, and where
     the hull is too narrow to hold a wall and a doorway at all, there is no
     bulkhead — a ship's frames stop before the stem for the same reason. */
  const GAP = 300 * LEV_S;                       // clear half-width of a doorway
  const bulk = [];
  for (let i = 0; i < 5; i++) {
    const u = -half * 0.36 + (i / 5) * (half * 1.22);
    const side = i % 2 ? 1 : -1;         // which flank the gap is against
    const b = beamAt(u);
    /* The real floor, derived rather than guessed: the inboard wall exists
       while `-b < gapMid - GAP`, which works out at `b > GAP + SEG/2`. A
       rounder, larger number looked safe and quietly deleted four of the five
       frames — the whole weave — so it is the arithmetic. */
    if (b < GAP + FRAME * 1.3) continue;       // too fine forward for a frame
    const gapMid = side * (b - GAP - LEV_SEG);
    bulk.push({ u, gapMid });
    const lo = gapMid - GAP, hi = gapMid + GAP;
    if (lo > -b) wall(u, -b, u, lo, FRAME, "frame");
    if (hi < b) wall(u, hi, u, b, FRAME, "frame");
    // A door in a bulkhead has posts, the same as one in the shell does.
    if (lo > -b) jamb(u, lo, JAMB * 0.7, 0);
    if (hi < b) jamb(u, hi, -JAMB * 0.7, 0);
  }

  /* ── the bays themselves ────────────────────────────────────────────────
     Side chambers off the spine, each a short throat opening into a room. They
     are the reason to slow down: the way to the bow does not go through any of
     them, so every one is a decision to spend time. */
  /* Swept, not square. A box hanging off the side is a box hanging off the
     side; the same chamber with its leading edge raked aft reads as a fin, and
     four fins are most of what makes the silhouette look like it was going
     somewhere. The trailing edge stays square to the hull so the room inside
     is still a room you can turn round in. */
  const sheared = wrecked ? bays[3] : null;   // the starboard forward sponson
  for (const b of bays) {
    const outer = b.side * (b.root + b.depth);
    const tip = b.u + b.hw * b.rake;              // the swept forward corner
    if (b === sheared) {
      // Torn off at the root: a trailing edge, and a bitten stump of the face.
      const stub = b.side * (b.root + b.depth * 0.34);
      wall(b.u - b.hw, b.side * b.root, b.u - b.hw, stub, RIB, "wing");
      wall(b.u - b.hw, stub, b.u - b.hw * 0.2,
           b.side * (b.root + b.depth * 0.16), LEV_SEG * 0.5, "tear");
      continue;
    }
    wall(b.u - b.hw, b.side * b.root, b.u - b.hw, outer, RIB, "wing");
    wall(b.u + b.hw, b.side * b.root, tip, outer, RIB, "wing");
    wall(b.u - b.hw, outer, tip, outer, RIB, "wing");
  }

  /* ── the hold ───────────────────────────────────────────────────────────
     Past the last bulkhead and *behind the taper*: the space the whole flight
     was for has to be a room, and 170×3.2 from the stem is a wedge 265 units
     across — which was fine when the hull was a rectangle and every point on
     it was the same width. It sits where the forward body is still most of
     full beam instead. */
  /* ── what killed it ────────────────────────────────────────────────────
     Everything above builds a ship that is intact, symmetrical and fine, and
     the one thing this ship indisputably is, is **dead**. A derelict that is
     perfect down both sides is a model of a ship; the damage is what makes it
     a wreck, and it is the cheapest character in the whole structure.

     Two injuries, both structural rather than drawn, so they are things you
     can fly into and through rather than marks on a picture:

       the breach   a span of the port flank forward of the hangar is simply
                    gone, with two torn plates splayed out of the hole. It is a
                    second way in, which is the good kind of damage: it changes
                    how the place is used rather than only how it looks.
       the stub     the starboard forward sponson is sheared off at the root.
                    What is left is its trailing edge and a bitten-off stump,
                    and the asymmetry that buys is worth more than the sponson
                    was.

     Where the breach falls comes off the seed, so one sector's wreck is not
     another's — but *that there is one* does not, because a hull that is
     sometimes intact is a hull with no story. */
  if (wrecked) {
    const b0 = beamAt(scar.u - scar.hw), b1 = beamAt(scar.u + scar.hw);
    wall(scar.u - scar.hw, scar.side * b0,
         scar.u - scar.hw - 250 * LEV_S, scar.side * (b0 + 430 * LEV_S),
         LEV_SEG * 0.55, "tear");
    wall(scar.u + scar.hw, scar.side * b1,
         scar.u + scar.hw + 180 * LEV_S, scar.side * (b1 + 300 * LEV_S),
         LEV_SEG * 0.55, "tear");
  }

  /* ── what came off her ──────────────────────────────────────────────────
     Pieces of the ship, loose, inside and out. A wreck with a clean hole in it
     and nothing around it is a hull with a hole in it; the debris is what says
     something *happened* here — and it is the first thing on this structure
     that moves, which after nine thousand units of perfectly still metal is
     most of the effect.

     They drift rather than fly: each piece swings a little way along its own
     axis and turns at its own rate, driven straight off the clock. No state,
     no list to update, nothing to stream — a fragment is a function of time,
     so it costs the same whether you are looking at it or not and it cannot
     drift out of the sector while you are away.

     Not solid, deliberately. A tumbling shard that could seal a corridor is a
     room the flood fill would have to argue with every frame, and the one
     thing worse than a wreck with no debris is a wreck you cannot get into. */
  const debris = [];
  if (wrecked) {
    const pieces = 26;
    for (let i = 0; i < pieces; i++) {
      const inside = i % 3 !== 0;          // two thirds of it still aboard
      const u = rnd(-half * 0.95, half * 0.62);
      const room = beamAt(u);
      const v = inside
        ? rnd(-room * 0.72, room * 0.72)
        : (R() < 0.5 ? -1 : 1) * rnd(room + 90 * LEV_S, room + 780 * LEV_S);
      debris.push({
        u, v,
        len: rnd(40, 190) * LEV_S,         // a shard, not a plate
        a: R() * Math.PI * 2,
        spin: rnd(-0.5, 0.5),
        amp: rnd(18, 70) * LEV_S,          // how far it wanders
        w: rnd(0.08, 0.26),                // and how slowly
        phase: R() * Math.PI * 2,
        heavy: R() < 0.3                   // a few are big enough to read
      });
    }
  }

  /* Just aft of the chine. On a delta the whole forward third is a spike —
     at 0.72 of the half-length the hull is 162 units across and a cache placed
     there is *inside the plates*, which is exactly what the "buried in its
     hull" check reported. This is the forward end of the part of the ship that
     is a room rather than an edge. */
  const holdU = half * 0.12;

  /* ── the outline, as data ───────────────────────────────────────────────
     Both the renderer and the plan-view page need the silhouette, and neither
     of them may guess it. It used to be guessed — the drawing filled a
     rectangle from stern to stem at a constant beam, which was true of a
     rectangle and is a lie about a hull. So the shape is built here, once, and
     everything that needs it reads it.

     Port side stern-to-stem, then starboard back, so it closes as one polygon.
     The bays are not in it: they are drawn from their own boxes, because a
     sponson is a thing stuck on the side rather than part of the waterline. */
  const outline = [];
  for (let i = 0; i <= 48; i++) {
    const u = -half + (LEV_LEN * i) / 48;
    outline.push({ u, v: -beamAt(u) });
  }
  for (let i = 48; i >= 0; i--) {
    const u = -half + (LEV_LEN * i) / 48;
    outline.push({ u, v: beamAt(u) });
  }

  out.leviathan = { x: lm.x, y: lm.y, a, ca, sa, segs, walls, outline,
                    len: LEV_LEN, beam: LEV_BEAM, flank, transom, hold: holdU,
                    wrecked, debris,
                    engine: { hw: ENG_HW, out: ENG_OUT, at: transom * 0.58 },
                    door: [door0, door1], bulk, bays,
                    phase: R() * Math.PI * 2 };

  /* What is inside. Three of the six bays hold a cache with its own sentries,
     and the hold at the bow holds the richest one — the reward for going all
     the way through the weave rather than reaching through the door.

     Placed from the layout rather than by eye. The old version put its caches
     at hand-picked fractions of the length and one of them landed *inside* the
     bow cap, where it could be seen and never reached; the test that walks the
     inside is what caught it. Nothing here is a guess: a bay's cache sits at
     the middle of that bay, which is a place the geometry says is open. */
  /* One in all but one of the bays, and the richest in the hold. It used to
     index bays 0, 3 and 4 of six; there are four now, and an index into a list
     whose length is a design decision is a bug waiting for the next edit — so
     it takes every bay but the second and adds the hold. */
  /* Every bay that is still a room, and the hold. The sheared sponson is not
     one — a cache in a chamber that is open to space is the same class of
     mistake as the one in the bow cap, and this time the geometry says so up
     front rather than leaving the flood fill to find it. */
  const spots = bays.filter(b => b !== sheared)
                    .concat([{ u: holdU, v: 0, deep: true }]);
  spots.forEach((spot, i) => {
    const deep = i === spots.length - 1;
    const cx2 = wx(spot.u, spot.v), cy2 = wy(spot.u, spot.v);
    const n = deep ? 4 : 2;
    const guards = [];
    for (let g = 0; g < n; g++) {
      const ga = (g / n) * Math.PI * 2;
      guards.push({ x: cx2 + Math.cos(ga) * 190, y: cy2 + Math.sin(ga) * 190, a: ga });
    }
    out.caches.push({ x: cx2, y: cy2, r: 46, guards, opened: false,
                      rich: deep, phase: R() * Math.PI * 2 });
  });

  // The last part of the manifest, in the hold, behind four sentries. It is
  // the only one that is not a flight but a raid.
  const plate = BUILD.find(b => b.inside === "leviathan");
  if (plate && !surv.built.has(plate.key) && !surv.carrying.has(plate.key)) {
    out.parts.push({ key: plate.key, name: plate.name, r: 40,
                     x: wx(holdU - 260, 0), y: wy(holdU - 260, 0),
                     phase: R() * Math.PI * 2 });
  }
}

/* ── the Vault ────────────────────────────────────────────────────────────
   The second place you fly into, and deliberately not a second Leviathan. The
   Leviathan is a *wreck*: a thing that died and is being picked over, and its
   inside is a corridor with rooms off it. The Vault is a thing somebody **built
   to keep people out**, and its inside is a problem.

   A square hull with one way in, and inside it a ring corridor around a core.
   The ring has four spokes running inward and three of them are blind: they end
   in a wall, and the fourth is the way into the core. Which one is the real one
   changes with the sector, so nobody can be told the answer.

   Built from the same `wall` primitive the Leviathan uses, for the same reason:
   the discs are the physics, the line list is the drawing, and there is only one
   of them so they cannot disagree. That primitive existing is most of why this
   was an afternoon rather than a week, which is the argument for authored places
   in 6.6 — the second one is cheap once the first has paid for the machinery.

   **Every opening is sized against the discs, not against the line.** A wall is
   drawn as a line and *is* a row of 150-unit discs, so a gap that looks 350
   wide on the drawing is 50 wide to a hull. That is how the Vault shipped with
   no way in: the inner shell's gaps and the core's mouth were both narrower
   than a ship once the discs were counted, every spoke was blind, and the best
   cache in the sector sat behind a door that did not open (A3, found by the
   same flood fill that keeps the Leviathan honest, 2026-09-24). The numbers
   below are the clear widths, with the discs already subtracted. */
const VAULT_R  = 2300;    // half the width of the box
const VAULT_SEG = 150;

function buildVault(lm, out, R, rnd) {
  const a = R() * Math.PI * 2;
  const ca = Math.cos(a), sa = Math.sin(a);
  const wx = (u, v) => lm.x + u * ca - v * sa;
  const wy = (u, v) => lm.y + u * sa + v * ca;
  const segs = [], walls = [];
  const wall = (u0, v0, u1, v1) => {
    const dx = u1 - u0, dy = v1 - v0;
    const len = Math.hypot(dx, dy);
    const n = Math.max(1, Math.ceil(len / (VAULT_SEG * 1.15)));
    for (let i = 0; i <= n; i++) {
      segs.push({ x: wx(u0 + dx * (i / n), v0 + dy * (i / n)),
                  y: wy(u0 + dx * (i / n), v0 + dy * (i / n)), r: VAULT_SEG });
    }
    walls.push({ u0, v0, u1, v1 });
  };

  const S = VAULT_R;                 // the outer shell
  const RING = S * 0.55;             // the inner shell, making the ring corridor
  const CORE = S * 0.26;             // the vault itself
  const MOUTH = 330;                 // half the width of the one way in

  // ── the shell, with one gate in the middle of one side ─────────────────
  const door = Math.floor(R() * 4);  // which side it is on
  const side = (k, cut) => {
    // k: 0 top, 1 right, 2 bottom, 3 left, in local coordinates.
    const pts = [[-S, -S, S, -S], [S, -S, S, S], [S, S, -S, S], [-S, S, -S, -S]][k];
    if (!cut) { wall(pts[0], pts[1], pts[2], pts[3]); return; }
    const mu = (pts[0] + pts[2]) / 2, mv = (pts[1] + pts[3]) / 2;
    const dx = pts[2] - pts[0], dy = pts[3] - pts[1];
    const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    wall(pts[0], pts[1], mu - ux * MOUTH, mv - uy * MOUTH);
    wall(mu + ux * MOUTH, mv + uy * MOUTH, pts[2], pts[3]);
  };
  for (let k = 0; k < 4; k++) side(k, k === door);

  /* ── the inner shell, and the four spokes ──────────────────────────────
     The ring between the two shells is the corridor. Each spoke is a pair of
     walls running inward from the inner shell with a gap in the shell behind
     it; three of them end in a wall and one opens into the core. */
  const real = Math.floor(R() * 4);
  const SPOKE = 300;                 // half the width of a spoke: 300 clear inside
  /* The inner shell opens where a spoke meets it, and the opening has to be at
     least as wide as the spoke's outer edges (SPOKE + VAULT_SEG each side) or
     the spoke is sealed at its own mouth. As an angle on the shell, with a
     little over. */
  const GAP = Math.asin((SPOKE + VAULT_SEG + 40) / RING);
  for (let k = 0; k < 4; k++) {
    const ang = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const nx = Math.cos(ang), ny = Math.sin(ang);
    const tx = -ny, ty = nx;         // across the spoke
    /* The inner shell, in four arcs with a gap at each spoke. The arc runs
       from just past this spoke to just short of the next one — it used to be
       centred ON the spoke, which put the gaps between the spokes (facing
       the ring caches) and a solid wall across every spoke's mouth. */
    const A0 = ang + GAP, A1 = ang + Math.PI / 2 - GAP;
    let pu = Math.cos(A0) * RING, pv = Math.sin(A0) * RING;
    for (let t = 1; t <= 8; t++) {
      const aa = A0 + (A1 - A0) * (t / 8);
      const qu = Math.cos(aa) * RING, qv = Math.sin(aa) * RING;
      wall(pu, pv, qu, qv);
      pu = qu; pv = qv;
    }
    // The spoke's two walls, from the inner shell down to the core.
    for (const sgn of [-1, 1]) {
      wall(nx * RING + tx * SPOKE * sgn, ny * RING + ty * SPOKE * sgn,
           nx * CORE + tx * SPOKE * sgn, ny * CORE + ty * SPOKE * sgn);
    }
    // And the cap at the bottom of it — on every spoke but the real one.
    if (k !== real) {
      wall(nx * CORE - tx * SPOKE, ny * CORE - ty * SPOKE,
           nx * CORE + tx * SPOKE, ny * CORE + ty * SPOKE);
    }
  }

  /* ── the core wall ─────────────────────────────────────────────────────
     A ring around the middle, open only where the real spoke meets it. The
     mouth is the spoke's own clear width plus a disc each side, as an angle
     on the core — 0.30 rad here was 27 units of daylight. */
  const realAng = (real / 4) * Math.PI * 2 + Math.PI / 4;
  const MOUTH_A = Math.asin(Math.min(0.95, (SPOKE + 60) / CORE));
  let cu = null, cv = null, first = null;
  for (let t = 0; t <= 48; t++) {
    const aa = (t / 48) * Math.PI * 2;
    let d = aa - realAng;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const open = Math.abs(d) < MOUTH_A;
    const qu = Math.cos(aa) * CORE, qv = Math.sin(aa) * CORE;
    if (!open && cu !== null) wall(cu, cv, qu, qv);
    cu = open ? null : qu; cv = open ? null : qv;
    if (t === 0) first = [qu, qv];
  }

  out.vault = { x: lm.x, y: lm.y, a, ca, sa, segs, walls, r: S, ring: RING,
                core: CORE, door, real, phase: R() * Math.PI * 2 };

  /* What is in it. The core holds the best sealed hold in the sector; the ring
     holds two more behind their own sentries, so the trip is worth making even
     if you never work out which spoke is the real one. */
  const put = (u, v, rich) => {
    const px = wx(u, v), py = wy(u, v);
    const n = rich ? 5 : 2;
    const guards = [];
    for (let g = 0; g < n; g++) {
      const ga = (g / n) * Math.PI * 2;
      guards.push({ x: px + Math.cos(ga) * 200, y: py + Math.sin(ga) * 200, a: ga });
    }
    /* `quiet` on the core's post: its sentries do not wake up for somebody
       walking the ring. They wake when you come down a spoke for the middle,
       which is the moment the place stops being a curiosity and starts being a
       robbery — and you are told, once, before it happens. */
    out.caches.push({ x: px, y: py, r: 46, guards, opened: false, rich,
                      quiet: rich, phase: R() * Math.PI * 2 });
  };
  put(0, 0, true);
  const ringAt = k => {
    const aa = (k / 4) * Math.PI * 2;          // between the spokes
    return [Math.cos(aa) * (RING + (S - RING) * 0.5),
            Math.sin(aa) * (RING + (S - RING) * 0.5)];
  };
  put(...ringAt(1), false);
  put(...ringAt(3), false);
}
