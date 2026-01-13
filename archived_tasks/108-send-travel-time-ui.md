# 108 - Send travel time UI (blocks)

## Context
User wants travel timing back in the UI. We already compute move time in blocks via `getTimeForMove`, but it is not surfaced in the send/planet UI.

## Acceptance criteria
- Show a clear travel time indicator in the send UI using blocks (no seconds).
- If a target planet is hovered while sending, show `ETA` in blocks (and arrival block if available).
- Keep display lightweight and opt-in to the send flow (no clutter when not sending).
- No gameplay regressions; calculations use existing `getTimeForMove` and on-chain constants.

## Planned files
- apps/client/src/Frontend/Views/SendResources.tsx
- apps/client/src/Frontend/Utils/AppHooks.ts (only if a new hook is needed)
- apps/client/src/Frontend/Components/Text.tsx (only if styling helper is needed)

## Notes
Use block-based timing (current block + travel blocks). Avoid unbounded loops. Client-only changes.

## Tests
- yarn client:dev
