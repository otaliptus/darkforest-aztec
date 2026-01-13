# Ticket 114 - Circom to Noir crosswalk documentation

## Goal
Produce a clear mapping between the original v0.6 Circom circuits/Solidity logic and the current Noir/Aztec implementation.

## Background / Motivation
Reviewers want confidence that this is a faithful port. A crosswalk document makes differences explicit and helps future contributors.

## Scope (In)
- List each original circuit (Init, Move, Reveal, Biomebase, Whitelist) and map to Noir modules/functions.
- List core Solidity contract behaviors (planet init, move/capture, upgrades, artifacts, spacetime rips) and map to Noir public/private functions.
- Document any intentional differences (e.g., Aztec private validation pattern).

## Out of Scope
- Rewriting or rebalancing game mechanics.
- Full tutorial content.

## Acceptance Criteria
- A doc with a table mapping original components to Noir files + function names.
- A section describing differences and rationale.
- References to key tests that ensure parity.

## Implementation Notes
- Use paths in `packages/contracts/src` and `reference/darkforest-v0.6`.
- Keep the doc compact and skimmable.

## Deliverables
- Doc: `docs/circom-noir-crosswalk.md`.

## Tests / Commands
- None (docs only).

## Dependencies
- None.

## Status
- Open

## Notes
- Include the "private validate -> public apply" pattern explanation.
