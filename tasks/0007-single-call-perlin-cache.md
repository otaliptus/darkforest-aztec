# Ticket 0007: Single-Call Perlin Cache Entrypoints

## Goal
Collapse cached Perlin flows into a single private entrypoint so no extra cache_perlin transaction is required.

## Acceptance Criteria
- Update cached private entrypoints to accept a `use_cache` flag and compute Perlin when no cache note is used.
- When `use_cache` is false, compute Perlin inside the same call and optionally mint a cache note for future use.
- Keep all public state updates identical to v0.6 behavior and existing cached semantics.
- Update Noir tests to cover both cache and compute paths.
- Update the Aztec client to use the single-call cached entrypoints (remove cache+batch path).
