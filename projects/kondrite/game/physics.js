"use strict";

/* KONDRITE — PHYSICS
   ─────────────────────────────────────────────────────────────────────────────
   Camera, walls, the edge of the world, gravity, debris, deaths, the claw,
   firing what you bolted on, shoving and rock contact.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── camera ──────────────────────────────────────────────────────────────
   Survival frames the whole arena. Battle royale deliberately skips this
   clamp so its followed ship stays dead-centre, even beside an outer wall. */
function clampCam() {
  if (mode.camera) return;
  const halfW = SCREEN_W / (2 * cam.scale);
  const halfH = SCREEN_H / (2 * cam.scale);
  const c = Math.abs(Math.cos(cam.rot)), s = Math.abs(Math.sin(cam.rot));
  const extentX = c * halfW + s * halfH;
  const extentY = s * halfW + c * halfH;
  cam.x = arena.w <= extentX * 2 ? arena.w / 2
        : Math.min(Math.max(cam.x, extentX), arena.w - extentX);
  cam.y = arena.h <= extentY * 2 ? arena.h / 2
        : Math.min(Math.max(cam.y, extentY), arena.h - extentY);
}

function updateCamera(dt) {
  if (!mode.camera) return;
  // A mission can pull the camera back for a set-piece — the fleet warping in,
  // the mothership coming apart. Everywhere else goalScale stays 1, so this is
  // a no-op and the view is exactly as steady as it always was.
  if (mode.campaign && cam.goalScale !== cam.scale) {
    cam.scale += (cam.goalScale - cam.scale) * (1 - Math.exp(-3 * dt));
    if (Math.abs(cam.goalScale - cam.scale) < 0.002) cam.scale = cam.goalScale;
  }
  let s = ships[watching];
  // Network guests learn about eliminations from snapshots rather than
  // running killShip locally, so repair a stale camera target here too.
  const owner = ships[localSeat()];
  // Once our own ship is out, keep following the fight if the ship we were
  // watching is eliminated as well. While the owner is alive, another ship's
  // death must never steal this screen from them.
  if (owner && owner.dead && (!s || s.dead)) {
    const target = chooseSpectator(s || owner, null);
    if (target) { watching = target.id; s = target; }
  }
  if (!s) return;
  // Position is exact rather than eased: the world moves, the ship does not.
  cam.x = s.x;
  cam.y = s.y;

  // The original north-up view is the default. Rotating ship-up view is a
  // per-mode preference, local to this screen.
  if (!camRotates()) { cam.rot = 0; return; }

  // Taking the shortest angular route prevents a full spin at +/-PI.
  const targetRot = -Math.PI / 2 - s.a;
  let turn = targetRot - cam.rot;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  cam.rot += turn * (1 - Math.exp(-8 * dt));
  if (cam.rot > Math.PI) cam.rot -= Math.PI * 2;
  if (cam.rot < -Math.PI) cam.rot += Math.PI * 2;
  clampCam();
}

function onScreen(x, y, pad) {
  const dx = x - cam.x, dy = y - cam.y;
  const c = Math.cos(cam.rot), s = Math.sin(cam.rot);
  const rx = c * dx - s * dy;
  const ry = s * dx + c * dy;
  return Math.abs(rx) < SCREEN_W / (2 * cam.scale) + pad &&
         Math.abs(ry) < SCREEN_H / (2 * cam.scale) + pad;
}

/* ── walls ───────────────────────────────────────────────────────────────
   The arena is solid. Ships and rocks bounce; bullets are destroyed. Killing
   bullets at the wall is what stops a big map turning into a shooting
   gallery — every shot now has a real, finite range. */
/* Reflecting only the speed a body already had is fine for a wall that stays
   put, and wrong for one that moves. Anything drifting slowly — or sitting
   still — gets overtaken by the closing wall, clamped back to its face, and
   handed almost no outward speed, so the wall keeps catching it and carries
   it along for the rest of the match. That is what being stuck on the wall
   was: not a collision failing, a collision succeeding every frame.

   Two ships in one audited match hit it different ways. One was drifting at
   0.6 px/s when the wall arrived and rode it from then on; the other was
   travelling along the wall at 284 px/s, where the perpendicular speed being
   reflected was near zero, so it slid down the face instead of leaving it.
   Both are the same missing idea — leaving with at least the wall's own
   speed, and then some, so the wall can push you but never keep you. */
const WALL_SHOVE = 2.2;

function bounceInBounds(o, r, restitution) {
  let hit = false;
  const px = wallPush.x * WALL_SHOVE, py = wallPush.y * WALL_SHOVE;
  const off = (v, push) => Math.max(Math.abs(v) * restitution, push);
  if (o.x - r < bounds.x0) { o.x = bounds.x0 + r; o.vx = off(o.vx, px); hit = true; }
  else if (o.x + r > bounds.x1) { o.x = bounds.x1 - r; o.vx = -off(o.vx, px); hit = true; }
  if (o.y - r < bounds.y0) { o.y = bounds.y0 + r; o.vy = off(o.vy, py); hit = true; }
  else if (o.y + r > bounds.y1) { o.y = bounds.y1 - r; o.vy = -off(o.vy, py); hit = true; }
  return hit;
}

/* ── the edge of the world ────────────────────────────────────────────────
   Off one side and on at the other: Survival is the open field
   the original game had, where nothing can corner you and a rock you flee
   from arrives behind you. Battle royale keeps its walls, because a wall
   that closes in is the whole shape of that mode and there is nothing to
   close in on if the edges lead back round.

   Wrapping happens when the centre crosses, not the rim, so the copy drawn
   at the far edge is what covers the moment of crossing. */
function wrapInBounds(o) {
  const w = bounds.x1 - bounds.x0, h = bounds.y1 - bounds.y0;
  if (o.x < bounds.x0) o.x += w; else if (o.x > bounds.x1) o.x -= w;
  if (o.y < bounds.y0) o.y += h; else if (o.y > bounds.y1) o.y -= h;
}

function edgeOf(o, r, restitution) {
  if (mode.wrap) { wrapInBounds(o); return false; }
  return bounceInBounds(o, r, restitution);
}

/* Distance, the short way round. Without this a ship sitting on the seam is
   drawn touching a rock it is nowhere near in the arithmetic, and shots pass
   straight through the thing you can see them hitting. */
function sepX(ax, bx) {
  const d = ax - bx;
  if (!mode.wrap) return d;
  const w = bounds.x1 - bounds.x0;
  return d > w / 2 ? d - w : d < -w / 2 ? d + w : d;
}

function sepY(ay, by) {
  const d = ay - by;
  if (!mode.wrap) return d;
  const h = bounds.y1 - bounds.y0;
  return d > h / 2 ? d - h : d < -h / 2 ? d + h : d;
}

const gap2 = (ax, ay, bx, by) => sepX(ax, bx) ** 2 + sepY(ay, by) ** 2;

function updateWall(dt) {
  if (!mode.closing) { wallPush.x = wallPush.y = 0; return; }
  const t = Math.max(0, clock - CLOSE_DELAY);
  const k = Math.min(1, t / CLOSE_TIME);
  const f = 1 - (1 - CLOSE_TO) * k;          // 1 → CLOSE_TO
  /* How fast each wall is travelling inward right now. The bounce needs this:
     a wall that is moving has to be able to push, and a body it catches has to
     leave faster than the wall is coming, or the wall simply carries it. */
  const moving = k < 1;
  wallPush.x = moving ? (arena.w / 2) * (1 - CLOSE_TO) / CLOSE_TIME : 0;
  wallPush.y = moving ? (arena.h / 2) * (1 - CLOSE_TO) / CLOSE_TIME : 0;
  const w = arena.w * f, h = arena.h * f;
  bounds = {
    x0: (arena.w - w) / 2, y0: (arena.h - h) / 2,
    x1: (arena.w + w) / 2, y1: (arena.h + h) / 2
  };
  // Rocks caught outside the wall are crushed rather than left stranded.
  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i];
    if (r.x < bounds.x0 - r.r || r.x > bounds.x1 + r.r ||
        r.y < bounds.y0 - r.r || r.y > bounds.y1 + r.r) {
      burst(r.x, r.y, "#ffcb42", 8, 130 * U);
      gameSound("rock", r.x, r.y);
      rocks.splice(i, 1);
    }
  }
}

// Once the shrinking wall has passed a hazard, that hazard is no longer in
// the playable arena. It stays fixed in world space but cannot pull or kill
// through the wall from outside it.
function hazardActive(h) {
  return !mode.closing ||
    (h.x >= bounds.x0 && h.x <= bounds.x1 &&
     h.y >= bounds.y0 && h.y <= bounds.y1);
}

/* ── gravity ─────────────────────────────────────────────────────────────
   Applied to anything with a velocity: ships, rocks and bullets. Bullets
   matter most — a shot fired past a black hole curves, so the hazards change
   where you can shoot from, not just where you can fly. */
// Returns the total pull applied, so a caller can tell whether this body is
// currently in a well.
function applyGravity(o, dt) {
  let pull = 0;
  for (const h of hazards) {
    if (!hazardActive(h)) continue;
    const dx = h.x - o.x, dy = h.y - o.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > h.reach * h.reach) continue;
    const d = Math.sqrt(d2) || 0.001;
    const a = h.mass / (d2 + h.soft * h.soft);
    o.vx += (dx / d) * a * dt;
    o.vy += (dy / d) * a * dt;
    pull += a;
  }
  return pull;
}

/* ── debris ──────────────────────────────────────────────────────────────
   A hazard's pull is invisible, which makes it a trap rather than a place.
   So each one is permanently shedding debris: motes appear out at the edge of
   its reach and fall in, accelerated by the same gravity that moves
   everything else. The stream *is* the boundary marker — where you first see
   specks turning inward is exactly where the pull begins to matter, and how
   fast they move tells you how hard it grips. Purely cosmetic; nothing
   collides with them. */
function newMote(h) {
  const t = rand(0, Math.PI * 2);
  const r = h.reach * rand(0.88, 1);
  const tang = rand(-1, 1) * (h.kind === "hole" ? 55 : 35);
  return {
    h,
    x: h.x + Math.cos(t) * r,
    y: h.y + Math.sin(t) * r,
    // A little sideways drift so they spiral in instead of falling dead straight.
    vx: -Math.sin(t) * tang,
    vy: Math.cos(t) * tang
  };
}

function seedMotes() {
  motes = [];
  for (const h of hazards) {
    for (let i = 0; i < MOTES_PER_HAZARD; i++) {
      const m = newMote(h);
      // Stagger the first batch along the way in, or they all arrive together.
      const k = rand(0.15, 1);
      m.x = h.x + (m.x - h.x) * k;
      m.y = h.y + (m.y - h.y) * k;
      motes.push(m);
    }
  }
}

function updateMotes(dt) {
  for (let i = 0; i < motes.length; i++) {
    const m = motes[i], h = m.h;
    const dx = h.x - m.x, dy = h.y - m.y;
    const d2 = dx * dx + dy * dy;
    const d = Math.sqrt(d2) || 0.001;
    const a = h.mass / (d2 + h.soft * h.soft);
    m.vx += (dx / d) * a * dt;
    m.vy += (dy / d) * a * dt;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    // Swallowed, or flung back out past the edge — either way, start again.
    if (d < h.kill || d > h.reach * 1.15) motes[i] = newMote(h);
  }
}

// Returns the hazard that just swallowed this point, if any.
function hazardAt(x, y, r) {
  for (const h of hazards) {
    if (!hazardActive(h)) continue;
    if (dist2(x, y, h.x, h.y) < (h.kill + r) ** 2) return h;
  }
  return null;
}

function burst(x, y, colour, n, speed) {
  if (reduceMotion) n = Math.min(n, 6);
  for (let i = 0; i < n; i++) {
    const d = rand(0, Math.PI * 2), s = rand(speed * 0.3, speed);
    bits.push({
      x, y, vx: Math.cos(d) * s, vy: Math.sin(d) * s,
      life: rand(0.35, 0.95), max: 0.95, colour, len: rand(4, 11)
    });
  }
}

function closestAliveShip(fromShip) {
  let best = null, bestD = Infinity;
  for (const s of ships) {
    // A ship between stocks still has an old death position and will jump to
    // its spawn point. Following it would make the camera jump twice.
    if (!s.alive || s.dead || s === fromShip) continue;
    const d = Math.hypot(s.x - fromShip.x, s.y - fromShip.y);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

function chooseSpectator(ship, shooter) {
  const killer = shooter || (ship.killedBy == null ? null : ships[ship.killedBy]);
  if (killer && killer !== ship && killer.alive && !killer.dead) return killer;
  return closestAliveShip(ship);
}

/* ── deaths ──────────────────────────────────────────────────────────── */
function damageShip(ship, cause, shooter, dmg = 1) {
  const twoHitCause = cause === "shot" || cause === "rock";
  /* The Leviathan lab is a playtest bench. Damage feedback is useful in the
     game; losing the ship while inspecting geometry is not. Keep the hull at
     full strength and leave every destructive path below untouched for the
     real Survey save. */
  if (mode.survey && LEV_ONLY) {
    ship.hull = ship.maxHull;
    ship.alive = true;
    return false;
  }
  /* Survey's hull runs down to zero and *stops* there. It used to reset — a
     hull loss put you back to full and cost you half your hold, so the mode
     had no fail state and no stakes, which is the thing this phase reverses.

     Zero is survivable and is meant to be terrifying: you can still fly, you
     can still get to a star and mend, and the next thing that touches you
     kills you. That single point of grace is what makes it a decision rather
     than an ambush. See SURVEY-PLAN.md phase 2.1. */
  /* The Flagship Screen takes the hit instead, whatever it was, and is down
     for twelve seconds. */
  if (mode.survey && surv && ship === ships[0] && surv.screenUp && mods().screen) {
    surv.screenUp = false;
    surv.screenT = 12;
    ship.invuln = Math.max(ship.invuln, HIT_SHIELD);
    burst(ship.x, ship.y, "#ff4dd2", 14, 180 * U);
    gameSound("hit", ship.x, ship.y);
    return false;
  }
  if (mode.survey) {
    // Anything that touches you drops the drive: you cannot run at light with
    // something scraping down the side of the hull.
    if (surv.lightRun > 0) {
      surv.lightRun = 0;
      surv.lightHit = null;
      chatter("Light drive cut.", "#ff8f77");
    }
    if (ship.hull > 0) {
      ship.hull -= dmg;
      if (ship.hull < 0) ship.hull = 0;
      ship.invuln = Math.max(ship.invuln, HIT_SHIELD);
      burst(ship.x, ship.y, ship.hull > 0 ? ship.colour : "#ff8f77",
            ship.hull > 0 ? 10 : 22, (ship.hull > 0 ? 150 : 260) * U);
      gameSound("hit", ship.x, ship.y);
      if (ship.hull === 0) {
        addShake(7);
        chatter("Hull gone. The next one kills you — find a star.", "#ff8f77");
      }
      return false;
    }
    surveyDie(cause);
    return false;
  }
  if (mode.campaign) {
    // A capital under shield eats shots without flinching — its shield
    // generators are what you have to break first, and the spark says so.
    if (ship.shielded && twoHitCause) {
      ship.invuln = Math.max(ship.invuln, HIT_SHIELD * 0.5);
      burst(ship.x, ship.y, "#87d8ff", 6, 120 * U);
      if (Math.random() < 0.3) gameSound("hit", ship.x, ship.y);
      return false;
    }
    // Everything in a mission has a hull; a hit spends one point of it (a
    // salvaged heavy round spends two) and only the last one is fatal.
    // Fighters have two, transports and subsystems many, so the same rule
    // makes both a duel and a siege.
    if (twoHitCause && ship.hull > dmg) {
      ship.hull -= dmg;
      ship.invuln = Math.max(ship.invuln, ship.kind === "fighter" ? HIT_SHIELD : 0.12);
      burst(ship.x, ship.y, ship.colour, ship.kind === "fighter" ? 10 : 6, 150 * U);
      gameSound("hit", ship.x, ship.y);
      return false;
    }
    // The core doesn't just die — it comes apart. Hand it to the finale and
    // keep it on screen; the ship is never `killShip`ed, so it stays drawable
    // while it breaks up.
    if (ship.kind === "mothership") { beginFinale(); return true; }
    killShip(ship, cause, shooter);
    return true;
  }
  if (mode.pvp && twoHitCause && ship.hull > 1) {
    ship.hull--;
    ship.invuln = Math.max(ship.invuln, HIT_SHIELD);
    burst(ship.x, ship.y, ship.colour, 10, 150 * U);
    gameSound("hit", ship.x, ship.y);
    return false;
  }
  killShip(ship, cause, shooter);
  return true;
}

function addKillFeed(ship, cause, shooter) {
  const source = shooter && shooter !== ship
    ? shooter.name
    : cause === "rock" ? "ASTEROID"
    : cause === "hole" ? "BLACK HOLE"
    : cause === "star" ? "SUN"
    : "ENVIRONMENT";
  killFeed.unshift({
    source,
    victim: ship.name,
    colour: shooter && shooter !== ship ? shooter.colour : "#ffcb42",
    until: clock + 3.8
  });
  killFeed.length = Math.min(killFeed.length, 4);
}

function killShip(ship, cause, shooter) {
  ship.alive = false;
  ship.hull = 0;
  ship.burstLeft = 0;
  ship.cool = 0;
  ship.deaths++;
  ship.killedBy = shooter && shooter !== ship ? shooter.id : null;
  if (cause !== "shot" && cause !== "ff") ship.envDeaths++;
  burst(ship.x, ship.y, ship.colour, 22, 240 * U);
  gameSound("explode", ship.x, ship.y);

  if (mode.campaign) { campaignKill(ship, cause, shooter); return; }

  if (mode.pvp) {
    if (shooter && shooter !== ship) shooter.kills++;
    addKillFeed(ship, cause, shooter);
    ship.stocks--;
    if (ship.stocks > 0) {
      ship.respawn = RESPAWN_WAIT;
    } else {
      ship.dead = true;
      ship.survivedFor = clock;
      const standing = ships.filter(s => !s.dead);
      const target = standing.length > 1 ? chooseSpectator(ship, shooter) : null;
      // Each screen belongs to its local seat. A ship being watched through
      // Tab is not allowed to steal that screen when it gets eliminated.
      if (ship.id === localSeat()) {
        terminated = { t: TERMINATED_HOLD };
        if (target) watching = target.id;
      }
    }
    checkRoyaleEnd();
    return;
  }

  if (cause === "ff") {
    ffCount++;
    score = Math.max(0, score - FF_PENALTY);
    banner = {
      text: "FRIENDLY FIRE",
      sub: "−" + FF_PENALTY + " and a life off the pile",
      t: 2.0,
      colour: "#ff8f77"
    };
  }

  if (lives > 0) {
    lives--;
    ship.respawn = RESPAWN_WAIT;
  } else {
    ship.dead = true;
    ship.survivedFor = clock;
    if (shooter && shooter !== ship) watching = shooter.id;
    if (ships.every(s => s.dead)) endMatch({ kind: "lost" });
  }
}

function endMatch(result) {
  /* A machine played from inside a survey records what it made, here, while
     the match's own `clock` and `wave` still mean something. It is kept on
     `returnTo` rather than written to the book: the book belongs to a sector
     that is not loaded right now. See `backToSurvey`. */
  if (returnTo) {
    const got = simResult(result);
    if (got && (!returnTo.result || returnTo.result.value < got.value ||
                returnTo.result.key !== got.key)) {
      returnTo.result = got;
    }
  }
  /* And what everybody saw, filed under the match the host named. Only ever
     for an online game, and it never throws into the end of a match: a board
     is not worth a result screen. */
  try { matchReport(result); forgetRealBoards(); } catch (_) {}
  outcome = result;
  // The elimination banner would otherwise still be mid-fade and print
  // straight through the result screen.
  banner = null;
  state = "over";
  gameSound(result.kind === "winner" ? "win" : "lose");
}

function checkRoyaleEnd() {
  const standing = ships.filter(s => !s.dead);
  if (standing.length === 1) endMatch({ kind: "winner", ship: standing[0] });
  else if (standing.length === 0) endMatch({ kind: "draw" });
}

/* ── the claw ─────────────────────────────────────────────────────────────
   What the utility hulls carry instead of a gun. Ric: "instead of a bullet
   it's like a claw that comes out and crushes the asteroids."

   So it is not a round at all — nothing leaves the ship. It is a short reach
   in front of the nose that takes whatever is in it apart, and the whole
   character of it is that reach: an industrial can stand off and cut a rock
   at range, and a working hull has to go and *hold* the thing. Same result,
   completely different approach, which is what stops the two mining hulls
   being one hull with two paint jobs.

   It bites ships too. It is a pair of hydraulic jaws on the front of a
   salvage tug; something that crushes a boulder does not politely ignore a
   pirate. */
const CLAW_REACH = 2.4;      // times the hull's own radius
const CLAW_ARC   = 1.05;     // radians either side of the nose
function swingClaw(ship) {
  const r = SHIP_R * U * (ship.sizeMul || 1);
  const reach = r * CLAW_REACH;
  ship.clawT = 0.22;
  let bit = false;
  for (let i = rocks.length - 1; i >= 0; i--) {
    const rk = rocks[i];
    const dx = sepX(rk.x, ship.x), dy = sepY(rk.y, ship.y);
    if (Math.hypot(dx, dy) > reach + rk.r) continue;
    let off = Math.atan2(dy, dx) - ship.a;
    while (off > Math.PI) off -= Math.PI * 2;
    while (off < -Math.PI) off += Math.PI * 2;
    if (Math.abs(off) > CLAW_ARC) continue;
    shatterWhole(rk);
    bit = true;
  }
  /* And anything else in the jaws. The same consequences a round carries — a
     patrol that gets bitten is a patrol that arms itself, and a pirate that
     gets away remembers who did it — because the thing that earns a grudge is
     being hurt by you, not the shape of what hurt you. */
  for (let i = (surv ? surv.traffic.length : 0) - 1; i >= 0; i--) {
    const t = surv.traffic[i];
    const dx = sepX(t.x, ship.x), dy = sepY(t.y, ship.y);
    const rr = hullR(t);
    if (Math.hypot(dx, dy) > reach + rr) continue;
    let off = Math.atan2(dy, dx) - ship.a;
    while (off > Math.PI) off -= Math.PI * 2;
    while (off < -Math.PI) off += Math.PI * 2;
    if (Math.abs(off) > CLAW_ARC) continue;
    t.hp -= 2 * (ship.dmgMul || 1);
    t.hit = 0.12;
    if (t.kind === "patrol") t.angry = true;
    if (t.faction === "pirate" && !t.hurtBy) {
      t.hurtBy = true;
      if (!t.name) t.name = shipName(true);
    }
    burst(t.x, t.y, trafficColour(t), 6, 130 * U);
    if (t.hp <= 0) killTraffic(i, true);
    bit = true;
  }
  burst(ship.x + Math.cos(ship.a) * reach * 0.7,
        ship.y + Math.sin(ship.a) * reach * 0.7,
        bit ? "#ffcb42" : "#a08cff", bit ? 8 : 3, 120 * U);
  gameSound(bit ? "rock" : "shot", ship.x, ship.y);
  return true;
}

/* A barrel's end, in the world. `r` is the hull's drawn radius, the
   same one the drawing scales its twelve-unit outline by. `k` counts shots,
   so a two-gun hull fires left, right, left, and the stream is the same
   stream it always was, only coming out of the guns. */
function muzzleAt(spec, x, y, a, r, k) {
  const list = spec && spec.muzzles;
  if (!list || !list.length) {
    return { x: x + Math.cos(a) * (r + 2), y: y + Math.sin(a) * (r + 2) };
  }
  const m = list[(k || 0) % list.length];
  const sc = r / 12, c = Math.cos(a), sn = Math.sin(a);
  return { x: x + (m[0] * c - m[1] * sn) * sc, y: y + (m[0] * sn + m[1] * c) * sc };
}

function fire(ship) {
  /* And it ends a cloak. Put here rather than on the trigger, because this is
     where a round actually leaves the ship — a trigger held against a cooldown
     is not a shot, and a cloak that dropped on the *key* would end the moment
     a thumb rested on the pad. */
  if (ship.human && surv && surv.cloak > 0) dropCloak();
  // A claw is a reach, not a round. Nothing is launched and nothing is capped.
  if (ship.weapon === "claw") return swingClaw(ship);
  // The cannon's own rounds only. Six in the air has always been the cannon's
  // limit and a missile must not spend one of them.
  const mine = bullets.reduce(
    (n, b) => n + (b.owner === ship.id && !b.alt ? 1 : 0), 0);
  /* One beam in the air, and one claw swing at a time. Both are single heavy
     strikes rather than a stream, so the cap that matters is one — and it is
     the cap, not the burst, that makes them feel like a tool instead of a
     gun: you commit a shot and then you wait for it. */
  const cap = ship.weapon ? 1
            : (mode.campaign && ship.human) ? CAMPAIGN_SHOTS : MAX_SHOTS;
  if (mine >= cap) return false;
  const r = SHIP_R * U * (ship.sizeMul || 1);
  const heavy = ship.buffHeavy > 0;
  const gun = mode.survey && ship.spec
    ? muzzleAt(ship.spec, ship.x, ship.y, ship.a, r, ship.gunIx = (ship.gunIx || 0) + 1)
    : muzzleAt(null, ship.x, ship.y, ship.a, r);
  bullets.push({
    owner: ship.id,
    colour: heavy ? "#ffd36b" : ship.colour,
    // Salvaged heavy rounds punch through twice; a hull's own firepower is a
    // multiplier over the top of whatever it is firing.
    dmg: (heavy ? 2 : 1) * (ship.dmgMul || 1),
    x: gun.x,
    y: gun.y,
    // Inheriting ship velocity is what makes a fast pass dangerous — your
    // shots stay ahead of you, and ahead of anyone flying beside you.
    vx: Math.cos(ship.a) * BULLET_SPD * (ship.shotMul || 1) * U + ship.vx,
    vy: Math.sin(ship.a) * BULLET_SPD * (ship.shotMul || 1) * U + ship.vy,
    life: BULLET_LIFE * U,
    /* An industrial's round is a beam: it is drawn wider and it takes a rock
       apart in one hit. Carried on the round rather than read off the firer,
       because a round outlives the frame it was fired in and the ship that
       fired it may have swapped hulls by the time it lands. */
    rends: ship.weapon === "beam",
    beam: ship.weapon === "beam"
  });
  gameSound(ship.weapon === "beam" ? "beam" : "laser", ship.x, ship.y);
  return true;
}

/* ── firing what you bolted on ────────────────────────────────────────────
   One trigger, several guns. The cannon fires as it always did; each weapon
   part runs its own clock alongside it, and because those clocks are slow the
   effect of holding fire is your ordinary stream with something heavy leaving
   every couple of seconds.

   `alt` marks a round as not the cannon's, which keeps it out of the magazine
   cap: six rounds in the air has always been the cannon's limit and a missile
   should not use up one of them. */
function fireWeapons(ship, dt, held) {
  if (!mode.survey || !surv) return;
  ship.wcool = ship.wcool || {};
  const fitted = weaponsFitted();
  for (const w of fitted) {
    const spec = weaponSpec(w.key);
    if (!spec) continue;
    const left = (ship.wcool[w.key] || 0) - dt;
    ship.wcool[w.key] = Math.max(0, left);
    if (!held || left > 0 || !ship.alive) continue;
    ship.wcool[w.key] = spec.cool / (ship.rateMul || 1);
    launch(ship, spec);
  }
  // Anything fitted but not fired keeps its clock; anything pulled loses it.
  for (const key of Object.keys(ship.wcool)) {
    if (!fitted.some(w => w.key === key)) delete ship.wcool[key];
  }
}

function launch(ship, spec) {
  // The parts fire through here rather than through `fire`; same rule.
  if (ship.human && surv && surv.cloak > 0) dropCloak();
  const r = SHIP_R * U * (ship.sizeMul || 1);
  const n = spec.rounds || 1;
  for (let i = 0; i < n; i++) {
    /* A spread is symmetrical about the nose rather than random, so a scatter
       gun is a shape you can learn to place instead of a dice roll. */
    const off = n > 1
      ? (i - (n - 1) / 2) * (spec.spread || 0)
      : 0;
    const a = ship.a + off;
    // Out of the guns like the cannon's rounds, one barrel after another.
    const gun = mode.survey && ship.spec
      ? muzzleAt(ship.spec, ship.x, ship.y, ship.a, r, ship.gunIx = (ship.gunIx || 0) + 1)
      : muzzleAt(null, ship.x, ship.y, a, r);
    bullets.push({
      owner: ship.id,
      alt: true,
      colour: spec.colour,
      dmg: spec.dmg * (ship.dmgMul || 1),
      x: gun.x,
      y: gun.y,
      vx: Math.cos(a) * BULLET_SPD * (spec.speed || 1) * (ship.shotMul || 1) * U + ship.vx,
      vy: Math.sin(a) * BULLET_SPD * (spec.speed || 1) * (ship.shotMul || 1) * U + ship.vy,
      life: (spec.life || BULLET_LIFE) * U,
      seek: spec.seek || 0,
      boom: spec.boom || 0,
      punch: spec.pierce || 0,
      big: !!(spec.boom || spec.pierce)
    });
  }
  gameSound(spec.pierce ? "lance" : spec.seek || spec.boom ? "seeker"
            : n > 1 ? "scatter" : "laser", ship.x, ship.y);
  if (spec.boom || spec.pierce) addShake(2);
}

/* A seeker turns. It looks for whatever is nearest and closest to the way it is
   already pointing, so it goes for the thing in front of it rather than
   doubling back on something behind — a missile that turns round is a missile
   that hits you. */
function steerSeeker(b, dt) {
  let best = null, bd = 2600 * U;
  const consider = (x, y) => {
    const d = Math.hypot(x - b.x, y - b.y);
    if (d > bd || d < 1) return;
    const to = Math.atan2(y - b.y, x - b.x);
    let off = to - Math.atan2(b.vy, b.vx);
    while (off > Math.PI) off -= Math.PI * 2;
    while (off < -Math.PI) off += Math.PI * 2;
    // Ninety degrees either side and no further: it cannot come about.
    if (Math.abs(off) > Math.PI / 2) return;
    bd = d; best = { x, y };
  };
  if (surv) {
    /* Decoys first, and they cheat. A missile is the easiest thing out here
       to lie to, so a decoy anywhere in the cone beats anything genuinely
       nearer: once one has been taken, the radius is closed to nothing and
       the passes below cannot outbid it. */
    let fooled = false;
    for (const dc of surv.decoys) {
      const before = best;
      consider(dc.x, dc.y);
      if (best !== before) fooled = true;
    }
    if (fooled) bd = 1;
    for (const d of surv.drones) if (!d.ally) consider(d.x, d.y);
    for (const t of surv.traffic) consider(t.x, t.y);
  }
  for (const r of rocks) consider(r.x, r.y);
  if (!best) return;
  const sp = Math.hypot(b.vx, b.vy) || 1;
  const want = Math.atan2(best.y - b.y, best.x - b.x);
  let have = Math.atan2(b.vy, b.vx);
  let off = want - have;
  while (off > Math.PI) off -= Math.PI * 2;
  while (off < -Math.PI) off += Math.PI * 2;
  have += Math.max(-b.seek * dt, Math.min(b.seek * dt, off));
  b.vx = Math.cos(have) * sp;
  b.vy = Math.sin(have) * sp;
}

/* A burst charge going off. Everything inside the radius takes it, falling off
   towards the rim so the middle of a rock cluster is worth aiming at and the
   edge of one is not. */
function explode(b) {
  const R = b.boom * U;
  burst(b.x, b.y, b.colour, 30, R * 1.4);
  addShake(5);
  gameSound("boom", b.x, b.y);
  const share = d => Math.max(0.35, 1 - d / R);
  /* The rocks are gathered before any of them is hit. `hitRock` can split one,
     which removes it and pushes its pieces, so walking the live list while
     changing it is a way to read past the end of it — and the pieces of a rock
     this charge just broke are not also inside the blast. */
  const caught = [];
  for (const r of rocks) {
    const d = Math.sqrt(gap2(b.x, b.y, r.x, r.y));
    if (d <= R + r.r) caught.push([r, d]);
  }
  for (const [r, d] of caught) {
    if (!rocks.includes(r)) continue;
    hitRock(r, { x: b.x, y: b.y, vx: b.vx, vy: b.vy,
                 dmg: b.dmg * share(d), colour: b.colour });
  }
  if (!surv) return;
  for (let i = surv.drones.length - 1; i >= 0; i--) {
    const dr = surv.drones[i];
    const d = Math.hypot(dr.x - b.x, dr.y - b.y);
    if (d > R) continue;
    dr.hp -= b.dmg * share(d);
    dr.hit = 0.12; dr.awake = true;
    // Your round, on something taking a ship apart: that is what being owed for
    // a rescue means. See the distress branch in `surveyTraffic`.
    if (dr.prey) dr.prey.helped = true;
    if (dr.hp <= 0) killDrone(i); else gameSound("hit", dr.x, dr.y);
  }
  for (let i = surv.traffic.length - 1; i >= 0; i--) {
    const t = surv.traffic[i];
    const d = Math.hypot(t.x - b.x, t.y - b.y);
    if (d > R) continue;
    takeHit(t, b.dmg * share(d));
    if (ROLES[t.role || t.kind] && ROLES[t.role || t.kind].armed) t.angry = true;
    // And it may decide it has had enough of you. See `hurtBySomebody`.
    hurtBySomebody(t, null);
    if (t.hp <= 0) killTraffic(i, true); else gameSound("hit", t.x, t.y);
  }
  for (let i = surv.hulks.length - 1; i >= 0; i--) {
    const h = surv.hulks[i];
    if (Math.hypot(h.x - b.x, h.y - b.y) > R) continue;
    hitHulk(h, i);
  }
}

/* A hit that doesn't break the rock chips it: a crack opens, it flashes, and
   it takes a nudge from the impact. The bullet is spent either way, so cover
   still costs the shooter ammunition. */
function hitRock(rock, b) {
  /* A round's damage counts against a rock as well as against a hull. It did
     not before — every hit took exactly one point, so the heavy rounds a
     pickup gives you never actually punched through anything, and a rail lance
     would have chipped a boulder like a pistol. */
  /* A beam or a claw does not chip. It takes the rock apart in one pass,
     whatever size it is — see `shatterWhole`, and see the industrial and
     utility hulls, which are the only two things in the game that carry one.
     Checked before the hp arithmetic because there is no arithmetic to do:
     the answer is always "all of it". */
  if (b && b.rends) { shatterWhole(rock); return; }
  rock.hp -= Math.max(1, Math.round(b && b.dmg ? b.dmg : 1));
  rock.flash = 0.13;
  if (rock.hp > 0) {
    burst(b.x, b.y, "#ffcb42", 4, 120 * U);
    gameSound("hit", rock.x, rock.y);
    const sp = Math.hypot(b.vx, b.vy) || 1;
    const knock = 26 * U / Math.max(1, rock.r / 30);
    rock.vx += (b.vx / sp) * knock;
    rock.vy += (b.vy / sp) * knock;
    return;
  }
  splitRock(rock);
}

/* ── how hard a thing is to shove ─────────────────────────────────────────
   A hull's mass, taken off the two numbers that already say how big it is —
   its radius and its armour — so nothing new has to be kept in step. Only
   ever used as a *ratio*, so the units do not matter and the scale can never
   drift.

   It exists because of the grip axis. A bounce used to hand back a fixed
   multiple of the closing speed whatever hit what, which was survivable while
   every hull shed speed in about the same two seconds. It stopped being
   survivable at a 267x spread: an industrial holds a shove for forty-five
   seconds, so a courier clipping a Gantry put the Gantry at its own top speed
   and it stayed there for most of a minute. Ric found it from the cockpit —
   "the courier ships make the gantry go faster" — and he was describing this
   exactly. A shove is shared by mass now, the way it always should have been. */
const hullMass = spec =>
  spec ? (spec.size || 1) * (spec.size || 1) * (1 + (spec.hull || 8) / 24) : 1;
/* What fraction of a collision the *first* of the two wears. Half each when
   they match, and the lighter one wears nearly all of it when they do not. */
const shoveShare = (mine, theirs) => {
  const a = hullMass(mine), b = hullMass(theirs);
  return (2 * b) / (a + b);
};

function splitRock(rock) {
  const spec = rockSpec(rock.size);
  const next = spec.next;
  score += spec.score;
  // Nine rocks in a Survey sector have something in them, and this is the
  // only way to find out which. It survives a split, so cracking a big one
  // open hands the core down to the pieces.
  if (mode.survey && rock.core && !next) {
    burst(rock.x, rock.y, "#a08cff", 20, 220 * U);
    surveyFind("prospector");
  }
  /* A broken rock pays, which is what turns the standing field from scenery
     you dodge into the sector's small change. Only the last break pays, so a
     big rock is worth the same however carefully it is taken apart. */
  if (mode.survey && !next) dropMote(rock.x, rock.y, YIELD.rock, 26, "rock");
  burst(rock.x, rock.y, "#ffcb42", rock.size === "big" ? 16 : 10, 170 * U);
  gameSound("rock", rock.x, rock.y);
  const i = rocks.indexOf(rock);
  if (i >= 0) rocks.splice(i, 1);
  if (next) {
    for (let k = 0; k < 2; k++) {
      const r = makeRock(next, rock.x, rock.y);
      // Keep the parent's drift so a split reads as a break-up, not a respawn.
      r.vx += rock.vx * 0.4;
      r.vy += rock.vy * 0.4;
      if (rock.core && k === 0) r.core = true;
      rocks.push(r);
    }
  }
}

/* Rock against rock. Royale had this because its wall herds the field into a
   heap; Survey never did, so an asteroid belt was a set of sprites occupying
   the same space and passing through each other. A field you can shoulder
   your way through, and whose pieces shove each other into a well, is worth
   flying into rather than around. */
/* Broken by a well rather than by a shot. Deliberately not `splitRock`: that
   one scores, pays out and can log the prospector entry, and none of those
   should happen because gravity did the work. The pieces are thrown outward
   from the rock's own centre so the break reads as a break, and then the well
   has them too. */
function shatterInWell(rock, i, well) {
  const spec = rockSpec(rock.size);
  const colour = well.kind === "star" ? "#ffd76d" : "#a08cff";
  burst(rock.x, rock.y, colour, rock.size === "big" ? 18 : 10, 200 * U);
  if (Math.random() < 0.3) gameSound("rock", rock.x, rock.y);
  rocks.splice(i, 1);
  if (!spec.next) return;
  for (let k = 0; k < 2; k++) {
    const piece = makeRock(spec.next, rock.x, rock.y);
    const a = Math.random() * Math.PI * 2;
    piece.vx = rock.vx + Math.cos(a) * 90 * U;
    piece.vy = rock.vy + Math.sin(a) * 90 * U;
    rocks.push(piece);
  }
}

/* ── taken apart in one hit ───────────────────────────────────────────────
   What the industrial beam and the utility claw both do. Ric: it "breaks big
   asteroids into medium into small into broken in one hit" — so rather than
   knocking a rock down one tier and leaving two children for the next shot,
   this runs the whole chain at once and pays out every piece the chain would
   have produced.

   It is `splitRock` all the way down rather than a special case beside it, so
   the yield, the score, the sound and the prospector entry are the ones the
   rest of the game already agrees on: a big rock taken apart by a beam is
   worth exactly what a big rock taken apart by seven cannon rounds is worth.
   The depth is bounded by the tier chain rather than by a counter, and the
   chain is three long. */
function shatterWhole(rock) {
  if (!rock) return;
  const before = rocks.length;
  const spec = rockSpec(rock.size);
  splitRock(rock);
  if (!spec.next) return;
  /* `splitRock` removed one and pushed its children on the end, so the new
     ones are everything past where the list used to stop being unchanged.
     Taken by identity rather than by index, because a mote drop or a sound can
     do anything it likes to the array in between. */
  const kids = rocks.slice(before - 1).filter(r => r.size === spec.next);
  for (const kid of kids) shatterWhole(kid);
}

/* ── which rocks might be touching ────────────────────────────────────────
   Finding the pairs used to be every rock against every other rock, which is
   n(n-1)/2 comparisons: fine for the few dozen a Battle Royale arena holds,
   and quadratic in a Survey field that keeps growing. Most of those pairs are
   rocks that are nowhere near one another.

   So the rocks go into a grid first and only near neighbours are offered up.
   The cell is two of the largest radius in the set, which is the thing that
   makes this exact rather than approximate: two rocks can only overlap if
   they are within `ra + rb` of each other, that is at most `2 * maxR`, that
   is at most one cell — so a pair that is really touching is always in the
   same cell or an adjacent one, and can never be missed.

   Pairs are visited by index, `j` only ever greater than `i`, so a pair that
   two cells both offer is still resolved once. The collision maths below is
   untouched; this changes only which pairs it is asked about.

   `HUD` debug counts what it considered, so the saving is a measurement
   rather than a claim — see `__cf.rockPairs`. */
let rockCandidates = 0;
function forEachRockPair(list, visit) {
  const n = list.length;
  if (n < 2) return;
  let maxR = 0;
  for (let i = 0; i < n; i++) if (list[i].r > maxR) maxR = list[i].r;
  const cell = Math.max(1, maxR * 2);
  const buckets = new Map();
  for (let i = 0; i < n; i++) {
    const k = Math.floor(list[i].x / cell) + "," + Math.floor(list[i].y / cell);
    const b = buckets.get(k);
    if (b) b.push(i); else buckets.set(k, [i]);
  }
  for (let i = 0; i < n; i++) {
    const a = list[i];
    const cx = Math.floor(a.x / cell), cy = Math.floor(a.y / cell);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const b = buckets.get((cx + ox) + "," + (cy + oy));
        if (!b) continue;
        for (let m = 0; m < b.length; m++) {
          const j = b[m];
          // Each unordered pair once, and never a rock with itself.
          if (j <= i) continue;
          rockCandidates++;
          visit(i, j);
        }
      }
    }
  }
}

function resolveRockCollisions() {
  if ((!mode.closing && !mode.survey) || rocks.length < 2) return;
  forEachRockPair(rocks, (i, j) => {
    {
      const a = rocks[i], b = rocks[j];
      const min = a.r + b.r;
      let dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) return;
      let d = Math.sqrt(d2);
      if (d < 0.001) {
        dx = (a.id < b.id ? 1 : -1);
        dy = (a.id < b.id ? -1 : 1);
        d = Math.hypot(dx, dy);
      }
      const nx = dx / d, ny = dy / d;
      const overlap = min - d;
      const shove = overlap * 0.5;
      a.x -= nx * shove; a.y -= ny * shove;
      b.x += nx * shove; b.y += ny * shove;

      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const rel = rvx * nx + rvy * ny;
      if (rel < 0) {
        const impulse = -rel * 0.12;
        a.vx -= nx * impulse; a.vy -= ny * impulse;
        b.vx += nx * impulse; b.vy += ny * impulse;
      }
    }
  });
}

// Whose shots can hurt whom. Survival reads its setup toggle; Battle Royale
// always allows opponents to damage one another. Campaign is by side: your
// bullets pass through your own fleet and only bite the enemy, and theirs
// only bite you — friendly fire is off, so a crowded warzone stays readable.
const canHit = (shooter, target) => {
  if (shooter === target.id) return false;
  if (mode.campaign) {
    const src = ships[shooter];
    return !src || src.team !== target.team;
  }
  return mode.pvp || mode.friendlyFire;
};
