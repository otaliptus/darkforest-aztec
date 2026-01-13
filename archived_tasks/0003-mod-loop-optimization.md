# Ticket 0003: Mod 255 Optimization

## Goal
Reduce constraint cost for artifact randomness by replacing the 254-bit mod loop.

## Acceptance Criteria
- Replace `mod_255_from_bits` with a byte-sum modulo approach in the contract.
- Keep artifact type/bonus outputs identical for the same seed.
- Update test stub helpers to match the new calculation.
- Do not change on-chain state layouts or public interfaces.
