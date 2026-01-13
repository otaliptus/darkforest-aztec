# Ticket 122 - Noir + client bundle

## Goal
Generate a single text bundle containing the Dark Forest Aztec contract Noir files and client game logic backend files, plus any non-reference files that mention `resolve_arrival`.

## Acceptance Criteria
- Create `noir_client_bundle.txt` at the repo root.
- Bundle includes:
  - `packages/contracts/**/*.nr`, including `packages/contracts/src/test/**`.
  - `apps/client/src/Backend/**`.
  - Any non-reference, non-tasks file that mentions `resolve_arrival`.
- Exclude `packages/nft/**`, `reference/**`, and `tasks/**`.
- Each file entry has a clear explanation and a delimiter with the repo-relative path.
- Single bundle file; no other files are modified.

## Out of Scope
- Modifying source code or behavior.
- Including `packages/nft/**` or any `reference/**` content.

## Deliverables
- `noir_client_bundle.txt`.

## Tests / Commands
- None (manual bundle assembly).

## Status
- In progress (2026-01-13)
