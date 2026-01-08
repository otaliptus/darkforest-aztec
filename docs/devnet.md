# Devnet & Local Deployment Runbook

This guide covers local Aztec devnet setup and deploying DarkForest + NFT on a devnet.

## Local Aztec network

Start a local Aztec network (dockerized):

```bash
aztec start --local-network --node --sequencer --pxe --archiver
```

Deploy contracts + write `apps/client/.env.local`:

```bash
node packages/contracts/scripts/deploy_local.js --write-env --overwrite-env
```

Optional: keep blocks moving (tx tick):

```bash
node packages/contracts/scripts/watch_blocks.js --tick
```

Run the client:

```bash
yarn client:dev
```

## Devnet deployment (remote Aztec node)

Set env vars for the devnet node + account keys:

```bash
export AZTEC_NODE_URL=https://your-devnet-node:8080
export ACCOUNT_SECRET=0x...
export ACCOUNT_SALT=0x...
export ACCOUNT_SIGNING_KEY=0x...
export SPONSORED_FPC_ADDRESS=0x... # optional, if using sponsored fees
```

Deploy and write the client env file:

```bash
node packages/contracts/scripts/deploy_devnet.js --write-env --overwrite-env
```

Then start the client:

```bash
yarn client:dev
```

## Performance measurement (turn time)

Use the benchmark helper (local devnet recommended):

```bash
PROVER_ENABLED=true node packages/contracts/scripts/bench_move.js --deploy
```

The script prints `move_ms` in the benchmark summary. That value represents a single turn
(proof generation -> tx submission -> acceptance).

## Troubleshooting

- **Node not reachable**: verify `AZTEC_NODE_URL` and that `aztec start` is running. Check
  `aztec block-number --node-url <url>` to confirm connectivity.
- **Sponsored fees failing**: supply `SPONSORED_FPC_ADDRESS` (or remove it) to fall back to
  normal fees. On devnet, use `aztec get-canonical-sponsored-fpc-address` if available.
- **Existing nullifier errors**: account was already deployed; rerun or use a new account
  (set `ACCOUNT_MODE=random` or rotate secrets).
- **Client config mismatch**: if planets look wrong, ensure the client perlin keys match
  the deployed config. Re-run deploy with `--overwrite-env` to refresh `.env.local`.
- **Slow first proof**: run `aztec preload-crs` before benchmarking to warm CRS caches.
