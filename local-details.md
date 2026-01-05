# Local Dev Notes (Aztec Dark Forest)

## Block advancement on local Aztec
- **L2 blocks only advance when a transaction is successfully included.**
  - If no successful tx is submitted, block numbers stay stuck (arrivals waiting on a block won’t resolve).
  - A reverted tx does **not** advance the block.

### Fast manual unblock
- Send any small, valid tx (e.g. a tiny move or admin action) to push the chain forward.
- If you see arrival logs like `arrivalBlock=19, currentBlock=16`, you need a successful tx to move past 19.

## Block watcher + tx ticker
We provide a watcher script that can **print tips** and optionally **send a tx** to advance blocks.

### Watch only
```bash
AZTEC_NODE_URL=http://localhost:8080 \
BLOCK_POLL_MS=1000 \
node packages/contracts/scripts/watch_blocks.js
```

### Watch + tick txs when stalled
```bash
AZTEC_NODE_URL=http://localhost:8080 \
TICK_TX=1 \
TICK_EVERY_MS=3000 \
BLOCK_POLL_MS=1000 \
node packages/contracts/scripts/watch_blocks.js
```

#### Env vars used by the ticker
- `TICK_TX=1` enables tx ticking.
- `TICK_EVERY_MS` cadence (default: 5000ms).
- `TICK_TIMEOUT_MS` wait for tx inclusion (default: 20000ms).
- `DARKFOREST_ADDRESS` (or `VITE_DARKFOREST_ADDRESS` from `apps/client/.env.local`).
- `ACCOUNT_INDEX` (or `VITE_ACCOUNT_INDEX`) for the admin account (default: 0).
- `TICK_LOCATION_ID` optional override; if unset, script reads admin’s `home_planet` from public storage.
- `SPONSORED_FPC_ADDRESS` (or `VITE_SPONSORED_FPC_ADDRESS`) to use sponsored fees.

#### Common ticker error
- **`No contract instance found for address ...`**
  - The wallet hasn’t registered the on‑chain DarkForest instance.
  - Ensure `DARKFOREST_ADDRESS` is correct and that DarkForest is deployed.

## Client request spam is expected
- The browser client continually polls Aztec public storage (e.g. `node_getPublicStorageAt`).
- This **looks like spam** in the node logs, but it’s expected while a game tab is open.
- Close the tab to stop these requests.

## Quick checklist when blocks are stuck
1. Confirm node URL is correct (`AZTEC_NODE_URL`).
2. Submit a small, valid tx (or enable `TICK_TX=1`).
3. If still stuck, verify DarkForest address and admin account index.
4. Check node logs for `Received tx` and `Processed` lines.

