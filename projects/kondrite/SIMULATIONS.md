# SIMULATORS — Survey is the game, and the rest is a machine you play

> *"i would like for Survey to be the game. and all the extra game modes should
> be simulations. ecentially for practice."*

> *"there is a menue and right now nothing is payed so it doesnt matter. i
> guess. solo and multiplayer can be seperated. but there should only be one
> game."*

> *"no sim as in simulator. … you go to a planet or a station and an option is
> simulators. and you click it and the other games pop up. maybe even a comp and
> has a leaderboard."*

> *"i want to make it so you have to sign in before multiplayer or singleplayer.
> and then multiplayer will have real leaderboards where solo has leaderboards
> that are made up and they would be different for every station and planet you
> go to."*
>
> — Ric, 19 September 2026

**What it is.** A **simulator** — the machine, the cabinet in the corner of the
station. You dock, there is an option called SIMULATORS, you click it, and the
other games are in it. Not a training programme, not a flight school. An arcade
machine in a world that has arcade machines.

**Settled:**

- **There is one game.** Survey. The menu may list as many machines as it likes
  and must never again read as a row of games with Survey among them.
- **The menu stays.** The game does not boot straight into the sector.
- **A simulator pays nothing.** Nothing crosses back into the sector. The
  leaderboard is the whole reward.
- **Solo and multiplayer stay separated**, one page down, inside SIMULATORS.
- **Every machine runs the same ship.** *(This answers a question in the first
  draft of this plan, which asked whether a simulator should fly your own hull
  and fitted parts. A leaderboard answers it: a competition where everybody flies
  a different ship is not a competition. The arcade ship, always.)*
- **You sign in first.** Before single player and before multiplayer. The guest
  door closes. This reverses README.md's *"An account, which is optional"*, and
  that section gets rewritten rather than left to contradict this one.
- **Two kinds of board, and the difference is not cosmetic.** Multiplayer boards
  are **real** — the same board for everybody. Solo boards are **made up**, and a
  different set of names at every station and every planet you walk into.

**The game is being renamed KONDRITE** — see `RENAME-KONDRITE.md`, which is a
separate job with its own landmines. This file keeps saying KONDRITE because
that is what it is called today.

**Step 1 is built, 19 September 2026.** The door: the title is the game plus a
SIMULATORS line, the lanes are one floor down, and `survey` is in neither of
them. After it, there is one game. Steps 2–5 are not built. See *Step 1, as
built* at the foot of this file.

`SURVEY-PLAN.md` stays the authority for Survey; when the rest of this is built,
one section goes there and this file becomes the record of how it was decided.

---

## The door

### The title

```
                       KONDRITE
              a survey of endless space

            [ CONTINUE THE SECTOR ]   31 LOGGED
              or   BEGIN A NEW SURVEY

     SIMULATORS   ·   alone or with other people
     SETTINGS
```

One game, and a machine. `surveyBlurb()` (index.html:20949) already computes
*"31 LOGGED · CONTINUE THE SECTOR"*; it is a card subtitle today and it becomes
the front page's whole proposition.

The front page is still a menu — but no longer a menu *of games*.

### The lane page moves down a floor

`LANES` (index.html:24132) asks *solo or multiplayer* and shows the modes for
that answer. It survives almost intact. What changes is where it sits and what is
in it:

- Reached from **SIMULATORS**, not from the title.
- **`survey` comes out of the solo lane.** That one removal is most of the work,
  because a lane that lists the game beside three machines is the row of peers
  this whole change exists to end.
- `online` stays exactly where it is, fourth in the multiplayer lane.

This is where the split belongs. *Solo or multiplayer* was never a question about
Survey — one pilot, one chart, settled — so asking it before the game was asking
it about nothing. Asked about a machine, it is a real question.

The page count does not change. What changes is what the first page is *for*:
today it asks which of four games, afterwards it says here is the game, and here
is a machine you can play.

### Where the machines are

- **The title**, under the game's button.
- **A station or a planet.** A `sims` entry on `PLACE_TABS` (survey-hud.js:616),
  beside SHOP, SHIPS, INVENTORY and WORMHOLE. Both doors already exist and both
  are already live on that strip: `st.docked` for a station, `st.landed` for a
  surface (survey-hud.js:717). Everywhere you can trade, you can play.
- Every one of them has machines — a cabinet you can only find at some stations
  is a cabinet nobody finds — but **each wears its owner**, so a Coalition
  machine and a Warrens machine are visibly different cabinets running the same
  three games. That is where the leaderboards diverge (below).

### It should look like a machine

The one thing that stops this being a relabel. The modes today are cards on a
menu; in a station they are **cabinets in a room**, and the difference is
entirely in the drawing:

- a frame round each game, with the cabinet's own colours and a name on it
- a boot line when you pick one, and a coin-slot beat before the match starts
- the high score printed on the cabinet, before you press anything
- `menu.js` already draws all five dioramas as closed-form functions of `t`
  (menu.js:20–30) — on a cabinet, that diorama is the **attract loop**, which is
  what it has always actually been

No new art. The dioramas move inside a frame, and the frame does the work.

---

## You sign in first

The account door already exists and is already argued for. README.md's *"The
door"* says Survey opens on the account question *"because it only has a good
answer beforehand"* — asked after two hours, either answer is bad news. What
changes is that **"play as a guest" comes off it**, and the door moves from
Survey's entrance to the game's.

Three ways through it become two: **sign in** and **create account**.

### What this overturns, said out loud

README.md has a section called *"An account, which is optional"*, and its whole
argument is that the run reads and writes local storage at full speed and the
account is told afterwards — *"a mirror and never the source"*. **The mirror part
stays true.** What stops being true is the word *optional*. That section gets
rewritten, not left standing next to this one.

### And the thing a required sign-in would break

Today this is static files that work with no network at all: `net.js` makes no
request until somebody opens the multiplayer panel, and index.html has a comment
about somebody playing *"on a plane with no signal"*. A sign-in wall in front of
single player turns that plane into a brick, and it puts an email box in front of
the two-minute test before a new player has seen a ship.

**The answer is that you sign in once, not every time.** `cloud.js` already
holds a session and already refreshes it (`setSession`, `fresh`). So:

- The requirement is **having an account and having signed in on this device** —
  not being online right now.
- A cached session plays offline indefinitely. The game never waits for a network
  to draw a frame, which is already the rule.
- Scores made offline **queue** and go up on the next connection, the same way
  the book already coalesces its writes.
- **A blank `config.js` switches the requirement off.** That file's own promise is
  that blank means no accounts and *"everything still works"*. A fork of this
  repo with no Supabase project must still run, so "no account service" means
  "no sign-in wall", never "no game".

### A pilot name, not an email

Accounts are email and password today, and **an email address must never appear
on a leaderboard**. A name is chosen at sign-up, it is what every board shows,
and it is the only thing about an account that is ever public.

---

## The leaderboards

Two kinds, and the difference between them is not decoration — it is the only
honest line that can be drawn.

### Solo: made up, and different everywhere

A board generated from the machine's own coordinates and its owner's faction — a
dozen names and scores, stable forever, **a different set at every station and
every planet**. It works offline, it is never empty on a first boot, there is
always somebody just above you, and it is the sector's own people on it, so a
Coalition board and a Warrens board read differently.

Your name sits among them in your own colour, which is the one place the sign-in
pays off in single player.

It is the same trick the chunk generator already runs on (`survey-world.js`), and
it costs one seeded function.

### Multiplayer: real, and witnessed

| Game | The number |
|---|---|
| Survival | wave reached |
| Battle Royale | finish, and time survived |
| Campaign | missions cleared, and at which difficulty |

**Signing in gives identity, not authority.** This is a static client with no
game server — `net.js` says so in its first line — so a signed-in player can
still POST any score they like from the console. An account stops a board being
anonymous; it does not stop it being wrong.

What makes a multiplayer score believable is the thing a solo score can never
have: **somebody else was there.** So the rule is —

> **A multiplayer result is written only when more than one account posts the
> same result for the same match.**

The host posts the outcome, each guest posts what it saw, and the row lands only
where they agree. The agreement is checked in Postgres — a view or an RPC —
because a check the client performs is not a check. This defeats casual forgery
outright: faking a score stops being a line in the console and becomes two real
people agreeing to lie about a game they played, which is a social problem and
not one worth engineering against.

And it makes Ric's split *coherent rather than arbitrary*: solo results cannot be
witnessed, so their boards are fiction; multiplayer results are witnessed, so
their board is real. That is the reason the two are different, and it is worth
writing on the screen somewhere.

**The simpler alternative**, if the above is more than it is worth: post the
host's result and trust it. Among five friends on a keyboard that is fine. It
stops being fine the first time the board is worth lying to.

### What the database needs

- **A `scores` table of its own. Never `saves`.** The whole safety property of
  `saves` is that a policy naming `auth.uid()` means nobody reads anyone else's
  book. A leaderboard is the opposite — everybody reads everybody — and the two
  postures cannot share a table.
- Insert your own row only; read the board freely; **no update and no delete**, so
  a score cannot be walked back.
- A `matches` row, or a match id on each score, so the agreement rule above has
  something to agree about.
- A `name` on the profile, and the email never leaves the auth schema.
- Boards are **cached per session** and scores **coalesced**, the way the book's
  writes already are — a read on every cabinet you walk past would spend the free
  tier on a number that did not change.

`supabase/schema.sql` is one table today and becomes three. Every policy names
`auth.uid()` for writes, exactly as the existing file insists.

### The competition

*"maybe even a comp"* — the smallest honest version, built after the boards work:
a machine runs **one game as its challenge** at a time, changing on a clock the
whole sector shares. Everyone at that cabinet today is playing the same
challenge. It costs a function of the date, and it gives a board a reason to be
checked rather than remembered.

---

## The boundary, technically

This is the part that makes it buildable, and it is the same whichever door you
came in by.

**The problem.** `startGame()` (index.html:2779) resets every global — `ships`,
`rocks`, `hazards`, `bounds`, `mode`, `cam`, `lives`, `clock`. A machine played
from inside a Survey run destroys that run in memory.

**The answer is not to preserve it.** Survey already writes everything to the
book and already resumes at the position you left (index.html:10771–10796). Use
the path that exists and is tested.

1. **Going in.** `saveSurveyBook()` **first**, then set
   `returnTo = { survey: true, at: <station or planet> }`, then the ordinary
   `startGame(key, humans, bots)`.
2. **Coming out.** Every path that leaves a match with `state = "title"` checks
   `returnTo` instead. They are: `leaveMatch` (27142), the result screen, the
   terminated card, and the online disconnect (25971). **A missed one drops the
   player on the title with the sector still saved** — recoverable, but it reads
   like a crash, so the list is exhaustive or it is not done.
3. **Landing.** Re-enter Survey through the existing resume path, then **put the
   player back where they were standing** — docked or landed, on the SIMULATORS
   page, in front of the machine they just played, with the new score on it. The
   book records `at: {x, y, a}` but not *docked*; re-docking on the return path
   is cheaper than a new save field and does not touch the save format.
4. **What is lost crossing.** In-flight traffic, current rock positions, the
   notification stack, any battle in progress. That is **correct rather than a
   bug** — a game takes time and the sector moves on — but it has to be *said*,
   or a player who left a fight and came back to an empty sky thinks something
   broke.
5. **From the title**, `returnTo` stays null and quitting goes to the title
   exactly as today.
6. **The pause screen.** Its Survey row is already gated on `mode.survey`
   (index.html:25126), so it correctly vanishes inside a machine. What changes is
   the quit line: *QUIT TO MENU* becomes *LEAVE THE MACHINE* when `returnTo` is
   set, because it does not go to a menu.

### The one thing that must not regress

**Walking up to a machine must not be able to lose a survey.** The order is
save-first, and if the save fails — private browsing, storage full, both already
handled in `surveySaveNow` (27089) — **the machine refuses to start and says
why**. There is no version of this where a game of asteroids costs somebody their
hours.

---

## What moves, by file

| File | What changes |
|---|---|
| `index.html` | `drawTitle` (24100–24500) becomes the game and a door · `LANES` (24132) loses `survey` from the solo lane and is reached from SIMULATORS · `MODES` (1095) gains `sim: true` · `leaveMatch` (27142) and every `state = "title"` out of a match learn `returnTo` · the result screen posts a score |
| `survey-hud.js` | a `sims` entry on `PLACE_TABS` (616), the cabinet room, and the board on each machine |
| `survey-save.js` | the book gains a `sims` block — your best per game per machine, and scores waiting to go up |
| `supabase/schema.sql` | one table becomes three: `scores`, `matches`, and a profile carrying the pilot name. Writes name `auth.uid()`; boards read freely; no update, no delete |
| `index.html` (the door) | `btnAcctGuest` (956) comes off the panel, and `kondrite.account.guest` (27060) stops being written |
| `survey-world.js` | the made-up boards: a function of the machine's coordinates and its owner, alongside everything else generated from a chunk |
| `menu.js` | all five dioramas survive · `survey`'s moves to the title as the game's own picture · the others become attract loops inside a cabinet frame |
| `cloud.js` | the guest path comes out · a pilot name at sign-up · posting a score, and queueing one made offline |
| `README.md` | "Modes" becomes "The game, and the simulators"; the table stops being a table of peers |
| `SURVEY-PLAN.md` | one section recording the decision — **written after the other agent lands** |
| `test/menu.js` | check 1 still asserts two lanes — they moved, they did not go. Check 2 asserts `survey` is in the solo lane and must now assert the opposite. Checks 3 and 4 survive untouched |
| `test/smoke.js`, `test/ui.js` | any assertion that enumerates modes |

---

## Build order

Four steps, each flyable on its own.

**1 · The door.** The title becomes the game plus a SIMULATORS line; the lane
page drops `survey` and is reached through it. Nothing about the games
themselves changes. **This ships on its own**, because it is the thing that was
asked for: after it, there is one game.

**2 · The machine.** The `sims` tab at a station and on a planet, the cabinet
room, and the boundary above — save-first, `returnTo`, come back standing where
you were. After this, playing a machine is something you do *inside* a run.

**3 · The door.** The guest button comes off, a pilot name is asked for at
sign-up, and the cached session plays offline. Before any board exists, because
every board needs a name to put on it.

**4 · The made-up boards.** Generated per station and per planet, your name among
them. Offline, seeded, no network. This is the step that makes a machine worth a
second visit, and it is the whole of single player's reward.

**5 · The real board.** Multiplayer scores, with the agreement rule, and the
three tables. Then the competition — one challenge per cabinet, on a shared
clock.

**Not now:** a simulator you can fit to your own ship. It is a real idea for later
and it is a *part*, the way everything else in Survey is a part.

---

## How it is checked

- **Cold start.** From an empty `localStorage`, the first screen offers one loud
  thing, it starts Survey, and SIMULATORS is visibly quieter.
- **`test/menu.js`.** Two lanes, reached one floor down; `survey` in neither.
- **A new check, and it is the important one.** Play a machine from a station,
  quit it, and assert the survey resumes with the same seed, the same cash, the
  same hold, the same manifest — and standing in the same station. That is the
  regression that would cost somebody hours, so it gets its own test rather than
  a line in an existing one.
- **The made-up boards are pure.** Same cabinet, same names and scores, every
  time; two cabinets, two different boards — checked the way `test/survey.js`
  already checks that a chunk built twice is identical.
- **Offline still plays.** With a cached session and every network call failing,
  the game boots, Survey runs, a machine plays, and the score queues. This is the
  test that stops a required sign-in becoming a required connection.
- **No email reaches a board.** Asserted, not eyeballed.
- **`test/fingerprint.js` must not move.** Nothing here touches generation, and a
  moved hash means something changed that should not have.

---

## Three risks

- **`index.html` is 1.3 MB and one file, and another agent is in it.** The
  regions above are away from the bots and chart work, but this gets built in one
  pass after that lands, never interleaved.
- **Burying multiplayer.** It is one page further in than it was. Somebody who
  opened the game to play with a friend must still see how from the title — which
  is why the line says *"alone or with other people"* rather than *"practice"*.
- **A cabinet that is just a menu.** If it draws as four more cards, nothing has
  happened. The frame, the attract loop and the high score printed on the machine
  before you press anything are not decoration; they are the change.
- **The sign-in wall meeting the two-minute test.** A new player now hits an
  email box before they have seen a ship. The door is at least *argued for*
  already — README.md says the account question only has a good answer
  beforehand — but this is the one change in the plan that can make a first
  impression worse, and it should be watched on a real person.

---

## Step 1, as built

Three things the plan left open, settled in code.

**No "begin a new survey" on the front page.** The mock has one, under CONTINUE
THE SECTOR. Ric's call: it goes to SETTINGS instead, where the reset already
lives. A sector is hours, there is no undo, and the button that destroys one has
no business sitting under the button that resumes it — so the front page has
exactly one thing it can do to a sector, and the one that ends it is three rows
into a settings page and asks twice. The title button reads CONTINUE THE SECTOR
when a book exists and BEGIN THE SURVEY when one does not.

**`started` is the book having a seed, not the blurb having a separator in it.**
`surveyBlurb()` only counts once the almanac has an entry, so ten minutes of
flying with nothing logged would have read BEGIN THE SURVEY over a button that
resumes. The front page asks the book directly: seed, then entry count.

**The book is read once, not sixty times a second.** The title is a render loop
and the book is up to half a megabyte of JSON with a fog bitfield in it, so the
answer is cached in `titleCard` and thrown away in exactly the two places it can
change — `leaveMatch`, and the wipe. That is the whole of the new state.

### What moved

| Where | What happened |
|---|---|
| `index.html` | `drawTitle` is the game and a door · `drawSims` is the old title's two lane cards, one floor down, as state `"sims"` · `titlePick` splits into `titlePick` (the game / the machines) and `simPick` (which lane) · `playSurvey` and `titleSurvey` are new |
| `index.html` | `LANES.solo` drops `survey` — the one removal that is most of the change · cards back out to `"sims"`, the level select backs out to `"modes"`, and the drifting field knows the new page |
| `test/menu.js` | check 2 asserted `survey` was in the solo lane; it asserts the opposite now, and walks title → sims → modes and back out a floor at a time |
| `test/ui.js`, `test/smoke.js` | the new page joins the sweep, and the idling-field gate moved with it |
| `README.md` | "Modes" is "The game, and the simulators", and the table stops being a table of peers |

**Not done, and next:** step 2 — the `sims` tab at a station and on a planet, the
cabinet room, and the boundary (save first, `returnTo`, come back standing where
you were). Until that lands, the machines are only reachable from the title.
