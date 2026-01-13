# 086 - Fix resolve arrival reverts / stuck arrival blocks

## Status
- **Status:** Archived (2026-01-09)
- **Created:** 2026-01-09
- **Owner:** codex

## Context
Resolve arrival calls keep reverting with identical arrivalBlock values after a ship move.
Client logs show `[Aztec] resolve arrival failed` for a given arrivalId, and subsequent
transactions fail from the target planet.

## Acceptance Criteria
- Resolve arrival attempts do not repeatedly revert for the same stale arrival.
- Client clears or resyncs arrivals that are already resolved or invalid.
- Sending ships does not block subsequent transactions on the destination planet.

## Tests / Commands
- `yarn workspace @darkforest-aztec/contracts compile`

## Notes
- Investigate `queueResolveArrival` / arrival scheduling and on-chain arrival state.
- Ensure arrival IDs are not re-used or cached incorrectly.
