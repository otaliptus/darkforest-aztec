# Ticket 088 - Human-readable arrival resolve logging

## Goal
Provide clear, human-readable client logs for arrival resolve failures so debugging is possible without digging into raw stack traces.

## Acceptance Criteria
- Arrival resolve attempts log a single, readable line with arrivalId, fromPlanet, toPlanet, arrivalBlock, currentBlock, owner, energy, artifacts length, and tx hash (if available).
- Resolve failures include the same metadata plus the error reason and whether the arrival was already resolved/missing.
- Logs are gated behind existing verbose/detailed logging env flags to avoid noise by default.
- No contract changes.

## Out of Scope
- Server/indexer changes.
- UI redesign.

## Deliverables
- Client-side logging improvements around resolve arrival flows.
- Doc or inline note pointing to how to enable the logs.

## Tests / Commands
- Manual: perform a move and observe logs around resolve arrival.

## Status
- Archived (2026-01-09)
