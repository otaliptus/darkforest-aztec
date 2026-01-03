import { createAztecNodeClient, waitForNode } from "@aztec/aztec.js/node";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { loadContractArtifact } from "@aztec/aztec.js/abi";
import { Contract, getContractInstanceFromInstantiationParams, type SentTx } from "@aztec/aztec.js/contracts";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import type { AccountManager } from "@aztec/aztec.js/wallet";
import { getInitialTestAccountsData } from "@aztec/accounts/testing/lazy";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { TestWallet } from "@aztec/test-wallet/client/lazy";
import type { NoirCompiledContract } from "@aztec/stdlib/noir";
import type { ClientAccountConfig, ClientConfig } from "../config";
import type { PerlinConfig } from "./types";

import darkforestArtifactJson from "../../../../packages/contracts/target/darkforest_contract-DarkForest.json";
import nftArtifactJson from "../../../../packages/contracts/darkforest_nft-NFT.json";

const SPONSORED_FPC_SALT = new Fr(0);

const DARKFOREST_ARTIFACT = loadContractArtifact(
    darkforestArtifactJson as unknown as NoirCompiledContract
);
const NFT_ARTIFACT = loadContractArtifact(nftArtifactJson as unknown as NoirCompiledContract);

export type DarkForestClient = {
    wallet: TestWallet;
    account: AccountManager;
    darkforest: Contract;
    nft?: Contract;
    perlinConfig: PerlinConfig;
    sponsoredFee?: SponsoredFeePaymentMethod;
    initPlayer: (x: bigint, y: bigint, radius: bigint) => Promise<SentTx>;
    revealLocation: (x: bigint, y: bigint) => Promise<SentTx>;
    stop: () => Promise<void> | void;
};

export type ClientLogFn = (message: string, data?: Record<string, unknown>) => void;

export function buildInitPlayerArgs(
    x: bigint,
    y: bigint,
    radius: bigint,
    config: PerlinConfig
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
    ] as const;
}

export function buildRevealLocationArgs(x: bigint, y: bigint, config: PerlinConfig) {
    return [
        x,
        y,
        config.planethashKey,
        config.spacetypeKey,
        config.perlinLengthScale,
        config.perlinMirrorX,
        config.perlinMirrorY,
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
    const account = accounts[index];
    if (!account) {
        throw new Error(`No initial test account at index ${index}.`);
    }
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
    artifact: typeof DARKFOREST_ARTIFACT,
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
    if (addressOverride) {
        const address = AztecAddress.fromString(addressOverride);
        const instance = await node.getContract(address);
        if (!instance) {
            logStep(log, "SponsoredFPC override not found on-chain. Disabling sponsored fees.", {
                address: address.toString(),
            });
            return undefined;
        }
        await wallet.registerContract(instance, SponsoredFPCContract.artifact);
        logStep(log, "SponsoredFPC registered (override).", {
            address: address.toString(),
        });
        return address;
    }

    const instance = await getContractInstanceFromInstantiationParams(
        SponsoredFPCContract.artifact,
        {
            salt: SPONSORED_FPC_SALT,
        }
    );
    const onChainInstance = await node.getContract(instance.address);
    if (!onChainInstance) {
        logStep(log, "SponsoredFPC not found on-chain (salt=0). Proceeding without sponsored fees.");
        return undefined;
    }
    await wallet.registerContract(onChainInstance, SponsoredFPCContract.artifact);
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

    const darkforestAddress = parseAddress(config.darkforestAddress, "DarkForest");
    const darkforest = await registerContractInstance(
        wallet,
        node,
        darkforestAddress,
        DARKFOREST_ARTIFACT,
        "DarkForest",
        log
    );

    let nft: Contract | undefined;
    if (config.nftAddress) {
        const nftAddress = parseAddress(config.nftAddress, "NFT");
        nft = await registerContractInstance(
            wallet,
            node,
            nftAddress,
            NFT_ARTIFACT,
            "NFT",
            log
        );
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
        wallet,
        account,
        darkforest,
        nft,
        perlinConfig: config.perlin,
        sponsoredFee,
        initPlayer: (x, y, radius) =>
            darkforest.methods
                .init_player(...buildInitPlayerArgs(x, y, radius, config.perlin))
                .send(sendOptions),
        revealLocation: (x, y) =>
            darkforest.methods
                .reveal_location(...buildRevealLocationArgs(x, y, config.perlin))
                .send(sendOptions),
        stop: () => wallet.stop(),
    };
}
