# Ticket 090 - Ship move arrival resolve on demand

## Goal
Prevent ship moves from failing when the ship has arrived on-chain but the client hasn’t indexed the arrival yet.

## Acceptance Criteria
- When moving a ship, if chain state says it is on a different planet than `from`, the client attempts to look up arrivals for `from` directly from the contract.
- If a matching arrival exists and is mature, the client resolves it and refreshes the ship and planet state before rechecking.
- If the arrival is not yet mature, the error message includes the arrival block and current block.
- If the ship is truly on another planet, the error message shows the actual on-chain planet id.
- No contract changes.

## Out of Scope
- Changes to ship mechanics or balance.
- UI redesign.

## Deliverables
- Improved ship move guard with on-demand arrival lookup.

## Tests / Commands
- Manual: move ship A->B, wait for arrival block, then move B->C; should succeed without "ship is not on this planet".

## Status
- Archived (2026-01-09)
