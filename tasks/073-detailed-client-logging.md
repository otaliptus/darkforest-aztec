# 073 - Detailed client logging to file

## Context
Need super detailed logging so gameplay actions are dumped to a file for easier debugging.

## Acceptance criteria
- Add a configurable client-side logger that writes detailed action logs to a file (or rolling file) without breaking normal gameplay.
- Log entries include timestamp, action type, high-level payload, and correlation id where available.
- Logging is opt-in via config/env and safe to leave on in dev.
- Document how to enable/disable and where logs are written.

## Planned files
- apps/client/src/Frontend/Utils/ (logger or hook)
- apps/client/src/Frontend/ (integration points in action handlers)
- apps/client/ (config/env docs)
- docs/ (if existing logging docs)

## Notes
Do not add unbounded loops in public contract functions. Client-only changes preferred.

## Status
- Completed.

## Tests
- `yarn client:build` (warnings from aztec bb.js sourcemaps + asset size)
