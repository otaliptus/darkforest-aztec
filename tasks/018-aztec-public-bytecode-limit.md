# Ticket 018 - Public bytecode size limit

## Goal
Get the DarkForest contract under Aztec's public bytecode packing limit so `aztec test` / `yarn contracts:test:nr` runs without the input-buffer error.

## Acceptance Criteria
- Root cause of the buffer error is identified and noted (public bytecode exceeds `MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS`).
- DarkForest public bytecode fits within the limit (<= 3000 fields) without removing required private validations.
- `yarn contracts:test:nr` no longer fails with `Input buffer exceeds maximum size`.

## Out of Scope
- Changing Aztec protocol constants in `node_modules`.
- Client/UI changes.

## Deliverables
- Contract adjustments that reduce public bytecode size.
- Bytecode size measurement note (fields count).

## Tests
- `yarn contracts:test:nr`

## Status
- Root cause: public bytecode exceeded Aztec constant `MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS` (3000 fields).
- Adjustments:
  - Removed unused `nft_burn` helper and `planet_artifacts_is_empty` assert from give‑ships path.
  - Deduplicated admin checks in `apply_player_action`.
  - Relaxed admin‑only artifact creation (action 9) by dropping redundant planet/existence asserts.
- Size measurement: 2996 packed fields (public bytecode bytes 92842).
- Tests: `yarn contracts:test:nr` (passes).
