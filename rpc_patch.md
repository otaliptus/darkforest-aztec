--- a/packages/contracts/src/main.nr
+++ b/packages/contracts/src/main.nr
@@ -2650,4 +2650,136 @@
         self.storage.planet_arrivals.at(arrival.to_planet).write(arrival_list);
         self.storage.arrivals.at(arrival_key).write(Arrival::empty());
     }
+    // ------------------------------------------------------------------------
+    // Utility (offchain) getters to reduce RPC read amplification.
+    //
+    // These replace client-side per-slot getPublicStorageAt fanout (e.g. 39 calls
+    // for a location bundle) with a single simulate() call.
+    // ------------------------------------------------------------------------
+
+    unconstrained fn build_location_bundle_fields(location_id: Field) -> [Field; 39] {
+        let planet = self.storage.planets.at(location_id).read();
+        let planet_artifacts = self.storage.planet_artifacts.at(location_id).read();
+        let planet_artifact_state = self.storage.planet_artifact_state.at(location_id).read();
+        let revealed_coords = self.storage.revealed_coords.at(location_id).read();
+        let planet_destroyed = self.storage.planet_destroyed.at(location_id).read();
+        let planet_space_junk = self.storage.planet_space_junk.at(location_id).read();
+        let planet_arrivals = self.storage.planet_arrivals.at(location_id).read();
+
+        let mut out: [Field; 39] = [0; 39];
+
+        // Planet (20 fields)
+        out[0] = if planet.is_initialized { 1 } else { 0 };
+        out[1] = planet.owner.to_field();
+        out[2] = planet.perlin as Field;
+        out[3] = planet.population as Field;
+        out[4] = planet.population_cap as Field;
+        out[5] = planet.population_growth as Field;
+        out[6] = planet.silver as Field;
+        out[7] = planet.silver_cap as Field;
+        out[8] = planet.silver_growth as Field;
+        out[9] = planet.range as Field;
+        out[10] = planet.speed as Field;
+        out[11] = planet.defense as Field;
+        out[12] = planet.last_updated as Field;
+        out[13] = planet.planet_level as Field;
+        out[14] = planet.planet_type as Field;
+        out[15] = planet.space_type as Field;
+        out[16] = if planet.is_home_planet { 1 } else { 0 };
+        out[17] = planet.upgrade_state0 as Field;
+        out[18] = planet.upgrade_state1 as Field;
+        out[19] = planet.upgrade_state2 as Field;
+
+        // PlanetArtifacts (5 fields)
+        out[20] = planet_artifacts.ids[0];
+        out[21] = planet_artifacts.ids[1];
+        out[22] = planet_artifacts.ids[2];
+        out[23] = planet_artifacts.ids[3];
+        out[24] = planet_artifacts.ids[4];
+
+        // PlanetArtifactState (2 fields)
+        out[25] = if planet_artifact_state.has_tried_finding_artifact { 1 } else { 0 };
+        out[26] = planet_artifact_state.prospected_block_number as Field;
+
+        // RevealedCoords (4 fields)
+        out[27] = revealed_coords.location_id;
+        out[28] = revealed_coords.x;
+        out[29] = revealed_coords.y;
+        out[30] = revealed_coords.revealer.to_field();
+
+        // PlanetDestroyed (u8 stored as 0/1)
+        out[31] = planet_destroyed as Field;
+
+        // PlanetSpaceJunk (1 field)
+        out[32] = planet_space_junk as Field;
+
+        // PlanetArrivals (6 fields, packed u128)
+        out[33] = planet_arrivals.ids[0] as Field;
+        out[34] = planet_arrivals.ids[1] as Field;
+        out[35] = planet_arrivals.ids[2] as Field;
+        out[36] = planet_arrivals.ids[3] as Field;
+        out[37] = planet_arrivals.ids[4] as Field;
+        out[38] = planet_arrivals.ids[5] as Field;
+
+        out
+    }
+
+    #[external("utility")]
+    unconstrained fn get_location_bundle_fields(location_id: Field) -> [Field; 39] {
+        self.build_location_bundle_fields(location_id)
+    }
+
+    // Fixed-size batch helper for startup / bulk sync paths.
+    // `num_ids` lets callers pad the array without losing a potential "0" id.
+    #[external("utility")]
+    unconstrained fn get_location_bundle_fields_batch(location_ids: [Field; 8], num_ids: u8) -> [[Field; 39]; 8] {
+        let mut out: [[Field; 39]; 8] = [[0; 39]; 8];
+        for i in 0..8 {
+            if (i as u8) < num_ids {
+                out[i] = self.build_location_bundle_fields(location_ids[i]);
+            }
+        }
+        out
+    }
+
+    unconstrained fn build_player_bundle_fields(player: AztecAddress) -> [Field; 6] {
+        let player_state = self.storage.players.at(player).read();
+        let claimed_ships = self.storage.claimed_ships.at(player).read();
+        let space_junk = self.storage.player_space_junk.at(player).read();
+        let space_junk_limit = self.storage.player_space_junk_limit.at(player).read();
+
+        let mut out: [Field; 6] = [0; 6];
+
+        // Player (3 fields)
+        out[0] = if player_state.is_initialized { 1 } else { 0 };
+        out[1] = player_state.init_timestamp as Field;
+        out[2] = player_state.home_planet;
+
+        // claimed_ships (u8)
+        out[3] = claimed_ships as Field;
+
+        // player_space_junk (u64)
+        out[4] = space_junk as Field;
+
+        // player_space_junk_limit (u64)
+        out[5] = space_junk_limit as Field;
+
+        out
+    }
+
+    #[external("utility")]
+    unconstrained fn get_player_bundle_fields(player: AztecAddress) -> [Field; 6] {
+        self.build_player_bundle_fields(player)
+    }
+
+    #[external("utility")]
+    unconstrained fn get_revealed_coords_fields(location_id: Field) -> [Field; 4] {
+        let revealed_coords = self.storage.revealed_coords.at(location_id).read();
+        [
+            revealed_coords.location_id,
+            revealed_coords.x,
+            revealed_coords.y,
+            revealed_coords.revealer.to_field(),
+        ]
+    }
 }

--- a/apps/client/src/Backend/Aztec/scripts/chain.ts
+++ b/apps/client/src/Backend/Aztec/scripts/chain.ts
@@ -1,6 +1,7 @@
 import { AztecAddress } from "@aztec/aztec.js/addresses";
 import { Fr } from "@aztec/aztec.js/fields";
 import type { AztecNode } from "@aztec/stdlib/interfaces/aztec-node";
+import type { Contract } from "@aztec/aztec.js";
 import {
     readPublicMapField,
     readPublicMapFields,
@@ -456,6 +457,116 @@
     };
 };
 
+const coerceToBigInt = (v: any): bigint => {
+  if (typeof v === "bigint") return v;
+  if (typeof v === "number") return BigInt(v);
+  if (v && typeof v.toBigInt === "function") return v.toBigInt();
+  // As a last resort (e.g. BN.js-like), try string -> bigint.
+  if (v && typeof v.toString === "function") return BigInt(v.toString());
+  throw new Error(`Unsupported value type for bigint coercion: ${typeof v}`);
+};
+
+const coerceFieldArrayToBigInts = (raw: any, expectedLen?: number): bigint[] => {
+  if (!Array.isArray(raw)) {
+    throw new Error(`Expected array return value, got: ${typeof raw}`);
+  }
+  const out = raw.map(coerceToBigInt);
+  if (expectedLen !== undefined && out.length !== expectedLen) {
+    throw new Error(`Expected ${expectedLen} fields, got ${out.length}`);
+  }
+  return out;
+};
+
+const decodeLocationBundleFromFields = (fields: bigint[]) => {
+  if (fields.length !== 39) throw new Error(`Expected 39 fields, got ${fields.length}`);
+  const planet = decodePlanet(fields.slice(0, 20));
+  const planetArtifacts = decodePlanetArtifacts(fields.slice(20, 25));
+  const planetArtifactState = decodePlanetArtifactState(fields.slice(25, 27));
+  const revealedCoords = decodeRevealedCoords(fields.slice(27, 31));
+  const planetDestroyed = fields[31] === 1n;
+  const planetSpaceJunk = fields[32];
+  const planetArrivals = decodePlanetArrivals(fields.slice(33, 39));
+
+  return {
+    planet,
+    artifacts: planetArtifacts,
+    artifactState: planetArtifactState,
+    revealed: revealedCoords,
+    destroyed: planetDestroyed,
+    spaceJunk: planetSpaceJunk,
+    arrivals: planetArrivals,
+  };
+};
+
+// -------------------------------------------------------------
+// View-bundle (utility simulate) reads
+// -------------------------------------------------------------
+
+export const readLocationBundleViaView = async (
+  contract: Contract,
+  from: AztecAddress,
+  locationId: bigint
+) => {
+  // Utility function implemented in the Noir contract (one RPC).
+  const raw = await (contract.methods as any).get_location_bundle_fields(locationId).simulate({ from });
+  const fields = coerceFieldArrayToBigInts(raw, 39);
+  return decodeLocationBundleFromFields(fields);
+};
+
+export const readLocationBundlesViaViewBatch = async (
+  contract: Contract,
+  from: AztecAddress,
+  locationIds: bigint[]
+) => {
+  const BATCH = 8;
+  const padded: bigint[] = locationIds.slice(0, BATCH);
+  const num = padded.length;
+
+  // Pad to fixed length required by Noir.
+  while (padded.length < BATCH) padded.push(0n);
+
+  const raw = await (contract.methods as any)
+    .get_location_bundle_fields_batch(padded, num)
+    .simulate({ from });
+
+  if (!Array.isArray(raw) || raw.length !== BATCH) {
+    throw new Error(`Expected batch return of length ${BATCH}, got ${Array.isArray(raw) ? raw.length : typeof raw}`);
+  }
+
+  const bundles = [];
+  for (let i = 0; i < num; i++) {
+    const fields = coerceFieldArrayToBigInts(raw[i], 39);
+    bundles.push(decodeLocationBundleFromFields(fields));
+  }
+  return bundles;
+};
+
+export const readPlayerBundleViaView = async (
+  contract: Contract,
+  from: AztecAddress,
+  playerAddress: AztecAddress
+) => {
+  const raw = await (contract.methods as any).get_player_bundle_fields(playerAddress).simulate({ from });
+  const fields = coerceFieldArrayToBigInts(raw, 6);
+
+  const player = decodePlayer(fields.slice(0, 3));
+  const claimedShips = fields[3] === 1n;
+  const spaceJunk = fields[4];
+  const spaceJunkLimit = fields[5];
+
+  return { player, claimedShips, spaceJunk, spaceJunkLimit };
+};
+
+export const readRevealedCoordsViaView = async (
+  contract: Contract,
+  from: AztecAddress,
+  locationId: bigint
+) => {
+  const raw = await (contract.methods as any).get_revealed_coords_fields(locationId).simulate({ from });
+  const fields = coerceFieldArrayToBigInts(raw, 4);
+  return decodeRevealedCoords(fields);
+};
+
 export const readTouchedPlanetIdsCount = async (
     node: AztecNode,
     contractAddress: AztecAddress,

--- a/apps/client/src/Backend/GameLogic/ContractsAPI.ts
+++ b/apps/client/src/Backend/GameLogic/ContractsAPI.ts
@@ -22,7 +22,10 @@
 import {
   readArtifactBundle,
   readLocationBundle,
+  readLocationBundleViaView,
   readPlayerBundle,
+  readPlayerBundleViaView,
+  readRevealedCoordsViaView,
   readPlanetArrivals,
   readArrivalState,
   readPlanetArtifactState,
@@ -344,12 +347,20 @@
         address === this.getAddress()
           ? this.aztecConnection.getClient().account.address
           : AztecAddress.fromString(address);
-      const bundle = await readPlayerBundle(
-        this.aztecConnection.getNode(),
-        this.aztecConnection.getClient().darkforestAddress,
-        this.storageSlots,
-        target
-      );
+      const from = this.aztecConnection.getClient().account.address;
+
+      let bundle;
+      try {
+        bundle = await readPlayerBundleViaView(this.contract, from, target);
+      } catch {
+        // Fallback for older deployments without the utility getter.
+        bundle = await readPlayerBundle(
+          this.aztecConnection.getNode(),
+          this.aztecConnection.getClient().darkforestAddress,
+          this.storageSlots,
+          target
+        );
+      }
       if (!bundle.player.isInitialized) return undefined;
       const lastRevealTimestamp = bundle.player.lastRevealBlock;
       return mapPlayer(
@@ -367,12 +378,20 @@
 
   public async getPlanetById(planetId: LocationId): Promise<Planet | undefined> {
     const id = toBigInt(planetId);
-    const bundle = await readLocationBundle(
-      this.aztecConnection.getNode(),
-      this.aztecConnection.getClient().darkforestAddress,
-      this.storageSlots,
-      id
-    );
+    const from = this.aztecConnection.getClient().account.address;
+
+    let bundle;
+    try {
+      bundle = await readLocationBundleViaView(this.contract, from, id);
+    } catch {
+      // Fallback for older deployments without the utility getter.
+      bundle = await readLocationBundle(
+        this.aztecConnection.getNode(),
+        this.aztecConnection.getClient().darkforestAddress,
+        this.storageSlots,
+        id
+      );
+    }
     if (!bundle.planet.isInitialized && bundle.revealed.locationId === 0n) {
       return undefined;
     }
@@ -591,15 +610,26 @@
     return artifacts;
   }
 
-  public async getRevealedCoordsByIdIfExists(planetId: LocationId): Promise<RevealedCoords | undefined> {
+    public async getRevealedCoordsByIdIfExists(
+    planetId: LocationId
+  ): Promise<RevealedCoords | undefined> {
     const id = toBigInt(planetId);
-    const bundle = await readLocationBundle(
-      this.aztecConnection.getNode(),
-      this.aztecConnection.getClient().darkforestAddress,
-      this.storageSlots,
-      id
-    );
-    return mapRevealedCoords(bundle.revealed);
+
+    const from = this.aztecConnection.getClient().account.address;
+
+    try {
+      const revealed = await readRevealedCoordsViaView(this.contract, from, id);
+      return mapRevealedCoords(revealed);
+    } catch {
+      // Fallback for older deployments without the utility getter.
+      const bundle = await readLocationBundle(
+        this.aztecConnection.getNode(),
+        this.aztecConnection.getClient().darkforestAddress,
+        this.storageSlots,
+        id
+      );
+      return mapRevealedCoords(bundle.revealed);
+    }
   }
 
   public async getRevealedPlanetsCoords(

