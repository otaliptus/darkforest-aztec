# Ticket 109 - Artifact randomness strategy and parity

## Goal
Ensure artifact seed generation is unpredictable (as in v0.6) while preserving distribution parity and documenting the entropy source.

## Background / Motivation
Current logic uses a pseudo blockhash derived from block number + planethash key. This is deterministic and potentially predictable. The grant expects faithful behavior for artifact discovery and minting.

## Scope (In)
- Decide and document the entropy source for artifact seed (Aztec randomness oracle if available, or justified alternative).
- Update `artifact_seed` logic to incorporate the chosen entropy source.
- Preserve v0.6 distribution (type and level bonus) for any fixed seed.
- Add tests verifying parity of type/bonus selection for known seeds.

## Out of Scope
- Rebalancing artifact rarities or changing the v0.6 selection algorithm.

## Acceptance Criteria
- A short doc explains the randomness source and predictability assumptions.
- Contract uses the chosen entropy source to derive artifact seeds.
- Tests pass and confirm type/bonus selection parity with v0.6.

## Implementation Notes
- Maintain `random_artifact_type_and_level_bonus` behavior.
- Keep deterministic behavior in tests by injecting fixed randomness during test runs.

## Deliverables
- Contract update: `packages/contracts/src/main.nr`.
- Tests: `packages/contracts/src/test/darkforest_stub.nr` additions.
- Doc: `docs/randomness.md` (or similar).

## Tests / Commands
- `yarn contracts:test:nr`

## Dependencies
- Aztec randomness API details (current docs).

## Status
- Open

## Notes
- If randomness oracle cannot be used in private context, document limitation and mitigation.
