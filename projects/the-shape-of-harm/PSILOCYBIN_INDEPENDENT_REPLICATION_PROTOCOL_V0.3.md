# Independent Replication Protocol v0.3 — Controlled 25 mg Psilocybin Harms in Major Depressive Disorder

**Linked estimand:** EST-AE-PSI-001  
**Protocol date:** 23 July 2026  
**Status:** Author-hardened draft awaiting information-specialist, statistical, participant/public, and independent-review approval before prospective registration.  
**Critical disclosure:** A single-author pilot search, extraction, and provisional synthesis already occurred. This protocol governs a new independent phase and cannot retroactively preregister the pilot.

## 1. Review identity

This is an outcome-specific systematic review of harms after one 25 mg oral dose of synthetic psilocybin administered to screened adults with major depressive disorder in a structured clinical setting. It does not estimate recreational-use risk, natural-mushroom risk, efficacy, or a universal drug-harm score.

## 2. Two linked evidence products

### Product A — comparative safety effect

**Question:** Among eligible adults with MDD, what is the effect of assignment to one monitored 25 mg psilocybin administration versus a compatible placebo, active placebo, or minimal-dose control on prespecified harms?

- Primary design: randomized controlled trials.
- Primary effect estimand: intention-to-treat effect of assignment where available.
- Primary measures: arm-level absolute risk and risk difference.
- Comparator classes are not pooled automatically.

### Product B — monitored-exposure safety inventory

**Question:** Among prospectively followed participants receiving one monitored 25 mg psilocybin administration, what prespecified harms were observed, how were they ascertained, and what denominator supports each observation?

- Eligible designs: intervention arms from randomized trials plus prospective nonrandomized monitored cohorts with an explicit dosed denominator.
- Purpose: event detection and descriptive incidence under the studied clinical conditions.
- Prohibited inference: no causal comparison and no automatic generalization beyond the enrolled population and monitoring model.
- Results are stratified by population, design, ascertainment method, sponsor, and regimen.

The products are reported separately. Nonrandomized cohorts never enter the randomized comparative estimate.

## 3. Population and intervention

### Direct population

Adults aged 21–65 with unipolar major depressive disorder meeting contemporary controlled-trial eligibility criteria. Treatment-resistant depression is retained as an indirect population stratum, not silently pooled with broader MDD.

### Direct intervention

One 25 mg oral dose of synthetic psilocybin with documented preparation, continuous or protocol-defined monitoring during the acute session, and post-session support.

### Regimen exclusions from the direct stratum

Weight-adjusted dosing, doses other than 25 mg, repeated administrations, natural mushrooms, unsupervised exposure, or materially different support models. These may enter explicit indirect or contextual strata.

## 4. Outcome hierarchy

### Primary outcomes

1. All-cause serious adverse event.
2. Death.
3. Emergency transfer, hospitalization, ICU-level care, or organ support.
4. Severe psychiatric or behavioral event requiring rescue medication, extended observation, restraint, emergency transfer, or hospitalization.
5. Self-harm, suicide attempt, or sustained clinically important worsening requiring intervention.

### Secondary outcomes

6. Investigator-attributed treatment-related or drug-related serious adverse event.
7. Mania, psychosis, severe dissociation, panic, or prolonged severe anxiety, each reported separately when possible.
8. Rescue medication and extended observation as process outcomes.
9. Any treatment-emergent adverse event and severe non-serious adverse event, preserving the study definition.

### Seriousness and severity

Seriousness and severity are extracted independently. Study definitions are preserved verbatim and mapped to the outcome taxonomy without overwriting the source definition.

## 5. Time windows

- Acute: dosing start through 24 hours.
- Early delayed: greater than 24 hours through day 7.
- Longer follow-up: retained as secondary context.

For every event, extract onset time, resolution time, and ascertainment time when available. An event beginning during dosing and persisting after 24 hours is not double-counted. Reports with an overlapping but nonseparable window are retained as indirect-by-window evidence and never silently treated as exact-window data.

## 6. Event unit, denominator, and reporting status

- Primary unit: participants with at least one event.
- Primary denominator: participants who received the assigned administration and were included in the relevant safety observation window.
- Randomized, dosed, safety-population, and observed-at-window denominators are extracted separately.
- Event counts may be reported additionally but are not substituted for participant risks.
- Every outcome is coded as: confirmed zero; event observed; explicitly assessed but numerical count unavailable; mentioned without systematic assessment; or not reported.
- Blank values never mean zero.

## 7. Eligibility by product

### Product A

Include randomized controlled studies with a separable 25 mg arm, compatible comparator, documented monitored setting, and arm-level safety observation for at least 24 hours.

### Product B

Include Product A intervention arms and prospective monitored single-arm or nonrandomized cohorts with a separable 25 mg single-administration group and explicit dosed denominator. Open-label evidence contributes only to the descriptive inventory.

### Exclude from both products

Retrospective self-report surveys, unsupervised exposure, natural-mushroom exposure, case reports without a denominator, no separable relevant population, no separable 25 mg single-dose group, nonhuman studies, narrative reviews, and records without unique study data.

Case reports and pharmacovigilance signals may be catalogued outside the denominator-based products as signal context, clearly separated from incidence estimates.

## 8. Search strategy

Search from database inception to the final search date without language restrictions.

### Focused review search

MEDLINE, Embase, APA PsycINFO, CENTRAL, ClinicalTrials.gov, WHO ICTRP, and a citation index using psilocybin/psilocin/COMP360 concepts combined with depression concepts. Do not add a harms filter.

### Broad safety-capture search

Run a second high-recall psilocybin/psilocin/COMP360 search without a depression term to identify prospective monitored studies, clinical study reports, regulatory documents, companion safety publications, and mixed-population reports that may contain a separable MDD group or reveal missing safety material.

### Other sources

Backward and forward citations, trial registries and histories, protocols, supplements, sponsor clinical-study reports where available, regulatory reviews, conference records, and investigator/sponsor contact.

All strategies require PRESS-style peer review before registered execution. Exact queries, dates, platforms, counts, exports, and hashes are retained.

## 9. Study-family linkage and provenance

Multiple reports from one study are linked into a study family before analysis. Protocols, registry histories, primary reports, follow-ups, secondary analyses, supplements, and regulatory documents are not counted as separate participant samples. Conflicting reports are preserved and adjudicated rather than overwritten.

## 10. Independent workflow and decision concealment

Two reviewers independently screen, extract, and assess randomized-result risk of bias. Neither sees the other reviewer's decisions or the author pilot's decision fields until the relevant first pass is locked. An adjudicator resolves conflicts.

This is decision concealment, not true blinding to public trial knowledge or results.

## 11. Data extraction

Use `independent-data-extraction-form-v0.8.csv`. Extract at minimum:

- report and study-family identifiers;
- design, sites, dates, population, exclusions, and recruitment source;
- randomized, dosed, safety, and observed denominators;
- formulation, dose verification, number of administrations, preparation, monitoring, and support;
- comparator formulation and support;
- exact outcome definition, seriousness criteria, severity scale, attribution rule, coding dictionary, and ascertainment method;
- onset, resolution, observation window, participant counts, event counts, and missing data;
- whether zero was explicitly confirmed;
- rescue procedures, transfer, hospitalization, suicidality, mania, psychosis, panic, severe anxiety, and persistent symptoms;
- protocol, registry, publication, supplement, and clinical-study-report discrepancies;
- funding, sponsor role, investigator conflicts, and data access.

## 12. Risk of bias and evidence limitations

### Product A

Use the official RoB 2 tool at the result level for the effect of assignment to intervention. Functional unblinding is evaluated through specific pathways into deviations, outcome measurement, and selective reporting. Investigator attribution is treated as a subjective measurement process.

### Product B

Do not label the descriptive inventory “low risk of bias” using RoB 2. Instead, report design limitations explicitly: selection, eligibility restrictions, ascertainment intensity, completeness of follow-up, outcome-definition quality, selective reporting, sponsor involvement, and transportability. A methodologist must approve any formal appraisal tool before registration.

### Missing evidence

Use a synthesis-level missing-evidence assessment compatible with ROB-ME concepts. Compare registries, protocols, statistical analysis plans, publications, supplements, regulatory material, and sponsor responses. Distinguish unreported outcomes from confirmed zero events.

## 13. Synthesis and analysis rules

- Present study-level arm data before any synthesis.
- Report absolute risk per 1,000 dosed participants for single-administration strata.
- Use exact binomial intervals for study-level risks; show numerator and denominator beside every interval.
- Report randomized risk differences only for compatible comparator, ascertainment, and window definitions.
- Do not use continuity corrections to manufacture relative effects from zero-event arms.
- Do not estimate heterogeneity from uninformative sparse data.
- No pooling across MDD and TRD, single and repeated dose, exact and overlapping windows, or incompatible comparator/ascertainment classes.
- A statistician must freeze the model choice before independent extraction results are unmasked.
- If all direct studies have zero primary events, report the combined exposed denominator and exact bound only when outcome definitions and ascertainment are sufficiently compatible; otherwise report study-level bounds.
- Prespecified sensitivity analyses: leave-one-study-out; one and two reclassified/missed events; exclusion of high-risk or unclear-attribution reports; exact-window versus overlapping-window reports; direct MDD versus each indirect stratum; and high-intensity versus low/unclear event ascertainment.

## 14. Certainty and interpretation

GRADE Product A outcomes separately by comparator and time window. Do not transfer certainty from treatment-related events to all-cause events or from MDD to TRD. Product B receives a separate descriptive certainty/limitations statement and is not automatically assigned the randomized starting level.

Permitted conclusions are narrow and scenario-specific. “No events observed” never means zero risk, proven safety, recreational safety, or superiority to another drug.

## 15. Participant/public and expert content review

Before registration, at least one clinician with acute psychiatric-safety expertise, one evidence-synthesis methodologist, one statistician, and two participant/public contributors with relevant lived or caregiving experience review the outcome taxonomy and interpretation boundaries. They do not pre-fill study decisions or numerical results.

## 16. AI assistance and human accountability

AI tools may assist with formatting, code, deduplication suggestions, and draft language. They may not serve as independent reviewers, adjudicators, information specialists, statisticians, or final risk-of-bias/certainty judges. All AI-assisted outputs used in the review must be logged and human verified.

## 17. Registration, amendments, and release

Prospectively register the independent phase on an appropriate platform after human review roles and the statistical plan are complete. Archive the protocol, searches, forms, code, and cryptographic manifest. Every post-lock change receives a dated deviation entry stating who approved it, whether affected results were visible, and which outputs were rerun.

## 18. Stopping rule

“Insufficient evidence for a precise or transportable risk estimate” is a valid final result. The project will not replace missing evidence with expert scoring or a 0–100 harm value.
