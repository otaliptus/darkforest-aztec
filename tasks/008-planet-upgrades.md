# Ticket 008 - Planet upgrades (silver spend)

## Goal
Port the v0.6 planet upgrade flow (three branches, costs, caps) into the Aztec Noir contract.

## Acceptance Criteria
- `Planet` stores upgrade branch levels (defense/range/speed).
- Upgrade multipliers match v0.6 constants (DEFENSE/RANGE/SPEED, 4 levels each).
- `private upgrade_planet` → `public apply_upgrade_planet (only_self)` enforces v0.6 rules:
  - owner-only, planet level > 0, planet type PLANET.
  - total level caps by space type (nebula < 3, space < 4, deep/dead < 5).
  - branch level < 4.
  - cost = (silver_cap * 20 * (totalLevel + 1)) / 100, must have enough silver.
  - apply multipliers, subtract cost, increment branch level.
- Tests cover successful upgrade and failure cases (insufficient silver or invalid branch/level).
- No unbounded loops in public functions.

## Out of Scope
- Artifact, spacetime rips, or NFT minting.
- Client UI/UX changes.
- Admin/debug helpers.

## Deliverables
- Updated `packages/contracts` logic + tests for upgrades.

## Status
- Archived (2026-01-08).

## Tests
- `yarn workspace @darkforest-aztec/contracts compile`
- `yarn contracts:test:nr`
