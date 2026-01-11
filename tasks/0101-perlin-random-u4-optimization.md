# Ticket 0101: Perlin random_u4 Optimization

## Goal
Reduce constraint cost in `random_u4` by removing full `to_le_bits` decomposition while preserving identical output.

## Acceptance Criteria
- Replace `random_u4` to compute a 0..15 value without `to_le_bits` (e.g., constrained modulo or unconstrained+constraint).
- Prove equivalence for identical inputs (add test vectors or update Perlin tests).
- Run relevant Noir tests and record opcode deltas in this ticket.

## Notes
- Perlin outputs must remain identical to maintain v0.6 parity.
