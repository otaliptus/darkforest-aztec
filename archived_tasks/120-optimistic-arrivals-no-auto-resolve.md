# Ticket 120 - Optimistic Arrivals + Optional Auto-Resolve

## Goal
Reduce client-side proving load and improve perceived responsiveness by letting the UI apply mature arrivals locally while optionally disabling automatic `resolve_arrival` proofs.

## Acceptance Criteria
- A client feature flag controls whether auto-resolve of arrivals runs.
- When auto-resolve is disabled, the client applies mature arrivals locally so planet state updates without waiting for on-chain `resolve_arrival`.
- When auto-resolve is enabled, current behavior remains (auto-resolve loop + no local arrival application).
- Document the new flag and behavior in an appropriate doc (e.g., `docs/aztec-arrival-lifecycle.md`).
- No changes under `reference/`.

## Out of Scope
- Contract changes.
- Indexer changes.
- UI redesign.

## Tests / Commands
- Manual: make a move, wait until arrival block, confirm the UI applies the arrival without waiting for a resolve proof when auto-resolve is disabled.

## Status
- Proposed
