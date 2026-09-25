"use strict";

/* KONDRITE — SURVEY — SETUP AND THE SCAN
   ─────────────────────────────────────────────────────────────────────────────
   setupSurvey, the sandbox loadout, the arrow once the gate is open, finding
   things, the pulse, what each return is called, and what everybody else is
   doing.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

function setupSurvey() {
  const seed = surveySeed();
  linkCache = new Map();      // every lattice belongs to a seed, not to a tab
  worldCache = new Map();
  WORLD.clearCaches();        // and so does every region lattice
  const book = loadSurveyBook();
  const R = seeded(seed ^ 0x5bf03635);

  const carried = book.seed === seed;
  surv = {
    seed,
    // Rolled first: everything placed below asks it how abundant things are.
    world: rollWorld(seed),
    // A fresh seed is a fresh almanac: the entries are about this sector, so
    // carrying them into a different one would tick things you never saw.
    // The ship you built is the one exception — see `refit` below.
    found: new Set(carried ? book.found : []),
    chunks: new Map(), centre: null,
    planets: [], wrecks: [], nebulae: [], marks: [],
    coilExitAt: new Map(),
    traffic: [],
    /* Battles are the one thing out there with a clock on it. `battleAge` is
       how long each has been fought while you were near enough to see it, and
       it is written into the book — a battle you watched end has ended. */
    /* What each station is short of. Keyed by station rather than by chunk,
       because a shortage is a thing that happened to a place and the chunk is
       rebuilt every time you fly away from it. */
    market: {},
    battles: [], battleAge: (carried && book.battleAge) || {},
    // See `startSim`. Keyed by cabinet, then by machine.
    sims: (carried && book.sims) || {},
    memorials: new Set(carried && book.memorials ? book.memorials : []),
    bossesDown: new Set(carried && book.bossesDown ? book.bossesDown : []),
    /* Who holds the sky, as far as it has moved. The seed lays the map out;
       this is only the cells that have changed hands since, keyed "cx,cy",
       with "" for a cell nobody holds any more. See `WORLD.holderOf`. */
    claims: new Map(carried && Array.isArray(book.claims) ? book.claims : []),
    /* The living world: the powers' tempers and needs, the provinces anybody
       has looked at, and the record of what happened. See living.js. */
    living: livingFromBook(seed, carried ? book.living : null),
    /* The war as it stands, which is not the war the world rolled once it has
       been running a while. `strength` is each power's ability to keep
       fighting, 1 being whole; see `surveyWar`. */
    war: (() => {
      const w = rollWorld(seed);
      const saved = carried && book.war && typeof book.war === "object" ? book.war : null;
      return {
        pairs: saved ? Object.assign({}, saved.pairs) : Object.assign({}, w.war),
        belligerents: saved ? (saved.belligerents || []).slice()
                            : w.belligerents.slice(),
        strength: Object.assign({ cordon: 1, hallow: 1, morrow: 1 },
                                saved ? saved.strength : {}),
        calm: saved ? +saved.calm || 0 : 0,
        clock: 0
      };
    })(),
    /* What your chart knows about territory and biomes: per region cell, the
       biome and whose it was *when you saw it*. Only cells you have flown
       through or scanned. It is a record rather than a feed — a border that
       moved after you mapped it stays where you saw it until you look again. */
    mapped: new Map(carried && Array.isArray(book.mapped) ? book.mapped : []),
    gates: [], caches: [], stations: [], hulks: [], drones: [],
    leviathan: null,
    vault: null,             // the other thing with an inside; see `buildVault`
    shots: [],                 // what the sentries fire; see `surveyShots`
    motes: [],                 // loose salvage, drifting
    /* What the devices leave behind them. Both are things in the world rather
       than states of the ship \u2014 a decoy is somewhere, a mine is somewhere,
       and everything else out here has to be able to run into them. Neither is
       in the book: they are seconds long, and a mine that was still sitting
       there a week later is a trap you set and forgot. */
    decoys: [],
    mines: [],
    landmarks: [], landmarkAt: new Map(),
    partSites: [], partAt: new Map(), parts: [], fields: [],
    carrying: new Set(carried ? book.carrying : []),
    built: new Set(carried ? book.built : []),
    // The coil goes off once, when it comes off the gate. See `surveyParts`.
    coilFired: !!(carried && book.coilFired),
    /* Ships that owe you something, and ships that owe you the other thing.
       See `rememberFriend` and `rememberGrudge`. */
    friends: (carried && Array.isArray(book.friends) ? book.friends : []).slice(0, 12),
    grudges: (carried && Array.isArray(book.grudges) ? book.grudges : []).slice(0, 6),
    /* Parts you were carrying when you died. They sit where you died until you
       go back for them, and they are written into the book because a part you
       have to fetch is worthless if closing the tab loses it. */
    /* Two kinds now: a manifest part, and a spare you were carrying when you
       died. `mod` says which, and it decides which catalogue the key is looked
       up in — a whitelist that only knows about one of them throws the other
       away silently, which is the bug class this file has already shipped
       twice. */
    dropped: (carried && Array.isArray(book.dropped) ? book.dropped : [])
      .filter(d => d && droppedSpec(d))
      .map(d => ({ key: d.key, name: droppedSpec(d).name,
                   mod: !!d.mod, id: d.id || dropId(),
                   x: Math.round(+d.x || 0), y: Math.round(+d.y || 0) })),
    /* The four slots, and the parts you own but are not flying. A slot is
       `null`, or `{ key, fit }` where `fit` is the seconds of installation
       left — zero means it is working. */
    slots: (() => {
      const out = [null, null, null, null];
      const saved = carried && Array.isArray(book.slots) ? book.slots : [];
      for (let i = 0; i < SLOTS; i++) {
        const sl = saved[i];
        if (sl && moduleSpec(sl.key)) {
          out[i] = { key: sl.key, fit: Math.max(0, +sl.fit || 0) };
        }
      }
      return out;
    })(),
    store: (() => {
      const out = {};
      const saved = (carried && book.store) || {};
      for (const m of MODULES) {
        const n = Math.max(0, Math.round(+saved[m.key] || 0));
        if (n) out[m.key] = n;
      }
      return out;
    })(),
    contacts: [],
    /* `lit` is how long the scan's arrows stay up: a scan is a *pulse*, and
       what it turned up should fade with it rather than sitting on the edge of
       the screen for the rest of the run. The only marks that outlive it are
       the one you chose: a feature you picked off the chart. */
    scan: { charge: 1, reach: 0, flash: 0, lit: 0 },
    // Something you tapped on the map to keep an eye on. See `onSelect`.
    selected: carried ? book.selected : null,
    echoes: [],
    target: null,
    warn: null,
    known: new Map(carried && Array.isArray(book.known)
      ? book.known.map(e => [knownId(e.k, e.x, e.y), e]) : []),
    /* Pins the player drops on the chart. Endless space has no place names,
       so the only way anywhere gets one is if you say so — this is how a
       sector stops being uniform and starts having a "back at the twin suns".
       Kept in the book, because a note you lose on closing the tab is not a
       note. */
    pins: carried && Array.isArray(book.pins) ? book.pins.slice(0, 200) : [],
    save: 15,

    /* The two progression tracks. `salvage` and `refit` are the numbers one —
       found, spent, and kept in the book. The verbs come off `found.size` and
       are therefore not stored at all: what you have found is a fact about the
       almanac,
       so deriving it every time is the only way the two can never disagree. */
    cash: carried ? book.cash : 0,
    hold: carried ? book.hold : freshHold(),
    // Guards killed while their post is still in range. Not in the book: a
    // post you have left and come back to is manned again by design.
    deadGuards: new Set(),
    // Traffic that has been destroyed, remembered only while its chunk is up.
    goneTraffic: new Set(),
    /* What each power thinks of you. Numbers the player never sees — see
       `addRep` — and the thing that decides whether a ship follows you, shoots
       at you, or comes looking. */
    rep: carried && book.rep ? Object.assign({}, book.rep) : {},
    huntCool: 20,
    opened: new Set(carried ? book.opened : []),
    stripped: new Set(carried ? book.stripped : []),
    /* Loose parts already lifted off the floor. Same rule as the other two:
       the sector is rebuilt from its seed every time, so what you have taken
       out of it has to be remembered or it grows back.

       `lifted`, not `looted`: `surv.t.looted` is already a telemetry flag
       meaning you have stripped a wreck, and two different facts under one
       word on two nested objects is how the almanac and the arrows both went
       wrong before. */
    lifted: new Set(carried ? book.lifted || [] : []),
    /* Parts you have laid eyes on. The workbench lists what you can build;
       this is what lets it also list what you have *met* and cannot build — so
       a gun you saw on a shelf two hundred thousand units ago is still a thing
       you know exists and can plan a trip towards. Anything craftable is on
       the page whether or not it is in here. */
    seen: new Set(carried ? book.seen : []),
    docked: null,
    landed: null,        // an inhabited world within reach
    overAir: null,       // an atmosphere to draw water from
    // What a death reads off, and what it is measured against. `death` is the
    // page's whole content while it is non-null, and non-null *is* being dead.
    death: null,
    deaths: carried ? book.deaths : 0,
    runStart: 0,
    lastObjective: null,        // so a change can be told apart from a repeat
    // Which of the opening's beats have already fired. Kept in the book, so a
    // sector you have played is a sector that has stopped explaining itself.
    taught: new Set(carried ? book.taught : []),
    /* Which hull you are flying, and which ones you have bought. Owning is
       kept as well as flying, because a ship you paid sixty thousand for and
       then swapped out of should still be in the hangar when you come back —
       re-buying it would make every experiment cost full price. */
    ship: carried ? book.ship : "skiff",
    owned: new Set(carried ? book.owned : ["skiff"]),
    // The light drive: whether it is built, whether it is running, and what is
    // in the way if anything is.
    hasLight: carried ? !!book.light : false,
    lightRun: 0,
    lightHit: null,
    /* Seconds left, not a fraction: a fraction has to be multiplied by
       something to mean anything, and "four minutes of water" is a decision
       where "0.31" is a number. Resumed from the book, so closing the tab
       mid-haul does not hand you a full tank. */
    water: carried ? book.water : WATER_FULL,
    food:  carried ? book.food  : FOOD_FULL,
    thirst: 0, hunger: 0,        // how long each has been empty
    /* What each tank has warned about. `taught` is how many times the loud
       version has been shown and is kept in the book; `step` is how far down it
       has already warned this trip; `shout` is the seconds left on the word. */
    alert: (() => {
      const saved = (carried && book.alert) || {};
      const out = {};
      for (const k of ["water", "food"]) {
        const src = saved[k] || {};
        out[k] = { taught: Math.max(0, Math.min(9, Math.floor(+src.taught) || 0)),
                   step: 0, shout: 0, lit: false };
      }
      return out;
    })(),
    skimming: 0,                 // lit while an atmosphere is being drawn from
    melting: 0,                  // and while the melter is turning ice to water
    meltClock: 0,                // how long it has been running toward the next unit
    meltSaid: false,
    tractorLit: 0,
    warpCool: 0,
    quiet: 0,
    /* The three verbs that leave something running behind them. None of them
       is in the book, for the reason the cooldowns are not: a cloak that
       survived closing the tab is a rule nobody can see. */
    cloak: 0,          // seconds of it left; see DEVICES.cloak
    empSelf: 0,        // your own kit, down, after your own burst
    empRing: null,     // the burst going out, drawn once; see `empBurst`
    grappleTo: null,   // the line, for as long as it is worth drawing
    bumpCool: 0,

    t: {
      dist: 0, coast: 0, dark: 0, top: 0, charted: 0, fromHome: 0,
      stars: 0, holes: 0, eclipse: false, stopped: false,
      nearStar: false, leftHole: false, slung: false, threaded: false,
      skimmed: false, inWell: null, entrySpeed: 0,
      struck: false, warped: false, laden: false, refitted: false, sold: false,
      rescued: false, robbed: false,
      looted: false
    }
  };
  /* Anything that asked what kind of space a cell was while the object above
     was being built asked it of the last sector's world, or of none. */
  WORLD.territoryChanged();

  /* ── sandbox loadout ───────────────────────────────────────────────────
     This URL is a workbench, not a second progression save. Everything that
     can be earned or bought in Survey is available here on every load, while
     the separate `SURVEY_STORE` above keeps all of it out of the real run. */
  if (LEV_ONLY) {
    surv.found = new Set(ALMANAC.map(e => e.key));
    surv.built = new Set(BUILD.map(b => b.key));
    surv.owned = new Set(SHIPS.map(sh => sh.key));
    surv.hasLight = true;
    surv.coilFired = true;
    surv.cash = 9999999;
    for (const m of MODULES) surv.store[m.key] = 1;
  }

  /* The landmarks, one to each equal slice of the compass with a little play
     inside its own slice. The golden angle was the first thing tried and it
     is the wrong tool here: over seven items it wraps, and a wrap can drop two
     landmarks a tenth of a radian apart — which makes the ladder a corridor
     rather than a sector. Equal slices cannot, and the jitter is bounded well
     inside a slice so it never can either. */
  const slice = (Math.PI * 2) / LANDMARKS.length;
  const a0 = R() * Math.PI * 2;
  /* The rungs of the ladder stay the same shape; which landmark stands on
     which is dealt per world, and the whole ladder is stretched or squeezed
     by the world's spread. So the distances are still a sensible progression
     and the *route through them* is different every seed. */
  /* The rungs belong to the landmarks that are dealt one. A landmark with
     `fixed` on it stands at its own distance in every sector and takes no rung
     with it — see the Leviathan. */
  const rungs = LANDMARKS.filter(L => !L.fixed).map(L => L.dist);
  /* Jitter is applied per rung, and the gaps between rungs are as small as
     1.27 — so two neighbours can swing past each other and land in the wrong
     order, or on top of one another. Each distance is therefore held above the
     one before it: the ladder is still dealt and still stretched, it just
     cannot fold. */
  let floorD = 0;
  surv.world.order.forEach((key, i) => {
    const L = LANDMARKS.find(l => l.key === key);
    const a = a0 + i * slice + (R() - 0.5) * slice * 0.6;
    const d = Math.max(floorD * 1.14,
                       rungs[i] * surv.world.spread * (0.85 + R() * 0.3));
    floorD = d;
    const lm = { key: L.key, name: L.name, r: L.r,
                 x: Math.cos(a) * d, y: Math.sin(a) * d,
                 found: surv.found.has(L.key) };
    surv.landmarks.push(lm);
    surv.landmarkAt.set(
      chunkKey(Math.floor(lm.x / CHUNK), Math.floor(lm.y / CHUNK)), lm);
  });

  /* And the ones that stand at their own distance. A bearing off the end of
     the same set of slices, so it cannot land on top of a rung, and a modest
     jitter on the distance so two sectors are not identical — but no `spread`,
     because the whole point of a fixed landmark is that the seed cannot put it
     out of reach. */
  LANDMARKS.filter(L => L.fixed).forEach((L, k) => {
    const a = a0 + (surv.world.order.length + k) * slice +
              (R() - 0.5) * slice * 0.6;
    const d = L.dist * (0.86 + R() * 0.28);
    const lm = { key: L.key, name: L.name, r: L.r,
                 x: Math.cos(a) * d, y: Math.sin(a) * d,
                 found: surv.found.has(L.key) };
    surv.landmarks.push(lm);
    surv.landmarkAt.set(
      chunkKey(Math.floor(lm.x / CHUNK), Math.floor(lm.y / CHUNK)), lm);
  });

  /* The parts. Placed like landmarks and deliberately off their bearings, so a
     run at the manifest is not the same flight as a run at the almanac —
     finding one does not hand you the other. The plate has no bearing of its
     own: it lives inside the Leviathan, which already has one. */
  const outer = BUILD.filter(b => !b.inside);
  const pslice = (Math.PI * 2) / outer.length;
  const pa0 = R() * Math.PI * 2 + pslice / 2;
  const prungs = outer.map(b => b.dist);
  /* **The manifest is the tutorial, so it has to stay walkable.** The rungs
     run to 52,000 and the world's own spread multiplies them, so on a wide
     world the last part sat seventy thousand units out — most of an hour of
     flying for somebody still learning why they would want to.

     Scaled rather than clamped: clamping would pile the outer two on top of
     each other at the cap and lose the ladder. This keeps every rung's
     spacing and shrinks the whole thing until the furthest lands inside
     45,000. */
  const maxRung = Math.max(...prungs);
  const fit = Math.min(1, 45000 / (maxRung * surv.world.spread * 1.12));
  // Dealt the same way, so which clue you chase first changes with the world.
  surv.world.partOrder.forEach((key, pi) => {
    const B = BUILD.find(b => b.key === key);
    const a = pa0 + pi * pslice + (R() - 0.5) * pslice * 0.5;
    const d = prungs[pi] * surv.world.spread * (0.88 + R() * 0.24) * fit;
    const site = { key: B.key, name: B.name, x: Math.cos(a) * d,
                   y: Math.sin(a) * d, r: 40 };
    surv.partSites.push(site);
    surv.partAt.set(
      chunkKey(Math.floor(site.x / CHUNK), Math.floor(site.y / CHUNK)), site);
    /* The coil's gate is the one gate not rolled off the lattice, so the
       chunk holding its far mouth has to be told to expect it — nothing else
       in an endless sector could know it was there. */
    if (B.key === "coil") {
      const L = coilLink(site);
      surv.coilExitAt.set(
        chunkKey(Math.floor(L.bx / CHUNK), Math.floor(L.by / CHUNK)), L);
    }
  });

  /* ── what the arrow points at once the gate is open ───────────────────
     The manifest ends and the objective arrow goes out, which is the right
     shape for "you have finished the tutorial" and the wrong shape for the
     ten hours after it: the mode's whole answer to *now what* was a sector
     with nothing marked in it.

     So there is one thing left on the board. TRACTOR BEAM MK1 is the bottom
     rung of the tractor ladder and the part that changes an ordinary flight
     more than any other — a broken rock is one pass instead of nine — so it
     is the right first thing to want and a poor thing to be given.

     Placed like a landmark rather than rolled into a chunk: an arrow needs
     somewhere fixed to point, and a site that depends on which chunks you
     happen to have visited is a site the arrow cannot name. Off the end of
     the manifest's own bearings so it is not on top of a rung, and inside
     the same 45,000 the manifest is held to — it is the next errand, not an
     expedition. */
  {
    const a = pa0 - pslice * 0.5 + (R() - 0.5) * pslice * 0.4;
    const d = 31000 * (0.9 + R() * 0.3);
    const B = moduleSpec("tractormk1");
    const site = { key: "tractormk1", name: B ? B.name : "TRACTOR BEAM MK1",
                   x: Math.cos(a) * d, y: Math.sin(a) * d, r: 40, mod: true };
    surv.mk1Site = site;
    surv.partAt.set(
      chunkKey(Math.floor(site.x / CHUNK), Math.floor(site.y / CHUNK)), site);
  }

  /* No arena, so `bounds` is only here to keep the code that reads it from
     reading NaN — nothing in Survey ever reaches it, because `edgeOf` is
     skipped rather than given a bigger box to bounce off. */
  bounds = { x0: -1e7, y0: -1e7, x1: 1e7, y1: 1e7 };

  const me = ships[0];
  /* A new survey opens *at the station*, not in empty space at the origin.
     That single change is most of the two-minute pass: you did not choose to be
     there, you cannot leave without noticing the shop, and the tanks are low
     enough that the first thing you want is the first thing it sells.

     A resumed survey starts where it left off, stopped and pointed the way it
     was pointed, having already been taught all of this — so the opening is
     something that happens once rather than every time the tab is reopened.

     It used to resume at the origin unconditionally, which read as tidy and
     was in fact the cheapest way home in the game: fly to the abyss with a
     full hold, close the tab, open it next door to the shop. Coming back to
     where you actually were is the whole point of a save, and it makes the
     light drive and the gates the ways home rather than the reload.

     A book written before this resumes at the origin, as does one written
     while its owner was dead — see `surveyBook`. */
  const opening = !carried;
  /* Only this sector's. A book left over from a different seed still has an
     `at` in it, and it describes a place in a world that no longer exists. */
  const resumedAt = carried ? book.at : null;
  if (opening) {
    me.x = HOME_STATION.x - 210;
    me.y = HOME_STATION.y + 130;
    me.a = Math.atan2(HOME_STATION.y - me.y, HOME_STATION.x - me.x);
    // Low, not empty: there is no countdown running and no emergency, only a
    // reason to press the button you are parked in front of.
    surv.water = WATER_FULL * 0.3;
    surv.food = FOOD_FULL * 0.55;
  } else if (resumedAt) {
    me.x = resumedAt.x; me.y = resumedAt.y; me.a = resumedAt.a;
  } else {
    me.x = 0; me.y = 0; me.a = -Math.PI / 2;
  }
  /* The empty room opens where the only thing in it is. Off the bow at two
     and a half thousand units — far enough out that the whole nine thousand
     of it is on the screen at once, pointed at it, stopped. See `LEV_ONLY`. */
  const levLM = LEV_ONLY && surv.landmarks.find(l => l.key === "leviathan");
  if (levLM) {
    /* Three thousand out and pointed at it. The distance is not aesthetic: the
       streamer only builds chunks within `CHUNK_LOAD` of the ship, so a spawn
       far enough away to frame the whole nine thousand units of it is a spawn
       where it has not been built yet — which is a sector containing nothing
       at all. Three thousand is comfortably inside one chunk of separation in
       any alignment.

       It will not fit on the screen from here and it is not supposed to. The
       view is about 1,400 units across and the hull is 9,200 long; the only way
       to see this thing is to fly along it, which is the whole point of the
       room. */
    me.x = levLM.x - 3000;
    me.y = levLM.y - 900;
    me.a = Math.atan2(levLM.y - me.y, levLM.x - me.x);
    surv.water = WATER_FULL;
    surv.food = FOOD_FULL;
  }
  me.vx = me.vy = 0;
  applyRefit(me);
  me.hull = me.maxHull;
  surv.runStart = clock;
  me.invuln = INVULN;
  // The camera starts where the run starts. It has always started at the
  // origin, which is right for an ordinary sector because that is where you
  // are; the empty room begins forty thousand units away from it.
  /* Where the ship is, which used to be the same thing as the origin for
     every resumed run and is not any more. Getting this wrong is not subtle:
     the camera lerps, so the whole sector slides past for a second before it
     catches up with a ship that was never at the origin. */
  cam.x = (levLM || resumedAt) ? me.x : 0;
  cam.y = (levLM || resumedAt) ? me.y : 0;

  rocks = [];
  streamChunks(true);
  streamRocks();

  /* And then put exactly where it wants to be, now that the thing exists.
     Which way the Leviathan lies is decided by the chunk it lives in, and that
     chunk does not exist until the line above — so the spawn before it is only
     close enough to make the streamer build it, and this is the real one:
     square on to the flank, fourteen hundred units off the plates, at the
     midships, pointed at it. That distance is set by the camera rather than by
     taste: the empty room opens at a zoom that shows about 5,000 units across,
     so this puts the whole beam of it in the window with the bow and the stern
     running off both edges. */
  const levBuilt = levLM && surv.leviathan;
  if (levBuilt) {
    const L = surv.leviathan;
    const nx = -L.sa, ny = L.ca;          // square on to the long axis
    const off = L.flank + L.len * 0.15;    // scales with her, not with a guess
    me.x = L.x + nx * off;
    me.y = L.y + ny * off;
    me.a = Math.atan2(L.y - me.y, L.x - me.x);
    me.vx = me.vy = 0;
    cam.x = me.x; cam.y = me.y;
    streamChunks(true);
  }

  if (surveyHUD) {
    surveyHUD.reset();
    if (book.seed === seed) {
      if (book.fog) surveyHUD.importFog(book.fog);

    }
  }

  /* `?debug=1&stock=1` — a hold with something in it, for looking at the
     pages that show one. The cargo grid, the ship's slots and the spares
     tray all draw nothing worth checking on a fresh run, and flying out and
     mining a full hold to see whether a caption fits is not a way to check
     a caption. Debug only, and never any part of a played run.

     Two fitted and a spread of spares, because "attached" and "aboard" are
     drawn differently and the difference is the thing worth looking at. */
  if (debugOn && new URLSearchParams(location.search).get("stock") === "1") {
    /* Cleared first. `storeAdd` adds to what is there, and a resumed run
       already has a hold — so stocking one twice stacked, and the second
       look at the page was 117 of 60 with no room left for a single unit of
       ice. The flag describes a hold rather than adding to one.

       And filled to just under the cap, not past it: an impossible hold puts
       the page into its over-capacity state, and every look at it is then a
       look at an alarm rather than at the ordinary page, full. */
    surv.store = {};
    surv.slots = [null, null, null, null];
    for (const m of MATERIALS) surv.hold[m.key] = 0;

    surv.slots[0] = { key: MODULES[0].key, fit: 0 };
    surv.slots[1] = { key: MODULES[1].key, fit: 0 };
    // Two fitted and a spread of spares: "attached" and "aboard" are drawn
    // differently and the difference is the thing worth looking at.
    for (const m of MODULES.slice(0, 12)) {
      if (surv.slots.some(sl => sl && sl.key === m.key)) continue;
      if (roomForPart(m.key)) storeAdd(m.key, 1);
    }
    /* And *not* to the brim. Two thirds of what is left, spread over the six
       materials, because a hold filled to 59 of 60 cannot take a part back
       off the ship — `pullModule` refuses rather than let the cap be a cap
       that is not one — so a fixture that fills it completely is a fixture
       that cannot be used to check the one page it exists for. */
    const spare = Math.max(0, holdCap() - holdUsed());
    const each = Math.floor(spare * 0.66 / MATERIALS.length);
    for (const m of MATERIALS) surv.hold[m.key] = each;
    surv.cash = 250000;
    surv.water = WATER_FULL * 0.8;
    surv.food = foodCap() * 0.8;
  }

  banner = LEV_ONLY
    ? { text: "LEVIATHAN LAB", t: 4.2, colour: CASH,
        sub: "invulnerable · every hull and part unlocked" }
    : { text: "SURVEY", t: 3.8, colour: NEBULA,
        sub: carried ? "SEED " + seed + "  ·  " + surv.world.name
                     : "you are docked  ·  " + surv.world.name };
}

/* ── finding things ───────────────────────────────────────────────────────
   One way in, so the toast, the sound, the chart mark and the save all happen
   together and cannot drift apart. */
function surveyFind(key) {
  if (!surv || surv.found.has(key)) return;
  const entry = ALMANAC.find(e => e.key === key);
  if (!entry) return;
  surv.found.add(key);
  for (const lm of surv.landmarks) if (lm.key === key) lm.found = true;
  for (const c of surv.contacts) if (c.key === key) c.resolved = true;
  if (surveyHUD) {
    surveyHUD.logged({ name: entry.name, note: entry.note,
                       n: surv.found.size, of: SURVEY_TOTAL });
  }
  gameSound("win", ships[0] && ships[0].x, ships[0] && ships[0].y);
  saveSurveyBook();
}

/* ── the pulse ────────────────────────────────────────────────────────────
   The scan used to answer a question nobody asked. It returned a compass
   bearing to the nearest almanac entry you had not logged — which is a fine
   thing to have and a terrible thing to press a button for, because the
   answer was a number in a message feed and nothing on screen ever explained
   what it was a number about.

   It is a survey now, which is what a scan should be in a mode called Survey:
   it sweeps a radius and tells you what is inside it. Salvage, caches,
   stations, gates, parts, sentries — each one comes back as a tagged echo
   that sits on the world and on the chart until it fades. That is a thing you
   can see the result of, and the scanner refit makes the circle bigger, which
   is a thing you can feel.

   Direction to the thing you are actually looking for is no longer here at
   all. It belongs on the HUD, permanently, next to the clue that says what
   you are looking for — see `objective`. A button you have to press to be
   told what you are doing is a button that is doing the interface's job. */
/* What a scan can return, and — since the returns go on the minimap now —
   whether each one is a thing you want or a thing that wants you. A sentry and
   a station cannot read as the same dot; that distinction is the entire value
   of a scan you can see at a glance. */
const ECHO_KINDS = {
  part:    { name: "COMPONENT", colour: CASH,          bad: false },
  cache:   { name: "CACHE",     colour: CASH,          bad: false },
  sealed:  { name: "GUARDED",   colour: DRONE_COLOUR,  bad: true },
  station: { name: "STATION",   colour: CASH,          bad: false },
  gate:    { name: "GATE",      colour: "#5ce1ff",     bad: false },
  hulk:    { name: "HULK",      colour: WRECK,         bad: false },
  /* Not "CASH". A scan return is a thing in the sky, and the thing is ice or
     iron or a reactor core — cash is what it becomes at a counter two hours
     later. The name is filled in from the mote itself; this is the fallback
     for a return with no material on it. */
  salvage: { name: "SALVAGE",   colour: CASH,          bad: false },
  drone:   { name: "SENTRY",    colour: DRONE_COLOUR,  bad: true },
  traffic: { name: "TRAFFIC",   colour: "#8fb4d8",     bad: false },
  patrol:  { name: "PATROL",    colour: CASH,          bad: false },
  distress:{ name: "DISTRESS",  colour: "#ffcb42",     bad: false },
  hunter:  { name: "HUNTER",    colour: "#ff6b6b",     bad: true }
};

function surveyScan() {
  if (!surv) return;
  /* Not while your own burst is still ringing, and asked *before* the charge,
     because a scan with no charge returns in silence — you can see the ring
     filling and silence is the right answer. A scanner that is charged and
     still will not fire is the one case that needs a sentence. */
  if (surv.empSelf > 0) {
    chatter("Your own burst took the scanner \u2014 " +
            Math.ceil(surv.empSelf) + " seconds.", "#ffcb42");
    return;
  }
  if (surv.scan.charge < 1) return;
  surv.scan.charge = 0;
  if (surveyHUD) surveyHUD.ping();
  gameSound("shot", ships[0].x, ships[0].y);

  const me = ships[0];
  const reach = scanRange();
  const r2 = reach * reach;
  const found = [];
  /* `ref` is for the things that move. A scan of a sentry used to record where
     it was and then sit there while the sentry flew off — so the one echo you
     most want to be accurate was the one guaranteed to be wrong within a
     second, and it read as sentries "not showing up right". An echo with a
     reference reads its position every frame instead, and disappears when the
     thing it is following does. */
  const add = (kind, x, y, ref) => {
    if (dist2(x, y, me.x, me.y) <= r2) {
      found.push({ kind, x, y, t: ECHO_LIFE, ref: ref || null });
    }
  };

  for (const pt of surv.parts) add("part", pt.x, pt.y);
  for (const c of surv.caches) add(c.sealed ? "sealed" : "cache", c.x, c.y);
  for (const st of surv.stations) add("station", st.x, st.y);
  for (const g of surv.gates) add("gate", g.x, g.y);
  for (const h of surv.hulks) add("hulk", h.x, h.y);
  for (const d of surv.drones) add("drone", d.x, d.y, d);
  // Traffic moves, so it is tracked rather than photographed, the same way a
  // sentry is — and a distress call is the one return worth crossing a sector
  // for, so it comes back as its own kind rather than as generic traffic.
  for (const t of surv.traffic) {
    add(t.kind === "patrol" ? "patrol"
      : t.kind === "distress" ? "distress"
      : t.kind === "hunter" ? "hunter" : "traffic", t.x, t.y, t);
  }
  /* Loose salvage is clustered by nature — a broken rock is twenty motes — so
     it is reported as one echo per cluster rather than twenty on top of each
     other, which would bury everything else on the chart. */
  const seen = [];
  for (const m of surv.motes) {
    if (dist2(m.x, m.y, me.x, me.y) > r2) continue;
    /* Clustered **per material**. A broken rock gives ice and iron in the
       same place, and a purely spatial cluster could only be named after
       whichever mote happened to come first — so the other half of the pile
       went unreported, and what *was* reported was a coin toss. Measured with
       twelve iron motes four hundred units away: no IRON return at all,
       because they fell inside an ICE cluster.

       Two rings at nearly the same spot is the honest answer. They are two
       different facts and you want both. */
    if (seen.some(c => c.mat === m.mat &&
                       dist2(c.x, c.y, m.x, m.y) < 260 * 260)) continue;
    seen.push(m);
    // Carrying the mote, so the return can say what it is.
    
    found.push({ kind: "salvage", x: m.x, y: m.y, t: ECHO_LIFE, ref: m });
  }

  /* ── what each return is called, decided once ──────────────────────────
     Three different places were asking this separately — the ring drawn on
     the world, the arrow on the panel's edge, and the sentence the scan
     prints — so changing the answer in one of them left the other two saying
     something else. A mote came back as ICE on the ring and "salvage" in the
     sentence, which is worse than either being wrong on its own, because now
     the scanner contradicts itself.

     It is written on the echo. Everything downstream reads it and nothing
     downstream decides it. */
  for (const e of found) {
    const spec = ECHO_KINDS[e.kind] || ECHO_KINDS.salvage;
    const mat = e.kind === "salvage" && e.ref && e.ref.mat
      ? matSpec(e.ref.mat) : null;
    const ship = e.ref && e.ref.faction ? e.ref : null;
    e.name = ship ? callsignOf(ship) : mat ? mat.name : spec.name;
    e.colour = mat ? mat.colour
             : ship ? trafficColour(ship) : spec.colour;
    e.bad = !!spec.bad;
    /* What the *sentence* counts by, which is not what the ring is labelled
       with. Every ship has its own callsign now, and tallying by the label
       would turn "3 traffic" into three separate lines naming three
       individual freighters — a list where a glance was wanted. The ring
       names the ship; the sentence counts the kind. */
    e.group = ship ? (CALLSIGNS[ship.role || ship.kind] || "SHIP")
            : mat ? mat.name : spec.name;
    /* Whether it is in trouble or making it, read off what it is doing —
       the two words LIVING-WORLD.md §13 asks a meaningful contact to carry.
       Drawn as a badge, not said: the ring already has a name on it. */
    e.trouble = !ship ? ""
      : ship.role === "distress" || (ship.maxHp && ship.hp / ship.maxHp < 0.45) ? "in"
      : ship.role === "pirate" || ship.role === "hunter" || ship.angry ? "making"
      : "";
  }

  /* A scan writes what it finds into the gazetteer. Half the value of
     pressing the button is that the chart remembers the answer. */
  for (const e of found) {
    // Everything that moves is left out: a note of where a freighter was an
    // hour ago is worse than no note at all.
    if (e.kind === "salvage" || e.kind === "drone" || e.kind === "traffic" ||
        e.kind === "patrol" || e.kind === "distress" ||
        e.kind === "hunter") continue;
    noteKnown(e.kind === "sealed" ? "cache" : e.kind, e.x, e.y);
  }
  surv.echoes = found;
  surv.scan.reach = reach;
  surv.scan.flash = 1;
  // And the arrows are up, for as long as the returns are.
  surv.scan.lit = ECHO_LIFE;
  surv.t.scanned = true;

  if (!found.length) {
    chatter("Nothing within " + Math.round(reach) + " units.", NEBULA);
    return;
  }
  /* A tally rather than a list: what is out there, and how much of it.

     Counted by **what the thing is**, not by the bucket the scanner files it
     under. Every mote in the sector came back as one word — "4 salvage", and
     before that "4 cash" — which is the scanner declining to answer the only
     question you pressed it for. Ice is not iridium, and the difference is
     the whole reason to fly over and look. */
  const tally = {};
  const ore = {};
  const many = {};
  for (const e of found) {
    tally[e.group] = (tally[e.group] || 0) + 1;
    if (e.kind === "salvage") ore[e.group] = true;
    /* Which words take an S. Ships are things you can count and ore is not —
       "2 cargo ships" and "3 ice", never "3 ices". The flag is set from what
       the return *is* rather than from a list of words, so a role added later
       is pluralised without anybody remembering to add it. */
    else if (e.ref && e.ref.faction) many[e.group] = true;
  }
  /* **The things you would fly to, first.** Naming each mineral means a field
     that has been worked over now reports four or five kinds of ore, and the
     line is sorted by how much of each there is — so a station, a cache or a
     part could be pushed off the end of a sentence that has to fit on one
     line. Ore is the commonest thing out there and the least urgent; it goes
     last whatever the counts say, and within each half the biggest pile still
     leads. */
  const parts = Object.keys(tally)
    .sort((a, b) => (ore[a] ? 1 : 0) - (ore[b] ? 1 : 0) || tally[b] - tally[a])
    .map(k => tally[k] + " " + k.toLowerCase() +
              (tally[k] > 1 && many[k] && !/s$/i.test(k) ? "s" : ""))
    .join("  ·  ");
  chatter(parts, NEBULA);
  /* And the borders of where you are, if the chart did not have them. Said
     once, in the place's own words, so a scan in new sky is also the moment
     you learn what the sky is called. */
  // A boss's sky the pulse reached goes on the chart, and is said.
  {
    const L = lairNear(me.x, me.y, reach);
    if (L && noteKnown("boss", L.x, L.y, L.name, L.r)) {
      chatter("The scan found " + L.name + "'s sky.", BOSS_COLOUR);
    }
  }
  if (scanBorders() > 0) {
    const here = placeAt(me.x, me.y);
    chatter("Charted the edges of " + here.biome.name + " and " +
            here.space.name + ".", NEBULA);
  }
}

/* A hull that runs out does not end anything. It leaves you adrift where you
   fell, because there is no beacon to be dragged home to and no run to lose —
   the mode has no fail state to protect and inventing one would only punish
   going and looking. Falling into a well is the exception: it puts you back
   at the edge of it, since the alternative is dying again immediately. */
/* ── what everybody else is doing ─────────────────────────────────────────
   Haulers run their line. Patrols hold their circuit and shoot at sentries,
   never at you — an armed neutral that opens fire on the player is not company,
   it is another enemy with a different colour. A distress call sits there
   losing hull until either its attackers are dead or it is.

   None of them shoot at you and none of them get in your way, which is the
   point: the sector should feel inhabited without becoming another thing to
   manage. What you can do to them is your business. */
/* Where a follower should be. Nothing, if it has no leader any more — the
   leader died, broke off, or went adrift — in which case the group is over
   and this ship gets on with its own wants. Otherwise:

     · a pirate goes for whatever its leader is going for;
     · a patrol wing turns on whatever its leader is angry at;
     · everything else holds its slot off the leader's quarter, and a hauler
       in a convoy unloads when its leader reaches the station.

   Escorts are not here: their want is already "keep the client alive", and
   the client is the convoy's hauler. */
function formationFor(t, byId) {
  if (!t.leadId) return null;
  const lead = byId.get(t.leadId);
  /* Out of the loaded list is not dead: a leader that has flown out of range
     comes back when its chunk does, and its group should still be its group.
     Only a kill, running dry or running away ends one. */
  if (!lead) {
    if (surv.goneTraffic.has(t.leadId)) t.leadId = null;
    t.leader = null;
    return null;
  }
  if (lead.adrift || lead.kind === "distress" || lead.breakOff > 0) {
    t.leadId = null;
    t.leader = null;
    return null;
  }
  t.leader = lead;
  if (t.role === "escort") return null;
  if (t.role === "pirate" && lead.mark && lead.markKind === "ship") {
    t.mark = lead.mark; t.markKind = "ship";
    return lead.mark;
  }
  if (t.role === "patrol" && lead.angryAt) {
    t.angryAt = lead.angryAt;
    t.mark = lead.angryAt; t.markKind = "ship";
    return lead.angryAt;
  }
  if (lead.markKind === "station" && lead.mark && t.cargo.length &&
      Math.hypot(lead.mark.x - t.x, lead.mark.y - t.y) < 900) {
    for (const key of t.cargo) moveMarket(lead.mark, key, -0.3);
    t.cargo = [];
  }
  const slot = t.slot || { back: 320, side: 0 };
  const c = Math.cos(lead.a), s2 = Math.sin(lead.a);
  return { x: lead.x - c * slot.back - s2 * slot.side,
           y: lead.y - s2 * slot.back + c * slot.side };
}
