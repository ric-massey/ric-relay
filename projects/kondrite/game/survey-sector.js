"use strict";

/* KONDRITE — SURVEY — THE SECTOR
   ─────────────────────────────────────────────────────────────────────────────
   What makes a boss a boss, weapons as parts, builds, the almanac, the
   station and what it is short of, the light drive, landmarks, the ladder,
   what kind of sector this is and how big the war is.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── what makes a boss a boss ─────────────────────────────────────────────
   Ric: "besides looks and name they should all have something that makes them
   powerful and when they die they drop the thing that make them powerful."
   So each boss fights with one thing nobody else out here has, and that
   thing is the part it drops. You watch it used on you first, which is the
   best description a part can have.

   `get: ["boss"]` is a fourth way in: never sold, never built, never in a
   cache. Only off the boss that carries it. */
MODULES.push(
  { key: "warfan", name: "WAR FAN", cat: "weapon", rarity: "exotic",
    cost: 20800, deep: 0, get: ["boss"],
    where: "only off a warlord. It is what they fight with",
    note: "five rounds fanned across the nose on every pull of the trigger. " +
          "What a warlord sprays at you, bolted to your own ship",
    eff: { weapon: "fan" } },
  { key: "corsairburner", name: "CORSAIR BURNER", cat: "device",
    rarity: "exotic", cost: 19200, deep: 0, get: ["boss"],
    where: "only off a corsair. It is how they are gone before you turn",
    note: "one hard shove down the way you are pointing, well past your top " +
          "speed, and it bleeds off like a slingshot. Six seconds between",
    eff: { device: "burner" } },
  { key: "flagscreen", name: "FLAGSHIP SCREEN", cat: "armour",
    rarity: "exotic", cost: 24000, deep: 0, get: ["boss"],
    where: "only off an admiral. It is why its hull would not go down",
    note: "a field that takes the next hit for you, whatever it is, then " +
          "takes twelve seconds to come back up",
    eff: { screen: 1 } },
  { key: "wardenswarm", name: "WARDEN'S SWARM", cat: "weapon",
    rarity: "exotic", cost: 22400, deep: 0, get: ["boss"],
    where: "only off a Warden. It is what was following you round",
    note: "two missiles a volley, each after its own target. A seeker rack " +
          "that learned to share",
    eff: { weapon: "swarm" } },
  { key: "broodbay", name: "BROOD BAY", cat: "device", rarity: "exotic",
    cost: 20000, deep: 0, get: ["boss"],
    where: "only off a salvage queen. It is where her bugs came from",
    note: "three of her bugs, yours now. They find whatever is after you " +
          "and fly into it. Eight seconds between",
    eff: { device: "brood" } }
);
const BOSS_PARTS = { warlord: "warfan", corsair: "corsairburner",
                     admiral: "flagscreen", warden: "wardenswarm", queen: "broodbay" };

const moduleSpec = key => MODULES.find(m => m.key === key) || null;

/* How you get a given part, asked of the part itself rather than of three
   different lists that could disagree. `get` is the intent; these are the
   three readings of it, and the shop, the workbench, the cache and the parts
   page all go through them, so there is exactly one answer per part. */
const has = (m, way) => !!m && Array.isArray(m.get) && m.get.indexOf(way) >= 0;
const sellsIt  = m => has(m, "buy");
const craftsIt = m => has(m, "craft");
const findsIt  = m => has(m, "find");

/* What a cache out in the dark might be holding. Only the find-only parts:
   something you could have bought at the last station is a disappointment in a
   sealed hold two hundred thousand units from anywhere.

   Rarer the shallower you are, so the tractor rig turns up early and often and
   the two strange ones do not — and `deep` is the sector's own danger curve, so
   the further out you open one, the better the odds. */
function cachePart(deep, rich) {
  const pool = MODULES.filter(m => findsIt(m) && !sellsIt(m));
  if (!pool.length) return null;
  const chance = (rich ? 0.5 : 0.16) + deep * 0.34;
  if (Math.random() > chance) return null;
  /* Weighted: the common one is what a shallow cache has, and the rare ones
     only really turn up a long way out. */
  const weighted = [];
  for (const m of pool) {
    const w = m.rarity === "common" ? 6 - deep * 3
            : m.rarity === "uncommon" ? 3
            : 1 + deep * 4;
    for (let i = 0; i < Math.max(1, Math.round(w)); i++) weighted.push(m);
  }
  return weighted[Math.floor(Math.random() * weighted.length)];
}
const fitSeconds = key => {
  const m = moduleSpec(key);
  return m ? FIT_TIME[m.rarity] || FIT_TIME.common : 0;
};

/* ── weapons are parts too ────────────────────────────────────────────────
   Firepower used to be one number on the refit page. It is four things you can
   bolt on now, and each one takes a slot — so arming up costs the room you
   would have given to a tractor beam or a bigger scanner. That trade is the
   point: a weapon that costs only money is a stat.

   Every one of them fires on **the trigger you already have**. No second fire
   button, on a keyboard or a thumb: hold fire and the cannon runs at the
   cannon's rate while whatever else is fitted runs at its own, much slower.
   A launcher with its own key would be a control a phone has nowhere to put
   and a thing to remember in the middle of a fight; a launcher that answers the
   trigger is just your ship hitting harder.

   The cannon never goes away. It is how a rock becomes materials, and the whole
   economy hangs off that — a slot you had to spend to be able to mine would not
   be a choice, it would be a tax.

   `cool` is seconds between rounds, and all of them are slow: these are shots
   you aim rather than a stream you sweep. */
const WEAPONS = {
  scatter: {
    name: "SCATTER GUN", cool: 0.9, dmg: 1, spread: 0.26, rounds: 3,
    speed: 0.78, life: 0.5, colour: "#ffd36b",
    note: "three rounds at once, and none of them go far"
  },
  seeker: {
    name: "SEEKER RACK", cool: 2.4, dmg: 2, rounds: 1, seek: 2.6,
    speed: 0.62, life: 3.4, colour: "#ff8f77",
    note: "a missile that turns after whatever is nearest"
  },
  burster: {
    name: "BURST CHARGE", cool: 2.8, dmg: 2, rounds: 1, boom: 190,
    speed: 0.7, life: 2.2, colour: "#ffb347",
    note: "goes off where it lands and takes the neighbours"
  },
  lance: {
    name: "RAIL LANCE", cool: 3.6, dmg: 6, rounds: 1, pierce: 3,
    speed: 1.9, life: 1.1, colour: "#87d8ff",
    note: "one heavy slug, straight through three things"
  },
  // Off bosses. See `BOSS_PARTS`.
  fan: {
    name: "WAR FAN", cool: 1.1, dmg: 1.5, spread: 0.07, rounds: 5,
    speed: 1.1, life: 0.9, colour: "#ff4dd2",
    note: "five rounds, fanned, every time"
  },
  swarm: {
    name: "WARDEN'S SWARM", cool: 2.6, dmg: 2, spread: 0.35, rounds: 2,
    seek: 3.4, speed: 0.72, life: 3.6, colour: "#ff4dd2",
    note: "two missiles that each find their own target"
  }
};
const weaponSpec = key => WEAPONS[key] || null;
// What is bolted on and finished fitting, in slot order.
function weaponsFitted() {
  if (!surv || !surv.slots) return [];
  const out = [];
  surv.slots.forEach((sl, i) => {
    if (!sl || sl.fit > 0) return;
    const m = moduleSpec(sl.key);
    if (m && m.eff && m.eff.weapon) out.push({ slot: i, key: m.eff.weapon });
  });
  return out;
}

/* ── builds ──────────────────────────────────────────────────────────────
   Flat. Ingredients in, part out, one step, no engineering interface:

       3 alloy + 2 electronics + 1 reactor core  ->  Mk II Engine

   `part` is the one piece of depth there is, and it is deliberately fenced. A
   build may consume **one finished part** — the better engine is visibly built
   out of the one you have been flying, which is the good version of depth and
   gives the strange things found a long way out something to be for besides
   sitting in a slot.

   Three rules keep that from becoming the research tree that was already
   rejected, and the tests hold them:

     · two steps, never a tree. A part made from a part may not itself need a
       third crafted part.
     · anything a build eats must also be buyable, so nesting is a shortcut
       rather than a gate. Every module is on some station's shelf, so this
       holds by construction — and the test checks it anyway.
     · nothing exists only to be an ingredient. Every ingredient is a part you
       could have flown. */
const CRAFTS = [
  // ── the cheap end: things worth building rather than buying ────────────
  { out: "layerplate", need: { iron: 8, alloy: 3 } },
  { out: "vernier",    need: { iron: 5, alloy: 4, electronics: 2 } },
  { out: "pulsecoil",  need: { alloy: 4, electronics: 5 } },
  /* The ladder's first two rungs. MK3 is not here — it is the best of its
     category, and the best of a category is bought or found, never built. */
  { out: "tractormk1", need: { iron: 4, alloy: 2 } },
  { out: "tractorrig", need: { iron: 6, alloy: 5, electronics: 3 } },
  { out: "scattergun", need: { iron: 7, alloy: 5, electronics: 2 } },

  /* The ice melter, which is the reason this system exists at all: the answer
     to a long haul is something you build, not something you buy. */
  { out: "icemelter",  need: { iron: 6, alloy: 6, electronics: 4 } },

  /* Six of the seven devices. The emergency jump is not here, and that is
     the rule from the bottom of this list rather than an oversight: it is the
     best thing in its category, so it is bought and never built. */
  { out: "ejector",    need: { iron: 7, alloy: 4 } },
  { out: "decoylauncher", need: { iron: 5, alloy: 6, electronics: 5 } },
  { out: "minelayer",  need: { iron: 8, alloy: 7, electronics: 4 } },
  /* A line and a winch: iron and a little wiring, and the cheapest verb in
     the game. It is meant to be the one a new pilot builds first. */
  { out: "grappleline", need: { iron: 9, alloy: 3 } },

  // ── the middle: a core, so it is a trip rather than an afternoon ───────
  { out: "seekerrack", need: { alloy: 9, electronics: 7, core: 1 } },
  /* The burst takes two cores, which is what puts it on the far side of a
     trip: a thing that stops a room should not be an afternoon's mining.
     SILENT RUNNING is not here — it is the best device in the game and the
     best of a category is never built. */
  { out: "empcharge",  need: { alloy: 10, electronics: 9, core: 2 } },
  /* Panels. Built rather than only bought, because the thing they do — a star
     mends your hull — is the answer to being a long way from a station, and
     being a long way from a station is exactly when you cannot buy one. */
  { out: "solarwing",  need: { alloy: 8, electronics: 6, iridium: 2 } },
  { out: "coolantloop", need: { ice: 8, iron: 5, electronics: 4 } },
  { out: "sparthruster", need: { iron: 9, alloy: 7, electronics: 3 } },

  /* ── built out of what you were flying ────────────────────────────────
     Each of these eats the part below it. That is the whole of the nesting and
     it stops here: none of the ingredients below is itself made from a part. */


  { out: "burstcharge", part: "scattergun",
    need: { alloy: 10, electronics: 8, iridium: 3, core: 1 } },

  // ── the far end: iridium and cores, which are a reason to go out ───────
  /* Built out of the melter you have been running, which is the good version
     of depth: the better thing is visibly made from the thing you know. */
  { out: "starsiphon", part: "icemelter",
    need: { ice: 6, alloy: 10, electronics: 8, iridium: 6, core: 2 } }

  /* ── and the ones with no build at all ────────────────────────────────
     One rule, and it is worth stating as a rule because it decides every part
     added after this one: **if it is the best in its category, it is not
     craftable.** The ladder up to it is; the top of it is not.

     So the OVERBURNER, the REVERSE THRUSTERS, the DEEP EAR, the ABLATIVE SHELL,
     the HEAVY RIG, the RAIL LANCE and the COLD LARDER are found or bought and
     never built — one from each of the seven categories.

     A game where everything is craftable is a game where the sector is a
     materials pile and going anywhere is optional — the only question left is
     how long you are willing to grind. Some things have to be *found* or
     *bought from somewhere far away*, so that a shelf in the deep is worth
     flying to and a part you are carrying is worth carrying.

     The rule for anything added later: **if it is the best in its category, it
     is not craftable.** The ladder up to it is; the top of it is not. */
];
const craftFor = key => CRAFTS.find(r => r.out === key) || null;

const MOD_CATS = [
  { key: "engine",   name: "ENGINE" },
  { key: "thruster", name: "THRUSTER" },
  { key: "scanner",  name: "SCANNER" },
  { key: "armour",   name: "ARMOUR" },
  { key: "tractor",  name: "TRACTOR" },
  { key: "weapon",   name: "WEAPON" },
  /* Not "the ones you press" \u2014 a category name is read in a grid of eight
     boxes and has to be a noun. See `DEVICES`. */
  { key: "device",   name: "DEVICE" },
  { key: "odd",      name: "ODD" }
];

/* Everything the four slots add up to. A slot still fitting contributes
   nothing — that is the whole cost of swapping out in space, and it is the one
   rule this function must never get wrong. */
function mods() {
  const out = { hull: 0, speed: 0, thrust: 0, turn: 0, scan: 0,
                tractor: 0, reach: 0, pull: 0, reverse: 0, skim: 0, life: 0,
                // The four that used to be the hull's own, or the book's.
                solar: 0, warp: 0, quiet: 0, melt: 0,
                // How much of the scanner's cooldown is bought back, 0 to 1.
                recharge: 0 };
  if (!surv || !surv.slots) return out;
  const reaches = [];
  for (const sl of surv.slots) {
    if (!sl || sl.fit > 0) continue;
    const m = moduleSpec(sl.key);
    if (!m) continue;
    /* Numbers only. Two effects name a thing rather than add to one \u2014
       `weapon` and `device` \u2014 and adding a string to zero gives you
       "0scatter", which is a value nothing can use and every reader has to
       work out. What is fitted is asked of the slots directly, by
       `weaponsFitted` and `devicesFitted`. */
    /* Reach is the best beam you have, not the sum of your beams. Two
       tractors do not reach further than the better one, and since the
       ladder arrived `reach` is the one effect that can be *negative* — MK1
       is half the base — so adding them lets a worse rung drag a better one
       down: MK1 beside MK3 came to 0.1, which is 374 units where MK3 alone
       gives 544. Nothing you bolt on may make the ship worse than not
       bolting it on.

       Taken from the beam rather than from the key, and that is the part
       worth reading twice. MK2 has no `reach` at all — it *is* the base —
       so a version of this that collected the key found only MK1's -0.5 and
       made MK1 beside MK2 reach 170 where MK2 alone reaches 340. A tractor
       with nothing to say about its reach is saying zero. */
    if (m.eff.tractor) {
      reaches.push(typeof m.eff.reach === "number" ? m.eff.reach : 0);
    }
    for (const k of Object.keys(m.eff)) {
      if (typeof m.eff[k] !== "number") continue;
      if (k === "reach") continue;
      out[k] = (out[k] || 0) + m.eff[k];
    }
  }
  if (reaches.length) out.reach = Math.max(...reaches);
  return out;
}
const modFitted = key =>
  !!(surv && surv.slots &&
     surv.slots.some(sl => sl && sl.key === key && sl.fit <= 0));

/* ── the almanac ──────────────────────────────────────────────────────────
   Twenty-five entries, and the split between them is deliberate: seventeen
   are conditions on telemetry the simulation already computes every frame,
   seven are landmarks placed out in the dark at increasing distances, and one
   is inside a rock. The count is cheap; the places are not.

   `test` entries are checked every tick against the telemetry block. The rest
   are events — arriving somewhere, breaking something — and call `surveyFind`
   where they happen. `secret` hides the name until it is found, because a
   redaction is an invitation and a blank line is not. */
const ALMANAC = [
  { key: "first-light", name: "FIRST LIGHT", note: "a star, close up",
    test: t => t.nearStar },
  { key: "event-horizon", name: "EVENT HORIZON", note: "in, and back out again",
    test: t => t.leftHole },
  { key: "slingshot", name: "SLINGSHOT", note: "left faster than you arrived",
    test: t => t.slung },
  { key: "thread", name: "THREAD", note: "between two cores, touching neither",
    test: t => t.threaded },
  { key: "close-pass", name: "CLOSE PASS", note: "skimmed a core and lived",
    test: t => t.skimmed },
  { key: "dead-stick", name: "DEAD STICK", note: "sixty seconds without thrust",
    test: t => t.coast >= 60 },
  { key: "full-stop", name: "FULL STOP", note: "dead still, nothing near",
    test: t => t.stopped },
  { key: "terminal-velocity", name: "TERMINAL VELOCITY",
    note: "faster than an engine can push",
    test: t => t.top >= MAX_SPEED * U * 1.5 },
  { key: "long-haul", name: "LONG HAUL", note: "150,000 units flown",
    test: t => t.dist >= 150000 },
  { key: "deep-field", name: "DEEP FIELD", note: "60,000 units from where you started",
    test: t => t.fromHome >= 60000 },
  { key: "dark-run", name: "DARK RUN", note: "6,000 units with no star out there",
    test: t => t.dark >= 6000 },
  { key: "cartographer-1", name: "CARTOGRAPHER I", note: "300 cells charted",
    test: t => t.charted >= 300 },
  { key: "cartographer-2", name: "CARTOGRAPHER II", note: "1,200 cells charted",
    test: t => t.charted >= 1200 },
  { key: "cartographer-3", name: "CARTOGRAPHER III", note: "4,000 cells charted",
    test: t => t.charted >= 4000 },

  { key: "binary", name: "BINARY", note: "two stars, one dance",
    test: t => t.stars >= 2 },
  { key: "double", name: "DOUBLE", note: "two wells, overlapping",
    test: t => t.holes >= 2 },
  { key: "eclipse", name: "ECLIPSE", note: "a world drawn across a sun",
    test: t => t.eclipse },

  { key: "prospector", name: "PROSPECTOR", note: "a rock that was not only rock" },

  { key: "graveyard", name: "GRAVEYARD", note: "where a raid ended" },
  { key: "rogue", name: "ROGUE", note: "a planet with no star" },
  { key: "last-transmission", name: "LAST TRANSMISSION", note: "still broadcasting" },
  { key: "pale-dot", name: "PALE DOT", note: "one pixel, until it wasn't" },
  { key: "the-wall", name: "THE WALL", note: "a wormhole somebody failed to open",
    secret: true },
  { key: "supernebula", name: "THE SUPERNEBULA", note: "you found the big one" },
  { key: "node-01", name: "NODE 01", note: "somebody else's terminal", secret: true },
  { key: "vault", name: "THE VAULT", note: "somebody locked this and left",
    secret: true },
  { key: "leviathan", name: "THE LEVIATHAN", note: "it was a ship, once", secret: true },

  /* The five that are about doing rather than arriving. They are last because
     the sector has to have taught you it is solid before any of them mean
     anything. */
  { key: "hard-contact", name: "HARD CONTACT", note: "space turned out to be solid",
    test: t => t.struck },
  { key: "through", name: "THROUGH", note: "in one side, out somewhere else",
    test: t => t.warped },
  { key: "laden", name: "LADEN", note: "a hold with no room left in it",
    test: t => t.laden },
  { key: "refit", name: "REFIT", note: "bolted something on and flew with it",
    test: t => t.refitted },
  { key: "grave-robber", name: "GRAVE ROBBER", note: "took what was being guarded",
    test: t => t.looted },
  { key: "salvor", name: "SALVOR", note: "carried the first piece home" },
  /* Built rather than bought. It belongs in the almanac because it is the first
     time the sector's cheap small change turns into something you fly with —
     which is a different feeling from paying for one, and worth marking. */
  { key: "shipwright", name: "SHIPWRIGHT",
    note: "built a part out of what you found" },
  { key: "finished", name: "THE STATION", note: "you put it back together",
    secret: true }
];
const SURVEY_TOTAL = ALMANAC.length;

/* ── the station, and the six things it is short of ───────────────────────
   Survey never said what you were doing. It had an almanac, which is a record
   of what you happened to see, and that is not the same as a reason to go —
   you could fly for an hour without the mode ever asking you for anything.

   So there is something being built, and it is short of parts. The loop is
   the obvious one: go out, find a thing, carry it home, and the thing you are
   building gets one step further along. What makes it navigation rather than
   a shopping list is that nothing tells you where a part *is*. Each one comes
   with a clue describing the kind of place it is kept, the sector really does
   put that kind of place there, and a scan gives you a bearing and nothing
   else. You still have to go and look; you just know what you are looking
   for now.

   Each part is placed the way a landmark is — its own bearing, its own
   distance — and brings its own scenery with it, so the clue is a promise the
   generator keeps rather than flavour text laid over whatever was already
   there. The distances interleave with the landmark ladder, so filling the
   manifest walks you outward past most of the almanac on the way. */
const BUILD = [
  /* **The manifest is the tutorial.** Six parts, and it is the only thread in
     the mode that says "go there, then there" — so it has to be walkable in an
     evening rather than an expedition, because the thing it is really teaching
     is how to fly, scan, salvage, sell and come home. It ran to 280,000 units
     for the fifth part, which is most of an hour of flying for somebody who has
     not yet learned why they would want to.

     Five of the six are inside 52,000 now, which is ten minutes of flying end to
     end.

     And so is the sixth. It is inside the Leviathan, which used to stand on the
     ladder's last rung — millions of units out once 6.7 stretched the ladder —
     so the one step of the tutorial that asks you to go *inside* something was
     the one step nobody ever reached. The Leviathan stands at a fixed 40,000
     now, in every sector, and takes no rung with it. */
  /* `opens` is the half of this that is new, and it is the whole change: a
     part is not a rung on one long ladder any more, it is the thing that
     turns one room of the station back on. Six fetches and one payoff was a
     long way to walk on trust; six fetches and six payoffs is a station
     coming alive around you.

     Nothing else on these rows moved. The distances, the places and the six
     clues are exactly what they were — only what arriving with one *does*
     is different, which is why this is a smaller change than it reads. */
  { key: "spar", name: "DRIVE SPAR", dist: 7000, opens: "dock",
    clue: "Among the dead. Somewhere a lot of ships stopped at once.",
    where: "a wreck field" },
  { key: "core", name: "FUSION CORE", dist: 13000, opens: "counter",
    clue: "In the light of two suns, where nothing is ever dark.",
    where: "a binary pair" },
  { key: "lens", name: "RANGING LENS", dist: 21000, opens: "market",
    clue: "On a world nobody warms. Look for a planet with no star.",
    where: "a rogue world" },
  { key: "coil", name: "JUMP COIL", dist: 34000, opens: "hangar",
    clue: "Wound around a mouth that goes somewhere else.",
    where: "a gate" },
  { key: "beacon", name: "SIGNAL BEACON", dist: 52000, opens: "stock",
    clue: "Still calling, long after anyone stopped listening.",
    where: "a transmitting wreck" },
  { key: "plate", name: "ABLATIVE PLATE", dist: 0, opens: "mouth",
    clue: "The big dead one is carrying plenty. You will have to go inside.",
    where: "deep in the Leviathan", inside: "leviathan" }
];

/* ── what the station does, and what each of it costs ─────────────────────
   There were two things sitting a few hundred units off the origin, and a new
   player met both in the first minute: a station that worked perfectly from
   the first second, and a gate that was a hole and wanted six parts. They
   have swapped. There is no yard. The six parts come *home*, and what they
   repair is the place you live.

   SUPPLIES has no part against it, and that is the whole reason the first
   minute still works. A station with no power still has somebody in it, and
   that somebody has a tank and no metal; you have metal and no water. That
   trade is what a dead station is — two people scraping by, rather than a
   shop with its buttons greyed out — and it quietly answers the question the
   design never answered: *why is the first station free?* It is not. It is
   broken, and you are the one fixing it.

   Everything else is dark, named, and says what it wants. **A missing tab
   teaches nothing; a dark one teaches everything** — take the dark rows away
   and the station is a shop with two items and no reason to leave. */
/* `does` is one line on a row with three other columns on it, and the two
   that matter — the part it wants and where that part is kept — are given
   their width first. So these are short enough to be read whole rather than
   ellipsised: the long version of any of them is in this file, not on the
   player's screen. */
const SERVICES = [
  { key: "supplies", name: "SUPPLIES", part: null,
    does: "water, food, and it buys" },
  { key: "dock",    name: "THE DOCK",    part: "spar",
    does: "hull repairs" },
  { key: "counter", name: "THE COUNTER", part: "core",
    does: "parts, over the counter" },
  { key: "market",  name: "THE MARKET",  part: "lens",
    does: "what the chart is paying" },
  { key: "hangar",  name: "THE HANGAR",  part: "coil",
    does: "the only berth there is" },
  { key: "stock",   name: "STOCK",       part: "beacon",
    does: "it can order in" },
  { key: "mouth",   name: "THE MOUTH",   part: "plate",
    does: "every charted station" }
];
const serviceSpec = k => SERVICES.find(s => s.key === k);

/* Is this room of the station running? Asked only of home: every other
   station in the sector is somebody else's, and somebody else's station
   works — you just cannot jump from it and you cannot change ship there. */
const stationHas = k => {
  const s = serviceSpec(k);
  return !!s && (!s.part || !!(surv && surv.built.has(s.part)));
};
// Whole, meaning every one of the six is in.
const stationWhole = () => !!surv && surv.built.size >= BUILD.length;

/* What the six parts are for, said once, at the top of the page that lists
   them. A fetch quest with no stated prize is a chore, and the six clues were
   asking for a lot of flying on nothing but trust.

   They used to build a structure of its own — a **manmade wormhole** on a
   frame off the origin — and the prize was one mouth at the end of six
   deliveries. It is the station now, and the prize arrives in six pieces:
   each part is a room of the place you live coming back on, and the mouth is
   the last of them. What that buys is the same fact the wormhole always
   traded on — the Wall is a *failed* attempt at exactly this, which is why
   the jump coil is found wound around a gate — but you are no longer walking
   five deliveries on a promise. A real light drive is a separate thing you
   build afterwards; see LIGHT_DRIVE below. */
const STATION_BUILD = {
  name: "YOUR STATION",
  does: "whole \u2014 and the mouth opens on any station you have charted",
  blurb: "Six parts, none of them near each other, and each one turns " +
         "something here back on. Somebody tried the last of it before, on a " +
         "frame a mile across, and it did not open."
};

/* ── the light drive ──────────────────────────────────────────────────────
   The yard's second project, and the only one you buy rather than fetch: the
   wormhole moves you between places you have already been, and this moves you
   *through* the places you have not.

   Connect to it and you run in one direction at eight times what the drive can
   do. You cannot manoeuvre at that speed and you are not meant to — the whole
   of it is a commitment. Asteroids are nothing at that velocity; the only two
   things in the sector big enough to matter are a massive world and a
   supermassive well, and the drive says so five seconds before you arrive,
   which is the same bargain phase 1.2 struck with the gravity warning. */
const LIGHT_DRIVE = {
  name: "LIGHT DRIVE",
  cost: 2400,
  does: "run in one direction at eight times your drive",
  blurb: "No turning, no stopping short. Worlds and supermassive wells will " +
         "still kill you, and it will tell you five seconds out."
};
const LIGHT_MULT   = 8;      // times your own top speed
const LIGHT_SPOOL  = 1.6;    // seconds to wind up to it
const LIGHT_TURN   = 0.22;   // how much steering is left, as a fraction
const LIGHT_WARN   = 5;      // seconds of impact warning
// What is big enough to be worth warning about at that speed.
const LIGHT_MIN_WORLD = 700;

/* ── the landmarks ────────────────────────────────────────────────────────
   The seven entries that are places rather than conditions, at increasing
   distances from the origin. This ladder is what an endless sector is *for*:
   the graveyard is a short flight, the supernebula is an expedition, and NODE
   01 is out past anywhere you would go by accident. A scan returns a bearing
   to the nearest one you have not found, at any range — direction only — so
   there is always somewhere to go and never a map that gives it away. */
/* ── the ladder, and how long it is ───────────────────────────────────────
   These ran 13,000 to 112,000, and the whole book could be finished in about
   two hours. The reason, measured: **ten minutes of holding the throttle
   reaches 344,617 units**. The Leviathan — the finale, the thing the entire
   manifest points at — sat at 112,000, which is three minutes of flying. The
   entries were never the problem; the sector they were hidden in was a
   thirtieth of the size it needed to be.

   It is geometric now, roughly x2.3 a rung, from an afternoon's flight to an
   expedition. The near rungs barely move — the first hour should still feel
   the way it did — and the far ones move by a factor of thirty.

   Water is what makes the distance cost something. Twenty minutes of tank at
   900,000 units an hour means the far rungs are a supply problem before they
   are a navigation one, which puts them behind the ice melter, cargo capacity
   and inhabited worlds without inventing a single new lock. A pilot standing at
   the Leviathan *built* their way there. */
const LANDMARKS = [
  { key: "graveyard",         name: "GRAVEYARD",     dist:   13000, r: 620 },
  { key: "rogue",             name: "ROGUE",         dist:   30000, r: 520 },
  { key: "last-transmission", name: "TRANSMISSION",  dist:   70000, r: 430 },
  { key: "pale-dot",          name: "PALE DOT",      dist:  160000, r: 330 },
  { key: "the-wall",          name: "THE WALL",      dist:  360000, r: 760 },
  { key: "supernebula",       name: "SUPERNEBULA",   dist:  780000, r: 1150 },
  /* The second thing in the game you fly *inside*. See `buildVault` — and see
     the Leviathan, which proved the shape is worth having and is the reason
     there is now a second one. */
  { key: "vault",             name: "THE VAULT",     dist: 1250000, r: 900 },
  /* The far rung. It was 1,700,000 and the Leviathan stood on 3,400,000 above
     it; the Leviathan came off the ladder to sit at a fixed 40,000, and the
     ladder must not lose its far end with it — 6.7 stretched it to buy twenty
     hours of game, and half a ladder is half of that. So the top rung stays
     where it was and this row now holds it.

     Which landmark stands here is still dealt per world. The number is the
     ladder's shape, not this entry's address. */
  { key: "node-01",           name: "NODE 01",       dist: 3400000, r: 400 },
  /* The Leviathan is last and furthest because it is the only landmark that
     is a *place you go inside*. Its radius is the logging trigger, not the
     hull — the hull is built in `buildLeviathan` and is several times this. */
  /* **Not a rung.** Every other landmark is dealt a rung of the ladder and
     stretched by the world's spread; the Leviathan is placed at this distance
     in every sector, and its old rung — 3,400,000, the far end of the ladder —
     left with it.

     It was the finale, and the finale is what it stopped being able to be. The
     manifest's sixth part is inside it, the manifest is the tutorial, and a
     tutorial whose last step is sixteen ten-minute flights away is a tutorial
     nobody finishes. Five of the six sit inside 52,000; this is the sixth, and
     it is the only one that asks you to go *inside* something, which is the
     best moment the manifest has. It is worth having at the end of an evening
     rather than at the end of a month. */
  { key: "leviathan",         name: "LEVIATHAN",     dist:   40000, r: 1700,
    fixed: true }
];

/* ── what kind of sector this is ──────────────────────────────────────────
   The seed used to change where things were and never what the place was
   like. Every sector had the graveyard around 13,000 units, the rogue world
   around 18,000 and the Leviathan around 108,000, at the same densities, in
   the same order — so a new seed was a new arrangement of one map rather than
   a new map, and it showed.

   A world now rolls a *character* before anything is placed. The whole ladder
   stretches or compresses, every kind of thing has its own abundance, and the
   landmarks are dealt to the rungs in a shuffled order — so one sector puts
   the supernebula close enough to visit on your first flight and buries the
   graveyard eight hours out, and the next one does the opposite.

   Two things are deliberately not shuffled. The Leviathan stays on the last
   rung, because it is the finale and the station's last part is inside it. And
   the home band stays quiet in every world, because the opening two minutes
   are the same promise whatever the seed. */
const TRAITS = [
  { key: "wells",    lo: "OPEN",      hi: "WELL-RIDDLED" },
  { key: "planets",  lo: "STARVED",   hi: "MANY WORLDS" },
  { key: "wrecks",   lo: "UNTOUCHED", hi: "A GRAVEYARD" },
  { key: "gates",    lo: "SEALED",    hi: "THREADED" },
  { key: "stations", lo: "UNTENDED",  hi: "SETTLED" },
  { key: "nebulae",  lo: "CLEAR",     hi: "CLOUDED" },
  { key: "fields",   lo: "SWEPT",     hi: "CHOKED" },
  { key: "caches",   lo: "PICKED OVER", hi: "HOARDED" }
];

/* ── how big the war is ──────────────────────────────────────────────────
   `heat` is the multiplier everything else reads: how much of the traffic
   flies a belligerent's flag, how much of it is armed, and how often you fly
   into a battle already in progress. `fleet` is how many hulls a side brings
   to one of those.

   A border skirmish is two patrols and a grudge. A total war is fleets, and
   the wrecks of fleets, and long stretches where the only ships you meet are
   the ones fighting. */
const WAR_SCALES = [
  { key: "border", name: "BORDER SKIRMISH", heat: 0.45, fleet: 2,
    note: "shots traded over a line neither side can hold" },
  { key: "raids",  name: "RAIDING WAR",     heat: 0.8,  fleet: 3,
    note: "convoys hunted, lanes unsafe, nothing declared" },
  { key: "open",   name: "OPEN WAR",        heat: 1.15, fleet: 5,
    note: "fleets in the open and no pretence left" },
  { key: "total",  name: "TOTAL WAR",       heat: 1.7,  fleet: 8,
    note: "everything either side has, thrown at everything else" }
];
const warScale = () =>
  (surv && surv.world && surv.world.scale) || WAR_SCALES[1];

function rollWorld(seed) {
  const R = seeded((seed ^ 0x1d872b41) >>> 0);
  const spread = 0.55 + R() * 1.55;      // the whole ladder, near or far
  const d = {};
  for (const t of TRAITS) d[t.key] = 0.3 + R() * 1.95;

  /* The name is the two traits that deviate most, which is the honest way to
     describe a world: what is unusual about it, not a list of everything in
     it. A sector with nothing remarkable gets called ORDINARY and that is a
     true and useful thing to be told. */
  const ranked = TRAITS
    .map(t => ({ t, dev: Math.abs(d[t.key] - 1) }))
    .sort((a, b) => b.dev - a.dev)
    .filter(x => x.dev > 0.45)
    .slice(0, 2)
    .map(x => (d[x.t.key] > 1 ? x.t.hi : x.t.lo));

  if (spread > 1.55) ranked.push("SPRAWLING");
  else if (spread < 0.75) ranked.push("COMPACT");

  /* Whose war this is. One pair of the three powers is fighting and the third
     is watching, and which pair belongs to the world — so a sector has a
     politics you learn by flying in it rather than one handed to you. */
  const powers = FACTIONS.map(f => f.key);
  const p0 = Math.floor(R() * 3);
  const p1 = (p0 + 1 + Math.floor(R() * 2)) % 3;
  const war = {};
  war[powers[p0]] = powers[p1];
  war[powers[p1]] = powers[p0];

  /* And how big it is. Two powers can be trading shots over a line neither
     side can hold, or throwing whole fleets at each other, and that is the
     difference between a sector you barely notice is at war and one you have
     to plan a route through. Weighted down the list, so a total war is a
     seed you remember rather than a Tuesday. */
  const wr = R();
  const scale = WAR_SCALES[wr < 0.42 ? 0 : wr < 0.74 ? 1 : wr < 0.93 ? 2 : 3];

  return {
    spread, d, war, scale,
    belligerents: [powers[p0], powers[p1]],
    bystander: powers.find(k => k !== powers[p0] && k !== powers[p1]),
    name: ranked.length ? ranked.slice(0, 2).join(" · ") : "ORDINARY",
    /* A shuffled dealing of the ladder's rungs, over the landmarks that take
       one. The Leviathan is not in here at all any more — it stands at its own
       fixed distance in every sector, so it is neither dealt nor stretched. */
    order: (() => {
      const rest = LANDMARKS.filter(l => !l.fixed).map(l => l.key);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(R() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      return rest;
    })(),
    partOrder: (() => {
      const rest = BUILD.filter(b => !b.inside).map(b => b.key);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(R() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      return rest;
    })()
  };
}


let surv = null;

/* ── where you are, and what that means ───────────────────────────────────
   Chunk identity, the danger curve and the region lattice all live in
   survey-world.js now. Three blocks that sat a thousand lines apart in here
   and are one idea: every one of them is a pure function of a seed and a pair
   of coordinates, nothing is stored, and flying away and back finds the same
   place. That is the rule the plan says never to rewrite, and it is easier to
   keep when it is a file rather than a habit.

   `seeded` goes in because it is the game's own generator and not Survey's —
   the rocks and the campaign use it too. The seed and the world go in as
   calls, because a run has not started when this is built. */
const WORLD = window.KondriteSurveyWorld({
  seeded,
  CHUNK,
  seed: () => (surv ? surv.seed : 0),
  world: () => (surv ? surv.world : null),
  running: () => !!surv,
  /* The cells that have changed hands since the sector began. The seeded map
     is only where the war started; see "WHO HOLDS THE SKY" in the module. */
  claims: () => (surv && surv.claims) || null,
  // Who is at war with whom *now*. The world rolls where the war started.
  war: () => (surv && surv.war ? surv.war.pairs : null),
  // The index the streamer builds; see `streamChunks`. Read, never written.
  caveGrid: () => (surv ? surv.caveGrid : null)
});

const chunkSeed   = WORLD.chunkSeed;
const chunkKey    = WORLD.chunkKey;
const hash2       = WORLD.hash2;
/* A part's `deep` read back as words. `deep` is a danger figure, and danger
   is no longer a distance — it is the biome and the owner together — so a
   shelf's depth is said as the kind of place that stocks it rather than as a
   band and a range. See `longList`. */
const dangerWords = deep =>
  deep < 0.15 ? "CALM SPACE" : deep < 0.35 ? "ROUGH SPACE" :
  deep < 0.55 ? "DANGEROUS SPACE" : "THE WORST SPACE THERE IS";
const dangerAt    = WORLD.dangerAt;
/* How deep a station's shelf reaches, which is its sky's danger stretched a
   little. A part's `deep` was written against a distance, where everything
   past a million units stocked the best parts; read raw against the biome
   and the owner, one station in a thousand did, which is not "out there",
   it is lost. Stretched by this, about one station in a hundred stocks the
   best of them and one in ten the next rung down: the ones in bad sky. */
const SHELF_REACH = 0.8;
/* What a place gives and how hard it guards it — salvage, caches, sentries,
   cargo, prices — on the scale all of those were tuned against. They were
   written when "the deep" sat at 1 and past it, and most of a long game was
   spent there: measured over the whole ladder the old median was 1.12. The
   biome and the owner put the median at 0.18, so read raw the late game paid
   like the opening and guarded like it too. Stretched, the worst sky reaches
   the old abyss (1.3) and ordinary sky stays where home always was. */
const DEPTH_STRETCH = 1.4;
const depthAt     = (x, y) => Math.min(1.3, dangerAt(x, y) * DEPTH_STRETCH);
const shelfDepth  = (x, y) => Math.min(1, dangerAt(x, y) / SHELF_REACH);
/* Nature alone, as 0 for ordinary sky to 1 for the Wells: what sizes a well,
   thickens rock and grows a field. The biome's half, and it never moves. */
const wildAt      = (x, y) => Math.max(0, (WORLD.natureAt(x, y) - 0.15) / 0.65);
const spaceAt     = WORLD.spaceAt;
const REGIONS     = WORLD.REGIONS;
const REGION_CELL = WORLD.REGION_CELL;
const regionAt    = WORLD.regionAt;
const regionSite  = WORLD.regionSite;
const regionDepth = WORLD.regionDepth;
const regionOf    = WORLD.regionOf;
const abund       = WORLD.abund;

/* And the Warrens, which is a region's terrain and moved with it. */
const CAVE_CELL      = WORLD.CAVE_CELL;
const CAVE_GRID_CELL = WORLD.CAVE_GRID_CELL;
const caveHash       = WORLD.caveHash;
const caveFillAt     = WORLD.caveFillAt;
const caveEdge       = WORLD.caveEdge;
const caveWarp       = WORLD.caveWarp;
const caveSolidAt    = WORLD.caveSolidAt;
const outOfRock      = WORLD.outOfRock;
const caveSegsIn     = WORLD.caveSegsIn;
const caveNear       = WORLD.caveNear;
const caveTint       = WORLD.caveTint;
