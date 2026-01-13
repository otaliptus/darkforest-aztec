# Ticket 117 - Public admin feature flags

## Goal
Feature-flag dev/admin-only public logic so production builds can exclude it and reduce public bytecode size without changing gameplay.

## Acceptance Criteria
- Admin-only public branches (actions 6–9 in `apply_player_action`) can be compiled out via a feature flag.
- Dev/test builds keep admin functionality available.
- Production build path documented (how to toggle the flag).
- No changes under `reference/`.

## Notes
- Keep the private-validate -> public-apply pattern intact.
- Avoid gameplay changes.
