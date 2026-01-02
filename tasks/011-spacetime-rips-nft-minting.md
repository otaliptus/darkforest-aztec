# Ticket 011 - Spacetime rips + NFT minting

## Goal
Implement spacetime rip (trading post) artifact deposit/withdraw and mint Aztec-native NFTs on withdrawal.

## Acceptance Criteria
- Add bounded per-planet artifact list (max 5) plus artifact ownership/location mappings.
- `find_artifact` inserts into the planet artifact list and initializes ownership/location state.
- `private deposit_artifact` → `public apply_deposit_artifact (only_self)` enforces v0.6 rules:
  - planet initialized, type TRADING_POST, owner-only.
  - artifact exists, non-spaceship, planet level > artifact rarity.
  - caller owns the NFT; planet has capacity < 5.
  - transfer ownership to contract + place on planet.
- `private withdraw_artifact` → `public apply_withdraw_artifact (only_self)` enforces v0.6 rules:
  - planet initialized, type TRADING_POST, owner-only.
  - artifact present on planet, non-spaceship, planet level > artifact rarity.
  - remove from planet list + transfer/mint ownership to caller.
- Tests cover:
  - happy path (find → withdraw → deposit → withdraw).
  - failure when not a spacetime rip (or ownership/level violation).
- No unbounded loops in public functions.

## Out of Scope
- Artifact movement with fleets or voyages.
- Activation/deactivation logic and spaceship behavior.
- Spacetime rip silver withdraw/deposit.
- Client UI wiring.

## Deliverables
- Updated contracts + tests for spacetime rip deposit/withdraw + NFT ownership.

## Status
- Added `PlanetArtifacts` list + artifact ownership/location maps; updated `find_artifact` to populate them.
- Implemented deposit/withdraw spacetime rip flow with private→public apply and NFT ownership transfers.
- Added admin helper to set planet type/level for deterministic tests.
- Added tests for withdraw/deposit roundtrip + failure when not a trading post; updated find-artifact assertions for new storage.

## Tests
- `yarn workspace @darkforest-aztec/contracts clean`
- `yarn workspace @darkforest-aztec/contracts compile` (fails: Docker permission denied on this machine)
