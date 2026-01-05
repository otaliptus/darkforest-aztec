import type { PerlinConfig } from "./scripts/types";

const env = process.env;

const getEnv = (primary: string, fallback?: string) => {
    const direct = env[primary];
    if (direct !== undefined && direct !== "") return direct;
    const legacy = env[`VITE_${primary}`];
    if (legacy !== undefined && legacy !== "") return legacy;
    return fallback;
};

const toBool = (value: string | undefined, fallback: boolean) => {
    if (value === undefined) return fallback;
    return value === "true" || value === "1";
};

const toBigInt = (value: string | undefined, fallback: string) => {
    return BigInt(value ?? fallback);
};

export type ClientAccountConfig = {
    secret?: string;
    salt?: string;
    signingKey?: string;
    testAccountIndex?: number;
};

export type ClientConfig = {
    nodeUrl: string;
    darkforestAddress: string;
    nftAddress?: string;
    sponsoredFpcAddress?: string;
    perlin: PerlinConfig;
    account?: ClientAccountConfig;
    proverEnabled?: boolean;
};

export const DEFAULT_PERLIN_CONFIG: PerlinConfig = {
    planethashKey: toBigInt(getEnv("PLANETHASH_KEY"), "42"),
    spacetypeKey: toBigInt(getEnv("SPACETYPE_KEY"), "43"),
    perlinLengthScale: toBigInt(getEnv("PERLIN_LENGTH_SCALE"), "1024"),
    perlinMirrorX: toBool(getEnv("PERLIN_MIRROR_X"), false),
    perlinMirrorY: toBool(getEnv("PERLIN_MIRROR_Y"), false),
};

export const DEFAULT_INIT = {
    x: getEnv("INIT_X", "990") ?? "990",
    y: getEnv("INIT_Y", "0") ?? "0",
    radius: getEnv("INIT_RADIUS", "1000") ?? "1000",
};

export const DEFAULT_REVEAL = {
    x: getEnv("REVEAL_X", "123") ?? "123",
    y: getEnv("REVEAL_Y", "456") ?? "456",
};

export const CLIENT_CONFIG: ClientConfig = {
    nodeUrl: getEnv("AZTEC_NODE_URL", "http://localhost:8080") ?? "http://localhost:8080",
    darkforestAddress: getEnv("DARKFOREST_ADDRESS", "") ?? "",
    nftAddress: getEnv("NFT_ADDRESS"),
    sponsoredFpcAddress: getEnv("SPONSORED_FPC_ADDRESS"),
    perlin: DEFAULT_PERLIN_CONFIG,
    account: {
        secret: getEnv("ACCOUNT_SECRET"),
        salt: getEnv("ACCOUNT_SALT"),
        signingKey: getEnv("ACCOUNT_SIGNING_KEY"),
        testAccountIndex: getEnv("ACCOUNT_INDEX")
            ? Number(getEnv("ACCOUNT_INDEX"))
            : undefined,
    },
    proverEnabled: toBool(getEnv("PROVER_ENABLED"), false),
};

export const VERBOSE_LOGGING = toBool(getEnv("DF_VERBOSE_LOGS"), false);

// The local Aztec devnet ships with 3 pre-funded test accounts (indices 0-2).
export const MAX_TEST_ACCOUNTS = 3;
