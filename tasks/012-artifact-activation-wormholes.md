# Ticket 012 - Artifact activation/deactivation + wormhole/photoid move effects

## Goal
Port v0.6 artifact activation/deactivation (non‑spaceship artifacts), including planet buffs, wormholes, bloom/black‑domain effects, and photoid move delay.

## Acceptance Criteria
- `Artifact` stores activation state (`activations`, `last_activated`, `last_deactivated`, `wormhole_to`).
- `Planet` stores `is_destroyed` (used by black domain + action guards).
- Add internal helpers mirroring v0.6:
  - `is_active`, `get_active_artifact(location_id)`.
  - `upgrade_for_artifact` + `time_delay_upgrade` (Photoid).
  - `buff_planet` / `debuff_planet` (multipliers in percent).
- Implement `private activate_artifact` → `public apply_activate_artifact (only_self)`:
  - planet initialized, not destroyed, owner‑only.
  - artifact is on planet, non‑spaceship, not already active elsewhere on planet.
  - cooldown per v0.6 table (block‑based).
  - wormhole: requires `wormhole_to != 0`, target planet owned by caller and not destroyed.
  - bloom filter: `2*rarity >= planet_level`, set population + silver to caps, then burn.
  - black domain: `2*rarity >= planet_level`, set `is_destroyed = true`, then burn.
  - otherwise activate + buff planet; `activations++`, set `last_activated`.
- Implement `private deactivate_artifact` → `public apply_deactivate_artifact (only_self)`:
  - owner‑only, planet not destroyed, must have active artifact.
  - set `last_deactivated`, clear `wormhole_to`, debuff planet.
  - burn on deactivation for planetary shield + photoid cannon (v0.6).
- Move integration:
  - Wormhole: if active wormhole from origin→dest or dest→origin, scale effective distance by rarity table and set `arrival_type = WORMHOLE`.
  - Photoid: if active and delay elapsed, auto‑deactivate, set `arrival_type = PHOTOID`, apply temporary upgrade for that move.
- Arrival resolution:
  - Wormhole arrivals do not apply combat when attacker != owner (v0.6 behavior).
- Tests cover:
  - Activation + deactivation success/failure (cooldown or wrong planet type).
  - Wormhole travel time reduction + arrival type.
  - Photoid auto‑deactivate + temporary upgrade + arrival type.
  - Bloom filter caps + burn; Black domain destroys + burn.
- No unbounded loops in public functions (only bounded max‑5 artifact scans).

## Out of Scope
- Spaceships and spaceship moves.
- Artifact NFT mint/transfer integration (separate ticket).
- Client UI wiring.

## Deliverables
- Updated contracts + tests in `packages/contracts`.

## Status
- Added activation fields on `Artifact` plus activation helpers (active checks, upgrades, buffs).
- Implemented activate/deactivate flows with bloom/black-domain burns and wormhole/photoid move effects + arrival type handling.
- Tracked destroyed planets in a dedicated `planet_destroyed` map instead of a `Planet.is_destroyed` field to stay within public SSTORE limits.
- Reduced writes in `apply_move` (skip intermediate planet writes; inline photoid deactivation) to avoid SSTORE limit when photoid fires.
- Added tests for wormhole travel, photoid auto‑deactivate + temp upgrade, bloom cap burn, black domain destroy, cooldown failure.

## Tests
- `yarn workspace @darkforest-aztec/contracts compile` (warnings: unused globals)
- `yarn contracts:test:nr` (28 tests passed)
