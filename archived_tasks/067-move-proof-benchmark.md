# Ticket 067 - Single-move proof benchmark

## Goal
Add a lightweight script to benchmark a single move transaction (proof + inclusion) and optionally resolve arrival.

## Acceptance Criteria
- New script runs a minimal flow: ensure player initialized, submit a `move`, wait for inclusion, and (optionally) resolve arrival.
- Script logs wall-clock durations for move proof+inclusion and resolve arrival.
- Script is runnable via a package script (e.g. `yarn workspace @darkforest-aztec/contracts bench:move`).

## Out of Scope
- Contract logic changes.
- UI changes.

## Deliverables
- New script under `packages/contracts/scripts/`.
- `packages/contracts/package.json` updated with a new script entry.

## Tests / Commands
- `PROVER_ENABLED=true AZTEC_NODE_URL=http://localhost:8080 AZTEC_NODE_ADMIN_URL=http://localhost:8880 L1_RPC_URL=http://localhost:8545 yarn workspace @darkforest-aztec/contracts bench:move`

## Status
- Archived (2026-01-08).

