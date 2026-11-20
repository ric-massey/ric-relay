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

   Every setting on the page is read somewhere below; test/world-builder.test.mjs
   retains setting experiments behind --generations. decisions.test.mjs checks
   how much the daily settings change a life (see README).

   One file, no dependencies, the same in a browser and in node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  /* `factory` is kept so the page can write this file out again as the text
     of a worker (TODO item 3; index.html, `keeperText`). */
  else { root.WBPeople = factory(); root.WBPeople.factory = factory; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* A day at 1× takes five minutes (Ric, 2026-11-14: "generations take hours
     even at 1500x … what if instead of 20 minute day it was a 5 minute day").
     It was twenty from 2026-11-12. The engine's cost is the number of small
     steps a game day holds, so this is what makes a generation watchable: 60
     steps a game hour instead of 250. Everything measured in hours is
     unchanged; everything that was counted in steps is converted below by
     `TK`, so it lasts the same game time it always did. */
  const DAY_SECONDS = 300;
  const DAY_HOURS = 24;
  const YEAR = 365 * DAY_HOURS;     // hourly updates, independently of lifespan
  const HOUR_SECONDS = DAY_SECONDS / DAY_HOURS;
  const ACTIONS_PER_HOUR = 60;
  const TICKS_PER_SECOND = ACTIONS_PER_HOUR / HOUR_SECONDS;
  /* Steps were tuned at 250 a game hour; this turns one of those counts into
     the same stretch of game time now. */
  const STEP_SCALE = ACTIONS_PER_HOUR / 250;
  const TK = n => Math.max(1, Math.round(n * STEP_SCALE));
  const REFLECT_HOURS = 6;
  const NEW_TRAITS = ["patient", "temper", "hard", "curious", "honest"];   // TODO 10: the five added to the first five
  const TRAITS = ["bold", "warm", "greed", "stub", "patient", "temper", "hard", "curious", "honest"];
  const TRAIT_FADE = Math.LN2 / (2 * 365 * 4);   // a look every six hours; half gone in two years
  const life = o => TRAITS.map(k => o[k] || 0);
  const LIFE = {
    raid:   life({ temper: 0.04, warm: 0.02, patient: -0.02, bold: 0.01 }),
    famine: life({ greed: 0.03, patient: 0.03, honest: -0.02, warm: -0.02 }),
    grief:  life({ bold: -0.02, temper: 0.02 }),
    killed: life({ temper: 0.03 }),
    robbed: life({ warm: -0.02 }),
    good:   life({ warm: 0.01, temper: -0.01, greed: -0.01, curious: 0.01 }),
  };
  /* The mind (TODO 11): what one slot can hold, and how long each lasts unrefreshed (Ric,
     2026-11-17: "Grudges last longest"). Half-lives in hours. */
  const M_FRIEND = 1, M_KIN = 2, M_NEWS = 3, M_FOOD = 4, M_DEBT = 5, M_BELIEF = 6;
  const M_HALF = [0, 365 * DAY_HOURS, 5 * 365 * DAY_HOURS, 90 * DAY_HOURS, 30 * DAY_HOURS, 5 * 365 * DAY_HOURS, Infinity];
  const M_GRUDGE_HALF = 5 * 365 * DAY_HOURS;
  /* Turned away when hungry (2026-11-18): it cools things, so the hungry try somebody else
     next time, but on its own never makes an enemy (no lower than SNUB, short of the -0.35 at
     which people have it out or turn a chat cold). Until then every refusal counted and lasted
     as a grudge: some 100,000 refusals a world-year left most adults holding five grudges or
     more. Enemies now come from fights, theft, killing and bitter argument. Cooling only when
     the other had food to spare, or remembering who had none, fed people worse: the hungry kept
     going back. */
  const SNUB = -0.3;
  const CLOSE = 5, CLOSE_AT = 0.5;   // at most five people close (Ric, 2026-11-18: "do 5")
  const TOWN_AT = 400, CITY_AT = 5000;     // people: a town, a city (TODO 8)
  const MARKET_PRICE = 1.2;                // coins a day's food fetches door to door on market day
  const ILLNESS_HOURS = 7 * DAY_HOURS;
  /* The sickness kills about one healthy adult in thirty-three who catch it —
     the order of a bad village fever, not of smallpox — and far more of the
     very young, the old and the hungry. Until 2026-11-14 it killed 22% of
     everybody who caught it, alike, and caught nearly everybody: one
     outbreak every two months took a fifth of a world. */
  const SICK_HAZARD = 1 - Math.pow(1 - 0.03, 1 / ILLNESS_HOURS);
  const CATCH = 0.15;               // chance a conversation passes it on
  const pct = v => Math.round(v * 100) + "%";
  const scale = (words) => v => words[Math.min(words.length - 1, Math.floor(v * words.length))];

  const SCHEMA = [
    { title: "The land", items: [
      { key: "map", label: "How much land", type: "range", min: 5, max: 1000, step: 1, def: 17, curve: 2.5,   // 5: below it the default eight villages do not fit
        say: v => v + " by " + Math.round(landHigh(v)) + " km — " + (v <= 12 ? "a valley" : v <= 20 ? "a district" : v <= 30 ? "a region" : v <= 300 ? "a small country" : "a state"),
        help: "Measured in kilometres, east to west. A square of the map is 250 metres: a village's fields reach about two kilometres, as farming villages' did, and people walk four and a half kilometres an hour. Bigger land is slower to run." },
      { key: "rich", label: "How much it grows", type: "range", min: 0.2, max: 2, step: 0.05, def: 1,
        say: v => (v < 0.6 ? "thin soil" : v < 1.3 ? "decent land" : "it grows anything"),
        help: "How fast food grows, and grows back. On thin soil a day in the fields runs long; on rich land it is done by midday." },
      { key: "uneven", label: "How uneven it is", type: "range", min: 0, max: 1, step: 0.05, def: 0.6,
        say: scale(["the same everywhere", "gentle", "good valleys and bad hills", "rich pockets in a waste"]),
        help: "Uneven land gives some villages more than others." },
      { key: "sea", label: "How much sea", type: "range", min: 0, max: 0.7, step: 0.05, def: 0.15,
        say: v => v === 0 ? "no sea — the land runs off the edge" : pct(v) + " of the map",
        help: "The sea comes in from the edges over the lowest ground. Nobody lives or farms on it." },
      { key: "rivers", label: "How many rivers", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["none", "a few big ones", "plenty", "a stream in every valley"]),
        help: "Rain runs downhill to the sea or a lake. Where enough has gathered it is a river." },
      { key: "forest", label: "How much forest", type: "range", min: 0, max: 1, step: 0.05, def: 0.4,
        say: scale(["open country", "woods here and there", "well wooded", "forest everywhere"]),
        help: "Forest grows where it is wet. Its ground farms poorly until it is cleared." },
      { key: "hills", label: "How hilly", type: "range", min: 0, max: 1, step: 0.05, def: 0.4,
        say: scale(["flat", "rolling", "hilly", "rugged"]),
        help: "Steep ground is hills; steep and high is mountain. Hills farm worse than flat land, mountains not at all." },
      { key: "seed", label: "Seed", type: "range", min: 1, max: 9999, step: 1, def: 11,
        say: v => "#" + v, help: "The same seed and settings start the same world." },
    ]},
    { title: "The year", items: [
      { key: "latitude", label: "Distance from the equator", type: "range", min: 0, max: 70, step: 1, def: 45,
        say: v => (v === 0 ? "on the equator" : v + "°") + " — " + daySpan(v),
        help: "How long the days are, worked out from the real sun: twelve hours all year on the equator, and at 60° about eighteen in June and six in December. People work in the light." },
      { key: "winter", label: "How cold winter gets", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["no winter — things grow all year", "mild winters", "a real winter", "hard winters"]),
        help: "Crops grow in the warm months and stop in the cold. In a hard winter people eat more, nothing grows for months, and what was not brought in by autumn freezes in the fields." },
      { key: "start", label: "The world starts in", type: "select", def: "spring",
        options: [["spring", "Spring"], ["summer", "Summer"], ["autumn", "Autumn"], ["winter", "Winter"]],
        help: "What is in the fields and the houses on that day is set under How it starts." },
      { key: "weather", label: "Year to year", type: "range", min: 0, max: 1, step: 0.05, def: 0.4,
        say: scale(["every year the same", "a little different", "good years and bad", "droughts and killing frosts"]),
        help: "Each year draws its own spring, warmth and harvest — early or late, warm or cold, plenty or want. Drawn from the seed, so the same seed gives the same years." },
      { key: "rain", label: "Rain", type: "select", def: "real",   // TODO 6b, 2026-11-16
        options: [["real", "By place and year — dry years thin the harvest"], ["off", "The same everywhere, every year"]],
        help: "Each year's rain differs from place to place, more on dry land than wet, by as much as Year to year says. A dry year thins the crops; fields beside a river or lake are spared, as river flats were. Rain also fills the water pots at home." },
    ]},
    { title: "How it starts", items: [
      { key: "stored", label: "Food put by", type: "range", min: 0, max: 1, step: 0.05, def: 0,
        say: v => { const d = putByDays(v); return d < 1 ? "nothing — they live day to day" : d < 21 ? "about " + Math.round(d) + " days" : d < 60 ? "about " + Math.round(d / 7) + " weeks" : d < 330 ? "about " + Math.round(d / 30) + " months" : "a full year's worth"; },
        help: "What every household has in the house on the first day, and the village store with it." },
      { key: "standing", label: "Crops in the fields", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["bare — just sown", "thin", "half grown", "a good stand", "ready to reap"]),
        help: "What is growing in the fields on the first day." },
      { key: "ages", label: "How old they are", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["mostly children", "a young people", "all ages", "an ageing people", "mostly old"]),
        help: "A young world has many mouths and few hands for years; an old one works now and dies off." },
      { key: "places", label: "Where they live at first", type: "select", def: "villages",   // TODO 8; Ric: "all of this being choices"
        options: [["hamlets", "Hamlets — a few families each, scattered"], ["villages", "Villages"], ["towns", "Villages, and a market town for each faction"], ["city", "A city, and villages round it"]],
        help: "A town takes two-fifths of its faction's people and a city half of everybody; whether it is a town or a city by size depends on how many people there are (400 for a town, 5,000 for a city). A big place lives on grain brought in from the villages round it: if that does not come, it shrinks." },
      { key: "settled", label: "How settled they are", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["strangers just arrived", "a few couples", "couples, but few friends yet", "neighbours who know each other", "old families — everybody knows everybody"]),
        help: "How many start in couples, and how many friends — and so who they will ask for food or follow — they already have." },
    ]},
    { title: "The people", items: [
      /* No top (TODO item 3; Ric: "the number of people should be infinite
         just based on can your computer run it"). `max` is only how far the
         slider sweeps; a typed number, or a link, may be any size, and the
         setup page says what this computer makes of it. */
      { key: "people", label: "How many people", type: "range", min: 20, max: 20000, inputMax: Infinity, integer: true, step: 10, def: 400, curve: 3,
        say: v => v.toLocaleString("en-US"),
        help: "How many are alive when it starts. The slider stops at 20,000; type a number to go past it. For scale, farming country held about 10 to 50 people a square kilometre; the land setting above says how many square kilometres there are." },
      { key: "factions", label: "How many factions", type: "range", min: 1, max: 8, step: 1, def: 4,
        say: v => (v === 1 ? "one people" : v + " factions"), help: "They may not stay this many." },
      { key: "villages", label: "Villages each", type: "range", min: 1, max: 4, step: 1, def: 2,
        say: v => (v === 1 ? "one village" : v + " villages"), help: "How many villages each faction starts with. More are founded when one fills." },
      { key: "crowd", label: "A full village", type: "range", min: 20, max: 205, step: 5, def: 70,
        say: v => (v >= 205 ? "as many as its land can feed" : v + " people"),
        help: "Past this, some leave — for a village with room or food, or to found a new one if there is land left. At the far end there is no number: a village is full when its own fields cannot feed it." },
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
        say: v => "about " + Math.round(1 / (STARVE * v) / 24) + " days with no food at all",
        help: "How long somebody with nothing to eat lasts. About six weeks is what a fed adult with water survives; a fortnight is a hard, cold, sick world." },
      { key: "thirst", label: "Thirst", type: "select", def: "real",   // TODO 6a; Ric, 2026-11-16: "Real, on by default"
        options: [["real", "Real — about three days without water"], ["gentle", "Gentler — about two weeks"], ["off", "Off — nobody needs water"]],
        help: "A household keeps water at home and fetches it from a river or lake (the sea is salt), or digs a well when fresh water is far. Without any, people die in about three days, sooner in summer heat, as in life; gentler gives them about two weeks." },
      { key: "fishing", label: "Fishing", type: "select", def: "on",   // TODO 6c, 2026-11-16
        options: [["on", "On — villages by water fish"], ["off", "Off"]],
        help: "A village within two kilometres of a river, lake or the sea can fish it. The water gives what real waters give, a few dozen kilograms a hectare a year, and fished hard it takes time to come back. A fisher is a living like a farmer." },
      { key: "materials", label: "Materials", type: "select", def: "real",   // TODO 9a, 2026-11-17
        options: [["real", "Wood, stone, ore, herds and game"], ["goods", "One kind of goods (as before)"]],
        help: "Wood is cut in the forest, stone quarried in the hills and ore mined where the ground has it, a day's work a load, and sold to the village store. Herds graze grassland, dry land and hills for milk, meat and wool; hunters take game in the forest for meat and hides, and game runs out when hunted hard. Houses are built of wood or stone, crafters work wood, ore and wool into what they make, tools and weapons need ore, carts wood, packs wool, shields wood or hide, and traders carry each where it is dear. Off, there is one kind of goods, as before." },
      { key: "firewood", label: "Firewood", type: "select", def: "real",   // TODO 9c, 2026-11-17
        options: [["real", "Needed in the cold"], ["off", "Off"]],
        help: "In the cold a village burns wood from its store, about three-quarters of a load a person over a winter (a household in a cold land burned some tonnes a year), more in a hard one; the store wants it before the winter, so wood is dearer in autumn. A village with none left is cold: the very young and the old die of it first. Needs Materials on wood, stone and ore. Off, no wood is burned." },
      { key: "crossing", label: "Crossing water", type: "select", def: "real",   // TODO 6d, 2026-11-16
        options: [["real", "Big rivers need a ford, bridge or boat"], ["wade", "Every river can be waded; no boats"]],
        help: "A big river can only be crossed at a ford, or where a village has built a bridge; a village by a lake or the sea builds a boat once its people keep wanting to cross, and ferries them over. An army does not go by boat: water it cannot walk round stops it." },
      { key: "plague", label: "Sickness", type: "select", def: "rare",
        options: [["none", "None"], ["rare", "Now and then"], ["common", "Often"]],
        help: "A sickness starts in one person and passes to whoever they talk to." },
    ]},
    { title: "Money", items: [
      { key: "money", label: "How they trade", type: "select", def: "coins",
        options: [["coins", "Coins and markets"], ["shared", "No money — a shared store"]],
        help: "With a shared store everybody puts in what they grow and takes what they need." },
      { key: "coins", when: s => s.money === "coins", label: "Coins to start, on average", type: "range", min: 0, max: 40, step: 1, def: 8,
        say: v => v + " coins a head",
        help: "Everybody's own, children's too — but a household spends as one, so whoever feeds a child can spend its coins on the family. How evenly it is spread is the next setting." },
      { key: "unequal", when: s => s.money === "coins", label: "Who starts rich", type: "range", min: 0, max: 1, step: 0.05, def: 0.3,
        say: scale(["everybody the same", "some a little more", "a few rich families", "one in ten owns most of it"]),
        help: "How the starting coins are spread: evenly, or most of them in a few hands." },
      { key: "prices", when: s => s.money === "coins", label: "Prices", type: "select", def: "float",
        options: [["float", "Rise when things run short"], ["fixed", "Fixed by law"]],
        help: "A fixed price cannot tell a farmer the village is hungry." },
      { key: "tax", when: s => s.money === "coins", label: "Tax at the start", type: "range", min: 0, max: 0.6, step: 0.02, def: 0.12,
        say: v => (v === 0 ? "none" : pct(v) + " of every sale"),
        help: "What each faction takes to pay its soldiers to begin with. After that it is each leader's call — or yours, if you rule a faction." },
      { key: "inherit", when: s => s.money === "coins", label: "When somebody dies", type: "select", def: "kids",
        options: [["kids", "Their children get their coins"], ["faction", "Their faction takes them"], ["village", "Shared round the village"]],
        help: "Who gets a person's coins. A child's share is kept for them until they are grown." },
    ]},
    { title: "Minds", items: [
      { key: "talk", label: "How much they talk", type: "range", min: 0, max: 1, step: 0.05, def: 0.6,
        say: scale(["never", "rarely", "now and then", "often", "to everybody they pass"]),
        help: "News, opinions, friendships and sickness all travel by talking." },
      { key: "divided", label: "How far apart they start", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["everybody agrees", "some difference", "divided", "two camps"]),
        help: "The one thing they argue about: should what is grown be shared out, or does each keep their own?" },
      { key: "memory", label: "How much a person can hold", type: "range", min: 6, max: 60, step: 1, def: 20,   // TODO 11; Ric, 2026-11-17: "20"
        say: v => v + " things", help: "Each friend, grudge, debt, piece of news, who has food to spare, and what they think about sharing takes one. When a mind is full the weakest thing goes. People differ a little: a quarter either way, taken after their parents." },
      { key: "wrong", label: "How often a tale changes in the telling", type: "range", min: 0, max: 0.3, step: 0.01, def: 0.05,   // TODO 12; Ric, 2026-11-18: "1 in 20"
        say: v => v <= 0 ? "never" : "1 telling in " + Math.round(1 / v), help: "Each time something is passed on, the chance it comes out changed: a number grows, the wrong village, the wrong side. Field studies of real rumours find them mostly right." },
      { key: "switch", label: "Changing sides", type: "range", min: 0, max: 1, step: 0.05, def: 0.4,
        say: scale(["never", "almost never", "if life is better there", "easily"]),
        help: "How readily an unhappy person joins the faction of somebody who is doing better." },
    ]},
    /* Their nature (TODO 10; Ric, 2026-11-17: "Ten sliders"): each of the ten traits' average at
       the start. At the middle each is an ordinary people, and the five that were here before
       item 10 give exactly the people they always did. Each person is their own about it,
       children take after their parents, and what happens to them moves it a little. */
    { title: "Their nature", items: [
      { key: "bold", label: "Bold", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["timid","careful","ordinary","daring","reckless"]),
        help: "Whether to take a risk: fight or run, steal when starving, move to a new place, march as a soldier." },
      { key: "warm", label: "Warm", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["cold","guarded","ordinary","kind","they would give their last"]),
        help: "Whether to give, share and help: a neighbour asking for grain, somebody hungry met on the road." },
      { key: "greedy", label: "Greedy", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["content with little","modest","ordinary","grasping","never enough"]),
        help: "How much is enough: keep working, trading and putting by until they stand above their neighbours, or stop." },
      { key: "stubborn", label: "How stubborn they are", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["they believe the last person they spoke to", "open", "set in their ways", "nobody changes anybody's mind"]),
        help: "On average. Each person is their own, and children take after their parents." },
      { key: "loyalty", label: "How loyal they are", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["they owe nobody anything", "grudging", "ordinary", "devoted", "whatever is done to them"]),
        help: "How far people stand by their faction: how loyal they start, and how far hard times, taxes and a leader they disagree with wear it down." },
      { key: "patient", label: "Patient", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["today is all there is","short-sighted","ordinary","they plan for winter","they plan for years"]),
        help: "Now or later: how much they keep back for the winter rather than sell, whether they fill the larder before the cold or leave it, and how long they bide their time before having it out with somebody." },
      { key: "temper", label: "Hot-tempered", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["never raise a hand","even-tempered","ordinary","touchy","fists first"]),
        help: "How fast a quarrel becomes a fight. Most fights are bruises; now and then one kills, about as often as in a medieval village, and the dead person's family remembers." },
      { key: "hardwork", label: "Hardworking", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["idle","easy-going","ordinary","hard workers","they never stop"]),
        help: "How much they work when nothing forces them to, against resting and seeing people." },
      { key: "curious", label: "Curious", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["set in old ways","wary of the new","ordinary","curious","restless"]),
        help: "Whether to try the new thing: work that is not their trade, a new village, the road to a market they have not seen." },
      { key: "honest", label: "Honest", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["thieves","not to be trusted","ordinary","honest","they would starve first"]),
        help: "Whether to steal from a neighbour's larder when short, or from another faction's store when starving." },
      { key: "differ", label: "How much they differ", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["all alike", "a little", "as people do", "a people of extremes"]),
        help: "How far one person's nature — each of the ten — is from the next, and how far a child strays from its parents." },
    ]},
    { title: "Power", items: [
      { key: "rule", label: "Who leads, at first", type: "select", def: "elected",
        options: [["elected", "Whoever they vote for"], ["chief", "A chief for life, then their child"], ["rich", "Whoever is richest"]],
        help: "Each faction starts this way. A people who have turned on a chief or on the rich, and who outnumber the soldiers still loyal, can overthrow them and choose their own way." },
      { key: "land", label: "Who holds the land", type: "select", def: "decide",   // TODO 7c; Ric, 2026-11-16
        options: [["decide", "Each faction decides"], ["family", "Families, each its own fields"], ["village", "The village, in common"], ["leader", "The leader, worked for a share"]],
        help: "Each faction's own rule, as Ric asked: a chief or the richest chooses by their own lights, a people who vote choose by what most of them want, and you choose for a faction you rule. Or set one rule for everybody here. Families hold one or two fields each near the house; common fields are worked by anybody of the village; a leader's land is worked by all, and a third of every harvest goes to the leader's barn, the village store." },
      { key: "term", label: "A vote every", type: "range", min: 1, max: 20, step: 1, def: 6,
        say: v => v + (v === 1 ? " year" : " years"), help: "Wherever leaders are voted for — from the start, or after a revolution brings in votes." },
      { key: "rebel", label: "Breaking away", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["never", "only in despair", "when a village has had enough", "at the first grievance"]),
        help: "How unhappy a village has to be before it declares itself its own faction." },
    ]},
    { title: "War", items: [
      { key: "neighbours", label: "How the factions start", type: "select", def: "strangers",   // TODO 13
        options: [["friends", "Old friends"], ["strangers", "Strangers"], ["enemies", "Old enemies"]],
        help: "Old friends start allied, and trading free of tax if there is money. Old enemies start with a feud every grown-up knows and tells their children. Either fades over a generation unless something keeps it alive." },
      { key: "war", label: "Wars", type: "toggle", def: true, help: "Off, no leader may start one, whatever is done to them." },
      { key: "aggression", when: s => s.war, label: "How quick to fight", type: "range", min: 0, max: 1, step: 0.05, def: 0.5,
        say: scale(["only when cornered", "slow to anger", "ordinary", "touchy", "over anything"]),
        help: "How readily leaders go to war over old wrongs, land or hunger. A bold leader is quicker to it whatever this says." },
      { key: "soldiers", label: "Soldiers at the start", type: "range", min: 0, max: 0.4, step: 0.01, def: 0.08,
        say: v => (v === 0 ? "none" : "1 in " + Math.round(1 / v)),
        help: "After that each leader keeps as many as their neighbours' armies, their old wars and their treasury call for. Soldiers do not farm, and somebody has to pay them." },
      { key: "deadly", when: s => s.war, label: "How deadly a fight is", type: "range", min: 0.1, max: 3, step: 0.1, def: 1,
        say: v => (v < 0.6 ? "mostly bruises" : v < 1.6 ? "people die" : "few walk away"), help: "How often a blow in a fight kills." },
    ]},
    /* What the engine keeps track of, against how fast it runs (Ric,
       2026-11-14: "options to turn parts of tracking off would make it
       faster"). Measured, most of a world's cost is bodies keeping out of each
       other's way and the bookkeeping of who stands where, not anybody's
       decisions; these turn that off, each saying what it costs. */
    { title: "Detail", items: [
      { key: "bodies", label: "Bodies", type: "select", def: "real",   // "real" since TODO 7a (Ric, 2026-11-16: "Real size by default")
        options: [["real", "Real size — half a metre, nobody in the way"], ["drawn", "Spaced out — everyone keeps 100 m apart"]],
        help: "At real size a person is half a metre wide, so nobody is ever in anybody's way, as in life, and zoomed right in they stand beside their house at its true size. Spaced out, every person keeps about a hundred metres from the next, so crowds queue and walk round each other: what this simulator did before." },
      { key: "records", label: "Conversations", type: "select", def: "full",
        options: [["full", "Every one written down"], ["light", "Only what happens — faster"]],
        help: "Written down, the Talk tab shows each exchange, word for word, and what it changed. Otherwise conversations still pass on news, friendship, opinions and sickness, but are not kept." },
    ]},
    { title: "Time", items: [
      { key: "rate", label: "Clock", type: "range", min: 0.25, max: 1000, step: 0.25, def: 1, curve: 4,
        say: v => (v >= 1000 ? "as fast as it will go" : v + "×"),
        help: "At 1× one day takes five minutes. Above 16× the world runs as fast as this computer allows, and the page says how fast that is. You can change this while it runs." },
    ]},
  ];

  /* Settings that can be changed while a world runs (Ric, 2026-11-14). Only
     ones the engine reads as it goes: a setting that only shapes the first
     day — the map, how many people, the seed, how it starts — would change
     nothing if moved later, which is the one thing a control must not do. */
  /* Not "stubborn", "differ", "soldiers" or "rule" any more: since
     2026-11-14 those are people's own natures and leaders' own decisions,
     set at the start and passed on or changed from there. */
  /* Nor the things that are how bodies, minds and places are (Ric,
     2026-11-14: "starvation should be decided at the beginning"): how long
     somebody lasts with no food, how many people a mind can hold, and where
     on the earth the world is. Those are set once, at the start. */
  const LIVE = new Set(["rich", "winter", "weather", "crowd", "births", "plague", "prices",
                        "talk", "switch", "rebel", "war", "aggression", "deadly"]);
  for (const g of SCHEMA) for (const it of g.items) if (LIVE.has(it.key)) it.live = true;
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
    { id: "feud", name: "Two old enemies", note: "Two tribes who hate each other, and almost no money.",
      set: { factions: 2, neighbours: "enemies", coins: 1, unequal: 0.1, people: 300 } },
    { id: "quiet", name: "A quiet world", note: "No war, no sickness, generous land.",
      set: { war: false, plague: "none", rich: 1.6, aggression: 0, rebel: 0.1 } },
  ];

  /* Land was three sizes until 2026-11-14 (Ric: "we should be able to choose
     how big the land is"); a link or preset that names one still opens it. */
  const LEGACY_MAP = { small: 11, medium: 17, large: 25 };
  /* North to south is 0.62 of east to west, rounded in squares so the old
     district and region are exactly the sizes they were. */
  const landHigh = km => Math.round(Math.round(km * 4) * 0.62) / 4;
  function clean(input) {
    if (input && typeof input.map === "string" && LEGACY_MAP[input.map]) input = Object.assign({}, input, { map: LEGACY_MAP[input.map] });
    const S = {};
    for (const g of SCHEMA) for (const it of g.items) {
      let v = input && it.key in input ? input[it.key] : it.def;
      if (it.type === "range") {
        v = Number(v);
        if (!isFinite(v)) v = it.def;
        v = Math.min(it.inputMax == null ? it.max : it.inputMax, Math.max(it.min, v));
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

  const SQUARES_PER_KM = 4;   // a square is 250 m
  /* The kinds of ground (TODO 4a): whether people can live on it and farm it. Crossing is item
     4b: the sea and lakes cannot be walked, and the rest is walked at its `PACE`. */
  const G_SEA = 0, G_LAKE = 1, G_RIVER = 2, G_BEACH = 3, G_MARSH = 4, G_GRASS = 5, G_FOREST = 6, G_HILLS = 7, G_MOUNTAIN = 8, G_DRY = 9, G_SNOW = 10;
  /* How fast people walk over each kind of ground, as a share of open ground (TODO 4b): Tobler's
     hiking function and its three fifths off a path, Soule and Goldman's brush and bog (README,
     "Crossing the land"). The sea and lakes are not walked at all. */
  const PACE = [1, 1, 0.4, 1, 0.5, 1, 0.6, 0.7, 0.25, 1, 0.3];
  const GROUND = [
    { name: "sea", live: false, farm: false }, { name: "lake", live: false, farm: false }, { name: "river", live: false, farm: false },
    { name: "beach", live: true, farm: true }, { name: "marsh", live: false, farm: false }, { name: "grassland", live: true, farm: true },
    { name: "forest", live: true, farm: true }, { name: "hills", live: true, farm: true }, { name: "mountain", live: false, farm: false },
    { name: "dry land", live: true, farm: true }, { name: "snow and ice", live: false, farm: false }];
  const COLOURS = ["#e0a340", "#5aa9e6", "#d9605a", "#7fc87a", "#b58be0", "#e58fb6", "#4fc3b0", "#c9c36a",
                   "#f08a4b", "#8fa3ff", "#b7d36b", "#e4dccb"];
  const ONSETS = ["b", "d", "f", "g", "h", "k", "l", "m", "n", "p", "r", "s", "t", "v", "w", "y", "br", "dr", "th", "sh", "st", "el", "or", "an", ""];
  const VOWELS = ["a", "e", "i", "o", "u", "ae", "ia", "ei", "ou"];
  const ENDS = ["", "", "n", "r", "s", "l", "th", "k", "m", "d"];
  const F_FIRST = ["Hollow", "Ashen", "Long", "High", "Salt", "Green", "Iron", "Quiet", "Red", "Low", "Bright", "Stone", "Far", "Winter", "Amber", "Deep"];
  const F_LAST = ["Reach", "Compact", "Hearth", "League", "Crown", "March", "Fold", "Accord", "Hold", "Kin", "Banner", "Commons", "Vale", "Watch"];

  /* How fast things happen, per tick. Kept together so the one place a number
     is tuned is the one place it is written. */
  const EAT = 1 / DAY_HOURS;        // adult-day rations consumed per hour
  /* The map's scale (Ric, 2026-11-14: "maybe we need to define how big the
     map is"). A square is 250 m, so a village's fields — about eight squares
     out — reach two kilometres, as farming villages' did, and people walk at
     a walking pace: 4.5 km an hour, 18 squares. Until that date they covered
     37 squares an hour, about 9 km/h, on a map with no size at all. */
  const TILE_METRES = 250, WALK_KMH = 4.5;
  const WALK = WALK_KMH * 1000 / TILE_METRES / ACTIONS_PER_HOUR;   // squares a step
  const FIELD_HOURS = 9;           // the longest a day in the fields can run
  const CARRY = 1.8;                // food a day in the fields brings back
  const TILE_CAP = 48;             // food a perfect field holds
  const REGROW = TILE_CAP / (60 * DAY_HOURS);    // and how fast it comes back
  /* ── the year ────────────────────────────────────────────────────────────
     Every number here is a setting or comes from the sky (Ric, 2026-11-14:
     "the variables should all be editable"). `latitude` sets the length of
     the day from the real sun; `winter` how cold the cold half gets; `start`
     where in the year a world begins; `weather` how much one year differs
     from the next — drawn from the seed, so a seed always gives the same
     years and two seeds give different ones. */
  const START_DOY = { spring: 105, summer: 182, autumn: 278, winter: 15 };
  const WARM_PEAK = 196;            // warmest day: the solstice plus the lag of the land and sea
  const GROW_LINE = -0.35;          // warmth below which nothing grows
  const RIPE_AFTER = 59;            // the grain is ripest about two months after the warmest day
  const coldCurve = doy => Math.cos(2 * Math.PI * (doy - WARM_PEAK) / 365);
  /* A year with seasons grows what a year without them does, on average —
     it grows it in one half, for anybody who stored. */
  const GROW_MEAN = (() => { let m = 0; for (let d = 0; d < 365; d++) m += Math.max(0, coldCurve(d) - GROW_LINE); return m / 365; })();
  const SEASONS = ["winter", "spring", "summer", "autumn"];
  /* Hours from sunrise to sunset: the sun's declination and the sunrise
     equation, with the sun's top edge and the bending of light by the air
     (−0.833°) counted as almanacs do. Polar day and night are clamped. */
  function daylightAt(doy, latitude) {
    const rad = Math.PI / 180, decl = 23.44 * rad * Math.sin(2 * Math.PI * (284 + doy) / 365), phi = latitude * rad;
    const c = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
    return clampHours(2 * Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI / 15);
  }
  const clampHours = h => Math.max(4, Math.min(20, h));
  /* Days of food a household starts with, for the "Food put by" setting:
     squared, so the low end of the slider is days and the high end months. */
  const putByDays = v => 365 * v * v;
  function daySpan(latitude) {
    const a = Math.round(daylightAt(172, latitude)), b = Math.round(daylightAt(355, latitude));
    return a === b ? "twelve-hour days all year" : a + " hours of light in June, " + b + " in December";
  }
  /* One year's own weather: how early its spring, how warm, how good the
     ground. A hash of the seed and the year, not the world's random stream,
     so asking about a year never changes anything else. */
  function yearOf(seed, year, weather) {
    const r = rng((seed * 2654435761 + year * 40503 + 7) >>> 0);
    const u = () => r() * 2 - 1;
    return { shift: Math.round(u() * 21 * weather), warm: u() * 0.3 * weather, yield: 1 + u() * 0.3 * weather };
  }
  /* Everything the year changes, on day `day` of a world (day 0 is the day it
     starts), for its settings `S`. */
  function seasonAt(day, S) {
    const first = START_DOY[S.start] ?? START_DOY.spring;
    const abs = first + Math.floor(day), doy = ((abs % 365) + 365) % 365, year = Math.floor(abs / 365);
    const y = yearOf(S.seed || 1, year, S.weather || 0);
    const w = coldCurve(doy - y.shift) + y.warm, winter = S.winter;
    const q = Math.floor(((doy + 365 - 79) % 365) / 91.25);    // spring starts at the equinox
    return { day: Math.floor(day), doy: doy, year: year, name: SEASONS[(q + 1) % 4], warmth: w,
             growth: ((1 - winter) + winter * Math.max(0, w - GROW_LINE) / GROW_MEAN) * y.yield,
             daylight: daylightAt(doy, S.latitude ?? 45),
             /* The harvest. Around two months after the warmest day the grain
                is ripe, and a day's reaping brings in up to four times what a
                day of gathering does — the whole reason anybody can store for a
                winter. A late year has a late harvest. Measured 2026-11-14
                without it: the fields stood full all autumn, nobody's day could
                bring in more than they ate, the frost took the crop and a
                hard-winter world starved to the last person by February. */
             ripe: 1 + 3 * winter * Math.min(1, Math.max(0, (Math.cos(2 * Math.PI * (doy - y.shift - WARM_PEAK - RIPE_AFTER) / 365) - 0.75) / 0.25)),
             yearNote: y };
  }
  /* War has to be fed (Ric, 2026-11-14: "military reach depend on food carried
     and access to resupply"). A soldier draws this many days of rations before
     marching, eats them in the field, and can only draw more at a village of
     their own; under a day left and they walk home for it, leaving the siege.
     Taking a village needs four unbroken days, so what an army carries decides
     what it can take. */
  const CAMPAIGN_DAYS = 10;
  /* Health lost an hour with nothing at all to eat, at "Going hungry" 1:
     about six weeks to death, what a fed adult with water survives. It was
     0.004 — ten days — until 2026-11-14, four times too fast, which made every
     famine in this world quicker and deadlier than famines are. */
  const STARVE = 0.001;
  const WAGE = 1;                   // coins per day; default fixed-price daily food costs 1

  /* How long a thing takes, in hours. Measured 2026-11-13: before this table
     existed a day's field work took six simulated minutes and brought back
     3.6 adult-day rations, so an adult spent 54% of their hours walking, 0.1%
     harvesting, and was never short of food. Nothing downstream of scarcity
     could bite — changing how much the land grows moved 0.0% of anybody's day.
     Work now costs hours and feeds about one household, so land is the thing
     there is not enough of, and the settings about land mean something. */
  const SPELL = { sleep: 7, harvest: 5, craft: 5, guard: 4, trade: 1, rest: 2, market: 0.5, meal: 0.4, visit: 0.5, idle: 1 };
  const spell = k => Math.round(SPELL[k] * ACTIONS_PER_HOUR);
  // Equipment uses the existing goods economy. Costs are goods converted into
  // the item, not coins minted or a second resource appearing from nowhere.
  const GEAR = {
    tool: { name: "Work tool", cost: 0.6, jobs: ["farmer", "crafter", "woodcutter", "miner"], wear: 0.003, benefit: "+25% harvest capacity; +20% goods per batch" },
    pack: { name: "Trade pack", cost: 0.8, jobs: ["trader"], wear: 0.004, benefit: "Carry up to 5 trade goods instead of 3" },
    weapon: { name: "Weapon", cost: 1, jobs: ["soldier"], wear: 0.01, benefit: "+25% damage on a successful hit" },
    shield: { name: "Shield", cost: 1, jobs: ["soldier"], wear: 0.01, benefit: "25% less damage from a successful hit" },
    /* TODO 7d: a cart is a thing a trader owns, built from goods. Grain goes by cart, eight packs'
       worth, five by handcart and packhorse without one. Laden, it goes at a walk on a road, a
       little slower on a path or a village's lanes, and much slower over open ground, where a cart
       sticks and jolts. (Farmers' carts were tried, for bringing in the harvest: dragged home over
       the fields they starved more than twice as many in a year, six seeds; not kept.) */
    cart: { name: "Cart", cost: 3, jobs: ["trader"], wear: 0.002, benefit: "Grain by the cartload (eight packs, not five); slow off roads" }
  };
  /* With real materials (TODO 9a): what each piece of gear is made of, besides the crafter's work. */
  const GEAR_MAT = { tool: "iron", weapon: "iron", shield: "wood", cart: "wood", pack: "wool" };
  const PATCH = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

  /* `check` is for tests only: { plainWalking: true } turns off the two
     short cuts in the walking code (the blocked-step memory and the placing
     map), so a test can run the same world both ways and hold them equal. */
  function create(input, check) {
    const S = clean(input);
    /* `plainWalking` runs the engine the long way round: no remembered steps
       (item 1), and everybody visited and every list refilled on every step
       (item 2). It is what the tests hold the short cuts equal to. `audit`
       makes the short cuts check themselves as they go; it is for tests. */
    const PLAIN = !!(check && check.plainWalking), AUDIT = !!(check && check.audit);
    const R = rng(S.seed * 1597334677);
    /* The five traits item 10 added are drawn from a stream of their own, so each person's
       bold, warm, greedy and stubborn come out as they did before item 10. Who they become does
       not: hot temper now counts in who takes up soldiering on the first day, and from there on. */
    const RT = rng((S.seed | 0) * 2246822519 + 7);
    /* The minds (TODO 11). Everybody's slots in four flat arrays, a block of MB a person, so a
       mind is no object of its own and is never copied: slot 0 is what they think about sharing
       (what was `views`), the rest whatever they hold. A dead person's block goes to the next
       born. How much each holds (`p.mcap`) is drawn from a stream of its own. */
    const RM = rng((S.seed | 0) * 3266489917 + 11);
    const MB = Math.ceil(S.memory * 1.25) + 1;
    const M0 = MB * (Math.ceil(S.people * 1.1) + 16);   // room for the first people and a few born; grows by half after
    let mKind = new Uint8Array(M0), mAbout = new Int32Array(M0), mStr = new Float32Array(M0), mAt = new Float32Array(M0);
    let mindStamp = 0;   // changes whenever anything is held or forgotten, or a report comes or goes (TODO 12b: `rumours`)
    /* Who told them (a person's id; -1 saw it, or worked it out, themselves) and which telling of
       an event they hold (0 what happened; see `retold`). TODO 12. */
    let mFrom = new Int32Array(M0), mVar = new Uint8Array(M0);
    const mFree = []; let mTop = 0;
    const cols = Math.round(S.map * SQUARES_PER_KM), rows = Math.round(cols * 0.62);
    const tiles = cols * rows;
    const fert = new Float32Array(tiles), ore = new Float32Array(tiles), stock = new Float32Array(tiles);
    const ground = new Uint8Array(tiles), height = new Float32Array(tiles);   // the kind of ground, and metres (TODO 4a)
    /* Which way a river runs from each river square: 0 to 7 for the eight
       neighbours, 255 elsewhere. For drawing it as a line (TODO 5). */
    const riverTo = new Uint8Array(tiles).fill(255);
    /* Rain (TODO 6b): how wet each square's place is (0 to 255), how near water it is (squares, up
       to 8), and this year's crops for the rain, a hundredth a step (100 an ordinary year). Only
       with Rain on. */
    const RAIN = S.rain !== "off";
    const wetQ = RAIN ? new Uint8Array(tiles) : null, nearW = RAIN ? new Uint8Array(tiles) : null, rainK = RAIN ? new Uint8Array(tiles).fill(100) : null;
    let rainYear = -1;
    const deep = k => k === G_SEA || k === G_LAKE;
    /* Paths and roads worn in by walking (TODO 7d, 2026-11-16). Every time somebody walks onto a
       square it is trodden once more (`trod`); every day under 1% of that wears off, so a path
       outlasts a winter's disuse (at 3% they were gone by midwinter); a square trodden
       about 25 times a day for weeks is a path (`track` 1), about 95 a road (2), and one
       that falls out of use goes back to grass. The active walker model (Helbing, Keltsch and
       Molnar 1997): walkers wear the ground, worn ground is easier and draws them, and wear fades;
       nobody lays a path down. A path is walked at the pace of open ground at least, a road a
       little faster, and a cart goes best on a road. README, "Paths and roads". */
    const trod = new Uint16Array(tiles), track = new Uint8Array(tiles), trodList = [];
    let trackStamp = 0;
    const PATH_ON = 3200, PATH_OFF = 2000, ROAD_ON = 12000, ROAD_OFF = 8000;   // about 25 and 95 crossings a day, held
    function tread(i) { if (trod[i] === 0) trodList.push(i); if (trod[i] < 65535) trod[i]++; }
    /* How fast this square is walked, against open ground. */
    const paceAt = i => track[i] === 2 ? 1.15 : track[i] === 1 ? Math.max(PACE[ground[i]], 0.9) : PACE[ground[i]];
    /* Crossing water (TODO 6d): on a big river, 1 where it cannot be waded, 2 a ford, 3 a bridge;
       0 elsewhere. Null with Crossing at "wade", and then nothing below differs from before. */
    const CROSS = S.crossing !== "wade";
    const cross = CROSS ? new Uint8Array(tiles) : null;
    const stopAt = i => ground[i] <= G_LAKE || (cross !== null && cross[i] === 1);
    /* A step from corner to corner between two squares of a big river is through it. (Refusing one
       past any square of a big river was tried: fewer walkers stuck at banks on a 500 km land, but
       20,000 people on 80 km 15% slower a day; not kept.) */
    const shut = (x, y, dx, dy) => cross !== null && dx !== 0 && dy !== 0 && cross[y * cols + x + dx] === 1 && cross[(y + dy) * cols + x] === 1;
    const wet = (x, y) => { const fx = Math.floor(x), fy = Math.floor(y); if (!(fx >= 0 && fy >= 0 && fx < cols && fy < rows)) return false; const i = fy * cols + fx; return deep(ground[i]) || (cross !== null && cross[i] === 1); };
    /* Which village holds each square. Thirty-two bits since TODO item 3:
       with no top on people there is none on villages either, and sixteen
       would have run out, silently, at the 32,768th. */
    const owner = new Int32Array(tiles).fill(-1);
    const reachBest = new Float32Array(tiles).fill(1e9);   // territory(): the best claim on each square
    let ownedList = [];
    const WILD = cols > 160, inReach = WILD ? new Uint8Array(tiles) : null;   // worked(): land over 40 km
    let workedList = null;
    /* Lists of who is on each square, made only for squares somebody stands
       on: on a state-sized map most squares are empty, and a list for each of
       millions of them was most of the memory. */
    const buckets = new Array(tiles), NOBODY = [];
    const bucketAt = i => buckets[i] || NOBODY;
    /* Who is on which tile, for talking and fighting. Only the tiles that had
       anybody are cleared; the order within a tile is the people array's. */
    const bucketsUsed = [];
    /* Since 2026-11-15 (TODO item 2) the lists are not emptied and refilled:
       only somebody who has crossed onto another square since the last time
       (`shifted`) is taken off one list and put on another, in the same place
       in the order they would have had — the people array's — and the dead
       come off (`gone`) at the first refill after they left the array, which
       is when the old refill dropped them. So every list holds exactly the
       people it held, in the order it held them, at every moment anything
       reads one. `create(options, { plainWalking: true })` still refills. */
    const shifted = [], gone = [];
    function leaveBucket(p) {
      if (p.bk < 0) return;
      const b = buckets[p.bk], k = b.indexOf(p);
      if (k >= 0) b.splice(k, 1);
      p.bk = -1;
    }
    function rebucket() {
      if (PLAIN) {
        for (const i of bucketsUsed) buckets[i].length = 0;
        bucketsUsed.length = 0;
        for (const p of people) { const i = tileAt(p.x, p.y); let b = buckets[i]; if (!b) b = buckets[i] = []; if (!b.length) bucketsUsed.push(i); b.push(p); }
        return;
      }
      for (const p of gone) leaveBucket(p);
      gone.length = 0;
      for (const p of shifted) {
        const i = tileAt(p.x, p.y);
        if (i === p.bk || people[p.ix] !== p) continue;
        leaveBucket(p);
        let b = buckets[i]; if (!b) b = buckets[i] = [];
        let k = b.length; b.push(p);
        while (k > 0 && b[k - 1].ix > p.ix) { b[k] = b[k - 1]; k--; }
        b[k] = p; p.bk = i;
      }
      shifted.length = 0;
    }

    const people = [], byId = new Map();
    /* TODO item 2: people made and not yet stood anywhere; and, for each place
       in the people array, the step at which that person next has anything to
       do (0: now). See "not visiting people with nothing to do", by `act`. */
    const freshList = [];
    let wake = new Float64Array(1024), kind = new Uint8Array(1024), since = new Float64Array(1024), cur = Infinity;
    const villages = [], factions = [];
    const events = [], chatter = [], history = [], moves = [];
    const lasting = new Set();   // events held as long as a grudge: old feuds (TODO 13)
    const count = { helped: 0, fledSick: 0, garrisons: 0, peaceNew: 0, reaped: 0, spoiled: 0, burned: 0, sacked: 0, refugees: 0, cameHome: 0, passed: 0, toldWrong: 0, tips: 0, gossip: 0, infected: 0, grain: 0, market: 0, births: 0, old: 0, starved: 0, battle: 0, sick: 0, talks: 0, switched: 0, moved: 0,
                    wars: 0, peaces: 0, secessions: 0, elections: 0, captures: 0, founded: 0, fallen: 0, thefts: 0, minted: 0,
                    quarrels: 0, fights: 0, fight: 0, pilfered: 0, raids: 0,   // TODO 10
                    alliances: 0, deals: 0, demands: 0, tributes: 0, refusals: 0, joined: 0, tribute: 0 };   // TODO 13
    let t = 0, activityTicks = 0, nextId = 1, nextExchange = 1, usedNames = new Set();

    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const pick = a => a[Math.floor(R() * a.length)];
    const tileAt = (x, y) => clamp(Math.floor(y), 0, rows - 1) * cols + clamp(Math.floor(x), 0, cols - 1);
    const year = () => activityTicks / ACTIONS_PER_HOUR / YEAR;
    /* ── the year ──────────────────────────────────────────────────────────
       Added 2026-11-14: until then every day of the year was the same day,
       so nobody ever had a reason to store, to work harder in autumn, or to
       go short in February. `winter` is how far the year turns; at 0 the
       world is exactly what it was without seasons. */
    const today = () => Math.floor(t / DAY_HOURS);
    let seasonDay = -1, seasonNow = null;
    const season = () => { const d = today(); if (d !== seasonDay) { seasonDay = d; seasonNow = seasonAt(d, S); } return seasonNow; };
    const doy = () => season().doy;
    const warmth = () => season().warmth;
    const growth = () => season().growth;
    const daylight = () => season().daylight;
    function isDark(hour) { const half = daylight() / 2; return hour < 13 - half || hour >= 13 + half; }
    /* How long a sleep lasts: in the dark, until it gets light (an hour at
       least, ten at most); in daylight, a whole sleep for somebody spent.
       Before 2026-11-14 it was always seven hours, which was right only while
       every night was the same length — with real days, somebody who woke
       before a spring dawn went back to bed until one in the afternoon. */
    function sleepTicks() {
      const hour = t % DAY_HOURS;
      if (!isDark(hour)) return spell("sleep");
      const dawn = 13 - daylight() / 2;
      return Math.round(clamp((dawn - hour + DAY_HOURS) % DAY_HOURS, 1, 10) * ACTIONS_PER_HOUR);
    }
    /* Days of eating ahead with nothing growing: what a store has to cover. */
    /* Days of eating ahead that the land will not cover: from the next time
       the year turns lean (growth under what a field gives in an ordinary
       year), every lean day counts by how far short it falls, in proportion
       to what people eat in that cold — and then a month more, because a
       field the frost stripped has to grow back before it can be reaped.
       That last month is the hungry gap, and before it was counted a world
       that had stored for the frozen months still starved in April. */
    /* With seasons a field is a crop, not a larder: what grows through spring
       and summer stands until it is reaped, so a field holds a season's growth
       rather than sixty days of it. Without this the fields sat full from June
       and everything that would have grown after that was lost. */
    let FIELD_CAP = TILE_CAP * (1 + 1.5 * S.winter);
    let aheadAt = -1, aheadDays = 0;
    function winterAhead() {
      if (S.winter <= 0) return 0;
      if (aheadAt === t) return aheadDays;
      let days = 0, inLean = false;
      for (let d = 0; d < 250; d++) {
        const s0 = seasonAt(today() + d, S);
        if (s0.growth < 1) {
          inLean = true;
          days += (1 - s0.growth) * (1 + 0.25 * S.winter * Math.max(0, -s0.warmth));
        } else if (inLean) break;
      }
      aheadAt = t; aheadDays = days > 0 ? days + 30 * S.winter : 0;
      return aheadDays;
    }
    /* What a household holds back: today and tomorrow, plus the cold days
       still ahead, for themselves and the children they feed. Households
       stored their own grain; a village market can only buy as much as its
       till holds, so a farmer's autumn mostly stays under their own roof. */
    const reserve = p => (baseNeed(p) + (p.feeds || 0)) * (1.1 + winterAhead() * 1.25 * (0.6 + 0.8 * (p.patient ?? 0.5)));   // a quarter over, for a long winter; more for the patient (TODO 10)
    /* The cold costs food: people eat up to a quarter more in a hard winter. */
    const baseNeed = p => (adult(p) ? 1 : 0.35 + 0.65 * clamp(p.age / S.grown, 0, 1));
    const dailyNeed = p => baseNeed(p) * (1 + 0.25 * S.winter * Math.max(0, -warmth()));
    /* ── who lives where (2026-11-15, TODO item 2) ─────────────────────────
       Several things a person does went through everybody alive to find the
       people of one village: what the village eats in a day, who to ask for
       food, who to sell a cartload to, whose house an army's rations come
       from. One person's choice then cost more the more people there were
       anywhere — with bodies at real size, half the engine's time at 20,000.
       `residents` is those people, a list per village in the order of the
       people array, so anything that takes "the first" or adds up along the
       way gets what it got. It is made again, the first time it is wanted,
       after anything that can change it: a birth, a move, a village changing
       hands, the dead leaving the array, the hour, and whatever was done
       from outside between steps. What a village eats in a day is kept the
       same way, and is also worked out again after a death. */
    let rosterStamp = 1, rosterAt = 0, needStamp = 1;
    const roster = [], needOf = [], needAt = [];
    function residents(id) {
      if (rosterAt !== rosterStamp) {
        for (const l of roster) if (l) l.length = 0;
        for (const p of people) (roster[p.home] || (roster[p.home] = [])).push(p);
        rosterAt = rosterStamp;
      }
      const list = roster[id] || (roster[id] = []);
      if (AUDIT) { const want = people.filter(p => p.home === id); if (want.length !== list.length || want.some((p, k) => p !== list[k])) throw new Error("audit: the list of who lives in village " + id + " is out of date"); }
      return list;
    }
    const changedHomes = () => { rosterStamp++; needStamp++; };
    const storeDays = v => {
      let need = 0;
      if (PLAIN) { for (const p of people) if (p.home === v.id && p.hp !== -99) need += dailyNeed(p); }
      else {
        if (needAt[v.id] !== needStamp) {
          for (const p of residents(v.id)) if (p.hp !== -99) need += dailyNeed(p);
          needOf[v.id] = need; needAt[v.id] = needStamp;
        }
        need = needOf[v.id];
        if (AUDIT) { let n = 0; for (const p of people) if (p.home === v.id && p.hp !== -99) n += dailyNeed(p); if (n !== need) throw new Error("audit: what " + v.name + " eats in a day is out of date"); }
      }
      return need > 0 ? v.food / need : 0;
    };

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

    /* ── the land (TODO item 4a, 2026-11-15) ──────────────────────────────
       Height first, in metres, from smooth noise in lumps 300 km to 1 km
       across (a lump wider than the land is only a tilt, so a small land is
       a valley and only a big one has ranges); then the sea, lakes and
       rivers, water always running downhill; then the kind of ground from
       height, steepness, wetness and warmth; then fertility and ore from
       the kind. Its own random draws, so the land is the seed's alone.
       README, "Land from the seed". */
    (function land() {
      const n = tiles, R = rng((S.seed | 0) * 2654435761 + 97);   // its own draws: the land is the seed's alone
      const PER_KM = 4;
      /* smooth noise whose lumps are `km` across, whatever the size of a square */
      const layer = km => {
        const cell = Math.max(1, km * PER_KM), gw = Math.ceil(cols / cell) + 2, gh = Math.ceil(rows / cell) + 2;
        const g = new Float32Array(gw * gh); for (let i = 0; i < g.length; i++) g[i] = R();
        return { cell, gw, g };
      };
      const at = (L, x, y) => {
        const fx = x / L.cell, fy = y / L.cell, ix = fx | 0, iy = fy | 0, ux = fx - ix, uy = fy - iy;
        const sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy), g = L.g, w = L.gw, k = iy * w + ix;
        const a = g[k], b = g[k + 1], c = g[k + w], d = g[k + w + 1];
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
      };
      /* Height in metres: lumps from 300 km down to 1.5 km, each as tall as its size allows (a lump
         wider than the land is only a tilt, so a small land is a valley, not a range). "Hills" makes
         the middle sizes taller. Lower toward the edges, so a sea, if any, is a coast. */
      const sizes = [300, 120, 45, 16, 6, 2.5, 1], tall = [1400, 900, 550, 260, 110, 45, 18];
      const across = Math.max(cols, rows) / PER_KM, hilly = 0.35 + 1.3 * S.hills;
      const amp = sizes.map((km, i) => tall[i] * Math.min(1, across / km) * (km <= 45 && km >= 2.5 ? hilly : 1));
      const H = sizes.map(layer), wet1 = layer(Math.min(80, across * 0.5)), wet2 = layer(6), rich = layer(2), stone = layer(5);
      const h = height, edge = Math.min(cols, rows) * 0.3, drop = amp.reduce((a, b) => a + b, 0) * 0.35;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        let v = 0; for (let k = 0; k < H.length; k++) v += (at(H[k], x, y) - 0.5) * 2 * amp[k];
        const e = Math.min(1, Math.min(x, y, cols - 1 - x, rows - 1 - y) / edge);
        h[y * cols + x] = v - drop * (1 - e) * (1 - e);
      }
      /* Sea level: the height below which `S.sea` of the land lies, by a histogram (no sort of millions). */
      const BINS = 4096, hist = new Int32Array(BINS);
      let lo = Infinity, hi = -Infinity; for (let i = 0; i < n; i++) { if (h[i] < lo) lo = h[i]; if (h[i] > hi) hi = h[i]; }
      const bin = v => Math.min(BINS - 1, ((v - lo) / (hi - lo + 1e-9) * BINS) | 0);
      for (let i = 0; i < n; i++) hist[bin(h[i])]++;
      const level = q => { let c = 0, k = 0; for (; k < BINS; k++) { c += hist[k]; if (c >= q * n) break; } return lo + (k + 1) / BINS * (hi - lo); };
      /* Priority-Flood (Barnes, Lehman and Mulla 2014) with a bucket queue: in from the edges, lowest
         first. The square that reaches another first is where that one drains to (`down`), so water
         always has a way out: to the sea, off the edge, or over the lip of a hollow (which, filled
         deep enough, is a lake). `order` is the order squares were reached; read backwards it is
         upstream before downstream, which is how the water is added up. */
      /* A hollow holds a lake when it is deep for its land: 15 m in a valley, more where the land
         has thousands of metres of height in it (big hollows in noise are deeper than real ones,
         which rivers cut through). */
      const LAKE_DEEP = 15 + amp.reduce((a, b) => a + b, 0) * 0.02;
      const Q = 1 << 16, q = v => Math.min(Q - 1, Math.max(0, ((v - lo) / (hi - lo + 1e-9) * (Q - 1)) | 0));
      const head = new Int32Array(Q).fill(-1), tail = new Int32Array(Q).fill(-1), next = new Int32Array(n);
      const fill = new Float32Array(n), down = new Int32Array(n).fill(-1), order = new Int32Array(n), seen = new Uint8Array(n);
      let count = 0, lowest = Q;
      const add = (i, v) => { const b = q(v); next[i] = -1; if (tail[b] < 0) head[b] = i; else next[tail[b]] = i; tail[b] = i; if (b < lowest) lowest = b; };
      for (let x = 0; x < cols; x++) for (const y of [0, rows - 1]) { const i = y * cols + x; if (!seen[i]) { seen[i] = 1; fill[i] = h[i]; add(i, fill[i]); } }
      for (let y = 1; y < rows - 1; y++) for (const x of [0, cols - 1]) { const i = y * cols + x; if (!seen[i]) { seen[i] = 1; fill[i] = h[i]; add(i, fill[i]); } }
      const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
      while (count < n) {
        while (lowest < Q && head[lowest] < 0) lowest++;
        const i = head[lowest]; head[lowest] = next[i]; if (head[lowest] < 0) tail[lowest] = -1;
        order[count++] = i;
        const x = i % cols, y = (i / cols) | 0, v = fill[i];
        for (let d = 0; d < 8; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const j = ny * cols + nx; if (seen[j]) continue;
          seen[j] = 1; fill[j] = h[j] > v ? h[j] : v; down[j] = i; add(j, fill[j]);
        }
      }
      /* The sea: the ground a rising sea would reach from the edge. `fill` is the lowest height water
         must rise to before it gets from the edge to a square, so the sea at level L is every square
         with `fill` at most L; L is chosen so that `S.sea` of the land is sea. */
      hist.fill(0); for (let i = 0; i < n; i++) hist[bin(fill[i])]++;
      const sl = S.sea > 0 ? level(S.sea) : -Infinity;
      ground.fill(255);
      for (let i = 0; i < n; i++) {
        if (fill[i] <= sl) ground[i] = G_SEA;
        else if (fill[i] - h[i] > LAKE_DEEP) ground[i] = G_LAKE;   // a hollow deep enough to hold standing water
      }
      /* Rain, then how much ground drains through each square; a river where that passes a
         drainage area (O'Callaghan and Mark 1984): about 60 km² of ground at the fewest rivers,
         5 km² at the usual setting, half a square kilometre at the most. */
      const acc = new Float32Array(n);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const i = y * cols + x; acc[i] = 0.4 + at(wet1, x, y) * 0.9 + at(wet2, x, y) * 0.3; }
      for (let k = n - 1; k >= 0; k--) { const i = order[k], d = down[i]; if (d >= 0) acc[d] += acc[i]; }
      const thr = S.rivers > 0 ? PER_KM * PER_KM * 60 * Math.pow(0.008, S.rivers) : Infinity;
      for (let i = 0; i < n; i++) if (ground[i] === 255 && acc[i] > thr) {
        ground[i] = G_RIVER;
        const d = down[i];
        if (d >= 0) { const ddx = d % cols - i % cols, ddy = ((d / cols) | 0) - ((i / cols) | 0); for (let k = 0; k < 8; k++) if (DX[k] === ddx && DY[k] === ddy) riverTo[i] = k; }
      }
      /* Big rivers (TODO 6d): draining over about 300 km², a river tens of metres wide and too deep
         to wade (the Thames at Oxford drains about 1,600 km²; fords were where it ran shallow over
         gravel). A ford about every 2.5 km on such a river, every 7.5 km past 3,000 km², from the
         seed. */
      if (cross) for (let i = 0; i < n; i++) if (ground[i] === G_RIVER && acc[i] > PER_KM * PER_KM * 300) {
        let hsh = (S.seed * 2654435761 + i * 2246822519) >>> 0; hsh = Math.imul(hsh ^ (hsh >>> 15), 2246822507) >>> 0; hsh = (hsh ^ (hsh >>> 13)) >>> 0;
        cross[i] = hsh / 4294967296 < (acc[i] > PER_KM * PER_KM * 3000 ? 1 / 30 : 1 / 10) ? 2 : 1;
      }
      /* Nearness to water, out to 2 km, for wetness. */
      const near = new Uint8Array(n).fill(255), qq = new Int32Array(n); let qh = 0, qt = 0;
      for (let i = 0; i < n; i++) if (ground[i] <= G_RIVER) { near[i] = 0; qq[qt++] = i; }
      while (qh < qt) { const i = qq[qh++], x = i % cols, y = (i / cols) | 0, d = near[i] + 1; if (d > 8) continue;
        for (let k = 0; k < 4; k++) { const nx = x + DX[k], ny = y + DY[k]; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const j = ny * cols + nx; if (near[j] > d) { near[j] = d; qq[qt++] = j; } } }
      let edgeLow = Infinity;
      for (let x = 0; x < cols; x++) edgeLow = Math.min(edgeLow, h[x], h[(rows - 1) * cols + x]);
      for (let y = 0; y < rows; y++) edgeLow = Math.min(edgeLow, h[y * cols], h[y * cols + cols - 1]);
      const base = S.sea > 0 ? sl : edgeLow;               // sea level, or where the land runs off its edge
      /* Hills are steep ground, mountains steep and high: the rise over half a kilometre either way. */
      const steep = i => { const x = i % cols, y = (i / cols) | 0, a = Math.max(0, x - 2), b = Math.min(cols - 1, x + 2), c = Math.max(0, y - 2), d = Math.min(rows - 1, y + 2);
        return Math.max(Math.abs(h[y * cols + b] - h[y * cols + a]) / (b - a || 1), Math.abs(h[d * cols + x] - h[c * cols + x]) / (d - c || 1)) * PER_KM; };   // metres a kilometre
      const HILL = 40, MOUNT = 90;
      /* Warmth: the equator and mild winters warm, height cold. Snow and ice above a line that
         comes down as the world gets colder: about 2,400 m at 45° with a real winter, 900 m at 70°
         with a hard one (the Alps' snow line is near 2,800 m, Norway's 900 to 1,500 m). */
      const cold = clamp((S.latitude ?? 45) / 70 * 0.65 + (S.winter ?? 0.5) * 0.35, 0, 1);
      const snowAt = base + 4500 - cold * 3600;
      /* How well each kind grows, against each other: grassland best, cleared forest and
         hills less, dry land and beach poorly, nothing on water, marsh, mountain or snow. The
         whole table is scaled by 1.15, measured: with the river flats (below), the ground
         within 2 km of a village grows what it did on the land before, 0.568 against 0.566 on
         average over ten seeds (0.49 unscaled and without the flats), so a default world eats
         as it did. */
      const FERT = [0, 0, 0, 0.18, 0, 0.8, 0.55, 0.42, 0, 0.22, 0].map(f => f * 1.15);
      const ORE = [0, 0, 0, 0.02, 0.02, 0.1, 0.12, 0.45, 0.8, 0.15, 0.3];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (ground[i] === 255) {
          const wet = at(wet1, x, y) * 0.75 + at(wet2, x, y) * 0.25 + Math.max(0, 1 - near[i] / 8) * 0.3;
          let byS = false; for (let d = 0; d < 8 && !byS; d++) { const nx = x + DX[d], ny = y + DY[d]; byS = nx >= 0 && ny >= 0 && nx < cols && ny < rows && ground[ny * cols + nx] === G_SEA; }
          const leaf = 1.02 - S.forest * 0.6; let sp;
          ground[i] = h[i] >= snowAt ? G_SNOW
            : byS && h[i] < sl + 6 ? G_BEACH
            : (sp = steep(i)) >= MOUNT && h[i] > base + 700 || h[i] > snowAt - 600 ? G_MOUNTAIN
            : sp >= HILL ? (wet > leaf + 0.15 ? G_FOREST : G_HILLS)
            : wet > 0.9 && near[i] <= 2 && fill[i] - h[i] < 0.5 && h[i] < base + 40 ? G_MARSH
            : wet > leaf ? G_FOREST
            : wet < 0.4 ? G_DRY : G_GRASS;
        }
        const k = ground[i];
        /* Ground within a kilometre of a river or lake grows better, most at the bank: river
           flats are laid down by floods (the Nile's, the Euphrates'), and why villages sit there. */
        const flat = near[i] <= 4 ? 0.2 * (1 - near[i] / 5) : 0;
        fert[i] = FERT[k] ? clamp(FERT[k] + flat + (at(rich, x, y) - 0.5) * 1.2 * (S.uneven ?? 0.6), 0.04, 1) : 0;
        ore[i] = ORE[k] ? clamp(ORE[k] + (at(stone, x, y) - 0.5) * 0.6, 0, 1) : 0;
      }
      if (check && check.land) Object.assign(check.land, { down: down, fill: fill });   // tests only (test/land.test.mjs): how the water drains
      for (let i = 0; i < n; i++) stock[i] = fert[i] * TILE_CAP * 1.6 * S.standing;   // "Crops in the fields"; 0.5 is what it always was
      if (RAIN) {
        nearW.set(near);
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) wetQ[y * cols + x] = clamp(Math.round((at(wet1, x, y) * 0.75 + at(wet2, x, y) * 0.25) * 255), 0, 255);
      }
    })();

    /* ── which ground joins which (TODO 4b) ──────────────────────────────
       Every square that is not sea or lake gets the number of the piece of
       land it is on, by one flood a world: two places with different numbers
       cannot be walked between, so a journey there is refused at once
       instead of searched for over the whole land. Corners count: a walker
       slips between two lakes that only touch at a corner. */
    /* Squares beside a big river, where a straight line is checked closely (`dryLine`, TODO 6d). */
    const byBig = cross !== null ? new Uint8Array(tiles) : null;
    if (byBig) for (let i = 0; i < tiles; i++) if (cross[i] === 1) {
      const x = i % cols, y = (i / cols) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) byBig[ny * cols + nx] = 1; }
    }
    const landPiece = new Int32Array(tiles);
    (function pieces() {
      const q = new Int32Array(tiles); let id = 0;
      for (let s0 = 0; s0 < tiles; s0++) {
        if (landPiece[s0] || stopAt(s0)) continue;
        id++; let qh = 0, qt = 0; q[qt++] = s0; landPiece[s0] = id;
        while (qh < qt) {
          const i = q[qh++], x = i % cols, y = (i / cols) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const j = ny * cols + nx; if (!landPiece[j] && !stopAt(j) && !shut(x, y, dx, dy)) { landPiece[j] = id; q[qt++] = j; }
          }
        }
      }
    })();
    const pieceAt = (x, y) => landPiece[clamp(Math.floor(y), 0, rows - 1) * cols + clamp(Math.floor(x), 0, cols - 1)];

    /* ── water to drink (TODO 6a, 2026-11-16) ─────────────────────────────
       A household keeps water at home and every one of them uses 20 litres
       a day from it (WHO's basic access); anybody standing at a river or a
       lake shore drinks there instead. With none, a person weakens and dies
       in about three days, sooner in summer heat (Ric: "Real"), or about two
       weeks if gentler. Water is fetched from the nearest river or lake shore,
       40 litres a trip; the sea is salt. A village whose fresh water is over a
       kilometre off digs a well, and fetches from that. With Thirst off none
       of this runs and nothing is drawn from the dice: the world is as it was.
       README, "Water to drink". */
    const THIRST = S.thirst === "real" ? 1 : S.thirst === "gentle" ? 2 : 0;
    const USE = 20, BUCKETS = 40, JAR = 300, WELL_HOURS = 240, FAR = 4;   // litres a day, a trip (two buckets), a house (a few large pots; at 160 a big family ran dry overnight, 13,000 dry hours a year); a well's person-hours; 1 km
    /* For every land square within 12 km of fresh water, the nearest square to drink at: a river
       square, or land beside a lake. -1 where there is none that near. Made once, only with
       thirst on. */
    const freshNear = THIRST ? new Int32Array(tiles).fill(-1) : null, freshDist = THIRST ? new Uint8Array(tiles).fill(255) : null;
    if (THIRST) {
      const q = new Int32Array(tiles); let qh = 0, qt = 0;
      for (let i = 0; i < tiles; i++) {
        if (stopAt(i)) continue;
        let fresh = ground[i] === G_RIVER;
        if (!fresh) { const x = i % cols, y = (i / cols) | 0; for (let dy = -1; dy <= 1 && !fresh; dy++) for (let dx = -1; dx <= 1 && !fresh; dx++) { const nx = x + dx, ny = y + dy; fresh = nx >= 0 && ny >= 0 && nx < cols && ny < rows && (ground[ny * cols + nx] === G_LAKE || (cross !== null && cross[ny * cols + nx] === 1)); } }
        if (fresh) { freshNear[i] = i; freshDist[i] = 0; q[qt++] = i; }
      }
      while (qh < qt) {
        const i = q[qh++], x = i % cols, y = (i / cols) | 0, d = freshDist[i] + 1; if (d > 48) continue;
        for (let k = 0; k < 4; k++) { const nx = x + [1, -1, 0, 0][k], ny = y + [0, 0, 1, -1][k]; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const j = ny * cols + nx; if (!stopAt(j) && freshDist[j] > d) { freshDist[j] = d; freshNear[j] = freshNear[i]; q[qt++] = j; } }
      }
    }
    if (THIRST) count.thirst = 0;
    count.sites = 0; count.houses = 0;   // houses started and finished (TODO 7b)
    count.boatsBuilt = 0; count.boatsLost = 0; count.drowned = 0;   // boats built and lost, and who went down with them (TODO 7d)
    count.rent = 0; count.shares = 0;      // days of food that went to a leader's barn, and to a household whose field somebody else worked (TODO 7c)

    /* ── who holds the land (TODO 7c, 2026-11-16) ───────────────────────────
       Ric: "It should be a setting for each tribe. And the leader decides
       that or sometimes the people. Like different governments". Each
       faction has a rule:
       - "family": every household that farms holds fields of its own near
         its house, a square (6.25 ha) for every two or three of them, so a
         family of five two squares, about a virgate (nominally 30 acres,
         12 ha); they work their own first, and anybody may work another
         household's for half of what it gives, the other half going to
         that household, as harvest work was paid in sheaves (holdings
         nobody else could touch starved half as many again in a year);
       - "village": the fields are the village's in common, anybody works
         any (as it was before);
       - "leader": the land is the leader's; everybody works it and a third
         of what they bring in goes to the leader's barn, the village store
         (rent in kind, as on a manor).
       A chief or the richest chooses by their leanings (who believes in
       sharing chooses common fields, a greedy one their own land, anybody
       else families); a faction that votes chooses what most of its
       grown-ups lean to, and changes only when a clear majority (55%) wants
       it; the visitor chooses for a faction they rule; or the world's
       setting fixes one rule for all. README, "Who holds the land". */
    const held = new Map();                // square -> house holding it
    let heldStamp = 0;                      // changed whenever any holding is
    let allotted = false;                   // land has been shared out once (at the start)
    const landOf = v => factions[v.f] ? factions[v.f].land : "village";
    function landLean(p, isLeader) { return viewOf(p) > 0.3 ? "village" : isLeader && p.greed > 0.6 ? "leader" : "family"; }
    function landWant(f) {
      if (S.land && S.land !== "decide") return S.land;
      if (f.yours && f.yours.land) return f.yours.land;
      const lead = byId.get(f.leader);
      if (f.rule !== "elected") return lead ? landLean(lead, true) : f.land || "village";
      const n = { family: 0, village: 0 }; let all = 0;
      for (const p of people) if (p.f === f.id && adult(p) && p.hp !== -99) { n[landLean(p, false)]++; all++; }
      if (!all) return f.land || "village";
      const top = n.family >= n.village ? "family" : "village";
      return !f.land || f.land === "leader" || n[top] / all >= 0.55 ? top : f.land;
    }
    function setLand(f, rule) {
      const was = f.land; f.land = rule;
      for (const v of villages) if (v.f === f.id && v.alive) allot(v);
      if (was) {
        const v = villages.find(o => o.alive && o.f === f.id) || { x: 0, y: 0 };
        note("rule", f.name + (rule === "family" ? ": every family now holds its own fields." : rule === "village" ? ": the fields are now the village's, in common." : ": the land is now the leader's, worked for a share."), 2, v.x, v.y, f.id);
      }
    }
    /* A village's holdings, made up to date: under "family" each household its share of the
       village's own land, the nearest to its house, keeping what it held; otherwise none. */
    function allot(v) {
      const family = landOf(v) === "family";
      /* Only a household that farms holds land: one whose people worked the fields twice or more
         in the month before (every lived-in house, at the start). Land held by a household that
         did not would lie idle, as nobody works another family's field: measured, holding it
         anyway starved twice as many in a year. */
      /* A household keeps its fields through a winter: they go back only after three months running
         without farming them (measured: taken back each month, every winter emptied the holdings). */
      const farms = new Set();
      for (const h of homes) if (h.v === v.id) {
        h.idle = h.farmed >= 2 ? 0 : (h.idle || 0) + 1;
        if (family && (allotted ? h.n > 0 && (h.farmed >= 2 || h.fields && h.idle < 3) : h.n > 0)) farms.add(h.id);
        h.farmed = 0;
      }
      for (const h of homes) if (h.v === v.id && h.fields) {
        const keep = family && h.built && farms.has(h.id) ? h.fields.filter(i => owner[i] === v.id) : [];
        for (const i of h.fields) if (!keep.includes(i)) held.delete(i);
        h.fields = keep.length ? keep : null;
      }
      if (family) for (const h of homes) {
        if (h.v !== v.id || !h.built || !farms.has(h.id)) continue;
        const want = Math.max(1, Math.ceil(h.n / 2.5));           // about 6.25 ha for every two or three of them
        if (h.fields && h.fields.length >= want) continue;
        const cx = Math.floor(h.x), cy = Math.floor(h.y), cand = [];
        for (let r = 0; r <= 10 && cand.length < 24; r++) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
          if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const i = y * cols + x;
          if (owner[i] === v.id && fert[i] > 0.05 && !held.has(i)) cand.push(i);
        }
        cand.sort((a, b) => Math.hypot(a % cols + 0.5 - h.x, ((a / cols) | 0) + 0.5 - h.y) - Math.hypot(b % cols + 0.5 - h.x, ((b / cols) | 0) + 0.5 - h.y) || a - b);
        for (const i of cand) { if ((h.fields ? h.fields.length : 0) >= want) break; (h.fields || (h.fields = [])).push(i); held.set(i, h.id); }
      }
      heldStamp++;
    }

    /* ── fishing (TODO 6c, 2026-11-16) ─────────────────────────────────────
       Natural waters give about 20 to 50 kg of fish a hectare a year (FAO,
       inland fisheries), more in rivers and shallow lakes; a square of water
       is 6.25 ha. A kilogram of fish is about a third of a grown-up's day of
       food. What a square holds is at most a year of that, and it comes back
       at that rate when fished down, kept only for squares somebody has
       fished. A village's fishing ground is the water nearest its middle,
       within 2 km, and every water square within 750 m of that. A day's
       fishing brings in up to about 6 kg, less in the cold. README, "Fishing". */
    const FISH = S.fishing !== "off";
    const FISH_KG = [30, 40, 60];                                   // a hectare a year: sea, lake, river
    const fishYear = i => FISH_KG[ground[i]] * 6.25 * 0.35;        // days of food a square gives a year
    const fishStock = new Map();                                   // square -> [days of food, hour last reckoned]
    function fishIn(i) {
      const cap = fishYear(i), e = fishStock.get(i);
      if (!e) return cap;
      return Math.min(cap, e[0] + cap * (t - e[1]) / (365 * DAY_HOURS));
    }
    function fishGround(v) {
      if (v.fishing !== undefined) return v.fishing;
      const cx = Math.floor(v.x), cy = Math.floor(v.y);
      let best = -1, bd = 1e9;
      for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 8; x <= cx + 8; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows || ground[y * cols + x] > G_RIVER) continue;
        const d = Math.hypot(x - cx, y - cy); if (d <= 8 && d < bd) { bd = d; best = y * cols + x; }
      }
      if (best < 0) return v.fishing = null;
      const bx = best % cols, by = (best / cols) | 0, list = [];
      for (let y = by - 3; y <= by + 3; y++) for (let x = bx - 3; x <= bx + 3; x++)
        if (x >= 0 && y >= 0 && x < cols && y < rows && ground[y * cols + x] <= G_RIVER && Math.hypot(x - bx, y - by) <= 3) list.push(y * cols + x);
      return v.fishing = { x: bx + 0.5, y: by + 0.5, tiles: list };
    }
    const fishDay = () => 2.1 * (0.45 + 0.55 * clamp((warmth() + 0.6) / 1.2, 0, 1));   // about 6 kg on a warm day
    /* What a day's fishing would bring, against a full day's: 0 to 1. */
    function fishWorth(v) {
      const g = fishGround(v); if (!g) return 0;
      if (v.fishAt === t) return v.fishW;                          // worked out once an hour
      const day = fishDay();
      let have = 0; for (const i of g.tiles) { have += fishIn(i); if (have > day * 3) break; }
      v.fishAt = t; return v.fishW = Math.min(1, have / (day * 3)) * (day / 2.1);
    }
    if (FISH) count.fish = 0;

    /* ── wood, stone and ore (TODO 9a, 2026-11-17) ─────────────────────────
       Ric: "Few and clear". A day's work at good ground is a load: about a
       cord of wood (a woodcutter cut and split a cord a day), a cubic metre or
       so of rough stone, some hundreds of kilograms of ore, less where the ore
       is poor. A forest square holds sixty loads and grows back twenty a year
       (managed woodland, some 3 to 5 m³ a hectare a year); stone and ore do not
       run out. Each goes to the village store at what the store pays, which
       is dear when the village wants more than it holds: houses being built,
       what crafters work, tools, weapons and carts. README, "Wood, stone and ore". */
    const MATS = S.materials !== "goods";
    const MAT = ["wood", "stone", "iron"];
    const MAT_TASK = { wood: "cut", stone: "quarry", iron: "mine" };
    const MAT_JOB = { wood: "woodcutter", stone: "miner", iron: "miner" };
    const WOOD_CAP = 60, WOOD_YEAR = 20;
    const woodStock = new Map();                                   // square -> [loads, hour last reckoned]
    function woodIn(i) {
      const e = woodStock.get(i);
      return e ? Math.min(WOOD_CAP, e[0] + WOOD_YEAR * (t - e[1]) / (365 * DAY_HOURS)) : WOOD_CAP;
    }
    /* Forest within 4 km of the middle, nearest first; the nearest hills or mountain; the best ore for the walk.
       Further than the fields reach: at 2 km a world with no forest that near cut no wood at all, made
       no shields, and lost five times as many in battle (seed 4, 2026-11-17). */
    function matGround(v) {
      if (v.mats) return v.mats;
      const cx = Math.floor(v.x), cy = Math.floor(v.y), wood = [], grass = [];
      let stone = -1, sd = 1e9, iron = -1, ib = 0;
      for (let y = cy - 16; y <= cy + 16; y++) for (let x = cx - 16; x <= cx + 16; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const d = Math.hypot(x - cx, y - cy); if (d > 16) continue;
        const i = y * cols + x, g = ground[i];
        if (g === G_FOREST) wood.push(i);
        if (g === G_GRASS || g === G_DRY || g === G_HILLS) grass.push(i);   // grazing (TODO 9b)
        if ((g === G_HILLS || g === G_MOUNTAIN) && d < sd) { sd = d; stone = i; }
        const r = ore[i] / (1 + d * 0.08); if (ore[i] >= 0.25 && r > ib) { ib = r; iron = i; }
      }
      const dd = i => Math.hypot(i % cols - cx, ((i / cols) | 0) - cy);
      wood.sort((a, b) => dd(a) - dd(b) || a - b);
      grass.sort((a, b) => dd(a) - dd(b) || a - b);
      return v.mats = { wood: wood, stone: stone, iron: iron, grass: grass };
    }
    function matSpot(v, k) {
      const g = matGround(v);
      if (k === "wood") { for (const i of g.wood) if (woodIn(i) >= 1) return i; return -1; }
      return k === "stone" ? g.stone : g.iron;
    }
    const matYield = (k, i) => k === "wood" ? 1 : k === "stone" ? (ground[i] === G_MOUNTAIN ? 1 : 0.8) : Math.min(1.2, ore[i] * 1.6);
    const matPrice = (v, k) => k === "wood" ? v.priceWood : k === "stone" ? v.priceStone : k === "iron" ? v.priceIron : k === "wool" ? v.priceWool : k === "hide" ? v.priceHide : k === "food" ? v.priceFood : v.priceGoods;
    const matWant = (v, k) => k === "wood" ? v.wantWood : k === "stone" ? v.wantStone : k === "iron" ? v.wantIron : k === "wool" ? v.wantWool : v.wantHide;
    const TRADED = ["wood", "stone", "iron", "wool", "hide"];
    /* What a day's work would be worth here, 0 to 1.4, as the bench is: little once the store holds plenty. */
    function matWorth(v, k, i) {
      const full = v[k] < matWant(v, k) * 1.5 ? 1 : 0.25;
      return clamp(matYield(k, i) * (shared ? 1.2 : matPrice(v, k) * 0.8) * full, 0, 1.4);
    }
    /* Into the store, paid what the till can pay. */
    function sellMat(p, v, k, amount) {
      if (!shared) {
        const paid = Math.min(amount * matPrice(v, k) * 0.85, Math.max(0, v.till)), tax = paid * taxOf(v);
        v.till -= paid; p.coins += paid - tax; factions[v.f].treasury += tax;
      }
      v[k] += amount;
    }
    if (MATS) { count.wood = 0; count.stone = 0; count.iron = 0; }

    /* ── herds and game (TODO 9b, 2026-11-17) ──────────────────────────────
       Herding: sheep and cattle on grassland, dry land and hills, unfarmed or
       fallow, within 4 km. Herders lived some 2 to 10 to the km² where farmers
       lived 20 to 60: a square (6.25 ha, about a dozen sheep) gives forty days
       of food a year in milk, cheese and meat, grows back over a year, and a
       day with the herd (a flock of a hundred or more to one shepherd) brings
       in up to two days' food and a little over, and wool, a load in about
       four days. Hunting: game in the forest, a tenth of a person
       to the km² for hunters alone, so a forest square holds about eight days of
       meat a year; a good day's hunt is two and a half days of food and a hide,
       and hunted hard the game is gone for years. Both less in the cold. */
    const GRAZE_YEAR = 40, GAME_YEAR = 8;
    const grazeStock = new Map(), gameStock = new Map();
    const stockIn = (m, i, cap) => { const e = m.get(i); return e ? Math.min(cap, e[0] + cap * (t - e[1]) / (365 * DAY_HOURS)) : cap; };
    const herdDay = () => 2.2 * (0.6 + 0.4 * clamp((warmth() + 0.6) / 1.2, 0, 1));
    const huntDay = () => 2.5 * (0.6 + 0.4 * clamp((warmth() + 0.6) / 1.2, 0, 1));
    /* The nearest grazing or forest with something on it, never a field a household holds: its place
       in the village's list (a square's number is wildList(v, k)[j]). */
    const wildList = (v, k) => k === "herd" ? matGround(v).grass : matGround(v).wood;
    function wildSpot(v, k) {
      const list = wildList(v, k);
      if (k === "herd") { for (let j = 0; j < list.length; j++) if (!held.has(list[j]) && stockIn(grazeStock, list[j], GRAZE_YEAR) >= 2) return j; return -1; }
      for (let j = 0; j < list.length; j++) if (stockIn(gameStock, list[j], GAME_YEAR) >= 1) return j;
      return -1;
    }
    /* What a day with the herd or the bow would bring, against a full day's fishing: 0 to about 1.2. */
    function wildWorth(v, k, j0) {
      if (j0 < 0) return 0;
      const day = k === "herd" ? herdDay() : huntDay();
      let have = 0, n = 0;
      const list = wildList(v, k);
      for (let j = j0; j < list.length && n < 6; j++, n++) have += stockIn(k === "herd" ? grazeStock : gameStock, list[j], k === "herd" ? GRAZE_YEAR : GAME_YEAR);
      return Math.min(1, have / (day * 3)) * (day / 2.1);
    }
    if (MATS) { count.meat = 0; count.wool = 0; count.hide = 0; }

    /* ── firewood (TODO 9c, 2026-11-17) ────────────────────────────────────
       Ric: "Yes, as a setting". A person burns about three-quarters of a load
       (a cord, near two tonnes) over a cold winter, a household some tonnes a
       year in a cold land (England about 1600, Hatcher), more in a hard winter
       and none in summer. It comes from the village store each day; the store
       wants a winter's worth before the cold, so wood is dear in autumn. With
       none, the village is cold: the very young and the old die of it first. */
    const FIRE = MATS && S.firewood !== "off";
    const chill = () => Math.max(0, 0.15 - warmth());                 // 0 in summer, about 1 in a hard winter
    const BURN = 0.006;                                                // loads a person a day at a chill of 1
    if (FIRE) count.cold = 0;

    /* ── who and what there is ─────────────────────────────────────────── */
    function newFaction(name, leaderViews) {
      const f = { id: factions.length, name: name, colour: COLOURS[factions.length % COLOURS.length],
                  leader: 0, treasury: 0, tax: S.tax, relief: false, army: S.soldiers, peace: S.soldiers, rule: S.rule, revolt: -1e9, land: "",
                  rel: {}, alive: true, founded: t, voteAt: t + S.term * YEAR * (0.5 + R() * 0.5),
                  views: leaderViews || 0, target: {}, pop: 0, soldiers: 0, hungry: 0, loyal: 0.6, dearAt: -1e9 };
      factions.push(f);
      for (const o of factions) if (o !== f) { f.rel[o.id] = blankRel(); o.rel[f.id] = blankRel(); }
      return f;
    }
    /* Between two factions (TODO 13): `op` what one thinks of the other, which drifts toward
       `bond`, an old friendship or feud that fades over a generation; an alliance, a trade deal
       (no tax on each other's people), tribute paid (`pays`: this side pays the other), and
       when this side last made a demand of the other. */
    function blankRel() { return { op: 0, war: false, since: 0, grief: 0, dead: 0, peaceAt: -1e9, bond: 0, ally: false, trade: false, pays: false, askedAt: -1e9, began: 0 }; }   // began: this side's leader when the war began (TODO 14c)
    function newVillage(x, y, f) {
      const v = { id: villages.length, name: unique(() => word(2)), x: x, y: y, f: f, food: 0, goods: 0, till: 0,
                  priceFood: 1, priceGoods: 2, pop: 0, adults: 0, hungry: 0, loyal: 0.6, ore: 0, siege: 0,
                  alive: true, founded: t, radius: 4, sick: 0, place: "village", placed: false, importAvg: 0, inFood: 0, marketTo: -1,
                  /* Wood, stone and ore in store, what each fetches and how much the village wants (TODO 9a). */
                  wood: 0, stone: 0, iron: 0, priceWood: 1, priceStone: 1, priceIron: 2, wantWood: 1, wantStone: 1, wantIron: 1, mats: undefined,
                  wool: 0, hide: 0, priceWool: 1.5, priceHide: 1.5, wantWool: 1, wantHide: 1,   // TODO 9b
                  cold: 0,   // TODO 9c: the share of the village unwarmed today
                  raidAt: -1e9, raidSeen: -1e9, yearSeen: undefined,   // TODO 10: the last time enemies struck here, and the year last looked back on
                  foes: 0,   // TODO 14a: enemy soldiers at its edge, counted each day with the siege
                  dangerAt: -1e9, gone: null, dearAt: -1e9,
                  heldTo: -1e9 };   // TODO 14c: until when the soldiers who took it stay to hold it   // TODO 14b: the last day enemies were at its edge, and who fled it   // TODO 10: the last time enemies struck here, and the year last looked back on
      let o = 0, c = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { o += ore[tileAt(x + dx, y + dy)]; c++; }
      v.ore = o / c;
      villages.push(v);
      return v;
    }
    /* Where somebody lives. Before 2026-11-13 nobody had a home: every task
       aimed at the village centre, and when people were given a reason to all
       be home at night the centre could not physically hold them — bodies
       cannot overlap, so a village gridlocked and nobody ever arrived anywhere.
       Houses are spread over the village's own ground by area, so a village
       has room for its people. A couple and their children share a house. */
    /* ── houses as buildings (TODO 7a, 2026-11-16) ─────────────────────
       A house now has a place, a size in metres and a facing, and a family
       sleeps inside it. A village is laid out in plots spiralling out from
       its middle about 19 m apart (a peasant house on its toft: 14 to 23 m
       long, 4 to 6 m wide, Houndtor's 14.2 by 4.3), never on water; a
       richer household's house is bigger (Ric). Sizes are in squares
       (250 m): `len` along the facing, `wid` across it. README, "Houses". */
    const homes = [];
    const M = 1 / 250;                                   // a metre, in squares
    function newHome(v, wealth) {
      let x = v.x, y = v.y, a = 0;
      for (let tries = 0; tries < 60; tries++) {
        const k = v.plots = (v.plots || 0) + 1;
        a = k * 2.39996 + v.id * 0.7;
        const r = 0.08 + 0.076 * Math.sqrt(k);
        x = clamp(v.x + Math.cos(a) * r, 0.6, cols - 0.6); y = clamp(v.y + Math.sin(a) * r, 0.6, rows - 0.6);
        if (!wet(x, y)) break;
      }
      const h = { id: homes.length, v: v.id, x: x, y: y, ang: a + Math.PI / 2, len: 0, wid: 0, water: JAR, src: null, n: 0,
                  built: true, work: 0, need: 0, goodsIn: 0, goodsNeed: 0, owner: 0, paid: false, fields: null, farmed: 0, idle: 0, head: 0, burned: -1e9 };   // TODO 14b: when it last burned
      sizeHome(h, wealth);
      homes.push(h);
      return h;
    }
    /* ── building houses (TODO 7b, 2026-11-16) ─────────────────────────────
       A household that needs a house and finds no empty one in its village
       starts one: a plot like any other, its size by what the household has.
       It takes work, about two hours a square metre of floor (a 54 m²
       cottage about 14 person-days, a 168 m² house 42), and materials: goods
       bought from the village, one for every 20 m² and six besides, or, where
       there are none or no coin for them, gathered by hand, eight hours for
       each (timber, wattle and thatch, as most peasants did). The family
       builds it themselves, or pays a builder, a crafter of the village, a
       wage and a half for the work (Ric: "Sometimes a family sometimes a
       builder"). Until it is built they live where they were. README,
       "Building houses". */
    const sites = [];                     // houses still being built
    const BUILD_SHIFT = 5, GATHER_HOURS = 8, BUILDER_PAY = 1.5 * WAGE * BUILD_SHIFT / 8;
    const floor = h => h.len * h.wid / (M * M);                        // square metres
    const roomFor = h => Math.max(4, Math.round(floor(h) / 10));       // about 10 m² a person
    function startHouse(owner, v) {
      /* An empty house first: one whose household died out or moved away. */
      let empty = null;
      for (const h of homes) if (h.v === v.id && h.built && h.n === 0 && !h.taken) { empty = h; break; }
      if (empty) { empty.taken = true; moveIn(owner, empty); return empty; }
      /* Or a site somebody gave up on. */
      /* (Or whose owner no longer waits on it: moved away, or fled and came back, TODO 14b.) */
      for (const h of homes) if (h.v === v.id && !h.built && !waitsOn(h)) { h.owner = owner.id; h.paid = funds(owner) >= 15 + reserve(owner) * v.priceFood; owner.waitHouse = h.id; return h; }
      const h = newHome(v, clamp(funds(owner) / 40, 0, 1));
      h.built = false; h.owner = owner.id; sites.push(h); h.need = Math.round(floor(h) * 2); h.goodsNeed = Math.round(6 + floor(h) / 20);
      h.paid = funds(owner) >= 15 + reserve(owner) * v.priceFood;
      owner.waitHouse = h.id; count.sites++;
      return h;
    }
    const waitsOn = h => { const o = byId.get(h.owner), m = o && byId.get(o.partner); return !!o && o.hp !== -99 && (o.waitHouse === h.id || !!m && m.waitHouse === h.id); };
    /* Into a house: the one who asked, their partner, and their children who live with them. */
    function moveIn(owner, h) {
      const mate = owner.partner && byId.get(owner.partner), was = owner.dwelling;
      for (const q of PLAIN ? people : residents(owner.home)) {
        if (q.hp === -99 || q.home !== owner.home) continue;
        const kid = !adult(q) && (q.mum === owner.id || q.dad === owner.id || q.carer === owner.id || mate && (q.mum === mate.id || q.dad === mate.id)) && q.dwelling === was;
        if (q === owner || q === mate || kid) { q.dwelling = h.id; q.hx = h.x; q.hy = h.y; q.waitHouse = -1; }
      }
      h.taken = false;
    }
    /* Once a day: a household too many for its house, or a couple living with other grown-ups,
       looks for a house of its own. */
    function housing() {
      const by = new Map();
      for (const p of people) if (p.hp !== -99 && p.dwelling >= 0 && adult(p)) { const l = by.get(p.dwelling); if (l) l.push(p); else by.set(p.dwelling, [p]); }
      for (const [id, list] of by) {
        const h = homes[id], v = villages[h.v];
        if (!v || !v.alive) continue;
        /* Too many for the house, or a married couple living with other grown-ups: a couple set
           up a household of its own when it married (Hajnal, north-west Europe), so the youngest
           couple goes, a son or daughter and the one they married. */
        if (h.n <= roomFor(h) && list.length < 3) continue;
        let leave = null;
        for (const p of list) if (p.partner && p.waitHouse < 0 && p.home === h.v && list.some(q => q.id === p.partner) && (!leave || p.age < leave.age)) leave = p;
        if (leave && list.length > 2 && !list.some(q => q.waitHouse >= 0)) startHouse(leave, v);
      }
    }
    /* Once a day: under 1% of every square's treading wears off, and paths and roads follow it. */
    function wearOff() {
      let w = 0, changed = false;
      for (let k = 0; k < trodList.length; k++) {
        const i = trodList[k];
        trod[i] = Math.max(0, trod[i] - Math.max(1, trod[i] >> 7));   // under 1% a day: a path outlasts a winter
        const was = track[i], now = trod[i] >= ROAD_ON || (was === 2 && trod[i] >= ROAD_OFF) ? 2 : trod[i] >= PATH_ON || (was >= 1 && trod[i] >= PATH_OFF) ? 1 : 0;
        if (now !== was) { track[i] = now; changed = true; }
        if (trod[i] > 0) trodList[w++] = i;
      }
      trodList.length = w;
      if (changed) { trackStamp++; ways.clear(); }
    }
    /* A shift of building: the work, the materials it can get, and the builder's pay. */
    function buildShift(p, h) {
      const v = villages[h.v], owner = byId.get(h.owner);
      if (h.built) return;
      const builder = p.job === "crafter" && owner !== p && !(owner && owner.partner === p.id);
      /* What the household keeps back: coin for a winter of bread at what it costs here now.
         Measured: spending it on a house starved half as many again in a year (six seeds). */
      const keep = owner ? reserve(owner) * v.priceFood : 0;
      if (builder) {
        if (!owner || !h.paid || funds(owner) - BUILDER_PAY < keep) { h.paid = false; return; }
        pay(owner, BUILDER_PAY); p.coins += BUILDER_PAY;
      }
      h.work += BUILD_SHIFT * (p.job === "crafter" ? 1.3 : 1);
      /* With real materials (TODO 9a), a load of wood or of stone, whichever the store holds more of. */
      const k = MATS ? (v.stone > v.wood ? "stone" : "wood") : "goods";
      if (h.goodsIn < h.goodsNeed && v[k] >= 1) {
        const price = MATS ? matPrice(v, k) : v.priceGoods;
        if (shared) { v[k] -= 1; h.goodsIn++; }
        else if (owner && funds(owner) - price >= keep) {
          const cost = price, tax = cost * taxOf(v);
          pay(owner, cost); v.till += cost - tax; factions[v.f].treasury += tax; v[k] -= 1; h.goodsIn++;
        }
      }
      if (h.work + h.goodsIn * GATHER_HOURS >= h.need + h.goodsNeed * GATHER_HOURS) {
        h.built = true; count.houses++;
        if (owner && owner.hp !== -99 && owner.home === h.v) moveIn(owner, h);
      }
    }
    /* 12 m by 4.5 for the poorest, up to 24 by 7 for the richest. */
    function sizeHome(h, wealth) { const w = clamp(wealth, 0, 1); h.len = (12 + 12 * w) * M; h.wid = (4.5 + 2.5 * w) * M; }
    let starting = true;   // the first residents are housed once couples and children are known
    let founding = true;   // and each gets a house as they are (TODO 7b: after that, newcomers lodge and build)
    function house(p, v, from) {
      R(); R();                                           // the two draws the old scattered house took, so what follows draws as before
      if (starting) return;
      houseNow(p, v, from);
    }
    function houseNow(p, v, from) {
      if (from && from.home === v.id && from.dwelling >= 0) { p.hx = from.hx; p.hy = from.hy; p.dwelling = from.dwelling; return; }
      if (founding) { const h = newHome(v, 0.5); p.hx = h.x; p.hy = h.y; p.dwelling = h.id; return; }
      /* Somebody new to a village (TODO 7b): an empty house if there is one, else a hut put up at
         once, the smallest house there is, as a cottar's was. (Lodging them in a neighbour's house
         while they built was tried: hungry newcomers spent their days building, not farming, and
         a year starved more than half as many again.) */
      for (const h of homes) if (h.v === v.id && h.built && h.n === 0 && !h.taken) { h.n = 1; p.hx = h.x; p.hy = h.y; p.dwelling = h.id; p.waitHouse = -1; return; }
      const h = newHome(v, 0);
      h.n = 1; p.hx = h.x; p.hy = h.y; p.dwelling = h.id;
    }
    /* Where a house fetches water from: its village's well if it has one and it is nearer, else
       the nearest river or lake shore. Kept on the house; forgotten when a well is dug. */
    function sourceOf(h) {
      if (h.src) return h.src;
      const v = villages[h.v], ti = tileAt(h.x, h.y), j = freshNear[ti];
      let best = j >= 0 ? { x: j % cols + 0.5, y: ((j / cols) | 0) + 0.5, d: 0 } : null;
      if (best) best.d = Math.hypot(best.x - h.x, best.y - h.y);
      if (v && v.well) { const d = Math.hypot(v.well.x - h.x, v.well.y - h.y); if (!best || d < best.d) best = { x: v.well.x, y: v.well.y, d: d }; }
      return h.src = best;
    }
    /* A child whose house is dry drinks from the fullest house of its own village. */
    function shareWater(p) {
      const best = villages[p.home].fullest;          // noted once an hour (`countHouses`)
      if (!best || best.water < USE / DAY_HOURS) return false;
      best.water -= USE / DAY_HOURS; return true;
    }
    /* Once an hour: how many live in each house, and each village's fullest house. Counting
       them at every decision was a quarter of a 20,000-person world's time. */
    function countHouses() {
      for (const h of homes) h.n = 0;
      for (const p of people) if (p.hp !== -99 && p.dwelling >= 0) { const h = homes[p.dwelling]; h.n++; if (adult(p)) h.head = p.id; }   // and a grown-up of it, for its share (TODO 7c)
      for (const v of villages) v.fullest = null;
      for (const h of homes) { const v = villages[h.v]; if (v && (!v.fullest || h.water > v.fullest.water)) v.fullest = h; }
    }
    /* Somewhere inside one's own house, for sleeping. */
    function inHouse(p) {
      const h = homes[p.dwelling], u = (R() - 0.5) * 0.6, w = (R() - 0.5) * 0.5;
      if (!h) return [p.hx + u * 0.04, p.hy + w * 0.04];
      const c = Math.cos(h.ang), s = Math.sin(h.ang);
      return [h.x + c * u * h.len - s * w * h.wid, h.y + s * u * h.len + c * w * h.wid];
    }

    /* Somewhere in the village to stand, spread over its ground rather than on
       one tile in the middle. Measured 2026-11-13: with the market, the
       workshops and the tool-fitting all aimed at a point a tile across, a
       village jammed solid and an adult spent a third of their hours walking
       into the backs of their neighbours. Bodies cannot overlap, so a place
       that everybody uses has to be a place, not a point. */
    function plaza(v, reach) {
      const a = R() * 6.2832, r = reach * (0.3 + Math.sqrt(R()) * 0.7);
      return [clamp(v.x + Math.cos(a) * r, 0.6, cols - 0.6), clamp(v.y + Math.sin(a) * r, 0.6, rows - 0.6)];
    }

    function newPerson(v, age, mum, dad) {
      const f = factions[v.f];
      const p = { id: nextId++, name: unique(() => word(R() < 0.5 ? 2 : 3)), age: age, f: v.f, home: v.id, born: t,
                  dieAt: S.life * (0.72 + R() * 0.56), job: "child", x: v.x + (R() - 0.5) * v.radius * 1.5, y: v.y + (R() - 0.5) * v.radius * 1.5,
                  tx: v.x, ty: v.y, task: "idle", wait: Math.floor(R() * 30 * STEP_SCALE), food: 0.8 + R() * 0.6, coins: 0, goods: 0, gear: {},
                  hp: 1, bold: nature(R(), S.bold), warm: nature(R(), S.warm), greed: nature(R(), S.greedy), stub: clamp(S.stubborn + (R() - 0.5) * S.differ, 0, 1), loyal: clamp(0.35 + S.loyalty * 0.5 + (R() - 0.5) * 0.2, 0, 1),
                  mood: 0.6, partner: 0, mum: mum ? mum.id : 0, dad: dad ? dad.id : 0, kids: 0,
                  talk: Math.floor(R() * 40 * STEP_SCALE), say: "", sayT: 0, talkingTo: 0, cargo: null, hungry: 0, sick: 0, immune: false,
                  unpaid: 0, hit: 0, from: v.f, ate: -999, at: v.id,
                  /* What they need besides food, which `p.food` already holds.
                     Rest rises with the hours awake, falls while asleep; alone
                     counts the hours since anybody spoke to them; fear comes
                     from war, a siege and fighting they can see. All three are
                     read by `urgency` and nothing else sets them. */
                  rest: R() * 0.3, alone: Math.floor(R() * 20), fear: 0, chose: "", until: 0, making: false, settled: -1e9,
                  hx: v.x, hy: v.y, dwelling: -1,
                  /* Walking's own book-keeping (2026-11-15), nothing a person is:
                     where they last were seen standing, their last blocked step, the last
                     way round that could not be found, and whether they have been
                     given a place to stand yet. */
                  ox: NaN, oy: NaN, mc: -1, mx: NaN, my: NaN, mdx: 0, mdy: 0, rm: null, on: false, way: null, wx: 0, wy: 0,
                  /* And the engine's (TODO item 2): their place in the people
                     array, which square's list they are on (-1: none yet), and
                     when and for which ground they last asked to be told of
                     room being made (`watchFor`). */
                  ix: -1, bk: -1, wg: -1, wb: -1,
                  /* Steps, of those on which they could speak, until they next
                     try to (0: not drawn yet). See "when somebody next speaks". */
                  tryIn: 0,
                  /* Everything set later in a life is named here, empty, so every
                     person is the same kind of object from birth (2026-11-15).
                     Measured: with these added one by one as they were first used,
                     there were 21 layouts of "a person", and looking a field up on
                     an object that might be any of them was a third of the engine's
                     time at 20,000 people and half of it with bodies at real size.
                     `undefined` reads exactly as a missing field did. */
                  feeds: undefined, wards: undefined, route: undefined, stuck: undefined, lastDistance: undefined,
                  blocked: undefined, routeRetry: undefined, askOf: undefined, carer: undefined,
                  harvesting: undefined, harvestShare: undefined, markets: undefined, supplyRun: undefined,
                  /* Water (TODO 6a), fishing (6c) and boats (6d): hours without water, what they carry home, at
                     the water, and a crossing under way. Missing here they made 6a and 6 measurably slower. */
                  dry: undefined, carry: undefined, fishing: undefined, over: undefined, rowing: undefined,
                  /* Building (TODO 7b): the house they are waiting for, which they are working on, and whether a shift is under way. */
                  waitHouse: -1, buildAt: -1, shift: false,
                  fledFrom: -1,   // TODO 14b: the village they fled from, while they are away from it
                  gathering: undefined,   // TODO 9a: at the day's cutting, quarrying or mining
                  /* TODO 10: the other five of the ten, and what of the last hard times has yet to wear off. */
                  patient: nature(RT(), S.patient), temper: nature(RT(), S.temper), hard: nature(RT(), S.hardwork),
                  curious: nature(RT(), S.curious), honest: nature(RT(), S.honest), fade: null, quarrelAt: undefined, stoleAt: undefined, leanYr: undefined,
                  mb: -1, mcap: clamp(Math.round(S.memory * (0.75 + RM() * 0.5)), 3, MB - 1) };   // TODO 11: the mind's block and size
      newMind(p);
      house(p, v, mum || dad);
      if (mum && dad) {
        // Starting supplies belong to world setup, not to each new birth.
        // A newborn is fed from the same household/store as other children.
        p.food = 0;
        /* Children take after their parents, and stray from them as far as
           "How much they differ" allows (at its middle, as they always did). */
        const stray = 0.6 * S.differ;
        p.bold = clamp((mum.bold + dad.bold) / 2 + (R() - 0.5) * stray, 0, 1);
        p.warm = clamp((mum.warm + dad.warm) / 2 + (R() - 0.5) * stray, 0, 1);
        p.greed = clamp((mum.greed + dad.greed) / 2 + (R() - 0.5) * stray, 0, 1);
        p.stub = clamp(((mum.stub ?? S.stubborn) + (dad.stub ?? S.stubborn)) / 2 + (R() - 0.5) * stray, 0, 1);
        for (const k of NEW_TRAITS) p[k] = clamp((mum[k] + dad[k]) / 2 + (RT() - 0.5) * stray, 0, 1);
        setView(p, clamp((viewOf(mum) + viewOf(dad)) / 2 + (R() - 0.5) * 0.4, -1, 1));
        p.mcap = clamp(Math.round((mum.mcap + dad.mcap) / 2 + (RM() - 0.5) * S.memory * 0.25), 3, MB - 1);
        inherit(p, mum); inherit(p, dad);   // TODO 12
      } else {
        /* Divided worlds start as two camps, pulled toward wherever their own
           faction leans, so the argument is between places as well as people. */
        const camp = R() < 0.5 ? -1 : 1;
        setView(p, clamp(f.views * 0.5 + camp * S.divided * 0.7 + (R() - 0.5) * (0.3 + S.divided * 0.5), -1, 1));
      }
      p.ix = people.length; people.push(p); byId.set(p.id, p);
      if (!PLAIN) {
        changedHomes();
        freshList.push(p);
        if (people.length > wake.length) {
          const n = wake.length * 2, w = new Float64Array(n), k = new Uint8Array(n), z = new Float64Array(n);
          w.set(wake); k.set(kind); z.set(since); wake = w; kind = k; since = z;
        }
      }
      return p;
    }

    /* A founder's nature: spread about the middle by "How much they differ"
       — at its middle, exactly the even spread it always was. */
    function nature(u, mid) { return clamp((mid ?? 0.5) + (u - 0.5) * 2 * S.differ, 0, 1); }

    /* ── the mind (TODO 11) ──────────────────────────────────────────────────
       Ric: "a person can hold a certain number of bits of information." One slot is one thing:
       what kind, who or what about, how strong, and when it was last refreshed. Nothing is
       worked out as time passes: how much is left of a thing is read off its age when it is
       read, halving over its kind's half-life (`M_HALF`; a grudge as long as a family tie). */
    function newMind(p) {
      const b = mFree.length ? mFree.pop() : mTop++;
      if ((b + 1) * MB > mKind.length) {
        const n = MB * Math.ceil(mKind.length / MB * 1.5), k = new Uint8Array(n), a = new Int32Array(n), s = new Float32Array(n), at = new Float32Array(n);
        k.set(mKind); a.set(mAbout); s.set(mStr); at.set(mAt); mKind = k; mAbout = a; mStr = s; mAt = at;
        const fr = new Int32Array(n), vr = new Uint8Array(n); fr.set(mFrom); vr.set(mVar); mFrom = fr; mVar = vr;
      }
      const o = b * MB;
      mKind.fill(0, o, o + MB);
      mKind[o] = M_BELIEF; mStr[o] = 0; mAt[o] = 0;
      p.mb = b;
    }
    function freeMind(p) { if (p.mb >= 0) { mFree.push(p.mb); p.mb = -1; } }
    function viewOf(p) { return p.mb >= 0 ? mStr[p.mb * MB] : 0; }
    function setView(p, x) { if (p.mb >= 0) mStr[p.mb * MB] = x; }
    /* What is left of slot o now. */
    function mNow(o) {
      const k = mKind[o], s = mStr[o];
      if (k === M_BELIEF) return s;
      const half = k === M_FRIEND && s < 0 ? M_GRUDGE_HALF : k === M_NEWS && lasting.size && lasting.has(mAbout[o]) ? M_GRUDGE_HALF : M_HALF[k];
      return s * Math.exp(-(t - mAt[o]) * Math.LN2 / half);
    }
    /* The slot holding this kind of thing about this one, or -1. */
    function mFind(p, kind, about) {
      if (p.mb < 0) return -1;
      const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
      for (let o = o0; o < o1; o++) if (mKind[o] === kind && mAbout[o] === about) return o;
      return -1;
    }
    /* Somewhere to put a new thing: an empty slot, or the weakest thing held, forgotten. */
    function mRoom(p) {
      const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
      let drop = -1, weakest = Infinity;
      for (let o = o0; o < o1; o++) {
        if (mKind[o] === 0) return o;
        /* A grudge or a family tie is harder to forget than a friendship as strong (Ric: "Grudges
           last longest"): measured, a soldier who counted 22 people as close friends forgot the
           one person he hated first. */
        /* Nor is what was taken in this very hour (TODO 12): somebody told the news and then
           greeted was otherwise left forgetting the news they had just heard. */
        if (mAt[o] === t) continue;
        const k = mKind[o], x = mNow(o), w = Math.abs(x) * (k === M_KIN || (k === M_FRIEND && x < 0) || (k === M_NEWS && lasting.size && lasting.has(mAbout[o])) ? 2 : 1);
        if (w < weakest) { weakest = w; drop = o; }
      }
      return drop >= 0 ? drop : o0;
    }
    /* Hold a thing at this strength now, in place of what was held about it. */
    function hold(p, kind, about, strength) {
      if (p.mb < 0) return undefined;
      let o = mFind(p, kind, about);
      if (o < 0) o = mRoom(p);
      mKind[o] = kind; mAbout[o] = about; mStr[o] = strength; mAt[o] = t; mFrom[o] = -1; mVar[o] = 0; mindStamp++;
      return o;
    }
    /* Hold what somebody told them (TODO 12): who it came from, and which telling. */
    function heard(p, kind, about, strength, from, v) {
      const o = hold(p, kind, about, strength);
      if (o !== undefined) { mFrom[o] = from; mVar[o] = v || 0; }
      return o;
    }
    function forget(p, kind, about) { const o = mFind(p, kind, about); if (o >= 0) { mKind[o] = 0; mindStamp++; } }
    /* How p feels about somebody: −1 a bitter grudge, +1 the closest of friends; 0 nobody to them. */
    function feel(p, id) {
      if (p.mb < 0) return 0;
      const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
      for (let o = o0; o < o1; o++) { const k = mKind[o]; if ((k === M_FRIEND || k === M_KIN) && mAbout[o] === id) return mNow(o); }
      return 0;
    }
    /* Everybody p feels anything about, as [id, feeling]. */
    function tiesOf(p) {
      const out = [];
      if (p.mb < 0) return out;
      const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
      for (let o = o0; o < o1; o++) { const k = mKind[o]; if (k === M_FRIEND || k === M_KIN) out.push([mAbout[o], mNow(o)]); }
      return out;
    }
    /* How many they count as friends. */
    function circle(p) {
      if (p.mb < 0) return 0;
      let n = 0;
      const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
      for (let o = o0; o < o1; o++) { const k = mKind[o]; if ((k === M_FRIEND || k === M_KIN) && mNow(o) > 0.2) n++; }
      return n;
    }
    /* The newest news they hold and have not forgotten (an event's id), or -1. */
    function newsOf(p) {
      let best = -1;
      if (p.mb < 0) return best;
      const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
      for (let o = o0; o < o1; o++) if (mKind[o] === M_NEWS && mAbout[o] > best && mNow(o) > 0.1) best = mAbout[o];
      return best;
    }
    /* ── passing on what one holds (TODO 12) ──────────────────────────────
       A piece of news is an event and a telling of it. Telling 0 is what happened; each time it
       is passed on there is a chance (`S.wrong`; Ric, 2026-11-18: "1 in 20") it comes out
       changed, as rumours do (Allport and Postman 1947): a number grows or a harvest shrinks
       (sharpening), or a village or a side is swapped for another (assimilation). The tellings
       of an event are kept on it (`e.vars`, the text of each), and who told whom on
       `e.hops`, so a piece of news can be followed back to where it began. */
    const TELLINGS = 12, HOPS = 400, WITNESS = 3;
    /* Every hearing of an event, by who heard it, in order of time (a person who forgot it and
       was told again has two). At most HOPS an event. */
    function logHop(e, p, from, fromName, v) {
      if (!e.hops) { e.hops = new Map(); e.nh = 0; }
      if (e.nh >= HOPS) return;
      e.nh++;
      const h = { from: from, fromName: fromName, name: p.name, home: p.home, t: t, v: v };
      const l = e.hops.get(p.id);
      if (l) l.push(h); else e.hops.set(p.id, [h]);
    }
    function telling(e, v) { return v && e.vars && e.vars[v] ? e.vars[v] : e.text; }
    function retold(e, v) {
      const was = telling(e, v), ways = [];
      const num = /(\d+)(%?)/.exec(was);
      if (num) ways.push(() => {
        const n = +num[1], to = num[2] ? Math.max(0, Math.round(n * (0.4 + R() * 0.4))) : n + Math.max(1, Math.round(n * (0.4 + R())));
        return was.slice(0, num.index) + to + was.slice(num.index + num[1].length);
      });
      const vil = villages.filter(x => x.alive && x.name && was.includes(x.name));
      if (vil.length) ways.push(() => {
        const from = pick(vil), others = villages.filter(x => x.alive && x !== from && !was.includes(x.name));
        return others.length ? was.split(from.name).join(pick(others).name) : was;
      });
      const fac = factions.filter(x => x.alive && x.name && was.includes(x.name));
      if (fac.length && factions.filter(x => x.alive).length > fac.length) ways.push(() => {
        const from = pick(fac), others = factions.filter(x => x.alive && !was.includes(x.name));
        return others.length ? was.split(from.name).join(pick(others).name) : was;
      });
      if (!ways.length) return v;
      const text = pick(ways)();
      if (text === was) return v;
      if (!e.vars) e.vars = [e.text];
      const at = e.vars.indexOf(text);
      if (at >= 0) return at;
      if (e.vars.length >= TELLINGS) return v;
      e.vars.push(text); count.toldWrong++;
      return e.vars.length - 1;
    }
    /* The slot holding p's newest news, or -1. */
    function newsSlot(p) {
      let best = -1, at = -1;
      if (p.mb < 0) return -1;
      const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
      for (let o = o0; o < o1; o++) if (mKind[o] === M_NEWS && mAbout[o] > best && mNow(o) > 0.1) { best = mAbout[o]; at = o; }
      return at;
    }
    /* The words p holds about their newest news, or "". */
    function newsText(p) {
      const o = newsSlot(p); if (o < 0) return "";
      const e = eventById(mAbout[o]);
      return e ? telling(e, mVar[o]) : "";
    }
    function eventById(id) {
      let lo = 0, hi = events.length - 1;   // events are kept in order of id
      while (lo <= hi) { const m = (lo + hi) >> 1, x = events[m].id; if (x === id) return events[m]; if (x < id) lo = m + 1; else hi = m - 1; }
      return null;
    }
    /* Where p's news came from, from p back to whoever saw it: [{name, place, day, from, text,
       changed}], the last {saw: true}, or {saw: false} where the trail is lost. Walked back in
       time: each teller's step is the hearing they had before they told it. */
    function traceNews(p, id) {
      const e = eventById(id), out = [];
      if (!e) return out;
      let cur = p.id, before = Infinity;
      for (let n = 0; n < 80; n++) {
        const l = e.hops && e.hops.get(cur), q = byId.get(cur);
        let h = null;
        /* The first step is what they hold now: past HOPS hearings an event's later ones are not
           kept, and the newest kept may not be the one they hold. */
        const o = n === 0 ? mFind(p, M_NEWS, id) : -1;
        if (o >= 0) h = { from: mFrom[o], fromName: mFrom[o] >= 0 ? (byId.get(mFrom[o]) || {}).name || "somebody now gone" : "", name: p.name, home: p.home, t: mAt[o], v: mVar[o] };
        else if (l) for (let i = l.length - 1; i >= 0; i--) if (l[i].t <= before) { h = l[i]; break; }
        if (!h) { out.push({ name: q ? q.name : "somebody now gone", place: q ? villages[q.home].name : "", day: null, text: null, saw: false }); break; }
        const place = villages[h.home] ? villages[h.home].name : "";
        if (h.from === -1) { out.push({ name: h.name, place: place, day: null, text: null, saw: true }); break; }
        if (h.from === -2) { out.push({ name: h.name, place: place, day: null, text: null, saw: false, old: true }); break; }   // grew up with it (TODO 13)
        out.push({ name: h.name, place: place, day: Math.floor(h.t / DAY_HOURS), from: h.fromName, text: telling(e, h.v) });
        cur = h.from; before = h.t;
      }
      /* Changed in the telling: what this person heard is not what their teller held. */
      for (let i = 0; i < out.length; i++) if (out[i].text !== null) {
        const next = out[i + 1], was = next && next.text !== null ? next.text : next && next.saw ? e.text : out[i].text;
        out[i].changed = out[i].text !== was;
      }
      return out;
    }
    /* Pass the news from teller to hearer, if the hearer believes them. Returns what was said. */
    function tellNews(teller, hearer, o) {
      const id = mAbout[o], e = eventById(id);
      if (!e) return null;
      const trust = feel(hearer, teller.id) + (kin(hearer, teller) ? 0.2 : 0);
      let v = mVar[o], changed = false;
      if (S.wrong > 0 && R() < S.wrong) { const w = retold(e, v); changed = w !== v; v = w; }
      const said = telling(e, v);
      count.passed++;
      if (R() > clamp(0.6 + trust * 0.4, 0.3, 1)) return { said: said, believed: false };
      heard(hearer, M_NEWS, id, Math.min(1, mNow(o) * 0.95), teller.id, v);
      logHop(e, hearer, teller.id, teller.name, v);
      actOn(hearer, e, said);
      shunSick(hearer, e, v);
      return { said: said, believed: true };
    }
    /* People act on what they hold, right or wrong: news that names their own side and another,
       of a war or a village taken, is a grievance against the other side as told. */
    function actOn(p, e, said) {
      if (e.kind !== "war" && e.kind !== "taken" && e.kind !== "feud") return;
      const mine = factions[p.f];
      if (!mine || !said.includes(mine.name)) return;
      p.loyal = clamp(p.loyal + 0.02, 0, 1);
      for (const x of factions) if (x.alive && x !== mine && said.includes(x.name) && mine.rel[x.id]) mine.rel[x.id].op = clamp(mine.rel[x.id].op - 0.002, -1, 1);
    }
    /* ── acting on more of what is heard (TODO 12b) ──────────────────────
       Ric, 2026-11-19: sickness, famine, and prices and harvests. Each is read from what the person
       holds as it was told to them, so a telling that names the wrong village sends them the wrong
       way. A report is acted on for so many days after what it tells of (`ACT_DAYS`). */
    const ACT_DAYS = { sick: 30, famine: 30, dear: 20, dry: 120 };
    const acted = new Set();   // recent events of those kinds: minds are read for them only while there are some
    /* The village a telling names (for a dry year, the faction), or -1. Kept here, keyed by event and
       telling, not on the event: the page reads events, and reading must not change them. */
    const named = new Map();
    function namedIn(e, v) {
      const key = e.id * TELLINGS + v;
      let n = named.get(key);
      if (n === undefined) {
        const said = telling(e, v), list = e.kind === "dry" ? factions : villages;
        n = -1; let len = 0;
        for (const x of list) if (x.name && x.name.length > len && said.includes(x.name)) { n = x.id; len = x.name.length; }
        named.set(key, n);
      }
      return n;
    }
    /* What p has heard and still holds, into these four lists (read them before the next call):
       villages with a sickness, villages starving, villages where food is dear, factions with a dry
       year. False when there is nothing. */
    const heardSick = [], heardFamine = [], heardDear = [], heardDry = [];
    /* Read once for a person in an hour: a choice asks three or four times (measured 2026-11-19, the
       repeat reads made a day 10% slower). Anything held or forgotten, and any new report, starts over. */
    let rumP = -1, rumT = -1, rumS = -1, rumAny = false;
    function rumours(p) {
      if (!acted.size || p.mb < 0) return false;
      if (p.id === rumP && t === rumT && mindStamp === rumS) return rumAny;
      rumP = p.id; rumT = t; rumS = mindStamp; rumAny = false;
      heardSick.length = 0; heardFamine.length = 0; heardDear.length = 0; heardDry.length = 0;
      let any = false;
      const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
      for (let o = o0; o < o1; o++) {
        if (mKind[o] !== M_NEWS || !acted.has(mAbout[o]) || mNow(o) <= 0.1) continue;
        const e = eventById(mAbout[o]);
        if (!e || t - e.t > ACT_DAYS[e.kind] * DAY_HOURS) continue;
        const at = namedIn(e, mVar[o]); if (at < 0) continue;
        (e.kind === "sick" ? heardSick : e.kind === "famine" ? heardFamine : e.kind === "dear" ? heardDear : heardDry).push(at);
        any = true;
      }
      rumAny = any;
      return any;
    }
    function forgetActed() {
      for (const id of acted) {
        const e = eventById(id);
        if (!e || t - e.t > ACT_DAYS[e.kind] * DAY_HOURS) { acted.delete(id); mindStamp++; for (let v = 0; v < TELLINGS; v++) named.delete(id * TELLINGS + v); }
      }
    }
    /* A sickness at home (Ric: "A few, to family"): a household with close family in another village
       of their own goes to them until a week after the sickness has gone, as those who could left
       London in 1665; some carry it with them, as they did. Read from the telling they hold: told it
       is somewhere else, they stay. */
    function shunSick(p, e, v) {
      if (e.kind !== "sick" || !adult(p) || p.hp <= 0 || p.fledFrom >= 0 || p.job === "soldier" || p.cargo || p.mb < 0) return;
      const home = villages[p.home];
      if (p.id === factions[p.f].leader || namedIn(e, v) !== home.id || t - e.t > ACT_DAYS.sick * DAY_HOURS) return;
      rumours(p);
      let to = null, close = 0.4;
      const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
      for (let o = o0; o < o1; o++) {
        if (mKind[o] !== M_KIN) continue;
        const x = mNow(o); if (x <= close) continue;
        const q = byId.get(mAbout[o]); if (!q || q.hp <= 0 || q.home === home.id) continue;
        const there = villages[q.home];
        if (there.alive && there.f === p.f && !there.siege && !heardSick.includes(there.id)) { close = x; to = there; }
      }
      if (!to || R() > 0.2) return;
      const lead = factions[p.f].leader, mate = byId.get(p.partner), us = [p];
      if (mate && mate.hp > 0 && mate.home === home.id && mate.job !== "soldier" && mate.id !== lead && mate.fledFrom < 0) us.push(mate);
      for (const q of PLAIN ? people : residents(home.id)) if (q.hp > 0 && !adult(q) && q.home === home.id && us.some(a => q.mum === a.id || q.dad === a.id || q.carer === a.id)) us.push(q);
      home.dangerAt = Math.max(home.dangerAt, t);   // a week at least before they come back (`comeHome`)
      for (const q of us) { q.fledFrom = home.id; rehome(q, to, "sickness"); (home.gone || (home.gone = [])).push(q.id); count.fledSick++; }
      p.say = "There's sickness at home. We're going to family in " + to.name + "."; p.sayT = TK(80);
    }
    /* A tip about somebody else's larder, from what the teller has seen or been told. */
    function tipFor(p, hungry) {
      if (p.mb < 0) return -1;
      const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
      let best = -1, bs = 0.05;
      for (let o = o0; o < o1; o++) if (mKind[o] === M_FOOD && mAbout[o] !== hungry.id) { const x = mNow(o); if (x > bs) { bs = x; best = o; } }
      return best;
    }
    /* Children start with a weaker copy of some of what a parent holds (Ric: "a mix of both"):
       the parent's newest news, a larder they know of, and their strongest feelings about
       others, grudges included but no deeper than a snub. */
    function inherit(p, par) {
      if (par.mb < 0 || p.mb < 0) return;
      const o0 = par.mb * MB + 1, o1 = o0 + par.mcap, pick4 = [];
      for (let o = o0; o < o1; o++) {
        const k = mKind[o];
        if (k === M_FRIEND || k === M_FOOD || k === M_NEWS) { const x = mNow(o); if (Math.abs(x) > 0.2 && mAbout[o] !== p.id) pick4.push([Math.abs(x), o, x]); }
      }
      pick4.sort((a, b) => b[0] - a[0]);
      for (const [, o, x] of pick4.slice(0, 4)) {
        const k = mKind[o];
        if (k === M_FRIEND) { const q = byId.get(mAbout[o]); if (q && !kin(p, q)) heard(p, M_FRIEND, q.id, x > 0 ? x * 0.3 : Math.max(x * 0.5, SNUB), par.id, 0); }
        else {
          heard(p, k, mAbout[o], x * 0.5, par.id, mVar[o]);
          const e = k === M_NEWS ? eventById(mAbout[o]) : null;
          if (e) logHop(e, p, par.id, par.name, mVar[o]);
        }
      }
    }
    /* What somebody has seen of another's larder: days of the other's own need over what they
       keep back, when last seen. Asking for food goes to those one knows of (TODO 11). */
    function sawLarder(p, q) {
      if (q.hp <= 0 || !adult(q) || p.mb < 0) return;
      const over = (q.food - reserve(q)) / Math.max(1e-6, dailyNeed(q));
      if (over >= 3) hold(p, M_FOOD, q.id, Math.min(1, over / 30));
      else forget(p, M_FOOD, q.id);
    }
    /* What a person holds, in plain words, for the person panel. */
    function inMind(p) {
      const out = [];
      if (p.mb < 0) return out;
      const o0 = p.mb * MB, o1 = o0 + 1 + p.mcap;
      for (let o = o0; o < o1; o++) {
        const k = mKind[o]; if (!k) continue;
        const s = mNow(o), ago = Math.floor((t - mAt[o]) / DAY_HOURS), who = byId.get(mAbout[o]);
        let text = "";
        if (k === M_BELIEF) text = s > 0.25 ? "Thinks what is grown should be shared" : s < -0.25 ? "Thinks what a person grows is theirs" : "Sees sense on both sides of sharing";
        else if (k === M_FRIEND || k === M_KIN) {
          if (!who) continue;
          const kin = k === M_KIN ? " (family)" : "";
          text = s > 0.5 ? "Close to " + who.name + kin : s > 0.15 ? "Friends with " + who.name + kin : s < -0.5 ? "Hates " + who.name + kin : s < -0.15 ? "Holds a grudge against " + who.name + kin : "Knows " + who.name + kin;
        } else if (k === M_NEWS) {
          const e = eventById(mAbout[o]); if (!e) continue;
          const from = mFrom[o] >= 0 ? byId.get(mFrom[o]) : null;
          text = (mFrom[o] >= 0 ? "Heard: " : mFrom[o] === -2 ? "Grew up knowing: " : "Saw: ") + telling(e, mVar[o]);
          out.push({ kind: "news", text: text, strength: s, days: ago, from: mFrom[o] >= 0 ? (from ? from.name : "somebody now gone") : null, wrong: mVar[o] > 0, trace: traceNews(p, e.id) });
          continue;
        }
        else if (k === M_FOOD) { if (!who) continue; const by = mFrom[o] >= 0 ? byId.get(mFrom[o]) : null; text = who.name + " had food to spare" + (mFrom[o] >= 0 ? " (told by " + (by ? by.name : "somebody now gone") + ")" : ""); }
        else if (k === M_DEBT) { if (!who) continue; text = "Owes " + who.name + " for food"; }
        const by = k !== M_BELIEF && mFrom[o] >= 0 ? byId.get(mFrom[o]) : null;
        out.push({ kind: ["", "friend", "family", "news", "food", "debt", "belief"][k], text: text, strength: s, days: ago, from: by ? by.name : null });
      }
      return out;
    }

    /* ── what happens to a person changes them (TODO 10) ─────────────────────
       Ric, 2026-11-17: "A little". A hard event moves a trait a few hundredths of its range,
       and half of what it moved wears off, half again every two years; the other half stays,
       and children start from what their parents have become. Loyalty is left out: it already
       follows how life is going, every six hours (`reflect`).
       What moves what, from the studies in the README: a raid makes people quicker to anger,
       closer to their own and less willing to wait (Bauer et al. 2016; Voors et al. 2012);
       a famine makes the survivors put more by and hold on to it, as people who lived through
       hard times stay more careful for life (Malmendier and Nagel 2011), and less scrupulous about how; a death in the
       family leaves them more fearful, and a killing more bitter; a good year softens them. */
    function shaken(p, d) {
      if (!p.fade) p.fade = new Float32Array(TRAITS.length);
      for (let i = 0; i < TRAITS.length; i++) {
        if (!d[i]) continue;
        const k = TRAITS[i], was = p[k];
        p[k] = clamp(was + d[i], 0, 1);
        p.fade[i] += (p[k] - was) / 2;
      }
    }
    function settle(p) {
      if (!p.fade) return;
      let left = 0;
      for (let i = 0; i < TRAITS.length; i++) {
        const g = p.fade[i] * TRAIT_FADE, k = TRAITS[i];
        p[k] = clamp(p[k] - g, 0, 1); p.fade[i] -= g; left += Math.abs(p.fade[i]);
      }
      if (left < 1e-4) p.fade = null;
    }

    /* Two people who cannot stand each other, face to face (TODO 10). Words, mostly; between
       the hot-tempered, blows. A fight is bruises, and now and then a death: about one person
       in 4,000 a year was killed in English villages of the 13th and 14th centuries (Given
       1977; Eisner 2003). LETHAL is set from that: measured over twelve world-years at ordinary
       tempers, some 51 fights a year among about 357 people once a refusal no longer made an
       enemy (2026-11-18; 220 before, 83 before item 11), so about one fight in 600 kills. */
    const LETHAL = 0.0017;
    function quarrel(a, b) {
      wakeUp(b);
      count.quarrels++;
      const heat = (a.temper + b.temper) / 2;
      if (R() < heat * heat * 1.2) {
        count.fights++;
        b.hp -= 0.05 + R() * 0.15 * (0.5 + a.temper);
        a.hp -= 0.03 + R() * 0.12 * (0.5 + b.temper);
        befriend(a, b, -0.25);
        said(a, b, "fight", pick(["I've had enough of you.", "Say that again.", "You'll answer for it."]), pick(["Get away from me!", "Try it.", "Help! Help!"]));
        const dead = R() < LETHAL ? (R() < 0.5 + (a.temper - b.temper) * 0.5 ? b : a) : null;
        if (dead) {
          const by = dead === a ? b : a;
          note("killing", by.name + " killed " + dead.name + " in a fight in " + villages[dead.home].name + ".", 1.5, dead.x, dead.y, dead.f);
          die(dead, "fight", by);
        }
        for (const q of [a, b]) if (q.hp !== -99 && q.hp < 0.02) q.hp = 0.02;   // hurt, not starved
      } else {
        befriend(a, b, R() < 0.5 ? 0.2 : -0.05);   // said and done with, as often as not
        said(a, b, "quarrel", pick(["We need to talk about what you said.", "You know what you did.", "I won't stand for it."]), pick(["Fine. I was wrong.", "Leave it.", "Not this again."]));
      }
    }
    /* Taking from a neighbour's larder (TODO 10). Somebody at home and awake most likely sees it,
       and somebody out or asleep now and then; whoever sees it holds it against the thief. */
    function steal(p, q) {
      const take = Math.min(3 * dailyNeed(p), Math.max(0, q.food - 10 * dailyNeed(q)) * 0.3);
      if (take < 0.05) return;
      q.food -= take; p.food += take; count.pilfered++;
      const home = q.dwelling >= 0 && homes[q.dwelling];
      const seen = home && q.task !== "sleep" && Math.hypot(q.x - home.x, q.y - home.y) < 1 ? R() < 0.7 : R() < 0.15;
      if (seen) {
        wakeUp(q);
        befriend(q, p, -0.5);
        shaken(q, LIFE.robbed);
        q.say = "Thief!"; q.sayT = TK(60); p.say = "I had to. My children are hungry."; p.sayT = TK(60);
      } else { p.say = "They won't miss it."; p.sayT = TK(40); }
    }
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const adult = p => p.age >= S.grown;
    const atWar = (a, b) => a !== b && factions[a].rel[b] && factions[a].rel[b].war;
    const shared = S.money === "shared";

    function note(kind, text, weight, x, y, f) {
      const e = { id: events.length ? events[events.length - 1].id + 1 : 0, t: t, year: Math.floor(year()), kind: kind, text: text,
                  weight: weight, x: x, y: y, f: f == null ? -1 : f };
      events.push(e);
      if (ACT_DAYS[kind]) { acted.add(e.id); mindStamp++; }   // TODO 12b
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
      /* Hamlets: a place for every fifteen or so (TODO 8). */
      const perFaction = S.places === "hamlets" ? Math.max(S.villages, Math.round(S.people / S.factions / 15)) : S.villages;
      const want = S.factions * perFaction;
      const spots = [];
      /* Spaced by the ground people can live on, not the whole map: a land that is half sea
         holds its villages twice as close (TODO 4a). Past 6,000 tries any livable spot will do. */
      let livable = 0; for (let i = 0; i < tiles; i++) if (GROUND[ground[i]].live) livable++;
      for (let tries = 0; tries < 9000 && spots.length < want; tries++) {
        const x = 3 + R() * (cols - 6), y = 3 + R() * (rows - 6);
        if (!GROUND[ground[tileAt(x, y)]].live) continue;            // never in the sea, on a mountain or in a marsh
        if (THIRST && tries < 3000 && freshDist[tileAt(x, y)] > 8) continue;   // within 2 km of fresh water, where the land allows (TODO 6a)
        if (fert[tileAt(x, y)] < 0.35 && tries < 4000) continue;
        const gap = tries > 6000 ? 1 : Math.max(5, Math.sqrt(Math.max(livable, 1) / want) * 0.62) * (tries > 3000 ? 0.6 : 1);
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
      for (let round = 1; round < perFaction; round++) for (const g of groups) {
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
      /* Who lives where (TODO 8): evenly, as always; or a market town takes two-fifths of each
         faction, or a city half of everybody. */
      const home = [];
      if (S.places === "towns" || S.places === "city") {
        const big = new Set(S.places === "city" ? [villages[0].id] : factions.map(f => villages.find(v => v.f === f.id).id));
        const share = S.places === "city" ? 0.5 : 0.4;
        for (const f of factions) {
          const mine = villages.filter(v => v.f === f.id), n = Math.round(S.people / factions.length);
          for (const v of mine) if (big.has(v.id)) for (let k = 0; k < Math.round((S.places === "city" ? S.people : n) * share); k++) home.push(v);
        }
        const rest = villages.filter(v => !big.has(v.id));
        for (let k = 0; home.length < S.people; k++) home.push(rest.length ? rest[k % rest.length] : villages[0]);
        home.length = S.people;
      }
      for (let i = 0; i < S.people; i++) {
        const v = home.length ? home[i] : villages[i % villages.length];
        /* "How old they are": skews the ages, all of them under three-quarters
           of a life as before; 0.5 is the even spread it always was. */
        const p = newPerson(v, Math.pow(R(), Math.pow(4, 0.5 - S.ages) * (S.ages < 0.5 ? 1.6 : 1)) * S.life * 0.75, null, null);
        /* Unequal starts are a long tail: most near nothing, a few a lot. The
           total is the same either way, so the setting moves coins, not mints them. */
        const tail = Math.pow(R(), 1 + S.unequal * 8) * (1 + S.unequal * 8);
        p.coins = shared ? 0 : S.coins * ((1 - S.unequal) + S.unequal * tail * 1.6);
        if (adult(p)) p.job = "farmer";
      }
      for (const v of villages) {
        v.food = 0; let n = 0;
        for (const p of people) if (p.home === v.id) n++;
        v.food = n * (0.8 + putByDays(S.stored) * 0.25); v.goods = n * 0.1; v.till = shared ? 0 : n * 2 + 5;
        if (MATS) { v.wood = n * 0.3; v.stone = n * 0.1; v.iron = n * 0.05; v.wool = n * 0.05; v.hide = n * 0.03; }
      }
      for (const f of factions) f.treasury = shared ? 0 : 10;
      /* A town or city made big at the start starts trusted to be fed (only it: ordinary villages
         given the same stayed overfull and starved a fifth of a 5,000-person world in its first winter): as if grain had been coming in for those
         its own rule would not hold. If it does not keep coming, the month's average falls. */
      for (const v of villages) { let n = 0; for (const p of people) if (p.home === v.id) n++; v.pop = n; placeOf(v); }
      if (S.places === "towns" || S.places === "city") for (const v of villages) if (home.length && home.filter(x => x === v).length > S.people / villages.length * 1.5) v.importAvg = Math.max(0, v.pop - (S.crowd >= 205 ? 70 : S.crowd)) * 0.85;
      /* "Food put by": days of each person's own need, in the house. */
      if (S.stored > 0) for (const p of people) p.food += putByDays(S.stored) * baseNeed(p);
      count.minted = money();
      territory();
      census();
      for (const f of factions) succeed(f, "first");
      startNeighbours();
      for (const p of people) if (adult(p)) p.job = chooseJob(p);
      for (const p of people) if (p.job === "trader") p.gear.cart = 1;   // a trader starts with a cart (TODO 7d)
      /* A quarter of the grown-ups start paired, so the first children are not
         fourteen years away. */
      for (const v of villages) {
        const single = people.filter(p => p.home === v.id && adult(p) && p.age < p.dieAt * 0.7);
        const couples = [];
        for (let i = 0; i + 1 < single.length; i += 2) if (R() < S.settled) {   // "How settled they are"; 0.5 as it always was
          single[i].partner = single[i + 1].id; single[i + 1].partner = single[i].id;
          couples.push([single[i], single[i + 1]]);
        }
        /* And the children who are here on the first day belong to somebody,
           or nobody would feed them. */
        const grown = people.filter(p => p.home === v.id && adult(p));
        /* Each child picks among the couples both older than the child by a
           grown-up's age, in the order they paired. That list was made afresh
           for each child: children times couples, a seventh of making a
           100,000-person world (TODO 3b). Now the couples are sorted by their
           younger partner, so how many qualify is a search; the same random
           draws are made in the same order, and the couple a draw names, the
           one at that place in pairing order, is read off afterwards (a
           Fenwick tree, the children with the fewest couples first). Same
           parents as before. */
        const younger = couples.map((k, i) => [Math.min(k[0].age, k[1].age), i]).sort((a, b) => b[0] - a[0]);
        const asks = [];
        for (const c of people) {
          if (c.home !== v.id || adult(c)) continue;
          const t = c.age + S.grown;
          let lo = 0, hi = younger.length;                       // how many couples' younger partner is older than t
          while (lo < hi) { const m = (lo + hi) >> 1; if (younger[m][0] > t) lo = m + 1; else hi = m; }
          if (lo) asks.push([c, lo, Math.floor(R() * lo)]);       // what pick() drew from a list `lo` long
          else if (grown.length) { const g = pick(grown); c.mum = g.id; g.kids++; }
        }
        if (asks.length) {
          const N = couples.length, tree = new Int32Array(N + 1);
          let top = 1; while (top * 2 <= N) top *= 2;
          let added = 0;
          asks.sort((a, b) => a[1] - b[1]);
          for (const [c, n, at] of asks) {
            for (; added < n; added++) for (let i = younger[added][1] + 1; i <= N; i += i & -i) tree[i]++;
            let pos = 0, want = at + 1;                            // the (at+1)th, in pairing order, of those added
            for (let step = top; step; step >>= 1) if (pos + step <= N && tree[pos + step] < want) { pos += step; want -= tree[pos]; }
            const k = couples[pos];
            c.mum = k[0].id; c.dad = k[1].id; k[0].kids++; k[1].kids++;
          }
        }
        /* Past the middle of "How settled they are", people already have
           friends among their neighbours — up to six each. */
        const known = Math.round(Math.max(0, S.settled - 0.5) * 12);
        if (known > 0) {
          const here = people.filter(p => p.home === v.id && p.age > 4);
          for (const p of here) for (let k = 0; k < known && here.length > 1; k++) {
            const q = pick(here);
            if (q !== p) befriend(p, q, 0.25 + R() * 0.35);
          }
        }
      }
      /* Households, now couples and children are known: a couple shares a house, a child lives
         with a parent in the same village, everybody else has their own (TODO 7a). */
      starting = false;
      /* Grown-ups first, so a child listed before its parent finds the parent housed. */
      for (const p of [...people.filter(q => adult(q)), ...people.filter(q => !adult(q))]) {
        if (p.dwelling >= 0) continue;
        const mate = p.partner && byId.get(p.partner), parent = byId.get(p.mum) || byId.get(p.dad);
        const from = mate && mate.dwelling >= 0 ? mate : parent && parent.home === p.home && parent.dwelling >= 0 && !adult(p) ? parent : null;
        houseNow(p, villages[p.home], from);
      }
      for (const p of people) if (p.dwelling >= 0) { const h = homes[p.dwelling]; p.x = h.x; p.y = h.y; p.tx = h.x; p.ty = h.y; }
      founding = false;
      /* Each house as big as its household is rich, against the others: by rank, so the
         biggest is the richest whatever "How unequal" is (TODO 7a). */
      {
        const worth = new Float64Array(homes.length);
        for (const p of people) if (p.dwelling >= 0) worth[p.dwelling] += p.coins;
        const order = homes.map(h => h.id).sort((a, b) => worth[a] - worth[b] || a - b);
        order.forEach((id, k) => sizeHome(homes[id], order.length > 1 ? k / (order.length - 1) : 0.5));
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
    /* How many a village can hold. A number, or — at the far end of "A full
       village" — as many as the fields within a day's work of it grow in a
       year's average day, a ration a head. Worked out each day with its
       territory, so a village that loses land, or a drought, makes it full. */
    /* ── villages, towns and cities (TODO 8, 2026-11-17) ──────────────────────
       A place is a village, a town or a city by its size, not by being made
       one: a town from 400 people (England's small medieval towns held about
       300 to 2,000, Dyer), a city from 5,000; it falls back below four-fifths of
       that. A place has room for as many as its rule for a full village
       allows, and besides for as many as the grain brought into it feeds (a
       running average over about half a year, `importAvg`: a town lives on a whole harvest): so a place grows where the land
       round it has a surplus that traders carry in, and stays a village where
       it has not. Towns and cities lose more of their people to sickness
       than the country, as crowded places did until clean water. README,
       "Villages, towns and cities". */
    function crowdOf(v) { return (S.crowd >= 205 ? Math.max(8, v.feeds || 0) : S.crowd) + (v.importAvg || 0) / 0.85; }
    function placeOf(v) {
      const was = v.place || "village", n = v.pop || 0;
      const now = n >= CITY_AT || (was === "city" && n >= CITY_AT * 0.8) ? "city" : n >= TOWN_AT || (was !== "village" && n >= TOWN_AT * 0.8) ? "town" : "village";
      if (now !== was) {
        v.place = now;
        if (v.placed) note("grow", v.name + (now === "city" ? " has grown into a city." : now === "town" ? (was === "city" ? " has shrunk to a town." : " has grown into a town.") : " is a village again."), now === "village" ? 1.5 : 3, v.x, v.y, v.f);
      }
      v.placed = true;
    }
    function landFeeds() {
      for (const v of villages) {
        if (!v.alive) { v.feeds = 0; continue; }
        let food = 0;
        const r = 8, cx = Math.floor(v.x), cy = Math.floor(v.y);
        for (let y = Math.max(0, cy - r); y <= Math.min(rows - 1, cy + r); y++)
          for (let x = Math.max(0, cx - r); x <= Math.min(cols - 1, cx + r); x++) {
            const i = y * cols + x;
            if ((owner[i] === v.id || owner[i] === -1) && Math.hypot(x + 0.5 - v.x, y + 0.5 - v.y) <= r) food += fert[i] * REGROW * DAY_HOURS * S.rich;
          }
        v.feeds = food;
      }
    }
    /* Who holds each square: the village it lies nearest the middle of, by
       the village's reach. Worked out around each village only — the same
       answer as asking every square of the map about every village, which on
       a state-sized map was most of a day's work. */
    function territory() {
      for (const v of villages) v.radius = v.alive ? 2.6 + Math.sqrt(Math.max(1, v.pop)) * 0.55 : 0;
      for (const i of ownedList) { owner[i] = -1; reachBest[i] = 1e9; }
      ownedList = [];
      for (const v of villages) {
        if (!v.alive) continue;
        const r = Math.ceil(v.radius) + 1;
        for (let y = Math.max(0, Math.floor(v.y) - r); y <= Math.min(rows - 1, Math.floor(v.y) + r); y++)
          for (let x = Math.max(0, Math.floor(v.x) - r); x <= Math.min(cols - 1, Math.floor(v.x) + r); x++) {
            const d = Math.hypot(v.x - x - 0.5, v.y - y - 0.5);
            if (d >= v.radius) continue;
            const i = y * cols + x, ratio = d / v.radius;
            if (ratio < reachBest[i]) { if (reachBest[i] === 1e9) ownedList.push(i); reachBest[i] = ratio; owner[i] = v.id; }
          }
      }
      worked();
      landFeeds();
    }
    /* Land over 40 km is mostly wild: its growth is worked out only within
       sixteen squares (four kilometres) of a village, and a square that comes
       into reach for the first time is a full stand of wild growth, as virgin
       ground is. Every map up to 40 km grows every square every hour, exactly
       as it always has. */
    function worked() {
      if (!WILD) return;
      const list = [], seen = new Uint8Array(tiles);
      for (const v of villages) {
        if (!v.alive) continue;
        const r = 16;
        for (let y = Math.max(0, Math.floor(v.y) - r); y <= Math.min(rows - 1, Math.floor(v.y) + r); y++)
          for (let x = Math.max(0, Math.floor(v.x) - r); x <= Math.min(cols - 1, Math.floor(v.x) + r); x++) {
            const i = y * cols + x; if (seen[i]) continue; seen[i] = 1; list.push(i);
            if (!inReach[i]) { inReach[i] = 1; stock[i] = fert[i] * FIELD_CAP; }
          }
      }
      workedList = list;
    }
    function census() {
      for (const v of villages) { v.pop = 0; v.adults = 0; v.hungry = 0; v.loyal = 0; v.sick = 0; v.held = 0; }
      for (const f of factions) { f.pop = 0; f.soldiers = 0; f.hungry = 0; f.loyal = 0; f.adults = 0; }
      for (const p of people) {
        const v = villages[p.home], f = factions[p.f];
        v.pop++; f.pop++; v.held += p.food;
        if (p.hungry > 0) { v.hungry++; f.hungry++; }
        if (p.sick > 0) v.sick++;
        if (adult(p)) { v.adults++; v.loyal += p.loyal; f.adults++; f.loyal += p.loyal; if (p.job === "soldier") f.soldiers++; }
      }
      for (const v of villages) v.loyal = v.adults ? v.loyal / v.adults : 0.6;
      for (const f of factions) f.loyal = f.adults ? f.loyal / f.adults : 0.6;
      /* Who feeds whom. Each child's real need is split between the parents
         at home with it, so a household stores for the children it actually
         has — before 2026-11-14 every child counted as half an adult whatever
         its age, and a widowed farmer with four stored for three. A child with
         no parent at home is taken in: by a grown brother or sister, else by
         whoever in the village has most put by. Until then an orphan could
         eat only from the village store, which is empty all winter, and they
         were half of the dead of a hard winter. */
      for (const p of people) { p.feeds = 0; p.wards = null; }
      /* The best carer in a village, and the best one who shares a mother or
         a father with the child, found in one pass over everybody and only if
         some child needs one. Until 2026-11-15 each such child read the whole
         population: at 20,000 people that was most of two seconds at the
         start and a sixth of every census after. `at` is the place in the
         list, so that between equals the first still wins, as it did. */
      let carers = null;
      const better = (a, b) => !b || a.score > b.score || (a.score === b.score && a.at < b.at) ? a : b;
      function findCarers() {
        carers = { any: new Map(), mum: new Map(), dad: new Map() };
        for (let at = 0; at < people.length; at++) {
          const q = people[at];
          if (!adult(q) || q.hp <= 0) continue;
          const plain = { q: q, score: q.food, at: at }, kin = { q: q, score: q.food + 1e6, at: at };
          carers.any.set(q.home, better(plain, carers.any.get(q.home)));
          if (q.mum) { const k = q.home + ":" + q.mum; carers.mum.set(k, better(kin, carers.mum.get(k))); }
          if (q.dad) { const k = q.home + ":" + q.dad; carers.dad.set(k, better(kin, carers.dad.get(k))); }
        }
      }
      for (const c of people) {
        if (adult(c) || c.hp === -99) continue;
        const keepers = [byId.get(c.mum), byId.get(c.dad)].filter(q => q && q.hp > 0 && q.home === c.home);
        if (!keepers.length) {
          let carer = byId.get(c.carer);
          if (!carer || carer.hp <= 0 || carer.home !== c.home || !adult(carer)) {
            if (!carers) findCarers();
            let pick = carers.any.get(c.home);
            if (c.mum) { const k = carers.mum.get(c.home + ":" + c.mum); if (k) pick = better(k, pick); }
            if (c.dad) { const k = carers.dad.get(c.home + ":" + c.dad); if (k) pick = better(k, pick); }
            carer = pick && pick.score > -1 ? pick.q : null;
            c.carer = carer ? carer.id : 0;
          }
          if (carer) keepers.push(carer);
        } else c.carer = 0;
        for (const q of keepers) { q.feeds += baseNeed(c) / keepers.length; (q.wards || (q.wards = [])).push(c); }
      }
      /* What a village's houses could sell beyond their own winter, and what
         they are short of the next two weeks. A grain trader reads these:
         with seasons the grain is in houses, not the store, and before
         2026-11-14 traders read only the store and so never moved any. */
      /* What a household is worth, and what the village and the faction are
         worth a head: ambition and envy are measured against these. */
      for (const v of villages) { v.wealth = 0; v.adultsW = 0; }
      for (const f of factions) { f.wealth = 0; }
      for (const p of people) {
        if (p.hp === -99) continue;
        const w = p.coins + p.food * 0.8 + p.goods * 2, v = villages[p.home];
        factions[p.f].wealth += w;
        if (adult(p)) { v.wealth += w; v.adultsW++; }
      }
      for (const v of villages) v.wealth = v.adultsW ? v.wealth / v.adultsW : 0;
      for (const f of factions) f.wealth = f.pop ? f.wealth / f.pop : 0;
      for (const v of villages) { v.spare = 0; v.short = 0; v.purse = 0; }
      for (const p of people) {
        if (!adult(p) || p.hp === -99) continue;
        const v = villages[p.home], r = reserve(p), soon = 14 * (baseNeed(p) + (p.feeds || 0));
        if (p.food > r) v.spare += p.food - r;
        if (p.food < soon) { v.short += soon - p.food; v.purse += p.coins; }
      }
    }
    /* One row a day: what the graphs on the page are drawn from. */
    function sample() {
      const row = { year: year(), day: Math.floor(t / DAY_HOURS), pop: {} };
      for (const f of factions) if (f.alive) row.pop[f.id] = f.pop;
      let held = 0, store = 0, price = 0, n = 0, hungry = 0, loyal = 0, adults = 0;
      for (const p of people) { held += p.food; if (p.hungry > 0) hungry++; if (adult(p)) { loyal += p.loyal; adults++; } }
      for (const v of villages) if (v.alive) { store += v.food; price += v.priceFood; n++; }
      row.people = people.length;
      row.food = people.length ? (held + store) / people.length : 0;
      row.price = n ? price / n : 0;
      row.hungry = people.length ? hungry / people.length : 0;
      row.loyal = adults ? loyal / adults : 0;
      for (const k of ["births", "starved", "sick", "battle", "old", "moved", "switched", "grain"]) row[k] = count[k] || 0;
      row.wars = 0; for (const f of factions) if (f.alive) for (const o of factions) if (o.alive && o.id > f.id && f.rel[o.id].war) row.wars++;
      history.push(row);
      if (history.length > 600) history.splice(0, history.length - 600);
    }

    /* ── work ────────────────────────────────────────────────────────────────
       What a day of each kind of work looks like it would be worth to this
       person, here, today. `chooseJob` and `choose` both read these figures, so
       what somebody is called and what they actually spend their day doing
       cannot drift apart — before 2026-11-13 they did: a sixth of a village
       were called crafters and 0.1% of its hours went on making anything. */
    function livelihood(p, v) {
      /* The land: what the patch they would walk to actually has standing on
         it, against what a day's work could carry away. Thin, crowded or
         worked-out ground is worth less than the walk. */
      const ti = pickField(p, v);
      let land = 0, tx = 0, ty = 0;
      if (ti >= 0) {
        tx = ti % cols; ty = Math.floor(ti / cols);
        let standing = 0, best = 0;
        for (let k = 0; k < 9; k++) {
          const x = tx + PATCH[k][0], y = ty + PATCH[k][1];
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          standing += stock[y * cols + x]; best += FIELD_CAP;
        }
        /* Two things, and both of them matter. Can a day's work be filled at
           all — and is this ground worth the walk compared with ground at its
           best? The second term is why good land is sought out, why a worked-out
           or crowded village pushes people into other trades or other places,
           and how `uneven` reaches a decision at all. */
        const fills = Math.min(1, standing / Math.max(1e-6, harvestCapacity(p)));
        const quality = best > 0 ? standing / best : 0;
        /* And how fast the ground gives: an hour on thin land is worth less
           than an hour at the bench, an hour on rich land more. */
        land = fills * (0.3 + 0.7 * Math.min(1, quality * 1.4)) * Math.min(1.3, harvestPace());
      }
      /* The bench: what a batch would be worth at what the village is paying
         for goods. A village short of goods pays more, which is the signal
         that makes somebody take it up. */
      const bench = clamp(craftOutput(p, v) * (shared ? 1.6 : v.priceGoods * 0.8), 0, 1.4);
      /* The road: whether anywhere reachable wants what is here. */
      const here = villages[p.at] && villages[p.at].alive ? villages[p.at] : v;
      const route = villages.filter(o => o.alive).length > 1 ? bestRoute(p, here) : { best: null, gain: 0, what: "food" };
      const load = route.best ? clamp(route.gain, 0, 1.2) : 0;
      return { land: land, tile: ti, tx: tx, ty: ty, bench: bench, load: load, here: here, route: route };
    }

    function chooseJob(p) {
      const v = villages[p.home], f = factions[p.f];
      if (f.adults > 0 && f.soldiers < f.army * f.adults && p.bold + (p.temper - 0.5) * 0.3 > 0.35 && R() < 0.8) { f.soldiers++; return "soldier"; }
      /* A village that cannot feed itself needs food, whatever else pays. */
      if (v.food < v.pop * 0.5) return "farmer";
      const w = livelihood(p, v);
      /* Somebody takes up the work that looks worth most to them. Greed makes
         the paid trades more tempting; nobody becomes a trader with nowhere to
         trade with, and nobody works land that has nothing on it. */
      const score = { farmer: w.land, crafter: w.bench * (0.85 + p.greed * 0.4), trader: w.load * (0.7 + p.greed * 0.6) };
      if (FISH && fishGround(v)) score.fisher = fishWorth(v) * 0.9;   // TODO 6c
      if (MATS) {                                                       // TODO 9a
        const iw = matSpot(v, "wood"), is = matSpot(v, "stone"), io = matSpot(v, "iron");
        if (iw >= 0) score.woodcutter = matWorth(v, "wood", iw) * 0.9;
        if (is >= 0 || io >= 0) score.miner = Math.max(is >= 0 ? matWorth(v, "stone", is) : 0, io >= 0 ? matWorth(v, "iron", io) : 0) * 0.9;
        const ih = wildSpot(v, "herd"), it = wildSpot(v, "hunt");                                       // TODO 9b
        if (ih >= 0) score.herder = wildWorth(v, "herd", ih) * 0.9;
        if (it >= 0) score.hunter = wildWorth(v, "hunt", it) * 0.9;
      }
      let job = "farmer", bs = -Infinity;
      for (const k of ["farmer", "crafter", "trader", "fisher", "woodcutter", "miner", "herder", "hunter"]) {
        if (score[k] === undefined) continue;
        const s = score[k] + (R() - 0.5) * 0.15;
        if (s > bs) { bs = s; job = k; }
      }
      return job;
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
      /* Still in the water: the nearest dry ground to it, ring by ring of
         squares (TODO 4b). */
      if (wet(p.tx, p.ty)) {
        const fx = Math.floor(p.tx), fy = Math.floor(p.ty);
        shore: for (let r = 1; r < 40; r++) for (let yy = fy - r; yy <= fy + r; yy++) for (let xx = fx - r; xx <= fx + r; xx++) {
          if (Math.max(Math.abs(xx - fx), Math.abs(yy - fy)) !== r || xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue;
          if (!stopAt(yy * cols + xx)) { p.tx = xx + 0.5; p.ty = yy + 0.5; break shore; }
        }
      }
      /* Over the sea or a lake from here: nobody can walk there, so they do
         not set off (TODO 4b). */
      const from = pieceAt(p.x, p.y), to = pieceAt(p.tx, p.ty);
      /* A load for another village by water, where that is quicker (TODO 7d). */
      const ship = CROSS && p.cargo && task === "carry" && from && from === to ? shipFor(p, p.tx, p.ty) : null;
      if (ship) { p.over = { x: p.tx, y: p.ty, task: task, bx: ship.bx, by: ship.by, hours: ship.hours, sea: ship.sea }; p.tx = ship.ax; p.ty = ship.ay; p.task = "boat"; p.rowing = false; }
      else if (from && to && from !== to) {
        /* By boat, where their village has one on this shore (TODO 6d). An army does not. */
        const army = task === "march" || task === "fight" || task === "patrol";
        const ferry = CROSS && !army ? ferryFor(p, from, to) : null;
        if (ferry) { p.over = { x: p.tx, y: p.ty, task: task, bx: ferry.bx, by: ferry.by, hours: ferry.hours, sea: ferry.sea }; p.tx = ferry.ax; p.ty = ferry.ay; p.task = "boat"; p.rowing = false; }
        else {
          if (CROSS) {
            const v = villages[p.home];
            if (v && !army) v.wantBoat = (v.wantBoat || 0) + 1;
            if (army) { const f = factions[p.f]; if (t - (f.stoppedAt ?? -1e9) > 30 * DAY_HOURS) { f.stoppedAt = t; note("war", f.name + "'s soldiers are stopped by water they cannot cross on foot.", 2, p.x, p.y, f.id); } }
          }
          p.tx = p.x; p.ty = p.y; p.task = "idle";
        }
      }
      p.lastDistance = Infinity; p.stuck = 0; p.blocked = 0; p.route = null; p.routeRetry = 0; p.way = null; p.shift = false;
    }
    /* ── bridges and boats (TODO 6d) ───────────────────────────────────────
       A village within 2 km of a big river that has no ford or bridge within
       1.5 km of it builds a bridge, about 75 person-days of timber work. A
       village within 2 km of a lake or the sea whose people have wanted to
       cross it builds a boat, about 15 person-days, and its people are
       rowed over from its landing at 4 km an hour. */
    const BRIDGE_HOURS = 600, BOAT_HOURS = 120;
    /* A house in the village whose household pays a builder, the nearest to its middle. */
    function paidSite(v) {
      let best = null, bd = Infinity;
      /* Only the sites still open, not every house in the world: looking through all of them at
         every crafter's decision was a tenth of a 20,000-person world's time (2026-11-17). */
      if (sites.length && sites.some(h => h.built)) { let w = 0; for (const h of sites) if (!h.built) sites[w++] = h; sites.length = w; }
      for (const h of sites) if (h.v === v.id && h.paid) { const d = Math.hypot(h.x - v.x, h.y - v.y); if (d < bd) { bd = d; best = h; } }
      return best;
    }
    function crossings(v) {
      if (v.crossings) return v.crossings;
      const cx = Math.floor(v.x), cy = Math.floor(v.y);
      let river = -1, rd = 1e9, shore = -1, sd = 1e9;
      for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 8; x <= cx + 8; x++) {
        if (x < 1 || y < 1 || x >= cols - 1 || y >= rows - 1) continue;
        const i = y * cols + x, d = Math.hypot(x - cx, y - cy); if (d > 8) continue;
        if (cross[i] === 1 && d < rd) { rd = d; river = i; }
        if (ground[i] <= G_LAKE && d < sd) {
          /* the land beside it, on the village's own piece */
          for (let k = 0; k < 8; k++) { const nx = x + [1, -1, 0, 0, 1, 1, -1, -1][k], ny = y + [0, 0, 1, -1, 1, -1, 1, -1][k], j = ny * cols + nx;
            if (landPiece[j] && landPiece[j] === pieceAt(v.x, v.y)) { sd = d; shore = j; break; } }
        }
      }
      let bridge = null;
      if (river >= 0) {
        let ford = false; const rx = river % cols, ry = (river / cols) | 0;
        for (let y = ry - 6; y <= ry + 6 && !ford; y++) for (let x = rx - 6; x <= rx + 6 && !ford; x++)
          ford = x >= 0 && y >= 0 && x < cols && y < rows && cross[y * cols + x] >= 2;
        if (!ford) bridge = { i: river, x: rx + 0.5, y: ry + 0.5 };
      }
      return v.crossings = { bridge: bridge, landing: shore >= 0 ? { i: shore, x: shore % cols + 0.5, y: ((shore / cols) | 0) + 0.5 } : null };
    }
    /* A bridge is built: walk over it at full pace, and two pieces of land it joins are one. */
    function bridgeBuilt(v) {
      const c = crossings(v).bridge, i = c.i; cross[i] = 3; v.bridge = { x: c.x, y: c.y };
      let id = 0; const x = i % cols, y = (i / cols) | 0, ids = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (y + dy) * cols + x + dx; if (landPiece[j] && !ids.includes(landPiece[j])) ids.push(landPiece[j]); }
      id = ids.length ? ids[0] : 0; landPiece[i] = id;
      if (ids.length > 1) for (let k = 0; k < tiles; k++) if (ids.includes(landPiece[k])) landPiece[k] = id;
      ways.clear();
      note("build", v.name + " has built a bridge over the river.", 2, c.x, c.y, v.f);
    }
    /* Over the water from their village's landing to the nearest shore of the land they are going
       to: a search over the water out to 50 km, kept for each village and land. */
    function ferryFor(p, from, to) {
      const v = villages[p.home]; if (!v || !v.boat || pieceAt(v.boat.x, v.boat.y) !== from) return null;
      const memo = v.ferries || (v.ferries = new Map());
      if (memo.has(to)) return memo.get(to);
      const a = crossings(v).landing; if (!a) return null;
      const found = waterRoute(a, j => landPiece[j] === to, 4);
      memo.set(to, found);
      return found;
    }
    /* A boatload of goods along a coast or a big river to another village's landing, when that is
       quicker than the road by a tenth (TODO 7d): a small boat under sail and oar makes about 6 km an hour along a coast, against a laden walk. */
    function shipFor(p, x, y) {
      const v = villages[p.home]; if (!v || !v.boat || !crossings(v).landing) return null;
      let o = null; for (const u of villages) if (u.alive && u !== v && Math.hypot(u.x - x, u.y - y) < 2.5) { o = u; break; }
      if (!o || !crossings(o).landing || Math.hypot(o.x - p.x, o.y - p.y) < 12) return null;
      const memo = v.ships || (v.ships = new Map());
      if (!memo.has(o.id)) { const b = crossings(o).landing.i; memo.set(o.id, waterRoute(crossings(v).landing, j => j === b, 6)); }
      const r = memo.get(o.id);
      if (!r) return null;
      const byLand = Math.hypot(o.x - p.x, o.y - p.y) * 1.4 / (WALK * ACTIONS_PER_HOUR * (equipped(p, "cart") ? 0.6 : 1));
      return r.hours < byLand * 0.9 ? r : null;
    }
    /* The way over water from landing `a` to the first land square `goal` accepts, out to 50 km,
       at `kmh`; and whether any of it is the open sea. */
    function waterRoute(a, goal, kmh) {
      const ax = a.i % cols, ay = (a.i / cols) | 0, dist0 = new Map(), q = [];
      for (let k = 0; k < 8; k++) { const nx = ax + [1, -1, 0, 0, 1, 1, -1, -1][k], ny = ay + [0, 0, 1, -1, 1, -1, 1, -1][k]; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const j = ny * cols + nx; if (ground[j] <= G_RIVER && stopAt(j) || ground[j] <= G_LAKE) { dist0.set(j, 1); q.push(j); } }
      let found = null, sea = false;
      for (let h = 0; h < q.length && !found && q.length < 400000; h++) {
        const i = q[h], x = i % cols, y = (i / cols) | 0, d = dist0.get(i);
        if (d > 200) break;
        if (ground[i] === G_SEA) sea = true;
        for (let k = 0; k < 4 && !found; k++) {
          const nx = x + [1, -1, 0, 0][k], ny = y + [0, 0, 1, -1][k]; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const j = ny * cols + nx;
          if (!stopAt(j) && goal(j)) found = { ax: a.x, ay: a.y, bx: nx + 0.5, by: ny + 0.5, hours: (d + 1) / (kmh * SQUARES_PER_KM) + 0.5, sea: sea };
          else if (stopAt(j) && !dist0.has(j)) { dist0.set(j, d + 1); q.push(j); }
        }
      }
      return found;
    }
    function near(p, v, spread) { go(p, v.x + (R() - 0.5) * spread, v.y + (R() - 0.5) * spread, "idle"); p.wait = TK(10) + Math.floor(R() * 30 * STEP_SCALE); }

    function pickField(p, v) {
      let best = -1, bs = 0.25;
      /* Their household's own fields, where families hold the land (TODO 7c): first, unless picked
         so bare that other land would give them much more (below). Going back to a bare field of
         their own every day starved twice as many in a year (six seeds, 260 against 119). */
      const mine = held.size && p.dwelling >= 0 && p.home === v.id ? homes[p.dwelling].fields : null;
      let own = -1, ownBs = 0;
      if (mine) for (const i of mine) if (stock[i] > ownBs) { ownBs = stock[i]; own = i; }
      for (let i = 0; i < 7; i++) {
        const a = R() * 6.2832, d = Math.sqrt(R()) * v.radius;
        const x = v.x + Math.cos(a) * d, y = v.y + Math.sin(a) * d;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const ti = tileAt(x, y);
        if (owner[ti] !== v.id && owner[ti] !== -1) continue;
        /* Another household's field may be worked for half of what it gives, the other half
           theirs, as harvest work was paid in sheaves (TODO 7c): worth half as much to the worker. */
        const val = held.size && held.has(ti) && held.get(ti) !== p.dwelling ? stock[ti] * 0.5 : stock[ti];
        if (val > bs) { bs = val; best = ti; }
      }
      if (own >= 0 && ownBs > 0.25 && ownBs >= bs * 0.6) return own;
      return best;
    }

    /* Buying and selling. Every coin that leaves a hand arrives in a till or a
       treasury, so the total never changes — the test adds it up every year. */
    /* A household spends as one (Ric, 2026-11-14: never "a kid having a bunch
       of money while his parents are starving"). Children may hold coins —
       from the start or an inheritance — and whoever feeds them may spend
       those coins for the household once their own are gone; a couple's
       coins are one purse, as their food is one pot. */
    function funds(p) {
      let c = p.coins;
      if (p.wards && adult(p)) for (const k of p.wards) if (k.hp > 0) c += k.coins;
      const mate = p.partner && byId.get(p.partner);
      if (mate && mate.home === p.home && mate.hp > 0) c += mate.coins;
      return c;
    }
    /* Own coins first, then the children's, then the partner's. */
    function pay(p, cost) {
      const own = Math.min(p.coins, cost); p.coins -= own; cost -= own;
      const mate = p.partner && byId.get(p.partner);
      if (cost > 1e-12 && p.wards) for (const k of p.wards) {
        if (cost <= 1e-12) break;
        if (k.hp <= 0) continue;
        const take = Math.min(k.coins, cost); k.coins -= take; cost -= take;
      }
      if (cost > 1e-12 && mate && mate.home === p.home && mate.hp > 0) { const take = Math.min(mate.coins, cost); mate.coins -= take; cost -= take; }
    }
    /* A village's tax: its own, if whoever rules it has set one, else its faction's. */
    function taxOf(v) { return v.tax != null ? v.tax : factions[v.f].tax; }
    /* What p pays on a sale there: nothing in a village of a faction theirs has a trade deal with (TODO 13). */
    /* Goodwill from a sale or a friendly word across the border, and ill will from a cross one:
       an old feud all but deaf to the first and an old friendship to the second, while they
       last (TODO 13). Thousands of words a day otherwise turned a feud into an alliance within a
       year. With no old bond either way it is what it always was. */
    function goodwill(f, oid, by) {
      const r = f.rel[oid]; if (!r) return;
      const k = by > 0 ? 1 + Math.min(0, r.bond) : 1 - Math.max(0, r.bond);
      r.op = clamp(r.op + by * k * k * k, -1, 1);
    }
    /* Nobody carries goods to a people theirs is hostile to, or who are hostile to them (TODO 13). */
    function hostile(a, b) { return a !== b && (factions[a].rel[b].op < -0.3 || factions[b].rel[a].op < -0.3); }
    function taxFor(v, p) { return v.f !== p.f && factions[v.f].rel[p.f] && factions[v.f].rel[p.f].trade ? 0 : taxOf(v); }
    function buy(p, v, what, amount) {
      const have = what === "food" ? v.food : what === "goods" ? v.goods : v[what];
      amount = Math.min(amount, have);
      if (amount <= 0.01) return 0;
      if (!shared) {
        const price = what === "food" ? v.priceFood : what === "goods" ? v.priceGoods : matPrice(v, what);
        amount = Math.min(amount, funds(p) / price);
        if (amount <= 0.01) return 0;
        const cost = amount * price, tax = cost * taxFor(v, p);
        pay(p, cost); v.till += cost - tax; factions[v.f].treasury += tax;
      }
      if (what === "food") { v.food -= amount; p.food += amount; } else if (what === "goods") { v.goods -= amount; p.goods += amount; } else v[what] -= amount;   // a load of wood, stone or ore goes on the cart
      return amount;
    }
    function sell(p, v, what, amount) {
      if (amount <= 0.01) return 0;
      if (!shared) {
        const price = (what === "food" ? v.priceFood : what === "goods" ? v.priceGoods : matPrice(v, what)) * 0.85;
        amount = Math.min(amount, v.till / price);
        if (amount <= 0.01) return 0;
        /* Tax is taken on a sale as well as a purchase: most of what moves in
           a farming village is grain going into the store. */
        const pay = amount * price, tax = pay * taxFor(v, p);
        v.till -= pay; p.coins += pay - tax; factions[v.f].treasury += tax;
      }
      if (what === "food") v.food += amount; else if (what === "goods") v.goods += amount; else v[what] += amount;
      return amount;
    }
    /* What somebody does on reaching their own village: put in, take out. */
    function shop(p, v) {
      if (v.f !== p.f && atWar(v.f, p.f)) return;
      /* Laying in for the winter: somebody with coins and no field buys
         toward a winter's store, with no more than half of what they have. */
      const want = reserve(p);
      if (!shared && want > 1.2 && p.food < want * 0.6 && funds(p) > 1)
        buy(p, v, "food", Math.min(want - p.food, funds(p) * 0.5 / Math.max(0.3, v.priceFood)));
      if (p.food < 0.6) {
        buy(p, v, "food", 1.1 - p.food);
        const f = factions[v.f];
        if (p.food < 0.2 && !shared && (v.relief != null ? v.relief : f.relief) && v.f === p.f) {
          /* Relief: the treasury buys bread for somebody who cannot. */
          const amount = Math.min(0.6, v.food), cost = amount * v.priceFood;
          if (amount > 0.05 && f.treasury >= cost) { f.treasury -= cost; v.till += cost; v.food -= amount; p.food += amount; }
        }
      }
      outfit(p, v);
      if (p.goods < 0.15 && (shared ? v.goods > v.pop * 0.05 : p.coins > v.priceGoods * 3)) buy(p, v, "goods", 1);
    }
    /* Declarations, not arrows: `livelihood` reads them from `chooseJob`, which
       `settle` calls while the world is still being built. */
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
        /* A cart only out of what is left after a winter's bread, or from a shared store with three carts' worth in it (TODO 7d). */
        if (key === "cart" && (shared ? v.goods < spec.cost * 3 : funds(p) - spec.cost * v.priceGoods < reserve(p) * v.priceFood)) continue;
        const condition = p.gear[key] || 0, needed = spec.cost * (1 - condition);
        /* TODO 9a: ore for a tool, wood for a cart. A shield where there is no forest to be had is hide
           and wicker, as on treeless land (seed 4 has none: its soldiers went without and died five times
           as often in battle). */
        let mat = MATS ? GEAR_MAT[key] : undefined;
        if (mat && key === "shield" && v.wood < needed && v.hide >= needed) mat = "hide";     // TODO 9b: hide where wood is short
        if (mat && key === "shield" && !matGround(v).wood.length && !matGround(v).grass.length && v.hide < needed) mat = undefined;
        if (mat === "wool" && !matGround(v).grass.length && v.wool < needed) mat = undefined;  // a pack of whatever there is, with no grazing near
        if (mat && v[mat] < needed) continue;
        if (p.goods < needed) buy(p, v, "goods", needed - p.goods);
        if (p.goods + 1e-10 < needed) continue;
        p.goods = Math.max(0, p.goods - needed); p.gear[key] = 1;
        if (mat) v[mat] -= needed;
      }
    }
    function wear(p, key) { if (equipped(p, key)) p.gear[key] = Math.max(0, p.gear[key] - GEAR[key].wear); }
    /* What a day in the fields brings back, and how long it takes. How much
       the land grows is how fast the work goes: a day's work carries the same
       load anywhere, but thin land takes longer to fill it and rich land frees
       the afternoon. Before 2026-11-13 it was only on how fast a field
       recovered, and the richest and the thinnest land fed a farmer
       identically (0.3% of an adult's hours); on 2026-11-13 it scaled the load
       instead, which a fed farmer working a fixed shift never felt in a day
       (2.7%). Now it is the hours, which is how farming labour actually
       differs — capped at what daylight allows, after which they bring back
       what they managed. */
    function harvestCapacity(p) { return CARRY * (equipped(p, "tool") ? 1.25 : 1) * season().ripe; }
    function harvestPace() { return 0.5 + 0.5 * S.rich; }

    function tradeCapacity(p) { return equipped(p, "pack") ? 5 : 3; }
    /* Grain goes by cart, not on a back: eight packs' worth. */
    function grainLoad(p) { return tradeCapacity(p) * (equipped(p, "cart") ? 8 : 5); }   // TODO 7d: by cart, or by handcart and packhorse
    /* How fast somebody laden with a cart goes on this square (TODO 7d). */
    function cartPace(p, i) {
      if (!equipped(p, "cart")) return 1;
      return track[i] === 2 ? 1 : track[i] === 1 || owner[i] >= 0 ? 0.85 : 0.6;
    }
    function craftOutput(p, v) {
      /* With real materials (TODO 9a) what a batch comes to is what is in the store to work: wood, and
         ore for the metal in it; without either, a little by hand. */
      if (MATS) return (0.35 + (v.wood >= 0.5 ? 0.3 : 0) + (v.iron >= 0.3 ? 0.45 : 0) + (v.wool >= 0.3 ? 0.2 : 0)) * (equipped(p, "tool") ? 1.2 : 1);
      return (0.35 + v.ore * 1.1) * (equipped(p, "tool") ? 1.2 : 1);
    }
    function strike(p, foe, base) {
      const damage = base * (equipped(p, "weapon") ? 1.25 : 1) * (equipped(foe, "shield") ? 0.75 : 1);
      foe.hp -= damage; wear(p, "weapon"); wear(foe, "shield");
      /* Enemies striking in somebody's own village: a raid there (TODO 10). */
      const hv = villages[foe.home];
      if (hv && hv.f !== p.f && Math.hypot(foe.x - hv.x, foe.y - hv.y) < hv.radius + 1) hv.raidAt = t;
      return damage;
    }

    /* ── what somebody needs ─────────────────────────────────────────────────
       How badly each thing is wanted, 0 to about 1.4. Food is allowed past 1
       because nothing competes with starving. Every term is read off the person
       or the village in front of them; nothing here is on a timer. */
    /* How much the household's water presses: a day's left is nothing, none left is everything. */
    function waterNeed(p) {
      if (p.dry > 0) return 1.6;
      const h = homes[p.dwelling]; if (!h) return 0;
      const days = h.water / (Math.max(1, h.n || 1) * USE);   // h.n: who lives there, counted once an hour (`countHouses`)
      return clamp((2.4 - days) * 0.6, 0, 1.4);   // fetching starts with about two days left
    }
    function urgency(p) {
      const v = villages[p.home];
      const days = p.food / Math.max(1e-6, dailyNeed(p));
      /* The people they feed. A parent of three wants a reserve that somebody
         on their own does not. */
      const household = Math.min(0.5, p.kids * 0.14) + (p.partner ? 0.08 : 0);
      /* Wanting more than enough (2026-11-14, Ric: "they weren't greedy"). A
         person measures what their household is worth against their
         neighbours': the greedy want to stand above the middle of the
         village, and keep working, trading and saving until they do. Without
         it a household with a full larder had nothing left to want, and a
         world of fed people slept and sat. */
      const worth = p.coins + p.food * 0.8 + p.goods * 2;
      const aim = (v.wealth || 0) * (0.8 + 1.2 * p.greed);
      const ambition = adult(p) && aim > 0 ? clamp((aim - worth) / Math.max(aim, 1), 0, 1) * p.greed : 0;
      /* A war on, anywhere (TODO 14a; Ric: "civilizations have more inginuit and push to accomplish
         things nduiring wartime"): away from the fighting people work and put by more and rest a
         little less, the loyal most. Danger at their own door is fear (in `live`), not this. */
      const push = adult(p) && atWarAnywhere(factions[p.f]) ? 0.6 + 0.4 * p.loyal : 0;
      return {
        food: clamp((1.7 - days) * 0.5, 0, 1.4) * (0.55 + S.hunger * 0.45),
        /* Squared, so an ordinary evening does not outrank a day's work but a
           second night awake outranks everything except hunger. */
        rest: p.rest * p.rest * 1.2 * (1 - 0.12 * push),
        water: THIRST ? waterNeed(p) : 0,
        safety: clamp(p.fear, 0, 1.2),
        company: clamp(p.alone / 30, 0, 1) * (0.2 + S.talk * 0.9),
        /* Wanting more than today's meal. Money and a full store take the edge
           off it but never remove it: capped, because an uncapped term meant
           anybody who had done well stopped working altogether. */
        /* A full larder only takes the edge off once it covers the winter
           ahead too — before 2026-11-14 ten days of food in the house switched
           off the wish to work in October as surely as in May. */
        provide: clamp(0.3 + household - Math.max(0, days - 2 - winterAhead()) * 0.1 +
                       clamp((winterAhead() - days) / (winterAhead() + 1), 0, 1) * 0.5 * S.winter -
                       Math.min(0.25, shared ? storeDays(v) * 0.02 : p.coins * 0.01) + putBy(v) + ambition * 0.7, 0, 1.3) * (0.5 + p.greed * 0.6) * (0.7 + 0.6 * p.hard) * (1 + 0.2 * push),   // TODO 10: and the hardworking work
        ambition: ambition,
      };
    }

    /* Getting the store ready for winter: how far what the village holds falls
       short of the cold days ahead. It is read off the village's own store, not
       the calendar — a village that has put enough by works no harder in
       October than in May. Worked out once per village per hour. */
    function putBy(v) {
      if (S.winter <= 0) return 0;
      if (v.putByAt !== t) {
        v.putByAt = t;
        const ahead = winterAhead();
        /* At war, a store against a siege besides the winter (TODO 14a): a quarter more. */
        const aim = ahead * (atWarAnywhere(factions[v.f]) ? 1.25 : 1);
        v.putBy = ahead > 0 ? clamp((aim - storeDays(v)) / aim, 0, 1) * 0.5 : 0;
      }
      return v.putBy;
    }

    /* A job is what somebody is good at and what their village expects of them,
       not a script. It is worth about a third again at the work it names, and
       anybody may still do anybody's work when their circumstances call for it. */
    const skilled = (p, job) => (p.job === job ? 1.35 : 0.6 + 0.24 * p.curious);   // TODO 10: the curious try other work
    /* At war with anybody (TODO 14a): read at every choice, so worked out once an hour per faction,
       and again whenever any war starts or ends (`warMoves`). Kept in the engine's own table, not
       on the faction: the page reading somebody's needs at an odd hour must change nothing that
       can be seen (test/keeper.test.mjs caught the cache on the faction, now and then). */
    let warMoves = 0;
    const warAt = [], warMv = [], warOn = [];
    const atWarAnywhere = f => {
      const i = f.id;
      if (warAt[i] !== t || warMv[i] !== warMoves) { warAt[i] = t; warMv[i] = warMoves; warOn[i] = false; for (const k in f.rel) if (f.rel[k].war) { warOn[i] = true; break; } }
      return warOn[i];
    };

    /* Somebody worth walking to see: whoever they are closest to who is here. */
    function someoneToSee(p) {
      const mate = byId.get(p.partner);
      if (mate && mate.home === p.home && mate.hp > 0 && mate.task !== "sleep") return mate;
      let best = null, bs = 0.2;
      for (const [id, score] of tiesOf(p)) {
        const q = byId.get(id);
        if (!q || q.hp <= 0 || q.home !== p.home || q.task === "sleep") continue;
        if (score > bs) { bs = score; best = q; }
      }
      if (best) return best;
      for (const id of [p.mum, p.dad]) {
        const q = byId.get(id);
        if (q && q.hp > 0 && q.home === p.home && q.task !== "sleep") return q;
      }
      const b = bucketAt(tileAt(p.x, p.y));
      for (const q of b) if (q !== p && q.hp > 0 && q.task !== "sleep") return q;
      return null;
    }

    /* ── what somebody does next ─────────────────────────────────────────────
       Until 2026-11-13 this was five scripts, one for each job: a farmer always
       walked to a field, harvested, walked home and sold, whatever else was
       happening. Ric: "what you change doesn't change a lot for the people day
       to day". It could not — no setting changed the shape of a day, only a
       number inside one.

       Now there is one place where a person decides, and it is a comparison.
       Everything they could do is scored against what they need, what the walk
       and the risk would cost, and what they are good at. A setting changes a
       need, a cost or a yield, and the choice moves with it.

       Nothing here schedules an event, and no option exists that the person
       could not actually carry out. */
    function choose(p) {
      const v = villages[p.home], f = factions[p.f];
      const n = urgency(p);
      const hour = t % DAY_HOURS;
      const dark = isDark(hour) ? 1 : 0;
      const away = d => d * 0.035;                 // what a journey costs, in need units
      let bestScore = -Infinity, chosen = null, chosenTask = "";
      const weigh = (task, score, start) => {
        /* A little noise, so two people with the same life do not move as one.
           Not enough to overrule a need. */
        const s = score + (R() - 0.5) * 0.07;
        if (s > bestScore) { bestScore = s; chosen = start; chosenTask = task; }
      };

      /* A child keeps near whoever feeds it, and sleeps at night. From six a child fetches
         water too, as children did; with no grown-up at home that is how a house is kept in
         water at all (TODO 6a: measured, every early death of thirst was a child alone). */
      if (!adult(p)) {
        if (THIRST && p.age >= 6 && p.dwelling >= 0) {
          const src = sourceOf(homes[p.dwelling]);
          if (src) weigh("water", n.water * 1.4 - away(dist(p, src)) * 0.6 - dark * 0.3, () => { go(p, src.x, src.y, "water"); p.wait = 0; });
        }
        weigh("sleep", n.rest + dark * 0.8, () => {
          const [ix, iy] = inHouse(p); go(p, ix, iy, "sleep"); p.wait = sleepTicks();
        });
        weigh("idle", 0.3 + n.company * 0.5, () => {
          const mum = byId.get(p.mum) || byId.get(p.dad);
          if (mum && mum.home === p.home) { go(p, mum.x + (R() - 0.5) * 2, mum.y + (R() - 0.5) * 2, "idle"); p.wait = spell("visit"); }
          else near(p, v, 4);
        });
        chosen(); p.chose = chosenTask; return;
      }

      /* Water (TODO 6a): fetch it when the house runs low; and where it is far and there is no
         well, dig one. */
      if (THIRST && p.dwelling >= 0) {
        const h = homes[p.dwelling], src = sourceOf(h);
        if (src) weigh("water", n.water * 1.4 - away(dist(p, src)) * 0.6 - dark * 0.3, () => { go(p, src.x, src.y, "water"); p.wait = 0; });
        if (!v.well && (!src || src.d > FAR)) {
          const spot = v.wellAt || (v.wellAt = { x: v.x + 0.15, y: v.y + 0.15 });
          weigh("well", 0.35 + n.water * 0.5 - away(dist(p, spot)) - n.food * 0.4 - dark * 0.6, () => { go(p, spot.x, spot.y, "well"); p.wait = 0; });
        }
      }
      /* Building a house (TODO 7b): their own, or somebody else's for pay. */
      const mine = p.waitHouse >= 0 ? p.waitHouse : (byId.get(p.partner) || { waitHouse: -1 }).waitHouse;   // theirs or their partner's
      if (mine >= 0 && !homes[mine].built && (p.job !== "soldier" || !atWarAnywhere(f))) {   // a soldier too, in peace
        /* A house of their own is worth a day as much as any work; less pressing when a builder is paid. */
        /* But food first: building waits on hunger, on the harvest, and on a larder with less than
           half of what the household wants put by, as peasants built in the slack of the year.
           Measured: without this a year starved half as many again (six seeds, 170 against 109). */
        const h = homes[mine], crowd = h.paid ? 0 : 0.2, larder = p.food < reserve(p) * 0.5 ? 0.3 : 0;
        weigh("build", 0.6 + crowd + (p.dwelling >= 0 && homes[p.dwelling].n > roomFor(homes[p.dwelling]) ? 0.35 : 0.1)
                         - away(Math.hypot(h.x - p.x, h.y - p.y)) - n.food * 1.1 - (season().ripe - 1) * 0.25 - larder - n.water * 0.5 - n.rest * 0.4 - dark * 0.6,
          () => { p.buildAt = h.id; go(p, h.x, h.y, "build"); p.wait = 0; });
      }
      if (p.job === "crafter" && !p.cargo) {
        const h = paidSite(v);
        /* A wage and a half: worth more than a batch at the bench to most. */
        if (h) weigh("build", (n.provide * 1.05 + 0.3) * 1.35 * 1.15 - away(Math.hypot(h.x - p.x, h.y - p.y)) - n.food * 0.55 - n.rest * 0.4 - n.safety * 0.5 - dark * 0.5,
          () => { p.buildAt = h.id; go(p, h.x, h.y, "build"); p.wait = 0; });
      }
      /* A bridge or a boat for the village (TODO 6d). */
      if (CROSS && v.alive && p.job !== "soldier") {
        const c = crossings(v);
        if (c.bridge && !v.bridge && cross[c.bridge.i] === 1)   // and nobody has bridged it since
          weigh("bridge", 0.4 - away(Math.hypot(c.bridge.x - p.x, c.bridge.y - p.y)) * 0.5 - n.food * 0.5 - n.water * 0.5 - n.rest * 0.4 - dark * 0.6,
            () => { go(p, c.bridge.x, c.bridge.y, "bridge"); p.wait = 0; });
        if (c.landing && !v.boat && (v.wantBoat || 0) >= 3)
          weigh("boat", 0.4 + Math.min(0.3, v.wantBoat * 0.01) - away(Math.hypot(c.landing.x - p.x, c.landing.y - p.y)) * 0.5 - n.food * 0.5 - n.water * 0.5 - n.rest * 0.4 - dark * 0.6,
            () => { go(p, c.landing.x, c.landing.y, "boatwork"); p.wait = 0; });
      }
      /* Sleep, in their own house. The one thing a night is for. */
      const far = Math.hypot(p.hx - p.x, p.hy - p.y);
      weigh("sleep", n.rest + dark * 0.6 - 0.22 - away(far) * 0.4, () => {
        const [ix, iy] = inHouse(p); go(p, ix, iy, "sleep");   // inside their own house (TODO 7a)
        p.wait = sleepTicks();
      });

      /* Eat. Only worth the walk if there is anything to be had. */
      if ((v.food > 0.05 || p.food > 0.05) && t - p.ate >= 2 && !p.cargo)
        weigh("eat", n.food * 1.15 + (p.food < 0.3 ? 0.35 : 0) - away(dist(p, v)), () => {
          const [x, y] = plaza(v, v.radius * 0.7);
          p.ate = t; go(p, x, y, "eat"); p.wait = 0;
        });

      /* A day in the fields. What the patch would actually give decides whether
         it is worth the walk — so thin, crowded or worked-out land pushes people
         into other work, other villages, or somebody else's store. */
      if (!p.cargo) {
        const w = livelihood(p, v);
        /* Laying in for the winter (TODO 10): how far the larder falls short of it, which the
           patient set about now and the impatient leave for later. Nothing at an ordinary patience. */
        const keep = reserve(p), lay = clamp((keep - p.food) / keep, 0, 1) * (p.patient - 0.5) * 0.5;
        /* A day in the fields. */
        if (w.tile >= 0)
          /* At harvest everybody helps: ripe grain left standing is lost to the
             frost, so bringing it in is worth a day whatever is in the larder. */
          weigh("field", (n.food * 0.8 + n.provide * 0.9 + 0.12 + 0.35 * (season().ripe - 1) / 3 + lay) * skilled(p, "farmer") * w.land
                          - away(Math.hypot(w.tx + 0.5 - p.x, w.ty + 0.5 - p.y)) - n.rest * 0.45 - n.safety * 0.7 - dark * 0.5,
            () => { go(p, w.tx + 0.2 + R() * 0.6, w.ty + 0.2 + R() * 0.6, "field"); p.wait = 0; });

        /* A day's fishing (TODO 6c), for a village with water near. */
        if (FISH && fishGround(v)) {
          const g = v.fishing;
          weigh("fish", (n.food * 0.8 + n.provide * 0.9 + 0.12 + lay) * skilled(p, "fisher") * fishWorth(v)
                         - away(Math.hypot(g.x - p.x, g.y - p.y)) - n.rest * 0.45 - n.safety * 0.7 - dark * 0.5,
            () => { go(p, g.x + (R() - 0.5) * 1.5, g.y + (R() - 0.5) * 1.5, "fish"); p.wait = 0; });
        }

        /* A day's cutting, quarrying or mining (TODO 9a), where the village has the ground for it. */
        if (MATS) for (const k of MAT) {
          const i = matSpot(v, k); if (i < 0) continue;
          const sx = i % cols + 0.5, sy = ((i / cols) | 0) + 0.5;
          weigh(MAT_TASK[k], (n.provide * 0.95 + 0.1) * skilled(p, MAT_JOB[k]) * matWorth(v, k, i)
                             - away(Math.hypot(sx - p.x, sy - p.y)) - n.food * 0.55 - n.rest * 0.45 - n.safety * 0.6 - dark * 0.5,
            () => { go(p, sx - 0.3 + R() * 0.6, sy - 0.3 + R() * 0.6, MAT_TASK[k]); p.wait = 0; });
        }
        /* A day with the herd or hunting (TODO 9b): food, as fishing is, with wool or a hide besides. */
        if (MATS) for (const k of ["herd", "hunt"]) {
          const j = wildSpot(v, k); if (j < 0) continue;
          const i = wildList(v, k)[j], sx = i % cols + 0.5, sy = ((i / cols) | 0) + 0.5;
          weigh(k, (n.food * 0.8 + n.provide * 0.9 + 0.12 + lay) * skilled(p, k === "herd" ? "herder" : "hunter") * wildWorth(v, k, j)
                   - away(Math.hypot(sx - p.x, sy - p.y)) - n.rest * 0.45 - n.safety * 0.7 - dark * 0.5,
            () => { go(p, sx - 0.3 + R() * 0.6, sy - 0.3 + R() * 0.6, k); p.wait = 0; });
        }

        /* Market day (TODO 8): food beyond what the household keeps for the winter, taken to the
           market of the biggest place near that is short of it, and sold there. How towns were fed:
           London about 1300 drew its grain from 60 km round by land and further by water (Campbell
           et al. 1993); a market town from the villages a day's walk round. */
        const m = v.marketTo >= 0 ? villages[v.marketTo] : null;
        if (m && m.alive && season().ripe < 1.5 && !(rumours(p) && heardSick.includes(m.id))) {
          const spare = p.food - reserve(p) - 2;
          if (spare > 2) {
            /* By handcart or packhorse, as a grain trader carries: a pack of five days a trip could
               never feed a town. */
            const load = Math.min(spare, grainLoad(p));
            /* Worth more the shorter the town's households are: sold door to door to them (in
               `trade`), not to a store price that an empty store pins at its top everywhere. */
            const want = clamp((m.short || 0) / (m.pop * 7 + 1), 0, 1);
            /* A war anywhere frightens a whole faction (p.fear), and at full weight that stopped every
               market day from the harvest to spring in a world at war (2026-11-17), with the
               fighting nowhere near: the road to one's own town, not under siege, at half. */
            const risk = m.f === p.f && !m.siege ? 0.4 : 0.8;
            weigh("market", (0.3 + n.provide * 0.6 + want * 0.5) * Math.min(1, load / 5) - away(dist(p, m)) * 0.35 - n.food * 0.5 - n.rest * 0.4 - n.safety * risk - dark * 0.5,
              () => { p.food -= load; p.cargo = { what: "food", amount: load, grain: !shared, paid: load * MARKET_PRICE / 1.4 }; p.at = m.id; go(p, m.x, m.y, "carry"); p.wait = 0; });
          }
        }

        /* Food for family where they have heard there is a famine (TODO 12b; Ric: "Famine"). Help
           went along family ties to those one heard were in need (Kagera, the Dinka: README). */
        if (p.job !== "soldier" && rumours(p) && heardFamine.length) {
          const spare = p.food - reserve(p) - 2;
          if (spare > 2) {
            let kin = null, close = 0.3;
            const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
            for (let o = o0; o < o1; o++) {
              if (mKind[o] !== M_KIN) continue;
              const x = mNow(o); if (x <= close) continue;
              const q = byId.get(mAbout[o]);
              if (q && q.hp > 0 && q.home !== p.home && heardFamine.includes(q.home) && villages[q.home].alive && !atWar(villages[q.home].f, p.f) && dist(p, villages[q.home]) < 34) { close = x; kin = q; }
            }
            if (kin) {
              const there = villages[kin.home], load = Math.min(spare * 0.6, grainLoad(p));
              weigh("help", 0.35 + close * 0.6 + n.provide * 0.2 - away(dist(p, there)) * 0.35 - n.food * 0.5 - n.rest * 0.4 - n.safety * 0.8 - dark * 0.5,
                () => { p.food -= load; p.cargo = { what: "food", amount: load, gift: kin.id }; p.at = there.id; go(p, there.x, there.y, "carry"); p.wait = 0;
                        p.say = "Food for " + kin.name + " in " + there.name + ". They're starving there."; p.sayT = TK(80); });
            }
          }
        }

        /* A day at the bench. */
        weigh("make", (n.provide * 1.05 + 0.1) * skilled(p, "crafter") * w.bench
                       - away(dist(p, v)) - n.food * 0.55 - n.rest * 0.4 - n.safety * 0.5 - dark * 0.5,
          () => { const [x, y] = plaza(v, v.radius * 0.95); go(p, x, y, "make"); p.wait = 0; });

        /* A load to carry, if anywhere reachable wants what is here. */
        /* Carting grain between villages is a trader's work; anybody may still
           carry a pack of goods to where it sells. */
        if (w.route.best && (w.route.what !== "grain" || p.job === "trader"))
          /* A load is worth carrying for the profit in it, not only because
             somebody is short: trading is a living, and a trader who has done
             well this year still trades. */
          weigh("carry", (0.2 + n.provide * 0.95) * skilled(p, "trader") * w.load * (0.7 + p.greed * 0.6)
                          - away(dist(p, w.here)) * 0.5 - n.food * 0.4 - n.rest * 0.4 - n.safety * 0.8 - dark * 0.4,
            () => { trade(p); });
        // No profitable load need not mean never leaving home. Prospecting
        // competes with real needs and work; it creates no goods or payment.
        else if (p.job === "trader") {
          const next = nextMarket(p, w.here);
          if (next && p.food >= 0.6)
            weigh("scout", 0.3 + p.greed * 0.2 + (p.curious - 0.5) * 0.3 + n.provide * 0.3 - away(dist(p, next)) * 0.4
                            - n.food * 0.6 - n.rest * 0.5 - n.safety * 0.8 - dark * 0.5,
              () => { p.at = next.id; go(p, next.x, next.y, "scout"); p.wait = 0; });
        }
      }

      /* Standing guard, and going where the fighting is. */
      if (p.job === "soldier")
        weigh("patrol", 0.4 + n.safety * 0.9 + p.loyal * 0.35 + (p.temper - 0.5) * 0.3 + (atWarAnywhere(f) ? 0.5 : 0)
                         - n.rest * 0.4 - n.food * 0.5, () => { p.until = t + SPELL.guard; soldier(p); });

      /* Moving house. Until 2026-11-14 a person changed village only by
         accident — two people from different flags happening to talk, or a
         quarterly dice roll on a full village — so "changing sides" moved 0.2%
         of anybody's hours whatever it was set to. Now it is weighed like
         anything else: how fed and how full the place is against somewhere
         they could reach, against what holds them here (a partner, children,
         the friends they remember living here, the flag). `switch` is how far
         a border counts against a place; `crowd` is what "full" means;
         `memory` is how many ties a person can hold. Somebody who has just
         moved settles in for a season before weighing it again. */
      if (!p.cargo && p.job !== "soldier" && p.id !== f.leader && t - (p.settled || -1e9) > 90 * DAY_HOURS) {
        /* What a place has to eat is in its houses as well as its store —
           with seasons, mostly in its houses. Judged on the store alone, a
           village on poor land starved to the last household in March while
           the next valley held ten months of grain a head, and nobody went. */
        const perHead = o => (o.food + (o.held || 0)) / (o.pop + 1);
        const room = o => clamp(1 - o.pop / crowdOf(o), -1, 1);
        const mate = byId.get(p.partner);
        let ties = 0.25 + (mate && mate.home === p.home && mate.hp > 0 ? 0.55 : 0) + p.kids * 0.12;
        for (const [id, s] of tiesOf(p)) if (s > 0.2) { const q = byId.get(id); if (q && q.home === p.home) ties += 0.05; }
        let best = null, bs = 0;
        const rum = rumours(p);   // TODO 12b: not to where they have heard of a sickness or a famine
        for (const o of villages) {
          if (!o.alive || o === v || atWar(o.f, p.f)) continue;
          if (rum && (heardSick.includes(o.id) || heardFamine.includes(o.id))) continue;
          const d = dist(p, o);
          if (d > 20) continue;
          const foreign = o.f !== p.f;
          if (foreign && S.switch <= 0) continue;
          const g = clamp((perHead(o) - perHead(v)) / (8 + winterAhead()), -1, 1) * 0.7 + (room(o) - room(v)) * 0.6
                    - (foreign ? (1 - S.switch) * 0.7 + p.loyal * 0.6 : 0) - away(d) * 0.4;
          if (g > bs) { bs = g; best = o; }
        }
        if (best) {
          const there = best;
          weigh("move", bs + n.food * 0.5 + (1 - p.mood) * 0.3 - ties + p.bold * 0.15 + (p.curious - 0.5) * 0.3 - dark * 0.5, () => {
            const kids = (PLAIN ? people : residents(p.home)).filter(q => (q.mum === p.id || q.dad === p.id || q.carer === p.id) && !adult(q) && q.hp > 0 && q.home === p.home);
            /* A couple goes together. */
            if (mate && mate.home === p.home && mate.hp > 0 && mate.id !== factions[mate.f].leader) kids.push(mate);
            const why = there.f !== p.f ? "left" : "moved";
            p.say = there.f !== p.f ? "I'm going over to " + factions[there.f].name + ". Better there." : "We're moving to " + there.name + ".";
            p.sayT = TK(80);
            rehome(p, there, why);
            for (const k of kids) rehome(k, there, why);
          });
        }
      }

      /* Going to a neighbour for food. When the store is empty the grain is in
         people's houses, and somebody going short goes to ask: their own
         family first, then friends, then whoever has most put by. Added
         2026-11-14 — before it, a hard winter starved a sixth of a village
         while the median neighbour sat on four months of grain, because the
         only way food crossed between houses was two people happening to
         meet, and in winter nobody is out. */
      if (n.food > 0.35 && p.food < 1 && v.food <= 0.05) {
        let giver = null, gs = 0;
        /* Whom to ask (TODO 11): somebody they know of. Whoever they have seen with food to spare,
           by how much they had; family and friends, whose larders they have not seen, as worth a
           try. Until item 11 it was whoever in the village had most put by, read off every
           neighbour's larder, which nobody could know (and at 20,000 people the dearest thing in
           a decision). Another village's only for coin, and only somebody seen to have plenty. */
        const coin = funds(p) > 0.5 && !shared, o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
        const consider = (q, sc, known) => {
          if (!q || q === p || q.hp <= 0 || !adult(q) || q.id === p.partner) return;
          if (q.home !== p.home) {
            if (!coin || !known || atWar(q.f, p.f)) return;
            const d = dist(p, villages[q.home]);
            if (d > 20) return;
            sc *= (q.f === p.f ? 1 : 0.7) / (1 + d * 0.05);
          }
          sc *= kin(p, q) ? 2 : 1;
          if (sc > gs) { gs = sc; giver = q; }
        };
        for (let o = o0; o < o1; o++) {
          const k = mKind[o];
          if (k === M_FOOD) { const q = byId.get(mAbout[o]); if (q) consider(q, mNow(o) * 30 * dailyNeed(q), true); }
          else if ((k === M_FRIEND || k === M_KIN) && mNow(o) > 0.2) consider(byId.get(mAbout[o]), dailyNeed(p) * (k === M_FRIEND ? 1.5 : 1), false);
        }
        for (const id of [p.mum, p.dad]) if (id) consider(byId.get(id), dailyNeed(p), false);
        if (giver) {
          const q = giver;
          weigh("ask", n.food * 1.3 + 0.15 - away(dist(p, q)) - dark * 0.3, () => {
            go(p, q.x + (R() - 0.5) * 0.6, q.y + (R() - 0.5) * 0.6, "ask"); p.askOf = q.id; p.wait = 0;
          });
          /* Or take it, from their house, best by night (TODO 10): somebody hungry with nothing to pay
             with, from a house with plenty put by. The honest would sooner go hungry. */
          if (p.hungry > 0 && !(t - (p.stoleAt ?? -1e9) < 3 * DAY_HOURS) && funds(p) < 1 && q.food > 10 * dailyNeed(q) && q.home === p.home && q.dwelling >= 0 && p.honest < 0.7) {
            const h = homes[q.dwelling], crook = (1 - p.honest) * (1 - p.honest) * 2;   // 0.5 at an ordinary honesty
            weigh("steal", (n.food * 1.3 + 0.15) * crook - away(Math.hypot(h.x - p.x, h.y - p.y)) + dark * 0.15, () => {
              go(p, h.x + (R() - 0.5) * 0.4, h.y + (R() - 0.5) * 0.4, "steal"); p.askOf = q.id; p.stoleAt = t; p.wait = 0;
            });
          }
        }
      }

      /* Having it out with somebody they cannot stand (TODO 10): the hot-tempered go looking for
         it, at most once a month at an ordinary patience (once a week, before grudges lasted, TODO 11:
         with grudges kept for years, weekly made a feud of every grudge, ten times the fights). */
      if (p.temper > 0.35 && !(t - (p.quarrelAt ?? -1e9) < (0.5 + p.patient) * 30 * DAY_HOURS)) {   // the patient bide their time
        let foe = null, worst = -0.35;
        for (const [id, sc] of tiesOf(p)) if (sc < worst) { const q = byId.get(id); if (q && q.hp > 0 && q.home === p.home && adult(q)) { worst = sc; foe = q; } }
        if (foe) weigh("quarrel", (-worst - 0.2) * (p.temper - 0.35) * 2.5 - away(dist(p, foe)) * 0.5 - n.food * 0.5 - n.rest * 0.4 - n.safety * 0.3 - dark * 0.4, () => {
          go(p, foe.x + (R() - 0.5) * 0.6, foe.y + (R() - 0.5) * 0.6, "quarrel"); p.askOf = foe.id; p.quarrelAt = t; p.wait = 0;
        });
      }

      /* Going to find somebody. This is what stops talking being an accident of
         two people happening to stand on the same tile. */
      weigh("visit", n.company * 1.25 - 0.08 - (p.hard - 0.5) * 0.2 - n.food * 0.4 - n.safety * 0.4 - dark * 0.5, () => {
        const who = someoneToSee(p);
        if (who) go(p, who.x + (R() - 0.5), who.y + (R() - 0.5), "visit");
        else near(p, v, 3);
        p.task = "visit"; p.wait = spell("visit");
      });

      /* Fitting or mending the tools of their trade. */
      if (Object.keys(GEAR).some(k => GEAR[k].jobs.includes(p.job) && (p.gear[k] || 0) <= 0.25) && !p.cargo)
        weigh("gear", 0.28 + n.provide * 0.3 - away(dist(p, v)) - n.food * 0.6 - dark * 0.4, () => {
          /* Tools are fitted at the middle: `outfit` wants them actually there. */
          const [x, y] = plaza(v, 1.6);
          go(p, x, y, "gear"); p.wait = 0;
        });

      /* Sitting out the day: ill, spent, or nothing better on offer. */
      weigh("rest", n.rest * 0.7 + (p.sick > 0 ? 0.45 : 0) + 0.05 + (0.5 - p.hard) * 0.2 - away(far) * 0.3, () => {
        go(p, p.hx + (R() - 0.5) * 0.6, p.hy + (R() - 0.5) * 0.6, "rest"); p.wait = spell("rest");
      });

      chosen(); p.chose = chosenTask;
    }

    /* What happens at the neighbour's door. They sell what they can spare
       beyond their own winter, at a price that climbs as their store runs
       down; coins go from one hand to the other, so the total never changes.
       What money cannot buy, kinship, friendship or a warm nature may give.
       Nothing here decides who is asked — `choose` did that. */
    function askFor(p, q) {
      wakeUp(q);
      const want = 5 * dailyNeed(p);
      const spare = Math.max(0, q.food - reserve(q));
      let got = 0;
      if (!shared && spare > 0.1 && funds(p) > 0.05) {
        const price = clamp(1.5 * reserve(q) / Math.max(q.food, 0.1), 0.4, 8);
        const amount = Math.min(want, spare, funds(p) / price);
        pay(p, amount * price); q.coins += amount * price;
        q.food -= amount; p.food += amount; got += amount;
      }
      if (got < want * 0.5) {
        /* A debt is paid back: somebody who owes the asker for food gives more readily (TODO 11). */
        const owed = mFind(q, M_DEBT, p.id), fq = feel(q, p.id);
        const tie = (kin(p, q) ? 0.6 : 0) + fq + q.warm + (viewOf(q) > 0 ? 0.3 : 0) + (owed >= 0 ? mNow(owed) * 0.8 : 0);
        if (q.food > 1 && (q.home === p.home || kin(p, q) || fq > 0.2 || owed >= 0) && tie > 0.6 + R() * 0.7) {
          const give = Math.min(want - got, q.food * 0.25);
          q.food -= give; p.food += give; got += give; befriend(p, q, 0.3);
          if (owed >= 0) mKind[owed] = 0;
          else owe(p, q, give);
        } else befriend(p, q, -0.1, SNUB);   // see SNUB
      }
      sawLarder(p, q);   // and now they know what is in it (TODO 11)
      p.say = got > 0.05 ? (got >= want * 0.5 ? "Thank you. That will see us through the week." : "It's something.") : "They had nothing for me.";
      p.sayT = TK(60);
      if (got > 0.05) { q.say = "Take it."; q.sayT = TK(60); }
    }

    /* ── carrying out what was chosen ──────────────────────────────────────
       One branch per task, and none of them chooses anything: when a task is
       finished the person goes back to `choose`. */
    function work(p) {
      const v = villages[p.home];
      /* A shift of building or digging is spent at the work, and shows as that work; what it
         did is counted when it ends (TODO 7b: before, the hours showed as resting). */
      if ((p.task === "build" || p.task === "well" || p.task === "bridge" || p.task === "boatwork") && !p.shift) {
        p.shift = true; p.wait = p.task === "build" ? Math.round(BUILD_SHIFT * ACTIONS_PER_HOUR) : TK(240); return;
      }
      p.shift = false;
      if (p.task === "eat") { p.at = v.id; shop(p, v); p.task = "idle"; p.wait = spell("meal"); return; }
      if (p.task === "gear") { outfit(p, v); shop(p, v); p.task = "idle"; p.wait = spell("market"); return; }
      if (p.task === "sleep") { p.rest = 0; p.task = "idle"; p.wait = 0; return; }
      if (p.task === "water") {                        // TODO 6a: fill up and carry it home
        const h = homes[p.dwelling];
        p.carry = BUCKETS; p.wait = 0;
        if (h) go(p, h.x, h.y, "waterhome"); else p.task = "idle";
        return;
      }
      if (p.task === "waterhome") {
        const h = homes[p.dwelling];
        if (h) h.water = Math.min(JAR, h.water + (p.carry || 0));
        p.carry = 0; p.task = "idle"; p.wait = 0; return;
      }
      if (p.task === "build") {                        // TODO 7b: five hours on a house
        const h = homes[p.buildAt];
        if (h && !h.built) buildShift(p, h);
        p.task = "idle"; p.wait = 0; return;
      }
      if (p.task === "bridge" || p.task === "boatwork") {   // TODO 6d: four hours at a time
        const bridge = p.task === "bridge";
        if (bridge ? !v.bridge : !v.boat) {
          if (bridge) { v.bridgeWork = (v.bridgeWork || 0) + 4; if (v.bridgeWork >= BRIDGE_HOURS) bridgeBuilt(v); }
          else { v.boatWork = (v.boatWork || 0) + 4; if (v.boatWork >= BOAT_HOURS) { const l = crossings(v).landing; v.boat = { x: l.x, y: l.y }; count.boatsBuilt++; note("build", v.name + " has built a boat.", 1, l.x, l.y, v.f); } }
        }
        p.task = "idle"; p.wait = 0; return;
      }
      if (p.task === "boat") {                         // rowed over, then on their way
        const o = p.over;
        if (!o) { p.task = "idle"; p.wait = 0; return; }
        if (!p.rowing) { p.rowing = true; p.wait = Math.round(o.hours * ACTIONS_PER_HOUR); return; }
        p.rowing = false; p.over = null;
        /* Boats are lost (TODO 7d): about one crossing hour in 500 at sea, one in 1,500 on a lake or
           river, a storm or a capsize; the load goes down with it, and half of those aboard. */
        if (R() < 1 - Math.pow(1 - (o.sea ? 0.002 : 0.0007), o.hours)) {
          const home = villages[p.home];
          if (home && home.boat) { home.boat = null; home.boatWork = 0; home.wantBoat = Math.max(home.wantBoat || 0, 3); count.boatsLost++;
            note("loss", home.name + "'s boat was lost on the water" + (p.cargo ? ", and its load with it." : "."), 2, o.bx, o.by, home.f); }
          p.cargo = null;
          if (R() < 0.5) { die(p, "drowned"); return; }
        }
        jump(p, o.bx, o.by);
        go(p, o.x, o.y, o.task); p.wait = 0; return;
      }
      if (p.task === "well") {                         // four hours' digging at a time
        if (!v.well) {
          v.wellWork = (v.wellWork || 0) + 4;
          if (v.wellWork >= WELL_HOURS) {
            v.well = { x: v.wellAt.x, y: v.wellAt.y };
            for (const h of homes) if (h.v === v.id) h.src = null;   // fetch from it now, where it is nearer
          }
        }
        p.task = "idle"; p.wait = 0; return;
      }
      if (p.task === "rest") { p.rest = Math.max(0, p.rest - 0.25); p.task = "idle"; p.wait = 0; return; }
      if (p.task === "ask") {
        const q = byId.get(p.askOf);
        if (q && q.hp > 0) askFor(p, q);
        p.task = "idle"; p.wait = spell("visit"); return;
      }
      if (p.task === "steal") {                        // TODO 10
        const q = byId.get(p.askOf);
        if (q && q.hp > 0) steal(p, q);
        p.task = "idle"; p.wait = 0; return;
      }
      if (p.task === "quarrel") {                      // TODO 10
        const q = byId.get(p.askOf);
        if (q && q.hp > 0 && dist(p, q) < 3) quarrel(p, q);
        if (p.hp !== -99) { p.task = "idle"; p.wait = spell("visit"); }
        return;
      }
      if (p.task === "visit") {
        /* Standing next to somebody is the whole point; `act` does the talking
           when they are close enough, and `converse` clears the need. */
        p.task = "idle"; p.wait = 0; return;
      }
      if (p.task === "fish") {                         // TODO 6c: a day at the water, then home with the catch
        if (!p.fishing) { p.fishing = true; p.wait = spell("harvest"); return; }
        p.fishing = false;
        const g = fishGround(v);
        let need = g ? fishDay() * (p.job === "fisher" ? 1 : 0.7) : 0;
        const want = need;
        if (g) for (const i of g.tiles) {
          if (need <= 0.01) break;
          const have = fishIn(i), got = Math.min(have, need);
          if (got > 0) { fishStock.set(i, [have - got, t]); need -= got; }
        }
        p.food += want - need; count.fish += want - need;
        p.wait = 0; go(p, p.hx + (R() - 0.5) * 0.8, p.hy + (R() - 0.5) * 0.8, "home");
        return;
      }
      if (p.task === "herd" || p.task === "hunt") {    // TODO 9b: a day out, then home with the food, the wool or hide to the store
        if (!p.gathering) { p.gathering = true; p.wait = spell("harvest"); return; }
        p.gathering = false;
        const herd = p.task === "herd", m = herd ? grazeStock : gameStock, cap = herd ? GRAZE_YEAR : GAME_YEAR;
        const list = wildList(v, p.task), j0 = wildSpot(v, p.task);
        let need = (herd ? herdDay() : huntDay()) * (p.job === (herd ? "herder" : "hunter") ? 1 : 0.7);
        const want = need;
        if (j0 >= 0) for (let j = j0; j < list.length && need > 0.01; j++) {
          const i = list[j]; if (herd && held.has(i)) continue;
          const have = stockIn(m, i, cap), got = Math.min(have, need);
          if (got > 0) { m.set(i, [have - got, t]); need -= got; }
          if (j - j0 > 8) break;
        }
        const food = want - need;
        p.food += food; count.meat += food;
        if (herd) { sellMat(p, v, "wool", food * 0.12); sellMat(p, v, "hide", food * 0.03); count.wool += food * 0.12; count.hide += food * 0.03; }   // and hides from the beasts killed
        else if (food > 1) { sellMat(p, v, "hide", 0.3); count.hide += 0.3; }
        p.wait = 0; go(p, p.hx + (R() - 0.5) * 0.8, p.hy + (R() - 0.5) * 0.8, "home");
        return;
      }
      if (p.task === "cut" || p.task === "quarry" || p.task === "mine") {   // TODO 9a: a day's work, then the load to the store
        if (!p.gathering) { p.gathering = true; p.wait = spell("harvest"); return; }
        p.gathering = false;
        const k = p.task === "cut" ? "wood" : p.task === "quarry" ? "stone" : "iron", i = matSpot(v, k);
        let got = 0;
        if (i >= 0) {
          got = matYield(k, i) * (p.job === MAT_JOB[k] ? 1 : 0.7) * (equipped(p, "tool") ? 1.2 : 1);
          if (k === "wood") { const have = woodIn(i); got = Math.min(got, have); woodStock.set(i, [have - got, t]); }
          sellMat(p, v, k, got); count[k] += got; wear(p, "tool");
        }
        p.wait = 0; go(p, p.hx + (R() - 0.5) * 0.8, p.hy + (R() - 0.5) * 0.8, "home");
        return;
      }
      if (p.task === "field") {
        if (!p.harvesting) {
          /* And the ground under them: a good patch is quicker to work than a
             poor one, so how uneven the land is decides who finishes early. */
          let f0 = 0, n0 = 0;
          for (const [ox, oy] of PATCH) { const x = Math.floor(p.x) + ox, y = Math.floor(p.y) + oy;
            if (x >= 0 && y >= 0 && x < cols && y < rows) { f0 += fert[y * cols + x]; n0++; } }
          const pace = harvestPace() * clamp((n0 ? f0 / n0 : 0.55) / 0.55, 0.4, 1.6);
          const hours = Math.min(FIELD_HOURS, SPELL.harvest / pace);
          p.harvesting = true; p.harvestShare = hours * pace / SPELL.harvest;
          p.wait = Math.round(hours * ACTIONS_PER_HOUR); return;
        }
        p.harvesting = false;
        /* A day's work covers the field they are standing in and the ones
           round it. */
        const fx = Math.floor(p.x), fy = Math.floor(p.y);
        const capacity = harvestCapacity(p) * (p.harvestShare ?? 1);
        p.harvestShare = 1;
        let need = capacity;
        for (let k = 0; k < 9 && need > 0.01; k++) {
          const x = fx + PATCH[k][0], y = fy + PATCH[k][1];
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const ti = y * cols + x, got = Math.min(stock[ti], need);
          stock[ti] -= got; need -= got;
        }
        p.food += capacity - need; count.reaped += capacity - need;   // TODO 14b: the harvest, in days of food
        if (p.dwelling >= 0) homes[p.dwelling].farmed++;          // the household farms (TODO 7c)
        /* Another household's field: half of it is theirs. */
        const holder = held.size ? held.get(fy * cols + fx) : undefined;
        if (holder !== undefined && holder !== p.dwelling) {
          const q = byId.get(homes[holder].head), half = (capacity - need) / 2;
          if (q && q.hp !== -99 && q !== p && half > 0) { p.food -= half; q.food += half; count.shares += half; }
        }
        /* On a leader's land a third goes to the leader's barn, the village store (TODO 7c). */
        if (landOf(v) === "leader" && p.id !== factions[v.f].leader && p.partner !== factions[v.f].leader) {
          const rent = (capacity - need) / 3; p.food -= rent; v.food += rent; count.rent += rent;
        }
        if (capacity > need) wear(p, "tool");
        /* The load goes to their own house, not to one point in the middle of
           the village: measured 2026-11-13, every farmer converging on the
           market square at the end of the day spent 13% of their life shoving
           through the crowd there, because bodies cannot overlap. The village
           store is a shared pool, so selling into it does not need them to
           stand on a particular tile; fitting tools still does, and the `gear`
           task still goes to the middle for it. */
        p.wait = 0; go(p, p.hx + (R() - 0.5) * 0.8, p.hy + (R() - 0.5) * 0.8, "home");
        return;
      }
      if (p.task === "home") {
        const keep = reserve(p);
        if (p.food > keep) { const sold = sell(p, v, "food", p.food - keep); p.food -= sold; }
        shop(p, v);
        p.task = "idle"; p.wait = spell("market");
        return;
      }
      if (p.task === "make") {
        if (!p.making) { p.making = true; p.wait = spell("craft"); return; }
        p.making = false;
        const made = craftOutput(p, v);
        wear(p, "tool");
        if (MATS) {
          /* The wood and ore it took, bought from the store (TODO 9a). */
          const w = v.wood >= 0.5 ? Math.min(v.wood, made * 0.4) : 0, o = v.iron >= 0.3 ? Math.min(v.iron, made * 0.25) : 0, l = v.wool >= 0.3 ? Math.min(v.wool, made * 0.2) : 0;
          v.wood -= w; v.iron -= o; v.wool -= l;
          if (!shared) { const c = Math.min(funds(p), w * v.priceWood + o * v.priceIron + l * v.priceWool); pay(p, c); v.till += c; }
        }
        p.goods += made;
        if (p.goods > 1) { const sold = sell(p, v, "goods", p.goods - 1); p.goods -= sold; }
        shop(p, v);
        p.task = "idle"; p.wait = spell("market");
        return;
      }
      if (p.task === "scout") {
        const here = villages[p.at];
        if (here.alive && !atWar(here.f, p.f)) { shop(p, here); rememberMarket(p, here); }
        p.task = "idle"; p.wait = spell("market"); return;
      }
      if (p.task === "pickup") { p.task = "idle"; trade(p); return; }
      if (p.task === "carry") { trade(p); return; }
      /* A watch lasts a watch. Marching and fighting carry on while the enemy
         is there; a quiet circuit ends and the soldier decides again — which is
         how a soldier gets to eat and sleep like everybody else. */
      if (p.task === "march" || p.task === "fight") { soldier(p); return; }
      if (p.task === "patrol") {
        if (t < p.until) { soldier(p); return; }
        p.task = "idle"; p.wait = 0;
      }
      /* A load in somebody's hands is not theirs to keep: whatever else has
         happened to them, it gets delivered before they decide anything. */
      if (p.cargo) {
        const to = villages[p.at] && villages[p.at].alive ? villages[p.at] : v;
        go(p, to.x + (R() - 0.5), to.y + (R() - 0.5), "carry"); p.wait = 0; return;
      }
      choose(p);
    }

    function rememberMarket(p, v) {
      if (!p.markets) p.markets = {};
      p.markets[v.id] = sceneTick;
    }
    function nextMarket(p, here) {
      const rum = rumours(p);   // TODO 12b: not to a village they have heard has a sickness
      return villages.filter(o => o.alive && o !== here && !atWar(o.f, p.f) && !hostile(o.f, p.f) &&
        (!shared || o.f === p.f) && dist(here, o) <= 34 && !(rum && heardSick.includes(o.id)))
        .sort((a, b) => (p.markets?.[a.id] || 0) - (p.markets?.[b.id] || 0) || dist(here, a) - dist(here, b))[0];
    }

    /* Where a load would be worth carrying from here, and what it is worth.
       `choose` reads the same figure to decide whether carrying is worth a day,
       so the route a trader takes and the reason they took it are one number. */
    function bestRoute(p, here) {
      let best = null, gain = shared ? 0.25 : 0.3, what = "food";
      /* What they have heard (TODO 12b; Ric: "Keep it, news adds a pull"): they still see every price
         within reach, but go nowhere they have heard has a sickness, and food goes half as willingly
         again to where they have heard it is dear, starving, or had a dry year. */
      const rum = rumours(p);
      for (const o of villages) {
        if (!o.alive || o === here) continue;
        if (o.f !== p.f && (atWar(o.f, p.f) || shared || hostile(o.f, p.f))) continue;
        if (rum && heardSick.includes(o.id)) continue;
        const pull = rum && (heardDear.includes(o.id) || heardFamine.includes(o.id) || heardDry.includes(o.f)) ? 1.5 : 1;
        const d = Math.hypot(o.x - here.x, o.y - here.y);
        if (d > 34) continue;
        if (shared) {
          const g = (here.food / (here.pop + 1) - o.food / (o.pop + 1)) * pull;
          if (g > gain) { gain = g; best = o; what = "food"; }
        } else {
          for (const w of ["food", "goods"]) {
            const g = ((w === "food" ? o.priceFood : o.priceGoods) * 0.85 - (w === "food" ? here.priceFood : here.priceGoods)) / (1 + d * 0.02) * (w === "food" ? pull : 1);
            if (g > gain && (w === "food" ? here.food : here.goods) > 1) { gain = g; best = o; what = w; }
          }
          /* Wood, stone and ore from where they are cheap (TODO 9a): an ore village sells to a forest one. */
          if (MATS) for (const w of TRADED) {
            const g = (matPrice(o, w) * 0.85 - matPrice(here, w)) / (1 + d * 0.02);
            if (g > gain && here[w] > 1) { gain = g; best = o; what = w; }
          }
          /* Grain from houses with more than their winter to houses going
             short — the trade that keeps a village on poor land alive. */
          /* Not while the grain is still standing: carting comes after the
             reaping, not instead of it. */
          if ((here.spare || 0) > 5 && (o.short || 0) > 5 && p.coins > 2 && season().ripe < 1.5) {
            /* Only as much as the households going short there can pay for:
               a cart of grain nobody can buy is grain taken from neighbours at
               home who could have. Measured 2026-11-14 without this, a hard
               winter starved more with grain trade than without it. */
            const load = grainLoad(p), moved = Math.min(here.spare, o.short, load, (o.purse || 0) / 2);
            const g = moved / load * (0.5 + Math.min(1, o.short / (o.pop * 3 + 1)) * 0.7) / (1 + d * 0.02) * pull;
            if (g > gain) { gain = g; best = o; what = "grain"; }
          }
        }
      }
      return { best: best, gain: gain, what: what };
    }

    /* A trader buys where a thing is cheap and walks it to where it is dear.
       With no money they carry food from the fullest store to the emptiest. */
    function trade(p) {
      const here = villages[p.at];
      if ((!here.alive || atWar(here.f, p.f)) && here.id !== p.home) {
        const home = villages[p.home]; p.at = home.id; go(p, home.x, home.y, "carry"); return;
      }
      // A different task may have taken them away since their last market
      // visit. Reaching the source comes before any purchase or delivery.
      if (dist(p, here) > 2.5) { go(p, here.x, here.y, p.cargo ? "carry" : "pickup"); p.wait = 0; return; }
      rememberMarket(p, here);
      if (p.task === "carry") {
        if (p.cargo && p.cargo.gift !== undefined) {
          /* Food for family (TODO 12b): to them if they are still here, or to the store. */
          const q = byId.get(p.cargo.gift);
          if (q && q.hp > 0 && q.home === here.id) q.food += p.cargo.amount; else here.food += p.cargo.amount;
          if (here.id !== p.home) { here.inFood = (here.inFood || 0) + p.cargo.amount; count.helped += p.cargo.amount; }
          p.cargo = null;
        } else if (p.cargo && p.cargo.grain) {
          /* Door to door, the most short first, at what it cost plus the
             carrying; whoever cannot pay does not get it — a trader is not
             charity. What nobody buys goes to the store, and what the store
             cannot pay for the trader keeps. */
          const ask = clamp(p.cargo.paid / Math.max(p.cargo.amount, 0.01) * 1.4, 0.5, 9);
          const buyers = (PLAIN ? people : residents(here.id)).filter(q => q.home === here.id && adult(q) && q.hp > 0 && q !== p)
            .map(q => [q, 14 * (baseNeed(q) + (q.feeds || 0)) - q.food]).filter(x => x[1] > 0.2).sort((a, b) => b[1] - a[1]);
          let sold = 0;
          for (const [q, short] of buyers) {
            if (p.cargo.amount - sold <= 0.01) break;
            const amount = Math.min(p.cargo.amount - sold, short, funds(q) / ask);
            if (amount <= 0.01) continue;
            pay(q, amount * ask); p.coins += amount * ask; q.food += amount; sold += amount;
          }
          const rest = p.cargo.amount - sold, intoStore = rest > 0.01 ? sell(p, here, "food", rest) : 0;
          p.food += rest - intoStore;
          if (here.id !== p.home) here.inFood = (here.inFood || 0) + sold + intoStore;   // grain brought in (TODO 8)
          if (sold + intoStore > 0.5) {
            if (p.job === "trader") { count.grain = (count.grain || 0) + sold + intoStore; p.say = "Grain from away — " + Math.round(sold + intoStore) + " days of it."; }
            else { count.market = (count.market || 0) + sold + intoStore; p.say = "Sold " + Math.round(sold + intoStore) + " days of food at market."; }
            p.sayT = TK(60);
          }
          if (here.f !== p.f && sold > 0) { goodwill(factions[here.f], p.f, 0.012); goodwill(factions[p.f], here.f, 0.012); }
          p.cargo = null; wear(p, "pack");
        } else if (p.cargo) {
          const got = sell(p, here, p.cargo.what, p.cargo.amount);
          if (p.cargo.what === "food" && here.id !== p.home) here.inFood = (here.inFood || 0) + got;   // food brought in (TODO 8)
          if (p.cargo.what === "food") p.food += p.cargo.amount - got; else if (p.cargo.what === "goods") p.goods += p.cargo.amount - got; else here[p.cargo.what] += p.cargo.amount - got;   // unsold wood, stone or ore is left in the store
          if (here.f !== p.f && got > 0) { goodwill(factions[here.f], p.f, 0.012); goodwill(factions[p.f], here.f, 0.012); }
          p.cargo = null; wear(p, "pack");
        }
        shop(p, here);
        p.task = "idle"; p.wait = TK(8);
        return;
      }
      shop(p, here);
      const { best, what } = bestRoute(p, here);
      if (!best) {
        /* Nothing worth carrying from here: go home, or try the next village. */
        const home = villages[p.home];
        if (here !== home) { p.at = home.id; go(p, home.x, home.y, "carry"); }
        else { shop(p, here); near(p, here, 2); p.wait = TK(40); }
        return;
      }
      if (what === "grain") {
        /* Buying door to door from the houses with most to spare, at the
           price each would ask (the same rule as a neighbour's), never into
           a seller's own winter. */
        const sellers = (PLAIN ? people : residents(here.id)).filter(q => q.home === here.id && adult(q) && q.hp > 0 && q !== p && q.food > reserve(q) + 0.5)
          .sort((a, b) => (b.food - reserve(b)) - (a.food - reserve(a)));
        const cap = Math.min(grainLoad(p), (best.purse || 0) / 2);
        let load = 0, paid = 0;
        for (const q of sellers) {
          if (load >= cap - 0.01 || p.coins < 0.1) break;
          const price = clamp(1.5 * reserve(q) / Math.max(q.food, 0.1), 0.4, 8);
          const amount = Math.min(cap - load, q.food - reserve(q), p.coins / price);
          if (amount <= 0.01) continue;
          p.coins -= amount * price; q.coins += amount * price; q.food -= amount;
          load += amount; paid += amount * price;
        }
        if (load <= 0.5) { near(p, here, 2); p.wait = TK(40); return; }
        p.cargo = { what: "food", amount: load, grain: true, paid: paid };
        p.say = "A cart of grain for " + best.name + "."; p.sayT = TK(60);
        p.at = best.id; go(p, best.x + (R() - 0.5), best.y + (R() - 0.5), "carry");
        return;
      }
      const before = what === "food" ? p.food : p.goods;
      const got = buy(p, here, what, tradeCapacity(p));
      if (what === "food") p.food = before; else p.goods = before;
      if (got <= 0.01) { near(p, here, 2); p.wait = TK(40); return; }
      p.cargo = { what: what, amount: got };
      p.at = best.id; go(p, best.x + (R() - 0.5), best.y + (R() - 0.5), "carry");
    }

    /* ── soldiers ──────────────────────────────────────────────────────── */
    function foeNear(p, reach) {
      let best = null, bd = reach;
      const cx = Math.floor(p.x), cy = Math.floor(p.y), k = Math.ceil(reach);
      for (let y = Math.max(0, cy - k); y <= Math.min(rows - 1, cy + k); y++)
        for (let x = Math.max(0, cx - k); x <= Math.min(cols - 1, cx + k); x++) {
          const b = bucketAt(y * cols + x);
          for (let i = 0; i < b.length; i++) {
            const q = b[i];
            /* The wounded leaving the field are let go (2026-11-14): chased and
               cut down as they walked home, they were most of a war's dead. */
            if (q.job !== "soldier" || q.hp < 0.45 || !atWar(p.f, q.f)) continue;
            const d = dist(p, q);
            if (d < bd) { bd = d; best = q; }
          }
        }
      return best;
    }
    /* The nearest village of a person's own faction — where a soldier in the
       field can draw rations. */
    function nearestOwn(p) {
      let best = null, bd = Infinity;
      for (const v of villages) if (v.alive && v.f === p.f) { const d = dist(p, v); if (d < bd) { bd = d; best = v; } }
      return best;
    }
    /* Rations for a campaign, paid for by the faction: from the village store
       first, then from houses with more than their own winter, at each
       house's price — the same rule as anybody buying grain. The treasury
       pays; no coin is made or lost, and no house is stripped below its
       winter. A faction with no money or a village with no food sends its
       soldiers out short, or not at all. */
    function provision(p, v) {
      const want = CAMPAIGN_DAYS * dailyNeed(p) - p.food;
      if (want <= 0.2) return;
      const f = factions[p.f];
      let got = 0;
      if (shared) {
        const take = Math.min(want, v.food * 0.5); v.food -= take; p.food += take; return;
      }
      const fromStore = Math.min(want, v.food, f.treasury / Math.max(0.3, v.priceFood));
      if (fromStore > 0.01) { const cost = fromStore * v.priceFood; f.treasury -= cost; v.till += cost; v.food -= fromStore; p.food += fromStore; got += fromStore; }
      if (got < want - 0.2 && f.treasury > 0.5) {
        for (const q of PLAIN ? people : residents(v.id)) {
          if (got >= want - 0.2 || f.treasury < 0.3) break;
          if (q.home !== v.id || !adult(q) || q.hp <= 0 || q === p || q.food <= reserve(q) + 0.5) continue;
          const price = clamp(1.5 * reserve(q) / Math.max(q.food, 0.1), 0.4, 8);
          const amount = Math.min(want - got, q.food - reserve(q), f.treasury / price);
          if (amount <= 0.01) continue;
          f.treasury -= amount * price; q.coins += amount * price; q.food -= amount; p.food += amount; got += amount;
        }
      }
      count.rations = (count.rations || 0) + got;
    }
    function soldier(p) {
      const f = factions[p.f], home = villages[p.home];
      const atHome = dist(p, home) < 2.5;
      /* The wounded go home to heal; a fight is for the whole. */
      if (p.hp < 0.45 && !atHome) { go(p, home.x + (R() - 0.5), home.y + (R() - 0.5), "patrol"); p.wait = 0; return; }
      if (p.hp < 0.45) { go(p, p.hx + (R() - 0.5) * 0.5, p.hy + (R() - 0.5) * 0.5, "rest"); p.wait = spell("rest"); return; }
      /* In the field on what they carry: under a day's rations, back to the
         nearest village of their own to draw more. */
      if (!atHome && p.food < dailyNeed(p) && (p.task === "march" || p.task === "fight")) {
        const depot = nearestOwn(p) || home;
        go(p, depot.x + (R() - 0.5), depot.y + (R() - 0.5), "patrol"); p.wait = 0; p.supplyRun = true; return;
      }
      const foe = foeNear(p, 3);
      if (foe) {
        if (dist(p, foe) < 0.8) {
          p.hit = TK(6);
          /* A fight is skirmishing, not a slaughter: about a one-in-four chance
             of landing a blow in an hour of close contact at "How deadly" 1,
             and a blow wounds more often than it kills, so a soldier is
             usually hit twice, falls under the line where the wounded go home
             (above), and leaves the field before a third blow can kill them.
             Until 2026-11-14 a blow landed within the first hour almost
             certainly and took up to four-fifths of a life: measured, armies
             fed a soldier a day into the line all war, and a world lost a
             quarter of its people to battle in eleven days. */
          if (R() < 1 - Math.pow(1 - Math.min(0.95, 0.25 * S.deadly), 1 / ACTIONS_PER_HOUR)) {
            strike(p, foe, 0.15 + R() * 0.3);
            if (foe.hp <= 0) die(foe, "battle", p);
          }
          p.task = "idle"; p.wait = 0;
        } else go(p, foe.x, foe.y, "fight");
        return;
      }
      let enemy = -1;
      for (const o of factions) if (o.alive && atWar(f.id, o.id)) { enemy = o.id; break; }
      if (enemy >= 0 && p.id % 3 !== 0 && !(home.heldTo > t)) {   // a garrison stays (TODO 14c)
        const goal = villages[f.target[enemy]];
        if (goal && goal.alive && goal.f === enemy) {
          /* Before marching: rations drawn at a village of their own, and a
             weapon that works. Nobody marches on an empty pack or a broken
             blade; somebody who cannot be fed or armed stays to guard. */
          const depot = villages[p.at] && villages[p.at].alive && villages[p.at].f === p.f && dist(p, villages[p.at]) < 2.5 ? villages[p.at] : (atHome ? home : null);
          if (depot) { provision(p, depot); outfit(p, depot); }
          const need = dailyNeed(p);
          if (p.food >= need * 3 && (equipped(p, "weapon") || !S.war)) {
            p.supplyRun = false;
            go(p, goal.x + (R() - 0.5) * 2, goal.y + (R() - 0.5) * 2, "march"); p.wait = 0; return;
          }
          if (!depot) { go(p, home.x + (R() - 0.5), home.y + (R() - 0.5), "patrol"); p.wait = 0; return; }
        }
      }
      if (p.food < 0.5 && dist(p, home) > 1.5) { go(p, home.x + (R() - 0.5), home.y + (R() - 0.5), "patrol"); p.wait = 0; return; }
      if (dist(p, home) < 1.5) shop(p, home);
      const a = R() * 6.2832, d = home.radius * (0.4 + R() * 0.6);
      go(p, home.x + Math.cos(a) * d, home.y + Math.sin(a) * d, "patrol"); p.wait = TK(6);
    }

    /* ── dying, and what is left behind ────────────────────────────────── */
    function die(p, why, by) {
      if (p.hp === -99) return;
      wakeUp(p);
      p.hp = -99; needStamp++;
      if (p.on) { madeRoom(p.x, p.y); p.on = 2; }   // the dead are in nobody's way: see `move`. 2: counted
      count[why]++;
      const v = villages[p.home], f = factions[p.f];
      if (p.cargo) { if (p.cargo.what === "food") v.food += p.cargo.amount; else if (p.cargo.what === "goods") v.goods += p.cargo.amount; else v[p.cargo.what] += p.cargo.amount; }
      v.food += p.food; v.goods += p.goods;
      p.food = 0; p.goods = 0; p.cargo = null;
      // Remaining usable material returns to the village; worn material is gone.
      for (const [key, condition] of Object.entries(p.gear)) v.goods += GEAR[key].cost * condition;
      p.gear = {};
      /* Coins. */
      if (p.coins > 0) {
        let heirs = [];
        if (S.inherit === "kids") {
          heirs = people.filter(q => q.hp !== -99 && (q.mum === p.id || q.dad === p.id));
          if (!heirs.length && p.partner && byId.get(p.partner)) heirs = [byId.get(p.partner)];
        } else if (S.inherit === "village") heirs = (PLAIN ? people : residents(p.home)).filter(q => q.hp !== -99 && q.home === p.home && q !== p);
        if (heirs.length) for (const h of heirs) h.coins += p.coins / heirs.length;
        else f.treasury += p.coins;
        p.coins = 0;
      }
      const mate = byId.get(p.partner);
      if (mate) { wakeUp(mate); mate.partner = 0; mate.mood -= 0.2; mate.say = "I miss " + p.name + "."; mate.sayT = TK(80); }
      /* The family is changed by it, and by a killing more (TODO 10). Grief at a death in old
         age is grief too, but a lesser one, and left out. */
      if (why !== "old") {
        const kin = (PLAIN ? people : residents(p.home)).filter(q => q.hp > 0 && (q.mum === p.id || q.dad === p.id));
        for (const id of [p.partner, p.mum, p.dad]) { const q = id && byId.get(id); if (q && q.hp > 0) kin.push(q); }
        if (mate && mate.hp > 0 && !kin.includes(mate)) kin.push(mate);
        for (const q of kin) {
          shaken(q, LIFE.grief);
          if ((why === "fight" || why === "battle") && by) { shaken(q, LIFE.killed); if (why === "fight" && by.hp > 0) befriend(q, by, -0.5); }
        }
      }
      if (why === "battle" && by) {
        const rel = f.rel[by.f];
        if (rel) { rel.dead++; rel.grief = clamp(rel.grief + 0.02, 0, 3); rel.bond = clamp(rel.bond - 0.01, -1, 1); }
        /* Friends of the dead do not forgive the faction that did it. */
        for (const [id, fl] of tiesOf(p)) {
          const q = byId.get(id);
          if (q && fl > 0.2 && q.f !== by.f) { q.loyal = clamp(q.loyal + 0.05, 0, 1); q.mood -= 0.08; }
        }
      }
      if (f.leader === p.id) succeed(f, why);
    }

    /* Who people follow (TODO 13): in small societies, the bold and the well-supported, and those
       known for being generous, trustworthy and good at their work: dominance and prestige both
       (von Rueden et al. 2008, 2014, the Tsimane). */
    function standing(q) { return q.bold + circle(q) * 0.1 + (q.warm + q.honest + q.hard) * 0.25; }
    function succeed(f, why) {
      const old = byId.get(f.leader);
      const pool = people.filter(q => q.hp !== -99 && q.f === f.id && adult(q));
      if (!pool.length) { f.leader = 0; return; }
      let next = null;
      if (f.rule === "chief" && old) next = pool.filter(q => q.mum === old.id || q.dad === old.id).sort((a, b) => b.age - a.age)[0];
      if (!next && f.rule === "rich") next = pool.slice().sort((a, b) => b.coins - a.coins || circle(b) - circle(a))[0];
      if (!next && f.rule === "elected" && why !== "first") { vote(f, why === "old" || why === "sick" || why === "starved" || why === "battle"); return; }
      if (!next) next = pool.slice().sort((a, b) => standing(b) - standing(a))[0];
      f.leader = next.id; f.views = viewOf(next);
      if (why !== "first") note("leader", next.name + " now leads " + f.name + (old ? ", after " + old.name + (why === "old" ? " died of old age" : why === "battle" ? " was killed" : why === "sick" ? " died of the sickness" : why === "starved" ? " starved" : "") : "") + ".", 3, villages[next.home].x, villages[next.home].y, f.id);
    }

    /* A vote. Everybody grown picks whoever thinks most like them, with a
       thumb on the scale for a friend and for a leader they are content with. */
    function vote(f, vacant) {
      const pool = people.filter(q => q.hp !== -99 && q.f === f.id && adult(q));
      f.voteAt = t + S.term * YEAR;
      if (pool.length < 3) { if (pool.length) { f.leader = pool[0].id; f.views = viewOf(pool[0]); } return; }
      const sitting = vacant ? null : byId.get(f.leader);
      const stand = pool.slice().sort((a, b) => (circle(b) + standing(b) * 3) - (circle(a) + standing(a) * 3)).slice(0, 3);
      /* In a war or under threat they want somebody bold; otherwise somebody they can trust. */
      let danger = false;
      for (const k in f.rel) if (f.rel[k].war || t - (factions[k].rel[f.id] || {}).askedAt < 180 * DAY_HOURS) danger = true;
      if (sitting && stand.indexOf(sitting) < 0) stand.push(sitting);
      const tally = stand.map(() => 0);
      for (const q of pool) {
        let best = 0, bs = -1e9;
        for (let i = 0; i < stand.length; i++) {
          const c = stand[i];
          let s = -Math.abs(viewOf(q) - viewOf(c)) + feel(q, c.id) * 0.6 + (R() - 0.5) * 0.2 + (c.bold - 0.5) * (danger ? 0.5 : 0.1) + (c.honest - 0.5) * 0.2;
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
      f.leader = w.id; f.views = viewOf(w);
      /* A new leader is a fresh start for the people who chose them. */
      if (w !== sitting) for (const q of pool) q.loyal = clamp(q.loyal + 0.12 - Math.abs(viewOf(q) - viewOf(w)) * 0.1, 0, 1);
    }

    /* ── talking ───────────────────────────────────────────────────────── */
    /* Feeling for somebody, held in the mind (TODO 11): family as family, everybody else as a
       friend or, below nothing, a grudge. A full mind forgets its weakest thing to make room.
       At most CLOSE people are close (above CLOSE_AT), family and partner among them (Ric,
       2026-11-18: "do 5"; the closest layer is about five, Dunbar 1993, Zhou et al. 2005): one
       more, and whoever of them is least close drops back to an ordinary friend, as time spent
       on the new one is time not spent on them. */
    function befriend(a, b, by, floor) { feelFor(a, b, by, floor); feelFor(b, a, by, floor); }
    /* One side of it: how p comes to feel about q (gossip moves only the hearer, TODO 12). */
    function feelFor(p, q, by, floor) {
      {
        const kind = kin(p, q) ? M_KIN : M_FRIEND, o = mFind(p, kind, q.id), was = o >= 0 ? mNow(o) : 0;
        let now = clamp(was + by, -1, 1);
        if (floor !== undefined && by < 0) { if (was <= floor) return; now = Math.max(now, floor); }
        if (now > CLOSE_AT && was <= CLOSE_AT && p.mb >= 0) {
          const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
          let n = 0, least = -1, lv = Infinity;
          for (let i = o0; i < o1; i++) {
            const k = mKind[i];
            if ((k !== M_FRIEND && k !== M_KIN) || i === o) continue;
            const v = mNow(i);
            if (v > CLOSE_AT) { n++; if (v < lv) { lv = v; least = i; } }
          }
          if (n >= CLOSE) {
            if (lv < now) { mStr[least] = CLOSE_AT * 0.8; mAt[least] = t; }
            else now = CLOSE_AT;
          }
        }
        hold(p, kind, q.id, now);
      }
    }
    /* Food given is owed (TODO 11): as many days of the receiver's need as were given, up to five. */
    function owe(p, q, amount) {
      const o = mFind(p, M_DEBT, q.id);
      hold(p, M_DEBT, q.id, Math.min(1, (o >= 0 ? mNow(o) : 0) + amount / (5 * Math.max(1e-6, dailyNeed(p)))));
    }
    const leans = p => (viewOf(p) > 0.25 ? "share" : viewOf(p) < -0.25 ? "keep" : "middle");
    function said(a, b, kind, la, lb) {
      a.say = la; a.sayT = TK(30); b.say = lb || ""; b.sayT = TK(30);
      a.talkingTo = b.id; b.talkingTo = a.id;
      if (S.records === "light") return;
      chatter.push({ id: nextExchange++, day: activityTicks / ACTIONS_PER_HOUR / DAY_HOURS, t: t, kind: kind, a: a.id, b: b.id, an: a.name, bn: b.name, fa: a.f, fb: b.f, la: la, lb: lb || "", x: a.x, y: a.y });
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
        food: p.food, coins: p.coins, goods: p.goods, views: viewOf(p), loyal: p.loyal,
        trust: feel(p, other.id), partner: byId.get(p.partner)?.name || "None",
        news: newsOf(p), sick: p.sick > 0, hungry: p.hungry > 0 };
    }
    function converse(a, b) {
      wakeUp(a); wakeUp(b);
      /* Both of them have now had company. This is the only thing that clears
         it, so somebody nobody speaks to keeps going out to look for company. */
      a.alone = 0; b.alone = 0;
      if (S.records === "light") { exchange(a, b); return; }
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
            detail: field === "news" ? newsText(byId.get(old.id)) || "News passed on." : "" });
        }
      }
      for (const d of diplomacy) if (d.value !== d.faction.rel[d.other].op) {
        c.effects.push({ name: d.faction.name, field: "diplomacy", detail: factions[d.other].name,
          before: d.value, after: d.faction.rel[d.other].op });
      }
    }
    function exchange(a, b) {
      count.talks++;
      a.talk = TK(25) + Math.floor(R() * 50 * STEP_SCALE * (1.2 - S.talk)); b.talk = TK(25) + Math.floor(R() * 50 * STEP_SCALE * (1.2 - S.talk));
      const same = a.f === b.f, war = atWar(a.f, b.f);
      const fa = factions[a.f], fb = factions[b.f];
      const fr = feel(a, b.id);
      /* What each sees of the other's larder (TODO 11): who to ask when short. */
      sawLarder(a, b); sawLarder(b, a);
      const like = 1 - Math.abs(viewOf(a) - viewOf(b));          // 1 agree … −1 opposite
      /* How open each of them is: their own nature, not the world's. */
      const open = 1 - ((a.stub ?? S.stubborn) + (b.stub ?? S.stubborn)) / 2, openA = 1 - (a.stub ?? S.stubborn), openB = 1 - (b.stub ?? S.stubborn);
      /* Sickness goes where talk goes. */
      if (a.sick > 0 && !b.immune && b.sick === 0 && R() < CATCH) { b.sick = ILLNESS_HOURS; count.infected++; }
      if (b.sick > 0 && !a.immune && a.sick === 0 && R() < CATCH) { a.sick = ILLNESS_HOURS; count.infected++; }

      /* 0 — somebody holding a grudge has nothing to say to the other (TODO 11): a cold word, and
         nothing warms between them. Until item 11 every chat warmed any two people, and a
         grudge in a village of sixty was gone in a year of passing the time of day. */
      if (fr < -0.35 || feel(b, a.id) < -0.35) {
        said(a, b, "cold", pick(["Hm.", "You.", "Not you again."]), pick(["", "Hm.", "Keep walking."]));
        return;
      }
      /* 1 — somebody is hungry and the other has food. */
      const hungry = a.hungry > 0 ? a : b.hungry > 0 ? b : null;
      if (hungry) {
        const other = hungry === a ? b : a;
        if (other.food > 0.9 && !war) {
          if (other.warm + feel(other, hungry.id) + (viewOf(other) > 0 ? 0.3 : 0) > 0.6 + R() * 0.7) {
            other.food -= 0.4; hungry.food += 0.4; befriend(hungry, other, 0.3); owe(hungry, other, 0.4);
            said(hungry, other, "help", "Can you spare some grain?", "Take this. Eat.");
          } else {
            befriend(hungry, other, -0.15, SNUB);   // see SNUB
            /* Somebody who will not give may still say where there is food (TODO 12). */
            const o = tipFor(other, hungry), q = o >= 0 ? byId.get(mAbout[o]) : null;
            if (q && q !== hungry) {
              heard(hungry, M_FOOD, q.id, mNow(o) * 0.8, other.id, 0); count.tips++;
              said(hungry, other, "refuse", "Can you spare some grain?", "I've none to spare. Try " + q.name + ", they had plenty.");
            } else said(hungry, other, "refuse", "Can you spare some grain?", "I've none to spare.");
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
          mover.hx = stay.hx; mover.hy = stay.hy; mover.dwelling = stay.dwelling;
        } else { said(a, b, "pair", "Stay with me.", "I will."); b.hx = a.hx; b.hy = a.hy; b.dwelling = a.dwelling; }
        return;
      }
      /* 3 — news travels. Whoever has heard the newer thing passes it on. */
      /* TODO 12: what was said is what is held: the teller's own telling, changed now and then
         in the passing, and believed as far as the hearer trusts the teller. */
      const sa = newsSlot(a), sb = newsSlot(b), na = sa >= 0 ? mAbout[sa] : -1, nb = sb >= 0 ? mAbout[sb] : -1;
      if (na !== nb && R() < 0.5) {
        const teller = na > nb ? a : b, hearer = teller === a ? b : a, id = Math.max(na, nb);
        if (mFind(hearer, M_NEWS, id) < 0) {
          const r = tellNews(teller, hearer, teller === a ? sa : sb);
          if (r) {
            said(teller, hearer, "news", "Did you hear? " + r.said, r.believed ? pick(["No. When?", "I had not heard.", "So it's true.", "That will mean trouble."]) : pick(["I don't believe it.", "Who told you that?", "That's just talk."]));
            befriend(a, b, 0.05);
            return;
          }
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
        const speaker = Math.abs(viewOf(a)) >= Math.abs(viewOf(b)) ? a : b, other = speaker === a ? b : a;
        const line = leans(speaker) === "share" ? "Nobody should go hungry while the stores are full."
                   : leans(speaker) === "keep" ? "What a person grows is theirs."
                   : "There's sense on both sides.";
        if (like > 0.2 || fr > 0.3) {
          const mid = (viewOf(a) + viewOf(b)) / 2;
          setView(a, viewOf(a) + (mid - viewOf(a)) * openA * 0.3); setView(b, viewOf(b) + (mid - viewOf(b)) * openB * 0.3);
          befriend(a, b, 0.12);
          if (!same) { goodwill(fa, b.f, 0.006); goodwill(fb, a.f, 0.006); }
          said(speaker, other, "agree", line, pick(["You're right.", "I've come round to that.", "My mother said the same."]));
        } else {
          /* Too far apart: each digs in, and they like each other less. */
          const va = viewOf(a), vb = viewOf(b);
          setView(a, clamp(va + Math.sign(va - vb) * openA * 0.04, -1, 1));
          setView(b, clamp(vb + Math.sign(vb - va) * openB * 0.04, -1, 1));
          befriend(a, b, -0.2 - (war ? 0.2 : 0));
          if (!same) { goodwill(fa, b.f, -0.008); goodwill(fb, a.f, -0.008); }
          said(speaker, other, "argue", line, war ? "Tell that to the ones your soldiers killed." : pick(["That's a fool's talk.", "Easy to say with a full belly.", "You'd ruin us."]));
        }
        return;
      }
      /* 7 — gossip (TODO 12; Ric, 2026-11-18: "Yes, cools only"): what one thinks of somebody
         else, the thing people pass on best (Mesoudi, Whiten and Dunbar 2006). The hearer moves
         toward it as far as they trust the teller; hearsay alone never makes an enemy. */
      if (adult(a) && adult(b) && R() < 0.25) {
        const teller = R() < 0.5 ? a : b, hearer = teller === a ? b : a;
        let best = -1, bs = 0.4;
        const o0 = teller.mb * MB + 1, o1 = o0 + teller.mcap;
        if (teller.mb >= 0) for (let o = o0; o < o1; o++) if (mKind[o] === M_FRIEND && mAbout[o] !== hearer.id) { const x = Math.abs(mNow(o)); if (x > bs) { bs = x; best = o; } }
        const q = best >= 0 ? byId.get(mAbout[best]) : null, trust = feel(hearer, teller.id);
        if (q && q !== hearer && trust > -0.1) {
          const x = mNow(best), by = x * 0.15 * (0.3 + Math.max(0, trust));
          /* Good words warm a little, but do not talk anybody out of a grudge of their own. */
          if (x < 0) feelFor(hearer, q, by, SNUB); else if (feel(hearer, q.id) >= 0) feelFor(hearer, q, Math.min(by, 0.05));
          count.gossip++;
          said(teller, hearer, "gossip", x < 0 ? pick(["Keep away from " + q.name + ".", q.name + " is not to be trusted.", "You know what " + q.name + " did?"]) : pick([q.name + " is a good sort.", "You can count on " + q.name + ".", q.name + " helped us when we needed it."]), pick(["Is that so?", "I'll remember that.", "I'd heard something like it.", "Hm."]));
          return;
        }
      }
      /* 8 — and otherwise, what there is to say about the day. */
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
      wakeUp(p);
      /* A leader does not walk out on their own faction. */
      if (v.f !== p.f && factions[p.f].leader === p.id) return;
      if (adult(p) && p.home !== v.id) {
        const was = villages[p.home];
        moves.push({ t: t, from: [was.x, was.y], to: [v.x, v.y], why: why, f: v.f });
        if (moves.length > 300) moves.splice(0, moves.length - 300);
      }
      p.home = v.id; p.at = v.id; p.settled = t; changedHomes();
      if (v.f !== p.f) {
        if (p.job === "soldier") p.job = "farmer";
        p.f = v.f; p.loyal = why === "married" ? 0.6 : 0.5; count.switched++;
      }
      count.moved++;
      /* A child goes with the parent who moved them (TODO 7b: each had been given a house of its own). */
      const parent = !adult(p) ? [byId.get(p.mum), byId.get(p.dad), byId.get(p.carer)].find(q => q && q.home === v.id && q.dwelling >= 0) : null;
      p.waitHouse = -1;
      house(p, v, parent || byId.get(p.partner));
      p.cargo = null; go(p, v.x + (R() - 0.5) * 2, v.y + (R() - 0.5) * 2, adult(p) ? "eat" : "idle"); p.wait = 0;
    }

    /* How much worse the sickness is for this person than for a fed, rested
       adult. The young and the old die of the same fever the strong shrug
       off, and hunger is the great multiplier — which is how a bad harvest
       and an outbreak become one disaster rather than two. */
    function frailty(p) {
      const old = p.dieAt > 0 ? p.age / p.dieAt : 0;
      return (p.age < 5 ? 3 : p.age < 12 ? 1.5 : 1) * (old > 0.8 ? 3 : old > 0.65 ? 1.6 : 1) *
             (p.hungry > 0 ? 3 : 1) * (p.rest > 0.8 ? 1.4 : 1);
    }

    /* ── one person, one tick ──────────────────────────────────────────── */
    function live(p) {
      p.age += 1 / YEAR;

      /* The needs that are not food, once an hour. Rest rises with the hours
         awake and faster at real work; a night in a bed clears it. Being alone
         is counted in hours since anybody last spoke to them. Fear comes from
         danger at their own door: a siege on the village they live in, enemy
         soldiers at its edge, a raid on it in the last three days, a blow they
         have just taken; it drains away when none of that is true. A war
         fought elsewhere is not fear but effort (`urgency`, TODO 14a): until
         2026-11-19 it frightened a whole faction, however far off, and a
         faction at war sat at home. */
      const resting = p.task === "sleep" && Math.hypot(p.tx - p.x, p.ty - p.y) < 0.6;
      if (resting) p.rest = Math.max(0, p.rest - 1 / SPELL.sleep);
      else p.rest = Math.min(1, p.rest + (p.task === "field" || p.task === "make" || p.task === "fight" || p.task === "march" ? 0.075 : 0.05));
      p.alone++;
      const near0 = villages[p.home];
      p.fear = clamp(p.fear + (near0.siege > 0 ? 0.3 : 0) + (near0.foes > 0 ? 0.15 : 0) + (t - near0.raidAt < 3 * DAY_HOURS ? 0.08 : 0) + (p.hit > 0 ? 0.35 : 0) - 0.05, 0, 1);

      /* Drinking (TODO 6a): at a river or lake shore, there; else from the house's water. */
      if (THIRST) {
        const here = freshNear[tileAt(p.x, p.y)], h = homes[p.dwelling];
        const atWater = here >= 0 && Math.hypot(here % cols + 0.5 - p.x, ((here / cols) | 0) + 0.5 - p.y) < 0.6 ||
                        villages[p.home].well && Math.hypot(villages[p.home].well.x - p.x, villages[p.home].well.y - p.y) < 0.3;
        if (atWater) p.dry = 0;
        else if (h && h.water >= USE / DAY_HOURS) { h.water -= USE / DAY_HOURS; p.dry = 0; }
        else if (!adult(p) && (shareWater(p))) p.dry = 0;   // a small child is given water by the neighbours, as it is fed
        else {
          p.dry = (p.dry || 0) + 1;
          /* About three days, sooner in summer heat: up to half as fast again on the warmest days. */
          const heat = 1 + Math.max(0, warmth()) * 0.5, days = THIRST === 1 ? 3 : 14;
          p.hp -= heat / (days * DAY_HOURS);
          if (p.hp <= 0) { die(p, "thirst"); return; }
        }
      }
      /* Eating. A child eats from whichever parent has food before it goes hungry. */
      p.food -= EAT * dailyNeed(p);
      if (p.food < 0) {
        p.food = 0;
        let fed = false;
        if (!adult(p)) {
          /* Whichever parent has more. */
          const m1 = byId.get(p.mum), d1 = byId.get(p.dad);
          const par = m1 && d1 ? (m1.food >= d1.food ? m1 : d1) : (m1 || d1 || byId.get(p.carer));
          if (par && par.food > 0.25) {
            const share = Math.min(0.5, par.food - 0.25);
            par.food -= share; p.food += share; fed = true;
          }
        } else {
          /* And a couple eats from one pot. */
          const mate = byId.get(p.partner);
          if (mate && mate.food > 0.6) { const half = mate.food / 2; mate.food -= half; p.food += half; fed = true; }
          /* And from what the children hold beyond their own next few days:
             a child with a larder while a parent starves is not a household. */
          if (!fed && p.wards) for (const k of p.wards) {
            const spare = k.hp > 0 ? k.food - 3 * dailyNeed(k) : 0;
            if (spare > 0.3) { const take = Math.min(spare, 1); k.food -= take; p.food += take; fed = true; break; }
          }
        }
        if (!fed) {
          /* A shared store feeds anybody. Any village feeds its own children,
             orphans included, whatever it does about money. */
          const v = villages[p.home];
          if ((shared || !adult(p)) && v.food > 0.3 && v.f === p.f) { v.food -= 0.3; p.food += 0.3; fed = true; }
        }
        if (!fed) {
          p.hungry++; p.hp -= STARVE * S.hunger;
          p.leanYr = Math.floor(t / YEAR);
          if (p.hungry === 72) shaken(p, LIFE.famine);   // three days with nothing (TODO 10)
        }
      } else {
        if (p.hungry > 0) p.hungry = Math.max(0, p.hungry - 4);
        if (p.hp < 1 && !(p.dry > 0)) p.hp = Math.min(1, p.hp + 0.004);   // no healing without water (TODO 6a)
      }
      if (p.goods > 0) p.goods = Math.max(0, p.goods - 1 / (YEAR * 1.5));
      if (p.sick > 0) {
        p.sick--;
        if (R() < SICK_HAZARD * frailty(p)) { die(p, "sick"); return; }
        if (p.sick === 0) p.immune = true;
      }
      if (p.hp <= 0) { die(p, "starved"); return; }
      if (p.age >= p.dieAt) { die(p, "old"); return; }
      /* Cold at home (TODO 9c): over a hard winter unwarmed, about one in twenty grown-ups, more of
         the very young and the old. */
      if (FIRE && villages[p.home].cold > 0 && p.task !== "march" && p.task !== "fight") {
        const c = chill();
        if (c > 0 && R() < villages[p.home].cold * c * 0.05 * frailty(p) / (120 * DAY_HOURS)) { die(p, "cold"); return; }
      }
      /* Crowded places were graveyards: London's burials outran its baptisms for two centuries and it
         grew only by those who came in (Wrigley 1967). About one more death a hundred a year in a town
         than in the country, a little over two in a city (TODO 8). */
      const place = villages[p.home].place;
      if (place && place !== "village" && R() < (place === "city" ? 0.022 : 0.01) / (365 * DAY_HOURS)) { die(p, "sick"); return; }
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
      if (p.task === "sleep") return walking ? "Going home to sleep" : "Asleep";
      if (p.task === "water") return "Fetching water";
      if (p.task === "fish") return walking ? "Going fishing" : "Fishing";
      if (p.task === "cut") return walking ? "Going to cut wood" : "Cutting wood";
      if (p.task === "quarry") return walking ? "Going to the quarry" : "Quarrying stone";
      if (p.task === "mine") return walking ? "Going to the mine" : "Mining ore";
      if (p.task === "herd") return walking ? "Taking the herd out" : "Herding";
      if (p.task === "hunt") return walking ? "Going hunting" : "Hunting";
      if (p.task === "waterhome") return "Carrying water home";
      if (p.task === "well") return walking ? "Going to dig the well" : "Digging a well";
      if (p.task === "bridge") return walking ? "Going to work on the bridge" : "Building a bridge";
      if (p.task === "build") { const h = homes[p.buildAt], own = h && (h.owner === p.id || h.owner === p.partner); return walking ? (own ? "Going to build their house" : "Going to build a house") : own ? "Building their house" : "Building a house for pay"; }
      if (p.task === "boatwork") return walking ? "Going to work on the boat" : "Building a boat";
      if (p.task === "boat") return p.rowing ? "Crossing by boat" : "Going to the boat";
      if (p.task === "rest") return walking ? "Going home" : p.sick > 0 ? "Ill at home" : "Resting at home";
      if (p.task === "visit") return walking ? "Going to see somebody" : "Visiting";
      if (p.task === "ask") return walking ? "Going to ask for food" : "Asking for food";
      if (p.task === "steal") return walking ? "Creeping to a neighbour's house" : "Taking food";
      if (p.task === "quarrel") return walking ? "Going to have it out with somebody" : "Quarrelling";
      if (p.task === "gear") return walking ? "Going for tools" : "Fitting tools";
      if (p.task === "fight") return "Fighting";
      if (p.task === "scout") return "Checking the market in " + villages[p.at].name;
      if (p.task === "pickup") return "Going to load goods in " + villages[p.at].name;
      if (p.cargo) return "Carrying " + p.cargo.what + " to " + villages[p.at].name;
      if (p.job === "soldier") return walking ? "Patrolling" : "Standing guard";
      if (p.job === "trader") return walking ? "Travelling to trade" : "Trading";
      return walking ? "Walking" : p.job === "child" ? "Playing" : "Resting";
    }

    /* Half a metre on a 250-metre square, at "Real size"; as wide as a drawn
       box otherwise. At real size the bookkeeping of who stands where is
       skipped altogether: nobody is ever in the way. */
    const REAL_BODIES = S.bodies === "real";
    const BODY = REAL_BODIES ? 0.002 : 0.42, BODY2 = (BODY - 1e-9) ** 2;
    /* Who stands where, by tile. Plain arrays reused from tick to tick, and a
       list of the cells in use so a tick clears only those: until 2026-11-14
       this was a Map of Sets rebuilt from nothing every tick — 43% of the
       engine's time, with every tile of the map wiped 6,000 times a day.
       The contents and their order are exactly what the Map held, so the
       world is the same world; it is only faster. */
    const occ = new Array(cols * rows), occUsed = [];
    const cell = (x, y) => Math.floor(y) * cols + Math.floor(x);
    /* ── a blocked step is remembered (2026-11-15) ─────────────────────────
       Measured on a 5,000-person world: 87% of everybody's steps were an
       attempt to walk that was blocked — a village that size is packed, so
       a person aiming at their bed or bench tries the heading and four ways
       round it every step, and ends the step standing where they began. That was
       6.25 million blocked attempts a day and three quarters of the engine's
       time, for people who never moved.
       A blocked attempt changes nothing, and it can only come out differently
       if room has been made: somebody within reach has stepped away or died.
       So each square keeps the count (`clock`) at which room was last made
       on it, and a person keeps the count at their last blocked attempt. If
       they stand where they stood, want the same step, and no square around
       them has had room made since, the answer is the same and is not worked
       out again. Somebody arriving can only block, never free, so arrivals
       are not counted. The world that comes out is the same world, step for
       step: test/walking.test.mjs runs it both ways.
       (The idea is the sleeping body of a physics engine: stop working on
       what cannot change, and wake it when a neighbour moves.) */
    const MEMO = !REAL_BODIES && !PLAIN;
    const roomAt = MEMO ? new Float64Array(cols * rows) : null;
    let clock = 0;
    const madeRoom = (x, y) => { if (MEMO) { const i = cell(x, y); roomAt[i] = ++clock; tell(Math.floor(x), Math.floor(y), false); } };
    /* Somebody has come to stand at (x, y) (2026-11-15, TODO 2b). An arrival
       cannot unblock a step or open a way for somebody walled in, so those
       memories ignore it; but a search that ran out of tries can come out
       differently when anybody at all moves on the ground it looked at, so
       that memory reads these counts as well as the room made. */
    const cameAt = MEMO ? new Float64Array(cols * rows) : null;
    const came = (x, y) => { if (MEMO) { cameAt[cell(x, y)] = ++clock; tell(Math.floor(x), Math.floor(y), true); } };
    /* Has room been made near (x, y) since count `since`? A remembered step
       is at most two pieces of 0.2: the walker can be 0.2 away when they try
       the second, try a spot 0.2 further, and be stopped by somebody 0.42
       from that — 0.82 in all, under one square. So everybody who can matter
       is on this square or one of the eight round it. (Off the edge of a row
       this reads a square that is not a neighbour; that can only say "look
       again", never "skip".) */
    function quiet(x, y, since) {
      const fx = Math.floor(x), fy = Math.floor(y);
      for (let j = -1; j <= 1; j++) {
        const i = (fy + j) * cols + fx;
        if (roomAt[i - 1] > since || roomAt[i] > since || roomAt[i + 1] > since) return false;
      }
      return true;
    }
    function put(p) {
      if (REAL_BODIES) return;
      const key = cell(p.x, p.y);
      let list = occ[key];
      if (!list) { list = occ[key] = []; }
      if (!list.length) occUsed.push(key);
      /* No look for "already here": somebody is always taken out before
         being put back, and `free` only asks whether anybody is in the way,
         so a second mention of the same person could not change an answer. */
      list.push(p);
    }
    function unputAt(p, key) {
      const list = occ[key]; if (!list) return;
      const i = list.indexOf(p); if (i >= 0) list.splice(i, 1);
    }
    function unput(p) { unputAt(p, cell(p.x, p.y)); }
    function free(p, x, y) {
      if (x < 0.25 || y < 0.25 || x > cols - 0.25 || y > rows - 0.25) return false;
      /* Not into the sea or a lake (TODO 4b). Somebody already in it, put
         there from outside, may still walk out. */
      if (stopAt((y | 0) * cols + (x | 0)) && !wet(p.x, p.y)) return false;
      if (REAL_BODIES) return true;
      /* Only the squares a body's width from (x, y) can touch: one, two or
         four of them, not always nine. Until 2026-11-15 it read all nine, and
         reading squares that could not hold anybody close enough was a third
         of the engine's time once blocked steps were remembered. Anybody on a
         square left out is further off than a body, so the answer is the same. */
      const x0 = Math.floor(x - BODY), x1 = Math.floor(x + BODY), y1 = Math.floor(y + BODY);
      for (let cy = Math.floor(y - BODY); cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const list = occ[cy * cols + cx];
        if (list) for (let k = 0; k < list.length; k++) { const q = list[k]; if (q !== p && q.hp !== -99 && (x - q.x) ** 2 + (y - q.y) ** 2 < BODY2) return false; }
      }
      return true;
    }
    /* A stride longer than a body is taken in pieces, each checked, so a
       longer step a tick (the five-minute day) never walks through anybody. */
    /* Set down somewhere else at once: off a boat (TODO 6d). The lists are kept as a step keeps them. */
    function jump(p, x, y) {
      const x0 = p.x, y0 = p.y;
      p.x = x; p.y = y;
      if (!PLAIN && tileAt(p.x, p.y) !== p.bk) shifted.push(p);
      if (MEMO) { madeRoom(x0, y0); came(p.x, p.y); p.ox = p.x; p.oy = p.y; p.mc = -1; }
    }
    function move(p, dx, dy) {
      if (MEMO && p.mc >= 0 && p.mx === p.x && p.my === p.y && p.mdx === dx && p.mdy === dy && quiet(p.x, p.y, p.mc)) return;
      const x0 = p.x, y0 = p.y;
      const k = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.2));
      for (let i = 0; i < k; i++) {
        const bx = p.x, by = p.y;
        moveOnce(p, dx / k, dy / k);
        if (p.x === bx && p.y === by) break;
      }
      /* On another square now: their name moves to its list at the next refill. */
      if (!PLAIN && (p.x !== x0 || p.y !== y0) && tileAt(p.x, p.y) !== p.bk) shifted.push(p);
      /* And the ground is trodden (TODO 7d). */
      if (p.x !== x0 || p.y !== y0) { const a = tileAt(p.x, p.y); if (a !== tileAt(x0, y0)) tread(a); }
      if (MEMO) {
        /* Standing where they started counts as blocked even if they stepped
           aside and straight back, which is what a packed crowd mostly does:
           82,000 such steps an hour against 1,600 that got anywhere. Nobody
           else acts in between, so nothing saw it and no room was made. */
        if (p.x !== x0 || p.y !== y0) { madeRoom(x0, y0); came(p.x, p.y); p.ox = p.x; p.oy = p.y; p.mc = -1; }
        /* Only a step of one or two pieces is remembered: see `quiet`. A
           longer one (a faster walker, a finer map) is worked out every time. */
        else if (k <= 2) { p.mc = clock; p.mx = x0; p.my = y0; p.mdx = dx; p.mdy = dy; }
        else p.mc = -1;
      }
    }
    function moveOnce(p, dx, dy) {
      // Try the heading, then slide round a neighbour rather than walking through them.
      if (free(p, p.x + dx, p.y + dy)) {
        unput(p);
        p.x += dx; p.y += dy; put(p); return;
      }
      const options = [[dx * 0.7 - dy * 0.7, dy * 0.7 + dx * 0.7],
        [dx * 0.7 + dy * 0.7, dy * 0.7 - dx * 0.7], [-dy, dx], [dy, -dx]];
      for (const [mx, my] of options) if (free(p, p.x + mx, p.y + my)) {
        unput(p);
        p.x += mx; p.y += my; put(p); return;
      }
    }
    /* A short sidestep cannot escape a crescent of bodies: it oscillates at
       the same entrance. Plan around occupied space only after progress stops.
       Half-tile A* is bounded, deterministic and cached as waypoints; every
       edge and actual footstep still checks bodies. No teleporting or overlap. */
    /* A way round that could not be found is remembered too, the same way as
       a blocked step: measured, 892,000 searches a day at 5,000 people and
       123 of them found anything. `m` holds where they stood, where they were
       going, the squares the search looked at, and the count then; until room
       is made on one of those squares the search would fail again. */
    function noWay(p, x0, y0, x1, y1, any) {
      if (!MEMO) return null;
      const m = p.rm || (p.rm = { c: -1, x: 0, y: 0, tx: 0, ty: 0, x0: 0, y0: 0, x1: 0, y1: 0, any: false });
      m.any = !!any;       // true: forgotten when anybody moves there at all, not only when room is made
      m.x0 = clamp(Math.floor(x0 - BODY), 0, cols - 1); m.x1 = clamp(Math.floor(x1 + BODY), 0, cols - 1);
      m.y0 = clamp(Math.floor(y0 - BODY), 0, rows - 1); m.y1 = clamp(Math.floor(y1 + BODY), 0, rows - 1);
      /* A search that wandered very far is not remembered. Until 2026-11-15
         (TODO item 2) the line was 144 squares, on the thought that reading
         them again would cost what the search did; measured, a failed search
         is some hundreds of times dearer than reading a thousand numbers,
         and at 20,000 people 92,000 searches a day were over the line and
         run again every time. */
      if ((m.x1 - m.x0 + 1) * (m.y1 - m.y0 + 1) > 1024) { m.c = -1; return null; }
      m.c = clock; m.x = p.x; m.y = p.y; m.tx = p.tx; m.ty = p.ty;
      if (AUDIT) { const snap = bodiesIn(m, p); snap.strict = outOfTries; snaps.set(p, snap); }
      return null;
    }
    /* For the audit: everybody standing on the ground a memory covers, and
       exactly where. The memory's claim is that they are all still there —
       and, for a search that ran out of tries, that nobody else is. */
    const snaps = new WeakMap();
    function bodiesIn(m, p) {
      const out = [];
      for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) { const l = occ[y * cols + x]; if (l) for (const q of l) if (q !== p && q.hp !== -99) out.push(q.id + ":" + q.x + ":" + q.y); }
      return out.sort();
    }
    /* The search whatever is remembered, leaving what is remembered as it was. */
    function searchAnyway(p) {
      const kept = Object.assign({}, p.rm), snap = snaps.get(p);
      sure = true; const found = routeAround(p); sure = false;
      Object.assign(p.rm, kept); snaps.set(p, snap);
      return found;
    }
    function auditMemory(p) {
      const m = p.rm, snap = snaps.get(p), now = new Set(bodiesIn(m, p));
      for (const b of snap) if (!now.has(b)) throw new Error("audit: somebody on the ground " + p.name + "'s failed search looked at has gone, and it was not forgotten");
      if ((m.any || snap.strict) && now.size !== snap.length) throw new Error("audit: somebody has come onto the ground " + p.name + "'s search ran out of tries on, and it was not forgotten");
    }
    function stillNoWay(p) {
      const m = p.rm;
      if (!m || m.c < 0 || m.x !== p.x || m.y !== p.y || m.tx !== p.tx || m.ty !== p.ty) return false;
      for (let y = m.y0; y <= m.y1; y++) { const row = y * cols; for (let x = m.x0; x <= m.x1; x++) if (roomAt[row + x] > m.c || (m.any && cameAt[row + x] > m.c)) return false; }
      return true;
    }
    /* ── the way over the land (TODO 4b) ─────────────────────────────────
       A* over the 250 m squares, each costing its length over its pace, from
       the square somebody stands on to the one they are going to; the sea
       and lakes are not squares to it. The answer is kept for that pair of
       squares, since people walk the same ways day after day; the land does
       not change, so it never goes stale. Then the corners are cut: a point
       of the way is skipped when the straight line past it stays on land.
       The crowd search (`routeAround`) still does the last few metres. */
    let wayG = null, wayFrom = null, wayAt = null, wayStamp = 0;
    const ways = new Map();
    function landWay(p) {
      const s0 = tileAt(p.x, p.y), g0 = tileAt(p.tx, p.ty);
      if (s0 === g0 || landPiece[s0] !== landPiece[g0] || !landPiece[g0]) return null;   // already there, or no way by land
      let tiles_ = ways.get(s0 * tiles + g0);
      if (!tiles_) {
        if (!wayG) { wayG = new Float32Array(tiles); wayFrom = new Int32Array(tiles); wayAt = new Int32Array(tiles); }
        if (++wayStamp > 2e9) { wayAt.fill(0); wayStamp = 1; }
        const gx = g0 % cols, gy = (g0 / cols) | 0, est = i => Math.hypot(i % cols - gx, ((i / cols) | 0) - gy);
        const heap = [], hf = [];
        const push = (i, fv) => { let k = heap.length; heap.push(i); hf.push(fv); while (k > 0) { const j = (k - 1) >> 1; if (hf[j] <= fv) break; heap[k] = heap[j]; hf[k] = hf[j]; k = j; } heap[k] = i; hf[k] = fv; };
        const pop = () => { const top = heap[0], li = heap.pop(), lf = hf.pop(); if (heap.length) { let k = 0; for (;;) { let c = k * 2 + 1; if (c >= heap.length) break; if (c + 1 < heap.length && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; heap[k] = heap[c]; hf[k] = hf[c]; k = c; } heap[k] = li; hf[k] = lf; } return top; };
        wayAt[s0] = wayStamp; wayG[s0] = 0; wayFrom[s0] = -1; push(s0, est(s0));
        let found = false;
        for (let looks = 0; heap.length && looks < 4e6; looks++) {
          const i = pop(); if (i === g0) { found = true; break; }
          const x = i % cols, y = (i / cols) | 0, gi = wayG[i];
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const j = ny * cols + nx, k = ground[j]; if (stopAt(j) || shut(x, y, dx, dy)) continue;
            const g = gi + (dx && dy ? Math.SQRT2 : 1) / (cross !== null && cross[j] === 3 ? 1 : paceAt(j));
            if (wayAt[j] === wayStamp && g >= wayG[j]) continue;
            wayAt[j] = wayStamp; wayG[j] = g; wayFrom[j] = i; push(j, g + est(j));
          }
        }
        if (!found) return null;
        const path = []; for (let i = g0; i >= 0; i = wayFrom[i]) path.push(i);
        path.reverse();
        /* Cut the corners: from each kept point, the furthest later one in a dry straight line. */
        const kept = [s0];
        for (let a = 0; a < path.length - 1;) {
          let b = Math.min(path.length - 1, a + 40);
          while (b > a + 1 && !dryLine(path[a], path[b])) b--;
          kept.push(path[b]); a = b;
        }
        tiles_ = kept.slice(1);
        if (ways.size > 20000) ways.clear();
        ways.set(s0 * tiles + g0, tiles_);
      }
      if (!tiles_.length) return null;
      const out = tiles_.map(i => ({ x: i % cols + 0.5, y: ((i / cols) | 0) + 0.5 }));
      out[out.length - 1] = { x: p.tx, y: p.ty };
      return out;
    }
    function dryLine(a, b) {
      const ax = a % cols + 0.5, ay = ((a / cols) | 0) + 0.5, bx = b % cols + 0.5, by = ((b / cols) | 0) + 0.5;
      const len = Math.hypot(bx - ax, by - ay), n = Math.ceil(len * 3);
      if (cross === null) { for (let k = 1; k < n; k++) if (wet(ax + (bx - ax) * k / n, ay + (by - ay) * k / n)) return false; return true; }
      /* With big rivers (TODO 6d): a river runs corner to corner, so a line checked at three points
         a square slipped through where two river squares touch, and walkers stuck at the bank.
         Beside a big river (`byBig`), six points a square and a body's breadth either side. */
      const px = -(by - ay) / (len || 1) * 0.2, py = (bx - ax) / (len || 1) * 0.2;
      for (let k = 1; k < n; k++) {
        const x = ax + (bx - ax) * k / n, y = ay + (by - ay) * k / n;
        if (wet(x, y)) return false;
        if (byBig[(y | 0) * cols + (x | 0)]) for (let h = -0.5; h <= 0.5; h += 0.5) {
          const hx = x + (bx - ax) * h / n, hy = y + (by - ay) * h / n;
          if (wet(hx, hy) || wet(hx + px, hy + py) || wet(hx - px, hy - py)) return false;
        }
      }
      return true;
    }
    const DIAGONAL = Math.hypot(1, 1) * 0.5;
    let sure = false, outOfTries = false;      // the audit's: search whatever is remembered; how the last search ended
    function routeAround(p) {
      if (MEMO && !sure && stillNoWay(p)) {
        /* For tests: search anyway, and see that there really is still no way. */
        if (AUDIT) {
          auditMemory(p);
          if (searchAnyway(p)) throw new Error("audit: " + p.name + " was remembered as having no way round, and has one");
        }
        return null;
      }
      // On this half-tile lattice these are every possible arrival node.
      // A packed destination has no route, regardless of how far we search.
      // Reject it cheaply instead of exploring 800 nodes on every retry.
      let arrival = false;
      const gx = Math.floor((p.tx - p.x) * 2), gy = Math.floor((p.ty - p.y) * 2);
      for (let y = gy - 1; y <= gy + 1; y++) for (let x = gx - 1; x <= gx + 1; x++) {
        const nx = p.x + x * 0.5, ny = p.y + y * 0.5;
        if (Math.hypot(nx - p.tx, ny - p.ty) <= 0.5 && free(p, nx, ny)) arrival = true;
      }
      outOfTries = false;
      if (!arrival) return noWay(p, p.tx - 0.5, p.ty - 0.5, p.tx + 0.5, p.ty + 0.5);
      const heap = [], costs = new Map(), clear = new Map();
      let lx = p.x, ly = p.y, hx = p.x, hy = p.y;   // every place the search looks at lies in this box
      /* A number, not "x,y": the search makes a key for every neighbour of
         every place it looks at, and building a string each time was a third
         of its cost. 800 looks cannot get 4,096 half-squares from the start. */
      const key = (x, y) => (x + 4096) * 8192 + (y + 4096);
      const distance = n => Math.hypot(p.tx - n.x, p.ty - n.y);
      function push(n) {
        let i = heap.length; heap.push(n);
        while (i > 0) { const j = (i - 1) >> 1; if (heap[j].f <= n.f) break; heap[i] = heap[j]; i = j; }
        heap[i] = n;
      }
      function pop() {
        const first = heap[0], last = heap.pop();
        if (heap.length) {
          let i = 0;
          while (i * 2 + 1 < heap.length) {
            let j = i * 2 + 1;
            if (j + 1 < heap.length && heap[j + 1].f < heap[j].f) j++;
            if (heap[j].f >= last.f) break;
            heap[i] = heap[j]; i = j;
          }
          heap[i] = last;
        }
        return first;
      }
      /* How far a place is from where they are going is worked out once and
         kept on it (`h`), and the length of a step along the lattice is one
         of two numbers (2026-11-15, TODO 2b): the search asked for both
         again at every look, 6,400 square roots a search for the step alone,
         and a sixth of a dense land's time was that one sum. The same
         numbers, so the same search. */
      const start = { ix: 0, iy: 0, x: p.x, y: p.y, g: 0, parent: null, h: 0, f: 0 };
      start.h = distance(start); start.f = start.h; costs.set(key(0, 0), 0); push(start);
      for (let tries = 0; heap.length && tries < 800; tries++) {
        const n = pop();
        if (n.g !== costs.get(key(n.ix, n.iy))) continue;
        if (n.h <= 0.5) {
          const path = [];
          for (let q = n; q.parent; q = q.parent) path.push({ x: q.x, y: q.y });
          return path.reverse();
        }
        for (let iy = -1; iy <= 1; iy++) for (let ix = -1; ix <= 1; ix++) {
          if (!ix && !iy) continue;
          const nx = n.ix + ix, ny = n.iy + iy, k = key(nx, ny);
          const x = p.x + nx * 0.5, y = p.y + ny * 0.5, g = n.g + (ix && iy ? DIAGONAL : 0.5);
          if (g >= (costs.get(k) ?? Infinity)) continue;
          if (x < lx) lx = x; else if (x > hx) hx = x;
          if (y < ly) ly = y; else if (y > hy) hy = y;
          if (!clear.has(k)) clear.set(k, free(p, x, y));
          if (!clear.get(k)) continue;
          let fits = true;
          for (let s = 1; s < 6; s++) if (!free(p, n.x + ix * 0.5 * s / 6, n.y + iy * 0.5 * s / 6)) { fits = false; break; }
          if (!fits) continue;
          const q = { ix: nx, iy: ny, x, y, g, parent: n, h: 0, f: 0 }; q.h = distance(q); q.f = g + q.h;
          costs.set(k, g); push(q);
        }
      }
      /* Out of tries with places still to look at is a different failure from
         being walled in. Somebody arriving can shut off a dead end the search
         was wasting its 800 looks in, and the same search then gets through:
         so "nobody new can open a way" is true of walls and not of patience.
         It is remembered all the same (2026-11-15, TODO 2b), but only until
         anybody on the ground it looked at moves at all — comes, goes or
         dies — because with every body where it was, the search is the same
         search. Measured in a 2,000-person country on 17 km: these were
         3,325 searches a day at 730 millionths of a second each, 60% of the
         engine's time, each run again every seven steps by somebody who had
         not moved in a crowd that had not moved either. */
      outOfTries = heap.length > 0;      // told to the audit separately from what is remembered
      if (heap.length) return noWay(p, lx, ly, hx, hy, true);
      // A fully enclosed person waits for a real opening.
      /* What is remembered is the ground the search looked at, and no more.
         Until 2026-11-15 the box was stretched to take in where they were
         going as well, though a search that ran out of places never got
         there: so somebody stepping aside anywhere between a walled-in
         walker and a bed twenty squares off sent them searching again —
         measured in a 2,000-person country on 17 km, 96,000 searches a day
         run again for 1,355 ways found. */
      return noWay(p, lx, ly, hx, hy);
    }
    /* ── placing a crowd (2026-11-15) ──────────────────────────────────────
       Everybody new is stood on the nearest spot to where they appeared that
       nobody is within a body of, looking outward ring by ring. For a whole
       world at once that was most of a start: 20,000 people took 24 seconds,
       because somebody arriving in the middle of 2,500 others tries a few
       thousand spots, each a look through the neighbours.
       `taken` is a finer map of the same ground, sixteen to a square's side,
       marking every small square that lies wholly inside one body's reach.
       A spot on a marked square is taken without looking further, and a ring
       that only crosses squares marked all over is skipped whole. It only
       ever says "taken" where `free` would say so too, so everybody ends up
       standing exactly where they did before. Made when a crowd arrives
       together, thrown away after. */
    const SUB = 16;
    let taken = null, takenSlot = null;   // the marked squares, and which of them each square of the land is (0: none yet)
    function takenSquare(tx, ty) {
      const key = ty * cols + tx;
      let e = taken[takenSlot[key]];
      if (!e) { takenSlot[key] = taken.length; taken.push(e = { a: new Uint8Array(SUB * SUB), n: 0, gaps: null, gapsAt: -1, tx, ty, b: [] }); }
      return e;
    }
    function markTaken(q) {
      const s = 1 / SUB, lim = (BODY - 1e-6) ** 2;
      /* Each square a body could reach keeps the body's name, so a gap left
         between bodies can be looked at again with them (`gapsOf`). */
      for (let ty = Math.max(0, Math.floor(q.y - BODY)), ty1 = Math.min(rows - 1, Math.floor(q.y + BODY)); ty <= ty1; ty++)
        for (let tx = Math.max(0, Math.floor(q.x - BODY)), tx1 = Math.min(cols - 1, Math.floor(q.x + BODY)); tx <= tx1; tx++) takenSquare(tx, ty).b.push(q);
      const gx1 = Math.floor((q.x + BODY) * SUB), gy1 = Math.floor((q.y + BODY) * SUB);
      for (let gy = Math.floor((q.y - BODY) * SUB); gy <= gy1; gy++) for (let gx = Math.floor((q.x - BODY) * SUB); gx <= gx1; gx++) {
        // the corner of this small square furthest from the body
        const ax = Math.max(Math.abs(gx * s - q.x), Math.abs((gx + 1) * s - q.x)), ay = Math.max(Math.abs(gy * s - q.y), Math.abs((gy + 1) * s - q.y));
        if (ax * ax + ay * ay >= lim) continue;
        const tx = Math.floor(gx / SUB), ty = Math.floor(gy / SUB);
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue;
        const e = takenSquare(tx, ty);
        const i = (gy - ty * SUB) * SUB + gx - tx * SUB;
        if (!e.a[i]) { e.a[i] = 1; e.n++; filled(e); }
      }
    }
    function takenAt(x, y) {
      const fx = Math.floor(x), fy = Math.floor(y);
      if (fx < 0 || fy < 0 || fx >= cols || fy >= rows) return true;   // off the land: never a place to stand
      const e = taken[takenSlot[fy * cols + fx]];
      if (!e) return false;
      return e.a[Math.min(SUB - 1, Math.floor((y - fy) * SUB)) * SUB + Math.min(SUB - 1, Math.floor((x - fx) * SUB))] === 1;
    }
    /* ── only the points of a ring that could be free (2026-11-15, TODO 3b) ──
       Until then (`ringTaken`) a ring was skipped only when every square it
       crossed was marked all over. But in a
       packed crowd one square in five is not quite — a sliver between two
       bodies that neither covers alone, or a real gap too small to matter —
       so nearly every ring was walked point by point after all, each point a
       sine, a cosine and a look at the finer map: 91% of making a big world,
       and four times the wait for twice the people (40,000: 16 s).

       So the points of a ring that could be anything but taken are written
       down first: the points over a square with no marks or few, and, in a
       square marked nearly all over, the points over its few unmarked small
       squares (`gaps`, kept with the square and made again when its marks
       change). Every other point lies
       on a small square that is marked, where the finer map would have said
       "taken" — so leaving it out changes nothing, and the points written
       down are then tried in the order and by the tests they always were.
       Everybody stands exactly where they stood (test/walking.test.mjs holds
       it against the engine with no finer map at all).

       Which points lie over a piece of ground is worked out from the angles
       its corners are seen at from the middle, and a point is written down
       if it is within a ten-thousandth of a step of that — far more than
       arithmetic can be out by, so a point is never wrongly left out; one
       wrongly put in is only tried and found taken. */
    const NEARLY = SUB * SUB - 40, EDGE = 1e-6, TAU = Math.PI * 2, byNumber = (a, b) => a - b;
    let candAt = new Uint8Array(512);
    const candRoom = n => { if (candAt.length < n) candAt = new Uint8Array(n * 2); };
    const cands = [];
    /* A gap no one body covers may still be covered by two or three of them
       together, and then no point in it is free (`free` turns down anywhere
       nearer than a body's width to anybody, and every marked body is on
       the land's lists). Such a gap was looked over again for each newcomer
       who came near: most of a big start, and the reason a packed square is
       almost never marked all over (100,000 people: 23 s). So a gap is cut
       in sixteen and, if each piece is wholly within a body's width of one
       of the bodies the square knows (marked the way `markTaken` marks),
       it is marked too. Only points `free` would have turned down are left
       out, so everybody still stands exactly where they did. */
    const PIECE = 4;
    function coveredGap(e, i) {
      const s = 1 / SUB, t = s / PIECE, lim = (BODY - 1e-6) ** 2;
      const gx0 = e.tx + (i % SUB) * s, gy0 = e.ty + Math.floor(i / SUB) * s, b = e.b;
      for (let py = 0; py < PIECE; py++) for (let px = 0; px < PIECE; px++) {
        const x0 = gx0 + px * t, y0 = gy0 + py * t, x1 = x0 + t, y1 = y0 + t;
        let covered = false;
        for (let k = 0; k < b.length && !covered; k++) {
          const q = b[k];
          const ax = Math.max(Math.abs(x0 - q.x), Math.abs(x1 - q.x)), ay = Math.max(Math.abs(y0 - q.y), Math.abs(y1 - q.y));
          covered = ax * ax + ay * ay < lim;
        }
        if (!covered) return false;
      }
      return true;
    }
    function gapsOf(e) {
      if (e.gapsAt !== e.n) {
        for (let i = 0; i < SUB * SUB; i++) if (!e.a[i] && coveredGap(e, i)) { e.a[i] = 1; e.n++; filled(e); }
        const g = e.gaps || (e.gaps = []);
        g.length = 0;
        for (let i = 0; i < SUB * SUB; i++) if (!e.a[i]) g.push(i);
        e.gapsAt = e.n;
      }
      return e.gaps;
    }
    /* Write down every point k of the ring (n of them, the first at the angle
       `turn`) that may lie over the ground x0..x1, y0..y1, seen from (x, y). */
    function overGround(x, y, n, turn, x0, y0, x1, y1) {
      let lo, hi;
      if (x > x0 - EDGE && x < x1 + EDGE && y > y0 - EDGE && y < y1 + EDGE) { lo = 0; hi = n - 1; }   // standing on it: any point may be
      else {
        const mid = Math.atan2((y0 + y1) / 2 - y, (x0 + x1) / 2 - x);
        let least = 0, most = 0;
        for (let c = 0; c < 4; c++) {
          let d = Math.atan2((c < 2 ? y0 : y1) - y, (c & 1 ? x1 : x0) - x) - mid;
          if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
          if (d < least) least = d; if (d > most) most = d;
        }
        const per = n / TAU, u = (mid - turn) * per;
        lo = Math.ceil(u + least * per - 1e-4); hi = Math.floor(u + most * per + 1e-4);
        if (hi - lo >= n - 1) { lo = 0; hi = n - 1; }
      }
      for (let k = lo; k <= hi; k++) {
        const m = ((k % n) + n) % n;
        if (!candAt[m]) { candAt[m] = 1; cands.push(m); }
      }
    }
    /* Which rings come over which ground. Walking the squares each ring
       crosses was still most of a start, because the same squares are
       crossed again by the next ring and the next. So the ground round a
       newcomer is looked over once instead, a square shell of squares at a
       time as the rings reach it, and every piece that is not wholly taken —
       a square with few marks, or a gap in one nearly full — is written down
       once, under the first ring that reaches it (`startsAt`), with the last
       one, which its nearest and furthest corners give. As the rings go out,
       the pieces they reach join a running list (`reached`) and leave it once
       passed. (Writing each piece against every ring it would meet was a
       seventh of a big start, mostly for rings the search never got to.) A
       ring with no piece reached has no point that could be free, and is passed
       without a look. */
    const HALF = BODY * 0.5;
    const startsAt = [], startRings = [], reached = [];
    function ringsOver(x, y, x0, y0, x1, y1, from) {
      const nx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0, ny = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
      const fx = Math.max(Math.abs(x0 - x), Math.abs(x1 - x)), fy = Math.max(Math.abs(y0 - y), Math.abs(y1 - y));
      const last = Math.floor((Math.sqrt(fx * fx + fy * fy) + EDGE) / HALF);
      const first = Math.max(from, Math.ceil((Math.sqrt(nx * nx + ny * ny) - EDGE) / HALF));
      if (first > last) return;
      let h = startsAt[first]; if (!h) h = startsAt[first] = [];
      if (!h.length) startRings.push(first);
      h.push(x0, y0, x1, y1, last);
    }
    function lookOver(x, y, tx, ty, from) {
      if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return;      // off the land: never a place to stand
      if (deep(ground[ty * cols + tx])) return;                          // nor the sea or a lake
      const e = taken[takenSlot[ty * cols + tx]];
      if (!e || e.n < NEARLY) { ringsOver(x, y, tx, ty, tx + 1, ty + 1, from); return; }
      if (e.n === SUB * SUB) return;
      const g = gapsOf(e), s = 1 / SUB;
      for (let k = 0; k < g.length; k++) {
        const i = g[k], gx0 = tx + (i % SUB) * s, gy0 = ty + Math.floor(i / SUB) * s;
        ringsOver(x, y, gx0, gy0, gx0 + s, gy0 + s, from);
      }
    }
    /* Squares full all over, counted by blocks of 8 × 8 (`blockFull`).
       A newcomer's search goes out over squares (`lookShell`), and in a
       big crowd two in three of them are full, so nothing on them could be
       free — but they were each looked at, by every newcomer who came near:
       the wait grew with the square of the crowd. A block all full is now
       passed in one look. Off the land counts as full (nobody may stand
       there either), and a square only fills while a crowd is placed, never
       empties, so a count only goes up. */
    const BLK = 8;
    let blockFull = null, fullCols = 0, waterBlocks = null;
    function filled(e) { if (e.n === SUB * SUB && !deep(ground[e.ty * cols + e.tx])) blockFull[(e.ty >> 3) * fullCols + (e.tx >> 3)]++; }
    function newBlocks() {
      fullCols = Math.ceil(cols / BLK); const brows = Math.ceil(rows / BLK);
      blockFull = new Int32Array(fullCols * brows);
      for (let by = 0; by < brows; by++) for (let bx = 0; bx < fullCols; bx++)
        blockFull[by * fullCols + bx] = BLK * BLK - (Math.min(cols, bx * BLK + BLK) - bx * BLK) * (Math.min(rows, by * BLK + BLK) - by * BLK);
      /* The sea and lakes count as full: nobody may stand there (TODO 4a). Counted once a world. */
      if (!waterBlocks) {
        waterBlocks = new Int32Array(blockFull.length);
        for (let i = 0; i < tiles; i++) if (deep(ground[i])) waterBlocks[((i / cols | 0) >> 3) * fullCols + ((i % cols) >> 3)]++;
      }
      for (let b = 0; b < blockFull.length; b++) blockFull[b] += waterBlocks[b];
    }
    /* The squares exactly j squares off (as a king moves) from the one stood on. */
    function lookShell(x, y, fx, fy, j, from) {
      if (j === 0) { lookOver(x, y, fx, fy, from); return; }
      lookRow(x, y, fy - j, fx - j, fx + j, from); lookRow(x, y, fy + j, fx - j, fx + j, from);
      lookColumn(x, y, fx - j, fy - j + 1, fy + j - 1, from); lookColumn(x, y, fx + j, fy - j + 1, fy + j - 1, from);
    }
    function lookRow(x, y, ty, a, b, from) {
      if (ty < 0 || ty >= rows) return;
      const row = (ty >> 3) * fullCols;
      for (let tx = Math.max(0, a), last = Math.min(cols - 1, b); tx <= last;) {
        if (blockFull[row + (tx >> 3)] === BLK * BLK) { tx = (tx | 7) + 1; continue; }
        lookOver(x, y, tx, ty, from); tx++;
      }
    }
    function lookColumn(x, y, tx, a, b, from) {
      if (tx < 0 || tx >= cols) return;
      const col = tx >> 3;
      for (let ty = Math.max(0, a), last = Math.min(rows - 1, b); ty <= last;) {
        if (blockFull[(ty >> 3) * fullCols + col] === BLK * BLK) { ty = (ty | 7) + 1; continue; }
        lookOver(x, y, tx, ty, from); ty++;
      }
    }
    /* ── not visiting people with nothing to do (2026-11-15, TODO item 2) ──
       Until now every person was visited on every step, 1,440 times a day,
       and so were the lists of who stands where, emptied and refilled. But
       somebody asleep, or at a day's work in a field or at a bench, does
       nothing on a step except count it: their `wait` goes down by one.
       So `wake` holds, for each place in the people array, the step at which
       that person next does anything, and the loop passes over them until
       then without looking at them at all. It is worked out at the end of
       `act`, and only for somebody for whom a step is nothing but the count:
       standing where they mean to be, waiting, nothing said or struck still
       showing, not due a word with anybody, and in a task in which nobody
       starts a conversation (that draws from the dice, and the dice must be
       drawn in the same order or it is a different world).
       What can end it early is somebody else: a neighbour speaks to them,
       asks them for food, takes them along to another village, or they die.
       Each of those calls `wakeUp` first, which gives them back the `wait`
       they would have had and has them visited again. Everything that
       happens on the hour (`hour`) may touch anybody, so everybody is woken
       for it — one visit in sixty. And whatever the page or a test did to
       people between two calls of `advance` is looked for once, at the start
       of the next (`lookRound`), where the old loop looked on every step.
       While somebody dozes their `wait` is behind; `settle` puts it right
       before `advance` returns, so nothing outside ever sees it wrong.
       The method is the oldest one in simulation — keep a time for the next
       thing each part will do and go straight to it (README, "Only people
       with something to do"). The world is the same world, step for step:
       test/dozing.test.mjs runs it both ways. */
    const quietTask = k => k === "sleep" || k === "field" || k === "make" || k === "fight";
    const paceOf = p => WALK * (p.hungry > 30 ? 0.7 : 1) * (p.job === "child" ? 0.8 : 1);
    const whole = v => Math.floor(v) === v;
    /* How many rolls, at the odds of trying to speak on one step, until the
       first that comes up: at least one. */
    function nextTry() {
      const odds = Math.min(0.9, S.talk * 0.12 / STEP_SCALE);
      return 1 + Math.floor(Math.log(1 - R()) / Math.log(1 - odds));
    }
    /* For two in conversation: the step, counted from the one just had, on
       which the first of them has finished. `heard` is what the other still
       has to say as this one will next see it. */
    function untilHeard(p, r, heard) {
      if (!whole(p.sayT) || !whole(heard) || !(p.talk <= 0 || whole(p.talk))) return 1;
      return Math.min(p.sayT, heard);
    }
    function inTalk(p) {
      const r = p.sayT > 0 && !(p.hit > 0) && p.hp !== -99 ? byId.get(p.talkingTo) : null;
      return r && r.sayT > 0 && r.talkingTo === p.id ? r : null;
    }
    /* The step, counted from the one just had, on which talking next needs
       them looked at: when a word owing runs down to nothing (others read
       that), or when they next try to speak. Until then it only counts. */
    function untilTalk(p) {
      if (p.talk > 0) return whole(p.talk) ? p.talk : 1;
      if (S.talk <= 0 || quietTask(p.task)) return p.talk === 0 ? Infinity : 1;
      return p.tryIn >= 1 && whole(p.tryIn) ? p.tryIn : 1;
    }
    /* 1: waiting. A step is only the count. */
    function dozeable(p) {
      return p.wait > 0 && whole(p.wait) && !(p.sayT > 0) && !(p.hit > 0) && p.hp !== -99 &&
        Math.hypot(p.tx - p.x, p.ty - p.y) <= Math.max(paceOf(p), 0.5);
    }
    /* 2: jammed. Measured after the waiting were passed over: at 20,000
       people with bodies as drawn, 74% of all steps were still somebody
       standing in a packed village more than 2.5 squares from the bed, field
       or bench they were walking to (TODO item 7 is the crowding itself).
       Item 1 already remembers their blocked step and the way round that
       could not be found, so such a step changes two counts and nothing
       else: `stuck` goes up by one, and `routeRetry` runs down to the next
       look for a way round, which is refused from memory. It stays so until
       room is made on a square either memory reads — and `madeRoom` is the
       one place that happens. So they are passed over until then, and the
       two counts are put right when they are woken.
       Nearer than 2.5 squares the steps are counted towards giving up, and
       somebody not yet three steps stuck has not looked for a way round:
       both are left to be visited. */
    const RETRY = TK(30), LOOK = TK(12);
    function jamFields(p) {
      if (!(p.mc >= 0) || p.mx !== p.x || p.my !== p.y || p.route !== null || p.hp === -99) return false;
      if (p.sayT > 0 || p.hit > 0) return false;
      if (!(p.routeRetry >= 1 && p.routeRetry <= RETRY && whole(p.routeRetry) && p.stuck >= LOOK && whole(p.stuck))) return false;
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), pace = paceOf(p);
      if (!(d > 2.5 && d > pace) || d < (p.lastDistance ?? Infinity) - 0.1) return false;
      if (p.mdx !== dx / d * pace || p.mdy !== dy / d * pace) return false;
      const m = p.rm;
      return !!m && m.c >= 0 && m.x === p.x && m.y === p.y && m.tx === p.tx && m.ty === p.ty;
    }
    function jammed(p) { return jamFields(p) && quiet(p.x, p.y, p.mc) && stillNoWay(p); }
    /* For the audit: `quiet` without its look across the end of a row. That
       look can only make `quiet` say "work it out again", which gives the
       same answer; here it would be taken for somebody not having been told. */
    function quietNear(p) {
      const fx = Math.floor(p.x), fy = Math.floor(p.y);
      for (let y = Math.max(0, fy - 1); y <= Math.min(rows - 1, fy + 1); y++)
        for (let x = Math.max(0, fx - 1); x <= Math.min(cols - 1, fx + 1); x++) if (roomAt[y * cols + x] > p.mc) return false;
      return true;
    }
    /* Who is to be told when room is made, kept by blocks of four squares a
       side: the squares round them that a blocked step reads, and the ones
       the failed search for a way round looked at. Telling too many is
       harmless — they are visited, find nothing changed, and are passed over
       again — so a block tells everybody on its list and empties it.
       `wg` and `wb` are when and for which blocks somebody last asked, so
       dozing off again in the same spot does not put them on a list twice. */
    const BLOCK = 4, bcols = Math.ceil(cols / BLOCK), brows = Math.ceil(rows / BLOCK);
    /* Two lists a block: [2b] is told when room is made, [2b + 1] when
       anybody moves there at all (for a memory of a search out of tries). */
    const watch = MEMO ? new Array(bcols * brows * 2) : null, firedAt = MEMO ? new Float64Array(bcols * brows * 2) : null;
    let fires = 0;
    function stillWatching(p) {
      const m = p.rm, fx = Math.floor(p.x), fy = Math.floor(p.y);
      const x0 = Math.floor(clamp(Math.min(fx - 1, m.x0), 0, cols - 1) / BLOCK), x1 = Math.floor(clamp(Math.max(fx + 1, m.x1), 0, cols - 1) / BLOCK);
      const y0 = Math.floor(clamp(Math.min(fy - 1, m.y0), 0, rows - 1) / BLOCK), y1 = Math.floor(clamp(Math.max(fy + 1, m.y1), 0, rows - 1) / BLOCK);
      const any = m.any ? 1 : 0;
      if ((((y0 * bcols + x0) * 1024 + (x1 - x0)) * 1024 + (y1 - y0)) * 2 + any !== p.wb) return false;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (firedAt[(y * bcols + x) * 2 + any] > p.wg) return false;
      return true;
    }
    function watchFor(p) {
      const m = p.rm, fx = Math.floor(p.x), fy = Math.floor(p.y);
      const x0 = Math.floor(clamp(Math.min(fx - 1, m.x0), 0, cols - 1) / BLOCK), x1 = Math.floor(clamp(Math.max(fx + 1, m.x1), 0, cols - 1) / BLOCK);
      const y0 = Math.floor(clamp(Math.min(fy - 1, m.y0), 0, rows - 1) / BLOCK), y1 = Math.floor(clamp(Math.max(fy + 1, m.y1), 0, rows - 1) / BLOCK);
      const any = m.any ? 1 : 0;
      const box = (((y0 * bcols + x0) * 1024 + (x1 - x0)) * 1024 + (y1 - y0)) * 2 + any, same = box === p.wb;   // one number for each possible box and list
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const b = (y * bcols + x) * 2 + any;
        if (same && firedAt[b] <= p.wg) continue;       // still on this list from last time
        let list = watch[b]; if (!list) list = watch[b] = [];
        /* A list nobody empties (no room is ever made there) could fill with
           people who have since gone elsewhere. */
        if (list.length >= 2048) {
          const keep = new Set(list.filter(q => kind[q.ix] === 2 && people[q.ix] === q)); list.length = 0; for (const q of keep) list.push(q);
          firedAt[b] = ++fires;      // anybody dropped must ask again, as if it had told them
          if (keep.has(p)) continue;
        }
        list.push(p);
      }
      p.wb = box; p.wg = fires;
    }
    function tell(x, y, arrival) {
      const b = (Math.floor(clamp(y, 0, rows - 1) / BLOCK) * bcols + Math.floor(clamp(x, 0, cols - 1) / BLOCK)) * 2;
      for (let s = arrival ? b + 1 : b; s <= b + 1; s++) {
        const list = watch[s];
        firedAt[s] = ++fires;
        if (!list || !list.length) continue;
        for (let k = 0; k < list.length; k++) { const q = list[k]; if (kind[q.ix] === 2) wakeUp(q); }
        list.length = 0;
      }
    }
    /* Called before anything changes somebody other than the one acting, and
       when room is made beside somebody jammed. People act in the order of
       the array, so one further along has not had this step yet and one
       further back has. */
    function wakeUp(q) {
      const i = q.ix, k = kind[i];
      if (!k || people[i] !== q) return;
      caughtUp(q, i, k, i < cur ? activityTicks : activityTicks - 1);
      kind[i] = 0; wake[i] = 0;
    }
    /* Their counts as they would stand after step `done`. */
    function caughtUp(q, i, k, done) {
      const n = done - since[i];
      if (!(n > 0)) return;
      since[i] = done;
      if (k === 3) { q.sayT -= n; if (q.talk > 0) q.talk = Math.max(0, q.talk - n); return; }
      if (k === 1) q.wait -= n;
      else { q.stuck += n; q.routeRetry = ((q.routeRetry - 1 - n) % RETRY + RETRY) % RETRY + 1; }
      if (q.talk > 0) q.talk -= n;
      else if (S.talk > 0 && !quietTask(q.task)) q.tryIn -= n;
    }
    function wakeAll() {
      for (let i = 0; i < people.length; i++) if (kind[i]) { caughtUp(people[i], i, kind[i], activityTicks); kind[i] = 0; wake[i] = 0; }
    }
    function settle() {
      for (let i = 0; i < people.length; i++) if (kind[i]) caughtUp(people[i], i, kind[i], activityTicks);
    }
    /* What was done to people from outside since the last step: moved, killed,
       sent somewhere, kept waiting. */
    function lookRound() {
      changedHomes();
      for (let i = 0; i < people.length; i++) {
        const p = people[i];
        if (p.ix !== i) p.ix = i;
        if (kind[i] === 1) {
          const h = dozeable(p) ? Math.min(p.wait + 1, untilTalk(p)) : 0;
          if (h > 1) { wake[i] = activityTicks + h; since[i] = activityTicks; } else { kind[i] = 0; wake[i] = 0; }
        }
        if (!p.on) { kind[i] = 0; wake[i] = 0; continue; }
        if (MEMO) {
          /* Moved by something other than a step: the place they left has
             room in it now. */
          if (p.x !== p.ox || p.y !== p.oy) {
            if (p.ox === p.ox) { unputAt(p, cell(p.ox, p.oy)); madeRoom(p.ox, p.oy); }
            p.ox = p.x; p.oy = p.y; put(p); came(p.x, p.y);
          }
          if (p.hp === -99 && p.on !== 2) { madeRoom(p.x, p.y); p.on = 2; }   // killed by something other than `die`
        }
        if (tileAt(p.x, p.y) !== p.bk) shifted.push(p);
      }
      /* Somebody jammed is looked at for what can be changed from outside —
         themselves. Whether room has been made is not read again: the moves
         and deaths above told everybody they could matter to. */
      for (let i = 0; i < people.length; i++) if (kind[i] === 3) {
        /* Between steps both have had the last one; whoever comes later in
           the array will see the other one step further on. */
        const p = people[i], r = inTalk(p), h = r ? untilHeard(p, r, r.ix < i ? r.sayT : r.sayT + 1) : 0;
        if (h > 1) { wake[i] = activityTicks + h; since[i] = activityTicks; } else { kind[i] = 0; wake[i] = 0; }
      }
      if (MEMO) for (let i = 0; i < people.length; i++) if (kind[i] === 2) {
        const h = jamFields(people[i]) ? untilTalk(people[i]) : 0;
        if (h > 1) { wake[i] = activityTicks + h; since[i] = activityTicks; } else { kind[i] = 0; wake[i] = 0; }
      }
    }
    /* For the audit: would somebody passed over as in conversation really
       still be standing listening on step `now`? What each still has to say
       is worked out as it would stand if they had been visited. */
    function stillInTalk(p, now) {
      const r = inTalk(p);
      if (!r) return false;
      const mine = p.sayT - (now - since[p.ix]);
      const theirs = kind[r.ix] === 3 ? r.sayT - ((r.ix < p.ix ? now : now - 1) - since[r.ix]) : r.sayT;
      return mine > 0 && theirs > 0;
    }
    /* For tests: the lists kept up as people move must be the lists a refill
       would make, and nobody passed over may have been changed. */
    function audit() {
      const want = new Map();
      for (const p of people) { const i = tileAt(p.x, p.y); if (!want.has(i)) want.set(i, []); want.get(i).push(p); }
      let listed = 0;
      for (let i = 0; i < tiles; i++) {
        const b = buckets[i]; if (!b || !b.length) continue;
        const w = want.get(i) || [];
        listed += b.length;
        if (b.length !== w.length || b.some((p, k) => p !== w[k])) throw new Error("audit: the list for square " + i + " is not what a refill would make");
      }
      if (listed !== people.length) throw new Error("audit: " + listed + " people listed on squares, " + people.length + " alive");
      /* Somebody passed over as jammed on the strength of a search that ran
         out of tries: search again, and see that it still finds nothing. */
      for (let i = 0; i < people.length; i++) if (kind[i] === 2) auditMemory(people[i]);
      for (let i = 0; i < people.length; i++) if (kind[i] === 2 && people[i].rm.any) {
        const p = people[i];
        if (searchAnyway(p)) throw new Error("audit: " + p.name + " is passed over as having no way round, and has one");
      }
      if (MEMO) {
        let stood = 0;
        for (const key in occ) { const l = occ[key]; if (!l) continue; stood += l.length; for (const p of l) if (cell(p.x, p.y) !== +key || people[p.ix] !== p) throw new Error("audit: " + p.name + " is listed standing where they are not"); }
        const on = people.filter(p => p.on).length;
        if (stood !== on) throw new Error("audit: " + stood + " bodies listed, " + on + " standing");
      }
    }
    let sceneTick = 0, visits = 0;
    function actionTick() {
      sceneTick++;
      cur = 0;                 // nobody has had this step yet
      let fresh = null;
      if (PLAIN) {
        for (const key of occUsed) if (occ[key]) occ[key].length = 0;
        occUsed.length = 0;
        // Reserve existing bodies first. Only a new arrival needs placement; walking
        // already checks every step, so checking every settled body again is wasted work.
        for (const p of people) {
          if (!p.on) { (fresh || (fresh = [])).push(p); continue; }
          if (REAL_BODIES) continue;
          put(p);
        }
      } else if (freshList.length) { fresh = freshList.slice(); freshList.length = 0; }
      if (fresh && fresh.length >= 64 && MEMO) {
        taken = [null]; takenSlot = new Int32Array(cols * rows);
        newBlocks();
        for (const q of people) if (q.on && q.hp !== -99) markTaken(q);
      }
      if (fresh) for (const p of fresh) {
        if (wet(p.x, p.y) || !free(p, p.x, p.y)) {          // nobody stands in the sea or a lake (TODO 4a)
          const x = p.x, y = p.y, fx = Math.floor(x), fy = Math.floor(y), widest = Math.max(cols, rows);
          let shell = -1;
          search: for (let ring = 1; ring < Math.max(cols, rows) * 4; ring++) {
            const r = ring * BODY * 0.5, n = Math.ceil(6.3 * r / BODY) + 1;
            if (!taken) {
              for (let k = 0; k < n; k++) {
                const a = k / n * Math.PI * 2 + p.id;
                const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
                if (!wet(nx, ny) && free(p, nx, ny)) { p.x = nx; p.y = ny; break search; }
              }
              continue;
            }
            /* A crowd arriving together: only the points that could be free
               ("only the points of a ring that could be free", above), in the
               order they were always tried. */
            for (const reach = Math.floor(r + EDGE) + 1; shell < reach && shell < widest;) lookShell(x, y, fx, fy, ++shell, ring);
            const join = startsAt[ring];
            if (join && join.length) { for (let i = 0; i < join.length; i++) reached.push(join[i]); join.length = 0; }
            let kept = 0;                                          // the pieces this ring has gone past leave the list
            for (let i = 0; i < reached.length; i += 5) if (reached[i + 4] >= ring) {
              if (kept !== i) for (let j = 0; j < 5; j++) reached[kept + j] = reached[i + j];
              kept += 5;
            }
            reached.length = kept;
            if (!kept) continue;
            candRoom(n);
            for (let i = 0; i < kept; i += 5) overGround(x, y, n, p.id, reached[i], reached[i + 1], reached[i + 2], reached[i + 3]);
            if (cands.length > 1) cands.sort(byNumber);
            let stood = false;
            for (let c = 0; c < cands.length; c++) {
              const k = cands[c], a = k / n * Math.PI * 2 + p.id;
              const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
              if (takenAt(nx, ny) || wet(nx, ny)) continue;
              if (free(p, nx, ny)) { p.x = nx; p.y = ny; stood = true; break; }
            }
            for (let c = 0; c < cands.length; c++) candAt[cands[c]] = 0;
            cands.length = 0;
            if (stood) break search;
          }
          for (let i = 0; i < startRings.length; i++) startsAt[startRings[i]].length = 0;
          startRings.length = 0; reached.length = 0;
        }
        if (taken) markTaken(p);
        // Initial residents and newborns wait where they actually fit. Sending
        // every new person to the village centre creates an impassable crowd.
        p.tx = p.x; p.ty = p.y;
        p.ox = p.x; p.oy = p.y;
        put(p); p.on = true;
        if (!PLAIN) { shifted.push(p); came(p.x, p.y); }
      }
      taken = null; takenSlot = null; blockFull = null;
      rebucket();
      if (PLAIN) { visits += people.length; for (const p of people) if (p.hp !== -99) act(p); return; }
      if (AUDIT && activityTicks % 12 === 0) audit();   // the lists, five times an hour; the people, every step (below)
      const now = activityTicks;
      for (cur = 0; cur < people.length; cur++) {
        const w = wake[cur];
        if (w > now) {
          if (AUDIT && !(kind[cur] === 1 ? dozeable(people[cur]) : kind[cur] === 3 ? stillInTalk(people[cur], now) : jamFields(people[cur]) && quietNear(people[cur]) && stillNoWay(people[cur]))) { const q = people[cur]; throw new Error("audit: " + q.name + " was changed while passed over, and not woken (" + (kind[cur] === 1 ? "waiting" : kind[cur] === 3 ? "in conversation" : "jammed, quiet " + quietNear(q) + ", no way " + stillNoWay(q)) + "; task " + q.task + ", said " + q.sayT + ", talk " + q.talk + ", hit " + q.hit + ")"); }
          continue;
        }
        const p = people[cur];
        if (w) { caughtUp(p, cur, kind[cur], now - 1); wake[cur] = 0; kind[cur] = 0; }
        visits++;
        if (p.hp !== -99) act(p);
      }
      cur = Infinity;
    }

    const LOCAL_TASK = new Set(["sleep", "rest", "idle", "visit", "field", "home", "make", "patrol"]);
    function act(p) {
      let counted = false;
      if (p.sayT > 0) p.sayT--;
      if (p.hit > 0) p.hit--;
      if (p.talk > 0) p.talk--;
      /* Moving. */
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      /* TODO 4b: slower through forest, marsh, hills, fords, mountains and snow, but not on ground
         a village holds: it has paths, and a whole village walking its streets at the pace of
         open hills jammed round its middle for hours (measured: 43 people stuck over 200 steps
         against 1). */
      const here = tileAt(p.x, p.y), footing = track[here] === 2 ? 1.15 : owner[here] >= 0 || (cross !== null && cross[here] === 3) ? 1 : paceAt(here);
      const pace = WALK * (p.hungry > 30 ? 0.7 : 1) * (p.job === "child" ? 0.8 : 1) * footing * (p.cargo ? cartPace(p, here) : 1);
      const partner = p.sayT > 0 && byId.get(p.talkingTo);
      if (partner && partner.sayT > 0 && partner.talkingTo === p.id) {
        /* 3: in conversation. They stand and listen until one of the two
           has finished speaking, and a step is only that count running down
           (2026-11-15, TODO 2b: once the idle were passed over, one
           person-step in ten at 20,000 people was this). */
        if (!PLAIN && !(p.hit > 0)) {
          /* What the other still has to say, as it stands this moment: if
             they are being passed over too, what they carry is behind. */
          const j = partner.ix, heard = kind[j] === 3 ? partner.sayT - ((j < cur ? activityTicks : activityTicks - 1) - since[j]) : partner.sayT;
          const h = untilHeard(p, partner, heard);
          if (h > 1) { kind[p.ix] = 3; wake[p.ix] = activityTicks + h; since[p.ix] = activityTicks; }
        }
        return;
      }
      if (d > Math.max(pace, 0.5)) {
        if (d < (p.lastDistance ?? Infinity) - 0.1 * footing) { p.lastDistance = d; p.stuck = 0; }
        else p.stuck = (p.stuck || 0) + 1;
        // Preserve the daily engine's nearby arrival rule for local work.
        // Long journeys and all inter-village tasks must physically arrive.
        const localTask = LOCAL_TASK.has(p.task) ||
          ((p.task === "eat" || p.task === "gear") && dist(p, villages[p.home]) <= 2.5);
        if (localTask && d <= 2.5) {
          p.route = null;
          if (p.stuck > TK(25)) {
            const tries = (p.blocked || 0) + 1;
            if (tries > 3) { p.tx = p.x; p.ty = p.y; p.blocked = 0; p.stuck = 0; }
            else { go(p, p.tx, p.ty, p.task); p.blocked = tries; }
          } else move(p, dx / d * pace, dy / d * pace);
        } else if (p.stuck > TK(200) && d <= 2.5) {
          /* A journey that has stood within a stone's throw of its end for
             most of an hour, rerouting and all, has arrived: measured
             2026-11-14, forty carriers aimed at one village's middle jammed
             there for a week, and a fifth of a hard winter's dead were the
             ones they were carrying food to. */
          p.route = null; p.tx = p.x; p.ty = p.y; p.stuck = 0;
        } else {
          if (p.routeRetry > 0) p.routeRetry--;
          if (p.stuck >= TK(12) && !p.route && !p.routeRetry) {
            p.route = routeAround(p); p.routeRetry = TK(30);
          }
          while (p.route?.length && dist(p, p.route[0]) < pace) p.route.shift();
          if (p.route?.length) {
            const q = p.route[0], length = dist(p, q), mx = (q.x - p.x) / length * pace, my = (q.y - p.y) / length * pace;
            if (free(p, p.x + mx, p.y + my)) move(p, mx, my);
            else p.route = null; // The crowd changed; replan after the cooldown.
          } else {
            p.route = null;
            /* Water ahead: the way over the land, square by square (TODO 4b). */
            if (p.way && (p.wx !== p.tx || p.wy !== p.ty)) p.way = null;
            if (!p.way && wet(p.x + dx / d * Math.min(d, 1), p.y + dy / d * Math.min(d, 1))) { p.way = landWay(p); p.wx = p.tx; p.wy = p.ty; }
            if (p.way) {
              /* Beside a big river a waypoint is followed closely, not cut toward the next (TODO 6d). */
              const reach = byBig !== null && byBig[tileAt(p.x, p.y)] ? 0.25 : 0.75;
              /* And reaching one is getting somewhere: a way round a river to its ford can lead away
                 from where they are going for a while, and that is not being stuck. */
              while (p.way.length > 1 && Math.hypot(p.way[0].x - p.x, p.way[0].y - p.y) < reach) { p.way.shift(); if (cross !== null) { p.stuck = 0; p.lastDistance = Infinity; } }
              const w0 = p.way[0], wd = Math.hypot(w0.x - p.x, w0.y - p.y);
              if (p.way.length === 1 && wd < reach) p.way = null;
              if (wd > 1e-9) move(p, (w0.x - p.x) / wd * pace, (w0.y - p.y) / wd * pace);
            } else move(p, dx / d * pace, dy / d * pace);
          }
        }
      }
      else {
        // Shared destinations (markets, fields) are reached from beside a neighbour.
        // Do not require everyone to occupy the exact same target point.
        p.route = null; p.stuck = 0;
        /* Going to bed means into the house, not within 125 m of it: the last
           stretch is walked at the usual pace (TODO 7a). */
        if (p.task === "sleep" && REAL_BODIES && d > 0.006) { const k = Math.min(pace, d) / d; move(p, dx * k, dy * k); return; }
        if (p.wait > 0) { p.wait--; counted = true; } else work(p);
      }

      /* Talking to whoever is standing on the same ground.
         ── when somebody next speaks (2026-11-15, TODO 2b; Ric: "do 2b finish
         2 all the way") ───────────────────────────────────────────────────
         Until then, on every step on which somebody could speak they rolled
         the dice for whether they tried to: the same odds each step. So the
         step on which they next try is a number that can be drawn once — how
         many rolls until the first that comes up — instead of found by
         rolling. The odds of every wait are exactly what they were; what
         changed is which numbers come off the dice, so the same seed is a
         different world from the one it was before this date, with the same
         amount of talking in it (measured: README, "When somebody next
         speaks"). What it buys: between tries there is nothing to do for
         somebody idle, so they can be passed over like anybody else. That
         was one person-step in six at 20,000 people. */
      if (p.talk === 0 && S.talk > 0 && !quietTask(p.task)) {
        if (!(p.tryIn >= 1)) p.tryIn = nextTry();
        if (--p.tryIn === 0) {
          const b = bucketAt(tileAt(p.x, p.y));
          if (b.length > 1) {
            const q = b[Math.floor(R() * b.length)];
            if (q !== p && q.sayT <= 0 && q.talk === 0 && q.hp > 0 && q.age > 4 && p.age > 4 && q.task !== "sleep") converse(p, q);
          }
          p.tryIn = nextTry();
        }
      }
      if (PLAIN) return;
      /* Nothing to do but count until the wait is up: not visited until then. */
      if (counted) {
        if (p.wait > 0 && whole(p.wait) && !(p.sayT > 0) && !(p.hit > 0)) {
          const h = Math.min(p.wait + 1, untilTalk(p));
          if (h > 1) { kind[p.ix] = 1; wake[p.ix] = activityTicks + h; since[p.ix] = activityTicks; }
        }
      /* Jammed, with nothing to do but stand until room is made. */
      } else if (MEMO && p.mc >= 0 && p.route === null && p.stuck >= LOOK && jamFields(p)) {
        const h = untilTalk(p);
        /* Somebody woken only to try a word is still on every list they
           were on if none of those has told anybody since — and then no
           room has been made on their ground either, and none of it need be
           read again. */
        if (h > 1 && (stillWatching(p) || (quiet(p.x, p.y, p.mc) && stillNoWay(p) && (watchFor(p), true)))) {
          kind[p.ix] = 2; wake[p.ix] = activityTicks + h; since[p.ix] = activityTicks;
        }
      }
    }

    /* ── slower things: every six simulated hours per person ─────────────────── */
    function reflect(p) {
      if (p.fade !== null) settle(p);   // TODO 10: hard times wearing off (a plain check first: calling it for everybody cost 8% of a 5,000-person world)
      const v = villages[p.home], f = factions[p.f];
      const anyWar = Object.keys(f.rel).some(k => f.rel[k].war);
      const friendsHere = circle(p);
      const want = (p.hungry > 0 ? 0 : 0.45) + (p.goods > 0.1 ? 0.12 : 0) + Math.min(0.15, friendsHere * 0.03) +
                   (anyWar ? 0 : 0.1) + (p.partner ? 0.08 : 0) + (0.1 - taxOf(v) * 0.25) - (p.sick > 0 ? 0.2 : 0);
      p.mood += (clamp(want, 0, 1) - p.mood) * 0.15;
      p.mood = clamp(p.mood, 0, 1);
      /* Loyalty follows how life is going, how far the leader's mind is from
         theirs, and whether this flag was ever theirs. */
      const lead = byId.get(f.leader);
      const far = lead ? Math.abs(viewOf(p) - viewOf(lead)) : 0.5;
      const wantLoyal = p.mood * 0.85 + (S.loyalty - 0.5) * 0.7 + 0.2 - far * 0.22 - taxOf(v) * 0.4 -
                        (p.from !== p.f ? 0.18 : 0) - Math.min(0.3, p.unpaid * 0.06);
      p.loyal += (clamp(wantLoyal, 0, 1) - p.loyal) * 0.05;

      if (!adult(p)) return;
      /* Wages. */
      if (p.job === "soldier" && !shared && t % DAY_HOURS === 0) {
        if (f.treasury >= WAGE) { f.treasury -= WAGE; p.coins += WAGE; p.unpaid = Math.max(0, p.unpaid - 1); }
        else if (++p.unpaid > 6 && !anyWar) { p.job = "farmer"; p.unpaid = 0; p.task = "idle"; }
      }
      if (lead === p && !shared && t % DAY_HOURS === 0 && f.treasury >= 0.3) { f.treasury -= 0.3; p.coins += 0.3; }
      /* Starving people do something about it: steal if they are bold, and
         go somewhere better if there is somewhere. */
      /* Nobody keeps making pots while they starve. */
      if (p.hungry > 10 && (p.job === "crafter" || (p.job === "trader" && !p.cargo))) { p.job = "farmer"; p.task = "idle"; }
      if (p.hungry > 25) {
        if (p.bold > 0.6 && R() < 0.6 * (1 - p.honest)) {   // TODO 10: 0.3 at an ordinary honesty
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
          const rum = rumours(p);
          for (const o of villages) {
            if (!o.alive || o === v || atWar(o.f, p.f) || dist(p, o) > 18) continue;
            if (rum && (heardSick.includes(o.id) || heardFamine.includes(o.id))) continue;
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
        const room = clamp(1.6 - v.pop / (crowdOf(v) * 1.6), 0.15, 1) * (v.hungry > v.pop * 0.15 ? 0.3 : 1);
        /* This is a rate per calendar year, scaled to the six-hour reflection
           cadence. Changing update frequency must not multiply fertility.
           Short-lived settings still compress their reproductive span. */
        const span = Math.max(3, S.life * 0.7 - S.grown);
        if (R() < S.births * 14 * (REFLECT_HOURS / YEAR) * room / span / (1 + p.kids * 0.12)) {
          const c = newPerson(v, 0, p, mate);
          c.x = p.x; c.y = p.y; c.from = p.f; c.f = p.f;
          p.kids++; mate.kids++; count.births++;
          p.say = c.name + " was born today."; p.sayT = 90;
        }
      }
      /* Now and then, think again about what to do for a living. */
      if (R() < 1 - Math.pow(0.97, 10 * REFLECT_HOURS / YEAR) && p.job !== "soldier" && !p.cargo && p.id !== f.leader) {
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
      if (MATS) {
        /* What the village wants of each (TODO 9a): its houses being built, what its crafters work, its gear. */
        let need = 0; for (const h of sites) if (h.v === v.id && !h.built) need += Math.max(0, h.goodsNeed - h.goodsIn);
        v.wantWood = need * 0.8 + v.pop * 0.3 + 2; v.wantStone = need * 0.2 + v.pop * 0.08 + 1; v.wantIron = v.pop * 0.1 + 1;
        v.wantWool = v.pop * 0.08 + 1; v.wantHide = v.pop * 0.04 + 1;   // TODO 9b: clothes, packs, shields
        if (FIRE && matGround(v).wood.length) v.wantWood += v.pop * BURN * (chill() * 30 + winterAhead());   // TODO 9c: the winter's fires
        if (S.prices === "float" && !shared) {
          v.priceWood = clamp(Math.pow(v.wantWood / Math.max(v.wood, 0.3), 0.5), 0.3, 6);
          v.priceStone = clamp(Math.pow(v.wantStone / Math.max(v.stone, 0.3), 0.5), 0.3, 6);
          v.priceIron = clamp(2 * Math.pow(v.wantIron / Math.max(v.iron, 0.3), 0.5), 0.6, 9);
          v.priceWool = clamp(1.5 * Math.pow(v.wantWool / Math.max(v.wool, 0.3), 0.5), 0.4, 7);
          v.priceHide = clamp(1.5 * Math.pow(v.wantHide / Math.max(v.hide, 0.3), 0.5), 0.4, 7);
        } else { v.priceWood = 1; v.priceStone = 1; v.priceIron = 2; v.priceWool = 1.5; v.priceHide = 1.5; }
      }
    }
    function villageTurn(v) {
      if (v.pop === 0) {
        /* Everybody fled (TODO 14b): the place stands while its own wait to come back, and they
           come back a week after the last enemy left its edge. */
        const waiting = v.gone && v.gone.some(id => { const q = byId.get(id); return q && q.hp > 0 && q.fledFrom === v.id && q.f === v.f; });
        if (waiting) { v.foes = foesAt(v); if (v.foes > 0) v.dangerAt = t; else if (t - v.dangerAt > 7 * DAY_HOURS) comeHome(v); }
        if (++v.empty > 6 && !waiting) {
          v.alive = false;
          note("gone", v.name + " stands empty.", 2, v.x, v.y, v.f);
          const f = factions[v.f];
          f.treasury += v.till; v.till = 0;
          if (!villages.some(o => o.alive && o.f === v.f)) fall(f, -1);
        }
        return;
      }
      v.empty = 0;
      /* A raid here since yesterday, or a year gone by without want or raids (TODO 10). */
      const yr = Math.floor(t / YEAR);
      if (v.raidAt > v.raidSeen || v.yearSeen !== yr) {
        /* Fighting here after a month of none is a raid; fighting that goes on, day after day of a
           siege, is the same raid and not thirty of them. `raidSeen` is the last blow looked at. */
        const raided = v.raidAt > v.raidSeen && v.raidAt - v.raidSeen >= 30 * DAY_HOURS, looked = v.yearSeen;
        if (v.raidAt > v.raidSeen) v.raidSeen = v.raidAt;
        if (raided) count.raids++;
        v.yearSeen = yr;
        const good = looked !== undefined && looked === yr - 1 && v.raidAt < (yr - 1) * YEAR;
        if (raided || good) for (const q of (PLAIN ? people : residents(v.id))) {
          if (q.home !== v.id || q.hp <= 0) continue;
          if (raided) shaken(q, LIFE.raid);
          if (good && q.leanYr !== yr - 1) shaken(q, LIFE.good);
        }
      }
      if (FIRE) {
        /* A day's fires (TODO 9c). */
        /* Where there is no forest within reach, dung, turf and peat, as on treeless land: no wood burned. */
        const burn = matGround(v).wood.length ? v.pop * BURN * chill() : 0;
        if (burn > 0) { const got = Math.min(v.wood, burn); v.wood -= got; v.cold = 1 - got / burn; } else v.cold = 0;
      }
      /* What was brought in today, into a month's average; and what the place is by its size (TODO 8). */
      v.importAvg = (v.importAvg || 0) * (179 / 180) + (v.inFood || 0) / 180; v.inFood = 0;   // over about half a year: a town lives on a harvest
      placeOf(v);
      /* Where its people take food to sell (TODO 8): the biggest place within 10 km, at peace,
         at least half as big again as this one, with under three days' food a head in store and its
         households going short (on 2026-11-17 a starting city's store was empty all year, and so
         were its villages', so a price read from the store said nothing; its households were short
         10,000 days with 7,000 coins to pay). */
      v.marketTo = -1; let mb = 0;
      for (const o of villages) {
        if (!o.alive || o === v || o.pop < v.pop * 1.5 || o.food > o.pop * 3 || (o.short || 0) < o.pop * 2 || (o.f !== v.f && atWar(o.f, v.f))) continue;
        const d = Math.hypot(o.x - v.x, o.y - v.y); if (d > 40) continue;
        const sc = o.pop / (1 + d * 0.05); if (sc > mb) { mb = sc; v.marketTo = o.id; }
      }
      /* Sickness starts in one person. */
      const odds = S.plague === "none" ? 0 : S.plague === "rare" ? 0.004 : 0.02;
      if (v.sick === 0 && R() < odds) {
        const here = people.filter(p => p.home === v.id && !p.immune);
        if (here.length > 8) { pick(here).sick = ILLNESS_HOURS; count.infected++; note("sick", "A sickness has started in " + v.name + ".", 2, v.x, v.y, v.f); }
      }
      if (v.hungry > v.pop * 0.4 && v.pop > 8 && (!v.famine || t - v.famine >= 30 * DAY_HOURS)) {
        v.famine = t; note("famine", v.name + " is starving.", 2.5, v.x, v.y, v.f);
      }
      /* Word that food is dear (TODO 12b): one household in seven going hungry with money to pay, not
         in the first month (everybody is hungry on the first day, walking home), not while the place
         is starving (that is its own news), and at most one a faction every four months. Read off
         households short of a fortnight's food it came every day from the start, and at one a village
         every two months it was as much news as everything else together, crowding the rest out
         (the newest is what is told). */
      if (!shared && t > 30 * DAY_HOURS && v.pop > 8 && v.hungry > v.pop * 0.15 && (v.purse || 0) > v.pop && t - v.dearAt >= 90 * DAY_HOURS && t - factions[v.f].dearAt >= 120 * DAY_HOURS && !(v.famine && t - v.famine < 30 * DAY_HOURS)) {
        v.dearAt = t; factions[v.f].dearAt = t; note("dear", "Food is dear in " + v.name + ".", 1.5, v.x, v.y, v.f);
      }
      /* Under the walls: soldiers of a faction at war with this one, and
         nobody of ours near enough to stop them. */
      let ours = 0; const theirs = {}, foesHere = [];
      const k = 3;
      for (let y = Math.max(0, Math.floor(v.y) - k); y <= Math.min(rows - 1, Math.floor(v.y) + k); y++)
        for (let x = Math.max(0, Math.floor(v.x) - k); x <= Math.min(cols - 1, Math.floor(v.x) + k); x++)
          for (const p of bucketAt(y * cols + x)) {
            if (p.job !== "soldier") continue;
            if (p.f === v.f) ours++; else if (atWar(p.f, v.f)) { theirs[p.f] = (theirs[p.f] || 0) + 1; foesHere.push(p); }
          }
      /* A village defends itself: a quarter of its grown-ups take up arms
         behind its walls, besides any soldiers near. Besiegers make headway
         only while they outnumber all of that by a fifth, and a bigger place
         holds out longer — four days, and a day more for every fifteen who
         live there. Until 2026-11-14 a village with no soldier near it fell in
         four days, and a world's wars were won, lost and over in a month. */
      const sides = Object.keys(theirs);
      const attackers = sides.reduce((m, k) => Math.max(m, theirs[k]), 0), defence = ours + v.adults * 0.25;
      v.foes = attackers;
      /* What an army does where it stands (TODO 14b): spoils the crops, burns what it can, takes
         the food; and people run from it, and come home when it has gone. */
      /* Houses burn only while the enemy has the upper hand by the siege's own measure (more of
         them than the place's soldiers and the grown-ups who take up arms), and households run
         only from a siege. Measured first with "more of them than our soldiers" for both: a
         default year starved 89 against 47, and 28 villages were taken against 11, as households
         left at the first raider and the place emptied of defenders. */
      if (attackers > 0) { v.dangerAt = t; ravage(v, foesHere, attackers > defence); }
      if (v.sick > 0 && v.gone) v.dangerAt = t;   // those who left for a sickness wait a week past it (TODO 12b)
      if (v.siege > 0) flee(v);
      else if (v.gone && t - v.dangerAt > 7 * DAY_HOURS) comeHome(v);
      if (sides.length && attackers > defence * 1.2) {
        v.siege += 1;
        if (v.siege >= 4 + Math.floor(v.pop / 15)) { sides.sort((a, b) => theirs[b] - theirs[a]); capture(v, factions[+sides[0]], foesHere); }
      } else v.siege = Math.max(0, v.siege - 1);

      /* Too full: some of them go and start somewhere new, if there is land. */
      if (v.pop > crowdOf(v) && R() < 0.25) found(v);
      /* Land hunger: a village whose fields feed fewer than two a head, with
         good land open within reach, sends its bolder families out to break
         new ground — the way farming peoples spread, long before any village
         was full by a count. found() takes them, and goes nowhere if there is
         no such land; that is felt as cramped, and a reason to fight. */
      else if (v.pop >= 16 && (v.feeds || 0) / Math.max(1, v.pop) < 2 && R() < 0.03) found(v);
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
        /* And water: a place a long walk from any is worth less to those who would carry it (TODO 6a). */
        if (THIRST) { const d = freshDist[tileAt(x, y)]; s *= d <= FAR ? 1 : d <= 2 * FAR ? 0.85 : 0.6; }
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
        if (f.rule === "elected") vote(f, false);
        else {
          const next = here.filter(p => p !== old).sort((a, b) => (b.bold + circle(b) * 0.1) - (a.bold + circle(a) * 0.1))[0];
          if (!next) return;
          f.leader = next.id; f.views = viewOf(next);
          note("coup", next.name + " has thrown " + (old ? old.name : "the old leader") + " out and taken " + f.name + ".", 3.5, v.x, v.y, f.id);
          for (const p of people) if (p.f === f.id) p.loyal = clamp(p.loyal + 0.2 - Math.abs(viewOf(p) - viewOf(next)) * 0.15, 0, 1);
        }
        return;
      }
      if (!villages.some(o => o.alive && o.f === v.f && o !== v)) return;
      const rebels = here.filter(p => p.loyal < 0.5);
      if (rebels.length < 6) return;
      const head = rebels.slice().sort((a, b) => (b.bold + circle(b) * 0.1) - (a.bold + circle(a) * 0.1))[0];
      const names = new Set(factions.map(o => o.name));
      let name; do { name = R() < 0.5 ? "Free " + v.name : pick(F_FIRST) + " " + pick(F_LAST); } while (names.has(name) && names.size < 150);
      const nf = newFaction(name, viewOf(head));
      nf.treasury = 0; nf.tax = Math.min(f.tax, S.tax); nf.leader = head.id; nf.rule = f.rule === "elected" ? "elected" : "chief";
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

    /* ── what a war leaves (TODO 14b, 2026-11-19) ──────────────────────────
       Armies lived off the land they marched through and wrecked what they could not use: crops
       cut, trampled or burned, houses burned, stores taken (the chevauchée; Hanson: grain burns
       only while it stands ripe and dry, green grain is trampled or cut, slowly). People ran to
       the nearest walls and came back when the army had gone (Jean de Venette; Wright). None of
       it is scripted: it happens only where enemy soldiers stand at a village's edge. */
    /* Enemy soldiers at the edge of a village nobody is left in (the daily count in
       `villageTurn` does the same for one that is lived in). */
    function foesAt(v) {
      let n = 0;
      for (let y = Math.max(0, Math.floor(v.y) - 3); y <= Math.min(rows - 1, Math.floor(v.y) + 3); y++)
        for (let x = Math.max(0, Math.floor(v.x) - 3); x <= Math.min(cols - 1, Math.floor(v.x) + 3); x++)
          for (const p of bucketAt(y * cols + x)) if (p.job === "soldier" && atWar(p.f, v.f)) n++;
      return n;
    }
    function ravage(v, foes, winning) {
      const ripe = (season().ripe - 1) / 3, share = 0.1 + 0.5 * ripe;   // of what stands, a day, on a soldier's square and the eight round it
      for (const p of foes) {
        const fx = Math.floor(p.x), fy = Math.floor(p.y);
        for (let k = 0; k < 9; k++) {
          const x = fx + PATCH[k][0], y = fy + PATCH[k][1];
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const i = y * cols + x, lost = stock[i] * share;
          stock[i] -= lost; count.spoiled += lost;
        }
      }
      /* While they have the upper hand at the edge of the place, a house burns for about every
         ten of them a day, the outermost first; what was in it is taken or lost. */
      if (!winning) return;
      let n = Math.floor(foes.length / 10 + R());
      if (n <= 0) return;
      const mine = homes.filter(h => h.v === v.id && h.built).sort((a, b) => Math.hypot(b.x - v.x, b.y - v.y) - Math.hypot(a.x - v.x, a.y - v.y));
      let loot = 0;
      for (const h of mine) { if (n-- <= 0) break; loot += burnHouse(v, h); }
      for (const p of foes) { if (loot <= 0) break; const take = Math.min(loot, Math.max(0, 10 - p.food)); p.food += take; loot -= take; }
    }
    /* A house burned: its household lose half of what they had in it, sleep in the ruin, and
       must build it again (TODO 7b's building, from nothing). Returns the food taken. */
    function burnHouse(v, h) {
      h.built = false; h.work = 0; h.goodsIn = 0; h.paid = false; h.water = 0; h.taken = false; h.burned = t;
      h.need = Math.round(floor(h) * 2); h.goodsNeed = Math.round(6 + floor(h) / 20);
      if (!sites.includes(h)) sites.push(h);
      let food = 0, head = null;
      for (const q of PLAIN ? people : residents(v.id)) {
        if (q.hp <= 0 || q.dwelling !== h.id) continue;
        food += q.food * 0.5; q.food *= 0.5;
        if (adult(q) && (!head || q.id === h.head)) head = q;
      }
      h.owner = head ? head.id : 0;
      if (head) head.waitHouse = h.id;
      count.burned++;
      return food;
    }
    /* A place taken by storm is sacked: half its store taken or spoiled, a quarter of its houses burned. */
    function sack(v) {
      v.food *= 0.5;
      const mine = homes.filter(h => h.v === v.id && h.built);
      for (let n = Math.round(mine.length / 4); n > 0 && mine.length; n--) burnHouse(v, mine.splice(Math.floor(R() * mine.length), 1)[0]);
      count.sacked++;
    }
    /* Running from an army: a household at a time, the frightened and the less bold first, to the
       nearest village of their own faction with no enemy at it. Soldiers and the leader stay. */
    function flee(v) {
      let refuge = null, best = Infinity;
      for (const o of villages) if (o.alive && o !== v && o.f === v.f && o.siege === 0 && o.foes === 0) { const d = Math.hypot(o.x - v.x, o.y - v.y); if (d < best) { best = d; refuge = o; } }
      if (!refuge) return;
      const lead = factions[v.f].leader;
      for (const p of (PLAIN ? people : residents(v.id)).slice()) {
        if (p.home !== v.id || p.hp <= 0 || !adult(p) || p.job === "soldier" || p.id === lead || p.fear < 0.6) continue;
        if (R() > 0.25 * (1.2 - p.bold)) continue;
        const mate = byId.get(p.partner), us = [p];
        if (mate && mate.hp > 0 && mate.home === v.id && mate.job !== "soldier" && mate.id !== lead) us.push(mate);
        for (const q of PLAIN ? people : residents(v.id)) if (q.hp > 0 && !adult(q) && q.home === v.id && us.some(a => q.mum === a.id || q.dad === a.id || q.carer === a.id)) us.push(q);
        for (const q of us) { q.fledFrom = v.id; rehome(q, refuge, "fled"); (v.gone || (v.gone = [])).push(q.id); count.refugees++; }
      }
    }
    /* Home again, a week after the last enemy left — if it is still their own faction's. */
    function comeHome(v) {
      const back = v.gone.map(id => byId.get(id)).filter(q => q && q.hp > 0 && q.fledFrom === v.id);
      v.gone = null;
      back.sort((a, b) => (adult(b) ? 1 : 0) - (adult(a) ? 1 : 0));   // grown-ups first, so the children follow them into a house
      for (const q of back) {
        q.fledFrom = -1;
        if (q.f !== v.f || (!adult(q) && !back.some(a => adult(a) && (q.mum === a.id || q.dad === a.id || q.carer === a.id)))) continue;
        rehome(q, v, "home"); count.cameHome++;
      }
    }

    function capture(v, by, foes) {
      const old = factions[v.f];
      const refuge = villages.filter(o => o.alive && o.f === old.id && o !== v).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
      v.f = by.id; v.siege = 0; v.broke = t;
      sack(v);
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
      /* Held (TODO 14c): half of the soldiers who took it stay as its garrison for a year, as the
         English held Normandy town by town (Curry). Until 2026-11-19 they all marched on, and the
         place was taken back the next week: 131 times in six worlds' two years of war. */
      if (foes) {
        const ours = foes.filter(p => p.f === by.id && p.hp > 0 && p.job === "soldier");
        for (let k = 0; k < Math.ceil(ours.length / 2); k++) rehome(ours[k], v, "garrison");
        if (ours.length) { v.heldTo = t + YEAR; count.garrisons++; }
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
      warMoves++;
      const heir = to >= 0 ? factions[to] : factions.filter(o => o.alive).sort((a, b) => b.pop - a.pop)[0];
      if (heir) heir.treasury += f.treasury;
      f.treasury = 0;
      for (const p of people) if (p.f === f.id && heir) {
        const v = villages.filter(o => o.alive && o.f === heir.id).sort((a, b) => dist(p, a) - dist(p, b))[0];
        if (!v) continue;
        if (p.job === "soldier") p.job = "farmer";
        p.f = heir.id; p.home = v.id; p.at = v.id; p.loyal = 0.2; p.task = "idle"; p.cargo = null; count.switched++; changedHomes();
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
    /* Overthrowing a regime. A faction ruled by a chief or by the rich, whose
       grown-ups have mostly turned on it, falls when those who have turned
       outnumber the soldiers still loyal to it by two to one — a civil war,
       fought between them, and a new way of choosing leaders after it. It
       runs only on people's own loyalty and the soldiers' own; nothing here is
       on a timer, and a regime people still put up with is never touched.
       (Ric, 2026-11-14: "what if a system of who has the most money gets
       overthrown by a civil war?") */
    function revolution(f) {
      if (f.yours || f.rule === "elected" || t - f.revolt < YEAR * 3) return false;
      const grown = people.filter(p => p.f === f.id && adult(p) && p.hp > 0);
      if (grown.length < 12) return false;
      const angry = grown.filter(p => p.loyal < 0.3 && p.job !== "soldier");
      const guard = grown.filter(p => p.job === "soldier" && p.loyal >= 0.35);
      if (angry.length < grown.length * 0.45 || angry.length < guard.length * 2) return false;
      f.revolt = t;
      /* The fighting: as many fall on each side as the smaller side can make fall. */
      const fall = Math.min(guard.length, Math.ceil(angry.length * 0.15));
      const order = (a, b) => a.id - b.id;
      guard.sort(order).slice(0, fall).forEach(p => die(p, "battle"));
      angry.sort(order).slice(0, Math.ceil(fall * 0.7)).forEach(p => die(p, "battle"));
      const alive = angry.filter(p => p.hp !== -99);
      const head = alive.sort((a, b) => (b.bold + circle(b) * 0.1) - (a.bold + circle(a) * 0.1))[0];
      if (!head) return false;
      const was = f.rule, wasLead = byId.get(f.leader);
      /* What they replace it with is their own leaning: a people who believe
         in sharing vote; one that does not follows the one who led them. */
      const lean = alive.reduce((s, p) => s + viewOf(p), 0) / alive.length;
      f.rule = lean > -0.15 ? "elected" : "chief";
      f.leader = head.id; f.views = viewOf(head); f.voteAt = t + S.term * YEAR;
      for (const p of people) if (p.f === f.id) p.loyal = clamp(p.loyal + (p.loyal < 0.3 ? 0.35 : -0.1), 0, 1);
      const v = villages[head.home];
      count.revolutions = (count.revolutions || 0) + 1;
      note("revolution", "A civil war in " + f.name + ": the " + (was === "rich" ? "rule of the rich" : "chief") +
           (wasLead ? ", " + wasLead.name + "," : "") + " has been overthrown. " + head.name + " leads now, and " +
           (f.rule === "elected" ? "they will choose their leaders by vote." : "rules as chief."), 4.5, v.x, v.y, f.id);
      return true;
    }
    /* ── dealing with each other (TODO 13) ─────────────────────────────────
       How the factions start: old friends allied and trading free of tax, old enemies with a feud
       every grown-up grew up knowing. */
    function startNeighbours() {
      if (S.neighbours === "strangers" || factions.length < 2) return;
      for (const f of factions) for (const o of factions) if (f !== o) {
        const r = f.rel[o.id];
        if (S.neighbours === "enemies") { r.bond = -1; r.op = -0.6; r.grief = 0.4; }
        else { r.bond = 0.8; r.op = 0.5; r.ally = true; r.trade = S.money === "coins"; }
      }
      if (S.neighbours !== "enemies") return;
      const WRONGS = [(a, b, v) => a.name + " burned " + v.name + " in their grandparents' time, and " + b.name + " has not forgotten it.",
                      (a, b, v) => "In the old days " + a.name + " drove " + b.name + " from the fields of " + v.name + " and killed 12 of them.",
                      (a, b, v) => a.name + " stole " + b.name + "'s herds and women from " + v.name + ", long ago."];
      for (let i = 0; i < factions.length; i++) for (let j = i + 1; j < factions.length; j++) {
        const a = R() < 0.5 ? factions[i] : factions[j], b = a === factions[i] ? factions[j] : factions[i];
        const v = villages.find(x => x.f === b.id) || villages[0];
        const e = note("feud", pick(WRONGS)(a, b, v), 4.5, v.x, v.y, b.id);   // weighty, so the record keeps it
        lasting.add(e.id);   // an old feud is held as long as a grudge, and kept before other news
        for (const p of people) if ((p.f === a.id || p.f === b.id) && adult(p)) heard(p, M_NEWS, e.id, 0.7 + R() * 0.3, -2, 0);
      }
    }
    /* A leader's own nature, as it shows in what the faction does: in full for a chief or the
       richest, half of it for a leader the people can vote out (a leader's character weighs
       most where nobody can check it; Horowitz, Stam and Ellis, Why Leaders Fight, 2015). */
    function ruling(lead, k, f) { return f.rule === "elected" ? 0.5 + (lead[k] - 0.5) * 0.5 : lead[k]; }
    /* What a leader holds against another faction: grudges against its people, less any close
       friend there, and news they hold of wars, villages taken and old feuds between the two, as
       they hold it — a wrong telling names the wrong side. */
    function heldAgainst(p, o) {
      if (p.mb < 0) return 0;
      const mine = factions[p.f];
      let s = 0;
      const o0 = p.mb * MB + 1, o1 = o0 + p.mcap;
      for (let k = o0; k < o1; k++) {
        const kind = mKind[k];
        if (kind === M_FRIEND || kind === M_KIN) {
          const x = mNow(k); if (x > -0.2 && x < 0.5) continue;
          const q = byId.get(mAbout[k]); if (q && q.f === o.id) s += x < 0 ? -x * 0.5 : -x * 0.3;
        } else if (kind === M_NEWS) {
          const e = eventById(mAbout[k]);
          if (!e || (e.kind !== "war" && e.kind !== "taken" && e.kind !== "feud")) continue;
          const w = telling(e, mVar[k]);
          if (w.includes(o.name) && w.includes(mine.name)) s += 0.4 * mNow(k);
        }
      }
      return clamp(s, -0.5, 1.5);
    }
    /* Is this leader to blame for the war with o (TODO 14c)? Whoever led when it began, or their
       parent, child or partner: the "culpable" leader of Croco's Decider's Dilemma (2011), who fears
       being punished for a bad end and fights on; anybody else can accept a compromise. */
    function culpable(lead, rel) {
      if (!lead || !rel.began) return false;
      if (lead.id === rel.began || lead.mum === rel.began || lead.dad === rel.began || lead.partner === rel.began) return true;
      const b = byId.get(rel.began);
      return !!b && (b.mum === lead.id || b.dad === lead.id);
    }
    /* What the people of f hold against o: the mean, over thirty grown-ups spread evenly through
       the list of people, of what each holds (`heldAgainst`). No dice drawn, so reading it changes
       nothing. */
    function folk(f, o) {
      if (!f.adults) return 0;
      const step = Math.max(1, Math.floor(f.adults / 30));   // about thirty of theirs in a pass, as f.adults of people.length are theirs
      let n = 0, sum = 0;
      for (let i = (f.id * 7) % step; i < people.length && n < 30; i += step) {
        const p = people[i];
        if (p.hp <= 0 || p.f !== f.id || !adult(p)) continue;
        sum += heldAgainst(p, o); n++;
      }
      return n ? sum / n : 0;
    }
    /* How strong a faction looks to a neighbour: its soldiers and grown-ups, and half its allies'. */
    function might(f, not) {
      let m = f.soldiers + f.adults * 0.15;
      for (const a of factions) if (a.alive && a !== f && a !== not && f.rel[a.id].ally) m += (a.soldiers + a.adults * 0.15) * 0.5;
      return m;
    }
    function relDeals(r, b) { r.ally = b.ally = false; r.trade = b.trade = false; r.pays = b.pays = false; }
    /* A war, and the defender's allies called to it: each comes as their leader is bold and as
       they like the defender, or the alliance is over. */
    function startWar(f, o, text) {
      const rel = f.rel[o.id], back = o.rel[f.id], b = border(f, o);
      warMoves++; rel.war = back.war = true; rel.since = back.since = t; rel.dead = back.dead = 0; relDeals(rel, back);
      rel.began = f.leader; back.began = o.leader;
      if (b.pair) { f.target[o.id] = b.pair[1].id; o.target[f.id] = b.pair[0].id; }
      count.wars++;
      note("war", text, 4, b.pair ? b.pair[1].x : 0, b.pair ? b.pair[1].y : 0, f.id);
      for (const a of factions) {
        if (!a.alive || a === f || a === o || !a.rel[o.id].ally || a.rel[f.id].war) continue;
        const al = byId.get(a.leader), r2 = a.rel[f.id], b2 = f.rel[a.id], bb = border(a, f), at = bb.pair ? bb.pair[0] : { x: 0, y: 0 };
        if (a.yours || (al && R() < 0.35 + al.bold * 0.4 + a.rel[o.id].op * 0.3 - Math.max(0, r2.op) * 0.3)) {
          if (a.yours) { note("ally", a.name + " is allied to " + o.name + ", now at war with " + f.name + ": it is yours to answer.", 2.5, at.x, at.y, a.id); continue; }
          warMoves++; r2.war = b2.war = true; r2.since = b2.since = t; r2.dead = b2.dead = 0; relDeals(r2, b2);
          r2.began = a.leader; b2.began = f.leader;
          if (bb.pair) { a.target[f.id] = bb.pair[1].id; f.target[a.id] = bb.pair[0].id; }
          count.wars++; count.joined++;
          note("war", a.name + " has joined the war on " + o.name + "'s side, against " + f.name + ".", 3.5, at.x, at.y, a.id);
        } else {
          a.rel[o.id].ally = o.rel[a.id].ally = false;
          o.rel[a.id].op = clamp(o.rel[a.id].op - 0.4, -1, 1); o.rel[a.id].bond = clamp(o.rel[a.id].bond - 0.3, -1, 1);
          note("ally", a.name + " has left its ally " + o.name + " to fight " + f.name + " alone.", 2.5, at.x, at.y, a.id);
        }
      }
    }
    /* A demand: pay, or there will be war. The other side pays if it is outmatched and its leader
       is neither bold nor hot-tempered enough to refuse; a refusal is an insult. */
    function demand(f, o, why) {
      const rel = f.rel[o.id], back = o.rel[f.id], b = border(f, o), at = b.pair ? b.pair[1] : { x: 0, y: 0 };
      rel.askedAt = t; count.demands++;
      const ol = byId.get(o.leader), dare = ol ? (ruling(ol, "temper", o) + ol.bold) / 2 : 0.5;
      if (might(o, f) < might(f, o) * (1.15 - dare * 0.7)) {
        back.pays = true; count.tributes++;
        back.op = clamp(back.op - 0.15, -1, 1);
        note("tribute", o.name + " has agreed to pay tribute to " + f.name + (why ? ", " + why : "") + ", rather than fight.", 3, at.x, at.y, f.id);
        return "paid";
      }
      count.refusals++;
      rel.grief = clamp(rel.grief + 0.3, 0, 3); back.op = clamp(back.op - 0.2, -1, 1);
      note("threat", f.name + " demanded tribute of " + o.name + (why ? ", " + why : "") + "; " + (ol ? ol.name : o.name) + " refused.", 2.5, at.x, at.y, f.id);
      return "refused";
    }
    /* Would o's leader take an alliance or a trade deal f offers? */
    function wouldAlly(o, f) { const ol = byId.get(o.leader), r = o.rel[f.id]; return !r.war && !r.pays && !f.rel[o.id].pays && r.op > 0.25 - (ol ? ol.warm - 0.5 : 0) * 0.3; }
    function wouldTrade(o, f) { const ol = byId.get(o.leader), r = o.rel[f.id]; return !shared && !r.war && r.op > 0.1 - (ol ? ol.honest - 0.5 : 0) * 0.2; }
    /* Each day, one faction's dealings with each of the others. */
    function deal(f, o, lead, b) {
      const rel = f.rel[o.id], back = o.rel[f.id], at = b.pair ? b.pair[0] : { x: 0, y: 0 };
      /* Tribute: a share of the stores and the treasury, every day, carried to the nearest of
         theirs. The payer resents it; it stops when they feel strong enough, or are led by
         somebody who dares. */
      if (rel.pays) {
        const to = b.pair ? b.pair[1] : villages.find(v => v.alive && v.f === o.id);
        if (to) {
          let food = 0;
          for (const v of villages) if (v.alive && v.f === f.id) { const x = v.food * 0.003; v.food -= x; food += x; }
          to.food += food; count.tribute += food;
          if (!shared) { const c = f.treasury * 0.01; f.treasury -= c; o.treasury += c; }
        }
        rel.grief = clamp(rel.grief + 0.004, 0, 3); rel.op = clamp(rel.op - 0.002, -1, 1);
        const dare = (ruling(lead, "temper", f) + lead.bold) / 2;
        if (!f.yours && might(f, o) > might(o, f) * (1.45 - dare * 0.9)) {
          rel.pays = false;
          back.grief = clamp(back.grief + 0.4, 0, 3);
          note("tribute", f.name + " has stopped paying tribute to " + o.name + ".", 3, at.x, at.y, f.id);
        }
      }
      if (f.yours || rel.war) return;
      /* Alliances: against a common enemy, or between old friends; warm leaders make them, and
         they end when the liking does. Liking alone is not enough: everyday trade and talk leave
         most neighbours liking each other, and with that every faction was allied to every other
         within a year and nobody fought at all. */
      if (rel.ally) {
        if (rel.op < 0.05 || back.op < 0.05) { rel.ally = back.ally = false; note("ally", "The alliance between " + f.name + " and " + o.name + " is over.", 2, at.x, at.y, f.id); }
      } else if (!o.yours && !rel.pays && !back.pays) {
        let common = null;
        for (const x of factions) if (x.alive && x !== f && x !== o && (f.rel[x.id].war || f.rel[x.id].op < -0.4) && (o.rel[x.id].war || o.rel[x.id].op < -0.4)) { common = x; break; }
        if (((common && rel.op > 0) || (rel.bond > 0.3 && rel.op > 0.3)) && wouldAlly(o, f) && R() < 0.02 * (0.5 + lead.warm)) {
          rel.ally = back.ally = true; count.alliances++;
          rel.bond = clamp(rel.bond + 0.1, -1, 1); back.bond = clamp(back.bond + 0.1, -1, 1);
          note("ally", f.name + " and " + o.name + " have made an alliance" + (common ? ", against " + common.name : "") + ".", 3, at.x, at.y, f.id);
        }
      }
      /* Trade deals: no tax on each other's people, between neighbours who think well enough of
         each other; honest leaders keep them. */
      if (rel.trade) {
        if (rel.op < -0.05 || back.op < -0.05) { rel.trade = back.trade = false; note("trade", f.name + " and " + o.name + " have ended their trade deal.", 1.5, at.x, at.y, f.id); }
      } else if (!shared && !o.yours && b.d < 34 && rel.op > 0.15 && wouldTrade(o, f) && R() < 0.02 * (0.5 + lead.honest)) {
        rel.trade = back.trade = true; count.deals++;
        note("trade", f.name + " and " + o.name + " have agreed to trade free of tax.", 2, at.x, at.y, f.id);
      }
      /* Friends of old, kept: an alliance or a trade deal lived in is a bond. */
      if (rel.ally || rel.trade) rel.bond = clamp(rel.bond + 0.0004, -1, 1);
    }
    function decide(f) {
      const lead = byId.get(f.leader);
      if (!lead || lead.hp === -99 || lead.f !== f.id) { succeed(f, "left"); return; }
      if (f.rule === "elected" && t >= f.voteAt) vote(f, false);
      /* Turned against: a people who vote and have mostly turned on their leader do not wait for
         the next vote (Boehm 1993: the last word of an egalitarian people is to end somebody's
         leadership). */
      else if (f.rule === "elected" && !f.yours && f.loyal < 0.3 && t - (f.voteAt - S.term * YEAR) > YEAR) {
        note("vote", f.name + " has turned against " + lead.name + " and called a vote.", 2.5, villages[lead.home].x, villages[lead.home].y, f.id);
        vote(f, false);
      }
      if (revolution(f)) return;
      if (f.rule === "rich") {
        const top = people.filter(q => q.f === f.id && adult(q)).sort((a, b) => b.coins - a.coins)[0];
        if (top && top !== lead && top.coins > lead.coins * 1.5 + 5) { f.leader = top.id; f.views = viewOf(top); note("leader", top.name + ", now the richest in " + f.name + ", has taken it over from " + lead.name + ".", 2.5, villages[top.home].x, villages[top.home].y, f.id); }
      }
      /* Who holds the land (TODO 7c). */
      { const want = landWant(f); if (want !== f.land) setLand(f, want); }
      const hungry = f.pop ? f.hungry / f.pop : 0;
      let wars = 0;
      for (const o of factions) if (o.alive && o !== f && f.rel[o.id].war) wars++;
      /* In peace a leader keeps the army their own judgement asks for: as many
         as the biggest neighbouring army, a little more for old wrongs, a
         bolder leader more, and fewer when the treasury cannot pay them.
         It moves a little each day, never all at once. In war, it grows
         from there. */
      if (!f.yours && !wars) {
        let threat = 0;
        for (const o of factions) if (o.alive && o !== f && border(f, o).d < 30) {
          threat = Math.max(threat, o.adults ? o.soldiers / o.adults : 0) + Math.min(0.06, f.rel[o.id].grief * 0.03) + (t - o.rel[f.id].askedAt < 180 * DAY_HOURS ? 0.04 : 0);
        }
        const wages = f.soldiers * WAGE * 7;
        // Half the biggest neighbour's share, plus a base: answering a real threat
        // without the race to everybody under arms that matching it in full became.
        let want = clamp(0.03 + threat * 0.5 + lead.bold * 0.03, 0, 0.3);
        if (!shared && f.treasury < wages) want *= 0.8;
        f.peace = f.peace + clamp(want - f.peace, -0.004, 0.004);
      }
      f.army = f.yours ? f.yours.army : clamp((f.peace ?? S.soldiers) * (wars ? 2.6 : 1) + (wars ? 0.08 : 0), 0, 0.6);
      /* Stand soldiers down when there are more than are wanted, call some up
         when there are too few. */
      if (f.soldiers > f.army * f.adults * 1.25 + 1) {
        let extra = Math.floor(f.soldiers - f.army * f.adults);
        for (const p of people) { if (extra <= 0) break; if (p.f === f.id && p.job === "soldier") { p.job = "farmer"; p.task = "idle"; extra--; } }
      } else if (f.soldiers < f.army * f.adults) {   // in peace too: the leader decided how many
        /* An army is raised a few at a time — two in a hundred adults a week —
           not conjured whole the day a war starts; and rebuilt as slowly
           after it is broken. */
        let need = Math.min(Math.ceil(f.army * f.adults - f.soldiers), Math.max(1, Math.round(f.adults * 0.02 / 7)));
        /* Farmers first, as levies were; then crafters. With real-size bodies (TODO 7a) farming
           stopped queuing in crowds, fields went further, fewer farmed, and an army raised from
           farmers alone stalled short of what its leader asked (4 of 23 wanted 6). */
        for (const job of ["farmer", "crafter"]) for (const p of people) { if (need <= 0) break; if (p.f === f.id && adult(p) && p.job === job && p.bold > 0.3 && p.id !== f.leader) { p.job = "soldier"; p.task = "idle"; p.wait = 0; need--; } }
      }
      /* Money: enough to pay the soldiers, no more than the people will bear.
         A leader who believes in sharing feeds the hungry from the treasury. */
      if (!shared) {
        /* A leader drifts from the tax the world was set up with only as far
           as paying the soldiers demands, and comes back when it does not. */
        const wages = f.soldiers * WAGE * 7;
        if (f.yours) { f.tax = f.yours.tax; f.relief = f.yours.relief; }
        else {
          if (f.treasury < wages && f.tax < 0.6) f.tax = Math.min(0.6, f.tax + 0.02);
          else if (f.treasury > wages * 3 + f.pop * 0.5 && f.tax > S.tax * 0.5) f.tax = Math.max(S.tax * 0.5, f.tax - 0.02);
          /* A leader who believes in sharing feeds anybody who cannot pay; one
             who does not waits until the treasury is overflowing. */
          f.relief = viewOf(lead) > 0.1 || f.treasury > wages * 2 + f.pop * 1.5;
        }
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
        rel.grief *= 0.985;
        /* What they think of each other drifts toward the old bond, not to nothing; the bond
           fades over a generation (half in about ten years). */
        rel.bond *= 0.9998; rel.op += (rel.bond * 0.6 - rel.op) * 0.005;
        const b = border(f, o);
        deal(f, o, lead, b);
        /* Whoever is ruled from the page makes war and peace from the page. */
        if (f.yours) { if (rel.war && b.pair) f.target[o.id] = b.pair[1].id; continue; }
        if (rel.war) {
          if (b.pair) f.target[o.id] = b.pair[1].id;
          /* Weariness builds with the dead, the years and the hungry. A war
             between equals used to end within months and a handful of dead;
             it now lasts until it has cost something. */
          const weary = rel.dead / (f.pop + 1) * 3 + (t - rel.since) / YEAR * 0.3 + hungry * 0.5;
          /* Who leads, and what they and their people hold (TODO 14c): a leader not to blame for the
             war stops sooner (Croco); a grudge of their own, or their people's, keeps them at it, the
             people's twice as much under a leader they can vote out. No more than a leader's temper
             moves it: at 0.3 for their own and 0.15 or 0.3 for their people's, an old feud everybody
             held kept patient leaders at war as long as hot-tempered ones (test/dealings.test.mjs). */
          const mark = 0.35 + lead.bold * 0.5 + S.aggression * 0.3 + (ruling(lead, "temper", f) - 0.5) * 0.4
                       - (culpable(lead, rel) ? 0 : 0.3) + heldAgainst(lead, o) * 0.1 + Math.max(0, folk(f, o)) * (f.rule === "elected" ? 0.1 : 0.05);
          if (weary > mark) {
            const theirs = back.dead / (o.pop + 1) * 3 + (t - back.since) / YEAR * 0.3;
            const olead = byId.get(o.leader);
            if (theirs > 0.15 + (olead ? olead.bold : 0.5) * 0.2 - (culpable(olead, back) ? 0 : 0.1) || f.soldiers < o.soldiers * 0.35) {
              if (lead.id !== rel.began || (olead && olead.id !== back.began)) count.peaceNew++;
              warMoves++; rel.war = back.war = false; rel.peaceAt = back.peaceAt = t;
              rel.grief *= 0.4; back.grief *= 0.4;
              count.peaces++;
              /* The side that gave in pays, when the other was winning and is not led by a patient sort. */
              const gave = theirs <= 0.15 + (olead ? olead.bold : 0.5) * 0.2;
              if (gave && olead && back.dead < rel.dead && R() > ruling(olead, "patient", o)) { rel.pays = true; count.tributes++; }
              note("peace", f.name + " and " + o.name + " have made peace after " + Math.max(1, Math.round((t - rel.since) / YEAR)) + " years and " + (rel.dead + back.dead) + " dead" + (rel.pays ? "; " + f.name + " is to pay tribute" : "") + ".", 3.5, b.pair ? b.pair[0].x : 0, b.pair ? b.pair[0].y : 0, f.id);
            }
          }
        /* Rivals may take up arms again eighteen months after a peace, and from
           the first half-year: with three years and a year, every war in a
           world began in its thirteenth month and the next three years were
           silent. */
        } else if (S.war && b.d < 26 && t - rel.peaceAt > YEAR * 1.5 && t > YEAR * 0.5) {
          /* Reasons to fight besides an old wrong: running out of land (no
             open ground left to found on, or fields feeding under two a head),
             hunger, and — for a greedy leader — a neighbour richer a head. */
          let feeds = 0; for (const vv of villages) if (vv.alive && vv.f === f.id) feeds += vv.feeds || 0;
          const short = clamp(1 - feeds / Math.max(1, f.pop) / 2, 0, 1) * 0.5;
          const land = (f.cramped && t - f.cramped < YEAR * 2 ? 0.5 : 0) + hungry * 1.2 + short;
          const covet = clamp((o.wealth || 0) / Math.max(0.1, f.wealth || 0) - 1.1, 0, 1.5) * lead.greed * 0.6;
          /* The leader's own nature and mind (TODO 13): a hot temper is quicker to it and a
             patient one slower, and what they hold against the other side counts with the rest.
             At the middle of both it is what it was. */
          const hot = ruling(lead, "temper", f), calm = ruling(lead, "patient", f), mind = heldAgainst(lead, o);
          /* (Their people's grudges were tried here too, TODO 14c: where everybody held an old feud they
             pushed patient leaders into wars as often as hot-tempered ones, test/dealings.test.mjs.
             What the people hold weighs on how a war ends, not on whether it starts.) */
          let want = (rel.grief + land + covet + Math.max(0, -rel.op) * 0.6 + mind) * (0.35 + lead.bold) * (0.25 + S.aggression * 1.5) * (0.6 + hot * 0.8) * (1.2 - calm * 0.4);
          if (back.pays) want *= 0.3;   // tribute coming in is what a war would have taken
          if (rel.ally) want = 0;       // allies do not fight; the alliance ends first
          const mine = might(f, o), theirs = might(o, f);
          const why = rel.grief > land && rel.grief > covet && rel.grief > 0.3 ? (rel.bond < -0.3 ? "over an old feud" : "over old wrongs") : covet > land && covet > 0.3 ? "for its wealth" : land > 0.3 ? "for land" : mind > 0.3 ? "over what its leader holds against them" : "out of plain dislike";
          /* Short of war: a leader who wants something of a weaker neighbour may demand tribute
             first, the more so the more patient they are; a hot temper goes straight to war. */
          if (want > 0.5 && !back.pays && t - rel.askedAt > 120 * DAY_HOURS && mine > theirs * 1.2 && R() < 0.1 + calm * 0.5 - hot * 0.1) {
            demand(f, o, why === "out of plain dislike" ? "" : why);
          } else if (want > 0.8 && mine > theirs * 0.7 && R() < 0.5) {
            startWar(f, o, f.name + " has gone to war with " + o.name + ", " + why + ".");
          }
        }
      }
    }

    /* ── rain and dry years (TODO 6b, 2026-11-16) ─────────────────────────
       A year's rain at a place is its usual rain times 1 + cv·z: z is drawn
       for the whole land and for regions about 100 km across, from the seed
       and the year (not the world's dice), and cv, how much one year differs
       from the next, is larger on dry ground than wet (yearly rain varies by
       about 15 to 20% in wet country and 30% and more in dry), scaled by "Year
       to year". The crop loses about as much as the rain fell short (FAO's
       yield response factor for wheat, about 1.05), gains a little in a wet
       year, and ground within a kilometre of a river or lake is spared,
       wholly at the bank. Divided by its own average, so an ordinary run of
       years grows what it did without rain. README, "Rain and dry years". */
    const KY = 1.05;
    const z3 = r => r() * 2 + r() * 2 + r() * 2 - 3;
    const rainMean = (() => { const r = rng(977), m = []; for (let b = 0; b <= 40; b++) { const cv = b / 40; let sum = 0;
      for (let k = 0; k < 3000; k++) { const R = Math.max(0.05, 1 + cv * (0.8 * z3(r) + 0.6 * z3(r) * 0.75)); sum += 1 - KY * Math.max(0, 1 - R) + 0.15 * Math.min(0.5, Math.max(0, R - 1)); }
      m.push(sum / 3000); } return m; })();
    function rainField(year, out) {
      const r = rng((S.seed * 2246822519 + year * 3266489917 + 11) >>> 0);
      const zg = z3(r), cell = 100 * SQUARES_PER_KM, gw = Math.ceil(cols / cell) + 2, gh = Math.ceil(rows / cell) + 2;
      const g = new Float32Array(gw * gh); for (let k = 0; k < g.length; k++) g[k] = z3(r);
      for (let y = 0; y < rows; y++) {
        const fy = y / cell, iy = fy | 0, uy = fy - iy;
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x; if (!fert[i]) { out[i] = 100; continue; }
          const fx = x / cell, ix = fx | 0, ux = fx - ix, k = iy * gw + ix;
          const zr = g[k] * (1 - ux) * (1 - uy) + g[k + 1] * ux * (1 - uy) + g[k + gw] * (1 - ux) * uy + g[k + gw + 1] * ux * uy;
          const cv = Math.min(1, (S.weather || 0) * (0.25 + 0.6 * (1 - wetQ[i] / 255)));
          const R = Math.max(0.05, 1 + cv * (0.8 * zg + 0.6 * zr));
          let short = Math.max(0, 1 - R);
          if (nearW[i] <= 4) short *= (nearW[i] - 1) / 4;           // river flats: none lost at the bank, a quarter 500 m off, all past a kilometre
          const crop = (1 - KY * short + 0.15 * Math.min(0.5, Math.max(0, R - 1))) / rainMean[Math.round(cv * 40)];
          out[i] = clamp(Math.round(crop * 100), 0, 255);
        }
      }
      return out;
    }
    /* A new year's rain, and word of a dry one where a faction farms. */
    function newRainYear(year) {
      rainYear = year; rainField(year, rainK);
      for (const f of factions) {
        if (f.alive === false) continue;
        let sum = 0, n = 0, worst = null;
        for (const v of villages) if (v.alive && v.f === f.id) { const k = rainK[tileAt(v.x, v.y)]; sum += k; n++; if (!worst || k < worst.k) worst = { v: v, k: k }; }
        if (n && sum / n < 80) note("dry", "A dry year for " + f.name + ": the crops are thin, about " + Math.round(sum / n) + "% of a usual harvest.", 3, worst.v.x, worst.v.y, f.id);
      }
    }
    /* Rain fills the pots: on a rainy day every house of a village catches about 40 litres off its
       roof. A wet place has rain on about half its days, a dry one on a sixth; a dry year fewer. */
    function rainDay() {
      const day = Math.floor(t / DAY_HOURS), wetDay = [];
      for (const v of villages) {
        if (!v.alive) { wetDay.push(false); continue; }
        const i = tileAt(v.x, v.y), chance = (0.15 + 0.45 * wetQ[i] / 255) * clamp(rainK[i] / 100, 0.3, 1.4);
        let hsh = (S.seed * 374761393 + day * 668265263 + v.id * 2246822519) >>> 0;
        hsh = Math.imul(hsh ^ (hsh >>> 13), 1274126177) >>> 0; hsh = (hsh ^ (hsh >>> 16)) >>> 0;
        wetDay.push(hsh / 4294967296 < chance);
      }
      for (const h of homes) if (wetDay[h.v]) h.water = Math.min(JAR, h.water + 40);
    }

    /* ── the tick ──────────────────────────────────────────────────────── */
    function hour() {
      if (RAIN) { const y = season().year; if (y !== rainYear) newRainYear(y); }
      if (RAIN && THIRST && t % DAY_HOURS === 0 && t > 0) rainDay();
      if (t % DAY_HOURS === 1) { if (!THIRST) countHouses(); housing(); }   // TODO 7b
      if (t % DAY_HOURS === 3) wearOff();                                       // TODO 7d
      if (t % (DAY_HOURS * 30) === 2 && t > DAY_HOURS * 30) for (const v of villages) if (v.alive && landOf(v) === "family") allot(v);   // new households, and empty houses' land back (TODO 7c)
      if (THIRST) countHouses();
      if (!PLAIN) { wakeAll(); changedHomes(); }   // the hour may touch anybody
      t++;
      const grow = growth();
      const frost = S.winter * Math.max(0, GROW_LINE - warmth()) * 0.004;
      const n = WILD && workedList ? workedList.length : tiles;
      for (let k = 0; k < n; k++) {
        const i = WILD && workedList ? workedList[k] : k;
        const cap = fert[i] * FIELD_CAP;
        if (stock[i] < cap) stock[i] = Math.min(cap, stock[i] + fert[i] * REGROW * S.rich * (RAIN ? grow * rainK[i] * 0.01 : grow));
        /* What is still standing when the frost comes is lost a little at a time. */
        if (frost > 0 && stock[i] > 0) stock[i] -= stock[i] * frost;
      }
      rebucket();
      for (let i = 0; i < people.length; i++) {
        const p = people[i];
        if (p.hp === -99) continue;
        live(p);
        if (p.hp !== -99 && t % REFLECT_HOURS === 0) reflect(p);
      }
      /* The dead leave the list. */
      let dead = false;
      for (const p of people) if (p.hp === -99) { dead = true; byId.delete(p.id); }
      if (dead) {
        let w = 0;
        for (let i = 0; i < people.length; i++) {
          const p = people[i];
          if (p.hp !== -99) { p.ix = w; people[w++] = p; continue; }
          p.ix = -1;
          freeMind(p);   // TODO 11: the next born takes the block
          if (PLAIN) continue;
          /* Off the lists that are no longer refilled: where they stood at
             once (nobody could be blocked by the dead anyway), the square's
             list at its next refill, as before. */
          if (MEMO && p.on) unput(p);
          if (p.bk >= 0) gone.push(p);
        }
        people.length = w; changedHomes();
        if (freshList.length) { const left = freshList.filter(p => p.hp !== -99); freshList.length = 0; for (const p of left) freshList.push(p); }
      }

      if (t % REFLECT_HOURS === 0) {
        census();
        for (const v of villages) if (v.alive) { market(v); if (t % DAY_HOURS === 0) villageTurn(v); }
        if (t % DAY_HOURS === 0 && acted.size) forgetActed();
        /* The newest thing that happened is known first where it happened. */
        /* TODO 12: only those who were there see it; everybody else hears it from somebody.
           (Until item 12 a whole side knew within hours.) */
        for (let i = events.length - 1; i >= 0 && events[i].t > t - REFLECT_HOURS; i--) {
          const e = events[i];
          for (const p of people) if (Math.abs(p.x - e.x) < WITNESS && Math.abs(p.y - e.y) < WITNESS && Math.hypot(p.x - e.x, p.y - e.y) < WITNESS && newsOf(p) < e.id && R() < 0.6) {
            hold(p, M_NEWS, e.id, 1);
            logHop(e, p, -1, "", 0);
            shunSick(p, e, 0);
          }
        }
      }
      if (t % DAY_HOURS === 0) {
        /* Who told whom is kept while anybody could still hold the news: a year, by when it has
           faded below what anybody remembers (TODO 12). The tellings themselves stay. */
        for (const e of events) if (e.hops && e.t < t - 365 * DAY_HOURS) e.hops = null;
        territory();
        for (const f of factions) if (f.alive) {
          if (f.pop === 0) { fall(f, -1); continue; }
          decide(f);
        }
      }
      if (t % DAY_HOURS === 0) sample();
    }

    // One exact activity clock for the page, fast-forward and headless runs.
    // step() accepts simulated hours; advance() accepts seconds at 1×. Neither
    // skips walking, exchanges, consumption or hourly updates at higher speed.
    let elapsed = 0, compensation = 0;
    /* `untouched` (2026-11-15, TODO 2b): the caller's word that it has changed
       nobody since the last call, and reads nobody's `wait`, `stuck` or
       `routeRetry`. The page gives it; it only draws people. Then the look at
       everybody for what was done from outside, and the putting-right of
       those counts afterwards, are left out — at 20,000 people they were a
       third again on a day handed over two steps at a time, and nearly
       double a step at a time. Anything else (a test, a console) leaves it
       off and gets both; and the engine's own doors say so themselves. */
    let touched = false, unsettled = false;
    function advance(seconds, untouched) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("Time must be a finite nonnegative number of seconds.");
      const add = seconds - compensation, next = elapsed + add;
      compensation = (next - elapsed) - add; elapsed = next;
      const target = Math.floor(elapsed * TICKS_PER_SECOND + 1e-8);
      if (activityTicks >= target) return;
      if (!PLAIN && (touched || !untouched)) { if (unsettled) settle(); lookRound(); }
      touched = false;
      while (activityTicks < target) {
        activityTicks++; actionTick();
        if (activityTicks % ACTIONS_PER_HOUR === 0) hour();
      }
      if (PLAIN) return;
      if (untouched) unsettled = true; else { settle(); unsettled = false; }
    }
    /* Before anything outside the engine reads or changes the counts a
       passed-over person carries (`wait`, `stuck`, `routeRetry`), and before
       the engine's own doors (`rule`, `order`, `set`, …) change anything. */
    function openUp() { if (unsettled) { settle(); unsettled = false; } touched = true; }
    function step(hours = 1) { advance(hours * HOUR_SECONDS); }

    /* ── you, ruling ──────────────────────────────────────────────────────────
       Ric, 2026-11-14: "the person watching can choose the tax and big
       decisions and stuff for each area". A faction ruled from the page has
       its leader's decisions — tax, how many under arms, feeding the hungry
       from the treasury, war and peace — made by the watcher instead, and a
       village can be given its own tax and relief. Everybody else still lives
       by the same needs and choices, so a heavy tax is felt, resented and
       fled from exactly as a leader's would be. Nothing here decides anything
       on its own. */
    function rule(fid, on) {
      openUp();
      const f = factions[fid]; if (!f || !f.alive) return false;
      const at = villages.find(v => v.alive && v.f === f.id) || { x: 0, y: 0 };
      if (on && !f.yours) {
        f.yours = { tax: f.tax, army: f.army, relief: !!f.relief, land: f.land };
        note("rule", "You have taken the decisions of " + f.name + " into your own hands.", 2, at.x, at.y, f.id);
      } else if (!on && f.yours) {
        f.yours = null;
        for (const v of villages) if (v.f === f.id) { v.tax = null; v.relief = null; }
        note("rule", "You have handed " + f.name + " back to its leaders.", 2, at.x, at.y, f.id);
      }
      return true;
    }
    function order(fid, o) {
      openUp();
      const f = factions[fid]; if (!f || !f.yours) return false;
      if ("tax" in o) f.yours.tax = f.tax = clamp(+o.tax || 0, 0, 0.6);
      if ("army" in o) f.yours.army = f.army = clamp(+o.army || 0, 0, 0.6);
      if ("relief" in o) f.yours.relief = f.relief = !!o.relief;
      if ("land" in o && ["family", "village", "leader"].includes(o.land)) { f.yours.land = o.land; if (o.land !== f.land) setLand(f, o.land); }
      return true;
    }
    function orderVillage(vid, o) {
      openUp();
      const v = villages[vid]; if (!v || !v.alive || !factions[v.f].yours) return false;
      if ("tax" in o) v.tax = o.tax == null ? null : clamp(+o.tax || 0, 0, 0.6);
      if ("relief" in o) v.relief = o.relief == null ? null : !!o.relief;
      return true;
    }
    /* War and peace. Peace takes two: the other side accepts it only if it is
       weary — its dead, the years and its hungry, as its own leader would
       weigh them — or outmatched. */
    function declare(fid, oid, what) {
      openUp();
      const f = factions[fid], o = factions[oid];
      if (!f || !o || !f.yours || !f.alive || !o.alive || f === o) return "";
      const rel = f.rel[o.id], back = o.rel[f.id], b = border(f, o), at = b.pair ? b.pair[0] : { x: 0, y: 0 };
      if (what === "war") {
        if (!S.war) return "Wars are switched off in this world.";
        if (rel.war) return "";
        startWar(f, o, f.name + " has gone to war with " + o.name + ", on your word.");
        return "war";
      }
      /* Short of war (TODO 13): the other side answers as its own leader would. */
      if (what === "ally" && !rel.war) {
        if (rel.ally) { rel.ally = back.ally = false; note("ally", f.name + " has ended its alliance with " + o.name + ".", 2, at.x, at.y, f.id); return "unallied"; }
        if (!wouldAlly(o, f)) return "refused-ally";
        rel.ally = back.ally = true; count.alliances++;
        note("ally", f.name + " and " + o.name + " have made an alliance, on your word.", 3, at.x, at.y, f.id);
        return "ally";
      }
      if (what === "trade" && !rel.war) {
        if (rel.trade) { rel.trade = back.trade = false; note("trade", f.name + " and " + o.name + " have ended their trade deal.", 1.5, at.x, at.y, f.id); return "untraded"; }
        if (!wouldTrade(o, f)) return "refused-trade";
        rel.trade = back.trade = true; count.deals++;
        note("trade", f.name + " and " + o.name + " have agreed to trade free of tax.", 2, at.x, at.y, f.id);
        return "trade";
      }
      if (what === "tribute" && !rel.war && !back.pays) {
        if (t - rel.askedAt < 30 * DAY_HOURS) return "asked";
        rel.ally = back.ally = false;
        return demand(f, o, "on your word");
      }
      if (what === "stop" && rel.pays) {
        rel.pays = false; back.grief = clamp(back.grief + 0.4, 0, 3);
        note("tribute", f.name + " has stopped paying tribute to " + o.name + ", on your word.", 3, at.x, at.y, f.id);
        return "stopped";
      }
      if (what === "peace" && rel.war) {
        const olead = byId.get(o.leader);
        const theirs = back.dead / (o.pop + 1) * 5 + (t - back.since) / YEAR * 0.12 + (o.pop ? o.hungry / o.pop : 0) * 0.5;
        /* Nobody makes peace the week they were attacked unless they are badly outmatched. */
        if ((t - back.since > 7 * DAY_HOURS && theirs > 0.1 + (olead ? olead.bold : 0.5) * 0.2 - (culpable(olead, back) ? 0 : 0.1)) || o.soldiers < f.soldiers * 0.3) {   // a leader not to blame, sooner (TODO 14c)
          warMoves++; rel.war = back.war = false; rel.peaceAt = back.peaceAt = t; rel.grief *= 0.4; back.grief *= 0.4;
          count.peaces++;
          note("peace", f.name + " and " + o.name + " have made peace after " + (rel.dead + back.dead) + " dead.", 3.5, at.x, at.y, f.id);
          return "peace";
        }
        note("peace", o.name + " refused the offer of peace from " + f.name + ".", 2, at.x, at.y, o.id);
        return "refused";
      }
      return "";
    }
    /* Changing the rules of a running world: only the settings marked live,
       through the same bounds as the setup page. */
    function set(key, value) {
      openUp();
      const it = SCHEMA.flatMap(g => g.items).find(i => i.key === key);
      if (!it || !it.live) return false;
      const next = clean(Object.assign({}, S, { [key]: value }));
      if (next[key] === S[key]) return false;
      S[key] = next[key];
      if (key === "winter") FIELD_CAP = TILE_CAP * (1 + 1.5 * S.winter);
      seasonDay = -1; aheadAt = -1;
      return true;
    }

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
        boats: villages.filter(v => v.alive && v.boat).length,   // afloat now (TODO 7d)
        /* Towns, cities, and how many live in them (TODO 8). */
        towns: villages.filter(v => v.alive && v.place === "town").length, cities: villages.filter(v => v.alive && v.place === "city").length,
        urban: people.length ? villages.reduce((n, v) => n + (v.alive && v.place && v.place !== "village" ? v.pop || 0 : 0), 0) / people.length : 0,
        paths: trodList.reduce((n, i) => n + (track[i] === 1 ? 1 : 0), 0), roads: trodList.reduce((n, i) => n + (track[i] === 2 ? 1 : 0), 0),
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

    /* Who holds the land, from the first hour (TODO 7c). */
    countHouses();
    for (const f of factions) if (f.alive) setLand(f, landWant(f));
    allotted = true;
    actionTick();
    if (!PLAIN) settle();
    return {
      settings: S, cols: cols, rows: rows, YEAR: YEAR, tileCapacity: TILE_CAP,
      fert: fert, ore: ore, stock: stock, owner: owner, ground: ground, height: height, riverTo: riverTo, homes: homes,
      /* Rain (TODO 6b): this year's crops for the rain on each square, 100 an ordinary year (null with
         Rain off), and any year's, worked out fresh without touching the world. */
      /* Send somebody somewhere, as a decision would: for tests (crossing water, TODO 6d). */
      send: (p, x, y, task) => go(p, x, y, task || "idle"),
      /* Fields held by households (TODO 7c): square -> house, and a number that changes when they do. */
      held: held, get heldStamp() { return heldStamp; },
      inMind: inMind, tiesOf: tiesOf, viewOf: viewOf, feel: feel, newsOf: newsOf,   // TODO 11
      newsText: newsText, traceNews: traceNews, eventById: eventById, telling: telling,   // TODO 12
      setView: setView, befriend: befriend,   // for the tests
      /* For the tests (TODO 12b): a report of a sickness, famine or dear food at village `vid`, told to
         the people `ids` naming village `sayVid` (the true one when left out). Returns the event. */
      report: (kind, vid, ids, sayVid) => {
        const v = villages[vid], text = n => kind === "sick" ? "A sickness has started in " + n + "." : kind === "famine" ? n + " is starving." : "Food is dear in " + n + ".";
        const e = note(kind, text(v.name), 2, v.x, v.y, v.f);
        let tv = 0;
        if (sayVid !== undefined && sayVid !== vid) { e.vars = [e.text, text(villages[sayVid].name)]; tv = 1; }
        for (const id of ids) { const p = byId.get(id); if (p && heard(p, M_NEWS, e.id, 1, -1, tv) !== undefined) shunSick(p, e, tv); }
        return e;
      },
      /* Paths and roads (TODO 7d): how trodden each square is, 1 a path and 2 a road, and a number
         that changes when they do. */
      trod: trod, track: track, get trackStamp() { return trackStamp; },
      cross: cross,   // TODO 6d: 1 a big river, 2 a ford, 3 a bridge (null with Crossing at "wade")
      rainK: rainK, rainField: y => RAIN ? rainField(y, new Uint8Array(tiles)) : null,
      people: people, byId: byId, villages: villages, factions: factions,
      events: events, chatter: chatter, history: history,
      step: step, advance: advance, season: season, rule: rule, order: order, orderVillage: orderVillage, declare: declare, set: set, moves: moves, taxOf: taxOf, activity: activity,
      /* Asked from outside, perhaps just after somebody was given another home. */
      /* And it must leave no mark. How much a village still has to put by is
         worked out once an hour, from its store at the moment it is first
         asked — so asking from outside, as the Person panel does several
         times a second, used to fix that figure at a moment of the panel's
         choosing, and a watched world could differ from an unwatched one.
         Found 2026-11-15 by test/keeper.test.mjs; the figure is put back. */
      urgency: p => {
        changedHomes();
        const v = villages[p.home], at = v.putByAt, was = v.putBy, u = urgency(p);
        v.putByAt = at; v.putBy = was;
        return u;
      },
      /* After `advance(seconds, true)`: put passed-over people's counts right before reading them. */
      settle: openUp,
      dailyNeed, storeDays, equipment, outfit, harvestCapacity, tradeCapacity, craftOutput, strike, stats: stats, at: at, adult: adult, leans: leans, atWar: atWar, heldAgainst: heldAgainst, standing: standing,
      get tick() { return t; },
      get days() { return activityTicks / ACTIONS_PER_HOUR / DAY_HOURS; },
      get activityTicks() { return activityTicks; },
      get sceneTick() { return sceneTick; },
      /* How many times anybody has been visited on a step, and how many are
         being passed over now: for the speed test and the tests. */
      get visits() { return visits; },
      get passedOver() { let n = 0; for (let i = 0; i < people.length; i++) if (kind[i]) n++; return n; },
    };
  }

  return { SCHEMA: SCHEMA, DEFAULTS: DEFAULTS, PRESETS: PRESETS, YEAR: YEAR, DAY_SECONDS: DAY_SECONDS, HOUR_SECONDS, DAY_HOURS, ACTIONS_PER_HOUR, WALK, STEP: HOUR_SECONDS / ACTIONS_PER_HOUR, START_DOY, seasonAt, clean: clean, create: create };
});
