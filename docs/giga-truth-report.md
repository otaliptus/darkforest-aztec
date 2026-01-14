# Giga Truth Report - Current Architecture (Aztec Dark Forest)

Date: 2026-01-14
Ticket: 035 (Giga truth report)

## Scope and method
- This report is based on the code, tests, and runtime configs currently in this repo.
- It explicitly ignores any task or plan claims.
- The focus is the Aztec port as it exists today (contracts, client, scripts, runtime wiring).
- Sources were primarily `packages/contracts`, `packages/nft`, `apps/client`, plus the deploy/indexing scripts.

## Top-level layout
- `apps/`:
  - `client/`: The active React client wired to Aztec.
  - `client-og/`: A legacy/alternate client copy, not wired into Aztec flow.
- `packages/`:
  - `contracts/`: Noir Aztec contract for Dark Forest.
  - `nft/`: Noir Aztec NFT contract used by DarkForest.
  - `shared/`: Small shared TS types/constants.
  - `df-*`: Local copies of Dark Forest TS packages (constants, types, renderer, etc) used by the client.
- `docs/`: Internal docs and architecture notes.
- `reference/`: Cloned upstreams (darkforest v0.6, noir, aztec-starter, darkforest-local). These are not runtime dependencies.
- `scripts/`: Misc scripts (non-contract).
- `aztec-tick.mjs`: Admin tick helper (writes a tx periodically).

## Workspace and dependency shape
- Root `package.json` uses Yarn workspaces: `apps/*` and `packages/*`.
- `apps/client` consumes `packages/df-*` as local packages (these are copies of upstream Dark Forest modules).
- `packages/contracts` and `packages/nft` are independent Noir projects; they build/compile/deploy with Aztec tooling.
- There is no monorepo build pipeline that couples all packages; each package has its own scripts.

## On-chain: DarkForest contract (packages/contracts)

### Source layout
- `packages/contracts/src/main.nr`: Main Noir contract `DarkForest`.
- `packages/contracts/src/types.nr`: Structs and types (`GameConfig`, `Planet`, `Player`, `Artifact`, `Arrival`, etc).
- `packages/contracts/src/utils.nr`: Math/field helpers, array helpers, conversions.
- `packages/contracts/src/perlin.nr`: Perlin + multi-scale perlin noise implementation.
- `packages/contracts/src/mimc.nr`: MiMC sponge hash utilities.
- Tests: `packages/contracts/src/test/darkforest_stub.nr` + `packages/contracts/src/test/utils.nr`.
- Scripts: `packages/contracts/scripts/deploy_local.js`, `indexer_snapshot.js`, `watch_blocks.js`.

### Contract entry pattern
- The contract follows a strict split: **private validate -> public apply (only_self)**.
- Private entrypoints compute perlin/hashes, validate bounds, and enqueue public methods:
  - `init_player`, `reveal_location`, `move`, `upgrade_planet`, `prospect_planet`, `find_artifact`, `trade_artifact`, `set_artifact_activation`, `give_space_ships`.
  - Admin actions: `admin_set_planet_silver`, `admin_set_planet_owner`, `admin_set_planet_type_and_level`, `admin_create_artifact_on_planet`.
  - `resolve_arrival` is private but enqueues `apply_move` with a special config flag.
- Public apply methods are guarded with `#[only_self]`:
  - `apply_player_action`: multiplexed action handler using an action code (0..13).
  - `apply_move`: handles normal moves and arrival resolution based on `config_hash` sentinel.

### Storage schema (public state)
Grouped by component to make it easier to reason about:

1) Admin and config
- `admin`: Admin address.
- `nft_contract`: Address of Aztec NFT contract.
- `config`: `GameConfig` struct (keys, world bounds, time factor, etc), stored as `PublicImmutable` (WithHash) to enable private reads.
- `config_hash_spacetype`, `config_hash_biome`: PublicImmutable hashes used to validate private flows in public apply handlers.

2) Players
- `players`: `Map<AztecAddress, Player>`.
- `player_claimed_ships`: one-time spaceship grant flag.
- `player_space_junk`: current space junk amount.
- `player_space_junk_limit`: limit derived from config constant.

3) Planets + planet extras
- `planets`: `Map<Field, Planet>`.
- `planet_destroyed`: destroyed planet marker.
- `planet_space_junk`: per-planet space junk amount.
- `planet_artifact_state`: per-planet artifact prospecting state (prospected block + tried flag).
- `planet_energy_doublers`, `planet_silver_doublers`: per-planet temporary buffs.
- `planet_pausers`: used in arrival caps for silver banks/paused planets.

4) Artifacts and ships
- `artifacts`: `Map<Field, Artifact>`.
- `artifact_locations`: location for an artifact id (0 = in transit/unowned; max_location_id = burned).
- `planet_artifacts`: `Map<Field, PlanetArtifacts>` (5 slots per planet).
- `spaceships`: `Map<Field, u8>` (ship type per ship id).
- `spaceship_owners`: ownership of ship artifacts.

5) Arrivals
- `arrivals`: `Map<Field, Arrival>` (by arrival id).
- `planet_arrivals`: `Map<Field, PlanetArrivals>` (12-slot packed list of arrival ids per planet).
- `next_arrival_id`: global counter.

6) Reveal and indexing
- `revealed`: `Map<Field, RevealedCoords>` (the public reveal record).
- `touched_planet_ids_count`, `touched_planet_ids`, `touched_planet_seen`: index of touched planet ids.
- `revealed_coords_count`, `revealed_coords`, `revealed_seen`: index of revealed coords records.

### Core internal logic (component-wise)
- **Location hashing**: `mimc_sponge_2_220(x, y, planethash_key)` produces `location_id`.
- **Config hash**: `config_hash(planethash_key, spacetype_key/biomebase_key, perlin_length_scale, perlin_mirror_*)` is stored on-chain and passed through private calls to be validated in public apply handlers.
- **Perlin and planet defaults**:
  - `multi_scale_perlin` + thresholds map to `space_type`.
  - `planet_level_from_location`, `planet_type_from_location`, `biome_from_space_type` are derived from location and perlin.
  - `default_planet` and `default_planet_from_stats` generate base stats.
- **Planet updates**:
  - `refresh_planet` calls `update_population` and `update_silver` based on block number.
  - `decayed_population` computes travel decay.
- **Arrivals**:
  - `process_pending_arrivals` scans `planet_arrivals` and applies matured arrivals.
  - `execute_arrival` handles combat, capture, silver transfer, artifact drop-in, and removes arrival from list.
- **Artifacts**:
  - `artifact_seed` uses pseudo blockhash from `prospected_block_number` and config keys.
  - `random_artifact_type_and_level_bonus` and `artifact_rarity_from_planet_level` produce type/rarity.
  - `upgrade_for_artifact`, `buff_planet`, `debuff_planet` apply stat changes.
- **Spaceships**:
  - Ships are artifacts with special types; special cases for movement and activation.
  - `apply_spaceship_depart` and `apply_spaceship_arrive` apply ship stat effects.

### Action flows (flow-wise)
Action logic is executed via `apply_init_player`, `apply_player_action`, and `apply_move`. The private entrypoints only validate and enqueue.

1) Init player (`apply_init_player`)
- Validates spawn radius and perlin range in private `init_player` using config read from storage; public `apply_init_player` validates the stored config hash.
- Pushes nullifiers for location and player.
- `apply_init_player`:
  - Initializes the home planet if unset and writes `Player` record.
  - Sets claimed ships flag, space junk, and space junk limit.
  - Indexes the planet id as touched.

2) Reveal location (action 1)
- Private `reveal_location` validates perlin using config read from storage.
- `apply_player_action`:
  - Enforces reveal cooldown (non-admin).
  - Initializes the planet if absent and pushes a nullifier to prevent re-init.
  - Writes `revealed` and indexes touched/revealed coords.
  - Updates player `last_reveal_block`.

3) Give space ships (action 2)
- One-time claim per player at their home planet.
- Mints 5 ship artifacts, sets `spaceships` and `spaceship_owners`, adds to planet artifacts.
- Mints NFT for each ship id to the player.

4) Upgrade planet (action 3)
- `execute_upgrade_planet`:
  - Refreshes planet and applies resource checks.
  - Computes cost based on `silver_cap` and upgrade level.
  - Applies stat multipliers and increments upgrade state.

5) Prospect planet (action 4)
- Marks `prospected_block_number` for a Foundry planet (only once).

6) Find artifact (action 5)
- Validates biomebase using config read from storage (config hash validated in public apply).
- Requires a previous prospect and a block delay (<256 blocks).
- Derives artifact seed, type, rarity, and creates the artifact.
- Adds artifact to planet artifacts and writes location mapping.
- Mints NFT to the DarkForest contract (ownership moved via trade).

7) Admin actions (actions 6..9)
- Admin-only set silver, owner, planet type/level, or create artifact on planet.

8) Trade artifact (actions 10, 11)
- Trading post only; handles deposit (10) and withdraw (11).
- Transfers NFT between player and contract based on deposit/withdraw.
- Updates planet artifacts and artifact location.

9) Activate artifact (action 12)
- Two modes:
  - Ship activation (Crescent ship): converts unowned planet into a silver mine once.
  - Artifact activation: enforces cooldown, handles wormholes, black domain, bloom filter.
- Applies stat buffs via `upgrade_for_artifact`.
- Some artifact activations burn the artifact and remove it from planet inventory.

10) Deactivate artifact (action 13)
- `execute_deactivate_artifact` debuffs planet and may burn shield/photoid.
- Clears wormhole target and updates activation timestamps.

11) Move (apply_move path)
- Private `move` validates coordinates, distance, perlin using config read from storage and queues `apply_move` (public handler checks config hash).
- `apply_move`:
  - Refreshes origin and destination (and resolves pending arrivals on both).
  - Validates ownership, moved resources, and artifact constraints.
  - Computes wormhole and photoid modifiers; handles abandonment.
  - Creates an `Arrival` record and inserts it into the destination arrival list.
  - Removes moved artifact from origin inventory if applicable.
  - Updates population/silver on origin planet.

12) Resolve arrival (apply_move path)
- Private `resolve_arrival` queues `apply_move` with `config_hash==0`.
- `apply_move` detects the sentinel and calls `execute_arrival`.
- `execute_arrival` handles combat, capture, silver transfer, artifact drop, ship arrival effects, and removes arrival from list.

### NFT interactions
- `nft_mint` and `nft_transfer` are internal helpers that call the external NFT contract.
- Artifacts discovered via find/prospect are minted to the DarkForest contract, not directly to a player.
- Trade at a Trading Post transfers NFT ownership between player and contract.

### Tests present
- `darkforest_stub.nr` exercises init, reveal, move, upgrade, prospect/find, artifact activation, black domain, bloom filter, ships, and arrival flows.
- Tests are contract-only; no client integration tests are present here.

## On-chain: NFT contract (packages/nft)
- Contract `NFT` with a simple public ownership map.
- Methods:
  - `constructor(minter)` sets the minter.
  - `set_minter` only callable by current minter.
  - `mint` and `transfer_in_public` only callable by minter.
  - `burn` only callable by minter (sets owner to zero).
- No metadata, approvals, or transfer checks; the minter (DarkForest) is the sole operator.

## Client app (apps/client)

### Configuration and environment
- `apps/client/.env.local` is written by `packages/contracts/scripts/deploy_local.js`.
- `src/Backend/Aztec/config.ts` loads `VITE_AZTEC_*` values and defaults.
- `src/Frontend/Pages/App.tsx` hardcodes `isAztec = true` and routes accordingly.

### Aztec connection layer
- `src/Backend/Aztec/AztecConnection.ts`:
  - Creates a PXE connection and a `TestWallet`.
  - Loads contract artifacts from `packages/contracts/target` and binds to DarkForest.
  - Provides `getClient()` that exposes generated contract methods (`darkforest.ts`).
  - `getNode()` exposes a low-level Aztec node client for storage reads.

### Contract API (GameLogic)
- `src/Backend/GameLogic/ContractsAPI.ts` is the single entrypoint for reads and writes.
- Reads use direct storage slot access (no event/indexer):
  - `scripts/storage.ts` maps storage fields to slot indices and reads via the node.
- Writes map UI intents to Aztec methods:
  - `initPlayer`, `revealLocation`, `move`, `upgradePlanet`, `prospectPlanet`, `findArtifact`,
    `tradeArtifact` (deposit/withdraw), `setArtifactActivation`, `giveSpaceShips`, `resolveArrival`.
- Aztec “side-effects” are synthesized by emitting local events after tx submission/confirmation.
- Some upstream-facing calls are stubbed:
  - `getPlayersTwitters()` returns `{}`.
  - `getIsPaused()` returns `false`.

### Game orchestration
- `src/Backend/GameLogic/GameManager.ts`:
  - Orchestrates game state, local caches, miner, and UI state machine.
  - Calls `ContractsAPI` for all on-chain mutations.
  - Explicitly resolves arrivals by sending `resolve_arrival` txs.
- `GameObjects.ts` holds the in-memory object cache for planets/artifacts/players.

### Initial data loading
- `InitialGameStateDownloader.tsx` and `SnapshotLoader.ts`:
  - Prefer a JSON snapshot (`DF_SNAPSHOT_URL`) when available.
  - Otherwise reads from on-chain public state using touched/revealed indices.
- Snapshot generation is via `packages/contracts/scripts/indexer_snapshot.js`.

### Mining, procedural generation, and rendering
- `Backend/Miner/MinerManager.ts` uses web workers and Perlin to discover planets client-side.
- `Backend/Storage/PersistentChunkStore.ts` persists chunks in IndexedDB.
- Rendering and UI modules come from `packages/df-renderer`, `packages/df-ui`, etc.

### Frontend routing and pages
- `Frontend/Pages/App.tsx`: routes the client to game landing or the play view; Aztec flow bypasses lobbies.
- `Frontend/Pages/GameLandingPage.tsx`: main entry point for the Aztec game flow.
- `Frontend/Pages/LobbyLandingPage.tsx`: present but effectively disabled when `isAztec` is true.

## Scripts and local tooling
- `packages/contracts/scripts/deploy_local.js`:
  - Deploys NFT, then DarkForest.
  - Writes `apps/client/.env.local` with addresses and PXE URL.
  - Supports different map sizes/configs via CLI flags.
- `packages/contracts/scripts/indexer_snapshot.js`:
  - Reads public state and writes a snapshot JSON for faster client boot.
- `packages/contracts/scripts/watch_blocks.js`:
  - Polls block height and optionally sends a periodic “tick” transaction.
- `aztec-tick.mjs`:
  - Sends `admin_set_planet_owner` at a fixed interval (manual tick helper).

## Implemented vs missing/stubbed

Implemented (based on code + tests)
- Private validation and public apply for all core actions (init, reveal, move, upgrade, prospect, find, trade, activate/deactivate, ships, arrival resolution).
- Artifact discovery and Aztec NFT minting.
- Wormholes, photoid cannon logic, bloom filter, black domain, planetary shields.
- Space junk accumulation and abandonment mechanics.
- Block-based timing and cooldowns.
- Client can play through Aztec endpoints (no Ethereum dependency).

Missing or stubbed
- Circom/ZK proof generation and whitelist proofs (Aztec private validators replace Circom). `WhitelistSnarkArgsHelper` throws, `SnarkArgsHelper` is a passthrough.
- Ethereum RPC and account signing (Ethereum `Blockchain` adapter is largely unsupported).
- Event streaming/indexer (client reads public storage directly; no event log consumption).
- Lobbies and lobby-based onboarding (routes are bypassed when `isAztec` is true).
- Capture zones and planet transfers (`getConstants` disables these).
- Player social features (twitter verification, chat/message features are stubbed or disabled).
- Admin pause checks (`getIsPaused` is false and not connected to on-chain state).

## Misleading or outdated docs/flows
- `apps/client/README.md` is Ethereum-oriented (mentions mainnet/testnet usage and prod start) and does not reflect the Aztec-only flow.
- Root `README.md` does not mention `packages/nft` even though it is required at deploy time.
- Lobby flows exist in UI code but are bypassed by the `isAztec = true` gate.

## Concrete diffs vs Dark Forest v0.6 (logic and UX)
- Proof model: Circom proofs are replaced by Aztec private validation; the proof artifacts and whitelisting pipeline are not used.
- Arrival resolution: arrivals are not auto-resolved; the client explicitly sends `resolve_arrival` transactions.
- Event/indexer model: no Ethereum-style event stream; on-chain public state is read directly and indexed via `touched_planet_ids` / `revealed_coords` lists.
- NFT behavior: artifacts and ships mint Aztec-native NFTs; discoverable artifacts initially mint to the DarkForest contract and are traded at Trading Posts.
- Timing: uses Aztec block numbers for cooldowns and travel time; no wall-clock timestamps.
- Client UX: lobbies and social integrations are disabled; the Aztec flow is direct-to-game.
- Some v0.6 features are disabled in constants (capture zones, planet transfers) or stubbed.
