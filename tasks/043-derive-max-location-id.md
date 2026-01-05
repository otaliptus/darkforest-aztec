# Ticket 043 - Derive max_location_id from planet_rarity

## Goal
Ensure deployment scripts keep `max_location_id` consistent with `planet_rarity` so client mining and on-chain checks align.

## Acceptance Criteria
- Deploy scripts compute `max_location_id` as `FIELD_MODULUS / planet_rarity` (integer division).
- Overrides for `planet_rarity` (flags/env) automatically update `max_location_id`.
- No change to contract logic; only config generation/scripts updated.

## Out of Scope
- Client mining algorithm changes.
- Contract enforcement of the rarity formula.

## Deliverables
- Updated deploy scripts with derived `max_location_id`.
- Any inline comments documenting the relationship.
