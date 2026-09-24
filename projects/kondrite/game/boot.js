"use strict";

/* KONDRITE — BOOT
   ─────────────────────────────────────────────────────────────────────────────
   The opt-in debug API for the harnesses, then the boot: read the keys, size
   the canvas, hand the modules the engine, start the frame loop. Loaded last
   on purpose.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

// Opt-in diagnostics for local browser tests. Production pages do not expose
// mutable game state unless they were deliberately opened with ?debug=1.
if (debugOn) {
  window.__cf = {
    peek: () => ({ state, mode: mode.name, lives, clock: +clock.toFixed(1),
                   rocks: rocks.length,
                   ships: ships.map(s => ({ id: s.id, label: s.label, alive: s.alive,
                                            stocks: s.stocks, hull: s.hull, bot: !!s.bot,
                                            x: Math.round(s.x), y: Math.round(s.y),
                                            invuln: +s.invuln.toFixed(2) })) }),
    /* `bounds` and `arena` are here because the closing wall is the one part
       of this game that cannot be checked by looking at it: whether a ship is
       inside the live arena, or wedged in the wall, is arithmetic, and a
       harness needs the same numbers the simulation used. */
    live: () => ({ ships, rocks, hazards, bullets, net, binder,
                   players: PLAYERS, taps,
                   pad: padCfg, stick, arranging, camera: cam, bounds, arena,
                   // What the thumbs are holding, and which pad buttons are
                   // on screen for them to hold.
                   touch,
                   padShown: PAD_PARTS.filter(([, el]) => !el.hidden)
                                      .map(([k]) => k),
                   clock,
                   // The hull you are actually flying, not the stock constant:
                   // collision, pickup and drawing all read this one.
                   shipR: mode.survey ? shipRadius() : SHIP_R * U,
                   pickups, comms, shake,
                   cameraMode: camRotates() ? "rotating" : "fixed",
                   cameraOn: cameraRotates,
                   /* The screen is as wide as the device now, so anything
                      checking a layout has to be able to ask how wide it
                      actually is rather than assuming a thousand. */
                   screenW: SCREEN_W, screenH: SCREEN_H,
                   }),
    /* Which gun sounds decoded, and the on-screen rule asked at three points:
       where the camera is, just past the rim, and a long way off. */
    sound: () => {
      audioUnlock();
      const half = SCREEN_W / (2 * Math.max(0.01, cam.scale));
      return { loaded: Object.keys(laserBuffers).sort(), kinds: Object.keys(LASERS).sort(),
               here: audible(cam.x, cam.y),
               rim: audible(cam.x + half * 1.01, cam.y),
               far: audible(cam.x + half * 4, cam.y),
               nowhere: audible(undefined, undefined) };
    },
    step: () => tick(performance.now(), true),
    // Start a match straight from a harness, skipping the menus, read the
    // campaign controller, force a screen, and draw one frame. Behind ?debug=1
    // with the rest, so a normal load never gets a shortcut into the game.
    start: (key, humans) => startGame(key, Math.max(1, humans || 1), 0),
    // Continue a campaign the way NEXT/RETRY do, so the carryover path is
    // reachable from a harness; `run` reads the ledger between missions.
    resume: (key, humans) => playCampaignLevel(key, humans),
    run: () => campRun,
    campaign: () => camp,
    draw: () => render(1 / 60),
    screen: s => { state = s; },
    // And which one it is now, so a harness can check that a page refused to
    // open rather than only that opening it did not throw.
    screenNow: () => state,
    pick: key => chooseMode(key),  // the real menu action: sets up the count screen
    squad: order => setSquadOrder(order),  // issue a wing order, as a keypress would
    diff: d => { campaignDifficulty = d; },  // choose difficulty before a start
    /* Survey's controller and its two player actions. The catalogue is the
       one thing in the game whose correctness is a set of conditions rather
       than a place a ship ends up, so a harness needs to be able to read it
       and to press both of the mode's buttons. */
    survey: () => surv,
    /* What the broad phase actually looked at, against what all-pairs would
       have. A count, not a stopwatch: CI timing is noise and this is the
       number the change is really about. */
    rockPairs: () => {
      const n = rocks.length;
      rockCandidates = 0;
      let real = 0;
      forEachRockPair(rocks, (i, j) => {
        const a = rocks[i], b = rocks[j];
        const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
        if (dx * dx + dy * dy < min * min) real++;
      });
      return { rocks: n, allPairs: n * (n - 1) / 2,
               considered: rockCandidates, touching: real };
    },
    /* The save pipeline, in the four pieces it is made of, so a harness can
       drive each one on a fixture instead of through a whole game. */
    book: {
      parse: parseSurveyBook,
      migrate: migrateSurveyBook,
      validate: validateSurveyBook,
      read: readSurveyBook,
      hooks: bookHooks,
      load: loadSurveyBook,
      fresh: freshBook,
      version: SAVE_VERSION,
      keys: { store: SURVEY_STORE, backup: SURVEY_BACKUP, legacy: SURVEY_LEGACY },
      isSaveError: e => e instanceof SaveError,
      pack: packMutations,
      unpack: unpackMutations
    },
    // Which places deal in find-only parts. See `takesExotics`.
    exotics: (x, y) => takesExotics(x, y),
    partResale: (key, place) => partResale(moduleSpec(key), place),
    catalogue: () => ALMANAC,
    chunk: (cx, cy) => buildChunk(cx, cy),
    /* A made-up board, straight from the generator, so a harness can check
       that it is pure and that two cabinets are two boards without having to
       fly to each of them. */
    board: (gx, gy, owner, game) =>
      WORLD.simBoard(gx, gy, owner, game, CAMPAIGN_ORDER.length),
    /* The witnessed board's half. A harness cannot open five browsers and
       play a real game against itself, so it is handed the two things a
       match tells this client — who was in which seat, and which match it
       was — and then asks what this client would say about it. */
    witness: {
      seats: (a, id) => { accounts = (a || []).slice(); matchId = id || null; },
      // `net.on` is `role !== null`, so being online is a role, not a flag.
      online: on => { net.role = on ? "host" : null; },
      report: r => matchReport(r || { kind: "lost" }),
      accounts: () => accounts.slice(),
      matchId: () => matchId
    },
    chunkSize: () => CHUNK,
    // What a station is short of, for anything watching the economy react.
    market: st => marketOf(st || surv.docked),
    // What every kind of ship out there is trying to do.
    roles: () => JSON.parse(JSON.stringify(ROLES)),
    /* Set the camera preference directly, the way the settings page's button
       does — so a harness can check that switching the view does not break
       what is drawn over it. It is one answer for every mode now; the `key`
       argument is ignored and kept so older callers still read. */
    setCamera: (key, on) => {
      toggleCamera(on === undefined ? key : on);
      return cameraRotates;
    },
    /* How long the sector is. Anything sampling "near home" against "the deep"
       has to ask rather than assume: these numbers moved by a factor of six
       when the almanac's ladder was stretched, and a test with 320,000 written
       into it silently starts sampling two points in the same band. */
    /* `far` is the far end of the *ladder*, which is the furthest rung a
       landmark can be dealt — not simply the last row of the table. The
       Leviathan sits at the bottom of that table and is no longer on the
       ladder at all, so reading the last row now reports 40,000 and makes the
       sector look like a village. */
    sectorSpan: () => ({ chunk: CHUNK,
                         far: Math.max(...LANDMARKS.filter(L => !L.fixed)
                                                   .map(L => L.dist)) }),
    leave: () => leaveMatch(),
    find: key => surveyFind(key),
    /* Press and release a key the way a player does. `readLocalInput` rebuilds
       every ship's input from the held-key set each frame, so a harness that
       pokes `ship.input` directly is overwritten before the ship ever moves —
       and Survey has no bot to fly it instead. This drives the real path,
       bindings and all. */
    hold: (code, on) => { if (on) keys.add(code); else keys.delete(code); },
    // A menu/page keypress, so a harness can drive the chart and the almanac
    // through the same handler a keyboard reaches them by.
    key: code => menuKey(code),
    /* The mode row, and the pointer focus that opens a card. Hover arrives as
       a real mousemove on the canvas, which a harness has no way to dispatch,
       so the one value that event sets is settable directly — everything
       downstream of it is then the same code a mouse drives. */
    menu: () => ({ lane: modeLane, pick: modePick, hover: modeHover,
                   open: openCard(), rows: laneRows().slice(),
                   anim: cardAnim.slice(),
                   lanes: LANE_KEYS.slice() }),
    hover: i => { modeHover = i; if (i >= 0) modePick = i; },
    lane: key => openLane(key),
    scan: () => surveyScan(),
    /* The devices: the list as the interface sees it, a press through the
       real path, and the two things they leave in the world. A device is the
       one part in the game whose whole point is what it does to *other*
       systems, so a harness has to be able to press one and then look at the
       sentries. */
    devices: () => devicesFitted().map(d => ({
      slot: d.slot, key: d.key, device: d.dev.key, name: d.dev.name,
      cd: d.cd, cool: d.dev.cool })),
    useDevice: i => useDevice(i),
    /* Flying with the mouse, for a harness. `point` puts the cursor
       somewhere in SCREEN units — or takes it off the glass entirely with
       `null`, which is a state the real pointer reaches every time somebody
       reaches for the address bar and which the ship has to stop obeying. */
    mouseFly: on => { mouseFly = !!on; },
    point: (x, y) => { pointerAt = x === null ? null : { x, y }; },
    decoys: () => surv.decoys,
    mines: () => surv.mines,
    // The key table for the four slots, so a rebind can be checked against
    // what the game actually reads.
    deviceKeys: () => DEVICE_KEYS.map(k => k.slice()),
    // The gamepad as the game last read it, and the last key code it pressed.
    gamepad: () => ({ ...gpad, held: gpad.held.slice() }),
    // The refit, driven the way the station screen drives it, so a harness
    // can prove salvage actually turns into a better ship.
    // Buying one off a shelf, the way the market row does it.
    buyPart: key => buyModule(key),
    // What a part is worth reaching for, and how you would get one.
    partWays: key => {
      const m = moduleSpec(key);
      return m ? { buy: sellsIt(m), craft: craftsIt(m), find: findsIt(m),
                   boss: has(m, "boss") } : null;
    },
    // The yard and the scan, as the interface sees them.
    objective: () => objective(),
    /* The point the line is about, which is a different fact from the line:
       the harness has been reaching for this since the MK1 went in and
       guarding the call with `cf.objectiveTarget ? … : null`, so the check
       behind that guard has never once run. Exposed, so it does. */
    objectiveTarget: () => objectiveTarget(),
    scanReach: () => scanRange(),
    surveyView: () => surveyState(),
    zoom: () => surveyZoom,
    dangerAt: (x, y) => dangerAt(x, y),
    shelfDepth: (x, y) => shelfDepth(x, y),
    wildAt: (x, y) => wildAt(x, y),
    spaceAt: (x, y) => spaceAt(x, y),
    placeAt: (x, y) => placeAt(x, y),
    war: () => surv.war,
    /* The living world, for a harness that wants to run it fast: `turn` runs
       n political turns on a seeded generator, `state` is what the pages
       read, `news` is the framed feed, `events` the record itself. */
    living: {
      turn: (n, seed) => {
        const R = seeded((seed | 0) || 1);
        const out = [];
        for (let i = 0; i < (n || 1); i++) out.push(livingTurn(R));
        return out;
      },
      state: () => livingState(),
      news: (flag, n) => livingNews(flag, n),
      events: () => (surv && surv.living ? surv.living.events : []),
      powers: () => (surv && surv.living ? surv.living.powers : null),
      raw: () => surv && surv.living
    },
    dockable: (st, faction) => dockableBy(st, faction),
    warTurn: R => surveyWarTurn(R),
    claim: (cx, cy, owner) => {
      surv.claims.set(cx + "," + cy, owner || "");
      WORLD.territoryChanged();
    },
    cycleZoom: () => cycleSurveyZoom(),
    resetSurvey: () => resetSurveyProgress(),
    resetArmed: () => surveyResetArmed(),
    hud: () => surveyHUD,
    /* The material tables and the hull-loss spill. Both are pure arithmetic
       over a table, which is exactly the kind of thing that rots without a
       sound: a weight typed wrong makes one of the four unreachable and the
       game carries on looking correct. */
    rollMaterial: (source, deep) => rollMaterial(source, deep),
    prices: st => stationPrices(st || surv.docked),
    sell: () => sellHold(),
    /* Dying, driven directly. There is no bot to fly you into a black hole and
       a harness cannot wait for one, but the *consequences* of a death are the
       whole of phase 2 and they are all arithmetic. */
    die: cause => surveyDie(cause || "rock"),
    /* Which fields the loader actually reads back. The book is a whitelist, so
       a field written and not listed here is thrown away silently — this is how
       a test can check the two lists agree. */
    bookKeys: () => Object.keys(loadSurveyBook()),
    // Write the book now rather than waiting out the fifteen-second autosave.
    saveBook: () => saveSurveyBook(),
    // The account panel, without having to find the pause screen first.
    account: () => openAccount(),
    /* Whether anything is pressable at a point, and pressing it. There was no
       way to ask this, which is why "the button drew and nothing was under it"
       is a bug this mode has shipped five times — a dead tap target looks
       perfect in a screenshot. Coordinates are SCREEN space, the same space
       the interface lays itself out in. */
    tapAt: (x, y) => {
      const t = tapAt(x, y);
      return t ? { x: Math.round(t.x), y: Math.round(t.y),
                   w: Math.round(t.w), h: Math.round(t.h) } : null;
    },
    /* Every pressable rectangle on the screen as it stands. What this is for
       is the audits that cannot be done by looking: a control off the bottom
       of the canvas, one too small for a thumb, one drawn at NaN. All three
       render as "nothing happened when I pressed it". */
    taps: () => taps.map(t => ({ x: Math.round(t.x), y: Math.round(t.y),
                                 w: Math.round(t.w), h: Math.round(t.h),
                                 live: typeof t.act === "function" })),
    /* The press, coordinates and all. It used to call `act()` bare, so
       anything that acts on *where* it was pressed — the map, which turns a
       press into a place — could not be driven by a harness at all. */
    tapHit: (x, y) => {
      const t = tapAt(x, y);
      if (t && typeof t.act === "function") { t.act(x, y); return true; }
      return false;
    },
    // The boot-time pull, on demand, so a harness can drive it.
    catchUp: () => catchUp(),
    /* What kind of space a point is, which the *game* never tells the player —
       see BIOMES.md. A harness has to be able to ask, or the one layer whose
       whole design is to be invisible is also the one layer nothing can check. */
    regionProbe: (x, y) => regionOf(x, y),
    /* The dialogue the game is waiting on, and a way to answer it. A harness
       cannot click a DOM button, and the pin flow is now three deliberate acts
       — arm, tap, answer — of which the third is the only one that commits
       anything. Untestable otherwise. */
    ask: () => pendingAsk && pendingAsk.type,
    answer: a => { if (pendingAsk) pendingAsk.submit(a); },
    // How deep into its region a point is, and what that does to the scan.
    regionAtDepth: (x, y) => ({ depth: regionDepth(x, y), scan: regionScan(x, y) }),
    /* A round of yours into a sentry, through the real path. Clearing a
       distress call's attackers *by deleting them* is not the same event as
       clearing them by shooting them — the first pays nothing now, correctly —
       so a harness needs the second. */
    hurtDrone: (i, dmg) => {
      const d = surv.drones[i];
      if (!d) return false;
      d.hp -= dmg || 1;
      d.hit = 0.12; d.awake = true;
      if (d.prey) d.prey.helped = true;
      if (d.hp <= 0) killDrone(i);
      return true;
    },
    // Every region site over a block of the lattice, for measuring the mix —
    // sampling along a line visits far too few of them to say anything.
    /* Where every region actually is, not just which ones exist. A biome is a
       Voronoi cell around a site, so the sites are the honest description of
       a sector's geography — how many there are inside a distance, how far out
       each kind's nearest example is, and how big any of them get. */
    regionSites: (n) => {
      const out = [];
      for (let j = -n; j <= n; j++) {
        for (let i = -n; i <= n; i++) {
          const st = regionSite(i, j);
          out.push({ x: st.x, y: st.y, cx: i, cy: j,
                     key: st.region.key, name: st.region.name });
        }
      }
      return out;
    },
    regionCell: () => REGION_CELL,
    /* The Warrens, asked directly. `caveFill` is whether the region claims
       this point at all, `caveDepth` is how far inside a passage it is, and
       `caveSolid` is the answer the generator acts on — all three, because
       when a cave comes out wrong it is always one of the three and looking at
       the picture cannot tell you which. */
    // How far inside a passage a point is: 0 in rock, 1 in the middle of one.
    // Negative inside a passage, positive in rock. The wall is zero.
    caveEdge: (x, y) => caveEdge(x, y),
    /* The two collisions everything except the player goes through, so a
       harness can drive the same code a freighter does. `solidBounce` shoves
       an object off anything solid and says whether it touched; `solidHit`
       answers whether a round would be stopped here. */
    solidBounce: (o, r) => solidBounce(o, r),
    solidHit: (x, y) => !!solidHit(x, y),
    caveFill: (x, y) => caveFillAt(x, y),
    caveSolid: (x, y) => caveSolidAt(x, y),
    caveCell: () => CAVE_CELL,
    regionCensus: (n) => {
      const out = [];
      for (let j = -n; j <= n; j++) {
        for (let i = -n; i <= n; i++) out.push(regionSite(i, j).region.key);
      }
      return out;
    },
    // Say something, through the real path, so the earshot rule can be tested.
    say: (text, colour, where) => chatter(text, colour, where),
    /* Recompute the ship from its slots. The game does this whenever a part
       goes on or comes off; a harness that writes `surv.slots` directly is not
       going through either path, so it has to say when it is done. */
    applyParts: () => applyRefit(ships[0]),
    // One hit, through the real damage path, so the hull's own arithmetic is
    // what the harness is testing rather than a poke at `ship.hull`.
    hurt: cause => damageShip(ships[0], cause || "rock", null),
    /* Shooting a passing ship, through the path a round takes: the marking, the
       naming and the grudge all hang off this one moment and a harness has no
       way to fire a bullet at a ship it placed itself. */
    hurtTraffic: (t, dmg) => {
      t.hp -= dmg || 1;
      t.hit = 0.12;
      if (t.faction === "pirate" && !t.hurtBy) {
        t.hurtBy = true;
        if (!t.name) t.name = shipName(true);
      }
      return t.hp;
    },
    // And `adoptFriend`, which is a roll: a harness drives it rather than waits.
    adopt: t => { adoptFriend(t); return t; },
    // Life support, so a harness can run a tank down without waiting twelve
    // real minutes for it.
    tanks: () => ({ water: surv.water, food: surv.food,
                    thirst: surv.thirst, hunger: surv.hunger }),
    setTanks: (w, f) => { if (w != null) surv.water = w;
                          if (f != null) surv.food = f; },
    buySupply: kind => buySupply(kind),
    // The hangar, driven directly: twenty-five hulls is a lot of arithmetic to
    // leave to a look.
    buyShip: key => buyShip(key),
    bossParts: () => ({ ...BOSS_PARTS }),
    // The boss's sky nearest a point, if one reaches that far.
    lair: (x, y, pad) => lairNear(x, y, pad || 0),
    // A boss, a screen away from you, so a harness can fight one.
    boss: (kind, dx, dy) => spawnBoss(kind || "warlord",
      { x: ships[0].x + (dx == null ? 900 : dx), y: ships[0].y + (dy || 0) }),
    flyShip: key => flyShip(key),
    // The parts catalogue and the two numbers a test has to read off it.
    parts: () => MODULES.map(m => ({ key: m.key, name: m.name, cat: m.cat,
                                     rarity: m.rarity, cost: m.cost,
                                     deep: m.deep, secs: fitSeconds(m.key),
                                     /* The ways in, and whether a cache can
                                        really hold one. Needed by the audit
                                        that checks every part can actually be
                                        got hold of rather than merely claiming
                                        a way to be. */
                                     get: [...(m.get || [])],
                                     inCachePool: findsIt(m) && !sellsIt(m) })),
    allCrafts: () => CRAFTS.map(r => ({ out: r.out, need: { ...r.need } })),
    scanRange: () => scanRange(),
    // The five flags a ship can fly, for anything checking they are telling
    // themselves apart.
    factions: () => FACTIONS.concat([UNALIGNED, PIRATE])
      .map(f => ({ key: f.key, short: f.short, name: f.name,
                   colour: f.colour, note: f.note, long: f.long })),
    // A real rock, built the way the sector builds them. A hand-rolled one
    // with a made-up size breaks the splitter the moment it is destroyed.
    makeRock: (size, x, y) => makeRock(size, x, y),
    // What the beam and the claw both do. See `shatterWhole`.
    shatterWhole: rock => shatterWhole(rock),
    // So a harness can derive what a break is worth instead of hard-coding it.
    yields: () => Object.assign({}, YIELD),
    /* Re-measure the screen against the stage. The screen takes the shape of
       the device now, so a harness that wants to check a layout at a phone's
       proportions has to be able to say "the window changed" without a real
       resize event. */
    resize: () => { resize(); checkOrientation(); return SCREEN_W; },
    // The key grid draws its own boxes rather than registering buttons, so
    // where it sits is not visible in the tap list.
    keyGrid: () => ({ x0: gridX0(), colW: GRID.colW, cellW: GRID.cellW,
                      cols: ACTIONS.length, labelW: GRID.labelW }),
    /* The settings page, as it is laid out rather than as it is drawn: the
       panel the grid and every row has to stay inside, which category is
       open, and where the keyboard is on it. A harness that wants SOUND asks
       the tap list for SOUND — see the label on a tap rectangle — rather
       than measuring a y band, which is what made these tests fail every
       time the page was re-spaced by two pixels. */
    // The volume dials, as numbers, and whether the sound is on at all.
    audio: () => ({ ...audioVol, on: soundEnabled }),
    settings: () => {
      const sh = settingsShell();
      return { cat: settingsCat, tab: controlTab,
               cats: settingsCats().map(c => c.key),
               panel: { x: sh.px, w: sh.pw, top: sh.top, bot: sh.bot },
               rail: setRail.map(r => r.label),
               focus: { ...setFocus }, items: setItems.length };
    },
    // Open a category the way the rail does, and a CONTROLS tab the way the
    // tab strip does, so a harness can walk the page.
    setCat: key => { settingsCat = key; return settingsCat; },
    setTab: key => { controlTab = key; return controlTab; },
    // Arriving at a station, without having to fly to one: the same call the
    // docking check makes when a real station comes into range.
    dock: () => stationFinishesFits(),
    shipNow: () => ({ key: surv.ship, owned: [...surv.owned],
                      spec: shipSpec(surv.ship),
                      zoom: shipZoomFactor(), cap: holdCap() }),
    // Where you are, as the supply system sees it.
    light: () => ({ have: surv.hasLight, run: surv.lightRun,
                    hit: surv.lightHit }),
    buildLight: () => buildLightDrive(),
    toggleLight: () => toggleLightDrive(),
    places: () => ({ docked: !!surv.docked, home: !!(surv.docked && surv.docked.home),
                     landed: surv.landed && surv.landed.name,
                     overAir: surv.overAir && surv.overAir.name,
                     skimming: surv.skimming > 0 }),
    respawn: () => surveyRespawn(),
    home: () => ({ x: HOME_STATION.x, y: HOME_STATION.y }),
    // The stated top speed, so a harness can check the engine against its own
    // number rather than against a constant it has copied.
    topSpeed: () => MAX_SPEED * (ships[0].speedMul || 1) * U
  };
}

loadKeys();
loadName();
refreshKeys();   // reading them in is not a change worth writing back
// A device with nothing but a touchscreen is a phone before it is touched,
// not after: the menus should already know what they are talking to.
applyInputMode();     // the guess, or the player's word over it
padLoad();
padApply();
resize();
// Which way up it is, before the first frame rather than after the first
// rotation: a phone opened in portrait should be told immediately.
checkOrientation();
/* The survey panel is a separate file and gets the drawing primitives handed
   to it here, after resize() so it can measure the canvas against the
   viewport. `addTap` is a function rather than the `taps` array itself
   because that array is rebuilt every frame. */
if (surveyHUD) {
  surveyHUD.init({
    ctx, canvas,
    /* Getters, not values. The screen is as wide as the device now and the
       pages lay themselves out against it every frame; handing over a number
       once would have frozen every page at 1000 wide on the first load and
       left a strip of nothing down the side of a phone. */
    get SCREEN_W() { return SCREEN_W; },
    get SCREEN_H() { return SCREEN_H; },
    get arena() { return arena; },
    /* A getter, not a value. The interface sizes every caption and every tap
       target off this, and the setting that decides it can be changed while
       the game is running — a value read once at boot would leave the HUD
       laid out for the machine the browser guessed at. */
    get touchOnly() { return thumbInput(); },
    reduceMotion,
    text, glow, tapButton, shipPip, drawHullArt,
    addTap: rect => pushTap(rect)
  });
}
if (menuArt) menuArt.init({ ctx, glow });
/* The attract loop gets the game's own hull renderer and the real roster, so
   the ship on the front page is not a drawing of a Skiff — it is a Skiff,
   drawn by the function that draws yours. */
if (attract) attract.init({ ctx, glow, hull: drawHullArt, hulls: HULL_ART });
// The Leviathan lab is a destination, not another menu choice. Opening its
// private URL should put the pilot in the empty sector immediately.
if (LEV_ONLY) startGame("survey", 1, 0);
requestAnimationFrame(frame);
