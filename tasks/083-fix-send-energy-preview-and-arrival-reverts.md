# Ticket 083 - Fix energy send preview + arrival/move reverts

## Goal
Ensure send preview and move logic reflect correct available energy, and eliminate "arrival already resolved or missing" reverts tied to stale arrivals or ship moves.

## Acceptance Criteria
- Energy send preview does not show 0 if the move should be valid (100% slider on a valid target yields >0 arrival energy).
- Move/ship transactions no longer fail due to stale/missing arrival IDs; client clears or resyncs stale arrivals before submit.
- On failed moves, unconfirmed tx state is cleared and UI reflects current energy.
- Add logs to explain why a move is blocked (distance too far / min energy cost / stale arrival).

## Out of Scope
- Contract redesigns.
- Major gameplay balance changes.

## Deliverables
- Client-side fixes to energy preview + move submission flow.
- Additional logging for move rejection reasons.

## Tests / Commands
- `yarn workspace @darkforest-aztec/client test`

## Status
- Archived (2026-01-09)
