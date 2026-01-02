# Ticket 006 - Port move + capture flow

## Goal
Port the v0.6 move and capture flows into Aztec Noir contracts using the private validate → public apply pattern.

## Acceptance Criteria
- Private validators implement move + capture checks consistent with v0.6 circuits and LibPlanet rules.
- Public apply (only_self) updates arrivals/planet ownership/state deterministically.
- Tests cover success + failure paths for move and capture.
- No unbounded loops in public functions.

## Out of Scope
- Artifact, prospecting, or NFT mint flows.
- Client UI updates beyond wiring required calls.

## Deliverables
- Updated `packages/contracts` with move + capture logic and tests.
- Any required shared types/constants to support move/capture.

## Status
- ✅ Implemented move/capture refresh (population + silver), added exp/refresh helpers, and updated move test assertions.
- Tests: `yarn contracts:test:nr`
