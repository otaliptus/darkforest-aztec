# 063 - Aztec real-time planet sync (owned planets + arrivals)

## Goal
Make Aztec clients automatically reflect external state changes (captures, arrivals) without manual refresh by polling the chain on a block cadence.

## Acceptance Criteria
- When another player captures one of my planets, my client updates the planet owner within a small number of blocks (local devnet).
- Incoming arrivals targeting my planets appear without manual refresh.
- Sync cadence is block-based and throttled (no per-block spam).
- No contract changes required.

## Plan
1. Add a block-based polling hook in `GameManager.listenForNewBlock` to trigger a sync every N blocks.
2. Implement `syncOwnedPlanets` to bulk refresh planets I currently believe I own (and thus detect ownership changes + arrivals).
3. Guard with an in-flight flag to avoid overlapping refreshes.
4. Emit a planet update event after refresh so UI re-renders.

## Files (expected)
- `apps/client/src/Backend/GameLogic/GameManager.ts`
