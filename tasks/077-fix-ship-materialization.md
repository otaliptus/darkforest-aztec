# Ticket 077 - Fix spaceship artifact materialization

## Goal
Ensure spaceship artifacts are materialized correctly in client reads and snapshots so ships appear in UI.

## Acceptance Criteria
- Client artifact reads return spaceship artifacts when they exist on-chain.
- Snapshot indexer includes spaceship artifacts in the artifacts list.
- No changes to core game logic or contract state transitions.

## Out of Scope
- Gameplay changes or balance changes.
- UI redesign.

## Deliverables
- Updated artifact read helpers.
- Updated snapshot indexer artifact read path.

## Tests / Commands
- `yarn workspace @darkforest-aztec/client test`

## Status
- Archived (2026-01-08).
