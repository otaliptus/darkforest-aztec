import { createAztecNodeClient, waitForNode } from "@aztec/aztec.js/node";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { loadContractArtifact } from "@aztec/aztec.js/abi";
import { Contract, getContractInstanceFromInstantiationParams, type SentTx } from "@aztec/aztec.js/contracts";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import type { AccountManager } from "@aztec/aztec.js/wallet";
import { getInitialTestAccountsData } from "@aztec/accounts/testing/lazy";
const sponsoredFpcArtifactUrl = "/public/aztec/sponsored_fpc_contract-SponsoredFPC.json";
import { TestWallet } from "@aztec/test-wallet/client/lazy";
import type { NoirCompiledContract } from "@aztec/stdlib/noir";
import type { ClientAccountConfig, ClientConfig } from "../config";
import { MAX_TEST_ACCOUNTS } from "../config";
import type { OnChainConfig, PerlinConfig } from "./types";
import { getStorageSlots, readGameConfig, type StorageSlots } from "./storage";

import darkforestArtifactImport from "../../../../../../packages/contracts/target/darkforest_contract-DarkForest.json";
import nftArtifactImport from "../../../../../../packages/contracts/darkforest_nft-NFT.json";

const SPONSORED_FPC_SALT = new Fr(0);

type ArtifactSource = string | NoirCompiledContract | undefined;

const normalizeArtifactUrl = (url: string) => {
    if (!url) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return url;
    return `/${url}`;
};

const resolveArtifactJson = async (source: ArtifactSource, label: string) => {
    if (!source) {
        throw new Error(`Missing ${label} contract artifact source.`);
    }
    if (typeof source !== "string") {
        return source as NoirCompiledContract;
    }
    const url = normalizeArtifactUrl(source);
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to load ${label} contract artifact (${res.status}).`);
    }
    return (await res.json()) as NoirCompiledContract;
};

const loadSponsoredFpcArtifact = async () => {
    const json = await resolveArtifactJson(sponsoredFpcArtifactUrl, "SponsoredFPC");
    return loadContractArtifact(json);
};

export type DarkForestClient = {
    node: ReturnType<typeof createAztecNodeClient>;
    wallet: TestWallet;
    account: AccountManager;
    darkforest: Contract;
    darkforestAddress: AztecAddress;
    nft?: Contract;
    nftAddress?: AztecAddress;
    nftStorageSlots?: StorageSlots;
    perlinConfig: PerlinConfig;
    gameConfig: OnChainConfig;
    storageSlots: StorageSlots;
    sponsoredFee?: SponsoredFeePaymentMethod;
    initPlayer: (x: bigint, y: bigint, radius: bigint) => Promise<SentTx>;
    revealLocation: (x: bigint, y: bigint) => Promise<SentTx>;
    move: (
        x1: bigint,
        y1: bigint,
        x2: bigint,
        y2: bigint,
        radius: bigint,
        distMax: bigint,
        popMoved: bigint,
        silverMoved: bigint,
        movedArtifactId: bigint,
        abandoning: boolean
    ) => Promise<SentTx>;
    upgradePlanet: (locationId: bigint, branch: number) => Promise<SentTx>;
    prospectPlanet: (locationId: bigint) => Promise<SentTx>;
    findArtifact: (x: bigint, y: bigint, biomebase: bigint) => Promise<SentTx>;
    tradeArtifact: (locationId: bigint, artifactId: bigint, withdrawing: boolean) => Promise<SentTx>;
    setArtifactActivation: (
        locationId: bigint,
        artifactId: bigint,
        wormholeTo: bigint,
        activate: boolean
    ) => Promise<SentTx>;
    giveSpaceShips: (locationId: bigint) => Promise<SentTx>;
    stop: () => Promise<void> | void;
};

export type ClientLogFn = (message: string, data?: Record<string, unknown>) => void;

export function buildInitPlayerArgs(
    x: bigint,
    y: bigint,
    radius: bigint,
    config: PerlinConfig,
    gameConfig: OnChainConfig
) {
    return [
        x,
        y,
        radius,
        config.planethashKey,
        config.spacetypeKey,
        config.perlinLengthScale,
        config.perlinMirrorX,
        config.perlinMirrorY,
        gameConfig.configHashSpacetype,
        gameConfig.maxLocationId,
        gameConfig.worldRadius,
        gameConfig.spawnRimArea,
        gameConfig.initPerlinMin,
        gameConfig.initPerlinMax,
    ] as const;
}

export function buildRevealLocationArgs(
    x: bigint,
    y: bigint,
    config: PerlinConfig,
    gameConfig: OnChainConfig
) {
    return [
        x,
        y,
        config.planethashKey,
        config.spacetypeKey,
        config.perlinLengthScale,
        config.perlinMirrorX,
        config.perlinMirrorY,
        gameConfig.configHashSpacetype,
        gameConfig.maxLocationId,
    ] as const;
}

export function buildFindArtifactArgs(
    x: bigint,
    y: bigint,
    biomebase: bigint,
    config: PerlinConfig,
    gameConfig: OnChainConfig
) {
    return [
        x,
        y,
        biomebase,
        gameConfig.planethashKey,
        gameConfig.biomebaseKey,
        config.perlinLengthScale,
        config.perlinMirrorX,
        config.perlinMirrorY,
        gameConfig.configHashBiome,
        gameConfig.maxLocationId,
    ] as const;
}

function parseAddress(value: string, label: string) {
    if (!value) {
        throw new Error(`Missing ${label} address.`);
    }
    return AztecAddress.fromString(value);
}

function logStep(log: ClientLogFn | undefined, message: string, data?: Record<string, unknown>) {
    if (!log) return;
    log(message, data);
}

async function resolveAccount(
    wallet: TestWallet,
    config: ClientAccountConfig | undefined,
    log?: ClientLogFn
) {
    if (config?.secret && config?.salt && config?.signingKey) {
        logStep(log, "Using provided account keys.");
        const secret = Fr.fromString(config.secret);
        const salt = Fr.fromString(config.salt);
        const signingKey = GrumpkinScalar.fromString(config.signingKey);
        const account = await wallet.createSchnorrAccount(secret, salt, signingKey);
        logStep(log, "Account ready.", { address: account.address.toString() });
        return account;
    }

    const accounts = await getInitialTestAccountsData();
    const index = config?.testAccountIndex ?? 0;
    const maxIndex = Math.max(accounts.length - 1, 0);
    if (index < 0 || index >= accounts.length) {
        const supported = accounts.length ? `0-${maxIndex}` : "none";
        throw new Error(
            `No initial test account at index ${index}. Available indices: ${supported}. ` +
                `Local devnet provides ${MAX_TEST_ACCOUNTS} pre-funded accounts. ` +
                `Redeploy the contract or reset your local node if all accounts are used.`
        );
    }
    const account = accounts[index];
    logStep(log, "Using initial test account.", { index });
    const created = await wallet.createSchnorrAccount(
        account.secret,
        account.salt,
        account.signingKey
    );
    logStep(log, "Account ready.", { address: created.address.toString() });
    return created;
}

async function registerContractInstance(
    wallet: TestWallet,
    node: ReturnType<typeof createAztecNodeClient>,
    address: AztecAddress,
    artifact: ReturnType<typeof loadContractArtifact>,
    label: string,
    log?: ClientLogFn
) {
    logStep(log, `Checking ${label} contract on-chain...`, { address: address.toString() });
    const instance = await node.getContract(address);
    if (!instance) {
        throw new Error(`${label} contract not found at ${address.toString()}.`);
    }
    await wallet.registerContract(instance, artifact);
    logStep(log, `${label} contract registered.`, { address: address.toString() });
    return Contract.at(address, artifact, wallet);
}

async function resolveSponsoredFpc(
    wallet: TestWallet,
    node: ReturnType<typeof createAztecNodeClient>,
    addressOverride: string | undefined,
    log?: ClientLogFn
) {
    const sponsoredFpcArtifact = await loadSponsoredFpcArtifact();
    if (addressOverride) {
        const address = AztecAddress.fromString(addressOverride);
        const instance = await node.getContract(address);
        if (!instance) {
            logStep(log, "SponsoredFPC override not found on-chain. Disabling sponsored fees.", {
                address: address.toString(),
            });
            return undefined;
        }
        await wallet.registerContract(instance, sponsoredFpcArtifact);
        logStep(log, "SponsoredFPC registered (override).", {
            address: address.toString(),
        });
        return address;
    }

    const instance = await getContractInstanceFromInstantiationParams(
        sponsoredFpcArtifact,
        {
            salt: SPONSORED_FPC_SALT,
        }
    );
    const onChainInstance = await node.getContract(instance.address);
    if (!onChainInstance) {
        logStep(log, "SponsoredFPC not found on-chain (salt=0). Proceeding without sponsored fees.");
        return undefined;
    }
    await wallet.registerContract(onChainInstance, sponsoredFpcArtifact);
    logStep(log, "SponsoredFPC registered (salt=0).", {
        address: onChainInstance.address.toString(),
    });
    return onChainInstance.address;
}

export async function connectDarkForest(
    config: ClientConfig,
    log?: ClientLogFn
): Promise<DarkForestClient> {
    if (!config.nodeUrl) {
        throw new Error("Missing Aztec node URL.");
    }

    logStep(log, "Connecting to Aztec node...", { nodeUrl: config.nodeUrl });
    const node = createAztecNodeClient(config.nodeUrl);
    await waitForNode(node);
    logStep(log, "Aztec node ready.");

    const wallet = await TestWallet.create(node, {
        proverEnabled: config.proverEnabled ?? false,
    });
    logStep(log, "Wallet ready.", { proverEnabled: config.proverEnabled ?? false });

    const account = await resolveAccount(wallet, config.account, log);

    const darkforestArtifactJson = await resolveArtifactJson(
        darkforestArtifactImport,
        "DarkForest"
    );
    const darkforestArtifact = loadContractArtifact(darkforestArtifactJson);
    const darkforestAddress = parseAddress(config.darkforestAddress, "DarkForest");
    const darkforest = await registerContractInstance(
        wallet,
        node,
        darkforestAddress,
        darkforestArtifact,
        "DarkForest",
        log
    );

    const storageSlots = getStorageSlots(darkforestArtifactJson, "DarkForest");
    logStep(log, "Reading DarkForest config from public storage...");
    const gameConfig = await readGameConfig(node, darkforestAddress, storageSlots);
    logStep(log, "Loaded DarkForest config.", {
        worldRadius: gameConfig.worldRadius.toString(),
        maxLocationId: gameConfig.maxLocationId.toString(),
    });

    const perlinConfig: PerlinConfig = {
        planethashKey: gameConfig.planethashKey,
        spacetypeKey: gameConfig.spacetypeKey,
        perlinLengthScale: gameConfig.perlinLengthScale,
        perlinMirrorX: gameConfig.perlinMirrorX,
        perlinMirrorY: gameConfig.perlinMirrorY,
    };

    let nft: Contract | undefined;
    let nftStorageSlots: StorageSlots | undefined;
    if (config.nftAddress) {
        const nftArtifactJson = await resolveArtifactJson(nftArtifactImport, "NFT");
        const nftArtifact = loadContractArtifact(nftArtifactJson);
        const nftAddress = parseAddress(config.nftAddress, "NFT");
        nft = await registerContractInstance(
            wallet,
            node,
            nftAddress,
            nftArtifact,
            "NFT",
            log
        );
        nftStorageSlots = getStorageSlots(nftArtifactJson, "NFT");
    }

    let sponsoredFee: SponsoredFeePaymentMethod | undefined;
    const sponsoredAddress = await resolveSponsoredFpc(
        wallet,
        node,
        config.sponsoredFpcAddress,
        log
    );
    if (sponsoredAddress) {
        sponsoredFee = new SponsoredFeePaymentMethod(sponsoredAddress);
        logStep(log, "Sponsored fees enabled.");
    } else {
        logStep(log, "Sponsored fees disabled.");
    }

    const sendOptions = sponsoredFee
        ? { from: account.address, fee: { paymentMethod: sponsoredFee } }
        : { from: account.address };

    return {
        node,
        wallet,
        account,
        darkforest,
        darkforestAddress,
        nft,
        nftAddress: config.nftAddress ? AztecAddress.fromString(config.nftAddress) : undefined,
        nftStorageSlots,
        perlinConfig,
        gameConfig,
        storageSlots,
        sponsoredFee,
        initPlayer: (x, y, radius) =>
            darkforest.methods
                .init_player(...buildInitPlayerArgs(x, y, radius, perlinConfig, gameConfig))
                .send(sendOptions),
        revealLocation: (x, y) =>
            darkforest.methods
                .reveal_location(...buildRevealLocationArgs(x, y, perlinConfig, gameConfig))
                .send(sendOptions),
        move: (
            x1,
            y1,
            x2,
            y2,
            radius,
            distMax,
            popMoved,
            silverMoved,
            movedArtifactId,
            abandoning
        ) =>
            darkforest.methods
                .move(
                    x1,
                    y1,
                    x2,
                    y2,
                    radius,
                    distMax,
                    popMoved,
                    silverMoved,
                    movedArtifactId,
                    abandoning,
                    perlinConfig.planethashKey,
                    perlinConfig.spacetypeKey,
                    perlinConfig.perlinLengthScale,
                    perlinConfig.perlinMirrorX,
                    perlinConfig.perlinMirrorY,
                    gameConfig.configHashSpacetype,
                    gameConfig.maxLocationId,
                    gameConfig.worldRadius
                )
                .send(sendOptions),
        upgradePlanet: (locationId, branch) =>
            darkforest.methods.upgrade_planet(locationId, branch).send(sendOptions),
        prospectPlanet: (locationId) =>
            darkforest.methods.prospect_planet(locationId).send(sendOptions),
        findArtifact: (x, y, biomebase) =>
            darkforest.methods
                .find_artifact(...buildFindArtifactArgs(x, y, biomebase, perlinConfig, gameConfig))
                .send(sendOptions),
        tradeArtifact: (locationId, artifactId, withdrawing) =>
            darkforest.methods.trade_artifact(locationId, artifactId, withdrawing).send(sendOptions),
        setArtifactActivation: (locationId, artifactId, wormholeTo, activate) =>
            darkforest.methods
                .set_artifact_activation(locationId, artifactId, wormholeTo, activate)
                .send(sendOptions),
        giveSpaceShips: (locationId) =>
            darkforest.methods.give_space_ships(locationId).send(sendOptions),
        stop: () => wallet.stop(),
    };
}
