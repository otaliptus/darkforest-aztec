# Ticket 116 - Potential v0.6 deviations (with perf impact)

## Goal
Create and maintain a single source of truth for all intentional deviations from v0.6, including the rationale and the measurable performance benefit for each change.

## Background / Motivation
We may need small deviations for Aztec integration or performance. Keeping a clear log protects scope and makes review easier.

## Scope (In)
- Create a deviations document that lists each deviation with:
  - **What changed** (specific behavior or implementation detail).
  - **Why** (Aztec constraint, performance target, UX stability).
  - **Performance impact** (measurable or reasoned).
  - **Gameplay impact** (confirm no gameplay change unless explicitly approved).
  - **Status** (proposed / implemented / verified).
- Add a template section to standardize new entries.
- Link to any code changes or tickets for each deviation.

## Out of Scope
- Rebalancing gameplay mechanics.
- Large feature additions outside v0.6.

## Acceptance Criteria
- A new doc exists with at least 5 initial deviation candidates (even if “proposed”).
- Each deviation includes a performance impact statement.
- Each deviation includes a “gameplay impact: none” or explicit approval note.
- Document is referenced in `docs/` index or README.

## Deliverables
- Doc: `docs/v06-deviations.md`.
- Link from `README.md` or `docs/README.md`.

## Tests / Commands
- None.

## Status
- Open

## Notes
- This is a living document. Keep entries short and factual.
