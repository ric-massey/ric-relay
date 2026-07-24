# Deduplication and Study-Family Linkage SOP v0.7

## Principle

A publication is not necessarily a study, and a study is not necessarily represented by one publication. Deduplicate records while preserving provenance, then link related reports into study families.

## Deterministic duplicate keys

1. DOI after lowercase normalization and removal of URL prefixes.
2. PMID.
3. Trial-registry identifier.
4. Exact normalized title plus year.

## Probabilistic/manual review

Flag similar titles, author overlap, sample size, recruitment dates, locations, sponsor, intervention arms, and registry numbers. Reviewers document whether records are duplicates, companion reports, protocols, follow-ups, or distinct studies.

## Never discard provenance

The retained record stores every source database and original record identifier. Raw exports remain immutable. Duplicate removal is represented as a linkage table, not deletion from history.

## Study families

Use `study-family-registry.csv`. A family can contain the registry entry, protocol, primary report, harms supplement, secondary analysis, long-term follow-up, sponsor report, and regulatory document. Only unique participant exposure contributes to denominators unless a report clearly adds a nonoverlapping cohort.

## Freeze point

After deduplication and family linkage, export the blinded screening corpus and calculate its SHA-256 hash. No record can be added or removed without a dated protocol-deviation entry.
