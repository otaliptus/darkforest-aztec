# Ticket 041 - Super-tight local map + higher home energy

## Goal
Make local dev play faster by shrinking the world and reducing planet density, plus boost starting home-planet energy for quick conquest testing.

## Acceptance Criteria
- Local deploy uses a much smaller `world_radius` with higher `planet_rarity` (fewer planets) for dev runs.
- Home planet starts with higher population/energy in local dev builds.
- Tests/constants updated to match the new home population value.
- No unbounded loops added.

## Out of Scope
- Production/mainnet config changes.
- Gameplay mechanics changes beyond local dev defaults.

## Deliverables
- Updated contract constant for home population.
- Updated contract tests.
- Redeploy with tight map settings.

## Tests / Commands
- `yarn contracts:compile`
- `yarn workspace @darkforest-aztec/contracts deploy:local --write-env --overwrite-env`

## Status
- Archived (2026-01-08).

