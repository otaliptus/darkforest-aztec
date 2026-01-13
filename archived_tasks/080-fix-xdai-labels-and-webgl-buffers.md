# Ticket 080 - Remove xDAI UI labels + fix WebGL buffer error

## Goal
Replace xDAI branding in the UI with Aztec-appropriate language and resolve the WebGL buffer binding error in the renderer.

## Acceptance Criteria
- No user-facing UI strings mention xDAI.
- WebGL "no buffer is bound" error is eliminated during background rendering.
- No gameplay logic or contract changes.

## Out of Scope
- UI redesigns.
- Contract changes.

## Deliverables
- Updated UI strings.
- Updated renderer buffer handling.

## Tests / Commands
- `yarn workspace @darkforest-aztec/client test`

## Status
- Archived (2026-01-08).
