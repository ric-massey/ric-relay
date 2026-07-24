# Data Management and Blinding SOP v0.7

## Data layers

- `raw/`: immutable database and registry exports.
- `normalized/`: parsed records with source provenance.
- `deduplicated/`: one screening record per deduplicated citation.
- `families/`: report-to-study linkage.
- `reviewer-a/` and `reviewer-b/`: concealed first-pass decisions.
- `adjudication/`: conflicts and final decisions.
- `analysis/`: independently extracted, locked data used by code.

## Concealment

Reviewer files must not include `author_horizon_status`, `directness_hint_author_only`, pilot inclusion decisions, pilot extractions, pilot RoB 2 judgments, pilot GRADE judgments, or provisional numerical results. Reviewer A and B cannot access each other's decisions until both passes are locked.

## Identifiers

Every record keeps a permanent record ID and every study family a permanent family ID. Corrections create a new version; IDs are never recycled.

## Security and audit

Store registration files and raw exports in a read-only, time-stamped repository. Hash every frozen artifact. Keep a change log naming who changed what, when, why, and whether outcome data were visible.

## Release

Publish raw search strategies, deduplication mappings, reviewer-level decisions where ethically and legally permissible, exclusion reasons, study-family links, extraction disagreements, adjudication rationales, and analysis code.
