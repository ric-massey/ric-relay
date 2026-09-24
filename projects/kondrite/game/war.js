"use strict";

/* KONDRITE — THE WAR MOVES
   ─────────────────────────────────────────────────────────────────────────────
   Battles in progress, ships with names, what a scan calls a ship, the
   hangar, the manifest, the gazetteer, mapping the sky, the warning, the
   background and the tick.

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
    const powers = FACTIONS.map(f => f.key);
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

/* ── the nearest one left, not the next one on the list ───────────────────
   The manifest used to be walked in its own order: whatever came first in
   BUILD that you had not built or picked up. Two things were wrong with it.

   It made the arrow **jump**. Die carrying the fourth part and it leaves your
   hands — so the objective falls back to the first unbuilt entry, which is
   somewhere else entirely, and the arrow you were flying home on swings
   across the sky. That is the "arrow bugging out" this fixes.

   And the order was never worth having. The six clues do not build on each
   other and the sites are dealt round a circle, so "first in the list" is an
   arbitrary heading — while *nearest* is the answer to the only question the
   arrow is being asked. Order does not matter; distance does. */
/* ── where a manifest part actually is ────────────────────────────────────
   Not where it was *put*. A part you found and then died carrying is lying
   where you fell (see `surv.dropped`), which can be a very long way from the
   site that made it — and until this existed, both the chooser below and the
   arrow read `partSites` and sent you back to the wreck field you had
   already emptied. You had the thing in your hands; the only mark on the
   board still pointed at where it used to be.

   `mod` is what separates the two kinds in `dropped`: a spare you were
   carrying is a fitted part and has nothing to do with the manifest, so only
   an entry without it can stand in for one of these six. */
const partDropped = key =>
  (surv.dropped || []).find(d => d && !d.mod && d.key === key) || null;
const partWhere = b => {
  if (!b) return null;
  const fell = partDropped(b.key);
  if (fell) return { x: fell.x, y: fell.y, name: b.name, fell: true };
  if (b.inside === "leviathan") {
    const lev = surv.landmarks.find(l => l.key === "leviathan");
    return lev ? { x: lev.x, y: lev.y, name: "THE LEVIATHAN" } : null;
  }
  const site = surv.partSites.find(p => p.key === b.key);
  return site ? { x: site.x, y: site.y, name: site.name } : null;
};

const nextPart = () => {
  const left = BUILD.filter(b => !surv.built.has(b.key) &&
                                 !surv.carrying.has(b.key));
  if (!left.length) return null;
  const me = ships[0];
  if (!me || !surv.partSites.length) return left[0];
  let best = null, bd = Infinity;
  for (const b of left) {
    /* The plate has no site of its own — it is inside the Leviathan, which
       has one. A part whose place is not known yet simply does not compete,
       and the fallback below covers the case where none of them is.

       Measured from where the part *is*, so one you dropped on the far side
       of the sector stops reading as the nearest thing to go and get. */
    const at = partWhere(b);
    if (!at) continue;
    const d = dist2(at.x, at.y, me.x, me.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best || left[0];
};
/* Two questions that used to be one. **Whole** is every part in, which is
   what the almanac, the objective line and the second project ask about.
   **`stationHas`** is one room, which is what everything a player actually
   presses asks about — and they are different now that each part lights its
   own service. See SERVICES. */

/* The one line of text that answers "what am I doing". It changes three
   times: go and find this, bring it back, and it is finished. Anything more
   than that on screen while flying is a menu. */
/* Where the thing you are looking for is. Not shown as a position — the HUD
   only ever gets a bearing and a range out of this — but the mode needs to
   know the point to take a bearing to. */
/* Is the tractor MK1 still out there to be fetched? Owning one in any
   form — in the hold, bolted on, or already lifted off its site — ends it. */
function mk1Wanted() {
  const site = surv && surv.mk1Site;
  if (!site) return false;
  if (surv.lifted.has(site.id || site.key)) return false;
  if (storeCount("tractormk1") > 0 || modFitted("tractormk1")) return false;
  return true;
}

/* ── what the arrow points at once the manifest is done ───────────────────
   The nearest landmark still missing from the book. The scan has always
   returned this bearing on demand — it is the line in the design that calls
   itself "the whole navigation system" — and after the gate it is the only
   thing left that can answer *where next*, so it stops being something you
   press a key for and becomes what the HUD says.

   Nearest rather than next along the ladder. The ladder is dealt per world
   and its rungs are spread around the compass, so "next" would regularly
   mean turning round and flying back past somewhere you had already been. */
function nextUnlogged() {
  const me = ships[0];
  if (!me || !surv || !surv.landmarks) return null;
  let best = null, bd = Infinity;
  for (const lm of surv.landmarks) {
    if (lm.found) continue;
    const d = dist2(lm.x, lm.y, me.x, me.y);
    if (d < bd) { bd = d; best = lm; }
  }
  return best;
}
/* A landmark's entry in the book, which is where its clue and its redaction
   both live. A `secret` entry keeps its redaction out here as well as in the
   almanac: the four that hide their name do it so that arriving is how you
   find out what they are, and a name on the edge of the screen would undo
   that from forty thousand units away. */
const lmEntry = lm => (lm && ALMANAC.find(e => e.key === lm.key)) || null;

function objectiveTarget() {
  /* The manifest is finished and the arrow used to go out with it, which is
     the right shape for "the tutorial is over" and the wrong one for the ten
     hours after: the mode's answer to *now what* was a sector with nothing
     marked in it. One thing stays on the board. */
  if (stationWhole()) {
    if (mk1Wanted()) {
      return { key: "tractormk1", name: surv.mk1Site.name,
               x: surv.mk1Site.x, y: surv.mk1Site.y };
    }
    /* And then the book, for as long as the book has holes in it. `vague`
       is what keeps the promise the scan makes: a bearing and a band, never
       a distance — a landmark's exact range is its position, and the one
       rule this mode's navigation has never broken is that nothing hands you
       a position. The manifest's arrow states units because a delivery is
       not a search. */
    const lm = nextUnlogged();
    if (!lm) return null;
    const e = lmEntry(lm);
    return { key: "landmark", vague: true,
             name: e && e.secret ? "SOMETHING UNLOGGED" : lm.name,
             x: lm.x, y: lm.y };
  }
  if (surv.carrying.size) {
    return { key: "home", name: "YOUR STATION",
             x: HOME_STATION.x, y: HOME_STATION.y };
  }
  const n = nextPart();
  if (!n) return null;
  /* `partWhere`, not `partSites`: if this is one you died carrying, the arrow
     goes to where it fell. The name goes with it — being sent to "a wreck
     field" you have already stripped is the same wrong answer said twice. */
  const at = partWhere(n);
  if (!at) return null;
  return { key: n.key, name: at.fell ? n.name : at.name,
           x: at.x, y: at.y, fell: !!at.fell };
}

const bearingTo = (me, t) =>
  Math.round(((Math.atan2(t.y - me.y, t.x - me.x) * 180) / Math.PI + 450) % 360);

function objective() {
  if (stationWhole()) {
    if (mk1Wanted()) {
      return { text: "FIND THE " + surv.mk1Site.name,
               sub: "half the reach of the mark two, and the last thing " +
                    "anybody is pointing you at",
               colour: NEBULA };
    }
    /* This line used to read "THE JUMP GATE IS OPEN — the sector is yours to
       wander", and it was the mode telling the player it was over. It is the
       one line that has answered *what am I doing* for the whole of the
       manifest, and at the exact moment the sector opens up it said nothing.
       People stopped playing here, and they were reading it correctly.

       So it keeps answering, out of the book, for the rest of the run. */
    const lm = nextUnlogged();
    if (lm) {
      const e = lmEntry(lm);
      return { text: e && e.secret ? "SOMETHING UNLOGGED" : lm.name,
               sub: e && !e.secret && e.note
                      ? e.note
                      : "nobody has written down what is out that way",
               colour: NEBULA };
    }
    /* Every landmark logged. Not every *entry* — most of the book is things
       you do rather than places you go — so it says which half is finished
       rather than claiming the whole thing is. */
    return { text: "EVERY LANDMARK LOGGED",
             sub: "what is left in the book is doing, not going",
             colour: CASH };
  }
  if (surv.carrying.size) {
    // Belt as well as braces: the store is filtered on the way in, and this
    // skips anything that still is not a part rather than reading a name off
    // undefined. A HUD line is not worth a crash.
    const names = [...surv.carrying]
      .map(k => partSpec(k)).filter(Boolean).map(b => b.name).join("  ·  ");
    if (names) {
      return { text: "CARRYING " + names, sub: "take it home to the station",
               colour: CASH };
    }
  }
  const n = nextPart();
  /* A part you found, carried and died with is not something to go and find
     again, and its clue is a description of a place you have already emptied.
     "Among the dead. Somewhere a lot of ships stopped at once." is a fine
     line to read once and a lie to read twice. */
  if (partDropped(n.key)) {
    return { text: "GO BACK FOR THE " + n.name,
             sub: "you were carrying it when you died — it is where you fell",
             colour: NEBULA };
  }
  return { text: "FIND THE " + n.name, sub: n.clue, colour: NEBULA };
}

/* The bearing and the range, worked out fresh every time the HUD asks. A
   range band rather than a number of units: "a long way out" is what you
   actually need to decide whether to go now, and an exact distance would make
   the clue redundant by turning the search into a countdown. */
/* The ladder itself, pulled out so the HUD line and the arrow on the ring
   cannot drift apart. They are the same fact said in two places, and two
   copies of a fact is how the arrows went wrong last time. */
const rangeBand = d =>
    d > 400000 ? "most of a sector away"
  : d > 40000  ? "a very long way out"
  : d > 16000  ? "a long way out"
  : d > 6000   ? "out there"
  : d > 1200   ? "close"
  : "right here";

function objectiveFix() {
  const me = ships[0];
  if (!surv.target || !me) return null;
  const d = Math.hypot(surv.target.x - me.x, surv.target.y - me.y);
  return {
    name: surv.target.name,
    bearing: bearingTo(me, surv.target),
    range: rangeBand(d)
  };
}

/* Where the coil throws you: a random bearing, and a distance that can be a
   good deal closer to home than you are or a long way past it — which is what
   makes it a jump rather than a lift. You keep the part and lose everything
   else about where you were, including your speed.

   The spot is redrawn until it is one you can arrive at alive: not inside a
   world, not inside a well's killing radius. The sector is rebuilt around
   wherever it settles on, and then checked again — a chunk that did not exist
   when the point was picked knows things the check could not. */
function coilJump() {
  const me = ships[0];
  const from = Math.hypot(me.x, me.y) || 1;
  /* Where you were, and how far away the new spot has to be. A random bearing
     at a random distance can land you a few hundred units from where you were
     standing — technically random, and it reads as the thing not working. So
     the draw has a floor on it: wherever it puts you, it is somewhere else. */
  const wasX = me.x, wasY = me.y;
  const leap = from * 0.4;
  const clear = (x, y) => {
    if (Math.hypot(x - wasX, y - wasY) < leap) return false;
    for (const h of hazards) {
      if (dist2(x, y, h.x, h.y) < (h.kill * 2.4 + 900) ** 2) return false;
    }
    for (const pl of surv.planets) {
      if (dist2(x, y, pl.x, pl.y) < (pl.r + 900) ** 2) return false;
    }
    return true;
  };
  for (let tries = 0; tries < 24; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = from * (0.35 + Math.random() * 1.9);
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    me.x = x; me.y = y;
    me.vx = 0; me.vy = 0;
    me.a = a;
    me.boost = 0;
    me.invuln = Math.max(me.invuln, 2.4);
    surv.warpCool = 2.5;
    cam.x = x; cam.y = y;
    streamChunks(true);
    streamRocks();
    if (!clear(x, y) && tries < 23) continue;
    burst(x, y, "#a08cff", 40, 420 * U);
    addShake(11);
    gameSound("lose", x, y);
    banner = { text: "THE COIL FIRED", t: 4.2, colour: "#a08cff",
               sub: "you are somewhere else" };
    chatter("It went off in your hands — " + Math.round(d / 1000) +
            "k from home, and you did not choose it.", "#a08cff");
    surv.t.warped = true;
    return true;
  }
  return false;
}

/* Picking one up and handing it over. A part is not salvage: it does not go
   in the hold, it cannot be sold, and losing your hull does not drop it —
   the manifest is the spine of the mode and a part lost in deep space would
   be a run you cannot finish. */
/* How far outside a part's own shape its ring is drawn — and therefore how
   far out you can pick it up. One number, read by the collision and by the
   drawing, so the two cannot drift. */
/* How often a chunk hides something you could otherwise only buy. One in
   four hundred: rare enough that finding one is an event, common enough that
   a long sector eventually pays for the looking. */
const LOOSE_PART_CHANCE = 1 / 400;

const PART_RING = 30;

function surveyParts(dt) {
  const me = ships[0];
  if (!me.alive) return;
  const R = shipRadius();

  for (let i = surv.parts.length - 1; i >= 0; i--) {
    const pt = surv.parts[i];
    /* The ring, not the triangle. A part is drawn as a shape inside a ring
       that pulses thirty units outside it, and the ring is what reads as
       "the thing" — but the pickup was the shape, so you could fly through
       what looked like the middle of it and collect nothing. Taking the
       ring's resting radius rather than its widest, so the hitbox is never
       bigger than what is on the screen at that moment. */
    if (dist2(me.x, me.y, pt.x, pt.y) > (pt.r + PART_RING + R) ** 2) continue;
    /* A spare takes room, so it can be refused — and being refused must leave
       it lying there rather than quietly deleting it. Said once a pass, by the
       same words every other full-hold refusal uses. */
    if (pt.mod && !roomForPart(pt.key)) {
      if (!pt.said) { pt.said = true; noRoomFor(pt.key); }
      continue;
    }
    surv.parts.splice(i, 1);
    if (pt.mod) storeAdd(pt.key, 1); else surv.carrying.add(pt.key);
    /* A spare that came from a site in the sector is remembered as taken, or
       the next time its chunk is rebuilt from the seed it grows back. Only
       ones with a `site`: a spare you dropped when you died is remembered by
       `surv.dropped` instead, and putting it in here as well would retire a
       site it never came from. */
    if (pt.mod && pt.site) surv.lifted.add(pt.site);
    /* If this is one you dropped when you died, it stops being dropped — the
       list is what makes it exist out here, so leaving it on would put a second
       copy in the sky the next time the chunks stream.

       By `id` where there is one: two spare coils from the same death are two
       objects, and matching them by key would take both off the floor for one
       pickup. */
    /* And the chart forgets it, wherever it was standing when you took it.
       This used to happen only on the dropped branch below, so a part found
       by scanning and then picked up off its original site left a PART mark
       at that site for the rest of the run: you emptied the place yourself
       and the chart went on pointing at it. Worst after dying with one —
       the part is now lying where you fell, and the only mark on the board
       was the stale one, back where it started. */
    surv.known.delete(knownId("part", pt.x, pt.y));
    const back = pt.id
      ? surv.dropped.findIndex(d => d.id === pt.id)
      : surv.dropped.findIndex(d => d.key === pt.key);
    if (back >= 0) surv.dropped.splice(back, 1);
    burst(pt.x, pt.y, CASH, 26, 260 * U);
    gameSound("win", pt.x, pt.y);
    addShake(5);
    /* "Take it home" is the manifest's instruction and it is wrong for a
       spare: nobody is waiting for your second pulse coil at the yard. A spare
       is simply back in the hold. */
    chatter(pt.mod
      ? pt.name + " back in the hold."
      : pt.name + (back >= 0 ? " back aboard \u2014 take it home"
                             : " recovered \u2014 take it home"), CASH);
    surveyFind("salvor");
    /* The coil is not a component until it is bolted down. Pulling it off the
       gate it was wound around discharges the thing, and the sector folds:
       you are somewhere else, and you do not get to say where. It is the one
       moment in the mode that happens *to* you, and it is why the coil is
       worth finding rather than merely worth collecting.

       **Once.** It discharges when you take it off the gate; after that it is a
       spent component like any other. Dying with it and going back for it used
       to fire it again every single time, which turned "go and get your part
       back" into a random throw across the sector — and, if you were unlucky,
       into a chase you could not finish. */
    if (pt.key === "coil" && !surv.coilFired) {
      surv.coilFired = true;
      coilJump();
    }
    saveSurveyBook();
  }

  /* Home, and it is the docking ring that counts rather than a delivery
     circle of its own. There is one landmark off the origin now instead of
     two, so the radius that means "you have arrived" is the radius that has
     always meant it. */
  if (!surv.carrying.size) return;
  if (dist2(me.x, me.y, HOME_STATION.x, HOME_STATION.y) >
      SURVEY_DOCK * SURVEY_DOCK) return;

  /* The shelf is rolled lazily and kept until its restock clock runs out, so
     a beacon fitted at 11:59 would otherwise light STOCK and leave the same
     four common parts on the counter for another quarter of an hour. Home's
     shelf is dropped here and re-read on the next look. */
  const home = surv.stations.find(s => s.home);
  if (home) { const m = marketOf(home); if (m) m.shelf = null; }

  for (const key of surv.carrying) {
    surv.built.add(key);
    /* What it *did*, not how many of them there are now. "3 of 6" is a
       progress bar read out loud; "the dry dock is running" is the reason
       you flew eleven thousand units with a spar in the hold. */
    const svc = serviceSpec((partSpec(key) || {}).opens);
    chatter(partSpec(key).name + " fitted" +
            (svc ? " \u2014 " + svc.name + " is running" : ""), CASH);
  }
  surv.carrying.clear();
  burst(HOME_STATION.x, HOME_STATION.y, CASH, 40, 320 * U);
  gameSound("win", HOME_STATION.x, HOME_STATION.y);
  addShake(9);
  if (stationWhole()) {
    surveyFind("finished");
    /* "it was never about the parts" was a curtain line, and it landed on
       the one moment in the run where the sector actually opens up. The
       manifest is the tutorial; this is where the game starts. So the banner
       faces forwards. */
    banner = { text: "THE STATION IS WHOLE", t: 4.6, colour: CASH,
               sub: "the mouth is open \u2014 now go somewhere you have not been" };
  }
  saveSurveyBook();
}

/* ── the gazetteer ────────────────────────────────────────────────────────
   The chart drew hazards, planets and landmarks straight out of the streamed
   lists — which hold five chunks either side of the ship and nothing else. So
   the map showed you what was already on your screen, forgot the station you
   passed ten minutes ago, and was no help at all with the one question a map
   exists to answer: where was that thing.

   So everything notable you get close enough to see is written down and kept.
   It survives the chunk unloading, it survives the tab, and it is the only
   part of the chart that is a *record* rather than a live readout. A scan
   writes to it too, which is most of the reason to press the button.

   Keyed by kind and rounded position, so passing the same station twice does
   not write it twice, and capped — a very long survey should cost kilobytes,
   not megabytes. */
const KNOWN_CAP = 600;
const knownId = (k, x, y) =>
  k + ":" + Math.round(x / 60) + "," + Math.round(y / 60);

/* `r` is the thing's real size in world units, and the chart needs it: a world
   can be 340 units across or 3,600, and drawing both as the same five-pixel
   glyph threw away the only fact about a world that matters for navigating by
   it. Zero means "no size worth drawing" — a station, a gate — and those keep
   their glyph. */
function noteKnown(k, x, y, name, r) {
  const id = knownId(k, x, y);
  if (surv.known.has(id)) return false;
  if (surv.known.size >= KNOWN_CAP) return false;
  surv.known.set(id, { k, x: Math.round(x), y: Math.round(y),
                       name: name || "", r: Math.round(r || 0) });
  return true;
}

/* ── mapping the sky ──────────────────────────────────────────────────────
   Ric: *"when you go into a new sector or biome and scan then the borders of
   the sectors and biomes are up."* Two ways a region cell gets onto the chart:
   flying through it writes that one cell, and a scan writes every cell of the
   biome you are in and every cell of the territory you are in, as far as
   each patch reaches. What is written is what you saw — the biome, and who
   held it then — so a border the war has since moved is still drawn where it
   was until you come back and look again. */
const MAPPED_CAP = 8000;
const MAP_FLOOD = 90;           // most cells one patch reveals in one scan
function cellSeen(cx, cy) {
  const site = WORLD.regionSite(cx, cy);
  const sp = WORLD.spaceOfCell(cx, cy);
  return { r: site.region.key, o: sp.owner || sp.kind };
}
/* The flags of the cells around one you flew through, without their biomes.
   Ric: "the biome lines apear from going into it not the faction lines."
   Measured over a straight 800,000-unit flight: fourteen cells charted, and
   of the twenty-four neighbouring pairs among them twenty-one differed in
   biome and two in owner. Biomes change from cell to cell, so a one-cell-wide
   ribbon crosses them constantly and their dashed edges are everywhere; a
   power's space runs for dozens of cells, so the ribbon almost never has a
   border inside it and the solid lines never appeared.

   So flying reads the flags either side of the lane as well — a flag is
   something a ship can see across a sector, which a biome is not. The record
   carries an empty biome, and flying through the cell itself fills it in. */
function markFlag(cx, cy) {
  const key = cx + "," + cy;
  if (surv.mapped.has(key)) return false;
  /* Flags are nine cells a lane, so they would eat the record nine times
     faster than flying does. The last quarter of it is kept for the cells
     you actually went through. */
  if (surv.mapped.size >= MAPPED_CAP * 0.75) return false;
  surv.mapped.set(key, { r: "", o: cellSeen(cx, cy).o });
  surv.mappedStamp = (surv.mappedStamp || 0) + 1;
  return true;
}

function markMapped(cx, cy) {
  const key = cx + "," + cy;
  const now = cellSeen(cx, cy);
  const had = surv.mapped.get(key);
  if (had && had.r === now.r && had.o === now.o) return false;
  if (!had && surv.mapped.size >= MAPPED_CAP) return false;
  surv.mapped.set(key, now);
  surv.mappedStamp = (surv.mappedStamp || 0) + 1;
  return true;
}
/* The patch around a cell whose `same` answer matches its own, walked over
   the eight neighbours and capped, because a power's territory can run on for
   millions of units and one scan should chart a place, not a continent. */
function floodMap(cx, cy, same) {
  const want = same(cx, cy);
  const seen = new Set([cx + "," + cy]);
  const queue = [[cx, cy]];
  let added = 0, n = 0;
  while (queue.length && n < MAP_FLOOD) {
    const [x, y] = queue.shift();
    n++;
    if (markMapped(x, y)) added++;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const k = (x + i) + "," + (y + j);
        if ((!i && !j) || seen.has(k)) continue;
        seen.add(k);
        /* The first cell past the edge is charted too, or a border would
           have a known side and an unknown one and nothing to draw between. */
        if (same(x + i, y + j) === want) queue.push([x + i, y + j]);
        else if (markMapped(x + i, y + j)) added++;
      }
    }
  }
  return added;
}
function mapHere() {
  const me = ships[0];
  if (!me) return;
  const site = WORLD.siteAt(me.x, me.y);
  if (surv.mapCell === site.cx + "," + site.cy) return;
  surv.mapCell = site.cx + "," + site.cy;
  /* A border that moved while you were away is the war's news, and the chart
     is how you find out: it says what you saw, and flying back in says what
     it is now. */
  const had = surv.mapped.get(surv.mapCell);
  markMapped(site.cx, site.cy);
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) if (i || j) markFlag(site.cx + i, site.cy + j);
  }
  const now2 = surv.mapped.get(surv.mapCell);
  if (had && now2 && had.o !== now2.o) {
    const T = { holder: o => {
      const f = FACTIONS.find(q => q.key === o);
      return f ? f.short + " SPACE" : (WORLD.SPACES[o] || { name: o }).name;
    } };
    chatter("You charted this as " + T.holder(had.o) + ". It is " +
            T.holder(now2.o) + " now.", "#ffcb42");
  }
}
// What a scan charts: the biome and the territory you are standing in.
function scanBorders() {
  const me = ships[0];
  if (!me) return 0;
  const site = WORLD.siteAt(me.x, me.y);
  const biome = floodMap(site.cx, site.cy, (x, y) => WORLD.regionSite(x, y).region.key);
  const space = floodMap(site.cx, site.cy, (x, y) => {
    const sp = WORLD.spaceOfCell(x, y);
    return sp.owner || sp.kind;
  });
  return biome + space;
}

/* What is worth remembering, and from how far. A station is worth a note from
   right across the sight radius; a rock is not worth one at all. */
function recordSurroundings() {
  const me = ships[0];
  if (!me || !me.alive) return;
  const sight = SURVEY_SIGHT * 1.4;
  const s2 = sight * sight;
  let added = 0;

  for (const st of surv.stations) {
    if (dist2(st.x, st.y, me.x, me.y) < s2) added += noteKnown("station", st.x, st.y);
  }
  for (const g of surv.gates) {
    if (dist2(g.x, g.y, me.x, me.y) < s2) added += noteKnown("gate", g.x, g.y);
  }
  for (const c of surv.caches) {
    if (dist2(c.x, c.y, me.x, me.y) < s2) added += noteKnown("cache", c.x, c.y);
  }
  for (const pt of surv.parts) {
    if (dist2(pt.x, pt.y, me.x, me.y) < s2) {
      added += noteKnown("part", pt.x, pt.y, pt.name);
    }
  }
  /* Wells are worth knowing from further out — they are the thing you plan a
     route around, and a big one is visible from a long way anyway. A named one
     (supermassive, and only those) is worth knowing from further still, and it
     is written down *with* its name.

     One loop, and that matters: there were two, an anonymous one and a named
     one, and the anonymous one ran first. `noteKnown` refuses to overwrite an
     id it already has, so every supermassive well in the sector was charted as
     an unnamed glyph and the named pass could never get a word in. */
  for (const h of hazards) {
    const far = h.name ? sight * 3 : sight;
    if (dist2(h.x, h.y, me.x, me.y) < (far + h.reach) ** 2) {
      /* A well is recorded at its *reach* rather than its killing radius. The
         killing radius is a dot; the reach is the piece of the sector you have
         to plan a route around, which is the only reason to draw it. */
      added += noteKnown(h.kind === "hole" ? "hole" : "star", h.x, h.y,
                         h.name || "", h.reach);
    }
  }
  for (const pl of surv.planets) {
    /* A world's own name goes into the gazetteer with it: the chart is the
       record, and a record of "a world, here" is most of a record.

       Measured to its *surface*, not to its centre, and that is the whole of a
       bug worth writing down. Sight is 980 units and a world can be 1,800 in
       radius — so a big one could never bring its centre inside the check, and
       the biggest, most unmissable objects in the sector were the ones the
       chart had never heard of. You could land on EREIA V and it would still
       not be on the map. */
    if (dist2(pl.x, pl.y, me.x, me.y) < (sight + pl.r) ** 2) {
      added += noteKnown("planet", pl.x, pl.y, pl.name || "", pl.r);
    }
  }
  if (surv.leviathan &&
      dist2(surv.leviathan.x, surv.leviathan.y, me.x, me.y) < (sight * 3) ** 2) {
    added += noteKnown("leviathan", surv.leviathan.x, surv.leviathan.y, "LEVIATHAN");
  }
  if (added) saveSurveyBook();
}

/* ── the warning ──────────────────────────────────────────────────────────
   A well that kills you without warning is unfair. A well that warns you is a
   decision, and that is the whole difference between a hazard and a trap.

   What is compared is honest physics: the pull where you are actually sitting
   against what your own drive can push. A ship with a refitted engine can sit
   somewhere a stock one cannot leave, so the same well warns different pilots
   at different distances — which is exactly right, and is also the clearest
   demonstration in the game of what the drive upgrade bought. */
/* Four steps rather than three, and every one of them earlier. The first said
   nothing until the pull was already half your engine, which on a supermassive
   well is close enough that turning round is a plan you have most of a second
   to form. A warning you cannot act on is decoration.

   The new first step fires at a fifth of your drive — a long way out, entirely
   survivable, and exactly the point at which somebody should be deciding
   whether to go round. */
const WARN_LEVELS = [
  [1.00, "CANNOT ESCAPE", "#ff4d6d"],
  [0.70, "PULL EXCEEDS DRIVE", "#ff6d8f"],
  [0.40, "HEAVY PULL", "#ff9d5c"],
  [0.20, "GRAVITY AHEAD", "#ffcb42"]
];

function surveyWarning() {
  const me = ships[0];
  if (!me || !me.alive) { surv.warn = null; return; }
  const escape = THRUST * (me.thrustMul || 1) * U;

  let worst = null;
  for (const h of hazards) {
    const dx = h.x - me.x, dy = h.y - me.y;
    const d2 = dx * dx + dy * dy;
    /* Look a long way past what the well reaches, so the warning arrives
       before the pull does rather than at the same moment — and further still
       for a supermassive one, which is the case where arriving late is fatal
       rather than annoying. The whole point of naming them and warning about
       them is that they can be planned around. */
    const look = h.reach * (h.k >= SUPERMASSIVE ? 4.5 : 3);
    if (d2 > look * look) continue;
    const a = h.mass / (d2 + h.soft * h.soft);
    if (!worst || a > worst.a) {
      worst = { h, a, d: Math.sqrt(d2) || 1 };
    }
  }
  if (!worst) { surv.warn = null; return; }

  const ratio = worst.a / escape;
  const level = WARN_LEVELS.find(l => ratio >= l[0]);
  if (!level) { surv.warn = null; return; }
  surv.warn = {
    text: level[1], colour: level[2], ratio,
    kind: worst.h.kind, big: worst.h.k >= SUPERMASSIVE,
    name: worst.h.name || "",
    x: worst.h.x, y: worst.h.y, r: worst.h.reach,
    bearing: bearingTo(me, worst.h)
  };
}

/* A named well, named on the world. Drawn with the hazards rather than with
   the warning, because it is a fact about the place and not about your
   situation — you should be able to read the name off one you are nowhere near
   and are not in any danger from. */
function drawWellNames() {
  for (const h of hazards) {
    if (!h.name) continue;
    if (!onScreen(h.x, h.y, h.reach)) continue;
    label3(h.name, h.x, h.y - h.kill - 34,
           h.kind === "hole" ? "#ff8f77" : "#ffd76d", 20);
  }
}

/* The warning, on the world: a ring round the thing doing it, so the words on
   the HUD have somewhere to point. */
function drawWarning() {
  const w = surv.warn;
  if (!w) return;
  const beat = 0.5 + 0.5 * Math.sin(clock * (w.ratio >= 1 ? 7 : 4));
  glow(w.colour, 2, 0.35 + beat * 0.5, () => {
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.stroke();
  });
  if (w.ratio >= 0.8) {
    // Ticks around the rim at the two worse levels, so a glance tells them
    // apart without reading anything.
    glow(w.colour, 1.6, beat * 0.8, () => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + clock * 0.3;
        ctx.beginPath();
        ctx.moveTo(w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r);
        ctx.lineTo(w.x + Math.cos(a) * (w.r + 34), w.y + Math.sin(a) * (w.r + 34));
        ctx.stroke();
      }
    });
  }
}

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
    // See SURVEY-PLAN.md, "Next up — the places", item E.
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
