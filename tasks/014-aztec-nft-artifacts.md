# Ticket 014 - Aztec‑native NFT integration for artifacts

## Goal
Make artifacts actual Aztec‑native NFTs and synchronize ownership with deposit/withdraw/find flows.

## Acceptance Criteria
- Add NFT contract (Aztec standard) with mint/transfer/burn; token id == artifact id.
- `find_artifact` mints NFT to contract (or core) and places artifact on planet.
- `deposit_artifact` transfers NFT to contract; `withdraw_artifact` transfers NFT to caller.
- `give_space_ships` mints ship NFTs to player.
- Contract reads NFT owner as source of truth (or strictly kept in sync).
- Tests cover:
  - find → withdraw → deposit → withdraw ownership transitions.
  - non‑owner deposit/withdraw failures.
- No unbounded loops in public functions.

## Out of Scope
- Client UI, metadata rendering.
- Off‑chain indexing or subgraph work.

## Deliverables
- New NFT contract + updated core contract + tests.

## Tests
- `yarn workspace @darkforest-aztec/contracts compile`
- `yarn contracts:test:nr`

## Status
- Archived (2026-01-08).

## Notes
- NFT contract implemented in `packages/nft/src/main.nr` with mint/transfer/burn and minter gating.
- Core contract mints NFTs on artifact find/admin create and ship grant; transfers on trade withdraw/deposit.
- Ownership is kept in sync between DarkForest storage and NFT public ownership (used as source of truth).
- Tests cover find → withdraw → deposit → withdraw and non‑owner withdraw/deposit failures.
