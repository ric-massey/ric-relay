"use strict";

/* KONDRITE — WHO IS FLYING IT
   ─────────────────────────────────────────────────────────────────────────────
   How a good pilot fights, hull against hull, gravity for everybody, wants
   turned into somewhere to be, salvage lying about, running at light, the
   low-tank warning, repairs and dying.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ═══ WHO IS FLYING IT ═══════════════════════════════════════════════════
   Ric: "make it so the ones with better ships are better flyers". A hull
   costs what it costs because somebody could afford it, and somebody who can
   afford a Jackal has been doing this a while. So a pilot's skill comes from
   the price of the hull, on a log scale (a Needle's pilot is green, a Jackal's
   is an ace), give or take a tenth for the person.

   What skill buys, all of it visible from the cockpit:

     aim         how much of your motion it leads, and how steady its hand is
     cadence     how quickly it gets the next round off
     speed       how hard it pushes its hull in a fight or a chase; a novice
                 flies a fight at cruise
     range       an ace holds gun range; a novice closes to knife range
     weave       an ace jinks while it fights, so it is hard to hold a sight on
     nerve       an ace breaks off while it still has something to save and
                 comes back later; a novice fights until it is nearly dead

   What skill does not buy is handling. A hull turns and accelerates the same
   in anybody's hands, yours included, which is `samehull`'s rule; a better
   pilot makes better choices with the same ship.

   Worked out once per ship from its id rather than rolled, so the sector's
   generation, and every save's fingerprint, is untouched. */
/* ── how a good pilot fights ──────────────────────────────────────────────
   Ric, on the first boss: "i dont want him to go in a perfect circle i want
   him to be a good fighter". Circling at gun range is what a novice does, and
   it is a target you can learn in one lap. A good pilot (skill 0.6 and up,
   and every boss) flies passes instead:

     run      straight at you, guns on, to close range
     break    peel off past you and extend, out of your guns, for a second
              or two, then come round for another run
     circle   now and then a short turn at gun range instead, so the rhythm
              is not a rhythm
     evade    when your nose lines up on it, close enough to matter, it
              breaks sideways out of your line of fire, then cannot do that
              again for a couple of seconds

   A novice still circles. That is the difference between the two, and it
   is visible from the cockpit. */
function dogfight(t, foe, d, stand, dt) {
  const me = ships[0];
  const m = t.move || (t.move = { kind: "run", left: 3, side: 1 });
  m.left -= dt;
  t.evadeCool = Math.max(0, (t.evadeCool || 0) - dt);
  if (foe === me && me.alive && d < 1400 * U && t.evadeCool <= 0 && m.kind !== "evade") {
    let off = Math.atan2(t.y - me.y, t.x - me.x) - me.a;
    while (off > Math.PI) off -= Math.PI * 2;
    while (off < -Math.PI) off += Math.PI * 2;
    if (Math.abs(off) < 0.2) {
      m.kind = "evade"; m.left = 0.5 + Math.random() * 0.5;
      m.side = off >= 0 ? 1 : -1;
      t.evadeCool = 2 + Math.random() * 1.5;
    }
  }
  if (m.kind === "run" && d < stand * 0.6) m.left = 0;
  if (m.left <= 0) {
    if (m.kind === "run") {
      m.kind = Math.random() < 0.72 ? "break" : "circle";
      m.left = m.kind === "break" ? 1.1 + Math.random() * 1.1 : 1.8 + Math.random() * 1.6;
      m.side = Math.random() < 0.5 ? 1 : -1;
    } else {
      m.kind = "run"; m.left = 4;
      // The corsair's power: it comes in on the burner.
      if (t.boss === "corsair" && (t.dashCool || 0) <= 0 && d > stand) {
        t.dash = 0.9; t.dashCool = 3.5;
      }
    }
  }
  // Too far off to be fighting: whatever it was doing, it comes back in.
  if (d > stand * 2.6 && m.kind !== "run") { m.kind = "run"; m.left = 4; }
  const toFoe = Math.atan2(foe.y - t.y, foe.x - t.x);
  const reach = 1000 * U;
  switch (m.kind) {
    case "evade": {
      const a = me.a + m.side * Math.PI / 2;
      return { x: t.x + Math.cos(a) * reach, y: t.y + Math.sin(a) * reach };
    }
    case "break": {
      const a = toFoe + Math.PI + m.side * 0.6;
      return { x: t.x + Math.cos(a) * reach, y: t.y + Math.sin(a) * reach };
    }
    case "circle": {
      const b = Math.atan2(t.y - foe.y, t.x - foe.x) + m.side * 0.7;
      return { x: foe.x + Math.cos(b) * stand, y: foe.y + Math.sin(b) * stand, circle: true };
    }
    default: {
      // At where it is going, so the guns come on as it closes.
      const fv = foe === me ? [me.vx || 0, me.vy || 0] : [foe.vx || 0, foe.vy || 0];
      return { x: foe.x + fv[0] * 0.5, y: foe.y + fv[1] * 0.5 };
    }
  }
}

const SKILL_LO = Math.log(900), SKILL_HI = Math.log(169000);
function pilotSkill(t) {
  if (t.skill == null) {
    const cost = shipSpec(t.hull).cost || 0;
    const base = Math.max(0, Math.min(1,
      (Math.log(cost + 900) - SKILL_LO) / (SKILL_HI - SKILL_LO)));
    let h = 7;
    for (const ch of String(t.id || (Math.round(t.x) + ":" + Math.round(t.y)))) {
      h = (h * 31 + ch.charCodeAt(0)) | 0;
    }
    const person = ((h >>> 0) % 1000) / 1000 * 0.2 - 0.1;
    t.skill = Math.max(0, Math.min(1, base + person)) + (t.boss ? 0.4 : 0);
  }
  return t.skill;
}

function surveyTraffic(dt) {
  const me = ships[0];
  const byId = new Map();
  for (const o of surv.traffic) if (o.id) byId.set(o.id, o);
  for (let i = surv.traffic.length - 1; i >= 0; i--) {
    const t = surv.traffic[i];

    t.hit = Math.max(0, (t.hit || 0) - dt);
    t.bumped = Math.max(0, (t.bumped || 0) - dt);
    /* Counted down here, at the top, rather than inside the branch that acts
       on it. A distress call returns out of this loop long before that branch
       — it is being taken apart and has nothing to steer — so a burst that
       caught one set a stun that nothing ever decremented, and it was still
       stunned an hour later when it had finished being a distress call and
       gone back to being a freighter. A clock that only ticks on the frames
       somebody looks at it is not a clock. */
    t.stun = Math.max(0, (t.stun || 0) - dt);

    /* Gravity first, because it applies whatever else this ship is doing —
       including being a distress call that is not flying at all. */
    const pull = trafficDrift(t, dt);
    const took = pull > 0 ? hazardAt(t.x, t.y, 16 * U) : null;
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
      continue;
    }

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
        continue;
      }
      continue;
    }

    if (t.kind === "distress") {
      /* The clock. Its attackers are drones posted on it, so "are they dead"
         is a question about the drone list — and clearing them is the rescue,
         whether you meant it or not. */
      const attackers = surv.drones.filter(d => d.prey === t).length;
      if (attackers > 0) {
        t.doom -= dt;
        t.hp = Math.max(0.4, t.maxHp * (t.doom / 60));
        if (t.doom <= 0) { killTraffic(i, false); continue; }
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
      continue;
    }

    /* A route, walked end to end. `leg` is which way along it, so a ship met
       twice is the same ship going about its day rather than a new one. */
    /* What this ship makes of you, which is three separate questions: what its
       flag thinks, what it personally thinks, and whether you are standing too
       close. Only armed ships act on any of it — a freighter's opinion of you
       is that it would like to be somewhere else. */
    /* Stunned by a burst: no engine, no guns, and no opinion about anybody.
       It carries its momentum and its gravity, because both are things that
       happen *to* a ship rather than things it does — a hauler EMP'd over a
       well still falls into the well, which is a consequence worth having. */
    const skill = pilotSkill(t);
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
      continue;
    }

    /* Running, because it is losing. Outranks every other want it has — a
       ship that has decided to leave is not also escorting, policing or
       robbing anybody. See `hurtBySomebody`. */
    if (t.breakOff > 0) {
      t.breakOff = Math.max(0, t.breakOff - dt);
      t.angry = false;
      if (!t.breakOff) { t.fleeFrom = null; t.angryAt = null; }
    }

    const near = Math.hypot(me.x - t.x, me.y - t.y);
    // Somebody you have met before, if this is one of them.
    if (t.friend && me.alive) friendMeeting(t, near);
    const armed = ROLES[t.role || t.kind] && ROLES[t.role || t.kind].armed;
    t.hunted = Math.max(0, (t.hunted || 0) - dt);

    /* Cloaked, and nobody who was looking for you can find you. This is the
       one thing SILENT RUNNING does that RUNNING DARK never did: a sentry was
       always the only thing the passive part hid you from, and the ships are
       the half of the sector that actually chases.

       **Forgotten, not paused.** A pirate that comes out the other side of ten
       seconds still on your tail has not lost you, it has blinked — so the
       anger goes rather than being held, and it has to be earned again when
       you turn up on a screen. A hunter came into the sector angry and is the
       clearest case: it arrived specifically to find you, and for ten seconds
       it cannot. */
    const unseen = me.alive && cloaked(me);
    if (unseen) {
      t.angry = false;
      t.shadow = false;
      t.warned = 0;
      if (t.mark === me || t.markKind === "you") { t.mark = null; t.markKind = ""; }
    }

    /* An escort whose client is being hunted turns on whoever is doing it. This
       is the collision the whole phase is for: the pirate wants the cargo, the
       escort wants the client alive, and neither of them has been told about
       the other — they simply both want something involving the same hauler. */
    if (t.client && surv.traffic.indexOf(t.client) >= 0 && !t.angryAt) {
      for (const o of surv.traffic) {
        if (o.faction !== "pirate") continue;
        /* 3,400, not 2,200. An escort that notices a pirate two thousand units
           from its client notices it after the pirate has already made its
           approach — measured, the hauler died before the escort closed. An
           escort that gets there too late to matter is decoration, and the
           number that decides whether it is decoration is this one. */
        if (Math.hypot(o.x - t.client.x, o.y - t.client.y) > 3400 * U) continue;
        t.angryAt = o;
        t.mark = o; t.markKind = "ship"; t.think = 3;
        if (dist2(t.x, t.y, me.x, me.y) < (TRAFFIC_TALK * 1.2) ** 2) {
          chatter(factionOf(t.faction).short + " escort breaking off \u2014 " +
                  "they have a pirate on the convoy.",
                  factionOf(t.faction).colour, t);
        }
        break;
      }
    }
    // And whatever it was angry at, once that is gone, it stops being angry.
    if (t.angryAt && surv.traffic.indexOf(t.angryAt) < 0) t.angryAt = null;

    /* Something being hunted runs, whoever is hunting it. */
    if (t.hunted > 0 && !armed) t.speed = t.baseSpeed * 1.3;
    else if (t.baseSpeed) t.speed = t.baseSpeed;
    if (me.alive && !unseen && near < 2600 * U && t.role !== "hunter") {
      const lord = t.boss ? t : t.leader && t.leader.boss ? t.leader : null;
      if (armed && (lord ? (t.angry || bossHostile(lord)) : shipHostile(t))) t.angry = true;
      else if (armed && repOf(t.faction) <= -30) t.shadow = true;

      /* Personal space. Some of them want room and will say so once before
         they do anything about it — which is the difference between a warning
         and an ambush, and the reason the bubble is worth having at all. */
      /* Only if it is *you* closing. A convoy that flew past you while you
         sat still used to warn you off and then open fire, for being where
         it had chosen to fly. */
      const closing = ((me.vx - (t.vx || 0)) * (t.x - me.x) +
                       (me.vy - (t.vy || 0)) * (t.y - me.y)) / Math.max(1, near);
      if (t.space && near < t.space * U && !t.angry && closing > 40 * U) {
        if (!t.warned) {
          t.warned = 1;
          chatter(factionOf(t.faction).short + " — that is close enough.",
                  factionOf(t.faction).colour);
        } else if (near < t.space * 0.55 * U) {
          t.angry = true;
          chatter(factionOf(t.faction).short + " — they told you once.",
                  "#ff8f77");
        }
      }
    }
    /* A freighter that does not like you runs rather than fights. */
    // A boss does not simply run from you; the queen has her own way.
    const fleeing = !armed && !t.boss && me.alive && !unseen && shipHostile(t) &&
                    near < 1800 * U;
    /* Shadowing sits off your shoulder rather than closing: near enough that
       you notice, far enough that it is not a threat yet. */
    const tailing = t.shadow && !t.angry && me.alive;

    /* The reserve. Only unarmed ships carry one — a patrol is not going to
       drift into your path out of thirst, and the ones this is about are the
       haulers. Burns while it is in trouble, refills while it is not, and at
       zero the ship stops being a ship and becomes a situation. */
    if (t.tank != null && t.tank >= 0) {
      /* **Not `pull > 0`.** That was true of any ship anywhere inside any
         gravity well's reach, which is a large fraction of the sector and most
         of it harmless — so ordinary haulers going about their day burned their
         reserve crossing a star's outskirts and stopped dead all over the
         sector. A drifting hauler is supposed to be evidence that something
         happened here; a hundred of them are evidence of a bug.

         Only a well that is actually beating the ship's engine counts now, which
         is the same test the player's own warning uses. */
      const dragged = pull > 0 && pull > t.speed * U * 0.6;
      const chased = t.hunted > 0 || fleeing || t.hit > 0 || dragged;
      t.tank += chased ? -dt : dt * 0.25;
      if (t.tank > t.tankFull) t.tank = t.tankFull;
      if (t.tank <= 0) {
        t.tank = 0;
        t.adrift = true;
        t.doom = rand(200, 320);
        t.mark = null; t.markKind = ""; t.angryAt = null;
      }
    }
    /* What it is actually trying to do, which is the whole of 6.1. You are
       only one of the answers — most of the time a ship out here is busy with
       somebody else, and the interesting frames are the ones where two of these
       wants are pointed at the same place. */
    /* Cargo somebody dumped, which outranks everything a pirate wants
       including you. It runs on a clock: forty seconds of going for it, and
       then it has either got there or decided it was a trick. */
    if (t.baitFor > 0) {
      t.baitFor -= dt;
      if (t.baitFor <= 0) { t.bait = null; t.baitFor = 0; }
    }
    const bait = t.bait && t.baitFor > 0 ? t.bait : null;
    const formation = formationFor(t, byId);
    /* A group keeps together: a follower that has fallen behind its slot
       opens up to catch it, and a leader that is angry takes its guns along. */
    if (formation && t.leader) {
      const gap = Math.hypot(formation.x - t.x, formation.y - t.y);
      if (gap > 500 && t.baseSpeed) t.speed = t.baseSpeed * 1.25;
      if (t.leader.angry && armed && !unseen) t.angry = true;
    }
    if (bait && Math.hypot(bait.x - t.x, bait.y - t.y) < 300) takeJetsam(t);
    /* And a decoy, which is a lie about where you are. Only to something that
       is already angry with you: a decoy does not make anybody angry, it makes
       somebody who already is point the wrong way. */
    const fake = t.angry && me.alive ? decoyFor(t.x, t.y) : null;
    const goal = (t.breakOff > 0 && t.fleeFrom)
                 ? { x: t.x + (t.x - t.fleeFrom.x), y: t.y + (t.y - t.fleeFrom.y) }
               : bait ? bait
               : (t.angry && fake) ? { x: fake.x, y: fake.y }
               : (t.angry && me.alive) ? { x: me.x, y: me.y }
               : fleeing ? { x: t.x + (t.x - me.x), y: t.y + (t.y - me.y) }
               : tailing ? { x: me.x - Math.cos(t.a) * 700 * U,
                             y: me.y - Math.sin(t.a) * 700 * U }
               : formation ? formation
               : wantOf(t, dt);
    /* Arrival is judged against where it was *going*, not against where the
       wells have pushed the aim — otherwise a station on the far side of a well
       can never be reached, because the dodge always holds the ship 200 units
       off the only point that counts as arriving. */
    /* `!(t.breakOff > 0)`, not `t.breakOff <= 0`. A ship that has never been
       hurt has no `breakOff` at all, and `undefined <= 0` is false — so the
       first version of this stopped *every* ship in the sector from ever
       arriving anywhere: no deliveries, no salvage taken, no routes walked.
       Asking the positive question is the only form that is safe on a field
       that may not exist. */
    /* ── what sort of goal it is ──────────────────────────────────────────
       Somewhere to *get to* is a place: a station, a wreck, the end of a
       route. Anything else moves. `chase` is a body the ship is going for, and
       `follow` is one whose pace it keeps while holding a point off it: a
       leader's slot, a client's shoulder, the spot behind you it is tailing.

       Only a place can be arrived at. This used to ask "am I within 220 of
       the goal" whatever the goal was, and on arriving the ship skipped its
       whole step: no engine, no guns. So anything chasing you stopped dead
       the moment it got close, and so did a pirate that caught its hauler
       and a ship running from you at close range. Ric: "they just freeze
       when too close to the player". */
    const running = !!((t.breakOff > 0 && t.fleeFrom) || fleeing);
    const isShip = o => !!o && surv.traffic.indexOf(o) >= 0;
    let chase = null, follow = null;
    if (!running && !bait) {
      if (t.angry && me.alive) chase = fake || me;
      else if (tailing) follow = me;
      else if (formation) {
        if (isShip(formation)) chase = formation;
        else follow = t.leader;
      } else if (t.markKind === "ship" && t.mark) {
        if (goal === t.mark) chase = t.mark;
        else follow = t.client || t.mark;
      }
    }
    const place = !running && !chase && !follow;
    if (place && Math.hypot(goal.x - t.x, goal.y - t.y) < 220) {
      arrived(t, goal);
      t.leg = -t.leg;
    }
    /* Three states get no dodge: angry, running from you, and *being hunted by
       somebody else*. The last was missing and it is the one that matters —
       a pirate on a hauler is the commonest reason a ship is somewhere it would
       not have chosen, and a hauler that kept calmly steering round the star
       while being shot at was a hauler that could never have the accident this
       rule exists for. */
    /* ── a watchdog ─────────────────────────────────────────────────────
       Anything that has not moved for eight seconds has got itself wedged —
       against a wall, against its own arrival radius, against a want it is
       already standing on — and the cheapest correct answer is to make it
       think again rather than to find every way that can happen. */
    /* Only while it is trying to get somewhere. A ship holding station on
       its leader, or sitting off your shoulder while you are parked, is
       standing still on purpose. */
    /* And a ship it has never looked at starts its count from here. Without
       that, `wasX` stayed unset, the distance moved read as nought every
       frame, and every ship in the sector was "stuck" for its first eight
       seconds of life. So each one threw a random swerve and turned its
       route round, eight seconds after it was born. */
    if (t.wasX === undefined) { t.wasX = t.x; t.wasY = t.y; }
    const moved2 = (t.x - t.wasX) ** 2 + (t.y - t.wasY) ** 2;
    if (moved2 > (4 * U) ** 2 || !place) { t.wasX = t.x; t.wasY = t.y; t.stuck = 0; }
    else {
      t.stuck = (t.stuck || 0) + dt;
      if (t.stuck > 8) {
        t.stuck = 0; t.wasX = t.x; t.wasY = t.y;
        t.mark = null; t.markKind = ""; t.think = 0;
        t.leg = -t.leg;
        t.a += (Math.random() - 0.5) * 2.2;
      }
    }

    /* An armed ship that has caught what it was chasing circles it at gun
       range rather than parking on top of it. Its guns fire any way it is
       facing, so the circle costs it nothing, and it is what a fight looks
       like from the outside: somebody going round somebody. Which way round
       is the ship's own, so a pack does not all orbit in step. */
    let orbit = null, move = null;
    /* A boss fights its own way. The queen has no guns, so "fighting" for her
       starts when somebody hurts her or her escorts turn on you. */
    const lordFoe = t.boss && !running
      ? (chase || (t.boss === "queen" && me.alive && !unseen &&
           (clock - (t.lastHit == null ? -99 : t.lastHit) < 25 ||
            surv.traffic.some(o => o.leadId === t.id && o.angry)) ? me : null))
      : null;
    if (lordFoe) {
      move = bossFight(t, lordFoe, Math.hypot(lordFoe.x - t.x, lordFoe.y - t.y), dt);
    } else if (chase && armed) {
      const stand = (360 + 60 * (shipSpec(t.hull).size || 1) * (t.scale || 1)) * U *
                    Math.min(1.1, 0.65 + 0.35 * skill);
      const cd = Math.hypot(chase.x - t.x, chase.y - t.y);
      if (skill >= 0.6) {
        move = dogfight(t, chase, cd, stand, dt);
        if (move.circle) orbit = move;
      } else if (cd < stand * 1.4) {
        const bearing = Math.atan2(t.y - chase.y, t.x - chase.x) +
                        ((t.phase || 0) > Math.PI ? 0.7 : -0.7);
        orbit = { x: chase.x + Math.cos(bearing) * stand,
                  y: chase.y + Math.sin(bearing) * stand };
      }
    }
    /* A ship keeping pace with somebody steers for a point a little ahead of
       its slot, not the slot itself. Aimed at the slot, a hull that turns
       slower than it closes overshoots, comes about, and spends its life
       looping round the spot it was meant to be holding. */
    const velOf = o => o === me ? [me.vx || 0, me.vy || 0]
      : [(o.vx || 0) + (o.dvx || 0), (o.vy || 0) + (o.dvy || 0)];
    let carrot = null;
    if (follow) {
      const v = velOf(follow);
      carrot = { x: goal.x + v[0] * 1.2, y: goal.y + v[1] * 1.2 };
    }
    let steer = move || orbit || carrot || goal;
    /* An ace in a fight does not fly a clean line. It jinks across the line
       to whatever it is fighting, on its own rhythm. */
    if (chase && armed && skill > 0.35 && !t.boss) {
      const across = Math.atan2(chase.y - t.y, chase.x - t.x) + Math.PI / 2;
      const jink = Math.sin(clock * 1.9 + (t.phase || 0) * 3) * 260 * U * (skill - 0.35);
      steer = { x: steer.x + Math.cos(across) * jink, y: steer.y + Math.sin(across) * jink };
    }
    let aim = (t.angry || fleeing || t.breakOff > 0 || t.hunted > 0)
              ? steer : dodgeWells(t, steer);
    /* And they steer round *you*. Nothing out here made any attempt to avoid
       the player, so a freighter on a route that happens to cross where you are
       parked flew into you and kept flying into you. Anything not actively
       coming for you gives way — which is also what makes the ones that do not
       give way read as a threat. */
    if (!t.angry && me.alive && near < 900 * U) {
      const away = Math.atan2(t.y - me.y, t.x - me.x);
      const push = (900 * U - near) * 1.4;
      aim = { x: aim.x + Math.cos(away) * push,
              y: aim.y + Math.sin(away) * push };
    }
    const dx = aim.x - t.x, dy = aim.y - t.y;
    const d = Math.hypot(dx, dy) || 1;
    // A strafing boss points one way and flies another.
    const want = move && move.face != null ? move.face : Math.atan2(dy, dx);
    let diff = want - t.a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const hullSpec = specOf(t);
    /* `TURN`, the same constant your own hull turns on — not the 1.4 this
       used to carry. That 1.4 predated hulls having their own turn numbers
       and survived the rewrite that put acceleration and drag on the shared
       ones, so the comment below claimed three numbers were shared while two
       of them were: a bot turned at 44% of your rate in the same hull, which
       is why a fast enemy could always be out-circled however good its hull
       was on paper. Measured before and after on six hulls. */
    /* And the turn falls off with speed the way yours does — `bite` is one on
       everything but the commuters. A hull that handled differently depending
       on who was holding it would undo the whole point of `samehull`. */
    const cruiseNow = MAX_SPEED * hullSpec.speed * U;
    const fastFrac = cruiseNow > 0
      ? Math.min(1, Math.hypot(t.vx || 0, t.vy || 0) / cruiseNow) : 0;
    const tBite = hullSpec.bite == null ? 1 : hullSpec.bite;
    const trafficTurn = TURN * hullSpec.turn * (1 - (1 - tBite) * fastFrac);
    t.a += Math.max(-trafficTurn * dt, Math.min(trafficTurn * dt, diff));

    /* ── a hull carries what it already had ────────────────────────────
       Everything out here used to move *exactly* along its nose at exactly
       its cruising speed: turn the heading and the whole velocity turned with
       it, in the same frame, with nothing left over. That is how an insect
       moves. It is why the sector read as a field of bugs rather than a lane
       of ships — you are the only thing in it that drifts, and the difference
       is visible in every corner anything takes.

       So the engine pushes along the nose and the velocity *chases* it. A
       ship coming about slides through the turn, carries its old heading for
       half a second, and settles onto the new one — which is the same
       arithmetic your own hull has always used, arrived at from the other
       direction.

       Acceleration, turn and drag now decide whether a hull feels like a barge
       or a wasp. Those are the same three numbers for the player and the bot;
       a different pilot no longer means different physics — and since the
       turn constant was brought into line, that sentence is true of all three
       rather than of two of them.

       One thing is still yours alone, and deliberately: `boost`, the
       allowance that lets you carry speed above your own ceiling after a
       gravity-well slingshot. Reading a well is a manoeuvre rather than a
       stat, and it is the one the sector rewards you for knowing. */
    const size = hullSpec.size || 1;
    /* The same drive facts the player buys: acceleration pushes along the
       nose, drag keeps the old heading alive through a turn, and speed is the
       ceiling. A Jackal in somebody else's hands therefore handles like the
       Jackal in the hangar rather than like a generic role with its outline. */
    if (t.vx === undefined) { t.vx = 0; t.vy = 0; }
    /* The drive winds up for them too. `spool` is nought on everything but
       the commuters and the haulers, so every other hull out there gets full
       thrust on the first frame exactly as before — and a commuter pulling
       away from a station takes as long about it in somebody else's hands as
       it does in yours. */
    if (hullSpec.spool > 0) {
      t.spun = Math.min(1, (t.spun || 0) + dt / hullSpec.spool);
    } else t.spun = 1;
    const wind = hullSpec.spool > 0 ? t.spun : 1;
    // Not for a boss that strafes: its drive is steered, not behind it.
    if (!(move && move.v)) {
      t.vx += Math.cos(t.a) * THRUST * hullSpec.accel * wind * U * dt;
      t.vy += Math.sin(t.a) * THRUST * hullSpec.accel * wind * U * dt;
    }
    const hullDamp = Math.exp(-hullSpec.drag * dt);
    t.vx *= hullDamp; t.vy *= hullDamp;
    /* ── the throttle ────────────────────────────────────────────────────
       Every ship out here flew flat out at its cruising speed, all the time,
       until something stopped it. Ric: bots "should be able to choose to go
       slower than their controls". So each one picks a speed for what it is
       doing, and its drive holds it there:

         a place      eases off on the way in, and comes up to a dock slowly
         following    the pace of whoever it follows, plus enough to close
                      the gap, so a wing holds formation instead of
                      overshooting and a tail sits where it means to
         circling     no slower than what it is circling, or it falls behind
         otherwise    its cruising speed, as before

       The engine keeps pushing along the nose either way, because that push
       is what swings the velocity round in a turn. What changes is that
       anything over the chosen speed is taken off by the same drive running
       backwards, at the rate that drive can actually manage. */
    /* In a fight or a chase, a good pilot pushes the hull. A novice flies
       everything at its cruising speed. */
    const pushed = MAX_SPEED * hullSpec.speed * Math.min(1, 0.72 + 0.28 * skill);
    // A ship with no cruising speed is not under way, and is not pushed.
    let cruise = ((chase || running) && t.speed > 0
      ? Math.max(t.speed, pushed) : t.speed) * U;
    if (t.dash > 0) cruise *= 2.1;
    const cap = follow ? cruise * 1.15 : cruise;
    const brake = THRUST * hullSpec.accel * U * 2;
    let pace = cruise;
    if (place) {
      const left = Math.max(0, Math.hypot(goal.x - t.x, goal.y - t.y) - 160);
      /* A comfortable braking rate rather than everything the drive has:
         nobody docks at full retro. */
      const ease = Math.min(brake * 0.25, 90 * U);
      pace = Math.min(cruise, Math.max(60 * U, Math.sqrt(2 * ease * left)));
    } else if (follow) {
      /* Its leader's speed, plus or minus however far it is behind or ahead
         of its slot *along the way they are going*. Sideways is the
         steering's job. */
      const v = velOf(follow), lv = Math.hypot(v[0], v[1]);
      const gx = goal.x - t.x, gy = goal.y - t.y;
      const along = lv > 1 ? (gx * v[0] + gy * v[1]) / lv : Math.hypot(gx, gy);
      // Well out of position, it simply hurries back.
      pace = Math.hypot(gx, gy) > 260 ? cap
           : Math.max(lv * 0.5, Math.min(cap, lv + along * 0.6));
    } else if (orbit) {
      const v = velOf(chase);
      pace = Math.min(cruise, Math.max(Math.hypot(v[0], v[1]), cruise * 0.55));
    } else if (move) {
      pace = move.pace != null ? Math.min(cruise, move.pace) : cruise;
    }
    t.pace = pace;
    /* A strafing boss's drive is not behind it: its velocity goes where the
       fight wants it, whichever way the hull is pointing. */
    if (move && move.v) {
      const k = Math.min(1, 5 * dt);
      t.vx += (move.v[0] - t.vx) * k;
      t.vy += (move.v[1] - t.vy) * k;
    }
    const engineSpeed = Math.hypot(t.vx, t.vy);
    if (engineSpeed > pace && !(move && move.v)) {
      const k = Math.min(cap, Math.max(pace, engineSpeed - brake * dt)) / engineSpeed;
      t.vx *= k; t.vy *= k;
    }
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    /* A world and a dead hull are solid to everybody, not only to you. And
       the velocity goes with the push: a ship now *has* one, so without this
       it keeps driving into the surface it was just moved off and grinds
       along it until the eight-second watchdog notices. */
    if (solidBounce(t, hullR(t))) bounceOff(t, 1.3);

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
          if (blocked) { t.cool = 0.25; continue; }
          const guns = specOf(t);
          /* A claw has no reach. The utility hulls do not carry a gun at all —
             they carry a pair of jaws — so in somebody else's hands they do
             not fire one either. A working tug that sniped across a sector
             would be the roster saying one thing and the sector another. */
          if (guns.weapon === "claw") { t.cool = 1.4; continue; }
          /* The guns point forward, so they fire forward. They swing a
             quarter turn either side of the nose, which covers a ship
             circling its target at gun range, and nothing behind that: a
             round coming backwards out of a forward barrel is not a round
             anybody fired. It waits until it has come round. */
          let off = a - t.a;
          while (off > Math.PI) off -= Math.PI * 2;
          while (off < -Math.PI) off += Math.PI * 2;
          // The admiral's guns are turrets down its flanks: they fire any way.
          if (Math.abs(off) > Math.PI / 2 && t.boss !== "admiral") { t.cool = 0.2; continue; }
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
  }
}

/* ── hull against hull, out there ──────────────────────────────────────────
   Ric: "make it so bots that are friendly with each other can run into each
   other". Nothing out here could touch anything else: a convoy's escort flew
   straight through its hauler, a wing sat inside itself, and two ships on
   the same lane passed through each other like light. You were the only
   solid ship in the sector.

   So every pair is asked. Overlapping, they are pushed apart by mass (a Kite
   does not move a Gantry, the same `shoveShare` your own hull uses) and the
   part of their velocities that was closing is traded off, with a little
   lost. Friends just bump. Enemies meeting hard, at a closing speed that
   would hurt you, take a point each; a warlord's ram takes two off whatever
   it hits and nothing off itself. Only ships within a hull or two of each
   other are measured, so the cost stays small. */
function trafficBumps() {
  const list = surv.traffic;
  // Each hull's circle once, not once per pair.
  const rs = list.map(hullR);
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const ra = rs[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const min = ra + rs[j];
      const dx = b.x - a.x;
      if (dx > min || dx < -min) continue;
      const dy = b.y - a.y;
      if (dy > min || dy < -min) continue;
      let d = Math.hypot(dx, dy);
      if (d >= min) continue;
      let nx = dx / (d || 1), ny = dy / (d || 1);
      if (d < 0.001) { nx = 1; ny = 0; d = 0; }
      const sa = specOf(a), sb = specOf(b);
      const ma = hullMass(sa) * (a.scale || 1) ** 2, mb = hullMass(sb) * (b.scale || 1) ** 2;
      const wa = mb / (ma + mb), wb = ma / (ma + mb);
      const over = min - d;
      a.x -= nx * over * wa; a.y -= ny * over * wa;
      b.x += nx * over * wb; b.y += ny * over * wb;
      const avx = a.vx || 0, avy = a.vy || 0, bvx = b.vx || 0, bvy = b.vy || 0;
      const closing = (avx - bvx) * nx + (avy - bvy) * ny;
      if (closing <= 0) continue;
      // Trade the closing part, by mass, and lose a fifth of it.
      const j2 = closing * 1.6;
      a.vx = avx - nx * j2 * wa; a.vy = avy - ny * j2 * wa;
      b.vx = bvx + nx * j2 * wb; b.vy = bvy + ny * j2 * wb;
      if (closing < 120 * U) continue;
      const foes = atWar(a.faction, b.faction) || a.angryAt === b || b.angryAt === a;
      for (const [hit, by] of [[a, b], [b, a]]) {
        if (hit.bumped > 0) continue;
        if (by.boss === "warlord") {
          hit.bumped = 0.8; takeHit(hit, 2); hurtBySomebody(hit, by);
        } else if (foes && !hit.boss) {
          hit.bumped = 0.8; takeHit(hit, 1); hurtBySomebody(hit, by);
        }
      }
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].hp <= 0) killTraffic(i, false);
  }
}

/* ── gravity, for everybody ───────────────────────────────────────────────
   "Gravity affects everyone" was true of every object in the game that had a
   velocity — the player, rocks, bullets, salvage, debris — and traffic was the
   one class that did not have one. A ship out here flies on a heading and a
   speed, so a hauler could cross a supermassive well's reach on a dead straight
   line while you were fighting the same well two hundred units away. The rule
   was universal in the code and not in the sky, which is the worst of both.

   So they carry a drift: a velocity nothing but gravity ever writes, added to
   wherever the engine was taking them, and bled off once they are clear. A ship
   under power out-flies a shallow pull and cannot out-fly a deep one — the same
   arithmetic the warning already does for you, with the same answer. */
const DRIFT_BLEED = 0.6;         // per second, once clear of every well
function trafficDrift(t, dt) {
  let pull = 0;
  t.dvx = t.dvx || 0; t.dvy = t.dvy || 0;
  for (const h of hazards) {
    if (!hazardActive(h)) continue;
    const dx = h.x - t.x, dy = h.y - t.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > h.reach * h.reach) continue;
    const d = Math.sqrt(d2) || 0.001;
    const a = h.mass / (d2 + h.soft * h.soft);
    t.dvx += (dx / d) * a * dt;
    t.dvy += (dy / d) * a * dt;
    pull += a;
  }
  if (!pull) {
    // Clear of it: it gets back on course rather than coasting off into the
    // dark for the rest of the run on gravity it met ten minutes ago.
    const k = Math.max(0, 1 - DRIFT_BLEED * dt);
    t.dvx *= k; t.dvy *= k;
  }
  t.x += t.dvx * dt;
  t.y += t.dvy * dt;
  return pull;
}

/* And they steer round the things they can see. Not cleverly — a push away from
   anything whose reach they are inside, added to wherever they were going, which
   is enough to make the lanes bend around a well the way you would expect.

   Only when they have the attention to spare. A ship running for its life, or
   one with somebody in its sights, gets no dodge at all — which is precisely
   why a chase past a star is how one of these dies, and why that death is an
   accident rather than a scripted event. */
function dodgeWells(t, goal) {
  let ox = 0, oy = 0;
  for (const h of hazards) {
    if (!hazardActive(h)) continue;
    const dx = t.x - h.x, dy = t.y - h.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > h.reach * 1.15) continue;
    const push = (h.reach * 1.2 - d) * 1.5;
    ox += (dx / d) * push;
    oy += (dy / d) * push;
  }
  return (ox || oy) ? { x: goal.x + ox, y: goal.y + oy } : goal;
}

/* ── a want, turned into somewhere to be ──────────────────────────────────
   One function, one answer per role, and none of them is longer than a few
   lines — that is the point of wants over behaviour. Everything re-picks its
   target on a slow clock rather than every frame, so a pirate does not
   dither between two haulers and a scavenger does not turn round the moment
   something closer appears. */
/* Whether a ship will put in at a station. Nobody docks under the flag of the
   power they are at war with: a hauler does not deliver to the enemy, a ship
   running for its life does not run into the enemy's yard, and a patrol has
   no business keeping the peace at somebody else's. */
const dockableBy = (st, faction) =>
  !(st.faction && st.faction !== "free" && atWar(faction, st.faction));
const ownDock = (st, faction) => !!st.faction && st.faction === faction;

/* Off its client's shoulder: its own convoy slot if it has one, and
   otherwise a length behind. */
function guardSpot(t) {
  const c = t.client;
  const sl = t.slot || { back: 260 * U, side: 0 };
  const ca = Math.cos(c.a), sa = Math.sin(c.a);
  return { x: c.x - ca * sl.back - sa * sl.side,
           y: c.y - sa * sl.back + ca * sl.side };
}

function wantOf(t, dt) {
  t.think = (t.think || 0) - dt;
  const spec = ROLES[t.role || t.kind] || ROLES.freight;

  /* Whatever it decided last time, while that thing still exists. A target
     that has been destroyed drops the want back to the route. */
  if (t.mark && t.markKind) {
    const live = t.markKind === "ship" ? surv.traffic.indexOf(t.mark) >= 0
               : t.markKind === "hulk" ? surv.hulks.indexOf(t.mark) >= 0
               : true;
    if (!live) { t.mark = null; t.markKind = ""; t.think = 0; }
  }
  /* An escort's mark is its client, but where it wants to *be* is off the
     client's shoulder. Handing back the client itself on every frame after
     the first made the escort chase its own client, and circle it at gun
     range like something that meant it harm. */
  /* A boss keeps to its own sky. Whatever it wants, it does not follow it
     out of the disc. */
  if (t.lair && Math.hypot(t.x - t.lair.x, t.y - t.lair.y) > t.lair.r * 0.6) {
    t.mark = null; t.markKind = "";
    return { x: t.lair.x, y: t.lair.y };
  }
  if (t.think > 0 && t.mark) {
    return t.markKind === "ship" && t.mark === t.client ? guardSpot(t) : t.mark;
  }

  t.think = 1.4 + Math.random() * 1.6;

  switch (spec.want) {
    case "deliver": {
      /* A station, and it prefers one that is short of what it is carrying —
         which is the join between 6.1 and 6.2. A hauler is not wandering; it is
         taking iron to the place that wants iron. */
      let best = null, score = -1;
      for (const st of surv.stations) {
        const d = Math.hypot(st.x - t.x, st.y - t.y);
        /* Not the dock it has just left. This was "not anything within 400",
           which is also every station a hauler is coming in to: at 400 out it
           lost interest in the station it was docking at, turned away, came
           back in range, and turned back. Haulers circled stations at 400
           for good. */
        if (st === t.lastDock || !dockableBy(st, t.faction)) continue;
        // Its own side's docks first, all else being close.
        let s2 = 1 / (1 + d / 9000) + (ownDock(st, t.faction) ? 0.35 : 0);
        for (const key of t.cargo) s2 += shortageOf(st, key) * 1.6;
        if (s2 > score) { score = s2; best = st; }
      }
      if (best) { t.mark = best; t.markKind = "station"; return best; }
      break;
    }
    case "rob": {
      /* The loaded one. A pirate that took the nearest ship regardless of what
         it had would be an enemy with a flight path; wanting the *cargo* is
         what makes a laden hauler a worse place to be than an empty one. */
      let best = null, score = 0;
      for (const o of surv.traffic) {
        if (o === t || o.faction === "pirate") continue;
        if (ROLES[o.role || o.kind] && ROLES[o.role || o.kind].armed) continue;
        const d = Math.hypot(o.x - t.x, o.y - t.y);
        if (d > 5200 * U) continue;
        const worth = o.cargo.reduce((a, k) => a + matSpec(k).value, 0) + 1;
        const s2 = worth / (1 + d / 1400);
        if (s2 > score) { score = s2; best = o; }
      }
      if (best) {
        t.mark = best; t.markKind = "ship";
        best.hunted = 2.5;            // and it knows about it
        return best;
      }
      /* No ship worth the trouble. A pirate with nothing to rob will still
         take what is lying about — which is how the thing you died holding
         becomes something somebody else is flying towards, and why you come
         back for it rather than at your leisure. */
      const spoil = lootNear(t, 4200 * U);
      if (spoil) { t.mark = spoil.it; t.markKind = spoil.kind; return spoil.it; }
      break;
    }
    case "guard": {
      /* Its client: the nearest unarmed ship of its own flag. An escort with
         nobody to escort goes back to walking its line, which is what an escort
         with nobody to escort would do. */
      /* The hauler it came out with, first. Nearest of its own flag only
         when it has no convoy, or the convoy is gone: an escort that swapped
         to whichever hauler happened to pass nearer left its own unguarded. */
      const lead = t.leader && surv.traffic.indexOf(t.leader) >= 0 &&
                   ROLES[t.leader.role || t.leader.kind] &&
                   !ROLES[t.leader.role || t.leader.kind].armed ? t.leader : null;
      let best = lead, bd = 6000 * U;
      if (!best) {
        for (const o of surv.traffic) {
          if (o === t || o.faction !== t.faction) continue;
          const r = ROLES[o.role || o.kind];
          if (!r || r.armed) continue;
          const d = Math.hypot(o.x - t.x, o.y - t.y);
          if (d < bd) { bd = d; best = o; }
        }
      }
      if (best) {
        t.mark = best; t.markKind = "ship";
        t.client = best;
        return guardSpot(t);
      }
      break;
    }
    case "police": {
      /* Trouble. A pirate in the open first, then anything being hunted, then
         the station with the deepest shortage — because a station nobody can
         supply is where trouble is going to be. */
      let pirate = null, pd = 7000 * U;
      for (const o of surv.traffic) {
        if (o.faction !== "pirate") continue;
        const d = Math.hypot(o.x - t.x, o.y - t.y);
        if (d < pd) { pd = d; pirate = o; }
      }
      if (pirate) {
        t.mark = pirate; t.markKind = "ship";
        t.angryAt = pirate;
        return pirate;
      }
      let worst = null, worstShort = 0.45;
      for (const st of surv.stations) {
        // Its own side's stations, and the unflagged ones nobody else watches.
        if (st.faction && st.faction !== "free" && st.faction !== t.faction) continue;
        const m = marketOf(st);
        if (!m) continue;
        const s2 = Math.max(...Object.keys(m.want).map(k => m.want[k]), 0);
        if (s2 > worstShort) { worstShort = s2; worst = st; }
      }
      if (worst) { t.mark = worst; t.markKind = "station"; return worst; }
      break;
    }
    case "salvage": {
      /* Wreckage — and yes, the same wreckage you were going to strip. A
         scavenger racing you to a hulk is competition that nobody had to write
         as competition. */
      let best = null, bd = 6000 * U;
      for (const h of surv.hulks) {
        const d = Math.hypot(h.x - t.x, h.y - t.y);
        if (d < bd) { bd = d; best = h; }
      }
      /* And anything simply lying there, which after you die is your hold.
         Compared against the hulk rather than checked after it: a scavenger
         that flew past your spilled cargo to reach a wreck further away is a
         scavenger following a priority list, and the point of these is that
         they follow distance and worth. */
      const loot = lootNear(t, bd);
      if (loot) { t.mark = loot.it; t.markKind = loot.kind; return loot.it; }
      if (best) { t.mark = best; t.markKind = "hulk"; return best; }
      break;
    }
    case "survive": {
      // Anywhere that is not here, preferring a station that is not the enemy's.
      let best = null, bd = Infinity;
      for (const st of surv.stations) {
        if (!dockableBy(st, t.faction)) continue;
        const d = Math.hypot(st.x - t.x, st.y - t.y);
        if (d < bd) { bd = d; best = st; }
      }
      if (best) { t.mark = best; t.markKind = "station"; return best; }
      break;
    }
  }
  // Nothing to want: walk the line it was born with.
  t.mark = null; t.markKind = "";
  return t.leg > 0 ? t.to : t.from;
}

/* ── what is lying about ──────────────────────────────────────────────────
   The nearest loose thing a ship could simply fly over and keep: something
   you dropped, or a mote of salvage nobody has swept up.

   Deliberately *not* the manifest's parts, and not P4's scattered ones. Those
   sit at sites the sector regenerates, so "taking" one would either do
   nothing or make a run unfinishable depending on which way it was written,
   and neither is a fight anybody wants to have with a pirate. What is on the
   floor is what somebody already lost hold of. */
function lootNear(t, reach) {
  let best = null, bd = reach;
  for (const d of surv.dropped) {
    const dd = Math.hypot(d.x - t.x, d.y - t.y);
    if (dd < bd) { bd = dd; best = { kind: "drop", it: d }; }
  }
  /* Motes are worth less and there are far more of them, so they only win
     when they are properly closer — otherwise a scavenger spends its life
     hoovering crumbs beside the thing you actually wanted back. */
  for (const m of surv.motes) {
    const dd = Math.hypot(m.x - t.x, m.y - t.y);
    if (dd < bd * 0.55) { bd = dd; best = { kind: "mote", it: m }; }
  }
  return best;
}

/* Getting there. Most wants are satisfied by arriving, and what arriving *does*
   is where the economy hears about any of it. */
function arrived(t, goal) {
  const spec = ROLES[t.role || t.kind] || ROLES.freight;
  /* Docked with an empty hold: it loads, and so does its convoy, and the
     next want is somewhere else. Haulers only ever had what they were born
     with, so every hauler that had delivered once flew empty from then on,
     and after a while a sector's lanes were full of ships not worth robbing. */
  if (spec.want === "deliver" && t.markKind === "station" && !t.cargo.length) {
    const dock = t.mark;
    for (const o of surv.traffic) {
      if (o !== t && o.leadId !== t.id) continue;
      if (!o.cargo.length && !(ROLES[o.role || o.kind] || {}).armed) {
        o.cargo = trafficCargo(o.role || o.kind, depthAt(dock.x, dock.y), Math.random);
      }
      o.lastDock = dock;
    }
    t.think = 0;
    return;
  }
  if (spec.want === "deliver" && t.markKind === "station" && t.cargo.length) {
    /* A convoy got through. Whatever it was carrying, this station is that much
       less short of — which is 6.2's good news, and the only way a shortage
       ever eases apart from time. */
    for (const key of t.cargo) moveMarket(t.mark, key, -0.3);
    t.cargo = [];
    t.lastDock = t.mark;
    t.delivered = (t.delivered || 0) + 1;
    // Written down, not announced: a shortage easing somewhere is a fact about
    // a price, and a price is something you look up rather than something that
    // should interrupt you.
    chatter(factionOf(t.faction).short + " convoy unloading.", NEBULA, false);
    t.think = 0;
    saveSurveyBook();
  }
  /* It takes it. Both roles, one piece of code, because "a pirate took it"
     and "a scavenger took it" are the same event with a different flag on
     it — and said out loud by name, because the whole weight of this is you
     hearing what you have just lost while you are still flying back for it. */
  if (t.markKind === "drop") {
    const i = surv.dropped.indexOf(t.mark);
    if (i >= 0) {
      const d = surv.dropped[i];
      burst(d.x, d.y, "#ff8f77", 14, 210 * U);
      gameSound("rock", d.x, d.y);
      surv.dropped.splice(i, 1);
      surv.known.delete(knownId("part", d.x, d.y));
      chatter((t.faction === "pirate" ? "A pirate has taken your "
                                      : "A scavenger has taken your ") +
              (d.name || "cargo") + ".", "#ff8f77", t);
      saveSurveyBook();
    }
    t.mark = null; t.markKind = ""; t.think = 0;
  }
  if (t.markKind === "mote") {
    const i = surv.motes.indexOf(t.mark);
    if (i >= 0) { surv.motes.splice(i, 1); }
    t.mark = null; t.markKind = ""; t.think = 0;
  }
  if (spec.want === "salvage" && t.markKind === "hulk") {
    // It takes the wreck. You were too slow.
    const i = surv.hulks.indexOf(t.mark);
    if (i >= 0) {
      burst(t.mark.x, t.mark.y, WRECK, 12, 200 * U);
      gameSound("rock", t.mark.x, t.mark.y);
      if (t.mark.id) surv.stripped.add(t.mark.id);
      surv.hulks.splice(i, 1);
      chatter("A scavenger got to that one first.", "#ff8f77", t);
    }
    t.mark = null; t.markKind = ""; t.think = 0;
  }
}

/* Destroyed, by you or by somebody else. What it was carrying ends up on the
   floor either way — which is what makes robbing one a thing you can do, and
   failing to save one a thing that costs somebody else rather than you. */
/* Somebody has hit this ship. Two things follow, and neither of them used to.

   It **turns on whoever did it** — an armed ship that is being shot at has a
   more urgent problem than whatever it was doing, and until now the only
   thing in the sector that could earn a ship's attention was the player.

   And it **values its own life**. Below a third of its hull it breaks off and
   runs, whoever it was fighting, for long enough to get clear. A raider that
   presses a losing attack to the death is not a raider, it is a torpedo —
   and the sector reads completely differently when the thing chasing you can
   decide it has had enough. */
const BREAK_OFF = 9;              // seconds of running, once it has had enough
function hurtBySomebody(t, by) {
  if (!t) return;
  const armed = ROLES[t.role || t.kind] && ROLES[t.role || t.kind].armed;
  /* Only at an enemy. A round from its own side, or from anybody it is not
     at war with, was a stray, and a stray is not a declaration of war. It
     used to be: a third of the patrols in a busy sector ended up fighting
     their own wingmates after one of them clipped another, and the fight
     spread, because every hit it landed back was a stray the other way.
     Somebody who is actually coming for it is an enemy whatever its flag. */
  const foe = by && (atWar(t.faction, by.faction) || by.angryAt === t ||
                     (by.markKind === "ship" && by.mark === t));
  if (by && by !== t && surv.traffic.indexOf(by) >= 0 && armed && foe) {
    t.angryAt = by;
    t.mark = by; t.markKind = "ship"; t.think = 3;
    t.angry = false;              // it has a nearer enemy than you now
  }
  /* When it has had enough. A novice fights to a fifth of its hull; an ace
     leaves at close to half, while it still has a ship to come back in. A
     boss does not leave at all. */
  const nerve = 0.2 + 0.25 * Math.min(1, pilotSkill(t));
  if ((!t.boss || t.boss === "queen") && t.maxHp && t.hp > 0 &&
      t.hp <= t.maxHp * nerve) {
    t.breakOff = BREAK_OFF;
    t.fleeFrom = by && by !== t
      ? { x: by.x, y: by.y }
      : { x: ships[0].x, y: ships[0].y };
  }
}

/* How big a ship out here is, to a round, a rock or another hull: the
   circle its own outline makes, the same one that stops yours. It was a flat
   22 units a size, which is three times the drawn hull of a Lance, so rounds
   hit empty space beside the small ships and a Needle was a barn door. */
/* A round, a blast or a jaw landing on somebody else's ship. One place, so a
   shield (the Admiral's) is a shield against everything, and a queen knows
   when she was last touched. Returns what got through. */
function takeHit(t, dmg) {
  if (t.shield > 0) {
    const soak = Math.min(t.shield, dmg);
    t.shield -= soak; dmg -= soak;
    t.shieldFlash = 0.25;
  }
  t.hp -= dmg;
  t.hit = 0.12;
  t.lastHit = clock;
  return dmg;
}

function hullR(t) {
  const sp = specOf(t);
  return (sp.hitR || 9) * U * (sp.size || 1) * (t.scale || 1);
}

function killTraffic(i, byYou, swallowed) {
  const t = surv.traffic[i];
  burst(t.x, t.y, trafficColour(t), 26, 300 * U);
  gameSound("boom", t.x, t.y);
  addShake(4);
  let dropped = 0;
  for (const key of t.cargo) { dropKnownMote(t.x, t.y, key, 90); dropped++; }
  /* **Almost everything has something in it.** Three kinds of ship are pushed
     into the sector with an empty hold — the patrols fighting a battle, the
     hunters that come for you, and anything already robbed — so killing one
     left nothing at all behind. A wreck with nothing in it is a kill that did
     not happen as far as the sector is concerned, and it is indistinguishable
     from the drop being broken.

     So an empty hull still gives up its fittings nine times in ten. One in
     ten is nothing, which is the "low percentage" this is meant to be: enough
     that an empty wreck is a disappointment rather than a bug report. */
  if (!dropped && Math.random() < 0.9) {
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const roll = Math.random();
      dropKnownMote(t.x, t.y,
        roll < 0.34 ? "iron" : roll < 0.62 ? "alloy"
        : roll < 0.88 ? "ice" : "electronics", 90);
    }
  }
  /* A convoy that did not get through. Whatever it was carrying, the station
     that was expecting it is now shorter of it — and the shortage is a price, so
     the next thing that happens is that somebody else finds it worth the trip.
     This is the whole of 6.2 in four lines: pirates make prices. */
  if (t.cargo && t.cargo.length) {
    let near = null, nd = 26000;
    for (const st of surv.stations) {
      const d = Math.hypot(st.x - t.x, st.y - t.y);
      if (d < nd) { nd = d; near = st; }
    }
    const aim = t.markKind === "station" && t.mark ? t.mark : near;
    if (aim) for (const key of t.cargo) moveMarket(aim, key, 0.22);
  }
  /* **A ship does not leave a hulk.** It used to, for 6.5's sake — a convoy
     you destroyed leaving a wreck field is exactly the kind of consequence that
     phase is about — and it was wrong in the sky: a hulk is a big dead hull, the
     thing you strip for salvage, and a fighter you shot turning into one made
     the sector read as though hulks came out of ships. They do not. A hulk is
     something that died a long time ago.

     What a kill leaves is what it always left: the burst, and whatever it was
     carrying. Battles still lay out their own field of wrecks when they end,
     which is the version of this that was always right, because a battle is an
     event and a single kill is not. */
  if (t.id) surv.goneTraffic.add(t.id);
  surv.traffic.splice(i, 1);
  if (t.boss) bossDown(t, byYou);
  // Its attackers have nothing left to attack.
  for (const d of surv.drones) if (d.prey === t) d.prey = null;
  if (byYou) {
    surv.t.robbed = true;
    /* The cost of it, and it is not the cargo. A hunter is the exception —
       it came for you, and killing it settles nothing in either direction. */
    repForKill(t);
    if (!ROLES[t.role || t.kind] || !ROLES[t.role || t.kind].armed) {
      chatter("They were not armed.", "#ff8f77");
    }
  }
}

/* One mote of a known kind. Traffic drops what it was actually carrying rather
   than a roll, so robbing a hauler pays what the hauler had. */
function dropKnownMote(x, y, key, spread) {
  const a = Math.random() * Math.PI * 2;
  const sp = rand(20, 90) * U;
  surv.motes.push({ x: x + Math.cos(a) * rand(0, spread || 30),
                    y: y + Math.sin(a) * rand(0, spread || 30),
                    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                    spin: rand(0, 6.28), life: 90, mat: key });
}

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
