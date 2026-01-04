# Ticket 027 - Headless E2E negative/edge cases

## Goal
Expand the headless E2E test to cover failure cases and edge conditions without UI.

## Acceptance Criteria
- E2E script includes explicit failure checks for key actions (e.g., move with insufficient population, trade without ownership, activation cooldown, invalid reveal bounds).
- Failures are asserted (expected revert or error message) without hanging the test run.
- E2E run time remains under a reasonable cap (target < 10 minutes for full suite).

## Out of Scope
- UI tests or browser automation.
- Contract logic changes unless required to surface correct errors.

## Deliverables
- Updates to `packages/contracts/scripts/e2e_darkforest.js` or a new companion script.
- Documented run command in `packages/contracts/package.json` if a new script is added.

## Tests / Commands
- `yarn workspace @darkforest-aztec/contracts test:e2e`

## Status
- Pending.
