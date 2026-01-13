# 087 - Fix arrival id parsing (decimal vs hex)

## Status
- **Status:** Archived (2026-01-09)
- **Created:** 2026-01-09
- **Owner:** codex

## Context
Resolve arrival attempts log the wrong arrival block and revert. `VoyageId` values are decimal
strings, but `ContractsAPI.getArrivalState` currently parses them as hex via `toBigInt`, leading
us to read the wrong arrival state and attempt resolve at the wrong time/planet.

## Acceptance Criteria
- `getArrivalState` parses `VoyageId` as decimal (no hex prefix logic).
- Resolve arrivals uses the correct on-chain arrival state and no longer reverts from mismatched IDs.
- Arrival logs show the correct arrivalBlock for the actual arrival being resolved.

## Tests / Commands
- `yarn workspace @darkforest-aztec/client test`

## Notes
- Location IDs are hex strings; voyage IDs are decimal. Keep parsing separate.
