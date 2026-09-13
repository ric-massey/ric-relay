"use strict";

/* CROSSFIRE — SURVEY'S GEOGRAPHY
   ─────────────────────────────────────────────────────────────────────────────
   Where you are, and what that means. Three things, and every one of them a
   pure function of a seed and a pair of coordinates:

     · **identity** — one seed and one pair of chunk coordinates make one
       number, and that number makes one chunk. This is what "the world is its
       seed" means in practice, and nothing in the mode is allowed to be true
       of a place in any other way.
     · **the danger curve** — distance from the origin is the difficulty dial.
       Seven named bands over a smooth curve, so a pilot can make a decision
       about UNSETTLED without ever seeing 0.47.
     · **the regions** — a Voronoi lattice of places, each multiplying the
       world's own abundances rather than replacing them. Nothing is stored,
       nothing can desync, and flying away and back finds the same place.

   Storing none of it is the whole reason it is affordable, and it is the part
   the plan says never to rewrite. It came out of index.html unchanged, one
   indent shallower, so that the rule is visible in a file of its own rather
   than implied by three blocks a thousand lines apart.

   Two caches, both memoising pure functions, both emptied when a new sector
   starts — see `clearCaches`. A new seed is a new lattice.

   Nothing in here touches the DOM, a canvas or a clock. */

window.CrossfireSurveyWorld = function (env) {
  /* `seeded` is the game's own PRNG and is not Survey's — the rocks and the
     campaign use it too — so it is passed in rather than taken. `seed` and
     `world` are read through calls because both belong to a run that has not
     started yet when this is built. */
  const seeded = env.seeded;
  const seed  = () => env.seed();
  const world = () => env.world();
  /* The Warrens needs three more things from the run: whether one has
     started at all, the block of rock the streamer has built around the
     ship, and how wide a chunk is. The rock is live state and stays the
     runtime's — this only reads the index. */
  const running  = () => !!env.running();
  const caveGrid = () => env.caveGrid();
  const CHUNK    = env.CHUNK;

/* One seed and one pair of chunk coordinates make one number, and that number
   makes one chunk. Mixed rather than added so neighbouring chunks are not
   neighbouring seeds — without the mixing, a row of chunks comes out as a row
   of near-identical fields, which reads as a corridor. */
function chunkSeed(cx, cy) {
  let h = seed() >>> 0;
  h = Math.imul(h ^ (cx + 0x9e3779b9), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (cy + 0xc2b2ae35), 0x27d4eb2f) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

const chunkKey = (cx, cy) => cx + "," + cy;

/* Like `chunkSeed` but on a position rather than a chunk index, for the things
   that belong to a *place* and must keep their identity however the chunk
   around them is rolled — a world's name, most of all. */
function hash2(a, b) {
  let h = seed() >>> 0;
  h = Math.imul(h ^ ((a | 0) + 0x7f4a7c15), 0x2545f491) >>> 0;
  h = Math.imul(h ^ ((b | 0) + 0x94d049bb), 0x9e3779b1) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/* ── how far out you are ──────────────────────────────────────────────────
   The sector used to be the same everywhere. Every chunk rolled from the same
   table however far you had flown, so 90,000 units out was the same trip as
   900 and the only thing distance cost you was time — which makes an endless
   map a long one rather than a deep one.

   Distance from the origin is the difficulty dial now. It thickens the field,
   posts more sentries, and pays better for all of it, so going further is a
   decision with two sides rather than a formality. It is a smooth curve and
   never a wall: there is no line you cross where the sector turns on you, and
   home is always the quiet end. */
/* Distance from the origin is the difficulty dial, and these are the numbers
   behind it. The curve inside a band is smooth — nothing switches on, there is
   no seam anywhere — but the bands are named, because "UNSETTLED" is something
   a pilot can make a decision about and 0.47 is not.

   It runs to 320,000 units and then keeps going: abyssal space returns more
   than 1, so everything downstream that multiplies by it gets worse forever
   rather than flattening out at the edge of the table. */
/* Seven bands rather than six, and they run as far as the ladder does. They
   used to top out at 320,000 — which was past the last landmark, so it never
   mattered — and stretching the sector to three and a half million would have
   left everything beyond the fifth rung sitting in one flat band, identically
   dangerous for nine tenths of the game.

   The near bands are unchanged, because the first hour should feel the way it
   did. */
const BANDS = [
  { to:     6000, name: "HOME",      colour: "#6dffbf" },
  { to:    25000, name: "OPEN",      colour: "#ffe56d" },
  { to:    60000, name: "UNSETTLED", colour: "#ffcb42" },
  { to:   180000, name: "HOSTILE",   colour: "#ff9d5c" },
  { to:   600000, name: "DEEP",      colour: "#ff6d8f" },
  { to:  1800000, name: "ABYSSAL",   colour: "#ff4d6d" },
  { to: Infinity, name: "THE LONG DARK", colour: "#c9407f" }
];
const DANGER_FULL = 1800000;
// Soft-capped rather than clamped: past the last band it keeps climbing, just
// slowly, so the abyss is always worse than the deep.
function dangerAt(x, y) {
  const d = Math.hypot(x, y) / DANGER_FULL;
  return d <= 1 ? d : 1 + Math.min(0.5, (d - 1) * 0.35);
}
function bandAt(x, y) {
  const d = Math.hypot(x, y);
  for (const b of BANDS) if (d < b.to) return b;
  return BANDS[BANDS.length - 1];
}

/* ── regions ──────────────────────────────────────────────────────────────
   What was wrong: a sector's variety came from exactly two things — one roll of
   abundances for the *whole world*, and a danger curve that rises with distance
   from home. So density changed as you flew out and **shape never did**. Every
   piece of sky was the same piece of sky with more or less in it.

   That was survivable when the furthest landmark was 112,000 units out. It
   stopped being survivable when 6.7 stretched the ladder to 3,400,000 — sixteen
   ten-minute flights to the finale — because the stretch bought twenty hours of
   game by asking you to cross more space, and crossing homogeneous space is
   commuting.

   A region is a *place*: a stretch of sky tens of thousands of units across
   with its own character. It multiplies the world's abundances rather than
   replacing them, so a world that is short of wells is still short of them in
   its well-riddled regions — the world says what kind of world it is and the
   region says what kind of *here* this is.

   It is a **pure function of position**, like the danger band, which is the
   whole reason it is affordable: nothing is stored, nothing can desync, a chunk
   stays a pure function of its coordinates, and flying away and back finds the
   same place. */
const REGIONS = [
  /* **Ordinary space is the commonest thing in the galaxy**, and it has to be,
     or none of the rest reads as unusual. A third of the sky is this: the
     world's own abundances, untouched, and a sky that looks the way the sky
     looks. Everything below is a deviation from it and is only legible as one
     because this exists. */
  { key: "normal", name: "ORDINARY SPACE", colour: "#8a93a8", weight: 10,
    rocks: 1, style: "rough", scan: 1, traffic: 1, ice: 1, d: {} },

  { key: "reach", name: "SETTLED REACH", colour: "#6dffbf", weight: 3,
    rocks: 0.7, style: "rough", scan: 1, traffic: 1.2, ice: 1,
    d: { stations: 2.6, planets: 1.7, wells: 0.6, fields: 0.4, wrecks: 0.7 } },
  { key: "belt", name: "THE BELT", colour: "#c0a487", weight: 3,
    rocks: 2.6, style: "rough", scan: 1, traffic: 0.7, ice: 1.2,
    d: { fields: 3.4, wrecks: 1.2, stations: 0.5, planets: 0.6 } },
  { key: "shards", name: "SHARD FIELD", colour: "#bfe8ff", weight: 2,
    rocks: 2.1, style: "shard", scan: 1, traffic: 0.6, ice: 1,
    d: { fields: 2.6, wells: 0.7, planets: 0.5, stations: 0.4 } },
  { key: "rounds", name: "THE ROUNDS", colour: "#ffd76d", weight: 1.4,
    rocks: 1.7, style: "round", scan: 1, traffic: 0.6, ice: 1,
    d: { fields: 2.2, wells: 0.5, planets: 0.4, stations: 0.3, caches: 1.4 } },
  /* Cloud and murk both cut what you can see; they differ in what it costs.
     A cloud is thick and full of things, and a murk is thin and *lies to your
     instruments* — the scan comes back short, so you fly it by eye. */
  { key: "cloud", name: "THE VIOLET CLOUD", colour: "#a08cff", weight: 2,
    rocks: 1.2, style: "rough", scan: 0.55, traffic: 0.7, ice: 1,
    sky: { tint: "#a08cff", stars: 0.9 },
    d: { nebulae: 7, wrecks: 1.6, stations: 0.5, caches: 1.5 } },
  { key: "murk", name: "THE MURK", colour: "#5f6b7d", weight: 1.5,
    /* A tenth of the scan at the middle of one. That is 210 units, which is
       not scanning — it is confirming that something is directly in front of
       you — and it is the point: in here you fly on your eyes. */
    rocks: 0.9, style: "rough", scan: 0.1, traffic: 0.6, ice: 1,
    // You cannot see far in here, and the sky should not pretend otherwise.
    sky: { tint: "#5f6b7d", stars: 0.55 },
    d: { nebulae: 3, stations: 0.4, caches: 1.3, wrecks: 1.4 } },
  { key: "bones", name: "THE BONEYARD", colour: "#7d8596", weight: 1.5,
    rocks: 1.1, style: "shard", scan: 1, traffic: 0.5, ice: 0.8,
    sky: { tint: "#7d8596", stars: 1 },
    d: { wrecks: 4.5, caches: 1.8, stations: 0.4, planets: 0.5 } },
  { key: "maw", name: "THE WELLS", colour: "#b79aff", weight: 1.5,
    rocks: 0.9, style: "rough", scan: 1, traffic: 0.4, ice: 1,
    d: { wells: 3.6, planets: 0.5, stations: 0.3, fields: 0.6 } },
  /* Water stops being the thing that limits you. A region of small ice bodies
     turns range into a non-question for anybody carrying a melter, which is a
     rule change rather than a decoration: the same ship can go twice as far
     from here. */
  /* **Nothing but ice.** Small bodies as far as the scan reaches and almost
     nothing else in it — no wrecks worth the name, few worlds, hardly anybody
     living there. What it has instead is water, which is the thing that decides
     how far you can go, so a ship with a melter can treat it as a place to
     refill rather than a place to cross. */
  { key: "rime", name: "THE RIME", colour: "#bfe8ff", weight: 1.5,
    rocks: 2.4, style: "round", scan: 1, traffic: 0.35, ice: 40,
    // The bodies here are already drawn as ice. The sky agrees with them.
    sky: { tint: "#bfe8ff", stars: 1 },
    d: { fields: 3, wells: 0.3, stations: 0.2, planets: 0.25,
         wrecks: 0.1, caches: 0.4, nebulae: 0.3 } },
  /* ── the one you fly *through* ──────────────────────────────────────────
     Every other region is a rule about what space contains. This one is a rule
     about the shape of the space itself: it is made of rock, and what you do
     in it is thread passages.

     Almost nothing else is allowed in. A world inside a cave system makes no
     sense, a station in one has no way to trade, and an asteroid field is rock
     inside rock. What it has instead is what you would actually hide in a cave
     — caches, and the ships that did not get out. Traffic is near zero on
     purpose: nobody flies through here, so it is somewhere you are alone. */
  { key: "warrens", name: "THE WARRENS", colour: "#b08968", weight: 1.2,
    rocks: 0.25, style: "shard", scan: 0.7, traffic: 0.12, ice: 1,
    // `fill` is how much of the deepest part is rock. See `caveFillAt`.
    // `cave` is the switch; the shape is in `tunnelNode` and `caveEdge`.
    cave: true,
    sky: { tint: "#b08968", stars: 0.7 },
    d: { planets: 0, wells: 0, stations: 0, fields: 0.05, nebulae: 0.2,
         caches: 3.4, wrecks: 2.2, gates: 0.5 } },

  { key: "lanes", name: "THE LANES", colour: "#ffcb42", weight: 1.6,
    rocks: 0.8, style: "rough", scan: 1, traffic: 1.5, ice: 1,
    d: { stations: 1.7, gates: 1.8, wrecks: 1.3, fields: 0.5 } },

  /* ── the two rare ones ──────────────────────────────────────────────────
     Both are about one crossing in a hundred, and both should be a story
     somebody tells afterwards rather than a place on a route. */
  { key: "city", name: "THE WORKS", colour: "#ffe56d", weight: 0.4,
    rocks: 0.5, style: "rough", scan: 1, traffic: 2.1, ice: 0.8,
    sky: { tint: "#ffe56d", stars: 1 },
    d: { stations: 7, planets: 2.4, gates: 2, wells: 0.3, fields: 0.2 } },
  /* See BIOMES.md. Nothing here, for a very long way, with no explanation and
     no label — and it is one of the two rarest things in the galaxy, because
     the whole effect depends on hours of ordinary space first. */
  { key: "open", name: "THE LONG EMPTY", colour: "#4a5266", weight: 0.5,
    /* **Nothing.** Not "almost nothing" — the first version of this was a set
       of small multipliers, 0.04 of the rock and a twentieth of the traffic,
       which is a thin scattering of everything rather than an absence. A thin
       scattering reads as an ordinary quiet stretch; the thing that makes
       somebody wonder whether the generator has broken is finding *not one
       single object* for six minutes.

       `nothing` is a hard switch rather than a multiplier, because a floor
       somewhere else in the generator can quietly turn a zero back into a
       trickle — two of them already did: the well roll and the gate roll both
       clamp the abundance to a minimum of 0.05 so that a "SEALED" world still
       has gates. Nothing multiplied by anything is still something if somebody
       puts a `Math.max` in the way. */
    nothing: true,
    /* The one place the *backdrop* joins in. Everything else here is an
       absence of objects, and a sky full of stars over it reads as an ordinary
       quiet stretch — which is the exact thing this region is not. Thinning it
       is what makes somebody check whether something has broken. */
    sky: { tint: "#4a5266", stars: 0.4 },
    rocks: 0, style: "rough", scan: 1, traffic: 0, ice: 1,
    d: { wells: 0, planets: 0, wrecks: 0, gates: 0, stations: 0,
         nebulae: 0, fields: 0, caches: 0 } }
];
/* **How long it takes to cross one.** This has been set three times and the
   history is the argument, so it is kept:

     · **31,200 — a minute.** A minute of anything is a stretch of scenery. It
       is not a *place*, and it is certainly not somewhere you could start
       wondering whether the generator had broken.
     · **200,000 — six minutes.** Sized from five-to-twenty minutes at cruise,
       which is 170,000 to 690,000 units. It made every patch unmistakably a
       place. What it also did was make a sector *monotonous at the scale
       anybody actually plays it*: measured, a run reaching the abyssal
       boundary passed through six to nine of the thirteen kinds, and the first
       two hundred thousand units of every world were one thing.
     · **93,000 — three minutes**, which is here. Long enough that a patch is
       still somewhere rather than scenery, short enough that the thing the
       biomes exist for — noticing that the rules changed — happens more than
       a handful of times in a run.

   `test/biomes.js` measures what this actually produces rather than trusting
   the arithmetic: the Voronoi jitters and neighbours of a kind merge, so the
   patch you fly across is never exactly the cell. */
const REGION_CELL = 93000;
const regionCache = new Map();

/* Nearest jittered site among the nine cells around a point. A plain grid would
   make regions square and the boundaries axis-aligned, which reads as a
   chessboard the moment you see two of them meet; jittering the site inside its
   cell and taking the nearest makes the borders irregular and the shapes
   unequal, which is what a region of space should look like. */
function regionAt(x, y) {
  const cx = Math.floor(x / REGION_CELL), cy = Math.floor(y / REGION_CELL);
  const key = cx + "," + cy;
  let near = regionCache.get(key);
  if (!near) {
    near = [];
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        near.push(regionSite(cx + i, cy + j));
      }
    }
    if (regionCache.size > 400) regionCache.clear();
    regionCache.set(key, near);
  }
  let best = near[0], bd = Infinity;
  for (const st of near) {
    const d = (st.x - x) * (st.x - x) + (st.y - y) * (st.y - y);
    if (d < bd) { bd = d; best = st; }
  }
  return best.region;
}

/* Where a region cell's middle actually sits, and which region it is. Seeded
   off the sector, so two sectors do not lay their regions out the same way. */
/* Memoised. It is a pure function of its cell and the sector seed, and it went
   from being asked nine times per *chunk* to nine times per solidity test the
   day the Warrens arrived — `regionDepth` walks the nine neighbours, and the
   rock asks `regionDepth` about every lattice cell it builds. Uncached that
   put the survey suite from three and a half minutes past ten.

   Cleared with `regionCache`, and by the same rule: a new sector is a new
   lattice, and `setupSurvey` empties both. */
const siteCache = new Map();
function regionSite(cx, cy) {
  const ck = cx + "," + cy;
  const had = siteCache.get(ck);
  if (had) return had;
    /* `|| 1` as it always was. The other two readers of the seed answer 0
       before a run starts; this one answers 1, and the difference is load
       bearing — it is what keeps a region lattice from collapsing onto cell
       zero in the frame between boot and `setupSurvey`. */
    const sd = seed() || 1;
    const R = seeded(chunkSeed(cx * 7919 + 13, cy * 104729 - 7) ^ (sd >>> 0) ^ 0x51a3d7);
  const pool = REGIONS.filter(r => r.weight > 0);
  const total = pool.reduce((t, r) => t + r.weight, 0);
  let roll = R() * total, pick = pool[0];
  for (const r of pool) { roll -= r.weight; if (roll <= 0) { pick = r; break; } }
  const site = { x: (cx + 0.18 + R() * 0.64) * REGION_CELL,
                 y: (cy + 0.18 + R() * 0.64) * REGION_CELL,
                 region: pick, cx, cy };
  if (siteCache.size > 4000) siteCache.clear();
  siteCache.set(ck, site);
  return site;
}

/* How deep into its own region a point is: 0 at a border and 1 at the site in
   the middle. The Voronoi already knows — the nearest site and the second
   nearest are the two it compared — so this is the ratio between them, and it
   is what lets a region get *worse* the further in you go rather than switching
   on at a line. A rule that steps at a border is a rule you can see the edge
   of; one that deepens is one you notice happening to you. */
function regionDepth(x, y) {
  const cx = Math.floor(x / REGION_CELL), cy = Math.floor(y / REGION_CELL);
  let d1 = Infinity, d2 = Infinity;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const st = regionSite(cx + i, cy + j);
      const d = Math.hypot(st.x - x, st.y - y);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
  }
  if (!isFinite(d2) || d2 <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - d1 / d2));
}

/* Home is always settled. The first two minutes are the same promise in every
   sector — the same reason the home band stays quiet — and dropping a new pilot
   into the middle of a well cluster would be a different game.

   A distance rather than a fraction of the region cell, which is what it used
   to be. The two numbers answer different questions — this one is "how far does
   the opening need to be predictable for", and the cell is "how big is a place"
   — and tying them together meant that shrinking the patches silently halved
   the opening as a side effect. 30,000 covers the Home and Open bands, which
   is where the opening happens and where the first two yard parts are. */
const HOME_REACH = 30000;
function regionOf(x, y) {
  // Home is *ordinary* space, not a busy one. It used to return the settled
  // region, which put nearly twice the usual traffic around the one station
  // you cannot avoid.
  if (x * x + y * y < HOME_REACH * HOME_REACH) return REGIONS[0];
  return regionAt(x, y);
}

// How abundant a thing is *here*. The world's own roll, multiplied by what this
// region does to it. 1 anywhere a world has not been rolled yet.
function abund(key, x, y) {
  const w = (world() ? world().d[key] : 1);
  if (x === undefined) return w;
  const reg = regionOf(x, y);
  // `traffic` is the region's own, not one of the world's traits.
  if (key === "traffic") return reg.traffic === undefined ? 1 : reg.traffic;
  const r = reg.d[key];
  return w * (r === undefined ? 1 : r);
}

/* ══ THE WARRENS ═══════════════════════════════════════════════════════════
   A region that is *made of rock*, with tunnels bored through it.

   ── the thing this got wrong twice ──
   The first two versions thresholded noise: open space by default, with masses
   of rock in it. However it was shaded and however the discs were jittered, it
   came out as **bubbles** — because that is what it was. A field of separate
   blobs seen from outside is a field of blobs; nothing about the drawing can
   make it a tunnel, because the player was never inside anything.

   It is the other way round. **Rock is everywhere, and the passage is the
   hole.** Then the only edge you ever see is the wall of the tunnel you are
   in, which is a winding line rather than a row of circles, and the shape of
   the space is something you are *in* rather than something you are among.

   ── how a tunnel can be chunk-pure ──
   Chunks are 2,600 units, built independently from `(seed, cx, cy)` with no
   knowledge of their neighbours, so nothing may be carved by walking a path
   and remembering where it has been. Instead the network is a lattice: a node
   per coarse cell at a hashed position, joined to the node east of it and,
   more often than not, the node south of it. Any point can ask which segments
   could possibly reach it by looking at the handful of nodes around it, and
   two chunks either side of a line get the same answer because they are asking
   about the same nodes.

   ── what makes it feel like a cave rather than a pipe ──
   Three things, all hashed off the nodes so they cost nothing and repeat
   exactly:

     · **the width changes.** Each node has its own bore, from a squeeze you
       have to line up for to a chamber several times the ship's length, and
       the passage lerps between them along its run.
     · **the walls are rough in some places and smooth in others.** Each node
       carries a roughness, and where it is high the wall is bitten into by a
       high-frequency wobble; where it is low the wall is a clean curve.
     · **there are rooms.** One node in seven opens out into a chamber, which
       is where the caches are and where a fight has somewhere to happen. */
const CAVE_CELL = 150;        // the lattice the rock is stamped on
const TUNNEL_CELL = 2200;     // one node of the network
const BORE_MIN = 95;          // a squeeze
const BORE_MAX = 260;         // an ordinary passage
const ROOM_BORE = 620;        // and a chamber

function caveHash(gx, gy, salt) {
  let h = (seed() || 1) ^ (salt * 0x9e3779b1);
  h = Math.imul(h ^ (gx + 0x7f4a7c15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (gy + 0x165667b1), 0xc2b2ae35) >>> 0;
  h ^= h >>> 15;
  return (h >>> 8) / 0x1000000;
}

/* Value noise, one call, used only to rough the walls up. The rock itself is
   not noise any more — it is everything the tunnels have not taken. */
function caveOctave(x, y, scale, salt) {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = caveHash(x0, y0, salt), b = caveHash(x0 + 1, y0, salt);
  const c = caveHash(x0, y0 + 1, salt), d = caveHash(x0 + 1, y0 + 1, salt);
  const top = a + (b - a) * sx, bot = c + (d - c) * sx;
  return top + (bot - top) * sy;
}

/* A node: where it is, how wide the passage is there, and how rough its walls
   are. All three from the same cell's hashes, so a node is a fact about its
   coordinates and nothing else. */
function tunnelNode(nx, ny) {
  const jx = caveHash(nx, ny, 1), jy = caveHash(nx, ny, 2);
  const w = caveHash(nx, ny, 3), rough = caveHash(nx, ny, 4);
  const room = caveHash(nx, ny, 5) < 0.14;
  return {
    x: (nx + 0.18 + jx * 0.64) * TUNNEL_CELL,
    y: (ny + 0.18 + jy * 0.64) * TUNNEL_CELL,
    // Cubed, so most of the network is ordinary and a squeeze is a real event.
    bore: room ? ROOM_BORE : BORE_MIN + (BORE_MAX - BORE_MIN) * w * w * w,
    rough, room
  };
}

/* ── a passage bends ──────────────────────────────────────────────────────
   A link drawn straight from one node to the next is a corridor in a building,
   not a tunnel in rock: it runs dead straight for a whole screen and reads as
   architecture. So every link bows, by a hashed amount to a hashed side, and
   the bow is taken from the pair of nodes so both ends agree about it without
   either knowing the other exists.

   Returned as a short list of points rather than as a curve, because the
   collision and the renderer both walk it and neither may have its own idea of
   where a passage goes. */
const LINK_STEPS = 3;
function linkPath(a, b, nx, ny, salt) {
  const bow = (caveHash(nx, ny, salt) - 0.5) * 0.44;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const cx = mx - dy * bow, cy = my + dx * bow;
  const pts = [];
  for (let i = 0; i <= LINK_STEPS; i++) {
    const t = i / LINK_STEPS, u = 1 - t;
    pts.push({
      x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
      y: u * u * a.y + 2 * u * t * cy + t * t * b.y,
      t
    });
  }
  return pts;
}

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L > 0 ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + dx * t, qy = ay + dy * t;
  return { d2: (px - qx) * (px - qx) + (py - qy) * (py - qy), t };
}

/* How much of the region's rock exists here at all. Zero at the border and
   full inside, so you are never met by the outside of a hundred thousand
   units of wall — the rock closes in as you go rather than starting as a
   cliff. Same `regionDepth` ramp as the Murk's static and the sky tint. */
function caveFillAt(x, y) {
  if (!running()) return 0;
  const reg = regionOf(x, y);
  if (!reg || !reg.cave) return 0;
  const t = regionDepth(x, y);
  const u = Math.max(0, Math.min(1, (t - 0.04) / 0.30));
  return u * u * (3 - 2 * u);
}

/* Inside a passage. Returns how far in, 0 at the wall and 1 at the middle, so
   the caller can tell a squeeze from a chamber — and so the wall can be
   roughened by an amount that fades to nothing rather than switching. */
/* The nearest passage spine: how far away it is and how wide it is there.
   Raw — the warp is applied by `caveEdge`, so this stays the cheap half and
   can be reused. */
function tunnelNear(x, y) {
  const nx = Math.floor(x / TUNNEL_CELL), ny = Math.floor(y / TUNNEL_CELL);
  let bd = Infinity, bb = 0;
  /* Three by three, not four by four. A node sits inside its own cell and its
     links run one cell east and one south; the bow pushes a link off the
     straight line by at most 0.44 of its length, and the widest chamber is a
     quarter of a cell. So nothing further than one cell away can reach a
     point — and the extra ring was 16 nodes where 9 do, which is 40% of the
     cost of every solidity test in the region, paid at chunk-build time. */
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = nx + i, gy = ny + j;
      const a = tunnelNode(gx, gy);
      const links = [[tunnelNode(gx + 1, gy), 12]];
      if (caveHash(gx, gy, 6) < 0.58) links.push([tunnelNode(gx, gy + 1), 13]);
      for (const [b, salt] of links) {
        const pts = linkPath(a, b, gx, gy, salt);
        for (let k = 0; k < pts.length - 1; k++) {
          const p = pts[k], q = pts[k + 1];
          const { d2, t } = segDist2(x, y, p.x, p.y, q.x, q.y);
          const along = p.t + (q.t - p.t) * t;
          const d = Math.sqrt(d2);
          if (d < bd) { bd = d; bb = a.bore + (b.bore - a.bore) * along; }
        }
      }
    }
  }
  return bd === Infinity ? null : { d: bd, bore: bb };
}

/* ── why there is a warp ───────────────────────────────────────────────────
   "Inside a passage" was `distance to the centreline < bore`, and that makes a
   **tube**: a constant cross-section with two walls that are mirror images and
   ends that are circles. It is the shape of a pipe, and no amount of shading
   turns a pipe into a cave, because the thing that makes a cave a cave is that
   the two walls have nothing to do with each other. One bulges into an alcove
   while the other runs straight past it.

   So the boundary is displaced by noise sampled *in the world*, not along the
   passage. A point on the left wall and the point opposite it on the right ask
   different places and get different answers, so the walls stop agreeing —
   which is the whole of it. Three octaves: one that opens chambers and closes
   throats, one that puts bays and buttresses in, and one that roughens.

   `caveEdge` is negative inside the passage and positive in rock, and it is
   the only definition of where the wall is. Collision reads it, the streamer
   reads it, and the renderer traces it. */
function caveWarp(x, y) {
  return (caveOctave(x, y, 860, 21) - 0.5) * 2 * 0.62 +
         (caveOctave(x, y, 330, 22) - 0.5) * 2 * 0.27 +
         (caveOctave(x, y, 118, 23) - 0.5) * 2 * 0.11;
}

function caveEdge(x, y) {
  const t = tunnelNear(x, y);
  if (!t) return 1e6;
  // The warp moves the wall by up to about two thirds of the passage's width,
  // which is the difference between an irregular passage and a wobbly pipe.
  return t.d - (t.bore * (1 + caveWarp(x, y) * 0.66));
}

// Rock is everything the region claims and the passages have not taken.
const caveSolidAt = (x, y) =>
  caveFillAt(x, y) > 0.35 && caveEdge(x, y) > 0;

/* Somewhere open, near a point. Nothing may ever be left inside rock — a hull
   dropped into a mass cannot fly out of it, because collision pushes it off
   each disc in turn and there is always another one behind. A gate mouth, a
   jump or a respawn all come through here. */
function outOfRock(x, y) {
  const clear = (px, py) => caveFillAt(px, py) <= 0.35 ||
                            caveEdge(px, py) < -CAVE_CELL * 0.9;
  if (clear(x, y)) return { x, y };
  const step = CAVE_CELL * 1.5;
  for (let ring = 1; ring <= 40; ring++) {
    const n = ring * 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.37;
      const px = x + Math.cos(a) * ring * step;
      const py = y + Math.sin(a) * ring * step;
      if (clear(px, py)) return { x: px, y: py };
    }
  }
  return { x, y };
}

/* The rock of one chunk, as collision discs. A cell belongs to the chunk that
   contains it and the arithmetic has to say so exactly once — `ceil` at both
   ends does; `ceil` then `floor` left the cell sitting on the line built by
   neither chunk, which is a missing column of rock at every boundary in the
   region and a gap in the wall from the inside. */
function caveSegsIn(cx, cy) {
  const ox = cx * CHUNK, oy = cy * CHUNK;
  if (caveFillAt(ox + CHUNK / 2, oy + CHUNK / 2) <= 0.35 &&
      caveFillAt(ox, oy) <= 0.35 &&
      caveFillAt(ox + CHUNK, oy + CHUNK) <= 0.35) return [];
  const segs = [];
  const g0 = Math.ceil(ox / CAVE_CELL), g1 = Math.ceil((ox + CHUNK) / CAVE_CELL);
  const h0 = Math.ceil(oy / CAVE_CELL), h1 = Math.ceil((oy + CHUNK) / CAVE_CELL);
  for (let gx = g0; gx < g1; gx++) {
    for (let gy = h0; gy < h1; gy++) {
      const x = gx * CAVE_CELL, y = gy * CAVE_CELL;
      if (!caveSolidAt(x, y)) continue;
      /* Only the *surface*. A disc buried inside a mass can never be touched
         by anything, and there are four or five of those for every one on the
         wall — carrying them costs a collision test per frame each and buys
         nothing. A cell with a neighbour in open space is on the wall; a cell
         surrounded by rock is not.

         All **eight** neighbours, not four. With only the orthogonal ones, a
         cell whose open neighbour is diagonal gets no disc — and a diagonal
         gap between two surface discs is a gap something can fly through.
         Measured: 5 of 24 probes driven flat at a wall got inside it through
         exactly that corner. */
      let buried = true;
      for (let ox2 = -1; ox2 <= 1 && buried; ox2++) {
        for (let oy2 = -1; oy2 <= 1; oy2++) {
          if (!ox2 && !oy2) continue;
          if (!caveSolidAt(x + ox2 * CAVE_CELL, y + oy2 * CAVE_CELL)) {
            buried = false; break;
          }
        }
      }
      if (buried) continue;
      /* Big enough that neighbours overlap across the corner — under about
         0.71 of a cell the mass falls apart into separate circles, which is
         the bubble this whole system was rebuilt to stop being. There is no
         jitter: the rock is a solid field now and its only visible edge is the
         tunnel wall, whose shape comes from the bore and the roughness. */
      segs.push({ x, y, r: CAVE_CELL * 0.78 });
    }
  }
  return segs;
}

/* Rock near a point, out of the index built by `streamChunks`. Returns an
   empty list anywhere there is no cave, which is almost everywhere. */
const CAVE_GRID_CELL = 420;
const NO_ROCK = [];
function caveNear(x, y) {
  const grid = caveGrid();
  if (!grid) return NO_ROCK;
  const gx = Math.floor(x / CAVE_GRID_CELL), gy = Math.floor(y / CAVE_GRID_CELL);
  const out = [];
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cell = grid.get((gx + i) + "," + (gy + j));
      if (cell) for (const g of cell) out.push(g);
    }
  }
  return out;
}

/* ── what colour this cave is ──────────────────────────────────────────────
   Bright, and a different one per cave system, hashed off the region site's
   own cell. The first version drew the walls in a dim brown that agreed with
   the sky tint, which was tasteful and nearly invisible — and the one thing
   you must be able to see at a glance in here is where the rock is. */
const CAVE_TINTS = [
  "#6dffbf", "#87d8ff", "#ffcb42", "#ff8f77",
  "#a08cff", "#6dffff", "#ffe56d", "#ff6dd8"
];

function caveTint(x, y) {
  const cx = Math.floor(x / REGION_CELL), cy = Math.floor(y / REGION_CELL);
  let best = null, bd = Infinity;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const st = regionSite(cx + i, cy + j);
      const d = (st.x - x) * (st.x - x) + (st.y - y) * (st.y - y);
      if (d < bd) { bd = d; best = st; }
    }
  }
  if (!best) return CAVE_TINTS[0];
  const h = Math.abs(Math.round(caveHash(best.cx, best.cy, 11) * 1024));
  return CAVE_TINTS[h % CAVE_TINTS.length];
}


  /* A new sector is a new lattice. `setupSurvey` calls this; both caches
     memoise pure functions of a cell and the sector seed, so carrying one
     across a reset would lay the old sector's places over the new one. */
  function clearCaches() {
    regionCache.clear();
    siteCache.clear();
  }

  return {
    chunkSeed, chunkKey, hash2,
    BANDS, DANGER_FULL, dangerAt, bandAt,
    REGIONS, REGION_CELL, HOME_REACH,
    regionAt, regionSite, regionDepth, regionOf, abund,
    /* The Warrens: a region that is made of rock, with tunnels bored through
       it. It lives here because it is terrain of a region and reads the same
       lattice — `regionOf`, `regionDepth` — that decides where it exists. */
    CAVE_CELL, CAVE_GRID_CELL, caveHash, caveFillAt, caveEdge, caveWarp,
    caveSolidAt, outOfRock, caveSegsIn, caveNear, caveTint,
    clearCaches
  };
};
