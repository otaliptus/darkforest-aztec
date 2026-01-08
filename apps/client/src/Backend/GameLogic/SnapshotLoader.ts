import { AztecAddress } from '@aztec/aztec.js/addresses';
import type {
  Artifact,
  ArtifactId,
  LocationId,
  Planet,
  Player,
  QueuedArrival,
  RevealedCoords as DFRevealedCoords,
  VoyageId,
} from '@darkforest_eth/types';
import type {
  ArtifactState,
  ArrivalState,
  PlanetArtifactState,
  PlanetArtifactsState,
  PlanetState,
  PlayerState,
  RevealedCoords,
} from '../Aztec/scripts/types';
import {
  mapArrival,
  mapArtifact,
  mapPlanet,
  mapPlayer,
  mapRevealedCoords,
  toLocationId,
} from '../Aztec/typeAdapters';
import type { ContractsAPI } from './ContractsAPI';
import type { InitialGameState } from './InitialGameStateDownloader';

type SnapshotMeta = {
  format?: string;
  snapshotVersion?: number;
  contractAddress?: string;
  blockNumber?: number;
  createdAt?: string;
  worldRadius?: string | number;
  configHashSpacetype?: string;
  configHashBiome?: string;
};

type SnapshotPlayer = {
  address: string;
  player: PlayerState;
  claimedShips: string | number;
  spaceJunk: string | number;
  spaceJunkLimit: string | number;
  lastRevealTimestamp: number;
};

type SnapshotPlanet = {
  locationId: string;
  planet: PlanetState;
  artifactState: PlanetArtifactState;
  artifacts: PlanetArtifactsState;
  revealed?: RevealedCoords;
  destroyed: boolean;
  spaceJunk: string | number;
  lastUpdatedTimestamp: number;
};

type SnapshotArrival = {
  arrivalId: string;
  arrivalState: ArrivalState;
  departureTimestamp: number;
  arrivalTimestamp: number;
};

type SnapshotArtifact = {
  artifactId: string;
  artifact: ArtifactState;
  locationId: string;
  owner?: string;
  lastActivatedTimestamp: number;
  lastDeactivatedTimestamp: number;
};

type SnapshotData = {
  meta?: SnapshotMeta;
  players?: SnapshotPlayer[];
  touchedPlanetIds?: string[];
  revealedCoords?: RevealedCoords[];
  planets?: SnapshotPlanet[];
  arrivals?: SnapshotArrival[];
  artifacts?: SnapshotArtifact[];
};

export type SnapshotUpdate = {
  meta?: SnapshotMeta;
  signature?: string;
  touchedPlanetIds: LocationId[];
  revealedCoords: DFRevealedCoords[];
  revealedCoordsMap: Map<LocationId, DFRevealedCoords>;
  planets: Planet[];
  arrivals: QueuedArrival[];
  artifacts: Artifact[];
  players: Player[];
};

const toBigInt = (value?: string | number | bigint | null) => BigInt(value ?? 0);
const toNumber = (value?: string | number | bigint | null) => Number(value ?? 0);
const toBool = (value?: boolean | string | number | null) =>
  value === true || value === 'true' || value === 1 || value === '1';

const toAztecAddress = (value?: string | null) =>
  value ? AztecAddress.fromString(value) : AztecAddress.fromBigInt(0n);

const parsePlayerState = (raw: PlayerState): PlayerState => ({
  isInitialized: toBool(raw?.isInitialized),
  homePlanet: toBigInt((raw as any)?.homePlanet),
  lastRevealBlock: toNumber((raw as any)?.lastRevealBlock),
});

const parsePlanetState = (raw: PlanetState): PlanetState => ({
  isInitialized: toBool(raw?.isInitialized),
  owner: toAztecAddress((raw as any)?.owner),
  perlin: toBigInt((raw as any)?.perlin),
  population: toBigInt((raw as any)?.population),
  populationCap: toBigInt((raw as any)?.populationCap),
  populationGrowth: toBigInt((raw as any)?.populationGrowth),
  silver: toBigInt((raw as any)?.silver),
  silverCap: toBigInt((raw as any)?.silverCap),
  silverGrowth: toBigInt((raw as any)?.silverGrowth),
  range: toBigInt((raw as any)?.range),
  speed: toBigInt((raw as any)?.speed),
  defense: toBigInt((raw as any)?.defense),
  lastUpdated: toNumber((raw as any)?.lastUpdated),
  planetLevel: toNumber((raw as any)?.planetLevel),
  planetType: toNumber((raw as any)?.planetType),
  spaceType: toNumber((raw as any)?.spaceType),
  isHomePlanet: toBool((raw as any)?.isHomePlanet),
  upgradeState0: toNumber((raw as any)?.upgradeState0),
  upgradeState1: toNumber((raw as any)?.upgradeState1),
  upgradeState2: toNumber((raw as any)?.upgradeState2),
});

const parsePlanetArtifactState = (raw: PlanetArtifactState): PlanetArtifactState => ({
  hasTriedFindingArtifact: toBool((raw as any)?.hasTriedFindingArtifact),
  prospectedBlockNumber: toNumber((raw as any)?.prospectedBlockNumber),
});

const parsePlanetArtifacts = (raw: PlanetArtifactsState): PlanetArtifactsState => ({
  ids: Array.isArray((raw as any)?.ids)
    ? (raw as any).ids.map((id: string | number | bigint) => toBigInt(id))
    : [],
});

const parseRevealedCoords = (raw?: RevealedCoords): RevealedCoords => ({
  locationId: toBigInt((raw as any)?.locationId),
  x: toBigInt((raw as any)?.x),
  y: toBigInt((raw as any)?.y),
  revealer: toAztecAddress((raw as any)?.revealer),
});

const parseArtifactState = (raw: ArtifactState): ArtifactState => ({
  isInitialized: toBool((raw as any)?.isInitialized),
  id: toBigInt((raw as any)?.id),
  planetDiscoveredOn: toBigInt((raw as any)?.planetDiscoveredOn),
  rarity: toNumber((raw as any)?.rarity),
  planetBiome: toNumber((raw as any)?.planetBiome),
  discoverer: toAztecAddress((raw as any)?.discoverer),
  artifactType: toNumber((raw as any)?.artifactType),
  activations: toNumber((raw as any)?.activations),
  lastActivated: toNumber((raw as any)?.lastActivated),
  lastDeactivated: toNumber((raw as any)?.lastDeactivated),
  wormholeTo: toBigInt((raw as any)?.wormholeTo),
  burned: toBool((raw as any)?.burned),
});

const parseArrivalState = (raw: ArrivalState): ArrivalState => ({
  player: toAztecAddress((raw as any)?.player),
  fromPlanet: toBigInt((raw as any)?.fromPlanet),
  toPlanet: toBigInt((raw as any)?.toPlanet),
  popSilver: toBigInt((raw as any)?.popSilver),
  meta: toBigInt((raw as any)?.meta),
  carriedArtifactId: toBigInt((raw as any)?.carriedArtifactId),
  popArriving: toBigInt((raw as any)?.popArriving),
  silverMoved: toBigInt((raw as any)?.silverMoved),
  departureBlock: toNumber((raw as any)?.departureBlock),
  arrivalBlock: toNumber((raw as any)?.arrivalBlock),
  arrivalType: toNumber((raw as any)?.arrivalType),
  distance: toBigInt((raw as any)?.distance),
});

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const run = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(workers);
  return results;
};

const fetchSnapshotPayload = async (snapshotUrl: string): Promise<SnapshotData | undefined> => {
  try {
    const response = await fetch(snapshotUrl, { cache: 'no-store' });
    if (!response.ok) return undefined;
    return (await response.json()) as SnapshotData;
  } catch {
    return undefined;
  }
};

const isSnapshotCompatible = (payload: SnapshotData | undefined, contractsAPI: ContractsAPI) => {
  if (!payload?.meta || payload.meta.format !== 'df-aztec-snapshot') return false;
  if (payload.meta.snapshotVersion && payload.meta.snapshotVersion !== 1) return false;
  const contractAddress = contractsAPI.contractAddress?.toLowerCase();
  const snapshotContract = payload.meta.contractAddress?.toLowerCase();
  if (contractAddress && snapshotContract && contractAddress !== snapshotContract) {
    return false;
  }
  return true;
};

export const loadSnapshotUpdate = async (
  contractsAPI: ContractsAPI,
  snapshotUrl = process.env.DF_SNAPSHOT_URL
): Promise<SnapshotUpdate | undefined> => {
  if (!snapshotUrl) return undefined;
  const payload = await fetchSnapshotPayload(snapshotUrl);
  if (!isSnapshotCompatible(payload, contractsAPI)) return undefined;

  const contractConstants = await contractsAPI.getConstants();
  const onChainConfig = contractsAPI.getOnChainConfig();
  const burnedLocationId = contractsAPI.getBurnedLocationId();
  const contractAztecAddress = contractsAPI.getContractAztecAddress();

  const revealedCoords = (payload.revealedCoords ?? []).map(parseRevealedCoords);
  const allRevealedCoords = revealedCoords
    .map(mapRevealedCoords)
    .filter((coord): coord is DFRevealedCoords => !!coord);
  const revealedCoordsMap = new Map<LocationId, DFRevealedCoords>();
  for (const coord of allRevealedCoords) revealedCoordsMap.set(coord.hash, coord);

  const touchedPlanetIds = (payload.touchedPlanetIds ?? []).map((id) => toLocationId(toBigInt(id)));

  const planetsRaw = payload.planets ?? [];
  const planets = await mapWithConcurrency(
    planetsRaw,
    8,
    async (entry) => {
      const locationId = toBigInt(entry.locationId);
      const planetState = parsePlanetState(entry.planet);
      const artifactState = parsePlanetArtifactState(entry.artifactState);
      const artifacts = parsePlanetArtifacts(entry.artifacts);
      const revealed = mapRevealedCoords(parseRevealedCoords(entry.revealed));
      const lastUpdatedTimestamp = toNumber(entry.lastUpdatedTimestamp);
      return mapPlanet({
        locationId,
        planetState,
        artifactState,
        artifacts,
        revealed,
        destroyed: toBool(entry.destroyed),
        spaceJunk: toBigInt(entry.spaceJunk),
        lastUpdatedTimestamp,
        contractConstants,
        onChainConfig,
      });
    }
  );

  const arrivalsRaw = payload.arrivals ?? [];
  const arrivals = await mapWithConcurrency(
    arrivalsRaw,
    8,
    async (entry) =>
      mapArrival({
        arrivalId: toBigInt(entry.arrivalId),
        arrivalState: parseArrivalState(entry.arrivalState),
        departureTimestamp: toNumber(entry.departureTimestamp),
        arrivalTimestamp: toNumber(entry.arrivalTimestamp),
      })
  );

  const artifactsRaw = payload.artifacts ?? [];
  const artifacts = await mapWithConcurrency(
    artifactsRaw,
    8,
    async (entry) =>
      mapArtifact({
        artifactState: parseArtifactState(entry.artifact),
        locationId: toBigInt(entry.locationId),
        owner: entry.owner ? AztecAddress.fromString(entry.owner) : undefined,
        lastActivatedTimestamp: toNumber(entry.lastActivatedTimestamp),
        lastDeactivatedTimestamp: toNumber(entry.lastDeactivatedTimestamp),
        contractAddress: contractAztecAddress,
        burnedLocationId,
      })
  );

  const players: Player[] = [];
  const playersRaw = payload.players ?? [];
  for (const entry of playersRaw) {
    const address = entry.address;
    const playerState = parsePlayerState(entry.player);
    if (!playerState.isInitialized) continue;
    const player = mapPlayer(
      AztecAddress.fromString(address),
      playerState,
      toBigInt(entry.claimedShips),
      toBigInt(entry.spaceJunk),
      toBigInt(entry.spaceJunkLimit),
      toNumber(entry.lastRevealTimestamp)
    );
    players.push(player);
  }

  return {
    meta: payload?.meta,
    touchedPlanetIds,
    revealedCoords: allRevealedCoords,
    revealedCoordsMap,
    planets,
    arrivals,
    artifacts,
    players,
  };
};

export const tryLoadSnapshot = async (
  contractsAPI: ContractsAPI
): Promise<InitialGameState | undefined> => {
  const snapshotUrl = process.env.DF_SNAPSHOT_URL;
  if (!snapshotUrl) return undefined;

  const update = await loadSnapshotUpdate(contractsAPI, snapshotUrl);
  if (!update) return undefined;

  const contractConstants = await contractsAPI.getConstants();
  const worldRadius = await contractsAPI.getWorldRadius();

  const allRevealedCoords = update.revealedCoords;
  const revealedCoordsMap = update.revealedCoordsMap;
  const touchedPlanetIds = update.touchedPlanetIds;

  const planetMap = new Map<LocationId, Planet>();
  const loadedPlanets: LocationId[] = [];
  for (const planet of update.planets) {
    planetMap.set(planet.locationId, planet);
    loadedPlanets.push(planet.locationId);
  }

  const pendingMoves = update.arrivals;

  const arrivals = new Map<VoyageId, QueuedArrival>();
  const planetVoyageIdMap = new Map<LocationId, VoyageId[]>();
  for (const arrival of pendingMoves) {
    arrivals.set(arrival.eventId, arrival);
    const list = planetVoyageIdMap.get(arrival.toPlanet) ?? [];
    list.push(arrival.eventId);
    planetVoyageIdMap.set(arrival.toPlanet, list);
  }

  const artifacts = update.artifacts;

  const artifactMap = new Map<ArtifactId, Artifact>();
  for (const artifact of artifacts) {
    artifactMap.set(artifact.id, artifact);
  }

  const artifactsOnVoyages: Artifact[] = [];
  for (const arrival of pendingMoves) {
    if (arrival.artifactId) {
      const artifact = artifactMap.get(arrival.artifactId);
      if (artifact) artifactsOnVoyages.push(artifact);
    }
  }

  const heldArtifacts: Artifact[][] = loadedPlanets.map((planetId) => {
    const planet = planetMap.get(planetId);
    if (!planet) return [];
    return planet.heldArtifactIds
      .map((id) => artifactMap.get(id))
      .filter((artifact): artifact is Artifact => !!artifact);
  });

  const myAddress = contractsAPI.getAddress();
  const myArtifacts = myAddress
    ? artifacts.filter((artifact) => artifact.currentOwner === myAddress)
    : [];

  const players = new Map<string, Player>();
  for (const player of update.players) {
    players.set(player.address, player);
  }

  const paused = await contractsAPI.getIsPaused();

  return {
    contractConstants,
    players,
    worldRadius,
    allTouchedPlanetIds: touchedPlanetIds,
    allRevealedCoords,
    pendingMoves,
    touchedAndLocatedPlanets: planetMap,
    artifactsOnVoyages,
    myArtifacts,
    heldArtifacts,
    loadedPlanets,
    revealedCoordsMap,
    planetVoyageIdMap,
    arrivals,
    twitters: {},
    paused,
  };
};

const parseOptionalNumber = (value: string | null | undefined, fallback: number) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const parseOptionalBool = (value: string | null | undefined): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = value.toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
};

const getSnapshotSignatureFromMeta = (meta?: SnapshotMeta) => {
  if (!meta) return undefined;
  const blockPart = meta.blockNumber ?? '';
  const timePart = meta.createdAt ?? '';
  const signature = `${blockPart}-${timePart}`.trim();
  return signature !== '-' ? signature : undefined;
};

const fetchSnapshotSignature = async (snapshotUrl: string): Promise<string | undefined> => {
  try {
    const head = await fetch(snapshotUrl, { method: 'HEAD', cache: 'no-store' });
    if (head.ok) {
      const etag = head.headers.get('etag');
      if (etag) return etag;
      const lastModified = head.headers.get('last-modified');
      if (lastModified) return lastModified;
    }
  } catch {
    // Fall back to GET below.
  }

  try {
    const response = await fetch(snapshotUrl, { cache: 'no-store' });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as SnapshotData;
    if (!payload?.meta || payload.meta.format !== 'df-aztec-snapshot') return undefined;
    return getSnapshotSignatureFromMeta(payload.meta);
  } catch {
    return undefined;
  }
};

export const startSnapshotLiveUpdates = (
  contractsAPI: ContractsAPI,
  onUpdate: (update: SnapshotUpdate) => void,
  snapshotUrl = process.env.DF_SNAPSHOT_URL
): (() => void) | undefined => {
  if (!snapshotUrl) return undefined;
  if (typeof window === 'undefined') return undefined;

  const enabled = parseOptionalBool(process.env.DF_SNAPSHOT_AUTO_REFRESH);
  if (enabled === false) return undefined;
  if (enabled === undefined && process.env.NODE_ENV === 'production') return undefined;

  const pollMs = parseOptionalNumber(process.env.DF_SNAPSHOT_POLL_MS, 5000);
  const minIntervalMs = parseOptionalNumber(process.env.DF_SNAPSHOT_MIN_INTERVAL_MS, 15000);

  let lastSignature: string | undefined;
  let lastAppliedAt = 0;
  let inFlight = false;

  const tick = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const signature = await fetchSnapshotSignature(snapshotUrl);
      if (!signature) return;
      if (!lastSignature) {
        lastSignature = signature;
        return;
      }
      if (signature !== lastSignature && Date.now() - lastAppliedAt >= minIntervalMs) {
        const update = await loadSnapshotUpdate(contractsAPI, snapshotUrl);
        if (!update) return;
        await onUpdate(update);
        lastSignature = signature;
        lastAppliedAt = Date.now();
        console.info('Snapshot update applied.');
      }
    } finally {
      inFlight = false;
    }
  };

  const intervalId = window.setInterval(() => {
    void tick();
  }, pollMs);

  void tick();

  return () => {
    window.clearInterval(intervalId);
  };
};
