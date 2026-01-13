# Ticket 110 - Perlin + fixed-point parity vectors

## Goal
Prove parity between v0.6 (Circom/Solidity) and Noir implementations for Perlin noise, biome thresholds, and fixed-point math used in gameplay.

## Background / Motivation
Perlin and fixed-point math are core to planet generation, combat/resource mechanics, and movement timing. A mismatch breaks "faithful v0.6" behavior.

## Scope (In)
- Generate a deterministic set of reference vectors from the v0.6 implementation:
  - Perlin values for specific (x, y) coordinates.
  - Biome selection outputs for given space type + biomebase.
  - Fixed-point math outputs (exp_neg, pow2_frac, population growth).
- Encode vectors into Noir tests or a shared test harness.
- Add tests that assert Noir outputs match reference vectors.

## Out of Scope
- Changing Perlin thresholds or constants.
- Gameplay rebalancing.

## Acceptance Criteria
- At least 20 reference vectors for Perlin/biome and 20 for fixed-point math.
- Noir tests pass and compare against reference values exactly or with an explicit epsilon.
- A script exists to regenerate vectors if constants change.

## Implementation Notes
- Use reference code under `reference/darkforest-v0.6` or `@darkforest_eth/*` to generate vectors.
- Store vectors in a JSON file plus a small generator script.
- If Noir tests cannot read JSON, generate a `.nr` constants module from the script.

## Deliverables
- Vector generator: `scripts/gen_parity_vectors.ts`.
- Data: `docs/parity/v0.6_vectors.json` (and/or `packages/contracts/src/test/parity_vectors.nr`).
- Tests: updates in `packages/contracts/src/test/darkforest_stub.nr`.

## Tests / Commands
- `node scripts/gen_parity_vectors.ts`
- `yarn contracts:test:nr`

## Dependencies
- Reference v0.6 code under `reference/darkforest-v0.6`.

## Status
- Open

## Notes
- Keep vectors small to avoid large compile times.
