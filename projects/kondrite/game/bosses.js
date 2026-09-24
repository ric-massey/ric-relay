"use strict";

/* KONDRITE — BOSSES
   ─────────────────────────────────────────────────────────────────────────────
   The bosses, the queen's bugs, five ways to fight, handing water across and
   asking what a thing is.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ═══ BOSSES ═══════════════════════════════════════════════════════════════
   Ric: "i like the idea of bosses". Three, one for each kind of dangerous
   sky, and each one is somebody a different way of living out here wants
   dead or wants robbed:

     WARLORD   lawless sky and the Deep Void. A pirate in a captured Reprisal
               with a pack of three, and it calls more in when it is hurt.
               Every power pays for it.
     ADMIRAL   the fronts. A power's flagship, a Bastion, with a wing of
               three patrols. Its enemy pays for it, and its own side will
               not forgive you.
     QUEEN     a power's territory. A salvage barge, a Tender loaded with the
               rare stuff, with two escorts. Nobody pays for her. What she is
               carrying is the pay, and she is the pirate's boss.

   A boss is the same ship the sector already flies, made bigger (`scale`)
   and harder: several times the hull, a pilot better than any hull buys,
   and it never breaks off (the queen runs, because she is not a fighter).
   And each has one power, which is the part it drops (see `BOSS_PARTS`):

     warlord   a five-round fan on every volley          WAR FAN
     corsair   afterburner dashes on its attack runs      CORSAIR BURNER
     admiral   a shield that soaks hits and comes back    FLAGSHIP SCREEN
     warden    homing missiles, two at a time             WARDEN'S SWARM
     queen     takes ships and sends them into you         BROOD BAY

   Anything that picks up loot will race you for the part.

   **A boss lives somewhere.** Ric: "you should be able to know when your
   entering an area with a boss". So each one has a sky of its own, a disc
   seven thousand across, placed from the seed so the same boss is in the
   same place every time you fly there: roughly one square in two of
   48,000 on a side has one, and none are near home. What it is depends on
   the sky it sits in (lawless or void, a front, a power's territory).

   You hear about it before you are in it ("coming up on..."), a banner says
   when you cross in, the chart marks the whole disc from then on, and while
   you are inside a bar across the top of the screen names it and shows its
   hull. A scan that reaches a boss's sky charts it too. Kill one and its sky
   is empty for good: `bossesDown` is saved. */
const BOSSES = {
  warlord: { role: "pirate", hull: "reprisal", scale: 1.55, hp: 5,
             crew: ["pirate", "pirate", "pirate"], bounty: 6000,
             title: n => n + " THE " + pickOne(BOSS_EPITHETS),
             call: n => "Every channel at once: " + n + " is hunting this sky." },
  admiral: { role: "patrol", hull: "bastion", scale: 1.6, hp: 5,
             crew: ["patrol", "patrol", "patrol"], bounty: 4500,
             title: n => "ADMIRAL " + n,
             call: n => "A flagship on the line: " + n + " is out here." },
  queen:   { role: "scavenger", hull: "ossuary", scale: 1.2, hp: 4,
             crew: ["escort", "escort"], bounty: 0,
             title: n => n + ", QUEEN OF SCRAP",
             call: n => n + "'s barge is working this sky, heavy with salvage." },
  /* A power's own. The Warden keeps the heart of its territory, the way an
     admiral keeps a front. Both fly for their flag, and whether they come
     for you is a question about where you stand with it. */
  warden:  { role: "patrol", hull: "louvre", scale: 1.5, hp: 6,
             crew: ["patrol", "patrol"], bounty: 3500,
             title: n => "WARDEN " + n,
             call: n => "The Warden is up: " + n + " keeps this sky." },
  // A pirate ace. Fast, alone but for one, and gone before you turn round.
  corsair: { role: "pirate", hull: "vane", scale: 1.6, hp: 9,
             crew: ["pirate"], bounty: 3500,
             title: n => n + " THE CORSAIR",
             call: n => n + " is raiding this sky." }
};
const BOSS_EPITHETS = ["RED", "HOLLOW", "UNBURIED", "PATIENT", "LAST", "SALT",
                       "BLACK", "THIRD", "KIND", "COLD"];
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const BOSS_COLOUR = "#ff4dd2";
let bossSerial = 0;

function bossName(kind) {
  const n = (place() + (Math.random() < 0.5 ? "" : place().slice(0, 2))).toUpperCase();
  return BOSSES[kind].title(n);
}

// What a queen is hauling: forty units of the good stuff.
function bossCargo(kind) {
  if (kind !== "queen") return [];
  const out = [];
  for (let i = 0; i < 40; i++) {
    const r = Math.random();
    out.push(r < 0.3 ? "alloy" : r < 0.6 ? "iridium" : r < 0.85 ? "electronics" : "core");
  }
  return out;
}

function spawnBoss(kind, at, flag) {
  const B = BOSSES[kind];
  const sky = spaceAt(at.x, at.y);
  const sides = warSides();
  const faction = flag || (B.role === "pirate" ? "pirate"
    : B.role === "patrol" ? (sky.owner || sides[0] || FACTIONS[0].key)
    : (sky.owner || "free"));
  const id = "boss-" + (++bossSerial);
  const spec = bossSpec(kind, B.hull);
  // Never less than 160: a boss in a light hull is still a boss.
  const hp = Math.max(160, Math.round(spec.hull * B.hp));
  const a = Math.random() * Math.PI * 2;
  const speed = MAX_SPEED * spec.speed * 0.72;
  const boss = {
    id, kind: B.role, role: B.role, faction, hull: B.hull,
    boss: kind, scale: B.scale, name: bossName(kind),
    x: at.x, y: at.y, a,
    from: { x: at.x, y: at.y },
    to: { x: at.x + Math.cos(a) * 9000, y: at.y + Math.sin(a) * 9000 },
    leg: 1, speed, baseSpeed: speed, hp, maxHp: hp,
    cargo: bossCargo(kind), cool: 1, doom: 0, guards: 0, space: 0,
    trades: false, tank: null, phase: Math.random() * 6.28, vx: 0, vy: 0
  };
  surv.traffic.push(boss);
  B.crew.forEach((role, i) => {
    const slot = GROUP_SLOTS[i % GROUP_SLOTS.length];
    const hulls = TRAFFIC_HULLS[role];
    const hull = hulls[Math.floor(Math.random() * hulls.length)];
    const cs = shipSpec(hull);
    const c = Math.cos(a), s2 = Math.sin(a);
    const x = at.x - c * slot.back - s2 * slot.side;
    const y = at.y - s2 * slot.back + c * slot.side;
    surv.traffic.push({
      id: id + "c" + i, leadId: id, slot, kind: role, role, faction, hull,
      x, y, a, from: { x, y }, to: boss.to, leg: 1,
      speed: Math.max(speed, MAX_SPEED * cs.speed * 0.72),
      baseSpeed: Math.max(speed, MAX_SPEED * cs.speed * 0.72),
      hp: cs.hull, maxHp: cs.hull, cargo: [], cool: 1.5, doom: 0, guards: 0,
      space: 0, trades: false, tank: null, phase: Math.random() * 6.28,
      vx: 0, vy: 0
    });
  });
  return boss;
}

const LAIR_CELL = 48000;      // one chance of a boss's sky per square this size
const LAIR_R    = 7000;       // how far a boss's sky reaches from its middle
const BOSS_SKY = { warlord: "A WARLORD'S SKY", admiral: "AN ADMIRAL'S SKY",
                   queen: "A SALVAGE QUEEN'S SKY", warden: "A WARDEN'S SKY",
                   corsair: "A CORSAIR'S SKY" };

/* Whether a boss comes for you. Pirates always do. A salvage queen never
   does unless you start it. A power's boss does when that power is watching
   you or worse, or when you are in good standing with the power it is at
   war with, because then you are somebody's side. In good standing, or
   nobody's, it leaves you be. */
function bossHostile(t) {
  if (t.faction === "pirate") return true;
  if (!t.faction || t.faction === "free") return false;
  if (repOf(t.faction) <= -30 || hostileTo(t.faction)) return true;
  const enemy = warPairs()[t.faction];
  return !!enemy && repOf(enemy) >= 110;
}

// A small seeded generator, so a lair is a pure function of the seed.
function lairRng(i, j, salt) {
  let a = ((surv ? surv.seed : 1) ^ (salt || 0x5bd1e995)) +
          Math.imul(i, 374761393) + Math.imul(j, 668265263);
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Asked for nine squares every frame, and each answer asks the territory
   map, which is not free. Remembered for two seconds: long enough to cost
   nothing, short enough that a sky that changes hands changes its boss. */
const lairMemo = new Map();
function lairIn(i, j) {
  const key = surv.seed + ":" + i + "," + j;
  const hit = lairMemo.get(key);
  if (hit && hit.at <= clock && clock - hit.at < 2 &&
      hit.down === surv.bossesDown.size) return hit.v;
  const v = lairFresh(i, j);
  if (lairMemo.size > 400) lairMemo.clear();
  lairMemo.set(key, { at: clock, down: surv.bossesDown.size, v });
  return v;
}
function lairFresh(i, j) {
  const R = lairRng(i, j);
  if (R() > 0.45) return null;
  const x = (i + 0.2 + R() * 0.6) * LAIR_CELL, y = (j + 0.2 + R() * 0.6) * LAIR_CELL;
  if (Math.hypot(x, y) < HOME_CALM_R * 3) return null;
  const sky = spaceAt(x, y);
  let kind = sky.kind === "lawless" || sky.kind === "void" ? "warlord"
           : sky.kind === "front" ? "admiral"
           : sky.kind === "territory" ? ((sky.inner || 0) >= 2 ? "warden" : "queen")
           : R() < 0.5 ? "corsair" : "queen";
  if (kind === "admiral" && warSides().length < 2) kind = "warlord";
  const role = BOSSES[kind].role;
  const faction = role === "pirate" ? "pirate"
                : role === "patrol" ? (sky.owner || warSides()[0] || FACTIONS[0].key)
                : (sky.owner || "free");
  // The name has its own stream, so it survives the sky changing hands.
  const N = lairRng(i, j, 0x2545f491);
  const n = SYL_HEAD[Math.floor(N() * SYL_HEAD.length)] +
            SYL_TAIL[Math.floor(N() * SYL_TAIL.length)];
  const epi = BOSS_EPITHETS[Math.floor(N() * BOSS_EPITHETS.length)];
  const name = kind === "warlord" ? n.toUpperCase() + " THE " + epi
             : BOSSES[kind].title(n.toUpperCase());
  const id = "L" + i + "," + j;
  return { id, x, y, r: LAIR_R, kind, faction, name, dead: surv.bossesDown.has(id) };
}

// The boss's sky you are in or coming up on, if there is one still alive.
function lairNear(x, y, pad) {
  const ci = Math.floor(x / LAIR_CELL), cj = Math.floor(y / LAIR_CELL);
  let best = null, bd = Infinity;
  for (let i = ci - 1; i <= ci + 1; i++) {
    for (let j = cj - 1; j <= cj + 1; j++) {
      const L = lairIn(i, j);
      if (!L || L.dead) continue;
      const d = Math.hypot(x - L.x, y - L.y);
      if (d < L.r + (pad || 0) && d < bd) { bd = d; best = L; }
    }
  }
  return best;
}

// The boss part that runs on its own: the screen.
function surveyBossParts(dt) {
  const me = ships[0];
  const m = mods();
  if (m.screen) {
    if (!surv.screenUp) {
      surv.screenT = (surv.screenT == null ? 0 : surv.screenT) - dt;
      if (surv.screenT <= 0) surv.screenUp = true;
    }
  } else {
    surv.screenUp = false; surv.screenT = 12;
  }

}

function surveyBosses(dt) {
  const me = ships[0];
  surveyBossParts(dt);
  surv.lairBanner = Math.max(0, (surv.lairBanner || 0) - dt);
  if (!me.alive || surv.death) return;
  const L = lairNear(me.x, me.y, 2500);
  const d = L ? Math.hypot(me.x - L.x, me.y - L.y) : Infinity;
  const inside = !!L && d < L.r;
  // Coming up on one: said once, and it goes on the chart.
  const stance = L2 => L2.faction === "pirate" ? " They will come for you."
    : L2.faction === "free" || !L2.faction ? " Leave it alone and it leaves you alone."
    : bossHostile({ faction: L2.faction }) ? " " + factionOf(L2.faction).short +
        " will come for you."
    : " " + factionOf(L2.faction).short + " will let you pass.";
  if (L && !inside && surv.lairWarned !== L.id) {
    surv.lairWarned = L.id;
    noteKnown("boss", L.x, L.y, L.name, L.r);
    chatter("Coming up on " + L.name + "'s sky." + stance(L), BOSS_COLOUR);
  }
  const was = surv.inLair ? surv.inLair.id : null;
  if (inside && was !== L.id) {
    surv.inLair = L;
    surv.lairBanner = 4;
    surv.lairWarned = L.id;
    noteKnown("boss", L.x, L.y, L.name, L.r);
    chatter("You are in " + L.name + "'s sky." + stance(L), BOSS_COLOUR);
    gameSound("alarm", me.x, me.y);
  } else if (!inside && was) {
    if (!surv.bossesDown.has(was)) {
      chatter("Out of " + surv.inLair.name + "'s sky.", NEBULA);
      surv.lairLeft = surv.inLair;
      surv.leftBanner = 3;
    }
    surv.inLair = null;
  }
  surv.leftBanner = Math.max(0, (surv.leftBanner || 0) - dt);
  // The boss itself, once you are in its sky, flying about the middle of it.
  if (inside && !surv.traffic.some(t => t.lairId === L.id)) {
    let at = { x: L.x, y: L.y };
    for (let k = 0; k < 8 && inBuilt(at.x, at.y, 500); k++) {
      const a = Math.random() * Math.PI * 2;
      at = { x: L.x + Math.cos(a) * 1500, y: L.y + Math.sin(a) * 1500 };
    }
    const b = spawnBoss(L.kind, at, L.faction);
    b.lairId = L.id; b.lair = L; b.name = L.name;
  }
  for (const t of surv.traffic) if (t.boss) bossPower(t, dt);
  const live = surv.traffic.find(t => t.boss);
  if (live) {
    /* The warlord's pack, called in once it is losing. From past the edge of
       the screen, towards it, so you see them arrive. */
    if (live.boss === "warlord" && !live.called && live.hp < live.maxHp * 0.5) {
      live.called = true;
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        const x = live.x + Math.cos(a) * 1800 * U, y = live.y + Math.sin(a) * 1800 * U;
        const hull = pickOne(TRAFFIC_HULLS.pirate);
        const cs = shipSpec(hull);
        surv.traffic.push({
          id: live.id + "r" + i, leadId: live.id,
          slot: GROUP_SLOTS[(3 + i) % GROUP_SLOTS.length],
          kind: "pirate", role: "pirate", faction: "pirate", hull,
          x, y, a: a + Math.PI, from: { x, y }, to: { x: live.x, y: live.y },
          leg: 1, speed: MAX_SPEED * cs.speed * 0.8, baseSpeed: MAX_SPEED * cs.speed * 0.8,
          hp: cs.hull, maxHp: cs.hull, cargo: [], cool: 1, doom: 0, guards: 0,
          space: 0, trades: false, tank: null, phase: Math.random() * 6.28,
          vx: 0, vy: 0, angry: true
        });
      }
      chatter(live.name + " is calling the pack in.", BOSS_COLOUR, live);
      gameSound("alarm", live.x, live.y);
    }
    return;
  }
}

/* ── the queen's bugs ─────────────────────────────────────────────────────
   Galaga, near enough. They sit in rows in front of her, facing you, and
   twitch. One at a time they peel off: a swoop out to one side, then a dive
   straight at you, and on contact they go off. One that misses loops round
   and back into its row. A point of hull each, one hit kills one, and a ship
   she took is drawn as the ship it was. */
function makeBug(q, x, y, hull) {
  return { id: null, queen: q, bug: "form", hull: hull || null,
           x, y, vx: 0, vy: 0, a: q.a, home: null, prey: null,
           post: { x: q.x, y: q.y }, hp: hull ? 2 : 1, cool: 99,
           awake: true, hit: 0, slot: Math.floor(Math.random() * 1000) };
}

function bugStep(d, i, dt) {
  const me = ships[0];
  if (d.ally) return allyBugStep(d, i, dt);
  const q = d.queen;
  if (!q || surv.traffic.indexOf(q) < 0) {
    // Their queen is gone, and so are they, all at once.
    burst(d.x, d.y, BOSS_COLOUR, 8, 140 * U);
    gameSound("fizz", d.x, d.y);
    surv.drones.splice(i, 1);
    return;
  }
  const toMe = Math.atan2(me.y - q.y, me.x - q.x);
  let gx, gy, sp = 520 * U, turn = 5;
  if (d.bug === "form") {
    // Its slot: rows between her and you, shuffled by the order they joined.
    const mine = surv.drones.filter(o => o.queen === q && o.bug === "form")
                            .sort((p2, q2) => p2.slot - q2.slot);
    const k = Math.max(0, mine.indexOf(d));
    const row = Math.floor(k / 6), col = (k % 6) - 2.5;
    const out = hullR(q) + (140 + row * 70) * U;
    const across = toMe + Math.PI / 2;
    const wig = Math.sin(clock * 4 + k) * 12 * U;
    gx = q.x + Math.cos(toMe) * out + Math.cos(across) * (col * 70 * U + wig);
    gy = q.y + Math.sin(toMe) * out + Math.sin(across) * (col * 70 * U + wig);
    sp = 420 * U; turn = 8;
  } else if (d.bug === "swoop") {
    d.bugT -= dt;
    const a = toMe + d.side * 1.3;
    gx = d.x + Math.cos(a) * 400; gy = d.y + Math.sin(a) * 400;
    if (d.bugT <= 0) { d.bug = "dive"; d.bugT = 5; d.closest = Infinity; }
  } else if (d.bug === "dive") {
    d.bugT -= dt;
    gx = me.x; gy = me.y; sp = 560 * U; turn = 2.6;
    const dd = Math.hypot(me.x - d.x, me.y - d.y);
    d.closest = Math.min(d.closest, dd);
    if (me.alive && dd < shipRadius() + 12 * U) {
      // Contact.
      burst(d.x, d.y, BOSS_COLOUR, 22, 260 * U);
      addShake(5);
      gameSound("boom", d.x, d.y);
      if (me.invuln <= 0) damageShip(me, "shot", null, 1);
      surv.drones.splice(i, 1);
      return;
    }
    if ((dd > d.closest + 250 * U && d.closest < 400 * U) || d.bugT <= 0 || !me.alive) {
      d.bug = "home";
    }
  } else {                                  // home: back to its row
    gx = q.x; gy = q.y; sp = 480 * U; turn = 4;
    if (Math.hypot(q.x - d.x, q.y - d.y) < hullR(q) + 400 * U) d.bug = "form";
  }
  const want = Math.atan2(gy - d.y, gx - d.x);
  let off = want - d.a;
  while (off > Math.PI) off -= Math.PI * 2;
  while (off < -Math.PI) off += Math.PI * 2;
  d.a += Math.max(-turn * dt, Math.min(turn * dt, off));
  if (d.bug === "form") {
    // In its row it points at you, whichever way it is drifting.
    const dx = gx - d.x, dy = gy - d.y, dd = Math.hypot(dx, dy) || 1;
    const v = Math.min(sp, dd * 4);
    d.vx += (dx / dd * v - d.vx) * Math.min(1, 6 * dt);
    d.vy += (dy / dd * v - d.vy) * Math.min(1, 6 * dt);
    let o2 = toMe - d.a;
    while (o2 > Math.PI) o2 -= Math.PI * 2;
    while (o2 < -Math.PI) o2 += Math.PI * 2;
    d.a += Math.max(-6 * dt, Math.min(6 * dt, o2));
  } else {
    d.vx = Math.cos(d.a) * sp; d.vy = Math.sin(d.a) * sp;
  }
  d.x += d.vx * dt; d.y += d.vy * dt;
}

/* Yours, out of a Brood Bay: each finds the nearest thing that is after you
   (a sentry that is awake, a ship that is angry with you) and flies into it
   for three points. With nothing to find it keeps station on you, and after
   fourteen seconds it is spent. */
function allyBugStep(d, i, dt) {
  const me = ships[0];
  d.life -= dt;
  if (d.life <= 0 || !me.alive) {
    burst(d.x, d.y, CASH, 6, 110 * U);
    gameSound("fizz", d.x, d.y);
    surv.drones.splice(i, 1);
    return;
  }
  d.look = (d.look || 0) - dt;
  if (d.look <= 0 || (d.target && !surv.drones.includes(d.target) &&
                      !surv.traffic.includes(d.target))) {
    d.look = 0.5;
    let best = null, bd = 1800 * U;
    for (const o of surv.drones) {
      if (o.ally || !o.awake) continue;
      const dd = Math.hypot(o.x - d.x, o.y - d.y);
      if (dd < bd) { bd = dd; best = o; }
    }
    for (const o of surv.traffic) {
      if (!o.angry && !(o.boss && bossHostile(o))) continue;
      const dd = Math.hypot(o.x - d.x, o.y - d.y);
      if (dd < bd) { bd = dd; best = o; }
    }
    d.target = best;
  }
  const tg = d.target;
  const gx = tg ? tg.x : me.x + Math.cos(clock * 2 + d.slot * 2.1) * 80 * U;
  const gy = tg ? tg.y : me.y + Math.sin(clock * 2 + d.slot * 2.1) * 80 * U;
  let off = Math.atan2(gy - d.y, gx - d.x) - d.a;
  while (off > Math.PI) off -= Math.PI * 2;
  while (off < -Math.PI) off += Math.PI * 2;
  d.a += Math.max(-4 * dt, Math.min(4 * dt, off));
  const sp = (tg ? 600 : 380) * U;
  d.vx = Math.cos(d.a) * sp; d.vy = Math.sin(d.a) * sp;
  d.x += d.vx * dt; d.y += d.vy * dt;
  if (!tg) return;
  const reach = (tg.hull ? hullR(tg) : 18 * U) + 10 * U;
  if (Math.hypot(tg.x - d.x, tg.y - d.y) > reach) return;
  burst(d.x, d.y, CASH, 20, 240 * U);
  gameSound("boom", d.x, d.y);
  surv.drones.splice(i, 1);
  const di = surv.drones.indexOf(tg);
  if (di >= 0) {
    tg.hp -= 3; tg.hit = 0.12;
    if (tg.hp <= 0) killDrone(di);
    return;
  }
  const ti = surv.traffic.indexOf(tg);
  if (ti >= 0) {
    takeHit(tg, 3);
    hurtBySomebody(tg, null);
    if (tg.hp <= 0) killTraffic(ti, true);
  }
}

/* ── five ways to fight ───────────────────────────────────────────────────
   Every boss had the one dogfight: runs, breaks, the odd circle. Ric wanted
   each to "feel like a completely different experience". So each has its own,
   and each is built so that the thing that beats it is different:

     warlord   THE BULL. It hangs back while its pack goes in, then charges
               straight at you with almost no grip, slides past if it
               misses, and has to come all the way round. Its ram hurts.
               Beat it by sidestepping the charge and shooting its back.
     corsair   THE PHANTOM. Barely visible, it goes for your tail and only
               shows itself to strike. Turn on it and it burns out of your
               line. Beat it by never flying straight.
     admiral   THE FORTRESS. It does not chase. It holds its distance side
               on and fires full broadsides from both flanks, and its screen
               soaks what you send back. Beat it by closing through the fire
               and staying off its flanks.
     warden    THE DUELIST. It faces you all the time and strafes like a
               drone at sword's length, sidesteps the moment your nose is on
               it, and sends missiles after you. Beat it by leading it.
     queen     THE MOTHER. She will not fight you herself. She backs away
               facing you and sends bugs: ships she took with her beam, and
               ones she builds, in rows that peel off, swoop and dive into
               you. Beat her by shooting the divers and getting through to
               her while her rows are thin.

   Returns where to steer, and optionally the pace, where to point (`face`)
   and a velocity (`v`) for the two that strafe. */
function bossFight(t, foe, d, dt) {
  const me = ships[0];
  const spec = specOf(t);
  const top = MAX_SPEED * spec.speed * U;
  const toFoe = Math.atan2(foe.y - t.y, foe.x - t.x);
  const fv = foe === me ? [me.vx || 0, me.vy || 0] : [foe.vx || 0, foe.vy || 0];
  const foeA = foe === me ? me.a : Math.atan2(fv[1], fv[0]);
  // Is the foe's nose on it?
  let nose = Math.atan2(t.y - foe.y, t.x - foe.x) - foeA;
  while (nose > Math.PI) nose -= Math.PI * 2;
  while (nose < -Math.PI) nose += Math.PI * 2;
  const m = t.fight || (t.fight = { phase: "", left: 0, side: 1 });
  m.left -= dt;
  t.fightAt = clock;
  switch (t.boss) {
    case "warlord": {
      const pack = surv.traffic.some(o => o.leadId === t.id);
      if (!m.phase) { m.phase = pack ? "hang" : "charge"; m.left = 3; }
      if (m.phase === "hang") {
        if (m.left <= 0 || !pack) { m.phase = "charge"; m.left = 5; }
        const b = Math.atan2(t.y - foe.y, t.x - foe.x) + 0.4;
        return { x: foe.x + Math.cos(b) * 1100 * U, y: foe.y + Math.sin(b) * 1100 * U,
                 pace: top * 0.55 };
      }
      if (m.phase === "charge") {
        if (d < 140 * U || m.left <= 0) { m.phase = "overshoot"; m.left = 1.1; }
        return { x: foe.x, y: foe.y, pace: top };
      }
      // Past you, still going, before it can come about.
      if (m.left <= 0) {
        m.phase = pack && Math.random() < 0.3 ? "hang" : "charge";
        m.left = m.phase === "hang" ? 2.5 : 5;
      }
      return { x: t.x + Math.cos(t.a) * 1200 * U, y: t.y + Math.sin(t.a) * 1200 * U,
               pace: top };
    }
    case "corsair": {
      t.shown = false;
      const exposed = Math.abs(nose) < 0.45 && d < 1500 * U;
      if (exposed && (t.dashCool || 0) <= 0 && m.phase !== "slip") {
        m.phase = "slip"; m.left = 0.9; m.side = Math.random() < 0.5 ? 1 : -1;
        t.dash = 0.8; t.dashCool = 2.5;
      }
      if (m.phase === "slip") {
        if (m.left <= 0) m.phase = "";
        const a = foeA + m.side * Math.PI / 2;
        return { x: foe.x + Math.cos(a) * 800 * U, y: foe.y + Math.sin(a) * 800 * U };
      }
      // Its six o'clock, a little way back.
      const six = { x: foe.x - Math.cos(foeA) * 380 * U, y: foe.y - Math.sin(foeA) * 380 * U };
      const behind = Math.abs(nose) > 2.1;
      if (behind && d < 700 * U) {
        t.shown = true;
        return { x: foe.x + fv[0] * 0.4, y: foe.y + fv[1] * 0.4,
                 pace: Math.hypot(fv[0], fv[1]) + 80 * U };
      }
      if (Math.hypot(six.x - t.x, six.y - t.y) > 900 * U && (t.dashCool || 0) <= 0) {
        t.dash = 0.7; t.dashCool = 3;
      }
      return six;
    }
    case "admiral": {
      // Side on, at its range, and it backs off rather than be closed on.
      if (d < 600 * U) {
        return { x: t.x - Math.cos(toFoe) * 900 * U, y: t.y - Math.sin(toFoe) * 900 * U,
                 pace: top };
      }
      if (m.left <= 0) { m.left = 6 + Math.random() * 4; m.side = -m.side || 1; }
      const b = Math.atan2(t.y - foe.y, t.x - foe.x) + m.side * 0.45;
      return { x: foe.x + Math.cos(b) * 950 * U, y: foe.y + Math.sin(b) * 950 * U,
               pace: top * 0.7 };
    }
    case "warden": {
      // Sidestep: on a rhythm, and at once when your nose finds it.
      if (m.left <= 0) { m.side = -m.side || 1; m.left = 1.2 + Math.random() * 0.9; }
      let quick = 1;
      if (Math.abs(nose) < 0.18 && d < 1400 * U && (m.dodge || 0) <= 0) {
        m.side = nose >= 0 ? 1 : -1; m.left = 1.1; m.dodge = 1.6; quick = 1.5;
      }
      m.dodge = Math.max(0, (m.dodge || 0) - dt);
      if (m.dodge > 1) quick = 1.5;
      const across = toFoe + m.side * Math.PI / 2;
      const inOut = Math.max(-1, Math.min(1, (d - 560 * U) / (400 * U)));
      let vx = Math.cos(across) + Math.cos(toFoe) * inOut;
      let vy = Math.sin(across) + Math.sin(toFoe) * inOut;
      const n = Math.hypot(vx, vy) || 1;
      const sp = top * 0.75 * quick;
      return { x: t.x + vx / n * 400, y: t.y + vy / n * 400, face: toFoe,
               v: [vx / n * sp + fv[0] * 0.6, vy / n * sp + fv[1] * 0.6] };
    }
    case "queen": {
      // Backing away, facing you, at a walk.
      const back = toFoe + Math.PI;
      const sp = d < 900 * U ? top * 0.45 : 0;
      return { x: t.x + Math.cos(back) * 400, y: t.y + Math.sin(back) * 400,
               face: toFoe, v: [Math.cos(back) * sp, Math.sin(back) * sp] };
    }
  }
  return { x: foe.x, y: foe.y };
}

/* Each boss's power, every frame. */
function bossPower(t, dt) {
  const me = ships[0];
  t.shieldFlash = Math.max(0, (t.shieldFlash || 0) - dt);
  const rested = clock - (t.lastHit == null ? -99 : t.lastHit);
  if (t.boss === "admiral") {
    // A screen worth forty points of hull, back up after three quiet seconds.
    t.shieldMax = 40;
    if (t.shield == null) t.shield = t.shieldMax;
    if (rested > 3) t.shield = Math.min(t.shieldMax, t.shield + 12 * dt);
  } else if (t.boss === "queen") {
    /* Roused (see `bossFight`), she makes bugs. Ric: "queen should feel
       like your fighting galaga bugs. it just takes ships and has them
       suicide bomb you." So she takes them: her beam reaches for the nearest
       unarmed ship that is not hers, holds it for a second and a half, and it
       comes back one of hers. With nothing to take, she builds them in her
       bay, three at a time. Never more than twelve. See `bugStep`. */
    t.towing = false;
    if (clock - (t.fightAt == null ? -99 : t.fightAt) < 0.5 && me.alive && !cloaked(me)) {
      const brood = surv.drones.filter(dr => dr.queen === t).length;
      // The beam, on a ship.
      if (!t.taking && brood < 12) {
        let best = null, bd = 1600 * U;
        for (const o of surv.traffic) {
          if (o === t || o.boss || o.leadId === t.id) continue;
          if (ROLES[o.role || o.kind] && ROLES[o.role || o.kind].armed) continue;
          const dd = Math.hypot(o.x - t.x, o.y - t.y);
          if (dd < bd) { bd = dd; best = o; }
        }
        if (best) { t.taking = best; t.takeT = 1.5; }
      }
      if (t.taking) {
        const o = t.taking;
        const i = surv.traffic.indexOf(o);
        if (i < 0 || Math.hypot(o.x - t.x, o.y - t.y) > 1900 * U) t.taking = null;
        else {
          o.vx = (o.vx || 0) * 0.9; o.vy = (o.vy || 0) * 0.9;
          o.stun = Math.max(o.stun || 0, 0.3);
          t.takeT -= dt;
          if (t.takeT <= 0) {
            surv.traffic.splice(i, 1);
            if (o.id) surv.goneTraffic.add(o.id);
            surv.drones.push(makeBug(t, o.x, o.y, o.hull));
            burst(o.x, o.y, BOSS_COLOUR, 14, 200 * U);
            gameSound("boom", o.x, o.y);
            chatter(t.name + " took a " + shipSpec(o.hull).name.toLowerCase() + ".",
                    BOSS_COLOUR, t);
            t.taking = null;
          }
        }
      }
      // And out of her bay when there is nothing better.
      t.droneCool = (t.droneCool == null ? 1 : t.droneCool) - dt;
      if (t.droneCool <= 0 && brood < 12) {
        t.droneCool = 3;
        for (let k = 0; k < 4; k++) {
          const a = t.a + (k - 1.5) * 0.45;
          surv.drones.push(makeBug(t, t.x + Math.cos(a) * hullR(t),
                                   t.y + Math.sin(a) * hullR(t), null));
        }
      }
      /* They go one at a time, and now and then as a pair peeling off
         opposite ways, once there is a row to spare. */
      t.diveCool = (t.diveCool == null ? 2.5 : t.diveCool) - dt;
      const ready = surv.drones.filter(dr => dr.queen === t && dr.bug === "form");
      if (t.diveCool <= 0 && ready.length >= 3) {
        t.diveCool = 1.6 + Math.random() * 0.9;
        const n = ready.length >= 6 && Math.random() < 0.35 ? 2 : 1;
        const side = Math.random() < 0.5 ? 1 : -1;
        for (let k = 0; k < n; k++) {
          const dr = ready.splice(Math.floor(Math.random() * ready.length), 1)[0];
          dr.bug = "swoop"; dr.bugT = 0.9; dr.side = k ? -side : side;
        }
      }
    } else t.taking = null;
    for (const dr of surv.drones) if (dr.queen === t) dr.post = { x: t.x, y: t.y };
    // Her crews patch her, and her escorts, whenever nobody is shooting.
    if (rested > 3) {
      for (const o of surv.traffic) {
        if (o !== t && o.leadId !== t.id) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.03 * dt);
      }
    }
  } else if (t.boss === "corsair") {
    t.dash = Math.max(0, (t.dash || 0) - dt);
    t.dashCool = Math.max(0, (t.dashCool || 0) - dt);
  } else if (t.boss === "warden") {
    /* Two missiles every four seconds at whatever it is fighting. They turn
       after it, and a cloak or a decoy loses them like any other seeker. */
    t.swarmCool = (t.swarmCool == null ? 2 : t.swarmCool) - dt;
    const foe = t.angry && me.alive ? me : t.angryAt;
    if (foe && t.swarmCool <= 0 && Math.hypot(foe.x - t.x, foe.y - t.y) < 2000 * U) {
      t.swarmCool = 4;
      for (const side of [-1, 1]) {
        const a = t.a + side * 0.6;
        surv.shots.push({
          x: t.x + Math.cos(a) * 30 * U, y: t.y + Math.sin(a) * 30 * U,
          vx: Math.cos(a) * BOT_BULLET_SPD * 0.7 * U + (t.vx || 0),
          vy: Math.sin(a) * BOT_BULLET_SPD * 0.7 * U + (t.vy || 0),
          life: 4, dmg: 2, friendly: foe !== me, from: t,
          seek: 2.6, target: foe, missile: true
        });
      }
      gameSound("seeker", t.x, t.y);
    }
  }
}

/* A boss down. Its part, whoever killed it, and its bounty if it was you. */
function bossDown(t, byYou) {
  const B = BOSSES[t.boss];
  // Its sky is empty now, for good.
  if (t.lairId) {
    surv.bossesDown.add(t.lairId);
    if (surv.inLair && surv.inLair.id === t.lairId) surv.inLair = null;
  }
  burst(t.x, t.y, BOSS_COLOUR, 60, 700 * U);
  gameSound("explode", t.x, t.y);
  addShake(12);
  // What made it powerful, lying where it died.
  const part = moduleSpec(BOSS_PARTS[t.boss]);
  if (part) {
    const spot = safeDrop(t.x, t.y);
    surv.dropped.push({ key: part.key, name: part.name, x: spot.x, y: spot.y,
                        mod: true, id: dropId() });
    noteKnown("part", spot.x, spot.y, part.name);
  }
  if (!byYou) {
    saveSurveyBook();
    chatter(t.name + " is dead, and not by you. " +
            (part ? part.name + " is out there for whoever gets to it." : ""),
            BOSS_COLOUR, t);
    return;
  }
  let pay = B.bounty;
  if (t.boss === "warlord") {
    for (const f of FACTIONS) addRep(f.key, 40);
  } else if (t.boss === "corsair") {
    for (const f of FACTIONS) addRep(f.key, 25);
  } else if (t.boss === "admiral" || t.boss === "warden") {
    const enemy = warPairs()[t.faction];
    if (enemy) addRep(enemy, 80); else pay = 0;
    weaken(t.faction, 0.12);
  }
  if (pay) surv.cash += pay;
  chatter(t.name + " is dead." + (pay ? " " + money(pay) + " bounty." : "") +
          (part ? " It dropped " + part.name + "." : ""), BOSS_COLOUR, t);
  gameSound("win", t.x, t.y);
  saveSurveyBook();
}

/* ── handing water across ─────────────────────────────────────────────────
   The one thing you can do for a ship that has run out, and it costs the only
   resource in this mode that is genuinely scarce: your own water. Not cash,
   which you have plenty of by the deep, and not cargo, which is fungible —
   twenty minutes is the whole tank, so two hundred seconds is a sixth of how
   long you can stay out.

   Which is the point. It touches three things at once: the tank that decides
   how far you can go, the standing that decides who shoots at you, and the
   lane that ship was going to finish. Refuse and it dies, and you can strip it
   later, and the station it was carrying to goes short. That is the trade, and
   it is a real one in both directions. */
const HELP_NEAR    = 900;    // how close before you can pass it across
const GIVE_WATER   = 200;    // seconds out of your tank
const WATER_KEEP   = 240;    // and what you must still have left afterwards
const WATER_THANKS = 190;
const canGiveWater = () => !!(surv && surv.helping &&
                              surv.water >= GIVE_WATER + WATER_KEEP);
function giveWater() {
  const t = surv && surv.helping;
  if (!t || !t.adrift) return false;
  if (!canGiveWater()) {
    chatter("Not with what is in your own tank.", "#ff8f77");
    return false;
  }
  surv.water -= GIVE_WATER;
  t.adrift = false;
  t.tank = t.tankFull || 90;
  t.doom = 0;
  t.pleaded = false;
  t.saved = true;
  surv.cash += WATER_THANKS;
  /* Worth rather less than pulling one out of a sentry attack, because this
     cost you a tank rather than a fight — but it is the same kind of act and
     the sector treats it as one. */
  addRep(t.faction, REP.RESCUE * 0.6);
  surv.t.watered = true;
  rememberFriend(t, "water");
  chatter("Water across. They can make the next station. " +
          money(WATER_THANKS) + ".", CASH);
  gameSound("win", t.x, t.y);
  saveSurveyBook();
  return true;
}

/* ── asking what a thing is ───────────────────────────────────────────────
   The sector writes names on things. THE ACTION AT MULANE on a stone floating
   where a fight happened, EREIA V on a world, a hole-word on a well you should
   not be this close to. A name with no way to ask about it is a tease: it says
   there is something to know and then offers no way to know it.

   So anything with a name answers for itself. Go up to it, press `E`, and get a
   card — what it is, what happened here, and whether being this close is a good
   idea. The same key as docking, because it is the same gesture: walking up to
   something and asking it a question. The two can never collide, since a
   station is a station and none of this is.

   Candidates are ranked by *fraction of their own reach* rather than by
   distance, which is the only ranking that works when they run from a
   twenty-six-unit pale dot to a two-thousand-seven-hundred-unit derelict: a
   drive part twenty units off your nose beats the derelict you are flying
   inside, because you are nearer to it in the only sense that matters.

   The world does not stop while you read. Nothing in this mode stops. If you
   ask a supermassive well what it is while sitting inside its reach, it will
   tell you, and it will go on pulling. */
const LANDMARK_LORE = {
  graveyard: [
    "A raid ended here, and nobody came back for the hulls.",
    "Seven of them, still roughly in the formation they died in — which tells " +
    "you they never saw it coming, and tells you something out here can do " +
    "that to seven ships at once.",
    "They break for metal. They have been here a long time and they are not " +
    "going anywhere."
  ],
  rogue: [
    "A world with no star.",
    "Nothing threw it out here — there is nothing out here to throw it — so " +
    "what left was the star, and there is no crater where a sun used to be.",
    "The ash on it is old. Whatever it was once warm enough for happened a " +
    "very long time ago."
  ],
  "last-transmission": [
    "One ship, still broadcasting.",
    "The beacon runs on a loop with no words in it: a carrier, a gap, a " +
    "carrier. Somebody set it going and never came back to say what for.",
    "It is louder than a beacon that size has any business being. Something " +
    "is helping it."
  ],
  "pale-dot": [
    "Twenty-six units across, and you very nearly flew past it.",
    "At any range worth mentioning it is one pixel of reflected nothing, " +
    "which is the whole reason it is in the book: you had to be looking.",
    "Ice all the way through. There is no story on it, and that is the story."
  ],
  "the-wall": [
    "Somebody tried to open a wormhole here, on a frame two thousand units " +
    "square, and it did not open.",
    "Four anchors, the construction yards collapsed against them where they " +
    "stood, and a mouth at the centre that never finished forming.",
    "It will not take you anywhere. That is what a failed gate is."
  ],
  supernebula: [
    "The big one.",
    "Every cloud you have flown through so far was weather. This is the thing " +
    "the weather comes off.",
    "It hides nothing and it harms nothing. It is simply the largest object in " +
    "the sector that is not a star, and it was worth the flight."
  ],
  "node-01": [
    "Somebody else's terminal, running in the dark.",
    "The hull around it is a wreck and the machine inside it is not. It is " +
    "answering something, and the something is not you, and it has been " +
    "answering for a while.",
    "NODE 01 is not a name anybody gave it. It is what it calls itself."
  ],
  vault: [
    "Somebody built this to keep people out of it.",
    "A sealed box two and a half thousand units across, one gate in one wall, " +
    "and inside it a ring corridor around a core. Four spokes run in from the " +
    "ring and three of them are blind — they end in a wall, and which one is " +
    "the real one is different in every sector, so nobody can be told the answer.",
    "There is no flag on it and no wreckage around it. Whatever is in the " +
    "middle, it was worth this much concrete to somebody who is not here " +
    "any more."
  ],
  leviathan: [
    "It was a ship, once.",
    "Two thousand seven hundred units stem to stern, twenty-six hull sections, " +
    "and a corridor down the middle wide enough to fly. Nothing out here " +
    "builds at this scale. Nothing out here ever did.",
    "The stern is open, and something is in the last of it."
  ]
};

/* Each card is built only for the thing that won, so the prose is assembled
   once on a keypress rather than nine times a frame for everything in sight. */
function battleCard(b, stone) {
  const A = factionOf(b.sides[0]), B = factionOf(b.sides[1]);
  const age = surv.battleAge[b.id] || 0;
  const size = b.fleet <= 4 ? "a skirmish"
             : b.fleet <= 9 ? "a real fight"
             : "a battle, by any standard out here";
  return stone ? {
    kind: "A BATTLE, REMEMBERED", name: b.name, colour: NEBULA,
    lines: [
      "It is over.",
      A.name + " and " + B.name + " fought here over something neither of " +
      "them is still around to explain. It was " + size + ".",
      age < 180 ? "The metal is still warm. You missed it by very little."
      : age < 1200 ? "The metal has gone cold. Recent, but not just now."
      : "Old cold metal. Whatever this was about was settled a long time ago.",
      "The hulks can be stripped, and nobody is left to object."
    ]
  } : {
    kind: "A BATTLE, HAPPENING NOW", name: b.name, colour: "#ff8f77",
    lines: [
      A.name + " against " + B.name + ". " + b.fleet + " hulls, and " + size + ".",
      "Everything in it has a gun and neither side will stop to work out " +
      "whose side you are on. Getting between one of them and what it is " +
      "shooting at is how this kills you.",
      "It will not last. Come back later and this is a field of wrecks, or " +
      "nothing at all — not every fight is remembered."
    ]
  };
}

function wellCard(h) {
  const hole = h.kind === "hole";
  return {
    kind: hole ? "A SUPERMASSIVE WELL" : "A SUPERMASSIVE STAR",
    name: h.name, colour: hole ? "#b79aff" : "#ffd76d",
    lines: [
      hole ? "A hole heavy enough to have its own name."
           : "A star heavy enough to have its own name.",
      "Its pull reaches about " + Math.round(h.reach).toLocaleString() +
      " units. That is not the part that kills you — the part that kills you " +
      "is a dot at the middle — but it is the part you have to plan a route " +
      "around, and it is drawn on the chart at that size for exactly that reason.",
      "Whether you can leave from where you are standing depends on your " +
      "engine, which is why the warning knows your ship and not just the well.",
      hole ? "Going in and coming back out again is in the book. Coming back " +
             "out is the hard half."
           : "Close enough to a star mends a hull. Closer than that is how " +
             "you stop having one."
    ]
  };
}

function worldCard(pl) {
  /* Two of the landmarks *are* worlds — the rogue with no star, and the pale
     dot you nearly flew past — and a world always beat its own landmark to the
     question, because they sit at the same point and the planet is offered
     first. So the entry you crossed the sector for answered in the generic
     voice, under a generated name, and the hand-written card for it could
     never be reached from anywhere.

     Answered here rather than by reordering the candidates, because the
     ordering only decides the tie at dead centre: a thousand units off the
     rogue, the landmark is already out of its own reach and the world is not,
     and the card would have changed its mind about what you were looking at
     as you closed on it. */
  if (pl.rogue || pl.pale) {
    const lm = surv.landmarks.find(l => l.key === (pl.rogue ? "rogue" : "pale-dot"));
    if (lm && LANDMARK_LORE[lm.key]) return landmarkCard(lm);
  }
  const k = worldKind(pl.kind);
  const lines = [
    "A world, " + Math.round(pl.r * 2).toLocaleString() + " units across, in " +
    placeAt(pl.x, pl.y).text + "."
  ];
  if (pl.rogue) lines.push("Nothing warms it. There is no star in this whole chunk.");
  if (pl.inhabited) {
    lines.push("Somebody lives here, and they will sell you water and food. " +
               "About one world in twenty has anybody on it, fewer out on " +
               "the frontier and nobody in the Deep Void \u2014 so this is a " +
               "supply line, and it is worth writing down.");
  } else {
    lines.push("Nobody lives here. There is nothing to buy.");
  }
  lines.push(pl.air
    ? "There is air. You can fly through it and skim water out of it for " +
      "nothing, slowly — the option for when you cannot afford the other one."
    : "No atmosphere. Nothing to skim.");
  lines.push("It is solid, and it will break a rock that hits it, and it will " +
             "break you.");
  return { kind: pl.inhabited ? "AN INHABITED WORLD" : "A WORLD",
           name: pl.name, colour: k.disc, lines };
}

function partCard(pt) {
  const spec = partSpec(pt.key);
  const lines = [];
  if (spec) {
    const svc = serviceSpec(spec.opens);
    lines.push("One of the six your own station is short of." +
               (svc ? " It turns " + svc.name + " back on." : ""));
    lines.push("The clue was: “" + spec.clue + "”  And here it is, in " +
               spec.where + ".");
  }
  if (pt.dropped) {
    lines.push("You were carrying this when you died. It stayed where you " +
               "left it, and it will stay there — it does not drift and it " +
               "does not expire.");
  }
  lines.push("Fly into it to pick it up. Then take it home.");
  return { kind: "A PIECE OF YOUR STATION", name: pt.name, colour: CASH,
           lines };
}

/* A ship with a name on it, which out here means one of exactly two things. */
function shipCard(t) {
  if (t.grudge) {
    return {
      kind: "THE ONE THAT GOT AWAY", name: t.name, colour: "#ff8f77",
      lines: [
        "You shot this ship and did not finish it.",
        "It left the sector you were in with " + Math.max(1, Math.round(t.hp)) +
        " hull points and it has not been anywhere to get them back. It has " +
        "come to find you rather than to rob anybody, which makes it the only " +
        "ship out here with a reason.",
        "You are favoured to win the rematch. It knows that and it came anyway."
      ]
    };
  }
  if (t.friend) {
    return {
      kind: "A SHIP YOU HELPED", name: t.name, colour: CASH,
      lines: [
        t.friend.why === "water"
          ? "You gave this ship water when it was drifting."
          : "You got this ship out of trouble once.",
        "It is going about its day again, under " +
        factionOf(t.faction).name + ", and it knows you by sight. Almost " +
        "nothing out here is named — a name means you were part of what " +
        "happened to it.",
        t.friend.repaid
          ? "It has already squared the favour with you. Nothing is owed in " +
            "either direction now."
          : "It has not paid the favour back yet. If it finds you nearly dry, " +
            "it will."
      ]
    };
  }
  return {
    kind: "A HAULER, ADRIFT", name: factionOf(t.faction).short + " HAULER",
    colour: ICE_C,
    lines: [
      "It has run out of water and it is not flying anywhere.",
      "A ship out here burns its reserve when something goes wrong for it — " +
      "being chased, being shot at, fighting a well. So this one is evidence: " +
      "something happened in this piece of sky.",
      "You can hand two hundred seconds of your own tank across, which is a " +
      "sixth of how long you can stay out. They pay, their flag remembers it, " +
      "and they finish the run.",
      "Or you can wait. In " + Math.max(0, Math.round(t.doom)) + " seconds it " +
      "stops answering, and then it is a hull you can strip."
    ]
  };
}

function gateCard(g) {
  return {
    kind: "A GATE", name: "JUMP GATE", colour: "#b79aff",
    lines: [
      "A mouth that goes somewhere else in this sector.",
      "Fly into it and you come out of its pair, which may be a long way from " +
      "here and is not somewhere you chose. A gate is a shortcut somebody else " +
      "laid out; the light drive is the one you get to aim.",
      "It is free, it is instant, and there is no way to know which end you " +
      "are about to arrive at until you have used this one once."
    ]
  };
}

function landmarkCard(lm) {
  return { kind: "A LANDMARK", name: lm.name, colour: ICE_C,
           lines: LANDMARK_LORE[lm.key].slice() };
}

/* What you are close enough to ask about, or null. Recomputed every frame
   because the prompt on the flight panel has to be honest about the moment. */
function lookNear() {
  const me = ships[0];
  if (!me || !me.alive || surv.death) return null;
  let best = null;
  const offer = (x, y, reach, make) => {
    const f = dist2(x, y, me.x, me.y) / (reach * reach);
    if (f > 1) return;
    if (!best || f < best.f) best = { f, make };
  };

  for (const b of surv.battles) {
    const stone = !!(b.over && surv.memorials.has(b.id));
    if (!stone && b.over) continue;
    offer(b.x, b.y, b.r + 1100, () => battleCard(b, stone));
  }
  for (const h of hazards) {
    if (!h.name) continue;
    offer(h.x, h.y, h.reach * 1.25, () => wellCard(h));
  }
  for (const pl of surv.planets) {
    if (!pl.name) continue;
    offer(pl.x, pl.y, pl.r + 2200, () => worldCard(pl));
  }
  for (const pt of surv.parts) offer(pt.x, pt.y, 1000, () => partCard(pt));
  /* The ships with names on them. Close range, because a hull is a small thing
     in a sector this size and asking about one means being alongside it. */
  for (const t of surv.traffic) {
    if (!t.friend && !t.grudge && !t.adrift) continue;
    offer(t.x, t.y, 1100, () => shipCard(t));
  }
  for (const lm of surv.landmarks) {
    if (!LANDMARK_LORE[lm.key]) continue;
    offer(lm.x, lm.y, lm.r * 1.7, () => landmarkCard(lm));
  }
  /* The dead gate at THE WALL is deliberately skipped: it is the landmark's
     whole point and the landmark's own card says so. Being told twice, once
     wrongly, is worse than not being told. */
  for (const g of surv.gates) {
    if (g.dead) continue;
    offer(g.x, g.y, 1000, () => gateCard(g));
  }
  return best ? best.make() : null;
}

/* Drawing water out of an atmosphere. Deliberately slow: it is about a tenth
   of what a station hands you in one press, so it is the thing you do when you
   cannot afford the alternative or there is no alternative to afford — and it
   is never worth doing if a station is in reach.

   It only ever fills water. Nothing you can scoop out of the sky is food, and
   an atmosphere that fed you would make the inhabited worlds pointless. */
const SKIM_RATE = 3.4;        // seconds of water a second of skimming
function surveySkim(dt) {
  if (!surv.overAir || surv.death) return;
  const me = ships[0];
  if (!me.alive) return;
  if (surv.water >= WATER_FULL) return;
  surv.water = Math.min(WATER_FULL, surv.water + dt * SKIM_RATE *
                                    (1 + mods().skim));
  surv.skimming = 0.2;
}

/* Stripping a dead hull. Four rounds and it comes apart — the same verb the
   rest of the game already has for a rock, pointed at something that is worth
   more and does not drift as far. */
function hitHulk(h, i, b) {
  /* The round's damage, not a flat one. A rail lance chipped a dead hull
     exactly as fast as the starting cannon did, which made every gun in the
     game the same gun as far as salvage was concerned — and a rock has
     counted damage properly for years, so the two disagreed about what a
     bullet is. */
  h.hp -= Math.max(1, Math.round(b && b.dmg ? b.dmg : 1));
  burst(h.x, h.y, WRECK, 8, 150 * U);
  gameSound("hit", h.x, h.y);
  if (h.hp > 0) return;
  burst(h.x, h.y, WRECK, 20, 240 * U);
  gameSound("boom", h.x, h.y);
  dropMote(h.x, h.y, YIELD.hulk, 70, "hulk");
  surv.stripped.add(h.id);
  surv.hulks.splice(i, 1);
  saveSurveyBook();
}

/* Player rounds against the things only Survey has. Kept out of the main
   bullet loop, which knows about ships and rocks and should not have to learn
   about a sector's furniture. */
function surveyBullets() {
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    let spent = false;
    for (let i = surv.drones.length - 1; i >= 0 && !spent; i--) {
      const d = surv.drones[i];
      if (d.ally) continue;              // your own bugs, out of a Brood Bay
      if (dist2(b.x, b.y, d.x, d.y) > (18 * U) ** 2) continue;
      spent = true;
      d.hp -= (b.dmg || 1);
      // Your round on something taking a ship apart. See the distress branch.
      if (d.prey) d.prey.helped = true;
      d.hit = 0.12;
      d.awake = true;
      burst(b.x, b.y, DRONE_COLOUR, 5, 120 * U);
      if (d.hp <= 0) killDrone(i); else gameSound("hit", d.x, d.y);
    }
    /* Traffic can be shot. Deliberately: "you can rob it" is half of what
       makes company mean anything, and a neutral you are physically unable to
       harm is scenery with a flight path. */
    for (let i = surv.traffic.length - 1; i >= 0 && !spent; i--) {
      const t = surv.traffic[i];
      const rr = hullR(t);
      if (dist2(b.x, b.y, t.x, t.y) > rr * rr) continue;
      spent = true;
      takeHit(t, b.dmg || 1);
      /* Shot at, and armed. A patrol that took fire and carried on politely
         shooting at sentries was not a neutral, it was a target — being unable
         to defend itself is not the same thing as not wanting to fight. Anger
         does not wear off: you started it, and it has a long memory.

         Any armed ship, not only a patrol. An escort you shot used to take it
         and carry on escorting, and so did a hunter's wingman. And your
         rounds count towards it deciding it has had enough, which only the
         burst charge's did: nothing ever ran from your cannon. */
      if (ROLES[t.role || t.kind] && ROLES[t.role || t.kind].armed) t.angry = true;
      hurtBySomebody(t, null);
      /* Marked as *yours*. If this one gets out of range alive it goes in the
         book with the damage you did to it — see `rememberGrudge`. A name is
         given at the moment it is hurt rather than when it escapes, because it
         needs to be the same ship either way. */
      if (t.faction === "pirate" && !t.hurtBy) {
        t.hurtBy = true;
        if (!t.name) t.name = shipName(true);
      }
      burst(b.x, b.y, trafficColour(t), 5, 120 * U);
      if (t.hp <= 0) killTraffic(i, true); else gameSound("hit", t.x, t.y);
    }
    /* Hulks are not asked about here. The bullet loop's own solid sweep gets
       to them first — it steps along the round's travel rather than sampling
       its new position, so it catches what this misses — and two paths for
       "did this round hit a dead hull" is how the first one came to be
       unreachable. See `solidHit`. */
    if (!spent && surv.leviathan) {
      for (const g of surv.leviathan.segs) {
        if (dist2(b.x, b.y, g.x, g.y) < g.r * g.r) {
          burst(b.x, b.y, WRECK, 3, 90 * U);
          gameSound("hit", b.x, b.y);
          spent = true;
          break;
        }
      }
    }
    if (spent) {
      if (b.boom) explode(b);
      // A lance goes through. It does not get to hit the same hull twice, but
      // the next thing behind it is fair game.
      if (b.punch > 1) { b.punch--; continue; }
      bullets.splice(bi, 1);
    }
  }
}
