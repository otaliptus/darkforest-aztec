# Ticket 0004: MiMC Optimization Research

## Goal
Evaluate safe MiMC optimizations for Noir/Aztec while preserving identical outputs.

## Acceptance Criteria
- Document available Noir/Aztec MiMC primitives or external libraries, including parameters (rounds, field, constants).
- Confirm whether any optimized implementation can match `mimc_sponge_2_220` outputs exactly.
- Outline a safe migration/test plan (test vectors, equivalence checks) without changing public interfaces.
- Identify risks/constraints (proof cost, constant generation, compatibility with Circom).

## Findings
- Noir/ACVM has no MiMC black-box opcode; stdlib hash BBFs exclude MiMC.
- `noir-lang/mimc` implements MiMC-p/p with exponent 7 and 91 rounds; Dark Forest uses MiMC-2n/n sponge, exponent 5, 220 rounds with circomlib constants.
- Swapping implementations changes location IDs, config hashes, artifact/ship IDs, and Perlin gradients, so it is not a faithful v0.6 port.

## Decision
- Do not replace `mimc_sponge_2_220`; pursue non-breaking optimizations instead (e.g., Perlin caching).
