# Ticket 113 - Fix df-hashing dist MiMC mismatch

## Goal
Ensure the runtime @darkforest_eth/hashing package used by the client miner matches the v0.6 MiMC constants and sponge behavior (so mined locations satisfy on-chain `location_id < max_location_id`).

## Acceptance Criteria
- Regenerate `packages/df-hashing/dist` from `src` (MiMC constants match v0.6).
- Client miner/home-planet hashing aligns with Noir MiMC outputs.
- No contract logic changes.

## Out of Scope
- Changing contract validators.
- Switching to external MiMC libraries.

## Deliverables
- Updated `packages/df-hashing/dist/*` built from current `src`.
- Brief verification notes.

## Tests
- `yarn --cwd packages/df-hashing prepare`

## Status
- Completed (2026-01-12)
