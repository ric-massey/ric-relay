# The Shape of Harm — Data Feasibility Review v0.3

**Date:** 23 July 2026  
**Status:** Author feasibility screen completed. This is not independent content validation, not a systematic-review result, and not a harm estimate.

## Decision summary

| Pilot estimand | Decision | What can honestly happen next |
|---|---|---|
| 60 g community alcohol episode | **Blocked for absolute episode risk** | Conduct a denominator-methods study or redefine the question around a data source that observes exposure and outcome together. |
| Continued smoking versus cessation | **Revise/split before estimation** | Use PATH for repeated smoking/cessation and a separate linked-outcome source for mortality; do not pretend one dataset identifies all outcomes. |
| Unverified intranasal opioid episode | **Blocked for absolute episode risk** | Treat this as a surveillance/data-infrastructure research question; death counts and seizure samples cannot supply a per-episode risk. |
| Controlled 25 mg psilocybin | **Proceed to systematic evidence map** | Extract direct and indirect controlled trials separately. Descriptive safety synthesis is feasible; rare serious-event precision is likely low. |

## Central finding

The original feasibility labels were too optimistic for tobacco and psilocybin. Availability of some relevant data is not the same as identification of the exact estimand.

- **Tobacco:** PATH provides repeated tobacco behavior, cessation, covariates, health conditions and biomarkers, but the current 10-year estimand also demands adjudicated mortality, cardiovascular events, COPD and cancer under sustained strategies. No single screened source supplies all of that. The estimand should be split or use an explicitly preregistered data-fusion design.
- **Psilocybin:** at least one trial closely matches the 25 mg MDD scenario, while other trials differ in treatment resistance, comparator and support. The review can proceed, but pooling is conditional and rare serious outcomes will remain imprecise.
- **Alcohol and opioids:** surveillance systems can provide numerators or market signals, but not compatible episode denominators. The correct output remains “not estimable” until the denominator problem is solved.

## Go / hold rules

### GO — EST-AE-PSI-001

Proceed with a systematic evidence map and controlled-trial safety review under `PSILOCYBIN_SAFETY_REVIEW_PROTOCOL_V0.1.md`.

A pooled estimate is allowed only when at least two studies share sufficiently compatible population, 25 mg formulation, control condition, support model, outcome definition and follow-up window. Otherwise publish study-level estimates and a structured narrative synthesis.

### HOLD — EST-RU-TOB-001

Do not fit the current combined outcome model yet. First choose one of two paths:

1. **Split the estimand:** mortality as one target; incident morbidity/biomarkers as separate targets; or
2. **Data fusion:** preregister how PATH exposure trajectories are linked or transported to a mortality/claims source, including uncertainty from the fusion step.

### NO-GO for current absolute-risk release — EST-AE-ALC-001 and EST-AE-OPI-001

Neither has a defensible national episode denominator linked to the target outcome set. Numerators from ED, mortality or overdose surveillance must not be divided by a mismatched survey denominator and presented as an observed risk.

## Source-screening evidence

The machine-readable decisions are in:

- `estimand-feasibility-register.csv`
- `data-source-register.csv`
- `candidate-study-registry.csv`

## Methods standards adopted for the first evidence review

- PRISMA-P for protocol reporting: https://www.prisma-statement.org/protocols
- PRISMA-S for reproducible search reporting: https://www.prisma-statement.org/prisma-search
- PRISMA 2020 for the final review report and flow diagram: https://www.prisma-statement.org/
- RoB 2 for randomized-trial result-level risk of bias: https://www.riskofbias.info/welcome/rob-2-0-tool
- ROBINS-E for future non-randomized exposure studies: https://www.riskofbias.info/welcome/robins-e-tool

## What this phase does not establish

It does not establish that any substance is safer or more harmful than another. It does not validate the estimands. It does not replace two independent reviewers, an information specialist, access to full reports/supplements, or subject-matter review.
