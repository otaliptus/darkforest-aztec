# Ticket 0011: E2E Node 22 Compatibility

## Goal
Run the Dark Forest E2E script under Node 22.15 and fix any compatibility issues.

## Acceptance Criteria
- `yarn test:e2e` runs under Node 22.15 without syntax errors.
- If failures occur due to script/contract signature changes, update `e2e_darkforest.js` accordingly.
- Do not change game logic or public state.
