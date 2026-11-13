/* WORLD BUILDER — THE PEOPLE SANDBOX
   ────────────────────────────────────────────────────────────────────────
   A piece of land, some villages, and a few hundred people who each need to
   eat. Everything else is what they do about it. They farm, make things,
   carry goods between villages, stand guard, talk to whoever they meet, fall
   out, pair up, have children, grow old and die — and the factions, wars,
   elections and breakaways are added up from those lives, never placed.

   The rule the whole file keeps, and it is Ric's from KONDRITE's living world
   ("it needs to be able to happen through the collectives of the people.
   Nothing forced or faked"): **no function here starts a war, a famine or a
   rebellion on a timer.** A leader weighs real numbers — hunger, grievances
   that real thefts and killings left, how tired their own people are — and a
   village breaks away only when the people living in it have stopped being
   loyal, one by one, each for their own reasons.

   And what somebody says is a report of what just happened between two
   people — the food that changed hands, the news that was passed on, the
   mind that was changed. A line never makes anything happen.

   Every setting on the page is read somewhere below; test/people.test.mjs
   walks the list and checks each one changes the world it makes.

   One file, no dependencies, the same in a browser and in node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WBPeople = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DAY_SECONDS = 1200;         // Ric, 2026-11-12: a day at 1× takes twenty minutes
  const YEAR = 200;                 // ticks in a year
  const pct = v => Math.round(v * 100) + "%";
  const scale = (words) => v => words[Math.min(words.length - 1, Math.floor(v * words.length))];

  const SCHEMA = [
    { title: "The land", items: [
      { key: "map", label: "How much land", type: "select", def: "medium",
        options: [["small", "A valley"], ["medium", "A country"], ["large", "A continent"]] },
      { key: "rich", label: "How much it grows", type: "range", min: 0.2, max: 2, step: 0.05, def: 1,
        say: v => (v < 0.6 ? "thin soil" : v < 1.3 ? "decent land" : "it grows anything"),
        help: "How fast food grows back on a field. Thin soil means people run out of land sooner." },
      { key: "uneven", label: "How uneven it is", type: "range", min: 0, max: 1, step: 0.05, def: 0.6,
        say: scale(["the same everywhere", "gentle", "good valleys and bad hills", "rich pockets in a waste"]),
        help: "Uneven land gives some villages more than others." },
      { key: "seed", label: "Seed", type: "range", min: 1, max: 9999, step: 1, def: 11,
        say: v => "#" + v, help: "The same seed and settings start the same world." },
    ]},
    { title: "The people", items: [
      { key: "people", label: "How many people", type: "range", min: 20, max: 2000, step: 10, def: 400, curve: 2,
        say: v => v.toLocaleString("en-US"), help: "How many are alive when it starts." },
      { key: "factions", label: "How many factions", type: "range", min: 1, max: 8, step: 1, def: 4,
        say: v => (v === 1 ? "one people" : v + " factions"), help: "They may not stay this many." },
      { key: "villages", label: "Villages each", type: "range", min: 1, max: 4, step: 1, def: 2,
        say: v => (v === 1 ? "one village" : v + " villages") },
      { key: "crowd", label: "A full village", type: "range", min: 20, max: 200, step: 5, def: 70,
        say: v => v + " people", help: "Past this, some of them leave to found a new one — if there is land left." },
    ]},
    { title: "Lives", items: [
      { key: "life", label: "How long they live", type: "range", min: 20, max: 120, step: 1, def: 60,
        say: v => "about " + v + " years", help: "Short lives turn generations over fast: nobody remembers the last war." },
      { key: "grown", label: "Grown up at", type: "range", min: 6, max: 25, step: 1, def: 14,
        say: v => v + " years", help: "Until then they work at nothing and eat from their parents' share." },
      { key: "births", label: "Children", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["none — this is the last generation", "few", "enough to replace themselves", "many", "as many as they can feed"]),
        help: "How readily a fed, paired couple has a child." },
      { key: "hunger", label: "Going hungry", type: "range", min: 0.2, max: 3, step: 0.1, def: 1,
        say: v => (v < 0.7 ? "they last a long time" : v < 1.6 ? "weeks to live" : "days to live"),
        help: "How quickly somebody with no food dies." },
      { key: "plague", label: "Sickness", type: "select", def: "rare",
        options: [["none", "None"], ["rare", "Now and then"], ["common", "Often"]],
        help: "A sickness starts in one person and passes to whoever they talk to." },
    ]},
    { title: "Money", items: [
      { key: "money", label: "How they trade", type: "select", def: "coins",
        options: [["coins", "Coins and markets"], ["shared", "No money — a shared store"]],
        help: "With a shared store everybody puts in what they grow and takes what they need." },
      { key: "coins", when: s => s.money === "coins", label: "Coins each to start", type: "range", min: 0, max: 40, step: 1, def: 8,
        say: v => v + " coins" },
      { key: "unequal", when: s => s.money === "coins", label: "Who starts rich", type: "range", min: 0, max: 1, step: 0.05, def: 0.3,
        say: scale(["everybody the same", "some a little more", "a few rich families", "one in ten owns most of it"]) },
      { key: "prices", when: s => s.money === "coins", label: "Prices", type: "select", def: "float",
        options: [["float", "Rise when things run short"], ["fixed", "Fixed by law"]],
        help: "A fixed price cannot tell a farmer the village is hungry." },
      { key: "tax", when: s => s.money === "coins", label: "Tax", type: "range", min: 0, max: 0.6, step: 0.02, def: 0.12,
        say: v => (v === 0 ? "none" : pct(v) + " of every sale"), help: "What a faction takes to pay its soldiers. Leaders move it once the world is running." },
      { key: "inherit", when: s => s.money === "coins", label: "When somebody dies", type: "select", def: "kids",
        options: [["kids", "Their children get their coins"], ["faction", "Their faction takes them"], ["village", "Shared round the village"]] },
    ]},
    { title: "Minds", items: [
      { key: "talk", label: "How much they talk", type: "range", min: 0, max: 1, step: 0.05, def: 0.6,
        say: scale(["never", "rarely", "now and then", "often", "to everybody they pass"]),
        help: "News, opinions, friendships and sickness all travel by talking." },
      { key: "stubborn", label: "How stubborn they are", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["they believe the last person they spoke to", "open", "set in their ways", "nobody changes anybody's mind"]) },
      { key: "divided", label: "How far apart they start", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["everybody agrees", "some difference", "divided", "two camps"]),
        help: "The one thing they argue about: should what is grown be shared out, or does each keep their own?" },
      { key: "memory", label: "How many people they remember", type: "range", min: 2, max: 30, step: 1, def: 10,
        say: v => v + " people", help: "Friends and grudges both count." },
      { key: "switch", label: "Changing sides", type: "range", min: 0, max: 1, step: 0.05, def: 0.4,
        say: scale(["never", "almost never", "if life is better there", "easily"]),
        help: "How readily an unhappy person joins the faction of somebody who is doing better." },
    ]},
    { title: "Power", items: [
      { key: "rule", label: "Who leads", type: "select", def: "elected",
        options: [["elected", "Whoever they vote for"], ["chief", "A chief for life, then their child"], ["rich", "Whoever is richest"]] },
      { key: "term", when: s => s.rule === "elected", label: "A vote every", type: "range", min: 1, max: 20, step: 1, def: 6,
        say: v => v + (v === 1 ? " year" : " years"), help: "Only where leaders are voted for." },
      { key: "loyalty", label: "How loyal they are", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["they owe nobody anything", "grudging", "ordinary", "devoted", "whatever is done to them"]) },
      { key: "rebel", label: "Breaking away", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["never", "only in despair", "when a village has had enough", "at the first grievance"]),
        help: "How unhappy a village has to be before it declares itself its own faction." },
    ]},
    { title: "War", items: [
      { key: "war", label: "Wars", type: "toggle", def: true, help: "Off, no leader may start one, whatever is done to them." },
      { key: "aggression", when: s => s.war, label: "How quick to fight", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["only when cornered", "slow to anger", "ordinary", "touchy", "over anything"]) },
      { key: "soldiers", label: "Soldiers in peacetime", type: "range", min: 0, max: 0.4, step: 0.01, def: 0.08,
        say: v => (v === 0 ? "none" : "1 in " + Math.round(1 / v)), help: "They do not farm, and somebody has to pay them." },
      { key: "deadly", when: s => s.war, label: "How deadly a fight is", type: "range", min: 0.1, max: 3, step: 0.1, def: 1,
        say: v => (v < 0.6 ? "mostly bruises" : v < 1.6 ? "people die" : "few walk away") },
    ]},
    { title: "Time", items: [
      { key: "rate", label: "Clock", type: "range", min: 0.25, max: 16, step: 0.25, def: 1, curve: 2,
        say: v => v + "×", help: "At 1× one day takes twenty minutes. You can change this while it runs." },
    ]},
  ];

  const DEFAULTS = {};
  for (const g of SCHEMA) for (const it of g.items) DEFAULTS[it.key] = it.def;

  const PRESETS = [
    { id: "plain", name: "An ordinary country", note: "Four factions, coins, votes, and room to grow.", set: {} },
    { id: "crowded", name: "Too many people", note: "Thin soil and a lot of mouths. Watch what land is worth.",
      set: { people: 900, rich: 0.5, map: "small", factions: 5, aggression: 0.7 } },
    { id: "commune", name: "No money", note: "One shared store per village, and everybody agrees. For now.",
      set: { money: "shared", divided: 0.15, factions: 3, rule: "elected", tax: 0 } },
    { id: "kings", name: "Chiefs and soldiers", note: "Rule for life, one in five under arms, short tempers.",
      set: { rule: "chief", soldiers: 0.2, aggression: 0.85, loyalty: 0.7, rebel: 0.3, tax: 0.3, unequal: 0.8 } },
    { id: "mayfly", name: "Short lives", note: "Twenty-five years each. Generations turn over while you watch.",
      set: { life: 25, grown: 8, births: 0.8, people: 500, rate: 2 } },
    { id: "one", name: "One people", note: "A single faction on a continent. Does it stay one?",
      set: { factions: 1, villages: 4, map: "large", people: 600, rebel: 0.7, divided: 0.9, loyalty: 0.3 } },
    { id: "quiet", name: "A quiet world", note: "No war, no sickness, generous land.",
      set: { war: false, plague: "none", rich: 1.6, aggression: 0, rebel: 0.1 } },
  ];

  function clean(input) {
    const S = {};
    for (const g of SCHEMA) for (const it of g.items) {
      let v = input && it.key in input ? input[it.key] : it.def;
      if (it.type === "range") {
        v = Number(v);
        if (!isFinite(v)) v = it.def;
        v = Math.min(it.max, Math.max(it.min, v));
      } else if (it.type === "toggle") {
        v = v === true || v === "true" || v === 1 || v === "1";
      } else if (!it.options.some(o => o[0] === v)) v = it.def;
      S[it.key] = v;
    }
    for (const k of ["people", "factions", "villages", "crowd", "life", "grown", "memory", "term", "seed"]) S[k] = Math.round(S[k]);
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

  const MAPS = { small: [44, 28], medium: [68, 42], large: [100, 62] };
  const COLOURS = ["#e0a340", "#5aa9e6", "#d9605a", "#7fc87a", "#b58be0", "#e58fb6", "#4fc3b0", "#c9c36a",
                   "#f08a4b", "#8fa3ff", "#b7d36b", "#e4dccb"];
  const ONSETS = ["b", "d", "f", "g", "h", "k", "l", "m", "n", "p", "r", "s", "t", "v", "w", "y", "br", "dr", "th", "sh", "st", "el", "or", "an", ""];
  const VOWELS = ["a", "e", "i", "o", "u", "ae", "ia", "ei", "ou"];
  const ENDS = ["", "", "n", "r", "s", "l", "th", "k", "m", "d"];
  const F_FIRST = ["Hollow", "Ashen", "Long", "High", "Salt", "Green", "Iron", "Quiet", "Red", "Low", "Bright", "Stone", "Far", "Winter", "Amber", "Deep"];
  const F_LAST = ["Reach", "Compact", "Hearth", "League", "Crown", "March", "Fold", "Accord", "Hold", "Kin", "Banner", "Commons", "Vale", "Watch"];

  /* How fast things happen, per tick. Kept together so the one place a number
     is tuned is the one place it is written. */
  const EAT = 2 / YEAR;             // food one person eats
  const WALK = 0.15;                // tiles walked
  const CARRY = 3.6;                // food one trip to the fields brings back
  const TILE_CAP = 3.2;             // food a perfect field holds
  const REGROW = TILE_CAP / 130;    // and how fast it comes back
  const WAGE = 0.2;                 // coins a soldier is paid, every twenty ticks
  // Equipment uses the existing goods economy. Costs are goods converted into
  // the item, not coins minted or a second resource appearing from nowhere.
  const GEAR = {
    tool: { name: "Work tool", cost: 0.6, jobs: ["farmer", "crafter"], wear: 0.003, benefit: "+25% harvest capacity; +20% goods per batch" },
    pack: { name: "Trade pack", cost: 0.8, jobs: ["trader"], wear: 0.004, benefit: "Carry up to 5 trade goods instead of 3" },
    weapon: { name: "Weapon", cost: 1, jobs: ["soldier"], wear: 0.01, benefit: "+25% damage on a successful hit" },
    shield: { name: "Shield", cost: 1, jobs: ["soldier"], wear: 0.01, benefit: "25% less damage from a successful hit" }
  };
  const PATCH = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

  function create(input) {
    const S = clean(input);
    const R = rng(S.seed * 1597334677);
    const cols = MAPS[S.map][0], rows = MAPS[S.map][1];
    const tiles = cols * rows;
    const fert = new Float32Array(tiles), ore = new Float32Array(tiles), stock = new Float32Array(tiles);
    const owner = new Int16Array(tiles).fill(-1);
    const buckets = []; for (let i = 0; i < tiles; i++) buckets.push([]);

    const people = [], byId = new Map();
    const villages = [], factions = [];
    const events = [], chatter = [], history = [];
    const count = { births: 0, old: 0, starved: 0, battle: 0, sick: 0, talks: 0, switched: 0, moved: 0,
                    wars: 0, peaces: 0, secessions: 0, elections: 0, captures: 0, founded: 0, fallen: 0, thefts: 0, minted: 0 };
    let t = 0, nextId = 1, nextExchange = 1, usedNames = new Set();

    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const pick = a => a[Math.floor(R() * a.length)];
    const tileAt = (x, y) => clamp(Math.floor(y), 0, rows - 1) * cols + clamp(Math.floor(x), 0, cols - 1);
    const year = () => t / YEAR;

    function word(parts) {
      let s = "";
      for (let i = 0; i < parts; i++) s += pick(ONSETS) + pick(VOWELS);
      s += pick(ENDS);
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    function unique(make) {
      for (let i = 0; i < 40; i++) { const n = make(); if (!usedNames.has(n)) { usedNames.add(n); return n; } }
      const n = make() + " " + (usedNames.size + 1); usedNames.add(n); return n;
    }

    /* ── the land ──────────────────────────────────────────────────────────
       Smooth noise, three sizes of lump added together. Fertility is how much
       a field holds and how fast it grows back; ore is what the crafters use. */
    (function land() {
      const layer = (cell) => {
        const gw = Math.ceil(cols / cell) + 2, gh = Math.ceil(rows / cell) + 2;
        const g = new Float32Array(gw * gh);
        for (let i = 0; i < g.length; i++) g[i] = R();
        return (x, y) => {
          const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
          const ux = fx - ix, uy = fy - iy, sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy);
          const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
          return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
        };
      };
      const f1 = layer(14), f2 = layer(6), f3 = layer(3), o1 = layer(9), o2 = layer(4);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const n = f1(x, y) * 0.55 + f2(x, y) * 0.3 + f3(x, y) * 0.15;
        const i = y * cols + x;
        fert[i] = clamp(0.55 + (n - 0.5) * 2.4 * S.uneven, 0.04, 1);
        ore[i] = clamp((o1(x, y) * 0.7 + o2(x, y) * 0.3 - 0.45) * 3, 0, 1);
        stock[i] = fert[i] * TILE_CAP * 0.8;
      }
    })();

    /* ── who and what there is ─────────────────────────────────────────── */
    function newFaction(name, leaderViews) {
      const f = { id: factions.length, name: name, colour: COLOURS[factions.length % COLOURS.length],
                  leader: 0, treasury: 0, tax: S.tax, relief: false, army: S.soldiers,
                  rel: {}, alive: true, founded: t, voteAt: t + S.term * YEAR * (0.5 + R() * 0.5),
                  views: leaderViews || 0, target: {}, pop: 0, soldiers: 0, hungry: 0, loyal: 0.6 };
      factions.push(f);
      for (const o of factions) if (o !== f) { f.rel[o.id] = blankRel(); o.rel[f.id] = blankRel(); }
      return f;
    }
    function blankRel() { return { op: 0, war: false, since: 0, grief: 0, dead: 0, peaceAt: -1e9 }; }
    function newVillage(x, y, f) {
      const v = { id: villages.length, name: unique(() => word(2)), x: x, y: y, f: f, food: 0, goods: 0, till: 0,
                  priceFood: 1, priceGoods: 2, pop: 0, adults: 0, hungry: 0, loyal: 0.6, ore: 0, siege: 0,
                  alive: true, founded: t, radius: 4, sick: 0 };
      let o = 0, c = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { o += ore[tileAt(x + dx, y + dy)]; c++; }
      v.ore = o / c;
      villages.push(v);
      return v;
    }
    function newPerson(v, age, mum, dad) {
      const f = factions[v.f];
      const p = { id: nextId++, name: unique(() => word(R() < 0.5 ? 2 : 3)), age: age, f: v.f, home: v.id, born: t,
                  dieAt: S.life * (0.72 + R() * 0.56), job: "child", x: v.x + (R() - 0.5) * v.radius * 1.5, y: v.y + (R() - 0.5) * v.radius * 1.5,
                  tx: v.x, ty: v.y, task: "idle", wait: Math.floor(R() * 30), food: 0.8 + R() * 0.6, coins: 0, goods: 0, gear: {},
                  hp: 1, bold: R(), warm: R(), greed: R(), views: 0, loyal: clamp(0.35 + S.loyalty * 0.5 + (R() - 0.5) * 0.2, 0, 1),
                  mood: 0.6, friends: new Map(), partner: 0, mum: mum ? mum.id : 0, dad: dad ? dad.id : 0, kids: 0,
                  talk: Math.floor(R() * 40), say: "", sayT: 0, talkingTo: 0, cargo: null, hungry: 0, news: -1, sick: 0, immune: false,
                  unpaid: 0, hit: 0, from: v.f, ate: -999, at: v.id };
      if (mum && dad) {
        p.bold = clamp((mum.bold + dad.bold) / 2 + (R() - 0.5) * 0.3, 0, 1);
        p.warm = clamp((mum.warm + dad.warm) / 2 + (R() - 0.5) * 0.3, 0, 1);
        p.greed = clamp((mum.greed + dad.greed) / 2 + (R() - 0.5) * 0.3, 0, 1);
        p.views = clamp((mum.views + dad.views) / 2 + (R() - 0.5) * 0.4, -1, 1);
      } else {
        /* Divided worlds start as two camps, pulled toward wherever their own
           faction leans, so the argument is between places as well as people. */
        const camp = R() < 0.5 ? -1 : 1;
        p.views = clamp(f.views * 0.5 + camp * S.divided * 0.7 + (R() - 0.5) * (0.3 + S.divided * 0.5), -1, 1);
      }
      people.push(p); byId.set(p.id, p);
      return p;
    }

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const adult = p => p.age >= S.grown;
    const atWar = (a, b) => a !== b && factions[a].rel[b] && factions[a].rel[b].war;
    const shared = S.money === "shared";

    function note(kind, text, weight, x, y, f) {
      const e = { id: events.length ? events[events.length - 1].id + 1 : 0, t: t, year: Math.floor(year()), kind: kind, text: text,
                  weight: weight, x: x, y: y, f: f == null ? -1 : f };
      events.push(e);
      /* The record is finite and the least important goes first — the same
         rule KONDRITE's living world keeps. */
      if (events.length > 400) {
        let worst = 0;
        for (let i = 1; i < events.length - 50; i++) if (events[i].weight < events[worst].weight) worst = i;
        events.splice(worst, 1);
      }
      return e;
    }

    /* ── the start ─────────────────────────────────────────────────────── */
    (function settle() {
      const want = S.factions * S.villages;
      const spots = [];
      for (let tries = 0; tries < 6000 && spots.length < want; tries++) {
        const x = 3 + R() * (cols - 6), y = 3 + R() * (rows - 6);
        if (fert[tileAt(x, y)] < 0.35 && tries < 4000) continue;
        const gap = Math.max(5, Math.sqrt(tiles / want) * 0.62) * (tries > 3000 ? 0.6 : 1);
        if (spots.some(s => Math.hypot(s.x - x, s.y - y) < gap)) continue;
        spots.push({ x: x, y: y });
      }
      /* Each faction takes a seed spot and then the spots nearest to it, so a
         faction's villages start as neighbours. */
      const taken = new Set();
      const groups = [];
      for (let f = 0; f < S.factions && taken.size < spots.length; f++) {
        let first = -1, far = -1;
        for (let i = 0; i < spots.length; i++) {
          if (taken.has(i)) continue;
          let d = 1e9;
          for (const g of groups) d = Math.min(d, Math.hypot(spots[i].x - g[0].x, spots[i].y - g[0].y));
          if (d > far) { far = d; first = i; }
        }
        taken.add(first); groups.push([spots[first]]);
      }
      for (let round = 1; round < S.villages; round++) for (const g of groups) {
        let best = -1, bd = 1e9;
        for (let i = 0; i < spots.length; i++) {
          if (taken.has(i)) continue;
          const d = Math.hypot(spots[i].x - g[0].x, spots[i].y - g[0].y);
          if (d < bd) { bd = d; best = i; }
        }
        if (best >= 0) { taken.add(best); g.push(spots[best]); }
      }
      const fnames = new Set();
      for (const g of groups) {
        let name; do { name = pick(F_FIRST) + " " + pick(F_LAST); } while (fnames.has(name));
        fnames.add(name);
        const f = newFaction(name, (R() - 0.5) * 2 * S.divided);
        for (const s of g) newVillage(s.x, s.y, f.id);
      }
      for (let i = 0; i < S.people; i++) {
        const v = villages[i % villages.length];
        const p = newPerson(v, R() * S.life * 0.75, null, null);
        /* Unequal starts are a long tail: most near nothing, a few a lot. The
           total is the same either way, so the setting moves coins, not mints them. */
        const tail = Math.pow(R(), 1 + S.unequal * 8) * (1 + S.unequal * 8);
        p.coins = shared ? 0 : S.coins * ((1 - S.unequal) + S.unequal * tail * 1.6);
        if (adult(p)) p.job = "farmer";
      }
      for (const v of villages) {
        v.food = 0; let n = 0;
        for (const p of people) if (p.home === v.id) n++;
        v.food = n * 0.8; v.goods = n * 0.1; v.till = shared ? 0 : n * 2 + 5;
      }
      for (const f of factions) f.treasury = shared ? 0 : 10;
      count.minted = money();
      territory();
      census();
      for (const f of factions) succeed(f, "first");
      for (const p of people) if (adult(p)) p.job = chooseJob(p);
      /* A quarter of the grown-ups start paired, so the first children are not
         fourteen years away. */
      for (const v of villages) {
        const single = people.filter(p => p.home === v.id && adult(p) && p.age < p.dieAt * 0.7);
        const couples = [];
        for (let i = 0; i + 1 < single.length; i += 2) if (R() < 0.5) {
          single[i].partner = single[i + 1].id; single[i + 1].partner = single[i].id;
          couples.push([single[i], single[i + 1]]);
        }
        /* And the children who are here on the first day belong to somebody,
           or nobody would feed them. */
        const grown = people.filter(p => p.home === v.id && adult(p));
        for (const c of people) {
          if (c.home !== v.id || adult(c)) continue;
          const old = couples.filter(k => k[0].age > c.age + S.grown && k[1].age > c.age + S.grown);
          if (old.length) { const k = pick(old); c.mum = k[0].id; c.dad = k[1].id; k[0].kids++; k[1].kids++; }
          else if (grown.length) { const g = pick(grown); c.mum = g.id; g.kids++; }
        }
      }
      sample();
    })();

    function money() {
      let c = 0;
      for (const p of people) c += p.coins;
      for (const v of villages) c += v.till;
      for (const f of factions) c += f.treasury;
      return c;
    }

    /* ── land and head counts ──────────────────────────────────────────── */
    function territory() {
      for (const v of villages) v.radius = v.alive ? 2.6 + Math.sqrt(Math.max(1, v.pop)) * 0.55 : 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        let best = -1, bd = 1e9;
        for (const v of villages) {
          if (!v.alive) continue;
          const d = Math.hypot(v.x - x - 0.5, v.y - y - 0.5);
          if (d < v.radius && d / v.radius < bd) { bd = d / v.radius; best = v.id; }
        }
        owner[y * cols + x] = best;
      }
    }
    function census() {
      for (const v of villages) { v.pop = 0; v.adults = 0; v.hungry = 0; v.loyal = 0; v.sick = 0; }
      for (const f of factions) { f.pop = 0; f.soldiers = 0; f.hungry = 0; f.loyal = 0; f.adults = 0; }
      for (const p of people) {
        const v = villages[p.home], f = factions[p.f];
        v.pop++; f.pop++;
        if (p.hungry > 0) { v.hungry++; f.hungry++; }
        if (p.sick > 0) v.sick++;
        if (adult(p)) { v.adults++; v.loyal += p.loyal; f.adults++; f.loyal += p.loyal; if (p.job === "soldier") f.soldiers++; }
      }
      for (const v of villages) v.loyal = v.adults ? v.loyal / v.adults : 0.6;
      for (const f of factions) f.loyal = f.adults ? f.loyal / f.adults : 0.6;
    }
    function sample() {
      const row = { year: year(), pop: {} };
      for (const f of factions) if (f.alive) row.pop[f.id] = f.pop;
      history.push(row);
      if (history.length > 600) history.splice(0, history.length - 600);
    }

    /* ── work ──────────────────────────────────────────────────────────── */
    function chooseJob(p) {
      const v = villages[p.home], f = factions[p.f];
      if (f.adults > 0 && f.soldiers < f.army * f.adults && p.bold > 0.35 && R() < 0.8) { f.soldiers++; return "soldier"; }
      const short = v.food < v.pop * 0.5;
      if (short) return "farmer";
      const roll = R();
      /* A village with more food than it can eat can afford people who do
         something else. */
      const plenty = v.food > v.pop * 2 ? 2 : 1;
      const craft = (0.08 + v.ore * 0.35) * plenty, trade = (shared ? 0.05 : 0.04 + p.greed * 0.1) * plenty;
      if (roll < craft) return "crafter";
      if (roll < craft + trade && villages.filter(o => o.alive).length > 1) return "trader";
      return "farmer";
    }
    function go(p, x, y, task) {
      p.tx = clamp(x, 0.5, cols - 0.5); p.ty = clamp(y, 0.5, rows - 0.5); p.task = task;
      // A destination is a place beside somebody, not a claim on their body.
      if (!free(p, p.tx, p.ty)) {
        search: for (let ring = 1; ring <= 6; ring++) for (let k = 0; k < 16; k++) {
          const a = (k / 16 + p.id * 0.618) * Math.PI * 2;
          const nx = x + Math.cos(a) * BODY * ring, ny = y + Math.sin(a) * BODY * ring;
          if (free(p, nx, ny)) { p.tx = nx; p.ty = ny; break search; }
        }
      }
      p.lastDistance = Infinity; p.stuck = 0;
    }
    function near(p, v, spread) { go(p, v.x + (R() - 0.5) * spread, v.y + (R() - 0.5) * spread, "idle"); p.wait = 10 + Math.floor(R() * 30); }

    function pickField(p, v) {
      let best = -1, bs = 0.25;
      for (let i = 0; i < 7; i++) {
        const a = R() * 6.2832, d = Math.sqrt(R()) * v.radius;
        const x = v.x + Math.cos(a) * d, y = v.y + Math.sin(a) * d;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const ti = tileAt(x, y);
        if (owner[ti] !== v.id && owner[ti] !== -1) continue;
        if (stock[ti] > bs) { bs = stock[ti]; best = ti; }
      }
      return best;
    }

    /* Buying and selling. Every coin that leaves a hand arrives in a till or a
       treasury, so the total never changes — the test adds it up every year. */
    function buy(p, v, what, amount) {
      const have = what === "food" ? v.food : v.goods;
      amount = Math.min(amount, have);
      if (amount <= 0.01) return 0;
      if (!shared) {
        const price = what === "food" ? v.priceFood : v.priceGoods;
        amount = Math.min(amount, p.coins / price);
        if (amount <= 0.01) return 0;
        const cost = amount * price, tax = cost * factions[v.f].tax;
        p.coins -= cost; v.till += cost - tax; factions[v.f].treasury += tax;
      }
      if (what === "food") { v.food -= amount; p.food += amount; } else { v.goods -= amount; p.goods += amount; }
      return amount;
    }
    function sell(p, v, what, amount) {
      if (amount <= 0.01) return 0;
      if (!shared) {
        const price = (what === "food" ? v.priceFood : v.priceGoods) * 0.85;
        amount = Math.min(amount, v.till / price);
        if (amount <= 0.01) return 0;
        /* Tax is taken on a sale as well as a purchase: most of what moves in
           a farming village is grain going into the store. */
        const pay = amount * price, tax = pay * factions[v.f].tax;
        v.till -= pay; p.coins += pay - tax; factions[v.f].treasury += tax;
      }
      if (what === "food") v.food += amount; else v.goods += amount;
      return amount;
    }
    /* What somebody does on reaching their own village: put in, take out. */
    function shop(p, v) {
      if (v.f !== p.f && atWar(v.f, p.f)) return;
      if (p.food < 0.6) {
        buy(p, v, "food", 1.1 - p.food);
        const f = factions[v.f];
        if (p.food < 0.2 && !shared && f.relief && v.f === p.f) {
          /* Relief: the treasury buys bread for somebody who cannot. */
          const amount = Math.min(0.6, v.food), cost = amount * v.priceFood;
          if (amount > 0.05 && f.treasury >= cost) { f.treasury -= cost; v.till += cost; v.food -= amount; p.food += amount; }
        }
      }
      outfit(p, v);
      if (p.goods < 0.15 && (shared ? v.goods > v.pop * 0.05 : p.coins > v.priceGoods * 3)) buy(p, v, "goods", 1);
    }
    function equipped(p, key) { return GEAR[key].jobs.includes(p.job) && (p.gear[key] || 0) > 0; }
    function equipment(p) {
      return Object.keys(p.gear).map(key => ({ key, name: GEAR[key].name, condition: p.gear[key],
        equipped: equipped(p, key), benefit: GEAR[key].benefit, cost: GEAR[key].cost }));
    }
    function outfit(p, v) {
      // Fit/repair an item only at a real village, after feeding the household.
      // Shop transactions preserve money; partial unaffordable goods stay owned.
      if (!adult(p) || p.hp <= 0 || p.food < 0.6 || dist(p, v) > 2.5 || atWar(p.f, v.f)) return;
      for (const [key, spec] of Object.entries(GEAR)) {
        if (!spec.jobs.includes(p.job) || (p.gear[key] || 0) > 0.25) continue;
        const condition = p.gear[key] || 0, needed = spec.cost * (1 - condition);
        if (p.goods < needed) buy(p, v, "goods", needed - p.goods);
        if (p.goods + 1e-10 < needed) continue;
        p.goods = Math.max(0, p.goods - needed); p.gear[key] = 1;
      }
    }
    function wear(p, key) { if (equipped(p, key)) p.gear[key] = Math.max(0, p.gear[key] - GEAR[key].wear); }
    const harvestCapacity = p => CARRY * (equipped(p, "tool") ? 1.25 : 1);
    const tradeCapacity = p => equipped(p, "pack") ? 5 : 3;
    const craftOutput = (p, v) => (0.35 + v.ore * 1.1) * (equipped(p, "tool") ? 1.2 : 1);
    function strike(p, foe, base) {
      const damage = base * (equipped(p, "weapon") ? 1.25 : 1) * (equipped(foe, "shield") ? 0.75 : 1);
      foe.hp -= damage; wear(p, "weapon"); wear(foe, "shield");
      return damage;
    }

    function work(p) {
      const v = villages[p.home];
      /* Before anything else: somebody with an empty bag goes home to eat —
         once, and then gets on with it, so a village with nothing to give does
         not hold its farmers at the door. */
      if (p.task === "eat") { shop(p, v); p.task = "idle"; p.wait = 2; return; }
      if (p.food < 0.4 && adult(p) && !p.cargo && t - p.ate > 60) {
        p.ate = t; go(p, v.x + (R() - 0.5), v.y + (R() - 0.5), "eat"); p.wait = 0; return;
      }
      if (p.job === "farmer") {
        if (p.task === "idle") {
          /* With a full larder and nobody buying, a farmer takes the day off —
             which is when the talking gets done. */
          if (p.food > 4 + p.kids) { near(p, v, 3); p.wait = 25 + Math.floor(R() * 40); return; }
          const ti = pickField(p, v);
          if (ti < 0) { near(p, v, 3); return; }
          go(p, (ti % cols) + 0.2 + R() * 0.6, Math.floor(ti / cols) + 0.2 + R() * 0.6, "field");
        } else if (p.task === "field") {
          if (!p.harvesting) { p.harvesting = true; p.wait = 25; return; }
          p.harvesting = false;
          /* A day's work covers the field they are standing in and the ones
             round it. */
          const fx = Math.floor(p.x), fy = Math.floor(p.y);
          const capacity = harvestCapacity(p);
          let need = capacity;
          for (let k = 0; k < 9 && need > 0.01; k++) {
            const x = fx + PATCH[k][0], y = fy + PATCH[k][1];
            if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
            const ti = y * cols + x, got = Math.min(stock[ti], need);
            stock[ti] -= got; need -= got;
          }
          p.food += capacity - need;
          if (capacity > need) wear(p, "tool");
          p.wait = 6; go(p, v.x + (R() - 0.5) * 1.5, v.y + (R() - 0.5) * 1.5, "home");
        } else if (p.task === "home") {
          const keep = 1.1 + p.kids * 0.5;
          if (p.food > keep) { const sold = sell(p, v, "food", p.food - keep); p.food -= sold; }
          shop(p, v);
          p.task = "idle"; p.wait = 4 + Math.floor(R() * 14);
        }
      } else if (p.job === "crafter") {
        if (p.task === "idle") { go(p, v.x + (R() - 0.5) * 2, v.y + (R() - 0.5) * 2, "make"); }
        else {
          const made = craftOutput(p, v);
          wear(p, "tool");
          p.goods += made;
          if (p.goods > 1) { const sold = sell(p, v, "goods", p.goods - 1); p.goods -= sold; }
          shop(p, v);
          p.task = "idle"; p.wait = 30 + Math.floor(R() * 20);
        }
      } else if (p.job === "trader") {
        trade(p);
      } else if (p.job === "soldier") {
        soldier(p);
      } else {
        const mum = byId.get(p.mum);
        if (mum && mum.home === p.home && R() < 0.5) { go(p, mum.x + (R() - 0.5) * 2, mum.y + (R() - 0.5) * 2, "idle"); p.wait = 10; }
        else near(p, v, 4);
      }
    }

    /* A trader buys where a thing is cheap and walks it to where it is dear.
       With no money they carry food from the fullest store to the emptiest. */
    function trade(p) {
      const here = villages[p.at];
      if (p.task === "carry") {
        if (p.cargo) {
          const got = sell(p, here, p.cargo.what, p.cargo.amount);
          if (p.cargo.what === "food") p.food += p.cargo.amount - got; else p.goods += p.cargo.amount - got;
          if (here.f !== p.f && got > 0) { factions[here.f].rel[p.f].op = clamp(factions[here.f].rel[p.f].op + 0.012, -1, 1); factions[p.f].rel[here.f].op = clamp(factions[p.f].rel[here.f].op + 0.012, -1, 1); }
          p.cargo = null; wear(p, "pack");
        }
        shop(p, here);
        p.task = "idle"; p.wait = 8;
        return;
      }
      shop(p, here);
      let best = null, gain = shared ? 0.25 : 0.3, what = "food";
      for (const o of villages) {
        if (!o.alive || o === here) continue;
        if (o.f !== p.f && (atWar(o.f, p.f) || shared)) continue;
        const d = Math.hypot(o.x - here.x, o.y - here.y);
        if (d > 34) continue;
        if (shared) {
          const g = here.food / (here.pop + 1) - o.food / (o.pop + 1);
          if (g > gain) { gain = g; best = o; what = "food"; }
        } else {
          for (const w of ["food", "goods"]) {
            const g = ((w === "food" ? o.priceFood : o.priceGoods) * 0.85 - (w === "food" ? here.priceFood : here.priceGoods)) / (1 + d * 0.02);
            if (g > gain && (w === "food" ? here.food : here.goods) > 1) { gain = g; best = o; what = w; }
          }
        }
      }
      if (!best) {
        /* Nothing worth carrying from here: go home, or try the next village. */
        const home = villages[p.home];
        if (here !== home) { p.at = home.id; go(p, home.x, home.y, "carry"); }
        else { shop(p, here); near(p, here, 2); p.wait = 40; }
        return;
      }
      const before = what === "food" ? p.food : p.goods;
      const got = buy(p, here, what, tradeCapacity(p));
      if (what === "food") p.food = before; else p.goods = before;
      if (got <= 0.01) { near(p, here, 2); p.wait = 40; return; }
      p.cargo = { what: what, amount: got };
      p.at = best.id; go(p, best.x + (R() - 0.5), best.y + (R() - 0.5), "carry");
    }

    /* ── soldiers ──────────────────────────────────────────────────────── */
    function foeNear(p, reach) {
      let best = null, bd = reach;
      const cx = Math.floor(p.x), cy = Math.floor(p.y), k = Math.ceil(reach);
      for (let y = Math.max(0, cy - k); y <= Math.min(rows - 1, cy + k); y++)
        for (let x = Math.max(0, cx - k); x <= Math.min(cols - 1, cx + k); x++) {
          const b = buckets[y * cols + x];
          for (let i = 0; i < b.length; i++) {
            const q = b[i];
            if (q.job !== "soldier" || q.hp <= 0 || !atWar(p.f, q.f)) continue;
            const d = dist(p, q);
            if (d < bd) { bd = d; best = q; }
          }
        }
      return best;
    }
    function soldier(p) {
      const f = factions[p.f], home = villages[p.home];
      const foe = foeNear(p, 3);
      if (foe) {
        if (dist(p, foe) < 0.8) {
          p.hit = 6;
          if (R() < 0.07 * S.deadly) {
            strike(p, foe, 0.35 + R() * 0.45);
            if (foe.hp <= 0) die(foe, "battle", p);
          }
          p.task = "idle"; p.wait = 0;
        } else go(p, foe.x, foe.y, "fight");
        return;
      }
      let enemy = -1;
      for (const o of factions) if (o.alive && atWar(f.id, o.id)) { enemy = o.id; break; }
      if (enemy >= 0 && p.id % 3 !== 0) {
        const goal = villages[f.target[enemy]];
        if (goal && goal.alive && goal.f === enemy) { go(p, goal.x + (R() - 0.5) * 2, goal.y + (R() - 0.5) * 2, "march"); p.wait = 0; return; }
      }
      if (p.food < 0.5 && dist(p, home) > 1.5) { go(p, home.x + (R() - 0.5), home.y + (R() - 0.5), "patrol"); p.wait = 0; return; }
      if (dist(p, home) < 1.5) shop(p, home);
      const a = R() * 6.2832, d = home.radius * (0.4 + R() * 0.6);
      go(p, home.x + Math.cos(a) * d, home.y + Math.sin(a) * d, "patrol"); p.wait = 6;
    }

    /* ── dying, and what is left behind ────────────────────────────────── */
    function die(p, why, by) {
      if (p.hp === -99) return;
      p.hp = -99;
      count[why]++;
      const v = villages[p.home], f = factions[p.f];
      if (p.cargo) { if (p.cargo.what === "food") v.food += p.cargo.amount; else v.goods += p.cargo.amount; }
      v.food += p.food; v.goods += p.goods;
      // Remaining usable material returns to the village; worn material is gone.
      for (const [key, condition] of Object.entries(p.gear)) v.goods += GEAR[key].cost * condition;
      p.gear = {};
      /* Coins. */
      if (p.coins > 0) {
        let heirs = [];
        if (S.inherit === "kids") {
          heirs = people.filter(q => q.hp !== -99 && (q.mum === p.id || q.dad === p.id));
          if (!heirs.length && p.partner && byId.get(p.partner)) heirs = [byId.get(p.partner)];
        } else if (S.inherit === "village") heirs = people.filter(q => q.hp !== -99 && q.home === p.home && q !== p);
        if (heirs.length) for (const h of heirs) h.coins += p.coins / heirs.length;
        else f.treasury += p.coins;
        p.coins = 0;
      }
      const mate = byId.get(p.partner);
      if (mate) { mate.partner = 0; mate.mood -= 0.2; mate.say = "I miss " + p.name + "."; mate.sayT = 80; }
      if (why === "battle" && by) {
        const rel = f.rel[by.f];
        if (rel) { rel.dead++; rel.grief = clamp(rel.grief + 0.02, 0, 3); }
        /* Friends of the dead do not forgive the faction that did it. */
        for (const id of p.friends.keys()) {
          const q = byId.get(id);
          if (q && p.friends.get(id) > 0.2 && q.f !== by.f) { q.loyal = clamp(q.loyal + 0.05, 0, 1); q.mood -= 0.08; }
        }
      }
      if (f.leader === p.id) succeed(f, why);
    }

    function succeed(f, why) {
      const old = byId.get(f.leader);
      const pool = people.filter(q => q.hp !== -99 && q.f === f.id && adult(q));
      if (!pool.length) { f.leader = 0; return; }
      let next = null;
      if (S.rule === "chief" && old) next = pool.filter(q => q.mum === old.id || q.dad === old.id).sort((a, b) => b.age - a.age)[0];
      if (!next && S.rule === "rich") next = pool.slice().sort((a, b) => b.coins - a.coins || b.friends.size - a.friends.size)[0];
      if (!next && S.rule === "elected" && why !== "first") { vote(f, why === "old" || why === "sick" || why === "starved" || why === "battle"); return; }
      if (!next) next = pool.slice().sort((a, b) => (b.bold + b.friends.size * 0.1) - (a.bold + a.friends.size * 0.1))[0];
      f.leader = next.id; f.views = next.views;
      if (why !== "first") note("leader", next.name + " now leads " + f.name + (old ? ", after " + old.name + (why === "old" ? " died of old age" : why === "battle" ? " was killed" : why === "sick" ? " died of the sickness" : why === "starved" ? " starved" : "") : "") + ".", 3, villages[next.home].x, villages[next.home].y, f.id);
    }

    /* A vote. Everybody grown picks whoever thinks most like them, with a
       thumb on the scale for a friend and for a leader they are content with. */
    function vote(f, vacant) {
      const pool = people.filter(q => q.hp !== -99 && q.f === f.id && adult(q));
      f.voteAt = t + S.term * YEAR;
      if (pool.length < 3) { if (pool.length) { f.leader = pool[0].id; f.views = pool[0].views; } return; }
      const sitting = vacant ? null : byId.get(f.leader);
      const stand = pool.slice().sort((a, b) => (b.friends.size + b.bold * 3) - (a.friends.size + a.bold * 3)).slice(0, 3);
      if (sitting && stand.indexOf(sitting) < 0) stand.push(sitting);
      const tally = stand.map(() => 0);
      for (const q of pool) {
        let best = 0, bs = -1e9;
        for (let i = 0; i < stand.length; i++) {
          const c = stand[i];
          let s = -Math.abs(q.views - c.views) + (q.friends.get(c.id) || 0) * 0.6 + (R() - 0.5) * 0.2;
          if (c === sitting) s += (q.loyal - 0.5) * 1.2;
          if (c === q) s += 0.3;
          if (s > bs) { bs = s; best = i; }
        }
        tally[best]++;
      }
      let win = 0;
      for (let i = 1; i < stand.length; i++) if (tally[i] > tally[win]) win = i;
      const w = stand[win];
      count.elections++;
      const share = Math.round(tally[win] / pool.length * 100);
      if (w === sitting) note("vote", f.name + " kept " + w.name + " as leader, with " + share + "% of the vote.", 1.5, villages[w.home].x, villages[w.home].y, f.id);
      else note("vote", f.name + " voted in " + w.name + " with " + share + "%" + (sitting ? ", turning out " + sitting.name : "") + ".", 3, villages[w.home].x, villages[w.home].y, f.id);
      f.leader = w.id; f.views = w.views;
      /* A new leader is a fresh start for the people who chose them. */
      if (w !== sitting) for (const q of pool) q.loyal = clamp(q.loyal + 0.12 - Math.abs(q.views - w.views) * 0.1, 0, 1);
    }

    /* ── talking ───────────────────────────────────────────────────────── */
    function befriend(a, b, by) {
      const set = (p, q) => {
        const v = clamp((p.friends.get(q.id) || 0) + by, -1, 1);
        p.friends.set(q.id, v);
        if (p.friends.size > S.memory) {
          /* Somebody has to be forgotten: whoever they feel least about. */
          let drop = 0, weakest = 9;
          for (const [id, s] of p.friends) if (id !== q.id && Math.abs(s) < weakest) { weakest = Math.abs(s); drop = id; }
          p.friends.delete(drop);
        }
      };
      set(a, b); set(b, a);
    }
    const leans = p => (p.views > 0.25 ? "share" : p.views < -0.25 ? "keep" : "middle");
    function said(a, b, kind, la, lb) {
      a.say = la; a.sayT = 30; b.say = lb || ""; b.sayT = 30;
      a.talkingTo = b.id; b.talkingTo = a.id;
      chatter.push({ id: nextExchange++, day: Math.max(elapsed / DAY_SECONDS, t / YEAR * 365), t: t, kind: kind, a: a.id, b: b.id, an: a.name, bn: b.name, fa: a.f, fb: b.f, la: la, lb: lb || "", x: a.x, y: a.y });
      if (chatter.length > 160) chatter.splice(0, chatter.length - 160);
    }
    function kin(a, b) {
      return a.mum === b.id || a.dad === b.id || b.mum === a.id || b.dad === a.id ||
             (a.mum && a.mum === b.mum) || (a.dad && a.dad === b.dad);
    }

    // Receipts surround the whole interaction: several branches speak before
    // moving house or changing friendship. Capture after return, without RNG calls
    // or model writes, so reading an exchange cannot change its outcome.
    function conversationState(p, other) {
      return { id: p.id, name: p.name, age: Math.floor(p.age), job: p.job,
        home: villages[p.home].name, faction: factions[p.f].name,
        food: p.food, coins: p.coins, goods: p.goods, views: p.views, loyal: p.loyal,
        trust: p.friends.get(other.id) || 0, partner: byId.get(p.partner)?.name || "None",
        news: p.news, sick: p.sick > 0, hungry: p.hungry > 0 };
    }
    function converse(a, b) {
      const before = [conversationState(a, b), conversationState(b, a)], previous = nextExchange;
      const diplomacy = a.f !== b.f ? [factions[a.f], factions[b.f]].map((f, i) => {
        const other = i === 0 ? b.f : a.f;
        return { faction: f, other, value: f.rel[other].op };
      }) : [];
      exchange(a, b);
      const c = chatter[chatter.length - 1];
      if (!c || c.id < previous) return;
      const after = [conversationState(a, b), conversationState(b, a)];
      c.people = before; c.effects = [];
      for (let i = 0; i < before.length; i++) {
        const old = before[i], now = after[i];
        for (const field of ["food", "coins", "goods", "views", "loyal", "trust", "home", "faction", "job", "partner", "news", "sick"]) {
          if (typeof old[field] === "number" ? Math.abs(now[field] - old[field]) < 1e-12 : now[field] === old[field]) continue;
          c.effects.push({ person: old.id, name: old.name, field, before: old[field], after: now[field],
            detail: field === "news" ? events.find(e => e.id === now.news)?.text || "News passed on." : "" });
        }
      }
      for (const d of diplomacy) if (d.value !== d.faction.rel[d.other].op) {
        c.effects.push({ name: d.faction.name, field: "diplomacy", detail: factions[d.other].name,
          before: d.value, after: d.faction.rel[d.other].op });
      }
    }
    function exchange(a, b) {
      count.talks++;
      a.talk = 25 + Math.floor(R() * 50 * (1.2 - S.talk)); b.talk = 25 + Math.floor(R() * 50 * (1.2 - S.talk));
      const same = a.f === b.f, war = atWar(a.f, b.f);
      const fa = factions[a.f], fb = factions[b.f];
      const fr = a.friends.get(b.id) || 0;
      const like = 1 - Math.abs(a.views - b.views);          // 1 agree … −1 opposite
      const open = 1 - S.stubborn;
      /* Sickness goes where talk goes. */
      if (a.sick > 0 && !b.immune && b.sick === 0 && R() < 0.35) b.sick = 70;
      if (b.sick > 0 && !a.immune && a.sick === 0 && R() < 0.35) a.sick = 70;

      /* 1 — somebody is hungry and the other has food. */
      const hungry = a.hungry > 0 ? a : b.hungry > 0 ? b : null;
      if (hungry) {
        const other = hungry === a ? b : a;
        if (other.food > 0.9 && !war) {
          if (other.warm + (other.friends.get(hungry.id) || 0) + (other.views > 0 ? 0.3 : 0) > 0.6 + R() * 0.7) {
            other.food -= 0.4; hungry.food += 0.4; befriend(hungry, other, 0.3);
            said(hungry, other, "help", "Can you spare some grain?", "Take this. Eat.");
          } else {
            befriend(hungry, other, -0.15);
            said(hungry, other, "refuse", "Can you spare some grain?", "I've none to spare.");
          }
          return;
        }
      }
      /* 2 — two people with nobody. */
      if (adult(a) && adult(b) && !a.partner && !b.partner && !kin(a, b) && !war &&
          a.age < a.dieAt * 0.75 && b.age < b.dieAt * 0.75 && (fr > 0.1 || like > 0.3) && R() < 0.5) {
        a.partner = b.id; b.partner = a.id; befriend(a, b, 0.6);
        if (a.home !== b.home) {
          /* One of them moves, and if that crosses a border they change flags. */
          const mover = villages[a.home].pop <= villages[b.home].pop ? a : b, stay = mover === a ? b : a;
          said(a, b, "pair", "Come and live with me in " + villages[stay.home].name + ".", "I will.");
          rehome(mover, villages[stay.home], "married");
        } else said(a, b, "pair", "Stay with me.", "I will.");
        return;
      }
      /* 3 — news travels. Whoever has heard the newer thing passes it on. */
      if (a.news !== b.news && R() < 0.5) {
        const teller = a.news > b.news ? a : b, hearer = teller === a ? b : a;
        const e = events.find(ev => ev.id === teller.news);
        if (e) {
          hearer.news = teller.news;
          /* Hearing of a killing or a lost village is a grievance of your own. */
          if ((e.kind === "taken" || e.kind === "war") && e.f === hearer.f) hearer.loyal = clamp(hearer.loyal + 0.02, 0, 1);
          said(teller, hearer, "news", "Did you hear? " + e.text, pick(["No. When?", "I had not heard.", "So it's true.", "That will mean trouble."]));
          befriend(a, b, 0.05);
          return;
        }
      }
      /* 4 — across a border: one of them is doing better, and says so. */
      if (!same && !war && S.switch > 0) {
        const low = a.loyal < b.loyal ? a : b, high = low === a ? b : a;
        if (adult(low) && low.loyal < 0.3 + S.switch * 0.2 && high.mood > low.mood + 0.12 && low.id !== factions[low.f].leader) {
          if (R() < S.switch * (0.5 + open * 0.5)) {
            said(high, low, "switch", "Come over to " + factions[high.f].name + ". We eat better.", "I will. There's nothing for me here.");
            befriend(a, b, 0.4);
            rehome(low, villages[high.home], "left");
          } else said(high, low, "switch", "Come over to " + factions[high.f].name + ".", "I was born here. I'll die here.");
          return;
        }
      }
      /* 5 — at home: what they think of whoever leads them. */
      if (same && adult(a) && adult(b) && R() < 0.4) {
        const leader = byId.get(fa.leader);
        const lname = leader ? leader.name : "nobody";
        const sour = a.loyal < b.loyal ? a : b, glad = sour === a ? b : a;
        const gap = glad.loyal - sour.loyal;
        const pull = open * 0.25 * (0.5 + Math.max(0, fr));
        /* They meet somewhere between, weighted toward whoever cares more. */
        sour.loyal = clamp(sour.loyal + gap * pull * (glad.bold + 0.3), 0, 1);
        glad.loyal = clamp(glad.loyal - gap * pull * (sour.bold + 0.3), 0, 1);
        const gripe = sour.hungry > 0 ? "My children are hungry and " + lname + " does nothing."
                    : fa.tax > 0.25 ? lname + " taxes us dry."
                    : sour.from !== sour.f ? "This was never my flag."
                    : sour.loyal < 0.4 ? "What has " + lname + " ever done for " + villages[sour.home].name + "?"
                    : "I suppose " + lname + " is doing what can be done.";
        const answer = glad.loyal > 0.6 ? pick([lname + " keeps us fed. That's enough.", "Hush. " + lname + " has held this place together.", "You'd miss " + lname + " if they were gone."])
                     : pick(["You're not wrong.", "Say that quieter.", "I've thought the same."]);
        said(sour, glad, "politics", gripe, answer);
        befriend(a, b, gap < 0.3 ? 0.08 : -0.05);
        return;
      }
      /* 6 — the one argument everybody has. Children are left out of it, and
         out of politics above: they talk like children. */
      if (!adult(a) || !adult(b)) {
        const kid = adult(a) ? b : a, other = kid === a ? b : a;
        befriend(a, b, 0.1);
        said(kid, other, "small", kid.hungry > 0 ? "I'm hungry." : pick(["Race you to the fields.", "When will I be big enough to work?", "I saw soldiers on the road.", "Tell me about when you were small."]),
             adult(other) ? pick(["Go on with you.", "Soon enough.", "Stay close to the village.", "Another time."]) : pick(["You first.", "I saw them too.", "Come on."]));
        return;
      }
      if (R() < 0.6) {
        const speaker = Math.abs(a.views) >= Math.abs(b.views) ? a : b, other = speaker === a ? b : a;
        const line = leans(speaker) === "share" ? "Nobody should go hungry while the stores are full."
                   : leans(speaker) === "keep" ? "What a person grows is theirs."
                   : "There's sense on both sides.";
        if (like > 0.2 || fr > 0.3) {
          const mid = (a.views + b.views) / 2;
          a.views += (mid - a.views) * open * 0.3; b.views += (mid - b.views) * open * 0.3;
          befriend(a, b, 0.12);
          if (!same) { fa.rel[b.f].op = clamp(fa.rel[b.f].op + 0.006, -1, 1); fb.rel[a.f].op = clamp(fb.rel[a.f].op + 0.006, -1, 1); }
          said(speaker, other, "agree", line, pick(["You're right.", "I've come round to that.", "My mother said the same."]));
        } else {
          /* Too far apart: each digs in, and they like each other less. */
          a.views = clamp(a.views + Math.sign(a.views - b.views) * open * 0.04, -1, 1);
          b.views = clamp(b.views + Math.sign(b.views - a.views) * open * 0.04, -1, 1);
          befriend(a, b, -0.2 - (war ? 0.2 : 0));
          if (!same) { fa.rel[b.f].op = clamp(fa.rel[b.f].op - 0.008, -1, 1); fb.rel[a.f].op = clamp(fb.rel[a.f].op - 0.008, -1, 1); }
          said(speaker, other, "argue", line, war ? "Tell that to the ones your soldiers killed." : pick(["That's a fool's talk.", "Easy to say with a full belly.", "You'd ruin us."]));
        }
        return;
      }
      /* 7 — and otherwise, what there is to say about the day. */
      const v = villages[a.home];
      const line = v.hungry > v.pop * 0.2 ? "The stores in " + v.name + " are nearly empty."
                 : !shared && v.priceFood > 1.8 ? "Grain is " + v.priceFood.toFixed(1) + " a measure in " + v.name + " now."
                 : a.kids > 0 && R() < 0.3 ? "The children are growing fast."
                 : a.job === "trader" ? "The road was quiet."
                 : a.job === "soldier" ? (fa.army > S.soldiers * 1.5 ? "They have us drilling every day." : "Nothing moving on the border.")
                 : pick(["The fields look good this year.", "My back is finished.", "It'll be a hard season.", "Good to see you."]);
      befriend(a, b, 0.06);
      said(a, b, "small", line, pick(["It is.", "So I hear.", "Same with us.", "Mm."]));
    }

    /* Moving house — a marriage, a migration, a defection or a flight. The
       flag changes when the village's flag is different. */
    function rehome(p, v, why) {
      /* A leader does not walk out on their own faction. */
      if (v.f !== p.f && factions[p.f].leader === p.id) return;
      p.home = v.id; p.at = v.id;
      if (v.f !== p.f) {
        if (p.job === "soldier") p.job = "farmer";
        p.f = v.f; p.loyal = why === "married" ? 0.6 : 0.5; count.switched++;
      }
      count.moved++;
      p.cargo = null; go(p, v.x + (R() - 0.5) * 2, v.y + (R() - 0.5) * 2, adult(p) ? "eat" : "idle"); p.wait = 0;
    }

    /* ── one person, one tick ──────────────────────────────────────────── */
    function live(p) {
      p.age += 1 / YEAR;

      /* Eating. A child eats from whichever parent has food before it goes hungry. */
      p.food -= adult(p) ? EAT : EAT * 0.6;
      if (p.food < 0) {
        p.food = 0;
        let fed = false;
        if (!adult(p)) {
          /* Whichever parent has more. */
          const m1 = byId.get(p.mum), d1 = byId.get(p.dad);
          const par = m1 && d1 ? (m1.food >= d1.food ? m1 : d1) : (m1 || d1);
          if (par && par.food > EAT * 30) { par.food -= EAT * 30; p.food += EAT * 30; fed = true; }
        } else {
          /* And a couple eats from one pot. */
          const mate = byId.get(p.partner);
          if (mate && mate.food > 0.6) { const half = mate.food / 2; mate.food -= half; p.food += half; fed = true; }
        }
        if (!fed) {
          /* A shared store feeds anybody. Any village feeds its own children,
             orphans included, whatever it does about money. */
          const v = villages[p.home];
          if ((shared || !adult(p)) && v.food > 0.3 && v.f === p.f) { v.food -= 0.3; p.food += 0.3; fed = true; }
        }
        if (!fed) { p.hungry++; p.hp -= 0.004 * S.hunger; }
      } else {
        if (p.hungry > 0) p.hungry = Math.max(0, p.hungry - 4);
        if (p.hp < 1) p.hp = Math.min(1, p.hp + 0.004);
      }
      if (p.goods > 0) p.goods = Math.max(0, p.goods - 1 / (YEAR * 1.5));
      if (p.sick > 0) {
        p.sick--;
        if (R() < 0.0035) { die(p, "sick"); return; }
        if (p.sick === 0) p.immune = true;
      }
      if (p.hp <= 0) { die(p, "starved"); return; }
      if (p.age >= p.dieAt) { die(p, "old"); return; }
      if (p.job === "child" && adult(p)) p.job = chooseJob(p);

    }

    function activity(p) {
      const other = p.sayT > 0 && byId.get(p.talkingTo);
      if (other && other.sayT > 0 && other.talkingTo === p.id) return "Talking to " + other.name;
      const walking = Math.hypot(p.tx - p.x, p.ty - p.y) > 0.5;
      if (p.task === "field") return walking ? "Walking to field" : "Harvesting";
      if (p.task === "home") return "Bringing food home";
      if (p.task === "eat") return walking ? "Going to eat" : "Buying food";
      if (p.task === "make") return walking ? "Walking to workshop" : "Making goods";
      if (p.task === "fight") return "Fighting";
      if (p.cargo) return "Carrying goods";
      if (p.job === "soldier") return walking ? "Patrolling" : "Standing guard";
      if (p.job === "trader") return walking ? "Travelling to trade" : "Trading";
      return walking ? "Walking" : p.job === "child" ? "Playing" : "Resting";
    }

    const BODY = 0.42;
    const occupied = new Map(), placed = new Set();
    const cell = (x, y) => Math.floor(y) * cols + Math.floor(x);
    function put(p) {
      const key = cell(p.x, p.y);
      if (!occupied.has(key)) occupied.set(key, new Set());
      occupied.get(key).add(p);
    }
    function free(p, x, y) {
      if (x < 0.25 || y < 0.25 || x > cols - 0.25 || y > rows - 0.25) return false;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const list = occupied.get((Math.floor(y) + j) * cols + Math.floor(x) + i);
        if (list) for (const q of list) if (q !== p && q.hp !== -99 && (x - q.x) ** 2 + (y - q.y) ** 2 < (BODY - 1e-9) ** 2) return false;
      }
      return true;
    }
    function move(p, dx, dy) {
      // Try the heading, then slide round a neighbour rather than walking through them.
      if (free(p, p.x + dx, p.y + dy)) {
        occupied.get(cell(p.x, p.y))?.delete(p);
        p.x += dx; p.y += dy; put(p); return;
      }
      const options = [[dx * 0.7 - dy * 0.7, dy * 0.7 + dx * 0.7],
        [dx * 0.7 + dy * 0.7, dy * 0.7 - dx * 0.7], [-dy, dx], [dy, -dx]];
      for (const [mx, my] of options) if (free(p, p.x + mx, p.y + my)) {
        occupied.get(cell(p.x, p.y))?.delete(p);
        p.x += mx; p.y += my; put(p); return;
      }
    }
    let sceneTick = 0;
    function actionTick() {
      sceneTick++;
      occupied.clear();
      // Reserve existing bodies first. Only a new arrival needs placement; walking
      // already checks every step, so checking every settled body again is wasted work.
      for (const p of people) if (placed.has(p.id)) put(p);
      for (const p of people) {
        if (placed.has(p.id)) continue;
        if (!free(p, p.x, p.y)) {
          const x = p.x, y = p.y;
          search: for (let ring = 1; ring < Math.max(cols, rows) * 4; ring++) {
            const r = ring * BODY * 0.5, n = Math.ceil(6.3 * r / BODY) + 1;
            for (let k = 0; k < n; k++) {
              const a = k / n * Math.PI * 2 + p.id;
              const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
              if (free(p, nx, ny)) { p.x = nx; p.y = ny; break search; }
            }
          }
        }
        // Initial residents and newborns wait where they actually fit. Sending
        // every new person to the village centre creates an impassable crowd.
        p.tx = p.x; p.ty = p.y;
        put(p); placed.add(p.id);
      }
      for (const b of buckets) b.length = 0;
      for (const p of people) buckets[tileAt(p.x, p.y)].push(p);
      for (const p of people) if (p.hp !== -99) act(p);
    }

    function act(p) {
      if (p.sayT > 0) p.sayT--;
      if (p.hit > 0) p.hit--;
      if (p.talk > 0) p.talk--;
      /* Moving. */
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      const pace = WALK * (p.hungry > 30 ? 0.7 : 1) * (p.job === "child" ? 0.8 : 1);
      const partner = p.sayT > 0 && byId.get(p.talkingTo);
      if (partner && partner.sayT > 0 && partner.talkingTo === p.id) return;
      if (d > Math.max(pace, 0.5)) {
        p.stuck = d >= (p.lastDistance ?? Infinity) - 0.005 ? (p.stuck || 0) + 1 : 0;
        p.lastDistance = d;
        if (p.stuck > 20) go(p, p.tx, p.ty, p.task);
        else move(p, dx / d * pace, dy / d * pace);
      }
      else {
        // Shared destinations (markets, fields) are reached from beside a neighbour.
        // Do not require everyone to occupy the exact same target point.
        if (p.wait > 0) p.wait--; else work(p);
      }

      /* Talking to whoever is standing on the same ground. */
      if (p.talk === 0 && S.talk > 0 && p.task !== "fight" && p.task !== "field" && p.task !== "make" && R() < S.talk * 0.12) {
        const b = buckets[tileAt(p.x, p.y)];
        if (b.length > 1) {
          const q = b[Math.floor(R() * b.length)];
          if (q !== p && q.sayT <= 0 && q.talk === 0 && q.hp > 0 && q.age > 4 && p.age > 4) converse(p, q);
        }
      }
    }

    /* ── slower things: once every so often per person ─────────────────── */
    function reflect(p) {
      const v = villages[p.home], f = factions[p.f];
      const anyWar = Object.keys(f.rel).some(k => f.rel[k].war);
      let friendsHere = 0;
      for (const s of p.friends.values()) if (s > 0.2) friendsHere++;
      const want = (p.hungry > 0 ? 0 : 0.45) + (p.goods > 0.1 ? 0.12 : 0) + Math.min(0.15, friendsHere * 0.03) +
                   (anyWar ? 0 : 0.1) + (p.partner ? 0.08 : 0) + (0.1 - f.tax * 0.25) - (p.sick > 0 ? 0.2 : 0);
      p.mood += (clamp(want, 0, 1) - p.mood) * 0.15;
      p.mood = clamp(p.mood, 0, 1);
      /* Loyalty follows how life is going, how far the leader's mind is from
         theirs, and whether this flag was ever theirs. */
      const lead = byId.get(f.leader);
      const far = lead ? Math.abs(p.views - lead.views) : 0.5;
      const wantLoyal = p.mood * 0.85 + (S.loyalty - 0.5) * 0.7 + 0.2 - far * 0.22 - f.tax * 0.4 -
                        (p.from !== p.f ? 0.18 : 0) - Math.min(0.3, p.unpaid * 0.06);
      p.loyal += (clamp(wantLoyal, 0, 1) - p.loyal) * 0.05;

      if (!adult(p)) return;
      /* Wages. */
      if (p.job === "soldier" && !shared) {
        if (f.treasury >= WAGE) { f.treasury -= WAGE; p.coins += WAGE; p.unpaid = Math.max(0, p.unpaid - 1); }
        else if (++p.unpaid > 6 && !anyWar) { p.job = "farmer"; p.unpaid = 0; p.task = "idle"; }
      }
      if (lead === p && !shared && f.treasury >= 0.3) { f.treasury -= 0.3; p.coins += 0.3; }
      /* Starving people do something about it: steal if they are bold, and
         go somewhere better if there is somewhere. */
      /* Nobody keeps making pots while they starve. */
      if (p.hungry > 10 && (p.job === "crafter" || (p.job === "trader" && !p.cargo))) { p.job = "farmer"; p.task = "idle"; }
      if (p.hungry > 25) {
        if (p.bold > 0.6 && R() < 0.3) {
          let mark = null, md = 9;
          for (const o of villages) if (o.alive && o.f !== p.f && o.food > 2) { const d = dist(p, o); if (d < md) { md = d; mark = o; } }
          if (mark) {
            mark.food -= 1; p.food += 1; count.thefts++;
            const rel = factions[mark.f].rel[p.f];
            rel.grief = clamp(rel.grief + 0.05, 0, 3); rel.op = clamp(rel.op - 0.02, -1, 1);
            p.say = "They won't miss it."; p.sayT = 60;
            return;
          }
        }
        if (p.hungry > 50 && f.leader !== p.id && R() < 0.4) {
          let best = null, bs = v.food / (v.pop + 1) + 0.25;
          for (const o of villages) {
            if (!o.alive || o === v || atWar(o.f, p.f) || dist(p, o) > 18) continue;
            if (o.f !== p.f && R() > S.switch) continue;
            const s = o.food / (o.pop + 1);
            if (s > bs) { bs = s; best = o; }
          }
          if (best) {
            p.say = "There's food in " + best.name + ". I'm going."; p.sayT = 80;
            const kids = people.filter(q => (q.mum === p.id || q.dad === p.id) && !adult(q) && q.hp > 0);
            rehome(p, best, "hungry");
            for (const k of kids) rehome(k, best, "hungry");
          }
        }
      }
      /* Children. */
      const mate = byId.get(p.partner);
      if (mate && p.id < mate.id && mate.home === p.home && S.births > 0 && people.length < 3000 &&
          p.age < p.dieAt * 0.7 && mate.age < mate.dieAt * 0.7 && p.food > 0.5 && mate.food > 0.5 && p.hungry === 0) {
        const room = clamp(1.6 - v.pop / (S.crowd * 1.6), 0.15, 1) * (v.hungry > v.pop * 0.15 ? 0.3 : 1);
        /* Scaled to how long they have: a short-lived people has its children
           quickly, so the setting means the same number of them either way. */
        const span = Math.max(3, S.life * 0.7 - S.grown);
        if (R() < S.births * 1.4 * room / span / (1 + p.kids * 0.12)) {
          const c = newPerson(v, 0, p, mate);
          c.x = p.x; c.y = p.y; c.from = p.f; c.f = p.f;
          p.kids++; mate.kids++; count.births++;
          p.say = c.name + " was born today."; p.sayT = 90;
        }
      }
      /* Now and then, think again about what to do for a living. */
      if (R() < 0.03 && p.job !== "soldier" && !p.cargo && p.id !== f.leader) {
        const was = p.job; p.job = chooseJob(p);
        if (p.job !== was) { p.task = "idle"; p.at = p.home; }
      }
    }

    /* ── villages ──────────────────────────────────────────────────────── */
    function market(v) {
      if (S.prices === "float" && !shared) {
        v.priceFood = clamp(Math.pow((v.pop * 0.5 + 1) / Math.max(v.food, 0.4), 0.6), 0.3, 7);
        v.priceGoods = clamp(2 * Math.pow((v.pop * 0.12 + 1) / Math.max(v.goods, 0.3), 0.5), 0.6, 9);
      } else { v.priceFood = 1; v.priceGoods = 2; }
    }
    function villageTurn(v) {
      if (v.pop === 0) {
        if (++v.empty > 6) {
          v.alive = false;
          note("gone", v.name + " stands empty.", 2, v.x, v.y, v.f);
          const f = factions[v.f];
          f.treasury += v.till; v.till = 0;
          if (!villages.some(o => o.alive && o.f === v.f)) fall(f, -1);
        }
        return;
      }
      v.empty = 0;
      /* Sickness starts in one person. */
      const odds = S.plague === "none" ? 0 : S.plague === "rare" ? 0.004 : 0.02;
      if (v.sick === 0 && R() < odds) {
        const here = people.filter(p => p.home === v.id && !p.immune);
        if (here.length > 8) { pick(here).sick = 70; note("sick", "A sickness has started in " + v.name + ".", 2, v.x, v.y, v.f); }
      }
      if (v.hungry > v.pop * 0.4 && v.pop > 8 && (v.famine || 0) < t - YEAR * 3) {
        v.famine = t; note("famine", v.name + " is starving.", 2.5, v.x, v.y, v.f);
      }
      /* Under the walls: soldiers of a faction at war with this one, and
         nobody of ours near enough to stop them. */
      let ours = 0; const theirs = {};
      const k = 3;
      for (let y = Math.max(0, Math.floor(v.y) - k); y <= Math.min(rows - 1, Math.floor(v.y) + k); y++)
        for (let x = Math.max(0, Math.floor(v.x) - k); x <= Math.min(cols - 1, Math.floor(v.x) + k); x++)
          for (const p of buckets[y * cols + x]) {
            if (p.job !== "soldier") continue;
            if (p.f === v.f) ours++; else if (atWar(p.f, v.f)) theirs[p.f] = (theirs[p.f] || 0) + 1;
          }
      const sides = Object.keys(theirs);
      if (sides.length && ours === 0) {
        v.siege += 1;
        if (v.siege >= 4) { sides.sort((a, b) => theirs[b] - theirs[a]); capture(v, factions[+sides[0]]); }
      } else v.siege = Math.max(0, v.siege - 1);

      /* Too full: some of them go and start somewhere new, if there is land. */
      if (v.pop > S.crowd && R() < 0.25) found(v);
      /* Had enough: see `secede`. */
      if (S.rebel > 0 && v.adults >= 10 && v.loyal < 0.15 + S.rebel * 0.4 && (v.broke || 0) < t - YEAR * 4) secede(v);
    }

    function found(v) {
      let best = null, bs = 0.45;
      for (let i = 0; i < 24; i++) {
        const a = R() * 6.2832, d = v.radius + 3 + R() * 9;
        const x = v.x + Math.cos(a) * d, y = v.y + Math.sin(a) * d;
        if (x < 3 || y < 3 || x > cols - 3 || y > rows - 3) continue;
        if (villages.some(o => o.alive && Math.hypot(o.x - x, o.y - y) < o.radius + 3.5)) continue;
        let s = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s += fert[tileAt(x + dx, y + dy)];
        s /= 25;
        if (s > bs) { bs = s; best = { x: x, y: y }; }
      }
      const f = factions[v.f];
      if (!best) {
        /* No land left. That is a pressure a leader can feel — see `decide`. */
        f.cramped = t;
        return;
      }
      const goers = people.filter(p => p.home === v.id && adult(p) && p.id !== f.leader && p.job !== "soldier")
        .sort((a, b) => b.bold - a.bold).slice(0, Math.max(6, Math.floor(v.pop * 0.22)));
      if (goers.length < 4) return;
      const nv = newVillage(best.x, best.y, v.f);
      const share = goers.length / v.pop;
      nv.food = v.food * share; v.food -= nv.food;
      nv.till = v.till * share; v.till -= nv.till;
      for (const p of goers) {
        rehome(p, nv, "founded");
        for (const q of people) if ((q.mum === p.id || q.dad === p.id) && !adult(q) && q.home === v.id) rehome(q, nv, "founded");
      }
      count.founded++;
      note("founded", goers[0].name + " led " + goers.length + " families out of " + v.name + " to found " + nv.name + ".", 2, nv.x, nv.y, v.f);
      territory();
    }

    /* A village that has stopped being loyal, person by person, declares
       itself. Nothing calls this on a clock: it runs only when the people
       living there have, on average, given up on the flag over them. */
    function secede(v) {
      const f = factions[v.f];
      const here = people.filter(p => p.home === v.id && adult(p));
      if (here.some(p => p.id === f.leader)) {
        /* The leader lives here and has lost the place: that is a leader
           turned out, not a breakaway. */
        v.broke = t;
        const old = byId.get(f.leader);
        if (S.rule === "elected") vote(f, false);
        else {
          const next = here.filter(p => p !== old).sort((a, b) => (b.bold + b.friends.size * 0.1) - (a.bold + a.friends.size * 0.1))[0];
          if (!next) return;
          f.leader = next.id; f.views = next.views;
          note("coup", next.name + " has thrown " + (old ? old.name : "the old leader") + " out and taken " + f.name + ".", 3.5, v.x, v.y, f.id);
          for (const p of people) if (p.f === f.id) p.loyal = clamp(p.loyal + 0.2 - Math.abs(p.views - next.views) * 0.15, 0, 1);
        }
        return;
      }
      if (!villages.some(o => o.alive && o.f === v.f && o !== v)) return;
      const rebels = here.filter(p => p.loyal < 0.5);
      if (rebels.length < 6) return;
      const head = rebels.slice().sort((a, b) => (b.bold + b.friends.size * 0.1) - (a.bold + a.friends.size * 0.1))[0];
      const names = new Set(factions.map(o => o.name));
      let name; do { name = R() < 0.5 ? "Free " + v.name : pick(F_FIRST) + " " + pick(F_LAST); } while (names.has(name) && names.size < 150);
      const nf = newFaction(name, head.views);
      nf.treasury = 0; nf.tax = Math.min(f.tax, S.tax); nf.leader = head.id;
      v.f = nf.id; v.broke = t; v.siege = 0;
      const refuge = villages.filter(o => o.alive && o.f === f.id).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
      let stayed = 0, leftN = 0;
      for (const p of people) {
        if (p.home !== v.id) continue;
        const parent = !adult(p) ? (byId.get(p.mum) || byId.get(p.dad)) : null;
        const joins = adult(p) ? p.loyal < 0.5 : !parent || parent.loyal < 0.5;
        if (joins) { p.f = nf.id; p.from = nf.id; p.loyal = 0.75; if (p.job === "soldier") p.job = "farmer"; stayed++; }
        else { rehome(p, refuge, "fled"); leftN++; }
      }
      nf.rel[f.id].grief = 0.5; nf.rel[f.id].op = -0.5; f.rel[nf.id].grief = 0.9; f.rel[nf.id].op = -0.6;
      count.secessions++;
      note("secede", v.name + " has broken from " + f.name + " under " + head.name + " and calls itself " + nf.name + "." + (leftN ? " " + leftN + " who stayed loyal have left." : ""), 4, v.x, v.y, nf.id);
      census();
    }

    function capture(v, by) {
      const old = factions[v.f];
      const refuge = villages.filter(o => o.alive && o.f === old.id && o !== v).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
      v.f = by.id; v.siege = 0; v.broke = t;
      /* The winners take a share of what was in the store and the till. */
      by.treasury += v.till * 0.5; v.till *= 0.5;
      let fled = 0, stayed = 0;
      for (const p of people) {
        if (p.home !== v.id) continue;
        if (refuge && (p.job === "soldier" || p.id === old.leader || R() < 0.3 + p.loyal * 0.4)) { rehome(p, refuge, "fled"); fled++; }
        else {
          if (p.id === old.leader) continue;
          if (p.job === "soldier") p.job = "farmer";
          p.f = by.id; p.loyal = 0.12 + R() * 0.15; p.mood -= 0.2; stayed++; count.switched++;
        }
      }
      old.rel[by.id].grief = clamp(old.rel[by.id].grief + 0.6, 0, 3);
      count.captures++;
      note("taken", by.name + " has taken " + v.name + " from " + old.name + "." + (fled ? " " + fled + " fled." : ""), 3.5, v.x, v.y, by.id);
      if (!villages.some(o => o.alive && o.f === old.id)) fall(old, by.id);
      territory(); census();
    }

    function fall(f, to) {
      if (!f.alive) return;
      f.alive = false; count.fallen++;
      for (const o of factions) { if (o.rel[f.id]) o.rel[f.id].war = false; if (f.rel[o.id]) f.rel[o.id].war = false; }
      const heir = to >= 0 ? factions[to] : factions.filter(o => o.alive).sort((a, b) => b.pop - a.pop)[0];
      if (heir) heir.treasury += f.treasury;
      f.treasury = 0;
      for (const p of people) if (p.f === f.id && heir) {
        const v = villages.filter(o => o.alive && o.f === heir.id).sort((a, b) => dist(p, a) - dist(p, b))[0];
        if (!v) continue;
        if (p.job === "soldier") p.job = "farmer";
        p.f = heir.id; p.home = v.id; p.at = v.id; p.loyal = 0.2; p.task = "idle"; p.cargo = null; count.switched++;
      }
      note("fell", f.name + " is no more" + (heir && to >= 0 ? "; its people now answer to " + heir.name : "") + ".", 4.5, 0, 0, f.id);
    }

    /* ── leaders ───────────────────────────────────────────────────────────
       Read the numbers, feel the pressures, take at most one step. A war
       needs a grievance that something real left behind, a leader bold enough,
       and the strength to think it can be won. */
    function border(a, b) {
      let d = 1e9, pair = null;
      for (const va of villages) if (va.alive && va.f === a.id) for (const vb of villages) if (vb.alive && vb.f === b.id) {
        const dd = Math.hypot(va.x - vb.x, va.y - vb.y);
        if (dd < d) { d = dd; pair = [va, vb]; }
      }
      return { d: d, pair: pair };
    }
    function decide(f) {
      const lead = byId.get(f.leader);
      if (!lead || lead.hp === -99 || lead.f !== f.id) { succeed(f, "left"); return; }
      if (S.rule === "elected" && t >= f.voteAt) vote(f, false);
      if (S.rule === "rich") {
        const top = people.filter(q => q.f === f.id && adult(q)).sort((a, b) => b.coins - a.coins)[0];
        if (top && top !== lead && top.coins > lead.coins * 1.5 + 5) { f.leader = top.id; f.views = top.views; note("leader", top.name + ", now the richest in " + f.name + ", has taken it over from " + lead.name + ".", 2.5, villages[top.home].x, villages[top.home].y, f.id); }
      }
      const hungry = f.pop ? f.hungry / f.pop : 0;
      let wars = 0;
      for (const o of factions) if (o.alive && o !== f && f.rel[o.id].war) wars++;
      f.army = clamp(S.soldiers * (wars ? 2.6 : 1) + (wars ? 0.08 : 0), 0, 0.6);
      /* Stand soldiers down when there are more than are wanted, call some up
         when there are too few. */
      if (f.soldiers > f.army * f.adults * 1.25 + 1) {
        let extra = Math.floor(f.soldiers - f.army * f.adults);
        for (const p of people) { if (extra <= 0) break; if (p.f === f.id && p.job === "soldier") { p.job = "farmer"; p.task = "idle"; extra--; } }
      } else if (wars && f.soldiers < f.army * f.adults) {
        let need = Math.ceil(f.army * f.adults - f.soldiers);
        for (const p of people) { if (need <= 0) break; if (p.f === f.id && adult(p) && p.job === "farmer" && p.bold > 0.3 && p.id !== f.leader) { p.job = "soldier"; p.task = "idle"; p.wait = 0; need--; } }
      }
      /* Money: enough to pay the soldiers, no more than the people will bear.
         A leader who believes in sharing feeds the hungry from the treasury. */
      if (!shared) {
        /* A leader drifts from the tax the world was set up with only as far
           as paying the soldiers demands, and comes back when it does not. */
        const wages = f.soldiers * WAGE * (YEAR / 20) / 4;
        if (f.treasury < wages && f.tax < 0.6) f.tax = Math.min(0.6, f.tax + 0.02);
        else if (f.treasury > wages * 3 + f.pop * 0.5 && f.tax > S.tax * 0.5) f.tax = Math.max(S.tax * 0.5, f.tax - 0.02);
        /* A leader who believes in sharing feeds anybody who cannot pay; one
           who does not waits until the treasury is overflowing. */
        f.relief = lead.views > 0.1 || f.treasury > wages * 2 + f.pop * 1.5;
        /* Coins a treasury has no use for go back into the tills of its
           villages — it buys from them — or every coin in the world would end
           up in a chest and nobody could pay a farmer. */
        const spare = f.treasury - (wages * 4 + f.pop);
        if (spare > 0) {
          const mine = villages.filter(v => v.alive && v.f === f.id);
          for (const v of mine) { v.till += spare * 0.5 / mine.length; }
          if (mine.length) f.treasury -= spare * 0.5;
        }
      }
      for (const o of factions) {
        if (!o.alive || o === f) continue;
        const rel = f.rel[o.id], back = o.rel[f.id];
        rel.grief *= 0.985; rel.op *= 0.995;
        const b = border(f, o);
        if (rel.war) {
          if (b.pair) f.target[o.id] = b.pair[1].id;
          const weary = rel.dead / (f.pop + 1) * 5 + (t - rel.since) / YEAR * 0.12 + hungry * 0.5;
          if (weary > 0.35 + lead.bold * 0.5 + S.aggression * 0.3) {
            const theirs = back.dead / (o.pop + 1) * 5 + (t - back.since) / YEAR * 0.12;
            const olead = byId.get(o.leader);
            if (theirs > 0.15 + (olead ? olead.bold : 0.5) * 0.2 || f.soldiers < o.soldiers * 0.5) {
              rel.war = back.war = false; rel.peaceAt = back.peaceAt = t;
              rel.grief *= 0.4; back.grief *= 0.4;
              count.peaces++;
              note("peace", f.name + " and " + o.name + " have made peace after " + Math.max(1, Math.round((t - rel.since) / YEAR)) + " years and " + (rel.dead + back.dead) + " dead.", 3.5, b.pair ? b.pair[0].x : 0, b.pair ? b.pair[0].y : 0, f.id);
            }
          }
        } else if (S.war && b.d < 26 && t - rel.peaceAt > YEAR * 3 && t > YEAR * 2) {
          const land = (f.cramped && t - f.cramped < YEAR * 2 ? 0.5 : 0) + hungry * 1.2;
          const want = (rel.grief + land + Math.max(0, -rel.op) * 0.6) * (0.35 + lead.bold) * (0.25 + S.aggression * 1.5);
          const mine = f.soldiers + f.adults * 0.15, theirs = o.soldiers + o.adults * 0.15;
          if (want > 0.8 && mine > theirs * 0.7 && R() < 0.5) {
            rel.war = back.war = true; rel.since = back.since = t; rel.dead = back.dead = 0;
            if (b.pair) { f.target[o.id] = b.pair[1].id; o.target[f.id] = b.pair[0].id; }
            count.wars++;
            const why = rel.grief > land && rel.grief > 0.3 ? "over old wrongs" : land > 0.3 ? "for land" : "out of plain dislike";
            note("war", f.name + " has gone to war with " + o.name + ", " + why + ".", 4, b.pair ? b.pair[1].x : 0, b.pair ? b.pair[1].y : 0, f.id);
          }
        }
      }
    }

    /* ── the tick ──────────────────────────────────────────────────────── */
    function tick(actions = true) {
      t++;
      for (let i = 0; i < tiles; i++) {
        const cap = fert[i] * TILE_CAP;
        if (stock[i] < cap) stock[i] = Math.min(cap, stock[i] + fert[i] * REGROW * S.rich);
        buckets[i].length = 0;
      }
      for (const p of people) buckets[tileAt(p.x, p.y)].push(p);
      for (let i = 0; i < people.length; i++) {
        const p = people[i];
        if (p.hp === -99) continue;
        live(p);
        if (p.hp !== -99 && (p.id + t) % 20 === 0) reflect(p);
      }
      if (actions) for (let i = 0; i < 8; i++) actionTick();
      /* The dead leave the list. */
      let dead = false;
      for (const p of people) if (p.hp === -99) { dead = true; byId.delete(p.id); placed.delete(p.id); }
      if (dead) { let w = 0; for (let i = 0; i < people.length; i++) if (people[i].hp !== -99) people[w++] = people[i]; people.length = w; }

      if (t % 10 === 0) {
        census();
        for (const v of villages) if (v.alive) { market(v); villageTurn(v); }
        /* The newest thing that happened is known first where it happened. */
        if (events.length) {
          const e = events[events.length - 1];
          if (e.t > t - 10) for (const p of people) if (p.news < e.id && (p.f === e.f || Math.hypot(p.x - e.x, p.y - e.y) < 6)) { if (R() < 0.3) p.news = e.id; }
        }
      }
      if (t % 50 === 0) {
        territory();
        for (const f of factions) if (f.alive) {
          if (f.pop === 0) { fall(f, -1); continue; }
          decide(f);
        }
      }
      if (t % (YEAR / 2) === 0) sample();
    }

    // Calendar and activity have separate clocks: a walk must not wait for an aging tick.
    // Headless step retains its coarse yearly experiment clock; the page uses advance.
    let elapsed = 0, activityOwed = 0, calendarOwed = 0;
    function advance(seconds) {
      elapsed += seconds;
      activityOwed += seconds * 5;
      while (activityOwed >= 1) {
        calendarOwed += YEAR / (365 * DAY_SECONDS * 5);
        while (calendarOwed >= 1) { tick(false); calendarOwed--; }
        actionTick(); activityOwed--;
      }
    }
    function step(ticks) { for (let i = 0; i < ticks; i++) tick(); }

    function stats() {
      let age = 0, coins = 0, richest = 0, wars = 0;
      for (const p of people) { age += p.age; coins += p.coins; if (p.coins > richest) richest = p.coins; }
      const sorted = people.map(p => p.coins).sort((a, b) => a - b);
      let topShare = 0;
      if (coins > 0) { let top = 0; for (let i = Math.floor(sorted.length * 0.9); i < sorted.length; i++) top += sorted[i]; topShare = top / coins; }
      for (const f of factions) if (f.alive) for (const o of factions) if (o.alive && o.id > f.id && f.rel[o.id].war) wars++;
      return Object.assign({
        tick: t, year: year(), people: people.length, factions: factions.filter(f => f.alive).length,
        villages: villages.filter(v => v.alive).length, atWar: wars, meanAge: people.length ? age / people.length : 0,
        money: money(), topShare: topShare,
      }, count);
    }

    /* Who or what is under a point, for the inspector. */
    function at(x, y, reach) {
      let best = null, bd = reach || 0.8;
      for (const p of people) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
      if (best) return { person: best };
      for (const v of villages) if (v.alive && Math.hypot(v.x - x, v.y - y) < 1.4) return { village: v };
      return null;
    }

    actionTick();
    return {
      settings: S, cols: cols, rows: rows, YEAR: YEAR,
      fert: fert, ore: ore, stock: stock, owner: owner,
      people: people, byId: byId, villages: villages, factions: factions,
      events: events, chatter: chatter, history: history,
      step: step, advance: advance, activity: activity, equipment, outfit, harvestCapacity, tradeCapacity, craftOutput, strike, stats: stats, at: at, adult: adult, leans: leans, atWar: atWar,
      get tick() { return t; },
      get days() { return elapsed / DAY_SECONDS; },
      get sceneTick() { return sceneTick; },
      set: function (k, v) { const next = clean(Object.assign({}, S, { [k]: v })); S[k] = next[k]; },
    };
  }

  return { SCHEMA: SCHEMA, DEFAULTS: DEFAULTS, PRESETS: PRESETS, YEAR: YEAR, DAY_SECONDS: DAY_SECONDS, clean: clean, create: create };
});
