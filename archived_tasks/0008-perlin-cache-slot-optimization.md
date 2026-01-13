# Ticket 0008: Perlin Cache Slot Optimization

## Goal
Reduce cached-path proof cost by avoiding MiMC for cache slot derivation and location_id recomputation.

## Acceptance Criteria
- Extend `PerlinCacheNote` to include `x` and `y` so cached paths can validate coordinates without recomputing location_id.
- Derive cache storage slots from `location_id + PERLIN_CACHE_SLOT_SALT` (no MiMC) and update client lookup accordingly.
- Add `cached_location_id` param to cached entrypoints and cache_perlin; use when `use_cache` or provided.
- Add `cached_location_id` parameter to cached entrypoints; when `use_cache` is true, use it instead of recomputing location_id.
- Keep config hash checks intact and public state behavior identical to v0.6.
- Update Noir tests and client wiring to the new cached-entrypoint signature.
