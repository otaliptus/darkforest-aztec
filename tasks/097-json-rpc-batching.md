# Ticket 097 - Enable JSON-RPC batching for Aztec node reads

## Goal
Reduce client request storms by enabling JSON-RPC batch windows for Aztec node calls.

## Acceptance Criteria
- Client config supports `AZTEC_RPC_BATCH_WINDOW_MS` (and `VITE_` variant) with a default.
- `createAztecNodeClient` uses the configured batch window.
- Docs and local env template mention the new variable.
- No contract changes.

## Out of Scope
- Contract logic or ABI changes.
- Indexer/snapshot changes.
- Gameplay logic changes.

## Deliverables
- Batched JSON-RPC setup for the Aztec node client.
- Documentation updates.

## Tests / Commands
- `yarn client:build`

## Results
- Added `AZTEC_RPC_BATCH_WINDOW_MS` to client config + docs and wired into `createAztecNodeClient`.
- Build succeeded with existing warnings (LinkContainer export missing in `UnsubscribePage`, aztec bb.js sourcemap warnings, bundle size warnings).

## Status
- Completed (2026-01-09)
