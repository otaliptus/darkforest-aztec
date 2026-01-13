# 109 - Resolve arrival dedupe

## Context
Arrivals can be resolved twice on the client (one resolves, another attempts and logs skip_missing or fails). Reduce duplicate resolve attempts and noisy logs by clearing resolved arrivals locally.

## Acceptance criteria
- After a successful resolve, remove the arrival from local state to prevent re-queueing.
- If an arrival is missing (already resolved), remove it locally.
- No behavior changes for not-ready or error cases.

## Planned files
- apps/client/src/Backend/GameLogic/GameManager.ts

## Notes
Client-only change. Avoid altering contract logic.

## Tests
- yarn client:dev
