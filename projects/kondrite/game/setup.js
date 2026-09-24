"use strict";

/* KONDRITE — THE ARENA
   ─────────────────────────────────────────────────────────────────────────────
   Canvas, the two coordinate spaces, the modes, the base tuning, the
   stationary hazards and the players. Everything else is built on the
   numbers here.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");

/* ── Two coordinate spaces ────────────────────────────────────────────────
   SCREEN is the box the HUD and menus are laid out in, so text is the same
   size whatever arena you're in. WORLD is the arena, which is a different
   size per mode.

   SCREEN used to be a fixed 1000×700. On a phone held sideways that is the
   wrong shape for the glass: a modern handset is about 19.5:9, the picture is
   10:7, and the difference came out as a third of the screen in black bars
   down either side. So the height is fixed and the *width follows the
   device* — 1000 on anything squarer than 10:7, out to 1680 on the widest
   phone. A wide screen gets more sector, not a stretched one.

   Two things fall out of that and both are handled below:

     · Everything laid out on this screen is laid out *against* it. Almost all
       of it already was — the menus centre on `SCREEN_W / 2` and the survey
       pages sit on a grid measured from the edges — and the dozen or so places
       that carried a literal like `700` were written when 700 was 0.7 of the
       width and now say so: `COLS(3, 2)` and friends below.
     · The fixed-camera modes used to fit the arena by width alone, because
       width and height agreed. They fit by whichever is tighter now, so the
       whole map is still visible at once — with up to five people at one
       keyboard, nobody can have their own camera. */
let SCREEN_W = 1000;
const SCREEN_H = 700;
// 1000 is the shape everything was designed at and the floor it never goes
// below; 1680 is about 2.4:1, past which the extra is a strip of sky.
const SCREEN_W_MIN = 1000, SCREEN_W_MAX = 1680;

/* Menu geometry, as fractions rather than pixels. `COLS(n, i)` is the centre
   of the i-th of n evenly spaced columns across the usable width, which is
   what almost every row of menu buttons actually wanted. `INSET` is the margin
   the corner buttons sit in. */
const MENU_INSET = 34;
const COLS = (n, i) => MENU_INSET +
  ((SCREEN_W - MENU_INSET * 2) / n) * (i + 0.5);
const LEFT = x => MENU_INSET + x;
const RIGHT = x => SCREEN_W - MENU_INSET - x;
/* Every tappable rectangle goes through here. One door rather than four
   `taps.push` calls: a rectangle that drifts from the thing it is under is a
   control that cannot be pressed, and nothing about it looks wrong on the
   screen. */
function pushTap(rect) {
  taps.push(rect);
  return rect;
}
let viewScale = 1;   // SCREEN units → device pixels
let wScale = 1;      // WORLD units → SCREEN units (1 while drawing the HUD)

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const availW = stage.clientWidth - 2;
  const availH = stage.clientHeight - 2;
  /* The screen takes the shape of the glass. Anything squarer than 10:7 keeps
     the 1000-wide box and letterboxes as it always did; anything wider gets a
     wider box instead of black bars, up to a limit — past about 2.4:1 the
     extra is a strip of sky rather than anything you can use, and the menus'
     centred column would start to look marooned. */
  if (availW > 0 && availH > 0) {
    SCREEN_W = Math.max(SCREEN_W_MIN,
                        Math.min(SCREEN_W_MAX, Math.round(SCREEN_H * availW / availH)));
  }
  const s = Math.max(0.2, Math.min(availW / SCREEN_W, availH / SCREEN_H));
  canvas.style.width = Math.round(SCREEN_W * s) + "px";
  canvas.style.height = Math.round(SCREEN_H * s) + "px";
  canvas.width = Math.round(SCREEN_W * s * dpr);
  canvas.height = Math.round(SCREEN_H * s * dpr);
  viewScale = s * dpr;
  // Turning the phone over can leave a control hanging off the short edge.
  padApply();
}
window.addEventListener("resize", resize);
/* A phone's toolbar sliding away changes what you can see without ever firing
   a window resize, so the canvas would keep the size it had behind the bar and
   leave a strip of dead space. The visual viewport is the only thing that
   reports it. `orientationchange` lands before the new size is readable, so it
   is answered on the next frame rather than immediately. */
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resize);
  window.visualViewport.addEventListener("scroll", resize);
}
window.addEventListener("orientationchange", () => {
  requestAnimationFrame(() => requestAnimationFrame(resize));
});
document.addEventListener("fullscreenchange", resize);
document.addEventListener("webkitfullscreenchange", resize);

/* ── modes ───────────────────────────────────────────────────────────────
   `unit` scales ship size, rock size and every speed with the arena. Without
   it a bigger map just means smaller, slower-feeling ships; with it the map
   grows faster than the ships shrink, which is what "bigger" should feel
   like. It's sqrt of the area factor — grown, not doubled. */
const MODES = {
  survival: {
    name: "SURVIVAL",
    blurb: "one side · one pile of lives · optional friendly fire",
    arena: { w: 1300, h: 910 },
    pvp: false, friendlyFire: true, closing: false, wrap: true,
    camera: false, hazards: 0, minPlayers: 1
  },
  royale: {
    name: "BATTLE ROYALE",
    blurb: "two-hit hulls · no time limit · the wall closes in",
    // Sixteen screenfuls of world. You fly through it rather than seeing it
    // all at once, which is what the camera and the minimap are both for.
    arena: { w: 4000, h: 2800 },
    pvp: true, friendlyFire: true, closing: true, wrap: false,
    camera: true, hazards: 5, minPlayers: 2
  },

  /* ── campaign ────────────────────────────────────────────────────────────
     Three scripted missions. They share the Battle-Royale engine — a big
     camera-followed map, no closing wall — but add two ideas the free-for-all
     modes don't have: `team` (a ship's side) and `kind` (fighter, transport,
     mothership). `campaign: true` is the switch every generalisation reads.
     Each level's script lives in CAMPAIGN below; the mode row here is only the
     arena and the flags. Local co-op up to two pilots; no online. */
  convoy: {
    name: "CONVOY",
    blurb: "escort the transport home · three waves, each worse",
    arena: { w: 3400, h: 2200 },
    pvp: true, friendlyFire: false, closing: false, wrap: false,
    camera: true, hazards: 0, minPlayers: 1, campaign: true, level: 1
  },
  raid: {
    name: "RAID",
    blurb: "hunt down three enemy transports and their escorts",
    arena: { w: 4200, h: 2800 },
    pvp: true, friendlyFire: false, closing: false, wrap: false,
    camera: true, hazards: 0, minPlayers: 1, campaign: true, level: 2
  },
  mothership: {
    name: "MOTHERSHIP",
    blurb: "all-out fleet war · break the turrets, kill the core",
    // Larger than Battle Royale — a whole warzone the fleets fight across.
    arena: { w: 6400, h: 4500 },
    pvp: true, friendlyFire: false, closing: false, wrap: false,
    camera: true, hazards: 0, minPlayers: 1, campaign: true, level: 3
  },

  /* ── survey ──────────────────────────────────────────────────────────────
     The mode with nothing shooting at you. It borrows Battle Royale's shape —
     a big camera-followed map, gravity wells, standing rocks — and drops the
     wall, the enemies and the losing. `survey: true` is the switch, the way
     `campaign: true` is for a mission. One pilot: there is one chart and one
     catalogue, and two people at one keyboard cannot both be looking. */
  survey: {
    name: "SURVEY",
    blurb: "explore a fictional galaxy that evolves on its own",
    /* There is no arena. Survey generates space in chunks as you reach it and
       never bounces you off anything, so this box exists only to keep the
       camera and the code that reads `arena` in ordinary numbers — nothing in
       the mode ever approaches it. `setupSurvey` widens `bounds` to match. */
    arena: { w: 2e7, h: 1.4e7 },
    pvp: false, friendlyFire: false, closing: false, wrap: false,
    camera: true, hazards: 0, minPlayers: 1, survey: true
  }
};

// The order the campaign is played and offered in. Used by the level-select
// screen and by the "next level" button on a victory screen.
const CAMPAIGN_ORDER = ["convoy", "raid", "mothership"];

/* ── base tuning, in a 1000-wide arena ───────────────────────────────── */
const TURN         = 3.2;    // rad/s — not scaled; turning rate is ergonomic
const THRUST       = 380;
const DRAG         = 0.42;
/* What a ship loses a second while it is coasting faster than its own engine
   could push it — thrown by a well, or still carrying the light drive's speed
   after cutting it. Much gentler than DRAG, because DRAG is the resistance an
   engine works against and there is no engine involved in being thrown. */
const COAST_DRAG   = 0.13;
const THROWN_CEILING = 4;    // times your top speed, however deep the well
const MAX_SPEED    = 360;
const SHIP_R       = 12;
const BULLET_SPD   = 520;
/* What a bot's round travels at. It was 360 while the fastest hull in the
   game cruises at 684, so flying away in a straight line outran the bullets —
   which makes every gun out there decoration and every chase a formality.
   The same speed the player's rounds get, and for the same reason: a round is
   a round, whoever fired it. */
const BOT_BULLET_SPD = 520;
/* A quarter further than it was. Range is life times speed, and the speed is
   what makes a shot feel like a shot — so the reach comes out of the clock. */
const BULLET_LIFE  = 1.31;
const BURST_SIZE   = 3;
const BURST_GAP    = 0.12;
const FIRE_GAP     = 0.62;  // recovery after the third round
const MAX_SHOTS    = 6;
// On Easy the campaign pilot holds the trigger for a steady stream instead of a
// three-round burst, with more rounds allowed in the air to feed it. This is
// Easy-campaign-only; Hard, Impossible, Survival and Battle Royale keep the burst.
const CAMPAIGN_FIRE_GAP = 0.12;
const CAMPAIGN_SHOTS    = 9;
const RESPAWN_WAIT = 1.4;
const INVULN       = 2.6;
const HIT_SHIELD   = 0.65;
const FF_PENALTY   = 100;
const ROYALE_STOCKS = 3;
const ROYALE_HULL   = 2;
// How long the elimination card holds before it fades into the spectate HUD.
const TERMINATED_HOLD = 2.6;
// Tuned to give roughly the same rocks-per-screen as Survival,
// across a map sixteen screens across. Culling means most are never drawn.
const ROYALE_ROCKS = 84;

const WALL_BOUNCE  = 0.72;   // ships keep most of their speed off a wall
const ROCK_BOUNCE  = 1.0;    // rocks lose nothing, or the field goes still

/* `hp` is what makes a rock cover rather than confetti. A big one soaks a
   full magazine before it breaks, so you can put it between you and someone
   shooting at you and trust it for a few seconds. Every hit that doesn't
   break it leaves a crack, so the rock visibly wears out and you can see when
   your cover is about to fail. */
const ROCK = {
  big:   { r: 54, spd: [40, 85],   score: 20,  next: "mid",   verts: 13, hp: 4 },
  mid:   { r: 30, spd: [70, 135],  score: 50,  next: "small", verts: 11, hp: 2 },
  small: { r: 16, spd: [110, 195], score: 100, next: null,    verts: 9,  hp: 1 }
};

// Royale gets its own tuning: bigger cover, but slower drift.
const ROYALE_ROCK = {
  big:   { r: 135, spd: [18, 32], score: 20,  next: "mid",   verts: 13, hp: 4 },
  mid:   { r: 42,  spd: [26, 46], score: 50,  next: "small", verts: 11, hp: 2 },
  small: { r: 20,  spd: [22, 40], score: 100, next: null,    verts: 9,  hp: 1 }
};
const ROYALE_ROCK_WEIGHTS = [
  ["big", 0.38],
  ["mid", 0.37],
  ["small", 0.25]
];

/* The wall compacts Battle Royale into a single-screen endgame. There is no
   match timer: play continues at the final size until one ship remains. */
const CLOSE_DELAY = 10;   // grace period before it starts moving
const CLOSE_TIME  = 40;   // how long it takes to reach its final size
const CLOSE_TO    = 0.2;  // final size as a fraction of the arena

/* ── stationary hazards ──────────────────────────────────────────────────
   Stars and black holes never move. Both pull on everything with mass —
   ships, rocks and bullets alike — which is the point of them: a shot fired
   past a black hole doesn't go where you aimed it.

   `mass` is in the softened form a = mass / (d² + soft²), so the pull is
   finite at the centre instead of blowing up to infinity. `kill` is the
   radius that destroys what touches it; `reach` is where the pull stops.

   Reach is deliberately short. An early version used 760 and 1000, which
   sounds reasonable until you add it up: five wells that size cover more
   circle area than the whole map, so everything loose fell in and the field
   emptied — 84 rocks down to 10 inside twenty-five seconds. They're meant to
   be places on the map you steer around, not a fate the whole map shares.

   Both kill you in the middle. The difference is the grip: a black hole pulls
   hard, a star is gentle enough that you can loiter near it and still leave.
   `soft` is set so the pull peaks below what an engine can beat — at full
   burn, pointed out, you climb out of either of them. Getting careless deep
   inside one is still how you die, but it's never a sentence passed on you
   the moment you cross the edge. Thrust is 380, so compare against that:

     black hole   a(60px) ≈ 530   a(130px) ≈ 300   a(300px) ≈ 90
     star         a(60px) ≈ 250   a(130px) ≈ 145   a(300px) ≈ 43           */
const HAZARD = {
  star: { kill: 46, reach: 380, mass: 4.5e6, soft: 120, fill: "#ffe56d" },
  hole: {
    small: { kill: 23, reach: 520, mass: 7.9e6, soft: 112 },
    large: { kill: 34, reach: 650, mass: 1.22e7, soft: 132 }
  }
};

const MOTES_PER_HAZARD = 28;   // debris falling in, marking where the pull starts

function rockSpec(size) {
  // Big camera maps — Battle Royale and the campaigns — use the larger, slower
  // royale rocks so a boulder is real cover; the fixed Survival view keeps the
  // small ones that fit its single screen.
  return mode && (mode.closing || mode.campaign) ? ROYALE_ROCK[size] : ROCK[size];
}

function randomRoyaleRockSize() {
  const r = Math.random();
  let acc = 0;
  for (const [size, weight] of ROYALE_ROCK_WEIGHTS) {
    acc += weight;
    if (r < acc) return size;
  }
  return "small";
}

function hazardSpec(kind, holeIndex) {
  if (kind === "hole") return holeIndex % 2 ? HAZARD.hole.large : HAZARD.hole.small;
  return HAZARD.star;
}

/* ── players ─────────────────────────────────────────────────────────────
   Everything downstream of this table is written for N players: spawns are
   placed round a circle, collisions are all-pairs, lives and win conditions
   count the array. Adding a third player is adding a row here and raising
   MAX_PLAYERS — no other code needs to know. Sets 3–5 are laid out and ready
   but not offered in the menu yet: five people at one keyboard is a physical
   question, not a code one, and it wants testing with five real hands.

   The keys on each row are what it comes with, not what it is stuck with:
   the controls screen writes over them and the browser remembers. Every
   action holds a list rather than one code, because some of these want
   alternatives — a laptop with no numpad, a keyboard where Enter is a
   stretch — and because rebinding has to be able to leave one empty. */
const PLAYERS = [
  { label: "AMBER", colour: "#ffe56d",
    left: ["KeyA"], right: ["KeyD"], thrust: ["KeyW"], fire: ["Space"] },
  { label: "GREEN", colour: "#6dffbf",
    left: ["ArrowLeft"], right: ["ArrowRight"], thrust: ["ArrowUp"],
    fire: ["Enter", "NumpadEnter", "ShiftRight", "Numpad0"] },
  { label: "CYAN", colour: "#87d8ff",
    left: ["KeyJ"], right: ["KeyL"], thrust: ["KeyI"], fire: ["KeyU"] },
  { label: "PINK", colour: "#ffb0ee",
    left: ["Numpad4"], right: ["Numpad6"], thrust: ["Numpad8"], fire: ["Numpad5"] },
  { label: "VIOLET", colour: "#d8b4ea",
    left: ["KeyF"], right: ["KeyH"], thrust: ["KeyT"], fire: ["KeyG"] }
];
const MAX_PLAYERS = PLAYERS.length;

/* Five ships, but not five pairs of hands at one keyboard. Two is the most
   that can share a board without elbowing each other, and it's the most that
   has two comfortable key groups. The other three colours are what bots and
   online players wear — they exist as ships, not as seats at this desk.

   A phone has one set of thumb buttons, so a phone has one player. `any-hover:
   none` is the honest test for that: a touchscreen laptop still has a mouse
   and a keyboard, and two people can still use it. */
const KEYBOARD_MAX = 2;
const touchOnly =
  matchMedia("(any-pointer: coarse) and (any-hover: none)").matches;
const humanMax = () => (touchOnly ? 1 : KEYBOARD_MAX);

// The colour rows that a keyboard can actually reach, and therefore the only
// ones worth binding keys for. Online you always fly with the first row.
const keyRows = () => PLAYERS.slice(0, KEYBOARD_MAX);
