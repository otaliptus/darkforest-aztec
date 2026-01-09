# Ticket 055 - Aztec Ships Visibility + Artifact Gating

## Goal
Show ships in the Aztec client so artifact prospecting works and players see their starting ships.

## Acceptance Criteria
- After init, ships appear on the home planet without manual hacks.
- Gear ship requirement for prospecting is satisfied when the player owns it.
- Ship locations update correctly when moved.

## Plan
1) Read `spaceships` + `spaceship_owners` maps from the contract storage in the chain reader.
2) When an artifact entry is missing, synthesize a ship artifact from the spaceship maps.
3) Ensure `artifact_locations` is used so ships render on the correct planet.
4) (Optional) add snapshot support for ships if snapshots are used.

## Touch Points
- `apps/client/src/Backend/Aztec/scripts/storage.ts`
- `apps/client/src/Backend/Aztec/scripts/chain.ts`
- `apps/client/src/Backend/GameLogic/ContractsAPI.ts`
- (Optional) `apps/client/src/Backend/GameLogic/SnapshotLoader.ts`

## Side Effects
- More on-chain reads per refresh (minor perf cost).
- Must keep ship synthesis aligned with contract state to avoid ghost ships.

## Non-Goals
- Reworking on-chain ship storage layout.
- Changing ship rules or gameplay balance.

## Status
- Archived (2026-01-08).
