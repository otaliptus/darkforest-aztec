# Ticket 108 - Client E2E gameplay flow test

## Goal
Replace the stubbed client test with a real, automated flow that proves the game is playable end-to-end on local devnet.

## Background / Motivation
`apps/client/package.json` currently has `"test": "exit 0"`. This hides regressions and undermines confidence in the client+contract integration.

## Scope (In)
- Create a deterministic E2E test flow using Aztec.js + client logic.
- Minimum flow:
  1) Connect wallet/account.
  2) Initialize a home planet.
  3) Reveal a nearby planet.
  4) Send a move to another planet.
  5) Wait for arrival resolution and verify ownership/energy changes.
- Ensure test is repeatable with fixed coordinates from env/config.

## Out of Scope
- UI-driven browser tests.
- Full regression suite for all actions.

## Acceptance Criteria
- `yarn workspace @darkforest-aztec/client test` runs the E2E flow and asserts expected state.
- Test fails if state does not update or if required steps are not confirmed.
- Test works against a local devnet with default config.

## Implementation Notes
- Prefer a Node script using existing backend modules over browser automation.
- Use the same config loader as the client (`apps/client/src/Backend/Aztec/config.ts`).
- Add a simple wait/retry for arrival resolution to avoid flakiness.

## Deliverables
- Test script: `apps/client/scripts/e2e-flow.ts`.
- Update `apps/client/package.json` test script to call it.
- Short doc section in `apps/client/README.md` describing how to run.

## Tests / Commands
- `yarn workspace @darkforest-aztec/client test`

## Dependencies
- Local devnet running.
- Deployed DarkForest + NFT contracts.
- Environment file with `DARKFOREST_ADDRESS`, `NFT_ADDRESS`, etc.

## Status
- Open

## Notes
- Keep assertions minimal but meaningful (ownership + energy/silver deltas).
