# Ticket 111 - Sync planet rarity with max_location_id in client

## Goal
Prevent init/reveal failures when on-chain `planet_rarity` and `max_location_id` are inconsistent by deriving the effective client rarity from `max_location_id` (the value enforced in private validators).

## Acceptance Criteria
- Client derives an effective planet rarity from `max_location_id` when building contract constants.
- Mining/home-planet search uses the effective rarity so chosen locations satisfy `location_id < max_location_id`.
- Warn once when `planet_rarity` and `max_location_id` imply different rarities.
- No contract changes.

## Out of Scope
- Changing on-chain config after deployment.
- Modifying Noir contract validation logic.

## Deliverables
- Updated client config/constants logic to reconcile `planet_rarity` vs `max_location_id`.
- Minimal warning log when a mismatch is detected.

## Tests
- `yarn --cwd apps/client test`

## Status
- In progress
