import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Fr } from "@aztec/aztec.js/fields";
import type { AztecNode } from "@aztec/stdlib/interfaces/aztec-node";
import {
    readPublicMapField,
    readPublicMapFields,
    readPublicField,
    requireSlot,
    type StorageSlots,
} from "./storage";
import type {
    ArrivalState,
    ArtifactState,
    PlanetArrivalsState,
    PlanetArtifactsState,
    PlanetArtifactState,
    PlanetState,
    PlayerState,
    RevealedCoords,
} from "./types";

const toBool = (value: bigint) => value === 1n;
const toU8 = (value: bigint) => Number(value);
const toU32 = (value: bigint) => Number(value);

const fieldKey = (value: bigint) => new Fr(value);

const decodePlayer = (fields: bigint[]): PlayerState => ({
    isInitialized: toBool(fields[0] ?? 0n),
    homePlanet: fields[1] ?? 0n,
    lastRevealBlock: toU32(fields[2] ?? 0n),
});

const decodePlanet = (fields: bigint[]): PlanetState => ({
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

const decodePlanetArtifactState = (fields: bigint[]): PlanetArtifactState => ({
    hasTriedFindingArtifact: toBool(fields[0] ?? 0n),
    prospectedBlockNumber: toU32(fields[1] ?? 0n),
});

const decodePlanetArtifacts = (fields: bigint[]): PlanetArtifactsState => ({
    ids: fields.slice(0, 5).map((value) => value ?? 0n),
});

const decodeArtifact = (fields: bigint[]): ArtifactState => ({
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

const decodeRevealed = (fields: bigint[]): RevealedCoords => ({
    locationId: fields[0] ?? 0n,
    x: fields[1] ?? 0n,
    y: fields[2] ?? 0n,
    revealer: AztecAddress.fromBigInt(fields[3] ?? 0n),
});

const decodePlanetArrivals = (fields: bigint[]): PlanetArrivalsState => {
    const packedIds = fields.slice(0, 6).map((value) => value ?? 0n);
    const mask64 = (1n << 64n) - 1n;
    const ids: bigint[] = [];
    for (const pair of packedIds) {
        ids.push(pair & mask64);
        ids.push((pair >> 64n) & mask64);
    }
    return { packedIds, ids };
};

const decodeArrival = (fields: bigint[]): ArrivalState => {
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

export const readPlayerState = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    player: AztecAddress
) => {
    const slot = requireSlot(storageSlots, "players");
    const fields = await readPublicMapFields(node, contractAddress, slot, player, 3);
    return decodePlayer(fields);
};

export const readPlayerClaimedShips = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    player: AztecAddress
) =>
    readPublicMapField(
        node,
        contractAddress,
        requireSlot(storageSlots, "player_claimed_ships"),
        player
    );

export const readPlayerSpaceJunk = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    player: AztecAddress
) =>
    readPublicMapField(
        node,
        contractAddress,
        requireSlot(storageSlots, "player_space_junk"),
        player
    );

export const readPlayerSpaceJunkLimit = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    player: AztecAddress
) =>
    readPublicMapField(
        node,
        contractAddress,
        requireSlot(storageSlots, "player_space_junk_limit"),
        player
    );

export const readPlanetState = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    locationId: bigint
) => {
    const slot = requireSlot(storageSlots, "planets");
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        slot,
        fieldKey(locationId),
        20
    );
    return decodePlanet(fields);
};

export const readPlanetArtifactState = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    locationId: bigint
) => {
    const slot = requireSlot(storageSlots, "planet_artifact_state");
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        slot,
        fieldKey(locationId),
        2
    );
    return decodePlanetArtifactState(fields);
};

export const readPlanetArtifacts = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    locationId: bigint
) => {
    const slot = requireSlot(storageSlots, "planet_artifacts");
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        slot,
        fieldKey(locationId),
        5
    );
    return decodePlanetArtifacts(fields);
};

export const readPlanetDestroyed = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    locationId: bigint
) => {
    const slot = requireSlot(storageSlots, "planet_destroyed");
    const value = await readPublicMapField(
        node,
        contractAddress,
        slot,
        fieldKey(locationId)
    );
    return toBool(value);
};

export const readPlanetSpaceJunk = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    locationId: bigint
) =>
    readPublicMapField(
        node,
        contractAddress,
        requireSlot(storageSlots, "planet_space_junk"),
        fieldKey(locationId)
    );

export const readPlanetArrivals = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    locationId: bigint
) => {
    const slot = requireSlot(storageSlots, "planet_arrivals");
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        slot,
        fieldKey(locationId),
        6
    );
    return decodePlanetArrivals(fields);
};

export const readArrivalState = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    arrivalId: bigint
) => {
    const slot = requireSlot(storageSlots, "arrivals");
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        slot,
        fieldKey(arrivalId),
        6
    );
    return decodeArrival(fields);
};

export const readRevealedCoords = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    locationId: bigint
) => {
    const slot = requireSlot(storageSlots, "revealed");
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        slot,
        fieldKey(locationId),
        4
    );
    return decodeRevealed(fields);
};

export const readArtifactState = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    artifactId: bigint
) => {
    const slot = requireSlot(storageSlots, "artifacts");
    const fields = await readPublicMapFields(
        node,
        contractAddress,
        slot,
        fieldKey(artifactId),
        12
    );
    return decodeArtifact(fields);
};

export const readArtifactLocation = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    artifactId: bigint
) =>
    readPublicMapField(
        node,
        contractAddress,
        requireSlot(storageSlots, "artifact_locations"),
        fieldKey(artifactId)
    );

export const readNftOwner = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    tokenId: bigint
) =>
    readPublicMapField(
        node,
        contractAddress,
        requireSlot(storageSlots, "public_owners"),
        fieldKey(tokenId)
    ).then((value) => AztecAddress.fromBigInt(value));

export const readPlayerBundle = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    player: AztecAddress
) => {
    const [playerState, claimedShips, spaceJunk, spaceJunkLimit] = await Promise.all([
        readPlayerState(node, contractAddress, storageSlots, player),
        readPlayerClaimedShips(node, contractAddress, storageSlots, player),
        readPlayerSpaceJunk(node, contractAddress, storageSlots, player),
        readPlayerSpaceJunkLimit(node, contractAddress, storageSlots, player),
    ]);

    return {
        player: playerState,
        claimedShips,
        spaceJunk,
        spaceJunkLimit,
    };
};

export const readLocationBundle = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    locationId: bigint
) => {
    const [planet, artifacts, artifactState, revealed, destroyed, spaceJunk, arrivals] =
        await Promise.all([
            readPlanetState(node, contractAddress, storageSlots, locationId),
            readPlanetArtifacts(node, contractAddress, storageSlots, locationId),
            readPlanetArtifactState(node, contractAddress, storageSlots, locationId),
            readRevealedCoords(node, contractAddress, storageSlots, locationId),
            readPlanetDestroyed(node, contractAddress, storageSlots, locationId),
            readPlanetSpaceJunk(node, contractAddress, storageSlots, locationId),
            readPlanetArrivals(node, contractAddress, storageSlots, locationId),
        ]);

    return {
        planet,
        artifacts,
        artifactState,
        revealed,
        destroyed,
        spaceJunk,
        arrivals,
    };
};

export const readArtifactBundle = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    artifactId: bigint,
    nftAddress?: AztecAddress,
    nftSlots?: StorageSlots
) => {
    const [artifact, locationId] = await Promise.all([
        readArtifactState(node, contractAddress, storageSlots, artifactId),
        readArtifactLocation(node, contractAddress, storageSlots, artifactId),
    ]);

    let owner: AztecAddress | undefined;
    if (nftAddress && nftSlots) {
        owner = await readNftOwner(node, nftAddress, nftSlots, artifactId);
    }

    return {
        artifact,
        locationId,
        owner,
    };
};

export const readTouchedPlanetIdsCount = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
) => {
    const slot = requireSlot(storageSlots, "touched_planet_ids_count");
    return readPublicField(node, contractAddress, slot);
};

export const readTouchedPlanetIdAt = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    index: bigint,
) => {
    const slot = requireSlot(storageSlots, "touched_planet_ids");
    return readPublicMapField(node, contractAddress, slot, fieldKey(index));
};

export const readTouchedPlanetIdsRange = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    start: bigint,
    count: number,
) => {
    const tasks = Array.from({ length: count }, (_, offset) =>
        readTouchedPlanetIdAt(node, contractAddress, storageSlots, start + BigInt(offset))
    );
    return Promise.all(tasks);
};

export const readRevealedCoordsCount = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
) => {
    const slot = requireSlot(storageSlots, "revealed_coords_count");
    return readPublicField(node, contractAddress, slot);
};

export const readRevealedCoordsAt = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    index: bigint,
) => {
    const slot = requireSlot(storageSlots, "revealed_coords");
    const fields = await readPublicMapFields(node, contractAddress, slot, fieldKey(index), 4);
    return decodeRevealed(fields);
};

export const readRevealedCoordsRange = async (
    node: AztecNode,
    contractAddress: AztecAddress,
    storageSlots: StorageSlots,
    start: bigint,
    count: number,
) => {
    const tasks = Array.from({ length: count }, (_, offset) =>
        readRevealedCoordsAt(node, contractAddress, storageSlots, start + BigInt(offset))
    );
    return Promise.all(tasks);
};
