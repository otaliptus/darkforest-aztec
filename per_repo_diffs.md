# Per-Repo Diffs Summary

## Root repo (`/Users/talip/Desktop/darkforest-aztec`)
- Modified (tracked):
  - `apps/client/vite.config.ts` (Vite optimizeDeps change)
  - `tasks/019-playable-client-integration.md` (status updates)
  - `tasks/020-performance-devnet-deploy-docs.md` (status + notes)
  - `progress-2026-01-03-1653.md` (new progress report)
- Submodules flagged as dirty: `reference/darkforest-local`

## Submodule: `reference/darkforest-local`
- Submodules flagged as dirty: `circuits`, `eth`, `packages` (gitlink only at this level).

### `reference/darkforest-local/circuits`
- Untracked:
  - `node_modules/.bin/circom`
  - `node_modules/.bin/eslint`
  - `node_modules/.bin/prettier`
  - `node_modules/.bin/snarkjs`
- Tracked diffs: none.

### `reference/darkforest-local/eth`
- Tracked diff:
  - `package.json`: `hardhat:node` host changed from `0.0.0.0` → `127.0.0.1`.
- Untracked: none.

### `reference/darkforest-local/packages`
- Tracked diffs:
  - `contracts/index.ts`, `contracts/index.js`, `contracts/index.d.ts`
    - `NETWORK: 'xdai' → 'localhost'`
    - `NETWORK_ID: 100 → 31337`
    - `START_BLOCK: 20713468 → 0`
    - `CONTRACT_ADDRESS` + `INIT_ADDRESS` updated to local addresses.
- Untracked (many; likely from installs):
  - `constants/node_modules/.bin/*`
  - `contracts/node_modules/.bin/*`
  - `events/node_modules/.bin/*`
  - `gamelogic/node_modules/.bin/*`
  - `hashing/node_modules/.bin/*`
  - `hexgen/node_modules/.bin/*`
  - `network/node_modules/.bin/*`
  - `network/node_modules/p-timeout/*`
  - `network/node_modules/uuid/*`
  - `procedural/node_modules/.bin/*`
  - `renderer/node_modules/.bin/*`
  - `serde/node_modules/.bin/*`
  - `settings/node_modules/.bin/*`
  - `snarks/node_modules/.bin/*`
  - `types/node_modules/.bin/*`
  - `ui/node_modules/.bin/*`

## Submodule: `reference/darkforest-v0.6`
- Clean (no diffs).

## Submodule: `reference/noir`
- Clean (no diffs).
