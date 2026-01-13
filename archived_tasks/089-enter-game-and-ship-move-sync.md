# Ticket 089 - Enter screen + ship move sync

## Goal
Restore a minimal entry screen and prevent ship moves from failing when the ship has arrived but the chain state is lagging/unresolved.

## Acceptance Criteria
- Visiting `/` shows an entry screen with only an "Enter Game" button.
- Clicking "Enter Game" routes to `/play/<contract>` as before.
- If a ship move is attempted from a planet the UI shows it on, the client attempts to resolve the pending arrival before throwing "ship is not on this planet".
- If the ship is still on a different planet or in transit, the error message is explicit (no uncaught runtime crash).
- No contract changes.

## Out of Scope
- Gameplay balance changes.
- New UI features beyond the entry screen button.

## Deliverables
- Updated routing + entry screen.
- Client-side ship move guard that can resolve pending arrivals.

## Tests / Commands
- Manual: open `/` and click Enter Game.
- Manual: move ship A -> B, wait for arrival block, then move B -> C without error.

## Status
- Archived (2026-01-09)
