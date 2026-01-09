# Ticket 045 - Arrival resolve gating + logging

## Goal
Stop premature arrival resolution attempts (app_logic_reverted) and add clearer diagnostics for arrival resolution in the client.

## Acceptance Criteria
- Client only attempts resolve when the L2 block number has reached the arrival's `arrivalBlock`.
- If an arrival is already empty/resolved, the client skips resolution and logs a clear message once.
- Resolve failure logs include arrival metadata (arrivalBlock, currentBlock, toPlanet) to aid debugging.
- Arrival timestamps are not treated as "now" when the target block has not been produced.
- No contract logic changes.

## Out of Scope
- Contract changes.
- Indexer or server-side changes.

## Deliverables
- Updated client logic to gate `resolve_arrival`.
- Improved client logs around arrivals.

## Tests / Commands
- Manual: trigger a move, verify no repeated resolve attempts before arrival block, and capture works once block is reached.

## Status
- Archived (2026-01-08).

