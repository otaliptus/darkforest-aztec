# Ticket 021 - Repository review + end-to-end integration test

## Goal
Deliver a detailed repository review (status, risks, priorities) and add a headless end-to-end integration test that exercises all Dark Forest contract entry points without the UI.

## Acceptance Criteria
- A written review file `review-<date>-<time>.md` captures progress, current stage assessment, key risks, and prioritized remaining work.
- A headless end-to-end integration test script runs against a local Aztec node and covers all gameplay entry points:
  - `init_player`, `reveal_location`, `move`, `resolve_arrival`
  - `upgrade_planet`, `prospect_planet`, `find_artifact`
  - `trade_artifact` (deposit + withdraw)
  - `set_artifact_activation` (activation + deactivation)
  - `give_space_ships`
- Test asserts on-chain state transitions (public storage / NFT ownership) for each step.
- Test is runnable via a package script.

## Out of Scope
- UI changes.
- Contract logic changes.
- Mainnet or devnet deployments.

## Deliverables
- `review-<date>-<time>.md` in repo root.
- `packages/contracts/scripts/e2e_darkforest.js` (or equivalent) with E2E flow and assertions.
- `packages/contracts/package.json` updated with a `test:e2e` script.

## Tests / Commands
- `yarn workspace @darkforest-aztec/contracts test:e2e`

## Status
- Archived (2026-01-08).

## Notes
- Use local node defaults (`http://localhost:8080`) and sponsored fees if available.
- Reuse contract config constants from on-chain config or default deploy script.
