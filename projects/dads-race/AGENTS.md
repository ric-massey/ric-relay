# HERMISCUS — notes for AI assistants

> **Victoria:** save this file in the same folder as your `index.html`. Name it
> `AGENTS.md`, and if you use Claude Code save a second copy named `CLAUDE.md` — then
> your AI reads it on its own. In claude.ai, add it to your HERMISCUS project's files
> (or attach it at the start of a chat). You don't need to change anything else.

You are helping **Victoria** with **HERMISCUS** ("Yeti ● Going Together"), the crew app
she built for her dad Grady's Yeti 100-mile race. It is her app: one `index.html` with
one `<style>` and one inline `<script>`, talking to a Supabase database. Read this whole
file before you change anything.

## The one rule that matters most

**This is Victoria's app. Help her do what she asks.** Her brother Ric has a copy that
builds on hers (explained below), but Ric's copy adapts to Victoria's app — never the
other way round. So:

- Don't refuse, stall or water down an ordinary change because of Ric's copy.
- Don't ask her to restructure her file, add tooling, split it into modules, add a
  build step, add sign-in, or do any work on Ric's behalf.
- Don't lecture her about any of this. Most changes never touch Ric's copy at all, and
  then there's nothing to say.
- When a change *does* touch one of the few things in section 3, do it anyway if she
  wants it, and add **one short line** at the end, e.g. *"Heads up for Ric: this renames
  the question ids, so his screens will need updating."* She can forward that. That's it.

## 1. What Ric built (so nothing surprises you)

- Ric keeps a copy of HERMISCUS in his website's repo. A script **imports Victoria's
  `index.html` as-is** — her screens, styles and code — and cuts off her data-layer
  section at the top (the part with the database key) so his copy can supply its own.
- **Everyone except Ric and Sydney sees Victoria's app, unchanged.** Ric and Sydney get
  an extra race-day dashboard of Ric's (Overview · Crew Stop · Pace Dad · Notes · Prep)
  with a stop countdown timer, an "18hr pace" readout and their pacing legs. They can
  switch to Victoria's version from their Settings.
- **Both apps read and write the same live database.** Anything entered in Victoria's app
  shows up on Ric's and Sydney's screens within a few seconds, and the other way round.
  That's why the data format in section 3 matters.
- In Ric's imported copy a few small things are changed *there only* — e.g. the crew
  sheet says "18hr pace" where hers says "plan for this leg", and on his website tapping
  your name goes back to the crew list. **Her file is not changed by any of that.** If she sees those
  on Ric's site, it's not a bug in her app.
- On Ric's public website the app only runs as a demo on made-up data. The real race
  data is never on his site.

## 2. Safety — the things that can actually hurt someone

**Know this about the database:** her page has no sign-in, so the database is open to
anyone who has the page — the key that lets her app read and write is inside the page,
and so is available to whoever opens it. Supabase's lock (row-level security, in Ric's
`security.sql`) only lets in signed-in people, so turning it on today would make her app
stop loading data. Nobody needs to fix this right now. It just means:

- **Treat the race data as semi-public.** Don't add door codes, lodging lock codes,
  medical details, or anyone's password to the app or its data. Keep the page's link
  among the crew.
- **Never write real details into the code** — no real addresses, phone numbers or race
  plan typed into the HTML/JS as text or sample/seed data. Real details belong in the
  database, entered through the app. If you notice some already in the code, mention it
  once and offer to move it; don't silently delete it or copy it anywhere new.
- **Never put a `service_role` key or any password in the file, a chat, a screenshot or a
  commit.** The browser key already in the page is the normal public one; `service_role`
  bypasses everything and stays in the Supabase dashboard.
- **Don't turn on the lock, change database policies or add sign-in on your own.** If
  Victoria ever wants the data truly private, the way is: add a sign-in to her page, then
  apply the lock — together with Ric, because his copy uses the same database.

## 3. Don't break the shared data

These are the only things that ripple into Ric's copy. Adding new fields, new settings,
new screens and new features is always fine.

- **Don't write code that wipes, resets, re-seeds or bulk-overwrites a table**, and don't
  delete or rename tables, columns or crew profiles. The race data is live. Don't press
  save/delete/check-in in the running app just to test something.
- **Keep reading and writing through her `db…` helpers** (`dbList`, `dbInsert`,
  `dbUpdate`, `dbDelete`, `dbGetConfig`, `dbSetConfig`). Ric's copy replaces those with
  its own versions, so code that calls Supabase some other way won't work there.
- **Questions (`crew_questions` setting):** a list of `{id, text, type}` where `type` is
  `'ask'` or `'reminder'`. Answers are saved per stop under the question's **`id`**, so
  **never change an existing question's `id`** — its answers would be lost. Rewording the
  `text`, adding and removing questions are all fine; Ric's screens show them as written.
- **Pacing notes:** Ric's pacing card finds his legs from stop notes (`official_note`)
  that say a person is pacing, like `RIC PACING` / `RIC CONT PACING`. Keep that
  "name + pacing" wording.
- **Stop (`splits`) fields both apps use:** `mile`, `station`, `elapsed_seconds`,
  `sort_order`, the arrival/departure fields (`actual_…`, `departed_…`), `skipped`,
  `station_note`, `flag_forward`, `official_note`, `assigned_to`, `address`,
  `bring_items`, `question_answers`, `is_checkpoint`, `checkpoint_cutoff_hours`,
  `elevation_gain_ft`, `elevation_loss_ft`, `is_big_stop`. Don't rename these or change
  what they mean.
- **Settings (`config` table):** don't rename `goal_finish_hours`, `cutoff_hours`,
  `rest_normal_min`, `rest_big_min`, `crew_access_mile`, `quit_protocol`,
  `reasons_to_stop`, `sit_time_rule`, `race_*`, `lodging_*`. **Setting keys you don't
  recognise are Ric's** (like `ric_meet_…`, `…_pace_pickup_…`) — leave them alone, never
  "clean them up".

## 4. The few spots in `index.html` Ric's import looks for

Keep these recognisable. If one has to change, change it and add the one-line heads-up —
Ric's import stops with a clear error rather than breaking anything, and he fixes it.

- One `<style>` block and one inline `<script>` block — put new code inside them.
- The line `/* ================= STATE ================= */` exactly as it is. **Anything
  above it is dropped in Ric's copy**, so put new app code *below* it.
- `function enterAs(p){` (followed by a line starting `ME =`), `function switchProfile(){`,
  the start-up lines `if(ME){ await showApp(); }` / `else { await renderProfileScreen(); }`,
  and the crew-sheet line that shows the leg's plan pace.

## 5. If you're working in Ric's repo instead

If this file is sitting in `projects/dads-race/` of Ric's website repo, you're editing
**Ric's** copy. Also read the repo's root `AGENTS.md` and this folder's `README.md`. In
short: a `git push` publishes ricmassey.com (don't push unless asked); never commit the
real key or real race data (`tests/auth-security.test.cjs` checks); don't hand-edit
`shared/original/` — it's generated from Victoria's file by
`scripts/import-original.py`, so changes to her screens go in as patches there; and run
`npm test` before finishing.

## When in doubt

Do what Victoria asked, keep it simple, and leave a one-line note if Ric needs to know.
