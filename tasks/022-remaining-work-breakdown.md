# Ticket 022 - Remaining work breakdown + plan refresh

## Goal
Create detailed task tickets for remaining P0/P1/P2 items not already tracked and publish a repo-level plan.

## Acceptance Criteria
- New task tickets exist for each uncovered item:
  - P0: artifact burn semantics, init claim guard, wormhole arrival parity, spaceship activation parity.
  - P1: E2E negative/edge case coverage.
  - P2: UX polish for trade/activation, logging/observability, optional indexing helpers.
- `plan.md` lists P0/P1/P2 priorities and references existing tickets (014/019/020) plus the new ones.
- No contract/client logic changes.

## Out of Scope
- Implementing any of the tasks.
- Updating existing ticket statuses.

## Deliverables
- New task files in `tasks/` for the items above.
- `plan.md` in repo root.

## Tests / Commands
- None (planning only).

## Status
- Pending.

## Notes
- Existing tickets already cover some items (014 NFT ownership, 019 client E2E verification, 020 performance + deploy docs).
