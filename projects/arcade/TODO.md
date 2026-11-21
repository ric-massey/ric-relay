# Arcade minigames — to do

The nine small games (Solitaire, Tic-tac-toe, Chess, Wordle, Sudoku, Minesweeper,
Tetris, Checkers, Snake). Started 2026-11-21 from a look at every game, code and
page. Tick an item (`[x]`) in the same commit that builds it, and say *why* next to
anything Ric decided, with the date and his words.

## Ric's calls

- 2026-11-21, Ric: "minesweeper needs the timer btw it always has one but solitare
  and sudoku dont need one." → Minesweeper keeps its clock as it is. Solitaire and
  Sudoku no longer show a clock. Time is still kept quietly, so a win can still go
  on the fastest-times board (the win card says the time), and a **Show timer**
  button brings the clock back for anyone who wants to race.
- 2026-11-21, Ric: "for snake on mobile swiping needs to be a way you can play too."
- 2026-11-21, Ric: "making the chess peices look better would be nice allong with the
  rest of your changes please. maybe start a file for todo in minigames" → this file,
  and every item below was asked for.
- 2026-11-21, Ric, after trying Snake on his phone: "if you drag right the snake moves
  to the right of the screen how would it turn more?" → each swipe is measured from
  where that stroke starts, so a short flick from anywhere turns again; a flick that
  registers buzzes (where phones allow) and lights the matching arrow button.
- 2026-11-21, Ric: "can you make it all look more polished? polish is extremely
  important in this." → the polish pass below. Keep that bar for every change here.

## Polish pass (2026-11-21, second round)

- [x] Compact header (no jump-scroll), so the board and New game share the first screen.
- [x] Tool rows: main actions, then quiet toggles (timer, helpers) on a smaller row.
- [x] Result card: animated entrance, blurred backdrop, Back to game on the left.
- [x] Snake/Tetris start screen: title, round Play button, keycaps (touch wording on
      phones); Pause only shows while playing; on-screen arrows/buttons only on touch
      screens; Tetris buttons in one row on a phone.
- [x] Solitaire cards: rank and suit at both corners, J/Q/K lettered, face-down cards
      stacked tight, the table only as tall as it needs.
- [x] Chess/checkers: clean coordinates in the square colors, softer move dots;
      checkers drawn as ridged discs with a gold crown for kings.
- [x] Minesweeper: classic number colors on the Desktop 95 style.
- [x] Sudoku number pad as wide as the grid; Wordle keys full size.
- [x] Tetris score, lines, level and best in the panel beside the well.
- [x] Tic-tac-toe: a faint X or O where you're about to play.

## Built 2026-11-21

Everything ticked below was built in one pass and checked in the browser (desktop
and phone size). Chess levels are 1/2/3 plies (hard thinks about a third of a
second); 4 plies was stronger but took up to a few seconds and froze the page.

## Every game (shared, `app.js` / `style.css`)

- [x] **Save and resume.** Every move saves the game in this browser
      (`classics:save:<game>`); coming back puts you where you were. New game starts
      over. Snake and Tetris save when paused or when the tab is hidden.
- [x] **Solitaire and Sudoku without a clock** (see Ric's call above).
- [x] **Your stats** beside the scoreboard: played, won, current and best streak,
      best result. Kept in this browser (`classics:stats:<game>`).
- [x] **Board fits the window** — the bottom of the chess board, Wordle's keyboard and
      Snake's buttons sat below the fold on a laptop.
- [x] **Undo** where it was missing: Sudoku, Tic-tac-toe, Minesweeper (taking back a
      mine keeps that game off the board).
- [x] **Movement**: pieces slide, cards land, Wordle tiles flip, a small celebration
      on a win. All of it off for people who ask their device for less motion.

## Solitaire

- [x] Double-click / double-tap a card to send it home.
- [x] Drag and drop, as well as tap-tap.
- [x] Finish automatically once every card is face up.
- [x] Hint button; a note when no moves are left.
- [x] Draw 3 option (Draw 1 is the scoreboard game).

## Tic-tac-toe

- [x] Easy / Medium / Unbeatable computer.
- [x] Running tally (you, computer or O, draws), saved.
- [x] Line drawn through the winning three.

## Chess

- [x] **Better-looking pieces** — drawn pieces (SVG) instead of font symbols, coloured
      by each style.
- [x] Last move highlighted; king shown in red in check.
- [x] Move list and captured pieces.
- [x] Easy / Medium / Hard computer; play as Black (board flips).
- [x] Hint.

## Checkers

- [x] Last move highlighted.
- [x] Easy / Medium / Hard computer (with a proper pruned search so it never stalls).
- [x] Captured pieces shown.

## Wordle

- [x] Row shakes on a word that isn't accepted; tiles flip when a guess is revealed.
- [x] Stats: played, win %, streak, guess chart.
- [x] Share button (copies the coloured squares, no letters).
- [x] Countdown to the next daily word.
- [x] Hard mode (found letters must be used).

## Sudoku

- [x] Tapping a square highlights every square with the same number.
- [x] Placing a number clears it from notes in its row, column and box.
- [x] Number pad shows how many of each number are left.
- [x] Show mistakes (keeps that game off the board, like Reveal).
- [x] Fill in all notes helper.

## Minesweeper (keeps its timer)

- [x] Press and hold to flag on a phone.
- [x] Face button to restart; mines-left counter.
- [x] Play the same board again after a loss (not eligible for the board).
- [x] Expert field, 99 mines: 30 × 16, standing upright (16 across) on a screen taller
      than it is wide. Board `mines-expert` (see the Worker note below).

## Tetris

- [x] Hold a piece (C or Shift, and a button).
- [x] Three upcoming pieces.
- [x] Half a second before a piece locks, so it can slide at the last moment.
- [x] Flash when lines clear; your best score shown while playing.
- [x] Phone: swipe to move/drop, tap to rotate.

## Snake

- [x] **Swipe anywhere on the board to steer on a phone**, mid-swipe, several turns in
      one drag (Ric's call above).
- [x] Speed choice and a through-the-walls mode (only Classic posts to the board).
- [x] Your best shown while playing; a burst when an apple is eaten.
- [x] Two turns can be queued, so quick swipes aren't lost.

## Ideas (built 2026-11-21, Ric: "work on the ideas not built yet in the todo")

- [x] Chess Hard thinks in a Web Worker (`chess-worker.js`): deeper each pass until
      ~1.8 s, following captures at the end (quiescence), so it no longer leaves pieces
      hanging. The page never stalls (longest pause measured: 21 ms). On a file:// page
      it falls back to a shorter search on the page.
- [x] Sound effects, off by default: a speaker button beside New game, one setting for
      every game (`classics:sound`). Sounds are made with Web Audio; no files.
- [x] Daily Sudoku (medium) and daily Solitaire (draw one): same deal for everyone on a
      UTC date, from `E.seeded(game + ':' + date)`. A replay of a finished daily stays
      off the board; a countdown shows the next one.
- [x] Expert Minesweeper (above).

**Worker deployed 2026-11-21** (Ric ran Actions → Deploy Worker): the live scoreboard
answers `mines-expert`, `sudoku-daily-<date>` and `solitaire-daily-<date>`.

## Ideas not built yet

- [ ] (none yet; add the next ones here)
