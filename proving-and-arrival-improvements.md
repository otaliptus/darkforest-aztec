# Proving Time & Arrival Resolution Improvement Ideas

Analysis of `darkforest-aztec` repository for performance optimizations that maintain v0.6 parity.

---

## Current Bottlenecks

### 1. Proving Time Components

The grant requires **<60s per turn** from tx creation to mempool submission. Key proof-intensive operations:

| Operation | Constraint Source | Est. Cost |
|-----------|------------------|-----------|
| MiMC hash (location ID) | 220 rounds × 2 inputs | **High** |
| MiMC hash (config hash) | 220 rounds × 2 inputs | **High** |
| Perlin noise calculation | 3 scales × 4 corners × MiMC-4 | **High** |
| `to_le_bits()` decomposition | 254-bit field decomposition | Medium |
| Fixed-point arithmetic | `exp_neg_q32`, `pow2_frac_q32` | Low |

### 2. Arrival Resolution Model

Unlike v0.6's lazy resolution, Aztec requires **explicit** `resolve_arrival()` calls:
- Each arrival resolution requires a separate transaction
- Multiple arrivals on same planet = multiple txs
- UX delay if client doesn't auto-resolve

---

## Grant-Safe Improvement Ideas

### A. Proving Time Optimizations

#### 1. **Perlin `random_u4` Optimization** (Ticket 0101)

**Current code** (`perlin.nr:21-29`):
```noir
fn random_u4(...) -> u8 {
    let out = mimc_sponge_3_4(x, y, scale, key);
    let bits: [u1; 254] = out.to_le_bits();  // Expensive!
    ...
}
```

**Improvement**: Replace 254-bit decomposition with constrained modulo:
```noir
fn random_u4_v2(...) -> u8 {
    let out = mimc_sponge_3_4(x, y, scale, key);
    // Constrain: out = quotient * 16 + remainder
    let remainder = out as u8 & 15;  
    remainder
}
```

**Impact**: Reduces ~254 constraints to ~4 constraints per gradient lookup (12 calls per perlin).

**Risk**: Low — output equivalence must be validated via test vectors.

**Status**: Ticket 0101 exists but not implemented.

---

#### 2. **Precompute Config Hashes on Deployment**

**Current**: Every `move()` call computes `config_hash()` in the private function.

**Improvement**: Store both config hashes at deployment (already done for spacetype/biome):
```noir
// Already exists:
self.storage.config_hash_spacetype.write(spacetype_hash);
self.storage.config_hash_biome.write(biome_hash);

// Client passes contract-stored hash, private function just validates equality
```

**Impact**: Skip MiMC computation in private function if client provides correct hash.

**Risk**: None — the hashes are already stored; just need client to read them.

---

#### 3. **Use `move_known` for Known Destinations**

**Current implementation** (`main.nr:2251-2328`):
- `move()`: Computes perlin for destination (expensive: 3 MiMC-4 calls)
- `move_known()`: Skips perlin, requires destination already initialized

**Improvement**: Client should prefer `move_known()` for all moves to already-touched planets.

**Impact**: Eliminates perlin computation (~36 MiMC operations) for most moves.

**Risk**: None — already implemented in contract, just needs client preference.

---

#### 4. **Batch Multiple Actions in Single Tx** (Design Idea)

**Opportunity**: Actions like `prospect_planet` + `find_artifact` could be batched.

**Constraint**: Aztec's private→public model may not support arbitrary batching.

**Impact**: Reduces per-tx overhead but requires contract changes.

**Risk**: Medium — may require grant scope extension approval.

---

### B. Arrival Resolution Improvements

#### 5. **Proactive Arrival Resolution Scheduling**

**Current Client Behavior**: 
- Client maintains `arrivalTimers` that trigger resolution attempts
- Long proving times can cause resolution to be attempted before tx is ready

**Improvement**: 
1. Track pending `resolve_arrival` txs to avoid duplicate attempts
2. Add buffer (e.g., +2 blocks) before triggering resolution to account for proving
3. Batch-resolve multiple arrivals to same planet in single interaction check

**Implementation** (client-side, no contract change):
```typescript
// Before submitting resolve_arrival
if (hasPendingResolveFor(arrivalId) || hasInflightMoveFor(toPlanet)) {
  skip(); // Already in-flight
}

// Schedule with proving buffer
const arriveBlock = arrival.arrivalTime;
const resolveBlock = arriveBlock + PROVING_BUFFER_BLOCKS; // e.g., +2
```

**Reference**: Ticket 110 addresses related guards.

---

#### 6. **Piggyback Resolution on Player Actions**

**Current**: `process_pending_arrivals()` is called inside `apply_move()` (line 2360-2361).

**Opportunity**: Any player action touching a planet already resolves pending arrivals:
```noir
self.internal.process_pending_arrivals(from_location_id, current_block);
self.internal.process_pending_arrivals(to_location_id, current_block);
```

**Client Optimization**: 
- Don't call explicit `resolve_arrival()` if a move to/from that planet is pending
- The move will naturally resolve arrivals as a side effect

**Impact**: Reduces total tx count; arrivals resolved "for free" during moves.

---

#### 7. **Foreground Tick Service** (Existing Ticket 118)

**Concept**: Background service that calls resolution for all players' arrivals.

**Implementation**: `aztec-tick.mjs` already exists for block advancement:
```javascript
// Could be extended to also call resolve_arrival for each mature arrival
await df.resolve_arrival(arrivalId);
```

**Trade-off**: 
- Pro: Removes resolution burden from individual players
- Con: Centralized service; who pays gas?

**Status**: Ticket 118 explores non-admin foreground tick.

---

### C. Contract-Level Micro-Optimizations

#### 8. **Early-Exit Loops with Mutable Flags**

**Current pattern** (appears 20+ times):
```noir
let mut found = false;
for i in 0..12 {
    if !found & (condition) {
        // do work
        found = true;
    }
}
```

**Noir limitation**: No `break` statement; loop always runs full iterations.

**Mitigation**: Already using `!found` guard. No further optimization possible in current Noir.

---

#### 9. **Reduce Arrival Slot Iterations**

**Current**: `planet_arrivals` stores 12 slots, always iterated:
```noir
for i in 0..12 {
    let arrival_id = arrival_list.get(i);
    ...
}
```

**Potential**: Store a count alongside the array to early-terminate when possible.

**Contract Change**: 
```noir
struct PlanetArrivals {
    count: u8,
    ids: [u64; 12],
}
```

**Impact**: Minor — iteration is cheap compared to MiMC.

**Risk**: Medium — changes storage layout, requires migration.

---

## Improvement Priority Matrix

| # | Improvement | Impact | Risk | Contract Change | Grant Safe |
|---|-------------|--------|------|-----------------|------------|
| 1 | Perlin `random_u4` optimization | High | Low | Yes (internal) | ✅ |
| 2 | Use stored config hashes | Medium | None | No | ✅ |
| 3 | Prefer `move_known()` in client | High | None | No | ✅ |
| 4 | Batch actions | Medium | Medium | Yes | ⚠️ Scope |
| 5 | Arrival resolution scheduling | High | Low | No | ✅ |
| 6 | Piggyback on moves | Medium | None | No | ✅ |
| 7 | Foreground tick service | Medium | Low | No | ✅ |
| 8 | Early-exit loops | None | — | N/A | — |
| 9 | Arrival count tracking | Low | Medium | Yes | ⚠️ Migration |

---

## Recommended Immediate Actions

### High-Priority (Pre-Grant Deadline)

1. **Implement Ticket 0101** — Optimize `random_u4` to remove `to_le_bits(254)`
2. **Client: Prefer `move_known()`** — Route moves to known planets through optimized path
3. **Client: Arrival resolution guards** — Prevent duplicate resolve attempts (Ticket 110)
4. **Benchmark with proofs enabled** — Validate <60s requirement

### Medium-Priority (Nice-to-Have for MVP)

5. Piggyback arrival resolution on player moves
6. Add proving buffer to arrival timers
7. Document expected block time assumptions

### Post-MVP

8. Explore foreground tick service for server-side resolution
9. Consider arrival slot count optimization
10. Evaluate action batching patterns

---

## Key Constraints

> [!IMPORTANT]
> **MiMC cannot be replaced.** Task 0004 confirmed that `noir-lang/mimc` uses different parameters (91 rounds, exponent 7) vs Dark Forest (220 rounds, exponent 5). Changing would break location IDs, artifact IDs, and perlin values — violating v0.6 parity.

> [!NOTE]  
> **Arrival resolution model is semantically different from v0.6** but acceptable per grant. The v0.6 lazy resolution is replaced by explicit calls, which is fundamentally Aztec-native.

---

## References

- [Task 0004: MiMC Optimization Research](tasks/0004-mimc-optimization-research.md)
- [Task 0101: Perlin random_u4 Optimization](tasks/0101-perlin-random-u4-optimization.md)
- [Task 110: Resolve Arrival Guards](tasks/110-resolve-arrival-guards.md)
- [Review 2026-01-07: MVP Differences](review-2026-01-07-1046.md)
- [Grant Proposal](grant_proposal.md) — 60s turn time requirement
