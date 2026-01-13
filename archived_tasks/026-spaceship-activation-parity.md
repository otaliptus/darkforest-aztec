# Ticket 026 - Spaceship activation parity

## Goal
Ensure `set_artifact_activation` supports ship artifacts minted by `give_space_ships` and matches v0.6 behavior.

## Acceptance Criteria
- Activating a spaceship created via `give_space_ships` succeeds (no synthetic artifacts required).
- Activation effects apply correctly (e.g., crescent -> silver mine).
- Storage source-of-truth for ships vs artifacts is consistent and documented.
- Tests cover activation for a real ship and a failure case.

## Out of Scope
- UI changes.
- Changing ship minting or voyage mechanics beyond the activation path.

## Deliverables
- Contract updates in `packages/contracts/src/main.nr` and/or `packages/contracts/src/types.nr`.
- Tests in `packages/contracts/src/test/darkforest_stub.nr`.
- Update `packages/contracts/scripts/e2e_darkforest.js` to use a real ship artifact (if needed).

## Tests / Commands
- `yarn contracts:test:nr`
- `yarn workspace @darkforest-aztec/contracts test:e2e`

## Status
- Archived (2026-01-08).

## Notes
- Activation now loads ship artifacts from the spaceship maps and materializes the artifact on first activation.
- `give_space_ships` keeps public writes under the per-tx limit.
