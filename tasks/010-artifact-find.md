# Ticket 010 - Artifact structs + biomebase validation + findArtifact

## Goal
Introduce artifact data structures, biomebase validation, and `findArtifact` flow (no NFT mint yet) consistent with v0.6.

## Acceptance Criteria
- Add artifact types in `packages/contracts/src/types.nr`:
  - `ArtifactRarity`, `ArtifactType`, `Biome`, `Artifact`, `ArtifactWithMetadata` (or minimal subset needed by find).
- Add per-planet artifact state for prospecting + “has tried finding” (reuse `PlanetArtifactState`).
- Implement `private validate_biomebase(...)` (or reuse helper) and `private find_artifact(...)` → `public apply_find_artifact (only_self)`:
  - Enforce v0.6 conditions: owner-only, ruins, prospected block set, not already tried, within blockhash window, not destroyed (if tracked).
  - Compute biome from spaceType + biomebase.
  - Deterministically derive artifact seed from (locationId, contract addr, blockhash(prospectedBlock)).
  - Determine artifact type + level bonus per v0.6 rules; set rarity from planet level + bonus.
  - Persist artifact + link to planet; set `has_tried_finding_artifact = true`.
- Tests cover:
  - successful find after prospect + biomebase validation.
  - failure when not prospected / already tried / wrong planet type.
- No unbounded loops in public functions.

## Out of Scope
- NFT minting / ERC721 handling.
- Deposit/withdraw/activate artifacts or wormholes/spaceships.
- Client UI changes.

## Deliverables
- Updated `packages/contracts` logic + tests for `find_artifact` + biomebase validation.

## Status
- Added artifact/biome types + minimal `Artifact` structs in `packages/contracts/src/types.nr`.
- Added `biomebase_key` to `GameConfig` and constructor; added artifact + planet-artifact storage maps.
- Implemented `find_artifact`/`apply_find_artifact` with biomebase validation, v0.6 artifact selection/rarity rules, and artifact persistence.
- Added find-artifact tests (success + three failure cases) in `packages/contracts/src/test/darkforest_stub.nr`.
- Note: Aztec public context doesn’t expose blockhash; the artifact seed uses a deterministic MiMC hash of `prospected_block_number` as a stand‑in.

## Tests
- `yarn workspace @darkforest-aztec/contracts clean`
- `yarn workspace @darkforest-aztec/contracts compile` (warnings: unused artifact/biome constants)
- `yarn contracts:test:nr`
