"use strict";

/* KONDRITE — SURVEY — OUTFITTING
   ─────────────────────────────────────────────────────────────────────────────
   Two axes, life support, the furniture of a world, worlds and where they
   may stand, cargo, the refit, parts and their slots, weights, and the
   devices you press: grapple, cloak, EMP.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── two axes, and the one number that is not written down ────────────────
   Ric flew the roster again and the verdict was that the ships need to be
   *crazy*, with the Jackal as the example: "you go right and it goes right
   almost instantly". The reason nothing felt like that is visible in the
   table it replaced — `drag` had seven values across twenty-five hulls, one
   per category, and `accel` tracked it almost exactly. Handling was one
   ladder with everything strung along it, so every hull was a point on the
   same line and a category was a stretch of that line. Faster meant twitchier
   and slower meant floatier, always, and there was no third thing a hull
   could be.

   There are two axes now and they are deliberately uncorrelated:

     speed   how fast you can eventually go
     drag    how hard the ship is *glued to where you point it*

   Drag is not friction any more, it is **grip**, and it is the whole of what
   Ric was asking for. It sets how long the old heading survives a turn: the
   velocity decays by `exp(-drag·dt)`, so a hull's memory of where it was
   going is 1/drag seconds long. The Jackal's is 0.08 of a second — you turn,
   and the ship is already going the new way. A Gantry's is nineteen seconds,
   and steering one is steering a building.

   That the two axes cross is the point, and it is what the old ladder could
   not express. A sport hull is now *fast and floaty* — enormous top speed, a
   razor turn, and a second and a half of drift that makes every corner a
   commitment. A courier is fast and glued. The Jackal is not especially
   quick and it is welded to your hands. Four corners instead of one line.

   `accel` is no longer a column. It is what it always actually was — the
   thrust needed to reach this hull's own top speed against this hull's own
   grip — so it is derived here rather than kept in step by hand, which is the
   failure this file has shipped more than once.

   Headroom is how far past its stated ceiling a hull could theoretically
   push. Above 1 the ship truly arrives at its top speed instead of
   asymptoting under it forever, and the margin is what the last tenth of the
   throttle is doing.

   It is not one number, and the reason is a mistake worth keeping written
   down. A flat headroom makes thrust fall out as `cap · drag`, which ties the
   size of a hull's engine to the shortness of its drift — so every floaty
   hull got a feeble engine, and a Drayman that used to climb out of a
   gravity well was quietly no longer able to. That is not what heavy means.
   A barge has a *big* engine and enormous inertia; the engine is why it gets
   going at all and the inertia is why it cannot stop.

   So headroom rises as grip falls. The floatiest hulls push nearly three
   times as hard past their ceiling as the gluey ones, which buys them an
   engine that can fight gravity while leaving the long drift — the thing
   that makes them barges — completely untouched, because drift is `drag`
   alone and nothing here changes it. */
const SHIP_HEADROOM = drag => {
  const t = Math.min(1, Math.max(0, Math.log(2 / drag) / Math.log(2 / 0.045)));
  return 1.6 + 2.6 * t;
};
for (const sh of SHIPS) {
  Object.assign(sh, HULL_ART[sh.key]);
  /* `punch` overrides the curve where a hull is meant to feel eager out of
     proportion to its grip. The sport hulls are the reason it exists: Ric
     wants them "easy to get to speed but they should really slide", and those
     are the same number — grip decides both how fast you arrive at your top
     speed and how long you carry it afterwards, so a slidey hull is a sluggish
     one and there is no way round that from drag alone. A big engine is the
     way round it. Punch 6 against a grip of 0.3 reaches the ceiling in six
     tenths of a second and still takes eight seconds to give the speed back. */
  sh.accel = +(sh.speed * MAX_SPEED * sh.drag / THRUST *
               (sh.punch || SHIP_HEADROOM(sh.drag))).toFixed(3);
  /* Where this hull's engine and its nose actually are, in the same 12-unit
     space the outline is drawn in. The exhaust used to come out at one ship
     *radius* behind the middle, which is only the back of the ship for a hull
     whose outline happens to be twelve units long — the stock triangle. The
     Tender reaches twenty-four units back, so its flame was burning inside
     the middle of the hull, and Ric said so: "the flame is in the wrong spot
     for him." It comes out of the back of whatever you are flying now. */
  const art = sh.art || [[12, 0], [-12, 0]];
  const xs = art.map(p => p[0]);
  sh.tailX = Math.min(...xs);
  sh.noseX = Math.max(...xs);
  /* Where the rounds come out. The end of each drawn barrel; a beam hull's
     emitter in its bow throat; and a hull with no guns drawn fires from its
     nose. Rounds used to leave one stock radius ahead of the middle whatever
     the hull, which on anything bigger than a Skiff was somewhere inside it,
     nowhere near a gun. */
  sh.muzzles = sh.muzzles ||
    (sh.guns ? sh.guns.map(g => [g[0] + (g[2] || 5), g[1]]) : [[sh.noseX, 0]]);
  /* And how big a circle this outline really is. Collision used a flat
     three-quarters of the stock twelve-unit radius, which is about right for
     the stock triangle and nowhere near right for anything drawn larger than
     it: the Tender's outline reaches twenty-six units in the same space, so
     even after scaling by `size` the circle stopping it covered a third of
     the ship. Rocks went through the visible hull.

     The mean distance of the outline's own corners, because a hull is not a
     disc and the furthest corner would wrap a long thin ship in a circle it
     never fills. The 0.8 keeps the stock hull exactly where it has always sat
     — its mean is 11.4 and three-quarters of twelve is 9 — so nothing small
     changes and everything large stops being a lie. */
  const mean = art.reduce((t, pt) => t + Math.hypot(pt[0], pt[1]), 0) / art.length;
  sh.hitR = +(mean * 0.8).toFixed(2);
}

/* The shipyard uses the same order as the register Ric supplied. `key` stays
   stable for old saves; category and display name are the catalogue layer. */
const SHIP_CATEGORIES = [
  "MILITARY", "EXPLORER", "COMMUTER", "SPORT",
  "INDUSTRIAL", "CARGO", "UTILITY", "COURIER"
];

const shipSpec = key =>
  SHIPS.find(sh => sh.key === key) || SHIPS[0];

/* ── life support ─────────────────────────────────────────────────────────
   Two clocks that are always running, and they are the reason range is a
   supply problem rather than only a danger problem. Water goes about twice as
   fast as food, which is both true and useful: it means the two meters
   separate over a long trip instead of moving as one, so there is a decision
   in which of them you spend money on.

   Neither kills you the instant it empties. Empty starts a countdown you can
   still act on — a meter that goes from "fine" to "dead" with no interval is
   an ambush, and the whole of phase 1 was about not doing that. The grace is
   generous enough to reach a station you already know about and not generous
   enough to carry on exploring. */
/* Twenty minutes of water and forty-five of food. They were twelve and
   twenty-five, which made every trip a question about the tank rather than
   about where you were going — a long haul out and back is most of an hour, and
   spending it watching a bar is not the game.

   Food is the one the hull decides. A pantry is space, and space is the thing a
   bigger ship has: `FOOD_FULL` is what the Skiff carries, and every other hull
   carries it scaled by its hold. So a Cathedral can be away for a very long
   time and a Needle cannot, which is a reason to own more than one ship that is
   not "it is faster". */
const WATER_FULL   = 1200;   // seconds of water in a full tank — twenty minutes
const FOOD_FULL    = 2700;   // and forty-five of food, on the ship it starts in
const THIRST_GRACE = 75;     // then it kills you
const HUNGER_GRACE = 120;
// What a full tank costs at a station. Water is cheap and constant; food is
// dearer, which is what makes a long haul something you provision for.
const WATER_PRICE  = 45;
const FOOD_PRICE   = 95;
const NEBULA        = "#a08cff";
const WRECK         = "#7d8596";
const ICE_C         = "#87d8ff";   // the interface calls this ICE; same colour
const CASH          = "#6dffbf";
const DRONE_COLOUR  = "#ff6d8f";

/* ── the world's furniture ────────────────────────────────────────────────
   Everything below this line exists because a sector you fly *through* is a
   screensaver. A world is a place that pushes back: things you hit, things
   you can go inside, things that object to you being there, and somewhere for
   what you take to go. */
const SURVEY_HOLD    = 60;    // units of material the hold takes before it is full
/* Reach of the beam, once it is unlocked. It used to be 620 units pulling at
   900, which swept a broken rock clean at full burn — so the beam did not
   change how you fly, it removed the only decision salvage ever asked for.
   Short and weak enough that a cloud has to be flown *slowly* through: the
   pull has to beat your own speed to close the gap, so the trade is time
   against cargo, which is the trade the whole mode is made of. */
const SURVEY_TRACTOR = 340;   // reach of the beam, once it is unlocked
const TRACTOR_PULL   = 380;   // and how hard it draws at the rim
const SURVEY_DOCK    = 260;   // how close is docked
const PLANET_DOCK    = 190;   // and how far above a world's surface counts
const GATE_R         = 150;   // the mouth of a wormhole
const DRONE_WAKE     = 1500;  // a sentry notices you this far out
const DRONE_LEASH    = 2600;  // and gives up this far from its post

/* ── worlds ───────────────────────────────────────────────────────────────
   Planets were the most common thing in the sector after rocks and the least
   interesting: one in six chunks held one, every one of them 110–200 units
   across, every one of them the same blue, and none of them called anything.
   Four of the things a landmark must not be, all at once — so a world was
   something you flew past without ever once looking at it.

   Now: far fewer, far bigger, an order of magnitude apart in size, each with
   its own palette and its own banding, each with a name, and about one in
   twenty inhabited and saying so. Everything here is a pure function of where
   the world is, so a world keeps its face and its name forever. */
const WORLD_KINDS = [
  { key: "rust",   disc: "#e0885c", band: "#b05f3c", halo: "#ff9d6b" },
  { key: "ice",    disc: "#bfe8ff", band: "#7fb8d8", halo: "#e6f7ff" },
  { key: "ocean",  disc: "#6fa8e6", band: "#3f74b4", halo: "#9ad0ff" },
  { key: "ember",  disc: "#ff8f77", band: "#c2523f", halo: "#ffb59d" },
  { key: "jade",   disc: "#7fd8a8", band: "#3f9d78", halo: "#a8f0c8" },
  { key: "ash",    disc: "#9aa0ad", band: "#666c78", halo: "#c4cad6" },
  { key: "amber",  disc: "#ffd76d", band: "#c2a03f", halo: "#ffeaa8" },
  { key: "violet", disc: "#b79aff", band: "#7a5fc4", halo: "#d6c4ff" }
];

/* Gibberish, and deliberately so: a made-up name is a name, and a coordinate
   is not. Two or three syllables from a table that cannot produce anything
   unpronounceable, sometimes with a numeral after it so a system reads as a
   system. Seeded off the position, so it is the same name every time you
   come back and the same name on somebody else's screen. */
const SYL_HEAD = ["ka", "tor", "vel", "mir", "zan", "hel", "dra", "ost", "sev",
                  "bra", "nul", "ith", "tem", "lor", "pha", "gri", "umb", "cas",
                  "ryn", "aln", "khe", "vor", "sil", "dun", "ere", "yph"];
const SYL_TAIL = ["ara", "is", "on", "eth", "ux", "ai", "or", "ys", "en", "um",
                  "ea", "ir", "os", "ane", "ul", "yx", "ia", "esh", "ov", "at"];
const ROMAN = ["II", "III", "IV", "V", "VI", "VII", "IX", "XI"];
/* A supermassive well is the biggest thing in a sector and it was called
   nothing at all, which made the one you have to plan a route around
   indistinguishable on the chart from the one you passed an hour ago. They are
   named in their own register — a place, not a world — so a chart with both on
   it reads as two kinds of thing. */
const HOLE_WORDS = ["DEEP", "ABYSS", "MAW", "THROAT", "WELL", "DARK", "DRAIN"];

function holeName(x, y) {
  const R = seeded(hash2(Math.round(x), Math.round(y)) ^ 0x71c3f9a5);
  let n = SYL_HEAD[Math.floor(R() * SYL_HEAD.length)];
  if (R() < 0.4) n += SYL_HEAD[Math.floor(R() * SYL_HEAD.length)];
  n += SYL_TAIL[Math.floor(R() * SYL_TAIL.length)];
  return n.toUpperCase() + " " + HOLE_WORDS[Math.floor(R() * HOLE_WORDS.length)];
}

// What counts as supermassive: the scale at which the warning calls it one.
const SUPERMASSIVE = 1.8;

function worldName(x, y) {
  const R = seeded(hash2(Math.round(x), Math.round(y)) ^ 0x2f9a7c31);
  let n = SYL_HEAD[Math.floor(R() * SYL_HEAD.length)];
  if (R() < 0.45) n += SYL_HEAD[Math.floor(R() * SYL_HEAD.length)];
  n += SYL_TAIL[Math.floor(R() * SYL_TAIL.length)];
  n = n.toUpperCase();
  if (R() < 0.34) n += " " + ROMAN[Math.floor(R() * ROMAN.length)];
  return n;
}

/* ── where a world may stand ──────────────────────────────────────────────
   Worlds cannot be rolled per chunk any more. A chunk is pure — it cannot see
   what its neighbours built — and that was harmless while a planet was 190
   units across inside a 2,600-unit chunk. At up to 3,600 units across it is
   not: measured over six seeds, one world in twenty-four overlapped another,
   and the worst case had a small world sitting entirely inside a large one.
   Two intersecting solid bodies also make a pocket you can get wedged in.

   So worlds get their own lattice, exactly five chunks to a cell, and each
   cell holds at most one. A world is inset from its cell's edges by its own
   radius and then some, which means two worlds in neighbouring cells are
   always at least `r1 + r2 + 1200` apart — they cannot touch, and the proof is
   arithmetic rather than a hope about the random numbers.

   A cell is five chunks square, so a chunk lies in exactly one of them and
   this costs one memoised roll. */
const WORLD_CELL = CHUNK * 5;          // 13,000 units — wider than any world
const WORLD_INSET = 600;               // clear air between two neighbours
let worldCache = new Map();

function worldIn(lx, ly) {
  const key = lx + "," + ly;
  const had = worldCache.get(key);
  if (had !== undefined) return had;
  const R = seeded(chunkSeed(lx * 3571 + 11, ly * 51043 + 29) ^ 0x6d2b79f5);
  const roll = R();
  let out = null;
  const wcx = (lx + 0.5) * WORLD_CELL, wcy = (ly + 0.5) * WORLD_CELL;
  if (regionOf(wcx, wcy).nothing) { worldCache.set(key, null); return null; }
  if (roll < 0.55 * Math.max(0.05, abund("planets", wcx, wcy))) {
    // The radius first, because the box it may stand in depends on it.
    const t = Math.pow(R(), 2.2);
    const r = Math.round(340 * Math.pow(10.6, t));
    const pad = r + WORLD_INSET;
    const room = WORLD_CELL - pad * 2;
    const x = lx * WORLD_CELL + pad + (room > 0 ? R() * room : 0);
    const y = ly * WORLD_CELL + pad + (room > 0 ? R() * room : 0);
    const w = makeWorld(x, y, R, r);
    out = worldBlocked(w.x, w.y, w.r) ? null : w;
  }
  worldCache.set(key, out);
  return out;
}

/* A world's whole face, from its position. Size runs 340 to about 3,600 on a
   curve that keeps most of them modest and lets a few be enormous — the point
   of the spread is that "that one is *huge*" has to be a thing you can say,
   which needs the ordinary ones to be smaller than it. */
function makeWorld(x, y, R, radius) {
  const t = Math.pow(R(), 2.2);
  const r = radius || Math.round(340 * Math.pow(10.6, t));
  const kind = WORLD_KINDS[Math.floor(R() * WORLD_KINDS.length)];
  // Bands: how many, and where. A world with three fat bands and one with
  // seven fine ones do not read as the same paint.
  const n = 2 + Math.floor(R() * 6);
  const bands = [];
  for (let i = 0; i < n; i++) {
    bands.push((i + 1) / (n + 1) * 2 - 1 + (R() - 0.5) * 0.14);
  }
  /* Who lives here. Commoner near home and rare in the deep, which is what
     turns range into a supply problem rather than only a danger problem: the
     further out you go, the further you are from anywhere that sells you
     water. About one in twenty overall, but one in nine near the origin and
     one in fifty at the far end.

     Air is separate, and commoner: a world with an atmosphere can be skimmed
     for water by anybody, slowly and for nothing, which is the poor pilot's
     option and costs time instead of money. */
  /* Who lives here is a question about who holds the sky. Commonest in a
     power's own territory, thinner on the frontier and in lawless space, and
     nobody at all in the Deep Void. */
  const lived = R() < 0.05 * spaceAt(x, y).lived;
  /* ── what an inhabited world is *for* ───────────────────────────────────
     It sold water and food and that was the whole of it, which made every
     settlement in the sector the same settlement — a well with a shop sign.
     A place people live is a place that *produces something*, so each one has
     a trade: the one thing it digs, refines or strips, sold cheaper than a
     station would and in quantity.

     It is the other half of the economy the stations already have. A station
     is where you *sell* what you found; a world is where you can buy what you
     need for a build without flying to find a rock that has it in. */
  const trades = lived ? MATERIALS[Math.floor(R() * MATERIALS.length)].key : "";
  return { x, y, r, kind: kind.key, bands,
           ring: R() < 0.22 ? 1.25 + R() * 0.5 : 0,
           tilt: (R() - 0.5) * 0.9,
           inhabited: lived,
           trades,
           // How much of it they have to sell, and what they want for it.
           stock: lived ? 20 + Math.floor(R() * 60) : 0,
           air: R() < 0.62,
           name: worldName(x, y) };
}

const worldKind = k => WORLD_KINDS.find(w => w.key === k) || WORLD_KINDS[2];

/* Somewhere a world is not allowed to be. Worlds are solid and can now be
   3,600 units across, so one rolled on top of a manifest part or a landmark
   does not obscure it — it *encloses* it, and the thing inside cannot be
   reached at all. That is the same bug the jump coil's gate had, arriving from
   a different direction, and it ends a run rather than spoiling a view.

   Both lists are small — six parts and eight landmarks — so this is exact
   rather than approximate, and it is checked against the world's real radius
   rather than a guess at one. */
function worldBlocked(x, y, r) {
  if (!surv) return false;
  for (const pt of surv.partSites) {
    if (dist2(x, y, pt.x, pt.y) < (r + pt.r + 420) ** 2) return true;
  }
  for (const lm of surv.landmarks) {
    if (dist2(x, y, lm.x, lm.y) < (r + lm.r + 300) ** 2) return true;
  }
  /* Nor over the origin you start at, which is the circle the home station
     stands inside — one exclusion instead of two, now that there is one thing
     off the origin instead of two. */
  if (dist2(x, y, 0, 0) < (r + 1200) ** 2) return true;
  return false;
}

/* ── what you are carrying ────────────────────────────────────────────────
   Salvage used to be one number, and that number was both the cargo in the
   hold and the money in the bank. It made the whole economy legible at a
   glance and it made it mean nothing: everything you broke was worth the
   same, everywhere was worth the same, and there was no reason to carry a
   load anywhere except back to the nearest shop.

   So the two are split. **Materials** are the cargo — four kinds, worth
   different money, coming out of different things — and they are what the
   hold's capacity limits. **Cash** is what you get for selling them, it is
   not carried and cannot be spilled, and it is what buys a refit today and
   ships, food and water later.

   Four rather than a dozen: each one has to be recognisable by its colour in
   a cloud of drifting motes at speed, and be worth saying out loud when you
   find a seam of it. */
/* `where` is the answer to "how do I get one of these", and it is written from
   `MAT_TABLE` below rather than from an impression — the odds quoted are the
   odds in that table, so a change to the drop rates has one other line to fix
   and it is directly underneath. Depth leans every table toward the dear end,
   which is why each of these ends with the same promise. */
const MATERIALS = [
  { key: "ice",     name: "ICE",     colour: "#87d8ff", value: 1,
    note: "common, cheap, and one day it is water",
    where: "Break rocks — nearly half of what they give is ice. A rime field " +
           "is made of it, and a melter turns it into water." },
  { key: "iron",    name: "IRON",    colour: "#c0a487", value: 3,
    note: "what most rocks are made of",
    where: "Break rocks. It is the other half of what a field gives, and " +
           "every build wants some." },
  { key: "alloy",   name: "ALLOY",   colour: "#ffcb42", value: 9,
    note: "refined — it comes out of things that were built",
    where: "Strip hulks, wrecks and dead drones — about half of what comes " +
           "out of anything built is alloy. Rocks almost never have it." },
  { key: "iridium", name: "IRIDIUM", colour: "#a08cff", value: 22,
    note: "deep, dense and rare; the reason to go somewhere bad",
    where: "Guarded caches, which are a third iridium. Rocks give a little, " +
           "and everything gives more where the sky is dangerous." },
  /* Two things you cannot mine. A rock is rock — these come out of what
     somebody else built, which is what makes a hulk or a guarded cache worth
     stopping for even when your hold is nearly full of ore. They are the
     ingredients the builds are short of, on purpose: a part you can build
     from four units of iron is a part you buy by flying in circles. */
  { key: "electronics", name: "ELECTRONICS", colour: "#6dffbf", value: 16,
    note: "pulled out of things that were wired; never out of a rock",
    where: "Strip drones and hulks. Never a rock — no amount of mining will " +
           "find one, and the builds that want them are why you stop." },
  { key: "core", name: "REACTOR CORE", colour: "#ff8f77", value: 48,
    note: "the heart of something that used to run; rare and always salvage",
    where: "The rarest thing there is: a few in a hundred from a cache, a " +
           "hulk or a drone, and never from a rock." }
];
const matSpec = k => MATERIALS.find(m => m.key === k) || MATERIALS[1];
const freshHold = () =>
  MATERIALS.reduce((h, m) => { h[m.key] = 0; return h; }, {});

/* Where a kind of material comes from. A rock is mostly ice and iron; a thing
   somebody built is mostly alloy; a guarded cache is where the iridium is.
   Depth slides every table toward the rare end, which is most of what makes a
   long haul worth the fuel. */
/* Electronics and cores are absent from `rock` and present everywhere else,
   which is the whole of "found, not mined": the only way to get them is to take
   apart something that was made. A core is rarer than iridium anywhere it
   appears, because one build wanting one is a reason to go and look. */
const MAT_TABLE = {
  rock:  { ice: 46, iron: 44, alloy: 6,  iridium: 4 },
  hulk:  { ice: 4,  iron: 30, alloy: 46, iridium: 5, electronics: 13, core: 2 },
  drone: { ice: 2,  iron: 20, alloy: 50, iridium: 6, electronics: 20, core: 2 },
  wreck: { ice: 5,  iron: 34, alloy: 42, iridium: 5, electronics: 12, core: 2 },
  cache: { ice: 5,  iron: 18, alloy: 32, iridium: 30, electronics: 11, core: 4 }
};

function rollMaterial(source, deep, where) {
  const table = MAT_TABLE[source] || MAT_TABLE.rock;
  /* And what the *place* is made of. A rime is small ice bodies as far as the
     scan reaches, which turns water — the thing that decides how far you can
     go — into a non-question for anybody carrying a melter. The same ship goes
     twice as far from there, which is what a region is for. */
  const iceBias = where ? (regionOf(where.x, where.y).ice || 1) : 1;
  // Depth is a thumb on the scale, not a different table: the same places
  // give the same things further out, just richer.
  const lean = 1 + (deep || 0) * 3.5;
  let total = 0;
  const weights = MATERIALS.map(m => {
    const w = (table[m.key] || 0) *
              (m.value >= 9 ? lean : m.value <= 1 ? 1 / lean : 1) *
              (m.key === "ice" ? iceBias : 1);
    total += w;
    return w;
  });
  let r = Math.random() * total;
  for (let i = 0; i < MATERIALS.length; i++) {
    r -= weights[i];
    if (r <= 0) return MATERIALS[i].key;
  }
  return "iron";
}

/* How many units a thing drops. Bigger than the old yields because a unit is
   no longer worth one cash — it is worth whatever it turns out to be. */
const YIELD = { rock: 3, wreck: 9, cache: 34, drone: 7, hulk: 16 };


/* ── the refit ────────────────────────────────────────────────────────────
   Four tracks, three tiers each, bought with cash at a station. Numbers
   rather than verbs: a refit makes the ship you have better, and the almanac
   is what hands you things the ship could not do at all. Costs climb steeply
   enough that a full ship is an expedition's worth of work, not an errand. */
/* Priced in cash, which is now a thing you get by selling rather than a thing
   you pick up. A full sixty-unit hold of ordinary rock sells near home for
   something like 250, so the first tier of anything is a run or two out and
   back, and the third tier of everything is a long way past that. */
/* There used to be a refit track here: three lines — hull, drive, scanner —
   three tiers each, bought with cash at a station, quietly scaling the ship you
   were flying. It is gone, and this note is what is left of it.

   It had to go because it was a *second* upgrade system saying the same things
   as the first. LAYERED PLATE is +2 hull; so was a tier of hull plating. DRIVE
   SPAR is +14% speed; so was a tier of drive. PULSE COIL is +70% scan; so was a
   tier of scanner. One of the two had to be the answer to "how do I make this
   ship better", and the parts are the better answer for one reason: a part is
   a thing you can point at. It sits in a slot, it cost you one of four, you can
   take it off and sell it, and the ship tells you what it can do by what is
   bolted to it.

   A tier was invisible. Nothing on the ship said "this hull has had 380 spent
   on it", and two identical hulls could fly completely differently with no way
   to see why. Worse, it made the ship you own quietly better over time, which
   is exactly the thing Ric's rule forbids:

       *A ship without that stuff is a normal ship. No tricks. All the tricks
       are the parts you attach yourself, so they know what they are.* */

/* And there used to be three verbs here that the *almanac* handed out: six
   entries bought you a tractor beam, twelve bought a warp tuner, eighteen
   bought running dark. They are parts now — TRACTOR RIG, WARP TUNER, RUNNING
   DARK — found in caches out in the dark.

   The old version was wrong in two ways at once. It made the ship do things
   nothing on the ship explained: your beam turned on one day because you had
   looked at enough of the sector, and there was nothing to point at. And it
   made the almanac a shop, which is the one thing a field guide must not be —
   a book about looking should not be a currency.

   What the almanac is worth now is what it always should have been: it is the
   record of what you have seen. */

/* ── parts, and the four slots they go in ─────────────────────────────────
   Every ship, no exceptions, gets exactly four attachment slots. Not four on
   the starter and a spread across the rest — four on all twenty-five. The
   hulls already differ by cargo, speed, handling and size; varying the slot
   count on top of that stacks a second balancing axis onto ships that did not
   need one, and the two fight — a hauler that is roomier *and* better equipped
   is not a trade, it is strictly better. Four everywhere makes the question
   "which four do I want this trip" rather than "which hull carries more gear",
   and the first of those survives the whole game.

   A part is a thing you found or bought and bolted on. It is not a tier on a
   list: it takes up one of your four, and putting it there costs you time.

   Rarity is the only axis that decides *fitting time* and *where it is sold*.
   It is not a quality ladder — a common vernier set is the best thing in the
   game if what you needed was to turn faster. */
const SLOTS = 4;
// How hard reverse thrusters push, against the engine's own figure. Enough to
// get you out of something, not enough to fly backwards across a sector.
const REVERSE_THRUST = 0.55;

/* How long a fit takes out in space, by rarity. 180 seconds is the ceiling and
   nothing goes past it. At a station every one of these is instant. */
const FIT_TIME = { common: 20, uncommon: 45, rare: 90, exotic: 180 };

/* ── what a part weighs ───────────────────────────────────────────────────
   **The hold is the hold.** There used to be two places to put things — a
   cargo hold with a cap on it, and a crate of spare parts with no cap at all —
   and the second one made the first one a lie: a hauler could be full to the
   brim and still be carrying six spare engines in a pocket nobody could see.

   So a part you are not flying takes up room like everything else, and the one
   number on the page is the true one.

   By **category**, not by rarity. Rarity already decides two things — how long
   a fit takes and how far out it is sold — and it is deliberately not a
   quality ladder; making it a weight ladder as well would turn it into one. A
   category is the honest axis anyway: armour is plate, a scanner is a dish and
   a box, and the difference between them is a fact about the thing rather than
   about how hard it was to find.

   Measured against the holds they go in: the starting skiff carries 60, so a
   spare plate is a sixth of it and four spares is most of a trip's salvage.
   The big haulers run past 800 and can carry a workshop. That spread is the
   point — "which four do I want fitted" is the question the slots ask, and
   "what can I afford to carry spare" is the one the hold asks back. */
const PART_WEIGHT = {
  armour:   10,     // plate. The heaviest thing you can bolt on
  engine:    8,
  tractor:   6,
  weapon:    6,
  solar:     5,     // wings fold, but there is a lot of wing
  device:    4,
  odd:       4,
  scanner:   3,
  thruster:  3      // little jets and their plumbing
};
const partWeight = key => {
  const m = moduleSpec(key);
  return m ? (PART_WEIGHT[m.cat] || 4) : 0;
};

/* `deep` is how far out a station has to be before it stocks one — which is
   the danger curve finally paying something out. The odd ones at the bottom
   are the reason to go a long way. */
/* ── how you get one ──────────────────────────────────────────────────────
   Three ways, and most parts have exactly one of them. This is the whole of
   what makes a part feel like a part rather than a line in a shop:

     buy    it is on a shelf somewhere. `deep` says how far out that shelf is.
     craft  there is a build for it. See `CRAFTS`.
     find   it is out there in the dark and that is the only way. Never sold,
            never built — you open a cache a long way from anywhere and there
            it is.

   A part with no `get` at all would be unobtainable, so the parts page checks
   for that and the test suite refuses to let one exist.

   `where` is the line the parts page prints for a find-only part. A part you
   cannot buy and cannot build has to at least tell you where to look, or it is
   not content, it is a rumour. */
const MODULES = [
  // ── engines: how fast ──────────────────────────────────────────────────
  { key: "sparthruster", name: "DRIVE SPAR", cat: "engine", rarity: "common",
    cost: 650, deep: 0, get: ["buy", "craft"],
    note: "a longer spar and a wider throat: +14% top speed",
    eff: { speed: 0.14 } },
  { key: "overburner", name: "OVERBURNER", cat: "engine", rarity: "rare",
    cost: 5100, deep: 0.34, get: ["buy"],
    note: "runs the drive past what it was rated for: +34% top speed and " +
          "+20% off the mark",
    eff: { speed: 0.34, thrust: 0.2 } },

  // ── thrusters: how it handles ──────────────────────────────────────────
  { key: "vernier", name: "VERNIER SET", cat: "thruster", rarity: "common",
    cost: 700, deep: 0, get: ["buy", "craft"],
    note: "little jets at the nose and tail: +22% turn rate",
    eff: { turn: 0.22 } },
  { key: "reverser", name: "REVERSE THRUSTERS", cat: "thruster",
    rarity: "uncommon", cost: 2000, deep: 0.12, get: ["buy"],
    note: "thrust out of the front of the ship — back straight off a rock " +
          "without turning round first  [S]",
    eff: { reverse: 1 } },

  // ── scanners: how far a pulse reaches ─────────────────────────────────
  { key: "pulsecoil", name: "PULSE COIL", cat: "scanner", rarity: "common",
    cost: 800, deep: 0, get: ["buy", "craft"],
    note: "a louder pulse: the scan reaches 70% further",
    eff: { scan: 0.7 } },
  { key: "coolantloop", name: "COOLANT LOOP", cat: "scanner",
    rarity: "uncommon", cost: 2300, deep: 0.14, get: ["buy", "craft"],
    note: "the scanner sheds its heat instead of waiting to. Recharges in " +
          "nine seconds rather than twelve — the rate it ran at before " +
          "anybody worked out what was slowing it down",
    eff: { recharge: 0.25 } },
  { key: "deepear", name: "DEEP EAR", cat: "scanner", rarity: "rare",
    cost: 5600, deep: 0.4, get: ["buy"],
    note: "hears the returns a pulse coil throws away: the scan reaches " +
          "190% further",
    eff: { scan: 1.9 } },

  // ── armour: how many hits ─────────────────────────────────────────────
  { key: "layerplate", name: "LAYERED PLATE", cat: "armour", rarity: "common",
    cost: 900, deep: 0, get: ["buy", "craft"],
    note: "scrap plate welded over the hull: +2 hull",
    eff: { hull: 2 } },
  { key: "ablativeshell", name: "ABLATIVE SHELL", cat: "armour",
    rarity: "rare", cost: 6000, deep: 0.36, get: ["buy"],
    note: "a shell that burns away instead of you: +5 hull",
    eff: { hull: 5 } },

  // ── tractor gear: the beam, and better beams ──────────────────────────
  /* The beam. Without one of these you have to fly into every single piece of
     salvage you want, one at a time, at the speed a hull can be aimed — which
     is the whole of the early game and exactly why the first rig you get your
     hands on changes the mode more than any other part in the list. */
  /* ── the tractor ladder ───────────────────────────────────────────────
     Three rungs of one idea rather than two parts with different names. A
     TRACTOR BEAM and a HEAVY BEAM were the same field at two strengths and
     nothing said so — you had to read both descriptions to work out they were
     the same category, and there was no bottom rung for somebody who had just
     finished the gate and had nothing to reach for.

     MK1 is half the reach: enough to make a broken rock one pass instead of
     nine, and little enough that MK2 is a real step. MK2 is the beam as it
     was. MK3 is the hot one, which used to be called the HEAVY BEAM. */
  { key: "tractormk1", name: "TRACTOR BEAM MK1", cat: "tractor",
    rarity: "common", cost: 550, deep: 0, get: ["find", "craft"],
    where: "out in the dark, on its own \u2014 the first thing worth looking " +
           "for once the station is whole",
    note: "a grapple field on the nose, at half the reach of the mark two. " +
          "Loose salvage inside " + Math.round(SURVEY_TRACTOR * 0.5) +
          " units comes in on its own",
    eff: { tractor: 1, reach: -0.5 } },
  { key: "tractorrig", name: "TRACTOR BEAM MK2", cat: "tractor",
    rarity: "common", cost: 1000, deep: 0, get: ["find", "craft"],
    where: "in caches — the commonest part out there, and the first one that " +
           "changes how you play",
    note: "the same field at its full reach. Loose salvage inside " +
          SURVEY_TRACTOR + " units is drawn in and stowed on its own, so a " +
          "broken rock is one pass instead of nine",
    eff: { tractor: 1 } },
  { key: "heavyrig", name: "TRACTOR BEAM MK3", cat: "tractor",
    rarity: "uncommon", cost: 2500, deep: 0.16, get: ["buy"],
    note: "the field run hot: 60% further out than the mark two and a harder " +
          "pull, so a field of debris comes in while you are still crossing it",
    eff: { tractor: 1, reach: 0.6, pull: 0.5 } },

  /* ── weapons ──────────────────────────────────────────────────────────
     Each fires on the trigger you already have, at its own rate, on top of the
     cannon. See `WEAPONS` for what each one does. */
  { key: "scattergun", name: "SCATTER GUN", cat: "weapon", rarity: "common",
    cost: 1250, deep: 0, get: ["buy", "craft"],
    note: "three rounds at once on the same trigger, none of them go far",
    eff: { weapon: "scatter" } },
  { key: "seekerrack", name: "SEEKER RACK", cat: "weapon", rarity: "uncommon",
    cost: 3100, deep: 0.14, get: ["buy", "craft"],
    note: "a missile that turns after whatever is nearest — fire it and look " +
          "somewhere else",
    eff: { weapon: "seeker" } },
  { key: "burstcharge", name: "BURST CHARGE", cat: "weapon", rarity: "rare",
    cost: 6300, deep: 0.38, get: ["buy", "craft"],
    note: "goes off where it lands and takes whatever was standing next to it",
    eff: { weapon: "burster" } },
  { key: "raillance", name: "RAIL LANCE", cat: "weapon", rarity: "exotic",
    cost: 14400, deep: 0.62, get: ["buy"],
    note: "one heavy slug, straight through three things and out the far side",
    eff: { weapon: "lance" } },

  /* ── the odd ones ─────────────────────────────────────────────────────
     Rare, strange, and only sold a long way out. These are the reason to keep
     going rather than to keep grinding: each one changes a rule rather than a
     number. */
  { key: "starsiphon", name: "STAR SIPHON", cat: "odd", rarity: "rare",
    cost: 5200, deep: 0.42, get: ["buy", "craft"],
    note: "a wider throat on the intake: skimming an atmosphere fills the " +
          "tank half again as fast",
    eff: { skim: 0.6 } },
  { key: "coldlarder", name: "COLD LARDER", cat: "odd", rarity: "exotic",
    cost: 12800, deep: 0.6, get: ["buy"],
    note: "keeps what you are carrying cold: water and food both last a " +
          "third longer",
    eff: { life: -0.25 } }
];

/* ── the tricks that used to be built into the hull ───────────────────────
   Four things this mode used to hand you for free, or for reading a book, and
   none of them should have been free. A ship is a ship: it flies, it turns, it
   shoots, it carries. *Everything else is a part you found and bolted on*, so
   that you can point at the thing on your hull that is doing it.

   Three of these were almanac rewards — you read your way to a tractor beam —
   and one was simply true of every hull in the game whether you knew it or not:
   sitting in a star's light mended you. That last one is the clearest case. It
   is the best mechanic in the mode and nothing on the ship explained it, so it
   read as a property of the universe rather than as something you own. Now it
   is a panel somebody bolted to your ship, and a ship without one takes its
   damage home. */
MODULES.push(
  { key: "solarwing", name: "SOLAR PANELS", cat: "solar", rarity: "uncommon",
    cost: 2900, deep: 0.1, get: ["buy", "craft"],
    note: "wings that drink a star. Sit in the light of a sun and the hull " +
          "knits itself back together — without them, damage is permanent " +
          "until you pay somebody to beat it out",
    eff: { solar: 1 } },
  { key: "warptuner", name: "WARP TUNER", cat: "odd", rarity: "rare",
    cost: 0, deep: 0, get: ["find"],
    where: "in guarded caches in bad sky — nobody sells one and nobody " +
           "knows how to make one",
    note: "reads a gate's mouth on the way through and leans on it. You come " +
          "out beside the nearest thing you have never logged instead of " +
          "wherever the gate was pointed",
    eff: { warp: 1 } },
  { key: "runningdark", name: "RUNNING DARK", cat: "odd", rarity: "rare",
    cost: 0, deep: 0, get: ["find"],
    where: "in guarded caches in bad sky — it was never manufactured, it was improvised, " +
           "and the ones out there were all made by somebody hiding",
    note: "damps the hull's signature when the engine is off. Cut the drive " +
          "and sentries lose you, which turns a guarded cache into a choice " +
          "between shooting your way in and drifting in cold",
    eff: { quiet: 1 } }
);
/* ── the ice melter ───────────────────────────────────────────────────────
   Phase 5.6, and it lives here because it is a part like any other. Water is
   bought at a station, and that was the only way — which makes a long haul a
   question about station spacing rather than about what you are carrying.

   This melts ICE, the cheapest thing in the game and the thing nobody wants to
   buy, straight into the tank. It is the honest use for a hold full of the
   stuff, it answers "what if there is no station for 200,000 units", and it is
   the first thing worth crafting rather than buying: see `CRAFTS`. */
MODULES.push({
  key: "icemelter", name: "ICE MELTER", cat: "odd", rarity: "uncommon",
  cost: 1100, deep: 0.2, get: ["buy", "craft"],
  note: "a heated hopper in the hold: ice you are carrying becomes water in " +
        "the tank, a unit at a time, for nothing",
  eff: { melt: 1 }
});

/* ── devices: the parts you press ─────────────────────────────────────────
   Phase 6.4, and the rule it was written to answer:

       *A +12% engine eventually becomes boring. A decoy, a grapple, a mine
       layer, an emergency jump, a cloak, an EMP, a cargo ejector changes what
       you can do.*

   Seventeen parts and most of them were numbers. A number is bought once and
   never thought about again; a device is a decision made while something is
   shooting at you, which is a different kind of thing to own.

   A device is a part like any other — it takes one of the four, it is bought
   or built or found, it takes time to fit, it can be pulled off and sold —
   with two things added: a **cooldown**, and a **button**. The cooldown is
   what makes it a rhythm rather than a switch. The button is per *slot*,
   because the slot is the thing the player is already pointing at: the parts
   page says what is in slot two, so slot two is what the key and the thumb
   button are named after.

   `blocked` is the honest refusal. A device that quietly does nothing when you
   press it is a device you stop trusting — anything that can refuse says why,
   in one line, once.

   Cooldowns are deliberately **not** in the book. A cooldown that survived
   closing the tab would be a rule nobody could see and nobody would guess, and
   the most it can cost is one free press after a reload. */
/* ── the grapple ──────────────────────────────────────────────────────────
   A line that pulls *you*, which is the half of "pull" the tractor rig does
   not do. The rig brings loose salvage in; this throws you at something too
   big to move, and the difference is the whole part: one is a convenience and
   the other is a way to travel.

   What it multiplies:

     · **flight** — a way to move that is not the engine, so a dead drive or an
       empty approach angle stops being the end of the sentence;
     · **gravity** — anchor to a rock outside a well and haul yourself out of
       it, which is the first answer to a well that is not "have a bigger
       engine";
     · **the Warrens** — a tunnel is a corridor of anchors, and hauling along
       one is faster and quieter than flying it.

   It is not free and it is not safe: it throws you *at* a solid thing at
   speed, and what happens when you arrive is your problem. That is the
   decision — the button does not ask whether you have thought about the
   landing. */
/* ── the cloak ────────────────────────────────────────────────────────────
   There is already a part that hides you: RUNNING DARK, which damps the hull
   when the engine is off and takes you off a *sentry's* list. It is passive,
   it is conditional, and it is about one kind of watcher.

   This is the other shape of the idea — a button, ten seconds, and it works
   on everything that is *looking* for you: a sentry, a pirate that has you,
   a patrol shadowing you, a seeker already in the air. What it does not do is
   let you fight from inside it. Firing ends it, immediately and always.

   That one rule is what keeps it honest. A cloak you can shoot out of is an
   ambush, and an ambush makes every fight in the sector yours to start on
   your terms; a cloak you can only leave by becoming visible is an escape,
   and an escape is a thing you spend rather than a thing you exploit. */
const CLOAK_TIME = 10;        // seconds of it, and the cooldown is 75

/* Ended early, and it says so. Called from both places a round leaves the
   ship — see `fire` and `launch`. */
function dropCloak() {
  if (!surv || surv.cloak <= 0) return;
  surv.cloak = 0;
  chatter("You fired. They can see you.", "#ffcb42");
}

/* ── the EMP ──────────────────────────────────────────────────────────────
   One burst, and everything electric inside it stops. Sentries go limp,
   seekers fall out of the air, mines fizzle, and an armed ship loses its
   engine and its guns for a few seconds — which is long enough to leave, or
   to board something you could not otherwise have got near.

   **It takes your own hull with it.** Every device in your four slots goes to
   a full cooldown and the scan goes down for as long as the stun lasts. That
   is the decision: the room is clear and you are holding nothing, and whether
   that trade is worth it depends on what you were about to do next. A burst
   with no cost is a button you press on entering every room. */
const EMP_REACH = 1100;       // units the burst carries
const EMP_STUN  = 6;          // seconds of nothing, for everything it touches
const EMP_RING_TIME = 0.55;   // and how long the ring takes to get there

const GRAPPLE_REACH = 1500;   // how far the line carries, in units
const GRAPPLE_PULL  = 620;    // and what it adds toward the anchor, a second
/* Half a radian, not one and a sixth. Sixty-six degrees either side is not a
   cone, it is most of the sky in front of you — the line took whatever
   happened to be over there and aiming was not a thing you could do, so a
   hook you did not want cost you the cooldown and felt like the part
   misbehaving. Twenty-eight degrees is a thing you point.

   It matters *because* a miss is free. A wide cone that always catches
   something makes the refusal unreachable and the cooldown unavoidable; a
   narrow one you can miss with, and missing costs nothing, so the loop is
   point, fire, and point again. */
const GRAPPLE_CONE  = 0.5;    // radians either side of the nose it will fire

/* The best thing to hook, which is the nearest solid surface inside the cone.
   Measured to the *surface* rather than the middle, so a world four thousand
   units across is grappled at its edge like everything else.

   Everything solid in the sector is a candidate, because the alternative is a
   list that has to be updated every time something solid is added — and the
   last three things this mode gained were all solid. */
function grappleAnchor(me) {
  let best = null, bd = GRAPPLE_REACH * U;
  const consider = (x, y, r, what) => {
    const d = Math.hypot(x - me.x, y - me.y) - r;
    if (d < 12 * U || d > bd) return;      // already on it, or out of reach
    let off = Math.atan2(y - me.y, x - me.x) - me.a;
    while (off > Math.PI) off -= Math.PI * 2;
    while (off < -Math.PI) off += Math.PI * 2;
    if (Math.abs(off) > GRAPPLE_CONE) return;
    bd = d; best = { x, y, r, what };
  };
  for (const r of rocks) consider(r.x, r.y, r.r, "rock");
  if (surv) {
    for (const p of surv.planets) consider(p.x, p.y, p.r, p.name || "a world");
    for (const h of surv.hulks) consider(h.x, h.y, h.r, "a dead hull");
    for (const w of surv.wrecks) consider(w.x, w.y, w.r || 40, "a wreck");
    for (const st of surv.stations) consider(st.x, st.y, st.r, "the station");
    const lev = surv.leviathan;
    if (lev) for (const g of lev.segs) consider(g.x, g.y, g.r, "the Leviathan");
    const vault = surv.vault;
    if (vault) for (const g of vault.segs) consider(g.x, g.y, g.r, "the Vault");
    // And the rock of the Warrens, which is the place this is most useful.
    for (const g of caveNear(me.x, me.y)) consider(g.x, g.y, g.r, "the rock");
  }
  return best;
}

const DECOY_LIFE = 14;        // seconds a decoy reads as a ship
const DECOY_HOLD = 1500;      // and how far its lie carries, in units
const MINE_LIFE  = 75;        // how long a mine sits there
const MINE_ARM   = 1.6;       // and how long before it will go off at all
const MINE_BOOM  = 170;       // its blast radius, in units
const MINE_MAX   = 10;        // live mines at once; the oldest fizzles

const DEVICES = {
  /* The one that makes a fight escapable without making you stronger. It does
     not *attract* attention — it steals what is already pointed at you, which
     is the version that cannot be used to start a fight from a safe distance.
     Sentries fly at it, an angry ship shoots it, and a seeker turns onto it. */
  decoy: {
    key: "decoy", name: "DECOY LAUNCHER", tag: "DECOY", cool: 22,
    use(me) {
      const a = me.a + Math.PI + rand(-0.35, 0.35);
      surv.decoys.push({
        x: me.x - Math.cos(me.a) * 26 * U,
        y: me.y - Math.sin(me.a) * 26 * U,
        vx: me.vx * 0.45 + Math.cos(a) * 120 * U,
        vy: me.vy * 0.45 + Math.sin(a) * 120 * U,
        life: DECOY_LIFE, full: DECOY_LIFE, spin: rand(0, 6.28)
      });
      burst(me.x, me.y, "#ffe56d", 8, 140 * U);
      gameSound("start", me.x, me.y);
      chatter("Decoy away \u2014 it is you for the next " + DECOY_LIFE +
              " seconds.", "#ffe56d");
    }
  },

  /* Something behind you that the thing chasing you hits. It is armed on a
     delay and it does not know whose side it is on: fly back over your own
     and it takes the hull point it would have taken off anybody else. That is
     the cost, and it is what stops a mine being a free turret. */
  mine: {
    key: "mine", name: "MINE LAYER", tag: "MINE", cool: 5,
    use(me) {
      if (surv.mines.length >= MINE_MAX) {
        const old = surv.mines.shift();
        burst(old.x, old.y, WRECK, 4, 70 * U);
        gameSound("fizz", old.x, old.y);
      }
      surv.mines.push({
        x: me.x - Math.cos(me.a) * 30 * U,
        y: me.y - Math.sin(me.a) * 30 * U,
        vx: me.vx * 0.3, vy: me.vy * 0.3,
        life: MINE_LIFE, arm: MINE_ARM, spin: rand(0, 6.28),
        /* Whether it has stopped being *yours*. A mine is laid thirty units
           off your own tail, well inside the radius it goes off in, so one
           dropped while you were drifting would arm underneath you and take a
           hull point for nothing — a gotcha rather than a cost. It ignores
           you until you have been outside its radius once. After that it does
           not care whose it is, which is the cost, and it is a cost you can
           see coming, because the ring is drawn. */
        clear: false
      });
      gameSound("shot", me.x, me.y);
    }
  },

  /* The hold, over the side. It is the answer to HOLD FULL two hundred
     thousand units from a shop, and it is the answer to a pirate: they came
     for the cargo, and cargo in space is cargo they do not have to shoot you
     for. See `baitPirates`. */
  eject: {
    key: "eject", name: "CARGO EJECTOR", tag: "EJECT", cool: 4,
    blocked: () => holdUsed() ? "" : "The hold is already empty.",
    use(me) {
      const n = ejectHold(me);
      addShake(3);
      gameSound("rock", me.x, me.y);
      chatter(n + " units over the side.", CASH);
      baitPirates(me.x, me.y);
    }
  },

  /* The panic button, and it is deliberately not a good one. It throws you
     somewhere down the way you were pointing and leaves you there: no speed,
     no scan, and a sector you have not charted. It is the difference between
     dying here and being lost somewhere else, which is exactly what an
     emergency jump should be worth. */
  jump: {
    key: "jump", name: "EMERGENCY JUMP", tag: "JUMP", cool: 150,
    use(me) { emergencyJump(me); }
  },

  /* The line. Refuses out loud when there is nothing to hook, because a
     grapple that fires into empty space and says nothing is a grapple you
     press twice and then stop carrying. */
  grapple: {
    key: "grapple", name: "GRAPPLE LINE", tag: "GRAPPLE", cool: 6,
    /* A miss costs nothing. `useDevice` asks this before it sets the
       cooldown, so a line that finds nothing is a free press and you can
       re-aim and fire again in the same second — which is the whole feel of
       the thing, and it only works because the cone above is narrow enough
       to miss with. */
    blocked: me => grappleAnchor(me) ? "" : "Nothing to hook.",
    use(me) {
      const a = grappleAnchor(me);
      if (!a) return;
      const d = Math.hypot(a.x - me.x, a.y - me.y) || 1;
      me.vx += ((a.x - me.x) / d) * GRAPPLE_PULL * U;
      me.vy += ((a.y - me.y) / d) * GRAPPLE_PULL * U;
      surv.grappleTo = { x: a.x, y: a.y, t: 0.45 };
      addShake(2);
      gameSound("thrust", me.x, me.y);
      chatter("Line away — " + a.what + ".", NEBULA);
    }
  },

  /* Ten seconds of not being there. It drops the instant you fire, which is
     the only rule it has and the one that keeps it an escape rather than an
     ambush: you cannot shoot from inside it, so it cannot start a fight. */
  cloak: {
    key: "cloak", name: "SILENT RUNNING", tag: "CLOAK", cool: 75,
    use(me) {
      surv.cloak = CLOAK_TIME;
      gameSound("start", me.x, me.y);
      chatter("Dark. Ten seconds, and firing ends it.", "#87d8ff");
    }
  },

  /* The burst. Everything with something electric in it, inside the radius,
     stops — and that includes the four things on your own hull, which is what
     makes pressing it a decision rather than a free clear-the-room. */
  emp: {
    key: "emp", name: "EMP CHARGE", tag: "EMP", cool: 60,
    use(me) { empBurst(me); }
  }
};

/* Everything electric inside the radius, stopped — including yours.

   The order matters and is the argument for the part: it clears the *air*
   first (a seeker in flight is the thing you most want gone), then the things
   on the ground, then your own hull. A burst that spared the player would be
   a room-clearing button with no cost, which is a percentage wearing a verb's
   clothes. */
function empBurst(me) {
  const R2 = (EMP_REACH * U) ** 2;
  let hit = 0;

  /* Not the rounds in the air. A shot already fired is a lump of metal going
     somewhere and an electromagnetic pulse has nothing to say to it — and the
     only guided thing in this sector is the seeker rack, which is *yours*, so
     a burst that cleared the air would mostly clear your own missiles. It
     stops the things doing the shooting instead, which is the better answer
     to being shot at anyway.

     Mines first: they are a trigger and a charge, and this takes the
     trigger. */
  for (let i = surv.mines.length - 1; i >= 0; i--) {
    const mn = surv.mines[i];
    if (dist2(mn.x, mn.y, me.x, me.y) > R2) continue;
    burst(mn.x, mn.y, "#87d8ff", 6, 110 * U);
    surv.mines.splice(i, 1);
    hit++;
  }

  // Sentries: asleep, and off your list for as long as it lasts.
  for (const d of surv.drones) {
    if (dist2(d.x, d.y, me.x, me.y) > R2) continue;
    d.stun = EMP_STUN;
    d.awake = false;
    burst(d.x, d.y, "#87d8ff", 8, 140 * U);
    hit++;
  }

  /* Ships: no engine and no guns. Not damage — a ship you EMP and leave is a
     ship that comes round and remembers it, which is the half of this that
     makes it a decision rather than a weapon. */
  for (const t of surv.traffic) {
    if (dist2(t.x, t.y, me.x, me.y) > R2) continue;
    t.stun = EMP_STUN;
    burst(t.x, t.y, "#87d8ff", 8, 140 * U);
    hit++;
  }

  /* And you. Every device goes to a full cooldown and the scan goes down —
     this one included, which is why the cooldown is set here rather than by
     `useDevice` afterwards. */
  for (const sl of surv.slots) {
    if (!sl) continue;
    const m = moduleSpec(sl.key);
    const dev = m && m.eff && m.eff.device ? deviceSpec(m.eff.device) : null;
    if (dev) sl.cd = Math.max(sl.cd || 0, dev.cool);
  }
  /* The scanner goes down *with* the stun rather than losing its charge. The
     first version took the charge, which put it out for the twelve seconds of
     a full recharge — longer than everything else the burst touched — and it
     made the refusal below unreachable, because a scan with no charge returns
     before it can say why. "Your own kit goes down with theirs" is the part's
     whole claim and it should be true of the duration too. */
  surv.empSelf = EMP_STUN;

  /* The ring, going out. A cloud of particles says "something happened
     here"; a ring says *how far it reached*, which is the one fact about this
     part a player has to learn and the only one a burst can teach by being
     looked at. It travels to exactly EMP_REACH and stops — so what you see is
     the radius, and the next time you press it you already know whether the
     thing you wanted was inside it. */
  surv.empRing = { x: me.x, y: me.y, t: 0 };
  burst(me.x, me.y, "#87d8ff", 26, EMP_REACH * 0.5 * U);
  addShake(6);
  gameSound("hit", me.x, me.y);
  chatter(hit ? "Burst — " + hit + " dead in the water, and so are you."
              : "Burst — nothing out there to stop, and your own kit is down.",
          "#87d8ff");
}

/* The corsair's. One hard shove down the way you are pointing, past your
   own top speed, and it bleeds off the way a slingshot does. */
DEVICES.burner = {
  key: "burner", name: "CORSAIR BURNER", tag: "BURN", cool: 6,
  use(me) {
    const k = 1100 * U;
    me.vx += Math.cos(me.a) * k;
    me.vy += Math.sin(me.a) * k;
    me.boost = Math.max(me.boost || 0, k);
    burst(me.x - Math.cos(me.a) * 20 * U, me.y - Math.sin(me.a) * 20 * U,
          "#ff4dd2", 16, 220 * U);
    gameSound("shot", me.x, me.y);
  }
};

// The queen's. Three bugs out of the bay, on your side. See `bugStep`.
DEVICES.brood = {
  key: "brood", name: "BROOD BAY", tag: "BROOD", cool: 8,
  use(me) {
    for (let k = 0; k < 3; k++) {
      const a = me.a + Math.PI + (k - 1) * 0.6;
      surv.drones.push({ id: null, ally: true, bug: "hunt", hull: null,
                         x: me.x + Math.cos(a) * 30 * U, y: me.y + Math.sin(a) * 30 * U,
                         vx: 0, vy: 0, a, home: null, prey: null,
                         post: { x: me.x, y: me.y }, hp: 1, cool: 99, awake: true,
                         hit: 0, slot: k, life: 14 });
    }
    gameSound("shot", me.x, me.y);
  }
};

const deviceSpec = key => DEVICES[key] || null;

/* The four of them, as parts. They are their own category because a verb is a
   different kind of thing to own from a percentage, and the parts page should
   say so before you have read a word of the description. */
MODULES.push(
  { key: "ejector", name: "CARGO EJECTOR", cat: "device", rarity: "common",
    cost: 950, deep: 0, get: ["buy", "craft"],
    note: "a hopper that opens on the hold. Everything you are carrying goes " +
          "out of the back at once \u2014 the answer to a full hold a long way " +
          "from a shop, and to somebody who only ever wanted the cargo",
    eff: { device: "eject" } },
  { key: "decoylauncher", name: "DECOY LAUNCHER", cat: "device",
    rarity: "uncommon", cost: 2900, deep: 0.18, get: ["buy", "craft"],
    note: "a shell that burns like a hull and lies about being one. It does " +
          "not draw attention \u2014 it takes what is already on you: sentries " +
          "fly at it, an angry ship shoots at it, and a missile turns onto it",
    eff: { device: "decoy" } },
  { key: "minelayer", name: "MINE LAYER", cat: "device", rarity: "uncommon",
    cost: 3300, deep: 0.24, get: ["buy", "craft"],
    note: "drops something behind you that goes off when anything comes near " +
          "it. It arms a second and a half after it leaves the rack, and " +
          "once you have flown clear of it, it stops knowing whose side " +
          "it is on",
    eff: { device: "mine" } },
  { key: "jumpcore", name: "EMERGENCY JUMP", cat: "device", rarity: "rare",
    cost: 9800, deep: 0.46, get: ["buy"],
    note: "one hard throw down the way you are pointing, tens of thousands " +
          "of units, and nothing about where you land is chosen. You arrive " +
          "stopped, blind and somewhere else \u2014 which beats not arriving",
    eff: { device: "jump" } },

  /* The last three on the list this whole layer was written from: a grapple,
     a cloak and an EMP. Each of them is a verb by the three-systems test —
     the line moves you, gravity and the cave; the cloak moves sentries,
     hunting ships and a seeker in the air; the burst moves sentries, mines
     and every engine in reach, your own included. */
  { key: "grappleline", name: "GRAPPLE LINE", cat: "device", rarity: "common",
    cost: 1600, deep: 0, get: ["buy", "craft"],
    note: "a line and a winch. It does not pull things to you \u2014 it " +
          "pulls you to them, hard, at whatever is in front of the nose. " +
          "A way out of a well that is not a bigger engine, and the fastest " +
          "way down a tunnel",
    eff: { device: "grapple" } },
  /* Exotic, and bought rather than built — which is the rule from the bottom
     of the build list applied to the category it now tops: the best thing in
     a category is found or bought, the ladder up to it is built, and the top
     of it never is. Ten seconds of not being there is the most a device has
     ever changed about a fight, so it is the top and it costs a trip. */
  { key: "silentrig", name: "SILENT RUNNING", cat: "device", rarity: "exotic",
    cost: 16800, deep: 0.62, get: ["buy"],
    note: "ten seconds of not being there. Sentries lose you, whoever is " +
          "chasing you forgets, and a missile in the air goes looking " +
          "somewhere else. Fire once and it is over",
    eff: { device: "cloak" } },
  { key: "empcharge", name: "EMP CHARGE", cat: "device", rarity: "rare",
    cost: 9100, deep: 0.4, get: ["buy", "craft"],
    note: "one burst, and everything electric inside it stops \u2014 " +
          "sentries, mines, and the engines and guns of every ship in reach. " +
          "Your own four slots and your scanner go down with them",
    eff: { device: "emp" } }
);
