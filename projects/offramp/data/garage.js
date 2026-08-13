/* ══════════════════════════════════════════════════════════════════════
   THE GARAGE — what you can drive, as data.

   Ten vehicles, one row each, and a row holds ONLY THINGS YOU COULD LOOK
   UP. Power, kerb weight, 0–60 mph, top speed, 60–0 stopping distance,
   skidpad grip: every one of those is a figure a magazine printed about
   a real car. Nothing in the table is a game constant that somebody tuned
   until it felt right.

   The rates the drive model actually wants — km/h per second of pull,
   km/h per second of brake, px/s of steering — are DERIVED from those
   figures at the bottom of this file. That split is the whole point:

     · to add a car, you look up six numbers and add a row
     · to change how a car drives, you argue with the magazine, not
       with a constant
     · and the test can drive each one and check it reproduces the
       0–60 and the top speed it claims, which `test/garage.test.js`
       does — so a wrong row fails rather than merely feeling odd

   ── the model everything is fitted to ─────────────────────────────────
   Longitudinal pull, in km/h per second, at road speed v:

       a(v) = a0 · (1 − (v / vTop)²)

   Near-constant while the tyres and the gearing are the limit, falling
   away to exactly zero at the top speed. That last part matters and is a
   change: the old car had a constant pull and a CLAMP at 220 mph, so it
   arrived at its ceiling still accelerating hard and simply stopped. A
   real car spends its last 15 mph taking half a minute to find them, and
   the square term is drag, which is what actually takes them away.

   Integrating it gives the time to any speed in closed form,

       t(v) = (vTop / a0) · artanh(v / vTop)

   so a0 falls straight out of a published 0–60 with no fitting loop:

       a0 = (vTop / t60) · artanh(v60 / vTop)

   ── the numbers this produces are sane, which is the check ────────────
   Nothing below asked for a particular launch g. They are what the
   published 0–60 times imply, and they land where they should:

     | vehicle        | implied a0 | in g  | plausible?              |
     |----------------|-----------:|------:|-------------------------|
     | Jetta 2.0      |       9.7  |  0.28 | yes — 115 hp            |
     | Corvette Z06   |      26.9  |  0.76 | yes — 505 hp, rear wheel|
     | 911 Turbo blt  |      35.5  |  1.01 | yes — awd, launches     |
     | S1000RR        |      34.5  |  0.98 | yes — wheelie-limited   |

   A rear-drive car cannot beat about 0.8 g off the line without cheating
   and an all-wheel-drive car can just about reach 1.0; a superbike is
   held to about the same by the front wheel coming up rather than by
   grip. Four independent rows, four right answers, from arithmetic that
   was never shown the target. That is the reason to derive rather than
   to tune.

   ── everything gets slower, and that is correct ───────────────────────
   The car this replaces pulled 56 km/h/s — 1.6 g, from a standstill, in
   a family hatchback — and stopped at 132 km/h/s, which is 3.7 g and
   about triple what any tyre has ever done. The fastest thing in this
   garage pulls 35.5 and the hardest-stopping one stops at 44.

   So braking distances roughly QUADRUPLE. That is the single biggest
   change to how the game plays, and it is the one PLAN.md §2 has been
   waiting for: "arriving at the back of one at speed is the best hazard
   this game has ever had and it was never once used in play." It was
   never used because you could stop from 150 mph in about forty metres.
   ══════════════════════════════════════════════════════════════════════ */

const Garage = (() => {
  "use strict";

  const KMH_PER_MPH = 1.609344;
  const G = 9.80665;                       // m/s², for the stopping maths
  const MPH60 = 60 * KMH_PER_MPH;          // 96.5606 km/h
  const FT = 0.3048;

  const artanh = (x) => 0.5 * Math.log((1 + x) / (1 - x));

  /* ══════════════════════════════════════════════════════════════════
     the rows

     `t60`   0–60 mph in seconds
     `top`   top speed in mph — the real one. Where a car is limited
             rather than exhausted, the limiter is the figure, because
             the limiter is what you would meet.
     `stop`  60–0 mph in feet
     `latG`  steady-state skidpad, in g
     `kg`    kerb weight
     `cost`  banked points to unlock. 0 means you start with it.

     `body`  WHICH DRAWING, where the class is not enough. A Mustang and
             a Jetta are both `klass: "car"` and both drive like one, and
             from above one is a long bonnet with a short cabin and the
             other is neither. Optional: `klass` is the fallback and is
             right for most rows. draw.js owns the list.

     `eng`   WHAT IT SOUNDS LIKE, and it is not a mood setting — it is
             the engine's real configuration, because that is what
             decides the note:

               cyl      cylinders
               layout   "i" | "flat" | "v" | "vtwin"
               idle     rpm at rest
               red      rpm at the limiter

             A four-stroke fires cyl/2 times per revolution, so the
             fundamental you hear is rpm/60 · cyl/2 and NOT a number
             anybody gets to choose. A Harley at 2,000 rpm is 33 Hz, an
             S1000RR at 14,200 is 473, and the reason they sound like
             different machines rather than the same machine at
             different speeds is that ratio and the firing interval,
             both of which are in this table. See `audioFrame`.
     ══════════════════════════════════════════════════════════════════ */
  const ROWS = [
    {
      id: "jetta",
      paint: "#9aa3ad",
      make: "Volkswagen", model: "Jetta 2.0", year: 2001,
      note: "eight valves, and every one of them tired",
      klass: "car", hp: 115, kg: 1300, len: 4.38, wide: 1.74,
      t60: 10.9, top: 120, stop: 135, latG: 0.78,
      cost: 0,
      eng: { cyl: 4, layout: "i",     idle: 800, red: 6000 },
    },
    {
      id: "civic",
      paint: "#2f6fb5",
      make: "Honda", model: "Civic Si", year: 2004,
      note: "does nothing at all until it does",
      klass: "car", hp: 197, kg: 1270, len: 4.14, wide: 1.72,
      t60: 7.4, top: 127, stop: 130, latG: 0.85,
      cost: 6000,
      eng: { cyl: 4, layout: "i",     idle: 850, red: 8000 },
    },
    {
      /* The pickup. Two and a half tonnes of it, and the mass is the
         reason it is here rather than the power — `impact.js` is
         mass-based, so this shrugs off a contact that ends the Boxster
         and then cannot get round the ramp afterwards. */
      id: "f150",
      paint: "#2b3a52",
      make: "Ford", model: "F-150 5.0", year: 2014,
      note: "wins every argument except the one with the corner",
      klass: "truck", hp: 400, kg: 2400, len: 5.89, wide: 2.03,
      t60: 6.5, top: 110, stop: 140, latG: 0.72,
      cost: 15000,
      eng: { cyl: 8, layout: "v",     idle: 650, red: 6500 },
    },
    {
      id: "mustang",
      paint: "#c8102e",
      make: "Ford", model: "Mustang GT", year: 2005,
      note: "a live axle and a bad attitude",
      klass: "car", hp: 300, kg: 1600, len: 4.78, wide: 1.88,
      t60: 5.1, top: 150, stop: 120, latG: 0.85,
      cost: 32000,
      eng: { cyl: 8, layout: "v",     idle: 700, red: 6000 },
      body: "coupe",
    },
    {
      /* Slower to 60 than the Mustang and better than it everywhere
         else — mid-engined and 280 kg lighter. The ladder is
         deliberately not one number going up. */
      id: "boxster",
      paint: "#d8d5cc",
      make: "Porsche", model: "Boxster S", year: 2001,
      note: "the engine is behind you and it shows",
      klass: "car", hp: 250, kg: 1320, len: 4.32, wide: 1.78,
      t60: 5.4, top: 161, stop: 110, latG: 0.93,
      cost: 55000,
      eng: { cyl: 6, layout: "flat",  idle: 800, red: 7200 },
      body: "coupe",
    },
    {
      /* 155 mph is the gentlemen's limiter, not the car's ability —
         derestricted it runs to about 186. The limiter is the figure
         because the limiter is what you would actually meet, and a
         saloon that stops pulling at 155 while everything around it
         keeps going is a fact worth feeling. */
      id: "m5",
      paint: "#28313d",
      make: "BMW", model: "M5", year: 2001,
      note: "a saloon that is lying to you",
      klass: "car", hp: 394, kg: 1795, len: 4.78, wide: 1.80,
      t60: 4.8, top: 155, stop: 120, latG: 0.87,
      cost: 85000,
      eng: { cyl: 8, layout: "v",     idle: 700, red: 7000 },
    },
    {
      id: "z06",
      paint: "#e8b400",
      make: "Chevrolet", model: "Corvette Z06", year: 2006,
      note: "seven litres, no apology, no safety net",
      klass: "car", hp: 505, kg: 1420, len: 4.46, wide: 1.93,
      t60: 3.7, top: 198, stop: 105, latG: 1.04,
      cost: 130000,
      eng: { cyl: 8, layout: "v",     idle: 650, red: 7000 },
      body: "coupe",
    },
    {
      id: "gtr",
      paint: "#8f959e",
      make: "Nissan", model: "GT-R", year: 2009,
      note: "all-wheel drive, and it forgives you",
      klass: "car", hp: 545, kg: 1740, len: 4.65, wide: 1.90,
      t60: 3.2, top: 196, stop: 105, latG: 0.96,
      cost: 190000,
      eng: { cyl: 6, layout: "v",     idle: 800, red: 7000 },
      body: "coupe",
    },
    {
      /* Built rather than stock: a 997 Turbo runs 480 hp and 193 mph as
         it left Zuffenhausen, and this one has been got at. */
      id: "911",
      paint: "#d94b3a",
      make: "Porsche", model: "911 Turbo", year: 2007,
      note: "built — 700 hp through all four",
      klass: "car", hp: 700, kg: 1585, len: 4.45, wide: 1.85,
      t60: 2.8, top: 205, stop: 100, latG: 1.00,
      cost: 280000,
      eng: { cyl: 6, layout: "flat",  idle: 800, red: 6750 },
      body: "coupe",
    },
    {
      /* Last on purpose, and not because it is the best. It is 197 kg
         against everything else's tonne and a half, so `impact.js` will
         kill you in a contact a car would not even report — the thing
         you unlock at the end is the thing most likely to end a run.
         Nothing bike-specific is written anywhere: the mass does it. */
      id: "s1000rr",
      paint: "#e8e4d8",
      make: "BMW", model: "S1000RR", year: 2019,
      note: "197 kg, and nothing at all between you and it",
      klass: "bike", hp: 199, kg: 197, len: 2.05, wide: 0.83,
      t60: 2.9, top: 188, stop: 130, latG: 1.00,
      cost: 400000,
      eng: { cyl: 4, layout: "i",     idle: 1300, red: 14200 },
      body: "sport",
    },

    /* ══ the second half of the garage ═══════════════════════════════
       (Ric, 2026-08-13: "add like 5 more cars some sporty some normal
       some weird ones. and add another motorcycle.")

       Slotted into the existing ladder by cost rather than appended,
       because the ladder is the progression and a row nobody reaches
       until after the 911 is a row nobody drives. What they are FOR is
       spread: the Smart is 2.69 m and 750 kg where the F-150 is 5.89 m
       and 2,400, the Bus does 0-60 in half a minute, and the Road King
       is the first thing here with an uneven firing interval. Every
       figure is the manufacturer's or a road test's, same as the ten
       above — nothing is tuned to feel like anything. */
    {
      /* Slow, and the point of it. 1.25 tonnes of nothing at all with a
         skidpad number that embarrasses the Mustang: the ladder is not
         one axis, and this is the clearest statement of that in it. */
      id: "miata",
      paint: "#1c5c3a",
      make: "Mazda", model: "MX-5", year: 2001,
      note: "no power anywhere, and it does not need any",
      klass: "car", hp: 142, kg: 1065, len: 3.95, wide: 1.68,
      t60: 7.8, top: 127, stop: 125, latG: 0.90,
      cost: 9000,
      eng: { cyl: 4, layout: "i",     idle: 850, red: 7000 },
      body: "coupe",
    },
    {
      /* The weird one, and the slowest thing that has ever been on this
         road: twenty-six seconds to sixty and a governed 65, which on an
         Interstate where the traffic model runs 70-80 makes you the
         obstacle rather than the driver. That is a completely different
         game on the same map and it costs almost nothing to unlock. */
      id: "bus",
      paint: "#d8703c",
      make: "Volkswagen", model: "Type 2", year: 1971,
      note: "you are the slow lane now",
      klass: "van", hp: 60, kg: 1200, len: 4.51, wide: 1.72,
      t60: 26.0, top: 65, stop: 165, latG: 0.62,
      cost: 12000,
      eng: { cyl: 4, layout: "flat",  idle: 750, red: 4200 },
      body: "van",
    },
    {
      /* The other weird one, from the opposite end: 2.69 m long, which
         is shorter than a motorcycle is long twice over, and 750 kg.
         It fits gaps nothing else fits and `impact.js` will not be kind
         about the ones it does not. A three-cylinder, so it is also the
         only odd-firing car here. */
      id: "smart",
      paint: "#e0dcd2",
      make: "Smart", model: "Fortwo", year: 2008,
      note: "two seats, three cylinders, no bonnet",
      klass: "car", hp: 70, kg: 750, len: 2.69, wide: 1.56,
      t60: 12.8, top: 90, stop: 140, latG: 0.75,
      cost: 20000,
      eng: { cyl: 3, layout: "i",     idle: 900, red: 5800 },
      body: "micro",
    },
    {
      /* The normal one, and the garage needs one: a car that is neither
         fast nor interesting nor bad, in the middle of every column.
         It is what most of the traffic around you actually is. */
      id: "camry",
      paint: "#8d939b",
      make: "Toyota", model: "Camry", year: 2012,
      note: "the most reasonable object on this road",
      klass: "car", hp: 178, kg: 1470, len: 4.80, wide: 1.82,
      t60: 9.0, top: 115, stop: 130, latG: 0.78,
      cost: 24000,
      eng: { cyl: 4, layout: "i",     idle: 700, red: 6200 },
    },
    {
      /* Sporty, and the only flat-four here — the boxer's uneven exhaust
         pulse is the whole reason you can identify one from a street
         away, and `audioFrame` now has the firing interval to do it. */
      id: "sti",
      paint: "#2a5fa8",
      make: "Subaru", model: "Impreza WRX STI", year: 2005,
      note: "all four driven, all four complaining",
      klass: "car", hp: 300, kg: 1470, len: 4.47, wide: 1.73,
      t60: 4.8, top: 158, stop: 115, latG: 0.93,
      cost: 68000,
      eng: { cyl: 4, layout: "flat",  idle: 800, red: 7000 },
    },
    {
      /* The second motorcycle, and deliberately the opposite of the
         first one. 376 kg against the S1000RR's 197, a 45-degree V-twin
         with a 315/405 firing interval instead of an even inline four,
         and 5,500 rpm against 14,200. It is a different SHAPE on the
         screen and a different sound out of it, which is what makes it
         worth having two. */
      id: "roadking",
      paint: "#1d2b3a",
      make: "Harley-Davidson", model: "Road King", year: 2015,
      note: "forty-five degrees, and it wants you to know",
      klass: "bike", hp: 86, kg: 376, len: 2.43, wide: 0.96,
      t60: 5.1, top: 110, stop: 145, latG: 0.75,
      cost: 150000,
      eng: { cyl: 2, layout: "vtwin", idle: 950, red: 5500 },
      body: "cruiser",
    },
  ];

  /* ── the semi is not here yet, and this is the note that says so ────
     A tractor unit is a different game rather than a different row:
     15,000 kg loaded, 0–60 in about twenty seconds, 75 mph governed,
     and §7a's 20 mph minimum ramp radius stops being a comfort figure
     and starts closing exits to you. It also puts a mass ten times
     anything `impact.js` has been tested against into the solver.
     Scheduled after the menu and the points, agreed with Ric. */

  /* ══════════════════════════════════════════════════════════════════
     the derivation

     Six published figures in, four model rates out, and every line of
     it is either a unit conversion or the closed-form integral from the
     header. There is no free parameter in this function.
     ══════════════════════════════════════════════════════════════════ */
  function derive(r) {
    const vTop = r.top * KMH_PER_MPH;              // km/h

    /* a0 from the published 0–60. If a car's quoted top speed were ever
       below 60 mph this would blow up; none is, and a vehicle that slow
       does not belong on an Interstate anyway. */
    const a0 = (vTop / r.t60) * artanh(MPH60 / vTop);

    /* Braking, from the published 60–0 distance. Constant-deceleration
       is the standard reading of that figure, so it inverts cleanly:
       a = v² / 2d, in m/s², then into km/h per second like every other
       longitudinal rate in this game. */
    const v60 = MPH60 / 3.6;                       // m/s
    const decel = (v60 * v60) / (2 * r.stop * FT); // m/s²
    const brake = decel * 3.6;                     // km/h per second

    /* Steering authority. THIS ONE IS A MODELLING CHOICE, not physics,
       and it is worth being honest about which is which: `latMax` is a
       lateral VELOCITY the wheel commands, not an acceleration, so
       scaling it by skidpad g is an assertion that a grippier car lets
       you ask for more sideways — defensible, and not derivable.

       The reference is 0.85 g, which is where the old single car sat,
       so a mid-pack row reproduces exactly how the game drove before
       there was a garage. */
    const lat = r.latG / 0.85;

    /* And how quickly the wheel is answered. Lighter cars change
       direction sooner; a two-and-a-half tonne pickup does not. Scaled
       off the reference 1500 kg and held inside a band, because a
       200 kg bike answering seven times faster than a car would be a
       twitch rather than a motorcycle. */
    const respond = Math.max(0.55, Math.min(1.5, Math.sqrt(1500 / r.kg)));

    /* Yaw inertia, from the body's real dimensions rather than scaled
       off the reference by mass.

       impact.js's own note derives Iz ≈ 0.8·m·(L²+W²)/12 for the
       player's 4.65 × 1.97 m body, gets 2550, observes that measured
       sedans come in at 2000–2500, and uses 2200 directly. That last
       step is an empirical correction of 0.863, so it is folded into
       the coefficient here — 0.8 × 0.863 = 0.69 — and the formula then
       reproduces impact.js's 2200 exactly for a body of those
       dimensions. Check that before changing it.

       Doing it from dimensions rather than from mass matters most for
       the two extremes: the F-150 is 5.89 m long and resists being
       spun far harder than its mass alone implies, and the motorcycle
       at 2.05 m has almost no yaw inertia at all. */
    const Iz = 0.69 * r.kg * (r.len * r.len + r.wide * r.wide) / 12;

    return {
      ...r,
      vTop, a0, brake, decelG: decel / G, Iz,
      latScale: lat, respondScale: respond,
      topMph: r.top,
      topKmh: vTop,
    };
  }

  /* Sorted by cost, because the order of this array IS the ladder —
     it is what the garage lists and what `Progress.next()` walks. The
     rows are written in the file in the order they were added, which
     stopped being the order you unlock them the moment a row was
     slotted between two existing ones. */
  const ALL = ROWS.map(derive).sort((a, b) => a.cost - b.cost);
  const BY_ID = Object.fromEntries(ALL.map((c) => [c.id, c]));

  const DEFAULT = "jetta";

  return {
    ALL, BY_ID, DEFAULT,
    get: (id) => BY_ID[id] || BY_ID[DEFAULT],
    ids: () => ALL.map((c) => c.id),
    KMH_PER_MPH,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Garage;
