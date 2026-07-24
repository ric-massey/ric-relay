# Notes for AI assistants working on ric-relay

This file is for any LLM/agent asked to change this site. Read it before you touch
anything. `README.md` covers what the site is; this file covers **how to work on it
without breaking the concept or Ric's rules.**

## What this project is

Ric Massey's personal website for friends and family. The concept: **"it's literally
my own internet."** The home page (`index.html`) is a terminal hub; every other page is
a **room** dressed up to look like the real app for that world (climbing → Mountain
Project, training → Strava, Orrin → a brain, etc.). Plain HTML/CSS/JS, **no build
step and no dependencies** — each page is a single self-contained `.html` file with its
CSS in a `<style>` tag and its JS in a `<script>` tag. Keep it that way unless Ric
explicitly asks to add tooling.

Deploy = `git push` to `main` → GitHub Pages. So **a push is a publish.** Don't push
unless Ric asks.

## Hard rules — do not break these

1. **No location data, ever.** The private map (`map.html`) is a locked placeholder on
   purpose. Real coordinates/places live in a separate, authenticated app — never in
   this public repo. Don't add a real map, addresses, or GPS data here.
2. **Only one coding project is featured: Orrin.** Ric does not want his other GitHub
   repos listed or auto-pulled. `orrin.html` hits the GitHub API for
   `ric-massey/orrin_v3` only — don't broaden that.
3. **Every room is its own themed world.** Don't flatten the site into one shared
   template, shared stylesheet, or one generic nav bar. The visual variety is the point.
4. **Keep it dependency-free.** No frameworks, bundlers, CDNs, or external fonts/scripts
   unless asked. Everything must work as static files opened directly.

## The menu system (read this before editing any nav)

There is intentionally **no shared nav component**. Each page has its own `<nav>` whose
*styling* is native to that room, but they all expose the **same rooms with the same
labels** so navigation stays predictable:

```
relay · orrin · psyche · climbing · training · exploration · workbench · captures · log
```

- `href` targets and link text are **identical on every page** — only the CSS differs.
- Keep Relay home links as `index.html` in room markup for direct-file compatibility.
  `effects.js` normalizes those links to the clean directory root when served over HTTP;
  `projects/relay-return.js` does the same for project return controls. Do not hardcode
  a deployment subdirectory or domain.
- The current room is rendered as a `<span class="here" aria-current="page">` (not a
  link), positioned in the same spot in the list as its `<a>` on other pages.
- Each `<nav>` carries `aria-label="Relay rooms"`.
- `map.html` is reachable from the home directory only (shown as locked); it is
  deliberately left out of the room menus.

Per-room nav treatments (class on the `<nav>`):

| Page | nav style | class |
|---|---|---|
| orrin | synaptic pill switcher | `nav.cortex` |
| psyche | psychological case-file tabs | `nav.case-tabs` |
| climbing | Mountain-Project tab bar (white active pill) | `.topbar .roomnav` |
| training | Strava underline tabs | `.topbar .roomnav` |
| exploration | star-chart waypoints | `nav.starchart` |
| workbench | blueprint sheet-index chips | `nav.sheets` |
| captures | darkroom film strip | `nav.filmstrip` |
| log | newspaper section bar | `nav.sections` |
| index | terminal directory listing + `ls`/`open` commands | `#dir` |

**If you add, remove, or rename a room:** update the menu on **every** page, the
`PAGES`/`COMMANDS` maps and `#dir` listing in `index.html`, the table in `README.md`,
and this file. Keep the label set in sync everywhere.

## Projects and photos

- **Sub-projects** live in `projects/<name>/` (or a single `.html`) and are **linked
  from the room that fits them** — not given their own room. Current: `spacetime` →
  Exploration; `the-shape-of-harm`, `autism-reflection.html`, and
  `state-of-mind-line` → Psyche; `siege-conductor` → Workbench. Each is
  self-contained and may carry its own assets/fonts; the "no dependencies" rule is for
  the relay's own room pages, not embedded projects. Keep their internal links relative.
- **Every standalone project HTML page needs a visible route back to the relay.** Use
  `projects/relay-return.js` with the correct relative `src` and `data-home` paths so the
  fixed “← Ric's Relay” control works from desktop and mobile. The optional `data-egg`
  value may add a project-themed typed easter egg.
- **Photos** go in `photos/`, web-optimized (resize to ~1600px, convert HEIC→JPG). Do
  **not** commit full-res originals — they belong in `_photo-originals/`, which is
  gitignored. `captures.html` reads a `FRAMES` array; `climbing.html` rotates a few as
  a hero banner. If you add photos, optimize first (`sips -Z 1600 -s format jpeg …`).

## Editing content

Each page has a loudly-commented editable block near its content. To add a climb, a
photo, an activity, a project, a log entry — copy the example block in that page and
edit it. Homepage "transmissions" live in `notes.js`. Curated newest additions live
in `latest.js`; every room renders
that data as a banner in its own native style. `orrin.html` is self-updating — leave
its GitHub data logic alone unless fixing a bug. `systems.html` and `updates.html` are
legacy redirects, not rooms.

## House style

- Match the existing voice: playful, terminal/hacker flavor, easter eggs welcome
  (e.g. hidden `index.html` commands: `orrin`, `apex`, `sudo`, `coffee`, `exit`).
- Keep every easter egg discoverable in `EASTER_EGGS.md`. Sitewide visual modes belong
  in `effects.js`; preserve the reduced-motion fallback, room-to-room persistence,
  refresh-to-reset behavior, and the `sober` terminal command. Do not add a visible
  reset button or Escape-key exit unless Ric asks for one.
- Keep pages responsive — test at ~375px wide; nav bars must wrap, not overflow.
- Keep the palette and font already defined in each page's `:root` / `body`.
- Preserve `aria-current`, `aria-label`, `alt`, and `<title>`/`<meta name=description>`
  when you touch a page.

## Quick verification checklist before you finish

- [ ] All internal links resolve (files exist; current page marked `here`).
- [ ] The menu label set is identical across all room pages.
- [ ] Page still opens as a static file — no console errors, no external requests
      beyond the GitHub API calls that already exist.
- [ ] Looks right at mobile width.
- [ ] Didn't add location data, extra repos, or a build step.
