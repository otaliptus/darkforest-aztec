# Ticket 060 - Single-File Local Runner

## Goal
Provide a single entrypoint script for local dev that can deploy, set tiny map defaults, start block mining by sending a tx per tick, and run the web client.

## Acceptance Criteria
- `scripts/df-local.sh` supports a one-shot mode to deploy + mine blocks + run the client in one command.
- The mine-blocks helper sends a simple admin tx each interval without requiring a player to be initialized in the client.
- Defaults are tuned for tiny local maps (smaller radius, sparser planets, faster time factor), with flags to override.

## Plan
1) Extend `scripts/df-local.sh` with a one-shot flag and new config defaults/flags.
2) Adjust `aztec-tick.mjs` to use a dummy location id and skip the admin player init requirement.
3) Keep usage/logging clear so local workflow is obvious.

## Touch Points
- `scripts/df-local.sh`
- `aztec-tick.mjs`

## Side Effects
- The runner will spawn long-lived processes (client dev server + tick tx loop).
- The tick tx mutates a dummy planet slot on each tick.

## Non-Goals
- Changing contract logic or Aztec node block production settings.

## Status
- Archived (2026-01-08).
