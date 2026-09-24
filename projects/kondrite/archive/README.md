# Archive

Plans that are **finished**. Nothing in here is a thing still to do.

A plan in this folder was built, tested and shipped, and it is kept because the
*argument* is worth keeping: what was decided, what was weighed and rejected,
and the things the build had to settle that the plan had left open. That is the
part a later reader needs and the part a diff cannot show.

**These are records, not instructions.** Where a finished plan and a live
document disagree, the live one is right — the plan describes a decision at the
moment it was taken, and the code has moved since. The authority for Survey is
`../SURVEY-PLAN.md`; the authority for how the game actually works is
`../README.md`.

Each file below says, at its own foot, what it left behind and what — if
anything — is still owed.

**Paths inside these files are relative to the project root**, one level up:
`index.html`, `survey-hud.js`, `supabase/schema.sql` and so on all mean
`../index.html` and the rest. They were written when these plans lived up there
and are left as they were written, because a record that has been edited to suit
where it ended up is a worse record.

**The game's code is not in `index.html` any more.** Since 24 September 2026 it
is the files in `../game/`, cut out of the old inline script in the order it ran.
A function a record says is "in index.html" is in one of those — `grep -n
"function name" ../game/*.js` finds it.

| Plan | What it decided | Finished |
|---|---|---|
| `SIMULATIONS.md` | Survey is the game; the other modes are arcade cabinets in it. The door, the machines, the sign-in, and the two kinds of board. | 20 September 2026 |
| `THE-STATION.md` | The six parts repair the home station, one room each. | September 2026 |
| `RENAME-KONDRITE.md` | CROSSFIRE became KONDRITE: the storage-key sweep, the room service's move behind a pass-through, the folder redirect. | 20 September 2026 |
| `SURVEY-BUILT.md` | Every section of `../SURVEY-PLAN.md` that was marked DONE, cut out word for word so the plan holds only open work: Phases 1–4, most of 5 and 7, 6.4 and 6.7, the account and the simulators. | 24 September 2026 |

**Three things in here are still owed**, and none of them is code:

- `SIMULATIONS.md` step 5 needs `../supabase/schema.sql` run once in the
  Supabase SQL editor before the witnessed board has anything to read. Until
  then it reads as unavailable and score reports queue harmlessly.
- `RENAME-KONDRITE.md`: the old `crossfire-rooms` worker is a pass-through
  (`../server/passthrough/`). When `npx wrangler@latest tail crossfire-rooms`
  goes quiet, delete the worker and that folder.
- Also from the rename: `projects/training/server/` still names
  `crossfire-rooms` in four comments. They are accurate until the shim is
  retired, and change then.
