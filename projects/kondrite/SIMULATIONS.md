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

**Steps 1 to 4 are built, 19–20 September 2026.** The door: the title is the
game plus a SIMULATORS line, the lanes are one floor down, and `survey` is in
neither of them. The machine: a SIMULATORS tab at every station and every
inhabited world, a room with three cabinets in it, and the boundary — save
first, play, come back standing at the same dock. The sign-in: the guest door
is closed, everybody has a pilot name, and a cached session plays offline with
no connection at all. The boards: a dozen of the sector's own people on every
machine, generated from the cabinet and its owner, with you at your rank among
them. Step 5 (the real board) is not built. See the *as built* sections at the
foot of this file.

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

**3 · The door.** *Built — see* **Step 3, as built**. The guest button comes off,
a pilot name is asked for, and the cached session plays offline. Before any
board exists, because every board needs a name to put on it.

**4 · The made-up boards.** *Built — see* **Step 4, as built**. Generated per
station and per planet, your name among them. Offline, seeded, no network. This
is the step that makes a machine worth a second visit, and it is the whole of
single player's reward.

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

---

## Step 2, as built

The room, and the crossing. Four things the plan left to the build.

**A cabinet is the solo lane's version, and it does not ask.** You are alone in
the middle of your own run; *how many of you are there* is a question the front
page's SIMULATORS door asks, not a box in the corner of a station. So the room
has three machines — SURVIVAL, BATTLE ROYALE, CAMPAIGN — and one press each.
Battle Royale brings its three bots the way the solo lane already does, and the
campaign's cabinet boots into its mission list, because three missions in order
is what that machine is.

**The coin is a real beat.** `startSim` saves, takes the coin and sets
`simBoot`; the cabinet draws COIN ACCEPTED and a bar for 0.9s, and the match
starts on the other side of it. The room is a parked page and nothing on it
moves, so this is the one thing a parked page counts down — stepped from the
draw that shows it, which is why `simBootTick` is called there and nowhere else.

**The score is kept per cabinet, in the book.** `sims` is `{ "<rounded x,y>":
{ survival: n, royale: n, campaign: n } }` — additive, validated key by key in
`survey-save.js`, and the only thing a simulator ever leaves behind. Survival
counts the wave, Battle Royale counts time survived won or lost (a board that
only counted wins would be empty for most people), and the campaign counts the
highest mission cleared. One table, `SIM_SCORE`, because the room prints it and
the book keeps it and two copies of *what is a score* is how a leaderboard
starts disagreeing with itself.

**The result is carried on `returnTo`, not on `surv`.** The book was written
before the match, so a score made during it has to be put back by hand — and
`surv` is a sector that is not loaded while a machine is running. `endMatch`
records it, `backToSurvey` applies it and saves.

**The campaign's cabinet is a menu, and that is what made it hard.** The other
two snap into a match, so the coin and the match are the same act. The campaign
boots into its mission list — three missions in order is what that machine *is* —
so it is the one cabinet you can pay for and walk away from without playing
anything. That splits every way out of the list in two, and the split is not
*which button*, it is **whether the survey is still in memory**:

- Backed out having played nothing, the sector was never unloaded. You are
  standing in it. Crossing "back" to it would reload it from the book and throw
  away everything since the coin, so the coin is **forgotten** instead —
  `cancelSim`.
- Reached from a finished mission's MISSIONS button, the survey is gone and the
  return is real — `backToSurvey`.

`owedReturn()` is the one question both ask, and it asks the only honest thing:
`returnTo` is set in both cases, so the flag cannot answer it. **`returnTo` being
set does not mean a return is owed.** Two bugs came out of assuming it did — the
mission-setup screen's Escape went to the front page whatever you had come from
while the BACK button beside it went to the mission list, and an unspent coin
left the return set so that the survey could not be quit at all: quitting
reloaded the sector instead, with no way out. Both are in the suite now, and both
were checked by putting them back.

### The crossing, exactly

1. **In.** `saveSurveyBook()` first. If it will not write, the machine does not
   start and the room says why — there is no version of this where a game of
   asteroids costs somebody their hours, and the suite takes the storage away to
   prove it.
2. **Out.** Every path that ended at the title asks `returnTo` first:
   `leaveMatch` (the result screen's button, the campaign's, the pause menu's
   Q), and `toTitle` for the two the lobby owns. The result screen's button says
   BACK TO THE DOCK rather than MAIN MENU, and the pause menu says LEAVE THE
   MACHINE.
3. **Back.** `startGame("survey", 1, 0)` resumes from the book, the ship is put
   back where it stood, `surveyStations()` re-docks it by the same rule the tick
   uses, and the room opens again with the new score on the cabinet.
4. **Said out loud.** The sector ran on: traffic moved, rocks are elsewhere, a
   battle you left was fought without you. The return prints one line saying so.

### What moved

| Where | What happened |
|---|---|
| `index.html` | `CABINETS`, `SIM_SCORE`, `simResult`, `cabinetHere`, `startSim`, `simBootTick`, `backToSurvey`, `toTitle` and `returnTo` are new · `owedReturn`, `cancelSim`, `leaveLevels` and `countBack` tell a return that is owed from a coin that was never spent, and make the mission list's key agree with the button beside it · `endMatch` records · `leaveMatch` diverts · the book gains `sims` |
| `survey-hud.js` | `HUD.drawArcade` — the room, drawn as cabinets on plinths with the menu dioramas running as attract loops and the high score printed on the machine · a SIMULATORS tab on `PLACE_TABS`, live wherever you can trade |
| `survey-save.js` | `sims` validated key by key, capped, and in `freshBook` |
| `test/survey.js` | §14b: the room is a place and not a page, coin → boot → match, and the sector comes back with the same seed, cash, hold and manifest at the same dock · a browser that cannot save cannot start one · and the campaign's list is a menu you can walk into and back out of without paying for it |
| `test/ui.js`, `test/smoke.js` | the room joins the four-shape sweep; the result button's two labels |

**Checked:** the whole suite, including `test/browser.js` in a real browser, and
`test/fingerprint.js` unmoved — nothing here touches generation.

**Not done, and next:** step 4 — the made-up boards, generated per station and
per planet with your name among them. Step 3 landed the name they will print.

---

## Step 3, as built

The door. Four things the plan left to the build, and one bug it did not know
was there.

**The name is asked *after* the account exists, not on the signup form.** The
plan says "a name is chosen at sign-up". Built that way it would have had one
hole and one wasted box: every account that already exists has no name and
would never be asked for one, and the box would sit on the form during a
*sign-in*, where it means nothing. So the panel has a third state — signed in,
not yet named — and it is driven by **not having a name** rather than by having
just signed up. An account made before this change meets it on its next visit,
which is the migration path and the signup step in one screen. The name still
goes up with the signup itself when there is one to send.

**Setting a name is local first.** `setName` puts it on the session and *then*
tells the service. A player at the door with no connection has to be able to get
into the game, so a write that fails is reported and not obeyed — the name is
theirs on this device and goes up with the next successful call. The alternative
holds somebody at a locked door because of a tunnel, which is the failure this
whole step is trying not to have.

**The door stands in front of `openSims` and `openLobby`, not in front of the
keys that reach them.** "Before single player and before multiplayer" is every
route into a match from the front page, and there are several keys and cards
that get there. A door with a way round it is a fence, so the two functions ask,
and every route through them inherits it. A cabinet *inside* a station does not
ask: you are already in a sector, so you are already through.

**The heading is the game's name.** It said SURVEY, which was right while the
door was Survey's. It guards the whole game now, so telling half the players
they were about to start the wrong thing had to stop.

### The bug that had to be fixed first

`fresh()` signed the player out whenever a token refresh failed. That is right
for a refusal — a rotated or revoked token never becomes valid again by being
retried — but it was doing the same thing when it could not reach the service
**at all**. While an account was optional that cost a sync. Behind a required
sign-in it would have taken the *game* away from anybody whose train went into a
tunnel, permanently, and turned the plane case in this plan's own risk list into
a brick.

An unreachable service is not the service saying no. `call()` tags the one it
cannot reach, `fresh()` rethrows that without touching the session, and both
halves are in `test/door.js` — the second half deliberately, because a check
that offline never signs you out would also pass on a `fresh` that never signed
anybody out at all.

### And the suite that could not see any of this

Every other harness stubs `cloud.js` and `config.js` off (`test/page.js`,
`OFF_BY_DEFAULT`), so `cloud` is undefined, `needsDoor()` is false, and the
account layer never runs. Six suites passing said **nothing** about the door.
`test/door.js` boots the game with a fake account service — a real `cloud.js`, a
configuration that is not Ric's, and a `fetch` the test owns — and it found a
live `chooseGuest()` call left behind in `signOutNow` that would have thrown on
every sign-out.

### What moved

| Where | What happened |
|---|---|
| `cloud.js` | an unreachable service no longer signs anybody out · `PILOT` is the one rule for what a name is · `signUp` carries it · `setName` is local-first · `session()` gains `name` |
| `index.html` | the guest button, its row, its CSS, its handler and `kondrite.account.guest` are gone · `needsDoor` asks the session and the name · `acctName` is the third state · `openSims` and `openLobby` ask · the door is titled KONDRITE · the pilot name seeds the lobby name |
| `test/door.js` | new, and the first test of the account layer: no service is a whole game · the guest door is gone from the markup as well as the logic · signed out, neither the game nor the machines open · a cached session plays with every request failing · offline keeps the session, a refusal does not · an unnamed account is asked · what a name is · and no email reaches the part of the panel that names you |
| `README.md` | "An account, which is optional" is "which is required — but a connection, never" · the door is two ways through · a section on the pilot name |

**Still owed to step 5.** The name lives in Supabase's `user_metadata`, which is
in the auth schema and therefore readable only by its owner. That is enough for
your own name on a made-up board (step 4). A *real* board is everybody reading
everybody, so step 5's `profiles` table has to carry a public copy of it — and
that is also where a name can be made unique, which `user_metadata` cannot do.

**Checked:** the whole suite, `test/browser.js` in a real browser, and the door
walked by hand — signed out it stands in front of both buttons, an unnamed
account is asked, and naming yourself while the service rejects the write still
lets you in and starts the game.

---

## Step 4, as built

The boards. Three things the plan left to the build, and one it got wrong about
the screen.

**The board stands *beside* the machines, not under them.** The plan's room is
three cabinets; the board had to go somewhere, and under them is where it
obviously goes. It does not fit. `SCREEN_H` is a **constant 700**, which leaves
about 420 for this page, and three cabinets tall enough to read plus a dozen
names is half as much again — built that way the board came out at four rows and
the cabinets drew over their own text. Sideways the width is there to spend: the
page is 1000 to 1680 across, so a column on the right holds all thirteen rows at
full height and the machines keep theirs. It is also simply what the place is: a
room with machines along one wall and the board on the next.

**The faction is the whole point, and it is a shape and not a word list.** Each
of the five has its own *construction*, because five word lists poured into one
mould would read as one list with the nouns swapped. The Cordon wear a rank or a
lane and a surname — a duty roster. The Hallow wear where they are from:
*AELWYN OF THE THIRD ROAD*, *ELDER VARNE*. Morrow wear what they trade as, and
the house outsells the person: *HOUSE SABATO*, *TALLY-MASTER ABERNATHY*,
*COLQUHOUN & SONS*. The unaligned are plain and warm — *BIG ANNIE*, *DOC SILVA*.
Pirates are graffiti, and half of them are a threat rather than a name:
*SPLITTOOTH*, *NO-NAME KOSS*, *THE LAST WORD*. Walking into somebody else's
space and finding somebody else's people on the machine is most of what makes a
second cabinet worth looking at, and the suite checks the pools never borrow
each other's words.

**You are inserted at your rank, not appended.** A board answers one question and
it is *who is just above me*, so your row goes where your score puts it and the
window — when the board is taller than the space — is anchored on you with one
row showing above. A tie goes to the machine's own people: being told you have
equalled somebody is a better reason to play again than being handed the rank on
a technicality. An unplayed machine shows the twelve and **no row of yours at
all**, because a zero on a board is a worse thing to be shown than an honest
absence.

**And the ladder is fixed up from the bottom.** The scores fall by a multiplier,
which rounds neighbours onto the same number near the floor — and pushing the
lower one down cannot fix that, because it is already on the floor. So the pass
walks *up* and lifts the row above, which always has somewhere to go. The bottom
rung is checked to be beatable on a first go: a machine whose lowest score is out
of reach is a wall with twelve names on it, not a ladder.

### What it costs to be made up

Nothing crosses a network and nothing needs an account. `simBoard` is a pure
function of the cabinet's own rounded coordinates, its owner, the game, and the
sector seed — the same trick the chunk generator runs on. So the same cabinet
shows the same twelve people for as long as the sector exists, the cabinet next
door shows twelve different ones, and a station that changes hands in the war
gets a *different* dozen rather than the same twelve wearing new colours. The
suite has the account layer stubbed off entirely, which means it is also the
proof that a copy of the game with no account service still has boards — they
just call you YOU.

Said on the page, once: **nobody is watching**. A made-up board that did not
admit it would be the one dishonest thing in the game.

### What moved

| Where | What happened |
|---|---|
| `survey-world.js` | `simBoard`, five faction name-shapes, and the score ladders · its own PRNG, so asking for a board at draw time cannot move the sector's roll on |
| `index.html` | `cabinetHere` carries the coordinates and the faction key · `simBoardOf` inserts your row at its rank · `pilotName` puts the door's name on it, or YOU with no account service · `cf.board` for the harness |
| `survey-hud.js` | the board is a panel beside the machines · the cabinets gave up the width and got a floor of their own, so they stop drawing over their own text |
| `test/survey.js` | §14c: pure, different next door, different under a new flag, five factions that never borrow each other's words, a ladder that always descends and is always beatable at the bottom, and you at your rank with somebody above you |

**Still owed to step 5.** These boards are fiction and say so. The real one is
multiplayer, witnessed, and needs the three tables — and the pilot name has to
reach a public `profiles` row before anybody but you can read it.

**Checked:** the whole suite, `test/browser.js`, `test/fingerprint.js` unmoved,
and the room walked by hand at a station — the board follows the machine you are
standing at, and your row sits in your own colour with the next name up beside a
score you can see.

**Not done, and next:** step 5 — the real board.
