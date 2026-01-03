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

const CONFIG = {
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
    planet_rarity: 1,
    max_location_id: BigInt(
        "1335952323720658888076562850662675481478782006861330221172986095372058624"
    ),
};

const DEFAULT_INIT = { x: "990", y: "0", radius: "1000" };
const DEFAULT_REVEAL = { x: "123", y: "456" };

function parseArgs() {
    const args = new Set(process.argv.slice(2));
    return {
        nodeUrl: process.env.AZTEC_NODE_URL ?? "http://localhost:8080",
        writeEnv: args.has("--write-env") || args.has("-w"),
        overwriteEnv: args.has("--overwrite-env"),
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

function buildEnvBlock(nodeUrl, darkforestAddress, nftAddress, sponsoredAddress) {
    const lines = [
        `VITE_AZTEC_NODE_URL=${nodeUrl}`,
        `VITE_DARKFOREST_ADDRESS=${darkforestAddress}`,
        `VITE_NFT_ADDRESS=${nftAddress}`,
        `VITE_SPONSORED_FPC_ADDRESS=${sponsoredAddress ?? ""}`,
        `VITE_ACCOUNT_INDEX=0`,
        `VITE_PROVER_ENABLED=false`,
        `VITE_PLANETHASH_KEY=${CONFIG.planethash_key}`,
        `VITE_SPACETYPE_KEY=${CONFIG.spacetype_key}`,
        `VITE_PERLIN_LENGTH_SCALE=${CONFIG.perlin_length_scale}`,
        `VITE_PERLIN_MIRROR_X=${CONFIG.perlin_mirror_x}`,
        `VITE_PERLIN_MIRROR_Y=${CONFIG.perlin_mirror_y}`,
        `VITE_INIT_X=${DEFAULT_INIT.x}`,
        `VITE_INIT_Y=${DEFAULT_INIT.y}`,
        `VITE_INIT_RADIUS=${DEFAULT_INIT.radius}`,
        `VITE_REVEAL_X=${DEFAULT_REVEAL.x}`,
        `VITE_REVEAL_Y=${DEFAULT_REVEAL.y}`,
    ];
    return `${lines.join("\n")}\n`;
}

async function main() {
    const { nodeUrl, writeEnv, overwriteEnv } = parseArgs();
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
        CONFIG,
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
        sponsoredAddress?.toString()
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
