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
- Done (2026-01-04).
- E2E run completed on local network with tx-driven blocks (`SEQ_ENFORCE_TIME_TABLE=false`), `tick_block` fallback, and ~8.1 min runtime.
- Command:
  - `TX_TIMEOUT_MS=600000 BLOCK_TIMEOUT_MS=600000 AZTEC_NODE_URL=http://localhost:8080 AZTEC_NODE_ADMIN_URL=http://localhost:8880 L1_RPC_URL=http://localhost:8545 yarn workspace @darkforest-aztec/contracts test:e2e`
- Note: `nodeAdmin_setConfig` is not reachable on `--local-network`; empty-block config must be set at node startup and was unstable with `minTxsPerBlock=0`.

## Notes
- Use local node defaults (`http://localhost:8080`) and sponsored fees if available.
- Reuse contract config constants from on-chain config or default deploy script.
