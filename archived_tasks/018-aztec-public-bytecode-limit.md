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
- Archived (2026-01-08).

