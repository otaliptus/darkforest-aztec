# Ticket 118 - Non-admin foreground ticking

## Goal
Allow `scripts/df-local.sh --mine-foreground` to advance blocks without admin-only DarkForest actions, so it works when admin public actions are disabled.

## Acceptance Criteria
- `--mine-foreground` can run successfully with `DF_ENABLE_ADMIN_ACTIONS=0` compiled artifacts.
- Block ticking uses a non-admin public transaction that does not mutate DarkForest gameplay state.
- Default behavior remains compatible with existing dev/admin-enabled flow.
- Document how to use the new ticking mode (brief note in `scripts/df-local.sh` usage or README).
- No changes under `reference/`.

## Notes
- Prefer a tiny auxiliary contract or dedicated helper logic over touching DarkForest state.
- Keep the private-validate -> public-apply pattern intact for DarkForest.
