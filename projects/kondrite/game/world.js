"use strict";

/* KONDRITE — THE WORLD STATE
   ─────────────────────────────────────────────────────────────────────────────
   The world record, how far out Survey sits, the empty room, wrecked hulls,
   the 3.4 ramp and the clock a menu runs on.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── world ───────────────────────────────────────────────────────────── */
let state = "title";        // title | count | playing | paused | menu | over
let localPause = false;     // true only when this machine did the pausing
let mode = MODES.survival;
let arena = mode.arena;
let U = 1;                  // unit scale for the current arena
let bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
// How fast each wall is closing, in world units a second. Zero unless the
// battle royale wall is actually moving. `bounceInBounds` reads it.
const wallPush = { x: 0, y: 0 };
let pendingMode = null;

let ships = [], rocks = [], bullets = [], bits = [], hazards = [], motes = [];
let killFeed = [];
let soundEvents = [], soundEventSeq = 0;
let score = 0, lives = 0, wave = 0, ffCount = 0, players = 2;
let clock = 0, topUp = 0;
let banner = null;
// The elimination card for this screen. Set only when the seat driven from
// this machine runs out of stocks, so it never fires for a respawn.
let terminated = null;
let outcome = null;         // set when a match ends
let camp = null;            // campaign level controller, null outside campaign
let campaignDifficulty = "easy";   // easy | hard | impossible — chosen per run
let pickups = [];           // campaign salvage drops
let comms = [];             // campaign radio chatter, a small scrolling log
let shake = 0;              // screen-shake magnitude, decays every frame
let slowScale = 1, slowTimer = 0;   // brief slow-motion on the biggest beats
let campRun = null;         // the through-line a campaign's missions share
let campContinue = false;   // true only while NEXT/RETRY continues that run

/* The camera is the one view of the world. In Survival it sits
   still and frames the whole arena. In Battle Royale it follows `watching`
   through a map far bigger than the screen; online, that is the ship owned or
   spectated by this machine. */
let cam = { x: 0, y: 0, scale: 1, rot: 0, goalScale: 1 };

/* ── how far out Survey sits ──────────────────────────────────────────────
   Every other mode is drawn at 1:1 and always has been. Survey should not be:
   its wells are now large enough that at 1:1 one fills the screen before you
   have any chance to read it, and a hazard you meet at the edge of the frame
   is a hazard you cannot plan around. Pulled back to 0.72 by default, which
   roughly doubles the ground you can see.

   It is a setting rather than a constant because how far back you want to sit
   is a preference and not a fact — and because ship size is going to feed
   into this later, so the number needs a home either way. */
/* ── the empty room ───────────────────────────────────────────────────────
   `?leviathan=1` builds a sector with **nothing in it but the Leviathan**, and
   parks you off its bow.

   It is a looking tool, not a game mode. The Leviathan is nine thousand units
   of authored hull and the only way to judge it — the proportions, the way the
   plates read at distance, whether the corridors are legible from outside —
   is to fly around it with nothing else on the screen. In an ordinary sector
   it is forty thousand units away with wells, rock, traffic and a war between
   you and it.

   Three things it deliberately does:

     · **it cannot touch your sector.** It writes to its own key, so the run
       you are half way through is not overwritten by an afternoon of looking
       at a hull.
     · **nothing else is generated.** Not thinned — generated and then emptied,
       chunk by chunk, before the landmark is built, so the Leviathan's own
       furniture survives and everything else in that chunk never existed.
     · **nothing is trying to kill you**, including the clock: no hunters, no
       battles, no grudges, and the tanks do not drain. You are looking at a
       model, and a model should not starve you. */
/* ── whole, or wrecked ────────────────────────────────────────────────────
   **The ship comes first and the wreck is made out of it.** This hull is going
   to be something you can fly one day, so the intact one is the real object
   and the derelict is that object plus what happened to it — never the other
   way round, or the damage ends up load-bearing and the ship can never be
   un-wrecked.

   So everything below builds her whole, and the two injuries are applied at
   the end, behind this flag. `?intact=1` turns them off and hands back the
   ship as she left the yard, which is what the plan view's INTACT button
   asks for. */
const LEV_INTACT = (() => {
  try { return new URLSearchParams(location.search).has("intact"); }
  catch (_) { return false; }
})();

const LEV_ONLY = (() => {
  try { return new URLSearchParams(location.search).has("leviathan"); }
  catch (_) { return false; }
})();

const SURVEY_ZOOMS = [
  { s: 1.00, name: "CLOSE" },
  { s: 0.86, name: "NEAR" },
  { s: 0.72, name: "STANDARD" },
  { s: 0.58, name: "WIDE" },
  { s: 0.46, name: "DISTANT" }
];
/* The empty room gets two steps nobody else does. At the widest the game
   allows, the window is about 2,200 units across and the Leviathan is 9,200
   long — a quarter of it at a time, which is the right amount for flying
   through and the wrong amount for looking at the shape of the thing. These
   two are no use in a real sector, where a rock you cannot see is a rock you
   fly into; in a sector with nothing in it they cost nothing. */
if (LEV_ONLY) {
  SURVEY_ZOOMS.push({ s: 0.34, name: "FAR" },
                    { s: 0.20, name: "THE WHOLE HULL" });
}
let surveyZoom = LEV_ONLY ? 0.20 : 0.72;

/* ── 3.4, and the open question in the plan ───────────────────────────────
   A bigger ship pulls the camera back. Ric flagged this himself as something
   that might simply not work at this scale, so it is built the way he asked
   for it: behind the Settings zoom rather than instead of it, as a factor on
   whatever you chose, so both can be felt together and this one can be cut
   without taking the control with it.

   The curve is deliberately weaker than the size it responds to — a Cathedral
   is three times a Skiff and gets about half again the view, not three times —
   because a capital that showed the whole sector would make the small ships
   feel blind rather than nimble. */
const shipZoomFactor = () => {
  if (!surv) return 1;
  const size = shipSpec(surv.ship).size;
  return 1 / (1 + (size - 1) * 0.42);
};

function surveyZoomName() {
  const z = SURVEY_ZOOMS.reduce((a, b) =>
    Math.abs(b.s - surveyZoom) < Math.abs(a.s - surveyZoom) ? b : a);
  return z.name;
}
function cycleSurveyZoom() {
  const i = SURVEY_ZOOMS.findIndex(z => Math.abs(z.s - surveyZoom) < 0.01);
  surveyZoom = SURVEY_ZOOMS[(i + 1) % SURVEY_ZOOMS.length].s;
  if (mode && mode.survey) cam.scale = surveyZoom * shipZoomFactor();
  try { localStorage.setItem("kondrite.survey.zoom", String(surveyZoom)); }
  catch (_) {}
}
try {
  const z = parseFloat(localStorage.getItem("kondrite.survey.zoom"));
  if (z >= 0.4 && z <= 1.2) surveyZoom = z;
} catch (_) {}
let watching = 0;
let botPick = 0;        // bots to add on the setup screen
/* Two picks, because there are two pages now. The front page offers the game
   and the machines; the simulators page offers the two lanes. They were one
   variable while the lanes *were* the front page, and one variable would have
   meant arrowing on the title quietly choosing a lane. */
let titlePick = 0;      // which front-page door has focus; there is one now
let arcadePick = 0;     // which cabinet the room in a station has focus on
let modeLane = "solo";  // which lane's cards the mode page is showing
let modePick = 0;       // keyboard focus among those cards
let modeHover = -1;     // pointer focus, which beats the keyboard while set
let levelPick = 0;      // visible focus on the campaign level-select screen
let countPick = 0;      // zero-based local-player choice
let survivalFriendlyFire = true;
let lastSetup = { modeKey: "survival", humans: 1, bots: 0 };
let backFrom = "title"; // which screen the controls page returns to

function soundPan(x) {
  if (!mode.camera || typeof x !== "number") return 0;
  const halfView = SCREEN_W / (2 * Math.max(0.01, cam.scale));
  return Math.max(-1, Math.min(1, (x - cam.x) / halfView));
}

/* If you can see it you can hear it, and if you cannot, you cannot. A sound
   with a place in the world is dropped when that place is off the screen —
   a war two screens away is silent until you fly into it. A sound with no
   place (a menu, a purchase, the round starting) is not in the world and
   always plays. A thing right on the rim still counts: it is half in view,
   and SOUND_RIM is how much of a half. */
const SOUND_RIM = 24;   // screen pixels
function audible(x, y) {
  if (!mode.camera || typeof x !== "number" || typeof y !== "number") return true;
  return onScreen(x, y, SOUND_RIM / Math.max(0.01, cam.scale));
}

function gameSound(kind, x, y) {
  if (audible(x, y)) playSfx(kind, soundPan(x), typeof x === "number");
  /* The host sends every sound, seen or not: a guest has its own camera and
     decides for itself what it can see. */
  if (net.role === "host") {
    soundEvents.push({ q: ++soundEventSeq, k: kind, x, y, at: clock });
    if (soundEvents.length > 32) soundEvents.shift();
  }
}

const MODE_KEYS = ["survival", "royale"];

/* The title screen is one list, and online is the third thing on it rather
   than a pair of buttons off to the side — you decide you want to play with
   other people first, and who is hosting is a question for the lobby. */

function chooseMode(key) {
  pendingMode = key;
  // `titlePick` is which *lane* the front page is on, not which mode — a mode
  // index written into it here would send you back to the wrong lane.
  countPick = 0;
  botPick = 0;
  state = "count";
}

function startCountChoice() {
  const n = Math.min(humanMax(), countPick + 1);
  const m = MODES[pendingMode];
  // A mission fields its own fleets; it never takes free-for-all filler bots.
  const bots = m.campaign ? 0 : botPick;
  const allowed = n >= m.minPlayers ||
    n + Math.min(bots, MAX_PLAYERS - n) >= m.minPlayers;
  if (allowed) startGame(pendingMode, n, bots);
}

function selectHumanCount(n) {
  countPick = Math.max(0, Math.min(humanMax() - 1, n - 1));
  botPick = Math.min(botPick, MAX_PLAYERS - (countPick + 1));
}

function cycleBots() {
  const max = MAX_PLAYERS - (countPick + 1);
  botPick = max > 0 ? (botPick + 1) % (max + 1) : 0;
}

function paintFriendlyFireButton() {
  const button = document.getElementById("onlineFriendlyFire");
  if (button) {
    button.textContent = "friendly fire: " + (survivalFriendlyFire ? "on" : "off");
  }
}

function toggleFriendlyFire() {
  survivalFriendlyFire = !survivalFriendlyFire;
  paintFriendlyFireButton();
}

const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2;

function spawnPoint(i, n) {
  const cx = arena.w / 2, cy = arena.h / 2;
  if (n === 1) return { x: cx, y: cy, a: -Math.PI / 2 };
  const R = Math.min(arena.w, arena.h) * 0.3;
  const t = -Math.PI / 2 + (i / n) * Math.PI * 2;
  // Facing inward: in battle royale everyone starts looking at everyone else.
  return { x: cx + Math.cos(t) * R, y: cy + Math.sin(t) * R, a: t + Math.PI };
}

/* Which colour each seat is wearing. Locally the seat IS the colour and this
   is the identity mapping — the second player at the keyboard is green
   because green's keys are the second set. Online nobody is sharing a
   keyboard, so a seat can wear any colour it likes as long as no two seats
   wear the same one. The host owns this table and sends it to everyone. */
let skins = PLAYERS.map((_, i) => i);
const skinOf = seat => PLAYERS[skins[seat]] || PLAYERS[seat] || PLAYERS[0];

/* What each seat is called. Online you are a person, not a colour — you
   pick the colour, but "TOM WINS" is the sentence anybody actually wants to
   read. Empty falls back to the colour, which is what local play uses:
   two people at one keyboard already know which of them is green. */
let names = [];
const nameOf = seat => names[seat] || skinOf(seat).label;

/* Which **account** each seat is, which is a different question from what it
   is called. Names are what you read on the screen; this is what a board
   credits, and the two must never be confused — two people can type the same
   name into a lobby and neither of them is the other.

   It is here so that every client, host and guest alike, knows who it is
   sitting with: a witnessed score is one client reporting what *another*
   player got, and it cannot report about somebody it cannot name. Empty for
   anyone not signed in and for every seat in a local game, and an empty seat
   is simply not reported — see `matchReport`. */
let accounts = [];
const myAccount = () => {
  const who = cloud && cloud.enabled() && cloud.session();
  return (who && who.userId) || "";
};

/* The match everybody is agreeing about. Made by the host when the match
   starts, sent out with the world, and the thing every report is filed
   under — two clients describing the same game have to be describing the
   same *id* or there is nothing for Postgres to find agreement in. */
let matchId = null;
const newMatchId = () => {
  /* A v4 uuid, because that is the column's type. `crypto.randomUUID` is not
     on older Safari, so this falls back rather than throwing in the one place
     a throw would stop a match starting. */
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    out += i === 8 || i === 13 || i === 18 || i === 23 ? "-"
         : i === 14 ? "4"
         : i === 19 ? hex[(Math.random() * 4 | 0) + 8]
         : hex[Math.random() * 16 | 0];
  }
  return out;
};

/* Who has said they're ready. Seat 0 is the host and never appears here —
   the host doesn't ready up, the host is the start button. Like `skins` and
   `names` this is the host's table, sent out with every seat broadcast. */
let ready = [];
const allReady = () => {
  const N = window.KondriteNet;
  if (!N) return false;
  return N.host.links.every(l => l.seat == null || !l.open || ready[l.seat]);
};

/* Names come off other people's keyboards, so they are cut to size here and
   nowhere else. Drawn to a canvas and written with textContent, never as
   markup — there is no path from a name to anything that runs. */
const NAME_MAX = 12;
function tidyName(raw) {
  return String(raw == null ? "" : raw)
    .replace(/[^\p{L}\p{N} '\-]/gu, "")   // letters, digits, space, apostrophe, dash
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX)
    .toUpperCase();
}

const NAME_STORE = "kondrite.name.v1";
let myName = "";

function loadName() {
  try { myName = tidyName(localStorage.getItem(NAME_STORE) || ""); } catch (_) {}
}

function saveName() {
  try { localStorage.setItem(NAME_STORE, myName); } catch (_) {}
}

/* What a game is called in the room list. Strangers read this one, so it is
   cut to size here as well as at the service — and like every other piece of
   text off the network it reaches the page through textContent. */
const TITLE_MAX = 24;
const tidyTitle = raw =>
  String(raw == null ? "" : raw)
    .replace(/[^\p{L}\p{N} '\-!?.]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TITLE_MAX);

function makeShip(i, n, look) {
  const def = look || skinOf(i);
  const p = spawnPoint(i, n);
  return {
    id: i,
    colour: def.colour,
    label: def.label,
    name: nameOf(i),
    keys: def,
    // Whose fingers drive this ship. Locally every ship reads the keyboard;
    // over a network only one of them does and the rest arrive as messages.
    // Everything downstream reads `input` and doesn't care which it was.
    localKeys: def,
    input: { l: false, r: false, th: false, f: false },
    x: p.x, y: p.y, a: p.a,
    vx: 0, vy: 0,
    alive: true,
    dead: false,           // out of the match for good
    stocks: ROYALE_STOCKS, // battle royale only; co-op uses the shared pile
    hull: ROYALE_HULL,     // bullet/asteroid hits left in the current stock
    maxHull: ROYALE_HULL,  // what a respawn restores it to
    // Campaign only, ignored everywhere else. `team` is the side (0 = yours,
    // 1 = enemy); `kind` is what the ship is; `skill` scales bot competence
    // from 0 (hopeless) to 1 (the free-for-all bots). `role` steers campaign
    // AI. `shielded` gates damage on a mothership while its turrets stand.
    team: 0, kind: "fighter", skill: 1, role: null,
    human: true, shielded: false,
    goalX: null, goalY: null,
    // Campaign salvage buffs, seconds remaining. Ignored outside a mission.
    buffRapid: 0, buffHeavy: 0,
    kills: 0,
    deaths: 0,
    envDeaths: 0,
    killedBy: null,
    survivedFor: null,
    respawn: 0,
    invuln: INVULN,
    cool: 0,
    burstLeft: 0,
    thrusting: false
  };
}

/* A rock's silhouette is derived from its id rather than rolled at random.
   Over a network that matters: the host sends an id and the guest builds a
   rock with exactly the same outline and the same cracks, so nobody has to
   transmit thirteen vertices per rock, twenty times a second. */
function seeded(n) {
  let s = (n * 1831565813 + 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rockSeq = 0;

/* What a rock is shaped like, and it is the loudest thing a region says. Every
   rock in the game was the same lumpy polygon with its radii jittered between
   0.72 and 1.24 — so a field in one place looked exactly like a field in
   another, whatever else was different about them.

   `shard` alternates long spikes and deep notches: angular silhouettes with
   edges you can see a turn around. `round` flattens the jitter to almost
   nothing: smooth circles, broad curved channels between them, and a sky that
   is unmistakably somewhere else. The collision radius is untouched by either,
   so what a rock *does* is the same everywhere and only what it looks like
   changes. */
function rockLooks(id, size, style) {
  const spec = rockSpec(size);
  const rnd = seeded(id * 977 + spec.verts);
  const pick = (a, b) => a + rnd() * (b - a);
  const shape = [];
  for (let i = 0; i < spec.verts; i++) {
    shape.push(style === "shard" ? (i % 2 ? pick(0.44, 0.62) : pick(1.18, 1.42))
             : style === "round" ? pick(0.97, 1.03)
             : pick(0.72, 1.24));
  }
  // One crack per hit it can take, drawn as it wears down.
  const cracks = [];
  for (let i = 0; i < spec.hp; i++) {
    const t = pick(0, Math.PI * 2), span = pick(0.7, 1.6);
    cracks.push({
      x1: Math.cos(t) * pick(0.25, 0.95), y1: Math.sin(t) * pick(0.25, 0.95),
      x2: Math.cos(t + span) * pick(0.3, 0.95), y2: Math.sin(t + span) * pick(0.3, 0.95)
    });
  }
  return { shape, cracks };
}

function makeRock(size, x, y, id, style) {
  const spec = rockSpec(size);
  const dir = rand(0, Math.PI * 2);
  const spd = rand(spec.spd[0], spec.spd[1]) * U * (mode.closing ? 1 : waveSpeed());
  if (id === undefined) id = ++rockSeq;
  const looks = rockLooks(id, size, style);
  return {
    id, size, x, y,
    vx: Math.cos(dir) * spd,
    vy: Math.sin(dir) * spd,
    r: spec.r * U,
    a: rand(0, Math.PI * 2),
    spin: rand(-0.9, 0.9),
    hp: spec.hp, maxHp: spec.hp, flash: 0,
    shape: looks.shape, cracks: looks.cracks
  };
}

function spawnRock(size, x, y) {
  const spec = rockSpec(size);
  const p = x == null || y == null ? openSpot(spec.r * U) : { x, y };
  rocks.push(makeRock(size, p.x, p.y));
}

function spawnRoyaleRock(x, y) {
  spawnRock(randomRoyaleRockSize(), x, y);
}

// Somewhere inside the current wall, not on top of anybody.
function openSpot(clearance) {
  for (let tries = 0; tries < 60; tries++) {
    const x = rand(bounds.x0 + clearance, bounds.x1 - clearance);
    const y = rand(bounds.y0 + clearance, bounds.y1 - clearance);
    if (ships.some(s => s.alive && gap2(x, y, s.x, s.y) < (190 * U) ** 2)) continue;
    // Don't drop a rock straight down a well — it's eaten before it's drawn.
    if (hazards.some(h => hazardActive(h) &&
                        dist2(x, y, h.x, h.y) < (h.kill + clearance + 60) ** 2)) continue;
    return { x, y };
  }
  return { x: rand(bounds.x0, bounds.x1), y: rand(bounds.y0, bounds.y1) };
}

/* ── the ramp ─────────────────────────────────────────────────────────────
   Rocks get faster every wave until they reach their original speed cap.
   This is deliberately independent from ship handling, so slowing a ship
   never quietly slows the asteroid field with it. Past the cap the field
   grows instead. There is always another rock. */
const WAVE_RAMP = 15;
const ROCK_SPEED_CAP = 520;
const ROCK_TOP = ROCK_SPEED_CAP / ROCK.small.spd[1];

function waveSpeed() {
  // Royale has no waves, so it flies at the plain speeds in the table.
  const w = Math.max(1, Math.min(wave, WAVE_RAMP));
  return 1 + (w - 1) * (ROCK_TOP - 1) / (WAVE_RAMP - 1);
}

function spawnWave() {
  wave++;
  // No ceiling. Once they can't get faster, there are simply more of them.
  const n = 3 + wave;
  for (let i = 0; i < n; i++) {
    const p = openSpot(rockSpec("big").r * U);
    rocks.push(makeRock("big", p.x, p.y));
  }
  banner = {
    text: "WAVE " + wave,
    // The speed ramp is now full; later waves add bodies instead.
    sub: wave === WAVE_RAMP ? "the small ones are at full speed now" : null,
    t: wave === WAVE_RAMP ? 2.4 : 1.6,
    colour: wave === WAVE_RAMP ? "#ff8f77" : "#ffe56d"
  };
}

function placeHazards(count) {
  hazards = [];
  // Roughly one black hole for every two stars, none of them close enough to
  // a spawn point that a player is in a well before they've touched anything.
  let holeIndex = 0;
  for (let i = 0; i < count; i++) {
    const kind = i % 2 === 1 ? "hole" : "star";
    const holeSizeIndex = kind === "hole" ? holeIndex++ : 0;
    const holeSize = kind === "hole" ? (holeSizeIndex % 2 ? "large" : "small") : "sun";
    const spec = hazardSpec(kind, holeSizeIndex);
    let best = null, bestGap = -1;
    for (let tries = 0; tries < 80; tries++) {
      const x = rand(arena.w * 0.12, arena.w * 0.88);
      const y = rand(arena.h * 0.12, arena.h * 0.88);
      // Keep clear of every spawn point and of the other hazards.
      let gap = Infinity;
      for (let p = 0; p < players; p++) {
        const sp = spawnPoint(p, players);
        gap = Math.min(gap, Math.hypot(x - sp.x, y - sp.y));
      }
      for (const h of hazards) gap = Math.min(gap, Math.hypot(x - h.x, y - h.y) * 0.8);
      if (gap > bestGap) { bestGap = gap; best = { x, y }; }
      if (gap > spec.reach) break;
    }
    hazards.push({
      kind, x: best.x, y: best.y,
      kill: spec.kill, reach: spec.reach, mass: spec.mass, soft: spec.soft,
      fill: spec.fill || null,
      size: holeSize,
      phase: rand(0, Math.PI * 2)
    });
  }
}

function startGame(modeKey, n, botCount) {
  // The tap that got here is the gesture a fullscreen request needs, so this
  // has to happen now rather than once the match is up.
  enterPlayFullscreen();
  // Enter and Space are both menu confirmation keys and default fire keys.
  // Do not carry the keydown that starts the match into its first frame.
  keys.clear();
  touch.l = touch.r = touch.th = touch.f = false;
  padRelease();

  mode = MODES[modeKey];
  if (modeKey === "survival") mode.friendlyFire = survivalFriendlyFire;
  arena = mode.arena;
  // With a camera the world is simply big, so ships stay their natural size.
  // Without one the whole arena is squeezed onto the screen, so everything
  // grows a little to survive the squeeze.
  U = mode.camera ? 1 : Math.sqrt(arena.w / 1000);
  bounds = { x0: 0, y0: 0, x1: arena.w, y1: arena.h };

  // Humans first, then bots fill the remaining ships. Five in total, always.
  // Survey is the exception and it is not negotiable: one chart, one
  // catalogue, one ship, however many were asked for.
  const humans = mode.survey ? 1 : Math.max(1, Math.min(MAX_PLAYERS, n));
  const bots = mode.survey
    ? 0 : Math.max(0, Math.min(MAX_PLAYERS - humans, botCount || 0));
  lastSetup = { modeKey, humans, bots };
  players = Math.max(mode.minPlayers, humans + bots);
  ships = [];
  for (let i = 0; i < players; i++) {
    const s = makeShip(i, players);
    if (i >= humans) { s.bot = true; s.localKeys = null; }
    ships.push(s);
  }

  rocks = []; bullets = []; bits = []; hazards = [];
  score = 0; wave = 0; ffCount = 0; clock = 0; topUp = 0;
  lives = 2 + 2 * players;   // co-op only
  banner = null; terminated = null; outcome = null; killFeed = []; camp = null;
  pickups = []; comms = []; shake = 0; slowScale = 1; slowTimer = 0;
  cam.goalScale = 1;
  soundEvents = []; soundEventSeq = 0;
  net.outSnapSeq = net.outRockSeq = net.outInputSeq = 0;
  net.lastSnapSeq = net.lastRockSeq = net.lastSoundSeq = 0;
  watching = 0;
  state = "playing";

  if (mode.hazards) { placeHazards(mode.hazards); seedMotes(); }
  else motes = [];

  // Frame the camera before the first frame is drawn, or it visibly slides
  // in from the corner of the map.
  cam.scale = mode.camera
    ? (mode.survey ? surveyZoom * shipZoomFactor() : 1)
    : Math.min(SCREEN_W / arena.w, SCREEN_H / arena.h);
  if (mode.camera) {
    cam.x = ships[0].x; cam.y = ships[0].y;
    cam.rot = camRotates() ? -Math.PI / 2 - ships[0].a : 0;
    clampCam();
  } else {
    cam.x = arena.w / 2; cam.y = arena.h / 2; cam.rot = 0;
  }

  if (mode.survey) {
    // Survey builds its own space, chunk by chunk, and re-seeds the motes
    // every time the loaded block moves — so it goes through neither
    // placeHazards nor the one-shot seedMotes here.
    setupSurvey();
    surveyIntro();
  } else if (mode.campaign) {
    // The humans are placed already; the mission builds the fleets, the
    // objective and the reinforcement reserves around them.
    setupCampaign(modeKey, humans);
  } else if (mode.closing) {
    // Battle royale keeps a standing rock population instead of waves. The
    // field is never cleared, and the last surviving ship ends the match.
    // Sixteen screens of map needs sixteen screens' worth of rocks, or long
    // stretches of the opening fight would be empty.
    for (let i = 0; i < ROYALE_ROCKS; i++) {
      spawnRoyaleRock();
    }
    banner = { text: "LAST SHIP FLYING", sub: "two-hit hulls · watch the minimap",
               t: 2.6, colour: "#ffe56d" };
  } else {
    spawnWave();
  }

  /* The opening spawn ring is laid out before there are any hazards or rocks
     to avoid, so it is checked once everything exists. Rocks are seeded away
     from ships already; a hazard is placed best-effort and can still land on
     a ring point, which is a sun you are standing in before the match has
     started. Same rules as any other spawn, applied once. */
  if (mode.hazards) {
    for (const s of ships) {
      if (wellGapAt(s.x, s.y) >= 0 && rockGapAt(s.x, s.y) > 95 * U) continue;
      const p = respawnPoint(s);
      s.x = p.x; s.y = p.y; s.a = p.a; s.vx = s.vy = 0;
    }
    if (mode.camera) { cam.x = ships[0].x; cam.y = ships[0].y; clampCam(); }
  }

  playSfx("start", 0);
  matchStarted();
}

/* A match can begin while the page is already in the background: a guest
   that readied up and went to do something else gets its init packet
   wherever it is. `standDown` only ever fired on the way out of the
   foreground, so starting from there has to be said out loud — otherwise
   there are no animation frames and nothing has asked the ticker to run. */
function matchStarted() {
  localPause = false;              // no match begins already paused
  if (document.hidden) standDown();
  checkControls();
}

/* Taking a key off another colour is allowed, and announced when it happens
   — but the colour it was taken from can be left with nothing to fly with,
   and online you don't get to choose which colour you are. Rebind AMBER to
   the arrow keys and GREEN is silently unflyable. Say so at the start of the
   match, rather than leaving someone pressing keys that do nothing. */
function checkControls() {
  const controlled = net.on
    ? [ships[localSeat()]].filter(Boolean)
    : ships.filter(s => s.localKeys && !s.bot);
  const problems = controlled.map(s => ({
    s,
    missing: ACTIONS.filter(a => !s.localKeys[a.field].length)
  })).filter(problem => problem.missing.length);
  if (!problems.length) return;
  const details = problems.map(problem =>
    problem.s.name + ": NO " + problem.missing.map(a => a.name).join(", NO "));
  banner = {
    text: net.on ? "YOUR CONTROLS: " + details[0].split(": ")[1]
                 : details.join(" · "),
    sub: "press C at the title screen to give it a key",
    t: 4.5, colour: "#ff8f77"
  };
}

/* The front page's doors, in the order they are drawn. The game, and the
   settings — the machines used to be the second of these and are in the
   world now. The digits and the arrows both read this list. */
/* ── the clock a menu runs on ─────────────────────────────────────────────
   Not `clock`. The match clock is advanced by `update`, and `update` is only
   called while `state === "playing"` — so on the front page and on the mode
   cards it is **frozen**, and every diorama drawn from it has been a still
   frame since the day they were written. Nobody noticed, because a card 174
   pixels tall showing a motionless ship reads as a small picture. Full bleed
   across a title screen it reads as exactly what it is, which is what Ric
   said: *"why not make it move … just have it continue moving."*

   The wall clock, then, the same one `survey-hud/` reaches for when it has
   to animate something on a parked page. It never stops and it does not care
   whether a match is running. */
const menuClock = () => Date.now() / 1000;

const TITLE_DOORS = [() => playSurvey(),
                     () => { state = openSettings("title"); }];

function menuKey(code) {
  if (state === "title") {
    const d = digit(code);
    if (d >= 1 && d <= TITLE_DOORS.length) { TITLE_DOORS[d - 1](); return; }
    if (code === "ArrowUp" || code === "ArrowLeft" ||
        code === "ArrowDown" || code === "ArrowRight") {
      titlePick = (titlePick + 1) % TITLE_DOORS.length;
    }
    if (code === "Enter" || code === "Space") TITLE_DOORS[titlePick]();
    /* O still opens the lobby from the front page, and it matters more than
       it did: it is now the only way to play with somebody without first
       flying to a station. A shortcut somebody's fingers already know, and
       the one hole left by taking the door off. */
    if (code === "KeyO") openLobby();
    if (code === "KeyC") { state = openSettings("title"); }
  } else if (state === "modes") {
    const rows = laneRows();
    if (code === "Escape" || code === "Backspace") { leaveModes(); return; }
    const d = digit(code);
    if (d >= 1 && d <= rows.length) { modePick = d - 1; playCard(rows[d - 1]); return; }
    if (code === "ArrowLeft" || code === "ArrowUp") {
      modePick = (modePick + rows.length - 1) % rows.length;
      modeHover = -1;                 // the keyboard has taken the row back
    }
    if (code === "ArrowRight" || code === "ArrowDown") {
      modePick = (modePick + 1) % rows.length;
      modeHover = -1;
    }
    if (code === "Enter" || code === "Space") playCard(rows[openCard()]);
    /* The witnessed board, from the page where you pick a game to play with
       other people — which is the only place it means anything. */
    if (code === "KeyB") { openBoards(); return; }
    if (code === "KeyC") { state = openSettings("modes"); }
  } else if (state === "board") {
    if (code === "Escape" || code === "Backspace" || code === "KeyB") {
      state = boardFrom; return;
    }
  } else if (state === "levels") {
    if (code === "Escape" || code === "Backspace") { leaveLevels(); return; }
    const d = digit(code);
    if (d >= 1 && d <= CAMPAIGN_ORDER.length) { chooseMode(CAMPAIGN_ORDER[d - 1]); return; }
    if (code === "ArrowUp" || code === "ArrowLeft") {
      levelPick = (levelPick + CAMPAIGN_ORDER.length - 1) % CAMPAIGN_ORDER.length;
    }
    if (code === "ArrowDown" || code === "ArrowRight") {
      levelPick = (levelPick + 1) % CAMPAIGN_ORDER.length;
    }
    if (code === "Enter" || code === "Space") chooseMode(CAMPAIGN_ORDER[levelPick]);
  } else if (state === "chart") {
    /* The chart is a page you pan around, so the arrows belong to it rather
       than to any menu. `M` closes it the way it opened it, and Escape and
       Backspace both go back to flying. */
    if (code === "Escape" || code === "Backspace" || code === "KeyM") {
      state = "playing"; return;
    }
    if (code === "KeyL") { state = "almanac"; return; }
    if (surveyHUD) surveyHUD.chartKey(code, surveyState());
  } else if (state === "record") {
    if (code === "ArrowDown") {
      surveyHUD.recordScrollBy(60, surveyHUD.recordHeight, surveyHUD.recordView);
      return;
    }
    if (code === "ArrowUp") {
      surveyHUD.recordScrollBy(-60, surveyHUD.recordHeight, surveyHUD.recordView);
      return;
    }
    if (code === "Escape" || code === "Backspace") { state = "playing"; return; }
    if (code === "KeyI" || code === "KeyG") {
      state = "inventory"; surveyHUD && surveyHUD.shipOpened(); return;
    }
    if (code === "KeyL") { state = "almanac"; return; }
    if (code === "KeyM") {
      state = "chart"; surveyHUD && surveyHUD.chartOpened(surveyState()); return;
    }
  } else if (state === "sector") {
    if (code === "ArrowDown") {
      surveyHUD.sectorScrollBy(60, surveyHUD.sectorHeight, surveyHUD.sectorView);
      return;
    }
    if (code === "ArrowUp") {
      surveyHUD.sectorScrollBy(-60, surveyHUD.sectorHeight, surveyHUD.sectorView);
      return;
    }
    if (code === "Escape" || code === "Backspace" || code === "KeyN") { state = "playing"; return; }
    if (code === "KeyM") {
      state = "chart"; surveyHUD && surveyHUD.chartOpened(surveyState()); return;
    }
  } else if (state === "ship") {
    if (code === "ArrowDown") {
      surveyHUD.shipScrollBy(60, surveyHUD.shipHeight, surveyHUD.shipView);
      return;
    }
    if (code === "ArrowUp") {
      surveyHUD.shipScrollBy(-60, surveyHUD.shipHeight, surveyHUD.shipView);
      return;
    }
    if (code === "Escape" || code === "Backspace" || code === "KeyG") {
      state = "playing"; return;
    }
    if (code === "KeyI") {
      state = "inventory";
      surveyHUD && surveyHUD.cargoOpened && surveyHUD.cargoOpened();
      return;
    }
    if (code === "KeyL") { state = "almanac"; return; }
    if (code === "KeyB") {
      state = "craft"; surveyHUD && surveyHUD.craftOpened(); return;
    }
    if (code === "KeyM") {
      state = "chart"; surveyHUD && surveyHUD.chartOpened(surveyState()); return;
    }
  } else if (state === "inventory") {
    if (code === "Escape" || code === "Backspace" || code === "KeyI") {
      state = "playing"; return;
    }
    if (code === "KeyG") {
      state = "ship"; surveyHUD && surveyHUD.shipOpened(); return;
    }
    if (code === "KeyL") { state = "almanac"; return; }
    if (code === "KeyB") {
      state = "craft"; surveyHUD && surveyHUD.craftOpened(); return;
    }
    if (code === "KeyM") {
      state = "chart"; surveyHUD && surveyHUD.chartOpened(surveyState()); return;
    }
    /* The page scrolls, so the arrows move it — a phone drags and a keyboard
       has these. This is the cargo; the ship and the record have their own. */
    if (code === "ArrowDown") {
      surveyHUD.cargoScrollBy(60, surveyHUD.cargoHeight, surveyHUD.cargoView);
      return;
    }
    if (code === "ArrowUp") {
      surveyHUD.cargoScrollBy(-60, surveyHUD.cargoHeight, surveyHUD.cargoView);
      return;
    }
  } else if (state === "craft") {
    /* Back to the sector: building is a thing you do while flying, and the
       world has been running the whole time you were in here. */
    if (code === "Escape" || code === "KeyB") { state = "playing"; return; }
    if (code === "Backspace" || code === "KeyG" || code === "KeyI") {
      state = "inventory"; surveyHUD && surveyHUD.shipOpened(); return;
    }
    if (code === "KeyL") { state = "almanac"; return; }
    if (code === "KeyM") {
      state = "chart"; surveyHUD && surveyHUD.chartOpened(surveyState()); return;
    }
  } else if (state === "hangar") {
    if (code === "Escape" || code === "Backspace") { state = "refit"; return; }
    if (code === "KeyE") { state = "playing"; return; }
    if (surveyHUD) surveyHUD.hangarKey(code, surveyState());
  } else if (state === "missions") {
    /* Back to the inventory rather than to the sector: it was opened from
       there, and a page that drops you two levels out is a page you stop
       opening. Escape closes the lot, which is what Escape means everywhere. */
    if (code === "Backspace") { state = "inventory"; return; }
    if (code === "Escape" || code === "KeyI") { state = "playing"; return; }
    if (code === "KeyL") { state = "almanac"; return; }
    if (code === "KeyM") {
      state = "chart"; surveyHUD && surveyHUD.chartOpened(surveyState()); return;
    }
  } else if (state === "landed") {
    /* The shop's quantity field first: while it has the keyboard, Backspace
       deletes a digit rather than closing the page, and Escape abandons the
       number rather than leaving the world. */
    if (surveyHUD && surveyHUD.shopKey && surveyHUD.shopKey(code)) return;
    if (code === "Escape" || code === "Backspace" || code === "KeyE") {
      state = "playing"; return;
    }
  } else if (state === "lore") {
    // It is a card, not a page. Anything that means "done" closes it.
    if (code === "Escape" || code === "Backspace" || code === "KeyE" ||
        code === "Enter" || code === "Space") {
      state = "playing"; return;
    }
  } else if (state === "died") {
    /* One way on, and it is not Escape. A death screen you can dismiss with
       the key you dismiss everything else with is a death screen you skip
       past without reading, and this one is the only place the run's numbers
       are ever stated. */
    if (code === "Enter" || code === "Space") { surveyRespawn(); return; }
  } else if (state === "arcade") {
    /* The room, and it is a room rather than a page of the ship: `E` closes
       it the way `E` closes a station, and the digits are the cabinets left
       to right. */
    if (code === "Escape" || code === "Backspace" || code === "KeyE") {
      state = "playing"; return;
    }
    const d = digit(code);
    if (d >= 1 && d <= CABINETS.length) { startSim(CABINETS[d - 1].key); return; }
    if (code === "ArrowLeft" || code === "ArrowUp") {
      arcadePick = (arcadePick + CABINETS.length - 1) % CABINETS.length;
    }
    if (code === "ArrowRight" || code === "ArrowDown") {
      arcadePick = (arcadePick + 1) % CABINETS.length;
    }
    if (code === "Enter" || code === "Space") startSim(CABINETS[arcadePick].key);
    /* The two things that came in here when the front page's SIMULATORS door
       came off: the people, and the board they are on. */
    if (code === "KeyP") { openWithPeople(); return; }
    if (code === "KeyB") { openBoards(); return; }
  } else if (state === "stationinv") {
    /* Out of the station entirely, the way the shop leaves. `Backspace` steps
       back to the counter rather than to the sector, because this room was
       reached from it. */
    if (code === "Escape" || code === "KeyE") { state = "playing"; return; }
    if (code === "Backspace") { state = "refit"; return; }
    // The sub-page's own scrolling, so the arrows do what they do everywhere.
    const sub = surveyHUD && surveyHUD.stationTab && surveyHUD.stationTab();
    /* The map tab is the map: zoom, pan, recentre and the pin palette, the
       same keys as the full page. It answered none of them — the arrows went
       to a scroll the map does not have and the rest fell through — so the
       station's map was a picture on a desktop and a picture on a phone. */
    if (sub === "chart" && surveyHUD &&
        surveyHUD.chartKey(code, surveyState())) return;
    const by = code === "ArrowDown" ? 60 : code === "ArrowUp" ? -60 : 0;
    if (by && surveyHUD) {
      if (sub === "inventory") {
        surveyHUD.cargoScrollBy(by, surveyHUD.cargoHeight, surveyHUD.cargoView);
      } else if (sub === "record") {
        surveyHUD.recordScrollBy(by, surveyHUD.recordHeight, surveyHUD.recordView);
      } else if (sub === "sector") {
        surveyHUD.sectorScrollBy(by, surveyHUD.sectorHeight, surveyHUD.sectorView);
      } else if (sub === "ship") {
        surveyHUD.shipScrollBy(by, surveyHUD.shipHeight, surveyHUD.shipView);
      }
      return;
    }
  } else if (state === "wormhole") {
    if (code === "Escape" || code === "KeyE") { state = "playing"; return; }
    if (code === "Backspace") { state = "refit"; return; }
  } else if (state === "refit") {
    // See the note on `landed`: a field with the keyboard keeps it.
    if (surveyHUD && surveyHUD.shopKey && surveyHUD.shopKey(code)) return;
    if (code === "Escape" || code === "Backspace" || code === "KeyE") {
      state = "playing"; return;
    }
    if (surveyHUD) surveyHUD.refitKey(code, surveyState());
  } else if (state === "almanac") {
    if (code === "Escape" || code === "Backspace" || code === "KeyL") {
      // An open entry is what Escape closes first; the page goes next.
      if (surveyHUD && surveyHUD.almanacDetailOpen()) {
        surveyHUD.almanacCloseDetail(); return;
      }
      state = "playing"; return;
    }
    if (code === "KeyM") {
      state = "chart"; surveyHUD && surveyHUD.chartOpened(surveyState()); return;
    }
    if (surveyHUD) surveyHUD.almanacKey(code, ALMANAC);
  } else if (state === "controls") {
    controlsKey(code);
  } else if (state === "thumb") {
    // One way out, and it is back to the page you came in from. The pad
    // screen is a room off the settings page now, not a rival to it.
    if (code === "Escape" || code === "KeyC" || code === "Backspace" ||
        code === "Enter" || code === "NumpadEnter") {
      state = "controls";
    }
  } else if (state === "count") {
    if (code === "KeyC") { state = openSettings("count"); return; }
    const d = digit(code);
    if (code === "ArrowLeft" || code === "ArrowUp") {
      selectHumanCount((countPick + humanMax() - 1) % humanMax() + 1);
    }
    if (code === "ArrowRight" || code === "ArrowDown") {
      selectHumanCount((countPick + 1) % humanMax() + 1);
    }
    if (code === "KeyB") {
      cycleBots();
    }
    // Difficulty by key on a mission's setup screen.
    if (MODES[pendingMode] && MODES[pendingMode].campaign) {
      if (code === "KeyE") campaignDifficulty = "easy";
      if (code === "KeyH") campaignDifficulty = "hard";
      if (code === "KeyI") campaignDifficulty = "impossible";
    }
    // Battle royale needs someone to fight — but a bot counts as someone.
    if (d >= 1 && d <= humanMax()) selectHumanCount(d);
    if (code === "Enter" || code === "Space") startCountChoice();
    if (code === "Escape" || code === "Backspace") state = countBack();
  } else if (state === "over") {
    // On a mission-cleared screen, N flies straight into the next one.
    if (code === "KeyN" && outcome && outcome.kind === "victory") {
      const idx = CAMPAIGN_ORDER.indexOf(outcome.levelKey);
      if (idx >= 0 && idx < CAMPAIGN_ORDER.length - 1) {
        playCampaignLevel(CAMPAIGN_ORDER[idx + 1]);
        return;
      }
    }
    // In a campaign, replaying continues the war — the RETRY button and the
    // key press must agree, or the keyboard would quietly drop the veterans.
    if ((code === "Space" || code === "Enter") && !net.on && outcome &&
        (outcome.kind === "victory" || outcome.kind === "defeat")) {
      playCampaignLevel(outcome.levelKey);
      return;
    }
    if (code === "Space" || code === "Enter") playAgain();
    if (code === "Escape" || code === "Backspace") leaveMatch();
  } else if (state === "playing" || state === "paused" || state === "menu") {
    // Survey's three keys, and they come first so the pause handler never
    // sees a press that was meant for the panel.
    if (mode && mode.survey && state === "playing") {
      /* The four slots, before anything else, because a device is the one
         thing on this list you press while something is shooting at you.
         Bound rather than fixed — see `DEVICE_KEYS` — so a player who wants
         them under their left hand can have them there. */
      const slot = DEVICE_KEYS.findIndex(codes => codes.indexOf(code) >= 0);
      if (slot >= 0) { useDevice(slot); return; }
      if (code === "KeyF") { surveyScan(); return; }
      if (code === "KeyM") {
        state = "chart"; surveyHUD && surveyHUD.chartOpened(surveyState()); return;
      }
      if (code === "KeyL") { state = "almanac"; return; }
      // N for the news: the sector page, which the strip under the minimap also opens.
      if (code === "KeyN") {
        state = "sector"; surveyHUD && surveyHUD.sectorOpened && surveyHUD.sectorOpened(); return;
      }
      // Docking is a keypress rather than a trigger volume: a station that
      // opened itself as you flew past would be a station you learned to
      // steer around.
      if (code === "KeyE" && surv && surv.docked) {
        state = "refit"; surveyHUD && surveyHUD.refitOpened(); return;
      }
      // Last of the two, because a station does more than a world does.
      if (code === "KeyE" && surv && surv.landed) {
        state = "landed";
        surveyHUD && surveyHUD.shopOpened && surveyHUD.shopOpened();
        return;
      }
      /* Somebody drifting, before anything with a name on it: a ship with four
         minutes left beats a monument that has been there a thousand years.

         Only when you can actually help, though. If your own tank is too low the
         key falls through to the card instead, which explains what you are
         looking at and what happens if you leave it — a key that does nothing
         but print a refusal is a key you stop pressing. */
      if (code === "KeyE" && surv && surv.helping && canGiveWater()) {
        giveWater(); return;
      }
      /* Anything else with a name on it. Last of the `E` doors, because a
         station and a world you can land on are both things you went there
         for, and this is a question you ask on the way past.

         The card is *snapshotted* rather than read live. The world does not
         stop while a page is open, so a live card would rewrite itself as you
         drifted — and the one thing worse than not being told what something
         is, is being told and then having it change. */
      if (code === "KeyE" && surv && surv.near) {
        surv.lore = surv.near; state = "lore"; return;
      }
      // Your ship: the slots, the crate, the hold, who you are to the powers,
      // and the book. `I` and `G` both reach it because it is both of the pages
      // it used to be.
      if (code === "KeyI") {
        state = "inventory";
        surveyHUD && surveyHUD.cargoOpened && surveyHUD.cargoOpened();
        return;
      }
      if (code === "KeyG") {
        state = "ship"; surveyHUD && surveyHUD.shipOpened(); return;
      }
      // `B` for build. The workbench is you and your hold, so it opens
      // anywhere — a bench you had to dock at could not be the answer to
      // being two hundred thousand units from a station.
      if (code === "KeyB") {
        state = "craft"; surveyHUD && surveyHUD.craftOpened(); return;
      }
      // The light drive, if you have one. `R` for run: nothing else uses it,
      // and the three page keys are already spoken for.
      if (code === "KeyR" && surv && surv.hasLight) {
        toggleLightDrive(); return;
      }
    }
    if (code === "KeyP" || code === "Escape") {
      state = state === "playing" ? (net.on ? "menu" : "paused") : "playing";
      localPause = state === "paused";
      if (state === "menu") localPause = true;
      if (localPause) {
        // Pausing mid-thrust would otherwise leave the host flying this ship
        // on a key that is no longer being held.
        const me = ships[localSeat()];
        if (me) me.input.l = me.input.r = me.input.th = me.input.f = false;
      }
    }
    if (state === "paused" || state === "menu") {
      if (code === "KeyC") { state = openSettings(state); return; }
      if (code === "KeyQ") { leaveMatch(); return; }
    }
    // Squad command: one key orders the whole allied wing. Mission-only, and
    // only while actually flying — not from a pause menu.
    if (state === "playing" && mode.campaign) {
      const d = digit(code);
      if (d === 1) { setSquadOrder("focus"); return; }
      if (d === 2) { setSquadOrder("defend"); return; }
      if (d === 3) { setSquadOrder("regroup"); return; }
    }
    // One camera and two people at one keyboard means somebody is off-screen.
    // Tab hands the view to the next ship still in the match. This goes away
    // the moment each player has their own screen.
    if (code === "Tab" && mode.camera) {
      for (let i = 1; i <= ships.length; i++) {
        const next = (watching + i) % ships.length;
        const n = ships[next];
        if (n.dead) continue;
        // In a mission you only ever look through your own side's ships —
        // never out of an enemy cockpit. Free-for-all modes cycle everyone.
        if (mode.campaign && n.team !== TEAM_ALLY) continue;
        watching = next; break;
      }
    }
  }
}
