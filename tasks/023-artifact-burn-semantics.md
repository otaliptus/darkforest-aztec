# Ticket 023 - Artifact burn semantics (bloom / black domain)

## Goal
Ensure artifacts destroyed by bloom filter or black domain are actually burned and cannot be reused, and NFT ownership reflects the burn.

## Acceptance Criteria
- When bloom or black activation triggers destruction, the artifact is marked burned and removed from circulation.
- NFT token for a burned artifact is burned or moved to an explicit burn address, and cannot be transferred or withdrawn.
- Deposit/withdraw/activation paths fail for burned artifacts.
- Tests cover bloom and black-domain destruction paths and verify NFT ownership/burn state.

## Out of Scope
- UI changes or metadata rendering.
- Changing unrelated combat or movement logic.

## Deliverables
- Contract updates in `packages/contracts/src/main.nr` and related types/storage in `packages/contracts/src/types.nr`.
- NFT burn or burn-address handling in `packages/nft/src/main.nr`.
- Tests in `packages/contracts/src/test/darkforest_stub.nr`.

## Tests / Commands
- `yarn contracts:test:nr`

## Status
- Completed.

## Notes
- Added explicit burned flag on artifacts, enforced in trade/activation paths.
- Bloom filter and black domain burns now call NFT burn and mark burned state.
- Tests assert burn state plus NFT owner cleared on bloom/black destruction.
