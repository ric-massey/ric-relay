# HERMISCUS — rules for AI assistants

You are helping with **HERMISCUS** ("Yeti ● Going Together"), the crew app for Grady's
Yeti 100-mile race. It is a family app: a real race, real people, a real shared
database. Read this whole file before you change anything. If you were given this file
pasted into a chat, these rules still apply.

There are two copies of this app, and this file travels with both:

- **Victoria's app** — one `index.html` (one `<style>`, one inline `<script>`) that she
  edits and deploys. It talks to the live database directly.
- **Ric's copy** — the `projects/dads-race/` folder in Ric's website repo. It imports
  Victoria's `index.html` (via `scripts/import-original.py`) and adds Ric's and Sydney's
  own race-day screens on top, reading **the same database**.

A change that looks harmless in one copy can quietly break the other. That is what most
of this file is about.

---

## 1. Safety first — the things that can actually hurt someone

**The database is live and it is not locked yet.** The row-level-security setup in
`supabase/security.sql` has not been applied. Until it is, anyone who has the page (and
so its key) can read and change every table. So:

- **Never add more real information to the page itself.** No lodging addresses, phone
  numbers, door codes, medical details, passwords or the full race plan written into the
  HTML/JS as text or as seed data. Real details belong in the database, entered through
  the app — not baked into a file that gets published.
- If you notice real details already sitting in the code (a seed/sample block with the
  real race, a hard-coded address or phone number), **point it out to the person you're
  helping and suggest moving it into the database.** Don't silently delete it — someone
  may be relying on it — and don't copy it anywhere new.
- **Never put a `service_role` key, a database password, or anybody's account password in
  any file, commit, chat message, screenshot or issue.** The browser key (`sb_publishable_…`
  or the `anon` JWT) is designed to be public *only once RLS is on*; the `service_role` key
  bypasses everything and must never leave the Supabase dashboard.
- **Do not run `supabase/security.sql`, change policies, or turn on sign-in by yourself.**
  Locking the database is the real fix, but it locks out every copy of the app that
  doesn't sign in — including Victoria's. That's a decision for Victoria and Ric
  together, not a side effect of an unrelated task. Suggest it; don't do it.
- **In Ric's repo**, the real key lives only in `shared/config.local.js`, which is
  git-ignored. The website runs a demo on made-up data (`shared/demo-data.js`). Never
  commit the key, the project URL, or any real race data — `tests/auth-security.test.cjs`
  fails if you do. Never paste real data into `demo-data.js`.

## 2. Don't destroy data

- The app's buttons write straight to the live race data. **Don't click save / delete /
  check-in / reset in a running copy just to "test" something.** Use the demo, or ask.
- **Never write code that wipes, re-seeds, bulk-overwrites or "resets" a table.** No
  "clear all splits", no "restore defaults" that replaces what's there. If a change needs
  to migrate existing rows, write it so it only *adds or fills in*, and show the person
  the plan before it runs.
- **Never delete or rename a database table or column**, and never delete a crew profile,
  as part of another change. Ask first.

## 3. The shared data contract — what Ric's side reads

Ric's and Sydney's screens read the same rows Victoria's app writes. If you change the
*shape* of any of this, their race-day screens break (or, worse, show wrong numbers). You
can **add** new fields and new config keys freely; **don't rename, remove, or change the
meaning** of these without saying so loudly:

- **Tables:** `profiles`, `splits`, `config`, `notes`, `checklist_items`,
  `timeline_events`. Reads and writes go through the `db*` helpers (`dbList`,
  `dbInsert`, `dbUpdate`, `dbDelete`, `dbGetConfig`, `dbSetConfig`) — keep using them;
  Ric's copy swaps in its own versions with sign-in and an offline queue.
- **`splits` rows:** `mile`, `station`, `elapsed_seconds`, `sort_order`,
  `actual_elapsed_seconds` / `actual_logged_at` / `actual_logged_by`,
  `departed_elapsed_seconds` / `departed_logged_at` / `departed_logged_by`, `skipped`,
  `station_note`, `station_note_by`, `flag_forward`, `official_note`, `assigned_to`,
  `address`, `bring_items`, `question_answers`, `is_checkpoint`,
  `checkpoint_cutoff_hours`, `elevation_gain_ft`, `elevation_loss_ft`, `is_big_stop`.
- **Pacing lives in `official_note` text.** Ric's pacing card is built by finding stops
  whose `official_note` says a person is pacing (e.g. `RIC PACING`, `RIC CONT PACING`).
  Keep that wording pattern — name + "pacing" — when editing those notes.
- **`crew_questions` config** is a JSON array of `{id, text, type}` where `type` is
  `'ask'` or `'reminder'`. Answers are saved per stop in `question_answers`, keyed by the
  question's **`id`** — so **never change an existing question's `id`** (its answers would
  be orphaned). Editing the `text` is fine; Ric's and Sydney's screens show it as written.
- **Other config keys both apps use:** `goal_finish_hours`, `cutoff_hours`,
  `rest_normal_min`, `rest_big_min`, `crew_access_mile`, `fade_factor`,
  `gap_gain_weight`, `gap_loss_weight`, `race_name`, `race_start`, `race_start_time`,
  `race_end`, `race_location`, `race_description`, `quit_protocol`, `reasons_to_stop`,
  `sit_time_rule`, `tracking_url`, `official_site_url`, `ultrapacer_url`, `bib_number`,
  `checkpoint`, `lodging_*`.
- **Config keys you don't recognise are someone else's.** Ric's screens keep their own
  settings in the same `config` table (keys like `ric_meet_<id>`, `<name>_pace_pickup_<id>`,
  `ric_arrival_buffer_minutes`, `simulation_started_at`). Never delete config rows you
  didn't create, and never "clean up" unknown keys.

## 4. Editing Victoria's `index.html`

Ric's import script reads her file mechanically. It stops with an error (safely — it
refuses to write anything) if these change, but then Ric has to fix it by hand:

- Keep **one** `<style>` block and **one** inline `<script>` block. Put new code inside
  them rather than adding more.
- Keep the line `/* ================= STATE ================= */` exactly as it is.
  **Everything above that line is thrown away on import** (it's her data layer, which
  holds the key). Put app code *below* it — code added above it will silently not exist
  in Ric's copy.
- Keep these exact snippets recognisable, or tell the person that Ric's import will need
  updating:
  - `function enterAs(p){` followed by a line starting `ME =`
  - `function switchProfile(){`
  - `if(ME){ await showApp(); }` / `else { await renderProfileScreen(); }`
  - the crew-sheet pace line (`bits.push(...)` for the leg pace)
- It's fine to change her screens, styles, wording and features — that's the point. The
  rules above are about the seams, not about her design.

## 5. Editing Ric's copy (`projects/dads-race/` in the website repo)

- Also read the repo's root `AGENTS.md`. Deploying there is `git push`, and **a push is a
  publish** to ricmassey.com — don't push unless asked.
- **Don't hand-edit `shared/original/`.** It's generated from Victoria's file by
  `scripts/import-original.py` and gets overwritten on the next import. To change her
  screens *in Ric's copy*, add a `replace_once` patch to the import script and apply the
  same edit to the generated file, so the next import keeps it.
- Ric's and Sydney's screens are `shared/app.js`, `shared/app-shell.html`,
  `shared/styles.css`; everyone else gets `shared/original/`. `shared/bootstrap.js` picks
  which one runs.
- When you change a `.js`/`.html` file that pages load, bump its `?v=` in the pages that
  load it, or phones keep the old copy.
- Run the tests before you finish: `npm test` here, or `node .github/checks.mjs` from the
  repo root. If a test fails, fix the cause — don't loosen the test.

## 6. When in doubt

Stop and ask the person you're helping. It is always better to say "this would change
how Ric's screen reads the questions — is that OK?" than to find out at mile 60.
