# Ticket 100 - Refactor df-local.sh flags

## Goal
Refactor the local runner flags to remove broken/unused options and adjust foreground mining behavior.

## Acceptance Criteria
- `scripts/df-local.sh` no longer accepts `--mine-blocks`, `--block-time`, or `--tick-interval`.
- `--mine-foreground` requires a numeric seconds parameter `N` and waits `N` seconds before mining a block each loop.
- `--run` is removed; `--deploy` remains as the deployment flag.
- Planet rarity and radius flags/behavior remain available.
- Help/usage text reflects the new flags and behavior.

## Notes
- Keep changes scoped to the local dev script.
