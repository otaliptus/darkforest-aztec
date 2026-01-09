# 070-fast-blocktime-benchmark

## Acceptance criteria
- Add a local-only benchmark option to target a 4s block interval without changing global node config.
- Run the single-move benchmark with proving enabled and the faster block interval.
- Record the exact command and timing metrics (move + resolve + wait) in this ticket.

## Plan
- Add a block-interval override + fast tick wallet option to `bench_move.js`.
- Run the benchmark with a 4s interval.
- Record results and environment notes.

## Planned files
- `packages/contracts/scripts/bench_move.js`
- `tasks/070-fast-blocktime-benchmark.md`

## Results
- Node port 8080 and L1 port 8545 were open; admin port 8880 was closed, so sequencer config adjustment failed (non-fatal).
- Enabled a 4s block interval in the benchmark and used a no-prover tick wallet to avoid global config changes.

### Command
```
PROVER_ENABLED=true TICK_PROVER_ENABLED=false BLOCK_INTERVAL_MS=4000 \
  TX_TIMEOUT_MS=600000 BLOCK_TIMEOUT_MS=600000 ACCOUNT_INDEX=0 \
  yarn workspace @darkforest-aztec/contracts bench:move
```

### Output (key lines)
- move_ms: 24,215 ms
- resolve_wait_ms: 12,709 ms
- resolve_tx_ms: 22,063 ms
- tick_block: 2,365 ms (no-prover tick wallet)
- total wall time (yarn): ~176.3 s

## Status
- Archived (2026-01-08).
