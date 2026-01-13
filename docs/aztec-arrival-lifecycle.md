# Arrival lifecycle + proof model (Aztec Dark Forest)

This document is a **single‑file, external‑researcher‑friendly** reference that explains:

- what is proven (and when),
- how arrivals are created and resolved,
- what is public vs private,
- and where to look in the codebase.

It also includes **ASCII diagrams** and **short code excerpts**.

---

## 1) High‑level: what is proven on Aztec vs OG EVM

**Aztec model**
- Every state transition (even public‑only) is a **proven transaction**.
- So `move`, `resolve_arrival`, `upgrade`, `prospect`, etc. **all require proofs**.

**OG EVM (Dark Forest v0.6)**
- `move` uses a zk‑proof to hide x,y.
- `resolve_arrival` is a **normal EVM tx** (no zk proof).

**Consequence**
- On Aztec, arrival resolution costs **proof time** as well as block inclusion time.
- Block time only gates *when* resolve can happen, not how long proving takes.

---

## 2) Public vs private data (privacy model)

**Public (on‑chain)**
- `locationId` (hash of x,y)
- planet stats / owner / artifacts / arrivals
- arrival records (from, to, arrivalBlock, energy, silver, etc.)
- revealed x,y **only** from `reveal_location`

**Private**
- x,y of planets (unless revealed)
- proofs that x,y are valid for locationId

This is the same privacy surface as OG v0.6: **only x,y are cloaked**.

---

## 3) Storage structures (Noir)

**Files:**
- `packages/contracts/src/types.nr`
- `packages/contracts/src/main.nr`

### Arrival type (packed)
From `packages/contracts/src/types.nr`:

```noir
pub struct Arrival {
    pub player: AztecAddress,
    pub from_planet: Field,
    pub to_planet: Field,
    pub pop_silver: u128,
    pub meta: u128,
    pub carried_artifact_id: Field,
}

// pop_silver = (pop_arriving << 64) | silver_moved
// meta = departure_block | (arrival_block << 32) | (arrival_type << 64) | (distance << 72)
```

### Arrival queues per planet
Also in `types.nr`:

```noir
pub struct PlanetArrivals {
    pub ids: [u128; 6],
}

// Each u128 stores 2 x u64 arrival IDs => 12 slots.
```

### Storage maps
From `packages/contracts/src/main.nr`:

```noir
arrivals: Map<Field, PublicMutable<Arrival, Context>, Context>,
planet_arrivals: Map<Field, PublicMutable<PlanetArrivals, Context>, Context>,
next_arrival_id: PublicMutable<u64, Context>,
```

Arrivals are **public storage**.

---

## 4) Arrival lifecycle (contract path)

### 4.1 Move creates arrival record
In `apply_move` (Noir):

```noir
let arrival_id = self.storage.next_arrival_id.read();
...
arrival_list = arrival_list.set(i, arrival_id);
self.storage.planet_arrivals.at(to_location_id).write(arrival_list);

let arrival = Arrival::new(..., departure_block, arrival_block, arrival_type, ...);
self.storage.arrivals.at(arrival_key).write(arrival);
self.storage.next_arrival_id.write(arrival_id + 1);
```

### 4.2 Resolve entrypoint
Private entrypoint from `main.nr`:

```noir
#[external("private")]
fn resolve_arrival(arrival_id: u64) {
    self.enqueue(
        DarkForest::at(self.context.this_address()).apply_move(
            AztecAddress::zero(), 0, 0, 0,
            arrival_id as u128, 0, 0, 0,
            false,
        )
    );
}
```

### 4.3 Public apply path (arrival flag)
In `apply_move`:

```noir
let is_arrival = config_hash == 0;
if is_arrival {
    let arrival_id = move_config as u64;
    self.internal.execute_arrival(arrival_id);
} else {
    // normal move path
}
```

### 4.4 Execute arrival
From `main.nr`:

```noir
let arrival = self.storage.arrivals.at(arrival_key).read();
assert(current_block >= arrival.arrival_block());

let mut planet = self.storage.planets.at(arrival.to_planet).read();
planet = self.internal.refresh_planet(..., arrival.arrival_block());

// apply combat/ownership/silver/artifacts
self.storage.planets.at(arrival.to_planet).write(planet);

// remove from queue + clear arrival
arrival_list = arrival_list.set(i, 0);
self.storage.planet_arrivals.at(arrival.to_planet).write(arrival_list);
self.storage.arrivals.at(arrival_key).write(Arrival::empty());
```

### 4.5 Lazy processing when a planet is “touched”
Some actions call `process_pending_arrivals(...)`:

- `apply_move` (for from & to planets)
- `execute_upgrade_planet` (for target planet)

Snippet:

```noir
self.internal.process_pending_arrivals(location_id, current_block);
```

`process_pending_arrivals` loops (bounded) and resolves mature arrivals.

---

## 5) Arrival lifecycle (client path)

**Files:**
- `apps/client/src/Backend/Aztec/scripts/chain.ts`
- `apps/client/src/Backend/GameLogic/ContractsAPI.ts`
- `apps/client/src/Backend/GameLogic/GameManager.ts`

### 5.1 Read arrival queues
From `chain.ts`:

```ts
export const readPlanetArrivals = async (...) => {
  const fields = await readPublicMapFields(..., 6);
  return decodePlanetArrivals(fields);
};

export const readArrivalState = async (...) => {
  const fields = await readPublicMapFields(..., 6);
  return decodeArrival(fields);
};
```

### 5.2 Contracts API (resolve)
From `ContractsAPI.ts`:

```ts
public async resolveArrival(arrivalId: VoyageId): Promise<string | undefined> {
  const sentTx = await this.aztecConnection.getClient().resolveArrival(id);
  await sentTx.wait(); // proof + confirmation
  return txHash;
}
```

### 5.3 Resolve scheduling loop
From `GameManager.ts`:

```ts
listenForNewBlock() -> resolveMaturedArrivals(blockNumber)

resolveMaturedArrivals:
  - filter arrivals where arrivalTime <= current block
  - queueResolveArrival(arrival)
```

`queueResolveArrival` rechecks on‑chain arrival state and then calls
`contractsAPI.resolveArrival(...)`.

### 5.4 Client mode flag (auto‑resolve vs optimistic)
The client now supports a feature flag that controls whether it **proves and submits**
`resolve_arrival` transactions automatically.

- **Flag:** `DF_AUTO_RESOLVE_ARRIVALS` (`true` by default)
- **When `true`:** behavior is unchanged — the client auto‑resolves matured arrivals
  (proof + submit) and the UI waits on those confirmations.
- **When `false`:** the client **does not** auto‑resolve; it applies mature arrivals
  *locally* using `ArrivalUtils.arrive(...)` when blocks advance, so the UI updates
  without waiting on resolve proofs. On‑chain state is still only updated by an
  explicit `resolve_arrival` tx or a later action that touches the planet.

---

## 6) ASCII diagrams

### 6.1 Move creates arrival

```
Client           Aztec Node           DarkForest (Noir)
  |                   |                       |
  |-- prove move tx -->|                       |
  |-- submit move ---->|                       |
  |                   |-- apply_move -------->|
  |                   |    - write Arrival    |
  |                   |    - enqueue arrival  |
  |                   |<-- confirm -----------|
```

### 6.2 Resolve arrival

```
Client/keeper     Aztec Node           DarkForest (Noir)
  |                   |                       |
  |-- wait >= arrivalBlock ------------------|
  |-- prove resolve tx ----------------------|
  |-- submit resolve ----------------------->|
  |                   |-- execute_arrival --->|
  |                   |    - refresh planet  |
  |                   |    - apply combat    |
  |                   |    - clear arrival   |
  |                   |<-- confirm ----------|
```

### 6.3 Lazy resolve when planet is touched

```
Player action (move/upgrade/...) -> apply_* -> process_pending_arrivals
   (bounded loop, resolves mature arrivals for that planet)
```

---

## 7) Why resolve still needs a proof

Because Aztec requires **proofs for every state transition**, even public ones.
Arrival resolution changes state (planet owner, population, silver, artifacts),
so it must be proven each time it is executed.

This is the fundamental difference vs OG EVM, where resolve is a simple public
transaction with no zk proof.

---

## 8) What we do NOT do (constraints)

- We do not resolve arrivals **on‑chain** without a tx (local UI may apply optimistic arrivals
  when auto‑resolve is disabled).
- We do not reveal x,y except via `reveal_location`.
- We do not change spawn rules or insert sentinel coords.
- We do not move away from Aztec (grant constraint).

---

## 9) Suggested operational mitigation

Because resolve needs proofs, production UX is best when a **resolver daemon**
submits resolve txs on behalf of users, rather than requiring each client to
prove resolves locally.

---

## 10) Quick file index

- `packages/contracts/src/types.nr` — Arrival + PlanetArrivals
- `packages/contracts/src/main.nr` — apply_move, resolve_arrival, execute_arrival
- `apps/client/src/Backend/Aztec/scripts/chain.ts` — public reads (arrivals)
- `apps/client/src/Backend/GameLogic/ContractsAPI.ts` — resolveArrival tx
- `apps/client/src/Backend/GameLogic/GameManager.ts` — resolve scheduling
