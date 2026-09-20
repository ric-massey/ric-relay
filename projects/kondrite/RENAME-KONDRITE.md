# CROSSFIRE → KONDRITE

> *"also i want to rename the entire game Kondrite."*  — Ric, 19 September 2026

235 mentions across 44 files. **Everything switches.** Most of it is prose and
renames freely; five things are load-bearing and need a method rather than a
`sed`. This file is those five methods, and the order they have to happen in.

Two of them turned out to be much cheaper than the first draft of this file
claimed, and that draft was wrong in a way worth recording: the room list is
ephemeral, not durable, and a command alias was never a blocker at all.

**Steps 2–5 are done.** Step 1 is Cloudflare work and is Ric's; step 6 follows
it. See *Where this actually got to*, at the foot.

**The wordmark is `KONDRITE`**, matching the all-caps title the game already
draws; *Kondrite* in prose. A chondrite is the commonest stony meteorite — the
old, undifferentiated stuff the rest of a solar system got made out of — which
is a better name for this game than CROSSFIRE ever was, given what it turned
into. The `K` is the stylisation and it is worth keeping consistent everywhere.

---

## The five that need a method

### 1 · The storage keys — one migration, loaded first

```
crossfire.survey.v3        → kondrite.survey.v3      the book
crossfire.survey.v3.backup → kondrite.survey.v3.backup
crossfire.survey.zoom      → kondrite.survey.zoom
crossfire.keys.v1          → kondrite.keys.v1        the bindings
crossfire.devkeys.v1       → kondrite.devkeys.v1
crossfire.camera.v1        → kondrite.camera.v1
crossfire.hostkey.v1       → kondrite.hostkey.v1
crossfire.account.v1       → kondrite.account.v1     the session
crossfire.account.guest    → (deleted — archive/SIMULATIONS.md closed the door)
```

**`kondrite.survey.v3`, not `.v1`.** The format is version 3 and there really
were two earlier ones. A rename is not a format change and should not pretend to
be one.

**A new module, `migrate.js`, and it loads before everything else** — before
`net.js` at index.html:27. It has to: `cloud.js` reads the session at load, and
`survey-save.js` is handed its key names at construction. The project already
has this rule and already asserts it (`test/smoke.js`, `test/browser.js` check
the real resolved graph), so this is one more line in an order that is already
protected.

What it does, per key:

1. New key present → nothing. The migration has already run.
2. Old key present, new absent → copy, **read it back to confirm it took**, then
   delete the old one. Not delete-blind: a quota failure mid-copy with the
   original already gone is the one way this loses a save.
3. Neither → nothing. A new player.

**The book gets one extra rule**, because it is the only key with a race. The
game has **no service worker** (checked — only `atlas/` and `siege-conductor/`
register one), so there is no stale cached page to fight; but a tab left open on
the old build will autosave to the old key fifteen seconds after another tab
migrated. The book carries `savedAt` (survey-save.js:226, 304), so: **if both
keys exist, the higher `savedAt` wins.** That is the whole fix, and it is why the
book is worth three lines that the zoom preference is not.

Then point **`SURVEY_LEGACY`** (index.html:5570) at `crossfire.survey.v3` and
leave it there for a release. That constant exists for exactly this — it is how
the book already reads an older key and writes the current one — so the safety
net is not new code, it is a string.

**Quota:** copy-then-delete doubles the book transiently. Measured ceiling is
121 KB against a 512 KB constraint and a ~5 MB budget, so there is room; the
read-back in step 2 is what proves it rather than assuming it.

### 2 · The room service — a proxy first, then a domain

**The first draft of this file overstated this one.** `idFromName("crossfire")`
names a Durable Object that holds **nothing durable**: `rooms-core.mjs:24` says
everything lives in memory and expires, and `ROOM_TTL` is **25 seconds**
(rooms-core.mjs:41). Renaming it costs whoever is mid-lobby in that exact second,
and they re-host. It is very nearly free.

**The URL is the real problem, and it is silent.** `ROOM_HOST` is hardcoded:

```
index.html:26343   https://crossfire-rooms.rmbuster82.workers.dev
```

A renamed worker is a *new URL*. A client still on the old one reaches a
**different room list** — so a host on one and a joiner on the other simply
cannot see each other, with no error anywhere. A split room list is worse than an
outage because nothing announces it.

So, in this order:

1. Deploy **`kondrite-rooms`** — new worker, new DO name, empty and fine.
2. **Replace the old worker's code with a pass-through** to the new host. Both
   URLs now feed one room list, so an old client and a new client meet.
3. *Then* ship the client pointing at the new URL. Never before step 2.
4. Retire the old worker when the logs go quiet.

**And fix it permanently while you are in there:** put the service on a **custom
route** — `rooms.ricmassey.com/*` — so the worker's name never appears in a URL
again. The domain is already his and already on Cloudflare. After that, the
worker can be renamed at any time for free, and this section never needs to
exist again.

### 3 · The folder — the stub *is* the switch-over

The folder moves to `projects/kondrite/`. GitHub Pages has no server-side
redirects and `404.html` cannot help — Pages serves it for genuinely missing
paths and it has no way to know what `?seed=` meant. A file at the old path is
the only mechanism there is:

```html
<!-- projects/crossfire/index.html — the game moved, and the seed comes too. -->
<!DOCTYPE html><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Kondrite</title>
<script>location.replace("../kondrite/" + location.search + location.hash);</script>
<noscript><a href="../kondrite/">Kondrite has moved.</a></noscript>
```

**JavaScript, not a meta refresh**, because a meta refresh drops the query string
and `?seed=1234` is a designed feature of this game — a sector is a place you can
send someone. `location.replace` rather than `location.href` so the old address
does not sit in the back button.

Keep the stub indefinitely. It is four lines and it costs nothing, and the links
it serves are in other people's messages where they cannot be edited.

### 4 · The command alias — never a blocker

This one was over-flagged in the first draft. `index.html:565` already carries
`aliases: ["vector", "asteroids", "wall"]` — the mechanism exists precisely for
this. The command becomes `kondrite` and **`crossfire` joins the alias list**.
Nothing is left un-renamed; an alias is not a leftover, it is the feature.

### 5 · The Supabase project

Nothing in it is named for the game — the table is `public.saves` and every
policy names `auth.uid()`. Nothing to rename, and a project rename is not
something to do to live rows. `window.CROSSFIRE_CLOUD` in `config.js` is a
client-side global and renames with the rest of them.

---

## The order it happens in

The only sequence where nothing breaks:

1. **`kondrite-rooms` deployed**, old worker proxying to it. Infrastructure
   first, and it is invisible until the client moves.
2. **`migrate.js` written and loaded first**, still under the old name. Ships on
   its own, does nothing visible, and from here every browser that opens the game
   carries its save under both names.
3. **The globals, the wordmark, the copy** — one pass, one commit, everything in
   lockstep or the page does not boot.
4. **The folder moves**, the stub goes in, the four site references follow, and
   `ROOM_HOST` points at the new URL.
5. **The docs, the assets, the commit prefix.**
6. **Later:** the rooms custom route, the old worker retired, and `SURVEY_LEGACY`
   dropped once the logs say nobody is arriving on an old key.

Steps 1 and 2 are the ones that have to land *before* the rename is visible.
Everything after is ordinary work.

## The rest, which is a `sed` with a short exclusion list

**1 · The wordmark and the copy.** The title screen draws `CROSSFIRE`
(index.html:24246). It draws `KONDRITE`. The line under it —
*"asteroids — open space, a closing wall, or a war to fight"* — is a list of four
peer modes and is wrong anyway once [archive/SIMULATIONS.md] lands, so the two changes
want the same new line: **Kondrite is a survey of endless space.**

**2 · The globals.** Eight of them, and they move in lockstep or the page does
not boot — the inline script captures each one *once*, and a module that
registers under a name nobody reads is silent:

```
window.CrossfireNet        → window.KondriteNet
window.CrossfireMenu       → window.KondriteMenu
window.CrossfireSurveyHUD  → window.KondriteSurveyHUD
window.CrossfireSurveySave → window.KondriteSurveySave
window.CrossfireSurveyWorld→ window.KondriteSurveyWorld
window.CrossfireCloud      → window.KondriteCloud
window.CROSSFIRE_CLOUD     → window.KONDRITE_CLOUD      (config.js)
window.CROSSFIRE_BOOK_STORE→ window.KONDRITE_BOOK_STORE (a test seam)
```

`test/page.js` resolves the real load order and `test/menu.js:151` asserts
`windowStub.CrossfireSurveyHUD` by name. Both move with them.

**3 · The folder**, with the stub above, and the four site references:
`gaming.html:461,534`, `workbench.html:222`, `latest.js:38`,
`index.html:565–567`.

**4 · The assets.** `assets/games/crossfire.jpg` and `.webm`, plus the absolute
`og:image` at `gaming.html:15`. Low stakes — the only cost is that a link already
posted somewhere shows a stale preview card until it is re-scraped.

**5 · The docs.** `README.md`, `SURVEY-PLAN.md`, `TODO.md`, `LIVING-WORLD.md`,
`WORLD-IDEAS.md`, `PLAYER-HISTORY.md`, `BIOMES.md`, `AGENTS.md`, `.gitignore`,
every file header comment, and `test/package.json`'s description. Prose, and a
`sed` over the lot is fine — **the three things it must not touch are the
migration table in `migrate.js`, `SURVEY_LEGACY`, and the alias list**, because
those are the three places where the old word is load-bearing rather than
left-over.

**6 · The commit prefix.** Every commit in this project reads `CROSSFIRE: …`. It
reads `KONDRITE: …` from the rename commit on. The history keeps the old prefix
and should — that *is* what the game was called.

---

## Where this actually got to

**The key table above was wrong, and that is the interesting part.** It listed
nine keys. The code had seventeen: the book had moved from `v3` to `v4`, and the
pad, the name, the input mode, the mouse preference, the sound and the guest
flag were missing from it entirely. A table is a second copy of the truth and
this one was stale before anybody typed it.

So `migrate.js` **sweeps the prefix** instead. Every key under `crossfire.`
moves, whatever it is and whenever it was added — including one added next year
by somebody who never reads this file. The four rules and the read-back are as
written above; the `savedAt` race rule is as written and is asked of every key,
because a preference has no `savedAt` and so can never win one.

`SURVEY_LEGACY` did **not** need pointing back at the old name. The sweep moves
`crossfire.survey.v3` along with everything else, so the v3→v4 chain still reads
the way it always did and the constant is simply `kondrite.survey.v3`. One less
thing on the exclusion list.

`migrate.js` ships **with** the key rename rather than a release ahead of it.
The plan's step 2 assumed a copy that leaves both names in place; the module as
specified in §1 copies *and deletes*, and deleting a key the shipped game still
reads is a lost save. One commit, both halves.

**The four by-hand checks, done:** an old profile seeded with `crossfire.*`
comes back under `kondrite.*` with the book intact; the old path redirects with
`?seed=1234` still attached; the migration is driven directly in
`test/save.js` for the two-tab race, a second run, and a storage that refuses
the copy. The sign-in check is Ric's — it needs a real account.

### Still open, and all of it Ric's

1. **`kondrite-rooms`.** `server/wrangler.jsonc` and the DO name are renamed and
   ready, but nothing is deployed and **`ROOM_HOST` is deliberately still on
   `crossfire-rooms`** — see the comment on it. Deploy the new worker, put the
   pass-through on the old one, *then* move the string. Never in the other
   order.
2. **The custom route**, `rooms.ricmassey.com/*`, so this section never needs to
   exist again.
3. **`projects/training/server/`** names `crossfire-rooms` three times, in prose
   comparing the two Durable Objects. Those are accurate *today* — that is what
   the worker is still called. They change when the worker does, not before.

## What this does not touch

Generation. Nothing in `survey-world.js` salts a seed with the game's name — the
only occurrence is a file header — so **`test/fingerprint.js` must not move.** A
moved hash means the rename reached something it had no business reaching, and
that is the single most useful assertion in this whole job.

---

## How it is checked

```sh
grep -ri crossfire projects/kondrite --exclude-dir=node_modules
```

Four things are allowed to survive that grep, and **every one of them is
deliberate rather than missed**:

- `migrate.js`'s table of old key names, and the `SURVEY_LEGACY` line beside it
- the `crossfire` command-palette alias
- the redirect stub at the old path
- prose in the docs that is about the old name on purpose — this file, and the
  history in `SURVEY-PLAN.md`

Anything else that grep finds is a miss.

Then the suites, all of which touch the globals or the page's load order:

```sh
node projects/kondrite/test/smoke.js
node projects/kondrite/test/menu.js
node projects/kondrite/test/survey.js
node projects/kondrite/test/fingerprint.js
node projects/kondrite/test/browser.js
```

### And four by hand, because no suite boots with somebody's history in it

1. **An existing save survives.** Open the game with a real `crossfire.survey.v3`
   in storage and confirm the sector, the chart, the hold and the manifest are
   all there. The suites boot with empty storage, so this failure is invisible to
   them — and it is the one the whole file is written to prevent.
2. **An existing sign-in survives.** Still signed in after the migration, with no
   password asked for. Under a mandatory sign-in, this failing looks exactly like
   the sign-in wall being broken.
3. **The two-tab race.** Old build open in one tab, new build in another, save in
   the old one, reload the new one: the later save is the one that is there. That
   is the `savedAt` rule, and it is the only part of the migration with a race in
   it.
4. **An old link still works.** `ricmassey.com/projects/crossfire/?seed=1234`
   lands on the new path **with the seed intact**. A redirect that drops the
   query is the failure that looks like it worked.

And one to watch rather than test: after the client moves to the new room host,
**host a room on one machine and join from another** before the old worker is
retired. A split room list has no error message.
