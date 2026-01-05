# Claude UI Integration Plans - Dark Forest Aztec

**Created:** 2026-01-04  
**Status:** Detailed plan for future implementation

---

## Executive Summary

This document details the complete plan for integrating the original DarkForest v0.6 UI into the current Aztec implementation. The original UI is a sophisticated React + styled-components application with ~150 components, WebGL rendering, and a modal-based interface. The goal is to bring this rich visual experience to the Aztec version while rewiring the backend to use your Aztec contracts.

---

## Table of Contents

1. [Problem Analysis](#1-problem-analysis)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 1: Copy UI Skeleton](#3-phase-1-copy-ui-skeleton)
4. [Phase 2: Create Aztec Adapter](#4-phase-2-create-aztec-adapter)
5. [Phase 3: Simplify GameUIManager](#5-phase-3-simplify-gameuimanager)
6. [Phase 4: Type Mapping](#6-phase-4-type-mapping)
7. [Phase 5: Wire Entry Point](#7-phase-5-wire-entry-point)
8. [File-by-File Implementation Details](#8-file-by-file-implementation-details)
9. [Dependencies](#9-dependencies)
10. [Testing Plan](#10-testing-plan)

---

## 1. Problem Analysis

### Current State

**Your current UI (`apps/client/src/App.tsx`):**
- Single 1,084-line monolithic React component
- Plain CSS with CSS variables (modern, clean but minimal)
- Basic SVG galaxy map visualization
- Form-based actions (init, move, reveal, upgrade)
- Functional but lacks the visual richness of original

**Original DarkForest UI (`reference/darkforest-local/client/src/Frontend/`):**
- 150+ component files organized into:
  - `Components/` (30 files) - Reusable UI primitives
  - `Panes/` (31 files) - Modal panel contents
  - `Views/` (30 files) - Layout compositions
  - `Styles/` (7 files) - Design tokens, themes
  - `Utils/` (13 files) - Hooks, emitters, helpers
  - `Game/` (5 files) - Canvas, viewport, notifications
  - `Renderers/` (4 files) - Planetscape rendering
- WebGL-based galaxy rendering with shaders
- Draggable, persistent modal windows
- Rich tooltip system
- Procedural planet visualization

### Core Challenge

The original UI is tightly coupled to two main classes:
1. **`GameManager`** (3,500 lines) - Game state, contract calls, exploration
2. **`GameUIManager`** (1,437 lines) - UI state, selection, viewport

Both expect Ethereum contracts via ethers.js. We need to create an **adapter layer** that makes your Aztec client look like the original GameManager to the UI components.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Application                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  Original UI Components                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │   │
│  │  │ TopBar      │  │ SidebarPane │  │ GameWindowLayout    │   │   │
│  │  │ PlanetCard  │  │ PlanetDex   │  │ ControllableCanvas  │   │   │
│  │  │ SendResources│ │ SettingsPane│  │ Notifications       │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    UIManagerProvider                          │   │
│  │         (React Context providing GameUIManager)               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              GameUIManager (Simplified)                       │   │
│  │  - Selection state (selectedPlanetId$)                       │   │
│  │  - Hover state (hoverPlanet$)                                │   │
│  │  - Modal management                                          │   │
│  │  - Delegates to adapter                                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   AztecGameAdapter                            │   │
│  │  NEW FILE - Bridge between UI and Aztec                      │   │
│  │  - Implements subset of GameManager interface                │   │
│  │  - Converts between DF types <-> Aztec types                 │   │
│  │  - Wraps transaction calls                                   │   │
│  │  - Manages planet/artifact/player state                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                Your Existing Scripts                          │   │
│  │  - scripts/darkforest.ts (DarkForestClient)                  │   │
│  │  - scripts/chain.ts (readLocationBundle, etc.)               │   │
│  │  - scripts/hashing.ts (locationIdFromCoords, etc.)           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Aztec Network                             │   │
│  │  - Noir ZK Circuits                                          │   │
│  │  - DarkForest Contract                                       │   │
│  │  - NFT Contract (artifacts)                                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1: Copy UI Skeleton

### Goal
Copy the original Frontend components to `apps/client-og/` as a starting point.

### Directory Structure to Create

```
apps/client-og/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── .env.local                    # Copy from apps/client
├── public/
│   └── icons/                    # Copy from reference/darkforest-local/client/public/icons
│       ├── alerts/               # 36 alert icons
│       ├── arrow-right.svg
│       ├── broadcast.svg
│       ├── crown.svg
│       ├── help.svg
│       ├── leaderboard.svg
│       ├── planet.svg
│       ├── planetdex.svg
│       ├── population.svg
│       ├── range.svg
│       ├── silver.svg
│       ├── speed.svg
│       ├── twitter.svg
│       └── ... (25+ icons total)
└── src/
    ├── Backend/                  # NEW - Adapter layer
    │   ├── AztecGameAdapter.ts
    │   ├── GameUIManager.ts
    │   └── typeAdapters.ts
    ├── Frontend/                 # COPY from reference/darkforest-local
    │   ├── Components/           # 30 files
    │   ├── Panes/                # 31 files  
    │   ├── Views/                # 30 files
    │   ├── Styles/               # 7 files
    │   ├── Utils/                # 13 files (some need modification)
    │   ├── Game/                 # 5 files
    │   └── Renderers/            # 4 files
    ├── scripts/                  # COPY from apps/client/src/scripts
    │   ├── darkforest.ts
    │   ├── chain.ts
    │   ├── hashing.ts
    │   ├── types.ts
    │   └── contract-abi.json
    ├── shims/                    # COPY from apps/client/src/shims
    │   └── buffer.ts
    ├── config.ts                 # COPY from apps/client/src/config.ts
    ├── main.tsx                  # NEW - Entry point
    └── styles.css                # NEW - Global styles
```

### Files to Copy (Exact Commands)

```bash
# Create directory structure
mkdir -p apps/client-og/src/{Frontend,Backend,scripts,shims} apps/client-og/public

# Copy Frontend directories (unchanged)
cp -r reference/darkforest-local/client/src/Frontend/Components apps/client-og/src/Frontend/
cp -r reference/darkforest-local/client/src/Frontend/Panes apps/client-og/src/Frontend/
cp -r reference/darkforest-local/client/src/Frontend/Views apps/client-og/src/Frontend/
cp -r reference/darkforest-local/client/src/Frontend/Styles apps/client-og/src/Frontend/
cp -r reference/darkforest-local/client/src/Frontend/Utils apps/client-og/src/Frontend/
cp -r reference/darkforest-local/client/src/Frontend/Game apps/client-og/src/Frontend/
cp -r reference/darkforest-local/client/src/Frontend/Renderers apps/client-og/src/Frontend/

# Copy icons
cp -r reference/darkforest-local/client/public/icons apps/client-og/public/

# Copy your existing scripts
cp -r apps/client/src/scripts apps/client-og/src/
cp -r apps/client/src/shims apps/client-og/src/
cp apps/client/src/config.ts apps/client-og/src/
cp apps/client/.env.local apps/client-og/

# Copy original index.html as base (will modify)
cp reference/darkforest-local/client/index.html apps/client-og/
```

### Files NOT to Copy (Ethereum-specific)

| Original File/Directory | Reason |
|------------------------|--------|
| `Backend/GameLogic/GameManager.ts` | Replaced by AztecGameAdapter |
| `Backend/GameLogic/ContractsAPI.ts` | Ethereum contract calls |
| `Backend/Network/Blockchain*.ts` | Ethereum network handling |
| `Backend/Miner/*` | Web worker exploration (different approach) |
| `Backend/Utils/SnarkArgsHelper.ts` | Uses original circom circuits |
| `circuits/*` | Using Noir instead |
| `_types/darkforest/api/*` | Ethereum-specific types |

---

## 4. Phase 2: Create Aztec Adapter

### Goal
Create `AztecGameAdapter.ts` that bridges your `DarkForestClient` to the UI.

### File: `apps/client-og/src/Backend/AztecGameAdapter.ts`

**Full implementation (~400 lines):**

```typescript
/**
 * AztecGameAdapter - Bridge between Aztec DarkForest client and original DF UI.
 *
 * This adapter implements a subset of the GameManager interface that the original
 * UI components expect, translating calls to the Aztec backend.
 */

import type { DarkForestClient } from '../scripts/darkforest';
import {
  type LocationId,
  type EthAddress,
  type ArtifactId,
  type WorldCoords,
  type Planet,
  type Player,
  type Artifact,
  toLocationId,
  fromLocationId,
  toPlanet,
  toPlayer,
  toWorldCoords,
  toEthAddress,
} from './typeAdapters';
import {
  readLocationBundle,
  readPlayerBundle,
  readArtifactBundle,
} from '../scripts/chain';
import {
  locationIdFromCoords,
  toField,
  fieldToSignedInt,
} from '../scripts/hashing';

// ============================================
// Known Location Storage
// ============================================

interface KnownLocation {
  locationId: bigint;
  x: bigint;
  y: bigint;
  source: string;
}

const KNOWN_LOCATIONS_KEY = 'df-known-locations';

function loadKnownLocations(): KnownLocation[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(KNOWN_LOCATIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry: Record<string, string>) => ({
      locationId: BigInt(entry.locationId),
      x: BigInt(entry.x),
      y: BigInt(entry.y),
      source: String(entry.source ?? 'manual'),
    }));
  } catch {
    return [];
  }
}

function persistKnownLocations(locations: KnownLocation[]): void {
  if (typeof window === 'undefined') return;
  const payload = locations.map((entry) => ({
    locationId: entry.locationId.toString(),
    x: entry.x.toString(),
    y: entry.y.toString(),
    source: entry.source,
  }));
  window.localStorage.setItem(KNOWN_LOCATIONS_KEY, JSON.stringify(payload));
}

// ============================================
// Event Types
// ============================================

export enum GameManagerEvent {
  PlanetUpdate = 'PlanetUpdate',
  PlayerUpdate = 'PlayerUpdate',
  ArtifactUpdate = 'ArtifactUpdate',
  InitializedPlayer = 'InitializedPlayer',
  TxSubmitted = 'TxSubmitted',
  TxConfirmed = 'TxConfirmed',
  TxFailed = 'TxFailed',
}

export interface Transaction {
  id: string;
  type: string;
  state: 'pending' | 'submitted' | 'confirmed' | 'failed';
  hash?: string;
  error?: string;
}

type EventCallback = (...args: unknown[]) => void;

// ============================================
// Main Adapter Class
// ============================================

export class AztecGameAdapter {
  private client: DarkForestClient;
  private knownLocations: KnownLocation[];
  private planets: Map<string, Planet> = new Map();
  private artifacts: Map<string, Artifact> = new Map();
  private player: Player | null = null;
  private selectedPlanetId: LocationId | null = null;
  private hoverPlanetId: LocationId | null = null;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();

  // Emitters for React hooks compatibility
  public readonly planetUpdated$ = {
    subscribe: (cb: EventCallback) => this.on(GameManagerEvent.PlanetUpdate, cb),
  };
  public readonly playersUpdated$ = {
    subscribe: (cb: EventCallback) => this.on(GameManagerEvent.PlayerUpdate, cb),
  };
  public readonly artifactUpdated$ = {
    subscribe: (cb: EventCallback) => this.on(GameManagerEvent.ArtifactUpdate, cb),
  };

  constructor(client: DarkForestClient) {
    this.client = client;
    this.knownLocations = loadKnownLocations();
  }

  // ============================================
  // Event Emitter Methods
  // ============================================

  on(event: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  emit(event: string, ...args: unknown[]): void {
    this.eventListeners.get(event)?.forEach((cb) => cb(...args));
  }

  // ============================================
  // Account & Player Methods
  // ============================================

  getAccount(): EthAddress {
    return this.client.account.address.toString();
  }

  getPlayer(address?: EthAddress): Player | undefined {
    if (!address || address === this.getAccount()) {
      return this.player ?? undefined;
    }
    return undefined;
  }

  async refreshPlayer(): Promise<void> {
    const bundle = await readPlayerBundle(
      this.client.node,
      this.client.darkforestAddress,
      this.client.storageSlots,
      this.client.account.address
    );

    this.player = toPlayer(
      this.client.account.address,
      bundle.player,
      bundle.spaceJunk,
      bundle.spaceJunkLimit,
      bundle.claimedShips
    );

    this.emit(GameManagerEvent.PlayerUpdate);
  }

  isPlayerInitialized(): boolean {
    return this.player?.homePlanetId !== undefined;
  }

  getHomePlanet(): Planet | undefined {
    if (!this.player?.homePlanetId) return undefined;
    return this.planets.get(this.player.homePlanetId);
  }

  // ============================================
  // Planet Methods
  // ============================================

  getPlanetWithId(locationId: LocationId | undefined): Planet | undefined {
    if (!locationId) return undefined;
    return this.planets.get(locationId);
  }

  getPlanetWithCoords(coords: WorldCoords): Planet | undefined {
    const location = this.knownLocations.find(
      (loc) => Number(loc.x) === coords.x && Number(loc.y) === coords.y
    );
    if (!location) return undefined;
    return this.planets.get(toLocationId(location.locationId));
  }

  getMyPlanets(): Planet[] {
    const myAddress = this.getAccount();
    return Array.from(this.planets.values()).filter(
      (planet) => planet.owner === myAddress
    );
  }

  getAllPlanets(): Map<LocationId, Planet> {
    return this.planets;
  }

  getSelectedPlanet(): Planet | undefined {
    if (!this.selectedPlanetId) return undefined;
    return this.planets.get(this.selectedPlanetId);
  }

  setSelectedPlanet(planetId: LocationId | null): void {
    this.selectedPlanetId = planetId;
  }

  getHoverPlanet(): Planet | undefined {
    if (!this.hoverPlanetId) return undefined;
    return this.planets.get(this.hoverPlanetId);
  }

  setHoverPlanet(planetId: LocationId | null): void {
    this.hoverPlanetId = planetId;
  }

  // ============================================
  // Location Tracking
  // ============================================

  getKnownLocations(): Array<{ locationId: LocationId; coords: WorldCoords }> {
    return this.knownLocations.map((loc) => ({
      locationId: toLocationId(loc.locationId),
      coords: toWorldCoords(loc.x, loc.y),
    }));
  }

  trackLocation(x: bigint, y: bigint, source: string = 'manual'): LocationId {
    const locationId = locationIdFromCoords(
      toField(x),
      toField(y),
      this.client.gameConfig.planethashKey
    );

    const existing = this.knownLocations.find(
      (loc) => loc.locationId === locationId
    );

    if (!existing) {
      this.knownLocations.push({ locationId, x, y, source });
      persistKnownLocations(this.knownLocations);
    }

    return toLocationId(locationId);
  }

  async refreshLocations(): Promise<void> {
    for (const loc of this.knownLocations) {
      const bundle = await readLocationBundle(
        this.client.node,
        this.client.darkforestAddress,
        this.client.storageSlots,
        loc.locationId
      );

      const planet = toPlanet(loc.locationId, { x: loc.x, y: loc.y }, bundle.planet);
      this.planets.set(toLocationId(loc.locationId), planet);

      // Handle artifacts on this planet
      for (const artifactId of bundle.artifacts.ids) {
        if (artifactId !== 0n) {
          const artifactBundle = await readArtifactBundle(
            this.client.node,
            this.client.darkforestAddress,
            this.client.storageSlots,
            artifactId,
            this.client.nftAddress,
            this.client.nftStorageSlots
          );
          this.artifacts.set(artifactId.toString(), {
            id: artifactId.toString(),
            planetDiscoveredOn: toLocationId(loc.locationId),
            rarity: Number(artifactBundle.artifact.rarity),
            artifactType: Number(artifactBundle.artifact.artifactType),
            mintedAtTimestamp: 0,
            discoverer: artifactBundle.owner?.toString() ?? '',
            currentOwner: artifactBundle.owner?.toString() ?? '',
            isActivated: false,
            activations: 0,
            lastActivated: 0,
            lastDeactivated: 0,
          });
        }
      }

      this.emit(GameManagerEvent.PlanetUpdate, toLocationId(loc.locationId));
    }
  }

  // ============================================
  // Transaction Methods
  // ============================================

  private async runTransaction(
    label: string,
    fn: () => Promise<{
      getTxHash: () => Promise<{ toString: () => string }>;
      wait: () => Promise<void>;
    }>
  ): Promise<Transaction> {
    const txId = `${label}-${Date.now()}`;
    const tx: Transaction = { id: txId, type: label, state: 'pending' };

    try {
      this.emit(GameManagerEvent.TxSubmitted, tx);
      const result = await fn();
      const hash = await result.getTxHash();
      tx.hash = hash.toString();
      tx.state = 'submitted';
      this.emit(GameManagerEvent.TxSubmitted, tx);

      await result.wait();
      tx.state = 'confirmed';
      this.emit(GameManagerEvent.TxConfirmed, tx);

      // Refresh state after transaction
      await this.refreshPlayer();
      await this.refreshLocations();

      return tx;
    } catch (err) {
      tx.state = 'failed';
      tx.error = err instanceof Error ? err.message : String(err);
      this.emit(GameManagerEvent.TxFailed, tx);
      throw err;
    }
  }

  async initializePlayer(x: bigint, y: bigint, radius: bigint): Promise<Transaction> {
    return this.runTransaction('initPlayer', () =>
      this.client.initPlayer(toField(x), toField(y), radius)
    );
  }

  async revealLocation(x: bigint, y: bigint): Promise<Transaction> {
    return this.runTransaction('reveal', () =>
      this.client.revealLocation(toField(x), toField(y))
    );
  }

  async move(
    fromX: bigint,
    fromY: bigint,
    toX: bigint,
    toY: bigint,
    radius: bigint,
    distMax: bigint,
    popMoved: bigint,
    silverMoved: bigint,
    artifactId: bigint = 0n,
    abandoning: boolean = false
  ): Promise<Transaction> {
    return this.runTransaction('move', () =>
      this.client.move(
        toField(fromX),
        toField(fromY),
        toField(toX),
        toField(toY),
        radius,
        distMax,
        popMoved,
        silverMoved,
        artifactId,
        abandoning
      )
    );
  }

  async upgradePlanet(planetId: bigint, branch: number): Promise<Transaction> {
    return this.runTransaction('upgrade', () =>
      this.client.upgradePlanet(planetId, branch)
    );
  }

  async prospectPlanet(planetId: bigint): Promise<Transaction> {
    return this.runTransaction('prospect', () =>
      this.client.prospectPlanet(planetId)
    );
  }

  // ============================================
  // Game Config
  // ============================================

  getWorldRadius(): number {
    return Number(this.client.gameConfig.worldRadius);
  }

  getContractConstants(): Record<string, unknown> {
    return {
      WORLD_RADIUS: this.getWorldRadius(),
      MAX_NATURAL_PLANET_LEVEL: 9,
      PLANET_TYPE_WEIGHTS: [
        [1, 0, 0, 0, 0],
        [13, 2, 0, 1, 0],
        [12, 2, 1, 1, 0],
        [10, 4, 1, 2, 1],
      ],
    };
  }

  // ============================================
  // Artifact Methods
  // ============================================

  getArtifactWithId(artifactId: ArtifactId): Artifact | undefined {
    return this.artifacts.get(artifactId);
  }

  getArtifactsWithIds(ids: ArtifactId[]): (Artifact | undefined)[] {
    return ids.map((id) => this.artifacts.get(id));
  }

  getMyArtifacts(): Artifact[] {
    const myAddress = this.getAccount();
    return Array.from(this.artifacts.values()).filter(
      (a) => a.currentOwner === myAddress
    );
  }
}
```

---

## 5. Phase 3: Simplify GameUIManager

### Goal
Create a simplified version of `GameUIManager` that handles UI state.

### File: `apps/client-og/src/Backend/GameUIManager.ts`

**Full implementation (~250 lines):**

```typescript
/**
 * Simplified GameUIManager for Aztec integration.
 * 
 * Provides UI state management (selection, hover, modals) and delegates
 * all game operations to AztecGameAdapter.
 */

import { AztecGameAdapter } from './AztecGameAdapter';
import {
  type LocationId,
  type EthAddress,
  type Planet,
  type Player,
  type WorldCoords,
} from './typeAdapters';

type EventCallback = (...args: unknown[]) => void;

/**
 * Simple event emitter for React hooks
 */
class SimpleEmitter<T> {
  private listeners: Set<(value: T) => void> = new Set();
  private currentValue: T;

  constructor(initial: T) {
    this.currentValue = initial;
  }

  subscribe(callback: (value: T) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(value: T): void {
    this.currentValue = value;
    this.listeners.forEach((cb) => cb(value));
  }

  getValue(): T {
    return this.currentValue;
  }
}

/**
 * Modal state manager (simplified)
 */
export class ModalManager {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  removeListener(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }

  getModalPositions(): Map<string, { state: string }> {
    return new Map();
  }
}

/**
 * GameUIManager - UI state provider
 */
export class GameUIManager {
  private readonly adapter: AztecGameAdapter;
  private readonly modalManager: ModalManager;
  private overlayContainer: HTMLDivElement | undefined;

  // Observable state emitters
  public readonly selectedPlanetId$: SimpleEmitter<LocationId | undefined>;
  public readonly hoverPlanet$: SimpleEmitter<Planet | undefined>;
  public readonly hoverPlanetId$: SimpleEmitter<LocationId | undefined>;

  private constructor(adapter: AztecGameAdapter) {
    this.adapter = adapter;
    this.modalManager = new ModalManager();
    this.selectedPlanetId$ = new SimpleEmitter<LocationId | undefined>(undefined);
    this.hoverPlanet$ = new SimpleEmitter<Planet | undefined>(undefined);
    this.hoverPlanetId$ = new SimpleEmitter<LocationId | undefined>(undefined);
  }

  static create(adapter: AztecGameAdapter): GameUIManager {
    return new GameUIManager(adapter);
  }

  destroy(): void {
    // Cleanup
  }

  // Overlay / Modal
  setOverlayContainer(container?: HTMLDivElement): void {
    this.overlayContainer = container;
  }

  getOverlayContainer(): HTMLDivElement | undefined {
    return this.overlayContainer;
  }

  getModalManager(): ModalManager {
    return this.modalManager;
  }

  // Account / Player
  getAccount(): EthAddress {
    return this.adapter.getAccount();
  }

  getPlayer(address?: EthAddress): Player | undefined {
    return this.adapter.getPlayer(address);
  }

  getGameManager(): AztecGameAdapter {
    return this.adapter;
  }

  // Planet Selection
  getPlanetWithId(id: LocationId | undefined): Planet | undefined {
    return this.adapter.getPlanetWithId(id);
  }

  getSelectedPlanet(): Planet | undefined {
    return this.adapter.getSelectedPlanet();
  }

  setSelectedPlanet(planet: Planet | undefined): void {
    const id = planet?.locationId ?? null;
    this.adapter.setSelectedPlanet(id);
    this.selectedPlanetId$.emit(id ?? undefined);
  }

  setSelectedId(planetId: LocationId | undefined): void {
    this.adapter.setSelectedPlanet(planetId ?? null);
    this.selectedPlanetId$.emit(planetId);
  }

  getHoverPlanet(): Planet | undefined {
    return this.adapter.getHoverPlanet();
  }

  setHoverPlanet(planet: Planet | undefined): void {
    const id = planet?.locationId ?? null;
    this.adapter.setHoverPlanet(id);
    this.hoverPlanet$.emit(planet);
    this.hoverPlanetId$.emit(id ?? undefined);
  }

  // World Config
  getWorldRadius(): number {
    return this.adapter.getWorldRadius();
  }

  get contractConstants(): Record<string, unknown> {
    return this.adapter.getContractConstants();
  }

  // Planets
  getMyPlanets(): Planet[] {
    return this.adapter.getMyPlanets();
  }

  getAllPlanets(): Map<LocationId, Planet> {
    return this.adapter.getAllPlanets();
  }

  // Artifacts
  getArtifactWithId(id: string) {
    return this.adapter.getArtifactWithId(id);
  }

  getArtifactsWithIds(ids: string[]) {
    return this.adapter.getArtifactsWithIds(ids);
  }

  getMyArtifacts() {
    return this.adapter.getMyArtifacts();
  }

  // Settings stubs
  getStringSetting(_setting: string): string | undefined {
    return undefined;
  }

  getBooleanSetting(_setting: string): boolean {
    return false;
  }

  // Feature flags
  getSpaceJunkEnabled(): boolean {
    return true;
  }

  captureZonesEnabled: boolean = false;

  getCaptureZoneGenerator(): null {
    return null;
  }

  // Actions
  async initializePlayer(x: bigint, y: bigint, radius: bigint) {
    return this.adapter.initializePlayer(x, y, radius);
  }

  async revealLocation(x: bigint, y: bigint) {
    return this.adapter.revealLocation(x, y);
  }

  async move(
    fromX: bigint,
    fromY: bigint,
    toX: bigint,
    toY: bigint,
    radius: bigint,
    distMax: bigint,
    popMoved: bigint,
    silverMoved: bigint,
    artifactId?: bigint,
    abandoning?: boolean
  ) {
    return this.adapter.move(
      fromX, fromY, toX, toY,
      radius, distMax, popMoved, silverMoved,
      artifactId, abandoning
    );
  }

  async upgradePlanet(planetId: bigint, branch: number) {
    return this.adapter.upgradePlanet(planetId, branch);
  }

  async refreshState() {
    await this.adapter.refreshPlayer();
    await this.adapter.refreshLocations();
  }
}

export default GameUIManager;
```

---

## 6. Phase 4: Type Mapping

### Goal
Create type adapter functions between Aztec bigint types and original DF hex string types.

### File: `apps/client-og/src/Backend/typeAdapters.ts`

**Full implementation (~220 lines):**

```typescript
/**
 * Type adapters for converting between Aztec DarkForest types and original DF types.
 */

// ============================================
// Base Type Aliases
// ============================================

// Original DF uses hex strings
export type LocationId = string;  // '0x1234...'
export type EthAddress = string;
export type ArtifactId = string;

// Aztec uses bigints
export type AztecLocationId = bigint;

// ============================================
// Conversion Functions
// ============================================

/**
 * Convert bigint locationId to hex string (64 chars, zero-padded)
 */
export function toLocationId(id: bigint): LocationId {
  return '0x' + id.toString(16).padStart(64, '0');
}

/**
 * Convert hex string to bigint
 */
export function fromLocationId(id: LocationId): bigint {
  return BigInt(id);
}

/**
 * Convert Aztec address to EthAddress format
 */
export function toEthAddress(address: { toString: () => string }): EthAddress {
  return address.toString();
}

// ============================================
// Common Types
// ============================================

export interface WorldCoords {
  x: number;
  y: number;
}

export function toWorldCoords(x: bigint, y: bigint): WorldCoords {
  return { x: Number(x), y: Number(y) };
}

// ============================================
// Enums
// ============================================

export enum PlanetType {
  PLANET = 0,
  SILVER_MINE = 1,
  RUINS = 2,
  TRADING_POST = 3,
  SILVER_BANK = 4,
}

export enum SpaceType {
  NEBULA = 0,
  SPACE = 1,
  DEEP_SPACE = 2,
  DEAD_SPACE = 3,
}

export enum ArtifactRarity {
  Unknown = 0,
  Common = 1,
  Rare = 2,
  Epic = 3,
  Legendary = 4,
  Mythic = 5,
}

export enum ArtifactType {
  Unknown = 0,
  Monolith = 1,
  Colossus = 2,
  Spaceship = 3,
  Pyramid = 4,
  Wormhole = 5,
  PlanetaryShield = 6,
  PhotoidCannon = 7,
  BloomFilter = 8,
  BlackDomain = 9,
}

// ============================================
// Entity Interfaces
// ============================================

export interface Player {
  address: EthAddress;
  initTimestamp?: number;
  homePlanetId?: LocationId;
  lastRevealTimestamp?: number;
  score?: number;
  spaceJunk?: number;
  spaceJunkLimit?: number;
  claimedShips?: number;
  twitter?: string;
}

export interface Planet {
  locationId: LocationId;
  perlin: number;
  spaceType: SpaceType;
  owner: EthAddress;
  hatLevel: number;
  planetLevel: number;
  planetType: PlanetType;
  isHomePlanet: boolean;
  energyCap: number;
  energy: number;
  silver: number;
  silverCap: number;
  energyGrowth: number;
  silverGrowth: number;
  range: number;
  speed: number;
  defense: number;
  upgradeState: [number, number, number];
  heldArtifactIds: ArtifactId[];
  destroyed: boolean;
  frozen: boolean;
  invader?: EthAddress;
  capturer?: EthAddress;
  prospectedBlockNumber?: number;
  hasTriedFindingArtifact?: boolean;
}

export interface Artifact {
  id: ArtifactId;
  planetDiscoveredOn: LocationId;
  rarity: ArtifactRarity;
  artifactType: ArtifactType;
  mintedAtTimestamp: number;
  discoverer: EthAddress;
  currentOwner: EthAddress;
  isActivated: boolean;
  activations: number;
  lastActivated: number;
  lastDeactivated: number;
  wormholeTo?: LocationId;
}

// ============================================
// Conversion Functions for Entities
// ============================================

export function toPlanet(
  locationId: bigint,
  coords: { x: bigint; y: bigint },
  planetData: {
    owner: { toString: () => string; isZero: () => boolean };
    population: bigint;
    silver: bigint;
    range: bigint;
    speed: bigint;
    defense: bigint;
    perlin: bigint;
    planetLevel: number;
    planetType: number;
    spaceType: number;
    isHomePlanet: boolean;
    isInitialized: boolean;
  }
): Planet {
  const owner = planetData.owner.isZero()
    ? '0x0000000000000000000000000000000000000000'
    : planetData.owner.toString();

  return {
    locationId: toLocationId(locationId),
    perlin: Number(planetData.perlin),
    spaceType: planetData.spaceType as SpaceType,
    owner,
    hatLevel: 0,
    planetLevel: planetData.planetLevel,
    planetType: planetData.planetType as PlanetType,
    isHomePlanet: planetData.isHomePlanet,
    energyCap: Number(planetData.population) * 2,
    energy: Number(planetData.population),
    silver: Number(planetData.silver),
    silverCap: Number(planetData.silver) * 2,
    energyGrowth: 100,
    silverGrowth: planetData.planetType === PlanetType.SILVER_MINE ? 50 : 0,
    range: Number(planetData.range),
    speed: Number(planetData.speed),
    defense: Number(planetData.defense),
    upgradeState: [0, 0, 0],
    heldArtifactIds: [],
    destroyed: false,
    frozen: false,
  };
}

export function toPlayer(
  address: { toString: () => string },
  playerData: {
    isInitialized: boolean;
    homePlanet: bigint;
    lastRevealBlock: number;
  },
  spaceJunk: bigint,
  spaceJunkLimit: bigint,
  claimedShips: bigint
): Player {
  return {
    address: address.toString(),
    initTimestamp: playerData.isInitialized ? Date.now() : undefined,
    homePlanetId: playerData.isInitialized
      ? toLocationId(playerData.homePlanet)
      : undefined,
    lastRevealTimestamp: playerData.lastRevealBlock,
    score: 0,
    spaceJunk: Number(spaceJunk),
    spaceJunkLimit: Number(spaceJunkLimit),
    claimedShips: Number(claimedShips),
  };
}
```

---

## 7. Phase 5: Wire Entry Point

### File: `apps/client-og/src/main.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { UIManagerProvider } from './Frontend/Utils/AppHooks';
import GameUIManager from './Backend/GameUIManager';
import { AztecGameAdapter } from './Backend/AztecGameAdapter';
import { connectDarkForest } from './scripts/darkforest';
import { CLIENT_CONFIG } from './config';
import './styles.css';

function LoadingScreen({ status, error }: { status: string; error?: string }) {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <h1>Dark Forest</h1>
        <p className="subtitle">Aztec Edition</p>
        <div className="loading-status">
          <div className="spinner" />
          <span>{status}</span>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

function GameUI({ uiManager }: { uiManager: GameUIManager }) {
  // Simplified game UI - will later integrate original components
  const adapter = uiManager.getGameManager();
  const [planets, setPlanets] = useState(adapter.getMyPlanets());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    adapter.refreshPlayer();
    adapter.refreshLocations().then(() => {
      setPlanets(adapter.getMyPlanets());
    });
  }, [adapter]);

  const handleTrack = () => {
    const x = prompt('Enter X coordinate:');
    const y = prompt('Enter Y coordinate:');
    if (x && y) {
      try {
        const locId = adapter.trackLocation(BigInt(x), BigInt(y), 'manual');
        setSelectedId(locId);
        adapter.refreshLocations().then(() => {
          setPlanets(adapter.getMyPlanets());
        });
      } catch {
        alert('Invalid coordinates');
      }
    }
  };

  const worldRadius = adapter.getWorldRadius();
  const allLocations = adapter.getKnownLocations();

  return (
    <UIManagerProvider value={uiManager}>
      <div className="game-container">
        <header className="top-bar">
          <div className="logo">Dark Forest</div>
          <div className="account">Account: {adapter.getAccount().slice(0, 10)}...</div>
        </header>

        <div className="main-layout">
          <aside className="sidebar">
            <div className="panel">
              <h3>Player</h3>
              <p>Planets: {planets.length}</p>
              <button onClick={handleTrack}>Track Coordinates</button>
            </div>

            <div className="panel">
              <h3>Tracked Locations</h3>
              <ul className="location-list">
                {allLocations.map((loc) => (
                  <li
                    key={loc.locationId}
                    className={selectedId === loc.locationId ? 'selected' : ''}
                    onClick={() => setSelectedId(loc.locationId)}
                  >
                    ({loc.coords.x}, {loc.coords.y})
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <main className="canvas-area">
            <svg
              className="galaxy-map"
              viewBox={`${-worldRadius} ${-worldRadius} ${worldRadius * 2} ${worldRadius * 2}`}
            >
              <circle className="boundary" cx={0} cy={0} r={worldRadius} />
              <line className="axis" x1={-worldRadius} y1={0} x2={worldRadius} y2={0} />
              <line className="axis" x1={0} y1={-worldRadius} x2={0} y2={worldRadius} />

              {allLocations.map((loc) => (
                <circle
                  key={loc.locationId}
                  className={`planet ${selectedId === loc.locationId ? 'selected' : ''}`}
                  cx={loc.coords.x}
                  cy={-loc.coords.y}
                  r={12}
                  onClick={() => setSelectedId(loc.locationId)}
                />
              ))}
            </svg>
          </main>

          {selectedId && (
            <aside className="details-panel">
              <div className="panel">
                <h3>Selected Planet</h3>
                <p>ID: {selectedId.slice(0, 16)}...</p>
                {(() => {
                  const planet = adapter.getPlanetWithId(selectedId);
                  if (!planet) return <p>Loading...</p>;
                  return (
                    <>
                      <div className="stat-row"><span>Energy</span><span>{planet.energy}</span></div>
                      <div className="stat-row"><span>Silver</span><span>{planet.silver}</span></div>
                      <div className="stat-row"><span>Range</span><span>{planet.range}</span></div>
                      <div className="stat-row"><span>Speed</span><span>{planet.speed}</span></div>
                      <div className="stat-row"><span>Defense</span><span>{planet.defense}</span></div>
                    </>
                  );
                })()}
              </div>
            </aside>
          )}
        </div>
      </div>
    </UIManagerProvider>
  );
}

function App() {
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState<string>();
  const [uiManager, setUIManager] = useState<GameUIManager | null>(null);

  useEffect(() => {
    async function connect() {
      try {
        setStatus('Connecting to Aztec network...');
        const logger = (msg: string) => {
          console.log(msg);
          setStatus(msg);
        };
        const client = await connectDarkForest(CLIENT_CONFIG, logger);
        setStatus('Creating game adapter...');
        const adapter = new AztecGameAdapter(client);
        const manager = GameUIManager.create(adapter);
        setStatus('Loading player data...');
        await adapter.refreshPlayer();
        setUIManager(manager);
      } catch (e) {
        console.error('Connection failed:', e);
        setError(e instanceof Error ? e.message : String(e));
        setStatus('Connection failed');
      }
    }

    if (!CLIENT_CONFIG.darkforestAddress) {
      setError('VITE_DARKFOREST_ADDRESS not set in .env.local');
      setStatus('Configuration error');
      return;
    }

    connect();
  }, []);

  if (!uiManager) {
    return <LoadingScreen status={status} error={error} />;
  }

  return <GameUI uiManager={uiManager} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## 8. File-by-File Implementation Details

### New Files to Create

| File | Lines | Purpose |
|------|-------|---------|
| `src/Backend/AztecGameAdapter.ts` | ~400 | Main bridge class |
| `src/Backend/GameUIManager.ts` | ~250 | UI state management |
| `src/Backend/typeAdapters.ts` | ~220 | Type conversions |
| `src/main.tsx` | ~200 | React entry point |
| `src/styles.css` | ~250 | Global CSS |
| `package.json` | ~35 | Dependencies |
| `vite.config.ts` | ~35 | Vite configuration |
| `tsconfig.json` | ~25 | TypeScript config |
| `index.html` | ~15 | HTML entry |

### Files to Modify from Original

| File | Changes |
|------|---------|
| `Frontend/Utils/AppHooks.ts` | Rewrite hooks to use new adapter |
| `Frontend/Utils/EmitterHooks.ts` | Keep as-is (generic) |

### Files to Keep Unchanged

All files in:
- `Frontend/Components/`
- `Frontend/Panes/`
- `Frontend/Views/`
- `Frontend/Styles/`

---

## 9. Dependencies

### package.json

```json
{
  "name": "client-og",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@darkforest-aztec/shared": "0.0.1",
    "@aztec/accounts": "3.0.0-devnet.20251212",
    "@aztec/aztec.js": "3.0.0-devnet.20251212",
    "@aztec/noir-contracts.js": "3.0.0-devnet.20251212",
    "@aztec/pxe": "3.0.0-devnet.20251212",
    "@aztec/test-wallet": "3.0.0-devnet.20251212",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "styled-components": "^5.3.11",
    "eventemitter3": "^5.0.1",
    "color": "^4.2.3"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/styled-components": "^5.1.26",
    "@types/color": "^3.0.6",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.4.4",
    "vite": "^5.4.6",
    "vite-plugin-node-polyfills": "^0.22.0"
  }
}
```

**Note:** Requires Node.js >= 20.10 due to Aztec dependencies.

---

## 10. Testing Plan

### Milestone 1: UI Renders
- Run `yarn dev`
- Verify loading screen appears
- No console errors

### Milestone 2: Adapter Connects
- Account address displays in TopBar
- No connection errors

### Milestone 3: Planets Load
- Track coordinates appear in list
- Planets render on galaxy map

### Milestone 4: Selection Works
- Click planet → PlanetCard shows stats
- Stats update correctly

### Milestone 5: Transactions Work
- initPlayer succeeds
- move succeeds
- State refreshes after tx

---

## Summary

This plan provides a complete blueprint for integrating the original DarkForest UI into your Aztec implementation. The key insight is the **adapter pattern** - creating a `AztecGameAdapter` class that makes your Aztec client look like the original `GameManager` to the UI components.

**Estimated effort:** 7-9 days for full implementation
**Alternative:** Port design system + components incrementally (3-4 days for 80% visual improvement)
