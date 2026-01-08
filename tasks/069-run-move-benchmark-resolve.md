# 069-run-move-benchmark-resolve

## Acceptance criteria
- Run the single-move benchmark with proving enabled and resolve enabled.
- Capture timing metrics for move + resolve (wait + tx) and relevant environment notes.
- Record the exact command used and the results in this ticket.

## Plan
- Check local node/L1 ports.
- Run `bench:move` with PROVER_ENABLED=true.
- Record output + timing metrics.

## Planned files
- `tasks/069-run-move-benchmark-resolve.md`

## Results
- Node port 8080 and L1 port 8545 were open; admin port 8880 was closed, so sequencer config adjustment failed (non-fatal).
- Observed `Invalid tx: Existing nullifier` log during NFT deploy step, but deploy completed and the benchmark continued.

### Command
```
PROVER_ENABLED=true TX_TIMEOUT_MS=600000 BLOCK_TIMEOUT_MS=600000 ACCOUNT_INDEX=2 \
  yarn workspace @darkforest-aztec/contracts bench:move
```

### Output (key lines)
- init_player: 24,003 ms
- move_ms: 23,393 ms
- resolve_wait_ms: 36,645 ms
- resolve_tx_ms: 22,087 ms
- total wall time (yarn): ~200.5 s
