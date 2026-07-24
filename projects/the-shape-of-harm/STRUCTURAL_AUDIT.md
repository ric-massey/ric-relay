# Structural Audit — The Shape of Harm

Build: `2026-07-23-evidence-audit-1`

## Scope

This audit covers the website's code, routing, accessibility structure, deployment layout, and failure behavior. It does **not** claim that every scientific score, source interpretation, or methodological weakness has been resolved.

## Problems fixed

### 1. Startup dependency crash

The comparison control executed before `CONF`, `SIM_SD_BY_GRADE`, and `SIM_BIAS_SD` had been initialized. JavaScript stopped with a temporal-dead-zone error.

**Fix:** all evidence and uncertainty constants now exist before any immediate render path can reach them.

### 2. Blank-page failure mode

Every `.view` was hidden by default. The page became visible only after JavaScript completed, so any runtime error left the entire site blank.

**Fix:** the document now fails open. All article sections are readable by default. Inactive views are hidden only after the ranking, router, comparison control, reference count, and model invariants pass a runtime self-check.

### 3. No startup error boundary

There was no user-visible indication when the interactive layer failed.

**Fix:** a small independent error boundary catches startup errors, leaves the article visible, and displays a readable warning with a technical detail.

### 4. Order-dependent initialization without verification

Several controls and generated sections initialized immediately at top level. A silent partial boot was possible.

**Fix:** the final boot now runs `validateRuntime()` before applying the `app-ready` state. It verifies 13 substances, five criteria, unique names, score ranges, evidence maps, 13 rendered rows, one selected view, 49 references, and a populated comparison result.

### 5. Broken direct deep links

A link such as `#r43` worked when clicked inside the page but not when opened directly. The router treated unknown hashes as the ranking page.

**Fix:** the router now resolves any real element ID, opens the view that owns it, and scrolls to the exact target.

### 6. Exact reference URL was discarded

Clicking a source reference rewrote the URL to `#sources`, losing the actual `#r43` target and weakening browser history and shareability.

**Fix:** exact target fragments remain in the URL, are added to browser history, and work when copied or reopened.

### 7. Weak document landmarks

The page lacked a `<main>` landmark and a keyboard skip link.

**Fix:** the views now sit inside `main#main-content`, with a visible-on-focus “Skip to main content” link.

### 8. Heading hierarchy gaps

The Weaknesses and Sources views had no `<h1>`, and the Safety view jumped from `<h1>` to `<h4>`.

**Fix:** every view has a coherent visible primary heading, and the Safety subheads use the correct level.

### 9. Navigation state was visual only

The selected navigation item had a CSS class but no semantic state.

**Fix:** the active section now receives `aria-current="page"`.

### 10. Buttons relied on browser defaults

Every `<button>` omitted `type="button"`. That is harmless today because there is no form, but becomes a submission bug if a form is ever introduced around a control.

**Fix:** every static and generated button has an explicit type.

### 11. Root caching rule was incomplete

`/index.html` was marked `must-revalidate`, but the normal `/` request did not have an explicit matching rule.

**Fix:** both `/` and `/index.html` now revalidate.

### 12. No easy way to identify the deployed build

An old successful Netlify deploy could look like the current project with no simple machine-readable check.

**Fix:** `/version.json` reports the build ID, canonical URL, and expected counts. The HTML includes the same build marker.

### 13. No structural pre-deploy check

There was no single command to catch broken fragments, duplicate IDs, count drift, stale domains, missing landmarks, untyped buttons, mismatched references, or score/evidence drift between the embedded model and `scores.csv`.

**Fix:** run:

```bash
python3 validate_site.py
```

The validator uses only the Python standard library.

### 14. Generic missing-page behavior

There was no project-specific 404 page.

**Fix:** `404.html` explains the hash-based section URLs and returns the reader to the site root.

### 15. Search/deployment metadata

The canonical and social URLs used the wrong hostname in the uploaded version, and there was no sitemap declaration.

**Fix:** all absolute metadata uses `https://shape-of-harm.netlify.app/`; `sitemap.xml` and the corresponding `robots.txt` entry are included.

## Verification performed

The rebuilt site passed 31 browser checks:

- zero JavaScript runtime errors during a normal boot
- verified `app-ready` boot
- exactly one visible routed view after startup
- all 13 ranking rows rendered
- comparison control initialized and updated
- sliders rerendered the ranking
- expandable drug profiles worked and reported `aria-expanded`
- direct `#r43` links opened the Sources view
- clicked references retained their exact hash
- Weaknesses and Sources had visible `<h1>` headings
- mobile viewport had no document-level horizontal overflow
- no-JavaScript mode left all nine sections readable
- a deliberately forced startup crash left all nine sections readable and showed the error warning

The analytical files were also rerun successfully:

```bash
python3 reproduce.py
node stability-simulation.js
```

## Intentional design choices retained

### Single-file application

`index.html` still contains the CSS, application code, and most presentation data. That is large, but it preserves the project's useful “open one file and it works” property and avoids adding a build system. The new error boundary, fail-open rendering, runtime self-check, and validator remove the dangerous parts of that choice.

### Embedded model plus published data files

Scores and evidence grades exist both in the offline page and in `scores.csv`. This duplication is retained so the page works without a server. `validate_site.py` now compares every embedded score and evidence grade against the CSV, preventing silent drift.

### External fonts

Google Fonts remain optional. The page has local serif and monospace fallbacks and remains readable if the font request fails.

## Remaining non-code work

The site's own Known Weaknesses section describes methodological and evidential limitations that cannot be repaired by a website refactor: broad substance categories, overlapping criteria, judgment-scored cells, incomplete source verification, lack of independent panel scoring, and lack of external validation. Those require research and instrument redesign rather than deployment fixes.


## Evidence-audit revision

Build `2026-07-23-evidence-audit-1` keeps the structurally hardened v5 application but labels it as a legacy exploratory model. It adds a 65-cell evidence audit, an unscored v6 design specification, and a full instrument-development memo. The uncertainty control has also been moved immediately above the graph and remains sticky so the control and visual stay in the same viewport.

This revision deliberately does not overwrite the v5 scores. The evidence review found construct and denominator mismatches that must be repaired before a defensible rescore.
