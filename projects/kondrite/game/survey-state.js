"use strict";

/* KONDRITE — SURVEY — WHAT THE INTERFACE IS HANDED
   ─────────────────────────────────────────────────────────────────────────────
   surveyState(): everything survey-hud/ reads, gathered once a frame. A new
   thing on a Survey page is a field here and a line in its survey-hud/ file.
   Then what the front page says about your sector, and where a ship is
   allowed to appear.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* Everything the interface module needs, gathered once. Both pages and the
   panel read the same object, so what the chart shows and what the panel
   shows can never disagree. */
function surveyState() {
  return {
    ship: ships[0], cam, clock, seed: surv.seed,
    hazards, planets: surv.planets, landmarks: surv.landmarks,
    contacts: surv.contacts,
    found: surv.found.size, total: SURVEY_TOTAL,
    inStar: surv.inStar, scan: surv.scan,
    /* How much this piece of sky is interfering, 0 to 1. The panel draws it as
       static: the *interface* is the instrument, so the instrument is what
       should look broken. Nothing else in the game asks for this and it is not
       a state — it is a fact about where you are, recomputed every frame. */
    grain: ships[0]
      ? Math.max(0, Math.min(1, (1 - regionScan(ships[0].x, ships[0].y)) / 0.9))
      : 0,
    /* Whether the scan has ever been pressed, so the panel can say how — and
       stop saying it the moment you do. A control nobody has been told about is
       a control that does not exist. */
    scanTaught: !!surv.t.scanned,
    /* A feature picked off the chart. One at a time, and it keeps its arrow
       until you pick another. */
    selected: surv.selected,
    // Counts down after a selection, for the flash on the chart.
    selectFlash: surv.selectFlash || 0,

    /* The two tracks, flattened for the interface. `refit` carries the tier
       and the next price so the station screen never has to do arithmetic,
       and every part carries how you would get one, so the parts page can show
       something you cannot build yet as a thing to work towards. */
    /* `cash`, not `salvage`. The rename went through the store and through
       the interface and then stopped here, on the one line that joins them —
       so the panel, the station and the inventory all read a field that was
       not there, fell back to zero, and the mode's whole economy showed as
       empty while the hold behind it filled up and stopped taking motes. */
    cash: Math.floor(surv.cash), hold: holdCap(), carried: holdUsed(),
    /* The hold, itemised, with what the station you are standing in would
       pay for each — the price is the whole reason there is more than one
       station, so it travels with the goods rather than living in the shop. */
    /* The camera, which the panel needs and has never been given. Every arrow
       that points off the edge of the screen converts a world position into a
       screen one, and to do that it needs the camera's rotation and scale —
       with neither, the module fell back to `rot: 0, scale: 1`.

       So in the rotating view every one of them pointed at the wrong sky, and
       in *both* views the "is it already on screen" test was computed at 1:1
       when Survey actually draws at about 0.72. Switching the camera from fixed
       to rotating appeared to break every arrow because it did. */
    cam: { x: cam.x, y: cam.y, rot: cam.rot, scale: cam.scale },
    materials: MATERIALS.map(m => ({
      key: m.key, name: m.name, colour: m.colour, note: m.note,
      // How you get one, for the bubble the materials panel opens.
      where: m.where || "",
      value: m.value, n: surv.hold[m.key] || 0,
      /* How short this station is of it, 0 to 1. A shortage is a price and a
         price is a reason to fly somewhere, so the number that moved the price
         travels with it — the shop can say WANTED rather than leaving you to
         notice that iron is dearer here than it was yesterday. */
      shortage: surv.docked ? shortageOf(surv.docked, m.key) : 0,
      price: surv.docked ? stationPrices(surv.docked)[m.key] : null,
      // Whether anybody here will take it. See `placeBuys`.
      buys: placeBuys(surv.docked || surv.landed).has(m.key)
    })),
    worth: (() => {
      const at = surv.docked || surv.landed;
      if (!at) return 0;
      // Only what this place takes — see `placeBuys`. A total that counted
      // cargo the shop will not touch is a number that cannot come true.
      const takes = placeBuys(at);
      const pr = surv.docked ? stationPrices(surv.docked) : null;
      return MATERIALS.reduce((t, m) => takes.has(m.key)
        ? t + (surv.hold[m.key] || 0) * (pr ? pr[m.key] : m.value) : t, 0);
    })(),
    onSell: sellHold,
    onSellOne: sellSome,
    onSellPart: sellPart,
    onSellSupply: sellSupply,
    /* How the sector feels about you, as a word. This is the *only* place it is
       ever stated, it is never a figure, and it lives on a page you open rather
       than on the flight HUD — a meter in the corner would turn a reputation
       into a score to manage. */
    /* Where you stand with each power, as words, and who is fighting whom.
       The only place any of this is ever stated, and never as a figure. */
    /* Who is out there and what each of them makes of you, in the one shape
       the interface needs: a colour so it matches the ships, a line saying who
       they are, a word for how they feel, and who they are fighting. Never a
       number — see `REP`. */
    standings: FACTIONS.map(f => ({
      key: f.key, name: f.name, short: f.short, colour: f.colour,
      note: f.note, long: f.long, standing: standingOf(f.key).name,
      says: standingOf(f.key).note,
      enemy: warPairs()[f.key] ? factionOf(warPairs()[f.key]).short : "",
      atWar: !!warPairs()[f.key]
    })),
    /* The two flags that are not powers. They are on the same board because
       "who is that red one" is the same question, and the answer is not a
       reputation — it is who they are. */
    others: [UNALIGNED, PIRATE].map(f => ({
      key: f.key, short: f.short, name: f.name, colour: f.colour,
      note: f.note, long: f.long
    })),
    war: (() => {
      const w = warPairs();
      const pair = Object.keys(w);
      if (!pair.length) return null;
      return { a: factionOf(pair[0]).short, b: factionOf(w[pair[0]]).short,
               scale: warScale().name, note: warScale().note };
    })(),
    // Who is out there, and whether any of them has decided about you.
    traffic: surv.traffic.map(t => ({ kind: t.kind, hull: t.hull,
                                      x: t.x, y: t.y, angry: !!t.angry })),
    /* Life support. Seconds rather than fractions, and the fraction alongside,
       because the bar wants one and the readout wants the other. */
    water: { left: surv.water, full: WATER_FULL,
             frac: surv.water / WATER_FULL,
             countdown: surv.water <= 0 ? Math.max(0, THIRST_GRACE - surv.thirst) : 0,
             cost: supplyCost("water"),
             /* What a full tank fetches back, exact — the shop rounds it for
                display but quotes from this, so the number on the button is
                the number you get. See `sellSupply`. */
             sellFull: supplyUnit("water") / 2,
             /* The low-tank mark. `lit` is whether the triangle is showing at
                all, `shout` is how much of its ten seconds of WARNING is left,
                0 to 1, which the panel uses to slide the mark from beside the
                word to beside the number. */
             warn: { lit: surv.alert.water.lit,
                     shout: Math.max(0, surv.alert.water.shout / 10),
                     step: surv.alert.water.step } },
    food:  { left: surv.food, full: foodCap(),
             frac: surv.food / Math.max(1, foodCap()),
             countdown: surv.food <= 0 ? Math.max(0, HUNGER_GRACE - surv.hunger) : 0,
             cost: supplyCost("food"),
             sellFull: supplyUnit("food") / 2,
             warn: { lit: surv.alert.food.lit,
                     shout: Math.max(0, surv.alert.food.shout / 10),
                     step: surv.alert.food.step } },
    /* The hull, on the same panel as the water and the food, because it is the
       same question: what does this station have to sell me before I go back
       out. `cost` is null when there is nothing to mend. */
    repair: { hull: ships[0] ? ships[0].hull : 0,
              max: ships[0] ? ships[0].maxHull : 0,
              frac: ships[0] && ships[0].maxHull
                ? ships[0].hull / ships[0].maxHull : 1,
              cost: repairCost() },
    onRepair: buyRepair,
    skimming: surv.skimming > 0,
    melting: surv.melting > 0,
    onBuySupply: buySupply,
    /* The shop's own shelves, priced and ready to draw. Everything this station
       will sell you in one list, because that is what a market is — the player
       should be reading a list of things and prices, not hunting four panels
       for the four different ways this place takes money. */
    market: (surv.docked || surv.landed) ? (() => {
      const rows = [];
      /* The shipyard used to be the first row here, on the grounds that it is
         a thing the station offers. It is a *room* the station has, though,
         and it is a tab along the top now — beside the shop itself, where the
         other rooms of a station live. A shelf lists things you can put in
         the hold. */
      /* One row a tank, not three. It used to be a QUARTER, a HALF and a
         FILL — three rows each, priced pro rata, with any slice bigger than
         the room in the tank left out so the shop did not offer the same 20%
         three times at three prices. All of that was a quantity control made
         out of buttons, and there is a quantity control now: the row says
         what a whole tank costs and you dial in how much of one you want. */
      for (const [kind, name, colour] of [["water", "WATER", ICE_C],
                                          ["food", "FOOD", "#ffcb42"]]) {
        const full = kind === "water" ? WATER_FULL : foodCap();
        /* Rounded up, not down. The row asks in whole percent and the tank
           does not hold a whole number of them, so a tank 99.93% empty
           offered 99 — and "fill it" left you 146 seconds short, every time,
           for ever. `buySupply` clamps what it pours to the room that is
           actually there, so asking for the extra percent can only ever
           round the last sliver in; it cannot overfill or overcharge. */
        const room = Math.ceil((full - surv[kind]) / full * 100);
        if (room <= 0) continue;
        /* What they have, in tankfuls, capped to the room in yours. A world
           has no shelf and no limit — it is a planet with weather on it. */
        const shelf = surv.docked ? shelfOf(surv.docked) : null;
        const onHand = shelf ? Math.floor(shelf[kind] * 100) : room;
        if (onHand <= 0) continue;
        rows.push({ kind: "supply", key: kind, name, colour, label: "FILL",
                    // Priced by the tankful; the row works out the slice.
                    tank: supplyUnit(kind), most: Math.min(room, onHand),
                    left: shelf ? Math.floor(shelf[kind] * 100) : null,
                    have: Math.round(surv[kind] / full * 100) });
      }
      /* What this particular rock is made of, sold by the people standing on
         it. A world's whole shelf, and the reason to land on one. */
      if (surv.landed && surv.landed.trades && surv.landed.stock > 0) {
        const m = matSpec(surv.landed.trades);
        const each = Math.max(1, Math.round(m.value * 1.5 *
                      (1 + depthAt(surv.landed.x, surv.landed.y))));
        const stock = Math.max(0, Math.round(surv.landed.stock || 0));
        rows.push({ kind: "local", key: m.key, name: m.name, colour: m.colour,
                    label: "BUY", cost: each, each: each,
                    most: stock, left: stock });
      }
      // The rest of the shelf is a station's: a world has no yard, no dry
      // dock and no shelf of parts.
      if (!surv.docked) return rows;
      /* The dry dock, which is the drive spar's room. Away from home every
         station mends a hull the way it always did; at home it is the first
         thing you get back, because your hull is the first thing that
         breaks. */
      const fix = surv.docked.home && !stationHas("dock") ? null : repairCost();
      if (fix != null) {
        rows.push({ kind: "repair", key: "hull", name: "HULL REPAIR",
                    colour: "#ff8f77", label: "MEND", cost: fix,
                    have: Math.round(ships[0].hull) + " / " +
                          Math.round(ships[0].maxHull) });
      }
      /* Only the ones somebody sells. A part you can only find is not on
         anybody's shelf — that is what "only find" means — and listing it here
         greyed out would be a shop advertising something it will not sell you. */
      /* And the counter, which is the fusion core's. Nothing here is
         powered without it — so a dead home station sells water and food off
         a shelf and has no counter to sell a part over. Everywhere else is
         somebody else's station, working. */
      const shelf = surv.docked.home && !stationHas("counter")
                  ? null : shelfOf(surv.docked);
      for (const m of MODULES) {
        if (!shelf) break;
        if (!sellsIt(m)) continue;
        if (m.deep > stationDepth()) continue;
        // Only what is actually on the shelf this delivery. See `rollShelf`.
        const left = (shelf && shelf.parts[m.key]) || 0;
        if (left <= 0) continue;
        rows.push({ kind: "part", key: m.key, name: m.name,
                    colour: "#a08cff", label: "BUY", cost: m.cost,
                    most: left, left: left,
                    cat: m.cat, rarity: m.rarity, note: m.note,
                    weight: partWeight(m.key),
                    owned: storeCount(m.key) });
      }
      return rows;
    })() : [],
    /* `qty` means whatever the row's quantity control meant: a percentage of
       a tank, a count of parts, a count of units off a world. A door and a
       hull repair have no quantity and ignore it. */
    onBuyRow: (kind, key, qty) => {
      if (kind === "supply") return buySupply(key, (qty || 0) / 100);
      if (kind === "local") return buyLocal(qty || 1);
      if (kind === "repair") return buyRepair();
      if (kind === "part") {
        // One at a time, because that is the call that checks the hold and
        // the purse; the loop simply stops when one of them says no.
        let got = false;
        for (let i = 0; i < (qty || 1); i++) {
          if (!buyModule(key)) break;
          got = true;
        }
        return got;
      }
      if (kind === "ships") {
        if (!hangarOpen()) return false;
        state = "hangar";
        surveyHUD && surveyHUD.hangarOpened && surveyHUD.hangarOpened(surveyState());
        return true;
      }
      return false;
    },
    /* The world under you, if it is one you can do anything with. Two separate
       facts: somebody lives here, and there is air here. A world can be either
       or both, and the two of them are the difference between buying water and
       working for it. */
    landed: surv.landed && {
      name: surv.landed.name, kind: surv.landed.kind, r: surv.landed.r,
      colour: worldKind(surv.landed.kind).disc,
      air: !!surv.landed.air,
      /* What they dig here, what is left of it, and what they want for it.
         Cheaper than a station sells the same thing for, because you came to
         them — and finite, because a world is a place rather than a tap. */
      trades: surv.landed.trades ? (() => {
        const m = matSpec(surv.landed.trades);
        return { key: m.key, name: m.name, colour: m.colour, note: m.note,
                 left: Math.max(0, Math.round(surv.landed.stock || 0)),
                 price: Math.max(1, Math.round(m.value * 1.5 *
                                 (1 + depthAt(surv.landed.x, surv.landed.y)))) };
      })() : null,
      dist: Math.round(Math.hypot(surv.landed.x, surv.landed.y)),
      band: placeAt(surv.landed.x, surv.landed.y).space.name
    },
    overAir: surv.overAir && { name: surv.overAir.name },
    /* A ship that has run out, near enough to do something about. The panel
       needs to say who it is, what it would cost, and whether you can afford
       it — a prompt you cannot act on has to look like one. */
    helping: surv.helping && {
      flag: factionOf(surv.helping.faction).short,
      colour: factionOf(surv.helping.faction).colour,
      left: Math.max(0, Math.round(surv.helping.doom)),
      cost: GIVE_WATER, can: canGiveWater()
    },
    onWater: () => { giveWater(); },
    /* Who out here knows you by name, which is 6.5 made readable. Two short
       lists and never a number: a ship you helped, and a ship that got away.
       If you can say which ship it was, it happened.

       Not called `known` — that name was already taken by the gazetteer, the
       chart's list of everything you have charted, forty lines further down this
       same object. A duplicate key in an object literal is not an error in
       JavaScript; the second one simply wins, silently, and the chart or this
       board goes blank depending which way round they were written. */
    whoKnows: {
      friends: (surv.friends || []).map(f => ({
        name: f.name, faction: factionOf(f.faction).short,
        why: f.why, repaid: !!f.repaid
      })),
      grudges: (surv.grudges || []).map(g => ({ name: g.name, hp: g.hp }))
    },
    /* The named thing in reach, and the card for the one you asked about.
       `near` is what the panel offers; `lore` is what the page draws, and they
       are two fields rather than one so the card holds still while you read it. */
    near: surv.near || null,
    lore: surv.lore || null,
    onLook: () => { if (surv.near) { surv.lore = surv.near; state = "lore"; } },
    onLand: () => {
      if (!surv.landed) return;
      state = "landed";
      surveyHUD && surveyHUD.shopOpened && surveyHUD.shopOpened();
    },
    /* Buying off a world. Ten at a time, or whatever is left of the hold or of
       their stock — three taps to fill a hold beats thirty, and a world that
       runs out is a world you have to find another of. */
    onBuyLocal: buyLocal,
    // Dying, and coming back from it.
    death: surv.death,
    deaths: surv.deaths || 0,
    critical: !!(ships[0] && ships[0].hull <= 0 && !surv.death),
    lasted: Math.max(0, clock - surv.runStart),
    onRespawn: surveyRespawn,
    docked: !!surv.docked,
    /* Where the station is, so the panel can make the station itself the door.
       At one hull point the prompt line is taken by "THE NEXT HIT KILLS YOU" —
       which is the right thing for it to say and left a phone with no way into
       the shop at exactly the moment it needed one most. */
    dockAt: surv.docked ? { x: surv.docked.x, y: surv.docked.y } : null,
    /* Standing in the place the parts go. It used to mean the yard, which was
       somewhere else; it means your own station now, and it is what the panel
       and the manifest page both read to know whether the list in front of
       you is a delivery address or a reminder. */
    atHomeDock: atHomeStation(),
    /* What the ship can actually do right now, read off the four slots. The
       panel and the pages both used to ask the almanac; there is nothing to ask
       any more, and one of these is the difference between salvage that comes
       to you and salvage you have to chase one piece at a time. */
    tractor: mods().tractor ? SURVEY_TRACTOR * (1 + mods().reach) : 0,
    solar: !!mods().solar,
    warpTuned: !!mods().warp,
    canRunDark: !!mods().quiet,
    /* Every part in the game, with how you get one and whether you have it.
       The parts page lists all of them — a catalogue with holes in it is a
       catalogue you cannot plan from — so it needs the whole table, not only
       the buildable end of it. */
    parts: MODULES.map(m => ({
      key: m.key, name: m.name, cat: m.cat, rarity: m.rarity, note: m.note,
      cost: m.cost, deep: m.deep, secs: fitSeconds(m.key),
      weight: partWeight(m.key),
      get: m.get.slice(), where: m.where || "",
      buyable: sellsIt(m), craftable: craftsIt(m), findable: findsIt(m),
      bossable: has(m, "boss"),
      // Whether you have met one. See `markSeen` — it is what puts a part you
      // cannot build onto the workbench page at all.
      seen: surv.seen.has(m.key),
      owned: storeCount(m.key),
      fitted: surv.slots.some(sl => sl && sl.key === m.key)
    })),
    /* The devices fitted, in slot order: what they are, which key or thumb
       button answers to them, and how much of the wait is left. The panel
       draws one chip each — see `drawDevices` — and the chip is the only place
       a cooldown is ever stated, because it is the only place it is ever
       acted on. */
    devices: devicesFitted().map(d => ({
      slot: d.slot, key: d.key, name: d.dev.name, tag: d.dev.tag,
      cd: d.cd, cool: d.dev.cool, ready: d.cd <= 0,
      hint: DEVICE_KEYS[d.slot] && DEVICE_KEYS[d.slot].length
        ? keyLabel(DEVICE_KEYS[d.slot][0]) : ""
    })),
    onDevice: i => useDevice(i),
    /* The four slots, what is in them, and how long until it works. Every
       ship has four; that never varies and the page should never suggest it
       might. */
    slots: surv.slots.map(sl => {
      if (!sl) return null;
      const m = moduleSpec(sl.key);
      return { key: sl.key, name: m.name, cat: m.cat, rarity: m.rarity,
               note: m.note, fit: sl.fit, of: fitSeconds(sl.key) };
    }),
    /* What you own and are not flying, one row a kind — and what it is
       costing you to carry, because that is the half of the page that used to
       be invisible. `weight` is per one of them; `held` is what this row is
       taking out of the hold in total. */
    store: MODULES.filter(m => storeCount(m.key) > 0).map(m => ({
      key: m.key, name: m.name, cat: m.cat, rarity: m.rarity, note: m.note,
      n: storeCount(m.key), secs: fitSeconds(m.key),
      weight: partWeight(m.key), held: partWeight(m.key) * storeCount(m.key),
      fitted: surv.slots.some(sl => sl && sl.key === m.key),
      // What this place would give for one. See `partResale`.
      sell: partResale(m, surv.docked || surv.landed)
    })),
    // What the parts in the hold weigh, all told. The materials are the rest.
    partWeight: storeWeight(),
    /* What this station has on the shelf. Rarity decides how far out you have
       to be before anybody stocks it, which is the danger curve paying out. */
    /* `sellsIt` as well as the depth, and the missing half of that condition
       put three find-only parts on the first shelf in the game — the tractor
       beam at 340, and the warp tuner and running dark at *nothing*, because a
       part nobody sells has no price to quote. Two of the three almanac verbs,
       free, on turn one. The shelf and `buyModule` both check now: a list that
       offers what the action refuses is the same bug written twice. */
    forSale: surv.docked
      ? MODULES.filter(m => sellsIt(m) && m.deep <= stationDepth()).map(m => ({
      key: m.key, name: m.name, cat: m.cat, rarity: m.rarity, note: m.note,
      cost: m.cost, secs: fitSeconds(m.key), owned: storeCount(m.key),
      weight: partWeight(m.key),
      fitted: surv.slots.some(sl => sl && sl.key === m.key)
    })) : [],
    /* What each part actually does, so the page can total up what you are
       flying with rather than keeping its own copy of the numbers. A second
       copy of a balance table is a second table to get wrong. */
    effects: (() => {
      const out = {};
      for (const m of MODULES) out[m.key] = m.eff;
      return out;
    })(),
    /* The build book, already answered. Every build with what it wants, what
       you have of it, whether the part it eats is aboard, and — the reverse
       lookup — what each material you are carrying is an ingredient for, which
       is what turns three reactor cores from a curiosity into a lead. */
    crafts: CRAFTS.map(r => {
      const m = moduleSpec(r.out);
      const rs = craftState(r.out);
      return { key: r.out, name: m.name, cat: m.cat, rarity: m.rarity,
               note: m.note, cost: m.cost, secs: fitSeconds(r.out),
               owned: storeCount(r.out),
               fitted: surv.slots.some(sl => sl && sl.key === r.out),
               rows: rs.rows, part: rs.part, ready: rs.ready };
    }),
    usedIn: MATERIALS.reduce((o, m) => { o[m.key] = usedIn(m.key); return o; }, {}),
    onCraft: key => craft(key),
    onFit: (i, key) => fitModule(i, key),
    onPull: i => pullModule(i),
    onBuyPart: key => buyModule(key),
    objective: objective(),
    fix: objectiveFix(),
    /* Flattened for the panel: the minimap draws these as dots for as long as
       they last, which is the half of a scan that used to be missing. Anything
       a scan reaches is up to 3,885 units away and the view is about 700
       across, so before this the returns from a scan were almost all off
       screen and the button's whole answer was a line of text. */
    echoes: surv.echoes.map(e => {
      // Named and coloured when the scan was made; see `surveyScan`.
      return { kind: e.kind, x: e.x, y: e.y, t: e.t, life: ECHO_LIFE,
               name: e.name, colour: e.colour, bad: !!e.bad,
               // Read by the arrows: a ship making trouble is DANGER.
               trouble: e.trouble || "" };
    }),
    scanReach: scanRange(),
    pins: surv.pins,
    world: surv.world,
    /* The gazetteer, plus every part lying on the floor — and the second half
       is why this is not just `surv.known`.

       A part you died carrying is written to the map by `noteKnown`, and that
       turns entries away once the gazetteer is full: `KNOWN_CAP` is 600, and a
       well-charted run reaches it. So the one marker in the mode you cannot
       afford to lose was the one being dropped, silently, and only on the runs
       that had gone well enough to fill the map — which is exactly what "it
       sometimes vanishes" looks like from the cockpit.

       `surv.dropped` is the authority and it cannot overflow: it is what the
       world spawns the part from, it survives the book, and it is a few dozen
       entries at the very most. Deduped against the gazetteer so a marker that
       *did* get written is not drawn twice. */
    known: (() => {
      const out = [...surv.known.values()];
      for (const d of surv.dropped) {
        if (surv.known.has(knownId("part", d.x, d.y))) continue;
        const spec = droppedSpec(d);
        out.push({ k: "part", x: d.x, y: d.y,
                   name: spec ? spec.name : (d.name || ""), r: 0 });
      }
      return out;
    })(),
    /* Where the parts go, for the chart to mark. It is the home station now,
       so this is the same point the chart already draws a station at — the
       mark says what the place still wants rather than where a second place
       is. */
    home: { x: HOME_STATION.x, y: HOME_STATION.y,
            built: surv.built.size, needs: BUILD.length },
    /* Where you are: whose sky, which biome, and how dangerous the two are
       together. The panel draws the first two in words and the third as a
       bar; see `drawSector`. */
    place: placeAt(ships[0] ? ships[0].x : 0, ships[0] ? ships[0].y : 0),
    /* What the chart knows about borders. BIOMES.md once kept biomes off
       the chart entirely, and Ric turned that round: a biome and a territory
       are named, and their borders are drawn *where you have mapped them*.
       `mapped` is the record ("cx,cy" → the biome and holder you saw), and
       the rest is what the chart needs to draw a cell: where its site is, and
       what each biome and each holder is called and coloured. */
    terrain: {
      mapped: surv.mapped,
      // Bumped whenever a recorded cell changes, so the chart knows to regroup.
      mappedStamp: surv.mappedStamp || 0,
      cell: REGION_CELL,
      site: (cx, cy) => WORLD.regionSite(cx, cy),
      biome: k => {
        const r = REGIONS.find(q => q.key === k);
        return r ? { name: r.name, colour: r.colour } : null;
      },
      holder: o => {
        const f = FACTIONS.find(q => q.key === o);
        if (f) return { name: f.short + " SPACE", colour: f.colour, power: true };
        const sp = WORLD.SPACES[o];
        return sp ? { name: sp.name, colour: sp.colour, power: false } : null;
      }
    },
    warn: surv.warn,
    // The powers, the province you are in, the record, and the docked news.
    living: livingState(),
    /* `snap` is a world-space radius the chart works out from its own zoom —
       the same finger-width on screen is a very different distance when the
       map is zoomed out, and the interface is the only thing that knows the
       scale. */
    /* Lifting one, which is a separate question from placing one now that
       placing has to be armed by a button. Returns whether it found one to
       lift, so the chart knows whether the tap was spent. */
    onPinNear: (x, y, snap) => {
      const near = surv.pins.findIndex(q =>
        dist2(q.x, q.y, x, y) < (snap || 400) ** 2);
      if (near < 0) return false;
      const pin = surv.pins[near];
      askYesNo("Remove " + (pin.name ? "“" + pin.name + "”" : "this pin") +
               "?", () => {
        const i = surv.pins.indexOf(pin);
        if (i < 0) return;
        surv.pins.splice(i, 1);
        gameSound("start");
        saveSurveyBook();
      });
      return true;
    },
    /* Tapping a charted thing with nothing armed: keep an eye on it. The
       arrow it gets is permanent — that is the whole difference between this
       and a scan return, which is a pulse and fades like one. Tapping the same
       one again lets it go. */
    onSelect: (x, y, snap) => {
      let best = null, bd = (snap || 400) ** 2;
      /* Your own pins first, then anything charted. A pin is a place you
         decided mattered — the *most* likely thing you meant when you tapped
         there — and it used to be the one kind of mark on the chart you could
         not point the ship at. */
      for (const q of surv.pins) {
        const d = dist2(q.x, q.y, x, y);
        if (d > bd) continue;
        bd = d; best = { x: q.x, y: q.y, k: "pin", name: q.name || "PIN" };
      }
      for (const q of surv.known.values()) {
        const d = dist2(q.x, q.y, x, y);
        if (d > bd) continue;
        bd = d; best = q;
      }
      if (!best) return false;
      const same = surv.selected &&
                   Math.abs(surv.selected.x - best.x) < 2 &&
                   Math.abs(surv.selected.y - best.y) < 2;
      surv.selected = same ? null
        : { x: best.x, y: best.y, k: best.k,
            name: best.name || String(best.k || "").toUpperCase() };
      // It flashes where you touched it, so the chart answers the tap.
      surv.selectFlash = same ? 0 : 1;
      gameSound("start");
      chatter(surv.selected
                ? "Watching " + surv.selected.name + "."
                : "Not watching anything now.", NEBULA);
      saveSurveyBook();
      return true;
    },
    onPin: (x, y, kind, snap) => {
      if (surv.pins.length >= 200) { gameSound("hit"); return; }
      /* Nothing is placed until the prompt is answered. It used to drop the pin
         first and ask afterwards, so cancelling left an unnamed dot behind —
         and "cancel" has to mean nothing happened.

         Endless space has no place names. The only way anywhere out here gets
         one is if you say so, and the colour travels *with* the pin rather than
         being looked up from its kind later: a palette edited one day would
         otherwise repaint every mark anybody had ever made, and a mark whose
         colour changes under you is a mark you stop trusting. */
      const kinds = surveyHUD && surveyHUD.pinKinds ? surveyHUD.pinKinds() : [];
      askPin(kinds, answer => {
        if (!answer) return;
        surv.pins.push({ x, y, kind: answer.kind,
                         name: String(answer.name || "").slice(0, 24),
                         colour: pinColour(answer.kind) });
        gameSound("start");
        saveSurveyBook();
      });
    },
    manifest: BUILD.map(b => ({ key: b.key, name: b.name, clue: b.clue,
                                where: b.where, opens: b.opens,
                                service: (serviceSpec(b.opens) || {}).name,
                                have: surv.built.has(b.key),
                                carrying: surv.carrying.has(b.key) })),
    /* ── THE MARKET ───────────────────────────────────────────────────────
       What the ranging lens is for: a lens is how a station sees past its own
       dock, and what it sees is what everywhere else is paying. One row a
       material you are carrying — the board answers *where do I take this*,
       so a row for something you have not got is a row about nothing — with
       what home pays, the best standing price on the chart, and how far that
       is.

       Only at home, and only once the lens is in. Every other station in the
       sector has its own counter and its own prices and no reason to tell you
       about anybody else's. */
    payBoard: stationHas("market") && surv.docked && surv.docked.home ? (() => {
      const mine = stationPrices(surv.docked);
      const best = bestPayers();
      const me = ships[0] || { x: 0, y: 0 };
      const out = [];
      for (const m of MATERIALS) {
        const n = surv.hold[m.key] || 0;
        if (n <= 0) continue;
        const b = best[m.key];
        out.push({ key: m.key, name: m.name, colour: m.colour, n,
                   here: mine[m.key] || m.value,
                   best: b ? b.pays : null,
                   range: b ? rangeBand(Math.hypot(b.x - me.x, b.y - me.y)) : "",
                   bearing: b ? bearingTo(me, b) : null });
      }
      return out;
    })() : null,
    /* Every room of your own station, lit or dark, and what a dark one is
       waiting for. The page decides nothing: it draws what is off, the part
       that turns it on and where that part is kept. A missing row teaches
       nothing; a dark one teaches everything. */
    services: SERVICES.map(s => {
      const p = s.part ? partSpec(s.part) : null;
      return { key: s.key, name: s.name, does: s.does,
               live: stationHas(s.key),
               part: p ? p.name : null,
               clue: p ? p.clue : null,
               where: p ? p.where : null,
               carrying: !!(p && surv.carrying.has(p.key)) };
    }),
    built: surv.built.size, needs: BUILD.length,
    /* ── the long list ────────────────────────────────────────────────────
       The parts a player cannot meet, which turned out to be most of the good
       ones. Three pages each correctly refused this job: the shop will not
       advertise what it does not stock, the workbench threw out everything it
       could not build, and the almanac is a record rather than a shop. All
       three were right and the result was that nothing picked it up — so the
       best part in every category was something you could only own by
       accident, and `surv.seen`, the set whose whole purpose is "a thing you
       know exists and can plan a trip towards", could never be told about
       them.

       The test is *can this part be met near home*: anything the workbench
       lists is met, and anything a home shelf stocks is met. What is left is
       eleven — the two nobody sells, and the nine whose `deep` puts them on a
       shelf hundreds of thousands of units out. That is not a shop. It is the
       same thing the manifest is: a list of things that are somewhere else.

       Only after the gate, because before it the manifest is the list and two
       lists is no list at all. */
    longList: stationWhole()
      ? MODULES.filter(m => !craftsIt(m) && (!sellsIt(m) || m.deep > 0))
          .map(m => ({
            key: m.key, name: m.name, cat: m.cat, rarity: m.rarity,
            note: m.note,
            /* Where it is, twice: the prose if somebody wrote one — the two
               nobody sells have one — and a tag short enough to sit in a
               column beside the name.

               The tag is derived rather than written down, because `deep` is
               already an address: it is how dangerous a station's sky has to
               be before it stocks one. That used to convert into a band and a
               range; danger is the biome and the owner now, so it converts
               into the kind of place instead. A part whose depth is retuned
               cannot end up wearing a line that lies about it, which is the
               failure mode every hand-kept table in this mode has shipped at
               least once. */
            where: m.where || "",
            at: m.deep > 0 ? dangerWords(m.deep * SHELF_REACH) : "FOUND, NEVER SOLD",
            have: storeCount(m.key) > 0 || modFitted(m.key),
            seen: surv.seen.has(m.key)
          }))
      : [],
    onUndock: () => { state = "playing"; },
    builds: STATION_BUILD,
    /* The mouth, which is the sixth part and not the whole six: every
       service on this station is lit by one delivery, and this is the one
       the ablative plate lights. */
    wormhole: stationHas("mouth"),
    onJump: (x, y) => lightJump(x, y),
    /* The light drive. `run` is how far it has wound up, 0 to 1, so the panel
       can show it spooling rather than snapping on. */
    light: {
      have: !!surv.hasLight,
      cost: LIGHT_DRIVE.cost,
      name: LIGHT_DRIVE.name, does: LIGHT_DRIVE.does, blurb: LIGHT_DRIVE.blurb,
      buildable: stationWhole() && !surv.hasLight,
      afford: surv.cash >= LIGHT_DRIVE.cost,
      run: surv.lightRun ? Math.min(1, surv.lightRun / LIGHT_SPOOL) : 0,
      hit: surv.lightHit && { eta: surv.lightHit.eta, name: surv.lightHit.name,
                              what: surv.lightHit.what },
      warnAt: LIGHT_WARN
    },
    onLight: toggleLightDrive,
    onBuildLight: buildLightDrive,
    /* The roster, as the hangar sees it. Every hull with its eight numbers and
       whether you own it, fly it, or could afford it — the page does no
       arithmetic of its own, so what it shows and what buying does cannot
       drift apart. */
    ships: SHIPS.map(sh => ({
      key: sh.key, name: sh.name, category: sh.category, best: sh.best,
      note: sh.note, cost: sh.cost,
      hull: sh.hull, dmg: sh.dmg, rate: sh.rate, cargo: sh.cargo,
      speed: sh.speed, accel: sh.accel, turn: sh.turn, drag: sh.drag,
      /* And the same three in the units the sector is measured in, worked
         out here because the page does no arithmetic of its own. Ric: the
         multipliers were "a random number x" — a Needle at 2.20x meant
         nothing next to a scan that reaches 2,100u and a well 3,000 wide. */
      topSpeed: Math.round(sh.speed * MAX_SPEED),
      push: Math.round(sh.accel * THRUST),
      turnRate: Math.round(sh.turn * TURN * 180 / Math.PI),
      // Always a number here, so the page never has to know the default.
      burst: sh.burst || BURST_SIZE,
      // What actually stops this hull, and how far its outline reaches.
      hitR: sh.hitR, noseX: sh.noseX, tailX: sh.tailX, tough: !!sh.tough,
      /* The axes that are not speed and not grip. A hull that winds up slowly
         or loses its turn at speed is doing something a stat bar cannot show,
         and something a harness could not check at all while these lived only
         on the ship. See `applyRefit`. */
      spool: sh.spool || 0,
      bite: sh.bite == null ? 1 : sh.bite,
      punch: sh.punch || 0,
      ram: !!sh.ram,
      weapon: sh.weapon || null,
      shot: sh.shot, size: sh.size,
      art: sh.art, fins: sh.fins || null, guns: sh.guns || null,
      ribs: sh.ribs || null, pods: sh.pods || null, windows: sh.windows || null,
      owned: surv.owned.has(sh.key),
      flying: surv.ship === sh.key,
      afford: surv.cash >= sh.cost
    })).sort((a, b) => SHIP_CATEGORIES.indexOf(a.category) -
                       SHIP_CATEGORIES.indexOf(b.category) ||
                       a.cost - b.cost),
    /* `shipName`, not `ship`. `ship` is the ship *object* the whole panel reads
       — hull, position, heading — and calling this one `ship` too silently
       replaced it with a string, so every readout that touched it went to NaN.
       The hull bar was drawing a bar of width NaN and nothing said a word. */
    shipName: shipSpec(surv.ship).name,
    onBuyShip: buyShip,
    atHome: hangarOpen(),
    onHangar: () => {
      if (!hangarOpen()) return;
      state = "hangar";
      surveyHUD && surveyHUD.hangarOpened && surveyHUD.hangarOpened(surveyState());
    },
    onRefit: () => {
      if (surv.docked) { state = "refit"; surveyHUD && surveyHUD.refitOpened(); }
    },
    almanac: ALMANAC.map(e => ({ key: e.key, name: e.name, note: e.note,
                                 secret: e.secret, found: surv.found.has(e.key) })),
    onScan: surveyScan,
    onChart: () => { state = "chart"; surveyHUD.chartOpened(surveyState()); },
    onAlmanac: () => { state = "almanac"; },
    /* `I` and the flight panel's button reach the cargo; `G` and the strip
       reach the ship. They used to be one page and one key, which is why the
       key that meant "loadout" opened a page of ore. */
    onInventory: () => {
      state = "inventory";
      surveyHUD && surveyHUD.cargoOpened && surveyHUD.cargoOpened();
    },
    onShip: () => { state = "ship"; surveyHUD && surveyHUD.shipOpened(); },
    onRecord: () => {
      state = "record";
      surveyHUD && surveyHUD.recordOpened && surveyHUD.recordOpened();
    },
    onSector: () => {
      state = "sector";
      surveyHUD && surveyHUD.sectorOpened && surveyHUD.sectorOpened();
    },
    // The loadout was always this page; it just had the cargo bolted to it.
    onLoadout: () => { state = "ship"; surveyHUD && surveyHUD.shipOpened(); },
    onCraftPage: () => { state = "craft"; surveyHUD && surveyHUD.craftOpened(); },
    /* The station's two extra rooms. Both refuse from open space for the same
       reason the shop does: they are places, and you have to be in one. */
    onStationInv: () => {
      if (!surv.docked && !surv.landed) { gameSound("hit"); return; }
      state = "stationinv";
      /* Whichever sub-page it is about to show gets its own "opened" call, so
         a scroll position left over from the last visit is reset exactly the
         way it is when the page is opened on its own. */
      const sub = surveyHUD && surveyHUD.stationTab
                ? surveyHUD.stationTab() : "ship";
      if (!surveyHUD) return;
      if (sub === "ship" && surveyHUD.shipOpened) surveyHUD.shipOpened();
      else if (sub === "craft" && surveyHUD.craftOpened) surveyHUD.craftOpened();
      else if (sub === "chart" && surveyHUD.chartOpened) {
        surveyHUD.chartOpened(surveyState());
      }
    },
    /* ── the machines in the corner ────────────────────────────────────
       Everywhere you can trade, you can play: a station's counter and an
       inhabited world's surface both have a cabinet, and a machine you can
       only find at some stations is a machine nobody finds.

       The room does no arithmetic. What it draws is this: which cabinets
       there are, whose the place is, and your best on this one — worked out
       here, said in words here, so the page cannot disagree with the book.
       See `CABINETS` and `SIM_SCORE`. */
    arcade: (() => {
      const spot = cabinetHere();
      if (!spot) return null;
      return {
        where: spot.where, owner: spot.owner, colour: spot.colour,
        pick: arcadePick,
        /* Which machine is coming up, and how far it has got. The page draws
           a boot line over that cabinet and nothing else moves. */
        booting: simBoot ? simBoot.key : null,
        /* The board of the machine you are standing in front of. It follows
           the selection rather than belonging to a cabinet, so moving along
           the row reads the next machine's people — which is what makes the
           three cabinets a room rather than three buttons. */
        board: simBoardOf(spot, (CABINETS[arcadePick] || CABINETS[0]).key),
        boardOf: (CABINETS[arcadePick] || CABINETS[0]).name,
        /* The board says a score the same way the cabinet above it does, out
           of the one table, because a board that called it WAVE 9 under a
           machine that called it 9 would be two machines. */
        say: SIM_SCORE[(CABINETS[arcadePick] || CABINETS[0]).key].say,
        youColour: PLAYERS[0].colour,
        bootAt: simBoot ? 1 - Math.max(0, simBoot.t) / SIM_BOOT : 0,
        machines: CABINETS.map(c => {
          const best = simBest(spot.id, c.key);
          return { key: c.key, name: c.name, line: c.line, art: c.art,
                   colour: c.colour,
                   cap: SIM_SCORE[c.key].cap,
                   best: best ? SIM_SCORE[c.key].say(best) : "NOT PLAYED" };
        })
      };
    })(),
    onArcade: () => {
      if (!surv.docked && !surv.landed) { gameSound("hit"); return; }
      arcadePick = 0;
      state = "arcade";
    },
    onPlaySim: key => startSim(key),
    /* The two things that used to be behind the front page's SIMULATORS door.
       A cabinet is somebody playing alone; the room also has people in it,
       and a board on the wall that other people are on.

       Top-level, beside the room's other actions, and not inside `arcade`:
       the page reads them as `st.onPeople`, and `test/survey.js` compares
       every `st.something` the interface reads against what the game
       actually sends — which is how a pair of buttons that could never have
       fired was caught before anybody pressed one. */
    onPeople: () => openWithPeople(),
    onBoard: () => openBoards(),
    // A machine that is already coming up ignores the next coin.
    simBooting: !!simBoot,
    onPickSim: i => { arcadePick = Math.max(0, Math.min(CABINETS.length - 1, i)); },
    onWormhole: () => {
      if (!stationHas("mouth")) { gameSound("hit"); return; }
      if (!surv.docked) { gameSound("hit"); return; }
      state = "wormhole";
    },
    // The nav strip's own destination for the station itself.
    onStation: () => {
      if (surv.docked) {
        state = "refit";
        surveyHUD && surveyHUD.refitOpened();
        surveyHUD && surveyHUD.marketOpened();
      }
    },
    onMissions: () => { state = "missions"; },
    onClose: () => { state = "playing"; }
  };
}

/* The world, drawn for a page to sit on. The camera, the sky, the sector and
   nothing else — no HUD, because the page has its own and two sets of readouts
   over each other is worse than none. */
function drawSurveyBehind(dt) {
  if (!surv) return;
  ctx.save();
  wScale = cam.scale;
  ctx.translate(SCREEN_W / 2, SCREEN_H / 2);
  ctx.rotate(cam.rot);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.x, -cam.y);
  drawSurveyWorld();
  for (const r of rocks) {
    if (onScreen(r.x, r.y, r.r + 20)) drawRock(r);
  }
  for (const s2 of ships) if (s2.alive) drawShip(s2);
  ctx.restore();
  drawBits();
}

/* The boss bar, across the top of the screen while a boss is after you:
   whose sky it is, the boss's name, its hull, and how far off it is. And for
   the first seconds after you cross into any boss's sky, friendly or not, a
   banner in the middle of the screen, because a line in the radio is easy to
   miss. */
function drawBossBar() {
  if (!surv.inLair && surv.leftBanner > 0 && surv.lairLeft) {
    const k = Math.min(1, surv.leftBanner / 0.6);
    text("LEAVING " + BOSS_SKY[surv.lairLeft.kind], SCREEN_W / 2, SCREEN_H * 0.3, 22,
         NEBULA, "center", k);
    text(surv.lairLeft.name, SCREEN_W / 2, SCREEN_H * 0.3 + 26, 14, NEBULA, "center", k * 0.8);
  }
  const L = surv.inLair;
  if (!L) return;
  const me = ships[0];
  const b = surv.traffic.find(t => t.lairId === L.id);
  const cx = SCREEN_W / 2;
  if (surv.lairBanner > 0) {
    const k = Math.min(1, surv.lairBanner / 0.6, (4 - surv.lairBanner) / 0.3);
    text("ENTERING " + BOSS_SKY[L.kind], cx, SCREEN_H * 0.3, 26, BOSS_COLOUR,
         "center", Math.max(0, k));
  }
  /* The bar is for a boss that is after you. Ric: "no top bar on ones that
     are friendly or neutral. if they are hostile the bar pops up." So it
     appears the moment the boss, or its crew, would come for you (entering a
     pirate's sky, or starting something with a queen) and not before. It
     fades in over a third of a second so it reads as an event. */
  const foe = !!b && (bossHostile(b) || b.angry ||
    surv.traffic.some(t => t.leadId === b.id && t.angry));
  surv.barIn = foe ? Math.min(1, (surv.barIn || 0) + 1 / 20) : 0;
  if (!foe) return;
  const fade = surv.barIn;
  const top = 26;
  const w = Math.min(440, SCREEN_W * 0.44) * (0.6 + 0.4 * fade);
  text(BOSS_SKY[L.kind] + (L.faction && L.faction !== "free" && L.faction !== "pirate"
         ? "  \u00b7  " + factionOf(L.faction).short : ""),
       cx, top, 11, BOSS_COLOUR, "center", 0.8 * fade);
  text(L.name, cx, top + 20, 17, BOSS_COLOUR, "center", fade);
  const frac = Math.max(0, b.hp / b.maxHp);
  const y = top + 32;
  glow(BOSS_COLOUR, 5, 0.22 * fade, () => {
    ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx + w / 2, y); ctx.stroke();
  });
  glow(BOSS_COLOUR, 5, 0.95 * fade, () => {
    ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx - w / 2 + w * frac, y); ctx.stroke();
  });
  const far = Math.hypot(b.x - me.x, b.y - me.y);
  text(far < 1000 ? Math.round(far) + "u" : (far / 1000).toFixed(1) + "k",
       cx + w / 2 + 10, y + 4, 11, BOSS_COLOUR, "left", 0.8 * fade);
}

function drawSurveyPanel(dt) {
  if (!surv || !surveyHUD) return;
  surveyHUD.drawPanel(surveyState(), dt);
  drawBossBar();
  /* Radio used to be drawn here, on two lines above the status strip. It is in
     the notification stack now — see `chatter` — so there is nothing left for
     this function to add and the bottom of the screen is the hull bar and
     nothing else. */
}

/* The title row says where you got to, if you have been before. A mode that
   remembers should say so on the way in, not once you are already inside. */
/* ── what the front page says about your sector ───────────────────────────
   The title asks the book one question — is there a sector, and how much of
   it have you written down — and the title is drawn sixty times a second. The
   book is up to half a megabyte of JSON and reading it decodes a fog bitfield,
   so asking per frame would put a parse of the whole save inside the render
   loop, which is the kind of cost that shows up as a stutter on the one screen
   a new player judges the game on.

   So it is read once and kept. The answer can only change in two places — a
   run ending back at the title, and the wipe — and both throw it away. */
let titleCard = null;
const forgetTitleCard = () => { titleCard = null; };

function titleSurvey() {
  if (titleCard) return titleCard;
  const b = loadSurveyBook();
  const started = !!(b && b.seed);
  const found = (b && b.found && b.found.length) || 0;
  /* `started` is the book having a seed, not the blurb having a separator in
     it. A sector you have flown for ten minutes without logging anything is
     still a sector, and a front page that offered to BEGIN one would be
     lying about what its own button does. */
  titleCard = {
    started,
    head: started ? "CONTINUE THE SECTOR" : "BEGIN THE SURVEY",
    /* Short. This sits under the one button on the front page, and the
       front page is not where the game explains itself — a count is a fact
       about your sector and earns its line; a sentence about what Survey is
       does not. */
    sub: started
      ? (found ? found + " LOGGED" : "where you left it")
      : "one pilot, one chart"
  };
  return titleCard;
}

function surveyBlurb() {
  const b = loadSurveyBook();
  if (!b.seed || !b.found.length) return MODES.survey.blurb.toUpperCase();
  /* How many, never out of how many. The book used to say 31 / 34, which
     tells a player at the far end of twenty hours that there are exactly three
     strange things left — and the whole design of the last tier is that those
     three break rules the game spent twenty hours teaching. A countdown to them
     makes them a checklist to finish rather than something to run into. */
  return b.found.length + " LOGGED \u00b7 CONTINUE THE SECTOR";
}

function spotIsClear(x, y) {
  const r = SHIP_R * U;
  if (rocks.some(k => gap2(x, y, k.x, k.y) < (k.r + 95 * U) ** 2)) return false;
  if (ships.some(s => s.alive && gap2(x, y, s.x, s.y) < (r * 3) ** 2)) return false;
  // Respawning inside a gravity well is a death sentence you didn't earn.
  if (hazards.some(h => hazardActive(h) &&
                      dist2(x, y, h.x, h.y) < (h.kill + 220) ** 2)) return false;
  /* Nor inside a world. This never mattered while a planet was 200 units
     across and there was no reason to spawn near one; a planet can be 3,600
     units across now, and appearing inside one is appearing inside a wall. */
  if (mode.survey && surv &&
      surv.planets.some(pl => dist2(x, y, pl.x, pl.y) < (pl.r + r + 200) ** 2)) {
    return false;
  }
  // Nor inside anything somebody built. See `inBuilt`.
  if (mode.survey && inBuilt(x, y, r + 200)) return false;
  return x > bounds.x0 + r && x < bounds.x1 - r &&
         y > bounds.y0 + r && y < bounds.y1 - r;
}

/* ── where a ship is allowed to appear ────────────────────────────────────
   A spawn has three rules, and they are not equally negotiable.

     inside the wall     — outside it is unreachable, and the old code could
                           land you there because the spawn ring belongs to
                           the full map, not to whatever the wall has shrunk
                           to. Hard rule.
     clear of a hazard   — a sun or a black hole is instant death you did not
                           earn. Hard rule.
     not inside a rock   — the negotiable one, because it is the only one
                           where something else can move instead.

   The old version searched eighty points, and if none of them was clear it
   returned whichever had been least bad — a point that could be inside a rock
   or inside a kill radius — and the caller would then place the ship there
   anyway after three seconds rather than bench a player. That is where
   spawning inside an asteroid came from. Now the search only ever returns a
   point satisfying the two hard rules, and if it cannot find one that is also
   clear of rocks, the rocks are what give way. */
/* Clear of a hazard means clear of its *pull*, not of the ball in the middle.
   A star kills within 46 and pulls from 380; the black holes pull from 520 and
   650. Measuring the spawn rule from the kill radius put every "legal" spawn
   deep inside a well, so the ship was hauled in during the two and a half
   seconds it was invulnerable and died the instant that ran out — which is
   indistinguishable, from the seat, from spawning on top of a sun. Audited:
   every ship found inside a kill radius had arrived there that way.

   Late on, a shrunk arena may have no point outside every well. Then this
   falls back through worse options in order, and the last of them still keeps
   its distance from anything lethal. */
const SPAWN_KILL_MARGIN = 140;

function wellGapAt(x, y) {        // negative means inside the pull
  let gap = Infinity;
  for (const h of hazards) {
    if (hazardActive(h)) gap = Math.min(gap, Math.hypot(x - h.x, y - h.y) - h.reach);
  }
  return gap;
}

function killGapAt(x, y) {
  let gap = Infinity;
  for (const h of hazards) {
    if (hazardActive(h)) gap = Math.min(gap, Math.hypot(x - h.x, y - h.y) - h.kill);
  }
  return gap;
}

function rockGapAt(x, y) {
  let gap = Infinity;
  for (const r of rocks) gap = Math.min(gap, Math.sqrt(gap2(x, y, r.x, r.y)) - r.r);
  return gap;
}

function shipGapAt(x, y, self) {
  let gap = Infinity;
  for (const s of ships) {
    if (s !== self && s.alive) gap = Math.min(gap, Math.sqrt(gap2(x, y, s.x, s.y)));
  }
  return gap;
}

// Anything overlapping the spot a ship is about to occupy is destroyed rather
// than spawned inside. This is the same end a rock meets at the wall, and it
// only ever runs when every candidate point was under one.
function clearRocksAt(x, y, radius) {
  let any = false;
  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i];
    if (gap2(x, y, r.x, r.y) < (r.r + radius) ** 2) {
      burst(r.x, r.y, "#ffcb42", 8, 130 * U);
      rocks.splice(i, 1);
      any = true;
    }
  }
  // One crunch for the lot: they all go on the same frame.
  if (any) gameSound("rock", x, y);
}

function respawnPoint(ship) {
  // Campaign reinforcements fly in from their own side of the map, not from a
  // ring round the middle — a fresh enemy appearing amidships would be a ship
  // teleporting into your six. Yours enter behind you, theirs from their line.
  if (mode.campaign) return campaignSpawnPoint(ship);
  const cx = (bounds.x0 + bounds.x1) / 2;
  const cy = (bounds.y0 + bounds.y1) / 2;
  const r = SHIP_R * U;
  const room = Math.min(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
  // Never wider than the arena can actually hold, or every candidate is
  // rejected for being outside a wall that has closed past the margin.
  const margin = Math.max(r + 1, Math.min(90 * U, room * 0.22));
  const facing = (x, y) => Math.atan2(cy - y, cx - x);

  const inside = (x, y) =>
    x > bounds.x0 + margin && x < bounds.x1 - margin &&
    y > bounds.y0 + margin && y < bounds.y1 - margin;

  /* The ring point first, then the middle, then a spread of random points and
     a coarse grid. The grid is what makes this reliable rather than lucky: a
     small arena late in a match can be mostly rock, and random sampling alone
     can miss the one gap that exists. */
  const tries = [];
  const ring = spawnPoint(ship.id, players);
  tries.push({ x: ring.x, y: ring.y, a: ring.a });
  tries.push({ x: cx, y: cy });
  for (let i = 0; i < 90; i++) {
    tries.push({ x: rand(bounds.x0 + margin, bounds.x1 - margin),
                 y: rand(bounds.y0 + margin, bounds.y1 - margin) });
  }
  for (let gx = 0; gx <= 6; gx++) {
    for (let gy = 0; gy <= 5; gy++) {
      tries.push({ x: bounds.x0 + margin + (bounds.x1 - bounds.x0 - 2 * margin) * gx / 6,
                   y: bounds.y0 + margin + (bounds.y1 - bounds.y0 - 2 * margin) * gy / 5 });
    }
  }

  const legal = tries.filter(p => inside(p.x, p.y));
  const scored = legal.map(p => ({
    p,
    well: wellGapAt(p.x, p.y),
    kill: killGapAt(p.x, p.y),
    room: Math.min(rockGapAt(p.x, p.y), shipGapAt(p.x, p.y, ship))
  }));
  const pickBy = (list, key) =>
    list.reduce((best, c) => (best === null || c[key] > best[key] ? c : best), null);
  const out = c => ({ x: c.p.x, y: c.p.y,
                      a: c.p.a != null ? c.p.a : facing(c.p.x, c.p.y) });

  // Best case: out of every well, and nothing in the way. Nothing is disturbed.
  const free = scored.filter(c => c.well >= 0 &&
                                  c.room > Math.max(95 * U, r * 3));
  if (free.length) return out(pickBy(free, "room"));

  /* From here something has to give, and it is always the rocks — never the
     wall, and never the distance from a hazard. */
  const outOfWells = scored.filter(c => c.well >= 0);
  const safeEnough = scored.filter(c => c.kill >= SPAWN_KILL_MARGIN);
  const chosen = outOfWells.length ? pickBy(outOfWells, "room")
               : safeEnough.length ? pickBy(safeEnough, "well")
               : scored.length     ? pickBy(scored, "kill")
               : { p: { x: cx, y: cy } };
  clearRocksAt(chosen.p.x, chosen.p.y, Math.max(95 * U, r * 3));
  return out(chosen);
}
