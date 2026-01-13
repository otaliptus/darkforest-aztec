# Action Call Graphs (Client -> Aztec -> Noir)

Legend:
- "private" and "public only_self" refer to Noir entrypoint visibility.
- File references are indicative; Noir methods live in `packages/contracts/src/main.nr` unless noted.
- JS client paths are based on `apps/client` (Aztec flow).

## Common client transaction pipeline
Most actions share the same top-level pipeline:

1) UI/UX action -> `GameManager.<action>()` (input checks, localStorage, terminal logging).
2) `ContractsAPI.submitTransaction(txIntent)`
   - Builds TxIntent with `methodName`, `args` (often deferred), and metadata.
   - Emits `TxSubmitted` / `TxConfirmed` events for UI updates.
3) `ContractsAPI.dispatchAztecTransaction(method, intent, args)`
   - Calls `AztecConnection.getClient()` -> `DarkForestClient.<method>`.
4) `connectDarkForest` (Aztec wrapper in `apps/client/src/Backend/Aztec/scripts/darkforest.ts`)
   - Wraps `darkforest.methods.<noir_fn>(...)` and `.send(sendOptions)`.
5) Noir private entrypoint validates inputs and enqueues a public apply.
6) Noir public `only_self` entrypoint mutates public state.

The per-action graphs below expand steps 1, 3, and 5–6 with the action-specific details.

## Connection + config read (bootstrap)
This is the implicit graph that precedes all actions:

- `App.tsx` -> `GameManager` initialization
  -> `AztecConnection.connect()`
  -> `connectDarkForest(config)` (`apps/client/src/Backend/Aztec/scripts/darkforest.ts`)
     -> `createAztecNodeClient` + `waitForNode`
     -> `TestWallet.create` + `resolveAccount`
     -> `loadContractArtifact` for DarkForest
     -> `registerContractInstance` (wallet.registerContract + Contract.at)
     -> `getStorageSlots(darkforestArtifactJson)`
     -> `readGameConfig(node, darkforestAddress, storageSlots)`
        -> `node.getPublicStorageAt` per config field
     -> build `perlinConfig` and `gameConfig`
     -> optional NFT contract registration (same pattern)
     -> optional SponsoredFPC setup
     -> returns `DarkForestClient` with typed methods

## Read flow: initial state sync
- `GameManager.create` -> `InitialGameStateDownloader.download(contractsAPI, persistentChunkStore)`
  -> `SnapshotLoader` tries `DF_SNAPSHOT_URL`
  -> If no snapshot:
     - `ContractsAPI.getTouchedPlanetIds()`
       -> `readTouchedPlanetIdsRange` (public storage reads)
     - `ContractsAPI.getRevealedCoords()`
       -> `readRevealedCoordsRange` (public storage reads)
     - `ContractsAPI.getPlanetWithId` / `getArtifactsOnPlanet` / `getPlayer` etc
       -> `readPublicMapField(s)` / `readPublicFields`
  -> `GameObjects` seeded with planets, artifacts, arrivals, players

## Action call graphs

### Initialize player (join game)
- UI -> `GameManager.joinGame()`
  -> `findRandomHomePlanet()` + `persistentChunkStore.addHomeLocation`
  -> prepare args `[x, y, radius]` and `txIntent.methodName = "initializePlayer"`
  -> `ContractsAPI.submitTransaction`
  -> `ContractsAPI.dispatchAztecTransaction(METHOD.INIT)`
     -> `AztecConnection.getClient().initPlayer(xField, yField, radius)`
     -> `darkforest.methods.init_player(...buildInitPlayerArgs(...))`
  -> `DarkForest::init_player` (private)
     -> perlin + config hash validation, `mimc_sponge_2_220` location id
     -> push nullifiers
     -> enqueue `apply_init_player(...)`
  -> `DarkForest::apply_init_player` (public only_self)
     -> `default_planet` + `init_planet_extras`
     -> write `players`, `planets`, `player_*`
     -> `index_touched_planet`

### Reveal location
- UI -> `GameManager.revealLocation()`
  -> args `[x, y]`, `txIntent.methodName = "revealLocation"`
  -> `ContractsAPI.submitTransaction`
  -> `dispatchAztecTransaction(METHOD.REVEAL_LOCATION)`
     -> `AztecConnection.getClient().revealLocation(xField, yField)`
     -> `darkforest.methods.reveal_location(...buildRevealLocationArgs(...))`
  -> `DarkForest::reveal_location` (private)
     -> perlin + config hash validation, `mimc_sponge_2_220`
     -> enqueue `apply_player_action(..., action=1)`
  -> `DarkForest::apply_player_action` (public only_self)
     -> cooldown checks
     -> initialize planet if missing
     -> write `revealed`, `touched` and `revealed` indices

### Move (normal move / artifact / ship move)
- UI -> `GameManager.move()`
  -> local checks (ownership, bounds, artifact state)
  -> args `[x1,y1,x2,y2, worldRadius, distMax, forces, silver, artifactId, abandoning]`
  -> `txIntent.methodName = "move"` -> `ContractsAPI.submitTransaction`
  -> `dispatchAztecTransaction(METHOD.MOVE)`
     -> `AztecConnection.getClient().move(...)`
     -> `darkforest.methods.move(..., perlinConfig.*, gameConfig.configHashSpacetype, maxLocationId, worldRadius)`
  -> `DarkForest::move` (private)
     -> bounds + dist validation + perlin + config hash
     -> enqueue `apply_move(..., config_hash)`
  -> `DarkForest::apply_move` (public only_self)
     -> `process_pending_arrivals` (from/to)
     -> `refresh_planet` (from/to)
     -> artifact handling + wormhole/photoid checks
     -> create `Arrival`, insert into `planet_arrivals`
     -> update origin planet + artifact locations

### Resolve arrival
- UI -> `GameManager` (arrival maturation) -> `ContractsAPI.resolveArrival(arrivalId)`
  -> `AztecConnection.getClient().resolveArrival(arrivalId)`
  -> `darkforest.methods.resolve_arrival(arrivalId)`
  -> `DarkForest::resolve_arrival` (private)
     -> enqueue `apply_move(..., config_hash=0)`
  -> `DarkForest::apply_move` (public only_self)
     -> sentinel branch -> `execute_arrival(arrival_id)`
  -> `DarkForest::execute_arrival`
     -> combat/capture, silver transfer, artifact drop-in
     -> remove from `planet_arrivals` + clear `arrivals` entry

### Upgrade planet
- UI -> `GameManager.upgradePlanet()`
  -> args `[locationId, branch]`, `txIntent.methodName = "upgradePlanet"`
  -> `ContractsAPI.submitTransaction` -> `dispatchAztecTransaction(METHOD.UPGRADE)`
     -> `AztecConnection.getClient().upgradePlanet(locationId, branch)`
     -> `darkforest.methods.upgrade_planet(locationId, branch)`
  -> `DarkForest::upgrade_planet` (private)
     -> enqueue `apply_player_action(..., action=3)`
  -> `DarkForest::apply_player_action` (public only_self)
     -> `execute_upgrade_planet` (refresh + cost + stat multipliers)

### Prospect planet
- UI -> `GameManager.prospectPlanet()`
  -> args `[locationId]`, `txIntent.methodName = "prospectPlanet"`
  -> `ContractsAPI.submitTransaction` -> `dispatchAztecTransaction(METHOD.PROSPECT_PLANET)`
     -> `AztecConnection.getClient().prospectPlanet(locationId)`
     -> `darkforest.methods.prospect_planet(locationId)`
  -> `DarkForest::prospect_planet` (private)
     -> enqueue `apply_player_action(..., action=4)`
  -> `DarkForest::apply_player_action` (public only_self)
     -> set `planet_artifact_state.prospected_block_number`

### Find artifact
- UI -> `GameManager.findArtifact()`
  -> args `[x, y]`, `txIntent.methodName = "findArtifact"`
  -> `ContractsAPI.submitTransaction`
  -> `dispatchAztecTransaction(METHOD.FIND_ARTIFACT)`
     -> compute `biomebase = multiScalePerlin(...)`
     -> `AztecConnection.getClient().findArtifact(xField, yField, biomebase)`
     -> `darkforest.methods.find_artifact(...buildFindArtifactArgs(...))`
  -> `DarkForest::find_artifact` (private)
     -> config hash validation, `mimc_sponge_2_220`
     -> enqueue `apply_player_action(..., action=5)`
  -> `DarkForest::apply_player_action` (public only_self)
     -> prospect timing checks
     -> derive artifact seed + rarity
     -> create artifact + `artifact_locations`
     -> `nft_mint(contract_addr, artifact_id)`

### Deposit artifact (trade in)
- UI -> `GameManager.depositArtifact()`
  -> args `[locationId, artifactId]`, `txIntent.methodName = "depositArtifact"`
  -> `ContractsAPI.submitTransaction` -> `dispatchAztecTransaction(METHOD.DEPOSIT_ARTIFACT)`
     -> `AztecConnection.getClient().tradeArtifact(locationId, artifactId, false)`
     -> `darkforest.methods.trade_artifact(locationId, artifactId, false)`
  -> `DarkForest::trade_artifact` (private)
     -> enqueue `apply_player_action(..., action=10)`
  -> `DarkForest::apply_player_action` (public only_self)
     -> add to `planet_artifacts`
     -> update `artifact_locations`
     -> `nft_transfer(player -> contract)`

### Withdraw artifact (trade out)
- UI -> `GameManager.withdrawArtifact()`
  -> args `[locationId, artifactId]`, `txIntent.methodName = "withdrawArtifact"`
  -> `ContractsAPI.submitTransaction` -> `dispatchAztecTransaction(METHOD.WITHDRAW_ARTIFACT)`
     -> `AztecConnection.getClient().tradeArtifact(locationId, artifactId, true)`
     -> `darkforest.methods.trade_artifact(locationId, artifactId, true)`
  -> `DarkForest::trade_artifact` (private)
     -> enqueue `apply_player_action(..., action=11)`
  -> `DarkForest::apply_player_action` (public only_self)
     -> remove from `planet_artifacts`
     -> update `artifact_locations`
     -> `nft_transfer(contract -> player)`

### Activate artifact / ship
- UI -> `GameManager.activateArtifact()`
  -> args `[locationId, artifactId, wormholeTo]`, `txIntent.methodName = "activateArtifact"`
  -> `ContractsAPI.submitTransaction` -> `dispatchAztecTransaction(METHOD.ACTIVATE_ARTIFACT)`
     -> `AztecConnection.getClient().setArtifactActivation(locationId, artifactId, wormholeTo, true)`
     -> `darkforest.methods.set_artifact_activation(...)`
  -> `DarkForest::set_artifact_activation` (private)
     -> enqueue `apply_player_action(..., action=12)`
  -> `DarkForest::apply_player_action` (public only_self)
     -> ship activation (Crescent) OR artifact activation
     -> wormhole target validation, cooldown checks
     -> `upgrade_for_artifact` -> `buff_planet`
     -> burn paths transfer NFT to contract

### Deactivate artifact
- UI -> `GameManager.deactivateArtifact()`
  -> args `[locationId, artifactId]`, `txIntent.methodName = "deactivateArtifact"`
  -> `ContractsAPI.submitTransaction` -> `dispatchAztecTransaction(METHOD.DEACTIVATE_ARTIFACT)`
     -> `AztecConnection.getClient().setArtifactActivation(locationId, artifactId, 0, false)`
     -> `darkforest.methods.set_artifact_activation(...)`
  -> `DarkForest::set_artifact_activation` (private)
     -> enqueue `apply_player_action(..., action=13)`
  -> `DarkForest::apply_player_action` (public only_self)
     -> `execute_deactivate_artifact` -> `debuff_planet`
     -> burn shields/photoid -> `nft_transfer(contract -> contract)`

### Give space ships
- UI -> `GameManager.giveSpaceShips()`
  -> args `[locationId]`, `txIntent.methodName = "giveSpaceShips"`
  -> `ContractsAPI.submitTransaction` -> `dispatchAztecTransaction(METHOD.GET_SHIPS)`
     -> `AztecConnection.getClient().giveSpaceShips(locationId)`
     -> `darkforest.methods.give_space_ships(locationId)`
  -> `DarkForest::give_space_ships` (private)
     -> enqueue `apply_player_action(..., action=2)`
  -> `DarkForest::apply_player_action` (public only_self)
     -> compute ship ids, write `spaceships`, `spaceship_owners`
     -> `planet_artifacts_add` + `nft_mint(player, ship_id)`

### Admin-only actions (not exposed in current JS wrapper)
- `admin_set_planet_silver`, `admin_set_planet_owner`,
  `admin_set_planet_type_and_level`, `admin_create_artifact_on_planet`
- Require a custom Aztec script or direct contract call.
- All follow: private entry -> enqueue `apply_player_action` -> public mutation.

## NFT actions (packages/nft)

### NFT constructor (deploy)
- `deploy_local.js` -> `NFT.constructor(minter)` (public initializer)

### NFT mint
- Called by `DarkForest.nft_mint`
- Flow: `DarkForest` (minter) -> `NFT.mint(to, token_id)`

### NFT transfer_in_public
- Called by `DarkForest.nft_transfer`
- Flow: `DarkForest` (minter) -> `NFT.transfer_in_public(from, to, token_id, authwit_nonce)`

### NFT burn (unused by DarkForest)
- `NFT.burn(token_id)` exists but is not called by DarkForest;
  burn semantics are implemented as transfer to the contract itself.
