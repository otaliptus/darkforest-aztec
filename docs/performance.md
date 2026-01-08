# Performance Notes

## 2026-01-08 (Local devnet, Aztec CLI 3.0.0-devnet.20251212)

Environment:
- Local Aztec network via `aztec start --local-network --node --sequencer --pxe --archiver`
- Node URL: `http://localhost:8080`
- Benchmark command: `PROVER_ENABLED=true node packages/contracts/scripts/bench_move.js --deploy`

Observed timings (end-to-end tx: proof → send → acceptance):
- `init_player`: 36,984 ms
- `move`: 37,456 ms

Notes:
- First ClientIVC proof generation after starting the node was very slow (~1,033,415 ms),
  likely due to CRS warm-up. Subsequent proofs were 16–26s.
- The benchmark was interrupted during the resolve flow, so `resolve_wait_ms`/`resolve_tx_ms`
  are not recorded here.

Conclusion:
- A single move turn measured < 60s in this run.
