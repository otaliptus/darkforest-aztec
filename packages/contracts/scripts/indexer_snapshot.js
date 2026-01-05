import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { createAztecNodeClient, waitForNode } from "@aztec/aztec.js/node";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Fr } from "@aztec/aztec.js/fields";
import { deriveStorageSlotInMap } from "@aztec/stdlib/hash";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTRACTS_DIR = path.resolve(__dirname, "..");

const DEFAULT_ARTIFACT_PATH = path.join(CONTRACTS_DIR, "target", "darkforest_contract-DarkForest.json");
const DEFAULT_NFT_ARTIFACT_PATH = path.join(CONTRACTS_DIR, "darkforest_nft-NFT.json");

const ZERO_ADDRESS = AztecAddress.fromBigInt(0n).toString();

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = {
    nodeUrl: process.env.AZTEC_NODE_URL ?? "http://localhost:8080",
    contractAddress: process.env.DARKFOREST_ADDRESS ?? "",
    nftAddress: process.env.NFT_ADDRESS ?? "",
    outPath: path.resolve(process.cwd(), "snapshot.json"),
    batchSize: 200,
    concurrency: 8,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--rpc") out.nodeUrl = args[++i] ?? out.nodeUrl;
    else if (arg === "--contract") out.contractAddress = args[++i] ?? out.contractAddress;
    else if (arg === "--nft") out.nftAddress = args[++i] ?? out.nftAddress;
    else if (arg === "--out") out.outPath = path.resolve(process.cwd(), args[++i] ?? out.outPath);
    else if (arg === "--batch") out.batchSize = Number(args[++i] ?? out.batchSize);
    else if (arg === "--concurrency") out.concurrency = Number(args[++i] ?? out.concurrency);
  }

  return out;
};

const loadJson = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label} artifact at ${filePath}.`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const parseSlotValue = (value) => {
  if (!value) return undefined;
  return BigInt(`0x${value}`);
};

const getStorageSlots = (artifact, contractName) => {
  const storage = artifact?.outputs?.globals?.storage;
  if (!Array.isArray(storage)) {
    throw new Error("Contract artifact missing storage layout.");
  }

  const entry = storage.find((item) =>
    item.fields?.some((field) => field.name === "contract_name" && field.value?.value === contractName)
  );
  if (!entry) {
    throw new Error(`Storage layout not found for ${contractName}.`);
  }

  const fields = entry.fields?.find((field) => field.name === "fields")?.value?.fields;
  if (!Array.isArray(fields)) {
    throw new Error(`Storage layout missing fields for ${contractName}.`);
  }

  const slots = {};
  for (const field of fields) {
    const slotValue = field.value?.fields?.find((slot) => slot.name === "slot")?.value?.value;
    const parsed = parseSlotValue(slotValue);
    if (parsed !== undefined) {
      slots[field.name] = parsed;
    }
  }

  return slots;
};

const requireSlot = (slots, name) => {
  const slot = slots[name];
  if (slot === undefined) {
    throw new Error(`Missing storage slot for ${name}.`);
  }
  return slot;
};

const readPublicField = async (node, contractAddress, slot) => {
  const value = await node.getPublicStorageAt("latest", contractAddress, new Fr(slot));
  return value.toBigInt();
};

const readPublicFields = async (node, contractAddress, baseSlot, count) => {
  const reads = Array.from({ length: count }, (_, index) =>
    readPublicField(node, contractAddress, baseSlot + BigInt(index))
  );
  return Promise.all(reads);
};

const readPublicMapFields = async (node, contractAddress, mapSlot, key, count) => {
  const slot = await deriveStorageSlotInMap(new Fr(mapSlot), key);
  return readPublicFields(node, contractAddress, slot.toBigInt(), count);
};

const readPublicMapField = async (node, contractAddress, mapSlot, key) => {
  const [value] = await readPublicMapFields(node, contractAddress, mapSlot, key, 1);
  return value;
};

const toBool = (value) => value === 1n;
const toU8 = (value) => Number(value);
const toU32 = (value) => Number(value);

const fieldKey = (value) => new Fr(value);

const decodePlayer = (fields) => ({
  isInitialized: toBool(fields[0] ?? 0n),
  homePlanet: fields[1] ?? 0n,
  lastRevealBlock: toU32(fields[2] ?? 0n),
});

const decodePlanet = (fields) => ({
  isInitialized: toBool(fields[0] ?? 0n),
  owner: AztecAddress.fromBigInt(fields[1] ?? 0n),
  perlin: fields[2] ?? 0n,
  population: fields[3] ?? 0n,
  populationCap: fields[4] ?? 0n,
  populationGrowth: fields[5] ?? 0n,
  silver: fields[6] ?? 0n,
  silverCap: fields[7] ?? 0n,
  silverGrowth: fields[8] ?? 0n,
  range: fields[9] ?? 0n,
  speed: fields[10] ?? 0n,
  defense: fields[11] ?? 0n,
  lastUpdated: toU32(fields[12] ?? 0n),
  planetLevel: toU8(fields[13] ?? 0n),
  planetType: toU8(fields[14] ?? 0n),
  spaceType: toU8(fields[15] ?? 0n),
  isHomePlanet: toBool(fields[16] ?? 0n),
  upgradeState0: toU8(fields[17] ?? 0n),
  upgradeState1: toU8(fields[18] ?? 0n),
  upgradeState2: toU8(fields[19] ?? 0n),
});

const decodePlanetArtifactState = (fields) => ({
  hasTriedFindingArtifact: toBool(fields[0] ?? 0n),
  prospectedBlockNumber: toU32(fields[1] ?? 0n),
});

const decodePlanetArtifacts = (fields) => ({
  ids: fields.slice(0, 5).map((value) => value ?? 0n),
});

const decodeArtifact = (fields) => ({
  isInitialized: toBool(fields[0] ?? 0n),
  id: fields[1] ?? 0n,
  planetDiscoveredOn: fields[2] ?? 0n,
  rarity: toU8(fields[3] ?? 0n),
  planetBiome: toU8(fields[4] ?? 0n),
  discoverer: AztecAddress.fromBigInt(fields[5] ?? 0n),
  artifactType: toU8(fields[6] ?? 0n),
  activations: toU32(fields[7] ?? 0n),
  lastActivated: toU32(fields[8] ?? 0n),
  lastDeactivated: toU32(fields[9] ?? 0n),
  wormholeTo: fields[10] ?? 0n,
  burned: toBool(fields[11] ?? 0n),
});

const decodeRevealed = (fields) => ({
  locationId: fields[0] ?? 0n,
  x: fields[1] ?? 0n,
  y: fields[2] ?? 0n,
  revealer: AztecAddress.fromBigInt(fields[3] ?? 0n),
});

const decodePlanetArrivals = (fields) => {
  const packedIds = fields.slice(0, 6).map((value) => value ?? 0n);
  const mask64 = (1n << 64n) - 1n;
  const ids = [];
  for (const pair of packedIds) {
    ids.push(pair & mask64);
    ids.push((pair >> 64n) & mask64);
  }
  return { packedIds, ids };
};

const decodeArrival = (fields) => {
  const popSilver = fields[3] ?? 0n;
  const meta = fields[4] ?? 0n;
  const mask64 = (1n << 64n) - 1n;
  const mask32 = (1n << 32n) - 1n;
  const popArriving = popSilver >> 64n;
  const silverMoved = popSilver & mask64;
  const departureBlock = Number(meta & mask32);
  const arrivalBlock = Number((meta >> 32n) & mask32);
  const arrivalType = Number((meta >> 64n) & 0xffn);
  const distance = (meta >> 72n) & mask32;
  return {
    player: AztecAddress.fromBigInt(fields[0] ?? 0n),
    fromPlanet: fields[1] ?? 0n,
    toPlanet: fields[2] ?? 0n,
    popSilver,
    meta,
    carriedArtifactId: fields[5] ?? 0n,
    popArriving,
    silverMoved,
    departureBlock,
    arrivalBlock,
    arrivalType,
    distance,
  };
};

const readPlayerState = async (node, contractAddress, storageSlots, player) => {
  const slot = requireSlot(storageSlots, "players");
  const fields = await readPublicMapFields(node, contractAddress, slot, player, 3);
  return decodePlayer(fields);
};

const readPlayerClaimedShips = async (node, contractAddress, storageSlots, player) =>
  readPublicMapField(node, contractAddress, requireSlot(storageSlots, "player_claimed_ships"), player);

const readPlayerSpaceJunk = async (node, contractAddress, storageSlots, player) =>
  readPublicMapField(node, contractAddress, requireSlot(storageSlots, "player_space_junk"), player);

const readPlayerSpaceJunkLimit = async (node, contractAddress, storageSlots, player) =>
  readPublicMapField(node, contractAddress, requireSlot(storageSlots, "player_space_junk_limit"), player);

const readPlanetState = async (node, contractAddress, storageSlots, locationId) => {
  const slot = requireSlot(storageSlots, "planets");
  const fields = await readPublicMapFields(node, contractAddress, slot, fieldKey(locationId), 20);
  return decodePlanet(fields);
};

const readPlanetArtifactState = async (node, contractAddress, storageSlots, locationId) => {
  const slot = requireSlot(storageSlots, "planet_artifact_state");
  const fields = await readPublicMapFields(node, contractAddress, slot, fieldKey(locationId), 2);
  return decodePlanetArtifactState(fields);
};

const readPlanetArtifacts = async (node, contractAddress, storageSlots, locationId) => {
  const slot = requireSlot(storageSlots, "planet_artifacts");
  const fields = await readPublicMapFields(node, contractAddress, slot, fieldKey(locationId), 5);
  return decodePlanetArtifacts(fields);
};

const readPlanetDestroyed = async (node, contractAddress, storageSlots, locationId) => {
  const slot = requireSlot(storageSlots, "planet_destroyed");
  const value = await readPublicMapField(node, contractAddress, slot, fieldKey(locationId));
  return toBool(value);
};

const readPlanetSpaceJunk = async (node, contractAddress, storageSlots, locationId) =>
  readPublicMapField(node, contractAddress, requireSlot(storageSlots, "planet_space_junk"), fieldKey(locationId));

const readPlanetArrivals = async (node, contractAddress, storageSlots, locationId) => {
  const slot = requireSlot(storageSlots, "planet_arrivals");
  const fields = await readPublicMapFields(node, contractAddress, slot, fieldKey(locationId), 6);
  return decodePlanetArrivals(fields);
};

const readArrivalState = async (node, contractAddress, storageSlots, arrivalId) => {
  const slot = requireSlot(storageSlots, "arrivals");
  const fields = await readPublicMapFields(node, contractAddress, slot, fieldKey(arrivalId), 6);
  return decodeArrival(fields);
};

const readRevealedCoords = async (node, contractAddress, storageSlots, locationId) => {
  const slot = requireSlot(storageSlots, "revealed");
  const fields = await readPublicMapFields(node, contractAddress, slot, fieldKey(locationId), 4);
  return decodeRevealed(fields);
};

const readArtifactState = async (node, contractAddress, storageSlots, artifactId) => {
  const slot = requireSlot(storageSlots, "artifacts");
  const fields = await readPublicMapFields(node, contractAddress, slot, fieldKey(artifactId), 12);
  return decodeArtifact(fields);
};

const readArtifactLocation = async (node, contractAddress, storageSlots, artifactId) =>
  readPublicMapField(node, contractAddress, requireSlot(storageSlots, "artifact_locations"), fieldKey(artifactId));

const readNftOwner = async (node, contractAddress, storageSlots, tokenId) =>
  readPublicMapField(node, contractAddress, requireSlot(storageSlots, "public_owners"), fieldKey(tokenId));

const readPlayerBundle = async (node, contractAddress, storageSlots, player) => {
  const [playerState, claimedShips, spaceJunk, spaceJunkLimit] = await Promise.all([
    readPlayerState(node, contractAddress, storageSlots, player),
    readPlayerClaimedShips(node, contractAddress, storageSlots, player),
    readPlayerSpaceJunk(node, contractAddress, storageSlots, player),
    readPlayerSpaceJunkLimit(node, contractAddress, storageSlots, player),
  ]);

  return { player: playerState, claimedShips, spaceJunk, spaceJunkLimit };
};

const readLocationBundle = async (node, contractAddress, storageSlots, locationId) => {
  const [planet, artifacts, artifactState, revealed, destroyed, spaceJunk, arrivals] = await Promise.all([
    readPlanetState(node, contractAddress, storageSlots, locationId),
    readPlanetArtifacts(node, contractAddress, storageSlots, locationId),
    readPlanetArtifactState(node, contractAddress, storageSlots, locationId),
    readRevealedCoords(node, contractAddress, storageSlots, locationId),
    readPlanetDestroyed(node, contractAddress, storageSlots, locationId),
    readPlanetSpaceJunk(node, contractAddress, storageSlots, locationId),
    readPlanetArrivals(node, contractAddress, storageSlots, locationId),
  ]);

  return { planet, artifacts, artifactState, revealed, destroyed, spaceJunk, arrivals };
};

const readArtifactBundle = async (node, contractAddress, storageSlots, artifactId, nftAddress, nftSlots) => {
  const [artifact, locationId] = await Promise.all([
    readArtifactState(node, contractAddress, storageSlots, artifactId),
    readArtifactLocation(node, contractAddress, storageSlots, artifactId),
  ]);

  let owner = undefined;
  if (nftAddress && nftSlots) {
    const ownerValue = await readNftOwner(node, nftAddress, nftSlots, artifactId);
    owner = AztecAddress.fromBigInt(ownerValue ?? 0n);
  }

  return { artifact, locationId, owner };
};

const readTouchedPlanetIdsCount = async (node, contractAddress, storageSlots) => {
  const slot = requireSlot(storageSlots, "touched_planet_ids_count");
  return readPublicField(node, contractAddress, slot);
};

const readTouchedPlanetIdAt = async (node, contractAddress, storageSlots, index) => {
  const slot = requireSlot(storageSlots, "touched_planet_ids");
  return readPublicMapField(node, contractAddress, slot, fieldKey(index));
};

const readRevealedCoordsCount = async (node, contractAddress, storageSlots) => {
  const slot = requireSlot(storageSlots, "revealed_coords_count");
  return readPublicField(node, contractAddress, slot);
};

const readRevealedCoordsAt = async (node, contractAddress, storageSlots, index) => {
  const slot = requireSlot(storageSlots, "revealed_coords");
  const fields = await readPublicMapFields(node, contractAddress, slot, fieldKey(index), 4);
  return decodeRevealed(fields);
};

const readGameConfig = async (node, contractAddress, storageSlots) => {
  const configSlot = requireSlot(storageSlots, "config");
  const [
    planethashKey,
    spacetypeKey,
    biomebaseKey,
    perlinLengthScale,
    perlinMirrorXRaw,
    perlinMirrorYRaw,
    initPerlinMin,
    initPerlinMax,
    worldRadius,
    spawnRimArea,
    locationRevealCooldown,
    planetRarity,
    maxLocationId,
  ] = await readPublicFields(node, contractAddress, configSlot, 13);

  const configHashSpacetype = await readPublicField(
    node,
    contractAddress,
    requireSlot(storageSlots, "config_hash_spacetype")
  );
  const configHashBiome = await readPublicField(
    node,
    contractAddress,
    requireSlot(storageSlots, "config_hash_biome")
  );

  return {
    planethashKey,
    spacetypeKey,
    biomebaseKey,
    perlinLengthScale,
    perlinMirrorX: perlinMirrorXRaw === 1n,
    perlinMirrorY: perlinMirrorYRaw === 1n,
    initPerlinMin,
    initPerlinMax,
    worldRadius,
    spawnRimArea,
    locationRevealCooldown,
    planetRarity,
    maxLocationId,
    configHashSpacetype,
    configHashBiome,
  };
};

const mapWithConcurrency = async (items, limit, worker) => {
  if (items.length === 0) return [];
  const results = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;

  const run = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
      completed += 1;
      if (completed % 100 === 0 || completed === items.length) {
        process.stdout.write(`\rProcessed ${completed}/${items.length}`);
      }
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(workers);
  process.stdout.write("\n");
  return results;
};

const toAddress = (value) => (value ? value.toString() : ZERO_ADDRESS);

const stringifySnapshot = (data) =>
  JSON.stringify(
    data,
    (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      if (value instanceof AztecAddress) return value.toString();
      return value;
    },
    2
  );

const uniqueBigInts = (values) => {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = value.toString();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(value);
    }
  }
  return out;
};

const main = async () => {
  const { nodeUrl, contractAddress, nftAddress, outPath, batchSize, concurrency } = parseArgs();
  if (!contractAddress) {
    throw new Error("Missing --contract or DARKFOREST_ADDRESS.");
  }

  const node = createAztecNodeClient(nodeUrl);
  await waitForNode(nodeUrl);

  const contractAddr = AztecAddress.fromString(contractAddress);

  const artifactJson = loadJson(DEFAULT_ARTIFACT_PATH, "DarkForest");
  const storageSlots = getStorageSlots(artifactJson, "DarkForest");

  let nftAddr;
  let nftSlots;
  if (nftAddress) {
    nftAddr = AztecAddress.fromString(nftAddress);
    const nftJson = loadJson(DEFAULT_NFT_ARTIFACT_PATH, "NFT");
    nftSlots = getStorageSlots(nftJson, "NFT");
  }

  const gameConfig = await readGameConfig(node, contractAddr, storageSlots);
  const blockNumber = Number(await node.getBlockNumber());

  const blockTimestampCache = new Map();
  const getBlockTimestamp = async (blockNum) => {
    if (!blockNum) return 0;
    if (blockTimestampCache.has(blockNum)) return blockTimestampCache.get(blockNum);
    const block = await node.getBlock(blockNum);
    const ts = block ? Number(block.timestamp) : 0;
    blockTimestampCache.set(blockNum, ts);
    return ts;
  };

  const touchedCount = Number(await readTouchedPlanetIdsCount(node, contractAddr, storageSlots));
  const touchedIndices = Array.from({ length: touchedCount }, (_, i) => BigInt(i));
  const touchedPlanetIds = [];
  for (let i = 0; i < touchedIndices.length; i += batchSize) {
    const batch = touchedIndices.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((index) => readTouchedPlanetIdAt(node, contractAddr, storageSlots, index))
    );
    touchedPlanetIds.push(...results);
    process.stdout.write(`\rTouched planet ids ${Math.min(i + batchSize, touchedCount)}/${touchedCount}`);
  }
  process.stdout.write("\n");

  const revealedCount = Number(await readRevealedCoordsCount(node, contractAddr, storageSlots));
  const revealedIndices = Array.from({ length: revealedCount }, (_, i) => BigInt(i));
  const revealedCoords = [];
  for (let i = 0; i < revealedIndices.length; i += batchSize) {
    const batch = revealedIndices.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((index) => readRevealedCoordsAt(node, contractAddr, storageSlots, index))
    );
    revealedCoords.push(...results);
    process.stdout.write(`\rRevealed coords ${Math.min(i + batchSize, revealedCount)}/${revealedCount}`);
  }
  process.stdout.write("\n");

  const revealedIds = revealedCoords.map((coord) => coord.locationId);
  const planetIds = uniqueBigInts(touchedPlanetIds.concat(revealedIds).filter((id) => id !== 0n));
  const planetIdSet = new Set(planetIds.map((id) => id.toString()));

  const planetBundles = await mapWithConcurrency(
    planetIds,
    concurrency,
    async (locationId) => {
      const bundle = await readLocationBundle(node, contractAddr, storageSlots, locationId);
      const lastUpdatedTimestamp = await getBlockTimestamp(bundle.planet.lastUpdated);
      return { locationId, ...bundle, lastUpdatedTimestamp };
    }
  );

  const arrivalIdSet = new Set();
  const artifactIdSet = new Set();
  const playerAddressSet = new Set();

  for (const bundle of planetBundles) {
    const owner = toAddress(bundle.planet.owner);
    if (owner !== ZERO_ADDRESS) playerAddressSet.add(owner);
    const revealer = toAddress(bundle.revealed?.revealer);
    if (revealer && revealer !== ZERO_ADDRESS) playerAddressSet.add(revealer);

    for (const id of bundle.artifacts.ids) {
      if (id !== 0n) artifactIdSet.add(id.toString());
    }

    for (const id of bundle.arrivals.ids) {
      if (id !== 0n) arrivalIdSet.add(id.toString());
    }
  }

  const arrivalIds = Array.from(arrivalIdSet, (value) => BigInt(value));
  const arrivals = await mapWithConcurrency(arrivalIds, concurrency, async (arrivalId) => {
    const arrivalState = await readArrivalState(node, contractAddr, storageSlots, arrivalId);
    const departureTimestamp = await getBlockTimestamp(arrivalState.departureBlock);
    const arrivalTimestamp = await getBlockTimestamp(arrivalState.arrivalBlock);
    const player = toAddress(arrivalState.player);
    if (player !== ZERO_ADDRESS) playerAddressSet.add(player);
    if (arrivalState.carriedArtifactId !== 0n) {
      artifactIdSet.add(arrivalState.carriedArtifactId.toString());
    }
    return { arrivalId, arrivalState, departureTimestamp, arrivalTimestamp };
  });

  const extraPlanetIds = uniqueBigInts(
    arrivals
      .map((entry) => entry.arrivalState.fromPlanet)
      .filter((id) => id !== 0n && !planetIdSet.has(id.toString()))
  );
  if (extraPlanetIds.length > 0) {
    const extraBundles = await mapWithConcurrency(
      extraPlanetIds,
      concurrency,
      async (locationId) => {
        const bundle = await readLocationBundle(node, contractAddr, storageSlots, locationId);
        const lastUpdatedTimestamp = await getBlockTimestamp(bundle.planet.lastUpdated);
        return { locationId, ...bundle, lastUpdatedTimestamp };
      }
    );
    for (const bundle of extraBundles) {
      planetBundles.push(bundle);
      planetIdSet.add(bundle.locationId.toString());

      const owner = toAddress(bundle.planet.owner);
      if (owner !== ZERO_ADDRESS) playerAddressSet.add(owner);
      const revealer = toAddress(bundle.revealed?.revealer);
      if (revealer && revealer !== ZERO_ADDRESS) playerAddressSet.add(revealer);

      for (const id of bundle.artifacts.ids) {
        if (id !== 0n) artifactIdSet.add(id.toString());
      }
    }
  }

  const artifactIds = Array.from(artifactIdSet, (value) => BigInt(value));
  const artifacts = await mapWithConcurrency(artifactIds, concurrency, async (artifactId) => {
    const bundle = await readArtifactBundle(node, contractAddr, storageSlots, artifactId, nftAddr, nftSlots);
    const lastActivatedTimestamp = await getBlockTimestamp(bundle.artifact.lastActivated);
    const lastDeactivatedTimestamp = await getBlockTimestamp(bundle.artifact.lastDeactivated);
    return { artifactId, ...bundle, lastActivatedTimestamp, lastDeactivatedTimestamp };
  });

  const playerAddresses = Array.from(playerAddressSet)
    .map((value) => AztecAddress.fromString(value))
    .filter((addr) => addr.toString() !== ZERO_ADDRESS);

  const players = await mapWithConcurrency(playerAddresses, concurrency, async (address) => {
    const bundle = await readPlayerBundle(node, contractAddr, storageSlots, address);
    if (!bundle.player.isInitialized) return undefined;
    const lastRevealTimestamp = await getBlockTimestamp(bundle.player.lastRevealBlock);
    return { address, ...bundle, lastRevealTimestamp };
  });

  const snapshot = {
    meta: {
      format: "df-aztec-snapshot",
      snapshotVersion: 1,
      contractAddress: contractAddr.toString(),
      blockNumber,
      createdAt: new Date().toISOString(),
      worldRadius: gameConfig.worldRadius,
      configHashSpacetype: gameConfig.configHashSpacetype,
      configHashBiome: gameConfig.configHashBiome,
    },
    players: players.filter(Boolean),
    touchedPlanetIds,
    revealedCoords,
    planets: planetBundles,
    arrivals,
    artifacts,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, stringifySnapshot(snapshot));
  console.log(`Snapshot written to ${outPath}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
