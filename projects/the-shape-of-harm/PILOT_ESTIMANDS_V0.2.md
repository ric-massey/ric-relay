# The Shape of Harm — Pilot Estimands v0.2

**Date:** 23 July 2026  
**Status:** Provisionally frozen for feasibility review; not content-validated, preregistered, estimated, scored, or suitable for clinical/policy use.

## What changed

The project now has four explicit pilot estimands. “Frozen” means evidence searching and feasibility work must use the wording below. Any change to the population, exposure, comparator, outcome, handling of post-exposure events, summary measure, geography, or time horizon creates a new version with a dated rationale.

This follows the estimand logic used in ICH E9(R1): each question identifies the target population, exposure conditions, outcome variable, strategy for intercurrent events, and population-level summary. The framework adds geography, calendar period, supply, setting, and identification assumptions because drug-risk estimates are strongly context-dependent.

## Critical comparison rule

**These four pilot rows must not be put into one ranking.** They intentionally test different parts of the system:

- alcohol tests a community episode denominator;
- tobacco tests a long-horizon causal target-trial design;
- nonprescription opioids test changing illicit supply and denominator failure;
- psilocybin tests controlled-administration safety synthesis.

A cross-substance comparison is permitted only after two or more scenarios share a preregistered comparability class: compatible population, setting, exposure unit, outcome definition, time horizon, denominator, and calendar/geographic target.

## EST-AE-ALC-001 — 60 g community alcohol episode

### Estimand sentence

> Among U.S. adults aged 21–64 who drank alcohol in the past year, what is the 24-hour absolute risk of prespecified severe medical and behavioral outcomes after one community episode of consuming 60 g pure ethanol orally within 2 hours from regulated beverages, with no intentional co-use, compared with a matched non-drinking episode?

| Attribute | Locked draft definition |
|---|---|
| Population | Community-dwelling U.S. adults 21–64 who drank in the prior 12 months. Primary analysis excludes known physiologic alcohol dependence; high-risk subgroups are separate. |
| Exposure | 60 g pure ethanol from regulated beverages, orally, within ≤2 hours, community/private setting, no intentional intoxicant co-use. |
| Comparator | Matched 24-hour period with no alcohol or other intoxicant exposure. |
| Outcomes | Death; ICU/organ failure; severe hospital/ED event; severe user behavioral/psychiatric event; severe victim event. Each outcome remains separate. |
| Intercurrent events | Emergency treatment is retained. Intentional co-use is outside the primary estimand; unreported co-use is handled in sensitivity analysis. |
| Summary | Standardized absolute risk per 100,000 episodes plus risk difference and risk ratio. |
| Window | 0–24 hours from first drink. |
| Place/time | United States, 2022–2025. |

**Why 60 g?** It is a reproducible exposure anchor used by WHO for heavy episodic drinking. It is not a claim that all 60 g episodes are equivalent or that 60 g is a safety boundary.

**Release blocker:** no estimate is published until numerator and episode denominator represent compatible populations, periods, and settings.

## EST-RU-TOB-001 — continued smoking versus cessation

### Estimand sentence

> Among U.S. adults aged 30–49 who currently smoke 10–30 regulated combustible cigarettes daily and have no prior major smoking-attributable disease, what is the 10-year difference in mortality and first major chronic physical-health events under sustained smoking of 20 cigarettes/day versus complete cigarette cessation at baseline?

| Attribute | Locked draft definition |
|---|---|
| Population | U.S. adults 30–49, current daily smokers averaging 10–30 cigarettes/day, without prior MI, stroke, COPD, or invasive cancer. |
| Exposure strategy | Sustain 20 regulated combustible cigarettes/day for 10 years; no other combustible tobacco. |
| Comparator strategy | Complete cigarette cessation at baseline; no combustible tobacco during follow-up. Cessation treatment is permitted and recorded. |
| Outcomes | All-cause death; first major cardiovascular event; incident COPD; invasive smoking-attributable cancer; chronic physical health loss. |
| Intercurrent events | Per-protocol strategy. Deviations are addressed with prespecified censoring and inverse-probability weighting; death is a competing event for nonfatal outcomes. |
| Summary | 10-year cumulative risk per 1,000 persons, risk difference, risk ratio, restricted mean survival difference, and DALYs where defensible. |
| Place/time | United States; baseline cohorts 2010–2016 with complete 10-year follow-up. |

This is a **continuation-versus-cessation effect among baseline smokers**, not an intrinsic score for nicotine, all tobacco products, initiation, or lifetime smoking.

## EST-AE-OPI-001 — unverified nonprescription opioid market episode

### Estimand sentence

> Among U.S. adults aged 18–64 with current opioid tolerance, what is the 24-hour absolute risk of fatal or severe opioid toxicity after one intranasal community-use episode involving an unverified product sold as an opioid in the 2024 U.S. illicit market, with no intentional sedative or stimulant co-use?

| Attribute | Locked draft definition |
|---|---|
| Population | Adults 18–64 reporting nonprescription opioid use ≥4 days/week in the prior 4 weeks and no abstinence interval >72 hours. This is a tolerance proxy requiring validation. |
| Exposure | One intranasal episode with a self-selected quantity of an unverified product sold as an opioid. Composition/potency are market-distributed variables and measured post hoc where possible. |
| Comparator | Matched 24-hour period without opioid use. Secondary scenario contrasts may examine naloxone availability or verified supply. |
| Outcomes | Death; respiratory depression requiring naloxone or ventilation; ICU-level event; severe hospital/ED event. |
| Intercurrent events | Naloxone, EMS, and hospital treatment are retained as real-world rescue processes and separately modeled as modifiers. Unintentional adulterants remain part of the supply estimand. |
| Summary | Absolute risk per 100,000 episodes, integrating over the registered product-composition distribution. |
| Place/time | United States illicit market, calendar year 2024. A new market year requires a new scenario version. |

This is intentionally a stress test. Death surveillance without a valid episode denominator cannot estimate this quantity. Until the denominator and supply sample are defensible, the correct output is **not estimable**, not a guessed midpoint.

## EST-AE-PSI-001 — controlled 25 mg psilocybin administration

### Estimand sentence

> Among adults aged 21–65 with major depressive disorder who meet contemporary trial eligibility criteria, what is the 7-day risk difference in prespecified serious medical and severe psychiatric/behavioral outcomes after one 25 mg oral dose of synthetic psilocybin with preparation, continuous session monitoring, and post-session support versus placebo with identical support?

| Attribute | Locked draft definition |
|---|---|
| Population | Adults 21–65 with MDD inside a shared eligibility envelope derived from included controlled trials. Medical, psychiatric, medication, and family-history exclusions are recorded. |
| Exposure | Single 25 mg oral synthetic psilocybin dose, standardized preparation, trained monitors throughout the dosing session, standardized follow-up. |
| Comparator | Placebo/inactive control with identical support and follow-up. |
| Outcomes | Serious adverse event; ICU/hospital event; severe anxiety, panic, or psychotic event requiring rescue; self-harm or sustained clinically important worsening. |
| Intercurrent events | Rescue medication, extended observation, transfer, and hospitalization are retained and counted where relevant. Participants never dosed are outside the administration estimand. |
| Summary | Risk per 1,000 administrations and risk difference versus placebo, with binomial or hierarchical intervals. Zero-event studies are not treated as proof of zero risk. |
| Windows | 0–24 hours and cumulative 0–7 days, reported separately. |
| Place/time | Eligible controlled trials conducted 2018–2026; transport target U.S./Canada. |

This result applies only to the controlled clinical scenario. It cannot be presented as the risk of unsupervised use, natural-mushroom products, other doses, excluded populations, or long-term psychiatric outcomes.

## Feasibility decision after locking the questions

| Estimand | Feasibility | Main reason |
|---|---|---|
| EST-AE-ALC-001 | Medium–low | Acute outcomes exist, but a compatible episode denominator is difficult. |
| EST-RU-TOB-001 | Medium–high | Strong longitudinal data exist; sustained intensity and cessation require target-trial methods. |
| EST-AE-OPI-001 | Low | Episode count, product composition, tolerance, co-use, and rescue are incompletely observed. |
| EST-AE-PSI-001 | High within trial setting | Controlled arm-level data are feasible, but transport outside trial eligibility is limited. |

The first empirical extraction should begin with **EST-AE-PSI-001** and **EST-RU-TOB-001**, while the alcohol and opioid rows undergo denominator-feasibility studies. That sequencing tests both a controlled safety synthesis and a longitudinal causal design without fabricating episode rates.

## Required content-validity review

Before preregistration, reviewers must independently answer:

1. Is the population sufficiently precise and clinically meaningful?
2. Can both exposure and comparator be observed or emulated?
3. Are the outcomes complete without overlap?
4. Are the time windows appropriate for the causal pathway?
5. Are intercurrent events handled in a way that matches the intended question?
6. Is the summary measure interpretable to researchers and the public?
7. Which important subgroup or context would make the answer materially different?
8. Is the quantity estimable from existing data without combining incompatible numerators and denominators?

Each item receives relevance and clarity ratings plus written comments. Any material revision increments the estimand version.

## Method references

- FDA / ICH E9(R1), *Estimands and Sensitivity Analysis in Clinical Trials*: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/e9r1-statistical-principles-clinical-trials-addendum-estimands-and-sensitivity-analysis-clinical
- WHO metadata for heavy episodic drinking (≥60 g pure alcohol): https://www.who.int/data/gho/indicator-metadata-registry/imr-details/459
- CDC/NHIS adult tobacco-use definitions: https://archive.cdc.gov/www_cdc_gov/nchs/nhis/tobacco/tobacco_glossary.htm
- ClinicalTrials.gov example of 25 mg oral psilocybin in a clinical setting: https://clinicaltrials.gov/study/NCT04620759
- NCBI, *Specifying the Target Trial*: https://www.ncbi.nlm.nih.gov/books/NBK547516/
