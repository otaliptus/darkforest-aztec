# Ticket 009 - Prospect ruins (artifact precursor)

## Goal
Add v0.6-style prospecting on ruins planets so the artifact flow can be layered in next.

## Acceptance Criteria
- Per-planet prospect state stores `has_tried_finding_artifact` and `prospected_block_number` (kept in a dedicated map to stay under public SSTORE limits).
- `private prospect_planet` → `public apply_prospect_planet (only_self)` enforces:
  - planet initialized, owner-only.
  - planet type RUINS.
  - `prospected_block_number == 0`.
  - sets `prospected_block_number = current_block`.
- Tests cover a successful prospect and a failure case (non-ruins).
- No unbounded loops in public functions.

## Out of Scope
- Artifact creation/minting, deposit/withdraw, activation.
- Biomebase proof validation.
- Client UI/UX changes.
- Admin helpers outside tests.

## Deliverables
- Updated `packages/contracts` logic + tests for prospecting.

## Status
- Added `PlanetArtifactState` map and `prospect_planet`/`apply_prospect_planet` flow in `packages/contracts/src/main.nr`.
- Added admin-only `admin_set_planet_owner` helper to make the prospect test deterministic.
- Added/updated tests for prospect success + failure in `packages/contracts/src/test/darkforest_stub.nr`.

## Tests
- `yarn workspace @darkforest-aztec/contracts compile`
- `yarn contracts:test:nr`
