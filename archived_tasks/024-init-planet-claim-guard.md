# Ticket 024 - Init planet claim guard

## Goal
Prevent `init_player` from claiming an already-initialized planet (or explicitly match v0.6 rules if different).

## Acceptance Criteria
- `init_player` rejects location ids that are already initialized, unless v0.6 explicitly allows a specific exception.
- Behavior is documented in a short note within the ticket or code comment.
- Tests cover success on an empty planet and failure on a pre-initialized planet.

## Out of Scope
- Gameplay UI changes.
- Modifying reveal/move behavior.

## Deliverables
- Contract updates in `packages/contracts/src/main.nr` (init validation).
- Tests in `packages/contracts/src/test/darkforest_stub.nr`.

## Tests / Commands
- `yarn contracts:test:nr`

## Status
- Archived (2026-01-08).

## Notes
- v0.6 `LibPlanet._initializePlanet` reverts if a planet is already initialized; Noir `apply_player_action` mirrors this via `assert(!existing_planet.is_initialized)` in action `0` (`init_player`).
- Tests already cover the guard: `test_fail_init_player_on_initialized_planet` (reveal -> init) and `test_fail_init_player_duplicate`.
