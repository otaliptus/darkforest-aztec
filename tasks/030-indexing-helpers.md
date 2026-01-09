# Ticket 030 - Optional indexing helpers for client state

## Goal
Provide optional local indexing helpers to speed up client state hydration.

## Acceptance Criteria
- A lightweight indexer or snapshot script can build a local cache from contract state.
- Client can optionally read from the cache if enabled.
- Documentation explains how to run and disable the indexer.

## Out of Scope
- Production hosting or third-party indexing services.
- Mandatory runtime dependencies for gameplay.

## Deliverables
- Scripts under `packages/contracts/scripts` or `apps/client/src/scripts`.
- Documentation in `docs/` or README.

## Tests / Commands
- `yarn workspace @darkforest-aztec/contracts test:e2e` (if scripts affect flows)
- Manual run of the indexer script.

## Status
- Archived (2026-01-08).

