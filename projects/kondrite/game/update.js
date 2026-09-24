"use strict";

/* KONDRITE — UPDATE
   ─────────────────────────────────────────────────────────────────────────────
   One step of the simulation.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── update ──────────────────────────────────────────────────────────── */
function update(dt) {
  clock += dt;
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (terminated) { terminated.t -= dt; if (terminated.t <= 0) terminated = null; }
  killFeed = killFeed.filter(e => e.until > clock);
  updateWall(dt);
  updateMotes(dt);

  /* The stock radius. Everything that is the same for every ship still reads
     this; anything that depends on *which* hull is flying reads `hullR`
     below. */
  const shipR = SHIP_R * U;

  for (const ship of ships) {
    if (ship.dead) continue;
    /* ── how big this hull actually is ──────────────────────────────────
       `shipR` is the stock twelve units and takes no account of what you are
       flying, which was harmless while every mode flew one triangle and quietly
       wrong from the moment Survey started drawing twenty-five hulls at up to
       three and a half times that. A Tender is drawn seven times wider than the
       circle that was stopping it, so rocks went straight through the visible
       hull — Ric: "i can fly though astroids" — and the exhaust came out a
       quarter of the way back from the nose instead of off the tail.

       One number, read by the rock collision and by both thrusters, so the
       shape that stops you and the place the fire comes out are the same hull
       the rest of the game is drawing. Every other mode has `sizeMul` of one,
       so nothing outside Survey moves an inch. */
    const hullR = shipR * (ship.sizeMul || 1);

    if (!ship.alive) {
      ship.respawn -= dt;
      /* No waiting and no forcing. This used to retry until a spot was clear
         and then, after three seconds, drop the ship wherever the search had
         got to — which is how you ended up inside an asteroid. `respawnPoint`
         now guarantees a legal spot and clears rocks out of it if it has to,
         so there is nothing left to wait for. */
      if (ship.respawn <= 0) {
        const p = respawnPoint(ship);
        ship.x = p.x;
        ship.y = p.y;
        ship.vx = ship.vy = 0;
        ship.a = p.a;
        ship.alive = true;
        ship.hull = ship.maxHull;
        ship.invuln = INVULN;
      }
      continue;
    }

    ship.invuln = Math.max(0, ship.invuln - dt);
    ship.cool = Math.max(0, ship.cool - dt);
    if (ship.buffRapid > 0) ship.buffRapid = Math.max(0, ship.buffRapid - dt);
    if (ship.buffHeavy > 0) ship.buffHeavy = Math.max(0, ship.buffHeavy - dt);

    // The convoy transport is kinematic: it turns toward its planet and moves
    // at a fixed cruise speed, ignoring thrust, drag and gravity, so it crosses
    // the map at a rate the escort can plan around and no well can drag it in.
    if (mode.campaign && ship.kinematic) {
      const ang = Math.atan2(ship.goalY - ship.y, ship.goalX - ship.x);
      let d = ang - ship.a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      ship.a += Math.max(-TURN * dt, Math.min(TURN * dt, d));
      ship.vx = Math.cos(ship.a) * ship.cruise;
      ship.vy = Math.sin(ship.a) * ship.cruise;
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      ship.thrusting = true;
      continue;
    }

    const k = ship.input;
    /* Barely any steering while the light drive is running. It is a commitment
       by design — the whole trade is that you cover an enormous distance and
       give up the ability to react while you do — but locking the nose solid
       would mean the five-second impact warning was information you could do
       nothing with, and a warning you cannot act on is decoration. */
    /* `bite` is how much of the turn is left at this hull's own top speed.
       One everywhere but the commuters, so every other ship turns exactly as
       it always did; on a commuter it falls off with the throttle, which is
       the half of "slow and civil" that acceleration cannot say on its own —
       they are fine to place at a dock and a handful on the open run. */
    const ordinaryTop = MAX_SPEED * (ship.speedMul || 1) * U;
    const howFast = ordinaryTop > 0
      ? Math.min(1, Math.hypot(ship.vx, ship.vy) / ordinaryTop) : 0;
    const bite = ship.bite == null ? 1 : ship.bite;
    const turn = TURN * (ship.turnMul || 1) * (1 - (1 - bite) * howFast) *
                 (lightDriveOn() ? LIGHT_TURN : 1);
    if (k.l) ship.a -= turn * dt;
    if (k.r) ship.a += turn * dt;

    /* Reverse thrust: weaker than the engine and pointed the other way, so
       it is a way out of somewhere rather than a second gear. It cannot be
       used with the light drive on, which is not a manoeuvre. */
    if (k.rev && !k.th && !lightDriveOn()) {
      const back = THRUST * (ship.thrustMul || 1) * REVERSE_THRUST * U * dt;
      ship.vx -= Math.cos(ship.a) * back;
      ship.vy -= Math.sin(ship.a) * back;
      if (Math.random() < 0.5) {
        // And reverse thrust comes out of the nose, for the same reason.
        const front = (ship.spec ? ship.spec.noseX : 12) * (hullR / 12);
        burst(ship.x + Math.cos(ship.a) * front,
              ship.y + Math.sin(ship.a) * front, "#87d8ff", 1, 44 * U);
      }
    }

    /* The drive winds up and winds down. `spool` is nought on all but the
       commuters and the haulers, so every other hull gets full thrust on the
       first frame exactly as it always did — and `spun` falls twice as fast as
       it climbs, because an engine you have shut off does not take three
       seconds to stop pushing. */
    const spool = ship.spool || 0;
    if (spool > 0) {
      ship.spun = k.th
        ? Math.min(1, (ship.spun || 0) + dt / spool)
        : Math.max(0, (ship.spun || 0) - dt / spool * 2);
    } else {
      ship.spun = k.th ? 1 : 0;
    }
    // The jaws shut on their own. See `swingClaw`.
    if (ship.clawT > 0) ship.clawT = Math.max(0, ship.clawT - dt);
    ship.thrusting = k.th;
    if (ship.thrusting) {
      // `thrustMul` is 1 everywhere but a refitted Survey ship, so every
      // other mode accelerates exactly as it always did.
      const wind = spool > 0 ? ship.spun : 1;
      ship.vx += Math.cos(ship.a) * THRUST * (ship.thrustMul || 1) * wind * U * dt;
      ship.vy += Math.sin(ship.a) * THRUST * (ship.thrustMul || 1) * wind * U * dt;
      if (Math.random() < 0.7) {
        // Out of this hull's own tail. See `tailX`.
        const back = (ship.spec ? ship.spec.tailX : -12) * (hullR / 12);
        burst(ship.x + Math.cos(ship.a) * back,
              ship.y + Math.sin(ship.a) * back, "#ffcb42", 1, 60 * U);
      }
    }

    // Capitals and structures are too massive for the wells to move; only
    // fighters get pulled (and dodge). Everywhere but the campaign, every ship
    // is a fighter, so this is the same call it always was.
    const pull = (mode.campaign && ship.radius) ? 0 : applyGravity(ship, dt);

    /* ── being thrown, and keeping it ────────────────────────────────────
       Two things are allowed past your engine's top speed, and for the same
       reason: neither of them is your engine. Gravity throws you, and the light
       drive carries you.

       What used to happen next was the bug. The ordinary limit came back the
       instant a well's pull fell below one, and the excess was taken away in a
       single frame — so a slingshot round a star gave you speed right up until
       you cleared the rim, and then confiscated it. Momentum arrived and left
       again in the same second, which made the one genuinely clever thing you
       can do with a gravity well worth nothing at all.

       So above your own top speed the ship is *coasting*, and coasting bleeds
       slowly: the engine's drag is what an engine fights, and nothing you were
       thrown by is your engine. The excess decays over several seconds instead
       of over one frame, which is long enough to be worth aiming for and short
       enough that you are not permanently faster than the game. The hard
       ceiling stays, far above the ordinary limit, so a deep well still cannot
       accelerate you without bound. */
    const ordinary = MAX_SPEED * (ship.speedMul || 1) * U;
    const runningLight = mode.survey && surv && surv.lightRun > 0 &&
                         ship === ships[0];
    const before = Math.hypot(ship.vx, ship.vy);

    /* `boost` is how much speed above your own limit you are currently allowed
       to be carrying, and it is the whole of the fix. Gravity raises it; it
       decays on its own; your engine can never add to it.

       Two wrong versions came before this one and both are worth writing down.
       The first raised the ceiling for every ship in Survey, which quietly gave
       the mode four times its stated top speed — full burn ran to 1,138 against
       a MAX_SPEED of 360 and nothing anywhere said so. The second raised it
       whenever the ship was already above the limit, which latches: thrust
       pushes you over, being over raises the ceiling, the higher ceiling lets
       thrust push you further. An allowance that only gravity can grant and
       only time can spend cannot do either. */
    if (mode.survey && !runningLight) {
      ship.boost = Math.max(0, (ship.boost || 0) * Math.exp(-COAST_DRAG * dt));
      const excess = before - ordinary;
      if (pull > 0.05 && excess > ship.boost) {
        ship.boost = Math.min(excess, ordinary * (THROWN_CEILING - 1));
      }
    } else if (!mode.survey) {
      ship.boost = 0;
    }

    /* Coasting above your own limit bleeds gently: the engine's drag is what an
       engine fights, and nothing you were thrown by is your engine. Below it,
       the ordinary drag the whole game is built on. */
    const coasting = before > ordinary * 1.01 && !runningLight;
    const hullDrag = ship.drag == null ? DRAG : ship.drag;
    const damp = Math.exp(-(coasting ? COAST_DRAG : hullDrag) * dt);
    ship.vx *= damp; ship.vy *= damp;

    const sp = Math.hypot(ship.vx, ship.vy);
    const max = runningLight ? ordinary * (LIGHT_MULT + 0.5)
              : mode.survey ? ordinary + (ship.boost || 0)
              : ordinary * (pull > 1 ? 1.9 : 1);
    if (sp > max) { ship.vx *= max / sp; ship.vy *= max / sp; }

    ship.x += ship.vx * dt; ship.y += ship.vy * dt;
    // Survey has no edges to bounce off, so the wall is skipped rather than
    // moved far enough away to be unreachable.
    if (!mode.survey) edgeOf(ship, shipR, WALL_BOUNCE);

    const swallowed = hazardAt(ship.x, ship.y, hullR * 0.6);
    if (swallowed && ship.invuln <= 0) {
      // The core of a well still kills in Survey — it just costs the trip
      // back rather than the run, so the risk stays real and the punishment
      // does not end anything.
      // A well does not chip you. Phase 1 gave supermassive wells a warning
      // with room to act in precisely so that this could be fatal and fair.
      if (mode.survey) { surveyDie(swallowed.kind === "hole" ? "hole" : "star");
                         continue; }
      killShip(ship, swallowed.kind === "hole" ? "hole" : "star", null);
      if (!worldRunning()) return;
      continue;
    }

    /* Whatever is bolted on, on the same trigger as the cannon. It runs before
       the cannon's own logic and independently of it — the burst counter and
       the magazine cap belong to the cannon and a launcher is not one. */
    fireWeapons(ship, dt, !!k.f);

    if (mode.campaign && ship.human && DIFFICULTY[campaignDifficulty].autoFire) {
      // On Easy the campaign pilot fires continuously — hold the trigger for a
      // steady stream, no burst and no recovery pause, only the round-in-the-air
      // cap. Hard and Impossible fall through to the three-round burst below.
      if (k.f && ship.cool <= 0) {
        if (fire(ship)) {
          ship.cool = CAMPAIGN_FIRE_GAP * (ship.buffRapid > 0 ? 0.5 : 1);
        } else {
          ship.cool = 0.05;   // magazine full — retry as soon as one expires
        }
      }
    } else {
      if (k.f && ship.burstLeft === 0 && ship.cool <= 0) {
        // The hull's, not the game's. See `applyRefit`.
        ship.burstLeft = ship.burstSize || BURST_SIZE;
      }
      if (ship.burstLeft > 0 && ship.cool <= 0) {
        if (fire(ship)) {
          ship.burstLeft--;
          const rapid = ship.buffRapid > 0 ? 0.45 : 1;
          // A hull's rate of fire divides the gap: a Jackal spits and a
          // Granary takes its time, and neither is a different weapon.
          ship.cool = (ship.burstLeft > 0 ? BURST_GAP : FIRE_GAP) * rapid /
                      (ship.rateMul || 1);
        } else {
          // Keep the burst queued until one of this ship's old rounds expires.
          ship.cool = BURST_GAP;
        }
      }
    }
  }

  // Ships bounce off each other rather than dying — even in battle royale,
  // ramming is a nuisance, not a weapon. All pairs, so this works for five.
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i], b = ships[j];
      if (!a.alive || !b.alive) continue;
      if (gap2(a.x, a.y, b.x, b.y) >= (shipR * 2) ** 2) continue;
      let dx = sepX(a.x, b.x), dy = sepY(a.y, b.y);
      let d = Math.hypot(dx, dy);
      if (d < 0.001) {
        // Exactly superimposed: there's no direction to push along, so pick
        // one. Without this they'd sit locked inside each other for good.
        const t = rand(0, Math.PI * 2);
        dx = Math.cos(t); dy = Math.sin(t); d = 1;
      }
      const nx = dx / d, ny = dy / d, push = 90 * U;
      // Capital ships have too much mass to shove: a fighter bounces off the
      // hull, the hull does not move. In every other mode all ships are
      // fighters, so this is the same all-pairs bounce it always was.
      if (a.kind === "fighter") { a.vx += nx * push; a.vy += ny * push; }
      if (b.kind === "fighter") { b.vx -= nx * push; b.vy -= ny * push; }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    applyGravity(b, dt);
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;

    // Walls eat bullets, so behind a wall is cover. Where the edges lead
    // back round there is no cover and no safe angle: a shot goes round and
    // is still yours when it comes back, until it simply runs out of life.
    if (mode.wrap) {
      if (b.life <= 0) { if (b.boom) explode(b); bullets.splice(i, 1); continue; }
      wrapInBounds(b);
    }

    /* Rock, hull and world all stop a round. Tested after the step rather than
       before it, so a round fired point-blank at a wall still leaves the nose
       — and swept along its own travel rather than at its new position alone,
       because a fast round covers more than a wall's thickness in one frame
       and would otherwise pass through it without ever being inside it. */
    if (mode.survey) {
      const sp = Math.hypot(b.vx, b.vy) * dt;
      const steps = Math.max(1, Math.min(6, Math.ceil(sp / 90)));
      let struck = null;
      for (let k = 1; k <= steps && !struck; k++) {
        const f = k / steps;
        struck = solidHit(b.x - b.vx * dt * (1 - f), b.y - b.vy * dt * (1 - f));
      }
      if (struck) {
        burst(struck.x, struck.y, b.colour, 3, 90 * U);
        gameSound("tink", struck.x, struck.y);
        // A dead hull is a target as well as cover. See `solidHit`.
        if (struck.hulk && b.owner === ships[0].id) hitHulk(struck.hulk, struck.at, b);
        if (b.boom) { b.x = struck.x; b.y = struck.y; explode(b); }
        bullets.splice(i, 1);
        continue;
      }
    }

    if (mode.wrap) {
      // handled above
    } else if (b.life <= 0 ||
               b.x < bounds.x0 || b.x > bounds.x1 ||
               b.y < bounds.y0 || b.y > bounds.y1) {
      if (b.life > 0) { burst(b.x, b.y, b.colour, 2, 70 * U); gameSound("tink", b.x, b.y); }
      /* A charge that reaches the end of its run still goes off. That is what a
         charge is, and it means a round fired at nothing is a round you can
         still place — which is most of what makes it worth a slot. */
      else if (b.boom) explode(b);
      bullets.splice(i, 1);
      continue;
    }

    // So do stars and black holes.
    if (hazardAt(b.x, b.y, 0)) {
      burst(b.x, b.y, b.colour, 3, 90 * U);
      gameSound("fizz", b.x, b.y);
      bullets.splice(i, 1);
      continue;
    }

    // A seeker turns while it flies; nothing else does.
    if (b.seek) steerSeeker(b, dt);

    let spent = false;

    /* Swept along the round's travel, the same way the world and the hulks
       already were. A point sample at the new position was fine while the
       fastest round in the game moved eight units a frame; a Jackal's round
       now covers twenty-four, and a small asteroid is sixteen across — so the
       round stepped clean over it and the rock simply did not have a hitbox
       any more. Ric found it from the cockpit. The sweep is capped at six
       samples, like the solid one, because a round that needs more than six
       is a round nothing in this game fires. */
    const bStep = Math.hypot(b.vx, b.vy) * dt;
    const bSteps = Math.max(1, Math.min(6, Math.ceil(bStep / 12)));
    for (const r of rocks) {
      let onIt = false;
      for (let k = 1; k <= bSteps && !onIt; k++) {
        const f = 1 - k / bSteps;
        onIt = gap2(b.x - b.vx * dt * f, b.y - b.vy * dt * f, r.x, r.y) <
               r.r * r.r;
      }
      if (onIt) { hitRock(r, b); spent = true; break; }
    }

    if (!spent) {
      for (const s of ships) {
        if (!s.alive || s.invuln > 0 || !canHit(b.owner, s)) continue;
        if (gap2(b.x, b.y, s.x, s.y) < ((s.radius || shipR) + 2) ** 2) {
          damageShip(s, mode.pvp ? "shot" : "ff", ships[b.owner], b.dmg || 1);
          if (!worldRunning()) return;
          spent = true;
          break;
        }
      }
    }

    if (spent) {
      /* Two reasons a round might not be finished with. A burst charge goes off
         where it stopped and takes the neighbours; a lance keeps going, minus a
         punch, until it has been through everything it is good for. */
      if (b.boom) explode(b);
      if (b.punch > 1) { b.punch--; continue; }
      bullets.splice(i, 1);
    }
  }

  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i];
    r.flash = Math.max(0, r.flash - dt);
    applyGravity(r, dt);
    r.x += r.vx * dt; r.y += r.vy * dt;
    r.a += r.spin * dt;
    // The moving wall removes rocks after passing them; it never changes
    // their velocity or sweeps them into the shrinking arena. In Survey a
    // rock simply drifts, and `streamRocks` collects the ones that drift out
    // of range.
    if (!mode.survey && (!mode.closing || clock <= CLOSE_DELAY)) {
      edgeOf(r, r.r, ROCK_BOUNCE);
    }
    /* A rock that reaches a well comes apart in it. It used to simply be
       deleted, which meant the one thing in the sector that visibly *does*
       something to the terrain did it invisibly — a rock vanished at the rim
       and you never saw why. Now it shatters the way a shot rock does, and
       the pieces carry on falling, so a star grinding a field down is
       something you can sit and watch. Nothing is left to collect: what falls
       in is burned, which is the well taking money off you as well as time. */
    const well = hazardAt(r.x, r.y, r.r * 0.5);
    if (well) shatterInWell(r, i, well);
  }

  resolveRockCollisions();

  /* Running at light, a rock is nothing. That is the whole promise of the
     drive: the only two things in the sector big enough to matter at that
     speed are a massive world and a supermassive well, and those are the only
     two the impact warning looks for. So an asteroid in the way is destroyed
     and the ship goes through it without being touched or slowed — which is
     also why a rock must not cut the drive, and it used to, about a second
     after the warning fired. */
  const throughRocks = mode.survey && surv && surv.lightRun > 0;
  for (const s of ships) {
    // The convoy transport is on a rails-steady course down a cleared lane;
    // a stray drifting asteroid neither knocks it nor chips it.
    /* An invulnerable ship still *collides* — it simply is not hurt. Skipping
       the whole check while the shield was up is what let a hit ship pass
       through the rock that hit it. */
    if (!s.alive || s.kinematic) continue;
    const light = throughRocks && s === ships[0];
    /* How far this hull moved since the last frame, so a rock it flew *over*
       still counts as a rock it flew into. The top speed of the roster went
       from 612 to 972 and a small asteroid is sixteen units across: at a
       courier's cruise you cover more than a small rock's width in a frame,
       so a point test at the new position misses it entirely and the field
       stops being solid exactly when you are going fast enough to care. */
    const sStep = Math.hypot(s.vx, s.vy) * dt;
    const sSteps = Math.max(1, Math.min(5, Math.ceil(sStep / 14)));
    /* This hull's own size, not the stock twelve. See `hullR` in the flight
       loop — same bug, same fix, and this is the half of it a player actually
       runs into: a Tender is drawn three and a half times over and was being
       stopped by a Skiff's circle. */
    const sR = (s.spec ? s.spec.hitR : 9) * U * (s.sizeMul || 1);
    for (let ri = rocks.length - 1; ri >= 0; ri--) {
      const r = rocks[ri];
      const reach = (r.r + sR) ** 2;
      let touching = gap2(s.x, s.y, r.x, r.y) < reach;
      /* Walked backwards along the step. The first sample that is inside wins
         and the ship is treated as being there, which is what stops a
         glancing pass at speed reading as a miss. */
      for (let k = 1; k <= sSteps && !touching; k++) {
        const f = k / sSteps;
        if (gap2(s.x - s.vx * dt * f, s.y - s.vy * dt * f,
                 r.x, r.y) < reach) {
          s.x -= s.vx * dt * f; s.y -= s.vy * dt * f;
          touching = true;
        }
      }
      if (!touching) continue;
      if (light) {
        burst(r.x, r.y, "#ffcb42", 12, 260 * U);
        if (Math.random() < 0.25) gameSound("rock", r.x, r.y);
        rocks.splice(ri, 1);
        continue;                       // and keep going; there may be more
      }
      /* A shielded nose. The commuters carry one, and it is the whole reason
         they are the hull you take between two stations without watching the
         sky: the drifting field stops being something you thread and becomes
         something you push through. The rock is shoved hard aside rather than
         destroyed — a prow parts the field, it does not vaporise it, and a
         commuter that left a corridor of dust behind it would be a weapon.

         Rocks only. A world, a dead hull and the Leviathan are structures, and
         a ship that flew through those would undo the one thing that made this
         sector stop feeling like a backdrop. */
      if (s.ram) {
        let px = sepX(r.x, s.x), py = sepY(r.y, s.y);
        const pd = Math.hypot(px, py) || 1;
        const shove = 200 * U / Math.max(1, r.r / 30);
        r.vx += (px / pd) * shove;
        r.vy += (py / pd) * shove;
        if (Math.random() < 0.3) burst(r.x, r.y, "#87d8ff", 3, 90 * U);
        continue;
      }
      /* A rock is solid. It used to be a hit and a shove, which meant that
         for as long as the impact shield lasted you flew *through* the thing
         that had just hit you — so a boulder was a damage event rather than an
         object, and cover you could hide behind was cover you fell into.

         The collision and the damage are separate now. The collision always
         happens: you are put back on the rock's surface and the part of your
         velocity heading into it is reversed, so you bounce off. The damage is
         what the shield stops. */
      let dx = sepX(s.x, r.x), dy = sepY(s.y, r.y);
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
      const min = r.r + sR;
      s.x = r.x + dx * min;
      s.y = r.y + dy * min;
      /* Along the normal, reversed and *damped*; across it, kept — so a
         glancing pass slides along the rock instead of stopping dead on it.

         The factor is 1.4, which leaves four tenths of the inward speed coming
         back out. It must stay under two: at two the bounce is perfectly
         elastic, and anything over it hands you energy — a ship could gain
         speed by driving into rocks, which is both wrong and a way past the
         drive's top speed. */
      const into = s.vx * dx + s.vy * dy;
      if (into < 0) {
        /* Shared with the rock by mass. A boulder is heavy and shoves a light
           ship hard; a pebble bouncing off a Gantry barely registers, which
           is the half that was missing — and the half that mattered once a
           heavy hull started keeping a shove for forty-five seconds. */
        const rockMass = (r.r / 30) * (r.r / 30) * 2.4;
        const mine = hullMass(s.spec);
        const share = (2 * rockMass) / (mine + rockMass);
        s.vx -= into * dx * 1.4 * share;
        s.vy -= into * dy * 1.4 * share;
      }
      // And the rock takes some of it, because it is a rock and not a wall.
      const push = 90 * U / Math.max(1, r.r / 30);
      r.vx -= dx * push;
      r.vy -= dy * push;
      /* The hit itself, which the shield is allowed to stop — and which an
         armoured hull simply does not take. Ric, on the Tender: "shouldnt get
         damaged from astroids but shouldnt be able to fly through them."

         That is a different thing from the commuters' prow, and deliberately
         so: a commuter *passes through* the field, a working hull is stopped
         by it and shrugs. Both are on the tank classes for the reason Ric gave
         them — these are the hulls "built like tanks", and a tank that loses
         armour to gravel is not one. The bounce above has already happened, so
         they still cannot drive through a boulder. */
      if (s.invuln <= 0 && !(s.spec && s.spec.tough)) {
        damageShip(s, "rock", null);
        if (!worldRunning()) return;
      }
      break;
    }
  }

  for (let i = bits.length - 1; i >= 0; i--) {
    const p = bits[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.exp(-1.6 * dt); p.vy *= Math.exp(-1.6 * dt);
    p.life -= dt;
    if (p.life <= 0) bits.splice(i, 1);
  }

  if (!worldRunning()) return;

  /* Screen shake decays here rather than in `campaignTick`, which is where it
     used to live back when the campaign was the only thing that shook the
     view. It has not been true for a while: salvaging a pickup shakes, and
     Survey shakes on every hull strike, every cache and every gate. In any
     mode without a campaign controller nothing was subtracting it, so the
     first impact pinned the screen at full amplitude and it never stopped.

     0.55 seconds from the hardest hit in the game to nothing. */
  shake = Math.max(0, shake - 90 * dt);

  updateCamera(dt);

  if (mode.survey) {
    surveyTick(dt);
  } else if (mode.campaign) {
    campaignTick(dt);
  } else if (mode.closing) {
    // Keep a standing rock population so the shrinking arena stays hostile.
    // The target falls as the wall closes, or the endgame turns into soup.
    const room = (bounds.x1 - bounds.x0) * (bounds.y1 - bounds.y0) /
                 (arena.w * arena.h);
    const want = Math.max(7, Math.round(ROYALE_ROCKS * room));
    topUp -= dt;
    if (topUp <= 0 && rocks.length < want) {
      topUp = 1.5;
      spawnRoyaleRock();
    }

  } else if (rocks.length === 0) {
    spawnWave();
  }
}
