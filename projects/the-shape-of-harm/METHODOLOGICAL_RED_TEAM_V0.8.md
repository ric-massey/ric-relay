# Methodological Red-Team and Protocol Hardening — v0.8

**Date:** 23 July 2026  
**Scope:** Author-side methodological critique before registration and independent review.  
**Scientific result change:** None. This release changes the protocol and evidence architecture, not the provisional psilocybin safety estimate.

## Executive finding

The v0.7 package had strong transparency controls but still compressed two different scientific questions into one review:

1. **Comparative safety effect:** Does monitored 25 mg psilocybin change harm relative to a specified comparator?
2. **Absolute monitored-administration risk:** How often are prespecified harms observed after a monitored 25 mg administration?

Randomized trials are the preferred design for the first question. They are often too small and too short to characterize rare harms for the second. Cochrane's adverse-effects guidance specifically warns that harms reviews may need evidence beyond randomized trials, while preserving design-specific interpretation. Version 0.8 therefore separates the products rather than pooling unlike designs.

## Critical corrections

### 1. Split comparative effects from descriptive safety incidence

- **Comparative product:** direct randomized trials only; effect of assignment to psilocybin versus a compatible comparator.
- **Monitored-exposure safety inventory:** all eligible prospective monitored 25 mg administrations with an explicit denominator, including nonrandomized cohorts. It is descriptive, stratified by design and population, and cannot be used as a causal comparison.
- No result may silently cross between the two products.

### 2. Make all-cause serious events primary

“Drug-related” is an investigator attribution and can be influenced by unblinding, sponsor procedures, and incomplete knowledge. The primary serious-event outcome is now **all-cause serious adverse events**. Treatment-related or drug-related serious events remain secondary attribution-based outcomes.

### 3. Separate seriousness from severity

- **Seriousness** follows regulatory consequences such as death, life threat, hospitalization, disability, or another medically important event.
- **Severity** describes intensity. A severe headache can be non-serious; a mild event can still become serious because it prompts hospitalization.

The extraction schema and outcome taxonomy now store both independently.

### 4. Distinguish zero from not reported

A blank cell, “no serious adverse events,” “no treatment-related serious events,” and a confirmed zero from a complete event table are not equivalent. Every outcome now requires a reporting-status field and a zero-confirmation basis.

### 5. Specify the unit and denominator

For the direct single-dose stratum, risk is reported per **dosed participant with at least one event**. “Per administration” is numerically equivalent only when every participant receives exactly one administration. Repeated-dose regimens remain separate.

### 6. Treat event ascertainment as data, not background

Extraction now records whether harms were solicited, spontaneously reported, actively queried, clinician assessed, coded with a dictionary, collected at fixed visits, or only summarized in prose. Different ascertainment systems cannot be assumed to have equal sensitivity.

### 7. Expand the search without adding a harms filter

Harms are often poorly indexed and inconsistently mentioned in titles or abstracts. The registered search should retain the focused depression search and add a broad psilocybin/COMP360 search for prospective monitored studies and regulatory safety reports. Screening—not a restrictive harms term—controls eligibility.

### 8. Replace “blinding” with decision concealment

Reviewers cannot truly be blinded to famous trials or public results. The defensible control is concealment of the author pilot's eligibility, extraction, risk-of-bias, and certainty judgments until independent first-pass decisions are locked.

### 9. Add synthesis-level missing-evidence assessment

Study-level RoB 2 is not enough. The review must also assess whether whole studies, outcomes, time windows, or event tables are missing from the available evidence. Version 0.8 adds a ROB-ME-compatible missing-evidence record.

### 10. Add participant and public outcome review

A clinician-only panel can overlook harms that matter to participants, such as prolonged fear, perceived loss of control, persistent perceptual symptoms, delayed functional impairment, or burdens created by rescue procedures. A small lived-experience/content panel will review the outcome dictionary before registration without determining study eligibility or numerical results.

### 11. Disclose AI assistance

Large-language-model assistance was used to draft code, schemas, prose, and methodological critiques. It is not an independent reviewer, information specialist, statistician, or adjudicator. Every search, judgment, extraction, and statistical decision used in a scientific claim requires accountable human verification.

## Red-team disposition

The protocol is stronger after these changes, but the project is still blocked from scientific execution until:

- an information specialist reviews both focused and broad searches;
- a statistician signs the analysis plan;
- two independent reviewers and one adjudicator are assigned;
- a participant/public content review is completed;
- the protocol is prospectively registered;
- the search is run and the resulting corpus is frozen.

## Standards used in this hardening pass

- Cochrane Handbook, Chapter 19: Adverse effects.
- PRISMA 2020 and PRISMA-Harms.
- CONSORT Harms 2022 for understanding trial-report limitations.
- PRESS 2015 for search-strategy peer review.
- RoB 2 for randomized comparative results.
- ROB-ME for missing evidence in a synthesis.
- GRADE for outcome-level certainty, kept separate by question and evidence stratum.

This is an author-side design correction, not external validation.
