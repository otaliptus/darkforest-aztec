# Ticket 059 - Mine Blocks Helper

## Goal
Make local block production reliable by sending a simple tx every tick (no L1 mining loop).

## Acceptance Criteria
- `scripts/df-local.sh` flag is `--mine-blocks` (replaces `--fast-blocks`).
- The helper sends a transaction every interval so each tick produces a new L2 block.
- The script no longer depends on L1 mining RPC for this mode.

## Plan
1) Update `aztec-tick.mjs` to send a no-op admin tx each interval and drop L1 mining logic.
2) Rename flag/labels in `scripts/df-local.sh` to `--mine-blocks` and call the helper.
3) Keep logging clear about what is running and how to stop it.

## Touch Points
- `aztec-tick.mjs`
- `scripts/df-local.sh`

## Side Effects
- More frequent txs may spam logs; interval controls cadence.
- Requires admin account to be initialized before running.

## Non-Goals
- Changing contract logic or block timing parameters in Aztec itself.
