export type PerlinConfig = {
    planethashKey: bigint;
    spacetypeKey: bigint;
    perlinLengthScale: bigint;
    perlinMirrorX: boolean;
    perlinMirrorY: boolean;
};

export type DarkForestContract = {
    methods: {
        init_player: (...args: unknown[]) => { send: (opts?: unknown) => Promise<unknown> };
        reveal_location: (...args: unknown[]) => { send: (opts?: unknown) => Promise<unknown> };
    };
};

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

export async function initPlayer(
    contract: DarkForestContract,
    x: bigint,
    y: bigint,
    radius: bigint,
    config: PerlinConfig,
    opts?: unknown
) {
    return contract.methods.init_player(...buildInitPlayerArgs(x, y, radius, config)).send(opts);
}

export async function revealLocation(
    contract: DarkForestContract,
    x: bigint,
    y: bigint,
    config: PerlinConfig,
    opts?: unknown
) {
    return contract.methods.reveal_location(...buildRevealLocationArgs(x, y, config)).send(opts);
}
