# Ticket 112 - MiMC parity audit vs v0.6

## Goal
Verify that the MiMC implementations in this repo (Noir contract + Aztec client hashing) match Dark Forest v0.6 reference hashing/circuit behavior.

## Acceptance Criteria
- Identify v0.6 reference sources for MiMC (TS hashing and Circom usage).
- Compare constants, round counts, and sponge structure against this repo’s Noir + TS implementations.
- Report any mismatches or gaps.
- No code changes unless explicitly requested.

## Out of Scope
- Performance tuning or refactors.
- Contract/client modifications.

## Deliverables
- Written parity report in chat with file references.

## Tests
- None.

## Status
- In progress
