# Ticket 039 - Local dev map size + planet density

## Goal
Make local dev games faster to load and easier to play by shrinking the world radius and reducing planet density without changing core gameplay logic.

## Acceptance Criteria
- Local deploy script supports configuring `world_radius` and `planet_rarity` (via env or CLI flags) without code edits.
- Default init/reveal coordinates stay within the configured world radius for small maps.
- Documentation notes the new local dev knobs and suggested values for a small map.
- No contract logic changes beyond config values; no unbounded loops in public functions.

## Out of Scope
- Changes to production/mainnet config defaults.
- Altering on-chain validation logic or gameplay rules.

## Deliverables
- Updated local deploy script configuration.
- Updated docs describing small‑map settings.

## Tests / Commands
- Manual: redeploy with a small radius and confirm client connects + init/reveal succeeds.

## Status
- Archived (2026-01-08).

