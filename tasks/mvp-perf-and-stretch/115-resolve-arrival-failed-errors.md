# Ticket 115 - Resolve arrival failed errors

## Goal
Eliminate `resolve arrival failed` errors in the client by fixing the underlying contract/client mismatch or timing issue causing `app_logic_reverted` on arrival resolution.

## Background / Motivation
We are seeing runtime errors when resolving arrivals:
```
GameManager.ts:3349 [Aztec] resolve arrival failed
{arrivalId: '2', error: 'Transaction ... was app_logic_reverted. Reason: ', arrivalBlock: 25, currentBlock: 25, toPlanet: '0012d87f...'}
```
This breaks core gameplay flow and undermines the E2E playability requirement.

## Scope (In)
- Reproduce the issue on local devnet using a deterministic flow.
- Identify the root cause (e.g., off-by-one block, stale arrival data, mismatch in stored config hash, arrival already resolved, ownership mismatch, etc.).
- Fix the client/contract logic so arrival resolution succeeds or is skipped safely when invalid.
- Improve logging with a clear reason (if possible) for reverted arrivals.

## Out of Scope
- General logging overhaul unrelated to arrivals.
- Rewriting arrival mechanics.

## Acceptance Criteria
- A deterministic repro case exists (script or manual steps) and is documented.
- The specific error no longer occurs in the repro scenario.
- If an arrival is no longer resolvable, the client handles it gracefully without repeated failing attempts.
- Logging includes enough information to diagnose future failures (arrival id, from/to, block numbers, revert reason if available).

## Implementation Notes
- Check `GameManager.ts` arrival resolution path around `resolveArrival` for block timing assumptions.
- Verify contract `apply_move` (arrival mode) and `execute_arrival` paths for required preconditions.
- Ensure the client doesn’t attempt to resolve arrivals in the same block they are created (if not allowed by contract).

## Deliverables
- Code fix in `apps/client/src/Backend/GameLogic/GameManager.ts` (and any related helpers).
- If needed, contract adjustments in `packages/contracts/src/main.nr` with tests.
- A brief note in `docs/` describing the root cause and fix.

## Tests / Commands
- Local repro and verification.
- If modified contract logic: `yarn contracts:test:nr`.
- If client change: `yarn workspace @darkforest-aztec/client lint` (optional until lint config is settled).

## Status
- Open

## Notes
- Keep changes minimal; do not change core arrival rules without parity justification.
