"use strict";

/* KONDRITE — THE FACTIONS
   ─────────────────────────────────────────────────────────────────────────────
   Where the parts go, the first two minutes, company, a galaxy already at
   war, what the sector thinks of you, fitting and building, the ice melter,
   and how battles end.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ═══ WHERE THE PARTS GO ══════════════════════════════════════════════════
   Home. `HOME_STATION`, and there is nothing else to say about the place any
   more, which is the point of the change.

   It was THE YARD, then THE JUMP GATE: a second structure a few hundred units
   the other side of the origin, which a new player met in the same minute as
   a station that already worked perfectly. Two landmarks, two questions, and
   the finished one was the one with nothing to want. So they swapped. The
   wormhole is not a separate thing you build beside the station — it is what
   the station *becomes* when it is whole, and the mouth is the last of the
   six rooms the parts light. See SERVICES. */

const partSpec = key => BUILD.find(b => b.key === key);

/* Anything lying on the floor of the sector needs an identity of its own.
   A manifest part never needed one — there is exactly one jump coil — but two
   spare pulse coils dropped by the same death are two objects, and matching
   them by key would make picking one up delete both. */
let dropSeq = 0;
const dropId = () => "d" + (++dropSeq) + "." + Math.floor(Math.random() * 1e6);

// What a dropped thing is, whichever kind it is.
const droppedSpec = d =>
  d && d.mod ? moduleSpec(d.key) : partSpec(d && d.key);

/* Jumping. Only to somewhere already written down, and only once the drive is
   built — this is fast travel across ground you have covered, never a way to
   skip covering it. */
function lightJump(x, y) {
  if (!stationHas("mouth")) return false;
  const me = ships[0];
  if (!me || !me.alive) return false;
  burst(me.x, me.y, CASH, 30, 320 * U);
  gameSound("warp", me.x, me.y);
  // Aimed by hand at a point on the chart, which may well be solid rock.
  const land = outOfRock(x, y);
  me.x = land.x; me.y = land.y;
  me.vx = me.vy = 0;
  me.invuln = Math.max(me.invuln, 2);
  cam.x = me.x; cam.y = me.y;
  streamChunks(true);
  streamRocks();
  burst(x, y, CASH, 30, 320 * U);
  addShake(8);
  gameSound("win", x, y);
  chatter("Light drive — arrived.", CASH);
  saveSurveyBook();
  return true;
}
/* ═══ THE FIRST TWO MINUTES ═══════════════════════════════════════════════
   Ric's sister sits down cold, and inside two minutes she knows what she is
   doing and why. That is the test the whole plan is written against, and this
   is the only part of the mode that exists to pass it.

   The rule it is built on: **every mechanic is introduced by needing it.** Not
   by a tutorial, not by a wall of text on the title card, and not by a tooltip
   — by the game arranging for you to want the thing about ninety seconds
   before you would have found it on your own.

   So a new survey starts *docked at the home station with the tanks low*. You
   did not choose to be there and you cannot leave without noticing the shop,
   which means the first thing that happens is you buy water — and buying water
   teaches cash, storage, the station page and the fact that something out here
   is counting down, in one press. Everything after that is the same trick:

     water low        →  you are already standing in the shop that sells it
     water bought     →  the yard says what it wants and where to look
     first material   →  it says what it is worth and that a station buys it
     storage filling  →  it says to go and sell
     first sale       →  the refit tracks are right there on the same page

   Each beat fires once, on an event, and is remembered — a prompt you have
   already acted on is noise the second time. None of them stops the game or
   asks for a click. If you already know all this, the whole thing is four
   notifications you can ignore over two minutes and then never see again. */
const OPENING = [
  { key: "thirst",
    when: () => surv.docked && surv.water < WATER_FULL * 0.45,
    text: "WATER LOW",
    sub: "you are docked — the station sells it",
    colour: "#87d8ff" },
  /* The beat that used to point at a second structure off the origin, and
     now names the place she is standing in. She has just bought water from a
     counter, so the one thing worth telling her is that the counter is all
     there is — every other row on that page is dark and says which part it
     wants. Where to fly is the objective line's job and always was; this is
     the line that makes six dark rows mean something. */
  { key: "dead",
    when: () => surv.water >= WATER_FULL * 0.9 && !stationWhole(),
    text: "THIS STATION IS DEAD",
    sub: "it buys, and it sells water. everything else on it wants a part.",
    colour: NEBULA },
  { key: "material",
    when: () => holdUsed() > 0,
    text: "THAT IS WORTH MONEY",
    sub: "a station will buy it — press M for the chart",
    colour: CASH },
  { key: "sell",
    when: () => holdUsed() >= holdCap() * 0.6,
    text: "STORAGE FILLING UP",
    sub: "find a station and sell what you are carrying",
    colour: CASH },
  { key: "spend",
    when: () => surv.cash >= 200 && surv.docked,
    text: "YOU CAN AFFORD A PART",
    sub: "the station sells them, and fits them on the spot",
    colour: CASH },

  /* ── and the same trick again, for the hours after the gate ────────────
     Everything above fires inside two minutes, and then this list — the one
     piece of the mode whose whole job is making you want a thing ninety
     seconds before you would have found it — never ran again. The manifest
     carried the next four hours on its own, and when it finished there was
     nothing underneath it: people got the wormhole, read a HUD line that said
     the sector was theirs to wander, and stopped.

     So there is a second act, on exactly the same terms as the first. Each
     beat hangs on a pressure the player is already feeling rather than on a
     clock, none of them names a destination, and every one of them is about
     something they can already see going wrong. Four notifications over ten
     hours, each fired once and remembered. */

  /* The range problem, said the first time it is a problem. Twenty minutes of
     tank is a leash, the far half of the ladder is outside it, and the answer
     is a thing you build rather than a thing you buy — which is the only
     reason the melter exists. Deliberately not fired near home: docked at the
     origin with a dry tank you have a shop, not a problem. */
  { key: "leash",
    when: () => !surv.docked && !surv.landed &&
                surv.water < WATER_FULL * 0.25 &&
                Math.hypot(ships[0].x, ships[0].y) > 25000,
    text: "YOUR TANK IS A LEASH",
    sub: "an ice melter makes its own — the workbench can build one",
    colour: "#87d8ff" },

  /* The first time the sky turns on you. It used to fire at 60,000 units,
     because danger was a distance; it is who holds the sky now, so it fires
     the first time you fly into space nobody keeps the peace in. The key is
     kept so a book that already heard it does not hear it again. */
  { key: "hostile",
    when: () => {
      const k = spaceAt(ships[0].x, ships[0].y).kind;
      return k === "lawless" || k === "front";
    },
    text: () => placeAt(ships[0].x, ships[0].y).space.name,
    sub: "it pays better out here, and it is worse out here",
    colour: "#ff9d5c" },

  /* The second project, at the moment it stops being theoretical. Not when
     the gate finishes — the banner is already talking then, and a price you
     cannot pay is not an offer. Half the money is when it becomes one. */
  { key: "berth",
    when: () => stationWhole() && !surv.hasLight &&
                surv.cash >= LIGHT_DRIVE.cost * 0.5,
    text: "YOUR STATION HAS A SECOND BERTH",
    sub: () => "a light drive, and you are halfway to the " +
               LIGHT_DRIVE.cost + " it wants",
    colour: ICE_C },

  /* And the shelf you cannot reach. Eleven parts in this game are not on the
     workbench and not on any shelf inside the first sixty thousand units, and
     until now there was nowhere a player could meet one — so the best part in
     every category was something you could only get by accident. The list is
     on the missions page; this is the once that says so. */
  { key: "longlist",
    when: () => stationWhole() && !!surv.docked,
    text: "SOME PARTS ARE NOT FOR SALE HERE",
    sub: "the best of each kind is sold in worse sky — the missions page lists them",
    colour: "#a08cff" }
];

function surveyOpening() {
  /* The second act's beats read the ship's position — how far out you are is
     most of what they are about — so the ship has to be there. It always is
     while a survey is running; this is the belt to the death check's braces. */
  if (!surv || surv.death || !surveyHUD || !ships[0]) return;
  for (const beat of OPENING) {
    if (surv.taught.has(beat.key)) continue;
    if (!beat.when()) continue;
    surv.taught.add(beat.key);
    const text = typeof beat.text === "function" ? beat.text() : beat.text;
    const sub  = typeof beat.sub === "function" ? beat.sub() : beat.sub;
    surveyHUD.notify(text, sub, beat.colour, 9);
    saveSurveyBook();
    return;        // one at a time; two at once is a wall
  }
}

/* ═══ COMPANY ═════════════════════════════════════════════════════════════
   Traffic that is not trying to kill you, which is the only thing that has
   ever made a sector feel like anywhere. Three kinds, and each is a different
   answer to "what is somebody else doing out here":

     freight     a freighter on a route between two points, carrying material
                 and minding its own business
     patrol      an armed ship holding a circuit near a station, which will
                 shoot at a sentry and never at you
     distress    a freighter being taken apart by sentries, with a clock on it

   Density falls with distance, hard. Near home you are never alone for long;
   past the Hostile band you can fly for an hour and see nobody, and that
   contrast is most of what makes distance feel like distance — a sector that
   is equally empty everywhere is just big.

   They fly the same twenty-five hulls you can buy, which is most of what makes
   the roster feel like a world rather than a shop: the Drayman that passes you
   on a route is the Drayman in the hangar. */
/* ═══ A GALAXY THAT IS ALREADY AT WAR ═════════════════════════════════════
   The first version of this was a single ladder: one hidden number, and the
   whole sector agreed about you at once. That is not a galaxy, it is a
   reputation bar with the numbers filed off — everyone had the same opinion
   and it was always about you.

   So: three powers, a war between two of them, pirates who are nobody's, and
   independents who are their own. You are a man exploring in the middle of
   somebody else's argument, and almost nothing out here is about you at all.

     · Standing is *per flag*. Shooting the Cordon's freighters makes the
       Cordon cold and makes whoever the Cordon is fighting rather warmer.
       Piracy against one side is diplomacy with the other.
     · Ships have a temperament on top of their flag. A freighter is not an
       escort is not a pirate, and two ships of the same power can be
       completely different to meet.
     · Some want room. Fly inside a nervous escort's bubble and it tells you
       to back off before it does anything about it.
     · The war is not scenery: ships of warring powers shoot each other on
       sight, and you can watch it and stay out of it.
     · A trader will trade. Pull alongside and deal. */
/* Five flags, five colours you can tell apart at a glance and at a distance.
   They used to be a mint, two pale blues and a grey-blue, which is four ways of
   saying the same thing: at the size a ship is drawn out there you could not
   tell a Hallow patrol from an independent hauler, and "whose is that" is the
   first question the war asks you.

   So they are pushed to the corners — green, blue, magenta, grey, red — and
   none of them is the amber the player and the asteroids already own.

   `note` is the one-line description the reputation box reads, so each of them
   has to say who these people are and not merely name them. */
const FACTIONS = [
  { key: "cordon", name: "THE CORDON",      short: "CORDON",
    colour: "#6dffbf",
    note: "keeps the lanes open and polices them; will not start it",
    long: "Lane-keepers. They run the routes between stations and think that " +
          "makes the routes theirs. Correct with anybody who is." },
  { key: "hallow", name: "THE HALLOW LINE", short: "HALLOW",
    colour: "#4aa3ff",
    note: "older than the lanes, and less interested in them",
    long: "Here before the stations were. Fly their own roads, answer to " +
          "nobody, and take being flown at very personally." },
  { key: "morrow", name: "MORROW COMPACT",  short: "MORROW",
    colour: "#e07bff",
    note: "a trading compact with guns, in that order",
    long: "Merchants who armed themselves and found they liked it. Everything " +
          "is for sale and the price goes up if they do not like you." }
];
const UNALIGNED = { key: "free",   name: "UNALIGNED", short: "FREE",
                    colour: "#9aa6b8", note: "flying for themselves",
                    long: "No flag, no side, no interest in yours. Haulers " +
                          "and traders getting on with it." };
const PIRATE    = { key: "pirate", name: "NO COLOURS", short: "PIRATE",
                    colour: "#ff5555", note: "nobody's, and everybody's problem",
                    long: "Nobody's. They want what you are carrying and " +
                          "everyone else wants them gone." };
/* Money, said the same way everywhere. The interface has its own copy of this
   for the pages it draws; this is the one the sector speaks with. */
/* The same sentinel the interface draws its currency mark for — see `money` and
   `cashGlyph` in the panel module. A line of chatter that says what something
   cost gets the mark too, because it is the same number said out loud. */
const money = n => "\u00A4" + Math.round(Number(n) || 0).toLocaleString("en-US");

const factionOf = k => FACTIONS.find(f => f.key === k) ||
                       (k === "pirate" ? PIRATE : UNALIGNED);

/* ── where you are, in words ──────────────────────────────────────────────
   Two facts, and the top right says both: whose sky this is and what kind of
   sky it is. The first used to be a ring — HOME, OPEN, HOSTILE — and the
   second was deliberately never said at all. Ric turned both round: *"it
   should tell you what ones your in on top right."* */
function placeAt(x, y) {
  const sp = spaceAt(x, y), reg = regionOf(x, y);
  let name = sp.name, colour = sp.colour, detail = "";
  if (sp.kind === "territory") {
    const f = factionOf(sp.owner);
    name = f.short + " SPACE"; colour = f.colour;
  } else if (sp.kind === "front") {
    const a = sp.owner ? factionOf(sp.owner) : null, b = factionOf(sp.enemy);
    detail = a ? a.short + " HELD \u00b7 " + b.short + " CLOSE"
               : "NOBODY HOLDS IT \u00b7 " + b.short + " AT WAR";
    if (a) colour = a.colour;
  }
  return {
    space: { kind: sp.kind, name, colour, detail,
             owner: sp.owner || null, enemy: sp.enemy || null },
    biome: { key: reg.key, name: reg.name, colour: reg.colour },
    danger: dangerAt(x, y),
    text: name + " \u00b7 " + reg.name
  };
}

/* Who is fighting whom, now. The world rolls the war a sector starts with;
   `surv.war` is where it has got to — a ceasefire empties it and a new war
   fills it — and everything that asks "are these two at war" asks this. */
const warPairs = () =>
  (surv && surv.war && surv.war.pairs) || (surv && surv.world && surv.world.war) || {};
const warSides = () => (surv && surv.war && surv.war.belligerents) || [];
function atWar(a, b) {
  if (!a || !b || a === b) return false;
  if (a === "pirate" || b === "pirate") return true;
  if (a === "free" || b === "free") return false;
  const w = warPairs();
  return w[a] === b || w[b] === a;
}

/* `role` is temperament and job; `faction` is the flag, and the two are
   independent — which is the point. `space` is how much room it wants; zero
   means it does not care who flies past. */
/* ── what each of them wants ──────────────────────────────────────────────
   Phase 6.1. Nothing out here needs to be clever; it needs a *goal that can
   collide with somebody else's*. A trader wants to reach a station with its
   cargo. A pirate wants that cargo. An escort wants its client alive. A patrol
   responds to whatever is happening. A scavenger wants wreckage — including the
   wreckage you were about to strip.

   Put three of those in the same piece of sky and you get a situation nobody
   scripted: the pirate closes on the hauler, the escort turns to meet it, the
   patrol hears the shooting and comes, and you arrive in the middle of it with
   a choice to make. That is the whole of this phase — no behaviour trees, no
   states, just wants and the fact that they are incompatible.

   `want` is the verb. `hunts` is whether the want involves chasing somebody. */
const ROLES = {
  freight:  { armed: false, trades: false, space: 0,   want: "deliver" },
  trader:   { armed: false, trades: true,  space: 0,   want: "deliver" },
  escort:   { armed: true,  trades: false, space: 620, want: "guard" },
  patrol:   { armed: true,  trades: false, space: 340, want: "police" },
  pirate:   { armed: true,  trades: false, space: 0,   want: "rob", hunts: 1 },
  scavenger:{ armed: false, trades: true,  space: 0,   want: "salvage" },
  distress: { armed: false, trades: false, space: 0,   want: "survive" },
  hunter:   { armed: true,  trades: false, space: 0,   want: "you", hunts: 1 }
};

/* Which hulls each job flies, and no two jobs share a family, because the
   hull is how you tell them apart. A container grid is freight, a row of
   windows is a trader, jaws or a beam throat is a scavenger, forward guns are
   the navy, and a needle with barbs on it is a pirate. Pirates flew Jackals
   and Reprisals too, which made a raider the same shape as the patrol
   hunting it. They fly what is fast and cheap now. */
const TRAFFIC_HULLS = {
  freight:  ["drayman", "coffer", "granary"],
  trader:   ["pannier", "wedge", "harrier", "runner"],
  scavenger:["cradle", "ossuary", "windlass", "ironmonger", "cathedral"],
  escort:   ["lance", "louvre", "spur", "bastion", "reprisal"],
  patrol:   ["lance", "louvre", "spur", "bastion", "reprisal"],
  pirate:   ["needle", "vane", "mote", "kite", "stride"],
  distress: ["drayman", "coffer", "granary", "pannier", "wedge", "harrier"],
  hunter:   ["lance", "louvre", "spur", "bastion", "reprisal"]
};
// A ship is drawn in its flag's colour; a pirate flies none and gets the one
// that means it.
const trafficColour = t => factionOf(t.faction).colour;
const DISTRESS_PAY   = 260;    // for clearing the sentries off one
const TRAFFIC_TALK   = 2600;   // how close before it says anything

/* ═══ WHAT THE SECTOR THINKS OF YOU ═══════════════════════════════════════
   The more innocent people you kill, the more ships want to kill you.

   There is a number behind this and the player must never see it. No bar, no
   faction table, no "-12 REPUTATION" toast — if somebody can tell you the
   figure, it has been built wrong. What they get instead is the sector
   behaving differently, in three steps that are each visible from the cockpit:

     WATCHED   a patrol near you stops walking its beat and follows, at a
               distance, without firing. Somebody is keeping an eye on you.
     WANTED    patrols do not wait for you to shoot first any more.
     HUNTED    ships come out specifically to find you, and keep coming.

   Two things it must not become. Not a morality meter that scolds you: the
   lines it says are rumour and consequence, never judgement. And not a wall —
   stations never close, prices never change, nothing is locked. Piracy stays
   playable and simply gets more expensive and more dangerous, which is a
   different thing from forbidden.

   It cools on its own, slowly, and faster if you pull somebody out of trouble.
   Being able to work it off is what keeps it a *state* rather than a verdict on
   the save file. */
/* ── standing, per flag ───────────────────────────────────────────────────
   Each power has its own opinion of you, and because two of them are at war,
   hurting one is a favour to the other: shoot the Cordon's freighters and
   Hallow warms to you by half what the Cordon cools. That is the whole reason
   to have a war in the background — it turns piracy from a thing you are
   punished for into a side you are taking.

   Pirates have no opinion to change. They are hostile already and nothing you
   do alters it, which makes them the one flag you can shoot without politics.

   The player never sees a figure. What they get is a word per power, on one
   page, and the sector behaving differently. */
const REP = {
  freight:  -26,   // an unarmed freighter going about its day
  trader:   -26,
  distress: -34,   // one that was already being taken apart
  escort:   -16,
  patrol:   -14,   // armed, and still not looking for a fight
  pirate:     6,   // everybody's problem; killing one is a small favour
  hunter:     0,   // came for you, and settles nothing either way
  RESCUE:    30,
  SPITE:      0.5, // of a loss, credited to whoever they are fighting
  COOL:       0.075,
  MAX:        240,
  WANTED:    -90,
  HUNTED:   -150
};
const repOf = key => (surv && surv.rep && surv.rep[key]) || 0;

const STANDING = [
  { at: -150, name: "HUNTED",  note: "sending ships to find you" },
  { at:  -90, name: "WANTED",  note: "will shoot without waiting" },
  { at:  -30, name: "WATCHED", note: "keeping an eye on you" },
  { at:   40, name: "NEUTRAL", note: "no opinion worth having" },
  { at:  110, name: "WELCOME", note: "glad to see you" },
  { at: 1e9,  name: "TRUSTED", note: "you are one of theirs" }
];
function standingOf(key) {
  const v = repOf(key);
  for (const st of STANDING) if (v <= st.at) return st;
  return STANDING[STANDING.length - 1];
}
const hostileTo = key => repOf(key) <= REP.WANTED;

/* What a power's gratitude is worth in cash, which is not the same figure for
   everybody. Never zero: they still pay, and the fact that they pay *badly* is
   the information. */
function standingPay(key) {
  const v = repOf(key);
  if (v >= 110) return 1.35;        // TRUSTED, and they say so
  if (v >= 40)  return 1.15;        // WELCOME
  if (v >= -30) return 1;           // NEUTRAL — the ordinary rate
  if (v >= -90) return 0.6;         // WATCHED
  return 0.35;                      // WANTED or HUNTED
}

/* What one ship makes of you: its flag's opinion, unless it is a pirate — a
   pirate's opinion is fixed and it is bad — or unless you have personally
   annoyed this one, which outranks everything. */
function shipHostile(t) {
  if (t.angry) return true;
  if (t.faction === "pirate") return true;
  if (t.faction === "free" || !t.faction) return false;
  return hostileTo(t.faction);
}

function addRep(key, n) {
  if (!surv || !key || key === "pirate" || key === "free" || !n) return;
  if (!surv.rep) surv.rep = {};
  const was = standingOf(key).name;
  surv.rep[key] = Math.max(-REP.MAX, Math.min(REP.MAX, repOf(key) + n));
  const now2 = standingOf(key).name;
  if (now2 === was) return;
  const f = factionOf(key);
  chatter(f.short + " — " + now2.toLowerCase(), n < 0 ? "#ff8f77" : f.colour);
  saveSurveyBook();
}

/* A loss for one side is a gain for whoever they are fighting — at half
   value, because helping by accident is worth less than helping on purpose. */
function repForKill(t) {
  const n = REP[t.role || t.kind] || 0;
  if (t.faction === "pirate") {
    for (const f of FACTIONS) addRep(f.key, REP.pirate);
    return;
  }
  addRep(t.faction, n);
  // Every hull lost is a little less war that side can fight.
  weaken(t.faction, ROLES[t.role] && ROLES[t.role].armed ? 0.015 : 0.01);
  const enemy = warPairs()[t.faction];
  if (enemy && n < 0) addRep(enemy, -n * REP.SPITE);
}

/* Opinions drift back toward nothing on their own, from either direction — so
   being loved fades too, and nothing about you is permanent. */
/* ── fitting a part ───────────────────────────────────────────────────────
   You can change a part anywhere, including in the middle of a fight. What it
   costs is the slot: pull the old one, put the new one in, and that slot does
   nothing until the fit finishes. A four-slot ship mid-swap is a three-slot
   ship, and swapping your weapon while somebody is shooting at you means
   fighting without it until it lands.

   That is a better rule than a ban. The call is yours, and the call can be
   wrong.

   At a station it is instant — no timer, no dead slot — which is a reason to
   fly back to one that has nothing to do with selling. And all of it only
   works because the storage page does not pause the world: start a fit, close
   the page, keep flying, and it runs while you fly. */
function surveyFitting(dt) {
  let landed = false;
  for (const sl of surv.slots) {
    if (!sl || sl.fit <= 0) continue;
    sl.fit = Math.max(0, sl.fit - dt);
    if (sl.fit <= 0) {
      landed = true;
      chatter(moduleSpec(sl.key).name + " is online.", CASH);
      gameSound("win");
    }
  }
  if (landed) { applyRefit(ships[0]); padApply(); saveSurveyBook(); }
}

/* How far out the station you are standing in is, which is the only thing
   that decides what it stocks. A shop near home sells what everyone sells; the
   strange things are a long way out, which is the danger curve finally paying
   something back. */
const stationDepth = () =>
  surv && surv.docked ? shelfDepth(surv.docked.x, surv.docked.y) : 0;

/* ── building one ─────────────────────────────────────────────────────────
   Anywhere, out of what you are carrying. Not at a station: the ice melter's
   entire reason to exist is being the answer when there is no station for two
   hundred thousand units, and a workbench you have to dock at cannot be that.

   What a build wants and what you have, as one object, so the page can draw
   the answer instead of working it out itself. `canMake` is the short version
   and `chainable` is the interesting one — whether an ingredient part is
   something you could build right now out of what is left. */
function craftState(key) {
  const r = craftFor(key);
  if (!r) return null;
  const rows = Object.keys(r.need).map(k => ({
    key: k, name: matSpec(k).name, colour: matSpec(k).colour,
    want: r.need[k], have: surv.hold[k] || 0
  }));
  const short = rows.filter(row => row.have < row.want);
  let part = null;
  if (r.part) {
    const pm = moduleSpec(r.part);
    const held = storeCount(r.part) > 0;
    part = { key: r.part, name: pm ? pm.name : r.part, have: held,
             /* The nested case, answered rather than left to the player: if you
                do not have the part but could build it out of what is left over,
                the page offers to do both in one action. */
             makeable: !held && !!craftFor(r.part) && canMake(r.part, r.need) };
  }
  return { out: key, rows, short: short.length, part,
           ready: !short.length && (!part || part.have) };
}

/* Whether a build can be met, optionally with some of the hold already
   spoken for by the build above it. `reserve` is that claim. */
function canMake(key, reserve) {
  const r = craftFor(key);
  if (!r) return false;
  if (r.part && storeCount(r.part) <= 0) return false;
  for (const k of Object.keys(r.need)) {
    const claimed = (reserve && reserve[k]) || 0;
    if ((surv.hold[k] || 0) < r.need[k] + claimed) return false;
  }
  return true;
}

function craft(key) {
  const st = craftState(key);
  if (!st) { gameSound("hit"); return false; }
  const r = craftFor(key);

  /* One tap builds the ingredient too, when the ingredient is one step down and
     you have the materials for both. Nobody should have to hold a chain in
     their head — and two steps is the whole of the depth, so this can never
     recurse further than once. */
  if (r.part && storeCount(r.part) <= 0) {
    if (!st.part || !st.part.makeable) {
      chatter("Needs " + (st.part ? st.part.name : "a part") + " first.", "#ff8f77");
      gameSound("hit");
      return false;
    }
    if (!craftOne(r.part)) return false;
  }
  return craftOne(key);
}

/* The step itself: take the materials, take the part if there is one, hand over
   the thing. Nothing here recurses. */
/* Where a thing can be built. A common part is scrap and patience — you can do
   it on the back of the ship with what is in the hold. Anything above common
   wants a berth, a gantry and somebody else's tools, so it wants a station.

   This is the rule that makes the workbench and the shop stop competing: out in
   the dark you can keep yourself in plate and coils and guns indefinitely, and
   the good things are a reason to go back in. */
function craftHere(key) {
  const m = moduleSpec(key);
  if (!m) return false;
  return m.rarity === "common" || !!surv.docked;
}

function craftOne(key) {
  const r = craftFor(key);
  if (!r || !canMake(key)) { gameSound("hit"); return false; }
  if (!craftHere(key)) {
    chatter(moduleSpec(key).name + " needs a station — only common parts can " +
            "be built out here.", "#ff8f77");
    gameSound("hit");
    return false;
  }
  /* Room for what comes out, counted against the hold *after* the materials
     it eats have left it — building something is usually a net saving, and
     refusing a build that would have made room is the wrong answer. */
  const frees = Object.keys(r.need).reduce((t, k) => t + r.need[k], 0) +
                (r.part ? partWeight(r.part) : 0);
  if (holdCap() - holdUsed() + frees < partWeight(key)) {
    noRoomFor(key);
    return false;
  }
  for (const k of Object.keys(r.need)) surv.hold[k] -= r.need[k];
  if (r.part) storeAdd(r.part, -1);
  storeAdd(key, 1);
  surv.t.crafted = true;
  const m = moduleSpec(key);
  gameSound("win");
  addShake(3);
  chatter(m.name + " built" + (r.part ? " out of the " + moduleSpec(r.part).name : ""),
          CASH);
  surveyFind("shipwright");
  saveSurveyBook();
  return true;
}

/* What a material is an ingredient *for*. The reverse lookup, and the thing
   that turns a strange part found a long way out into a lead rather than a
   curiosity — you have three reactor cores and no idea why until something
   tells you. */
const usedIn = matKey => {
  const out = CRAFTS
    .filter(r => r.need[matKey])
    .map(r => moduleSpec(r.out))
    .filter(Boolean)
    .map(m => m.name);
  /* Ice is the exception, and it is the important one. Nothing is *built* out
     of it — the melter drinks it, which is a use the build table cannot see
     and the whole reason to keep a hold full of the cheapest thing there is. */
  if (matKey === "ice") out.unshift("THE MELTER DRINKS IT");
  return out;
};

function buyModule(key) {
  const m = moduleSpec(key);
  if (!m || !surv.docked) { gameSound("hit"); return false; }
  /* The counter, at home, is the fusion core's room. The shop does not list
     parts while it is dark — see `market` in `surveyState` — and this is the
     same refusal one floor down, for anything that reaches the till another
     way. */
  if (surv.docked.home && !stationHas("counter")) {
    chatter("No power to the counter. It wants a " +
            (partSpec("core") || {}).name + ".", "#ff8f77");
    gameSound("hit");
    return false;
  }
  /* Nobody sells a find-only part, and until this line nothing said so: the
     shelf listed them and this took the money — or took nothing, since a part
     with no buyer has no price. */
  if (!sellsIt(m)) {
    chatter("Nobody sells one of those. " + m.name + " has to be found.",
            "#ff8f77");
    gameSound("hit");
    return false;
  }
  if (m.deep > stationDepth()) {
    chatter("Nobody this close to home stocks one.", "#ff8f77");
    gameSound("hit");
    return false;
  }
  const shelf = shelfOf(surv.docked);
  if (!shelf || !(shelf.parts[key] > 0)) {
    chatter("They are out of those.", "#ff8f77");
    gameSound("hit");
    return false;
  }
  if (surv.cash < m.cost) { gameSound("hit"); return false; }
  // Bought is still carried: there is nowhere else for it to go.
  if (!roomForPart(key)) { noRoomFor(key); return false; }
  surv.cash -= m.cost;
  shelf.parts[key] -= 1;
  storeAdd(key, 1);
  surv.t.refitted = true;
  gameSound("start");
  chatter(m.name + " bought \u2014 " + money(m.cost) + ". Fit it when you like.",
          CASH);
  saveSurveyBook();
  return true;
}

/* ── the ice melter ───────────────────────────────────────────────────────
   Phase 5.6. Water was bought at a station and that was the only way, which
   made a long haul a question about station spacing rather than about what you
   are carrying. This turns ICE — the cheapest thing in the game and the thing
   nobody wants to buy — straight into the tank.

   Slow on purpose. It is not a tap; it is the reason a hold full of ice is
   worth keeping rather than dumping, and the reason you can go somewhere with
   no station and come back. One unit of ice is a useful stretch of water, and
   the melter only runs when the tank has room, so it never quietly eats the
   hold you were going to sell. */
const MELT_SECONDS = 26;      // of water, per unit of ice
const MELT_EVERY = 1.8;       // seconds of running per unit of ice taken

/* A unit of ice is a unit. The first cut of this took a *fraction* of one every
   frame, which is the sort of bug that looks like a rounding nicety and is not:
   a hold of 9.5875 ice printed itself into the interface as `ICE x9.5875`, made
   the cargo count a fraction of a unit, and paid out fractional cash when it was
   sold — one wrong decision leaking into three places that had every right to
   assume a material is a whole thing.

   So the clock is on the melter rather than on the hold. It runs, and every
   `MELT_EVERY` seconds it takes exactly one unit and puts exactly one unit's
   worth of water in the tank. */
function surveyMelt(dt) {
  if (!mods().melt) { surv.meltClock = 0; return; }
  const me = ships[0];
  if (!me.alive || surv.death) return;
  if (surv.water >= WATER_FULL) return;
  if ((surv.hold.ice || 0) <= 0) return;

  surv.meltClock = (surv.meltClock || 0) + dt;
  surv.melting = 0.3;
  if (surv.meltClock < MELT_EVERY) {
    // Running, but nothing has come out of it yet.
    if (!surv.meltSaid) {
      surv.meltSaid = true;
      chatter("Melter running \u2014 the ice is worth more as water.", "#87d8ff");
    }
    return;
  }
  surv.meltClock = 0;
  surv.hold.ice -= 1;
  surv.water = Math.min(WATER_FULL, surv.water + MELT_SECONDS);
  /* Said once when it starts rather than every frame it runs: a line of chatter
     a second is not information. */
  if (!surv.meltSaid) {
    surv.meltSaid = true;
    chatter("Melter running \u2014 the ice is worth more as water.", "#87d8ff");
  }
  /* Written when it stops rather than on every unit. A unit is 1.8 seconds, and
     a localStorage write every 1.8 seconds for the whole of a long haul is a
     cost with nothing to show for it — losing the last unit to a closed tab is
     not a loss anybody would notice. */
  if (surv.hold.ice <= 0) {
    surv.hold.ice = 0;
    surv.meltSaid = false;
    chatter("Out of ice.", NEBULA);
    saveSurveyBook();
  }
}

/* Anything you own and are not flying. Kept as counts rather than as a list,
   because two pulse coils are two pulse coils and nothing about one of them
   is different from the other. */
const storeCount = key => (surv && surv.store && surv.store[key]) || 0;
/* Something you now know exists. Returns whether this was news, so a caller
   marking a whole shelf can write the book once rather than thirty times. */
function markSeen(key) {
  if (!surv || !moduleSpec(key) || surv.seen.has(key)) return false;
  surv.seen.add(key);
  return true;
}

function storeAdd(key, n) {
  if (!moduleSpec(key)) return false;
  // Holding one is the strongest possible way of having met it.
  markSeen(key);
  surv.store[key] = Math.max(0, storeCount(key) + (n === undefined ? 1 : n));
  if (!surv.store[key]) delete surv.store[key];
  return true;
}

/* Taking one off. Pulling is quick — it is putting one *in* that takes the
   time — so the slot is simply empty afterwards and the part is back in the
   crate. A part pulled while it was still fitting is a part you never got:
   the progress is lost, which is what makes starting a fit a decision. */
function pullModule(i) {
  const sl = surv.slots[i];
  if (!sl) return false;
  /* A fitted part weighs nothing and a carried one weighs something, so taking
     one off is the one move in the game that can *fill* a hold. Refused rather
     than allowed to overflow — the alternative is a hold reading 64/60, which
     is a cap that is not a cap. */
  if (!roomForPart(sl.key)) { noRoomFor(sl.key); return false; }
  surv.slots[i] = null;
  storeAdd(sl.key, 1);
  applyRefit(ships[0]);
  // A part can bring a control with it, and pulling it has to take the
  // control away in the same breath — see `revAvailable`.
  padApply();
  gameSound("hit");
  chatter(moduleSpec(sl.key).name + (sl.fit > 0 ? " — fit abandoned" : " removed"),
          sl.fit > 0 ? "#ff8f77" : NEBULA);
  saveSurveyBook();
  return true;
}

function fitModule(i, key) {
  if (i < 0 || i >= SLOTS) return false;
  const m = moduleSpec(key);
  if (!m || storeCount(key) <= 0) { gameSound("hit"); return false; }
  // The slot has to be free. Swapping is two actions, and it should be: the
  // second one is the one that costs you.
  if (surv.slots[i]) { gameSound("hit"); return false; }
  /* One of a kind, on the ship. Two pulse coils in two slots would be a way
     to spend slots rather than choose between them, and the choosing is the
     whole of it. */
  if (surv.slots.some(sl => sl && sl.key === key)) {
    chatter("One of those is already fitted.", "#ff8f77");
    gameSound("hit");
    return false;
  }
  storeAdd(key, -1);
  const instant = LEV_ONLY || !!surv.docked;
  surv.slots[i] = { key, fit: instant ? 0 : fitSeconds(key) };
  applyRefit(ships[0]);
  padApply();
  gameSound(instant ? "win" : "start");
  chatter(instant
    ? m.name + " fitted."
    : m.name + " — " + fitSeconds(key) + "s to fit, and that slot is dead " +
      "until it lands.", instant ? CASH : "#ffcb42");
  surv.t.fitted = true;
  saveSurveyBook();
  return true;
}

/* Arriving at a station finishes whatever was in progress, because a station
   is instant. Coming in mid-fit should land it, not restart it. */
function stationFinishesFits() {
  let any = false;
  for (const sl of surv.slots) {
    if (sl && sl.fit > 0) { sl.fit = 0; any = true; }
  }
  if (any) {
    applyRefit(ships[0]);
    padApply();
    chatter("The station hands finished what you started.", CASH);
    saveSurveyBook();
  }
}

/* ── battles have an end ─────────────────────────────────────────────────
   A battle you have never seen is still being fought — it has been going on
   for as long as you were not looking, which is why finding one is worth
   doing. From the moment you *do* see it, it has a clock, and the clock runs
   whether you stay and watch or not. Fly off for ten minutes and come back
   and it is over: wrecks, no ships, and sometimes a name.

   That is the whole point of it. A fight that waited for you would be a set
   piece; one that finishes without you is a war. */
