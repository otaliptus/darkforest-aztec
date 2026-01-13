# Ticket 0005: Perlin Caching Note

## Goal
Reduce proof cost by caching Perlin-derived values for known locations without changing public state or game logic.

## Acceptance Criteria
- Introduce a private note (or private storage) that binds `location_id`, computed Perlin output, and the relevant config hash.
- Mint the note after a successful Perlin computation in private entrypoints (e.g., `init_player`/`reveal_location`) without changing public state layout.
- Add a private entrypoint path that consumes or re-emits the note to skip `multi_scale_perlin` when a cached value is provided.
- Ensure note usage is safe: the cached value must be proven to match the current config hash and the target `location_id`.
- Public apply functions and emitted state remain faithful to Dark Forest v0.6.
- Add/extend Noir tests proving cached and uncached paths produce identical results.
