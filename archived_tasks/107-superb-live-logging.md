# 107 - Superb live logging in client

## Context
Players still can't see timestamped, ultra-detailed logs while playing. Restore/extend the in-client detailed logging controls and ensure high-volume gameplay/UI events are captured.

## Acceptance criteria
- Settings UI exposes Detailed Action Logs (toggle, pick log file, flush, download, status) and actually toggles the logger.
- Detailed logger defaults respect `DF_DETAILED_LOGS`/`DF_FILE_LOGS` and can be enabled without opening settings.
- UI event emitter logs high-level UI actions into the detailed logger (excluding noisy mouse-move spam).
- Logs remain timestamped NDJSON with correlation ids where available.
- No gameplay regressions; logging is opt-in and safe in dev.

## Planned files
- apps/client/src/Frontend/Panes/SettingsPane.tsx
- apps/client/src/Frontend/Utils/SettingsHooks.tsx
- apps/client/src/Frontend/Utils/UIEmitter.ts
- apps/client/README.md (only if the UI changes need clarification)

## Notes
Client-only changes. Do not add unbounded loops in contract code.

## Tests
- yarn client:build (if time)
