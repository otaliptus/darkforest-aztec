# Ticket 003 - v0.6 → Aztec crosswalk doc

## Goal
Produce a concise but complete mapping of Dark Forest v0.6 circuits/contracts/client components to Aztec Noir contracts and client architecture.

## Acceptance Criteria
- Document circuit → Noir private validator mappings (init/move/reveal/biomebase/perlin/range_proof).
- Document Solidity facet → Aztec contract module mappings, with public/private split.
- Document client subsystem mappings (mining, game logic, networking, storage).
- Call out Aztec-specific architectural differences (private validation + public apply, note usage, NFT minting path).
- Provide a short list of open questions/risks.

## Out of Scope
- Implementation changes to contracts or client.

## Deliverables
- Crosswalk document under `docs/`.

## Status
- Archived (2026-01-08).
