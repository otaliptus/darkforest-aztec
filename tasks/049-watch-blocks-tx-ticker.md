# Ticket 049: Add tx ticker to block watcher

## Goal
Extend the block watcher to optionally submit a tiny tx when L2 blocks are stalled.

## Acceptance criteria
- `packages/contracts/scripts/watch_blocks.js` supports `TICK_TX=1` (or `--tick`) to enable tx ticking.
- When enabled, script sends a tx only if the L2 block number has not advanced for `TICK_EVERY_MS` (default 5000ms).
- Tx uses the initial test account (index from `ACCOUNT_INDEX` or `VITE_ACCOUNT_INDEX`) and the deployed DarkForest address (from `DARKFOREST_ADDRESS` or `VITE_DARKFOREST_ADDRESS`).
- If `TICK_LOCATION_ID` is not set, script reads the admin’s `home_planet` from public storage and uses it.
- Graceful error message if DarkForest address / admin account mismatch.
- Keeps existing block logging behavior.

## Notes
This is local‑dev only. Using admin_set_planet_owner(homePlanet, admin) is OK for ticking.

## Status
- Archived (2026-01-08).
