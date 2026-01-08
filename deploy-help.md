• df-local.sh Features

  - One‑stop local runner: builds Noir contracts + client by default, optionally deploys contracts, starts mining, runs the client dev server.
  - Reset local network: --reset stops/removes Docker containers named aztec-start-* or aztec-local-* (does not touch ~/.aztec).
  - Deploy Dark Forest + NFT: --deploy (or --redeploy) runs packages/contracts/scripts/deploy_local.js with:
      - --write-env --overwrite-env
      - configurable --world-radius, --planet-rarity, --time-factor, --block-time
      - writes apps/client/.env.local.
  - Mine L2 blocks: --mine-blocks starts node aztec-tick.mjs in the background (interval from --tick-interval) and logs to .aztec-tick.log. Skips if already running. --mine-only starts mining only and skips build/deploy/
    client.
  - Run client: --run-client starts yarn client:dev. --run/--all does deploy + mine blocks + run client.
  - Snapshot integration:
      - --snapshot builds apps/client/public/snapshot.json using packages/contracts/scripts/indexer_snapshot.js and sets DF_SNAPSHOT_URL=/public/snapshot.json in apps/client/.env.local.
      - --snapshot-watch keeps snapshot updated in the background (watcher process), logs to .snapshot-watch.log; implies --snapshot.
      - Tunables: --snapshot-poll <ms> and --snapshot-min-interval <ms> pass through to the snapshot watcher.
  - Validation & defaults:
      - Defaults: radius 200, planet rarity 12, time factor 1000, tick interval 0.25s, snapshot poll 5000ms, snapshot min interval 15000ms.
      - Validates numeric inputs and requires apps/client/.env.local + VITE_DARKFOREST_ADDRESS for mining/snapshot flows.
      - --block-time defaults to --tick-interval if not set.
  - Env helpers: internal helpers read and upsert keys in apps/client/.env.local.