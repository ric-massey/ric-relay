/* ══════════════════════════════════════════════════════════════════════
   The corridor, all of it.

   ── why this exists ─────────────────────────────────────────────────
   offramp.js already asserts the good invariants — every ramp merges,
   every exit loops back, nothing is on the wrong side of the median,
   no scenery is reachable — and it asserts them on load, in the
   browser, against `World.roads`. That is the twenty miles the car is
   standing in, and it is 26 ramps of the 2,360 the corridor builds.

   So the whole road was going unchecked, and it was not academic. A
   sweep of all 160 windows found five with two roads sharing sealed
   surface, the worst of them −16.8 px against a −17 px tolerance — the
   invariant was passing by two tenths of a pixel, four hundred miles
   from anywhere anyone had ever looked. The fault was real (a flyover
   coming back to grade while its flank was still over the road below)
   and the reason nobody had seen it was purely that nothing asked.

   Do not read a tolerance out of that −16.8. `clearance()` was picking
   the wrong half-width of both roads at the time — see the note on it
   in world.js — so any number it printed for a road with an auxiliary
   lane on one side only was measured against the other side. Corrected,
   the tightest the whole corridor gets is +2.9 px: nothing shares
   sealed surface anywhere, and the floor below has real room under it.

   ── what it does ────────────────────────────────────────────────────
   Builds every window along I-40 and asserts, per window:

     · no two roads share sealed surface off a legitimate join
     · no ramp is on the far carriageway's travel lanes at grade
     · every ramp has a way back onto the corridor
     · no exit is signed CLOSED on a carriageway that has a ramp
     · the outer edge line never doubles back on itself
     · the auxiliary lane closes at every gore
     · no exit number is built twice on one carriageway

   and, over the whole route, the two claims the corridor is FOR:

     · station spacing does not drift (a mile in the game is a mile)
     · exit numbers are mile markers, within the survey's own error

   ── how to run it ───────────────────────────────────────────────────
     node test/corridor.js            the default 16-mile stride, ~3 min
     node test/corridor.js 64         a coarse pass, ~45 s
     node test/corridor.js 8          exhaustive, ~6 min

   The stride is how far apart the window centres are. Windows are 20
   miles wide, so anything up to 20 covers the route with overlap; the
   default of 16 is a compromise between coverage and how long anyone
   is willing to wait before committing.
   ══════════════════════════════════════════════════════════════════════ */

const { I40, Road: R, World } = require("./harness.js");

const MILE = 1609.34 / 0.179;
const STRIDE = Number(process.argv[2] || 16) * MILE;

/* A ramp and its parent are built to share pavement at a gore and at a
   merge, and clearance() already stands down inside those. What is left
   is the open road, where a shoulder's worth of overlap is the geometry
   doing its job and more than that is two roads in each other. */
const GAP_FLOOR = -R.SH_OUT;

/* ── two white lines are never the same white line ────────────────────
   Solid edge lines a few pixels apart, converging and crossing, is the
   fault PLAN.md §6a fixed at the gore and nobody had looked for at the
   merge — where it turned out to be at every ramp on the road, because
   the acceleration lane opens 150 stations before the ramp arrives and
   the freeway painted its outer edge the whole way.

   Asserted on the OUTCOME rather than on the rule that produces it: put
   every white line the two roads paint on one axis and measure the two
   closest. That means restating draw.js's suppression here, which is a
   duplicate and is the point — if the drawing rule changes and this
   does not, the two disagree and the suite says so. */
const LINE_FLOOR = R.LANE / 3;         // 6.8 px: closer is one line, twice

/* draw.js `auxTaken`, restated. Whether the auxiliary strip at this
   station is still the mainline's to mark, or has become the ramp's. */
function auxTaken(r, s, side) {
  if (!r.exits) return false;
  for (const e of r.exits) {
    if ((e.side > 0 ? 1 : -1) !== side) continue;
    const n = e.nose;
    if (n && Math.abs(s - n.s) <= R.WEDGE * R.STEP + R.GORE
        && (e.side > 0 ? s >= n.s : s <= n.s)) return true;
    const m = e.mergeNose;
    if (m && (e.side > 0 ? (s >= e.s && s <= m.s)
                         : (s <= e.s && s >= m.s))) return true;
  }
  return false;
}

let pass = 0, fail = 0;
const failures = [];
const note = (ok, what, detail) => {
  if (ok) { pass++; return; }
  fail++;
  failures.push({ what, ...detail });
};

/* ══════════════════════════════════════════════════════════════════
   the route, end to end
   ══════════════════════════════════════════════════════════════════ */
console.log("\nI-40 — the whole route\n" + "─".repeat(46));

{
  /* Everything in this engine finds a station by dividing s by STEP, so
     a road whose stations are not STEP apart puts its far end somewhere
     the arithmetic cannot follow — and on a corridor whose exit numbers
     ARE mile markers that moves the exits off them.

     road.js accepts a little of this on purpose: the symmetric position
     filter cuts corners, which shortens the chain, and re-spacing it
     afterwards would make geometry depend on where the window starts
     rather than on where you are — which is a far worse trade, because
     the car then jumps every time the window slides.

     The budget is 0.15%. Measured across the route the median window
     drifts 0.009% and the worst two are 0.09% (the corridor's first
     window) and 0.08% (the Pigeon River Gorge, where the curvature is
     tightest and there is most corner to cut). 0.1% over a twenty-mile
     window is 96 ft, which is inside the third of a mile the survey's
     own state residuals are good to — so this is set where the data
     honestly lands, with room, rather than on today's worst case. */
  const DRIFT_BUDGET = 0.0015;
  let worstDrift = 0, at = 0;
  for (let mi = 10; mi < I40.lengthPx / MILE - 10; mi += 200) {
    World.setStart(mi * MILE);
    const road = World.buildWindow(mi * MILE);
    let geo = 0;
    for (let i = 1; i < road.st.length; i++)
      geo += Math.hypot(road.st[i].x - road.st[i - 1].x, road.st[i].y - road.st[i - 1].y);
    const drift = Math.abs(geo - R.len(road)) / R.len(road);
    if (drift > worstDrift) { worstDrift = drift; at = mi; }
  }
  note(worstDrift < DRIFT_BUDGET, "station spacing holds to 0.15%",
       { worst: +(worstDrift * 100).toFixed(4) + "%", atMile: at });
  console.log(`  ${worstDrift < DRIFT_BUDGET ? "ok  " : "FAIL"} station spacing drift  = `
    + `${(worstDrift * 100).toFixed(4)}% worst (mile ${at})`);
}

{
  /* The check that proves the spec: on an Interstate the exit number IS
     the mile marker, so `marker(px)` and the number on the sign have to
     agree.

     They will not agree exactly. A state's residual is one number
     fitted over four hundred miles of surveyed road, so individual
     exits scatter around it — the mean is 0.43 mi and the worst single
     exit is 2.0. What this is looking for is not scatter, it is a
     WHOLE STATE using the wrong residual, which is what happens when
     the boundary rule is wrong: the last four miles of every state
     used to be handed to the next one, and those exits came out 150 to
     370 miles adrift. Three miles catches that class of fault with
     nothing to spare for it, and the mean below is the tighter of the
     two assertions anyway. */
  const EXIT_TOL = 3;
  let n = 0, sum = 0; const off = [];
  for (const e of I40.exits) {
    const num = parseFloat(String(e.ref));
    if (!isFinite(num)) continue;
    /* "24-25" and its kind name two junctions at once; parseFloat takes
       the first, so they read a mile or two low by construction. */
    if (/[-–]/.test(String(e.ref))) continue;
    const m = World.marker(e.px);
    if (!m) continue;
    const err = m.mile - num;
    n++; sum += Math.abs(err);
    if (Math.abs(err) > EXIT_TOL) off.push({ ref: e.ref, state: m.state, err: +err.toFixed(2) });
  }
  const mean = sum / n;
  const okExits = off.length === 0 && mean < 1;
  note(okExits, "exit numbers are mile markers",
       { meanErrorMi: +mean.toFixed(3), beyondTolerance: off.slice(0, 8) });
  console.log(`  ${okExits ? "ok  " : "FAIL"} exit number vs mile post`
    + `  = ${mean.toFixed(3)} mi mean over ${n}, ${off.length} beyond ${EXIT_TOL} mi`);

  /* And no mile post reads a number that does not exist on any road. */
  let neg = 0, steps = 0;
  for (let px = 0; px <= I40.lengthPx; px += MILE / 10) {
    steps++;
    const m = World.marker(px);
    if (m && m.mile < 0) neg++;
  }
  note(neg === 0, "no negative mile markers",
       { miles: +(neg / steps * I40.lengthPx / MILE).toFixed(1) });
  console.log(`  ${neg === 0 ? "ok  " : "FAIL"} negative mile markers  = `
    + `${(neg / steps * I40.lengthPx / MILE).toFixed(1)} mi of corridor`);

  /* Every exit belongs to exactly one state, and it is the one whose
     numbering it uses. */
  let misfiled = 0;
  for (const e of I40.exits) {
    const st = World.stateAt(e.px);
    const truth = I40.states.filter((s) => e.px >= s.startPx && e.px <= s.endPx)[0];
    if (truth && st && st.name !== truth.name) misfiled++;
  }
  note(misfiled === 0, "exits are filed under their own state", { misfiled });
  console.log(`  ${misfiled === 0 ? "ok  " : "FAIL"} exits in the right state  = `
    + `${misfiled} misfiled`);
}

/* ══════════════════════════════════════════════════════════════════
   every window
   ══════════════════════════════════════════════════════════════════ */
console.log("\nEvery window on the corridor\n" + "─".repeat(46));

let windows = 0, ramps = 0, worstGap = Infinity, worstWhere = null;
let slowest = 0, slowestAt = 0;
const crossed = [], oneWay = [], liars = [];
const noseOnRoad = [], noseTooEarly = [], noNose = [], doubled = [];
const dips = [], openGores = [], twins = [];
let worstResidue = 0, residueAt = null;
/* ── the shape of an exit, and where it goes ────────────────────────
   79% of the exits on this corridor are generated rather than walked,
   and for a long time all of them were the same 268 px bump with a flat
   top on it. The three lists below are the three halves of that fault
   (PLAN.md §7 item 3), each asserted against the 349 ramps the survey
   DID walk rather than against a taste:

     · the reach distribution — how far out a terminal stands
     · the apex — a ramp has one, a truck stop has a plateau
     · the terminal — the ramp meets the street, squarely and at grade

   The first two are distributions and are checked once at the end over
   everything built; the last is per ramp. */
const reachGen = [], reachReal = [], flatGen = [], flatReal = [];
const noTerm = [], skewed = [], overpass = [], emptyStreet = [];
let stopsWanted = 0, stopsBuilt = 0, stopsServed = 0, stopsLost = 0, restLost = 0;
const t0 = Date.now();

for (let px = 2 * MILE; px <= I40.lengthPx - 2 * MILE; px += STRIDE) {
  const mi = +(px / MILE).toFixed(1);
  const t = Date.now();
  World.setStart(px);
  const road = World.buildWindow(px);
  const ms = Date.now() - t;
  if (ms > slowest) { slowest = ms; slowestAt = mi; }
  windows++;
  ramps += World.roads.filter((r) => r.kind === "ramp").length;

  /* A ramp that leads away from the corridor is a hole in the map.
     buildWindow takes those off before anything can steer onto one and
     records what it dropped; either way there must be none left. */
  for (const r of World.roads)
    if (r.kind === "ramp" && !r.merge) oneWay.push({ mi, ramp: r.exitRef || r.stopName || "?" });
  for (const w of (World.state.oneWay || [])) oneWay.push({ mi, dropped: w });
  World.state.oneWay = [];

  const c = World.clearance(true);
  if (c.worst != null && c.worst < worstGap) { worstGap = c.worst; worstWhere = { mi, ...c.where }; }
  for (const x of c.crossed) crossed.push({ mi, ...x });

  /* ── nothing solid stands on shared pavement ──────────────────────
     A ramp's station zero is the middle of the deceleration lane, so
     at the junction station the ramp and the mainline are one piece of
     tarmac — and the crash cushion, and the test that ends a run for
     touching it, were both put there. Every exit on the corridor had a
     run-ending object standing in a lane a driver is entitled to move
     across freely.

     Two halves, and both are needed. The nose must be somewhere the
     two sealed surfaces have actually parted, and the junction station
     must NOT be such a place — otherwise the first check could be
     satisfied by moving the nose nowhere. */
  for (const ex of road.exits) {
    const r = ex.ramp;
    if (!r || r.dead || !ex.nose) continue;
    /* The nose is where the two sealed surfaces have genuinely parted,
       by at least World.NOSE_CLEAR. Nothing stands there any more — the
       crash cushion is gone, because an attenuator belongs on the end of
       a barrier run and an ordinary gore has no barrier in it. What the
       nose still decides is PAINT: it is where the deceleration lane's
       edge line stops, so if it drifted back onto shared pavement the
       mainline would grow a second edge line beside its own. */
    if (!(ex.nose.gap >= 12))
      noseOnRoad.push({ mi, ref: r.exitRef || r.stopName || "?", gap: +ex.nose.gap.toFixed(1) });
    /* And the junction station itself is still shared pavement, so
       nothing may be put there. Checked directly rather than inferred:
       the ramp's parent-facing edge at its station zero must be inside
       the parent's own sealed surface. */
    const out = ex.out != null ? ex.out : (ex.side > 0 ? 1 : -1);
    const e0 = R.edges(r, 0);
    const p0 = R.at(r, 0, ex.nose.nearIsL ? e0.uL : e0.uR);
    const pr0 = R.project(road, p0.x, p0.y, Math.round(ex.s / R.STEP), 80);
    if (pr0) {
      const pe = R.edges(road, pr0.s);
      const gap0 = out > 0 ? pr0.u - pe.uR : pe.uL - pr0.u;
      if (gap0 >= 0) noseTooEarly.push({ mi, ref: r.exitRef || r.stopName || "?", gapAtGore: +gap0.toFixed(1) });
    }
    if (ex.nose.d <= 0) noseTooEarly.push({ mi, ref: r.exitRef || r.stopName || "?", d: ex.nose.d });
  }
  for (const ex of road.exits)
    if (ex.ramp && !ex.ramp.dead && !ex.nose)
      noNose.push({ mi, ref: ex.ramp.exitRef || ex.ramp.stopName || "?" });

  /* ── and no two of those lines are on top of each other ────────────
     Walked over each structure's own ground, plus the run of
     acceleration lane that reaches out past its merge, because that
     stretch is exactly where the fault was. At every station the
     mainline still marks, the ramp's unsuppressed edges are brought
     onto the corridor's u axis and measured against it. */
  for (const ex of road.exits) {
    const r = ex.ramp;
    /* Anchored on the MERGE STATION, not on the merge nose. The nose is
       what the fix produces; taking the range from it would make this
       skip exactly the ramps that had lost it, and pass by asking
       nothing. `merge.s` is where the ramp lands and every ramp has one
       — a ramp without a way back is deleted before this runs. */
    if (!r || r.dead || !r.merge) continue;
    const side = ex.side > 0 ? 1 : -1, right = side > 0;
    const skip = right ? road.noPaintR : road.noPaintL;
    const reach = R.MERGE * R.STEP;
    const a = Math.max(8, Math.min(ex.s, r.merge.s) - reach);
    const b = Math.min(R.len(road) - 8, Math.max(ex.s, r.merge.s) + reach);
    let hint = null;
    for (let s = a; s <= b; s += 32) {
      const w = right ? R.auxAt(road, s) : R.auxAtL(road, s);
      if (w < R.LANE * 0.34) continue;                  // a taper, not a lane
      if (auxTaken(road, s, side)) continue;
      if (R.suppressed(skip, Math.round(s / R.STEP))) continue;
      const aux = right ? R.edges(road, s).uR : R.edges(road, s).uL;
      const p = R.at(road, s, 0);
      const pr = R.project(r, p.x, p.y, hint, hint == null ? 0 : 80);
      if (!pr) continue;
      hint = pr.i;
      if (pr.t <= 0 || pr.t >= 1) continue;
      /* Only the ramp's PARENT-FACING edge. Its far edge is the outer
         line of the whole pavement — the same line the mainline's aux
         edge is, taking turns with it — so at the handover the two are
         one line and read as zero apart by design. Measuring that pair
         would fail on the overlap that exists to stop the line
         breaking. The near edge is the one that has no business near
         anything, and it is the pair the merge fault was made of. */
      const e = R.edges(r, pr.s);
      const i = Math.round(pr.s / R.STEP);
      const nearIsL = ex.nose ? ex.nose.nearIsL : right !== !!r.mirror;
      const u = nearIsL ? e.uL : e.uR;
      if (R.suppressed(nearIsL ? r.noPaintL : r.noPaintR, i)) continue;
      const q = R.at(r, pr.s, u);
      const bk = R.project(road, q.x, q.y, Math.round(s / R.STEP), 80);
      if (!bk) continue;
      const d = Math.abs(bk.u - aux);
      if (d < LINE_FLOOR)
        doubled.push({ mi, ref: r.exitRef || r.stopName || "?",
                       side: right ? "E" : "W", apart: +d.toFixed(1) });
    }
  }

  /* ── the edge line never goes back on itself ───────────────────────
     Where two structures are closer together than the lengths their
     tapers are sized for, the max of a lane thinning away and a lane
     opening up is a dip — full width, in, and back out — and the outer
     edge line follows it exactly. R.settleAux fills them; this is the
     outcome, asked of the finished cross-section rather than of the
     rule that produces it.

     Inside one run of open auxiliary lane the width must be unimodal:
     it may rise, it may hold, it may fall, and once it has fallen it
     may not rise again. The gore wedges are the one place it is allowed
     to, and they are excluded here for the same reason settleAux
     leaves them alone: the wedge closes the lane at a gore whatever is
     downstream of it, so a neighbour's lane opening just past one is a
     legitimate second run, not a dip in this one. */
  for (const side of [1, -1]) {
    const arr = side > 0 ? road.aux : road.auxL;
    const d = side;
    const wedge = new Uint8Array(arr.length);
    for (const ex of road.exits) {
      if ((ex.side > 0 ? 1 : -1) !== side || (ex.ramp && ex.ramp.leftExit)) continue;
      const g = Math.round(ex.s / R.STEP);
      for (let k = 1; k <= R.WEDGE; k++) {
        const j = g + d * k;
        if (j >= 0 && j < arr.length) wedge[j] = 1;
      }
      /* …and the wedge has to actually close, or the gore has no
         neutral area for the two roads to part across.

         Measured against draw.js's own floor rather than against zero.
         A neighbour's taper reaching over a wedge leaves a few tenths
         of a pixel of asphalt behind it, and below a third of a lane
         nothing is painted on that strip and nothing can be driven in
         it — draw.js calls it "a taper, not a lane" and declines to
         mark it. What this is looking for is a lane the freeway never
         gave up, and the worst residue anywhere is reported below so a
         real one cannot hide under the threshold. */
      const end = g + d * R.WEDGE;
      if (end >= 0 && end < arr.length) {
        if (arr[end] > worstResidue) {
          worstResidue = arr[end];
          residueAt = { mi, ref: (ex.ramp && (ex.ramp.exitRef || ex.ramp.stopName)) || "?" };
        }
        if (arr[end] >= R.LANE * 0.34)
          openGores.push({ mi, ref: (ex.ramp && (ex.ramp.exitRef || ex.ramp.stopName)) || "?",
                           side: side > 0 ? "E" : "W", w: +arr[end].toFixed(1) });
      }
    }
    let i = 0;
    while (i < arr.length) {
      if (arr[i] <= 0 || wedge[i]) { i++; continue; }
      let j = i;
      while (j + 1 < arr.length && arr[j + 1] > 0 && !wedge[j + 1]) j++;
      let peak = 0, fallen = 0;
      for (let k = i; k <= j; k++) {
        if (arr[k] > peak + 1e-9) {
          if (fallen > 0.5)
            dips.push({ mi, side: side > 0 ? "E" : "W",
                        atS: k * R.STEP, depth: +fallen.toFixed(1) });
          peak = arr[k];
          fallen = 0;
        } else if (peak - arr[k] > fallen) fallen = peak - arr[k];
      }
      i = j + 1;
    }
  }

  /* ── one interchange, one structure ────────────────────────────────
     The survey names an interchange once per junction node and a
     diamond has two of them on a carriageway, so exit 373 was built
     twice: two gores, two merges and two sets of tapers a median 0.64
     mi apart, both signed 373. Folded by `interchanges`, and asserted
     here because the fold is a rule about the DATA and this is the only
     thing that reads all of it. Same number, same carriageway, inside
     the three miles that can only be one interchange. */
  {
    const seen = new Map();
    for (const ex of road.exits) {
      const r = ex.ramp;
      if (!r || r.dead || r.routeType !== "exit" || !r.exitRef) continue;
      const k = r.exitRef + (ex.side > 0 ? "|E" : "|W");
      const at = r.corridorPx != null ? r.corridorPx : road.baseS + ex.s;
      const prev = seen.get(k);
      if (prev != null && Math.abs(at - prev) < 3 * MILE)
        twins.push({ mi, ref: r.exitRef, side: ex.side > 0 ? "E" : "W",
                     apartMi: +(Math.abs(at - prev) / MILE).toFixed(2) });
      seen.set(k, at);
    }
  }

  /* ── the exits look like exits ─────────────────────────────────────
     Measured off the built roads, both kinds, so the generated ones are
     compared with the walked ones under the same instrument. `far` is
     how far the ramp's centreline gets from the corridor's — its
     terminal — and `flat` is what fraction of it is spent within a
     tenth of that, which is the number that separates an interchange
     from a truck stop's parking apron.

     Only the middle of the window: a structure whose ends fall outside
     it is measured against a corridor that stops, and every one of them
     is measured in full by another window anyway. */
  for (const r of World.roads) {
    if (r.parent !== road || r.routeType !== "exit" || r.leftExit) continue;
    if (r.corridorPx < road.baseS + 2 * MILE
        || r.corridorPx > road.baseS + R.len(road) - 2 * MILE) continue;
    const us = [];
    let hint = r.junction ? r.junction.i : null, broke = false;
    for (let i = 0; i < r.st.length; i += 2) {
      const pr = R.project(road, r.st[i].x, r.st[i].y, hint, hint == null ? 0 : 48);
      if (!pr) { broke = true; break; }
      hint = pr.i;
      us.push(Math.abs(pr.u));
    }
    if (broke || us.length < 40) continue;
    const far = Math.max(...us);
    const flat = 100 * us.filter((u) => u > 0.9 * far).length / us.length;
    if (r.real) { reachReal.push(far); flatReal.push(flat); }
    else { reachGen.push(far); flatGen.push(flat); }

    /* ── and they reach the road they exist to reach ─────────────────
       A generated exit that has no terminal has driven across its own
       cross road with nothing on it, which is the fault this whole
       section is about. A surveyed one may legitimately have none: it
       can be a flyover, and eight of the complexes on this corridor
       are, so those are counted rather than failed. */
    const t = r.terminal;
    if (!t) { (r.real ? overpass : noTerm).push({ mi, ref: r.exitRef || "?" }); continue; }
    if (Math.abs(R.deckAt(r, t.s) - R.deckAt(t.cross, t.xs)) > 0.5)
      noTerm.push({ mi, ref: r.exitRef || "?", what: "not at grade" });
    /* A generated ramp is parallel to the freeway at its apex and the
       street is built square to it, so this is a right angle by
       construction and a big number means the street is standing at
       somebody else's interchange. Walked geometry is allowed its own
       angles and is not asked. */
    if (!r.real && t.skew > 25)
      skewed.push({ mi, ref: r.exitRef || "?", deg: +t.skew.toFixed(1) });
  }
  /* A cross road with no junction on it is a bridge over a freeway
     leading nowhere, which is scenery pretending to be an interchange. */
  for (const x of World.roads)
    if (x.scenery && x.terminals && !x.terminals.length
        && x.corridorPx > road.baseS + 2 * MILE
        && x.corridorPx < road.baseS + R.len(road) - 2 * MILE)
      emptyStreet.push({ mi, name: x.crossName || "?" });

  /* ── every surveyed stop is somewhere ──────────────────────────────
     Sizing the travel centres against the exits dropped 158 of 227 of
     them outright. A truck stop crowded out by an interchange is not
     gone, it is ON that interchange — see `services` in world.js — so
     what is asserted is that a named stop is either built or signed,
     not that it got its own gore. */
  {
    const lo = road.baseS + 2 * MILE, hi = road.baseS + R.len(road) - 2 * MILE;
    const here = I40.stops.filter((s) => s.px > lo && s.px < hi);
    stopsWanted += here.length;
    const own = new Set(), sold = new Set();
    for (const r of World.roads) {
      if (r.parent !== road) continue;
      if (r.routeType === "truckstop" || r.routeType === "rest") own.add(r.stopName);
      for (const nm of (r.services || [])) sold.add(nm);
    }
    for (const s of here) {
      if (own.has(s.name)) stopsBuilt++;
      else if (sold.has(s.name)) stopsServed++;
      else if (s.kind === "truck") stopsLost++;
      else restLost++;
    }
  }

  /* An EXIT n CLOSED plaque over a ramp you can take is worse than no
     sign at all: it is the road telling you a lie you can drive
     through. Asked per carriageway, because that is how it is signed. */
  const built = World.roads.filter((r) => r.kind === "ramp" && r.routeType === "exit"
                                       && !r.dead && r.corridorPx != null);
  for (const e of road.corridorExits || []) {
    for (const side of [1, -1]) {
      if (!(side > 0 ? e.closedR : e.closedL)) continue;
      const hit = built.find((r) => (r.junction && r.junction.side < 0 ? -1 : 1) === side
        && Math.abs(r.corridorPx - e.px) < 0.2 * MILE);
      if (hit) liars.push({ mi, ref: e.ref, side: side > 0 ? "E" : "W" });
    }
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);

const line = (ok, label, value) =>
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}  = ${value}`);

note(worstGap >= GAP_FLOOR, "no two roads share sealed surface",
     { worst: +worstGap.toFixed(1), floor: GAP_FLOOR, where: worstWhere });
line(worstGap >= GAP_FLOOR, "tightest clearance anywhere",
     `${worstGap.toFixed(1)} px (floor ${GAP_FLOOR}) at mile ${worstWhere && worstWhere.mi}`);

note(crossed.length === 0, "no ramp on the far carriageway at grade",
     { count: crossed.length, sample: crossed.slice(0, 8) });
line(crossed.length === 0, "ramps across the median at grade", crossed.length);

note(oneWay.length === 0, "every ramp comes back",
     { count: oneWay.length, sample: oneWay.slice(0, 8) });
line(oneWay.length === 0, "ramps with no way back", oneWay.length);

note(liars.length === 0, "no CLOSED sign over a ramp you can take",
     { count: liars.length, sample: liars.slice(0, 8) });
line(liars.length === 0, "CLOSED plaques over a live ramp", liars.length);

note(noseOnRoad.length === 0, "the nose is clear of shared pavement",
     { count: noseOnRoad.length, sample: noseOnRoad.slice(0, 8) });
line(noseOnRoad.length === 0, "noses still on shared pavement", noseOnRoad.length);

note(noseTooEarly.length === 0, "the junction station is not a gore",
     { count: noseTooEarly.length, sample: noseTooEarly.slice(0, 8) });
line(noseTooEarly.length === 0, "noses placed at the junction itself", noseTooEarly.length);

note(doubled.length === 0, "no two edge lines are the same edge line",
     { floor: +LINE_FLOOR.toFixed(1), count: doubled.length, sample: doubled.slice(0, 8) });
line(doubled.length === 0, `edge lines within ${LINE_FLOOR.toFixed(1)} px of each other`,
     doubled.length);

note(dips.length === 0, "the edge line never doubles back",
     { count: dips.length, sample: dips.slice(0, 8) });
line(dips.length === 0, "dips in an auxiliary lane", dips.length);

note(openGores.length === 0, "the lane closes at every gore",
     { floor: +(R.LANE * 0.34).toFixed(1), worst: +worstResidue.toFixed(1), at: residueAt,
       count: openGores.length, sample: openGores.slice(0, 8) });
line(openGores.length === 0, "gores whose wedge never closes",
     `${openGores.length}  (worst residue ${worstResidue.toFixed(1)} px of `
     + `${(R.LANE * 0.34).toFixed(1)}, at ${residueAt && residueAt.ref})`);

note(twins.length === 0, "one interchange, one structure",
     { count: twins.length, sample: twins.slice(0, 8) });
line(twins.length === 0, "exit numbers built twice on one carriageway", twins.length);

/* ── the generated exits are the shape the surveyed ones are ─────────
   Not "close to a constant" — the whole point is that a real ramp's
   reach is spread over most of a kilometre, so what has to match is the
   SPREAD. Asserted at the quartiles, against the walked ramps measured
   in the same pass by the same code, with a tolerance of a quarter.

   A quarter is not slack, it is what a drawn sample of a few hundred
   from an empirical distribution can be expected to land inside; the
   fault this replaced was 268 px against a median 497 and a p75 of 682,
   which is 46% and 61% out and nowhere near passing. */
const quant = (a, p) => {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y);
  const f = p * (s.length - 1), i = Math.floor(f);
  return s[i] + (s[Math.min(s.length - 1, i + 1)] - s[i]) * (f - i);
};
{
  const off = [];
  for (const p of [0.25, 0.5, 0.75]) {
    const g = quant(reachGen, p), t = quant(reachReal, p);
    if (!(Math.abs(g - t) <= 0.25 * t))
      off.push({ p, generated: +g.toFixed(0), surveyed: +t.toFixed(0) });
  }
  const ok = reachGen.length > 50 && reachReal.length > 20 && !off.length;
  note(ok, "a generated exit reaches as far as a real one",
       { generated: [0.25, 0.5, 0.75].map((p) => +quant(reachGen, p).toFixed(0)),
         surveyed: [0.25, 0.5, 0.75].map((p) => +quant(reachReal, p).toFixed(0)),
         n: [reachGen.length, reachReal.length], off });
  line(ok, "exit reach p25/p50/p75 vs surveyed",
       `${[0.25, 0.5, 0.75].map((p) => quant(reachGen, p).toFixed(0)).join("/")} px`
       + ` vs ${[0.25, 0.5, 0.75].map((p) => quant(reachReal, p).toFixed(0)).join("/")}`);
}
{
  /* A ramp has an apex; a parking apron has a plateau. The surveyed
     median is 17.7% of the length within a tenth of the peak and the
     old bump was 57.8%, so this is the single number that says whether
     an exit is drawn as an interchange or as a truck stop. */
  const g = quant(flatGen, 0.5), t = quant(flatReal, 0.5);
  const ok = flatGen.length > 50 && g <= Math.max(t * 1.6, t + 8);
  note(ok, "an exit has an apex, not a plateau",
       { generatedPct: +g.toFixed(1), surveyedPct: +t.toFixed(1) });
  line(ok, "length spent at the terminal, median",
       `${g.toFixed(1)}% vs a surveyed ${t.toFixed(1)}%`);
}

note(noTerm.length === 0 && emptyStreet.length === 0,
     "every exit meets its cross road at a junction",
     { rampsWithout: noTerm.length, streetsWithout: emptyStreet.length,
       flyovers: overpass.length,
       sample: noTerm.concat(emptyStreet).slice(0, 8) });
line(noTerm.length === 0 && emptyStreet.length === 0,
     "exits crossing their street with no junction on it",
     `${noTerm.length} (+${emptyStreet.length} empty streets, ${overpass.length} flyovers)`);

note(skewed.length === 0, "a generated ramp meets the street square",
     { count: skewed.length, sample: skewed.slice(0, 8) });
line(skewed.length === 0, "ramp terminals more than 25° off square", skewed.length);

{
  /* 158 of 227 surveyed stops were dropped outright before the travel
     centres were given an address. This asks only about the TRAVEL
     CENTRES, because they are the ones with somewhere to go: a truck
     stop crowded out by an interchange is on that interchange. The
     rest areas that lose their ground are reported beside it and not
     asserted — a rest area stands between interchanges by definition,
     so one whose ground is an exit is a rest area this corridor does
     not have, and moving it to the exit would be inventing one. */
  const ok = stopsWanted > 0 && stopsLost <= 0.05 * stopsWanted;
  note(ok, "a travel centre is built or it is signed",
       { wanted: stopsWanted, built: stopsBuilt, onAnInterchange: stopsServed,
         travelCentresLost: stopsLost, restAreasCrowdedOut: restLost });
  line(ok, "travel centres with nowhere to be",
       `${stopsLost} of ${stopsWanted}  (${stopsBuilt} built, ${stopsServed} signed, `
       + `${restLost} rest areas crowded out)`);
}

/* Not a failure: a ramp that flies straight over the mainline never
   parts from it in the ordinary way, so it has no gore to mark. Exit
   211B/211A is the only one on the corridor. */
console.log(`  --   ramps with no gore nose  = ${noNose.length}`
  + (noNose.length ? "  (" + noNose.slice(0, 3).map((n) => n.ref).join(", ") + ")" : ""));

/* Not an assertion — a number to watch. A window rebuild is a
   synchronous freeze in the middle of driving, and it happens roughly
   every four miles. If this ever climbs into the hundreds of
   milliseconds on a phone, the window is doing too much. */
console.log(`  --   slowest window rebuild  = ${slowest} ms (mile ${slowestAt})`);

console.log(`\n${windows} windows · ${ramps} ramps · ${secs}s`);
console.log(`${pass} passed, ${fail} failed`);
console.log("─".repeat(46));
if (fail) {
  console.log(JSON.stringify(failures, null, 1));
  process.exitCode = 1;
}
