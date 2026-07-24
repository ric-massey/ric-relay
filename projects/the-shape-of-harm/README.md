# The Shape of Harm — Research Framework v0.8

**Current gate:** methodological hardening before registration. The psilocybin protocol now separates randomized comparative effects from a descriptive monitored-exposure safety inventory, makes all-cause serious events primary, distinguishes confirmed zero from unreported outcomes, and adds statistical, participant/public, and AI-governance controls.

See `hardening.html`, `METHODOLOGICAL_RED_TEAM_V0.8.md`, and `PSILOCYBIN_INDEPENDENT_REPLICATION_PROTOCOL_V0.3.md`.


Thirteen substances scored across five kinds of harm, with an interactive weighting
model, per-cell evidence grades, and a reproducible analysis.

## What's in here

| File | What it is |
|---|---|
| `index.html` | **The page.** Open it in any browser. Self-contained — all code and data are embedded, so it works offline apart from the web fonts. Named `index.html` so it serves as the site root. |

The ranking is shown as **bands**, not tiers: a band holds a group only where every
pair inside it stays below the 90% separation threshold (complete linkage), and it is
a reading aid rather than a statistical stratum — across all 100,000 integer slider
settings the grouping takes 92 distinct shapes. Any specific pairwise claim belongs to
the **Compare two substances** control under the chart. Two top-level lenses are
offered: the *combined model* (all five columns) and *harm to the person using* (the
damage-to-others column removed outright rather than down-weighted).

The page is a single file but reads as nine sections, one at a time. The landing page
is about 900 words — the ranking, a short quiz, and links onward. The remaining 17,000
words sit behind those links. Each section has its own URL (`#safety`, `#weaknesses`,
`#sources` and so on), so they can be linked to directly and the back button works.
| `scores.csv` | All 65 cells: score, evidence grade, uncertainty interval, and the specific basis for each one. |
| `references.json` | The 49 sources, structured, each with a note on what it supports. |
| `weighting.json` | Criteria, the four weight presets, and every simulation parameter. |
| `reproduce.py` | Regenerates every headline figure from the three data files. Standard library only. |
| `stability-simulation.js` | Standalone reference implementation of the rank-stability analysis, matching the copy embedded in the page. |
| `evidence-audit.csv` | Cell-by-cell audit of all 65 legacy scores: construct fit, denominator problems, and the appropriate v6 destination. |
| `instrument-v6.json` | Machine-readable design specification for the next model. It is intentionally unscored and unvalidated. |
| `INSTRUMENT_AUDIT_2026-07-23.md` | Full evidence and instrument-design audit, including the proposed development and validation protocol. |


## Evidence-audit status

The interactive chart is now explicitly labelled **legacy model v5**. A July 2026 audit found that some sources are accurately quoted but assigned to the wrong construct: withdrawal prevalence was used as medical danger, acute cocaine myocardial-infarction evidence was used as chronic bodily damage, and a selected survey of difficult psilocybin experiences was treated like a general episode rate. The audit also found that benzodiazepine use disorder, physical dependence, and withdrawal hazard must be represented separately.

The project therefore does **not** silently rewrite a handful of scores and call the result more accurate. Model v6 first separates:

- one-episode acute medical and behavioral/psychiatric outcomes;
- regular-use chronic outcomes per user-year;
- population burden in a named region and year; and
- modifiers such as use-disorder probability, physical dependence, withdrawal hazard, route, co-use, setting, and supply uncertainty.

See `INSTRUMENT_AUDIT_2026-07-23.md`, `evidence-audit.csv`, and `instrument-v6.json`. Until v6 is systematically reviewed, independently scored, and validated, its status is **design specification only**.

## Reproducing the analysis

```
python3 reproduce.py
```

No dependencies. It rebuilds the ranking under each weight preset, the composite
intervals, the pairwise-overlap count, the correlations with Nutt 2010 and the
Canadian MCDA 2026, the rank-stability sensitivity analysis, and a reference audit.

**Anything it prints that disagrees with the page means the page is wrong.** That
check has already earned its place once: suspending methamphetamine's damage-to-others
cell moved two correlations, and the script caught that the page was still quoting
the old figures.

To check the JavaScript implementation against the Python one:

```
node stability-simulation.js
```

The two should agree within about one percentage point — they use different random
number generators, so exact agreement isn't expected.

## If you publish this

Drop the whole folder into a web root. `index.html` will be served automatically;
the other files sit alongside it and the page links to each of them by relative
path, so the "published alongside it" claim is only true if you deploy the whole
directory. The HTML renders correctly on its own, but the reproducibility claim
depends on the data files being reachable.

### Netlify

The repo deploys as-is — no build step, no dependencies, no framework.

| Setting | Value |
|---|---|
| Build command | *(leave empty)* |
| Publish directory | `.` |

`netlify.toml` sets this already, so connecting the repo and accepting the
detected settings is enough. It also:

- **turns off post-processing** (`skip_processing = true`). All the CSS and JS is
  inline and hand-written; Netlify's minifiers occasionally mangle template and
  regex literals, and there is no build step to re-run if they do.
- serves `scores.csv` and the two JSON files with real content types and
  `must-revalidate`, so they open in a tab instead of downloading as a blob and
  never go stale against the page.
- sets `nosniff`, `SAMEORIGIN`, and a restrictive `Permissions-Policy`.

**There is deliberately no SPA redirect rule.** Routing is entirely hash-based
(`#ranking`, `#safety`, `#w=5,5,5,5,5`) and the page never calls
`history.pushState` with a path, so a `/* -> /index.html 200` rule would buy
nothing and would hide genuine 404s.

Before going live, replace the placeholder domain in the `og:url`, `og:image`,
`twitter:image` and `canonical` tags at the top of `index.html` — they currently
point at `shape-of-harm.netlify.app`. Social cards will not render until
those are absolute URLs on the real domain.

## What this is

An evidence-informed exploratory multi-criteria decision analysis by a single
author, and an interactive argument about why "the most harmful drug" is a question
with more than one answer.

**It is not a validated instrument.** Section 10 of the page collects every known weakness in one place — twenty-six of them, grouped by whether they are absences in the evidence base itself, structural, evidential or a gap in validation, with a future-work list ordered by value per unit of effort. In summary: of the 65 cells, 21 rest on a drug-specific
measured figure, 19 on a class proxy or extrapolation, 24 on judgment alone, and
one has been suspended for lack of any defensible value. Forty-one of the 78
pairwise comparisons between drugs have overlapping intervals, which means roughly
half the ordering is not distinguishable from noise.

Reproducibility is not validity. These files let someone else get the same numbers
from the same inputs. They say nothing about whether the inputs are right.

Section 10 of the page sets out what a validated version would require — a
preregistered protocol, criteria redesigned to remove overlap, a systematic evidence
review, a multidisciplinary panel scoring independently, and replication by a second
group. Almost none of that is done.

## Source verification

`references.json` records, per entry, whether it was opened and checked against the
primary source. **16 of 49 have been. 33 have not.** Unverified entries carry figures
compiled from the literature without a second pass — accurate to the best of one
author's reading, not confirmed.

Re-checking has already found real errors: a caveat from Gable's own abstract that the
page had omitted from a whole section built on his ratios, and two plotted values that
turn out not to be in the paper cited for them. Both were inherited by not looking
closely enough rather than invented. Checking the remaining 33 is the most valuable
work available on this project.

## Safety

The page opens with harm-reduction information, deliberately, rather than burying it
at the end. If you are reading this because the subject is more than academic: the
numbers describe populations rather than people, interactions are where most harm
actually happens, and withdrawal from alcohol or benzodiazepines can be fatal without
medical supervision.

SAMHSA National Helpline — **1-800-662-4357**. Free, confidential, 24/7, English and
Spanish, for families as well as for people using. Treatment search at
findtreatment.gov. For a mental health crisis, call or text **988**.


## Structural safeguards

The deployment now fails open rather than fail closed: the article is readable by default, and JavaScript hides inactive sections only after the ranking, router, comparison control, and reference count pass a runtime self-check. A startup failure leaves all sections visible with a warning instead of producing a blank page.

Deep links to views and individual targets are supported. URLs such as `#safety`, `#r43`, and shared `#w=...` weightings open the correct content directly and retain the exact fragment for copying and browser history.

Before deploying an edit, run:

```bash
python3 validate_site.py
node --check stability-simulation.js
```

`version.json` identifies the deployed build. Opening `/version.json` on the live site is the quickest way to confirm that Netlify is serving the intended upload.

## Research Framework v0.5 — estimands, feasibility, evidence, and certainty

The next methodological step is now implemented rather than left as a roadmap item. Four exact pilot questions are provisionally frozen for feasibility and content-validity review:

- a 60 g regulated-alcohol community episode with 24-hour acute outcomes;
- continued smoking of 20 cigarettes/day versus complete cessation over 10 years;
- an intranasal episode involving an unverified product sold as an opioid in the 2024 U.S. illicit market; and
- controlled 25 mg oral synthetic psilocybin versus placebo with seven-day safety follow-up.

They are intentionally **not ranked together**. Each occupies a declared comparability class and tests a different methodological problem. The package now includes:

| File | Purpose |
|---|---|
| `estimands.html` | Readable scientist-facing page for the four exact questions and their interpretation limits. |
| `PILOT_ESTIMANDS_V0.2.md` | Full estimand definitions, feasibility decisions, and content-review requirements. |
| `estimand-registry.csv` | One machine-readable row per estimand. |
| `estimands-v0.2.json` | Versioned structured registry and change-control rules. |
| `estimand-content-validity-form.csv` | Blank independent-review form covering relevance, clarity, overlap, time windows, estimability, and omitted contexts. |
| `RESEARCH_PROTOCOL_V0.2.md` | Updated protocol incorporating the frozen questions and next release gate. |
| `ESTIMAND_IMPLEMENTATION_AUDIT.md` | Exact implementation status, verification, and remaining scientific limits. |

“Provisionally frozen” does not mean scientifically validated. It means that feasibility searches must answer the registered questions and that material changes require a new version rather than silent editing after results are seen.


## v0.3 feasibility stage

Open `feasibility.html` first for the go/hold/block decisions. The first frozen empirical-review protocol is `PSILOCYBIN_SAFETY_REVIEW_PROTOCOL_V0.1.md`. This phase is an author feasibility screen, not independent validation.


## v0.4 evidence pilot

Open `evidence.html` for the single-author psilocybin pilot synthesis. It is deliberately not labeled a completed systematic review. The exact machine-readable trail is in `psilocybin-search-log.csv`, `psilocybin-screening-log.csv`, `psilocybin-data-extraction.csv`, `psilocybin-outcome-synthesis.csv`, and `psilocybin-rob2-pilot.csv`.


### v0.5 certainty gate

The controlled-psilocybin pilot now includes an outcome-level provisional certainty assessment. The direct trials observed 0 drug-related serious adverse events among 67 exposed participants — an **attribution-based secondary outcome** under v0.8, not the primary all-cause serious-event outcome, which the current corpus cannot support — but the two-sided 95% exact upper limit is 53.6 per 1,000. The underlying risk estimate is therefore rated **very low certainty, provisionally**, after downgrading for risk of bias and very serious imprecision.

Open `certainty.html`. Supporting files are `CERTAINTY_AND_INFORMATION_ANALYSIS_V0.1.md`, `grade-evidence-profile.csv`, `rare-event-sensitivity.csv`, `information-size-targets.csv`, `review-readiness-checklist.csv`, `psilocybin-certainty.json`, and `analyze_certainty.py`. This author assessment is a handoff for independent reviewers, not a completed GRADE adjudication.


## v0.8 methodological hardening

Version 0.8 does not change the pilot safety result. It corrects the prospective review architecture before registration. Product A estimates randomized comparative effects; Product B inventories harms observed across prospectively monitored 25 mg administrations without making a causal claim. All-cause serious adverse events now precede investigator-attributed events. The expanded extraction schema records seriousness, severity, ascertainment, onset, resolution, denominator type, and whether zero was actually confirmed.

The 13-record author horizon corpus is retained as a workflow test but is explicitly incomplete for the new Product B scope. It must be replaced by the registered focused and broad searches, not extended by hand-picking studies.
