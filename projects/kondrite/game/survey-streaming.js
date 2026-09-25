"use strict";

/* KONDRITE — SURVEY — STREAMING
   ─────────────────────────────────────────────────────────────────────────────
   Streaming chunks in and out, ships that follow you out of their chunk, the
   rock index, solidity for everybody, and what a round runs into.

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
