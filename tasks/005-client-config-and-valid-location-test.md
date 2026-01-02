# Ticket 005 - Client config params + valid location integration test

## Goal
Update client-side contract calls to include perlin config parameters for private init/reveal, and add an integration test that uses real PLANET_RARITY with a known-valid location.

## Acceptance Criteria
- Client scripts pass perlin config args to `init_player` and `reveal_location`.
- Integration test uses PLANET_RARITY=16384 and a precomputed valid (x,y) for the configured PLANETHASH_KEY.
- Relevant tests/commands run.

## Out of Scope
- New gameplay features beyond init/reveal.
- Client UI polish or gameplay changes.

## Deliverables
- Updated client scripts.
- Added integration test in `packages/contracts`.
