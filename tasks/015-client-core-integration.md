# Ticket 015 - Client core integration (Aztec SDK + config + bindings)

## Goal
Wire the React client to Aztec so it can connect to a local network, load contract artifacts + addresses, and submit the two core onboarding calls (`init_player`, `reveal_location`) with proper perlin config.

## Acceptance Criteria
- Client loads Aztec network config (PXE URL, node URL, chain/registry info if needed) from a local JSON config or env, with a `local-network` default and a `devnet` option.
- Client can create or load a wallet/account for local development without hard‑coding secrets in source code.
- Contract artifacts are loaded (DarkForest + NFT), and deployed addresses are loaded from config or an addresses JSON file.
- A client wrapper exposes typed methods for:
  - `init_player` (private validate + public apply flow)
  - `reveal_location`
  - (plumbing only) loading current player/planet state for UI readbacks
- UI has a minimal panel to:
  - connect/create wallet
  - run `init_player` and `reveal_location` with sample inputs
  - display tx hash + success/failure
- No changes to core contract logic.

## Out of Scope
- Full gameplay UI (Ticket 016)
- End‑to‑end deploy/test scripts (Ticket 017)
- Performance profiling (final phase)

## Deliverables
- Client Aztec service layer + config loader
- Minimal UI wiring
- Notes in README or docs on how to run the local network + client

## Tests
- `yarn client:build`
- Manual local‑network smoke: connect wallet, call `init_player`, then `reveal_location` and confirm txs finalize.

## Status
- Archived (2026-01-08).
