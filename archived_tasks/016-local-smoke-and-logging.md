# Ticket 016 - Local network smoke + client logging

## Goal
Add client-side logging to aid debugging and provide a repeatable local-network smoke flow (deploy contracts + run client) to validate init/reveal end-to-end.

## Acceptance Criteria
- Client logs key connection steps (node, wallet, account, contract registration, fee mode) and tx lifecycle (prove/send/confirm) to both console and a UI log panel.
- A local deploy script exists to deploy NFT + DarkForest with the test-default config and set the NFT minter to DarkForest; it prints addresses and can emit a ready-to-copy `.env.local` block.
- Manual smoke run succeeds on local network: start node, deploy, run client dev, connect, init_player, reveal_location.

## Out of Scope
- Full gameplay UI and persistence.
- Devnet deployment.

## Deliverables
- Client logging updates.
- Local deploy script + usage notes (in this ticket).
- Record of smoke test run.

## Tests / Commands
- `yarn workspace @darkforest-aztec/contracts compile`
- `yarn workspace @darkforest-aztec/nft compile`
- `yarn workspace @darkforest-aztec/contracts deploy:local`
- `yarn client:dev`

## Notes
- Deploy script should default to node URL `http://localhost:8080`.
- Use test config constants from `packages/contracts/src/test/utils.nr`.

## Status
- Archived (2026-01-08).
