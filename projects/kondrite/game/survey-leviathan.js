"use strict";

/* KONDRITE — SURVEY — THE LEVIATHAN AND THE VAULT
   ─────────────────────────────────────────────────────────────────────────────
   Building the two made places: the Leviathan's bays, flanks, bulkheads,
   hold and wreckage, its outline as data, and the Vault's shells and core.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── the Leviathan ────────────────────────────────────────────────────────
   The supermassive one, and the only landmark with an inside. Everything else
   out here is a thing you arrive at; this is a thing you go *into*.

   It is built as a hull of solid discs in two rows with the stern left open,
   which makes the corridor between them a real place rather than a drawn one:
   the same collision that stops you hitting the outside stops you scraping
   the walls on the way down the middle. The discs are the physics; the drawn
   silhouette is hung on the same spine, so what you see is where you crash.

   Deep inside, past its sentries, is the best salvage in the sector — which
   is the whole argument for flying 112,000 units to look at it. */
/* Nine thousand units stem to stern, which is three and a half times what it
   was and about the length of three chunks. At that size you cannot see both
   ends of it at once, which is the first thing that makes it read as a place
   rather than an object. */
/* Down 35% on Ric's call — she was 9,200 stem to stern and is 5,980. Every
   number in the builder is scaled by `LEV_S` off the same call rather than
   retyped, so the proportions are untouched: the mouths, the doorways, the
   jambs, the wings and the engines are all still the same fractions of her
   that they were, and one edit here moves the whole ship. */
const LEV_S    = 0.65;
const LEV_LEN  = Math.round(9200 * LEV_S);   // stem to stern
const LEV_BEAM = Math.round(1060 * LEV_S);   // half the beam at its widest
const LEV_SEG  = Math.round(170 * LEV_S);    // radius of one hull disc

/* ── the shape of it ───────────────────────────────────────────────────
   It did not look like a ship, and the plan view says why in one line: it was
   **a rectangle**. Two dead-straight flanks nine thousand units long, flat at
   both ends, with six identical square bays alternating down it — 7.4 to 1,
   with no bow, no stern and no taper. In plan that reads as a comb.

   The first pass at fixing it went too far the other way: a ten-point curve
   sampled into forty short plates, which came out smooth — and smooth in plan
   view is **a submarine**. This is a spacecraft, and it should look cut rather
   than moulded.

   So the hull is a **delta** — a dart, drawn from Ric's own sketch over the
   plan view: widest at the transom, narrowing the whole way forward, and
   finishing at a point. Four corners a side, each pair one long straight plate,
   and every meeting a hard chine you can see from a thousand units away. There
   is no waist and no shoulder; there is a broad square back end, one shallow
   run forward off it, a chine where the taper steepens, and a long dagger to
   the stem.

   The widest point being the *back* is most of what makes it read as going
   somewhere. A hull that bulges amidships is a boat.

   Fractions of `LEV_BEAM`, from the stern at -1 to the stem at +1. Keep them
   few. Every corner added here is a facet lost, and the facets are the
   design. */
const LEV_HULL = [
  [-1.00, 1.00],          // the transom, and it is the widest part of the ship
  [-0.52, 0.82],          // a shallow run forward off the stern quarter
  [ 0.16, 0.46],          // the chine: where the taper steepens into the bow
  [ 1.00, 0.00]           // and one straight run from there to the stem
];
// Half the beam at a point along the spine, `t` from -1 at the stern to +1.
// Linear between corners, which is what makes each run a flat facet.
function levBeam(t) {
  const P = LEV_HULL;
  if (t <= P[0][0]) return LEV_BEAM * P[0][1];
  for (let i = 1; i < P.length; i++) {
    if (t <= P[i][0]) {
      const f = (t - P[i - 1][0]) / (P[i][0] - P[i - 1][0]);
      return LEV_BEAM * (P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f);
    }
  }
  return LEV_BEAM * P[P.length - 1][1];
}

/* ── the Leviathan ────────────────────────────────────────────────────────
   The only landmark with an inside, and now the only one with an inside you
   can get lost in.

   It used to be a box with one straight corridor down the middle: you went in
   the stern, flew in a straight line, took three caches off the spine and
   turned around at the far wall. Eight seconds of decisions. The thing the
   whole manifest points at, and the best you could say about it was that it
   was long.

   What it is now, from the stern forwards:

     the throat     a wide mouth at the open stern quarter, on one flank
     five bulkheads across the spine, each with one doorway, and the doorways
                    alternate port and starboard — so the way in is a weave and
                    you always have to look for the next gap
     six bays       side chambers off the spine, alternating sides, each behind
                    its own short throat. Three of them hold something
     the hold       past the last bulkhead: a wide chamber at the bow with the
                    deepest cache, four sentries and the ablative plate

   **Every wall is both the drawing and the physics.** The old version hand-drew
   three plates and separately hand-placed the collision discs, which is two
   descriptions of one object and exactly the arrangement that lets a wall you
   can see stop being a wall you hit. A wall is a line in local space now; the
   discs are stamped along it and the renderer strokes the same list. They
   cannot disagree because there is only one of them. */
function buildLeviathan(lm, out, R, rnd) {
  const a = R() * Math.PI * 2;
  const ca = Math.cos(a), sa = Math.sin(a);
  // Local (u along the spine, v across it) into world.
  const wx = (u, v) => lm.x + u * ca - v * sa;
  const wy = (u, v) => lm.y + u * sa + v * ca;

  const segs = [];
  const walls = [];
  const half = LEV_LEN / 2;
  // The widest half-beam, amidships. Everything that asks "how far across is
  // this thing" still gets one number, and it is the biggest one.
  const flank = LEV_BEAM;
  const beamAt = u => levBeam(u / half);

  /* A run of hull along a line, in local coordinates. The discs overlap by a
     fifth so there is no gap for a nose to find, and the line is kept so the
     renderer can stroke exactly what was stamped. */
  /* A run of hull along a line. `r` is how thick the plate is, and it is not
     one number any more: every wall on the ship used to be the same 340 across,
     which is why the interior frames read as the same object as the bow armour
     and the whole thing looked stamped out rather than built. Armour is heavy
     where it is hit, structure is light where it is not, and the discs are the
     plate — so this is the collision as well as the drawing. */
  /* `k` is what this plate *is* — shell, frame, wing, engine, tear. The
     drawing needs it more than the physics does: every wall being stroked at
     the same weight is why the ship read as a bundle of grey pipes instead of
     as a body with structure inside it. The shell is the silhouette and gets
     the light; a bulkhead is furniture and belongs behind it. */
  const wall = (u0, v0, u1, v1, r, k) => {
    const t = r || LEV_SEG;
    const dx = u1 - u0, dy = v1 - v0;
    const len = Math.hypot(dx, dy);
    const n = Math.max(1, Math.ceil(len / (t * 1.15)));
    for (let i = 0; i <= n; i++) {
      const u = u0 + dx * (i / n), v = v0 + dy * (i / n);
      segs.push({ x: wx(u, v), y: wy(u, v), r: t });
    }
    walls.push({ u0, v0, u1, v1, r: t, k: k || "shell" });
  };
  /* How thick the shell is at a station. Heaviest at the stem, where anything
     this ship ever met was in front of it; lightest at the tail, which is all
     engine and nothing worth armouring. */
  const shell = u => LEV_SEG * (0.82 + 0.5 * Math.max(0, u / half + 0.35));
  const FRAME = LEV_SEG * 0.62;          // an internal bulkhead
  const RIB   = LEV_SEG * 0.72;          // a wing

  /* ── the bays, decided first ────────────────────────────────────────────
     Where they are has to be known before the flanks are built, because a bay
     is a hole in a flank and the flank is what has to be built around it. The
     first version of this laid the flanks down solid and then put the bays
     outside them, which produced six side chambers with no way in: they drew
     correctly, they had caches in them, and the caches were unreachable. The
     flood-fill test is what found it — a centreline walk never could have.

     **Four, in two opposed pairs — wings, not a comb.** Six identical squares
     alternating down a straight hull is what made the thing read as a zip
     fastener. A pair of big swept wings off the broad after quarter and a
     smaller pair further forward is a shape with an axis: symmetrical, raked,
     and unmistakably pointing somewhere. Nothing goes forward of the chine,
     because that is where the hull is narrowing and a box hanging off a taper
     looks like a mistake. */
  const bays = [
    // The hangars: long roots, hard sweep, and the reason the silhouette works.
    { at: -0.66, side: -1, hw: 760 * LEV_S, depth: 1240 * LEV_S, rake: 0.62 },
    { at: -0.66, side:  1, hw: 760 * LEV_S, depth: 1240 * LEV_S, rake: 0.62 },
    // And a forward pair that is not a smaller copy of them: short, tucked in
    // against the hull, barely swept — they read as sponsons rather than wings,
    // which is what stops the four of them looking like a repeated stamp.
    { at: -0.08, side: -1, hw: 380 * LEV_S, depth: 560 * LEV_S, rake: 0.12 },
    { at: -0.08, side:  1, hw: 380 * LEV_S, depth: 560 * LEV_S, rake: 0.12 }
  ].map(b => {
    const u = b.at * half;
    const root = beamAt(u);
    /* The cache goes *inboard* of the middle. A wing is swept, so its forward
       half is cut away by the raked leading edge — a spot at the geometric
       centre of the box can be inside a plate, which is the "buried in its
       hull" failure. A third of the way out, on the bay's own centreline, is
       open in any rake. */
    return { u, side: b.side, hw: b.hw, depth: b.depth, root,
             rake: b.rake === undefined ? 0.3 : b.rake,
             v: b.side * (root + b.depth * 0.38) };
  });
  // The same rule: a mouth is only a mouth if it is wider than the plates it
  // is cut between. See `STERN_GAP`.
  const MOUTH = Math.max(300 * LEV_S, LEV_SEG * 1.25 + 120);                     // half the width of the way into one

  /* ── the flanks ──────────────────────────────────────────────────────
     **One plate per facet.** A run is broken only where the hull actually has
     a corner in it, or where a bay takes a bite out of it — never into even
     steps, because a facet chopped into a dozen short plates with a rounded
     cap on each is how the first attempt at this came out looking like a
     submarine. A plate is what the renderer strokes and what the ship hits, so
     a long flat one is a long flat surface.

     The stern quarter of the starboard flank is the way in, and it is on the
     same side every time so the ship has a door rather than a lottery. */
  const door0 = -half, door1 = -half * 0.62;
  // Where the shell is torn open. Decided here because the flank run has to
  // leave the hole; the torn plates themselves are stamped further down.
  /* 260 either side, not 430. At 860 across it stopped reading as a hole and
     started reading as a section of hull nobody had built — the eye needs
     intact plate on both sides of a wound to know it is a wound. */
  const wrecked = !LEV_INTACT;
  const scar = wrecked
    ? { u: -half * 0.34 + rnd(-260, 260) * LEV_S, side: -1, hw: 260 * LEV_S }
    : { u: 0, side: 0, hw: 0 };          // she is whole: nothing is missing
  const flankRun = (side, from, to) => {
    /* Every corner of the hull between the ends, and every bay mouth, is a
       break in the run. Sorted and walked once: between two consecutive breaks
       the hull is a straight line, which is exactly one plate. */
    const breaks = [from, to];
    for (const c of LEV_HULL) {
      const u = c[0] * half;
      if (u > from && u < to) breaks.push(u);
    }
    const skip = [];
    const gaps = bays.filter(b => b.side === side)
                     .map(b => [b.u - MOUTH, b.u + MOUTH]);
    // And the breach, which is a hole in the shell rather than a door in it.
    if (scar.side === side) gaps.push([scar.u - scar.hw, scar.u + scar.hw]);
    for (const g of gaps) {
      const a0 = g[0], a1 = g[1];
      if (a1 <= from || a0 >= to) continue;
      skip.push([Math.max(from, a0), Math.min(to, a1)]);
      if (a0 > from && a0 < to) breaks.push(a0);
      if (a1 > from && a1 < to) breaks.push(a1);
    }
    breaks.sort((x, y) => x - y);
    for (let i = 1; i < breaks.length; i++) {
      const u0 = breaks[i - 1], u1 = breaks[i];
      if (u1 - u0 < 1) continue;
      const mid = (u0 + u1) / 2;
      if (skip.some(sk => mid > sk[0] && mid < sk[1])) continue;   // a mouth
      wall(u0, side * beamAt(u0), u1, side * beamAt(u1), shell(mid), "shell");
    }
  };
  flankRun(-1, -half, half);
  flankRun(1, door1, half);

  /* ── every opening gets a jamb ──────────────────────────────────────────
     A run of plate that simply stops in mid-air reads as a line somebody cut,
     not as a way in. Real structure finishes its edges: a hangar mouth has a
     lip, a doorway has a post, a hatch has a frame — and the eye knows the
     difference immediately even when it could not say why.

     So every deliberate opening is closed off with a short plate turned
     inboard. It is geometry rather than decoration, so the jamb is something
     you can scrape your hull on, which is what an opening in a real ship does
     to you.

     The **tears** are pointedly left ragged. A wound is the one place on this
     ship where an unfinished edge is the correct edge, and the contrast is
     what tells you which openings were built and which were made. */
  /* Sized to what it is framing. One 250-unit lip on everything choked the
     small forward sponsons — their whole chamber is 560 deep — and the flood
     fill found it: the port one became unreachable. A hatch gets a hatch's
     lip. Thinner than a frame, too: a jamb is a finishing piece, not
     structure, and a fat one eats the opening it is supposed to describe. */
  const JAMB = 250 * LEV_S;
  const jamb = (u, v, du, dv) => wall(u, v, u + du, v + dv, LEV_SEG * 0.55, "jamb");
  for (const b of bays) {
    const len = Math.min(JAMB, b.depth * 0.22);
    jamb(b.u - MOUTH, b.side * beamAt(b.u - MOUTH), 0, -b.side * len);
    jamb(b.u + MOUTH, b.side * beamAt(b.u + MOUTH), 0, -b.side * len);
  }
  // The forward post of the door, and the two edges of the stern opening.
  jamb(door1, beamAt(door1), 0, -JAMB);

  /* ── the transom, and the engines hanging off it ───────────────────────
     A ship has a back. The old one simply stopped, which is most of why it
     read as a length of corridor rather than as a vessel — and it left the
     whole stern face open, so the "door" was not a door, it was one of two
     ways in.

     Three throats stand aft of it. They are structure, so they are walls like
     everything else, and in plan they are the one silhouette nobody mistakes
     for anything else. */
  const transom = beamAt(-half);
  /* With a gap on the centreline. A ship arrives at this thing from astern and
     the stern is where it looks for a way in — sealing the transom outright
     made the whole interior unreachable from the only direction anybody
     approaches from, which the flood-fill test caught on the first run. So the
     transom is a face with a hole in the middle of it, between the engines,
     and the starboard quarter is still the obvious door. */
  /* Stepped. A single flat wall across the back is the one part of a hull
     nobody ever built flat — the corners return forward into the flank, which
     is what gives a stern its shoulders, and in plan it is the difference
     between a ship and a slab. */
  /* An opening has to be measured against the **plate**, not against the
     ship. Scaling the whole hull by 0.65 took this gap from 300 to 195 while
     the transom plate it is cut into stayed 122 across its radius — so the
     clear way through went from 113 a side to 73, and the stern stopped being
     a way in at all. The flood fill said so immediately: nothing inside was
     reachable, at the first size where the two numbers crossed.

     So the gap is whichever is larger, the proportional figure or one wide
     enough to actually fly through. */
  const STERN_GAP = Math.max(300 * LEV_S, LEV_SEG * 1.1 + 140);
  const STEP_IN = 300 * LEV_S, STEP_UP = 260 * LEV_S;
  // The lips of the way through the transom, finished like every other opening.
  jamb(-half, STERN_GAP, JAMB, 0);
  jamb(-half, -STERN_GAP, JAMB, 0);
  for (const side of [-1, 1]) {
    wall(-half, side * STERN_GAP, -half, side * (transom - STEP_UP),
         LEV_SEG * 1.1, "shell");
    /* Landing exactly where the flank is, not at the transom's own width.
       The two differ by 25 units at that station and the mismatch is the kink
       above the engine — a corner that looks like a mistake because it is
       one. */
    wall(-half, side * (transom - STEP_UP),
         -half + STEP_IN, side * beamAt(-half + STEP_IN), LEV_SEG * 1.1, "shell");
  }
  /* **Two, not three.** The third sat on the centreline, and its own walls
     closed the gap in the transom that the centreline exists to be — measured,
     not guessed: the cell at the middle of the stern face came back blocked and
     the flood fill never started, so the whole interior was unreachable from
     the one direction anybody arrives from. Two big bells either side of an
     open throat is the better shape anyway. */
  const ENG_HW = 190 * LEV_S, ENG_OUT = 620 * LEV_S;
  for (const k of [-1, 1]) {
    const v0 = k * transom * 0.56;
    wall(-half, v0 - ENG_HW, -half - ENG_OUT, v0 - ENG_HW, RIB, "engine");
    wall(-half, v0 + ENG_HW, -half - ENG_OUT, v0 + ENG_HW, RIB, "engine");
    wall(-half - ENG_OUT, v0 - ENG_HW, -half - ENG_OUT, v0 + ENG_HW, RIB, "engine");
  }

  /* ── the bulkheads, and the doorways through them ───────────────────────
     Five walls across the corridor, each with one gap. The gaps alternate
     sides, so getting to the bow is a weave rather than a straight line — and
     so a ship that is bigger than the gap has to be flown, not aimed.

     Cut to the local beam rather than to a constant, so the forward ones are
     short and the after ones are long — which is what makes the inside feel
     like a hull narrowing towards a stem. */
  /* **A bulkhead may never seal the ship.** The doorway used to be placed at
     `beam - GAP - SEG` and clamped up to a floor — which on a hull that
     narrows means the two arithmetic ends cross over, and the wall either side
     of the "gap" is then stamped *backwards across it*. The result draws as a
     doorway and is solid, and every cache forward of it becomes unreachable:
     the flood-fill test found four at once.

     So the gap is placed inside the hull it is actually crossing, and where
     the hull is too narrow to hold a wall and a doorway at all, there is no
     bulkhead — a ship's frames stop before the stem for the same reason. */
  const GAP = 300 * LEV_S;                       // clear half-width of a doorway
  const bulk = [];
  for (let i = 0; i < 5; i++) {
    const u = -half * 0.36 + (i / 5) * (half * 1.22);
    const side = i % 2 ? 1 : -1;         // which flank the gap is against
    const b = beamAt(u);
    /* The real floor, derived rather than guessed: the inboard wall exists
       while `-b < gapMid - GAP`, which works out at `b > GAP + SEG/2`. A
       rounder, larger number looked safe and quietly deleted four of the five
       frames — the whole weave — so it is the arithmetic. */
    if (b < GAP + FRAME * 1.3) continue;       // too fine forward for a frame
    const gapMid = side * (b - GAP - LEV_SEG);
    bulk.push({ u, gapMid });
    const lo = gapMid - GAP, hi = gapMid + GAP;
    if (lo > -b) wall(u, -b, u, lo, FRAME, "frame");
    if (hi < b) wall(u, hi, u, b, FRAME, "frame");
    // A door in a bulkhead has posts, the same as one in the shell does.
    if (lo > -b) jamb(u, lo, JAMB * 0.7, 0);
    if (hi < b) jamb(u, hi, -JAMB * 0.7, 0);
  }

  /* ── the bays themselves ────────────────────────────────────────────────
     Side chambers off the spine, each a short throat opening into a room. They
     are the reason to slow down: the way to the bow does not go through any of
     them, so every one is a decision to spend time. */
  /* Swept, not square. A box hanging off the side is a box hanging off the
     side; the same chamber with its leading edge raked aft reads as a fin, and
     four fins are most of what makes the silhouette look like it was going
     somewhere. The trailing edge stays square to the hull so the room inside
     is still a room you can turn round in. */
  const sheared = wrecked ? bays[3] : null;   // the starboard forward sponson
  for (const b of bays) {
    const outer = b.side * (b.root + b.depth);
    const tip = b.u + b.hw * b.rake;              // the swept forward corner
    if (b === sheared) {
      // Torn off at the root: a trailing edge, and a bitten stump of the face.
      const stub = b.side * (b.root + b.depth * 0.34);
      wall(b.u - b.hw, b.side * b.root, b.u - b.hw, stub, RIB, "wing");
      wall(b.u - b.hw, stub, b.u - b.hw * 0.2,
           b.side * (b.root + b.depth * 0.16), LEV_SEG * 0.5, "tear");
      continue;
    }
    wall(b.u - b.hw, b.side * b.root, b.u - b.hw, outer, RIB, "wing");
    wall(b.u + b.hw, b.side * b.root, tip, outer, RIB, "wing");
    wall(b.u - b.hw, outer, tip, outer, RIB, "wing");
  }

  /* ── the hold ───────────────────────────────────────────────────────────
     Past the last bulkhead and *behind the taper*: the space the whole flight
     was for has to be a room, and 170×3.2 from the stem is a wedge 265 units
     across — which was fine when the hull was a rectangle and every point on
     it was the same width. It sits where the forward body is still most of
     full beam instead. */
  /* ── what killed it ────────────────────────────────────────────────────
     Everything above builds a ship that is intact, symmetrical and fine, and
     the one thing this ship indisputably is, is **dead**. A derelict that is
     perfect down both sides is a model of a ship; the damage is what makes it
     a wreck, and it is the cheapest character in the whole structure.

     Two injuries, both structural rather than drawn, so they are things you
     can fly into and through rather than marks on a picture:

       the breach   a span of the port flank forward of the hangar is simply
                    gone, with two torn plates splayed out of the hole. It is a
                    second way in, which is the good kind of damage: it changes
                    how the place is used rather than only how it looks.
       the stub     the starboard forward sponson is sheared off at the root.
                    What is left is its trailing edge and a bitten-off stump,
                    and the asymmetry that buys is worth more than the sponson
                    was.

     Where the breach falls comes off the seed, so one sector's wreck is not
     another's — but *that there is one* does not, because a hull that is
     sometimes intact is a hull with no story. */
  if (wrecked) {
    const b0 = beamAt(scar.u - scar.hw), b1 = beamAt(scar.u + scar.hw);
    wall(scar.u - scar.hw, scar.side * b0,
         scar.u - scar.hw - 250 * LEV_S, scar.side * (b0 + 430 * LEV_S),
         LEV_SEG * 0.55, "tear");
    wall(scar.u + scar.hw, scar.side * b1,
         scar.u + scar.hw + 180 * LEV_S, scar.side * (b1 + 300 * LEV_S),
         LEV_SEG * 0.55, "tear");
  }

  /* ── what came off her ──────────────────────────────────────────────────
     Pieces of the ship, loose, inside and out. A wreck with a clean hole in it
     and nothing around it is a hull with a hole in it; the debris is what says
     something *happened* here — and it is the first thing on this structure
     that moves, which after nine thousand units of perfectly still metal is
     most of the effect.

     They drift rather than fly: each piece swings a little way along its own
     axis and turns at its own rate, driven straight off the clock. No state,
     no list to update, nothing to stream — a fragment is a function of time,
     so it costs the same whether you are looking at it or not and it cannot
     drift out of the sector while you are away.

     Not solid, deliberately. A tumbling shard that could seal a corridor is a
     room the flood fill would have to argue with every frame, and the one
     thing worse than a wreck with no debris is a wreck you cannot get into. */
  const debris = [];
  if (wrecked) {
    const pieces = 26;
    for (let i = 0; i < pieces; i++) {
      const inside = i % 3 !== 0;          // two thirds of it still aboard
      const u = rnd(-half * 0.95, half * 0.62);
      const room = beamAt(u);
      const v = inside
        ? rnd(-room * 0.72, room * 0.72)
        : (R() < 0.5 ? -1 : 1) * rnd(room + 90 * LEV_S, room + 780 * LEV_S);
      debris.push({
        u, v,
        len: rnd(40, 190) * LEV_S,         // a shard, not a plate
        a: R() * Math.PI * 2,
        spin: rnd(-0.5, 0.5),
        amp: rnd(18, 70) * LEV_S,          // how far it wanders
        w: rnd(0.08, 0.26),                // and how slowly
        phase: R() * Math.PI * 2,
        heavy: R() < 0.3                   // a few are big enough to read
      });
    }
  }

  /* Just aft of the chine. On a delta the whole forward third is a spike —
     at 0.72 of the half-length the hull is 162 units across and a cache placed
     there is *inside the plates*, which is exactly what the "buried in its
     hull" check reported. This is the forward end of the part of the ship that
     is a room rather than an edge. */
  const holdU = half * 0.12;

  /* ── the outline, as data ───────────────────────────────────────────────
     Both the renderer and the plan-view page need the silhouette, and neither
     of them may guess it. It used to be guessed — the drawing filled a
     rectangle from stern to stem at a constant beam, which was true of a
     rectangle and is a lie about a hull. So the shape is built here, once, and
     everything that needs it reads it.

     Port side stern-to-stem, then starboard back, so it closes as one polygon.
     The bays are not in it: they are drawn from their own boxes, because a
     sponson is a thing stuck on the side rather than part of the waterline. */
  const outline = [];
  for (let i = 0; i <= 48; i++) {
    const u = -half + (LEV_LEN * i) / 48;
    outline.push({ u, v: -beamAt(u) });
  }
  for (let i = 48; i >= 0; i--) {
    const u = -half + (LEV_LEN * i) / 48;
    outline.push({ u, v: beamAt(u) });
  }

  out.leviathan = { x: lm.x, y: lm.y, a, ca, sa, segs, walls, outline,
                    len: LEV_LEN, beam: LEV_BEAM, flank, transom, hold: holdU,
                    wrecked, debris,
                    engine: { hw: ENG_HW, out: ENG_OUT, at: transom * 0.58 },
                    door: [door0, door1], bulk, bays,
                    phase: R() * Math.PI * 2 };

  /* What is inside. Three of the six bays hold a cache with its own sentries,
     and the hold at the bow holds the richest one — the reward for going all
     the way through the weave rather than reaching through the door.

     Placed from the layout rather than by eye. The old version put its caches
     at hand-picked fractions of the length and one of them landed *inside* the
     bow cap, where it could be seen and never reached; the test that walks the
     inside is what caught it. Nothing here is a guess: a bay's cache sits at
     the middle of that bay, which is a place the geometry says is open. */
  /* One in all but one of the bays, and the richest in the hold. It used to
     index bays 0, 3 and 4 of six; there are four now, and an index into a list
     whose length is a design decision is a bug waiting for the next edit — so
     it takes every bay but the second and adds the hold. */
  /* Every bay that is still a room, and the hold. The sheared sponson is not
     one — a cache in a chamber that is open to space is the same class of
     mistake as the one in the bow cap, and this time the geometry says so up
     front rather than leaving the flood fill to find it. */
  const spots = bays.filter(b => b !== sheared)
                    .concat([{ u: holdU, v: 0, deep: true }]);
  spots.forEach((spot, i) => {
    const deep = i === spots.length - 1;
    const cx2 = wx(spot.u, spot.v), cy2 = wy(spot.u, spot.v);
    const n = deep ? 4 : 2;
    const guards = [];
    for (let g = 0; g < n; g++) {
      const ga = (g / n) * Math.PI * 2;
      guards.push({ x: cx2 + Math.cos(ga) * 190, y: cy2 + Math.sin(ga) * 190, a: ga });
    }
    out.caches.push({ x: cx2, y: cy2, r: 46, guards, opened: false,
                      rich: deep, phase: R() * Math.PI * 2 });
  });

  // The last part of the manifest, in the hold, behind four sentries. It is
  // the only one that is not a flight but a raid.
  const plate = BUILD.find(b => b.inside === "leviathan");
  if (plate && !surv.built.has(plate.key) && !surv.carrying.has(plate.key)) {
    out.parts.push({ key: plate.key, name: plate.name, r: 40,
                     x: wx(holdU - 260, 0), y: wy(holdU - 260, 0),
                     phase: R() * Math.PI * 2 });
  }
}

/* ── the Vault ────────────────────────────────────────────────────────────
   The second place you fly into, and deliberately not a second Leviathan. The
   Leviathan is a *wreck*: a thing that died and is being picked over, and its
   inside is a corridor with rooms off it. The Vault is a thing somebody **built
   to keep people out**, and its inside is a problem.

   A square hull with one way in, and inside it a ring corridor around a core.
   The ring has four spokes running inward and three of them are blind: they end
   in a wall, and the fourth is the way into the core. Which one is the real one
   changes with the sector, so nobody can be told the answer.

   Built from the same `wall` primitive the Leviathan uses, for the same reason:
   the discs are the physics, the line list is the drawing, and there is only one
   of them so they cannot disagree. That primitive existing is most of why this
   was an afternoon rather than a week, which is the argument for authored places
   in 6.6 — the second one is cheap once the first has paid for the machinery.

   **Every opening is sized against the discs, not against the line.** A wall is
   drawn as a line and *is* a row of 150-unit discs, so a gap that looks 350
   wide on the drawing is 50 wide to a hull. That is how the Vault shipped with
   no way in: the inner shell's gaps and the core's mouth were both narrower
   than a ship once the discs were counted, every spoke was blind, and the best
   cache in the sector sat behind a door that did not open (A3, found by the
   same flood fill that keeps the Leviathan honest, 2026-09-24). The numbers
   below are the clear widths, with the discs already subtracted. */
const VAULT_R  = 2300;    // half the width of the box
const VAULT_SEG = 150;

function buildVault(lm, out, R, rnd) {
  const a = R() * Math.PI * 2;
  const ca = Math.cos(a), sa = Math.sin(a);
  const wx = (u, v) => lm.x + u * ca - v * sa;
  const wy = (u, v) => lm.y + u * sa + v * ca;
  const segs = [], walls = [];
  const wall = (u0, v0, u1, v1) => {
    const dx = u1 - u0, dy = v1 - v0;
    const len = Math.hypot(dx, dy);
    const n = Math.max(1, Math.ceil(len / (VAULT_SEG * 1.15)));
    for (let i = 0; i <= n; i++) {
      segs.push({ x: wx(u0 + dx * (i / n), v0 + dy * (i / n)),
                  y: wy(u0 + dx * (i / n), v0 + dy * (i / n)), r: VAULT_SEG });
    }
    walls.push({ u0, v0, u1, v1 });
  };

  const S = VAULT_R;                 // the outer shell
  const RING = S * 0.55;             // the inner shell, making the ring corridor
  const CORE = S * 0.26;             // the vault itself
  const MOUTH = 330;                 // half the width of the one way in

  // ── the shell, with one gate in the middle of one side ─────────────────
  const door = Math.floor(R() * 4);  // which side it is on
  const side = (k, cut) => {
    // k: 0 top, 1 right, 2 bottom, 3 left, in local coordinates.
    const pts = [[-S, -S, S, -S], [S, -S, S, S], [S, S, -S, S], [-S, S, -S, -S]][k];
    if (!cut) { wall(pts[0], pts[1], pts[2], pts[3]); return; }
    const mu = (pts[0] + pts[2]) / 2, mv = (pts[1] + pts[3]) / 2;
    const dx = pts[2] - pts[0], dy = pts[3] - pts[1];
    const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    wall(pts[0], pts[1], mu - ux * MOUTH, mv - uy * MOUTH);
    wall(mu + ux * MOUTH, mv + uy * MOUTH, pts[2], pts[3]);
  };
  for (let k = 0; k < 4; k++) side(k, k === door);

  /* ── the inner shell, and the four spokes ──────────────────────────────
     The ring between the two shells is the corridor. Each spoke is a pair of
     walls running inward from the inner shell with a gap in the shell behind
     it; three of them end in a wall and one opens into the core. */
  const real = Math.floor(R() * 4);
  const SPOKE = 300;                 // half the width of a spoke: 300 clear inside
  /* The inner shell opens where a spoke meets it, and the opening has to be at
     least as wide as the spoke's outer edges (SPOKE + VAULT_SEG each side) or
     the spoke is sealed at its own mouth. As an angle on the shell, with a
     little over. */
  const GAP = Math.asin((SPOKE + VAULT_SEG + 40) / RING);
  for (let k = 0; k < 4; k++) {
    const ang = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const nx = Math.cos(ang), ny = Math.sin(ang);
    const tx = -ny, ty = nx;         // across the spoke
    /* The inner shell, in four arcs with a gap at each spoke. The arc runs
       from just past this spoke to just short of the next one — it used to be
       centred ON the spoke, which put the gaps between the spokes (facing
       the ring caches) and a solid wall across every spoke's mouth. */
    const A0 = ang + GAP, A1 = ang + Math.PI / 2 - GAP;
    let pu = Math.cos(A0) * RING, pv = Math.sin(A0) * RING;
    for (let t = 1; t <= 8; t++) {
      const aa = A0 + (A1 - A0) * (t / 8);
      const qu = Math.cos(aa) * RING, qv = Math.sin(aa) * RING;
      wall(pu, pv, qu, qv);
      pu = qu; pv = qv;
    }
    // The spoke's two walls, from the inner shell down to the core.
    for (const sgn of [-1, 1]) {
      wall(nx * RING + tx * SPOKE * sgn, ny * RING + ty * SPOKE * sgn,
           nx * CORE + tx * SPOKE * sgn, ny * CORE + ty * SPOKE * sgn);
    }
    // And the cap at the bottom of it — on every spoke but the real one.
    if (k !== real) {
      wall(nx * CORE - tx * SPOKE, ny * CORE - ty * SPOKE,
           nx * CORE + tx * SPOKE, ny * CORE + ty * SPOKE);
    }
  }

  /* ── the core wall ─────────────────────────────────────────────────────
     A ring around the middle, open only where the real spoke meets it. The
     mouth is the spoke's own clear width plus a disc each side, as an angle
     on the core — 0.30 rad here was 27 units of daylight. */
  const realAng = (real / 4) * Math.PI * 2 + Math.PI / 4;
  const MOUTH_A = Math.asin(Math.min(0.95, (SPOKE + 60) / CORE));
  let cu = null, cv = null, first = null;
  for (let t = 0; t <= 48; t++) {
    const aa = (t / 48) * Math.PI * 2;
    let d = aa - realAng;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const open = Math.abs(d) < MOUTH_A;
    const qu = Math.cos(aa) * CORE, qv = Math.sin(aa) * CORE;
    if (!open && cu !== null) wall(cu, cv, qu, qv);
    cu = open ? null : qu; cv = open ? null : qv;
    if (t === 0) first = [qu, qv];
  }

  out.vault = { x: lm.x, y: lm.y, a, ca, sa, segs, walls, r: S, ring: RING,
                core: CORE, door, real, phase: R() * Math.PI * 2 };

  /* What is in it. The core holds the best sealed hold in the sector; the ring
     holds two more behind their own sentries, so the trip is worth making even
     if you never work out which spoke is the real one. */
  const put = (u, v, rich) => {
    const px = wx(u, v), py = wy(u, v);
    const n = rich ? 5 : 2;
    const guards = [];
    for (let g = 0; g < n; g++) {
      const ga = (g / n) * Math.PI * 2;
      guards.push({ x: px + Math.cos(ga) * 200, y: py + Math.sin(ga) * 200, a: ga });
    }
    /* `quiet` on the core's post: its sentries do not wake up for somebody
       walking the ring. They wake when you come down a spoke for the middle,
       which is the moment the place stops being a curiosity and starts being a
       robbery — and you are told, once, before it happens. */
    out.caches.push({ x: px, y: py, r: 46, guards, opened: false, rich,
                      quiet: rich, phase: R() * Math.PI * 2 });
  };
  put(0, 0, true);
  const ringAt = k => {
    const aa = (k / 4) * Math.PI * 2;          // between the spokes
    return [Math.cos(aa) * (RING + (S - RING) * 0.5),
            Math.sin(aa) * (RING + (S - RING) * 0.5)];
  };
  put(...ringAt(1), false);
  put(...ringAt(3), false);
}
