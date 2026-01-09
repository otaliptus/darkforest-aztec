# Ticket 002 - Scaffold Aztec workspace

## Goal
Create the initial Aztec workspace layout with contracts, shared types, and a minimal client shell.

## Acceptance Criteria
- Root workspace includes `packages/contracts`, `packages/shared`, and `apps/client` via Yarn workspaces.
- `packages/contracts` builds a minimal Aztec Noir contract that follows the private-validate -> public-apply (only_self) pattern and includes at least one Noir test.
- `packages/shared` exports at least one placeholder type used by the client or contracts.
- `apps/client` is a minimal React app that starts locally and compiles.
- Document basic dev commands for the new workspace.

## Out of Scope
- Full Dark Forest logic and client port (future tickets).

## Deliverables
- Scaffolded workspace + smoke tests documented in README.

## Status
- Archived (2026-01-08).
