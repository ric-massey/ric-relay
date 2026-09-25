"use strict";

/* KONDRITE — CAMPAIGN
   ─────────────────────────────────────────────────────────────────────────────
   The three scripted missions as one war: mission feel, what interrupts you,
   the campaign flight AI.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ══ CAMPAIGN ════════════════════════════════════════════════════════════
   Three scripted missions built on the Battle-Royale engine. Two ideas the
   free-for-all modes lack carry the whole thing: a ship's `team` (0 yours,
   1 the enemy) decides who its shots bite, and its `kind` (fighter, transport,
   turret, mothership) decides how it flies and how it dies. Everything else —
   physics, bullets, camera, minimap — is the code the other modes already run.

   Reinforcements are rolling: a downed fighter is not gone, it is a slot its
   side refills from a reserve. So a level can field a fifty-ship roster with
   only thirty-odd ever alive at once, which is what keeps a warzone at frame
   rate on a phone. `camp` holds the whole of a mission's live state. */
const TEAM_ALLY = 0, TEAM_ENEMY = 1;
const ALLY_COLOUR = "#5fd0a0";     // your fleet: warm teal, clear of player amber
const ENEMY_COLOUR = "#ff6b6b";    // the enemy: cold red

/* Difficulty sets how many hits a fighter takes. It only ever touches fighters
   — the pilots, and on Impossible everything that flies — never the transports,
   the mothership or its subsystems, which keep the hulls their mission gave
   them. Easy is the default, because the whole point is a mission you can win. */
// `autoFire` decides the pilot's trigger: Easy holds for a steady stream, the
// harder settings drop back to the three-round burst the other modes use, so
// every shot has to be picked and the extra difficulty isn't only in the hull.
const DIFFICULTY = {
  easy:       { pilotHull: 5, allOneHit: false, autoFire: true,  colour: "#6dffbf",
                blurb: "your ships take five hits · auto fire" },
  hard:       { pilotHull: 3, allOneHit: false, autoFire: false, colour: "#ff8f77",
                blurb: "your ships take three hits · burst fire" },
  impossible: { pilotHull: 1, allOneHit: true,  autoFire: false, colour: "#ff6b6b",
                blurb: "one hit kills anything — you and them · burst fire" }
};

const clamp01 = v => Math.max(0, Math.min(1, v));

/* ── mission feel ────────────────────────────────────────────────────────
   Radio chatter is a small scrolling log under the pilots; screen shake and a
   brief slow-motion mark the biggest beats. All three are campaign-only and
   decay on their own, so nothing here leaks into Survival or Battle Royale. */
/* Radio. In Survey it goes to the interface's own notification stack, top
   right, along with everything else that has just happened — three separate
   feeds in three corners was most of why the screen was never quiet. Other
   modes keep the line above the hull bar, which is the only place they have. */
/* ── what is worth interrupting you for ───────────────────────────────────
   Survey says a great deal, and it was saying all of it at the same volume and
   from any distance. A convoy unloading four sectors away, a battle ending
   somewhere you have never been, a scavenger taking a wreck you could not see —
   all of it arrived as a notification, so the stack was almost always full and
   almost never about anything you could act on. A feed that is always talking
   is a feed you stop reading, which costs you the three lines a year that
   actually matter.

   One rule, in one place, instead of six ad-hoc distance checks with three
   different radii scattered through the file:

     `chatter(text, colour)`              about *you* — your ship, your tanks,
                                          your money, your parts. Always shown.
     `chatter(text, colour, {x, y})`      about something out there. Shown only
                                          if it happened within earshot.
     `chatter(text, colour, false)`       texture. Written down, never shown.

   Everything reaches the log either way, so nothing is lost — the ones that did
   not interrupt you are in WHAT HAPPENED on the ship's page if you want them. */
const EARSHOT = 4200;      // about twice as far as anybody will talk to you

function chatter(text, colour, where) {
  if (mode && mode.survey && surveyHUD) {
    const me = ships[0];
    const near = where === false ? false
               : (where && me)
                 ? dist2(where.x, where.y, me.x, me.y) < EARSHOT * EARSHOT
                 : true;
    if (near) surveyHUD.notify(text, "", colour || "#ffcb42", 6);
    else surveyHUD.logAdd(text, colour || "#ffcb42");
    return;
  }
  comms.unshift({ text, colour: colour || "#ffcb42", until: clock + 6 });
  comms.length = Math.min(comms.length, 4);
}
/* A pickup, said the way the right-hand stack says every pickup:
   "ICE x3: put in CARGO". Repeats of the same thing add to the count on the
   line that is already up. Survey only; the arenas have no hold. */
function picked(name, n, where, colour) {
  if (!(mode && mode.survey && surveyHUD && surveyHUD.pickup)) return;
  surveyHUD.pickup(name, n || 1, where, colour || CASH);
}
function addShake(m) { shake = Math.min(64, shake + m); }
function slowmo(scale, secs) { slowScale = scale; slowTimer = secs; }

// Whose screen the mission is played from, and what that pilot is pointed at —
// squad orders are given relative to the player, so both have to be knowable.
function playerShip() {
  const w = ships[watching];
  if (w && w.team === TEAM_ALLY && !w.dead) return w;
  return ships.find(s => s.human && !s.dead) ||
         ships.find(s => s.team === TEAM_ALLY && !s.dead) || ships[0];
}
function playerTarget() {
  const p = playerShip();
  if (!p) return null;
  let best = Infinity, t = null;
  for (const o of ships) {
    if (o.team === p.team || !o.alive || o.dead || o.shielded) continue;
    const d = Math.hypot(sepX(o.x, p.x), sepY(o.y, p.y));
    if (d < best) { best = d; t = o; }
  }
  return t;
}

/* Squad command. One key issues an order to every allied bot at once — the
   thing that turns a pilot into a fleet commander. Pressing the same order
   again stands the wing back down to fighting at will. */
const ORDER_LABEL = { focus: "FOCUS FIRE", defend: "DEFEND", regroup: "REGROUP" };
function setSquadOrder(order) {
  if (!camp) return;
  camp.order = camp.order === order ? null : order;
  if (camp.order === "focus") camp.focusTarget = playerTarget();
  chatter("All wings: " + (camp.order ? ORDER_LABEL[order] : "weapons free"),
          "#5fd0a0");
  gameSound("start");
}

const enemyFightersLeft = () => ships.filter(s =>
  s.team === TEAM_ENEMY && (s.kind === "fighter" || s.kind === "gunship") &&
  !s.dead).length;
const anyAllyNear = (o, dist) => !!o && ships.some(s =>
  s.team === TEAM_ALLY && s.alive && !s.dead &&
  Math.hypot(sepX(s.x, o.x), sepY(s.y, o.y)) < dist);

/* Salvage. An enemy that dies sometimes leaves a canister the player can fly
   through; an ace always does. Four kinds — patch the hull, raise a shield,
   rapid fire, or heavy rounds — and only a pilot can pick one up. */
const PICKUPS = {
  repair: { colour: "#6dffbf" },
  shield: { colour: "#87d8ff" },
  rapid:  { colour: "#ffe56d" },
  heavy:  { colour: "#ff9d5c" }
};
const PICKUP_KINDS = ["repair", "shield", "rapid", "heavy"];
function spawnPickup(x, y, kind) {
  pickups.push({ x, y, vx: rand(-30, 30) * U, vy: rand(-30, 30) * U,
                 kind, life: 15, spin: rand(0, 6.28) });
}
function maybeDrop(ship) {
  const chance = ship.ace ? 1 : ship.kind !== "fighter" ? 0.85 : 0.13;
  if (Math.random() > chance) return;
  spawnPickup(ship.x, ship.y,
              PICKUP_KINDS[Math.floor(Math.random() * PICKUP_KINDS.length)]);
}
function collectPickup(p, s) {
  gameSound("start"); addShake(4);
  if (p.kind === "repair") { s.hull = s.maxHull; s.invuln = Math.max(s.invuln, 1.2); }
  else if (p.kind === "shield") s.invuln = Math.max(s.invuln, 5);
  else if (p.kind === "rapid") s.buffRapid = 9;
  else if (p.kind === "heavy") s.buffHeavy = 9;
  burst(p.x, p.y, PICKUPS[p.kind].colour, 12, 160 * U);
  if (mode && mode.survey) {
    picked(p.kind.toUpperCase(), 1, "to use on the spot", PICKUPS[p.kind].colour);
  } else chatter(p.kind.toUpperCase() + " salvaged", PICKUPS[p.kind].colour);
}
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.exp(-1.2 * dt); p.vy *= Math.exp(-1.2 * dt);
    p.spin += dt * 2; p.life -= dt;
    if (p.life <= 0) { pickups.splice(i, 1); continue; }
    let taken = false;
    for (const s of ships) {
      if (!s.alive || !s.human || s.dead) continue;
      if (gap2(p.x, p.y, s.x, s.y) < (SHIP_R * U + 17 * U) ** 2) {
        collectPickup(p, s); taken = true; break;
      }
    }
    if (taken) pickups.splice(i, 1);
  }
}

/* ── the campaign as one war ─────────────────────────────────────────────
   A campaign is three missions with a through-line, not three loose fights.
   `campRun` is the ledger that survives between them: the fleet's strength,
   a reserve of lives a strong showing earns, the wingmates who lived, and the
   aces they killed. It is spent into the next mission (`applyCampRun`) and
   rewritten when one is won (`computeCarryover`), so winning MATTERS past the
   result screen — the fleet you finish with is the fleet you start the next
   one with. It resets only when a fresh campaign begins from the first
   mission; NEXT and RETRY carry it forward. None of it touches the other
   modes, which never build a `campRun`. */
const ALLY_CALLSIGNS = ["VECTOR", "ROOK", "ECHO", "SABLE", "JETT", "KESTREL"];
const HERO_CAP = 4;         // allies named per mission — a few faces in a swarm
const VET_SKILL = 0.06;     // a returning veteran flies a shade sharper
function freshCampRun() {
  return { fleet: 1, bonusReserve: 0, veterans: [], acesKilled: [],
           missionsWon: 0, kills: 0 };
}

// Named enemy aces: rare elites, tougher and near-perfect, always worth
// salvage, and announced so the kill feed has a rival in it.
const ACE_NAMES = ["VYPER", "REAPER", "NOVA", "WRAITH", "TALON", "HALO"];
function spawnAce() {
  const name = ACE_NAMES[(camp.aceCount++) % ACE_NAMES.length];
  const a = makeCombatant(TEAM_ENEMY, "fighter",
    bounds.x1 - rand(120, 300) * U, rand(bounds.y0 + 180 * U, bounds.y1 - 180 * U),
    { colour: "#ff3b6b", skill: 0.88, hull: 4, role: "hunt", name: "ACE " + name });
  a.ace = true;
  chatter("Enemy ace " + name + " has entered the battle", "#ff3b6b");
  killFeed.unshift({ source: "ACE", victim: name + " inbound",
                     colour: "#ff3b6b", until: clock + 4 });
  killFeed.length = Math.min(killFeed.length, 4);
  addShake(6);
  return a;
}

/* A campaign ship. Made through `makeShip` so it carries every field the rest
   of the engine expects, then dressed for its side and its job. Its `id` is
   its index in `ships`, which is what `owner`, `canHit` and `ships[owner]` all
   rely on — so campaign ships are only ever appended, never spliced out. */
function makeCombatant(team, kind, x, y, opts = {}) {
  const id = ships.length;
  const colour = opts.colour ||
    (team === TEAM_ENEMY ? ENEMY_COLOUR : ALLY_COLOUR);
  const s = makeShip(id, id + 1, { colour, label: opts.label || "SHIP" });
  s.id = id;
  s.bot = true;
  s.localKeys = null;
  s.human = false;
  s.team = team;
  s.kind = kind;
  s.skill = opts.skill != null ? opts.skill : 0.7;
  s.role = opts.role || null;
  s.colour = colour;
  s.name = opts.name || opts.label || (team === TEAM_ENEMY ? "ENEMY" : "ALLY");
  s.x = x; s.y = y;
  s.a = opts.a != null ? opts.a : (team === TEAM_ENEMY ? Math.PI : 0);
  s.vx = s.vy = 0;
  // Fighters (including aces) take their hits from the difficulty; capitals and
  // subsystems keep the hull the mission asked for.
  s.maxHull = kind === "fighter"
    ? (DIFFICULTY[campaignDifficulty].allOneHit ? 1 : (opts.hull || 2))
    : (opts.hull || 2);
  s.hull = s.maxHull;
  s.radius = opts.radius || null;   // capitals are wider than a fighter
  s.invuln = opts.invuln != null ? opts.invuln : INVULN;
  s.stocks = 1;
  if (opts.guard != null) s.guard = opts.guard;
  ships.push(s);
  return s;
}

function setupCampaign(levelKey, humans) {
  // A new war starts fresh; a continued one (NEXT/RETRY) keeps its ledger, so
  // veterans and reserve carry across. The first mission is always a clean
  // slate, and a cold drop-in from the menu has nothing to inherit.
  if (!campContinue || !campRun || levelKey === CAMPAIGN_ORDER[0]) {
    campRun = freshCampRun();
  }
  campContinue = false;

  const cy = arena.h / 2;
  camp = {
    levelKey, level: mode.level, humans,
    reserve: { 0: 0, 1: 0 },        // reinforcements left per side
    reinforce: { 0: true, 1: true },
    reinforceDelay: 2.6,
    objective: "", progress: 0,
    transports: [], mothership: null, turrets: [],
    hangars: [], shieldGens: [], flagship: null, gunship: null, planet: null,
    hangarTimer: 5, aceCount: 0,
    order: null, focusTarget: null,
    waves: [], waveThresholds: [], waveIndex: 0,
    transportStartX: 0, exitX: arena.w,
    // A mission is a small phase machine. `onComplete` fires when the last
    // phase is done; the mothership routes it through a death sequence first.
    phases: [], phase: -1, phaseClock: 0, finale: null,
    onComplete: campaignWin,
    won: false, lost: false
  };

  // The pilots: a short line on the ally side, all team 0, facing the enemy.
  // They draw their lives from one shared pile, the way co-op Survival does.
  lives = 3 + 2 * humans;
  const pilotHull = DIFFICULTY[campaignDifficulty].pilotHull;
  ships.forEach((s, i) => {
    s.team = TEAM_ALLY; s.kind = "fighter"; s.human = true; s.skill = 1;
    s.role = "pilot"; s.maxHull = pilotHull; s.hull = pilotHull;
    s.radius = null; s.shielded = false;
    s.x = arena.w * 0.13;
    s.y = cy + (i - (humans - 1) / 2) * 100 * U;
    s.a = 0; s.vx = s.vy = 0; s.invuln = INVULN;
  });

  if (levelKey === "convoy") setupConvoy(cy);
  else if (levelKey === "raid") setupRaid(cy);
  else if (levelKey === "mothership") setupMothership(cy);

  // Seed the battlefield: wells and asteroids, placed around what the mission
  // already put down. The convoy keeps its lane clear; the mothership keeps a
  // wide berth so a well never does the player's job for them.
  if (levelKey === "convoy") {
    placeCampaignHazards(2, { laneY: cy });
    seedCampaignRocks(12, { laneY: cy });
  } else if (levelKey === "raid") {
    placeCampaignHazards(3);
    seedCampaignRocks(16);
  } else if (levelKey === "mothership") {
    const m = camp.mothership;
    placeCampaignHazards(3, { avoid: [{ x: m.x, y: m.y, r: m.radius * 2.4 }] });
    seedCampaignRocks(14);
  }

  applyCampRun();        // name the wing, seat the veterans, bank the reserve
  advancePhase();        // enter phase 0

  // What the last mission bought you, announced over the radio as you drop in.
  const vetNames = camp.heroes.filter(s => s.veteran).map(s => s.name);
  if (vetNames.length)
    chatter("Back on the line: " + vetNames.join(", "), "#5fd0a0");
  if (camp.carriedReserve > 0)
    chatter("Command sent +" + camp.carriedReserve + " reserve", "#5fd0a0");

  cam.x = ships[0].x; cam.y = ships[0].y;
  cam.rot = camRotates() ? -Math.PI / 2 - ships[0].a : 0;
  clampCam();
}

/* Spend the campaign ledger into the mission that is now built. The first few
   allied fighters are the "heroes" — named, tracked, and carried forward if
   they live; a returning veteran keeps their name and flies a shade sharper.
   A strong last mission also banks extra reinforcements. Reads `campRun` but
   never writes it, so a RETRY brings the very same fleet in again. */
function applyCampRun() {
  const wing = ships.filter(s => s.team === TEAM_ALLY && !s.human &&
                                 s.kind === "fighter");
  const heroes = wing.slice(0, HERO_CAP);
  const vets = campRun.veterans.slice(0, heroes.length);
  const taken = new Set(vets.map(v => v.name));
  const pool = ALLY_CALLSIGNS.filter(n => !taken.has(n));
  let pi = 0;
  heroes.forEach((s, i) => {
    s.hero = true;
    const vet = vets[i];
    if (vet) {
      s.name = vet.name;
      s.veteran = true;
      s.skill = Math.min(0.98, s.skill + VET_SKILL);
    } else {
      s.name = pool[pi++] || ALLY_CALLSIGNS[i % ALLY_CALLSIGNS.length];
    }
  });
  camp.heroes = heroes;
  camp.startHeroCount = heroes.length;
  camp.carriedReserve = campRun.bonusReserve || 0;
  camp.reserve[TEAM_ALLY] += camp.carriedReserve;
}

/* Rewrite the ledger from how the mission just won actually went: the fleet's
   strength (survivors + surviving pilots), the reserve that earns, the named
   wingmates who lived to fly the next one, and the aces added to the tally. */
function computeCarryover() {
  const prev = campRun || freshCampRun();
  const heroes = camp.heroes || [];
  const survivors = heroes.filter(s => !s.dead);
  const startHero = camp.startHeroCount || heroes.length || 1;
  const humans = camp.humans || 1;
  const pilotsAlive = ships.filter(s => s.human && !s.dead).length;
  const kills = ships.filter(s => s.team === TEAM_ALLY)
                     .reduce((n, s) => n + s.kills, 0);
  const newAces = ships.filter(s => s.team === TEAM_ENEMY && s.ace && s.dead)
                       .map(s => s.name.replace(/^ACE\s+/, ""));
  const fleet = clamp01(0.35 + 0.4 * (survivors.length / startHero) +
                        0.25 * (pilotsAlive / humans));
  return {
    fleet,
    bonusReserve: Math.min(4, survivors.length + (fleet > 0.75 ? 1 : 0)),
    veterans: survivors.map(s => ({ name: s.name })),
    acesKilled: prev.acesKilled.concat(newAces),
    missionsWon: prev.missionsWon + 1,
    kills: prev.kills + kills,
    // display-only, for the debrief screen:
    survivorNames: survivors.map(s => s.name), newAces, thisKills: kills
  };
}

/* The phase machine. Each phase names an objective and knows when it is done;
   advancing runs the next phase's `enter` and announces it. A phase whose
   goal is already met (an out-of-order kill) is skipped, so the sequence can
   never wedge. Past the last phase, the mission's `onComplete` fires. */
function advancePhase() {
  camp.phase++;
  camp.phaseClock = 0;
  const p = camp.phases[camp.phase];
  if (!p) { camp.onComplete(); return; }
  if (p.objective) camp.objective = p.objective;
  if (p.banner) banner = Object.assign({ t: 3, colour: "#ffe56d" }, p.banner);
  if (p.chatter) chatter(p.chatter.text, p.chatter.colour);
  if (p.enter) p.enter();
  if (!camp.finale && p.done && p.done()) advancePhase();
}

// LEVEL 1 — CONVOY. A transport crosses from one side to a planet on the far
// side at a steady, unwavering speed; your only job is to keep it alive the
// ~fifty seconds that takes. Three acts of rising threat travel with it — three
// waves, an ambush, then a blockade gunship — but the transport never stops,
// so reaching the planet is the win. The enemies are the weakest in the game.
function setupConvoy(cy) {
  const startX = arena.w * 0.08;
  camp.planet = { x: arena.w - 210 * U, y: cy, r: 150 * U };
  camp.transportStartX = startX;
  camp.exitX = camp.planet.x - camp.planet.r * 0.75;   // "arrived" at the edge

  const t = makeCombatant(TEAM_ALLY, "transport", startX, cy, {
    colour: "#87d8ff", label: "TRANSPORT", name: "TRANSPORT",
    hull: 82, role: "convoy", skill: 0.5, radius: 30 * U, invuln: 3.5, a: 0
  });
  t.kinematic = true;
  t.cruise = 52 * U;            // constant speed, the whole way across
  t.goalX = camp.exitX; t.goalY = cy;
  camp.transports = [t];

  // Three wingmates on the easy mission — this is where a new player learns
  // the game, so the odds are with them.
  for (let k = 0; k < 3; k++) {
    makeCombatant(TEAM_ALLY, "fighter", startX + 40 * U,
      cy + (k - 1) * 130 * U, { skill: 0.76, role: "escort" });
  }
  camp.reserve[TEAM_ALLY] = 6;
  camp.waves = [
    { count: 3, skill: 0.32, reserve: 1 },
    { count: 4, skill: 0.4, reserve: 2 },
    { count: 4, skill: 0.48, reserve: 3 }
  ];
  camp.waveThresholds = [0.08, 0.34, 0.55];

  camp.phases = [
    { objective: "ESCORT THE TRANSPORT TO THE PLANET",
      tick() {
        while (camp.waveIndex < camp.waves.length &&
               camp.progress >= camp.waveThresholds[camp.waveIndex]) {
          deployWave(camp.waves[camp.waveIndex]);
          camp.waveIndex++;
        }
      },
      done() { return camp.progress >= 0.62; } },
    { objective: "AMBUSH — KEEP THE TRANSPORT ALIVE",
      banner: { text: "AMBUSH", sub: "they're swarming the transport — cover it",
                colour: "#ff8f77" },
      chatter: { text: "Ambush on the transport — get on them!", colour: "#ff8f77" },
      enter() {
        for (let i = 0; i < 3; i++) {
          makeCombatant(TEAM_ENEMY, "fighter",
            bounds.x1 - rand(120, 380) * U,
            rand(bounds.y0 + 160 * U, bounds.y1 - 160 * U),
            { skill: 0.42, role: "hunt" });
        }
      },
      done() { return camp.progress >= 0.8; } },
    { objective: "PROTECT IT FROM THE GUNSHIP",
      banner: { text: "BLOCKADE", sub: "a gunship is closing on the transport",
                colour: "#ff8f77" },
      chatter: { text: "Gunship inbound — kill it before it reaches her!",
                 colour: "#ff8f77" },
      enter() {
        const t0 = camp.transports[0];
        const gx = Math.min(bounds.x1 - 300 * U, t0.x + 700 * U);
        camp.gunship = makeCombatant(TEAM_ENEMY, "gunship", gx, t0.y, {
          colour: "#ff7a5c", label: "GUNSHIP", name: "GUNSHIP",
          hull: 11, role: "gunship", skill: 0.54, radius: 34 * U, invuln: 2
        });
      },
      done() { return camp.progress >= 0.99; } }
  ];
  camp.onComplete = campaignWin;   // reaching the planet is the win

  banner = { text: "CONVOY", t: 3.4, colour: "#87d8ff",
    sub: "see the transport safely across to the planet" };
}

// LEVEL 2 — RAID. Three enemy transports run the map, each with a guard pair.
// Destroy all three — they flee when you close, so it is a hunt — then ride
// out the counterattack they scramble in revenge.
function setupRaid(cy) {
  const spots = [
    { x: arena.w * 0.72, y: arena.h * 0.24 },
    { x: arena.w * 0.83, y: arena.h * 0.72 },
    { x: arena.w * 0.52, y: arena.h * 0.86 }
  ];
  spots.forEach((p, idx) => {
    const t = makeCombatant(TEAM_ENEMY, "transport", p.x, p.y, {
      colour: "#ff9d5c", label: "TRANSPORT", name: "TRANSPORT " + (idx + 1),
      hull: 14, role: "flee", skill: 0.5, radius: 28 * U, invuln: 2
    });
    t.goalX = rand(arena.w * 0.45, arena.w * 0.9);
    t.goalY = rand(arena.h * 0.2, arena.h * 0.8);
    camp.transports.push(t);
    for (let k = 0; k < 2; k++) {
      makeCombatant(TEAM_ENEMY, "fighter",
        p.x + rand(-120, 120) * U, p.y + rand(-120, 120) * U,
        { skill: 0.46, role: "guard", guard: t.id });
    }
  });
  for (let k = 0; k < 3; k++) {
    makeCombatant(TEAM_ALLY, "fighter", arena.w * 0.14,
      cy + (k - 1) * 150 * U, { skill: 0.74, role: "hunt" });
  }
  camp.reserve[TEAM_ALLY] = 8;
  camp.reserve[TEAM_ENEMY] = 6;

  camp.phases = [
    { objective: "DESTROY THE TRANSPORTS",
      tick() {
        camp.objective = "DESTROY THE TRANSPORTS · " +
          camp.transports.filter(t => !t.dead).length + " LEFT";
      },
      done() { return camp.transports.every(t => t.dead); } },
    { objective: "SURVIVE THE COUNTERATTACK",
      banner: { text: "COUNTERATTACK", sub: "they want revenge — hold them off",
                colour: "#ff6b6b" },
      chatter: { text: "Enemy's scrambling everything — hold the line!",
                 colour: "#ff6b6b" },
      enter() {
        camp.reserve[TEAM_ENEMY] += 1;
        for (let i = 0; i < 3; i++) {
          makeCombatant(TEAM_ENEMY, "fighter",
            bounds.x1 - rand(100, 320) * U,
            rand(bounds.y0 + 160 * U, bounds.y1 - 160 * U),
            { skill: 0.52, role: "hunt" });
        }
        spawnAce();
      },
      done() { return enemyFightersLeft() === 0; } }
  ];

  banner = { text: "RAID", t: 3.4, colour: "#ff9d5c",
    sub: "three transports on the run — hunt them all down" };
}

// LEVEL 3 — MOTHERSHIP. A fleet war around a capital ship with real innards:
// turrets that never stop shooting, hangar bays that keep launching fighters
// until you kill them, and shield generators that hold the core sealed. Four
// acts: breach the picket, silence the hangars, break the generators, kill the
// exposed core — which goes up in a death sequence, not a puff. An allied
// flagship pushes in with you and can be lost. Both sides refill from big
// reserves, so the warzone never thins until you have carved into it.
function setupMothership(cy) {
  const mx = arena.w * 0.82, my = cy;
  const m = makeCombatant(TEAM_ENEMY, "mothership", mx, my, {
    colour: ENEMY_COLOUR, label: "MOTHERSHIP", name: "MOTHERSHIP",
    hull: 18, role: "station", radius: 150 * U, invuln: 2, a: -Math.PI / 2
  });
  m.shielded = true;
  camp.mothership = m;

  // Turrets ring the hull and fire the whole battle long.
  const TN = 5;
  for (let k = 0; k < TN; k++) {
    const ang = -Math.PI / 2 + (k / TN) * Math.PI * 2;
    const rr = m.radius * 1.06;
    makeCombatant(TEAM_ENEMY, "turret",
      mx + Math.cos(ang) * rr, my + Math.sin(ang) * rr, {
        colour: "#ffb0a0", label: "TURRET", name: "TURRET",
        hull: 3, role: "turret", skill: 0.64, radius: 15 * U, invuln: 1, a: ang
      });
  }
  camp.turrets = ships.filter(s => s.kind === "turret");

  // Two hangar bays on the flanks — they launch fighters until destroyed.
  for (const sy of [-0.62, 0.62]) {
    const h = makeCombatant(TEAM_ENEMY, "hangar",
      mx - m.radius * 0.15, my + m.radius * sy, {
        colour: "#ffb347", label: "HANGAR", name: "HANGAR BAY",
        hull: 6, role: "structure", radius: 26 * U, invuln: 1, a: -Math.PI / 2
      });
    camp.hangars.push(h);
  }

  // Three shield generators close to the core — while any stands, it is sealed.
  for (let k = 0; k < 3; k++) {
    const ang = -Math.PI / 2 + (k / 3) * Math.PI * 2;
    const g = makeCombatant(TEAM_ENEMY, "shieldgen",
      mx + Math.cos(ang) * m.radius * 0.62, my + Math.sin(ang) * m.radius * 0.62, {
        colour: "#87d8ff", label: "GENERATOR", name: "SHIELD GENERATOR",
        hull: 5, role: "structure", radius: 16 * U, invuln: 1, a: ang
      });
    camp.shieldGens.push(g);
  }

  // Your flagship: a friendly capital that advances with the fleet and is the
  // reserve it draws from. Lose it and the reinforcements stop.
  const f = makeCombatant(TEAM_ALLY, "flagship", arena.w * 0.07, cy, {
    colour: "#7fe0c0", label: "FLAGSHIP", name: "ALLIED FLAGSHIP",
    hull: 44, role: "flagship", radius: 92 * U, invuln: 3, a: 0
  });
  f.goalX = arena.w * 0.56; f.goalY = cy;
  camp.flagship = f;

  const ALLY_LIVE = 17, ENEMY_LIVE = 10;
  for (let k = 0; k < ALLY_LIVE; k++) {
    makeCombatant(TEAM_ALLY, "fighter",
      rand(arena.w * 0.05, arena.w * 0.22), rand(arena.h * 0.15, arena.h * 0.85),
      { skill: 0.76, role: "assault" });
  }
  for (let k = 0; k < ENEMY_LIVE; k++) {
    makeCombatant(TEAM_ENEMY, "fighter",
      rand(arena.w * 0.55, arena.w * 0.78), rand(arena.h * 0.12, arena.h * 0.88),
      { skill: 0.6, role: "defend" });
  }
  camp.reserve[TEAM_ALLY] = 36;
  camp.reserve[TEAM_ENEMY] = 18;
  camp.reinforceDelay = 2.2;
  camp.onComplete = campaignWin;   // finale is triggered by the core's death

  camp.phases = [
    { objective: "BREACH THE PICKET LINE",
      chatter: { text: "All wings, push to the mothership!", colour: "#5fd0a0" },
      done() { return anyAllyNear(camp.mothership, 1150 * U) || camp.phaseClock > 30; } },
    { objective: "KNOCK OUT THE HANGAR BAYS",
      banner: { text: "HANGARS", sub: "they keep launching fighters — kill the bays",
                colour: "#ff8f77" },
      chatter: { text: "Those hangars won't quit — take the bays out!",
                 colour: "#ff8f77" },
      done() { return camp.hangars.every(h => h.dead); } },
    { objective: "DESTROY THE SHIELD GENERATORS",
      banner: { text: "SHIELD GENERATORS", sub: "three nodes hold the shield — break them",
                colour: "#87d8ff" },
      chatter: { text: "Shield generators exposed — focus them down!",
                 colour: "#87d8ff" },
      done() { return camp.shieldGens.every(g => g.dead); } },
    { objective: "KILL THE EXPOSED CORE",
      banner: { text: "CORE EXPOSED", sub: "everything you've got — now!",
                colour: "#ffe56d" },
      chatter: { text: "Core's wide open — hit it with everything!",
                 colour: "#ffe56d" },
      enter() { addShake(18); },
      done() { return camp.finale != null && camp.finale <= 0; } }
  ];

  banner = { text: "MOTHERSHIP", t: 3.6, colour: ENEMY_COLOUR,
    sub: "carve into the hull, then kill the core — all fleets engage" };
}

// The core takes its last hit: not a quiet death but a set-piece — the whole
// hull comes apart in slow motion while the camera pulls back to watch.
function beginFinale() {
  if (camp.finale != null) return;
  camp.finale = 3.6;
  const m = camp.mothership;
  if (m) { m.dying = true; m.hull = 0; m.shielded = false; m.invuln = 999; }
  slowmo(0.45, 1.4);
  addShake(44);
  cam.goalScale = 0.72;
  banner = { text: "MOTHERSHIP DOWN", sub: "", t: 3.6, colour: "#ffe56d" };
  chatter("Direct hit — she's breaking apart! Pull back!", "#ffe56d");
  gameSound("win");
}

function launchFromHangar(h) {
  makeCombatant(TEAM_ENEMY, "fighter", h.x, h.y,
    { skill: 0.58, role: "defend" });
  burst(h.x, h.y, "#ffb347", 8, 130 * U);
}

// Reinforcements enter from their own side, never amidships.
function campaignSpawnPoint(ship) {
  const enemy = ship.team === TEAM_ENEMY;
  const x = enemy ? bounds.x1 - 90 * U : bounds.x0 + 90 * U;
  let best = { x, y: (bounds.y0 + bounds.y1) / 2 }, bestGap = -1;
  for (let i = 0; i < 28; i++) {
    const y = rand(bounds.y0 + 140 * U, bounds.y1 - 140 * U);
    // Never appear inside a well or on a rock — arrive somewhere survivable.
    const g = Math.min(shipGapAt(x, y, ship), wellGapAt(x, y), rockGapAt(x, y));
    if (g > bestGap) { bestGap = g; best = { x, y }; }
    if (g > 150 * U) break;
  }
  return { x: best.x, y: best.y, a: enemy ? Math.PI : 0 };
}

/* Suns and black holes, seeded into a mission — the same stationary wells as
   Battle Royale, but placed to respect the fight: never on a ship's start,
   never in the convoy's lane, and never on top of the mothership. A spot that
   cannot be found clear is simply skipped rather than forced. */
function placeCampaignHazards(count, opts = {}) {
  hazards = [];
  const laneY = opts.laneY, avoid = opts.avoid || [];
  let holeIndex = 0;
  for (let i = 0; i < count; i++) {
    const kind = i % 2 === 1 ? "hole" : "star";
    const holeSizeIndex = kind === "hole" ? holeIndex++ : 0;
    const holeSize = kind === "hole" ? (holeSizeIndex % 2 ? "large" : "small") : "sun";
    const spec = hazardSpec(kind, holeSizeIndex);
    let best = null, bestGap = -1;
    for (let tries = 0; tries < 110; tries++) {
      const x = rand(arena.w * 0.16, arena.w * 0.84);
      const y = rand(arena.h * 0.15, arena.h * 0.85);
      let gap = Infinity;
      for (const s of ships) {
        gap = Math.min(gap, Math.hypot(x - s.x, y - s.y) - (s.radius || 0));
      }
      for (const h of hazards) gap = Math.min(gap, Math.hypot(x - h.x, y - h.y) * 0.8);
      if (laneY != null && Math.abs(y - laneY) < spec.reach + 130 * U) gap = -1;
      for (const a of avoid) {
        if (Math.hypot(x - a.x, y - a.y) < a.r + spec.reach) gap = -1;
      }
      if (gap > bestGap) { bestGap = gap; best = { x, y }; }
      if (gap > spec.reach) break;
    }
    if (!best || bestGap < spec.reach * 0.55) continue;   // no clear room — skip
    hazards.push({
      kind, x: best.x, y: best.y,
      kill: spec.kill, reach: spec.reach, mass: spec.mass, soft: spec.soft,
      fill: spec.fill || null, size: holeSize, phase: rand(0, Math.PI * 2)
    });
  }
  if (hazards.length) seedMotes();
}

// Asteroids: slow royale-sized boulders scattered as cover and obstacle, kept
// off ship starts, the convoy lane and the live wells.
function seedCampaignRocks(count, opts = {}) {
  const laneY = opts.laneY;
  for (let n = 0; n < count; n++) {
    let x = 0, y = 0, ok = false;
    for (let tries = 0; tries < 40 && !ok; tries++) {
      x = rand(arena.w * 0.12, arena.w * 0.88);
      y = rand(arena.h * 0.1, arena.h * 0.9);
      ok = laneY == null || Math.abs(y - laneY) > 170 * U;
      if (ok) for (const s of ships) {
        if (Math.hypot(x - s.x, y - s.y) < (s.radius || 0) + 170 * U) { ok = false; break; }
      }
      if (ok) for (const h of hazards) {
        if (Math.hypot(x - h.x, y - h.y) < h.reach) { ok = false; break; }
      }
    }
    if (ok) rocks.push(makeRock(randomRoyaleRockSize(), x, y));
  }
}

// A ship just died in a mission. Credit the kill, refill the slot if the side
// has reserve, and re-check the objective. Capitals go out loud; fighters go
// quietly, or a fifty-ship battle is nothing but a scrolling kill feed.
function campaignKill(ship, cause, shooter) {
  if (shooter && shooter !== ship && shooter.team !== ship.team) shooter.kills++;
  if (ship.team === TEAM_ENEMY) maybeDrop(ship);

  // Capitals, subsystems and aces go out loud, with a shake and a feed line;
  // plain fighters go quietly, or a fifty-ship battle is nothing but a
  // scrolling column of names.
  const capital = ship.kind !== "fighter";
  if (capital || ship.ace) {
    const rad = ship.radius || 40 * U;
    const bursts = capital ? 3 : 1;
    for (let i = 0; i < bursts; i++) {
      burst(ship.x + rand(-1, 1) * rad * 0.5, ship.y + rand(-1, 1) * rad * 0.5,
            ship.colour, 22, 320 * U);
    }
    gameSound("explode", ship.x, ship.y);
    addShake(ship.kind === "flagship" ? 24 : capital ? 16 : 8);
    killFeed.unshift({ source: shooter && shooter.team !== ship.team
                       ? shooter.name : "DESTROYED",
                       victim: ship.name,
                       colour: ship.colour, until: clock + 4.2 });
    killFeed.length = Math.min(killFeed.length, 4);
  }

  // Subsystem fallout — the callouts that tell the player their work is landing.
  if (ship.kind === "hangar") {
    chatter("Hangar bay down — fewer fighters coming", "#ff8f77");
  } else if (ship.kind === "shieldgen") {
    const left = camp.shieldGens.filter(g => !g.dead && g !== ship).length;
    chatter(left ? left + " shield generator" + (left > 1 ? "s" : "") + " to go"
                 : "Last generator's down!", "#87d8ff");
  } else if (ship.kind === "flagship") {
    camp.reinforce[TEAM_ALLY] = false;
    chatter("The flagship's gone — no more reinforcements!", "#ff6b6b");
  } else if (ship.ace) {
    chatter("Ace down — good shooting", "#5fd0a0");
  }

  const t = ship.team;
  if (ship.human) {
    if (lives > 0) { lives--; ship.respawn = RESPAWN_WAIT; }
    else {
      ship.dead = true; ship.survivedFor = clock;
      // Hand a dead pilot's screen to a living friendly ship.
      if (ship.id === localSeat()) {
        const ally = ships.find(o => o.team === TEAM_ALLY && !o.dead && o.alive);
        if (ally) watching = ally.id;
      }
    }
  } else if (ship.kind === "fighter" && !ship.ace &&
             camp.reinforce[t] && camp.reserve[t] > 0) {
    // Plain fighters refill from reserve; aces, gunships and capitals don't.
    camp.reserve[t]--;
    ship.respawn = camp.reinforceDelay;
  } else {
    ship.dead = true; ship.survivedFor = clock;
    // A named wingmate falling for good is a loss you should hear — and one
    // fewer face that carries into the next mission.
    if (ship.hero && ship.team === TEAM_ALLY)
      chatter(ship.name + " is down", "#ff8f77");
  }

  campaignCheck();
}

function campaignWin() {
  if (camp.won || camp.lost) return;
  camp.won = true;
  // A win rewrites the campaign ledger the next mission will inherit, and hands
  // the same figures to the debrief. A loss leaves it untouched, so a retry
  // brings back exactly the fleet that flew this attempt.
  const carry = computeCarryover();
  campRun = {
    fleet: carry.fleet, bonusReserve: carry.bonusReserve,
    veterans: carry.veterans, acesKilled: carry.acesKilled,
    missionsWon: carry.missionsWon, kills: carry.kills
  };
  endMatch({ kind: "victory", levelKey: camp.levelKey, level: camp.level, carry });
}

function campaignLose(reason) {
  if (camp.won || camp.lost) return;
  camp.lost = true;
  endMatch({ kind: "defeat", reason, levelKey: camp.levelKey, level: camp.level });
}

function campaignCheck() {
  if (!camp || camp.won || camp.lost) return;
  // Losses are checked here; wins come from the phase machine finishing. A
  // mission is lost the moment there is no pilot left to fly it, or — on the
  // convoy — the moment the transport it is built around is destroyed.
  if (!ships.some(s => s.human && !s.dead)) {
    campaignLose("all pilots lost");
    return;
  }
  if (camp.levelKey === "convoy" && camp.transports[0].dead) {
    campaignLose("the transport was destroyed");
  }
}

function deployWave(w) {
  const n = camp.waveIndex + 1;
  camp.reserve[TEAM_ENEMY] += w.reserve;
  for (let i = 0; i < w.count; i++) {
    makeCombatant(TEAM_ENEMY, "fighter",
      bounds.x1 - rand(80, 240) * U,
      rand(bounds.y0 + 140 * U, bounds.y1 - 140 * U),
      { skill: w.skill, role: "hunt" });
  }
  banner = { text: "WAVE " + n, t: 2.4, colour: "#ff8f77",
    sub: n === camp.waves.length ? "last wave — hold them off" : null };
  gameSound("start");
}

function campaignTick(dt) {
  if (!camp) return;
  updatePickups(dt);

  // Convoy progress, for the HUD and the wave/phase logic.
  if (camp.levelKey === "convoy") {
    const t = camp.transports[0];
    if (t && !t.dead) camp.progress = clamp01(
      (t.x - camp.transportStartX) / (camp.exitX - camp.transportStartX));
  }

  // The core's shield holds while any generator stands. When the last one
  // falls the shield drops on its own.
  const m = camp.mothership;
  if (m && m.shielded && camp.shieldGens.length &&
      camp.shieldGens.every(g => g.dead)) {
    m.shielded = false;
    banner = { text: "SHIELD DOWN", sub: "the core is exposed", t: 2.8, colour: "#ffe56d" };
    chatter("Shield's collapsing — the core's exposed!", "#ffe56d");
    gameSound("start"); addShake(22);
  }

  // Live hangar bays keep launching fighters until the enemy hits its cap or
  // the bays are destroyed. This is the pressure that makes them worth killing.
  if (camp.hangars.length) {
    const liveH = camp.hangars.filter(h => !h.dead);
    if (liveH.length) {
      camp.hangarTimer -= dt;
      if (camp.hangarTimer <= 0) {
        camp.hangarTimer = 7;
        const enemyLive = ships.filter(s => s.team === TEAM_ENEMY &&
          s.kind === "fighter" && s.alive && !s.dead).length;
        if (enemyLive < 11) for (const h of liveH) launchFromHangar(h);
      }
    }
  }

  // The death sequence: chained blasts rolling across the hull, then the win.
  if (camp.finale != null && camp.finale > 0) {
    camp.finale -= dt;
    if (m && Math.random() < 0.7) {
      const rr = m.radius;
      const col = ["#ffe56d", "#ff8f77", "#ffffff"][Math.floor(Math.random() * 3)];
      const fx = m.x + rand(-1, 1) * rr, fy = m.y + rand(-1, 1) * rr * 0.6;
      burst(fx, fy, col, 16, 260 * U);
      // Not one per flash — that is forty a second. A couple of bangs a second.
      if (Math.random() < 0.05) gameSound("boom", fx, fy);
    }
    if (camp.finale <= 0) { camp.finale = 0; campaignWin(); }
  }

  // Advance the phase machine.
  camp.phaseClock += dt;
  const p = camp.phases[camp.phase];
  if (p) {
    if (p.tick) p.tick(dt);
    if (!camp.finale && p.done && p.done()) advancePhase();
  }

  campaignCheck();
}

/* ── campaign flight AI ──────────────────────────────────────────────────
   One dispatch by kind. Fighters pick an enemy-side target (weighted so a
   raider goes for the transport, not its guards), fly a lead shot, and keep
   to their role's lane. `skill` is the whole difficulty knob: a low-skill bot
   turns into its aim slower, fires in a wider, looser cone, and holds fire
   more often, so Level 1's opening wave misses in ways Level 3's fleet does
   not. */
const SUBSYSTEM = { turret: 1, hangar: 1, shieldgen: 1 };
function driveCampaignBot(s, dt) {
  // Stationary structures don't fly; the core, hangars and generators just sit
  // and take it (turrets track and fire, handled on their own).
  if (s.kind === "mothership" || s.kind === "hangar" || s.kind === "shieldgen") return;
  if (s.kind === "turret") { driveTurret(s, dt); return; }
  if (s.kind === "flagship") { driveFlagship(s, dt); return; }
  if (s.kind === "transport") { if (!s.kinematic) driveTransport(s, dt); return; }
  // Gunships and fighters share the dogfighting AI below.

  const i = s.input;
  const skill = s.skill;

  // The environment comes first: climb out of any gravity well it has drifted
  // into, or slip sideways past a rock it is about to fly into. An urgent avoid
  // overrides the fight — a well kills you faster than an enemy does.
  let avoidX = null, avoidY = null;
  for (const h of hazards) {
    if (!hazardActive(h)) continue;
    const dx = sepX(h.x, s.x), dy = sepY(h.y, s.y), d = Math.hypot(dx, dy);
    if (d < h.reach * 0.72) {
      avoidX = s.x - dx / (d || 1) * 400; avoidY = s.y - dy / (d || 1) * 400;
      break;
    }
  }
  if (avoidX == null) {
    for (const r of rocks) {
      const dx = sepX(r.x, s.x), dy = sepY(r.y, s.y), d = Math.hypot(dx, dy);
      if (d > r.r + 150 * U) continue;
      if (Math.cos(s.a) * dx + Math.sin(s.a) * dy <= 0) continue;   // already behind
      avoidX = s.x - dy; avoidY = s.y + dx;
      break;
    }
  }

  let target = null, best = Infinity, tdx = 0, tdy = 0;
  for (const o of ships) {
    if (o.team === s.team || !o.alive || o.dead || o.shielded) continue;
    const dx = sepX(o.x, s.x), dy = sepY(o.y, s.y);
    const d = Math.hypot(dx, dy);
    let w = 1;
    if (s.role === "hunt" && o.kind === "transport") w = 0.5;
    // The blockade gunship holds the lane against the wing — it duels fighters
    // and largely ignores the cargo, so the fight is with you, not the truck.
    if (s.role === "gunship" && o.kind === "transport") w = 3;
    // Escorts screen their charge: they go after whatever is closest to the
    // transport, not whatever is closest to themselves, so the cargo is
    // actually defended and not just orbited.
    if (s.role === "escort" && camp.transports[0] && !camp.transports[0].dead) {
      const dtr = Math.hypot(sepX(o.x, camp.transports[0].x),
                             sepY(o.y, camp.transports[0].y));
      w *= dtr < 420 * U ? 0.5 : 1.5;
    }
    // Assault ships drive for the hull: they prefer subsystems over trading
    // with the screen, which is what carries the allied push into the
    // mothership instead of letting it stall in a mid-map dogfight forever.
    if (s.role === "assault" && SUBSYSTEM[o.kind]) w = 0.5;
    else if (o.kind === "turret") w *= 0.85;
    const score = d * w;
    if (score < best) { best = score; target = o; tdx = dx; tdy = dy; }
  }

  // A home anchor keeps a role in its lane instead of chasing across the map.
  let homeX = null, homeY = null;
  if (s.role === "escort" && camp.transports[0] && !camp.transports[0].dead) {
    homeX = camp.transports[0].x + 130 * U; homeY = camp.transports[0].y;
  } else if (s.role === "guard" && s.guard != null) {
    const g = ships[s.guard];
    if (g && !g.dead) { homeX = g.x; homeY = g.y; }
  } else if (s.role === "defend" && camp.mothership) {
    homeX = camp.mothership.x - 340 * U; homeY = camp.mothership.y;
  }

  // Squad orders override an ally bot's own instincts — the fleet moves as one.
  if (s.team === TEAM_ALLY && camp.order) {
    if (camp.order === "focus" && camp.focusTarget && camp.focusTarget.alive &&
        !camp.focusTarget.dead && !camp.focusTarget.shielded) {
      target = camp.focusTarget;
      tdx = sepX(target.x, s.x); tdy = sepY(target.y, s.y);
      homeX = null;
    } else if (camp.order === "regroup") {
      const pl = playerShip();
      if (pl && pl !== s) {
        homeX = pl.x - Math.cos(pl.a) * 130 * U;
        homeY = pl.y - Math.sin(pl.a) * 130 * U;
      }
    } else if (camp.order === "defend") {
      const d = camp.transports.find(x => !x.dead && x.team === TEAM_ALLY) ||
                (camp.flagship && !camp.flagship.dead ? camp.flagship : null);
      if (d) { homeX = d.x; homeY = d.y; }
      else { const pl = playerShip(); if (pl) { homeX = pl.x; homeY = pl.y; } }
    }
  }

  const leash = (s.role === "escort" || s.role === "guard") ? 560 * U : Infinity;
  let wantX, wantY, dist;
  if (avoidX != null) {
    // Getting clear of the hazard is the only thing that matters right now.
    wantX = avoidX; wantY = avoidY; dist = 9e9; target = null;
  } else if (target && Math.hypot(tdx, tdy) < leash) {
    const tof = Math.min(1.2, Math.hypot(tdx, tdy) / (BULLET_SPD * U));
    wantX = s.x + tdx + (target.vx || 0) * tof;
    wantY = s.y + tdy + (target.vy || 0) * tof;
    dist = Math.hypot(tdx, tdy);
  } else if (homeX != null) {
    wantX = homeX; wantY = homeY; dist = Math.hypot(homeX - s.x, homeY - s.y);
    target = null;
  } else if (target) {
    const tof = Math.min(1.2, Math.hypot(tdx, tdy) / (BULLET_SPD * U));
    wantX = s.x + tdx + (target.vx || 0) * tof;
    wantY = s.y + tdy + (target.vy || 0) * tof;
    dist = Math.hypot(tdx, tdy);
  } else {
    wantX = s.team === TEAM_ALLY ? bounds.x1 - 200 * U : bounds.x0 + 200 * U;
    wantY = s.y; dist = 9e9;
  }

  // Peel away from a wall it is about to bury itself in.
  const margin = 130 * U;
  if (s.x < bounds.x0 + margin) wantX = s.x + 300 * U;
  else if (s.x > bounds.x1 - margin) wantX = s.x - 300 * U;
  if (s.y < bounds.y0 + margin) wantY = s.y + 300 * U;
  else if (s.y > bounds.y1 - margin) wantY = s.y - 300 * U;

  let diff = Math.atan2(wantY - s.y, wantX - s.x) - s.a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  const dead = 0.06 + (1 - skill) * 0.12;
  if (diff > dead) i.r = true; else if (diff < -dead) i.l = true;

  const speed = Math.hypot(s.vx, s.vy);
  const aimed = Math.abs(diff) < 0.6;
  const close = target ? 250 * U : 70 * U;
  if (aimed && dist > close && speed < MAX_SPEED * U * (0.55 + 0.35 * skill)) {
    i.th = true;
  }

  const cone = 0.10 + (1 - skill) * 0.16;
  const range = BULLET_SPD * U * BULLET_LIFE * U * (0.6 + 0.35 * skill);
  if (target && Math.abs(diff) < cone && dist < range &&
      (skill > 0.9 || Math.random() < 0.45 + 0.5 * skill)) {
    i.f = true;
  }
}

function driveTurret(s, dt) {
  const i = s.input;
  let target = null, best = Infinity, tdx = 0, tdy = 0;
  for (const o of ships) {
    if (o.team === s.team || !o.alive || o.dead || o.shielded) continue;
    const dx = sepX(o.x, s.x), dy = sepY(o.y, s.y);
    const d = Math.hypot(dx, dy);
    if (d < best) { best = d; target = o; tdx = dx; tdy = dy; }
  }
  if (!target) return;
  const tof = Math.min(1.2, best / (BULLET_SPD * U));
  const aim = Math.atan2(tdy + (target.vy || 0) * tof,
                         tdx + (target.vx || 0) * tof);
  // Welded to the hull: it tracks by turning in place, it never moves.
  let diff = aim - s.a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  s.a += Math.max(-TURN * 1.5 * dt, Math.min(TURN * 1.5 * dt, diff));
  const range = BULLET_SPD * U * BULLET_LIFE * U * 0.95;
  if (Math.abs(diff) < 0.12 && best < range) i.f = true;
}

function driveTransport(s, dt) {
  const i = s.input;
  let gx = s.goalX, gy = s.goalY;
  if (s.role === "flee") {
    let nx = null, ny = null, nd = Infinity;
    for (const o of ships) {
      if (o.team === s.team || !o.alive || o.dead) continue;
      const dx = o.x - s.x, dy = o.y - s.y, d = Math.hypot(dx, dy);
      if (d < nd) { nd = d; nx = dx; ny = dy; }
    }
    if (nx != null && nd < 660 * U) { gx = s.x - nx; gy = s.y - ny; }
    else {
      if (Math.hypot(s.goalX - s.x, s.goalY - s.y) < 170 * U) {
        s.goalX = rand(bounds.x0 + 320 * U, bounds.x1 - 320 * U);
        s.goalY = rand(bounds.y0 + 320 * U, bounds.y1 - 320 * U);
      }
      gx = s.goalX; gy = s.goalY;
    }
  }
  const m = 110 * U;
  gx = Math.max(bounds.x0 + m, Math.min(bounds.x1 - m, gx));
  gy = Math.max(bounds.y0 + m, Math.min(bounds.y1 - m, gy));
  let diff = Math.atan2(gy - s.y, gx - s.x) - s.a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > 0.08) i.r = true; else if (diff < -0.08) i.l = true;
  const speed = Math.hypot(s.vx, s.vy);
  // Only the raid's fleeing transports fly by thrust; the convoy transport is
  // kinematic and never reaches here.
  if (Math.abs(diff) < 0.5 && speed < MAX_SPEED * U * 0.5) i.th = true;
}

// The allied flagship: a slow capital that creeps to the front, then turns to
// face the enemy and adds its guns to the push. It doesn't dodge — it soaks.
function driveFlagship(s, dt) {
  const i = s.input;
  const m = 220 * U;
  const gx = Math.max(bounds.x0 + m, Math.min(bounds.x1 - m, s.goalX));
  const gy = Math.max(bounds.y0 + m, Math.min(bounds.y1 - m, s.goalY));
  const distGoal = Math.hypot(gx - s.x, gy - s.y);

  let tgt = null, best = Infinity, tdx = 0, tdy = 0;
  for (const o of ships) {
    if (o.team === s.team || !o.alive || o.dead || o.shielded) continue;
    const dx = sepX(o.x, s.x), dy = sepY(o.y, s.y), d = Math.hypot(dx, dy);
    if (d < best) { best = d; tdx = dx; tdy = dy; tgt = o; }
  }

  // Steer to the front while there is ground to cover, then aim the hull at
  // whatever is closest so its forward guns bear.
  const wantA = distGoal > 240 * U
    ? Math.atan2(gy - s.y, gx - s.x)
    : (tgt ? Math.atan2(tdy, tdx) : s.a);
  let diff = wantA - s.a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > 0.05) i.r = true; else if (diff < -0.05) i.l = true;

  const speed = Math.hypot(s.vx, s.vy);
  if (distGoal > 240 * U && Math.abs(diff) < 0.4 && speed < MAX_SPEED * U * 0.2) {
    i.th = true;
  }
  const range = BULLET_SPD * U * BULLET_LIFE * U;
  if (tgt && Math.abs(diff) < 0.16 && best < range) i.f = true;
}
