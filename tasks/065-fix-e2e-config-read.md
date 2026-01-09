# Ticket 065 - Fix E2E config field alignment + re-run with proofs

## Goal
Fix the E2E script's config reader to match on-chain `GameConfig` field order and re-run the proven E2E flow.

## Acceptance Criteria
- `packages/contracts/scripts/e2e_darkforest.js` reads all 14 `GameConfig` fields in the correct order (including `time_factor_hundredths`).
- `yarn workspace @darkforest-aztec/contracts test:e2e` runs with `PROVER_ENABLED=true` and completes, or reports the next blocking failure with logs.

## Out of Scope
- Contract logic changes.
- UI changes.

## Deliverables
- Updated E2E script.
- A recorded E2E run result.

## Tests / Commands
- `PROVER_ENABLED=true TX_TIMEOUT_MS=600000 BLOCK_TIMEOUT_MS=600000 AZTEC_NODE_URL=http://localhost:8080 AZTEC_NODE_ADMIN_URL=http://localhost:8880 L1_RPC_URL=http://localhost:8545 yarn workspace @darkforest-aztec/contracts test:e2e`

## Status
- Archived (2026-01-08).

