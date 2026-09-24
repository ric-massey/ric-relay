"use strict";

/* KONDRITE — SURVEY
   ─────────────────────────────────────────────────────────────────────────────
   The fourth mode, introduced, and where its book lives.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── SURVEY ──────────────────────────────────────────────────────────────
   A fourth thing to do with the same engine, and the only one with nothing
   shooting at you. The war is over; this is the space afterwards, and the job
   is to look at it. There is no wall, no enemy, no score and no losing — the
   only thing that accumulates is the almanac.

   It reuses Battle Royale's camera-followed view and the gravity wells, and
   inverts what both of them are for. A well is no longer only a way to die: a
   star is the one place a hull repairs, and a black hole is the fastest way
   across open space if you are willing to fall into one on purpose. That
   inversion is most of the mode. The rest is that the chart starts blank.

   ── the sector has no edges ──────────────────────────────────────────────
   Survey does not have an arena. Space is generated in chunks as you reach
   them and thrown away behind you: what a chunk contains is a pure function
   of the seed and the chunk's coordinates, so flying back to a place you left
   an hour ago finds the same stars where you left them without any of it
   having been kept. Nothing is ever stored for space you have not visited,
   which is the only way an endless map costs less than endless memory.

   Two consequences shape everything downstream. Ships never bounce off
   anything, because there is nothing to bounce off — the wall code is skipped
   rather than moved out of the way. And "percent charted" is meaningless,
   since every fraction of an infinite plane is zero, so what the player is
   given is a count of cells and the three CARTOGRAPHER entries are thresholds
   on that count.

   `surv` holds the whole of a survey the way `camp` holds a mission. The
   almanac and the chart are longer-lived than that — written to local storage
   and survive the tab, because a list you rebuild every session is a score
   and not a record. */

const surveyHUD = window.KondriteSurveyHUD || null;
// The mode cards’ moving pictures. Absent is survivable: a card without
// its diorama is a card, and the menu still works.
const menuArt = window.KondriteMenu || null;
// And the front page's, which is a whole run rather than a picture of one.
// Absent is survivable the same way: the title draws on plain black.
const attract = window.KondriteAttract || null;

/* ── where the book lives ─────────────────────────────────────────────────
   `v4` is the first format that says its own version inside the file. `v3` is
   read once, migrated and left alone — an old build opened after a new one
   should still find the save it wrote, so the old key is never deleted.

   The backup is the last book that parsed *and* validated. It is written on
   the way past, before the primary is replaced, so a save that goes wrong
   leaves one good book behind rather than none. */
const SURVEY_STORE  = LEV_ONLY ? "kondrite.survey.levlab"
                               : "kondrite.survey.v4";
const SURVEY_BACKUP = SURVEY_STORE + ".backup";
const SURVEY_LEGACY = LEV_ONLY ? null : "kondrite.survey.v3";
const SAVE_VERSION  = 5;
const CHUNK         = 2600;   // world units a side
const CHUNK_LOAD    = 2;      // chunks kept either side of the ship: a 5×5 block
/* Wider, and shifted forward, while the light drive is running. The box has to
   reach past the five-second impact horizon — about seven chunks at full
   speed — and it has to keep the ship inside itself, so it grows as well as
   moves. It costs 13×13 chunks instead of 5×5 for as long as the run lasts. */
const LIGHT_LOAD    = 6;
const LIGHT_LEAD    = 4;
const SURVEY_SIGHT  = 700;    // charted either side of the ship as it flies
/* Seconds to recharge the pulse. Nine was the figure for years; it is twelve
   now — thirty per cent longer — because a scan you can press again almost
   immediately is a button rather than a decision, and the whole mode is built
   around the moment you choose where to point it.

   The thirty per cent is buyable back. See COOLANT LOOP in `MODULES`: it takes
   one of your four slots to get the old rate, which is exactly the kind of
   question the slots exist to ask. */
const SURVEY_SCAN   = 12;     // seconds to recharge the pulse
const SURVEY_REPAIR = 0.55;   // hull points a second, in a star's light
// Rocks kept around the ship. 90 first, cut to 76 when the sector was made
// legible, and up a tenth to 84 on Ric's call — the field reads a little
// thicker without going back to the clutter 76 was chosen to end.
const SURVEY_ROCKS  = 84;
const SURVEY_ROCK_R = 3200;   // how far out they are kept
const SURVEY_HULL   = 6;   // five for years; the sixth is Ric's call
/* Where the first station stands, and therefore where you come back to. One
   constant, because the generator and the respawn both need it and a respawn
   into empty space beside a station that moved would be the worst possible
   bug to find. */
const HOME_STATION  = { x: 620, y: 300 };
