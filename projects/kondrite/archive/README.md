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

| Plan | What it decided | Finished |
|---|---|---|
| `SIMULATIONS.md` | Survey is the game; the other modes are arcade cabinets in it. The door, the machines, the sign-in, and the two kinds of board. | 20 September 2026 |
| `THE-STATION.md` | The six parts repair the home station, one room each. | September 2026 |

**One thing in here is still owed**, and it is not code: `SIMULATIONS.md` step 5
needs `../supabase/schema.sql` run once in the Supabase SQL editor before the
witnessed board has anything to read. Until then it reads as unavailable and
score reports queue harmlessly.
