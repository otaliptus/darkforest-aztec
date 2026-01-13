# Ticket 112 - Indexing and state sync strategy for Aztec

## Goal
Define and prototype a reliable state sync strategy to replace the old subgraph-based model for the Aztec port.

## Background / Motivation
The original DF frontend relies on subgraph-like indexing. On Aztec, state sync must be based on PXE logs, public storage, and/or cached snapshots. This is a known risk area and must be addressed to keep the client playable.

## Scope (In)
- Document the minimal sync model required for MVP:
  - Planet discovery/ownership updates.
  - Move/arrival updates.
  - Artifact + NFT ownership updates.
- Propose a client-side caching and refresh strategy.
- Implement a minimal prototype or helper that rebuilds required state from Aztec logs.

## Out of Scope
- Full-featured hosted indexer service.
- Distributed data pipelines.

## Acceptance Criteria
- A doc describing the sync model and data sources (PXE logs, storage reads, etc.).
- A small prototype or helper that can rebuild planet ownership + arrivals for a local devnet session.
- Clear limitations and follow-up risks listed in the doc.

## Implementation Notes
- Prefer incremental sync by block height to avoid full scans.
- Reuse existing log structures and avoid new contract events unless required.

## Deliverables
- Doc: `docs/indexing-sync.md`.
- Prototype helper: `apps/client/src/Backend/Aztec/indexing/` or `scripts/indexing/`.

## Tests / Commands
- Manual run of helper against local devnet.

## Dependencies
- Aztec log capabilities for public function calls.

## Status
- Open

## Notes
- Keep the MVP path local-only if needed, but document a roadmap for hosted indexing.
