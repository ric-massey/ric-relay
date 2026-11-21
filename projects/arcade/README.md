# Arcade browser games

Nine separate pages, each directly linked from `gaming.html`, the front door and
the terminal. No collection name or intermediate launcher. The runtime stays here
so fixes to shared rules and score submission apply to every game without copies.

Originally added 2026-11-13 for Ric’s request for Solitaire, Tic-tac-toe, Chess,
Wordle, Sudoku, Minesweeper, Tetris, Checkers and Snake with initials/scoreboards.
His follow-up the same day settled individual pages and distinct styles.

Open `projects/<game>/index.html` directly or serve the repo. No build or runtime
dependency; shared code stays entirely inside these Gaming projects.

| Game | Rules / modes | Scoreboard |
|---|---|---|
| Solitaire | Klondike, draw one or draw three, unlimited recycling; drag and drop or tap-tap, tap twice to send a card where it fits; hint, undo, "no moves left", finishes itself once every card is face up; no clock on screen unless Show timer | Draw one only: fastest completed games, seconds |
| Tic-tac-toe | Computer at Easy/Medium/Hard (Hard is unbeatable minimax) or two people; undo; running tally; strike-through on the winning line | None; win/draw |
| Chess | Drawn SVG pieces; computer at Easy/Medium/Hard (1/2/3 plies, alpha-beta) as White or Black (board flips), or two people; legal moves, castling, en passant, four promotions; checkmate, stalemate, threefold repetition, 50-move and insufficient-material draws; last move and check shown; move list and captures; hint; undo whole computer turns | None; win/draw |
| Wordle | Independent Wordle-style game; six guesses; shared UTC daily word or unlimited practice; repeated-letter accounting; hard mode; tiles flip, a rejected word shakes; share (squares only); countdown to the next daily word; guess chart | Fewest guesses, separate daily and practice boards |
| Sudoku | Easy/medium/hard; generated with exactly one solution; notes (cleared from peers when a number is placed), fill-all-notes, same-number highlight, numbers-left on the pad, conflict highlighting, keyboard numbers/arrows/N, erase, undo; no clock on screen unless Show timer | Fastest wins per difficulty; Reveal or Show mistakes makes that game ineligible |
| Minesweeper | 9×9/10, 12×12/25, 16×16/40; first square and neighbors safe; flood reveal, flags (right-click, press and hold, Flag mode) and chord opening; face button; after a mine, take the click back or replay the same board (both ineligible); always shows its clock | Fastest wins per field |
| Tetris | Seven-piece bag, clockwise/counterclockwise rotation with horizontal wall kicks, ghost piece, hold, three-piece preview, half-second lock delay (15 resets), line-clear flash, soft/hard drop, level every ten lines; phone: drag, tap, flick | Highest points |
| Checkers | American 8×8; forward men, short kings, mandatory captures and continued jumps; crowning ends the turn; computer at Easy/Medium/Hard (2/5/8 plies, alpha-beta) or two people; last move and jump path shown; pieces taken; repetition/80 quiet plies draw | None; win/draw |
| Snake | 20×20; Classic, Slow, or Through walls (wraps); food avoids the snake; two queued turns per step; rising speed; swipe anywhere, mid-swipe | Classic only: highest points; ten per apple |

All games work with touch/clicks. Snake also accepts swipes anywhere on the board
(turning while the finger is still moving), arrows and WASD. Tetris uses arrows,
X/Z, Space and C/Shift. P and the visible Pause button pause action games; hiding
the tab pauses automatically.

**Saving** (2026-11-21, Ric asked for "saving your game"). Every game in progress
is saved in this browser under `classics:save:<game>` after each move, and
Snake/Tetris when paused, hidden or closed. Opening the page again puts you back
where you were (Snake/Tetris behind a Resume button). New game, a mode change or
finishing clears the save. The clock of a resumed timed game picks up on the next
move, so time away isn't counted. The daily word keeps its own record as before
(`classics:daily:<date>`: guesses, whether initials were submitted, hard mode);
New Game cannot reset that result; Practice is always available.

**Clocks** (Ric, 2026-11-21: "minesweeper needs the timer btw it always has one
but solitare and sudoku dont need one"). Minesweeper always shows its clock.
Solitaire and Sudoku keep time quietly so a win can still go on the fastest board
(the win card says the time); their Show timer button puts the clock on screen.

**Your games.** A stats panel beside the scoreboard: played, won, streaks and best
for each game and mode, or the vs-computer and two-player tallies, kept in this
browser under `classics:stats:<game>:<mode>`. Per-game choices (computer level,
Show timer, Show mistakes, hard mode) are `classics:opt:<game>`; the last mode
picked is `classics:mode:<game>`.

**Movement** respects `prefers-reduced-motion`: pieces slide, cards land, tiles
flip, rows shake, a winning line draws, and a win throws confetti. The result card
waits half a second (Wordle: until the flip ends) so the last move is seen.

The improvement list this pass came from, with what is left, is `TODO.md`.

## Where they sit

Ric, 2026-11-14: "I want those games but I want it in arcade. Next to the games that
I have made." On `gaming.html` the nine come **after** Ric's own games — KONDRITE's
hero, then the three betas — as a shelf in that page's own design (its eyebrow, rule,
lead and numbered cards, 04–12), not a separate catalogue above everything.
`test/pages.test.cjs` holds the order.

From the terminal, typing a game's name opens it — `chess`, `tic tac toe`,
`mine sweeper`, `noughts and crosses`, `worlde`. `arcade`, `games` and `classics`
open the Arcade. The names are the `PROJECTS` rows at the top of `terminal.html`.

On a phone the site's "← Ric's Terminal" control is moved from the bottom-left corner
to the end of each game page (`style.css`), because that corner is where the controls
are. There is no typed easter egg on these pages on purpose: Wordle is typing, and the
action games are driven by letters.

## Scores

Wins in timed puzzles and Wordle, and positive completed Snake/Tetris runs, ask
for 1–3 letter initials. The board displays the top ten, highest points first or
lowest time/guess count first; ties keep the earliest submission first.

Shared storage is the existing Worker's `GET`/`POST /arcade/scores`. Local preview
uses only its own origin, never the live scoreboards. Production uses the existing
`training-log` Worker. `file://`, outages and unavailable storage fall back to a
board labeled **This browser only**, using `classics:scores:<board>` (the original storage key, retained so scores survive the move) in localStorage.
A local save is not silently sent later. If browser storage is disabled, a failed
save is reported and may be retried. Remembered initials use `classics:initials`.

The boards are a friendly honor system: scores are reported by the browser,
validated for type/range on the server, **not replay-verified**. Never describe
them as cheat-proof. Nothing requires a login. Board keys and rules are fixed;
the server bounds storage to 100 scores per board and removes daily records over
a year old. Read `worker/README.md`, “Arcade scoreboards”, before editing the API.
The existing scoreboard service is already deployed. The page split retains its
route and board keys and needs no Worker redeploy, new database, secret or migration.

## Files and checks

- `engine.js`: dependency-free UMD rules, used by both the browser and Node tests.
- `app.js`, `style.css`: shared controls, layout primitives, drawing, timers and scores.
- `../<game>/index.html`: each game’s complete page shell and its own inline theme CSS.
- `preview.js`: small front-door views using the actual rule engines; no game page or dictionary is loaded there.
- `index.html`: redirect to the Arcade, not a second launcher.
- `../classics/index.html`: compatibility door for old collection and fragment links.
- `words.js`: committed offline dictionary; **generated**, not hand-edited.
- `build-words.py`: run manually with Python's standard library and network access.
- `test/engine.test.cjs`: real rule boundaries and chess perft counts, every legal
  human line against Tic-tac-toe, thirty unique Sudoku puzzles, card conservation,
  mine counts, snake collisions and Tetris bags/line scoring.
- `worker/arcade.test.mjs`: actual SQLite ranking, retries, isolation, validation,
  throttling and route/missing-storage behavior. Both suites are in the quick checks;
  the Worker deployment workflow also runs its scoreboard test.

```sh
node worker/dev.mjs 8914
node --test projects/arcade/test/engine.test.cjs projects/arcade/test/pages.test.cjs worker/arcade.test.mjs
node .github/checks.mjs
```

Every game has `assets/games/<game>.jpg`, captured from its real page after
trusted clicks/keys, and `assets/frontdoor/thumbs/<game>.jpg`. Capture actual gameplay,
not the Start overlay or a style menu. The front door draws from the real rule engines
through `ArcadePreview.draw`; it does not iframe the pages or load the word dictionary.

## Visual styles

Ric’s follow-up on 2026-11-13: “a bunch of different styles” and “I don’t like it
being the classics put each having its own page on the arcade.” The games each open
directly, with their own identity. The Style selector has three choices on each:

| Game | Styles |
|---|---|
| Solitaire | Card table, Midnight velvet, Ocean deck |
| Tic-tac-toe | Notebook, Blackboard, Pop art |
| Chess | Walnut club, Marble hall, Midnight match |
| Wordle | Daily paper, After dark, Peach edition |
| Sudoku | Sunday print, Sepia journal, Night desk |
| Minesweeper | Desktop 95, Terminal, Ice field |
| Tetris | Neon arcade, Pocket console, Monochrome |
| Checkers | Diner table, Tournament, Lakeside |
| Snake | Pocket LCD, Night drive, Candy pixels |

`data-game` selects the engine; `data-skin` and each page’s own inline CSS select
the appearance. `classics:style:<game>` stores the preference alongside the retained
legacy storage keys. `applyStyle()` changes CSS and canvas colors only. **Do not call
`start()` or `route()` from a style change**: that would throw away a game. The two
canvas games reread their palette and redraw the same state, including while paused.
Only Wordle loads `words.js`. The old `#chess`/`#snake` links redirect by an allowlist;
never turn their hash into an unchecked external redirect.

`test/pages.test.cjs` verifies direct Arcade entries, unique page routes and themes,
local script/style references, preserved storage/API keys and legacy redirects.

## Word list credit

Accepted guesses are the 15,921 five-letter ASCII words from
[dwyl/english-words](https://github.com/dwyl/english-words), pinned to revision
`20f5cc9b3f0ccc8ce45d814c532b7c2031bba31c`, under the Unlicense, preserved in
`WORDS-LICENSE.txt`. The 869 answers are an independently selected subset of
familiar words in `build-words.py`, **not the official Wordle answer list**.
Keep their order stable: the date hash selects an index, so reordering or changing
the array length changes daily puzzles. The game never downloads a dictionary or
uses an external game service. Rebuild with `python projects/arcade/build-words.py`.
