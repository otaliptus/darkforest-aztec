# Devnet & Local Deployment Runbook

This guide explains how to deploy Dark Forest + NFT to Aztec devnet, how to host
the client so others can play, and how to use the game locally for development.

## Devnet quick facts (Aztec docs)

- Devnet is version-dependent. Keep the Aztec CLI + SDK version aligned with the
  devnet version for compatibility.
- Current devnet (as of this repo): `3.0.0-devnet.20251212`
- RPC: `https://next.devnet.aztec-labs.com/`
- Canonical Sponsored FPC:
  `0x1586f476995be97f07ebd415340a14be48dc28c6c661cc6bdddb80ae790caa4e`
- Devnet has fees enabled, no pre-deployed test accounts, and longer block times
  (set by the devnet sequencer). Transactions can take longer and time out while still mining.

Source of truth: https://docs.aztec.network/developers/getting_started_on_devnet

## Prereqs

- Aztec CLI installed + devnet version:
  - `bash -i <(curl -s https://install.aztec.network)`
  - `aztec-up 3.0.0-devnet.20251212`
- Node + Yarn (repo uses Yarn classic).

## Devnet deploy (repo script)

1) Install deps + compile contracts:

```bash
yarn install
yarn contracts:compile
```

2) Export devnet environment variables:

```bash
export AZTEC_NODE_URL=https://next.devnet.aztec-labs.com/
export SPONSORED_FPC_ADDRESS=0x1586f476995be97f07ebd415340a14be48dc28c6c661cc6bdddb80ae790caa4e
export PROVER_ENABLED=true
```

3) Choose an account path:

- **Stable account (recommended)**: set these explicitly:
  - `ACCOUNT_SECRET`, `ACCOUNT_SALT`, `ACCOUNT_SIGNING_KEY`
- **Quick bootstrap**: set `ACCOUNT_MODE=random` to generate a fresh account.

4) Deploy:

```bash
node packages/contracts/scripts/deploy_devnet.js --write-env --overwrite-env
```

What the script does:
- Connects to devnet and deploys the account (if needed).
- Deploys NFT + DarkForest and sets the NFT minter.
- Writes `apps/client/.env.local` with addresses and account config.
- **Does not deploy the Ticker** (devnet blocks advance automatically).

## Gas sponsorship on devnet

Recommended path: **Sponsored FPC** (free, canonical).

- The deploy script uses `SPONSORED_FPC_ADDRESS` to register the SponsoredFPC
  contract and send transactions with `SponsoredFeePaymentMethod`.
- The client uses `VITE_SPONSORED_FPC_ADDRESS` and registers the SponsoredFPC
  instance (salt `0`) automatically if it exists.

Fallback: **Fee Juice** (fund an account and pay fees directly) or deploy a
custom FPC. See the Aztec fees guide for details.

## Transactions readiness (timeouts)

Devnet transactions can take longer than local dev. If a `wait()` call times out
with `Timeout awaiting isMined`, the transaction can still be mining.

UI guidance:
- Show a "proving" stage (proof generation can be the slowest step).
- If a timeout occurs, keep polling rather than immediately reporting failure.
- Expect the **first** transaction to be the slowest (key download + warm-up).

## Client build + hosting

The client is a static site built by webpack. Env vars are baked in at build time.

Build locally:

```bash
yarn client:build
```

Host `apps/client/dist` on a static host (Netlify/Cloudflare Pages/etc). If you
use Netlify, `apps/client/netlify.toml` is already provided.

Required client env vars (set before the build):
- `VITE_AZTEC_NODE_URL`
- `VITE_DARKFOREST_ADDRESS`
- `VITE_NFT_ADDRESS`
- `VITE_SPONSORED_FPC_ADDRESS` (recommended)
- `VITE_PROVER_ENABLED=true`

Optional perlin/init overrides are filled in by the deploy script's `.env.local`.

## Player access options (devnet)

### Option A: Local play (recommended today)

Each player runs the client locally and supplies their own account keys:

1) Run the deploy script with `ACCOUNT_MODE=random` to generate keys.
2) Keep the generated `ACCOUNT_SECRET`, `ACCOUNT_SALT`, `ACCOUNT_SIGNING_KEY`.
3) Put them in `apps/client/.env.local` (or export in the shell) and run:

```bash
yarn client:dev
```

### Option B: Hosted demo (single shared account)

Embed one account's keys in the hosted build. This lets anyone play but all users
share one account (not suitable for real gameplay).

### Option C: Hosted multi-user (recommended future work)

Add an account-creation/import flow to the client:
- "Create account" -> generate random keys in-browser, store in IndexedDB/localStorage,
  show export/backup.
- "Import account" -> paste keys into the client and persist them.
- Deploy the account on first use using Sponsored FPC.

## Local network (fast dev loop)

Start a local Aztec network (dockerized):

```bash
aztec start --local-network --node --sequencer --pxe --archiver
```

Deploy contracts + write `apps/client/.env.local`:

```bash
node packages/contracts/scripts/deploy_local.js --write-env --overwrite-env
```

Optional: keep blocks moving (local-only ticker):

```bash
node packages/contracts/scripts/watch_blocks.js --tick
```

Run the client:

```bash
yarn client:dev
```

## Performance measurement (turn time)

Use the benchmark helper (local devnet recommended):

```bash
PROVER_ENABLED=true node packages/contracts/scripts/bench_move.js --deploy
```

The script prints `move_ms` in the benchmark summary. That value represents a
single turn (proof generation -> tx submission -> acceptance).

## Troubleshooting

- **Node not reachable**: verify `AZTEC_NODE_URL` and connectivity.
- **Sponsored fees failing**: verify `SPONSORED_FPC_ADDRESS` and that it exists
  on-chain. Remove it to fall back to Fee Juice if needed.
- **Existing nullifier errors**: account already deployed; use a new account
  (`ACCOUNT_MODE=random`) or rotate secrets.
- **Client config mismatch**: if planets look wrong, ensure perlin keys match
  the deployed config. Re-run deploy with `--overwrite-env`.
