# Ticket 107 - End-to-end turn performance harness

## Goal
Produce a repeatable benchmark for the RFPG requirement: a single player turn must complete in under 60 seconds (from proof generation start to tx submitted to the Aztec mempool).

## Background / Motivation
Performance is a grant non-negotiable. We currently lack a consistent measurement harness and a record of p50/p95 timings. This ticket adds instrumentation + a repeatable script so we can prove progress and regressions.

## Scope (In)
- Define a precise measurement for "turn":
  - Start: proof generation begins for an action (init/reveal/move).
  - End: transaction submitted and accepted by the Aztec mempool (tx hash returned).
- Implement a benchmark script that runs N turns (default 10) against local devnet.
- Capture per-step timings (proof, build, send, mempool ack) and compute p50/p95/max.
- Emit results in JSON + human-readable summary.
- Record environment details (machine, node version, Aztec version, config).

## Out of Scope
- Large refactors of proof generation logic.
- Production telemetry or analytics.

## Acceptance Criteria
- A script exists that runs a deterministic turn sequence (e.g., init + reveal + move) and records timings.
- Output includes per-turn timings and aggregate p50/p95/max.
- If p95 > 60s, the script exits non-zero (threshold configurable).
- Results are documented in a `docs/perf/turn-benchmark.md` entry with date and environment.

## Implementation Notes
- Use monotonic timing (performance.now or process.hrtime).
- Provide environment knobs:
  - TURN_BENCHMARK_RUNS (default 10)
  - TURN_BENCHMARK_THRESHOLD_SEC (default 60)
- Keep the benchmark out of the normal client build pipeline.

## Deliverables
- Script: `apps/client/scripts/turn_benchmark.ts` (or `packages/contracts/scripts/turn_benchmark.ts`).
- Results doc: `docs/perf/turn-benchmark.md`.
- Optional: CSV/JSON output file in `docs/perf/results/`.

## Tests / Commands
- `yarn workspace @darkforest-aztec/client ts-node apps/client/scripts/turn_benchmark.ts`
- Or: `node apps/client/scripts/turn_benchmark.js` (if compiled).

## Dependencies
- Local Aztec devnet running and reachable.
- Contract deployed + client config values present.

## Status
- Open

## Notes
- This ticket is focused on measurement, not optimization.
