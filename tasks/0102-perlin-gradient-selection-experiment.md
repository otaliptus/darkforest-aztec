# Ticket 0102: Perlin Gradient Selection Experiment

## Goal
Evaluate replacing the 16-iteration gradient selection loop with a lower-gate selection strategy.

## Acceptance Criteria
- Implement a candidate gradient selection approach (table indexing or equivalent) that preserves the exact gradient vectors.
- Compare opcode counts for `multi_scale_perlin` before/after and keep the change only if it reduces opcodes.
- Run relevant Noir tests and record results in this ticket.

## Notes
- If ROM-to-RAM indexing increases gates, revert and document the outcome.
