# 071-existing-deploy-benchmark

## Acceptance criteria
- Run the single-move benchmark with proving enabled against an existing deployment (no deploy).
- Capture timing metrics for move + resolve and any relevant environment notes.
- Record the exact command used and the results in this ticket.

## Plan
- Reuse the latest deployed DarkForest/NFT addresses.
- Run `bench:move` with those addresses and the 4s tick interval.
- Record output + timing metrics.

## Planned files
- `tasks/071-existing-deploy-benchmark.md`
- `packages/contracts/scripts/bench_move.js`

## Results
- Node port 8080 and L1 port 8545 were open; admin port 8880 was closed, so sequencer config adjustment failed (non-fatal).
- Reused the existing deployment and existing player (account 0) with `USE_EXISTING_PLAYER=true` to avoid re-init.

### Command
```
DARKFOREST_ADDRESS=0x0680418fc56ca1025cab04c49b7e1e7be21e00cdd807b71a269750b1ff63287e \
NFT_ADDRESS=0x132dabc105bcea3c42b87636d537ae312bf782184d6ea25202c7d7f3db9d2983 \
USE_EXISTING_PLAYER=true INIT_X=990 INIT_Y=0 \
PROVER_ENABLED=true TICK_PROVER_ENABLED=false BLOCK_INTERVAL_MS=4000 \
TX_TIMEOUT_MS=600000 BLOCK_TIMEOUT_MS=600000 ACCOUNT_INDEX=0 \
  yarn workspace @darkforest-aztec/contracts bench:move --no-deploy
```

### Output (key lines)
- move_ms: 23,153 ms
- resolve_wait_ms: 14,544 ms
- resolve_tx_ms: 23,294 ms
- tick_block: 3,262 ms (no-prover tick wallet)
- total wall time (yarn): ~88.1 s

### Notes
- The run logged an `Existing nullifier` warning during move, but the tx still succeeded and the benchmark completed.
- Random account mode failed with insufficient fee payer balance (no sponsored fee payer configured).

## Status
- Archived (2026-01-08).
