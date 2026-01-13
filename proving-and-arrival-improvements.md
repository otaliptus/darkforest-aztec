# Proving Time & Arrival Resolution: Deep Research

> **Research Date**: 2026-01-13  
> **Focus**: Understanding and optimizing ZK proof generation in Aztec Dark Forest

---

## 🎯 Executive Summary

Proving performance in Aztec Dark Forest is constrained by:

1. **Client-side ZK proving** (WASM in browser) is inherently slower than native
2. **MiMC-220** rounds per hash is expensive (~440 operations for location ID)
3. **Perlin noise** requires 12 MiMC-4 calls (3 scales × 4 corners)
4. **Arrival resolution** requires explicit transactions (no lazy resolution like v0.6)

The good news: There are **multiple optimization vectors** available at different layers.

---

## 📊 Current Bottleneck Analysis

### The Proving Stack

```
┌────────────────────────────────────────────────────────────┐
│                    Client (Browser)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TypeScript → Aztec.js → PXE → WASM Prover          │  │
│  │                                                      │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Noir Circuit (Proves Private Functions)       │  │  │
│  │  │  • MiMC hashes (location ID, config hash)      │  │  │
│  │  │  • Perlin noise (3 scales × 4 gradients)       │  │  │
│  │  │  • Fixed-point arithmetic                       │  │  │
│  │  │  • Range checks, assertions                     │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Constraint Cost Breakdown

| Operation | Constraint Source | Approximate Gate Count | Frequency |
|-----------|------------------|----------------------|-----------|
| MiMC-220 (location ID) | 220 rounds × x^5 | **~1320+ gates** | Every move |
| MiMC-220 (config hash) | 220 rounds × x^5 | **~1320+ gates** | Every move |
| Perlin noise | 3×4 MiMC-4 + interpolation | **~300+ gates** | Per unknown planet |
| `bn254::decompose` | 128-bit limb split | **~4 constraints** | Per random_u4 |
| Fixed-point exp/pow | exp_neg_q32, pow2_frac_q32 | ~100-200 gates | Per stat calc |

> [!NOTE]
> **Already Optimized**: `random_u4` now uses `bn254::decompose` instead of `to_le_bits(254)`, saving ~250 constraints per call (12 calls per perlin = ~3000 constraints saved per perlin computation).

---

## 🔬 Deep Research Findings

### 1. Aztec Proving Architecture

Aztec uses a multi-layer proving approach:

| Layer | Proving System | Purpose |
|-------|---------------|---------|
| **Client (PXE)** | WASM + Web Workers | Private function execution |
| **Sequencer** | UltraHonk | Public function execution |
| **Prover Network** | MegaHonk | Block proofs |

**Key Insight**: Client-side proving with WASM is 3-4x slower than desktop native, and potentially 10x slower than optimized server-side provers.

### 2. Hash Function Comparison (ZK-Friendly)

| Hash | Rounds | Exponent | Constraints (R1CS) | Notes |
|------|--------|----------|-------------------|-------|
| **MiMC (DF v0.6)** | 220 | 5 | ~1320 per hash | Original Dark Forest |
| **MiMC (Aztec)** | 91 | 7 | ~730 per hash | ✅ **IMPLEMENTED** |
| Poseidon | 8-63 | N/A | ~213 per hash | 40% more efficient |
| Rescue | Variable | N/A | Similar to Poseidon | STARK-friendly |
| Griffin | Low | N/A | ~96 per hash | Newest, under review |

> [!IMPORTANT]
> **Aztec MiMC Implemented**: We've switched to Noir's standard MiMC parameters (91 rounds, exponent 7). This provides ~45% fewer constraints per hash but creates a NEW game universe with different location IDs. This is controlled by the `USE_AZTEC_MIMC` feature flag in `feature_flags.nr`.


### 3. Noir Optimization Techniques

#### Unconstrained Functions
Noir allows moving expensive computations outside the circuit:

```noir
// Instead of this (expensive in-circuit computation):
fn compute_expensive(x: Field) -> Field {
    // 1000+ constraints
}

// Use this pattern:
unconstrained fn compute_expensive_hint(x: Field) -> Field {
    // Runs outside circuit, no constraints
}

fn compute_expensive_verified(x: Field) -> Field {
    let result = compute_expensive_hint(x);
    // Just verify the result is correct (much cheaper)
    assert(verify_result(x, result));
    result
}
```

**Applicable to Dark Forest**:
- Config hash verification (precompute, pass as hint)
- Planet stat calculations (compute outside, verify inside)

#### Gate Golfing Techniques, Based on Research

1. **Use Field types directly** - Integer types like `u64` add range constraints
2. **Avoid bit operations in-circuit** - `&`, `|`, `>>` are expensive
3. **Prefer arithmetic over comparisons** - `x * y` cheaper than `if x > y`
4. **Static vs dynamic** - Compile-time known values eliminate branches

### 4. Client-Side Proving Performance

Research findings from Ethereum PSE and Aztec:

| Environment | Relative Speed | Notes |
|-------------|---------------|-------|
| Native (optimized) | 1x (baseline) | Server-side provers |
| Desktop Browser WASM | 3-5x slower | Good multithreading |
| Mobile Browser WASM | 10-15x slower | Limited cores/memory |

**WASM Optimizations**:
- Web Workers for parallelization
- Minimize JS↔WASM data transfer
- Chunked memory allocation
- Background proving with UI feedback

---

## 💡 Optimization Strategies by Layer

### Layer 1: Circuit Optimizations (Noir)

#### ✅ Already Implemented
- `bn254::decompose` in `random_u4` (saves ~3000/perlin)

#### 🔧 To Implement

| ID | Optimization | Impact | Effort | Risk |
|----|-------------|--------|--------|------|
| L1-1 | Use `move_known()` for touched planets | **High** | Low | None |
| L1-2 | Precomputed config hashes as hints | **Medium** | Medium | Low |
| L1-3 | Unconstrained planet stat calculation | **Medium** | High | Medium |
| L1-4 | Batch multiple MiMC hashes | Low | High | Medium |

**L1-1: Prefer `move_known()`**
```typescript
// Before: Always compute perlin (expensive)
await contract.move(from, to, forces, silver, artifact);

// After: Skip perlin if destination is known
if (planetIsKnown(toLocationId)) {
    await contract.move_known(from, to, forces, silver, artifact);
} else {
    await contract.move(from, to, forces, silver, artifact);
}
```
**Savings**: ~300 gates per move to known planet (most mid/late game moves).

---

### Layer 2: Client Optimizations (TypeScript/PXE)

| ID | Optimization | Impact | Effort |
|----|-------------|--------|--------|
| L2-1 | Parallel proof preparation | **High** | Medium |
| L2-2 | Proof caching for repeated patterns | Medium | Medium |
| L2-3 | Optimistic UI with background proving | **High** | Low |
| L2-4 | Web Worker pool for proofs | Medium | High |

**L2-3: Optimistic UI Pattern**
```typescript
// Show move immediately, prove in background
function scheduleMove(from, to, forces) {
    // 1. Update local state optimistically
    localState.addPendingMove({ from, to, forces, status: 'proving' });
    
    // 2. Trigger proof generation in background
    proveInBackground(() => {
        const tx = await contract.move(from, to, forces);
        localState.updateMove(moveId, { status: 'submitted', txHash: tx.hash });
    });
}
```

---

### Layer 3: Arrival Resolution Improvements

The fundamental difference from v0.6:

| Aspect | v0.6 (EVM) | Aztec |
|--------|-----------|-------|
| Resolution | Lazy (on next interaction) | Explicit `resolve_arrival()` |
| Cost | Free (part of next tx) | Separate proof + tx |
| Timing | Instant resolution view | Delayed until resolved |

#### Optimization Strategies

| ID | Strategy | Impact | Complexity |
|----|----------|--------|------------|
| L3-1 | Piggyback on player actions | **High** | None |
| L3-2 | Smart resolution scheduling | **High** | Low |
| L3-3 | Batch multiple resolutions | Medium | Medium |
| L3-4 | Background tick service | Medium | Low |

**L3-1: Piggyback Resolution** (Already implemented in contract!)
```noir
// In apply_move(), arrivals are auto-resolved:
self.internal.process_pending_arrivals(from_location_id, current_block);
self.internal.process_pending_arrivals(to_location_id, current_block);
```
**Client should**: Skip explicit `resolve_arrival()` if a move is pending.

**L3-2: Smart Scheduling**
```typescript
const PROVING_BUFFER_BLOCKS = 2; // Account for proving time

function scheduleArrivalResolution(arrival: Arrival) {
    const resolveBlock = arrival.arrivalTime + PROVING_BUFFER_BLOCKS;
    
    // Don't resolve if:
    // 1. Already pending resolution
    // 2. Move to/from same planet is in-flight (will piggyback)
    if (hasPendingResolve(arrival.id) || hasPendingMoveFor(arrival.toPlanet)) {
        return; // Skip, will be handled
    }
    
    scheduleAtBlock(resolveBlock, () => resolve(arrival.id));
}
```

---

### Layer 4: Infrastructure Optimizations

| ID | Strategy | Impact | Feasibility |
|----|----------|--------|-------------|
| L4-1 | Foreground tick service | **High** | Good |
| L4-2 | Proof pre-generation service | Medium | Complex |
| L4-3 | Decentralized prover network | Future | Aztec roadmap |

**L4-1: Foreground Tick Service** (Extends existing `aztec-tick.mjs`)

```javascript
// Existing: Fast block production
while (true) {
    await rollup.methods.advance_time().send().wait();
    await sleep(1000);
}

// Extended: Also resolve mature arrivals
while (true) {
    await rollup.methods.advance_time().send().wait();
    
    // Resolve all mature arrivals
    const matureArrivals = await getMatureArrivals();
    for (const arrival of matureArrivals) {
        await df.methods.resolve_arrival(arrival.id).send().wait();
    }
    
    await sleep(1000);
}
```

---

## 📈 Optimization Priority Matrix

### Critical Path (Pre-Launch)

```
[1] L1-1: Prefer move_known()     ████████████████████ HIGH IMPACT, LOW EFFORT
[2] L3-2: Smart resolution         ████████████████████ HIGH IMPACT, LOW EFFORT
[3] L2-3: Optimistic UI            ███████████████░░░░░ HIGH IMPACT, MED EFFORT
[4] L3-1: Piggyback (client-side)  ██████████████░░░░░░ MED IMPACT, LOW EFFORT
```

### Phase 2 (Post-MVP)

```
[5] L1-2: Config hash hints        ████████████░░░░░░░░ MED IMPACT, MED EFFORT
[6] L4-1: Foreground tick          ███████████░░░░░░░░░ MED IMPACT, LOW EFFORT
[7] L2-4: Web Worker pool          ████████░░░░░░░░░░░░ MED IMPACT, HIGH EFFORT
```

### Future Research

```
[8] L1-3: Unconstrained stats      ██████░░░░░░░░░░░░░░ MED IMPACT, HIGH RISK
[9] L4-3: Decentralized provers    ████░░░░░░░░░░░░░░░░ FUTURE (Aztec roadmap)
```

---

## 🛠 Benchmarking & Profiling Tools

### Circuit Analysis
```bash
# Get gate counts and ACIR opcodes
cd packages/contracts
nargo info

# Expected output format:
# +-------------------+--------+---------+
# | Function          | ACIR   | Gates   |
# +-------------------+--------+---------+
# | move              | 1234   | 12345   |
# | move_known        | 987    | 9876    | # Should be smaller!
# +-------------------+--------+---------+
```

### Runtime Profiling
```typescript
// Add instrumentation to aztec-client
const startProve = performance.now();
const tx = await contract.move(...args);
const endProve = performance.now();
const startWait = performance.now();
await tx.wait();
const endWait = performance.now();

console.log(`Prove: ${endProve - startProve}ms, Wait: ${endWait - startWait}ms`);
```

---

## 📚 References & Sources

### Aztec Documentation
- [Honk Proving System](https://aztec.network/docs) - UltraHonk for client-side
- [PXE Architecture](https://aztec.network/docs) - Private Execution Environment
- [Client-Side Proving](https://aztec.network/docs) - WASM + Web Workers

### Noir Optimization
- [Noir Optimization Docs](https://noir-lang.org/docs/how_to/how-to-oracles) - Unconstrained functions
- [Gate Golfing Guide](https://noir-lang.org) - Constraint reduction
- [ACIR Overview](https://oxor.io) - Intermediate representation

### ZK-Friendly Hashing
- [RareSkills: Poseidon vs MiMC](https://rareskills.io) - Constraint comparison
- [Zellic: ZK Hash Survey](https://zellic.io) - Modern hash functions

### Client-Side Proving Research
- [PSE Client-Side Proving](https://pse.dev) - Mobile benchmarks
- [wasmsnark](https://github.com) - Browser proof generation
- [Aleph Zero zkOS](https://alephzero.org) - Sub-second client proofs

---

## 🔑 Key Constraints (Cannot Change)

> [!IMPORTANT]
> **MiMC Parameters Fixed**: 220 rounds, exponent 5, specific constants. Required for v0.6 parity - all location IDs, artifact IDs, and perlin values depend on this.

> [!NOTE]
> **Arrival Model Difference Accepted**: v0.6's lazy resolution replaced by explicit calls. This is semantically different but acceptable per grant requirements.

> [!WARNING]
> **60s Turn Time Requirement**: Grant requires <60s from tx creation to mempool submission. Current status needs benchmarking with actual proofs enabled.

---

## ✅ Immediate Action Items

### This Week
- [ ] Benchmark current proving times with `nargo info` and runtime profiling
- [ ] Implement client preference for `move_known()` over `move()`
- [ ] Add proving buffer to arrival resolution timers

### Next Sprint
- [ ] Implement piggyback resolution detection in client
- [ ] Add optimistic UI for moves
- [ ] Extend `aztec-tick.mjs` for arrival resolution

### Backlog
- [ ] Investigate unconstrained function pattern for config hashes
- [ ] Web Worker pool for parallel proof preparation
- [ ] Proof caching for repeated move patterns
