# Ticket 048: Add block watcher script

## Goal
Provide a small terminal script to print L2 block tips from the local Aztec node.

## Acceptance criteria
- Script exists at `packages/contracts/scripts/watch_blocks.js` (ESM).
- Script connects to `AZTEC_NODE_URL` (default `http://localhost:8080`).
- Prints latest/proven/finalized L2 block numbers (and latest block timestamp if available).
- Poll interval is configurable via `BLOCK_POLL_MS` (default 1000ms).
- Exits cleanly on Ctrl-C.
- No contract or client logic changes.

## Notes
Use `createAztecNodeClient` + `waitForNode` from `@aztec/aztec.js/node`.
