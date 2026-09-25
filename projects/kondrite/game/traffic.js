"use strict";

/* KONDRITE — WHAT A TRAFFIC SHIP DOES, BESIDES FLY
   ─────────────────────────────────────────────────────────────────────────────
   The phases of one traffic ship's frame that surveyTraffic (pilots.js) hands
   off, in the order it calls them: swallowed by a star, adrift, a distress
   call, stunned — each of which ends the ship's frame and says so by returning
   true — then bumping into you, and firing.

   What stays in surveyTraffic is the pilot itself: what it notices, where it
   wants to be, and how it steers there. Those three pass a dozen values from
   one to the next and read best as one piece. A new behaviour that happens TO a
   ship, or that it does once it knows where it is going, is a function here and
   one line in the loop.

   Moved, not rewritten: each is the block that was in the loop, word for word,
   with `continue` spelled `return true`. test/traffic-trace.js hashes the whole
   sector's traffic frame by frame and matched before and after.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

function trafficSwallowed(t, i, took) {
  if (took) {
    /* Gone. Not a wreck: it is inside a star. The salvage it was carrying
       falls in after it, which is correct and is also the best argument for
       why you do not chase a hauler past one of these.

       Said out loud if you are near enough to have seen it, because an
       accident nobody mentions is indistinguishable from a despawn. */
    chatter(factionOf(t.faction).short + " " + (t.role || t.kind) + " — " +
            (took.name || (took.kind === "hole" ? "a well" : "a star")) +
            " has it.",
            took.kind === "hole" ? "#b79aff" : "#ffd76d", t);
    killTraffic(i, false, true);
    return true;
  }
  return false;
}

function trafficAdrift(t, dt, i, me) {
  /* ── out of water, and drifting ────────────────────────────────────────
     "Ships can run out of something" is the half of 6.3 that was missing, and
     the interesting question was never the clock — it is *why* a hauler runs
     dry. A background timer would put dead ships all over the sector and mean
     nothing. A reserve that only burns when the ship is in trouble means a
     drifting hauler is evidence: something happened here.

     So the tank drains while it is being chased, while it is running from you,
     while it is being shot at, and while it is fighting a well — and refills
     slowly while it is getting on with its day. Three systems strand a ship:
     pirates, gravity, and you. */
  if (t.adrift) {
    t.doom -= dt;
    // Drifting means drifting. Whatever gravity is doing to it still is.
    solidBounce(t, hullR(t));
    if (!t.pleaded && me.alive &&
        dist2(t.x, t.y, me.x, me.y) < TRAFFIC_TALK ** 2) {
      t.pleaded = true;
      chatter(factionOf(t.faction).short + " hauler — out of water, " +
              "drifting. They are asking anyone.", "#ffcb42", t);
    }
    if (t.doom <= 0) {
      chatter("That hauler is not answering any more.", WRECK, t);
      killTraffic(i, false);
      return true;
    }
    return true;
  }
  return false;
}

function trafficDistress(t, dt, i, me) {
  if (t.kind === "distress") {
    /* The clock. Its attackers are drones posted on it, so "are they dead"
       is a question about the drone list — and clearing them is the rescue,
       whether you meant it or not. */
    const attackers = surv.drones.filter(d => d.prey === t).length;
    if (attackers > 0) {
      t.doom -= dt;
      t.hp = Math.max(0.4, t.maxHp * (t.doom / 60));
      if (t.doom <= 0) { killTraffic(i, false); return true; }
      // Drifting, not flying: it is not going anywhere under its own power.
      t.x += Math.cos(t.a) * 14 * U * dt;
      t.y += Math.sin(t.a) * 14 * U * dt;
      solidBounce(t, hullR(t));
      if (!t.called && dist2(me.x, me.y, t.x, t.y) < TRAFFIC_TALK ** 2) {
        t.called = true;
        chatter("Distress call — they are being taken apart out here.",
                "#ffcb42", t);
      }
    } else if (!t.saved) {
      /* Saved. It pays, and then it becomes an ordinary hauler and gets on
         with its day — which is a better ending than a thank-you and a
         despawn, because you can pass it again later. */
      /* Saved — and *by whom*. It used to pay the moment the last attacker
         died, whoever killed it: a patrol clearing the post while you flew
         past put two hundred and sixty in your pocket for watching. Money for
         nothing is worse than no money, because it teaches you that the number
         on the screen is not about anything you did.

         So it pays for damage you actually dealt to the ships taking it apart.
         `helped` is set in the bullet path by your rounds and nothing else.

         And it pays *what they think you are worth*. A power that trusts you
         settles up properly; one that has you on a watch list is paying off an
         obligation to somebody it would rather not owe, and pays like it. It
         is never nothing — that they pay badly is the information. */
      t.saved = true;
      t.kind = "freight"; t.role = "freight";
      t.hp = t.maxHp;
      if (t.helped) {
        const pay = Math.round(DISTRESS_PAY * standingPay(t.faction));
        surv.cash += pay;
        surv.t.rescued = true;
        /* And it is somebody now. A ship you pulled out of trouble that goes
           back to being an anonymous freighter is a thank-you and a despawn —
           see `rememberFriend`. */
        rememberFriend(t, "saved");
        // Worth about a hauler, in the other direction. Being able to work it
        // off is what keeps this a state rather than a verdict on the save.
        addRep(t.faction, REP.RESCUE);
        chatter("They made it — that distress call is under way again. " +
                money(pay) + " and their thanks.", CASH, t);
        gameSound("win", t.x, t.y);
      } else {
        // Somebody else cleared it. You get to watch them leave.
        chatter("Somebody got there first. That hauler is under way again.",
                NEBULA, t);
      }
      saveSurveyBook();
    }
    return true;
  }
  return false;
}

function trafficStunned(t, dt) {
  if (t.stun > 0) {
    t.cool = Math.max(t.cool || 0, 0.4);
    /* It coasts on what it had. `|| 0` because a ship can be caught by a
       burst before it has ever flown a frame, and `undefined * anything` is
       the kind of NaN that spreads to a position and then to a draw call. */
    t.vx = (t.vx || 0) * Math.exp(-0.35 * dt);
    t.vy = (t.vy || 0) * Math.exp(-0.35 * dt);
    t.x += t.vx * dt; t.y += t.vy * dt;
    if (solidBounce(t, hullR(t))) {
      bounceOff(t, 1.1);
    }
    return true;
  }
  return false;
}

function trafficBump(t, i, me, near) {
  /* ── a hull is a hull ───────────────────────────────────────────────
     You could fly straight through every ship in the sector. Ships bounce off
     each other — that code has been there since the first mode — but *traffic*
     is not in the `ships` array, so nothing ever asked whether your nose was
     inside a freighter. A neutral you can occupy the same space as is a
     painting, and it is the single loudest thing that says "this is not a
     real object" about everything else out here.

     The same shove the arena uses, with the mass on the bigger hull: you
     bounce off a hauler and a hauler barely notices. */
  if (me.alive && near < hullR(t) + shipRadius()) {
    const min = hullR(t) + shipRadius();
    /* And it costs you. Two hulls meeting at a closing speed is the oldest
       hazard in this game and it was the one thing out here that could touch
       you and did not — you could ram a freighter all afternoon. Only a real
       impact: brushing past at walking pace is a scrape, and the ship you hit
       takes it too. */
    const closing = Math.hypot(me.vx - ((t.vx || 0) + (t.dvx || 0)),
                               me.vy - ((t.vy || 0) + (t.dvy || 0)));
    if (me.invuln <= 0 && closing > 120 * U && !t.bumped) {
      t.bumped = 0.8;
      /* The warlord means it. Two points, and it does not feel a thing. */
      const ram = t.boss === "warlord";
      damageShip(me, "rock", null, ram ? 2 : 1);
      if (ram) {
        chatter(t.name + " rammed you.", BOSS_COLOUR);
        addShake(8);
      }
      if (!ram) t.hp -= 1;
      t.hit = 0.12;
      if (t.hp <= 0) killTraffic(i, true);
    }
    let dx = me.x - t.x, dy = me.y - t.y;
    let d = Math.hypot(dx, dy);
    if (d < 0.001) { dx = 1; dy = 0; d = 1; }
    const nx = dx / d, ny = dy / d;
    me.x = t.x + nx * min; me.y = t.y + ny * min;
    const into = me.vx * nx + me.vy * ny;
    if (into < 0) {
      // Shared by mass. A Kite does not move a Gantry. See `shoveShare`.
      const share = shoveShare(me.spec, shipSpec(t.hull));
      me.vx -= into * nx * 1.6 * share;
      me.vy -= into * ny * 1.6 * share;
    }
    // And it gets out of the way, which is what a person would do.
    t.x -= nx * 12 * U; t.y -= ny * 12 * U;
  }
}

function trafficFire(t, dt, me, armed, fake, skill) {
  /* A patrol shoots at sentries. It is the one thing that tells you these
     are on your side without a word being said — and it means a guarded
     cache near a station is a fight you can arrive in the middle of. */
  if (armed) {
    t.cool -= dt;
    if (t.cool <= 0) {
      /* Angry, it comes for you and its rounds are live. Otherwise it looks
         for something it is at war with — a sentry, or a ship of whichever
         power its own is fighting — and those rounds cannot touch you.

         That last clause is the war. Two powers' ships shoot each other on
         sight, in front of you, about something that has nothing to do with
         you, and you can sit and watch or pick a side. */
      /* What it is shooting at, and — the part that was missing — *where
         that thing will be*. Every ship out here fired at the position its
         target occupied at the instant it pulled the trigger, so anything
         moving across its nose was never hit by anything, ever. The bots in
         the other modes have led their shots since the first version of this
         game; the sector's own ships did not, which is the whole of why they
         felt like scenery with a gun on it.

         Solved the honest way: the time the round needs to cross the gap, and
         the target's own velocity over that time. Traffic carries no velocity
         of its own — it flies on a heading — so its speed along its heading is
         what gets led. */
      /* The speed the round actually leaves at, or every lead is wrong.
         Off the hull now rather than a constant: a freighter's pop-gun
         throws a slow round and a gunship's throws a fast one, which is
         what makes outrunning return fire a real thing a fast ship can do
         — and what stops it working on anything that is actually armed. */
      const SHOT_V = BOT_BULLET_SPD * (shipSpec(t.hull).shot || 1) * U;
      /* Timed from the muzzle, which is where the round starts now, not
         from the middle of the ship. From the middle, every lead came out a
         few per cent long. */
      const noseR = (specOf(t).noseX || 12) * (specOf(t).size || 1) *
                    (t.scale || 1) * U;
      const leadOf = (o, ovx, ovy) => {
        const dd = Math.hypot(o.x - t.x, o.y - t.y);
        const tt = Math.max(0, dd - noseR) / SHOT_V;
        // Relative to the shooter: its rounds carry its own velocity.
        return { x: o.x + ((ovx || 0) - (t.vx || 0)) * tt,
                 y: o.y + ((ovy || 0) - (t.vy || 0)) * tt };
      };
      /* A ship's real velocity, not the one implied by its nose. Since a
         hull drifts through a turn, the two disagree for as long as the
         turn lasts — and a ship coming about is exactly when a gunner leads
         it, so reading the heading was leading the place it was pointing
         rather than the place it was going. */
      const leadShip = o => leadOf(o,
        (o.vx === undefined ? Math.cos(o.a) * o.speed * U : o.vx) + (o.dvx || 0),
        (o.vy === undefined ? Math.sin(o.a) * o.speed * U : o.vy) + (o.dvy || 0));

      let tx = null, ty = null, live = false;
      /* The decoy first, and `live` stays false for it: a round aimed at a
         decoy is aimed somewhere you are not, so it must not be flagged as
         fire meant for the player. */
      if (t.angry && fake && Math.hypot(fake.x - t.x, fake.y - t.y) < 1800 * U) {
        const p = leadOf(fake, fake.vx, fake.vy);
        tx = p.x; ty = p.y;
      }
      if (tx == null && t.angry && me.alive) {
        const dd = Math.hypot(me.x - t.x, me.y - t.y);
        if (dd < 1800 * U) {
          const p = leadOf(me, me.vx, me.vy);
          tx = p.x; ty = p.y; live = true;
        }
      }
      /* What it *wants* to shoot, which is usually not you. A pirate fires on
         the hauler it is chasing; an escort fires on whoever is chasing its
         client; a patrol fires on the pirate it came for. None of that needed
         a new system — the want already picked the target, and this is the
         gun pointed at it. */
      if (tx == null && t.angryAt && surv.traffic.indexOf(t.angryAt) >= 0) {
        const o = t.angryAt;
        if (Math.hypot(o.x - t.x, o.y - t.y) < 1600 * U) {
          const p = leadShip(o); tx = p.x; ty = p.y;
        } else t.angryAt = null;
      }
      if (tx == null && t.markKind === "ship" && t.mark &&
          surv.traffic.indexOf(t.mark) >= 0 &&
          ROLES[t.role || t.kind] && ROLES[t.role || t.kind].hunts) {
        const o = t.mark;
        if (Math.hypot(o.x - t.x, o.y - t.y) < 1400 * U) {
          const p = leadShip(o); tx = p.x; ty = p.y;
        }
      }
      if (tx == null) {
        let best = null, bd = 1500 * U;
        for (const dr of surv.drones) {
          const dd = Math.hypot(dr.x - t.x, dr.y - t.y);
          if (dd < bd) { bd = dd; best = dr; }
        }
        for (const o of surv.traffic) {
          if (o === t || !atWar(t.faction, o.faction)) continue;
          const dd = Math.hypot(o.x - t.x, o.y - t.y);
          if (dd < bd) { bd = dd; best = o; t.duel = o; }
        }
        if (best) {
          const p = best.speed !== undefined ? leadShip(best)
                  : leadOf(best, best.vx, best.vy);
          tx = p.x; ty = p.y;
        }
      }
      if (tx != null) {
        const a = Math.atan2(ty - t.y, tx - t.x);
        /* Check the line first. Rounds hit whatever is in front of them out
           here — which is the rule that makes a war dangerous to stand next
           to — and it also means a ship in a firing line will happily empty
           its magazine into the back of its own escort. Anybody competent
           holds fire. Three samples down the barrel is enough: this runs for
           every armed ship every half-second. */
        let blocked = false;
        for (let k = 1; k <= 3 && !blocked; k++) {
          const px = t.x + Math.cos(a) * 280 * U * k;
          const py = t.y + Math.sin(a) * 280 * U * k;
          for (const o of surv.traffic) {
            if (o === t || atWar(t.faction, o.faction)) continue;
            if (o.faction === "pirate" && t.faction !== "pirate") continue;
            const rr = hullR(o);
            if (dist2(px, py, o.x, o.y) < rr * rr) { blocked = true; break; }
          }
        }
        if (blocked) { t.cool = 0.25; return true; }
        const guns = specOf(t);
        /* A claw has no reach. The utility hulls do not carry a gun at all —
           they carry a pair of jaws — so in somebody else's hands they do
           not fire one either. A working tug that sniped across a sector
           would be the roster saying one thing and the sector another. */
        if (guns.weapon === "claw") { t.cool = 1.4; return true; }
        /* The guns point forward, so they fire forward. They swing a
           quarter turn either side of the nose, which covers a ship
           circling its target at gun range, and nothing behind that: a
           round coming backwards out of a forward barrel is not a round
           anybody fired. It waits until it has come round. */
        let off = a - t.a;
        while (off > Math.PI) off -= Math.PI * 2;
        while (off < -Math.PI) off += Math.PI * 2;
        // The admiral's guns are turrets down its flanks: they fire any way.
        if (Math.abs(off) > Math.PI / 2 && t.boss !== "admiral") { t.cool = 0.2; return true; }
        t.cool = (t.angry ? 0.42 : 0.5) / guns.rate *
                 Math.max(0.7, 1.2 - 0.4 * skill);
        /* Out of a barrel: the one on the side the target is, and the pair
           take turns, so a two-gun hull on a straight run fires left,
           right, left. */
        const drawnR = SHIP_R * U * (guns.size || 1) * (t.scale || 1);
        const side = off >= 0 ? 1 : -1;
        const barrels = guns.muzzles.filter(m => m[1] * side >= 0);
        t.gunIx = (t.gunIx || 0) + 1;
        const gun = muzzleAt({ muzzles: barrels.length ? barrels : guns.muzzles },
                             t.x, t.y, t.a, drawnR, t.gunIx);
        /* Aimed from the barrel, not from the middle of the ship: a wing
           gun six units out that fires along a line drawn from the middle
           misses by six units, which on a small hull is all of it.

           Everybody leads; what skill buys is a steady hand. A novice's
           round goes up to six degrees either side of the line, an ace's
           down it. */
        /* Scatter, and it is a *distance* rather than an angle past a
           certain range. Six degrees is a hand's width at knife range and
           ninety units at nine hundred, which is a dozen times the width
           of a Needle — so bots almost never hit each other, and a raider
           could sit in front of an escort and a patrol for twenty-five
           seconds without taking a scratch. The cone closes as the range
           opens: a novice's round lands within about fifty units of the
           line however far away it is fired. */
        const range = Math.max(1, Math.hypot(tx - gun.x, ty - gun.y));
        const spread = Math.min(0.2, 100 * U / range) * Math.max(0, 1 - skill);
        const fa = Math.atan2(ty - gun.y, tx - gun.x) +
                   (Math.random() - 0.5) * spread;
        /* The admiral fires a broadside: every turret on the side you are
           on, at once, and then a long reload. */
        if (t.boss === "admiral") {
          const mz = guns.muzzles.filter(m => m[1] * side > 0);
          for (let q = 1; q < mz.length; q++) {
            const g2 = muzzleAt({ muzzles: [mz[q]] }, t.x, t.y, t.a, drawnR, 0);
            const a2 = Math.atan2(ty - g2.y, tx - g2.x);
            surv.shots.push({ x: g2.x, y: g2.y,
                              vx: Math.cos(a2) * SHOT_V + (t.vx || 0),
                              vy: Math.sin(a2) * SHOT_V + (t.vy || 0),
                              life: 2.2, dmg: guns.dmg, friendly: !live, from: t });
          }
          t.cool = 1.8;
        }
        // The warlord's power: five at once, fanned, a spray to fly round.
        if (t.boss === "warlord") {
          for (const fan of [-0.14, -0.07, 0.07, 0.14]) {
            surv.shots.push({
              x: gun.x, y: gun.y,
              vx: Math.cos(fa + fan) * SHOT_V + (t.vx || 0),
              vy: Math.sin(fa + fan) * SHOT_V + (t.vy || 0),
              life: 2.2, dmg: guns.dmg, friendly: !live, from: t
            });
          }
        }
        surv.shots.push({
          x: gun.x, y: gun.y,
          /* Carrying the ship's own velocity, the way yours do. A ship
             now has one — see the traffic step — and a round fired from a
             hull closing on you should arrive faster than one fired from a
             hull backing away. */
          vx: Math.cos(fa) * SHOT_V + (t.vx || 0),
          vy: Math.sin(fa) * SHOT_V + (t.vy || 0),
          // `dmg`, so a rock takes the same point from them it takes from you.
          life: 2.2, dmg: guns.dmg, friendly: !live, from: t,
          /* And a beam in somebody else's hands is a beam. An industrial
             hauler out there cuts rock the way yours does — which is most of
             what makes the sector's ships read as the same twenty-five hulls
             you can buy rather than as a separate species with the same
             silhouettes. */
          rends: guns.weapon === "beam", beam: guns.weapon === "beam"
        });
        gameSound(t.boss === "warlord" ? "scatter"
                  : guns.weapon === "beam" ? "beam" : "laser", t.x, t.y);
      } else t.cool = 1.2;
    }
  }
  return false;
}
