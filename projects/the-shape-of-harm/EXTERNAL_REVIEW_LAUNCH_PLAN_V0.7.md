# External Review Launch Plan v0.7

**Date:** 23 July 2026  
**Status:** Execution-ready author package; no independent review has begun.

## Why this release exists

Version 0.6 froze a prospective independent-replication protocol. Version 0.7 repairs the evidence-corpus handoff and defines the exact launch sequence. It does **not** add a new psilocybin safety estimate.

An integrity audit found that `version.json` and the RIS file described 13 seed records while `candidate-study-registry.csv` exposed only four. The CSV now contains all 13 records, and automated checks require the CSV, RIS, detailed corpus, and version metadata to agree.

## Launch sequence

1. **Recruit an information specialist.** They review each database strategy using the PRESS-style form. Search changes are logged before execution.
2. **Recruit two independent reviewers and one adjudicator.** Each signs the conflict and independence form before seeing author decisions or pilot results.
3. **Register prospectively.** Submit the independent phase to PROSPERO if eligible and freeze a time-stamped OSF registration containing protocol v0.2, search strategies, forms, code, and the existing protocol lock.
4. **Execute every accessible search.** Export raw records and complete search histories. Record date, platform, exact query, count, and file hash.
5. **Deduplicate without destroying provenance.** Preserve every source identifier and link multiple reports from one study into a study family.
6. **Freeze the deduplicated corpus.** Hash it before screening. The author-only directness and pilot fields are removed from reviewer views.
7. **Generate concealed reviewer packets.** Reviewers screen independently; neither sees the other's decisions. The author pilot remains unavailable during first pass.
8. **Adjudicate, extract, assess RoB 2, and grade certainty.** All conflicts and reasons remain auditable.
9. **Rerun the analysis from independently extracted data.** Compare against the author pilot only after first-pass judgments are locked.

## Hard stops

Do not generate reviewer packets when any of these are true:

- PRESS review is incomplete.
- Registration is not time-stamped.
- One or more required searches lack an export or documented access limitation.
- Reviewer independence forms are incomplete.
- The deduplicated corpus has not been hashed.
- Author pilot fields remain visible in reviewer files.

## What the author can do now

The author can recruit, fund access, arrange librarian review, submit registration with the accountable team, archive exports, and maintain the technical infrastructure. The author cannot satisfy independence by repeating their own screening or by asking an LLM to simulate independent reviewers.
