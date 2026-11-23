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

## Round three: six real styles, one game at a time (started 2026-11-21)

Ric, 2026-11-21: "i would like it way more high quality like terminal style should
look like a terminal you know? like completey terminal style. like ascII style as
well." Then: "i want like 6 styles. but each of the styles even the original looks
like an ai made it how do we make it higher quality. like each game needs to be
looked at individually and though about what would people want when playing this
game. like checkers. then look deep into checkers and how to improve it but do that
to all of them … not just all uncompasing."

So, per game, Checkers first (his example), each one finished, checked at desktop
and phone size, and pushed before the next:

1. **What players of this game want**, worked out for that game alone, written under
   its heading below, then built.
2. **Six styles that are each a real thing**, not a palette: each restyles the whole
   page (type, buttons, panels, result card) and draws the board and pieces its own
   way. A Terminal style is ASCII text all the way down. Each style is an
   `<option data-look="…">`; `body[data-look]` carries it for CSS and rendering.
3. Old styles stay only if they can be made genuinely good; otherwise replaced. A
   saved style number that no longer exists falls back to the first style.

Order: Checkers → Chess → Solitaire → Minesweeper → Sudoku → Wordle → Tetris →
Snake → Tic-tac-toe.

**Each page is built around its game, not one template** (Ric, 2026-11-21, after
seeing Checkers: "its not the board each page for the game needs to be catered to
it rn the snake game has the same look as the checkers and check a sudoku … the
page for each [game] needs to be catered to the game"). Every page had the same
heading, status bar and Scoreboard/Your games/Rules sidebar. Now each page has its
own markup and layout; app.js only needs the element ids (`stage`, `tools`,
`status`, `hint`, `mode`, `new-game`, `style-switch`, …), and optional slots
(`stats-slot`, `sheet-slot`) say where the stats and move list go. The rules move
into the help dialog wherever the page has no room for them. Page concepts:

- [x] **Checkers** (built 2026-11-21): a game at a table. The board in the middle of the table surface;
  a player plate above and below it (name, captured pieces, a turn light), and the
  scoresheet beside the board like paper on the table, with your record at its foot.
- [x] **Chess:** a club board between two player plates (with captured material), the
  move list as a scoresheet column beside it.
- [x] **Solitaire:** the whole page is the table; a slim toolbar; no sidebar.
- [x] **Minesweeper:** the page is a desktop window: title bar, menu, counter / face /
  clock panel, the field; best times in their own window.
- [x] **Sudoku:** a puzzle-book page: puzzle number and date as a header, the grid
  centred, the number pad as a tray beside it, notes and checks as pencil tools.
- [x] **Wordle:** one narrow column: tiles, then the keyboard docked to the bottom on a
  phone; stats and share in their own sheet.
- [x] **Tetris:** an arcade cabinet: the well in the middle, hold and next on the
  cabinet's side panels, the high scores as an attract screen.
- [x] **Snake** (built 2026-11-21): a handheld: the screen in a device body with its d-pad and buttons,
  score on the LCD, high scores on the device's menu screen.
- [x] **Tic-tac-toe:** a page of paper, the grid drawn on it, the tally kept in the
  margin.

### Checkers: what players want (built 2026-11-21)
- [x] The dark side moves first, as in real American checkers, and the sides are
      named by the set's colors (Red and White, Black and Red…), not Light and Dark.
- [x] See your options: when a jump is required, the pieces that must jump glow, and
      trying any other move says why it isn't allowed.
- [x] Drag a piece as well as tap it.
- [x] Kings are two checkers stacked, as on a real board.
- [x] Captured pieces go to trays beside the board, not a line of text.
- [x] Squares numbered 1–32 and a scoresheet in standard notation (11-15, 22x15,
      9x18x27), shown in the styles where players expect them.
- [x] Hint.
- [x] Six styles: Tournament (green and buff board, red and white pieces, numbered
      squares, scoresheet), Diner (red and black, chrome and formica), Heirloom
      (inlaid wood board, turned wooden pieces), Newsprint (a newspaper checkers
      problem: hatched squares, engraved pieces), Park table (painted concrete board,
      bottle-cap checkers), Terminal (the board in ASCII).

### Snake: what players want (Ric, 2026-11-21: "Yes, do Snake next"; built the same day)
- [x] The page is the game in your hands: a handheld with the screen in a bezel, a
      d-pad and A/B buttons on the body (A starts and pauses, B deals a new game),
      score and high score on the screen, and the high scores on the side like the
      card that came in the box.
- [x] No cheap deaths: a 3-2-1 count before a game starts and when it resumes.
- [x] See what killed you: the snake blinks where it died before the result.
- [x] On the phone, the controls sit under your thumbs and every turn you make
      registers (two queued turns, swipe anywhere, a buzz on each apple).
- [x] Six devices, each drawing the snake its own way: Pocket (a grey handheld
      with a four-shade green screen that smears like a real slow LCD), Brick phone
      (a candybar phone: dark pixels on a lit screen, played on the 2-4-6-8 keys),
      LED tabletop (a 1980s tabletop game, a grid of red LEDs that light up),
      Candy (a see-through coloured handheld, the full-colour snake gliding
      smoothly), Calculator (a graphing calculator's dot-matrix screen and key
      grid), Terminal (the snake as ASCII text: @ head, o body, * apple).

### Chess: what players want (Ric, 2026-11-21, answering the questions for Chess; built the same day)
- [x] Review the game: click any move in the list (or ← →) to see the board then.
- [x] Resign and offer a draw; the computer takes a draw only when it's level.
- [x] Opening name as you play, and +N material on the plate of whoever is ahead.
- [x] Draw arrows and circles (right-drag / right-click); copy the game as PGN.
- [x] Optional chess clock (Ric: "Optional clock"): off by default, 5 / 10 / 15
      minutes, shown on each player plate.
- [x] Terminal: type moves (e2e4, Nf3) at a prompt under the ASCII board, as well
      as clicking (Ric: "Yes, type moves too").
- [x] Six styles (Ric: "Yes, those six"): Club (green and buff roll-up board,
      plastic Staunton pieces, scoresheet), Heirloom (walnut and maple, boxwood and
      ebony pieces), Marble hall (stone board, carved pieces), Book diagram (a chess
      book's diagram: hatched squares, printed figurines), 8-bit computer (an 80s
      home-computer chess program, pixel pieces), Terminal (ASCII). Walnut club and
      Midnight match go.
- [x] The computer accepts a draw only from move ten on, and only when it isn't
      better (a short search from its side); otherwise it says why it declines.
- [x] The whole page designed for chess (Ric: "the actual page itself needs to be
      catered towards chess like the entire design. not a template look at all"):
      no shared heading/sidebar; each style restyles everything on the page.

### Solitaire: what players want (Ric, 2026-11-21: "Do solitaire", then his answers) — built the same day
- [x] The page is the table (concept above): the felt fills the page, a slim
      toolbar along the top, the score on the table's edge, your record and the
      scoreboard in their own sheet instead of a sidebar.
- [x] Standard points (Ric: "Standard points"): +5 waste to a column, +10 to a
      suit pile, +5 for turning a card over, −15 for taking a card back off a
      pile, −100 (draw one) / −20 (draw three) for going through the deck again,
      never below 0. Points on the table edge; best points kept with your games.
- [x] Winnable deals only (Ric picked it): an option; a solver plays each deal out
      before you see it and only deals one it can win. Off the page's thread.
- [x] Real cards: number cards laid out in pips like a printed deck, picture
      cards framed, so each style can draw its own deck.
- [x] Classic layout kept (Ric: "Keep the classic layout"): stock top left.
- [x] Six styles (Ric: "Yes, those six"): Card room (green baize, crisp casino
      cards), Parlour (Victorian patience on mahogany, ornate backs), Kitchen
      table (worn wood, a well-loved deck), Large print (big, high-contrast cards
      for phones, four-colour suits), Pixel (early-90s pixel-art cards on a
      dithered table), Terminal (ASCII cards like [K♠]). Card table, Midnight
      velvet and Ocean deck go.
- [x] The solver wins about two deals in three within its budget (a deal it can't
      settle in time counts as no), so a winnable deal takes about a second to find,
      in chess-worker.js. The daily deal is left as it is, the same for everyone.

### Minesweeper: what players want (Ric, 2026-11-21: "Yep minesweeper", then his answers) — built the same day
- [x] The page is the game's window (concept above): a title bar, the counter /
      face / clock panel, the field, and your best times in a window of their own.
      Each style restyles the window into its own thing (a console, a sheet of
      paper, a field, a drawing).
- [x] Question marks (Ric: "The question marks work but they can't mess with the
      flag buttons"): right-click, press-and-hold and Flag mode still only flag,
      exactly as before. A ? goes on with its own ? mode button, or Shift+right-click
      / middle-click on a computer.
- [x] Custom size (Ric picked it): rows, columns and mines of your own; custom
      games stay off the scoreboard.
- [x] Expert stays fitted to the screen on a phone (Ric: "Keep it fitted").
- [x] Six styles (Ric: "Yes, those six"): Retro desktop (a beveled 90s window in its
      own colours and faces, not a copy of Windows'), Sonar (a submarine sonar
      screen, mines as pings), Graph paper (pencil, flags inked in red), Meadow
      (grass tiles, little red flags), Blueprint (white lines on blue drafting
      paper), Terminal (ASCII). Desktop 95, Ice field and the old Terminal go.
- Not wanted this round: no-guess boards. Chording was already in (click a
  number whose flags are all placed).

### Sudoku: what players want (Ric, 2026-11-21: "So duly" [Sudoku], then his answers) — built the same day
Fixes, 2026-11-22 (Ric: "The soduku boxes are messed up. There also needs to be a
setting for turning off the highlights. Actually that should be normal. Also a bug
where you go to the terminal one and play then switch and the look of it is all
wrong. And in the terminal it should show all your notes … not just the box you
click in."):
- [x] Notes fill their square as a 3 × 3 grid (they had shrunk into a thin column),
      and the digits use lining numerals so 1, 2 and 9 sit level with the rest.
- [x] Highlights (row, column, box and same number) are off by default; the
      Highlights switch among the helpers turns them on (`classics:opt:sudoku`).
- [x] Changing style redraws the grid, so Terminal's ASCII grid no longer stays
      behind under another style.
- [x] Terminal shows every square's notes on the grid: once any square has notes,
      each square is 3 × 3 characters with its notes in pencil positions.
- [x] Glass: every pane the same size (Ric, 2026-11-22: "look at the glass boxes they
      aren't all the same size. And they are kinda squared placement"). The gaps between
      3 × 3 boxes were margins cut out of the edge squares; now they are grid tracks of
      their own, so the panes are equal and the boxes read as groups.
- [x] The page is a puzzle-book page (concept above): the puzzle's number, level
      and date as a header, the grid centred, the number pad as a tray beside it,
      notes and checks as pencil tools.
- [x] Expert level (Ric picked it): fewer clues, and a puzzle that can't be done by
      filling in singles alone (checked by a solver that knows only singles).
      Board `sudoku-expert` on the Worker.
- [x] Both ways to enter numbers (Ric: "Both ways"): tap a square then a number, as
      before, or pick a number first and tap every square it goes in.
- [x] Six styles (Ric: "Yes, those six"): Puzzle book, Newspaper, Washi (Japanese
      paper, brush-style numerals), Chalkboard, Glass (calm, modern, dark),
      Terminal (ASCII).
- [ ] **Deploy Worker** again: the live scoreboard needs `sudoku-expert` (added in
      worker/arcade.mjs with this round).

### Wordle: what players want (Ric, 2026-11-21: "World next" [Wordle], then his answers) — built the same day
- [x] The page is one narrow column (concept above): the tiles, then the keyboard,
      docked to the bottom on a phone; stats and the scoreboard in their own sheet.
- [x] Colour-blind mode (Ric picked it): high-contrast colours plus a mark on each
      tile (● right spot, ○ elsewhere), so nothing depends on telling two colours
      apart; the share squares follow it.
- [x] Past daily words (Ric picked it): play any earlier day's word, picked by
      date; it shares that day's record with the daily, and stays off the board.
- [x] Letter hint in practice (Ric picked it): reveals one right letter in its
      place; a hinted game stays off the practice board.
- [x] Six styles (Ric: "Yes, those six"), each with its own colours instead of
      green and yellow: Flip board (split-flap departures board), Letterpress
      (wooden type, inked), Typewriter (struck letters, round keys), Neon (tubes
      on brick), Crossword (a newspaper grid in pen), Terminal (ASCII).

### Tetris: what players want (Ric, 2026-11-21: "Yep. Tetris", then his answers) — built the same day
- [x] The page is an arcade cabinet (concept above): a marquee, the well in the
      middle, hold on the left panel and the next pieces on the right, the high
      scores on the cabinet like an attract screen, the controls as a deck below.
- [x] Ghost piece (Ric picked it; it was a faint fill): an outline where the
      piece will land, drawn in each style's way, with a switch to turn it off.
- [x] Sprint (40 lines, fastest time) and Timed (2 minutes, most points) beside
      Marathon (Ric picked them), each with its own board: `tetris-sprint`,
      `tetris-timed` on the Worker (needs Deploy Worker).
- [x] Control settings (Ric picked them): how long a held key waits before it
      repeats and how fast it repeats, and every key remappable; kept in this
      browser.
- [x] Six styles (Ric: "Yes, those six"), original looks, not copies of any
      official version: Arcade cabinet, Toy blocks (wooden blocks on a rug),
      Glass, Vector (green-line 70s screen), Paper cut, Terminal ([] blocks).

### Tic-tac-toe: what players want (Ric, 2026-11-21: "Yep do tic tac toe", then his answers) — built the same day
- [x] The page is a page of paper (concept above): the grid drawn on it by hand,
      each X and O drawn stroke by stroke, the tally kept in the margin in
      five-bar gates.
- [x] Ultimate tic-tac-toe (Ric picked it): nine small boards in a big one; the
      square you play in sends your opponent to that board; win three boards in
      a row. Its own computer at three levels.
- [x] Online with a friend (Ric picked it): the same rooms as Chess and Checkers,
      for classic and Ultimate (`tictactoe` and `ultimate` rooms on the Worker).
- [x] Matches and who starts (Ric picked it): single games, best of 3 or best of
      5 (first to 2 or 3 wins; draws replayed), and the first move swaps each
      game, so the computer starts every other one.
- [x] Six styles (Ric: "Yes, those six"): Notebook (blue-lined paper, pencil),
      Diner napkin (ballpoint, a coffee ring), Steamed window (finger-drawn on
      fog, drops running), Beach (a stick in wet sand, shells for O), Whiteboard
      (two marker colours), Terminal (ASCII).
- [ ] **Deploy Worker** again for `tictactoe` and `ultimate` rooms (and the Sudoku,
      Tetris boards before it). With this, every game in round three has its page.

### Online play, Chess and Checkers (Ric, 2026-11-21: "multiplayer for chess and checkers needs to be in")
Two players on one device was already there, so this is playing a friend on their
own device: start a game, send the invite link (or its code), moves appear on both
screens. Moves go through the site's Worker. No accounts and no open lobby.
Then, Ric: "oh and both for the online thing" → online with a friend *and* a better
same-device game: a "Across the table" mode where the board turns to face whoever
is to move (or stays put with the far side's pieces upside down for sitting
opposite).
- [x] Same device: board faces the player to move, or sit-opposite mode.
- [x] Worker: game rooms (create, join, post a move, read moves). The Worker keeps
      the list; each page checks the moves with engine.js (worker/README.md).
- [ ] **Deploy Worker** (Actions) so the live site has `/arcade/rooms`; until then
      the online option says it can't reach the game.
- [x] Chess online.
- [x] Checkers online, with resign and draw offers (also across the table).
- [ ] Online games have no clock; a clock for them would need the Worker to keep time.

## Mobile (Ric, 2026-11-21: "All of the styles now need to be looked at on a phone style and made for mobile do some research on what is best for mobile use.")

What the research says, and what the pages now do:
- **Touch targets at least 44 × 44 px.** Apple asks for 44 pt, Material for 48 dp,
  WCAG 2.5.5 (AAA) for 44 px (2.5.8 AA: 24 px). Every header control, in-game
  button (Undo, Hint, Notes, Flag mode, move-list arrows), Snake's d-pad and keys
  and the Play button are now at least 44 px on a phone.
- **The game on the first screen, controls under the thumb.** Hoober's study: about
  half of people hold the phone in one hand, thumb working from the bottom. The
  header is now one row on a phone (back, name, New game, Options) and everything
  else folds into an Options panel, which closes again when you pick a style or
  mode; games start 40-60 px higher. Solitaire's Undo/Hint move to the table's near
  edge; Sudoku's pad, Wordle's keyboard, Tetris and Snake's controls already sit
  under the board.
- **No zoom when tapping a menu.** iPhones zoom the page into any field or menu with
  text under 16 px; on phones every menu and field is 16 px.
- **No double-tap zoom on buttons** (`touch-action: manipulation`), and hover-only
  effects (the faint X/O in tic-tac-toe) only on devices that can hover.
- **Nothing wider than the screen.** All 54 game/style pairs measured at 375 × 812
  and the bigger games at 360 × 640: no sideways scrolling (fixed a hidden label
  widening Checkers, and a rounding pixel on Snake's Terminal).
- Small text raised where it carried meaning (Tetris side labels 8 → 9.5 px);
  decorative numbers (checker square numbers) left small.
- Terminal boards on a touch screen get taller lines, so each square is a bigger
  target. Expert Minesweeper stays fitted (Ric's call) at about 20 px a square.

- **Save button** (Ric, 2026-11-21: "There needs to be a save button as well"):
  every game has Save beside New game. Games already saved after every move; Save
  saves right now, pauses Snake/Tetris first, and says "Saved ✓". Online games say
  they live in their room; a finished game says there's nothing to save. On a phone
  the header is New game, Save and ⋯ (Options).

Sources: Apple HIG / Material / WCAG target sizes (Smashing Magazine 2024 summary);
Steven Hoober's one-handed-use research (Smashing Magazine "The Thumb Zone");
mobile viewport units and safe areas (Polypane, OpenReplay guides).

## Ideas not built yet

- [ ] Checkers variants (Russian/Brazilian flying kings, international 10 × 10).
