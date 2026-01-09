# Ticket 031 - Game-feel UI upgrade (apps/client)

## Goal
Deliver a game-like, playable UI feel by upgrading the existing `apps/client` layout, styling, and core panels while keeping the Aztec wiring intact.

## Acceptance Criteria
- The client uses a game-style chrome (top bar, side panels, modal/overlay system, notifications/log) inspired by v0.6, without creating a separate app.
- Core gameplay flows remain functional in the upgraded UI: init player, reveal locations, move/capture, upgrade, prospect/find artifacts, trade (deposit/withdraw), activate/deactivate artifacts.
- The galaxy view and planet details feel interactive and game-like (not a simple form + buttons layout).
- No new contracts or protocol changes are required; client uses existing Aztec scripts/config.
- Changes are contained in `apps/client` and do **not** introduce a parallel `client-og` app.

## Out of Scope
- Full port of the original v0.6 UI codebase.
- Re-implementing the full Ethereum GameManager API.
- Major feature additions outside v0.6 scope.

## Deliverables
- Updated React UI in `apps/client/src` (layout, styling, panels, modal/overlay system).
- A thin adapter/state layer for UI components that preserves existing Aztec calls.
- Updated styling/theme assets (fonts, icons) as needed.

## Tests / Commands
- `yarn client:build`
- Manual local run: init, reveal, move, upgrade, prospect/find, trade, activate/deactivate.

## Status
- Archived (2026-01-08).

## Notes
- This ticket **overrides** the previous idea in `claude-UI-plans.md` to create a separate `client-og` app. We will upgrade the existing `apps/client` to achieve a playable, game-like experience instead.
- Build check: `yarn client:build` completes; Vite warns about mixed JSON import attributes from Aztec deps.
- User requested reverting to the original Dark Forest v0.6 UI (not a new skin). New work proceeds under Ticket 032.
