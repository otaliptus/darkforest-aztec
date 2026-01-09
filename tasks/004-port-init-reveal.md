# Ticket 004 - Port init + reveal flow

## Goal
Port the player initialization and location reveal flows from v0.6 into Aztec Noir contracts using the required private validate → public apply pattern.

## Acceptance Criteria
- Noir private validators implemented for init + reveal (matching v0.6 circuits logic and checks).
- Public apply functions (only_self) update state for player + revealed coords.
- Tests cover success + failure paths for init and reveal.
- No unbounded loops in public functions.

## Out of Scope
- Move/capture/artifact flows (future tickets).

## Deliverables
- Updated `packages/contracts` with init + reveal implementation and tests.

## Status
- Archived (2026-01-08).
