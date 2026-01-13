# Ticket 081 - Remove CloudFront artifact requests + foreground mining only

## Goal
Use only local artifact sprites (no CloudFront requests) and ensure `--mine-foreground` only mines blocks with no other actions.

## Acceptance Criteria
- Client does not attempt CloudFront requests for artifact media; artifact UI uses local sprite sheet only.
- `scripts/df-local.sh --mine-foreground` skips build/deploy/snapshot/client and only mines blocks in the foreground.
- No contract logic changes.

## Out of Scope
- Changing artifact data models or asset pipeline.
- Deploy script behavior (other than `--mine-foreground` handling).

## Deliverables
- Updated artifact image component to use local sprites only.
- Updated `df-local.sh` flag handling.

## Tests / Commands
- `yarn workspace @darkforest-aztec/client test`

## Status
- Archived (2026-01-09)
