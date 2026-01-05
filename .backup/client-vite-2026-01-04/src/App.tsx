import { useMemo, useState } from "react";
import type { DarkForestClient, ClientLogFn } from "./scripts/darkforest";
import { connectDarkForest } from "./scripts/darkforest";
import { CLIENT_CONFIG, DEFAULT_INIT, DEFAULT_REVEAL } from "./config";
import {
    fieldToSignedInt,
    locationIdFromCoords,
    multiScalePerlin,
    toField,
} from "./scripts/hashing";
import {
    readArtifactBundle,
    readLocationBundle,
    readPlayerBundle,
} from "./scripts/chain";

const KNOWN_LOCATIONS_KEY = "df-known-locations";

type KnownLocation = {
    locationId: bigint;
    x: bigint;
    y: bigint;
    source: string;
};

type LocationBundle = Awaited<ReturnType<typeof readLocationBundle>>;
type PlayerBundle = Awaited<ReturnType<typeof readPlayerBundle>>;
type ArtifactBundle = Awaited<ReturnType<typeof readArtifactBundle>>;

const loadKnownLocations = (): KnownLocation[] => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(KNOWN_LOCATIONS_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((entry) => ({
                locationId: BigInt(entry.locationId),
                x: BigInt(entry.x),
                y: BigInt(entry.y),
                source: String(entry.source ?? "manual"),
            }))
            .filter((entry) => entry.locationId !== undefined);
    } catch {
        return [];
    }
};

const persistKnownLocations = (locations: KnownLocation[]) => {
    if (typeof window === "undefined") return;
    const payload = locations.map((entry) => ({
        locationId: entry.locationId.toString(),
        x: entry.x.toString(),
        y: entry.y.toString(),
        source: entry.source,
    }));
    window.localStorage.setItem(KNOWN_LOCATIONS_KEY, JSON.stringify(payload));
};

const toBigInt = (value: string, label: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`Missing ${label}.`);
    }
    try {
        return BigInt(trimmed);
    } catch {
        throw new Error(`Invalid ${label}: ${value}`);
    }
};

const formatBigInt = (value?: bigint | null) =>
    value === undefined || value === null ? "--" : value.toString();

const shortAddress = (value: string) => {
    if (!value) return "--";
    if (value.length <= 14) return value;
    return `${value.slice(0, 8)}...${value.slice(-6)}`;
};

const sumBigInt = (values: bigint[]) =>
    values.reduce((acc, value) => acc + value, 0n);

export default function App() {
    const [client, setClient] = useState<DarkForestClient | null>(null);
    const [status, setStatus] = useState<string>("Disconnected");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [logs, setLogs] = useState<Array<{ ts: string; message: string }>>([]);
    const [zoom, setZoom] = useState(6);
    const [viewCenter, setViewCenter] = useState({ x: 0, y: 0 });

    const [knownLocations, setKnownLocations] = useState<KnownLocation[]>(
        () => loadKnownLocations()
    );
    const [locationData, setLocationData] = useState<
        Record<string, LocationBundle>
    >({});
    const [artifactData, setArtifactData] = useState<
        Record<string, ArtifactBundle>
    >({});
    const [playerBundle, setPlayerBundle] = useState<PlayerBundle | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [initX, setInitX] = useState(DEFAULT_INIT.x);
    const [initY, setInitY] = useState(DEFAULT_INIT.y);
    const [initRadius, setInitRadius] = useState(DEFAULT_INIT.radius);
    const [revealX, setRevealX] = useState(DEFAULT_REVEAL.x);
    const [revealY, setRevealY] = useState(DEFAULT_REVEAL.y);
    const [trackX, setTrackX] = useState("");
    const [trackY, setTrackY] = useState("");

    const [moveFromX, setMoveFromX] = useState("");
    const [moveFromY, setMoveFromY] = useState("");
    const [moveToX, setMoveToX] = useState("");
    const [moveToY, setMoveToY] = useState("");
    const [moveRadius, setMoveRadius] = useState("");
    const [moveDistMax, setMoveDistMax] = useState("");
    const [movePop, setMovePop] = useState("0");
    const [moveSilver, setMoveSilver] = useState("0");
    const [moveArtifactId, setMoveArtifactId] = useState("0");
    const [moveAbandoning, setMoveAbandoning] = useState(false);

    const [upgradeBranch, setUpgradeBranch] = useState("0");
    const [findX, setFindX] = useState("");
    const [findY, setFindY] = useState("");
    const [tradeArtifactId, setTradeArtifactId] = useState("0");
    const [tradeWithdraw, setTradeWithdraw] = useState(false);
    const [activateArtifactId, setActivateArtifactId] = useState("0");
    const [activateWormholeTo, setActivateWormholeTo] = useState("0");
    const [activateToggle, setActivateToggle] = useState(true);

    const missingAddress = useMemo(() => !CLIENT_CONFIG.darkforestAddress, []);

    const knownById = useMemo(() => {
        const map = new Map<string, KnownLocation>();
        for (const location of knownLocations) {
            map.set(location.locationId.toString(), location);
        }
        return map;
    }, [knownLocations]);

    const selectedLocation = selectedId ? knownById.get(selectedId) : undefined;
    const selectedBundle = selectedId ? locationData[selectedId] : undefined;
    const selectedPlanet = selectedBundle?.planet;

    const playerAddress = client?.account.address.toString() ?? "";
    const ownedPlanets = Object.entries(locationData)
        .filter(([_, bundle]) => bundle.planet.isInitialized)
        .filter(([_, bundle]) => bundle.planet.owner.toString() === playerAddress)
        .map(([_, bundle]) => bundle.planet);
    const totalPopulation = sumBigInt(ownedPlanets.map((planet) => planet.population));
    const totalSilver = sumBigInt(ownedPlanets.map((planet) => planet.silver));

    const pushLog = (message: string) => {
        const ts = new Date().toLocaleTimeString();
        setLogs((prev) => {
            const next = [...prev, { ts, message }];
            return next.length > 250 ? next.slice(next.length - 250) : next;
        });
    };

    const makeLogger = (): ClientLogFn => (message, data) => {
        const formatted = data ? `${message} ${JSON.stringify(data)}` : message;
        console.log(formatted);
        pushLog(formatted);
    };

    const clearLogs = () => setLogs([]);

    const refreshPlayer = async (nextClient?: DarkForestClient) => {
        const activeClient = nextClient ?? client;
        if (!activeClient) return;
        const bundle = await readPlayerBundle(
            activeClient.node,
            activeClient.darkforestAddress,
            activeClient.storageSlots,
            activeClient.account.address
        );
        setPlayerBundle(bundle);
    };

    const refreshLocations = async (
        locations: KnownLocation[],
        nextClient?: DarkForestClient
    ) => {
        const activeClient = nextClient ?? client;
        if (!activeClient) return;
        if (locations.length === 0) {
            setLocationData({});
            setArtifactData({});
            return;
        }

        const bundles = await Promise.all(
            locations.map((location) =>
                readLocationBundle(
                    activeClient.node,
                    activeClient.darkforestAddress,
                    activeClient.storageSlots,
                    location.locationId
                )
            )
        );

        const nextLocationData: Record<string, LocationBundle> = {};
        bundles.forEach((bundle, index) => {
            nextLocationData[locations[index].locationId.toString()] = bundle;
        });

        const updatedLocations = [...locations];
        let updated = false;
        bundles.forEach((bundle, index) => {
            if (bundle.revealed.locationId === 0n) return;
            const signedX = fieldToSignedInt(bundle.revealed.x);
            const signedY = fieldToSignedInt(bundle.revealed.y);
            const current = updatedLocations[index];
            if (current.x !== signedX || current.y !== signedY) {
                updatedLocations[index] = {
                    ...current,
                    x: signedX,
                    y: signedY,
                    source: "revealed",
                };
                updated = true;
            }
        });

        if (updated) {
            setKnownLocations(updatedLocations);
            persistKnownLocations(updatedLocations);
        }

        setLocationData(nextLocationData);

        const artifactIds = new Set<bigint>();
        bundles.forEach((bundle) => {
            bundle.artifacts.ids.forEach((id) => {
                if (id !== 0n) artifactIds.add(id);
            });
        });

        if (artifactIds.size === 0) {
            setArtifactData({});
            return;
        }

        const artifactList = Array.from(artifactIds);
        const artifactBundles = await Promise.all(
            artifactList.map((id) =>
                readArtifactBundle(
                    activeClient.node,
                    activeClient.darkforestAddress,
                    activeClient.storageSlots,
                    id,
                    activeClient.nftAddress,
                    activeClient.nftStorageSlots
                )
            )
        );

        const nextArtifactData: Record<string, ArtifactBundle> = {};
        artifactBundles.forEach((bundle, index) => {
            nextArtifactData[artifactList[index].toString()] = bundle;
        });
        setArtifactData(nextArtifactData);
    };

    const refreshAll = async (
        nextClient?: DarkForestClient,
        locations?: KnownLocation[]
    ) => {
        await refreshPlayer(nextClient);
        await refreshLocations(locations ?? knownLocations, nextClient);
    };

    const connect = async () => {
        setError(null);
        setBusy(true);
        setStatus("Connecting to Aztec node...");
        pushLog("Connecting to Aztec node...");
        try {
            const nextClient = await connectDarkForest(CLIENT_CONFIG, makeLogger());
            setClient(nextClient);
            setStatus(`Connected: ${nextClient.account.address.toString()}`);
            pushLog(`Connected: ${nextClient.account.address.toString()}`);
            await refreshAll(nextClient);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setStatus("Connection failed");
            pushLog(`Connection failed: ${message}`);
        } finally {
            setBusy(false);
        }
    };

    const runTx = async (label: string, fn: () => Promise<unknown>) => {
        if (!client) return;
        setError(null);
        setBusy(true);
        setStatus(`${label}: proving...`);
        pushLog(`${label}: proving...`);
        try {
            const tx = (await fn()) as { getTxHash: () => Promise<{ toString: () => string }>; wait: () => Promise<void> };
            const hash = await tx.getTxHash();
            setStatus(`${label}: sent ${hash.toString()}`);
            pushLog(`${label}: sent ${hash.toString()}`);
            await tx.wait();
            setStatus(`${label}: confirmed ${hash.toString()}`);
            pushLog(`${label}: confirmed ${hash.toString()}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setStatus(`${label}: failed`);
            pushLog(`${label}: failed ${message}`);
        } finally {
            setBusy(false);
        }
    };

    const addKnownLocation = (location: KnownLocation) => {
        const existing = knownLocations.find(
            (entry) => entry.locationId === location.locationId
        );
        if (existing) {
            const next = knownLocations.map((entry) =>
                entry.locationId === location.locationId ? location : entry
            );
            setKnownLocations(next);
            persistKnownLocations(next);
            void refreshLocations(next);
            return next;
        }
        const next = [...knownLocations, location];
        setKnownLocations(next);
        persistKnownLocations(next);
        void refreshLocations(next);
        return next;
    };

    const handleTrack = async () => {
        if (!client) {
            setError("Connect first.");
            return;
        }
        try {
            const x = toBigInt(trackX, "track x");
            const y = toBigInt(trackY, "track y");
            const locationId = locationIdFromCoords(
                toField(x),
                toField(y),
                client.gameConfig.planethashKey
            );
            addKnownLocation({ locationId, x, y, source: "manual" });
            setSelectedId(locationId.toString());
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
        }
    };

    const initPlayer = async () => {
        if (!client) return;
        const x = toField(toBigInt(initX, "init x"));
        const y = toField(toBigInt(initY, "init y"));
        const radius = toBigInt(initRadius, "init radius");
        await runTx("Init player", () => client.initPlayer(x, y, radius));
        const nextLocations = addKnownLocation({
            locationId: locationIdFromCoords(x, y, client.gameConfig.planethashKey),
            x: toBigInt(initX, "init x"),
            y: toBigInt(initY, "init y"),
            source: "init",
        });
        await refreshAll(undefined, nextLocations);
    };

    const revealLocation = async () => {
        if (!client) return;
        const x = toField(toBigInt(revealX, "reveal x"));
        const y = toField(toBigInt(revealY, "reveal y"));
        await runTx("Reveal", () => client.revealLocation(x, y));
        const nextLocations = addKnownLocation({
            locationId: locationIdFromCoords(x, y, client.gameConfig.planethashKey),
            x: toBigInt(revealX, "reveal x"),
            y: toBigInt(revealY, "reveal y"),
            source: "reveal",
        });
        await refreshAll(undefined, nextLocations);
    };

    const runMove = async () => {
        if (!client) return;
        const x1 = toField(toBigInt(moveFromX, "from x"));
        const y1 = toField(toBigInt(moveFromY, "from y"));
        const x2 = toField(toBigInt(moveToX, "to x"));
        const y2 = toField(toBigInt(moveToY, "to y"));
        const radius = toBigInt(moveRadius, "radius");
        const distMax = toBigInt(moveDistMax, "dist max");
        const popMoved = toBigInt(movePop, "population");
        const silverMoved = toBigInt(moveSilver, "silver");
        const movedArtifactId = toBigInt(moveArtifactId, "artifact id");
        await runTx("Move", () =>
            client.move(
                x1,
                y1,
                x2,
                y2,
                radius,
                distMax,
                popMoved,
                silverMoved,
                movedArtifactId,
                moveAbandoning
            )
        );
        const nextLocations = addKnownLocation({
            locationId: locationIdFromCoords(x2, y2, client.gameConfig.planethashKey),
            x: toBigInt(moveToX, "to x"),
            y: toBigInt(moveToY, "to y"),
            source: "move",
        });
        await refreshAll(undefined, nextLocations);
    };

    const runUpgrade = async () => {
        if (!client || !selectedId) return;
        await runTx("Upgrade", () =>
            client.upgradePlanet(BigInt(selectedId), Number(upgradeBranch))
        );
        await refreshAll();
    };

    const runProspect = async () => {
        if (!client || !selectedId) return;
        await runTx("Prospect", () =>
            client.prospectPlanet(BigInt(selectedId))
        );
        await refreshAll();
    };

    const runFindArtifact = async () => {
        if (!client) return;
        const x = toField(toBigInt(findX, "find x"));
        const y = toField(toBigInt(findY, "find y"));
        const biomebase = multiScalePerlin(
            x,
            y,
            client.gameConfig.biomebaseKey,
            client.perlinConfig.perlinLengthScale,
            client.perlinConfig.perlinMirrorX,
            client.perlinConfig.perlinMirrorY
        );
        await runTx("Find artifact", () =>
            client.findArtifact(x, y, biomebase)
        );
        const nextLocations = addKnownLocation({
            locationId: locationIdFromCoords(x, y, client.gameConfig.planethashKey),
            x: toBigInt(findX, "find x"),
            y: toBigInt(findY, "find y"),
            source: "find",
        });
        await refreshAll(undefined, nextLocations);
    };

    const runTradeArtifact = async () => {
        if (!client || !selectedId) return;
        const artifactId = toBigInt(tradeArtifactId, "artifact id");
        await runTx("Trade artifact", () =>
            client.tradeArtifact(BigInt(selectedId), artifactId, tradeWithdraw)
        );
        await refreshAll();
    };

    const runSetArtifactActivation = async () => {
        if (!client || !selectedId) return;
        const artifactId = toBigInt(activateArtifactId, "artifact id");
        const wormholeTo = toBigInt(activateWormholeTo, "wormhole to");
        await runTx("Toggle artifact", () =>
            client.setArtifactActivation(
                BigInt(selectedId),
                artifactId,
                wormholeTo,
                activateToggle
            )
        );
        await refreshAll();
    };

    const runGiveSpaceShips = async () => {
        if (!client || !selectedId) return;
        await runTx("Give spaceships", () =>
            client.giveSpaceShips(BigInt(selectedId))
        );
        await refreshAll();
    };

    const applySelectedTo = (setterX: (value: string) => void, setterY: (value: string) => void) => {
        if (!selectedLocation) return;
        setterX(selectedLocation.x.toString());
        setterY(selectedLocation.y.toString());
    };

    const applyMoveDefaults = () => {
        if (!client || !selectedPlanet) return;
        setMoveRadius(client.gameConfig.worldRadius.toString());
        setMoveDistMax(selectedPlanet.range.toString());
    };

    const worldRadius = client ? Number(client.gameConfig.worldRadius) : 1000;
    const mapRadius = Number.isFinite(worldRadius) && worldRadius > 0 ? worldRadius : 1000;
    const clampedZoom = Math.min(Math.max(zoom, 1), 20);
    const zoomedRadius = mapRadius / clampedZoom;
    const viewBox = `${viewCenter.x - zoomedRadius} ${viewCenter.y - zoomedRadius} ${
        zoomedRadius * 2
    } ${zoomedRadius * 2}`;

    const parseOptional = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;
        try {
            return BigInt(trimmed);
        } catch {
            return null;
        }
    };

    const trackXValue = parseOptional(trackX);
    const trackYValue = parseOptional(trackY);
    const trackLocationId =
        client && trackXValue !== null && trackYValue !== null
            ? locationIdFromCoords(
                  toField(trackXValue),
                  toField(trackYValue),
                  client.gameConfig.planethashKey
              )
            : null;
    const trackValid =
        trackLocationId && client
            ? trackLocationId < client.gameConfig.maxLocationId
            : false;

    const PLANET_TYPE_LABELS = [
        "Planet",
        "Silver Mine",
        "Ruins",
        "Trading Post",
        "Silver Bank",
    ];
    const SPACE_TYPE_LABELS = ["Nebula", "Space", "Deep Space", "Dead Space"];
    const planetTypeLabel = selectedPlanet
        ? PLANET_TYPE_LABELS[selectedPlanet.planetType] ??
          `Type ${selectedPlanet.planetType}`
        : "--";
    const spaceTypeLabel = selectedPlanet
        ? SPACE_TYPE_LABELS[selectedPlanet.spaceType] ??
          `Space ${selectedPlanet.spaceType}`
        : "--";
    const selectedOwner =
        selectedPlanet && !selectedPlanet.owner.isZero()
            ? selectedPlanet.owner.toString()
            : "";
    const selectedStats = selectedPlanet
        ? [
              { label: "Population", value: formatBigInt(selectedPlanet.population) },
              { label: "Silver", value: formatBigInt(selectedPlanet.silver) },
              { label: "Range", value: formatBigInt(selectedPlanet.range) },
              { label: "Speed", value: formatBigInt(selectedPlanet.speed) },
              { label: "Defense", value: formatBigInt(selectedPlanet.defense) },
              { label: "Perlin", value: formatBigInt(selectedPlanet.perlin) },
              { label: "Planet level", value: String(selectedPlanet.planetLevel) },
              { label: "Planet type", value: planetTypeLabel },
              { label: "Space type", value: spaceTypeLabel },
              {
                  label: "Initialized",
                  value: selectedPlanet.isInitialized ? "yes" : "no",
              },
              {
                  label: "Home planet",
                  value: selectedPlanet.isHomePlanet ? "yes" : "no",
              },
          ]
        : [];

    const artifactList = Object.entries(artifactData).map(([id, bundle]) => ({
        id,
        artifact: bundle.artifact,
        owner: bundle.owner?.toString() ?? "",
        locationId: bundle.locationId,
    }));

    const adjustZoom = (next: number) => {
        const clamped = Math.min(Math.max(next, 1), 20);
        setZoom(clamped);
    };

    const focusSelected = () => {
        if (!selectedLocation) return;
        setViewCenter({
            x: Number(selectedLocation.x),
            y: -Number(selectedLocation.y),
        });
    };

    const resetView = () => {
        setViewCenter({ x: 0, y: 0 });
        setZoom(6);
    };

    const fitTracked = () => {
        if (knownLocations.length === 0) return;
        const points = knownLocations.map((loc) => ({
            x: Number(loc.x),
            y: -Number(loc.y),
        }));
        const minX = Math.min(...points.map((p) => p.x));
        const maxX = Math.max(...points.map((p) => p.x));
        const minY = Math.min(...points.map((p) => p.y));
        const maxY = Math.max(...points.map((p) => p.y));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const spanX = Math.max(maxX - minX, 1);
        const spanY = Math.max(maxY - minY, 1);
        const radius = Math.max(spanX, spanY) / 2;
        const padded = Math.max(radius * 1.6, mapRadius / 20);
        const nextZoom = Math.min(Math.max(mapRadius / padded, 1), 20);
        setViewCenter({ x: centerX, y: centerY });
        setZoom(nextZoom);
    };

    return (
        <div className="app">
            <header className="topbar">
                <div className="brand">
                    <span className="brand-title">Dark Forest</span>
                    <span className="brand-sub">Aztec Command Deck</span>
                </div>
                <div className="status-pill">
                    <span
                        className={`status-dot ${
                            busy ? "busy" : client ? "online" : "offline"
                        }`}
                    />
                    <div>
                        <span className="status-label">Status</span>
                        <strong>{status}</strong>
                        {error && <em>{error}</em>}
                    </div>
                </div>
                <div className="top-actions">
                    <button
                        className="primary"
                        onClick={connect}
                        disabled={busy || missingAddress}
                    >
                        {client ? "Reconnect" : "Connect wallet"}
                    </button>
                    <div className="account-chip">
                        <span>Account</span>
                        <strong title={playerAddress}>
                            {shortAddress(playerAddress)}
                        </strong>
                    </div>
                </div>
            </header>

            <div className="deck">
                <aside className="dock left">
                    <section className="panel panel--network">
                        <div className="panel-header">
                            <div>
                                <h2>Network Link</h2>
                                <p className="panel-subtitle">
                                    Node sync and contract routing.
                                </p>
                            </div>
                            <button
                                className="ghost small"
                                onClick={() => refreshAll()}
                                disabled={!client || busy}
                            >
                                Sync
                            </button>
                        </div>
                        <div className="stack">
                            <div className="row">
                                <span className="label">Node URL</span>
                                <span className="value">{CLIENT_CONFIG.nodeUrl}</span>
                            </div>
                            <div className="row">
                                <span className="label">DarkForest</span>
                                <span className="value">
                                    {CLIENT_CONFIG.darkforestAddress || "(set address)"}
                                </span>
                            </div>
                            <div className="row">
                                <span className="label">NFT</span>
                                <span className="value">
                                    {CLIENT_CONFIG.nftAddress || "(optional)"}
                                </span>
                            </div>
                            <div className="row">
                                <span className="label">World radius</span>
                                <span className="value">{mapRadius}</span>
                            </div>
                        </div>
                        {missingAddress && (
                            <p className="hint">
                                Set VITE_DARKFOREST_ADDRESS in apps/client/.env.local.
                            </p>
                        )}
                    </section>

                    <section className="panel panel--player">
                        <div className="panel-header">
                            <div>
                                <h2>Commander</h2>
                                <p className="panel-subtitle">
                                    Player systems and resource telemetry.
                                </p>
                            </div>
                        </div>
                        <div className="stack">
                            <div className="row">
                                <span className="label">Initialized</span>
                                <span className="value">
                                    {playerBundle?.player.isInitialized ? "yes" : "no"}
                                </span>
                            </div>
                            <div className="row">
                                <span className="label">Home planet</span>
                                <span className="value">
                                    {formatBigInt(playerBundle?.player.homePlanet)}
                                </span>
                            </div>
                            <div className="row">
                                <span className="label">Last reveal block</span>
                                <span className="value">
                                    {playerBundle?.player.lastRevealBlock ?? "--"}
                                </span>
                            </div>
                            <div className="row">
                                <span className="label">Space junk</span>
                                <span className="value">
                                    {formatBigInt(playerBundle?.spaceJunk)} /{" "}
                                    {formatBigInt(playerBundle?.spaceJunkLimit)}
                                </span>
                            </div>
                            <div className="row">
                                <span className="label">Claimed ships</span>
                                <span className="value">
                                    {formatBigInt(playerBundle?.claimedShips)}
                                </span>
                            </div>
                        </div>
                        <div className="stat-grid compact">
                            <div className="stat">
                                <span>Total energy</span>
                                <strong>{formatBigInt(totalPopulation)}</strong>
                            </div>
                            <div className="stat">
                                <span>Total silver</span>
                                <strong>{formatBigInt(totalSilver)}</strong>
                            </div>
                        </div>
                    </section>

                    <section className="panel panel--scanner">
                        <div className="panel-header">
                            <div>
                                <h2>Scanner</h2>
                                <p className="panel-subtitle">
                                    Feed coordinates into the galaxy map.
                                </p>
                            </div>
                        </div>
                        <div className="grid">
                            <label>
                                <span>X</span>
                                <input value={trackX} onChange={(e) => setTrackX(e.target.value)} />
                            </label>
                            <label>
                                <span>Y</span>
                                <input value={trackY} onChange={(e) => setTrackY(e.target.value)} />
                            </label>
                        </div>
                        <button className="primary" onClick={handleTrack} disabled={!client || busy}>
                            Add to galaxy
                        </button>
                        {trackLocationId && (
                            <p className="hint">
                                Location id: {trackLocationId.toString()}{" "}
                                {trackValid ? "(valid)" : "(invalid)"}
                            </p>
                        )}
                    </section>
                </aside>

                <main className="core">
                    <section className="panel galaxy-panel">
                        <div className="panel-header">
                            <div>
                                <h2>Galaxy Radar</h2>
                                <p className="panel-subtitle">
                                    Tracking {knownLocations.length} locations.
                                </p>
                            </div>
                            <div className="legend">
                                <span className="legend-item owned">Owned</span>
                                <span className="legend-item neutral">Neutral</span>
                                <span className="legend-item hostile">Other</span>
                            </div>
                        </div>
                        <div className="galaxy-grid">
                            <div className="galaxy-scan">
                                <svg className="galaxy-map" viewBox={viewBox}>
                                    <circle className="galaxy-boundary" cx={0} cy={0} r={mapRadius} />
                                    <line className="axis" x1={-mapRadius} y1={0} x2={mapRadius} y2={0} />
                                    <line className="axis" x1={0} y1={-mapRadius} x2={0} y2={mapRadius} />
                                    {knownLocations.map((location) => {
                                        const id = location.locationId.toString();
                                        const bundle = locationData[id];
                                        const planet = bundle?.planet;
                                        const owner = planet?.owner.toString() ?? "";
                                        const isZeroOwner = planet ? planet.owner.isZero() : true;
                                        const isOwned = owner && !isZeroOwner && owner === playerAddress;
                                        const isOther = owner && !isZeroOwner && owner !== playerAddress;
                                        const isHome = planet?.isHomePlanet ?? false;
                                        const className = isOwned
                                            ? "planet-point owned"
                                            : isOther
                                              ? "planet-point hostile"
                                              : "planet-point neutral";
                                        return (
                                            <circle
                                                key={id}
                                                className={`${className}${isHome ? " home" : ""}${
                                                    selectedId === id ? " selected" : ""
                                                }`}
                                                cx={Number(location.x)}
                                                cy={-Number(location.y)}
                                                r={selectedId === id ? 14 : 10}
                                                onClick={() => setSelectedId(id)}
                                            />
                                        );
                                    })}
                                </svg>
                                <div className="galaxy-overlay">
                                    <div className="overlay-card">
                                        <span className="label">Selection</span>
                                        <strong>
                                            {selectedLocation
                                                ? `${selectedLocation.x.toString()}, ${selectedLocation.y.toString()}`
                                                : "none"}
                                        </strong>
                                        <span className="overlay-meta">
                                            {selectedLocation
                                                ? shortAddress(selectedLocation.locationId.toString())
                                                : "--"}
                                        </span>
                                    </div>
                                    <div className="radar-controls">
                                        <div className="zoom-row">
                                            <button
                                                className="ghost small"
                                                onClick={() => adjustZoom(clampedZoom - 1)}
                                                aria-label="Zoom out"
                                            >
                                                -
                                            </button>
                                            <input
                                                className="zoom-slider"
                                                type="range"
                                                min="1"
                                                max="20"
                                                step="0.5"
                                                value={clampedZoom}
                                                onChange={(e) => adjustZoom(Number(e.target.value))}
                                            />
                                            <button
                                                className="ghost small"
                                                onClick={() => adjustZoom(clampedZoom + 1)}
                                                aria-label="Zoom in"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="zoom-actions">
                                            <button className="ghost small" onClick={fitTracked}>
                                                Fit tracked
                                            </button>
                                            <button
                                                className="ghost small"
                                                onClick={focusSelected}
                                                disabled={!selectedLocation}
                                            >
                                                Focus selected
                                            </button>
                                            <button className="ghost small" onClick={resetView}>
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="planet-list">
                                <h3>Tracked</h3>
                                <div className="planet-rows">
                                    {knownLocations.length === 0 && (
                                        <p className="hint">No tracked locations yet.</p>
                                    )}
                                    {knownLocations.map((location) => {
                                        const id = location.locationId.toString();
                                        const bundle = locationData[id];
                                        const planet = bundle?.planet;
                                        const owner = planet?.owner.toString() ?? "";
                                        const isZeroOwner = planet ? planet.owner.isZero() : true;
                                        return (
                                            <button
                                                key={id}
                                                className={`planet-row${selectedId === id ? " active" : ""}`}
                                                onClick={() => setSelectedId(id)}
                                            >
                                                <span>{shortAddress(id)}</span>
                                                <span className="row-meta">
                                                    x {location.x.toString()} y {location.y.toString()}
                                                </span>
                                                <span className="row-owner">
                                                    {owner === playerAddress && !isZeroOwner
                                                        ? "owned"
                                                        : owner && !isZeroOwner
                                                          ? "other"
                                                          : "neutral"}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="panel intel-panel">
                        <div className="panel-header">
                            <div>
                                <h2>Planet Intel</h2>
                                <p className="panel-subtitle">
                                    Deep scan of the selected world.
                                </p>
                            </div>
                            <div className="intel-owner">
                                <span className="label">Owner</span>
                                <strong>
                                    {selectedOwner ? shortAddress(selectedOwner) : "unclaimed"}
                                </strong>
                            </div>
                        </div>
                        {selectedLocation ? (
                            <div className="stack">
                                <div className="row">
                                    <span className="label">Location id</span>
                                    <span className="value">
                                        {selectedLocation.locationId.toString()}
                                    </span>
                                </div>
                                <div className="row">
                                    <span className="label">Coords</span>
                                    <span className="value">
                                        {selectedLocation.x.toString()}, {selectedLocation.y.toString()}
                                    </span>
                                </div>
                                <div className="stat-grid">
                                    {selectedStats.map((stat) => (
                                        <div key={stat.label} className="stat">
                                            <span>{stat.label}</span>
                                            <strong>{stat.value}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="hint">Select a location to inspect planet details.</p>
                        )}
                    </section>

                    <section className="panel actions-panel">
                        <div className="panel-header">
                            <div>
                                <h2>Command Orders</h2>
                                <p className="panel-subtitle">
                                    Issue actions to the selected coordinates.
                                </p>
                            </div>
                        </div>
                        <div className="action-grid">
                            <div className="action-card">
                                <h3>Init Player</h3>
                                <div className="grid">
                                    <label>
                                        <span>X</span>
                                        <input value={initX} onChange={(e) => setInitX(e.target.value)} />
                                    </label>
                                    <label>
                                        <span>Y</span>
                                        <input value={initY} onChange={(e) => setInitY(e.target.value)} />
                                    </label>
                                    <label>
                                        <span>Spawn radius</span>
                                        <input
                                            value={initRadius}
                                            onChange={(e) => setInitRadius(e.target.value)}
                                        />
                                    </label>
                                </div>
                                <button className="primary" onClick={initPlayer} disabled={!client || busy}>
                                    Send init_player
                                </button>
                            </div>

                            <div className="action-card">
                                <h3>Reveal</h3>
                                <div className="grid">
                                    <label>
                                        <span>X</span>
                                        <input value={revealX} onChange={(e) => setRevealX(e.target.value)} />
                                    </label>
                                    <label>
                                        <span>Y</span>
                                        <input value={revealY} onChange={(e) => setRevealY(e.target.value)} />
                                    </label>
                                </div>
                                <button className="ghost" onClick={() => applySelectedTo(setRevealX, setRevealY)}>
                                    Use selected
                                </button>
                                <button className="primary" onClick={revealLocation} disabled={!client || busy}>
                                    Send reveal_location
                                </button>
                            </div>

                            <div className="action-card wide">
                                <h3>Move</h3>
                                <div className="grid">
                                    <label>
                                        <span>From X</span>
                                        <input value={moveFromX} onChange={(e) => setMoveFromX(e.target.value)} />
                                    </label>
                                    <label>
                                        <span>From Y</span>
                                        <input value={moveFromY} onChange={(e) => setMoveFromY(e.target.value)} />
                                    </label>
                                    <label>
                                        <span>To X</span>
                                        <input value={moveToX} onChange={(e) => setMoveToX(e.target.value)} />
                                    </label>
                                    <label>
                                        <span>To Y</span>
                                        <input value={moveToY} onChange={(e) => setMoveToY(e.target.value)} />
                                    </label>
                                    <label>
                                        <span>Radius</span>
                                        <input value={moveRadius} onChange={(e) => setMoveRadius(e.target.value)} />
                                    </label>
                                    <label>
                                        <span>Dist max</span>
                                        <input value={moveDistMax} onChange={(e) => setMoveDistMax(e.target.value)} />
                                    </label>
                                    <label>
                                        <span>Pop moved</span>
                                        <input value={movePop} onChange={(e) => setMovePop(e.target.value)} />
                                    </label>
                                    <label>
                                        <span>Silver moved</span>
                                        <input value={moveSilver} onChange={(e) => setMoveSilver(e.target.value)} />
                                    </label>
                                    <label>
                                        <span>Artifact id</span>
                                        <input value={moveArtifactId} onChange={(e) => setMoveArtifactId(e.target.value)} />
                                    </label>
                                    <label className="checkbox">
                                        <span>Abandoning</span>
                                        <input
                                            type="checkbox"
                                            checked={moveAbandoning}
                                            onChange={(e) => setMoveAbandoning(e.target.checked)}
                                        />
                                    </label>
                                </div>
                                <div className="row actions-row">
                                    <button className="ghost" onClick={() => applySelectedTo(setMoveFromX, setMoveFromY)}>
                                        From selected
                                    </button>
                                    <button className="ghost" onClick={() => applySelectedTo(setMoveToX, setMoveToY)}>
                                        To selected
                                    </button>
                                    <button className="ghost" onClick={applyMoveDefaults}>
                                        Use planet range
                                    </button>
                                </div>
                                <button className="primary" onClick={runMove} disabled={!client || busy}>
                                    Send move
                                </button>
                            </div>

                            <div className="action-card">
                                <h3>Upgrade</h3>
                                <label>
                                    <span>Branch (0 def, 1 range, 2 speed)</span>
                                    <input value={upgradeBranch} onChange={(e) => setUpgradeBranch(e.target.value)} />
                                </label>
                                <button className="primary" onClick={runUpgrade} disabled={!client || busy || !selectedId}>
                                    Upgrade selected
                                </button>
                            </div>

                            <div className="action-card">
                                <h3>Prospect</h3>
                                <button className="primary" onClick={runProspect} disabled={!client || busy || !selectedId}>
                                    Prospect selected
                                </button>
                            </div>

                            <div className="action-card">
                                <h3>Find Artifact</h3>
                                <div className="grid">
                                    <label>
                                        <span>X</span>
                                        <input value={findX} onChange={(e) => setFindX(e.target.value)} />
                                    </label>
                                    <label>
                                        <span>Y</span>
                                        <input value={findY} onChange={(e) => setFindY(e.target.value)} />
                                    </label>
                                </div>
                                <button className="ghost" onClick={() => applySelectedTo(setFindX, setFindY)}>
                                    Use selected
                                </button>
                                <button className="primary" onClick={runFindArtifact} disabled={!client || busy}>
                                    Find artifact
                                </button>
                            </div>

                            <div className="action-card">
                                <h3>Trade Artifact</h3>
                                <label>
                                    <span>Artifact id</span>
                                    <input value={tradeArtifactId} onChange={(e) => setTradeArtifactId(e.target.value)} />
                                </label>
                                <label className="checkbox">
                                    <span>Withdraw</span>
                                    <input
                                        type="checkbox"
                                        checked={tradeWithdraw}
                                        onChange={(e) => setTradeWithdraw(e.target.checked)}
                                    />
                                </label>
                                <button
                                    className="primary"
                                    onClick={runTradeArtifact}
                                    disabled={!client || busy || !selectedId}
                                >
                                    Trade on selected
                                </button>
                            </div>

                            <div className="action-card">
                                <h3>Activate Artifact</h3>
                                <label>
                                    <span>Artifact id</span>
                                    <input
                                        value={activateArtifactId}
                                        onChange={(e) => setActivateArtifactId(e.target.value)}
                                    />
                                </label>
                                <label>
                                    <span>Wormhole to</span>
                                    <input
                                        value={activateWormholeTo}
                                        onChange={(e) => setActivateWormholeTo(e.target.value)}
                                    />
                                </label>
                                <label className="checkbox">
                                    <span>Activate</span>
                                    <input
                                        type="checkbox"
                                        checked={activateToggle}
                                        onChange={(e) => setActivateToggle(e.target.checked)}
                                    />
                                </label>
                                <button
                                    className="primary"
                                    onClick={runSetArtifactActivation}
                                    disabled={!client || busy || !selectedId}
                                >
                                    Toggle on selected
                                </button>
                            </div>

                            <div className="action-card">
                                <h3>Give Space Ships</h3>
                                <button
                                    className="primary"
                                    onClick={runGiveSpaceShips}
                                    disabled={!client || busy || !selectedId}
                                >
                                    Claim ships on selected
                                </button>
                            </div>
                        </div>
                    </section>
                </main>

                <aside className="dock right">
                    <section className="panel artifacts-panel">
                        <div className="panel-header">
                            <div>
                                <h2>Artifact Hangar</h2>
                                <p className="panel-subtitle">
                                    Items recovered from ruins and rips.
                                </p>
                            </div>
                        </div>
                        {artifactList.length === 0 ? (
                            <p className="hint">No artifacts found on tracked planets.</p>
                        ) : (
                            <div className="artifact-table">
                                {artifactList.map((entry) => (
                                    <div key={entry.id} className="artifact-row">
                                        <div>
                                            <strong>{shortAddress(entry.id)}</strong>
                                            <span className="meta">
                                                type {entry.artifact.artifactType} rarity{" "}
                                                {entry.artifact.rarity}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="label">Owner</span>
                                            <span className="value">
                                                {entry.owner ? shortAddress(entry.owner) : "unknown"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="label">Location</span>
                                            <span className="value">
                                                {formatBigInt(entry.locationId)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="panel logs-panel">
                        <div className="panel-header">
                            <div>
                                <h2>Ops Log</h2>
                                <p className="panel-subtitle">
                                    Transaction telemetry and system chatter.
                                </p>
                            </div>
                            {logs.length > 0 && (
                                <button className="ghost small" onClick={clearLogs} disabled={busy}>
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="logs">
                            {logs.length === 0 && <p className="hint">No logs yet.</p>}
                            {logs.map((entry, index) => (
                                <div key={`${entry.ts}-${index}`} className="log-row">
                                    <span className="log-ts">{entry.ts}</span>
                                    <span className="log-msg">{entry.message}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
