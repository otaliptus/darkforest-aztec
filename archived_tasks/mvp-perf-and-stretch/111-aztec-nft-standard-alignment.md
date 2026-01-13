# Ticket 111 - Aztec NFT standard alignment

## Goal
Confirm the Dark Forest NFT contract aligns with the Aztec NFT standard or document and justify deviations.

## Background / Motivation
The NFT minted via spacetime rips is a grant requirement. Aligning with Aztec standards improves wallet/indexer compatibility and reduces integration risk.

## Scope (In)
- Compare `packages/nft/src/main.nr` against the Aztec NFT standard interface.
- Identify missing functions, ownership semantics, or transfer restrictions.
- Implement missing required interfaces OR document why not required for this MVP.

## Out of Scope
- Building a full marketplace or metadata system.
- Large token standard extensions.

## Acceptance Criteria
- A checklist comparing contract vs standard with pass/fail for each requirement.
- Contract updated to include any required functions for compliance, OR a doc explaining deviations.
- Mint/transfer/burn flows still work with DarkForest contract.

## Implementation Notes
- Keep contract minimal but standard-compliant when possible.
- Preserve existing minter-only security model unless standard requires otherwise.

## Deliverables
- Contract updates: `packages/nft/src/main.nr` (if needed).
- Doc: `docs/nft-standard-alignment.md`.
- Tests: `packages/contracts/src/test/darkforest_stub.nr` and/or `packages/nft/src/test` (if added).

## Tests / Commands
- `yarn contracts:test:nr`
- `yarn workspace @darkforest-aztec/contracts test:e2e`

## Dependencies
- Aztec NFT standard reference.

## Status
- Open

## Notes
- If standard includes private ownership, decide if we must support it for MVP.
