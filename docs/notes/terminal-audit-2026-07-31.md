# Terminal home page audit — 2026-07-31

Scope: `index.html` (the terminal hub) plus the files it loads — `notes.js`,
`latest.js`, `effects.js`, `projects/climbing/latest-climb.js`. Verified live at
375px and 1280px against a local static server. **No console errors, no failed
requests, and every link on the page resolves to a real file.** The page is in
good shape structurally; everything below is a list of things worth fixing, not
a list of things that are broken.

Severity key: **A** = actually wrong / visitors hit it · **B** = worth fixing ·
**C** = polish.

---

## A — real bugs

### A1. `help` scrolls you to the bottom of its own output
`#output` is capped at `max-height: 14em` and every command ends with
`out.scrollTop = out.scrollHeight`. The help text is ~20 lines, so typing `help`
leaves you looking at the *last eight lines* of the list — you have to scroll
back up to find out that `ls` exists.

Measured: `scrollTop 912` / `scrollHeight 1101` / `clientHeight 189`.

This is the worst one on the page, because the page's own instructions say
"type /help" as the first thing a visitor should do.

Fix direction: only auto-scroll when the *new* output is short, or scroll the
top of the newest block into view rather than the bottom of the buffer.

`index.html:238`, `index.html:779`

### A2. Pressing Tab on an empty prompt dumps every completion
`completions.filter(c => c.startsWith(""))` matches everything, so an empty Tab
prints a 470-character wall of ~40 command names into the output box. Should
either do nothing or print a short "try `help`" hint.

`index.html:717-727`

### A3. Naming a room with any trailing word says the room doesn't exist
`mind extra` → `command not recognized: mind`. The guard is
`PAGES[pageVerb] && !arg`, so a room name only works when it is the *entire*
line. Telling someone `/mind` isn't recognised — when it visibly is, right there
in the directory — is the confusing outcome. Same for a stray trailing space
typo.

`index.html:770`

### A4. `echo` with no argument prints nothing at all
`echo: (arg, originalArg) => originalArg || ""` returns `""`, which is falsy, so
`print()` never runs. The terminal silently swallows the command. Every other
verb answers with a usage line.

`index.html:640`, `index.html:774-775`

### A5. `cat` alone falls through to "command not recognized"
`cat notes` works, bare `cat` doesn't — and `cat notes` is advertised in `help`
and offered by Tab completion, so a half-typed attempt gets a wrong error rather
than a usage hint. Same shape of problem as A3.

`index.html:763`

### A6. `open <unknown>` doesn't say what it couldn't find
`open notaroom` prints the generic usage block without ever naming
`notaroom`, so it reads like *you* typed the command wrong rather than that the
target doesn't exist.

`index.html:613`

### A7. `.claude/launch.json` points at a dev server that doesn't exist
Three of the five configurations (`site`, `site-alt`, `site-ui`) run
`node tools/dev-server.mjs`, and there is no `tools/` directory in the repo.
They fail instantly with `MODULE_NOT_FOUND`. Only the two `python3 -m http.server`
entries work. The file is gitignored so this is local-only, but it means the
default preview config is broken for you and for any agent that reaches for it.

---

## B — worth fixing

### B1. Most of the page's body text fails contrast
`--phosphor-dim: #8a6200` on `#0a0a0a` is **3.5:1**. That colour carries the
welcome paragraph, the help block, the "I made these places…" line, and every
directory entry's description — i.e. nearly all the actual prose. AA wants 4.5:1
for text that size.

`--phosphor-faint: #3d2c00` is **1.5:1** — effectively invisible. It's the
footer (`EST. 2026 · SIGNAL NOMINAL`) and the `-----` divider. I couldn't read
the footer in a screenshot at all.

The scanline/vignette overlay (`body::before`) sits on top of everything and
darkens it further, so the real numbers are slightly worse than the ones above.

Nudging `--phosphor-dim` up to roughly `#b07d00` and `--phosphor-faint` to
`#6b4d00` keeps the amber-CRT look and clears AA.

`index.html:19-20`

### B2. The room list is maintained in five separate places
`PAGES`, `PAGE_DESCRIPTIONS`, the `#dir` markup, `siteTree()`, and `completions`
each hold their own copy of the rooms. Adding or renaming a room means editing
all five by hand, and nothing catches a miss. This is exactly the kind of thing
that drifts — one shared array that the directory markup, the tree and the
descriptions all render from would remove the whole class of bug.

`index.html:334-385`, `index.html:458-478`, `index.html:540-559`, `index.html:699-705`

### B3. The whole page is `visibility: hidden` during the boot animation
`.hidden` uses `visibility: hidden`, which reserves layout, so for the first
~1.2s a visitor sees the boot lines and then roughly 900px of empty page below
them. It avoids layout shift, which is the right instinct, but the dead space
reads as a broken page for a beat. Worth considering an opacity fade instead.

`index.html:129`

### B4. `reveal()` can run twice
If someone clicks or presses a key to skip the boot, `skipBoot()` calls
`reveal()` — and the already-queued `nextLine()` timer then fires and queues
*another* `reveal()` 330ms later, which re-runs `cmd.focus()`. Harmless today
because the input is the only focusable thing on screen, but it's a latent
focus-stealer. Clearing the pending timeout in `skipBoot()` would close it.

`index.html:424`, `index.html:441-448`

### B5. The keystroke that skips the boot is swallowed
`skipBoot` is bound to the first `keydown`. If a visitor's instinct is to just
start typing, that first character reveals the shell instead of going into it —
because the input isn't focused yet. Focusing the input and replaying the
character would make it feel right.

`index.html:439`

### B6. No `og:image`
`og:title`, `og:description` and `og:url` are all set, and `twitter:card` is
`summary` — but there's no image, so a link shared to family in a text message
or on Facebook comes through as a bare grey box. A single dark card with the
amber `Terminal` wordmark would do it.

Also minor: `og:url` is `https://ricmassey.com` while `canonical` is
`https://ricmassey.com/` — pick one.

`index.html:8-14`

---

## C — copy and polish

### C1. Typos in visible copy
| Where | Is | Should be |
|---|---|---|
| `index.html:324` | `for a suprise!` | `surprise` |
| `index.html:324` | `Sydney's cats name` | `cat's name` |
| `index.html:342`, `469` | `philosiphy` | `philosophy` |
| `index.html:377`, `476` | `writen` | `written` |

`philosiphy` and `writen` each appear **twice** — once in the `#dir` markup and
once in `PAGE_DESCRIPTIONS` — so `ls` in the terminal prints them too. Fix both
copies (see B2).

### C2. Wording
- `index.html:322` — "type /help and there will be a list of prompts you can do"
  → they're *commands*, not prompts, and the sentence is doing a lot of work.
- `index.html:332` — "I made these places based on things that I enjoy if you
  like them too you may like the information in those areas!" is a run-on; it
  needs a full stop after "enjoy".
- `index.html:295` — double space after "I made this for me." renders literally,
  because `.welcome-tag p` is `white-space: pre-wrap`.

### C3. `<title>` is just "Terminal"
Fine in a tab, thin in a bookmark bar or a search result. `og:title` already has
the better version — "Terminal — Ric Massey's corner of the internet".

`index.html:6`

### C4. Tab completion doesn't complete to the common prefix
With multiple matches it prints the list but leaves the input untouched. Real
shells fill in as far as the shared prefix goes. Small thing, but this page is
pretending to be a shell.

`index.html:725-726`

### C5. Tab completes `map`, which is locked
`completions` includes every key of `PAGES`, so Tab offers a room that answers
`[LOCKED]`. Harmless, slightly untidy.

---

## Checked and fine

- No console errors, no failed network requests, no external requests.
- Every `href` in `index.html` resolves — all 10 rooms, all 8 project shortcuts,
  `404.html`, and both generated JS files.
- No horizontal overflow at 375px; directory entries wrap correctly.
- The "latest" banner is live and correct: it picks
  *How Speed Affects Time* (2026-07-31) over the newest climb (2026-07-27), and
  suppresses itself on the page it points at.
- The room menu label set is **identical across all nine room pages** — the rule
  in `AGENTS.md` is being held.
- `RELAY_CATS`, `RELAY_EFFECTS` and `RIC_NOTES` all load; `mochi`, `lsd`,
  `shrooms` and `sober` all reach real implementations.
- `prefers-reduced-motion` path works — the boot is skipped, not just sped up.
- No location data, no extra repos, no build step. `.gitignore` correctly keeps
  credentials, originals and caches out.

---

## Changed same day

Following this audit, `/training`, `/apex`, `/log` and `/map` were removed from
the home page's clickable directory — they're the thinnest rooms (training is
still `coming soon` placeholders per `README.md:30`, log has four entries, map is
a deliberate stub). They remain fully reachable: listed in `ls`, in `tree`, in
`find`, in Tab completion, openable by name or via `open`, and still linked from
every room's own nav. Only the front door changed. See `AGENTS.md`.
