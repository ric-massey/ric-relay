# Defined Estimands Implementation Audit — v0.2

**Build:** `2026-07-23-estimands-v0.2-1`  
**Date:** 23 July 2026  
**Status:** Author-draft questions provisionally frozen for feasibility and independent content-validity review. No outcome estimate, score, or cross-substance ranking has been produced.

## What was implemented

The roadmap item “Defined estimands” is now a versioned working component rather than a statement of future intent.

Each of four pilot estimands contains:

- a target population;
- exposure and comparator strategies;
- an outcome set;
- a time horizon;
- a strategy for rescue, treatment, deviations, co-use, and other intercurrent events;
- a population-level summary measure;
- geography and calendar period;
- a comparability class;
- primary data requirements;
- identification assumptions; and
- prohibited interpretations.

The structure adapts ICH E9(R1) estimand attributes to observational and public-health questions. Additional fields cover route, supply, setting, and market period because those can materially change drug-risk estimates.

## Pilot estimands

| ID | Purpose | Feasibility decision |
|---|---|---|
| `EST-AE-ALC-001` | 60 g regulated-alcohol community episode; 24-hour acute outcomes | Medium–low: denominator compatibility is the release blocker. |
| `EST-RU-TOB-001` | Continued smoking versus complete cessation; 10-year chronic outcomes | Medium–high for mortality/CVD; lower for latency-sensitive cancer. |
| `EST-AE-OPI-001` | Unverified nonprescription-opioid market episode; 24-hour severe toxicity | Low for absolute episode risk; retained as a supply/denominator stress test. |
| `EST-AE-PSI-001` | Controlled 25 mg psilocybin versus placebo; seven-day safety outcomes | High within trial settings; transport outside eligibility/support conditions is limited. |

## Comparison guard

These four rows occupy different comparability classes. The website and machine-readable specification explicitly prohibit placing them into one leaderboard. A later comparison requires compatible populations, settings, exposure units, outcomes, denominators, horizons, geography, and calendar period.

## Change control

The status `provisional_frozen_pending_content_review` means:

1. feasibility searches use the registered question;
2. evidence is not allowed to silently redefine the target after results are seen;
3. any material change receives a new version and dated rationale; and
4. panel-approved “locked” status is not claimed.

## Review and extraction infrastructure

The build now includes:

- an independent ten-domain content-validity form for each estimand;
- a feasibility register with three required data components per estimand;
- an extraction template that records whether each study matches the estimand population, exposure, comparator, setting, supply, outcome window, intercurrent-event strategy, summary measure, and denominator;
- versioned CSV and JSON registries; and
- a readable `estimands.html` page linked from both the public explorer and research framework.

## Scientific limits that remain

- The four definitions have not been reviewed by independent domain experts or people with lived experience.
- The panel size and numerical content-validity thresholds are not yet preregistered.
- No systematic search has been performed against these exact questions.
- No denominator-feasibility study has been completed for alcohol or nonprescription opioids.
- No target-trial emulation specification has been completed for tobacco.
- No adverse-event harmonization has been completed for psilocybin trials.
- No estimates exist, and no validation gate has been passed.

## Verification performed

The included validator confirms:

- exactly four unique pilot estimands;
- agreement between estimand, scenario, JSON, review-form, and feasibility registries;
- all mandatory attributes are populated;
- no scenario is mislabeled as panel-approved `locked`;
- the research and estimand pages have unique IDs and valid local file links;
- the public explorer links to the research-development track;
- the evidence-extraction form contains estimand-compatibility fields;
- all 65 legacy score cells and 49 legacy references remain internally consistent.

The build also passed JavaScript syntax checking, the legacy reproduction script, desktop/mobile DOM rendering, and browser console-error checks.

## Next release gate

The next scientific task is **independent content-validity and data-feasibility review**, not scoring. The first evidence extractions should begin only after version 0.3 resolves panel comments and preregisters the exact inclusion, synthesis, and acceptance rules.
