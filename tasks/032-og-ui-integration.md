# Ticket 032 - Original Dark Forest v0.6 UI integration

## Goal
Integrate the original Dark Forest v0.6 UI (look, feel, layout, and game canvas) with the existing Aztec game logic so the client is fully playable and faithful to the original experience.

## Acceptance Criteria
- The main game client uses the original v0.6 UI layout, styles, and canvas renderer (not a simplified custom UI).
- Core gameplay flows work end-to-end against Aztec contracts: init, reveal, move/capture, upgrade, prospect/find artifacts, trade (deposit/withdraw), activate/deactivate artifacts, spaceship activation.
- The galaxy renderer and interaction model match v0.6 behavior (pan/zoom, selection, hover, sidebar/modals).
- Ethereum-only features (whitelist, Twitter, hats, leaderboard, external webserver) are either adapted to Aztec or cleanly disabled without breaking the UI.
- Build/dev workflow works locally via the repo’s workspace scripts.

## Out of Scope
- Re-introducing Ethereum dependencies or RPC requirements.
- Non-v0.6 gameplay features.
- Multiplayer infrastructure beyond current Aztec capabilities.

## Deliverables
- OG UI code integrated into the Aztec client (with a clear adapter layer for contract reads/writes).
- Type and data adapters mapping Aztec state into v0.6 UI types.
- Updated onboarding/terminal flow for Aztec wallet and node connection.
- Documentation/notes for any disabled UI panes or features.

## Tests / Commands
- `yarn client:build`
- Manual local playthrough: init, reveal, move, upgrade, prospect/find, trade, activate/deactivate, spaceship.

## Status
- **✅ Complete** (2026-01-08).
- UI components merged from `client-og` into `apps/client`.
- `yarn client:build` passes with 6 warnings (no errors).
- Full end-to-end game test verified:
  - Init player ✅
  - Reveal ✅
  - Home planet claimed ✅
  - Galaxy map renders ✅

## Notes
- Supersedes Ticket 031 (game-feel upgrade).
- We will base UI assets on `reference/darkforest-v0.6/client` (and `reference/darkforest-local/client` for icons/assets).
