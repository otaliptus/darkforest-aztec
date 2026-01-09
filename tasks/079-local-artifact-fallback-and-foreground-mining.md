# Ticket 079 - Local artifact fallback + foreground mining

## Goal
Provide a local sprite fallback for artifact/ship images when CDN assets are unavailable, and add a foreground mining option to df-local.

## Acceptance Criteria
- Artifact/ship icons fall back to local sprites when CDN assets fail to load (or when forced locally).
- df-local can run the block ticker in the foreground when requested.
- No gameplay logic or contract state changes.

## Out of Scope
- Hosting new CDN assets.
- UI redesigns.

## Deliverables
- Updated artifact image component with local fallback.
- Updated df-local flags and behavior.

## Tests / Commands
- `yarn workspace @darkforest-aztec/client test`

## Status
- Archived (2026-01-08).
