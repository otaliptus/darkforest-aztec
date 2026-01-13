# Ticket 104 - Clarify artifact selection override (v0.6 parity)

## Goal
Address the confusing artifact-type override in the rarest bucket by documenting intent and avoiding misleading logic while keeping v0.6 behavior.

## Acceptance Criteria
- Artifact selection behavior remains unchanged from v0.6 (rarest bucket resolves to Photoid Cannon).
- Code makes the override explicit to avoid confusion (comment or simplified branch).
- Contract test stub mirrors the clarified logic.

## Notes
- Keep changes scoped to `packages/contracts/src/main.nr` and `packages/contracts/src/test/darkforest_stub.nr`.
