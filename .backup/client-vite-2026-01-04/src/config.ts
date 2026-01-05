import type { PerlinConfig } from "./scripts/types";

const env = import.meta.env;

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
    planethashKey: toBigInt(env.VITE_PLANETHASH_KEY, "42"),
    spacetypeKey: toBigInt(env.VITE_SPACETYPE_KEY, "43"),
    perlinLengthScale: toBigInt(env.VITE_PERLIN_LENGTH_SCALE, "1024"),
    perlinMirrorX: toBool(env.VITE_PERLIN_MIRROR_X, false),
    perlinMirrorY: toBool(env.VITE_PERLIN_MIRROR_Y, false),
};

export const DEFAULT_INIT = {
    x: env.VITE_INIT_X ?? "990",
    y: env.VITE_INIT_Y ?? "0",
    radius: env.VITE_INIT_RADIUS ?? "1000",
};

export const DEFAULT_REVEAL = {
    x: env.VITE_REVEAL_X ?? "123",
    y: env.VITE_REVEAL_Y ?? "456",
};

export const CLIENT_CONFIG: ClientConfig = {
    nodeUrl: env.VITE_AZTEC_NODE_URL ?? "http://localhost:8080",
    darkforestAddress: env.VITE_DARKFOREST_ADDRESS ?? "",
    nftAddress: env.VITE_NFT_ADDRESS,
    sponsoredFpcAddress: env.VITE_SPONSORED_FPC_ADDRESS,
    perlin: DEFAULT_PERLIN_CONFIG,
    account: {
        secret: env.VITE_ACCOUNT_SECRET,
        salt: env.VITE_ACCOUNT_SALT,
        signingKey: env.VITE_ACCOUNT_SIGNING_KEY,
        testAccountIndex: env.VITE_ACCOUNT_INDEX ? Number(env.VITE_ACCOUNT_INDEX) : undefined,
    },
    proverEnabled: toBool(env.VITE_PROVER_ENABLED, false),
};
