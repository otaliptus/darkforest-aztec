# Dark Forest on Aztec

This workspace is the Aztec port target. Reference repos live under `reference/`:

- `reference/darkforest-v0.6`: Canonical v0.6 contracts, circuits, and client.
- `reference/darkforest-local`: Runnable local Dark Forest for behavior reference.
- `reference/aztec-starter`: Aztec/Noir starter project reference.
- `reference/noir`: Noir language/toolchain reference.

See `docs/PROJECT_MAP.md` for active vs reference directories.

## Workspace Layout

- `packages/contracts`: Aztec Noir contracts + tests.
- `packages/shared`: Shared TypeScript types/constants.
- `apps/client`: React web client.

## Quick Start (Local)

From repo root:

```bash
yarn install
yarn contracts:compile
yarn contracts:test:nr
```

Client:

```bash
yarn client:dev
```

### Client config (local)

Create `apps/client/.env.local` with:

```bash
VITE_DARKFOREST_ADDRESS=0x...
VITE_NFT_ADDRESS=0x...
VITE_AZTEC_NODE_URL=http://localhost:8080
```

Optional overrides (defaults match contract tests):

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

### Playable client workflow

1. Deploy contracts and set `VITE_DARKFOREST_ADDRESS` (and `VITE_NFT_ADDRESS` for artifact ownership).
2. Run `yarn client:dev` and connect the wallet.
3. Use **Track Coordinates** to add locations to the galaxy (or use `init_player` / `reveal_location`).
4. Select a location from the galaxy or list, then use actions like **move**, **upgrade**, **prospect**, **find artifact**, **trade**, or **activate**.
5. The client reads public storage live; tracked locations persist in localStorage.
