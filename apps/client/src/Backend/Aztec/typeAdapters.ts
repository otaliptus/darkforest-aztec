import { EMPTY_ADDRESS } from '@darkforest_eth/constants';
import {
  artifactIdFromDecStr,
  locationIdFromDecStr,
} from '@darkforest_eth/serde';
import type {
  Artifact,
  ArtifactId,
  ArtifactRarity,
  ArtifactType,
  Biome,
  EthAddress,
  Planet,
  PlanetBonus,
  PlanetType,
  Player,
  RevealedCoords as DFRevealedCoords,
  SpaceType,
  Upgrade,
  UpgradeBranches,
  VoyageId,
  QueuedArrival,
  ArrivalType,
} from '@darkforest_eth/types';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type {
  ArtifactState,
  ArrivalState,
  PlanetArtifactState,
  PlanetArtifactsState,
  PlanetState,
  PlayerState,
  RevealedCoords,
} from './scripts/types';
import { fieldToSignedInt, multiScalePerlin } from './scripts/hashing';
import type { OnChainConfig } from './scripts/types';
import type { ContractConstants } from '../../_types/darkforest/api/ContractsAPITypes';

const ZERO_ADDRESS_REGEX = /^0x0+$/;

const toNumber = (value: bigint | number) => Number(value);

export const toEthAddress = (address: AztecAddress | string): EthAddress => {
  const raw = typeof address === 'string' ? address.toLowerCase() : address.toString().toLowerCase();
  if (ZERO_ADDRESS_REGEX.test(raw)) {
    return EMPTY_ADDRESS as EthAddress;
  }
  return raw as EthAddress;
};

export const toLocationId = (value: bigint): string => locationIdFromDecStr(value.toString());
export const toArtifactId = (value: bigint): ArtifactId => artifactIdFromDecStr(value.toString());

export const buildDefaultUpgrade = (): Upgrade => ({
  energyCapMultiplier: 100,
  energyGroMultiplier: 100,
  rangeMultiplier: 100,
  speedMultiplier: 100,
  defMultiplier: 100,
});

export const buildUpgrades = (): UpgradeBranches => {
  const defenseUpgrade: Upgrade = {
    energyCapMultiplier: 120,
    energyGroMultiplier: 120,
    rangeMultiplier: 100,
    speedMultiplier: 100,
    defMultiplier: 120,
  };
  const rangeUpgrade: Upgrade = {
    energyCapMultiplier: 120,
    energyGroMultiplier: 120,
    rangeMultiplier: 125,
    speedMultiplier: 100,
    defMultiplier: 100,
  };
  const speedUpgrade: Upgrade = {
    energyCapMultiplier: 120,
    energyGroMultiplier: 120,
    rangeMultiplier: 100,
    speedMultiplier: 175,
    defMultiplier: 100,
  };

  const toLevels = (upgrade: Upgrade): [Upgrade, Upgrade, Upgrade, Upgrade] => [
    { ...upgrade },
    { ...upgrade },
    { ...upgrade },
    { ...upgrade },
  ];

  return [toLevels(defenseUpgrade), toLevels(rangeUpgrade), toLevels(speedUpgrade)];
};

export const buildArtifactUpgrade = (artifactType: number, rarity: number): Upgrade => {
  const idx = Math.max(0, Math.min(rarity, 5));
  if (artifactType === 6) {
    const def = [100, 150, 200, 300, 450, 650];
    return {
      energyCapMultiplier: 100,
      energyGroMultiplier: 100,
      rangeMultiplier: 20,
      speedMultiplier: 20,
      defMultiplier: def[idx],
    };
  }
  if (artifactType === 7) {
    const def = [100, 50, 40, 30, 20, 10];
    return {
      energyCapMultiplier: 100,
      energyGroMultiplier: 100,
      rangeMultiplier: 100,
      speedMultiplier: 100,
      defMultiplier: def[idx],
    };
  }
  return buildDefaultUpgrade();
};

export const buildTimeDelayedUpgrade = (artifactType: number, rarity: number): Upgrade => {
  if (artifactType !== 7) {
    return buildDefaultUpgrade();
  }
  const idx = Math.max(0, Math.min(rarity, 5));
  const range = [100, 200, 200, 200, 200, 200];
  const speed = [100, 500, 1000, 1500, 2000, 2500];
  return {
    energyCapMultiplier: 100,
    energyGroMultiplier: 100,
    rangeMultiplier: range[idx],
    speedMultiplier: speed[idx],
    defMultiplier: 100,
  };
};

export const mapRevealedCoords = (revealed: RevealedCoords): DFRevealedCoords | undefined => {
  if (!revealed || revealed.locationId === 0n) return undefined;
  return {
    x: toNumber(fieldToSignedInt(revealed.x)),
    y: toNumber(fieldToSignedInt(revealed.y)),
    hash: toLocationId(revealed.locationId),
    revealer: toEthAddress(revealed.revealer),
  };
};

export const mapPlayer = (
  address: AztecAddress,
  state: PlayerState,
  claimedShips: bigint,
  spaceJunk: bigint,
  spaceJunkLimit: bigint,
  lastRevealTimestamp: number
): Player => ({
  address: toEthAddress(address),
  homePlanetId: toLocationId(state.homePlanet),
  initTimestamp: 0,
  lastRevealTimestamp,
  lastClaimTimestamp: 0,
  score: 0,
  spaceJunk: toNumber(spaceJunk),
  spaceJunkLimit: toNumber(spaceJunkLimit),
  claimedShips: claimedShips === 1n,
});

export const mapPlanet = async ({
  locationId,
  planetState,
  artifactState,
  artifacts,
  revealed,
  destroyed,
  spaceJunk,
  lastUpdatedTimestamp,
  contractConstants,
  onChainConfig,
}: {
  locationId: bigint;
  planetState: PlanetState;
  artifactState: PlanetArtifactState;
  artifacts: PlanetArtifactsState;
  revealed?: DFRevealedCoords;
  destroyed: boolean;
  spaceJunk: bigint;
  lastUpdatedTimestamp: number;
  contractConstants: ContractConstants;
  onChainConfig: OnChainConfig;
}): Promise<Planet> => {
  const bonus: PlanetBonus = [false, false, false, false, false, false];
  const upgradeState: [number, number, number] = [
    planetState.upgradeState0,
    planetState.upgradeState1,
    planetState.upgradeState2,
  ];

  const planet: Planet = {
    locationId: toLocationId(locationId),
    perlin: toNumber(planetState.perlin),
    spaceType: planetState.spaceType as SpaceType,
    owner: toEthAddress(planetState.owner),
    hatLevel: 0,
    planetLevel: planetState.planetLevel as number,
    planetType: planetState.planetType as PlanetType,
    isHomePlanet: planetState.isHomePlanet,
    energyCap: toNumber(planetState.populationCap),
    energyGrowth: toNumber(planetState.populationGrowth),
    silverCap: toNumber(planetState.silverCap),
    silverGrowth: toNumber(planetState.silverGrowth),
    range: toNumber(planetState.range),
    defense: toNumber(planetState.defense),
    speed: toNumber(planetState.speed),
    energy: toNumber(planetState.population),
    silver: toNumber(planetState.silver),
    spaceJunk: toNumber(spaceJunk),
    lastUpdated: lastUpdatedTimestamp,
    upgradeState,
    hasTriedFindingArtifact: artifactState.hasTriedFindingArtifact,
    heldArtifactIds: artifacts.ids.filter((id) => id !== 0n).map(toArtifactId),
    destroyed,
    prospectedBlockNumber: artifactState.prospectedBlockNumber || undefined,
    localPhotoidUpgrade: undefined,
    transactions: undefined,
    unconfirmedAddEmoji: false,
    unconfirmedClearEmoji: false,
    loadingServerState: false,
    needsServerRefresh: false,
    lastLoadedServerState: undefined,
    silverSpent: 0,
    isInContract: planetState.isInitialized,
    syncedWithContract: true,
    coordsRevealed: !!revealed,
    revealer: revealed?.revealer,
    claimer: undefined,
    messages: [],
    bonus,
    pausers: 0,
    invader: EMPTY_ADDRESS as EthAddress,
    capturer: EMPTY_ADDRESS as EthAddress,
    invadeStartBlock: undefined,
  };

  if (revealed) {
    const biomebase = multiScalePerlin(
      BigInt(revealed.x),
      BigInt(revealed.y),
      onChainConfig.biomebaseKey,
      onChainConfig.perlinLengthScale,
      onChainConfig.perlinMirrorX,
      onChainConfig.perlinMirrorY
    );
    const biomebaseNumber = toNumber(biomebase);
    (planet as any).location = {
      coords: { x: revealed.x, y: revealed.y },
      hash: revealed.hash,
      perlin: planet.perlin,
      biomebase: biomebaseNumber,
    };
    (planet as any).biome = (() => {
      if (planet.spaceType === 3) return 10 as Biome;
      let biome = 3 * planet.spaceType;
      if (biomebaseNumber < contractConstants.BIOME_THRESHOLD_1) biome += 1;
      else if (biomebaseNumber < contractConstants.BIOME_THRESHOLD_2) biome += 2;
      else biome += 3;
      return biome as Biome;
    })();
  }

  return planet;
};

export const mapArtifact = async ({
  artifactState,
  locationId,
  owner,
  lastActivatedTimestamp,
  lastDeactivatedTimestamp,
  contractAddress,
  burnedLocationId,
}: {
  artifactState: ArtifactState;
  locationId: bigint;
  owner?: AztecAddress;
  lastActivatedTimestamp: number;
  lastDeactivatedTimestamp: number;
  contractAddress: AztecAddress;
  burnedLocationId: bigint;
}): Promise<Artifact> => {
  const artifactId = toArtifactId(artifactState.id);
  const isBurned = artifactState.burned || (burnedLocationId !== 0n && locationId === burnedLocationId);
  const onPlanetId =
    isBurned || locationId === 0n ? undefined : toLocationId(locationId);
  const wormholeTo =
    artifactState.wormholeTo === 0n ? undefined : toLocationId(artifactState.wormholeTo);
  const currentOwner = isBurned
    ? (EMPTY_ADDRESS as EthAddress)
    : owner
      ? toEthAddress(owner)
      : toEthAddress(contractAddress);

  return {
    isInititalized: artifactState.isInitialized,
    id: artifactId,
    planetDiscoveredOn: toLocationId(artifactState.planetDiscoveredOn),
    rarity: artifactState.rarity as ArtifactRarity,
    planetBiome: artifactState.planetBiome as Biome,
    mintedAtTimestamp: 0,
    discoverer: toEthAddress(artifactState.discoverer),
    artifactType: artifactState.artifactType as ArtifactType,
    activations: artifactState.activations,
    lastActivated: lastActivatedTimestamp,
    lastDeactivated: lastDeactivatedTimestamp,
    controller: currentOwner,
    upgrade: buildArtifactUpgrade(artifactState.artifactType, artifactState.rarity),
    timeDelayedUpgrade: buildTimeDelayedUpgrade(artifactState.artifactType, artifactState.rarity),
    currentOwner,
    wormholeTo,
    onPlanetId,
    onVoyageId: undefined,
    transactions: undefined,
  };
};

export const mapArrival = async ({
  arrivalId,
  arrivalState,
  departureTimestamp,
  arrivalTimestamp,
}: {
  arrivalId: bigint;
  arrivalState: ArrivalState;
  departureTimestamp: number;
  arrivalTimestamp: number;
}): Promise<QueuedArrival> => {
  return {
    eventId: arrivalId.toString() as VoyageId,
    player: toEthAddress(arrivalState.player),
    fromPlanet: toLocationId(arrivalState.fromPlanet),
    toPlanet: toLocationId(arrivalState.toPlanet),
    energyArriving: toNumber(arrivalState.popArriving),
    silverMoved: toNumber(arrivalState.silverMoved),
    artifactId:
      arrivalState.carriedArtifactId === 0n
        ? undefined
        : toArtifactId(arrivalState.carriedArtifactId),
    departureTime: departureTimestamp,
    arrivalTime: arrivalTimestamp,
    distance: toNumber(arrivalState.distance),
    arrivalType: arrivalState.arrivalType as ArrivalType,
  };
};
