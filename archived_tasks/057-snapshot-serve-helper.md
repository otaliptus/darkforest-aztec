# Ticket 057 - Snapshot Serve Helper (Low-Risk Refresh)

## Goal
Provide a minimal, low-risk path to load snapshots after refresh without a big debugging session.

## Acceptance Criteria
- Running a single command generates and serves `snapshot.json` locally.
- Client loads the snapshot via `DF_SNAPSHOT_URL` when set.
- No background indexer, no production changes.

## Plan
1) Add a small helper script to generate a snapshot and serve it (static HTTP).
2) Print the exact `DF_SNAPSHOT_URL` to set for the client.
3) Keep this optional and dev-only.

## Touch Points
- `packages/contracts/scripts/indexer_snapshot.js` (invoked, not modified unless required)
- `scripts/` (new helper script)
- `apps/client/src/Backend/GameLogic/SnapshotLoader.ts` (only if a bug is found)

## Side Effects
- Snapshot exposes revealed coords (expected for dev).
- Requires local HTTP server if browser blocks file:// fetches.

## Non-Goals
- Building a hosted indexer or persistent server.
- Changing privacy model for production.

## Status
- Archived (2026-01-08).
