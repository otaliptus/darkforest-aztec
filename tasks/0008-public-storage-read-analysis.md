# Ticket 0008: Public Storage Read Hotspots Analysis

## Goal
Explain where `node_getPublicStorageAt` calls are triggered in the client and propose improvements to reduce read amplification.

## Acceptance Criteria
- Trace call flow from UI/game loops to `readPublic*` helpers and `node.getPublicStorageAt`.
- Identify the main hot paths (startup sync, chunk discovery, block-sync refresh, per-planet reads).
- Provide concrete improvement ideas that preserve gameplay behavior.
- No contract or client code changes required for this ticket.
