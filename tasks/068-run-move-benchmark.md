# 068-run-move-benchmark

## Acceptance criteria
- Run the single-move benchmark (option 1) with proving enabled.
- Capture timing metrics (move + optional resolve) and any relevant environment notes.
- Record the exact command used and the results in this ticket.
- If account deploy hits an Existing nullifier error, the benchmark should continue instead of hard-failing.

## Plan
- Check local node/L1 ports.
- Run `bench:move` with PROVER_ENABLED=true.
- Record output + timing metrics.

## Planned files
- `tasks/068-run-move-benchmark.md`
- `packages/contracts/scripts/bench_move.js`

## Results
- Node port 8080 and L1 port 8545 were open; admin port 8880 was closed, so sequencer config adjustment failed (non-fatal).
- First two attempts failed with `Invalid tx: Existing nullifier` during account deploy; patched `bench_move.js` to ignore this (see changes below), then reran successfully.

### Command
```
PROVER_ENABLED=true TX_TIMEOUT_MS=600000 BLOCK_TIMEOUT_MS=600000 ACCOUNT_INDEX=1 \
  yarn workspace @darkforest-aztec/contracts bench:move --no-resolve
```

### Output (key lines)
- init_player: 24,261 ms
- move_ms: 23,410 ms
- total wall time (yarn): ~142.0 s
