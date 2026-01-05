# Ticket 040 - Fix Aztec protocol contract artifact chunk load in client

## Goal
Prevent runtime failures when the client loads Aztec protocol contract artifacts (e.g., AuthRegistry) in the browser.

## Acceptance Criteria
- Client connects without chunk-load errors from `@aztec/protocol-contracts` artifacts.
- No changes to contract logic.
- Fix is limited to client dependency entrypoints or bundling strategy.

## Out of Scope
- Replacing Aztec SDK versions.
- Client UI changes beyond connection stability.

## Deliverables
- Updated client imports/config to avoid failing dynamic JSON chunk loads.

## Tests / Commands
- `yarn client:dev` and confirm connection works.

## Status
- Switched client to bundled Aztec entrypoints to avoid lazy JSON chunk loads; dev server restarted.
