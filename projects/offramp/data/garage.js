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

    /* ══ and twenty more ═════════════════════════════════════════════
       (Ric, 2026-08-14: "make 15 more random cars and 5 more
       motorcycles. some of the more poular ones.")

       Chosen to be RECOGNISED — the cars somebody would actually name —
       and then spread so the ladder is not twenty ways of being fast.
       Half of these are slower than the Mustang. The Corolla is the
       best-selling car ever made and is here for the same reason the
       Camry is: most of what is around you on that road is one of them.

       Costs interleave with the sixteen above rather than stacking on
       the end, because `ALL` is sorted by cost and the order of that
       array IS the ladder.

       Every figure is the manufacturer's or a road test's. The engines
       are the real configurations, which is where most of the variety
       actually lands: this adds a straight-six, two V10s, a flat-six
       MOTORCYCLE and a parallel twin to a garage that was mostly
       inline-fours and V8s. */

    /* ── the ordinary half ─────────────────────────────────────────── */
    {
      id: "corolla",
      paint: "#c9ccd1",
      make: "Toyota", model: "Corolla", year: 2005,
      note: "fifty million of them cannot all be wrong",
      klass: "car", hp: 126, kg: 1200, len: 4.53, wide: 1.71,
      t60: 9.5, top: 115, stop: 135, latG: 0.78,
      cost: 3000,
      eng: { cyl: 4, layout: "i",     idle: 700, red: 6200 },
    },
    {
      id: "accord",
      paint: "#3c4a5a",
      make: "Honda", model: "Accord", year: 2008,
      note: "competent to the point of being invisible",
      klass: "car", hp: 190, kg: 1520, len: 4.85, wide: 1.85,
      t60: 8.0, top: 125, stop: 130, latG: 0.80,
      cost: 8000,
      eng: { cyl: 4, layout: "i",     idle: 700, red: 6800 },
    },
    {
      /* Body-on-frame, live axle, and the car every taxi and half the
         police departments in the country used until they stopped
         making it. Long, soft and heavy — it is the closest thing here
         to the F-150's problem in a saloon. */
      id: "crownvic",
      paint: "#e9e9e6",
      make: "Ford", model: "Crown Victoria", year: 2003,
      note: "a sofa with a body on frame under it",
      klass: "car", hp: 224, kg: 1810, len: 5.40, wide: 1.99,
      t60: 8.4, top: 120, stop: 145, latG: 0.75,
      cost: 11000,
      eng: { cyl: 8, layout: "v",     idle: 600, red: 5000 },
    },
    {
      /* Short, tall and narrow-tracked: the worst skidpad number in the
         garage by a distance, and it earns it. */
      id: "wrangler",
      paint: "#4a6b3a",
      make: "Jeep", model: "Wrangler", year: 2010,
      note: "superb everywhere except a road",
      klass: "car", hp: 202, kg: 1770, len: 4.22, wide: 1.87,
      t60: 8.4, top: 112, stop: 150, latG: 0.68,
      cost: 18000,
      eng: { cyl: 6, layout: "v",     idle: 700, red: 5600 },
      body: "suv",
    },
    {
      id: "silverado",
      paint: "#8a1f1f",
      make: "Chevrolet", model: "Silverado 1500", year: 2010,
      note: "the other half of every American car park",
      klass: "truck", hp: 315, kg: 2270, len: 5.83, wide: 2.03,
      t60: 7.0, top: 110, stop: 145, latG: 0.72,
      cost: 22000,
      eng: { cyl: 8, layout: "v",     idle: 600, red: 5600 },
      body: "pickup",
    },
    {
      /* The engine really does stop at rest, and the idle figure says
         so — 0 rpm, which `audioFrame` floors at 12 Hz rather than
         dividing by. It is the one row here that is silent standing
         still, and that is the correct behaviour rather than a bug. */
      id: "prius",
      paint: "#d8dce0",
      make: "Toyota", model: "Prius", year: 2010,
      note: "it is not trying to win and it is still here",
      klass: "car", hp: 134, kg: 1380, len: 4.46, wide: 1.75,
      t60: 9.8, top: 112, stop: 135, latG: 0.76,
      cost: 26000,
      eng: { cyl: 4, layout: "i",     idle: 0, red: 5200 },
    },
    {
      id: "mini",
      paint: "#c8102e",
      make: "Mini", model: "Cooper S", year: 2006,
      note: "3.63 m of it, and all four corners busy",
      klass: "car", hp: 168, kg: 1215, len: 3.63, wide: 1.69,
      t60: 6.9, top: 135, stop: 120, latG: 0.86,
      cost: 30000,
      eng: { cyl: 4, layout: "i",     idle: 750, red: 6800 },
    },
    {
      id: "gti",
      paint: "#1d1d20",
      make: "Volkswagen", model: "Golf GTI", year: 2010,
      note: "the answer to a question nobody has improved on",
      klass: "car", hp: 200, kg: 1390, len: 4.20, wide: 1.79,
      t60: 6.8, top: 130, stop: 120, latG: 0.87,
      cost: 36000,
      eng: { cyl: 4, layout: "i",     idle: 800, red: 6500 },
    },

    /* ── the ones people put posters of on walls ─────────────────────── */
    {
      /* 2JZ-GTE. A straight six, which is the only one in the garage and
         sounds like nothing else in it. */
      id: "supra",
      paint: "#e8b400",
      make: "Toyota", model: "Supra Turbo", year: 1997,
      note: "two turbos and an engine people buy on its own",
      klass: "car", hp: 320, kg: 1570, len: 4.51, wide: 1.81,
      t60: 4.9, top: 155, stop: 115, latG: 0.92,
      cost: 60000,
      eng: { cyl: 6, layout: "i",     idle: 700, red: 6800 },
      body: "coupe",
    },
    {
      /* S54, and it goes to eight thousand — the highest-revving car
         here by a thousand rpm. */
      id: "m3e46",
      paint: "#5c6b7a",
      make: "BMW", model: "M3", year: 2003,
      note: "the one everybody means when they say M3",
      klass: "car", hp: 333, kg: 1570, len: 4.49, wide: 1.78,
      t60: 4.8, top: 155, stop: 115, latG: 0.90,
      cost: 75000,
      eng: { cyl: 6, layout: "i",     idle: 700, red: 8000 },
      body: "coupe",
    },
    {
      id: "challenger",
      paint: "#d85a1a",
      make: "Dodge", model: "Challenger SRT8", year: 2010,
      note: "six litres of HEMI and no interest in corners",
      klass: "car", hp: 425, kg: 1880, len: 5.02, wide: 1.92,
      t60: 4.9, top: 170, stop: 115, latG: 0.85,
      cost: 95000,
      eng: { cyl: 8, layout: "v",     idle: 650, red: 6200 },
      body: "coupe",
    },
    {
      id: "camaro",
      paint: "#f2c200",
      make: "Chevrolet", model: "Camaro SS", year: 2011,
      note: "the LS3, in the car it was always going to end up in",
      klass: "car", hp: 426, kg: 1750, len: 4.84, wide: 1.92,
      t60: 4.7, top: 155, stop: 110, latG: 0.90,
      cost: 105000,
      eng: { cyl: 8, layout: "v",     idle: 650, red: 6600 },
      body: "coupe",
    },
    {
      id: "f430",
      paint: "#c0140f",
      make: "Ferrari", model: "F430", year: 2007,
      note: "8,500 rpm, and it wants all of them",
      klass: "car", hp: 483, kg: 1450, len: 4.51, wide: 1.92,
      t60: 3.9, top: 196, stop: 105, latG: 0.98,
      cost: 210000,
      eng: { cyl: 8, layout: "v",     idle: 900, red: 8500 },
      body: "coupe",
    },
    {
      id: "r8",
      paint: "#9aa3ad",
      make: "Audi", model: "R8 V10", year: 2010,
      note: "ten cylinders behind your head, driving all four",
      klass: "car", hp: 525, kg: 1660, len: 4.43, wide: 1.90,
      t60: 3.7, top: 196, stop: 105, latG: 0.98,
      cost: 240000,
      eng: { cyl: 10, layout: "v",    idle: 800, red: 8700 },
      body: "coupe",
    },
    {
      id: "gallardo",
      paint: "#c8e020",
      make: "Lamborghini", model: "Gallardo LP560-4", year: 2008,
      note: "5.2 litres, ten cylinders, and no manners at all",
      klass: "car", hp: 552, kg: 1500, len: 4.39, wide: 1.90,
      t60: 3.4, top: 202, stop: 100, latG: 1.00,
      cost: 320000,
      eng: { cyl: 10, layout: "v",    idle: 900, red: 8000 },
      body: "coupe",
    },

    /* ── five more motorcycles ───────────────────────────────────────
       The Grom was the obvious popular pick and is not here, because it
       tops out around 58 mph — under the minimum on most of this road,
       and `derive` says exactly why it cannot be in the table: a top
       speed below 60 makes `artanh(60/vTop)` undefined. The file's own
       note on that is right that such a vehicle "does not belong on an
       Interstate anyway". The Rebel is the cheap one instead. */
    {
      id: "rebel",
      paint: "#1a1a1c",
      make: "Honda", model: "Rebel 500", year: 2018,
      note: "the one everybody actually learns on",
      klass: "bike", hp: 45, kg: 191, len: 2.21, wide: 0.82,
      t60: 5.5, top: 95, stop: 140, latG: 0.80,
      cost: 40000,
      eng: { cyl: 2, layout: "i",     idle: 1200, red: 8500 },
      body: "cruiser",
    },
    {
      /* An L-twin: 90 degrees, firing at 270 and 450. Not as lopsided as
         the Harley's 315/405 and nothing like an even four either. */
      id: "monster",
      paint: "#b81414",
      make: "Ducati", model: "Monster 796", year: 2012,
      note: "no fairing, no excuses, and a dry clutch's worth of noise",
      klass: "bike", hp: 87, kg: 167, len: 2.10, wide: 0.81,
      t60: 3.5, top: 130, stop: 135, latG: 0.95,
      cost: 90000,
      eng: { cyl: 2, layout: "vtwin", idle: 1100, red: 9500 },
      body: "sport",
    },
    {
      /* A flat SIX, on a motorcycle, and the only one in the garage —
         1.8 litres of it, turbine-smooth, in a 421 kg tourer that is
         heavier than the Fortwo is light. */
      id: "goldwing",
      paint: "#7a1420",
      make: "Honda", model: "Gold Wing", year: 2015,
      note: "421 kg, six cylinders, and a boot",
      klass: "bike", hp: 118, kg: 421, len: 2.63, wide: 0.94,
      t60: 4.4, top: 125, stop: 145, latG: 0.72,
      cost: 115000,
      eng: { cyl: 6, layout: "flat",  idle: 800, red: 6000 },
      body: "cruiser",
    },
    {
      id: "zx10r",
      paint: "#3fa02f",
      make: "Kawasaki", model: "Ninja ZX-10R", year: 2016,
      note: "a superbike with the numbers to prove it",
      klass: "bike", hp: 197, kg: 206, len: 2.07, wide: 0.74,
      t60: 3.0, top: 186, stop: 130, latG: 1.00,
      cost: 160000,
      eng: { cyl: 4, layout: "i",     idle: 1200, red: 14000 },
      body: "sport",
    },
    {
      /* The crossplane crank — a four that fires unevenly on purpose,
         which is why it sounds like a V-twin having a very good day.
         `vtwin` is the closer of the two mixes for that reason, and it
         is the one place in this table where the layout field is set for
         the FIRING ORDER rather than the cylinder arrangement. */
      id: "r1",
      paint: "#2b4fa0",
      make: "Yamaha", model: "YZF-R1", year: 2015,
      note: "a crossplane four, which is a four pretending otherwise",
      klass: "bike", hp: 197, kg: 199, len: 2.06, wide: 0.69,
      t60: 2.9, top: 186, stop: 130, latG: 1.02,
      cost: 175000,
      eng: { cyl: 4, layout: "vtwin", idle: 1250, red: 14000 },
      body: "sport",
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
