# Ticket 0100: Move Packing Arithmetic

## Goal
Reduce gate cost in the private `move` path by replacing bit-shift packing/unpacking for `move_config` and `move_resources`.

## Acceptance Criteria
- Replace `move_config`/`move_resources` packing and unpacking in `move`/`apply_move` using arithmetic (mul/div/mod) or equivalent constants, without changing public interfaces.
- Preserve arrival scheduling, abandon logic, and state updates exactly.
- Update or extend move-related Noir tests as needed.
- Record opcode deltas in this ticket (gates if available).

## Notes
- Focus on private execution cost; do not change public storage layout or arrival handling.
