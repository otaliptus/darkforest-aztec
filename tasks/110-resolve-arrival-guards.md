# Ticket 110: Resolve Arrival Guards (In-Flight + Error Recheck)

## Context
Resolve arrival txs are frequently reverting under long proving times or when other moves touch the same planet. We want to reduce avoidable resolve attempts and clean up local state when the chain already resolved the arrival.

## Acceptance Criteria
- Skip resolving an arrival if the client has any unconfirmed `move` tx that touches the same planet (from or to), with a single, deduped log explaining the skip.
- When `resolve_arrival` fails, re-check on-chain arrival state and:
  - if the arrival is already missing/resolved, clear the local arrival and log a clean summary instead of repeated errors.
  - if the arrival still exists, keep it and leave a trace explaining why we will retry later.
- Logging includes enough metadata to explain why a resolve was skipped or rechecked (arrival id, planet, inflight tx ids, current block).
- No changes under `reference/`.

## Notes
- Handle edge cases: simultaneous attacks, long proving, stale local state, and other-player txs we learn about late.
- Keep resolve loop bounded (no new unbounded loops).
