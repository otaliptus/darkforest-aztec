# Local Snapshot Indexer (Aztec)

This optional workflow builds a local snapshot of on-chain state so the client can hydrate without thousands of `getPublicStorageAt` calls.

## Quick start (integrated)

Use the local run script with `--snapshot` to build a snapshot and enable it for the client:

```bash
scripts/df-local.sh --run --snapshot
```

This writes `apps/client/public/snapshot.json` and sets `DF_SNAPSHOT_URL=/public/snapshot.json`
in `apps/client/.env.local` for you.

To keep the snapshot up to date as blocks advance, add `--snapshot-watch`:

```bash
scripts/df-local.sh --run --snapshot --snapshot-watch
```

Optional knobs:
- `--snapshot-poll <ms>`: how often to check for new blocks (default 5000)
- `--snapshot-min-interval <ms>`: minimum time between rebuilds (default 15000)

## Build a snapshot manually

From repo root:

```bash
node packages/contracts/scripts/indexer_snapshot.js \
  --rpc http://localhost:8080 \
  --contract <DARKFOREST_ADDRESS> \
  --out apps/client/public/snapshot.json
```

Optional flags:
- `--nft <NFT_ADDRESS>`: include NFT owner data if available.
- `--batch <N>`: batch size for range reads (default 200).
- `--concurrency <N>`: parallel read limit (default 8).
- `--watch`: keep rebuilding the snapshot when new blocks arrive.
- `--poll <ms>`: block poll interval for `--watch` (default 5000).
- `--min-interval <ms>`: minimum time between rebuilds for `--watch` (default 15000).

If `apps/client/.env.local` is present with `VITE_*` addresses, the script will use them by default.

## Enable snapshot loading in the client

Add to `apps/client/.env.local`:

```
DF_SNAPSHOT_URL=/public/snapshot.json
```

Auto-refresh (optional):
- `DF_SNAPSHOT_AUTO_REFRESH=true` (default in dev) to apply snapshot updates in-place when the snapshot changes.
- `DF_SNAPSHOT_POLL_MS=5000` to adjust how often the client checks for updates.
- `DF_SNAPSHOT_MIN_INTERVAL_MS=15000` to throttle update frequency.

Then restart the client if you add or change env vars (`yarn workspace @darkforest-aztec/client dev`).

## Disable snapshot loading

Remove `DF_SNAPSHOT_URL` from `.env.local` (or set it empty) and restart the client.

## Notes

- Snapshots are intended for local devnet use. If the contract address changes, rebuild the snapshot.
- Snapshot loading is a fast path; the client still connects to the Aztec node for live actions.
- If you rebuild the snapshot while the dev server is running, it will apply automatically when auto-refresh is enabled.
