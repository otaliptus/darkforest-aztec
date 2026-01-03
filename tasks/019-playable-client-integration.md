# Ticket 019 - Playable client integration

## Goal
Deliver a playable Dark Forest web client wired to Aztec contracts with core v0.6 gameplay flows.

## Acceptance Criteria
- Client connects to Aztec (local/devnet config) and loads DarkForest + NFT addresses from config.
- Galaxy view renders discovered planets and revealed coordinates from on-chain state.
- Player can:
  - init player, reveal locations, move/capture planets
  - upgrade planets
  - prospect/find artifacts and view artifact inventory
  - deposit/withdraw artifacts at spacetime rips (minted NFT ownership reflected)
  - activate/deactivate artifacts (wormhole/photoid/bloom/black domain flows)
- UI displays player resources (energy, silver, ships, artifacts) and per-planet stats.
- Client reads contract state using a typed service layer in `apps/client`.
- No changes to core contract logic (unless required for client compatibility).

## Out of Scope
- New gameplay mechanics beyond v0.6.
- Off-chain indexing/subgraph.

## Deliverables
- Client gameplay UI and state sync.
- README updates for running the playable client.

## Tests
- `yarn client:build`
- Manual local run: connect, init, reveal, move, upgrade, prospect/find, artifact trade.

## Status
- Client reads on-chain GameConfig + config hashes for private calls.
- Vite VK tree error resolved by aligning bb-prover prebundle with pxe graph.
- init_player + reveal_location confirmed with real proofs on local node.
- Remaining gameplay flows still need end-to-end verification.
