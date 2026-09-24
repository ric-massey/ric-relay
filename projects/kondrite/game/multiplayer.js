"use strict";

/* KONDRITE — MULTIPLAYER
   ─────────────────────────────────────────────────────────────────────────────
   Networking, which pages stop the clock, what this client saw, and the
   bots.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── networking ──────────────────────────────────────────────────────────
   Host-authoritative. Somebody has to own the truth or two players disagree
   about who died, so the host simulates everything and the guests are drawing
   what they're told plus a guess about their own ship.

   A guest predicts only its own ship — it runs the same flight physics on its
   own input immediately, so steering feels instant rather than lagged by a
   round trip, and eases toward the host's version as corrections arrive.
   Everything else (rocks, other ships, bullets, who died) is the host's word,
   smoothed between updates.

   Host authority has one deliberate tradeoff: the host has a latency advantage
   when shooting because its shots resolve immediately, while a guest's resolve
   when their input reaches the host. Removing that advantage requires server-side
   rewind rather than a different snapshot rate. */
const net = {
  role: null,          // null (local) | 'host' | 'guest'
  seat: 0,             // which ship index this machine drives
  inputs: {},          // host: latest input per guest seat
  lastSnap: null,
  prevSnap: null,
  snapAt: 0,
  prevAt: 0,
  sendAcc: 0,
  rockAcc: 0,
  inAcc: 0,
  outSnapSeq: 0,
  outRockSeq: 0,
  outInputSeq: 0,
  lastSnapSeq: 0,
  lastRockSeq: 0,
  lastSoundSeq: 0,
  status: "",
  get on() { return this.role !== null; }
};

const SNAP_HZ = 20, ROCK_HZ = 5, INPUT_HZ = 30;

const onlineMenuOpen = () => net.on && localPause && (
  state === "menu" ||
  ((state === "controls" || state === "thumb") && backFrom === "menu")
);

/* ── which pages stop the clock ───────────────────────────────────────────
   Not all of them, and the split is a design decision rather than a technical
   one. Survey is a survival game with two tanks draining and things out there
   that move; a page that pauses the world is a page you can hide in, and the
   chart and your storage manifest are exactly the two you would hide in.

   So the world keeps running behind the chart, storage, the missions list and
   the almanac. Your hands are off the controls — the arrows are panning a map
   — so the ship coasts, and the tanks keep going down while you read. That is
   the honest version: looking at the map costs you something.

   A station stops the clock, because you are docked and doing business, and so
   does the pause key, because that is what a pause key is for. And the death
   page stops it because there is nothing left to run. */
/* The pages the world keeps running behind. The loadout is on this list on
   purpose and the whole of 5.2 depends on it: fitting a part takes time out in
   space, and a page that paused the clock would turn that cost into a loading
   screen you wait out rather than a risk you take. */
/* Every page in the mode. Two separate questions are asked of this list and
   they used to be one, which is why both answers were wrong somewhere:

     *is the sector drawn behind this page* — yes, always, for all of them. A
     menu you cannot see past is a menu you die behind, and the pages you are
     most likely to be sitting in are the shop and the shipyard.

     *does the clock keep running* — only when you are not parked. That is the
     rule 5.2 needs (fitting a part out in space costs real time, so a page
     that stopped the clock would turn the cost into a loading screen) and it is
     also the rule a player expects (a station is somewhere you stop). A station
     fits parts instantly anyway, so the two never disagree. */
/* Every page the mode has. A state missing from here is a page the world is
   neither drawn nor ticked behind — it goes solid black and the clock stops —
   which is how the station's two new rooms arrived: they looked right and the
   sector had quietly gone away behind them. Both are parked pages, so the
   clock stops anyway; what they needed was to be *pages* at all. */
const SURVEY_PAGES = { chart: 1, inventory: 1, missions: 1, almanac: 1,
                       record: 1, ship: 1,
                       craft: 1, lore: 1, refit: 1, hangar: 1, arcade: 1,
                       landed: 1, stationinv: 1, wormhole: 1 };
const surveyPage = () =>
  !!(mode && mode.survey && surv && !surv.death && SURVEY_PAGES[state]);
/* Parked: at a station, or sitting on somebody's world. Both are places you
   have stopped, and the sector waits for you at both.
   `lore` is the one page that keeps running even parked — it is asked *at*
   something, usually while moving, sometimes while being pulled, and a card that
   stopped time next to a star would be an exploit rather than an answer. */
const surveyParked = () =>
  !!(surv && (surv.docked || surv.landed));
const surveyLive = () =>
  surveyPage() && (state === "lore" || !surveyParked());
const worldRunning = () => state === "playing" || surveyLive() || onlineMenuOpen();

function sharedMatchState() {
  if (onlineMenuOpen()) return "playing";
  if ((state === "controls" || state === "thumb") && backFrom === "paused") {
    return "paused";
  }
  return state;
}

function netReset() {
  net.role = null; net.seat = 0; net.inputs = {};
  net.lastSnap = net.prevSnap = null;
  net.outSnapSeq = net.outRockSeq = net.outInputSeq = 0;
  net.lastSnapSeq = net.lastRockSeq = net.lastSoundSeq = 0;
  net.status = "";
  // Back to seat-is-colour and nameless, which is what the keyboard players
  // expect: two people at one keyboard know which of them is green.
  skins = PLAYERS.map((_, i) => i);
  names = [];
  if (window.KondriteNet) window.KondriteNet.reset();
}

// What a guest needs once, to build a world that matches the host's.
function initPacket(seat) {
  return {
    t: "init", seat, skins, names, friendlyFire: mode.friendlyFire,
    /* Who everybody is, and which match this is. Both are the host's table:
       a guest cannot know the other guests' accounts any other way, and a
       match id each client invented for itself would file five reports about
       five different matches and agree with nothing. */
    accounts, matchId,
    mode: modeKeyOf(mode), players,
    arena, u: U,
    hazards: hazards.map(h => ({ k: h.kind, x: h.x, y: h.y, kill: h.kill,
                                 reach: h.reach, mass: h.mass, soft: h.soft,
                                 fill: h.fill, size: h.size, p: h.phase }))
  };
}

const modeKeyOf = m => Object.keys(MODES).find(k => MODES[k] === m);

/* The host's half of a witnessed match. Called from both places a host starts
   one — the lobby's start button and the rematch — and called at the same
   moment the roster is compacted, because it reads the *old* seat numbers.
   An `accounts` table that was not compacted alongside `names` would go on
   crediting every score to whoever used to sit there, which is the kind of
   wrong that looks like it is working. */
function hostMatchSeats(seated) {
  accounts = [myAccount(), ...seated.map(l => accounts[l.seat] || "")];
  matchId = newMatchId();
}

/* ── what this client saw ─────────────────────────────────────────────────
   A score is not a claim you make about yourself. Every client posts one row
   per player it can name, saying what *that* player got, and a score counts
   only where two different accounts said the same thing about the same
   player in the same match. The counting is in Postgres; this is only the
   testimony. See `supabase/schema.sql`.

   Nothing is reported for a local game. A solo board cannot be witnessed —
   that is the whole reason the boards at a cabinet are made up — so the only
   matches that reach a real board are the ones somebody else was in. */
function matchReport(result) {
  if (!net.on || !matchId || !cloud || !cloud.enabled() || !cloud.session()) {
    return [];
  }
  const game = modeKeyOf(mode);
  if (game !== "survival" && game !== "royale" && game !== "campaign") return [];

  /* Two accounts at least, or there is nobody to agree and the rows would sit
     in the table forever being one person's word. Not an error — a game with
     one signed-in player in it is a perfectly good game, it is just not a
     witnessed one. */
  const seats = [];
  for (let i = 0; i < Math.min(accounts.length, ships.length); i++) {
    if (accounts[i] && /^[0-9a-f-]{36}$/i.test(accounts[i])) seats.push(i);
  }
  const distinct = new Set(seats.map(i => accounts[i]));
  if (distinct.size < 2) return [];

  const rows = [];
  if (game === "survival") {
    /* Co-op: one wave, everybody reached it. Each player is credited with
       the wave the team got to, which is what the machine counts. */
    const got = Math.max(0, Math.round(wave));
    for (const i of seats) {
      rows.push({ subject: accounts[i], game, value: got, detail: "" });
    }
  } else if (game === "royale") {
    /* Every ship has its own answer, so every ship is its own row. Time
       survived rather than whether you won, for the reason the cabinet
       already counts it that way: a board of winners is empty for most
       people. The place is carried alongside it, because "third of five"
       is the thing you actually say afterwards. */
    const order = ships.map((sh, i) => ({
      i, t: sh.survivedFor != null ? sh.survivedFor : clock
    })).sort((a, b) => b.t - a.t);
    const place = new Map(order.map((o, k) => [o.i, k + 1]));
    for (const i of seats) {
      const sh = ships[i];
      const t = sh && sh.survivedFor != null ? sh.survivedFor : clock;
      rows.push({ subject: accounts[i], game, value: Math.max(0, Math.round(t)),
                  detail: place.get(i) + " of " + ships.length });
    }
  } else {
    /* Missions *cleared*, which is one fewer than the mission you died on.
       The difficulty rides along because three on impossible and three on
       pilot are not the same three. */
    const lvl = (result && result.level) || (camp && camp.level) || 1;
    const cleared = result && result.kind === "victory" ? lvl : Math.max(0, lvl - 1);
    for (const i of seats) {
      rows.push({ subject: accounts[i], game, value: cleared,
                  detail: String(campaignDifficulty || "") });
    }
  }
  cloud.reportMatch(matchId, rows);
  return rows;
}

function snapshot() {
  return {
    // A guest is told about the match, not about whatever screen the host
    // has open over it — the controls page is nobody else's business.
    t: "s", q: ++net.outSnapSeq, c: clock, st: sharedMatchState(),
    b: [bounds.x0, bounds.y0, bounds.x1, bounds.y1],
    lv: lives, sc: score, wv: wave, ff: ffCount,
    sh: ships.map(s => [
      Math.round(s.x), Math.round(s.y), +s.a.toFixed(3),
      s.alive ? 1 : 0, s.dead ? 1 : 0, s.stocks, s.kills,
      s.deaths, s.envDeaths, s.killedBy == null ? -1 : s.killedBy,
      s.survivedFor == null ? -1 : +s.survivedFor.toFixed(2),
      s.thrusting ? 1 : 0, s.invuln > 0 ? 1 : 0,
      Math.round(s.vx), Math.round(s.vy), s.hull
    ]),
    bu: bullets.map(b => [Math.round(b.x), Math.round(b.y),
                          Math.round(b.vx), Math.round(b.vy), b.owner]),
    kf: killFeed.map(e => [e.source, e.victim, e.colour, +e.until.toFixed(2)]),
    fx: soundEvents.filter(e => clock - e.at < 1.25)
      .map(e => e.y == null
        ? [e.q, e.k, Math.round(e.x == null ? arena.w / 2 : e.x)]
        : [e.q, e.k, Math.round(e.x), Math.round(e.y)]),
    o: outcome ? { k: outcome.kind, s: outcome.ship ? outcome.ship.id : -1 } : null,
    bn: banner ? { x: banner.text, s: banner.sub, t: banner.t, c: banner.colour } : null
  };
}

function rockPacket() {
  return {
    t: "r", q: ++net.outRockSeq,
    rk: rocks.map(r => [r.id, r.size === "big" ? 0 : r.size === "mid" ? 1 : 2,
                        Math.round(r.x), Math.round(r.y),
                        Math.round(r.vx), Math.round(r.vy),
                        +r.a.toFixed(2), +r.spin.toFixed(2), r.hp])
  };
}

const SIZES = ["big", "mid", "small"];

function applyRocks(msg) {
  if (!Number.isInteger(msg.q) || msg.q <= net.lastRockSeq) return;
  net.lastRockSeq = msg.q;
  const seen = new Set();
  for (const a of msg.rk) {
    const [id, sz, x, y, vx, vy, ang, spin, hp] = a;
    seen.add(id);
    let r = rocks.find(k => k.id === id);
    if (!r) {
      r = makeRock(SIZES[sz], x, y, id);
      rocks.push(r);
    }
    r.x = x; r.y = y; r.vx = vx; r.vy = vy; r.a = ang; r.spin = spin;
    if (hp < r.hp) r.flash = 0.13;
    r.hp = hp;
  }
  // Anything the host no longer has, we no longer have.
  for (let i = rocks.length - 1; i >= 0; i--) {
    if (!seen.has(rocks[i].id)) rocks.splice(i, 1);
  }
}

function applySnapshot(msg) {
  if (!Number.isInteger(msg.q) || msg.q <= net.lastSnapSeq) return;
  net.lastSnapSeq = msg.q;
  net.prevSnap = net.lastSnap;
  net.prevAt = net.snapAt;
  net.lastSnap = msg;
  net.snapAt = performance.now();

  clock = msg.c;
  // A pause this machine chose is its own business and the host can't lift
  // it. A pause the host chose has to be liftable by the host, or the guest
  // sits in a pause it never asked for and can't get out of.
  if (!localPause || msg.st === "over") {
    state = msg.st;
    if (state === "over") localPause = false;
  }
  bounds = { x0: msg.b[0], y0: msg.b[1], x1: msg.b[2], y1: msg.b[3] };
  lives = msg.lv; score = msg.sc; wave = msg.wv; ffCount = msg.ff;

  let localEliminated = false;
  msg.sh.forEach((a, i) => {
    const s = ships[i];
    if (!s) return;
    const wasDead = s.dead;
    const [x, y, ang, alive, dead, stocks, kills, deaths, envDeaths,
           killedBy, survivedFor, thrust, inv, vx, vy, hull] = a;
    s.alive = !!alive; s.dead = !!dead;
    s.stocks = stocks; s.kills = kills;
    s.deaths = deaths; s.envDeaths = envDeaths;
    s.killedBy = killedBy < 0 ? null : killedBy;
    s.survivedFor = survivedFor < 0 ? null : survivedFor;
    s.hull = hull == null ? ROYALE_HULL : hull;
    s.thrusting = !!thrust; s.invuln = inv ? 1 : 0;
    if (i === net.seat && !wasDead && s.dead) localEliminated = true;
    if (i === net.seat) {
      // Our own ship is predicted locally. Take the host's word only when we
      // have drifted far enough that the difference would be visible.
      const err = Math.hypot(s.x - x, s.y - y);
      if (err > 140 || !s.alive) {
        s.x = x; s.y = y; s.vx = vx; s.vy = vy; s.a = ang;
      } else {
        if (err > 8) { s.x += (x - s.x) * 0.25; s.y += (y - s.y) * 0.25; }
        // Rock, wall, and ship impacts happen only on the host. Blend their
        // resulting velocity into prediction before drift becomes a hard snap.
        const blend = err > 8 ? 0.35 : 0.16;
        s.vx += (vx - s.vx) * blend;
        s.vy += (vy - s.vy) * blend;
        let da = ang - s.a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        s.a += da * 0.12;
      }
    } else {
      s.netPrev = { x: s.netTo ? s.netTo.x : x, y: s.netTo ? s.netTo.y : y,
                    a: s.netTo ? s.netTo.a : ang };
      s.netTo = { x, y, a: ang };
      s.vx = vx; s.vy = vy;
    }
  });

  // The host simulates every death, but this guest changes view only when
  // the newly eliminated ship is the one controlled on this screen.
  if (localEliminated) {
    const me = ships[net.seat];
    const target = chooseSpectator(me, null);
    terminated = { t: TERMINATED_HOLD };
    if (target) watching = target.id;
  }

  bullets = msg.bu.map(a => ({
    x: a[0], y: a[1], vx: a[2], vy: a[3], owner: a[4],
    // A shot is its shooter's colour, which is no longer the same thing as
    // its seat number now that seats choose what to wear.
    colour: (ships[a[4]] || ships[0] || PLAYERS[0]).colour, life: 1
  }));
  killFeed = Array.isArray(msg.kf)
    ? msg.kf.map(e => ({ source: e[0], victim: e[1], colour: e[2], until: e[3] }))
    : [];
  if (Array.isArray(msg.fx)) {
    for (const e of msg.fx) {
      if (!Number.isInteger(e[0]) || e[0] <= net.lastSoundSeq) continue;
      net.lastSoundSeq = e[0];
      if (audible(e[2], e[3])) playSfx(e[1], soundPan(e[2]), typeof e[3] === "number");
    }
  }

  outcome = msg.o
    ? { kind: msg.o.k, ship: msg.o.s >= 0 ? ships[msg.o.s] : null }
    : null;
  banner = msg.bn ? { text: msg.bn.x, sub: msg.bn.s, t: msg.bn.t, colour: msg.bn.c } : null;
}

function applyInit(msg) {
  // Without this the guest happily runs its own full simulation alongside the
  // host's and the two worlds quietly drift apart.
  net.role = "guest";
  net.seat = msg.seat;
  net.lastSnapSeq = net.lastRockSeq = net.lastSoundSeq = 0;
  net.outInputSeq = 0;
  if (Array.isArray(msg.skins)) skins = msg.skins.slice();
  if (Array.isArray(msg.names)) names = msg.names.map(tidyName);
  /* Taken from the host, with this client's own seat overwritten from its own
     session: the host is trusted to say who the *other* people are, and not
     to say who you are. */
  accounts = Array.isArray(msg.accounts) ? msg.accounts.map(a => String(a || "")) : [];
  accounts[msg.seat] = myAccount();
  matchId = typeof msg.matchId === "string" ? msg.matchId : null;
  mode = MODES[msg.mode];
  if (msg.mode === "survival") mode.friendlyFire = msg.friendlyFire !== false;
  arena = msg.arena;
  U = msg.u;
  players = msg.players;
  bounds = { x0: 0, y0: 0, x1: arena.w, y1: arena.h };
  ships = [];
  for (let i = 0; i < players; i++) {
    const s = makeShip(i, players);
    // Only our own seat reads this keyboard — and it reads YOUR keys, the
    // first row, whatever colour you chose. Nobody is sharing a keyboard
    // online, so there is no reason to be handed somebody else's row.
    s.localKeys = i === net.seat ? PLAYERS[0] : null;
    ships.push(s);
  }
  hazards = msg.hazards.map(h => ({
    kind: h.k, x: h.x, y: h.y, kill: h.kill, reach: h.reach,
    mass: h.mass, soft: h.soft, fill: h.fill || null, size: h.size || null,
    phase: h.p
  }));
  seedMotes();
  rocks = []; bullets = []; bits = []; killFeed = [];
  watching = net.seat;
  cam.scale = mode.camera
    ? (mode.survey ? surveyZoom * shipZoomFactor() : 1)
    : Math.min(SCREEN_W / arena.w, SCREEN_H / arena.h);
  cam.x = ships[net.seat].x; cam.y = ships[net.seat].y;
  cam.rot = mode.camera && camRotates()
    ? -Math.PI / 2 - ships[net.seat].a
    : 0;
  clampCam();
  state = "playing";
  net.status = "";
  playSfx("start", 0);
  matchStarted();
}

// A guest keeps the world moving between the host's updates, or everything
// outside its own ship would advance in 20-per-second steps.
function guestCoast(dt) {
  updateMotes(dt);
  for (const r of rocks) {
    r.flash = Math.max(0, r.flash - dt);
    applyGravity(r, dt);
    r.x += r.vx * dt; r.y += r.vy * dt;
    r.a += r.spin * dt;
    // Once the Battle Royale wall starts moving it passes over rocks rather
    // than bouncing them inward. updateWall removes each rock after the wall
    // has moved completely past it.
    if (!mode.closing || clock <= CLOSE_DELAY) {
      edgeOf(r, r.r, ROCK_BOUNCE);
    }
  }
  for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }

  // Other players slide toward where the host last put them.
  const k = 1 - Math.exp(-14 * dt);
  for (const s of ships) {
    if (s.id === net.seat || !s.netTo) continue;
    s.x += (s.netTo.x - s.x) * k;
    s.y += (s.netTo.y - s.y) * k;
    let da = s.netTo.a - s.a;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    s.a += da * k;
    if (s.thrusting && s.alive && Math.random() < 0.5) {
      burst(s.x - Math.cos(s.a) * SHIP_R * U,
            s.y - Math.sin(s.a) * SHIP_R * U, "#ffcb42", 1, 60 * U);
    }
  }

  // Our own ship flies for real, on our own input, right now.
  const me = ships[net.seat];
  if (me && me.alive) {
    const i = me.input;
    if (i.l) me.a -= TURN * dt;
    if (i.r) me.a += TURN * dt;
    me.thrusting = i.th;
    if (i.th) {
      me.vx += Math.cos(me.a) * THRUST * U * dt;
      me.vy += Math.sin(me.a) * THRUST * U * dt;
      if (Math.random() < 0.7) {
        burst(me.x - Math.cos(me.a) * SHIP_R * U,
              me.y - Math.sin(me.a) * SHIP_R * U, "#ffcb42", 1, 60 * U);
      }
    }
    const pull = applyGravity(me, dt);
    const damp = Math.exp(-DRAG * dt);
    me.vx *= damp; me.vy *= damp;
    const sp = Math.hypot(me.vx, me.vy), max = MAX_SPEED * U * (pull > 1 ? 1.9 : 1);
    if (sp > max) { me.vx *= max / sp; me.vy *= max / sp; }
    me.x += me.vx * dt; me.y += me.vy * dt;
    edgeOf(me, SHIP_R * U, WALL_BOUNCE);
  }

  for (let i = bits.length - 1; i >= 0; i--) {
    const p = bits[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.exp(-1.6 * dt); p.vy *= Math.exp(-1.6 * dt);
    p.life -= dt;
    if (p.life <= 0) bits.splice(i, 1);
  }

  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (terminated) { terminated.t -= dt; if (terminated.t <= 0) terminated = null; }
  updateCamera(dt);
}

/* ── bots ────────────────────────────────────────────────────────────────
   A bot is not a special kind of ship — it fills the same `input` the
   keyboard fills, so every rule about firing, dying and friendly fire applies
   to it unchanged. It only ever runs on the host: guests receive bot ships as
   ordinary remote ships and never know the difference.

   The priorities are in order of how quickly they'll kill you: falling into a
   well, hitting the wall, hitting a rock, then actually fighting. */
function driveBot(s, dt) {
  const i = s.input;
  i.l = i.r = i.th = i.f = false;
  if (!s.alive) return;
  if (mode.campaign) { driveCampaignBot(s, dt); return; }

  s.think = (s.think || 0) - dt;
  const R = SHIP_R * U;
  let wantX = null, wantY = null, urgent = false;

  // 1. Climb out of any well it has drifted into.
  for (const h of hazards) {
    if (!hazardActive(h)) continue;
    const dx = sepX(h.x, s.x), dy = sepY(h.y, s.y);
    const d = Math.hypot(dx, dy);
    if (d < h.reach * 0.75) {
      wantX = s.x - dx / (d || 1) * 400;
      wantY = s.y - dy / (d || 1) * 400;
      urgent = true;
      break;
    }
  }

  // 2. Stay off the wall — where there is one. Nothing to hug in a field
  //    whose edges lead back round.
  if (!urgent && !mode.wrap) {
    const margin = 130 * U;
    const cx = (bounds.x0 + bounds.x1) / 2, cy = (bounds.y0 + bounds.y1) / 2;
    if (s.x < bounds.x0 + margin || s.x > bounds.x1 - margin ||
        s.y < bounds.y0 + margin || s.y > bounds.y1 - margin) {
      wantX = cx; wantY = cy; urgent = true;
    }
  }

  // 3. Dodge a rock it is about to fly into.
  if (!urgent) {
    for (const r of rocks) {
      const dx = sepX(r.x, s.x), dy = sepY(r.y, s.y);
      const d = Math.hypot(dx, dy);
      if (d > r.r + 190 * U) continue;
      const ahead = Math.cos(s.a) * dx + Math.sin(s.a) * dy;
      if (ahead <= 0) continue;             // already behind us
      wantX = s.x - dy; wantY = s.y + dx;   // slip sideways past it
      urgent = true;
      break;
    }
  }

  // 4. Otherwise pick a fight, or clear rocks if there's nobody to fight.
  let target = null, targetDist = Infinity, targetDx = 0, targetDy = 0;
  if (mode.pvp) {
    for (const o of ships) {
      if (o === s || !o.alive || o.dead) continue;
      const dx = sepX(o.x, s.x), dy = sepY(o.y, s.y);
      const d = Math.hypot(dx, dy);
      if (d < targetDist) {
        targetDist = d; target = o; targetDx = dx; targetDy = dy;
      }
    }
  } else {
    for (const r of rocks) {
      const dx = sepX(r.x, s.x), dy = sepY(r.y, s.y);
      const d = Math.hypot(dx, dy);
      if (d < targetDist) {
        targetDist = d; target = r; targetDx = dx; targetDy = dy;
      }
    }
  }

  if (!urgent && target) {
    // Lead the shot: aim where the target will be, not where it is.
    const tof = Math.min(1.2, targetDist / (BULLET_SPD * U));
    wantX = s.x + targetDx + (target.vx || 0) * tof;
    wantY = s.y + targetDy + (target.vy || 0) * tof;
  }
  if (wantX === null) return;

  let diff = Math.atan2(wantY - s.y, wantX - s.x) - s.a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  // A dead zone stops it juddering left-right around the perfect heading.
  if (diff > 0.06) i.r = true;
  else if (diff < -0.06) i.l = true;

  const aimed = Math.abs(diff) < 0.5;
  const speed = Math.hypot(s.vx, s.vy);
  if (aimed && (urgent || targetDist > 240 * U) && speed < MAX_SPEED * U * 0.85) {
    i.th = true;
  }

  const range = BULLET_SPD * U * BULLET_LIFE * U * 0.9;
  if (!urgent && target && Math.abs(diff) < 0.14 && targetDist < range) {
    // Don't shoot a team-mate in the back in co-op Survival.
    const blocked = !mode.pvp && mode.friendlyFire && ships.some(o => {
      if (o === s || !o.alive) return false;
      const dx = sepX(o.x, s.x), dy = sepY(o.y, s.y);
      let teammateAngle = Math.atan2(dy, dx) - s.a;
      while (teammateAngle > Math.PI) teammateAngle -= Math.PI * 2;
      while (teammateAngle < -Math.PI) teammateAngle += Math.PI * 2;
      return Math.abs(teammateAngle) < 0.2 &&
             Math.hypot(dx, dy) < targetDist;
    });
    i.f = !blocked;
  }
}
