# Ticket 054 - Time Scaling for Real-Time Feel

## Goal
Make game pacing feel real-time on both fast local devnet and slow mainnet block times.

## Acceptance Criteria
- A single time-scale knob controls growth + travel speed.
- Local dev can run with a small scale (fast feel), mainnet can run with a larger scale.
- Client and contract use the same scale so predictions match on-chain behavior.

## Plan
1) Move `TIME_FACTOR_HUNDREDTHS` into on-chain config (or add a config override path).
2) Update client constants to read/reflect the same scale.
3) Expose the scale in the local deploy script so it can be tuned per environment.

## Touch Points
- `packages/contracts/src/types.nr` (GameConfig)
- `packages/contracts/src/main.nr` (TIME_FACTOR_HUNDREDTHS usage)
- `packages/contracts/scripts/deploy_local.js` (config wiring)
- `apps/client/src/Backend/Aztec/constants.ts` (client scale)

## Side Effects
- Requires recompile/redeploy.
- Changes pacing of all growth and travel.
- If the client scale mismatches the contract, UI ETA predictions will be wrong.

## Non-Goals
- Changing the core travel formula or energy decay.
- Adding new gameplay mechanics.

## Status
- Archived (2026-01-08).
