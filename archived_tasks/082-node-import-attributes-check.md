# Ticket 082 - Preflight node import attributes for mine-blocks

## Goal
Fail fast with a clear error if Node can't parse `import ... with { type: 'json' }` used by Aztec packages when running `aztec-tick.mjs`.

## Acceptance Criteria
- `scripts/df-local.sh` checks for import attributes support before starting mine-blocks.
- On unsupported Node, the script exits with a clear upgrade message.
- No contract/client logic changes.

## Out of Scope
- Upgrading Node toolchains.
- Modifying Aztec dependencies.

## Deliverables
- Updated `df-local.sh` with a preflight check.

## Tests / Commands
- None.

## Status
- Archived (2026-01-09)
