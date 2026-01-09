# Ticket 053 - Lower Early-Game Energy & Silver

## Goal
Reduce early-game energy/silver caps and growth for readable local play.

## Acceptance Criteria
- Default energy caps are scaled down (e.g., 100–5,000 instead of 100k+ for low levels).
- Energy and silver growth are still visible (not zero) at low levels.
- Client displays values that match on-chain values (no mismatch).

## Plan
1) Scale down base arrays for population/energy and silver in the contract constants.
2) Mirror the same scaled arrays in the Aztec client constants.
3) Recompile + redeploy and verify the UI displays the reduced values.

## Touch Points
- `packages/contracts/src/main.nr` (PLANET_DEFAULT_POP_CAP, PLANET_DEFAULT_POP_GROWTH, PLANET_DEFAULT_SILVER_CAP, PLANET_DEFAULT_SILVER_GROWTH)
- `apps/client/src/Backend/Aztec/constants.ts` (matching arrays)

## Side Effects
- Local balance differs from v0.6 (acceptable for local testing).
- Requires recompile/redeploy for consistency.
- Any mismatch between contract and client constants will cause incorrect UI.

## Non-Goals
- Rebalancing mid/late-game progression.
- Changing core formulas for growth or combat.

## Status
- Archived (2026-01-08).
