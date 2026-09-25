"use strict";

/* KONDRITE — THE WORLD — PLACES
   ─────────────────────────────────────────────────────────────────────────────
   Solid things, gates, sentries, the devices driven (drones and shots
   included), caches, stations, worlds you can put down on, and
   remembering.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── solid things ─────────────────────────────────────────────────────────
   One resolver for every solid body in the sector, because they all want the
   same three things: stop overlapping, bounce, and hurt if you arrived fast.

   A slow nudge is free. That matters more than it sounds: a world where every
   brush with a hull costs a hull point is a world you fly through the middle
   of, and the whole point of making things solid was to give you reasons to
   fly close to them. */
const STRIKE_SPEED = 130 * U;      // below this it is a nudge, not a crash

function strike(ship, ox, oy, rr, hard) {
  const R = shipRadius();
  let dx = ship.x - ox, dy = ship.y - oy;
  let d = Math.hypot(dx, dy);
  if (d > rr + R) return false;
  if (d < 0.001) { dx = 1; dy = 0; d = 1; }
  dx /= d; dy /= d;

  ship.x = ox + dx * (rr + R);
  ship.y = oy + dy * (rr + R);

  const vn = ship.vx * dx + ship.vy * dy;
  if (vn < 0) {
    ship.vx -= 2 * vn * dx * 0.55;
    ship.vy -= 2 * vn * dy * 0.55;
  }
  const impact = Math.abs(vn);
  surv.t.struck = true;
  /* A strike resolves every frame the ship is touching something, so scraping
     along a hull used to add shake sixty times a second — faster than it
     decays, which pinned the screen for as long as contact lasted. The noise
     and the jolt are what an *impact* sounds like, so they are rate-limited to
     one every quarter second; the push-out above still happens every frame,
     because that is physics rather than feedback. */
  if (impact > STRIKE_SPEED * 0.35 && surv.bumpCool <= 0) {
    surv.bumpCool = 0.25;
    burst(ship.x, ship.y, "#ffcb42", impact > STRIKE_SPEED ? 12 : 5,
          140 * U);
    gameSound("rock", ship.x, ship.y);
    addShake(impact > STRIKE_SPEED ? 5 : 2);
  }
  if (hard && impact > STRIKE_SPEED && ship.invuln <= 0) {
    damageShip(ship, "rock", null);
  }
  return true;
}

function surveySolids(dt) {
  const me = ships[0];
  if (!me.alive) return;

  // Worlds. The atmosphere halo is drawn at 1.12r, so the surface is r.
  for (const p of surv.planets) {
    if (dist2(me.x, me.y, p.x, p.y) < (p.r + 260) ** 2) strike(me, p.x, p.y, p.r, true);
  }

  // Dead hulls, adrift and strippable.
  for (const h of surv.hulks) {
    h.a += h.spin * dt;
    if (dist2(me.x, me.y, h.x, h.y) < (h.r + 260) ** 2) strike(me, h.x, h.y, h.r, true);
  }

  /* The Leviathan. Its hull is discs, so flying down the inside of it is the
     same collision as flying around the outside — which is the only reason
     the corridor is trustworthy enough to be worth putting loot at the end
     of. Only the discs near the ship are ever tested. */
  const lev = surv.leviathan;
  if (lev && dist2(me.x, me.y, lev.x, lev.y) < (lev.len * 1.1) ** 2) {
    for (const g of lev.segs) {
      if (dist2(me.x, me.y, g.x, g.y) < (g.r + 300) ** 2) {
        strike(me, g.x, g.y, g.r, true);
      }
    }
  }
  /* And the Vault, which had every one of its walls stamped as discs and drawn
     from the same list — and was not in this function, so the player flew
     through all of it. Traffic already bounced off it; you did not. A structure
     whose walls stop everything except you is not a structure. */
  const vt = surv.vault;
  if (vt && dist2(me.x, me.y, vt.x, vt.y) < (vt.r * 2) ** 2) {
    for (const g of vt.segs) {
      if (dist2(me.x, me.y, g.x, g.y) < (g.r + 300) ** 2) {
        strike(me, g.x, g.y, g.r, true);
      }
    }
  }

  /* The Warrens. The same collision as the other two, and it has to be: the
     whole region is a thing you fly *inside*, so a wall that stopped everything
     except you would be scenery with a cave painted on it. Only the discs near
     the ship are tested, which is what keeps a region of forty thousand of
     them affordable. */
  if (surv.cave && surv.cave.length) {
    /* Buried rather than merely touching. Nothing should ever put a ship here
       — every teleport goes through `outOfRock` — but this is the one failure
       that cannot be recovered from by playing, so it is caught rather than
       trusted. Velocity goes too: arriving somewhere new at the speed you hit
       a wall is its own accident. */
    if (caveSolidAt(me.x, me.y)) {
      const out = outOfRock(me.x, me.y);
      me.x = out.x; me.y = out.y; me.vx = me.vy = 0;
    }
    for (const g of caveNear(me.x, me.y)) {
      if (dist2(me.x, me.y, g.x, g.y) < (g.r + 300) ** 2) {
        strike(me, g.x, g.y, g.r, true);
      }
    }
  }
}

/* ── gates ────────────────────────────────────────────────────────────────
   The wormhole, and the one thing in the sector that moves you rather than
   stopping you. Falling in is the whole interaction — there is nothing to
   press, the same way there is nothing to press to arrive anywhere else.

   Warp tuning, the almanac's second verb, changes where it lets out: a tuned
   gate goes to whatever you have not logged yet instead of to its own fixed
   far side. That turns the gate network from a shortcut into transport, and
   it is what makes the far end of the landmark ladder reachable in an evening
   rather than an expedition. */
function surveyGates() {
  const me = ships[0];
  if (!me.alive || surv.warpCool > 0) return;
  /* Never over a part. Moving the coil's mouth off its site fixes the one
     case this actually happened in, but nothing stops the lattice dropping a
     gate on any of the other five, and a manifest part you cannot reach is a
     run that cannot be finished. A gate is a shortcut; a part is the game. */
  const grab = shipRadius();
  if (surv.parts.some(pt => dist2(me.x, me.y, pt.x, pt.y) <
                            (pt.r + grab + GATE_R) ** 2)) return;
  for (const g of surv.gates) {
    // The Wall's mouth never finished forming. Flying into it is meant to be
    // the anticlimax the entry is about, so it is the one gate that does
    // nothing at all.
    if (g.dead) continue;
    if (dist2(me.x, me.y, g.x, g.y) > (GATE_R * 0.55) ** 2) continue;

    let tx = g.tx, ty = g.ty, tuned = false;
    if (mods().warp) {
      const want = surv.landmarks.filter(l => !l.found)
        .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) -
                        Math.hypot(b.x - me.x, b.y - me.y))[0];
      if (want) {
        // Put down beside it, not on top of it: arriving inside the thing you
        // came to look at is a collision, and finding it should be the last
        // thing you do rather than the first.
        const a = Math.random() * Math.PI * 2;
        tx = want.x + Math.cos(a) * (want.r + 900);
        ty = want.y + Math.sin(a) * (want.r + 900);
        tuned = true;
      }
    }

    burst(me.x, me.y, NEBULA, 26, 300 * U);
    gameSound("lose", me.x, me.y);
    /* Out of the far side, not on top of it. Every gate now has a twin
       standing at its exit, and landing dead centre on that twin would mean
       being swallowed again the moment the cooldown lapsed — so you are set
       down a mouth's width beyond it, still travelling the way you went in,
       with the way home behind you. */
    const sp = Math.hypot(me.vx, me.vy);
    const hx = sp > 1 ? me.vx / sp : Math.cos(me.a);
    const hy = sp > 1 ? me.vy / sp : Math.sin(me.a);
    /* The far side of a gate is wherever the lattice put it, and that can be
       inside a mass in the Warrens — a throw that buries you is a throw you
       never come back from. */
    {
      const out = outOfRock(tx + hx * GATE_R * 1.25, ty + hy * GATE_R * 1.25);
      me.x = out.x; me.y = out.y;
    }
    // Keep the speed, lose the certainty: you come out flying, which is what
    // makes a gate feel like a throw rather than a menu.
    me.vx *= 0.4; me.vy *= 0.4;
    me.invuln = Math.max(me.invuln, 1.6);
    surv.warpCool = 2.5;
    surv.t.warped = true;
    cam.x = me.x; cam.y = me.y;
    streamChunks(true);
    streamRocks();
    burst(me.x, me.y, NEBULA, 26, 300 * U);
    gameSound("warp", me.x, me.y);
    addShake(7);
    chatter(tuned ? "Gate tuned — somewhere you have not been" : "Through.",
            NEBULA);
    return;
  }
}

/* ── sentries ─────────────────────────────────────────────────────────────
   The only things out here that want anything from you. They are posted, not
   roaming: a sentry holds station over its cache, wakes when you come close,
   and goes home when you leave. Survey's promise was never "nothing can hurt
   you" — it was that nothing is hunting you, and a guard that never leaves
   its post keeps that promise while still making the cache a decision.

   Running dark is the almanac's third verb and the counter to all of it: cut
   the engine and they lose you, which turns every cache into a choice between
   shooting your way in and drifting in cold. */
/* Two ways to be unseen, and they are different parts.

   RUNNING DARK is passive and conditional: cut the engine, stay cut, and a
   sentry loses you. SILENT RUNNING is a button and ten seconds of it, and it
   works whether you are under power or not — see `DEVICES.cloak`.

   One predicate, because everything that looks for you should ask the same
   question however you came to be hidden. */
function cloaked(me) {
  if (surv && surv.cloak > 0) return true;
  return !!mods().quiet && !me.thrusting && surv.quiet > 1.2;
}

/* ── the devices, driven ──────────────────────────────────────────────────
   One entry point for all four: the keyboard, the thumb button and anything
   else that ever wants to press one go through `useDevice`, so there is one
   answer to "can I" and one place the cooldown is set. See `DEVICES`. */

// What is fitted, finished fitting, and a device — in slot order, because the
// slot is what the player presses.
function devicesFitted() {
  if (!surv || !surv.slots) return [];
  const out = [];
  surv.slots.forEach((sl, i) => {
    if (!sl || sl.fit > 0) return;
    const m = moduleSpec(sl.key);
    const dev = m && m.eff && m.eff.device ? deviceSpec(m.eff.device) : null;
    if (dev) out.push({ slot: i, key: m.key, dev, cd: sl.cd || 0 });
  });
  return out;
}

function useDevice(i) {
  if (!mode || !mode.survey || !surv || state !== "playing") return false;
  const me = ships[0];
  if (!me || !me.alive) return false;
  const sl = surv.slots[i];
  if (!sl) return false;
  /* Three refusals, and only one of them is silent. Nothing in the slot and
     nothing happens, because there is no button on screen to have pressed. A
     part still going on says so, because the forty-five seconds is the cost of
     having fitted it out here and you are entitled to be told you are paying
     it. A cooldown says nothing: you can see it running down. */
  const m = moduleSpec(sl.key);
  const dev = m && m.eff && m.eff.device ? deviceSpec(m.eff.device) : null;
  if (!dev) return false;
  if (sl.fit > 0) {
    chatter(m.name + " \u2014 still fitting, " + Math.ceil(sl.fit) +
            " seconds.", "#ffcb42");
    return false;
  }
  if ((sl.cd || 0) > 0) return false;
  const why = dev.blocked ? dev.blocked(me) : "";
  if (why) { chatter(why, "#ffcb42"); return false; }
  dev.use(me);
  sl.cd = dev.cool;
  return true;
}

/* The hold, over the side. Behind the ship and spread across its wake rather
   than dropped on the spot, so what you dumped is a trail you can come back
   along \u2014 and so the tractor beam does not simply inhale it again before
   you have finished turning. */
function ejectHold(me) {
  let n = 0;
  const back = me.a + Math.PI;
  for (const mat of MATERIALS) {
    let have = surv.hold[mat.key] || 0;
    while (have > 0) {
      const a = back + rand(-0.6, 0.6);
      const sp = rand(60, 190) * U;
      surv.motes.push({
        x: me.x + Math.cos(a) * rand(20, 90) * U,
        y: me.y + Math.sin(a) * rand(20, 90) * U,
        vx: me.vx * 0.5 + Math.cos(a) * sp,
        vy: me.vy * 0.5 + Math.sin(a) * sp,
        spin: rand(0, 6.28), life: 240, mat: mat.key,
        /* Jettisoned, and it matters to exactly one other system: a pirate
           wants cargo, and cargo lying in space is cargo nobody has to be shot
           for. See `baitPirates`. */
        jetsam: true
      });
      have--; n++;
    }
    surv.hold[mat.key] = 0;
  }
  burst(me.x, me.y, CASH, 12, 200 * U);
  return n;
}

/* What the ejector is actually for. A pirate is not angry with you \u2014 it
   wants what you are carrying, which is a want that can be satisfied without
   either of you dying. Anything hunting you inside this radius breaks off and
   goes for the cargo instead; a hunter does not, because a hunter came for
   you and cargo is not what it was sent for. */
const BAIT_REACH = 3200;
function baitPirates(x, y) {
  let took = 0;
  for (const t of surv.traffic) {
    if (!t.angry) continue;
    if ((t.role || t.kind) === "hunter") continue;
    const role = ROLES[t.role || t.kind];
    if (!role || role.want !== "rob") continue;
    if (Math.hypot(t.x - x, t.y - y) > BAIT_REACH * U) continue;
    t.angry = false;
    t.angryAt = null;
    t.bait = { x, y };
    t.baitFor = 40;
    took++;
  }
  if (took) {
    chatter(took === 1 ? "They have turned off you and gone for the cargo."
                       : took + " of them have turned off you and gone for " +
                         "the cargo.", CASH);
  }
}

// And what they do when they get there: they take it, which is the whole of
// the transaction. Fourteen units is a hold's worth to a small ship.
function takeJetsam(t) {
  let got = 0;
  for (let i = surv.motes.length - 1; i >= 0 && got < 14; i--) {
    const m = surv.motes[i];
    if (Math.hypot(m.x - t.x, m.y - t.y) > 420 * U) continue;
    burst(m.x, m.y, matSpec(m.mat).colour, 3, 90 * U);
    surv.motes.splice(i, 1);
    got++;
  }
  t.bait = null;
  t.baitFor = 0;
  if (got) chatter("They have what they came for.", CASH, t);
}

/* One hard throw down the way you are pointing. Nothing about where you land
   is chosen, and that is the part that makes it an emergency rather than a
   shortcut: it gets you out of here at the price of not knowing where here
   becomes.

   Two things have to be true on arrival and neither is free. The chunks under
   the destination do not exist until you are there, so what is in them cannot
   be checked beforehand \u2014 the sector is streamed in first and the ship is
   pushed clear of anything it landed inside afterwards. */
function emergencyJump(me) {
  const a = me.a + rand(-0.5, 0.5);
  const d = rand(14000, 34000);
  burst(me.x, me.y, ICE_C, 30, 340 * U);
  addShake(8);
  gameSound("lose", me.x, me.y);
  me.x += Math.cos(a) * d;
  me.y += Math.sin(a) * d;
  // You arrive stopped. A jump that kept your speed would be a way of going
  // fast, and this is a way of not being there any more.
  me.vx = 0; me.vy = 0;
  me.invuln = Math.max(me.invuln, 2.2);
  surv.warpCool = Math.max(surv.warpCool, 2.5);
  cam.x = me.x; cam.y = me.y;
  streamChunks(true);
  streamRocks();
  /* Out of whatever was waiting there. Pushed clear of a well's whole reach
     rather than of the radius that kills, because arriving stopped inside the
     outer half of a supermassive is arriving dead a few seconds later. */
  for (let k = 0; k < 6; k++) {
    const h = hazardAt(me.x, me.y, 700 * U);
    if (!h) break;
    const dx = me.x - h.x, dy = me.y - h.y;
    const dd = Math.hypot(dx, dy) || 1;
    me.x = h.x + (dx / dd) * (h.reach + 500 * U);
    me.y = h.y + (dy / dd) * (h.reach + 500 * U);
    cam.x = me.x; cam.y = me.y;
    streamChunks(true);
    streamRocks();
  }
  solidBounce(me, shipRadius());
  // Blind on arrival. The scanner is the mode's one verb and taking it away
  // for a minute is what makes the landing somewhere rather than nowhere.
  surv.scan.charge = 0;
  burst(me.x, me.y, ICE_C, 30, 340 * U);
  gameSound("warp", me.x, me.y);
  chatter("Emergency jump \u2014 a long way from where you were, and the " +
          "scanner is cold.", ICE_C);
}

// The nearest decoy to a point, if one is close enough to be believed.
function decoyFor(x, y, reach) {
  if (!surv || !surv.decoys.length) return null;
  let best = null, bd = (reach || DECOY_HOLD) * U;
  for (const dc of surv.decoys) {
    const d = Math.hypot(dc.x - x, dc.y - y);
    if (d < bd) { bd = d; best = dc; }
  }
  return best;
}

/* A mine going off. It does not ask whose it is \u2014 everything inside the
   radius takes it, including the ship that laid it, which is the cost that
   stops a mine being a free turret you tow around behind you. */
function mineOff(i) {
  const mn = surv.mines[i];
  if (!mn) return;
  surv.mines.splice(i, 1);
  burst(mn.x, mn.y, "#ffcb42", 26, MINE_BOOM * U * 1.3);
  addShake(5);
  gameSound("boom", mn.x, mn.y);
  const R = MINE_BOOM * U;
  for (let j = surv.drones.length - 1; j >= 0; j--) {
    const d = surv.drones[j];
    if (Math.hypot(d.x - mn.x, d.y - mn.y) > R) continue;
    d.hp -= 3; d.hit = 0.12;
    if (d.hp <= 0) killDrone(j);
  }
  for (let j = surv.traffic.length - 1; j >= 0; j--) {
    const t = surv.traffic[j];
    if (Math.hypot(t.x - mn.x, t.y - mn.y) > R) continue;
    t.hp -= 3; t.hit = 0.12;
    /* Yours. A mine is something you left there on purpose, so what it kills
       is killed by you \u2014 reputation, grudges and all. */
    if (t.hp <= 0) killTraffic(j, true);
  }
  /* And rock. Gathered before any of it is hit, for the same reason the burst
     charge gathers first: breaking one removes it and pushes its pieces, and
     the pieces of a rock this mine just broke are not also inside the blast. */
  const caught = [];
  for (const r of rocks) {
    const d = Math.sqrt(gap2(mn.x, mn.y, r.x, r.y));
    if (d <= R + r.r) caught.push(r);
  }
  for (const r of caught) {
    if (!rocks.includes(r)) continue;
    hitRock(r, { x: mn.x, y: mn.y, vx: 0, vy: 0, dmg: 2, colour: "#ffcb42" });
  }
  const me = ships[0];
  if (mn.clear && me.alive && me.invuln <= 0 &&
      Math.hypot(me.x - mn.x, me.y - mn.y) < R) {
    damageShip(me, "mine", null);
  }
}

function surveyDevices(dt) {
  const me = ships[0];

  // Every cooldown, whatever is in the slot. A slot that stops being a device
  // takes its cooldown with it, so this is harmless on the others.
  for (const sl of surv.slots) {
    if (sl && sl.cd > 0) sl.cd = Math.max(0, sl.cd - dt);
  }

  /* Decoys. They drift, they burn for fourteen seconds, and gravity has them
     like it has everything else \u2014 a decoy dropped over a well goes down
     the well, which is a place not to drop one. */
  for (let i = surv.decoys.length - 1; i >= 0; i--) {
    const dc = surv.decoys[i];
    dc.life -= dt;
    dc.spin += dt * 5;
    applyGravity(dc, dt);
    dc.x += dc.vx * dt; dc.y += dc.vy * dt;
    dc.vx *= Math.exp(-0.5 * dt); dc.vy *= Math.exp(-0.5 * dt);
    if (dc.life <= 0 || hazardAt(dc.x, dc.y, 0)) {
      burst(dc.x, dc.y, "#ffe56d", 6, 110 * U);
      gameSound("fizz", dc.x, dc.y);
      surv.decoys.splice(i, 1);
    }
  }

  /* Mines. Armed on a delay, and then anything inside the blast sets one off:
     a sentry, a passing hauler, or you. */
  for (let i = surv.mines.length - 1; i >= 0; i--) {
    const mn = surv.mines[i];
    mn.life -= dt;
    mn.arm = Math.max(0, mn.arm - dt);
    mn.spin += dt * 2;
    applyGravity(mn, dt);
    mn.x += mn.vx * dt; mn.y += mn.vy * dt;
    mn.vx *= Math.exp(-0.8 * dt); mn.vy *= Math.exp(-0.8 * dt);
    if (mn.life <= 0 || hazardAt(mn.x, mn.y, 0)) {
      burst(mn.x, mn.y, WRECK, 4, 80 * U);
      gameSound("fizz", mn.x, mn.y);
      surv.mines.splice(i, 1);
      continue;
    }
    const trip = MINE_BOOM * 0.62 * U;
    // Out of its own radius once, and it stops being yours. See `clear`.
    if (!me.alive || Math.hypot(me.x - mn.x, me.y - mn.y) > trip * 1.15) {
      mn.clear = true;
    }
    if (mn.arm > 0) continue;
    let set = false;
    for (const d of surv.drones) {
      if (Math.hypot(d.x - mn.x, d.y - mn.y) < trip) { set = true; break; }
    }
    if (!set) {
      for (const t of surv.traffic) {
        if (Math.hypot(t.x - mn.x, t.y - mn.y) < trip) { set = true; break; }
      }
    }
    if (!set && mn.clear && me.alive && me.invuln <= 0 &&
        Math.hypot(me.x - mn.x, me.y - mn.y) < trip) set = true;
    if (set) mineOff(i);
  }
}

function surveyDrones(dt) {
  const me = ships[0];
  const hidden = !me.alive || cloaked(me);
  for (let i = surv.drones.length - 1; i >= 0; i--) {
    const d = surv.drones[i];
    d.hit = Math.max(0, d.hit - dt);
    if (d.bug && !(d.stun > 0)) { bugStep(d, i, dt); continue; }
    /* Stunned by a burst: it drifts, and it is not looking for anybody. It
       still falls into wells and still bounces off rock, because those happen
       *to* it rather than being things it is doing. See `empBurst`. */
    if (d.stun > 0) {
      d.stun = Math.max(0, d.stun - dt);
      d.awake = false;
      d.vx *= Math.exp(-0.6 * dt); d.vy *= Math.exp(-0.6 * dt);
      applyGravity(d, dt);
      d.x += d.vx * dt; d.y += d.vy * dt;
      solidBounce(d, 16 * U);
      continue;
    }
    const toMe = Math.hypot(me.x - d.x, me.y - d.y);
    const fromPost = Math.hypot(d.post.x - d.x, d.post.y - d.y);

    /* A post that is `quiet` does not wake for somebody in the building. It
       wakes when you come for the thing it is standing on — which for the
       Vault's core means down a spoke and inside the ring, and is the moment
       the visit stops being a look round and becomes a robbery.

       You are told once, before it happens, because a room full of guns that
       opens fire without warning is a trap and a room full of guns that says
       "not past here" is a decision. */
    const post = d.home && d.home.quiet;
    const wakeAt = post ? DRONE_WAKE * 0.42 : DRONE_WAKE;
    if (hidden) d.awake = false;
    else if (toMe < wakeAt * U) {
      if (post && !d.home.warned) {
        d.home.warned = true;
        chatter("Something in here just woke up. It does not want you any " +
                "closer.", "#ff8f77", { x: d.x, y: d.y });
      }
      d.awake = true;
    }
    if (d.awake && (toMe > DRONE_LEASH * U || fromPost > DRONE_LEASH * U)) {
      d.awake = false;
    }

    // Toward the player when awake, back to the post when not — or onto the
    // thing it is taking apart, which outranks both.
    const onPrey = d.prey && surv.traffic.includes(d.prey);
    /* Or onto a decoy, which outranks *you* and nothing else. A sentry already
       taking a freighter apart is busy with something real and is not fooled;
       one that is awake and coming for you is holding a picture of a hull, and
       the decoy is a better one. It cannot wake anything: `d.awake` is the
       test, so a decoy dropped over a sleeping post is a flare in an empty
       room. */
    const lure = !onPrey && d.awake ? decoyFor(d.x, d.y) : null;
    const gx = onPrey ? d.prey.x : lure ? lure.x : d.awake ? me.x : d.post.x;
    const gy = onPrey ? d.prey.y : lure ? lure.y : d.awake ? me.y : d.post.y;
    const gd = Math.hypot(gx - d.x, gy - d.y) || 1;
    const want = d.awake ? 520 * U : 0;      // stand off rather than ram
    if (gd > want) {
      const push = (d.awake ? 210 : 120) * U;
      d.vx += ((gx - d.x) / gd) * push * dt;
      d.vy += ((gy - d.y) / gd) * push * dt;
    } else {
      d.vx -= ((gx - d.x) / gd) * 90 * U * dt;
      d.vy -= ((gy - d.y) / gd) * 90 * U * dt;
    }
    d.vx *= Math.exp(-1.1 * dt); d.vy *= Math.exp(-1.1 * dt);
    // A well outpulls a sentry's little station-keeping thruster, and one that
    // reaches the middle is gone the same way anything else is. Nothing in the
    // sector gets to hover inside a black hole.
    applyGravity(d, dt);
    d.x += d.vx * dt; d.y += d.vy * dt;
    /* A sentry is solid to a world too. It has no heading of its own to turn,
       so it is put back on the surface and its velocity is taken with it —
       which reads as bumping into the thing and giving up on that direction. */
    if (solidBounce(d, 16 * U)) bounceOff(d, 1.2);
    if (hazardAt(d.x, d.y, 12 * U)) {
      burst(d.x, d.y, DRONE_COLOUR, 12, 180 * U);
      gameSound("boom", d.x, d.y);
      if (d.id) surv.deadGuards.add(d.id);
      surv.drones.splice(i, 1);
      continue;
    }
    /* A sentry posted on a distress call has something else to shoot at, and
       keeps shooting at it until it is gone. That is the whole scene: you can
       watch it happen from a long way off and decide whether to turn. */
    const prey = d.prey && surv.traffic.includes(d.prey) ? d.prey : null;
    if (prey) { d.prey = prey; } else if (d.prey) { d.prey = null; }
    const at = prey || lure || me;
    d.a = Math.atan2(at.y - d.y, at.x - d.x);

    d.cool -= dt;
    const toTarget = prey || lure
      ? Math.hypot(at.x - d.x, at.y - d.y) : toMe;
    if ((prey || lure || (d.awake && me.alive)) && d.cool <= 0 &&
        toTarget < 1000 * U) {
      d.cool = rand(1.1, 1.9);
      const sp = 420 * U;
      surv.shots.push({ x: d.x + Math.cos(d.a) * 20 * U,
                        y: d.y + Math.sin(d.a) * 20 * U,
                        vx: Math.cos(d.a) * sp, vy: Math.sin(d.a) * sp,
                        life: 2.4,
                        // Aimed at a freighter or at a decoy, not at you: it
                        // must not clip the player on its way past.
                        atPrey: !!(prey || lure) });
      gameSound("laser", d.x, d.y);
    }

    // Ramming a sentry hurts you both.
    if (me.alive && dist2(me.x, me.y, d.x, d.y) < (shipRadius() + 16 * U) ** 2) {
      strike(me, d.x, d.y, 16 * U, true);
      killDrone(i);
    }
  }
}

function killDrone(i) {
  const d = surv.drones[i];
  burst(d.x, d.y, DRONE_COLOUR, 14, 200 * U);
  gameSound("boom", d.x, d.y);
  dropMote(d.x, d.y, YIELD.drone, 40, "drone");
  // Remembered for as long as its chunk stays loaded, or the next re-stream
  // would put it straight back on its post with a full hull.
  if (d.id) surv.deadGuards.add(d.id);
  surv.drones.splice(i, 1);
}

function surveyShots(dt) {
  const me = ships[0];
  const R = shipRadius();
  for (let i = surv.shots.length - 1; i >= 0; i--) {
    const b = surv.shots[i];
    /* A missile turns after its target, and loses it to a cloak or a decoy
       like any other seeker does. */
    if (b.seek && b.target) {
      let aimAt = b.target;
      if (b.target === me && (!me.alive || cloaked(me))) b.target = aimAt = null;
      const fake = aimAt === me ? decoyFor(b.x, b.y) : null;
      if (fake) aimAt = fake;
      if (aimAt) {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        let have = Math.atan2(b.vy, b.vx);
        let off = Math.atan2(aimAt.y - b.y, aimAt.x - b.x) - have;
        while (off > Math.PI) off -= Math.PI * 2;
        while (off < -Math.PI) off += Math.PI * 2;
        have += Math.max(-b.seek * dt, Math.min(b.seek * dt, off));
        b.vx = Math.cos(have) * sp; b.vy = Math.sin(have) * sp;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) { surv.shots.splice(i, 1); continue; }

    /* ── somebody else's rounds hit rock too ──────────────────────────────
       They did not. Every round fired by anything out here passed straight
       through every asteroid in the sector, which is the same class of mistake
       as a ship you could fly through: a sector where only *your* bullets are
       real is a sector where nothing anyone else does is happening in the same
       world you are in.

       It matters more than it sounds, because it is also cover. A rock between
       you and a patrol is a thing you can put there on purpose — and it was
       worth nothing at all while their fire ignored it. */
    let stopped = false;
    for (let k = rocks.length - 1; k >= 0; k--) {
      const rk = rocks[k];
      if (dist2(b.x, b.y, rk.x, rk.y) > rk.r * rk.r) continue;
      surv.shots.splice(i, 1);
      hitRock(rk, b);
      stopped = true;
      break;
    }
    if (stopped) continue;
    /* A patrol's rounds go the other way. They are in the same list because
       they are the same object and the same drawing; the only difference is
       who they are allowed to hit — and a neutral whose fire could clip you
       would stop being a neutral the first time it did. */
    if (b.friendly) {
      let spent = false;
      /* **A stray round is a real round.** Somebody else's fire used to pass
         straight through you: it was flagged friendly, friendly meant "cannot
         touch the player", and the practical effect was that a fleet action was
         a firework display you could park inside. Standing in a war is
         dangerous — that is 6.3's rule, the same one that lets their rounds
         break rock and kill each other — so it hits you too.

         It does not make the shooter your enemy. Nobody aimed at you; you were
         in the way, which is a different thing and must not cost them their
         standing with you. */
      if (me.alive && me.invuln <= 0 && b.from !== me &&
          dist2(b.x, b.y, me.x, me.y) < R * R) {
        surv.shots.splice(i, 1);
        damageShip(me, "shot", null, b.dmg || 1);
        continue;
      }
      for (let k = surv.drones.length - 1; k >= 0 && !spent; k--) {
        const d = surv.drones[k];
        if (dist2(b.x, b.y, d.x, d.y) > (18 * U) ** 2) continue;
        spent = true;
        surv.shots.splice(i, 1);
        d.hp -= b.dmg || 1;
        d.hit = 0.12;
        d.awake = true;
        burst(b.x, b.y, DRONE_COLOUR, 5, 120 * U);
        if (d.hp <= 0) killDrone(k); else gameSound("hit", d.x, d.y);
      }
      /* And it can hit somebody else's ship, which is what makes the war
         visible: hulls actually come apart out there without you. */
      for (let k = surv.traffic.length - 1; k >= 0 && !spent; k--) {
        const o = surv.traffic[k];
        if (o === b.from) continue;     // a ship does not shoot itself in the nose
        const rr = hullR(o);
        if (dist2(b.x, b.y, o.x, o.y) > rr * rr) continue;
        spent = true;
        surv.shots.splice(i, 1);
        takeHit(o, b.dmg || 1);
        /* And it turns on whoever did it. Rounds between two other ships used
           to take hull off and change nothing else — so a raider being shot
           at by a patrol carried on flying at *you* while it was taken apart,
           which is the loudest possible way of saying nothing out here is
           paying attention to anything but the player. A hull that is being
           hit has a more urgent problem than you. */
        hurtBySomebody(o, b.from);
        burst(b.x, b.y, trafficColour(o), 5, 120 * U);
        if (o.hp <= 0) killTraffic(k, false); else gameSound("hit", o.x, o.y);
      }
      continue;
    }
    /* A decoy eats what is fired at it. It is a hull as far as everything
       out here is concerned, and a round passing through the thing it was
       aimed at would be the same "not quite real" complaint the rest of the
       sector has already had answered. Each hit costs it two of its fourteen
       seconds, so a decoy in a kondrite does not last its full life \u2014
       which is the right way round. */
    let ate = false;
    for (let k = surv.decoys.length - 1; k >= 0; k--) {
      const dc = surv.decoys[k];
      if (dist2(b.x, b.y, dc.x, dc.y) > (20 * U) ** 2) continue;
      surv.shots.splice(i, 1);
      dc.life -= 2;
      burst(b.x, b.y, "#ffe56d", 4, 110 * U);
      gameSound("hit", b.x, b.y);
      ate = true;
      break;
    }
    if (ate) continue;
    /* And a round aimed at you hits whatever is in the way first. They went
       through every other ship in the sector, so a patrol's escort was
       perfect cover for nobody and a hauler parked between you and a pirate
       was a hauler the pirate could shoot through. */
    if (b.atPrey) continue;      // meant for the freighter, and its clock does that
    let struck = false;
    for (let k = surv.traffic.length - 1; k >= 0; k--) {
      const o = surv.traffic[k];
      if (o === b.from) continue;
      /* Not the shooter's own side. Aimed fire goes past a wingmate, the way
         a ship holds fire when one is in the line: an admiral's escorts were
         clipping the admiral on every pass and keeping its screen down. */
      if (b.from && o.faction === b.from.faction) continue;
      const rr = hullR(o);
      if (dist2(b.x, b.y, o.x, o.y) > rr * rr) continue;
      surv.shots.splice(i, 1);
      takeHit(o, b.dmg || 1);
      hurtBySomebody(o, b.from);
      burst(b.x, b.y, trafficColour(o), 5, 120 * U);
      if (o.hp <= 0) killTraffic(k, false); else gameSound("hit", o.x, o.y);
      struck = true;
      break;
    }
    if (struck) continue;
    if (me.alive && me.invuln <= 0 && dist2(b.x, b.y, me.x, me.y) < R * R) {
      surv.shots.splice(i, 1);
      damageShip(me, "shot", null, b.dmg || 1);
    }
  }
}

/* ── caches ───────────────────────────────────────────────────────────────
   Sealed while anything is guarding them. That is the whole reason the guards
   are there: a cache you can dash past is a pickup with decoration around it,
   and a cache that needs the post cleared is somewhere you decide whether to
   go. Opening one is also the only place in the mode a powerup drops. */
function surveyCaches(dt) {
  const me = ships[0];
  if (!me.alive) return;
  for (let i = surv.caches.length - 1; i >= 0; i--) {
    const c = surv.caches[i];
    c.sealed = surv.drones.some(d => d.home === c);
    if (c.sealed) continue;
    if (dist2(me.x, me.y, c.x, c.y) > (c.r + shipRadius()) ** 2) continue;

    /* What is inside, decided once and remembered on the cache, so the answer
       cannot change between one frame and the next while you are sitting on
       top of it deciding whether to make room. */
    if (c.part === undefined) {
      const roll = cachePart(depthAt(c.x, c.y), !!c.rich);
      c.part = roll ? roll.key : null;
    }
    /* And the refusal comes *before* the cache opens rather than after. A part
       in here is the only part in the game nobody sells, so a full hold must
       not open it, spill its salvage and drop the one thing worth the flight.
       Said once, because this runs every frame you are touching it. */
    if (c.part && !roomForPart(c.part)) {
      if (!c.said) {
        c.said = true;
        chatter(moduleSpec(c.part).name + " is in there and the hold is " +
                "full. It keeps \u2014 come back with room.", "#ff8f77");
        gameSound("hit");
      }
      continue;
    }

    const worth = c.rich ? YIELD.cache * 2 : YIELD.cache;
    burst(c.x, c.y, CASH, 26, 260 * U);
    gameSound("win", c.x, c.y);
    addShake(5);
    dropMote(c.x, c.y, worth, 90, "cache");
    spawnPickup(c.x, c.y, PICKUP_KINDS[Math.floor(Math.random() * PICKUP_KINDS.length)]);
    /* And sometimes a part. This is the only way the find-only ones exist —
       the beam, the warp tuner, running dark — so a sealed hold a long way out
       is the difference between a ship that can do things and one that cannot.
       It goes straight into storage rather than onto the floor: you opened it,
       it is yours, and fishing a part out of a cloud of its own salvage would
       be a worse moment than being told. */
    if (c.part) {
      storeAdd(c.part, 1);
      chatter(moduleSpec(c.part).name +
              " \u2014 in the hold, and nobody sells these.", "#a08cff");
    }
    surv.opened.add(c.id || ("lev" + i));
    surv.caches.splice(i, 1);
    surv.t.looted = true;
    chatter(c.rich ? "The deep hold — it was worth the flight" : "Cache open",
            CASH);
    saveSurveyBook();
  }
}

/* ── stations ─────────────────────────────────────────────────────────────
   Somewhere for the salvage to go. Docking is proximity plus a keypress
   rather than proximity alone: a shop that opens itself every time you fly
   past is a shop you learn to avoid. */
function surveyStations() {
  const me = ships[0];
  const wasDocked = surv.docked;
  surv.docked = null;
  surv.landed = null;
  surv.overAir = null;
  if (!me.alive) return;
  for (const st of surv.stations) {
    if (dist2(me.x, me.y, st.x, st.y) < SURVEY_DOCK * SURVEY_DOCK) {
      surv.docked = st;
      // A station fits parts instantly, so coming in mid-fit lands it rather
      // than leaving you sitting in the shop waiting for your own slot.
      stationFinishesFits();
      break;
    }
  }
  /* Arriving is the moment the shelf is read, not every frame you sit on it —
     this whole block runs per frame and clears `docked` at the top, so without
     the comparison this would be a set rebuilt sixty times a second. */
  if (surv.docked && surv.docked !== wasDocked) {
    let news = false;
    for (const m of MODULES) {
      if (sellsIt(m) && m.deep <= stationDepth() && markSeen(m.key)) news = true;
    }
    // Written once, for the whole shelf.
    if (news) saveSurveyBook();
  }

  /* ── worlds you can put down on ─────────────────────────────────────────
     Two different things a planet can offer, and a world can be either, both
     or neither:

       inhabited   somebody lives here and will sell you water and food. This
                   is the supply line, and it is thin in the deep on purpose.
       air         there is an atmosphere to fly through, and it can be skimmed
                   for water — slowly, and for nothing. The poor pilot's
                   option, which costs time instead of money.

     "Close to" a world means just above its surface, measured off the radius,
     because a world is 340 to 3,600 units across and a fixed docking distance
     would mean standing on one and being nowhere near another. */
  for (const pl of surv.planets) {
    const d2 = dist2(me.x, me.y, pl.x, pl.y);
    const skin = (pl.r + PLANET_DOCK) ** 2;
    if (d2 > skin) continue;
    if (pl.inhabited && !surv.landed) surv.landed = pl;
    if (pl.air && !surv.overAir) surv.overAir = pl;
  }

  /* And anybody drifting close enough to hand water across to. Nearest rather
     than first: two dead haulers in one piece of sky is exactly the situation
     this produces, and you should be helping the one you are next to. */
  surv.helping = null;
  let hd = HELP_NEAR * HELP_NEAR;
  for (const t of surv.traffic) {
    if (!t.adrift) continue;
    const d2 = dist2(me.x, me.y, t.x, t.y);
    if (d2 < hd) { hd = d2; surv.helping = t; }
  }
}

/* ── remembering ──────────────────────────────────────────────────────────
   6.5, and the rule it is built on: *a consequence you can name is a consequence
   you remember.* A rescued freighter that becomes an anonymous freighter again
   is a thank-you and a despawn — it happened to nobody. So the two kinds of
   thing that ought to leave a mark leave one, and both of them come back.

   **A ship you saved keeps its name.** It gets one at the moment you save it,
   it is written into the book, and a later freighter of the same flag can *be*
   it — tagged rather than spawned, because a chunk is a pure function of its
   coordinates and has no business knowing whose distress call you answered.
   When it passes you it says so. And once, if it finds you nearly dry, it hands
   water back — which is the only repayment that matters in a mode where water is
   the thing that limits how far you can go. It cannot be farmed: it happens once
   per ship and only when you are under a quarter of a tank.

   **A pirate that got away comes back for you.** Hurt one and let it out of
   range and it is written down with its name and the damage you did. It returns
   as a hunter — not a fresh pirate of the same class, *that one*, with the hull
   it had and the hull points it had left — and it says what it is there for. */
const FRIEND_KEEP = 12;
const GRUDGE_KEEP = 6;

function rememberFriend(t, why) {
  if (!t.name) t.name = shipName(false);
  if (surv.friends.some(f => f.name === t.name)) return;
  surv.friends.push({ name: t.name, faction: t.faction,
                      hull: t.hull, why: why || "saved", repaid: false });
  livingRescue(t);
  if (surv.friends.length > FRIEND_KEEP) surv.friends.shift();
}

function rememberGrudge(t) {
  if (!t.name) t.name = shipName(true);
  if (surv.grudges.some(g => g.name === t.name)) return;
  surv.grudges.push({ name: t.name, hull: t.hull,
                      hp: Math.max(1, Math.round(t.hp)),
                      // Long enough that it is not the next thing that happens.
                      cool: rand(90, 260) });
  if (surv.grudges.length > GRUDGE_KEEP) surv.grudges.shift();
  // And whoever holds this sky puts a price on the name (living.js, §28).
  livingBounty(t);
  saveSurveyBook();
}

/* Whether a freighter streaming in *is* one of the ships you saved. One in
   four of the ones that match the flag, at most one friend on the screen at a
   time — the point is a face you recognise, and three of them at once is a
   cast. */
function adoptFriend(t) {
  if (t.name || t.friend) return;
  if (t.role !== "freight" && t.role !== "trader") return;
  if (surv.traffic.some(o => o.friend)) return;
  if (Math.random() > 0.25) return;
  const pick = surv.friends.filter(f => f.faction === t.faction);
  if (!pick.length) return;
  const f = pick[Math.floor(Math.random() * pick.length)];
  t.friend = f;
  t.name = f.name;
}

/* What a ship you saved does when it meets you again. It says your name is
   worth something to it, and it pays the favour back in the one currency this
   mode is short of — once, and only if you actually need it. */
const REPAY_WATER = 240;
function friendMeeting(t, near) {
  if (!t.friend) return;
  if (!t.greeted && near < TRAFFIC_TALK) {
    t.greeted = true;
    chatter(t.name + " — they know you. " +
            (t.friend.why === "water" ? "You gave them water once."
                                      : "You got them out of trouble once."),
            CASH);
  }
  if (!t.friend.repaid && near < 700 * U && surv.water < WATER_FULL * 0.25) {
    t.friend.repaid = true;
    surv.water = Math.min(WATER_FULL, surv.water + REPAY_WATER);
    chatter(t.name + " — they saw your tank. Water across, and they are " +
            "square with you.", ICE_C);
    gameSound("win", t.x, t.y);
    saveSurveyBook();
  }
}

/* And the one that got away, coming back. Spawned rather than generated, for
   the same reason the hunters are: the chunk does not know what you did. */
function grudgeVisit(dt) {
  const me = ships[0];
  if (!surv.grudges.length || !me.alive || surv.death) return;
  if (surv.traffic.some(t => t.grudge)) return;
  const g = surv.grudges[0];
  g.cool -= dt;
  if (g.cool > 0) return;
  surv.grudges.shift();
  let a = Math.random() * Math.PI * 2, d = 2400 + Math.random() * 1200;
  for (let t = 0; t < 8; t++) {
    if (!inBuilt(me.x + Math.cos(a) * d, me.y + Math.sin(a) * d, 260)) break;
    a = Math.random() * Math.PI * 2;
    d = 2400 + Math.random() * 1200;
  }
  surv.traffic.push({
    id: null, kind: "hunter", role: "hunter", faction: "pirate",
    hull: g.hull, name: g.name, grudge: true,
    x: me.x + Math.cos(a) * d, y: me.y + Math.sin(a) * d, a: a + Math.PI,
    from: { x: me.x, y: me.y }, to: { x: me.x, y: me.y }, leg: 1,
    /* The hull points it got away with, and no more. It ran because it was
       losing, and it has not been anywhere to get that back — which means the
       rematch is one you are favoured to win and it is coming anyway. */
    speed: MAX_SPEED * shipSpec(g.hull).speed * 0.78,
    hp: g.hp, maxHp: Math.max(g.hp, shipSpec(g.hull).hull),
    cargo: [], cool: 1.2, doom: 0, guards: 0, space: 0, trades: false,
    phase: Math.random() * 6.28, angry: true
  });
  chatter(g.name + " — the one that got away. It found you.", "#ff8f77");
  gameSound("alarm", me.x, me.y);
  saveSurveyBook();
}
