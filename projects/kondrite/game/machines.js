"use strict";

/* KONDRITE — THE MACHINES
   ─────────────────────────────────────────────────────────────────────────────
   The arcade machines, their boards, the real board, the competition, the
   settings page and registering a control.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ═══ THE MACHINES ════════════════════════════════════════════════════════
   A simulator is a cabinet in the corner of a station, and playing one is
   something you do **inside a run**: you are docked, you walk over to it, you
   play a game of asteroids for a score, and you come back to the same dock
   with the sector where you left it.

   The problem is that `startGame` resets every global the game has — `ships`,
   `rocks`, `hazards`, `bounds`, `mode`, `cam`, `lives`, `clock` — so a machine
   played from inside a survey destroys that survey in memory.

   **The answer is not to preserve it.** Survey already writes everything to
   the book and already resumes at the position it left, so the crossing uses
   the path that exists and is tested: save, play, resume. `returnTo` is the
   whole of the new state — where you were standing, and what the machine
   scored on the way back.

   What is lost crossing is real and it is correct: the traffic in flight, the
   rocks where they were, the notification stack, any battle in progress. A
   game takes time and the sector moves on. It is *said* on the way out, or a
   player who left a fight and came back to an empty sky thinks the game
   broke. */
let returnTo = null;

/* The three machines, and they are the solo lane's three. A cabinet is
   something you walk up to alone in the middle of your own survey; the
   question of how many people are playing belongs to the front page's
   SIMULATORS door, not to a box in the corner of a station. */
const CABINETS = [
  { key: "survival", name: "SURVIVAL", art: "survival", colour: "#ffe56d",
    line: "asteroids, and they never stop coming" },
  { key: "royale", name: "BATTLE ROYALE", art: "royale", colour: "#ff8f77",
    line: "five bots and a wall that closes in" },
  { key: "campaign", name: "CAMPAIGN", art: "campaign", colour: "#6dffbf",
    line: "three missions, in order, each one worse" }
];

/* What a machine counts. One table, because the room prints it, the book
   keeps it and the result screen writes it — and three copies of "what is a
   score" is how a leaderboard starts disagreeing with itself. */
const SIM_SCORE = {
  survival: { cap: "BEST WAVE", say: n => "WAVE " + n },
  royale:   { cap: "LONGEST",   say: n => clockText(n) },
  campaign: { cap: "MISSIONS",  say: n => n + " OF " + CAMPAIGN_ORDER.length }
};

/* What the machine that just ended scored, or null for a machine that does
   not count this ending. `clock` and `wave` are still the match's own when
   this is asked; see `endMatch`. */
function simResult(result) {
  if (!mode || mode.survey) return null;
  if (mode.campaign) {
    return result && result.kind === "victory"
      ? { key: "campaign", value: mode.level || 1 } : null;
  }
  if (mode.closing) {
    /* Time survived, won or lost. A cabinet is one pilot against five bots
       and the thing you are actually playing for is the last minute of it —
       a board that only counted wins would be empty for most people. */
    const me = ships[0];
    const t = me && me.survivedFor != null ? me.survivedFor : clock;
    return { key: "royale", value: Math.round(t) };
  }
  return { key: "survival", value: wave };
}

/* Where the cabinet is and whose it is. A station flies its own flag; a world
   wears whoever holds the sky over it. The id is the coordinate, rounded the
   way the gazetteer rounds one — two cabinets a few units apart would be the
   same machine, which is what it is. */
function cabinetHere() {
  if (!surv) return null;
  const at = surv.docked || surv.landed;
  if (!at) return null;
  const station = at === surv.docked;
  const f = factionOf(station
    ? (at.faction || "free")
    : ((placeAt(at.x, at.y).space.owner) || "free"));
  const gx = Math.round(at.x / 60), gy = Math.round(at.y / 60);
  return {
    id: gx + "," + gy,
    /* The same pair the id is made of, kept as numbers: the board is
       generated from them, so the twelve names on a machine and the score
       the book files under it are talking about the same machine. */
    gx, gy,
    where: station ? (at.home ? "YOUR STATION" : "A STATION")
                   : (at.name || "THE SURFACE"),
    owner: f.short, colour: f.colour, who: f.key
  };
}

// Your best on this cabinet, per machine. Nothing here ever leaves the book.
const simBest = (id, key) =>
  (surv && surv.sims && surv.sims[id] && surv.sims[id][key]) || 0;

/* ── the board on a machine ───────────────────────────────────────────────
   The twelve the sector made up, with **you** in your place among them. Your
   row is not appended and it is not a thirteenth: it is *inserted at its
   rank*, which is the only arrangement that answers the question a player
   walks up to a board with, which is "who is just above me".

   Your own colour — seat 0, amber — because on a page of violet furniture and
   a faction's colour, the one row that is you has to be findable without
   reading it. That is the one place the sign-in pays off in single player:
   the name on it is the name you gave the door.

   Unplayed is not rank 13. A machine you have never touched shows the twelve
   and no row of yours at all, because a zero on a board is a worse thing to
   be shown than an honest absence. */
function simBoardOf(spot, key) {
  if (!spot || !WORLD.simBoard) return null;
  const made = WORLD.simBoard(spot.gx, spot.gy, spot.who, key,
                              CAMPAIGN_ORDER.length);
  const rows = made.map((r, i) => ({ rank: i + 1, name: r.name,
                                     score: r.score, you: false }));
  const mine = simBest(spot.id, key);
  if (!mine) return { rows, mine: 0, at: -1 };
  const me = { rank: 0, name: pilotName(), score: mine, you: true };
  /* Ahead of everyone you have beaten, and behind everyone you have not. A
     tie goes to the machine's own people: they were here first, and being
     told you have *equalled* somebody is a better reason to play again than
     being handed the rank on a technicality. */
  let at = rows.findIndex(r => r.score < mine);
  if (at < 0) at = rows.length;
  rows.splice(at, 0, me);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { rows, mine, at };
}

/* What a board calls you. The pilot name if the door has one — which after
   step 3 it does, for everybody — and a plain word if this copy of the game
   has no account service at all, because a board with a blank row on it is
   worse than a board that calls you YOU. */
function pilotName() {
  const who = cloud && cloud.enabled() && cloud.session();
  return (who && who.name) || "YOU";
}

/* Walking up to one. **Save first**: if the book will not write — private
   browsing, a full quota, both already handled by the store — the machine
   does not start and says why. There is no version of this where a game of
   asteroids costs somebody their hours. */
/* How long the cabinet takes to come up. Not a loading screen — there is
   nothing to load — but the difference between a menu and a machine is
   partly that a machine takes a moment, makes a noise, and boots. */
const SIM_BOOT = 0.9;
let simBoot = null;

function startSim(key) {
  if (!(mode && mode.survey && surv) || simBoot) return false;
  const spot = cabinetHere();
  if (!spot) { gameSound("hit"); return false; }
  if (!saveSurveyBook()) {
    gameSound("hit");
    note("The machine will not start: this browser will not let the game " +
         "save, and your sector is not going anywhere it cannot come back " +
         "from.");
    return false;
  }
  const me = ships[0];
  returnTo = {
    cabinet: spot,
    at: { x: me.x, y: me.y, a: me.a },
    result: null
  };
  simBoot = { key, t: SIM_BOOT };
  gameSound("start");
  return true;
}

/* The one thing a parked page counts down. Everything else on a page stands
   still — that is what parked means — but the coin has gone in and the
   machine is coming up, so this is stepped from the draw that shows it. The
   campaign's cabinet boots into its mission list rather than into a match,
   because three missions in order is what that machine is. */
function simBootTick(dt) {
  if (!simBoot) return;
  simBoot.t -= dt || 0;
  if (simBoot.t > 0) return;
  const key = simBoot.key;
  simBoot = null;
  if (key === "campaign") { levelPick = 0; state = "levels"; return; }
  startGame(key, 1, key === "royale" ? 3 : 0);
}

/* And coming back. The book has everything, so this is the resume path with
   two things bolted on: the score the machine just made, and standing where
   you were standing — `setupSurvey` puts the ship back, and one call to
   `surveyStations` is what turns being in the right place into being docked
   at it. */
function backToSurvey() {
  const back = returnTo;
  returnTo = null;
  if (net.on) netReset();
  localPause = false;
  banner = null; terminated = null; outcome = null;
  surv = null;
  startGame("survey", 1, 0);
  if (!surv) { state = "title"; return; }
  if (back && back.at && ships[0]) {
    const me = ships[0];
    me.x = back.at.x; me.y = back.at.y; me.a = back.at.a;
    me.vx = me.vy = 0;
    cam.x = me.x; cam.y = me.y;
    streamChunks(true);
    streamRocks();
  }
  // Docked or landed again, by the same rule the tick uses.
  surveyStations();
  /* The score, written now that there is a book to write it into. It was
     made after the save that crossed, so it has to be put back by hand —
     which is also why it is kept on `returnTo` rather than on `surv`, a
     thing that did not exist while the machine was running. */
  const r = back && back.result;
  if (r && back.cabinet) {
    const per = surv.sims[back.cabinet.id] || (surv.sims[back.cabinet.id] = {});
    if ((per[r.key] || 0) < r.value) per[r.key] = r.value;
    saveSurveyBook();
  }
  state = (surv.docked || surv.landed) ? "arcade" : "playing";
  /* What a game costs, said rather than discovered. The sector ran while you
     were in the machine: the traffic moved, the rocks are somewhere else, and
     whatever was being fought over near you was fought over without you. */
  note("Back at the " + (surv.landed ? "surface" : "station") +
       ". The sector carried on without you.");
}

/* Whether a machine is actually owed a return. `returnTo` is set when the
   coin goes in, but the campaign's cabinet boots into its mission list rather
   than into a match — so you can put a coin in, read the three missions, back
   out, and never have left the room at all. The survey is still loaded in
   that case, and the sector `returnTo` describes is the one you are standing
   in: crossing back to it would reload it from the book and throw away
   everything you had done since the coin, and quitting to the front page
   would land you in the sector instead. The only honest question is whether
   the survey is still in memory. */
const owedReturn = () => !!returnTo && !(mode && mode.survey && surv);

// Walking away from a machine without playing it: the coin is forgotten.
function cancelSim() { returnTo = null; simBoot = null; }

/* Backing out of the mission list, which is two journeys wearing one button.
   Boot the cabinet and you are still standing in the survey, nothing has been
   played and backing out is a walk across the room. Reach the same list from
   a finished mission's MISSIONS button and the survey is gone from memory —
   that is a real crossing and has to be made. */
function leaveLevels() {
  if (owedReturn()) { backToSurvey(); return; }
  if (returnTo) { cancelSim(); state = "arcade"; return; }
  state = "modes";
}

/* Survey, with the account question in front of it. It was inside `playCard`
   while the game was a card; it is the front page's own button now, and the
   card path calls this rather than keeping a second copy of the rule. */
function playSurvey() {
  const fly = () => startGame("survey", 1, 0);
  if (needsDoor()) openAccount(fly); else fly();
}

/* The machines, behind the same door as the game. The plan puts the question
   at the *game's* entrance rather than Survey's — "before single player and
   before multiplayer" — and both lanes are through here, so this is the only
   other place that has to ask. A cabinet inside a station does not: you are
   already in a sector, which means you are already through. */
/* Backing out of the mode cards. They used to sit under the front page's
   SIMULATORS door and went back to it; the door is gone, so they go back to
   wherever they were opened from — the room in a station, if there is a
   sector loaded and you are standing in one, and otherwise the front page.

   The room is the normal case and the title is the `O` shortcut's case: you
   can still open a lobby from the front page without a survey, and backing
   out of that has nowhere to go but the front page. */
function leaveModes() {
  if (mode && mode.survey && surv && (surv.docked || surv.landed)) {
    state = "arcade";
    return;
  }
  forgetTitleCard();
  state = "title";
}

/* ── the real board ───────────────────────────────────────────────────────
   The other kind, and the difference from the one at a cabinet is not
   decoration. A board in a station is made up, because a score one person
   made alone has nobody to witness it. This one is **witnessed**: every
   client in a match reports what it saw, and a row appears only where two
   accounts agreed. So it is the same board for everybody, and it is the only
   place in the game where a number means somebody else was there.

   Read once a session and cached — see `cloud.board`. A leaderboard is a
   number that moves when somebody finishes a game, and a read on every frame
   would spend the free tier on a row that did not change. */
const BOARD_GAMES = [
  { key: "survival", name: "SURVIVAL",      colour: "#ffe56d",
    cap: "WAVE", say: n => "WAVE " + n },
  { key: "royale",   name: "BATTLE ROYALE", colour: "#ff8f77",
    cap: "SURVIVED", say: n => clockText(n) },
  { key: "campaign", name: "CAMPAIGN",      colour: "#6dffbf",
    cap: "MISSIONS", say: n => n + " OF " + CAMPAIGN_ORDER.length }
];
const realBoards = { rows: {}, err: "", reading: false, read: false };

/* Two ways in now — the mode cards, and the room in a station — so it has to
   remember which, or backing out of it lands somewhere you have never been. */
let boardFrom = "modes";
function openBoards() {
  boardFrom = state === "arcade" ? "arcade" : "modes";
  state = "board";
  readBoards();
}

/* Asked for once, and never again while the page is open. A failure is kept
   and said rather than retried in a loop: the most likely reason a board
   cannot be read is that there is no connection, and hammering a dead
   network is not a way of fixing one. */
/* Asked for on every visit, and throttled one floor down: `cloud.board` keeps
   what it read for a minute and a half, so opening this page twice in a row
   costs one request and opening it after a match costs another. Gating it
   *here* instead — which the first version did — meant the page never changed
   again for as long as the tab was open, so your own score could never appear
   on it. The last good rows stay on screen while a new read is in flight. */
function readBoards() {
  if (realBoards.reading) return;
  if (!cloud || !cloud.enabled() || !cloud.session()) {
    realBoards.err = "no account service";
    realBoards.read = true;
    return;
  }
  realBoards.reading = true;
  Promise.all(BOARD_GAMES.map(g =>
    cloud.board(g.key, 10).then(rows => { realBoards.rows[g.key] = rows; },
                                err => { realBoards.err = err.message; })
  )).then(() => { realBoards.reading = false; realBoards.read = true; });
}
/* A match just happened, so whatever is cached is out of date — and the one
   board somebody wants to look at right now is the one they might have just
   got onto. */
const forgetRealBoards = () => {
  realBoards.err = "";
  if (cloud && cloud.forgetBoards) cloud.forgetBoards();
};

function drawBoards() {
  text("THE BOARD", SCREEN_W / 2, 92, 44, "#87d8ff");
  /* Said here because it is the whole difference between this page and the
     one in a station, and a player who does not know it cannot tell why one
     of them is worth anything. */
  text("witnessed \u00b7 a score counts when two people who were there agree",
       SCREEN_W / 2, 126, 15, "#ffcb42");
  text(todaysChallengeLine(), SCREEN_W / 2, 152, 13, "#ffcb42", "center", 0.9);

  const left = 40, right = SCREEN_W - 40, top = 196;
  const gap = 16;
  const w = Math.floor((right - left - gap * 2) / 3);

  BOARD_GAMES.forEach((g, i) => {
    const x = left + i * (w + gap);
    const rows = realBoards.rows[g.key];
    text(g.name, x + w / 2, top, 22, g.colour);
    text(g.cap, x + w / 2, top + 22, 12, "#ffcb42", "center", 0.6);

    if (!rows) {
      text(realBoards.reading ? "reading\u2026"
           : realBoards.err === "no account service"
             ? "sign in to see it"
             : realBoards.err ? "could not be read" : "\u2014",
           x + w / 2, top + 70, 14, "#ffcb42", "center", 0.55);
      return;
    }
    if (!rows.length) {
      /* Empty is the honest state of a new board and is worth saying out
         loud, because an empty leaderboard reads as broken otherwise. */
      text("nobody yet", x + w / 2, top + 66, 14, "#ffcb42", "center", 0.55);
      text("play one with somebody", x + w / 2, top + 86, 12, "#ffcb42",
           "center", 0.4);
      return;
    }
    rows.forEach((r, k) => {
      const y = top + 52 + k * 26;
      const tone = r.you ? PLAYERS[0].colour : "#ffcb42";
      const a = r.you ? 1 : 0.8;
      text(String(k + 1), x + 10, y, 13, tone, "left", r.you ? 0.9 : 0.5);
      text(r.name, x + 36, y, 14, tone, "left", a);
      text(g.say(r.value), x + w - 10, y, 14, tone, "right", a);
    });
  });

  /* What is still in this client's pocket. A match played on a train is a
     real result and it is going up; saying nothing about it would look like
     it had been dropped. */
  const waiting = cloud && cloud.scoresWaiting ? cloud.scoresWaiting() : 0;
  if (waiting) {
    text(waiting + " of your reports are waiting for a connection",
         SCREEN_W / 2, 600, 12, "#ffcb42", "center", 0.6);
  }
  if (realBoards.err && realBoards.err !== "no account service") {
    text(realBoards.err, SCREEN_W / 2, 620, 12, "#ff9d5c", "center", 0.7);
  }

  tapButton("BACK", SCREEN_W / 2, 650, 240, 44, "#ffcb42",
            () => { state = boardFrom; });
}

/* ── the competition ──────────────────────────────────────────────────────
   *"maybe even a comp"* — the smallest honest version, and it costs a
   function of the date. One machine is the sector's challenge at a time, the
   same one for everybody, and it turns over on a clock nobody owns: the UTC
   day. No network, no server, nothing to keep in sync, and it gives a board a
   reason to be looked at today rather than remembered from last week. */
function todaysChallenge() {
  const day = Math.floor(Date.now() / 86400000);
  return BOARD_GAMES[((day % BOARD_GAMES.length) + BOARD_GAMES.length) %
                     BOARD_GAMES.length];
}
const todaysChallengeLine = () =>
  "today the sector is playing " + todaysChallenge().name;

/* Playing with other people, from the room where the machines are. It was on
   the front page behind SIMULATORS and came off with it — so the lane page's
   *question* is gone (you are standing at a cabinet; the solo answer is the
   cabinet itself) and what is left is the half that was always the real
   question: which game, and with whom.

   The sector is saved first, exactly as walking up to a cabinet does, because
   this leads to a match the same way and by the same path out. */
function openWithPeople() {
  if (mode && mode.survey && surv && !saveSurveyBook()) {
    gameSound("hit");
    note("This browser will not let the game save, and a match is not worth " +
         "your sector.");
    return;
  }
  openLane("multi");
}

function openLane(key) {
  modeLane = key;
  modePick = 0;
  modeHover = -1;
  cardAnim = laneRows().map(() => 0);
  state = "modes";
}

/* The open card is whichever one the pointer is over, and the keyboard's
   otherwise. A mouse that has been moved is a stated preference and wins;
   leaving the row hands it back, so the two never fight over it. */
function openCard() {
  return modeHover >= 0 ? modeHover : modePick;
}

function drawModes(dt) {
  const L = LANES[modeLane];
  const rows = laneRows();
  text(L.name, SCREEN_W / 2, 92, 44, L.colour);
  text(L.line, SCREEN_W / 2, 126, 15, "#ffcb42");
  text(thumbInput() ? "TAP A MODE TO OPEN IT  ·  TAP AGAIN TO PLAY"
                 : "HOVER TO OPEN  ·  ARROWS MOVE  ·  ENTER PLAYS",
       SCREEN_W / 2, 152, 13, "#ffcb42", "center", 0.9);

  const left = 40, right = SCREEN_W - 40, top = 184, h = 372;
  const gap = 12, span = right - left - gap * (rows.length - 1);
  const open = openCard();

  /* Widths come from weights rather than from a fixed open size, so the row
     always fills the same span whatever is open and the cards beside the open
     one give up exactly what it takes. */
  let weights = [], total = 0;
  rows.forEach((key, i) => {
    cardAnim[i] += ((i === open ? 1 : 0) - (cardAnim[i] || 0)) *
                   Math.min(1, (dt || 0) * 10);
    const w = 1 + cardAnim[i] * 1.55;
    weights.push(w);
    total += w;
  });

  let x = left;
  rows.forEach((key, i) => {
    const c = CARDS[key];
    const w = span * weights[i] / total;
    const a = cardAnim[i];
    const isOpen = a > 0.5;

    /* Each mode has a hue and the row should be able to say so at a glance.
       When only the open card carried any, the row read as four grey boxes
       and one picture. */
    ctx.save();
    ctx.fillStyle = c.colour;
    ctx.globalAlpha = 0.07 + a * 0.10;
    ctx.fillRect(x, top, w, h);
    /* A bar along the top edge — the one piece of colour at full strength on
       a closed card, and what makes the row read as five modes rather than
       five panels. */
    ctx.globalAlpha = 0.55 + a * 0.45;
    ctx.fillRect(x, top, w, 3);
    ctx.strokeStyle = c.colour;
    ctx.globalAlpha = 0.45 + a * 0.55;
    ctx.lineWidth = isOpen ? 2 : 1;
    ctx.strokeRect(x, top, w, h);
    ctx.restore();

    /* The picture, and it takes the card. It was a 120-tall strip with a
       hundred and fifty of empty below it, because that space was reserved
       for a paragraph that is now one line. Every scene in `menu.js` is
       written against the box it is handed, so a taller one costs nothing —
       and it is the difference between a thumbnail and a window. */
    const pad = 8;
    const textH = 92 + a * 58;
    const artH = h - pad * 2 - textH;
    const artY = top + pad;
    if (menuArt) menuArt.preview(c.art, x + pad, artY, w - pad * 2, artH,
                                 menuClock());

    /* The picture fades out into the card in the mode's own colour instead of
       stopping at a ruled line, so the art and the words under it are one
       object rather than a panel with a screenshot stuck on it. */
    const fadeH = Math.min(80, artH * 0.4);
    const fade = ctx.createLinearGradient(0, artY + artH - fadeH, 0, artY + artH);
    fade.addColorStop(0, tint(c.colour, 0));
    fade.addColorStop(1, tint(c.colour, 0.2 + a * 0.12));
    ctx.save();
    ctx.fillStyle = fade;
    ctx.fillRect(x + pad, artY + artH - fadeH, w - pad * 2, fadeH);
    ctx.restore();

    const nameY = artY + artH + 26;
    text(c.name, x + w / 2, nameY, isOpen ? 24 : 15, c.colour);

    const who = modeLane === "solo" ? c.solo : c.multi;
    if (who) {
      // Inside the card, whatever the card's width happens to be this frame.
      const lines = wrapText(who, 12, w - 26);
      lines.forEach((ln, k) =>
        text(ln, x + w / 2, nameY + 24 + k * 18, 12, "#ffcb42", "center", 0.75));
    }

    // The line belongs to the open card alone; on a closed one there is
    // no room for it and it would only be four columns of hyphens.
    if (a > 0.35) {
      const lines = wrapText(cardLine(c), 14, w - 34);
      lines.forEach((ln, k) => {
        text(ln, x + w / 2, nameY + 56 + k * 21, 14, "#ffcb42", "center",
             (a - 0.35) / 0.65 * 0.95);
      });
    }

    /* One tap opens a card and the next one plays it. On a desk the hover has
       already opened it, so the first click plays — which is what a mouse
       user expects and what a thumb cannot do. */
    pushTap({ x, y: top, w, h, card: i, act: () => {
      if (!thumbInput() || modePick === i) { modePick = i; playCard(key); }
      else { modePick = i; modeHover = -1; }
    } });
    x += w + gap;
  });

  /* The witnessed board, offered on the page where you choose a game to play
     with other people. Not on the solo lane: a solo score has nobody to
     witness it, so there is nothing of yours that could ever be on it, and a
     button to a board you cannot reach is a worse thing than no button. */
  if (modeLane === "multi") {
    tapButton("BACK", SCREEN_W / 2 - 140, 600, 240, 40, "#ffcb42",
              leaveModes);
    tapButton("[B]  THE BOARD", SCREEN_W / 2 + 140, 600, 240, 40, "#87d8ff",
              openBoards);
    text(todaysChallengeLine(), SCREEN_W / 2, 648, 12, "#ffcb42", "center", 0.7);
  } else {
    tapButton("BACK", SCREEN_W / 2, 600, 240, 40, "#ffcb42",
              leaveModes);
    text("every key is yours to change — SETTINGS on the front page",
         SCREEN_W / 2, 648, 12, "#ffcb42", "center", 0.7);
  }
}

/* What a card actually does. Survey and the lobby go straight in; everything
   else needs to know how many are playing, and in the solo lane that question
   has one answer, so it is not asked. */
function playCard(key) {
  if (key === "online") { openLobby(); return; }
  /* Survey asks about the account before it builds a sector. The question only
     has a good answer beforehand — see `openAccount` — and this is the one
     moment every player passes through. Nobody else gets asked: an account
     does nothing for the modes that keep no progress. */
  /* The game is not a card any more — it is the front page. This stays as
     the one door either way in has to go through, so nothing can start a
     survey without passing the account question. See `playSurvey`. */
  if (key === "survey") { playSurvey(); return; }
  if (key === "campaign") { levelPick = 0; state = "levels"; return; }
  if (modeLane === "solo") {
    // One human. Battle Royale needs opponents to be a match at all, so it
    // gets bots; Survival alone is the game it has always been.
    pendingMode = key;
    startGame(key, 1, key === "royale" ? 3 : 0);
    return;
  }
  chooseMode(key);
}

function drawLevels() {
  text("CAMPAIGN", SCREEN_W / 2, 108, 54, "#6dffbf");
  text("three missions — play them in order, or drop into any one",
       SCREEN_W / 2, 148, 15, "#ffcb42");
  text("CLICK A MISSION  ·  OR MOVE WITH ARROWS + ENTER",
       SCREEN_W / 2, 180, 12, "#ffcb42", "center", 0.85);

  CAMPAIGN_ORDER.forEach((key, i) => {
    const m = MODES[key];
    const y = 244 + i * 112;
    tapButton((i + 1) + ".   " + m.name, SCREEN_W / 2, y, 620, 54,
              i === CAMPAIGN_ORDER.length - 1 ? "#ff6b6b" : "#6dffbf",
              () => chooseMode(key), levelPick === i);
    text(m.blurb, SCREEN_W / 2, y + 44, 15, "#ffcb42");
  });

  tapButton(returnTo ? "BACK TO THE MACHINES" : "BACK",
            SCREEN_W / 2, 640, 300, 44, "#ffcb42",
            leaveLevels);
}

/* Where the count screen goes back to, asked in one place because two things
   ask it and they had drifted apart: the BACK button went to the mission list
   when it had come from one, and Escape beside it went to the title whatever
   you had come from. Backing out of a mission you reached from a cabinet
   therefore landed you on the front page with your sector saved but
   apparently gone, which is the one thing the crossing exists to prevent. */
const countBack = () =>
  MODES[pendingMode] && MODES[pendingMode].campaign ? "levels"
    : returnTo ? "arcade" : "title";

function drawCount() {
  const m = MODES[pendingMode];
  const isCamp = m.campaign;
  text(m.name, SCREEN_W / 2, 96, 40, "#ffe56d");
  text(m.blurb, SCREEN_W / 2, 126, 14, "#ffcb42");
  text(isCamp
         ? "your side flies teal, the enemy flies red — friendly fire is off"
         : m.wrap
           ? "open space — fly off one edge and you arrive at the other"
           : "solid walls — you bounce, your shots don't",
       SCREEN_W / 2, 150, 13, "#ffcb42", "center", 0.8);

  const most = humanMax();
  text(thumbInput() ? "ONE PLAYER ON A PHONE" : "CHOOSE LOCAL PLAYERS",
       SCREEN_W / 2, 188, 19, "#ffcb42");
  text("CLICK A BUTTON  ·  OR MOVE WITH ARROWS + ENTER",
       SCREEN_W / 2, 214, 12, "#ffcb42", "center", 0.8);

  // The options in a row, each in the colour of the player it adds.
  const step = 200;
  const x0 = SCREEN_W / 2 - step * (most - 1) / 2;
  for (let i = 1; i <= most; i++) {
    const n = i;
    tapButton(i + (i === 1 ? " PLAYER" : " PLAYERS"),
              x0 + (i - 1) * step, 260, 174, 52,
              PLAYERS[i - 1].colour,
              () => selectHumanCount(n),
              countPick === i - 1);
  }
  // Bots fill the seats nobody is sitting in — which, with two hands to a
  // keyboard, is how a five-ship match gets its other ships. A mission brings
  // its own fleets, so it offers pilots only.
  if (!isCamp) {
    tapButton("BOTS: " + (botPick === 0 ? "NONE — CLICK TO ADD" : botPick),
              SCREEN_W / 2, 326, 320, 42,
              botPick ? "#ffe56d" : "#ffcb42",
              cycleBots);
    text(m.minPlayers > 1
           ? "battle royale needs two ships — a bot counts"
           : "bots take the seats nobody is sitting in",
         SCREEN_W / 2, 360, 13, "#ffcb42");
  } else {
    text("one or two pilots share this keyboard · allied fighters fly with you",
         SCREEN_W / 2, 330, 13, "#ffcb42");
  }

  let playY = 390;
  if (pendingMode === "survival") {
    tapButton("FRIENDLY FIRE: " + (survivalFriendlyFire ? "ON" : "OFF"),
              SCREEN_W / 2, 395, 360, 42,
              survivalFriendlyFire ? "#ff8f77" : "#6dffbf",
              toggleFriendlyFire, survivalFriendlyFire);
    playY = 445;
  } else if (isCamp) {
    // Difficulty: how many hits your ships take (Impossible: everything dies
    // in one). A steady continuous trigger and weak enemies mean Easy is a
    // gentle way in.
    text("DIFFICULTY", SCREEN_W / 2, 358, 14, "#ffcb42");
    const diffs = ["easy", "hard", "impossible"];
    const dstep = 214, dx0 = SCREEN_W / 2 - dstep;
    diffs.forEach((d, i) => {
      tapButton(DIFFICULTY[d].label, dx0 + i * dstep, 390, 196, 42,
                DIFFICULTY[d].colour, () => { campaignDifficulty = d; },
                campaignDifficulty === d);
    });
    text(DIFFICULTY[campaignDifficulty].blurb, SCREEN_W / 2, 424, 12, "#ffcb42");
    playY = 462;
  }

  const humans = countPick + 1;
  const bots = isCamp ? 0 : botPick;
  const canPlay = humans + Math.min(bots, MAX_PLAYERS - humans) >= m.minPlayers;
  tapButton(isCamp ? "START MISSION" : "PLAY", SCREEN_W / 2, playY, 300, 46,
            "#ffe56d", startCountChoice, false, canPlay);

  // Who is who, and which keys are theirs.
  const controlsY = playY + 56;
  text("CONTROLS", SCREEN_W / 2, controlsY, 15, "#ffcb42");
  keyRows().slice(0, most).forEach((p, i) => {
    const y = controlsY + 32 + i * 32;
    text(p.label, SCREEN_W / 2 - 150, y, 17, p.colour, "right");
    text(hintOf(p), SCREEN_W / 2 - 130, y, 15, "#ffcb42", "left");
  });
  text(thumbInput()
         ? "a stick and a fire button appear the moment you touch the screen"
         : "more than two? play online — one screen each",
       SCREEN_W / 2, controlsY + 46 + most * 32, 13, "#ffcb42");

  tapButton("BACK", SCREEN_W / 2, 650, 240, 44, "#ffcb42",
            () => { state = countBack(); });
  tapButton("SETTINGS", 650, 650, 240, 44, "#ffe56d",
            () => { state = openSettings("count"); });
}

/* ── the settings page ───────────────────────────────────────────────────
   A rail of categories down the left, and to the right of it one panel
   holding whatever that category is about.

   What was here before was a single stacked page, and its own comments had
   given up on it: "a fourth setting here needs the screen rearranged, not
   another column". It had in fact run out of room twice over. The line
   explaining INPUT was being drawn through the two buttons it explained. The
   phone had a second copy of the whole page with the live thumbstick sitting
   on top of RESET SURVEY, and its own SOUND, its own FULLSCREEN and its own
   EXIT, each written twice and each drifting from the other.

   The rail is what stops that happening again. A new setting is a new row in
   one panel and nothing below it moves, because nothing below it is sharing
   the space. A new *kind* of setting is a new entry in `SET_CATS`.

   The shell is capped and centred rather than stretched to the glass: a
   settings row a thousand pixels wide is a label and a button at opposite
   ends of a desk. Capped, the margins stay even on any screen the game will
   hand us — 1000 through 1680. */
const SET_RAIL_W = 190, SET_RAIL_GAP = 26, SET_SHELL_MAX = 1180;
const SET_TOP = 96, SET_BOT = 604;
// Rows are pitched for type that is never smaller than 16px — see
// `readableTextSize`, which is why the old page's "13px" notes were in fact
// sixteen and why they touched everything above them.
const SET_PITCH = 58;

function settingsShell() {
  const w = Math.min(SCREEN_W - MENU_INSET * 2, SET_SHELL_MAX);
  const x = Math.round((SCREEN_W - w) / 2);
  const px = x + SET_RAIL_W + SET_RAIL_GAP;
  return { x, w, railX: x, railW: SET_RAIL_W, px, pw: x + w - px,
           top: SET_TOP, bot: SET_BOT };
}

const setRowY = (sh, i, top) => sh.top + (top || 88) + i * SET_PITCH;
// The row along the foot of the panel, for the things that *do* something
// rather than being set to something: RESET ALL KEYS, SWAP SIDES.
const setActY = sh => sh.bot - 26;

/* Four: what you drive it with, what the game does, what it sounds like,
   and who you are. Audio used to be one toggle inside GAME; it has its own
   page now that it has a volume per kind of sound, because "the guns are too
   loud" is a question somebody should be able to answer without muting the
   whole game. */
const SET_CATS = [
  { key: "controls", name: "CONTROLS", blurb: "what you are driving it with" },
  { key: "game",     name: "GAME",     blurb: "what the game does" },
  { key: "audio",    name: "AUDIO",    blurb: "what it sounds like, and how loud" },
  { key: "account",  name: "ACCOUNT",  blurb: "who you are, and what is saved" }
];

/* The four ways to fly it, as a row of tabs along the top of CONTROLS. A tab
   rather than a rail entry of its own because they answer one question —
   *this* is the thing in my hands — and only one of them is ever true at a
   time for the person reading it. */
const CONTROL_TABS = [
  { key: "mouse",  name: "MOUSE",       colour: "#6dc8ff" },
  { key: "keys",   name: "KEYS",        colour: "#ffe56d" },
  { key: "pad",    name: "CONTROLLER",  colour: "#a08cff" },
  { key: "touch",  name: "TOUCHSCREEN", colour: "#6dffbf" }
];
let controlTab = "keys";
const settingsCats = () => SET_CATS;
const settingsCatNow = () =>
  SET_CATS.find(c => c.key === settingsCat) || SET_CATS[0];

/* ── registering a control ────────────────────────────────────────────────
   Every control on the panel goes on `setItems` with a row and a column, so
   `setMove` can walk the page without knowing what any of it is. A key cell
   carries `cell` as well, because the grid draws its highlight off the
   binder and the two have to agree. */
function setPush(rect, row, col) {
  rect.row = row; rect.col = col;
  setItems.push(rect);
  return setItems.length - 1;
}

function focusRing(x, y, w, h, colour) {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
  ctx.restore();
}

function panelButton(label, x, y, w, h, colour, act, row, col, on, enabled) {
  const live = enabled !== false && typeof act === "function";
  const i = live ? setPush({ x: x - w / 2, y: y - h / 2, w, h, act }, row, col)
                 : -1;
  tapButton(label, x, y, w, h, colour,
            () => { if (i >= 0) { setFocus.where = "panel"; setFocus.i = i; }
                    act(); },
            !!on, enabled !== false);
  if (i >= 0 && setFocus.where === "panel" && setFocus.i === i) {
    focusRing(x - w / 2, y - h / 2, w, h, colour);
  }
}

/* One setting, one row: what it is on the left and what it is set to on the
   right.

   A line underneath is for the word that does not explain itself, and most
   of them explain themselves. SOUND: ON does not need telling you that the
   sound is on. CAMERA: ROTATING does, because neither word says what happens
   to the picture; TOUCH CONTROLS: AUTOMATIC does, because automatic could
   mean anything; RESET SURVEY does, because it destroys hours of somebody's
   work. Everything else goes without, and the page is shorter and easier to
   read down for it.

   Where there is one, it runs the full width of the panel, because the
   button it shares a line with is at the other end of it. */
function setRow(sh, i, o, top) {
  const y = setRowY(sh, i, top);
  const bw = o.wide ? 320 : 260;
  text(o.label, sh.px, y + 6, 17, "#ffe56d", "left");
  /* Some of these mean something in one mode and nothing in the other three
     — the zoom is Survey's, friendly fire is Survival's. They are on the
     page all the same, set from anywhere, with the mode they belong to
     beside the name. Hiding a setting until you are already in the mode it
     belongs to is how you end up with four pages again. */
  if (o.tag) {
    ctx.save();
    ctx.font = '17px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    const at = sh.px + ctx.measureText(o.label).width + 14;
    ctx.restore();
    text(o.tag, at, y + 5, 12, "#a08cff", "left", 0.7);
  }
  /* Clear of the button's bottom edge rather than merely below the label.
     A note is as wide as it needs to be and the button is at the far end of
     the same line, so a note set any higher runs underneath it — which is
     exactly what the line explaining INPUT used to do. */
  /* Under its own label and hard up against it. Sitting lower, it was 34px
     below the label it belonged to and 24 above the next one — so it read as
     a heading for the row underneath. And wrapped to the space beside the
     button rather than the whole panel, because the button is at the other
     end of this same line. */
  if (o.note) {
    wrapText(o.note, 13, sh.pw - bw - 24).slice(0, 2).forEach((ln, k) =>
      text(ln, sh.px, y + 26 + k * 18, 13, "#ffcb42", "left", 0.6));
  }
  panelButton(o.value, sh.px + sh.pw - bw / 2, y, bw, 40,
              o.colour || "#ffe56d", o.act, i, 0, o.on, o.enabled);
}

// A row of things that happen when you press them, spread across the foot.
function setActions(sh, row, list) {
  const live = list.filter(a => a);
  if (!live.length) return;
  const gap = 14;
  const bw = Math.min(300, (sh.pw - gap * (live.length - 1)) / live.length);
  const x0 = sh.px + sh.pw / 2 - (live.length * (bw + gap) - gap) / 2;
  live.forEach((a, i) => {
    panelButton(a.label, x0 + i * (bw + gap) + bw / 2, setActY(sh), bw, 42,
                a.colour || "#ffcb42", a.act, row, i, a.on, a.enabled);
  });
}

function panelHead(sh, name, blurb, colour) {
  text(name, sh.px, sh.top + 18, 20, colour || "#ffe56d", "left");
  ctx.save();
  ctx.strokeStyle = colour || "#ffcb42";
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sh.px, sh.top + 32);
  ctx.lineTo(sh.px + sh.pw, sh.top + 32);
  ctx.stroke();
  ctx.restore();
  if (blurb) text(blurb, sh.px, sh.top + 54, 13, "#ffcb42", "left", 0.55);
}
