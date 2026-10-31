# The Geometry of Spacetime

Four interactive lessons on relativity and the expanding universe, linked from
Exploration (MODULE 003). Terminal: `spacetime` or `relativity`.

| Page | Chapter | Parts |
|---|---|---|
| `index.html` | the contents | one card per chapter, listing its parts |
| `01-light-cones.html` | Light Cones | reading the diagram · the 45° limit · past, future, elsewhere · news from space · two observers · the 3D cone |
| `02-time-dilation.html` | Time Dilation | the light clock · γ at real speeds · the speed/clock-rate circle · muons · each sees the other slow · the twin paradox · GPS and gravity |
| `03-simultaneity.html` | The Loss of Now | seeing isn't happening · Einstein's train · the tilted now · when order can flip · the Andromeda paradox · the ladder in the barn |
| `04-expansion.html` | Space Expanding | everyone is the centre · Hubble's law · redshift · why bound things don't stretch · the event horizon · the whole history |

Every chapter ends with four "check yourself" questions and a list of where its
numbers come from.

## Why it is lessons

Until 2026-10-31 each chapter was one figure and a short essay. Ric asked for it
to be rebuilt (2026-10-31): "It's all too small it's a hard to understand topic
written into a small page. Maybe multiple examples and exhibits per thing. I want
it to be a tool used to teach and understand these things." So each chapter is
now one long page, built up in parts from the intuition to the formula, with a
figure in every part, a "Try this" where a figure hides a surprise, and a
contents rail. The URLs stayed the same, because the front door, the terminal and
the search index all link straight to the chapters.

Rules the lessons keep:

- **Every number is worked out on the page or sourced at its foot.** The orbit
  clock rates, the muon survival, the cosmology (age, horizons, scale factor,
  lookback) are computed live — `04-expansion.html` integrates flat ΛCDM from
  Planck 2018 parameters, and its age, 46-Gly particle horizon and 16.6-Gly event
  horizon come out of that, not a table. If you change a parameter, the prose
  numbers near it may need changing too; grep for them.
- **Say where a picture stops being literal.** The "everything moves through
  spacetime at c" circle is labelled a memory aid; the bound-galaxy simulation
  is labelled a toy; the Andromeda figure says it is not to scale.
- **No verdicts the physics doesn't give.** The Hubble tension is presented as
  unsettled; Betelgeuse's distance carries its uncertainty.
- The old essays' claim that electromagnetism beats expansion "by 39 orders of
  magnitude" was wrong; the push table in chapter 4 computes Λc²r/3 against each
  system's binding acceleration (≈10⁻⁶⁹ for hydrogen, 10⁻²² for Earth's orbit).

## How it's built

- `lesson.css` — the lessons' shared look. One stylesheet within one project,
  the way climbing and training share theirs; `index.html` keeps its own
  `<style>`. Colours that carry words clear 4.5:1 on `--bg` and `--bg-2`.
- `lesson.js` — the toolkit, `window.ST`. `figure()` sizes a canvas to its box
  and lets a page draw in CSS pixels (the old exhibits scaled fonts by hand and
  got it wrong twice — bug sweep D3-12). `animate()` runs a figure only while it
  is on screen and never starts one by itself under `prefers-reduced-motion`.
  `slider()`, `choice()` and `pointer()` wire controls; `mink()` is a spacetime
  diagram with light at 45°. The contents rail and the quizzes are built from
  the page's own markup.
- **A figure's first draw, a slider's first value and a choice's first pick are
  all deferred to a microtask**, so a page's code can declare its figures before
  the sliders they read. Keep it that way, or a figure that reads a later
  `const` throws on load.
- Every page loads `../../assets/visit.js` and `../relay-return.js`
  (`data-egg="spacetime"`, the `now` egg), and carries
  `data-mochi-world="space"`.
- Fonts come from Google Fonts, as they always have here (projects may carry
  their own; see AGENTS.md).

## Checking a change

`node .github/checks.mjs` parses every inline script; `assets/terminal/pages.js`
indexes these pages' titles, descriptions and headings, so rerun
`node assets/terminal/build-pages.mjs` after changing a heading. Then serve the
folder and open each chapter: every figure should draw, and the console should
be clean.
