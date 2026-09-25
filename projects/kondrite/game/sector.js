"use strict";

/* KONDRITE — THE WORLD — TRADE
   ─────────────────────────────────────────────────────────────────────────────
   The two tracks, salvage, selling, stations that want something, what a
   place deals in, who pays best, and who takes the strange ones.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ═══ THE WORLD ═══════════════════════════════════════════════════════════
   Survey used to be a sector you flew through: the only thing that could
   touch you was a gravity well, and everything else — planets, wrecks, the
   markers — was painted on. That is the difference between a place and a
   backdrop, and it is why an endless sector could still feel small.

   Everything below makes the sector push back. Things are solid. Some of them
   are doors. Some of them object to you being there. And what you take off
   them is the currency of the two progression tracks. */

/* How big the ship you are flying actually is. Collision, the salvage pickup,
   where a round leaves the nose and how big it draws all read this, so a
   Cathedral is a Cathedral to every one of them at once. */
const shipRadius = () => SHIP_R * U * (ships[0] && ships[0].sizeMul || 1);

/* ── the two tracks ───────────────────────────────────────────────────────
   Salvage buys numbers at a station; the almanac hands out verbs for free.
   Kept apart on purpose: one rewards working a sector over, the other rewards
   going somewhere you have not been, and a mode about looking should never
   let the first one buy its way past the second. */

/* How much you can carry is the *ship's*, full stop. It used to have a refit
   track on top of it, which made two different things — which hull you fly and
   how much you have spent — both answer the same question, and made the 50×
   spread across the roster mean less than it should. Cargo is a reason to buy
   a different ship now, and nothing else changes it. */
const holdCap = () => LEV_ONLY ? 9999
  : (surv ? shipSpec(surv.ship).cargo : SURVEY_HOLD);

/* How much food this hull can carry, against the Skiff's own hold.
   Softened with a square root rather than taken straight: cargo runs 50x across
   the roster and a hull that could be away for thirty-seven hours would make
   every other one pointless. This runs about 0.6x to 3.4x instead. */
const foodCap = () => {
  if (!surv) return FOOD_FULL;
  const cargo = shipSpec(surv.ship).cargo || SURVEY_HOLD;
  return Math.round(FOOD_FULL * Math.sqrt(cargo / shipSpec("skiff").cargo));
};

/* How far a pulse reaches. This is the only thing the scanner track buys, and
   it is the only thing it ever claimed to buy that could be felt. */
const SCAN_BASE = 2100;
/* Every hull scans the same distance; what changes it is what you bolted on —
   and *where you are*. Some regions lie to instruments, and in one of them the
   scan comes back at about a third of its range, so you fly it by eye. That is
   a rule change rather than a decoration: a scanner build is excellent in thick
   clutter and nearly useless in a murk. */
/* How far a pulse reaches. The hull never changes it; what you bolted on does,
   and so does where you are.

   In a region that lies to instruments the scan does not simply come back
   short, it comes back *shorter the further in you go* — down to a tenth of
   normal at the middle. At the edge you notice the numbers drifting; in the
   middle you are flying on your eyes. */
function regionScan(x, y) {
  const reg = regionOf(x, y);
  const s = reg.scan === undefined ? 1 : reg.scan;
  if (s >= 1) return 1;
  /* Straight from ordinary at the border to the region's own worst value at the
     middle. The first version scaled the interpolation by `(1 - s)` as well as
     by the depth, which is the same factor applied twice: a region whose floor
     was a tenth bottomed out at four tenths instead, and the deepest murk in the
     galaxy was barely worse than its own edge. */
  return 1 + (s - 1) * regionDepth(x, y);
}
const scanRange = () => {
  const me = ships[0];
  return SCAN_BASE * (1 + mods().scan) * (me ? regionScan(me.x, me.y) : 1);
};
const ECHO_LIFE = 20;        // seconds a return stays on the chart
/* And how long the scan's arrows stay on the ring. Much shorter than the
   returns: the chart keeps the answer for twenty seconds, but an arrow on
   the edge of the screen is only worth the glance you give it straight after
   pressing the key, and twenty seconds of them was clutter (Ric, 2026-09-25). */
const SCAN_ARROWS = 5;

/* The hull's own numbers, and the parts bolted to it. Nothing else — a hull is
   exactly what the shipyard said it was, for as long as you own it, and every
   difference between two of the same hull is a difference you can see in the
   four slots. */
function applyRefit(ship) {
  const sh = shipSpec(surv ? surv.ship : "skiff");
  const m = mods();
  ship.spec      = sh;
  ship.maxHull   = sh.hull + m.hull;
  /* Speed is the ceiling; acceleration is how quickly this hull reaches it.
     These used to be the same number, which made every fast ship fast in the
     same way and left the shipyard's handling categories with nothing to say. */
  ship.thrustMul = sh.accel * (1 + m.thrust + m.speed);
  ship.speedMul  = sh.speed * (1 + m.speed);
  ship.turnMul   = sh.turn * (1 + m.turn);
  ship.drag      = sh.drag;
  ship.dmgMul    = sh.dmg;
  ship.rateMul   = sh.rate;
  /* How fast this hull's rounds leave it. A hull already decides what a shot
     hurts and how often one goes out; this is the third of the same idea, and
     it is what lets a fast ship outrun a freighter's return fire and still be
     caught by a gunship's. */
  ship.shotMul   = sh.shot == null ? 1 : sh.shot;
  /* How many rounds one pull of the trigger sends. Three everywhere for
     years, and a global constant rather than a hull's business — which made
     it the one thing about a gun that every ship in the game agreed on. The
     Bastion and the Jackal send four. It is a bigger change than it reads:
     the burst is what a fight is *counted* in out here, so a fourth round is
     a third more damage inside the same window and the same recovery. */
  ship.burstSize = sh.burst || BURST_SIZE;
  /* ── the two axes grip could not carry ────────────────────────────────
     `spool` is how long the drive takes to wind up to full thrust, and it is
     the only way a hull can be slow off the line *and* refuse to slide. Grip
     decides both of those on its own and decides them together, so a commuter
     that does not skid is, on drag alone, a commuter that leaps away from a
     dock — which is the opposite of what a commuter is. A bus has good brakes
     and a slow pull-away, and this is the pull-away.

     `bite` is how much of the turn survives at full speed. A commuter turns
     well standing still and badly at a run, which is the other half of the
     same feeling and is not something any single drag number can say. */
  ship.spool     = sh.spool || 0;
  ship.spun      = ship.spun || 0;
  ship.bite      = sh.bite == null ? 1 : sh.bite;
  /* A shielded nose. The commuters push through the drifting field instead of
     being stopped by it — which is what makes them the hull you take between
     stations without looking where you are going. Rocks only: a world, a dead
     hull and the Leviathan are structures, and flying through those would make
     the sector a backdrop again. */
  ship.ram       = !!sh.ram;
  ship.weapon    = sh.weapon || null;
  ship.sizeMul   = sh.size;
  if (ship.hull > ship.maxHull) ship.hull = ship.maxHull;
}


/* ── salvage ──────────────────────────────────────────────────────────────
   One number, one cap. A full hold is not a failure state — it just means the
   next thing you break is left where it lies, which is the sector telling you
   to go and spend. */
// Everything in the hold, as one number: the cap is on how much you carry,
// not on how much any one kind of it is worth.
/* **Parts included.** A spare part is a thing in the hold, so it is on this
   number — see `PART_WEIGHT`. Everything that asks "is there room" asks this
   one function, so that is the whole of making the two the same thing. A part
   that is *fitted* weighs nothing here, and that is not an oversight: it is
   bolted to the outside of the ship rather than lying in the hold, and it is
   the reason to use the four slots rather than to hoard. */
const storeWeight = () =>
  Object.keys(surv.store || {})
    .reduce((t, k) => t + partWeight(k) * storeCount(k), 0);
const holdUsed = () =>
  MATERIALS.reduce((t, m) => t + (surv.hold[m.key] || 0), 0) + storeWeight();

/* Is there room for one more of this part? Asked before every one of the four
   ways a part reaches the hold — bought, built, pulled off a slot, found in a
   cache — because a hold with a cap that only some things respect is a cap
   nobody believes. */
const roomForPart = key => holdCap() - holdUsed() >= partWeight(key);
/* And the line to print when there is not. Named rather than repeated: the
   four refusals should say the same thing in the same words, because they are
   the same refusal. */
function noRoomFor(key) {
  const m = moduleSpec(key);
  chatter("No room for " + (m ? m.name : "it") + " \u2014 it needs " +
          partWeight(key) + " cargo slots and you have " +
          Math.max(0, holdCap() - holdUsed()) + ".", "#ff8f77");
  gameSound("hit");
}

/* Taking one unit aboard. The hold fills as a whole, so a hold full of ice is
   a hold with no room for iridium — which is the decision the four materials
   exist to create. */
function addMaterial(key, n) {
  const room = holdCap() - holdUsed();
  if (room <= 0) { surv.t.laden = true; return 0; }
  const took = Math.min(room, n);
  surv.hold[key] = (surv.hold[key] || 0) + took;
  if (holdUsed() >= holdCap()) surv.t.laden = true;
  return took;
}

/* What comes off a thing you broke. `source` picks the table and `deep` leans
   it toward the rare end, so where you were when you broke it matters as much
   as what it was. Each mote carries its own kind: they are collected one at a
   time and drift apart on the way, so a broken rock is a little cloud of
   mixed colour rather than a single lot. */
function dropMote(x, y, n, spread, source) {
  const deep = depthAt(x, y);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(20, 90) * U;
    surv.motes.push({ x: x + Math.cos(a) * rand(0, spread || 30),
                      y: y + Math.sin(a) * rand(0, spread || 30),
                      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                      spin: rand(0, 6.28), life: 90,
                      mat: rollMaterial(source || "rock", deep) });
  }
}

/* ── selling ──────────────────────────────────────────────────────────────
   A station buys what you are carrying, and what it pays is its own business.
   Two things move the price: how far out the station is, because a long haul
   has to be worth taking, and the station's own taste, which is a pure
   function of where it stands so a good buyer stays a good buyer and is worth
   writing on the chart. Home sits at the origin with no depth bonus at all,
   which is what makes the first other station you find worth finding. */
/* ── a station that wants something ───────────────────────────────────────
   Phase 6.2. Prices varied by *place* and never by *event*: nothing that
   happened near a station changed anything about it, so a convoy being taken
   apart outside the window was scenery.

   A station is short of one or two materials. Being short raises what it pays
   for them, which is the only signal the system needs — a shortage is a price,
   and a price is a reason to fly somewhere. Three things move it:

     a convoy arrives    carrying what it wanted, and the shortage eases
     a convoy is killed   anywhere near it, and the shortage deepens
     time                 passes, and it drifts back toward its own baseline

   The baseline is rolled from the station's position, so a fresh sector already
   has somewhere that pays well for iron. Everything after that is something
   that happened. */
const SHORT_MAX = 1.4;        // how far a price can be pushed up
const SHORT_EASE = 0.012;     // per second, back toward the baseline

const stationId = st =>
  st && (st.id || (st.id = "s" + Math.round(st.x) + "," + Math.round(st.y)));

function marketOf(st) {
  if (!st) return null;
  const id = stationId(st);
  let m = surv.market[id];
  if (!m) {
    /* Its baseline: one material it is habitually short of, rolled from where
       it is. A station in the deep wants the cheap bulk it cannot get; one near
       home wants the rare things nobody brings in. */
    const R = seeded(chunkSeed(Math.round(st.x / 7) ^ 0x51ed2701,
                               Math.round(st.y / 7) ^ 0x1b873f05));
    const deep = depthAt(st.x, st.y);
    const pool = deep > 0.5
      ? MATERIALS.filter(x => x.value <= 3)
      : MATERIALS.filter(x => x.value >= 9);
    const pick = pool[Math.floor(R() * pool.length)] || MATERIALS[1];
    m = surv.market[id] = { base: pick.key, want: {}, seen: 0 };
    m.want[pick.key] = 0.35 + R() * 0.4;
  }
  return m;
}

/* ── what a place deals in, and how much of it it has ─────────────────────
   Two facts about a place, working deliberately differently.

   WHAT IT BUYS is a function of where it is and nothing else, re-derived
   rather than stored — so it cannot go stale in a save, and a station you
   learned the habits of is the same station a week later. Cheap bulk moves
   nearly anywhere; the dear things are the gamble, and a hold of reactor
   cores is a thing you carry to somebody who wants them.

   WHAT IT HAS ON THE SHELF is stock, and stock is state: you can empty it.
   It comes back on a clock — half an hour of flying — and a delivery is not
   the last delivery, so what a station carries changes between them. That is
   the whole reason to fly back to one rather than on to the next. */
const RESTOCK = 1800;              // seconds of play between deliveries
const MAT_SALT = {};
MATERIALS.forEach((m, i) => { MAT_SALT[m.key] = 9973 + i * 7919; });

function buysMaterial(place, key) {
  const spec = matSpec(key);
  if (!place || !spec) return false;
  const R = seeded(chunkSeed(Math.round(place.x / 9) + MAT_SALT[key],
                             Math.round(place.y / 9) - MAT_SALT[key]));
  // Somebody always wants ice and iron. A reactor core needs a buyer.
  const odds = spec.value <= 3 ? 0.93 : spec.value <= 9 ? 0.72 : 0.45;
  return R() < odds;
}

/* Everything this place will take off you, with two guarantees: whatever it
   is habitually short of is always on the list — that is what being short of
   a thing means — and the list is never empty. A place you can fly a full
   hold into and not sell one single thing is a trap, not a market. */
function placeBuys(place) {
  const out = new Set();
  if (!place) return out;
  for (const m of MATERIALS) if (buysMaterial(place, m.key)) out.add(m.key);
  if (place === surv.docked) {
    const mk = marketOf(place);
    if (mk && mk.base) out.add(mk.base);
  }
  if (!out.size) out.add(MATERIALS[0].key);
  return out;
}

/* A delivery. `gen` counts them, so the shelf you clear is not the shelf that
   replaces it — two runs to the same station a clock apart are two different
   shops. */
function rollShelf(st, gen) {
  const deep = shelfDepth(st.x, st.y);
  const R = seeded(chunkSeed(Math.round(st.x / 5) + gen * 104729,
                             Math.round(st.y / 5) - gen * 15485863));
  /* Water and food almost always, and plenty of both when they are there. A
     station that cannot sell you water is a station that kills you, and
     finding one should be bad luck rather than a normal afternoon. */
  /* Your own station always has both. Everywhere else it is 19 times out of
     20, which is the "unlucky, not normal" the shelf is supposed to feel
     like — but home is the one counter you cannot choose to walk past. You
     start docked at it, you come back to it every time you die, and the
     mode's opening beat sends you to it for water. One run in twenty where
     that beat has nothing behind it is not bad luck, it is a broken start. */
  const always = !!st.home;
  /* The roll is drawn whether or not its answer is used, so every station
     that is not home draws exactly what it drew before this line existed and
     its shelf of parts is unchanged. */
  const stocks = () => { const roll = R() < 0.95; return always || roll; };
  const out = { gen, parts: {},
                water: stocks() ? 3 + Math.floor(R() * 5) : 0,
                food:  stocks() ? 3 + Math.floor(R() * 5) : 0 };
  for (const m of MODULES) {
    if (!sellsIt(m) || m.deep > deep) continue;
    // Common things are usually in. The rare ones are why you fly to a
    // particular station instead of the nearest one.
    const odds = m.rarity === "common" ? 0.8 : m.rarity === "uncommon" ? 0.55
               : m.rarity === "rare" ? 0.35 : 0.18;
    if (R() > odds) continue;
    out.parts[m.key] = 1 + Math.floor(R() * (m.rarity === "common" ? 3 : 2));
  }
  /* Home, with the signal beacon still out there. A counter that exists and a
     counter worth flying to are two different things: without a beacon it
     sells whatever washed up — one of each of the common things — and with
     one it can call in what it has not got. The filter is applied *after* the
     rolls rather than instead of them, so every draw this function makes is
     the draw it always made and no other station's shelf moves. */
  if (st.home && !stationHas("stock")) {
    for (const key of Object.keys(out.parts)) {
      const m = MODULES.find(x => x.key === key);
      if (!m || m.rarity !== "common") delete out.parts[key];
      else out.parts[key] = 1;
    }
  }
  return out;
}

/* The shelf as it stands, restocked lazily: nothing has to tick for a station
   nobody is standing in, and the first look after the clock runs out is the
   delivery arriving. */
function shelfOf(st) {
  const m = marketOf(st);
  if (!m) return null;
  if (!m.shelf || clock >= (m.restock || 0)) {
    m.shelf = rollShelf(st, (m.gen = (m.gen || 0) + 1));
    m.restock = clock + RESTOCK;
  }
  return m.shelf;
}

// How short it is of one thing, 0 to 1.
const shortageOf = (st, key) => {
  const m = marketOf(st);
  return m ? Math.max(0, Math.min(1, m.want[key] || 0)) : 0;
};

/* Something happened. `d` is how much, positive to deepen a shortage and
   negative to ease it — a convoy arriving eases, one being destroyed deepens. */
function moveMarket(st, key, d) {
  const m = marketOf(st);
  if (!m || !key) return;
  m.want[key] = Math.max(0, Math.min(1, (m.want[key] || 0) + d));
}

/* Every station you can see drifts back toward its baseline. Only the loaded
   ones: a station nobody has been near has no story to tell yet, and its
   baseline is what it would have drifted to anyway. */
function surveyMarkets(dt) {
  for (const st of surv.stations) {
    const m = marketOf(st);
    if (!m) continue;
    for (const key of Object.keys(m.want)) {
      const home = key === m.base ? 0.4 : 0;
      const gap = home - m.want[key];
      m.want[key] += Math.sign(gap) * Math.min(Math.abs(gap), SHORT_EASE * dt);
    }
  }
}

/* `quiet` prices a station you are not standing in: the same rule with the
   shortage left out. A shortage is a live number that belongs to a station
   somebody has been near, and asking for one by name would write a market
   entry into the save for every dot on the chart. What the lens sees is the
   standing price — where it is, and what that sky is worth — and a station
   that happens to be short of something today pays *more* than the board
   says, which is the right direction for a board to be wrong in. */
function stationPrices(st, quiet) {
  const out = {};
  if (!st) return out;
  const band = 1 + depthAt(st.x, st.y) * 1.1;
  /* A closed border (living.js, §6) is a tariff on foreign pilots, and you
     are one: its stations pay less. Live prices only — the ranging lens's
     quiet fold is a fact about where a station is, not about this week's law. */
  const tariff = !quiet && st.faction && livingLaw(st.faction, "borders") ? 0.88 : 1;
  for (const m of MATERIALS) {
    const R = seeded(chunkSeed(Math.round(st.x / 11) + m.key.length * 7919,
                               Math.round(st.y / 11) - m.key.charCodeAt(0) * 131));
    // What it is short of, it pays more for. That is the whole signal.
    const want = quiet ? 1 : 1 + shortageOf(st, m.key) * SHORT_MAX;
    out[m.key] = Math.max(1, Math.round(m.value * band * want * tariff *
                                        (0.78 + R() * 0.64)));
  }
  return out;
}

/* ── who pays best for what, over the whole chart ─────────────────────────
   The ranging lens's fold: every mooring in the gazetteer, priced quietly,
   kept as the best payer per material. It is cached because `surveyState` is
   built *every frame the HUD draws* and the gazetteer runs to six hundred
   entries — six hundred stations times six materials, each one seeding a
   generator, sixty times a second, is exactly the kind of quiet cost that
   shows up as a frame rate and never as a bug.

   Safe to cache because a quiet price is a pure function of where a station
   is: nothing but the gazetteer growing can change the answer. */
let payBest = null, payBestFor = null, payBestAt = -1;
function bestPayers() {
  if (payBest && payBestFor === surv && payBestAt === surv.known.size) {
    return payBest;
  }
  const out = {};
  for (const q of surv.known.values()) {
    if (q.k !== "station") continue;
    // Your own counter is what the board is compared against, not a
    // destination on it.
    if (dist2(q.x, q.y, HOME_STATION.x, HOME_STATION.y) < 400 ** 2) continue;
    const p = stationPrices(q, true);
    for (const m of MATERIALS) {
      if (!out[m.key] || p[m.key] > out[m.key].pays) {
        out[m.key] = { pays: p[m.key], x: q.x, y: q.y };
      }
    }
  }
  payBest = out; payBestFor = surv; payBestAt = surv.known.size;
  return out;
}

/* Buying off a world. Ten at a time, or whatever is left of the hold, of
   their stock or of your purse — three taps to fill a hold beats thirty, and a
   world that runs out is a world you have to find another of.

   A function rather than a closure on the state object, because the world's
   shelf is now a row in the same market list a station uses and the row's
   button calls it through `onBuyRow` — two callers, one rule. */
function buyLocal(n) {
  const w = surv.landed;
  if (!w || !w.trades || w.stock <= 0) { gameSound("hit"); return false; }
  const m = matSpec(w.trades);
  const price = Math.max(1, Math.round(m.value * 1.5 *
                          (1 + depthAt(w.x, w.y))));
  const room = holdCap() - holdUsed();
  const want = Math.min(Math.max(1, Math.round(n || 1)), room, w.stock,
                        Math.floor(surv.cash / price));
  if (want <= 0) { gameSound("hit"); return false; }
  surv.cash -= want * price;
  w.stock -= want;
  addMaterial(m.key, want);
  gameSound("start");
  chatter(want + " " + m.name.toLowerCase() + " aboard \u2014 " +
          money(want * price), CASH);
  saveSurveyBook();
  return true;
}

/* One material, and as much of it as was asked for. The shop's SELL tab has a
   row per thing in the hold and one, ten or the lot on each — so the rule that
   decides what a place pays lives here and in `sellHold`, and nowhere else.

   Same rule as the whole-hold sale: a station's shortage prices, a world's
   face value. */
function sellSome(key, n) {
  if (!surv.docked && !surv.landed) return 0;
  const m = MATERIALS.find(x => x.key === key);
  if (!m) return 0;
  if (!placeBuys(surv.docked || surv.landed).has(key)) {
    gameSound("hit");
    return 0;
  }
  const have = surv.hold[key] || 0;
  const take = Math.max(0, Math.min(Math.round(n || 0), have));
  if (!take) { gameSound("hit"); return 0; }
  const prices = surv.docked ? stationPrices(surv.docked) : null;
  const each = prices ? (prices[key] || m.value) : m.value;
  const got = Math.round(take * each);
  // A sale into a shortage is a relief the owner notices — see the living world.
  const shortBefore = surv.docked ? shortageOf(surv.docked, key) : 0;
  if (surv.docked) moveMarket(surv.docked, key, -0.04 * take);
  livingDelivery(surv.docked, key, take, shortBefore);
  surv.hold[key] = have - take;
  surv.cash += got;
  surv.t.sold = true;
  gameSound("win");
  chatter(take + " " + m.name.toLowerCase() + " sold — " + money(got), CASH);
  saveSurveyBook();
  return got;
}

/* A spare part, back over the counter. Half what it costs new, which is the
   only rate in the game that is not a shortage or a face value — a part is a
   made thing and a shop that paid full price for one would be a shop you
   could stand in and print money at. */
/* Water and food, back over the counter, at half what a tankful costs. A
   tank you overfilled at a cheap station was money you could not get at — the
   only thing aboard that could not be sold — and half is the same rate a part
   goes back at, for the same reason: a shop that bought supplies back at cost
   would be somewhere to park money rather than somewhere to buy water.

   It will sell you down to nothing if that is what you asked for. Everything
   here takes a quantity and a press, and a shop that second-guesses the
   number you typed is worse than one that does what you said. */
/* ── who takes the strange ones ───────────────────────────────────────────
   A part that is only ever found has no shelf price to halve, so until now it
   could not be sold anywhere at all: the row said nobody buys these and meant
   it, everywhere, forever. That made the rarest things in the game the only
   ones with no way of turning into anything.

   Some places take them. *Which* places is a fact about the place, fixed by
   where it is, so a dealer you found once is still there when you come back
   with the next one — and it is commoner the deeper you go, because the deep
   is where the strange things come from and the only people who know what one
   is worth are the people who see them.

   Sampled 600 places around each of five rings, this comes out at:

     home       13.5%   about one place in seven
     near       17.3%
     mid        20.0%
     far        27.7%
     abyssal    38.2%   about two in five

   Those figures were measured against distance, when `dangerAt` topped out
   near 0.36. It is the biome and the owner now, runs the whole way to 1, and
   is not a ring — so the coefficient is pitched to land the same spread, one
   place in seven in calm sky to two in five in the worst of it.

   It bites on exactly the two parts nobody stocks — the warp tuner and
   running dark, 480 at a dealer and nothing anywhere else. The exotics that
   *do* have a shelf price, the rail lance and the cold larder, still trade in
   anywhere at half of it: a thing with a price has a price.

   Stations and inhabited worlds both, on the same rule: a buyer is a buyer. */
function takesExotics(x, y) {
  const R = seeded(chunkSeed(Math.round(x / 13) + 40213,
                             Math.round(y / 13) - 9187));
  return R() < 0.13 + dangerAt(x, y) * 0.3;
}

/* What a find-only part is worth to somebody who deals in them. By rarity,
   because that is the only thing such a part has to be priced on — it has
   never been on a shelf. Pitched against the shop parts it sits beside: an
   exotic is worth more than the dearest thing a station stocks, which is why
   you would carry one home rather than fit it and forget it. */
const EXOTIC_TRADE = { common: 90, uncommon: 200, rare: 480, exotic: 1100 };

/* What this place would give you for one spare part, and the only answer to
   that question — the shelf, the sell button and the row all ask it here. */
function partResale(m, place) {
  if (!m) return 0;
  if (m.cost) return Math.max(1, Math.round(m.cost / 2));
  if (!place || !takesExotics(place.x, place.y)) return 0;
  return EXOTIC_TRADE[m.rarity] || 0;
}

function sellSupply(kind, frac) {
  if (!surv.docked && !surv.landed) return 0;
  if (kind !== "water" && kind !== "food") return 0;
  const full = kind === "water" ? WATER_FULL : foodCap();
  const take = Math.max(0, Math.min(surv[kind], (Number(frac) || 0) * full));
  if (take <= 0) { gameSound("hit"); return 0; }
  const got = Math.max(1, Math.round(take / full * supplyUnit(kind) / 2));
  surv[kind] -= take;
  surv.cash += got;
  gameSound("win");
  chatter(Math.round(take / full * 100) + "% of the " + kind +
          " sold — " + money(got), CASH);
  saveSurveyBook();
  return got;
}

function sellPart(key, n) {
  if (!surv.docked && !surv.landed) return 0;
  const m = moduleSpec(key);
  const each = partResale(m, surv.docked || surv.landed);
  if (!m || !each) { gameSound("hit"); return 0; }
  const have = storeCount(key);
  const take = Math.max(0, Math.min(Math.round(n || 0), have));
  if (!take) { gameSound("hit"); return 0; }
  const got = take * each;
  storeAdd(key, -take);
  surv.cash += got;
  gameSound("win");
  chatter(take + " " + m.name.toLowerCase() + " sold — " + money(got), CASH);
  saveSurveyBook();
  return got;
}

function sellHold() {
  if (!surv.docked && !surv.landed) return 0;
  /* A station has shortages and pays for them. A world pays what the stuff is
     worth and not a credit more — it is somewhere people live, not a market,
     and that gap is the reason to carry a full hold home rather than selling
     it to the first place with air. */
  const prices = surv.docked ? stationPrices(surv.docked) : null;
  // Only what this place takes. The rest stays in the hold for the next one.
  const takes = placeBuys(surv.docked || surv.landed);
  let got = 0, units = 0;
  for (const m of MATERIALS) {
    const n = surv.hold[m.key] || 0;
    if (!n || !takes.has(m.key)) continue;
    got += n * (prices ? (prices[m.key] || m.value) : m.value);
    units += n;
    surv.hold[m.key] = 0;
  }
  if (!units) { gameSound("hit"); return 0; }
  // Rounded here rather than only where it is printed: a fractional purse is a
  // purse that can buy something for exactly its own price and fail.
  got = Math.round(got);
  surv.cash += got;
  surv.t.sold = true;
  gameSound("win");
  chatter(units + " units sold \u2014 " + money(got), CASH);
  saveSurveyBook();
  return got;
}

/* Loose salvage drifts, and is collected by touching it — or, once the beam
   is fitted, by being near it. The tractor beam is the part most runs find
   first and the one that changes an ordinary flight most: before it, every
   mote is a manoeuvre; after it, a pass over a broken rock is one movement
   instead of six. */
function surveyMotes(dt) {
  const me = ships[0];
  /* A forgiving grab. Salvage is the reward for work you have already done —
     breaking the rock was the game, and threading a mote afterwards is not —
     so the pickup is wider than the hull rather than exactly it. */
  const reach = shipRadius() + 30 * U;
  /* The beam is either found in the almanac or bolted on as a part — either
     route gives you one, and a better rig gives you a longer, harder one.

     Named `mod`, and it matters: this was `m`, and the loop below names the
     *mote* `m` as well. Inside the loop the shadow won, so the beam's strength
     read `m.pull` off a mote — `undefined` — and every grab came out NaN. A
     mote caught in the ring had its velocity set to NaN, its position followed,
     and it was never picked up and never seen again. Salvage vanished inside
     the one thing meant to collect it. */
  const mod = mods();
  // A beam is a part on the nose, and nothing else gives you one.
  const beam = mod.tractor ? SURVEY_TRACTOR * (1 + mod.reach) * U : 0;
  for (let i = surv.motes.length - 1; i >= 0; i--) {
    const m = surv.motes[i];
    m.life -= dt;
    if (m.life <= 0) { surv.motes.splice(i, 1); continue; }
    m.spin += dt * 3;

    /* `beam` is the ring's *radius*, so it is the same number for every mote
       and says nothing about this one. Whether this mote is actually in the
       field is its own fact, and both the pull and the damping below have to
       be asked it — see the note on `beamDamp`. */
    let inBeam = false;
    if (me.alive && beam) {
      const d = Math.hypot(me.x - m.x, me.y - m.y);
      if (d < beam && d > 1) {
        inBeam = true;
        const grab = (1 - d / beam) * TRACTOR_PULL * (1 + mod.pull) * U;
        m.vx += ((me.x - m.x) / d) * grab * dt;
        m.vy += ((me.y - m.y) / d) * grab * dt;
        surv.tractorLit = 0.18;
      }
    }
    /* Gravity takes the salvage too. A well used to pull ships, rocks and
       bullets and leave the motes hanging in it — so the middle of a black
       hole was a cloud of untouched cargo, which is the opposite of what the
       warning system is warning you about. Everything that can move gets
       pulled now, and what reaches the middle is gone. */
    applyGravity(m, dt);
    m.x += m.vx * dt; m.y += m.vy * dt;
    /* A hotter beam must gather faster, not throw salvage through the pickup
       ring and leave it oscillating around the ship. Its extra pull therefore
       brings extra field damping with it; loose motes outside a beam keep the
       old drift exactly. */
    /* Asked of `inBeam`, not of `beam`. This read `beam` — the radius, which
       is simply "is a beam fitted" — so **fitting a tractor beam changed how
       every mote in the sector moved**, at any distance: each one had its
       velocity damped towards the ship's, so salvage nowhere near the ring
       slid along with you instead of drifting, and a well could no longer
       take it because the damping kept handing it your velocity back. The
       line above already promised loose motes keep the old drift exactly;
       this is the line that broke the promise. */
    const beamDamp = inBeam ? 0.55 + 0.9 * (mod.pull || 0) : 0.55;
    const damp = Math.exp(-beamDamp * dt);
    /* Inside the field, damp motion relative to the collector. Damping toward
       zero made debris lag behind a ship that gravity was moving, which could
       turn the heavy beam into a permanent orbit. */
    if (inBeam) {
      m.vx = me.vx + (m.vx - me.vx) * damp;
      m.vy = me.vy + (m.vy - me.vy) * damp;
    } else {
      m.vx *= damp; m.vy *= damp;
    }
    if (hazardAt(m.x, m.y, 0)) {
      burst(m.x, m.y, matSpec(m.mat).colour, 2, 60 * U);
      surv.motes.splice(i, 1);
      continue;
    }

    if (me.alive && dist2(m.x, m.y, me.x, me.y) < reach * reach) {
      if (addMaterial(m.mat || "iron", 1)) {
        const got = matSpec(m.mat || "iron");
        picked(got.name, 1, "in CARGO", got.colour);
        burst(m.x, m.y, matSpec(m.mat).colour, 3, 90 * U);
        if (Math.random() < 0.25) gameSound("pickup", m.x, m.y);
        surv.motes.splice(i, 1);
      }
    }
  }
}
