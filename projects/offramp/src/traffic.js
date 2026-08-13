/* What is on the road here, now — and what sort of driver is in it.

   `node test/traffic.test.js` from projects/offramp.

   ══════════════════════════════════════════════════════════════════════
   This is the POPULATION half of the traffic rewrite: how many vehicles,
   of what kind, wanting to go how fast, driven by whom. It is pure —
   corridor px and a clock in, numbers out, no DOM and no game state —
   precisely so the test file can exist, because the numbers it produces
   are checkable against the counters they came from. The MOTIVE half,
   which is what those vehicles then do about each other, is PLAN.md §5c
   and goes in beside this once these figures are green.

   Everything here reads `data/traffic.js`, which is 2,551 miles of I-40
   as two federal datasets plus two derived from Tennessee's own
   counters. Nothing in this file is a number somebody felt was about
   right; where a value could not be measured it is marked DECIDED and
   PLAN.md §5c says why. Those are all in DRIVER.

   ── the four questions, in order ──────────────────────────────────────
     demand(px, when)   vehicles per hour, one direction, all lanes
     mix(px, when)      the split into car / rigid / artic
     limitFor(...)      what the sign says to THIS vehicle
     driver(...)        one driver, drawn once and kept
   ══════════════════════════════════════════════════════════════════════ */
const Traffic = (() => {
  "use strict";

  const T = (typeof I40_TRAFFIC !== "undefined") ? I40_TRAFFIC
          : (typeof window !== "undefined" && window.I40_TRAFFIC) || null;

  const MPH = 0.44704;                        // mph -> m/s
  const KINDS = ["moto", "car", "rigid", "artic"];

  /* Run-length profiles, looked up the same way world.js looks up
     `I40.lanes`: binary search for the last run starting at or before
     the pixel. Same shape, same code, so it reads the same. */
  function at(runs, px) {
    if (!runs || !runs.length) return null;
    let lo = 0, hi = runs.length - 1, best = runs[0][1];
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (runs[m][0] <= px) { best = runs[m][1]; lo = m + 1; } else hi = m - 1;
    }
    return best;
  }

  const profile = (key, px) => T ? at(T[key], px) : null;

  /* ── the clock ────────────────────────────────────────────────────────
     `when` is { dow, hour, month } — dow 0 = Monday, to match the week
     profile, which is TMAS's own convention and is why it is not 0 =
     Sunday. `hour` may be fractional; the shapes are hourly and are
     interpolated across the boundary rather than stepped, because a
     vehicle crossing 17:00 should not see the road change under it. */
  function norm(when) {
    const w = when || {};
    let dow = ((w.dow | 0) % 7 + 7) % 7;
    let hour = w.hour == null ? 12 : w.hour;
    hour = ((hour % 24) + 24) % 24;
    const month = w.month == null ? 6 : (((w.month | 0) % 12) + 12) % 12;
    return { dow, hour, month, weekend: dow >= 5 };
  }

  /* Interpolate an hourly table at a fractional hour, wrapping midnight.
     `rows` is 24 long; `get` pulls the number out of one row, because
     the tables are variously numbers and objects. */
  function hourly(rows, hour, get) {
    if (!rows) return null;
    const h0 = Math.floor(hour) % 24, h1 = (h0 + 1) % 24, f = hour - Math.floor(hour);
    const a = get(rows[h0]), b = get(rows[h1]);
    if (a == null) return b == null ? null : b;
    if (b == null) return a;
    return a + (b - a) * f;
  }

  /* ── the nearest counter ──────────────────────────────────────────────
     Magnitude comes from HPMS and shape from TMAS, and this is where the
     shape is picked up. Each counter carries, PER DIRECTION, a week as
     168 numbers averaging 1.0, a year as 12, that direction's own annual
     AADT, and the share of its traffic in each lane.

     Always the nearest, with no distance limit. That is not laziness: it
     is the documented behaviour, because California has no counter on
     I-40 at all and its 155 miles borrow one 156 miles east in the same
     desert. The distance is returned so a caller can know. */
  const BY_PX = T && T.counters
    ? T.counters.slice().sort((a, b) => a.px - b.px) : [];

  // How lopsided a counter's ANNUAL directional split may be before it
  // is treated as broken rather than informative. See `shape`.
  const SPLIT = [0.40, 0.60];

  function nearestCounter(px) {
    if (!BY_PX.length) return null;
    let lo = 0, hi = BY_PX.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (BY_PX[m].px < px) lo = m + 1; else hi = m;
    }
    const a = BY_PX[lo], b = BY_PX[Math.max(0, lo - 1)];
    return Math.abs(a.px - px) <= Math.abs(b.px - px) ? a : b;
  }

  /* One direction's shape at a pixel. `dir` is +1 for the direction the
     corridor is surveyed in (eastbound) and -1 for the other; omit it
     and both are averaged, which is what a question about the road
     rather than about a carriageway wants.

     `share` is that direction's share of the two-way AADT, measured at
     the counter rather than assumed — though it barely moves: over the
     62 counters reporting both ways the busier side is a median 50.6%.

     **A counter reporting only ONE direction cannot measure the split**,
     and 26 of the 88 on I-40 are like that. Its one direction's share of
     itself is 1, and taking that at face value hands a whole two-way
     AADT to one carriageway. Knoxville came out at exactly twice the
     documented figure, which is what made it obvious. Where the split
     cannot be measured it is a half, which is what the profile assumes
     everywhere else. */
  function shape(px, dir) {
    const c = nearestCounter(px);
    if (!c || !c.dirs) return { week: T && T.week, month: T && T.month,
                                lane: null, share: 0.5, counter: null, away: Infinity };
    const keys = Object.keys(c.dirs);
    const want = dir > 0 ? "E" : dir < 0 ? "W" : null;
    const use = want && c.dirs[want] ? [c.dirs[want]] : keys.map((k) => c.dirs[k]);
    const total = keys.reduce((a, k) => a + (c.dirs[k].aadt || 0), 0);
    const mine = use.reduce((a, d) => a + (d.aadt || 0), 0);
    /* And a counter can measure the split wrongly as well as not at all.
       Over the 62 reporting both ways the daily split runs 0.484 to
       0.529 between the fifth and ninety-fifth percentile — a through
       route is very nearly symmetric over a year, whatever it does at
       five on a Friday. Exactly one counter falls outside SPLIT, an
       Arizona one with 30 days of data claiming two thirds of the
       traffic goes one way, which no through route does. Where the
       measurement is not physical, half. */
    let share = 1;
    if (want) {
      share = (keys.length > 1 && total) ? mine / total : 0.5;
      if (share < SPLIT[0] || share > SPLIT[1]) share = 0.5;
    }
    return {
      week: use.length === 1 ? use[0].week : null,
      month: use.length === 1 ? use[0].month : null,
      dirs: use,
      lane: use.length === 1 ? use[0].lane : null,
      oneWay: keys.length === 1,
      share,
      counter: c, away: Math.abs(c.px - px),
    };
  }

  /* ── how many ─────────────────────────────────────────────────────────
     The whole point of the emitted file: magnitude in one place, shape
     in another, so they cannot drift apart.

       flow = aadt x dirShare x week(dow, hour) / 24 x month

     **The /24 is not decoration.** `week` averages exactly 1.0 over its
     168 cells and `month` over its 12, so the product of the three is a
     DAY's traffic, not an hour's. The formula printed in the header of
     `data/traffic.js` and in PLAN.md omitted the divide and was 24x out;
     both are corrected. It cost one debugging round here and would have
     cost a lot more further downstream, where 24x too much traffic just
     looks like a tuning problem.

     Returns vehicles per hour in ONE direction, across all of that
     direction's lanes. Omit `dir` for the whole road. */
  function demand(px, when, dir) {
    if (!T) return 0;
    const w = norm(when);
    const aadt = profile("aadt", px);
    if (!aadt) return 0;
    const sh = shape(px, dir);

    // Average the hourly shape over whichever directions are in play,
    // falling back to the corridor's own week where a counter reports
    // nothing for that cell — 18% of counter-months are empty.
    let wk = null, mo = null;
    if (sh.dirs && sh.dirs.length) {
      let ws = 0, wn = 0, ms = 0, mn = 0;
      for (const d of sh.dirs) {
        const v = hourly(d.week[w.dow], w.hour, (x) => x);
        if (v != null) { ws += v; wn++; }
        const m = d.month[w.month];
        if (m != null) { ms += m; mn++; }
      }
      if (wn) wk = ws / wn;
      if (mn) mo = ms / mn;
    }
    if (wk == null && T.week) wk = hourly(T.week[w.dow], w.hour, (v) => v);
    if (mo == null && T.month) mo = T.month[w.month];

    return aadt * sh.share * (wk == null ? 1 : wk) / 24 * (mo == null ? 1 : mo);
  }

  /* Lanes in ONE direction. `lanes` is the whole cross-section, for the
     same two-way-coding reason — every mainline section on I-40 is coded
     two-way, so the number is the road and half of it is your side.
     Rural I-40 reads 4 and you drive on 2. */
  function lanes(px) {
    const n = profile("lanes", px);
    return n ? Math.max(1, Math.round(n / 2)) : 2;
  }

  /* Vehicles per hour in one lane. Lanes are NOT equally loaded and the
     counters measure it — on a two-lane carriageway the split runs about
     60/40 toward lane 1. `i` is 1 for the leftmost, matching the
     counters' own numbering; omit it for the flat average. */
  function perLane(px, when, dir, i) {
    const n = lanes(px);
    const q = demand(px, when, dir);
    if (i == null) return q / n;
    const sh = shape(px, dir);
    const f = sh.lane && sh.lane[i] != null ? sh.lane[i] : 1 / n;
    return q * f;
  }

  /* Seconds between vehicles in one lane, which is the number that
     decides whether the road looks busy. Infinity when nothing is
     coming, rather than a divide by zero. */
  function headway(px, when, dir, i) {
    const q = perLane(px, when, dir, i);
    return q > 0 ? 3600 / q : Infinity;
  }

  /* ── what kind ────────────────────────────────────────────────────────
     The section's own daily lorry share, scaled by the hour of the week.
     `combo`/`aadt` is the articulated share HPMS reports for this
     stretch; `mix.mult` is how far the hour moves it, measured off
     Tennessee's length-binned counters and normalised so it averages to
     1.0 over a week. Rural I-40 at two in the morning is 2.5x its own
     daily average, which is more than half lorries.

     Rigid lorries — box vans, coaches, motorhomes — come from HPMS's
     single-unit count and get the same hourly shape, which is an
     approximation: the mix data says rigids swing far less than artics
     do. Marked so it is visible rather than assumed. */
  function mix(px, when) {
    const none = { moto: 0, car: 1, rigid: 0, artic: 0 };
    if (!T) return none;
    const w = norm(when);
    const aadt = profile("aadt", px) || 0;
    const combo = profile("combo", px) || 0;
    const single = profile("single", px) || 0;
    if (!aadt) return none;

    const shape2 = (rows) => {
      const m = rows ? hourly(rows, w.hour, (v) => v) : null;
      return m == null ? 1 : m;
    };
    const M = T.mix || {};
    const mult = shape2(M.mult && M.mult[w.weekend ? "we" : "wd"]);

    let artic = (combo / aadt) * mult;
    let rigid = (single / aadt) * mult;

    /* Motorcycles, and the shape is the OPPOSITE of the lorries':
       relatively commoner in the small hours, 1.17% of traffic against
       0.78% mid-afternoon. That is a share and not a count — absolutely
       there are about four times fewer motorcycles at three in the
       morning, and the share only rises because everything else falls
       away faster. What makes them noticeable at night is the empty road
       around them, which the game gets for free from `demand`.

       Level from the pooled counters, shape from all six — HPMS does not
       count motorcycles, so there is no second source, and the level is
       the weaker half of it: the per-counter spread runs 0.2% to 2.4%,
       which is more than a real motorcycle population varies and says
       part of the 0-8 ft bin is the loop rather than the road. */
    let moto = (M.motoBase == null ? 0.0089 : M.motoBase)
             * shape2(M.motoMult && M.motoMult[w.weekend ? "we" : "wd"]);

    // Shares, so they cannot sum past one however hard the multipliers
    // push. At 2am in the Mojave the heavy share is genuinely near three
    // quarters and this is close to binding.
    const heavy = artic + rigid + moto;
    if (heavy > 0.95) { const k = 0.95 / heavy; artic *= k; rigid *= k; moto *= k; }
    return { moto, car: 1 - artic - rigid - moto, rigid, artic };
  }

  /* ── what the sign says to THIS vehicle ───────────────────────────────
     California posts 55 for lorries against 70 for cars, for the whole
     155-mile Mojave crossing, and Arkansas 70 against 75. Nowhere else
     on I-40 has a differential at all. The `states` block carries
     `truck_rural` / `truck_urban` only where one exists, so everywhere
     else this returns the posted limit unchanged and nothing happens.

     `st` is the two-letter state; the caller has it from
     `World.stateAt`. Without it the posted limit is returned, which is
     the right failure — it is the limit for cars, and cars are most of
     the traffic. */
  function limitFor(kind, px, st) {
    const posted = profile("speed", px) || 65;
    if (kind === "car" || !st || !T || !T.states) return posted;
    const s = T.states.find((e) => e.name === st);
    if (!s) return posted;
    const urban = profile("urban", px) === 1;
    const truck = urban ? s.truck_urban : s.truck_rural;
    // Never above the posted limit: the differential is always a
    // restriction, and if a state ever reported it the other way round
    // that would be the error, not a licence.
    return truck != null ? Math.min(truck, posted) : posted;
  }

  /* ── how fast they want to go ─────────────────────────────────────────
     Measured, on I-40 itself, and it is the finding that matters most:
     THE LIMIT IS A FLOOR. Pooled over 5.3 million vehicles at counters
     posted 70, the median driver is +3 over the sign and the 85th
     percentile is +12. `observed.hour[wd|we][h].off` carries that as an
     offset per hour, so the road is quicker in the afternoon than at
     four in the morning without anybody deciding it should be.

     Drawn by inverting the percentile curve at a uniform draw. Four
     points is coarse, so it is piecewise-linear between them and
     extrapolated on the same slope beyond p15 and p95 — which is where
     the tail-end drivers come from, and PLAN.md §5c wants that tail
     because a mistake is a temperament at the end of its distribution.

     Lorries: 5 mph slower than cars at the same place and time, measured
     off I-294 (BEHAVIOUR.md §2), because TDOT never crosses its speed
     table with its length table and so there is no speed-by-class on
     I-40 itself. Applied on top of whatever limit applies to a lorry,
     which in California is the 55. */
  const PCT = [15, 50, 85, 95];
  const TRUCK_SLOWER = 5;        // mph, measured — BEHAVIOUR.md §2

  function offsets(when) {
    const w = norm(when);
    if (!T || !T.observed) return null;
    const rows = T.observed.hour[w.weekend ? "we" : "wd"];
    if (!rows) return null;
    const out = PCT.map((p) => hourly(rows, w.hour, (r) => r && r.off && r.off[p]));
    return out.every((v) => v != null) ? out : null;
  }

  /* ── above the 95th, where the instrument stops ───────────────────────
     TDOT's top speed bin is `85+`. It is open, so a motorcycle doing 130
     at three in the morning and a saloon doing 86 are the same row, and
     **the shape of the distribution above about the 95th percentile is
     not measured and cannot be.** The counters say how MANY are up there
     — 5.0% of night traffic over 85 mph in a posted 70, against 10.0%
     mid-afternoon — and nothing at all about how far up.

     So the curve is measured to p95 and DECIDED beyond it. Linear
     extrapolation, which is what the first version did, tops out around
     88 mph however many vehicles you draw: no outliers, ever. An
     exponential tail is the usual shape for the fast end of a speed
     distribution and it is what is used here, scaled per class:

       off(q) = off(p95) + TAIL[kind] x -ln((100 - q) / 5)

     TAIL is mph per e-fold. For a car, 4.0 puts about 1 in 1,000
     vehicles over 100 mph and 1 in 10,000 over 110. For a motorcycle,
     7.0 — the tail is genuinely fatter and everyone who has driven at
     night knows it. These are DECIDED. They are the least evidenced
     numbers in this file and they are here because a night with no
     outliers in it is wrong in a way that shows.

     The scale does NOT change with the hour, even though the small hours
     are when you notice. The data does not support widening it — the
     measured p95-minus-median is very slightly NARROWER at night, 15.5
     against 16.5 — and what makes a fast vehicle noticeable at three in
     the morning is the empty road around it, which `demand` already
     provides. If that turns out to read wrong in play, this is the knob,
     and it should be turned deliberately rather than found.

     Lorries go the other way: **governed**. Fleet tractors run an ECU
     limiter, in practice 65 to 70 mph, so the artic tail is not fat, it
     is cut off. A minority — owner-operators mostly — are not limited,
     which is what GOVERNED_SHARE leaves running. */
  const TAIL = { moto: 7.0, car: 4.0, rigid: 1.5, artic: 1.0 };
  const GOVERNED = { rigid: 72, artic: 70 };   // mph, the limiter
  const GOVERNED_SHARE = 0.75;                 // how many carry one

  function fromCurve(off, u, kind) {
    const q = u * 100;
    if (q <= PCT[0]) {
      const slope = (off[1] - off[0]) / (PCT[1] - PCT[0]);
      return off[0] + (q - PCT[0]) * slope;
    }
    for (let i = 0; i < PCT.length - 1; i++) {
      if (q <= PCT[i + 1]) {
        const f = (q - PCT[i]) / (PCT[i + 1] - PCT[i]);
        return off[i] + (off[i + 1] - off[i]) * f;
      }
    }
    const n = PCT.length - 1;
    const scale = TAIL[kind] != null ? TAIL[kind] : TAIL.car;
    // -ln of the remaining tail mass, which is 5% at q = 95 exactly.
    const rest = Math.max(1e-6, (100 - q) / (100 - PCT[n]));
    return off[n] + scale * -Math.log(rest);
  }

  /* Desired speed in m/s. `u` is the driver's own uniform draw, kept for
     its life — a driver who is quick is quick all the way down the road,
     not re-rolled every tick. */
  function desiredSpeed(kind, px, when, st, u, gu) {
    const lim = limitFor(kind, px, st);
    const off = offsets(when);
    let mph = lim + (off ? fromCurve(off, u, kind) : 0);

    /* Lorries run about 5 mph slower than cars at the same place and
       time — MEASURED, I-294, BEHAVIOUR.md §2. Motorcycles are not
       measured separately for speed anywhere on this corridor: the
       length table and the speed table are never crossed. They are
       treated as cars, which is the conservative choice; the fat tail
       above is where the bike that goes past you at 120 comes from. */
    if (kind === "rigid" || kind === "artic") mph -= TRUCK_SLOWER;

    /* The limiter. `gu` is the vehicle's own draw for whether it carries
       one, kept with it like every other trait. */
    const gov = GOVERNED[kind];
    if (gov != null && (gu == null || gu < GOVERNED_SHARE)) mph = Math.min(mph, gov);

    // Nobody crawls. The measured p15 at 04:00 is 11.5 under the sign
    // and this floor sits well below that, so it only ever catches the
    // extrapolated tail.
    return Math.max(25, mph) * MPH;
  }

  /* ── who is driving ───────────────────────────────────────────────────
     Drawn once when the vehicle spawns and never re-rolled: that is what
     makes traffic readable. The same car behaves the same way twice, and
     a driver who let you in once is the sort that will again.

     MEASURED rows carry a source. DECIDED rows are choices — no dataset
     records why a car moved — and they are, together, the entire
     personality of the road. PLAN.md §5c argues each of them.

     `speedU` is the one draw that must be kept rather than recomputed:
     desired speed follows the limit down the corridor, so a driver who
     sits at p85 keeps sitting at p85 when the sign changes. */
  const SIGNAL = { none: 0.48, late: 0.26, proper: 0.26 };  // MEASURED, cited

  /* How long the thing is, in metres, which is the one trait that is a
     fact about the vehicle rather than about the driver — and the sim
     cannot compute a gap without it.

     ── these are the vehicles, not the detections ────────────────────
     (Ric, 2026-08-12: "make the sizes of the car real life
     proportions." PLAN.md had this flagged as his call, so this is the
     answer to it.)

     BEHAVIOUR.md §2 measures cars at a median of 6.0 m and lorries at
     20.0. Those numbers are honest and they are not vehicle lengths.
     Both come off overhead trajectory data, where what is measured is a
     tracked BOUNDING BOX — the box a tracker draws round a moving blob
     is bigger than the sheet metal inside it, and the error is a roughly
     constant additive one because it is the tracker's footprint rather
     than the vehicle's. There is no car sold in America with a median
     length of 6.0 m: a Camry is 4.88, a RAV4 4.60, a Civic 4.68, and the
     longest ordinary thing in the light-vehicle bin is a crew-cab F-150
     at 6.2. 6.0 was the *middle* of that distribution, which is the
     giveaway.

     It showed on the screen, because draw.js draws exactly what the
     model simulates: the car you drive is 4.65 m and every car around
     you was 29% longer than it. Real lengths, kerb to kerb, uniform over
     the span each class actually occupies on an Interstate:

       moto   1.9–2.5   a Grom is 1.76, a Gold Wing 2.62
       car    3.8–6.0   Mini 3.85 → crew-cab pickup 6.0; median 4.9, and
                        the American light-vehicle fleet really is half
                        SUV and pickup, which is what holds it up there
       rigid  6.4–12.2  FHWA's single-unit bin is a box van (7–8.5), a
                        dump truck (8–9.5), a school bus (10.7–13.7) and
                        a motorhome all at once. The top of the span is
                        the 40 ft federal single-unit limit, exactly.
       artic  19.8–23.2 tractor plus semitrailer, OVERALL: a day cab on a
                        53 ft van is about 65 ft, a sleeper on the same
                        trailer 75 ft. Narrow on purpose — an artic is a
                        standardised object and the spread is which cab.

     What is kept from the measurement is the SHAPE of it. Every class
     keeps its relative spread to within a percentage point — car 23.3%
     of its median before and 22.4% after, rigid 31.8 and 31.2, artic
     8.0 and 7.9 — so the distributions are the measured ones slid, not
     redrawn. Car and rigid both come down by about the same absolute
     amount, 1.1 m and 1.7 m, which is what a constant tracker footprint
     looks like when you take it off, and their ratio to each other
     barely moves (1.83 to 1.90).

     **The artic does not follow that rule and should not.** It goes UP,
     20.0 to 21.5, so the artic-to-car ratio moves by a third. That is
     not an inconsistency: 20.0 is the one figure BEHAVIOUR.md itself
     says to distrust, because both datasets round to it exactly and a
     number two datasets agree on to three digits is a nominal, not a
     measurement. There is nothing to subtract a tracker's error from.
     It is set from the vehicle instead, and a 53 ft trailer under a
     sleeper cab is 75 ft over the ground. */
  const LENGTH = {                       // median, half-spread, metres
    moto:  [2.2, 0.3], car:   [4.9, 1.1],
    rigid: [9.3, 2.9], artic: [21.5, 1.7],
  };

  function driver(kind, px, when, st, rng) {
    const r = rng || Math.random;
    const u = r();
    const gu = r();          // does this lorry carry a limiter

    /* Signal habit. MEASURED: 48% of lane changes are made with no
       indicator at all (Ponziani SAE 2012-01-0261, 12,000 vehicles;
       NHTSA's naturalistic study independently 44% signalled). Of those
       who do signal, about half light it after the car has started
       moving. BEHAVIOUR.md §3. */
    const s = r();
    const signal = s < SIGNAL.none ? "none"
                 : s < SIGNAL.none + SIGNAL.late ? "late" : "proper";

    /* Headway it will hold, seconds. MEASURED: free-flowing I-294,
       114,781 pairs — p15 0.71, median 1.50, p85 3.57. Drawn on the
       same curve shape as speed so the tailgaters are the tail. */
    const hu = r();
    const headwayS = hu < 0.15 ? 0.49 + (0.71 - 0.49) * (hu / 0.15)
                   : hu < 0.50 ? 0.71 + (1.50 - 0.71) * ((hu - 0.15) / 0.35)
                   : hu < 0.85 ? 1.50 + (3.57 - 1.50) * ((hu - 0.50) / 0.35)
                   : 3.57 + (5.83 - 3.57) * ((hu - 0.85) / 0.15);

    return {
      kind,
      /* MEASURED */
      speedU: u,
      govU: gu,
      governed: GOVERNED[kind] != null && gu < GOVERNED_SHARE,
      want: desiredSpeed(kind, px, when, st, u, gu),
      headway: headwayS,
      signal,

      /* DECIDED — PLAN.md §5c. Correlated with each other on purpose:
         the driver who tailgates is the same one who takes a tight gap
         and gives way to nobody, because that is one personality and not
         three independent dice. `push` is that personality, 0 patient to
         1 aggressive, and it is derived from the headway draw rather
         than rolled again. */
      push: 1 - Math.min(1, headwayS / 3.0),
      /* The gap it will accept to change lane, as a fraction of the
         headway it holds — always tighter, because people accept gaps
         they would not choose to sit in. This is the trait a mistake
         comes out of: drawn short enough, it will take a gap that was
         not there. */
      gap: 0.45 + 0.35 * r(),
      /* How hard `keep right` pulls. Lorries essentially do not use the
         left lane — MEASURED, 1.2% of lorry-seconds on a four-lane
         motorway with no restriction requiring it — so their discipline
         is drawn high and tight. */
      discipline: kind === "car" ? 0.25 + 0.75 * r() : 0.75 + 0.25 * r(),
      /* Whether `yield` exists for this driver at all. The player is not
         special: this is the whole of why one car moves over for you and
         the next never will. */
      polite: r() < 0.55,
      /* How far out the exit starts to bite, metres. Drawn very wide on
         purpose — some drivers are two miles out and some are still in
         the left lane at the gore, and one trait produces both the
         careful and the appalling. */
      exitLead: 240 + 3000 * Math.pow(r(), 1.6),
      /* Drawn LAST on purpose. Every draw above it keeps the position in
         the sequence it had before this trait existed, so the seeded
         populations the tests assert against did not move when it was
         added. See LENGTH — MEASURED in shape, real in scale. */
      length: (() => { const L = LENGTH[kind] || LENGTH.car;
                       return L[0] + L[1] * (r() * 2 - 1); })(),
    };
  }

  /* ── drawing a vehicle kind at a place and time ───────────────────────
     Sampling the mix. Kept beside `mix` rather than in the spawner so
     that the test can check the drawn population against the counted
     one over a large sample. */
  function drawKind(px, when, rng) {
    const m = mix(px, when);
    let u = (rng || Math.random)();
    for (const k of KINDS) { if ((u -= m[k]) < 0) return k; }
    return "car";
  }

  /* A small deterministic generator, so the tests are repeatable and so
     a run can one day be seeded. mulberry32. */
  function seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return {
    data: T,
    at, profile, norm,
    nearestCounter, shape,
    demand, lanes, perLane, headway,
    mix, drawKind,
    limitFor, desiredSpeed, offsets, fromCurve,
    driver, seeded,
    MPH, KINDS, PCT, TRUCK_SLOWER, SIGNAL, TAIL, GOVERNED, GOVERNED_SHARE,
    LENGTH,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Traffic;
