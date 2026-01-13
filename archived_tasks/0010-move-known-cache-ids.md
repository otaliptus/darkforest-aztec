# Ticket 0010: Move-Known Cached Location IDs

## Goal
Reduce proving cost for `move_known` by skipping MiMC location-id computation when a cached note exists.

## Acceptance Criteria
- Extend `move_known` to accept `use_cache`, `cached_to_location_id`, and `cache_note_index`.
- When `use_cache` is true, validate a Perlin cache note for `x2,y2` and `expected_config_hash`, then use `cached_to_location_id`.
- When `use_cache` is false, keep the existing MiMC + config-hash path.
- Public apply logic remains unchanged.
- Update client wiring to supply the new args and use cache when available.
- Update tests if any move_known calls are present.
