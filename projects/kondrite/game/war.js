"use strict";

/* KONDRITE — THE WAR MOVES
   ─────────────────────────────────────────────────────────────────────────────
   The war's turn, traffic built from it, a quiet home, company, battles in
   progress, ships with names, what a scan calls a ship, and the hangar.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ═══ THE WAR MOVES ══════════════════════════════════════════════════════
   Ric: *"the politicts are going to be changing so their land would change
   too based on who is at war and stuff."*

   Borders move for reasons, and every reason is something that happened:

     · **a battle is won** — the side with ships left takes the ground it was
       fought over (see `endBattle`);
     · **the front grinds** — every so often a cell on a front goes to
       whichever side is stronger, more often the more lopsided it is;
     · **the frontier fills** — a power settles the unheld sky beside its own,
       slowly, and faster the stronger it is; lawless space gets claimed the
       same way, more slowly still;
     · **wars end and start** — two sides worn down below half stop shooting,
       and a power that has recovered and sat at peace long enough goes to war
       with the neighbour it shares the most border with.

   `strength` is what keeps it honest: a side that loses ships loses the
   ability to hold ground, and it is the player's kills as well as the
   battles that take it away. Only the sky near you is worked — about a
   million units either way — because a war nobody can see changing is a war
   that might as well not be changing, and the chart shows the rest as it was
   when you last looked. */
const WAR_TICK = 45;           // seconds between turns of the war
const WAR_REACH = 12;          // region cells either side of you it works
const WAR_PEACE_MIN = 15 * 60; // how long a peace lasts at the least

function weaken(power, n) {
  if (!surv || !surv.war || !surv.war.strength || !(power in surv.war.strength)) return;
  const s = surv.war.strength;
  s[power] = Math.max(0.2, Math.min(1.4, s[power] - n));
}

/* A cell changes hands. Home never does: it is the frontier in every sector,
   so the opening stays the opening. Said out loud if it is near you; written
   down if it is not. */
function claimCell(cx, cy, power, why) {
  if (WORLD.homeCell(cx, cy)) return false;
  const was = WORLD.holderOf(cx, cy);
  if (was === power) return false;
  surv.claims.set(cx + "," + cy, power || "");
  WORLD.territoryChanged();
  livingTaken(cx, cy, power, was);
  const site = WORLD.regionSite(cx, cy);
  const f = power ? factionOf(power) : null, g = was ? factionOf(was) : null;
  const line = why ||
    (f && g ? f.short + " has taken ground from " + g.short
     : f ? f.short + " has moved into unheld sky"
     : g ? g.short + " has pulled out" : "");
  if (line) chatter(line + ".", f ? f.colour : NEBULA,
                    { x: site.x, y: site.y });
  return true;
}
function takeGround(x, y, power, name) {
  const site = WORLD.siteAt(x, y);
  const sp = WORLD.spaceOfCell(site.cx, site.cy);
  if (sp.kind !== "front" || sp.owner === power) return false;
  return claimCell(site.cx, site.cy, power,
                   factionOf(power).short + " holds " + (name || "the field") + " now");
}

function surveyWar(dt) {
  const war = surv.war;
  if (!war) return;
  war.clock += dt;
  if (war.clock < WAR_TICK) return;
  war.clock -= WAR_TICK;
  surveyWarTurn();
}

function surveyWarTurn(R) {
  R = R || Math.random;
  const war = surv.war, st = war.strength;
  const me = ships[0];
  const here = WORLD.siteAt(me ? me.x : 0, me ? me.y : 0);
  const sides = war.belligerents;

  // Wear and recovery. Fighting costs; not fighting mends.
  for (const k of Object.keys(st)) {
    if (sides.indexOf(k) >= 0) st[k] = Math.max(0.2, st[k] - 0.006);
    else st[k] = Math.min(1.3, st[k] + (st[k] < 1 ? 0.012 : 0.004));
  }

  // The ground.
  let moves = 0;
  for (let j = -WAR_REACH; j <= WAR_REACH && moves < 2; j++) {
    for (let i = -WAR_REACH; i <= WAR_REACH && moves < 2; i++) {
      const cx = here.cx + i, cy = here.cy + j;
      if (WORLD.homeCell(cx, cy)) continue;
      const sp = WORLD.spaceOfCell(cx, cy);
      if (sp.kind === "front" && sp.enemy) {
        const holder = sp.owner;
        const rival = holder ? sp.enemy : null;
        if (holder && rival) {
          /* Measured near a front over ninety minutes: an even war moves
             somewhere between twelve and seventeen cells, a two-to-one war
             fifty to sixty-five. Faster than that
             and a lopsided war swallowed a power in an evening. */
          const edge = Math.max(0.3, Math.min(2.5, st[rival] / st[holder]));
          if (R() < 0.0015 * edge * edge && claimCell(cx, cy, rival)) moves++;
        } else if (!holder) {
          // No-man's-land goes to whichever side is ahead, if either is.
          const a = sides[0], b = sides[1];
          if (a && b && Math.abs(st[a] - st[b]) > 0.1 && R() < 0.004) {
            if (claimCell(cx, cy, st[a] > st[b] ? a : b)) moves++;
          }
        }
      } else if (sp.kind === "frontier" || sp.kind === "lawless") {
        // Settled from next door, by whoever is next door and strongest.
        let best = null;
        for (let jj = -1; jj <= 1; jj++) for (let ii = -1; ii <= 1; ii++) {
          const o = WORLD.holderOf(cx + ii, cy + jj);
          if (o && (!best || st[o] > st[best])) best = o;
        }
        /* Slow. Measured over ninety minutes near a front, 0.0025 settled a
           hundred and fifty cells — the frontier was gone in an evening. */
        const rate = sp.kind === "frontier" ? 0.0003 : 0.00015;
        if (best && R() < rate * st[best] && claimCell(cx, cy, best)) moves++;
      }
    }
  }

  // War and peace.
  if (sides.length === 2) {
    const [a, b] = sides;
    if (st[a] < 0.55 && st[b] < 0.55) {
      chatter(factionOf(a).name + " and " + factionOf(b).name +
              " have stopped fighting \u2014 neither has the ships left to " +
              "keep it up.", "#a08cff", false);
      war.pairs = {};
      war.belligerents = [];
      war.calm = 0;
      // Written down with the reason, and said. See the living world.
      livingPeace(a, b, "worn down");
    }
  } else {
    war.calm += WAR_TICK;
    const ready = POWERS_BY_STRENGTH().filter(k => st[k] >= 1.1);
    if (war.calm >= WAR_PEACE_MIN && ready.length) {
      const a = ready[0];
      const b = neighbourOf(a, here) ||
                FACTIONS.map(f => f.key).find(k => k !== a);
      war.pairs = { [a]: b, [b]: a };
      war.belligerents = [a, b];
      war.calm = 0;
      livingWar(a, b, "recovered");
    }
  }
  WORLD.territoryChanged();
  return moves;
}
const POWERS_BY_STRENGTH = () =>
  FACTIONS.map(f => f.key).sort((x, y) => surv.war.strength[y] - surv.war.strength[x]);
// The power `a` shares the most border with, around you.
function neighbourOf(a, here) {
  const touch = {};
  for (let j = -WAR_REACH; j <= WAR_REACH; j++) {
    for (let i = -WAR_REACH; i <= WAR_REACH; i++) {
      if (WORLD.holderOf(here.cx + i, here.cy + j) !== a) continue;
      for (let jj = -2; jj <= 2; jj++) for (let ii = -2; ii <= 2; ii++) {
        const o = WORLD.holderOf(here.cx + i + ii, here.cy + j + jj);
        if (o && o !== a) touch[o] = (touch[o] || 0) + 1;
      }
    }
  }
  const best = Object.keys(touch).sort((x, y) => touch[y] - touch[x])[0];
  return best || null;
}

function surveyBattles(dt) {
  if (!surv.battles) return;
  const me = ships[0];

  /* The clock runs on every battle you have found, loaded or not — so the one
     two sectors behind you is ending while you are somewhere else. */
  let ended = null;
  for (const id of Object.keys(surv.battleAge)) {
    if (surv.battleAge[id] <= 0) continue;
    surv.battleAge[id] -= dt;
    if (surv.battleAge[id] <= 0) {
      surv.battleAge[id] = 0;
      ended = ended || [];
      ended.push(id);
    }
  }

  for (const b of surv.battles) {
    if (b.over) continue;
    const near = dist2(me.x, me.y, b.x, b.y);

    /* Finding one. Close enough to see what is going on, and it is announced
       as somebody else's business, because it is. */
    if (!b.seen && near < (SURVEY_SIGHT * 1.5 + b.r) ** 2) {
      b.seen = true;
      surv.battleAge[b.id] = b.life;
      const a = factionOf(b.sides[0]), c = factionOf(b.sides[1]);
      chatter(b.big
                ? a.short + " and " + c.short + " have put fleets in the same " +
                  "piece of sky \u2014 " + b.fleet + " hulls a side"
                : a.short + " and " + c.short + " are at it out here \u2014 " +
                  warScale().name.toLowerCase(),
              "#ff8f77", b);
      noteKnown("battle", b.x, b.y, b.name);
      saveSurveyBook();
    }

    /* And ending. Either the clock ran out, or one side is simply gone —
       both are the fight being over, and both leave the same field of wrecks. */
    const left = surv.traffic.filter(t => t.battle === b.id);
    const alive = [0, 1].map(i =>
      left.filter(t => t.faction === b.sides[i]).length);
    const done = (ended && ended.indexOf(b.id) >= 0) ||
                 (b.seen && (!alive[0] || !alive[1]));
    if (!done) continue;
    endBattle(b, left);
  }
}

/* Over. The ships that are left break off and are gone; what they were
   fighting over is a field of hulks and, sometimes, a name. */
function endBattle(b, left) {
  /* Who won, if anybody can tell: the side with ships still in the sky when
     it stopped. A fight that ended off your screen has nobody loaded to count
     and so has no winner — it moves no border, because nobody saw it do so. */
  const alive = b.sides.map(side => (left || []).filter(t => t.faction === side).length);
  const winner = alive[0] > alive[1] ? b.sides[0] : alive[1] > alive[0] ? b.sides[1] : null;
  if (winner) {
    const loser = b.sides[0] === winner ? b.sides[1] : b.sides[0];
    weaken(loser, 0.05);
    weaken(winner, -0.03);
    takeGround(b.x, b.y, winner, b.name);
  }
  livingBattle(b, winner);
  b.over = true;
  surv.battleAge[b.id] = 0;
  for (let i = surv.traffic.length - 1; i >= 0; i--) {
    if (surv.traffic[i].battle === b.id) surv.traffic.splice(i, 1);
  }
  for (const w of battleWrecks(b)) {
    if (surv.stripped.has(w.id)) continue;
    surv.hulks.push(w);
  }
  /* Not every fight is remembered. The ones that are get a name, and the name
     goes on the chart — which makes a sector you have flown for an hour read
     as somewhere things have happened rather than somewhere things are. */
  // Whatever the chart said was a fight is not a fight any more.
  surv.known.delete(knownId("battle", b.x, b.y));
  if (b.memorial) {
    surv.memorials.add(b.id);
    noteKnown("memorial", b.x, b.y, b.name);
    chatter(b.name + " \u2014 it is over", "#a08cff", b);
  } else {
    chatter("The shooting has stopped out there.", NEBULA, b);
  }
  saveSurveyBook();
}

function surveyHeat(dt) {
  const me = ships[0];
  if (!surv || surv.death) return;
  if (!surv.rep) surv.rep = {};
  for (const f of FACTIONS) {
    const v = repOf(f.key);
    if (!v) continue;
    const step = Math.min(Math.abs(v), REP.COOL * dt);
    surv.rep[f.key] = v > 0 ? v - step : v + step;
  }

  // Whoever hates you most is who sends people.
  let worst = null;
  for (const f of FACTIONS) {
    if (repOf(f.key) <= REP.HUNTED &&
        (!worst || repOf(f.key) < repOf(worst))) worst = f.key;
  }
  if (!worst || !me.alive) return;

  /* And where you are decides how fast they come. A power hunts you hardest
     in its own space, less hard where it is only one flag among many, and
     barely at all in the Deep Void or in the space of the power it is at war
     with — getting out of somebody's territory is a way to breathe. */
  const sky = spaceAt(me.x, me.y);
  const reachOf = sky.owner === worst ? 1
                : sky.kind === "void" ? 0.2
                : sky.owner && atWar(worst, sky.owner) ? 0.3
                : sky.kind === "front" && (sky.enemy === worst) ? 0.8
                : 0.55;
  surv.huntCool -= dt * reachOf;
  if (surv.huntCool > 0) return;
  const over = (-repOf(worst) - 150) / (REP.MAX - 150);
  surv.huntCool = 26 - over * 14;
  if (surv.traffic.filter(t => t.role === "hunter").length >= 3) return;

  /* Spawned rather than generated: a chunk is a pure function of its
     coordinates and has no business knowing whose freighters you have shot. */
  // Somewhere it could actually have flown in from. See `inBuilt`.
  let a2 = Math.random() * Math.PI * 2, d = 2600 + Math.random() * 1400;
  for (let t = 0; t < 8; t++) {
    if (!inBuilt(me.x + Math.cos(a2) * d, me.y + Math.sin(a2) * d, 260)) break;
    a2 = Math.random() * Math.PI * 2;
    d = 2600 + Math.random() * 1400;
  }
  const hulls = TRAFFIC_HULLS.hunter;
  const hull = hulls[Math.min(hulls.length - 1,
                              Math.floor(over * hulls.length + Math.random()))];
  const hp = shipSpec(hull).hull + Math.round(over * 6);
  surv.traffic.push({
    id: null, kind: "hunter", role: "hunter", faction: worst, hull,
    x: me.x + Math.cos(a2) * d, y: me.y + Math.sin(a2) * d, a: a2 + Math.PI,
    from: { x: me.x, y: me.y }, to: { x: me.x, y: me.y }, leg: 1,
    speed: MAX_SPEED * shipSpec(hull).speed * (0.72 + over * 0.12), hp, maxHp: hp,
    cargo: [], cool: 1.4, doom: 0, guards: 0, space: 0, trades: false,
    phase: Math.random() * 6.28, angry: true
  });
  chatter(factionOf(worst).short + " sent somebody.", "#ff8f77");
}

/* What one is carrying, and therefore what robbing it pays. A hauler carries
   what a hauler carries — bulk, mostly cheap — so piracy is a living rather
   than a fortune, and shooting the thing that makes the sector feel inhabited
   is a decision with a price rather than a free lunch. */
function trafficCargo(kind, deep, R) {
  const n = kind === "patrol" || kind === "escort" ? 4
          : kind === "trader" ? Math.round(16 + R() * 26 + deep * 18)
          : Math.round(10 + R() * 22 + deep * 14);
  const out = [];
  for (let i = 0; i < n; i++) {
    const roll = R();
    out.push(roll < 0.42 ? "ice" : roll < 0.82 ? "iron"
           : roll < 0.96 ? "alloy" : "iridium");
  }
  return out;
}

/* Rolled per chunk like everything else, and — like a cache's guards — carried
   across a re-stream rather than rebuilt, because these move and a freighter
   that snapped back to its start line every few seconds would be worse than no
   freighter at all. */
function buildTraffic(cx, cy, R, rnd, deep, out, space) {
  const ox = cx * CHUNK, oy = cy * CHUNK;
  space = space || spaceAt(ox + CHUNK / 2, oy + CHUNK / 2);
  /* How busy this piece of sky is. The Works is thick with traffic; the Empty
     has essentially none, which is most of what makes it feel wrong.

     And **home is quiet**. The falloff is `(1 - deep)²`, which is near its
     maximum at the origin — so the busiest place in the sector was the two
     chunks around the one station you cannot avoid, which is both the wrong
     feeling and the wrong first impression. A handful of chunks around the
     start get a quarter of the usual chance: somebody docking and leaving every
     so often, rather than a rush hour you spawn into. */
  const busy = abund("traffic", ox + CHUNK / 2, oy + CHUNK / 2);
  if (!busy) return;                // nobody flies through an empty region
  /* ── home is quiet, and quiet means quiet ──────────────────────────────
     A quarter of the usual chance over a five-by-five block still left two or
     three ships permanently within sight of the one station you cannot avoid.
     Ric: "there should only ever be like 1 or 0 at the station. very unlikely
     but possible 2."

     A smooth bowl rather than a box, out to four chunks — about ten thousand
     units — so there is no line you cross where the lanes switch on, and the
     floor at the origin is a twentieth of the open rate. Over the whole bowl
     that comes to well under one ship at a time, which is the "0 or 1, very
     unlikely 2" he asked for, and it leaves the sector's density untouched
     everywhere else. */
  const fromHome = Math.hypot(cx, cy) / 4;
  /* The floor is a trickle rather than nothing. At a twentieth the origin came
     out genuinely dead across a whole sector's worth of seeds, and "quiet" was
     not the ask — "maybe 1 every 10 min ish" was. An eighth leaves somebody
     docking and leaving now and then, which is the thing that makes the home
     station read as a place people use rather than a place people left. */
  const calm = Math.min(1, 0.125 + 0.875 * Math.min(1, fromHome) ** 2);
  /* How many is the owner's business now, not the distance's: `busy` already
     carries it (see `abund`), so a power's own space is busy, the frontier is
     thin and the Deep Void has almost nobody in it wherever it is. */
  /* Lower than a lone ship needs, because most rolls now put up a group — a
     convoy, a patrol wing, a pack — and the sky should not fill up with them. */
  if (R() > 0.14 * busy * calm) return;

  /* Whose, and what sort. Pirates thicken with distance — the lanes are kept
     near home and nobody is keeping anything out in the deep — and the two
     powers actually fighting put more hulls in the sky than the one watching. */
  const roll = R();
  /* How hot the war is decides how much of what you meet is fighting it: a
     border skirmish leaves the lanes mostly to the haulers, and a total war
     means the next four ships you pass are all somebody's navy. */
  const heat = warScale().heat;
  let faction, role;
  /* A tenth fewer than there were. The deep was better than a third pirates
     and it made every other role scenery between fights — and a raider is
     only frightening while it is not the thing you expect. */
  /* And a raider near home is almost unheard of. Ric: "there shouldnt really
     ever be raiders" in the home band. The lanes here are watched; the whole
     point of the danger curve is that it is something you fly *out* into, and
     meeting a pirate on your first flight teaches the opposite. The same
     `calm` bowl scales it, so it is rare rather than impossible — a raider
     that has slipped in is a story, and one you meet every trip is a tax. */
  /* And whose. Pirates are the owner's failure: rare where a power holds the
     sky, common where nobody can. Flags come from who holds it — a power's
     own space is mostly its own ships, a front is the two sides of the war,
     and the frontier and lawless space are independents and whoever passes. */
  /* Pirates live where nobody can reach them. Inside a power's territory only
     its outer cells see any, and its heartland none at all; a pirate three
     systems deep into Cordon space is a pirate that has already been caught. */
  const inner = space.inner || 0;
  /* Unless the owner has licensed them (living.js, §6): letters of marque
     make raiders three times as common in that power's sky, and its
     heartland is no longer clean — that is what the law costs the pilot. */
  const marque = space.kind === "territory" && space.owner && livingLaw(space.owner, "privateers");
  const pirateShare = space.kind === "territory"
    ? (inner <= 1 ? 0.06 : inner === 2 ? 0.01 : 0) * (marque ? 3 : 1) + (marque && inner >= 3 ? 0.01 : 0)
    : space.pirates;
  /* ── and the tutorial is not where you learn about raiders ──────────────
     Ric: "you shouldnt be running into too many pirates in the opening part
     getting the jump drive parts."

     The `calm` bowl above stops four chunks out — 10,400 units — and it was
     written for the front door, which is what it is still for. But the
     manifest runs from the drive spar at 7,000 to the beacon at 52,000, so
     every part after the first is fetched well outside the bowl at the
     sector's open rate. The quiet ends one part into the only thread that
     tells you where to go.

     So while the manifest is unfinished there is a second, much wider bowl
     over the whole of it: a third of the usual raiders at the middle of it,
     easing back to the full rate at its edge. It is a *share*, not a cap —
     lawless space is still the worst sky in the opening and the Deep Void is
     still emptier than either — so the shape of the danger curve survives;
     it is only shallower while you are being taught.

     Finish the manifest and this is gone: the sector becomes exactly as
     dangerous as it always was, in the same flight, which is the moment the
     tutorial stops holding the handlebars. */
  const OPENING_REACH = 52000;   // the beacon, the furthest thing it asks for
  const OPENING_FADE  = 26000;   // and half as far again to become itself
  let opening = 1;
  if (surv && surv.built && surv.built.size < BUILD.length) {
    const d = Math.hypot(cx, cy) * CHUNK;
    const past = Math.max(0, d - OPENING_REACH) / OPENING_FADE;
    opening = 0.34 + 0.66 * Math.min(1, past) ** 2;
  }
  if (roll < pirateShare * calm * opening) {
    faction = "pirate"; role = "pirate";
  } else {
    /* A freehold's ships fly in its own sky (it is `space.owner` there), not
       as passers-by two hundred thousand units away. */
    const powers = FACTIONS.filter(f => !f.cause).map(f => f.key);
    const w = { belligerents: warSides() };
    const pick = R();
    const free = (space.kind === "territory" ? 0.18 :
                  space.kind === "front" ? 0.08 : 0.42) / heat;
    if (pick < free) faction = "free";
    else if (space.kind === "front") {
      const sides = space.owner ? [space.owner, space.enemy]
                  : (w.belligerents.length ? w.belligerents : powers);
      faction = sides[R() < 0.5 ? 0 : 1] || powers[0];
    } else if (space.owner && (pick < free + 0.62 || inner >= 2)) {
      /* Deep in a power's space it is that power's ships and the independents,
         and nobody else's. Other flags pass through only near the border. */
      faction = space.owner;
    } else {
      /* Anybody passing through — except the owner's enemies. A power at war
         does not let the other side's haulers wander about inside its own
         space; they meet at the front. Drawn from the same single roll either
         way, so the stream of rolls behind it is unchanged. */
      const foes = space.owner ? [warPairs()[space.owner]] : [];
      const ok = powers.filter(k => foes.indexOf(k) < 0);
      faction = ok[Math.floor(R() * ok.length)] || powers[0];
    }

    /* A hotter war tilts the roll toward the armed roles. It used to divide the
       roll by the heat, which in a border skirmish (heat 0.45) pushed more
       than half of every power's ships past 0.95 — into distress calls. A
       power curve bends the same way and stays inside 0–1: a skirmish is
       about one distress call in nine, a total war one in thirty. */
    const r2 = Math.pow(R(), Math.min(1.7, heat));
    if (faction === "free") {
      // The independents are the ones with time to pick over a wreck.
      role = r2 < 0.42 ? "trader" : r2 < 0.72 ? "freight" : "scavenger";
    }
    else if (r2 < 0.3) role = "patrol";
    else if (r2 < 0.46) role = "escort";
    else if (r2 < 0.68) role = "trader";
    else if (r2 < 0.88) role = "freight";
    else if (r2 < 0.95) role = "scavenger";
    else role = "distress";
  }
  const x = ox + rnd(300, CHUNK - 300), y = oy + rnd(300, CHUNK - 300);

  /* A route rather than a destination: a hauler runs a line and turns round at
     the ends, which is what makes meeting one twice feel like the same ship
     going about its day rather than a spawn. */
  const a = R() * Math.PI * 2;
  const len = ROLES[role].armed ? rnd(900, 2600) : rnd(4000, 14000);
  const to = { x: x + Math.cos(a) * len, y: y + Math.sin(a) * len };

  const make = (role, x, y, to) => {
  const kind = role;
  const spec = ROLES[role];
  const hulls = TRAFFIC_HULLS[role];
  const hull = hulls[Math.floor(R() * hulls.length)];
  const hs = shipSpec(hull);
  return {
    kind, role, faction, hull, x, y, a,
    from: { x, y }, to, leg: 1,
    /* **The hull's own speed**, not a number rolled from its job. A Needle in a
       pirate's hands was doing 120–190 and a Needle in yours does 360 × 1.44; an
       Granary hauling freight was doing 70–130 and in yours does 360 × 0.68. The
       roster meant one thing when you bought a hull and something else entirely
       when you met one, and "can I outrun that" had no answer you could work out
       from the thing you were looking at.

       A hull is a hull now. The multiplier is the one the shipyard advertises,
       against the same top speed your own engine is measured by, with a little
       either way for the pilot — traffic cruises rather than running flat out,
       which is what leaves you the option of catching one. */
    speed: MAX_SPEED * hs.speed * rnd(0.62, 0.78),
    hp: hs.hull, maxHp: hs.hull,
    cargo: trafficCargo(role, deep, R),
    cool: rnd(0.3, 1.4),
    /* How much room it wants, rolled per ship inside its role's range — so two
       escorts of the same flag are not the same to fly past: one may not mind
       you at all and the next will tell you to keep your distance. */
    space: spec.space ? Math.round(spec.space * (0.5 + R())) : 0,
    trades: spec.trades,
    // A distress call has a clock on it. Long enough to be worth turning
    // around for, short enough that turning around has to be a decision.
    doom: role === "distress" ? rnd(38, 62) : 0,
    /* What it has in reserve, in seconds of trouble. Unarmed ships only: a
       patrol is not going to drift into your path out of thirst, and the ships
       this is about are the haulers. Rolled per ship, so two freighters in the
       same lane are not equally close to the edge. */
    tank: spec.armed || role === "distress" ? null : rnd(50, 130),
    guards: role === "distress" ? 1 + Math.floor(R() * 2) : 0,
    phase: R() * Math.PI * 2
  };
  };

  const lead = make(role, x, y, to);
  out.traffic.push(lead);
  const leadIdx = out.traffic.length - 1;

  /* ── company ────────────────────────────────────────────────────────────
     Almost nothing out here flies alone. Haulers run in convoys with escorts
     off their shoulders, patrols fly as a wing, pirates hunt in packs — and
     the independents are the ones you meet on their own. A follower walks the
     leader's route, holds a slot off its quarter (see `formationFor`), and
     the whole group cruises at the pace of its slowest hull. */
  const plan = groupPlan(role, faction, space, R);
  const group = [lead];
  plan.forEach((r2, gi) => {
    const slot = GROUP_SLOTS[gi % GROUP_SLOTS.length];
    const c = Math.cos(a), s2 = Math.sin(a);
    const px = x - c * slot.back - s2 * slot.side;
    const py = y - s2 * slot.back + c * slot.side;
    const f = make(r2, px, py, { x: to.x + (px - x), y: to.y + (py - y) });
    f.leadIdx = leadIdx;
    f.slot = slot;
    out.traffic.push(f);
    group.push(f);
  });
  if (group.length > 1) {
    const pace = Math.min(...group.map(g => g.speed));
    for (const g of group) g.speed = pace;
    lead.groupSize = group.length;
  }
}

/* Where a follower sits relative to its leader: behind by `back`, off to one
   side by `side`. Alternating sides, stepping back, so a convoy of four reads
   as a column and a wing of three as a vee. */
const GROUP_SLOTS = [
  { back: 320, side: -240 }, { back: 320, side: 240 },
  { back: 640, side: 0 },    { back: 900, side: -300 }, { back: 900, side: 300 }
];

/* Who flies with this one. Rolled from the chunk's own stream, so the same
   chunk always makes the same group. */
function groupPlan(role, faction, space, R) {
  const k = space.kind;
  const out = [];
  if (faction === "pirate") {
    const pack = k === "lawless" || k === "void" ? 0.6 : 0.3;
    if (R() < pack) {
      out.push("pirate");
      if (R() < 0.35) out.push("pirate");
    }
    return out;
  }
  if (faction === "free") {
    // Independents mostly travel alone. Now and then two haulers together.
    if ((role === "trader" || role === "freight") && R() < 0.2) out.push(role);
    return out;
  }
  if (role === "trader" || role === "freight") {
    const convoy = k === "territory" ? 0.55 : k === "lawless" ? 0.5
                 : k === "front" ? 0.35 : 0.4;
    if (R() < convoy) {
      if (R() < 0.4) out.push(role);
      out.push("escort");
      // The worse the sky, the more guns come along.
      if (R() < (k === "lawless" || k === "front" ? 0.65 : 0.3)) out.push("escort");
    }
    return out;
  }
  if (role === "patrol") {
    if (R() < (k === "territory" || k === "front" ? 0.65 : 0.35)) {
      out.push("patrol");
      if (R() < 0.35) out.push("patrol");
    }
  }
  return out;
}

/* What one leaves behind, laid out from the battle's own seed so the field of
   wrecks is the same field every time you come back to it. */
function battleWrecks(b) {
  const R = seeded(b.seed >>> 0);
  // The bigger the fight, the more of it is still out there. Hulks are the
  // mode's own salvage, so an old battle is worth the trip even cold.
  const n = Math.max(2, Math.round(b.fleet * 1.1));
  const out = [];
  for (let j = 0; j < n; j++) {
    const a = R() * Math.PI * 2, d = R() * b.r;
    out.push({ id: b.id + "w" + j,
               x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d,
               a: R() * Math.PI * 2, spin: (R() - 0.5) * 0.05,
               size: 1 + R() * 1.2, battle: true });
  }
  return out;
}

/* ── a battle, in progress ────────────────────────────────────────────────
   Two powers at war do not only pass each other in the lanes; somewhere out
   there they are having it out properly, and you can fly into the middle of
   it. What is rolled here is only the shape of the fight — where, who, how
   many, and how long it lasts. Whether it is still going when you get there
   is a live question, and `surv.battleAge` is the only part of it that is not
   a pure function of the seed.

   A battle you have never seen is always still going: it has been fought for
   as long as you have not been looking, and finding one is the point. What
   you cannot do is leave one and come back to find it exactly as you left it. */
// The same syllables the worlds are named from, so a battle is named after
// somewhere rather than after nothing.
function battlePlace(R) {
  let n = SYL_HEAD[Math.floor(R() * SYL_HEAD.length)];
  if (R() < 0.4) n += SYL_HEAD[Math.floor(R() * SYL_HEAD.length)];
  n += SYL_TAIL[Math.floor(R() * SYL_TAIL.length)];
  return n.toUpperCase();
}

/* ── a ship with a name ───────────────────────────────────────────────────
   Almost nothing out here is named, on purpose: a sector where every freighter
   introduces itself is a sector of characters rather than a place. A name is
   what a ship earns by being *part of something* — you pulled it out of
   trouble, or it got away from you — and it is the whole mechanism of 6.5. If
   you can say which ship it was, it happened; if you cannot, it was weather.

   Two registers, because the two kinds of memory should not sound alike. A
   hauler you saved gets a hull name, the way a working ship would have one.
   A pirate that got away gets a handle. */
const SHIP_WORDS = ["STAR", "LANTERN", "PROMISE", "PATIENCE", "LONG WAY",
                    "GOOD RETURN", "OWL", "SPARROW", "KETTLE", "CANDLE",
                    "MERCY", "SECOND WIND", "WHISTLE", "FAIR TRADE"];
const PIRATE_WORDS = ["THE JACKAL", "SPLIT LIP", "KNIFE", "GRIN", "ASHES",
                      "NINE FINGERS", "THE CROW", "RUST", "HALF MOON",
                      "TALLOW", "BAD PENNY", "THE WIDOW"];
/* ── what a scan calls a ship ─────────────────────────────────────────────
   A registry mark, not a name: what kind of ship it is, a number, and whose
   flag it flies — "CARGO SHIP-114 (CORDON)". Every return used to say
   TRAFFIC, so a scan of a busy lane came back as the same word six times and
   told you nothing about any of them.

   The number is **hashed off the ship**, not rolled. A callsign that changed
   every time you scanned would be worse than no callsign: the whole use of
   one is that the freighter you passed an hour ago is the freighter you are
   looking at now. Ships born in a chunk carry an id; the ones spawned at you
   do not, so those fall back to where they came into the world, which is
   just as stable and just as much theirs. */
const CALLSIGNS = {
  freight:  "CARGO SHIP", trader: "TRADER",  scavenger: "SCAVENGER",
  escort:   "ESCORT",     patrol: "PATROL",  pirate:    "RAIDER",
  distress: "DISTRESS",   hunter: "HUNTER"
};
function callsignOf(t) {
  if (t.callsign) return t.callsign;
  const word = CALLSIGNS[t.role || t.kind] || "SHIP";
  let seed = t.id
    ? [...String(t.id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
    : hash2(Math.round(t.from ? t.from.x : t.x), Math.round(t.from ? t.from.y : t.y));
  /* Mixed, or the numbers come out in a row. Three ships born in one chunk
     have ids differing by one character, and a plain rolling hash turns that
     into 149, 150, 151 — which reads as a fleet list somebody typed rather
     than as registries from all over the sector. */
  seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) >>> 0;
  seed = Math.imul(seed ^ (seed >>> 12), 0x297a2d39) >>> 0;
  /* `>>> 0` on the way out. The XOR above is a *signed* operation, so the
     last step could hand back a negative — and `-1046 % 900` is negative
     too, which came out as "CARGO SHIP--146". */
  seed = (seed ^ (seed >>> 15)) >>> 0;
  t.callsign = word + "-" + (seed % 900 + 100) +
               " (" + factionOf(t.faction).short + ")";
  return t.callsign;
}

function shipName(pirate) {
  const R = Math.random;
  if (pirate) {
    const w = PIRATE_WORDS[Math.floor(R() * PIRATE_WORDS.length)];
    return R() < 0.4 ? w : w + " OF " + place().toUpperCase();
  }
  const w = SHIP_WORDS[Math.floor(R() * SHIP_WORDS.length)];
  return (R() < 0.45 ? "THE " : place().toUpperCase() + " ") + w;
}
// A word that sounds like it came off this sector's own gazetteer.
function place() {
  const R = Math.random;
  let n = SYL_HEAD[Math.floor(R() * SYL_HEAD.length)];
  n += SYL_TAIL[Math.floor(R() * SYL_TAIL.length)];
  return n;
}

const BATTLE_NAMES = [
  "THE STAND AT", "THE LOSS AT", "THE ACTION AT", "THE BREAK AT",
  "THE HOLDING AT", "THE ROUT AT", "THE LAST HOUR AT"
];

function buildBattle(cx, cy, R, rnd, deep, out, space) {
  // No war, no battles: a ceasefire is a sky with nobody shooting in it.
  const w = { belligerents: warSides() };
  if (w.belligerents.length < 2) return;
  space = space || spaceAt(cx * CHUNK + CHUNK / 2, cy * CHUNK + CHUNK / 2);
  const sc = warScale();
  /* Battles thicken away from home — the powers keep the near lanes open
     because they both need them — and with how big the war is. */
  /* Rare. A battle you meet every few minutes is weather; one you come across
     twice in an evening is a thing that happened. This was one chunk in eighty
     near home and one in twenty in the deep, which at a chunk every few seconds
     of flying is *constant* — the sky was never quiet. A quarter of that. */
  /* And where. The war is fought on the front; a battle anywhere else is a
     raid that got further than it should have. */
  if (R() > 0.0045 * space.battles * sc.heat) return;

  const p = { x: cx * CHUNK + rnd(900, CHUNK - 900),
              y: cy * CHUNK + rnd(900, CHUNK - 900) };

  /* Most fights are a handful of hulls trading shots over a line — and they
     should be, because that is what a war looks like most of the time and it
     is what makes the rare thing rare.

     The rare thing is a **fleet action**: twenty-five or more a side, two lines
     of ships a mile long, and enough wreckage afterwards to be a landmark. It
     has to stay uncommon or it stops being an event; one in fifteen or so near
     home, better odds in the deep and in a bigger war, which is also where the
     powers would actually commit a fleet. */
  const big = R() < (space.kind === "front" ? 0.07 : 0.035) * sc.heat;
  const fleet = big ? Math.round(25 + R() * 14)
                    : Math.max(2, Math.round(sc.fleet * (0.6 + R() * 0.9)));
  out.battles.push({
    x: p.x, y: p.y,
    big,
    // Room for both lines to be lines. A fleet action is 5,000 units across,
    // which is most of a chunk and reads as a front rather than a brawl.
    r: 700 + fleet * 130,
    sides: R() < 0.5 ? w.belligerents.slice() : w.belligerents.slice().reverse(),
    fleet,
    // Long enough to be a place you can go and watch, short enough that
    // coming back later is a different sector.
    life: rnd(150, 240) + fleet * 26,
    /* Not every fight is remembered. The ones that are get a name and a stone,
       and the name is the only thing in this mode that is about something
       that happened rather than something that is there. */
    /* Not every fight is remembered — but a fleet action is. Twenty-five hulls
       a side is the sort of thing a sector names afterwards, and the stone is
       how you find out it happened at all if you arrived late. */
    memorial: R() < (big ? 0.85 : 0.34),
    name: BATTLE_NAMES[Math.floor(R() * BATTLE_NAMES.length)] + " " +
          battlePlace(R),
    hull: [TRAFFIC_HULLS.patrol[Math.floor(R() * TRAFFIC_HULLS.patrol.length)],
           TRAFFIC_HULLS.escort[Math.floor(R() * TRAFFIC_HULLS.escort.length)]],
    seed: Math.floor(R() * 1e9)
  });
}

/* ── the hangar ───────────────────────────────────────────────────────────
   Ships are bought at a station, which is where a shipyard would be, and the
   one you are flying is swapped rather than sold: you keep everything you have
   bought, so trying a hauler for an afternoon and going back to a fighter costs
   nothing but the walk. The alternative — selling the old hull to pay for the
   new one — would make every experiment a commitment, and the whole point of
   twenty-five of them is that you find out which one you like. */
/* Your home station, and only there. A hangar at every station would make the
   twenty-five hulls a menu you flick through whenever the mood takes you;
   keeping them in one place means the ship you left home in is the ship you
   are stuck with out there, which is most of what makes choosing one a
   decision rather than a preference. */
const atHomeStation = () =>
  LEV_ONLY || !!(surv && surv.docked && surv.docked.home);
/* And whether the berth in it is running. Being home is a place; the hangar
   is one of the station's six rooms and the jump coil is what lights it —
   the clamps that hold a second hull are a coil. Until then you are standing
   in your own station looking at a dark berth, which is the point. */
const hangarOpen = () => atHomeStation() && (LEV_ONLY || stationHas("hangar"));

function buyShip(key) {
  if (!surv || !hangarOpen()) { gameSound("hit"); return false; }
  const sh = SHIPS.find(x => x.key === key);
  if (!sh) return false;
  if (!surv.owned.has(key)) {
    if (surv.cash < sh.cost) { gameSound("hit"); return false; }
    surv.cash -= sh.cost;
    surv.owned.add(key);
    chatter(sh.name + " bought \u2014 " + money(sh.cost), CASH);
  }
  return flyShip(key);
}

function flyShip(key) {
  if (!surv || !surv.owned.has(key) || !hangarOpen()) {
    gameSound("hit"); return false;
  }
  const was = surv.ship;
  surv.ship = key;
  const me = ships[0];
  applyRefit(me);
  /* A swap is a full hull. You are standing in a shipyard and the ship is new
     to you; handing it over pre-damaged would be a rule nobody could guess. */
  me.hull = me.maxHull;
  me.invuln = Math.max(me.invuln, 1.5);
  /* The hold does not come with you if the new one is smaller. What will not
     fit is left on the dock, which is the cost of downsizing.

     Materials first, and they are simply gone — that was always the rule and
     it is the cheap half of a hold. Parts are the other half now that they
     have a weight, and a part is never destroyed in this mode: what will not
     fit is set down beside the yard, on the chart, by name, for you to come
     back out and collect. It is a hundred units away, which is the right size
     of inconvenience for a decision you made on purpose. */
  const cap = holdCap();
  let over = holdUsed() - cap;
  for (const m of MATERIALS) {
    if (over <= 0) break;
    const take = Math.min(over, surv.hold[m.key] || 0);
    surv.hold[m.key] -= take;
    over -= take;
  }
  if (over > 0) {
    const left = [];
    for (const k of Object.keys(surv.store)) {
      for (let n = storeCount(k); n > 0 && over > 0; n--) {
        storeAdd(k, -1);
        over -= partWeight(k);
        left.push(k);
      }
      if (over <= 0) break;
    }
    left.forEach((k, i) => {
      const spec = moduleSpec(k);
      const a = (i / left.length) * Math.PI * 2;
      const spot = safeDrop(me.x + Math.cos(a) * (160 + 70 * i),
                            me.y + Math.sin(a) * (160 + 70 * i));
      surv.dropped.push({ key: k, name: spec.name, x: spot.x, y: spot.y,
                          mod: true, id: dropId() });
      noteKnown("part", spot.x, spot.y, spec.name);
    });
    if (left.length) {
      chatter(left.length === 1
        ? moduleSpec(left[0]).name + " would not fit the new hold \u2014 it is " +
          "on the dock outside."
        : left.length + " parts would not fit the new hold. They are on the " +
          "dock outside.", "#ff8f77");
    }
  }
  // And neither does the pantry. A smaller hull has a smaller one, and what
  // will not fit in it is left on the dock with the cargo.
  surv.food = Math.min(surv.food, foodCap());
  // The camera is set at startup and by the Settings control, and a swap is
  // the third thing that changes it — without this you walked out of the
  // hangar in a Cathedral still looking through a Skiff's window.
  if (mode && mode.survey) cam.scale = surveyZoom * shipZoomFactor();
  if (was !== key) {
    gameSound("win");
    chatter("Flying the " + shipSpec(key).name + ".", CASH);
  }
  saveSurveyBook();
  return true;
}

/* Bought at the station rather than fetched, and only once the station is
   whole — the place has to have finished being put back together before it
   can start something else, and the six deliveries are what teach you the
   station is worth going back to. */
function buildLightDrive() {
  if (!surv || surv.hasLight) return false;
  if (!stationWhole()) { gameSound("hit"); return false; }
  if (surv.cash < LIGHT_DRIVE.cost) { gameSound("hit"); return false; }
  surv.cash -= LIGHT_DRIVE.cost;
  surv.hasLight = true;
  gameSound("win");
  chatter("Light drive fitted. Point it somewhere and hold on.", ICE_C);
  saveSurveyBook();
  return true;
}
