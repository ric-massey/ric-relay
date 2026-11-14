/* WORLD BUILDER — THE PHYSICS SANDBOX
   ────────────────────────────────────────────────────────────────────────
   A world made of hexagons, and a panel of settings that decide what its
   physics is. Every setting is a real term in the step below: turn gravity up
   and the pull between every pair of hexagons is that much stronger, turn
   chemistry off and nothing ever bonds. Nothing is scripted — a planet, a
   crystal or an orbit only turns up if the settings make one.

   What a hexagon is here: a body with a mass, a position, a velocity and some
   heat. Whether that is an atom or a planet is the visitor's choice of
   settings, not a different engine.

   This is a toy, not the Universe project (projects/universe/). That one runs
   on integers, asserts conservation to the unit and refuses a constant nobody
   chose. This one runs on floats and lets anybody choose anything, which is
   exactly what that project forbids — so it shares no code with it. Two ideas
   are borrowed from it, and credited in README.md: the bonding rule that reads
   a strength off two kinds by arithmetic rather than a table, and "matter is
   the sum of kinds", which is what lets two bodies fuse.

   One file, no dependencies, the same in a browser and in node (the tests in
   test/ run it there). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WBPhysics = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ── the settings ─────────────────────────────────────────────────────────
     One list. The page builds its controls from it, the engine reads the same
     keys, and the test walks every one — so a setting cannot exist on the page
     without doing something here. `say` turns a number into the words shown
     beside the slider. */
  const pct = v => Math.round(v * 100) + "%";
  const off = (words) => v => (v === 0 ? "off" : words(v));
  const SCHEMA = [
    { title: "The world", items: [
      { key: "size", label: "World size", type: "range", min: 40, max: 400, step: 10, def: 140,
        say: v => v + " hexagons across",
        help: "How wide the world is, measured in the smallest hexagon." },
      { key: "edge", label: "At the edge", type: "select", def: "wrap",
        options: [["wrap", "It loops round"], ["walls", "Walls — things bounce"], ["open", "Nothing — things leave"]],
        help: "What happens to something that reaches the side of the world." },
      { key: "seed", label: "Seed", type: "range", min: 1, max: 9999, step: 1, def: 7,
        say: v => "#" + v, help: "The same seed and settings start the same world." },
    ]},
    { title: "Matter", items: [
      { key: "count", label: "How many hexagons", type: "range", min: 2, max: 4000, step: 1, def: 900, curve: 2.2,
        say: v => v.toLocaleString("en-US"), help: "How many bodies the world starts with." },
      { key: "kinds", label: "How many kinds", type: "range", min: 1, max: 8, step: 1, def: 4,
        say: v => (v === 1 ? "one kind" : v + " kinds"),
        help: "Kind 1 is the lightest. A hexagon of kind 3 has three times its mass." },
      { key: "mix", when: s => s.kinds > 1, label: "Mix of kinds", type: "select", def: "light",
        options: [["equal", "Equal amounts"], ["light", "Mostly light"], ["heavy", "Mostly heavy"]] },
      { key: "sized", label: "Heavier is bigger", type: "toggle", def: true,
        help: "Off, every hexagon is the same size whatever it weighs." },
      { key: "layout", label: "How it starts", type: "select", def: "scatter",
        options: [["scatter", "Scattered everywhere"], ["cloud", "One cloud"], ["spin", "A spinning disc"],
                  ["two", "Two clouds on course to meet"], ["sun", "One big body and a ring of dust"],
                  ["empty", "Empty — I will build it myself"]],
        help: "An empty world starts with nothing in it. Use Place and Throw once it is running." },
      { key: "bigMass", when: s => s.layout === "sun", label: "The big body's mass", type: "range", min: 20, max: 3000, step: 10, def: 600, curve: 2,
        say: v => v + "× the smallest", help: "Only used when it starts as one big body and a ring." },
      { key: "spin", when: s => s.layout === "spin" || s.layout === "sun", label: "Starting spin", type: "range", min: 0, max: 1.5, step: 0.05, def: 1,
        say: v => (v === 0 ? "none" : v === 1 ? "just enough to orbit" : v < 1 ? pct(v) + " of orbit speed" : pct(v) + " — too fast to hold"),
        help: "For the disc and the ring. 100% is the speed at which gravity alone holds a circle." },
      { key: "startSpeed", label: "Starting speed", type: "range", min: 0, max: 12, step: 0.25, def: 1,
        say: off(v => v + (v === 1 ? " hexagon a second" : " hexagons a second")), help: "Random motion every hexagon starts with." },
    ]},
    { title: "Gravity", items: [
      { key: "gravity", label: "Pull between hexagons", type: "range", min: 0, max: 60, step: 0.1, def: 0, curve: 2.5,
        say: off(v => (v < 1 ? "faint" : v < 6 ? "noticeable" : v < 20 ? "strong" : "crushing") + " (" + v + ")"),
        help: "Every hexagon pulls every other, in proportion to both masses." },
      { key: "reach", when: s => s.gravity > 0, label: "How far it reaches", type: "select", def: "far",
        options: [["far", "Far — fades slowly with distance"], ["near", "Near — fades quickly"]],
        help: "Far falls off as 1/distance, which is what gravity does in a flat world. Near falls off as 1/distance²." },
      { key: "stick", label: "Everything sticks a little", type: "range", min: 0, max: 10, step: 0.05, def: 0, curve: 2,
        say: off(v => v + " energy to pull apart"),
        help: "A weak pull between any two hexagons close to touching, charged or not, the way even uncharged molecules cling (London's dispersion force). It reaches about half a hexagon past touching. Without it, nothing without a charge ever clumps." },
      { key: "fall", label: "Down", type: "range", min: 0, max: 30, step: 0.5, def: 0,
        say: off(v => v + " toward the bottom"), help: "A steady pull toward the bottom of the world, like standing on a planet. Give it walls." },
    ]},
    { title: "Collisions", items: [
      { key: "bounce", label: "Bounciness", type: "range", min: 0, max: 1, step: 0.05, def: 0.8,
        say: v => (v === 1 ? "perfect — nothing is lost" : v === 0 ? "none — a thud" : pct(v)),
        help: "What a collision does not give back as motion becomes heat." },
      { key: "fuse", label: "Fusing", type: "select", def: "never",
        options: [["never", "Never"], ["hard", "Only in a hard hit"], ["always", "Whenever two touch"]],
        help: "Two hexagons that fuse become one, with the mass of both." },
      { key: "fuseHit", when: s => s.fuse === "hard", label: "How hard a hit fuses", type: "range", min: 0.5, max: 200, step: 0.5, def: 20, curve: 2,
        say: v => v + " energy", help: "Only used when fusing needs a hard hit." },
      { key: "breaking", label: "Things can break apart", type: "toggle", def: true,
        help: "Hard hits can chip or split a body. Enough heat can make it shed pieces. Nothing disappears." },
      { key: "toughness", when: s => s.breaking, label: "Material strength", type: "range", min: 0.1, max: 100, step: 0.1, def: 8, curve: 2,
        say: v => v + " energy per unit of mass", help: "The energy it takes to free a piece. Stronger material survives harder hits and more heating." },
      { key: "fragmentMass", when: s => s.breaking, label: "Smallest fragment", type: "range", min: 0.1, max: 10, step: 0.1, def: 1,
        say: v => v + " mass", help: "Neither piece can be smaller than this. Raise it to keep the world from filling with dust." },
    ]},
    { title: "Chemistry", items: [
      { key: "bonding", label: "What bonds", type: "select", def: "none",
        options: [["none", "Nothing — no chemistry"], ["any", "Anything with anything"],
                  ["sum", "Pairs that add up"], ["same", "Only the same kind"], ["other", "Only different kinds"]],
        help: "“Pairs that add up”: each kind has a number, and two bond most strongly when their numbers add up to one more than the number of kinds." },
      { key: "bondStrength", when: s => s.bonding !== "none", label: "Bond strength", type: "range", min: 0.2, max: 40, step: 0.2, def: 6, curve: 2,
        say: v => v + " energy", help: "The energy a full-strength bond gives off as heat when it forms, and takes to break." },
      { key: "bondChance", when: s => s.bonding !== "none", label: "How readily they bond", type: "range", min: 0.01, max: 1, step: 0.01, def: 0.4,
        say: pct, help: "The chance that two hexagons that could bond do, each time they touch." },
      { key: "maxBonds", when: s => s.bonding !== "none", label: "Bonds per hexagon", type: "range", min: 1, max: 6, step: 1, def: 3,
        say: v => "up to " + v, help: "One makes pairs, two makes chains and rings, three or more makes sheets." },
      { key: "shift", when: s => s.bonding !== "none" && s.bonding !== "any", label: "A bond changes what it holds", type: "range", min: 0, max: 3, step: 1, def: 0,
        say: v => (v === 0 ? "no — a kind is always that kind" : "each bond moves a hexagon " + v + (v === 1 ? " kind" : " kinds") + " on"),
        help: "With this on, a hexagon that is already bonded bonds like a different kind — so what it is joined to decides what it joins next, and a new neighbour can knock an old one off. This is what lets things react instead of only stick." },
      { key: "angles", when: s => s.bonding !== "none", label: "Bonds hold an angle", type: "range", min: 0, max: 1, step: 0.05, def: 0,
        say: off(pct),
        help: "Off, a bond is a distance and nothing more, so a thing has no shape. On, every hexagon faces a way and its bonds sit in six slots 60° apart, so a chain holds its zig-zag, a ring stays a ring, and two hexagons held side by side stay in step. Higher is stiffer." },
      { key: "align", when: s => s.bonding !== "none" && s.angles > 0, label: "How closely they must line up", type: "range", min: 1, max: 30, step: 1, def: 30,
        say: v => (v >= 30 ? "any angle" : "within " + v + "°"),
        help: "A bond forms only when the slot each one would use is pointing near enough at the other. At 30° anything that touches can bond. A few degrees and a bond almost never happens by chance — but two hexagons that something else is already holding in place can still make one." },
      { key: "look", when: s => s.bonding !== "none" && s.bonding !== "any", label: "A bond reads the next one along", type: "range", min: 0, max: 3, step: 1, def: 0,
        say: v => (v === 0 ? "no — only the two that are touching" : "a neighbour's kind moves it " + v + (v === 1 ? " kind" : " kinds") + " on"),
        help: "On, what a hexagon bonds as depends on the KIND of the neighbour it already holds, not only on how many it holds. That is what lets a chain carry a sequence worth reading: the same kind offers a different site depending on what it sits next to." },
      { key: "bondSpeed", when: s => s.bonding !== "none" && !s.settle, label: "Too fast to bond", type: "range", min: 0.5, max: 30, step: 0.5, def: 6,
        say: v => "over " + v + " a second", help: "Two hexagons meeting faster than this bounce instead." },
      { key: "bondsPer", when: s => s.bonding !== "none", label: "Bonds per kind", type: "select", def: "same",
        options: [["same", "The same for every kind"], ["kind", "Set by the kind"]],
        help: "Set by the kind, each kind has its own number of bonds and its own pull, worked out from its number the way a row of the periodic table runs: kinds 1 to 7 take 1, 2, 3, 4, 3, 2, 1 bonds, so kind 1 caps a chain, kind 2 carries it on and kind 3 branches it. Pull rises along the row, and two kinds that pull very differently bond harder than two that pull alike. “Bonds per hexagon” still caps all of it." },
      { key: "settle", when: s => s.bonding !== "none", label: "Bonds settle with temperature", type: "toggle", def: false,
        help: "On, forming a bond and breaking it are the same step run backwards, paid for out of the heat of everything nearby, so a world settles where its temperature says it should: hot worlds hold fewer bonds, cold worlds more, by an amount you can work out. “How readily they bond” becomes how often two hexagons that are nearly touching try. Off, bonds form on impact and shake loose on their own pair's heat, as they always have." },
      { key: "barrier", when: s => s.bonding !== "none", label: "How hard a bond is to start", type: "range", min: 0, max: 30, step: 0.5, def: 0, curve: 2,
        say: off(v => v + " energy"),
        help: "Heat that has to be found before a bond can form or break, and is given straight back. It does not change which bonds win in the end, only how long it takes — so a bond can be worth making and still almost never happen. With bonds that hold an angle, two hexagons held already lined up have less of it to climb, which is how one thing can speed up the making of another." },
      { key: "charge", when: s => s.bonding !== "none", label: "Charge from bonds", type: "range", min: 0, max: 20, step: 0.1, def: 0, curve: 2,
        say: off(v => v + " energy at touching"),
        help: "Each kind pulls on what it shares with a bond by its number, kind 7 hardest. When two kinds that pull differently bond, the harder puller ends up a little negative and the other a little positive, and a thing's charges always add up to nothing. Charged hexagons that are not bonded to each other pull opposites together and push likes apart, out to about three hexagons. So what a thing does to its neighbours depends on what it is made of and what is bonded to what: two lopsided pairs stick, the same pieces paired like with like do not. Off, nothing carries a charge. This number is how hard the most unlike pair pulls when they touch." },
      { key: "ions", when: s => s.bonding !== "none" && s.charge > 0, label: "Whole charges can jump", type: "toggle", def: false,
        help: "Two free hexagons touching can pass a whole charge from one to the other, the way sodium hands one to chlorine. It costs less the more differently the two pull, and the pull between the two new charges pays the rest, so only very unlike kinds do it. An ion holds no bonds; it is held by charge alone. Every jump can go back the other way." },
      { key: "shapeBy", when: s => s.bonding !== "none" && s.angles > 0, label: "Shape set by the kind", type: "toggle", def: false,
        help: "Each kind's bonds spread out as evenly as six directions allow, counting the room its spare charge takes up too (the rule chemists call VSEPR): kind 2 is straight, kind 3 a Y, kind 4 a cross, kind 6 straight because its two spare pairs push its bonds apart. With “Double and triple bonds” the shape follows what it holds: kind 4 with a double bond goes to a flat Y, with two or a triple it goes straight. Off, a bond can use any free slot." },
      { key: "swap", when: s => s.bonding !== "none" && s.settle, label: "Pieces can be handed over", type: "toggle", def: false,
        help: "A hexagon touching one end of a bond can take that end over in one step, the old partner let go as the new one joins, instead of the bond having to come apart first. It is the way most real reactions go, and it is cheaper than breaking and remaking. It can always run back." },
      { key: "order", when: s => s.bonding !== "none" && s.settle, label: "Double and triple bonds", type: "toggle", def: false,
        help: "A bond between two hexagons with room to spare can become double, then triple: shorter, and worth 1.75 and 2.4 times a single bond, the way a carbon-carbon bond is. Each extra counts against both ends' bonds per kind, and it can step back down." },
      { key: "fuel", when: s => s.bonding !== "none", label: "Energy-rich pieces", type: "range", min: 0, max: 20, step: 0.5, def: 0, curve: 2,
        say: off(v => v + " energy each"),
        help: "Free hexagons are charged up from outside, now and then, with this much energy, and spend it the first time they bond: it makes that bond easier to make and harder to undo. That is what keeps a world from settling and stopping, the way food and sunlight do: without it a sealed world always comes to rest. It needs “How hard a bond is to start” to do much: with no barrier, bonds come and go so fast that a few charged-up pieces change nothing and their energy only warms the world; with one, only charged-up pieces get over it, and what they make stays made. Give it “Heat leaks away” too, or it heats up. Off, nothing arrives." },
      { key: "fuelRate", when: s => s.bonding !== "none" && s.fuel > 0, label: "How often they are charged", type: "range", min: 0.001, max: 1, step: 0.001, def: 0.01, curve: 2,
        say: v => v + " a second", help: "For each free hexagon not already charged up, the chance a second that it is." },
    ]},
    { title: "Heat", items: [
      { key: "startTemp", label: "Starting temperature", type: "range", min: 0, max: 40, step: 0.5, def: 0.5,
        say: v => (v === 0 ? "absolute zero" : String(v)), help: "Heat each hexagon starts with, per unit of mass." },
      { key: "meltTemp", when: s => s.breaking, label: "Hot enough to shed pieces", type: "range", min: 1, max: 100, step: 1, def: 20,
        say: v => v + " temperature", help: "Above this temperature, a body gradually sheds material. Far above it, larger pieces can break away. Size alone never breaks it." },
      { key: "shake", label: "Heat shakes things", type: "range", min: 0, max: 1, step: 0.05, def: 0.3,
        say: off(pct), help: "How quickly a hexagon's motion and its heat come to the same temperature: a hot one is shoved about, a fast one in cold surroundings is slowed and warms. Off, heat and motion never trade except in collisions." },
      { key: "conduct", label: "Heat spreads by touch", type: "range", min: 0, max: 1, step: 0.05, def: 0.4,
        say: off(pct), help: "How quickly heat moves between hexagons that touch or are bonded." },
      { key: "radiate", label: "Heat leaks away", type: "range", min: 0, max: 0.5, step: 0.005, def: 0.01, curve: 2,
        say: off(v => (v * 100).toFixed(1) + "% a second"), help: "How quickly every hexagon glows its heat off into nothing. This is how a world cools." },
      { key: "heater", label: "Something keeps it hot", type: "select", def: "none",
        options: [["none", "Nothing"], ["centre", "The middle of the world"], ["floor", "The bottom edge"]] },
      { key: "heaterTemp", when: s => s.heater !== "none", label: "How hot", type: "range", min: 1, max: 80, step: 1, def: 20,
        say: v => String(v), help: "The temperature the hot place is held at." },
    ]},
    { title: "Space and time", items: [
      { key: "drag", label: "Space is thick", type: "range", min: 0, max: 2, step: 0.02, def: 0, curve: 2,
        say: off(v => (v < 0.2 ? "a thin gas" : v < 0.8 ? "like water" : "like syrup")),
        help: "Slows everything down, all the time. The motion it takes is gone." },
      { key: "limit", label: "Speed limit", type: "range", min: 2, max: 200, step: 1, def: 60, curve: 2,
        say: v => v + " a second", help: "Nothing travels faster than this." },
      { key: "rate", label: "Clock", type: "range", min: 0.1, max: 4, step: 0.1, def: 1,
        say: v => v + "×", help: "How fast time runs. You can change this while it is running too." },
    ]},
  ];

  /* Sliders are a useful sweep, not the limits of an experiment (Ric,
     2026-11-12: "you can type one"). Keep actual limits on the schema too,
     so typed values and copied links survive the same clean() path. Counts
     and dimensions stay bounded for browser memory; fractions keep their
     meaning, and bond counts must fit nb's Uint8 storage. */
  const INPUT_LIMITS = {
    size: [4, 1000], count: [0, 20000], kinds: [1, 64], seed: [0, 4294967295],
    bigMass: [0.000001, 1e12], bounce: [0, 1], bondChance: [0, 1],
    maxBonds: [0, 255], shake: [0, 1], conduct: [0, 1], angles: [0, 1], align: [0.01, 30], look: [0, 64], barrier: [0, 1e6], charge: [0, 1e6],
    stick: [0, 1e6], fuel: [0, 1e6], fuelRate: [0, 100],
    limit: [0, 1e12], rate: [0.001, 100], toughness: [0.000001, 1e12], fragmentMass: [0.000001, 1e12]
  };
  const WHOLE = new Set(["count", "kinds", "seed", "maxBonds", "shift", "look"]);
  for (const g of SCHEMA) for (const it of g.items) if (it.type === "range") {
    [it.inputMin, it.inputMax] = INPUT_LIMITS[it.key] || [0, 1e12];
    it.integer = WHOLE.has(it.key);
  }

  const DEFAULTS = {};
  for (const g of SCHEMA) for (const it of g.items) DEFAULTS[it.key] = it.def;

  /* Presets set only what they care about; everything else is the default.
     Each one is a set of ticked boxes a visitor could have ticked themselves. */
  const PRESETS = [
    { id: "gas", name: "A box of gas", note: "Nothing but motion and bouncing.",
      set: { count: 700, kinds: 2, edge: "walls", startSpeed: 6, bounce: 1, startTemp: 0, shake: 0, radiate: 0 } },
    { id: "crystals", name: "Chemistry", note: "Warm matter that bonds as it cools.",
      set: { count: 1300, size: 70, kinds: 5, sized: false, bonding: "sum", bondStrength: 8, maxBonds: 3,
             startTemp: 3, startSpeed: 1.5, radiate: 0.05, bounce: 0.6 } },
    { id: "planets", name: "Hexagons as planets", note: "One sun, a ring of bodies, gravity and nothing else.",
      set: { layout: "sun", count: 260, size: 300, kinds: 3, edge: "open", gravity: 4, reach: "near", bigMass: 900,
             spin: 1, startSpeed: 0, bounce: 0.5, fuse: "always", startTemp: 0, shake: 0, radiate: 0.05 } },
    { id: "accretion", name: "Dust into worlds", note: "A spinning disc under strong gravity, fusing where it meets.",
      set: { layout: "spin", count: 1500, size: 260, kinds: 2, edge: "open", gravity: 0.6, spin: 0.9, startSpeed: 0.4,
             fuse: "always", bounce: 0.3, startTemp: 0, shake: 0, radiate: 0.05 } },
    { id: "collide", name: "Two clouds collide", note: "Gravity holds each together until they meet.",
      set: { layout: "two", count: 1200, size: 240, kinds: 3, edge: "open", gravity: 0.5, startSpeed: 3, bounce: 0.4,
             fuse: "hard", fuseHit: 30, shake: 0.2 } },
    { id: "break", name: "Things that break", note: "Two clouds meet. Hard hits chip what they cannot hold.",
      set: { layout: "two", count: 160, size: 100, kinds: 8, edge: "wrap", startSpeed: 12, startTemp: 0,
             bounce: 0.5, fuse: "always", toughness: 2, fragmentMass: 0.5, meltTemp: 15, shake: 0, radiate: 0.05 } },
    { id: "hot", name: "A hot body", note: "One hot body, shedding pieces as it cools.",
      set: { layout: "sun", count: 1, size: 80, bigMass: 200, startSpeed: 0, startTemp: 80,
             shake: 0, radiate: 0.02, meltTemp: 20, toughness: 8 } },
    { id: "react", name: "Things that react", note: "Each bond changes what a hexagon bonds with next, over a hot middle.",
      set: { count: 1200, size: 64, kinds: 5, sized: false, bonding: "sum", shift: 1, bondStrength: 7, maxBonds: 3, bondChance: 0.6,
             startTemp: 1.5, startSpeed: 1.5, radiate: 0.08, bounce: 0.6, heater: "centre", heaterTemp: 9, shake: 0.5, conduct: 0.5 } },
    { id: "blank", name: "A blank world", note: "Nothing in it. Place, throw and pin your own.",
      set: { layout: "empty", size: 60, kinds: 5, edge: "walls", bonding: "sum", shift: 1, bondStrength: 7, maxBonds: 3,
             bounce: 0.6, radiate: 0.03, startTemp: 0.5 } },
    { id: "ground", name: "A world with a floor", note: "Down, walls, a hot floor and things that bond.",
      set: { count: 900, size: 90, kinds: 4, edge: "walls", fall: 3, bounce: 0.3, bonding: "any", bondStrength: 4,
             maxBonds: 2, heater: "floor", heaterTemp: 12, shake: 0.6, conduct: 0.6, radiate: 0.15, startSpeed: 2 } },
    { id: "all", name: "Everything on", note: "Gravity, chemistry, heat and fusing at once.",
      set: { layout: "cloud", count: 1400, size: 220, kinds: 6, edge: "wrap", gravity: 0.25, bonding: "sum",
             bondStrength: 10, maxBonds: 4, fuse: "hard", fuseHit: 60, startTemp: 4, startSpeed: 2, radiate: 0.01 } },
  ];

  function clean(input) {
    const S = {};
    for (const g of SCHEMA) for (const it of g.items) {
      let v = input && it.key in input ? input[it.key] : it.def;
      if (it.type === "range") {
        v = typeof v === "string" && !v.trim() ? NaN : Number(v);
        if (!isFinite(v)) v = it.def;
        v = Math.min(it.inputMax, Math.max(it.inputMin, v));
        if (it.integer) v = Math.round(v);
      } else if (it.type === "toggle") {
        v = v === true || v === "true" || v === 1 || v === "1";
      } else if (!it.options.some(o => o[0] === v)) v = it.def;
      S[it.key] = v;
    }
    S.count = Math.round(S.count); S.kinds = Math.round(S.kinds);
    S.maxBonds = Math.round(S.maxBonds); S.seed = Math.round(S.seed);
    return S;
  }

  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* How strongly two kinds bond, 0 to 1. Arithmetic on the two kinds, never a
     table of cases — the Universe project's rule 4, and its law 2 is where
     "sum" comes from: B = M − |v₁ + v₂ − M|. A fused body's kind is its mass,
     so it goes through the same arithmetic by remainder. */
  function affinity(rule, k1, k2, kinds, s1, s2) {
    if (rule === "none") return 0;
    if (rule === "any") return 1;
    const M = kinds + 1;
    /* s1 and s2 are how far each has been moved on by the bonds it already
       holds (the "a bond changes what it holds" setting). Still arithmetic. */
    const v1 = ((k1 - 1 + (s1 || 0)) % kinds) + 1, v2 = ((k2 - 1 + (s2 || 0)) % kinds) + 1;
    if (rule === "same") return v1 === v2 ? 1 : 0;
    if (rule === "other") return v1 !== v2 ? 1 : 0;
    return Math.max(0, (M - Math.abs(v1 + v2 - M)) / M);        // "sum"
  }

  /* ── a kind's own character ("Bonds per kind": set by the kind) ──────────
     Worked out from the kind's number, never looked up, so the no-table rule
     holds. Kinds run in rows of seven, the way the main groups of a row of
     the periodic table do. Along a row the number of bonds goes 1, 2, 3, 4,
     3, 2, 1, which is the shape of the octet rule (lithium's row runs
     1-2-3-4-3-2-1 from lithium to fluorine), and the pull goes up, which is
     what electronegativity does along a row. A later row pulls a little less
     at every place, which is what it does down a group. The pull is a number
     from 0 to 1 and means nothing on its own; only the gap between two
     pulls is used. */
  const ROW = 7;
  function valence(k) { const c = (k - 1) % ROW; return 4 - Math.abs(c - 3); }
  function pull(k) { const c = (k - 1) % ROW, row = Math.floor((k - 1) / ROW); return (c + 1) / (ROW + row); }
  /* How much harder an unlike pair bonds. Pauling's rule (1932): a bond
     between A and B is worth the average of A-A and B-B, plus a term that
     grows with the SQUARE of how differently the two pull. Here the
     like-with-like strength is the base, the square term is added on, and
     the whole is scaled so the most unlike pair in a row comes out at exactly
     "Bond strength" — which keeps that slider meaning what it always has, the
     strongest bond there is. Two kinds that pull alike bond at 1/(1 + λ·gap²)
     of that, about 40%. */
  const PULL_LAMBDA = 2;
  const PULL_GAP = (ROW - 1) / ROW;
  function polar(k1, k2) {
    const gap = pull(k1) - pull(k2);
    return Math.min(1, (1 + PULL_LAMBDA * gap * gap) / (1 + PULL_LAMBDA * PULL_GAP * PULL_GAP));
  }

  const SOFT = 0.6;          // gravity's softening length, in hexagons
  /* The two reaches pull equally hard at this distance, so the one slider
     means about the same thing under either: beyond it "far" is the stronger,
     inside it "near" is. Without it "far" at any setting crushed the world. */
  const FAR_MATCH = 40;
  const BOND_K = 90;         // a bond's spring, per unit of the lighter mass
  const BOND_DAMP = 3;       // and what it loses to heat as it rings
  const BOND_SNAP = 1.7;     // times its rest length before it tears
  const BREAK_RATE = 3;      // attempts a second at shaking a bond loose
  const SPARE = 3000;        // hexagons a visitor may add to a running world
  const REACT_RATE = 4;      // times a second a bond notices its ends have changed
  const SLOTS = 6;           // a hexagon's six bond directions, 60° apart from the way it faces
  const ANG_K = 40;          // the straightening spring that turns a slot to face its partner
  const ANG_DAMP = 6;        // and what it loses to heat as it swings
  /* With "Bonds settle with temperature": the heat for making or breaking a
     bond comes out of, and goes back into, everything around the bond's
     middle — the pair's surroundings, standing in for the solvent or the gas
     that does this job in real chemistry. One pair alone is far too small a
     store of heat: at the temperatures where chemistry is interesting a pair
     rarely holds a bond's worth, so it could never break one by heat, and a
     fresh bond dumped its whole energy into its own two ends and shook itself
     apart (measured 2026-11-14: van 't Hoff slope 1.8 where the bond energy
     was 4). The surroundings are sized by how much is in them, not by
     distance, so a crowded world and a thin one hold the same store: a
     circle around the bond holding about POOL_MASS of mass on average. The
     bigger it is, the less one bond's heat moves its temperature, and the
     closer the world comes to the exact answer; it costs time. */
  const POOL_MASS = 60;
  /* With "Charge from bonds": each bond moves charge from the kind that
     pulls less to the kind that pulls more, by the gap between their pulls,
     so a bonded thing's charges add up to exactly nothing and a hexagon on
     its own carries none. This is the textbook picture of partial charge
     from electronegativity (Pauling, 1932): a bond whose two ends pull alike
     is shared evenly, an unlike one is lopsided. With the kinds' pulls,
     kind 6 holding two kind 1s comes out −10/7 in the middle and +5/7 at
     each end, the shape of water.

     Charged hexagons that are NOT bonded to each other feel
       U(d) = charge · qᵢ qⱼ · ψ(d),
     Coulomb's 1/r cut off smoothly at CHARGE_R (the "shifted force" form
     from the simulation of liquids, Allen and Tildesley, so the force and
     the energy both reach nothing at the edge and the world keeps its books), softened over CHARGE_SOFT so two
     hexagons pressed together cannot pull without end, and scaled so ψ is 1
     at touching. Real charges reach further; a cut-off is what simulations
     of liquids use to stay affordable, and it is said so in README.md.
     Bonded pairs are left out, as molecular simulations leave them out: the
     bond's own spring already holds them. */
  const CHARGE_R = 3;
  const CHARGE_SOFT = 0.5;
  const CHARGE_DC = Math.sqrt(CHARGE_R * CHARGE_R + CHARGE_SOFT * CHARGE_SOFT);
  const chargeF = D => 1 / D - 1 / CHARGE_DC + (D - CHARGE_DC) / (CHARGE_DC * CHARGE_DC);
  const CHARGE_ONE = chargeF(Math.sqrt(1 + CHARGE_SOFT * CHARGE_SOFT));
  function chargePsi(d) {
    if (d >= CHARGE_R) return 0;
    return chargeF(Math.sqrt(d * d + CHARGE_SOFT * CHARGE_SOFT)) / CHARGE_ONE;
  }
  /* dψ/dd: the slope, whose negative is the push. */
  function chargeSlope(d) {
    if (d >= CHARGE_R) return 0;
    const D = Math.sqrt(d * d + CHARGE_SOFT * CHARGE_SOFT);
    return (-1 / (D * D) + 1 / (CHARGE_DC * CHARGE_DC)) * (d / D) / CHARGE_ONE;
  }
  /* With "Whole charges can jump": what holding a whole charge costs a kind.
     Losing one costs more the harder it pulls, gaining one less: E+ is
     C(1/2 + pull/G), E- is C(1/2 - pull/G), with G the widest gap in a row.
     So passing one from kind d to kind a costs C(1 - (pull a - pull d)/G):
     nothing for the most unlike pair in a row, C for two alike. These are
     energies of a state, so every jump and its reverse balance. C is
     ION_COST times "Charge from bonds", and the pull of the two new charges
     at touching is 1 times it: so the most unlike pairs ionise, a gap of
     about two thirds of a row breaks even, and alike pairs never do.
     That is the line real chemistry draws between ionic and covalent at an
     electronegativity gap of roughly 1.7 to 2. */
  const ION_COST = 2.5;
  const ION_RATE = 4;        // tries a second for a touching pair
  /* With "Shape set by the kind": where its bonds may sit, as six bits for
     six slots, any turn of the pattern allowed. Worked out from the same
     row position as valence. A kind's electrons are its place in the row;
     those not in bonds sit in pairs that take up room as a bond does
     (VSEPR, Gillespie and Nyholm, 1957), and the bonds and pairs together
     spread as evenly as six slots allow: two straight, three a Y, four the
     cross {0,1,3,4}. With two spare pairs in a cross, the pairs push each
     other to opposite sides and the bonds go straight: in a flat world
     kind 6 is straight, where the real one, water, is bent only because the
     real world has a third direction to bend into.

     With "Double and triple bonds" too, the shape follows what a hexagon is
     holding, the way a carbon atom's does: the second and third parts of a
     double or triple bond (its pi bonds) take no direction of their own, so
     each one takes a direction away. Kind 4 with four single bonds is the
     cross; with one double, a flat Y; with two doubles or a triple, straight
     — which is methane, ethylene and acetylene's carbon, flattened. Kind 5
     with a double bond is bent. (LONE is spare pairs, by row position.) */
  const LONE = [0, 0, 0, 0, 1, 2, 3];
  function shapeMask(c, pi) {
    const v = 4 - Math.abs(c - 3), L = LONE[c], D = v + L - pi;
    if (v - pi <= 1) return 63;                // one direction left: anywhere
    if (D === 4 && L === 2) return 9;          // two spare pairs opposite, so the bonds are too
    return D === 2 ? 9 : D === 3 ? 21 : D === 4 ? 27 : 63;
  }
  const SHAPE = [0, 1, 2, 3, 4, 5, 6].map(c => shapeMask(c, 0));
  const rotMask = (mk, t) => ((mk << t) | (mk >> (SLOTS_ALL - t))) & 63;
  const SLOTS_ALL = 6;
  /* With "Double and triple bonds": worth and length against a single bond,
     from average carbon-carbon bond enthalpies (348, 614, 839 kJ/mol) and
     lengths (154, 134, 120 pm), the textbook figures. */
  const ORDER_WORTH = [0, 1, 1.75, 2.4];
  const ORDER_LENGTH = [0, 1, 0.87, 0.78];
  /* With "Everything sticks a little": the reach past touching. */
  const STICK_R = 0.6;
  /* create() has its own `pull`, gravity's; this is the kind's. */
  const kindPull = pull;
  const TAU = Math.PI * 2;
  const GRID = 16;           // gravity's coarse grid, cells a side
  const DIRECT_MAX = 500;    // bodies below which gravity is every pair exactly

  function create(input) {
    const S = clean(input);
    const R = rng(S.seed * 2654435761);
    const W = S.size, H = S.size;
    const wrap = S.edge === "wrap";
    /* Room for everything it starts with, hand placements and fragments. */
    const cap = (S.layout === "empty" ? 0 : S.count) + SPARE;

    const x = new Float64Array(cap), y = new Float64Array(cap);
    const vx = new Float64Array(cap), vy = new Float64Array(cap);
    const ax = new Float64Array(cap), ay = new Float64Array(cap);
    const m = new Float64Array(cap), r = new Float64Array(cap);
    const heat = new Float64Array(cap);
    // A sun or fused body's kind is its mass; billion-plus experiments must not wrap negative.
    const kind = new Float64Array(cap);
    const nb = new Uint8Array(cap);
    const alive = new Uint8Array(cap);
    const pinned = new Uint8Array(cap);       // held where it was put; nothing moves it
    const impact = new Float64Array(cap), impactX = new Float64Array(cap), impactY = new Float64Array(cap);
    const shedding = new Float64Array(cap), broken = new Uint8Array(cap);
    const bonds = new Map();      // a * cap + b (a < b) → { a, b, B, rest, sa, sb }
    /* Which way each hexagon faces, and how fast it is turning. Only moved
       when bonds hold an angle; with that off these stay zero and the world
       is the same world it was before any of this existed. */
    const face = new Float64Array(cap), spin = new Float64Array(cap);
    /* Who is in each of a hexagon's six slots, or -1. With angles on a slot
       is a real direction; with them off it is only a list of who it holds,
       which is what "a bond reads the next one along" needs. */
    const adj = new Int32Array(cap * SLOTS).fill(-1);
    /* Each hexagon's charge, from the bonds it holds (see CHARGE_R). Kept up
       to date by link() and unbond() whether or not "Charge from bonds" is
       on — it costs nothing and touches nothing else — so turning it on in a
       running world finds the charges already right. */
    const q = new Float64Array(cap);
    const charged = () => S.charge > 0 && S.bonding !== "none";
    /* A whole charge held (-1, 0, +1), with "Whole charges can jump"; it is
       part of q too. The energy a free hexagon has been charged up with,
       with "Energy-rich pieces". How many of its bonds a hexagon is using,
       a double counting two; without "Double and triple bonds" it is nb. */
    const z = new Int8Array(cap);
    const act = new Float64Array(cap);
    const used = new Uint8Array(cap);
    let n = 0;                    // slots used; dead ones stay where they are
    const tally = { time: 0, radiated: 0, dragged: 0, heated: 0, fused: 0, left: 0, bondsMade: 0, bondsBroken: 0,
                    placed: 0, removed: 0, reacted: 0, fractured: 0, shed: 0, breakWork: 0,
                    fed: 0, ionised: 0, swapped: 0, reordered: 0 };
    let fragmentLimit = false;

    const radiusOf = mass => (S.sized ? 0.5 * Math.sqrt(mass) : 0.5);

    function add(px, py, k, pvx, pvy, mass) {
      let i = -1;
      if (n < cap) i = n++;
      else { for (let q = 0; q < cap; q++) if (!alive[q]) { i = q; break; } }     // full: take a dead one's place
      if (i < 0) return -1;
      nb[i] = 0; pinned[i] = 0; shedding[i] = 0; broken[i] = 0; q[i] = 0; z[i] = 0; act[i] = 0; used[i] = 0;
      for (let s = 0; s < SLOTS; s++) adj[i * SLOTS + s] = -1;
      spin[i] = 0; face[i] = S.angles > 0 ? R() * TAU : 0;
      impact[i] = 0; impactX[i] = 0; impactY[i] = 0;
      x[i] = px; y[i] = py; vx[i] = pvx || 0; vy[i] = pvy || 0;
      kind[i] = k; m[i] = mass || k; r[i] = radiusOf(m[i]);
      heat[i] = S.startTemp * m[i]; alive[i] = 1;
      return i;
    }

    function pickKind() {
      if (S.kinds === 1) return 1;
      if (S.mix === "equal") return 1 + Math.floor(R() * S.kinds);
      let total = 0;
      for (let k = 1; k <= S.kinds; k++) total += S.mix === "light" ? 1 / k : k;
      let roll = R() * total;
      for (let k = 1; k <= S.kinds; k++) {
        roll -= S.mix === "light" ? 1 / k : k;
        if (roll <= 0) return k;
      }
      return S.kinds;
    }

    /* ── the start ──────────────────────────────────────────────────────────
       Bodies are put on the points of a hexagonal lattice, so nothing starts
       inside anything else, and which points are used is the layout. */
    (function seedWorld() {
      const rmax = radiusOf(S.kinds);
      const gap = 2 * rmax * 1.08;
      const rowH = gap * Math.sqrt(3) / 2;
      const cx = W / 2, cy = H / 2;
      const jig = () => (R() - 0.5) * gap * 0.06;
      const thermal = () => {
        const a = R() * Math.PI * 2, s = S.startSpeed * (0.5 + R());
        return [Math.cos(a) * s, Math.sin(a) * s];
      };
      /* Speed of a circle at distance d from a centre holding `inside`. */
      const orbit = (inside, d) => {
        if (S.gravity <= 0 || d <= 0) return 0;
        const p = S.reach === "far" ? 1 : 2;
        const f = S.gravity * inside * d / Math.pow(d * d + SOFT * SOFT, (p + 1) / 2) / (p === 1 ? FAR_MATCH : 1);
        return Math.sqrt(f * d) * S.spin;
      };
      const sites = (inDisc, discR, ox, oy) => {
        const out = [];
        const rows = Math.floor(H / rowH), cols = Math.floor(W / gap);
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const px = (i + (j % 2 ? 0.5 : 0) + 0.25) * gap, py = (j + 0.5) * rowH;
          if (inDisc) {
            const d = Math.hypot(px - ox, py - oy);
            if (d > discR) continue;
            out.push([px, py, d]);
          } else out.push([px, py, 0]);
        }
        return out;
      };
      const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
      /* A disc just big enough to hold `count` at this loose a packing. */
      const discFor = (count, loose) => Math.min(W * 0.46, Math.sqrt(count * gap * rowH * loose / Math.PI) + gap);

      if (S.layout === "scatter") {
        const all = shuffle(sites(false));
        for (let i = 0; i < all.length && n < S.count; i++) {
          const v = thermal();
          add(all[i][0] + jig(), all[i][1] + jig(), pickKind(), v[0], v[1]);
        }
      } else if (S.layout === "cloud" || S.layout === "spin") {
        const discR = discFor(S.count, S.layout === "spin" ? 2.6 : 1.5);
        const all = shuffle(sites(true, discR, cx, cy)).slice(0, S.count).sort((a, b) => a[2] - b[2]);
        const kinds = all.map(() => pickKind());
        let inside = 0;
        for (let i = 0; i < all.length; i++) {
          const s = all[i], v = thermal();
          let tx = 0, ty = 0;
          if (S.layout === "spin" && s[2] > 0) {
            const sp = orbit(inside, s[2]);
            tx = -(s[1] - cy) / s[2] * sp; ty = (s[0] - cx) / s[2] * sp;
          }
          inside += kinds[i];
          add(s[0] + jig(), s[1] + jig(), kinds[i], v[0] + tx, v[1] + ty);
        }
      } else if (S.layout === "empty") {
        /* Nothing. The visitor builds it. */
      } else if (S.layout === "two") {
        const each = Math.floor(S.count / 2);
        const discR = Math.min(W * 0.2, discFor(each, 1.5));
        const closing = Math.max(1, S.startSpeed);
        for (const side of [-1, 1]) {
          const ox = cx + side * W * 0.27, oy = cy + side * discR * 0.5;
          const all = shuffle(sites(true, discR, ox, oy)).slice(0, each);
          for (const s of all) add(s[0] + jig(), s[1] + jig(), pickKind(), -side * closing, 0);
        }
      } else {                                                    // "sun"
        const big = add(cx, cy, Math.round(S.bigMass), 0, 0, S.bigMass);
        const inner = r[big] + 6 * rmax + 2, outer = Math.max(inner + gap * 3, W * 0.44);
        const all = shuffle(sites(true, outer, cx, cy).filter(s => s[2] >= inner)).slice(0, S.count - 1);
        for (const s of all) {
          const sp = orbit(S.bigMass, s[2]), v = thermal();
          add(s[0] + jig(), s[1] + jig(), pickKind(),
              -(s[1] - cy) / s[2] * sp + v[0], (s[0] - cx) / s[2] * sp + v[1]);
        }
      }
      /* The world as a whole starts at rest, so a cloud does not drift off. */
      let px = 0, py = 0, mt = 0;
      for (let i = 0; i < n; i++) { px += m[i] * vx[i]; py += m[i] * vy[i]; mt += m[i]; }
      if (mt > 0 && S.layout !== "two") for (let i = 0; i < n; i++) { vx[i] -= px / mt; vy[i] -= py / mt; }
    })();

    const started = n;
    const startMass = (() => { let t = 0; for (let i = 0; i < n; i++) t += m[i]; return t; })();

    /* The shortest way from a to b, which in a looped world may be round the back. */
    function sep(d, span) {
      if (!wrap) return d;
      if (d > span / 2) return d - span;
      if (d < -span / 2) return d + span;
      return d;
    }

    /* ── gravity ───────────────────────────────────────────────────────────
       Every pair exactly while there are few enough; past that, bodies in the
       same or a neighbouring cell of a coarse grid pair exactly and each
       farther cell pulls as one lump at its centre of mass. The lump does not
       feel the pull back body by body, so the world's net force is taken out
       afterwards — otherwise it would slowly push itself across the screen. */
    const gm = new Float64Array(GRID * GRID), gx = new Float64Array(GRID * GRID), gy = new Float64Array(GRID * GRID);
    const gcell = new Int32Array(cap);
    let gridLists = null;
    function pull(i, dx, dy, mass, both, j) {
      const d2 = dx * dx + dy * dy + SOFT * SOFT;
      const f = S.reach === "far" ? S.gravity / (d2 * FAR_MATCH) : S.gravity / (d2 * Math.sqrt(d2));
      ax[i] += f * mass * dx; ay[i] += f * mass * dy;
      if (both) { ax[j] -= f * m[i] * dx; ay[j] -= f * m[i] * dy; }
    }
    function gravity() {
      if (S.gravity <= 0) return;
      let live = 0;
      for (let i = 0; i < n; i++) if (alive[i]) live++;
      if (live <= DIRECT_MAX) {
        for (let i = 0; i < n; i++) {
          if (!alive[i]) continue;
          for (let j = i + 1; j < n; j++) {
            if (!alive[j]) continue;
            pull(i, sep(x[j] - x[i], W), sep(y[j] - y[i], H), m[j], true, j);
          }
        }
        return;
      }
      /* The grid covers the world, or — in an open one — wherever things are. */
      let x0 = 0, y0 = 0, x1 = W, y1 = H;
      if (S.edge === "open") {
        x0 = y0 = Infinity; x1 = y1 = -Infinity;
        for (let i = 0; i < n; i++) if (alive[i]) {
          if (x[i] < x0) x0 = x[i]; if (x[i] > x1) x1 = x[i];
          if (y[i] < y0) y0 = y[i]; if (y[i] > y1) y1 = y[i];
        }
        x1 += 1e-6; y1 += 1e-6;
      }
      const cw = (x1 - x0) / GRID, ch = (y1 - y0) / GRID;
      gm.fill(0); gx.fill(0); gy.fill(0);
      if (!gridLists) { gridLists = []; for (let c = 0; c < GRID * GRID; c++) gridLists.push([]); }
      for (let c = 0; c < GRID * GRID; c++) gridLists[c].length = 0;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const ci = Math.min(GRID - 1, Math.max(0, Math.floor((x[i] - x0) / cw)));
        const cj = Math.min(GRID - 1, Math.max(0, Math.floor((y[i] - y0) / ch)));
        const c = cj * GRID + ci;
        gcell[i] = c; gm[c] += m[i]; gx[c] += m[i] * x[i]; gy[c] += m[i] * y[i];
        gridLists[c].push(i);
      }
      for (let c = 0; c < GRID * GRID; c++) if (gm[c] > 0) { gx[c] /= gm[c]; gy[c] /= gm[c]; }
      /* Written out flat, with nothing looked up inside the loop: this is the
         hottest code in the file by a wide margin. */
      const G = S.reach === "far" ? S.gravity / FAR_MATCH : S.gravity, far = S.reach === "far";
      const s2 = SOFT * SOFT, hW = W / 2, hH = H / 2;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const ci = gcell[i] % GRID, cj = (gcell[i] - ci) / GRID, xi = x[i], yi = y[i];
        let fxi = 0, fyi = 0;
        for (let c = 0; c < GRID * GRID; c++) {
          const mc = gm[c];
          if (mc === 0) continue;
          const di = c % GRID, dj = (c - di) / GRID;
          let ddi = di > ci ? di - ci : ci - di, ddj = dj > cj ? dj - cj : cj - dj;
          if (wrap) { if (ddi > GRID - ddi) ddi = GRID - ddi; if (ddj > GRID - ddj) ddj = GRID - ddj; }
          if (ddi <= 1 && ddj <= 1) {
            const list = gridLists[c];
            for (let q = 0; q < list.length; q++) {
              const j = list[q];
              if (j === i) continue;
              let dx = x[j] - xi, dy = y[j] - yi;
              if (wrap) { if (dx > hW) dx -= W; else if (dx < -hW) dx += W; if (dy > hH) dy -= H; else if (dy < -hH) dy += H; }
              const d2 = dx * dx + dy * dy + s2, f = (far ? G / d2 : G / (d2 * Math.sqrt(d2))) * m[j];
              fxi += f * dx; fyi += f * dy;
            }
          } else {
            let dx = gx[c] - xi, dy = gy[c] - yi;
            if (wrap) { if (dx > hW) dx -= W; else if (dx < -hW) dx += W; if (dy > hH) dy -= H; else if (dy < -hH) dy += H; }
            const d2 = dx * dx + dy * dy + s2, f = (far ? G / d2 : G / (d2 * Math.sqrt(d2))) * mc;
            fxi += f * dx; fyi += f * dy;
          }
        }
        ax[i] += fxi; ay[i] += fyi;
      }
      let fx = 0, fy = 0, mt = 0;
      for (let i = 0; i < n; i++) if (alive[i]) { fx += m[i] * ax[i]; fy += m[i] * ay[i]; mt += m[i]; }
      if (mt > 0) for (let i = 0; i < n; i++) if (alive[i]) { ax[i] -= fx / mt; ay[i] -= fy / mt; }
    }

    /* ── bonds ─────────────────────────────────────────────────────────────
       A bond is a spring at the distance the two were touching. Forming one
       gives off its energy as heat; breaking one takes it back, out of the
       pair's heat when heat shook it loose and out of thin air when it was
       torn (the tally counts that as work done on the world). */
    const key = (a, b) => (a < b ? a * cap + b : b * cap + a);
    function bondTemp(a, b) { return (heat[a] + heat[b]) / (m[a] + m[b]); }
    function unbond(k, bd, viaPool) {
      const held = strain(bd);
      if (held > 0) {
        const a = bd.a, b = bd.b, share = m[a] / (m[a] + m[b]);
        heat[a] += held * share; heat[b] += held * (1 - share);
      }
      if (!viaPool && charged()) payCharge(bd.a, bd.b, chargeDelta(bd.a, bd.b, bd.g, -1));
      bonds.delete(k); nb[bd.a]--; nb[bd.b]--; tally.bondsBroken++;
      q[bd.a] -= bd.g; q[bd.b] += bd.g;
      used[bd.a] -= bd.o || 1; used[bd.b] -= bd.o || 1;
      if (bd.sa >= 0) adj[bd.a * SLOTS + bd.sa] = -1;
      if (bd.sb >= 0) adj[bd.b * SLOTS + bd.sb] = -1;
    }
    /* What a bond's two springs are holding right now: the distance spring
       stretched or squashed, and the angle spring bent. stats() counts the
       same thing over the standing bonds, so a bond that lets go has to hand
       this back rather than take it out of the world. */
    function strain(bd) {
      const dx = sep(x[bd.b] - x[bd.a], W), dy = sep(y[bd.b] - y[bd.a], H);
      const d = Math.hypot(dx, dy) || 1e-9, off = d - bd.rest;
      let held = 0.5 * BOND_K * (m[bd.a] * m[bd.b] / (m[bd.a] + m[bd.b])) * off * off;
      if (spun() && bd.sa >= 0 && bd.sb >= 0) {
        const along = Math.atan2(dy, dx);
        const ea = wrapAngle(along - slotDir(bd.a, bd.sa));
        const eb = wrapAngle(along + Math.PI - slotDir(bd.b, bd.sb));
        held += 0.5 * ANG_K * S.angles * ((pinned[bd.a] ? 0 : inertia(bd.a) * ea * ea) + (pinned[bd.b] ? 0 : inertia(bd.b) * eb * eb));
      }
      return held;
    }

    /* -- shape --------------------------------------------------------------
       A hexagon faces a way, and its six slots are 60° apart from that facing.
       A bond sits in one slot at each end and holds it there, and that is the
       whole of what shape means here: a chain keeps its zig-zag, a ring
       closes, and two hexagons held against the same neighbour stay in step.
       The straightening spring is JohnnyVon's (Smith, Turney and Ewaschuk,
       2002), written here from the paper's description and credited in
       README.md -- no code was taken from it. */
    const spun = () => S.angles > 0 && S.bonding !== "none";
    const wrapAngle = a => a - TAU * Math.round(a / TAU);
    const slotDir = (i, slot) => face[i] + slot * (TAU / SLOTS);
    const inertia = i => 0.5 * m[i] * r[i] * r[i];
    /* The slot a bond in this direction would have to use, or -1: the nearest
       one, if it is empty and pointing near enough. Nearest only -- a bond
       does not get to pick another slot because the right one is full, which
       is what stops a hexagon holding six things in the same place. */
    function slotFor(i, dx, dy) {
      const base = i * SLOTS;
      if (!spun()) { for (let s = 0; s < SLOTS; s++) if (adj[base + s] < 0) return s; return -1; }
      const want = Math.atan2(dy, dx);
      let best = -1, off = Infinity;
      for (let s = 0; s < SLOTS; s++) {
        const e = Math.abs(wrapAngle(want - slotDir(i, s)));
        if (e < off) { off = e; best = s; }
      }
      if (best < 0 || adj[base + best] >= 0) return -1;
      if (S.shapeBy && !fitsShape(i, best)) return -1;
      return off <= S.align * Math.PI / 180 ? best : -1;
    }
    /* Would a bond in this slot, with the ones it already holds, still sit
       on its kind's pattern turned some way? See SHAPE. */
    function fitsShape(i, slot) { return shapeHolds(i, 1 << slot, piOf(i)); }
    /* The pi bonds a hexagon holds: what its bonds use beyond one each. */
    const piOf = i => (S.order ? used[i] - nb[i] : 0);
    /* Do the slots it uses, and `extra`, sit on its pattern for `pi`? */
    function shapeHolds(i, extra, pi) {
      const pat = shapeMask((baseKind(i) - 1) % 7, pi);
      let mask = extra;
      for (let t = 0; t < SLOTS; t++) if (adj[i * SLOTS + t] >= 0) mask |= 1 << t;
      for (let t = 0; t < SLOTS; t++) if ((rotMask(pat, t) & mask) === mask) return true;
      return false;
    }
    const units = i => (S.order ? used[i] : nb[i]);
    /* The kind of the neighbour a hexagon already holds: the first slot with
       one in it, skipping whoever is asking. Kind 1 means "nobody", because
       kind 1 moves nothing on. */
    function heldKind(i, skip) {
      const base = i * SLOTS;
      for (let s = 0; s < SLOTS; s++) {
        const o = adj[base + s];
        if (o >= 0 && o !== skip && alive[o]) return ((kind[o] - 1) % S.kinds) + 1;
      }
      return 1;
    }
    /* What a hexagon bonds AS: its own kind, moved on by how many bonds it
       holds (`shift`) and by the kind of the one it already holds (`look`).
       `less` is 1 when the bond being judged is one of its own, so a standing
       bond is read off the OTHER bonds its ends hold. */
    function siteOf(i, skip, less) {
      let moved = (nb[i] - (less || 0)) * S.shift;
      if (S.look > 0) moved += S.look * (heldKind(i, skip) - 1);
      return moved;
    }

    /* ── chemistry with depth ───────────────────────────────────────────────
       Three settings, all off by default (2026-11-14). Off, none of the code
       below draws a random number or changes a value, so a world is byte for
       byte what it was before they existed; test/chemistry.test.mjs holds
       that. */
    const baseKind = i => ((kind[i] - 1) % S.kinds) + 1;
    /* How many bonds this hexagon can hold: the world's cap, and under "set
       by the kind" its own valence too. */
    function capOf(i) {
      if (S.ions && z[i] !== 0) return 0;          // an ion is held by charge, not bonds
      return S.bondsPer === "kind" ? Math.min(S.maxBonds, valence(baseKind(i))) : S.maxBonds;
    }
    /* What a bond between these two is worth. `less` as in siteOf. */
    function worth(i, j, less) {
      const a = affinity(S.bonding, kind[i], kind[j], S.kinds, siteOf(i, j, less), siteOf(j, i, less));
      if (!(a > 0)) return 0;
      return S.bondStrength * a * (S.bondsPer === "kind" ? polar(baseKind(i), baseKind(j)) : 1);
    }
    /* The barrier a bond in this direction (i towards j, angle `along`) has
       to climb, to form or to break; the same number both ways, which is what
       keeps it out of where the balance settles. Without shape it is the
       whole barrier. With shape, each end's slot that already points at the
       other takes away its share: cos(3e) is 1 for a slot pointing straight
       at its partner and 0 at 30° off, the furthest a nearest slot can be.
       So two hexagons something else is holding lined up have nothing left to
       climb. That is the orientation part of catalysis — Page and Jencks
       (1971) put most of an enzyme's speed-up down to holding the reacting
       pieces close and lined up — and nothing here says what a catalyst is. */
    function barrierAt(i, si, j, sj, along) {
      if (!(S.barrier > 0)) return 0;
      if (!spun() || si < 0 || sj < 0) return S.barrier;
      const qa = Math.max(0, Math.cos(3 * wrapAngle(along - slotDir(i, si))));
      const qb = Math.max(0, Math.cos(3 * wrapAngle(along + Math.PI - slotDir(j, sj))));
      return S.barrier * (1 - qa * qb);
    }
    /* Everyone within poolR of a point, from the grid built this substep:
       their heat and their mass, and who they are in poolIds. poolR is set
       once a substep, from how thickly mass is spread over the grid. */
    const poolIds = new Int32Array(cap);
    let poolN = 0, poolHeat = 0, poolMass = 0, POOL_R = 5;
    function sizePool() {
      let total = 0;
      for (let i = 0; i < n; i++) if (alive[i]) total += m[i];
      const area = hw * cs * hh * (S.edge === "open" ? cs : H / hh);
      const spread = total / Math.max(area, 1e-9);
      POOL_R = Math.min(Math.max(W, H) / 2, Math.max(2, Math.sqrt(POOL_MASS / (Math.PI * Math.max(spread, 1e-9)))));
    }
    function gatherPool(px, py) {
      poolN = 0; poolHeat = 0; poolMass = 0;
      const rowH = S.edge === "open" ? cs : H / hh;
      const ci = Math.floor((px - hx0) / cs), cj = Math.floor((py - hy0) / rowH);
      const rx = Math.ceil(POOL_R / cs), ry = Math.ceil(POOL_R / rowH);
      const nx = wrap ? Math.min(hw, 2 * rx + 1) : 2 * rx + 1, ny = wrap ? Math.min(hh, 2 * ry + 1) : 2 * ry + 1;
      const add = q => {
        const d = Math.hypot(sep(x[q] - px, W), sep(y[q] - py, H));
        if (d <= POOL_R) { poolIds[poolN++] = q; poolHeat += heat[q]; poolMass += m[q]; }
      };
      for (let oj = 0; oj < ny; oj++) for (let oi = 0; oi < nx; oi++) {
        let gi = ci - rx + oi, gj = cj - ry + oj;
        if (wrap) { gi = ((gi % hw) + hw) % hw; gj = ((gj % hh) + hh) % hh; }
        else if (gi < 0 || gi >= hw || gj < 0 || gj >= hh) continue;
        for (let q = heads[gj * hw + gi]; q >= 0; q = nexts[q]) if (alive[q]) add(q);
      }
      for (let b = 0; b < bigs.length; b++) if (alive[bigs[b]]) add(bigs[b]);
    }
    /* Give heat to the pool by mass, so it lands at one temperature. */
    function poolGive(e) {
      for (let p = 0; p < poolN; p++) { const q = poolIds[p]; heat[q] += e * m[q] / poolMass; }
    }
    /* Take heat from the pool by heat, so nobody goes below nothing. */
    function poolTake(e) {
      const share = e / poolHeat;
      for (let p = 0; p < poolN; p++) { const q = poolIds[p]; heat[q] -= heat[q] * share; }
    }
    /* -- charge (with "Charge from bonds") ---------------------------------
       See CHARGE_R for the physics. What a bond between a and b (a < b)
       moves onto a; b has the same taken away. */
    function chargeGap(a, b) { return kindPull(baseKind(b)) - kindPull(baseKind(a)); }
    /* Everyone near a point, from the grid. The grid was built a moment ago
       and things have moved a little since, so it looks a hexagon further
       than it needs and the caller measures the real distance. */
    function eachNear(px, py, fn) {
      const reach = CHARGE_R + 1;
      const rowH = S.edge === "open" ? cs : H / hh;
      const ci = Math.min(hw - 1, Math.max(0, Math.floor((px - hx0) / cs)));
      const cj = Math.min(hh - 1, Math.max(0, Math.floor((py - hy0) / rowH)));
      const rx = Math.ceil(reach / cs), ry = Math.ceil(reach / rowH);
      const nx = wrap ? Math.min(hw, 2 * rx + 1) : 2 * rx + 1, ny = wrap ? Math.min(hh, 2 * ry + 1) : 2 * ry + 1;
      for (let oj = 0; oj < ny; oj++) for (let oi = 0; oi < nx; oi++) {
        let gi = ci - rx + oi, gj = cj - ry + oj;
        if (wrap) { gi = ((gi % hw) + hw) % hw; gj = ((gj % hh) + hh) % hh; }
        else if (gi < 0 || gi >= hw || gj < 0 || gj >= hh) continue;
        for (let o = heads[gj * hw + gi]; o >= 0; o = nexts[o]) if (alive[o]) fn(o);
      }
      for (let b = 0; b < bigs.length; b++) if (alive[bigs[b]]) fn(bigs[b]);
    }
    /* How much the world's charge energy would change if the bond a-b
       (moving `g` onto a) were made (s = 1) or broken (s = -1), asked before
       it happens. Only a's and b's charges change, and whether a and b count
       as a pair; everyone else stays as they were. */
    function chargeDelta(a, b, g, s) { return chargeShift(a, b, s * g, -s * g, s > 0, s < 0); }
    /* The same for any change: a's charge by da, b's by db, and whether a
       and b count as a pair before and after. */
    function chargeShift(a, b, da, db, before, after) {
      let Va = 0, Vb = 0;
      if (da !== 0) eachNear(x[a], y[a], o => {
        if (o === a || o === b || q[o] === 0 || bonds.has(key(a, o))) return;
        const d = Math.hypot(sep(x[o] - x[a], W), sep(y[o] - y[a], H));
        if (d < CHARGE_R) Va += q[o] * chargePsi(d);
      });
      if (db !== 0) eachNear(x[b], y[b], o => {
        if (o === a || o === b || q[o] === 0 || bonds.has(key(b, o))) return;
        const d = Math.hypot(sep(x[o] - x[b], W), sep(y[o] - y[b], H));
        if (d < CHARGE_R) Vb += q[o] * chargePsi(d);
      });
      const psi = chargePsi(Math.hypot(sep(x[b] - x[a], W), sep(y[b] - y[a], H)));
      const pair = (after ? (q[a] + da) * (q[b] + db) * psi : 0) - (before ? q[a] * q[b] * psi : 0);
      return S.charge * (da * Va + db * Vb + pair);
    }
    /* A bond made or broken outside settling pays for the charge it moves
       out of its own two ends' heat, like everything else it does there. If
       they are too cold to pay, the books say where the rest came from, the
       way a bond snapping does. */
    function payCharge(a, b, dU) {
      if (dU === 0) return;
      if (dU < 0) { const wa = m[a] / (m[a] + m[b]); heat[a] -= dU * wa; heat[b] -= dU * (1 - wa); return; }
      const have = heat[a] + heat[b], take = Math.min(dU, have);
      if (have > 0) { const share = take / have; heat[a] -= heat[a] * share; heat[b] -= heat[b] * share; }
      tally.heated += dU - take;
    }
    /* Every charged pair that is not bonded to each other, once. Only the
       charged are looked at, on a grid of their own whose cells are as wide
       as the reach, built from where they are right now: much cheaper than
       the touching grid, whose cells are a hexagon wide and mostly hold
       hexagons with no charge. */
    const chargedIds = new Int32Array(cap), cNext = new Int32Array(cap);
    let cHeads = new Int32Array(1);
    function eachCharged(fn) {
      let c = 0;
      for (let i = 0; i < n; i++) if (alive[i] && q[i] !== 0) chargedIds[c++] = i;
      pairsWithin(chargedIds, c, CHARGE_R, (i, o) => {
        const dx = sep(x[o] - x[i], W), dy = sep(y[o] - y[i], H);
        const d = Math.hypot(dx, dy);
        if (d >= CHARGE_R || bonds.has(key(i, o))) return;
        fn(i, o, dx, dy, d);
      });
    }
    /* Every pair among ids[0..c) that could be within `cell` of each other,
       once, on a grid of their own built from where they are now. The caller
       measures the real distance. */
    function pairsWithin(ids, c, cell, meet) {
      if (c < 2) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let p = 0; p < c; p++) {
        const i = ids[p];
        if (x[i] < x0) x0 = x[i]; if (x[i] > x1) x1 = x[i];
        if (y[i] < y0) y0 = y[i]; if (y[i] > y1) y1 = y[i];
      }
      const chargedIds = ids;
      let gw, gh, cw, ch;
      if (wrap) { x0 = 0; y0 = 0; gw = Math.floor(W / cell); gh = Math.floor(H / cell); cw = W / gw; ch = H / gh; }
      else { cw = ch = cell; gw = Math.floor((x1 - x0) / cw) + 1; gh = Math.floor((y1 - y0) / ch) + 1; }
      /* Too few cells to tell neighbours from strangers (a tiny looped world,
         or charges spread over an enormous open one): every pair. */
      if ((wrap && (gw < 3 || gh < 3)) || gw * gh > 4 * cap + 64) {
        for (let p = 0; p < c; p++) for (let s = p + 1; s < c; s++) {
          const i = chargedIds[p], o = chargedIds[s];
          i < o ? meet(i, o) : meet(o, i);
        }
        return;
      }
      if (cHeads.length < gw * gh) cHeads = new Int32Array(gw * gh);
      cHeads.fill(-1, 0, gw * gh);
      for (let p = 0; p < c; p++) {
        const i = chargedIds[p];
        const ci = Math.min(gw - 1, Math.max(0, Math.floor((x[i] - x0) / cw))), cj = Math.min(gh - 1, Math.max(0, Math.floor((y[i] - y0) / ch)));
        cNext[i] = cHeads[cj * gw + ci]; cHeads[cj * gw + ci] = i;
      }
      for (let p = 0; p < c; p++) {
        const i = chargedIds[p];
        const ci = Math.min(gw - 1, Math.max(0, Math.floor((x[i] - x0) / cw))), cj = Math.min(gh - 1, Math.max(0, Math.floor((y[i] - y0) / ch)));
        for (let oj = -1; oj <= 1; oj++) for (let oi = -1; oi <= 1; oi++) {
          let gi = ci + oi, gj = cj + oj;
          if (wrap) { gi = (gi + gw) % gw; gj = (gj + gh) % gh; }
          else if (gi < 0 || gi >= gw || gj < 0 || gj >= gh) continue;
          for (let o = cHeads[gj * gw + gi]; o >= 0; o = cNext[o]) if (o > i) meet(i, o);
        }
      }
    }
    function chargeForces() {
      eachCharged((i, o, dx, dy, d) => {
        /* dU/dd, spread along the line between them. */
        const f = S.charge * q[i] * q[o] * chargeSlope(d) / (d || 1e-9);
        if (!pinned[i]) { ax[i] += f * dx / m[i]; ay[i] += f * dy / m[i]; }
        if (!pinned[o]) { ax[o] -= f * dx / m[o]; ay[o] -= f * dy / m[o]; }
      });
    }
    function chargeEnergy() {
      let u = 0;
      eachCharged((i, o, dx, dy, d) => { u += q[i] * q[o] * chargePsi(d); });
      return S.charge * u;
    }

    /* -- sticking (with "Everything sticks a little") ---------------------
       U = -stick * w(d) for any two hexagons, bonded or not: w is 1 at
       touching and closer, (1 - t^2)^2 across the next STICK_R past it
       (t from 0 to 1), and 0 beyond, so the force is smooth and is nothing
       at both ends. Flat inside touching means pushing two apart to exactly
       touching costs nothing, and a bond at its rest length feels none of it,
       so making or breaking a bond never changes it. London's dispersion
       force, short-ranged and the same for every kind; real ones grow with
       size, and that is left out. */
    const stickIds = new Int32Array(cap);
    function eachSticky(fn) {
      let c = 0, rmax = 0;
      const big = [];
      for (let i = 0; i < n; i++) if (alive[i]) {
        if (r[i] > 1.5) big.push(i); else { stickIds[c++] = i; if (r[i] > rmax) rmax = r[i]; }
      }
      const meet = (i, o) => {
        const dx = sep(x[o] - x[i], W), dy = sep(y[o] - y[i], H);
        const d = Math.hypot(dx, dy), c0 = r[i] + r[o];
        if (d < c0 + STICK_R) fn(i, o, dx, dy, d, c0);
      };
      pairsWithin(stickIds, c, 2 * rmax + STICK_R, meet);
      for (const b of big) for (let o = 0; o < n; o++) {
        if (!alive[o] || o === b || (r[o] > 1.5 && o < b)) continue;
        meet(b, o);
      }
    }
    function stickForces() {
      eachSticky((i, o, dx, dy, d, c0) => {
        if (d <= c0) return;
        const t = (d - c0) / STICK_R;
        const f = S.stick * 4 * t * (1 - t * t) / STICK_R / d;      // dU/dd along the line, pulling together
        if (!pinned[i]) { ax[i] += f * dx / m[i]; ay[i] += f * dy / m[i]; }
        if (!pinned[o]) { ax[o] -= f * dx / m[o]; ay[o] -= f * dy / m[o]; }
      });
    }
    function stickEnergy() {
      let u = 0;
      eachSticky((i, o, dx, dy, d, c0) => {
        if (d <= c0) { u += 1; return; }
        const t = (d - c0) / STICK_R, w = 1 - t * t;
        u += w * w;
      });
      return -S.stick * u;
    }

    /* A pool of just two, for steps taken without settling. */
    function pairPool(i, j) {
      poolN = 2; poolIds[0] = i; poolIds[1] = j;
      poolHeat = heat[i] + heat[j]; poolMass = m[i] + m[j];
    }
    /* Accept a step that gives `drop` to the pool, judged at the pool's
       temperature halfway between before and after: the same number from
       either side, so a step and its reverse balance (detailed balance). */
    function acceptMid(drop, Ea) {
      if (poolMass <= 0 || poolHeat < Math.max(0, -drop)) return false;
      const T = (poolHeat + drop / 2) / poolMass;
      if (!(T > 0)) return false;
      const climb = Ea + Math.max(0, -drop);
      return climb === 0 || R() < Math.exp(-climb / T);
    }
    function poolPay(drop) { if (drop >= 0) poolGive(drop); else poolTake(-drop); }

    /* -- ions (with "Whole charges can jump") -----------------------------
       See ION_COST. Two free hexagons nearly touching; one, at random, offers
       the other a whole charge. */
    function ionEnergyOf(zz, k) {
      if (!zz) return 0;
      const p = kindPull(k) / PULL_GAP;
      return ION_COST * S.charge * (zz > 0 ? 0.5 + p : 0.5 - p);
    }
    function tryIon(i, j, dt) {
      if (R() >= ION_RATE * dt) return;
      const flip = R() < 0.5, d = flip ? j : i, a = flip ? i : j;
      if (z[d] >= 1 || z[a] <= -1) return;
      const kd = baseKind(d), ka = baseKind(a);
      const cost = ionEnergyOf(z[d] + 1, kd) - ionEnergyOf(z[d], kd) + ionEnergyOf(z[a] - 1, ka) - ionEnergyOf(z[a], ka)
        + chargeShift(d, a, 1, -1, true, true);
      if (S.settle) gatherPool(x[i] + sep(x[j] - x[i], W) / 2, y[i] + sep(y[j] - y[i], H) / 2); else pairPool(i, j);
      if (!acceptMid(-cost, 0)) return;
      poolPay(-cost);
      z[d]++; z[a]--; q[d] += 1; q[a] -= 1;
      tally.ionised++;
    }

    /* -- energy-rich pieces (with "Energy-rich pieces") -------------------
       Free hexagons are charged up from outside; the books call it `fed`. */
    function recharge(dt) {
      const odds = S.fuelRate * dt;
      for (let i = 0; i < n; i++) {
        if (!alive[i] || nb[i] > 0 || act[i] > 0) continue;
        if (R() < odds) { act[i] = S.fuel; tally.fed += S.fuel; }
      }
    }

    /* -- handing over (with "Pieces can be handed over") ------------------
       A nearly touching B, B bonded to C: A takes B and C is let go, in one
       step. Weighed as the break and the make together, judged halfway, with
       the barrier the average of the two bonds' — cheaper than breaking
       first, which has to find the whole bond. Proposed from the pair A-B,
       C chosen at random from B's partners; the reverse is proposed from C-B
       the same way, so C has to be nearly touching B for the step to count. */
    function trySwap(i, j, dt) {
      if (R() >= S.bondChance * Math.min(1, dt * 30)) return false;
      const flip = R() < 0.5, A = flip ? j : i, B = flip ? i : j;
      if (nb[B] === 0 || units(A) >= capOf(A)) return false;
      let count = 0;
      for (let t = 0; t < SLOTS; t++) if (adj[B * SLOTS + t] >= 0) count++;
      if (count !== nb[B]) return false;
      let pick = Math.floor(R() * count), C = -1;
      for (let t = 0; t < SLOTS && C < 0; t++) { const o = adj[B * SLOTS + t]; if (o >= 0 && pick-- === 0) C = o; }
      if (C < 0 || C === A) return false;
      const kBC = key(B, C), old = bonds.get(kBC);
      if (!old || (old.o || 1) !== 1) return false;
      if (Math.hypot(sep(x[C] - x[B], W), sep(y[C] - y[B], H)) > (r[B] + r[C]) * 1.1) return false;
      const dUb = charged() ? chargeDelta(old.a, old.b, old.g, -1) : 0;
      const dropBC = old.B - strain(old) + dUb;
      const EaBC = barrierAt(old.a, old.sa, old.b, old.sb,
        Math.atan2(sep(y[old.b] - y[old.a], H), sep(x[old.b] - x[old.a], W)));
      detach(old);
      const dx = sep(x[B] - x[A], W), dy = sep(y[B] - y[A], H), dd = Math.hypot(dx, dy) || 1e-9;
      const ux = dx / dd, uy = dy / dd;
      const sA = slotFor(A, ux, uy), sB = slotFor(B, -ux, -uy);
      const Bab = spun() && (sA < 0 || sB < 0) ? 0 : worth(A, B, 0);
      if (Bab > 0) {
        const lo = Math.min(A, B), hi = Math.max(A, B), reachAB = r[A] + r[B];
        const would = { a: lo, b: hi, rest: reachAB, sa: lo === A ? sA : sB, sb: lo === A ? sB : sA };
        const dUf = charged() ? chargeDelta(lo, hi, chargeGap(lo, hi), 1) : 0;
        const dropAB = Bab - strain(would) - dUf + act[A] + act[B];
        const Ea = (barrierAt(A, sA, B, sB, Math.atan2(uy, ux)) + EaBC) / 2;
        gatherPool(x[B], y[B]);
        /* The pool itself gains all of it but the springs' share of B-C,
           which unbond() hands to B and C directly. */
        const toPool = dropAB - old.B - dUb;
        if (poolHeat >= Math.max(0, -toPool) && acceptMid(dropAB - dropBC, Ea)) {
          reattach(old);
          poolPay(toPool);
          unbond(kBC, old, true);
          link(A, B, sA, sB, Bab, reachAB, true);
          tally.swapped++;
          return true;
        }
      }
      reattach(old);
      return false;
    }

    /* -- bond order (with "Double and triple bonds") ----------------------
       A bond steps up or down one, if both ends have the room. */
    function tryOrder(bd) {
      const o = bd.o || 1, o2 = R() < 0.5 ? o + 1 : o - 1;
      if (o2 < 1 || o2 > 3) return;
      const a = bd.a, b = bd.b;
      if (o2 > o && (used[a] >= capOf(a) || used[b] >= capOf(b))) return;
      /* With shape set by the kind, the bonds both ends already hold have to
         sit on the shape the new order gives them. They sat on the old one,
         so the step back is always allowed, and the two stay balanced. The
         bonds do not move to make room: a carbon held as a cross cannot go
         straight without first letting go of what is in the way. */
      if (S.shapeBy && spun() && (!shapeHolds(a, 0, piOf(a) + o2 - o) || !shapeHolds(b, 0, piOf(b) + o2 - o))) return;
      const B2 = bd.B / ORDER_WORTH[o] * ORDER_WORTH[o2];
      const rest2 = bd.rest / ORDER_LENGTH[o] * ORDER_LENGTH[o2];
      const drop = (B2 - bd.B) - (strain({ a: a, b: b, rest: rest2, sa: bd.sa, sb: bd.sb }) - strain(bd));
      const dx = sep(x[b] - x[a], W), dy = sep(y[b] - y[a], H);
      gatherPool(x[a] + dx / 2, y[a] + dy / 2);
      if (!acceptMid(drop, barrierAt(a, bd.sa, b, bd.sb, Math.atan2(dy, dx)))) return;
      poolPay(drop);
      bd.B = B2; bd.rest = rest2; bd.o = o2;
      used[a] += o2 - o; used[b] += o2 - o;
      tally.reordered++;
    }

    /* Make the bond: the record, the slots, the counts. Shared by both ways
       of forming one; the caller has decided it happens and pays for it. */
    function link(i, j, si, sj, B, rest, viaPool) {
      const lo = Math.min(i, j), up = Math.max(i, j);
      const bd = { a: lo, b: up, B: B, rest: rest, sa: lo === i ? si : sj, sb: lo === i ? sj : si,
                   g: chargeGap(lo, up) };
      if (!viaPool && charged()) payCharge(lo, up, chargeDelta(lo, up, bd.g, 1));
      if (S.order) bd.o = 1;
      bonds.set(key(i, j), bd);
      q[lo] += bd.g; q[up] -= bd.g;
      if (si >= 0) adj[i * SLOTS + si] = j;
      if (sj >= 0) adj[j * SLOTS + sj] = i;
      nb[i]++; nb[j]++; used[i]++; used[j]++; tally.bondsMade++;
      /* A charged-up end spends what it carried. Settling has already put it
         in the pool; otherwise it lands in the two ends as heat. */
      if (act[lo] > 0 || act[up] > 0) {
        if (!viaPool) { heat[lo] += act[lo]; heat[up] += act[up]; }
        act[lo] = 0; act[up] = 0;
      }
      return bd;
    }
    /* Take a bond away and put it back exactly, for weighing a hand-over. */
    function detach(bd) {
      bonds.delete(key(bd.a, bd.b)); nb[bd.a]--; nb[bd.b]--;
      used[bd.a] -= bd.o || 1; used[bd.b] -= bd.o || 1;
      q[bd.a] -= bd.g; q[bd.b] += bd.g;
      if (bd.sa >= 0) adj[bd.a * SLOTS + bd.sa] = -1;
      if (bd.sb >= 0) adj[bd.b * SLOTS + bd.sb] = -1;
    }
    function reattach(bd) {
      bonds.set(key(bd.a, bd.b), bd); nb[bd.a]++; nb[bd.b]++;
      used[bd.a] += bd.o || 1; used[bd.b] += bd.o || 1;
      q[bd.a] += bd.g; q[bd.b] -= bd.g;
      if (bd.sa >= 0) adj[bd.a * SLOTS + bd.sa] = bd.b;
      if (bd.sb >= 0) adj[bd.b * SLOTS + bd.sb] = bd.a;
    }

    /* ── settling (with "Bonds settle with temperature") ───────────────────
       Forming and breaking are one step and its reverse, at one attempt rate
       ν, each accepted with the Boltzmann factor of the energy it has to find:

         form:  ν · exp(−(barrier + max(0, −drop)) / T)
         break: ν · exp(−(barrier + max(0,  drop)) / T)

       where `drop` is what forming gives off — the bond's worth less whatever
       its two springs are holding at that moment — and T is the temperature
       of the pool around the bond AS IT IS WITH THE BOND NOT THERE: its heat
       now when forming, its heat now less `drop` when breaking. So a step and
       its exact reverse are always judged at one temperature. Judging each at
       the pool's temperature of the moment looked the same and was not: a
       fresh bond's own heat warmed the pool it was then judged against, and
       measured, the slope fell to 91% of the bond energy and a barrier moved
       the balance by a quarter; judged this way, 102% and 6%
       (chemistry-probe.mjs, 2026-11-14).

       The ratio of the two is exp(drop / T) for
       every arrangement of the pieces, which is detailed balance, so a world
       settles where its bond energies and its temperature put it and not
       where two unrelated knobs happen to meet. That is the Metropolis rule
       (Metropolis et al., 1953) with a barrier in it, which is
       transition-state theory's shape (Eyring, 1935); the barrier cancels
       from the ratio, as a catalyst must.

       Every joule is accounted for: forming gives `drop` to the pool and the
       springs hold the rest; breaking takes the bond's worth from the pool
       and unbond() hands the springs' back. If the pool cannot pay, nothing
       happens. Attempts are made by pairs NEARLY touching (within a tenth of
       contact), whatever their speed: that is a place to be, which balances,
       where an impact is an event, which does not. */
    function trySettle(i, j, ux, uy, reachIJ, dt) {
      if (units(i) >= capOf(i) || units(j) >= capOf(j)) return false;
      const nu = S.bondChance * Math.min(1, dt * 30);
      if (R() >= nu) return false;
      /* With bond order on, half of a bond's tries go to its order, so half
         of the tries at making one are let go too, to keep the two even. */
      if (S.order && R() < 0.5) return false;
      const B = worth(i, j, 0);
      if (!(B > 0)) return false;
      const si = slotFor(i, ux, uy), sj = slotFor(j, -ux, -uy);
      if (spun() && (si < 0 || sj < 0)) return false;
      const along = Math.atan2(uy, ux);
      const Ea = barrierAt(i, si, j, sj, along);
      /* The bond as it would be, weighed before it is made. With charge on,
         making it also moves charge, and what that does to everyone nearby
         is part of what it gives off. */
      const lo = Math.min(i, j), up = Math.max(i, j);
      const would = { a: lo, b: up, rest: reachIJ, sa: lo === i ? si : sj, sb: lo === i ? sj : si };
      const dU = charged() ? chargeDelta(lo, up, chargeGap(lo, up), 1) : 0;
      /* A charged-up end spends what it carries: more given off, and less of
         the barrier left to find. Not balanced by anything: that is the
         point of it. */
      const lift = act[i] + act[j];
      const drop = B - strain(would) - dU + lift;
      gatherPool(x[i] + sep(x[j] - x[i], W) / 2, y[i] + sep(y[j] - y[i], H) / 2);
      const T = poolMass > 0 ? poolHeat / poolMass : 0;
      const climb = Math.max(0, Ea - lift) + Math.max(0, -drop);
      const ok = climb === 0 || (T > 0 && poolHeat >= Math.max(0, -drop) && R() < Math.exp(-climb / T));
      if (!ok) return false;
      link(i, j, si, sj, B, reachIJ, true);
      if (drop >= 0) poolGive(drop); else poolTake(-drop);
      return true;
    }
    function settleBonds(dt) {
      if (!bonds.size) return;
      const nu = S.bondChance * Math.min(1, dt * 30);
      for (const [k, bd] of bonds) {
        if (R() >= nu) continue;
        /* Making is tried by half the pairs when hand-overs are on, so
           breaking is tried by half the bonds; and with bond order on, half
           of a bond's tries go to its order, and only a single comes apart. */
        if (S.swap && R() < 0.5) continue;
        if (S.order) { if (R() < 0.5) { tryOrder(bd); continue; } if ((bd.o || 1) > 1) continue; }
        const a = bd.a, b = bd.b;
        const dx = sep(x[b] - x[a], W), dy = sep(y[b] - y[a], H);
        /* Breaking moves the charge back, exactly the reverse of what making
           it did, so `drop` is the same number either way. */
        const dU = charged() ? chargeDelta(a, b, bd.g, -1) : 0;
        const drop = bd.B - strain(bd) + dU;
        const Ea = barrierAt(a, bd.sa, b, bd.sb, Math.atan2(dy, dx));
        gatherPool(x[a] + dx / 2, y[a] + dy / 2);
        if (poolHeat < bd.B + Math.max(0, dU) || poolMass <= 0) continue;   // nothing near enough can pay for it
        /* The temperature the pool would have with this bond broken: the
           same one its forming was judged at, so each make-and-break pair is
           judged at one temperature. See the note above trySettle. */
        const T = (poolHeat - drop) / poolMass;
        if (!(T > 0)) continue;
        if (R() >= Math.exp(-(Ea + Math.max(0, drop)) / T)) continue;
        poolTake(bd.B + Math.max(0, dU));
        if (dU < 0) poolGive(-dU);
        unbond(k, bd, true);
      }
    }
    /* ── motion ─────────────────────────────────────────────────────────────
       Velocity Verlet (Verlet 1967; Swope et al. 1982), the stepping rule
       molecular simulation uses: half a kick from the forces, a full step of
       motion, the forces worked out again where things now are, the other
       half kick. Before 2026-11-14 it was a kick then a step (semi-implicit
       Euler), and a bonded world gained energy a little at a time: measured
       on 400 hexagons, 0.5 to 2.8 units in five seconds in the moving part
       alone. Only the forces that hold energy (bond springs, angle springs,
       charge, sticking, gravity) are in the kicks; the dampers that turn
       ringing into heat are applied afterwards, each handing over exactly the
       motion it takes away. */
    const tq = new Float64Array(cap);       // turning force from the angle springs
    /* A bond stretched past breaking point lets go, and has to find its
       worth: out of the pair's heat, or, if they are too cold, the books say
       where it came from. */
    function snapBonds() {
      for (const [k, bd] of bonds) {
        const a = bd.a, b = bd.b;
        const d = Math.hypot(sep(x[b] - x[a], W), sep(y[b] - y[a], H)) || 1e-9;
        if (d <= bd.rest * BOND_SNAP) continue;
        const take = Math.min(bd.B, heat[a] + heat[b]);
        const share = heat[a] + heat[b] > 0 ? take / (heat[a] + heat[b]) : 0;
        heat[a] -= heat[a] * share; heat[b] -= heat[b] * share;
        tally.heated += bd.B - take;
        unbond(k, bd);
      }
    }
    function bondForces() {
      const turning = spun();
      for (const bd of bonds.values()) {
        const a = bd.a, b = bd.b;
        const dx = sep(x[b] - x[a], W), dy = sep(y[b] - y[a], H);
        const d = Math.hypot(dx, dy) || 1e-9;
        const ux = dx / d, uy = dy / d;
        const mu = m[a] * m[b] / (m[a] + m[b]);
        const f = BOND_K * mu * (d - bd.rest);
        ax[a] += f * ux / m[a]; ay[a] += f * uy / m[a];
        ax[b] -= f * ux / m[b]; ay[b] -= f * uy / m[b];
        if (turning && bd.sa >= 0 && bd.sb >= 0) {
          const along = Math.atan2(dy, dx);
          /* Each end's spring turns that end and leans on the line between
             the two middles, which is what it is measured against. The lean
             is equal and opposite, so the pair keeps its momentum. */
          const lean = (turnForce(a, bd.sa, along) + turnForce(b, bd.sb, along + Math.PI)) / d;
          const px = -uy, py = ux;
          ax[a] += lean * px / m[a]; ay[a] += lean * py / m[a];
          ax[b] -= lean * px / m[b]; ay[b] -= lean * py / m[b];
        }
      }
    }
    /* The angle spring at one end: how hard it turns that end towards its
       partner, added to tq and handed back for the lean. A pinned hexagon is
       held: it neither turns nor is turned, and its end does nothing. */
    function turnForce(i, slot, want) {
      if (pinned[i]) return 0;
      const t = inertia(i) * ANG_K * S.angles * wrapAngle(want - slotDir(i, slot));
      tq[i] += t;
      return t;
    }
    function computeForces() {
      ax.set(gax); ay.set(gay);
      if (spun()) tq.fill(0, 0, n);
      bondForces();
      if (charged() && (bonds.size || S.ions)) chargeForces();
      if (S.stick > 0) stickForces();
    }
    function kick(h) {
      const turning = spun();
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        if (pinned[i]) { vx[i] = 0; vy[i] = 0; continue; }
        vx[i] += ax[i] * h; vy[i] += (ay[i] + S.fall) * h;
        if (turning) spin[i] += tq[i] / inertia(i) * h;
      }
    }
    /* The dampers. Along each bond the two ends' closing speed is pulled
       towards nothing as exp(-BOND_DAMP t) and given a random kick sized by
       the pair's temperature, and the same for the turning of each end: a
       damper and its matching noise, the fluctuation-dissipation pair
       (dissipative particle dynamics, Espanol and Warren 1995). The change in
       motion is paid from, or given to, the pair's heat exactly. Without the
       noise, a damper only ever took motion away, a bond's own wiggling ran
       colder than the world round it, and a bonded pair looked more
       comfortable than it is: van 't Hoff came out 113-117% of the bond
       energy, by about the same amount whatever the bond (measured
       2026-11-14). With "Heat shakes things" off there is no noise here
       either, as there is none anywhere. */
    function dampBonds(dt) {
      const keepN = Math.exp(-BOND_DAMP * dt);
      const keepA = Math.max(0, 1 - ANG_DAMP * S.angles * dt), turning = spun();
      for (const bd of bonds.values()) {
        const a = bd.a, b = bd.b;
        const ia = pinned[a] ? 0 : 1 / m[a], ib = pinned[b] ? 0 : 1 / m[b], isum = ia + ib;
        if (isum > 0) {
          const dx = sep(x[b] - x[a], W), dy = sep(y[b] - y[a], H);
          const d = Math.hypot(dx, dy) || 1e-9, ux = dx / d, uy = dy / d;
          const vn = (vx[b] - vx[a]) * ux + (vy[b] - vy[a]) * uy;
          /* The pair's own temperature, and its closing speed's spread there:
             1/isum is the pair's reduced mass. */
          const T = S.shake > 0 ? Math.max(0, heat[a] + heat[b]) / (m[a] + m[b]) : 0;
          const vn2 = keepN * vn + (T > 0 ? Math.sqrt((1 - keepN * keepN) * T * isum) * gauss() : 0);
          const J = (vn2 - vn) / isum;
          const ova = vx[a], ova2 = vy[a], ovb = vx[b], ovb2 = vy[b];
          const before = m[a] * (vx[a] * vx[a] + vy[a] * vy[a]) + m[b] * (vx[b] * vx[b] + vy[b] * vy[b]);
          vx[a] -= J * ux * ia; vy[a] -= J * uy * ia;
          vx[b] += J * ux * ib; vy[b] += J * uy * ib;
          const after = m[a] * (vx[a] * vx[a] + vy[a] * vy[a]) + m[b] * (vx[b] * vx[b] + vy[b] * vy[b]);
          const lost = 0.5 * (before - after);
          if (heat[a] + heat[b] + lost < 0) { vx[a] = ova; vy[a] = ova2; vx[b] = ovb; vy[b] = ovb2; }   // too cold to pay for the kick
          else {
            /* Shared as before when it is heat given; taken by heat held when
               it is heat spent, so nobody goes below nothing. */
            if (lost >= 0) { heat[a] += lost / 2; heat[b] += lost / 2; }
            else { const share = -lost / (heat[a] + heat[b]); heat[a] -= heat[a] * share; heat[b] -= heat[b] * share; }
          }
        }
        if (turning && bd.sa >= 0 && bd.sb >= 0) {
          for (const i of [a, b]) {
            if (pinned[i]) continue;
            const I = inertia(i), Ti = S.shake > 0 ? Math.max(0, heat[i]) / m[i] : 0;
            const was = spin[i];
            const now = keepA * was + (Ti > 0 ? Math.sqrt((1 - keepA * keepA) * Ti / I) * gauss() : 0);
            const lost = 0.5 * I * (was * was - now * now);
            if (heat[i] + lost >= 0) { spin[i] = now; heat[i] += lost; }
          }
        }
      }
    }
    /* What everything attached to i and j holds where they are now: the
       springs of their bonds, and with charge or sticking on, their pull on
       everyone near. Read before and after a collision pushes the two apart,
       so the push pays for what it changes. */
    function heldAround(i, j) {
      let u = 0;
      for (const h of [i, j]) {
        if (nb[h] === 0) continue;
        /* i and j are not bonded to each other (a bonded pair is never
           pushed), so every bond here is counted once. */
        let listed = 0;
        for (let t = 0; t < SLOTS; t++) {
          const o = adj[h * SLOTS + t];
          if (o < 0) continue;
          listed++;
          const bd = bonds.get(key(h, o));
          if (bd) u += strain(bd);
        }
        if (listed < nb[h]) {
          /* More bonds than slots: read the rest from the list. */
          for (const bd of bonds.values()) if (bd.a === h || bd.b === h) {
            const o = bd.a === h ? bd.b : bd.a;
            let inSlot = false;
            for (let t = 0; t < SLOTS; t++) if (adj[h * SLOTS + t] === o) inSlot = true;
            if (!inSlot) u += strain(bd);
          }
        }
      }
      if (charged() && (q[i] !== 0 || q[j] !== 0)) {
        for (const h of [i, j]) if (q[h] !== 0) eachNear(x[h], y[h], o => {
          if (o === h || q[o] === 0 || bonds.has(key(h, o))) return;
          if (h === j && o === i) return;                    // the pair once
          const d = Math.hypot(sep(x[o] - x[h], W), sep(y[o] - y[h], H));
          if (d < CHARGE_R) u += S.charge * q[h] * q[o] * chargePsi(d);
        });
      }
      if (S.stick > 0) {
        for (const h of [i, j]) eachNear(x[h], y[h], o => {
          if (o === h || (h === j && o === i)) return;
          const d = Math.hypot(sep(x[o] - x[h], W), sep(y[o] - y[h], H)), c0 = r[h] + r[o];
          if (d <= c0) { u -= S.stick; return; }
          if (d >= c0 + STICK_R) return;
          const t = (d - c0) / STICK_R, w = 1 - t * t;
          u -= S.stick * w * w;
        });
      }
      return u;
    }
    /* Heat for a change the pair caused: given, or taken from what they hold,
       and the books told of any shortfall. */
    function payPair(a, b, dU) {
      if (dU === 0) return;
      if (dU < 0) { const wa = m[a] / (m[a] + m[b]); heat[a] -= dU * wa; heat[b] -= dU * (1 - wa); return; }
      const have = heat[a] + heat[b], take = Math.min(dU, have);
      if (have > 0) { const share = take / have; heat[a] -= heat[a] * share; heat[b] -= heat[b] * share; }
      tally.heated += dU - take;
    }
    function shakeBonds(dt) {
      if (!bonds.size) return;
      for (const [k, bd] of bonds) {
        const T = bondTemp(bd.a, bd.b);
        if (T <= 0) continue;
        /* The barrier is climbed on the way out as well as the way in. */
        const Ea = S.barrier > 0
          ? barrierAt(bd.a, bd.sa, bd.b, bd.sb, Math.atan2(sep(y[bd.b] - y[bd.a], H), sep(x[bd.b] - x[bd.a], W))) : 0;
        if (R() < BREAK_RATE * dt * Math.exp(-(bd.B + Ea) / T)) {
          const have = heat[bd.a] + heat[bd.b];
          if (have < bd.B) continue;                 // not enough heat here to pay for it
          const share = bd.B / have;
          heat[bd.a] -= heat[bd.a] * share; heat[bd.b] -= heat[bd.b] * share;
          unbond(k, bd);
        }
      }
    }

    /* ── reacting ──────────────────────────────────────────────────────────
       Only with "a bond changes what it holds" on. A bond's strength is read
       off its two ends as they are NOW — each moved on by the other bonds it
       holds — so when a third hexagon bonds to one end, this bond is worth
       something different. Worth more: the difference comes out as heat.
       Worth less: the pair's heat has to pay the difference, and if it is
       worth nothing at all the bond lets go. That is a reaction: nothing here
       says which ones happen, only the arithmetic the visitor chose. */
    function react(dt) {
      if ((S.shift === 0 && S.look === 0) || !bonds.size) return;
      const odds = REACT_RATE * dt;
      for (const [k, bd] of bonds) {
        if (R() > odds) continue;
        const a = bd.a, b = bd.b;
        const want = worth(a, b, 1) * ORDER_WORTH[bd.o || 1];
        if (want === bd.B) continue;
        const have = heat[a] + heat[b];
        if (want > bd.B) {
          const out = want - bd.B, wa = m[a] / (m[a] + m[b]);
          heat[a] += out * wa; heat[b] += out * (1 - wa);
        } else {
          const need = bd.B - want;
          if (have < need) continue;                 // too cold to rearrange; it stays as it was
          const share = need / have;
          heat[a] -= heat[a] * share; heat[b] -= heat[b] * share;
        }
        bd.B = want; tally.reacted++;
        if (want === 0) unbond(k, bd);
      }
    }

    /* ── touching ──────────────────────────────────────────────────────────
       A uniform grid finds who is near whom. A body bigger than a cell is kept
       off the grid and tested against everybody, because there are never many
       of those and one in the grid would make every cell its neighbour. */
    let cs = 2, hw = 1, hh = 1, heads = new Int32Array(1), nexts = new Int32Array(cap);
    let hx0 = 0, hy0 = 0;     // where the grid starts, kept for gatherPool
    const bigs = [];
    function buildHash() {
      let x0 = 0, y0 = 0;
      if (S.edge === "open") {
        let x1 = -Infinity, y1 = -Infinity; x0 = y0 = Infinity;
        for (let i = 0; i < n; i++) if (alive[i]) {
          if (x[i] < x0) x0 = x[i]; if (x[i] > x1) x1 = x[i];
          if (y[i] < y0) y0 = y[i]; if (y[i] > y1) y1 = y[i];
        }
        if (x0 === Infinity) { x0 = y0 = 0; x1 = y1 = 1; }
        cs = Math.max(2.4 * radiusOf(S.kinds), (x1 - x0) / 300, (y1 - y0) / 300, 1.2);
        hw = Math.floor((x1 - x0) / cs) + 1; hh = Math.floor((y1 - y0) / cs) + 1;
        hx0 = x0; hy0 = y0;
      } else {
        cs = Math.max(2.4 * radiusOf(S.kinds), 1.2);
        hw = Math.max(3, Math.floor(W / cs)); hh = Math.max(3, Math.floor(H / cs));
        hx0 = 0; hy0 = 0;
        cs = W / hw;
      }
      if (heads.length < hw * hh) heads = new Int32Array(hw * hh);
      heads.fill(-1, 0, hw * hh);
      bigs.length = 0;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        if (r[i] > cs * 0.5) { bigs.push(i); continue; }
        const ci = Math.min(hw - 1, Math.max(0, Math.floor((x[i] - x0) / cs)));
        const cj = Math.min(hh - 1, Math.max(0, Math.floor((y[i] - y0) / (S.edge === "open" ? cs : H / hh))));
        const c = cj * hw + ci;
        nexts[i] = heads[c]; heads[c] = i;
      }
    }
    function eachPair(fn) {
      for (let cj = 0; cj < hh; cj++) for (let ci = 0; ci < hw; ci++) {
        for (let i = heads[cj * hw + ci]; i >= 0; i = nexts[i]) {
          for (let j = nexts[i]; j >= 0; j = nexts[j]) fn(i, j);
          /* Half the neighbouring cells, so each pair of cells is met once. */
          for (let q = 0; q < 4; q++) {
            let ni = ci + (q === 0 ? 1 : q === 1 ? -1 : q === 2 ? 0 : 1), nj = cj + (q === 0 ? 0 : 1);
            if (wrap) { ni = (ni + hw) % hw; nj = (nj + hh) % hh; }
            else if (ni < 0 || ni >= hw || nj >= hh) continue;
            if (wrap && (hw < 3 || hh < 3)) continue;
            for (let j = heads[nj * hw + ni]; j >= 0; j = nexts[j]) fn(i, j);
          }
        }
      }
      for (let b = 0; b < bigs.length; b++) {
        const i = bigs[b];
        if (!alive[i]) continue;
        for (let j = 0; j < n; j++) {
          if (!alive[j] || j === i) continue;
          if (r[j] > cs * 0.5 && j < i) continue;     // two bigs meet once
          fn(i, j);
        }
      }
    }

    /* A split is paid for from heat already present (including energy taken
       from an impact). Surface/fracture work is kept in the energy ledger;
       another equal amount becomes relative motion, never a free explosion.
       Positions and velocities are split about the original centre of mass.
       Queue impacts until the spatial-hash walk is over: reusing a dead slot
       during that walk would corrupt its linked lists. */
    function split(i, amount, budget, ux, uy, thermal) {
      if (!alive[i] || pinned[i] || broken[i]) return false;
      if (amount < S.fragmentMass || Math.min(heat[i], budget) < 2 * S.toughness * S.fragmentMass) return false;
      let bondCost = 0;
      for (const bd of bonds.values()) if (bd.a === i || bd.b === i) bondCost += bd.B;
      const available = Math.min(heat[i], budget) - bondCost;
      amount = Math.min(amount, m[i] / 2, available / (2 * S.toughness));
      if (!(amount >= S.fragmentMass && m[i] - amount >= S.fragmentMass)) return false;
      const j = add(x[i], y[i], kind[i], 0, 0, amount);
      if (j < 0) { fragmentLimit = true; return false; }
      /* Let go of its bonds BEFORE the piece is moved. A bond hands back what
         its springs were holding, and after the move that is a different
         number: the two ends have been put somewhere else without the spring
         doing the work. Here the strain lands in heat[i] and is shared out
         with the rest of it below. */
      for (const [k, bd] of bonds) if (bd.a === i || bd.b === i) unbond(k, bd);
      if (!ux && !uy) { const angle = R() * Math.PI * 2; ux = Math.cos(angle); uy = Math.sin(angle); }
      const length = Math.hypot(ux, uy); ux /= length; uy /= length;
      const M = m[i], remain = M - amount, part = amount / M;
      const cost = S.toughness * amount, kick = cost;
      const h = Math.max(0, heat[i] - bondCost - cost - kick);
      const distance = (radiusOf(remain) + radiusOf(amount)) * 1.001;
      const speed = Math.sqrt(2 * kick / (remain * part));
      x[j] = x[i] + ux * distance * (1 - part); y[j] = y[i] + uy * distance * (1 - part);
      x[i] -= ux * distance * part; y[i] -= uy * distance * part;
      vx[j] = vx[i] + ux * speed * (1 - part); vy[j] = vy[i] + uy * speed * (1 - part);
      vx[i] -= ux * speed * part; vy[i] -= uy * speed * part;
      m[i] = remain; r[i] = radiusOf(remain);
      heat[j] = h * part; heat[i] = h - heat[j];
      // The field is held for this frame; a new/reused slot inherits its parent's acceleration.
      gax[j] = gax[i]; gay[j] = gay[i];
      broken[i] = broken[j] = 1;
      shedding[i] = Math.max(0, shedding[i] - amount);
      tally.breakWork += cost;
      if (thermal) tally.shed++; else tally.fractured++;
      return true;
    }

    function breakBodies(dt) {
      if (!S.breaking) return;
      fragmentLimit = false;
      const before = n;
      for (let i = 0; i < before; i++) {
        if (!alive[i] || pinned[i] || broken[i] || m[i] < 2 * S.fragmentMass) continue;
        if (impact[i] > 0 && split(i, m[i] / 2, impact[i], impactX[i], impactY[i], false)) continue;
        if (fragmentLimit) return;
        const T = heat[i] / m[i];
        if (T <= S.meltTemp) { shedding[i] = 0; continue; }
        // Integrate a loss of mass per second, so a small hot body can accumulate a chip
        // over several substeps instead of being immune because each substep is short.
        shedding[i] = Math.min(m[i] / 2, shedding[i] + m[i] * -Math.expm1(-dt * (T - S.meltTemp) / Math.max(1, S.meltTemp)));
        split(i, shedding[i], heat[i] - m[i] * S.meltTemp, 0, 0, true);
        if (fragmentLimit) return;
      }
    }

    function fuse(a, b) {
      /* The heavier one stays. Momentum is kept exactly; the motion the pair
         had relative to each other has nowhere to go but heat. */
      if (m[b] > m[a]) { const t = a; a = b; b = t; }
      const M = m[a] + m[b];
      const dx = sep(x[b] - x[a], W), dy = sep(y[b] - y[a], H);
      const rvx = vx[b] - vx[a], rvy = vy[b] - vy[a];
      const lost = 0.5 * (m[a] * m[b] / M) * (rvx * rvx + rvy * rvy);
      x[a] += dx * m[b] / M; y[a] += dy * m[b] / M;
      vx[a] = (m[a] * vx[a] + m[b] * vx[b]) / M; vy[a] = (m[a] * vy[a] + m[b] * vy[b]) / M;
      heat[a] += heat[b] + lost + act[a] + act[b]; act[a] = 0; act[b] = 0;
      m[a] = M; kind[a] = Math.max(1, Math.round(M)); r[a] = radiusOf(M);
      for (const [k, bd] of bonds) if (bd.a === b || bd.b === b || bd.a === a || bd.b === a) {
        heat[a] += 0; unbond(k, bd); tally.bondsBroken--;       // dissolved into the new body, not broken
      }
      alive[b] = 0; tally.fused++;
    }

    function canChip(i, energy) {
      return S.breaking && !pinned[i] && !broken[i] && m[i] >= 2 * S.fragmentMass && energy >= 2 * S.toughness * S.fragmentMass;
    }

    function touch(i, j, dt) {
      if (!alive[i] || !alive[j]) return;
      const dx = sep(x[j] - x[i], W), dy = sep(y[j] - y[i], H);
      const reach = r[i] + r[j];
      const d2 = dx * dx + dy * dy;
      if (d2 > reach * reach * 1.21) return;
      const d = Math.sqrt(d2) || 1e-9;
      const ux = dx / d, uy = dy / d;
      /* Heat moves between anything close enough to be touching. */
      if (S.conduct > 0) {
        const Ti = heat[i] / m[i], Tj = heat[j] / m[j];
        const flow = Math.min(0.5, S.conduct * 6 * dt) * (Ti - Tj) * (m[i] * m[j] / (m[i] + m[j]));
        heat[i] -= flow; heat[j] += flow;
      }
      /* Settling bonds are tried by pairs that are nearly touching, before
         and instead of anything an impact would do. */
      if (S.settle && S.bonding !== "none" && !bonds.has(key(i, j))) {
        if (S.swap && R() < 0.5) { if (trySwap(i, j, dt)) return; }
        else if (trySettle(i, j, ux, uy, reach, dt)) return;
      }
      if (S.ions && charged() && nb[i] === 0 && nb[j] === 0) tryIon(i, j, dt);
      if (d > reach) return;
      const bonded = bonds.has(key(i, j));
      const vn = (vx[j] - vx[i]) * ux + (vy[j] - vy[i]) * uy;
      /* A pinned hexagon has, as far as a collision can tell, no end of mass. */
      const ii = pinned[i] ? 0 : 1 / m[i], ij = pinned[j] ? 0 : 1 / m[j], isum = ii + ij;
      if (isum === 0) return;
      const mu = 1 / isum, held = pinned[i] || pinned[j];
      const hit = vn < 0 ? 0.5 * mu * vn * vn : 0;
      const hi = held ? 0.5 : ij / isum, hj = 1 - hi;
      const chipI = !bonded && canChip(i, hit * 0.5 * hi), chipJ = !bonded && canChip(j, hit * 0.5 * hj);
      if (!bonded && !held && !chipI && !chipJ && !impact[i] && !impact[j] && S.fuse !== "never" && (S.fuse === "always" || hit > S.fuseHit)) {
        fuse(i, j);
        return;
      }
      if (bonded) return;                         // the spring is already holding these two apart
      /* Pushed apart so they do not sit inside each other, the lighter one
         moving most, and bounced if they were closing. */
      const over = (reach - d) * 0.5;
      const wi = ii / isum, wj = ij / isum;
      /* The push moves two things that may be holding springs and charges
         with everyone else; what that changes is paid for out of their heat,
         or the push would make energy. Nothing attached, nothing to read. */
      const attached = nb[i] > 0 || nb[j] > 0 || S.stick > 0 || (charged() && (q[i] !== 0 || q[j] !== 0));
      const held0 = attached ? heldAround(i, j) : 0;
      /* Heat from the meeting is shared by mass, or evenly when one is pinned. */
      x[i] -= ux * over * 2 * wi; y[i] -= uy * over * 2 * wi;
      x[j] += ux * over * 2 * wj; y[j] += uy * over * 2 * wj;
      if (attached) payPair(i, j, heldAround(i, j) - held0);
      if (vn < 0) {
        // A fracturing impact diverts at least half its normal collision energy
        // into heat. Even a perfectly elastic material must pay for its fragments.
        const e = chipI || chipJ ? Math.min(S.bounce, Math.SQRT1_2) : S.bounce;
        const jn = -(1 + e) * vn * mu;
        vx[i] -= jn * ux * ii; vy[i] -= jn * uy * ii;
        vx[j] += jn * ux * ij; vy[j] += jn * uy * ij;
        const lost = 0.5 * mu * vn * vn * (1 - e * e);
        heat[i] += lost * hi; heat[j] += lost * hj;
        if (chipI) { impact[i] += lost * hi; impactX[i] -= ux * lost * hi; impactY[i] -= uy * lost * hi; }
        if (chipJ) { impact[j] += lost * hj; impactX[j] += ux * lost * hj; impactY[j] += uy * lost * hj; }
      }
      if (!S.settle && !chipI && !chipJ && S.bonding !== "none" && units(i) < capOf(i) && units(j) < capOf(j) && Math.abs(vn) < S.bondSpeed) {
        const a = affinity(S.bonding, kind[i], kind[j], S.kinds, siteOf(i, j, 0), siteOf(j, i, 0));
        if (a > 0 && R() < S.bondChance * Math.min(1, dt * 30)) {
          /* Which slot each end would use. With angles off this is only a
             note of who holds whom and a full list never refuses a bond; with
             them on, a bond with nowhere to sit, or one that would sit
             crooked, does not happen at all. */
          const si = slotFor(i, ux, uy), sj = slotFor(j, -ux, -uy);
          /* A barrier has to be climbed with the heat the two of them have. */
          const T = bondTemp(i, j);
          const stuck = S.barrier > 0 && !(T > 0 && R() < Math.exp(-Math.max(0, barrierAt(i, si, j, sj, Math.atan2(uy, ux)) - act[i] - act[j]) / T));
          if (!stuck && (!spun() || (si >= 0 && sj >= 0))) {
            const B = worth(i, j, 0);
            link(i, j, si, sj, B, reach);
            heat[i] += B * hi; heat[j] += B * hj;
          }
        }
      }
    }

    /* A normal random number (Box and Muller, 1958). */
    function gauss() {
      let u = R();
      while (u <= 1e-300) u = R();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307179586 * R());
    }
    function heatStep(dt) {
      const cxm = W / 2, cym = H / 2, hot = S.heater, hr = W * 0.1;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        if (hot !== "none") {
          const inHot = hot === "centre" ? Math.hypot(x[i] - cxm, y[i] - cym) < hr : y[i] > H - 2.5;
          if (inHot) {
            const want = S.heaterTemp * m[i];
            if (heat[i] < want) { tally.heated += want - heat[i]; heat[i] = want; }
          }
        }
        if (S.radiate > 0 && heat[i] > 0) {
          const out = heat[i] * Math.min(1, S.radiate * dt);
          heat[i] -= out; tally.radiated += out;
        }
        /* Heat and motion trade both ways until they are at one temperature
           — the Langevin equation, the way a molecule in a liquid is kicked
           about and held back by everything round it (Langevin 1908; the
           exact one-step form is the "O" step of Leimkuhler and Matthews,
           2013). Each velocity is pulled part way to nothing and given a
           random kick sized by the hexagon's own temperature, heat/mass:
           left alone, its motion settles at that temperature, a hot one
           speeds up and a fast one in a cold place slows and warms it. The
           change in motion is paid from, or given to, its heat exactly; if
           there is not enough heat to pay, nothing happens that step.

           Before 2026-11-14 heat only ever became motion here, and motion
           came back only through collisions, so a world had two temperatures
           that did not agree — measured, heat 0.24 against motion from 0.18
           to 0.59 in the same sticky world — and the odds bonds were made by
           (heat) were not the odds things boiled by (motion). */
        if (S.shake > 0 && !pinned[i]) {
          const T = Math.max(0, heat[i]) / m[i];
          const c = Math.exp(-S.shake * 2 * dt), sd = Math.sqrt((1 - c * c) * T / m[i]);
          const nx = c * vx[i] + sd * gauss(), ny = c * vy[i] + sd * gauss();
          const cost = 0.5 * m[i] * (nx * nx + ny * ny - vx[i] * vx[i] - vy[i] * vy[i]);
          if (cost <= heat[i]) { vx[i] = nx; vy[i] = ny; heat[i] -= cost; }
          /* The same about the middle. A free hexagon has to be able to turn,
             or it could never bring a slot round to meet anything. */
          if (spun()) {
            const I = inertia(i), sw = Math.sqrt((1 - c * c) * T / I);
            const nw = c * spin[i] + sw * gauss();
            const turnCost = 0.5 * I * (nw * nw - spin[i] * spin[i]);
            if (turnCost <= heat[i]) { spin[i] = nw; heat[i] -= turnCost; }
          }
        }
      }
    }

    function edges() {
      for (let i = 0; i < n; i++) {
        if (!alive[i] || pinned[i]) continue;
        if (wrap) {
          if (x[i] < 0) x[i] += W; else if (x[i] >= W) x[i] -= W;
          if (y[i] < 0) y[i] += H; else if (y[i] >= H) y[i] -= H;
          if (!(x[i] >= 0 && x[i] < W)) x[i] = ((x[i] % W) + W) % W;
          if (!(y[i] >= 0 && y[i] < H)) y[i] = ((y[i] % H) + H) % H;
        } else if (S.edge === "walls") {
          const e = S.bounce;
          if (x[i] < r[i]) { x[i] = r[i]; if (vx[i] < 0) { heat[i] += 0.5 * m[i] * vx[i] * vx[i] * (1 - e * e); vx[i] = -vx[i] * e; } }
          if (x[i] > W - r[i]) { x[i] = W - r[i]; if (vx[i] > 0) { heat[i] += 0.5 * m[i] * vx[i] * vx[i] * (1 - e * e); vx[i] = -vx[i] * e; } }
          if (y[i] < r[i]) { y[i] = r[i]; if (vy[i] < 0) { heat[i] += 0.5 * m[i] * vy[i] * vy[i] * (1 - e * e); vy[i] = -vy[i] * e; } }
          if (y[i] > H - r[i]) { y[i] = H - r[i]; if (vy[i] > 0) { heat[i] += 0.5 * m[i] * vy[i] * vy[i] * (1 - e * e); vy[i] = -vy[i] * e; } }
        } else if (x[i] < -W * 2 || x[i] > W * 3 || y[i] < -H * 2 || y[i] > H * 3) {
          /* Gone for good: three worlds' width out and still going. */
          for (const [k, bd] of bonds) if (bd.a === i || bd.b === i) unbond(k, bd);
          alive[i] = 0; tally.left++;
        }
      }
    }

    /* Gravity is worked out once for each call to `step` and held through its
       substeps: the field changes slowly next to how fast two hexagons bounce,
       and working it out is most of what a big world costs. */
    const gax = new Float64Array(cap), gay = new Float64Array(cap);
    function substep(dt) {
      /* The whole Verlet step first, so that everything after it (collisions,
         bonds made and broken, heat) sees positions and velocities that
         belong to the same moment. The forces are worked out afresh each
         time, because those events move things and change the bonds. */
      computeForces();
      kick(dt / 2);
      const turning = spun();
      for (let i = 0; i < n; i++) {
        if (!alive[i] || pinned[i]) continue;
        x[i] += vx[i] * dt; y[i] += vy[i] * dt;
        if (turning) face[i] += spin[i] * dt;
      }
      edges();
      computeForces();
      kick(dt / 2);
      buildHash();
      if (S.settle && S.bonding !== "none") sizePool();
      impact.fill(0); impactX.fill(0); impactY.fill(0);
      eachPair((i, j) => touch(i, j, dt));
      heatStep(dt);
      if (S.fuel > 0 && S.bonding !== "none") recharge(dt);
      breakBodies(dt);
      react(dt);
      if (S.settle && S.bonding !== "none") settleBonds(dt); else shakeBonds(dt);
      snapBonds();
      dampBonds(dt);
      /* Thick space and the speed limit come last, on the finished velocity. */
      const lim = S.limit, keep = S.drag > 0 ? Math.exp(-S.drag * dt) : 1;
      for (let i = 0; i < n; i++) {
        if (!alive[i] || pinned[i]) continue;
        if (keep < 1) {
          const before = vx[i] * vx[i] + vy[i] * vy[i];
          vx[i] *= keep; vy[i] *= keep;
          tally.dragged += 0.5 * m[i] * before * (1 - keep * keep);
        }
        const sp = Math.hypot(vx[i], vy[i]);
        if (sp > lim) { vx[i] *= lim / sp; vy[i] *= lim / sp; }
      }
      tally.time += dt;
    }

    /* One call advances `seconds` of the world's time. The step is kept short
       enough that the fastest thing in the world crosses less than a third of
       the smallest hexagon in one, so nothing tunnels through anything. */
    function step(seconds) {
      broken.fill(0); fragmentLimit = false;
      let fastest = 1;
      for (let i = 0; i < n; i++) if (alive[i]) {
        const sp = Math.abs(vx[i]) + Math.abs(vy[i]);
        if (sp > fastest) fastest = sp;
      }
      const parts = Math.min(8, Math.max(1, Math.ceil(seconds * fastest / 0.3), Math.ceil(seconds * 90)));
      const dt = seconds / parts;
      ax.fill(0); ay.fill(0);
      gravity();
      gax.set(ax); gay.set(ay);
      for (let p = 0; p < parts; p++) substep(dt);
    }

    /* What is in the world right now. Clusters are counted here, when asked,
       from the bonds — a cluster is never stored. */
    const parent = new Int32Array(cap);
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    function stats() {
      let count = 0, mass = 0, ke = 0, ht = 0, px = 0, py = 0, biggest = 0, heaviest = 0;
      const turns = spun();
      for (let i = 0; i < n; i++) {
        parent[i] = i;
        if (!alive[i]) continue;
        count++; mass += m[i]; ht += heat[i];
        ke += 0.5 * m[i] * (vx[i] * vx[i] + vy[i] * vy[i]);
        if (turns) ke += 0.5 * inertia(i) * spin[i] * spin[i];
        px += m[i] * vx[i]; py += m[i] * vy[i];
        if (m[i] > heaviest) heaviest = m[i];
      }
      /* The two springs hold energy while they are stretched or bent. Neither
         is heat and neither is motion, so the books name them: without them a
         bonded world looks like it is making energy every time it rings. */
      let be = 0, pull = 0, bend = 0;
      for (const bd of bonds.values()) {
        be += bd.B;
        const dx = sep(x[bd.b] - x[bd.a], W), dy = sep(y[bd.b] - y[bd.a], H);
        const d = Math.hypot(dx, dy) || 1e-9, off = d - bd.rest;
        const stretch = 0.5 * BOND_K * (m[bd.a] * m[bd.b] / (m[bd.a] + m[bd.b])) * off * off;
        pull += stretch; bend += strain(bd) - stretch;
        const a = find(bd.a), b = find(bd.b); if (a !== b) parent[a] = b;
      }
      /* What the newer settings hold: charged-up energy, whole charges and
         the energy of holding them, and bonds of each order. */
      let stored = 0, ionE = 0, ionCount = 0, doubles = 0, triples = 0;
      for (let i = 0; i < n; i++) if (alive[i]) {
        stored += act[i];
        if (z[i] !== 0) { ionCount++; ionE += ionEnergyOf(z[i], baseKind(i)); }
      }
      if (S.order) for (const bd of bonds.values()) { if (bd.o === 2) doubles++; else if (bd.o === 3) triples++; }
      const sizes = new Map();
      for (const bd of bonds.values()) { const f = find(bd.a); sizes.set(f, 0); }
      let clustered = 0;
      for (let i = 0; i < n; i++) if (alive[i] && nb[i] > 0) { const f = find(i); sizes.set(f, (sizes.get(f) || 0) + 1); clustered++; }
      for (const s of sizes.values()) if (s > biggest) biggest = s;
      return {
        time: tally.time, count: count, started: started, mass: mass, startMass: startMass,
        motion: ke, heat: ht, bondEnergy: be, springEnergy: pull, twistEnergy: bend,
        chargeEnergy: charged() && (bonds.size || S.ions) ? chargeEnergy() : 0,
        stickEnergy: S.stick > 0 ? stickEnergy() : 0,
        storedEnergy: stored, fed: tally.fed, ionEnergy: ionE,
        ionised: tally.ionised, swapped: tally.swapped, reordered: tally.reordered,
        ions: ionCount, doubles: doubles, triples: triples,
        temperature: mass > 0 ? ht / mass : 0,
        momentumX: px, momentumY: py, bonds: bonds.size, clusters: sizes.size, biggest: biggest,
        clustered: clustered, heaviest: heaviest,
        radiated: tally.radiated, dragged: tally.dragged, heated: tally.heated,
        fused: tally.fused, left: tally.left, bondsMade: tally.bondsMade, bondsBroken: tally.bondsBroken,
        placed: tally.placed, removed: tally.removed, reacted: tally.reacted, room: cap - count,
        fractured: tally.fractured, shed: tally.shed, fragments: tally.fractured + tally.shed,
        breakWork: tally.breakWork, fragmentLimit: fragmentLimit,
      };
    }

    /* Every bonded thing in the world, grouped by what it is made of. A thing
       is named by the kinds in it, smallest first — "1·1·4" — and nothing else:
       the list is read off the bonds when asked and never kept. This is how to
       tell whether a world is making anything new or only more of the same. */
    function census() {
      for (let i = 0; i < n; i++) parent[i] = i;
      for (const bd of bonds.values()) { const a = find(bd.a), b = find(bd.b); if (a !== b) parent[a] = b; }
      const groups = new Map();
      for (let i = 0; i < n; i++) if (alive[i] && nb[i] > 0) {
        const f = find(i);
        let g = groups.get(f); if (!g) { g = []; groups.set(f, g); }
        g.push(i);
      }
      const types = new Map();
      let free = 0;
      for (let i = 0; i < n; i++) if (alive[i] && nb[i] === 0) free++;
      for (const g of groups.values()) {
        const read = readThing(g);
        const t = types.get(read.sig);
        if (t) t.count++;
        else types.set(read.sig, { sig: read.sig, kinds: read.kinds, shape: read.shape, size: g.length, count: 1 });
      }
      const list = [...types.values()].sort((a, b) => b.count - a.count || b.size - a.size);
      return { free: free, things: groups.size, distinct: list.length, types: list };
    }

    /* What one bonded thing IS. A chain and a ring are read along themselves,
       so "1-2-3" and "1-3-2" are two different things and "3-2-1" is the same
       thing the other way round; anything that branches has no one way to
       read it, so it stays what it has always been, its kinds counted up.
       This is the only place a replicator could show: a sequence whose count
       climbs is one making more of itself. */
    const kindOf = i => ((kind[i] - 1) % S.kinds) + 1;
    function readThing(g) {
      const size = g.length;
      let ends = [], simple = true;
      for (const i of g) {
        if (nb[i] > 2) { simple = false; break; }
        if (nb[i] === 1) ends.push(i);
      }
      if (simple && size <= 12 && (ends.length === 2 || (ends.length === 0 && size >= 3))) {
        const ring = ends.length === 0;
        const seq = walk(ring ? g[0] : ends[0], size);
        if (seq) {
          const best = ring ? bestRing(seq) : bestLine(seq);
          return { sig: best.join(ring ? "\u25cb" : "-"), kinds: best, shape: ring ? "ring" : "chain" };
        }
      }
      const sorted = g.map(kindOf).sort((a, b) => a - b);
      return size > 12
        ? { sig: size + " hexagons", kinds: null, shape: "clump" }
        : { sig: sorted.join("\u00b7"), kinds: sorted, shape: "clump" };
    }
    /* Walk a chain or a ring from one hexagon to the next, by the slots. */
    function walk(start, size) {
      const seq = [kindOf(start)];
      let prev = -1, at = start;
      for (let step = 1; step < size; step++) {
        let next = -1;
        for (let sl = 0; sl < SLOTS; sl++) {
          const o = adj[at * SLOTS + sl];
          if (o >= 0 && o !== prev && alive[o]) { next = o; break; }
        }
        if (next < 0) return null;               // adjacency ran out: not a walk
        seq.push(kindOf(next)); prev = at; at = next;
      }
      return seq;
    }
    const before = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
    function bestLine(seq) {
      const back = seq.slice().reverse();
      return before(back, seq) ? back : seq;
    }
    function bestRing(seq) {
      let best = null;
      for (const way of [seq, seq.slice().reverse()]) {
        for (let r = 0; r < way.length; r++) {
          const turn = way.slice(r).concat(way.slice(0, r));
          if (!best || before(turn, best)) best = turn;
        }
      }
      return best;
    }

    /* ── a visitor's hands ─────────────────────────────────────────────────
       Putting a hexagon in, taking one out, and changing one that is there.
       None of this is physics: it is somebody reaching into the world, and the
       tallies say how often they did. */
    function place(px, py, k, pvx, pvy, mass) {
      if (wrap) { px = ((px % W) + W) % W; py = ((py % H) + H) % H; }
      k = Math.max(1, Math.round(k || 1));
      const i = add(px, py, k, pvx, pvy, mass && mass > 0 ? mass : k);
      if (i >= 0) tally.placed++;
      return i;
    }
    function loosen(i) { for (const [k, bd] of bonds) if (bd.a === i || bd.b === i) unbond(k, bd); }
    function remove(i) {
      if (i < 0 || i >= n || !alive[i]) return false;
      loosen(i); alive[i] = 0; pinned[i] = 0; tally.removed++;
      return true;
    }
    function edit(i, change) {
      if (i < 0 || i >= n || !alive[i]) return false;
      const T = heat[i] / m[i];
      if (change.kind != null) kind[i] = Math.max(1, Math.round(change.kind));
      if (change.mass != null && change.mass > 0) { m[i] = change.mass; r[i] = radiusOf(m[i]); heat[i] = T * m[i]; }
      if (change.temperature != null) heat[i] = Math.max(0, change.temperature) * m[i];
      if (change.vx != null) vx[i] = change.vx;
      if (change.vy != null) vy[i] = change.vy;
      if (change.pinned != null) { pinned[i] = change.pinned ? 1 : 0; if (pinned[i]) { vx[i] = 0; vy[i] = 0; spin[i] = 0; } }
      if (change.facing != null && isFinite(change.facing)) face[i] = change.facing;
      if (change.spin != null && isFinite(change.spin)) spin[i] = change.spin;
      if (change.loosen) loosen(i);
      return true;
    }
    /* Everything within `reach` of a point, nearest first. */
    function near(px, py, reach) {
      const out = [];
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const d = Math.hypot(sep(px - x[i], W), sep(py - y[i], H)) - r[i];
        if (d < reach) out.push([d, i]);
      }
      return out.sort((a, b) => a[0] - b[0]).map(o => o[1]);
    }
    function warm(px, py, reach, by) {
      let touched = 0;
      for (const i of near(px, py, reach)) { heat[i] = Math.max(0, heat[i] + by * m[i]); touched++; }
      return touched;
    }

    /* The body under a point, for the inspector. */
    function at(px, py) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const d = Math.hypot(sep(px - x[i], W), sep(py - y[i], H)) - r[i];
        if (d < bd) { bd = d; best = i; }
      }
      return bd < 0.6 ? best : -1;
    }
    function describe(i) {
      if (i < 0 || !alive[i]) return null;
      const with_ = [];
      for (const bd of bonds.values()) if (bd.a === i || bd.b === i) with_.push({ other: bd.a === i ? bd.b : bd.a, strength: bd.B, order: bd.o || 1 });
      return { id: i, kind: kind[i], mass: m[i], temperature: heat[i] / m[i], heat: heat[i],
               speed: Math.hypot(vx[i], vy[i]), bonds: with_, pinned: !!pinned[i],
               facing: face[i], spin: spin[i], turning: spun(),
               /* How many bonds it can hold, and with "set by the kind", its
                  pull (null when every kind is the same). */
               canHold: capOf(i), pull: S.bondsPer === "kind" || charged() ? kindPull(baseKind(i)) : null,
               charge: charged() ? q[i] : null,
               ion: S.ions ? z[i] : null, stored: S.fuel > 0 ? act[i] : null,
               /* The kind it bonds as right now, moved on by the bonds it
                  holds and by the kind of the one it is holding. */
               actsAs: ((kind[i] - 1 + siteOf(i, -1, 0)) % S.kinds) + 1 };
    }

    return {
      settings: S, width: W, height: H, cap: cap,
      x: x, y: y, vx: vx, vy: vy, m: m, r: r, heat: heat, kind: kind, nb: nb, alive: alive, pinned: pinned, bonds: bonds,
      face: face, spin: spin, slots: adj, SLOTS: SLOTS,
      get n() { return n; },
      step: step, stats: stats, at: at, describe: describe, census: census,
      place: place, remove: remove, edit: edit, near: near, warm: warm,
      /* The clock and a few others can be turned while it runs. */
      set: function (k, v) { const next = clean(Object.assign({}, S, { [k]: v })); S[k] = next[k]; },
    };
  }

  return { SCHEMA: SCHEMA, DEFAULTS: DEFAULTS, PRESETS: PRESETS, clean: clean, create: create, affinity: affinity,
           valence: valence, pull: pull, polar: polar };
});
