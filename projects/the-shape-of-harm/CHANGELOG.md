# Changelog

## v0.9b — 2026-07-23 (comprehension and navigation)

- **New front door: `start.html`.** Plain-language entry point built directly from
  `scores.csv` — no hand-copied numbers. Signature element is a spread chart: one row per
  drug, five colour-coded criterion scores, each with its plausible range, ordered by the
  equal-weight mean and explicitly labelled as one weighting among many.
- **Public thesis fixed.** The takeaway is *every substance here carries real harm, and
  they differ enormously in kind and degree* — not "all of these are dangerous", which the
  data contradicts (equal-weight means run 6.0 to 79.0) and which the project's own
  prohibited-claims list forbids.
- **Withheld scores are now visible.** Methamphetamine / damage to others has a suspended
  value; the chart labels it "withheld" rather than dropping the row or implying zero.
  A validator assertion now fails if any blank score is silently omitted.
- **Navigation standardised** across all 11 pages: every page keeps its own in-page
  anchors, then carries the same site-level nav. `404.html` now offers real routes.
  `index.html` gained a front-door banner.
- **Added validator assertions:** front door exists with required framing, every page
  reaches both the front door and the current gate, and blanks are never rendered as zero.
- No scientific estimate changed.

## v0.9 — 2026-07-23 (corrections)

- **Outcome status corrected.** The one released estimate (0/67 investigator-attributed
  drug-related SAE, 95% exact upper limit 53.6 per 1,000) is now labelled everywhere as a
  **secondary, attribution-based outcome**. Under v0.8 RT-002 the primary serious-event
  outcome is all-cause SAE, which the current corpus cannot support. The number did not
  change; its status did. Previously it was presented with primary-result framing.
- **PSIPET provenance resolved.** The v0.4 changelog referenced "the 2026 PSIPET trial",
  which appeared in no registry row. PSIPET is the study code for NCT04630964 (Karolinska,
  phase 2b, 25 mg psilocybin vs 100 mg niacin) — the same record the registry cites as
  Yngwe 2026. The two names were never linked. `candidate-study-registry.csv` now carries a
  `study_acronym` column so registry IDs, publication citations, and study codes reconcile.
- **Document status made explicit.** Superseded documents were shipping alongside current
  ones with no marker. They are *not* moved to an archive directory because live pages and
  validators still link them; instead every superseded file carries a deprecation banner
  naming its successor, and `document-status-register.csv` records the status of each.
  Hash-locked files are exempt from editing by design — their status is recorded in the
  register only.
- **Verification log rescoped.** `source-verification-log-v0.7.csv` said
  "verified_public_record", which reads as "someone read the paper". It now states
  explicitly that this was a metadata-level horizon scan with no full-text read.
- **Navigation repaired.** `index.html` now reaches hardening, certainty, replication,
  feasibility, and launch. `hardening.html` now links back into the rest of the site.
- **Added validator assertions:** status register resolves, no two live files claim the same
  role, the v0.8 hash manifest verifies, and the released estimate is declared secondary.
- `__pycache__` removed; `.gitignore` added.
- No scientific estimate changed.

## v0.8 — 2026-07-23

- Completed an author-side methodological red-team before registration.
- Split the psilocybin review into randomized comparative effects and a descriptive monitored-exposure safety inventory.
- Made all-cause serious adverse events primary and attribution-based serious events secondary.
- Added explicit seriousness-versus-severity, zero-versus-not-reported, denominator, ascertainment, onset, and resolution rules.
- Added a broad safety-capture search requirement without a harms filter.
- Replaced overbroad reviewer “blinding” language with decision concealment.
- Added synthesis-level missing-evidence assessment, a statistician sign-off gate, participant/public content review, and formal AI-assistance disclosure.
- Added `hardening.html`, protocol v0.3, a 20-finding red-team register, outcome taxonomy, evidence strata, and analysis decision rules.
- No scientific estimate changed.

## v0.7 — 2026-07-23

- Reconciled a material corpus inconsistency: v0.6 metadata/RIS claimed 13 seed records while the CSV contained four.
- Rebuilt `candidate-study-registry.csv` with all 13 records.
- Added a detailed evidence corpus, source-verification log, and study-family registry.
- Added search execution, deduplication/linkage, data-management/blinding, PRESS-request, and reviewer-recruitment documents.
- Added a machine-readable launch gate and guarded reviewer-packet builder.
- Added `launch.html` and v0.7 integrity validation.
- No scientific estimate changed.

## Research Framework v0.5 — 23 July 2026

- Added a provisional outcome-level GRADE evidence profile for the direct psilocybin serious-event result.
- Separated certainty in the observed count from certainty in the underlying risk.
- Rated the underlying risk estimate very low certainty provisionally: one downgrade for risk of bias and two for imprecision.
- Added leave-one-study-out and missed-event sensitivity analyses.
- Added exact zero-event information-size targets; 368 total exposed participants are needed for a two-sided 95% upper limit below 10 per 1,000 if no events occur.
- Added explicit permitted and prohibited claim rules.
- Added a review-readiness checklist aligned with PRISMA 2020, PRISMA-Harms, RoB 2, and GRADE.
- Added `certainty.html` and reproducible machine-readable files. Independent adjudication remains mandatory.

## Research Framework v0.4 — 23 July 2026

- Completed a single-author pilot screening and extraction for the controlled 25 mg psilocybin estimand.
- Added the 2026 PSIPET randomized trial to the direct MDD evidence stratum.
- Kept treatment-resistant-depression studies in a separate indirect stratum.
- Released one narrow estimate: 0/67 investigator-attributed drug-related serious adverse events, with a 95% exact upper limit of 53.6 per 1,000.
- Blocked all-cause SAE, exact seven-day severe psychiatric-event, and rescue/extended-observation estimates because published units or windows are incompatible.
- Added a transparent implementation note rather than changing the original seven-day estimand after inspecting results.
- Added screening, extraction, synthesis, search-log, and preliminary RoB 2 files plus a reproducible analysis script.
- Added `evidence.html`; independent duplicate review and complete database searching remain mandatory.

## Research Framework v0.3 — 23 July 2026

- Completed an author data-feasibility screen for all four pilot estimands.
- Blocked unsupported episode-risk releases and froze the first psilocybin review protocol.
