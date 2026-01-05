# Ticket 025 - Wormhole arrival parity vs v0.6

## Goal
Align wormhole arrival handling with Dark Forest v0.6 expectations (combat/no-combat, ownership, and arrival resolution).

## Acceptance Criteria
- The expected v0.6 behavior is documented with a concrete reference (file/line in v0.6 code or doc).
- Contract arrival logic is updated to match the expected behavior.
- Tests are updated or added to reflect the parity decision.
- Headless E2E script updated if the flow changes.

## Out of Scope
- Non-wormhole arrival logic changes.
- UI changes.

## Deliverables
- Contract updates in `packages/contracts/src/main.nr`.
- Tests in `packages/contracts/src/test/darkforest_stub.nr`.
- Possible update in `packages/contracts/scripts/e2e_darkforest.js`.

## Tests / Commands
- `yarn contracts:test:nr`
- `yarn workspace @darkforest-aztec/contracts test:e2e` (if E2E updated)

## Status
- Completed.

## Notes
- v0.6 reference: `reference/darkforest-v0.6/eth/contracts/libraries/LibLazyUpdate.sol` lines 115-168 (wormhole arrival branch at 125-129) skips energy transfer when arrival type is Wormhole and target is not owned by the initiator.
- Noir parity: `packages/contracts/src/main.nr` `execute_arrival` wormhole branch mirrors the v0.6 skip-combat behavior while still applying silver transfer.
- Tests: `test_activate_wormhole_and_move_speedup` and `test_wormhole_arrival_skips_combat_on_enemy` in `packages/contracts/src/test/darkforest_stub.nr`.
