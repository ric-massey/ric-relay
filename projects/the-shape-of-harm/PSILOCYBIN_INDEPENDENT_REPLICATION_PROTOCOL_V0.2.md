# Independent Replication Protocol v0.2 — Controlled 25 mg Psilocybin Safety in Major Depressive Disorder

**Linked estimand:** EST-AE-PSI-001  
**Protocol date:** 23 July 2026  
**Status:** Frozen package prepared for prospective registration of the **independent replication phase**.  
**Critical disclosure:** A single-author pilot search, extraction, and provisional synthesis already occurred. This document cannot retroactively preregister that pilot. The independent reviewers must make first-pass decisions without seeing the pilot decisions or results.

## Review identity

This is an outcome-specific systematic review of harms after one 25 mg oral dose of synthetic psilocybin administered to screened adults with major depressive disorder in a structured clinical setting. It is not a review of recreational psilocybin, natural mushrooms, efficacy, or all psychedelic therapy.

## Primary review question

Among adults aged 21–65 with major depressive disorder who meet contemporary controlled-trial eligibility criteria, what are the 0–24-hour and 0–7-day risks of prespecified serious medical and severe psychiatric or behavioral outcomes after one 25 mg oral dose of synthetic psilocybin with preparation, continuous monitoring, and post-session support, compared with placebo, active placebo, or a minimal-dose control delivered with comparable support?

## What is fixed before independent work begins

- The linked estimand and comparability class.
- Primary direct stratum: MDD, single 25 mg oral synthetic psilocybin, monitored setting, controlled design.
- Indirect strata are separate: TRD population, materially different dose, repeated dosing, or incompatible comparator.
- Outcomes and time windows.
- Duplicate independent screening, extraction, and result-level RoB 2.
- Exact binomial study-level risks; no continuity correction that turns zero events into evidence of zero risk.
- No pooling across direct and indirect strata.
- No universal 0–100 score or cross-context safety claim.

## Eligibility

### Primary direct stratum

Include controlled studies in adults with MDD when a single 25 mg oral synthetic-psilocybin arm is separable, dosing occurs with structured preparation and monitoring, and arm-level safety observation covers at least 24 hours. Full publications, registry results, regulatory reports, and sponsor reports may contribute when methods and denominators are adequate.

### Prespecified indirect strata

Retain but do not silently pool studies differing in one or more of the following: TRD rather than broader MDD; dose other than 25 mg; weight-adjusted dose; repeated dosing; delayed-treatment or active-treatment comparator; fixed-order design. Each indirectness reason is coded explicitly.

### Exclude

Unsupervised or natural-mushroom exposure; no separable MDD/TRD group; no separable safety denominator; open-label evidence from the primary comparative estimate; nonhuman studies; editorials and narrative reviews; reports without unique study data.

## Outcomes

1. Drug-related serious adverse event under the study or regulatory definition.
2. All-cause serious adverse event.
3. Death.
4. Hospital or emergency transfer.
5. ICU-level care or organ support.
6. Severe anxiety, panic, psychotic, manic, dissociative, or behavioral event requiring rescue medication, extended observation, restraint, transfer, or hospitalization.
7. Self-harm, suicide attempt, or sustained clinically important worsening.
8. Rescue medication and extended observation as process outcomes.

Report 0–24 hours and >24 hours to 7 days separately where possible. Longer follow-up is retained as secondary safety context, never substituted silently for an exact-window denominator.

## Search

Search MEDLINE, Embase, APA PsycINFO, CENTRAL, ClinicalTrials.gov, WHO ICTRP, Scopus or Web of Science, backward citations, forward citations, sponsor/regulatory sources, and author contacts. Search from database inception to the final search date, without language restrictions. Execute the exact strategies in `search-strategies-v0.6.csv` only after PRESS-style peer review by an information specialist. Export full strategies, dates, counts, and records.

### Amendment from protocol v0.1

The 2018 lower date limit is removed. This change was made before the independent search to increase recall and because eligibility already controls relevance. The author pilot had already seen some results, so the amendment is disclosed rather than described as outcome-blind.

## Independent workflow

Reviewer 1 and Reviewer 2 screen every record independently. They cannot view each other's decisions or the author-pilot inclusion/extraction fields until their first-pass task is locked. Conflicts go to an adjudicator. The same independence rule applies to extraction and result-level RoB 2.

Study reports are linked into study families; duplicate publications are not double-counted. Every excluded full text receives one prioritized reason from `full-text-exclusion-codes.csv`.

## Data extraction

Use `independent-data-extraction-form.csv`. Extract randomized, dosed, and analyzed denominators separately; exact dose and number of administrations; preparation/monitoring/support; event definitions; attribution; event window; arm-level counts; missing data; rescue medication; observation extensions; transfers; suicidality; severe anxiety; registry-publication discrepancies; funding; sponsor role; and conflicts.

## Risk of bias

Use RoB 2 at the result level. Functional unblinding is analyzed through plausible pathways into deviations, outcome measurement, and selective reporting; it is not automatically equated with high risk. Investigator attribution of “drug-related” events is treated as a potentially subjective measurement process. Registry and protocol discrepancies are documented before judgment.

## Synthesis

- Report arm-level events and denominators before any model.
- Use exact Clopper–Pearson intervals for study-level absolute risks.
- Report risk differences only when comparator definitions and windows are compatible.
- Pool direct studies only when population, dose, number of administrations, setting, outcome definition, attribution, and window are sufficiently aligned.
- With sparse zero-event evidence, favor study-level reporting and transparent bounds over unstable pooled relative effects.
- Prespecified sensitivity analyses: leave-one-study-out; one and two potentially missed/reclassified events; alternative inclusion of unclear attribution; direct-only versus each indirect stratum; exact-window versus complete-follow-up safety reports.
- Do not estimate heterogeneity from too few informative events.

## Certainty

GRADE each outcome and stratum separately. The provisional author rating is not shown to independent certainty reviewers until their first-pass domain judgments are locked. The final package preserves both reviewer judgments, conflicts, and adjudication rationale.

## Missing evidence

Search completed, terminated, withdrawn, and no-results registry records. Compare registry/protocol outcomes with publications. Contact investigators or sponsors for missing arm-level 7-day counts and clarify severe-event attribution. Missing evidence may block an estimate.

## Registration and transparency

Submit the independent replication prospectively to PROSPERO if eligible and create a time-stamped OSF registration containing this protocol, the search strategies, forms, analysis code, and cryptographic manifest. PROSPERO and OSF submission require a real review team and cannot be completed by the website author alone.

## Stopping and interpretation rules

“Insufficient evidence for a precise risk” is a valid result. Zero observed events must not be translated into “risk is zero,” “proven safe,” recreational-use safety, or a universal drug-harm score.

## Deviations

Any post-lock change receives a dated entry in `protocol-deviations.csv` stating whether it occurred before or after affected results were visible, who approved it, and which outputs were rerun.
