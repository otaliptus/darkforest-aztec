# Dark Forest v0.6 → Aztec Crosswalk

This document maps Dark Forest v0.6 circuits, Solidity facets, and client subsystems to the Aztec Noir contract architecture and the new client stack.

## 1) Circuits → Noir Private Validators

| v0.6 circuit | Purpose | Aztec mapping | Notes |
| --- | --- | --- | --- |
| `circuits/init` | Player initialization (home planet validity, perlin checks) | `private init_player(...)` → `public apply_init_player(...)` | Private reads config from storage; public apply updates minimal public state. |
| `circuits/move` | Move proof (old/new location, distance, perlin flags) | `private move(...)` → `public apply_move(...)` | Private reads config from storage; public apply writes arrivals + planet deltas. |
| `circuits/reveal` | Reveal location (coords preimage) | `private reveal_location(...)` → `public apply_player_action(...)` | Private uses coords input; public updates revealed coords / planet visibility. |
| `circuits/biomebase` | Biomebase proof | `private find_artifact(...)` | Used for artifact/foundry logic and/or reveal validation. |
| `circuits/perlin` | Perlin noise proof helpers | Internal helpers used by validators | Keep logic in Noir library for reuse. |
| `circuits/range_proof` | Bound checks on inputs | Internal helpers used by validators | Replace with Noir range checks where possible. |
| `circuits/whitelist` | Whitelist key proof | `private validate_whitelist_key(...)` → `public apply_whitelist(...)` | If kept for v0.6 faithfulness; otherwise admin-managed allowlist. |

### 1.1) Proof Input Shapes (v0.6 snarks → Noir inputs)

The v0.6 client uses `packages/snarks` to build proofs and contract call args. In Aztec, these become private function inputs.

- Init (v0.6): `x, y, r, PLANETHASH_KEY, SPACETYPE_KEY, SCALE, xMirror, yMirror`
  - Noir: `private init_player(x, y, r)` (config read from storage)
- Reveal (v0.6): `x, y, PLANETHASH_KEY, SPACETYPE_KEY, SCALE, xMirror, yMirror`
  - Noir: `private reveal_location(x, y)` (config read from storage)
- Move (v0.6): `x1, y1, x2, y2, r, distMax, PLANETHASH_KEY, SPACETYPE_KEY, SCALE, xMirror, yMirror`
  - Noir: `private move(x1, y1, x2, y2, r, dist_max, pop_moved, silver_moved, moved_artifact_id, abandoning)`
- Biomebase (v0.6): `x, y, PLANETHASH_KEY, BIOMEBASE_KEY, SCALE, xMirror, yMirror`
  - Noir: `private find_artifact(x, y, biomebase)` (config read from storage)
- Whitelist (v0.6): `key, recipient`
  - Noir: `private validate_whitelist_key(key, recipient)`

## 2) Solidity Facets → Aztec Contract Modules

Aztec will use a single contract with internal modules/functions instead of the diamond pattern. Each state transition follows:
`private validate_X(...)` → `public apply_X(...) (only_self)`.

| v0.6 facet | Key functions (v0.6) | Aztec module responsibilities |
| --- | --- | --- |
| `DFCoreFacet` | `initializePlayer`, `revealLocation`, `upgradePlanet`, `transferPlanet`, `buyHat`, `refreshPlanet`, `getRefreshedPlanet` | Core game state, initialization, reveal flow, upgrades, basic actions. |
| `DFMoveFacet` | `move` + arrival/decay helpers | Move validation + arrival scheduling, energy/silver deltas, planet refresh. |
| `DFCaptureFacet` | `invadePlanet`, `capturePlanet`, capture zone logic | Capture zone validation and ownership changes. |
| `DFArtifactFacet` | `createArtifact`, `findArtifact`, `deposit/withdraw`, `activate/deactivate`, `prospectPlanet`, `giveSpaceShips` | Artifact lifecycle, foundries, spacetime rips, and NFT mint triggers. |
| `DFVerifierFacet` | `verifyInitProof`, `verifyMoveProof`, `verifyRevealProof`, `verifyBiomebaseProof`, `verifyWhitelistProof` | Becomes Noir private validators (no on-chain verifier contracts). |
| `DFWhitelistFacet` | allowlist + key usage | Optional module; implement allowlist or keep key proof flow. |
| `DFAdminFacet` | pause/unpause, admin set state, create planet | Admin-only maintenance functions. |
| `DFGetterFacet` | view accessors + bulk getters | Public view functions; Aztec public read equivalents + off-chain indexing. |
| `DFRewardFacet` | `claimReward` | End-of-round rewards logic. |
| `DFDebugFacet` | debug helpers | Optional, for local testing only. |
| `DFLobbyFacet` | diamond cut proxy | Not needed; replace with Aztec initializer/config. |
| `DFInitialize` | constructor + constants | Aztec constructor config (public initializer). |

### 2.1) Init + Reveal Flow (v0.6 → Aztec)

**v0.6 init flow**
- `initializePlayer(proof, input)`:
  - `input` contains `locationId, perlin, radius, PLANETHASH_KEY, SPACETYPE_KEY, SCALE, xMirror, yMirror`.
  - `verifyInitProof` + `revertIfBadSnarkPerlinFlags`.
  - `LibPlanet.checkPlayerInit` enforces perlin bounds and spawn ring.
  - Initializes `Player` and home `Planet`.

**Aztec mapping**
- `private init_player(x, y, r)`:
  - Reads on-chain config, recomputes `locationId = mimc(x,y, PLANETHASH_KEY)` and `perlin = perlin(x,y, SPACETYPE_KEY, SCALE, mirrors)`.
  - Enforces `x^2 + y^2` bounds (spawn ring) and `perlin` in init range.
  - Enqueue `public apply_init_player(player, locationId, perlin)` with stored config hash.
- `public apply_init_player(...) (only_self)`:
  - Initialize player + planet state.

**v0.6 reveal flow**
- `revealLocation(proof, input)`:
  - `input` contains `locationId, perlin, x, y, PLANETHASH_KEY, SPACETYPE_KEY, SCALE, xMirror, yMirror`.
  - `verifyRevealProof` + `revertIfBadSnarkPerlinFlags`.
  - Initialize planet if needed; store revealed coords.

**Aztec mapping**
- `private reveal_location(x, y)`:
  - Reads on-chain config, recomputes `locationId` and `perlin`.
  - Enqueue `public apply_player_action(player, locationId, x, y, perlin, action=1)` with stored config hash.
- `public apply_reveal(...) (only_self)`:
  - Store `RevealedCoords`, initialize planet if missing.

## 3) State & Storage Mapping

v0.6 stores minimal public data (planets, arrivals, revealed coords, player state) while keeping the full universe off-chain.
Aztec approach:

- Public state: minimal, hashed/obfuscated where required, including planet ids → public summary, arrivals, revealed coords.
- Private state: player-specific details, move inputs, proof data, notes for actions.
- Notes: use Aztec notes to store private player actions (e.g., init payload, move payload) when needed.
- Events: public events for client sync; consider off-chain indexer for bulk access.

### 3.1) Struct Mapping (DFTypes.sol → Noir)

| v0.6 struct | Key fields | Aztec storage plan |
| --- | --- | --- |
| `Player` | `isInitialized`, `homePlanetId`, `lastRevealTimestamp`, `score`, `spaceJunk`, `spaceJunkLimit`, `claimedShips`, `finalRank`, `claimedReward` | Public map keyed by player address. Fields used only for private checks can move to private notes if needed. |
| `Planet` | `owner`, `population`, `silver`, `range/speed/defense`, `level/type`, `perlin`, `spaceType`, upgrade state, `createdAt/lastUpdated` | Public map keyed by locationId for discovered planets only. Hidden planets remain absent until revealed. |
| `RevealedCoords` | `locationId`, `x`, `y`, `revealer` | Public map keyed by locationId. |
| `ArrivalData` | `fromPlanet`, `toPlanet`, `arrivalTime`, `popArriving`, `silverMoved`, `artifactId`, `arrivalType` | Public map keyed by arrival id; indexed by planet for client queries. |
| `Artifact` | `id`, `rarity`, `artifactType`, `discoverer`, `controller`, `wormholeTo` | Public map keyed by artifact id; NFT mint uses artifact metadata. |
| `ArtifactWithMetadata` | `Artifact` + `Upgrade` + `owner` + `locationId/voyageId` | Derived view for client; stored as separate public maps or computed via indexer. |
| `PlanetEventMetadata` | `eventType`, `timeTrigger`, `timeAdded` | Public map or event stream only; avoid unbounded arrays. |

### 3.2) Storage Mapping (LibStorage.sol → Aztec)

- `GameStorage.planets`: `Map<Field, PublicMutable<PlanetPublic>>`
- `GameStorage.players`: `Map<AztecAddress, PublicMutable<PlayerPublic>>`
- `GameStorage.revealedCoords`: `Map<Field, PublicMutable<RevealedCoords>>`
- `GameStorage.planetArrivals`: `Map<Field, PublicMutable<ArrivalData>>`
- `GameStorage.planetArtifacts`: `Map<Field, PublicMutable<ArtifactsOnPlanet>>` (bounded list)
- `GameStorage.planetEvents`: Prefer event stream or paged map to avoid unbounded arrays.
- `GameStorage.playerIds / planetIds / revealedPlanetIds`: Use bounded append-only lists with pagination; or maintain off-chain indexer.

### 3.3) Constants Mapping (DFInitialize + LibStorage constants)

- `SnarkConstants`: stored as public constants in contract storage (planethash key, spacetype key, biomebase key, perlin mirror flags, perlin scale).
- `GameConstants`: stored as public constants (world radius bounds, thresholds, rarity tables, junk limits, capture zone params, artifact point values).
- `PlanetDefaultStats`, `Upgrades`: store as public constants or use compile-time constants in Noir where feasible.

### 3.4) Hashing / Perlin (v0.6 packages → Aztec)

- v0.6 uses MiMC + perlin helpers in `packages/hashing`. These inputs must align with Noir implementations used in validators.
- Client keeps PoW mining + perlin map discovery in TS; Noir validators check consistency with constants.

## 4) Client Crosswalk

| v0.6 client subsystem | Purpose | Aztec client mapping |
| --- | --- | --- |
| `Backend/GameLogic/GameManager` | Orchestrates game state, moves, sync | Keep structure; swap contract adapter to Aztec JS. |
| `Backend/Network/ContractsAPI` | Web3 contract calls | New `AztecContractsAPI` using `@aztec/aztec.js`, PXE, and generated artifacts. |
| `Backend/Miner/*` | PoW mining, perlin, chunk discovery | Keep PoW/mining in client; reuse hashing/perlin from v0.6 or port to TS. |
| `Backend/Storage/*` | Chunk store, local persistence | Keep; adapt to Aztec contract state, note sync. |
| `Backend/Plugins/*` | Plugin runtime | Optional; keep for parity if time allows. |
| `Frontend/*` | UI components | Keep structure; replace network hooks and state adapters. |
| `packages/snarks` | proof helper pipeline | Replace with Noir proof generation via Aztec SDK. |

## 5) Aztec-Specific Architecture Notes

- Every state transition uses **private validate → public apply (only_self)**.
- Noir validators replace all Solidity + Circom verification paths.
- NFT minting: artifacts sent through spacetime rips mint Aztec-native NFTs (native standard or protocol contract).
- Avoid unbounded loops in public functions; use bounded iterations and off-chain indexing.
- Performance target: keep single turn end-to-end < 60 seconds (proof generation, private call, public apply).

## 6) Testing Crosswalk

- Noir unit tests: validators (init/move/reveal/biomebase) with edge cases.
- Contract integration tests: flows (init → reveal → move → capture → artifact → rip/NFT).
- Client e2e smoke: connect to local Aztec, initialize, make move, confirm state in UI.

## 7) Open Questions / Risks

- Which Aztec NFT contract standard to use (or implement minimal NFT in the DF contract)?
- Best approach for large bulk getters (public view vs off-chain indexer).
- PoW/perlin performance in browser + proof generation time budget.
- Whitelist flow: keep zk key proof or admin allowlist?
