"use strict";

/* KONDRITE — SURVEY — THE TICK
   ─────────────────────────────────────────────────────────────────────────────
   The background, the sky knowing where it is, and surveyTick: one frame
   of Survey.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── the background ───────────────────────────────────────────────────────
   Survey had no stars behind it, which is why the sector could look like a
   black sheet with objects on it however much was in front of you. Three
   layers at different depths fix that for the price of a hash: a star's
   position is a pure function of where it is, so nothing is stored and the
   field is the same every time you fly back through it.

   Parallax is the whole point. A star at depth `k` sits at world position
   `p + cam * (1 - k)`, so it slides at `k` of the camera's speed — the far
   layer barely moves and the near one nearly keeps up, and the gap between
   them is what reads as distance. Only the cells actually on screen are ever
   visited, so an endless sky costs what one screen costs. */
const SKY = [
  { k: 0.22, cell: 150, size: 1.1, alpha: 0.30, tint: "#8f86c4" },
  { k: 0.42, cell: 115, size: 1.5, alpha: 0.45, tint: "#b9b2e8" },
  { k: 0.68, cell: 90,  size: 1.9, alpha: 0.62, tint: "#e8e4ff" }
];

function skyHash(x, y, salt) {
  let h = (surv ? surv.seed : 1) ^ salt;
  h = Math.imul(h ^ (x + 0x7f4a7c15), 0x9e3779b1) >>> 0;
  h = Math.imul(h ^ (y + 0x165667b1), 0x85ebca77) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/* Two colours, mixed. Used only by the sky, and deliberately cheap: this runs
   three times a frame, not once a star. */
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const m = (sh) => {
    const x = (pa >> sh) & 255, y = (pb >> sh) & 255;
    return Math.round(x + (y - x) * t);
  };
  return "rgb(" + m(16) + "," + m(8) + "," + m(0) + ")";
}

/* ── the sky knows where it is ────────────────────────────────────────────
   A few regions tint the starfield and thin it. Small on purpose: this is not
   a label and must never become one — the game never names a region, and a sky
   you could read a name off would be the Minecraft biome banner in a different
   font. What it is for is the half-second of "something is different here"
   that makes somebody look at the panel and work out what.

   Faded by `regionDepth`, which is 0 at a border and 1 at the middle, so the
   change arrives over a few thousand units rather than switching on across a
   line. That is the same ramp the Murk's static already uses, and the borders
   are Voronoi — invisible, irregular, and not something the player should ever
   be able to point at.

   The camera decides, not the ship: the sky is drawn for the view, and a
   dragged chart or a wide zoom would otherwise tint from wherever the hull
   happens to be sitting. */
function skyHere() {
  if (!(mode && mode.survey && surv)) return null;
  const reg = regionOf(cam.x, cam.y);
  if (!reg || !reg.sky) return null;
  const t = regionDepth(cam.x, cam.y);
  if (t <= 0.02) return null;
  return { tint: reg.sky.tint, stars: reg.sky.stars, t };
}

function drawSky() {
  const z = cam.scale || 1;
  const halfW = (SCREEN_W / 2) / z + 80;
  const halfH = (SCREEN_H / 2) / z + 80;
  const here = skyHere();
  /* How much of the region's colour reaches the stars at the middle of one.
     A third: enough to notice on a glance across a whole screen of them, not
     enough to make the sky a different colour. */
  const TINT = 0.34;
  ctx.save();
  for (let L = 0; L < SKY.length; L++) {
    const s = SKY[L];
    // Where this layer's lattice has to be walked to cover the screen.
    const px0 = cam.x * s.k - halfW, px1 = cam.x * s.k + halfW;
    const py0 = cam.y * s.k - halfH, py1 = cam.y * s.k + halfH;
    const c0 = Math.floor(px0 / s.cell), c1 = Math.ceil(px1 / s.cell);
    const r0 = Math.floor(py0 / s.cell), r1 = Math.ceil(py1 / s.cell);
    if ((c1 - c0) * (r1 - r0) > 6000) continue;      // absurd zoom; skip a layer
    ctx.fillStyle = here ? mixHex(s.tint, here.tint, TINT * here.t) : s.tint;
    /* Thinning by moving the threshold rather than by skipping stars at
       random: the lattice is a hash of the cell, so the same stars go and the
       same stars stay, and flying back and forth does not reshuffle the sky. */
    const cut = 0.62 * (here ? 1 - (1 - here.stars) * here.t : 1);
    for (let cx = c0; cx <= c1; cx++) {
      for (let cy = r0; cy <= r1; cy++) {
        const h1 = skyHash(cx, cy, L * 0x51ed + 1);
        if (h1 > cut) continue;                      // not every cell has a star
        const h2 = skyHash(cx, cy, L * 0x51ed + 2);
        const h3 = skyHash(cx, cy, L * 0x51ed + 3);
        const wx = (cx + h2) * s.cell + cam.x * (1 - s.k);
        const wy = (cy + h3) * s.cell + cam.y * (1 - s.k);
        // A slow, per-star twinkle. Off entirely under reduced motion.
        const tw = reduceMotion ? 1
                 : 0.72 + 0.28 * Math.sin(clock * 0.7 + h1 * 40);
        ctx.globalAlpha = s.alpha * tw * (0.55 + h1);
        const r = s.size * (0.7 + h2 * 0.7);
        ctx.fillRect(wx - r / 2, wy - r / 2, r, r);
      }
    }
  }
  ctx.restore();
}

// A small world-space caption. The menus have `text`, but that draws in
// screen space and everything here is under the camera transform.
function label3(str, x, y, colour, size) {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = colour;
  ctx.font = (size || 13) +
    'px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  ctx.textAlign = "center";
  ctx.fillText(str, x, y);
  ctx.restore();
}

function drawPart(pt) {
  if (!onScreen(pt.x, pt.y, 130)) return;
  const spin = reduceMotion ? 0 : clock * 0.9 + pt.phase;
  const beat = 0.55 + 0.45 * Math.sin(clock * 2.4 + pt.phase);
  ctx.save();
  ctx.translate(pt.x, pt.y);
  ctx.rotate(spin);
  glow(CASH, 2.4, 0.95, () => {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const px = Math.cos(a) * pt.r, py = Math.sin(a) * pt.r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  });
  ctx.restore();
  // A halo, because a part in a wreck field is one bright thing among forty
  // dim ones and has to win that fight from off screen.
  glow(CASH, 1.6, 0.25 + beat * 0.45, () => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r + PART_RING + beat * 18, 0, Math.PI * 2);
    ctx.stroke();
  });
  label3(pt.name, pt.x, pt.y + pt.r + 62, CASH);
}

/* ── the tick ─────────────────────────────────────────────────────────────
   Telemetry first, then the table. Everything the seventeen `test` entries
   need is gathered here once a frame; nothing walks the hazard list twice. */
function surveyTick(dt) {
  const me = ships[0];
  if (!me || !me.alive) return;
  const t = surv.t;

  streamChunks(false);
  streamRocks();
  mapHere();
  surveyWar(dt);
  livingTick(dt);

  /* How long the engine has been cold. Running dark reads off this rather
     than off the key, so a tap of thrust lights you up again and holding
     course does not. */
  surv.quiet = me.thrusting ? 0 : surv.quiet + dt;
  /* The three verbs that leave something running. The cloak is the only one
     with a rule attached: firing ends it, and `me.firedAt` is set by the
     trigger rather than read from the key, so a shot from any weapon counts
     and a held trigger cannot outlast it. */
  if (surv.cloak > 0) {
    surv.cloak = Math.max(0, surv.cloak - dt);
    if (!surv.cloak) chatter("Back on somebody's screen.", "#87d8ff");
  }
  surv.empSelf = Math.max(0, surv.empSelf - dt);
  if (surv.empRing) {
    surv.empRing.t += dt;
    if (surv.empRing.t >= EMP_RING_TIME) surv.empRing = null;
  }
  if (surv.grappleTo) {
    surv.grappleTo.t -= dt;
    if (surv.grappleTo.t <= 0) surv.grappleTo = null;
  }
  surv.warpCool = Math.max(0, surv.warpCool - dt);
  surv.bumpCool = Math.max(0, surv.bumpCool - dt);
  surv.scan.flash = Math.max(0, surv.scan.flash - dt * 0.7);

  // Echoes fade. A scan is a snapshot of a moment, not a permanent overlay —
  // the sector moves, and a chart full of hour-old returns is a lie.
  for (let i = surv.echoes.length - 1; i >= 0; i--) {
    const e = surv.echoes[i];
    /* A tracked echo follows its object and goes out with it: a sentry you
       killed must not leave a contact behind, and one that chased you must not
       leave one where it started. */
    if (e.ref) {
      /* Motes as well as ships and sentries. A salvage return carries the
         mote it was taken from so it can say what the stuff *is* — and this
         list decides whether a tracked echo is still real, so leaving motes
         out of it would have killed every salvage return on the frame it was
         made. A picked-up mote leaves the list and the contact goes out with
         it, which is the same rule the other two follow. */
      const live = surv.drones.includes(e.ref) ||
                   surv.traffic.includes(e.ref) ||
                   surv.motes.includes(e.ref);
      if (!live) { surv.echoes.splice(i, 1); continue; }
      e.x = e.ref.x; e.y = e.ref.y;
    }
    if ((e.t -= dt) <= 0) surv.echoes.splice(i, 1);
  }
  surv.scan.lit = Math.max(0, surv.scan.lit - dt);
  surv.selectFlash = Math.max(0, (surv.selectFlash || 0) - dt * 1.6);

  /* The objective is recomputed every frame rather than cached, because
     picking a part up or handing it over changes it and there is no single
     place either of those happens. */
  surv.target = objectiveTarget();
  surv.contacts = surv.target
    ? [{ key: surv.target.key, name: surv.target.name,
         x: surv.target.x, y: surv.target.y, resolved: false,
         /* A search is told a band and a delivery is told a number. See
            `objectiveTarget` — the arrow reads this rather than deciding for
            itself, so the ring and the HUD line say the same thing. */
         vague: !!surv.target.vague,
         band: rangeBand(Math.hypot(surv.target.x - me.x,
                                    surv.target.y - me.y)),
         d: Math.hypot(surv.target.x - me.x, surv.target.y - me.y) }]
    : [];
  surv.tractorLit = Math.max(0, surv.tractorLit - dt);

  // The world, in the order it has to happen: move things, then let the ship
  // hit them, then let what is left shoot at it.
  surveySolids(dt);
  surveyGates();
  // Before the sentries and the traffic, because a decoy dropped this frame
  // is a thing they are allowed to be fooled by this frame.
  surveyDevices(dt);
  surveyDrones(dt);
  surveyShots(dt);
  surveyBullets();
  surveyTraffic(dt);
  trafficBumps();
  surveyMarkets(dt);
  surveyRockSolids();
  surveyFitting(dt);
  surveyMelt(dt);
  // In the empty room none of these have anything to work with, and two of
  // them would put a ship in a sector that is meant to have none. See `LEV_ONLY`.
  if (!LEV_ONLY) {
    surveyBattles(dt);
    surveyHeat(dt);
    grudgeVisit(dt);
    surveyBosses(dt);
  }
  surveyCaches(dt);
  surveyParts(dt);
  surveyMotes(dt);
  surveyStations();
  // After stations, so landing somewhere this frame counts against this
  // frame's drain rather than the next one's — and the skim before the drain,
  // so sitting in an atmosphere on an empty tank stops the countdown on the
  // same frame rather than one frame later.
  surveySkim(dt);
  surveyLightDrive(dt);
  if (LEV_ONLY) { surv.water = WATER_FULL; surv.food = foodCap(); }
  else surveyLifeSupport(dt);
  surveyWarning();
  surveyObjectiveNote();
  surveyOpening();
  recordSurroundings();
  /* What is close enough to be asked about. Every frame, because the prompt on
     the panel has to be true at the moment you press the key — a prompt for a
     stone you drifted past two seconds ago would open the wrong card. */
  surv.near = lookNear();
  updatePickups(dt);

  /* Clamped. `recharge` is documented as 0 to 1 and nothing enforced it: it
     is summed across the four slots, so a second part that bought scanner
     cooldown back would reach 1 between them, and `SURVEY_SCAN * 0` divides
     the clock into a charge of Infinity — or past 1, into a scanner that
     counts *down* and never fires again. One part gives 0.25 today, so this
     has never fired; it is one line and it is the difference between adding a
     part and breaking the mode's only verb. */
  const back = Math.max(0, Math.min(0.9, mods().recharge));
  surv.scan.charge = Math.min(1, surv.scan.charge +
                              dt / (SURVEY_SCAN * (1 - back)));
  surv.save -= dt;
  if (surv.save <= 0) { surv.save = 15; saveSurveyBook(); }

  const sp = Math.hypot(me.vx, me.vy);
  const moved = sp * dt;
  t.dist += moved;
  t.top = Math.max(t.top, sp);
  t.coast = me.thrusting ? 0 : t.coast + dt;
  t.fromHome = Math.hypot(me.x, me.y);

  if (surveyHUD) {
    surveyHUD.reveal(me.x, me.y, SURVEY_SIGHT);
    // The trail is gone from the chart, so there is nothing to track for.
    // See archive/SURVEY-BUILT.md, "The places", item E.
    t.charted = surveyHUD.charted();
  }

  // One pass over the wells does the work of six entries.
  let stars = 0, holes = 0, nearestStar = Infinity;
  let inWell = null, skim = false, tight = 0, lit = null;
  for (const h of hazards) {
    const d = Math.hypot(me.x - h.x, me.y - h.y);
    if (h.kind === "star") nearestStar = Math.min(nearestStar, d);
    if (d < h.reach) {
      if (h.kind === "star") { stars++; lit = lit || h; } else holes++;
      if (!inWell || d < inWell.d) inWell = { h, d };
      /* THREAD: between two cores, touching neither. This asked to be inside
         `kill * 2.6` of two wells at once — 120 units of a star — and measured
         over a 29-chunk patch of real sector, **no two wells are ever that
         close**. The entry could not be earned by anybody, ever.

         What it should have asked is what it says: well inside both wells'
         reach, and outside both killing radii. Forty-seven pairs in that same
         patch have overlapping reaches, so it is rare and it is possible. */
      if (d < h.reach * 0.8 && d > h.kill * 1.3) tight++;
      if (d < h.kill * 1.6) skim = true;
    }
  }
  t.stars = stars; t.holes = holes;
  t.nearStar = t.nearStar || stars > 0;
  if (skim) t.skimmed = true;
  if (tight >= 2) t.threaded = true;
  t.dark = nearestStar > 2200 ? t.dark + moved : 0;
  t.stopped = sp < 3 && !inWell && t.dist > 400;

  /* Entering and leaving a well. Both entries that come off this are about
     the leaving, so the speed on the way in is remembered and compared with
     the speed on the way out. */
  if (inWell && !t.inWell) {
    t.inWell = inWell.h;
    t.entrySpeed = sp;
  } else if (!inWell && t.inWell) {
    if (t.inWell.kind === "hole") t.leftHole = true;
    if (sp > t.entrySpeed * 1.3 && sp > MAX_SPEED * U * 0.7) t.slung = true;
    t.inWell = null;
  }

  /* In a star's light the hull comes back — *if you are carrying panels*. This
     was true of every hull in the game and nothing on the ship said so, which
     made the best mechanic in the mode read as a property of the universe
     rather than as something you own. It is a part now, and a ship without one
     carries its damage home.

     `inStar` stays true either way: standing in the light is a fact about where
     you are, and the panel decides what to say about it. */
  surv.inStar = !!lit;
  if (lit && mods().solar && me.hull < me.maxHull) {
    me.hull = Math.min(me.maxHull, me.hull + SURVEY_REPAIR * dt);
  }

  /* An eclipse is geometry, not an object: a world sitting between you and a
     sun. Only checked against stars whose glow you could actually see, so it
     is a handful of comparisons rather than every pair in the sector. */
  t.eclipse = false;
  for (const h of hazards) {
    if (h.kind !== "star" || t.eclipse) continue;
    const hd = Math.hypot(h.x - me.x, h.y - me.y);
    if (hd > 3200) continue;
    for (const p of surv.planets) {
      const pd = Math.hypot(p.x - me.x, p.y - me.y);
      if (pd > hd || pd < p.r * 1.5) continue;
      const ux = (h.x - me.x) / hd, uy = (h.y - me.y) / hd;
      const px = p.x - me.x, py = p.y - me.y;
      if (Math.abs(px * uy - py * ux) < p.r) { t.eclipse = true; break; }
    }
  }

  // Arriving somewhere. Landmarks are found by being near them — there is
  // nothing to press, because pressing something is not what looking is.
  for (const lm of surv.landmarks) {
    if (lm.found) continue;
    if (dist2(me.x, me.y, lm.x, lm.y) < lm.r * lm.r) surveyFind(lm.key);
  }
  for (const c of surv.contacts) {
    if (!c.resolved && dist2(me.x, me.y, c.x, c.y) < 600 * 600) c.resolved = true;
  }

  for (const e of ALMANAC) {
    if (e.test && !surv.found.has(e.key) && e.test(t)) surveyFind(e.key);
  }
}
