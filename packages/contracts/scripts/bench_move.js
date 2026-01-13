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
import { generateSchnorrAccounts, getInitialTestAccountsData } from "@aztec/accounts/testing";
import { Fr } from "@aztec/aztec.js/fields";
import { deriveStorageSlotInMap } from "@aztec/stdlib/hash";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";

import { FIELD_MODULUS, locationIdFromCoords } from "./hashing.js";

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
const DEFAULT_MOVE_OFFSET = { x: 3n, y: 3n };

const ZERO_ADDRESS = AztecAddress.fromBigInt(0n);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toBool = (value) => value === 1n;
const toU32 = (value) => Number(value);

const fieldKey = (value) => new Fr(value);

const parseBigInt = (value) => BigInt(value);
const getEnvBigInt = (name, fallback) =>
    process.env[name] ? parseBigInt(process.env[name]) : fallback;
const parseBoolEnv = (value, fallback) => {
    if (value === undefined) return fallback;
    return value === "true" || value === "1";
};

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
    const hasAddress = Boolean(process.env.DARKFOREST_ADDRESS);
    const deploy = forceDeploy || (!forceNoDeploy && !hasAddress);
    const mineEmptyBlocks =
        !args.has("--no-empty-blocks") && process.env.MINE_EMPTY_BLOCKS !== "false";
    const proverEnabled = process.env.PROVER_ENABLED === "true" || args.has("--prover");
    const tickProverEnabled = parseBoolEnv(process.env.TICK_PROVER_ENABLED, proverEnabled);
    const accountMode = process.env.ACCOUNT_MODE ?? "test";
    const useExistingPlayer = parseBoolEnv(process.env.USE_EXISTING_PLAYER, false);
    const blockIntervalMs = Number(process.env.BLOCK_INTERVAL_MS ?? "5000");
    return {
        nodeUrl: process.env.AZTEC_NODE_URL ?? "http://localhost:8080",
        adminUrl: process.env.AZTEC_NODE_ADMIN_URL ?? "http://localhost:8880",
        l1RpcUrl: process.env.L1_RPC_URL ?? "http://localhost:8545",
        darkforestAddress: process.env.DARKFOREST_ADDRESS ?? "",
        nftAddress: process.env.NFT_ADDRESS ?? "",
        sponsoredFpcAddress: process.env.SPONSORED_FPC_ADDRESS ?? "",
        deploy,
        mineEmptyBlocks,
        proverEnabled,
        tickProverEnabled,
        accountMode,
        useExistingPlayer,
        txTimeoutMs: Number(process.env.TX_TIMEOUT_MS ?? "180000"),
        blockTimeoutMs: Number(process.env.BLOCK_TIMEOUT_MS ?? "180000"),
        blockIntervalMs: Number.isFinite(blockIntervalMs) && blockIntervalMs > 0 ? blockIntervalMs : 5000,
        searchMaxDist: Number(process.env.SEARCH_MAX_DIST ?? "200"),
        initX: getEnvBigInt("INIT_X", DEFAULT_INIT.x),
        initY: getEnvBigInt("INIT_Y", DEFAULT_INIT.y),
        initRadius: getEnvBigInt("INIT_RADIUS", DEFAULT_INIT.radius),
        moveTargetX: process.env.MOVE_TARGET_X
            ? parseBigInt(process.env.MOVE_TARGET_X)
            : null,
        moveTargetY: process.env.MOVE_TARGET_Y
            ? parseBigInt(process.env.MOVE_TARGET_Y)
            : null,
        movePop: getEnvBigInt("MOVE_POP", 10000n),
        skipResolve: args.has("--no-resolve") || process.env.SKIP_RESOLVE === "true",
        accountIndex: Number(process.env.ACCOUNT_INDEX ?? "0"),
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

const selectAccountData = async (accountIndex, accountMode) => {
    if (accountMode === "random") {
        const [generated] = await generateSchnorrAccounts(1);
        if (!generated) {
            throw new Error("Failed to generate a random account.");
        }
        return generated;
    }

    const accounts = await getInitialTestAccountsData();
    const account = accounts[accountIndex];
    if (!account) {
        throw new Error(
            `Missing test account index ${accountIndex}. Local devnet provides indices 0-2.`
        );
    }
    return account;
};

const ensureAccount = async (wallet, node, txTimeoutMs, fee, accountIndex, accountMode) => {
    const account = await selectAccountData(accountIndex, accountMode);

    const manager = await wallet.createSchnorrAccount(
        account.secret,
        account.salt,
        account.signingKey
    );
    const onChain = await node.getContract(manager.address);
    if (onChain) return manager;

    console.log(
        `Deploying benchmark account${accountMode === "random" ? " (random)" : ""}...`
    );
    try {
        const deployMethod = await manager.getDeployMethod();
        const options = fee ? { from: ZERO_ADDRESS, fee } : { from: ZERO_ADDRESS };
        const sent = await deployMethod.send(options);
        await sent.wait({ timeout: txTimeoutMs });
        console.log("✓ Deployed benchmark account");
    } catch (err) {
        if (isExistingNullifierError(err)) {
            console.warn("Benchmark account already deployed; continuing.");
            return manager;
        }
        throw err;
    }
    return manager;
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

const decodePlanet = (fields) => ({
    population: fields[3] ?? 0n,
});

const decodeArrival = (fields) => {
    const meta = fields[4] ?? 0n;
    const mask32 = (1n << 32n) - 1n;
    const arrivalBlock = Number((meta >> 32n) & mask32);
    return {
        arrivalBlock,
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
    };
};

const buildInitArgs = (x, y, radius, config) => [
    x,
    y,
    radius,
    config.planethashKey,
    config.spacetypeKey,
    config.perlinLengthScale,
    config.perlinMirrorX,
    config.perlinMirrorY,
    config.configHashSpacetype,
    config.maxLocationId,
    config.worldRadius,
    config.spawnRimArea,
    config.initPerlinMin,
    config.initPerlinMax,
];

const calcDistMax = (from, to) => {
    const dx = Number(from.x - to.x);
    const dy = Number(from.y - to.y);
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.max(1, Math.ceil(dist));
};

const sendTxTimed = async (label, call, from, fee, timeout) => {
    const start = Date.now();
    console.log(`→ ${label}`);
    const sent = await call.send(fee ? { from, fee } : { from });
    const receipt = await sent.wait({ timeout });
    const durationMs = Date.now() - start;
    console.log(`✓ ${label} (${durationMs} ms)`);
    return { receipt, durationMs };
};

const getBlockNumber = async (node) => {
    const tips = await node.getL2Tips();
    return Number(tips.latest.number);
};

const waitForBlock = async (node, targetBlock, timeoutMs, tick, tickIntervalMs = 5000) => {
    const start = Date.now();
    let lastBlock = await getBlockNumber(node);
    let lastTickAt = 0;
    while (Date.now() - start < timeoutMs) {
        const current = await getBlockNumber(node);
        if (current >= targetBlock) return current;
        if (tick && current === lastBlock) {
            const now = Date.now();
            if (now - lastTickAt > tickIntervalMs) {
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
    tick,
    tickIntervalMs
) => {
    const arrivals = await readPlanetArrivals(node, darkforest.address, slots, locationId);
    const arrivalId = arrivals.ids.find((id) => id !== 0n);
    assert(arrivalId, "Expected arrival id on target planet");
    const arrival = await readArrivalState(node, darkforest.address, slots, arrivalId);
    const waitStart = Date.now();
    await waitForBlock(node, arrival.arrivalBlock, timeout, tick, tickIntervalMs);
    const waitMs = Date.now() - waitStart;
    const tx = await sendTxTimed(
        `resolve_arrival(${arrivalId})`,
        darkforest.methods.resolve_arrival(arrivalId),
        fromAddress,
        fee,
        timeout
    );
    return { arrivalId, waitMs, txMs: tx.durationMs };
};

const isWithinWorld = (x, y, worldRadius) => {
    const dx = x < 0n ? -x : x;
    const dy = y < 0n ? -y : y;
    const r = worldRadius < 0n ? -worldRadius : worldRadius;
    return dx * dx + dy * dy <= r * r;
};

const findValidCoords = (origin, config, maxDist, predicate) => {
    const max = Math.max(1, Math.floor(maxDist));
    for (let dx = 0; dx <= max; dx += 1) {
        for (let dy = 0; dy <= max; dy += 1) {
            if (dx === 0 && dy === 0) continue;
            const x = origin.x + BigInt(dx);
            const y = origin.y + BigInt(dy);
            if (!isWithinWorld(x, y, config.worldRadius)) continue;
            const locationId = locationIdFromCoords(x, y, config.planethashKey);
            if (locationId >= config.maxLocationId) continue;
            if (predicate && !predicate(locationId)) continue;
            return { x, y, locationId };
        }
    }
    return null;
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
        tickProverEnabled,
        accountMode,
        txTimeoutMs,
        blockTimeoutMs,
        blockIntervalMs,
        searchMaxDist,
        initX,
        initY,
        initRadius,
        moveTargetX,
        moveTargetY,
        movePop,
        skipResolve,
        accountIndex,
        useExistingPlayer,
    } = parseArgs();

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

    const admin = await ensureAccount(
        wallet,
        node,
        txTimeoutMs,
        fee,
        accountIndex,
        accountMode
    );

    const darkforestArtifact = loadArtifact(["target/darkforest_contract-DarkForest.json"]);
    const nftArtifact = loadArtifact([
        "../nft/target/darkforest_nft-NFT.json",
        "darkforest_nft-NFT.json",
    ]);

    let darkforest;
    let nft;

    if (deploy) {
        console.log("Deploying NFT + DarkForest...");
        const nftDeploy = Contract.deploy(wallet, nftArtifact, [admin.address]);
        nft = await nftDeploy.send({ from: admin.address, fee }).deployed();

        const config = DEFAULT_CONFIG;
        const dfDeploy = Contract.deploy(wallet, darkforestArtifact, [
            config,
            nft.address,
        ]);
        darkforest = await dfDeploy.send({ from: admin.address, fee }).deployed();

        await nft.methods
            .set_minter(darkforest.address)
            .send({ from: admin.address, fee })
            .wait({ timeout: txTimeoutMs });
    } else {
        if (!darkforestAddress) {
            throw new Error("DARKFOREST_ADDRESS is required when not deploying.");
        }
        const dfAddr = AztecAddress.fromString(darkforestAddress);
        const dfInstance = await node.getContract(dfAddr);
        if (!dfInstance) throw new Error("DarkForest contract not found");
        await wallet.registerContract(dfInstance, darkforestArtifact);
        darkforest = Contract.at(dfAddr, darkforestArtifact, wallet);

        if (nftAddress) {
            const nftAddr = AztecAddress.fromString(nftAddress);
            const nftInstance = await node.getContract(nftAddr);
            if (nftInstance) {
                await wallet.registerContract(nftInstance, nftArtifact);
                nft = Contract.at(nftAddr, nftArtifact, wallet);
            }
        }
    }

    const dfSlots = getStorageSlots(darkforestArtifact, "DarkForest");
    const config = await readGameConfig(node, darkforest.address, dfSlots);

    const initCandidate = { x: initX, y: initY, radius: initRadius };
    const playerState = await readPlayerState(node, darkforest.address, dfSlots, admin.address);

    let initCoords = initCandidate;
    let homeId;

    if (playerState.isInitialized) {
        if (!useExistingPlayer) {
            throw new Error(
                "Benchmark account already initialized. Use ACCOUNT_INDEX to select a fresh local account or set USE_EXISTING_PLAYER=true."
            );
        }
        const initLocationId = locationIdFromCoords(
            initCandidate.x,
            initCandidate.y,
            config.planethashKey
        );
        if (initLocationId !== playerState.homePlanet) {
            throw new Error(
                "INIT_X/INIT_Y do not match the existing home planet. Set INIT_X/INIT_Y to the original init coords."
            );
        }
        homeId = playerState.homePlanet;
    } else {
        const initLocationId = locationIdFromCoords(
            initCandidate.x,
            initCandidate.y,
            config.planethashKey
        );
        if (
            initLocationId >= config.maxLocationId ||
            !isWithinWorld(initCandidate.x, initCandidate.y, config.worldRadius)
        ) {
            const found = findValidCoords(initCandidate, config, searchMaxDist);
            if (!found) {
                throw new Error(
                    "Unable to find a valid init location. Increase SEARCH_MAX_DIST or adjust INIT_X/INIT_Y."
                );
            }
            initCoords = { ...initCandidate, x: found.x, y: found.y };
        }

        await sendTxTimed(
            "init_player",
            darkforest.methods.init_player(
                ...buildInitArgs(initCoords.x, initCoords.y, initCoords.radius, config)
            ),
            admin.address,
            fee,
            txTimeoutMs
        );

        const afterInit = await readPlayerState(node, darkforest.address, dfSlots, admin.address);
        assert(afterInit.isInitialized, "player should be initialized");
        homeId = afterInit.homePlanet;
    }
    const homePlanet = await readPlanetState(node, darkforest.address, dfSlots, homeId);

    let populationToMove = movePop;
    if (populationToMove <= 0n || populationToMove > homePlanet.population) {
        populationToMove = homePlanet.population / 2n;
    }
    if (populationToMove <= 0n) {
        populationToMove = 1n;
    }

    let target;
    if (moveTargetX !== null && moveTargetY !== null) {
        target = { x: moveTargetX, y: moveTargetY };
    } else {
        target = {
            x: initCoords.x + DEFAULT_MOVE_OFFSET.x,
            y: initCoords.y + DEFAULT_MOVE_OFFSET.y,
        };
    }

    let targetLocationId = locationIdFromCoords(target.x, target.y, config.planethashKey);
    if (
        targetLocationId >= config.maxLocationId ||
        !isWithinWorld(target.x, target.y, config.worldRadius)
    ) {
        const found = findValidCoords(initCoords, config, searchMaxDist, (id) => id !== homeId);
        if (!found) {
            throw new Error("Unable to find a valid move target. Increase SEARCH_MAX_DIST.");
        }
        target = { x: found.x, y: found.y };
        targetLocationId = found.locationId;
    }

    const distMax = calcDistMax({ x: initCoords.x, y: initCoords.y }, target);

    const moveResult = await sendTxTimed(
        "move",
        darkforest.methods.move(
            initCoords.x,
            initCoords.y,
            target.x,
            target.y,
            config.worldRadius,
            BigInt(distMax),
            populationToMove,
            0n,
            0n,
            false,
            config.planethashKey,
            config.spacetypeKey,
            config.perlinLengthScale,
            config.perlinMirrorX,
            config.perlinMirrorY,
            config.configHashSpacetype,
            config.maxLocationId,
            config.worldRadius
        ),
        admin.address,
        fee,
        txTimeoutMs
    );

    const metrics = {
        block_interval_ms: blockIntervalMs,
        tick_prover_enabled: tickProverEnabled,
        use_existing_player: useExistingPlayer,
        move_ms: moveResult.durationMs,
    };

    if (!skipResolve) {
        const buildTickContext = async () => {
            if (tickProverEnabled) {
                return { contract: darkforest, from: admin.address, fee };
            }

            const tickWallet = await TestWallet.create(node, { proverEnabled: false });
            const tickSponsored = await resolveSponsoredFpc(
                tickWallet,
                node,
                sponsoredFpcAddress
            );
            const tickFee = tickSponsored
                ? { paymentMethod: new SponsoredFeePaymentMethod(tickSponsored) }
                : undefined;

            const accounts = await getInitialTestAccountsData();
            const account = accounts[accountIndex];
            if (!account) {
                throw new Error(
                    `Missing test account index ${accountIndex}. Local devnet provides indices 0-2.`
                );
            }
            const tickManager = await tickWallet.createSchnorrAccount(
                account.secret,
                account.salt,
                account.signingKey
            );
            const dfInstance = await node.getContract(darkforest.address);
            if (!dfInstance) {
                throw new Error("DarkForest contract not found for tick wallet.");
            }
            await tickWallet.registerContract(dfInstance, darkforestArtifact);
            const tickContract = Contract.at(darkforest.address, darkforestArtifact, tickWallet);
            return { contract: tickContract, from: tickManager.address, fee: tickFee };
        };

        const tickContext = await buildTickContext();
        const mineEmptyBlock = createEmptyBlockMiner(l1RpcUrl);
        let emptyBlockMisses = 0;
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
            console.warn(
                "[bench_move] tick tx disabled (admin actions removed); rely on empty blocks or sequencer cadence."
            );
        };

        const resolveResult = await resolveArrival(
            node,
            darkforest,
            dfSlots,
            targetLocationId,
            admin.address,
            fee,
            blockTimeoutMs,
            tickBlock,
            blockIntervalMs
        );

        metrics.resolve_wait_ms = resolveResult.waitMs;
        metrics.resolve_tx_ms = resolveResult.txMs;
    }

    console.log("Benchmark results:");
    Object.entries(metrics).forEach(([key, value]) => {
        console.log(`- ${key}: ${value}`);
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
