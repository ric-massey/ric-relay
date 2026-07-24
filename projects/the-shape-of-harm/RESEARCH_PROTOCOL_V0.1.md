> **SUPERSEDED — historical record only.** This document has been replaced by `RESEARCH_PROTOCOL_V0.2.md`. It is retained because earlier releases link to it. Do not use it for review, extraction, or registration.

# The Shape of Harm Research Framework — Protocol Draft v0.1

**Date:** 23 July 2026  
**Status:** Draft for methodological and domain-expert review. Not preregistered, scored, validated, or suitable for policy/clinical decisions.

## 1. Scientific identity

The project will be developed as a **scenario-based comparative risk model with an optional multi-criteria decision-analysis layer**. It will not assume that “drug harmfulness” is a single latent trait measured reflectively by interchangeable items.

The scientific working title is:

> **The Shape of Harm: a scenario-based comparative risk and decision-analysis framework for psychoactive substances**

The current five-column v5 model is retained as a transparent historical exploratory model. Its values will not be carried forward as priors or validation targets.

## 2. Intended use

The framework is intended to:

1. estimate defined health and external-harm outcomes under fully specified psychoactive-substance exposure scenarios;
2. communicate the certainty, directness and provenance of those estimates;
3. compare scenarios within a common estimand and denominator; and
4. optionally support value-explicit comparisons through a separate MCDA layer.

It is not intended to:

- declare a context-free “most harmful drug”;
- predict an individual person's outcome;
- substitute for clinical judgment;
- give dosing or use advice;
- merge population burden and per-user danger into one default score; or
- infer safety from a low rank.

## 3. Perspectives and estimands

Three views will be developed independently.

### 3.1 One-episode view

**Estimand:** absolute probability or rate of mutually exclusive acute outcomes following one defined administration episode.

**Denominator:** 100,000 defined episodes.

**Required scenario fields:** substance, formulation, supply source, dose/intensity, route, timing, co-use, setting, supervision, user history/vulnerability, population, geography, calendar period, outcome window.

### 3.2 Regular-use view

**Estimand:** attributable health loss and defined dependence/withdrawal outcomes under a specified frequency and duration of exposure.

**Denominator:** 1,000 user-years, 1,000 initiators, or 1,000 cessation attempts among physically dependent users, depending on the outcome.

### 3.3 Population-burden view

**Estimand:** total and population-standardized attributable burden in a named geography and year.

**Denominator:** total burden and per 100,000 residents/year.

This view explicitly includes prevalence and market conditions. It will never be interpreted as intrinsic per-user danger.

## 4. Scenario definition

Every model row must be a registered scenario rather than a substance label. Scenario records must include:

- scenario ID and version;
- substance and formulation;
- pharmaceutical/regulated versus nonprescription/illicit supply;
- dose or exposure-intensity definition;
- route;
- frequency and duration;
- co-use assumptions;
- setting and supervision;
- population and relevant vulnerability strata;
- geography and calendar period;
- comparator/reference state;
- outcome window;
- data status and last update.

Scenarios cannot be compared in the main interface unless they share a compatible estimand and denominator.

## 5. Proposed core outcomes

The proposed outcomes are defined in `outcome-dictionary.csv`. They require formal content-validity review before being locked.

### 5.1 Acute medical severity

Mutually exclusive highest-severity states within the declared window:

1. death;
2. ICU-level event or organ failure, survived;
3. hospital/ED severe event, survived without ICU;
4. no qualifying severe medical event.

### 5.2 Acute behavioral/psychiatric severity

Severe injury, self-harm, violence, psychosis, panic or dangerous disorientation attributable to the episode. User and victim outcomes must be recorded separately.

### 5.3 Chronic physical health loss

Attributable mortality and physical morbidity under the stated exposure pattern, preferably summarized in natural units and DALYs per 1,000 user-years.

### 5.4 Chronic psychiatric/cognitive health loss

Persistent psychiatric or cognitive morbidity beyond the acute window.

### 5.5 Substance-use-disorder incidence

New DSM/ICD disorder over a fixed follow-up among initiators or exposed people. This is distinct from physical dependence.

### 5.6 Physical dependence

Physiologic adaptation under the defined exposure pattern.

### 5.7 Severe withdrawal outcome

Medically serious outcomes after cessation, conditional on physical dependence and a defined cessation process.

### 5.8 External harm

Victim health loss and other external outcomes per user-year. Economic cost will be reported as a separate outcome, not converted silently into health loss.

### 5.9 Population burden

Total deaths, DALYs, victim outcomes and economic costs in a named geography/year.

## 6. Evidence eligibility

A detailed inclusion/exclusion specification will be written separately for each outcome family. General principles:

- prioritize outcome definitions that map directly to the registered estimand;
- include randomized and non-randomized studies when appropriate to the question;
- include surveillance and administrative data for rare severe outcomes when exposure denominators are defensible;
- record pharmacologic/mechanistic evidence as supporting evidence, not as a substitute for outcome rates;
- exclude evidence with an irreconcilable denominator, exposure, time horizon or outcome definition from quantitative synthesis;
- retain excluded-but-informative evidence in a narrative evidence map.

## 7. Search and review procedure

1. Register the protocol and publish exact database search strategies.
2. Develop searches with a health-sciences information specialist.
3. Use at least two independent reviewers for title/abstract screening, full-text eligibility, outcome extraction and key risk-of-bias judgments.
4. Pilot forms before full review.
5. Record all disagreements and their resolution.
6. Publish a PRISMA flow diagram and excluded-full-text table with reasons.
7. Version updates and retain superseded datasets.

## 8. Risk of bias and certainty

Study-level tools will match study design. The body of evidence will be graded **by outcome and scenario**, considering at minimum:

- risk of bias;
- inconsistency;
- indirectness;
- imprecision;
- publication/missing-results bias.

Certainty is not a numeric penalty added to the outcome estimate. The estimate and confidence in the estimate remain separate fields.

## 9. Statistical synthesis

### 9.1 Natural units

Primary outputs will remain in natural units: event rates, absolute risks, rate ratios, cases, deaths, or DALYs under a defined denominator.

### 9.2 Acute outcome states

For mutually exclusive outcome states `k`:

`ExpectedLoss(s) = Σ P(state_k | scenario s) × Severity(state_k)`

Severity weights must be independently sourced or elicited and reported separately from outcome probabilities.

### 9.3 Hierarchical synthesis

Where studies are sufficiently comparable, a preregistered hierarchical meta-analytic model may pool evidence across studies and partially across closely related scenarios. Partial pooling must be visible in the output and distinguished from direct estimates.

### 9.4 Dependence and repeated exposure

Repeated-exposure risk will not be calculated by multiplying a one-episode rate by the number of episodes unless the independence and stationarity assumptions are defensible. Time-varying exposure, tolerance, dependence, survivorship and competing risks will be addressed where data permit.

### 9.5 Missing evidence

Missing evidence remains missing. Model-based estimates require explicit assumptions, priors and sensitivity analysis. Missing values are never coded as zero.

## 10. Uncertainty

The model will distinguish:

- sampling/parameter uncertainty;
- between-study heterogeneity;
- measurement error;
- risk-of-bias uncertainty;
- indirectness/transport uncertainty;
- structural/model uncertainty;
- preference/weight uncertainty.

Primary outputs will include a central estimate, interval, certainty rating and provenance. Rankings, if shown, will include pairwise superiority probabilities and robustness across alternative structures—not only ranks under one parameter set.

## 11. Optional decision layer

MCDA will be used only when a decision question genuinely requires aggregation.

`V(s; w) = Σ w_j v_j(x_j)`

Requirements:

- criteria are non-overlapping and operationally defined;
- scale anchors are meaningful;
- value functions are specified before inspecting preferred results;
- weights are elicited as **swing weights**, reflecting both importance and scale range;
- multiple stakeholder perspectives are reported separately;
- there is no “neutral” default weight vector;
- conclusions are subjected to global sensitivity and scenario analysis.

## 12. Expert and lived-experience involvement

A multidisciplinary panel should include, at minimum:

- addiction medicine;
- medical toxicology;
- epidemiology/pharmacoepidemiology;
- psychiatry/clinical psychology;
- biostatistics/Bayesian evidence synthesis;
- health economics/decision science;
- criminology or injury epidemiology for external harms;
- an information specialist;
- people with lived experience across different substances and recovery/non-recovery pathways.

Panel members will disclose financial, professional and advocacy conflicts. Empirical estimation, outcome selection and preference weighting will be treated as separate tasks. Consensus methods will follow a prespecified and reported process such as CREDES-informed Delphi or a facilitated decision conference.

## 13. Validation plan

Detailed gates are in `VALIDATION_PLAN.md`. Validation includes:

- content validity of scenario and outcome definitions;
- reproducibility of screening, extraction and bias assessment;
- preregistered construct-behavior hypotheses;
- external/held-out calibration;
- temporal and geographic transportability;
- sensitivity to structural and preference assumptions;
- independent replication.

Cronbach's alpha and factor analysis are not primary validation tests because the domains are not intended as reflective indicators of one latent trait.

## 14. Pilot study

The first empirical study will be deliberately narrow.

### Candidate design

- one geography and fixed calendar period;
- four anchor scenarios spanning chronic-dominant harm, acute toxicity, supply uncertainty and behavioral/psychiatric risk;
- a limited set of core outcomes;
- duplicate review and extraction;
- model frozen before held-out validation;
- all code, forms, decisions and deviations published.

Candidate anchor substances/markets are regulated alcohol, smoked tobacco, nonprescription opioids and psilocybin. Exact scenarios remain **unlocked** until content-validity review and must be fixed before evidence searching begins.

## 15. Governance and independence

- All protocol changes receive a version, date, reason and author.
- All contributors and funders are disclosed.
- No stakeholder may privately alter an estimate or weight.
- Evidence extraction data, analytic code and model outputs are public unless source licensing prevents redistribution.
- The public interface reads versioned research outputs; it does not contain hand-edited scientific values.
- Negative and null validation results are published.

## 16. Reporting

The review component will follow PRISMA 2020 as applicable. MCDA components will follow ISPOR good-practice reporting. Model transparency and validation will be documented using ISPOR-SMDM principles. Delphi work will follow CREDES-informed reporting.

## 17. Release labels

- **Protocol draft:** design under review; no estimates.
- **Pilot model:** estimates exist for narrow scenarios; not externally validated.
- **Externally tested model:** at least one held-out validation completed.
- **Replicated model:** independent team reproduced the methods and primary conclusions.
- **Validated for a stated use:** only after all prespecified gates for that exact use are met.

No global “validated instrument” label will be used without specifying the population, scenarios, outcomes, geography, period and intended decision.

## 18. Core methodological sources

- Thokala P, et al. Multiple Criteria Decision Analysis for Health Care Decision Making—An Introduction. Value in Health. 2016.
- Marsh K, et al. MCDA Emerging Good Practices. Value in Health. 2016.
- Page MJ, et al. PRISMA 2020. BMJ. 2021.
- Cochrane Handbook, chapters on data collection, risk of bias, synthesis and GRADE.
- Eddy DM, et al. Model Transparency and Validation. Medical Decision Making. 2012.
- Briggs AH, et al. Model Parameter Estimation and Uncertainty Analysis. Medical Decision Making. 2012.
- Jünger S, et al. CREDES Delphi guidance. Palliative Medicine. 2017.
- Bollen KA, et al. In Defense of Causal-Formative Indicators. Psychological Methods. 2015.
