import assert from "assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { createAztecNodeClient, waitForNode } from "@aztec/aztec.js/node";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Contract, getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts";
import { loadContractArtifact } from "@aztec/aztec.js/abi";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { TestWallet } from "@aztec/test-wallet/server";
import { getInitialTestAccountsData } from "@aztec/accounts/testing";
import { Fr } from "@aztec/aztec.js/fields";
import { deriveStorageSlotInMap } from "@aztec/stdlib/hash";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";

import {
    FIELD_MODULUS,
    configHash,
    locationIdFromCoords,
    mimcSponge2_220,
    multiScalePerlin,
} from "./hashing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTRACTS_DIR = path.resolve(__dirname, "..");

const deriveMaxLocationId = (planetRarity) => {
    const rarity = BigInt(planetRarity);
    if (rarity <= 0n) {
        throw new Error("planet_rarity must be greater than zero.");
    }
    const maxLocationId = FIELD_MODULUS / rarity;
    return maxLocationId === FIELD_MODULUS ? FIELD_MODULUS - 1n : maxLocationId;
};

const DEFAULT_CONFIG = {
    planethash_key: 42n,
    spacetype_key: 43n,
    biomebase_key: 6271n,
    perlin_length_scale: 1024n,
    perlin_mirror_x: false,
    perlin_mirror_y: false,
    init_perlin_min: 0n,
    init_perlin_max: 33n,
    world_radius: 10000n,
    spawn_rim_area: 0n,
    location_reveal_cooldown: 0n,
    time_factor_hundredths: 100n,
    planet_rarity: 1n,
    max_location_id: deriveMaxLocationId(1n),
};

const DEFAULT_INIT = { x: 990n, y: 0n, radius: 1000n };
const DEFAULT_INIT_2 = { x: 0n, y: 990n, radius: 1000n };


const PLANET_TYPE_PLANET = 0;
const PLANET_TYPE_SILVER_MINE = 1;
const PLANET_TYPE_RUINS = 2;
const PLANET_TYPE_TRADING_POST = 3;
const PLANET_TYPE_SILVER_BANK = 4;

const ARTIFACT_TYPE_MONOLITH = 1;
const ARTIFACT_TYPE_WORMHOLE = 5;
const ARTIFACT_TYPE_PLANETARY_SHIELD = 6;
const ARTIFACT_TYPE_PHOTOID_CANNON = 7;
const ARTIFACT_TYPE_BLOOM_FILTER = 8;
const ARTIFACT_TYPE_BLACK_DOMAIN = 9;
const ARTIFACT_TYPE_SHIP_MOTHERSHIP = 10;
const ARTIFACT_TYPE_SHIP_CRESCENT = 11;

const ARTIFACT_RARITY_COMMON = 1;
const ARTIFACT_RARITY_RARE = 2;

const ARRIVAL_TYPE_NORMAL = 1;
const ARRIVAL_TYPE_PHOTOID = 2;
const ARRIVAL_TYPE_WORMHOLE = 3;

const SPACE_TYPE_NEBULA = 0;
const SPACE_TYPE_SPACE = 1;
const SPACE_TYPE_DEEP_SPACE = 2;
const SPACE_TYPE_DEAD_SPACE = 3;

const ZERO_ADDRESS = AztecAddress.fromBigInt(0n);

const PERLIN_THRESHOLD_1 = 14n;
const PERLIN_THRESHOLD_2 = 15n;
const PERLIN_THRESHOLD_3 = 19n;
const BIOME_THRESHOLD_1 = 15n;
const BIOME_THRESHOLD_2 = 17n;
const MAX_NATURAL_PLANET_LEVEL = 9;
const MAX_COORD_ABS = 2147483648n;
const SHIP_ID_SALT = 1000n;
const PHOTOID_ACTIVATION_DELAY_BLOCKS = 4;

const PLANET_LEVEL_THRESHOLDS = [
    16777216n,
    4194292n,
    1048561n,
    262128n,
    65520n,
    16368n,
    4080n,
    1008n,
    240n,
    48n,
];

const PLANET_TYPE_WEIGHTS = [
    [
        [1n, 0n, 0n, 0n, 0n],
        [13n, 2n, 0n, 1n, 0n],
        [13n, 2n, 0n, 1n, 0n],
        [13n, 2n, 0n, 0n, 1n],
        [13n, 2n, 0n, 0n, 1n],
        [13n, 2n, 0n, 0n, 1n],
        [13n, 2n, 0n, 0n, 1n],
        [13n, 2n, 0n, 0n, 1n],
        [13n, 2n, 0n, 0n, 1n],
        [13n, 2n, 0n, 0n, 1n],
    ],
    [
        [1n, 0n, 0n, 0n, 0n],
        [13n, 2n, 1n, 0n, 0n],
        [12n, 2n, 1n, 1n, 0n],
        [11n, 2n, 1n, 1n, 1n],
        [12n, 2n, 1n, 0n, 1n],
        [12n, 2n, 1n, 0n, 1n],
        [12n, 2n, 1n, 0n, 1n],
        [12n, 2n, 1n, 0n, 1n],
        [12n, 2n, 1n, 0n, 1n],
        [12n, 2n, 1n, 0n, 1n],
    ],
    [
        [1n, 0n, 0n, 0n, 0n],
        [10n, 4n, 2n, 0n, 0n],
        [10n, 4n, 1n, 1n, 0n],
        [8n, 4n, 1n, 2n, 1n],
        [8n, 4n, 1n, 2n, 1n],
        [8n, 4n, 1n, 2n, 1n],
        [8n, 4n, 1n, 2n, 1n],
        [8n, 4n, 1n, 2n, 1n],
        [8n, 4n, 1n, 2n, 1n],
        [8n, 4n, 1n, 2n, 1n],
    ],
    [
        [1n, 0n, 0n, 0n, 0n],
        [11n, 4n, 1n, 0n, 0n],
        [11n, 4n, 1n, 0n, 0n],
        [7n, 4n, 2n, 2n, 1n],
        [7n, 4n, 2n, 2n, 1n],
        [7n, 4n, 2n, 2n, 1n],
        [7n, 4n, 2n, 2n, 1n],
        [7n, 4n, 2n, 2n, 1n],
        [7n, 4n, 2n, 2n, 1n],
        [7n, 4n, 2n, 2n, 1n],
    ],
];

const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const normalizeLogLevel = (value) => {
    const normalized = String(value ?? "").toLowerCase();
    if (normalized in LOG_LEVELS) return normalized;
    return "info";
};
const SCRIPT_LOG_LEVEL = normalizeLogLevel(
    process.env.DF_SCRIPT_LOG_LEVEL ??
        process.env.DF_LOG_LEVEL ??
        (process.env.DF_VERBOSE_LOGS === "true" ? "debug" : "info")
);
const shouldLog = (level) => LOG_LEVELS[level] >= LOG_LEVELS[SCRIPT_LOG_LEVEL];
const log = (level, message, data) => {
    if (!shouldLog(level)) return;
    const ts = new Date().toISOString();
    if (data && Object.keys(data).length > 0) {
        console.log(`[${ts}] ${level.toUpperCase()} ${message}`, data);
    } else {
        console.log(`[${ts}] ${level.toUpperCase()} ${message}`);
    }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toBool = (value) => value === 1n;
const toU8 = (value) => Number(value);
const toU32 = (value) => Number(value);

const fieldKey = (value) => new Fr(value);

const jsonRpcCall = async (url, method, params = []) => {
    if (!globalThis.fetch) {
        throw new Error("fetch is not available in this runtime.");
    }
    const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method,
            params,
        }),
    });
    if (!res.ok) {
        throw new Error(`RPC ${method} failed with status ${res.status}`);
    }
    const payload = await res.json();
    if (payload.error) {
        throw new Error(payload.error.message || `RPC ${method} failed`);
    }
    return payload.result;
};

const formatTxHash = (hash) => {
    if (hash === undefined || hash === null) return undefined;
    if (typeof hash === "string") return hash;
    if (typeof hash === "bigint") return `0x${hash.toString(16)}`;
    const toString = hash?.toString;
    if (typeof toString === "function") {
        const value = toString.call(hash);
        if (value && value !== "[object Object]") return value;
    }
    return String(hash);
};

const isExistingNullifierError = (err) => {
    const message = err?.cause?.message ?? err?.message ?? "";
    return message.includes("Existing nullifier");
};

const trySetSequencerConfig = async (nodeUrl, config) => {
    try {
        await jsonRpcCall(nodeUrl, "nodeAdmin_setConfig", [config]);
        return true;
    } catch (err) {
        console.warn("Failed to adjust sequencer config for empty blocks.");
        return false;
    }
};

const createEmptyBlockMiner = (l1RpcUrl) => {
    let disabled = false;
    return async () => {
        if (disabled || !l1RpcUrl) return false;
        const methods = [
            { method: "anvil_mine", params: [1] },
            { method: "hardhat_mine", params: ["0x1"] },
            { method: "evm_mine", params: [] },
        ];
        for (const { method, params } of methods) {
            try {
                await jsonRpcCall(l1RpcUrl, method, params);
                return true;
            } catch (err) {
                // Try next method.
            }
        }
        disabled = true;
        console.warn("Empty block mining unavailable; falling back to tx-based ticking.");
        return false;
    };
};

const parseArgs = () => {
    const args = new Set(process.argv.slice(2));
    const forceDeploy = args.has("--deploy");
    const forceNoDeploy = args.has("--no-deploy");
    const hasAddresses = Boolean(process.env.DARKFOREST_ADDRESS && process.env.NFT_ADDRESS);
    const deploy = forceDeploy || (!forceNoDeploy && !hasAddresses);
    const mineEmptyBlocks =
        !args.has("--no-empty-blocks") && process.env.MINE_EMPTY_BLOCKS !== "false";
    return {
        nodeUrl: process.env.AZTEC_NODE_URL ?? "http://localhost:8080",
        adminUrl: process.env.AZTEC_NODE_ADMIN_URL ?? "http://localhost:8880",
        l1RpcUrl: process.env.L1_RPC_URL ?? "http://localhost:8545",
        darkforestAddress: process.env.DARKFOREST_ADDRESS ?? "",
        nftAddress: process.env.NFT_ADDRESS ?? "",
        sponsoredFpcAddress: process.env.SPONSORED_FPC_ADDRESS ?? "",
        deploy,
        mineEmptyBlocks,
        proverEnabled: process.env.PROVER_ENABLED === "true" || args.has("--prover"),
        txTimeoutMs: Number(process.env.TX_TIMEOUT_MS ?? "180000"),
        blockTimeoutMs: Number(process.env.BLOCK_TIMEOUT_MS ?? "180000"),
        searchMaxDist: Number(process.env.SEARCH_MAX_DIST ?? "200"),
    };
};

const loadArtifact = (relativePaths) => {
    for (const relativePath of relativePaths) {
        const artifactPath = path.join(CONTRACTS_DIR, relativePath);
        if (fs.existsSync(artifactPath)) {
            const json = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
            return loadContractArtifact(json);
        }
    }
    throw new Error(`Missing artifact. Tried: ${relativePaths.join(", ")}`);
};

const resolveSponsoredFpc = async (wallet, node, override) => {
    if (override) {
        const address = AztecAddress.fromString(override);
        const instance = await node.getContract(address);
        if (!instance) {
            console.warn("SponsoredFPC override not found on-chain. Proceeding without sponsored fees.");
            return undefined;
        }
        await wallet.registerContract(instance, SponsoredFPCContract.artifact);
        return address;
    }

    const instance = await getContractInstanceFromInstantiationParams(
        SponsoredFPCContract.artifact,
        { salt: new Fr(0) }
    );
    const onChain = await node.getContract(instance.address);
    if (!onChain) {
        return undefined;
    }
    await wallet.registerContract(onChain, SponsoredFPCContract.artifact);
    return onChain.address;
};

const ensureAccounts = async (wallet, node, txTimeoutMs, fee) => {
    const deployAccounts = async (account0, account1) => {
        if (!account0 || !account1) {
            throw new Error("Need at least two test accounts.");
        }
        const player1 = await wallet.createSchnorrAccount(
            account0.secret,
            account0.salt,
            account0.signingKey
        );
        const player2 = await wallet.createSchnorrAccount(
            account1.secret,
            account1.salt,
            account1.signingKey
        );
        const deployIfMissing = async (label, manager, skipClassPublication) => {
            const onChain = await node.getContract(manager.address);
            if (onChain) return;
            console.log(`Deploying ${label} account...`);
            try {
                const deployMethod = await manager.getDeployMethod();
                const options = fee
                    ? { from: ZERO_ADDRESS, skipClassPublication, fee }
                    : { from: ZERO_ADDRESS, skipClassPublication };
                const sent = await deployMethod.send(options);
                await sent.wait({ timeout: txTimeoutMs });
                console.log(`✓ Deployed ${label} account`);
            } catch (err) {
                if (isExistingNullifierError(err)) {
                    console.warn(`${label} account already deployed; continuing.`);
                    return;
                }
                throw err;
            }
        };
        await deployIfMissing("player1", player1, false);
        await deployIfMissing("player2", player2, true);
        return { player1, player2 };
    };
    const accounts = await getInitialTestAccountsData();
    return deployAccounts(accounts[0], accounts[1]);
};

const getStorageSlots = (artifact, contractName) => {
    const storage = artifact?.outputs?.globals?.storage;
    if (!Array.isArray(storage)) {
        throw new Error("Contract artifact missing storage layout.");
    }

    const entry = storage.find((item) =>
        item.fields?.some(
            (field) => field.name === "contract_name" && field.value?.value === contractName
        )
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
        if (slotValue) {
            slots[field.name] = BigInt(`0x${slotValue}`);
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

const readPlayerState = async (node, contractAddress, slots, player) => {
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        requireSlot(slots, "players"),
        player,
        3
    );
    return decodePlayer(fields);
};

const readPlanetState = async (node, contractAddress, slots, locationId) => {
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        requireSlot(slots, "planets"),
        fieldKey(locationId),
        20
    );
    return decodePlanet(fields);
};

const readPlanetArtifactState = async (node, contractAddress, slots, locationId) => {
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        requireSlot(slots, "planet_artifact_state"),
        fieldKey(locationId),
        2
    );
    return decodePlanetArtifactState(fields);
};

const readPlanetArtifacts = async (node, contractAddress, slots, locationId) => {
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        requireSlot(slots, "planet_artifacts"),
        fieldKey(locationId),
        5
    );
    return decodePlanetArtifacts(fields);
};

const readArtifactState = async (node, contractAddress, slots, artifactId) => {
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        requireSlot(slots, "artifacts"),
        fieldKey(artifactId),
        12
    );
    return decodeArtifact(fields);
};

const readArrivalState = async (node, contractAddress, slots, arrivalId) => {
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        requireSlot(slots, "arrivals"),
        fieldKey(arrivalId),
        6
    );
    return decodeArrival(fields);
};

const readPlanetArrivals = async (node, contractAddress, slots, locationId) => {
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        requireSlot(slots, "planet_arrivals"),
        fieldKey(locationId),
        6
    );
    return decodePlanetArrivals(fields);
};

const readRevealed = async (node, contractAddress, slots, locationId) => {
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        requireSlot(slots, "revealed"),
        fieldKey(locationId),
        4
    );
    return decodeRevealed(fields);
};

const readArtifactLocation = async (node, contractAddress, slots, artifactId) =>
    readPublicMapField(
        node,
        contractAddress,
        requireSlot(slots, "artifact_locations"),
        fieldKey(artifactId)
    );

const readPlanetDestroyed = async (node, contractAddress, slots, locationId) =>
    readPublicMapField(
        node,
        contractAddress,
        requireSlot(slots, "planet_destroyed"),
        fieldKey(locationId)
    );

const readSpaceshipType = async (node, contractAddress, slots, shipId) =>
    readPublicMapField(
        node,
        contractAddress,
        requireSlot(slots, "spaceships"),
        fieldKey(shipId)
    );

const readSpaceshipOwner = async (node, contractAddress, slots, shipId) => {
    const raw = await readPublicMapField(
        node,
        contractAddress,
        requireSlot(slots, "spaceship_owners"),
        fieldKey(shipId)
    );
    return AztecAddress.fromBigInt(raw ?? 0n);
};

const readPlayerClaimedShips = async (node, contractAddress, slots, player) =>
    readPublicMapField(
        node,
        contractAddress,
        requireSlot(slots, "player_claimed_ships"),
        player
    );

const readGameConfig = async (node, contractAddress, slots) => {
    const configSlot = requireSlot(slots, "config");
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
        timeFactorHundredths,
        planetRarity,
        maxLocationId,
    ] = await readPublicFields(node, contractAddress, configSlot, 14);

    const configHashSpacetype = await readPublicField(
        node,
        contractAddress,
        requireSlot(slots, "config_hash_spacetype")
    );
    const configHashBiome = await readPublicField(
        node,
        contractAddress,
        requireSlot(slots, "config_hash_biome")
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
        timeFactorHundredths,
        planetRarity,
        maxLocationId,
        configHashSpacetype,
        configHashBiome,
    };
};

const readNftOwner = async (node, nftAddress, nftSlots, tokenId) => {
    const ownerField = await readPublicMapField(
        node,
        nftAddress,
        requireSlot(nftSlots, "public_owners"),
        fieldKey(tokenId)
    );
    return AztecAddress.fromBigInt(ownerField ?? 0n);
};

const buildInitArgs = (x, y, radius) => [
    x,
    y,
    radius,
];

const buildRevealArgs = (x, y) => [x, y];

const buildFindArtifactArgs = (x, y, biomebase) => [x, y, biomebase];

const toBytes32 = (value) => {
    const hex = value.toString(16).padStart(64, "0");
    const bytes = [];
    for (let i = 0; i < 64; i += 2) {
        bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
    }
    return bytes;
};

const expectedSpaceType = (perlin) => {
    if (perlin >= PERLIN_THRESHOLD_3) return SPACE_TYPE_DEAD_SPACE;
    if (perlin >= PERLIN_THRESHOLD_2) return SPACE_TYPE_DEEP_SPACE;
    if (perlin >= PERLIN_THRESHOLD_1) return SPACE_TYPE_SPACE;
    return SPACE_TYPE_NEBULA;
};

const expectedPlanetLevel = (locationId, spaceType) => {
    const locBytes = toBytes32(locationId);
    let levelUint = 0n;
    levelUint += BigInt(locBytes[4] ?? 0) << 16n;
    levelUint += BigInt(locBytes[5] ?? 0) << 8n;
    levelUint += BigInt(locBytes[6] ?? 0);

    let level = 0;
    let found = false;
    for (let i = 0; i < 10; i += 1) {
        const idx = 9 - i;
        const threshold = PLANET_LEVEL_THRESHOLDS[idx];
        if (!found && levelUint < threshold) {
            level = idx;
            found = true;
        }
    }

    if (spaceType === SPACE_TYPE_NEBULA && level > 4) level = 4;
    if (spaceType === SPACE_TYPE_SPACE && level > 5) level = 5;
    if (level > MAX_NATURAL_PLANET_LEVEL) level = MAX_NATURAL_PLANET_LEVEL;
    return level;
};

const expectedPlanetType = (locationId, spaceType, level) => {
    const locBytes = toBytes32(locationId);
    const weights = PLANET_TYPE_WEIGHTS[spaceType][level];
    let weightSum = 0n;
    for (let i = 0; i < 5; i += 1) weightSum += weights[i];
    assert(weightSum > 0n, "weightSum must be positive");

    const thresholds = [0, 0, 0, 0, 0];
    let remaining = weightSum;
    for (let i = 0; i < 5; i += 1) {
        remaining -= weights[i];
        thresholds[i] = Number((remaining * 256n) / weightSum);
    }

    const typeByte = locBytes[8] ?? 0;
    let planetType = 0;
    let found = false;
    for (let i = 0; i < 5; i += 1) {
        if (!found && typeByte >= thresholds[i]) {
            planetType = i;
            found = true;
        }
    }
    return planetType;
};

const expectedBiome = (biomebase) => {
    if (biomebase >= BIOME_THRESHOLD_2) return 2;
    if (biomebase >= BIOME_THRESHOLD_1) return 1;
    return 0;
};

const findPlanetOfType = (origin, config, targetType, maxDist) => {
    for (let dx = 0; dx <= maxDist; dx += 1) {
        for (let dy = 0; dy <= maxDist; dy += 1) {
            if (dx === 0 && dy === 0) continue;
            const x = origin.x + BigInt(dx);
            const y = origin.y + BigInt(dy);
            const perlin = multiScalePerlin(
                x,
                y,
                config.spacetypeKey,
                config.perlinLengthScale,
                config.perlinMirrorX,
                config.perlinMirrorY
            );
            const locationId = locationIdFromCoords(x, y, config.planethashKey);
            const spaceType = expectedSpaceType(perlin);
            const level = expectedPlanetLevel(locationId, spaceType);
            const planetType = expectedPlanetType(locationId, spaceType, level);
            if (planetType === targetType) {
                return { x, y, locationId, perlin, spaceType, level, planetType };
            }
        }
    }
    throw new Error(`No planet of type ${targetType} found within ${maxDist}`);
};

const calcDistMax = (from, to) => {
    const dx = Number(from.x - to.x);
    const dy = Number(from.y - to.y);
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.max(1, Math.ceil(dist));
};

const shipArtifactId = (locationId, shipType, planethashKey) => {
    const salt = SHIP_ID_SALT + BigInt(shipType);
    return mimcSponge2_220(locationId, salt, planethashKey);
};

const sendTx = async (label, call, from, fee, timeout, meta) => {
    const startedAt = Date.now();
    log("info", `tx.start ${label}`, {
        from: from?.toString ? from.toString() : String(from),
        ...(meta ?? {}),
    });
    try {
        const sent = await call.send(fee ? { from, fee } : { from });
        const rawHash = sent.getTxHash ? await sent.getTxHash() : sent.txHash;
        const txHash = formatTxHash(rawHash);
        const submittedAt = Date.now();
        log("info", `tx.submitted ${label}`, {
            txHash,
            submitMs: submittedAt - startedAt,
            ...(meta ?? {}),
        });
        const receipt = await sent.wait({ timeout });
        const confirmedAt = Date.now();
        log("info", `tx.confirmed ${label}`, {
            txHash,
            confirmMs: confirmedAt - submittedAt,
            totalMs: confirmedAt - startedAt,
            status: receipt?.status,
            ...(meta ?? {}),
        });
        return receipt;
    } catch (err) {
        log("error", `tx.failed ${label}`, {
            elapsedMs: Date.now() - startedAt,
            error: err?.message ?? err,
            stack: err?.stack,
            ...(meta ?? {}),
        });
        throw err;
    }
};

const expectFail = async (label, call, from, fee, timeout, meta) => {
    let failed = false;
    const startedAt = Date.now();
    try {
        await sendTx(label, call, from, fee, timeout, meta);
    } catch (err) {
        failed = true;
        log("info", `tx.expected_fail ${label}`, {
            elapsedMs: Date.now() - startedAt,
            ...(meta ?? {}),
        });
    }
    assert(failed, `${label} should fail`);
};

const getBlockNumber = async (node) => {
    const tips = await node.getL2Tips();
    return Number(tips.latest.number);
};

const waitForBlock = async (node, targetBlock, timeoutMs, tick) => {
    const start = Date.now();
    let lastBlock = await getBlockNumber(node);
    let lastTickAt = 0;
    while (Date.now() - start < timeoutMs) {
        const current = await getBlockNumber(node);
        if (current >= targetBlock) return current;
        if (tick && current === lastBlock) {
            const now = Date.now();
            if (now - lastTickAt > 5000) {
                await tick();
                lastTickAt = now;
            }
        }
        lastBlock = current;
        await sleep(1000);
    }
    throw new Error(`Timed out waiting for block ${targetBlock}`);
};

const resolveArrival = async (
    node,
    darkforest,
    slots,
    locationId,
    fromAddress,
    fee,
    timeout,
    tick
) => {
    const arrivals = await readPlanetArrivals(node, darkforest.address, slots, locationId);
    const arrivalId = arrivals.ids.find((id) => id !== 0n);
    assert(arrivalId, "Expected arrival id on target planet");
    const arrival = await readArrivalState(node, darkforest.address, slots, arrivalId);
    await waitForBlock(node, arrival.arrivalBlock, timeout, tick);
    await sendTx(
        `resolve_arrival(${arrivalId})`,
        darkforest.methods.resolve_arrival(arrivalId),
        fromAddress,
        fee,
        timeout
    );
    return { arrivalId, arrival };
};

async function main() {
    const {
        nodeUrl,
        adminUrl,
        l1RpcUrl,
        darkforestAddress,
        nftAddress,
        sponsoredFpcAddress,
        deploy,
        mineEmptyBlocks,
        proverEnabled,
        txTimeoutMs,
        blockTimeoutMs,
        searchMaxDist,
    } = parseArgs();

    log("info", "e2e.config", {
        nodeUrl,
        adminUrl,
        l1RpcUrl,
        deploy,
        mineEmptyBlocks,
        proverEnabled,
        searchMaxDist,
    });

    console.log(`Connecting to Aztec node at ${nodeUrl}...`);
    const node = createAztecNodeClient(nodeUrl);
    await waitForNode(node);

    if (mineEmptyBlocks) {
        await trySetSequencerConfig(adminUrl, { minTxsPerBlock: 0, enforceTimeTable: true });
    }

    const wallet = await TestWallet.create(node, { proverEnabled });
    const sponsoredAddress = await resolveSponsoredFpc(wallet, node, sponsoredFpcAddress);
    const fee = sponsoredAddress
        ? { paymentMethod: new SponsoredFeePaymentMethod(sponsoredAddress) }
        : undefined;
    const { player1, player2 } = await ensureAccounts(wallet, node, txTimeoutMs, fee);
    log("info", "e2e.accounts", {
        player1: player1.address.toString(),
        player2: player2.address.toString(),
    });
    const mineEmptyBlock = createEmptyBlockMiner(l1RpcUrl);
    let emptyBlockMisses = 0;

    const darkforestArtifact = loadArtifact(["target/darkforest_contract-DarkForest.json"]);
    const nftArtifact = loadArtifact([
        "../nft/target/darkforest_nft-NFT.json",
        "darkforest_nft-NFT.json",
    ]);

    let darkforest;
    let nft;

    if (deploy) {
        console.log("Deploying NFT + DarkForest...");
        const nftDeploy = Contract.deploy(wallet, nftArtifact, [player1.address]);
        nft = await nftDeploy.send({ from: player1.address, fee }).deployed();

        const config = DEFAULT_CONFIG;
        const dfDeploy = Contract.deploy(wallet, darkforestArtifact, [
            config,
            nft.address,
        ]);
        darkforest = await dfDeploy.send({ from: player1.address, fee }).deployed();

        await nft.methods
            .set_minter(darkforest.address)
            .send({ from: player1.address, fee })
            .wait({ timeout: txTimeoutMs });
        log("info", "e2e.deploy", {
            darkforest: darkforest.address.toString(),
            nft: nft.address.toString(),
        });
    } else {
        const dfAddr = AztecAddress.fromString(darkforestAddress);
        const nftAddr = AztecAddress.fromString(nftAddress);

        const dfInstance = await node.getContract(dfAddr);
        if (!dfInstance) throw new Error("DarkForest contract not found");
        await wallet.registerContract(dfInstance, darkforestArtifact);
        darkforest = Contract.at(dfAddr, darkforestArtifact, wallet);

        const nftInstance = await node.getContract(nftAddr);
        if (!nftInstance) throw new Error("NFT contract not found");
        await wallet.registerContract(nftInstance, nftArtifact);
        nft = Contract.at(nftAddr, nftArtifact, wallet);
        log("info", "e2e.contracts", {
            darkforest: darkforest.address.toString(),
            nft: nft.address.toString(),
        });
    }

    const dfSlots = getStorageSlots(darkforestArtifact, "DarkForest");
    const nftSlots = getStorageSlots(nftArtifact, "NFT");

    const config = await readGameConfig(node, darkforest.address, dfSlots);
    const spacetypeHashCheck = configHash(
        config.planethashKey,
        config.spacetypeKey,
        config.perlinLengthScale,
        config.perlinMirrorX,
        config.perlinMirrorY
    );
    assert(spacetypeHashCheck === config.configHashSpacetype, "config hash mismatch");
    console.log("Running end-to-end flow...");

    await sendTx(
        "init_player (player1)",
        darkforest.methods.init_player(
            ...buildInitArgs(DEFAULT_INIT.x, DEFAULT_INIT.y, DEFAULT_INIT.radius)
        ),
        player1.address,
        fee,
        txTimeoutMs
    );

    await sendTx(
        "init_player (player2)",
        darkforest.methods.init_player(
            ...buildInitArgs(DEFAULT_INIT_2.x, DEFAULT_INIT_2.y, DEFAULT_INIT_2.radius)
        ),
        player2.address,
        fee,
        txTimeoutMs
    );

    await expectFail(
        "init_player repeat should fail",
        darkforest.methods.init_player(
            ...buildInitArgs(DEFAULT_INIT.x, DEFAULT_INIT.y, DEFAULT_INIT.radius)
        ),
        player1.address,
        fee,
        txTimeoutMs
    );

    await expectFail(
        "reveal_location out of bounds should fail",
        darkforest.methods.reveal_location(
            ...buildRevealArgs(MAX_COORD_ABS + 1n, 0n)
        ),
        player1.address,
        fee,
        txTimeoutMs
    );

    const player1State = await readPlayerState(node, darkforest.address, dfSlots, player1.address);
    const player2State = await readPlayerState(node, darkforest.address, dfSlots, player2.address);
    assert(player1State.isInitialized, "player1 should be initialized");
    assert(player2State.isInitialized, "player2 should be initialized");

    const home1Id = player1State.homePlanet;
    const home2Id = player2State.homePlanet;
    const home1 = await readPlanetState(node, darkforest.address, dfSlots, home1Id);
    assert(home1.owner.equals(player1.address), "home1 owner mismatch");
    const tickBlock = async () => {
        if (mineEmptyBlocks) {
            const before = await getBlockNumber(node);
            const mined = await mineEmptyBlock();
            if (mined) {
                const after = await getBlockNumber(node);
                if (after > before) {
                    emptyBlockMisses = 0;
                    return;
                }
                emptyBlockMisses += 1;
                if (emptyBlockMisses < 3) {
                    return;
                }
            }
        }

        emptyBlockMisses = 0;
        log("warn", "e2e.tick", {
            message: "tick tx disabled; rely on empty blocks or sequencer cadence.",
        });
    };

    const targetPlanet = findPlanetOfType(
        DEFAULT_INIT,
        config,
        PLANET_TYPE_PLANET,
        searchMaxDist
    );
    const moveDistMax = calcDistMax({ x: DEFAULT_INIT.x, y: DEFAULT_INIT.y }, targetPlanet);

    await expectFail(
        "move with insufficient population should fail",
        darkforest.methods.move(
            DEFAULT_INIT.x,
            DEFAULT_INIT.y,
            targetPlanet.x,
            targetPlanet.y,
            config.worldRadius,
            BigInt(moveDistMax),
            home1.population + 1n,
            0n,
            0n,
            false
        ),
        player1.address,
        fee,
        txTimeoutMs
    );

    await sendTx(
        "reveal_location (target)",
        darkforest.methods.reveal_location(
            ...buildRevealArgs(targetPlanet.x, targetPlanet.y)
        ),
        player1.address,
        fee,
        txTimeoutMs
    );

    const revealedTarget = await readRevealed(
        node,
        darkforest.address,
        dfSlots,
        targetPlanet.locationId
    );
    assert(revealedTarget.locationId === targetPlanet.locationId, "target reveal missing");

    const movePopulation = home1.population / 2n;
    assert(movePopulation > 0n, "move population too low");
    await sendTx(
        "move (home -> target)",
        darkforest.methods.move(
            DEFAULT_INIT.x,
            DEFAULT_INIT.y,
            targetPlanet.x,
            targetPlanet.y,
            config.worldRadius,
            BigInt(moveDistMax),
            movePopulation,
            0n,
            0n,
            false
        ),
        player1.address,
        fee,
        txTimeoutMs
    );

    await resolveArrival(
        node,
        darkforest,
        dfSlots,
        targetPlanet.locationId,
        player1.address,
        fee,
        blockTimeoutMs,
        tickBlock
    );
    const movedPlanet = await readPlanetState(
        node,
        darkforest.address,
        dfSlots,
        targetPlanet.locationId
    );
    assert(movedPlanet.owner.equals(player1.address), "move target owner mismatch");

    console.log("E2E flow complete.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
