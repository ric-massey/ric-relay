# The Classics

Added 2026-11-13 for Ric: “simple ones, solitare, tictactoe, chess, wordle,
soduku, minesweeper, tetris, checkers, snake” and “the ones that can have a
high score should ask for initials and have a scoreboard.” Nine games in one
collection, linked from Gaming, the front door and the terminal.

Open `index.html` directly, or serve the repo. There is no build or runtime
dependency. Each game has a shareable fragment (`index.html#chess`, for example).
The collection has its own green-felt table style; it does not change other rooms.

| Game | Rules / modes | Scoreboard |
|---|---|---|
| Solitaire | Klondike, draw one, unlimited recycling, tap to select and move stacks, undo | Fastest completed games, seconds |
| Tic-tac-toe | Unbeatable minimax computer or two people sharing the screen | None; win/draw |
| Chess | Casual two-ply computer or two people; legal moves, castling, en passant, four promotions; checkmate, stalemate, threefold repetition, 50-move and insufficient-material draws; undo whole computer turns | None; win/draw |
| Wordle | Independent Wordle-style game; six guesses; shared UTC daily word or unlimited practice; repeated-letter accounting | Fewest guesses, separate daily and practice boards |
| Sudoku | Easy/medium/hard; generated with exactly one solution; notes, conflict highlighting, keyboard numbers/arrows, erase, optional reveal | Fastest wins per difficulty; a reveal makes that game ineligible |
| Minesweeper | 9×9/10, 12×12/25, 16×16/40; first square and neighbors safe; flood reveal, flags and chord opening | Fastest wins per field |
| Tetris | Seven-piece bag, clockwise/counterclockwise rotation with horizontal wall kicks, ghost piece, next preview, soft/hard drop, level every ten lines | Highest points |
| Checkers | American 8×8; forward men, short kings, mandatory captures and continued jumps; crowning ends the turn; casual computer or two people; repetition/80 quiet plies draw | None; win/draw |
| Snake | 20×20, solid walls, food avoids the snake, one queued turn per step, rising speed | Highest points; ten per apple |

All games work with touch/clicks. Snake also accepts swipes, arrows and WASD.
Tetris uses arrows, X/Z and Space. P and the visible Pause button pause action
games; hiding the tab pauses automatically. Timed puzzles use wall time from the
first action, including time spent in another tab. New Game abandons the current
run; unfinished games are not saved. The daily word is the exception: guesses
and whether its initials were submitted are saved in `localStorage` by UTC date.
New Game cannot reset that result; Practice is always available.

## Scores

Wins in timed puzzles and Wordle, and positive completed Snake/Tetris runs, ask
for 1–3 letter initials. The board displays the top ten, highest points first or
lowest time/guess count first; ties keep the earliest submission first.

Shared storage is the existing Worker's `GET`/`POST /arcade/scores`. Local preview
uses only its own origin, never the live scoreboards. Production uses the existing
`training-log` Worker. `file://`, outages and unavailable storage fall back to a
board labeled **This browser only**, using `classics:scores:<board>` in localStorage.
A local save is not silently sent later. If browser storage is disabled, a failed
save is reported and may be retried. Remembered initials use `classics:initials`.

The boards are a friendly honor system: scores are reported by the browser,
validated for type/range on the server, **not replay-verified**. Never describe
them as cheat-proof. Nothing requires a login. Board keys and rules are fixed;
the server bounds storage to 100 scores per board and removes daily records over
a year old. Read `worker/README.md`, “Classics scoreboards”, before editing the API.
The Worker must be deployed as well as pushing the static site for shared boards
to work; no new Cloudflare database or secret is required.

## Files and checks

- `engine.js`: dependency-free UMD rules, used by both the browser and Node tests.
- `app.js`, `style.css`, `index.html`: collection, controls, drawing, timers and scores.
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
node --test projects/classics/test/engine.test.cjs worker/arcade.test.mjs
node .github/checks.mjs
```

`assets/games/classics.jpg` is real Solitaire gameplay captured after drawing a
card and moving an Ace to its foundation; `assets/frontdoor/thumbs/classics.jpg`
is its small phone thumbnail. The front door's `ART.classics` uses this project's
actual Klondike deal/draw engine on desktop rather than a fabricated board.

## Word list credit

Accepted guesses are the 15,921 five-letter ASCII words from
[dwyl/english-words](https://github.com/dwyl/english-words), pinned to revision
`20f5cc9b3f0ccc8ce45d814c532b7c2031bba31c`, under the Unlicense, preserved in
`WORDS-LICENSE.txt`. The 869 answers are an independently selected subset of
familiar words in `build-words.py`, **not the official Wordle answer list**.
Keep their order stable: the date hash selects an index, so reordering or changing
the array length changes daily puzzles. The game never downloads a dictionary or
uses an external game service. Rebuild with `python projects/classics/build-words.py`.
