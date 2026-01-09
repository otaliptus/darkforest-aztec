# Ticket 028 - UX polish: trade/activation feedback + NFT ownership

## Goal
Improve client UX for trade and activation actions and surface NFT ownership clearly.

## Acceptance Criteria
- Trade panel shows artifact NFT owner and deposit state.
- Activation UI shows active/inactive state, cooldowns, and clear success/failure feedback.
- Errors are surfaced in the UI log panel with actionable messages.
- No regression in existing init/reveal flows.

## Out of Scope
- Major redesign or new game features.
- Indexing infrastructure.

## Deliverables
- Client updates in `apps/client/src` (UI components + state readers).

## Tests / Commands
- `yarn client:build`
- Manual local smoke: init, reveal, trade, activate.

## Status
- Archived (2026-01-08).

