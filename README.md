# Dark Forest on Aztec

A faithful Dark Forest v0.6 port to Aztec using Noir contracts + the classic
React client. This repository was built solo in ~2 weeks as a rapid prototype
sprint (for fun) in January 2026, and now serves as the foundation for a
full, production-grade port.

## Quick links

- `docs/PROJECT_MAP.md`: active vs reference directories
- `docs/devnet.md`: local + devnet deployment runbook
- `docs/giga-truth-report.md`: current status and parity gaps
- `docs/action-call-graphs.md`: client -> Aztec call graphs
- `docs/performance.md`: turn-time notes and benchmarks

## Repo layout (active)

- `packages/contracts`: Aztec Noir contracts + scripts/tests
- `packages/nft`: Aztec-native NFT contract for artifacts
- `packages/shared`: shared TS types/constants
- `packages/df-*`: local TS packages used by the client
- `apps/client`: React web client

Reference-only (do not build/run): `reference/*`

## Quick start (local dev)

```bash
yarn install
yarn contracts:compile
yarn contracts:test:nr
```

Start a local Aztec network:

```bash
aztec start --local-network --node --sequencer --pxe --archiver
```

Deploy to local and write `apps/client/.env.local`:

```bash
node packages/contracts/scripts/deploy_local.js --write-env --overwrite-env
```

Run the client:

```bash
yarn client:dev
```

Optional local ticker (local only):

```bash
node packages/contracts/scripts/watch_blocks.js --tick
```

## Devnet deploy (summary)

See `docs/devnet.md` for the full runbook. Short version:

```bash
export AZTEC_NODE_URL=https://next.devnet.aztec-labs.com/
export SPONSORED_FPC_ADDRESS=0x1586f476995be97f07ebd415340a14be48dc28c6c661cc6bdddb80ae790caa4e
export PROVER_ENABLED=true

node packages/contracts/scripts/deploy_devnet.js --write-env --overwrite-env
```

Notes:
- Devnet has fees and no pre-deployed accounts.
- Ticker is not needed on devnet (blocks advance automatically).

## Client configuration

The client reads Vite env vars at build time. For local dev, create
`apps/client/.env.local` with:

```bash
VITE_AZTEC_NODE_URL=http://localhost:8080
VITE_DARKFOREST_ADDRESS=0x...
VITE_NFT_ADDRESS=0x...
VITE_SPONSORED_FPC_ADDRESS=0x...   # optional on local, recommended on devnet
VITE_PROVER_ENABLED=true
```

Optional overrides (these are filled in by the deploy scripts):

```bash
VITE_PLANETHASH_KEY=42
VITE_SPACETYPE_KEY=43
VITE_PERLIN_LENGTH_SCALE=1024
VITE_PERLIN_MIRROR_X=false
VITE_PERLIN_MIRROR_Y=false
VITE_INIT_X=990
VITE_INIT_Y=0
VITE_INIT_RADIUS=1000
VITE_REVEAL_X=123
VITE_REVEAL_Y=456
```

## Hosting (Cloudflare Pages)

Build command:

```bash
yarn client:build
```

Output directory:

```
apps/client/dist
```

Set these env vars in the Pages build environment:

- `VITE_AZTEC_NODE_URL`
- `VITE_DARKFOREST_ADDRESS`
- `VITE_NFT_ADDRESS`
- `VITE_SPONSORED_FPC_ADDRESS`
- `VITE_PROVER_ENABLED=true`

Reminder: Vite env vars are baked in at build time. If you change them, trigger
another build.

## Accounts and keys (devnet)

Devnet has no pre-deployed accounts. The deploy scripts can generate keys for
local use. For a hosted multiplayer experience, the client will need an in-app
account create/import flow (planned work). See `docs/devnet.md` for details.

## Performance (turn-time)

Use the local benchmark helper:

```bash
PROVER_ENABLED=true node packages/contracts/scripts/bench_move.js --deploy
```

The script prints `move_ms`, which tracks end-to-end turn time.

## License

MIT for original code in this repo; see `LICENSE`.
Bundled Dark Forest components remain under their original LGPL licenses
(see `packages/df-*/LICENSE` and `reference/*`).
