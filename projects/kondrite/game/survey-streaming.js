"use strict";

/* KONDRITE — SURVEY — STREAMING
   ─────────────────────────────────────────────────────────────────────────────
   Streaming chunks in and out, solidity for everybody, what a round runs
   into, finding things, the pulse, and what everybody else is doing.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── streaming ────────────────────────────────────────────────────────────
   Chunks within CHUNK_LOAD of the ship are built and kept; everything else is
   dropped. The flat lists the rest of the engine reads — `hazards` above all
   — are rebuilt only when the block actually moves, not every frame, because
   re-seeding the motes is the expensive half and it has nothing to do sixty
   times a second. */
function streamChunks(force) {
  const me = ships[0];
  /* Centred ahead of the ship while the light drive is running. At eight times
     drive speed the ship crosses a chunk about once a second and the five-second
     impact warning has to see 18,000 units down the track — further than the
     loaded box reaches from the middle of it. Shifting the box forward covers
     the horizon without loading five times as many chunks, and what falls off
     the back is behind you at three kilometres a second.

     The key includes the offset, so moving the box counts as a change. */
  const running = surv.lightRun > 0;
  const load = running ? LIGHT_LOAD : CHUNK_LOAD;
  const lead = running ? CHUNK * LIGHT_LEAD : 0;
  const ox = me.x + Math.cos(me.a) * lead;
  const oy = me.y + Math.sin(me.a) * lead;
  const cx = Math.floor(ox / CHUNK), cy = Math.floor(oy / CHUNK);
  const centre = chunkKey(cx, cy) + "|" + load;
  if (!force && centre === surv.centre) return;
  surv.centre = centre;

  /* Sentries you are *fighting* have to survive this. `surv.drones` is rebuilt
     from chunk data every time the ship crosses a chunk line — which at 2,600
     units to a chunk happens every few seconds — so a sentry that had taken a
     hit was handed a fresh hull, put back on its post and sent to sleep, over
     and over, in the middle of a fight. It was not a reset you could see
     coming and it made the guards unkillable by accident.

     Every guard has a stable id now, and one that is still loaded is carried
     across the rebuild as the same object rather than made again. */
  const liveGuards = new Map();
  for (const d of surv.drones) if (d.id) liveGuards.set(d.id, d);
  // Traffic moves, so it is carried across a rebuild for the same reason a
  // guard is: a freighter that snapped back to its start line every time the
  // ship crossed a chunk line would be scenery, not company.
  const liveTraffic = new Map();
  for (const t of surv.traffic) if (t.id) liveTraffic.set(t.id, t);
  /* **Ships that were not born in a chunk.** Hunters, the one that got away,
     anything spawned at you — they carry `id: null`, and the rebuild below only
     re-adds ships it can find in a chunk. So every time you crossed a chunk
     boundary, which is every few seconds of flying, the ship chasing you
     silently stopped existing. That is the "ships near me randomly disappear"
     bug, and it also meant a hunter could never follow you anywhere.

     They are carried across by hand. Only while they are still near enough to
     be real: one that is three chunks behind you has genuinely lost you. */
  const spawned = surv.traffic.filter(t => !t.id &&
    Math.abs(t.x - ships[0].x) < CHUNK * 3 &&
    Math.abs(t.y - ships[0].y) < CHUNK * 3);
  /* Everything alive before the rebuild, so afterwards we can tell who did not
     come back. A pirate you shot and did not finish leaves the loaded window at
     some point, and that moment — the only moment at which "it got away" is a
     fact rather than a guess — is the difference between a grudge and nothing. */
  const wasHurt = surv.traffic.filter(t => t.hurtBy && t.hp > 0);

  const want = new Set();
  for (let y = cy - load; y <= cy + load; y++) {
    for (let x = cx - load; x <= cx + load; x++) {
      const k = chunkKey(x, y);
      want.add(k);
      if (!surv.chunks.has(k)) surv.chunks.set(k, buildChunk(x, y));
    }
  }
  for (const k of [...surv.chunks.keys()]) {
    if (want.has(k)) continue;
    surv.chunks.delete(k);
    /* A post that has gone out of range is manned again when you come back —
       that was always the rule, and it is the reason a guard is not written
       into the book the way an opened cache is. So the memory of which guards
       are dead only lasts as long as their chunk is loaded. */
    for (const id of [...surv.deadGuards]) {
      if (id.startsWith(k + "c")) surv.deadGuards.delete(id);
    }
    // Same rule for traffic: out of range is out of mind, and coming back
    // finds the route running again.
    for (const id of [...surv.goneTraffic]) {
      if (id.startsWith(k + "t")) surv.goneTraffic.delete(id);
    }
  }

  hazards = [];
  surv.planets = []; surv.wrecks = []; surv.nebulae = []; surv.marks = [];
  surv.gates = []; surv.caches = []; surv.stations = []; surv.hulks = [];
  /* A salvage queen's drones were not born in a chunk, so a rebuild would
     drop them mid-fight. They stay while she does. */
  const queensOwn = surv.drones.filter(d => d.ally ||
    (d.queen && surv.traffic.includes(d.queen)));
  surv.drones = queensOwn; surv.leviathan = null; surv.vault = null;
  surv.parts = []; surv.fields = [];
  surv.cave = [];
  surv.caveGrid = null;
  /* ── the ships that followed you out of their own chunk ────────────────
     `surv.traffic` is rebuilt from the loaded chunks every stream, and a ship
     belongs to the chunk it *spawned* in. A ship that is chasing you has by
     definition left that chunk — it is wherever you are — so the moment its
     birthplace scrolled out of the loaded box it was dropped from the rebuild
     and vanished. From the cockpit: the thing on your tail blinks out of
     existence, usually just as it gets interesting.

     So anything that was flying a moment ago and is still within reach comes
     across, whether or not the chunk that made it is still loaded. It is
     still culled — by its own distance from you, which is the honest test —
     and a kill still removes it, because `goneTraffic` is keyed on the id it
     carries with it. */
  const wasFlying = surv.traffic;
  surv.traffic = []; surv.battles = [];
  for (const [k, c] of surv.chunks) {
    // The Warrens' rock. Already collision discs; see `caveSegsIn`.
    for (const g of c.caveSegs) surv.cave.push(g);
    for (const h of c.hazards) hazards.push(h);
    for (const p of c.planets) surv.planets.push(p);
    for (const w of c.wrecks) surv.wrecks.push(w);
    for (const n of c.nebulae) surv.nebulae.push(n);
    for (const m of c.marks) surv.marks.push(m);
    for (const f of c.fields) surv.fields.push(f);
    for (const g of c.gates) surv.gates.push(g);
    for (const pt of c.parts) {
      /* A spare lying out in the sector answers to its site, not to the
         manifest: you can already own three tractor beams and the fourth is
         still out there to be found, so `built` and `carrying` — which are
         both about the one manifest copy of a key — say nothing about it.
         What retires it is having been picked up. */
      if (pt.mod) {
        if (!surv.lifted.has(pt.site || pt.key)) surv.parts.push(pt);
        continue;
      }
      /* A part that has been dropped is not also still at its landmark — the
         sector generated one and there is one, wherever it happens to be. */
      if (surv.built.has(pt.key) || surv.carrying.has(pt.key)) continue;
      // A manifest part, and only a manifest part: a spare on the floor with
      // the same key would otherwise cancel a site it has nothing to do with.
      if (surv.dropped.some(d => !d.mod && d.key === pt.key)) continue;
      surv.parts.push(pt);
    }
    if (c.leviathan) surv.leviathan = c.leviathan;
    if (c.vault) surv.vault = c.vault;

    /* A chunk is rebuilt from its seed every time you come back to it, so
       anything you *changed* about one has to be remembered outside it or
       flying away would restock the sector behind you. Two sets do that: the
       caches you have opened and the hulks you have stripped, both keyed by
       chunk and index because that pair is stable across a rebuild. */
    c.hulks.forEach((h, i) => {
      const id = k + "h" + i;
      if (surv.stripped.has(id)) return;
      h.id = id;
      surv.hulks.push(h);
    });
    c.stations.forEach(st => surv.stations.push(st));

    c.traffic.forEach((t, ti) => {
      const tid = k + "t" + ti;
      if (surv.goneTraffic.has(tid)) return;
      const was = liveTraffic.get(tid);
      if (was) { surv.traffic.push(was); return; }
      const made = Object.assign({}, t, { id: tid, cargo: t.cargo.slice() });
      // Who it flies with: the leader is the same chunk's ship at `leadIdx`.
      if (t.leadIdx != null) made.leadId = k + "t" + t.leadIdx;
      // Its own cruising speed, kept so a ship that runs from something can
      // stop running afterwards rather than sprinting for the rest of its life.
      made.baseSpeed = made.speed;
      // And what a full reserve was, so one that got out of trouble can fill
      // back up to where it started rather than to some new number.
      made.tankFull = made.tank;
      // And it may be a ship you have met before. See `adoptFriend`.
      if (surv.friends.length) adoptFriend(made);
      surv.traffic.push(made);
      /* A distress call brings its own attackers. They are drones like any
         other so they behave like any other, and they are posted on the ship
         rather than on a cache — which is what makes the scene read as
         something happening rather than something placed. */
      for (let g = 0; g < t.guards; g++) {
        const ga = (g / Math.max(1, t.guards)) * Math.PI * 2;
        surv.drones.push({
          id: tid + "g" + g,
          x: t.x + Math.cos(ga) * 260, y: t.y + Math.sin(ga) * 260,
          vx: 0, vy: 0, a: ga + Math.PI, home: null, prey: made,
          post: { x: t.x, y: t.y }, hp: 2, cool: rand(0.2, 1),
          awake: true, hit: 0
        });
      }
    });
    /* ── the battles ────────────────────────────────────────────────────
       The shape of a fight comes out of the chunk; whether it is still being
       fought does not. A battle you have not watched yet is still going —
       that is what makes finding one worth doing — and one you sat and
       watched to the end is over for good, with whatever is left of it still
       drifting there.

       The ships are ordinary traffic, angry at each other, which is the whole
       trick: everything that already makes two powers shoot at one another
       works here without a second system for it. */
    c.battles.forEach((b, bi) => {
      const id = k + "b" + bi;
      const live = Object.assign({}, b, { id });
      surv.battles.push(live);
      const left = surv.battleAge[id];
      live.left = left;
      live.seen = left != null;
      live.over = left != null && left <= 0;
      const BR = seeded(b.seed >>> 0);
      if (live.over) {
        /* What is left. Hulks are the mode's own salvage, so an old battle is
           worth flying to even once the shooting has stopped — and a fleet
           action leaves more of it than a border scuffle. */
        for (const w of battleWrecks(live)) {
          if (surv.stripped.has(w.id)) continue;
          surv.hulks.push(w);
        }
        // A remembered one stays on the chart even if the record was trimmed.
        if (surv.memorials.has(id)) noteKnown("memorial", b.x, b.y, b.name);
      } else {
        for (let side = 0; side < 2; side++) {
          for (let j = 0; j < b.fleet; j++) {
            const tid = id + "s" + side + "_" + j;
            if (surv.goneTraffic.has(tid)) continue;
            const was = liveTraffic.get(tid);
            if (was) { surv.traffic.push(was); continue; }
            /* Two lines facing each other, loosely — a fight has a shape, and
               a ring of ships around a point does not read as one. */
            const spread = b.r * 0.7;
            const along = (j - (b.fleet - 1) / 2) / Math.max(1, b.fleet) * spread * 2;
            const face = side ? Math.PI : 0;
            const off = side ? spread * 0.8 : -spread * 0.8;
            const hull = b.hull[side];
            const hs = shipSpec(hull);
            surv.traffic.push({
              id: tid, kind: "patrol", role: "patrol",
              faction: b.sides[side], hull, battle: id,
              x: b.x + off, y: b.y + along, a: face,
              from: { x: b.x + off, y: b.y + along },
              to: { x: b.x - off, y: b.y + along },
              leg: 1, speed: MAX_SPEED * hs.speed * (0.6 + BR() * 0.16),
              hp: hs.hull, maxHp: hs.hull,
              cargo: [], cool: BR() * 1.2, doom: 0, guards: 0,
              // Nobody in a battle has time to mind how close you are flying.
              space: 0, trades: false, phase: BR() * Math.PI * 2
            });
          }
        }
      }
    });
    c.caches.forEach((cache, i) => {
      const id = k + "c" + i;
      if (surv.opened.has(id)) return;
      cache.id = id;
      surv.caches.push(cache);
      /* Sentries are made when the chunk streams in and forgotten when it
         streams out. Leaving a fight and coming back finds the post manned
         again — the cache is what you are taking, so the cache is what is
         remembered, and a guard is only ever the price of it.

         But "streams out" means its chunk left the loaded set, not "the ship
         moved". One that is still loaded is the same sentry it was a frame
         ago: its hull, its position and whether it has noticed you all carry
         over, and only its `home` is rebound to the freshly built cache. */
      cache.guards.forEach((g, gi) => {
        const gid = id + "g" + gi;
        if (surv.deadGuards.has(gid)) return;
        const was = liveGuards.get(gid);
        if (was) { was.home = cache; surv.drones.push(was); return; }
        surv.drones.push({
          id: gid, x: g.x, y: g.y, vx: 0, vy: 0, a: g.a, home: cache,
          post: { x: g.x, y: g.y }, hp: 2, cool: rand(0.4, 1.6),
          awake: false, hit: 0
        });
      });
    });
  }

  /* ── the rock, indexed ─────────────────────────────────────────────────
     A streamed block of the Warrens is a couple of thousand discs, and three
     different things want to know "is there rock near this point" every
     frame: the hull, every ship in the sector, and every round in the air.
     Walking the whole list for each of them is the product of three large
     numbers and it is paid sixty times a second.

     So it goes into a grid once, here, when the block changes — which is when
     you cross a chunk line rather than every frame. A disc is filed under
     every cell it touches, so a lookup is the nine cells around a point and
     nothing is missed at a boundary. */
  if (surv.cave.length) {
    const grid = new Map();
    for (const g of surv.cave) {
      const x0 = Math.floor((g.x - g.r) / CAVE_GRID_CELL);
      const x1 = Math.floor((g.x + g.r) / CAVE_GRID_CELL);
      const y0 = Math.floor((g.y - g.r) / CAVE_GRID_CELL);
      const y1 = Math.floor((g.y + g.r) / CAVE_GRID_CELL);
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          const k2 = gx + "," + gy;
          let cell = grid.get(k2);
          if (!cell) grid.set(k2, cell = []);
          cell.push(g);
        }
      }
    }
    surv.caveGrid = grid;
  }

  /* Whatever you died carrying, wherever you died carrying it. Not out of a
     chunk, because it does not belong to one — it belongs to the run, and it
     has to be there when you come back whether its chunk happens to be loaded
     or not. It never drifts and it never expires. */
  for (const d of surv.dropped) {
    if (Math.abs(d.x - ships[0].x) > CHUNK * 3 ||
        Math.abs(d.y - ships[0].y) > CHUNK * 3) continue;
    const spec = droppedSpec(d);
    if (!spec) continue;
    surv.parts.push({ key: d.key, name: spec.name, x: d.x, y: d.y, r: 40,
                      dropped: true, mod: !!d.mod, id: d.id });
  }

  /* And who did not come back. A pirate you shot and did not finish is only
     "the one that got away" at the moment the sector stops holding it — before
     that it is still a fight, and after that it is a memory. This is that
     moment, and it is the only place in the file that can tell. */
  for (const t of wasHurt) {
    if (surv.traffic.indexOf(t) >= 0) continue;
    rememberGrudge(t);
  }

  // The ones that were spawned rather than generated, put back. See `spawned`.
  for (const t of spawned) surv.traffic.push(t);

  /* And the ones that *were* generated but whose birthplace has gone. A ship
     chasing you is, by the time it matters, a long way from the chunk that
     made it — so the chunk scrolls out of the loaded box, the rebuild cannot
     find the ship in any chunk, and it is dropped while sitting on your tail.
     Same disappearance as the spawned ships above, from the other direction,
     and the half of it that was still there.

     Carried over on the same terms: still near enough to be real, not already
     back in the list, and not something you killed. */
  const back = new Set(surv.traffic);
  for (const t of wasFlying) {
    if (back.has(t) || !t.id) continue;
    if (surv.goneTraffic.has(t.id)) continue;
    if (Math.abs(t.x - ships[0].x) > CHUNK * 3 ||
        Math.abs(t.y - ships[0].y) > CHUNK * 3) continue;
    surv.traffic.push(t);
  }

  capHomeTraffic();
  seedMotes();
}

/* ── and never a crowd at the front door ──────────────────────────────────
   The generation bowl decides how often a ship is *made* near home; this
   decides how many can be standing there at once. They are different
   questions, because chunks stream independently and a run of ordinary rolls
   can still put four ships in the same piece of sky — and Ric's rule is about
   what you can see, not about the odds: "there shouldn't be more than 2 unless
   there is a war or battle going on right next to you."

   So two, and the exception is his as well. A battle inside the home band
   lifts the cap entirely: a fight is the one thing worth a crowd, and thinning
   one out would leave you watching half of something.

   What goes is the *furthest* over the cap, and only ships that are nobody's
   business yet — anything you have hurt, anything hunting you, anything in a
   battle and anything you have a history with stays, because a ship vanishing
   mid-chase is the bug this whole streamer keeps almost shipping. */
const HOME_CROWD = 2;
const HOME_CALM_R = CHUNK * 4;
function capHomeTraffic() {
  if (!surv || !surv.traffic.length) return;
  const inHome = t => Math.hypot(t.x, t.y) < HOME_CALM_R;
  const here = surv.traffic.filter(inHome);
  if (here.length <= HOME_CROWD) return;
  // A fight near the door is allowed its crowd.
  for (const b of (surv.battles || [])) {
    if (Math.hypot(b.x, b.y) < HOME_CALM_R + CHUNK) return;
  }
  if (here.some(t => t.battle)) return;
  const spare = here.filter(t =>
    !t.hurtBy && !t.angry && !t.angryAt && !t.name &&
    !t.hunted && !t.stun && t.kind !== "distress" &&
    Math.hypot(t.x - ships[0].x, t.y - ships[0].y) > 900 * U);
  spare.sort((a, b) =>
    Math.hypot(b.x - ships[0].x, b.y - ships[0].y) -
    Math.hypot(a.x - ships[0].x, a.y - ships[0].y));
  let over = here.length - HOME_CROWD;
  for (const t of spare) {
    if (over <= 0) break;
    const at = surv.traffic.indexOf(t);
    if (at < 0) continue;
    /* Written off rather than merely dropped, so the chunk that made it does
       not hand it straight back on the next rebuild. */
    if (t.id) surv.goneTraffic.add(t.id);
    surv.traffic.splice(at, 1);
    over--;
  }
}

/* ── everything solid is solid to everybody ───────────────────────────────
   The player's hull stops at a world's surface and at the Leviathan's plates.
   Nothing else did — so a hauler would cross the one authored object in the
   sector as though it were a picture, and a patrol would fly through a planet
   on its way to somewhere.

   It is a push rather than a physics: put the thing back on the surface, and
   turn its nose along it so it goes round instead of grinding into it. That
   reads as a ship avoiding a planet, which is what it is, and it cannot trap
   anything the way a reflection can. */
/* ── what a round runs into ───────────────────────────────────────────────
   Anything solid stops one. Rounds went through worlds, dead hulls, the
   Leviathan, the Vault and the Warrens alike — you could shoot a sentry
   through the wall it was standing behind, and a planet offered no cover at
   all. Cover is most of what makes a solid object worth flying behind, and a
   round that ignores geometry quietly removes the reason for all of it.

   Returns where it hit, or null. The caller decides what that means: an
   ordinary round is spent, and a charge goes off. */
function solidHit(x, y) {
  if (!surv) return null;
  for (const pl of surv.planets) {
    if (dist2(x, y, pl.x, pl.y) < pl.r * pl.r) return { x, y };
  }
  /* A hulk is the one solid thing out here that is also a *target*, so it
     hands itself back rather than only reporting a stop. It used to report a
     stop and nothing else — and because this sweep runs before the survey
     bullet pass that knows how to damage one, the round was always spent on
     the way in. A dead hull was cover you could hide behind and could not
     break: thirty seconds of continuous fire, four hit points, not one of
     them taken. */
  for (let i = 0; i < surv.hulks.length; i++) {
    const h = surv.hulks[i];
    if (dist2(x, y, h.x, h.y) < h.r * h.r) return { x, y, hulk: h, at: i };
  }
  const lev = surv.leviathan;
  if (lev && dist2(x, y, lev.x, lev.y) < (lev.len * 0.75) ** 2) {
    for (const g of lev.segs) if (dist2(x, y, g.x, g.y) < g.r * g.r) return { x, y };
  }
  const vt = surv.vault;
  if (vt && dist2(x, y, vt.x, vt.y) < (vt.r * 1.6) ** 2) {
    for (const g of vt.segs) if (dist2(x, y, g.x, g.y) < g.r * g.r) return { x, y };
  }
  /* The Warrens, asked of the *field* rather than of the collision discs. The
     discs sit at cell centres and the wall is a contour that cuts across them,
     so the two disagree by up to half a cell — measured, 2 rounds in 48 flew
     a little way past the wall they were drawn hitting before a disc caught
     them. A ship can wear that; a round cannot, because a round stopping
     visibly short of, or inside, a wall is the one place the difference is
     actually watched. There are only ever a handful of rounds in the air, so
     the exact answer is affordable here and not in the hull's collision. */
  if (caveSolidAt(x, y)) return { x, y };
  return null;
}

/* Reflecting off whatever `solidBounce` just put you back on top of. The
   component heading *into* the surface is reversed and damped; the component
   along it is kept, so a glancing pass slides and a head-on stops. That is
   the same rule the player's rock bounce follows, and it is what these three
   call sites were missing — they scaled the whole velocity down instead, so a
   ship that clipped a wall lost four fifths of everything it had whatever
   hull it was flying and however much grip that hull had.

   `keep` under two, always: at two the bounce is perfectly elastic and
   anything above it hands out free speed. */
function bounceOff(o, keep) {
  const nx = o.bnx, ny = o.bny;
  if (nx === undefined) { o.vx = (o.vx || 0) * 0.5; o.vy = (o.vy || 0) * 0.5; return; }
  const into = (o.vx || 0) * nx + (o.vy || 0) * ny;
  if (into < 0) {
    o.vx -= into * nx * keep;
    o.vy -= into * ny * keep;
  }
  o.bnx = o.bny = undefined;
}

function solidBounce(o, r) {
  if (!surv) return false;
  let hit = false;
  const clear = (cx, cy, cr) => {
    const dx = o.x - cx, dy = o.y - cy;
    const d = Math.hypot(dx, dy);
    const min = cr + r;
    if (d >= min) return;
    hit = true;
    const nx = d > 1 ? dx / d : 1, ny = d > 1 ? dy / d : 0;
    o.x = cx + nx * min;
    o.y = cy + ny * min;
    /* Handed back, so the caller can reflect along it instead of throwing the
       whole velocity away. The callers used to multiply by 0.2 or 0.25 —
       which stops a ship dead whatever it is flying, and Ric spotted it from
       the cockpit: "some bots are still not following the rules, somehow they
       stop instantly with ships like the stride which cant do that." A Stride
       carries its speed for nearly a second; nothing it brushes should be
       able to take four fifths of it in a frame. */
    o.bnx = nx; o.bny = ny;
    // Along the surface, in whichever direction it was already going.
    const along = Math.atan2(ny, nx);
    const turn = Math.cos(o.a - along) > 0 ? 0 : Math.PI;
    o.a = along + (Math.sin(o.a - along) >= 0 ? 1.35 : -1.35) + turn * 0;
  };
  for (const pl of surv.planets) clear(pl.x, pl.y, pl.r);
  /* The Leviathan is a hundred and seventy discs now rather than twenty-six,
     and every ship in the sector was being tested against all of them every
     frame. One bounding check first: if you are not within a hull length of it,
     none of its walls can possibly be in reach. */
  const lev = surv.leviathan;
  if (lev && dist2(o.x, o.y, lev.x, lev.y) < (lev.len * 0.75) ** 2) {
    for (const g of lev.segs) clear(g.x, g.y, g.r);
  }
  // And the Vault, on the same terms: one bounding check, then its walls.
  const vault = surv.vault;
  if (vault && dist2(o.x, o.y, vault.x, vault.y) < (vault.r * 1.6) ** 2) {
    for (const g of vault.segs) clear(g.x, g.y, g.r);
  }
  /* And the Warrens. This function is what everything *except* the player uses
     — a world and a dead hull are solid to everybody — and the cave was not in
     it, so freighters and pirates flew through a hundred thousand units of
     solid rock while you bounced off it. A wall that stops one kind of ship is
     set dressing. Indexed, because a block of the Warrens is a couple of
     thousand discs and this runs for every ship in the sector.

     Resolved over several passes, and out of the *deepest* overlap each time.
     Everything else this function pushes off is one disc thick — a hull plate,
     a wall of the Vault — so a single pass out of each in turn settles it. A
     cave mass is many discs thick in every direction, and one pass out of the
     last disc in the list can land inside the one before it: measured, 18 of
     24 probes walked straight through. Taking the worst overlap first and
     repeating converges, and four passes is well past where it stops moving. */
  for (let pass = 0; pass < 4; pass++) {
    let worst = null, worstDepth = 0;
    for (const g of caveNear(o.x, o.y)) {
      const dx = o.x - g.x, dy = o.y - g.y;
      const d = Math.hypot(dx, dy);
      const depth = (g.r + r) - d;
      if (depth > worstDepth) { worstDepth = depth; worst = g; }
    }
    if (!worst) break;
    clear(worst.x, worst.y, worst.r);
  }

  /* The discs are an approximation of the cave and the cave is a field, so
     the two disagree in the margins: there are pockets the field calls rock
     that no disc quite covers. The player has always been dug out of one —
     see the `caveSolidAt` guard beside the hull's own collision — and nothing
     else was, so a freighter could drift through a piece of wall you can see.
     That is the asymmetry this whole function was written to end.

     The field is the last word, then, for everybody. Reached only when the
     discs found nothing, which is the rare case, so the cost is a couple of
     samples on the frames it matters. */
  if (!hit && surv.cave && surv.cave.length && caveSolidAt(o.x, o.y)) {
    const out = outOfRock(o.x, o.y);
    o.x = out.x; o.y = out.y;
    hit = true;
  }
  return hit;
}

/* ── is this point inside something built ────────────────────────────────
   The easiest thing in the world to miss, and the reason to write it down once
   rather than at every spawn: **nothing may appear inside a wall.**

   It did not matter much when the only structures were a 2,700-unit derelict
   and a planet. There are two things you fly inside now, one of them nine
   thousand units long with a hundred and seventy walls in it, and everything
   that picks a point in space — the rock streamer, a hunter arriving, a ship
   respawning, a part dropped where you died — was picking that point with no
   idea either of them existed. A rock spawning in a corridor is a rock that can
   never get out; a hunter spawning in a hull is a hunter you cannot reach and
   cannot escape; a drive part dropped in a bulkhead is the manifest broken.

   Asked about the **footprint**, not about the walls. Inside the corridor is
   technically clear of every disc and is still not somewhere to put a drifting
   rock, and the difference between the two is the difference between a check
   that passes and a check that works. */
function inBuilt(x, y, pad) {
  if (!surv) return false;
  const p = pad || 0;
  /* Rock in the Warrens counts as built. A cache inside a wall is a cache
     nobody can reach, and this is the function every generator already asks
     before it places anything — the same question the Leviathan's hold and the
     Vault's corridor made necessary. Asked of the lattice rather than of the
     loaded list, so it is true for chunks that have not been built yet. */
  if (caveSolidAt(x, y) ||
      (p > 0 && (caveSolidAt(x + p, y) || caveSolidAt(x - p, y) ||
                 caveSolidAt(x, y + p) || caveSolidAt(x, y - p)))) return true;
  const lev = surv.leviathan;
  if (lev && dist2(x, y, lev.x, lev.y) < (lev.len * 0.8) ** 2) {
    const dx = x - lev.x, dy = y - lev.y;
    const u = dx * lev.ca + dy * lev.sa, v = -dx * lev.sa + dy * lev.ca;
    if (Math.abs(u) < lev.len / 2 + p &&
        Math.abs(v) < lev.flank + 900 + p) return true;
  }
  const vt = surv.vault;
  if (vt && dist2(x, y, vt.x, vt.y) < (vt.r * 2) ** 2) {
    const dx = x - vt.x, dy = y - vt.y;
    const u = dx * vt.ca + dy * vt.sa, v = -dx * vt.sa + dy * vt.ca;
    if (Math.abs(u) < vt.r + p && Math.abs(v) < vt.r + p) return true;
  }
  return false;
}

/* ── a rock is solid to more than your hull ───────────────────────────────
   A rock had a radius and a world had a radius and nothing had ever asked one
   about the other, so asteroids sat inside planets and inside each other —
   which is exactly the kind of thing that makes a sector read as a backdrop
   rather than a place.

   Three answers, and they are deliberately different:

     a world   breaks it. A rock meeting a planet at speed is not a bounce, and
               the sector already breaks rocks on stars and black holes.
     a rock    pushes it. Two rocks are the same kind of thing, so they part
               and swap a little momentum rather than one of them winning.

   Only in Survey: the arena modes have no worlds and a field small enough that
   rocks knocking each other about would change how every one of them plays. */
function surveyRockSolids() {
  if (!mode.survey || !surv) return;

  /* Somewhere with people on it keeps the rocks off. An inhabited world and a
     station both do it, at a perimeter well outside themselves — a rock is
     turned away rather than allowed to arrive and break, which is the
     difference between somewhere that is lived in and somewhere that is not.

     It is also the reason a station is a place you can sit still: an anchorage
     that got hit by the field it is anchored in would not be one. */
  const shield = [];
  for (const pl of surv.planets) {
    if (pl.inhabited) shield.push({ x: pl.x, y: pl.y, r: pl.r + 700 });
  }
  for (const st of surv.stations) shield.push({ x: st.x, y: st.y, r: 900 });
  /* And the two built things turn rocks away at their outline, for the same
     reason a station does: an anchorage that got hit by the field it is
     anchored in would not be one, and a derelict full of drifting rock is a
     derelict you cannot fly. Nothing spawns inside them; this is for the one
     that wanders in from outside. */
  const lev = surv.leviathan;
  if (lev) shield.push({ x: lev.x, y: lev.y, r: lev.len * 0.56 });
  if (surv.vault) {
    shield.push({ x: surv.vault.x, y: surv.vault.y, r: surv.vault.r * 1.45 });
  }

  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i];
    let handled = false;

    for (const sh of shield) {
      const dx = r.x - sh.x, dy = r.y - sh.y;
      const d = Math.hypot(dx, dy);
      if (d > sh.r + r.r || d < 1) continue;
      // Put it on the perimeter and send it back out the way it came.
      const nx = dx / d, ny = dy / d;
      r.x = sh.x + nx * (sh.r + r.r);
      r.y = sh.y + ny * (sh.r + r.r);
      const into = r.vx * nx + r.vy * ny;
      if (into < 0) { r.vx -= into * nx * 1.8; r.vy -= into * ny * 1.8; }
      r.vx += nx * 30 * U; r.vy += ny * 30 * U;
      r.flash = 0.1;
      handled = true;
      break;
    }
    if (handled) continue;

    // Everywhere else, a world simply breaks it.
    for (const pl of surv.planets) {
      if (dist2(r.x, r.y, pl.x, pl.y) > (pl.r + r.r) ** 2) continue;
      burst(r.x, r.y, "#ffcb42", 10, 180 * U);
      if (onScreen(r.x, r.y, 400)) gameSound("rock", r.x, r.y);
      rocks.splice(i, 1);
      break;
    }
  }

  /* And each other. Each pair once, and only pairs that are near enough to be
     worth asking about — see `forEachRockPair`. A Survey field is not a few
     dozen rocks and every rock against every other rock is quadratic in a
     number that grows. */
  forEachRockPair(rocks, (i, j) => {
    {
      const a = rocks[i];
      const b = rocks[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 < 1) return;
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;
      /* Parted along the line between them, each giving way in proportion to
         how small it is — a pebble gets out of a boulder's way. */
      const over = min - d;
      const ma = a.r * a.r, mb = b.r * b.r, tot = ma + mb;
      a.x -= nx * over * (mb / tot); a.y -= ny * over * (mb / tot);
      b.x += nx * over * (ma / tot); b.y += ny * over * (ma / tot);
      // And a nudge, so they drift apart rather than grinding on each other.
      const push = 26 * U;
      a.vx -= nx * push * (mb / tot); a.vy -= ny * push * (mb / tot);
      b.vx += nx * push * (ma / tot); b.vy += ny * push * (ma / tot);
    }
  });
}

/* Rocks are not part of a chunk. They drift, so a chunk that regenerated them
   would snap them back to where they started every time you flew away and
   returned; instead a population is kept around the ship and topped up at the
   edge of it, the way Battle Royale tops up its field. */
function streamRocks() {
  const me = ships[0];
  // The empty room means empty. Rocks are streamed around the ship rather
  // than rolled into chunks, so they have to be turned off separately.
  if (LEV_ONLY) { rocks.length = 0; return; }
  const far = (SURVEY_ROCK_R * 1.7) ** 2;
  for (let i = rocks.length - 1; i >= 0; i--) {
    if (dist2(rocks[i].x, rocks[i].y, me.x, me.y) > far) rocks.splice(i, 1);
  }
  /* Thicker further out, thicker again inside a field — and now thicker or
     thinner because of *where you are*. A belt is rock as far as the scan
     reaches; the Long Empty has almost none, which is the whole of what makes
     it worth flying into. */
  const wild = wildAt(me.x, me.y);
  const reg = regionOf(me.x, me.y);
  const want = Math.round(SURVEY_ROCKS * (1 + wild * 0.7) * reg.rocks);
  const near = surv.fields.filter(f =>
    dist2(f.x, f.y, me.x, me.y) < (SURVEY_ROCK_R * 1.4) ** 2);
  let guard = 60;
  while (rocks.length < want && guard-- > 0) {
    let x, y;
    /* A field is a place, so its rocks are put *in* it rather than on the ring
       around the ship. They still drift out of it and are collected like any
       other, which is what keeps a field a thing you fly through rather than a
       box that refills behind you. */
    if (near.length && Math.random() < 0.62) {
      const f = near[Math.floor(Math.random() * near.length)];
      const fa = Math.random() * Math.PI * 2;
      const fd = Math.sqrt(Math.random()) * f.r;
      x = f.x + Math.cos(fa) * fd;
      y = f.y + Math.sin(fa) * fd;
      if (dist2(x, y, me.x, me.y) < 700 * 700) continue;   // never on top of you
    } else {
      const a = Math.random() * Math.PI * 2;
      const d = rand(SURVEY_ROCK_R * 0.85, SURVEY_ROCK_R * 1.35);
      x = me.x + Math.cos(a) * d;
      y = me.y + Math.sin(a) * d;
    }
    // Clear of the killing radius, but no longer held a long way off it: a
    // field that cannot drift into a well is a field a well never touches.
    if (hazards.some(h => dist2(x, y, h.x, h.y) < (h.kill + 90) ** 2)) continue;
    // And never inside a world, which is now big enough to swallow a field.
    if (surv.planets.some(pl => dist2(x, y, pl.x, pl.y) < (pl.r + 60) ** 2)) continue;
    // Nor inside the Leviathan or the Vault: a rock loose in a corridor is a
    // rock that can never get out of it.
    if (inBuilt(x, y, 90)) continue;
    const r = makeRock(randomRoyaleRockSize(), x, y, undefined,
                       regionOf(x, y).style);
    // What it is made of, which is what it is drawn as. A rime is ice.
    r.ice = regionOf(x, y).ice >= 20;
    // One rock in sixty has something in it, and cracking it open is the only
    // way to find out which. Stops once the entry is logged.
    if (!surv.found.has("prospector") && Math.random() < 1 / 60) r.core = true;
    rocks.push(r);
  }
}

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
