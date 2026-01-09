# Ticket 013 - Spaceships + artifact voyages + abandonment/space junk

## Goal
Port v0.6 spaceship mechanics, artifact‑carrying moves, and abandonment/space‑junk logic.

## Acceptance Criteria
- `Player` adds: `claimed_ships`, `space_junk`, `space_junk_limit`.
- `Planet` adds: `space_junk`, `energy_gro_doublers`, `silver_gro_doublers`, `pausers`.
- `give_space_ships` (private→public apply) mints up to 5 ships on home planet once per player.
- Spaceship move rules:
  - `pop_moved == 0` and `silver_moved == 0`.
  - controller‑only for ship artifacts.
  - apply spaceship depart/arrive effects (Mothership/Whale doublers, Titan pauser, Crescent silver‑mine conversion).
- Artifact voyages:
  - `move` supports carrying an artifact id.
  - Remove artifact from origin on departure, attach to destination on arrival.
  - Enforce per‑planet artifact cap.
- Abandonment:
  - Only if no incoming arrivals and not home planet.
  - Sends full pop/silver, transfers ownership to zero, sets space‑junk per v0.6.
  - Applies abandoning range/speed boost for that move.
- Tests cover:
  - Claim ships once; spaceship move validity; depart/arrive effects.
  - Artifact‑carrying arrivals and cap enforcement.
  - Abandon success + failure.
- No unbounded loops in public functions.

## Out of Scope
- NFT integration.
- Client UI.

## Deliverables
- Updated contracts + tests in `packages/contracts`.

## Status
- Archived (2026-01-08).

## Tests
- `yarn workspace @darkforest-aztec/contracts compile`
- `yarn contracts:test:nr` (36 tests passed)
