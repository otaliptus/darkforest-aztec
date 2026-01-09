# Ticket 078 - Add missing getAllPlanets on GameUIManager

## Goal
Restore the expected GameUIManager API so the UI can enumerate all planets without crashing.

## Acceptance Criteria
- `GameUIManager.getAllPlanets()` exists and returns all planets from `GameManager`.
- `ControllableCanvas` no longer throws `getAllPlanets is not a function`.
- No gameplay logic changes.

## Out of Scope
- UI redesigns or gameplay changes.

## Deliverables
- Updated GameUIManager API.

## Tests / Commands
- `yarn workspace @darkforest-aztec/client test`

## Status
- Archived (2026-01-08).
