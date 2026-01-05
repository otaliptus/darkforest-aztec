# Ticket 044 - Local dev runner script

## Goal
Create a single script to orchestrate local Dark Forest dev workflows (reset local-network container, build, deploy, and optional fast blocks) with a small default map radius and a configurable `--radius` flag.

## Acceptance Criteria
- Script supports a `--reset` flag that stops/removes the Aztec local-network container(s) without deleting `~/.aztec`.
- Script builds the contracts + client (NFT compile + DF compile + client build) by default.
- Script supports a `--deploy` flag that redeploys NFT + DarkForest and writes `apps/client/.env.local`.
- Script supports a `--fast-blocks` flag that starts the local block tick helper for faster testing on local-network.
- Script defaults to a small world radius but allows overriding via `--radius <n>`.
- Script prints clear usage/help and exits non-zero on failures.

## Out of Scope
- Changes to smart contract logic or gameplay rules.
- Changes to Aztec CLI internals.

## Deliverables
- New local dev script.
- Brief README/doc note on usage (if needed).

## Tests / Commands
- Manual: run script with `--deploy --fast-blocks` and verify client connects + moves resolve faster.

## Status
- Done.
