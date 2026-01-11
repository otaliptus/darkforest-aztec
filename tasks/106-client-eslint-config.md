# Ticket 106 - Fix client lint parsing

## Goal
Make `yarn workspace @darkforest-aztec/client lint` parse the client codebase without the "const reserved" error.

## Acceptance Criteria
- ESLint parses modern JS/TS/TSX in `apps/client` without the reserved keyword error.
- Lint command no longer fails on `apps/client/webpack.config.js`.

