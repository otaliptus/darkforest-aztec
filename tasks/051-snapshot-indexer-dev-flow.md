# Ticket 051 - Snapshot Indexer Dev Flow

## Goal
Make the local snapshot indexer easy to run so devs can avoid the heavy RPC spam after page refresh (F5).

## Acceptance Criteria
- Add an optional `--snapshot` flag to `scripts/df-local.sh` that:
  - builds `apps/client/public/snapshot.json` using `packages/contracts/scripts/indexer_snapshot.js`
  - writes `DF_SNAPSHOT_URL=/snapshot.json` into `apps/client/.env.local` (without clobbering other vars)
- Update docs (`local-details.md` and/or `docs/indexer.md`) to reference the new flag and when to re-run.
- Keep snapshot usage optional and dev-only; no production changes.

## Non-Goals
- Hosted indexer or remote snapshot service.
- Automatic background indexing.

