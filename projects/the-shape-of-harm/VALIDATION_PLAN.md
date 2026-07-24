# Validation Plan — The Shape of Harm Research Framework

**Status:** Draft v0.2. Four pilot estimands are provisionally frozen. Content-validity and feasibility thresholds must be finalized before evidence results are inspected.

## 1. What is being validated

Validation is separated into five targets:

1. **Conceptual framework:** scenario fields and outcome definitions.
2. **Evidence process:** search, selection, extraction and risk-of-bias judgments.
3. **Statistical model:** estimation, calibration, discrimination where applicable, and uncertainty.
4. **Transportability:** performance across geography, period, supply and population.
5. **Decision layer:** sensitivity to value functions, swing weights and structural assumptions.

A success in one target does not validate the others.

## 2. Content validity

### Participants

Multidisciplinary experts and people with lived experience who are independent of the original score construction.

### Round 1 procedure

Each reviewer completes `estimand-content-validity-form.csv` independently before discussion. For every pilot estimand they rate and comment on:

- population relevance;
- exposure precision;
- comparator precision;
- outcome completeness;
- outcome non-overlap;
- time-window appropriateness;
- intercurrent-event strategy;
- summary-measure interpretability;
- estimability from available data; and
- important omitted subgroups or contexts.

Ratings use a four-point scale so “neutral” does not conceal uncertainty. Reviewers also mark whether a material revision is required and disclose relevant clinical, research, industry, advocacy, or lived-experience conflicts.

### Adjudication and Round 2

The author team publishes anonymized item-level ratings, all comments, proposed changes, and the rationale for accepting or rejecting each change. Revised estimands receive a new version before Round 2. Discussion may clarify disagreements but may not replace the original independent ratings. Minority views remain visible.

### Content-validity gate

Numerical acceptance thresholds will be fixed after panel size and composition are finalized but before ratings are opened. Regardless of the numerical threshold, release is blocked by:

- any unresolved construct-overlap or double-counting pathway;
- an exposure or comparator that cannot be operationalized;
- a denominator that cannot be paired with the outcome numerator;
- an outcome that materially different disciplines interpret differently; or
- an important population/context omission that changes the intended use.

Passing this gate establishes content validity of the question definitions only. It does not validate the evidence estimates or statistical model.

## 3. Review-process reliability

### Units

- title/abstract eligibility;
- full-text eligibility;
- extracted numerical fields;
- outcome mapping;
- risk-of-bias judgments;
- certainty judgments.

### Analysis

Use agreement statistics suitable for each field (for example, kappa-type statistics for categories, intraclass/concordance measures for continuous extraction, plus raw agreement and disagreement patterns). Do not hide systematic disagreement behind a single average.

### Gate

Numerical thresholds will be preregistered after a small training set. Failure triggers form revision, retraining and repeat pilot rather than post hoc threshold changes.

## 4. Construct-behavior hypotheses

Before fitting the model, register directional hypotheses such as:

- acute medical risk should rise with higher dose within the same formulation/route where a dose-response relation is established;
- controlled pharmaceutical supply should differ from an uncertain illicit market scenario for supply-mediated outcomes;
- supervised and unsupervised settings should differ mainly in setting-mediated outcomes rather than intrinsic toxicity;
- abrupt cessation should affect severe withdrawal estimates only among physically dependent populations;
- population burden should change with prevalence even when per-episode risk is unchanged.

Each failed hypothesis receives an investigation and remains visible in the report.

## 5. External validation

### Hold-out strategies

- hold out a later calendar period;
- hold out a jurisdiction;
- hold out one surveillance system or administrative database;
- hold out a subset of studies before model fitting.

### Metrics

Depending on the output:

- calibration-in-the-large and calibration slope;
- absolute and relative prediction error;
- interval coverage;
- rank/dominance stability when ranking is an intended use;
- qualitative agreement with preregistered known-group contrasts.

### Gate

Acceptable bounds are fixed before the hold-out data are revealed. Results outside bounds block any validated-use claim.

## 6. Uncertainty validation

Assess whether reported intervals achieve approximately their intended coverage on held-out or later data. Report under-coverage and over-coverage. Compare alternative models for structural uncertainty.

Fixed interval widths based only on evidence labels are prohibited.

## 7. Transportability

Test interactions with:

- geography;
- calendar period;
- regulated versus illicit supply;
- route;
- population vulnerability;
- co-use prevalence.

Where meaningful interactions exist, publish scenario-specific estimates rather than a universal substance value.

## 8. Decision-layer robustness

For any aggregate:

- use alternative plausible value functions;
- vary swing weights jointly, not one at a time only;
- report probabilistic rankings and dominance;
- identify which inputs drive decision uncertainty;
- report whether the conclusion changes by stakeholder perspective;
- use value-of-information analysis where feasible to identify the most useful future evidence.

## 9. Independent replication

A second group receives the frozen protocol, search strategies and raw evidence but not the original panel's final scores or conclusions. Replication should cover at least one complete pilot scenario family.

## 10. Release rule

The framework may be described as “validated” only for the exact intended use whose gates were passed. The label must include population, scenarios, outcomes, geography and calendar period.
