# Ticket 017 - Config validation + bounds enforcement

## Goal
Enforce v0.6 configuration checks in the Aztec Noir private validators so actions cannot spoof perlin settings or escape world bounds.

## Acceptance Criteria
- Private validators for `init_player`, `reveal_location`, `move`, and `find_artifact` reject when perlin config does not match on-chain config hash.
- `init_player` enforces:
  - `radius <= world_radius`
  - `spawn_rim_area` constraint (v0.6 ring rule)
  - `init_perlin_min <= perlin < init_perlin_max`
- `move` enforces `radius <= world_radius`.
- `init_player`, `reveal_location`, `move`, and `find_artifact` enforce `location_id < max_location_id`.
- Tests cover bad config hash, out-of-range location id, and move radius above world radius.
- No unbounded loops in public functions.

## Out of Scope
- Client/UI changes.
- New gameplay mechanics beyond validation.

## Deliverables
- Updated `packages/contracts` logic and tests.

## Tests
- `yarn contracts:test:nr`

## Status
- Added private-validator config/bounds checks using explicit parameters (expected config hash + bounds) for `init_player`, `reveal_location`, `move`, and `find_artifact`.
- Added config hash helpers in test utils and updated test calls to supply the new params.
- Fix: `test_init_player_real_planet_rarity` now passes real max location id.
- Tests: `yarn contracts:test:nr` ran but `nargo test` was killed with exit 137 (likely OOM). No failures observed before termination.
