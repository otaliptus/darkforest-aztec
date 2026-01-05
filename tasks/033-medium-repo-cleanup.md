# Ticket 033 - Medium repo cleanup (reference consolidation)

## Goal
Make the workspace easier to understand by grouping reference-only repos under a single folder and documenting the active vs reference layout.

## Acceptance Criteria
- Move the reference repos (`reference/darkforest-v0.6`, `reference/darkforest-local`, `reference/aztec-starter`, `reference/noir`) under a new `reference/` directory.
- Update top-level docs to point at the new reference paths.
- Add a short `README.md` in each reference repo folder stating it is reference-only and not part of the build.
- Add a brief project map doc that distinguishes active work vs reference material.

## Out of Scope
- No changes to contract/client logic.
- No dependency upgrades or build changes.

## Deliverables
- Updated docs and reorganized folders that clarify what is active vs reference-only.
