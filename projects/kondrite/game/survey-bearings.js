"use strict";

/* KONDRITE — SURVEY — BEARINGS
   ─────────────────────────────────────────────────────────────────────────────
   Where things are: the nearest part left, where a manifest part actually
   is, what the arrow points at once the manifest is done, the gazetteer,
   mapping the sky, and the warning.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

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
    dropEchoAt(pt.x, pt.y);
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
    picked(pt.name, 1, pt.mod ? "in CARGO" : "aboard \u2014 take it home", CASH);
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
