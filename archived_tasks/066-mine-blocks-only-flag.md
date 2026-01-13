# Ticket 066 - Mine blocks only flag for local script

## Goal
Add an option to the local dev script to mine blocks only without rebuilding or redeploying.

## Acceptance Criteria
- `scripts/df-local.sh` supports a new flag (e.g. `--mine-only`) that starts the block-miner without redeploying.
- The new flag skips build and deploy steps.
- Existing flags and behavior remain unchanged.

## Out of Scope
- Contract logic changes.
- Client changes.

## Deliverables
- Updated `scripts/df-local.sh` with the new flag and behavior.

## Tests / Commands
- Not required (script-only change).

## Status
- Archived (2026-01-08).

