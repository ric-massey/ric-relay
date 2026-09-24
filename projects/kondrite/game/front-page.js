"use strict";

/* KONDRITE — THE FRONT PAGE
   ─────────────────────────────────────────────────────────────────────────────
   The attract loop, wired to attract.js.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ═══ THE FRONT PAGE ══════════════════════════════════════════════════════
   One game, and a machine.

   It used to be a menu *of games*: two lanes, solo and multiplayer, and four
   modes behind each of them with Survey as one of the four. That is a row of
   peers, and it was the last place in the interface still saying the game is
   one of several things in here.

   So the page says the game, loudly, with its own picture — and nothing else.
   There was a quieter door to the machines here too; it came off on 20
   September 2026, because a cabinet is a thing a *station* has and a door to
   one on the front page made it a second thing the game offers. See
   `HUD.drawArcade`, which is where the machines and the people now are.

   What the button says is the book's own line. `surveyBlurb` already counts
   what you have logged, and a returning player's front page now reads
   "31 LOGGED · CONTINUE THE SECTOR" before they have pressed anything.

   There is deliberately **no** "begin a new survey" on this page. A sector is
   hours, the button that throws one away has no business next to the button
   that resumes it, and the game already has one place where that happens: the
   reset in SETTINGS, which arms on the first press and wipes on the second.
   One way to lose a sector, and it is a decision. */
function drawTitle(dt) {
  /* ── the art is the page ───────────────────────────────────────────────
     It used to be a 760-wide diorama in a bordered box floating in the
     middle of the screen, with the idling field drifting across the title
     over the top of it. That is a menu with a picture on it. A title screen
     has the picture *behind* it — so the scene is full bleed, the drift is
     covered by it rather than gated off (this draws after it), and
     everything else sits on a scrim.

     Ric, 20 September 2026: *"less words … look like a real start up page
     from a professional gaming company."* Two sentences came off with the
     box — one about stations and one about how many people can play —
     because a front page is not where a game explains itself.

     And then, the same day: *"i want it to be the starting ship flying
     around shooting astroids with the ocasional star slingshot or black hole
     slingshot. and maybe passing a station and a few other ships. flying
     around maybe getting into the fight."* Every one of those is an event,
     and the version this replaced could not have one: it was a closed-form
     scene, which is the right shape for a card 174 pixels tall and the wrong
     shape for a page. So the front page is a **run** now — a real ship with
     a real pilot in a field that can be destroyed, with the survey's own
     flight model, gravity and thrown-speed rules under it. See attract.js. */
  /* `wScale` divides every line width the game draws, and it is left holding
     the camera's zoom by the last world frame — so coming back to the front
     page from a survey used to draw the whole of it at 1.4× the intended
     weight. A menu is drawn in screen units; say so. */
  const wasScale = wScale;
  wScale = 1;
  if (attract) attract.draw(0, 0, SCREEN_W, SCREEN_H, menuClock());

  /* The scrim: darkest at the top and bottom, barely there across the
     middle, so the wordmark and the buttons have something to sit on while
     the scene still reads through the waist of the page. */
  /* Light. *"you cant even see the backround"* — so the scrim's job shrank
     to the two bands where text actually sits, and even there it is a tint
     rather than a curtain. The scene is meant to be looked at. */
  /* And lighter again at the bottom, which is where the run is. The scene's
     ship sits at about seven tenths of the way down — deliberately, so it is
     clear of the wordmark and the buttons — and the old curve had its
     heaviest tint over exactly that band: the subject of the picture was
     under the thickest part of the curtain. The dark now starts in the last
     eighth, where the two corner switches are and nothing else. */
  const scrim = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
  scrim.addColorStop(0,    "rgba(10, 11, 16, 0.42)");
  scrim.addColorStop(0.28, "rgba(10, 11, 16, 0.04)");
  scrim.addColorStop(0.60, "rgba(10, 11, 16, 0.14)");
  scrim.addColorStop(0.88, "rgba(10, 11, 16, 0.20)");
  scrim.addColorStop(1,    "rgba(10, 11, 16, 0.58)");
  ctx.save();
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  /* And a soft pool under the middle column, so the wordmark and the buttons
     sit on something rather than on whatever the scene happens to be doing
     behind them this second. */
  const pool = ctx.createRadialGradient(
    SCREEN_W / 2, SCREEN_H * 0.5, 30,
    SCREEN_W / 2, SCREEN_H * 0.5, Math.max(SCREEN_W, SCREEN_H) * 0.36);
  pool.addColorStop(0, "rgba(10, 11, 16, 0.40)");
  pool.addColorStop(1, "rgba(10, 11, 16, 0)");
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.restore();

  /* ── the wordmark ──────────────────────────────────────────────────────
     High, large, and with air around it. A chondrite is the commonest stony
     meteorite — the old, undifferentiated stuff a solar system got made out
     of — and the K is the stylisation. */
  text("KONDRITE", SCREEN_W / 2, 186, 78, "#ffe56d", "center", 1, "0.06em");
  text("a survey of endless space", SCREEN_W / 2, 224, 15, "#ffcb42",
       "center", 0.85, "0.22em");

  /* ── one thing to press ────────────────────────────────────────────────
     The primary action, and under it the only fact worth putting on a front
     page: how much of your sector is written down. */
  const card = titleSurvey();
  const on0 = titlePick === 0;
  laneAnim[0] += ((on0 ? 1 : 0) - laneAnim[0]) * Math.min(1, (dt || 0) * 9);
  const bw = Math.min(360, SCREEN_W - MENU_INSET * 2);
  /* The count sits *above* the button rather than under it. Under, it was
     ten pixels off the border and read as part of the button; above, it is
     the line the button answers. */
  text(card.sub, SCREEN_W / 2, 396, 12, "#ffcb42", "center", 0.55, "0.24em");
  tapButton(card.head, SCREEN_W / 2, 428, bw, 52, "#a08cff",
            () => playSurvey(), on0);

  const on1 = titlePick === 1;
  laneAnim[1] += ((on1 ? 1 : 0) - laneAnim[1]) * Math.min(1, (dt || 0) * 9);
  tapButton("SETTINGS", SCREEN_W / 2, 492, bw, 38, "#ffcb42",
            () => { state = openSettings("title"); }, on1);

  /* ── and the two switches ──────────────────────────────────────────────
     Sound and fullscreen are not things you came here to do, so they stop
     being three equal buttons in a row with SETTINGS and become a pair of
     small ones in the corner, where a title screen keeps its switches. */
  const cy = SCREEN_H - 46;
  tapButton(soundEnabled ? "SOUND ON" : "SOUND OFF",
            SCREEN_W - 248, cy, 130, 30,
            soundEnabled ? "#ffe56d" : "#ffcb42", toggleSound, false);
  tapButton(fullscreenLabel(), SCREEN_W - 110, cy, 130, 30, "#ffcb42",
            toggleFullscreen, false, fullscreenSupported());
  wScale = wasScale;
}
