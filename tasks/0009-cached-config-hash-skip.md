# Ticket 0009: Skip Config Hash When Cached

## Goal
Avoid recomputing the config hash (MiMC) on cached Perlin paths by trusting the cached note’s config hash.

## Acceptance Criteria
- When `use_cache` is true, cached entrypoints use `expected_config_hash` directly and skip `config_hash(...)` computation.
- Cached note validation still enforces that the note’s `config_hash` matches `expected_config_hash`.
- Non-cached paths still compute and check `config_hash` as before.
- Public state updates remain identical to v0.6 behavior.
- Update tests only if required; existing cached tests must pass.
