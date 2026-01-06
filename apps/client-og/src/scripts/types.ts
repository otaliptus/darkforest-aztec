import type { AztecAddress } from "@aztec/aztec.js/addresses";

export type PerlinConfig = {
    planethashKey: bigint;
    spacetypeKey: bigint;
    perlinLengthScale: bigint;
    perlinMirrorX: boolean;
    perlinMirrorY: boolean;
};

export type GameConfig = {
    planethashKey: bigint;
    spacetypeKey: bigint;
    biomebaseKey: bigint;
    perlinLengthScale: bigint;
    perlinMirrorX: boolean;
    perlinMirrorY: boolean;
    initPerlinMin: bigint;
    initPerlinMax: bigint;
    worldRadius: bigint;
    spawnRimArea: bigint;
    locationRevealCooldown: bigint;
    timeFactorHundredths: bigint;
    planetRarity: bigint;
    maxLocationId: bigint;
};

export type OnChainConfig = GameConfig & {
    configHashSpacetype: bigint;
    configHashBiome: bigint;
};

export type PlayerState = {
    isInitialized: boolean;
    homePlanet: bigint;
    lastRevealBlock: number;
};

export type PlanetState = {
    isInitialized: boolean;
    owner: AztecAddress;
    perlin: bigint;
    population: bigint;
    populationCap: bigint;
    populationGrowth: bigint;
    silver: bigint;
    silverCap: bigint;
    silverGrowth: bigint;
    range: bigint;
    speed: bigint;
    defense: bigint;
    lastUpdated: number;
    planetLevel: number;
    planetType: number;
    spaceType: number;
    isHomePlanet: boolean;
    upgradeState0: number;
    upgradeState1: number;
    upgradeState2: number;
};

export type PlanetArtifactState = {
    hasTriedFindingArtifact: boolean;
    prospectedBlockNumber: number;
};

export type PlanetArtifactsState = {
    ids: bigint[];
};

export type ArtifactState = {
    isInitialized: boolean;
    id: bigint;
    planetDiscoveredOn: bigint;
    rarity: number;
    planetBiome: number;
    discoverer: AztecAddress;
    artifactType: number;
    activations: number;
    lastActivated: number;
    lastDeactivated: number;
    wormholeTo: bigint;
};

export type RevealedCoords = {
    locationId: bigint;
    x: bigint;
    y: bigint;
    revealer: AztecAddress;
};

export type ArrivalState = {
    player: AztecAddress;
    fromPlanet: bigint;
    toPlanet: bigint;
    popSilver: bigint;
    meta: bigint;
    carriedArtifactId: bigint;
    popArriving: bigint;
    silverMoved: bigint;
    departureBlock: number;
    arrivalBlock: number;
    arrivalType: number;
    distance: bigint;
};

export type PlanetArrivalsState = {
    packedIds: bigint[];
    ids: bigint[];
};
