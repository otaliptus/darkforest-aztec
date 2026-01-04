# Ticket 029 - Logging/observability improvements

## Goal
Improve error reporting and logging across client and scripts for faster debugging.

## Acceptance Criteria
- Client logs include tx lifecycle details (prove/send/confirm durations) with clear error stacks.
- Script logs include key parameters, tx hashes, and elapsed time per step.
- Logging verbosity can be toggled via env or config.

## Out of Scope
- External logging services.
- UI redesign.

## Deliverables
- Client logging updates in `apps/client/src`.
- Script logging updates in `packages/contracts/scripts`.

## Tests / Commands
- `yarn client:dev`
- `yarn workspace @darkforest-aztec/contracts test:e2e`

## Status
- Pending.
