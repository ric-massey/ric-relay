"use strict";

/* KONDRITE — SURVEY — STAYING ALIVE
   ─────────────────────────────────────────────────────────────────────────────
   Running at light, the low-tank warning, repairs, dying, what a part does
   when you die, and the spares in the hold.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── running at light ─────────────────────────────────────────────────────
   Engaged and disengaged by the player, and dropped for them the moment
   anything is about to matter. Three things end a run: pressing again, taking
   a hit, and arriving.

   The impact check looks along the heading rather than at what is nearby,
   because at eight times drive speed "nearby" is behind you. It only ever
   looks for the two things worth stopping for. */
function lightDriveOn() { return !!(surv && surv.lightRun > 0); }

function toggleLightDrive() {
  if (!surv || !surv.hasLight || surv.death) return false;
  const me = ships[0];
  if (!me || !me.alive) return false;
  if (surv.lightRun > 0) {
    surv.lightRun = 0;
    surv.lightHit = null;
    /* Dropped to something you can steer, rather than left coasting at eight
       times drive speed for the next twenty seconds. Cutting the drive is a
       decision you made; a slingshot is something that happened to you, and
       only the second one is momentum worth keeping. */
    const ordinary = MAX_SPEED * (me.speedMul || 1) * U;
    const sp = Math.hypot(me.vx, me.vy);
    const to = ordinary * 1.6;
    if (sp > to) { me.vx *= to / sp; me.vy *= to / sp; }
    // Left with an allowance to spend, so it glides down rather than stopping
    // dead the frame the drive goes off.
    me.boost = Math.max(0, Math.min(sp, to) - ordinary);
    chatter("Light drive disengaged.", ICE_C);
    return true;
  }
  // Not from inside a well: the drive cannot outrun one and pretending it can
  // would make the gravity warning a lie.
  if (surv.warn && surv.warn.ratio >= 0.5) {
    gameSound("hit");
    chatter("Too deep in a well to run.", "#ff8f77");
    return false;
  }
  surv.lightRun = 0.0001;
  surv.lightHit = null;
  gameSound("win", me.x, me.y);
  chatter("Light drive engaged — hold your heading.", ICE_C);
  return true;
}

/* What is in the way, and how long until it is not in the way any more. Only
   massive worlds and supermassive wells: everything else at this speed is
   either harmless or already behind you. */
function lightObstacle(me, speed) {
  if (speed < 1) return null;
  /* The heading is the nose, not the velocity divided by whatever speed was
     passed in. Normalising by the reference speed rather than by the actual
     velocity gave a heading vector shorter than unit length, which shrank every
     projection along it — so a world 18,000 units ahead read as 2,000 and the
     "five-second" warning arrived with eight-tenths of a second to spare.
     The drive pushes along `a`, so `a` is the direction of travel by
     construction and there is nothing to divide. */
  const hx = Math.cos(me.a), hy = Math.sin(me.a);
  const range = speed * (LIGHT_WARN + 1.5);
  let best = null;
  const consider = (x, y, r, what, name) => {
    const dx = x - me.x, dy = y - me.y;
    const along = dx * hx + dy * hy;
    if (along <= 0 || along > range) return;          // behind, or too far
    const off = Math.abs(dx * hy - dy * hx);
    if (off > r) return;                              // it will pass to a side
    const eta = (along - r) / speed;
    if (!best || eta < best.eta) best = { eta: Math.max(0, eta), what, name, x, y, r };
  };
  for (const pl of surv.planets) {
    if (pl.r < LIGHT_MIN_WORLD) continue;
    consider(pl.x, pl.y, pl.r, "world", pl.name || "A WORLD");
  }
  for (const h of hazards) {
    if (h.k < SUPERMASSIVE) continue;
    consider(h.x, h.y, h.kill, h.kind === "hole" ? "hole" : "star",
             h.name || (h.kind === "hole" ? "A BLACK HOLE" : "A STAR"));
  }
  return best;
}

function surveyLightDrive(dt) {
  const me = ships[0];
  if (!surv.lightRun) { surv.lightHit = null; return; }
  if (!me.alive || surv.death) { surv.lightRun = 0; surv.lightHit = null; return; }

  surv.lightRun = Math.min(LIGHT_SPOOL, surv.lightRun + dt);
  const wind = surv.lightRun / LIGHT_SPOOL;

  /* Pushed along the heading rather than by the engine, so the speed cap the
     rest of the game applies is not in the way — and the heading is the ship's
     nose, so the small amount of steering that is left still points it. */
  const top = MAX_SPEED * (me.speedMul || 1) * U;
  const want = top * (1 + (LIGHT_MULT - 1) * wind);
  me.vx = Math.cos(me.a) * want;
  me.vy = Math.sin(me.a) * want;

  /* Checked against the speed the drive is *going* to be doing, not the speed
     it is doing now. While it is still winding up the closing rate rises, so an
     eta worked out from the current speed was optimistic — measured, a warning
     that said 5.9 seconds arrived 2.4 seconds before impact, which is the one
     way a five-second warning can be worse than none. */
  surv.lightHit = lightObstacle(me, top * LIGHT_MULT);
  if (surv.lightHit && surv.lightHit.eta <= 0) {
    // Arrived. The obstacle does the rest: a world is solid and a well kills.
    surv.lightRun = 0;
    addShake(10);
    chatter("Light drive cut — " + surv.lightHit.name, "#ff8f77");
    surv.lightHit = null;
    return;
  }
}

/* Called every frame the world is running. The tanks are the only thing in
   Survey that gets worse while you do nothing, which is what makes sitting
   still a choice rather than a rest. */
/* ── the low-tank warning ─────────────────────────────────────────────────
   A tank quietly dropping is a tank you do not notice until it is a countdown.
   So it says so — loudly the first couple of times, and then quietly, because a
   warning that shouts every time is a warning you learn to ignore.

   `WARN_LOUD` is how many times a resource gets the full treatment: the word
   WARNING beside the readout for ten seconds, and then the word goes and the
   triangle slides in next to the number and stays while the tank is low. After
   those two, the triangle simply appears at each step with no shouting.

   The steps: half a tank, and then every fifteen per cent below it. The count
   is kept in the book, so "the first two times" means the first two times, not
   the first two this session. */
const WARN_LOUD = 2;
const WARN_FIRST = 0.5;
const WARN_STEP = 0.15;
const WARN_SHOUT = 10;        // seconds the word stays up

// Which step a fraction has fallen past: 0 above half, 1 at half, 2 at 35%...
const warnStep = frac => {
  if (frac > WARN_FIRST) return 0;
  return 1 + Math.floor((WARN_FIRST - frac) / WARN_STEP + 1e-9);
};

function lifeWarnings(dt) {
  for (const key of ["water", "food"]) {
    const full = key === "water" ? WATER_FULL : foodCap();
    const a = surv.alert[key];
    const frac = Math.max(0, Math.min(1, surv[key] / Math.max(1, full)));
    const step = warnStep(frac);

    a.shout = Math.max(0, (a.shout || 0) - dt);

    /* Refilled past the trigger: forget where it got to, so the next trip out
       warns again. The taught count is not forgotten — that is the whole point
       of it. */
    if (step === 0) { a.step = 0; a.lit = false; continue; }
    if (step <= (a.step || 0)) continue;

    a.step = step;
    a.lit = true;
    /* Loud only at the half-tank mark, and only while it is still teaching you
       what the triangle means. The two lessons are the first two times a tank
       falls past half — on two separate trips out — rather than the first two
       warnings of any kind, or the second lesson would be spent on the 35% step
       of the same trip and you would never see it happen twice. */
    if (step === 1 && (a.taught || 0) < WARN_LOUD) {
      a.taught = (a.taught || 0) + 1;
      a.shout = WARN_SHOUT;
      chatter((key === "water" ? "Water" : "Food") + " is down to half.",
              key === "water" ? ICE_C : "#ffcb42");
      gameSound("hit");
      saveSurveyBook();
    }
  }
}

function surveyLifeSupport(dt) {
  const me = ships[0];
  if (!me.alive || surv.death) return;

  // A cold larder does not give you more; it makes what you have go further.
  const drain = dt * (1 + mods().life);
  surv.water = Math.max(0, surv.water - drain);
  surv.food  = Math.max(0, surv.food  - drain);

  /* Empty starts a clock. Getting anything at all back into the tank stops it
     — it does not have to be a full tank, which matters because skimming an
     atmosphere trickles, and a trickle has to be able to save you. */
  if (surv.water > 0) surv.thirst = 0;
  else {
    if (surv.thirst === 0) {
      chatter("Water out. You have minutes, not hours.", "#87d8ff");
      gameSound("lose");
    }
    surv.thirst += dt;
    if (surv.thirst >= THIRST_GRACE) { surveyDie("thirst"); return; }
  }

  if (surv.food > 0) surv.hunger = 0;
  else {
    if (surv.hunger === 0) {
      chatter("Food out. Find somewhere with people on it.", "#ffcb42");
      gameSound("lose");
    }
    surv.hunger += dt;
    if (surv.hunger >= HUNGER_GRACE) { surveyDie("hunger"); return; }
  }

  surv.skimming = Math.max(0, surv.skimming - dt);
  surv.melting = Math.max(0, (surv.melting || 0) - dt);
  lifeWarnings(dt);
}

/* The objective, as news. It used to be three lines painted across the top of
   the screen every frame forever, which is a lot of furniture for a sentence
   that changes about twice an hour — and the clue is the interesting half, so
   burying it in permanent chrome was the worst place to put it.

   Fired on change only, and never on the first frame of a resumed sector: being
   told what you are looking for is useful when it becomes true, and a
   notification you did not cause is one you learn to ignore. */
function surveyObjectiveNote() {
  const o = objective();
  if (!o) return;
  const key = o.text + "|" + (o.sub || "");
  if (surv.lastObjective === key) return;
  const first = surv.lastObjective == null;
  surv.lastObjective = key;
  if (first || !surveyHUD) return;
  surveyHUD.notify(o.text, o.sub || "", o.colour || NEBULA, 8);
}

/* Buying supplies. Priced on what is missing rather than a flat fee for a
   full tank, so topping off before a long trip is not a rip-off and limping
   in on empty is not free. */
/* You can buy a *bit*. Filling to the brim was the only option, which made
   stopping for supplies an all-or-nothing decision priced against a tank you
   might not want to fill — five minutes of water to reach the next station is a
   perfectly sensible purchase and there was no way to make it.

   `frac` is how much of a full tank to take, so a market row can offer a
   quarter, a half and the lot at three honest prices. */
const supplyUnit = kind => kind === "water" ? WATER_PRICE : FOOD_PRICE;

function buySupply(kind, frac) {
  const full  = kind === "water" ? WATER_FULL : foodCap();
  const price = supplyUnit(kind);
  const have  = surv[kind];
  if (!surv.docked && !surv.landed) { gameSound("hit"); return false; }
  if (have >= full) { gameSound("hit"); return false; }

  // Never more than the tank has room for, nor more than they have.
  const shelf = surv.docked ? shelfOf(surv.docked) : null;
  const onHand = shelf ? shelf[kind] : Infinity;
  if (onHand <= 0) {
    chatter("They have no " + kind + " to sell.", "#ff8f77");
    gameSound("hit");
    return false;
  }
  const room = (full - have) / full;
  const take = Math.max(0, Math.min(room, onHand,
                                    frac === undefined ? room : frac));
  if (take <= 0) { gameSound("hit"); return false; }

  const cost = Math.max(1, Math.ceil(take * price));
  if (surv.cash < cost) { gameSound("hit"); return false; }
  surv.cash -= cost;
  if (shelf) shelf[kind] = Math.max(0, shelf[kind] - take);
  surv[kind] = Math.min(full, have + take * full);
  gameSound("start");
  chatter((kind === "water" ? "Water" : "Food") + " aboard \u2014 " +
          Math.round(take * 100) + "% of the tank for " + money(cost),
          kind === "water" ? "#87d8ff" : "#ffcb42");
  saveSurveyBook();
  return true;
}

/* What a given slice would cost, so the button can say the number. `null` when
   the tank has no room for that much — a market that offers you something it
   cannot sell you is a market you stop trusting. */
function supplySlice(kind, frac) {
  const full = kind === "water" ? WATER_FULL : foodCap();
  const room = (full - surv[kind]) / full;
  if (room <= 0.001) return null;
  const take = Math.min(room, frac);
  if (take <= 0.001) return null;
  return Math.max(1, Math.ceil(take * supplyUnit(kind)));
}

/* ── repairs ──────────────────────────────────────────────────────────────
   Phase 5.7. Hull used to come back from exactly two things: sitting in a
   star's light, and dying. Both of those are fine and neither is a station —
   and repairing is on the short list of what a station is *for*, next to
   storage, buying and selling.

   Priced per point missing rather than as a flat fee, the same rule the water
   and the food follow, so the button can say the number: a shop that makes you
   press it to find out the price is a shop you do not use when you are one hit
   from dead. Dearer in the deep for the same reason everything else is — a yard
   a long way from anywhere knows what it has.

   It is not cheap. A hull is the thing standing between you and losing the
   hold, so mending one should be felt; sitting in a star is still the free
   answer and still costs you the time. */
/* Per point of hull, near home. 130 put a full skiff hull at 650, which is
   most of a hold of ordinary rock for the thing you do after every bad
   trip; 50 puts it at 250. Still felt, still dearer in the deep, and still
   beaten by sitting in a star for free if you have the time. */
const REPAIR_PRICE = 50;       // per point of hull, near home

const repairCost = () => {
  const me = ships[0];
  if (!me || !surv) return null;
  const gap = Math.max(0, (me.maxHull || 0) - (me.hull || 0));
  if (gap <= 0) return null;                        // nothing to sell you
  const deep = 1 + depthAt(me.x, me.y) * 0.8;
  return Math.max(1, Math.round(gap * REPAIR_PRICE * deep));
};

function buyRepair() {
  if (!surv || !surv.docked) { gameSound("hit"); return false; }
  const cost = repairCost();
  if (cost == null) { gameSound("hit"); return false; }
  if (surv.cash < cost) { gameSound("hit"); return false; }
  const me = ships[0];
  surv.cash -= cost;
  me.hull = me.maxHull;
  surv.t.repaired = true;
  gameSound("win");
  chatter("Hull made good \u2014 " + money(cost), CASH);
  saveSurveyBook();
  return true;
}

const supplyCost = kind => {
  const full  = kind === "water" ? WATER_FULL : foodCap();
  const price = kind === "water" ? WATER_PRICE : FOOD_PRICE;
  if (surv[kind] >= full) return null;              // nothing to sell you
  return Math.max(1, Math.ceil((1 - surv[kind] / full) * price));
};

/* ── dying ────────────────────────────────────────────────────────────────
   Survey's original promise was that nothing ends your run. This reverses it
   on purpose: a survival game where the worst case is a wasted trip is not a
   survival game, it is a commute with scenery.

   What a death costs, and what it deliberately does not:

     lost    the hold, outright. Not spilled where you fell — motes live
             ninety seconds and you respawn at the origin, so "go and get it
             back" would be a mechanic that reads as one and is not.
     kept    the almanac, the station's fitted parts, the parts you were carrying,
             the chart, your pins, the refit, and the cash. All of those are
             things you *learned* or *built*, and taking them would make dying
             a punishment for playing rather than a reason to be careful.

   The cash staying is the same rule as before: money already banked is not
   aboard the ship. What is aboard the ship is what you lose. */
const DEATH_CAUSE = {
  rock:   "flew into an asteroid",
  shot:   "shot down by a sentry",
  ff:     "shot down",
  hole:   "swallowed by a black hole",
  star:   "burned up in a star",
  thirst: "died of thirst",
  hunger: "starved",
  mine:   "flew back over your own mine"
};

function surveyDie(cause) {
  if (LEV_ONLY) {
    const ship = ships[0];
    if (ship) {
      ship.alive = true;
      ship.dead = false;
      ship.hull = ship.maxHull;
    }
    if (surv) surv.death = null;
    return;
  }
  if (!surv || surv.death) return;            // one death at a time
  const ship = ships[0];
  let lost = 0;
  for (const m of MATERIALS) {
    lost += surv.hold[m.key] || 0;
  }
  surv.death = {
    cause: cause || "rock",
    reason: DEATH_CAUSE[cause] || "lost with all hands",
    dist: Math.round(Math.hypot(ship.x, ship.y)),
    band: placeAt(ship.x, ship.y).text,
    lasted: Math.max(0, clock - surv.runStart),
    lost,
    hold: MATERIALS.map(m => ({ key: m.key, name: m.name, colour: m.colour,
                                n: surv.hold[m.key] || 0 })),
    worth: MATERIALS.reduce((t, m) => t + (surv.hold[m.key] || 0) * m.value, 0),
    cash: Math.floor(surv.cash),
    charted: surveyHUD ? surveyHUD.charted() : 0,
    found: surv.found.size
  };
  surv.deaths = (surv.deaths || 0) + 1;
  surv.lightRun = 0;
  surv.lightHit = null;
  for (const m of MATERIALS) surv.hold[m.key] = 0;

  /* ── what a part does when you die ──────────────────────────────────────
     It used to come home with you. The reasoning was that a part lost in deep
     space is a run you cannot finish, and that was the wrong conclusion from
     the right worry: the answer is not to make a part indestructible, it is to
     make sure you can always go back for it.

     So it stays exactly where you died. It does not drift, it does not expire,
     it goes on the chart by name, and the ship that comes back for it is a trip
     you have to make — which is the only thing in the mode that makes carrying
     one feel like carrying something.

     Everything else about dying is unchanged: the hold is gone, the almanac and
     the fitted parts and the cash are kept. */
  const left = [...surv.carrying];
  if (left.length) {
    surv.carrying.clear();
    left.forEach((key, i) => {
      const spec = partSpec(key);
      /* Spread a little, so two parts are two things to fly to rather than one
         glyph on top of another — and nudged clear of whatever killed you, or
         the trip back would end the same way. */
      const a = (i / Math.max(1, left.length)) * Math.PI * 2;
      const spot = safeDrop(ship.x + Math.cos(a) * 120 * i,
                            ship.y + Math.sin(a) * 120 * i);
      surv.dropped.push({ key, name: spec.name, x: spot.x, y: spot.y });
      noteKnown("part", spot.x, spot.y, spec.name);
    });
    surv.death.dropped = left.map(k => partSpec(k).name);
  }

  /* ── and the spares, now that they are in the hold ─────────────────────
     The hold is lost when you die. Parts are in the hold now, so they are lost
     with it — except that a part has never simply vanished in this mode, and
     it should not start: the rule from the manifest is that it *stays where
     you died*, on the chart, by name, and the trip back for it is a trip you
     have to make.

     So the same thing happens to a spare rail lance as happens to the jump
     coil. The materials are gone; the parts are somewhere, and that somewhere
     is the worst place in the sector, because it is the place that killed you.

     Fitted parts are untouched. They are bolted to a ship that is being handed
     back to you, not cargo. */
  const spares = [];
  for (const key of Object.keys(surv.store || {})) {
    for (let n = storeCount(key); n > 0; n--) spares.push(key);
  }
  if (spares.length) {
    surv.store = {};
    spares.forEach((key, i) => {
      const m = moduleSpec(key);
      const a = (i / spares.length) * Math.PI * 2 + 0.4;
      const spot = safeDrop(ship.x + Math.cos(a) * (140 + 90 * i),
                            ship.y + Math.sin(a) * (140 + 90 * i));
      surv.dropped.push({ key, name: m.name, x: spot.x, y: spot.y,
                          mod: true, id: dropId() });
      noteKnown("part", spot.x, spot.y, m.name);
    });
    surv.death.spares = spares.map(k => moduleSpec(k).name);
  }
  burst(ship.x, ship.y, "#ff8f77", 40, 420 * U);
  addShake(12);
  gameSound("lose", ship.x, ship.y);
  ship.vx = ship.vy = 0;
  ship.alive = false;
  state = "died";
  saveSurveyBook();
}

/* Somewhere a part can sit and be fetched. Whatever killed you is still there,
   so the spot walks outward until it is clear of every well and every world —
   a part inside a star is a part nobody is ever getting back. */
function safeDrop(x, y) {
  for (let step = 0; step < 40; step++) {
    const d = step * 260;
    const a = step * 2.399;                    // a spiral rather than a line
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    let clear = true;
    for (const h of hazards) {
      if (dist2(px, py, h.x, h.y) < (h.kill * 2.2 + 400) ** 2) { clear = false; break; }
    }
    if (clear) {
      for (const pl of surv.planets) {
        if (dist2(px, py, pl.x, pl.y) < (pl.r + 300) ** 2) { clear = false; break; }
      }
    }
    /* And not in a wall. Dying inside the Leviathan is a normal way to die —
       it is full of sentries and it is the last thing the manifest asks of you
       — and the part you were carrying must not be left in a bulkhead where it
       is on the chart, drawn, named, and unreachable forever. The spiral walks
       out of the hull on its own; it just has to be told the hull is there. */
    if (clear && inBuilt(px, py, 200)) clear = false;
    if (clear) return { x: Math.round(px), y: Math.round(py) };
  }
  return { x: Math.round(x), y: Math.round(y) };
}

/* Back at the home station, which is the one place in an endless sector that
   is always where you left it. Everything the run *earned* comes with you. */
function surveyRespawn() {
  if (!surv) return;
  const ship = ships[0];
  surv.death = null;
  ship.x = HOME_STATION.x + 260;
  ship.y = HOME_STATION.y + 180;
  ship.vx = ship.vy = 0;
  ship.a = -Math.PI / 2;
  ship.alive = true;
  ship.hull = ship.maxHull;
  ship.invuln = INVULN;
  /* Resupplied. The station you come back to is the one place that would
     obviously do it, and sending you straight back out on the empty tanks that
     just killed you would be a loop rather than a setback. */
  surv.water = WATER_FULL;
  surv.food = foodCap();
  surv.thirst = 0;
  surv.hunger = 0;
  surv.runStart = clock;
  surv.docked = null;
  surv.warpCool = 1.2;
  surv.t.inWell = null;
  cam.x = ship.x; cam.y = ship.y;
  streamChunks(true);
  streamRocks();
  state = "playing";
  chatter("Back at the station. The hold went down with the last one.", CASH);
  saveSurveyBook();
}
