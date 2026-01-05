# Local Snapshot Indexer (Aztec)

This optional workflow builds a local snapshot of on-chain state so the client can hydrate without thousands of `getPublicStorageAt` calls.

## Build a snapshot

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

## Enable snapshot loading in the client

Add to `apps/client/.env.local`:

```
DF_SNAPSHOT_URL=/snapshot.json
```

Then restart the client (`yarn workspace @darkforest-aztec/client dev`).

## Disable snapshot loading

Remove `DF_SNAPSHOT_URL` from `.env.local` (or set it empty) and restart the client.

## Notes

- Snapshots are intended for local devnet use. If the contract address changes, rebuild the snapshot.
- Snapshot loading is a fast path; the client still connects to the Aztec node for live actions.  
