# Ticket 062 - Block-Based Time Everywhere

## Goal
Make all client-side time calculations and UI readouts block-based (not wall-clock seconds), matching Aztec on-chain behavior.

## Acceptance Criteria
- Arrival ETA, voyage progress, and on-map fleet labels use block counts (e.g., `4B`) instead of seconds.
- Planet energy/silver growth uses block deltas (lastUpdated and now in blocks) and updates consistently with on-chain logic.
- Client no longer converts block numbers into timestamps for core gameplay (arrivals, planet updates, artifact activation timing).
- UI labels that currently say seconds for on-chain cooldowns/activation delays are switched to blocks.

## Plan
1) Replace block->timestamp conversions in Aztec adapters with direct block numbers (player, planet, artifact, arrival).
2) Change arrival timers/progress/rendering to use current block number instead of `Date.now()`.
3) Update planet growth and related helpers to use block deltas (and update labels to blocks).
4) Sweep UI text and helper logic to remove seconds-based assumptions.

## Touch Points
- `apps/client/src/Backend/GameLogic/ContractsAPI.ts`
- `apps/client/src/Backend/Aztec/typeAdapters.ts`
- `apps/client/src/Backend/GameLogic/GameObjects.ts`
- `apps/client/src/Backend/GameLogic/ArrivalUtils.ts`
- `apps/client/src/Backend/GameLogic/GameManager.ts`
- `packages/df-renderer/src/Entities/VoyageRenderer.ts`
- `apps/client/src/Frontend/Panes/ArtifactDetailsPane.tsx`
- `apps/client/src/Frontend/Panes/Lobbies/GameSettingsPane.tsx`
- `apps/client/src/Frontend/Panes/Lobbies/ArtifactSettingsPane.tsx`
- `apps/client/src/Backend/GameLogic/ReaderDataStore.ts` (arrival sorting)
- `packages/df-types/src/arrival.ts`

## Side Effects
- Client ETA and progress visuals will change to block units and may appear to jump if blocks are irregular.
- Requires a client refresh to pick up updated labels and logic; no contract redeploy needed.

## Non-Goals
- Changing the core on-chain travel formula.
- Changing Aztec node block production behavior.

## Status
- Archived (2026-01-08).
