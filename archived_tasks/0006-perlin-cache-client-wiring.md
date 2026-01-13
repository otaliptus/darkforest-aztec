# Ticket 0006: Perlin Cache Client Wiring

## Goal
Wire the client to use cached-Perlin private entrypoints when a Perlin cache note is available.

## Acceptance Criteria
- Add client support for calling `cache_perlin` and the cached entrypoints (`init_player_cached`, `reveal_location_cached`, `find_artifact_cached`).
- If no cache note exists, auto-submit `cache_perlin` before cached entrypoints (prefer batching).
- Preserve existing behavior as fallback if caching fails.
- Keep transaction intent/types updated to carry cache note index or handle cache selection cleanly.
- Ensure client calls remain faithful to contract validation (same config hash and location checks).
- Update/extend client tests only if existing patterns exist.
