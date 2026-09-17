# Archive — finished documents

Working documents whose work is **done**. They are kept because they are the
reasoning behind code that is still running, and the code comments assume you
have read them. Nothing in here is a live plan, and nothing in here should be
used to decide what to build next.

Each file carries a dated **ARCHIVED** banner at the top saying what shipped,
where the code lives now, and anything that landed differently from the
document. The folder structure mirrors where each file used to live, so a path
in an old commit message or code comment still reads.

**The rule:** a document lands here only when every item in it is built, or the
finding it recorded has been fixed and verified against the code. A document
with one open item stays where it lives and keeps its status marker — see
`projects/crossfire/TODO.md` (one item left) and `projects/offramp/PLAN.md`
(active) for what that looks like.

| Document | What it was | Verified against |
|---|---|---|
| [`Ric's notes/terminal-audit-2026-07-31.md`](Ric's%20notes/terminal-audit-2026-07-31.md) | Live audit of `index.html` — 7 A-bugs, 6 B-items, 5 C-items | All fixed: typos gone, `ROOMS` is one list, `og:image` present, contrast raised, `help` scrolls to the top of its own output, bare `Tab` stopped dumping, `echo`/`cat`/`open` answer with usage, boot-skip keystroke lands in the prompt |
| [`Ric's notes/rooms-audit-2026-07-31.md`](Ric's%20notes/rooms-audit-2026-07-31.md) | Live audit of the nine room pages, `map.html` and `404.html` — 9 A, 7 B, 4 C | All fixed or settled: nav label set agrees with the front door, `installRoomMenu()` is the mobile menu, the room "latest" banners are gone, setup notes and "Replace me" copy are off the pages, canvases read `devicePixelRatio`, `alt` text is sentences, the rate-limit message no longer tells you to refresh |
| [`Ric's notes/Terminal.md`](Ric's%20notes/Terminal.md) | A transcript of the front door as it read on 31 July 2026 | Superseded by the page itself. Kept as the only record of the pre-audit copy — the four typos it preserves (`suprise`, `philosiphy`, `writen`, `cats name`) are the ones that audit found |
| [`playground/STARFIELD_IMPROVEMENT_PLAN.md`](playground/STARFIELD_IMPROVEMENT_PLAN.md) | The plan that turned Starfield from one 591-line file into a project | Built: `projects/starfield/` matches the proposed `data/` + `src/` layout file for file |
| [`projects/offramp/CRASH-MODEL.md`](projects/offramp/CRASH-MODEL.md) | Build spec for one general impulse-momentum crash solver | Built: `projects/offramp/src/impact.js`, `src/skill.js`, `test/impact.test.js` |
| [`projects/how-speed-affects-time/BAND-SELECTOR-BRIEF.md`](projects/how-speed-affects-time/BAND-SELECTOR-BRIEF.md) | Spec for the wavelength-band sky control | Built, and further than the brief asked: 13 real all-sky plates and a three-band mixer in `src/exhibit.js` |
| [`projects/the-shape-of-harm/STRUCTURAL_AUDIT.md`](projects/the-shape-of-harm/STRUCTURAL_AUDIT.md) | Code, routing, accessibility and deployment audit of the framework site | All 15 problems fixed; `validate_site.py`, `validate_launch.py` and `validate_hardening.py` all pass, and nothing in the project links this file |

## Not archived, deliberately

- **`projects/the-shape-of-harm/`** keeps its superseded protocols and forms
  where they are. That project decided it in its own v0.9 changelog: live pages
  and three validators still link them, so each superseded file carries a
  deprecation banner and `document-status-register.csv` records its status
  instead. Moving them would break the validators. Two are hash-locked and must
  not be edited at all.
- **Design briefs for work that has not been built** — `crossfire/LIVING-WORLD.md`,
  `crossfire/PLAYER-HISTORY.md`, `crossfire/WORLD-IDEAS.md`, and the whole of
  `projects/starfield/docs/` — stay put. They are unbuilt, not finished.
- **Data files** — `projects/climbing/climbs.md`, `todo.md` and `photos.md` are
  inputs to `build-data.py` and `import-photos.py`, not documents.
