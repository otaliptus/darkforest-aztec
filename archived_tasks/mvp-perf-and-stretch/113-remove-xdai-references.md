# Ticket 113 - Remove xDai references from Aztec client

## Goal
Eliminate xDai-specific constants and UI references from the Aztec client and shared packages used by it.

## Background / Motivation
Several packages still reference xDai gas APIs and explorer URLs. These can leak into the Aztec client UI and cause confusion.

## Scope (In)
- Identify all `xdai` references in packages imported by the Aztec client.
- Replace them with Aztec-appropriate values or local placeholders.
- Ensure no user-facing strings or links mention xDai.

## Out of Scope
- Rewriting the entire gas pricing subsystem.
- Supporting multiple chains.

## Acceptance Criteria
- `rg -n "xdai" apps/client packages` shows no client-visible references.
- Any required explorer or gas API links are either removed or replaced with Aztec-compatible placeholders.

## Implementation Notes
- Prefer override/configuration in the client rather than editing upstream DF packages where possible.
- If upstream changes are required, document them clearly.

## Deliverables
- Updated constants/config in `packages/df-constants` (if required).
- Client overrides in `apps/client` (if needed).
- Short doc note in `apps/client/README.md`.

## Tests / Commands
- `rg -n "xdai" apps/client packages` (manual verification)

## Dependencies
- None.

## Status
- Open

## Notes
- Keep any gas pricing logic disabled if unused on Aztec.
