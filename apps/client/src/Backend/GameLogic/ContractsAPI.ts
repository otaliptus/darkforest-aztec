import type {
  Artifact,
  ArtifactId,
  ContractMethodName,
  DiagnosticUpdater,
  EthAddress,
  EthTxStatus,
  LocationId,
  Planet,
  Player,
  QueuedArrival,
  RevealedCoords,
  Transaction,
  TxIntent,
  UnconfirmedMove,
  VoyageId,
} from '@darkforest_eth/types';
import { EventEmitter } from 'events';
import type { Contract, providers } from 'ethers';
import { artifactIdFromDecStr, locationIdFromDecStr } from '@darkforest_eth/serde';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import {
  readArtifactBundle,
  readLocationBundle,
  readPlayerBundle,
  readPlanetArrivals,
  readArrivalState,
  readPlanetArtifactState,
  readPlanetArtifacts,
  readPlanetInitialized,
  readRevealedCoordsCount,
  readRevealedCoordsRange,
  readTouchedPlanetIdsCount,
  readTouchedPlanetIdsRange,
} from '../Aztec/scripts/chain';
import type { StorageSlots } from '../Aztec/scripts/storage';
import {
  FIELD_MODULUS,
  locationIdFromCoords,
  mimcSponge2_220,
  multiScalePerlin,
  toField,
} from '../Aztec/scripts/hashing';
import type { ArrivalState, OnChainConfig } from '../Aztec/scripts/types';
import { AztecConnection } from '../Aztec/AztecConnection';
import { VERBOSE_LOGGING } from '../Aztec/config';
import {
  ARTIFACT_POINT_VALUES,
  PLANET_DEFAULT_BARBARIAN_PERCENT,
  PLANET_DEFAULT_DEFENSE,
  PLANET_DEFAULT_POP_CAP,
  PLANET_DEFAULT_POP_GROWTH,
  PLANET_DEFAULT_RANGE,
  PLANET_DEFAULT_SILVER_CAP,
  PLANET_DEFAULT_SILVER_GROWTH,
  PLANET_DEFAULT_SPEED,
  PLANET_LEVEL_JUNK,
  PLANET_LEVEL_THRESHOLDS,
  PLANET_TYPE_WEIGHTS,
  ROUND_END_REWARDS_BY_RANK,
} from '../Aztec/constants';
import {
  buildUpgrades,
  mapArrival,
  mapArtifact,
  mapPlanet,
  mapPlayer,
  mapRevealedCoords,
  toLocationId,
} from '../Aztec/typeAdapters';
import { ContractsAPIEvent, ContractConstants } from '../../_types/darkforest/api/ContractsAPITypes';
import { detailedLogger } from '../Utils/DetailedLogger';

const toBigInt = (id: string) => BigInt(id.startsWith('0x') ? id : `0x${id}`);
const toFieldBigInt = (value: number | bigint) => toField(BigInt(value));
const INDEX_PAGE_SIZE = 200;
const UNKNOWN_HASH = 'unknown';
const READ_CONCURRENCY = 8;
const planetRarityFromMaxLocationId = (maxLocationId: bigint) => {
  if (maxLocationId <= 0n) return undefined;
  const computed = FIELD_MODULUS / maxLocationId;
  return computed < 1n ? 1n : computed;
};
const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  progress?: (fraction: number) => void
): Promise<R[]> => {
  if (items.length === 0) {
    progress?.(1);
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let completed = 0;

  const run = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      const result = await worker(items[index], index);
      results[index] = result;
      completed += 1;
      progress?.(Math.min(1, completed / items.length));
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(workers);
  return results;
};

type TxTimings = {
  createdAt: number;
  submittedAt?: number;
  confirmedAt?: number;
  proveMs?: number;
  sendMs?: number;
  submitMs?: number;
  confirmMs?: number;
  totalMs?: number;
};

const formatTxHash = (hash?: unknown) => {
  if (hash === undefined || hash === null) return undefined;
  if (typeof hash === 'string') return hash;
  if (typeof hash === 'bigint') return `0x${hash.toString(16)}`;
  const toString = (hash as { toString?: () => string })?.toString;
  if (typeof toString === 'function') {
    const value = toString.call(hash);
    if (value && value !== '[object Object]') return value;
  }
  return String(hash);
};

const deferred = <T>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const TxStatus = {
  Init: 'Init',
  Processing: 'Processing',
  Prioritized: 'Prioritized',
  Submit: 'Submit',
  Confirm: 'Confirm',
  Fail: 'Fail',
  Cancel: 'Cancel',
} as const;

const METHOD = {
  REVEAL_LOCATION: 'revealLocation',
  INIT: 'initializePlayer',
  MOVE: 'move',
  UPGRADE: 'upgradePlanet',
  FIND_ARTIFACT: 'findArtifact',
  PROSPECT_PLANET: 'prospectPlanet',
  DEPOSIT_ARTIFACT: 'depositArtifact',
  WITHDRAW_ARTIFACT: 'withdrawArtifact',
  ACTIVATE_ARTIFACT: 'activateArtifact',
  DEACTIVATE_ARTIFACT: 'deactivateArtifact',
  GET_SHIPS: 'giveSpaceShips',
} as const;

export class ContractsAPI extends EventEmitter {
  public readonly aztecConnection: AztecConnection;
  public readonly contract: Contract;
  public readonly contractAddress: EthAddress;

  private readonly onChainConfig: OnChainConfig;
  private readonly storageSlots: StorageSlots;
  private cachedConstants?: ContractConstants;
  private txId = 1;

  public readonly txExecutor = {
    waitForTransaction: (ser: { intent: TxIntent; hash: string }): Transaction => {
      const submitted = deferred<providers.TransactionResponse>();
      const confirmed = deferred<providers.TransactionReceipt>();
      const tx: Transaction = {
        id: this.nextTxId(),
        lastUpdatedAt: Date.now(),
        state: TxStatus.Init as EthTxStatus,
        intent: ser.intent,
        hash: ser.hash,
        submittedPromise: submitted.promise,
        confirmedPromise: confirmed.promise,
        onSubmissionError: submitted.reject,
        onReceiptError: confirmed.reject,
        onTransactionResponse: submitted.resolve,
        onTransactionReceipt: confirmed.resolve,
      };
      return tx;
    },
  };

  constructor({ connection, contractAddress }: { connection: AztecConnection; contractAddress: EthAddress }) {
    super();
    this.aztecConnection = connection;
    this.contractAddress = contractAddress;
    this.contract = (connection.getClient().darkforest as unknown) as Contract;
    this.onChainConfig = connection.getClient().gameConfig;
    this.storageSlots = connection.getClient().storageSlots;
  }

  private computeArtifactSeed(locationId: bigint, prospectedBlockNumber: number): bigint {
    if (prospectedBlockNumber <= 0) return 0n;
    const planethashKey = this.onChainConfig.planethashKey;
    const contractAddr = this.aztecConnection.getClient().darkforestAddress.toBigInt();
    const blockHash = mimcSponge2_220(BigInt(prospectedBlockNumber), 0n, planethashKey);
    const seed1 = mimcSponge2_220(locationId, contractAddr, planethashKey);
    return mimcSponge2_220(seed1, blockHash, planethashKey);
  }

  public destroy(): void {
    this.removeAllListeners();
  }

  public setDiagnosticUpdater(diagnosticUpdater?: DiagnosticUpdater): void {
    this.aztecConnection.setDiagnosticUpdater(diagnosticUpdater);
  }

  public setupEventListeners(): void {
    // Aztec contracts do not provide the same event stream; we rely on tx callbacks and polling.
  }

  public getContractAddress(): EthAddress {
    return this.contractAddress;
  }

  public async getConstants(): Promise<ContractConstants> {
    if (this.cachedConstants) return this.cachedConstants;

    const cfg = this.onChainConfig;
    const upgrades = buildUpgrades();
    const derivedRarity = planetRarityFromMaxLocationId(cfg.maxLocationId);
    const effectivePlanetRarity =
      derivedRarity && Number.isFinite(Number(derivedRarity))
        ? Number(derivedRarity)
        : Number(cfg.planetRarity);
    if (
      derivedRarity !== undefined &&
      derivedRarity !== cfg.planetRarity &&
      Number(cfg.planetRarity) !== effectivePlanetRarity
    ) {
      console.warn('[DF] planet_rarity mismatch; using max_location_id-derived rarity', {
        planetRarity: cfg.planetRarity.toString(),
        maxLocationId: cfg.maxLocationId.toString(),
        effectivePlanetRarity,
      });
    }

    const constants: ContractConstants = {
      WORLD_RADIUS_LOCKED: false,
      WORLD_RADIUS_MIN: 0,

      DISABLE_ZK_CHECKS: false,

      PLANETHASH_KEY: Number(cfg.planethashKey),
      SPACETYPE_KEY: Number(cfg.spacetypeKey),
      BIOMEBASE_KEY: Number(cfg.biomebaseKey),
      PERLIN_LENGTH_SCALE: Number(cfg.perlinLengthScale),
      PERLIN_MIRROR_X: cfg.perlinMirrorX,
      PERLIN_MIRROR_Y: cfg.perlinMirrorY,

      // Aztec contract does not currently track a mint end timestamp; treat as no end.
      TOKEN_MINT_END_SECONDS: Number.MAX_SAFE_INTEGER,
      MAX_NATURAL_PLANET_LEVEL: 9,
      TIME_FACTOR_HUNDREDTHS: Number(cfg.timeFactorHundredths),
      PERLIN_THRESHOLD_1: 14,
      PERLIN_THRESHOLD_2: 15,
      PERLIN_THRESHOLD_3: 19,
      INIT_PERLIN_MIN: Number(cfg.initPerlinMin),
      INIT_PERLIN_MAX: Number(cfg.initPerlinMax),
      BIOME_THRESHOLD_1: 15,
      BIOME_THRESHOLD_2: 17,
      SILVER_SCORE_VALUE: 100,
      PLANET_LEVEL_THRESHOLDS: PLANET_LEVEL_THRESHOLDS as ContractConstants['PLANET_LEVEL_THRESHOLDS'],
      PLANET_RARITY: effectivePlanetRarity,
      PLANET_TRANSFER_ENABLED: false,
      PLANET_TYPE_WEIGHTS: PLANET_TYPE_WEIGHTS as ContractConstants['PLANET_TYPE_WEIGHTS'],
      ARTIFACT_POINT_VALUES: ARTIFACT_POINT_VALUES as ContractConstants['ARTIFACT_POINT_VALUES'],
      SPACE_JUNK_ENABLED: true,
      SPACE_JUNK_LIMIT: 1000,
      PLANET_LEVEL_JUNK: PLANET_LEVEL_JUNK as ContractConstants['PLANET_LEVEL_JUNK'],
      ABANDON_SPEED_CHANGE_PERCENT: 150,
      ABANDON_RANGE_CHANGE_PERCENT: 150,
      PHOTOID_ACTIVATION_DELAY: 4,
      SPAWN_RIM_AREA: Number(cfg.spawnRimArea),
      LOCATION_REVEAL_COOLDOWN: Number(cfg.locationRevealCooldown),

      defaultPopulationCap: PLANET_DEFAULT_POP_CAP,
      defaultPopulationGrowth: PLANET_DEFAULT_POP_GROWTH,
      defaultSilverCap: PLANET_DEFAULT_SILVER_CAP,
      defaultSilverGrowth: PLANET_DEFAULT_SILVER_GROWTH,
      defaultRange: PLANET_DEFAULT_RANGE,
      defaultSpeed: PLANET_DEFAULT_SPEED,
      defaultDefense: PLANET_DEFAULT_DEFENSE,
      defaultBarbarianPercentage: PLANET_DEFAULT_BARBARIAN_PERCENT,

      planetCumulativeRarities: PLANET_LEVEL_THRESHOLDS,
      upgrades,
      GAME_START_BLOCK: 0,
      CAPTURE_ZONES_ENABLED: false,
      CAPTURE_ZONE_CHANGE_BLOCK_INTERVAL: 0,
      CAPTURE_ZONE_RADIUS: 0,
      CAPTURE_ZONE_PLANET_LEVEL_SCORE: PLANET_LEVEL_JUNK as ContractConstants['CAPTURE_ZONE_PLANET_LEVEL_SCORE'],
      CAPTURE_ZONE_HOLD_BLOCKS_REQUIRED: 0,
      CAPTURE_ZONES_PER_5000_WORLD_RADIUS: 0,
      SPACESHIPS: {
        GEAR: true,
        MOTHERSHIP: true,
        TITAN: true,
        CRESCENT: true,
        WHALE: true,
      },
      ROUND_END_REWARDS_BY_RANK: ROUND_END_REWARDS_BY_RANK,
    };

    this.cachedConstants = constants;
    return constants;
  }

  public getWorldRadius(): Promise<number> {
    return Promise.resolve(Number(this.onChainConfig.worldRadius));
  }

  public getOnChainConfig(): OnChainConfig {
    return this.onChainConfig;
  }

  public getBurnedLocationId(): bigint {
    return this.onChainConfig.maxLocationId;
  }

  public getContractAztecAddress(): AztecAddress {
    return this.aztecConnection.getClient().darkforestAddress;
  }

  public async getPlayers(progress?: (fraction: number) => void): Promise<Map<string, Player>> {
    const address = this.getAddress();
    if (!address) {
      progress?.(1);
      return new Map();
    }
    const player = await this.getPlayerById(address);
    const map = new Map<string, Player>();
    if (player) {
      map.set(address, player);
    }
    progress?.(1);
    return map;
  }

  public async getPlayerById(address: EthAddress): Promise<Player | undefined> {
    try {
      const target =
        address === this.getAddress()
          ? this.aztecConnection.getClient().account.address
          : AztecAddress.fromString(address);
      const bundle = await readPlayerBundle(
        this.aztecConnection.getNode(),
        this.aztecConnection.getClient().darkforestAddress,
        this.storageSlots,
        target
      );
      if (!bundle.player.isInitialized) return undefined;
      const lastRevealTimestamp = bundle.player.lastRevealBlock;
      return mapPlayer(
        target,
        bundle.player,
        bundle.claimedShips,
        bundle.spaceJunk,
        bundle.spaceJunkLimit,
        lastRevealTimestamp
      );
    } catch {
      return undefined;
    }
  }

  public async getPlanetById(planetId: LocationId): Promise<Planet | undefined> {
    const id = toBigInt(planetId);
    const bundle = await readLocationBundle(
      this.aztecConnection.getNode(),
      this.aztecConnection.getClient().darkforestAddress,
      this.storageSlots,
      id
    );
    if (!bundle.planet.isInitialized && bundle.revealed.locationId === 0n) {
      return undefined;
    }

    const revealed = mapRevealedCoords(bundle.revealed);
    const lastUpdatedTimestamp = bundle.planet.lastUpdated;
    const constants = await this.getConstants();
    return mapPlanet({
      locationId: id,
      planetState: bundle.planet,
      artifactState: bundle.artifactState,
      artifacts: bundle.artifacts,
      revealed,
      destroyed: bundle.destroyed,
      spaceJunk: bundle.spaceJunk,
      lastUpdatedTimestamp,
      contractConstants: constants,
      onChainConfig: this.onChainConfig,
    });
  }

  public async bulkGetPlanets(
    planetIds: LocationId[],
    progress?: (fraction: number) => void
  ): Promise<Map<LocationId, Planet>> {
    const map = new Map<LocationId, Planet>();
    const entries = await mapWithConcurrency(
      planetIds,
      READ_CONCURRENCY,
      async (planetId) => {
        const planet = await this.getPlanetById(planetId);
        return { planetId, planet };
      },
      progress
    );
    for (const entry of entries) {
      if (entry.planet) {
        map.set(entry.planetId, entry.planet);
      }
    }
    return map;
  }

  public async getArrivalsForPlanet(planetId: LocationId): Promise<QueuedArrival[]> {
    const id = toBigInt(planetId);
    const planetArrivals = await readPlanetArrivals(
      this.aztecConnection.getNode(),
      this.aztecConnection.getClient().darkforestAddress,
      this.storageSlots,
      id
    );
    const arrivals: QueuedArrival[] = [];
    for (const arrivalId of planetArrivals.ids) {
      if (arrivalId === 0n) continue;
      const arrivalState = await readArrivalState(
        this.aztecConnection.getNode(),
        this.aztecConnection.getClient().darkforestAddress,
        this.storageSlots,
        arrivalId
      );
      if (arrivalState.arrivalBlock === 0) continue;
      arrivals.push(
        await mapArrival({
          arrivalId,
          arrivalState,
          departureTimestamp: arrivalState.departureBlock,
          arrivalTimestamp: arrivalState.arrivalBlock,
        })
      );
    }
    return arrivals;
  }

  public async getArrivalState(arrivalId: VoyageId): Promise<ArrivalState | undefined> {
    const id = BigInt(arrivalId);
    const arrivalState = await readArrivalState(
      this.aztecConnection.getNode(),
      this.aztecConnection.getClient().darkforestAddress,
      this.storageSlots,
      id
    );
    return arrivalState;
  }

  public async getCurrentBlockNumber(): Promise<number> {
    return this.aztecConnection.getNode().getBlockNumber();
  }

  public async getAllArrivals(
    planetIds: LocationId[],
    progress?: (fraction: number) => void
  ): Promise<QueuedArrival[]> {
    const batches = await mapWithConcurrency(
      planetIds,
      READ_CONCURRENCY,
      (planetId) => this.getArrivalsForPlanet(planetId),
      progress
    );
    const arrivals = batches.flat();
    const seen = new Set<string>();
    return arrivals.filter((arrival) => {
      if (seen.has(arrival.eventId)) return false;
      seen.add(arrival.eventId);
      return true;
    });
  }

  public async getArtifactById(artifactId: ArtifactId): Promise<Artifact | undefined> {
    const id = toBigInt(artifactId);
    const bundle = await readArtifactBundle(
      this.aztecConnection.getNode(),
      this.aztecConnection.getClient().darkforestAddress,
      this.storageSlots,
      id,
      this.aztecConnection.getClient().nftAddress,
      this.aztecConnection.getClient().nftStorageSlots
    );
    if (!bundle.artifact.isInitialized) return undefined;
    const lastActivatedTimestamp = bundle.artifact.lastActivated;
    const lastDeactivatedTimestamp = bundle.artifact.lastDeactivated;
    return mapArtifact({
      artifactState: bundle.artifact,
      locationId: bundle.locationId,
      owner: bundle.owner,
      lastActivatedTimestamp,
      lastDeactivatedTimestamp,
      contractAddress: this.aztecConnection.getClient().darkforestAddress,
      burnedLocationId: this.onChainConfig.maxLocationId,
    });
  }

  public async bulkGetArtifacts(
    artifactIds: ArtifactId[],
    progress?: (fraction: number) => void
  ): Promise<Artifact[]> {
    const entries = await mapWithConcurrency(
      artifactIds,
      READ_CONCURRENCY,
      (artifactId) => this.getArtifactById(artifactId),
      progress
    );
    return entries.filter((artifact): artifact is Artifact => !!artifact);
  }

  public async bulkGetArtifactsOnPlanets(
    planetIds: LocationId[],
    progress?: (fraction: number) => void
  ): Promise<Artifact[][]> {
    const artifactsByPlanet = await mapWithConcurrency(
      planetIds,
      READ_CONCURRENCY,
      async (planetId) => {
        const id = toBigInt(planetId);
        const artifactsState = await readPlanetArtifacts(
          this.aztecConnection.getNode(),
          this.aztecConnection.getClient().darkforestAddress,
          this.storageSlots,
          id
        );
        const ids = artifactsState.ids.filter((artifactId) => artifactId !== 0n);
        const artifacts: Artifact[] = [];
        for (const artifactId of ids) {
          const artifact = await this.getArtifactById(
            artifactIdFromDecStr(artifactId.toString())
          );
          if (artifact) artifacts.push(artifact);
        }
        return artifacts;
      },
      progress
    );
    return artifactsByPlanet;
  }

  public async getPlayerArtifacts(progress?: (fraction: number) => void): Promise<Artifact[]> {
    const account = this.getAddress();
    if (!account) {
      progress?.(1);
      return [];
    }

    const touchedPlanetIds = await this.getTouchedPlanetIds();
    if (touchedPlanetIds.length === 0) {
      progress?.(1);
      return [];
    }

    const artifactSeeds = new Set<ArtifactId>();
    await mapWithConcurrency(
      touchedPlanetIds,
      READ_CONCURRENCY,
      async (planetId) => {
        const locationId = toBigInt(planetId);
        const state = await readPlanetArtifactState(
          this.aztecConnection.getNode(),
          this.aztecConnection.getClient().darkforestAddress,
          this.storageSlots,
          locationId
        );
        if (!state.hasTriedFindingArtifact) return;
        const seed = this.computeArtifactSeed(locationId, state.prospectedBlockNumber);
        if (seed === 0n) return;
        artifactSeeds.add(artifactIdFromDecStr(seed.toString()));
      },
      progress
    );

    const artifacts: Artifact[] = [];
    for (const artifactId of artifactSeeds) {
      const artifact = await this.getArtifactById(artifactId);
      if (!artifact) continue;
      if (artifact.currentOwner === account) {
        artifacts.push(artifact);
      }
    }
    return artifacts;
  }

  public async getRevealedCoordsByIdIfExists(planetId: LocationId): Promise<RevealedCoords | undefined> {
    const id = toBigInt(planetId);
    const bundle = await readLocationBundle(
      this.aztecConnection.getNode(),
      this.aztecConnection.getClient().darkforestAddress,
      this.storageSlots,
      id
    );
    return mapRevealedCoords(bundle.revealed);
  }

  public async getRevealedPlanetsCoords(
    progress?: (fraction: number) => void
  ): Promise<RevealedCoords[]> {
    const count = await readRevealedCoordsCount(
      this.aztecConnection.getNode(),
      this.aztecConnection.getClient().darkforestAddress,
      this.storageSlots
    );
    if (count === 0n) {
      progress?.(1);
      return [];
    }

    const revealed: RevealedCoords[] = [];
    const total = Number(count);
    let offset = 0n;
    while (offset < count) {
      const remaining = count - offset;
      const chunkSize =
        remaining > BigInt(INDEX_PAGE_SIZE) ? INDEX_PAGE_SIZE : Number(remaining);
      const chunk = await readRevealedCoordsRange(
        this.aztecConnection.getNode(),
        this.aztecConnection.getClient().darkforestAddress,
        this.storageSlots,
        offset,
        chunkSize
      );
      for (const entry of chunk) {
        const mapped = mapRevealedCoords(entry);
        if (mapped) revealed.push(mapped);
      }
      offset += BigInt(chunkSize);
      if (total > 0) {
        progress?.(Math.min(1, Number(offset) / total));
      }
    }
    return revealed;
  }

  public async getTouchedPlanetIds(
    progress?: (fraction: number) => void
  ): Promise<LocationId[]> {
    const count = await readTouchedPlanetIdsCount(
      this.aztecConnection.getNode(),
      this.aztecConnection.getClient().darkforestAddress,
      this.storageSlots
    );
    if (count === 0n) {
      progress?.(1);
      return [];
    }

    const ids: LocationId[] = [];
    const seen = new Set<string>();
    const total = Number(count);
    let offset = 0n;
    while (offset < count) {
      const remaining = count - offset;
      const chunkSize =
        remaining > BigInt(INDEX_PAGE_SIZE) ? INDEX_PAGE_SIZE : Number(remaining);
      const chunk = await readTouchedPlanetIdsRange(
        this.aztecConnection.getNode(),
        this.aztecConnection.getClient().darkforestAddress,
        this.storageSlots,
        offset,
        chunkSize
      );
      for (const entry of chunk) {
        if (entry === 0n) continue;
        const id = toLocationId(entry);
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
      offset += BigInt(chunkSize);
      if (total > 0) {
        progress?.(Math.min(1, Number(offset) / total));
      }
    }
    return ids;
  }

  public async getPlayersTwitters(): Promise<Record<string, string>> {
    return {};
  }

  public async getIsPaused(): Promise<boolean> {
    return false;
  }

  public getAddress(): EthAddress | undefined {
    return this.aztecConnection.getAddress();
  }

  public async resolveArrival(arrivalId: VoyageId): Promise<string | undefined> {
    const logId = detailedLogger.start('contracts', 'resolve_arrival', { arrivalId });
    const id = BigInt(arrivalId);
    try {
      const sendStart = Date.now();
      const sentTx = await this.aztecConnection.getClient().resolveArrival(id);
      const rawHash = sentTx.getTxHash ? await sentTx.getTxHash() : sentTx.txHash;
      const txHash = formatTxHash(rawHash);
      const submittedAt = Date.now();
      const submitMs = submittedAt - sendStart;
      if (VERBOSE_LOGGING) {
        console.info('[Aztec tx] submitted', {
          method: 'resolveArrival',
          hash: txHash ?? UNKNOWN_HASH,
          args: [arrivalId],
          submitMs,
        });
      }
      detailedLogger.log(
        'contracts',
        'resolve_arrival.submitted',
        {
          arrivalId,
          hash: txHash,
          submitMs,
        },
        'info',
        logId
      );
      await sentTx.wait();
      const confirmedAt = Date.now();
      const confirmMs = confirmedAt - submittedAt;
      if (VERBOSE_LOGGING) {
        console.info('[Aztec tx] confirmed', {
          method: 'resolveArrival',
          hash: txHash ?? UNKNOWN_HASH,
          confirmMs,
        });
      }
      detailedLogger.end('contracts', 'resolve_arrival', logId, {
        arrivalId,
        hash: txHash,
        submitMs,
        confirmMs,
        totalMs: confirmedAt - sendStart,
      });
      return txHash;
    } catch (error) {
      detailedLogger.error('contracts', 'resolve_arrival', logId, {
        arrivalId,
        error,
        stack: (error as Error)?.stack,
      });
      throw error;
    }
  }

  public emitTransactionEvents(tx: Transaction): void {
    tx.submittedPromise
      .then(() => {
        this.emit(ContractsAPIEvent.TxSubmitted, tx);
      })
      .catch(() => {
        this.emit(ContractsAPIEvent.TxErrored, tx);
      });

    tx.confirmedPromise
      .then(() => {
        this.emit(ContractsAPIEvent.TxConfirmed, tx);
      })
      .catch(() => {
        this.emit(ContractsAPIEvent.TxErrored, tx);
      });
  }

  public cancelTransaction(tx: Transaction): void {
    this.emit(ContractsAPIEvent.TxCancelled, tx);
  }

  public prioritizeTransaction(tx: Transaction): void {
    this.emit(ContractsAPIEvent.TxPrioritized, tx);
  }

  public async submitTransaction<T extends TxIntent>(
    txIntent: T,
    _overrides?: providers.TransactionRequest
  ): Promise<Transaction<T>> {
    const submitted = deferred<providers.TransactionResponse>();
    const confirmed = deferred<providers.TransactionReceipt>();
    const logId = detailedLogger.start('contracts', 'tx', {
      method: txIntent.methodName,
    });

    const tx: Transaction<T> = {
      id: this.nextTxId(),
      lastUpdatedAt: Date.now(),
      state: TxStatus.Init as EthTxStatus,
      intent: txIntent,
      submittedPromise: submitted.promise,
      confirmedPromise: confirmed.promise,
      onSubmissionError: submitted.reject,
      onReceiptError: confirmed.reject,
      onTransactionResponse: submitted.resolve,
      onTransactionReceipt: confirmed.resolve,
    };

    const timings: TxTimings = { createdAt: tx.lastUpdatedAt };
    (tx as Transaction & { __dfTimings?: TxTimings }).__dfTimings = timings;

    this.emit(ContractsAPIEvent.TxQueued, tx);
    setTimeout(() => this.emitTransactionEvents(tx), 0);
    detailedLogger.log('contracts', 'tx.queued', {
      txId: tx.id,
      method: txIntent.methodName,
    }, 'info', logId);

    try {
      tx.state = TxStatus.Processing as EthTxStatus;
      const args = await txIntent.args;
      detailedLogger.log('contracts', 'tx.args', {
        txId: tx.id,
        method: txIntent.methodName,
        args,
      }, 'debug', logId);
      const sendStart = Date.now();
      const sentTx = await this.dispatchAztecTransaction(txIntent.methodName, txIntent, args);
      const rawHash = sentTx.getTxHash ? await sentTx.getTxHash() : sentTx.txHash;
      const txHash = formatTxHash(rawHash);
      const submittedAt = Date.now();
      timings.submittedAt = submittedAt;
      timings.submitMs = submittedAt - sendStart;
      timings.sendMs = timings.submitMs;
      timings.proveMs = timings.submitMs;
      tx.hash = txHash;
      tx.state = TxStatus.Submit as EthTxStatus;
      submitted.resolve({ hash: txHash } as providers.TransactionResponse);
      if (VERBOSE_LOGGING) {
        console.info('[Aztec tx] submitted', {
          method: txIntent.methodName,
          hash: txHash ?? UNKNOWN_HASH,
          proveMs: timings.proveMs,
          sendMs: timings.sendMs,
          submitMs: timings.submitMs,
          args,
        });
      }
      detailedLogger.log('contracts', 'tx.submitted', {
        txId: tx.id,
        method: txIntent.methodName,
        hash: txHash ?? UNKNOWN_HASH,
        proveMs: timings.proveMs,
        sendMs: timings.sendMs,
        submitMs: timings.submitMs,
      }, 'info', logId);

      const receipt = await sentTx.wait();
      const confirmedAt = Date.now();
      timings.confirmedAt = confirmedAt;
      timings.confirmMs = timings.submittedAt ? confirmedAt - timings.submittedAt : undefined;
      timings.totalMs = confirmedAt - timings.createdAt;
      tx.state = TxStatus.Confirm as EthTxStatus;
      confirmed.resolve({ transactionHash: txHash, status: 1 } as providers.TransactionReceipt);
      if (VERBOSE_LOGGING) {
        console.info('[Aztec tx] confirmed', {
          method: txIntent.methodName,
          hash: txHash ?? UNKNOWN_HASH,
          confirmMs: timings.confirmMs,
          totalMs: timings.totalMs,
          status: receipt?.status,
        });
      }
      detailedLogger.log('contracts', 'tx.confirmed', {
        txId: tx.id,
        method: txIntent.methodName,
        hash: txHash ?? UNKNOWN_HASH,
        proveMs: timings.proveMs,
        sendMs: timings.sendMs,
        confirmMs: timings.confirmMs,
        totalMs: timings.totalMs,
        status: receipt?.status,
      }, 'info', logId);

      this.emitAztecSideEffects(txIntent, args);
    } catch (err) {
      tx.state = TxStatus.Fail as EthTxStatus;
      submitted.reject(err as Error);
      confirmed.reject(err as Error);
      this.emit(ContractsAPIEvent.TxErrored, tx);
      console.error('[Aztec tx] failed', {
        method: txIntent.methodName,
        hash: tx.hash ?? UNKNOWN_HASH,
        error: (err as Error)?.message ?? err,
        stack: (err as Error)?.stack,
      });
      detailedLogger.error('contracts', 'tx', logId, {
        txId: tx.id,
        method: txIntent.methodName,
        hash: tx.hash ?? UNKNOWN_HASH,
        error: err,
        stack: (err as Error)?.stack,
      });
    }

    return tx;
  }

  private emitAztecSideEffects(intent: TxIntent, args: unknown[]) {
    switch (intent.methodName as string) {
      case METHOD.REVEAL_LOCATION: {
        const [x, y] = args as [number, number];
        const locationId = this.locationIdFromCoords(x, y);
        this.emit(ContractsAPIEvent.LocationRevealed, locationId);
        break;
      }
      case METHOD.INIT: {
        const [x, y] = args as [number, number];
        const locationId = this.locationIdFromCoords(x, y);
        this.emit(ContractsAPIEvent.PlayerUpdate, this.getAddress());
        this.emit(ContractsAPIEvent.PlanetUpdate, locationId);
        break;
      }
      case METHOD.MOVE: {
        const moveIntent = intent as TxIntent & { artifact?: ArtifactId };
        let artifactId = moveIntent.artifact;
        if (!artifactId) {
          const [, , , , , , , , rawArtifactId] = args as unknown[];
          if (rawArtifactId && rawArtifactId !== 0 && rawArtifactId !== '0') {
            artifactId = artifactIdFromDecStr(String(rawArtifactId));
          }
        }
        if (artifactId) this.emit(ContractsAPIEvent.ArtifactUpdate, artifactId);
        break;
      }
      case METHOD.FIND_ARTIFACT: {
        const [x, y] = args as [number, number];
        const locationId = this.locationIdFromCoords(x, y);
        this.emit(ContractsAPIEvent.PlanetUpdate, locationId);
        break;
      }
      default:
        break;
    }
  }

  private async dispatchAztecTransaction(
    method: ContractMethodName,
    intent: TxIntent,
    args: unknown[]
  ) {
    const client = this.aztecConnection.getClient();
    switch (method as string) {
      case METHOD.INIT: {
        const [x, y, radius] = args as [number, number, number];
        const xField = toFieldBigInt(x);
        const yField = toFieldBigInt(y);
        return client.initPlayer(xField, yField, BigInt(radius));
      }
      case METHOD.REVEAL_LOCATION: {
        const [x, y] = args as [number, number];
        return client.revealLocation(toFieldBigInt(x), toFieldBigInt(y));
      }
      case METHOD.MOVE: {
        const [x1, y1, x2, y2, radius, distMax, popMoved, silverMoved, artifactId, abandoning] =
          args as [number, number, number, number, number, number, number, number, string | number, boolean];
        const artifact = artifactId ? BigInt(artifactId) : 0n;
        const x1Field = toFieldBigInt(x1);
        const y1Field = toFieldBigInt(y1);
        const x2Field = toFieldBigInt(x2);
        const y2Field = toFieldBigInt(y2);
        const moveIntent = intent as UnconfirmedMove & { toIsInitializedHint?: boolean };
        const toLocationId = toBigInt(moveIntent.to);
        let isInitialized: boolean;
        let source: 'cache' | 'chain';
        if (typeof moveIntent.toIsInitializedHint === 'boolean') {
          isInitialized = moveIntent.toIsInitializedHint;
          source = 'cache';
        } else {
          isInitialized = await readPlanetInitialized(
            this.aztecConnection.getNode(),
            this.aztecConnection.getClient().darkforestAddress,
            this.storageSlots,
            toLocationId
          );
          source = 'chain';
        }

        if (VERBOSE_LOGGING) {
          console.info('[Aztec tx] move_known.select', {
            toLocationId: toLocationId.toString(),
            isInitialized,
            source,
          });
        }
        detailedLogger.log('contracts', 'move_known.select', {
          toLocationId,
          isInitialized,
          source,
        });

        const moveKnown = async () =>
          client.moveKnown(
            x1Field,
            y1Field,
            x2Field,
            y2Field,
            BigInt(radius),
            BigInt(distMax),
            BigInt(popMoved),
            BigInt(silverMoved),
            artifact,
            Boolean(abandoning)
          );
        const move = async () =>
          client.move(
            x1Field,
            y1Field,
            x2Field,
            y2Field,
            BigInt(radius),
            BigInt(distMax),
            BigInt(popMoved),
            BigInt(silverMoved),
            artifact,
            Boolean(abandoning)
          );

        if (isInitialized) {
          try {
            return await moveKnown();
          } catch (error) {
            if (VERBOSE_LOGGING) {
              console.warn('[Aztec tx] move_known fallback to move', {
                toLocationId: toLocationId.toString(),
                source,
                error: (error as Error)?.message ?? error,
              });
            }
            detailedLogger.log('contracts', 'move_known.fallback', {
              toLocationId,
              source,
              error,
            }, 'warn');
            return move();
          }
        }

        return move();
      }
      case METHOD.UPGRADE: {
        const [locationId, branch] = args as [string, number];
        return client.upgradePlanet(BigInt(locationId), branch);
      }
      case METHOD.PROSPECT_PLANET: {
        const [locationId] = args as [string];
        return client.prospectPlanet(BigInt(locationId));
      }
      case METHOD.FIND_ARTIFACT: {
        const [x, y] = args as [number, number];
        const xField = toFieldBigInt(x);
        const yField = toFieldBigInt(y);
        const biomebase = multiScalePerlin(
          xField,
          yField,
          this.onChainConfig.biomebaseKey,
          this.onChainConfig.perlinLengthScale,
          this.onChainConfig.perlinMirrorX,
          this.onChainConfig.perlinMirrorY
        );
        return client.findArtifact(xField, yField, biomebase);
      }
      case METHOD.DEPOSIT_ARTIFACT: {
        const [locationId, artifactId] = args as [string, string];
        return client.tradeArtifact(BigInt(locationId), BigInt(artifactId), false);
      }
      case METHOD.WITHDRAW_ARTIFACT: {
        const [locationId, artifactId] = args as [string, string];
        return client.tradeArtifact(BigInt(locationId), BigInt(artifactId), true);
      }
      case METHOD.ACTIVATE_ARTIFACT: {
        const [locationId, artifactId, wormholeTo] = args as [string, string, string];
        return client.setArtifactActivation(
          BigInt(locationId),
          BigInt(artifactId),
          BigInt(wormholeTo),
          true
        );
      }
      case METHOD.DEACTIVATE_ARTIFACT: {
        const [locationId, artifactId] = args as [string, string];
        return client.setArtifactActivation(BigInt(locationId), BigInt(artifactId), 0n, false);
      }
      case METHOD.GET_SHIPS: {
        const [locationId] = args as [string];
        return client.giveSpaceShips(BigInt(locationId));
      }
      default:
        throw new Error(`Unsupported Aztec method: ${method}`);
    }
  }

  private nextTxId(): number {
    return this.txId++;
  }

  private locationIdFromCoords(x: number, y: number): LocationId {
    return locationIdFromDecStr(
      locationIdFromCoords(BigInt(x), BigInt(y), this.onChainConfig.planethashKey).toString()
    );
  }

}

export async function makeContractsAPI({
  connection,
  contractAddress,
}: {
  connection: AztecConnection;
  contractAddress: EthAddress;
}): Promise<ContractsAPI> {
  return new ContractsAPI({ connection, contractAddress });
}
