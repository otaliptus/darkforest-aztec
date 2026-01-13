# Ticket 0002: Move Known Optimization Prototype

## Goal
Add a move entrypoint that skips perlin computation when the destination is already initialized.

## Acceptance Criteria
- Add a `move_known` private entrypoint that omits perlin computation while keeping all other move checks.
- Enforce destination-initialized requirement in the public move path (see Notes).
- Route client move transactions to `move_known` when the destination planet is already initialized on-chain.
- Do not alter game rules, state layout, or arrival handling.

## Notes
- Public bytecode size exceeds the 3000-field limit when adding a dedicated `apply_move_known` public function. The implementation instead encodes a high-bit `MOVE_KNOWN_FLAG` in `move_config` and enforces the initialized check inside `apply_move`.
