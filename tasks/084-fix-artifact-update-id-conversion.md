# 084 - Fix artifact update ID conversion + ship arrival refresh

## Status
- **Status:** Archived (2026-01-09)
- **Created:** 2026-01-09
- **Owner:** codex

## Context
Sending a ship triggers a runtime error in the client:
`Value ... is greater or equal to field modulus` from `fieldKey` in `readArtifactState`,
causing hardRefreshArtifact to fail. This occurs after emitting `ArtifactUpdate` for a move.
Additionally, after sending a ship the sender loses it and the receiver never sees it
(likely due to the crash during refresh).

## Acceptance Criteria
- Move side-effects emit an `ArtifactUpdate` with a valid `ArtifactId` hex string.
- No `BaseField` modulus error occurs when sending a ship.
- Ship/artifact refresh completes without throwing, allowing arrivals to resolve/refresh normally.

## Tests / Commands
- `yarn workspace @darkforest-aztec/client test`

## Notes
- `ContractsAPI.emitAztecSideEffects` currently emits the move artifact ID from tx args
  (decimal string) instead of the hex `ArtifactId`.
- If a decimal ID is used, it must be converted via `artifactIdFromDecStr` before emit.
