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
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Fr } from "@aztec/aztec.js/fields";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTRACTS_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(CONTRACTS_DIR, "..", "..");
const CLIENT_ENV_PATH = path.join(ROOT_DIR, "apps", "client", ".env.local");

const SPONSORED_FPC_SALT = new Fr(0);

const FIELD_MODULUS =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const deriveMaxLocationId = (planetRarity) => {
    const rarity = BigInt(planetRarity);
    if (rarity <= 0n) {
        throw new Error("planet_rarity must be greater than zero.");
    }
    const maxLocationId = FIELD_MODULUS / rarity;
    return maxLocationId === FIELD_MODULUS ? FIELD_MODULUS - 1n : maxLocationId;
};

const BASE_CONFIG = {
    planethash_key: 42n,
    spacetype_key: 43n,
    biomebase_key: 6271n,
    perlin_length_scale: 1024,
    perlin_mirror_x: false,
    perlin_mirror_y: false,
    init_perlin_min: 0,
    init_perlin_max: 33,
    world_radius: 10000,
    spawn_rim_area: 0,
    location_reveal_cooldown: 0,
    time_factor_hundredths: 100,
    planet_rarity: 1,
    max_location_id: deriveMaxLocationId(1),
};

const DEFAULT_INIT = { x: 990, y: 0, radius: 1000 };
const DEFAULT_REVEAL = { x: 123, y: 456 };

const readOptionalInt = (value) => {
    if (value === undefined || value === "") return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.trunc(parsed);
};

const readOptionalFloat = (value) => {
    if (value === undefined || value === "") return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
};

const readPositiveInt = (value, fallback) => {
    const parsed = readOptionalInt(value);
    if (parsed === undefined || parsed <= 0) return fallback;
    return parsed;
};

const clampCoord = (value, worldRadius) => {
    if (worldRadius <= 0) return 0;
    return Math.max(Math.min(value, worldRadius), -worldRadius);
};

const clampRadius = (value, worldRadius) => {
    if (worldRadius <= 0) return 0;
    return Math.max(0, Math.min(value, worldRadius));
};

const deriveDefaults = (worldRadius) => {
    return {
        init: {
            x: clampCoord(DEFAULT_INIT.x, worldRadius),
            y: clampCoord(DEFAULT_INIT.y, worldRadius),
            radius: clampRadius(DEFAULT_INIT.radius, worldRadius),
        },
        reveal: {
            x: clampCoord(DEFAULT_REVEAL.x, worldRadius),
            y: clampCoord(DEFAULT_REVEAL.y, worldRadius),
        },
    };
};

function parseArgs() {
    const rawArgs = process.argv.slice(2);
    const args = new Set(rawArgs);
    const getArg = (flag) => {
        const idx = rawArgs.indexOf(flag);
        if (idx === -1 || idx + 1 >= rawArgs.length) return undefined;
        return rawArgs[idx + 1];
    };
    const smallMap =
        args.has("--small-map") ||
        process.env.DF_SMALL_MAP === "1" ||
        process.env.DF_SMALL_MAP === "true";
    // Local tiny-map defaults for fast iteration.
    const defaultWorldRadius = smallMap ? 400 : BASE_CONFIG.world_radius;
    const defaultPlanetRarity = smallMap ? 8 : BASE_CONFIG.planet_rarity;
    const worldRadius = readPositiveInt(
        getArg("--world-radius") ?? process.env.DF_WORLD_RADIUS,
        defaultWorldRadius
    );
    const planetRarity = readPositiveInt(
        getArg("--planet-rarity") ?? process.env.DF_PLANET_RARITY,
        defaultPlanetRarity
    );
    const inferredTinyMap = smallMap || worldRadius <= 1000 || planetRarity >= 8;
    // Faster local pacing for tiny maps.
    const defaultTimeFactor = inferredTinyMap ? 500 : BASE_CONFIG.time_factor_hundredths;
    const timeFactorHundredths = readPositiveInt(
        getArg("--time-factor") ?? process.env.DF_TIME_FACTOR_HUNDREDTHS,
        defaultTimeFactor
    );
    const derived = deriveDefaults(worldRadius);
    const blockTimeSec = readOptionalFloat(
        getArg("--block-time") ?? process.env.DF_BLOCK_TIME_SEC
    );
    const init = {
        x:
            readOptionalInt(getArg("--init-x") ?? process.env.DF_INIT_X) ??
            derived.init.x,
        y:
            readOptionalInt(getArg("--init-y") ?? process.env.DF_INIT_Y) ??
            derived.init.y,
        radius:
            readOptionalInt(getArg("--init-radius") ?? process.env.DF_INIT_RADIUS) ??
            derived.init.radius,
    };
    const reveal = {
        x:
            readOptionalInt(getArg("--reveal-x") ?? process.env.DF_REVEAL_X) ??
            derived.reveal.x,
        y:
            readOptionalInt(getArg("--reveal-y") ?? process.env.DF_REVEAL_Y) ??
            derived.reveal.y,
    };

    const boundedInit = {
        x: clampCoord(init.x, worldRadius),
        y: clampCoord(init.y, worldRadius),
        radius: clampRadius(init.radius, worldRadius),
    };
    const boundedReveal = {
        x: clampCoord(reveal.x, worldRadius),
        y: clampCoord(reveal.y, worldRadius),
    };

    return {
        nodeUrl: process.env.AZTEC_NODE_URL ?? "http://localhost:8080",
        writeEnv: args.has("--write-env") || args.has("-w"),
        overwriteEnv: args.has("--overwrite-env"),
        blockTimeSec,
        configOverrides: {
            world_radius: worldRadius,
            planet_rarity: planetRarity,
            time_factor_hundredths: timeFactorHundredths,
        },
        init: boundedInit,
        reveal: boundedReveal,
    };
}

function loadArtifact(relativePath) {
    const artifactPath = path.join(CONTRACTS_DIR, relativePath);
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`Missing artifact at ${artifactPath}. Run compile first.`);
    }
    const json = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    return loadContractArtifact(json);
}

async function resolveSponsoredFpc(wallet, node) {
    const instance = await getContractInstanceFromInstantiationParams(
        SponsoredFPCContract.artifact,
        { salt: SPONSORED_FPC_SALT }
    );
    const onChain = await node.getContract(instance.address);
    if (!onChain) {
        console.warn("SponsoredFPC not found on-chain at salt=0. Proceeding without sponsored fees.");
        return undefined;
    }
    await wallet.registerContract(onChain, SponsoredFPCContract.artifact);
    return onChain.address;
}

async function ensureAccount(wallet) {
    const accounts = await getInitialTestAccountsData();
    const accountData = accounts[0];
    if (!accountData) {
        throw new Error("No initial test accounts available.");
    }
    const account = await wallet.createSchnorrAccount(
        accountData.secret,
        accountData.salt,
        accountData.signingKey
    );
    console.log("Using initial test account (predeployed on local network).");
    return account;
}

function buildEnvBlock(
    nodeUrl,
    darkforestAddress,
    nftAddress,
    sponsoredAddress,
    config,
    init,
    reveal,
    blockTimeSec
) {
    const lines = [
        `VITE_AZTEC_NODE_URL=${nodeUrl}`,
        `VITE_DARKFOREST_ADDRESS=${darkforestAddress}`,
        `VITE_NFT_ADDRESS=${nftAddress}`,
        `VITE_SPONSORED_FPC_ADDRESS=${sponsoredAddress ?? ""}`,
        `VITE_ACCOUNT_INDEX=0`,
        `VITE_PROVER_ENABLED=false`,
        `VITE_PLANETHASH_KEY=${config.planethash_key}`,
        `VITE_SPACETYPE_KEY=${config.spacetype_key}`,
        `VITE_PERLIN_LENGTH_SCALE=${config.perlin_length_scale}`,
        `VITE_PERLIN_MIRROR_X=${config.perlin_mirror_x}`,
        `VITE_PERLIN_MIRROR_Y=${config.perlin_mirror_y}`,
        `VITE_INIT_X=${init.x}`,
        `VITE_INIT_Y=${init.y}`,
        `VITE_INIT_RADIUS=${init.radius}`,
        `VITE_REVEAL_X=${reveal.x}`,
        `VITE_REVEAL_Y=${reveal.y}`,
    ];
    if (blockTimeSec !== undefined) {
        lines.push(`VITE_BLOCK_TIME_SEC=${blockTimeSec}`);
    }
    return `${lines.join("\n")}\n`;
}

async function main() {
    const { nodeUrl, writeEnv, overwriteEnv, configOverrides, init, reveal, blockTimeSec } =
        parseArgs();
    const config = { ...BASE_CONFIG, ...configOverrides };
    config.max_location_id = deriveMaxLocationId(config.planet_rarity);
    console.log(`Connecting to Aztec node at ${nodeUrl}...`);
    const node = createAztecNodeClient(nodeUrl);
    await waitForNode(node);
    console.log("Node ready.");

    const wallet = await TestWallet.create(node, { proverEnabled: false });
    const account = await ensureAccount(wallet);
    console.log(`Using admin account ${account.address.toString()}`);

    const darkforestArtifact = loadArtifact("target/darkforest_contract-DarkForest.json");
    const nftArtifact = loadArtifact("../nft/target/darkforest_nft-NFT.json");

    const sponsoredAddress = await resolveSponsoredFpc(wallet, node);
    const fee = sponsoredAddress
        ? { paymentMethod: new SponsoredFeePaymentMethod(sponsoredAddress) }
        : undefined;

    console.log("Deploying NFT...");
    const nftDeploy = Contract.deploy(wallet, nftArtifact, [account.address]);
    const nft = await nftDeploy.send({ from: account.address, fee }).deployed();
    console.log(`NFT deployed at ${nft.address.toString()}`);

    console.log("Deploying DarkForest...");
    const dfDeploy = Contract.deploy(wallet, darkforestArtifact, [
        account.address,
        config,
        nft.address,
    ]);
    const darkforest = await dfDeploy.send({ from: account.address, fee }).deployed();
    console.log(`DarkForest deployed at ${darkforest.address.toString()}`);

    console.log("Setting NFT minter...");
    await nft.methods
        .set_minter(darkforest.address)
        .send({ from: account.address, fee })
        .wait({ timeout: 120000 });
    console.log("NFT minter updated.");

    const envBlock = buildEnvBlock(
        nodeUrl,
        darkforest.address.toString(),
        nft.address.toString(),
        sponsoredAddress?.toString(),
        config,
        init,
        reveal,
        blockTimeSec
    );

    console.log("\n.env.local block:\n");
    console.log(envBlock);

    const shouldWrite = writeEnv || !fs.existsSync(CLIENT_ENV_PATH);
    if (shouldWrite) {
        if (fs.existsSync(CLIENT_ENV_PATH) && !overwriteEnv) {
            console.warn(`Skipping write: ${CLIENT_ENV_PATH} already exists (use --overwrite-env).`);
        } else {
            fs.writeFileSync(CLIENT_ENV_PATH, envBlock, "utf8");
            console.log(`Wrote ${CLIENT_ENV_PATH}`);
        }
    } else {
        console.log(`Skipped writing ${CLIENT_ENV_PATH} (use --write-env to write).`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
