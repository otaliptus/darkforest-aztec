# Ticket 007 - Planet defaults + level/type/space type

## Goal
Port v0.6 planet classification and default stat initialization (level/type/space type) into the Aztec Noir contract.

## Acceptance Criteria
- `Planet` stores `planet_level`, `planet_type`, `space_type`, and `is_home_planet`.
- `GameConfig` (or equivalent constants) includes v0.6 perlin thresholds, planet level thresholds, planet type weights, time factor, and max natural level.
- `apply_init_player` and `apply_reveal` initialize planets using v0.6 default stats (space type multipliers, boost flags, planet type modifiers, barbarian population, mine starting silver).
- Home planet init enforces v0.6 constraints (level 0 + PLANET type) and sets population to 50000.
- Tests cover initialization defaults + classification (level/type/space type) and fail when home planet constraints are violated.
- No unbounded loops in public functions.

## Out of Scope
- Population/silver growth refresh.
- Upgrades, artifacts, spacetime rips, or NFTs.
- Client UI changes.

## Deliverables
- Updated `packages/contracts` logic for planet classification + defaults.
- New/updated tests under `packages/contracts/src/test/`.

## Status
- Archived (2026-01-08).
