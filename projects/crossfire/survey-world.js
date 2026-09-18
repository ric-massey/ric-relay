"use strict";

/* CROSSFIRE — SURVEY'S GEOGRAPHY
   ─────────────────────────────────────────────────────────────────────────────
   Where you are, and what that means. Three things, and every one of them a
   pure function of a seed and a pair of coordinates:

     · **identity** — one seed and one pair of chunk coordinates make one
       number, and that number makes one chunk. This is what "the world is its
       seed" means in practice, and nothing in the mode is allowed to be true
       of a place in any other way.
     · **how dangerous a place is** — the biome's own danger and the kind of
       space it is, averaged. It is deliberately *not* distance: it used to be a
       smooth curve from the origin under seven named bands, and `dangerAt`
       below says why that went.
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

/* ── how dangerous a place is ─────────────────────────────────────────────
   Two dials, and neither of them is distance.

   It used to be one number rising in a straight line from home, with seven
   named rings over it (HOME, OPEN, UNSETTLED … THE LONG DARK) and the ring's
   name permanently in the top right. So the whole sector read as a target:
   every biome was cut on the home circle, the only place name anybody ever
   saw was a radius, and danger swamped everything a biome did. Ric: *"take
   the danger rings off. it will instead be based by boime and who owns that
   space."*

     · **nature** is the biome's — rock, wells, fields, the size of what lives
       in them and the rarity of what is in its caches. It is a pure function
       of the seed and never moves, because a world is still its seed.
     · **people** is the owner's — traffic, pirates, battles, whose flag is on
       the dock. It is what moves when a border moves.

   `dangerAt` is the two together, for the things that belong to both: what a
   place pays, what a shelf stocks, what a find is worth. It runs 0 for the
   calmest sky there is to 1 for a well cluster on a front line, and calm sky
   really is near 0 — every reader of it was written against a curve whose
   home end was nothing, and the first two minutes still are. */
const DANGER_FLOOR = 0.15, DANGER_SPAN = 0.7;
const natureAt = (x, y) => regionOf(x, y).danger;
const peopleAt = (x, y) => spaceAt(x, y).people;
function dangerAt(x, y) {
  const raw = (natureAt(x, y) + peopleAt(x, y)) / 2;
  return Math.max(0, Math.min(1, (raw - DANGER_FLOOR) / DANGER_SPAN));
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

   It is a **pure function of position**, which is the whole reason it is
   affordable: nothing is stored, nothing can desync, a chunk stays a pure
   function of its coordinates, and flying away and back finds the same
   place. */
const REGIONS = [
  /* **Ordinary space is the commonest thing in the galaxy**, and it has to be,
     or none of the rest reads as unusual. A third of the sky is this: the
     world's own abundances, untouched, and a sky that looks the way the sky
     looks. Everything below is a deviation from it and is only legible as one
     because this exists. */
  { key: "normal", danger: 0.15, name: "ORDINARY SPACE", colour: "#8a93a8", weight: 10,
    rocks: 1, style: "rough", scan: 1, traffic: 1, ice: 1, d: {} },

  { key: "reach", danger: 0.1, name: "SETTLED REACH", colour: "#6dffbf", weight: 3,
    rocks: 0.7, style: "rough", scan: 1, traffic: 1.2, ice: 1,
    d: { stations: 2.6, planets: 1.7, wells: 0.6, fields: 0.4, wrecks: 0.7 } },
  { key: "belt", danger: 0.45, name: "THE BELT", colour: "#c0a487", weight: 3,
    rocks: 2.6, style: "rough", scan: 1, traffic: 0.7, ice: 1.2,
    d: { fields: 3.4, wrecks: 1.2, stations: 0.5, planets: 0.6 } },
  { key: "shards", danger: 0.5, name: "SHARD FIELD", colour: "#bfe8ff", weight: 2,
    rocks: 2.1, style: "shard", scan: 1, traffic: 0.6, ice: 1,
    d: { fields: 2.6, wells: 0.7, planets: 0.5, stations: 0.4 } },
  { key: "rounds", danger: 0.35, name: "THE ROUNDS", colour: "#ffd76d", weight: 1.4,
    rocks: 1.7, style: "round", scan: 1, traffic: 0.6, ice: 1,
    d: { fields: 2.2, wells: 0.5, planets: 0.4, stations: 0.3, caches: 1.4 } },
  /* Cloud and murk both cut what you can see; they differ in what it costs.
     A cloud is thick and full of things, and a murk is thin and *lies to your
     instruments* — the scan comes back short, so you fly it by eye. */
  { key: "cloud", danger: 0.4, name: "THE VIOLET CLOUD", colour: "#a08cff", weight: 2,
    rocks: 1.2, style: "rough", scan: 0.55, traffic: 0.7, ice: 1,
    sky: { tint: "#a08cff", stars: 0.9 },
    d: { nebulae: 7, wrecks: 1.6, stations: 0.5, caches: 1.5 } },
  { key: "murk", danger: 0.6, name: "THE MURK", colour: "#5f6b7d", weight: 1.5,
    /* A tenth of the scan at the middle of one. That is 210 units, which is
       not scanning — it is confirming that something is directly in front of
       you — and it is the point: in here you fly on your eyes. */
    rocks: 0.9, style: "rough", scan: 0.1, traffic: 0.6, ice: 1,
    // You cannot see far in here, and the sky should not pretend otherwise.
    sky: { tint: "#5f6b7d", stars: 0.55 },
    d: { nebulae: 3, stations: 0.4, caches: 1.3, wrecks: 1.4 } },
  { key: "bones", danger: 0.55, name: "THE BONEYARD", colour: "#7d8596", weight: 1.5,
    rocks: 1.1, style: "shard", scan: 1, traffic: 0.5, ice: 0.8,
    sky: { tint: "#7d8596", stars: 1 },
    d: { wrecks: 4.5, caches: 1.8, stations: 0.4, planets: 0.5 } },
  { key: "maw", danger: 0.8, name: "THE WELLS", colour: "#b79aff", weight: 1.5,
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
  { key: "rime", danger: 0.3, name: "THE RIME", colour: "#bfe8ff", weight: 1.5,
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
  { key: "warrens", danger: 0.65, name: "THE WARRENS", colour: "#b08968", weight: 1.2,
    rocks: 0.25, style: "shard", scan: 0.7, traffic: 0.12, ice: 1,
    // `fill` is how much of the deepest part is rock. See `caveFillAt`.
    // `cave` is the switch; the shape is in `tunnelNode` and `caveEdge`.
    cave: true,
    sky: { tint: "#b08968", stars: 0.7 },
    d: { planets: 0, wells: 0, stations: 0, fields: 0.05, nebulae: 0.2,
         caches: 3.4, wrecks: 2.2, gates: 0.5 } },

  { key: "lanes", danger: 0.15, name: "THE LANES", colour: "#ffcb42", weight: 1.6,
    rocks: 0.8, style: "rough", scan: 1, traffic: 1.5, ice: 1,
    d: { stations: 1.7, gates: 1.8, wrecks: 1.3, fields: 0.5 } },

  /* ── the two rare ones ──────────────────────────────────────────────────
     Both are about one crossing in a hundred, and both should be a story
     somebody tells afterwards rather than a place on a route. */
  { key: "city", danger: 0.25, name: "THE WORKS", colour: "#ffe56d", weight: 0.4,
    rocks: 0.5, style: "rough", scan: 1, traffic: 2.1, ice: 0.8,
    sky: { tint: "#ffe56d", stars: 1 },
    d: { stations: 7, planets: 2.4, gates: 2, wells: 0.3, fields: 0.2 } },
  /* See BIOMES.md. Nothing here, for a very long way, with no explanation and
     no label — and it is one of the two rarest things in the galaxy, because
     the whole effect depends on hours of ordinary space first. */
  { key: "open", danger: 0.5, name: "EMPTINESS", colour: "#4a5266", weight: 0.5,
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

/* ── what the Deep Void is made of ────────────────────────────────────────
   A multiplier on each region's ordinary weight, used only in a void cell —
   see `regionSite`. Three of the fourteen are struck out outright, and they
   are the three that *are* people: SETTLED REACH is a settled place, THE
   LANES is a trade route, and THE WORKS is industry. None of them can exist
   somewhere nobody goes, and leaving them in at any weight was the thing that
   made the Void read as ordinary sky with the lights off.

   ORDINARY SPACE survives at a sixteenth, because "almost none" is a better
   sector than "none": one calm cell in a bad stretch is the thing that makes
   the rest of the stretch feel chosen rather than painted.

   Everything else leans the other way, hardest towards THE WELLS (the most
   dangerous terrain there is) and EMPTINESS (the emptiest). The result
   is an expected `nature` of about 0.58 out here against about 0.33 across the
   sector as a whole — the most dangerous *terrain* in the game by a wide margin,
   and dangerous for the opposite reason to a front. A front is dangerous because
   of who is there. This is dangerous because of what it is, and because there is
   no station in it to reach. */
const VOID_BIAS = {
  reach: 0, lanes: 0, city: 0,   // civilisation; it is not out here
  normal: 0.06,                  // almost none, rather than none
  rounds: 0.5, rime: 0.5,        // the mild ones, thinned
  belt: 0.8, cloud: 0.8,
  shards: 1.6, bones: 2, warrens: 2, murk: 2.4,
  maw: 2.6,                      // the wells: the worst of it
  open: 4                        // and EMPTINESS, which is the signature
};
const regionCache = new Map();

/* Nearest jittered site among the nine cells around a point. A plain grid would
   make regions square and the boundaries axis-aligned, which reads as a
   chessboard the moment you see two of them meet; jittering the site inside its
   cell and taking the nearest makes the borders irregular and the shapes
   unequal, which is what a region of space should look like. */
function regionAt(x, y) {
  return siteAt(x, y).region;
}
/* The site itself, not only its region: the cell it belongs to is also the unit
   of territory, so a border between two powers and a border between two biomes
   are drawn on the same lattice and can share an edge. */
function siteAt(x, y) {
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
  return best;
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
  /* ── and the Deep Void gets a different deck ──────────────────────────────
     The Void used to be a purely *political* fact — a cell nobody held — laid
     over whatever terrain the roll above happened to produce. So the deepest,
     emptiest sky in the sector was as likely to be Settled Reach as anything
     else, and the only thing that made it read as void was that the generator
     had been told to put no stations in it. The emptiness was an assertion.

     Now it is a consequence. A void cell re-rolls from `VOID_BIAS`: the
     settled biomes are struck out entirely — there is no Settled Reach, no
     Lanes and no Works out here, because those three *are* civilisation — and
     ordinary space is cut to a sixteenth. What is left is wells, murk, rock
     and Emptiness. **That** is why nobody lives there, and the flags, the
     stations and the traffic follow the terrain rather than standing in for it.

     Rolled on its own stream, salted differently, so that a cell that is not
     void is untouched down to its jitter: this moves the Void and nothing else.

     Keyed on `voidCell` rather than on `spaceAt().kind`, and that is load
     bearing. `spaceAt` folds in who holds a cell *now*, and claims change hands
     while you play — terrain that read off it would rewrite itself mid-save the
     first time a border moved. `voidCell` is a pure function of the cell and
     the seed, so this stays as fixed as every other piece of geography. */
  if (voidCell(cx, cy)) {
    const VR = seeded(chunkSeed(cx * 31337 + 7, cy * 15485863 + 11) ^
                      ((sd >>> 0) + 0x7a1d) ^ 0x1e35a7bd);
    const vp = REGIONS.filter(r => (VOID_BIAS[r.key] || 0) * r.weight > 0);
    const vt = vp.reduce((t, r) => t + r.weight * VOID_BIAS[r.key], 0);
    let vroll = VR() * vt;
    for (const r of vp) {
      vroll -= r.weight * VOID_BIAS[r.key];
      if (vroll <= 0) { pick = r; break; }
    }
  }
  /* Home is ordinary space, in every sector. The four cells that meet at the
     origin, rather than a radius: a radius cut every biome around home on a
     perfect circle, and sent out in 120 directions from home, 74 of them met
     their first biome at exactly 30,000. Four jittered cells make a home patch
     with an honest, crooked edge. The roll still happens first so the random
     stream — and the site's position — is the same as it always was. */
  if (homeCell(cx, cy)) pick = REGIONS[0];
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

/* The cells that meet at the origin. Home's biome and home's politics are both
   decided by this one test, so the two can never disagree about where home is. */
const homeCell = (cx, cy) => cx >= -1 && cx <= 0 && cy >= -1 && cy <= 0;
function regionOf(x, y) {
  return regionAt(x, y);
}

// How abundant a thing is *here*. The world's own roll, multiplied by what this
// region does to it. 1 anywhere a world has not been rolled yet.
function abund(key, x, y) {
  const w = (world() ? world().d[key] : 1);
  if (x === undefined) return w;
  const reg = regionOf(x, y);
  /* `traffic` is the region's own, not one of the world's traits — and the
     owner's. Who holds a piece of sky decides how many people fly through it
     as much as what kind of sky it is: the Deep Void is nearly empty of ships
     whatever its biome, and a front line is busy whatever its biome. */
  if (key === "traffic") {
    return (reg.traffic === undefined ? 1 : reg.traffic) * spaceAt(x, y).traffic;
  }
  const r = reg.d[key];
  const base = w * (r === undefined ? 1 : r);
  // A station is people too. Nobody builds one in the Void.
  return key === "stations" ? base * spaceAt(x, y).stations : base;
}

/* ══ WHO HOLDS THE SKY ═════════════════════════════════════════════════════
   Territory. See "Who holds the sky" in SURVEY-DONE.md.

   Every region cell is held by one of the three powers or by nobody, and the
   cells nobody holds are one of three kinds of nobody's, in Ric's words:

     · **the Frontier** — far star systems where civilisation is only just
       beginning to arrive. Home is here, always.
     · **Lawless space** — between rival powers, where no one group can
       enforce anything.
     · **the Deep Void** — the empty stretches between, with no stations and
       almost nobody in them.

   And a held cell with an enemy's territory close by is **the front**, where
   the war is actually being fought.

   ── how it is laid out ──
   Each power has a slow wave of influence over the lattice — one value-noise
   field each, a wave about eleven cells long — and a cell belongs to whichever
   power is strongest there, if that power is strong enough *and* clearly ahead.
   Where two are nearly level nobody holds it, and that seam is where lawless
   space comes from. A fourth, slower field carves the Void. Nothing here is
   a distance from home, so nothing here is a ring.

   ── how it moves ──
   The seeded map is only the starting position. `env.claims()` is a map of the
   cells that have changed hands since, and it wins over the seed wherever it
   has an entry. That is the whole of what a save needs to carry: the sky is
   endless and the changes are few. Anything that alters the claims must call
   `territoryChanged()`, because what a cell *is* depends on its neighbours. */
const POWERS = ["cordon", "hallow", "morrow"];
const POWER_GRAIN = 11;       // cells per wave of a power's influence
const POWER_FLOOR = 0.58;     // weaker than this and nobody holds it
const POWER_LEAD  = 0.1;      // closer than this to a rival and nobody holds it
const VOID_GRAIN  = 15.4;
const VOID_LINE   = 0.74;
/* How close an enemy has to be for a held cell to be the front, and how close
   two powers have to be for an unheld one to be lawless. Manhattan, in cells. */
const FRONT_REACH = 3;

const SPACES = {
  /* `people` is the owner's half of danger. `traffic`, `stations`, `pirates`,
     `battles` and `lived` multiply what the sector would otherwise put there. */
  territory: { key: "territory", name: "", colour: "",
               people: 0.2,  traffic: 1.1,  stations: 1.3,  pirates: 0.03,
               battles: 0.12, lived: 1.3 },
  front:     { key: "front", name: "THE FRONT", colour: "#ff9d5c",
               people: 0.8,  traffic: 1.2,  stations: 0.6,  pirates: 0.05,
               battles: 4,    lived: 0.8 },
  frontier:  { key: "frontier", name: "THE FRONTIER", colour: "#c8aa6e",
               people: 0.25, traffic: 0.55, stations: 0.8,  pirates: 0.1,
               battles: 0,    lived: 0.8 },
  lawless:   { key: "lawless", name: "LAWLESS SPACE", colour: "#ff5555",
               people: 0.75, traffic: 0.8,  stations: 0.45, pirates: 0.45,
               battles: 0.5,  lived: 0.5 },
  /* `people` was 0.15, the lowest of the five, and that stays roughly what it
     is: there genuinely are almost nobody out here, and this dial is the *other*
     half of danger — the owner's, "traffic, pirates, battles, whose flag is on
     the dock". Inflating it to make the Void frightening would be lying with the
     wrong number, and the first attempt at exactly that put the Void level with
     an open war front, which it should not be.

     0.3 rather than 0.15 is the one honest correction: a third of the few ships
     out here are raiders (`pirates` below is 0.3, six times a power's own space)
     and there is no law of any kind. It stays well under lawless space's 0.75
     and the front's 0.8, because those are dangerous for a reason the Void is
     not — somebody is *there*.

     **The Void's danger is the terrain's, and that is the point of it.** The
     bias in `regionSite` takes `nature` from about 0.33 to about 0.58 out here,
     which roughly doubles `dangerAt` on its own. What makes it frightening on
     top of that is not in this table at all and does not need to be: `stations`
     is 0, so there is nowhere to refill, and water is what limits how far you
     can go. */
  void:      { key: "void", name: "THE DEEP VOID", colour: "#4a5266",
               people: 0.3,  traffic: 0.05, stations: 0,    pirates: 0.3,
               battles: 0,    lived: 0 }
};

/* A number per lattice point, off the sector seed and a channel `k`. */
function latticeHash(a, b, k) {
  let h = (seed() || 1) >>> 0;
  h = Math.imul(h ^ ((a * 7919 + k * 31) | 0) ^ 0x2f6b1a3, 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ ((b * 104729 - k * 17) | 0) ^ 0x5bd1e995, 0x27d4eb2f) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
const smoothstep = t => t * t * (3 - 2 * t);
function valueNoise(x, y, k) {
  const X = Math.floor(x), Y = Math.floor(y);
  const fx = smoothstep(x - X), fy = smoothstep(y - Y);
  const a = latticeHash(X, Y, k), b = latticeHash(X + 1, Y, k);
  const c = latticeHash(X, Y + 1, k), d = latticeHash(X + 1, Y + 1, k);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/* The Void fades out towards home rather than stopping at a line — a hard stop
   was a square hole cut in whatever void happened to cover the origin. */
function voidCell(cx, cy) {
  if (homeCell(cx, cy)) return false;
  const d = Math.hypot(cx + 0.5, cy + 0.5) / 4;
  return valueNoise(cx / VOID_GRAIN, cy / VOID_GRAIN, 9) - 0.5 * Math.exp(-d * d) >
         VOID_LINE;
}

/* Who held a cell when the sector began. Memoised: it is a pure function of the
   cell and the seed, and it is asked for thirteen neighbours at a time. */
const holdCache = new Map();
function baseHold(cx, cy) {
  const key = cx + "," + cy;
  if (holdCache.has(key)) return holdCache.get(key);
  let owner = null;
  if (!homeCell(cx, cy) && !voidCell(cx, cy)) {
    let bk = -1, bv = -1, second = -1;
    for (let k = 0; k < POWERS.length; k++) {
      const v = valueNoise(cx / POWER_GRAIN, cy / POWER_GRAIN, k + 1) +
                0.12 * valueNoise(cx / 3, cy / 3, k + 11);
      if (v > bv) { second = bv; bv = v; bk = k; }
      else if (v > second) second = v;
    }
    if (bv >= POWER_FLOOR && bv - second >= POWER_LEAD) owner = POWERS[bk];
  }
  if (holdCache.size > 20000) holdCache.clear();
  holdCache.set(key, owner);
  return owner;
}

// Who holds it now: a claim if the war has moved it, the seed if not.
function holderOf(cx, cy) {
  const claims = env.claims ? env.claims() : null;
  if (claims) {
    const k = cx + "," + cy;
    if (claims.has(k)) return claims.get(k) || null;
  }
  return baseHold(cx, cy);
}

function enemiesOf(power) {
  const w = world();
  const live = env.war ? env.war() : null;
  const war = live || (w && w.war ? w.war : {});
  return war[power] ? [war[power]] : [];
}

/* What kind of space a cell is. Cached until the claims change, because the
   answer reads up to twelve neighbours and it is asked for every mote. */
const spaceCache = new Map();
function spaceOfCell(cx, cy) {
  const key = cx + "," + cy;
  const had = spaceCache.get(key);
  if (had) return had;
  const owner = holderOf(cx, cy);
  let kind, enemy = null;
  const near = [];
  for (let j = -FRONT_REACH; j <= FRONT_REACH; j++) {
    for (let i = -FRONT_REACH; i <= FRONT_REACH; i++) {
      if ((i || j) && Math.abs(i) + Math.abs(j) <= FRONT_REACH) {
        const o = holderOf(cx + i, cy + j);
        if (o && near.indexOf(o) < 0) near.push(o);
      }
    }
  }
  /* Two powers at war with each other both in reach of an unheld cell make it
     no-man's-land: the front, held by neither. Without this the front almost
     never existed — the seam between two powers is unheld by construction, so
     warring powers were nearly always a lawless strip apart and never touching. */
  const contested = near.find(o => enemiesOf(o).some(e => near.indexOf(e) >= 0));
  if (owner) {
    const foes = enemiesOf(owner);
    enemy = near.find(o => foes.indexOf(o) >= 0) || null;
    kind = enemy ? "front" : "territory";
  } else if (homeCell(cx, cy)) {
    kind = "frontier";
  } else if (voidCell(cx, cy) && !claimsHave(cx, cy)) {
    kind = "void";
  } else if (contested) {
    kind = "front";
    enemy = enemiesOf(contested)[0];
    // Neither side holds it; name the pair so the war it belongs to is known.
  } else {
    kind = near.length >= 2 ? "lawless" : "frontier";
  }
  /* How far into its owner's territory a held cell is: 1 on the border, up to 3
     three cells in, and 4 for anything deeper — the heartland. Pirates and other
     people's ships belong near the edge of somebody's space, not in the middle
     of it. */
  let inner = 0;
  if (owner) {
    inner = 4;
    for (let d = 1; d <= 3 && inner === 4; d++) {
      for (let j = -d; j <= d && inner === 4; j++) {
        for (let i = -d; i <= d; i++) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== d) continue;
          if (holderOf(cx + i, cy + j) !== owner) { inner = d; break; }
        }
      }
    }
  }
  const out = Object.assign({}, SPACES[kind], { kind, owner, enemy, inner, cx, cy });
  if (spaceCache.size > 20000) spaceCache.clear();
  spaceCache.set(key, out);
  return out;
}
function claimsHave(cx, cy) {
  const claims = env.claims ? env.claims() : null;
  return !!(claims && claims.has(cx + "," + cy));
}
const spaceAt = (x, y) => {
  const st = siteAt(x, y);
  return spaceOfCell(st.cx, st.cy);
};
// Call after anything changes hands. What a cell *is* depends on its neighbours.
function territoryChanged() { spaceCache.clear(); }

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
/* Memoised, and the reason is `tunnelNear`: it sweeps three by three and asks
   each cell for its own node *and* for its east and south neighbours' — so in
   one sweep most nodes are built three times, and the sweep itself runs again
   for every point tested in the region. A CPU profile of chunk generation put
   54% of the whole of it inside `caveHash`, five of which are spent here per
   call. The cache is exact rather than approximate: a node is a pure function
   of its cell and the sector seed, which is what `clearCaches` is for. */
const nodeCache = new Map();
function tunnelNode(nx, ny) {
  const key = nx + "," + ny;
  const had = nodeCache.get(key);
  if (had) return had;
  const jx = caveHash(nx, ny, 1), jy = caveHash(nx, ny, 2);
  const w = caveHash(nx, ny, 3), rough = caveHash(nx, ny, 4);
  const room = caveHash(nx, ny, 5) < 0.14;
  const node = {
    x: (nx + 0.18 + jx * 0.64) * TUNNEL_CELL,
    y: (ny + 0.18 + jy * 0.64) * TUNNEL_CELL,
    // Cubed, so most of the network is ordinary and a squeeze is a real event.
    bore: room ? ROOM_BORE : BORE_MIN + (BORE_MAX - BORE_MIN) * w * w * w,
    rough, room
  };
  /* Same bound and same rule as `siteCache`: a sector is walked outward, so
     the far side of a long flight is not coming back, and an unbounded map
     over a 1.8-million-unit sector is a leak rather than a cache. */
  if (nodeCache.size > 8000) nodeCache.clear();
  nodeCache.set(key, node);
  return node;
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
/* Not memoised, though it was for an hour. Its only caller is `cellSegs`, and
   `cellSegs` is itself cached by cell — so every key here would be asked for
   exactly once and a cache on it holds thousands of arrays at a hit rate of
   zero. Worth writing down because the profile that justified caching this was
   taken before `cellSegs` existed, and the same reasoning would justify it
   again on a stale reading. */
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

/* One scratch object, not a fresh one per segment. This is called for every
   segment of every link of all nine cells of a `tunnelNear` sweep, and it was
   16% of chunk generation — most of that the garbage it made rather than the
   arithmetic, which is nine lines of it. The single caller destructures the
   result on the line it gets it and never holds it across another call, so a
   shared object is safe; if a second caller ever appears, it has to copy what
   it keeps, which is what this comment is here to say. */
const segHit = { d2: 0, t: 0 };
function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L > 0 ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + dx * t, qy = ay + dy * t;
  segHit.d2 = (px - qx) * (px - qx) + (py - qy) * (py - qy);
  segHit.t = t;
  return segHit;
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
/* ── a cell's spines, flattened ───────────────────────────────────────────
   Everything `tunnelNear` needs from a cell is fixed by that cell's
   coordinates, so it is worked out once and kept as plain numbers: eight per
   segment — the two ends, the two `t`s along the link, and the bore at each
   node — laid end to end.

   Flat numbers rather than objects because of where this sits. The version
   below it built, on every single call and for each of nine cells, an array of
   `[node, salt]` pairs and then destructured them in a `for…of`; at three
   segments a link and up to two links a cell that is around thirty short-lived
   allocations per point tested, and a point is tested for every cell of the
   rock grid of every chunk. The arithmetic was never the cost. The garbage
   was.

   The order segments are emitted in is load-bearing and must not be tidied:
   the caller keeps the first of an equal pair (`d < bd`, strictly), so east
   before south, and along each link in path order, is part of the answer
   rather than part of the style. */
const cellCache = new Map();
function cellSegs(gx, gy) {
  const key = gx + "," + gy;
  const had = cellCache.get(key);
  if (had) return had;
  const a = tunnelNode(gx, gy);
  const segs = [];
  const addLink = (b, salt) => {
    const pts = linkPath(a, b, gx, gy, salt);
    for (let k = 0; k < pts.length - 1; k++) {
      const p = pts[k], q = pts[k + 1];
      segs.push(p.x, p.y, p.t, q.x, q.y, q.t, a.bore, b.bore);
    }
  };
  addLink(tunnelNode(gx + 1, gy), 12);
  if (caveHash(gx, gy, 6) < 0.58) addLink(tunnelNode(gx, gy + 1), 13);
  if (cellCache.size > 8000) cellCache.clear();
  cellCache.set(key, segs);
  return segs;
}

function tunnelNear(x, y) {
  const nx = Math.floor(x / TUNNEL_CELL), ny = Math.floor(y / TUNNEL_CELL);
  /* Squared distances all the way, and one square root at the end. `d < bd`
     and `d*d < bd*bd` pick the same segment — both sides are distances, so
     never negative, and IEEE square root is monotonic and correctly rounded,
     so it cannot reorder two values that its inputs already order. This ran
     `Math.sqrt` on every one of the fifty-odd segments a sweep tests purely to
     throw the result away for all but one of them. */
  let bd2 = Infinity, bb = 0;
  /* Three by three, not four by four. A node sits inside its own cell and its
     links run one cell east and one south; the bow pushes a link off the
     straight line by at most 0.44 of its length, and the widest chamber is a
     quarter of a cell. So nothing further than one cell away can reach a
     point — and the extra ring was 16 nodes where 9 do, which is 40% of the
     cost of every solidity test in the region, paid at chunk-build time. */
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const segs = cellSegs(nx + i, ny + j);
      for (let k = 0; k < segs.length; k += 8) {
        const px = segs[k], py = segs[k + 1], pt = segs[k + 2];
        const qx = segs[k + 3], qy = segs[k + 4], qt = segs[k + 5];
        const { d2, t } = segDist2(x, y, px, py, qx, qy);
        if (d2 < bd2) {
          bd2 = d2;
          const aB = segs[k + 6], bB = segs[k + 7];
          bb = aB + (bB - aB) * (pt + (qt - pt) * t);
        }
      }
    }
  }
  return bd2 === Infinity ? null : { d: Math.sqrt(bd2), bore: bb };
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
    holdCache.clear();
    spaceCache.clear();
    nodeCache.clear();
    cellCache.clear();
  }

  return {
    chunkSeed, chunkKey, hash2,
    dangerAt, natureAt, peopleAt,
    REGIONS, REGION_CELL, homeCell,
    regionAt, siteAt, regionSite, regionDepth, regionOf, abund, voidCell,
    POWERS, SPACES, baseHold, holderOf, spaceOfCell, spaceAt, territoryChanged,
    /* The Warrens: a region that is made of rock, with tunnels bored through
       it. It lives here because it is terrain of a region and reads the same
       lattice — `regionOf`, `regionDepth` — that decides where it exists. */
    CAVE_CELL, CAVE_GRID_CELL, caveHash, caveFillAt, caveEdge, caveWarp,
    caveSolidAt, outOfRock, caveSegsIn, caveNear, caveTint,
    clearCaches
  };
};
